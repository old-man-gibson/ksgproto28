<script lang="ts">
  import { ARCANE_WORDS } from '../../core/data/spellcraft.data';
  import type { WuxinConfig } from '../../core/types';
  import {
    HINDERS,
    NOURISHES,
    SEVERED,
    alignment,
    classify,
    discord,
    eligibleElements,
    formatWuxin,
    harmonyDistance,
    landmarks,
    shapeOf,
    validateWuxin,
    type WuxinKind,
    type WuxinProblem,
  } from '../../core/systems/wuxin';

  /**
   * The wuxin cycle, to look at.
   *
   * A SANDBOX, on purpose. Nothing here reads or writes the save: there is no
   * player cycle yet, and there should not be one until the shape has been
   * argued with. Rewire it, break it, watch what it calls itself. When a real
   * cycle lands on GameState this panel becomes its editor with the local
   * `cfg` swapped for the state field and nothing else changing.
   *
   * The geometry follows MartialPlanner's ring idiom deliberately — five seats,
   * generation bowing around the outside, destruction crossing the middle as
   * the pentagram it actually is. `wuxin.ts` itself stays structure-only: every
   * number below is a SANDBOX value with no source behind it yet.
   *
   * The saturation readout is a real design answer, not decoration. Habituation
   * and a full node are otherwise completely silent — a player fights the same
   * thing for an hour, cultivation slows to a crawl, and nothing says why. The
   * fill ring and the pulse make the state legible without ever naming the
   * mechanism, and they live here because this is the surface a player already
   * opens to configure. See Wuxia_Xianxia.md, "Known weaknesses".
   */

  // ---------- The cycle being looked at ----------

  const CLASSICAL: WuxinConfig = {
    slots: [
      { element: 'seed', nourishes: 'fire', hinders: 'stone' },
      { element: 'fire', nourishes: 'stone', hinders: 'iron' },
      { element: 'stone', nourishes: 'iron', hinders: 'water' },
      { element: 'iron', nourishes: 'water', hinders: 'seed' },
      { element: 'water', nourishes: 'seed', hinders: 'fire' },
    ],
  };

  const clone = (c: WuxinConfig): WuxinConfig => ({ slots: c.slots.map((s) => ({ ...s })) });

  let cfg = $state<WuxinConfig>(clone(CLASSICAL));

  const elements = $derived(cfg.slots.map((s) => s.element));
  const problems = $derived(validateWuxin(cfg));
  const kind = $derived(classify(cfg));
  const off = $derived(discord(cfg));
  const gen = $derived(shapeOf(cfg, 'nourishes'));
  const des = $derived(shapeOf(cfg, 'hinders'));
  const k = $derived(alignment(cfg));
  const far = $derived(harmonyDistance(cfg));
  const marks = $derived(landmarks(cfg));

  // ---------- Saturation (sandbox values) ----------

  /**
   * Charge against capacity, and habituation, per element. Nothing feeds these
   * yet — they are here so the READOUT can be judged before the numbers behind
   * it exist. When charge lands on GameState these two arrays are what gets
   * replaced, and nothing else in this file has to change.
   */
  let charge = $state<number[]>([0.2, 0.55, 0.86, 0.35, 0.05]);
  let habit = $state<number[]>([0.1, 0.4, 0.72, 0.15, 0.0]);

  /**
   * Relaxed = out of combat, dispersing harmlessly. It is the difference
   * between a full node being a WARNING and a full node being fine, which is
   * why the pulse keys on pressure rather than on fullness alone: a resting
   * cycle should sit there quietly, not nag.
   */
  let relaxed = $state(false);

  /** Near enough to full that fighting for more is close to wasted. */
  const FULL = 0.8;
  const isFull = (i: number) => charge[i] >= FULL;
  const isJaded = (i: number) => habit[i] >= FULL;
  /** Full AND under pressure — the only state worth animating at somebody. */
  const isStrained = (i: number) => isFull(i) && !relaxed;

  const pct = (v: number) => `${Math.round(v * 100)}%`;

  /** What this element is currently costing you, in plain terms. */
  function readout(i: number): string[] {
    const out: string[] = [];
    const slot = cfg.slots[i];
    if (isFull(i) && relaxed) {
      // Resting levels are topological: something draining it keeps it a little
      // short of full, and a sustain circle seals at the top with no sink.
      const drainer = cfg.slots.find((s) => s.hinders === slot.element);
      out.push(
        drainer
          ? `At rest, venting through ${name(drainer.element)}. It settles a little short of full and stays there.`
          : `At rest and sealed: nothing vents it, so it stays full. Only something outside the cycle drawing on it can spend it.`,
      );
    } else if (isFull(i)) {
      out.push(
        slot.nourishes
          ? `Nearly full — most of what arrives passes on to ${name(slot.nourishes)} instead of staying.`
          : `Nearly full, and nothing to pass it to — the surplus leaks as qi deviation.`,
      );
    }
    if (isJaded(i)) {
      // What clears a backlog is an arrow pointing AT this element — what the
      // element itself hinders drains somebody else's ledger, not its own.
      const drainer = cfg.slots.find((s) => s.hinders === slot.element);
      out.push(
        drainer
          ? `You have taken a great deal of this lately; fighting it teaches little. ${name(drainer.element)} is hindering it, which is what clears the backlog.`
          : `You have taken a great deal of this lately; fighting it teaches little — and nothing hinders it, so nothing is clearing the backlog. Point a destructive arrow at it.`,
      );
    }
    if (!out.length) out.push('Room to take more in, and more to learn from it.');
    return out;
  }
  const name = (id: string) => word(id)?.word ?? id;
  const list = (ids: string[]) => ids.map(name).join(', ');

  const word = (id: string) => ARCANE_WORDS[id];

  // ---------- Presets: the shapes worth feeling ----------

  function preset(which: 'classical' | 'burst' | 'sustain' | 'split'): void {
    const next = clone(CLASSICAL);
    if (which === 'burst') {
      // One generative arrow cut: the ring opens into a line.
      next.slots[4].nourishes = null;
    } else if (which === 'sustain') {
      // Nothing in the cycle fights anything else in it.
      for (const s of next.slots) s.hinders = null;
    } else if (which === 'split') {
      // The only other closed shape: a feeding pair beside a triangle.
      next.slots[0].nourishes = 'fire';
      next.slots[1].nourishes = 'seed';
      next.slots[2].nourishes = 'iron';
      next.slots[3].nourishes = 'water';
      next.slots[4].nourishes = 'stone';
    }
    cfg = next;
  }

  /** Swap an element out for another noun, following its arrows across. */
  function setElement(index: number, to: string): void {
    const from = cfg.slots[index].element;
    if (from === to) return;
    const next = clone(cfg);
    // If the incoming element is already seated, the two trade places rather
    // than one of them silently vanishing.
    const other = next.slots.findIndex((s) => s.element === to);
    if (other >= 0) next.slots[other].element = from;
    next.slots[index].element = to;
    for (const s of next.slots) {
      if (other >= 0) {
        if (s.nourishes === from) s.nourishes = to;
        else if (s.nourishes === to) s.nourishes = from;
        if (s.hinders === from) s.hinders = to;
        else if (s.hinders === to) s.hinders = from;
      } else {
        if (s.nourishes === from) s.nourishes = to;
        if (s.hinders === from) s.hinders = to;
      }
    }
    cfg = next;
  }

  function setArrow(index: number, relation: 'nourishes' | 'hinders', to: string): void {
    const next = clone(cfg);
    next.slots[index][relation] = to === SEVERED ? null : to;
    cfg = next;
  }

  // ---------- Geometry ----------

  const VIEW = 420;
  const CX = 210;
  const CY = 196;
  const RING = 126;
  const NODE_R = 30;
  const HEAD_GAP = 8;
  /** Circumferences the charge and habituation arcs are drawn against. */
  const RIM = 2 * Math.PI * NODE_R;
  const INNER_RIM = 2 * Math.PI * (NODE_R - 5);
  /** How far a generative arc bows outward, so it reads as the outer circle. */
  const GEN_BOW = 30;

  interface Seat {
    x: number;
    y: number;
  }

  const SEATS: Seat[] = $derived(
    cfg.slots.map((_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / cfg.slots.length;
      return { x: CX + RING * Math.cos(a), y: CY + RING * Math.sin(a) };
    }),
  );

  const seatOf = (element: string): Seat | undefined => {
    const i = elements.indexOf(element);
    return i >= 0 ? SEATS[i] : undefined;
  };

  function toward(p: Seat, q: Seat, dist: number): Seat {
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * dist, y: p.y + (dy / len) * dist };
  }

  /** Generation bows OUTWARD from the centre — the pentagon's own circle. */
  function genPath(a: Seat, b: Seat): string {
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const out = toward({ x: CX, y: CY }, mid, Math.hypot(mid.x - CX, mid.y - CY) + GEN_BOW);
    const s = toward(a, out, NODE_R);
    const e = toward(b, out, NODE_R + HEAD_GAP);
    return `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} Q ${out.x.toFixed(1)} ${out.y.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
  }

  /** Destruction runs straight across — the pentagram inside the pentagon. */
  function desPath(a: Seat, b: Seat): string {
    const s = toward(a, b, NODE_R);
    const e = toward(b, a, NODE_R + HEAD_GAP);
    return `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} L ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
  }

  interface Drawn {
    key: string;
    d: string;
    from: number;
  }

  const genEdges: Drawn[] = $derived(
    cfg.slots.flatMap((slot, i) => {
      const a = SEATS[i];
      const b = slot.nourishes ? seatOf(slot.nourishes) : undefined;
      return a && b ? [{ key: `g${i}`, d: genPath(a, b), from: i }] : [];
    }),
  );

  const desEdges: Drawn[] = $derived(
    cfg.slots.flatMap((slot, i) => {
      const a = SEATS[i];
      const b = slot.hinders ? seatOf(slot.hinders) : undefined;
      return a && b ? [{ key: `d${i}`, d: desPath(a, b), from: i }] : [];
    }),
  );

  // ---------- Drawing arrows by hand ----------

  /**
   * Drag a node onto another to make it nourish it; hold shift to make it
   * hinder it instead. The modifier is read live, so it can be pressed or
   * released mid-drag and the rubber band changes colour under the cursor.
   *
   * Dropping on empty space — or back on the element you started from — severs
   * that arrow, which makes every legal configuration reachable with the mouse
   * alone. The dropdowns remain the keyboard path and stay authoritative; this
   * is an enhancement over them, not a replacement, since a graph you can only
   * edit by dragging is a graph some people cannot edit at all.
   */
  let svgEl = $state<SVGSVGElement | null>(null);
  let drag = $state<{ from: number; x: number; y: number; hinders: boolean } | null>(null);

  function toSvg(e: PointerEvent): { x: number; y: number } {
    const ctm = svgEl?.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  /** Which seat the cursor is over, or null for open ground. */
  function seatUnder(at: { x: number; y: number }): number | null {
    for (let i = 0; i < SEATS.length; i++) {
      if (Math.hypot(SEATS[i].x - at.x, SEATS[i].y - at.y) <= NODE_R) return i;
    }
    return null;
  }

  function startDrag(e: PointerEvent, from: number): void {
    e.preventDefault();
    const at = toSvg(e);
    drag = { from, x: at.x, y: at.y, hinders: e.shiftKey };
  }

  function moveDrag(e: PointerEvent): void {
    if (!drag) return;
    const at = toSvg(e);
    drag = { ...drag, x: at.x, y: at.y, hinders: e.shiftKey };
  }

  function endDrag(e: PointerEvent): void {
    if (!drag) return;
    const { from, hinders } = drag;
    const onto = seatUnder(toSvg(e));
    drag = null;
    connect(from, onto, hinders);
  }

  function connect(from: number, onto: number | null, hinders: boolean): void {
    const relation = hinders ? 'hinders' : 'nourishes';
    const next = clone(cfg);
    if (onto === null || onto === from) {
      // Open ground, or back where it started: cut the arrow.
      next.slots[from][relation] = null;
    } else {
      const target = next.slots[onto].element;
      // At most one arrow of each kind may point at an element. Rewiring onto a
      // taken target DISPLACES whoever held it rather than producing an illegal
      // cycle — you are rerouting a relation, not stacking a second one on it.
      for (const s of next.slots) if (s[relation] === target) s[relation] = null;
      next.slots[from][relation] = target;
    }
    cfg = next;
  }

  const dragPath = $derived.by(() => {
    if (!drag) return null;
    const a = SEATS[drag.from];
    const to = { x: drag.x, y: drag.y };
    const s = toward(a, to, NODE_R);
    return `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} L ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  });

  // ---------- Reading it back ----------

  let hot = $state<number | null>(null);

  const KIND_NOTE: Record<WuxinKind, string> = {
    harmonious:
      'Hinders follows nourishes taken twice in a row (hinders = nourishes squared): the classical relation, whatever elements are in the slots.',
    counterflow:
      'Hinders runs against nourishes: every element hinders the one that feeds it. This is the opposite of harmony and always has the maximum discord.',
    split: 'Generation closes as two separate loops: a feeding pair standing apart from a triangle. The only other closed shape five arrows can make.',
    burst:
      'Generation is cut, so it runs down a line instead of round a ring. The head has nothing feeding it; the tail has nothing to pass to.',
    sustain: 'Nothing in this cycle fights anything else in it.',
    tempered:
      'Nourishes is complete, but hinders has a gap: one element hinders nothing.',
    irregular: 'Closed, but no single structure relates the two rings. Legal, but it has no named role yet.',
  };

  /** What the alignment exponent means, when there is one. */
  const K_NOTE: Record<number, string> = {
    1: 'destruction IS generation — every element feeds and fights the same thing',
    2: 'the classical relation',
    3: 'the pentagram traced the other way — unnamed',
    4: 'generation reversed — feeding your own attacker',
  };

  function problemText(p: WuxinProblem): string {
    switch (p.kind) {
      case 'slotCount':
        return `A cycle is five slots — this has ${p.found}.`;
      case 'duplicateElement':
        return `${p.element} is seated twice.`;
      case 'unknownElement':
        return `${p.element} is not a word the lexicon has.`;
      case 'selfArrow':
        return `${p.element} points its ${p.relation} arrow at itself.`;
      case 'danglingArrow':
        return `${p.element} ${p.relation} ${p.target}, which is not in the cycle.`;
      case 'contested':
        return `${p.target} is ${p.relation === 'nourishes' ? 'nourished' : 'hindered'} by ${p.by.join(' and ')} — only one may.`;
    }
  }
</script>

<!--
  The drag is tracked on the WINDOW rather than on the svg: releasing outside
  the graph then means what it should (drop on open ground — sever), and the
  gesture cannot be stranded by the cursor leaving the picture mid-drag.
-->
<svelte:window onpointermove={moveDrag} onpointerup={endDrag} onpointercancel={() => (drag = null)} />

<div class="wuxin">
  <header>
    <div>
      <h2>☯️ Wuxin</h2>
      <span class="chip dim">sandbox — nothing here touches your save</span>
    </div>
    <div class="presets">
      <button onclick={() => preset('classical')}>Classical</button>
      <button onclick={() => preset('burst')}>Burst</button>
      <button onclick={() => preset('sustain')}>Sustain</button>
      <button onclick={() => preset('split')}>Split</button>
    </div>
  </header>

  <div class="board">
    <div class="graph-wrap">
      <svg
        bind:this={svgEl}
        viewBox="0 0 {VIEW} {VIEW}"
        class="graph"
        class:dragging={drag !== null}
        aria-label="Wuxin cycle"
      >
        <defs>
          <marker
            id="wx-gen"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--xp)" />
          </marker>
          <marker
            id="wx-des"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--danger)" />
          </marker>
        </defs>

        {#each desEdges as e (e.key)}
          <path
            class="edge des"
            class:hot={hot === e.from}
            d={e.d}
            marker-end="url(#wx-des)"
          />
        {/each}
        {#each genEdges as e (e.key)}
          <path
            class="edge gen"
            class:hot={hot === e.from}
            d={e.d}
            marker-end="url(#wx-gen)"
          />
        {/each}

        {#if dragPath}
          <path
            class="edge rubber"
            class:des={drag?.hinders}
            class:gen={!drag?.hinders}
            d={dragPath}
          />
        {/if}

        {#each cfg.slots as slot, i (i)}
          <g
            class="node"
            class:hot={hot === i}
            class:source={drag?.from === i}
            role="presentation"
            onmouseenter={() => (hot = i)}
            onmouseleave={() => (hot = null)}
            onpointerdown={(e) => startDrag(e, i)}
          >
            <!--
              The pulse ring sits UNDER the node and only exists while the
              element is near full: an idle graph is completely still, so
              anything moving is saying something.
            -->
            {#if isStrained(i)}
              <circle class="pulse" cx={SEATS[i].x} cy={SEATS[i].y} r={NODE_R} />
            {/if}
            <circle cx={SEATS[i].x} cy={SEATS[i].y} r={NODE_R} />
            <!--
              Charge as an arc around the rim, drawn from the top clockwise.
              A dash offset on a rotated circle is the cheapest correct way to
              do this — no arc-path maths, no wrap-around bugs at 100%.
            -->
            <circle
              class="fill"
              class:full={isStrained(i)}
              cx={SEATS[i].x}
              cy={SEATS[i].y}
              r={NODE_R}
              stroke-dasharray="{RIM * charge[i]} {RIM}"
              transform="rotate(-90 {SEATS[i].x} {SEATS[i].y})"
            />
            {#if habit[i] > 0.02}
              <circle
                class="jaded"
                class:full={isJaded(i)}
                cx={SEATS[i].x}
                cy={SEATS[i].y}
                r={NODE_R - 5}
                stroke-dasharray="{INNER_RIM * habit[i]} {INNER_RIM}"
                transform="rotate(-90 {SEATS[i].x} {SEATS[i].y})"
              />
            {/if}
            <text class="node-icon" x={SEATS[i].x} y={SEATS[i].y - 3}>
              {word(slot.element)?.icon ?? '❓'}
            </text>
            <text class="node-name" x={SEATS[i].x} y={SEATS[i].y + 15}>
              {word(slot.element)?.word ?? slot.element}
            </text>
            <title
              >{name(slot.element)} — charge {pct(charge[i])}, habituation {pct(
                habit[i],
              )}</title
            >
          </g>
        {/each}
      </svg>

      <p class="legend">
        <span class="key gen">{NOURISHES} nourishes</span>
        <span class="key des">{HINDERS} hinders</span>
        <span class="dim">generation rides the outside; destruction crosses the middle</span>
      </p>
      <p class="legend dim">
        Drag one element onto another to nourish it · <kbd>Shift</kbd>-drag to hinder ·
        drop on open ground to sever
      </p>

      <!--
        The hover readout. Deliberately not a floating tooltip: it needs no
        positioning code, it cannot be clipped by the graph's edge, and it can
        hold two sentences without becoming a wall of text under the cursor.
      -->
      <div class="detail" class:idle={hot === null}>
        {#if hot === null}
          <span class="dim">Hover an element for what it is holding.</span>
        {:else}
          {@const slot = cfg.slots[hot]}
          <div class="detail-head">
            <b>{word(slot.element)?.icon} {name(slot.element)}</b>
            <span class="chip" class:warn={isStrained(hot)}>charge {pct(charge[hot])}</span>
            <span class="chip" class:warn={isJaded(hot)}>habituation {pct(habit[hot])}</span>
          </div>
          {#each readout(hot) as line, n (n)}
            <p>{line}</p>
          {/each}
        {/if}
      </div>

      <label class="relaxed">
        <input type="checkbox" bind:checked={relaxed} />
        <span
          >Relaxed — out of combat, dispersing harmlessly. Full nodes rest instead of leaking.</span
        >
      </label>

      <details class="sandbox">
        <summary>sandbox values — nothing feeds these yet</summary>
        <div class="sliders">
          {#each cfg.slots as slot, i (i)}
            <label>
              <span>{word(slot.element)?.icon}</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                bind:value={charge[i]}
                aria-label="{name(slot.element)} charge"
                onmouseenter={() => (hot = i)}
              />
              <input
                type="range"
                class="jaded-slider"
                min="0"
                max="1"
                step="0.01"
                bind:value={habit[i]}
                aria-label="{name(slot.element)} habituation"
                onmouseenter={() => (hot = i)}
              />
            </label>
          {/each}
        </div>
        <p class="dim small">Outer ring is charge, inner ring is habituation.</p>
      </details>
    </div>

    <div class="side">
      <div class="verdict" class:bad={problems.length > 0}>
        <strong>{kind}</strong>
        {#if k !== null}
          <span class="chip" class:good={far === 0}>
            hinders = nourishes<sup>{k}</sup>
          </span>
          <span class="chip" class:good={far === 0}>
            {far === 0 ? 'the classical relation' : `${far} from harmony`}
          </span>
        {:else}
          <span class="chip dim">unaligned</span>
        {/if}
        <p>{KIND_NOTE[kind]}</p>
        {#if k !== null}
          <p class="small dim">{K_NOTE[k] ?? 'a regular relation with no name yet'}</p>
        {:else}
          <p class="dim small">
            No single power of generation reaches destruction — the two rings are unrelated, so
            there is no distance to report.
          </p>
        {/if}

        {#if marks.orphans.length || marks.pivot || marks.sinks.length || marks.sources.length || marks.doubled.length}
          <ul class="marks">
            {#if marks.pivot}
              <li>
                <b>pivot</b> — {name(marks.pivot)} is in both triangles and neither pair: the only
                element in no mutual bond of either kind
              </li>
            {/if}
            {#each marks.orphans as e (e)}
              <li><b>orphan</b> — {name(e)} has no arrows at all, in or out</li>
            {/each}
            {#each marks.sinks as e (e)}
              <li><b>sink</b> — both lines end at {name(e)}, which passes nothing on</li>
            {/each}
            {#each marks.sources as e (e)}
              <li><b>source</b> — both lines start at {name(e)}, which nothing reaches</li>
            {/each}
            {#if marks.doubled.length}
              <li>
                <b>doubled</b> — {list(marks.doubled)} feed{marks.doubled.length === 1 ? 's' : ''} and
                fight{marks.doubled.length === 1 ? 's' : ''} the same thing
              </li>
            {/if}
          </ul>
        {/if}

        <p class="dim small">
          generation: {gen.cycles.length} loop{gen.cycles.length === 1 ? '' : 's'},
          {gen.chains.length} chain{gen.chains.length === 1 ? '' : 's'},
          {gen.severed} cut · destruction: {des.cycles.length} loop{des.cycles.length === 1
            ? ''
            : 's'}, {des.severed} cut
        </p>
        <p class="dim small">
          <!--
            Demoted deliberately. Discord is a Hamming distance from ONE
            configuration — the harmonious partner of this generative ring —
            and on a closed ring it only ever reads 0 or the maximum. It is a
            yes/no about the classical relation, not a gradient; the exponent
            above is the thing with an ordering on it.
          -->
          {off === 0
            ? 'every slot matches the classical relation'
            : `${off} of ${cfg.slots.length} slots differ from the classical relation`}
        </p>
      </div>

      {#if problems.length > 0}
        <ul class="problems">
          {#each problems as p, i (i)}
            <li>{problemText(p)}</li>
          {/each}
        </ul>
      {/if}

      <table class="clauses">
        <tbody>
          {#each cfg.slots as slot, i (i)}
            <tr
              class:hot={hot === i}
              onmouseenter={() => (hot = i)}
              onmouseleave={() => (hot = null)}
            >
              <td>
                <select
                  value={slot.element}
                  onchange={(e) => setElement(i, e.currentTarget.value)}
                >
                  {#each eligibleElements() as id (id)}
                    <option value={id}>{word(id)?.icon} {word(id)?.word ?? id}</option>
                  {/each}
                </select>
              </td>
              <td class="arrow gen">{NOURISHES}</td>
              <td>
                <select
                  value={slot.nourishes ?? SEVERED}
                  onchange={(e) => setArrow(i, 'nourishes', e.currentTarget.value)}
                >
                  <option value={SEVERED}>{SEVERED} severed</option>
                  {#each elements as id (id)}
                    <option value={id}>{word(id)?.word ?? id}</option>
                  {/each}
                </select>
              </td>
              <td class="arrow des">{HINDERS}</td>
              <td>
                <select
                  value={slot.hinders ?? SEVERED}
                  onchange={(e) => setArrow(i, 'hinders', e.currentTarget.value)}
                >
                  <option value={SEVERED}>{SEVERED} severed</option>
                  {#each elements as id (id)}
                    <option value={id}>{word(id)?.word ?? id}</option>
                  {/each}
                </select>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>

      <pre class="grammar">{formatWuxin(cfg)}</pre>
      <p class="dim small">
        The grammar above is the whole authored form — a sect, a master or a great beast is
        five of these lines and nothing else.
      </p>
    </div>
  </div>
</div>

<style>
  .wuxin {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  header h2 {
    display: inline;
    margin-right: 0.5rem;
  }
  .presets {
    display: flex;
    gap: 0.35rem;
  }
  .presets button {
    background: var(--bg-raised);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 4px;
    padding: 0.25rem 0.6rem;
    cursor: pointer;
  }
  .presets button:hover {
    background: var(--bg-hover);
  }
  .board {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: flex-start;
  }
  .graph-wrap {
    flex: 1 1 380px;
    min-width: 320px;
  }
  .graph {
    width: 100%;
    height: auto;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .side {
    flex: 1 1 320px;
    min-width: 300px;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .edge {
    fill: none;
    stroke-width: 2;
    opacity: 0.75;
  }
  .edge.gen {
    stroke: var(--xp);
  }
  .edge.des {
    stroke: var(--danger);
    stroke-dasharray: 5 4;
    opacity: 0.5;
  }
  .edge.hot {
    opacity: 1;
    stroke-width: 3;
  }

  .edge.rubber {
    opacity: 1;
    stroke-width: 3;
    stroke-dasharray: 2 5;
    stroke-linecap: round;
    pointer-events: none;
  }

  .graph.dragging {
    cursor: grabbing;
  }
  .node {
    cursor: grab;
    touch-action: none;
  }
  .node circle {
    fill: var(--bg-raised);
    stroke: var(--border);
    stroke-width: 2;
  }
  .node.hot circle {
    stroke: var(--accent);
  }
  .node.source circle {
    stroke: var(--accent);
    stroke-width: 3;
  }

  /* Charge on the rim, habituation just inside it. */
  .node .fill {
    fill: none;
    stroke: var(--mana);
    stroke-width: 4;
    stroke-linecap: round;
    opacity: 0.85;
  }
  .node .fill.full {
    stroke: var(--accent);
  }
  .node .jaded {
    fill: none;
    stroke: var(--text-dim);
    stroke-width: 2;
    stroke-linecap: round;
    opacity: 0.7;
  }
  .node .jaded.full {
    stroke: var(--danger);
    opacity: 0.9;
  }

  /*
   * A near-full node breathes. Nothing else on this graph moves, so motion
   * means exactly one thing — and it stops the moment there is room again.
   */
  .node .pulse {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    transform-box: fill-box;
    transform-origin: center;
    animation: wx-breathe 2.2s ease-in-out infinite;
  }
  @keyframes wx-breathe {
    0%,
    100% {
      transform: scale(1);
      opacity: 0.5;
    }
    50% {
      transform: scale(1.22);
      opacity: 0;
    }
  }
  /* Never animate at someone who has asked the system not to. */
  @media (prefers-reduced-motion: reduce) {
    .node .pulse {
      animation: none;
      opacity: 0.5;
    }
  }

  .detail {
    margin-top: 0.5rem;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.5rem 0.65rem;
    font-size: 0.8rem;
    min-height: 4.2rem;
  }
  .detail.idle {
    font-style: italic;
  }
  .detail-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.3rem;
  }
  .detail p {
    margin: 0.25rem 0 0;
  }
  .chip.warn {
    color: var(--accent);
    border-color: var(--accent);
  }

  .relaxed {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.5rem;
    font-size: 0.78rem;
    color: var(--text-dim);
    cursor: pointer;
  }

  .sandbox {
    margin-top: 0.4rem;
    font-size: 0.75rem;
    color: var(--text-dim);
  }
  .sandbox summary {
    cursor: pointer;
  }
  .sliders {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    margin: 0.35rem 0;
  }
  .sliders label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .sliders input {
    flex: 1 1 auto;
    min-width: 60px;
    accent-color: var(--mana);
  }
  .sliders input.jaded-slider {
    accent-color: var(--text-dim);
  }
  kbd {
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 0 0.25rem;
    font-size: 0.7rem;
  }
  .node text {
    text-anchor: middle;
    pointer-events: none;
  }
  .node-icon {
    font-size: 1.1rem;
  }
  .node-name {
    font-size: 0.62rem;
    fill: var(--text-dim);
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin: 0.4rem 0 0;
    font-size: 0.75rem;
  }
  .key.gen {
    color: var(--xp);
  }
  .key.des {
    color: var(--danger);
  }

  .verdict {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-left: 3px solid var(--xp);
    border-radius: 6px;
    padding: 0.6rem 0.75rem;
  }
  .verdict.bad {
    border-left-color: var(--danger);
  }
  .verdict strong {
    text-transform: capitalize;
    margin-right: 0.4rem;
  }
  .verdict p {
    margin: 0.35rem 0 0;
    font-size: 0.82rem;
  }

  .chip {
    display: inline-block;
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.05rem 0.5rem;
    font-size: 0.72rem;
  }
  .chip.good {
    color: var(--xp);
    border-color: var(--xp);
  }

  .marks {
    margin: 0.4rem 0 0;
    padding-left: 1.1rem;
    font-size: 0.78rem;
    color: var(--text-dim);
  }
  .marks b {
    color: var(--accent);
    font-weight: 600;
  }

  .problems {
    margin: 0;
    padding-left: 1.1rem;
    color: var(--danger);
    font-size: 0.8rem;
  }

  .clauses {
    border-collapse: collapse;
    width: 100%;
  }
  .clauses tr.hot {
    background: var(--bg-hover);
  }
  .clauses td {
    padding: 0.15rem 0.2rem;
  }
  .clauses select {
    background: var(--bg-raised);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.15rem 0.25rem;
    width: 100%;
  }
  .arrow {
    width: 1.4rem;
    text-align: center;
    font-weight: 700;
  }
  .arrow.gen {
    color: var(--xp);
  }
  .arrow.des {
    color: var(--danger);
  }

  .grammar {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.5rem 0.65rem;
    margin: 0;
    font-size: 0.78rem;
    overflow-x: auto;
  }
</style>
