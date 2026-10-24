import type { GameState, HeatWindow, QualityTier } from '../types';
import { DISCIPLINES } from '../data/disciplines.data';
import { MATERIALS } from '../data/materials.data';
import { QUALITY_ORDER } from '../data/quality.data';
import { cookbookRank } from './legacy';

/**
 * The Cook's Book: what the player has cooked, read back out of the counters
 * `cook()` keeps (`cooked:<dish>` and `cooked:<dish>:<tier>`, state.stats).
 *
 * There is no Book in the save. The counters are the record, and this module is
 * the only place that turns them into rows, thresholds and the Signature check,
 * so the screen, the eating code and the prestige carry cannot disagree.
 *
 * Two thresholds, both counted in cooks of the DISH (a material id, so the
 * Traveler's Ration made at the stove and at the grill is one count):
 *
 *  - `COOK_TIME_COOKS`: the dish's cook time (its heat window) is shown.
 *  - `SIGNATURE_COOKS`: eating it also grants its `ConsumableSpec.signature`.
 *
 * The counters reset with the run like every other stat. The Cook's Notes boon
 * (docs/PRESTIGE.md) carries the thresholds, not the counters: `prestigeNow`
 * stores which dishes reached each one (`PrestigeState.cookbook`), and rank 1
 * reads the first list, rank 2 the second as well.
 */

/** Cooks of one dish before the Book shows its cook time. */
export const COOK_TIME_COOKS = 25;
/** Cooks of one dish before it grants its Signature when eaten. */
export const SIGNATURE_COOKS = 100;

export const cookedKey = (dishId: string): string => `cooked:${dishId}`;
export const cookedGradeKey = (dishId: string, tier: QualityTier): string => `cooked:${dishId}:${tier}`;

/** Times this dish has been cooked this run. */
export function cookedCount(state: GameState, dishId: string): number {
  return state.stats[cookedKey(dishId)] ?? 0;
}

/** Whether the Book shows this dish's cook time: cooked enough this run, or kept by Cook's Notes. */
export function cookTimeKnown(state: GameState, dishId: string): boolean {
  if (cookedCount(state, dishId) >= COOK_TIME_COOKS) return true;
  return cookbookRank(state) >= 1 && (state.prestige?.cookbook?.timed ?? []).includes(dishId);
}

/**
 * Whether eating this dish grants its Signature: cooked enough this run, or kept
 * by Cook's Notes rank 2. False for a dish with no Signature authored.
 */
export function signatureEarned(state: GameState, dishId: string): boolean {
  if (!MATERIALS[dishId]?.consumable?.signature?.length) return false;
  if (cookedCount(state, dishId) >= SIGNATURE_COOKS) return true;
  return cookbookRank(state) >= 2 && (state.prestige?.cookbook?.signed ?? []).includes(dishId);
}

/** One row of the Book: a cooking-bench outcome and what the player has made of it. */
export interface CookbookEntry {
  outcomeId: string;
  benchId: string;
  /** The material the outcome makes. Counts are per dish, shared by every outcome that makes it. */
  dishId: string;
  /** Times this dish has been cooked this run. */
  made: number;
  /** `made` split by the grade each cook came out at. */
  byGrade: Record<QualityTier, number>;
  /** The best grade cooked, or null while `made` is 0. Never falls. */
  best: QualityTier | null;
  /** The cook time is shown (`cookTimeKnown`). */
  cookTimeKnown: boolean;
  /** The Signature is earned (`signatureEarned`); false for a dish that has none. */
  signature: boolean;
  /**
   * The outcome's heat windows. Present only when the outcome has windows AND
   * `cookTimeKnown`: a row that has not earned its cook time must not leak it.
   */
  heat?: HeatWindow[];
}

/**
 * Every dish a cooking bench can make, one row per outcome: bench order, then
 * the bench's outcome order. Rows for learned dishes are listed whether or not
 * the recipe has been read, and the cutting board's cut (a prepped result) is
 * not a dish and has no row. What a row SHOWS for a dish not yet made is the
 * screen's decision; this returns the data for every row.
 */
export function cookbook(state: GameState): CookbookEntry[] {
  const rows: CookbookEntry[] = [];
  for (const disc of Object.values(DISCIPLINES)) {
    if (disc.skill !== 'cooking') continue;
    for (const outcome of disc.outcomes) {
      if (outcome.result.kind !== 'material') continue;
      const dishId = outcome.result.id;
      const byGrade = {} as Record<QualityTier, number>;
      let best: QualityTier | null = null;
      for (const tier of QUALITY_ORDER) {
        const n = state.stats[cookedGradeKey(dishId, tier)] ?? 0;
        byGrade[tier] = n;
        if (n > 0) best = tier; // QUALITY_ORDER runs worst to best
      }
      const known = cookTimeKnown(state, dishId);
      rows.push({
        outcomeId: outcome.id,
        benchId: disc.id,
        dishId,
        made: cookedCount(state, dishId),
        byGrade,
        best,
        cookTimeKnown: known,
        signature: signatureEarned(state, dishId),
        ...(known && outcome.heat?.length ? { heat: outcome.heat } : {}),
      });
    }
  }
  return rows;
}

/** Every material id a cooking bench makes, once each, in bench order. */
export function cookingDishIds(): string[] {
  const ids = new Set<string>();
  for (const disc of Object.values(DISCIPLINES)) {
    if (disc.skill !== 'cooking') continue;
    for (const outcome of disc.outcomes) {
      if (outcome.result.kind === 'material') ids.add(outcome.result.id);
    }
  }
  return [...ids];
}

/**
 * What a prestige carries of the Book: the legacy lists so far plus every dish
 * that reached a threshold this run. Stored whatever rank of Cook's Notes is
 * held at that moment — points are spent AFTER the harvest, so the rank gates
 * the reading (`cookTimeKnown`, `signatureEarned`), not the writing. Never
 * shortens a list.
 */
export function carriedCookbook(state: GameState): { timed: string[]; signed: string[] } {
  const timed = new Set(state.prestige?.cookbook?.timed ?? []);
  const signed = new Set(state.prestige?.cookbook?.signed ?? []);
  for (const dishId of cookingDishIds()) {
    const n = cookedCount(state, dishId);
    if (n >= COOK_TIME_COOKS) timed.add(dishId);
    if (n >= SIGNATURE_COOKS && MATERIALS[dishId]?.consumable?.signature?.length) signed.add(dishId);
  }
  return { timed: [...timed], signed: [...signed] };
}
