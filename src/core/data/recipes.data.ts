import type { RecipeDef } from '../types';

/**
 * Crafting recipes (ported/adapted from proto26 craftingRequirements).
 * Crafting runs as an idle activity at spots listing the recipe; costs are
 * consumed per completed craft and Smithing XP is granted.
 */
export const RECIPES: Record<string, RecipeDef> = {
  iron_ingot: {
    id: 'iron_ingot',
    tags: ['smithing'],
    result: { kind: 'material', id: 'iron_ingot' },
    cost: [{ id: 'iron_scrap', qty: 3 }],
    ticks: 120,
    xp: 4,
  },
  iron_dagger: {
    id: 'iron_dagger',
    tags: ['smithing'],
    result: { kind: 'item', id: 'iron_dagger' },
    cost: [
      { id: 'iron_ingot', qty: 1 },
      { id: 'hardwood', qty: 1 },
    ],
    ticks: 220,
    xp: 8,
    // A recipe line is a placement with a fixed set of parts: the cost above is
    // what the cells derive (tests/content.test.ts), and each craft also
    // counts toward the form chart. It still mints the dagger below.
    forge: { head: { kind: 'short', mat: 'iron_ingot' }, haft: { kind: 'h3', mat: 'hardwood' } },
  },
  iron_sword: {
    id: 'iron_sword',
    tags: ['smithing'],
    result: { kind: 'item', id: 'iron_sword' },
    cost: [
      { id: 'iron_ingot', qty: 2 },
      { id: 'hardwood', qty: 1 },
    ],
    ticks: 300,
    xp: 12,
    unlock: [{ type: 'skill', id: 'smithing', level: 3 }],
    forge: { head: { kind: 'long', mat: 'iron_ingot' }, haft: { kind: 'h3', mat: 'hardwood' } },
  },
  iron_breastplate: {
    id: 'iron_breastplate',
    tags: ['smithing'],
    result: { kind: 'item', id: 'iron_breastplate' },
    // Was 4 ingots. A wide plate is 16 cells (3 ingots) and the strap is 3
    // cells of leather: the cost now follows the parts.
    cost: [
      { id: 'iron_ingot', qty: 3 },
      { id: 'leather', qty: 1 },
    ],
    ticks: 500,
    xp: 25,
    unlock: [{ type: 'skill', id: 'smithing', level: 8 }],
    forge: { head: { kind: 'plate_w', mat: 'iron_ingot' }, bind: { kind: 'strap', mat: 'leather' } },
  },
  leather_cap: {
    id: 'leather_cap',
    tags: ['leatherwork'],
    result: { kind: 'item', id: 'leather_cap' },
    cost: [{ id: 'ruined_fur', qty: 4 }],
    ticks: 150,
    xp: 4,
  },
  leather_vest: {
    id: 'leather_vest',
    tags: ['leatherwork'],
    result: { kind: 'item', id: 'leather_vest' },
    cost: [
      { id: 'torn_fur', qty: 4 },
      { id: 'ruined_fur', qty: 2 },
    ],
    ticks: 250,
    xp: 8,
  },
  leather_boots: {
    id: 'leather_boots',
    tags: ['leatherwork'],
    result: { kind: 'item', id: 'leather_boots' },
    cost: [{ id: 'torn_fur', qty: 3 }],
    ticks: 200,
    xp: 6,
  },
  hunting_bow: {
    id: 'hunting_bow',
    tags: ['leatherwork'],
    result: { kind: 'item', id: 'hunting_bow' },
    cost: [
      { id: 'hardwood', qty: 2 },
      { id: 'torn_fur', qty: 1 },
    ],
    ticks: 250,
    xp: 8,
  },
  herbal_charm: {
    id: 'herbal_charm',
    tags: ['alchemy'],
    result: { kind: 'item', id: 'herbal_charm' },
    cost: [
      { id: 'common_herb', qty: 8 },
      { id: 'torn_fur', qty: 1 },
    ],
    ticks: 300,
    xp: 10,
  },
  rapier: {
    id: 'rapier',
    tags: ['smithing'],
    result: { kind: 'item', id: 'rapier' },
    // Was 3 ingots. A thin blade (6 cells) and a swept guard (6 cells) are
    // 12 cells of iron: 2 ingots.
    cost: [
      { id: 'iron_ingot', qty: 2 },
      { id: 'hardwood', qty: 1 },
    ],
    ticks: 400,
    xp: 18,
    unlock: [{ type: 'skill', id: 'smithing', level: 8 }],
    forge: {
      head: { kind: 'thin', mat: 'iron_ingot' },
      guard: { kind: 'swept', mat: 'iron_ingot' },
      haft: { kind: 'h3', mat: 'hardwood' },
    },
  },
  parrying_dagger: {
    id: 'parrying_dagger',
    tags: ['smithing'],
    result: { kind: 'item', id: 'parrying_dagger' },
    cost: [
      { id: 'iron_ingot', qty: 2 },
      { id: 'hardwood', qty: 1 },
    ],
    ticks: 340,
    xp: 15,
    unlock: [{ type: 'skill', id: 'smithing', level: 8 }],
    forge: {
      head: { kind: 'short', mat: 'iron_ingot' },
      guard: { kind: 'cross', mat: 'iron_ingot' },
      haft: { kind: 'h3', mat: 'hardwood' },
    },
  },
  uchigatana: {
    id: 'uchigatana',
    tags: ['smithing'],
    result: { kind: 'item', id: 'uchigatana' },
    cost: [
      { id: 'iron_ingot', qty: 3 },
      { id: 'hardwood', qty: 1 },
      { id: 'pristine_fur', qty: 1 },
    ],
    ticks: 450,
    xp: 20,
    unlock: [{ type: 'skill', id: 'smithing', level: 10 }],
  },
  katana: {
    id: 'katana',
    tags: ['smithing'],
    result: { kind: 'item', id: 'katana' },
    cost: [
      { id: 'iron_ingot', qty: 2 },
      { id: 'hardwood', qty: 1 },
    ],
    ticks: 200,
    xp: 10,
    unlock: [{ type: 'skill', id: 'smithing', level: 6 }],
    forge: { head: { kind: 'curved', mat: 'iron_ingot' }, haft: { kind: 'h3', mat: 'hardwood' } },
  },
  wolf_cloak: {
    id: 'wolf_cloak',
    tags: ['leatherwork'],
    result: { kind: 'item', id: 'wolf_cloak' },
    cost: [
      { id: 'pristine_fur', qty: 2 },
      { id: 'torn_fur', qty: 3 },
    ],
    ticks: 400,
    xp: 15,
    // Two pristine hides and three torn ones, and not a scrap of metal — it was
    // gated on Smithing, which was invisible while every craft levelled every
    // trade at once.
    unlock: [{ type: 'skill', id: 'leathercrafting', level: 5 }],
  },
  // The bronze line: SECRET until the Smith's Pattern (a rare find working
  // the Forges' bellows) is studied — then listed at the Forges.
  copper_ingot: {
    id: 'copper_ingot',
    secret: true,
    unlock: [{ type: 'stat', key: 'flag:pattern_bronze', value: 1 }],
    name: 'Copper Ingot',
    ticks: 100,
    xp: 3,
    cost: [
      { id: 'copper_ore', qty: 3 },
    ],
    tags: ['smithing'],
    result: { id: 'copper_ingot', kind: 'material' },
  },
  tin_ingot: {
    id: 'tin_ingot',
    secret: true,
    unlock: [{ type: 'stat', key: 'flag:pattern_bronze', value: 1 }],
    name: 'Tin Ingot',
    ticks: 60,
    xp: 0,
    cost: [
      { id: 'tin_ore', qty: 3 },
    ],
    tags: ['smithing'],
    result: { id: 'tin_ingot', kind: 'material' },
  },
  bronze_ingot: {
    id: 'bronze_ingot',
    secret: true,
    unlock: [{ type: 'stat', key: 'flag:pattern_bronze', value: 1 }],
    name: 'Bronze Ingot',
    ticks: 140,
    xp: 4,
    cost: [
      { id: 'copper_ingot', qty: 4 },
      { id: 'tin_ingot', qty: 1 },
    ],
    tags: ['smithing'],
    result: { id: 'bronze_ingot', kind: 'material' },
  },
  bronze_dagger: {
    id: 'bronze_dagger',
    secret: true,
    unlock: [{ type: 'stat', key: 'flag:pattern_bronze', value: 1 }],
    name: 'Bronze Dagger',
    ticks: 220,
    xp: 8,
    cost: [
      { id: 'bronze_ingot', qty: 1 },
      { id: 'leather', qty: 1 },
    ],
    tags: ['smithing'],
    result: { id: 'bronze_dagger', kind: 'item' },
  },
  /**
   * Four routes to the same hide. Order is preference: the junk goes first, so
   * an idle run burns ruined fur while it lasts and only reaches for the
   * pristine pelt when nothing worse is left — and that pelt pays double,
   * which is the reason to have saved it.
   */
  leather: {
    id: 'leather',
    name: 'Leather',
    ticks: 90,
    xp: 2,
    cost: [{ id: 'ruined_fur', qty: 4 }],
    alts: [
      { id: 'torn', cost: [{ id: 'torn_fur', qty: 3 }] },
      { id: 'pristine', cost: [{ id: 'pristine_fur', qty: 1 }], qty: 2 },
    ],
    // Names the work, which does two jobs: Leathercrafting manifests and levels
    // from it, and its `craftSpeed:leatherwork` bonus knows to apply here.
    tags: ['leatherwork'],
    result: { id: 'leather', kind: 'material' },
  },
  /**
   * Histones: what a new connection is built out of.
   *
   * Deliberately a RECIPE rather than a discipline. Every discipline owns an
   * identity (sum / when / order / topology) and inventing a fifth for this
   * would muddy the table for something that has no interesting decision in it
   * — you are converting bulk into bulk. `alts` is what makes it "various
   * materials": whatever you happen to be farming has a route, and the craft
   * takes the first one it can afford, so the cheapest listed goes first.
   *
   * It is meant to be a grind. That is the brake on chromosome expansion.
   */
  histone: {
    id: 'histone',
    name: 'Spool Histones',
    result: { id: 'histone', kind: 'material' },
    cost: [{ id: 'biomatter', qty: 4 }],
    alts: [
      { id: 'gel', cost: [{ id: 'slime_gel', qty: 6 }] },
      { id: 'bone', cost: [{ id: 'bone_dust', qty: 3 }] },
      { id: 'rich', cost: [{ id: 'biomatter', qty: 10 }], qty: 3 },
    ],
    tags: ['geneshaping'],
    ticks: 200,
    xp: 6,
  },

  // ==== HARBOR: recipes (2026-10-30; the harbor builder's section) ====
  // The battery's hold (sea.data.ts SEA), made at the quay on floor 11.
  // Smithing raises the volleys, alchemy the hit. Inputs are ungraded,
  // because a recipe's cost reads the plain counts (crafting.ts affordable).
  ship_cannon: {
    id: 'ship_cannon',
    name: 'Cast a Ship’s Cannon',
    result: { kind: 'material', id: 'ship_cannon' },
    cost: [{ id: 'iron_ingot', qty: 6 }],
    tags: ['smithing'],
    ticks: 600,
    xp: 20,
  },
  cannonball: {
    id: 'cannonball',
    name: 'Cast Cannonballs',
    result: { kind: 'material', id: 'cannonball', qty: 3 },
    cost: [{ id: 'iron_ingot', qty: 1 }],
    tags: ['smithing'],
    ticks: 90,
    xp: 2,
  },
  powder_charge: {
    id: 'powder_charge',
    name: 'Pack Powder Charges',
    result: { kind: 'material', id: 'powder_charge', qty: 2 },
    cost: [
      { id: 'biomatter', qty: 3 },
      { id: 'iron_scrap', qty: 1 },
    ],
    tags: ['alchemy'],
    ticks: 120,
    xp: 3,
  },
};
