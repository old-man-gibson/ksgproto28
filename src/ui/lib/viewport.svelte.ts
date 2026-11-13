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
 * A phone held sideways: shorter than `SHORT_BELOW` and narrower than
 * `SHORT_MAX_WIDTH`. The desktop header and left column leave such a window
 * about 250 px of screen, so it gets the phone shell (`viewport.phone` is true)
 * in its compact form (`viewport.short`: the dock in one row, the log line
 * beside the screen list). Phones in landscape are 360 to 430 px tall and up to
 * about 930 px wide. Geometry only, no pointer test: a desktop window that small
 * is better served by the one-column shell too (docs/PHONE.md section 1).
 */
export const SHORT_BELOW = 500;
export const SHORT_MAX_WIDTH = 960;

export const viewport = $state({ wide: true, phone: false, short: false });

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const query = window.matchMedia(`(min-width: ${SECTION_MIN_WIDTH}px)`);
  viewport.wide = query.matches;
  query.addEventListener('change', (ev) => {
    viewport.wide = ev.matches;
  });

  const narrow = window.matchMedia(`(max-width: ${PHONE_BELOW - 1}px)`);
  const short = window.matchMedia(`(max-height: ${SHORT_BELOW - 1}px) and (max-width: ${SHORT_MAX_WIDTH - 1}px)`);
  const sync = () => {
    viewport.short = short.matches;
    viewport.phone = narrow.matches || short.matches;
  };
  sync();
  narrow.addEventListener('change', sync);
  short.addEventListener('change', sync);
}
