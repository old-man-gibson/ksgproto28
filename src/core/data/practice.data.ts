/**
 * Practice targets (docs/PRACTICE.md). A monster with `passive: true` is
 * training equipment: it cannot hurt you, so the XP a fight against it pays
 * is cut, falls with the level of what it trains, and is floored per second.
 *
 * Every skill or attribute payout P at level L inside a practice fight pays
 *
 *   max(P × PRACTICE_XP_CUT × F / (F + L − 1),  min(P, PRACTICE_XP_FLOOR × gap))
 *
 * with F = PRACTICE_XP_FALLOFF and gap = seconds since this fight last paid
 * that skill or attribute, capped at PRACTICE_FLOOR_GAP. The first payout of
 * a fight counts one second. The floor never pays more than P, so a post
 * never out-pays a real target. User, 2026-11-03: "extremely reduced skill
 * and attribute xp, grows diminishingly with skill and attribute level,
 * minimum 1 xp per second"; the floor is per skill and per attribute.
 */

/** Share of a payout a practice target pays at level 1. */
export const PRACTICE_XP_CUT = 0.1;

/**
 * Levels above 1 at which the share halves. It is a third at twice that and
 * a sixth at five times that: F / (F + L − 1).
 */
export const PRACTICE_XP_FALLOFF = 10;

/** XP per second of practice each trained skill and attribute gets at least. */
export const PRACTICE_XP_FLOOR = 1;

/**
 * Longest gap, in seconds, between two payouts to the same skill or attribute
 * that the floor credits. A skill exercised once and then left idle earns the
 * floor for this long, not for the rest of the fight.
 */
export const PRACTICE_FLOOR_GAP = 5;
