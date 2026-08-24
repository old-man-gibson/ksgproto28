import type { MusicArchetypeDef, MusicAxis, MusicMeterDef, MusicScaleDef, NoteDurId } from '../types';

/**
 * Music content: the notation the sheet offers, the scales it can be ruled
 * in, and the archetypes a performance is read as.
 *
 * The system's identity in the crafting family: THE ANALYSIS NAMES THE
 * PRODUCT. Cooking sums, the stove asks when, alchemy asks in what order,
 * mutagens ask how it is wired — music asks what the whole piece MEASURES
 * as. No single placement decides anything; key-finding, contour, motion,
 * syncopation and entropy are computed over the sheet and the nearest
 * archetype names the tune (see systems/music.ts).
 */

// ---------- The rhythmic grid ----------

/**
 * Grid units of ONE QUARTER NOTE — the atom everything else multiplies. 60
 * divides by 4 (sixteenths), 3 (triplets) AND 5 (quintuplets), so every
 * duration in Western notation short of septuplets lands on integers, and
 * the syncopation model reads metric weight straight off divisibility.
 * (The grid was 48/bar before quintuplets forced the factor of five —
 * saves never noticed, because notes store duration IDS, not units.)
 */
export const UNITS_PER_QUARTER = 60;

/** Units in one COMMON-TIME (4/4) bar. Other meters differ — see MUSIC_METERS. */
export const BAR_UNITS = 4 * UNITS_PER_QUARTER;

/** The theme: every composition holds at least these bars. */
export const BASE_BARS = 4;

/** The longest form — a four-bar theme and a four-bar coda. */
export const MAX_BARS = 8;

/**
 * Musicianship levels at which the page grows. Interleaved on purpose —
 * finer notes, longer forms and stranger rules arrive alternately, so there
 * is something new to reach for at a steady drip rather than one wall.
 */
export const MUSIC_UNLOCKS = {
  /** Quarter notes and rests. */
  quarter: 5,
  /** The ‖: :‖ barlines — say a stretch twice without writing it twice. */
  repeats: 7,
  /** A fifth bar — the first taste of the coda. */
  bar5: 8,
  /** Tempo. Until this, everything you write plods at ♩=80. */
  tempo: 9,
  /** Augmentation dots: the dotted half and dotted quarter (×1.5). */
  dots: 10,
  /** Eighth notes and rests. */
  eighth: 12,
  /** Ties — one note held across the barline, and true long syncopation. */
  ties: 13,
  /** The pedal tone: a second voice, and the first vertical harmony. */
  pedal: 15,
  /** Triplet quarters and eighths — the swung and rolling feels. */
  tuplets: 16,
  bar6: 18,
  /** The staff may be ruled in scales other than the major. */
  scales: 20,
  /** Sixteenths — the floor of the straight grid. */
  sixteenth: 24,
  bar7: 26,
  /** Five in the time of four — the last rhythmic subdivision. */
  quintuplets: 27,
  /** Tuning: the tonic may leave C. */
  tuning: 28,
  bar8: 30,
} as const;

export interface NoteDurationDef {
  id: NoteDurId;
  name: string;
  /** Grid units this occupies (a common-time bar holds BAR_UNITS = 240). */
  units: number;
  /** Musicianship level that puts it on the palette (0 = from the start). */
  unlockLevel: number;
  // Drawing hints for the sheet — engraving, not mechanics.
  head: 'open' | 'filled';
  stem: boolean;
  flags: number;
  /** Drawn with a small figure — 3 for triplet feels, 5 for quintuplet. */
  tuplet?: number;
  /** Drawn with an augmentation dot beside the head — the ×1.5 stretch. */
  dot?: boolean;
}

/**
 * Display order matters: the palette shows these coarse to fine, straight
 * before bent. Units are quarters-of-60: a dot multiplies by 1.5 (all
 * integers where it matters), a triplet crams 3 into 2 (quarter 40, eighth
 * 20), a quintuplet crams 5 into 4 (eighth 24, sixteenth 12).
 */
export const NOTE_DURATIONS: Record<NoteDurId, NoteDurationDef> = {
  whole: { id: 'whole', name: 'Whole', units: 240, unlockLevel: 0, head: 'open', stem: false, flags: 0 },
  dottedHalf: { id: 'dottedHalf', name: 'Dotted half', units: 180, unlockLevel: MUSIC_UNLOCKS.dots, head: 'open', stem: true, flags: 0, dot: true },
  half: { id: 'half', name: 'Half', units: 120, unlockLevel: 0, head: 'open', stem: true, flags: 0 },
  dottedQuarter: { id: 'dottedQuarter', name: 'Dotted quarter', units: 90, unlockLevel: MUSIC_UNLOCKS.dots, head: 'filled', stem: true, flags: 0, dot: true },
  quarter: { id: 'quarter', name: 'Quarter', units: 60, unlockLevel: MUSIC_UNLOCKS.quarter, head: 'filled', stem: true, flags: 0 },
  // The dotted eighth waits for the eighth itself plus a little practice —
  // a stretched version of a note you cannot yet write would be nonsense.
  dottedEighth: { id: 'dottedEighth', name: 'Dotted eighth', units: 45, unlockLevel: 14, head: 'filled', stem: true, flags: 1, dot: true },
  eighth: { id: 'eighth', name: 'Eighth', units: 30, unlockLevel: MUSIC_UNLOCKS.eighth, head: 'filled', stem: true, flags: 1 },
  sixteenth: { id: 'sixteenth', name: 'Sixteenth', units: 15, unlockLevel: MUSIC_UNLOCKS.sixteenth, head: 'filled', stem: true, flags: 2 },
  tripletQuarter: { id: 'tripletQuarter', name: 'Triplet quarter', units: 40, unlockLevel: MUSIC_UNLOCKS.tuplets, head: 'filled', stem: true, flags: 0, tuplet: 3 },
  tripletEighth: { id: 'tripletEighth', name: 'Triplet eighth', units: 20, unlockLevel: MUSIC_UNLOCKS.tuplets, head: 'filled', stem: true, flags: 1, tuplet: 3 },
  quintupletEighth: { id: 'quintupletEighth', name: 'Quintuplet eighth', units: 24, unlockLevel: MUSIC_UNLOCKS.quintuplets, head: 'filled', stem: true, flags: 1, tuplet: 5 },
  quintupletSixteenth: { id: 'quintupletSixteenth', name: 'Quintuplet sixteenth', units: 12, unlockLevel: MUSIC_UNLOCKS.quintuplets, head: 'filled', stem: true, flags: 2, tuplet: 5 },
};

// ---------- Meter ----------

/**
 * Time signatures the sheet can be ruled in. Common time is free; the rest
 * arrive one by one after scales (see each `unlockLevel`) — reading a bar
 * differently is a deeper literacy than reading different notes.
 *
 * A meter is NOT a speed. It sets bar CAPACITY (beats × beatUnits) and the
 * ACCENT pattern metricWeight reads. Note 6/8 vs 3/4: identical capacity,
 * different heartbeat — that is the whole lesson of meter in two rows.
 */
export const MUSIC_METERS: Record<string, MusicMeterDef> = {
  common: {
    id: 'common',
    name: '4/4 — Common time',
    icon: '🥁',
    desc: 'Four square beats, the world\'s default pulse. What every sheet assumes until told otherwise.',
    beats: 4,
    beatUnits: UNITS_PER_QUARTER,
    accents: [2 * UNITS_PER_QUARTER],
    unlockLevel: 0,
  },
  waltz: {
    id: 'waltz',
    name: '3/4 — Waltz time',
    icon: '💃',
    desc: 'Three beats and one accent: OOM-pah-pah. Shorter bars, and nothing as long as a whole note fits in them.',
    beats: 3,
    beatUnits: UNITS_PER_QUARTER,
    accents: [],
    unlockLevel: 21,
  },
  compound: {
    id: 'compound',
    name: '6/8 — Compound time',
    icon: '⛵',
    desc: 'The same length of bar as a waltz, swung entirely differently: two big pulses, each split in three. Sea shanties live here.',
    beats: 6,
    beatUnits: UNITS_PER_QUARTER / 2,
    accents: [3 * (UNITS_PER_QUARTER / 2)],
    unlockLevel: 23,
  },
  quintuple: {
    id: 'quintuple',
    name: '5/4 — Quintuple time',
    icon: '🦯',
    desc: 'Five beats limping as three-then-two. The elegant stumble — dancers count it, marchers dread it.',
    beats: 5,
    beatUnits: UNITS_PER_QUARTER,
    accents: [3 * UNITS_PER_QUARTER],
    unlockLevel: 25,
  },
};

/** The ruling every sheet starts under. */
export const DEFAULT_METER = 'common';

// ---------- Pitch ----------

/** Display names for the twelve pitch classes (sharps — the staff draws ♯). */
export const TONIC_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/**
 * Scales the staff can be ruled in. Until MUSIC_UNLOCKS.scales only the major
 * is offered. Degrees are semitones above the tonic; the octave is implied as
 * a final row, so a scale of n degrees rules the staff in n+1 rows.
 */
export const MUSIC_SCALES: Record<string, MusicScaleDef> = {
  major: {
    id: 'major',
    name: 'Major',
    desc: 'The plain daylight of music — the scale every ear grew up assuming.',
    degrees: [0, 2, 4, 5, 7, 9, 11],
    mode: 'major',
  },
  minor: {
    id: 'minor',
    name: 'Minor',
    desc: 'The same seven steps with the light taken out of three of them.',
    degrees: [0, 2, 3, 5, 7, 8, 10],
    mode: 'minor',
  },
  harmonic_minor: {
    id: 'harmonic_minor',
    name: 'Harmonic minor',
    desc: 'A minor with its seventh raised — the step home stretched into a lunge.',
    degrees: [0, 2, 3, 5, 7, 8, 11],
    mode: 'minor',
  },
  dorian: {
    id: 'dorian',
    name: 'Dorian',
    desc: 'Minor with a straight back. Sad music that refuses to slouch.',
    degrees: [0, 2, 3, 5, 7, 9, 10],
    mode: 'minor',
  },
  mixolydian: {
    id: 'mixolydian',
    name: 'Mixolydian',
    desc: 'Major with its collar loosened — the drinking-song mode.',
    degrees: [0, 2, 4, 5, 7, 9, 10],
    mode: 'major',
  },
  pentatonic: {
    id: 'pentatonic',
    name: 'Pentatonic',
    desc: 'Five notes with the arguments removed. Hard to play anything wrong in.',
    degrees: [0, 2, 4, 7, 9],
    mode: 'major',
  },
  minor_pentatonic: {
    id: 'minor_pentatonic',
    name: 'Minor pentatonic',
    desc: 'Five notes that have seen some things.',
    degrees: [0, 3, 5, 7, 10],
    mode: 'minor',
  },
  greater_harmonic: {
    id: 'greater_harmonic',
    name: 'Greater Harmonic',
    desc: 'Every step there is. Nothing is out of key because there is no key to be out of.',
    degrees: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    // NO mode, deliberately. All twelve degrees means the staff asserts
    // nothing, so this is the one ruling that still has to be guessed at —
    // `keyIn` steps aside and `findKey` searches, which is correct here.
  },
};

// ---------- Archetypes ----------

/** Every axis the classifier can score, for validation in both layers. */
export const MUSIC_AXES: readonly MusicAxis[] = [
  'mode',
  'clarity',
  'consonance',
  'syncopation',
  'pitchEntropy',
  'rhythmEntropy',
  'density',
  'restRatio',
  'conjunct',
  'range',
  'motif',
  'pace',
  'harmony',
];

/** Distance shaved off when the melody's contour matches an archetype's list. */
export const CONTOUR_AFFINITY = 0.06;

/** The same, for how the piece ENDS (see cadenceOf in systems/music.ts). */
export const CADENCE_AFFINITY = 0.05;

/**
 * How a performance can be read. Nearest-centroid over the declared axes —
 * TOTAL by construction, so every sheet is something; the dry names catch the
 * degenerate corners (one held note is a drone, uniform chaos a rhapsody)
 * exactly the way the weaponsmithing rule asked ("the game dryly names the
 * cursed ones"). Retuning a target moves what the world hears, nothing else.
 *
 * THE CALIBRATION LAW, learned the hard way: a target axis is only worth
 * declaring where DELIBERATE WRITING AND DICE DIFFER. Measured over 6,000
 * random exact-fill sheets against a corpus of hand-transcribed tunes:
 *
 *   axis            random p50   written music
 *   syncopation        0.333     0.000 in 33 of 35 fixtures
 *   rhythmEntropy      0.808     ~0.20
 *   motif              0.157     ~0.70
 *
 * `motif` and `rhythmEntropy` are the only reliable deliberateness detectors
 * in the system, so EVERY archetype now declares both — plus `syncopation`,
 * which must stay at or below ~0.15 because the noise median is 0.333 and the
 * most syncopated thing a human can write on this grid measures 0.267. The
 * shipped reel asked for 0.30 and was therefore a magnet for dice.
 *
 * Before this pass, real music scored BELOW random noise (median 0.749 vs
 * 0.826): Brahms's Wiegenlied read as a dirge, and `lullaby` won nothing at
 * all. After it, noise sits at 0.642 and every fixture clears it.
 * tests/music-identity.test.ts is what keeps that true.
 */
export const MUSIC_ARCHETYPES: Record<string, MusicArchetypeDef> = {
  lullaby: {
    id: 'lullaby',
    name: 'Lullaby',
    icon: '🌙',
    desc: 'Soft, stepwise, consonant, unhurried. Music for lowering someone gently out of the day.',
    target: {
      pace: 0.18,
      mode: 1,
      consonance: 0.75,
      syncopation: 0.05,
      rhythmEntropy: 0.18,
      pitchEntropy: 0.6,
      density: 0.2,
      conjunct: 0.85,
      restRatio: 0.08,
      motif: 0.75,
      harmony: 0.9,
    },
    // QUARTER weight, not half. At 0.5 a pedal-less lullaby was capped at
    // 0.862 purity before a note was written — and four-bar melodies almost
    // never carry a pedal, so every real cradle song paid the fee. The axis
    // still speaks; it no longer sentences.
    weights: { harmony: 0.25 },
    contours: ['arch', 'falling'],
    // A lullaby that does not come to rest has not done its job.
    cadences: ['closed'],
  },
  dirge: {
    id: 'dirge',
    name: 'Dirge',
    icon: '🕯️',
    desc: 'Slow, minor and low to the ground — grief given a walking pace.',
    target: {
      pace: 0.1,
      mode: 0,
      density: 0.15,
      consonance: 0.6,
      syncopation: 0.05,
      pitchEntropy: 0.4,
      rhythmEntropy: 0.2,
      conjunct: 0.85,
      restRatio: 0.2,
      range: 0.4,
      motif: 0.55,
    },
    contours: ['falling', 'level'],
  },
  march: {
    id: 'march',
    name: 'March',
    icon: '🥁',
    desc: 'Square on the beat and even as boots. The rhythm does the commanding.',
    target: {
      pace: 0.45,
      mode: 1,
      syncopation: 0.06,
      rhythmEntropy: 0.12,
      density: 0.4,
      consonance: 0.7,
      conjunct: 0.6,
      restRatio: 0.08,
      motif: 0.85,
    },
    contours: ['level', 'rising'],
  },
  reel: {
    id: 'reel',
    name: 'Reel',
    icon: '💃',
    desc: 'Quick, bright and tumbling — dance music that does not wait for you.',
    target: {
      pace: 0.65,
      mode: 1,
      density: 0.48,
      // Was 0.30 — which is the random-sheet syncopation median to three
      // decimals. An archetype parked on the noise cloud is a noise magnet.
      syncopation: 0.06,
      consonance: 0.62,
      conjunct: 0.6,
      rhythmEntropy: 0.18,
      pitchEntropy: 0.6,
      restRatio: 0.05,
      motif: 0.65,
    },
    // Half weights: dance tunes arpeggiate as happily as they step, and a
    // tarantella is still a dance tune for being minor.
    weights: { conjunct: 0.5, mode: 0.5 },
    // NO contour list, deliberately. 5,944 of 6,000 random sheets read
    // `undulating`, so claiming it was a flat +0.09 purity handed to noise.
    // See the note above MUSIC_ARCHETYPES.
  },
  anthem: {
    id: 'anthem',
    name: 'Anthem',
    icon: '🎺',
    desc: 'Broad, major and sure of itself, built to be sung upward.',
    target: {
      pace: 0.3,
      mode: 1,
      clarity: 0.9,
      consonance: 0.78,
      density: 0.25,
      range: 0.75,
      // `conjunct` is what stops this becoming the catch-all. Without it,
      // anthem was simply "a moderate tune in a major key" and it ate the
      // lullabies, the marches and a ragtime. An anthem is SUNG: it steps,
      // then leaps upward for the big note — appreciably less stepwise than
      // a cradle song and appreciably more than a riff.
      conjunct: 0.6,
      syncopation: 0.05,
      restRatio: 0.08,
      pitchEntropy: 0.45,
      rhythmEntropy: 0.22,
      motif: 0.5,
    },
    contours: ['rising', 'arch'],
    cadences: ['closed'],
  },
  incantation: {
    id: 'incantation',
    name: 'Incantation',
    icon: '🕸️',
    desc: 'Narrow, circling, insistent — melody worn down to a murmured formula.',
    target: {
      pace: 0.31,
      mode: 0,
      pitchEntropy: 0.3,
      range: 0.28,
      density: 0.35,
      restRatio: 0.1,
      syncopation: 0.05,
      rhythmEntropy: 0.15,
      conjunct: 0.9,
      motif: 0.9,
      // Circling over a pedal it does not quite agree with — the sound of
      // a formula being repeated at something.
      harmony: 0.35,
    },
    weights: { harmony: 0.5 },
    contours: ['level'],
  },
  rhapsody: {
    id: 'rhapsody',
    name: 'Rhapsody',
    icon: '🌀',
    desc: 'Leaping, restless, overfull — music holding more ideas than manners.',
    // Deliberate restlessness still restates SOMETHING — hence motif 0.45
    // rather than 0.15, which was asking for dice. `rhythmEntropy: 0.70` was
    // simply unreachable: the shipped duration palette tops out near 0.65.
    target: {
      pace: 0.6,
      pitchEntropy: 0.75,
      rhythmEntropy: 0.45,
      syncopation: 0.12,
      consonance: 0.5,
      range: 0.85,
      conjunct: 0.35,
      motif: 0.45,
      density: 0.5,
    },
    // No contour list — see reel. Rhapsody remains the dry name for chaos,
    // but it now names it at ~0.64 purity instead of ~0.83.
  },
  drone: {
    id: 'drone',
    name: 'Drone',
    icon: '🐝',
    desc: 'One long sound standing very still. Less a tune than a place to put one.',
    target: {
      pace: 0.06,
      density: 0.04,
      pitchEntropy: 0.05,
      range: 0.04,
      restRatio: 0.1,
      rhythmEntropy: 0.08,
      syncopation: 0.02,
      motif: 0.85,
    },
    contours: ['level'],
  },
  ostinato: {
    id: 'ostinato',
    name: 'Ostinato',
    icon: '🔩',
    desc: 'A figure that will not let go — the same handful of notes hammered flat, often over a tone that never moves.',
    target: {
      density: 0.8,
      restRatio: 0.04,
      syncopation: 0.05,
      rhythmEntropy: 0.08,
      motif: 0.9,
      conjunct: 0.35,
      consonance: 0.75,
      pace: 0.5,
      pitchEntropy: 0.4,
      harmony: 0.85,
    },
    // Half weights: the region is a RIDGE along density — a riff is a riff in
    // eighths or in sixteenths — and a riff without a pedal is still a riff.
    weights: { harmony: 0.5, density: 0.5 },
    contours: ['level'],
    // No cadence list: a riff does not resolve, it simply stops.
  },
  perpetuum: {
    id: 'perpetuum',
    name: 'Perpetuum',
    icon: '🌪️',
    desc: 'Notes with no gap between them, taken faster than the ear can count. It stops only because the page does.',
    target: {
      pace: 0.82,
      density: 0.85,
      restRatio: 0.02,
      rhythmEntropy: 0.05,
      syncopation: 0.05,
      conjunct: 0.85,
      motif: 0.8,
      pitchEntropy: 0.7,
    },
    contours: ['rising'],
  },
  patter: {
    id: 'patter',
    name: 'Patter',
    icon: '🐦',
    desc: 'More air than note — quick scraps thrown out and let fall. Half of it is the silence afterwards.',
    target: {
      restRatio: 0.5,
      density: 0.18,
      pace: 0.62,
      rhythmEntropy: 0.2,
      syncopation: 0.05,
      range: 0.7,
      motif: 0.65,
      consonance: 0.8,
    },
  },
  keening: {
    id: 'keening',
    name: 'Keening',
    icon: '🪦',
    desc: 'Intervals that refuse to agree, in a key that cannot quite be found. Grief past the point of tune.',
    // Declares NO mode, on purpose: chromatic music has no honest mode, and
    // `mode` is binary — a wrong reading costs a full 1.0 on one axis, the
    // largest single error term this classifier can produce.
    target: {
      consonance: 0.28,
      clarity: 0.6,
      pitchEntropy: 0.85,
      range: 0.8,
      conjunct: 0.5,
      pace: 0.22,
      density: 0.25,
      restRatio: 0.1,
      rhythmEntropy: 0.2,
      syncopation: 0.05,
      motif: 0.7,
    },
    // Half weight: a piece can be this harsh and still land in a key.
    weights: { clarity: 0.5 },
    contours: ['falling'],
  },
  knell: {
    id: 'knell',
    name: 'Knell',
    icon: '🔔',
    desc: 'One note struck, and then a long time. Everything that happens, happens in what follows it.',
    target: {
      restRatio: 0.55,
      density: 0.07,
      pitchEntropy: 0.08,
      range: 0.08,
      motif: 0.85,
      rhythmEntropy: 0.1,
      syncopation: 0.03,
      pace: 0.15,
    },
    contours: ['level'],
  },
};

// ---------- Performance pacing ----------

/** Tempo, as scores write it: ♩ = bpm. The unhurried default, and the walls. */
export const DEFAULT_BPM = 80;
export const MIN_BPM = 40;
export const MAX_BPM = 200;

/**
 * Ticks one grid unit takes at a given tempo. ♩ = bpm means 60/bpm seconds
 * per quarter, a quarter is UNITS_PER_QUARTER units, and a tick is 100 ms —
 * so this is simply 10/bpm. Quarter-referenced, hence meter-independent:
 * re-ruling 4/4 as 6/8 changes the bar, never the speed.
 *
 * Fractions are fine — performance totals are summed over the whole sheet
 * and ceiled exactly once (see performanceTicks).
 */
export function ticksPerUnit(bpm: number): number {
  return 60 / bpm / UNITS_PER_QUARTER * 10;
}

/** Ticks per unit at the default tempo (0.125 — a quarter every 0.75 s). */
export const TICKS_PER_UNIT = ticksPerUnit(DEFAULT_BPM);

/** Ticks one COMMON-TIME bar takes — other meters scale by their capacity. */
export const TICKS_PER_BAR = BAR_UNITS * TICKS_PER_UNIT;

/** Musicianship XP per tick of performing (the drill trickle). */
export const MUSIC_XP_PER_TICK = 0.05;

/**
 * Completion XP per sounded note, scaled by how purely the piece reads
 * (0.5–1.0×) — a tighter composition teaches more than a muddle of the same
 * length.
 */
export const MUSIC_XP_PER_NOTE = 0.75;
