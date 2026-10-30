import type { CraftDisciplineDef } from '../types';
import { prose } from '../text/prose';
import { DISCIPLINES_TEXT } from '../text/disciplines.text';

/**
 * Modular crafting disciplines.
 *
 * Each entry is a bench: the slots it offers, what those slots accept, and what
 * combinations produce. The engine (systems/disciplines.ts) knows none of the
 * specifics — adding alchemy, mutagens or spellcrafting later means adding an
 * entry here and a system that knows what its results MEAN, not touching the
 * framework.
 *
 * A discipline names the `skill` that gates and scales it. That is the only
 * link between the two: the discipline is what can be made, the skill is how
 * good you are at making it. Sharing an id (runecarving/runecarving) is a
 * convenience — nothing stops a `mutagens` bench running on an `alchemy` skill.
 */
export const DISCIPLINES = prose<CraftDisciplineDef>('DISCIPLINES', DISCIPLINES_TEXT, {
  mutagens: {
    id: 'mutagens',
    name: 'Geneshaping',
    benchName: 'Culture Bench',
    icon: '🧫',
    verb: 'Refine',
    skill: 'geneshaping',
    tag: 'geneshaping',
    // Slow on purpose: refinement is the loop a player advances on for the
    // whole game, so a single push should be felt rather than clicked through.
    ticks: 240,
    xp: 10,
    refines: true,
    slots: [
      {
        id: 'subject',
        name: 'Subject',
        role: 'base',
        // Genes and mutagens both refine; nothing else does.
        accepts: ['gene', 'mutagen'],
        station: 'centre',
      },
    ],
    // Nothing to match: a refining bench hands back its own subject, so the
    // outcome table that decides WHAT a craft produces has no work to do here.
    outcomes: [],
  },
  runecarving: {
    id: 'runecarving',
    name: 'Runecarving',
    benchName: 'Rune Table',
    icon: '💎',
    skill: 'runecarving',
    tag: 'runecarving',
    ticks: 60,
    xp: 12,
    /*
     * The bench, laid out as the carver sees it: the slab in the middle with
     * its rune cuts, and four stations around it. `station` is purely where the
     * UI draws each one — the engine cares only about `picks` and `accepts`.
     */
    slots: [
      {
        // The slab itself. Everything else is worked into it.
        id: 'slab',
        name: 'Rune Slab',
        role: 'base',
        accepts: ['runestone'],
        station: 'centre',
      },
      {
        // The first cut. A carver can manage one from the very beginning.
        id: 'rune1',
        name: 'First Rune',
        role: 'component',
        picks: 'design',
        accepts: ['pattern'],
        station: 'centre',
      },
      {
        id: 'rune2',
        name: 'Second Rune',
        role: 'component',
        picks: 'design',
        accepts: ['pattern'],
        optional: true,
        unlockLevel: 10,
        station: 'centre',
      },
      {
        id: 'rune3',
        name: 'Third Rune',
        role: 'component',
        picks: 'design',
        accepts: ['pattern'],
        optional: true,
        unlockLevel: 25,
        station: 'centre',
      },
      {
        // Anything soft enough to press into a cut: metals, gels, bone.
        id: 'inlay',
        name: 'Inlay',
        role: 'adornment',
        accepts: ['inlay'],
        optional: true,
        station: 'topLeft',
      },
      {
        id: 'color',
        name: 'Color',
        role: 'adornment',
        accepts: ['pigment'],
        optional: true,
        station: 'topRight',
      },
      {
        // Gemstones only, and never more than two — a third crowds the slab.
        id: 'gem1',
        name: 'Adornment',
        role: 'adornment',
        accepts: ['gem'],
        optional: true,
        station: 'bottomLeft',
      },
      {
        id: 'gem2',
        name: 'Second Adornment',
        role: 'adornment',
        accepts: ['gem'],
        optional: true,
        station: 'bottomLeft',
      },
      {
        // Worked WITH, not into: a tool is never spent (`consumed: false`).
        id: 'tool',
        name: 'Carving Tool',
        role: 'component',
        picks: 'tool',
        accepts: ['carving'],
        optional: true,
        consumed: false,
        station: 'bottomRight',
      },
    ],
    /*
     * Runecarving has one outcome shape — a slab with cuts in it. The variety
     * lives in the PATTERNS and what is worked into them, not in a list of
     * results. Cooking will use the same machinery the other way round: many
     * outcomes, matched on which ingredients went in.
     */
    outcomes: [
      {
        id: 'carve',
        name: 'Carved Rune',
        icon: '🔷',
        requires: [{ tag: 'runestone' }],
        result: { kind: 'carved', pattern: '' },
      },
    ],
  },

  /*
   * ---------- Cooking ----------
   *
   * Cooking is the other shape the framework supports. Runecarving has one
   * outcome and all its variety in the parts; cooking has MANY outcomes and
   * finds the right one by looking at what went in the pot. Same machinery,
   * read from the other end.
   *
   * It is also not one bench but a kitchen of them — stove, oven, grill,
   * counter — all running on the one `cooking` skill. Two tags divide the
   * pantry between them: `raw` is food as found, `cooked` is food already
   * made. The hot benches take only `raw` (nobody stews a sandwich); the
   * counter takes anything edible, which is what lets wheat become bread
   * become lunch.
   */
  cooking: {
    id: 'cooking',
    name: 'Cooking',
    benchName: 'Cooking Stove',
    icon: '🍳',
    verb: 'Cook',
    skill: 'cooking',
    tag: 'cooking',
    favoredPrep: 'diced',
    /*
     * The stove is the first TIMED bench: the pot simmers for a chosen number
     * of units, and each ingredient slot is an entry point along the way. An
     * ingredient's exposure is duration × (1 − at) — so the same basket laid
     * out differently, or simmered longer, is a different dish. This is
     * cooking's own axis: runecarving composes in space, the stove in time.
     */
    timeline: {
      options: [
        { units: 8, name: 'Quick simmer' },
        { units: 12, name: 'Steady stew' },
        { units: 16, name: 'Long braise' },
      ],
      default: 12,
    },
    // The pot answers to the clock, not the cook: a 12-unit stew takes 12
    // units of real time whoever stirs it. Skill buys judgement, not haste.
    work: { skillScaled: false },
    ticks: 40,
    xp: 10,
    // Starts at two entry points and widens, which is a number in a slot and
    // nothing more.
    slots: [
      {
        id: 'main',
        name: 'First Into the Pot',
        role: 'base',
        accepts: ['raw'],
        station: 'centre',
        at: 0,
      },
      {
        id: 'second',
        name: 'Added Midway',
        role: 'component',
        accepts: ['raw'],
        station: 'centre',
        at: 0.33,
      },
      {
        id: 'third',
        name: 'Late Addition',
        role: 'component',
        accepts: ['raw'],
        optional: true,
        unlockLevel: 8,
        station: 'topLeft',
        at: 0.66,
      },
      {
        id: 'fourth',
        name: 'Finishing Touch',
        role: 'component',
        accepts: ['raw'],
        optional: true,
        unlockLevel: 20,
        station: 'topRight',
        at: 0.9,
      },
      {
        id: 'seasoning',
        name: 'Seasoning',
        role: 'adornment',
        accepts: ['seasoning'],
        optional: true,
        station: 'bottomLeft',
      },
      {
        id: 'pot',
        name: 'Cookware',
        role: 'component',
        picks: 'tool',
        accepts: ['cookware'],
        optional: true,
        consumed: false,
        station: 'bottomRight',
      },
    ],
    /*
     * Matched most-specific-first. A pot with meat and a vegetable is a stew; add
     * seasoning to fine ingredients and it is a feast. The last entry is the
     * catch-all, so there is always SOMETHING to eat — even if it is only
     * technically food.
     */
    outcomes: [
      {
        id: 'feast',
        name: 'Feast Platter',
        icon: '🍖',
        requires: [{ tag: 'meat' }, { tag: 'vegetable' }, { tag: 'seasoning' }],
        minQuality: 'a',
        minLevel: 20,
        priority: 40,
        result: { kind: 'material', id: 'feast_platter' },
      },
      {
        id: 'stew',
        name: 'Hearty Stew',
        icon: '🍲',
        requires: [{ tag: 'meat' }, { tag: 'vegetable' }],
        priority: 20,
        result: { kind: 'material', id: 'hearty_stew' },
      },
      {
        id: 'broth',
        name: 'Mushroom Broth',
        icon: '🍵',
        requires: [{ tag: 'mushroom' }, { tag: 'herb' }],
        priority: 25,
        result: { kind: 'material', id: 'mushroom_broth' },
      },
      // Learned dishes (CraftOutcomeDef.recipe): matched only once their
      // recipe card has been read. All but Lectory Porridge are sold at the
      // Larder Door; the porridge only turns up while reading in the Reading
      // Hall.
      {
        id: 'herb_rubbed_meat',
        name: 'Herb-Rubbed Meat',
        icon: '🍖',
        recipe: 'herb_rubbed_meat',
        requires: [{ tag: 'meat' }, { tag: 'herb' }],
        priority: 30,
        result: { kind: 'material', id: 'herb_rubbed_meat' },
      },
      {
        id: 'fish_onion_pot',
        name: 'Fish and Onion Pot',
        icon: '🐟',
        recipe: 'fish_onion_pot',
        requires: [{ tag: 'fish' }, { tag: 'vegetable' }],
        priority: 30,
        result: { kind: 'material', id: 'fish_onion_pot' },
      },
      {
        id: 'lectory_porridge',
        name: 'Lectory Porridge',
        icon: '🥣',
        recipe: 'lectory_porridge',
        requires: [{ tag: 'grain' }, { tag: 'sweet' }],
        priority: 30,
        result: { kind: 'material', id: 'lectory_porridge' },
      },
      /*
       * Windowed dishes (CraftOutcomeDef.heat): the clock picks the dish. Each
       * needs the same tags as the window-less dish below it (Hearty Stew,
       * Mushroom Broth), sits just above it in priority, and needs its
       * recipe card, so a cook without the card, or outside the window, makes
       * exactly what the same basket always made. Exposure is duration ×
       * (1 − slot.at): at level 1 the first slot sees the whole 8/12/16 and the
       * midway slot (0.33) sees 5.4/8.0/10.7. Linted in both layers
       * (heatWindowProblems).
       */
      {
        // Meat in midway on a Quick simmer: 5.4 units.
        id: 'seared_stew',
        name: 'Seared Stew',
        icon: '🍛',
        recipe: 'seared_stew',
        requires: [{ tag: 'meat' }, { tag: 'vegetable' }],
        heat: [{ tag: 'meat', to: 6 }],
        priority: 22,
        result: { kind: 'material', id: 'seared_stew' },
      },
      {
        // Meat in first on a Long braise: 16 units.
        id: 'braised_meat',
        name: 'Braised Meat',
        icon: '🍗',
        recipe: 'braised_meat',
        requires: [{ tag: 'meat' }, { tag: 'vegetable' }],
        heat: [{ tag: 'meat', from: 14 }],
        priority: 22,
        result: { kind: 'material', id: 'braised_meat' },
      },
      {
        // Herb in first on any simmer: 8, 12 or 16 units.
        id: 'steeped_broth',
        name: 'Steeped Broth',
        icon: '🫖',
        recipe: 'steeped_broth',
        requires: [{ tag: 'mushroom' }, { tag: 'herb' }],
        heat: [{ tag: 'herb', from: 8 }],
        priority: 27,
        result: { kind: 'material', id: 'steeped_broth' },
      },
      {
        id: 'ration',
        name: "Traveler's Ration",
        icon: '🥖',
        requires: [{ tag: 'ingredient', count: 2 }],
        priority: 5,
        result: { kind: 'material', id: 'travelers_ration' },
      },
      {
        /*
         * What a genuinely awful basket makes. Reachable because of
         * `maxQuality`: if the BEST thing in the pot is refuse, no amount of
         * technique makes it a stew. Highest priority for the same reason —
         * rubbish in, rubbish out, whatever else happens to match.
         */
        id: 'mess',
        name: 'Scorched Mess',
        icon: '🥘',
        requires: [{ tag: 'ingredient' }],
        maxQuality: 'f',
        priority: 100,
        result: { kind: 'material', id: 'scorched_mess' },
      },
    ],
  },

  grilling: {
    id: 'grilling',
    name: 'Grilling',
    benchName: 'Open Grill',
    icon: '🍢',
    verb: 'Grill',
    skill: 'cooking',
    tag: 'cooking',
    favoredPrep: 'julienned',
    // The coals set the pace, not the cook.
    work: { skillScaled: false },
    ticks: 30,
    xp: 8,
    // The grill's identity is directness: one required slot, everything else
    // optional. It is where a single fine ingredient goes to stay itself.
    slots: [
      {
        id: 'main',
        name: 'On the Grate',
        role: 'base',
        accepts: ['raw'],
        station: 'centre',
      },
      {
        id: 'second',
        name: 'Alongside',
        role: 'component',
        accepts: ['raw'],
        optional: true,
        station: 'centre',
      },
      {
        id: 'glaze',
        name: 'Glaze',
        role: 'adornment',
        accepts: ['seasoning'],
        optional: true,
        station: 'bottomLeft',
      },
    ],
    outcomes: [
      {
        id: 'skewer',
        name: 'Skewered Fish',
        icon: '🍢',
        requires: [{ tag: 'fish' }],
        priority: 20,
        result: { kind: 'material', id: 'skewered_fish' },
      },
      {
        id: 'steak',
        name: 'Seared Steak',
        icon: '🥩',
        requires: [{ tag: 'meat' }],
        priority: 15,
        result: { kind: 'material', id: 'seared_steak' },
      },
      {
        id: 'roots',
        name: 'Charred Roots',
        icon: '🍠',
        requires: [{ tag: 'vegetable', count: 2 }],
        priority: 15,
        result: { kind: 'material', id: 'charred_roots' },
      },
      {
        id: 'ration',
        name: "Traveler's Ration",
        icon: '🥖',
        requires: [{ tag: 'ingredient' }],
        priority: 5,
        result: { kind: 'material', id: 'travelers_ration' },
      },
      {
        id: 'mess',
        name: 'Scorched Mess',
        icon: '🥘',
        requires: [{ tag: 'ingredient' }],
        maxQuality: 'f',
        priority: 100,
        result: { kind: 'material', id: 'scorched_mess' },
      },
    ],
  },

  baking: {
    id: 'baking',
    name: 'Baking',
    benchName: 'Clay Oven',
    icon: '🍞',
    verb: 'Bake',
    skill: 'cooking',
    tag: 'cooking',
    // The oven door stays shut for as long as the oven door stays shut.
    work: { skillScaled: false },
    ticks: 50,
    xp: 11,
    slots: [
      {
        id: 'main',
        name: 'First Measure',
        role: 'base',
        accepts: ['raw'],
        station: 'centre',
      },
      {
        id: 'second',
        name: 'Second Measure',
        role: 'component',
        accepts: ['raw'],
        station: 'centre',
      },
      {
        id: 'third',
        name: 'Third Measure',
        role: 'component',
        accepts: ['raw'],
        optional: true,
        unlockLevel: 10,
        station: 'topLeft',
      },
      {
        id: 'sweetening',
        name: 'Sweetening',
        role: 'adornment',
        accepts: ['seasoning'],
        optional: true,
        station: 'bottomLeft',
      },
    ],
    outcomes: [
      {
        id: 'cake',
        name: 'Honey Cake',
        icon: '🍰',
        requires: [{ tag: 'grain' }, { tag: 'sweet' }, { tag: 'egg' }],
        minLevel: 12,
        priority: 30,
        result: { kind: 'material', id: 'honey_cake' },
      },
      {
        id: 'pie',
        name: 'Berry Pie',
        icon: '🥧',
        requires: [{ tag: 'grain' }, { tag: 'fruit' }],
        priority: 25,
        result: { kind: 'material', id: 'berry_pie' },
      },
      {
        id: 'loaf',
        name: 'Rustic Loaf',
        icon: '🍞',
        requires: [{ tag: 'grain', count: 2 }],
        priority: 20,
        result: { kind: 'material', id: 'rustic_loaf' },
      },
      {
        id: 'ration',
        name: "Traveler's Ration",
        icon: '🥖',
        requires: [{ tag: 'ingredient' }],
        priority: 5,
        result: { kind: 'material', id: 'travelers_ration' },
      },
      {
        id: 'mess',
        name: 'Scorched Mess',
        icon: '🥘',
        requires: [{ tag: 'ingredient' }],
        maxQuality: 'f',
        priority: 100,
        result: { kind: 'material', id: 'scorched_mess' },
      },
    ],
  },

  assembling: {
    id: 'assembling',
    name: 'Assembling',
    benchName: 'Cold Counter',
    icon: '🥪',
    verb: 'Assemble',
    skill: 'cooking',
    tag: 'cooking',
    favoredPrep: 'sliced',
    // Every layer is another pass of the knife: time grows with the stack,
    // and a practised hand moves through it faster.
    work: { per: 'ingredient', skillScaled: true },
    ticks: 20,
    xp: 6,
    // `ingredient` covers both raw food and cooked products, so this is the
    // bench where the wheat → bread → sandwich chain completes. No mess
    // outcome: nothing burns on a cutting board, though a refuse-grade
    // sandwich will still turn on whoever eats it.
    slots: [
      {
        id: 'main',
        name: 'Foundation',
        role: 'base',
        accepts: ['ingredient'],
        station: 'centre',
      },
      {
        id: 'second',
        name: 'Layered On',
        role: 'component',
        accepts: ['ingredient'],
        station: 'centre',
      },
      {
        id: 'third',
        name: 'Third Layer',
        role: 'component',
        accepts: ['ingredient'],
        optional: true,
        unlockLevel: 15,
        station: 'topLeft',
      },
      {
        id: 'garnish',
        name: 'Garnish',
        role: 'adornment',
        accepts: ['seasoning', 'herb'],
        optional: true,
        station: 'bottomLeft',
      },
    ],
    outcomes: [
      {
        id: 'sandwich',
        name: 'Hearty Sandwich',
        icon: '🥪',
        requires: [{ tag: 'bread' }, { tag: 'filling' }],
        priority: 25,
        result: { kind: 'material', id: 'hearty_sandwich' },
      },
      {
        id: 'salad',
        name: 'Forest Salad',
        icon: '🥗',
        requires: [{ tag: 'vegetable', count: 2 }],
        priority: 20,
        result: { kind: 'material', id: 'forest_salad' },
      },
      {
        id: 'ration',
        name: "Traveler's Ration",
        icon: '🥖',
        requires: [{ tag: 'ingredient', count: 2 }],
        priority: 5,
        result: { kind: 'material', id: 'travelers_ration' },
      },
    ],
  },

  /*
   * ---------- Alchemy ----------
   *
   * The third shape the framework supports, and the one it was always heading
   * toward: an ORDERED bench. Runecarving's slots are a set, cooking's are
   * points on a clock, and the alembic's are a SEQUENCE — the same reagents in
   * a different order are a different brew, so the slots are numbered rather
   * than named and the UI lays them out as a strip.
   *
   * Note what is NOT here: outcomes. The alembic has exactly one, the way the
   * rune table does, because what comes out of it cannot be enumerated — it is
   * read back out of the sequence itself (see systems/alchemy.ts).
   */
  alchemy: {
    id: 'alchemy',
    name: 'Alchemy',
    benchName: 'Alembic',
    icon: '⚗️',
    verb: 'Brew',
    skill: 'alchemy',
    tag: 'alchemy',
    ordered: true,
    // Glassware answers to the reaction, not the hand: a brew takes as long as
    // it takes. Skill buys sequence length and vocabulary, not haste — the same
    // bargain the stove makes, for the same reason.
    work: { skillScaled: false },
    ticks: 45,
    xp: 13,
    /*
     * Two steps to start with, opening to six. Sequence length is alchemy's
     * whole progression curve — the mirror of a mage's sentence cap — because
     * every step added multiplies the orders it could have gone in.
     */
    /*
     * Every step is optional, including the first two. On an ordered bench a
     * gap is not an empty slot — it is nothing at all, and the sequence simply
     * closes over it. What makes a layout legal is that it spells out at least
     * two things (the outcome's `count: 2`), not that any particular numbered
     * step is filled.
     */
    slots: [
      {
        id: 'step1',
        name: 'First In',
        role: 'base',
        accepts: ['reagent'],
        optional: true,
        station: 'centre',
      },
      {
        id: 'step2',
        name: 'Second',
        role: 'component',
        accepts: ['reagent'],
        optional: true,
        station: 'centre',
      },
      {
        id: 'step3',
        name: 'Third',
        role: 'component',
        accepts: ['reagent'],
        optional: true,
        unlockLevel: 5,
        station: 'centre',
      },
      {
        id: 'step4',
        name: 'Fourth',
        role: 'component',
        accepts: ['reagent'],
        optional: true,
        unlockLevel: 12,
        station: 'centre',
      },
      {
        id: 'step5',
        name: 'Fifth',
        role: 'component',
        accepts: ['reagent'],
        optional: true,
        unlockLevel: 22,
        station: 'centre',
      },
      {
        id: 'step6',
        name: 'Last In',
        role: 'component',
        accepts: ['reagent'],
        optional: true,
        unlockLevel: 35,
        station: 'centre',
      },
    ],
    outcomes: [
      {
        id: 'brew',
        name: 'Brew',
        icon: '⚗️',
        requires: [{ tag: 'reagent', count: 2 }],
        result: { kind: 'brewed' },
      },
    ],
  },

  preparing: {
    id: 'preparing',
    name: 'Preparing',
    benchName: 'Cutting Board',
    icon: '🔪',
    verb: 'Prepare',
    skill: 'cooking',
    tag: 'cooking',
    ticks: 15,
    xp: 4,
    /*
     * The mirror of runecarving's shape on the cooking side: ONE outcome, and
     * the variety lives in the technique chosen (a design slot — a thing you
     * know) and what it is applied to. What material actually comes out is
     * resolved by systems/cooking.ts, which is why the outcome cannot name it.
     */
    slots: [
      {
        id: 'board',
        name: 'On the Board',
        role: 'base',
        accepts: ['whole'],
        station: 'centre',
      },
      {
        id: 'technique',
        name: 'Technique',
        role: 'component',
        picks: 'design',
        accepts: ['technique'],
        station: 'centre',
      },
    ],
    outcomes: [
      {
        id: 'prep',
        name: 'Prepped Ingredient',
        icon: '🔪',
        requires: [{ tag: 'whole' }],
        result: { kind: 'prepped' },
      },
    ],
  },

  /*
   * ---------- Forging ----------
   *
   * The fifth shape: an ASSEMBLING bench, smithing's own. Runecarving adds
   * elements, cooking reads time, alchemy reads order, mutagens read a graph;
   * the anvil reads PROPORTIONS — the sizes of the parts name the product
   * (systems/assembly.ts, data/itemclasses.data.ts).
   *
   * Not `assembling`: that id is cooking's Cold Counter.
   *
   * No outcomes and no stack placement: what goes in the slots is a part kind
   * and a material (a `Placement`, types.ts), and what comes out is derived
   * from the cells. The slots here only declare which positions exist and the
   * Smithing level each opens at.
   */
  forging: {
    id: 'forging',
    name: 'Forging',
    benchName: 'Anvil',
    icon: '🔨',
    verb: 'Forge',
    skill: 'smithing',
    tag: 'smithing',
    assembles: true,
    // The clock is 100 ticks plus 15 per cell of the placement (forgeTicks);
    // this is the nominal figure for a bench that ignores it.
    ticks: 100,
    xp: 8,
    slots: [
      {
        id: 'head',
        name: 'Head',
        role: 'base',
        accepts: ['metal', 'wood'],
        optional: true,
      },
      {
        id: 'head2',
        name: 'Second Head',
        role: 'component',
        accepts: ['metal', 'wood'],
        optional: true,
        unlockLevel: 15,
      },
      {
        id: 'guard',
        name: 'Guard',
        role: 'component',
        accepts: ['metal'],
        optional: true,
        unlockLevel: 5,
      },
      {
        id: 'haft',
        name: 'Haft',
        role: 'component',
        accepts: ['wood', 'metal'],
        optional: true,
      },
      {
        id: 'bind',
        name: 'Binding',
        role: 'component',
        accepts: ['leather'],
        optional: true,
        unlockLevel: 3,
      },
    ],
    outcomes: [],
  },
});

export const DISCIPLINE_LIST: CraftDisciplineDef[] = Object.values(DISCIPLINES);
