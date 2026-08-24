import type { ActivityDef, GameState, SpotDef } from '../types';
import type { EventBus } from '../engine/events';
import { getSpot, SPOTS } from '../registry';
import { conditionsMet } from './conditions';

/**
 * Where you get thrown when a fight you could not flee goes badly.
 *
 * The rule the whole module serves: **you always land somewhere.** A haven
 * gated on a lantern is no haven on the day the lantern broke, so two slots
 * are tracked — the most recent usable one, and the most recent one that asks
 * nothing of anybody — and the second exists purely so the first is allowed to
 * fail. If even that is missing (a fresh save that has never passed a camp),
 * the starting spot catches you, because being deposited nowhere is not a
 * failure state, it is a bug.
 */

/** Rest activities at a spot. A spot may hold several — an inn and a hearth. */
export function restActivities(spot: SpotDef): Extract<ActivityDef, { kind: 'rest' }>[] {
  return spot.activities.filter(
    (a): a is Extract<ActivityDef, { kind: 'rest' }> => a.kind === 'rest',
  );
}

/** True when the spot offers somewhere to rest that this character may use. */
export function canRestAt(state: GameState, spot: SpotDef): boolean {
  return restActivities(spot).some((a) => !a.requires || conditionsMet(state, a.requires));
}

/** True when the spot offers a rest anyone may use, whatever they carry. */
export function isUnconditionalHaven(spot: SpotDef): boolean {
  return restActivities(spot).some((a) => !a.requires || a.requires.length === 0);
}

/**
 * Record the spot as a haven if it is one. Called on arrival, so "most recent"
 * means most recently STOOD IN rather than most recently seen on the map — you
 * cannot fall back to a camp you only ever heard about.
 */
export function noteSafeSpot(state: GameState, spotId: string): void {
  const spot = SPOTS[spotId];
  if (!spot) return;
  if (canRestAt(state, spot)) state.safeSpots.nearest = spotId;
  if (isUnconditionalHaven(spot)) state.safeSpots.unconditional = spotId;
}

/**
 * The spot to retreat to, re-validating the nearest haven against the state
 * you are in NOW — the point of the second slot is that the first is allowed
 * to have closed behind you.
 */
export function retreatSpot(state: GameState): string {
  const nearest = state.safeSpots.nearest;
  if (nearest && SPOTS[nearest] && canRestAt(state, SPOTS[nearest])) return nearest;

  const fallback = state.safeSpots.unconditional;
  if (fallback && SPOTS[fallback]) return fallback;

  // Never nowhere: the first unconditional haven in the world, else the start.
  const anyHaven = Object.values(SPOTS).find((s) => isUnconditionalHaven(s));
  return anyHaven?.id ?? Object.keys(SPOTS)[0];
}

/**
 * Throw the player clear of a fight they could not leave. Combat is already
 * over by the time this runs; this only decides where they wake up.
 */
export function retreatToSafety(state: GameState, bus: EventBus, reason: string): string {
  const to = retreatSpot(state);
  const from = state.spot;
  state.spot = to;
  state.activity = null;
  state.travel = null;
  state.travelPlan = [];
  if (!state.discovered.includes(to)) state.discovered.push(to);

  const dest = getSpot(to);
  bus.emit({
    type: 'log',
    msg: `${reason} You come to at ${dest.icon} ${dest.name}.`,
    kind: 'danger',
  });
  bus.emit({ type: 'arrive', spot: to });
  return from;
}
