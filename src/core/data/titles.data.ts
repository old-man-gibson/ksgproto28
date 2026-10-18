import type { TitleDef } from '../types';
import { prose } from '../text/prose';
import { TITLES_TEXT } from '../text/titles.text';

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
export const TITLES = prose<TitleDef>('TITLES', TITLES_TEXT, {
  // The cage keeper's dare, taken and won (SpotDef.dare on the_cages). The
  // underdog's title: `vsLarger` reads per size step the target is above you.
  david_and_goslimath: {
    id: 'david_and_goslimath',
    name: 'David and Goslimath',
    icon: '🪨',
    secret: true,
    unlock: [{ type: 'stat', key: 'kills:suspiciously_large_slime', value: 1 }],
    passive: [{ stat: 'vsLarger', op: 'add', value: 0.03 }],
    equipped: [{ stat: 'vsLarger', op: 'add', value: 0.15 }],
  },
  procedural_objection: {
    id: 'procedural_objection', name: 'Procedural Objection', icon: '✊', secret: true,
    unlock: [{ type: 'stat', key: 'flag:toll_brute_force', value: 1 }],
  },
  iconoclast: {
    id: 'iconoclast',
    name: 'Iconoclast',
    icon: '⛓️‍💥',
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
});
