<script lang="ts">
  /**
   * One category's worth of tag filtering, folded into a dropdown. Single-pick
   * categories close on choose; multi-pick ones stay open so a whole OR-set can
   * be assembled in one go. "Any" clears the category.
   *
   * Options are structural rather than a named registry type, so anything with
   * an id, a name and a glyph can be filtered this way — monster tags and
   * deity aspects both come through here.
   */
  interface TagOption {
    id: string;
    name: string;
    icon: string;
    desc?: string;
  }

  let {
    label,
    options,
    selected,
    multi = false,
    onchange,
  }: {
    label: string;
    options: TagOption[];
    selected: string[];
    multi?: boolean;
    onchange: (next: string[]) => void;
  } = $props();

  let open = $state(false);
  let root = $state<HTMLElement>();

  function choose(id: string) {
    if (!multi) {
      onchange(selected.includes(id) ? [] : [id]);
      open = false;
      return;
    }
    onchange(selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id]);
  }

  const chosen = $derived(options.filter((o) => selected.includes(o.id)));
</script>

<svelte:window
  onpointerdown={(e) => {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }}
  onkeydown={(e) => e.key === 'Escape' && (open = false)}
/>

<div class="picker" bind:this={root}>
  <button
    class="small trigger"
    class:active={chosen.length > 0}
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    <span class="label">{label}</span>
    {#if chosen.length === 0}
      <span class="dim">Any</span>
    {:else if chosen.length <= 3}
      <span class="value">{chosen.map((c) => c.icon).join('')}</span>
      {#if chosen.length === 1}<span class="value">{chosen[0].name}</span>{/if}
    {:else}
      <span class="value">{chosen.length} picked</span>
    {/if}
    <span class="caret dim">▾</span>
  </button>

  {#if open}
    <div class="menu panel">
      <button class="opt small" class:on={selected.length === 0} onclick={() => { onchange([]); open = false; }}>
        <span class="tick">{selected.length === 0 ? '●' : ''}</span> Any
      </button>
      {#each options as opt (opt.id)}
        <button
          class="opt small"
          class:on={selected.includes(opt.id)}
          title={opt.desc ?? ''}
          onclick={() => choose(opt.id)}
        >
          <span class="tick">{selected.includes(opt.id) ? (multi ? '✓' : '●') : ''}</span>
          {opt.icon} {opt.name}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .picker {
    position: relative;
  }

  .trigger {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    font-size: 12px;
    max-width: 100%;
  }

  .trigger.active {
    border-color: var(--accent);
  }

  .label {
    color: var(--text-dim);
  }

  .value {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .caret {
    font-size: 10px;
  }

  .menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 10;
    min-width: 160px;
    /* Never taller than the room under the header on a short window. */
    max-height: min(300px, 46vh);
    overflow-y: auto;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    box-shadow: 0 8px 22px rgb(0 0 0 / 45%);
  }

  .opt {
    display: flex;
    align-items: center;
    gap: 6px;
    text-align: left;
    padding: 3px 6px;
    background: transparent;
    border-color: transparent;
    white-space: nowrap;
  }

  .opt:hover {
    background: var(--bg-hover);
  }

  .opt.on {
    color: var(--accent);
  }

  .tick {
    width: 10px;
    flex-shrink: 0;
    font-size: 10px;
  }
</style>
