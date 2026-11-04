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

export const viewport = $state({ wide: true });

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const query = window.matchMedia(`(min-width: ${SECTION_MIN_WIDTH}px)`);
  viewport.wide = query.matches;
  query.addEventListener('change', (ev) => {
    viewport.wide = ev.matches;
  });
}
