import type { MaterialDef } from '../types';
import { PREPS, preppedIdOf } from './preps.data';
import { MAIN_GENES, MUTATIONS, NUCLEASES } from './mutagens.data';
import { prose } from '../text/prose';
import { MATERIALS_TEXT } from '../text/materials.text';

/**
 * Stackable materials — dropped by monsters and produced by gather activities.
 * Sell-only for now; crafting arrives in a later milestone.
 */
export const MATERIALS = prose<MaterialDef>('MATERIALS', MATERIALS_TEXT, {
  biomatter: {
    id: 'biomatter',
    name: 'Mutagenic Biomatter',
    icon: '🩸',
    value: 6,
    craftTags: ['biomatter'],
    // Deliberately UNGRADED. Biomatter is the bulk input refinement burns
    // through, and a grade on it would put a second quality axis in front of
    // the only one that matters — the grade of the gene you are refining.
  },
  histone: {
    id: 'histone',
    name: 'Histone Spool',
    icon: '🧵',
    value: 14,
    craftTags: ['histone'],
    // Ungraded, like biomatter: it is structural bulk, and a grade on it would
    // put a second quality axis in front of the one that matters.
  },
  slime_gel: {
    id: 'slime_gel',
    name: 'Slime Gel',
    icon: '🫧',
    value: 2,
  },
  warm_slime_gel: {
    id: 'warm_slime_gel',
    name: 'Warm Slime Gel',
    icon: '🔥',
    value: 5,
    craftTags: ['inlay', 'gel'],
    graded: true,
  },
  chilled_slime_gel: {
    id: 'chilled_slime_gel',
    name: 'Chilled Slime Gel',
    icon: '🧊',
    value: 5,
    craftTags: ['inlay', 'gel'],
    graded: true,
  },
  charged_slime_gel: {
    id: 'charged_slime_gel',
    name: 'Charged Slime Gel',
    icon: '⚡',
    value: 9,
    craftTags: ['inlay', 'gel'],
    graded: true,
  },
  luminous_slime_gel: {
    id: 'luminous_slime_gel',
    name: 'Luminous Slime Gel',
    icon: '🔆',
    value: 14,
    craftTags: ['inlay', 'gel'],
    graded: true,
  },
  void_slime_gel: {
    id: 'void_slime_gel',
    name: 'Void Slime Gel',
    icon: '🌑',
    value: 18,
  },
  slime_core: {
    id: 'slime_core',
    name: 'Slime Core',
    icon: '🔮',
    value: 45,
  },
  ruined_fur: { id: 'ruined_fur', name: 'Ruined Fur', icon: '🧶', value: 1 },
  torn_fur: { id: 'torn_fur', name: 'Torn Fur', icon: '🧵', value: 3 },
  pristine_fur: { id: 'pristine_fur', name: 'Pristine Fur', icon: '✨', value: 12 },
  common_herb: {
    id: 'common_herb',
    name: 'Common Herb',
    icon: '🌿',
    value: 2,
    craftTags: ['herb', 'ingredient', 'raw'],
    graded: true,
  },
  hardwood: {
    id: 'hardwood',
    name: 'Hardwood',
    icon: '🪵',
    value: 4,
    craftTags: ['wood'],
    smith: { rho: 0.4, hard: 1, tough: 0.45, springy: true, unitCells: 4, label: 'Hardwood' },
  },
  raw_meat: {
    id: 'raw_meat',
    name: 'Raw Meat',
    icon: '🥩',
    value: 3,
    craftTags: ['meat', 'ingredient', 'raw', 'whole'],
    graded: true,
  },
  iron_scrap: {
    id: 'iron_scrap',
    name: 'Iron Scrap',
    icon: '🔩',
    value: 2,
  },
  iron_ingot: {
    id: 'iron_ingot',
    name: 'Iron Ingot',
    icon: '🧱',
    value: 8,
    // The anvil reads these (systems/assembly.ts): parts accept a material by
    // its craftTags, and `smith` is the numbers. Iron is the reference metal.
    craftTags: ['metal', 'iron'],
    smith: { rho: 1, hard: 1, tough: 1, unitCells: 6, label: 'Iron' },
  },
  // TODO: intended: a vendor or quest that trades for boss tokens. Nothing consumes them yet; dropped from the desc.
  boss_token: {
    id: 'boss_token',
    name: 'Boss Token',
    icon: '🪙',
    value: 100,
  },
  // ---- Runecarving stock ----
  // Graded materials are stocked per quality (see MaterialDef.graded): a
  // runestone remembers whether it is any good, a lump of scrap does not.
  runestone_blank: {
    id: 'runestone_blank',
    name: 'Blank Runestone',
    icon: '⬜',
    value: 12,
    craftTags: ['runestone'],
    graded: true,
  },
  gold_leaf: {
    id: 'gold_leaf',
    name: 'Gold Leaf',
    icon: '🟡',
    value: 30,
    craftTags: ['inlay', 'precious'],
    graded: true,
  },
  cut_garnet: {
    id: 'cut_garnet',
    name: 'Cut Garnet',
    icon: '🔴',
    value: 45,
    craftTags: ['gem'],
    graded: true,
  },
  // ---- Pigments, bone, gems and tools ----
  ochre_pigment: {
    id: 'ochre_pigment',
    name: 'Ochre Pigment',
    icon: '🟠',
    value: 8,
    craftTags: ['pigment'],
    graded: true,
  },
  verdigris_pigment: {
    id: 'verdigris_pigment',
    name: 'Verdigris Pigment',
    icon: '🟢',
    value: 18,
    craftTags: ['pigment'],
    graded: true,
  },
  bone_dust: {
    id: 'bone_dust',
    name: 'Bone Dust',
    icon: '🦴',
    value: 6,
    craftTags: ['inlay', 'bone'],
    graded: true,
  },
  raw_sapphire: {
    id: 'raw_sapphire',
    name: 'Raw Sapphire',
    icon: '🔵',
    value: 60,
    craftTags: ['gem'],
    graded: true,
  },
  bronze_chisel: {
    id: 'bronze_chisel',
    name: 'Bronze Chisel',
    icon: '🔨',
    value: 40,
    craftTags: ['carving', 'tool'],
    graded: true,
  },
  steel_burin: {
    id: 'steel_burin',
    name: 'Steel Burin',
    icon: '🖊️',
    value: 140,
    craftTags: ['carving', 'tool'],
    graded: true,
  },
  // ---- Cooking: ingredients ----
  // `raw` is food as found; the hot benches accept nothing else. `ingredient`
  // is anything edible enough to build with, which cooked products keep — the
  // split is what lets bread go onto the counter but never back into the pot.
  wild_onion: {
    id: 'wild_onion',
    name: 'Wild Onion',
    icon: '🧅',
    value: 2,
    craftTags: ['vegetable', 'ingredient', 'raw', 'whole'],
    graded: true,
  },
  river_fish: {
    id: 'river_fish',
    name: 'River Fish',
    icon: '🐟',
    value: 4,
    craftTags: ['fish', 'meat', 'ingredient', 'raw', 'whole'],
    graded: true,
  },
  cave_mushroom: {
    id: 'cave_mushroom',
    name: 'Cave Mushroom',
    icon: '🍄',
    value: 5,
    craftTags: ['mushroom', 'vegetable', 'ingredient', 'raw', 'whole'],
    graded: true,
  },
  rock_salt: {
    id: 'rock_salt',
    name: 'Rock Salt',
    icon: '🧂',
    value: 3,
    craftTags: ['seasoning', 'ingredient', 'raw'],
    graded: true,
  },
  rough_flour: {
    id: 'rough_flour',
    name: 'Rough Flour',
    icon: '🌾',
    value: 2,
    craftTags: ['grain', 'ingredient', 'raw'],
    graded: true,
  },
  forest_berries: {
    id: 'forest_berries',
    name: 'Forest Berries',
    icon: '🫐',
    value: 3,
    craftTags: ['fruit', 'ingredient', 'raw'],
    graded: true,
  },
  bird_egg: {
    id: 'bird_egg',
    name: 'Bird Egg',
    icon: '🥚',
    value: 3,
    craftTags: ['egg', 'ingredient', 'raw'],
    graded: true,
  },
  wild_honey: {
    id: 'wild_honey',
    name: 'Wild Honey',
    icon: '🍯',
    value: 6,
    craftTags: ['sweet', 'seasoning', 'ingredient', 'raw'],
    graded: true,
  },

  // ---- Cooking: dishes ----
  // Dishes are graded materials with a `consumable` spec, so they stack, sell
  // and sit in stock like anything else — and a dish cooked from better
  // ingredients is simply a better grade of the same dish.
  hearty_stew: {
    id: 'hearty_stew',
    name: 'Hearty Stew',
    icon: '🍲',
    value: 14,
    graded: true,
    consumable: {
      useVerb: 'Ate',
      // Sustained: it feeds you across its whole duration rather than at once.
      grants: [{ id: 'well_fed', intensity: 1 }],
    },
  },
  // The fourth floor 6 sabotage (bands-2-3.md): the meal cooked for the
  // warchief, found in his larder and eaten by the player instead. Not
  // cookable yet; a find is its only source.
  warchiefs_roast: {
    id: 'warchiefs_roast',
    name: 'Warchief’s Roast',
    icon: '🍖',
    value: 40,
    graded: true,
    consumable: {
      useVerb: 'Ate',
      grants: [{ id: 'well_fed', intensity: 2 }, { id: 'steady_hand', intensity: 1 }],
    },
  },
  skewered_fish: {
    id: 'skewered_fish',
    name: 'Skewered Fish',
    icon: '🍢',
    value: 12,
    // `cooked` + `filling` is what lets a finished dish walk onto the prep
    // counter as an ingredient — the grill feeds the sandwich.
    craftTags: ['filling', 'ingredient', 'cooked'],
    graded: true,
    consumable: {
      useVerb: 'Ate',
      grants: [{ id: 'steady_hand', intensity: 1 }],
    },
  },
  seared_steak: {
    id: 'seared_steak',
    name: 'Seared Steak',
    icon: '🥩',
    value: 15,
    craftTags: ['filling', 'ingredient', 'cooked'],
    graded: true,
    consumable: {
      useVerb: 'Ate',
      grants: [{ id: 'well_fed', intensity: 1 }, { id: 'steady_hand', intensity: 0.5 }],
    },
  },
  charred_roots: {
    id: 'charred_roots',
    name: 'Charred Roots',
    icon: '🍠',
    value: 10,
    craftTags: ['ingredient', 'cooked'],
    graded: true,
    consumable: {
      useVerb: 'Ate',
      grants: [{ id: 'well_fed', intensity: 0.75 }],
    },
  },
  rustic_loaf: {
    id: 'rustic_loaf',
    name: 'Rustic Loaf',
    icon: '🍞',
    value: 10,
    // Bread is the hinge of the kitchen: a dish in its own right, and the
    // foundation the counter builds on.
    craftTags: ['bread', 'ingredient', 'cooked'],
    graded: true,
    consumable: {
      useVerb: 'Ate',
      grants: [{ id: 'well_fed', intensity: 0.6 }],
    },
  },
  berry_pie: {
    id: 'berry_pie',
    name: 'Berry Pie',
    icon: '🥧',
    value: 18,
    graded: true,
    consumable: {
      useVerb: 'Ate',
      grants: [{ id: 'well_fed', intensity: 1 }],
    },
  },
  honey_cake: {
    id: 'honey_cake',
    name: 'Honey Cake',
    icon: '🍰',
    value: 28,
    graded: true,
    consumable: {
      useVerb: 'Ate',
      grants: [{ id: 'clear_headed', intensity: 1 }, { id: 'well_fed', intensity: 0.5 }],
    },
  },
  hearty_sandwich: {
    id: 'hearty_sandwich',
    name: 'Hearty Sandwich',
    icon: '🥪',
    value: 24,
    graded: true,
    consumable: {
      useVerb: 'Ate',
      grants: [{ id: 'well_fed', intensity: 1 }, { id: 'steady_hand', intensity: 0.75 }],
    },
  },
  forest_salad: {
    id: 'forest_salad',
    name: 'Forest Salad',
    icon: '🥗',
    value: 12,
    graded: true,
    consumable: {
      useVerb: 'Ate',
      grants: [{ id: 'clear_headed', intensity: 0.5 }, { id: 'well_fed', intensity: 0.5 }],
    },
  },
  mushroom_broth: {
    id: 'mushroom_broth',
    name: 'Mushroom Broth',
    icon: '🍵',
    value: 16,
    graded: true,
    consumable: {
      useVerb: 'Drank',
      grants: [{ id: 'clear_headed', intensity: 1 }],
    },
  },
  // Learned dishes (the stove's recipe outcomes) and the cards that teach
  // them. Cards are read, not eaten (ConsumableSpec.teaches), and ungraded.
  herb_rubbed_meat: {
    id: 'herb_rubbed_meat',
    name: 'Herb-Rubbed Meat',
    icon: '🍖',
    value: 16,
    graded: true,
    consumable: {
      useVerb: 'Ate',
      restore: [{ resource: 'hp', ofMax: 0.15 }],
      grants: [{ id: 'well_fed', intensity: 1 }],
    },
  },
  fish_onion_pot: {
    id: 'fish_onion_pot',
    name: 'Fish and Onion Pot',
    icon: '🐟',
    value: 22,
    graded: true,
    consumable: {
      useVerb: 'Ate',
      grants: [{ id: 'well_fed', intensity: 1 }, { id: 'steady_hand', intensity: 0.75 }],
    },
  },
  lectory_porridge: {
    id: 'lectory_porridge',
    name: 'Lectory Porridge',
    icon: '🥣',
    value: 30,
    graded: true,
    consumable: {
      useVerb: 'Ate',
      grants: [{ id: 'clear_headed', intensity: 1.5 }, { id: 'well_fed', intensity: 0.5 }],
    },
  },
  recipe_herb_rubbed_meat: {
    id: 'recipe_herb_rubbed_meat',
    name: 'Recipe: Herb-Rubbed Meat',
    icon: '📜',
    value: 15,
    consumable: { useVerb: 'Read', teaches: 'herb_rubbed_meat' },
  },
  recipe_fish_onion_pot: {
    id: 'recipe_fish_onion_pot',
    name: 'Recipe: Fish and Onion Pot',
    icon: '📜',
    value: 30,
    consumable: { useVerb: 'Read', teaches: 'fish_onion_pot' },
  },
  recipe_lectory_porridge: {
    id: 'recipe_lectory_porridge',
    name: 'Recipe: Lectory Porridge',
    icon: '📜',
    value: 60,
    consumable: { useVerb: 'Read', teaches: 'lectory_porridge' },
  },
  // District rare finds (ActivityDef.drops). Cards are read or offered for a
  // one-time effect (ConsumableSpec), ungraded, and unmarked in play.
  word_slip_stone: {
    id: 'word_slip_stone',
    name: 'Word Slip: Stone',
    icon: '📝',
    value: 40,
    consumable: { useVerb: 'Read', unlocksWord: 'stone' },
  },
  votive_token: {
    id: 'votive_token',
    name: 'Votive Token',
    icon: '🕯️',
    value: 25,
    consumable: { useVerb: 'Offer', votive: true },
  },
  drill_manual_riposte: {
    id: 'drill_manual_riposte',
    name: 'Drill Manual: Riposte',
    icon: '📘',
    value: 40,
    consumable: { useVerb: 'Study', teachesTechnique: 'riposte' },
  },
  chancery_price_seal: {
    id: 'chancery_price_seal',
    name: 'Chancery Price Seal',
    icon: '🔏',
    value: 50,
    consumable: { useVerb: 'Register', stamps: 'flag:chancery_seal' },
  },
  unclaimed_case_file: {
    id: 'unclaimed_case_file',
    name: 'Unclaimed Case File',
    icon: '📁',
    value: 20,
    consumable: { useVerb: 'Read', stamps: 'flag:assize_case_file' },
  },
  smiths_pattern_bronze: {
    id: 'smiths_pattern_bronze',
    name: "Smith's Pattern: Bronze",
    icon: '📐',
    value: 45,
    consumable: { useVerb: 'Study', stamps: 'flag:pattern_bronze' },
  },
  travelers_ration: {
    id: 'travelers_ration',
    name: "Traveler's Ration",
    icon: '🥖',
    value: 8,
    graded: true,
    consumable: {
      useVerb: 'Ate',
      grants: [{ id: 'well_fed', intensity: 0.5 }],
    },
  },
  feast_platter: {
    id: 'feast_platter',
    name: 'Feast Platter',
    icon: '🍖',
    value: 60,
    graded: true,
    consumable: {
      useVerb: 'Feasted on',
      // The S-tier dish does both: a slug of health now AND the long buff.
      restore: [{ resource: 'hp', ofMax: 0.25 }],
      grants: [{ id: 'well_fed', intensity: 2 }, { id: 'steady_hand', intensity: 1.5 }],
    },
  },
  scorched_mess: {
    id: 'scorched_mess',
    name: 'Scorched Mess',
    icon: '🥘',
    value: 1,
    graded: true,
    consumable: {
      useVerb: 'Choked down',
      grants: [{ id: 'queasy', intensity: 1 }],
    },
  },

  // ---- Alchemy-adjacent: an instant for contrast ----
  healing_salve: {
    id: 'healing_salve',
    name: 'Healing Salve',
    icon: '🧴',
    value: 25,
    graded: true,
    consumable: {
      useVerb: 'Applied',
      // Instant: the whole effect at once, and it counts as real treatment,
      // so it closes the wounds that only treatment closes.
      restore: [{ resource: 'hp', flat: 25, ofMax: 0.1 }],
      cooldown: 100,
    },
  },
  // ---- Alchemy: reagents ----
  //
  // Ordinary graded stock carrying the `reagent` tag; what each one DOES in the
  // alembic lives in data/alchemy.data.ts, so a thing can be a herb, an inlay
  // and a reagent at once without any of those knowing about the others.

  spring_water: {
    id: 'spring_water',
    name: 'Spring Water',
    icon: '💧',
    value: 2,
    craftTags: ['reagent', 'menstruum'],
    graded: true,
  },
  pressed_oil: {
    id: 'pressed_oil',
    name: 'Pressed Oil',
    icon: '🫙',
    value: 8,
    craftTags: ['reagent', 'menstruum'],
    graded: true,
  },
  grain_spirit: {
    id: 'grain_spirit',
    name: 'Grain Spirit',
    icon: '🍶',
    value: 14,
    craftTags: ['reagent', 'menstruum'],
    graded: true,
  },
  emberbloom: {
    id: 'emberbloom',
    name: 'Emberbloom',
    icon: '🌺',
    value: 9,
    craftTags: ['reagent', 'herb', 'essence'],
    graded: true,
  },
  frostmoss: {
    id: 'frostmoss',
    name: 'Frostmoss',
    icon: '🧊',
    value: 9,
    craftTags: ['reagent', 'herb', 'essence'],
    graded: true,
  },
  nightcap: {
    id: 'nightcap',
    name: 'Nightcap',
    icon: '🍄',
    value: 12,
    craftTags: ['reagent', 'essence'],
    graded: true,
  },
  gloomcap: {
    id: 'gloomcap',
    name: 'Gloomcap',
    icon: '🌚',
    value: 20,
    craftTags: ['reagent', 'essence'],
    graded: true,
  },
  mendroot: {
    id: 'mendroot',
    name: 'Mendroot',
    icon: '🌱',
    value: 7,
    craftTags: ['reagent', 'herb', 'essence'],
    graded: true,
  },
  bloodwort: {
    id: 'bloodwort',
    name: 'Bloodwort',
    icon: '🌡️',
    value: 11,
    craftTags: ['reagent', 'herb', 'essence'],
    graded: true,
  },
  thunderbloom: {
    id: 'thunderbloom',
    name: 'Thunderbloom',
    icon: '⚡',
    value: 26,
    craftTags: ['reagent', 'herb', 'essence'],
    graded: true,
  },
  quicksilver: {
    id: 'quicksilver',
    name: 'Quicksilver',
    icon: '🪙',
    value: 18,
    craftTags: ['reagent', 'operator'],
    graded: true,
  },
  fixing_salt: {
    id: 'fixing_salt',
    name: 'Fixing Salt',
    icon: '🧂',
    value: 6,
    craftTags: ['reagent', 'operator'],
    graded: true,
  },
  brimstone: {
    id: 'brimstone',
    name: 'Brimstone',
    icon: '🟡',
    value: 16,
    craftTags: ['reagent', 'operator'],
    graded: true,
  },
  bone_ash: {
    id: 'bone_ash',
    name: 'Bone Ash',
    icon: '🦴',
    value: 10,
    craftTags: ['reagent', 'operator'],
    graded: true,
  },
  green_vitriol: {
    id: 'green_vitriol',
    name: 'Green Vitriol',
    icon: '🧪',
    value: 30,
    craftTags: ['reagent', 'operator'],
    graded: true,
  },

  iron_pot: {
    id: 'iron_pot',
    name: 'Iron Pot',
    icon: '🍯',
    value: 35,
    craftTags: ['cookware', 'tool'],
    graded: true,
  },
  copper_ore: {
    id: 'copper_ore',
    name: 'Copper Ore',
    icon: '📦',
    value: 2,
    craftTags: [],
    graded: false,
  },
  copper_ingot: {
    id: 'copper_ingot',
    name: 'Copper Ingot',
    icon: '🧱',
    value: 5,
  },
  tin_ingot: {
    id: 'tin_ingot',
    name: 'Tin Ingot',
    icon: '🧱',
    value: 5,
  },
  tin_ore: {
    id: 'tin_ore',
    name: 'Tin Ore',
    icon: '📦',
    value: 2,
    craftTags: [],
    graded: false,
  },
  bronze_ingot: {
    id: 'bronze_ingot',
    name: 'Bronze Ingot',
    icon: '🧱',
    value: 5,
    craftTags: ['metal', 'bronze'],
    smith: {
      rho: 1.1,
      hard: 0.9,
      tough: 0.9,
      unitCells: 6,
      label: 'Bronze',
      // The metal's own will, which bronze_dagger carries as well (items.data.ts):
      // it biases the psionic quantities. A forged piece with a bronze head
      // carries it once, whatever the head's size.
      mods: [
        { value: 0.15, stat: 'psiAcuity', op: 'mult' },
        { value: 0.1, stat: 'psiCoherence', op: 'mult' },
      ],
    },
  },
  leather: {
    id: 'leather',
    name: 'Leather',
    icon: '📦',
    value: 0,
    craftTags: ['leather'],
    graded: false,
    smith: { rho: 0.3, hard: 0, tough: 0.5, unitCells: 3, label: 'Leather' },
  },
});

/*
 * ---- Cooking: prepped variants, generated ----
 *
 * Every `whole`-tagged ingredient gets one variant per knife technique. A
 * prepped variant keeps its base's tags (minus `whole` — no re-cutting a cut)
 * and adds the technique's tag plus `prepped`. Its stocked GRADE is the cut
 * grade — how uniform the work is — not the ingredient's freshness; see
 * data/preps.data.ts for what that means at dish time.
 *
 * Generated rather than written out so that opting an ingredient into knife
 * work stays a one-tag change.
 */
for (const base of Object.values(MATERIALS).filter((m) => m.craftTags?.includes('whole'))) {
  for (const prep of Object.values(PREPS)) {
    const id = preppedIdOf(base.id, prep.id);
    MATERIALS[id] = {
      id,
      name: `${prep.prefix} ${base.name}`,
      icon: base.icon,
      value: base.value + 1,
      desc: `${base.name}, ${prep.prefix.toLowerCase()} and ready. The grade is the knife work.`,
      craftTags: [
        ...(base.craftTags ?? []).filter((t) => t !== 'whole'),
        prep.tag,
        'prepped',
      ],
      graded: true,
    };
  }
}

/*
 * ---- Mutagens: genes and mutations, generated ----
 *
 * A gene IS a graded stackable thing, so it is a material — which means stock,
 * grading, drops, the bench's slot pickers, selling and the debug tools all
 * work on it without a line of special-casing. What a gene MEANS still lives in
 * mutagens.data.ts; this is only its existence as an object you can hold.
 *
 * Generated rather than written out twice so the gene list has exactly one
 * source. Adding a species' gene stays a single entry in MAIN_GENES.
 */
for (const gene of Object.values(MAIN_GENES)) {
  // Bare is the FLOOR, not an item: an empty centromere already expresses it
  // (see `expressedMain`). Making it holdable too would mean an object that is
  // strictly worse than the default it duplicates, and a slot you could fill
  // to no effect.
  if (gene.genus === 'bare') continue;
  MATERIALS[gene.id] = {
    id: gene.id,
    name: gene.name,
    icon: gene.icon,
    // Worth roughly what it can do, so selling a jötunn gene stings properly.
    value: 20 + Math.round(gene.flatBase / 4),
    desc: `Recovered whole. It still knows how to be a ${gene.name.replace(/ Gene$/, '').toLowerCase()}.`,
    craftTags: ['gene'],
    graded: true,
  };
}

for (const mutagen of Object.values(MUTATIONS)) {
  MATERIALS[mutagen.id] = {
    id: mutagen.id,
    name: mutagen.name,
    icon: mutagen.icon,
    value: mutagen.rekey ? 40 : 15,
    desc: mutagen.rekey
      ? 'A fragment carrying an instruction rather than an opinion — it rewrites what it is fused to.'
      : 'A fragment with an opinion about what a body should do.',
    craftTags: ['mutagen'],
    graded: true,
  };
}

/**
 * Nucleases: held, dropped and sold like anything else, but GRADELESS.
 *
 * Grade scales magnitude and a nuclease has none, so a graded one would cost
 * more capacity for exactly nothing — the trap mutagen quality itself was in
 * before it was fixed (docs/MUTAGENS.md §9). Ungraded, stock simply counts them.
 */
for (const nuclease of Object.values(NUCLEASES)) {
  MATERIALS[nuclease.id] = {
    id: nuclease.id,
    name: nuclease.name,
    icon: nuclease.icon,
    value: 60,
    desc: nuclease.desc,
    craftTags: ['nuclease'],
  };
}
