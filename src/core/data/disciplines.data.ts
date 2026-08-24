import type { CraftDisciplineDef } from '../types';

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
export const DISCIPLINES: Record<string, CraftDisciplineDef> = {
  mutagens: {
    id: 'mutagens',
    name: 'Geneshaping',
    benchName: 'Culture Bench',
    icon: '🧫',
    verb: 'Refine',
    desc:
      'Two of the same sequence, held against each other until the better one wins, and ' +
      'biomatter enough to keep them both alive while it happens. It makes nothing new — ' +
      'what goes in comes out sharper, and never as something else.',
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
    desc:
      'A slab on the bench, one to three patterns cut into it, and whatever you can afford ' +
      'to work into the cuts. The slab decides how much the work is worth; what you inlay ' +
      'decides what else it does.',
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
        desc: 'A slab cut to the chosen patterns.',
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
    desc:
      'Wet heat and patience: the pot takes raw ingredients and gives back ' +
      'something that needed time. What you put together decides what you get — ' +
      'and how good the ingredients were decides how good it is. Diced ' +
      'ingredients surrender everything to the simmer.',
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
        desc: 'Everything, done properly.',
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
        desc: 'Meat and something green.',
        requires: [{ tag: 'meat' }, { tag: 'vegetable' }],
        priority: 20,
        result: { kind: 'material', id: 'hearty_stew' },
      },
      {
        id: 'broth',
        name: 'Mushroom Broth',
        icon: '🍵',
        desc: 'Mushrooms, water, patience.',
        requires: [{ tag: 'mushroom' }, { tag: 'herb' }],
        priority: 25,
        result: { kind: 'material', id: 'mushroom_broth' },
      },
      {
        id: 'ration',
        name: "Traveler's Ration",
        icon: '🥖',
        desc: 'Whatever keeps.',
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
        desc: 'It is technically food.',
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
    desc:
      'Dry heat and no apologies. One good thing over the coals beats four ' +
      'mediocre things in a pot — the grill is the only bench happy with a ' +
      'single ingredient, and julienned cuts are done before they can burn.',
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
        desc: 'Fish on a stick over the fire.',
        requires: [{ tag: 'fish' }],
        priority: 20,
        result: { kind: 'material', id: 'skewered_fish' },
      },
      {
        id: 'steak',
        name: 'Seared Steak',
        icon: '🥩',
        desc: 'Hot grate, honest meat, nothing else.',
        requires: [{ tag: 'meat' }],
        priority: 15,
        result: { kind: 'material', id: 'seared_steak' },
      },
      {
        id: 'roots',
        name: 'Charred Roots',
        icon: '🍠',
        desc: 'Blackened outside, sweet inside.',
        requires: [{ tag: 'vegetable', count: 2 }],
        priority: 15,
        result: { kind: 'material', id: 'charred_roots' },
      },
      {
        id: 'ration',
        name: "Traveler's Ration",
        icon: '🥖',
        desc: 'Dried over the coals until it keeps.',
        requires: [{ tag: 'ingredient' }],
        priority: 5,
        result: { kind: 'material', id: 'travelers_ration' },
      },
      {
        id: 'mess',
        name: 'Scorched Mess',
        icon: '🥘',
        desc: 'The grill forgives nothing.',
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
    desc:
      'Enclosed heat, measured and even. The oven turns grain into the one ' +
      'food that becomes an ingredient again — bread feeds you, or it feeds ' +
      'the counter.',
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
        desc: 'Grain, honey and an egg — a celebration in miniature.',
        requires: [{ tag: 'grain' }, { tag: 'sweet' }, { tag: 'egg' }],
        minLevel: 12,
        priority: 30,
        result: { kind: 'material', id: 'honey_cake' },
      },
      {
        id: 'pie',
        name: 'Berry Pie',
        icon: '🥧',
        desc: 'A crust with a secret.',
        requires: [{ tag: 'grain' }, { tag: 'fruit' }],
        priority: 25,
        result: { kind: 'material', id: 'berry_pie' },
      },
      {
        id: 'loaf',
        name: 'Rustic Loaf',
        icon: '🍞',
        desc: 'Two measures of flour and the patience to leave the door shut.',
        requires: [{ tag: 'grain', count: 2 }],
        priority: 20,
        result: { kind: 'material', id: 'rustic_loaf' },
      },
      {
        id: 'ration',
        name: "Traveler's Ration",
        icon: '🥖',
        desc: 'Baked hard enough to survive the road.',
        requires: [{ tag: 'ingredient' }],
        priority: 5,
        result: { kind: 'material', id: 'travelers_ration' },
      },
      {
        id: 'mess',
        name: 'Scorched Mess',
        icon: '🥘',
        desc: 'The oven door hid it until too late.',
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
    desc:
      'No heat at all — stacking, layering, dressing. The only bench that ' +
      'takes cooked food as happily as raw, which is what a sandwich IS; ' +
      'sliced ingredients lie flat and stack the way the counter wants.',
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
        desc: 'Bread doing what bread was for.',
        requires: [{ tag: 'bread' }, { tag: 'filling' }],
        priority: 25,
        result: { kind: 'material', id: 'hearty_sandwich' },
      },
      {
        id: 'salad',
        name: 'Forest Salad',
        icon: '🥗',
        desc: 'Everything green, and nothing near a flame.',
        requires: [{ tag: 'vegetable', count: 2 }],
        priority: 20,
        result: { kind: 'material', id: 'forest_salad' },
      },
      {
        id: 'ration',
        name: "Traveler's Ration",
        icon: '🥖',
        desc: 'Wrapped, tied, and honest about what it is.',
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
    desc:
      'Glass, a burner and a great deal of patience. What you add matters less ' +
      'than the order you add it in: a substance steeped under everything else ' +
      'gives up its character for strength, and one dropped in last keeps all ' +
      'of it. What raises the brew decides how it is delivered.',
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
        desc: 'Whatever the sequence spells out.',
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
    desc:
      'Just a board and a knife. One whole ingredient, one technique, and the ' +
      'grade of what comes off the board is the evenness of the work — a ' +
      'perfect cut keeps everything the ingredient had, a rough one gambles ' +
      'it away.',
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
        desc: 'The same thing it was, ready for the bench that wants it this way.',
        requires: [{ tag: 'whole' }],
        result: { kind: 'prepped' },
      },
    ],
  },
};

export const DISCIPLINE_LIST: CraftDisciplineDef[] = Object.values(DISCIPLINES);
