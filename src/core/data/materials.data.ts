import type { MaterialDef } from '../types';
import { PREPS, preppedIdOf } from './preps.data';
import { MAIN_GENES, MUTATIONS, NUCLEASES } from './mutagens.data';

/**
 * Stackable materials — dropped by monsters and produced by gather activities.
 * Sell-only for now; crafting arrives in a later milestone.
 */
export const MATERIALS: Record<string, MaterialDef> = {
  biomatter: {
    id: 'biomatter',
    name: 'Mutagenic Biomatter',
    icon: '🩸',
    value: 6,
    desc: 'Still faintly warm. It remembers being something.',
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
    desc: 'Wound protein a strand can be talked into coiling around. Tedious to make, and there is no substitute.',
    craftTags: ['histone'],
    // Ungraded, like biomatter: it is structural bulk, and a grade on it would
    // put a second quality axis in front of the one that matters.
  },
  slime_gel: {
    id: 'slime_gel',
    name: 'Slime Gel',
    icon: '🫧',
    value: 2,
    desc: 'Wobbles indignantly when poked.',
  },
  warm_slime_gel: {
    id: 'warm_slime_gel',
    name: 'Warm Slime Gel',
    icon: '🔥',
    value: 5,
    desc: 'Pleasantly hand-warming. Do not eat.',
    craftTags: ['inlay', 'gel'],
    graded: true,
  },
  chilled_slime_gel: {
    id: 'chilled_slime_gel',
    name: 'Chilled Slime Gel',
    icon: '🧊',
    value: 5,
    desc: 'Stays cold in a closed fist. Fishmongers pay well and ask nothing.',
    craftTags: ['inlay', 'gel'],
    graded: true,
  },
  charged_slime_gel: {
    id: 'charged_slime_gel',
    name: 'Charged Slime Gel',
    icon: '⚡',
    value: 9,
    desc: 'Makes the hair on your arm stand up through the sack.',
    craftTags: ['inlay', 'gel'],
    graded: true,
  },
  luminous_slime_gel: {
    id: 'luminous_slime_gel',
    name: 'Luminous Slime Gel',
    icon: '🔆',
    value: 14,
    desc: 'Lights a room for a night, then politely stops.',
    craftTags: ['inlay', 'gel'],
    graded: true,
  },
  void_slime_gel: {
    id: 'void_slime_gel',
    name: 'Void Slime Gel',
    icon: '🌑',
    value: 18,
    desc: 'Looks like a hole in the palm of your hand. Weighs almost nothing.',
  },
  slime_core: {
    id: 'slime_core',
    name: 'Slime Core',
    icon: '🔮',
    value: 45,
    desc: 'The dense nucleus a slime spends its whole life growing around. Warm, and faintly reluctant.',
  },
  ruined_fur: { id: 'ruined_fur', name: 'Ruined Fur', icon: '🧶', value: 1 },
  torn_fur: { id: 'torn_fur', name: 'Torn Fur', icon: '🧵', value: 3 },
  pristine_fur: { id: 'pristine_fur', name: 'Pristine Fur', icon: '✨', value: 12 },
  common_herb: {
    id: 'common_herb',
    name: 'Common Herb',
    icon: '🌿',
    value: 2,
    desc: 'Smells faintly medicinal.',
    craftTags: ['herb', 'ingredient', 'raw'],
    graded: true,
  },
  hardwood: { id: 'hardwood', name: 'Hardwood', icon: '🪵', value: 4 },
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
    desc: 'Rusted fragments. A forge could make something of these.',
  },
  iron_ingot: {
    id: 'iron_ingot',
    name: 'Iron Ingot',
    icon: '🧱',
    value: 8,
    desc: 'Honest metal, ready for the anvil.',
  },
  boss_token: {
    id: 'boss_token',
    name: 'Boss Token',
    icon: '🪙',
    value: 100,
    desc: 'Proof of a worthy kill. Someone probably trades for these.',
  },
  // ---- Runecarving stock ----
  // Graded materials are stocked per quality (see MaterialDef.graded): a
  // runestone remembers whether it is any good, a lump of scrap does not.
  runestone_blank: {
    id: 'runestone_blank',
    name: 'Blank Runestone',
    icon: '⬜',
    value: 12,
    desc: 'Quarried, squared and waiting. What it becomes is entirely up to you.',
    craftTags: ['runestone'],
    graded: true,
  },
  gold_leaf: {
    id: 'gold_leaf',
    name: 'Gold Leaf',
    icon: '🟡',
    value: 30,
    desc: 'Beaten thin enough to read through. Sticks to everything but the stone.',
    craftTags: ['inlay', 'precious'],
    graded: true,
  },
  cut_garnet: {
    id: 'cut_garnet',
    name: 'Cut Garnet',
    icon: '🔴',
    value: 45,
    desc: 'Small, deep red, and worth more than the sword it ends up in.',
    craftTags: ['gem'],
    graded: true,
  },
  // ---- Pigments, bone, gems and tools ----
  ochre_pigment: {
    id: 'ochre_pigment',
    name: 'Ochre Pigment',
    icon: '🟠',
    value: 8,
    desc: 'Ground earth and oil. Cheap, warm, and it never quite washes off.',
    craftTags: ['pigment'],
    graded: true,
  },
  verdigris_pigment: {
    id: 'verdigris_pigment',
    name: 'Verdigris Pigment',
    icon: '🟢',
    value: 18,
    desc: 'Scraped from old copper. Bites into a cut and stays bitten.',
    craftTags: ['pigment'],
    graded: true,
  },
  bone_dust: {
    id: 'bone_dust',
    name: 'Bone Dust',
    icon: '🦴',
    value: 6,
    desc: 'Ground fine. Fills a cut white and takes colour better than stone does.',
    craftTags: ['inlay', 'bone'],
    graded: true,
  },
  raw_sapphire: {
    id: 'raw_sapphire',
    name: 'Raw Sapphire',
    icon: '🔵',
    value: 60,
    desc: 'Uncut and unhelpful about it. Worth setting into something.',
    craftTags: ['gem'],
    graded: true,
  },
  bronze_chisel: {
    id: 'bronze_chisel',
    name: 'Bronze Chisel',
    icon: '🔨',
    value: 40,
    desc: 'Blunts quickly, but a blunt chisel that is yours beats a sharp one that is not.',
    craftTags: ['carving', 'tool'],
    graded: true,
  },
  steel_burin: {
    id: 'steel_burin',
    name: 'Steel Burin',
    icon: '🖊️',
    value: 140,
    desc: 'Holds an edge through a whole slab. The difference between a rune and a scratch.',
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
    desc: 'Pulls up easy and makes everything taste like something.',
    craftTags: ['vegetable', 'ingredient', 'raw', 'whole'],
    graded: true,
  },
  river_fish: {
    id: 'river_fish',
    name: 'River Fish',
    icon: '🐟',
    value: 4,
    desc: 'Silver, bony, and worth the wet boots.',
    craftTags: ['fish', 'meat', 'ingredient', 'raw', 'whole'],
    graded: true,
  },
  cave_mushroom: {
    id: 'cave_mushroom',
    name: 'Cave Mushroom',
    icon: '🍄',
    value: 5,
    desc: 'Grows where the light does not. Delicious, allegedly.',
    craftTags: ['mushroom', 'vegetable', 'ingredient', 'raw', 'whole'],
    graded: true,
  },
  rock_salt: {
    id: 'rock_salt',
    name: 'Rock Salt',
    icon: '🧂',
    value: 3,
    desc: 'The difference between food and fuel.',
    craftTags: ['seasoning', 'ingredient', 'raw'],
    graded: true,
  },
  rough_flour: {
    id: 'rough_flour',
    name: 'Rough Flour',
    icon: '🌾',
    value: 2,
    desc: 'Stone-milled and honest about it. Two measures make a loaf.',
    craftTags: ['grain', 'ingredient', 'raw'],
    graded: true,
  },
  forest_berries: {
    id: 'forest_berries',
    name: 'Forest Berries',
    icon: '🫐',
    value: 3,
    desc: 'Sweet, staining, and gone by midsummer.',
    craftTags: ['fruit', 'ingredient', 'raw'],
    graded: true,
  },
  bird_egg: {
    id: 'bird_egg',
    name: 'Bird Egg',
    icon: '🥚',
    value: 3,
    desc: 'Still warm from the nest. The owner has opinions.',
    craftTags: ['egg', 'ingredient', 'raw'],
    graded: true,
  },
  wild_honey: {
    id: 'wild_honey',
    name: 'Wild Honey',
    icon: '🍯',
    value: 6,
    desc: 'Paid for in stings. Sweetens anything, forgives nothing owed.',
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
    desc: 'Meat, something green, and an hour of patience.',
    graded: true,
    consumable: {
      useVerb: 'Ate',
      // Sustained: it feeds you across its whole duration rather than at once.
      grants: [{ id: 'well_fed', intensity: 1 }],
    },
  },
  skewered_fish: {
    id: 'skewered_fish',
    name: 'Skewered Fish',
    icon: '🍢',
    value: 12,
    desc: 'Cooked over the fire on a stick. Hard to ruin, easy to burn.',
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
    desc: 'Crust outside, blushing inside. Eaten standing up, usually.',
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
    desc: 'Blackened outside, sweet inside. The coals know best.',
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
    desc: 'Heavy, warm, and the start of half the meals worth having.',
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
    desc: 'A crust with a secret. Stains everyone who cuts it.',
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
    desc: 'Dense with honey and pride. Cut small; it goes further than it looks.',
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
    desc: 'Bread doing what bread was for. Travels better than a stew ever will.',
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
    desc: 'Everything green, and nothing near a flame. The head thanks you.',
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
    desc: 'Dark, earthy, and it makes the head feel clearer than it has any right to.',
    graded: true,
    consumable: {
      useVerb: 'Drank',
      grants: [{ id: 'clear_headed', intensity: 1 }],
    },
  },
  travelers_ration: {
    id: 'travelers_ration',
    name: "Traveler's Ration",
    icon: '🥖',
    value: 8,
    desc: 'Keeps for weeks. Tastes like it intends to.',
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
    desc: 'Everything, on one board, done properly. Somebody knew what they were doing.',
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
    desc: 'It is technically food. Technically.',
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
    desc: 'Herb-thick and stinging. Works the moment it goes on.',
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
    desc: 'Clean enough to be worth carrying. The alembic asks for very little else.',
    craftTags: ['reagent', 'menstruum'],
    graded: true,
  },
  pressed_oil: {
    id: 'pressed_oil',
    name: 'Pressed Oil',
    icon: '🫙',
    value: 8,
    desc: 'Seed-pressed and slow. Whatever is dissolved in it stays where it is put.',
    craftTags: ['reagent', 'menstruum'],
    graded: true,
  },
  grain_spirit: {
    id: 'grain_spirit',
    name: 'Grain Spirit',
    icon: '🍶',
    value: 14,
    desc: 'Distilled past the point of being a drink. It is already looking for a way out.',
    craftTags: ['reagent', 'menstruum'],
    graded: true,
  },
  emberbloom: {
    id: 'emberbloom',
    name: 'Emberbloom',
    icon: '🌺',
    value: 9,
    desc: 'A flower that keeps the afternoon in its petals.',
    craftTags: ['reagent', 'herb', 'essence'],
    graded: true,
  },
  frostmoss: {
    id: 'frostmoss',
    name: 'Frostmoss',
    icon: '🧊',
    value: 9,
    desc: 'Scraped off the north face of anything. Still cold at noon.',
    craftTags: ['reagent', 'herb', 'essence'],
    graded: true,
  },
  nightcap: {
    id: 'nightcap',
    name: 'Nightcap',
    icon: '🍄',
    value: 12,
    desc: 'Wash your hands afterwards. Wash them again.',
    craftTags: ['reagent', 'essence'],
    graded: true,
  },
  gloomcap: {
    id: 'gloomcap',
    name: 'Gloomcap',
    icon: '🌚',
    value: 20,
    desc: 'It grows where light does not reach, and it does not want to leave.',
    craftTags: ['reagent', 'essence'],
    graded: true,
  },
  mendroot: {
    id: 'mendroot',
    name: 'Mendroot',
    icon: '🌱',
    value: 7,
    desc: 'The one plant every field surgeon can name.',
    craftTags: ['reagent', 'herb', 'essence'],
    graded: true,
  },
  bloodwort: {
    id: 'bloodwort',
    name: 'Bloodwort',
    icon: '🌡️',
    value: 11,
    desc: 'Red through the stem. Chewing it is a bad idea with a long history.',
    craftTags: ['reagent', 'herb', 'essence'],
    graded: true,
  },
  thunderbloom: {
    id: 'thunderbloom',
    name: 'Thunderbloom',
    icon: '⚡',
    value: 26,
    desc: 'Picked between the flash and the sound, or not at all.',
    craftTags: ['reagent', 'herb', 'essence'],
    graded: true,
  },
  quicksilver: {
    id: 'quicksilver',
    name: 'Quicksilver',
    icon: '🪙',
    value: 18,
    desc: 'A metal with no opinion about being a metal.',
    craftTags: ['reagent', 'operator'],
    graded: true,
  },
  fixing_salt: {
    id: 'fixing_salt',
    name: 'Fixing Salt',
    icon: '🧂',
    value: 6,
    desc: 'Not the kind for food. It settles arguments in glassware.',
    craftTags: ['reagent', 'operator'],
    graded: true,
  },
  brimstone: {
    id: 'brimstone',
    name: 'Brimstone',
    icon: '🟡',
    value: 16,
    desc: 'Yellow, brittle, and only interested in a brew that is already excited.',
    craftTags: ['reagent', 'operator'],
    graded: true,
  },
  bone_ash: {
    id: 'bone_ash',
    name: 'Bone Ash',
    icon: '🦴',
    value: 10,
    desc: 'Burned white. It has a talent for finding the weakest thing in a jar.',
    craftTags: ['reagent', 'operator'],
    graded: true,
  },
  green_vitriol: {
    id: 'green_vitriol',
    name: 'Green Vitriol',
    icon: '🧪',
    value: 30,
    desc: 'Keep it in glass. It has opinions about everything else.',
    craftTags: ['reagent', 'operator'],
    graded: true,
  },

  iron_pot: {
    id: 'iron_pot',
    name: 'Iron Pot',
    icon: '🍯',
    value: 35,
    desc: 'Heavy, blackened, and it holds heat like a grudge.',
    craftTags: ['cookware', 'tool'],
    graded: true,
  },
  copper_ore: {
    id: 'copper_ore',
    name: 'Copper Ore',
    icon: '📦',
    desc: 'rock containing copper oxides. needs to be smelted to purify the material',
    value: 2,
    craftTags: [],
    graded: false,
  },
  copper_ingot: {
    id: 'copper_ingot',
    name: 'Copper Ingot',
    icon: '🧱',
    desc: 'A soft metal with great thermal and electric conductivity.',
    value: 5,
  },
  tin_ingot: {
    id: 'tin_ingot',
    name: 'Tin Ingot',
    icon: '🧱',
    desc: 'A very soft metal, malleable with a knife.',
    value: 5,
  },
  tin_ore: {
    id: 'tin_ore',
    name: 'Tin Ore',
    icon: '📦',
    desc: 'rock containing tin oxides. needs to be smelted to purify the material',
    value: 2,
    craftTags: [],
    graded: false,
  },
  bronze_ingot: {
    id: 'bronze_ingot',
    name: 'Bronze Ingot',
    icon: '🧱',
    desc: 'A reasonably hard metal capable of cutting wood but too soft to break rock. It contains resonant potential.',
    value: 5,
  },
  leather: { id: 'leather', name: 'Leather', icon: '📦', desc: 'animal skin prepared to be used for leathercrafting', value: 0, craftTags: [], graded: false },
};

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
