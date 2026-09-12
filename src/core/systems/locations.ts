import type { GameState } from '../types';
import type { EventBus } from '../engine/events';
import { AREAS, REGIONS, SPOTS, edgesFrom, getSpot, type Edge } from '../registry';
import { getDerivedStats } from './derived';
import { abandonCombat, inForcedFight, spotCleared, startForcedFight } from './combat';
import { conditionsMet } from './conditions';
import { foundPaths, isExplored } from './actions';
import { checkDiscovery, grantSkillXp } from './skills';
import { noteTravelSkies } from './weathersense';
import { noteSafeSpot } from './safety';
import { text } from '../text/log';

/**
 * Edges the player can currently see/use from a spot. A hidden edge opens
 * either the slow way — comb the spot to 100% — or early, if a `path` find
 * along the way named it (see SpotFind).
 */
export function visibleEdges(state: GameState, spotId: string): Edge[] {
  if (edgesFrom(spotId).every((e) => !e.hidden)) return edgesFrom(spotId);
  const opened = foundPaths(state, spotId);
  return edgesFrom(spotId).filter((e) => !e.hidden || isExplored(state, e.from) || opened.has(e.to));
}

interface TravelOpts {
  /** Part of a multi-leg plan: keep state.travelPlan and stay quiet in the log. */
  planned?: boolean;
}

export function startTravel(state: GameState, bus: EventBus, to: string, opts: TravelOpts = {}): boolean {
  if (state.travel || state.recovering) return false;
  // Travel is one of the two ways out of a fight, and a forced fight closes
  // both doors (activity switching is the other — see actions.ts).
  if (inForcedFight(state)) {
    bus.emit({ type: 'log', msg: text('common.no_leaving_fight'), kind: 'danger' });
    return false;
  }
  const edge = visibleEdges(state, state.spot).find((e) => e.to === to);
  if (!edge) return false;
  // A shut road is visible with its terms on it (advertised-but-locked, same
  // shape as a gated floor) — the check lives here, not in visibility.
  if (edge.requires && !conditionsMet(state, edge.requires)) {
    bus.emit({ type: 'log', msg: text('locations.blocked'), kind: 'travel' });
    return false;
  }

  if (state.combat) {
    abandonCombat(state);
    bus.emit({ type: 'log', msg: text('common.disengage'), kind: 'combat' });
  }
  state.activity = null;
  if (!opts.planned) state.travelPlan = [];

  const speed = getDerivedStats(state).travelSpeed;
  const ticks = Math.max(1, Math.round(edge.ticks / speed));
  state.travel = { from: state.spot, to, ticksLeft: ticks, total: ticks };
  if (!opts.planned) {
    const dest = getSpot(to);
    bus.emit({
      type: 'log',
      msg: text('locations.heading', {
        name: dest.name,
        via: edge.label ? text('locations.via', { label: edge.label }) : '',
      }),
      kind: 'travel',
    });
  }
  return true;
}

export function tickTravel(state: GameState, bus: EventBus): void {
  const t = state.travel;
  if (!t) return;
  t.ticksLeft -= 1;
  if (t.ticksLeft > 0) return;

  state.travel = null;
  state.spot = t.to;

  // The road itself is a teacher: walking legs grant Scouting XP by distance
  // (and can manifest it). Fast travel deliberately grants nothing.
  checkDiscovery(state, bus, ['travel', 'explore']);
  grantSkillXp(state, bus, ['travel', 'explore'], t.total * 0.08);
  // New ground, new skies: arrivals feed Weathersense, novel per region.
  const arrivedRegion = AREAS[getSpot(t.to).areaId]?.regionId;
  if (arrivedRegion) noteTravelSkies(state, bus, arrivedRegion);

  const morePlanned = state.travelPlan.length > 0;
  if (!state.discovered.includes(t.to)) {
    state.discovered.push(t.to);
    const spot = getSpot(t.to);
    bus.emit({ type: 'log', msg: text('locations.discovered', { icon: spot.icon, name: spot.name }), kind: 'travel' });
  } else if (!morePlanned) {
    bus.emit({ type: 'log', msg: text('locations.arrived', { name: getSpot(t.to).name }), kind: 'travel' });
  }
  // The spot — or the particular road just walked — may declare a fight that
  // starts the moment you arrive and cannot be fled.
  const dest = getSpot(t.to);
  const walked = edgesFrom(t.from).find((e) => e.to === t.to);
  // A cleared spot forces nothing — whatever forced it is dead (fightLimit).
  const ambushed = !!(dest.forced || walked?.forced) && !spotCleared(state, dest);

  // The way in may buy an opening — or charge one (see ApproachSpec). Stamped
  // for the FIRST encounter here to consume; any arrival without an approach
  // wipes the previous stamp, so an opening never outlives the road that
  // bought it.
  const approach = walked?.approach;
  state.pendingApproach =
    approach && (!approach.requires || conditionsMet(state, approach.requires))
      ? { spot: t.to, enemies: approach.enemies ?? [], self: approach.self ?? [] }
      : null;

  // Standing somewhere you could rest makes it the place a lost fight throws
  // you back to. Recorded on arrival, so it is a place you have BEEN — but
  // only a PEACEFUL arrival counts. An ambush checks in before any campfire
  // does, and without this order a forced spot that also offers a rest would
  // become the very haven its own loss returns you to.
  if (!ambushed) noteSafeSpot(state, t.to);
  bus.emit({ type: 'arrive', spot: t.to });

  if (ambushed) {
    // Any remaining legs of a journey are forfeit: the fight has you now.
    state.travelPlan = [];
    startForcedFight(state, bus, dest);
    return;
  }

  // Continue a multi-leg journey.
  if (state.travelPlan.length > 0 && !state.recovering) {
    const next = state.travelPlan.shift()!;
    if (!startTravel(state, bus, next, { planned: true })) {
      state.travelPlan = [];
      bus.emit({ type: 'log', msg: text('locations.route_blocked'), kind: 'travel' });
    }
  }
}

// ---------- Routing ----------

/**
 * Shortest path (by ticks) from `from` to `to`, walking only DISCOVERED spots
 * through currently visible edges. Returns the hop list excluding `from`,
 * or null if unreachable.
 */
export function findPath(state: GameState, from: string, to: string): string[] | null {
  if (from === to) return [];
  if (!state.discovered.includes(to)) return null;

  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const queue = new Set<string>([from]);

  while (queue.size > 0) {
    let current: string | null = null;
    let best = Infinity;
    for (const id of queue) {
      const d = dist.get(id)!;
      if (d < best) {
        best = d;
        current = id;
      }
    }
    queue.delete(current!);
    if (current === to) break;
    for (const edge of visibleEdges(state, current!)) {
      if (!state.discovered.includes(edge.to)) continue;
      // A shut road neither routes through nor to: unlike a forced door,
      // clicking a locked destination is not a choice the player can make.
      if (edge.requires && !conditionsMet(state, edge.requires)) continue;
      // Never route THROUGH an unfleeable fight: walking into one is a choice
      // made at the door, not by the pathfinder. As the destination it is
      // allowed — that click was the choice. A CLEARED spot forces nothing
      // any more, so the road through it reopens.
      if (
        edge.to !== to &&
        (edge.forced || SPOTS[edge.to]?.forced) &&
        !(SPOTS[edge.to] && spotCleared(state, SPOTS[edge.to]))
      ) continue;
      const next = best + edge.ticks;
      if (next < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, next);
        prev.set(edge.to, current!);
        queue.add(edge.to);
      }
    }
  }

  if (!prev.has(to)) return null;
  const path: string[] = [];
  for (let node = to; node !== from; node = prev.get(node)!) path.unshift(node);
  return path;
}

/** Total ticks along a hop path starting at `from` (base ticks, unscaled). */
export function pathTicks(from: string, path: string[]): number {
  let total = 0;
  let current = from;
  for (const hop of path) {
    total += edgesFrom(current).find((e) => e.to === hop)?.ticks ?? 0;
    current = hop;
  }
  return total;
}

/** Walk to any discovered spot via auto-routing (multi-leg journey). */
export function travelPlanTo(state: GameState, bus: EventBus, to: string): boolean {
  if (state.travel || state.recovering || to === state.spot) return false;
  const path = findPath(state, state.spot, to);
  if (!path || path.length === 0) return false;

  state.travelPlan = path.slice(1);
  if (!startTravel(state, bus, path[0], { planned: true })) {
    state.travelPlan = [];
    return false;
  }
  const dest = getSpot(to);
  bus.emit({
    type: 'log',
    msg: text('locations.setting_out', {
      icon: dest.icon,
      name: dest.name,
      legs: path.length > 1 ? text('locations.legs', { legs: path.length }) : '',
    }),
    kind: 'travel',
  });
  return true;
}

/** Abandon the remaining legs of a journey (the current leg still completes). */
export function cancelTravelPlan(state: GameState, bus: EventBus): void {
  if (state.travelPlan.length === 0) return;
  state.travelPlan = [];
  bus.emit({ type: 'log', msg: text('locations.stop_requested'), kind: 'travel' });
}

// ---------- Fast travel ----------

/** Gold price to fast travel between waypoints — a deliberate gold sink. */
export function fastTravelCost(state: GameState, to: string): number {
  const path = findPath(state, state.spot, to);
  if (!path || path.length === 0) return 1000;
  return Math.max(100, pathTicks(state.spot, path) * 2);
}

export function canFastTravel(state: GameState, to: string): boolean {
  return (
    !state.travel &&
    !state.recovering &&
    to !== state.spot &&
    !!getSpot(state.spot).waypoint &&
    !!getSpot(to).waypoint &&
    state.discovered.includes(to)
  );
}

/** Instant waypoint-to-waypoint travel for gold. */
export function fastTravelTo(state: GameState, bus: EventBus, to: string): boolean {
  if (!canFastTravel(state, to)) return false;
  if (inForcedFight(state)) {
    bus.emit({ type: 'log', msg: text('common.no_leaving_fight'), kind: 'danger' });
    return false;
  }
  const cost = fastTravelCost(state, to);
  if (state.gold < cost) {
    bus.emit({ type: 'log', msg: text('locations.caravan_unaffordable', { cost }), kind: 'travel' });
    return false;
  }

  state.gold -= cost;
  if (state.combat) abandonCombat(state);
  state.activity = null;
  state.travelPlan = [];
  state.spot = to;
  // The caravan is nobody's quiet tunnel: riding in wipes any stamped opening.
  state.pendingApproach = null;
  const dest = getSpot(to);
  bus.emit({ type: 'log', msg: text('locations.fast_traveled', { icon: dest.icon, name: dest.name, cost }), kind: 'travel' });
  // Same order as tickTravel: an ambushed arrival is not a peaceful visit,
  // so it never records the ambush site as a haven. Cleared spots are past
  // ambushing anybody.
  const ambushed = !!dest.forced && !spotCleared(state, dest);
  if (!ambushed) noteSafeSpot(state, to);
  bus.emit({ type: 'arrive', spot: to });
  // Arriving is arriving, however you did it — a forced waypoint (a strange
  // thing to author, but a legal one) ambushes the caravan too.
  if (ambushed) startForcedFight(state, bus, dest);
  return true;
}

export function locationBreadcrumb(spotId: string): string {
  const spot = getSpot(spotId);
  const area = AREAS[spot.areaId];
  const region = REGIONS[area.regionId];
  return `${region.name} › ${area.name} › ${spot.name}`;
}
