<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { viewport } from './viewport.svelte';
  import { LAYER, provideHostLayer, pushOverlay } from './overlays';

  // Small floating window for inspecting one thing. Clicking the backdrop —
  // anywhere outside the window — or pressing Escape (or the Android back
  // button) closes it. With several open only the topmost closes (lib/overlays.ts),
  // so a window opened from another (the Cook's Book from a bench) closes alone.
  // A picker or pick mode inside it joins the stack on the window layer after the
  // window, so one press closes the picker and the next the window.
  // Below 700px (the phone layout, docs/PHONE.md) it is a sheet over the whole
  // screen: the header, with a 44px close button, stays at the top inside the
  // safe area, and the body scrolls under it.
  let {
    title,
    onclose,
    children,
    /** A workbench needs room; an item tooltip does not. */
    wide = false,
    /**
     * Most of the screen, at a fixed height. The body is a container named
     * `fill-body` and scrolls when its content is taller: the content asks the
     * container for its own width (`@container fill-body (max-width: ...)`) and
     * lays itself out either in columns that scroll on their own, at the body's
     * height, or in one flow (the anvil). The window does not decide.
     */
    fill = false,
  }: { title: Snippet; onclose: () => void; children: Snippet; wide?: boolean; fill?: boolean } = $props();

  provideHostLayer(LAYER.window);
  onMount(() => pushOverlay(LAYER.window, () => onclose()));
</script>

<div class="overlay" class:sheet={viewport.phone} role="presentation" onclick={(e) => e.target === e.currentTarget && onclose()}>
  <div class="window panel" class:wide class:fill class:sheet={viewport.phone} role="dialog" aria-modal="true">
    <header>
      <div class="title">{@render title()}</div>
      <button class="close" aria-label="Close" onclick={onclose}>✕</button>
    </header>
    <div class="body">{@render children()}</div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: var(--scrim);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20;
    padding: 16px;
  }

  /*
   * A flex column that clips: the header stays put and the body scrolls, so a
   * long list is never cut off with no way to reach the rest. `.panel` brings
   * its own padding — zero it out here, since header and body pad themselves.
   */
  .window {
    width: 340px;
    max-width: 100%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    padding: 0;
    overflow: hidden;
  }

  .window.wide {
    width: 720px;
    max-height: 88vh;
    box-shadow: 0 10px 34px var(--lift);
  }

  .window.fill {
    width: 1400px;
    height: 92vh;
    max-height: 92vh;
    box-shadow: 0 10px 34px var(--lift);
  }

  .window.fill .body {
    flex: 1;
    container: fill-body / inline-size;
  }

  header {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
  }

  .title {
    flex: 1;
    min-width: 0;
  }

  .close {
    padding: 2px 7px;
    font-size: 12px;
    flex-shrink: 0;
  }

  .body {
    padding: 10px 12px 12px;
    overflow-y: auto;
    min-height: 0;
  }

  /* The phone sheet: no margin, no frame, the whole window. The insets keep the
     header out from under the status bar and the body above the gesture strip. */
  .overlay.sheet {
    padding: 0;
    align-items: stretch;
    justify-content: stretch;
  }

  .window.sheet,
  .window.sheet.wide,
  .window.sheet.fill {
    width: 100%;
    max-width: 100%;
    height: 100%;
    max-height: 100%;
    border-width: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .window.sheet header {
    align-items: center;
    padding: calc(8px + var(--safe-top)) calc(12px + var(--safe-right)) 8px calc(12px + var(--safe-left));
  }

  .window.sheet .close {
    min-width: 44px;
    min-height: 44px;
    font-size: 16px;
  }

  .window.sheet .body {
    flex: 1;
    padding: 10px calc(12px + var(--safe-right)) calc(16px + var(--safe-bottom)) calc(12px + var(--safe-left));
  }
</style>
