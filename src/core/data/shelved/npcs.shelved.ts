import type { NpcDef } from '../../types';

/**
 * THE SHELF — the people of the countryside (shelved 2026-09-12, see
 * locations.shelved.ts). Thora at the hamlet forge, Captain Bren at the town
 * gates, Elder Maren in the Oakrest square, Nakano Angou on the Malgeri peak.
 * Not loaded by the game; mounted by tests/fixtures/shelved-world.ts.
 */
export const SHELVED_NPCS: Record<string, NpcDef> = {
  thora_ironbrand: {
    id: 'thora_ironbrand',
    name: 'Thora Ironbrand',
    icon: '👩‍🏭',
    spotId: 'hamlet_forge',
    desc: 'The hamlet blacksmith. Approves of calluses.',
    dialogue: [
      'Keep your edge keen and your work honest.',
      'The anvil’s song rewards patience.',
      'Scrap in, steel out. That’s the whole philosophy.',
    ],
    quests: ['hammer_and_anvil', 'temper_steel'],
  },
  captain_bren: {
    id: 'captain_bren',
    name: 'Captain Bren',
    icon: '💂',
    spotId: 'town_gates',
    desc: 'Captain of the hamlet watch. Perpetually squinting at the horizon.',
    dialogue: [
      'Eyes up. Trouble comes when you least expect it.',
      'A steady post keeps the roads safe.',
      'Goblins again. It’s always goblins.',
    ],
    quests: ['first_posting', 'head_of_the_problem'],
  },
  elder_maren: {
    id: 'elder_maren',
    name: 'Elder Maren',
    icon: '🧓',
    spotId: 'village_square',
    desc: 'Oakrest’s elder. Remembers when the Old Road actually went somewhere.',
    dialogue: [
      'The Westlands used to trade with us, before the roads got dangerous.',
      'You have a wanderer’s eyes. Good. We need those.',
      'The ravine spiders grow bolder every season.',
    ],
    quests: ['word_from_the_west', 'eight_legs_too_many'],
  },
  nakano_angou: {
    id: 'nakano_angou',
    name: 'Nakano Angou',
    icon: '🧓',
    spotId: 'malgeri_peak',
    desc: 'A strange oni. Elemental Arms float behind his back.',
    dialogue: [
      'The Westlands used to trade with us, before the roads got dangerous.',
      'You have a wanderer’s eyes. Good. We need those.',
      'The ravine spiders grow bolder every season.',
    ],
    quests: [],
  },
};
