<script lang="ts">
  import type { Snippet } from 'svelte';

  // `block` targets wrap non-text content (e.g. resource bars): full-width,
  // no dotted underline. Default targets are inline text (attributes, stats).
  let { children, tip, block = false }: { children: Snippet; tip: Snippet; block?: boolean } =
    $props();

  let show = $state(false);
  let x = $state(0);
  let y = $state(0);

  function enter(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    x = Math.min(rect.right + 10, window.innerWidth - 320);
    y = Math.min(rect.top - 4, window.innerHeight - 260);
    show = true;
  }
</script>

<span class="tip-target" class:block role="note" onmouseenter={enter} onmouseleave={() => (show = false)}>
  {@render children()}
</span>
{#if show}
  <div class="tip-pop" style="left: {x}px; top: {y}px">
    {@render tip()}
  </div>
{/if}

<style>
  .tip-target {
    cursor: help;
    border-bottom: 1px dotted color-mix(in srgb, var(--text-dim) 60%, transparent);
  }

  .tip-target.block {
    display: block;
    border-bottom: none;
  }

  .tip-pop {
    position: fixed;
    z-index: 100;
    min-width: 200px;
    max-width: 310px;
    background: var(--bg-panel);
    border: 1px solid var(--accent);
    border-radius: 8px;
    padding: 8px 11px;
    font-size: 12px;
    line-height: 1.45;
    box-shadow: 0 6px 20px rgb(0 0 0 / 45%);
    pointer-events: none;
  }
</style>
