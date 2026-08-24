import type { TitleDef } from '../types';

/**
 * Titles: earned once via unlock conditions (simple thresholds or complex
 * multi-part deeds), passive bonuses forever, extra bonuses while worn.
 *
 * Complex deeds combine a trigger stat (a kill/quest counter) with `statMax`
 * restraint conditions — the set latches the moment the trigger lands while
 * the restraint still holds. Counters for restraints:
 *   weapon:families — distinct weapon families ever attacked with (unarmed
 *                     doesn't count; tracked in combat.ts).
 */
export const TITLES: Record<string, TitleDef> = {
  iconoclast: {
    id: 'iconoclast',
    name: 'Iconoclast',
    icon: '⛓️‍💥',
    desc:
      'Receive ten miracles. The gods call it devotion; you call it a collection — and worn, ' +
      'this title lets hostile powers share a grimoire page whether they like it or not.',
    unlock: [{ type: 'stat', key: 'miracles:learned', value: 10 }],
    secret: true,
    defiesDogma: true,
    passive: [{ stat: 'maxSpirit', op: 'add', value: 5 }],
    equipped: [{ stat: 'spellPower', op: 'mult', value: 0.05 }],
  },
  wanderer: {
    id: 'wanderer',
    name: 'Wanderer',
    icon: '🥾',
    desc: 'Complete 50 journeys between spots. The road knows your name.',
    unlock: [{ type: 'stat', key: 'travel:trips', value: 50 }],
    passive: [{ stat: 'travelSpeed', op: 'mult', value: 0.05 }],
    equipped: [
      { stat: 'travelSpeed', op: 'mult', value: 0.1 },
      { stat: 'loot', op: 'add', value: 0.1 },
    ],
  },
  slayer: {
    id: 'slayer',
    name: 'Slayer',
    icon: '🗡️',
    desc: 'Fell 100 creatures. They flinch before you swing.',
    unlock: [{ type: 'stat', key: 'kills', value: 100 }],
    passive: [{ stat: 'damage', op: 'mult', value: 0.02 }],
    equipped: [
      { stat: 'damage', op: 'mult', value: 0.05 },
      { stat: 'crit', op: 'add', value: 0.02 },
    ],
  },
  titan_incarnate: {
    id: 'titan_incarnate',
    name: 'Titan Incarnate',
    icon: '🏔️',
    desc: 'Reach Strength 100. Mountains politely step aside.',
    unlock: [{ type: 'attr', attr: 'str', level: 100 }],
    passive: [{ stat: 'damage', op: 'add', value: 10 }],
    equipped: [
      { stat: 'damage', op: 'mult', value: 0.1 },
      { stat: 'maxHp', op: 'mult', value: 0.05 },
    ],
  },
  first_blade: {
    id: 'first_blade',
    name: 'Devotee of the First Blade',
    icon: '⚜️',
    desc: 'Defeat the Goblin Warchief having never raised any weapon family but your first.',
    unlock: [
      { type: 'stat', key: 'kills:goblin_boss', value: 1 },
      { type: 'statMax', key: 'weapon:families', value: 1 },
    ],
    passive: [{ stat: 'damage', op: 'mult', value: 0.03 }],
    equipped: [
      { stat: 'damage', op: 'mult', value: 0.08 },
      { stat: 'speed', op: 'mult', value: 0.05 },
    ],
  },
  untouchable: {
    id: 'untouchable',
    name: 'Untouchable',
    icon: '🌫️',
    desc: 'Defeat the Goblin Warchief without ever having been knocked out.',
    secret: true,
    unlock: [
      { type: 'stat', key: 'kills:goblin_boss', value: 1 },
      { type: 'statMax', key: 'defeats', value: 0 },
    ],
    passive: [{ stat: 'dodge', op: 'add', value: 0.02 }],
    equipped: [
      { stat: 'dodge', op: 'add', value: 0.03 },
      { stat: 'actionBar', op: 'mult', value: -0.03 },
    ],
  },
};
