import type { ProseTable } from './prose';

// Player-facing text for src/core/data/locations.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- SPOTS ----------
export const SPOTS_TEXT: ProseTable = {
  "f1_landing.desc": "Water runs down the stair and spreads beneath the doors. Somewhere inside, a stamp strikes a desk. Find the toll stamp still being used on this floor.",
  "f1_storerooms.desc": "Rats crowd the fallen shelves. Drive them out and watch where they flee.",
  "f1_bonded_deep.desc": "The fleeing vermin leave a gap beneath a shelf. Beyond it, cupboards and sodden files line a long passage. Search the rooms for a record of the toll stamp.",
  "f1_archive.desc": "Daybooks sit on the upper shelves, above the waterline. Search here for the collector’s records.",
  "f1_lockers.desc": "Coats hang above flooded lockers. Loose coins and tools collect beneath them.",
  "f1_forms.desc": "Drawers of blank forms swell against their frames. An old sign points toward the office reception.",
  "f1_reception.desc": "The reception desk is dry underneath. Search it before trying the office doors. Each door names the room beyond; the daybook records the order of the clerk’s visits.",
  "f1_registry.desc": "Numbered drawers reach the ceiling. The water has carried their labels across the floor.",
  "f1_scribe.desc": "Form templates lie beneath a paperweight. A ruler projects from the drawer beside them.",
  "f1_auditor.desc": "A validation ledger lies open beside a stack of rejected forms.",
  "f1_break_room.desc": "A bowl of wax apples sits between two empty cups.",
  "f1_dispatch.desc": "Pigeonholes cover the wall. Unsent envelopes cling to the table legs.",
  "f1_records.desc": "Copies of the same receipt hang from drying lines.",
  "f1_supplies.desc": "Boxes of spare nibs stand on a stool above the water.",
  "f1_toll_hall.desc": "A golem stands submerged behind a desk, stamping sodden documents. The water around it can become steam, ice, or a conductor. The toll stamp remains in its hand.",

  'base_entrance.desc': 'The door into your hold, from the gatehouse on floor 11. It opens once the stronghold is held, and stays open on every later run. Leads to the Main Hall; a one-way door also lets you out to the Foot of the Ascent.',

  'base_equipment_depot.desc': 'Storage room for gear. No activities. Connects to the Main Hall, the Dining Hall, the Infirmary and the Training Area.',

  'base_main_hall.desc': 'Hub of your hold. No activities. Connects to the Entrance, the Research Hallway, the Trophy Hallway, the Dining Hall and the Strategy Room.',

  'base_trophy_hallway.desc': 'Corridor between the Main Hall and the Throneroom. No activities.',

  'base_arcane_library.desc': 'Holds a Spell Table for inscribing spells. Study the Stacks trains Intelligence. Connects to the Research Hallway, the Psionics Lab and the Library Annex.',

  'base_research_hallway.desc': 'Corridor from the Main Hall to the Alchemy Lab, the Mutagen Lab, the Psionics Lab, the Arcane Library and the Workshop. No activities.',

  'base_alchemy_lab.desc': 'Holds an alchemy bench for brewing. The study activity trains Intelligence and pays Alchemy skill XP. Connects to the Research Hallway and the Clone Vats.',

  'base_mutagen_lab.desc': 'Holds a Culture Bench for geneshaping. Connects to the Research Hallway, the Psionics Lab and the Clone Vats.',

  'base_clone_vats.desc': 'Vat room off the Alchemy Lab and the Mutagen Lab. No activities or benches yet.',

  'base_psionics_lab.desc': 'Meditate on the Will trains Charisma. Reached from the Arcane Library, the Research Hallway or the Mutagen Lab.',

  'base_dining_hall.desc': 'No activities. Connects the Main Hall, the Staff Quarters, the Equipment Depot, the Kitchen and the Farm.',

  'base_chapel.desc': 'Keep a Vigil trains Wisdom. No deity pedestals are installed yet. Connects to the Throneroom and the Chapel Annex.',

  'base_farm.desc': 'Three gather activities: Tend the Vegetable Rows yields wild onion (12 s), Keep the Henhouse yields bird egg (16 s), Cut the Herb Beds yields common herb (14 s). The rows and the herb beds pay Herbalism XP. Connects to the Kitchen, the Dining Hall and the Pantry.',

  'base_kitchen.desc': 'Holds the full cooking line: preparing, assembling, cooking, baking and grilling benches. Connects to the Dining Hall, the Farm, the Staff Quarters and the Pantry.',

  'base_staff_quarters.desc': 'Bunk room for crafted workers; none exist yet. No activities. Connects to the Dining Hall, the Kitchen, the Equipment Depot and the Infirmary.',

  'base_chapel_annex.desc': 'Storeroom off the Chapel. No activities.',

  'base_bedroom.desc': 'Sleep in Your Own Bed is a rest activity; resting here makes this room a haven. Connects to the Throneroom and the Library Annex.',

  'base_throneroom.desc': 'Hold Court trains Charisma. Connects to the Trophy Hallway, the Bedroom, the Chapel, the Library Annex and the Strategy Room.',

  'base_strategy_room.desc': 'Draw Up Campaigns trains Intelligence. Connects to the Throneroom and the Main Hall.',

  'base_pantry.desc': 'Storage room off the Kitchen and the Farm. No activities.',

  'base_library_annex.desc': 'Annotate the Margins trains Wisdom. Connects to the Arcane Library, the Bedroom and the Throneroom.',

  'base_training_area.desc': 'Drill Forms trains Strength and pays combat skill XP. Work the Dummies fights a level 1 Training Dummy that never rolls a modifier. Connects to the Equipment Depot and the Infirmary.',

  'base_infirmary.desc': 'Convalesce is a rest activity; resting here makes this room a haven. Connects to the Staff Quarters, the Equipment Depot and the Training Area.',

  'base_workshop.desc': 'Holds a Rune Table for runecarving. Connects to the Research Hallway and Material Storage.',

  'base_material_storage.desc': 'Storage room off the Workshop. No activities.',

  'ascent_foot.desc': 'Hub of Threshold and the door to the Ascent. Rest at the Doorstep Inn makes this the city haven: a lost fight returns you here. All eight district roads end here, 1 s each. The Warden of the Foot stands here and gives the starting quests.',

  'lectory_steps.desc': 'Gate of the Scholars’ Quarter. Argue on the Steps trains Intelligence. Connects to the Foot, the Reading Hall, the Chalk Yard, the Granary Gate and the Pilgrims’ Stair.',

  'the_reading_hall.desc': 'Indoor. Holds a Spell Table for inscribing spells. Read Until It Sticks trains Intelligence. Sit With a Hard Passage trains Wisdom and pays magic skill XP. Docent Marell stands here.',

  'chalk_yard.desc': 'Read the Old Working explores the yard (42 s). Copy Out a Proof trains Intelligence.',
  // Placeholder text for the find: replace with your own.
  'chalk_yard.finds.chalk_yard_purse.desc': '💰 A purse under the chalk working on the flagstones: 10 to 15 gold.',

  'temple_rise_gate.desc': 'Gate of Temple Rise. Walk the Stair trains Constitution. Connects to the Foot, the Nine Chapels, Censer Walk, the Lectory Steps and the Muster Gate.',

  'the_cages.dare.desc': 'Oh dang, this slime’s gotten big. I don’t think you should tackle that, but if you wanna try yer luck, go ahead.',
  'the_nine_chapels.desc': 'Indoor. Holds a Spellcrafting Table: its Divine tab teaches miracles for favor. Keep a Vigil trains Wisdom and pays magic skill XP. Prior Ashvane stands here.',

  'censer_walk.desc': 'Colonnade off the Pilgrims’ Stair. Work the Colonnade trains Charisma. Ilex stands here.',

  'ironyard_gate.desc': 'Gate of the Ironyard. Drill in Formation trains Strength. Captain Hurst stands here. Connects to the Foot, the Cages, the Sand, the Long Gallery, the Pilgrims’ Stair and the Retort Gate.',

  'the_cages.desc': 'Menagerie. Step Into a Cage fights one Forest Rat, Cage-Bred Slime or Goblin at a time (levels 1 to 3), never a rolled modifier. The slimes are bred with no armour or resistances. Kills here unlock each bestiary fact exactly at its kill count. The keeper heals beginners after every win.',

  'the_sand.desc': 'Footwork on the Sand trains Dexterity. Spar trains Strength and pays combat skill XP. Master Ekwe stands here.',

  'long_gallery.desc': 'Indoor archery range. Shoot the Long Butts trains Dexterity; Draw Until It Hurts trains Constitution.',

  'alembic_row_gate.desc': 'Gate of Alembic Row. Sister Nim sells healing salve, mushroom broth, mendroot and spring water here. Connects to the Foot, the Alembics, the Vivarium, the Muster Gate and the Chancery Arch.',

  'the_alembics.desc': 'Indoor, heat-tagged. Holds an alchemy bench. Wash Out the Retorts is a job: 11 gold per 21 s. Odri Venn sells reagents here.',

  'the_vivarium.desc': 'Indoor. Holds a Culture Bench for geneshaping.',

  'chancery_arch.desc': 'Gate of the Chancery. No activities. Connects to the Foot, the Rolls, the Seal Room, the Retort Gate and the Assize Gate.',

  'the_rolls.desc': 'Indoor. Copy Out Writs is a job: 12 gold per 22 s. Read the Indexes trains Intelligence.',

  'seal_room.desc': 'Indoor. Learn Which Stamp trains Wisdom.',

  'assize_gate.desc': 'Gate of the Assize. Watch a Case Argued trains Charisma. Connects to the Foot, the High Bench, the Holding, the Chancery Arch and the Wrights’ Gate.',

  'the_high_bench.desc': 'Indoor. Plead a Small Matter trains Charisma; Weigh Both Sides trains Wisdom.',

  'the_holding.desc': 'Indoor. Stand the Night Watch is a job: 14 gold per 26 s.',

  'wrights_gate.desc': 'Gate of Wrights’ Ward. Pell Marrow sells armour and weapons here; four more lines open once the Toll Hall keeper is defeated. Connects to the Foot, the Forges, the Long Bench, the Assize Gate and the Granary Gate.',

  'the_forges.desc': 'Heat-tagged. Smithing counter with recipes for iron ingot, iron dagger and iron sword. Work the Bellows is a job: 14 gold per 25 s. Swing the Sledge trains Strength and pays blunt skill XP. Ferra Ostwind sells ore, scrap, wood and leather here.',

  'the_long_bench.desc': 'Indoor. Holds a Rune Table for runecarving.',

  'granary_gate.desc': 'Gate of the Granaries. Orrin Tallow sells rations and cooked dishes here. Connects to the Foot, the Granary Kitchens, the Weighbridge, the Undercrofts, the Wrights’ Gate and the Lectory Steps.',

  'granary_kitchens.desc': 'Indoor, heat-tagged. Holds a Cooking Stove. Scrub the Pans is a job: 10 gold per 20 s. Bryva Coll sells raw ingredients here.',

  'the_weighbridge.desc': 'Haul and Stack is a job: 11 gold per 18 s. Shift the Heavy Lots trains Strength.',

  'the_undercrofts.desc': 'Indoor. Go Through the Back Stores explores the cellars (52 s). Shift Barrels All Day trains Constitution.',
  // Placeholder text for the find: replace with your own.
  'the_undercrofts.finds.undercroft_flour_sack.desc': '🌾 A split sack in the back stores: 3 Rough Flour.',

  'f0_cell.desc': 'Floor 0, where a new life starts. Sleep on the Straw is a rest activity, so the cell is a haven. The rack here is the tutorial’s weapon choice. The cell door leads to the Cellblock (2 s).',

  'f0_cellblock.desc': 'Corridor outside the cell. Fight the Cell Slime is one fight: the slime deals 1 damage per hit and is gone once beaten. The yard door leads to the Field (3 s).',

  'f0_field.desc': 'Open ground between the cellblock and the gate. Fight in the Field holds three fights against Cell Slimes (levels 1 to 2), then goes quiet. Study the Gate Plaque trains Intelligence. The path leads to the Gate (3 s).',

  'f0_gate.desc': 'The way out of floor 0. The road through it into Threshold (3 s) is one-way: the Foot of the Ascent is on the other side and the floor closes behind you.',

  'f2_stairhead.desc': 'Landing of floor 2, the same building as floor 1, one storey up. Camp on the Landing is a rest activity, and the landing is a haven. The Long Hall starts here (2.5 s).',

  'f2_hall_1.desc': 'First stretch of the Long Hall. Clear the Stretch fights Bound Ledgers and Filing Automatons (levels 3 to 4), one at a time; after 3 wins the way on down the hall opens and the stretch goes quiet. A door leads to the Cleared Office, where the tutor teaches.',

  'f2_gym.desc': 'An office emptied out for training. The tutor here teaches two techniques for free: Gather (Neutral → Coiled), then Lunge (Coiled → Extended) once you know a way into Coiled. Work the Heavy Bag trains Strength.',

  'f2_hall_2.desc': 'Second stretch of the Long Hall. Clear the Stretch fights Filing Automatons and Bound Ledgers (levels 4 to 5), at most two at a time; 3 wins open the way on. A door leads to the Quartermaster’s Cage.',

  'f2_stores.desc': 'A caged supply room. The quartermaster sells healing salve and food.',

  'f2_hall_3.desc': 'Third stretch of the Long Hall. Clear the Stretch fights Sorting Automatons and Living Dolls (levels 5 to 6), at most two at a time; 3 wins open the way on. A door leads to the Break Room.',

  'f2_break_room.desc': 'A haven halfway down the hall: Sit Down for a While is a rest activity. Go Through the Cupboards explores the room (30 s) for one find.',
  'f2_break_room.finds.f2_petty_cash.desc': '💰 A petty-cash tin behind the mugs: 70 to 110 gold.',

  'f2_hall_4.desc': 'Far end of the Long Hall. Clear the Stretch fights Living Dolls and Filing Automatons (levels 6 to 7), at most two at a time. The third win clears floor 2 and the stretch goes quiet.',

  'f3_stairhead.desc': 'Landing of floor 3, the top of the building’s stairwell. Camp on the Landing is a rest activity, and the landing is a haven. The Mail Room is off the landing; the next flight down opens once its floor plan is found there.',

  'f3_mail_room.desc': 'Sort Through the Sacks explores the room (36 s) for three finds: the floor plan that opens the stairwell’s next flight, a purse, and one of the three string anchors the bureaucrat in the Hearing Room hangs from.',
  'f3_mail_room.finds.f3_mail_plan.desc': '🗺️ A floor plan in a mail sack, the stairwell marked. The next flight down is open.',
  'f3_mail_room.finds.f3_mail_purse.desc': '💰 An unclaimed parcel of coin: 60 to 90 gold.',
  'f3_mail_room.finds.f3_mail_string.desc': '✂️ A string anchor bolted under the sorting table, its line running down through the floor. Cut: the bureaucrat below loses a string (one level).',

  'f3_landing_2.desc': 'Second landing of the stairwell. Clear the Landing fights Living Dolls and Sorting Automatons (levels 6 to 7), one at a time; 2 wins and it goes quiet. The Archive Stacks are off the landing; the next flight down opens once their floor plan is found.',

  'f3_archive.desc': 'Search the Stacks explores the room (42 s) for three finds: the floor plan for the next flight, an oak club, and a string anchor.',
  'f3_archive.finds.f3_archive_plan.desc': '🗺️ A floor plan filed under the stairwell. The next flight down is open.',
  'f3_archive.finds.f3_archive_club.desc': '🏏 An oak club wedged between two shelves. A club deals bludgeoning damage, which the bureaucrat, a construct, takes more of.',
  'f3_archive.finds.f3_archive_string.desc': '✂️ A string anchor behind the end shelf. Cut: the bureaucrat below loses a string (one level).',

  'f3_landing_3.desc': 'Third landing of the stairwell. Clear the Landing fights Living Dolls and Filing Automatons (levels 7 to 8), one at a time; 2 wins and it goes quiet. The Records Annex is off the landing; the way down to the Hearing Room opens once its floor plan is found.',

  'f3_annex.desc': 'Go Through the Files explores the room (42 s) for three finds: the floor plan to the Hearing Room, two healing salves, and the last string anchor.',
  'f3_annex.finds.f3_annex_plan.desc': '🗺️ A floor plan with the Hearing Room marked at the bottom of the stairwell. The way down is open.',
  'f3_annex.finds.f3_annex_salve.desc': '🧴 Two healing salves in a first-aid drawer.',
  'f3_annex.finds.f3_annex_string.desc': '✂️ The last string anchor, in the annex ceiling. Cut: the bureaucrat below loses a string (one level).',

  'f3_hearing_room.desc': 'Bottom of the stairwell. Arriving starts a fight that cannot be fled: the Puppet Bureaucrat, alone. It is level 12 with all three strings, one level less for each string anchor cut in the side rooms above (level 9 with none left). Its kill clears floor 3 and the room goes quiet.',

  // ---- Band 2, the Wilds (floors 4–6). Placeholder text, sketch fidelity. ----
  'f4_treeline.desc': 'Landing of floor 4, where the tower opens onto woodland. Camp at the Treeline is a rest activity, and the landing is a haven.',
  'f4_woods_edge.desc': 'Endless hunt: forest rats, young wolves and goblins, level 7 to 9, sometimes two at once. Forage explores the edge (24 s) for herbs, berries and a purse.',
  'f4_woods_edge.finds.f4_edge_herbs.desc': '🌿 Four common herbs under the leaf litter.',
  'f4_woods_edge.finds.f4_edge_berries.desc': '🫐 Four handfuls of forest berries.',
  'f4_woods_edge.finds.f4_edge_purse.desc': '💰 A purse dropped by a goblin scout: 30 to 60 gold.',
  'f4_hills.desc': 'Endless hunt: boars, cliff hawks and goblins, level 8 to 9. Search the Barrows explores the hills (30 s) for copper ore and a barrow cache. Joins the Woods Edge and the Ravine Rim.',
  'f4_hills.finds.f4_hills_ore.desc': '⛏️ Three chunks of copper ore in a cut bank.',
  'f4_hills.finds.f4_hills_barrow.desc': '⚱️ A looted barrow the looters missed a corner of: 50 to 90 gold and two iron scrap.',
  'f4_deep_woods.desc': 'Endless hunt: wolves, boars and goblin raid parties of up to three, level 8 to 9. Explore (30 s) finds mushrooms and an abandoned camp.',
  'f4_deep_woods.finds.f4_deep_mushrooms.desc': '🍄 Three cave mushrooms around a rotten stump.',
  'f4_deep_woods.finds.f4_deep_camp.desc': '⛺ An abandoned camp: 40 to 80 gold and two iron scrap.',
  'f4_ravine_rim.desc': 'Endless hunt: cliff hawks and goblins, level 8 to 10. Look Over the Edge (24 s) finds a hawk nest and spots the raid camp below. The path down leads to the Raid Camp.',
  'f4_ravine_rim.finds.f4_rim_nest.desc': '🪶 A hawk nest: 20 to 40 gold and a gold leaf.',
  'f4_ravine_rim.finds.f4_rim_camp.desc': '🔭 Smoke on the ravine floor: the goblin raid camp. It is on the map.',
  'f4_ravine_floor.desc': 'The raid camp. One fight, started when you choose: the Goblin Raid Leader (level 9) and two goblins. Killing the leader clears floor 4.',

  'f5_causeway.desc': 'Landing of floor 5, a plank causeway into the swamp. Camp on the Causeway is a rest activity, and the landing is a haven. Gate: 12 goblins killed in total.',
  'f5_bog.desc': 'Endless hunt: water slimes, zombie slimes, goblin firetongues and goblins, level 9 to 10. Firetongues cast fire that can set you On Fire. Wade the Bog explores (30 s) for herbs and a purse.',
  'f5_bog.finds.f5_bog_herbs.desc': '🌿 Five common herbs on a dry hummock.',
  'f5_bog.finds.f5_bog_purse.desc': '💰 A drowned purse: 50 to 90 gold.',
  'f5_drowned_village.desc': 'Endless hunt: firetongues and goblins, level 9 to 11, up to three at once. Search the Huts explores (30 s) for two healing salves and a cache. Joins the Bog and the Cave Mouth.',
  'f5_drowned_village.finds.f5_village_salves.desc': '🧴 Two healing salves in a hut that stayed dry.',
  'f5_drowned_village.finds.f5_village_cache.desc': '💰 A goblin cache under the floorboards: 70 to 120 gold.',
  'f5_cave_mouth.desc': 'Endless hunt: hobgoblins, spider slimes and goblins, level 9 to 11. Hobgoblins fight with techniques; with martial open, seeing one used on you 50 times teaches it.',
  'f5_hollows.desc': 'Dark: dodging suffers until Darkvision pays it off. Endless hunt: hobgoblins, spider slimes and stone golems, level 10 to 11. Map the Hollows explores (36 s) for copper ore, the warren\'s back door and iron scrap.',
  'f5_hollows.finds.f5_hollows_ore.desc': '⛏️ Four chunks of copper ore in a seam.',
  'f5_hollows.finds.f5_hollows_door.desc': '🚪 A draught from a crack in the rock: a guarded door into the goblin warren. The way to the Back Door is open.',
  'f5_hollows.finds.f5_hollows_scrap.desc': '🔩 Four iron scrap from a broken cart.',
  'f5_back_door.desc': 'One fight, started when you choose: the Hobgoblin Champion (level 8) and one hobgoblin. Killing the champion clears floor 5.',

  'f6_warren_mouth.desc': 'Landing of floor 6, the goblins\' warren. Camp at the Mouth is a rest activity, and the landing is a haven. Gate: 40 goblins killed in total.',
  'f6_tunnels.desc': 'Endless hunt: goblins, hobgoblins, firetongues and witch doctors, level 10 to 12, up to three at once. Witch doctors heal their allies. Leads to the Pens, the Kitchens and the Shrine.',
  'f6_pens.desc': 'Break Open the Pens explores (30 s) for meat and one of the three sabotages. Each sabotage takes a level off the warchief.',
  'f6_pens.finds.f6_pens_meat.desc': '🥩 Four raw meat from the store pens.',
  'f6_pens.finds.f6_pens_sabotage.desc': '🔓 The pens are open and the war boars gone into the tunnels. Sabotage: the warchief loses a level.',
  'f6_kitchens.desc': 'Foul the Stores explores (30 s) for bread and one of the three sabotages.',
  'f6_kitchens.finds.f6_kitchens_food.desc': '🍞 Three loaves from the goblins\' stores.',
  'f6_kitchens.finds.f6_kitchens_sabotage.desc': '🧪 The war band\'s stores are spoiled. Sabotage: the warchief loses a level.',
  'f6_shrine.desc': 'Endless hunt: witch doctors and firetongues, level 11 to 12. Desecrate the Shrine explores (30 s) for an offering and one of the three sabotages. The drop down to the deep encampment starts here.',
  'f6_shrine.finds.f6_shrine_offering.desc': '💰 The shrine\'s offering bowl: 80 to 140 gold.',
  'f6_shrine.finds.f6_shrine_sabotage.desc': '🔥 The shrine is overturned and its fire out. Sabotage: the warchief loses a level.',
  'f6_drop.desc': 'The deep encampment, second map of the warren. Dark. Camp in the Drop is a rest activity and a haven. Endless hunt: hobgoblins, witch doctors, firetongues and goblins, level 11 to 13, up to three at once.',
  'f6_great_hall.desc': 'Arriving starts a fight that cannot be fled: the Goblin Warchief and two escorts (witch doctors, firetongues or hobgoblins). The warchief is level 11 with no sabotage, one level less for each of the three (8 with all three). Killing it clears floor 6 and opens prestige.',

  // Band 3, the City: a skeleton. Every level below is the base; each
  // direction cleared adds levels to all four floors. Placeholder text.
  'castle_court.desc': 'The castle at the heart of the city, the hub of band 3. The ladder answers here: the four wards, south, west, north and east, are each one climb away. Rest in the Castle is a rest activity, and the court is a haven. Placeholder text.',
  'f7_docks.desc': 'Landing of floor 7, the south ward. Bandits raid the merchants and convoys that feed the city. Which road leaves the docks depends on how many of the other three wards are cleared this run: none, the merchant road; one or two, the bandits\' camp in the salt flats; all three, the burnt camp. Camp on the Docks is a rest activity, and the landing is a haven. Endless hunt: rats and water slimes, level 12 to 13 before the band\'s step. Placeholder text.',
  'f7_merchant_road.desc': 'Open while no other ward is cleared. 12 fights of 2 to 4 bandits (thugs, archers, cutthroats), level 12 to 13. The 12th win clears floor 7. If another ward is cleared first, the raids stop: fights already won here count toward nothing. Placeholder text.',
  'f7_stockade.desc': 'The camp\'s palisade, open while one or two other wards are cleared. 4 fights of 2 to 4 bandits, mostly thugs and cutthroats, level 11 to 12 before the band\'s step (+2 or +5). Spending these fights and the watchtowers\' opens the chief\'s tent. Placeholder text.',
  'f7_watchtowers.desc': 'The camp\'s towers, open while one or two other wards are cleared. 3 fights of 2 or 3 bandits, mostly archers, level 11 to 12 before the band\'s step (+2 or +5). Spending these fights and the stockade\'s opens the chief\'s tent. Placeholder text.',
  'f7_chiefs_tent.desc': 'Shut until the stockade\'s 4 fights and the watchtowers\' 3 are won. One fight, started when you choose: the Bandit Chief and two escorts, level 12 before the band\'s step (14 or 17). Killing the chief clears floor 7. Placeholder text.',
  'f7_burnt_camp.desc': 'The bandits\' camp, burnt out. Open only when floor 7 is the last ward of the city left. A demon summoned into the camp absorbed the bandits; it stays for 24 in-game hours from the third ward\'s clear. One fight, started when you choose: the Camp Demon, level 12 before the band\'s step (21). Walking away ends the fight; the demon keeps half of the HP it lost. Killing it clears floor 7. If the 24 hours run out, the demon is gone and floor 7 is cleared anyway. Placeholder text.',
  'f8_forest_gate.desc': 'Landing of floor 8, the west ward, facing the forest. Camp at the Gate is a rest activity, and the landing is a haven. Endless hunt: goblins and young wolves, level 12 to 13 before the band\'s step. Placeholder text.',
  'f8_old_forest.desc': 'Past the west gate. Endless hunt: wolves, which cause bleeding, boars and hobgoblins, level 13 to 14 before the band\'s step. Forage explores (30 s) for berries and meat. Placeholder text.',
  'f8_old_forest.finds.f8_forest_berries.desc': '🫐 Five handfuls of forest berries.',
  'f8_old_forest.finds.f8_forest_meat.desc': '🥩 Four cuts of meat from a goblin snare.',
  'f8_lodge.desc': 'One fight, started when you choose: the Hobgoblin Champion and its escort, level 14 before the band\'s step. Killing the champion clears floor 8. Placeholder text.',
  'f9_cathedral_close.desc': 'Landing of floor 9, the north ward. Shelter in the Close is a rest activity, and the landing is a haven. Endless hunt: living dolls and zombie slimes, level 12 to 13 before the band\'s step. Placeholder text.',
  'f9_barrow_fields.desc': 'Past the north gate. Endless hunt: zombie slimes, living dolls and death knights, level 13 to 14 before the band\'s step. Search the Barrows explores (30 s) for salves and grave gold. Placeholder text.',
  'f9_barrow_fields.finds.f9_barrow_salves.desc': '🧴 Two healing salves left as a grave offering.',
  'f9_barrow_fields.finds.f9_barrow_grave_gold.desc': '💰 Grave goods: 100 to 180 gold.',
  'f9_ossuary.desc': 'One fight, started when you choose: a Death Knight, level 15 before the band\'s step. Killing it clears floor 9. Placeholder text.',
  'f10_artificers_row.desc': 'Landing of floor 10, the east ward. Camp in a Workshop is a rest activity, and the landing is a haven. Endless hunt: sorting and filing automata, level 12 to 13 before the band\'s step. Placeholder text.',
  'f10_quarry.desc': 'Past the east gate. Endless hunt: automata and stone golems, which shrug off blades, level 13 to 14 before the band\'s step. Search the Spoil Heaps explores (30 s) for copper ore and iron scrap. Placeholder text.',
  'f10_quarry.finds.f10_quarry_ore.desc': '⛏️ Five chunks of copper ore.',
  'f10_quarry.finds.f10_quarry_scrap.desc': '🔩 Five iron scrap from a broken winch.',
  'f10_foundry.desc': 'One fight, started when you choose: a Stone Golem, level 14 before the band\'s step. Killing it clears floor 10. Placeholder text.',

  // Floor 11, the stronghold (FLOOR_IDEAS.md §1.5). Placeholder text.
  'f11_road.desc': 'Landing of floor 11. Camp by the Road is a rest activity, and the landing is a haven. Endless hunt: raiders and brutes, level 22 to 23; they drop iron scrap. After the stronghold is yours, the road also leads on to the harbor. Placeholder text.',
  'f11_gatehouse.desc': 'The stronghold’s gatehouse. The steward gives the two repair quests here. After the stronghold is held, the door to your hold is here. Placeholder text.',
  'f11_yard.desc': 'Inside the walls. Salvage Timber gathers hardwood (12 s each). The stair up to the wall opens once Arm the Wall is turned in, and only until the stronghold is held. Placeholder text.',
  'f11_wall.desc': 'The wave, opened by the steward’s second quest: eight fights in groups of two or three, level 24 to 25; the eighth is the Siege Captain and its escort, level 27. Winning the eighth ends the run in an automatic prestige. Shut on every run after the stronghold. The postern leads back to the road. Placeholder text.',

  // ==== HARBOR: spot text (skeleton 2026-10-30; the harbor builder's section) ====
  'f11_quay.desc': 'The harbor, on runs after the stronghold. Rest at the Quay is a rest activity, and the quay is a haven. Makes the battery’s hold: Ship’s Cannons (6 iron ingots), Cannonballs (3 from 1 iron ingot) and Powder Charges (2 from 3 biomatter and 1 iron scrap). Four berths each hold one side’s recruiter; accepting a join quest picks your side for the run. Placeholder text.',
  'f11_merchant_berth.desc': 'The merchants’ berth. The factor recruits here: the merchants own the convoy, defend it from pirates and sea monsters both, and sell what survives for gold. Placeholder text.',
  'f11_smugglers_berth.desc': 'The pirates’ berth. The bosun recruits here: the pirates seize crates from the convoy past its guard. Placeholder text.',
  'f11_privateer_berth.desc': 'The privateers’ berth. The letter agent recruits here: the privateers take the convoy’s crates back from the pirates. Placeholder text.',
  'f11_navy_berth.desc': 'The navy’s berth. The lieutenant recruits here: the navy escorts the convoy against sea monsters. Placeholder text.',
  'f11_roadstead.desc': 'Floor 11’s water. A convoy of 8 crates sails every 6 minutes in four 30-second legs. While you are here and doing something, each leg fires your battery and counts your side’s kills against it; crates your side wins add to Crates Won. Before you pick a side: sea monsters, level 24 to 25, and no convoy work. Clear: 8 crates won and one fight won here. Placeholder text.',
  'f12_landing.desc': 'Landing of floor 12, the Outer Port. Rest at the Outer Port is a rest activity, and the port is a haven. Sailing out is a boarding: arriving on the water starts a fight that cannot be fled. Your side’s lane is long and weak; the strait is short and strong. Searching the port turns up a hidden way out. Placeholder text.',
  'f12_strait.desc': 'The short way to the Isle Anchorage, for every side: your side’s enemies, level 28 to 29, two at a time half the time, and the strongest convoy rolls on the floor. Your side’s named ship appears here once. Placeholder text.',
  'f12_trade_lane.desc': 'The merchants’ lane: long and weak. Pirates and sea monsters, level 25 to 27. Placeholder text.',
  'f12_hidden_cove.desc': 'The pirates’ cove, found by searching the Outer Port: hidden and cheap. Convoy guards and marines, level 24 to 26; the guard rolls are the floor’s lowest. Placeholder text.',
  'f12_hunting_ground.desc': 'The privateers’ lane: long and weak. Pirates, level 25 to 27. Placeholder text.',
  'f12_patrol_lane.desc': 'The navy’s lane: long and weak. Sea monsters, level 25 to 27. Placeholder text.',
  'f12_isle.desc': 'The Isle Anchorage, the second port. Rest at the Anchorage is a rest activity, and it is a haven. The far water lies beyond it. Placeholder text.',
  'f12_far_water.desc': 'Floor 12’s last water: your side’s enemies, level 27 to 28. Your side’s named ship appears here once. Clear: 40 crates won this run, on any water, and one fight won here. Placeholder text.',
  'f13_landing.desc': 'Landing of floor 13, the Last Port. Rest at the Last Port is a rest activity, and the port is a haven. The pilot sells passage through the Pilot’s Channel; the harbor master sells port clearance to merchants. Placeholder text.',
  'f13_picket.desc': 'The picket line in front of the blockade: your side’s enemies, level 28 to 29. Your side’s named ship appears here once. Running the blockade from here leaves you Flat-Footed in the first fight. Placeholder text.',
  'f13_blockade.desc': 'Floor 13’s last water: your side’s enemies, level 30 to 31, in pairs more often than not. Your side’s named ship appears here once. Clear: 160 crates won this run, on any water, and one fight won here. Placeholder text.',
  'f14_landing.desc': 'Landing of floor 14, the Staging Anchorage. Rest at the Anchorage is a rest activity, and it is a haven. One way out exists, to your side’s mission. Killing the mission’s boss clears the floor. Placeholder text.',
  'f14_closed_port_roads.desc': 'The merchants’ approach: pirates and sea monsters, level 30 to 32, endless. With Clear the Closed Port turned in, the warden’s fight starts with him and his escort Flat-Footed. Placeholder text.',
  'f14_closed_port.desc': 'The merchants’ mission: the Warden of the Closed Port and four Pirate Captains, level 33. One fight, started when you choose. Winning it clears floor 14. Placeholder text.',
  'f14_galleon_track.desc': 'The pirates’ approach: the galleon’s escort, level 30 to 32, endless. With Forge a Signal turned in, the galleon’s crew starts the boarding Surprised. Placeholder text.',
  'f14_treasure_galleon.desc': 'The pirates’ mission: the galleon’s master and four Frigate Captains, level 33. One fight, started when you choose. Winning it clears floor 14. Placeholder text.',
  'f14_kings_reef.desc': 'The privateers’ approach: the pirate king’s crews, level 30 to 32, endless. With Renew the Letter turned in, the king’s crew starts the boarding Flat-Footed. Placeholder text.',
  'f14_flagship.desc': 'The privateers’ mission: the Pirate King and four Pirate Captains, level 33. One fight, started when you choose. Winning it clears floor 14. Placeholder text.',
  'f14_beast_grounds.desc': 'The navy’s approach: the beast’s brood, level 30 to 32, endless. With Bait a Lure turned in, the beast and its brood start the fight Surprised. Placeholder text.',
  'f14_beast_lair.desc': 'The navy’s mission: the Sea Beast and four Brood Matrons, level 33. One fight, started when you choose. Winning it clears floor 14. Placeholder text.',

  // ==== FESTIVAL: spot text (skeleton 2026-10-30; the festival builder's section) ====
  'f15_dark_room.desc': 'A sealed room on floor 15 with nine other people in it. Arriving here starts a festival attempt: the door holds all your gear until it ends and issues one plain weapon of your family. The nine come at you in waves, the last alone, and none of it can be fled. The door to the hall opens when you are the only one standing. A knockout, or the ladder out, loses the attempt. Placeholder text.',
  'f15_hall.desc': 'The hall behind the dark room’s door, where the survivors of ten rooms wait out ten festival days. No one fights here. The benches are a rest, the floor is a training yard, and a cooking fire burns at one end. The festival’s clock runs only while the game does. Placeholder text.',
  'f15_stores.desc': 'The festival’s stores: a few rations, some meat and two salves per attempt, found by searching. They restock when the next attempt starts. Placeholder text.',
  'f16_arena.desc': 'The royale’s field on floor 16. In an attempt, the survivors fight each other and come at you one or two at a time, stronger as the field empties; the last one standing is fought alone, and beating it wins the festival. Outside an attempt the field is empty: attempts start in the dark room on floor 15. Placeholder text.',

  // ==== ABERRANT: spot text (skeleton 2026-10-30; the aberrant builder's section) ====
  'f17_landing.desc': 'Skeleton landing of floor 17. Camp is a rest activity, and the landing is a haven. Endless hunt: placeholder raiders and brutes, level 36 to 37. Placeholder text.',
  'f17_keeper.desc': 'Skeleton keeper of floor 17. One fight, started when you choose, level 39. Winning it clears floor 17. Placeholder text.',

  // ==== DESERT: spot text (skeleton 2026-10-30; the desert builder's section) ====
  'f18_well_head.desc': 'Landing of floor 18, a well-head in full sun. Rest at the Well-Head is a rest activity, and the landing is a haven. Every spot on this floor is hot: standing here trains Heat Resistance. Placeholder text.',
  'f18_first_obelisk.desc': 'An obelisk at the roadside, a haven. Read the Obelisk explores (18 s) for one bearing: chart +1. Placeholder text.',
  'f18_first_obelisk.finds.f18_read_first.desc': '📜 The first obelisk’s bearings, copied onto your chart. Chart +1.',
  'f18_dune_den.desc': 'Endless hunt: scarabs, cobras and giant scorpions, level 38 to 39, up to three at once. Cobras and scorpions poison. Placeholder text.',
  'f18_second_obelisk.desc': 'An obelisk at the fork to the salt flat, a haven. Read the Obelisk explores (18 s) for one bearing: chart +1. Placeholder text.',
  'f18_second_obelisk.finds.f18_read_second.desc': '📜 The second obelisk’s bearings, copied onto your chart. Chart +1.',
  'f18_salt_flat.desc': 'Endless hunt: giant scorpions and cobras, level 38 to 40. Cut Rock Salt gathers rock salt (12 s each). The fourth obelisk is past the flat. Placeholder text.',
  'f18_fourth_obelisk.desc': 'An obelisk at the far edge of the salt flat, a haven. Read the Obelisk explores (18 s) for one bearing: chart +1. Placeholder text.',
  'f18_fourth_obelisk.finds.f18_read_fourth.desc': '📜 The fourth obelisk’s bearings, copied onto your chart. Chart +1.',
  'f18_tomb_row.desc': 'Endless hunt: mummies and scarabs, level 39 to 40, up to three at once. A mummy killed by heat can drop bone ash, one killed by bludgeoning bone dust. Placeholder text.',
  'f18_fifth_obelisk.desc': 'An obelisk off the tomb row, a haven. Read the Obelisk explores (18 s) for one bearing: chart +1. Placeholder text.',
  'f18_fifth_obelisk.finds.f18_read_fifth.desc': '📜 The fifth obelisk’s bearings, copied onto your chart. Chart +1.',
  'f18_third_obelisk.desc': 'The last obelisk before the forecourt, a haven. Read the Obelisk explores (18 s) for one bearing: chart +1. Placeholder text.',
  'f18_third_obelisk.finds.f18_read_third.desc': '📜 The third obelisk’s bearings, copied onto your chart. Chart +1.',
  'f18_forecourt.desc': 'The forecourt guardian, a sand colossus, level 41, alone. Fights whenever you hunt here, cleared or not. Its first kill clears floor 18. It resists heat; a kill by bludgeoning can drop quicksilver. Placeholder text.',

  'f19_causeway.desc': 'Landing of floor 19, a causeway to the pyramid. Camp on the Causeway is a rest activity, and the landing is a haven. Hot: standing here trains Heat Resistance. Gate: 60 desert monsters killed in total. Placeholder text.',
  'f19_valley.desc': 'Endless hunt: cobras and giant scorpions, level 40 to 41. Hot. The side tomb opens at Heat Resistance 10. Placeholder text.',
  'f19_side_tomb.desc': 'A sealed side tomb, open at Heat Resistance 10. Hot. Search the Side Tomb explores (36 s) for quicksilver, bone ash and a coffer. Placeholder text.',
  'f19_side_tomb.finds.f19_side_quicksilver.desc': '🪙 A stoppered jar: 3 Quicksilver.',
  'f19_side_tomb.finds.f19_side_ash.desc': '🦴 A burial urn: 4 Bone Ash.',
  'f19_side_tomb.finds.f19_side_coffer.desc': '💰 A coffer under the bier: 150 to 250 gold and 2 Brimstone.',
  'f19_entrance.desc': 'Endless hunt: mummies and scarabs, level 40 to 42, up to three at once. Placeholder text.',
  'f19_gallery.desc': 'Endless hunt: mummies and giant scorpions, level 41 to 42, up to three at once. Placeholder text.',
  'f19_chamber.desc': 'Endless hunt: mummies, level 42 to 43. The treasury is off to the side. The way on to the door starts a fight with the judge that cannot be fled. Placeholder text.',
  'f19_treasury.desc': 'Each grave good taken from here raises the level of the judge at the door. Search the Treasury explores (36 s) and takes six goods, one at a time: gold and ingots or gold leaf each. Once the judge has fallen, nothing more can be taken this run. Placeholder text.',
  'f19_treasury.finds.f19_good_ewer.desc': '🏺 Grave good taken: a bronze ewer. 80 to 140 gold and 2 Bronze Ingots.',
  'f19_treasury.finds.f19_good_mask.desc': '🏺 Grave good taken: a gilded mask. 80 to 140 gold and 2 Gold Leaf.',
  'f19_treasury.finds.f19_good_bowls.desc': '🏺 Grave good taken: a stack of offering bowls. 80 to 140 gold and 2 Copper Ingots.',
  'f19_treasury.finds.f19_good_chest.desc': '🏺 Grave good taken: a chest of tools. 80 to 140 gold and 2 Bronze Ingots.',
  'f19_treasury.finds.f19_good_figures.desc': '🏺 Grave good taken: a box of servant figures. 80 to 140 gold and 2 Tin Ingots.',
  'f19_treasury.finds.f19_good_collar.desc': '🏺 Grave good taken: a broad collar. 80 to 140 gold and 2 Gold Leaf.',
  'f19_door.desc': 'Sabaket, the Weigher at the Door: the judge, alone. With nothing taken from the treasury it is weaker than the floor’s dens; each grave good taken raises its level. Arriving from the chamber starts the fight and it cannot be fled; it fights again whenever you hunt here. Its first kill clears floor 19 and seals the treasury. Placeholder text.',

  'f20_river_road.desc': 'Landing of floor 20, the road down to the delta. Camp on the River Road is a rest activity, and the landing is a haven. Hot. Endless hunt: cobras, giant scorpions and scarabs, level 42 to 44. Gate: 150 desert monsters killed in total. Placeholder text.',
  'f20_quay.desc': 'The port house quay, a haven. The broker buys at the posted rates, the same price any counter pays. The way out to the roadstead starts a fight that cannot be fled. Placeholder text.',
  'f20_warehouses.desc': 'Haul Cargo pays 30 gold every 24 s. Sweep the Grain Floor gathers rough flour (12 s each). Placeholder text.',
  'f20_notice_wall.desc': 'Notices for the island, floor 21: three camps are hiring. The Shōgun’s camp, the usurpers’ camp and the free states’ camp. Placeholder text.',
  'f20_roadstead.desc': 'The ferry’s crew holds the roadstead: three of them, level 45, one fight. Arriving from the quay starts it and it cannot be fled. With three obelisks read on floor 18, the crew starts it surprised. Winning it clears floor 20; the ferry crosses to floor 21. Placeholder text.',

};
