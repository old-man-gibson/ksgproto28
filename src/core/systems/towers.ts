import type { EventBus } from '../engine/events';
import type { FloorDef, GameState, TowerDef } from '../types';
import { FLOORS, FLOOR_BY_AREA, TOWERS, getSpot } from '../registry';
import { conditionsMet } from './conditions';
import { getDerivedStats } from './derived';
import { abandonCombat, inForcedFight } from './combat';
import { text } from '../text/log';

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
 *   rule: anything below an open floor is open.
 * - **No fixed stairs.** Movement between the hub and any unlocked floor is
 *   `climbTo` — ordinary travel priced by rungs crossed, landing on the
 *   floor's `landing` spot. Authored edges into a BANDED floor's area are
 *   forbidden (linted, both layers); fixed transition spots are reserved for
 *   future hidden/special floors, which are bandless and exempt.
 */

/** Base ticks to climb (or descend) past one rung of a stack. */
export const CLIMB_TICKS_PER_FLOOR = 45;

/** The floor the player is standing on, if the current spot is on one. */
export function currentFloor(state: GameState): FloorDef | null {
  return FLOOR_BY_AREA.get(getSpot(state.spot).areaId) ?? null;
}

/**
 * The tower whose ladder is reachable from here: standing at its hub spot, or
 * anywhere on one of its floors. Null anywhere else — the ladder is a thing
 * you walk to, not a menu.
 */
export function towerAt(state: GameState): TowerDef | null {
  const here = currentFloor(state);
  if (here) return TOWERS[here.towerId] ?? null;
  return Object.values(TOWERS).find((t) => t.hubSpot === state.spot) ?? null;
}

/** The banded floors of one tower in ladder order — the rungs, nothing personal. */
export function ladderFloors(towerId: string): FloorDef[] {
  return Object.values(FLOORS)
    .filter((f) => f.towerId === towerId && f.bandId !== undefined)
    .sort((a, b) => a.index - b.index);
}

/**
 * A floor with no `clear` can never be finished, only visited. The lint keeps
 * that shape off the ladder, and this reads false rather than trivially true
 * so a missing clear can never silently open everything above it.
 */
export function floorCleared(state: GameState, floor: FloorDef): boolean {
  return !!floor.clear?.length && conditionsMet(state, floor.clear);
}

/**
 * Sequential ascent: every rung below must be CLEARED and the floor's own
 * gate met. Off-ladder floors are never "unlocked" — they are reached by
 * authored edges (the hold's door) and advance nothing.
 */
export function floorUnlocked(state: GameState, floor: FloorDef): boolean {
  if (floor.bandId === undefined) return false;
  const below = ladderFloors(floor.towerId).filter((f) => f.index < floor.index);
  if (!below.every((f) => floorCleared(state, f))) return false;
  return !floor.gate || conditionsMet(state, floor.gate);
}

/**
 * How a rung reads on the ladder. `sealed` outranks `gated` on purpose: a
 * floor whose gate happens to be met while the rung below is unfinished is
 * still shut, and saying "locked by gold" about it would be a lie.
 */
export type RungStatus = 'cleared' | 'open' | 'gated' | 'sealed';

export function rungStatus(state: GameState, floor: FloorDef): RungStatus {
  if (floorCleared(state, floor)) return 'cleared';
  if (floorUnlocked(state, floor)) return 'open';
  const below = ladderFloors(floor.towerId).filter((f) => f.index < floor.index);
  return below.every((f) => floorCleared(state, f)) ? 'gated' : 'sealed';
}

/**
 * Ride the stack: travel to a floor's landing (or, with `null`, back to the
 * hub), priced by rungs crossed. Everything downstream of departure —
 * arrival, discovery, havens, ambushes — is `tickTravel`'s, exactly as for a
 * road; a climb is ordinary travel that happens to have no edge.
 */
export function climbTo(state: GameState, bus: EventBus, floorId: string | null): boolean {
  if (state.travel || state.recovering) return false;
  if (inForcedFight(state)) {
    bus.emit({ type: 'log', msg: text('common.no_leaving_fight'), kind: 'danger' });
    return false;
  }
  const tower = towerAt(state);
  if (!tower) return false;
  const fromIndex = currentFloor(state)?.index ?? 0;

  let to: string;
  let toIndex: number;
  if (floorId === null) {
    to = tower.hubSpot;
    toIndex = 0;
  } else {
    const floor = FLOORS[floorId];
    if (!floor || floor.towerId !== tower.id || !floor.landing) return false;
    if (!floorUnlocked(state, floor)) return false;
    to = floor.landing;
    toIndex = floor.index;
  }
  if (to === state.spot) return false;

  if (state.combat) {
    abandonCombat(state);
    bus.emit({ type: 'log', msg: text('common.disengage'), kind: 'combat' });
  }
  state.activity = null;
  state.travelPlan = [];

  const rungs = Math.max(1, Math.abs(toIndex - fromIndex));
  const speed = getDerivedStats(state).travelSpeed;
  const ticks = Math.max(1, Math.round((rungs * CLIMB_TICKS_PER_FLOOR) / speed));
  state.travel = { from: state.spot, to, ticksLeft: ticks, total: ticks };

  const dest = getSpot(to);
  // `direction` is only the word for it: in a stack that runs down, a rising
  // index is a descent.
  const rising = toIndex > fromIndex;
  const verb = (tower.direction === 'down') === rising ? 'Descending' : 'Climbing';
  bus.emit({ type: 'log', msg: text('towers.moving', { verb, icon: dest.icon, name: dest.name }), kind: 'travel' });
  return true;
}
