import type { QuestDef } from '../types';

/**
 * Quests (adapted from proto26's firstPosting/hammerAndAnvil + new bridge
 * content). Chains are expressed with { type: 'quest' } requirements.
 * Turn-in requires standing at the giver's spot.
 */
export const QUESTS: Record<string, QuestDef> = {
  // ---------- Thora Ironbrand (smithing chain) ----------
  hammer_and_anvil: {
    id: 'hammer_and_anvil',
    name: 'Hammer and Anvil',
    desc: 'Assist Thora by smelting a batch of iron ingots at her forge.',
    giver: 'thora_ironbrand',
    objectives: [{ type: 'craft', recipeId: 'iron_ingot', count: 3, desc: 'Smelt Iron Ingots' }],
    rewards: {
      gold: 60,
      materials: [{ id: 'iron_ingot', qty: 2 }],
      skillXp: [{ id: 'smithing', xp: 20 }],
    },
  },
  temper_steel: {
    id: 'temper_steel',
    name: 'Temper Steel',
    desc: 'Prove your craft: forge a proper iron sword.',
    giver: 'thora_ironbrand',
    requirements: [{ type: 'quest', id: 'hammer_and_anvil' }],
    objectives: [{ type: 'craft', recipeId: 'iron_sword', count: 1, desc: 'Forge an Iron Sword' }],
    rewards: { gold: 150, items: ['iron_gauntlets'] },
  },

  // ---------- Captain Bren (guard chain) ----------
  first_posting: {
    id: 'first_posting',
    name: 'First Posting',
    desc: 'Prove your steadiness: thin out the goblins harassing the roads.',
    giver: 'captain_bren',
    objectives: [{ type: 'kill', monsterId: 'goblin', count: 10, desc: 'Slay Goblins' }],
    rewards: { gold: 100, skillXp: [{ id: 'fighting', xp: 30 }] },
  },
  head_of_the_problem: {
    id: 'head_of_the_problem',
    name: 'Head of the Problem',
    desc: 'The goblins have a boss. Captain Bren would like them not to.',
    giver: 'captain_bren',
    requirements: [{ type: 'quest', id: 'first_posting' }],
    objectives: [{ type: 'kill', monsterId: 'goblin_boss', count: 1, desc: 'Defeat the Boss Goblin' }],
    rewards: { gold: 300, items: ['wolf_cloak'] },
  },

  // ---------- Elder Maren (bridge chain) ----------
  word_from_the_west: {
    id: 'word_from_the_west',
    name: 'Word from the West',
    desc: 'Carry Oakrest’s greetings down the Old Road to the Westlands hamlet.',
    giver: 'elder_maren',
    objectives: [{ type: 'reach', spotId: 'hamlet_square', desc: 'Reach the Hamlet Square' }],
    rewards: { gold: 50, skillXp: [{ id: 'scouting', xp: 25 }] },
  },
  eight_legs_too_many: {
    id: 'eight_legs_too_many',
    name: 'Eight Legs Too Many',
    desc: 'Cull the ravine spiders and bring herbs for antivenom.',
    giver: 'elder_maren',
    requirements: [{ type: 'quest', id: 'word_from_the_west' }],
    objectives: [
      { type: 'kill', monsterId: 'cave_spider', count: 15, desc: 'Slay Cave Spiders' },
      { type: 'collect', materialId: 'common_herb', qty: 8, desc: 'Bring Common Herbs' },
    ],
    rewards: { gold: 200, items: ['herbal_charm'] },
  },
  // ---- Vermin Festival quest chain -----
  /* DESC:
  whispers of a mysterious



   */
};
