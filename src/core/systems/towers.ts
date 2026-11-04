import type { EventBus } from '../engine/events';
import type { BandDef, FloorDef, GameState, TowerDef } from '../types';
import { BANDS, FLOORS, FLOOR_BY_AREA, TOWERS, getSpot, type Edge } from '../registry';
import { FESTIVAL_BAND } from '../data/festival.data';
import { getDerivedStats } from './derived';
import { abandonCombat, inForcedFight } from './combat';
import { bandBaseIndex, bandHubAt, bandOpen, floorUnlocked, ladderFloors, rungIndex } from './ladder';
import { beginRoyale, festivalLadder, festivalRun, type FestivalLadder } from './festivalRules';
import { retreatToSafety } from './safety';
import { text } from '../text/log';

export {
  bandCleared,
  bandHubAt,
  bandLevelStep,
  bandOpen,
  bandPassed,
  bandPosKey,
  bandBaseIndex,
  bandKnown,
  clearMet,
  floorCleared,
  floorReached,
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
 * - **The router rides too.** `rideEdges` gives `findPath` (systems/
 *   locations.ts) the same ladder as derived edges, never stored, so a journey
 *   can cross the door: a planned ride leg goes through the same gate as a
 *   climb (`rideGate`, `routableStops`). The first ride onto a floor stays a
 *   ladder click, and the festival's floors are never routed.
 */

/** Base ticks to climb (or descend) past one rung of a stack. */
export const CLIMB_TICKS_PER_FLOOR = 45;

/** The floor a spot is on, if it is on one. */
function floorOfSpot(spotId: string): FloorDef | null {
  return FLOOR_BY_AREA.get(getSpot(spotId).areaId) ?? null;
}

/** The floor the player is standing on, if the current spot is on one. */
export function currentFloor(state: GameState): FloorDef | null {
  return floorOfSpot(state.spot);
}

/**
 * The tower whose ladder is reachable from a spot: its hub spot, a band's
 * hub, or anywhere on one of its floors. Null anywhere else — the ladder is a
 * thing you walk to, not a menu.
 */
export function towerAtSpot(spotId: string): TowerDef | null {
  const here = floorOfSpot(spotId);
  // A bandless floor is off the ladder in both directions: nothing counts it
  // as a rung, and the ladder does not answer from it. Floor 0 (the tutorial)
  // is reached by roads and left by its gate; without this the cell would
  // offer a climb straight past the gate to floor 1.
  if (here) return here.bandId === undefined ? null : (TOWERS[here.towerId] ?? null);
  const band = bandHubAt(spotId);
  if (band) return TOWERS[band.towerId] ?? null;
  return Object.values(TOWERS).find((t) => t.hubSpot === spotId) ?? null;
}

/** The tower whose ladder is reachable from where the player stands. */
export function towerAt(state: GameState): TowerDef | null {
  return towerAtSpot(state.spot);
}

/**
 * Where a spot sits on the stack, for pricing a climb: its floor's rung, a
 * band hub's base, or the tower's hub (0).
 */
export function spotIndex(spotId: string): number {
  const here = floorOfSpot(spotId);
  if (here) return rungIndex(here);
  const band = bandHubAt(spotId);
  return band ? bandBaseIndex(band) : 0;
}

/** Where the player stands on the stack. */
export function standingIndex(state: GameState): number {
  return spotIndex(state.spot);
}

/** The word for a move along the stack. Between rungs at one height it is a walk across. */
export function climbVerb(tower: TowerDef, fromIndex: number, toIndex: number): 'Climbing' | 'Descending' | 'Crossing' {
  if (toIndex === fromIndex) return 'Crossing';
  // `direction` is only the word for it: in a stack that runs down, a rising
  // index is a descent.
  return (tower.direction === 'down') === toIndex > fromIndex ? 'Descending' : 'Climbing';
}

// ---------- Ride stops, the gate and the router's edges ----------

/**
 * A place the ladder answers: a floor's landing, a band's hub or the tower's
 * hub. Where a stop sits on the stack is registry data; whether the ladder
 * will take the player there is the gate's (`rideGate`).
 */
export interface RideStop {
  spot: string;
  tower: string;
  /** The rung the stop sits at, for pricing a ride. */
  index: number;
  /** Set on a floor's landing. */
  floor?: FloorDef;
  /** Set on a band's hub. */
  band?: BandDef;
}

function hubStop(tower: TowerDef): RideStop {
  return { spot: tower.hubSpot, tower: tower.id, index: 0 };
}

function bandStop(band: BandDef): RideStop {
  return { spot: band.hub!, tower: band.towerId, index: bandBaseIndex(band), band };
}

/** Null for a floor with no landing: the ladder has nowhere to put the player. */
function floorStop(floor: FloorDef): RideStop | null {
  return floor.landing ? { spot: floor.landing, tower: floor.towerId, index: rungIndex(floor), floor } : null;
}

/** Every stop on a tower's ladder, hub first, then band hubs, then landings by rung. */
export function rideStops(tower: TowerDef): RideStop[] {
  const stops: RideStop[] = [hubStop(tower)];
  for (const band of Object.values(BANDS)) {
    if (band.hub && band.towerId === tower.id) stops.push(bandStop(band));
  }
  for (const floor of ladderFloors(tower.id)) {
    const stop = floorStop(floor);
    if (stop) stops.push(stop);
  }
  return stops;
}

/**
 * What the ladder says to a ride: `open` (a plain ride), `refused` (the stop
 * is not on this tower, the floor is not unlocked, the band is not open, or
 * there is no ladder here), or the festival's verdict (`FestivalLadder`),
 * which `climbTo` acts on and a routed leg never takes.
 */
export type RideGate = 'open' | 'refused' | FestivalLadder;

/** The stop's own terms, whoever asks: its floor unlocked, its band open, the festival's rules. */
function stopGate(state: GameState, stop: RideStop): RideGate {
  if (stop.floor && !floorUnlocked(state, stop.floor)) return 'refused';
  if (stop.band && !bandOpen(state, stop.band)) return 'refused';
  return festivalLadder(state, stop.floor?.id ?? null) ?? 'open';
}

/**
 * The one gate for a ride from where the player stands: `towerAt`, then the
 * stop's terms. `climbTo` and `climbToHub` call it; a routed leg reaches the
 * same terms through `routableStops`, which `rideEdges` reads at the moment
 * the leg starts.
 */
export function rideGate(state: GameState, stop: RideStop): RideGate {
  const tower = towerAt(state);
  return tower && tower.id === stop.tower ? stopGate(state, stop) : 'refused';
}

/**
 * The stops the router may send the player to. A stop is routable when its
 * spot is discovered (a ride never names a place the player has not been, so
 * the first ride onto a floor stays a ladder click), the gate is open, and it
 * is not a festival floor. Inside a festival attempt nothing is routable.
 */
export function routableStops(state: GameState): RideStop[] {
  if (festivalRun(state)) return [];
  return Object.values(TOWERS)
    .flatMap(rideStops)
    .filter(
      (stop) =>
        state.discovered.includes(stop.spot) &&
        stop.floor?.bandId !== FESTIVAL_BAND &&
        stopGate(state, stop) === 'open',
    );
}

/** A ride as the router sees it: an edge of the same shape as a road, priced by rungs. */
export interface RideEdge extends Edge {
  ride: true;
  /** The rung the ride ends at. */
  toIndex: number;
}

/** Base ticks for a ride between two rungs. Speed applies on top, as for a road. */
export function rideTicks(fromIndex: number, toIndex: number): number {
  return Math.max(1, Math.abs(toIndex - fromIndex)) * CLIMB_TICKS_PER_FLOOR;
}

/** The base price of the ride from `from` to the stop at `to`, or null when `to` is not a stop of `from`'s tower. */
export function rideBaseTicks(from: string, to: string): number | null {
  const tower = towerAtSpot(from);
  const stop = tower ? rideStops(tower).find((s) => s.spot === to) : undefined;
  return stop ? rideTicks(spotIndex(from), stop.index) : null;
}

const RIDE_LABEL = {
  Climbing: 'Ladder: climb',
  Descending: 'Ladder: descend',
  Crossing: 'Ladder: cross',
} as const;

/**
 * The rides the router may take from a spot. Derived on every call and never
 * stored. From any spot where `towerAtSpot` holds they lead to each routable
 * stop of that tower, except the stop the spot is and the landing of the
 * floor it stands on (the ladder offers no ride to the floor you are on).
 * `stops` is for a caller that asks about many spots in one pass.
 */
export function rideEdges(state: GameState, from: string, stops?: RideStop[]): RideEdge[] {
  const tower = towerAtSpot(from);
  if (!tower) return [];
  const open = stops ?? routableStops(state);
  const fromIndex = spotIndex(from);
  const fromFloor = floorOfSpot(from);
  return open
    .filter((s) => s.tower === tower.id && s.spot !== from && (!s.floor || s.floor.id !== fromFloor?.id))
    .map((s) => ({
      from,
      to: s.spot,
      ticks: rideTicks(fromIndex, s.index),
      label: RIDE_LABEL[climbVerb(tower, fromIndex, s.index)],
      ride: true as const,
      toIndex: s.index,
    }));
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
  const stop = floor ? floorStop(floor) : hubStop(tower);
  if (!stop) return false;
  const gate = rideGate(state, stop);
  if (gate === 'refused') return false;
  if (gate === 'shut') {
    bus.emit({ type: 'log', msg: text('festival.door_shut'), kind: 'danger' });
    return false;
  }
  if (gate === 'closed') {
    bus.emit({ type: 'log', msg: text('festival.royale_closed'), kind: 'danger' });
    return false;
  }
  if (gate === 'forfeit') return forfeitFestival(state, bus);
  if (!floor) return ride(state, bus, tower, stop.spot, 0);
  // The climb from the hub into the royale: the clock jumps to the end of the
  // ten days before the ride starts (systems/festivalRules.ts).
  const run = festivalRun(state);
  if (gate === 'royale' && run) beginRoyale(run);
  return ride(state, bus, tower, stop.spot, stop.index, seamVerb(state, stop.index));
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
  if (state.combat) abandonCombat(state, bus);
  retreatToSafety(state, bus, text('festival.forfeit'));
  return true;
}

/** Ride the stack to a band's hub (band 3's castle) once the band is open. */
export function climbToHub(state: GameState, bus: EventBus, bandId: string): boolean {
  const tower = rideFrom(state, bus);
  if (!tower) return false;
  const band = BANDS[bandId];
  if (!band?.hub) return false;
  const stop = bandStop(band);
  // Every band hub is outside the festival: from inside an attempt, a forfeit.
  const gate = rideGate(state, stop);
  if (gate === 'forfeit') return forfeitFestival(state, bus);
  if (gate !== 'open') return false;
  return ride(state, bus, tower, stop.spot, stop.index);
}

/**
 * One ride as a leg of a journey (`startTravel`, systems/locations.ts): the
 * edge must be one `rideEdges` offers from here right now, so a leg planned
 * earlier is judged by the gate as it stands when the leg starts. A planned
 * leg keeps `travelPlan` and `travelIntent`; a lone ride clears them, like a
 * climb. Returns false when the ladder does not offer the ride.
 */
export function rideLeg(state: GameState, bus: EventBus, to: string, opts: { planned?: boolean } = {}): boolean {
  const tower = towerAt(state);
  const edge = tower ? rideEdges(state, state.spot).find((e) => e.to === to) : undefined;
  if (!tower || !edge) return false;
  return ride(state, bus, tower, edge.to, edge.toIndex, undefined, opts);
}

function ride(
  state: GameState,
  bus: EventBus,
  tower: TowerDef,
  to: string,
  toIndex: number,
  seam?: string,
  opts: { planned?: boolean } = {},
): boolean {
  if (to === state.spot) return false;
  const fromIndex = standingIndex(state);

  if (state.combat) {
    abandonCombat(state, bus);
    bus.emit({ type: 'log', msg: text('common.disengage'), kind: 'combat' });
  }
  state.activity = null;
  if (!opts.planned) {
    state.travelPlan = [];
    state.travelIntent = null;
  }

  const speed = getDerivedStats(state).travelSpeed;
  const ticks = Math.max(1, Math.round(rideTicks(fromIndex, toIndex) / speed));
  state.travel = { from: state.spot, to, ticksLeft: ticks, total: ticks };

  // A leg of a planned journey is quiet: the journey's own line named it.
  if (!opts.planned) {
    const dest = getSpot(to);
    const verb = seam ?? climbVerb(tower, fromIndex, toIndex);
    bus.emit({ type: 'log', msg: text('towers.moving', { verb, icon: dest.icon, name: dest.name }), kind: 'travel' });
  }
  return true;
}
