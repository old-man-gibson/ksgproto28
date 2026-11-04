import type { EventBus } from '../engine/events';
import type { FloorDef, GameState, PendingReturn, ReturnSpot } from '../types';
import { TPS } from '../engine/loop';
import { FLOOR_BY_AREA, SPOTS, edgesFrom } from '../registry';
import { canStartActivity, currentActivity, spotActivities, startActivity } from './actions';
import { bumpStat, raiseStat } from './achievements';
import { eligibleEncounters, spotCleared } from './combat';
import { festivalFloorOf } from './festivalRules';
import { floorUnlocked, rungIndex } from './ladder';
import { findPath, goAndDo } from './locations';
import { climbTo, towerAt } from './towers';
import { text } from '../text/log';

/**
 * The knockout return (docs/plans/knockout-return.md, user 2026-11-03: a
 * knockout must not leave the character idle).
 *
 * The retreat to the haven stays (systems/safety.ts). What changes is what
 * follows it. A knockout records the work it interrupted (`pendingReturn`),
 * recovery runs to 95% instead of 60%, and the tick walks back and resumes.
 *
 * Phases, in the order a failing spot moves through them:
 * - `return`: back to the spot the character fell at. A win there ends it.
 * - `fallback`: after 5 knockouts in a row at one spot (or when that spot
 *   cannot be walked back to), hunt the `proven` spot until 200 wins or 2 h,
 *   then retry the target.
 * - `hold`: with no usable proven spot, wait at the haven and probe the
 *   target after 10, 20, 40, then 80 minutes. The longest wait is 80 minutes.
 *
 * The return never walks into a forced fight (a forced spot, a forced last
 * road, a spot that cannot be reached without one), never targets the
 * stronghold wall and never targets a festival floor; those fall back.
 */

/** Knockouts in a row at one spot after which the return stops going back to it. */
export const STREAK_LIMIT = 5;
/** Consecutive wins at one hunt spot that make it the proven hunt. */
export const PROVEN_STREAK = 10;
/** Wins at the fallback before the target is retried. */
export const FALLBACK_WINS = 200;
/** Game time at the fallback before the target is retried: 2 h. */
export const FALLBACK_TICKS = 2 * 3600 * TPS;
/** Hold lengths in minutes, one per failed probe. The last repeats. */
export const HOLD_MINUTES = [10, 20, 40, 80];

/**
 * Spots the return never targets. The stronghold wall ends the run by an
 * automatic prestige on its last win (data/prestige.data.ts STRONGHOLD_HELD),
 * so an absent character must not keep walking back to it.
 */
export const NEVER_TARGET_SPOTS: readonly string[] = ['f11_wall'];
const NEVER_TARGET: ReadonlySet<string> = new Set(NEVER_TARGET_SPOTS);

const koKey = (spot: string): string => `ko:n:${spot}`;
const winKey = (spot: string): string => `win:n:${spot}`;

/** Knockouts in a row at a spot: up by 1 per knockout, deleted by a win there. */
export function knockoutStreak(state: GameState, spot: string): number {
  return state.stats[koKey(spot)] ?? 0;
}

/** Ticks a hold lasts after `probes` failed probes: 10, 20, 40, 80, 80... minutes. */
export function holdTicks(probes: number): number {
  const i = Math.max(0, Math.min(HOLD_MINUTES.length - 1, probes));
  return HOLD_MINUTES[i] * 60 * TPS;
}

/** Drop the return in flight: the player chose something else, or a prestige began a new run. */
export function clearReturn(state: GameState): void {
  if (state.pendingReturn) state.pendingReturn = null;
}

/**
 * Whether the defeat summary opens for the knockout just recorded: only when
 * no return or fallback follows. A hold counts as nothing following, since the
 * character waits at the haven. The ledger is written either way, and the
 * Fight Feed opens it on demand.
 */
export function defeatDialogDue(state: GameState): boolean {
  const p = state.pendingReturn;
  return !p || p.phase === 'hold';
}

// ---------- Routes ----------

/** The floor a spot stands on, or null off the ladder. */
function floorOf(spotId: string): FloorDef | null {
  const spot = SPOTS[spotId];
  return spot ? (FLOOR_BY_AREA.get(spot.areaId) ?? null) : null;
}

/**
 * The hops from the character's spot to `to`: a road route, else the ladder to
 * the target floor's landing and a road route from there. `start` is where the
 * walk begins. Null when neither exists.
 */
function hopsTo(state: GameState, to: string): { start: string; path: string[] } | null {
  const direct = findPath(state, state.spot, to);
  if (direct) return { start: state.spot, path: direct };
  const floor = floorOf(to);
  if (!floor?.landing || floor.id === floorOf(state.spot)?.id) return null;
  const tower = towerAt(state);
  if (!tower || tower.id !== floor.towerId || !floorUnlocked(state, floor)) return null;
  const path = findPath(state, floor.landing, to);
  return path ? { start: floor.landing, path } : null;
}

/** Why the return cannot go to a spot. */
type Why = 'forced_spot' | 'forced_road' | 'wall' | 'festival' | 'route' | 'start' | 'idle';

/**
 * Why the character cannot be sent from where it stands to `goal` and put to
 * work, or null when it can. The route never passes through a forced spot
 * (`findPath` refuses them), so the checks left are the destination itself and
 * the last road into it.
 */
export function returnBlock(state: GameState, goal: ReturnSpot): Why | null {
  const spot = SPOTS[goal.spot];
  if (!spot) return 'route';
  if (NEVER_TARGET.has(goal.spot)) return 'wall';
  if (spot.forced) return 'forced_spot';
  if (festivalFloorOf(goal.spot)) return 'festival';
  if (!canStartActivity(state, goal.spot, goal.activity)) return 'start';
  if (goal.spot === state.spot) return null;
  const hops = hopsTo(state, goal.spot);
  if (!hops) return 'route';
  // The last hop is a road when the walk has hops; a climb alone ends on the landing.
  if (hops.path.length > 0) {
    const prev = hops.path.length > 1 ? hops.path[hops.path.length - 2] : hops.start;
    if (edgesFrom(prev).find((e) => e.to === goal.spot)?.forced) return 'forced_road';
  }
  return null;
}

function whyText(why: Why): string {
  switch (why) {
    case 'forced_spot':
      return text('knockout.why_forced_spot');
    case 'forced_road':
      return text('knockout.why_forced_road');
    case 'wall':
      return text('knockout.why_wall');
    case 'festival':
      return text('knockout.why_festival');
    case 'route':
      return text('knockout.why_route');
    case 'start':
      return text('knockout.why_start');
    case 'idle':
      return text('knockout.why_idle');
  }
}

/**
 * A hunt spot the return may send the character to as a fallback, or null:
 * a hunt activity at a spot with no fight budget, not forced, not on a
 * festival floor, with an encounter eligible now, reachable by a walk with no
 * forced hop, and not on a higher floor than `fallSpot`'s. `fallSpot` itself
 * is never its own fallback.
 */
function usableHunt(state: GameState, cand: ReturnSpot | null | undefined, fallSpot: string): ReturnSpot | null {
  if (!cand || cand.spot === fallSpot) return null;
  const spot = SPOTS[cand.spot];
  if (!spot || spot.fightLimit || spot.forced || NEVER_TARGET.has(cand.spot) || festivalFloorOf(cand.spot)) return null;
  const act = spotActivities(spot).find((a) => a.id === cand.activity);
  if (act?.kind !== 'hunt') return null;
  if (spotCleared(state, spot) || eligibleEncounters(state, spot).length === 0) return null;
  const here = floorOf(fallSpot);
  const there = floorOf(cand.spot);
  if (here && there && rungIndex(there) > rungIndex(here)) return null;
  return returnBlock(state, cand) === null ? cand : null;
}

// ---------- The knockout ----------

/** What a knockout interrupted, read before the retreat clears it. */
export interface Fall {
  spot: string;
  activity: string | null;
}

export function captureFall(state: GameState): Fall {
  return { spot: state.spot, activity: state.activity };
}

const spotName = (id: string): string => SPOTS[id]?.name ?? id;
const minutes = (ticks: number): number => Math.max(1, Math.round(ticks / (60 * TPS)));

function say(bus: EventBus, msg: string): void {
  bus.emit({ type: 'log', msg, kind: 'action' });
}

// The phases copy the spots they are given: a spot may be the live `proven`, or
// the previous return's target, and neither should be shared with the new one.
const copy = (spot: ReturnSpot): ReturnSpot => ({ spot: spot.spot, activity: spot.activity });

function fallbackPhase(
  state: GameState,
  target: ReturnSpot | null,
  fallback: ReturnSpot,
  probes: number,
): PendingReturn {
  return {
    target: target && copy(target),
    phase: 'fallback',
    fallback: copy(fallback),
    wins: 0,
    until: state.totalTicks + FALLBACK_TICKS,
    probes,
  };
}

function holdPhase(state: GameState, target: ReturnSpot, probes: number): PendingReturn {
  return { target: copy(target), phase: 'hold', wins: 0, until: state.totalTicks + holdTicks(probes), probes };
}

/** A return to `target`: a first return, a retry after a fallback, or a probe after a hold. */
function returnPhase(target: ReturnSpot, probes: number): PendingReturn {
  return { target: copy(target), phase: 'return', wins: 0, probes };
}

/**
 * A knockout has just happened and the retreat has run: decide what follows
 * and say it in one log line. `fall` is what the character was doing and where,
 * captured before the retreat cleared it. Called from the four knockout sites
 * (combat.ts onDefeat; actions.ts, the three conditions that finish the player).
 * `retreatToSafety` is not a site: a festival forfeit also calls it.
 */
export function noteKnockout(state: GameState, bus: EventBus, fall: Fall): void {
  const old = state.pendingReturn ?? null;
  // A knockout with no work running while a return is in flight (a condition
  // finishing someone waiting at the haven): the return carries on as it was.
  if (!fall.activity && old) {
    announce(state, bus, old);
    return;
  }

  const n = fall.activity ? bumpKnockouts(state, bus, fall.spot) : 0;

  // A knockout at the fallback itself: keep the target, go back to the
  // fallback, and after 5 in a row there wait out a hold on the target.
  if (old?.phase === 'fallback' && old.fallback?.spot === fall.spot) {
    if (n < STREAK_LIMIT && usableHunt(state, old.fallback, '')) {
      say(bus, text('knockout.return', { spot: spotName(fall.spot) }));
      return;
    }
    const target = old.target ?? old.fallback;
    state.pendingReturn = holdPhase(state, target, old.probes);
    say(
      bus,
      text('knockout.fallback_failed', {
        count: n,
        spot: spotName(fall.spot),
        target: spotName(target.spot),
        minutes: minutes(holdTicks(old.probes)),
      }),
    );
    return;
  }

  const target: ReturnSpot | null = fall.activity ? { spot: fall.spot, activity: fall.activity } : null;
  const why: Why | null = target ? returnBlock(state, target) : 'idle';

  if (target && why === null) {
    const carried = old?.target?.spot === target.spot ? old.probes : 0;
    if (n < STREAK_LIMIT) {
      state.pendingReturn = returnPhase(target, carried);
      say(bus, text('knockout.return', { spot: spotName(target.spot) }));
      return;
    }
    // The streak is reached. A return after that (n above the limit) is a
    // retry or a probe that failed, which doubles the hold.
    const fb = usableHunt(state, state.proven, target.spot);
    if (fb) {
      state.pendingReturn = fallbackPhase(state, target, fb, carried);
      say(
        bus,
        text('knockout.streak_fallback', {
          count: n,
          spot: spotName(target.spot),
          fallback: spotName(fb.spot),
          wins: FALLBACK_WINS,
        }),
      );
      return;
    }
    const probes = n > STREAK_LIMIT ? carried + 1 : 0;
    state.pendingReturn = holdPhase(state, target, probes);
    say(
      bus,
      text('knockout.hold', { spot: spotName(target.spot), minutes: minutes(holdTicks(probes)) }),
    );
    return;
  }

  // Not a spot the return walks back to: hunt the proven spot, with no target
  // to retry, or idle when none is usable.
  const fb = usableHunt(state, state.proven, fall.spot);
  if (fb) {
    state.pendingReturn = fallbackPhase(state, null, fb, 0);
    say(
      bus,
      text('knockout.blocked_fallback', {
        spot: spotName(fall.spot),
        why: whyText(why!),
        fallback: spotName(fb.spot),
        wins: FALLBACK_WINS,
      }),
    );
    return;
  }
  state.pendingReturn = null;
  say(bus, text('knockout.blocked_idle', { spot: spotName(fall.spot), why: whyText(why!) }));
}

/** Count a knockout at a spot. A spot that sends the character down 5 times in a row stops being proven. */
function bumpKnockouts(state: GameState, bus: EventBus, spot: string): number {
  bumpStat(state, bus, koKey(spot));
  const n = state.stats[koKey(spot)] ?? 1;
  if (state.stats[winKey(spot)] !== undefined) delete state.stats[winKey(spot)];
  if (n >= STREAK_LIMIT && state.proven?.spot === spot) state.proven = null;
  return n;
}

/** Say again what a return already in flight does next. */
function announce(state: GameState, bus: EventBus, p: PendingReturn): void {
  if (p.phase === 'hold') {
    const left = Math.max(0, (p.until ?? 0) - state.totalTicks);
    say(bus, text('knockout.hold', { spot: spotName(p.target?.spot ?? ''), minutes: minutes(left) }));
    return;
  }
  const goal = p.phase === 'fallback' ? p.fallback : p.target;
  if (goal) say(bus, text('knockout.return', { spot: spotName(goal.spot) }));
}

// ---------- Wins ----------

/**
 * A fight was won. Ends the knockout streak at the spot, counts toward the
 * proven hunt, and moves a return along: a win at the target ends it, a win at
 * the fallback counts toward the retry.
 */
function onWin(state: GameState, bus: EventBus, spotId: string, forced: boolean): void {
  if (state.stats[koKey(spotId)] !== undefined) delete state.stats[koKey(spotId)];

  const act = currentActivity(state);
  const spot = SPOTS[spotId];
  if (
    !forced &&
    act?.kind === 'hunt' &&
    spot &&
    !spot.fightLimit &&
    !spot.forced &&
    !NEVER_TARGET.has(spotId) &&
    !festivalFloorOf(spotId)
  ) {
    const n = Math.min(PROVEN_STREAK, (state.stats[winKey(spotId)] ?? 0) + 1);
    raiseStat(state, bus, winKey(spotId), n);
    if (n >= PROVEN_STREAK && (state.proven?.spot !== spotId || state.proven.activity !== act.id)) {
      state.proven = { spot: spotId, activity: act.id };
    }
  }

  const p = state.pendingReturn;
  if (!p) return;
  if (p.phase === 'fallback' && p.fallback?.spot === spotId) {
    p.wins += 1;
    if (p.wins >= FALLBACK_WINS) retryTarget(state, bus, p);
  } else if (p.phase === 'return' && p.target?.spot === spotId) {
    state.pendingReturn = null;
  }
}

export function registerKnockoutListeners(state: GameState, bus: EventBus): void {
  bus.on('fight:won', (ev) => onWin(state, bus, ev.spot, ev.forced));
}

// ---------- The tick ----------

/**
 * A fallback is over (200 wins, or 2 h) or a hold is: go back to the target,
 * or with none stay where the character is and hunt on as normal. The
 * `probes` count rides along, so a probe that fails doubles the next hold.
 */
function retryTarget(state: GameState, bus: EventBus, p: PendingReturn): void {
  if (!p.target) {
    state.pendingReturn = null;
    return;
  }
  state.pendingReturn = returnPhase(p.target, p.probes);
  say(bus, text('knockout.retry', { spot: spotName(p.target.spot) }));
}

type Drive = 'moving' | 'there' | 'stuck';

/**
 * One step toward `goal`, for a character that is idle, recovered and out of
 * combat. At the goal: start its activity. Elsewhere: `goAndDo` when a road
 * route exists, else the ladder to the goal's floor (the next step then finds
 * a road from the landing). Each call either moves, arrives or reports stuck,
 * so the driver cannot loop on a goal it cannot reach.
 *
 * The goal's activity is started with `startActivity`, never `selectActivity`:
 * selecting is a player command and clears the return it serves.
 */
function driveTo(state: GameState, bus: EventBus, goal: ReturnSpot): Drive {
  if (state.spot === goal.spot) {
    if (state.activity === goal.activity) return 'there';
    if (!canStartActivity(state, goal.spot, goal.activity)) return 'stuck';
    startActivity(state, bus, goal.activity);
    return state.activity === goal.activity ? 'there' : 'stuck';
  }
  if (returnBlock(state, goal) !== null) return 'stuck';
  if (findPath(state, state.spot, goal.spot)) {
    return goAndDo(state, bus, goal.spot, goal.activity) ? 'moving' : 'stuck';
  }
  const floor = floorOf(goal.spot);
  if (floor && towerAt(state) && climbTo(state, bus, floor.id)) return 'moving';
  return 'stuck';
}

/**
 * The goal cannot be reached or started any more. A target falls back to the
 * proven hunt, or with none waits out a hold on itself; a fallback waits out a
 * hold on the target. Only a fallback with no target to hold on ends the
 * return.
 */
function giveUp(state: GameState, bus: EventBus, p: PendingReturn): void {
  if (p.phase === 'fallback') {
    if (!p.target) {
      state.pendingReturn = null;
      return;
    }
    state.pendingReturn = holdPhase(state, p.target, p.probes);
    say(bus, text('knockout.hold', { spot: spotName(p.target.spot), minutes: minutes(holdTicks(p.probes)) }));
    return;
  }
  const target = p.target;
  const fb = target ? usableHunt(state, state.proven, target.spot) : null;
  if (target && fb) {
    state.pendingReturn = fallbackPhase(state, null, fb, 0);
    say(
      bus,
      text('knockout.blocked_fallback', {
        spot: spotName(target.spot),
        why: whyText(returnBlock(state, target) ?? 'route'),
        fallback: spotName(fb.spot),
        wins: FALLBACK_WINS,
      }),
    );
    return;
  }
  if (!target) {
    state.pendingReturn = null;
    return;
  }
  // No proven hunt to fall back to: wait at the haven and try the target again
  // later, the wait doubling with each failure. A road that is shut now may be
  // open at the next probe, so the return is not given up.
  const probes = p.probes + 1;
  state.pendingReturn = holdPhase(state, target, probes);
  say(
    bus,
    text('knockout.blocked_hold', {
      spot: spotName(target.spot),
      why: whyText(returnBlock(state, target) ?? 'route'),
      minutes: minutes(holdTicks(probes)),
    }),
  );
}

/**
 * One tick of the return, called by `tickAction` once recovery is over. Acts
 * only on a character that is not fighting, not walking and not at a bench or
 * on a stage (a bench run or a performance is the player's own work, which
 * ends the return).
 */
export function tickKnockoutReturn(state: GameState, bus: EventBus): void {
  const p = state.pendingReturn;
  if (!p || state.recovering || state.combat || state.travel || state.travelPlan.length > 0) return;
  if (state.benchWork || state.performance) {
    state.pendingReturn = null;
    return;
  }

  if (p.phase === 'hold') {
    if (state.totalTicks >= (p.until ?? 0)) retryTarget(state, bus, p);
    return;
  }
  if (p.phase === 'fallback' && p.until !== undefined && state.totalTicks >= p.until) {
    // With a target left, the next tick drives to it; with none, hunting goes on here.
    retryTarget(state, bus, p);
    return;
  }

  const goal = p.phase === 'fallback' ? p.fallback : p.target;
  if (!goal) {
    state.pendingReturn = null;
    return;
  }
  const step = driveTo(state, bus, goal);
  if (step === 'stuck') {
    giveUp(state, bus, p);
    return;
  }
  // Work with no fights has no win to end the return: arriving ends it.
  if (step === 'there' && p.phase === 'return') {
    const act = spotActivities(SPOTS[goal.spot]).find((a) => a.id === goal.activity);
    if (act?.kind !== 'hunt') state.pendingReturn = null;
  }
}
