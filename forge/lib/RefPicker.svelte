<script lang="ts">
  /**
   * Pick an id out of a real registry.
   *
   * The whole reason the forge loads live data instead of re-declaring it: this
   * lists what actually exists, and says so immediately when what you typed
   * doesn't. A cross-reference typo used to survive until `npm run verify`.
   */
  import { store } from './store.svelte';

  interface Props {
    /** Catalog kind to pick from — 'material', 'item', 'monster', 'spot'… */
    kind: string;
    value: string | undefined;
    onchange: (id: string | undefined) => void;
    placeholder?: string;
    /** Allow clearing to undefined. */
    clearable?: boolean;
    /** Narrow the options, e.g. only spots in one region. */
    filter?: (def: Record<string, unknown>) => boolean;
    /**
     * Literals that are valid here besides real ids — a technique's
     * `from: 'any'`, a spot's `benches: ['spelltable']`. Without these the
     * picker calls a legitimate value broken.
     */
    allow?: string[];
  }
  let { kind, value, onchange, placeholder, clearable = true, filter, allow }: Props = $props();

  // A stable id for this instance's datalist. It never needs to track `kind`
  // changes — the element is the same element either way.
  const listId = `ref-${Math.random().toString(36).slice(2, 10)}`;

  const options = $derived.by(() => {
    const all = Object.entries(store.all<Record<string, unknown>>(kind));
    const kept = filter ? all.filter(([, def]) => filter(def)) : all;
    return kept
      .map(([id, def]) => ({
        id,
        name: (def.name as string) ?? id,
        icon: (def.icon as string) ?? '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  const resolved = $derived(value ? store.get<{ name?: string; icon?: string }>(kind, value) : undefined);
  const sentinel = $derived(!!value && (allow ?? []).includes(value));
  const missing = $derived(!!value && !resolved && !sentinel);

  let text = $state('');
  // Keep the box in step when the selection changes from elsewhere (clicking a
  // different node), without fighting the user mid-type.
  $effect(() => {
    text = value ?? '';
  });

  function commit(next: string): void {
    const trimmed = next.trim();
    if (!trimmed) {
      if (clearable) onchange(undefined);
      return;
    }
    onchange(trimmed);
  }
</script>

<div class="picker" class:missing>
  <input
    list={listId}
    bind:value={text}
    {placeholder}
    spellcheck="false"
    onchange={() => commit(text)}
    onblur={() => commit(text)}
  />
  <datalist id={listId}>
    {#each allow ?? [] as a (a)}
      <option value={a}>any / special</option>
    {/each}
    {#each options as o (o.id)}
      <option value={o.id}>{o.icon} {o.name}</option>
    {/each}
  </datalist>
  <span class="resolved" title={value ?? ''}>
    {#if !value}
      <span class="dim">—</span>
    {:else if resolved}
      {resolved.icon ?? ''} {resolved.name ?? value}
    {:else if sentinel}
      <span class="special">✦ special value</span>
    {:else}
      <span class="bad">no such {kind}</span>
    {/if}
  </span>
</div>

<style>
  .picker {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .picker input {
    flex: 1;
    min-width: 0;
    font-family: var(--mono);
    font-size: 12px;
  }

  .picker.missing input {
    border-color: var(--bad);
  }

  .resolved {
    font-size: 11.5px;
    color: var(--dim);
    max-width: 42%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bad {
    color: var(--bad);
  }

  .special {
    color: var(--accent2);
  }
</style>
