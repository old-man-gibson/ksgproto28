import type { Affix, ItemDef } from '../types';
import { prose } from '../text/prose';
import { ITEMS_TEXT } from '../text/items.text';
import { ITEM_CLASSES, forgedIdOf } from './itemclasses.data';
import { placementCells, runeClassForCells } from './parts.data';

export const ITEMS = prose<ItemDef>('ITEMS', ITEMS_TEXT, {
  rusty_sword: {
    id: 'rusty_sword',
    name: 'Rusty Sword',
    icon: '🗡️',
    slot: 'weapon',
    wield: 'one_handed',
    tags: ['sword', 'metal'],
    mods: [{ stat: 'damage', op: 'add', value: 3 }],
    value: 5,
  },
  // The tutorial rack's hammer (data/tutorial.data.ts): the blunt starter,
  // priced beside the rusty sword. Heavier per swing and slower, which is
  // the trade the Crush stance is built around.
  old_hammer: {
    id: 'old_hammer',
    name: 'Old Hammer',
    icon: '🔨',
    slot: 'weapon',
    wield: 'one_handed',
    tags: ['blunt', 'iron'],
    mods: [
      { stat: 'damage', op: 'add', value: 5 },
      { stat: 'attackSpeed', op: 'mult', value: -0.12 },
    ],
    value: 6,
  },
  oak_club: {
    id: 'oak_club',
    name: 'Oak Club',
    icon: '🏏',
    slot: 'weapon',
    wield: 'one_handed',
    tags: ['blunt', 'wood'],
    mods: [
      { stat: 'damage', op: 'add', value: 5 },
      { stat: 'attackSpeed', op: 'mult', value: -0.1 },
    ],
    value: 8,
  },
  jotunshamarr: {
    id: 'jotunshamarr',
    name: "Jötun's Hammer",
    icon: '🏏',
    slot: 'weapon',
    wield: 'two_handed',
    tags: ['blunt', 'iron'],
    mods: [
      { stat: 'damage', op: 'add', value: 35 },
      { stat: 'attackSpeed', op: 'mult', value: -0.24 },
    ],
    value: 800,
  },
  iron_sword: {
    id: 'iron_sword',
    name: 'Iron Sword',
    icon: '⚔️',
    slot: 'weapon',
    wield: 'one_handed',
    tags: ['sword', 'metal'],
    mods: [
      { stat: 'damage', op: 'add', value: 7 },
      { stat: 'crit', op: 'add', value: 0.02 },
    ],
    value: 40,
  },
  wolf_fang_blade: {
    id: 'wolf_fang_blade',
    name: 'Wolf-Fang Blade',
    icon: '🐺',
    slot: 'weapon',
    wield: 'one_handed',
    tags: ['sword', 'beast'],
    mods: [
      { stat: 'damage', op: 'add', value: 10 },
      { stat: 'attackSpeed', op: 'mult', value: 0.1 },
    ],
    value: 120,
  },
  old_spear: {
    id: 'old_spear',
    name: 'Old Spear',
    icon: '🔱️',
    slot: 'weapon',
    wield: 'two_handed',
    tags: ['spear', 'wood'],
    mods: [
      { stat: 'damage', op: 'add', value: 7 },
      { stat: 'armor', op: 'add', value: 2 },
    ],
    value: 40,
  },
  cloth_tunic: {
    id: 'cloth_tunic',
    name: 'Cloth Tunic',
    icon: '👕',
    slot: 'chest',
    tags: ['cloth'],
    mods: [{ stat: 'armor', op: 'add', value: 2 }],
    value: 4,
  },
  leather_vest: {
    id: 'leather_vest',
    name: 'Leather Vest',
    icon: '🦺',
    slot: 'chest',
    tags: ['leather'],
    mods: [
      { stat: 'armor', op: 'add', value: 5 },
      { stat: 'maxHp', op: 'add', value: 15 },
    ],
    value: 35,
  },
  spider_silk_garb: {
    id: 'spider_silk_garb',
    name: 'Spider-Silk Garb',
    icon: '🕸️',
    slot: 'chest',
    tags: ['cloth', 'silk'],
    mods: [
      { stat: 'armor', op: 'add', value: 4 },
      { stat: 'dodge', op: 'add', value: 0.06 },
      { stat: 'spellPower', op: 'mult', value: 0.1 },
    ],
    value: 150,
  },
  lucky_charm: {
    id: 'lucky_charm',
    name: 'Lucky Charm',
    icon: '🍀',
    slot: 'accessory',
    tags: ['trinket'],
    mods: [{ stat: 'loot', op: 'mult', value: 0.15 }],
    value: 60,
  },
  hawk_feather_band: {
    id: 'hawk_feather_band',
    name: 'Hawk-Feather Band',
    icon: '🪶',
    slot: 'accessory',
    tags: ['trinket'],
    mods: [
      { stat: 'dodge', op: 'add', value: 0.04 },
      { stat: 'attackSpeed', op: 'mult', value: 0.08 },
    ],
    value: 90,
  },

  // ---------- Ported from proto26 ----------
  oak_staff: {
    id: 'oak_staff',
    name: 'Oak Staff',
    icon: '🪄',
    slot: 'weapon',
    wield: 'two_handed',
    tags: ['staff', 'wood', 'magic'],
    mods: [
      { stat: 'int', op: 'add', value: 2 },
      { stat: 'damage', op: 'add', value: 2 },
      { stat: 'spellPower', op: 'add', value: 4 },
    ],
    value: 15,
  },
  hunting_bow: {
    id: 'hunting_bow',
    name: 'Hunting Bow',
    icon: '🏹',
    slot: 'weapon',
    wield: 'two_handed',
    tags: ['bow', 'ranged', 'wood'],
    mods: [
      { stat: 'dex', op: 'add', value: 2 },
      { stat: 'damage', op: 'add', value: 4 },
      { stat: 'crit', op: 'add', value: 0.02 },
    ],
    value: 18,
  },
  iron_dagger: {
    id: 'iron_dagger',
    name: 'Iron Dagger',
    icon: '🔪',
    slot: 'weapon',
    wield: 'light',
    tags: ['dagger', 'metal'],
    mods: [
      { stat: 'dex', op: 'add', value: 2 },
      { stat: 'damage', op: 'add', value: 2 },
      { stat: 'attackSpeed', op: 'mult', value: 0.08 },
      { stat: 'crit', op: 'add', value: 0.03 },
    ],
    value: 22,
  },
  /*
   * Matter carries a will unevenly, and bronze_dagger below is the other pole
   * of this one. Both bias the DERIVED QUANTITIES (StatKey psi*) rather than
   * adding damage, so neither is a stat stick: bronze sharpens needles, and
   * these can drag a shape under a threshold until it stops being the thing
   * it was. See docs/PSIONIC.md §3.
   *
   * NOTE the direction. This argues with its OWN WEARER — it is cursed metal,
   * not armour against psions. Warding yourself FROM someone else's working is
   * a different mechanism entirely and is banked in §8 under the name
   * nullsteel, deliberately left free for it.
   *
   * Priced as GOOD ARMOUR that costs you something, because a per-quantity
   * penalty is not a flat tax — it is conditional. Somebody who never shapes a
   * working pays nothing at all; a hammer or a mending build barely notices
   * acuity; only a needle finds these unwearable. That is the point of biasing
   * quantities instead of "psionic power −20%": the same bracers are free,
   * awkward, or ruinous depending on what you were going to do with your mind.
   */
  antipattern_bracers: {
    id: 'antipattern_bracers',
    name: 'Antipattern Bracers',
    icon: '🥊',
    slot: 'hands',
    tags: ['antipattern', 'metal'],
    mods: [
      // Comfortably better than Iron Gauntlets (str 1 / armor 4) — it has to
      // be, or the drawback is buying nothing and nobody weighs it at all.
      { stat: 'str', op: 'add', value: 1 },
      { stat: 'armor', op: 'add', value: 6 },
      // Etched against the grain of thinking. It does not object to being
      // struck — it objects to being MEANT, and everything the wearer's own
      // will tries to be reads thinner coming out through it.
      { stat: 'psiAcuity', op: 'mult', value: -0.35 },
      { stat: 'psiCoherence', op: 'mult', value: -0.35 },
      { stat: 'psiPurchase', op: 'mult', value: -0.25 },
    ],
    value: 90,
  },
  ember_knife: {
    id: 'ember_knife',
    name: 'Ember Knife',
    icon: '🗡️',
    slot: 'weapon',
    wield: 'light',
    tags: ['dagger', 'fire', 'magic'],
    mods: [
      { stat: 'dex', op: 'add', value: 2 },
      { stat: 'damage', op: 'add', value: 5 },
      { stat: 'attackSpeed', op: 'mult', value: 0.1 },
    ],
    value: 135,
    bonusDamage: { type: 'heat', value: 4 },
  },
  steel_greatsword: {
    id: 'steel_greatsword',
    name: 'Steel Greatsword',
    icon: '⚔️',
    slot: 'weapon',
    wield: 'two_handed',
    tags: ['greatsword', 'metal', 'twoHanded'],
    mods: [
      { stat: 'str', op: 'add', value: 3 },
      { stat: 'damage', op: 'add', value: 14 },
      { stat: 'attackSpeed', op: 'mult', value: -0.15 },
      { stat: 'critDamage', op: 'mult', value: 0.1 },
    ],
    value: 140,
    requirements: [{ type: 'attr', attr: 'str', level: 12 }],
  },
  wooden_shield: {
    id: 'wooden_shield',
    name: 'Wooden Shield',
    icon: '🛡️',
    slot: 'offhand',
    wield: 'offhand',
    tags: ['shield', 'wood', 'light shield'],
    mods: [
      { stat: 'armor', op: 'add', value: 4 },
      { stat: 'maxHp', op: 'add', value: 8 },
    ],
    value: 12,
  },
  warden_buckler: {
    id: 'warden_buckler',
    name: 'Warden’s Buckler',
    icon: '🔰',
    slot: 'offhand',
    wield: 'offhand',
    // Both a shield and a parrying tool: small enough to be aimed at a blade
    // rather than hidden behind, so it trains Shield Combat and Deflection
    // alike. 'buckler' is the sub-family (⊂ shield) the Bolognese school gates
    // on — a plank shield blocks, it does not bind.
    tags: ['shield', 'buckler', 'parrying', 'metal'],
    mods: [
      { stat: 'armor', op: 'add', value: 8 },
      { stat: 'dodge', op: 'add', value: 0.03 },
    ],
    value: 160,
    requirements: [{ type: 'attr', attr: 'dex', level: 8 }],
    // Built to be punched forward as much as held back, so it loses nothing in
    // the main hand — declaring a main-hand bonus waives the misfit penalty.
    mainHand: {
      mods: [
        { stat: 'damage', op: 'add', value: 3 },
        { stat: 'parry', op: 'add', value: 0.04 },
      ],
    },
    offHand: {
      mods: [{ stat: 'parry', op: 'add', value: 0.03 }],
    },
  },
  rapier: {
    id: 'rapier',
    name: 'Rapier',
    icon: '🤺',
    slot: 'weapon',
    wield: 'one_handed',
    // The swept guard is half of what the weapon is for: a rapier defends with
    // the same hand it kills with, so it carries 'parrying' on its own.
    tags: ['sword', 'rapier', 'parrying', 'metal'],
    mods: [
      { stat: 'damage', op: 'add', value: 6 },
      { stat: 'crit', op: 'add', value: 0.04 },
      { stat: 'attackSpeed', op: 'mult', value: 0.1 },
      { stat: 'parry', op: 'add', value: 0.03 },
    ],
    value: 140,
    requirements: [{ type: 'attr', attr: 'dex', level: 12 }],
  },
  parrying_dagger: {
    id: 'parrying_dagger',
    name: 'Parrying Dagger',
    icon: '🗝️',
    slot: 'offhand',
    wield: 'offhand',
    tags: ['dagger', 'parrying', 'metal'],
    mods: [
      { stat: 'parry', op: 'add', value: 0.04 },
      { stat: 'damage', op: 'add', value: 1 },
    ],
    value: 130,
    requirements: [{ type: 'attr', attr: 'dex', level: 10 }],
    offHand: {
      pairedWith: 'rapier',
      mods: [
        { stat: 'parry', op: 'add', value: 0.05 },
        { stat: 'crit', op: 'add', value: 0.02 },
        // Left hand catches, right hand is already answering.
        { stat: 'riposte', op: 'add', value: 0.1 },
      ],
    },
  },
  leather_cap: {
    id: 'leather_cap',
    name: 'Leather Cap',
    icon: '🧢',
    slot: 'head',
    tags: ['leather'],
    mods: [
      { stat: 'armor', op: 'add', value: 2 },
      { stat: 'dodge', op: 'add', value: 0.02 },
    ],
    value: 6,
  },
  leather_jerkin: {
    id: 'leather_jerkin',
    name: 'Leather Jerkin',
    icon: '🦺',
    slot: 'chest',
    tags: ['leather'],
    mods: [
      { stat: 'armor', op: 'add', value: 6 },
      { stat: 'dodge', op: 'add', value: 0.03 },
    ],
    value: 20,
  },
  iron_breastplate: {
    id: 'iron_breastplate',
    name: 'Iron Breastplate',
    icon: '🎽',
    slot: 'chest',
    tags: ['metal', 'heavy'],
    mods: [
      { stat: 'con', op: 'add', value: 1 },
      { stat: 'armor', op: 'add', value: 14 },
      { stat: 'attackSpeed', op: 'mult', value: -0.05 },
    ],
    value: 85,
    requirements: [{ type: 'attr', attr: 'str', level: 8 }],
  },
  iron_gauntlets: {
    id: 'iron_gauntlets',
    name: 'Iron Gauntlets',
    icon: '🧤',
    slot: 'hands',
    tags: ['metal', 'heavy'],
    mods: [
      { stat: 'str', op: 'add', value: 1 },
      { stat: 'armor', op: 'add', value: 4 },
    ],
    value: 14,
  },
  scout_bracers: {
    id: 'scout_bracers',
    name: 'Scout Bracers',
    icon: '🥊',
    slot: 'hands',
    tags: ['leather'],
    mods: [
      { stat: 'attackSpeed', op: 'mult', value: 0.06 },
      { stat: 'dodge', op: 'add', value: 0.03 },
    ],
    value: 28,
  },
  soldier_greaves: {
    id: 'soldier_greaves',
    name: 'Soldier Greaves',
    icon: '🦵',
    slot: 'legs',
    tags: ['metal', 'heavy'],
    mods: [
      { stat: 'armor', op: 'add', value: 10 },
      { stat: 'maxHp', op: 'add', value: 10 },
    ],
    value: 55,
  },
  leather_boots: {
    id: 'leather_boots',
    name: 'Leather Boots',
    icon: '🥾',
    slot: 'feet',
    tags: ['leather'],
    mods: [
      { stat: 'dodge', op: 'add', value: 0.05 },
      { stat: 'travelSpeed', op: 'mult', value: 0.08 },
    ],
    value: 16,
  },
  spellwoven_cloak: {
    id: 'spellwoven_cloak',
    name: 'Spellwoven Cloak',
    icon: '🧣',
    slot: 'back',
    tags: ['cloth', 'magic'],
    mods: [
      { stat: 'int', op: 'add', value: 2 },
      { stat: 'dodge', op: 'add', value: 0.06 },
      { stat: 'armor', op: 'add', value: 3 },
    ],
    value: 120,
  },
  apprentice_ring: {
    id: 'apprentice_ring',
    name: 'Apprentice’s Ring',
    icon: '💍',
    slot: 'accessory',
    tags: ['trinket', 'magic'],
    mods: [
      { stat: 'spellPower', op: 'add', value: 3 },
      { stat: 'skillXp', op: 'mult', value: 0.04 },
    ],
    value: 25,
  },
  pilgrim_amulet: {
    id: 'pilgrim_amulet',
    name: 'Pilgrim Amulet',
    icon: '📿',
    slot: 'accessory',
    tags: ['trinket'],
    mods: [
      { stat: 'maxHp', op: 'add', value: 12 },
      { stat: 'travelSpeed', op: 'mult', value: 0.05 },
    ],
    value: 32,
  },

  // ---------- Katanas (sword subgroup: they level Swordsmanship) ----------
  katana: {
    id: 'katana',
    name: 'Katana',
    icon: '🗡️',
    slot: 'weapon',
    wield: 'one_handed',
    tags: ['sword', 'katana', 'metal'],
    mods: [
      { stat: 'damage', op: 'add', value: 6 },
      { stat: 'crit', op: 'add', value: 0.03 },
      { stat: 'attackSpeed', op: 'mult', value: 0.05 },
    ],
    value: 100,
    requirements: [{ type: 'attr', attr: 'dex', level: 8 }],
  },
  uchigatana: {
    id: 'uchigatana',
    name: 'Uchigatana',
    icon: '🗡️',
    slot: 'weapon',
    wield: 'one_handed',
    tags: ['sword', 'katana', 'metal'],
    mods: [
      { stat: 'damage', op: 'add', value: 9 },
      { stat: 'crit', op: 'add', value: 0.04 },
      { stat: 'attackSpeed', op: 'mult', value: 0.08 },
    ],
    value: 180,
    requirements: [{ type: 'attr', attr: 'dex', level: 10 }],
  },
  moonlit_katana: {
    id: 'moonlit_katana',
    name: 'Moonlit Katana',
    icon: '🌙',
    slot: 'weapon',
    wield: 'one_handed',
    tags: ['sword', 'katana', 'metal'],
    mods: [
      { stat: 'damage', op: 'add', value: 14 },
      { stat: 'crit', op: 'add', value: 0.08 },
      { stat: 'critDamage', op: 'mult', value: 0.2 },
      { stat: 'attackSpeed', op: 'mult', value: 0.1 },
    ],
    value: 400,
    requirements: [{ type: 'skill', id: 'swordsmanship', level: 20 }],
  },

  // ---------- Craftables (Phase 2) ----------
  herbal_charm: {
    id: 'herbal_charm',
    name: 'Herbal Charm',
    icon: '🌿',
    slot: 'accessory',
    tags: ['trinket', 'herbal'],
    mods: [
      { stat: 'resPoison', op: 'add', value: 0.15 },
      { stat: 'loot', op: 'mult', value: 0.05 },
    ],
    value: 45,
  },
  wolf_cloak: {
    id: 'wolf_cloak',
    name: 'Wolf Cloak',
    icon: '🧥',
    slot: 'back',
    tags: ['leather', 'fur'],
    mods: [
      { stat: 'resSlashing', op: 'add', value: 0.12 },
      { stat: 'dodge', op: 'add', value: 0.03 },
      { stat: 'maxHp', op: 'add', value: 10 },
    ],
    value: 110,
  },
  bronze_dagger: {
    id: 'bronze_dagger',
    name: 'Bronze Dagger',
    icon: '🔪',
    slot: 'weapon',
    // `bronze` is a material tag like `metal`, so anything can key off it
    // later (requiresTag, recipes, a smith who only works one alloy).
    tags: ['dagger', 'bronze', 'metal'],
    value: 22,
    mods: [
      { value: 2, stat: 'dex', op: 'add' },
      { value: 1, stat: 'damage', op: 'add' },
      { value: 0.09, stat: 'attackSpeed', op: 'mult' },
      { value: 0.03, stat: 'crit', op: 'add' },
      /*
       * What makes it bronze rather than a reddish iron dagger: it carries a
       * will the way iron will not. Biases the QUANTITIES, so it sharpens a
       * needle (acuity) and helps a shape hold its form (coherence) while
       * doing nothing whatsoever for a hammer — a build choice, not a number.
       */
      { value: 0.15, stat: 'psiAcuity', op: 'mult' },
      { value: 0.1, stat: 'psiCoherence', op: 'mult' },
    ],
    wield: 'light',
  },
  tower_shield: {
    id: 'tower_shield',
    name: 'Tower Shield',
    icon: '🛡️',
    slot: 'offhand',
    tags: ['wood', 'tower shield', 'shield'],
    value: 18,
    mods: [
      { value: 7, stat: 'armor', op: 'add' },
      { value: -0.15, stat: 'speed', op: 'mult' },
      { value: 0.06, stat: 'armor', op: 'mult' },
    ],
    wield: 'offhand',
  },

  // ---------- The Vermin Festival (systems/festival.ts, systems/stash.ts) ----------
  // Placeholders. The laurel is the royale's reward, paid by the first win
  // of a run. The regalia is a festival token's equipment choice: above the
  // laurel, and keep-marked, so every prestige returns it to the stash.
  festival_laurel: {
    id: 'festival_laurel',
    name: 'Festival Laurel',
    icon: '🏅',
    slot: 'accessory',
    tags: ['trinket'],
    mods: [
      { stat: 'damage', op: 'mult', value: 0.08 },
      { stat: 'maxHp', op: 'mult', value: 0.08 },
    ],
    value: 400,
  },
  festival_regalia: {
    id: 'festival_regalia',
    name: 'Festival Regalia',
    icon: '👑',
    slot: 'accessory',
    tags: ['trinket'],
    mods: [
      { stat: 'damage', op: 'mult', value: 0.15 },
      { stat: 'maxHp', op: 'mult', value: 0.15 },
      { stat: 'attackSpeed', op: 'mult', value: 0.05 },
    ],
    value: 1500,
    keep: true,
  },
  // The royale field's weapon caches (CACHE_WEAPONS in data/festival.data.ts):
  // one step above each issued starter, modelled on it, same family tags and
  // wield. Lent by caches only and taken back when the attempt ends: in no
  // shop, drop table or recipe.
  festival_spear: {
    id: 'festival_spear',
    name: 'Festival Spear',
    icon: '🔱️',
    slot: 'weapon',
    wield: 'two_handed',
    tags: ['spear', 'wood'],
    mods: [
      { stat: 'damage', op: 'add', value: 10 },
      { stat: 'armor', op: 'add', value: 3 },
    ],
    value: 90,
  },
  festival_greatsword: {
    id: 'festival_greatsword',
    name: 'Festival Greatsword',
    icon: '⚔️',
    slot: 'weapon',
    wield: 'two_handed',
    tags: ['greatsword', 'metal', 'twoHanded'],
    mods: [
      { stat: 'str', op: 'add', value: 3 },
      { stat: 'damage', op: 'add', value: 18 },
      { stat: 'attackSpeed', op: 'mult', value: -0.14 },
      { stat: 'critDamage', op: 'mult', value: 0.12 },
    ],
    value: 260,
    requirements: [{ type: 'attr', attr: 'str', level: 12 }],
  },
  festival_staff: {
    id: 'festival_staff',
    name: 'Festival Staff',
    icon: '🪄',
    slot: 'weapon',
    wield: 'two_handed',
    tags: ['staff', 'wood', 'magic'],
    mods: [
      { stat: 'int', op: 'add', value: 3 },
      { stat: 'damage', op: 'add', value: 3 },
      { stat: 'spellPower', op: 'add', value: 7 },
    ],
    value: 45,
  },
  festival_bow: {
    id: 'festival_bow',
    name: 'Festival Bow',
    icon: '🏹',
    slot: 'weapon',
    wield: 'two_handed',
    tags: ['bow', 'ranged', 'wood'],
    mods: [
      { stat: 'dex', op: 'add', value: 3 },
      { stat: 'damage', op: 'add', value: 6 },
      { stat: 'crit', op: 'add', value: 0.03 },
    ],
    value: 50,
  },
  festival_dagger: {
    id: 'festival_dagger',
    name: 'Festival Dagger',
    icon: '🔪',
    slot: 'weapon',
    wield: 'light',
    tags: ['dagger', 'metal'],
    mods: [
      { stat: 'dex', op: 'add', value: 3 },
      { stat: 'damage', op: 'add', value: 4 },
      { stat: 'attackSpeed', op: 'mult', value: 0.1 },
      { stat: 'crit', op: 'add', value: 0.04 },
    ],
    value: 60,
  },
  festival_mace: {
    id: 'festival_mace',
    name: 'Festival Mace',
    icon: '🔨',
    slot: 'weapon',
    wield: 'one_handed',
    tags: ['blunt', 'iron'],
    mods: [
      { stat: 'damage', op: 'add', value: 8 },
      { stat: 'attackSpeed', op: 'mult', value: -0.12 },
    ],
    value: 40,
  },
});

/*
 * ---- Smithing: one stub per item class, generated ----
 *
 * A forged item's `defId` is `forged:<classId>`, so every `ITEMS[defId]` lookup
 * that has not learned about the anvil still lands on something with the right
 * slot, hands and family tags, instead of undefined. The numbers are NOT here:
 * a stub grants nothing (empty mods), and the real definition of a given forged
 * item is derived from its parts by `itemDefOf` (systems/assembly.ts).
 *
 * Generated rather than written out so the class list has exactly one source,
 * the way materials.data.ts generates preps and genes. The rune class is the
 * class's exemplar placement read through the same cell thresholds the derived
 * definition uses.
 */
for (const cls of Object.values(ITEM_CLASSES)) {
  const id = forgedIdOf(cls.id);
  ITEMS[id] = {
    id,
    name: cls.name,
    icon: cls.icon,
    slot: cls.slot,
    ...(cls.wield ? { wield: cls.wield } : {}),
    tags: [...cls.tags],
    mods: [],
    value: 1,
    ...(cls.desc ? { desc: cls.desc } : {}),
    runeClass: runeClassForCells(placementCells(cls.exemplar)),
  };
}

/** Affixes randomly attached to monster drops; better monster rarity → higher chance. */
export const AFFIXES: Affix[] = [
  { name: 'Sharp', mods: [{ stat: 'damage', op: 'mult', value: 0.1 }] },
  { name: 'Sturdy', mods: [{ stat: 'maxHp', op: 'add', value: 12 }] },
  { name: 'Swift', mods: [{ stat: 'attackSpeed', op: 'mult', value: 0.08 }] },
  { name: 'Lucky', mods: [{ stat: 'loot', op: 'mult', value: 0.08 }] },
  { name: 'Warded', mods: [{ stat: 'armor', op: 'add', value: 3 }] },
];
