import type { OfflineSummary } from '../../core/save/offline';

/**
 * The frame pump: how much game time a call of `pump()` credits, and what it does
 * with a long gap. lib/runtime.ts wires it to the game; the clocks are parameters
 * so a test can stop one.
 *
 * Two clocks are read on every call. `perf` is the monotonic one
 * (`performance.now()`): it does not jump when the user changes the date, but it
 * stops while the device sleeps (Android suspends the CPU with the screen off,
 * and a WebView whose process stays alive resumes with the same `performance.now()`
 * it left). `wall` is `Date.now()`: it keeps counting through sleep. When the wall
 * clock gained more than `SUSPEND_SLACK_MS` on the monotonic one, that surplus is
 * sleep. A wall clock that went backwards, or a few ms of drift, is not.
 *
 * **One absence, one credit.**
 *
 * - *Page visible.* The gap since the last call is credited whole: the monotonic
 *   gap plus any sleep. A gap with sleep in it goes through the catch-up whatever
 *   its size (`deps.catchUp`: the same capped, detached run the boot makes, with
 *   its report; a gap under a minute runs quietly): the per-frame tick valve
 *   (30 ticks) would drop most of 5 to 10 s. From `OVERLAY_FROM_MS` the "Catching
 *   up" overlay is shown first and a frame is painted before the run, as the boot
 *   does, since the run blocks the thread for seconds to minutes. An ordinary
 *   monotonic gap over `GAP_THRESHOLD_MS` (a throttled tab, a stalled frame) is the
 *   same catch-up.
 * - *Page hidden.* The sleep is not credited: it is carried. The cap (8 h) and the
 *   report are per catch-up, and Android wakes a sleeping WebView for short
 *   windows in which a 1 s interval fires; crediting each window as it came gave
 *   three 7 h pieces 21 h instead of the 8 h one gap gets, and a report of the last
 *   piece. What the monotonic clock saw is credited as usual. `settle()` (Android's
 *   `resume`, the page turning visible) cashes everything carried plus the gap since
 *   the last call as one absence: capped once, reported once.
 * - Carried sleep also stops the autosave: a save writes `gs.lastSaved`, and a
 *   process that ends before the credit would then lose that time at the next boot,
 *   which reads `lastSaved`. The hidden-page save before the sleep left it where
 *   the boot credits it from.
 *
 * Nothing is counted twice: a call reads both clocks and moves both marks to now,
 * and a catch-up moves them again when it returns, so a gap is credited by one call
 * and the catch-up's own duration is never a second gap. While a catch-up waits for
 * its overlay to paint, calls do nothing (`busy`): their time is in the gap the
 * catch-up is about to run.
 *
 * A paused world drops the gap and what was carried (it is never cashed in), still
 * moving the marks. Nothing runs until `start()`, which the boot calls after its own
 * catch-up.
 */
export const GAP_THRESHOLD_MS = 10_000;
/** Wall-clock time beyond the monotonic clock's that counts as sleep. */
export const SUSPEND_SLACK_MS = 5_000;
export const AUTOSAVE_MS = 30_000;
/** A catch-up this long shows the overlay first. The same minute `OFFLINE_MIN_MS` (save/offline.ts) reports from. */
export const OVERLAY_FROM_MS = 60_000;

export interface PumpDeps {
  perf: () => number;
  wall: () => number;
  paused: () => boolean;
  /** The page is hidden: sleep is carried, not credited. */
  hidden: () => boolean;
  /** An ordinary gap: run its ticks live. */
  advance: (elapsedMs: number) => void;
  /** A long gap: the detached catch-up (state.svelte.ts `catchUp`). Its report, if it makes one. */
  catchUp: (elapsedMs: number) => OfflineSummary | null;
  /** Show a catch-up report. */
  report: (summary: OfflineSummary) => void;
  save: () => void;
  /** Show the "Catching up" overlay for an absence of this length; null takes it down. */
  announce?: (awayMs: number | null) => void;
  /** Resolves once the overlay has been painted. */
  nextPaint?: () => Promise<void>;
}

export interface Pump {
  /** Credit what has passed since the last call. */
  pump: () => void;
  /** The app is back (resume, visible): cash the whole absence now, as one. */
  settle: () => void;
  /** Begin pumping from now. Before this, `pump` and `settle` do nothing. */
  start: () => void;
  /** The save was written elsewhere (a trigger): the autosave clock restarts. */
  saved: () => void;
  /** Sleep carried while hidden, ms, not yet credited. */
  carried: () => number;
}

export function createPump(deps: PumpDeps): Pump {
  let started = false;
  let busy = false;
  let perfAt = deps.perf();
  let wallAt = deps.wall();
  let lastSave = perfAt;
  let carried = 0;

  function mark() {
    perfAt = deps.perf();
    wallAt = deps.wall();
  }

  /** The gap since the last call, split in the monotonic gap and the sleep over it; both marks moved to now. */
  function lap(): { mono: number; sleep: number } {
    const perf = deps.perf();
    const wall = deps.wall();
    const mono = perf - perfAt;
    const gained = wall - wallAt - mono;
    perfAt = perf;
    wallAt = wall;
    return { mono, sleep: gained > SUSPEND_SLACK_MS ? gained : 0 };
  }

  function autosave() {
    // See the header: not while sleep is carried.
    if (carried > 0) return;
    const now = deps.perf();
    if (now - lastSave > AUTOSAVE_MS) {
      deps.save();
      lastSave = now;
    }
  }

  /** The catch-up and its report, then both marks to now: its own duration is not a gap. */
  function catchUpAndReport(gap: number) {
    const summary = deps.catchUp(gap);
    if (summary) deps.report(summary);
    mark();
  }

  /** An absence with sleep in it, credited whole. */
  function cash(gap: number) {
    if (gap < OVERLAY_FROM_MS || !deps.announce || !deps.nextPaint) {
      catchUpAndReport(gap);
      autosave();
      return;
    }
    // The run blocks the thread: say so, let the overlay paint, then run.
    const announce = deps.announce;
    const nextPaint = deps.nextPaint;
    busy = true;
    announce(gap);
    void nextPaint()
      .then(() => catchUpAndReport(gap))
      .catch((err) => console.error(err))
      .finally(() => {
        announce(null);
        busy = false;
        autosave();
      });
  }

  function run(visible: boolean) {
    if (!started || busy) return;
    const { mono, sleep } = lap();

    // Paused: the elapsed time is DROPPED, never accumulated, so no amount of
    // staring at a fight turns into progress. The autosave keeps running, which
    // is what stops a long pause from being cashed in as offline time later:
    // `lastSaved` must not sit still while the player watches.
    if (deps.paused()) {
      carried = 0;
      autosave();
      return;
    }

    if (!visible) {
      carried += sleep;
      ordinary(mono);
      autosave();
      return;
    }

    const owed = carried + sleep;
    carried = 0;
    if (owed > 0) {
      cash(mono + owed);
      return;
    }
    ordinary(mono);
    autosave();
  }

  /** A gap the monotonic clock saw: ticks, or the catch-up when it is a stall. */
  function ordinary(gap: number) {
    if (gap > GAP_THRESHOLD_MS) catchUpAndReport(gap);
    else deps.advance(gap);
  }

  return {
    pump: () => run(!deps.hidden()),
    settle: () => run(true),
    start() {
      // The marks start AFTER the boot catch-up, or its own duration would read
      // as a stall on the first frame and be caught up a second time.
      mark();
      lastSave = perfAt;
      carried = 0;
      started = true;
    },
    saved() {
      lastSave = deps.perf();
    },
    carried: () => carried,
  };
}
