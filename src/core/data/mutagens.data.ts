import type {
  ChromosomeLayout,
  DamageType,
  GenusDef,
  MainGeneDef,
  MutagenArm,
  MutagenDef,
  NucleaseKind,
  QualityTier,
  StatKey,
} from '../types';
import { DAMAGE_TYPE_NAMES, RES_STAT_BY_TYPE } from '../types';
import { STATUSES } from './statuses.data';
import { prose } from '../text/prose';
import { MAIN_GENES_TEXT, NUCLEASES_TEXT } from '../text/mutagens.text';

/**
 * Mutagen content: the chromosome layouts, the genera and their genes, and the
 * mutations that ride between them.
 *
 * The engine (systems/mutagens.ts) knows none of these specifics. It knows how
 * to route an effect to the centromere and what to do to it on the way; what
 * any of it MEANS is here. See docs/MUTAGENS.md for why the system is shaped
 * this way — this file is the vocabulary, that document is the grammar.
 *
 * Every number below is illustrative and tunable. The SHAPES are the
 * commitments: cost superlinear in power, tier fixed at the drop, quality the
 * only thing refinement moves, F weak but never harmful.
 */

// ---------- Tuning ----------

/** The edge length that reads as ×1 intensity. Everything is a ratio to this. */
export const BASELINE_EDGE = 3;

/**
 * How close to its tier's ceiling each grade gets you. Tier buys the ceiling,
 * quality buys the approach — so a hill giant (ceiling 1.8) runs 0.9 at F and
 * 1.8 at S, while a jötunn runs the same fractions against a taller ceiling.
 *
 * ⚠️ Deliberately NOT `qualityMult` from quality.data.ts, whose F is negative.
 * A rotten carrot can be thrown away; a rare monster drop cannot, so F here is
 * weak and never harmful. F's real penalty is capacity inefficiency — see
 * QUALITY_COST below and docs/MUTAGENS.md §9.
 */
export const QUALITY_APPROACH: Record<QualityTier, number> = {
  f: 0.5,
  e: 0.583,
  d: 0.667,
  c: 0.75,
  b: 0.833,
  a: 0.917,
  s: 1,
};

/**
 * What a grade does to what a gene COSTS. C is the neutral anchor — the median
 * specimen, and the grade tier costs are measured at. Below it a gene is cheap
 * and lame, which is what makes an F-rank a real pick rather than a
 * consolation: minimum spend, maximum capacity left for topology. Above it you
 * pay for perfection, slightly, so quality is a trade rather than a free
 * upgrade — but only slightly, so TIER stays the dominant capacity decision.
 */
export const QUALITY_COST: Record<QualityTier, number> = {
  f: 0.8,
  e: 0.88,
  d: 0.94,
  c: 1,
  b: 1.07,
  a: 1.15,
  s: 1.25,
};

/** Capacity a bottom-tier gene costs at C-rank. Everything scales off this. */
export const MAIN_BASE_COST = 10;

/**
 * Cost grows FASTER than power as you climb. Cut costs already compound, so
 * topology has diminishing returns; if tier cost were linear in power it would
 * have constant returns, constant beats diminishing at every budget, and the
 * optimum would pin forever to "highest tier you can fit, remainder into the
 * graph". Superlinear here puts the optimum at an interior point that moves
 * with total capacity. The exponent is tuning; that there is one is not.
 */
export const TIER_COST_EXPONENT = 1.35;

/** Capacity one placed mutation reserves, before its grade adjusts it. */
export const MUTATION_COST = 2;

/**
 * Cuts reserve capacity rather than spending a resource, and they compound: the
 * nth cut costs `CUT_BASE · CUT_GROWTH^(n-1)`. Reversible, so a player can
 * experiment freely; bounded, so the steady state is a real constraint.
 */
export const CUT_BASE = 1.5;
export const CUT_GROWTH = 1.6;

// ---------- Layouts ----------

/**
 * Canonical key for a connection, so `a–b` and `b–a` are the same edge.
 *
 * Lives here rather than in the system so that state.ts and the save
 * migrations can build a starting chromosome without importing the engine —
 * systems/mutagens.ts re-exports it, which is where callers should get it.
 */
export function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * What the quest hands over: the centromere, one upper arm and one lower.
 * A complete body with write-access to two of its four aspects; expansion buys
 * the other two. `g` carries attacks and `i` carries defenses, so which lower
 * arm you are given is a real first choice.
 */
export function startingKit(lowerArm: 'g' | 'i' = 'g'): string[] {
  return [edgeKey('d', '@'), edgeKey(lowerArm, '@')];
}

/**
 * A chromosome as it arrives.
 *
 * ⚠️ ALPHA: `unlocked` starts TRUE and the starting kit is pre-granted, so the
 * culture bench is reachable from the first minute. The gate is deliberately
 * still here and still wired — `unlockMutagens` grants exactly this, drops and
 * refinement both check the flag, and LocationPanel hides the bench while it is
 * false. Flipping this to `false` is the whole of what the unlock quest will
 * need. It is open now because the architecture is what is being built, not the
 * exploration around it.
 */
export function freshMutagenState() {
  return {
    unlocked: true,
    chromosome: {
      layout: 'baseline',
      main: null,
      placed: {},
      established: startingKit(),
      cut: [],
    },
    known: { genes: [], mutagens: [] },
  };
}

/**
 * The baseline chromosome.
 *
 * Upper cluster (a–f): six sockets, asymmetric, edges at baseline length. Its
 * currency is HOPS — the full traversal `e → f → c → b → a → d → @` crosses six
 * baseline edges for ×6 intensity, having been transformed five times.
 *
 * Lower ring (g–j): four sockets, symmetric, edges deliberately LONG. Its
 * currency is DISTANCE — `g → @` is one hop across 9μm for ×3 and no transform
 * at all. A ring of short edges would be weak twice over (few hops AND little
 * distance), which is why the length lives here and the hop count lives above.
 *
 * `h` and `j` sit two hops from the centre either way round, so they tie
 * permanently and split 50:50 into both lower arms unless a cut breaks the
 * symmetry. Half the ring always spreads; half of it always concentrates.
 */
export const BASELINE_LAYOUT: ChromosomeLayout = {
  id: 'baseline',
  name: 'Common Chromosome',
  // Positions are presentation only — nothing in the engine reads them. The
  // upper cluster fans wide so its depth is visible; the ring closes into a
  // diamond so its symmetry is, which is the thing a player has to see to
  // understand why `h` and `j` always split.
  centre: { x: 50, y: 50 },
  sockets: [
    { id: 'a', x: 22, y: 12 },
    { id: 'b', x: 50, y: 5 },
    { id: 'c', x: 78, y: 12 },
    { id: 'd', x: 34, y: 31 },
    { id: 'e', x: 50, y: 35 },
    { id: 'f', x: 66, y: 31 },
    { id: 'g', x: 24, y: 69 },
    { id: 'h', x: 50, y: 63 },
    { id: 'i', x: 76, y: 69 },
    { id: 'j', x: 50, y: 90 },
  ],
  edges: [
    // Upper cluster — baseline length throughout; depth is the point.
    { a: 'a', b: 'b', length: 3 },
    { a: 'b', b: 'c', length: 3 },
    { a: 'a', b: 'd', length: 3 },
    { a: 'c', b: 'f', length: 3 },
    { a: 'd', b: 'e', length: 3 },
    { a: 'e', b: 'f', length: 3 },
    // The two upper arms. Qualitative domains sit here, where many transforms
    // are available to change an effect's character.
    { a: 'd', b: '@', length: 3, arm: 'special' },
    { a: 'f', b: '@', length: 3, arm: 'active' },
    // Lower ring — long edges, few hops. Quantitative domains, where an effect
    // wants to arrive strong rather than reinterpreted.
    { a: 'g', b: 'h', length: 6 },
    { a: 'h', b: 'i', length: 6 },
    { a: 'g', b: 'j', length: 6 },
    { a: 'j', b: 'i', length: 6 },
    { a: 'g', b: '@', length: 9, arm: 'attacks' },
    { a: 'i', b: '@', length: 9, arm: 'defenses' },
  ],
};

export const LAYOUTS: Record<string, ChromosomeLayout> = {
  baseline: BASELINE_LAYOUT,
};

// ---------- Genera ----------

/**
 * A genus is two numbers: how many tiers it has, and how many quality grades
 * one tier step is worth. At the baseline — four tiers, two grades per step —
 * that is three steps × two grades = six grades of span, exactly the F→S range,
 * so an S-rank bottom tier and an F-rank top tier are dead level.
 *
 * Departing from the baseline is a deliberate authoring choice about whether a
 * genus is a LADDER (wide steps, species are power rungs you climb) or a MENU
 * (tight steps, species are near-peers chosen on their differences).
 */
export const GENERA: Record<string, GenusDef> = {
  /**
   * The one genus whose species already exist. Slimes ship as a three-rung
   * ladder (Slime → Slimer → Slimest), which is a genus already — so this is
   * what makes the whole pipeline exercisable before a single giant is written.
   */
  /**
   * Five rungs at two grades a step is eight grades of span against quality's
   * six — deliberately wider than refining can bridge. Slimoid is a LADDER:
   * climbing outpaces polishing, and an S-rank slime never catches a raw king.
   * The sidegrades are where the menu lives instead.
   */
  slimoid: {
    id: 'slimoid',
    name: 'Slimoid',
    gradesPerStep: 2,
    tiers: [
      'slime_gene',
      'fire_slime_gene',
      'slimer_gene',
      'flame_slime_gene',
      'slimest_gene',
      'blaze_slime_gene',
      'slime_guardian_gene',
      'slime_golem_gene',
      'slime_king_gene',
    ],
  },
  /**
   * Five rungs at FOUR grades a step: the full quality range is worth a tier
   * and a half, so climbing beats polishing by more here than anywhere else.
   *
   * That number is load-bearing rather than flavour. A unique — Balor, Surtr —
   * must be out of reach of anything more than one tier below it, and at three
   * grades a step a perfect tier-2 gene would read level with a raw tier-4 one.
   * At four it cannot: 2 + 5/4 falls short of 4, and the rule holds by
   * arithmetic instead of by hoping nobody grinds.
   */
  gigantoid: {
    id: 'gigantoid',
    name: 'Gigantoid',
    gradesPerStep: 4,
    tiers: [
      'troll',
      'rock_giant',
      'hill_giant',
      'forest_giant',
      'jotunn',
      'fomorian',
      'storm_giant',
      'balor',
      'surtr',
    ],
  },
  /** The baseline shape: four tiers, two grades a step. */
  draconoid: {
    id: 'draconoid',
    name: 'Draconoid',
    gradesPerStep: 2,
    tiers: ['wyrmling', 'drake', 'wyvern', 'dragon'],
  },
  /** A ladder: two species five grades apart, so the lower is transitional. */
  asuroid: {
    id: 'asuroid',
    name: 'Asuroid',
    gradesPerStep: 5,
    tiers: ['dvibahu', 'asura'],
  },
};

// ---------- Main genes ----------

/**
 * One species drops one gene. Tier is a property of the species and is fixed at
 * the drop forever — no bench work turns a hill giant into a cyclops. The only
 * thing refinement moves is quality.
 *
 * ⚠️ `from` must name a real monster or the gene can never drop. The slimoid
 * line points at species that exist today; gigantoid, draconoid and asuroid are
 * authored ahead of their monsters and are inert until those are written.
 */
export const MAIN_GENES = prose<MainGeneDef>('MAIN_GENES', MAIN_GENES_TEXT, {
  /**
   * Normal is a gene you manufacture, not an empty socket. No tier, no quality,
   * and it writes ATTRIBUTES rather than derived stats — the spill across
   * domains is exactly what makes it the generalist. Having no headline
   * ability, its active arm holds only the resource pools, so it is
   * structurally shut out of the qualitative game.
   */
  bare: {
    id: 'bare',
    name: 'Bare Sequence',
    icon: '🧬',
    genus: 'bare',
    tier: 0,
    flatBase: 0,
    ceiling: 1,
    writesAttributes: true,
    // Held at `c` so every quality-keyed curve reads it without a special
    // case, but never shown a grade — there is nothing to refine.
    gradeless: true,
    /*
     * ⚠️ Every value here is 0, and that is the point of the entry rather than
     * an omission.
     *
     * Bare is the DEFAULT body, so anything it grants is granted
     * unconditionally to everyone forever — which is not a buff, it is just a
     * different number to have started at. A free +1 across the six was
     * indistinguishable from raising base attributes, and shifted every
     * balance figure in the game the moment the chromosome was wired into the
     * stat pipeline.
     *
     * The shape stays because the shape is bare's identity: it writes
     * ATTRIBUTES, one per arm, where every other gene writes derived stats
     * (docs/MUTAGENS.md §8). PRESTIGE is what raises these off the floor —
     * heightening the default gene is a permanent gain that reaches every
     * build, including the unused half of a split chromosome, and it only
     * reads as a gain because it starts at nothing.
     */
    base: {
      attacks: [
        { stat: 'str', op: 'add', value: 0 },
        { stat: 'dex', op: 'add', value: 0 },
      ],
      defenses: [{ stat: 'con', op: 'add', value: 0 }],
      active: [
        { stat: 'int', op: 'add', value: 0 },
        { stat: 'wis', op: 'add', value: 0 },
      ],
      special: [{ stat: 'cha', op: 'add', value: 0 }],
    },
  },

  /*
   * ---- The slimoid line ----
   *
   * A genus that BRANCHES: a plain line (slime → slimer → slimest), an
   * elemental line beside it at the same rungs (fire → flame → blaze), and a
   * fork at rung three into guardian or golem before they rejoin at the king.
   * Species sharing a tier are sidegrades — equally strong bodies you pick
   * between on what they do, not on how much.
   *
   * ⚠️ Most of what these bodies DO is in `desc` rather than in `base`, and
   * that is honest rather than lazy: the columns describe abilities, triggers
   * and a summoned entity, and `base` can only carry stat modifiers. What is
   * expressible is expressed; the rest is a specification waiting for the
   * systems named in §13. Do not read a missing modifier as a missing idea.
   */
  slime_gene: {
    id: 'slime_gene',
    name: 'Slime Gene',
    icon: '🟢',
    genus: 'slimoid',
    tier: 0,
    from: 'slime_base_basic',
    flatBase: 60,
    ceiling: 1.5,
    // Damage read off ARMOUR: the harder you are, the more it hurts to be hit
    // by you. The mini-stun is ticks taken off their swing, not a condition —
    // nothing to resist, nothing to cure, they simply lose the time.
    ability: {
      name: 'Slime Bounce',
      icon: '🫧',
      spec: {
        type: 'gene',
        flat: 60,
        power: 1,
        fromStat: 'armor',
        scalesWithSpeed: true,
        cooldown: 70,
        damageType: 'bludgeoning',
        stun: 2,
      },
    },
    base: {
      defenses: [{ stat: 'resSlashing', op: 'add', value: 0.06 }],
      // The line's signature: a body with nothing to sever takes the spike off
      // a crit. Scales the surplus only, so a crit lands as a plain blow.
      special: [{ stat: 'critTaken', op: 'mult', value: -0.2 }],
      // "Techniques shed a little cooldown when they miss" — nothing to
      // over-commit means nothing to recover from.
      attacks: [{ stat: 'missRefund', op: 'add', value: 0.06 }],
    },
  },
  slimer_gene: {
    id: 'slimer_gene',
    name: 'Slimer Gene',
    icon: '🟩',
    genus: 'slimoid',
    tier: 1,
    from: 'slime_base_advanced',
    flatBase: 125,
    ceiling: 1.9,
    // Damage read off ARMOUR: the harder you are, the more it hurts to be hit
    // by you. The mini-stun is ticks taken off their swing, not a condition —
    // nothing to resist, nothing to cure, they simply lose the time.
    ability: {
      name: 'Slime Bounce',
      icon: '🫧',
      spec: {
        type: 'gene',
        flat: 125,
        power: 1,
        fromStat: 'armor',
        scalesWithSpeed: true,
        cooldown: 70,
        damageType: 'bludgeoning',
        stun: 2,
      },
    },
    base: {
      defenses: [{ stat: 'resSlashing', op: 'add', value: 0.1 }],
      special: [{ stat: 'critTaken', op: 'mult', value: -0.28 }],
      attacks: [{ stat: 'missRefund', op: 'add', value: 0.09 }],
    },
  },
  slimest_gene: {
    id: 'slimest_gene',
    name: 'Slimest Gene',
    icon: '💚',
    genus: 'slimoid',
    tier: 2,
    from: 'slime_base_elite',
    flatBase: 255,
    ceiling: 2.3,
    // Damage read off ARMOUR: the harder you are, the more it hurts to be hit
    // by you. The mini-stun is ticks taken off their swing, not a condition —
    // nothing to resist, nothing to cure, they simply lose the time.
    ability: {
      name: 'Slime Bounce',
      icon: '🫧',
      spec: {
        type: 'gene',
        flat: 255,
        power: 1,
        fromStat: 'armor',
        scalesWithSpeed: true,
        cooldown: 70,
        damageType: 'bludgeoning',
        stun: 2,
      },
    },
    base: {
      defenses: [
        { stat: 'resSlashing', op: 'add', value: 0.14 },
        { stat: 'resPiercing', op: 'add', value: 0.06 },
      ],
      special: [{ stat: 'critTaken', op: 'mult', value: -0.36 }],
      attacks: [{ stat: 'missRefund', op: 'add', value: 0.12 }],
    },
  },

  /* Rung three forks. Guardian turns everything inward; golem hits back. */
  slime_guardian_gene: {
    id: 'slime_guardian_gene',
    name: 'Slime Guardian Gene',
    icon: '🛡️',
    genus: 'slimoid',
    tier: 3,
    from: 'boss_slime_guardian',
    flatBase: 430,
    ceiling: 2.7,
    // The one gene whose tool is defensive rather than offensive: it fires off
    // the buff slot, not the action bar, so raising it costs no swing. The
    // ward is flat and lands after resistances, which is why a guardian is at
    // its best against a formation chipping at it rather than one big blow.
    ability: {
      name: 'Slime Shield',
      icon: '🛡️',
      spec: {
        type: 'buff',
        mods: [
          { stat: 'armor', op: 'mult', value: 0.5 },
          { stat: 'ward', op: 'add', value: 12 },
        ],
        duration: 90,
        cooldown: 240,
      },
    },
    base: {
      defenses: [
        { stat: 'resSlashing', op: 'add', value: 0.16 },
        { stat: 'resPiercing', op: 'add', value: 0.1 },
        { stat: 'resBludgeoning', op: 'add', value: 0.05 },
        { stat: 'armor', op: 'mult', value: 0.15 },
      ],
      special: [
        // Everything softer, crits a little softer, and arrows softer again —
        // the guardian's whole shape is "harder to reach".
        { stat: 'damageTaken', op: 'mult', value: -0.1 },
        { stat: 'critTaken', op: 'mult', value: -0.15 },
        { stat: 'resRanged', op: 'add', value: 0.14 },
      ],
      // "Reduces penalties to off-balance" — a body with no skeleton to
      // over-commit does not really have footing to lose — and it keeps the
      // line's cooldown shed on top of that.
      attacks: [
        { stat: 'stumbleTaken', op: 'mult', value: -0.45 },
        { stat: 'missRefund', op: 'add', value: 0.14 },
      ],
    },
  },
  slime_golem_gene: {
    id: 'slime_golem_gene',
    name: 'Slime Golem Gene',
    icon: '🗿',
    genus: 'slimoid',
    tier: 3,
    from: 'slime_golem',
    flatBase: 430,
    ceiling: 2.7,
    // A whole body thrown at something: it hits everything nearby and leaves
    // you gathering yourself. The ten ticks are spent AFTER the blow rather
    // than before — same throughput, and no queued-action machinery needed to
    // say it, which is the only reason to prefer one order over the other.
    ability: {
      name: 'Slime Crash',
      icon: '🗿',
      spec: {
        type: 'gene',
        flat: 430,
        power: 1,
        fromStat: 'armor',
        scalesWithSpeed: true,
        cooldown: 130,
        damageType: 'bludgeoning',
        splash: 0.5,
        selfDelay: 10,
      },
    },
    base: {
      defenses: [
        { stat: 'resSlashing', op: 'add', value: 0.18 },
        { stat: 'resPiercing', op: 'add', value: 0.14 },
        { stat: 'resBludgeoning', op: 'add', value: 0.1 },
      ],
      attacks: [
        { stat: 'damage', op: 'mult', value: 0.12 },
        // "Bonus damage is applied as grazing damage when missing" — a body
        // this heavy does not really stop once it has started swinging.
        { stat: 'graze', op: 'add', value: 0.2 },
      ],
      special: [
        { stat: 'damageTaken', op: 'mult', value: -0.22 },
        { stat: 'critTaken', op: 'mult', value: -0.3 },
      ],
    },
  },
  // TODO: intended: the slime bodyguard and Suislime need a summoned entity that does not exist yet; only the stat modifiers work. The desc still describes the full design.
  slime_king_gene: {
    id: 'slime_king_gene',
    name: 'Slime King Gene',
    icon: '👑',
    genus: 'slimoid',
    tier: 4,
    from: 'slime_king',
    flatBase: 700,
    ceiling: 3.1,
    // ⚠️ No `ability` yet. Suislime detonates the bodyguard for damage scaled
    // by ITS remaining health — it needs a persistent summoned entity, which
    // nothing in the game has. The whole gene waits on that one feature, and
    // three of its four arms read the same creature.
    base: {
      defenses: [
        { stat: 'resSlashing', op: 'add', value: 0.2 },
        { stat: 'resPiercing', op: 'add', value: 0.16 },
        { stat: 'resBludgeoning', op: 'add', value: 0.12 },
        // "Half bonus resistance against elemental effects" — one modifier
        // rather than ten, folded in wherever an elemental type is checked.
        { stat: 'resElemental', op: 'add', value: 0.06 },
      ],
      attacks: [{ stat: 'damage', op: 'mult', value: 0.18 }],
    },
  },

  /* The elemental branch: rungs zero to two again, traded sideways into fire. */
  // TODO: intended: the wearer's ordinary blows carry fire (retype or add heat to plain hits). Not implemented; dropped from the desc.
  fire_slime_gene: {
    id: 'fire_slime_gene',
    name: 'Fire Slime Gene',
    icon: '🔴',
    genus: 'slimoid',
    tier: 0,
    from: 'slime_fire',
    flatBase: 60,
    ceiling: 1.5,
    // The loop closed twice over: heat resistance is this line's damage stat,
    // and its ability reads the same number again. As a MULTIPLIER, though —
    // a resistance is bounded and must never be priced per point.
    ability: {
      name: 'Flaming Bounce',
      icon: '🔥',
      spec: {
        type: 'gene',
        flat: 60,
        amplifiedBy: 'resHeat',
        scalesWithSpeed: true,
        cooldown: 70,
        damageType: 'heat',
        stun: 2,
      },
    },
    base: {
      defenses: [
        { stat: 'resSlashing', op: 'add', value: 0.06 },
        { stat: 'resHeat', op: 'add', value: 0.1 },
      ],
      special: [{ stat: 'critTaken', op: 'mult', value: -0.2 }],
      // The line's whole identity, and the reason `fromStat` exists: heat
      // resistance IS the damage stat here, so stacking a defence is the
      // offensive plan. Reads the CLAMPED value, so resistance bought past the
      // cap buys nothing here either.
      attacks: [{ stat: 'damage', op: 'mult', value: 0.5, fromStat: 'resHeat' }],
    },
  },
  flame_slime_gene: {
    id: 'flame_slime_gene',
    name: 'Flame Slime Gene',
    icon: '🟥',
    genus: 'slimoid',
    tier: 1,
    from: 'slime_fire_advanced',
    flatBase: 125,
    ceiling: 1.9,
    // The loop closed twice over: heat resistance is this line's damage stat,
    // and its ability reads the same number again. As a MULTIPLIER, though —
    // a resistance is bounded and must never be priced per point.
    ability: {
      name: 'Flaming Bounce',
      icon: '🔥',
      spec: {
        type: 'gene',
        flat: 125,
        amplifiedBy: 'resHeat',
        scalesWithSpeed: true,
        cooldown: 70,
        damageType: 'heat',
        stun: 2,
      },
    },
    base: {
      defenses: [
        { stat: 'resSlashing', op: 'add', value: 0.1 },
        { stat: 'resHeat', op: 'add', value: 0.16 },
      ],
      special: [{ stat: 'critTaken', op: 'mult', value: -0.28 }],
      attacks: [{ stat: 'damage', op: 'mult', value: 0.7, fromStat: 'resHeat' }],
    },
  },
  blaze_slime_gene: {
    id: 'blaze_slime_gene',
    name: 'Blaze Slime Gene',
    icon: '🔥',
    genus: 'slimoid',
    tier: 2,
    from: 'slime_fire_elite',
    flatBase: 255,
    ceiling: 2.3,
    // The loop closed twice over: heat resistance is this line's damage stat,
    // and its ability reads the same number again. As a MULTIPLIER, though —
    // a resistance is bounded and must never be priced per point.
    ability: {
      name: 'Flaming Bounce',
      icon: '🔥',
      spec: {
        type: 'gene',
        flat: 255,
        amplifiedBy: 'resHeat',
        scalesWithSpeed: true,
        cooldown: 70,
        damageType: 'heat',
        stun: 2,
      },
    },
    base: {
      defenses: [
        { stat: 'resSlashing', op: 'add', value: 0.12 },
        { stat: 'resPiercing', op: 'add', value: 0.06 },
        { stat: 'resHeat', op: 'add', value: 0.22 },
      ],
      special: [{ stat: 'critTaken', op: 'mult', value: -0.36 }],
      attacks: [{ stat: 'damage', op: 'mult', value: 0.95, fromStat: 'resHeat' }],
    },
  },

  /*
   * GIGANTOID — a tree, not a ladder, and the genus that proves the shape.
   *
   * Five rungs, two species on each of the first four, and the top two are
   * UNIQUE VARIANTS of species one rung below them: Balor is a fomorian and
   * Surtr is a jötunn. That is why the pairs share their capability list and
   * differ in what they do with it — the unique is not a better giant, it is
   * the same giant with one impossible thing added.
   *
   * ⚠️ Every `from` here names a monster in the first gigantoid wave. Those
   * ids must match the wave exactly or the gene can never drop; the uniques
   * follow `boss_slime_guardian`'s prefix. Two item tags are likewise written
   * ahead of their items — `stone` and `bone` weapons, and `tower shield` —
   * and the modifiers that name them are inert until something carries them.
   */
  troll: {
    id: 'troll',
    name: 'Troll Gene',
    icon: '🧌',
    genus: 'gigantoid',
    tier: 1,
    from: 'troll',
    size: 'large',
    flatBase: 100,
    ceiling: 1.6,
    ability: {
      name: 'Troll Bite',
      icon: '🦷',
      spec: {
        type: 'gene',
        power: 1.4,
        fromStat: 'damage',
        flat: 30,
        cooldown: 80,
        damageType: 'piercing',
        // The bite is the wound, not the damage — what it leaves is the point.
        inflicts: [
          { id: 'bleeding', intensity: 1 },
          { id: 'punctured', intensity: 1 },
        ],
      },
    },
    /*
     * WHAT DOUSES THIS BODY, written on the body.
     *
     * `knitting` carries no effect — it is where the rule lives. Its removal
     * names heat and acid HERE, on the gene, rather than in a constant every
     * regenerating thing in the game shares; so a troll's weakness is a
     * property of trolls, and something that rewrites these two strings has
     * something to rewrite. `becomes` hands over to `doused`, which zeroes the
     * regeneration for its four seconds and blocks knitting from returning
     * until it lifts.
     */
    confers: [
      {
        id: 'knitting',
        removal: [
          {
            on: 'damageTaken',
            damageTypes: ['heat', 'acid'],
            effect: 'remove',
            becomes: 'doused',
          },
        ],
      },
    ],
    base: {
      special: [
        // Regeneration as a share of the pool, which is what `fromStat` is for
        // — a bigger troll knits faster, without a second stat to keep in step.
        { stat: 'hpRegen', op: 'mult', value: 0.004, fromStat: 'maxHp' },
      ],
      attacks: [
        { stat: 'damage', op: 'mult', value: 0.5, fromStat: 'resBludgeoning' },
        // Bone in the hand of a thing made of bone. Inert until a bone weapon
        // exists — deliberately, so the wave can add one and it just works.
        { stat: 'damage', op: 'mult', value: 0.15, requiresTag: 'bone' },
      ],
      defenses: [
        // "Bleed resistance" needs no new stat: `bleeding` deals slashing
        // damage, so slashing resistance IS bleed resistance.
        { stat: 'resSlashing', op: 'add', value: 0.16 },
        { stat: 'resPiercing', op: 'add', value: 0.12 },
        // The line's price, and a real one — the same fire that stops the
        // regeneration also hurts more on the way in.
        { stat: 'resHeat', op: 'add', value: -0.25 },
      ],
    },
  },
  rock_giant: {
    id: 'rock_giant',
    name: 'Rock Giant Gene',
    icon: '🪨',
    genus: 'gigantoid',
    tier: 1,
    from: 'rock_giant',
    size: 'large',
    flatBase: 100,
    ceiling: 1.6,
    // A thrown rock is worth what the arm behind it is, plus what the species
    // is worth on its own. The "% more against smaller targets" half needs
    // nothing here — `vsSmaller` is on the gene and multiplies everything.
    ability: {
      name: 'Rock Throw',
      icon: '🪨',
      spec: { type: 'gene', power: 1.6, fromStat: 'damage', flat: 100, cooldown: 90, damageType: 'bludgeoning' },
    },
    base: {
      attacks: [
        // Two tags, two modifiers: `requiresTag` takes one apiece, so "stone or
        // wood" is written as the or it is rather than folded into a fiction.
        { stat: 'damage', op: 'mult', value: 0.12, requiresTag: 'stone' },
        { stat: 'damage', op: 'mult', value: 0.12, requiresTag: 'wood' },
        { stat: 'vsSmaller', op: 'add', value: 0.05 },
      ],
      defenses: [
        { stat: 'resBludgeoning', op: 'add', value: 0.12 },
        { stat: 'resEarth', op: 'add', value: 0.12 },
      ],
      special: [
        { stat: 'maxHp', op: 'mult', value: 0.15 },
        // "Take less damage against smaller targets", per step of the gap. At
        // `large` that is one step over a person and three over something tiny.
        { stat: 'fromSmaller', op: 'add', value: 0.06 },
      ],
    },
  },
  hill_giant: {
    id: 'hill_giant',
    name: 'Hill Giant Gene',
    icon: '⛰️',
    genus: 'gigantoid',
    tier: 2,
    from: 'hill_giant',
    size: 'huge',
    flatBase: 200,
    ceiling: 2,
    ability: {
      name: 'Boulder Throw',
      icon: '🪨',
      spec: { type: 'gene', power: 1.8, fromStat: 'damage', flat: 200, cooldown: 90, damageType: 'bludgeoning' },
    },
    base: {
      attacks: [
        { stat: 'damage', op: 'mult', value: 0.18, requiresTag: 'stone' },
        { stat: 'damage', op: 'mult', value: 0.18, requiresTag: 'wood' },
        { stat: 'vsSmaller', op: 'add', value: 0.07 },
      ],
      defenses: [
        { stat: 'resBludgeoning', op: 'add', value: 0.18 },
        { stat: 'resEarth', op: 'add', value: 0.18 },
      ],
      special: [
        { stat: 'maxHp', op: 'mult', value: 0.24 },
        { stat: 'fromSmaller', op: 'add', value: 0.08 },
      ],
    },
  },
  forest_giant: {
    id: 'forest_giant',
    name: 'Forest Giant Gene',
    icon: '🌲',
    genus: 'gigantoid',
    tier: 2,
    from: 'forest_giant',
    size: 'huge',
    flatBase: 200,
    ceiling: 2,
    // The genus's first open hand, and the broadest one anybody gets: ANY
    // two-hander, where every rung above narrows it to families. The trade is
    // written in the speed line below — the hill giant's twin only REDUCES the
    // weight penalty where a jötunn erases it.
    grants: ['onehand:*'],
    ability: {
      name: 'Tree Throw',
      icon: '🌲',
      spec: {
        type: 'gene',
        power: 1.8,
        fromStat: 'damage',
        flat: 200,
        cooldown: 90,
        damageType: 'bludgeoning',
        inflicts: [{ id: 'seeded', intensity: 1 }],
      },
    },
    base: {
      attacks: [
        { stat: 'damage', op: 'mult', value: 0.22, requiresTag: 'wood' },
        { stat: 'damage', op: 'mult', value: 0.22, requiresTag: 'bone' },
        // Reduced, not erased. The weight penalty is already an `attackSpeed`
        // mod on the weapon and two-handers already carry `twoHanded`, so
        // paying some of it back needs no mechanism of its own.
        { stat: 'attackSpeed', op: 'mult', value: 0.08, requiresTag: 'twoHanded' },
      ],
      defenses: [
        { stat: 'resBludgeoning', op: 'add', value: 0.16 },
        { stat: 'resPoison', op: 'add', value: 0.2 },
      ],
      special: [{ stat: 'maxHp', op: 'mult', value: 0.24 }],
    },
  },
  jotunn: {
    id: 'jotunn',
    name: 'Jötunn Gene',
    icon: '🏔️',
    genus: 'gigantoid',
    tier: 3,
    from: 'jotunn',
    size: 'gargantuan',
    flatBase: 400,
    ceiling: 2.5,
    // Narrower than the forest giant's and strictly better inside its lane —
    // that is the sidegrade shape the whole genus is built on. A capability
    // rather than a number, so it is never scaled or capped: a cheap jötunn
    // gene opens the same hand a refined one does. docs/MUTAGENS.md §7.
    grants: ['onehand:blunt', 'onehand:tower shield'],
    ability: {
      name: 'Mountain Crusher',
      icon: '🏔️',
      spec: {
        type: 'gene',
        power: 2.2,
        fromStat: 'damage',
        flat: 400,
        cooldown: 140,
        damageType: 'bludgeoning',
        // Weapon weight AND the elements it brings up out of the ground.
        riders: [
          { type: 'earth', value: 60 },
          { type: 'cold', value: 60 },
        ],
        // "To all enemies" — the whole room, not one unlucky flanker.
        splash: 1,
        splashAll: true,
        inflicts: [{ id: 'chilled', intensity: 1 }],
      },
    },
    base: {
      attacks: [
        { stat: 'damage', op: 'mult', value: 0.35, requiresTag: 'blunt' },
        { stat: 'vsSmaller', op: 'add', value: 0.09 },
        // "Eliminating speed penalties" from two-handed weapons — arms that can
        // swing a greatsword one-handed do not pay for its weight.
        { stat: 'attackSpeed', op: 'mult', value: 0.15, requiresTag: 'twoHanded' },
      ],
      defenses: [
        { stat: 'resBludgeoning', op: 'add', value: 0.24 },
        { stat: 'resCold', op: 'add', value: 0.24 },
        { stat: 'resWind', op: 'add', value: 0.18 },
      ],
      special: [
        { stat: 'maxHp', op: 'mult', value: 0.4 },
        { stat: 'fromSmaller', op: 'add', value: 0.1 },
      ],
    },
  },
  fomorian: {
    id: 'fomorian',
    name: 'Fomorian Gene',
    icon: '🔱',
    genus: 'gigantoid',
    tier: 3,
    from: 'fomorian',
    size: 'gargantuan',
    flatBase: 400,
    ceiling: 2.5,
    grants: ['onehand:spear', 'onehand:tower shield'],
    ability: {
      name: 'Deep Thrust',
      icon: '🔱',
      spec: {
        type: 'gene',
        power: 2.2,
        fromStat: 'damage',
        flat: 400,
        cooldown: 120,
        damageType: 'piercing',
        // Gloom is `dark` — the fiction has its own word for the damage type,
        // the way "bleed resistance" is slashing resistance.
        riders: [{ type: 'dark', value: 90 }],
        inflicts: [{ id: 'on_fire', intensity: 1 }],
      },
    },
    base: {
      attacks: [
        { stat: 'damage', op: 'mult', value: 0.3, requiresTag: 'spear' },
        { stat: 'vsSmaller', op: 'add', value: 0.09 },
        { stat: 'attackSpeed', op: 'mult', value: 0.15, requiresTag: 'twoHanded' },
      ],
      defenses: [
        { stat: 'resBludgeoning', op: 'add', value: 0.2 },
        { stat: 'resWater', op: 'add', value: 0.22 },
        { stat: 'resDark', op: 'add', value: 0.22 },
      ],
      special: [
        { stat: 'maxHp', op: 'mult', value: 0.4 },
        { stat: 'fromSmaller', op: 'add', value: 0.1 },
      ],
    },
  },
  storm_giant: {
    id: 'storm_giant',
    name: 'Storm Giant Gene',
    icon: '🌩️',
    genus: 'gigantoid',
    tier: 4,
    from: 'storm_giant',
    size: 'colossal',
    flatBase: 800,
    ceiling: 3,
    grants: ['onehand:greatsword', 'onehand:blunt', 'onehand:tower shield'],
    ability: {
      name: 'Mountain Throw',
      icon: '🌋',
      spec: {
        type: 'gene',
        power: 2.4,
        fromStat: 'damage',
        flat: 800,
        cooldown: 110,
        damageType: 'bludgeoning',
        // The line's joke, finally paid off: `vsSmaller` is linear and this is
        // not. From colossal, a person is four steps down — two doublings.
        sizeDouble: 2,
      },
    },
    base: {
      attacks: [
        { stat: 'damage', op: 'mult', value: 0.3, requiresTag: 'wood' },
        { stat: 'damage', op: 'mult', value: 0.3, requiresTag: 'stone' },
        { stat: 'attackSpeed', op: 'mult', value: 0.15, requiresTag: 'twoHanded' },
      ],
      defenses: [
        { stat: 'resBludgeoning', op: 'add', value: 0.26 },
        { stat: 'resWind', op: 'add', value: 0.26 },
        { stat: 'resLightning', op: 'add', value: 0.26 },
      ],
      special: [{ stat: 'maxHp', op: 'mult', value: 0.55 }],
    },
  },
  balor: {
    id: 'balor',
    name: 'Balor Gene',
    icon: '👁️',
    genus: 'gigantoid',
    tier: 4,
    from: 'boss_balor',
    size: 'gargantuan',
    // A cut above its own rung, not merely level with it. There are as many
    // slime kings as there are slimes willing to become one; there is one
    // Balor. The ceiling is where that lives — it rides gear forever, so a
    // raw Balor stays ahead of a perfect forest giant at every gear level,
    // which a flat term alone would stop doing the moment weapons got good.
    flatBase: 1000,
    ceiling: 4.4,
    // Identical to the fomorian's, because that is what a unique variant IS.
    grants: ['onehand:spear', 'onehand:tower shield'],
    // ⚠️ Half an ability. The eye is meant to STACK — each opening widening the
    // next, splashing from three stacks on and killing outright at seven — and
    // a per-fight counter the ability reads and writes is a mechanism nothing
    // else needs yet. What is here is the seventh-stack behaviour on a long
    // cooldown: the execute is real, the ramp that should earn it is not.
    ability: {
      name: 'Eye of Balor',
      icon: '👁️',
      spec: {
        type: 'gene',
        power: 2.6,
        fromStat: 'damage',
        flat: 1000,
        cooldown: 200,
        damageType: 'piercing',
        riders: [{ type: 'dark', value: 200 }],
        splash: 0.25,
        splashAll: true,
        execute: 0.5,
      },
    },
    base: {
      attacks: [
        { stat: 'damage', op: 'mult', value: 0.4, requiresTag: 'spear' },
        { stat: 'vsSmaller', op: 'add', value: 0.12 },
        { stat: 'attackSpeed', op: 'mult', value: 0.15, requiresTag: 'twoHanded' },
      ],
      defenses: [
        { stat: 'resBludgeoning', op: 'add', value: 0.26 },
        { stat: 'resWater', op: 'add', value: 0.28 },
        { stat: 'resDark', op: 'add', value: 0.28 },
      ],
      special: [
        { stat: 'maxHp', op: 'mult', value: 0.55 },
        { stat: 'fromSmaller', op: 'add', value: 0.12 },
      ],
    },
  },
  // TODO: intended: burning creatures cannot reach you (Burning enemies fail to attack the wearer). Not implemented; dropped from the desc.
  surtr: {
    id: 'surtr',
    name: 'Surtr Gene',
    icon: '🗡️',
    genus: 'gigantoid',
    tier: 5,
    from: 'boss_surtr',
    size: 'colossal',
    // The ceiling of the genus and of everything in it. Same rule as Balor,
    // one rung higher: nothing at tier 3 reaches this at any grade, and the
    // capacity it reserves is meant to be most of a chromosome.
    flatBase: 1600,
    ceiling: 5.6,
    grants: ['onehand:greatsword'],
    ability: {
      name: 'Ragnarök',
      icon: '🔥',
      spec: {
        type: 'gene',
        power: 3,
        fromStat: 'damage',
        flat: 1600,
        cooldown: 260,
        damageType: 'heat',
        splash: 1,
        splashAll: true,
        execute: 0.6,
        inflicts: [{ id: 'blazing', intensity: 1 }],
      },
    },
    base: {
      attacks: [
        // "Inverting speed penalties": a two-hander in one hand is not merely
        // free, it is quicker than the same weapon held properly.
        { stat: 'attackSpeed', op: 'mult', value: 0.3, requiresTag: 'twoHanded' },
        { stat: 'damage', op: 'mult', value: 0.35, requiresTag: 'greatsword' },
      ],
      defenses: [
        { stat: 'resHeat', op: 'add', value: 0.5 },
        { stat: 'resSlashing', op: 'add', value: 0.3 },
        { stat: 'resEarth', op: 'add', value: 0.3 },
        // The only thing in the game that moves the ceiling rather than the
        // number under it — headroom nothing else can reach. docs/MUTAGENS.md §7.
        { stat: 'resistCap', op: 'add', value: 0.05 },
      ],
      special: [
        { stat: 'maxHp', op: 'mult', value: 0.7 },
        { stat: 'fromSmaller', op: 'add', value: 0.12 },
      ],
    },
  },

  wyrmling: {
    id: 'wyrmling',
    name: 'Wyrmling Gene',
    icon: '🦎',
    genus: 'draconoid',
    tier: 0,
    from: 'wyrmling',
    flatBase: 90,
    ceiling: 1.7,
    ability: { name: 'Ember Breath', icon: '🔥', spec: { type: 'gene', power: 1.9, fromStat: 'spellPower', cooldown: 100, damageType: 'heat' } },
    base: { active: [{ stat: 'maxMana', op: 'add', value: 8 }] },
  },
  drake: {
    id: 'drake',
    name: 'Drake Gene',
    icon: '🐉',
    genus: 'draconoid',
    tier: 1,
    from: 'drake',
    flatBase: 160,
    ceiling: 2,
    ability: { name: 'Flame Breath', icon: '🔥', spec: { type: 'gene', power: 1.9, fromStat: 'spellPower', cooldown: 100, damageType: 'heat' } },
    base: { active: [{ stat: 'maxMana', op: 'add', value: 14 }] },
  },
  wyvern: {
    id: 'wyvern',
    name: 'Wyvern Gene',
    icon: '🐲',
    genus: 'draconoid',
    tier: 2,
    from: 'wyvern',
    flatBase: 280,
    ceiling: 2.4,
    ability: { name: 'Flame Breath', icon: '🔥', spec: { type: 'gene', power: 1.9, fromStat: 'spellPower', cooldown: 100, damageType: 'heat' } },
    base: { active: [{ stat: 'maxMana', op: 'add', value: 22 }] },
  },
  dragon: {
    id: 'dragon',
    name: 'Dragon Gene',
    icon: '🔥',
    genus: 'draconoid',
    tier: 3,
    from: 'dragon',
    flatBase: 490,
    ceiling: 2.9,
    ability: { name: 'Dragon Breath', icon: '🔥', spec: { type: 'gene', power: 1.9, fromStat: 'spellPower', cooldown: 100, damageType: 'heat' } },
    base: { active: [{ stat: 'maxMana', op: 'add', value: 35 }] },
  },

  dvibahu: {
    id: 'dvibahu',
    name: 'Dvibāhu Gene',
    icon: '🫱',
    genus: 'asuroid',
    tier: 0,
    from: 'dvibahu',
    flatBase: 80,
    ceiling: 1.6,
    // The arm itself. A COUNT, not a permission — three hands is "a spear and
    // a shield" with nobody writing a rule for that combination. A CAPABILITY,
    // so a cheap asuroid grows the same arm a refined one does and only the
    // numbers differ (§7).
    grants: ['arms:+1'],
    base: { attacks: [{ stat: 'extraSwings', op: 'add', value: 0.1 }] },
  },
  asura: {
    id: 'asura',
    name: 'Asura Gene',
    icon: '🙌',
    genus: 'asuroid',
    tier: 1,
    from: 'asura',
    flatBase: 340,
    ceiling: 2.6,
    // Where the line is going: the named asura ranas reach `arms:+4` for six
    // in total — three two-handers at once — and need no new concept to do it,
    // only a bigger number.
    grants: ['arms:+2'],
    base: { attacks: [{ stat: 'extraSwings', op: 'add', value: 0.35 }] },
  },

  /*
   * ---- The asurendra ----
   *
   * Tier 5, and each one BREAKS A RULE OF THE GAME rather than bending a
   * number. That is the tier's identity: an asura has more arms, an asurendra
   * has stopped playing by the part of the game the arms were for.
   *
   * ⚠️ The tier jumps 1 → 5 on purpose. Cost is keyed to `flatBase` and not to
   * the ordinal (see `mainCost`), so the gap is a statement about DISTANCE
   * rather than an index that has to be dense.
   */
  asurendra_tarunavak: {
    id: 'asurendra_tarunavak',
    name: 'Tarunavāk, of Sixteen Tongues',
    icon: '🗣️',
    genus: 'asuroid',
    tier: 5,
    from: 'asurendra_tarunavak',
    flatBase: 1400,
    ceiling: 4.8,
    grants: ['arms:+2'],
    /*
     * SIXTEEN, literally — thirteen nouns and the three physical verbs, which
     * earn their place by answering different resistances than any element
     * does. Never paired: the grammar treats a lone word as a real cast, so
     * each already carries its own type, strength and condition, and pairing
     * them would blend sixteen distinct outcomes into one average.
     */
    tongues: {
      words: [
        'fire', 'ice', 'spark', 'water', 'gust', 'stone', 'seed', 'venom',
        'acid', 'light', 'gloom', 'iron', 'arcane', 'pierce', 'cut', 'crush',
      ],
      everyTicks: [20, 10],
      power: [0.6, 1.2],
    },
    ability: {
      name: 'Unsaying',
      icon: '🌀',
      spec: {
        type: 'gene',
        flat: 60,
        power: 1,
        fromAttr: 'cha',
        cooldown: 200,
        damageType: 'arcane',
        // Everything standing, splitting one payout — see `clearsField`.
        splashAll: true,
        clearsField: true,
      },
    },
    base: { attacks: [{ stat: 'extraSwings', op: 'add', value: 0.35 }] },
  },

  asurendra_vashkara: {
    id: 'asurendra_vashkara',
    name: 'Vashkāra of the Unheld Blades',
    icon: '🌀',
    genus: 'asuroid',
    tier: 5,
    from: 'asurendra_vashkara',
    flatBase: 1400,
    ceiling: 4.8,
    // Six grips, all of them telekinetic — `telekinetic` is counted against
    // `arms` (wield.ts), so this is "six, none of which are hands".
    grants: ['arms:+4', 'telekinetic:6'],
    ability: {
      name: 'Every Blade at Once',
      icon: '🗡️',
      spec: {
        type: 'gene',
        cooldown: 240,
        // No damage of its own: a volley is the floating grips' ordinary strike,
        // fired several times over one second. See CombatState.floating.
        volley: { hits: [4, 8], ticks: 10 },
      },
    },
    base: { attacks: [{ stat: 'crit', op: 'add', value: 0.04 }] },
  },

  /*
   * THE RULE IT BREAKS: every other stacking condition in the game declares a
   * cap. Bleeding stops at 5, seeded at 6, a chill at 1 before it stops being a
   * chill. `hunger_anupama` declares none, because a fast has no depth at which
   * it is satisfied — and everyone in the fight feeds it, the wearer included,
   * simply by acting.
   *
   * The arms invert what an attack arm and a defence arm are for. The attack
   * arm grants no damage at all: it pays out in REGENERATION instead, rooted
   * off what the body itself could hit for, so it rewards a build that could
   * strike hard and does not. The defence arm is paid by the hunger standing on
   * the field rather than by anything the body owns.
   *
   * ⚠️ TODO: the Active is authored as wholly dark. The design asks for HALF of
   * it to bypass resistance, the way `hunger_anupama`'s dot does through
   * `StatusDot.pierce` — but a gene ability has no equivalent share, and
   * `riders` are typed. Needs an `untypedShare` on the gene spec, or the same
   * pierce idea lifted to the ability. Deliberately left as a known gap rather
   * than quietly dropped: see docs/plans/anupama-fasting-amidst-sinners.md.
   */
  asurendra_anupama: {
    id: 'asurendra_anupama',
    name: 'Anupama, Fasting Amidst Sinners',
    icon: '🕳️',
    genus: 'asuroid',
    tier: 5,
    from: 'asurendra_anupama',
    flatBase: 1400,
    ceiling: 4.8,
    // The Special itself. A condition and not a flag, because the monster half
    // of this body has to be able to say the same thing through
    // `MonsterDef.wears` — see the card.
    confers: [{ id: 'fasting' }],
    /*
     * Placeholders, all five. The shapes are settled and the numbers are not:
     * balance them against a real fight rather than at the desk
     * (docs/plans/balance-harness.md is the tool that will answer them).
     */
    fasts: {
      // 4th root at F down to 2.5th at S — a lower root is stronger, which is
      // why this pair descends where every other graded range climbs.
      regenRoot: [4, 2.5],
      regenMult: 0.05,
      armorPerLogHunger: 6,
      wardPerLogHunger: 0.25,
      // Nothing is ever wholly proof against being afflicted, only against what
      // the affliction is worth.
      wardMax: 0.6,
    },
    ability: {
      name: 'The Weight of Hunger',
      icon: '⚖️',
      spec: {
        type: 'gene',
        cooldown: 240,
        damageType: 'dark',
        // Priced off what THEY are carrying rather than off anything of yours —
        // the only ability in the game that does. `inflictRoot` makes the slow
        // it leaves scale with the same count, asked per target, so a room of
        // unequal appetites is slowed unequally.
        perTargetStacks: { status: 'hunger_anupama', power: 3, inflictRoot: [4, 2.5] },
        // "All creatures in combat" — the room, not the blow's path.
        splash: 1,
        splashAll: true,
        inflicts: [{ id: 'weight_of_hunger' }],
      },
    },
    // No `attacks` entry at all: "uniquely no bonus to damage" is the identity,
    // and the arm's payout is the regeneration in `fasts` instead. The defence
    // arm's armour is likewise dynamic and lives there, not here.
    base: {},
  },

  asurendra_niraksha: {
    id: 'asurendra_niraksha',
    name: 'Nirākṣa who Swallowed His Eyes',
    icon: '🕳️',
    genus: 'asuroid',
    tier: 5,
    from: 'asurendra_niraksha',
    flatBase: 1400,
    ceiling: 4.8,
    grants: ['arms:+4'],
    // Six arms in total, which the six HAND_SLOTS already exist to hold.
    confers: [{ id: 'eyeless', intensity: 1 }],
    // What it opens, stays open. Permanent within the fight the target does not
    // survive — and `blinded` is where a sighted thing keeps its accuracy.
    onCrit: [{ id: 'blinded', intensity: 1, duration: 'permanent' }],
    ability: {
      name: 'The Long Word',
      icon: '👁️',
      spec: {
        type: 'gene',
        flat: 120,
        power: 2.2,
        fromStat: 'damage',
        cooldown: 260,
        damageType: 'dark',
        /*
         * The bar keeps filling at a third of its rate throughout, so the cost
         * is not one action but most of several — and `critBonus: 1` makes the
         * blow certain rather than likely, with anything past certainty rolling
         * again for a second multiplier.
         */
        incant: { ticks: [60, 30], fillMult: 1 / 3, critBonus: 1 },
      },
    },
    base: { attacks: [{ stat: 'extraSwings', op: 'add', value: 0.35 }] },
  },

  asurendra_kritavya: {
    id: 'asurendra_kritavya',
    name: 'Kritavya, Refuter of Creation',
    icon: '🚫',
    genus: 'asuroid',
    tier: 5,
    from: 'asurendra_kritavya',
    flatBase: 1400,
    ceiling: 4.8,
    grants: ['arms:+2'],
    /*
     * ⚠️ It refuses YOUR castings too, and that is the gene rather than a
     * drawback bolted on: a body that refuses creation cannot be persuaded to
     * make an exception for its own hands. Wearing it is choosing to fight
     * without reliable magic, and the reward is that nobody else has any either.
     */
    refutes: { negate: [0.3, 0.9], lockout: [0.15, 0.66], perCast: 0.03 },
    ability: {
      name: 'Refutation',
      icon: '🚫',
      spec: {
        type: 'gene',
        flat: 0,
        cooldown: 300,
        damageType: 'arcane',
        grants: [{ id: 'refutation', intensity: 1 }],
        grantDuration: [100, 200],
      },
    },
    base: { attacks: [{ stat: 'extraSwings', op: 'add', value: 0.35 }] },
  },
});

// ---------- Mutagens ----------

/**
 * Mutagens key on a monster TAG, never a species — a fire slime and a fire ogre
 * both carry `fire`, so both drop the ember mutation. That is what makes most
 * mutagens findable off a handful of species while the gene collection needs
 * the whole bestiary.
 *
 * ⚠️ `from` must be a real tag from bestiary.data.ts. An invented one is not a
 * content error anything else will catch — it simply means the mutagen never
 * drops, silently, forever. There is a test for exactly this.
 *
 * A mutagen does two separable things, and §7 treats them differently:
 *   - `effect`  — what it contributes on arrival at its native arm. Magnitudes
 *                 here are scaled by intensity and capped by the main gene's
 *                 ceiling; `grants` are capabilities and are never capped.
 *   - `transform` — what it does to anything passing THROUGH it. This is where
 *                 the sequence identity lives: order of traversal is the recipe.
 */
/*
 * ⚠️ CAPABILITY WIRING, as of 2026-08-07. `onehand:*` and `arms:+N` are read by
 * wield.ts anywhere. `ignores_dodge`, `splits_target` and `inflicts_<status>`
 * are read ONLY when routed into the ACTIVE arm, where they alter the gene's
 * ability (docs/MUTAGENS.md §12.3, adopted for that arm alone). In any other
 * arm they still arrive and still do nothing — the panel says so.
 *
 * Read §7a before wiring another one: a capability is free of COST, not free of
 * scrutiny, and each owes the question "does this compound with itself?" that
 * magnitudes never have to answer.
 */

/**
 * THE ELEMENTAL TRIPARTITION.
 *
 * Every element splits into three building blocks that do exactly one thing
 * each, so a player composing a body picks axes rather than bundles:
 *
 *   - **Edge** — carries the damage TYPE, and re-types whatever passes through
 *     it. Routed into Active it re-types the gene's ability.
 *   - **Brand** — carries a CONDITION and brands what passes through it. Routed
 *     into Active the ability starts leaving that condition behind.
 *   - **Ward** — carries RESISTANCE, and nothing else. This is the leg that
 *     already existed as Chill and Ember.
 *
 * The blocks were bundled before: Chill was resistance *and* type *and* a
 * re-type, so "I want the cold, not the ice armour" was unsayable. Splitting
 * them is why there are three names per element instead of one.
 *
 * Conditions name the BASE form deliberately — brand something repeatedly and
 * the stack escalates on its own (buffeted → unfooted, shardbound → shardbloom).
 * Escalation is the status system's job and the mutagen never mentions it.
 *
 * ⚠️ `tag` must be a real monster tag AND one some monster actually carries, or
 * the block never drops. All eleven below are carried today.
 */
interface ElementLine {
  /** The monster tag that drops this element's blocks. */
  tag: string;
  type: DamageType;
  res: StatKey;
  /** Base-form status the Brand leaves. Escalation is the status system's. */
  condition: string;
  edge: { id: string; name: string; icon: string };
  brand: { id: string; name: string; icon: string };
  /** Omitted where a hand-written Ward already covers this element. */
  ward?: { id: string; name: string; icon: string };
}

const ELEMENT_LINES: ElementLine[] = [
  {
    tag: 'fire', type: 'heat', res: 'resHeat', condition: 'on_fire',
    edge: { id: 'searing_edge', name: 'Searing Edge', icon: '☄️' },
    brand: { id: 'kindling_brand', name: 'Kindling Brand', icon: '🕯️' },
    // Ward: `ember`, hand-written below.
  },
  {
    tag: 'ice', type: 'cold', res: 'resCold', condition: 'chilled',
    edge: { id: 'rime_edge', name: 'Rime Edge', icon: '🧊' },
    brand: { id: 'frostbite_brand', name: 'Frostbite Brand', icon: '🥶' },
    // Ward: `chill`, hand-written below.
  },
  {
    tag: 'lightning', type: 'lightning', res: 'resLightning', condition: 'jolted',
    edge: { id: 'storm_edge', name: 'Storm Edge', icon: '🌩️' },
    brand: { id: 'arcing_brand', name: 'Arcing Brand', icon: '🔌' },
    ward: { id: 'grounding', name: 'Grounding Mutation', icon: '🧲' },
  },
  {
    tag: 'earth', type: 'earth', res: 'resEarth', condition: 'shardbound',
    edge: { id: 'grit_edge', name: 'Grit Edge', icon: '⛰️' },
    brand: { id: 'tremor_brand', name: 'Tremor Brand', icon: '🌋' },
    // `crystal` drops from earth too but wards LIGHT — a deliberate sidegrade
    // kept from before the tripartition, so earth still needs its own.
    ward: { id: 'bedrock', name: 'Bedrock Mutation', icon: '🪨' },
  },
  {
    tag: 'wind', type: 'wind', res: 'resWind', condition: 'buffeted',
    edge: { id: 'gale_edge', name: 'Gale Edge', icon: '🌬️' },
    brand: { id: 'buffet_brand', name: 'Buffet Brand', icon: '🍃' },
    ward: { id: 'streamlined', name: 'Streamlined Mutation', icon: '🪶' },
  },
  {
    tag: 'water', type: 'water', res: 'resWater', condition: 'wet',
    edge: { id: 'tide_edge', name: 'Tide Edge', icon: '🌊' },
    brand: { id: 'drench_brand', name: 'Drench Brand', icon: '💦' },
    ward: { id: 'sealskin', name: 'Sealskin Mutation', icon: '🦭' },
  },
  {
    // Nature's condition is `seeded`, which is poison-TYPED but unambiguously
    // the wood condition; its damage leg takes acid, the sap-and-digestion
    // reading. The one place the table is not a clean bijection.
    tag: 'nature', type: 'acid', res: 'resAcid', condition: 'seeded',
    edge: { id: 'thorn_edge', name: 'Thorn Edge', icon: '🌵' },
    brand: { id: 'seeding_brand', name: 'Seeding Brand', icon: '🌱' },
    ward: { id: 'barkskin', name: 'Barkskin Mutation', icon: '🪵' },
  },
  {
    tag: 'arcane', type: 'arcane', res: 'resArcane', condition: 'unravelling',
    edge: { id: 'runic_edge', name: 'Runic Edge', icon: '🔮' },
    brand: { id: 'unravelling_brand', name: 'Unravelling Brand', icon: '🌀' },
    ward: { id: 'warded', name: 'Warded Mutation', icon: '📿' },
  },
  {
    tag: 'light', type: 'light', res: 'resLight', condition: 'dazzled',
    edge: { id: 'radiant_edge', name: 'Radiant Edge', icon: '🌟' },
    brand: { id: 'dazzle_brand', name: 'Dazzle Brand', icon: '🔆' },
    ward: { id: 'gleam', name: 'Gleam Mutation', icon: '🪞' },
  },
  {
    // `tainted` is the DARK condition, not the toxic one — which is why the
    // long-inert `inflicts_tainted` grant belongs here rather than on Tainting.
    tag: 'dark', type: 'dark', res: 'resDark', condition: 'tainted',
    edge: { id: 'umbral_edge', name: 'Umbral Edge', icon: '🌘' },
    brand: { id: 'taint_brand', name: 'Tainting Brand', icon: '🌑' },
    ward: { id: 'nightsight', name: 'Nightsight Mutation', icon: '🦇' },
  },
  {
    tag: 'toxic', type: 'poison', res: 'resPoison', condition: 'poison',
    edge: { id: 'venom_edge', name: 'Venom Edge', icon: '🐍' },
    brand: { id: 'miasma_brand', name: 'Miasma Brand', icon: '☠️' },
    // Ward: `tainting`, hand-written below.
  },
];

/** What one Edge adds on arrival, on top of the type it carries. */
const EDGE_DAMAGE = 0.05;
/** What one Ward is worth. In the band the hand-written ones already sit in. */
const WARD_RESISTANCE = 0.06;

function elementalBlocks(): Record<string, MutagenDef> {
  const out: Record<string, MutagenDef> = {};
  for (const line of ELEMENT_LINES) {
    out[line.edge.id] = {
      ...line.edge,
      native: 'attacks',
      from: line.tag,
      effect: { type: line.type, mods: [{ stat: 'damage', op: 'mult', value: EDGE_DAMAGE }] },
      transform: { retype: line.type },
    };
    out[line.brand.id] = {
      ...line.brand,
      native: 'active',
      from: line.tag,
      // No mods at all: a Brand is a pure capability, so §7 says it rides free
      // of the ceiling and reads the same off a cheap gene as an expensive one.
      effect: { grants: [`inflicts_${line.condition}`] },
      transform: { grants: [`inflicts_${line.condition}`] },
    };
    if (line.ward) {
      out[line.ward.id] = {
        ...line.ward,
        native: 'defenses',
        from: line.tag,
        effect: { mods: [{ stat: line.res, op: 'add', value: WARD_RESISTANCE }] },
      };
    }
  }
  return out;
}

export const MUTATIONS: Record<string, MutagenDef> = {
  // ---------- Wards written before the tripartition ----------
  // Kept by hand because their ids are in save files and their numbers were
  // tuned; stripped of the `type`/`retype` they used to carry, which now lives
  // on the matching Edge where a player can take it separately.
  chill: {
    id: 'chill',
    name: 'Chill Mutation',
    icon: '❄️',
    native: 'defenses',
    from: 'ice',
    effect: { mods: [{ stat: 'resCold', op: 'add', value: 0.05 }] },
  },
  ember: {
    id: 'ember',
    name: 'Ember Mutation',
    icon: '🔥',
    native: 'defenses',
    from: 'fire',
    effect: { mods: [{ stat: 'resHeat', op: 'add', value: 0.05 }] },
  },
  crystal: {
    id: 'crystal',
    name: 'Crystal Mutation',
    icon: '💎',
    native: 'defenses',
    from: 'earth',
    // Drops from earth and wards LIGHT, at a bludgeoning price. A sidegrade
    // rather than a leg of the table, and deliberately left crooked.
    effect: {
      mods: [
        { stat: 'resLight', op: 'add', value: 0.12 },
        { stat: 'resBludgeoning', op: 'add', value: -0.06 },
      ],
    },
  },
  tainting: {
    id: 'tainting',
    name: 'Tainting Mutation',
    icon: '🧪',
    native: 'defenses',
    from: 'toxic',
    // Its old `inflicts_tainted` transform moved to the Tainting BRAND, where
    // the condition leg lives — `tainted` is a dark condition, not a toxic one.
    effect: { mods: [{ stat: 'resPoison', op: 'add', value: 0.1 }] },
  },

  // ---------- Amplifiers ----------
  /*
   * Two ways to be worth more than you are, and they are opposites.
   *
   * A CONDUIT multiplies whatever passes through it and contributes nothing of
   * its own: put it between a strong mutagen and the centromere. A CATALYST
   * contributes nothing and multiplies nothing passing through — it raises the
   * output of whatever its own route runs INTO, which means it wants to sit
   * one step further out than the thing it is helping.
   *
   * Both compound through each other, and both are held by the main gene's
   * ceiling like every other magnitude — see `contributionWeight`. Without that
   * clamp a chain of amplifiers would be the only build worth playing.
   */
  resonance: {
    id: 'resonance',
    name: 'Resonant Mutation',
    icon: '📡',
    native: 'special',
    from: 'arcane',
    transform: { mult: 1.5 },
  },
  catalyst: {
    id: 'catalyst',
    name: 'Catalytic Mutation',
    icon: '⚗️',
    native: 'special',
    from: 'incorporeal',
    amplify: 1.5,
  },

  // ---------- The rest of the originals ----------
  elastic: {
    id: 'elastic',
    name: 'Elastic Mutation',
    icon: '🫧',
    native: 'attacks',
    from: 'slime',
    // Ignoring dodge is a capability, not a magnitude — it reads the same off a
    // cheap gene as an expensive one, which is the point of §7.
    effect: { grants: ['ignores_dodge'], mods: [{ stat: 'crit', op: 'add', value: 0.03 }] },
    transform: { mult: 1.15 },
  },
  bouncing: {
    id: 'bouncing',
    name: 'Bouncing Mutation',
    icon: '🎾',
    native: 'attacks',
    from: 'vermin',
    effect: { grants: ['splits_target'] },
    transform: { grants: ['splits_target'] },
  },
  vigorous: {
    id: 'vigorous',
    name: 'Vigorous Mutation',
    icon: '💗',
    native: 'defenses',
    from: 'beast',
    effect: { mods: [{ stat: 'maxHp', op: 'mult', value: 0.08 }] },
  },
  studious: {
    id: 'studious',
    name: 'Studious Mutation',
    icon: '📘',
    native: 'special',
    from: 'construct',
    effect: { mods: [{ stat: 'skillXp', op: 'mult', value: 0.05 }] },
  },
  fleet: {
    id: 'fleet',
    name: 'Fleet Mutation',
    icon: '💨',
    native: 'special',
    from: 'wind',
    effect: { mods: [{ stat: 'speed', op: 'mult', value: 0.04 }] },
    transform: { mult: 1.1 },
  },

  ...elementalBlocks(),
};

// ---------- Nucleases ----------

/**
 * A NUCLEASE changes WHAT, never HOW MUCH.
 *
 * Every other thing in this file moves a number: an effect contributes one, a
 * transform scales one, an amplifier multiplies one. A nuclease rewrites a
 * KEY — which element a body is weak to, which stat a bonus reads — and leaves
 * every magnitude exactly where it was. That is what finally gives the arms
 * that are otherwise magnitude sinks something qualitative to route.
 *
 * Two rules follow from "changes what, not how much", and both are load-bearing:
 *
 *  - **Gradeless.** Grade scales magnitude and a nuclease has none, so a graded
 *    one would cost more capacity for nothing — the exact trap mutagen quality
 *    was before it was fixed (docs/MUTAGENS.md §9).
 *  - **Unfittable alone.** A nuclease names an operation but not a subject. It
 *    is fused with a mutation at the culture bench, and the MUTATION's element
 *    is what the rekey writes.
 */
export interface NucleaseDef {
  id: string;
  name: string;
  icon: string;
  kind: NucleaseKind;
  from?: string;
  desc: string;
}

export const NUCLEASES = prose<NucleaseDef>('NUCLEASES', NUCLEASES_TEXT, {
  vuln: {
    id: 'vuln',
    name: 'Vulnerability Nuclease',
    icon: '🧬',
    kind: 'vulnerability',
    // ⚠️ A real tag something CARRIES, not merely a real tag. `eldritch` reads
    // better and is carried by no monster in the game, which would have made
    // this undroppable and silent — the trap §9 warns about, and the one the
    // gigantoid line is still sitting in.
    from: 'undead',
  },
});

/**
 * The element a mutation speaks for, whichever leg of the tripartition it is.
 *
 * A nuclease is fused with "any cold mutation", not with a cold *Edge* — so an
 * Edge (carries the type), a Ward (resists the type) and a Brand (leaves the
 * type's condition) all count, and the element is read off whichever of the
 * three shapes the mutagen happens to be.
 */
export function elementOf(def: MutagenDef): DamageType | undefined {
  if (def.effect?.type) return def.effect.type;
  if (def.transform?.retype) return def.transform.retype;
  for (const mod of def.effect?.mods ?? []) {
    const typed = TYPE_BY_RES_STAT[mod.stat];
    if (typed) return typed;
  }
  for (const grant of def.effect?.grants ?? []) {
    if (!grant.startsWith('inflicts_')) continue;
    const element = STATUSES[grant.slice('inflicts_'.length)]?.element;
    if (element) return element;
  }
  return undefined;
}

/** resHeat → heat. The inverse of RES_STAT_BY_TYPE, built once. */
const TYPE_BY_RES_STAT: Record<string, DamageType> = Object.fromEntries(
  Object.entries(RES_STAT_BY_TYPE).map(([type, stat]) => [stat, type as DamageType]),
);

/**
 * Every nuclease × every ELEMENT some mutation can supply.
 *
 * ⚠️ THE NUCLEASE IS THE PRODUCT. The mutation fused into it is consumed purely
 * as a source of its element and contributes nothing else — so **any** poison
 * mutagen plus a vulnerability nuclease makes the same Poison Vulnerability,
 * whether it was the Venom Edge, the Miasma Brand or a poison Ward. The fused
 * thing keeps no effect and no transform of its parent's; it carries a rekey
 * and nothing besides, because "changes what, never how much" has to be true of
 * the whole product and not merely of the part that was bolted on.
 *
 * Keyed by element rather than by parent for the same reason: three parents
 * that mean "poison" must not become three different tools.
 *
 * Generated rather than authored because mutagens are STACKS — `state.stock`
 * is keyed by id and quality with no room for per-instance data, so a fused
 * mutagen has to be its own material id. It rides the same door genes and
 * mutagens already come through (materials.data.ts).
 */
function fusedMutagens(): Record<string, MutagenDef> {
  const elements = new Set<DamageType>();
  for (const parent of Object.values(MUTATIONS)) {
    const element = elementOf(parent);
    if (element) elements.add(element);
  }
  const out: Record<string, MutagenDef> = {};
  for (const nuclease of Object.values(NUCLEASES)) {
    for (const element of elements) {
      const id = `${nuclease.id}_${element}`;
      out[id] = {
        id,
        name: `${DAMAGE_TYPE_NAMES[element]} ${nuclease.name.replace(/ Nuclease$/, '')}`,
        icon: nuclease.icon,
        native: NUCLEASE_ARM[nuclease.kind],
        rekey: { kind: nuclease.kind, to: element },
      };
    }
  }
  return out;
}

/** Which domain each kind of rekey speaks about. Presentation only. */
const NUCLEASE_ARM: Record<NucleaseKind, MutagenArm> = {
  vulnerability: 'defenses',
  resistance: 'defenses',
  attribute: 'special',
  skill: 'special',
  offensive: 'attacks',
  elemental: 'special',
};

/** Fused mutagens, folded in so every consumer sees them as ordinary mutations. */
for (const [id, def] of Object.entries(fusedMutagens())) MUTATIONS[id] = def;
