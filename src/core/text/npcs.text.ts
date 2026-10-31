import type { ProseTable } from './prose';

// Player-facing text for src/core/data/npcs.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- NPCS ----------
export const NPCS_TEXT: ProseTable = {
  'warden_of_the_foot.desc': 'Stands at the Foot of the Ascent. Gives the three starting quests: The First Ascent (floor 1, recommended first), then The Faces of Threshold and A Taste of Everything (town, optional).',
  'warden_of_the_foot.dialogue': [
    'Climb floor 1 first. What floor 0 gave you is enough for it.',
    'The town can wait. Eight roads leave this door, one to each district gate, 1 s each.',
    'A vendor charges you half again the price until you have spoken to them. The Faces of Threshold has you meet all eight trades.',
    'The tower door is open now. Floor 1 has no gate; floor 2 needs 150 gold earned in total.',
  ],

  'master_smith.desc': 'Smith at the Forges. Sells iron scrap, copper ore, tin ore, hardwood, leather and iron ingots at the Scrap Bin. The Forges hold the iron ingot, iron dagger and iron sword recipes.',
  'master_smith.dialogue': [
    'I sell scrap, copper ore, tin ore, hardwood, leather and finished iron ingots.',
    'The forge here makes iron ingots, iron daggers and iron swords. One ingot smelted counts for A Taste of Everything.',
    'I sell no weapons. Pell Marrow at the Wrights’ Gate has the rack.',
  ],

  'lectory_wizard.desc': 'Docent in the Reading Hall, beside the Spell Table where spells are inscribed. Sells nothing and gives no quests.',
  'lectory_wizard.dialogue': [
    'The Spell Table is behind me. One spell inscribed there counts for A Taste of Everything.',
    'The table takes no fee. A spell costs mana each time you cast it.',
    'Read Until It Sticks trains Intelligence here. Sit With a Hard Passage trains Wisdom and pays magic skill XP.',
  ],

  'chapel_priest.desc': 'Prior of the Nine Chapels. Miracles are learned here for favor, on the Divine tab of the Spellcrafting Table. Sells nothing and gives no quests.',
  'chapel_priest.dialogue': [
    'Miracles are on the Divine tab of the Spellcrafting Table behind me. Each costs favor with its own god; quest turn-ins earn favor with every god you know.',
    'D’Enjalle, the Shining Rapier, is a god of honor, fire and order. Usvýlgr, the Crafty Hammer, is a god of crafting and earth.',
    'Two of the nine doors are locked. Nothing behind them can be learned yet.',
  ],

  'militia_captain.desc': 'Captain at the Muster Gate. Sells nothing and gives no quests. The gate leads to the Cages, the Sand and the Long Gallery, 1 s each.',
  'militia_captain.dialogue': [
    'Talking to me counts toward The Faces of Threshold. I sell nothing.',
    'The Cages stage one fight at a time: rats, slimes and goblins, levels 1 to 3. The Sand trains footwork and sparring. Then the tower.',
    'A lost fight returns you to the last haven you stood in: the Doorstep Inn at the Foot, or a tower landing.',
  ],

  'head_chef.desc': 'Cook in the Granary Kitchens. Sells raw ingredients at the Larder Door: meat, fish, onion, mushroom, salt, flour, egg, berries and honey, plus recipe cards for the stove. The kitchen holds a Cooking Stove.',
  'head_chef.dialogue': [
    'Raw ingredients only at my door. Cooked dishes are on Orrin Tallow’s cart at the Granary Gate.',
    'The stove is behind me. One dish cooked here counts for A Taste of Everything.',
    'Scrub the Pans pays 10 gold per 20 s if you need coin.',
    'Recipe cards at my door: Herb-Rubbed Meat, Fish and Onion Pot, Seared Stew, Braised Meat and Steeped Broth. Read one and the stove knows the dish.',
    'Seared Stew, Braised Meat and Steeped Broth also need the meat or herb on the heat for a set time. The card says how long.',
  ],

  'row_alchemist.desc': 'Alchemist at the Alembics. Sells reagents at the Reagent Shelf: spring water, pressed oil, grain spirit, common herb, mendroot, bloodwort, fixing salt, bone ash and brimstone. The alchemy bench here brews by ordered sequence.',
  'row_alchemist.dialogue': [
    'Reagents go into the alembic one at a time. The order you add them is the recipe.',
    'The same reagents in a different order make a different brew.',
    'I sell water, oil, spirit, herbs and salts. Brews you make yourself at the bench behind me; one bottled counts for A Taste of Everything.',
  ],

  'psionic_shaper.desc': 'Stands on Censer Walk. Teaches nothing and sells nothing at present; the psionic system is closed. Talking counts toward The Faces of Threshold.',
  'psionic_shaper.dialogue': [
    'I teach nothing at present. Psionics is closed in this city.',
    'Talking to me counts toward The Faces of Threshold.',
    'Work the Colonnade, here on the walk, trains Charisma.',
  ],

  'dojo_master.desc': 'Master of the Sand. Footwork on the Sand trains Dexterity; Spar trains Strength and pays combat skill XP. Sells nothing and gives no quests.',
  'dojo_master.dialogue': [
    'Footwork on the Sand trains Dexterity.',
    'Spar trains Strength and pays combat skill XP.',
    'Neither activity rolls a fight. For fights, use the Cages, 2 s back through the Muster Gate.',
  ],

  'ward_outfitter.desc': 'Vendor at the Wrights’ Gate. The Rack sells cloth and leather armour, iron gauntlets, a wooden shield, and starter weapons. Four more lines (leather jerkin, iron breastplate, soldier greaves, rapier) unlock once the Toll Hall keeper is defeated.',
  'ward_outfitter.dialogue': [
    'Plain armour and starter weapons. Prices come off the item’s value, plus half again until we have spoken.',
    'Armour: cloth tunic, leather cap, vest and boots, iron gauntlets, wooden shield. Weapons: oak club, iron dagger, old spear, iron sword, hunting bow, oak staff.',
    'Defeat the keeper of the Toll Hall and four more lines come out: leather jerkin, iron breastplate, soldier greaves, rapier.',
  ],

  'row_apothecary.desc': 'Vendor at the Retort Gate. The Dispensary Hatch sells healing salve, mushroom broth, mendroot and spring water.',
  'row_apothecary.dialogue': [
    'I sell healing salve, mushroom broth, mendroot and spring water.',
    'The Alembics are 1 s up the row. The alchemy bench and Odri Venn’s reagent shelf are there.',
    'Buy before the climb. The only vendor in the tower is the quartermaster on floor 2.',
  ],

  'granary_provisioner.desc': 'Vendor at the Granary Gate. The Cart sells cooked food: traveler’s ration, rustic loaf, charred roots, skewered fish, hearty stew, hearty sandwich and seared steak.',
  'granary_provisioner.dialogue': [
    'Rations, loaves, roots, fish, stew, sandwiches and steak. All cooked, all ready to eat.',
    'Bryva Coll sells the raw ingredients in the Granary Kitchens, 1 s from here. Her stove cooks what my cart sells.',
    'A stranger pays half again the price. Speaking to me once removes that.',
  ],

  'hall_tutor.desc': 'Stands in the Cleared Office on floor 2. Teaches Gather (Neutral → Coiled), then Lunge (Coiled → Extended) once you know a way into Coiled. Both free.',
  'hall_tutor.dialogue': [
    'Two techniques. Gather moves you from Neutral to Coiled. Lunge moves you from Coiled to Extended. A plain swing returns you to Neutral.',
    'Coiled is the wind-up position: heavy techniques start from it. Extended is the reach position.',
    'The rest of it I do not teach here. Not yet.',
  ],

  'hall_quartermaster.desc': 'Vendor in the Quartermaster’s Cage on floor 2. Sells healing salve, mushroom broth, traveler’s ration and rustic loaf.',
  'hall_quartermaster.dialogue': [
    'Salve, broth, rations, bread. Tower prices.',
    'The hall runs four stretches. The break room is behind the third, with chairs.',
  ],
  'f11_steward.desc': 'In the stronghold’s gatehouse on floor 11. Gives Shore Up the Gate, then Arm the Wall, which opens the wave on the wall. Only before the stronghold is held.',
  'f11_steward.dialogue': [
    'The gate first: twenty hardwood from the yard, fifteen iron scrap. The road’s raiders carry scrap.',
    'Then the wall: ten raiders off the road, four iron ingots for the braces. The forge in town makes them, or the smith sells them.',
    'When the wall is armed, they come. Eight fights. Hold the last one and the place is yours, and this life ends there: the next one starts at the Foot.',
  ],

  // ==== HARBOR: NPC text (2026-10-30; the harbor builder's section) ====
  'f11_factor.desc': 'The merchants’ recruiter at the merchant berth on floor 11. Gives Sign With the Merchants, which picks the merchants for the run, then Clear the Closed Port.',
  'f11_factor.dialogue': [
    'Sign with us and the convoy is yours: you defend it from anything that boards, and you sell what survives at port.',
    'The other berths stop dealing with you once you sign. One side a run.',
    'Speechcraft sets the price per crate: 5 waives the duty, 15 gets a broker instead of the dock buyer, 30 haggles the price.',
  ],
  'f11_bosun.desc': 'The pirates’ recruiter at the smugglers’ berth on floor 11. Gives Sign On With the Pirates, which picks the pirates for the run, then Forge a Signal.',
  'f11_bosun.dialogue': [
    'Sign on and you seize crates from the convoy. Each leg, every guard you kill adds one crate to what you seize.',
    'The other berths stop dealing with you once you sign. One side a run.',
    'Floor 12 has a cove off the outer port. Search the port to find the way in.',
  ],
  'f11_letter_agent.desc': 'The privateers’ recruiter at the privateer berth on floor 11. Gives Take Out a Letter of Marque, which picks the privateers for the run, then Renew the Letter.',
  'f11_letter_agent.dialogue': [
    'The pirates take the convoy; a letter of marque lets you take it back from them.',
    'The other berths stop dealing with you once you sign. One side a run.',
    'Each leg, every pirate you kill adds one crate to what you recover.',
  ],
  'f11_lieutenant.desc': 'The navy’s recruiter at the navy berth on floor 11. Gives Enlist With the Navy, which picks the navy for the run, then Bait a Lure.',
  'f11_lieutenant.dialogue': [
    'The navy escorts the convoy against the sea monsters. Pirates are not our business on these lanes.',
    'The other berths stop dealing with you once you sign. One side a run.',
    'The beast on floor 14 closes the lanes. Bait a lure first and it comes up Surprised.',
  ],
  'f13_pilot.desc': 'At the Last Port on floor 13. Sells a Pilot’s Passage; once bought, the Pilot’s Channel into the blockade is open and the blockaders start that fight Surprised.',
  'f13_pilot.dialogue': [
    'Through the picket line you start the fight Flat-Footed. Through my channel, the blockaders start it Surprised.',
    'One passage, and the channel is yours for the run.',
  ],
  'f13_harbor_master.desc': 'At the Last Port on floor 13. Sells Port Clearance to merchants only: the factor’s Clear the Closed Port asks for one bought.',
  'f13_harbor_master.dialogue': [
    'The closed port on floor 14 opens only for Port Clearance papers.',
    'I sell Port Clearance to merchants only.',
  ],

  // ==== DESERT: NPC text (the desert builder's section) ====
  'f20_broker.desc': 'The port house broker on floor 20’s quay. Buys at the posted rates, which are the global sell prices: selling here pays what selling anywhere pays. Sells nothing.',
  'f20_broker.dialogue': [
    'Posted rates. The same coin you would get for it anywhere in the tower; the port house pays no premium.',
    'The port house licenses the digs and buys what comes out of them. It sells nothing back.',
    'The ferry to the island leaves from the roadstead. Its crew fights whoever rows out.',
  ],
};
