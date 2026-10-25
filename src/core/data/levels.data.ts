/**
 * Character level (docs/LEVELS.md). One general-strength track next to the
 * per-skill and per-attribute XP.
 *
 * - Paid by: kills, quest turn-ins, a floor's first clear in the run.
 * - Pays: +LEVEL_ATTR_BONUS to all six attributes per level above 1.
 * - Resets with the run. The Head Start prestige boon raises the level a
 *   run starts at.
 *
 * Calibrated with tests/john.ts: band 1 (floors 1–3) ends at about level 5.
 */

/** Added to every attribute per level above 1. */
export const LEVEL_ATTR_BONUS = 1;

/** XP from level L to L + 1 is LEVEL_XP_BASE × L^LEVEL_XP_EXP, rounded. */
export const LEVEL_XP_BASE = 110;
export const LEVEL_XP_EXP = 1.5;

/** Kill XP = the spawned monster's XP (already level- and tier-scaled) × this. */
export const KILL_LEVEL_XP_RATE = 1;

/**
 * A kill never earns less than this, however far the fighter has outgrown
 * the monster (user, 2026-10-22). The level-gap share is `levelGapXpMult` in
 * systems/levels.ts.
 */
export const MIN_KILL_XP = 1;

/** A quest turn-in with no `rewards.levelXp` of its own pays this. */
export const DEFAULT_QUEST_LEVEL_XP = 50;
