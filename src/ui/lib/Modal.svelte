<script module lang="ts">
  /** Windows open now, oldest first. Escape closes only the newest, so a window opened from another (the Cook's Book from a bench) closes alone. */
  const open: symbol[] = [];
</script>

<script lang="ts">
  import { onMount, type Snippet } from 'svelte';

  // Small floating window for inspecting one thing. Clicking the backdrop —
  // anywhere outside the window — or pressing Escape closes it.
  let {
    title,
    onclose,
    children,
    /** A workbench needs room; an item tooltip does not. */
    wide = false,
  }: { title: Snippet; onclose: () => void; children: Snippet; wide?: boolean } = $props();

  const me = Symbol('modal');
  onMount(() => {
    open.push(me);
    return () => {
      const at = open.indexOf(me);
      if (at >= 0) open.splice(at, 1);
    };
  });
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && open[open.length - 1] === me && onclose()} />

<div class="overlay" role="presentation" onclick={(e) => e.target === e.currentTarget && onclose()}>
  <div class="window panel" class:wide role="dialog" aria-modal="true">
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
    background: rgb(0 0 0 / 55%);
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
    box-shadow: 0 10px 34px rgb(0 0 0 / 55%);
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
</style>
