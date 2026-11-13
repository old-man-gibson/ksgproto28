import { TickAccumulator } from '../../core/engine/loop';
import type { OfflineSummary } from '../../core/save/offline';
import { installAndroidBack } from './androidBack';
import { createPump, type Pump } from './pump';
import { installSaveTriggers } from './saveTriggers';

/**
 * What main.ts starts once the app has mounted: the frame pump and the events that
 * feed it and the save. A function of its dependencies so a test can run the same
 * wiring on fake clocks and a fake frame loop (tests/runtime.test.ts).
 *
 * - The pump starts after the boot catch-up (`boot()`), never before: its marks
 *   would read the catch-up's own duration as a stall (lib/pump.ts).
 * - Saves on the events that may be a page's last (lib/saveTriggers.ts), and before
 *   the Android back button minimizes. Not before the boot catch-up has run, nor
 *   while a catch-up shows its overlay (`ui.catchingUp`): a save then would erase
 *   the time away it is about to credit.
 * - The page turning visible and the Android app's `resume` both `settle()` the
 *   pump: the absence is credited and reported then, as one.
 *
 * `ui.catchingUp` is set by the caller before the first paint when the boot has a
 * catch-up to run (the overlay is then in the first frame); the boot is deferred
 * one painted frame in that case, as before.
 */
export interface RuntimeDeps {
  game: { state: { paused: boolean }; tick: () => void };
  ui: { catchingUp: number | null; offline: OfflineSummary | null };
  /** The boot catch-up (state.svelte.ts). Clears `ui.catchingUp`. */
  boot: () => void;
  /** The detached catch-up for a long gap (state.svelte.ts). */
  catchUp: (elapsedMs: number) => OfflineSummary | null;
  save: () => void;
  // The environment. Defaults are the browser's.
  perf?: () => number;
  wall?: () => number;
  hidden?: () => boolean;
  /** `requestAnimationFrame`. */
  frame?: (callback: () => void) => void;
  /** `setTimeout(callback, 0)`. */
  later?: (callback: () => void) => void;
  /** `setInterval(callback, ms)`. */
  every?: (callback: () => void, ms: number) => void;
}

export interface Runtime {
  pump: Pump;
  /** Writes the save now (nothing while a catch-up is pending). */
  saveNow: () => void;
}

export function startRuntime(deps: RuntimeDeps): Runtime {
  const { game, ui } = deps;
  const frame = deps.frame ?? ((cb) => void requestAnimationFrame(cb));
  const later = deps.later ?? ((cb) => void setTimeout(cb, 0));
  const every = deps.every ?? ((cb, ms) => void setInterval(cb, ms));
  const acc = new TickAccumulator();

  const pump = createPump({
    perf: deps.perf ?? (() => performance.now()),
    wall: deps.wall ?? (() => Date.now()),
    paused: () => game.state.paused,
    hidden: deps.hidden ?? (() => document.visibilityState === 'hidden'),
    advance: (elapsedMs) => {
      const ticks = acc.advance(elapsedMs);
      for (let i = 0; i < ticks; i++) game.tick();
    },
    // Detached catch-up (see state.svelte.ts): big gaps get the capped silent
    // run + summary modal, 10-60s gaps run their ticks quietly — both off the
    // reactive proxy, so a long stall never freezes the frame it returns on.
    catchUp: deps.catchUp,
    report: (summary) => {
      ui.offline = summary;
    },
    save: deps.save,
    // A long absence cashed on return: the overlay first, a painted frame, then the run.
    announce: (awayMs) => {
      ui.catchingUp = awayMs;
    },
    nextPaint: () => new Promise<void>((resolve) => frame(() => later(resolve))),
  });

  const saveNow = installSaveTriggers({
    save: deps.save,
    blocked: () => ui.catchingUp !== null,
    saved: () => pump.saved(),
    visible: () => pump.settle(),
  });
  installAndroidBack({ blocked: () => ui.catchingUp !== null, save: saveNow, resume: () => pump.settle() });

  /**
   * Advance the simulation by however much time has passed. Driven by
   * requestAnimationFrame while visible (smooth) and by setInterval while the
   * tab is hidden (rAF stops firing there — fatal for an idle game).
   */
  function loop() {
    pump.pump();
    frame(loop);
  }

  function begin() {
    deps.boot();
    pump.start();
    frame(loop);
    every(pump.pump, 1000);
  }

  // Mount FIRST, catch up SECOND. The boot catch-up is synchronous and, on a
  // mature save, can block for minutes — running it before mount left the tab
  // blank with a spinner for the whole wait (and a throw meant no app at all).
  // The app has painted its "catching up" overlay; rAF → setTimeout guarantees a
  // real paint in between: the rAF callback runs before the frame is painted, the
  // timeout fires after it.
  if (ui.catchingUp !== null) frame(() => later(begin));
  else begin();

  return { pump, saveNow };
}
