import type { ProseTable } from './prose';

// Player-facing text for src/core/data/quests.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- QUESTS ----------
export const QUESTS_TEXT: ProseTable = {
  'faces_of_threshold.desc': 'The Warden holds the door and vouches for nobody. Get known instead — a stranger pays full price at every counter in this city.',
  'faces_of_threshold.objectives.0.desc': 'Meet the smith at the Forges',
  'faces_of_threshold.objectives.1.desc': 'Meet the docent in the Reading Hall',
  'faces_of_threshold.objectives.2.desc': 'Meet the prior at the Nine Chapels',
  'faces_of_threshold.objectives.3.desc': 'Meet the captain at the Muster Gate',
  'faces_of_threshold.objectives.4.desc': 'Meet the chef in the Granary Kitchens',
  'faces_of_threshold.objectives.5.desc': 'Meet the alchemist at the Alembics',
  'faces_of_threshold.objectives.6.desc': 'Meet the one who sits in the incense',
  'faces_of_threshold.objectives.7.desc': 'Meet the master on the Sand',

  'a_taste_of_everything.desc': 'Every craft in this city feeds the climb somehow. Try each one while the materials are somebody else’s.',
  'a_taste_of_everything.objectives.0.desc': 'Smelt iron at the Forges',
  'a_taste_of_everything.objectives.1.desc': 'Cook a dish in the Granary Kitchens',
  'a_taste_of_everything.objectives.2.desc': 'Bottle a brew at the Alembics',
  'a_taste_of_everything.objectives.3.desc': 'Add three species to your bestiary (the Cages)',
  'a_taste_of_everything.objectives.4.desc': 'Win a handful of fights',
  'a_taste_of_everything.objectives.5.desc': 'Inscribe a working at the Reading Hall',
  'a_taste_of_everything.objectives.6.desc': 'Receive a miracle at the Nine Chapels',

  'the_first_ascent.desc': 'The Warden wants the toll level quiet. Something keeps the far arch — put it down, whichever hour keeps it — and mind how far you stray from the lit stores.',
  'the_first_ascent.objectives.0.desc': 'Defeat the keeper of the Toll Hall',
};
