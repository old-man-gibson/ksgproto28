import type { AchievementDef } from '../types';

/**
 * Tiered achievements. Each tier reached grants its bonus permanently,
 * applied through the same Modifier pipeline as equipment.
 */
export const ACHIEVEMENTS: Record<string, AchievementDef> = {
  slayer: {
    id: 'slayer',
    name: 'Slayer',
    icon: '💀',
    statKey: 'kills',
    descTemplate: 'Defeat {n} monsters',
    tiers: [
      { threshold: 100, bonus: [{ stat: 'damage', op: 'mult', value: 0.02 }] },
      { threshold: 1000, bonus: [{ stat: 'damage', op: 'mult', value: 0.03 }] },
      { threshold: 10000, bonus: [{ stat: 'damage', op: 'mult', value: 0.05 }] },
    ],
  },
  honed_body: {
    id: 'honed_body',
    name: 'Honed Body',
    icon: '🏋️',
    statKey: 'attr:str',
    descTemplate: 'Reach Strength level {n}',
    tiers: [
      { threshold: 10, bonus: [{ stat: 'maxHp', op: 'add', value: 10 }] },
      { threshold: 25, bonus: [{ stat: 'maxHp', op: 'add', value: 25 }] },
      {
        threshold: 50,
        bonus: [
          { stat: 'maxHp', op: 'add', value: 50 },
          { stat: 'str', op: 'add', value: 2 },
        ],
      },
    ],
  },
  wanderer: {
    id: 'wanderer',
    name: 'Wanderer',
    icon: '🥾',
    statKey: 'travel:trips',
    descTemplate: 'Complete {n} journeys',
    tiers: [
      { threshold: 10, bonus: [{ stat: 'travelSpeed', op: 'mult', value: 0.05 }] },
      { threshold: 50, bonus: [{ stat: 'travelSpeed', op: 'mult', value: 0.1 }] },
      { threshold: 200, bonus: [{ stat: 'travelSpeed', op: 'mult', value: 0.15 }] },
    ],
  },
  fortune_seeker: {
    id: 'fortune_seeker',
    name: 'Fortune Seeker',
    icon: '💰',
    statKey: 'gold:earned',
    descTemplate: 'Earn {n} gold in total',
    tiers: [
      { threshold: 100, bonus: [{ stat: 'loot', op: 'mult', value: 0.03 }] },
      { threshold: 1000, bonus: [{ stat: 'loot', op: 'mult', value: 0.05 }] },
      { threshold: 10000, bonus: [{ stat: 'loot', op: 'mult', value: 0.1 }] },
    ],
  },
  miner: {
    id: 'miner',
    name: 'Miner',
    icon: '⛏️',
    statKey: 'gather:iron_scrap',
    descTemplate: 'Mine {n} iron scrap in total',
    tiers: [
      { threshold: 5, bonus: [{ stat: 'loot', op: 'mult', value: 0.03 }] },
      { threshold: 10, bonus: [{ stat: 'loot', op: 'mult', value: 0.05 }] },
      { threshold: 50, bonus: [{ stat: 'loot', op: 'mult', value: 0.1 }] },
    ],
  },
  /**
   * The hunter pattern: count kills by TAG, and pay the bonus back only
   * against that tag. `kills:tag:<t>` is bumped for every tag a corpse carried,
   * and `requiresMonsterTag` keeps the reward pointed at the same quarry — so
   * an Umbral Slime (slime + incorporeal + dark) feeds and is hurt by every
   * hunter bonus it matches, all at once.
   */
  slime_kills: {
    id: 'slime_kills',
    name: 'Slime Hunter',
    icon: '🫧',
    statKey: 'kills:tag:slime',
    descTemplate: 'Kill {n} slimes of any kind',
    tiers: [
      { threshold: 5, bonus: [{ stat: 'damage', op: 'mult', value: 0.03, requiresMonsterTag: 'slime' }] },
      { threshold: 10, bonus: [{ stat: 'damage', op: 'mult', value: 0.05, requiresMonsterTag: 'slime' }] },
      { threshold: 50, bonus: [{ stat: 'damage', op: 'mult', value: 0.1, requiresMonsterTag: 'slime' }] },
    ],
  },
  inorganic_kills: {
    id: 'inorganic_kills',
    name: 'Breaker',
    icon: '🧱',
    statKey: 'kills:tag:inorganic',
    descTemplate: 'Destroy {n} things that were never alive',
    tiers: [
      { threshold: 5, bonus: [{ stat: 'penetration', op: 'add', value: 0.02, requiresMonsterTag: 'inorganic' }] },
      { threshold: 25, bonus: [{ stat: 'damage', op: 'mult', value: 0.05, requiresMonsterTag: 'inorganic' }] },
      { threshold: 100, bonus: [{ stat: 'penetration', op: 'add', value: 0.05, requiresMonsterTag: 'inorganic' }] },
    ],
  },
  questmaster: {
    id: 'questmaster',
    name: 'Questmaster',
    icon: '⭐',
    statKey: 'quests:completed',
    descTemplate: 'Complete {n} quests',
    tiers: [
      { threshold: 3, bonus: [{ stat: 'skillXp', op: 'mult', value: 0.05 }] },
      { threshold: 6, bonus: [{ stat: 'goldGain', op: 'mult', value: 0.05 }] },
      { threshold: 12, bonus: [{ stat: 'skillXp', op: 'mult', value: 0.1 }] },
    ],
  },
  artisan: {
    id: 'artisan',
    name: 'Artisan',
    icon: '🔨',
    statKey: 'crafts',
    descTemplate: 'Craft {n} items',
    tiers: [
      { threshold: 10, bonus: [{ stat: 'craftSpeed', op: 'mult', value: 0.05 }] },
      { threshold: 100, bonus: [{ stat: 'craftSpeed', op: 'mult', value: 0.08 }] },
      { threshold: 1000, bonus: [{ stat: 'craftSpeed', op: 'mult', value: 0.12 }] },
    ],
  },
  student: {
    id: 'student',
    name: 'Eternal Student',
    icon: '🎓',
    statKey: 'skill:levels',
    descTemplate: 'Gain {n} skill levels in total',
    tiers: [
      { threshold: 25, bonus: [{ stat: 'skillXp', op: 'mult', value: 0.05 }] },
      { threshold: 100, bonus: [{ stat: 'skillXp', op: 'mult', value: 0.08 }] },
      { threshold: 500, bonus: [{ stat: 'skillXp', op: 'mult', value: 0.12 }] },
    ],
  },
};
