import type { ProseTable } from './prose';

// Player-facing text for src/core/data/quests.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- QUESTS ----------
export const QUESTS_TEXT: ProseTable = {
  'faces_of_threshold.desc': 'Talk to the eight trades of Threshold, one per district. Each vendor charges strangers half again the price until spoken to. Reward: 60 gold, 4 favor, 25 Scouting XP, and a crate of iron scrap, raw meat, common herb, spring water and mendroot.',
  'faces_of_threshold.objectives.0.desc': 'Meet the smith at the Forges',
  'faces_of_threshold.objectives.1.desc': 'Meet the docent in the Reading Hall',
  'faces_of_threshold.objectives.2.desc': 'Meet the prior at the Nine Chapels',
  'faces_of_threshold.objectives.3.desc': 'Meet the captain at the Muster Gate',
  'faces_of_threshold.objectives.4.desc': 'Meet the chef in the Granary Kitchens',
  'faces_of_threshold.objectives.5.desc': 'Meet the alchemist at the Alembics',
  'faces_of_threshold.objectives.6.desc': 'Meet Ilex on Censer Walk',
  'faces_of_threshold.objectives.7.desc': 'Meet Master Ekwe on the Sand',

  'a_taste_of_everything.desc': 'Use each open craft once with the Warden’s crate: smelt an ingot, cook a dish, bottle a brew, add 3 bestiary species, win 5 fights, inscribe a spell, learn a miracle. Reward: 250 gold. Requires The Faces of Threshold.',
  'a_taste_of_everything.objectives.0.desc': 'Smelt iron at the Forges',
  'a_taste_of_everything.objectives.1.desc': 'Cook a dish in the Granary Kitchens',
  'a_taste_of_everything.objectives.2.desc': 'Bottle a brew at the Alembics',
  'a_taste_of_everything.objectives.3.desc': 'Add 3 species to your bestiary (the Cages)',
  'a_taste_of_everything.objectives.4.desc': 'Win 5 fights',
  'a_taste_of_everything.objectives.5.desc': 'Inscribe a spell at the Reading Hall’s Spell Table',
  'a_taste_of_everything.objectives.6.desc': 'Learn a miracle at the Nine Chapels',

  'the_first_ascent.desc': 'Defeat the keeper of the Toll Hall on floor 1: a Hobgoblin by day or a Slimer by night. Either clears the floor. Reward: 350 gold, 1 favor. Requires A Taste of Everything.',
  'the_first_ascent.objectives.0.desc': 'Defeat the keeper of the Toll Hall (Hobgoblin by day, Slimer by night)',

  'into_the_wildwood.desc': 'Climb to floor 2, the Wildwood, and talk to the Pathwarden at the Treeline Camp. Floor 2 opens at 150 gold earned in total. Reward: 100 gold. Requires The First Ascent.',
  'into_the_wildwood.objectives.0.desc': 'Meet the Pathwarden at the Treeline Camp (floor 2)',

  'the_grand_elevator.desc': 'Find the Grand Elevator in the Deep Wildwood, clear the four nests that keep it asleep, and wake it. Waking it clears floor 2, opens the floors above and makes prestige available. Reward: 600 gold, 2 favor, 60 Scouting XP.',
  'the_grand_elevator.objectives.0.desc': 'Find the path to the Grand Elevator (comb the Deep Wildwood)',
  'the_grand_elevator.objectives.1.desc': 'Raid the Goblin Warren, down to its king',
  'the_grand_elevator.objectives.2.desc': 'Clear the Sunken Crypt (its stair is in the Deep Wildwood)',
  'the_grand_elevator.objectives.3.desc': 'Break the packs in the Wolf Runs',
  'the_grand_elevator.objectives.4.desc': 'Clear the Hive Mound in one unbroken push',
  'the_grand_elevator.objectives.5.desc': 'Wake the Grand Elevator',
};
