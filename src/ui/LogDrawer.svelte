<script lang="ts">
  import LogFeed from './LogFeed.svelte';
  import { viewport } from './lib/viewport.svelte';

  /**
   * The folded log's full view: a panel from the right edge, below the header,
   * over the main column. Not a modal: the game keeps running and keys keep
   * working. Escape, the Log button (LogTicker.svelte) or a click outside
   * closes it. `ondock` puts the log back in its column for good.
   *
   * Its z-index stays under the windows (Modal 20, offline report 10; the map
   * card, 9, is its equal and the drawer comes later in the page).
   *
   * `anchor` is the header. The panel starts 12px below the header's live
   * bottom edge, or 12px from the top of the window once the page has scrolled
   * the header away (the narrow layout scrolls the page).
   *
   * On the phone layout (docs/PHONE.md) it is a sheet between the dock and the
   * bottom bar, across the width, and has no Dock button: the log has no column
   * to return to.
   */
  let {
    onclose,
    ondock,
    anchor,
  }: { onclose: () => void; ondock?: () => void; anchor?: HTMLElement } = $props();

  let drawer: HTMLElement;
  let top = $state(12);

  function place() {
    top = Math.max(12, Math.round((anchor?.getBoundingClientRect().bottom ?? 0) + 12));
  }

  $effect(place);

  /**
   * A window is up: a Modal, or the defeat, offline, prestige, dare or evolve
   * window. It owns Escape and the presses around it. The map card carries
   * role="dialog" too but only hovers, so it does not count.
   */
  function windowUp(): boolean {
    return document.querySelector('[role="dialog"]:not(.map-card)') !== null;
  }

  function onKeydown(ev: KeyboardEvent) {
    if (ev.key !== 'Escape' || windowUp()) return;
    onclose();
  }

  function onPointerDown(ev: PointerEvent) {
    const target = ev.target as Element | null;
    if (!target || drawer.contains(target)) return;
    // The Log button toggles the drawer itself.
    if (target.closest('[data-log-toggle]')) return;
    if (windowUp()) return;
    onclose();
  }
</script>

<svelte:window onkeydown={onKeydown} onpointerdown={onPointerDown} onscroll={place} onresize={place} />

<aside
  class="log-drawer"
  class:log-sheet={viewport.phone}
  bind:this={drawer}
  aria-label="Log"
  style={viewport.phone ? undefined : `top: ${top}px`}
>
  <LogFeed
    actions={[
      ...(ondock && !viewport.phone
        ? [{ label: 'Dock', title: 'Keep the log open as a column on the right', run: ondock }]
        : []),
      { label: 'Close', title: 'Close the log (Escape)', run: onclose },
    ]}
  />
</aside>

<style>
  .log-drawer {
    position: fixed;
    right: 12px;
    bottom: 12px;
    width: min(360px, calc(100vw - 24px));
    z-index: 9;
    box-shadow: -8px 0 24px var(--lift);
  }

  /* The phone: from under the dock to over the bottom bar, edge to edge. Both
     heights are published by the blocks themselves (Dock.svelte, BottomBar.svelte). */
  .log-drawer.log-sheet {
    top: calc(var(--dock-h, 0px) + 8px);
    right: calc(8px + var(--safe-right));
    bottom: calc(var(--bottombar-h, 0px) + 8px);
    left: calc(8px + var(--safe-left));
    width: auto;
  }
</style>
