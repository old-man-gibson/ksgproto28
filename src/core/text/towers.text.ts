import type { ProseTable } from './prose';

// Player-facing text for src/core/data/towers.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- TOWERS ----------
export const TOWERS_TEXT: ProseTable = {
  'the_ascent.desc': 'It was here before Threshold was, and the city grew around its foot the way a town grows around a river crossing. Eight roads reach it. All eight arrive at the same door.',
};

// ---------- BANDS ----------
export const BANDS_TEXT: ProseTable = {
  'ascent_lower.desc': 'Floors the city still uses. Storerooms, a flooded stair, the old toll level nobody collects on any more.',

  'ascent_middle.desc': 'Above the last floor anyone has a key to.',

  'ascent_upper.desc': 'Visible from every district, and from nowhere else.',
};

// ---------- FLOORS ----------
export const FLOORS_TEXT: ProseTable = {
  'ascent_f1.desc': 'The city used to pay to pass. The vermin never stopped collecting.',

  'ascent_f2.desc': 'Somewhere above, water gets in. It has had a very long time to argue with the stonework.',

  'ascent_f3.desc': 'Nobody remembers what this floor was for. The webs go back further than the records do.',
};
