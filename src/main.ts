import { mount } from 'svelte';
import './app.css';
import App from './ui/App.svelte';
import { boot, catchUp, game, save, timeAway, ui } from './ui/state.svelte';
import { TickAccumulator } from './core/engine/loop';
import { OFFLINE_MIN_MS } from './core/save/offline';

const acc = new TickAccumulator();
let last = performance.now();
let lastSave = performance.now();

// A long stall (laptop sleep, heavily-throttled background tab) is handled
// like offline time: big gaps get a capped silent catch-up + summary modal.
const GAP_THRESHOLD_MS = 10_000;

/**
 * Advance the simulation by however much wall-clock time has passed. Driven by
 * requestAnimationFrame while visible (smooth) and by setInterval while the
 * tab is hidden (rAF stops firing there — fatal for an idle game).
 */
function pump() {
  const now = performance.now();
  const elapsed = now - last;
  last = now;

  // Paused: the elapsed time is DROPPED, never accumulated, so no amount of
  // staring at a fight turns into progress. The autosave keeps running, which
  // is what stops a long pause from being cashed in as offline time later —
  // `lastSaved` must not sit still while the player watches.
  if (game.state.paused) {
    if (now - lastSave > 30_000) {
      save();
      lastSave = now;
    }
    return;
  }

  if (elapsed > GAP_THRESHOLD_MS) {
    // Detached catch-up (see state.svelte.ts): big gaps get the capped silent
    // run + summary modal, 10-60s gaps run their ticks quietly — both off the
    // reactive proxy, so a long stall never freezes the frame it returns on.
    const summary = catchUp(elapsed);
    if (summary) ui.offline = summary;
  } else {
    const ticks = acc.advance(elapsed);
    for (let i = 0; i < ticks; i++) game.tick();
  }

  if (now - lastSave > 30_000) {
    save();
    lastSave = now;
  }
}

function frame() {
  pump();
  requestAnimationFrame(frame);
}

/** Start the clock. Nothing ticks until the boot catch-up has finished. */
function startPump() {
  // Reset the reference point AFTER the catch-up, or its own duration would
  // read as a stall on the first frame and be caught up a second time.
  last = performance.now();
  lastSave = last;
  requestAnimationFrame(frame);
  setInterval(pump, 1000);
}

window.addEventListener('beforeunload', () => save());

// Mount FIRST, catch up SECOND. The boot catch-up is synchronous and, on a
// mature save, can block for minutes — running it before mount left the tab
// blank with a spinner for the whole wait (and a throw meant no app at all).
// Now the app paints with a "catching up" overlay, then the catch-up runs.
// rAF → setTimeout guarantees a real paint in between: the rAF callback runs
// before the frame is painted, the timeout fires after it.
const away = timeAway();
if (away >= OFFLINE_MIN_MS && !game.state.paused) ui.catchingUp = away;
mount(App, { target: document.getElementById('app')! });
if (ui.catchingUp !== null) {
  requestAnimationFrame(() =>
    setTimeout(() => {
      boot();
      startPump();
    }, 0),
  );
} else {
  boot();
  startPump();
}
