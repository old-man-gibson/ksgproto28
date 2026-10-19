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
};
