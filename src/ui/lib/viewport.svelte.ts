/**
 * The one width the tower section turns on (docs/NAVIGATION.md §3.5).
 *
 * At this window width or wider the map carries the tower section and its ride
 * button, and the Ascent panel prints terms only. Below it the section is a fold
 * with no button and the Ascent panel keeps its buttons. Either way the page has
 * one set of ride buttons.
 *
 * Kept in a store, not a CSS rule, so both components read the same flag and a
 * test can set it. Where there is no window (server render, tests) it reads wide.
 */
export const SECTION_MIN_WIDTH = 600;

/**
 * The window width below which the shell is the phone layout (docs/PHONE.md):
 * one column, the dock on top, the screen list along the bottom. Wider is the
 * desktop and tablet shell, unchanged. No stylesheet repeats the number: the
 * layouts are classes and branches set from `viewport.phone` (`class:phone` in
 * App.svelte, `class:sheet` in Modal.svelte), so there is one place to change it
 * (tests/phone.test.ts).
 */
export const PHONE_BELOW = 700;

/**
 * A phone held sideways: shorter than `SHORT_BELOW`, and at least `SHORT_MIN_WIDTH`
 * and under `SHORT_MAX_WIDTH` wide. The desktop header and left column leave such
 * a window about 250 px of screen, so it gets the phone shell (`viewport.phone` is
 * true) in its compact form (`viewport.short`: the dock in one row, the log line
 * beside the screen list). Phones in landscape are 360 to 430 px tall and 640 to
 * about 930 px wide. Geometry only, no pointer test: a desktop window that small
 * is better served by the one-column shell too (docs/PHONE.md section 1).
 *
 * The minimum width is what keeps a narrow, short window in the portrait dock: a
 * split screen (about 410 x 420) or a 380 x 450 window is not a phone held
 * sideways, and the two-column dock gave its job block 0 px at 360 to 430 px.
 * Portrait with the soft keyboard up is that window too, so the keyboard does not
 * turn the portrait dock into the compact one.
 */
export const SHORT_BELOW = 500;
export const SHORT_MIN_WIDTH = 640;
export const SHORT_MAX_WIDTH = 960;

/**
 * A text field has focus: the soft keyboard is up or about to be. On Android the
 * app resizes above it (`adjustResize`), so the window's height drops by the
 * keyboard's and a 640 to 959 px window would cross `SHORT_BELOW`.
 */
export function typingInField(active: Element | null): boolean {
  if (!active) return false;
  if (active instanceof HTMLTextAreaElement) return true;
  if (active instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'color', 'image'].includes(active.type);
  }
  return (active as HTMLElement).isContentEditable === true;
}

export const viewport = $state({ wide: true, phone: false, short: false });

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const query = window.matchMedia(`(min-width: ${SECTION_MIN_WIDTH}px)`);
  viewport.wide = query.matches;
  query.addEventListener('change', (ev) => {
    viewport.wide = ev.matches;
  });

  const narrow = window.matchMedia(`(max-width: ${PHONE_BELOW - 1}px)`);
  const short = window.matchMedia(
    `(max-height: ${SHORT_BELOW - 1}px) and (min-width: ${SHORT_MIN_WIDTH}px) and (max-width: ${SHORT_MAX_WIDTH - 1}px)`,
  );
  let lastWidth = window.innerWidth;
  const sync = () => {
    // A height change with a text field focused and the width unchanged is the
    // soft keyboard: the shell stays as it was until the field loses focus.
    const width = window.innerWidth;
    if (typingInField(document.activeElement) && width === lastWidth) return;
    lastWidth = width;
    viewport.short = short.matches;
    viewport.phone = narrow.matches || short.matches;
  };
  sync();
  narrow.addEventListener('change', sync);
  short.addEventListener('change', sync);
  // The keyboard closing: the window grows back, and the focus has left by then.
  document.addEventListener('focusout', () => setTimeout(sync, 0));
}
