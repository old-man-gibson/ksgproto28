import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { EventBus } from '../src/core/engine/events';
import { migrate } from '../src/core/save/migrations';
import { deserialize, serialize } from '../src/core/save/save';
import type { Composition, GameState, NoteDurId, NoteEvent } from '../src/core/types';
import {
  addEvent,
  addRepeat,
  allowedDurations,
  allowedPitches,
  analyzeBars,
  axisValues,
  barCapacity,
  barUnitsUsed,
  checkComposition,
  expandRepeats,
  harmonyAgainst,
  classify,
  compositionKey,
  conferredBy,
  contourOf,
  createComposition,
  deleteComposition,
  findKey,
  maxBars,
  mergeEvents,
  metricWeight,
  motifOf,
  moveEvent,
  MUSICIANSHIP_ID,
  normalizeComposition,
  performanceTicks,
  pitchAllowed,
  readComposition,
  repeatAt,
  setBarCount,
  setMeter,
  setPedal,
  setRepeatTimes,
  setTempo,
  soundedEvents,
  tempoOf,
  splitEvent,
  startPerformance,
  syncopationOf,
  tickPerformance,
  toggleTie,
  weightedAttacks,
} from '../src/core/systems/music';
import {
  BAR_UNITS,
  BASE_BARS,
  DEFAULT_BPM,
  MAX_BPM,
  MIN_BPM,
  MUSIC_ARCHETYPES,
  MUSIC_METERS,
  MUSIC_UNLOCKS,
  NOTE_DURATIONS,
  ticksPerUnit,
  TICKS_PER_BAR,
  TICKS_PER_UNIT,
} from '../src/core/data/music.data';
import { SKILLS } from '../src/core/registry';

function world(level?: number) {
  const state = createInitialState();
  if (level !== undefined) state.skills[MUSICIANSHIP_ID] = { level, xp: 0 };
  return { state, bus: new EventBus() };
}

const note = (pitch: number, dur: NoteDurId = 'quarter'): NoteEvent => ({ dur, pitch });
const rest = (dur: NoteDurId = 'quarter'): NoteEvent => ({ dur, pitch: null });

/** Fill every bar of a fresh composition with one whole note on the tonic. */
function droneSheet(state: GameState) {
  const comp = createComposition(state);
  for (const bar of comp.bars) bar.push(note(0, 'whole'));
  return comp;
}

describe('the unlock ladder', () => {
  it('opens with whole and half notes only', () => {
    expect(allowedDurations(0).sort()).toEqual(['half', 'whole']);
  });

  it('hands over finer notes level by level, to a floor of sixteenths', () => {
    expect(allowedDurations(MUSIC_UNLOCKS.quarter)).toContain('quarter');
    expect(allowedDurations(MUSIC_UNLOCKS.quarter)).not.toContain('eighth');
    expect(allowedDurations(MUSIC_UNLOCKS.eighth)).toContain('eighth');
    expect(allowedDurations(MUSIC_UNLOCKS.tuplets)).toContain('tripletEighth');
    expect(allowedDurations(MUSIC_UNLOCKS.sixteenth)).toContain('sixteenth');
  });

  it('grows the sheet from four bars to eight', () => {
    expect(maxBars(0)).toBe(4);
    expect(maxBars(MUSIC_UNLOCKS.bar5)).toBe(5);
    expect(maxBars(MUSIC_UNLOCKS.bar8)).toBe(8);
  });

  it('is worn by the skill as tier names', () => {
    const def = SKILLS[MUSICIANSHIP_ID];
    expect(def).toBeDefined();
    expect(def.tierNames?.some((t) => t.level === MUSIC_UNLOCKS.scales)).toBe(true);
  });
});

describe('the sheet grammar', () => {
  it('refuses locked durations, overfull bars and off-scale pitches', () => {
    const { state } = world(0);
    const comp = createComposition(state);
    expect(addEvent(state, comp, 0, 'quarter', 0)).toMatch(/Musicianship 5/);
    expect(addEvent(state, comp, 0, 'whole', 0)).toBeNull();
    expect(addEvent(state, comp, 0, 'half', 0)).toMatch(/No room/);
    // C♯ is not in a C-major RULING, but the staff holds it all the same —
    // that is what an accidental is for (see 'the staff reaches what the
    // scale does not name'). Only the ends of the staff are a wall.
    expect(addEvent(state, comp, 1, 'half', 1)).toBeNull();
    comp.bars[1].length = 0;
    // Rests fill bars like sound does.
    expect(addEvent(state, comp, 1, 'half', null)).toBeNull();
    expect(barUnitsUsed(comp.bars[1])).toBe(120);
  });

  it('checkComposition names every unfinished bar, and clears when the sheet is full', () => {
    const { state } = world(0);
    const comp = createComposition(state);
    expect(checkComposition(state, comp)).toHaveLength(4);
    for (const bar of comp.bars) bar.push(note(0, 'whole'));
    expect(checkComposition(state, comp)).toEqual([]);
  });

  it('every duration is a whole number of units, no longer than a common bar', () => {
    // Dotted notes deliberately do NOT divide the bar (90 ∤ 240) — the
    // invariant is grid integrality, not divisibility.
    for (const def of Object.values(NOTE_DURATIONS)) {
      expect(Number.isInteger(def.units)).toBe(true);
      expect(def.units).toBeGreaterThan(0);
      expect(def.units).toBeLessThanOrEqual(BAR_UNITS);
    }
  });

  it('the notation arithmetic holds: dots are ×1.5, tuplets cram', () => {
    const d = NOTE_DURATIONS;
    expect(d.dottedHalf.units).toBe(d.half.units * 1.5);
    expect(d.dottedQuarter.units).toBe(d.quarter.units * 1.5);
    expect(d.dottedEighth.units).toBe(d.eighth.units * 1.5);
    // Three triplet feels in the time of two straight ones.
    expect(d.tripletQuarter.units * 3).toBe(d.quarter.units * 2);
    expect(d.tripletEighth.units * 3).toBe(d.eighth.units * 2);
    // Five quintuplets in the time of four.
    expect(d.quintupletEighth.units * 5).toBe(d.eighth.units * 4);
    expect(d.quintupletSixteenth.units * 5).toBe(d.sixteenth.units * 4);
  });
});

describe('the staff reaches what the scale does not name', () => {
  it('is ruled over two octaves', () => {
    const { state } = world(0);
    const comp = createComposition(state);
    const rows = allowedPitches(comp);
    expect(rows[0]).toBe(0);
    expect(rows[rows.length - 1]).toBe(24); // two octaves up from the tonic
    expect(rows).toContain(12);
  });

  it('accepts CHROMATIC pitches — a tritone is writable in C major', () => {
    const { state } = world(0);
    const comp = createComposition(state);
    expect(allowedPitches(comp)).not.toContain(6); // F♯ is not in the ruling…
    expect(pitchAllowed(comp, 6)).toBe(true); // …but the staff can still hold it
    expect(addEvent(state, comp, 0, 'whole', 6)).toBeNull();
    expect(comp.bars[0][0].pitch).toBe(6);
    expect(checkComposition(state, comp).some((p) => /staff/.test(p))).toBe(false);
  });

  it('still refuses pitches off the ends of the staff', () => {
    const { state } = world(0);
    const comp = createComposition(state);
    expect(pitchAllowed(comp, -1)).toBe(false);
    expect(pitchAllowed(comp, 25)).toBe(false);
    expect(addEvent(state, comp, 0, 'whole', 30)).toMatch(/off the end/);
  });

  it('a chromatic melody classifies without complaint — reading stays total', () => {
    const chromatic = analyzeBars([[0, 1, 2, 3].map((p) => note(p, 'quarter'))]);
    expect(chromatic.notes).toBe(4);
    expect(classify(chromatic)[0].archetype).toBeDefined();
  });
});

describe('the classifiers are pure functions of the sheet', () => {
  it('Krumhansl-Schmuckler hears C major in a C major scale', () => {
    const bar = [0, 2, 4, 5, 7, 9, 11, 12].map((p) => note(p, 'eighth'));
    const key = findKey(bar.map((e) => ({ pitch: e.pitch, units: 6 })));
    expect(key).not.toBeNull();
    expect(key!.tonic).toBe(0);
    expect(key!.mode).toBe('major');
    expect(key!.clarity).toBeGreaterThan(0.5);
  });

  it('hears A minor when the leading tone points at A', () => {
    // A harmonic-minor rise dwelling on A: the G♯ is what settles the argument.
    const events = [
      { pitch: 9, units: 24 },
      { pitch: 11, units: 6 },
      { pitch: 12, units: 6 },
      { pitch: 14, units: 6 },
      { pitch: 16, units: 12 },
      { pitch: 17, units: 6 },
      { pitch: 20, units: 6 },
      { pitch: 21, units: 24 },
    ];
    const key = findKey(events);
    expect(key).not.toBeNull();
    expect(key!.tonic).toBe(9);
    expect(key!.mode).toBe('minor');
  });

  it('classifies contours: rise, fall, arch, valley, level, undulation', () => {
    expect(contourOf([0, 2, 4, 5, 7])).toBe('rising');
    expect(contourOf([7, 5, 4, 2, 0])).toBe('falling');
    expect(contourOf([0, 4, 7, 4, 0])).toBe('arch');
    expect(contourOf([7, 4, 0, 4, 7])).toBe('valley');
    expect(contourOf([5, 5, 5])).toBe('level');
    expect(contourOf([0, 4, 2, 7, 4, 9])).toBe('undulating');
  });

  it('weights the metric grid downbeat-first (common time)', () => {
    expect(metricWeight(0)).toBe(5);
    expect(metricWeight(120)).toBe(4); // the half-bar accent
    expect(metricWeight(60)).toBe(3); // any beat
    expect(metricWeight(30)).toBe(2); // off-beat eighths
    expect(metricWeight(15)).toBe(1); // sixteenth lattice
    expect(metricWeight(20)).toBe(1); // triplet lattice
    expect(metricWeight(12)).toBe(1); // quintuplet lattice
    expect(metricWeight(7)).toBe(0); // off every lattice
  });

  it('each meter carries its own heartbeat', () => {
    // 3/4 has no secondary accent — beats two and three are just beats.
    expect(metricWeight(60, MUSIC_METERS.waltz)).toBe(3);
    expect(metricWeight(120, MUSIC_METERS.waltz)).toBe(3);
    // 6/8 holds the same 180 units but swings on its midpoint...
    expect(metricWeight(90, MUSIC_METERS.compound)).toBe(4);
    // ...where 3/4 hears nothing special at all (90 is an off-beat there).
    expect(metricWeight(90, MUSIC_METERS.waltz)).toBe(2);
    // 5/4 as three-then-two: beat four is the limp's second footfall.
    expect(metricWeight(180, MUSIC_METERS.quintuple)).toBe(4);
  });

  it('hears no syncopation in four square quarters, and some in a tied off-beat', () => {
    const square = [[note(0), note(2), note(4), note(5)]];
    expect(syncopationOf(square)).toBe(0);
    // An eighth rest, then a quarter sounding THROUGH beat two.
    const tied = [[rest('eighth'), note(0), note(2), note(4), note(5, 'eighth')]];
    expect(syncopationOf(tied)).toBeGreaterThan(0);
  });

  it('entropy: a single repeated pitch carries no information', () => {
    const flat = analyzeBars([[note(0, 'whole')], [note(0, 'whole')]]);
    expect(flat.pitchEntropy).toBe(0);
    expect(flat.rhythmEntropy).toBe(0);
    const busy = analyzeBars([[0, 11, 2, 9, 4, 7, 5, 12].map((p) => note(p, 'eighth'))]);
    expect(busy.pitchEntropy).toBeGreaterThan(0.5);
  });

  it('classification is TOTAL: even a silent sheet reads as something', () => {
    const silent = classify(analyzeBars([[], [], [], []]));
    expect(silent.length).toBeGreaterThan(0);
    expect(silent[0].archetype).toBeDefined();
    for (let i = 1; i < silent.length; i++) {
      expect(silent[i].distance).toBeGreaterThanOrEqual(silent[i - 1].distance);
    }
    for (const m of silent) {
      expect(m.purity).toBeGreaterThanOrEqual(0);
      expect(m.purity).toBeLessThanOrEqual(1);
    }
  });

  it('one long-held note is a drone — the dry name for the degenerate corner', () => {
    const { state } = world(0);
    const comp = droneSheet(state);
    const reading = readComposition(comp);
    expect(reading.theme.archetype.id).toBe('drone');
  });
});

describe('the coda: bars five and up', () => {
  it('a coda in the theme is a reprise, and magnifies', () => {
    const { state } = world(MUSIC_UNLOCKS.bar5);
    const comp = droneSheet(state);
    const plain = readComposition(comp).power;
    comp.bars.push([note(0, 'whole')]);
    const reading = readComposition(comp);
    expect(reading.coda?.relation).toBe('reprise');
    expect(reading.power).toBeGreaterThan(plain);
  });

  it('a coda that reads differently is a turn, not a magnifier', () => {
    const { state } = world(MUSIC_UNLOCKS.bar5);
    const comp = droneSheet(state);
    comp.bars.push([0, 11, 2, 9, 4, 7, 5, 12].map((p) => note(p, 'eighth')));
    const reading = readComposition(comp);
    expect(reading.coda?.relation).toBe('turn');
    expect(reading.coda?.match.archetype.id).not.toBe('drone');
  });
});

describe('the stage', () => {
  it('performing claims the player whole, runs the clock, and pays out at the end', () => {
    const { state, bus } = world();
    const comp = droneSheet(state);
    state.activity = 'something';
    expect(startPerformance(state, bus, comp.id)).toBe(true);
    expect(state.activity).toBeNull();
    expect(state.performance?.ticksTotal).toBe(4 * TICKS_PER_BAR);

    for (let i = 0; i < 4 * TICKS_PER_BAR; i++) tickPerformance(state, bus);

    expect(state.performance).toBeNull();
    // The stage is the teacher: the skill manifested from the first tick.
    expect(state.skills[MUSICIANSHIP_ID]).toBeDefined();
    expect(state.stats['music:performances']).toBe(1);
    expect(state.stats['music:performed:drone']).toBe(1);
  });

  it('refuses an unfinished sheet', () => {
    const { state, bus } = world(0);
    const comp = createComposition(state);
    expect(startPerformance(state, bus, comp.id)).toBe(false);
    expect(state.performance).toBeNull();
  });

  it('combat cuts the set short with no payout', () => {
    const { state, bus } = world();
    const comp = droneSheet(state);
    startPerformance(state, bus, comp.id);
    tickPerformance(state, bus);
    state.combat = {} as GameState['combat'];
    tickPerformance(state, bus);
    expect(state.performance).toBeNull();
    expect(state.stats['music:performances']).toBeUndefined();
  });

  it('tearing up the sheet mid-set stops the performance', () => {
    const { state, bus } = world();
    const comp = droneSheet(state);
    startPerformance(state, bus, comp.id);
    deleteComposition(state, bus, comp.id);
    expect(state.performance).toBeNull();
    expect(state.compositions).toHaveLength(0);
  });
});

describe('motif: does the melody look back?', () => {
  it('a figure restated scores near 1; a wander scores low', () => {
    const figure = [0, 4, 7, 4];
    const restated = motifOf([...figure, ...figure, ...figure], Array(12).fill(60));
    expect(restated).toBeGreaterThanOrEqual(0.9);
    const wander = motifOf(
      [0, 11, 2, 9, 4, 7, 5, 12],
      // Every length distinct — a rhythm that repeats at SOME lag would
      // honestly raise the score, which is the measure working, not failing.
      [60, 30, 120, 15, 90, 20, 45, 240],
    );
    expect(wander).toBeLessThan(0.4);
  });

  it('is a classifier axis: analysis carries it, archetypes may target it', () => {
    const { state } = world(0);
    const a = analyzeBars(droneSheet(state).bars);
    expect(a.motif).toBeGreaterThan(0.9); // one idea, restated — literally
    expect(MUSIC_ARCHETYPES.incantation.target.motif).toBeDefined();
  });
});

describe('editing: split, merge, move', () => {
  it('right-splitting halves an event in place, twice over splits again', () => {
    const { state } = world(0);
    const comp = droneSheet(state);
    expect(splitEvent(state, comp, 0, 0)).toBeNull();
    expect(comp.bars[0].map((e) => e.dur)).toEqual(['half', 'half']);
    expect(comp.bars[0].every((e) => e.pitch === 0)).toBe(true);
  });

  it('splitting never sneaks past the ladder', () => {
    const { state } = world(MUSIC_UNLOCKS.eighth);
    const comp = createComposition(state);
    comp.bars[0].push(note(0, 'eighth'));
    expect(splitEvent(state, comp, 0, 0)).toMatch(/Musicianship 24/);
    state.skills[MUSICIANSHIP_ID] = { level: 30, xp: 0 };
    expect(splitEvent(state, comp, 0, 0)).toBeNull();
    expect(splitEvent(state, comp, 0, 0)).toMatch(/splits no further/);
  });

  it('adjacent notes merge into their sum, keeping the target pitch', () => {
    const { state } = world(MUSIC_UNLOCKS.quarter);
    const comp = createComposition(state);
    comp.bars[0].push(note(0, 'quarter'), note(4, 'quarter'));
    expect(mergeEvents(state, comp, 0, 0, 1)).toBeNull();
    expect(comp.bars[0]).toEqual([{ dur: 'half', pitch: 4 }]);
  });

  it('a quarter and an eighth merge into a dotted quarter — the dot earning its keep', () => {
    const { state } = world(MUSIC_UNLOCKS.eighth);
    const comp = createComposition(state);
    comp.bars[0].push(note(0, 'quarter'), note(0, 'eighth'));
    expect(mergeEvents(state, comp, 0, 0, 1)).toBeNull();
    expect(comp.bars[0][0].dur).toBe('dottedQuarter');
  });

  it('refuses impossible merges: kinds differ, sum unwritable, not neighbours', () => {
    const { state } = world(30);
    const comp = createComposition(state);
    comp.bars[0].push(note(0, 'quarter'), rest('quarter'), note(0, 'quarter'));
    expect(mergeEvents(state, comp, 0, 0, 1)).toMatch(/cannot merge/);
    expect(mergeEvents(state, comp, 0, 0, 2)).toMatch(/neighbours/);
    comp.bars[1].push(note(0, 'quarter'), note(0, 'sixteenth'));
    expect(mergeEvents(state, comp, 1, 0, 1)).toMatch(/no length/);
  });

  it('moves re-pitch, reorder, and respect the destination bar', () => {
    const { state } = world(MUSIC_UNLOCKS.quarter);
    const comp = createComposition(state);
    comp.bars[0].push(note(0, 'quarter'), note(4, 'quarter'));
    // Reorder within the bar, re-pitching on the way.
    expect(moveEvent(state, comp, { bar: 0, index: 0 }, { bar: 0, index: 1 }, 7)).toBeNull();
    expect(comp.bars[0].map((e) => e.pitch)).toEqual([4, 7]);
    // Cross-bar move.
    expect(moveEvent(state, comp, { bar: 0, index: 0 }, { bar: 1, index: 0 }, 4)).toBeNull();
    expect(comp.bars[1]).toEqual([{ dur: 'quarter', pitch: 4 }]);
    // A full destination refuses.
    comp.bars[2].push(note(0, 'whole'));
    expect(moveEvent(state, comp, { bar: 1, index: 0 }, { bar: 2, index: 0 }, 4)).toMatch(/No room/);
  });

  it('addEvent inserts at an index, not only at the end', () => {
    const { state } = world(MUSIC_UNLOCKS.quarter);
    const comp = createComposition(state);
    comp.bars[0].push(note(0, 'quarter'), note(4, 'quarter'));
    expect(addEvent(state, comp, 0, 'quarter', 7, 1)).toBeNull();
    expect(comp.bars[0].map((e) => e.pitch)).toEqual([0, 7, 4]);
  });
});

describe('ties: one note, held', () => {
  const level = MUSIC_UNLOCKS.ties;

  it('folds tied notes into one sounded event of the summed length', () => {
    const bars = [[{ dur: 'half', pitch: 0, tie: true } as NoteEvent, note(0, 'half')]];
    const sounded = soundedEvents(bars);
    expect(sounded).toHaveLength(1);
    expect(sounded[0]).toMatchObject({ pitch: 0, units: 240, at: 0 });
  });

  it('never fabricates a unison: a tie is one note, not two of the same pitch', () => {
    const tied = analyzeBars([[{ dur: 'half', pitch: 0, tie: true } as NoteEvent, note(0, 'half')]]);
    const untied = analyzeBars([[note(0, 'half'), note(0, 'half')]]);
    expect(tied.notes).toBe(1);
    expect(untied.notes).toBe(2);
  });

  it('syncopates across the barline — the whole point of a tie', () => {
    // A note starting on the last beat and tied over the next downbeat.
    const across = [
      [note(0, 'half'), note(0, 'quarter'), { dur: 'quarter', pitch: 4, tie: true } as NoteEvent],
      [note(4, 'quarter'), note(0, 'quarter'), note(0, 'half')],
    ];
    const same = [
      [note(0, 'half'), note(0, 'quarter'), note(4, 'quarter')],
      [note(4, 'quarter'), note(0, 'quarter'), note(0, 'half')],
    ];
    expect(syncopationOf(across)).toBeGreaterThan(syncopationOf(same));
  });

  it('only valid ties are honoured, and invalid ones are reported', () => {
    const { state } = world(level);
    const comp = createComposition(state);
    comp.bars[0].push({ dur: 'half', pitch: 0, tie: true }, note(4, 'half'));
    // Tied to a DIFFERENT pitch: the reading refuses to join them...
    expect(soundedEvents(comp.bars)).toHaveLength(2);
    // ...and the player is told why.
    expect(checkComposition(state, comp).some((p) => /same pitch/.test(p))).toBe(true);
  });

  it('toggleTie gates on the ladder and on what can actually be tied', () => {
    const { state } = world(MUSIC_UNLOCKS.eighth);
    const comp = createComposition(state);
    comp.bars[0].push(note(0, 'half'), note(0, 'half'));
    expect(toggleTie(state, comp, 0, 0)).toMatch(/Musicianship 13/);
    state.skills[MUSICIANSHIP_ID] = { level, xp: 0 };
    expect(toggleTie(state, comp, 0, 0)).toBeNull();
    expect(comp.bars[0][0].tie).toBe(true);
    expect(toggleTie(state, comp, 0, 0)).toBeNull(); // toggles back off
    expect(comp.bars[0][0].tie).toBeUndefined();
    // Nothing after it, and silence, both refuse.
    expect(toggleTie(state, comp, 0, 1)).toMatch(/nothing after it/);
    comp.bars[1].push(rest('half'), rest('half'));
    expect(toggleTie(state, comp, 1, 0)).toMatch(/Silence cannot be tied/);
  });
});

describe('compositionKey: what a sheet IS', () => {
  const level = MUSIC_UNLOCKS.repeats;

  it('ignores the label — identity is the music, not the paperwork', () => {
    const { state } = world(level);
    const a = droneSheet(state);
    const b = droneSheet(state);
    expect(b.id).not.toBe(a.id);
    b.name = 'Something Else Entirely';
    expect(compositionKey(b)).toBe(compositionKey(a));
  });

  it('changes when any note changes', () => {
    const { state } = world(level);
    const a = droneSheet(state);
    const before = compositionKey(a);
    a.bars[2][0] = note(4, 'whole');
    expect(compositionKey(a)).not.toBe(before);
  });

  it('changes when a tie is added — the two sound as one', () => {
    const { state } = world(level);
    const a = droneSheet(state);
    const before = compositionKey(a);
    a.bars[0][0].tie = true;
    expect(compositionKey(a)).not.toBe(before);
  });

  it.each([
    ['tempo', (c: Composition) => (c.bpm = 140)],
    ['pedal', (c: Composition) => (c.pedal = 7)],
    ['tonic', (c: Composition) => (c.tonic = 3)],
    ['scale', (c: Composition) => (c.scale = 'minor')],
    ['meter', (c: Composition) => (c.meter = 'waltz')],
  ])('changes when the %s changes — the reading hears all of them', (_what, mutate) => {
    const { state } = world(level);
    const a = droneSheet(state);
    const before = compositionKey(a);
    mutate(a);
    expect(compositionKey(a)).not.toBe(before);
  });

  it('is canonical about repeats: order in the array is not identity', () => {
    const { state } = world(level);
    const a = droneSheet(state);
    a.repeats = [
      { from: 2, to: 3, times: 2 },
      { from: 0, to: 1, times: 2 },
    ];
    const b = droneSheet(state);
    b.repeats = [
      { from: 0, to: 1, times: 2 },
      { from: 2, to: 3, times: 2 },
    ];
    expect(compositionKey(b)).toBe(compositionKey(a));
  });

  it('drops spans the reading refuses to play', () => {
    const { state } = world(level);
    const a = droneSheet(state);
    const bare = compositionKey(a);
    // Off the end, reversed, and played once — none of these are performed,
    // so none of them may change what the piece is.
    a.repeats = [
      { from: 0, to: 99, times: 2 },
      { from: 3, to: 1, times: 2 },
      { from: 0, to: 1, times: 1 },
    ];
    expect(expandRepeats(a).bars).toHaveLength(4);
    expect(compositionKey(a)).toBe(bare);
  });

  it('a repeat and the same bars written out twice are DIFFERENT pieces', () => {
    // They expand to the same sequence, but replays pay harmonically, so the
    // two do not read alike — and must not claim one identity.
    const { state } = world(level);
    const repeated = droneSheet(state);
    addRepeat(state, repeated, 0, 1, 2);
    const written = droneSheet(state);
    setBarCount(state, written, 6);
    for (const bar of written.bars) if (bar.length === 0) bar.push(note(0, 'whole'));
    expect(weightedAttacks(repeated)).not.toBe(weightedAttacks(written));
    expect(compositionKey(repeated)).not.toBe(compositionKey(written));
  });

  it('normalises an old sheet to the same key as a written-out one', () => {
    // Meter, tempo and pedal all arrived after the first saves. A sheet from
    // before them reads exactly as one that spells the defaults out, so the
    // two are the same piece.
    const { state } = world(level);
    const modern = droneSheet(state);
    const ancient = droneSheet(state);
    delete (ancient as Partial<Composition>).meter;
    delete (ancient as Partial<Composition>).bpm;
    delete (ancient as Partial<Composition>).pedal;
    expect(compositionKey(ancient)).toBe(compositionKey(modern));
  });

  it('round-trips: the key holds the whole piece', () => {
    // Reconstructibility is the point — hand somebody this string and they
    // have the music, with no registry of yours.
    const { state } = world(level);
    const a = droneSheet(state);
    a.bars[1][0] = note(7, 'half');
    a.bars[1].push(note(4, 'half'));
    a.bpm = 132;
    a.pedal = 5;
    addRepeat(state, a, 0, 1, 2);
    const key = compositionKey(a);
    expect(key).toContain('132');
    expect(key).toContain('~5');
    expect(key).toContain('#0-1x2');
    expect(key).toContain('half.7,half.4');
  });
});

describe('repeats: said twice, worth less the second time', () => {
  const level = MUSIC_UNLOCKS.repeats;

  it('unrolls spans into the performed sequence, with source and pass', () => {
    const { state } = world(level);
    const comp = droneSheet(state);
    expect(addRepeat(state, comp, 1, 2, 3)).toBeNull();
    const { bars, source, pass } = expandRepeats(comp);
    expect(source).toEqual([0, 1, 2, 1, 2, 1, 2, 3]);
    expect(pass).toEqual([1, 1, 1, 2, 2, 3, 3, 1]);
    expect(bars).toHaveLength(8);
  });

  it('a repeat costs stage time honestly', () => {
    const { state } = world(level);
    const comp = droneSheet(state);
    const plain = performanceTicks(comp); // 4 common-time bars × 30 ticks
    expect(plain).toBe(120);
    addRepeat(state, comp, 0, 1, 2);
    // Two bars played a second time: two more bars on the clock.
    expect(performanceTicks(comp)).toBe(plain + 2 * 30);
  });

  it('replays pay harmonically — never a free power doubler', () => {
    const { state } = world(level);
    const comp = droneSheet(state); // 4 bars, one note each
    expect(weightedAttacks(comp)).toBe(4);
    addRepeat(state, comp, 0, 1, 2);
    // Bars 0–1 play twice: the second pass pays half. 1+1+0.5+0.5+1+1 = 5.
    expect(weightedAttacks(comp)).toBe(5);
    setRepeatTimes(comp, 0, 3);
    // Third pass pays a third: +2/3 on top.
    expect(weightedAttacks(comp)).toBeCloseTo(5 + 2 / 3, 5);
  });

  it('raises motif honestly — restatement IS what motif measures', () => {
    const { state } = world(level);
    const comp = createComposition(state);
    const figure: [number, NoteDurId][] = [[0, 'half'], [4, 'half']];
    comp.bars[0].push(...figure.map(([p, d]) => note(p, d)));
    comp.bars[1].push(note(7, 'half'), note(2, 'half'));
    comp.bars[2].push(note(5, 'half'), note(11, 'half'));
    comp.bars[3].push(note(9, 'half'), note(1, 'half'));
    const before = readComposition(comp).themeAnalysis.motif;
    addRepeat(state, comp, 0, 3, 2);
    expect(readComposition(comp).themeAnalysis.motif).toBeGreaterThan(before);
  });

  it('refuses overlaps, straddles, and locked levels', () => {
    const { state } = world(0);
    const comp = droneSheet(state);
    setBarCount(state, comp, BASE_BARS);
    expect(addRepeat(state, comp, 0, 1)).toMatch(/Musicianship 7/);
    state.skills[MUSICIANSHIP_ID] = { level: 30, xp: 0 };
    setBarCount(state, comp, 6);
    expect(addRepeat(state, comp, 2, 5)).toMatch(/straddles?|coda/);
    expect(addRepeat(state, comp, 1, 2)).toBeNull();
    expect(addRepeat(state, comp, 2, 3)).toMatch(/overlaps/);
    expect(addRepeat(state, comp, 3, 1)).toMatch(/ends where it starts/);
  });

  it('shrinking the sheet lifts the marks it stranded', () => {
    const { state } = world(30);
    const comp = droneSheet(state);
    setBarCount(state, comp, 6);
    expect(addRepeat(state, comp, 4, 5)).toBeNull();
    expect(repeatAt(comp, 5)?.span).toMatchObject({ from: 4, to: 5 });
    setBarCount(state, comp, BASE_BARS);
    expect(comp.repeats).toEqual([]);
    expect(repeatAt(comp, 0)).toBeNull();
  });
});

describe('cadence: how it lands', () => {
  const analyze = (pitches: number[]) =>
    analyzeBars([pitches.map((p) => note(p, 'quarter'))]).cadence;

  it('reads home, question, and swerve', () => {
    // C major, resolving to the tonic.
    expect(analyze([0, 4, 7, 0])).toBe('closed');
    // Ending on the dominant: a question left open.
    expect(analyze([0, 0, 4, 7])).toBe('open');
    // The dominant promises home and delivers the submediant.
    expect(analyze([0, 4, 7, 9])).toBe('deceptive');
  });

  it('silence has a cadence too — the reading stays total', () => {
    expect(analyzeBars([[rest('whole')]]).cadence).toBe('silent');
    expect(analyzeBars([[]]).cadence).toBe('silent');
  });

  it('archetypes may prefer a cadence, and it pulls the reading', () => {
    expect(MUSIC_ARCHETYPES.lullaby.cadences).toContain('closed');
  });
});

describe('the pedal tone: the first vertical dimension', () => {
  const level = MUSIC_UNLOCKS.pedal;

  it('measures consonance AGAINST it, duration-weighted', () => {
    const fifths = soundedEvents([[note(7, 'half'), note(0, 'half')]]);
    const seconds = soundedEvents([[note(1, 'half'), note(11, 'half')]]);
    expect(harmonyAgainst(fifths, 0)).toBeGreaterThan(0.85); // a fifth and a unison
    expect(harmonyAgainst(seconds, 0)).toBeLessThan(0.25); // semitone grind
  });

  it('is neutral with no pedal — one voice has no harmony to have an opinion about', () => {
    expect(harmonyAgainst(soundedEvents([[note(0, 'whole')]]), null)).toBe(0.5);
    expect(analyzeBars([[note(0, 'whole')]]).harmony).toBe(0.5);
    expect(analyzeBars([[note(0, 'whole')]]).pedal).toBeNull();
  });

  it('pulls the key toward itself — which is what drones do to ears', () => {
    // A plain C-major arpeggio: alone it is unmistakably C.
    const bars = [[note(0, 'quarter'), note(4, 'quarter'), note(7, 'quarter'), note(4, 'quarter')]];
    const alone = analyzeBars(bars);
    expect(alone.key?.tonic).not.toBe(9);
    // The very same notes over an A pedal are heard as A minor — the pedal
    // sounds for the whole piece, so it outweighs any single note in it.
    const overA = analyzeBars(bars, MUSIC_METERS.common, DEFAULT_BPM, 9);
    expect(overA.key?.tonic).toBe(9);
    expect(overA.key?.mode).toBe('minor');
  });

  it('is gated, staff-bound, and clearable', () => {
    const { state } = world(0);
    const comp = createComposition(state);
    expect(setPedal(state, comp, 0)).toMatch(/Musicianship 15/);
    state.skills[MUSICIANSHIP_ID] = { level, xp: 0 };
    expect(setPedal(state, comp, 0)).toBeNull();
    expect(comp.pedal).toBe(0);
    expect(setPedal(state, comp, 99)).toMatch(/off the end/);
    expect(setPedal(state, comp, null)).toBeNull(); // clearing is always allowed
    expect(comp.pedal).toBeNull();
  });

  it('a pedal stranded off the staff is dropped on load, not reported forever', () => {
    const { state } = world(level);
    const comp = createComposition(state);
    comp.pedal = 500;
    expect(normalizeComposition(comp).pedal).toBeNull();
  });

  it('the reading carries it, and the archetypes that care can feel it', () => {
    const { state } = world(level);
    const comp = droneSheet(state);
    setPedal(state, comp, 0);
    const reading = readComposition(comp);
    expect(reading.themeAnalysis.pedal).toBe(0);
    expect(reading.themeAnalysis.harmony).toBeGreaterThan(0.9); // unison over unison
    expect(MUSIC_ARCHETYPES.lullaby.target.harmony).toBeDefined();
  });
});

describe('tempo: the speed dial the notes cannot show', () => {
  const level = MUSIC_UNLOCKS.tempo;

  it('is quarter-referenced, so it means the same in every meter', () => {
    expect(ticksPerUnit(80)).toBeCloseTo(0.125, 6); // the old fixed clock
    expect(ticksPerUnit(160)).toBeCloseTo(0.0625, 6); // twice as fast
    expect(TICKS_PER_UNIT).toBeCloseTo(ticksPerUnit(DEFAULT_BPM), 9);
  });

  it('halves the stage time when it doubles', () => {
    const { state } = world(level);
    const comp = droneSheet(state);
    expect(performanceTicks(comp)).toBe(120);
    expect(setTempo(state, comp, 160)).toBeNull();
    expect(performanceTicks(comp)).toBe(60);
  });

  it('changing the meter never changes the speed of a written note', () => {
    const { state } = world(30);
    const a = createComposition(state);
    const b = createComposition(state);
    setMeter(state, b, 'compound');
    // One quarter note takes the same real time under 4/4 and 6/8.
    expect(ticksPerUnit(tempoOf(a)) * 60).toBeCloseTo(ticksPerUnit(tempoOf(b)) * 60, 9);
  });

  it('is gated, clamped, and healed', () => {
    const { state } = world(0);
    const comp = createComposition(state);
    expect(setTempo(state, comp, 140)).toMatch(/Musicianship 9/);
    expect(comp.bpm).toBe(DEFAULT_BPM);
    state.skills[MUSICIANSHIP_ID] = { level, xp: 0 };
    expect(setTempo(state, comp, 10_000)).toBeNull();
    expect(comp.bpm).toBe(MAX_BPM);
    expect(setTempo(state, comp, 1)).toBeNull();
    expect(comp.bpm).toBe(MIN_BPM);
    comp.bpm = Number.NaN;
    expect(normalizeComposition(comp).bpm).toBe(DEFAULT_BPM);
  });

  it('the READING hears it: the same notes, fast, are a different piece', () => {
    const { state } = world(level);
    // A brisk, tumbling line — a reel if it moves, something else if it crawls.
    const comp = createComposition(state);
    const line = [0, 4, 7, 9, 7, 4, 2, 4];
    for (const bar of comp.bars) {
      bar.push(...line.map((p) => note(p, 'eighth')));
    }
    setTempo(state, comp, MIN_BPM);
    const slow = readComposition(comp);
    setTempo(state, comp, 170);
    const fast = readComposition(comp);
    expect(fast.themeAnalysis.bpm).toBe(170);
    // Pace is a real axis: the fast reading is nearer the quick archetypes.
    expect(axisValues(fast.themeAnalysis).pace).toBeGreaterThan(
      axisValues(slow.themeAnalysis).pace,
    );
    expect(fast.theme.archetype.id).not.toBe(slow.theme.archetype.id);
  });

  it('every archetype states a pace — the axis is not optional content', () => {
    for (const arch of Object.values(MUSIC_ARCHETYPES)) {
      expect(arch.target.pace, `${arch.id} has no pace target`).toBeDefined();
    }
  });
});

describe('meter: the bar changes shape, never speed', () => {
  it('capacity is beats × beatUnits', () => {
    expect(barCapacity(MUSIC_METERS.common)).toBe(240);
    expect(barCapacity(MUSIC_METERS.waltz)).toBe(180);
    expect(barCapacity(MUSIC_METERS.compound)).toBe(180); // same as 3/4 — meter ≠ capacity
    expect(barCapacity(MUSIC_METERS.quintuple)).toBe(300);
  });

  it('meters are level-gated, and common time never is', () => {
    const { state } = world(0);
    const comp = createComposition(state);
    expect(setMeter(state, comp, 'waltz')).toBe(false);
    expect(comp.meter).toBe('common');
    state.skills[MUSICIANSHIP_ID] = { level: MUSIC_METERS.waltz.unlockLevel, xp: 0 };
    expect(setMeter(state, comp, 'waltz')).toBe(true);
    expect(comp.meter).toBe('waltz');
  });

  it('a whole note cannot be written in 3/4, and a dotted half exactly fills it', () => {
    const { state } = world(MUSIC_METERS.waltz.unlockLevel);
    const comp = createComposition(state);
    setMeter(state, comp, 'waltz');
    expect(addEvent(state, comp, 0, 'whole', 0)).toMatch(/No room/);
    expect(addEvent(state, comp, 0, 'dottedHalf', 0)).toBeNull();
    expect(barUnitsUsed(comp.bars[0])).toBe(180);
    for (let i = 1; i < 4; i++) comp.bars[i].push({ dur: 'dottedHalf', pitch: 0 });
    expect(checkComposition(state, comp)).toEqual([]);
  });

  it('shorter bars take fewer stage ticks — the tempo never moved', () => {
    const { state } = world(MUSIC_METERS.waltz.unlockLevel);
    const common = droneSheet(state);
    expect(performanceTicks(common)).toBe(120);
    const waltz = createComposition(state);
    setMeter(state, waltz, 'waltz');
    expect(performanceTicks(waltz)).toBe(90); // 4 × 180 units × 0.125
  });

  it('re-ruling a written sheet is flagged, honestly and reversibly', () => {
    const { state } = world(MUSIC_METERS.waltz.unlockLevel);
    const comp = droneSheet(state); // four whole notes, legal in common time
    expect(checkComposition(state, comp)).toEqual([]);
    setMeter(state, comp, 'waltz');
    const problems = checkComposition(state, comp);
    expect(problems.some((p) => /overfull/.test(p))).toBe(true);
    setMeter(state, comp, 'common');
    expect(checkComposition(state, comp)).toEqual([]);
  });
});

describe('what the music does (the confers hook)', () => {
  /** A reading whose theme archetype has been given an effect, without touching the registry. */
  function withConfers(reading: ReturnType<typeof readComposition>, confers: { status: string; perPower: number; duration?: number }) {
    return {
      ...reading,
      theme: { ...reading.theme, archetype: { ...reading.theme.archetype, confers } },
    };
  }

  it('an archetype with no effect confers nothing — dormant by default', () => {
    const { state } = world(0);
    const reading = readComposition(droneSheet(state));
    expect(conferredBy(reading, 4)).toEqual([]);
  });

  it('the theme confers its status at power-scaled intensity', () => {
    const { state } = world(0);
    const reading = withConfers(readComposition(droneSheet(state)), {
      status: 'dazed',
      perPower: 2,
      duration: 100,
    });
    const apps = conferredBy(reading, 4);
    expect(apps).toHaveLength(1);
    expect(apps[0].id).toBe('dazed');
    expect(apps[0].intensity).toBe(Math.max(1, Math.round(reading.power * 2)));
    expect(apps[0].duration).toBe(100);
  });

  it('a turn coda adds its own colour, scaled by its share; a reprise never doubles', () => {
    const { state } = world(MUSIC_UNLOCKS.bar5);
    const comp = droneSheet(state);
    comp.bars.push([0, 11, 2, 9, 4, 7, 5, 12].map((p) => note(p, 'eighth')));
    const turn = readComposition(comp);
    expect(turn.coda?.relation).toBe('turn');
    turn.coda!.match = {
      ...turn.coda!.match,
      archetype: { ...turn.coda!.match.archetype, confers: { status: 'dazed', perPower: 5 } },
    };
    const apps = conferredBy(turn, comp.bars.length);
    expect(apps).toHaveLength(1); // theme has no effect; only the turn's colour lands
    expect(apps[0].id).toBe('dazed');
    expect(apps[0].intensity).toBeGreaterThanOrEqual(1);

    const reprise = droneSheet(state);
    reprise.bars.push([note(0, 'whole')]);
    const r = withConfers(readComposition(reprise), { status: 'dazed', perPower: 1 });
    expect(r.coda?.relation).toBe('reprise');
    // One application: the reprise magnifies power, it never confers twice.
    expect(conferredBy(r, reprise.bars.length)).toHaveLength(1);
  });

  it('a finished performance actually lands the condition on the performer', () => {
    const { state, bus } = world();
    const comp = droneSheet(state);
    const drone = MUSIC_ARCHETYPES.drone;
    const had = drone.confers;
    drone.confers = { status: 'dazed', perPower: 1 };
    try {
      startPerformance(state, bus, comp.id);
      for (let i = 0; i < 4 * TICKS_PER_BAR; i++) tickPerformance(state, bus);
      expect(state.performance).toBeNull();
      expect(state.statuses.some((s) => s.id === 'dazed')).toBe(true);
    } finally {
      if (had === undefined) delete drone.confers;
      else drone.confers = had;
    }
  });
});

describe('the save', () => {
  it('v40 saves gain empty music fields', () => {
    const raw: Record<string, unknown> = { version: 40 };
    const migrated = migrate(raw, 41);
    expect(migrated.compositions).toEqual([]);
    expect(migrated.performance).toBeNull();
    expect(migrated.version).toBe(41);
  });

  it('v42 sheets gain an empty repeat list, and the chain runs end to end', () => {
    const raw: Record<string, unknown> = {
      version: 42,
      compositions: [{ id: 1, name: 'x', scale: 'major', tonic: 0, meter: 'common', bars: [[], [], [], []] }],
    };
    const migrated = migrate(raw, 43);
    expect(migrated.compositions[0].repeats).toEqual([]);
    expect(migrated.version).toBe(43);
    // And from the very first music save, unbroken.
    const fromV40 = migrate({ version: 40 } as Record<string, unknown>, 43);
    expect(fromV40.version).toBe(43);
    expect(fromV40.compositions).toEqual([]);
  });

  it('v41 sheets learn they were always in common time', () => {
    const raw: Record<string, unknown> = {
      version: 41,
      compositions: [{ id: 1, name: 'x', scale: 'major', tonic: 0, bars: [[], [], [], []] }],
    };
    const migrated = migrate(raw, 42);
    expect(migrated.compositions[0].meter).toBe('common');
    expect(migrated.version).toBe(42);
  });

  it('normalizeComposition heals every wound a bad save can carry', () => {
    const wounded = {
      id: 7,
      name: '',
      scale: 'no_such_scale',
      tonic: Number.NaN,
      bars: [
        [
          { dur: 'no_such_duration', pitch: 0 }, // unresolvable — dropped
          { dur: 'half', pitch: 4.5 }, // fractional pitch — dropped
          { dur: 'half', pitch: null }, // a legal rest — kept
        ],
        'not a bar', // coerced to empty
      ],
    } as unknown as Composition;
    const healed = normalizeComposition(wounded);
    expect(healed.name).toBe('Untitled piece');
    expect(healed.scale).toBe('major');
    expect(healed.tonic).toBe(0);
    expect(healed.meter).toBe('common');
    expect(healed.bars).toHaveLength(4); // padded back to the theme
    expect(healed.bars[0]).toEqual([{ dur: 'half', pitch: null }]);
    expect(healed.bars[1]).toEqual([]);
    // A healed sheet never produces a NaN staff row.
    expect(allowedPitches(healed).every(Number.isInteger)).toBe(true);
  });

  it('deserialize heals compositions and drops a performance of a vanished sheet', () => {
    const state = createInitialState();
    state.compositions = [
      { id: 1, name: 'ok', scale: 'major', tonic: 0, meter: 'common', bpm: 80, pedal: null, bars: [[], [], [], []], repeats: [] },
      { id: 2, name: 'hurt', scale: 'gone', tonic: 99, bars: 'x' } as unknown as Composition,
    ];
    state.performance = { compositionId: 404, spot: state.spot, ticksLeft: 5, ticksTotal: 10 };
    const loaded = deserialize(serialize(state));
    expect(loaded.compositions[1].scale).toBe('major');
    expect(loaded.compositions[1].tonic).toBe(0);
    expect(loaded.compositions[1].bars).toHaveLength(4);
    expect(loaded.performance).toBeNull();
  });
});
