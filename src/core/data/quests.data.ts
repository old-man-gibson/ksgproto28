import type { QuestDef } from '../types';

/**
 * Quests (adapted from proto26's firstPosting/hammerAndAnvil + new bridge
 * content). Chains are expressed with { type: 'quest' } requirements.
 * Turn-in requires standing at the giver's spot.
 */
export const QUESTS: Record<string, QuestDef> = {
  // ---------- The Warden of the Foot (the user's first quest list, 2026-09-06) ----------
  //
  // Quest 1: meet the nine trades before trying the tower (talk objectives
  // read `met:*` live, so a greeting made early still counts). Quest 2:
  // familiarize with the open systems, on the Warden's own materials — the
  // starter bundle arrives as quest 1's reward, and the favor with it is what
  // makes the first miracle purchasable. PLACEHOLDER PROSE per docs/VOICE.md;
  // objectives and rewards are the settled part.
  faces_of_threshold: {
    id: 'faces_of_threshold',
    name: 'The Faces of Threshold',
    desc: 'The Warden holds the door and vouches for nobody. Get known instead — a stranger pays full price at every counter in this city.',
    giver: 'warden_of_the_foot',
    objectives: [
      { type: 'talk', npcId: 'master_smith', desc: 'Meet the smith at the Forges' },
      { type: 'talk', npcId: 'lectory_wizard', desc: 'Meet the docent in the Reading Hall' },
      { type: 'talk', npcId: 'chapel_priest', desc: 'Meet the prior at the Nine Chapels' },
      { type: 'talk', npcId: 'militia_captain', desc: 'Meet the captain at the Muster Gate' },
      { type: 'talk', npcId: 'head_chef', desc: 'Meet the chef in the Granary Kitchens' },
      { type: 'talk', npcId: 'row_alchemist', desc: 'Meet the alchemist at the Alembics' },
      { type: 'talk', npcId: 'psionic_shaper', desc: 'Meet the one who sits in the incense' },
      { type: 'talk', npcId: 'dojo_master', desc: 'Meet the master on the Sand' },
    ],
    rewards: {
      gold: 60,
      // The introduction to the gods (the prior's doing, narratively): with
      // the turn-in's own +1 this reaches the cheapest miracle's price.
      favor: 4,
      // The Warden's crates: enough of everything to try each open craft.
      materials: [
        { id: 'iron_scrap', qty: 6 },
        { id: 'raw_meat', qty: 4 },
        { id: 'common_herb', qty: 4 },
        { id: 'spring_water', qty: 3 },
        { id: 'mendroot', qty: 3 },
      ],
      skillXp: [{ id: 'scouting', xp: 25 }],
    },
  },
  a_taste_of_everything: {
    id: 'a_taste_of_everything',
    name: 'A Taste of Everything',
    desc: 'Every craft in this city feeds the climb somehow. Try each one while the materials are somebody else’s.',
    giver: 'warden_of_the_foot',
    requirements: [{ type: 'quest', id: 'faces_of_threshold' }],
    objectives: [
      { type: 'craft', recipeId: 'iron_ingot', count: 1, desc: 'Smelt iron at the Forges' },
      { type: 'craft', discipline: 'cooking', count: 1, desc: 'Cook a dish in the Granary Kitchens' },
      { type: 'craft', discipline: 'alchemy', count: 1, desc: 'Bottle a brew at the Alembics' },
      { type: 'stat', key: 'bestiary:entries', value: 3, desc: 'Add three species to your bestiary (the Cages)' },
      { type: 'stat', key: 'kills', value: 5, desc: 'Win a handful of fights' },
      { type: 'stat', key: 'spells:inscribed', value: 1, desc: 'Inscribe a working at the Reading Hall' },
      { type: 'stat', key: 'miracles:learned', value: 1, desc: 'Receive a miracle at the Nine Chapels' },
    ],
    rewards: { gold: 250 },
  },
  the_first_ascent: {
    id: 'the_first_ascent',
    name: 'The First Ascent',
    desc: 'The Warden wants the toll level quiet. Something keeps the far arch — put it down, whichever hour keeps it — and mind how far you stray from the lit stores.',
    giver: 'warden_of_the_foot',
    requirements: [{ type: 'quest', id: 'a_taste_of_everything' }],
    // The same latch the floor's clear reads: any keeper pays it — the day
    // hobgoblin, the night slime, or the ambush the player planned into.
    objectives: [{ type: 'stat', key: 'boss:f1_toll_hall', value: 1, desc: 'Defeat the keeper of the Toll Hall' }],
    rewards: { gold: 350, favor: 1 },
  },

  // ---- Vermin Festival quest chain -----
  /* DESC:
  whispers of a mysterious



   */
};
