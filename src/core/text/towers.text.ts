import type { ProseTable } from './prose';

// Player-facing text for src/core/data/towers.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- TOWERS ----------
export const TOWERS_TEXT: ProseTable = {
  'the_ascent.desc': 'A stack of floors entered through the door at the Foot of the Ascent. Floors are cleared in order, except the city’s four wards, which open together and may be cleared in any order. A floor is named once its door is reached; the next band shows only its name.',
};

// ---------- BANDS ----------
export const BANDS_TEXT: ProseTable = {
  'ascent_lower.desc': 'Floors 1 to 3: the Old Toll Level, the Flooded Stair and the Silk Gallery. Each floor must be cleared before the next opens.',

  'ascent_harbor.desc': 'Floors 11 to 14, the harbor band. Pick a side at the harbor on floor 11 (merchants, pirates, privateers or the navy; one per run), sail its convoys on floors 11 to 13 for crates, and finish its mission on floor 14. Placeholder text.',

  'ascent_festival.desc': 'Floors 15 and 16, the Vermin Festival: ten rooms of ten, one survivor from each, then one of a hundred. The festival keeps its own clock, which runs only while the game does; time away inside it goes to banked bonus time. Placeholder text.',

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

  'ascent_f7.desc': 'Floor 7, the city’s south ward: bandits raiding the merchants and convoys that feed the city. The ward’s form depends on how many of the other three wards are cleared this run. None: 12 fights on the merchant road. One or two: siege the bandits’ camp in the salt flats, the stockade and the watchtowers, then the chief in his tent. All three: a demon in the burnt camp, for 24 in-game hours; floor 7 clears when it dies or when the time runs out. Placeholder text.',

  'ascent_f8.desc': 'Floor 8, the city’s west ward, facing the forest: the forest gate, the old forest past it, and a rogue beast in the hunting lodge. The fighting in the city crowds the beasts into the forest, and the beast changes under it: with one or none of the other wards cleared it is the young form, with two or three the final form. Clear: win the lodge’s one fight. Placeholder text.',

  'ascent_f9.desc': 'Floor 9, the city’s north ward: the cathedral close, the barrow fields past the north gate, and the ossuary’s keeper. With one or none of the other wards cleared it is a Death Squire, with two or three a Death Knight. Clear: win the ossuary’s one fight. Placeholder text.',

  'ascent_f10.desc': 'Floor 10, the city’s east ward: the artificers’ row, the mine past the east gate, and an ore eater in the deep seam below it. The eater is at stage 1 with none of the other wards cleared and one stage larger for each one cleared, up to stage 4 with all three. Clear: win the deep seam’s one fight. Placeholder text.',

  'ascent_f11.desc': 'Floor 11. On your first climb here: the stronghold. Repair it through the steward’s two quests, then hold the wall through eight fights; the eighth ends the run in an automatic prestige, and the stronghold stays yours on every later run. On later runs: the door to your hold is in the gatehouse, and the road leads on to the harbor, where a join quest picks your side for the run. Clear: 8 crates won on the roadstead’s convoy and one fight won there. Placeholder monsters. Placeholder text.',

  // ==== HARBOR: floor text (skeleton 2026-10-30; the harbor builder's section) ====
  'ascent_f12.desc': 'Floor 12, the crossings: two ports and the water between them. Sailing out of a port is a boarding. Your side’s lane is long and weak, the strait short and strong; the pirates also have a hidden cove. Clear: 40 crates won this run and one fight won on the far water. Placeholder text.',
  'ascent_f13.desc': 'Floor 13, the blockade. Through the picket line you arrive Flat-Footed; through the Pilot’s Channel, bought at the Last Port, the blockaders start Surprised. Clear: 160 crates won this run and one fight won on the blockade. Placeholder text.',
  'ascent_f14.desc': 'Floor 14, the final mission: one wing per side, and only yours is open. Killing its boss clears the floor. Placeholder text.',

  // ==== FESTIVAL: floor text (skeleton 2026-10-30; the festival builder's section) ====
  'ascent_f15.desc': 'Floor 15, the Vermin Festival’s first floor. Landing here starts an attempt: your gear is held at the door and one plain weapon is issued. Empty the dark room of its nine to clear the floor and open the hall, where ten festival days pass before the royale. Losing a fight here, or taking the ladder anywhere but floor 16, loses the attempt: you land outside the tower and floors 15 and 16 shut for three days or until the next prestige. Placeholder text.',
  'ascent_f16.desc': 'Floor 16, the royale: ninety-nine survivors of the other rooms and you, on one field. Climbing here from the hall before the ten days are out jumps the festival’s clock to the end; the survivors get the rest of their preparation either way. Win the royale to clear the floor and get your gear back. Placeholder text.',

  // ==== ABERRANT: floor text (skeleton 2026-10-30; the aberrant builder's section) ====
  'ascent_f17.desc': 'Floor 17, a skeleton: a landing with a placeholder hunt and a keeper whose fight clears the floor. Placeholder text.',

  // ==== DESERT: floor text (skeleton 2026-10-30; the desert builder's section) ====
  'ascent_f18.desc': 'Floor 18, the Necropolis Road: open desert between five obelisks, each a haven, with dens of desert monsters along the road. Each obelisk read adds one to your chart; with three, the roadstead crew on floor 20 starts its fight surprised. The forecourt guardian’s kill is the clear, and it fights again on every visit. Placeholder text.',
  'ascent_f19.desc': 'Floor 19, the Pyramid. Opens at 60 desert kills. The treasury off the burial chamber holds six grave goods; each one taken raises the judge at the door. The judge’s kill is the clear, and seals the treasury for the rest of the run. Placeholder text.',
  'ascent_f20.desc': 'Floor 20, the Delta Port. Opens at 150 desert kills. A quay, a broker, warehouses and the roadstead. The roadstead fight is the crossing to floor 21 and the clear. Placeholder text.',
};
