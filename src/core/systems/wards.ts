import type { EventBus } from '../engine/events';
import type { GameState, WardWindowDef } from '../types';
import { FLOORS, MONSTERS } from '../registry';
import { WARD_WINDOWS } from '../data/wards.data';
import { bumpStat, setStat } from './achievements';
import { liveEnemies } from './combat';
import { bandPosKey, floorCleared } from './ladder';
import { checkFloorClears } from './levels';

/**
 * Band 3's ward windows (docs/plans/bands-2-3.md "The four wards", M12): a
 * threat that opens on a ward's position and stays for a number of ticks of
 * play. Ward 7's demon is the first: it appears when ward 7 is the last ward
 * left and is gone 24 in-game hours of play later.
 *
 * - **Open.** When the floor's position (`bandPosKey`, kept by levels.ts
 *   syncBandPositions) reaches `position` with the floor uncleared and
 *   `doneKey` unset, `atKey` is stamped with the tick.
 * - **The clock** (`wardClockKey`) counts live ticks only, the festival's
 *   rule (docs/FESTIVAL.md §3): one per `advance` while the window is open
 *   and the game is not catching up offline. A bonus-time tick is a second
 *   advance and counts. Offline time does not run the window down.
 * - **Fought.** `foughtKey` is set when a fight with `monsterId` at `spotId`
 *   ends with the threat having taken HP (its `lastHit` is stamped beside
 *   every HP loss), while the window is open. Walking in and straight out
 *   marks nothing.
 * - **Killed.** The spot's `stampOnClear` writes `doneKey` (combat.ts onKill).
 *   The window does nothing more: no flag.
 * - **Lapsed.** Once the clock reaches `ticks` with `doneKey` unset, and no
 *   fight with the threat is live (a live one is waited out: a kill then sets
 *   no flag, any other ending lapses the window on the next tick), `goneKey`
 *   and `doneKey` are set, so the ward counts cleared and content shuts the
 *   threat's row on `goneKey`, and exactly one flag: `flags.fought` if
 *   `foughtKey`, else `flags.unmet`. The flags are secret content: no log
 *   line, tracker or hint. The ward's clear logs as any floor clear does.
 *
 * Each tick costs a few stat reads per window. Every function takes the table
 * as a parameter, defaulting to WARD_WINDOWS, so a test can run a fixture.
 */

/** The run stat counting a window's live ticks since it opened. Derived, so the def names it nowhere. */
export function wardClockKey(w: Pick<WardWindowDef, 'atKey'>): string {
  return `${w.atKey}:clock`;
}

/** Open, not yet killed or lapsed. */
function windowOpen(state: GameState, w: WardWindowDef): boolean {
  return state.stats[w.atKey] !== undefined && (state.stats[w.doneKey] ?? 0) < 1;
}

/** Mark a window's threat as fought when a fight with it ends with it hurt. */
export function registerWardListeners(
  state: GameState,
  bus: EventBus,
  windows: WardWindowDef[] = WARD_WINDOWS,
): void {
  const fought = (w: WardWindowDef) => {
    if (windowOpen(state, w) && (state.stats[w.foughtKey] ?? 0) < 1) setStat(state, bus, w.foughtKey, 1);
  };
  bus.on('fight:closed', (ev) => {
    for (const w of windows) {
      if (ev.spot !== w.spotId) continue;
      if (ev.standing.some((e) => e.defId === w.monsterId && e.lastHit !== undefined)) fought(w);
    }
  });
  // A kill took HP too. The stamp it writes ends the window, so this only
  // keeps `foughtKey` true to its name.
  bus.on('kill', (ev) => {
    for (const w of windows) {
      if (state.spot === w.spotId && ev.monster.defId === w.monsterId) fought(w);
    }
  });
}

/**
 * Open, run and lapse each window. Runs every advance, travel included;
 * `catchingUp` (Game.catchingUp) stops the clock during offline catch-up.
 */
export function tickWards(
  state: GameState,
  bus: EventBus,
  catchingUp: boolean,
  windows: WardWindowDef[] = WARD_WINDOWS,
): void {
  for (const w of windows) {
    // Killed in time, or already lapsed: nothing left to watch.
    if ((state.stats[w.doneKey] ?? 0) >= 1) continue;
    if (state.stats[w.atKey] === undefined) {
      openWindow(state, bus, w);
      continue;
    }
    const clock = wardClockKey(w);
    if (!catchingUp && (state.stats[clock] ?? 0) < w.ticks) bumpStat(state, bus, clock);
    if ((state.stats[clock] ?? 0) >= w.ticks) lapseWindow(state, bus, w);
  }
}

/**
 * Stamp the opening tick once the floor's position reaches the window's. The
 * floor test runs only after the position test passes and until the stamp, so
 * an unopened window costs one stat read a tick.
 */
function openWindow(state: GameState, bus: EventBus, w: WardWindowDef): void {
  if ((state.stats[bandPosKey(w.floorId)] ?? 0) < w.position) return;
  const floor = FLOORS[w.floorId];
  if (!floor || floorCleared(state, floor)) return;
  setStat(state, bus, w.atKey, state.totalTicks);
}

/**
 * The time ran out with the threat alive. A fight with it still live is
 * waited out rather than cut short: its kill writes `doneKey` and ends the
 * window with no flag; any other ending leaves the clock full, and the next
 * tick lands here again with no fight. Then the ward is cleared and one
 * silent flag is set.
 */
function lapseWindow(state: GameState, bus: EventBus, w: WardWindowDef): void {
  const c = state.combat;
  if (c && state.spot === w.spotId && liveEnemies(c).some((e) => e.defId === w.monsterId)) return;
  // Kept wounds are a fight's mark too: a tab closed mid-fight saves the
  // wounds (combat.ts woundsForSave) but never closes the fight.
  const wounds = MONSTERS[w.monsterId]?.keepsWounds;
  const fought = (state.stats[w.foughtKey] ?? 0) >= 1 || (wounds !== undefined && (state.stats[wounds.key] ?? 0) > 0);
  setStat(state, bus, w.goneKey, 1);
  setStat(state, bus, w.doneKey, 1);
  setStat(state, bus, fought ? w.flags.fought : w.flags.unmet, 1);
  // The ward's clear pays now (clear XP, the band stamp, the other wards'
  // positions), not on the next kill or arrival.
  checkFloorClears(state, bus);
}
