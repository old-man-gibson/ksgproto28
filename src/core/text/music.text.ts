import type { ProseTable } from './prose';

// Player-facing text for src/core/data/music.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- MUSIC_METERS ----------
export const MUSIC_METERS_TEXT: ProseTable = {
  'common.desc': 'Four square beats, the world\'s default pulse. What every sheet assumes until told otherwise.',

  'waltz.desc': 'Three beats and one accent: OOM-pah-pah. Shorter bars, and nothing as long as a whole note fits in them.',

  'compound.desc': 'The same length of bar as a waltz, swung entirely differently: two big pulses, each split in three. Sea shanties live here.',

  'quintuple.desc': 'Five beats limping as three-then-two. The elegant stumble — dancers count it, marchers dread it.',
};

// ---------- MUSIC_SCALES ----------
export const MUSIC_SCALES_TEXT: ProseTable = {
  'major.desc': 'The plain daylight of music — the scale every ear grew up assuming.',

  'minor.desc': 'The same seven steps with the light taken out of three of them.',

  'harmonic_minor.desc': 'A minor with its seventh raised — the step home stretched into a lunge.',

  'dorian.desc': 'Minor with a straight back. Sad music that refuses to slouch.',

  'mixolydian.desc': 'Major with its collar loosened — the drinking-song mode.',

  'pentatonic.desc': 'Five notes with the arguments removed. Hard to play anything wrong in.',

  'minor_pentatonic.desc': 'Five notes that have seen some things.',

  'greater_harmonic.desc': 'Every step there is. Nothing is out of key because there is no key to be out of.',
};

// ---------- MUSIC_ARCHETYPES ----------
export const MUSIC_ARCHETYPES_TEXT: ProseTable = {
  'lullaby.desc': 'Soft, stepwise, consonant, unhurried. Music for lowering someone gently out of the day.',

  'dirge.desc': 'Slow, minor and low to the ground — grief given a walking pace.',

  'march.desc': 'Square on the beat and even as boots. The rhythm does the commanding.',

  'reel.desc': 'Quick, bright and tumbling — dance music that does not wait for you.',

  'anthem.desc': 'Broad, major and sure of itself, built to be sung upward.',

  'incantation.desc': 'Narrow, circling, insistent — melody worn down to a murmured formula.',

  'rhapsody.desc': 'Leaping, restless, overfull — music holding more ideas than manners.',

  'drone.desc': 'One long sound standing very still. Less a tune than a place to put one.',

  'ostinato.desc': 'A figure that will not let go — the same handful of notes hammered flat, often over a tone that never moves.',

  'perpetuum.desc': 'Notes with no gap between them, taken faster than the ear can count. It stops only because the page does.',

  'patter.desc': 'More air than note — quick scraps thrown out and let fall. Half of it is the silence afterwards.',

  'keening.desc': 'Intervals that refuse to agree, in a key that cannot quite be found. Grief past the point of tune.',

  'knell.desc': 'One note struck, and then a long time. Everything that happens, happens in what follows it.',
};
