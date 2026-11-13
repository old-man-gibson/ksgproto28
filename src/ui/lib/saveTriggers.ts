/**
 * The events that may be the last a page gets, each of which writes the save:
 * `beforeunload` and `pagehide` (the page going), and `visibilitychange` to
 * hidden (a tab switch; on a phone the app leaving the screen, after which
 * Android may end it without a word). The Android back button and the App
 * plugin's `pause` event call the returned function too (lib/androidBack.ts).
 *
 * The write is `save()`, the autosave's own call: one serialize of the live
 * state, a few ms, on the one thread the autosave runs on, so the two cannot
 * interleave. `saved` runs after each write so the autosave clock restarts from
 * it. `blocked` is true before the boot catch-up has run (`ui.catchingUp`): the
 * state is still the saved one, and a write then would reset `lastSaved` and
 * lose the time away that catch-up is about to credit.
 *
 * `visible` runs when the page turns visible again, which is when the time it was
 * hidden for is credited (lib/pump.ts `settle`).
 */
export interface SaveTriggers {
  save: () => void;
  blocked: () => boolean;
  saved: () => void;
  visible?: () => void;
}

/** Listen for the events above. Returns the function that writes the save now (nothing while blocked). */
export function installSaveTriggers({ save, blocked, saved, visible }: SaveTriggers): () => void {
  const saveNow = () => {
    if (blocked()) return;
    save();
    saved();
  };
  window.addEventListener('beforeunload', saveNow);
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
    else visible?.();
  });
  return saveNow;
}
