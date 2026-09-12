import type { ProseTable } from './prose';

// Player-facing text for src/core/data/towers.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- TOWERS ----------
export const TOWERS_TEXT: ProseTable = {
  'the_ascent.desc': 'A stack of floors entered through the door at the Foot of the Ascent. Floors are cleared in order; every floor and its gate are visible from the start.',
};

// ---------- BANDS ----------
export const BANDS_TEXT: ProseTable = {
  'ascent_lower.desc': 'Floors 1 to 3: the Old Toll Level, the Flooded Stair and the Silk Gallery. Each floor must be cleared before the next opens.',

  'ascent_middle.desc': 'Band 2 of the Ascent, above the Lower Reaches. No floors yet.',

  'ascent_upper.desc': 'Band 3 of the Ascent, the top of the stack. No floors yet.',
};

// ---------- FLOORS ----------
export const FLOORS_TEXT: ProseTable = {
  'ascent_f1.desc': 'Floor 1. No gate. Cleared by defeating the keeper of the Toll Hall: a Hobgoblin by day or a Slimer by night.',

  'ascent_f2.desc': 'Floor 2. Gate: 150 gold earned in total. Cleared by winning 8 fights in the Broken Cistern, which forces a fight on arrival.',

  'ascent_f3.desc': 'Floor 3. Gate: 600 gold earned in total. Cleared by killing the Giant Spider Queen in the Brood Den.',
};
