/**
 * What the map says about a place: the features standing there (chips over
 * its node, rows in its card) and the road to it from where you stand. One
 * derivation for the map card, the destination preview and the location
 * panel, so they cannot disagree about what is where.
 */
import type { GameState, PendingReturn, ReturnSpot, SpotDef } from '../../core/types';
import { TPS } from '../../core/engine/loop';
import { DISCIPLINES } from '../../core/data/disciplines.data';
import { FLOORS, FLOOR_BY_AREA, SPOTS, edgesFrom, getSpot } from '../../core/registry';
import { spotActivities } from '../../core/systems/actions';
import { isVeiled } from '../../core/systems/bestiary';
import { eligibleEncounters, spotCleared } from '../../core/systems/combat';
import { conditionsMet } from '../../core/systems/conditions';
import { FALLBACK_WINS, returnBlock } from '../../core/systems/knockoutReturn';
import { bandHubAt, bandKnown, bandLevelStep, floorReached, floorUnlocked, hubStatus } from '../../core/systems/ladder';
import { dynamicLevelBonus, encounterLevel } from '../../core/systems/levels';
import { findPath, hopEdge, pathTicks, visibleEdges } from '../../core/systems/locations';
import { availableQuests, canTurnIn, npcsAt } from '../../core/systems/quests';
import { restActivities } from '../../core/systems/safety';
import { visibleLines } from '../../core/systems/shops';
import { routableStops } from '../../core/systems/towers';
import { subsystemUnlocked } from '../../core/systems/unlocks';
import { QUESTS } from '../../core/registry';
import { condsText, ticksToTime } from './format';
import { hubTerms, rungTerms } from './ladderView';

/**
 * Benches you can actually see. Furniture for a system you have never heard
 * of is a spoiler rather than a discovery, so a bench stays out of the room
 * while its subsystem is locked — the same rule the bench itself enforces,
 * applied before it can be clicked.
 *
 * ⚠️ ALPHA: mutagens currently start OPEN (see freshMutagenState), so that
 * branch is inert today. It is kept wired because it is exactly what the
 * unlock quest will switch on.
 */
export function visibleBenches(state: GameState, spot: SpotDef): string[] {
  return (spot.benches ?? []).filter((id) => {
    if (id === 'mutagens') return state.mutagens.unlocked && subsystemUnlocked(state, 'genes');
    if (id === 'runecarving') return subsystemUnlocked(state, 'runecarving');
    // The kitchen side-benches (alpha shutter, save v55): the stove stays.
    if (id === 'preparing' || id === 'assembling') return subsystemUnlocked(state, 'prep');
    return true;
  });
}

/** A bench's icon and name as the room shows it. The spelltable is not a discipline. */
export function benchLabel(benchId: string): { icon: string; name: string } {
  if (benchId === 'spelltable') return { icon: '🔮', name: 'Spellcrafting Table' };
  const bench = DISCIPLINES[benchId];
  return { icon: bench?.icon ?? '🛠️', name: bench?.benchName ?? bench?.name ?? benchId };
}

export type SpotFeatureKind = 'bench' | 'shop' | 'quest' | 'turnin' | 'rest';

export interface SpotFeature {
  key: string;
  kind: SpotFeatureKind;
  icon: string;
  label: string;
  /** Rest features: the activity that rests. */
  activity?: string;
  /** Bench features: the bench to open. */
  bench?: string;
}

/**
 * The features of a spot, in the order the map's chips are drawn: quests
 * ready to turn in first (the one thing a player walks back for), then new
 * quests, shops, benches, rest.
 */
export function spotFeatures(state: GameState, spot: SpotDef): SpotFeature[] {
  const turnins: SpotFeature[] = [];
  const quests: SpotFeature[] = [];
  const shops: SpotFeature[] = [];
  for (const npc of npcsAt(spot.id)) {
    const ready = npc.quests
      .map((id) => QUESTS[id])
      .filter((q) => q && state.quests[q.id]?.status === 'active' && canTurnIn(state, q));
    if (ready.length) {
      turnins.push({
        key: `turnin:${npc.id}`,
        kind: 'turnin',
        icon: '✅',
        label: `${npc.name}: ${ready.length === 1 ? ready[0].name : `${ready.length} quests`} ready to turn in`,
      });
    }
    const open = availableQuests(state, npc);
    if (open.length) {
      quests.push({
        key: `quest:${npc.id}`,
        kind: 'quest',
        icon: '📜',
        label: `${npc.name}: ${open.length === 1 ? open[0].name : `${open.length} quests`} available`,
      });
    }
    if (npc.shop && visibleLines(state, npc).length) {
      shops.push({ key: `shop:${npc.id}`, kind: 'shop', icon: '🪙', label: `${npc.shop.name} (${npc.name})` });
    }
  }
  const benches: SpotFeature[] = visibleBenches(state, spot).map((id) => {
    const { icon, name } = benchLabel(id);
    return { key: `bench:${id}`, kind: 'bench', bench: id, icon, label: name };
  });
  const haven = state.safeSpots.nearest === spot.id || state.safeSpots.unconditional === spot.id;
  const rests: SpotFeature[] = restActivities(spot)
    .filter((a) => !a.requires || conditionsMet(state, a.requires))
    .map((a) => ({
      key: `rest:${a.id}`,
      kind: 'rest',
      activity: a.id,
      icon: a.icon,
      label: haven ? `${a.name} (your haven)` : a.name,
    }));
  return [...turnins, ...quests, ...shops, ...benches, ...rests];
}

export interface RouteInfo {
  /** Hops excluding the start; empty when standing there. Null: no open route. */
  path: string[] | null;
  /** Travel time in ticks at the current travel speed, rides included. */
  ticks: number;
  /** The label of the road or ride, when the destination is one hop away. */
  label?: string;
  /** Some road on the route has no way back. */
  oneWay: boolean;
  /** Arriving starts a fight that cannot be fled. */
  noExit: boolean;
  /** The direct road is shut: its terms, as words. */
  shut?: string;
}

/** The route from where you stand to `toId` (roads and ladder rides), as the old Travel list described it. */
export function routeInfo(state: GameState, toId: string, travelSpeed: number): RouteInfo {
  const from = state.spot;
  const dest = getSpot(toId);
  // A road the player has not found is not there: it gives no time and no
  // terms, however the pathfinder fares. Hidden and not-yet-revealed edges
  // are in `edgesFrom`, so only the visible ones count.
  const direct = visibleEdges(state, from).find((e) => e.to === toId);
  const shut = direct?.requires && !conditionsMet(state, direct.requires) ? condsText(direct.requires) : undefined;
  const path = toId === from ? [] : findPath(state, from, toId, { unknownDest: true });
  let ticks = 0;
  let oneWay = false;
  let lastForced = false;
  let label: string | undefined;
  if (path) {
    let at = from;
    for (const hop of path) {
      // A hop is a road or, between ladder stops, a ride (hopEdge).
      const edge = hopEdge(state, at, hop);
      if (edge) {
        ticks += Math.max(1, Math.round(edge.ticks / travelSpeed));
        // A one-way road has no mirror; the registry never builds its reverse.
        // A ride is not one: the ladder runs both ways, and its terms are
        // checked where the leg starts.
        if (!('ride' in edge) && !edgesFrom(hop).some((r) => r.to === at)) oneWay = true;
        lastForced = !!edge.forced;
        if (path.length === 1) label = edge.label;
      }
      at = hop;
    }
  } else if (direct) {
    ticks = Math.max(1, Math.round(direct.ticks / travelSpeed));
    label = direct.label;
    oneWay = !edgesFrom(toId).some((r) => r.to === from);
    lastForced = !!direct.forced;
  }
  const noExit = toId !== from && !!(lastForced || dest.forced) && !spotCleared(state, dest);
  return { path, ticks, label, oneWay, noExit, shut };
}

// ---------- Route legs (the map's route line) ----------

/** One hop of a route: a road, or a ladder ride between two stops of a tower. */
export interface RouteLeg {
  from: string;
  to: string;
  /** Travel time at the given speed, as `startTravel` would charge it. */
  ticks: number;
  ride: boolean;
}

/** The legs of a hop path that starts at `from`. A hop with no road is a ride. */
export function routeLegs(from: string, path: string[], travelSpeed: number): RouteLeg[] {
  const legs: RouteLeg[] = [];
  let at = from;
  for (const hop of path) {
    const ride = !edgesFrom(at).some((e) => e.to === hop);
    legs.push({
      from: at,
      to: hop,
      ticks: Math.max(1, Math.round(pathTicks(at, [hop]) / travelSpeed)),
      ride,
    });
    at = hop;
  }
  return legs;
}

/**
 * The spots of a journey in progress, origin first: the legs walked, the leg
 * under way, and the legs still planned. Nothing but the leg under way and the
 * plan is in the save, so the legs walked come from `trail`, the UI's own
 * memory of this journey (`nextTrail`).
 */
export function journeySpots(trail: string[], travel: { from: string; to: string } | null, plan: string[]): string[] {
  return travel ? [...nextTrail(trail, travel), ...plan] : [];
}

/**
 * The trail after one more look at the journey: empty when standing still,
 * unchanged on the same leg, longer when the next leg of the same journey has
 * begun, and a fresh pair for a new journey (or a save loaded mid-walk, whose
 * earlier legs are gone).
 */
export function nextTrail(trail: string[], travel: { from: string; to: string } | null): string[] {
  if (!travel) return trail.length ? [] : trail;
  const n = trail.length;
  if (n >= 2 && trail[n - 2] === travel.from && trail[n - 1] === travel.to) return trail;
  if (n >= 1 && trail[n - 1] === travel.from) return [...trail, travel.to];
  return [travel.from, travel.to];
}

/** "1.2 s", "2 s", "18 s", "1m 5s": whole seconds from ten up, a tenth below. */
export function legTime(ticks: number): string {
  const s = ticks / 10;
  if (s >= 60) return ticksToTime(ticks);
  if (s >= 10) return `${Math.round(s)} s`;
  const tenths = Math.round(s * 10) / 10;
  return `${Number.isInteger(tenths) ? tenths : tenths.toFixed(1)} s`;
}

/** A place as the route line names it: an undiscovered place is never named. */
function placeName(state: GameState, spotId: string): string {
  return state.discovered.includes(spotId) ? getSpot(spotId).name : 'Unknown place';
}

/**
 * What a ride leg arrives at: "Floor 4" for a landing the player has been to,
 * else the stop's own name. A landing not yet discovered is "Unknown place",
 * as everywhere else (the first ride onto a floor is a ladder click).
 */
function rideTarget(state: GameState, spotId: string): string {
  const floor = state.discovered.includes(spotId) ? Object.values(FLOORS).find((f) => f.landing === spotId) : undefined;
  return floor ? `Floor ${floor.index}` : placeName(state, spotId);
}

/** The line above the map: what it is about, then the detail. Either may be empty. */
export interface RouteLine {
  head: string;
  rest: string;
}

export const NO_ROUTE_LINE: RouteLine = { head: '', rest: '' };

/**
 * The route line: "Route to The Woods Edge: 3 legs, 21 s." then "The Granary
 * Gate → The Foot 1.2 s → ride to Floor 4 18 s → The Woods Edge 2 s". The first
 * name is where the route starts; each leg then names where it arrives and its
 * time. `kind` is "Journey" while the player is walking it.
 */
export function routeSummary(state: GameState, kind: 'Route' | 'Journey', legs: RouteLeg[]): RouteLine {
  if (!legs.length) return NO_ROUTE_LINE;
  const total = legs.reduce((sum, l) => sum + l.ticks, 0);
  const end = legs[legs.length - 1].to;
  const steps = legs.map((l) => `${l.ride ? `ride to ${rideTarget(state, l.to)}` : placeName(state, l.to)} ${legTime(l.ticks)}`);
  return {
    head: `${kind} to ${placeName(state, end)}: ${legs.length} ${legs.length === 1 ? 'leg' : 'legs'}, ${legTime(total)}.`,
    rest: [placeName(state, legs[0].from), ...steps].join(' → '),
  };
}

/**
 * The line for a place no route reaches. Three causes leave no road to draw:
 * a hidden road (nothing is said), an uncleared forced spot in the way (nothing
 * is said) and a ride the ladder refuses (its terms, as the Ascent panel
 * words them). A road shut behind terms the player can see gives them, as the
 * click card does; a road that is not yet revealed gives nothing.
 */
export function noRouteSummary(state: GameState, toId: string, info: RouteInfo): RouteLine {
  const shut = info.shut && visibleEdges(state, state.spot).some((e) => e.to === toId) ? info.shut : null;
  return {
    head: `No open route to ${placeName(state, toId)}.`,
    rest: shut ? `Shut: ${shut}` : (rideRefusal(state, toId) ?? ''),
  };
}

/**
 * A refused ride's terms for a place on a ladder floor (or a band's hub): the
 * words the ladder panel prints under that rung. Only a floor the ladder
 * already names (`floorReached`), or a hub of a band it shows in full
 * (`bandKnown`), says anything, and only while the landing or hub is not one
 * the router may take.
 */
function rideRefusal(state: GameState, toId: string): string | null {
  const dest = getSpot(toId);
  const floor = FLOOR_BY_AREA.get(dest.areaId);
  if (floor?.bandId !== undefined && floorReached(state, floor)) {
    if (routableStops(state).some((s) => s.floor?.id === floor.id)) return null;
    const t = rungTerms(state, floor);
    if (t.kind === 'open' || t.kind === 'cleared' || !t.terms.length) return null;
    return `Floor ${floor.index}: ${t.terms.map((x) => x.text).join(' ')}`;
  }
  const band = bandHubAt(toId);
  if (band && bandKnown(state, band) && hubStatus(state, band) !== 'open') {
    if (routableStops(state).some((s) => s.band?.id === band.id)) return null;
    const t = hubTerms(state, band);
    return t.terms.length ? `${getSpot(toId).name}: ${t.terms.map((x) => x.text).join(' ')}` : null;
  }
  return null;
}

// ---------- Threat ----------

/**
 * The level range of what a place can roll, "L7-9" or "L8", or null when it
 * rolls nothing the player is owed a number for. Read off the lines a fight
 * here can draw now (`eligibleEncounters`: a `once` line already slain is gone,
 * a gated line waits for its terms), minus ambush windows, which are meant to
 * be met. The level is the one `spawnMonster` gives: the line's rise, the
 * band's step, then the band's dynamic levels (never on a `once` line).
 * A veiled species (MonsterDef.veil) adds nothing until its veil lifts, so a
 * badge never hints at it.
 */
export function spotThreat(state: GameState, spot: SpotDef): string | null {
  if (spotCleared(state, spot)) return null;
  const lines = eligibleEncounters(state, {
    ...spot,
    encounters: (spot.encounters ?? []).filter((e) => !e.window && !isVeiled(state, e.monsterId)),
  });
  if (!lines.length) return null;
  const step = bandLevelStep(state, spot);
  const at = (e: (typeof lines)[number], rolled: number) => {
    const stepped = encounterLevel(state, e, rolled) + step;
    return e.once ? stepped : stepped + dynamicLevelBonus(state, spot, e.monsterId, stepped);
  };
  const lo = Math.min(...lines.map((e) => at(e, e.level[0])));
  const hi = Math.max(...lines.map((e) => at(e, e.level[1])));
  return lo === hi ? `L${lo}` : `L${lo}-${hi}`;
}

/** An activity's icon and name at a spot, for callers that hold only the id. */
export function activityName(spotId: string, activityId: string): string {
  const spot = SPOTS[spotId];
  const act = spot && spotActivities(spot).find((a) => a.id === activityId);
  return act ? `${act.icon} ${act.name}` : activityId;
}

// ---------- Stations (the row above the map) ----------

/** Stations the row lists at most. */
export const STATION_MAX = 5;

/** Why a worked spot is not offered as a station. */
export type StationBlock =
  | NonNullable<ReturnType<typeof returnBlock>>
  | 'undiscovered'
  | 'locked'
  | 'spent'
  | 'empty';

/**
 * Why `goal` is not offered from where the character stands, or null when one
 * click can send it there and put it to work. The knockout return's own list
 * (`returnBlock`: a forced spot, a forced last road, a festival floor, the
 * stronghold wall, a route that does not exist, an activity that cannot start)
 * plus four the row adds: an undiscovered spot, a floor not unlocked, and a
 * hunt that cannot fight (`spent`: its fight budget is used up; `empty`: no
 * encounter is eligible now). The route is the one the button takes: the
 * return may climb to a floor and then walk, but a click is one `goAndDo`.
 */
export function stationBlock(state: GameState, goal: ReturnSpot): StationBlock | null {
  const spot = SPOTS[goal.spot];
  if (!spot || !state.discovered.includes(goal.spot)) return 'undiscovered';
  const why = returnBlock(state, goal);
  // A floor not unlocked has no ride to it, so `returnBlock` reads it as no
  // route; it is named here, and a floor the route reaches is checked too.
  if (!why || why === 'route') {
    const floor = FLOOR_BY_AREA.get(spot.areaId);
    if (floor && !floorUnlocked(state, floor)) return 'locked';
  }
  if (why) return why;
  // A hunt that cannot fight is not work: walking there starts a hunt that
  // spawns nothing. `returnBlock` does not look (the fallback pick,
  // `usableHunt`, does), so the row does.
  if (spotActivities(spot).find((a) => a.id === goal.activity)?.kind === 'hunt') {
    if (spotCleared(state, spot)) return 'spent';
    if (eligibleEncounters(state, spot).length === 0) return 'empty';
  }
  return goal.spot === state.spot || findPath(state, state.spot, goal.spot) ? null : 'route';
}

/** One row of the Stations row: a worked spot, the work it remembers, and the way there. */
export interface Station {
  spot: string;
  activity: string;
  /** The place, as the map names it. Stations are discovered, so this is never "Unknown place". */
  place: string;
  /** The activity, "icon name". */
  what: string;
  /** Route time at the given travel speed, rides included. */
  ticks: number;
  oneWay: boolean;
  noExit: boolean;
}

/**
 * The spots the character can go back to work at, newest first, at most `max`.
 * A station is a spot with a `resumeActivity` key (the key order is recency,
 * see `startActivity`), minus:
 * - where the character stands;
 * - the target of a knockout return in flight (the return owns it, plan
 *   navigation-alternatives §9 Q3);
 * - any spot `stationBlock` refuses.
 * The first station is "Back".
 */
export function stations(state: GameState, travelSpeed: number, max = STATION_MAX): Station[] {
  const taken = state.pendingReturn?.target?.spot ?? null;
  const spots = Object.keys(state.resumeActivity);
  const out: Station[] = [];
  for (let i = spots.length - 1; i >= 0 && out.length < max; i--) {
    const spot = spots[i];
    if (spot === state.spot || spot === taken) continue;
    const activity = state.resumeActivity[spot];
    if (stationBlock(state, { spot, activity })) continue;
    const route = routeInfo(state, spot, travelSpeed);
    out.push({
      spot,
      activity,
      place: getSpot(spot).name,
      what: activityName(spot, activity),
      ticks: route.ticks,
      oneWay: route.oneWay,
      noExit: route.noExit,
    });
  }
  return out;
}

/**
 * The label of the button that ends a knockout return. Standing still it is
 * "Stay here". Walking, the leg under way cannot be called off, so the button
 * stops the character where that leg ends and says where: "Stop at The
 * Treeline" (`Game.stayHere`).
 */
export function stayLabel(state: GameState): string {
  return state.travel ? `Stop at ${placeName(state, state.travel.to)}` : 'Stay here';
}

/** "9 min", "2 h", "1 h 12 min": a wait in whole minutes, rounded up. */
function waitText(ticks: number): string {
  const total = Math.max(1, Math.ceil(ticks / (60 * TPS)));
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * The knockout return in flight as one line for the Stations row: what the
 * character is doing for it and what comes after. Null with no return.
 * - `return`: "Returning to The Deep Woods", with "after recovery" while knocked out.
 *   A return ends at the first win at its target, so a character already
 *   standing at a hunt target reads "At The Deep Woods: the return ends at the
 *   first win."
 * - `fallback`: "Hunting The Treeline for 200 wins or 2 h, then The Deep Woods".
 *   The wins and the time are what is left. With no target (a forced spot, the
 *   wall) the hunt is where the return ends, and the line has no "then".
 * - `hold`: "Retrying The Deep Woods in 10 min".
 */
export function returnLine(state: GameState): string | null {
  const p: PendingReturn | null | undefined = state.pendingReturn;
  if (!p) return null;
  const target = p.target ? placeName(state, p.target.spot) : null;
  if (p.phase === 'hold') {
    return `Retrying ${target ?? 'the target'} in ${waitText((p.until ?? 0) - state.totalTicks)}`;
  }
  if (p.phase === 'fallback' && p.fallback) {
    const wins = Math.max(0, FALLBACK_WINS - p.wins);
    const left = p.until === undefined ? '' : ` or ${waitText(p.until - state.totalTicks)}`;
    return `Hunting ${placeName(state, p.fallback.spot)} for ${wins} wins${left}${target ? `, then ${target}` : ''}`;
  }
  if (p.phase === 'return' && p.target && state.spot === p.target.spot && SPOTS[p.target.spot]) {
    const act = spotActivities(SPOTS[p.target.spot]).find((a) => a.id === p.target!.activity);
    if (act?.kind === 'hunt') return `At ${target}: the return ends at the first win.`;
  }
  return `Returning to ${target ?? 'the target'}${state.recovering ? ' after recovery' : ''}`;
}
