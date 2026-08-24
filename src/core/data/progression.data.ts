import type { ProgressionBand, XpBaseTier, XpGrowthRate } from '../types';

/**
 * XP curve content: how expensive a level is, and how fast that gets worse.
 *
 * A curve is a list of BANDS. Each band starts at a level and carries a base
 * cost tier and a growth rate; a skill moves to the next band when it reaches
 * that level, which is how a skill can start cheap-and-steep and end
 * expensive-but-shallow (or the reverse). See `systems/progression.ts` for the
 * arithmetic — the short version is that the base sets the step you take AT a
 * band boundary and the rate sets how the cost compounds WITHIN a band.
 */

/** Base cost tiers: how much a level of this kind of skill is "worth". */
export const XP_BASE: Record<XpBaseTier, number> = {
  beginner: 10,
  novice: 20,
  adept: 30,
  proficient: 40,
  expert: 50,
  master: 75,
  legendary: 100,
};

/**
 * Growth rates, named from the LEARNER's point of view: 'fast' means levels
 * arrive fast, i.e. the smallest per-level cost multiplier.
 */
export const XP_RATE: Record<XpGrowthRate, number> = {
  fast: 1.15,
  normal: 1.175,
  slow: 1.2,
  glacial: 1.225,
};

/**
 * Global grind dial, applied to every skill and attribute cost. At 1 the tables
 * above are used verbatim, which lands within a few percent of the flat curve
 * this replaced for the first ~20 levels — the divergence is all in the tail,
 * where it belongs (a foundational skill costs ~4x the old curve by 40, ~15x by
 * 60). Raise it for a longer game, lower it for a shorter one; it is the one
 * number to reach for before touching any individual curve.
 */
export const XP_SCALE = 1;

/**
 * Named curve shapes. A skill points at one of these rather than spelling out
 * bands, so retuning a whole class of skills is a one-line edit here.
 */
export const PROGRESSIONS = {
  /**
   * Steady drill — the cost of a level steps up at every tier but the pace of
   * compounding never changes. Fundamentals: always learnable, never cheap.
   */
  foundational: [
    { from: 1, base: 'beginner', rate: 'normal' },
    { from: 20, base: 'novice', rate: 'normal' },
    { from: 40, base: 'adept', rate: 'normal' },
    { from: 60, base: 'proficient', rate: 'normal' },
  ],

  /**
   * Picked up by doing, plateaus politely. Cheap to start and quick early, then
   * settles into the ordinary pace. For shallow skills and most actives.
   */
  simple: [
    { from: 1, base: 'beginner', rate: 'fast' },
    { from: 20, base: 'novice', rate: 'normal' },
    { from: 40, base: 'adept', rate: 'normal' },
  ],

  /**
   * A trained discipline — each tier both costs more and compounds harder. The
   * default shape for a second-generation skill in the tree.
   */
  specialist: [
    { from: 1, base: 'novice', rate: 'fast' },
    { from: 20, base: 'adept', rate: 'normal' },
    { from: 40, base: 'proficient', rate: 'slow' },
    { from: 60, base: 'expert', rate: 'slow' },
  ],

  /**
   * Knowledge work. Expensive and slow at first — you are collecting raw
   * observations with nothing to hang them on — then the base jumps but the
   * pace turns fast: each new input teaches you far more than it used to,
   * you just need rarer inputs. Hunting, and anything else that is really
   * pattern-recognition wearing a practical hat.
   */
  insightful: [
    { from: 1, base: 'adept', rate: 'slow' },
    { from: 25, base: 'expert', rate: 'fast' },
  ],

  /**
   * A craft with a fixed cost of materials and an ever-receding horizon. The
   * base never moves — a rune is a rune — but perfecting the cut gets harder
   * at every tier, ending glacial.
   */
  perfectionist: [
    { from: 1, base: 'adept', rate: 'fast' },
    { from: 20, base: 'adept', rate: 'normal' },
    { from: 40, base: 'adept', rate: 'slow' },
    { from: 60, base: 'adept', rate: 'glacial' },
  ],

  /**
   * Rare and deep: skills that already cost you something to find. Starts where
   * other skills end and climbs to legendary, so the last tiers are a genuine
   * long-haul project.
   */
  esoteric: [
    { from: 1, base: 'adept', rate: 'normal' },
    { from: 25, base: 'expert', rate: 'slow' },
    { from: 45, base: 'master', rate: 'slow' },
    { from: 65, base: 'legendary', rate: 'glacial' },
  ],
} satisfies Record<string, ProgressionBand[]>;

/** Curve used by any skill that does not name one. */
export const DEFAULT_PROGRESSION: ProgressionBand[] = PROGRESSIONS.simple;

/**
 * Attribute training. Bands line up with the named training ranks in
 * attributes.data.ts (1/21/41/61/81), so an attribute steps to a costlier base
 * exactly when it earns a new rank title — always at the normal pace, because
 * training is training: it never gets easier, and it never gets harder either.
 */
export const ATTRIBUTE_PROGRESSION: ProgressionBand[] = [
  { from: 1, base: 'beginner', rate: 'normal' },
  { from: 21, base: 'novice', rate: 'normal' },
  { from: 41, base: 'adept', rate: 'normal' },
  { from: 61, base: 'proficient', rate: 'normal' },
  { from: 81, base: 'expert', rate: 'normal' },
];
