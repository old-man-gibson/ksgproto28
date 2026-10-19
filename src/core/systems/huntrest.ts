import type { EventBus } from '../engine/events';
import type { GameState, HuntRest } from '../types';
import { getDerivedStats } from './derived';
import { hpFraction } from './health';
import { statusBlocksRegen } from './statuses';
import { text } from '../text/log';

/**
 * Rest before the next fight (user, 2026-10-17). A hunt rolls its next
 * encounter the moment the respawn timer runs out, whatever is left of the
 * player — and chained fights with no recovery are what knock band-1 players
 * out (the knockout tracer, playtest 2026-10-17). With a threshold set, a hunt
 * whose player is below it rests in place first, at the rest rate, until HP
 * is back to full or back to the threshold (the player's choice).
 *
 * Off by default (`at: 0`), so nothing changes until a player sets it. It
 * gates SPAWNING only: a fight already under way, a forced fight on arrival
 * and the keeper's dare are untouched.
 */

export const DEFAULT_HUNT_REST: HuntRest = { at: 0, toFull: true, active: false };

/** The player's setting, tolerating saves that predate it. */
export function huntRest(state: GameState): HuntRest {
  return state.huntRest ?? DEFAULT_HUNT_REST;
}

/** Set the threshold (a share of max HP, 0 = off) and what resting aims for. */
export function setHuntRest(state: GameState, at: number, toFull: boolean): void {
  const clamped = Math.max(0, Math.min(1, at));
  state.huntRest = { at: clamped, toFull, active: clamped > 0 && huntRest(state).active };
}

/** The HP share resting stops at. */
export function restTarget(cfg: HuntRest): number {
  return cfg.toFull ? 1 : cfg.at;
}

/** True while the hunt is holding its next fight back so the player can rest. */
export function restingForFight(state: GameState): boolean {
  return huntRest(state).active;
}

/**
 * Called where a hunt would roll its next encounter. True = rest instead.
 * A pool that cannot recover (a condition blocking HP regen) never makes the
 * hunt wait forever: it gives up and fights.
 */
export function holdNextFight(state: GameState, bus: EventBus): boolean {
  const cfg = huntRest(state);
  if (cfg.at <= 0) {
    if (cfg.active) state.huntRest = { ...cfg, active: false };
    return false;
  }
  const stats = getDerivedStats(state);
  const share = hpFraction(state, stats);
  const stuck = stats.hpRegen <= 0 || statusBlocksRegen(state, 'hp');
  if (!cfg.active) {
    if (share >= cfg.at || stuck) return false;
    state.huntRest = { ...cfg, active: true };
    bus.emit({
      type: 'log',
      msg: text('huntrest.resting', {
        hp: Math.floor(share * 100),
        at: Math.round(cfg.at * 100),
        to: Math.round(restTarget(cfg) * 100),
      }),
      kind: 'action',
    });
    return true;
  }
  // Within a hair of full counts as full: regen approaches the cap, and a
  // fraction of a point should not hold a fight back.
  if (share >= restTarget(cfg) - 0.005 || stuck) {
    state.huntRest = { ...cfg, active: false };
    bus.emit({ type: 'log', msg: text(stuck ? 'huntrest.stuck' : 'huntrest.done'), kind: 'action' });
    return false;
  }
  return true;
}

/** Stop resting without a fight (the player left the hunt, or was carried off). */
export function clearRest(state: GameState): void {
  const cfg = huntRest(state);
  if (cfg.active) state.huntRest = { ...cfg, active: false };
}
