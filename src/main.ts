import { mount } from 'svelte';
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/500.css';
import '@fontsource/eb-garamond/400.css';
import '@fontsource/eb-garamond/400-italic.css';
import '@fontsource/eb-garamond/600.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-400-italic.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import '@fontsource/barlow-semi-condensed/latin-400.css';
import '@fontsource/barlow-semi-condensed/latin-400-italic.css';
import '@fontsource/barlow-semi-condensed/latin-600.css';
import '@fontsource/barlow-semi-condensed/latin-700.css';
import '@fontsource/libre-caslon-text/latin-400.css';
import '@fontsource/libre-caslon-text/latin-400-italic.css';
import '@fontsource/libre-caslon-text/latin-700.css';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/b612/latin-400.css';
import '@fontsource/b612/latin-700.css';
import '@fontsource/bitter/latin-400.css';
import '@fontsource/bitter/latin-600.css';
import '@fontsource/bitter/latin-700.css';
import '@fontsource/alfa-slab-one/latin-400.css';
import '@fontsource/spectral/latin-400.css';
import '@fontsource/spectral/latin-400-italic.css';
import '@fontsource/spectral/latin-600.css';
import '@fontsource/shippori-mincho/latin-700.css';
import '@fontsource/ibm-plex-sans-condensed/latin-600.css';
import '@fontsource/alegreya-sans/latin-400.css';
import '@fontsource/alegreya-sans/latin-400-italic.css';
import '@fontsource/alegreya-sans/latin-700.css';
import '@fontsource/marcellus/latin-400.css';
import './app.css';
import './themes/cues.css';
import './themes/gothic.css';
import './themes/registry.css';
import './themes/enamel.css';
import './themes/quayside.css';
import './themes/signage.css';
import './themes/cockpit.css';
import './themes/linocut.css';
import './themes/castle.css';
import './themes/survey.css';
import './themes/sandstone.css';
import App from './ui/App.svelte';
import { installAndroidBack } from './ui/lib/androidBack';
import { installSaveTriggers } from './ui/lib/saveTriggers';
import { applyTheme, loadTheme } from './ui/lib/theme';
import { boot, catchUp, game, save, timeAway, ui } from './ui/state.svelte';
import { TickAccumulator } from './core/engine/loop';
import { createPump } from './ui/lib/pump';
import { OFFLINE_MIN_MS } from './core/save/offline';

const acc = new TickAccumulator();

/**
 * Advance the simulation by however much time has passed. Driven by
 * requestAnimationFrame while visible (smooth) and by setInterval while the
 * tab is hidden (rAF stops firing there — fatal for an idle game). A long stall
 * (laptop sleep, a throttled background tab, a phone asleep with the app alive)
 * is handled like offline time: big gaps get a capped silent catch-up + summary
 * modal (lib/pump.ts says how the gap is measured and why nothing counts twice).
 */
const frames = createPump({
  perf: () => performance.now(),
  wall: () => Date.now(),
  paused: () => game.state.paused,
  advance: (elapsedMs) => {
    const ticks = acc.advance(elapsedMs);
    for (let i = 0; i < ticks; i++) game.tick();
  },
  // Detached catch-up (see state.svelte.ts): big gaps get the capped silent
  // run + summary modal, 10-60s gaps run their ticks quietly — both off the
  // reactive proxy, so a long stall never freezes the frame it returns on.
  catchUp,
  report: (summary) => {
    ui.offline = summary;
  },
  save,
});

function frame() {
  frames.pump();
  requestAnimationFrame(frame);
}

/** Start the clock. Nothing ticks until the boot catch-up has finished. */
function startPump() {
  frames.start();
  requestAnimationFrame(frame);
  setInterval(frames.pump, 1000);
}

// Saves on the events that may be a page's last (lib/saveTriggers.ts), and
// before the Android back button minimizes the app. Not before the boot
// catch-up has run: a save then would erase the time away it is about to credit.
const saveNow = installSaveTriggers({
  save,
  blocked: () => ui.catchingUp !== null,
  saved: () => frames.saved(),
  // The page turns visible again: credit what passed while it was away now.
  visible: () => frames.settle(),
});

// Mount FIRST, catch up SECOND. The boot catch-up is synchronous and, on a
// mature save, can block for minutes — running it before mount left the tab
// blank with a spinner for the whole wait (and a throw meant no app at all).
// Now the app paints with a "catching up" overlay, then the catch-up runs.
// rAF → setTimeout guarantees a real paint in between: the rAF callback runs
// before the frame is painted, the timeout fires after it.
const away = timeAway();
if (away >= OFFLINE_MIN_MS && !game.state.paused) ui.catchingUp = away;
// Before mount, so the first paint is already in the player's theme: the stored
// pick, else Gothic. Applying stores nothing (ui/lib/theme.ts).
applyTheme(loadTheme());
mount(App, { target: document.getElementById('app')! });
// The Android app's back button (closes the topmost window or drawer, else saves
// and minimizes), its pause event (saves) and its resume event (credits the time
// the app was away). No-op outside the Android app.
installAndroidBack({ blocked: () => ui.catchingUp !== null, save: saveNow, resume: () => frames.settle() });
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
