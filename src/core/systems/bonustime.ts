import type { GameState } from '../types';
import { TPS } from '../engine/loop';

/**
 * Banked idle time. Standing with nothing to do is time the player did not
 * choose to waste — arriving somewhere with no work queued, walking away from
 * the tab mid-errand — so it is banked, one tick per tick, and handed back
 * later as double speed on the player's say-so.
 *
 * The cap matches the offline catch-up cap (save/offline.ts): a night away
 * idle is worth a night of double speed, and no more.
 */
export const BONUS_CAP_TICKS = 8 * 60 * 60 * TPS;

/**
 * Doing nothing: no activity, no journey, no bench run, no performance, no
 * fight, not out cold. Being knocked out is not idleness — it is the cost of
 * the fight, and banking it would pay the player for losing.
 */
export function isIdle(state: GameState): boolean {
  return (
    !state.activity &&
    !state.travel &&
    !state.benchWork &&
    !state.performance &&
    !state.combat &&
    !state.recovering
  );
}

/** Bank one tick if the player is idle right now. Called at the top of every advance. */
export function accrueBonusTime(state: GameState): void {
  if (!isIdle(state)) return;
  state.bonusTime.banked = Math.min(BONUS_CAP_TICKS, state.bonusTime.banked + 1);
}

/**
 * Whether the tick just taken earns a second one: spending is on, the bank
 * holds a tick, and there is work to double. An idle tick is never doubled —
 * that would spend the bank on nothing.
 */
export function spendsBonusTick(state: GameState): boolean {
  return state.bonusTime.spending && state.bonusTime.banked >= 1 && !isIdle(state);
}

export function setBonusSpending(state: GameState, on: boolean): void {
  state.bonusTime.spending = on;
}
