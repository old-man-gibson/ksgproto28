import type { CombatState, GameState } from '../types';
import { MONSTERS } from '../registry';
import { TPS } from '../engine/loop';
import {
  PRACTICE_FLOOR_GAP,
  PRACTICE_XP_CUT,
  PRACTICE_XP_FALLOFF,
  PRACTICE_XP_FLOOR,
} from '../data/practice.data';

/**
 * Practice targets (docs/PRACTICE.md, data/practice.data.ts).
 *
 * - A practice target is a `passive` monster: training equipment.
 * - A fight is practice while every enemy still standing is one.
 * - `tickCombat` runs a practice fight's tick inside `practising`, and every
 *   skill and attribute payout made inside it goes through `practiceXp`
 *   (grantAttrXp, addSkillXp). XP paid outside the tick (weather, darkness,
 *   activities, a flask drunk from the panel) is not shaped.
 */

export function isPracticeTarget(defId: string): boolean {
  return MONSTERS[defId]?.passive === true;
}

export function isPracticeFight(c: CombatState | null | undefined): boolean {
  let any = false;
  for (const e of c?.enemies ?? []) {
    if (!e || e.hp <= 0) continue;
    if (!isPracticeTarget(e.defId)) return false;
    any = true;
  }
  return any;
}

/**
 * The save whose practice tick is running, or null. Combat ticks
 * synchronously, so one slot is enough; `practising` restores the outer
 * value, so a nested call cannot leak the scope.
 */
let scope: GameState | null = null;

export function practising<T>(state: GameState, run: () => T): T {
  const outer = scope;
  scope = state;
  try {
    return run();
  } finally {
    scope = outer;
  }
}

/** The share of a payout a practice target pays at `level`, before the floor. */
export function practiceShare(level: number): number {
  return (PRACTICE_XP_CUT * PRACTICE_XP_FALLOFF) / (PRACTICE_XP_FALLOFF + Math.max(1, level) - 1);
}

/**
 * What a payout of `amount` to one skill or attribute at `level` lands as.
 * `key` names it (`skill:<id>`, `attr:<id>`). Unchanged outside a practice
 * tick. Inside one, the larger of the cut payout and the floor for the time
 * since this fight last paid `key`, and the payout is stamped.
 *
 * The floor never lifts a payout above `amount`: a post pays at most what
 * the same blow pays on a real target. Without that, a skill or attribute
 * whose uncut rate is under the floor (DEX at 0.6 XP/s on a fresh save)
 * would train faster on a post than in a fight.
 */
export function practiceXp(state: GameState, key: string, level: number, amount: number): number {
  const c = state.combat;
  if (scope !== state || !c) return amount;
  c.practiceAt ??= {};
  const last = c.practiceAt[key];
  const gap = last === undefined ? 1 : Math.min(PRACTICE_FLOOR_GAP, (state.totalTicks - last) / TPS);
  c.practiceAt[key] = state.totalTicks;
  return Math.max(amount * practiceShare(level), Math.min(amount, PRACTICE_XP_FLOOR * gap));
}
