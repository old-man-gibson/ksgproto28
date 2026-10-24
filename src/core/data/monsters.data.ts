import type { ModifierTierDef, MonsterDef, RarityDef, TierDef } from '../types';
import { prose } from '../text/prose';
import { MONSTERS_TEXT } from '../text/monsters.text';

/**
 * Intrinsic monster tiers (proto26 model): part of a monster's identity,
 * with the stat multiplier ROLLED within the range at spawn for variance.
 *
 * `penetration` is what a monster of the tier applies conditions with (comes off
 * the player's resistance in the immunity test only; `MonsterDef.penetration`
 * overrides it per species). Floors 1 to 3 need 0, and their one elite (the
 * Puppet Bureaucrat) is why elite is 0 here. Band 2 has no content yet, so its
 * 0.15 is where ancient starts; the steps above it are placeholders.
 */
export const TIERS: Record<string, TierDef> = {
  basic: { id: 'basic', name: 'Basic', multiplierRange: [0.8, 1.1], rewardMult: 1, penetration: 0 },
  veteran: { id: 'veteran', name: 'Veteran', multiplierRange: [1.0, 1.25], rewardMult: 1.3, penetration: 0 },
  elite: { id: 'elite', name: 'Elite', multiplierRange: [1.25, 1.5], rewardMult: 1.8, penetration: 0 },
  ancient: { id: 'ancient', name: 'Ancient', multiplierRange: [1.45, 1.7], rewardMult: 3, penetration: 0.15 },
  legendary: { id: 'legendary', name: 'Legendary', multiplierRange: [1.75, 2.5], rewardMult: 4, penetration: 0.25 },
  mythic: { id: 'mythic', name: 'Mythic', multiplierRange: [2.0, 3.0], rewardMult: 5, penetration: 0.35 },
  divine: { id: 'divine', name: 'Divine', multiplierRange: [4.0, 5.0], rewardMult: 8, penetration: 0.5 },
};

/** Rolled-at-spawn modifier classifications (second axis, like rarity). */
export const MODIFIER_TIERS: Record<string, ModifierTierDef> = {
  normal: { id: 'normal', name: '', multiplierRange: [1, 1], rewardMult: 1 },
  demiboss: { id: 'demiboss', name: 'Demiboss', multiplierRange: [1.2, 1.4], rewardMult: 2 },
  boss: { id: 'boss', name: 'Boss', multiplierRange: [1.5, 1.8], rewardMult: 3.5 },
  // The wildcard: could be a pushover, could be a monster's monster.
  aberrant: { id: 'aberrant', name: 'Aberrant', multiplierRange: [0.2, 2.0], rewardMult: 2 },
};

export const RARITIES: Record<string, RarityDef> = {
  common: { id: 'common', name: '', statMult: 1, lootMult: 1, color: '#9aa4ad' },
  uncommon: { id: 'uncommon', name: 'Uncommon', statMult: 1.15, lootMult: 1.5, color: '#4caf50' },
  rare: { id: 'rare', name: 'Rare', statMult: 1.35, lootMult: 2.5, color: '#42a5f5' },
  epic: { id: 'epic', name: 'Epic', statMult: 1.6, lootMult: 4, color: '#ab47bc' },
};

/** Default spawn weights. Spots can override via modifierWeights. */
export const MODIFIER_WEIGHTS: { id: string; weight: number }[] = [
  { id: 'normal', weight: 90 },
  { id: 'demiboss', weight: 7 },
  { id: 'boss', weight: 2 },
  { id: 'aberrant', weight: 1 },
];

export const RARITY_WEIGHTS: { id: string; weight: number }[] = [
  { id: 'common', weight: 77 },
  { id: 'uncommon', weight: 15 },
  { id: 'rare', weight: 6 },
  { id: 'epic', weight: 2 },
];

export const MONSTERS = prose<MonsterDef>('MONSTERS', MONSTERS_TEXT, {
  // ---- Floor 2, the Long Hall (plans/alpha-band-one-floors.md "One
  // building"). The office's own furniture, risen. Each answers one of the
  // tutorial's three spells: heat burns the ledgers, lightning shorts the
  // automatons, and the dolls (floor 3's puppets, small) have no answer but a
  // blade. Stats sit beside the old cistern's slimes at the same levels;
  // first guesses, tuned against John.
  ledger_tome: {
    id: 'ledger_tome', name: 'Bound Ledger', icon: '📕', art: 'Book Monster.png',
    tags: ['inorganic', 'construct', 'non_elemental', 'small'], tier: 'basic', damageType: 'slashing',
    resistances: { piercing: 0.25, heat: -0.5 },
    attrs: { str: 4, dex: 6, con: 5, int: 1, wis: 1, cha: 1 },
    growth: { str: 0.6, dex: 0.7, con: 0.8, int: 0.4, wis: 0.4, cha: 0.4 },
    xp: 8, gold: [1, 3],
    loot: { rolls: 1, entries: [{ kind: 'material', id: 'leather', weight: 25 }, { kind: 'nothing', weight: 75 }] },
  },
  filing_automaton: {
    id: 'filing_automaton', name: 'Filing Automaton', icon: '🤖', art: 'Assembling Automatons Automaton A.png',
    tags: ['inorganic', 'construct', 'non_elemental', 'medium'], tier: 'basic', damageType: 'bludgeoning',
    armor: 2,
    resistances: { slashing: 0.2, piercing: 0.2, bludgeoning: -0.2, lightning: -0.5 },
    attrs: { str: 5, dex: 3, con: 7, int: 1, wis: 1, cha: 1 },
    growth: { str: 0.7, dex: 0.4, con: 0.9, int: 0.4, wis: 0.4, cha: 0.4 },
    xp: 9, gold: [1, 3],
    loot: { rolls: 1, entries: [{ kind: 'material', id: 'iron_scrap', weight: 30 }, { kind: 'nothing', weight: 70 }] },
  },
  sorting_automaton: {
    id: 'sorting_automaton', name: 'Sorting Automaton', icon: '⚙️', art: 'Assembling Automatons Automaton B.png',
    tags: ['inorganic', 'construct', 'non_elemental', 'medium'], tier: 'basic', damageType: 'slashing',
    resistances: { slashing: 0.2, piercing: 0.2, bludgeoning: -0.2, lightning: -0.5 },
    attrs: { str: 4, dex: 7, con: 5, int: 1, wis: 1, cha: 1 },
    growth: { str: 0.6, dex: 0.8, con: 0.7, int: 0.4, wis: 0.4, cha: 0.4 },
    xp: 9, gold: [1, 3],
    loot: { rolls: 1, entries: [{ kind: 'material', id: 'iron_scrap', weight: 30 }, { kind: 'nothing', weight: 70 }] },
  },
  living_doll: {
    id: 'living_doll', name: 'Living Doll', icon: '🪆', art: 'Demon Living Doll.png',
    tags: ['inorganic', 'construct', 'dark', 'small'], tier: 'basic', damageType: 'piercing',
    resistances: { dark: 0.3 },
    attrs: { str: 5, dex: 7, con: 5, int: 1, wis: 1, cha: 1 },
    growth: { str: 0.7, dex: 0.8, con: 0.8, int: 0.4, wis: 0.4, cha: 0.4 },
    xp: 10, gold: [1, 3],
    loot: { rolls: 1, entries: [{ kind: 'nothing', weight: 1 }] },
  },
  // ---- Floor 3, the Descent: band 1's last boss (the queen's successor as
  // PRESTIGE_UNLOCK). A construct on strings at the bottom of the stairwell;
  // each string anchor cut in the side rooms above is a level off (12 → 9,
  // f3_hearing_room's table). Solitary and slow like the queen it replaced,
  // but a construct: blunt blows are the answer (the Archive's oak club), and
  // edges and points do less. First guesses, tuned against John.
  puppet_bureaucrat: {
    id: 'puppet_bureaucrat', name: 'The Puppet Bureaucrat', icon: '🎭', art: 'Boss Puppet Master.png',
    tags: ['inorganic', 'construct', 'dark', 'large'], tier: 'elite', damageType: 'bludgeoning',
    group: { max: 1 },
    resistances: { slashing: 0.3, piercing: 0.3, bludgeoning: -0.35, heat: -0.2, dark: 0.3 },
    // Tuned 2026-10-21 against John (a sweep of four stat sets): uncut, a
    // plain John goes down about 3 times before he wins; with all three
    // strings cut and the Archive’s club, under once. Preparation is the
    // difference, which is the floor’s point.
    attrs: { str: 8, dex: 4, con: 15, int: 3, wis: 3, cha: 3 },
    growth: { str: 0.8, dex: 0.35, con: 2.4, int: 0.3, wis: 0.3, cha: 0.25 },
    // Kill gold scales by level × tier: [20, 40] paid ~750 at level 12.
    xp: 200, gold: [3, 6],
    loot: {
      rolls: 1,
      entries: [
        { kind: 'item', id: 'lucky_charm', weight: 3 },
        { kind: 'nothing', weight: 97 },
      ],
    },
  },
  toll_collector_golem: {
    id: 'toll_collector_golem', name: 'The Toll Collector', icon: '🗿',
    tags: ['inorganic', 'construct', 'earth', 'large'], tier: 'basic', damageType: 'bludgeoning',
    // Tuned 2026-10-10 against a band-1 climb (`npm run pacing`): at 4/10 and
    // armour 4 it died in ten seconds having landed one blow, so none of the
    // three spell reactions ever mattered. Now a 20–35 s fight that wins
    // about one first attempt in four, and the tutorial's spell moves those
    // odds (docs/FLOODED_FLOOR.md has the per-spell numbers).
    group: { max: 1 }, armor: 8,
    resistances: { slashing: 0, piercing: 0, bludgeoning: 0, heat: 0, cold: 0, lightning: 0 },
    attrs: { str: 6, dex: 4, con: 16, int: 1, wis: 1 },
    growth: { str: 0.35, dex: 0.15, con: 0.7 },
    xp: 30, gold: [35, 50],
    loot: { rolls: 1, entries: [{ kind: 'material', id: 'iron_scrap', weight: 1, qty: [2, 4] }] },
  },
  // ---------- Verdant Frontier natives ----------
  forest_rat: {
    id: 'forest_rat',
    name: 'Forest Rat',
    icon: '🐀',
    tags: ['living', 'beast', 'small'],
    tier: 'basic',
    damageType: 'piercing',
    attrs: { str: 2, dex: 4, con: 2, int: 1, wis: 1, cha: 0 },
    growth: { str: 0.6, dex: 0.8, con: 0.5, int: 0.4, wis: 0.4, cha: 0.4 },
    xp: 4,
    gold: [1, 3],
    loot: {
      rolls: 1,
      entries: [
        { kind: 'item', id: 'cloth_tunic', weight: 4 },
        { kind: 'nothing', weight: 96 },
      ],
    },
  },
  young_wolf: {
    id: 'young_wolf',
    name: 'Young Wolf',
    icon: '🐕',
    tags: ['living', 'beast'],
    tier: 'basic',
    damageType: 'piercing',
    inflicts: [{ id: 'punctured', intensity: 0.5, chance: 0.2 }],
    attrs: { str: 4, dex: 5, con: 4, int: 1, wis: 2, cha: 0 },
    growth: { str: 1, dex: 1, con: 0.8, int: 0.4, wis: 0.4, cha: 0.4 },
    xp: 7,
    gold: [2, 5],
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'ruined_fur', weight: 20 },
        { kind: 'material', id: 'raw_meat', weight: 10 },
        { kind: 'item', id: 'leather_vest', weight: 3 },
        { kind: 'nothing', weight: 67 },
      ],
    },
  },
  wolf: {
    id: 'wolf',
    name: 'Wolf',
    icon: '🐺',
    tags: ['living', 'beast'],
    tier: 'veteran',
    damageType: 'piercing',
    inflicts: [{ id: 'bleeding', intensity: 1, chance: 0.2 }],
    attrs: { str: 7, dex: 7, con: 6, int: 2, wis: 3, cha: 0 },
    growth: { str: 1.3, dex: 1.2, con: 1, int: 0.75, wis: 0.75, cha: 0.75 },
    xp: 12,
    gold: [3, 8],
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'torn_fur', weight: 18 },
        { kind: 'material', id: 'raw_meat', weight: 12 },
        { kind: 'material', id: 'pristine_fur', weight: 3 },
        { kind: 'item', id: 'leather_vest', weight: 4 },
        { kind: 'item', id: 'wolf_fang_blade', weight: 1 },
        { kind: 'rune', id: 'rune_swiftness', weight: 1 },
        { kind: 'nothing', weight: 61 },
      ],
    },
  },
  boar: {
    id: 'boar',
    name: 'Bristleback Boar',
    icon: '🐗',
    tags: ['living', 'beast', 'large'],
    tier: 'veteran',
    damageType: 'bludgeoning',
    inflicts: [{ id: 'concussed', intensity: 1, chance: 0.15 }],
    attrs: { str: 9, dex: 4, con: 9, int: 1, wis: 3, cha: 0 },
    growth: { str: 1.5, dex: 0.6, con: 1.4, int: 0.75, wis: 0.75, cha: 0.75 },
    xp: 14,
    gold: [4, 9],
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'raw_meat', weight: 20, qty: [1, 2] },
        { kind: 'item', id: 'oak_club', weight: 5 },
        { kind: 'item', id: 'iron_sword', weight: 2 },
        { kind: 'nothing', weight: 73 },
      ],
    },
  },
  cliff_hawk: {
    id: 'cliff_hawk',
    name: 'Cliff Hawk',
    icon: '🦅',
    tags: ['living', 'beast', 'flying', 'wind'],
    tier: 'veteran',
    damageType: 'slashing',
    inflicts: [{ id: 'bleeding', intensity: 1, chance: 0.25 }],
    range: 'ranged', // strafes from above
    attrs: { str: 6, dex: 12, con: 5, int: 2, wis: 4, cha: 0 },
    growth: { str: 1, dex: 1.8, con: 0.8, int: 0.75, wis: 0.75, cha: 0.75 },
    xp: 16,
    gold: [5, 11],
    loot: {
      rolls: 1,
      entries: [
        { kind: 'item', id: 'hawk_feather_band', weight: 3 },
        { kind: 'material', id: 'raw_meat', weight: 12 },
        { kind: 'rune', id: 'minor_rune_thunder', weight: 2 },
        { kind: 'nothing', weight: 83 },
      ],
    },
  },
  cave_spider: {
    id: 'cave_spider',
    name: 'Cave Spider',
    icon: '🕷️',
    tags: ['living', 'vermin', 'toxic'],
    tier: 'veteran',
    damageType: 'poison',
    inflicts: [{ id: 'poison', intensity: 1, chance: 0.35 }],
    resistances: { poison: 0.5 },
    // STR 8 → 6 (2026-10-17): a won fight cost about half a band-1
    // climber's health. Fast and evasive is the identity; DEX stays.
    attrs: { str: 6, dex: 11, con: 7, int: 3, wis: 4, cha: 0 },
    growth: { str: 1.3, dex: 1.5, con: 1.1, int: 0.75, wis: 0.75, cha: 0.75 },
    xp: 20,
    // Kill gold scales with level × tier, so 6–14 paid ~170 a spider on the
    // third floor and a band-1 climb ended holding 8k–90k gold.
    gold: [1, 3],
    loot: {
      rolls: 1,
      entries: [
        { kind: 'item', id: 'spider_silk_garb', weight: 3 },
        { kind: 'item', id: 'lucky_charm', weight: 2 },
        { kind: 'nothing', weight: 95 },
      ],
    },
  },
  stone_golem: {
    id: 'stone_golem',
    name: 'Stone Golem',
    icon: '🗿',
    tags: ['inorganic', 'construct', 'earth', 'large'],
    tier: 'elite',
    damageType: 'bludgeoning',
    inflicts: [{ id: 'concussed', intensity: 1, chance: 0.25 }],
    group: { max: 1 }, // golems wake alone
    resistances: { slashing: 0.6, piercing: 0.6, bludgeoning: -0.5, arcane: -0.5 },
    attrs: { str: 14, dex: 3, con: 16, int: 1, wis: 8, cha: 0 },
    growth: { str: 2, dex: 0.4, con: 2.2, int: 1.1, wis: 1.1, cha: 1.1 },
    xp: 35,
    gold: [12, 25],
    loot: {
      rolls: 2,
      entries: [
        { kind: 'item', id: 'iron_sword', weight: 5 },
        { kind: 'item', id: 'lucky_charm', weight: 3 },
        { kind: 'material', id: 'iron_scrap', weight: 18, qty: [2, 4] },
        { kind: 'gold', weight: 20, qty: [10, 30] },
        { kind: 'rune', id: 'minor_rune_vitality', weight: 3 },
        { kind: 'nothing', weight: 51 },
      ],
    },
  },

  // ---------- Floor 0: the tutorial's training slime ----------
  //
  // Training equipment shaped like a slime. `fixedDamage: 1` is the whole
  // identity: every landed blow is exactly 1, before crit, jitter or armour,
  // so the fight can be read while it happens. Enough HP (12 + 7 × CON,
  // jittered) to take three to five hits from a starting sword; `armor: 0`
  // overrides what `inorganic` would otherwise imply, and the explicit zero
  // resistances override what `slime` would, so every starter weapon lands
  // for its listed number. Only spawns on floor 0.
  slime_cell: {
    id: 'slime_cell',
    name: 'Cell Slime',
    icon: '🟢',
    tags: ['inorganic', 'slime', 'small'],
    art: 'slime_base_basic.png',
    tier: 'basic',
    damageType: 'bludgeoning',
    fixedDamage: 1,
    armor: 0,
    resistances: { slashing: 0, piercing: 0, bludgeoning: 0 },
    attrs: { str: 0, dex: 2, con: 1.5, int: 1, wis: 1, cha: 1 },
    growth: { str: 0, dex: 0.2, con: 0.3, int: 0.2, wis: 0.2, cha: 0.2 },
    xp: 4,
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'slime_gel', weight: 50 },
        { kind: 'gold', weight: 30, qty: [1, 3] },
        { kind: 'nothing', weight: 20 },
      ],
    },
  },

  // ---------- Westlands (ported from proto26) ----------
  slime_base_basic: {
    id: 'slime_base_basic',
    name: 'Slime',
    icon: '🟢',
    tags: ['inorganic', 'slime', 'small'],
    art: 'slime_base_basic.png',
    tier: 'basic',
    damageType: 'bludgeoning',
    resistances: { slashing: 0.5, piercing: 0.5, bludgeoning: -0.25, cold: 0.15, poison: 0.25 },
    attrs: { str: 4, dex: 4, con: 6, int: 1, wis: 1, cha: 1 },
    growth: { str: 0.6, dex: 0.5, con: 0.8, int: 0.4, wis: 0.4, cha: 0.4 },
    xp: 6,
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'slime_gel', weight: 35 },
        { kind: 'gold', weight: 20, qty: [1, 5] },
        { kind: 'nothing', weight: 45 },
      ],
    },
  },
  // The Cages' stock (user, 2026-10-17): slimes BRED to take the same damage
  // from everything. Explicit zeros and no armour override what `slime` and
  // `inorganic` imply (monsterStats.ts), so no tutorial weapon pick is a
  // hidden coin flip here. The wild slime keeps its resistances.
  cage_slime: {
    id: 'cage_slime',
    name: 'Cage-Bred Slime',
    icon: '🟢',
    tags: ['inorganic', 'slime', 'small'],
    art: 'slime_base_basic.png',
    tier: 'basic',
    damageType: 'bludgeoning',
    armor: 0,
    resistances: { slashing: 0, piercing: 0, bludgeoning: 0 },
    attrs: { str: 4, dex: 4, con: 6, int: 1, wis: 1, cha: 1 },
    growth: { str: 0.6, dex: 0.5, con: 0.8, int: 0.4, wis: 0.4, cha: 0.4 },
    xp: 6,
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'slime_gel', weight: 35 },
        { kind: 'gold', weight: 20, qty: [1, 5] },
        { kind: 'nothing', weight: 45 },
      ],
    },
  },
  // The cage keeper's dare (SpotDef.dare on the_cages): a cage slime grown one
  // size past the player, bred like the rest — no armour, no resistances.
  // Spawns nowhere on its own.
  suspiciously_large_slime: {
    id: 'suspiciously_large_slime',
    name: 'Suspiciously Large Slime',
    icon: '🟢',
    tags: ['inorganic', 'slime', 'large'],
    art: 'slime_base_basic.png',
    tier: 'basic',
    damageType: 'bludgeoning',
    armor: 0,
    resistances: { slashing: 0, piercing: 0, bludgeoning: 0 },
    attrs: { str: 5, dex: 3, con: 8, int: 1, wis: 1, cha: 1 },
    growth: { str: 0.6, dex: 0.4, con: 1.0, int: 0.4, wis: 0.4, cha: 0.4 },
    group: { max: 1 },
    xp: 40,
    gold: [2, 4],
    loot: {
      rolls: 1,
      entries: [{ kind: 'material', id: 'slime_gel', weight: 100, qty: [2, 4] }],
    },
  },
  slime_base_advanced: {
    id: 'slime_base_advanced',
    name: 'Slimer',
    icon: '🟩',
    tags: ['inorganic', 'slime'],
    art: 'slime_base_advanced.png',
    tier: 'veteran',
    damageType: 'bludgeoning',
    resistances: { slashing: 0.5, piercing: 0.5, bludgeoning: -0.25, cold: 0.15, poison: 0.25 },
    attrs: { str: 6, dex: 5, con: 8, int: 1, wis: 1, cha: 1 },
    growth: { str: 0.7, dex: 0.6, con: 1.0, int: 0.75, wis: 0.75, cha: 0.75 },
    xp: 10,
    // A little coin, so the second floor pays toward the third floor's gate.
    gold: [1, 2],
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'slime_gel', weight: 40, qty: [1, 2] },
        { kind: 'nothing', weight: 60 },
      ],
    },
  },
  slime_base_elite: {
    id: 'slime_base_elite',
    name: 'Slimest',
    icon: '💚',
    tags: ['inorganic', 'slime', 'large'],
    art: 'slime_base_elite.png',
    tier: 'elite',
    damageType: 'bludgeoning',
    resistances: { slashing: 0.5, piercing: 0.5, bludgeoning: -0.25, cold: 0.2, poison: 0.3 },
    attrs: { str: 8, dex: 6, con: 12, int: 1, wis: 1, cha: 1 },
    growth: { str: 1.0, dex: 0.7, con: 1.4, int: 1.1, wis: 1.1, cha: 1.1 },
    xp: 20,
    loot: {
      rolls: 2,
      entries: [
        { kind: 'material', id: 'slime_gel', weight: 60, qty: [1, 2] },
        { kind: 'nothing', weight: 40 },
      ],
    },
  },
  slime_ice_basic: {
    id: 'slime_ice_basic',
    name: 'Ice Slime',
    icon: '🧊',
    tags: ['inorganic', 'slime', 'ice'],
    art: 'slime_ice_basic.png',
    tier: 'basic',
    damageType: 'cold',
    inflicts: [{ id: 'chilled', intensity: 0.2, chance: 0.4 }],
    resistances: { slashing: 0.5, piercing: 0.5, bludgeoning: -0.25, cold: 0.5, heat: -0.25 },
    attrs: { str: 4, dex: 4, con: 6, int: 1, wis: 1, cha: 1 },
    growth: { str: 0.6, dex: 0.5, con: 0.8, int: 0.4, wis: 0.4, cha: 0.4 },
    xp: 8,
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'slime_gel', weight: 35 },
        { kind: 'nothing', weight: 65 },
      ],
    },
  },
  slime_fire: {
    id: 'slime_fire',
    name: 'Fire Slime',
    icon: '🔴',
    tags: ['inorganic', 'slime', 'fire'],
    art: 'slime_fire.png',
    tier: 'basic',
    damageType: 'heat',
    inflicts: [{ id: 'on_fire', intensity: 1, chance: 0.3 }],
    range: 'ranged', // lobs fire from a distance
    resistances: { slashing: 0.5, piercing: 0.5, bludgeoning: -0.25, heat: 0.5, cold: -0.5 },
    attrs: { str: 5, dex: 5, con: 7, int: 2, wis: 1, cha: 1 },
    growth: { str: 0.8, dex: 0.6, con: 1.0, int: 0.2, wis: 0.4, cha: 0.4 },
    xp: 12,
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'warm_slime_gel', weight: 35 },
        { kind: 'nothing', weight: 65 },
      ],
    },
  },
  slime_fire_advanced: {
    id: 'slime_fire_advanced',
    name: 'Flame Slime',
    icon: '🟥',
    tags: ['inorganic', 'slime', 'fire'],
    art: 'slime_fire_advanced.png',
    tier: 'veteran',
    damageType: 'heat',
    inflicts: [{ id: 'on_fire', intensity: 1.5, chance: 0.35 }],
    range: 'ranged', // lobs fire from a distance
    resistances: { slashing: 0.5, piercing: 0.5, bludgeoning: -0.25, heat: 0.6, cold: -0.6 },
    attrs: { str: 7, dex: 6, con: 9, int: 2, wis: 1, cha: 1 },
    growth: { str: 1.0, dex: 0.7, con: 1.2, int: 0.2, wis: 0.75, cha: 0.75 },
    xp: 16,
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'warm_slime_gel', weight: 40, qty: [1, 2] },
        { kind: 'nothing', weight: 60 },
      ],
    },
  },
  slime_fire_elite: {
    id: 'slime_fire_elite',
    name: 'Pyre Slime',
    icon: '❤️‍🔥',
    tags: ['inorganic', 'slime', 'fire', 'large'],
    art: 'slime_fire_elite.png',
    tier: 'elite',
    damageType: 'heat',
    inflicts: [{ id: 'on_fire', intensity: 2, chance: 0.4 }],
    range: 'ranged', // lobs fire from a distance
    resistances: { slashing: 0.5, piercing: 0.5, bludgeoning: -0.25, heat: 0.7, cold: -0.7 },
    attrs: { str: 10, dex: 7, con: 13, int: 3, wis: 1, cha: 1 },
    growth: { str: 1.2, dex: 0.8, con: 1.4, int: 0.3, wis: 1.1, cha: 1.1 },
    xp: 28,
    loot: {
      rolls: 2,
      entries: [
        { kind: 'material', id: 'warm_slime_gel', weight: 60, qty: [1, 2] },
        { kind: 'gold', weight: 10, qty: [8, 20] },
        { kind: 'nothing', weight: 30 },
      ],
    },
  },
  goblin: {
    id: 'goblin',
    name: 'Goblin',
    icon: '👺',
    tags: ['living', 'goblin', 'humanoid', 'small'],
    tier: 'basic',
    damageType: 'piercing',
    inflicts: [{ id: 'bleeding', intensity: 1, chance: 0.15 }],
    resistances: { poison: 0.1 },
    attrs: { str: 6, dex: 8, con: 5, int: 4, wis: 3, cha: 3 },
    growth: { str: 0.9, dex: 1.1, con: 0.7, int: 0.5, wis: 0.4, cha: 0.4 },
    xp: 10,
    gold: [2, 6],
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'ruined_fur', weight: 25 },
        { kind: 'material', id: 'torn_fur', weight: 15 },
        { kind: 'material', id: 'pristine_fur', weight: 5 },
        { kind: 'material', id: 'iron_scrap', weight: 12 },
        { kind: 'rune', id: 'minor_rune_might', weight: 2 },
        { kind: 'nothing', weight: 41 },
      ],
    },
  },
  goblin_boss: {
    id: 'goblin_boss',
    name: 'Boss Goblin',
    icon: '👹',
    tags: ['living', 'goblin', 'humanoid'],
    tier: 'legendary',
    damageType: 'slashing',
    group: { min: 5, max: 5 }, // never travels without the whole squad
    escorts: ['goblin'],
    resistances: { poison: 0.25 },
    attrs: { str: 12, dex: 9, con: 12, int: 5, wis: 4, cha: 5 },
    growth: { str: 1.5, dex: 1.0, con: 1.4, int: 0.6, wis: 1.8, cha: 1.8 },
    xp: 60,
    gold: [10, 25],
    loot: {
      rolls: 2,
      entries: [
        { kind: 'material', id: 'torn_fur', weight: 30, qty: [1, 3] },
        { kind: 'material', id: 'pristine_fur', weight: 10 },
        { kind: 'material', id: 'iron_scrap', weight: 15, qty: [1, 3] },
        { kind: 'material', id: 'boss_token', weight: 5 },
        { kind: 'item', id: 'iron_gauntlets', weight: 4 },
        { kind: 'item', id: 'moonlit_katana', weight: 2 },
        { kind: 'rune', id: 'greater_rune_might', weight: 3 },
        { kind: 'rune', id: 'greater_rune_thunder', weight: 2 },
        { kind: 'nothing', weight: 29 },
      ],
    },
  },
  // The toll level's daylight keeper (quest 3). Names/levels are first
  // guesses for review, like everything else on band 1.
  hobgoblin: {
    id: 'hobgoblin',
    name: 'Hobgoblin',
    icon: '👺',
    tags: ['living', 'goblin', 'humanoid'],
    tier: 'veteran',
    damageType: 'slashing',
    inflicts: [{ id: 'bleeding', intensity: 1, chance: 0.2 }],
    resistances: { poison: 0.15 },
    attrs: { str: 10, dex: 8, con: 9, int: 4, wis: 4, cha: 4 },
    growth: { str: 1.1, dex: 1.0, con: 1.0, int: 0.5, wis: 0.5, cha: 0.5 },
    xp: 24,
    gold: [6, 14],
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'torn_fur', weight: 25 },
        { kind: 'material', id: 'iron_scrap', weight: 20, qty: [1, 2] },
        { kind: 'material', id: 'pristine_fur', weight: 6 },
        { kind: 'rune', id: 'minor_rune_might', weight: 3 },
        { kind: 'nothing', weight: 46 },
      ],
    },
  },
  /**
   * The ambush (quest 3): spawns only inside the power window (see
   * SpotEncounter.window), so meeting one is something a player PLANNED. The
   * loot answers the planning — this table is deliberately rich for its
   * floor, because the window cannot be farmed from above.
   */
  hobgoblin_champion: {
    id: 'hobgoblin_champion',
    name: 'Hobgoblin Champion',
    icon: '👹',
    tags: ['living', 'goblin', 'humanoid', 'large'],
    tier: 'legendary',
    damageType: 'slashing',
    group: { min: 3, max: 3 },
    escorts: ['hobgoblin'],
    inflicts: [{ id: 'bleeding', intensity: 2, chance: 0.25 }],
    resistances: { poison: 0.3, slashing: 0.2 },
    attrs: { str: 16, dex: 11, con: 15, int: 6, wis: 6, cha: 7 },
    growth: { str: 1.5, dex: 1.1, con: 1.5, int: 0.6, wis: 1.6, cha: 1.6 },
    xp: 120,
    gold: [35, 80],
    loot: {
      rolls: 3,
      entries: [
        { kind: 'material', id: 'boss_token', weight: 15 },
        { kind: 'material', id: 'pristine_fur', weight: 15, qty: [1, 2] },
        { kind: 'material', id: 'iron_scrap', weight: 15, qty: [2, 4] },
        { kind: 'item', id: 'iron_gauntlets', weight: 8 },
        { kind: 'item', id: 'moonlit_katana', weight: 4 },
        { kind: 'gold', weight: 18, qty: [40, 90] },
        { kind: 'rune', id: 'greater_rune_might', weight: 6 },
        { kind: 'nothing', weight: 19 },
      ],
    },
  },
  slime_golem: {
    id: 'slime_golem',
    name: 'Slime Golem',
    icon: '🗿',
    tags: ['inorganic', 'slime', 'construct', 'earth', 'gargantuan'],
    art: 'slime_golem.png',
    tier: 'ancient',
    damageType: 'bludgeoning',
    resistances: { slashing: 0.75, piercing: 0.75, bludgeoning: -0.75, heat: 0.7, cold: 0.7, arcane: -1 },
    attrs: { str: 18, dex: 6, con: 22, int: 4, wis: 4, cha: 1 },
    growth: { str: 1.7, dex: 0.8, con: 1.65, int: 1.45, wis: 1.45, cha: 1.45 },
    xp: 90,
    gold: [20, 50],
    loot: {
      rolls: 3,
      entries: [
        { kind: 'material', id: 'warm_slime_gel', weight: 40, qty: [2, 4] },
        { kind: 'material', id: 'boss_token', weight: 10 },
        { kind: 'item', id: 'steel_greatsword', weight: 5 },
        { kind: 'item', id: 'moonlit_katana', weight: 3 },
        { kind: 'gold', weight: 20, qty: [20, 60] },
        { kind: 'rune', id: 'greater_rune_vitality', weight: 3 },
        { kind: 'rune', id: 'minor_rune_frost', weight: 3 },
        { kind: 'nothing', weight: 16 },
      ],
    },
  },

  // ==================== The slime bestiary ====================
  // Every slime shares the family profile: cuts and stabs pass through it,
  // blunt force does not. What differs is the element it has soaked up and
  // what that costs it.

  slime_water: {
    id: 'slime_water',
    name: 'Water Slime',
    icon: '💧',
    tags: ['inorganic', 'slime', 'water'],
    art: 'slime_water.png',
    tier: 'basic',
    damageType: 'bludgeoning',
    inflicts: [{ id: 'wet', intensity: 1, chance: 0.4 }],
    resistances: { slashing: 0.6, piercing: 0.6, bludgeoning: -0.25, heat: 0.4, lightning: -0.6 },
    attrs: { str: 4, dex: 5, con: 6, int: 1, wis: 1, cha: 1 },
    growth: { str: 0.6, dex: 0.6, con: 0.85, int: 0.4, wis: 0.4, cha: 0.4 },
    xp: 8,
    // A little coin, so the second floor pays toward the third floor's gate.
    gold: [1, 3],
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'slime_gel', weight: 35 },
        { kind: 'material', id: 'chilled_slime_gel', weight: 8 },
        { kind: 'nothing', weight: 57 },
      ],
    },
  },
  slime_nature: {
    id: 'slime_nature',
    name: 'Algae Slime',
    icon: '🫧',
    tags: ['inorganic', 'slime', 'nature'],
    art: 'slime_algae_slime.png',
    tier: 'basic',
    damageType: 'poison',
    inflicts: [{ id: 'poison', intensity: 1.2, chance: 0.3 }],
    resistances: { slashing: 0.5, piercing: 0.5, bludgeoning: -0.25, poison: 0.6, heat: -0.4 },
    attrs: { str: 4, dex: 3, con: 7, int: 1, wis: 2, cha: 1 },
    growth: { str: 0.6, dex: 0.4, con: 0.9, int: 0.4, wis: 0.4, cha: 0.4 },
    xp: 7,
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'slime_gel', weight: 30 },
        { kind: 'material', id: 'common_herb', weight: 25, qty: [1, 2] },
        { kind: 'nothing', weight: 45 },
      ],
    },
  },
  slime_honey: {
    id: 'slime_honey',
    name: 'Honey Slime',
    icon: '🍯',
    tags: ['inorganic', 'slime', 'nature', 'small'],
    art: 'slime_honey_slime.png',
    tier: 'basic',
    damageType: 'bludgeoning',
    resistances: { slashing: 0.5, piercing: 0.5, bludgeoning: 0.35, cold: -0.5 },
    attrs: { str: 5, dex: 2, con: 6, int: 1, wis: 1, cha: 2 },
    growth: { str: 0.7, dex: 0.3, con: 0.8, int: 0.4, wis: 0.4, cha: 0.4 },
    xp: 9,
    gold: [1, 4],
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'slime_gel', weight: 30 },
        { kind: 'material', id: 'common_herb', weight: 15 },
        { kind: 'item', id: 'herbal_charm', weight: 2 },
        { kind: 'nothing', weight: 53 },
      ],
    },
  },
  slime_earth: {
    id: 'slime_earth',
    name: 'Earth Slime',
    icon: '🪨',
    tags: ['inorganic', 'slime', 'earth'],
    art: 'slime_earth.png',
    tier: 'basic',
    damageType: 'bludgeoning',
    inflicts: [{ id: 'shardbound', intensity: 1, chance: 0.3 }],
    resistances: { slashing: 0.6, piercing: 0.6, bludgeoning: -0.3, lightning: 0.5, cold: 0.2 },
    attrs: { str: 6, dex: 2, con: 8, int: 1, wis: 1, cha: 1 },
    growth: { str: 0.9, dex: 0.3, con: 1.0, int: 0.4, wis: 0.4, cha: 0.4 },
    xp: 10,
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'slime_gel', weight: 30 },
        { kind: 'material', id: 'iron_scrap', weight: 18 },
        { kind: 'nothing', weight: 52 },
      ],
    },
  },
  slime_wind: {
    id: 'slime_wind',
    name: 'Wind Slime',
    icon: '🌬️',
    tags: ['inorganic', 'slime', 'wind', 'small'],
    art: 'slime_wind.png',
    tier: 'basic',
    damageType: 'wind',
    inflicts: [{ id: 'dazzled', intensity: 1, chance: 0.25 }],
    range: 'ranged',
    resistances: { slashing: 0.3, piercing: 0.7, bludgeoning: 0.2, lightning: -0.4 },
    attrs: { str: 3, dex: 9, con: 4, int: 2, wis: 2, cha: 1 },
    growth: { str: 0.4, dex: 1.3, con: 0.5, int: 0.4, wis: 0.4, cha: 0.4 },
    xp: 10,
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'slime_gel', weight: 30 },
        { kind: 'rune', id: 'rune_swiftness', weight: 1 },
        { kind: 'nothing', weight: 69 },
      ],
    },
  },
  slime_thunder: {
    id: 'slime_thunder',
    name: 'Spark Slime',
    icon: '⚡',
    tags: ['inorganic', 'slime', 'lightning', 'small'],
    art: 'slime_thunder.png',
    tier: 'basic',
    damageType: 'lightning',
    inflicts: [{ id: 'jolted', intensity: 1, chance: 0.35 }],
    range: 'ranged',
    resistances: { slashing: 0.5, piercing: 0.5, bludgeoning: -0.25, lightning: 0.7 },
    attrs: { str: 4, dex: 7, con: 5, int: 3, wis: 1, cha: 1 },
    growth: { str: 0.5, dex: 1.0, con: 0.7, int: 0.3, wis: 0.4, cha: 0.4 },
    xp: 12,
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'charged_slime_gel', weight: 25 },
        { kind: 'material', id: 'slime_gel', weight: 20 },
        { kind: 'nothing', weight: 55 },
      ],
    },
  },

  slime_water_advanced: {
    id: 'slime_water_advanced',
    name: 'Tide Slime',
    icon: '🌊',
    tags: ['inorganic', 'slime', 'water'],
    art: 'slime_water_advanced.png',
    tier: 'veteran',
    damageType: 'bludgeoning',
    resistances: { slashing: 0.6, piercing: 0.6, bludgeoning: -0.25, heat: 0.5, lightning: -0.7 },
    attrs: { str: 7, dex: 6, con: 9, int: 1, wis: 2, cha: 1 },
    growth: { str: 0.9, dex: 0.7, con: 1.1, int: 0.75, wis: 0.75, cha: 0.75 },
    xp: 15,
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'chilled_slime_gel', weight: 30 },
        { kind: 'material', id: 'slime_gel', weight: 25, qty: [1, 2] },
        { kind: 'nothing', weight: 45 },
      ],
    },
  },
  slime_ice_advanced: {
    id: 'slime_ice_advanced',
    name: 'Frost Slime',
    icon: '❄️',
    tags: ['inorganic', 'slime', 'ice'],
    art: 'slime_ice_advanced.png',
    tier: 'veteran',
    damageType: 'cold',
    inflicts: [{ id: 'chilled', intensity: 0.3, chance: 0.45 }],
    resistances: { slashing: 0.5, piercing: 0.5, bludgeoning: -0.25, cold: 0.6, heat: -0.4 },
    attrs: { str: 6, dex: 6, con: 9, int: 1, wis: 1, cha: 1 },
    growth: { str: 0.8, dex: 0.7, con: 1.1, int: 0.75, wis: 0.75, cha: 0.75 },
    xp: 16,
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'chilled_slime_gel', weight: 35, qty: [1, 2] },
        { kind: 'rune', id: 'minor_rune_frost', weight: 2 },
        { kind: 'nothing', weight: 63 },
      ],
    },
  },
  slime_earth_advanced: {
    id: 'slime_earth_advanced',
    name: 'Boulder Slime',
    icon: '⛰️',
    tags: ['inorganic', 'slime', 'earth', 'large'],
    art: 'slime_earth_advanced.png',
    tier: 'veteran',
    damageType: 'bludgeoning',
    resistances: { slashing: 0.7, piercing: 0.7, bludgeoning: -0.4, lightning: 0.6, cold: 0.25 },
    attrs: { str: 10, dex: 3, con: 12, int: 1, wis: 1, cha: 1 },
    growth: { str: 1.3, dex: 0.35, con: 1.4, int: 0.75, wis: 0.75, cha: 0.75 },
    xp: 18,
    gold: [3, 8],
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'iron_scrap', weight: 30, qty: [1, 3] },
        { kind: 'material', id: 'slime_gel', weight: 20 },
        { kind: 'rune', id: 'minor_rune_vitality', weight: 2 },
        { kind: 'nothing', weight: 48 },
      ],
    },
  },
  slime_wind_advanced: {
    id: 'slime_wind_advanced',
    name: 'Gale Slime',
    icon: '🌪️',
    tags: ['inorganic', 'slime', 'wind'],
    art: 'slime_wind_advanced.png',
    tier: 'veteran',
    damageType: 'wind',
    range: 'ranged',
    resistances: { slashing: 0.3, piercing: 0.75, bludgeoning: 0.3, lightning: -0.5 },
    attrs: { str: 5, dex: 13, con: 6, int: 2, wis: 2, cha: 1 },
    growth: { str: 0.6, dex: 1.7, con: 0.7, int: 0.75, wis: 0.75, cha: 0.75 },
    xp: 17,
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'slime_gel', weight: 30, qty: [1, 2] },
        { kind: 'item', id: 'hawk_feather_band', weight: 2 },
        { kind: 'rune', id: 'rune_swiftness', weight: 2 },
        { kind: 'nothing', weight: 66 },
      ],
    },
  },
  slime_thunder_advanced: {
    id: 'slime_thunder_advanced',
    name: 'Storm Slime',
    icon: '🌩️',
    tags: ['inorganic', 'slime', 'lightning'],
    art: 'slime_thunder_advanced.png',
    tier: 'veteran',
    damageType: 'lightning',
    range: 'ranged',
    resistances: { slashing: 0.5, piercing: 0.5, bludgeoning: -0.25, lightning: 0.8 },
    attrs: { str: 6, dex: 9, con: 7, int: 4, wis: 2, cha: 1 },
    growth: { str: 0.7, dex: 1.2, con: 0.9, int: 0.4, wis: 0.75, cha: 0.75 },
    xp: 19,
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'charged_slime_gel', weight: 35, qty: [1, 2] },
        { kind: 'rune', id: 'minor_rune_thunder', weight: 3 },
        { kind: 'nothing', weight: 62 },
      ],
    },
  },
  slime_zombie: {
    id: 'slime_zombie',
    name: 'Zombie Slime',
    icon: '🧟',
    tags: ['inorganic', 'slime', 'undead', 'toxic'],
    art: 'slime_zombie_slime.png',
    tier: 'veteran',
    damageType: 'poison',
    resistances: { slashing: 0.5, piercing: 0.6, bludgeoning: -0.25, poison: 0.8 },
    attrs: { str: 7, dex: 4, con: 11, int: 1, wis: 1, cha: 1 },
    growth: { str: 0.9, dex: 0.5, con: 1.3, int: 0.75, wis: 0.75, cha: 0.75 },
    xp: 18,
    gold: [2, 7],
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'slime_gel', weight: 25 },
        { kind: 'material', id: 'ruined_fur', weight: 20 },
        { kind: 'material', id: 'iron_scrap', weight: 12 },
        { kind: 'nothing', weight: 43 },
      ],
    },
  },
  slime_spider: {
    id: 'slime_spider',
    name: 'Slime Spider',
    icon: '🕸️',
    tags: ['inorganic', 'slime', 'vermin', 'toxic', 'small'],
    art: 'spiders_slime_spider.png',
    tier: 'veteran',
    damageType: 'poison',
    group: { min: 2, max: 5 },
    resistances: { slashing: 0.4, piercing: 0.5, bludgeoning: -0.25, poison: 0.6 },
    attrs: { str: 5, dex: 10, con: 6, int: 2, wis: 3, cha: 1 },
    growth: { str: 0.7, dex: 1.4, con: 0.8, int: 0.75, wis: 0.75, cha: 0.75 },
    xp: 16,
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'slime_gel', weight: 25 },
        { kind: 'item', id: 'spider_silk_garb', weight: 3 },
        { kind: 'nothing', weight: 72 },
      ],
    },
  },
  slime_coin: {
    id: 'slime_coin',
    name: 'Coin Slime',
    icon: '🪙',
    tags: ['inorganic', 'slime', 'medium'],
    art: 'slimes_coin_slime.png',
    tier: 'veteran',
    damageType: 'bludgeoning',
    group: { max: 1 }, // it did not get rich by travelling in company
    resistances: { slashing: 0.6, piercing: 0.6, bludgeoning: -0.25, heat: -0.4, arcane: 0.3 },
    attrs: { str: 3, dex: 14, con: 5, int: 3, wis: 4, cha: 2 },
    growth: { str: 0.4, dex: 1.8, con: 0.6, int: 0.75, wis: 0.75, cha: 0.75 },
    xp: 22,
    gold: [20, 60],
    loot: {
      rolls: 2,
      entries: [
        { kind: 'gold', weight: 45, qty: [15, 50] },
        { kind: 'material', id: 'iron_scrap', weight: 15, qty: [1, 3] },
        { kind: 'item', id: 'lucky_charm', weight: 5 },
        { kind: 'nothing', weight: 35 },
      ],
    },
  },
  slime_soldier_spear: {
    id: 'slime_soldier_spear',
    name: 'Slime Legionary',
    icon: '🛡️',
    tags: ['inorganic', 'slime', 'humanoid'],
    art: 'slime_soldier_spear.png',
    tier: 'veteran',
    damageType: 'piercing',
    resistances: { slashing: 0.5, piercing: 0.5, bludgeoning: -0.25, arcane: -0.2 },
    attrs: { str: 8, dex: 7, con: 10, int: 2, wis: 2, cha: 2 },
    growth: { str: 1.1, dex: 0.9, con: 1.2, int: 0.75, wis: 0.75, cha: 0.75 },
    xp: 20,
    gold: [4, 10],
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'slime_gel', weight: 25, qty: [1, 2] },
        { kind: 'material', id: 'iron_scrap', weight: 20 },
        { kind: 'item', id: 'wooden_shield', weight: 3 },
        { kind: 'item', id: 'old_spear', weight: 13 },
        { kind: 'nothing', weight: 39 },
      ],
    },
  },
  slime_soldier_bow: {
    id: 'slime_soldier_bow',
    name: 'Slime Skirmisher',
    icon: '🏹',
    tags: ['inorganic', 'slime', 'humanoid'],
    art: 'slime_soldier_bow.png',
    tier: 'veteran',
    damageType: 'piercing',
    range: 'ranged',
    resistances: { slashing: 0.5, piercing: 0.5, bludgeoning: -0.25 },
    attrs: { str: 6, dex: 11, con: 7, int: 3, wis: 3, cha: 2 },
    growth: { str: 0.8, dex: 1.4, con: 0.9, int: 0.75, wis: 0.75, cha: 0.75 },
    xp: 20,
    gold: [4, 10],
    loot: {
      rolls: 1,
      entries: [
        { kind: 'material', id: 'slime_gel', weight: 25, qty: [1, 2] },
        { kind: 'item', id: 'hunting_bow', weight: 3 },
        { kind: 'nothing', weight: 72 },
      ],
    },
  },

  slime_ice_elite: {
    id: 'slime_ice_elite',
    name: 'Glacier Slime',
    icon: '🏔️',
    tags: ['inorganic', 'slime', 'ice', 'large'],
    art: 'slime_ice_elite.png',
    tier: 'elite',
    damageType: 'cold',
    resistances: { slashing: 0.55, piercing: 0.55, bludgeoning: -0.25, cold: 0.8, heat: -0.6 },
    attrs: { str: 10, dex: 5, con: 15, int: 2, wis: 2, cha: 1 },
    growth: { str: 1.3, dex: 0.6, con: 1.7, int: 1.1, wis: 1.1, cha: 1.1 },
    xp: 30,
    gold: [6, 14],
    loot: {
      rolls: 2,
      entries: [
        { kind: 'material', id: 'chilled_slime_gel', weight: 45, qty: [1, 3] },
        { kind: 'material', id: 'slime_core', weight: 3 },
        { kind: 'rune', id: 'minor_rune_frost', weight: 4 },
        { kind: 'nothing', weight: 48 },
      ],
    },
  },
  slime_earth_elite: {
    id: 'slime_earth_elite',
    name: 'Obsidian Slime',
    icon: '⬛',
    tags: ['inorganic', 'slime', 'earth', 'large'],
    art: 'slime_earth_elite.png',
    tier: 'elite',
    damageType: 'slashing',
    resistances: { slashing: 0.4, piercing: 0.75, bludgeoning: -0.4, lightning: 0.7, heat: 0.4 },
    attrs: { str: 13, dex: 5, con: 14, int: 2, wis: 2, cha: 1 },
    growth: { str: 1.6, dex: 0.6, con: 1.5, int: 1.1, wis: 1.1, cha: 1.1 },
    xp: 32,
    gold: [8, 18],
    loot: {
      rolls: 2,
      entries: [
        { kind: 'material', id: 'iron_scrap', weight: 30, qty: [2, 4] },
        { kind: 'material', id: 'slime_core', weight: 3 },
        { kind: 'item', id: 'steel_greatsword', weight: 4 },
        { kind: 'nothing', weight: 63 },
      ],
    },
  },
  slime_thunder_elite: {
    id: 'slime_thunder_elite',
    name: 'Tempest Slime',
    icon: '🌩️',
    tags: ['inorganic', 'slime', 'lightning'],
    art: 'slime_thunder_elite.png',
    tier: 'elite',
    damageType: 'lightning',
    range: 'ranged',
    resistances: { slashing: 0.5, piercing: 0.5, bludgeoning: -0.25, lightning: 0.9, arcane: 0.2 },
    attrs: { str: 8, dex: 12, con: 11, int: 6, wis: 3, cha: 1 },
    growth: { str: 1.0, dex: 1.5, con: 1.3, int: 0.5, wis: 1.1, cha: 1.1 },
    xp: 34,
    gold: [8, 18],
    loot: {
      rolls: 2,
      entries: [
        { kind: 'material', id: 'charged_slime_gel', weight: 45, qty: [1, 3] },
        { kind: 'material', id: 'slime_core', weight: 3 },
        { kind: 'rune', id: 'greater_rune_thunder', weight: 3 },
        { kind: 'nothing', weight: 49 },
      ],
    },
  },
  slime_arcane: {
    id: 'slime_arcane',
    name: 'Arcane Slime',
    icon: '🔮',
    tags: ['inorganic', 'slime', 'arcane'],
    art: 'slime_arcane_slime.png',
    tier: 'elite',
    damageType: 'arcane',
    range: 'ranged',
    resistances: { slashing: 0.5, piercing: 0.5, bludgeoning: -0.25, arcane: 0.7, lightning: 0.2 },
    attrs: { str: 6, dex: 8, con: 11, int: 10, wis: 6, cha: 2 },
    growth: { str: 0.7, dex: 1.0, con: 1.3, int: 1.2, wis: 0.6, cha: 1.1 },
    xp: 36,
    gold: [10, 22],
    loot: {
      rolls: 2,
      entries: [
        { kind: 'material', id: 'luminous_slime_gel', weight: 35 },
        { kind: 'material', id: 'slime_core', weight: 4 },
        { kind: 'item', id: 'apprentice_ring', weight: 4 },
        { kind: 'item', id: 'oak_staff', weight: 3 },
        { kind: 'nothing', weight: 54 },
      ],
    },
  },
  slime_holy: {
    id: 'slime_holy',
    name: 'Radiant Slime',
    icon: '🔆',
    tags: ['inorganic', 'slime', 'light'],
    art: 'slime_holy.png',
    tier: 'elite',
    damageType: 'arcane',
    resistances: { slashing: 0.5, piercing: 0.5, bludgeoning: -0.25, arcane: 0.5, heat: 0.4 },
    attrs: { str: 9, dex: 7, con: 13, int: 6, wis: 9, cha: 4 },
    growth: { str: 1.1, dex: 0.8, con: 1.5, int: 1.1, wis: 1.0, cha: 1.1 },
    xp: 35,
    gold: [10, 20],
    loot: {
      rolls: 2,
      entries: [
        { kind: 'material', id: 'luminous_slime_gel', weight: 35 },
        { kind: 'material', id: 'slime_core', weight: 4 },
        { kind: 'item', id: 'pilgrim_amulet', weight: 4 },
        { kind: 'rune', id: 'greater_rune_vitality', weight: 2 },
        { kind: 'nothing', weight: 55 },
      ],
    },
  },
  slime_dark: {
    id: 'slime_dark',
    name: 'Umbral Slime',
    icon: '🌑',
    tags: ['incorporeal', 'slime', 'dark'],
    art: 'slime_dark.png',
    tier: 'elite',
    damageType: 'arcane',
    resistances: { slashing: 0.85, piercing: 0.85, bludgeoning: 0.5, arcane: -0.5 },
    attrs: { str: 8, dex: 11, con: 10, int: 7, wis: 7, cha: 3 },
    growth: { str: 1.0, dex: 1.4, con: 1.2, int: 0.7, wis: 1.1, cha: 1.1 },
    xp: 38,
    gold: [10, 24],
    loot: {
      rolls: 2,
      entries: [
        { kind: 'material', id: 'void_slime_gel', weight: 30 },
        { kind: 'material', id: 'slime_core', weight: 4 },
        { kind: 'item', id: 'spellwoven_cloak', weight: 3 },
        { kind: 'nothing', weight: 63 },
      ],
    },
  },
  slime_metal: {
    id: 'slime_metal',
    name: 'Metal Slime',
    icon: '🔩',
    tags: ['inorganic', 'slime', 'construct', 'small'],
    art: 'slime_metal_slime.png',
    tier: 'elite',
    damageType: 'bludgeoning',
    group: { max: 1 },
    resistances: { slashing: 0.9, piercing: 0.9, bludgeoning: 0.6, heat: 0.5, cold: 0.5, lightning: -0.6 },
    attrs: { str: 4, dex: 18, con: 6, int: 4, wis: 6, cha: 1 },
    growth: { str: 0.4, dex: 2.0, con: 0.5, int: 1.1, wis: 1.1, cha: 1.1 },
    xp: 120,
    gold: [40, 90],
    loot: {
      rolls: 2,
      entries: [
        { kind: 'material', id: 'iron_ingot', weight: 30, qty: [1, 3] },
        { kind: 'material', id: 'slime_core', weight: 10 },
        { kind: 'gold', weight: 25, qty: [30, 80] },
        { kind: 'nothing', weight: 35 },
      ],
    },
  },

  boss_slime_guardian: {
    id: 'boss_slime_guardian',
    name: 'Slime Guardian',
    icon: '🛡️',
    tags: ['inorganic', 'slime', 'construct', 'colossal'],
    art: 'boss_slime_guardian.png',
    tier: 'ancient',
    damageType: 'bludgeoning',
    group: { max: 1 },
    resistances: { slashing: 0.8, piercing: 0.8, bludgeoning: -0.5, heat: 0.5, cold: 0.5, arcane: -0.6 },
    attrs: { str: 17, dex: 7, con: 24, int: 5, wis: 8, cha: 2 },
    growth: { str: 1.8, dex: 0.8, con: 1.9, int: 1.45, wis: 1.45, cha: 1.45 },
    xp: 95,
    gold: [25, 55],
    loot: {
      rolls: 3,
      entries: [
        { kind: 'material', id: 'slime_core', weight: 25, qty: [1, 2] },
        { kind: 'material', id: 'boss_token', weight: 12 },
        { kind: 'material', id: 'iron_ingot', weight: 20, qty: [2, 4] },
        { kind: 'item', id: 'iron_breastplate', weight: 5 },
        { kind: 'rune', id: 'greater_rune_vitality', weight: 4 },
        { kind: 'nothing', weight: 34 },
      ],
    },
  },
  slime_king: {
    id: 'slime_king',
    name: 'Slime King',
    icon: '👑',
    tags: ['inorganic', 'slime', 'unique', 'large'],
    art: 'slime_rpg_King.png',
    tier: 'legendary',
    damageType: 'bludgeoning',
    group: { min: 3, max: 5 },
    escorts: ['slime_soldier_spear', 'slime_soldier_bow'],
    resistances: { slashing: 0.65, piercing: 0.65, bludgeoning: -0.3, heat: 0.4, cold: 0.4, arcane: -0.3 },
    attrs: { str: 15, dex: 10, con: 18, int: 8, wis: 7, cha: 8 },
    growth: { str: 1.7, dex: 1.1, con: 1.8, int: 0.6, wis: 1.8, cha: 0.6 },
    xp: 110,
    gold: [30, 70],
    loot: {
      rolls: 3,
      entries: [
        { kind: 'material', id: 'slime_core', weight: 25, qty: [1, 3] },
        { kind: 'material', id: 'boss_token', weight: 12 },
        { kind: 'material', id: 'luminous_slime_gel', weight: 18, qty: [1, 2] },
        { kind: 'item', id: 'moonlit_katana', weight: 3 },
        { kind: 'item', id: 'iron_gauntlets', weight: 5 },
        { kind: 'rune', id: 'greater_rune_might', weight: 4 },
        { kind: 'nothing', weight: 33 },
      ],
    },
  },

  // ---------- Training equipment (not a monster) ----------
  /**
   * The test bench. Stands at the Training Grounds with absurd HP, a plated
   * hide and enough sway to be missed, and `passive` so it can never hurt you
   * — park on it for as long as you like to watch a style's numbers work.
   * Groups of dummies let splash and flank behaviour be tried out too.
   */
  training_dummy: {
    id: 'training_dummy',
    name: 'Training Dummy',
    icon: '🎯',
    tags: ['inorganic', 'construct', 'large'],
    tier: 'basic',
    damageType: 'bludgeoning',
    passive: true,
    group: { min: 1, max: 5, weights: { 1: 50, 3: 30, 5: 20 } },
    escorts: ['training_dummy'],
    // A plated dummy: the physical types are blunted, so penetration has
    // something to chew on. Nothing elemental is stopped.
    resistances: { slashing: 0.3, piercing: 0.3, bludgeoning: 0.3 },
    // Deliberately breakable: it dies often enough to exercise kills, the
    // bestiary and drop plumbing without leaving the training area. HP is
    // (12 + CON × 7) × tier roll, so 300 CON is roughly 2.5k. DEX sets the
    // ~15% sway that makes you miss.
    attrs: { str: 0, dex: 50, con: 300, int: 0, wis: 0, cha: 0 },
    growth: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    xp: 1,
    loot: { rolls: 1, entries: [{ kind: 'nothing', weight: 100 }] },
  },
  /**
   * Its unbreakable twin. Same shape, same resistances, but with enough CON to
   * put it past a million HP — a target that outlasts any session, for
   * measuring sustained damage without the fight ever ending.
   */
  benchmark_dummy: {
    id: 'benchmark_dummy',
    name: 'Benchmark Post',
    icon: '🪵',
    tags: ['inorganic', 'construct', 'large'],
    tier: 'basic',
    damageType: 'bludgeoning',
    passive: true,
    group: { min: 1, max: 1 },
    resistances: { slashing: 0.3, piercing: 0.3, bludgeoning: 0.3 },
    // Explicitly UNARMOURED, overriding what `construct` would imply. A thing
    // whose job is to measure damage must not absorb any: armour is flat, so
    // enough of it turns every swing into the 1-damage floor and the benchmark
    // reads zero however hard you hit. It is also a wooden post.
    armor: 0,
    // (12 + 143_000 × 7) ≈ 1.001M HP before the tier roll — never dies in a
    // session, so a damage benchmark runs as long as you care to watch it.
    attrs: { str: 0, dex: 50, con: 143_000, int: 0, wis: 0, cha: 0 },
    growth: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    xp: 1,
    loot: { rolls: 1, entries: [{ kind: 'nothing', weight: 100 }] },
  },
  /*
   * THE PRACTICE YARD — five siblings of the Benchmark Post, each isolating
   * ONE defence so a number can be read off it rather than inferred.
   *
   * Shared shape, deliberately identical to benchmark_dummy's: level 1, one
   * per fight, ~1M health so nothing ever dies mid-measurement, no loot, and
   * `armor: 0` unless armour is the thing being tested. Every varied number is
   * ROUND and stated in the description, so "what should this read?" is
   * arithmetic instead of a guess. Vary one axis per post or the yard stops
   * being instruments and becomes monsters.
   */
  reinforced_post: {
    id: 'reinforced_post',
    name: 'Reinforced Post',
    icon: '🛡️',
    tags: ['inorganic', 'construct', 'large'],
    tier: 'basic',
    damageType: 'bludgeoning',
    passive: true,
    group: { min: 1, max: 1 },
    // Armour ONLY. No resistances, so the whole difference from the plain post
    // is the flat subtraction — which is the one thing being measured.
    armor: 100,
    attrs: { str: 0, dex: 50, con: 143_000, int: 0, wis: 0, cha: 0 },
    growth: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    xp: 1,
    loot: { rolls: 1, entries: [{ kind: 'nothing', weight: 100 }] },
  },
  swaying_post: {
    id: 'swaying_post',
    name: 'Swaying Post',
    icon: '💨',
    tags: ['inorganic', 'construct', 'large'],
    tier: 'basic',
    damageType: 'bludgeoning',
    passive: true,
    group: { min: 1, max: 1 },
    armor: 0,
    // DEX 200 pins dodge to its 0.35 cap (min(0.35, dex × 0.003)), so the
    // figure is exact rather than approximately high.
    attrs: { str: 0, dex: 200, con: 143_000, int: 0, wis: 0, cha: 0 },
    growth: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    xp: 1,
    loot: { rolls: 1, entries: [{ kind: 'nothing', weight: 100 }] },
  },
  flopping_post: {
    id: 'flopping_post',
    name: 'Flopping Post',
    icon: '🥊',
    tags: ['inorganic', 'construct', 'large'],
    tier: 'basic',
    damageType: 'bludgeoning',
    // The one that is NOT passive. Everything else in the yard measures what
    // you do; this measures what is done to you, which is a whole layer of
    // stats with nothing else to exercise them.
    group: { min: 1, max: 1 },
    armor: 0,
    // Fast and weak on purpose: frequent samples, and a fight you can stand in
    // long enough to read one. STR 20 is ~23.5 damage a swing before defences.
    attrs: { str: 20, dex: 200, con: 143_000, int: 0, wis: 0, cha: 0 },
    growth: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    xp: 1,
    loot: { rolls: 1, entries: [{ kind: 'nothing', weight: 100 }] },
  },
  warded_post: {
    id: 'warded_post',
    name: 'Warded Post',
    icon: '✴️',
    tags: ['inorganic', 'construct', 'large'],
    tier: 'basic',
    damageType: 'bludgeoning',
    passive: true,
    group: { min: 1, max: 1 },
    armor: 0,
    // Fractions, not percentages. Physical deliberately absent: the contrast
    // between a resisted element and an unresisted blow is the instrument.
    resistances: {
      heat: 0.75, cold: 0.75, poison: 0.75, acid: 0.75, arcane: 0.75,
      lightning: 0.75, earth: 0.75, water: 0.75, wind: 0.75, light: 0.75, dark: 0.75,
    },
    attrs: { str: 0, dex: 50, con: 143_000, int: 0, wis: 0, cha: 0 },
    growth: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    xp: 1,
    loot: { rolls: 1, entries: [{ kind: 'nothing', weight: 100 }] },
  },
  mending_post: {
    id: 'mending_post',
    name: 'Mending Post',
    icon: '🌿',
    tags: ['inorganic', 'construct', 'large'],
    tier: 'basic',
    damageType: 'bludgeoning',
    passive: true,
    group: { min: 1, max: 1 },
    armor: 0,
    // The whole point: a regenerating thing is a DPS floor rather than a
    // health pool. Suppressed while it burns or corrodes, so the post also
    // tests that counterplay — the same rule the troll gene lives under.
    regen: 0.001,
    attrs: { str: 0, dex: 50, con: 143_000, int: 0, wis: 0, cha: 0 },
    growth: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    xp: 1,
    loot: { rolls: 1, entries: [{ kind: 'nothing', weight: 100 }] },
  },
  psionic_slime: {
    id: 'psionic_slime',
    name: 'Psionic Slime - Vermillion',
    icon: '📦',
    tier: 'elite',
    tags: ['slime', 'inorganic', 'fire', 'large', 'ranged'],
    // The damage type is `heat` — `fire` is the bestiary TAG, not a type.
    damageType: 'heat',
    attrs: { str: 3, dex: 8, con: 6, int: 13, wis: 12, cha: 16 },
    growth: { str: 1, dex: 1, con: 1, int: 2, wis: 2, cha: 3 },
    // Resistances are FRACTIONS, not percentages: 0.8 = takes 20% less,
    // negative = vulnerable. Capped at MONSTER_RESIST_CAP (0.9) on read.
    resistances: { heat: 0.8 },
    /*
     * Shapes, in the same form the player's grimoire stores. It has no axes to
     * learn and no focus to spend — the list is what it is, and the working's
     * own cooldown governs.
     *
     * A needle first (acuity 2 through structured space: piercing, unmissable),
     * then a wide sweep that reads and compresses everyone. Neither is written
     * as an effect anywhere; both fall out of deriveShape.
     */
    rotation: [
      { cast: { school: 'psionic', shape: { force: 6, clairvoyance: 4, space: 3 } } },
      { cast: { school: 'psionic', shape: { clairvoyance: 6, reach: 5, space: 6 } } },
    ],
    xp: 0,
    gold: [120, 250],
    // Drops nothing yet, expressed as one roll of a `nothing` entry the way
    // benchmark_dummy does, since a table with no rolls never runs.
    loot: { rolls: 1, entries: [{ kind: 'nothing', weight: 100 }] },
    art: 'Eldritch Slime Vermillion.png',
    range: 'ranged',
  },
  death_knight: {
    id: 'death_knight',
    name: 'Death Knight',
    icon: '📦',
    tier: 'veteran',
    tags: ['humanoid', 'inorganic', 'dark', 'medium'],
    damageType: 'slashing',
    attrs: { str: 18, dex: 10, con: 15, int: 17, wis: 7, cha: 12 },
    growth: { str: 3, dex: 1.2, con: 2.8, int: 3.4, wis: 1, cha: 1.6 },
    // Fractions, not percentages (see psionic_slime above). `nature` is not a
    // damage type — the closest living-world one is `earth`.
    resistances: { poison: 1, dark: 0.8, cold: 0.75, heat: -0.4, light: -1, earth: -0.4 },
    xp: 0,
    gold: [0, 0],
    // Drops nothing yet, expressed as one roll of a `nothing` entry the way
    // benchmark_dummy does, since a table with no rolls never runs.
    loot: { rolls: 1, entries: [{ kind: 'nothing', weight: 100 }] },
    /*
     * Arcane, and authored as SENTENCES — the same word ids the player speaks,
     * composed by the same grammar. Word order is meaning here too: the second
     * leads with an adverb, which deepens the affliction rather than the blow.
     */
    /*
     * Read top-down, so ORDER is its whole character: it fights first and
     * curses second. Starting at neutral only Gather is open, which leaves it
     * coiled — the one door Heavy Blow has — and that leaves it off balance,
     * where neither technique fits, so a sentence comes out instead. A plain
     * swing resets it to neutral and the wind-up begins again.
     *
     * Nothing sequences that. Each specimen walks its own `position` and the
     * graph does the rest; putting the sentences first would make it a caster
     * that occasionally remembers the sword.
     */
    rotation: [
      { technique: 'gather' },
      { technique: 'heavy_blow' },
      { cast: { school: 'arcane', words: ['gloom', 'cut'] } },
      { cast: { school: 'arcane', words: ['viciously', 'gloom', 'pierce'] } },
      /*
       * An undoing, tuned against exactly what it fears: light (double
       * damage) and heat. Never its turn's action — a counterspell waits in
       * the rotation for YOUR casting to spring it, so where it sits in the
       * list decides nothing. The counterplay is the rest of the lexicon.
       */
      { cast: { school: 'arcane', words: ['undo', 'light', 'with', 'fire'] } },
    ],
    art: 'Darkness Dullahan.png',
  },
  paladin_x: {
    id: 'paladin_x',
    name: 'Paladin X',
    icon: '📦',
    tier: 'veteran',
    tags: ['living', 'humanoid', 'light', 'ice'],
    damageType: 'bludgeoning',
    /*
     * Miracles, received whole — a monster does not compose these, it is
     * simply an aspect of the god it serves. Holy Fire lands as heat or light,
     * whichever you guard worse; the Rite closes its own wounds mid-fight.
     *
     * Note what is NOT here: a miracle whose payload is `buff` (Rite of the
     * Aegis) would do nothing, because `buff` fills the PLAYER's buff slot.
     * Monsters wear `grants` instead — statuses, which applyStatus already
     * puts on a MonsterInstance.
     */
    /*
     * Mending sits FIRST on purpose: a paladin that will not fall over is the
     * whole threat, and top-down means it closes its wounds the moment the
     * rite is off cooldown. Then it presses with Crosscut (neutral → extended),
     * commits with Finishing Cut (extended → neutral), and throws Holy Fire in
     * the gaps while both blades are cooling.
     *
     * Family gates (`sword`, `katana`) are not checked for monsters: it has no
     * scabbard, only its tags.
     */
    rotation: [
      { cast: { school: 'divine', litany: 'litany_mending' } },
      { technique: 'crosscut' },
      { technique: 'finishing_cut' },
      { cast: { school: 'divine', litany: 'holy_fire' } },
    ],
    attrs: { str: 18, dex: 12, con: 19, int: 11, wis: 23, cha: 10 },
    growth: { str: 2.8, dex: 2.1, con: 3, int: 1.3, wis: 3.4, cha: 1.8 },
    resistances: { poison: 0 },
    xp: 0,
    gold: [0, 0],
    // Drops nothing yet, expressed as one roll of a `nothing` entry the way
    // benchmark_dummy does, since a table with no rolls never runs.
    loot: { rolls: 1, entries: [{ kind: 'nothing', weight: 100 }] },
    art: 'Holy Order Paladin Virtus Ironclad.png',
  },
  giant_spider_queen: {
    id: 'giant_spider_queen',
    name: 'Giant Spider Queen',
    icon: '🕷️',
    // Band 1's last boss, reshaped 2026-10-10 (`npm run pacing`). As a
    // legendary with intensity-50 venom she dealt ~25 a second from the poison
    // alone, rode along as her own escort (four queens in one fight), and cost
    // a band-1 climber 27–110 knockouts. Now: solitary, slow and very hard to
    // wear down. Measured one-on-one at the attributes a climber arrives with
    // (12): an old spear wins 39 fights in 40, a rusty sword 2 — and 36 in 40
    // four levels later. A point is the answer; time is the other one.
    tier: 'elite',
    group: { max: 1 },
    tags: ['living', 'vermin', 'toxic', 'huge'],
    damageType: 'poison',
    attrs: { str: 4, dex: 4, con: 14, int: 3, wis: 4, cha: 3 },
    growth: { str: 0.4, dex: 0.4, con: 2.2, int: 0.3, wis: 0.4, cha: 0.25 },
    resistances: { poison: 0.5, earth: 0.35, heat: -0.4, cold: -0.2, slashing: 0.4, bludgeoning: 0.2, piercing: -0.5 },
    xp: 200,
    gold: [6, 14],
    loot: {
      rolls: 1,
      entries: [
          //TODO: loot rolls for Spider Queen
        { kind: 'item', id: 'spider_silk_garb', weight: 3 },
        { kind: 'item', id: 'lucky_charm', weight: 2 },
        { kind: 'nothing', weight: 95 },
      ],
    },
    // Below poison's escalation cap (4) on purpose: at 4 and over her second
    // bite turns septic, and the rot (≈1.2 × intensity a second for 45 s)
    // finished most winners on the floor AFTER she died — a spear at 16 won 7
    // fights in 40. At 3 she is still three spiders' worth of venom.
    inflicts: [
      { id: 'poison', intensity: 3, chance: 0.6 },
    ],
  },
});
