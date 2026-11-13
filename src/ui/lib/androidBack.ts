import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * The Android back button (docs/ANDROID.md). Every window, drawer, menu and
 * picker already closes on Escape, each with its own listener on `window`
 * (lib/Modal.svelte, LogDrawer.svelte, MapCard.svelte, lib/TagPicker.svelte),
 * so one back press sends the same keydown and no overlay state is added here.
 * The newest window closes first (Modal keeps a stack). A window that ignores
 * Escape on purpose (the dare, evolve and prestige windows, which hold play
 * until answered) ignores back too.
 *
 * With nothing open the app goes to the background, as Home does. It never
 * exits: the idle loop would stop, and the time away is caught up on return.
 */

/**
 * Overlays the Escape listeners above close: any `role="dialog"` (windows and
 * the map card), the folded log's drawer, and a tag picker's open list. A new
 * overlay that listens for Escape belongs here too, or back also minimizes
 * while closing it.
 */
const OVERLAY = '[role="dialog"], .log-drawer, .picker [aria-expanded="true"]';

/** One back press. `minimize` runs only when nothing was open to close. */
export function pressBack(doc: Document, win: Window, minimize: () => void): void {
  const open = doc.querySelector(OVERLAY) !== null;
  win.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
  if (!open) minimize();
}

/** Listen for the back button. Does nothing outside the Android app. */
export function installAndroidBack(): void {
  if (!Capacitor.isNativePlatform()) return;
  void App.addListener('backButton', () => pressBack(document, window, () => void App.minimizeApp()));
}
