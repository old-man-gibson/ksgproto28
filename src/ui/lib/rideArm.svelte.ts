import type { GameState } from '../../core/types';
import { game } from '../state.svelte';
import type { RideAction } from './ladderView';

/**
 * The ride buttons' shared behaviour (AscentPanel.svelte, TowerSection.svelte):
 * what a press calls, and the festival's two-click forfeit.
 *
 * Leaving floors 15-16 during an attempt is a loss (systems/towers.ts
 * `forfeitFestival`), so a forfeit button asks twice: the first press arms it,
 * the second runs it. `armed` is the one key of the button that has been
 * pressed once, shared by every place the buttons are drawn, so a press in one
 * place and a press in another cannot both be armed.
 */
const arm = $state<{ key: string | null }>({ key: null });

/** The key of the forfeit button waiting for its second press, or null. */
export function armedKey(): string | null {
  return arm.key;
}

/** Drop the first press. Called when the player moves on to another stop or the attempt ends. */
export function disarmRide(): void {
  arm.key = null;
}

/** Whether the ride buttons are held back: knocked out, in a forced fight, or already riding. */
export function rideBlocked(state: GameState): boolean {
  return state.recovering || !!state.combat?.forced || !!state.travel;
}

/** A press on a ride button: a forfeit arms first, anything else runs. */
export function pressRide(action: RideAction): void {
  if (action.kind === 'forfeit' && arm.key !== action.key) {
    arm.key = action.key;
    return;
  }
  arm.key = null;
  if ('band' in action.target) game.climbToHub(action.target.band);
  else game.climbTo(action.target.floor);
}
