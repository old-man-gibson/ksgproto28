<script lang="ts" module>
  export interface MenuItem {
    label?: string;
    icon?: string;
    /** Right-aligned note: a shortcut, or why the item is disabled. */
    hint?: string;
    danger?: boolean;
    disabled?: boolean;
    separator?: boolean;
    onclick?: () => void;
  }
</script>

<script lang="ts">
  import { untrack } from 'svelte';

  /**
   * A right-click menu positioned at the pointer.
   *
   * It flips rather than clips: opening near the right or bottom edge would
   * otherwise put half the actions off-screen, and the map's most interesting
   * nodes are the ones you have panned to the corner.
   */
  interface Props {
    x: number;
    y: number;
    items: MenuItem[];
    onclose: () => void;
    /** Shown greyed at the top so you can see what you actually hit. */
    title?: string;
  }
  let { x, y, items, onclose, title }: Props = $props();

  let el = $state<HTMLDivElement | undefined>();
  // Seeded from the click, then corrected once measured. Untracked because the
  // effect below is what follows x/y — reading them here is a starting point,
  // not a subscription.
  let pos = $state(untrack(() => ({ left: x, top: y })));

  $effect(() => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    pos = {
      left: x + rect.width + pad > window.innerWidth ? Math.max(pad, x - rect.width) : x,
      top: y + rect.height + pad > window.innerHeight ? Math.max(pad, y - rect.height) : y,
    };
    el.focus();
  });

  function pick(item: MenuItem): void {
    if (item.disabled || item.separator) return;
    onclose();
    item.onclick?.();
  }
</script>

<svelte:window
  onkeydown={(e) => e.key === 'Escape' && onclose()}
  onresize={onclose}
  onblur={onclose}
/>

<!-- Catches the click that dismisses the menu, so it never lands on the map
     underneath and moves something by accident. -->
<div
  class="veil"
  role="presentation"
  onpointerdown={onclose}
  oncontextmenu={(e) => {
    e.preventDefault();
    onclose();
  }}
></div>

<div
  bind:this={el}
  class="menu"
  style="left: {pos.left}px; top: {pos.top}px"
  role="menu"
  tabindex="-1"
>
  {#if title}
    <div class="title">{title}</div>
  {/if}
  {#each items as item, i (i)}
    {#if item.separator}
      <div class="sep"></div>
    {:else}
      <button
        class="item"
        class:danger={item.danger}
        role="menuitem"
        disabled={item.disabled}
        onclick={() => pick(item)}
      >
        <span class="ico">{item.icon ?? ''}</span>
        <span class="grow">{item.label}</span>
        {#if item.hint}<span class="hint">{item.hint}</span>{/if}
      </button>
    {/if}
  {/each}
</div>

<style>
  .veil {
    position: fixed;
    inset: 0;
    z-index: 400;
  }

  .menu {
    position: fixed;
    z-index: 401;
    min-width: 208px;
    padding: 4px;
    background: var(--bg2);
    border: 1px solid var(--border-bright);
    border-radius: 8px;
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.55);
  }

  .menu:focus {
    outline: none;
  }

  .title {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.9px;
    color: var(--dimmer);
    padding: 5px 9px 6px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 4px;
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    border: none;
    background: transparent;
    border-radius: 5px;
    padding: 5px 9px;
    font-size: 12.5px;
    text-align: left;
  }

  .item:hover:not(:disabled) {
    background: var(--bg4);
  }

  .item.danger:hover:not(:disabled) {
    background: rgba(248, 113, 113, 0.14);
    color: var(--bad);
  }

  .item:disabled {
    opacity: 0.38;
  }

  .ico {
    width: 15px;
    text-align: center;
    flex-shrink: 0;
  }

  .hint {
    font-size: 11px;
    color: var(--dimmer);
    font-family: var(--mono);
  }

  .sep {
    height: 1px;
    background: var(--border);
    margin: 4px 6px;
  }
</style>
