import type { GameState } from '../../core/types';
import { game, gs } from '../state.svelte';
import type { RideAction } from './ladderView';
import { viewport } from './viewport.svelte';

/**
 * The ride buttons' shared behaviour (AscentPanel.svelte, TowerSection.svelte):
 * what a press calls, and the festival's two-click forfeit.
 *
 * Leaving floors 15-16 during an attempt is a loss (systems/towers.ts
 * `forfeitFestival`), so a forfeit button asks twice: the first press arms it,
 * the second runs it. One arm is shared by every place the buttons are drawn, so
 * a press in one place and a press in another cannot both be armed.
 *
 * An arm belongs to the moment it was made in: the stop's key, the spot the
 * player stood on, and which layout carried the button (600 px, viewport.svelte.ts).
 * A different spot, a walk or ride in progress, or the window crossing 600 px
 * makes it void: `armedKey` reads null at once, and `syncArm` (run by an effect
 * on those three) clears it so walking away and back does not bring it back.
 */
interface Arm {
  key: string;
  spot: string;
  wide: boolean;
}

const arm = $state<{ at: Arm | null }>({ at: null });

/** The key of the forfeit button waiting for its second press, or null. */
export function armedKey(): string | null {
  const at = arm.at;
  return at && at.spot === gs.spot && at.wide === viewport.wide && !gs.travel ? at.key : null;
}

/** Drop the first press. Called when the player picks another stop or the attempt ends. */
export function disarmRide(): void {
  arm.at = null;
}

/** Clear an arm made under other conditions than these. */
export function syncArm(spot: string, travelling: boolean, wide: boolean): void {
  const at = arm.at;
  if (at && (at.spot !== spot || at.wide !== wide || travelling)) arm.at = null;
}

// The conditions are watched for as long as the page lives, whether or not a
// button is drawn: a walk unmounts the Ascent panel, and the detail is not
// drawn in the city.
$effect.root(() => {
  $effect(() => {
    syncArm(gs.spot, !!gs.travel, viewport.wide);
  });
});

/** Whether the ride buttons are held back: knocked out, in a forced fight, or already riding. */
export function rideBlocked(state: GameState): boolean {
  return state.recovering || !!state.combat?.forced || !!state.travel;
}

/** A press on a ride button: a forfeit arms first, anything else runs. */
export function pressRide(action: RideAction): void {
  if (action.kind === 'forfeit' && armedKey() !== action.key) {
    arm.at = { key: action.key, spot: gs.spot, wide: viewport.wide };
    return;
  }
  arm.at = null;
  if ('band' in action.target) game.climbToHub(action.target.band);
  else game.climbTo(action.target.floor);
}
