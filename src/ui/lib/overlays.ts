/**
 * The open windows, drawers, cards and pickers, bottom to top, so that Escape
 * and the Android back button close exactly one thing: the topmost
 * (docs/ANDROID.md "Closing overlays"). Every overlay joins while it is open
 * and leaves when it closes; nothing else reads the DOM to find out what is open.
 *
 * Order is the LAYER an overlay is drawn on (its CSS z-index), then arrival: of
 * two on the same layer the later one is on top. So the stack top is what is on
 * top of the screen. `tests/overlayLayers.test.ts` holds each component's CSS
 * z-index to its LAYER.
 *
 * To join (the pattern in lib/Modal.svelte, lib/TagPicker.svelte):
 *
 *   onMount(() => pushOverlay(LAYER.window, () => onclose()));    // a window: join for its life
 *   $effect(() => { if (open) return pushOverlay(LAYER.drawer, () => (open = false)); });   // a popup: join while open
 *
 * A picker or a pick mode inside a panel (a slot picker, a picked-up row) joins
 * on the layer of whatever it is drawn in, which only the host knows: a Modal
 * provides LAYER.window to everything inside it, and `hostLayer(LAYER.page)` reads
 * it, so one panel closes before its window in a Modal and joins at the page
 * layer in the screen body. Read it once, at component init, never in an effect.
 * The effect depends on a boolean, so swapping one pick for another does not
 * rejoin (a rejoin would move the entry above a window opened since).
 *
 *   const layer = hostLayer(LAYER.page);
 *   const picking = $derived(pickedId !== null);
 *   $effect(() => { if (picking) return pushOverlay(layer, () => (pickedId = null)); });
 *
 * `pushOverlay` returns the function that leaves. A component whose `close`
 * does not unmount it (or clear what shows it) leaves its entry on the stack
 * and blocks everything under it: `close` must make the overlay go away. Pass
 * `null` for a window that holds play until it is answered: Escape and back
 * then do nothing while it is on top, and close nothing under it.
 */

import { getContext, setContext } from 'svelte';

export const LAYER = {
  /** A pick mode or picker drawn in the screen body (the rotation pick, a socket picker): in the page flow, below every window, drawer and card. */
  page: 1,
  /** The log drawer, the map card, a tag picker's list. Not windows: play goes on behind them. */
  drawer: 9,
  /** The welcome-back report. */
  report: 10,
  /** Modal windows and the fight summary. */
  window: 20,
  /** Windows that hold play until answered (the dare, the evolution pick, the prestige spend). */
  hold: 30,
  /** A touch tip card, over everything. */
  tip: 100,
} as const;

interface Entry {
  layer: number;
  /** Null: the overlay ignores Escape and back, and shields what is under it. */
  close: (() => void) | null;
}

const stack: Entry[] = [];
let keyed = false;

function onKeydown(ev: KeyboardEvent): void {
  if (ev.key === 'Escape') closeTopOverlay();
}

/**
 * Escape is read once, here, for every overlay. The listener goes on the first
 * time anything joins, so a page with no overlay has no key handler, and a test
 * that mounts one gets it with no setup.
 */
function listenForEscape(): void {
  if (keyed || typeof window === 'undefined') return;
  keyed = true;
  window.addEventListener('keydown', onKeydown);
}

// A hot reload makes a second copy of this module; the old copy's listener goes
// with it, or one Escape would close two overlays in dev.
import.meta.hot?.dispose(() => {
  if (keyed) window.removeEventListener('keydown', onKeydown);
});

const HOST = Symbol('overlay host layer');

/** For a window component, at its init: pickers drawn inside it join on `layer` (see the top of this file). */
export function provideHostLayer(layer: number): void {
  setContext(HOST, layer);
}

/** For a picker's component, at its init: the layer of the window it is drawn in, or `fallback` outside one. */
export function hostLayer(fallback: number): number {
  return getContext<number | undefined>(HOST) ?? fallback;
}

/** Join the stack. Returns the function that leaves it, safe to call twice. */
export function pushOverlay(layer: number, close: (() => void) | null): () => void {
  listenForEscape();
  const entry: Entry = { layer, close };
  let at = stack.length;
  while (at > 0 && stack[at - 1].layer > layer) at--;
  stack.splice(at, 0, entry);
  return () => {
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
  };
}

/**
 * Close the topmost overlay, one press. True when there was one, including a
 * window that holds play (which does nothing): the press was spent on it, so
 * the Android back button must not also minimize the app.
 */
export function closeTopOverlay(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.close?.();
  return true;
}

/** A window (not a drawer, card or tip) is open: the log drawer then ignores presses outside it. */
export function windowOpen(): boolean {
  return stack.some((e) => e.layer >= LAYER.report && e.layer < LAYER.tip);
}

/** How many overlays are open. For tests. */
export function overlayCount(): number {
  return stack.length;
}
