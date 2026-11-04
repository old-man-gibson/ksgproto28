<script lang="ts">
  import LogFeed from './LogFeed.svelte';

  /**
   * The folded log's full view: a panel from the right edge, below the header,
   * over the main column. Not a modal: the game keeps running and keys keep
   * working. Escape, the Log button (LogTicker.svelte) or a click outside
   * closes it. `ondock` puts the log back in its column for good.
   *
   * Its z-index stays under the windows (Modal 20, offline report 10, the map
   * card 9 is its equal and the drawer comes later in the page).
   */
  let { onclose, ondock }: { onclose: () => void; ondock: () => void } = $props();

  let drawer: HTMLElement;

  function onKeydown(ev: KeyboardEvent) {
    if (ev.key !== 'Escape') return;
    // A window on top owns Escape (Modal closes its newest window only).
    if (document.querySelector('[aria-modal="true"]')) return;
    onclose();
  }

  function onPointerDown(ev: PointerEvent) {
    const target = ev.target as Element | null;
    if (!target || drawer.contains(target)) return;
    // The Log button toggles the drawer itself.
    if (target.closest('[data-log-toggle]')) return;
    onclose();
  }
</script>

<svelte:window onkeydown={onKeydown} onpointerdown={onPointerDown} />

<aside class="log-drawer" bind:this={drawer} aria-label="Log">
  <LogFeed
    actions={[
      { label: 'Dock', title: 'Keep the log open as a column on the right', run: ondock },
      { label: 'Close', title: 'Close the log (Escape)', run: onclose },
    ]}
  />
</aside>

<style>
  .log-drawer {
    position: fixed;
    /* The layout publishes the header's height; its padding and gap add 24px. */
    top: calc(var(--header-h, 56px) + 24px);
    right: 12px;
    bottom: 12px;
    width: min(360px, calc(100vw - 24px));
    z-index: 9;
    box-shadow: -8px 0 24px rgb(0 0 0 / 45%);
  }
</style>
