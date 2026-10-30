import type { EventBus } from '../engine/events';
import type { FloorDef, GameState, TowerDef } from '../types';
import { BANDS, FLOORS, FLOOR_BY_AREA, TOWERS, getSpot } from '../registry';
import { getDerivedStats } from './derived';
import { abandonCombat, inForcedFight } from './combat';
import { bandBaseIndex, bandHubAt, bandOpen, floorUnlocked, rungIndex } from './ladder';
import { beginRoyale, festivalLadder, festivalRun } from './festivalRules';
import { retreatToSafety } from './safety';
import { text } from '../text/log';

export {
  bandCleared,
  bandHubAt,
  bandLevelStep,
  bandOpen,
  bandPassed,
  bandBaseIndex,
  clearMet,
  floorCleared,
  floorUnlocked,
  floorsBelow,
  hubStatus,
  ladderFloors,
  rungIndex,
  rungStatus,
} from './ladder';
export type { RungStatus } from './ladder';

/**
 * The tower runtime: what `FloorDef.gate` / `FloorDef.clear` actually mean.
 *
 * The rules, settled 2026-09-06 (plans/alpha-band-one.md):
 *
 * - **Clearing is finishing the floor's declared `clear` conditions** — a
 *   named kill, a spent fight budget, a quest — all read from counters that
 *   already persist, so cleared-ness is derived and needs no save field.
 * - **The ascent is sequential.** A floor opens only once every rung below it
 *   is cleared (and its own `gate` holds). Descending is free by the same
 *   rule: anything below an open floor is open. Since 2026-10-29 a band may
 *   be `any`-order instead (band 3, the city's four directions); the reads
 *   live in systems/ladder.ts.
 * - **No fixed stairs.** Movement between the hub and any unlocked floor is
 *   `climbTo` — ordinary travel priced by rungs crossed, landing on the
 *   floor's `landing` spot. Authored edges into a BANDED floor's area are
 *   forbidden (linted, both layers); fixed transition spots are reserved for
 *   future hidden/special floors, which are bandless and exempt. A band's
 *   own hub (band 3's castle) is a second place the ladder answers, reached
 *   by `climbToHub`, so it needs no edge either.
 */

/** Base ticks to climb (or descend) past one rung of a stack. */
export const CLIMB_TICKS_PER_FLOOR = 45;

/** The floor the player is standing on, if the current spot is on one. */
export function currentFloor(state: GameState): FloorDef | null {
  return FLOOR_BY_AREA.get(getSpot(state.spot).areaId) ?? null;
}

/**
 * The tower whose ladder is reachable from here: standing at its hub spot,
 * at a band's hub, or anywhere on one of its floors. Null anywhere else —
 * the ladder is a thing you walk to, not a menu.
 */
export function towerAt(state: GameState): TowerDef | null {
  const here = currentFloor(state);
  // A bandless floor is off the ladder in both directions: nothing counts it
  // as a rung, and the ladder does not answer from it. Floor 0 (the tutorial)
  // is reached by roads and left by its gate; without this the cell would
  // offer a climb straight past the gate to floor 1.
  if (here) return here.bandId === undefined ? null : (TOWERS[here.towerId] ?? null);
  const band = bandHubAt(state.spot);
  if (band) return TOWERS[band.towerId] ?? null;
  return Object.values(TOWERS).find((t) => t.hubSpot === state.spot) ?? null;
}

/**
 * Where the player stands on the stack, for pricing a climb: the current
 * floor's rung, a band hub's base, or the tower's hub (0).
 */
export function standingIndex(state: GameState): number {
  const here = currentFloor(state);
  if (here) return rungIndex(here);
  const band = bandHubAt(state.spot);
  return band ? bandBaseIndex(band) : 0;
}

/** The word for a move along the stack. Between rungs at one height it is a walk across. */
export function climbVerb(tower: TowerDef, fromIndex: number, toIndex: number): 'Climbing' | 'Descending' | 'Crossing' {
  if (toIndex === fromIndex) return 'Crossing';
  // `direction` is only the word for it: in a stack that runs down, a rising
  // index is a descent.
  return (tower.direction === 'down') === toIndex > fromIndex ? 'Descending' : 'Climbing';
}

/** The tower to ride from here, or null with the reason logged when it matters. */
function rideFrom(state: GameState, bus: EventBus): TowerDef | null {
  if (state.travel || state.recovering) return null;
  if (inForcedFight(state)) {
    bus.emit({ type: 'log', msg: text('common.no_leaving_fight'), kind: 'danger' });
    return null;
  }
  return towerAt(state);
}

/**
 * Ride the stack: travel to a floor's landing (or, with `null`, back to the
 * hub), priced by rungs crossed. Everything downstream of departure —
 * arrival, discovery, havens, ambushes — is `tickTravel`'s, exactly as for a
 * road; a climb is ordinary travel that happens to have no edge.
 */
export function climbTo(state: GameState, bus: EventBus, floorId: string | null): boolean {
  const tower = rideFrom(state, bus);
  if (!tower) return false;
  // Where the ride goes, checked before the festival's rules so a refused
  // climb is never mistaken for a forfeit.
  const floor: FloorDef | null | undefined = floorId === null ? null : FLOORS[floorId];
  if (floor === undefined) return false;
  if (floor && (floor.towerId !== tower.id || !floor.landing || !floorUnlocked(state, floor))) return false;
  const festival = festivalLadder(state, floorId);
  if (festival === 'shut') {
    bus.emit({ type: 'log', msg: text('festival.door_shut'), kind: 'danger' });
    return false;
  }
  if (festival === 'forfeit') return forfeitFestival(state, bus);
  if (!floor?.landing) return ride(state, bus, tower, tower.hubSpot, 0);
  // The climb from the hub into the royale: the clock jumps to the end of the
  // ten days before the ride starts (systems/festivalRules.ts).
  const run = festivalRun(state);
  if (festival === 'royale' && run) beginRoyale(run);
  const toIndex = rungIndex(floor);
  return ride(state, bus, tower, floor.landing, toIndex, seamVerb(state, toIndex));
}

/**
 * The climb log's word for the step out of the floor underfoot into the rung
 * directly above it (`FloorDef.seam`), or undefined. Only a climb of exactly
 * one rung reads it: a climb can skip rungs, and the seam is the step between
 * two neighbours.
 */
function seamVerb(state: GameState, toIndex: number): string | undefined {
  const here = currentFloor(state);
  if (!here || toIndex !== standingIndex(state) + 1) return undefined;
  return here.seam?.verb;
}

/**
 * Leaving floors 15–16 by the ladder before the royale ends is the loss a
 * knockout would be, with the same ejection (docs/FLOOR_IDEAS.md §5.3 item
 * 25): the player lands outside the tower, wherever the climb was going.
 * The attempt's bookkeeping (gear back, the lockout) is systems/festival.ts's,
 * on the arrival this raises.
 */
function forfeitFestival(state: GameState, bus: EventBus): boolean {
  if (state.combat) abandonCombat(state);
  retreatToSafety(state, bus, text('festival.forfeit'));
  return true;
}

/** Ride the stack to a band's hub (band 3's castle) once the band is open. */
export function climbToHub(state: GameState, bus: EventBus, bandId: string): boolean {
  const tower = rideFrom(state, bus);
  if (!tower) return false;
  const band = BANDS[bandId];
  if (!band?.hub || band.towerId !== tower.id || !bandOpen(state, band)) return false;
  // Every band hub is outside the festival: from inside an attempt, a forfeit.
  if (festivalLadder(state, null) === 'forfeit') return forfeitFestival(state, bus);
  return ride(state, bus, tower, band.hub, bandBaseIndex(band));
}

function ride(
  state: GameState,
  bus: EventBus,
  tower: TowerDef,
  to: string,
  toIndex: number,
  seam?: string,
): boolean {
  if (to === state.spot) return false;
  const fromIndex = standingIndex(state);

  if (state.combat) {
    abandonCombat(state);
    bus.emit({ type: 'log', msg: text('common.disengage'), kind: 'combat' });
  }
  state.activity = null;
  state.travelPlan = [];
  state.travelIntent = null;

  const rungs = Math.max(1, Math.abs(toIndex - fromIndex));
  const speed = getDerivedStats(state).travelSpeed;
  const ticks = Math.max(1, Math.round((rungs * CLIMB_TICKS_PER_FLOOR) / speed));
  state.travel = { from: state.spot, to, ticksLeft: ticks, total: ticks };

  const dest = getSpot(to);
  const verb = seam ?? climbVerb(tower, fromIndex, toIndex);
  bus.emit({ type: 'log', msg: text('towers.moving', { verb, icon: dest.icon, name: dest.name }), kind: 'travel' });
  return true;
}
