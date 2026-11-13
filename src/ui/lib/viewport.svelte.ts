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

export const viewport = $state({ wide: true, phone: false });

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const query = window.matchMedia(`(min-width: ${SECTION_MIN_WIDTH}px)`);
  viewport.wide = query.matches;
  query.addEventListener('change', (ev) => {
    viewport.wide = ev.matches;
  });

  const phone = window.matchMedia(`(max-width: ${PHONE_BELOW - 1}px)`);
  viewport.phone = phone.matches;
  phone.addEventListener('change', (ev) => {
    viewport.phone = ev.matches;
  });
}
