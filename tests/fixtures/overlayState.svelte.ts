// Which overlays tests/overlays.dom.test.ts has on screen: the flags App.svelte
// and SystemMenu.svelte keep, as one reactive object for OverlayHarness.svelte.
export const shown = $state({
  menu: false,
  cook: false,
  picker: false,
  drawer: false,
  hold: false,
  offline: null as unknown,
  defeat: null as unknown,
});
