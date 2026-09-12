import type { ProseTable } from './prose';

// Player-facing text for src/core/data/locations.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- SPOTS ----------
export const SPOTS_TEXT: ProseTable = {
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

  'base_farm.desc': 'Three gather activities: Tend the Vegetable Rows yields wild onion (120 ticks), Keep the Henhouse yields bird egg (160 ticks), Cut the Herb Beds yields common herb (140 ticks). The rows and the herb beds pay Herbalism XP. Connects to the Kitchen, the Dining Hall and the Pantry.',

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

  'ascent_foot.desc': 'Hub of Threshold and the door to the Ascent. Rest at the Doorstep Inn makes this the city haven: a lost fight returns you here. All eight district roads end here, 60 ticks each. The Warden of the Foot stands here and gives the starting quests. The door to your hold opens after your first prestige.',

  'lectory_steps.desc': 'Gate of the Scholars’ Quarter. Argue on the Steps trains Intelligence. Connects to the Foot, the Reading Hall, the Chalk Yard, the Granary Gate and the Pilgrims’ Stair.',

  'the_reading_hall.desc': 'Indoor. Holds a Spell Table for inscribing spells. Read Until It Sticks trains Intelligence; Sit With a Hard Passage trains Wisdom and pays magic skill XP. Docent Marell stands here.',

  'chalk_yard.desc': 'Read the Old Working explores the yard (420 ticks). Copy Out a Proof trains Intelligence.',

  'temple_rise_gate.desc': 'Gate of Temple Rise. Walk the Stair trains Constitution. Connects to the Foot, the Nine Chapels, Censer Walk, the Lectory Steps and the Muster Gate.',

  'the_nine_chapels.desc': 'Indoor. Keep a Vigil trains Wisdom and pays magic skill XP. Prior Ashvane stands here; miracles are learned here for favor.',

  'censer_walk.desc': 'Colonnade off the Pilgrims’ Stair. Work the Colonnade trains Charisma. Ilex stands here.',

  'ironyard_gate.desc': 'Gate of the Ironyard. Drill in Formation trains Strength. Captain Hurst stands here. Connects to the Foot, the Cages, the Sand, the Long Gallery, the Pilgrims’ Stair and the Retort Gate.',

  'the_cages.desc': 'Menagerie. Step Into a Cage fights one Forest Rat, Slime or Goblin at a time (levels 1 to 3), never a rolled modifier. Kills here unlock each bestiary fact exactly at its kill count.',

  'the_sand.desc': 'Footwork on the Sand trains Dexterity. Spar trains Strength and pays combat skill XP. Master Ekwe stands here.',

  'long_gallery.desc': 'Indoor archery range. Shoot the Long Butts trains Dexterity; Draw Until It Hurts trains Constitution.',

  'alembic_row_gate.desc': 'Gate of Alembic Row. Sister Nim sells healing salve, mushroom broth, mendroot and spring water here. Connects to the Foot, the Alembics, the Vivarium, the Muster Gate and the Chancery Arch.',

  'the_alembics.desc': 'Indoor, heat-tagged. Holds an alchemy bench and a preparing bench. Odri Venn sells reagents here.',

  'the_vivarium.desc': 'Indoor. Holds a Culture Bench for geneshaping.',

  'chancery_arch.desc': 'Gate of the Chancery. No activities. Connects to the Foot, the Rolls, the Seal Room, the Retort Gate and the Assize Gate.',

  'the_rolls.desc': 'Indoor. Copy Out Writs is a job: 12 gold per 220 ticks. Read the Indexes trains Intelligence.',

  'seal_room.desc': 'Indoor. Learn Which Stamp trains Wisdom.',

  'assize_gate.desc': 'Gate of the Assize. Watch a Case Argued trains Charisma. Connects to the Foot, the High Bench, the Holding, the Chancery Arch and the Wrights’ Gate.',

  'the_high_bench.desc': 'Indoor. Plead a Small Matter trains Charisma; Weigh Both Sides trains Wisdom.',

  'the_holding.desc': 'Indoor. Stand the Night Watch is a job: 14 gold per 260 ticks.',

  'wrights_gate.desc': 'Gate of Wrights’ Ward. Pell Marrow sells armour and weapons here; four more lines open once the Toll Hall keeper is defeated. Connects to the Foot, the Forges, the Long Bench, the Assize Gate and the Granary Gate.',

  'the_forges.desc': 'Heat-tagged. Smithing counter with recipes for iron ingot, iron dagger and iron sword, plus an assembling bench. Work the Bellows is a job: 14 gold per 250 ticks. Swing the Sledge trains Strength and pays blunt skill XP. Ferra Ostwind sells ore, scrap, wood and leather here.',

  'the_long_bench.desc': 'Indoor. Holds a Rune Table for runecarving.',

  'granary_gate.desc': 'Gate of the Granaries. Orrin Tallow sells rations and cooked dishes here. Connects to the Foot, the Granary Kitchens, the Weighbridge, the Undercrofts, the Wrights’ Gate and the Lectory Steps.',

  'granary_kitchens.desc': 'Indoor, heat-tagged. Holds a Cooking Stove and a preparing bench. Scrub the Pans is a job: 10 gold per 200 ticks. Bryva Coll sells raw ingredients here.',

  'the_weighbridge.desc': 'Haul and Stack is a job: 11 gold per 180 ticks. Shift the Heavy Lots trains Strength.',

  'the_undercrofts.desc': 'Indoor. Go Through the Back Stores explores the cellars (520 ticks). Shift Barrels All Day trains Constitution.',

  'f1_landing.desc': 'Landing of floor 1. Camp on the Landing is a rest activity, and the landing is a haven: a knockout on this floor returns you here. Connects to the Bonded Stores and the Toll Hall.',

  'f1_storerooms.desc': 'Go Through the Crates explores the stores (360 ticks) for two finds; full exploration reveals a hidden way down to the Bonded Deep. Clear Out the Vermin fights Forest Rats and Slimes (levels 1 to 4).',
  'f1_storerooms.finds.f1_manifest_coin.desc': '💰 A strongbox under a manifest: 30 to 50 gold.',
  'f1_storerooms.finds.f1_dried_herbs.desc': '🌿 Four bundles of common herb. Pays Herbalism XP.',

  'f1_bonded_deep.desc': 'Dark. Hidden stores below the Bonded Stores, guarded far above this floor’s level: Slimers and Metal Slimes at levels 8 to 11. Search Past the Manifests explores it (420 ticks) for one find.',
  'f1_bonded_deep.finds.f1_deep_strongroom.desc': '💰 An uncollected strongroom: 180 to 260 gold.',

  'f1_toll_hall.desc': 'Den of floor 1. Hunt the Hall fights Goblins and Slimes, one Coin Slime, and the keeper: a Hobgoblin by day or a Slimer by night (levels 6 to 7). Defeating either keeper clears the floor. While your power sits at 90 to 98% of theirs, a Hobgoblin Champion or Slime King (levels 11 to 12) can appear as keeper instead.',

  'f2_landing.desc': 'Landing of floor 2. Camp on the Landing is a rest activity, and the landing is a haven. Connects to the Sluice Gallery and the Broken Cistern; arriving at the cistern starts a fight that cannot be fled.',

  'f2_sluice.desc': 'Trace the Channels explores the gallery (420 ticks) for one find. Cross the Wet Stones trains Dexterity.',
  'f2_sluice.finds.f2_drowned_purse.desc': '💰 A purse wedged in a sluice gate: 70 to 110 gold.',

  'f2_cistern.desc': 'Den of floor 2. Arriving starts a fight that cannot be fled. Wade In fights Water Slimes and Slimers (levels 4 to 8). The cistern holds 8 winnable fights; the eighth win clears the floor, ends the forced fights and empties the hunts.',

  'f3_landing.desc': 'Landing of floor 3. Camp on the Landing is a rest activity, and the landing is a haven. Connects to the Silk Gallery and the Brood Den.',

  'f3_web_gallery.desc': 'Cut Through the Webs explores the gallery (480 ticks) for one find. Hunt the Gallery fights Cave Spiders and Slime Spiders (levels 7 to 11).',
  'f3_web_gallery.finds.f3_wrapped_valuables.desc': '💰 A cocooned satchel: 120 to 180 gold.',

  'f3_brood_den.desc': 'Den of floor 3. Go to the Centre fights Cave Spiders (levels 8 to 11) and, once, the Giant Spider Queen (level 12). Killing the queen clears the floor.',
};
