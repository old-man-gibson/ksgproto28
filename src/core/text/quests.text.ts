import type { ProseTable } from './prose';

// Player-facing text for src/core/data/quests.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- QUESTS ----------
export const QUESTS_TEXT: ProseTable = {
  'faces_of_threshold.desc': 'Talk to the eight trades of Threshold, one per district. Each vendor charges strangers half again the price until spoken to. Reward: 60 gold, 50 level XP, 4 favor, 25 Scouting XP, and a crate of iron scrap, raw meat, common herb, spring water and mendroot.',
  'faces_of_threshold.objectives.0.desc': 'Meet the smith at the Forges',
  'faces_of_threshold.objectives.1.desc': 'Meet the docent in the Reading Hall',
  'faces_of_threshold.objectives.2.desc': 'Meet the prior at the Nine Chapels',
  'faces_of_threshold.objectives.3.desc': 'Meet the captain at the Muster Gate',
  'faces_of_threshold.objectives.4.desc': 'Meet the chef in the Granary Kitchens',
  'faces_of_threshold.objectives.5.desc': 'Meet the alchemist at the Alembics',
  'faces_of_threshold.objectives.6.desc': 'Meet Ilex on Censer Walk',
  'faces_of_threshold.objectives.7.desc': 'Meet Master Ekwe on the Sand',

  'a_taste_of_everything.desc': 'Use each open craft once with the Warden’s crate: smelt an ingot, cook a dish, bottle a brew, add 3 bestiary species, defeat 5 monsters, inscribe a new spell, learn a miracle. Reward: 250 gold, 75 level XP. Requires The Faces of Threshold.',
  'a_taste_of_everything.objectives.0.desc': 'Smelt iron at the Forges',
  'a_taste_of_everything.objectives.1.desc': 'Cook a dish on the Cooking Stove in the Granary Kitchens',
  'a_taste_of_everything.objectives.2.desc': 'Bottle a brew at the Alembics',
  'a_taste_of_everything.objectives.3.desc': 'Add 3 species to your bestiary (the Cages)',
  'a_taste_of_everything.objectives.4.desc': 'Defeat 5 monsters (floor 0 counts)',
  'a_taste_of_everything.objectives.5.desc': 'Inscribe a new spell at the Reading Hall’s Spellcrafting Table',
  'a_taste_of_everything.objectives.6.desc': 'Learn a miracle at the Nine Chapels (Spellcrafting Table, Divine tab)',

  "the_first_ascent.desc": "Find the toll stamp that is still being used in the flooded offices. Follow the vermin’s retreat, search the records, and locate the collector. Reward: 350 gold, 100 level XP, 1 favor.",
  "the_first_ascent.objectives.0.desc": "Recover the toll stamp from the collector",

  'f11_shore_up_the_gate.desc': 'Bring the steward on floor 11 twenty hardwood and fifteen iron scrap. The yard has timber; the road’s raiders drop scrap. Reward: 200 gold, 150 level XP. Placeholder text.',
  'f11_shore_up_the_gate.objectives.0.desc': 'Bring 20 hardwood',
  'f11_shore_up_the_gate.objectives.1.desc': 'Bring 15 iron scrap',
  'f11_arm_the_wall.desc': 'Clear ten raiders out of the yard and bring four iron ingots. Turning it in opens the wave on the wall. Reward: 250 gold, 200 level XP. Placeholder text.',
  'f11_arm_the_wall.objectives.0.desc': 'Kill 10 raiders',
  'f11_arm_the_wall.objectives.1.desc': 'Bring 4 iron ingots',

  // ==== HARBOR: quest text (2026-10-30; the harbor builder's section) ====
  'f11_join_merchants.desc': 'Accepting this picks the merchants for the run; the other three berths stop offering theirs. Win 8 crates on the roadstead: defend the convoy and sell what is left at port. Reward: 300 gold, 250 level XP. Placeholder text.',
  'f11_join_merchants.objectives.0.desc': 'Win 8 crates',
  'f11_join_pirates.desc': 'Accepting this picks the pirates for the run; the other three berths stop offering theirs. Win 8 crates on the roadstead by seizing them from the convoy. Reward: 300 gold, 250 level XP. Placeholder text.',
  'f11_join_pirates.objectives.0.desc': 'Win 8 crates',
  'f11_join_privateers.desc': 'Accepting this picks the privateers for the run; the other three berths stop offering theirs. Win 8 crates on the roadstead by recovering them from the pirates. Reward: 300 gold, 250 level XP. Placeholder text.',
  'f11_join_privateers.objectives.0.desc': 'Win 8 crates',
  'f11_join_navy.desc': 'Accepting this picks the navy for the run; the other three berths stop offering theirs. Win 8 crates on the roadstead by escorting the convoy past the sea monsters. Reward: 300 gold, 250 level XP. Placeholder text.',
  'f11_join_navy.objectives.0.desc': 'Win 8 crates',
  'f11_merchants_clearance.desc': 'Buy a Port Clearance from the harbor master at the Last Port on floor 13. Turned in, the warden of the closed port and his escorts start the floor-14 fight Flat-Footed. Reward: 200 gold, 300 level XP. Placeholder text.',
  'f11_merchants_clearance.objectives.0.desc': 'Buy a Port Clearance',
  'f11_pirates_signal.desc': 'Take the signal books off 12 marines. Turned in, the treasure galleon’s crew starts the floor-14 fight Surprised. Reward: 200 gold, 300 level XP. Placeholder text.',
  'f11_pirates_signal.objectives.0.desc': 'Kill 12 marines',
  'f11_privateers_letter.desc': 'Kill 12 pirate gunners as proof of service. Turned in, the pirate king’s crew starts the floor-14 fight Flat-Footed. Reward: 200 gold, 300 level XP. Placeholder text.',
  'f11_privateers_letter.objectives.0.desc': 'Kill 12 pirate gunners',
  'f11_navy_lure.desc': 'Kill 12 deep serpents to bait the lure. Turned in, the sea beast and its brood start the floor-14 fight Surprised. Reward: 200 gold, 300 level XP. Placeholder text.',
  'f11_navy_lure.objectives.0.desc': 'Kill 12 deep serpents',
};
