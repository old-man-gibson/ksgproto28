// Which overlays tests/overlays.dom.test.ts and tests/pickOverlays.dom.test.ts
// have on screen: the flags App.svelte and SystemMenu.svelte keep, as one
// reactive object for OverlayHarness.svelte and PickHarness.svelte.
export const shown = $state({
  menu: false,
  cook: false,
  picker: false,
  drawer: false,
  hold: false,
  bench: false,
  page: false,
  offline: null as unknown,
  defeat: null as unknown,
});
