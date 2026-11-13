import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { closeTopOverlay } from './overlays';

/**
 * The Android app's hardware back button and its app lifecycle (docs/ANDROID.md).
 *
 * Back closes exactly one overlay, the topmost (lib/overlays.ts: the same stack
 * Escape reads). With nothing open it writes the save and moves the app to the
 * background, as Home does. It never exits: the idle loop would stop. A window
 * that holds play until answered takes the press and does nothing.
 *
 * `blocked` is true while the boot catch-up has not run (ui.catchingUp): back
 * is ignored then, and nothing is saved, since a save there would overwrite
 * `lastSaved` and lose the time away that catch-up is about to credit.
 *
 * Android may kill a backgrounded app without a word, so the `pause` event also
 * writes the save. The `resume` event credits the time the app was away
 * (lib/pump.ts `settle`): a device asleep with the app alive stops the clock the
 * frame pump reads, and only the wall clock knows how long it slept.
 */
export interface BackHooks {
  /** True while a back press must do nothing at all. */
  blocked: () => boolean;
  /** Write the save now. Called before the app is minimized and on `pause`. */
  save: () => void;
  /** Move the app to the background. */
  minimize: () => void;
}

/** One back press. */
export function pressBack(hooks: BackHooks): void {
  if (hooks.blocked()) return;
  if (closeTopOverlay()) return;
  hooks.save();
  hooks.minimize();
}

/** Listen for the back button and `pause`. Does nothing outside the Android app. */
export function installAndroidBack(hooks: Pick<BackHooks, 'blocked' | 'save'> & { resume?: () => void }): void {
  if (!Capacitor.isNativePlatform()) return;
  const minimize = () => void App.minimizeApp();
  void App.addListener('backButton', () => pressBack({ ...hooks, minimize }));
  void App.addListener('pause', () => {
    if (!hooks.blocked()) hooks.save();
  });
  void App.addListener('resume', () => hooks.resume?.());
}
