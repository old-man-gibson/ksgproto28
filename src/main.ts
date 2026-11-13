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
import { startRuntime } from './ui/lib/runtime';
import { applyTheme, loadTheme } from './ui/lib/theme';
import { boot, catchUp, game, save, timeAway, ui } from './ui/state.svelte';
import { OFFLINE_MIN_MS } from './core/save/offline';

// The boot's catch-up, if there is one, is announced before the first paint: the
// overlay is in the first frame, and the catch-up itself runs after it
// (lib/runtime.ts). A paused world owes none.
const away = timeAway();
if (away >= OFFLINE_MIN_MS && !game.state.paused) ui.catchingUp = away;
// Before mount, so the first paint is already in the player's theme: the stored
// pick, else Gothic. Applying stores nothing (ui/lib/theme.ts).
applyTheme(loadTheme());
mount(App, { target: document.getElementById('app')! });
// The frame pump, the save triggers, the Android back button, pause and resume
// (lib/runtime.ts). The Android listeners are a no-op outside the Android app.
startRuntime({ game, ui, boot, catchUp, save });
