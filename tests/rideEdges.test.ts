import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { EventBus } from '../src/core/engine/events';
import { BANDS, FLOORS, TOWERS } from '../src/core/registry';
import { DARK_FLOOR, DARK_ROOM } from '../src/core/data/festival.data';
import {
  CLIMB_TICKS_PER_FLOOR,
  climbTo,
  floorUnlocked,
  rideEdges,
  routableStops,
  towerAtSpot,
} from '../src/core/systems/towers';
import { festivalRun } from '../src/core/systems/festivalRules';
import { findPath, pathTicks, startTravel, tickTravel } from '../src/core/systems/locations';
import { revealMapped } from '../src/core/systems/mapped';
import { getDerivedStats } from '../src/core/systems/derived';
import { ATTRIBUTE_LIST } from '../src/core/data/attributes.data';
import { routeInfo } from '../src/ui/lib/navigation';
import type { GameState } from '../src/core/types';
import { clearFloors } from './fixtures/floors';

/**
 * Ride edges (docs/plans/navigation-alternatives.md N1): the ladder as derived
 * edges the router reads. `rideEdges(state, from)` is never stored; a planned
 * ride leg meets the same terms as `climbTo` when the leg starts.
 */

const FOOT = TOWERS.the_ascent.hubSpot;
const CITY = BANDS.ascent_upper;
const STEPS = 'lectory_steps'; // one road (12 ticks) from the Foot, with a training activity
const F4_SPOT = 'f4_woods_edge';

/**
 * A save standing at `spot`, `cleared` floors done, every gold and goblin
 * gate of the first two bands met, the Foot and each cleared floor's landing
 * (and the Threshold directory) discovered.
 */
function opened(spot: string, cleared: string[], extra: string[] = []): GameState {
  const s = createInitialState(0, spot);
  clearFloors(s.stats, cleared);
  s.stats['gold:earned'] = 1_000_000;
  s.stats['kills:tag:goblin'] = 1_000;
  for (const id of [FOOT, ...cleared.map((f) => FLOORS[f].landing!), ...extra]) {
    if (!s.discovered.includes(id)) s.discovered.push(id);
  }
  revealMapped(s);
  return s;
}

const BAND_ONE_TWO = ['ascent_f1', 'ascent_f2', 'ascent_f3'];
const stopsOf = (edges: { to: string }[]) => edges.map((e) => e.to);

/** Tick until the journey (every leg) is over. */
function finishJourney(game: Game): void {
  for (let i = 0; i < 20_000 && (game.state.travel || game.state.travelPlan.length > 0); i++) game.tick();
  expect(game.state.travel).toBeNull();
}

function arrive(state: GameState, bus: EventBus): void {
  expect(state.travel).toBeTruthy();
  for (let i = 0; i < 10_000 && state.travel; i++) tickTravel(state, bus);
  expect(state.travel).toBeNull();
}

describe('rideEdges', () => {
  it('from a landing: the hub and every other discovered, unlocked landing, priced by rungs', () => {
    // Floors 1 and 2 cleared, so 3 is open (gold met); 4 waits on floor 3.
    const s = opened('f2_stairhead', ['ascent_f1', 'ascent_f2'], ['f3_stairhead', 'f4_treeline']);
    expect(floorUnlocked(s, FLOORS.ascent_f3)).toBe(true);
    expect(floorUnlocked(s, FLOORS.ascent_f4)).toBe(false);
    const edges = rideEdges(s, 'f2_stairhead');
    // Hub first, then the landings by rung; never the spot itself.
    expect(stopsOf(edges)).toEqual([FOOT, 'f1_landing', 'f3_stairhead']);
    expect(edges.map((e) => e.ticks)).toEqual([2 * CLIMB_TICKS_PER_FLOOR, CLIMB_TICKS_PER_FLOOR, CLIMB_TICKS_PER_FLOOR]);
    expect(edges.map((e) => e.label)).toEqual(['Ladder: descend', 'Ladder: descend', 'Ladder: climb']);
    expect(edges.every((e) => e.ride && e.from === 'f2_stairhead')).toBe(true);
  });

  it('from a spot off the ladder: none', () => {
    const s = opened(STEPS, BAND_ONE_TWO);
    expect(towerAtSpot(STEPS)).toBeNull();
    expect(rideEdges(s, STEPS)).toEqual([]);
    // The tutorial floor is bandless, so off the ladder in both directions.
    expect(rideEdges(s, 'f0_cell')).toEqual([]);
  });

  it('from the hub: each discovered, unlocked landing, and not the hub', () => {
    const s = opened(FOOT, ['ascent_f1', 'ascent_f2']);
    expect(stopsOf(rideEdges(s, FOOT))).toEqual(['f1_landing', 'f2_stairhead']);
    expect(rideEdges(s, FOOT).map((e) => e.ticks)).toEqual([CLIMB_TICKS_PER_FLOOR, 2 * CLIMB_TICKS_PER_FLOOR]);
    // Floor 2's gold gate unmet: discovered, but the door is shut.
    s.stats['gold:earned'] = 100;
    expect(stopsOf(rideEdges(s, FOOT))).toEqual(['f1_landing']);
  });

  it('from any spot of a floor: every landing but that floor’s own', () => {
    const s = opened('f2_hall_1', ['ascent_f1', 'ascent_f2'], ['f3_stairhead']);
    expect(stopsOf(rideEdges(s, 'f2_hall_1'))).toEqual([FOOT, 'f1_landing', 'f3_stairhead']);
  });

  it('a band hub is routed once the band is open and the hub discovered', () => {
    const s = opened(FOOT, ['ascent_f1', 'ascent_f2', 'ascent_f3', 'ascent_f4', 'ascent_f5', 'ascent_f6']);
    expect(stopsOf(rideEdges(s, FOOT))).not.toContain(CITY.hub);
    // Open (the city key) but never visited: nothing names it yet.
    s.prestige.purchases.city_key = 1;
    expect(stopsOf(rideEdges(s, FOOT))).not.toContain(CITY.hub);
    s.discovered.push(CITY.hub!);
    const toHub = rideEdges(s, FOOT).find((e) => e.to === CITY.hub);
    expect(toHub?.ticks).toBe(7 * CLIMB_TICKS_PER_FLOOR);
    // And from the hub, the rest of the stack is one pass away.
    expect(stopsOf(rideEdges(s, CITY.hub!))).toContain(FOOT);
  });

  it('an undiscovered landing is not routed; the first ride onto a floor is a ladder click', () => {
    const s = opened(FOOT, ['ascent_f1']);
    s.discovered.splice(s.discovered.indexOf('f1_landing'), 1);
    expect(floorUnlocked(s, FLOORS.ascent_f2)).toBe(true);
    expect(stopsOf(rideEdges(s, FOOT))).toEqual([]);
    expect(findPath(s, FOOT, 'f1_landing')).toBeNull();
    expect(findPath(s, FOOT, 'f1_landing', { unknownDest: true })).toBeNull();
    expect(startTravel(s, new EventBus(), 'f1_landing')).toBe(false);

    const bus = new EventBus();
    expect(climbTo(s, bus, 'ascent_f1')).toBe(true);
    arrive(s, bus);
    expect(s.discovered).toContain('f1_landing');
    expect(findPath(s, 'f1_landing', FOOT)).toEqual([FOOT]);
    expect(stopsOf(rideEdges(s, FOOT))).toEqual(['f1_landing']);
  });
});

describe('the festival is never routed', () => {
  /** Floors below the festival cleared, floor 14's landing underfoot. */
  function atFourteen(): GameState {
    const s = createInitialState(0);
    const below = Object.values(FLOORS)
      .filter((f) => f.bandId !== undefined && f.index < 15)
      .map((f) => f.id);
    clearFloors(s.stats, below);
    s.spot = FLOORS.ascent_f14.landing!;
    s.discovered.push(s.spot, FOOT, DARK_ROOM);
    return s;
  }

  it('a festival landing has no ride edge and no route, though discovered and unlocked', () => {
    const s = atFourteen();
    expect(floorUnlocked(s, FLOORS[DARK_FLOOR])).toBe(true);
    expect(s.discovered).toContain(DARK_ROOM);
    const stops = routableStops(s).map((r) => r.spot);
    expect(stops).toContain(FOOT);
    expect(stops).not.toContain(DARK_ROOM);
    expect(stopsOf(rideEdges(s, FOOT))).not.toContain(DARK_ROOM);
    expect(findPath(s, s.spot, DARK_ROOM)).toBeNull();
    expect(startTravel(s, new EventBus(), DARK_ROOM)).toBe(false);
    expect(s.travel).toBeNull();
    // The ladder click still works: the festival's door is the ladder's.
    expect(climbTo(s, new EventBus(), DARK_FLOOR)).toBe(true);
  });

  it('inside an attempt nothing is routed: no ride, no journey out', () => {
    const s = atFourteen();
    for (const a of ATTRIBUTE_LIST) s.attrs[a.id].level = 400;
    s.resources.hp = getDerivedStats(s).maxHp;
    const game = new Game(s);
    expect(game.climbTo(DARK_FLOOR)).toBe(true);
    finishJourney(game);
    expect(festivalRun(s)).toBeDefined();
    expect(s.spot).toBe(DARK_ROOM);
    expect(routableStops(s)).toEqual([]);
    expect(rideEdges(s, s.spot)).toEqual([]);
    expect(findPath(s, s.spot, FOOT)).toBeNull();
    expect(game.travelPlanTo(FOOT)).toBe(false);
    expect(game.travelTo(FOOT)).toBe(false);
    expect(s.travel).toBeNull();
  });
});

describe('the router across the door', () => {
  it('finds a Threshold spot from floor 4: a ride to the Foot, then the road', () => {
    const s = opened(F4_SPOT, ['ascent_f1', 'ascent_f2', 'ascent_f3']);
    const path = findPath(s, F4_SPOT, STEPS);
    expect(path).toEqual([FOOT, STEPS]);
    // Floor 4 is four rungs up: 180 base ticks (18 s), then the 12-tick road.
    expect(pathTicks(F4_SPOT, path!)).toBe(4 * CLIMB_TICKS_PER_FLOOR + 12);
    const info = routeInfo(s, STEPS, 1);
    expect(info.path).toEqual(path);
    expect(info.ticks).toBe(4 * CLIMB_TICKS_PER_FLOOR + 12);
    expect(info.oneWay).toBe(false);
    // One hop away, the card says what the hop is.
    expect(routeInfo(s, FOOT, 1).label).toBe('Ladder: descend');
  });

  it('routes between floors through the hub’s own ladder, and not onto a shut floor', () => {
    const s = opened(STEPS, ['ascent_f1', 'ascent_f2'], ['f3_stairhead']);
    expect(findPath(s, STEPS, 'f3_stairhead')).toEqual([FOOT, 'f3_stairhead']);
    s.stats['gold:earned'] = 100; // floor 3's gate (600 earned) is no longer met
    expect(findPath(s, STEPS, 'f3_stairhead')).toBeNull();
    expect(routeInfo(s, 'f3_stairhead', 1).path).toBeNull();
  });

  it('startTravel takes the ride when no road leads there, and a lone ride clears the plan like a climb', () => {
    const s = opened(F4_SPOT, ['ascent_f1', 'ascent_f2', 'ascent_f3']);
    s.travelPlan = ['stale'];
    s.travelIntent = { spot: STEPS, activity: 'train_int_steps' };
    const bus = new EventBus();
    expect(startTravel(s, bus, FOOT)).toBe(true);
    expect(s.travel?.to).toBe(FOOT);
    expect(s.travelPlan).toEqual([]);
    expect(s.travelIntent).toBeNull();
    const speed = getDerivedStats(s).travelSpeed;
    expect(s.travel?.total).toBe(Math.max(1, Math.round((4 * CLIMB_TICKS_PER_FLOOR) / speed)));
    // Same terms as the ladder: a floor that is shut is no ride.
    arrive(s, bus);
    s.stats['gold:earned'] = 100;
    expect(startTravel(s, bus, 'f3_stairhead')).toBe(false);
  });

  it('a ride leg keeps the plan and the intent that a lone ride would clear', () => {
    const s = opened(F4_SPOT, ['ascent_f1', 'ascent_f2', 'ascent_f3']);
    const game = new Game(s);
    expect(game.goAndDo(STEPS, 'train_int_steps')).toBe(true);
    // The first leg is the ride: the rest of the journey and its purpose stand.
    expect(s.travel?.from).toBe(F4_SPOT);
    expect(s.travel?.to).toBe(FOOT);
    expect(s.travelPlan).toEqual([STEPS]);
    expect(s.travelIntent).toEqual({ spot: STEPS, activity: 'train_int_steps' });
    // Nothing starts at the halt on the Foot; the journey runs on.
    for (let i = 0; i < 20_000 && s.spot !== FOOT; i++) game.tick();
    expect(s.spot).toBe(FOOT);
    expect(s.travel?.to).toBe(STEPS);
    expect(s.activity).toBeNull();
    expect(s.travelIntent).toEqual({ spot: STEPS, activity: 'train_int_steps' });
  });

  it('goAndDo across floors starts the activity on arrival', () => {
    const s = opened(F4_SPOT, ['ascent_f1', 'ascent_f2', 'ascent_f3']);
    const game = new Game(s);
    expect(game.goAndDo(STEPS, 'train_int_steps')).toBe(true);
    finishJourney(game);
    expect(s.spot).toBe(STEPS);
    expect(s.activity).toBe('train_int_steps');
    expect(s.travelIntent).toBeNull();
    // And back up: a ride as the last leg starts what is chosen there.
    expect(game.goAndDo('f2_stairhead', 'camp_f2')).toBe(true);
    finishJourney(game);
    expect(s.spot).toBe('f2_stairhead');
    expect(s.activity).toBe('camp_f2');
  });

  it('a planned ride leg refused when it starts stops the journey with route_blocked', () => {
    const s = opened(STEPS, ['ascent_f1', 'ascent_f2'], ['f3_stairhead']);
    const game = new Game(s);
    expect(game.goAndDo('f3_stairhead', 'camp_f3')).toBe(true);
    // Leg one is the 12-tick road to the Foot; leg two, the ride, is planned.
    expect(s.travel?.to).toBe(FOOT);
    expect(s.travelPlan).toEqual(['f3_stairhead']);
    // Floor 3 shuts while the player walks (its gold gate, 600 earned).
    s.stats['gold:earned'] = 100;
    expect(floorUnlocked(s, FLOORS.ascent_f3)).toBe(false);
    for (let i = 0; i < 1_000 && s.spot !== FOOT; i++) game.tick();
    expect(s.spot).toBe(FOOT);
    expect(s.travel).toBeNull();
    expect(s.travelPlan).toEqual([]);
    expect(s.travelIntent).toBeNull();
    expect(s.activity).toBeNull();
    expect(s.log.some((l) => l.msg.includes('Route blocked'))).toBe(true);
  });
});
