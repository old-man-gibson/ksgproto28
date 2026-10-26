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

  'ascent_middle.desc': 'Floors 4 to 6: the Greenwood, the Mire and the Warren. A goblin war band holds the wilds above the Lower Reaches; its warchief waits at the bottom of the Warren. Placeholder text.',

  'ascent_upper.desc': 'Band 3 of the Ascent, the top of the stack. No floors yet.',
};

// ---------- FLOORS ----------
export const FLOORS_TEXT: ProseTable = {
  'ascent_f0.desc': 'Floor 0, the tutorial. Not on the ladder: it opens nothing and is left by the one-way gate into Threshold. A new life starts in its holding cell.',

  "ascent_f1.desc": "Find the toll stamp in the flooded offices. Drive out the vermin, search for the clerk’s daybook, and follow its room sequence to the collector.",

  'ascent_f2.desc': 'Floor 2, the same building one storey up. Gate: 150 gold earned in total. Fight down the Long Hall, four stretches of 3 fights each; the far end’s third win clears the floor. The tutor, the quartermaster and a break room are off the hall.',

  'ascent_f3.desc': 'Floor 3, the same building going down its stairwell. Gate: 600 gold earned in total. Each landing’s side room holds the floor plan to the next flight and a string anchor; the Hearing Room at the bottom holds the Puppet Bureaucrat, whose kill clears the floor.',
  'ascent_f4.desc': 'Floor 4, woodland, hills and a ravine. Every hunt is endless, and goblin raid parties roll into them. Herbs, game meat and copper ore come from here. Clear: kill the Goblin Raid Leader at the Raid Camp. Placeholder text.',

  'ascent_f5.desc': 'Floor 5, a swamp and the caves under it. Gate: 12 goblins killed. Firetongues cast fire; hobgoblins fight with techniques you can learn by watching; the Hollows are dark. Clear: find the warren’s back door in the Hollows and kill the Hobgoblin Champion guarding it. Placeholder text.',

  'ascent_f6.desc': 'Floor 6, the goblin warren, two maps. Gate: 40 goblins killed. Three sabotages in the outer warren each take a level off the Goblin Warchief. Clear: kill the warchief in the Great Hall, which also opens prestige. Placeholder text.',
};
