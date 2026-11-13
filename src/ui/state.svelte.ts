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
  storagePersists,
} from '../core/save/save';
import { OFFLINE_CAP_MS, catchUpTicks, runOfflineProgress, type OfflineSummary } from '../core/save/offline';
import { dropFight, isKept, keepFight, NOTEBOOK_MAX } from '../core/systems/ledger';
import { setSkipSettling } from '../core/systems/mutagens';
import type { SortMode } from '../core/systems/inventory';
import { forgetLayouts } from './lib/benchLayouts';
import { bindFacets, dropFacetStatuses, installFacet } from '../core/facet/host';
import { initialSeen, visibleNav, writeSeen, type MainTab } from './lib/nav';
import { readLogChoice, writeLogChoice } from './lib/shell';
import { sharesFiles, shareTextFile } from './lib/nativeExport';

/**
 * Bridge between the pure core and Svelte. The game state is a deep-reactive
 * $state proxy; the core mutates it directly and the UI updates automatically.
 */
const loaded = loadFromStorage();

export const gs: GameState = $state(loaded.state ?? createInitialState());

export const game = new Game(gs);

// The FACET ability core (docs/FACET.md), installed and bound to the loaded
// save before anything renders: the run's ability's statuses are saved, but
// their definitions are rebuilt at attach. A failure is reported instead of
// thrown, so the game still starts, and the ability's statuses come off with
// it. tests/facet.test.ts installs the same adapter and fails on it.
try {
  installFacet();
  bindFacets(gs, true);
} catch (err) {
  console.error(err);
  dropFacetStatuses(gs);
}

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

// The browser refused its storage (site data blocked, a private or embedded view):
// the game runs and "saves" to memory, which the page's closing ends. Said once at
// boot, and in the Menu's Save row (SystemMenu.svelte).
if (!storagePersists) {
  game.bus.emit({
    type: 'log',
    msg: '⚠️ Storage: this browser refuses site data. Saves are kept in memory until the page closes. Export (Menu) writes the save to a file.',
    kind: 'danger',
  });
}

export const ui = $state({
  /** The open screen. The ids are the NAV table's (lib/nav.ts). */
  tab: 'location' as MainTab,
  /**
   * Screen ids the player has opened, kept in localStorage (lib/nav.ts
   * SHELL_KEY), not in the save. An entry visible and not listed here shows
   * "new" in the screen list.
   */
  navSeen: initialSeen(gs),
  /**
   * The player's pick for the log column: true open, false folded, null none
   * (the width decides, lib/shell.ts). Kept in localStorage, not in the save.
   */
  logChoice: readLogChoice(),
  /** The folded log's overlay panel is showing. UI only. */
  logDrawer: false,
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

/** The player opens or folds the log column. Stored, and it beats the width default. */
export function setLogChoice(open: boolean): void {
  ui.logChoice = open;
  ui.logDrawer = false;
  writeLogChoice(open);
}

/** Record that a screen has been opened. */
export function markNavSeen(id: string): void {
  if (ui.navSeen.includes(id)) return;
  ui.navSeen.push(id);
  writeSeen(ui.navSeen);
}

/** Count every screen visible now as opened: an imported save brings screens this browser never showed. */
function markVisibleNavSeen(): void {
  for (const e of visibleNav(gs)) {
    if (!ui.navSeen.includes(e.id)) ui.navSeen.push(e.id);
  }
  writeSeen(ui.navSeen);
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
  const name = `frontier-idle-save-${new Date().toISOString().slice(0, 10)}.json`;
  // The Android app's WebView drops a blob download: share a file instead
  // (lib/nativeExport.ts). The browser path below is unchanged.
  if (sharesFiles()) {
    void shareTextFile(name, serialize(gs)).then((r) => {
      if (!r.ok && !r.dismissed) {
        game.bus.emit({ type: 'log', msg: `❌ Save export failed: ${r.reason}`, kind: 'danger' });
      }
    });
    return;
  }
  const blob = new Blob([serialize(gs)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importSave(file: File): Promise<void> {
  try {
    const loaded = deserialize(await file.text());
    Object.assign(gs, loaded);
    game.resyncAnnouncers();
    forgetLayouts();
    markVisibleNavSeen();
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

/** Wipe the save and start over, after a confirm. False when the player declined. */
export function hardReset(): boolean {
  if (!confirm('Wipe ALL progress and start over?')) return false;
  clearStorage();
  Object.assign(gs, createInitialState(Date.now()));
  game.resyncAnnouncers();
  // The benches' remembered layouts belong to the run that is gone.
  forgetLayouts();
  ui.offline = null;
  ui.defeat = null;
  ui.defeatShown = -1;
  return true;
}

export { isKept, NOTEBOOK_MAX };
