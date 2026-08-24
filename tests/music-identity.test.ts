import { describe, expect, it } from 'vitest';
import type { Composition, NoteDurId, NoteEvent } from '../src/core/types';
import { readComposition, classify, analyzeBars } from '../src/core/systems/music';
import { MUSIC_ARCHETYPES, NOTE_DURATIONS, BAR_UNITS } from '../src/core/data/music.data';

/**
 * The calibration suite. tests/music.test.ts owns the MACHINERY (bars, ties,
 * repeats, meters, unlocks); this file owns the JUDGEMENT — that the
 * classifier's opinions about actual music are the right opinions.
 *
 * It exists because they were not. Before this suite, deliberately written
 * music scored BELOW random noise (median 0.749 against 0.826): Brahms's
 * Wiegenlied read as a dirge, `lullaby` won nothing at all across a corpus of
 * hand-transcribed tunes, and a Doom riff was filed as a jig — because
 * `undulating` is 99% of random sheets and reel was the only archetype
 * claiming it.
 *
 * The load-bearing test here is not any single fixture. It is
 * "every archetype in the registry has an exemplar": adding a kind of music
 * without proving a human can write one now fails the build.
 */

const note = (pitch: number, dur: NoteDurId = 'quarter'): NoteEvent => ({ dur, pitch });
const rest = (dur: NoteDurId = 'quarter'): NoteEvent => ({ dur, pitch: null });

interface Fixture {
  bars: NoteEvent[][];
  bpm: number;
  scale?: string;
  tonic?: number;
  pedal?: number | null;
}

function sheet(f: Fixture): Composition {
  return {
    id: 1,
    name: 'fixture',
    scale: f.scale ?? 'major',
    tonic: f.tonic ?? 0,
    meter: 'common',
    bpm: f.bpm,
    pedal: f.pedal ?? null,
    bars: f.bars,
    repeats: [],
  };
}

const read = (f: Fixture) => readComposition(sheet(f));

/** Every bar must be exactly full, or the fixture is not a legal sheet. */
function barUnits(bar: NoteEvent[]): number {
  return bar.reduce((s, e) => s + NOTE_DURATIONS[e.dur].units, 0);
}

// ---------- The exemplars ----------
//
// One hand-written four-bar sheet per archetype. These are the proof that each
// kind of music is REACHABLE — not a sampling of what players will write, but
// a demonstration that a person sitting at the staff can get there on purpose.

/** Doom's E1M1, as the published score writes it: quarter = 110, in sixteenths. */
const DOOM_E1M1: Fixture = {
  bpm: 110,
  pedal: 0,
  bars: [
    riffBar([0, 21, 0, 0, 0, 16, 0, 0, 0, 14, 0, 0, 9, 14]),
    riffBar([0, 21, 0, 0, 0, 16, 0, 0, 0, 14, 0, 0, 9, 14]),
    riffBar([0, 21, 0, 0, 0, 16, 0, 0, 0, 14, 0, 0, 9, 14]),
    riffBar([0, 4, 0, 0, 0, 9, 0, 0, 0, 14, 0, 0, 4, 14]),
  ],
};

/** One eighth then fourteen sixteenths — 30 + 210 = 240. */
function riffBar(sixteenths: number[]): NoteEvent[] {
  return [note(0, 'eighth'), ...sixteenths.map((p) => note(p, 'sixteenth'))];
}

const TWINKLE_66: Fixture = {
  bpm: 66,
  // A cradle song hummed over a held tone — which is also what stops `harmony`
  // sitting at its no-opinion 0.5 and costing the archetype that asks for it.
  pedal: 0,
  bars: [
    [note(0), note(0), note(7), note(7)],
    [note(9), note(9), note(7, 'half')],
    [note(5), note(5), note(4), note(4)],
    [note(2), note(2), note(0, 'half')],
  ],
};

const HELD_NOTE: Fixture = {
  bpm: 45,
  bars: [[note(0, 'whole')], [note(0, 'whole')], [note(0, 'whole')], [note(0, 'whole')]],
};

const TOLLING_BELL: Fixture = {
  bpm: 64,
  bars: [
    [note(0, 'half'), rest('half')],
    [note(0, 'half'), rest('half')],
    [note(0, 'half'), rest('half')],
    [note(0, 'half'), rest('half')],
  ],
};

/** A march hammers ONE figure: bars 1 and 3 are the same, 2 and 4 are the same. */
const YANKEE_DOODLE: Fixture = {
  bpm: 112,
  bars: [
    [note(0, 'eighth'), note(2, 'eighth'), note(4, 'eighth'), note(7, 'eighth'), note(4, 'eighth'), note(2, 'eighth'), note(0, 'eighth'), note(4, 'eighth')],
    [note(7, 'eighth'), note(4, 'eighth'), note(2, 'eighth'), note(0, 'eighth'), note(0, 'half')],
    [note(0, 'eighth'), note(2, 'eighth'), note(4, 'eighth'), note(7, 'eighth'), note(4, 'eighth'), note(2, 'eighth'), note(0, 'eighth'), note(4, 'eighth')],
    [note(7, 'eighth'), note(4, 'eighth'), note(2, 'eighth'), note(0, 'eighth'), note(0, 'half')],
  ],
};

const AMAZING_GRACE: Fixture = {
  bpm: 88,
  bars: [
    [note(0), note(5, 'half'), note(9)],
    [note(5, 'half'), note(4, 'half')],
    [note(5), note(9, 'half'), note(12)],
    [note(12, 'half'), note(9, 'half')],
  ],
};

const TURKEY_STRAW: Fixture = {
  bpm: 144,
  bars: [
    [note(4, 'eighth'), note(5, 'eighth'), note(7, 'eighth'), note(9, 'eighth'), note(11, 'eighth'), note(9, 'eighth'), note(7, 'eighth'), note(4, 'eighth')],
    [note(5, 'eighth'), note(7, 'eighth'), note(9, 'eighth'), note(7, 'eighth'), note(5, 'quarter'), note(0, 'quarter')],
    [note(4, 'eighth'), note(5, 'eighth'), note(7, 'eighth'), note(9, 'eighth'), note(11, 'eighth'), note(9, 'eighth'), note(7, 'eighth'), note(4, 'eighth')],
    [note(5, 'eighth'), note(4, 'eighth'), note(2, 'eighth'), note(0, 'eighth'), note(0, 'half')],
  ],
};

const DIES_IRAE: Fixture = {
  bpm: 56,
  scale: 'minor',
  bars: [
    [note(5), note(4), note(5), note(2)],
    [note(3), note(2), note(0, 'half')],
    [note(5), note(4), note(5), note(3)],
    [note(2), note(0), note(2, 'half')],
  ],
};

/** Two durations only, and half the bar is silence — a call, not a tune. */
const BUGLE_CALL: Fixture = {
  bpm: 139,
  bars: [
    [note(0, 'eighth'), note(4, 'eighth'), note(7, 'eighth'), note(9, 'eighth'), rest('quarter'), rest('quarter')],
    [note(9, 'eighth'), note(7, 'eighth'), note(4, 'eighth'), note(0, 'eighth'), rest('quarter'), rest('quarter')],
    [note(0, 'eighth'), note(4, 'eighth'), note(7, 'eighth'), note(9, 'eighth'), rest('quarter'), rest('quarter')],
    [note(9, 'eighth'), note(7, 'eighth'), note(4, 'eighth'), note(0, 'eighth'), rest('quarter'), rest('quarter')],
  ],
};

const FUR_ELISE: Fixture = {
  bpm: 136,
  scale: 'minor',
  bars: [
    [note(16, 'eighth'), note(15, 'eighth'), note(16, 'eighth'), note(15, 'eighth'), note(16, 'eighth'), note(11, 'eighth'), note(14, 'sixteenth'), note(12, 'sixteenth'), note(9, 'eighth')],
    [note(0, 'sixteenth'), note(4, 'sixteenth'), note(9, 'eighth'), note(11, 'dottedQuarter'), note(4, 'eighth'), note(8, 'sixteenth'), note(11, 'sixteenth'), note(12, 'eighth')],
    [note(4, 'eighth'), note(16, 'eighth'), note(15, 'eighth'), note(16, 'eighth'), note(15, 'eighth'), note(16, 'eighth'), note(11, 'sixteenth'), note(14, 'sixteenth'), note(12, 'eighth')],
    [note(9, 'quarter'), note(0, 'sixteenth'), note(4, 'sixteenth'), note(9, 'eighth'), note(11, 'half')],
  ],
};

const PSALM_TONE: Fixture = {
  bpm: 89,
  scale: 'minor',
  bars: [
    [note(7, 'eighth'), note(7, 'eighth'), note(7, 'eighth'), note(7, 'eighth'), note(7, 'eighth'), note(7, 'eighth'), note(9, 'eighth'), note(7, 'eighth')],
    [note(7, 'eighth'), note(7, 'eighth'), note(7, 'eighth'), note(7, 'eighth'), note(5, 'eighth'), note(7, 'eighth'), note(5, 'quarter')],
    [note(7, 'eighth'), note(7, 'eighth'), note(7, 'eighth'), note(7, 'eighth'), note(7, 'eighth'), note(7, 'eighth'), note(9, 'eighth'), note(7, 'eighth')],
    [note(7, 'eighth'), note(7, 'eighth'), note(5, 'eighth'), note(4, 'eighth'), note(5, 'half')],
  ],
};

/**
 * Semitones and tritones, which the CONSONANCE table rates 0.15 and 0.20 —
 * the two most disagreeable intervals it knows. A semitone is also a STEP, so
 * this is dissonant and conjunct at once, which is exactly what `keening`
 * asks for and nothing else does.
 */
const CHROMATIC_LAMENT: Fixture = {
  bpm: 75,
  scale: 'greater_harmonic',
  bars: [
    [note(12), note(11), note(5), note(6)],
    [note(0), note(1), note(7), note(6)],
    [note(12), note(11), note(5), note(6)],
    [note(0), note(1), note(6), note(7)],
  ],
};

const MOTO_PERPETUO: Fixture = {
  bpm: 171,
  bars: [
    scaleRun([0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0, 2]),
    scaleRun([4, 5, 7, 9, 11, 12, 14, 16, 14, 12, 11, 9, 7, 5, 4, 5]),
    scaleRun([7, 9, 11, 12, 14, 16, 17, 19, 17, 16, 14, 12, 11, 9, 7, 9]),
    scaleRun([12, 11, 9, 7, 5, 4, 2, 0, 2, 4, 5, 7, 9, 11, 12, 14]),
  ],
};

/** Sixteen sixteenths — a full common-time bar with no gap in it. */
function scaleRun(pitches: number[]): NoteEvent[] {
  return pitches.map((p) => note(p, 'sixteenth'));
}

// Level-0 writable: whole and half notes only, common time, quarter = 80.
const LEVEL0_TOLLING: Fixture = {
  bpm: 80,
  bars: [
    [note(0, 'half'), rest('half')],
    [note(0, 'half'), rest('half')],
    [note(0, 'half'), rest('half')],
    [note(0, 'half'), rest('half')],
  ],
};

const LEVEL0_HYMN: Fixture = {
  bpm: 80,
  bars: [
    [note(0, 'half'), note(4, 'half')],
    [note(7, 'half'), note(4, 'half')],
    [note(5, 'half'), note(2, 'half')],
    [note(0, 'whole')],
  ],
};

const EXEMPLARS: { id: string; sheet: Fixture }[] = [
  { id: 'ostinato', sheet: DOOM_E1M1 },
  { id: 'lullaby', sheet: TWINKLE_66 },
  { id: 'drone', sheet: HELD_NOTE },
  { id: 'knell', sheet: TOLLING_BELL },
  { id: 'march', sheet: YANKEE_DOODLE },
  { id: 'anthem', sheet: AMAZING_GRACE },
  { id: 'reel', sheet: TURKEY_STRAW },
  { id: 'dirge', sheet: DIES_IRAE },
  { id: 'patter', sheet: BUGLE_CALL },
  { id: 'rhapsody', sheet: FUR_ELISE },
  { id: 'incantation', sheet: PSALM_TONE },
  { id: 'keening', sheet: CHROMATIC_LAMENT },
  { id: 'perpetuum', sheet: MOTO_PERPETUO },
];

// ---------- Noise ----------
//
// The control group. A deterministic generator of exactly-full bars — what
// the staff produces when nobody is deciding anything.

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const DUR_IDS = Object.keys(NOTE_DURATIONS) as NoteDurId[];

const SMALLEST = Math.min(...DUR_IDS.map((d) => NOTE_DURATIONS[d].units));

/**
 * Fill a bar EXACTLY, choosing randomly among durations that still fit. Not
 * every greedy path lands on zero (drop a sixteenth into a 15-unit gap and
 * three units are left with nothing that fits), so a stranded bar is simply
 * rerolled — the alternative, letting it end short, would feed the classifier
 * unfinished sheets no player could perform.
 */
function randomBar(rng: () => number): NoteEvent[] {
  for (let attempt = 0; attempt < 100; attempt++) {
    const bar: NoteEvent[] = [];
    let left = BAR_UNITS;
    while (left > 0) {
      const fits = DUR_IDS.filter((d) => {
        const u = NOTE_DURATIONS[d].units;
        return u <= left && (u === left || left - u >= SMALLEST);
      });
      if (fits.length === 0) break;
      const dur = fits[Math.floor(rng() * fits.length)];
      bar.push({ dur, pitch: rng() < 0.12 ? null : Math.floor(rng() * 25) });
      left -= NOTE_DURATIONS[dur].units;
    }
    if (left === 0) return bar;
  }
  return [{ dur: 'whole', pitch: 0 }];
}

function randomSheets(seed: number, n: number): Composition[] {
  const rng = lcg(seed);
  const out: Composition[] = [];
  for (let i = 0; i < n; i++) {
    out.push(
      sheet({
        bpm: 40 + Math.floor(rng() * 161),
        pedal: rng() < 0.4 ? Math.floor(rng() * 12) : null,
        bars: [randomBar(rng), randomBar(rng), randomBar(rng), randomBar(rng)],
      }),
    );
  }
  return out;
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

// ---------- The suite ----------

describe('music identity — exemplars', () => {
  it('every fixture is a legal sheet', () => {
    for (const { id, sheet: f } of EXEMPLARS) {
      f.bars.forEach((bar, i) => {
        expect(barUnits(bar), `${id} bar ${i + 1} is not exactly full`).toBe(BAR_UNITS);
      });
    }
  });

  it.each(EXEMPLARS)('$id is reachable — a person can write one on purpose', ({ id, sheet: f }) => {
    const reading = read(f);
    if (process.env.MUSIC_DIAG) {
      const gap = reading.ranked[0].purity - reading.ranked[1].purity;
      // eslint-disable-next-line no-console
      console.log(
        `${id.padEnd(12)} ${reading.theme.archetype.id.padEnd(12)} purity=${reading.theme.purity.toFixed(3)} gap=${gap.toFixed(3)} power=${reading.power}`,
      );
    }
    expect(reading.theme.archetype.id).toBe(id);
    expect(reading.theme.purity).toBeGreaterThanOrEqual(0.7);
  });

  // The anti-rot test. Adding an archetype to the registry without proving a
  // human can write one is how the vocabulary drifts away from music.
  it('every archetype in the registry has an exemplar', () => {
    expect(EXEMPLARS.map((e) => e.id).sort()).toEqual(Object.keys(MUSIC_ARCHETYPES).sort());
  });

  // The shipped classifier decided Doom by 0.036 of raw distance with a 0.06
  // tiebreaker. Anything won by less than this is coin-flipped, not classified.
  it.each(EXEMPLARS)('$id wins by a margin, not a tiebreak', ({ sheet: f }) => {
    const { ranked } = read(f);
    expect(ranked[0].purity - ranked[1].purity).toBeGreaterThan(0.04);
  });
});

describe('music identity — deliberate music outscores dice', () => {
  const noise = randomSheets(1234, 2000).map((c) => readComposition(c).theme.purity);

  it('noise sits well below what writing reaches', () => {
    expect(median(noise)).toBeLessThan(0.72);
  });

  it('every exemplar beats the noise median', () => {
    const nMed = median(noise);
    for (const { id, sheet: f } of EXEMPLARS) {
      expect(read(f).theme.purity, `${id} lost to dice`).toBeGreaterThan(nMed);
    }
  });

  it('the top bands are not reachable by accident', () => {
    expect(noise.filter((p) => p >= 0.75).length / noise.length).toBeLessThan(0.05);
    expect(noise.filter((p) => p >= 0.85).length / noise.length).toBeLessThan(0.005);
  });
});

// The four structural rules those exemplars depend on — every archetype
// declaring motif/rhythmEntropy/syncopation, syncopation ≤ 0.15, rhythmEntropy
// ≤ 0.6, and nobody claiming `undulating` — are enforced as CONTENT legality
// in tests/content.test.ts §music content, mirrored in forge/lib/validate.ts,
// so the forge stops an author before the sheet ever reaches this suite.

describe('music identity — the ruling is declared, not deduced', () => {
  it('a major sheet is read in major even when the notes lean minor', () => {
    // The A-minor-ish triad, written on a staff ruled C major. The 24-way
    // search calls this A minor; the composer said C major, and the composer
    // is the one who ruled the staff.
    const leaning: Fixture = {
      bpm: 90,
      bars: [
        [note(9), note(0), note(4), note(9)],
        [note(0), note(4), note(9, 'half')],
        [note(9), note(0), note(4), note(9)],
        [note(4), note(0), note(9, 'half')],
      ],
    };
    expect(read(leaning).themeAnalysis.key?.mode).toBe('major');
    expect(read({ ...leaning, scale: 'minor', tonic: 9 }).themeAnalysis.key?.mode).toBe('minor');
  });

  it('a chromatic ruling still gets searched — it declares no mode', () => {
    // greater_harmonic has all twelve degrees, so the staff asserts nothing.
    const found = read(CHROMATIC_LAMENT).themeAnalysis.key;
    expect(found).not.toBeNull();
  });

  it('analyzeBars without a ruling is unchanged — the old seam still works', () => {
    const bars = TWINKLE_66.bars;
    expect(classify(analyzeBars(bars))[0].archetype.id).toBeTruthy();
  });
});

describe('music identity — completability', () => {
  // The floor build writes whole and half notes in common time at quarter = 80.
  // Every band has to be reachable from there, by hand, or the ladder measures
  // the palette instead of the player.
  it('the level-0 palette reaches the top bands', () => {
    expect(read(LEVEL0_TOLLING).theme.purity).toBeGreaterThan(0.8);
    expect(read(LEVEL0_HYMN).theme.purity).toBeGreaterThan(0.7);
  });
});
