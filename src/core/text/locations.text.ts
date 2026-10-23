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

  'base_entrance.desc': 'The door into your hold. It opens from the Foot of the Ascent after your first prestige and leads to the Main Hall.',

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

  'ascent_foot.desc': 'Hub of Threshold and the door to the Ascent. Rest at the Doorstep Inn makes this the city haven: a lost fight returns you here. All eight district roads end here, 1 s each. The Warden of the Foot stands here and gives the starting quests. The door to your hold opens after your first prestige.',

  'lectory_steps.desc': 'Gate of the Scholars’ Quarter. Argue on the Steps trains Intelligence. Connects to the Foot, the Reading Hall, the Chalk Yard, the Granary Gate and the Pilgrims’ Stair.',

  'the_reading_hall.desc': 'Indoor. Holds a Spell Table for inscribing spells. Read Until It Sticks trains Intelligence. Sit With a Hard Passage trains Wisdom and pays magic skill XP. Docent Marell stands here.',

  'chalk_yard.desc': 'Read the Old Working explores the yard (42 s). Copy Out a Proof trains Intelligence.',
  // Placeholder text for the find: replace with your own.
  'chalk_yard.finds.chalk_old_working.desc': '🔠 A chalk working on the flagstones: 30 Arcana XP.',

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

};
