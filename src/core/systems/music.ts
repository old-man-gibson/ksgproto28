import type {
  Composition,
  GameState,
  MusicArchetypeDef,
  MusicAxis,
  MusicCadence,
  MusicContour,
  MusicMeterDef,
  NoteDurId,
  NoteEvent,
  RepeatSpan,
  StatusApplication,
} from '../types';
import type { EventBus } from '../engine/events';
import {
  BAR_UNITS,
  BASE_BARS,
  CADENCE_AFFINITY,
  CONTOUR_AFFINITY,
  DEFAULT_METER,
  MAX_BARS,
  MUSIC_ARCHETYPES,
  MUSIC_METERS,
  MUSIC_SCALES,
  MUSIC_UNLOCKS,
  MUSIC_XP_PER_NOTE,
  MUSIC_XP_PER_TICK,
  DEFAULT_BPM,
  MAX_BPM,
  MIN_BPM,
  NOTE_DURATIONS,
  ticksPerUnit,
  TONIC_NAMES,
} from '../data/music.data';
import { checkDiscovery, grantSkillXp } from './skills';
import { bumpStat } from './achievements';
import { applyStatuses } from './statuses';
import { STATUSES } from '../registry';
import { text } from '../text/log';

/**
 * Magical music. Two halves, cut on arcana's seam:
 *
 *  - The READING is pure. `analyzeBars` runs the classifiers — Krumhansl-
 *    Schmuckler key-finding, melodic contour, motion type, interval content,
 *    a Longuet-Higgins/Lee-flavoured syncopation measure and Shannon entropy
 *    — and `readComposition` names the result by nearest archetype. State
 *    never enters: the bench can analyze a sheet your hands cannot play.
 *  - LEGALITY is state. `checkComposition` gates what may be PERFORMED on
 *    Musicianship's level: which durations, how many bars, which scales and
 *    tonics (see MUSIC_UNLOCKS).
 *
 * Classification is total on purpose: every sheet is nearest to SOMETHING,
 * so there are no hidden recipes — only a chart that fills in as the player
 * writes stranger music. Effects ride `MusicArchetypeDef.confers` → an
 * ordinary status (already a fingerprinted mod source; see conferredBy).
 */

export const MUSICIANSHIP_ID = 'musicianship';

// ---------- Level gates ----------

export function musicLevel(state: GameState): number {
  return state.skills[MUSICIANSHIP_ID]?.level ?? 0;
}

/** Durations on the palette at this level, coarse to fine. */
export function allowedDurations(level: number): NoteDurId[] {
  return (Object.keys(NOTE_DURATIONS) as NoteDurId[]).filter(
    (id) => NOTE_DURATIONS[id].unlockLevel <= level,
  );
}

/** How many bars the sheet may hold at this level (4 base, up to 8). */
export function maxBars(level: number): number {
  const gates = [MUSIC_UNLOCKS.bar5, MUSIC_UNLOCKS.bar6, MUSIC_UNLOCKS.bar7, MUSIC_UNLOCKS.bar8];
  return BASE_BARS + gates.filter((g) => level >= g).length;
}

export function scalesUnlocked(level: number): boolean {
  return level >= MUSIC_UNLOCKS.scales;
}

export function tuningUnlocked(level: number): boolean {
  return level >= MUSIC_UNLOCKS.tuning;
}

/** The next thing the skill will hand over, for the panel's "reach for" line. */
export function nextUnlock(level: number): { level: number; what: string } | null {
  const ladder: [number, string][] = [
    [MUSIC_UNLOCKS.quarter, 'quarter notes'],
    [MUSIC_UNLOCKS.repeats, 'repeat marks'],
    [MUSIC_UNLOCKS.bar5, 'a fifth bar'],
    [MUSIC_UNLOCKS.dots, 'dotted notes'],
    [MUSIC_UNLOCKS.eighth, 'eighth notes'],
    [MUSIC_UNLOCKS.ties, 'ties'],
    [NOTE_DURATIONS.dottedEighth.unlockLevel, 'the dotted eighth'],
    [MUSIC_UNLOCKS.tuplets, 'triplets'],
    [MUSIC_UNLOCKS.bar6, 'a sixth bar'],
    [MUSIC_UNLOCKS.scales, 'new scales'],
    [MUSIC_METERS.waltz.unlockLevel, 'waltz time (3/4)'],
    [MUSIC_METERS.compound.unlockLevel, 'compound time (6/8)'],
    [MUSIC_UNLOCKS.sixteenth, 'sixteenth notes'],
    [MUSIC_METERS.quintuple.unlockLevel, 'quintuple time (5/4)'],
    [MUSIC_UNLOCKS.bar7, 'a seventh bar'],
    [MUSIC_UNLOCKS.quintuplets, 'quintuplets'],
    [MUSIC_UNLOCKS.tuning, 'tuning (any tonic)'],
    [MUSIC_UNLOCKS.bar8, 'the eighth bar'],
  ];
  for (const [lvl, what] of ladder) if (level < lvl) return { level: lvl, what };
  return null;
}

// ---------- Meter ----------

/** The ruling a composition's bars live under; unknown ids read as common time. */
export function meterOf(comp: Composition): MusicMeterDef {
  return MUSIC_METERS[comp.meter] ?? MUSIC_METERS[DEFAULT_METER];
}

/** Grid units one bar of this meter holds. */
export function barCapacity(meter: MusicMeterDef): number {
  return meter.beats * meter.beatUnits;
}

// ---------- Repeats ----------

/**
 * The sheet as PERFORMED: repeat spans unrolled into a flat bar sequence.
 * `source[i]` is the written bar each performed bar came from and `pass[i]`
 * which time through it is (1-based) — the two facts everything downstream
 * needs, from decaying power to drawing the right barlines.
 *
 * Total by construction: malformed spans (out of range, inverted, times < 2)
 * are ignored rather than throwing, and only the FIRST span starting at a
 * given bar is honoured, so overlapping spans can never loop forever.
 * `checkComposition` is where the player hears about any of that.
 */
/**
 * The repeat spans the reading will actually honour, in canonical order.
 *
 * A malformed span (off the end, reversed, times < 2) is simply not played,
 * so it must not be allowed to affect anything downstream either — including
 * `compositionKey`, which would otherwise hand two identical-sounding sheets
 * two different identities. One definition, both callers.
 */
export function validRepeats(comp: Composition): RepeatSpan[] {
  return (comp.repeats ?? [])
    .filter(
      (r) =>
        Number.isInteger(r.from) &&
        Number.isInteger(r.to) &&
        r.from >= 0 &&
        r.to < comp.bars.length &&
        r.from <= r.to &&
        Number.isInteger(r.times) &&
        r.times >= 2,
    )
    .sort((a, b) => a.from - b.from || a.to - b.to || a.times - b.times);
}

export function expandRepeats(comp: Composition): {
  bars: NoteEvent[][];
  source: number[];
  pass: number[];
} {
  const bars: NoteEvent[][] = [];
  const source: number[] = [];
  const pass: number[] = [];
  const spans = validRepeats(comp);
  for (let i = 0; i < comp.bars.length; ) {
    const span = spans.find((r) => r.from === i);
    if (!span) {
      bars.push(comp.bars[i]);
      source.push(i);
      pass.push(1);
      i += 1;
      continue;
    }
    for (let time = 1; time <= span.times; time++) {
      for (let b = span.from; b <= span.to; b++) {
        bars.push(comp.bars[b]);
        source.push(b);
        pass.push(time);
      }
    }
    i = span.to + 1;
  }
  return { bars, source, pass };
}

/**
 * Note ATTACKS across the performed sheet, weighted: a tied group is one
 * attack (you struck once), and the nth verbatim replay of a bar pays 1/n.
 *
 * The harmonic decay is what keeps repeats honest. Power scales with notes
 * played, so an unweighted ×2 repeat would double a piece's strength for no
 * composing at all; instead the second pass pays half, the third a third.
 * The world has heard it before — the same novelty philosophy the whole game
 * runs on. Repeats still buy something real: length, and a motif score that
 * honestly rises, because restatement IS what motif measures.
 */
export function weightedAttacks(comp: Composition): number {
  const { bars, pass } = expandRepeats(comp);
  let total = 0;
  // Walk the performed stream, skipping continuations of a tie.
  let carry: number | null = null; // pitch a tie is currently holding open
  bars.forEach((bar, bi) => {
    for (const e of bar) {
      const continues = carry !== null && e.pitch === carry;
      if (e.pitch !== null && !continues) total += 1 / pass[bi];
      carry = e.tie && e.pitch !== null ? e.pitch : null;
    }
  });
  return total;
}

/**
 * Stage ticks the whole sheet takes: every PERFORMED unit at the fixed unit
 * clock, ceiled ONCE at the end — a waltz bar is genuinely shorter than a
 * common-time bar (meter changes the bar, never the tempo), and a repeated
 * span genuinely takes longer.
 */
export function performanceTicks(comp: Composition): number {
  return Math.ceil(expandRepeats(comp).bars.length * barTicksOf(comp));
}

/** Tick offsets (possibly fractional) at which each PERFORMED bar begins. */
export function barTickStarts(comp: Composition): number[] {
  const barTicks = barTicksOf(comp);
  return expandRepeats(comp).bars.map((_, i) => i * barTicks);
}

/** Ticks one bar of this piece takes: its capacity at its own tempo. */
export function barTicksOf(comp: Composition): number {
  return barCapacity(meterOf(comp)) * ticksPerUnit(tempoOf(comp));
}

/** The piece's tempo, clamped to the writable range. */
export function tempoOf(comp: Composition): number {
  const bpm = comp.bpm;
  if (!Number.isFinite(bpm)) return DEFAULT_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

export function tempoUnlocked(level: number): boolean {
  return level >= MUSIC_UNLOCKS.tempo;
}

// ---------- The pedal tone ----------

export function pedalUnlocked(level: number): boolean {
  return level >= MUSIC_UNLOCKS.pedal;
}

/** The piece's pedal pitch, or null — nonsense values read as no pedal. */
export function pedalOf(comp: Composition): number | null {
  const p = comp.pedal;
  return p === null || p === undefined || !Number.isInteger(p) ? null : p;
}

/** Set (or clear, with null) the sustained under-voice. */
export function setPedal(state: GameState, comp: Composition, pitch: number | null): string | null {
  if (pitch === null) {
    comp.pedal = null;
    return null;
  }
  if (!pedalUnlocked(musicLevel(state))) {
    return `A pedal tone needs Musicianship ${MUSIC_UNLOCKS.pedal}.`;
  }
  if (!pitchAllowed(comp, pitch)) return 'That pitch is off the end of this staff.';
  comp.pedal = pitch;
  return null;
}

/**
 * VERTICAL consonance: how agreeably the melody sits against the pedal,
 * duration-weighted so a long dissonance counts for more than a passing
 * one. This is the first measure in the system that asks about two pitches
 * sounding AT ONCE rather than one after another.
 *
 * Neutral (0.5) with no pedal: with one voice there is no harmony to have
 * an opinion about, and pretending otherwise would let pedal-less pieces
 * drift toward archetypes that do care.
 */
export function harmonyAgainst(sounded: SoundedEvent[], pedal: number | null): number {
  if (pedal === null) return 0.5;
  let weighted = 0;
  let total = 0;
  for (const e of sounded) {
    if (e.pitch === null) continue;
    const interval = ((((e.pitch - pedal) % 12) + 12) % 12);
    weighted += CONSONANCE[interval] * e.units;
    total += e.units;
  }
  return total > 0 ? weighted / total : 0.5;
}

/** Set ♩=bpm. Returns null on success, else why not. */
export function setTempo(state: GameState, comp: Composition, bpm: number): string | null {
  if (!tempoUnlocked(musicLevel(state))) {
    return `Setting the tempo needs Musicianship ${MUSIC_UNLOCKS.tempo}.`;
  }
  if (!Number.isFinite(bpm)) return 'That is not a tempo.';
  comp.bpm = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
  return null;
}

/**
 * Tempo on the 0–1 axis scale, MIN_BPM → MAX_BPM. The default ♩=80 sits at
 * 0.25, so an unhurried piece is genuinely at the slow end of the range.
 */
export function paceOf(bpm: number): number {
  return Math.max(0, Math.min(1, (bpm - MIN_BPM) / (MAX_BPM - MIN_BPM)));
}

/** Level at which the ‖: :‖ barlines become available. */
export function repeatsUnlocked(level: number): boolean {
  return level >= MUSIC_UNLOCKS.repeats;
}

/** Level at which ties become available. */
export function tiesUnlocked(level: number): boolean {
  return level >= MUSIC_UNLOCKS.ties;
}

/**
 * Lay a repeat over bars `from`..`to`. Returns null on success, else why
 * not. Spans may not overlap, and may not straddle the theme/coda boundary
 * — the coda is read as its own piece, and a repeat crossing into it would
 * make "which archetype is this" unanswerable.
 */
export function addRepeat(
  state: GameState,
  comp: Composition,
  from: number,
  to: number,
  times = 2,
): string | null {
  if (!repeatsUnlocked(musicLevel(state))) {
    return `Repeat marks need Musicianship ${MUSIC_UNLOCKS.repeats}.`;
  }
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to >= comp.bars.length) {
    return 'That is not a stretch of this sheet.';
  }
  if (from > to) return 'A repeat ends where it starts or later.';
  if (times < 2) return 'A repeat plays at least twice.';
  if (from < BASE_BARS && to >= BASE_BARS) {
    return 'A repeat cannot straddle the coda — it is read as its own piece.';
  }
  comp.repeats ??= [];
  if (comp.repeats.some((r) => from <= r.to && r.from <= to)) {
    return 'That overlaps a repeat already on the sheet.';
  }
  comp.repeats.push({ from, to, times });
  comp.repeats.sort((a, b) => a.from - b.from);
  return null;
}

export function removeRepeat(comp: Composition, index: number): void {
  comp.repeats?.splice(index, 1);
}

/** Change how many times a span plays (2+). */
export function setRepeatTimes(comp: Composition, index: number, times: number): void {
  const span = comp.repeats?.[index];
  if (span) span.times = Math.max(2, Math.round(times));
}

/** The repeat span covering a written bar, if any, with its index. */
export function repeatAt(comp: Composition, bar: number): { span: RepeatSpan; index: number } | null {
  const index = (comp.repeats ?? []).findIndex((r) => bar >= r.from && bar <= r.to);
  return index === -1 ? null : { span: comp.repeats[index], index };
}

/**
 * Tie a note into the next one, or untie it. Refuses what cannot be tied —
 * the gate is here rather than in the reading, which honours only valid
 * ties and never complains (see soundedEvents).
 */
export function toggleTie(
  state: GameState,
  comp: Composition,
  barIndex: number,
  eventIndex: number,
): string | null {
  const e = comp.bars[barIndex]?.[eventIndex];
  if (!e) return 'Nothing there to tie.';
  if (e.tie) {
    delete e.tie;
    return null;
  }
  if (!tiesUnlocked(musicLevel(state))) return `Ties need Musicianship ${MUSIC_UNLOCKS.ties}.`;
  if (e.pitch === null) return 'Silence cannot be tied.';
  const next = comp.bars[barIndex][eventIndex + 1] ?? comp.bars[barIndex + 1]?.[0];
  if (!next) return 'There is nothing after it to tie into.';
  if (next.pitch !== e.pitch) return 'A tie joins two notes of the SAME pitch.';
  e.tie = true;
  return null;
}

// ---------- Sheet geometry ----------

export function barUnitsUsed(bar: NoteEvent[]): number {
  return bar.reduce((sum, e) => sum + NOTE_DURATIONS[e.dur].units, 0);
}

/** The pitches this composition's staff offers: its scale over its tonic, plus the octave. */
export const STAFF_OCTAVES = 2;

/**
 * The staff's RULING: the in-key rows, `STAFF_OCTAVES` of them, topped by
 * the octave tonic. These are the lanes drawn and clicked — the key
 * signature, in effect.
 *
 * They are NOT the only pitches a piece may hold: see `pitchAllowed`. Real
 * notation puts seven letters on the staff and reaches everything else with
 * an accidental, and so does this — which matters, because a system that can
 * only say what its scale says cannot write a tritone, and some music is
 * mostly tritone.
 */
export function allowedPitches(comp: Composition): number[] {
  const scale = MUSIC_SCALES[comp.scale] ?? MUSIC_SCALES.major;
  const out: number[] = [];
  for (let octave = 0; octave < STAFF_OCTAVES; octave++) {
    for (const degree of scale.degrees) out.push(comp.tonic + degree + octave * 12);
  }
  out.push(comp.tonic + STAFF_OCTAVES * 12);
  return out;
}

/**
 * Whether the staff can hold this pitch at all — anything inside its range,
 * chromatic notes included. Accidentals are how you reach them; the ruling
 * only decides which notes need a sign in front of them.
 */
export function pitchAllowed(comp: Composition, pitch: number): boolean {
  const rows = allowedPitches(comp);
  return Number.isInteger(pitch) && pitch >= rows[0] && pitch <= rows[rows.length - 1];
}

// ---------- Editing (state-gated, called by the panel) ----------

export function createComposition(state: GameState): Composition {
  const comp: Composition = {
    id: state.uidCounter++,
    name: `Piece No. ${state.compositions.length + 1}`,
    scale: 'major',
    tonic: 0,
    meter: DEFAULT_METER,
    bpm: DEFAULT_BPM,
    pedal: null,
    bars: Array.from({ length: BASE_BARS }, () => []),
    repeats: [],
  };
  state.compositions.push(comp);
  return comp;
}

export function deleteComposition(state: GameState, bus: EventBus, id: number): void {
  if (state.performance?.compositionId === id) stopPerformance(state, bus, 'the piece was deleted');
  const at = state.compositions.findIndex((c) => c.id === id);
  if (at >= 0) state.compositions.splice(at, 1);
}

/**
 * Write an event into a bar — at `index`, or appended when omitted. Returns
 * null on success, otherwise the reason — the palette should make these
 * unreachable, but the sheet never trusts it.
 */
export function addEvent(
  state: GameState,
  comp: Composition,
  barIndex: number,
  dur: NoteDurId,
  pitch: number | null,
  index?: number,
): string | null {
  const bar = comp.bars[barIndex];
  if (!bar) return 'No such bar.';
  const def = NOTE_DURATIONS[dur];
  if (!def) return 'No such duration.';
  const level = musicLevel(state);
  if (def.unlockLevel > level) {
    return `${def.name} notes need Musicianship ${def.unlockLevel}.`;
  }
  if (barUnitsUsed(bar) + def.units > barCapacity(meterOf(comp))) {
    return `No room left in bar ${barIndex + 1} for a ${def.name.toLowerCase()}.`;
  }
  if (pitch !== null && !pitchAllowed(comp, pitch)) {
    return 'That pitch is off the end of this staff.';
  }
  bar.splice(Math.max(0, Math.min(index ?? bar.length, bar.length)), 0, { dur, pitch });
  return null;
}

export function removeEvent(comp: Composition, barIndex: number, eventIndex: number): void {
  comp.bars[barIndex]?.splice(eventIndex, 1);
}

/** The duration exactly half as long, if the notation has one. */
export function splitDuration(dur: NoteDurId): NoteDurId | null {
  const half = NOTE_DURATIONS[dur].units / 2;
  return DUR_IDS.find((id) => NOTE_DURATIONS[id].units === half) ?? null;
}

/** The duration exactly as long as both together, if the notation has one. */
export function mergedDuration(a: NoteDurId, b: NoteDurId): NoteDurId | null {
  const sum = NOTE_DURATIONS[a].units + NOTE_DURATIONS[b].units;
  return DUR_IDS.find((id) => NOTE_DURATIONS[id].units === sum) ?? null;
}

/**
 * Halve an event in place: one note becomes two of half its length at the
 * same pitch (a rest splits into two rests). Refuses when the notation has
 * no half (a sixteenth splits no further; neither does a dotted eighth) or
 * when the finer duration is not yet unlocked — splitting must never be a
 * back door past the ladder.
 */
export function splitEvent(
  state: GameState,
  comp: Composition,
  barIndex: number,
  eventIndex: number,
): string | null {
  const bar = comp.bars[barIndex];
  const e = bar?.[eventIndex];
  if (!e) return 'Nothing there to split.';
  const halfId = splitDuration(e.dur);
  if (!halfId) return `A ${NOTE_DURATIONS[e.dur].name.toLowerCase()} splits no further.`;
  const def = NOTE_DURATIONS[halfId];
  if (def.unlockLevel > musicLevel(state)) {
    return `Splitting that needs ${def.name.toLowerCase()}s — Musicianship ${def.unlockLevel}.`;
  }
  bar.splice(eventIndex, 1, { dur: halfId, pitch: e.pitch }, { dur: halfId, pitch: e.pitch });
  return null;
}

/**
 * Merge two ADJACENT events of the same kind into one, keeping the TARGET's
 * pitch (you dragged the other onto it — it absorbs). Refuses when the sum
 * is no duration the notation has (two dotted quarters make 180 — fine, a
 * dotted half; a quarter plus a sixteenth make 75 — nothing), when kinds
 * differ (a note never merges into silence), or when the merged duration is
 * locked.
 */
export function mergeEvents(
  state: GameState,
  comp: Composition,
  barIndex: number,
  sourceIndex: number,
  targetIndex: number,
): string | null {
  const bar = comp.bars[barIndex];
  const source = bar?.[sourceIndex];
  const target = bar?.[targetIndex];
  if (!source || !target || sourceIndex === targetIndex) return 'Nothing there to merge.';
  if (Math.abs(sourceIndex - targetIndex) !== 1) return 'Only neighbours can merge.';
  if ((source.pitch === null) !== (target.pitch === null)) {
    return 'A note and a rest cannot merge.';
  }
  const mergedId = mergedDuration(source.dur, target.dur);
  if (!mergedId) return 'Those two make no length the notation can write.';
  const def = NOTE_DURATIONS[mergedId];
  if (def.unlockLevel > musicLevel(state)) {
    return `That merge makes a ${def.name.toLowerCase()} — Musicianship ${def.unlockLevel}.`;
  }
  const at = Math.min(sourceIndex, targetIndex);
  bar.splice(at, 2, { dur: mergedId, pitch: target.pitch });
  return null;
}

/**
 * Move an event — within its bar (reorder / re-pitch) or into another bar.
 * `toIndex` is the insertion position AFTER removal from the source. Cross-
 * bar moves respect the destination's remaining capacity; a re-pitched note
 * must land on the staff's ruling; rests ignore pitch entirely.
 */
export function moveEvent(
  state: GameState,
  comp: Composition,
  from: { bar: number; index: number },
  to: { bar: number; index: number },
  pitch: number | null,
): string | null {
  const srcBar = comp.bars[from.bar];
  const destBar = comp.bars[to.bar];
  const e = srcBar?.[from.index];
  if (!e || !destBar) return 'Nothing there to move.';
  const newPitch = e.pitch === null ? null : (pitch ?? e.pitch);
  if (newPitch !== null && !pitchAllowed(comp, newPitch)) {
    return 'That pitch is off the end of this staff.';
  }
  if (to.bar !== from.bar) {
    const units = NOTE_DURATIONS[e.dur].units;
    if (barUnitsUsed(destBar) + units > barCapacity(meterOf(comp))) {
      return `No room left in bar ${to.bar + 1} for a ${NOTE_DURATIONS[e.dur].name.toLowerCase()}.`;
    }
  }
  srcBar.splice(from.index, 1);
  const at = Math.max(0, Math.min(to.index, destBar.length));
  destBar.splice(at, 0, { ...e, pitch: newPitch });
  return null;
}

/** Grow or shrink the sheet, within what the level allows. Shrinking discards. */
export function setBarCount(state: GameState, comp: Composition, count: number): void {
  const clamped = Math.max(BASE_BARS, Math.min(maxBars(musicLevel(state)), Math.min(MAX_BARS, count)));
  while (comp.bars.length < clamped) comp.bars.push([]);
  if (comp.bars.length > clamped) comp.bars.splice(clamped);
  pruneRepeats(comp);
}

export function setScale(state: GameState, comp: Composition, scaleId: string): void {
  if (!MUSIC_SCALES[scaleId]) return;
  if (scaleId !== 'major' && !scalesUnlocked(musicLevel(state))) return;
  // Notes already written stay put — checkComposition will say if the new
  // ruling leaves any of them off the staff. Honest, and reversible.
  comp.scale = scaleId;
}

export function setTonic(state: GameState, comp: Composition, tonic: number): void {
  if (tonic !== 0 && !tuningUnlocked(musicLevel(state))) return;
  comp.tonic = ((Math.round(tonic) % 12) + 12) % 12;
}

/**
 * Re-rule the sheet's time. Returns whether it took. Written bars stay put
 * — a bar that no longer fits (or no longer fills) its meter is flagged by
 * checkComposition, same honest-and-reversible deal as re-ruling the scale.
 */
export function setMeter(state: GameState, comp: Composition, meterId: string): boolean {
  const meter = MUSIC_METERS[meterId];
  if (!meter) return false;
  if (meter.unlockLevel > musicLevel(state)) return false;
  comp.meter = meterId;
  return true;
}

/**
 * Coerce a loaded composition into a shape the panel and the classifiers can
 * hold. Save data is not trusted: a sheet written by an older build, a
 * mid-hot-reload session or a hand-edited save may carry durations that
 * resolve to nothing, non-integer pitches, or a bars field that is not even
 * an array — and a single NaN pitch is enough to collide the staff's render
 * keys and take the whole sheet down with it. Same doctrine as deserialize's
 * spot remapping: never load references to things that do not resolve.
 *
 * Mutates and returns the composition. Notes are DROPPED only when their
 * duration is unresolvable; everything else is clamped to legal.
 */
export function normalizeComposition(comp: Composition): Composition {
  if (typeof comp.name !== 'string' || comp.name.length === 0) comp.name = 'Untitled piece';
  if (!MUSIC_SCALES[comp.scale]) comp.scale = 'major';
  if (!Number.isInteger(comp.tonic) || comp.tonic < 0 || comp.tonic > 11) comp.tonic = 0;
  if (!MUSIC_METERS[comp.meter]) comp.meter = DEFAULT_METER;
  comp.bpm = tempoOf(comp);
  // A pedal off the end of the staff (a re-ruling, an old save) is dropped
  // rather than reported: it is a voice with nowhere to sound.
  const pedal = pedalOf(comp);
  comp.pedal = pedal !== null && pitchAllowed(comp, pedal) ? pedal : null;
  if (!Array.isArray(comp.bars)) comp.bars = [];
  comp.bars = comp.bars.map((bar) =>
    Array.isArray(bar)
      ? bar.filter(
          (e) =>
            e != null &&
            NOTE_DURATIONS[e.dur] !== undefined &&
            (e.pitch === null || Number.isInteger(e.pitch)),
        )
      : [],
  );
  while (comp.bars.length < BASE_BARS) comp.bars.push([]);
  if (comp.bars.length > MAX_BARS) comp.bars.splice(MAX_BARS);
  // Repeat spans that no longer point at real bars are dropped outright:
  // a span over a bar that was deleted is not a problem to report, it is a
  // mark with nothing under it.
  comp.repeats = (Array.isArray(comp.repeats) ? comp.repeats : []).filter(
    (r) =>
      r != null &&
      Number.isInteger(r.from) &&
      Number.isInteger(r.to) &&
      Number.isInteger(r.times) &&
      r.times >= 2 &&
      r.from >= 0 &&
      r.from <= r.to &&
      r.to < comp.bars.length,
  );
  return comp;
}

/** Trim repeat spans that a bar-count change has stranded (see setBarCount). */
function pruneRepeats(comp: Composition): void {
  comp.repeats = (comp.repeats ?? []).filter((r) => r.to < comp.bars.length);
}

/**
 * Everything standing between this sheet and a stage, in the player's terms.
 * Empty means performable. Level gates AND completeness live here — the
 * reading itself never checks any of this.
 */
export function checkComposition(state: GameState, comp: Composition): string[] {
  const problems: string[] = [];
  const level = musicLevel(state);
  const allowed = maxBars(level);
  if (comp.bars.length > allowed) {
    problems.push(`Your Musicianship allows ${allowed} bars; this sheet has ${comp.bars.length}.`);
  }
  if (comp.scale !== 'major' && !scalesUnlocked(level)) {
    problems.push(`Other scales need Musicianship ${MUSIC_UNLOCKS.scales}.`);
  }
  if (comp.tonic !== 0 && !tuningUnlocked(level)) {
    problems.push(`Tuning away from C needs Musicianship ${MUSIC_UNLOCKS.tuning}.`);
  }
  const meter = meterOf(comp);
  if (meter.unlockLevel > level) {
    problems.push(`${meter.name} needs Musicianship ${meter.unlockLevel}.`);
  }
  if (tempoOf(comp) !== DEFAULT_BPM && !tempoUnlocked(level)) {
    problems.push(`Setting the tempo needs Musicianship ${MUSIC_UNLOCKS.tempo}.`);
  }
  const pedalPitch = pedalOf(comp);
  if (pedalPitch !== null) {
    if (!pedalUnlocked(level)) {
      problems.push(`A pedal tone needs Musicianship ${MUSIC_UNLOCKS.pedal}.`);
    } else if (!pitchAllowed(comp, pedalPitch)) {
      problems.push('The pedal tone has fallen off the end of the staff.');
    }
  }
  const capacity = barCapacity(meter);
  comp.bars.forEach((bar, i) => {
    const used = barUnitsUsed(bar);
    if (used !== capacity) {
      problems.push(
        used < capacity
          ? `Bar ${i + 1} is unfinished (${used}/${capacity}).`
          : `Bar ${i + 1} is overfull (${used}/${capacity}).`,
      );
    }
    bar.forEach((e, j) => {
      const def = NOTE_DURATIONS[e.dur];
      if (def.unlockLevel > level) {
        problems.push(`Bar ${i + 1}: ${def.name.toLowerCase()}s need Musicianship ${def.unlockLevel}.`);
      }
      if (e.pitch !== null && !pitchAllowed(comp, e.pitch)) {
        problems.push(`Bar ${i + 1}: a note has fallen off the end of the staff.`);
      }
      if (e.tie) {
        // A tie that joins nothing is not silently ignored — the player put
        // it there on purpose and deserves to know it does nothing.
        const next = bar[j + 1] ?? comp.bars[i + 1]?.[0];
        if (!tiesUnlocked(level)) {
          problems.push(`Bar ${i + 1}: ties need Musicianship ${MUSIC_UNLOCKS.ties}.`);
        } else if (e.pitch === null) {
          problems.push(`Bar ${i + 1}: a rest cannot be tied.`);
        } else if (!next) {
          problems.push(`Bar ${i + 1}: the last note is tied into nothing.`);
        } else if (next.pitch !== e.pitch) {
          problems.push(`Bar ${i + 1}: a tie joins two notes of the same pitch.`);
        }
      }
    });
  });

  const spans = comp.repeats ?? [];
  if (spans.length > 0 && !repeatsUnlocked(level)) {
    problems.push(`Repeat marks need Musicianship ${MUSIC_UNLOCKS.repeats}.`);
  }
  spans.forEach((r, i) => {
    const where = `Repeat ${i + 1}`;
    if (r.from < 0 || r.to >= comp.bars.length || r.from > r.to) {
      problems.push(`${where} covers bars that are not on the sheet.`);
      return;
    }
    if (r.times < 2) problems.push(`${where} plays fewer than twice.`);
    if (r.from < BASE_BARS && r.to >= BASE_BARS) {
      problems.push(`${where} straddles the coda, which is read as its own piece.`);
    }
    for (let j = i + 1; j < spans.length; j++) {
      if (r.from <= spans[j].to && spans[j].from <= r.to) {
        problems.push(`${where} overlaps repeat ${j + 1}.`);
      }
    }
  });
  return problems;
}

// ---------- The classifiers (pure — state never enters) ----------

/**
 * Krumhansl-Kessler key profiles: how strongly each scale degree is felt to
 * belong, from the probe-tone experiments. The standard tables.
 */
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/**
 * Perceived agreeableness of each interval class, unison → major seventh.
 * Not physics — a rough consonance ranking, enough to separate a hymn from
 * a knife-fight of seconds and tritones.
 */
const CONSONANCE = [1, 0.15, 0.5, 0.75, 0.8, 0.85, 0.2, 0.9, 0.7, 0.75, 0.45, 0.15];

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

/**
 * Krumhansl-Schmuckler key finding: correlate the duration-weighted pitch-
 * class profile against all 24 rotated key profiles; the best fit is the key
 * and its correlation is how CLEARLY the piece is in it. Null when nothing
 * sounds at all.
 */
export function findKey(
  events: { pitch: number | null; units: number }[],
): { tonic: number; mode: 'major' | 'minor'; clarity: number } | null {
  const profile = new Array(12).fill(0);
  let sounded = 0;
  for (const e of events) {
    if (e.pitch === null) continue;
    profile[((e.pitch % 12) + 12) % 12] += e.units;
    sounded += 1;
  }
  if (sounded === 0) return null;
  let best: { tonic: number; mode: 'major' | 'minor'; r: number } | null = null;
  for (const [mode, table] of [['major', KK_MAJOR], ['minor', KK_MINOR]] as const) {
    for (let tonic = 0; tonic < 12; tonic++) {
      const rotated = Array.from({ length: 12 }, (_, pc) => table[(((pc - tonic) % 12) + 12) % 12]);
      const r = pearson(profile, rotated);
      if (!best || r > best.r + 1e-9) best = { tonic, mode, r };
    }
  }
  return best ? { tonic: best.tonic, mode: best.mode, clarity: Math.max(0, best.r) } : null;
}

/**
 * The key the staff is RULED in, scored rather than searched for: the same
 * correlation `findKey` maximises, evaluated at one point instead of all 24.
 *
 * Two things this buys. First, `mode` stops being a guess — and `mode` is
 * BINARY, so a wrong reading is a full 1.0 error on one axis, the largest
 * single term this classifier can produce. Measured over hand-transcribed
 * tunes, the search flipped 6 of 30, which is how Brahms's Wiegenlied came
 * out a dirge. When the composer has ruled the staff there is nothing to
 * guess at.
 *
 * Second, `clarity` becomes a real axis. Against the search it was close to a
 * tautology — "how well do these notes fit the key that fits them best" —
 * and it now reads as "how hard do your notes assert the key you chose",
 * which is something a composer can aim at and deliberately miss.
 */
export function keyIn(
  events: { pitch: number | null; units: number }[],
  tonic: number,
  mode: 'major' | 'minor',
): { tonic: number; mode: 'major' | 'minor'; clarity: number } | null {
  const profile = new Array(12).fill(0);
  let sounded = 0;
  for (const e of events) {
    if (e.pitch === null) continue;
    profile[((e.pitch % 12) + 12) % 12] += e.units;
    sounded += 1;
  }
  if (sounded === 0) return null;
  const table = mode === 'major' ? KK_MAJOR : KK_MINOR;
  const rotated = Array.from({ length: 12 }, (_, pc) => table[(((pc - tonic) % 12) + 12) % 12]);
  return { tonic, mode, clarity: Math.max(0, pearson(profile, rotated)) };
}

/**
 * The melody's outline. One sustained direction is a rise or a fall, one
 * turning point an arch or a valley, more than that undulating; a melody
 * that never leaves its note is level.
 */
export function contourOf(pitches: number[]): MusicContour {
  const deltas: number[] = [];
  for (let i = 1; i < pitches.length; i++) {
    const d = pitches[i] - pitches[i - 1];
    if (d !== 0) deltas.push(d);
  }
  if (deltas.length === 0) return 'level';
  let turns = 0;
  for (let i = 1; i < deltas.length; i++) {
    if (Math.sign(deltas[i]) !== Math.sign(deltas[i - 1])) turns += 1;
  }
  if (turns === 0) return deltas[0] > 0 ? 'rising' : 'falling';
  if (turns === 1) return deltas[0] > 0 ? 'arch' : 'valley';
  return 'undulating';
}

/**
 * Metric weight of a grid position within a bar of `meter` — how strong a
 * beat it is. The hierarchy, top down: the downbeat (5); the meter's own
 * declared accents (4 — 4/4's half-bar, 6/8's second pulse, 5/4's beat
 * four); any beat (3); the half-beat lattice (2); and the finer
 * subdivisions — quarter-beats, triplet and quintuplet lattices — all at 1.
 * Non-integer lattices for a given beat size simply don't exist (a 6/8
 * eighth-beat has no quarter-of-a-beat on this grid), which Number.isInteger
 * guards. THIS is where a time signature's personality lives.
 */
export function metricWeight(pos: number, meter: MusicMeterDef = MUSIC_METERS.common): number {
  const capacity = barCapacity(meter);
  const p = ((pos % capacity) + capacity) % capacity;
  if (p === 0) return 5;
  if (meter.accents.includes(p)) return 4;
  const beat = meter.beatUnits;
  if (p % beat === 0) return 3;
  if (Number.isInteger(beat / 2) && p % (beat / 2) === 0) return 2;
  // Quarter-beat, triplet and quintuplet lattices (15/20/12 under a
  // quarter-note beat) — everything finer than the half-beat weighs the same.
  for (const div of [4, 3, 5]) {
    const lattice = beat / div;
    if (Number.isInteger(lattice) && p % lattice === 0) return 1;
  }
  return 0;
}

/**
 * One SOUNDED event: what the ear receives after tied groups are folded
 * into single notes. `units` is the whole sounding length (a tie's parts
 * summed), `dur` the first written duration, `at` the absolute unit
 * position from the start of the stretch — absolute so a tie can cross a
 * barline and still be measured against the metric grid (metricWeight mods
 * by the bar, so absolute positions Just Work).
 */
export interface SoundedEvent {
  pitch: number | null;
  units: number;
  dur: NoteDurId;
  at: number;
}

/**
 * Fold written events into sounded ones. A tie is honoured only when the
 * NEXT written event is a note of the same pitch — an invalid tie (to a
 * rest, to a different pitch, off the end of the sheet) simply does not
 * join, and `checkComposition` is what tells the player about it. Reading
 * stays total: nothing here can throw on nonsense.
 */
export function soundedEvents(bars: NoteEvent[][]): SoundedEvent[] {
  const flat: NoteEvent[] = [];
  for (const bar of bars) for (const e of bar) flat.push(e);
  const out: SoundedEvent[] = [];
  let at = 0;
  for (let i = 0; i < flat.length; i++) {
    const e = flat[i];
    let units = NOTE_DURATIONS[e.dur].units;
    const start = at;
    at += units;
    // Swallow every continuation this note is tied into.
    while (
      flat[i].tie &&
      flat[i].pitch !== null &&
      flat[i + 1] &&
      flat[i + 1].pitch === flat[i].pitch
    ) {
      i += 1;
      const more = NOTE_DURATIONS[flat[i].dur].units;
      units += more;
      at += more;
    }
    out.push({ pitch: e.pitch, units, dur: e.dur, at: start });
  }
  return out;
}

/**
 * Longuet-Higgins/Lee-flavoured syncopation: a note syncopates when it
 * SOUNDS THROUGH a position stronger than the one it started on — the accent
 * arrives where no attack does. Summed over notes, normalized to 0–1. An
 * off-beat note that resolves ON the next beat is not syncopation; one that
 * ties across it is — and since ties are folded first and positions are
 * absolute, a note tied over a barline syncopates against the NEXT bar's
 * downbeat, which is the whole reason ties exist. Meter-aware: the same
 * rhythm is square in 4/4 and badly syncopated in 3/4, because the strong
 * positions moved.
 */
export function syncopationOf(
  bars: NoteEvent[][],
  meter: MusicMeterDef = MUSIC_METERS.common,
): number {
  let sum = 0;
  let notes = 0;
  for (const e of soundedEvents(bars)) {
    if (e.pitch === null) continue;
    notes += 1;
    const w0 = metricWeight(e.at, meter);
    let wMax = 0;
    for (let p = e.at + 1; p < e.at + e.units; p++) wMax = Math.max(wMax, metricWeight(p, meter));
    sum += Math.max(0, wMax - w0);
  }
  if (notes === 0) return 0;
  return Math.min(1, sum / (3 * notes));
}

/**
 * How the last gesture lands, read against the detected key — the chordless
 * melodic reading of cadence:
 *
 *  - **closed** — comes to rest on the tonic. Home.
 *  - **open** — ends on the dominant or the leading tone: a question.
 *  - **deceptive** — the dominant promises home and delivers the submediant.
 *  - **wandering** — ends somewhere with no particular opinion.
 *  - **silent** — nothing sounded at all.
 */
export function cadenceOf(
  sounded: SoundedEvent[],
  key: { tonic: number } | null,
): MusicCadence {
  const notes = sounded.filter((e) => e.pitch !== null);
  if (notes.length === 0 || !key) return 'silent';
  const degree = (p: number) => (((p - key.tonic) % 12) + 12) % 12;
  const last = degree(notes[notes.length - 1].pitch as number);
  const prev = notes.length > 1 ? degree(notes[notes.length - 2].pitch as number) : null;
  if (last === 0) return 'closed';
  if (prev === 7 && last === 9) return 'deceptive';
  if (last === 7 || last === 11) return 'open';
  return 'wandering';
}

/**
 * Motif self-similarity: slide the melody against itself and ask how often
 * it agrees. Melodic identity is the INTERVAL sequence (a figure repeated a
 * third higher still matches — that is what makes it a motif and not a
 * copy); rhythmic identity is the duration sequence of sounded notes. For
 * each lag ≥ 2 with at least two comparisons, score the agreement share;
 * the best lag wins, melodic and rhythmic halves averaged. 1 = the piece is
 * one idea, restated; 0 = it never looks back.
 */
export function motifOf(pitches: number[], durUnits: number[]): number {
  const intervals: number[] = [];
  for (let i = 1; i < pitches.length; i++) intervals.push(pitches[i] - pitches[i - 1]);
  const agreement = (seq: number[], lag: number): number | null => {
    const n = seq.length - lag;
    if (n < 2) return null;
    let hits = 0;
    for (let i = 0; i < n; i++) if (seq[i] === seq[i + lag]) hits += 1;
    return hits / n;
  };
  let best = 0;
  const maxLag = Math.floor(Math.max(intervals.length, durUnits.length) / 2);
  for (let lag = 2; lag <= maxLag; lag++) {
    // Average whichever halves have enough data — a piece too short for
    // melodic comparison can still be rhythmically an ostinato.
    const sides = [agreement(intervals, lag), agreement(durUnits, lag)].filter(
      (s): s is number => s !== null,
    );
    if (sides.length === 0) continue;
    best = Math.max(best, sides.reduce((a, b) => a + b, 0) / sides.length);
  }
  return best;
}

/** Shannon entropy of a count distribution, in bits. */
export function entropyBits(counts: number[]): number {
  const total = counts.reduce((s, v) => s + v, 0);
  if (total <= 0) return 0;
  let h = 0;
  for (const c of counts) {
    if (c <= 0) continue;
    const p = c / total;
    h -= p * Math.log2(p);
  }
  return h;
}

export interface MusicAnalysis {
  /** Sounded notes (rests excluded). */
  notes: number;
  key: { tonic: number; mode: 'major' | 'minor'; clarity: number } | null;
  contour: MusicContour;
  /** Melodic span in semitones. */
  range: number;
  /** Share of stepwise motion (intervals of a tone or less). */
  conjunct: number;
  motion: 'conjunct' | 'mixed' | 'disjunct';
  consonance: number;
  syncopation: number;
  /** Normalized 0–1 (against log2 of the full alphabet). */
  pitchEntropy: number;
  rhythmEntropy: number;
  /** Mean sounded notes per bar. */
  density: number;
  /** Share of the written units that are silence. */
  restRatio: number;
  /** Motif self-similarity (see motifOf): 1 = one idea restated, 0 = never looks back. */
  motif: number;
  /** How the last gesture lands against the key (see cadenceOf). */
  cadence: MusicCadence;
  /** The tempo this was read at — the one input not found in the notes. */
  bpm: number;
  /** The pedal tone it was read against, if any. */
  pedal: number | null;
  /** Vertical consonance against that pedal; 0.5 when there is none. */
  harmony: number;
}

const DUR_IDS = Object.keys(NOTE_DURATIONS) as NoteDurId[];

/**
 * Run every classifier over a stretch of bars. Pure and total. The meter
 * feeds syncopation (its accent table decides what "off the beat" means)
 * and keeps density meter-fair: notes per COMMON-BAR-EQUIVALENT of written
 * time, so a waltz is not called sparse for having shorter bars.
 */
export function analyzeBars(
  bars: NoteEvent[][],
  meter: MusicMeterDef = MUSIC_METERS.common,
  bpm: number = DEFAULT_BPM,
  pedal: number | null = null,
  /**
   * The key the staff is ruled in, when the scale declares a mode. Present =
   * taken as given and only its CLARITY is measured; absent (a chromatic
   * ruling, or a caller with no composition in hand) = the 24-way search.
   * Still pure — this is a fact about the sheet, not about the player.
   */
  ruling: { tonic: number; mode: 'major' | 'minor' } | null = null,
): MusicAnalysis {
  // SOUNDED events, not written ones: a tied pair is one note with one
  // pitch, so a tie can never fabricate a unison interval or inflate the
  // note count. Rhythmic VOCABULARY (below) still reads what is written.
  const sounded = soundedEvents(bars);
  const flat: { pitch: number | null; units: number; dur: NoteDurId }[] = [];
  for (const bar of bars) for (const e of bar) flat.push({ pitch: e.pitch, units: NOTE_DURATIONS[e.dur].units, dur: e.dur });
  const pitches = sounded.filter((e) => e.pitch !== null).map((e) => e.pitch as number);
  const totalUnits = flat.reduce((s, e) => s + e.units, 0);
  const restUnits = flat.filter((e) => e.pitch === null).reduce((s, e) => s + e.units, 0);

  // Interval content: consonance and conjunct motion, over consecutive notes.
  let consSum = 0;
  let steps = 0;
  const intervals = pitches.length - 1;
  for (let i = 1; i < pitches.length; i++) {
    const d = Math.abs(pitches[i] - pitches[i - 1]);
    consSum += CONSONANCE[d % 12];
    if (d <= 2) steps += 1;
  }
  // A single held tone has nothing to disagree with itself about.
  const consonance = intervals > 0 ? consSum / intervals : 0.75;
  const conjunct = intervals > 0 ? steps / intervals : 1;

  const pcCounts = new Array(12).fill(0);
  for (const p of pitches) pcCounts[((p % 12) + 12) % 12] += 1;
  const durCounts = DUR_IDS.map((id) => flat.filter((e) => e.dur === id).length);

  // Key reads SOUNDED lengths, so a note held over a tie weighs what it
  // actually occupies in the ear rather than what its first head says —
  // and a PEDAL joins the profile at the full length it sounds for, which
  // is why laying one under a piece genuinely pulls the key toward it.
  // That is not a side effect; it is what drones do to ears.
  const profile = pedal === null ? sounded : [...sounded, { pitch: pedal, units: totalUnits }];
  const key = ruling ? keyIn(profile, ruling.tonic, ruling.mode) : findKey(profile);
  return {
    notes: pitches.length,
    key,
    contour: contourOf(pitches),
    range: pitches.length > 0 ? Math.max(...pitches) - Math.min(...pitches) : 0,
    conjunct,
    motion: conjunct >= 0.7 ? 'conjunct' : conjunct >= 0.4 ? 'mixed' : 'disjunct',
    consonance,
    syncopation: syncopationOf(bars, meter),
    pitchEntropy: entropyBits(pcCounts) / Math.log2(12),
    rhythmEntropy: entropyBits(durCounts) / Math.log2(DUR_IDS.length),
    density: totalUnits > 0 ? pitches.length / (totalUnits / BAR_UNITS) : 0,
    restRatio: totalUnits > 0 ? restUnits / totalUnits : 1,
    motif: motifOf(pitches, sounded.filter((e) => e.pitch !== null).map((e) => e.units)),
    cadence: cadenceOf(sounded, key),
    bpm,
    pedal,
    harmony: harmonyAgainst(sounded, pedal),
  };
}

// ---------- Naming what was heard ----------

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** The analysis flattened onto the archetype axes, all 0–1. */
export function axisValues(a: MusicAnalysis): Record<MusicAxis, number> {
  return {
    mode: a.key ? (a.key.mode === 'major' ? 1 : 0) : 0.5,
    clarity: a.key ? clamp01(a.key.clarity) : 0,
    consonance: clamp01(a.consonance),
    syncopation: clamp01(a.syncopation),
    pitchEntropy: clamp01(a.pitchEntropy),
    rhythmEntropy: clamp01(a.rhythmEntropy),
    density: clamp01(a.density / 16),
    restRatio: clamp01(a.restRatio),
    conjunct: clamp01(a.conjunct),
    range: clamp01(a.range / 12),
    motif: clamp01(a.motif),
    pace: paceOf(a.bpm),
    harmony: clamp01(a.harmony),
  };
}

export interface MusicMatch {
  archetype: MusicArchetypeDef;
  distance: number;
  /** 0–1: how purely the piece is what it is. */
  purity: number;
}

/**
 * Nearest-centroid classification over each archetype's declared axes.
 * Weighted RMS distance in the unit cube, with a small discount when the
 * contour matches. Total: there is always a nearest.
 */
export function classify(analysis: MusicAnalysis): MusicMatch[] {
  const values = axisValues(analysis);
  const matches = Object.values(MUSIC_ARCHETYPES).map((def) => {
    let num = 0;
    let den = 0;
    for (const [axis, target] of Object.entries(def.target) as [MusicAxis, number][]) {
      const w = def.weights?.[axis] ?? 1;
      num += w * (values[axis] - target) ** 2;
      den += w;
    }
    let distance = den > 0 ? Math.sqrt(num / den) : 1;
    if (def.contours?.includes(analysis.contour)) distance = Math.max(0, distance - CONTOUR_AFFINITY);
    if (def.cadences?.includes(analysis.cadence)) distance = Math.max(0, distance - CADENCE_AFFINITY);
    return { archetype: def, distance, purity: clamp01(1 - distance * 1.5) };
  });
  return matches.sort((a, b) => a.distance - b.distance);
}

export interface MusicReading {
  /** How bars 1–4 read — the performance's identity. */
  theme: MusicMatch;
  /** Runners-up on the theme, for the chart-filling instinct. */
  ranked: MusicMatch[];
  themeAnalysis: MusicAnalysis;
  /**
   * How bars 5+ read, when present. The same archetype again is a REPRISE —
   * it magnifies the whole. A different one is a TURN — the piece changes
   * direction (the breakdown), and the coda's archetype colours the effect.
   */
  coda: { match: MusicMatch; relation: 'reprise' | 'turn'; bars: number } | null;
  /**
   * Magnitude scalar for the eventual effects — notes played, scaled by how
   * purely the theme reads, magnified by a reprise. Dormant until effects
   * ship, but computed and shown so composing against it is learnable now.
   */
  power: number;
}

/**
 * What a composition IS, as a string — the sheet's identity, independent of
 * which slot it occupies or what the player called it.
 *
 * This is the music system's answer to `carvedKey`, `spellKey` and
 * `shapeKey`, and it carries the same two properties. It is **canonical**:
 * two sheets that read the same produce the same key, so the id and the name
 * are absent, invalid repeat spans are dropped, and the surviving spans are
 * sorted. And it is **reconstructible**: hand somebody this string and they
 * have the piece, which is what makes a composition shareable without a
 * registry.
 *
 * The rule for changing it: a field belongs in the key **iff the reading
 * consumes it**. Everything `readComposition` touches is here — scale and
 * tonic (they rule the key, see `keyIn`), meter, tempo, pedal, the written
 * bars including ties, and the repeat spans. Add an input to the reading and
 * it must be added here in the same commit, or two pieces that sound
 * different will claim to be the same piece.
 *
 * Normalised values are used deliberately (`meterOf`, `tempoOf`, `pedalOf`),
 * so a sheet saved before meters existed keys identically to the same sheet
 * with `meter: 'common'` written out — they read identically, so they are
 * identical.
 *
 * Durations go in by ID, never by units: the grid was rescaled once already
 * (48 → 60, when quintuplets forced a factor of five) and ids were what
 * survived it. If the key is ever needed in a compact form, HASH it — do not
 * shorten the encoding, or that stability is lost.
 */
export function compositionKey(comp: Composition): string {
  const bars = comp.bars
    .map((bar) => bar.map((e) => `${e.dur}.${e.pitch ?? 'r'}${e.tie ? '~' : ''}`).join(','))
    .join('/');
  const repeats = validRepeats(comp)
    .map((r) => `${r.from}-${r.to}x${r.times}`)
    .join('+');
  const pedal = pedalOf(comp);
  return (
    `${comp.scale}:${comp.tonic}` +
    `/${meterOf(comp).id}@${tempoOf(comp)}` +
    (pedal === null ? '' : `~${pedal}`) +
    `|${bars}` +
    (repeats ? `#${repeats}` : '')
  );
}

/** Read a whole composition: theme, coda relation, and the dormant power scalar. */
export function readComposition(comp: Composition): MusicReading {
  const meter = meterOf(comp);
  // The reading is of what is PERFORMED, not what is written: repeats are
  // unrolled first, so a repeated figure raises motif exactly as honestly
  // as writing it out twice would. Spans never straddle the boundary, so
  // the expanded theme bars stay contiguous and the split is still clean.
  const bpm = tempoOf(comp);
  const pedal = pedalOf(comp);
  const { bars, source } = expandRepeats(comp);
  const themeBars = bars.filter((_, i) => source[i] < BASE_BARS);
  const codaBars = bars.filter((_, i) => source[i] >= BASE_BARS);
  // The staff was ruled by the composer, so the key is DECLARED, not deduced
  // — except under a chromatic scale, which declares no mode and is guessed
  // at as before. See keyIn.
  const scaleMode = MUSIC_SCALES[comp.scale]?.mode;
  const ruling = scaleMode ? { tonic: comp.tonic, mode: scaleMode } : null;
  const themeAnalysis = analyzeBars(themeBars, meter, bpm, pedal, ruling);
  const ranked = classify(themeAnalysis);
  const theme = ranked[0];

  let coda: MusicReading['coda'] = null;
  let magnify = 1;
  if (codaBars.length > 0) {
    const match = classify(analyzeBars(codaBars, meter, bpm, pedal, ruling))[0];
    const relation = match.archetype.id === theme.archetype.id ? 'reprise' : 'turn';
    if (relation === 'reprise') magnify = 1 + 0.25 * codaBars.length;
    coda = { match, relation, bars: codaBars.length };
  }

  // Weighted, not raw: a tied group is one attack and each replay pays 1/n
  // (see weightedAttacks) — which is what stops a repeat mark being free
  // power. Rounded to a tenth, as the panel shows it.
  const attacks = weightedAttacks(comp);
  const power = Math.round(attacks * (0.5 + 0.5 * theme.purity) * magnify * 10) / 10;
  return { theme, ranked, themeAnalysis, coda, power };
}

/** "C♯ minor", or null when nothing sounds. */
export function keyName(analysis: MusicAnalysis): string | null {
  return analysis.key ? `${TONIC_NAMES[analysis.key.tonic]} ${analysis.key.mode}` : null;
}

/**
 * The effects a finished reading confers, as ordinary status applications.
 * Pure — the caller decides who the bearer is (the player today; a monster
 * bard tomorrow, `applyStatuses` being side-agnostic). The theme speaks at
 * full power; a TURN coda adds its own archetype's colour, scaled by the
 * share of the sheet it occupies times how purely it reads. A reprise never
 * adds a second effect — its magnification is already inside `power`.
 */
/**
 * How many readings a performer can voice at once, and how loudly the extra
 * ones speak. Musicianship's ONLY lever on the effect, and deliberately a
 * discrete rung rather than a scalar — "I play two-voiced" is a legible thing
 * to have become, where a hidden 7% is not.
 */
export interface PerformanceVoices {
  /** Runners-up voiced beneath the theme. 0 = the theme alone. */
  extra: number;
  /** The flat share each of them speaks at. */
  share: number;
}

export const SINGLE_VOICE: PerformanceVoices = { extra: 0, share: 0 };

/** Musicianship levels at which one more voice opens. */
export const VOICE_LADDER = [20, 45];
/** What a voiced runner-up is worth. Tuning; that it is FLAT is not. */
export const VOICE_SHARE = 0.3;

/** What the performer can voice at this level of Musicianship. */
export function voicesFor(level: number): PerformanceVoices {
  let extra = 0;
  for (const rung of VOICE_LADDER) {
    if (level >= rung) extra += 1;
  }
  return { extra, share: VOICE_SHARE };
}

export function conferredBy(
  reading: MusicReading,
  totalBars: number,
  voices: PerformanceVoices = SINGLE_VOICE,
): StatusApplication[] {
  const out: StatusApplication[] = [];
  const spoken = new Set<string>();
  const add = (match: MusicMatch, share: number) => {
    const c = match.archetype.confers;
    if (!c || spoken.has(match.archetype.id)) return;
    spoken.add(match.archetype.id);
    out.push({
      id: c.status,
      intensity: Math.max(1, Math.round(reading.power * share * c.perPower)),
      ...(c.duration !== undefined ? { duration: c.duration } : {}),
    });
  };
  add(reading.theme, 1);
  if (reading.coda && reading.coda.relation === 'turn' && totalBars > 0) {
    add(reading.coda.match, (reading.coda.bars / totalBars) * reading.coda.match.purity);
  }
  /*
   * WHAT THE PERFORMER DRAWS OUT — the runners-up, at a flat share.
   *
   * The piece is still unambiguously its theme; a skilled player simply gets
   * more of what was already latent in it out of the instrument. Identity is
   * untouched (`reading.theme` decided it long before this), so the same sheet
   * in worse hands is the same song, quieter.
   *
   * ⚠️ The share is FLAT and comes from the performer alone. It must never be
   * derived from `distance` or `purity`: archetypes cluster — several read
   * closely on the same sheet by their nature — so a closeness-scaled bleed
   * would hand free effects to naturally-adjacent archetypes and none at all
   * to isolated ones, making it a property of the map rather than of the hands.
   */
  for (let i = 1; i <= voices.extra; i++) {
    const runnerUp = reading.ranked[i];
    if (runnerUp) add(runnerUp, voices.share);
  }
  return out;
}

/** How a cadence sounds, said plainly — for logs and tooltips. */
export const CADENCE_WORDS: Record<MusicCadence, string> = {
  closed: 'ends on the tonic',
  open: 'ends on the 5th or the leading tone',
  deceptive: 'goes from the 5th to the 6th at the end',
  wandering: 'ends on another note',
  silent: 'no notes sounded',
};

/** One line for the log and the bench: what the world just heard. */
export function describeReading(reading: MusicReading): string {
  const name = reading.theme.archetype.name.toLowerCase();
  const article = /^[aeiou]/.test(name) ? 'an' : 'a';
  const key = keyName(reading.themeAnalysis);
  let line = `${article} ${name}${key ? ` in ${key}` : ''}`;
  if (reading.coda) {
    line +=
      reading.coda.relation === 'reprise'
        ? ', its coda swelling the theme'
        : `, turning ${/^[aeiou]/.test(reading.coda.match.archetype.name) ? 'into an' : 'into a'} ${reading.coda.match.archetype.name.toLowerCase()} at the last`;
  }
  return line;
}

// ---------- The stage (benchWork's sibling) ----------

export function startPerformance(state: GameState, bus: EventBus, compositionId: number): boolean {
  const comp = state.compositions.find((c) => c.id === compositionId);
  if (!comp) return false;
  if (state.travel) {
    bus.emit({ type: 'log', msg: text('music.reason.travelling'), kind: 'danger' });
    return false;
  }
  if (state.combat) {
    bus.emit({ type: 'log', msg: text('music.reason.no_moment'), kind: 'danger' });
    return false;
  }
  const problems = checkComposition(state, comp);
  if (problems.length > 0) {
    bus.emit({ type: 'log', msg: text('music.reason.problem', { problem: problems[0] }), kind: 'danger' });
    return false;
  }

  // The stage is the activity now — same exclusivity a bench claims.
  state.activity = null;
  state.activityProgress = 0;
  state.benchWork = null;
  state.travelPlan = [];
  state.travelIntent = null;

  const ticksTotal = performanceTicks(comp);
  state.performance = { compositionId, spot: state.spot, ticksLeft: ticksTotal, ticksTotal };
  bus.emit({ type: 'log', msg: text('music.started', { name: comp.name }), kind: 'action' });
  return true;
}

export function stopPerformance(state: GameState, bus: EventBus, reason?: string): void {
  if (!state.performance) return;
  state.performance = null;
  bus.emit({ type: 'log', msg: text('music.stopped', { reason: reason ? text('music.stop_reason', { reason }) : '' }), kind: 'action' });
}

/**
 * One tick on the stage. Practice trickles in every tick (and is how the
 * skill first manifests); the piece pays out only if it is carried to the
 * end — a set cut short teaches the fingers, never the crowd.
 */
export function tickPerformance(state: GameState, bus: EventBus): void {
  const perf = state.performance;
  if (!perf) return;
  if (state.spot !== perf.spot || state.travel) {
    stopPerformance(state, bus, 'you left the location');
    return;
  }
  if (state.combat) {
    stopPerformance(state, bus, 'combat started');
    return;
  }
  const comp = state.compositions.find((c) => c.id === perf.compositionId);
  if (!comp) {
    state.performance = null;
    return;
  }

  checkDiscovery(state, bus, ['music']);
  grantSkillXp(state, bus, ['music'], MUSIC_XP_PER_TICK);

  perf.ticksLeft -= 1;
  if (perf.ticksLeft > 0) return;

  state.performance = null;
  const reading = readComposition(comp);
  // XP rides the same weighted count as power, so a repeat mark is not an
  // XP farm either — the tenth pass through the same bar teaches a tenth.
  const attacks = weightedAttacks(comp);
  grantSkillXp(state, bus, ['music'], attacks * MUSIC_XP_PER_NOTE * (0.5 + 0.5 * reading.theme.purity));
  bumpStat(state, bus, 'music:performances');
  bumpStat(state, bus, `music:performed:${reading.theme.archetype.id}`);
  bus.emit({
    type: 'log',
    msg: text('music.classified', { icon: reading.theme.archetype.icon, name: comp.name, reading: describeReading(reading) }),
    kind: 'action',
  });
  // The music does what its kind of music does: archetype-conferred
  // conditions, landing through the same door as every other affliction.
  // Musicianship's one lever: how many of the reading's voices actually sound.
  const landed = applyStatuses(
    state,
    state,
    conferredBy(reading, comp.bars.length, voicesFor(state.skills[MUSICIANSHIP_ID]?.level ?? 0)),
    comp.name,
  );
  if (landed.length > 0) {
    const names = landed.map((i) => {
      const def = STATUSES[i.id];
      return `${def?.icon ?? '🎶'} ${def?.name ?? i.id}`;
    });
    bus.emit({ type: 'log', msg: text('music.lingers', { names: names.join(', ') }), kind: 'action' });
  }
}
