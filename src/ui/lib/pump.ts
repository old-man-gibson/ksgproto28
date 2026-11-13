import type { OfflineSummary } from '../../core/save/offline';

/**
 * The frame pump: how much game time a call of `pump()` credits, and what it does
 * with a long gap. main.ts wires it to the game; the clocks are parameters so a
 * test can stop one.
 *
 * Two clocks are read on every call. `perf` is the monotonic one
 * (`performance.now()`): it does not jump when the user changes the date, but it
 * stops while the device sleeps (Android suspends the CPU with the screen off,
 * and a WebView whose process stays alive resumes with the same `performance.now()`
 * it left). `wall` is `Date.now()`: it keeps counting through sleep. The gap
 * credited is the monotonic one, except when the wall clock gained more than
 * `SUSPEND_SLACK_MS` on it: that surplus is sleep, and the wall gap is credited
 * instead, as a long gap, which takes the same catch-up path the boot does and
 * shows its report. A wall clock that went backwards, or a few ms of drift,
 * leaves the monotonic gap.
 *
 * Nothing is counted twice: every call reads both clocks and moves both marks to
 * now, so a gap is credited by exactly one call. `settle()` is `pump()` for the
 * moments the app comes back (Android's `resume`, the page turning visible): the
 * credit appears then, not at the next frame. The wall mark is the pump's own,
 * never earlier than `gs.lastSaved` (the pause and hidden saves write it when the
 * pumping stops), so a gap is never taken from before time already credited.
 *
 * A paused world drops the gap (it is never cashed in), still moving the marks.
 * Nothing runs until `start()`, which the boot calls after its own catch-up.
 */
export const GAP_THRESHOLD_MS = 10_000;
/** Wall-clock time beyond the monotonic clock's that counts as sleep. */
export const SUSPEND_SLACK_MS = 5_000;
export const AUTOSAVE_MS = 30_000;

export interface PumpDeps {
  perf: () => number;
  wall: () => number;
  paused: () => boolean;
  /** An ordinary gap: run its ticks live. */
  advance: (elapsedMs: number) => void;
  /** A long gap: the detached catch-up (state.svelte.ts `catchUp`). Its report, if it makes one. */
  catchUp: (elapsedMs: number) => OfflineSummary | null;
  /** Show a catch-up report. */
  report: (summary: OfflineSummary) => void;
  save: () => void;
}

export interface Pump {
  /** Credit what has passed since the last call. */
  pump: () => void;
  /** The app is back (resume, visible): the same credit, now. */
  settle: () => void;
  /** Begin pumping from now. Before this, `pump` and `settle` do nothing. */
  start: () => void;
  /** The save was written elsewhere (a trigger): the autosave clock restarts. */
  saved: () => void;
}

export function createPump(deps: PumpDeps): Pump {
  let started = false;
  let perfAt = deps.perf();
  let wallAt = deps.wall();
  let lastSave = perfAt;

  /** The gap since the last call, in ms, and both marks moved to now. */
  function lap(): number {
    const perf = deps.perf();
    const wall = deps.wall();
    const dPerf = perf - perfAt;
    const dWall = wall - wallAt;
    perfAt = perf;
    wallAt = wall;
    return dWall - dPerf > SUSPEND_SLACK_MS ? dWall : dPerf;
  }

  function autosave() {
    const now = deps.perf();
    if (now - lastSave > AUTOSAVE_MS) {
      deps.save();
      lastSave = now;
    }
  }

  function pump() {
    if (!started) return;
    const elapsed = lap();

    // Paused: the elapsed time is DROPPED, never accumulated, so no amount of
    // staring at a fight turns into progress. The autosave keeps running, which
    // is what stops a long pause from being cashed in as offline time later:
    // `lastSaved` must not sit still while the player watches.
    if (deps.paused()) {
      autosave();
      return;
    }

    if (elapsed > GAP_THRESHOLD_MS) {
      // A long stall (device sleep, a throttled background tab): the capped
      // catch-up and its report, off the reactive proxy.
      const summary = deps.catchUp(elapsed);
      if (summary) deps.report(summary);
    } else {
      deps.advance(elapsed);
    }
    autosave();
  }

  return {
    pump,
    settle: pump,
    start() {
      // The marks start AFTER the boot catch-up, or its own duration would read
      // as a stall on the first frame and be caught up a second time.
      perfAt = deps.perf();
      wallAt = deps.wall();
      lastSave = perfAt;
      started = true;
    },
    saved() {
      lastSave = deps.perf();
    },
  };
}
