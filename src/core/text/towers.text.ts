import type { ProseTable } from './prose';

// Player-facing text for src/core/data/towers.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- TOWERS ----------
export const TOWERS_TEXT: ProseTable = {
  'the_ascent.desc': 'A stack of floors entered through the door at the Foot of the Ascent. Floors are cleared in order, except the city’s four wards, which open together and may be cleared in any order; every floor and its gate are visible from the start.',
};

// ---------- BANDS ----------
export const BANDS_TEXT: ProseTable = {
  'ascent_lower.desc': 'Floors 1 to 3: the Old Toll Level, the Flooded Stair and the Silk Gallery. Each floor must be cleared before the next opens.',

  'ascent_harbor.desc': 'Floors 11 to 14, the harbor band. Floors 12 to 14 are skeletons. Placeholder text.',

  'ascent_festival.desc': 'Floors 15 and 16, the Vermin Festival. Skeletons. Placeholder text.',

  'ascent_aberrant.desc': 'Floor 17, a special floor. Skeleton; theme not set. Placeholder text.',

  'ascent_desert.desc': 'Floors 18 to 20: the Necropolis Road, the Pyramid and the Delta Port. Each floor must be cleared before the next opens. Floors 19 and 20 also need desert kills: 60, then 150 in all. Placeholder text.',

  'ascent_middle.desc': 'Floors 4 to 6: the Greenwood, the Mire and the Warren. A goblin war band holds the wilds above the Lower Reaches; its warchief waits at the bottom of the Warren. Placeholder text.',

  'ascent_upper.desc': 'Floors 7 to 10: a city whose castle is the band’s hub, and its four wards, south, west, north and east. Gate: the Key to the City prestige boon. The wards open together and may be cleared in any order; each one cleared raises the level of every monster in the wards by +2, then +5, then +9. Placeholder text.',
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

  'ascent_f7.desc': 'Floor 7, the city’s south ward: the docks, the salt marsh past the south gate, and the Giant Spider Queen in the wreck, whose kill is the clear. Stand-in monsters. Placeholder text.',

  'ascent_f8.desc': 'Floor 8, the city’s west ward, facing the forest: the forest gate, the old forest past it, and the Hobgoblin Champion in the hunting lodge, whose kill is the clear. Stand-in monsters. Placeholder text.',

  'ascent_f9.desc': 'Floor 9, the city’s north ward: the cathedral close, the barrow fields past the north gate, and a Death Knight in the ossuary, whose kill is the clear. Stand-in monsters. Placeholder text.',

  'ascent_f10.desc': 'Floor 10, the city’s east ward: the artificers’ row, the quarry past the east gate, and a Stone Golem in the foundry, whose kill is the clear. Stand-in monsters. Placeholder text.',

  'ascent_f11.desc': 'Floor 11. On your first climb here: the stronghold. Repair it through the steward’s two quests, then hold the wall through eight fights; the eighth ends the run in an automatic prestige, and the stronghold stays yours on every later run. On later runs: the door to your hold is in the gatehouse, and the road leads on to the quay; the roadstead fight there clears the floor. Placeholder monsters. Placeholder text.',

  // ==== HARBOR: floor text (skeleton 2026-10-30; the harbor builder's section) ====
  'ascent_f12.desc': 'Floor 12, a skeleton: a landing with a placeholder hunt and a keeper whose fight clears the floor. Placeholder text.',
  'ascent_f13.desc': 'Floor 13, a skeleton: a landing with a placeholder hunt and a keeper whose fight clears the floor. Placeholder text.',
  'ascent_f14.desc': 'Floor 14, a skeleton: a landing with a placeholder hunt and a keeper whose fight clears the floor. Placeholder text.',

  // ==== FESTIVAL: floor text (skeleton 2026-10-30; the festival builder's section) ====
  'ascent_f15.desc': 'Floor 15, a skeleton: a landing with a placeholder hunt and a keeper whose fight clears the floor. Placeholder text.',
  'ascent_f16.desc': 'Floor 16, a skeleton: a landing with a placeholder hunt and a keeper whose fight clears the floor. Placeholder text.',

  // ==== ABERRANT: floor text (skeleton 2026-10-30; the aberrant builder's section) ====
  'ascent_f17.desc': 'Floor 17, a skeleton: a landing with a placeholder hunt and a keeper whose fight clears the floor. Placeholder text.',

  // ==== DESERT: floor text (skeleton 2026-10-30; the desert builder's section) ====
  'ascent_f18.desc': 'Floor 18, the Necropolis Road: open desert between five obelisks, each a haven, with dens of desert monsters along the road. Each obelisk read adds one to your chart; with three, the roadstead crew on floor 20 starts its fight surprised. The forecourt guardian’s kill is the clear, and it fights again on every visit. Placeholder text.',
  'ascent_f19.desc': 'Floor 19, the Pyramid. Opens at 60 desert kills. The treasury off the burial chamber holds six grave goods; each one taken raises the judge at the door. The judge’s kill is the clear, and seals the treasury for the rest of the run. Placeholder text.',
  'ascent_f20.desc': 'Floor 20, the Delta Port. Opens at 150 desert kills. A quay, a broker, warehouses and the roadstead. The roadstead fight is the crossing to floor 21 and the clear. Placeholder text.',
};
