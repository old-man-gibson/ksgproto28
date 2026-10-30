import type { FightLedger, GameState } from '../core/types';
import { createInitialState } from '../core/state';
import { Game } from '../core/game';
import { MS_PER_TICK } from '../core/engine/loop';
import { getDerivedStats } from '../core/systems/derived';
import {
  clearStorage,
  deserialize,
  loadFromStorage,
  saveToStorage,
  serialize,
} from '../core/save/save';
import { OFFLINE_CAP_MS, catchUpTicks, runOfflineProgress, type OfflineSummary } from '../core/save/offline';
import { dropFight, isKept, keepFight, NOTEBOOK_MAX } from '../core/systems/ledger';
import { setSkipSettling } from '../core/systems/mutagens';
import type { SortMode } from '../core/systems/inventory';
import { forgetLayouts } from './lib/benchLayouts';

/**
 * Bridge between the pure core and Svelte. The game state is a deep-reactive
 * $state proxy; the core mutates it directly and the UI updates automatically.
 */
const loaded = loadFromStorage();

export const gs: GameState = $state(loaded.state ?? createInitialState());

export const game = new Game(gs);

if (loaded.corrupted) {
  game.bus.emit({
    type: 'log',
    msg: '⚠️ Your previous save could not be read. A recovery copy was kept in browser storage — do NOT reset before reporting this.',
    kind: 'danger',
  });
}

if (loaded.healed) {
  save(); // persist the healed state over the impostor immediately
  game.bus.emit({
    type: 'log',
    msg: '🩹 Restored your progress from a recovery copy after an earlier failed load.',
    kind: 'info',
  });
}

export const ui = $state({
  tab: 'location' as
    | 'location'
    | 'combat'
    | 'skills'
    | 'equipment'
    | 'chromosome'
    | 'music'
    | 'wuxin'
    | 'bestiary'
    | 'quests'
    | 'achievements'
    | 'prestige',
  offline: null as OfflineSummary | null,
  /**
   * Wall-clock ms the boot catch-up is about to simulate, while it runs. The
   * app mounts and paints BEFORE the catch-up so a heavy save shows an overlay
   * instead of a blank tab (an 8h catch-up on a mature save takes minutes;
   * see main.ts). Null once the world is caught up.
   */
  catchingUp: null as number | null,
  /** The fight summary being read, if any. */
  defeat: null as FightLedger | null,
  /**
   * `endedAt` of the last ledger already shown, so one knockout opens exactly
   * one window. Seeded from the loaded save: a defeat you have already closed
   * must not reopen every time you come back — the ledger is still there to
   * read on demand, it just stops nagging.
   */
  defeatShown: gs.lastFight?.endedAt ?? -1,
  mapOpen: true,
  /**
   * A bench to open once standing at `spot` — the map card's "go and open".
   * UI-only on purpose: a window is not game state, and a reload mid-walk
   * losing it costs one click.
   */
  benchOnArrival: null as { spot: string; bench: string } | null,
  /** The position-graph planner section on the Combat tab (see MartialPlanner). */
  plannerOpen: false,
  /** Weapon families the planner is filtering by — a view, never equipment. */
  plannerFamilies: [] as string[],
  /** Inventory grid ordering — survives tab switches. */
  invSort: 'newest' as SortMode,
  invGroup: true,
  /**
   * What is unfolded in the Skills tab: skill ids (and `attr_<id>` rows), and
   * technique ids separately. Kept here rather than in the panel so a glance at
   * the Combat tab does not cost you the tree you had just arranged — the whole
   * point of folding is that the arrangement STAYS.
   */
  skillsOpen: [] as string[],
  techOpen: [] as string[],
});

/**
 * The shared derived layer: computed once, read by every panel. Backed by the
 * memoized getDerivedStats, so `view.stats` keeps the same object identity —
 * and wakes no consumer — until a modifier source actually changes.
 */
class DerivedView {
  stats = $derived(getDerivedStats(gs));
}

export const view = new DerivedView();

/**
 * Catch the world up after time away, DETACHED from the reactive proxy: the
 * ticks run on a plain snapshot (measured ~16× faster — the proxy turns an
 * 8-hour catch-up from seconds into minutes) and the result lands back on `gs`
 * as one assignment. The worker Game re-registers the standard listeners
 * against the snapshot, so counters, quests and titles advance exactly as they
 * would have live.
 *
 * `quietSmallGaps` also simulates absences too short for a summary, logging
 * normally as it goes — the hidden-tab path. Boot leaves those to the next
 * frame, as it always has.
 */
function runCatchup(elapsedMs: number, quietSmallGaps: boolean): OfflineSummary | null {
  if (gs.paused) return null;
  const plain = $state.snapshot(gs) as GameState;
  const worker = new Game(plain);
  const before = plain.totalTicks;
  const bankedBefore = plain.bonusTime.banked;
  const summary = runOfflineProgress(worker, elapsedMs);
  if (!summary && quietSmallGaps) {
    // Still time away, so still catch-up for the convoys and the festival's
    // bank (catchUpTicks stops and banks once the festival holds the player).
    catchUpTicks(worker, Math.floor(Math.min(elapsedMs, OFFLINE_CAP_MS) / MS_PER_TICK));
  }
  // Nothing ran and nothing was banked — leave gs untouched.
  if (plain.totalTicks === before && plain.bonusTime.banked === bankedBefore) return summary;
  Object.assign(gs, plain);
  game.resyncAnnouncers();
  return summary;
}

/** Wall-clock ms since the last save — what boot's catch-up will simulate. */
export function timeAway(): number {
  return Math.max(0, Date.now() - gs.lastSaved);
}

/**
 * Offline catch-up for time since the last save. Call once on boot, AFTER
 * the app has mounted and painted — this blocks the thread for as long as
 * the capped catch-up takes.
 */
export function boot(): void {
  try {
    ui.offline = runCatchup(timeAway(), false);
  } finally {
    ui.catchingUp = null;
  }
}

/** Long-stall catch-up for the frame pump (laptop sleep, throttled tab). */
export function catchUp(elapsedMs: number): OfflineSummary | null {
  return runCatchup(elapsedMs, true);
}

export function save(): void {
  saveToStorage(gs);
}

/**
 * Keep the fight being read, or forget it if it is already kept. Eviction is
 * announced in the log rather than happening quietly — a notebook that drops
 * the fight you meant to study without saying so is worse than one that fills up.
 */
export function toggleKeep(ledger: FightLedger): void {
  if (isKept(gs, ledger)) {
    dropFight(gs, ledger.endedAt);
    return;
  }
  const evicted = keepFight(gs, ledger, Date.now());
  if (evicted) {
    const who = evicted.ledger.foes[0]?.name ?? 'an old fight';
    game.bus.emit({
      type: 'log',
      msg: `📓 Notebook full (${NOTEBOOK_MAX}) — dropped the oldest entry: ${who}.`,
      kind: 'info',
    });
  }
}

// ---------- Pause & stepping ----------

/**
 * Hand-crank the world by `ticks`. Stepping always implies a frozen world —
 * pressing step while the clock runs would otherwise be free extra time, which
 * is exactly what the pause exists to prevent.
 */
export function stepTicks(ticks: number): void {
  game.setPaused(true);
  game.step(ticks);
}

/** Step to the fight's next line; returns the ticks it took to arrive. */
export function stepEvent(): number {
  game.setPaused(true);
  return game.stepToEvent();
}

export function exportSave(): void {
  const blob = new Blob([serialize(gs)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `frontier-idle-save-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importSave(file: File): Promise<void> {
  try {
    const loaded = deserialize(await file.text());
    Object.assign(gs, loaded);
    game.resyncAnnouncers();
    forgetLayouts();
    save();
    game.bus.emit({ type: 'log', msg: '💾 Save imported.', kind: 'info' });
  } catch {
    game.bus.emit({ type: 'log', msg: '❌ Could not read that save file.', kind: 'danger' });
  }
}

/** DebugPanel toggle: the centromere never has to settle between swaps. */
export const DEBUG_SETTLE_KEY = 'ksg-debug:skip-settling';
// Pushed into the core HERE rather than when the debug panel opens, so the
// toggle survives a reload without having to visit the panel first. Gated on
// DEV for the same reason the panel is — a production build must not be able
// to reach it however the key got into storage.
setSkipSettling(import.meta.env.DEV && localStorage.getItem(DEBUG_SETTLE_KEY) === '1');

export function hardReset(): void {
  if (!confirm('Wipe ALL progress and start over?')) return;
  clearStorage();
  Object.assign(gs, createInitialState(Date.now()));
  game.resyncAnnouncers();
  // The benches' remembered layouts belong to the run that is gone.
  forgetLayouts();
  ui.offline = null;
  ui.defeat = null;
  ui.defeatShown = -1;
}

export { isKept, NOTEBOOK_MAX };
