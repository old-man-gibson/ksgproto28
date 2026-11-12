import type { EventBus } from '../engine/events';
import type { FloorDef, GameState, PendingReturn, ReturnSpot, SpotDef } from '../types';
import { TPS } from '../engine/loop';
import { FLOOR_BY_AREA, SPOTS, edgesFrom } from '../registry';
import { canStartActivity, currentActivity, spotActivities, startActivity } from './actions';
import { bumpStat, raiseStat, setStat } from './achievements';
import { eligibleEncounters, inForcedFight, spotCleared } from './combat';
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
 *   then retry the target. With no usable proven spot, a spot with a fight
 *   budget that was won at before (and not lost at since) stands in, the most
 *   recent first; when its budget is spent the pick is made again. With
 *   neither, a roofed (`indoor`) endless hunt on the fall's floor stands in,
 *   the lowest level first.
 * - `hold`: with no usable fallback of any kind, wait at the haven and probe the
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
/** World tick of the last win at a spot with a fight budget: which limited fallback is the most recent. */
const lastWinKey = (spot: string): string => `win:at:${spot}`;

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
type Why = 'forced_spot' | 'forced_road' | 'wall' | 'festival' | 'route' | 'start';

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

/** Why a forced fight with no activity at `spotId` is not walked back into. */
function ambushWhy(spotId: string): Why {
  if (NEVER_TARGET.has(spotId)) return 'wall';
  if (SPOTS[spotId]?.forced) return 'forced_spot';
  if (festivalFloorOf(spotId)) return 'festival';
  return 'forced_road';
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
  }
}

/**
 * A hunt spot the return may send the character to as a fallback, or null:
 * a hunt activity at a spot that is not forced, not on a festival floor and
 * not the wall, not cleared, with an encounter eligible now, reachable by a
 * walk with no forced hop, and not on a higher floor than `fallSpot`'s.
 * `fallSpot` itself is never its own fallback. A fight budget is allowed here:
 * whether a limited spot may be PICKED is `limitedHunt`'s.
 */
function huntUsable(state: GameState, cand: ReturnSpot | null | undefined, fallSpot: string): ReturnSpot | null {
  if (!cand || cand.spot === fallSpot) return null;
  const spot = SPOTS[cand.spot];
  if (!spot || spot.forced || NEVER_TARGET.has(cand.spot) || festivalFloorOf(cand.spot)) return null;
  const act = spotActivities(spot).find((a) => a.id === cand.activity);
  if (act?.kind !== 'hunt') return null;
  if (spotCleared(state, spot) || eligibleEncounters(state, spot).length === 0) return null;
  const here = floorOf(fallSpot);
  const there = floorOf(cand.spot);
  if (here && there && rungIndex(there) > rungIndex(here)) return null;
  return returnBlock(state, cand) === null ? cand : null;
}

/** The proven hunt, if usable. It has no fight budget, so it never runs out. */
function usableHunt(state: GameState, cand: ReturnSpot | null | undefined, fallSpot: string): ReturnSpot | null {
  if (cand && SPOTS[cand.spot]?.fightLimit) return null;
  return huntUsable(state, cand, fallSpot);
}

/**
 * A spot with a fight budget that the return may fall back to when no proven
 * hunt is usable (user, 2026-11-04: after a band-1 boss loss, allow it). Ten
 * wins in a row cannot happen there, since budgets are small, so the test is:
 * discovered, fights left, a win there and no knockout there since the last
 * one (`win:n` survives only until a knockout), plus every check of
 * `huntUsable`. Of those, the spot won at most recently.
 */
function limitedHunt(state: GameState, fallSpot: string): ReturnSpot | null {
  let best: ReturnSpot | null = null;
  let bestAt = -1;
  for (const id of state.discovered) {
    const spot = SPOTS[id];
    if (!spot?.fightLimit || (state.stats[winKey(id)] ?? 0) < 1) continue;
    const act = spotActivities(spot).find((a) => a.kind === 'hunt');
    if (!act) continue;
    const at = state.stats[lastWinKey(id)] ?? 0;
    if (at <= bestAt) continue;
    const cand = huntUsable(state, { spot: id, activity: act.id }, fallSpot);
    if (cand) {
      best = cand;
      bestAt = at;
    }
  }
  return best;
}

/**
 * The lowest encounter level a hunt can roll now. Used only to order the
 * roofed picks of `indoorHunt`.
 */
function huntLevel(state: GameState, spot: SpotDef): number {
  let low = Infinity;
  for (const e of eligibleEncounters(state, spot)) low = Math.min(low, e.level[0]);
  return low;
}

/**
 * A roofed hunt on the fall's floor, for a fall with no proven or limited spot
 * to go to. Without it the hold idles the character at the haven for 10 to 80
 * minutes, which a knockout may not do (2026-11-03); on the Malgeri Crossing
 * the open ridge under a calm is where five knockouts in a row happen with
 * nothing proven. Discovered, tagged `indoor`, no fight budget, plus every
 * check of `huntUsable`. The lowest level first, then the order the spots were
 * found in. A roof takes the spot out of the sky's reach, so the pick is not in
 * the weather that caused the knockouts. A floor with no roofed hunt finds none.
 */
function indoorHunt(state: GameState, fallSpot: string): ReturnSpot | null {
  const floor = floorOf(fallSpot);
  if (!floor) return null;
  let best: ReturnSpot | null = null;
  let bestLevel = Infinity;
  for (const id of state.discovered) {
    const spot = SPOTS[id];
    if (!spot?.tags?.includes('indoor') || spot.fightLimit || floorOf(id)?.id !== floor.id) continue;
    const act = spotActivities(spot).find((a) => a.kind === 'hunt');
    if (!act) continue;
    const cand = huntUsable(state, { spot: id, activity: act.id }, fallSpot);
    if (!cand) continue;
    const level = huntLevel(state, spot);
    if (level < bestLevel) {
      best = cand;
      bestLevel = level;
    }
  }
  return best;
}

/**
 * Where a fallback hunts: the proven spot when it is usable, since it never
 * runs out, else the limited spot won at most recently, else a roofed hunt on
 * the fall's floor.
 */
function pickFallback(state: GameState, fallSpot: string): ReturnSpot | null {
  return usableHunt(state, state.proven, fallSpot) ?? limitedHunt(state, fallSpot) ?? indoorHunt(state, fallSpot);
}

// ---------- The knockout ----------

/**
 * What a knockout interrupted, read before the retreat clears it. `forced`:
 * the fight was one that could not be fled. Those start on arrival with no
 * activity selected (travel clears it), so a forced fight is the work the
 * player walked into even when `activity` is null.
 */
export interface Fall {
  spot: string;
  activity: string | null;
  forced: boolean;
}

export function captureFall(state: GameState): Fall {
  return { spot: state.spot, activity: state.activity, forced: inForcedFight(state) };
}

const spotName = (id: string): string => SPOTS[id]?.name ?? id;
const minutes = (ticks: number): number => Math.max(1, Math.round(ticks / (60 * TPS)));

function say(bus: EventBus, msg: string): void {
  bus.emit({ type: 'log', msg, kind: 'action' });
}

// The phases copy the spots they are given: a spot may be the live `proven`, or
// the previous return's target, and neither should be shared with the new one.
const copy = (spot: ReturnSpot): ReturnSpot => ({ spot: spot.spot, activity: spot.activity });

/** `from`: the spot the fall happened at, the ceiling for this fallback and any pick that replaces it. */
function fallbackPhase(
  state: GameState,
  target: ReturnSpot | null,
  fallback: ReturnSpot,
  probes: number,
  from: string,
): PendingReturn {
  return {
    target: target && copy(target),
    phase: 'fallback',
    fallback: copy(fallback),
    wins: 0,
    until: state.totalTicks + FALLBACK_TICKS,
    probes,
    from,
  };
}

/** The ceiling spot for a pick that replaces `p`'s fallback: where the fall happened. */
const fallOf = (p: PendingReturn, replaced: string): string => p.from ?? p.target?.spot ?? replaced;

/**
 * `p` with another fallback: the wins, the 2 h clock, the target and the probe
 * count carry over, since this is the same fall and the same fallback phase.
 */
function repicked(p: PendingReturn, fb: ReturnSpot, from: string): PendingReturn {
  return {
    target: p.target && copy(p.target),
    phase: 'fallback',
    fallback: copy(fb),
    wins: p.wins,
    ...(p.until !== undefined ? { until: p.until } : {}),
    probes: p.probes,
    from,
  };
}

/**
 * A limited fallback is gone: spent, or lost at since its last win. Pick again
 * from the fall floor. With none left, hold on the target, or with no target
 * (a forced-spot loss) end the return. A spent fallback is hunted where the
 * character stands, so with none left that hunt stops and the hold waits there
 * (a cleared spot spawns nothing); a lost one follows a knockout, which has
 * already moved the character to the haven.
 */
function replaceFallback(
  state: GameState,
  bus: EventBus,
  p: PendingReturn,
  gone: ReturnSpot,
  why: 'spent' | 'lost',
): void {
  const from = fallOf(p, gone.spot);
  const fb = pickFallback(state, from);
  if (fb) {
    state.pendingReturn = repicked(p, fb, from);
    say(
      bus,
      text(why === 'spent' ? 'knockout.spent_fallback' : 'knockout.lost_fallback', {
        spot: spotName(gone.spot),
        fallback: spotName(fb.spot),
      }),
    );
    return;
  }
  if (why === 'spent') startActivity(state, bus, null);
  if (p.target) {
    state.pendingReturn = holdPhase(state, p.target, p.probes);
    say(
      bus,
      text(why === 'spent' ? 'knockout.spent_hold' : 'knockout.lost_hold', {
        spot: spotName(gone.spot),
        target: spotName(p.target.spot),
        minutes: minutes(holdTicks(p.probes)),
      }),
    );
    return;
  }
  state.pendingReturn = null;
  say(bus, text(why === 'spent' ? 'knockout.spent_idle' : 'knockout.lost_idle', { spot: spotName(gone.spot) }));
}

function holdPhase(state: GameState, target: ReturnSpot, probes: number): PendingReturn {
  return { target: copy(target), phase: 'hold', wins: 0, until: state.totalTicks + holdTicks(probes), probes };
}

/**
 * A return to `target`: a first return, a retry after a fallback, or a probe
 * after a hold. A retry keeps the `fallback` it leaves: the character still
 * stands there until it sets out, and a knockout there is the fallback's.
 */
function returnPhase(target: ReturnSpot, probes: number, fallback?: ReturnSpot): PendingReturn {
  return { target: copy(target), phase: 'return', ...(fallback ? { fallback: copy(fallback) } : {}), wins: 0, probes };
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
  // No work was running and the fight was not a forced one: a character that
  // was idle (waiting on purpose, banking time) is not sent anywhere. A return
  // already in flight carries on as it was.
  if (!fall.activity && !fall.forced) {
    if (old) announce(state, bus, old);
    return;
  }

  const n = bumpKnockouts(state, bus, fall.spot);

  // A knockout at the fallback itself, in the fallback phase or right after
  // its retry (which keeps the fallback while the character still stands
  // there): the target and the probe count survive. In the fallback phase the
  // character goes back to the fallback; after the retry it carries on to the
  // target. After 5 in a row at the fallback, wait out a hold on the target.
  if (old?.fallback?.spot === fall.spot && (old.phase === 'fallback' || old.phase === 'return')) {
    if (old.phase === 'return' && old.target && n < STREAK_LIMIT) {
      say(bus, text('knockout.return', { spot: spotName(old.target.spot) }));
      return;
    }
    // A limited fallback holds only while no knockout has come since its last
    // win, so this one ends it at once: pick again from the fall floor.
    if (old.phase === 'fallback' && SPOTS[fall.spot]?.fightLimit) {
      replaceFallback(state, bus, old, old.fallback, 'lost');
      return;
    }
    if (old.phase === 'fallback' && n < STREAK_LIMIT && huntUsable(state, old.fallback, '')) {
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

  // A forced fight with no activity is the player's walk into an ambush: no
  // work to resume, and the way in is forced by the spot or by the road.
  const target: ReturnSpot | null = fall.activity ? { spot: fall.spot, activity: fall.activity } : null;
  const why: Why | null = target ? returnBlock(state, target) : ambushWhy(fall.spot);

  if (target && why === null) {
    const carried = old?.target?.spot === target.spot ? old.probes : 0;
    if (n < STREAK_LIMIT) {
      state.pendingReturn = returnPhase(target, carried);
      say(bus, text('knockout.return', { spot: spotName(target.spot) }));
      return;
    }
    // The streak is reached. A return after that (n above the limit) is a
    // retry or a probe that failed, which doubles the hold.
    const fb = pickFallback(state, target.spot);
    if (fb) {
      state.pendingReturn = fallbackPhase(state, target, fb, carried, target.spot);
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

  // Not a spot the return walks back to: hunt the proven spot (or a limited
  // spot won at before), with no target to retry, or idle when none is usable.
  const fb = pickFallback(state, fall.spot);
  if (fb) {
    state.pendingReturn = fallbackPhase(state, null, fb, 0, fall.spot);
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
  if (state.stats[lastWinKey(spot)] !== undefined) delete state.stats[lastWinKey(spot)];
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
    !spot.forced &&
    !NEVER_TARGET.has(spotId) &&
    !festivalFloorOf(spotId)
  ) {
    const n = Math.min(PROVEN_STREAK, (state.stats[winKey(spotId)] ?? 0) + 1);
    raiseStat(state, bus, winKey(spotId), n);
    if (spot.fightLimit) {
      // A fight budget runs out before 10 wins in a row, so such a spot is
      // never the proven hunt. It records when it was last won, for `limitedHunt`.
      setStat(state, bus, lastWinKey(spotId), state.totalTicks);
    } else if (n >= PROVEN_STREAK && (state.proven?.spot !== spotId || state.proven.activity !== act.id)) {
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
  state.pendingReturn = returnPhase(p.target, p.probes, p.fallback);
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
 * The goal cannot be reached or started any more. A target that is never
 * walked back into (forced, the wall, a festival floor) falls back to the
 * proven hunt with no target, or ends the return when there is none. Any other
 * target is kept: it falls back to the proven hunt and is retried after 200
 * wins or 2 h, or with no proven hunt waits out a hold on itself. A fallback
 * waits out a hold on its target; with no target it ends the return.
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
  if (!target) {
    state.pendingReturn = null;
    return;
  }
  const block = returnBlock(state, target) ?? 'route';
  const why = whyText(block);
  const fb = pickFallback(state, target.spot);

  // A spot the return never walks into (a forced spot or road, the wall, a
  // festival floor) loses its target: there is nothing to retry.
  if (block === 'forced_spot' || block === 'forced_road' || block === 'wall' || block === 'festival') {
    if (fb) {
      state.pendingReturn = fallbackPhase(state, null, fb, 0, target.spot);
      say(
        bus,
        text('knockout.blocked_fallback', {
          spot: spotName(target.spot),
          why,
          fallback: spotName(fb.spot),
          wins: FALLBACK_WINS,
        }),
      );
    } else {
      state.pendingReturn = null;
      say(bus, text('knockout.blocked_idle', { spot: spotName(target.spot), why }));
    }
    return;
  }

  // Anything else (a road shut now, an activity that cannot start now) may be
  // open at the next try, so the target is kept and the failure counted: the
  // proven hunt for 200 wins or 2 h, then the target again; with no proven
  // hunt, a hold at the haven whose wait doubles with each failure.
  const probes = p.probes + 1;
  if (fb) {
    state.pendingReturn = fallbackPhase(state, target, fb, probes, target.spot);
    say(
      bus,
      text('knockout.blocked_retry', {
        spot: spotName(target.spot),
        why,
        fallback: spotName(fb.spot),
        wins: FALLBACK_WINS,
        hours: FALLBACK_TICKS / (3600 * TPS),
      }),
    );
    return;
  }
  state.pendingReturn = holdPhase(state, target, probes);
  say(
    bus,
    text('knockout.blocked_hold', {
      spot: spotName(target.spot),
      why,
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
  const spent = p.phase === 'fallback' ? p.fallback : undefined;
  if (spent && SPOTS[spent.spot] && spotCleared(state, SPOTS[spent.spot])) {
    replaceFallback(state, bus, p, spent, 'spent');
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
