import type { ProseTable } from './prose';

// Player-facing text for src/core/data/music.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- MUSIC_METERS ----------
export const MUSIC_METERS_TEXT: ProseTable = {
  'common.desc': '4 quarter-note beats per bar (240 units), secondary accent on beat 3. The meter every sheet starts in.',

  'waltz.desc': '3 quarter-note beats per bar (180 units), accent on beat 1 only. A whole note does not fit in the bar. Musicianship 21.',

  'compound.desc': '6 eighth-note beats per bar (180 units, the same capacity as 3/4), secondary accent on beat 4, so the bar reads as two groups of three. Musicianship 23.',

  'quintuple.desc': '5 quarter-note beats per bar (300 units), secondary accent on beat 4, so the bar reads as three beats then two. Musicianship 25.',
};

// ---------- MUSIC_SCALES ----------
export const MUSIC_SCALES_TEXT: ProseTable = {
  'major.desc': 'Semitones 0, 2, 4, 5, 7, 9, 11 above the tonic. Major mode. The only scale offered until Musicianship 20.',

  'minor.desc': 'Semitones 0, 2, 3, 5, 7, 8, 10 above the tonic. Minor mode.',

  'harmonic_minor.desc': 'Semitones 0, 2, 3, 5, 7, 8, 11 above the tonic. Minor mode with the seventh raised one semitone.',

  'dorian.desc': 'Semitones 0, 2, 3, 5, 7, 9, 10 above the tonic. Minor mode with the sixth raised one semitone.',

  'mixolydian.desc': 'Semitones 0, 2, 4, 5, 7, 9, 10 above the tonic. Major mode with the seventh lowered one semitone.',

  'pentatonic.desc': 'Semitones 0, 2, 4, 7, 9 above the tonic. Major mode, five degrees.',

  'minor_pentatonic.desc': 'Semitones 0, 3, 5, 7, 10 above the tonic. Minor mode, five degrees.',

  'greater_harmonic.desc': 'All twelve semitones. Declares no mode, so the key of a piece written in it is found by analysis.',
};

// ---------- MUSIC_ARCHETYPES ----------
export const MUSIC_ARCHETYPES_TEXT: ProseTable = {
  'lullaby.desc': 'Names a performance that measures slow, major, consonant and stepwise, with low syncopation, a repeated motif, an arch or falling contour and a closed cadence. A pedal tone counts at quarter weight.',

  'dirge.desc': 'Names a performance that measures very slow, minor, sparse and stepwise, with a narrow range and a falling or level contour.',

  'march.desc': 'Names a performance that measures moderate pace, major, very regular rhythm, low syncopation, a strongly repeated motif and a level or rising contour.',

  'reel.desc': 'Names a performance that measures fast, dense, with few rests, low syncopation and a repeated motif. Mode and stepwise motion count at half weight; contour is not scored.',

  'anthem.desc': 'Names a performance that measures moderate pace, major, in a clear key, consonant, wide in range, moderately stepwise, with a rising or arch contour and a closed cadence.',

  'incantation.desc': 'Names a performance that measures moderate pace, minor, narrow in range, low in pitch variety, stepwise, with a strongly repeated motif, a level contour and a pedal tone that does not agree with the key.',

  'rhapsody.desc': 'Names a performance that measures fast, high in pitch and rhythm variety, wide in range, leaping, low in consonance and weak in motif. Contour is not scored. Random or unstructured sheets usually land here.',

  'drone.desc': 'Names a performance that measures very slow, near-zero density, near-zero range, one pitch held, with a level contour.',

  'ostinato.desc': 'Names a performance that measures dense, with few rests, regular rhythm, a strongly repeated motif, leaping motion, a level contour and a pedal tone. Density and pedal count at half weight; cadence is not scored.',

  'perpetuum.desc': 'Names a performance that measures fastest pace, highest density, almost no rests, uniform rhythm, stepwise, with a rising contour.',

  'patter.desc': 'Names a performance that measures fast, about half rests, low density, wide in range and consonant. Contour is not scored.',

  'keening.desc': 'Names a performance that measures low in consonance, high in pitch variety, wide in range, slow, with a falling contour. Mode is not scored; key clarity counts at half weight.',

  'knell.desc': 'Names a performance that measures more than half rests, very low density, one pitch, slow, with a level contour.',
};
