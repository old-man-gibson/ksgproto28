<script lang="ts">
  import { gs, game } from '../state.svelte';
  import { SKILLS } from '../../core/registry';
  import type { NoteDurId, NoteEvent } from '../../core/types';
  import {
    BASE_BARS,
    MAX_BPM,
    MIN_BPM,
    MUSIC_METERS,
    MUSIC_SCALES,
    MUSIC_UNLOCKS,
    NOTE_DURATIONS,
    TONIC_NAMES,
  } from '../../core/data/music.data';
  import {
    currentVoice,
    ensureAudio,
    isMuted,
    playSheet,
    secondsPerUnit,
    setMuted,
    setVoice,
    stopMusic,
    VOICES,
  } from '../lib/musicAudio';
  import {
    addEvent,
    addRepeat,
    allowedPitches,
    barCapacity,
    barUnitsUsed,
    CADENCE_WORDS,
    checkComposition,
    expandRepeats,
    keyName,
    maxBars,
    mergeEvents,
    meterOf,
    moveEvent,
    musicLevel,
    pedalOf,
    pedalUnlocked,
    MUSICIANSHIP_ID,
    nextUnlock,
    performanceTicks,
    readComposition,
    removeEvent,
    removeRepeat,
    repeatAt,
    repeatsUnlocked,
    scalesUnlocked,
    setBarCount,
    setMeter,
    setRepeatTimes,
    setPedal,
    setScale,
    setTempo,
    setTonic,
    splitEvent,
    tempoOf,
    tempoUnlocked,
    tiesUnlocked,
    toggleTie,
    tuningUnlocked,
  } from '../../core/systems/music';
  import Tip from '../lib/Tip.svelte';
  import { LAYER, hostLayer, pushOverlay } from '../lib/overlays';

  /**
   * The sheet. Bars are real staves — five lines, ledger line for middle C,
   * accidentals drawn where the ruling needs them — because the reading is
   * computed from what is on the page, and nobody games what they cannot see.
   * The panel never hides the analysis: key, contour, syncopation and entropy
   * are shown live, unperformable or not, the same way the spell bench parses
   * sentences you cannot yet speak.
   */

  const level = $derived(musicLevel(gs));
  const skill = $derived(gs.skills[MUSICIANSHIP_ID]);
  const reach = $derived(nextUnlock(level));

  let selectedId = $state<number | null>(null);
  const comp = $derived(
    gs.compositions.find((c) => c.id === selectedId) ?? gs.compositions[0] ?? null,
  );

  /** The palette: chosen duration, and whether the next placement is a rest. */
  let durId = $state<NoteDurId>('half');
  let resting = $state(false);
  let lastRefusal = $state<string | null>(null);
  /**
   * Accidental applied to the next placement: −1 flat, 0 natural, +1 sharp.
   * This is how the staff reaches pitches its ruling does not name — click
   * the row the note leans on and let the sign do the rest.
   */
  let accidental = $state(0);

  const problems = $derived(comp ? checkComposition(gs, comp) : []);
  const reading = $derived(comp ? readComposition(comp) : null);
  const meter = $derived(comp ? meterOf(comp) : MUSIC_METERS.common);
  const capacity = $derived(barCapacity(meter));
  const performing = $derived(gs.performance);
  const performingComp = $derived(
    performing ? gs.compositions.find((c) => c.id === performing.compositionId) : null,
  );

  const DUR_ORDER = Object.keys(NOTE_DURATIONS) as NoteDurId[];

  function newSheet() {
    const made = game.createComposition();
    selectedId = made.id;
  }

  // ---------- Hearing it ----------

  let mutedNow = $state(isMuted());
  let voiceNow = $state(currentVoice().id);
  let listening = $state(false);
  let listenTimer: ReturnType<typeof setTimeout> | undefined;

  function toggleMute() {
    ensureAudio();
    mutedNow = !mutedNow;
    setMuted(mutedNow);
  }

  /**
   * Start an audition of any stretch of bars — the whole sheet, one bar, or
   * from-here-to-the-end. Whatever was sounding stops first, so clicking
   * around while iterating on a bar always plays the latest thought.
   */
  function startAudition(bars: NoteEvent[][]) {
    if (!comp) return;
    ensureAudio();
    clearTimeout(listenTimer);
    stopMusic();
    const bpm = tempoOf(comp);
    playSheet(bars, bpm, pedalOf(comp), bars.length * capacity);
    listening = true;
    listenTimer = setTimeout(
      () => (listening = false),
      bars.length * capacity * secondsPerUnit(bpm) * 1000 + 300,
    );
  }

  /** Audition the sheet AS PERFORMED — repeats unrolled, like the stage. */
  function toggleListen() {
    if (listening) {
      clearTimeout(listenTimer);
      stopMusic();
      listening = false;
      return;
    }
    if (comp) startAudition(expandRepeats(comp).bars);
  }

  /** Hear from a written bar to the end, repeats included. */
  function listenFrom(bar: number) {
    if (!comp) return;
    const { bars, source } = expandRepeats(comp);
    startAudition(bars.filter((_, i) => source[i] >= bar));
  }

  function perform() {
    if (!comp) return;
    // The click is what unlocks the browser's audio gate — the performance
    // itself then sounds bar by bar from App.svelte, whatever tab is open.
    ensureAudio();
    if (listening) toggleListen();
    game.startPerformance(comp.id);
  }

  // ---------- Touch entry ----------

  /**
   * A staff row is 6 units tall, about 5 px on a phone, which a fingertip cannot
   * pick out. A tap from a finger therefore does not write: it sets a pitch
   * cursor on that row, the steppers move it a row at a time, and Place writes
   * the note. A mouse click still writes at once. Which one it was comes from the
   * pointerdown that precedes the click (`lastPointer`); the entry row is drawn
   * on a coarse pointer from the start and, on any other, from the first touch.
   */
  let lastPointer = 'mouse';
  let touchSeen = $state(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  let cursor = $state<{ bar: number; pitch: number } | null>(null);
  // The touch cursor is on the overlay stack (lib/overlays.ts) while it is
  // placed: Escape and the Android back button drop it.
  const cursorLayer = hostLayer(LAYER.page);
  const cursorPlaced = $derived(cursor !== null);
  $effect(() => {
    if (cursorPlaced) return pushOverlay(cursorLayer, () => (cursor = null));
  });

  function notePointer(ev: PointerEvent) {
    lastPointer = ev.pointerType;
    if (ev.pointerType === 'touch') touchSeen = true;
  }

  /** Move the cursor one row up (+1) or down (-1); the rows run highest first. */
  function stepCursor(dir: 1 | -1) {
    if (!cursor) return;
    const next = rows[rows.indexOf(cursor.pitch) - dir];
    if (next !== undefined) cursor = { ...cursor, pitch: next };
  }

  function placeCursor() {
    if (!comp || !cursor) return;
    lastRefusal = addEvent(gs, comp, cursor.bar, durId, resting ? null : cursor.pitch + accidental);
  }

  function place(barIndex: number, pitch: number) {
    if (!comp) return;
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (lastPointer === 'touch') {
      cursor = { bar: barIndex, pitch };
      lastRefusal = null;
      return;
    }
    lastRefusal = addEvent(gs, comp, barIndex, durId, resting ? null : pitch + accidental);
  }

  /** What a tap or click on a written note does: the Tap note button's choice, and Shift always ties. */
  type NoteTool = 'remove' | 'split' | 'tie';
  let tool = $state<NoteTool>('remove');
  const TOOL_NAMES: Record<NoteTool, string> = { remove: 'Remove', split: 'Split', tie: 'Tie' };
  const TOOL_GLYPHS: Record<NoteTool, string> = { remove: '✕', split: '✂', tie: '⁀' };

  function nextTool() {
    const order: NoteTool[] = tiesUnlocked(level) ? ['remove', 'split', 'tie'] : ['remove', 'split'];
    tool = order[(order.indexOf(tool) + 1) % order.length];
  }

  function erase(barIndex: number, eventIndex: number, shift = false) {
    if (!comp) return;
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const use: NoteTool = shift ? 'tie' : tool;
    if (use === 'tie') {
      lastRefusal = toggleTie(gs, comp, barIndex, eventIndex);
      return;
    }
    if (use === 'split') {
      lastRefusal = splitEvent(gs, comp, barIndex, eventIndex);
      return;
    }
    removeEvent(comp, barIndex, eventIndex);
    lastRefusal = null;
  }

  function split(barIndex: number, eventIndex: number) {
    if (!comp) return;
    lastRefusal = splitEvent(gs, comp, barIndex, eventIndex);
  }

  // ---------- Repeat marks ----------

  /** First bar of a span being laid; the next ↻ closes it. */
  let repeatAnchor = $state<number | null>(null);

  function repeatClick(bar: number) {
    if (!comp) return;
    const existing = repeatAt(comp, bar);
    if (existing) {
      removeRepeat(comp, existing.index);
      repeatAnchor = null;
      lastRefusal = null;
      return;
    }
    if (repeatAnchor === null) {
      repeatAnchor = bar;
      lastRefusal = null;
      return;
    }
    const from = Math.min(repeatAnchor, bar);
    const to = Math.max(repeatAnchor, bar);
    repeatAnchor = null;
    lastRefusal = addRepeat(gs, comp, from, to);
  }

  // ---------- Dragging (place, move, re-pitch, merge) ----------

  // Pointer choreography, not game state — plain variables and one $state
  // for what actually renders. `pending` is a press that MIGHT become a drag
  // (4 px of travel decides); `suppressClick` eats the click that the browser
  // fires after a drag's pointerup so a move never doubles as a delete.
  let pendingDrag: {
    kind: 'new' | 'move';
    bar: number;
    index: number;
    startX: number;
    startY: number;
  } | null = null;
  let suppressClick = false;

  const drag = $state({ active: false, kind: 'new' as 'new' | 'move', bar: -1, index: -1, rest: false });
  const hint = $state({
    bar: -1,
    index: 0,
    unitX: 0,
    pitch: null as number | null,
    mergeWith: -1,
    y: 0,
  });

  let staffEls: SVGSVGElement[] = [];

  function beginPress(ev: PointerEvent, kind: 'new' | 'move', bar = -1, index = -1) {
    if (ev.button !== 0) return;
    pendingDrag = { kind, bar, index, startX: ev.clientX, startY: ev.clientY };
  }

  /** Where in `bar` a drop at local x lands: insertion index + its unit position. */
  function insertionAt(bar: NoteEvent[], localX: number): { index: number; unitX: number } {
    let at = 0;
    for (let i = 0; i < bar.length; i++) {
      const units = NOTE_DURATIONS[bar[i].dur].units;
      const mid = PAD + (at + units / 2) * UNIT_W;
      if (localX < mid) return { index: i, unitX: at };
      at += units;
    }
    return { index: bar.length, unitX: at };
  }

  /** The event whose horizontal span contains local x, if any. */
  function eventAt(bar: NoteEvent[], localX: number): number {
    let at = 0;
    for (let i = 0; i < bar.length; i++) {
      const units = NOTE_DURATIONS[bar[i].dur].units;
      const x0 = PAD + at * UNIT_W;
      if (localX >= x0 && localX < x0 + units * UNIT_W) return i;
      at += units;
    }
    return -1;
  }

  function onPointerMove(ev: PointerEvent) {
    if (!pendingDrag || !comp) return;
    if (!drag.active) {
      if (Math.hypot(ev.clientX - pendingDrag.startX, ev.clientY - pendingDrag.startY) < 4) return;
      drag.active = true;
      drag.kind = pendingDrag.kind;
      drag.bar = pendingDrag.bar;
      drag.index = pendingDrag.index;
      drag.rest =
        pendingDrag.kind === 'new'
          ? resting
          : comp.bars[pendingDrag.bar]?.[pendingDrag.index]?.pitch === null;
    }
    hint.bar = -1;
    hint.mergeWith = -1;
    for (let bi = 0; bi < comp.bars.length; bi++) {
      const el = staffEls[bi];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) continue;
      // The staff is drawn smaller than its own units when the column is narrow.
      const localX = ((ev.clientX - r.left) * W) / r.width;
      const localY = ((ev.clientY - r.top) * H) / r.height;
      hint.bar = bi;
      const spot = insertionAt(comp.bars[bi], localX);
      hint.index = spot.index;
      hint.unitX = spot.unitX;
      // Nearest ruled row, for notes; rests fall to the middle line.
      if (drag.rest) {
        hint.pitch = null;
        hint.y = Y0 - 6 * HALF;
      } else {
        let best: number | null = null;
        for (const p of rows) {
          if (best === null || Math.abs(yOf(p) - localY) < Math.abs(yOf(best) - localY)) best = p;
        }
        hint.pitch = best;
        hint.y = best !== null ? yOf(best) : localY;
      }
      // A move hovering squarely over its written neighbour offers a merge.
      if (drag.kind === 'move' && bi === drag.bar) {
        const over = eventAt(comp.bars[bi], localX);
        if (over !== -1 && Math.abs(over - drag.index) === 1) hint.mergeWith = over;
      }
      break;
    }
  }

  /** A touch the browser took for a scroll: the press is not a drag, and none is left half-made. */
  function onPointerCancel() {
    pendingDrag = null;
    drag.active = false;
  }

  function onPointerUp() {
    if (!pendingDrag) return;
    const wasDrag = drag.active;
    pendingDrag = null;
    if (!wasDrag || !comp) return;
    drag.active = false;
    suppressClick = true;
    if (hint.bar === -1) return; // dropped off the sheet — a shrug, not an action
    if (drag.kind === 'move' && hint.mergeWith !== -1) {
      lastRefusal = mergeEvents(gs, comp, drag.bar, drag.index, hint.mergeWith);
      return;
    }
    if (drag.kind === 'new') {
      const pitch = resting || hint.pitch === null ? null : hint.pitch + accidental;
      lastRefusal = addEvent(gs, comp, hint.bar, durId, pitch, hint.index);
      return;
    }
    // Insertion index was measured with the dragged note still in place.
    const to =
      hint.bar === drag.bar && hint.index > drag.index ? hint.index - 1 : hint.index;
    lastRefusal = moveEvent(
      gs,
      comp,
      { bar: drag.bar, index: drag.index },
      { bar: hint.bar, index: to },
      hint.pitch,
    );
  }

  // ---------- Engraving ----------

  // Staff geometry: y is derived from the DIATONIC letter position (staff
  // steps), the way real engraving works — a sharp is the same head with a ♯
  // in front, not a different height. Step 0 = middle C's ledger line.
  const HALF = 6; // half a staff space — one diatonic step
  const UNIT_W = 1.4; // px per grid unit (a 240-unit common bar ≈ 336 px, as before)
  const PAD = 26;
  const H = 176;
  const Y0 = 140; // y of the staff's lowest row (staff step 0)
  /** Bar width follows the meter — a waltz bar is drawn shorter, honestly. */
  const W = $derived(PAD + capacity * UNIT_W + 12);
  /** Beat guides at every beat, with the meter's declared accents marked. */
  const beatGuides = $derived(
    Array.from({ length: meter.beats - 1 }, (_, i) => (i + 1) * meter.beatUnits),
  );

  const STEP_OF_PC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
  const IS_SHARP = [false, true, false, true, false, false, true, false, true, false, true, false];

  function staffStep(pitch: number): number {
    const oct = Math.floor(pitch / 12);
    const pc = ((pitch % 12) + 12) % 12;
    return oct * 7 + STEP_OF_PC[pc];
  }
  const yOf = (pitch: number) => Y0 - staffStep(pitch) * HALF;

  /**
   * How a pitch is WRITTEN on this staff: which diatonic row it sits on and
   * what sign goes in front of it. In-key pitches sit bare on their row; a
   * chromatic one borrows a neighbouring row and takes a ♯ or ♭ — the same
   * bargain real notation makes, and the only way the staff can say things
   * its scale cannot (a tritone, say).
   */
  function engrave(pitch: number): { step: number; sign: string } {
    const rowSet = new Set(rows);
    if (rowSet.has(pitch)) return { step: staffStep(pitch), sign: '' };
    const below = rowSet.has(pitch - 1);
    const above = rowSet.has(pitch + 1);
    // Prefer the reading that borrows an in-key row; when both work (the
    // note sits between two rows a whole tone apart) sharps win, matching
    // the sharp names the tonic picker uses.
    if (below) return { step: staffStep(pitch - 1), sign: '♯' };
    if (above) return { step: staffStep(pitch + 1), sign: '♭' };
    return { step: staffStep(pitch), sign: IS_SHARP[((pitch % 12) + 12) % 12] ? '♯' : '' };
  }

  /** Staff-line positions a note needs drawn for it, outside the five lines. */
  function ledgersFor(step: number): number[] {
    const out: number[] = [];
    for (let s = 0; s >= step && s >= -2; s -= 2) if (step <= 1) out.push(s);
    for (let s = 12; s <= step && s <= 16; s += 2) if (step >= 11) out.push(s);
    return out;
  }

  /** Layout one bar: each event with its computed start unit. */
  function laidOut(bar: NoteEvent[]): { e: NoteEvent; at: number; i: number }[] {
    let at = 0;
    return bar.map((e, i) => {
      const out = { e, at, i };
      at += NOTE_DURATIONS[e.dur].units;
      return out;
    });
  }

  const noteX = (at: number) => PAD + at * UNIT_W + 6;

  /** Hit areas of a written event, in staff units: a fingertip needs about 44 px of them. */
  const noteHitW = $derived(touchSeen ? 46 : 20);
  const noteHitH = $derived(touchSeen ? 52 : 28);
  const restHitW = $derived(touchSeen ? 40 : 16);

  /** Rows the staff offers: the composition's scale over its tonic. Integer-
   *  filtered as a last line of defense — a NaN pitch would collide the lane
   *  keys and take the whole staff down (loads are already normalized). */
  const rows = $derived(
    comp ? allowedPitches(comp).filter(Number.isInteger).slice().reverse() : [],
  );

  function rowLabel(pitch: number): string {
    return `${TONIC_NAMES[((pitch % 12) + 12) % 12]}${pitch >= 12 ? '′' : ''}`;
  }

  function durTitle(id: NoteDurId): string {
    const def = NOTE_DURATIONS[id];
    if (def.unlockLevel > level) return `${def.name} — Musicianship ${def.unlockLevel}`;
    if (def.units > capacity) return `${def.name} — too long for a ${meter.name} bar`;
    const beats = def.units / 60;
    const len =
      beats >= 1
        ? `${Number.isInteger(beats) ? beats : beats.toFixed(1)} beat${beats === 1 ? '' : 's'}`
        : `${def.units}/60 of a beat`;
    return `${def.name} — ${len}`;
  }

  const pct = (v: number) => `${Math.round(v * 100)}%`;
</script>

<svelte:window
  onpointerdowncapture={notePointer}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerCancel}
/>

<div class="music">
  <header class="bar-row">
    <div>
      <h2>🎼 Music</h2>
      {#if skill}
        <Tip block>
          <span class="chip">{SKILLS[MUSICIANSHIP_ID].icon} Musicianship {level}</span>
          {#snippet tip()}<div class="tip-line">{SKILLS[MUSICIANSHIP_ID].desc}</div>{/snippet}
        </Tip>
      {:else}
        <Tip block>
          <span class="chip dim">Musicianship not learned yet</span>
          {#snippet tip()}<div class="tip-line">Perform a finished sheet to learn Musicianship.</div>{/snippet}
        </Tip>
      {/if}
      {#if reach}
        <span class="reach">next at Lv {reach.level}: {reach.what}</span>
      {/if}
    </div>
    <Tip block>
      <label class="voice">
        <select
          aria-label="Playback sound"
          value={voiceNow}
          onchange={(ev) => {
            voiceNow = (ev.target as HTMLSelectElement).value;
            ensureAudio();
            setVoice(voiceNow);
          }}
        >
          {#each Object.values(VOICES) as v (v.id)}
            <option value={v.id}>{v.icon} {v.name}</option>
          {/each}
        </select>
      </label>
      {#snippet tip()}
        <div class="tip-line">The playback sound. A listening preference only; playable instruments come later.</div>
      {/snippet}
    </Tip>
    <button
      class="mute"
      onclick={toggleMute}
      aria-label={mutedNow ? 'Unmute the music' : 'Mute the music'}
    >
      {mutedNow ? '🔇' : '🔊'}
    </button>
    <button onclick={newSheet}>＋ New sheet</button>
  </header>

  {#if performing && performingComp}
    <div class="performing">
      <span>🎵 Performing {performingComp.name}…</span>
      <progress value={performing.ticksTotal - performing.ticksLeft} max={performing.ticksTotal}
      ></progress>
      <button onclick={() => game.stopPerformance()}>Stop</button>
    </div>
  {/if}

  {#if gs.compositions.length === 0}
    <p class="empty">
      No sheets yet. A sheet holds four bars (the theme). Fill each bar exactly, whole and
      half notes to begin with. The piece's archetype is read from the notes you write: the
      key, contour, syncopation and so on. Extra bars, finer notes, scales and tuning unlock as Musicianship rises.
    </p>
  {:else}
    <div class="body">
      <aside class="list">
        {#each gs.compositions as c (c.id)}
          <button
            class="piece"
            class:selected={comp?.id === c.id}
            onclick={() => (selectedId = c.id)}
          >
            <span class="piece-name">{c.name}</span>
            <span class="piece-meta">{c.bars.length} bars</span>
          </button>
        {/each}
      </aside>

      {#if comp}
        <section class="editor">
          <div class="bar-row sheet-head">
            <input class="name" aria-label="Piece name" bind:value={comp.name} maxlength="40" />
            <!-- Each field's name is the card target (a tap on a label would only
                 focus its control), and the control carries its own aria-label. -->
            <div class="field">
              <Tip>
                Scale
                {#snippet tip()}
                  <div class="tip-line">
                    {scalesUnlocked(level)
                      ? 'Which notes the staff offers.'
                      : `Other scales need Musicianship ${MUSIC_UNLOCKS.scales}.`}
                    {MUSIC_SCALES[comp.scale]?.desc ?? ''}
                  </div>
                {/snippet}
              </Tip>
              <select
                aria-label="Scale"
                value={comp.scale}
                disabled={!scalesUnlocked(level)}
                onchange={(ev) => setScale(gs, comp, (ev.target as HTMLSelectElement).value)}
              >
                {#each Object.values(MUSIC_SCALES) as s (s.id)}
                  <option value={s.id} title={s.desc}>{s.name}</option>
                {/each}
              </select>
            </div>
            <div class="field">
              <Tip>
                Meter
                {#snippet tip()}
                  <div class="tip-line">
                    The time signature: how long a bar is and where its beats fall. It does not change the
                    tempo. {MUSIC_METERS[comp.meter]?.desc ?? ''}
                  </div>
                {/snippet}
              </Tip>
              <select
                aria-label="Meter"
                value={comp.meter}
                onchange={(ev) => {
                  const el = ev.target as HTMLSelectElement;
                  if (!setMeter(gs, comp, el.value)) el.value = comp.meter;
                }}
              >
                {#each Object.values(MUSIC_METERS) as m (m.id)}
                  <option value={m.id} disabled={m.unlockLevel > level} title={m.desc}>
                    {m.unlockLevel > level ? `🔒${m.unlockLevel} ` : ''}{m.name}
                  </option>
                {/each}
              </select>
            </div>
            <div class="field">
              <Tip>
                Tonic
                {#snippet tip()}
                  <div class="tip-line">
                    {tuningUnlocked(level)
                      ? 'Where the tonic sits.'
                      : `Tuning needs Musicianship ${MUSIC_UNLOCKS.tuning}.`}
                  </div>
                {/snippet}
              </Tip>
              <select
                aria-label="Tonic"
                value={comp.tonic}
                disabled={!tuningUnlocked(level)}
                onchange={(ev) => setTonic(gs, comp, Number((ev.target as HTMLSelectElement).value))}
              >
                {#each TONIC_NAMES as n, i (i)}
                  <option value={i}>{n}</option>
                {/each}
              </select>
            </div>
            <div class="field tempo">
              <Tip>
                ♩=
                {#snippet tip()}
                  <div class="tip-line">
                    {tempoUnlocked(level)
                      ? 'Beats per minute, as a score writes it: ♩ = this. Meter-independent, and the reading hears it.'
                      : `Tempo needs Musicianship ${MUSIC_UNLOCKS.tempo}.`}
                  </div>
                {/snippet}
              </Tip>
              <input
                aria-label="Tempo in beats per minute"
                type="number"
                min={MIN_BPM}
                max={MAX_BPM}
                step="1"
                disabled={!tempoUnlocked(level)}
                value={tempoOf(comp)}
                onchange={(ev) => {
                  const el = ev.target as HTMLInputElement;
                  lastRefusal = setTempo(gs, comp, Number(el.value));
                  el.value = String(tempoOf(comp));
                }}
              />
            </div>
            <div class="field tempo">
              <Tip>
                Pedal
                {#snippet tip()}
                  <div class="tip-line">
                    {pedalUnlocked(level)
                      ? 'A pedal tone: one pitch held under the whole piece. It pulls the key toward itself and is what the Harmony measure compares the melody against.'
                      : `A pedal tone needs Musicianship ${MUSIC_UNLOCKS.pedal}.`}
                  </div>
                {/snippet}
              </Tip>
              <select
                aria-label="Pedal tone"
                value={pedalOf(comp) === null ? '' : String(pedalOf(comp))}
                disabled={!pedalUnlocked(level)}
                onchange={(ev) => {
                  const raw = (ev.target as HTMLSelectElement).value;
                  lastRefusal = setPedal(gs, comp, raw === '' ? null : Number(raw));
                }}
              >
                <option value="">none</option>
                {#each rows as p (p)}
                  <option value={String(p)}>{rowLabel(p)}</option>
                {/each}
              </select>
            </div>
            <div class="bars-ctl">
              <Tip>
                Bars
                {#snippet tip()}
                  <div class="tip-line">
                    − drops the last bar; its notes go with it. ＋ adds a coda bar, up to {maxBars(level)} at
                    Musicianship {level}. A coda is read separately: it either reprises the theme (more
                    power) or shifts the archetype toward another one.
                  </div>
                {/snippet}
              </Tip>
              <button
                aria-label="Drop the last bar"
                disabled={comp.bars.length <= BASE_BARS}
                onclick={() => setBarCount(gs, comp, comp.bars.length - 1)}>−</button>
              <b>{comp.bars.length}</b>
              <button
                aria-label="Add a coda bar"
                disabled={comp.bars.length >= maxBars(level)}
                onclick={() => setBarCount(gs, comp, comp.bars.length + 1)}>＋</button>
            </div>
            <button
              class="danger"
              aria-label="Delete this sheet"
              onclick={() => {
                game.deleteComposition(comp.id);
                selectedId = gs.compositions[0]?.id ?? null;
              }}>🗑</button>
          </div>

          <div class="palette">
            {#each DUR_ORDER as id (id)}
              {@const def = NOTE_DURATIONS[id]}
              {@const locked = def.unlockLevel > level}
              {@const oversized = !locked && def.units > capacity}
              <Tip block>
                <button
                  class="dur"
                  class:selected={durId === id && !locked}
                  disabled={locked || oversized}
                  onclick={() => (durId = id)}
                  onpointerdown={(ev) => {
                    durId = id;
                    beginPress(ev, 'new');
                  }}
                >
                  <svg viewBox="0 0 20 34" width="20" height="34" aria-hidden="true">
                    {#if def.stem}<line x1="14.5" y1="4" x2="14.5" y2="24" />{/if}
                    {#each Array.from({ length: def.flags }) as _, f (f)}
                      <path d={`M14.5 ${4 + f * 5} q6 3 4 9`} class="flag" />
                    {/each}
                    <ellipse
                      cx="10"
                      cy="26"
                      rx="5.2"
                      ry="3.8"
                      class:open={def.head === 'open'}
                      transform="rotate(-20 10 26)"
                    />
                    {#if def.dot}<circle cx="17.5" cy="24" r="1.6" class="dotmark" />{/if}
                    {#if def.tuplet}<text x="2" y="10">{def.tuplet}</text>{/if}
                  </svg>
                  <span>{locked ? `🔒${def.unlockLevel}` : def.name}</span>
                </button>
                {#snippet tip()}<div class="tip-line">{durTitle(id)}</div>{/snippet}
              </Tip>
            {/each}
            <Tip block>
              <button class="dur rest-toggle" class:selected={resting} onclick={() => (resting = !resting)}>
                <span class="rest-glyph">𝄽</span>
                <span>Rest</span>
              </button>
              {#snippet tip()}
                <div class="tip-line">Place silence instead of sound. Rests fill bars too.</div>
              {/snippet}
            </Tip>
            <Tip block>
              <button
                class="dur acc"
                class:selected={accidental !== 0}
                onclick={() => (accidental = accidental === 0 ? 1 : accidental === 1 ? -1 : 0)}
              >
                <span class="rest-glyph">{accidental === 1 ? '♯' : accidental === -1 ? '♭' : '♮'}</span>
                <span>{accidental === 1 ? 'Sharp' : accidental === -1 ? 'Flat' : 'In key'}</span>
              </button>
              {#snippet tip()}
                <div class="tip-line">
                  Accidental for the next note: sharpen it, flatten it, or leave it in key. This is how
                  you write pitches the scale does not name: a tritone, a blue note.
                </div>
              {/snippet}
            </Tip>
            <Tip block>
              <button class="dur tool" class:selected={tool !== 'remove'} onclick={nextTool}>
                <span class="rest-glyph">{TOOL_GLYPHS[tool]}</span>
                <span>Tap note: {TOOL_NAMES[tool]}</span>
              </button>
              {#snippet tip()}
                <div class="tip-line">
                  What a tap or click on a written note does: remove it, split it in half{tiesUnlocked(level)
                    ? ', or tie it into the next note of the same pitch'
                    : ''}. Right-click splits and Shift-click ties, whatever this says.
                </div>
              {/snippet}
            </Tip>
          </div>

          <!-- Touch entry (see "Touch entry" above). Drawn on a coarse pointer, with its
               height reserved whether or not a cursor is set. -->
          {#if touchSeen}
            <div class="pitch-entry">
              {#if cursor}
                <span class="pitch-at">Bar {cursor.bar + 1} · <b>{resting ? 'rest' : rowLabel(cursor.pitch)}</b></span>
                <button aria-label="Pitch down" disabled={resting} onclick={() => stepCursor(-1)}>▼</button>
                <button aria-label="Pitch up" disabled={resting} onclick={() => stepCursor(1)}>▲</button>
                <button class="perform" onclick={placeCursor}>Place {resting ? 'rest' : 'note'}</button>
                <button onclick={() => (cursor = null)}>Cancel</button>
              {:else}
                <span class="dim small">Tap a staff line to choose a pitch, then Place.</span>
              {/if}
            </div>
          {/if}

          {#if lastRefusal}
            <div class="refusal">⚠️ {lastRefusal}</div>
          {:else}
            <div class="howto">
              Staff: click or tap a line to place the selected duration. A tap sets a pitch cursor;
              ▲ ▼ move it and Place writes the note. Dragging a duration in from the palette also places it.
              Notes: a tap or click does what Tap note says. Drag a placed note to re-pitch it, reorder it
              or move it between bars; drop it on its neighbour to merge them.
              ▶ hears a bar, ▶▶ hears from that bar to the end; Listen plays the whole sheet with no
              stage and no XP.
              {#if repeatsUnlocked(level)}
                ↻ marks a repeat: use it on the first bar, then on the last. Each replay pays less power
                than the last.
              {:else}
                Repeat marks need Musicianship {MUSIC_UNLOCKS.repeats}.
              {/if}
              The piece's name is what the log announces.
            </div>
          {/if}

          <div class="sheet">
            {#each comp.bars as bar, bi (bi)}
              {@const used = barUnitsUsed(bar)}
              {@const rspan = repeatAt(comp, bi)}
              <!-- "measure", not "bar": app.css globally styles `.bar` as a
                   14px resource-bar husk (overflow hidden), which swallows
                   the staff whole. The musical term dodges the collision. -->
              <div class="measure" class:coda={bi >= BASE_BARS}>
                <div class="bar-label">
                  Bar {bi + 1}
                  {#if bi >= BASE_BARS}<span class="coda-tag">coda</span>{/if}
                  <span class="fill" class:full={used === capacity}>
                    {used === capacity ? '✓' : `${used}/${capacity}`}
                  </span>
                  <button
                    class="hear"
                    disabled={!!performing || bar.length === 0}
                    onclick={() => startAudition([bar])}
                    aria-label="Hear this bar alone">▶</button>
                  <button
                    class="hear"
                    disabled={!!performing}
                    onclick={() => listenFrom(bi)}
                    aria-label="Hear from this bar to the end">▶▶</button>
                  <button
                    class="hear rep"
                    class:on={!!rspan}
                    class:anchored={repeatAnchor === bi}
                    disabled={!repeatsUnlocked(level)}
                    onclick={() => repeatClick(bi)}
                    aria-label={!repeatsUnlocked(level)
                      ? `Repeat marks need Musicianship ${MUSIC_UNLOCKS.repeats}`
                      : rspan
                        ? 'Remove this repeat'
                        : repeatAnchor === null
                          ? 'Start a repeat here, then pick the bar it ends on'
                          : `Close the repeat from bar ${repeatAnchor + 1}`}>↻</button>
                  {#if rspan && rspan.span.from === bi}
                    <span class="times">
                      <button
                        class="hear"
                        disabled={rspan.span.times <= 2}
                        onclick={() => setRepeatTimes(comp, rspan.index, rspan.span.times - 1)}
                        aria-label="One fewer pass">−</button>
                      ×{rspan.span.times}
                      <button
                        class="hear"
                        onclick={() => setRepeatTimes(comp, rspan.index, rspan.span.times + 1)}
                        aria-label="One more pass">+</button>
                    </span>
                  {/if}
                  {#if bar.length > 0}
                    <button class="clear" onclick={() => bar.splice(0)} aria-label="Clear this bar">✕</button>
                  {/if}
                </div>
                <!-- Drawn at its own size where there is room and scaled down to the
                     column where there is not (`max-width`, `width: 100%`). -->
                <svg
                  viewBox="0 0 {W} {H}"
                  width={W}
                  height={H}
                  class="staff"
                  style="max-width: {W}px"
                  bind:this={staffEls[bi]}
                >
                  <!-- The five lines, and middle C's ledger line. -->
                  {#each [2, 4, 6, 8, 10] as step (step)}
                    <line class="staffline" x1="4" y1={Y0 - step * HALF} x2={W - 4} y2={Y0 - step * HALF} />
                  {/each}
                  <line class="barline" x1={W - 4} y1={Y0 - 10 * HALF} x2={W - 4} y2={Y0 - 2 * HALF} />

                  <!-- Repeat barlines, drawn where the span opens and closes. -->
                  {#if rspan}
                    {#if rspan.span.from === bi}
                      <line class="repeatline thick" x1="7" y1={Y0 - 10 * HALF} x2="7" y2={Y0 - 2 * HALF} />
                      <line class="repeatline" x1="12" y1={Y0 - 10 * HALF} x2="12" y2={Y0 - 2 * HALF} />
                      <circle class="repeatdot" cx="17" cy={Y0 - 7 * HALF} r="2" />
                      <circle class="repeatdot" cx="17" cy={Y0 - 5 * HALF} r="2" />
                    {/if}
                    {#if rspan.span.to === bi}
                      <circle class="repeatdot" cx={W - 17} cy={Y0 - 7 * HALF} r="2" />
                      <circle class="repeatdot" cx={W - 17} cy={Y0 - 5 * HALF} r="2" />
                      <line class="repeatline" x1={W - 12} y1={Y0 - 10 * HALF} x2={W - 12} y2={Y0 - 2 * HALF} />
                      <line class="repeatline thick" x1={W - 7} y1={Y0 - 10 * HALF} x2={W - 7} y2={Y0 - 2 * HALF} />
                      <text class="repeattimes" x={W - 22} y={Y0 - 10.8 * HALF}>×{rspan.span.times}</text>
                    {/if}
                  {/if}

                  <!-- Beat guides from the meter; its declared accents draw a shade firmer. -->
                  {#each beatGuides as u (u)}
                    <line
                      class="beat"
                      class:accent={meter.accents.includes(u)}
                      x1={PAD + u * UNIT_W}
                      y1={Y0 - 11 * HALF}
                      x2={PAD + u * UNIT_W}
                      y2={Y0 + HALF}
                    />
                  {/each}

                  <!-- The pedal, sounding under everything: one unbroken line. -->
                  {#if pedalOf(comp) !== null}
                    <line
                      class="pedalline"
                      x1={PAD - 6}
                      y1={yOf(pedalOf(comp)!)}
                      x2={W - 6}
                      y2={yOf(pedalOf(comp)!)}
                    />
                  {/if}

                  <!-- Click lanes: one per pitch the ruling offers. -->
                  {#each rows as pitch (pitch)}
                    <g class="lane">
                      <rect
                        x="0"
                        y={yOf(pitch) - HALF / 2}
                        width={W}
                        height={HALF}
                        role="button"
                        tabindex="-1"
                        aria-label={`Place a ${resting ? 'rest' : 'note'} on ${rowLabel(pitch)} in bar ${bi + 1}`}
                        onclick={() => place(bi, pitch)}
                        onkeydown={(ev) => { if (ev.key === 'Enter') place(bi, pitch); }}
                      />
                      <text class="lane-name" class:on={cursor?.bar === bi && cursor.pitch === pitch} x="4" y={yOf(pitch) + 3}>{rowLabel(pitch)}</text>
                    </g>
                  {/each}

                  <!-- What is written. -->
                  {#each laidOut(bar) as { e, at, i } (i)}
                    {@const def = NOTE_DURATIONS[e.dur]}
                    {@const x = noteX(at)}
                    {#if e.pitch === null}
                      <!-- Rests, engraved simply: block for whole/half, squiggle down from the middle for the rest. -->
                      <g
                        class="event rest"
                        class:mergetarget={drag.active && hint.bar === bi && hint.mergeWith === i}
                        role="button"
                        tabindex="-1"
                        aria-label={`${TOOL_NAMES[tool]} the rest at position ${i + 1} of bar ${bi + 1}`}
                        onclick={(ev) => { ev.stopPropagation(); erase(bi, i); }}
                        onkeydown={(ev) => { if (ev.key === 'Enter') erase(bi, i); }}
                        onpointerdown={(ev) => { ev.stopPropagation(); beginPress(ev, 'move', bi, i); }}
                        oncontextmenu={(ev) => { ev.preventDefault(); if (lastPointer !== 'touch') split(bi, i); }}
                      >
                        <rect class="hit" x={x + 1 - restHitW / 2} y={Y0 - 9 * HALF} width={restHitW} height={8 * HALF} />
                        {#if def.id === 'whole'}
                          <rect class="restblock" x={x - 5} y={Y0 - 8 * HALF} width="11" height="4" />
                        {:else if def.units >= 120}
                          <rect class="restblock" x={x - 5} y={Y0 - 6 * HALF - 4} width="11" height="4" />
                        {:else if def.flags === 0 && !def.tuplet}
                          <path class="restmark" d={`M${x - 2} ${Y0 - 8 * HALF} l5 6 l-5 5 q7 3 4 9`} />
                        {:else}
                          <path class="restmark" d={`M${x + 3} ${Y0 - 8 * HALF} l-5 ${3 * HALF}`} />
                          {#each Array.from({ length: Math.max(1, def.flags) }) as _, d (d)}
                            <circle class="restdot" cx={x + 1 - d * 2} cy={Y0 - 8 * HALF + 3 + d * 5} r="1.8" />
                          {/each}
                        {/if}
                        {#if def.dot}<circle class="restdot" cx={x + 9} cy={Y0 - 7 * HALF} r="1.6" />{/if}
                        {#if def.tuplet}<text class="triplet" x={x - 3} y={Y0 - 9 * HALF - 2}>{def.tuplet}</text>{/if}
                      </g>
                    {:else}
                      {@const written = engrave(e.pitch)}
                      {@const y = Y0 - written.step * HALF}
                      {@const up = written.step < 6}
                      <g
                        class="event note"
                        class:mergetarget={drag.active && hint.bar === bi && hint.mergeWith === i}
                        role="button"
                        tabindex="-1"
                        aria-label={`${TOOL_NAMES[tool]} the note at position ${i + 1} of bar ${bi + 1}`}
                        onclick={(ev) => { ev.stopPropagation(); erase(bi, i, ev.shiftKey); }}
                        onkeydown={(ev) => { if (ev.key === 'Enter') erase(bi, i); }}
                        onpointerdown={(ev) => { ev.stopPropagation(); beginPress(ev, 'move', bi, i); }}
                        oncontextmenu={(ev) => { ev.preventDefault(); if (lastPointer !== 'touch') split(bi, i); }}
                      >
                        <rect class="hit" x={x + 1 - noteHitW / 2} y={y - noteHitH / 2} width={noteHitW} height={noteHitH} />
                        {#if e.tie}
                          {@const endX = at + def.units < capacity ? noteX(at + def.units) : W - 8}
                          <path
                            class="tiearc"
                            d={`M${x + 5} ${y + 8} Q ${(x + endX) / 2} ${y + 17} ${endX - 3} ${y + 8}`}
                          />
                        {/if}
                        {#each ledgersFor(written.step) as ls (ls)}
                          <line class="ledgerline" x1={x - 9} y1={Y0 - ls * HALF} x2={x + 9} y2={Y0 - ls * HALF} />
                        {/each}
                        {#if written.sign}
                          <text class="accidental" x={x - 14} y={y + 4}>{written.sign}</text>
                        {/if}
                        {#if def.stem}
                          <line class="stem" x1={up ? x + 5 : x - 5} y1={y} x2={up ? x + 5 : x - 5} y2={up ? y - 26 : y + 26} />
                          {#each Array.from({ length: def.flags }) as _, f (f)}
                            <path
                              class="flag"
                              d={up
                                ? `M${x + 5} ${y - 26 + f * 6} q7 4 4 11`
                                : `M${x - 5} ${y + 26 - f * 6} q7 -4 4 -11`}
                            />
                          {/each}
                        {/if}
                        <ellipse class="head" class:open={def.head === 'open'} cx={x} cy={y} rx="5.4" ry="4" transform={`rotate(-20 ${x} ${y})`} />
                        {#if def.dot}<circle class="head dotaug" cx={x + 9} cy={y - 3} r="1.7" />{/if}
                        {#if def.tuplet}<text class="triplet" x={x - 3} y={up ? y - 30 : y - 10}>{def.tuplet}</text>{/if}
                      </g>
                    {/if}
                  {/each}

                  <!-- The writing head: where the next event lands. -->
                  {#if used < capacity}
                    <line class="cursor" x1={noteX(used) - 8} y1={Y0 - 11 * HALF} x2={noteX(used) - 8} y2={Y0 + HALF} />
                  {/if}

                  <!-- The touch cursor: the chosen row, and the note Place would write at the head. -->
                  {#if cursor && cursor.bar === bi}
                    <line class="cursorrow" x1="4" y1={yOf(cursor.pitch)} x2={W - 4} y2={yOf(cursor.pitch)} />
                    <ellipse
                      class="ghost"
                      cx={noteX(used)}
                      cy={resting ? Y0 - 6 * HALF : yOf(cursor.pitch)}
                      rx="5.4"
                      ry="4"
                    />
                  {/if}

                  <!-- The drag's shadow: where a drop would land, or whom it would merge into. -->
                  {#if drag.active && hint.bar === bi && hint.mergeWith === -1}
                    <line
                      class="caret"
                      x1={PAD + hint.unitX * UNIT_W}
                      y1={Y0 - 11 * HALF}
                      x2={PAD + hint.unitX * UNIT_W}
                      y2={Y0 + HALF}
                    />
                    <ellipse
                      class="ghost"
                      cx={PAD + hint.unitX * UNIT_W + 6}
                      cy={hint.y}
                      rx="5.4"
                      ry="4"
                    />
                  {/if}
                </svg>
              </div>
            {/each}
          </div>

          <section class="reading">
            <div class="bar-row">
              <h3>The reading</h3>
              <button disabled={!!performing} onclick={toggleListen}>
                {listening ? '⏹ Stop' : '🔉 Listen'}
              </button>
              <button class="perform" disabled={problems.length > 0 || !!performing} onclick={perform}>
                ▶ Perform ({performanceTicks(comp) / 10}s)
              </button>
            </div>

            {#if problems.length > 0}
              <ul class="problems">
                {#each problems as p}<li>⚠️ {p}</li>{/each}
              </ul>
            {/if}

            {#if reading}
              <div class="verdict">
                {reading.theme.archetype.icon}
                <b>{reading.theme.archetype.name}</b>
                <span class="purity">{pct(reading.theme.purity)} pure</span>
                {#if reading.coda}
                  <span class="coda-note">
                    {reading.coda.relation === 'reprise'
                      ? `· coda reprises the theme (×${(1 + 0.25 * reading.coda.bars).toFixed(2)})`
                      : `· coda shifts toward ${reading.coda.match.archetype.name.toLowerCase()}`}
                  </span>
                {/if}
              </div>
              <p class="arch-desc">{reading.theme.archetype.desc}</p>
              <dl class="measures">
                <dt>Key</dt>
                <dd>
                  {keyName(reading.themeAnalysis) ?? '—'}
                  {#if reading.themeAnalysis.key}
                    <span class="dim">({pct(reading.themeAnalysis.key.clarity)} clear)</span>
                  {/if}
                </dd>
                <dt>Contour</dt>
                <dd>{reading.themeAnalysis.contour} · {reading.themeAnalysis.motion} motion</dd>
                <dt>Syncopation</dt>
                <dd>{pct(reading.themeAnalysis.syncopation)}</dd>
                <dt>Consonance</dt>
                <dd>{pct(reading.themeAnalysis.consonance)}</dd>
                <dt>Entropy</dt>
                <dd>
                  pitch {pct(reading.themeAnalysis.pitchEntropy)} · rhythm {pct(reading.themeAnalysis.rhythmEntropy)}
                </dd>
                <dt>Density</dt>
                <dd>
                  {reading.themeAnalysis.density.toFixed(1)} notes/bar ·
                  {pct(reading.themeAnalysis.restRatio)} rest
                </dd>
                <dt>
                  <Tip>
                    Motif
                    {#snippet tip()}
                      <div class="tip-line">Self-similarity: how much the melody restates its own figures.</div>
                    {/snippet}
                  </Tip>
                </dt>
                <dd>{pct(reading.themeAnalysis.motif)}</dd>
                <dt>
                  <Tip>
                    Harmony
                    {#snippet tip()}
                      <div class="tip-line">
                        Vertical consonance: how the melody sits against the pedal tone. Shown as — when
                        there is no pedal tone.
                      </div>
                    {/snippet}
                  </Tip>
                </dt>
                <dd>
                  {reading.themeAnalysis.pedal === null
                    ? '—'
                    : `${pct(reading.themeAnalysis.harmony)} over ${rowLabel(reading.themeAnalysis.pedal)}`}
                </dd>
                <dt>
                  <Tip>
                    Pace
                    {#snippet tip()}
                      <div class="tip-line">
                        The tempo as the reading measures it. The same notes can read as a dirge or as a
                        reel depending only on this.
                      </div>
                    {/snippet}
                  </Tip>
                </dt>
                <dd>♩={reading.themeAnalysis.bpm}</dd>
                <dt>
                  <Tip>
                    Cadence
                    {#snippet tip()}
                      <div class="tip-line">How the last notes resolve against the key.</div>
                    {/snippet}
                  </Tip>
                </dt>
                <dd>{reading.themeAnalysis.cadence} — {CADENCE_WORDS[reading.themeAnalysis.cadence]}</dd>
                <dt>
                  <Tip>
                    Power
                    {#snippet tip()}
                      <div class="tip-line">The magnitude music effects will use. Effects are not active yet.</div>
                    {/snippet}
                  </Tip>
                </dt>
                <dd>{reading.power}</dd>
              </dl>
              {#if reading.ranked.length > 1}
                <div class="alsoheard">
                  Also close:
                  {#each reading.ranked.slice(1, 3) as m (m.archetype.id)}
                    <span>{m.archetype.icon} {m.archetype.name} {pct(m.purity)}</span>
                  {/each}
                </div>
              {/if}
            {/if}
          </section>
        </section>
      {/if}
    </div>
  {/if}
</div>

<style>
  .music {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .bar-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  header h2 {
    display: inline;
    margin: 0 8px 0 0;
    font-size: 16px;
  }

  header > div {
    flex: 1 1 200px;
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }

  .chip {
    font-size: 12px;
    padding: 1px 8px;
    border-radius: 999px;
    border: 1px solid var(--border);
    color: var(--accent);
    white-space: nowrap;
  }

  header h2 {
    white-space: nowrap;
  }

  .chip.dim {
    color: var(--text-dim);
    font-style: italic;
  }

  .reach {
    font-size: 12px;
    color: var(--text-dim);
  }

  .performing {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border: 1px solid var(--accent);
    border-radius: 8px;
  }

  .performing progress {
    flex: 1;
    height: 10px;
  }

  .empty {
    color: var(--text-dim);
    max-width: 60ch;
  }

  .body {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    min-width: 0;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 170px;
    flex-shrink: 0;
  }

  .piece {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    text-align: left;
    padding: 5px 8px;
  }

  .piece.selected {
    border-color: var(--accent);
  }

  .piece-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .piece-meta {
    color: var(--text-dim);
    font-size: 11px;
    flex-shrink: 0;
  }

  .editor {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sheet-head .name {
    flex: 1;
    min-width: 140px;
    font-weight: 600;
  }

  .sheet-head .field {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--text-dim);
  }

  .bars-ctl {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--text-dim);
  }

  .tempo {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 12px;
    color: var(--text-dim);
  }

  .tempo input {
    width: 52px;
  }

  .bars-ctl b {
    color: var(--text);
  }

  button.danger {
    border-color: color-mix(in srgb, var(--danger) 50%, var(--edge));
  }

  .palette {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .dur {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 4px 8px;
    font-size: 11px;
  }

  .dur.selected {
    border-color: var(--accent);
    color: var(--accent);
  }

  .dur svg line,
  .dur svg path {
    stroke: currentColor;
    stroke-width: 1.6;
    fill: none;
  }

  .dur svg ellipse {
    fill: currentColor;
  }

  .dur svg ellipse.open {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
  }

  .dur svg text {
    fill: currentColor;
    font-size: 8px;
  }

  .rest-glyph {
    font-size: 22px;
    line-height: 34px;
    height: 34px;
  }

  .refusal {
    color: var(--danger);
    font-size: 12px;
  }

  .howto {
    color: var(--text-dim);
    font-size: 12px;
  }

  .sheet {
    /* Reads like a real score: measures flow left to right and wrap into
       systems, however wide the window is. */
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    overflow-x: auto;
    /* Dragging notes must never start a text selection. */
    user-select: none;
  }

  /* A measure is as wide as its staff, and no wider than the column: the staff scales down. */
  .measure {
    min-width: 0;
    max-width: 100%;
  }

  /* The touch entry row: its height is reserved with or without a cursor. */
  .pitch-entry {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-height: 56px;
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .pitch-at {
    margin-right: auto;
  }

  .bar-label {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 12px;
    color: var(--text-dim);
  }

  .coda-tag {
    font-size: 10px;
    padding: 0 6px;
    border-radius: 999px;
    border: 1px solid var(--border);
  }

  .measure.coda .coda-tag {
    color: var(--accent);
    border-color: var(--accent);
  }

  .fill {
    font-variant-numeric: tabular-nums;
  }

  .fill.full {
    color: var(--accent);
  }

  .clear {
    font-size: 10px;
    padding: 0 6px;
  }

  .hear {
    font-size: 9px;
    padding: 0 5px;
    letter-spacing: -1px;
  }

  .hear.rep.on {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* Half-laid: this bar opened a span and is waiting for its closing click. */
  .hear.rep.anchored {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 25%, var(--bg-raised));
  }

  .times {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    color: var(--accent);
  }

  .repeatline {
    stroke: var(--accent);
    stroke-width: 1.2;
  }

  .repeatline.thick {
    stroke-width: 3;
  }

  .repeatdot {
    fill: var(--accent);
  }

  .repeattimes {
    fill: var(--accent);
    font-size: 9px;
    text-anchor: end;
  }

  .tiearc {
    stroke: var(--text);
    stroke-width: 1.4;
    fill: none;
    opacity: 0.85;
  }

  .staff {
    display: block;
    width: 100%;
    height: auto;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 6px;
    /* The staff scrolls the page under a finger. Only a written note takes the
       gesture (below), so a drag that starts on one moves it. */
    touch-action: pan-x pan-y;
  }

  .event {
    touch-action: none;
  }

  .staffline {
    stroke: var(--text-dim);
    stroke-width: 1;
    opacity: 0.55;
  }

  /* Ledger lines: the staff, extended a little for one note's sake. */
  .ledgerline {
    stroke: var(--text-dim);
    stroke-width: 1;
    opacity: 0.55;
  }

  .barline {
    stroke: var(--text-dim);
    stroke-width: 2;
  }

  .beat {
    stroke: var(--text-dim);
    stroke-width: 1;
    opacity: 0.12;
  }

  /* The meter's declared strong pulses — 6/8's second swing, 5/4's beat four. */
  .beat.accent {
    opacity: 0.3;
    stroke-width: 1.5;
  }

  .dur svg .dotmark {
    fill: currentColor;
  }

  .dotaug {
    fill: var(--text);
  }

  .lane rect {
    fill: transparent;
    cursor: pointer;
    /* Click-focus on the lanes/notes (they carry tabindex for the screen-
       reader path) draws the browser's focus ring across the whole staff —
       pure noise for a mouse. They are not tab-reachable, so no outline. */
    outline: none;
  }

  .event {
    outline: none;
  }

  .lane:hover rect {
    fill: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .lane-name {
    fill: var(--text-dim);
    font-size: 8px;
    opacity: 0;
    pointer-events: none;
  }

  .lane:hover .lane-name,
  .lane-name.on {
    opacity: 1;
  }

  /* The touch cursor's row. */
  .cursorrow {
    stroke: var(--accent);
    stroke-width: 1.2;
    opacity: 0.6;
    pointer-events: none;
  }

  .event {
    cursor: pointer;
  }

  .event .hit {
    fill: transparent;
  }

  .event:hover .head,
  .event:hover .stem,
  .event:hover .flag,
  .event:hover .restblock,
  .event:hover .restmark,
  .event:hover .restdot {
    stroke: var(--danger);
    fill: var(--danger);
  }

  .event:hover .head.open {
    fill: none;
  }

  .head {
    fill: var(--text);
  }

  .head.open {
    fill: none;
    stroke: var(--text);
    stroke-width: 1.7;
  }

  .stem {
    stroke: var(--text);
    stroke-width: 1.6;
  }

  .flag {
    stroke: var(--text);
    stroke-width: 1.6;
    fill: none;
  }

  .accidental,
  .triplet {
    fill: var(--text);
    font-size: 11px;
  }

  .triplet {
    font-size: 9px;
    fill: var(--text-dim);
  }

  .restblock {
    fill: var(--text);
  }

  .restmark {
    stroke: var(--text);
    stroke-width: 1.8;
    fill: none;
  }

  .restdot {
    fill: var(--text);
  }

  /* The pedal reads as what it is: one tone, held, under everything. */
  .pedalline {
    stroke: var(--spirit);
    stroke-width: 2;
    opacity: 0.5;
    pointer-events: none;
  }

  .cursor {
    stroke: var(--accent);
    stroke-width: 1;
    stroke-dasharray: 2 3;
    opacity: 0.7;
  }

  .caret {
    stroke: var(--accent);
    stroke-width: 2;
    opacity: 0.9;
  }

  .ghost {
    fill: var(--accent);
    opacity: 0.45;
    pointer-events: none;
  }

  /* The neighbour a dragged note would melt into. */
  .event.mergetarget .head,
  .event.mergetarget .restblock,
  .event.mergetarget .restmark {
    stroke: var(--accent);
    fill: var(--accent);
  }

  .event.mergetarget .head.open {
    fill: none;
  }

  .reading {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .reading h3 {
    margin: 0;
    font-size: 13px;
    flex: 1;
  }

  .perform {
    border-color: var(--accent);
    color: var(--accent);
  }

  .perform:disabled {
    border-color: var(--text-off);
    color: var(--text-off);
  }

  .problems {
    margin: 0;
    padding-left: 4px;
    list-style: none;
    color: var(--warn);
    font-size: 12px;
  }

  .verdict {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 15px;
  }

  .purity {
    color: var(--accent);
    font-size: 12px;
  }

  .coda-note {
    color: var(--text-dim);
    font-size: 12px;
  }

  .arch-desc {
    margin: 0;
    color: var(--text-dim);
    font-size: 12px;
    font-style: italic;
  }

  .measures {
    display: grid;
    grid-template-columns: auto 1fr auto 1fr;
    gap: 2px 10px;
    margin: 0;
    font-size: 12px;
  }

  .measures dt {
    color: var(--text-dim);
  }

  .measures dd {
    margin: 0;
  }

  .dim {
    color: var(--text-dim);
  }

  .alsoheard {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 12px;
    font-size: 12px;
    color: var(--text-dim);
  }

  /* Narrow: the piece list is a row of chips above the editor instead of a column beside it. */
  @container tab (max-width: 640px) {
    .body {
      flex-direction: column;
      align-items: stretch;
    }

    .list {
      width: auto;
      flex-direction: row;
      flex-wrap: wrap;
    }

    .piece {
      flex: 1 1 140px;
    }

    .measures {
      grid-template-columns: auto 1fr;
    }

    /* Fifteen buttons in three even rows, not five ragged ones. */
    .palette {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(62px, 1fr));
    }

    .palette > :global(.tip-target) {
      display: flex;
    }

    .dur {
      width: 100%;
      justify-content: flex-start;
      text-align: center;
    }
  }

  /* A finger: the small bar buttons, the name and the tempo are 44px in both directions. */
  @media (pointer: coarse) {
    .hear,
    .clear,
    .dur,
    .field select,
    .bars-ctl button,
    .pitch-entry button,
    button.danger {
      min-width: 44px;
    }

    .bar-label {
      align-items: center;
    }

    .sheet-head .name,
    .tempo input {
      min-height: 44px;
    }

    /* The card targets among the plain text: field names, "Bars" and the reading's labels. */
    .field :global(.tip-target),
    .bars-ctl :global(.tip-target),
    .measures dt :global(.tip-target) {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      min-height: 44px;
      border-bottom: none;
      text-decoration: underline dotted color-mix(in srgb, var(--text-dim) 60%, transparent);
      text-underline-offset: 3px;
    }

    .measures dt :global(.tip-target) {
      justify-content: flex-start;
    }
  }
</style>
