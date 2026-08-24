<script lang="ts" module>
  /** One tile in a collection: a held stack, a rune, a material. */
  export interface CollEntry {
    key: string;
    icon: string;
    /** Accessible name / tooltip anchor. */
    label: string;
    qty: number;
    /** Whole-entry sell value (0 if not sold). */
    value: number;
    /** Grade/quality rank for the housekeeping axis; absent = ungraded. */
    tierRank?: number;
    /** Border tint (grade colour). */
    tint?: string;
    /** Dim the tile (e.g. a provision on cooldown). */
    dim?: boolean;
  }

  export interface TierChip {
    rank: number;
    label: string;
    color: string;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import Tip from './Tip.svelte';
  import { fmt } from './format';

  let {
    title,
    entries,
    empty,
    noun,
    hint = '',
    tiers = [],
    warnRank = null,
    canSell = true,
    canDump = true,
    entryTip,
    headerExtra,
    onOpen,
    onPrimary,
    onSell,
    onDump,
  }: {
    title: string;
    entries: CollEntry[];
    empty: string;
    /** Singular noun for logs/confirms ("provision", "rune", "material"). */
    noun: string;
    hint?: string;
    /** Grade chips for the housekeeping axis; omit for ungraded sections. */
    tiers?: TierChip[];
    /** Reaching above this grade always asks first (sell or dump). */
    warnRank?: number | null;
    canSell?: boolean;
    canDump?: boolean;
    entryTip: Snippet<[CollEntry]>;
    headerExtra?: Snippet;
    onOpen: (key: string) => void;
    onPrimary?: (key: string) => void;
    onSell?: (keys: string[]) => void;
    onDump?: (keys: string[]) => void;
  } = $props();

  let selectMode = $state(false);
  let picked = $state(new Set<string>());
  // The active grade threshold: everything at or below it is selected.
  let tierFilter = $state<number | null>(null);

  const byKey = $derived(new Map(entries.map((e) => [e.key, e])));
  const pickedEntries = $derived(
    [...picked].map((k) => byKey.get(k)).filter((e): e is CollEntry => !!e),
  );
  const pickedUnits = $derived(pickedEntries.reduce((s, e) => s + e.qty, 0));
  const pickedValue = $derived(pickedEntries.reduce((s, e) => s + e.value, 0));

  /** Grades actually present, worst → best, for the threshold picker. */
  const tiersPresent = $derived(tiers.filter((t) => entries.some((e) => e.tierRank === t.rank)));

  /** Whether the current selection reaches into grades above the warn line. */
  const hiGrade = $derived(
    warnRank != null && pickedEntries.some((e) => e.tierRank != null && e.tierRank > warnRank),
  );

  function syncTier() {
    picked =
      tierFilter != null
        ? new Set(entries.filter((e) => e.tierRank != null && e.tierRank <= tierFilter!).map((e) => e.key))
        : new Set();
  }

  function toggleTier(rank: number) {
    tierFilter = tierFilter === rank ? null : rank;
    syncTier();
  }

  function setSelect(on: boolean) {
    selectMode = on;
    picked = new Set();
    tierFilter = null;
  }

  function toggle(key: string) {
    const next = new Set(picked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    picked = next;
    tierFilter = null; // a hand edit no longer matches the chips
  }

  function selectAll() {
    tierFilter = null;
    picked = new Set(entries.map((e) => e.key));
  }

  // Single click opens (or ticks, in select mode); double click runs the
  // primary action. The browser fires click before dblclick, so the first
  // click waits a beat to see whether a second is coming.
  let pending: ReturnType<typeof setTimeout> | null = null;
  function click(key: string) {
    if (selectMode) {
      toggle(key);
      return;
    }
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      onOpen(key);
    }, 260);
  }
  function dbl(key: string) {
    if (selectMode) return;
    if (pending) clearTimeout(pending);
    pending = null;
    onPrimary?.(key);
  }

  const plural = (n: number) => `${fmt(n)} ${noun}${n === 1 ? '' : 's'}`;

  function doSell() {
    if (!onSell || picked.size === 0) return;
    if (hiGrade && !confirm(`Sell ${plural(pickedUnits)} for ${fmt(pickedValue)} gold?`)) return;
    onSell([...picked]);
    setSelectClean();
  }
  function doDump() {
    if (!onDump || picked.size === 0) return;
    // Quick only for a low-grade threshold sweep; a hand-picked or high-grade
    // dump always asks, since it destroys value for nothing.
    const needs = hiGrade || tierFilter == null;
    if (needs && !confirm(`Dump ${plural(pickedUnits)}? Gone for good — no gold for it.`)) return;
    onDump([...picked]);
    setSelectClean();
  }
  function setSelectClean() {
    picked = new Set();
    tierFilter = null;
  }
</script>

<div class="panel section">
  <div class="head-row">
    <h3>{title} <span class="dim small">({entries.length})</span></h3>
    <div class="head-actions">
      {@render headerExtra?.()}
      {#if entries.length > 0}
        <button class="small" class:selected={selectMode} onclick={() => setSelect(!selectMode)}>
          ☑ Select
        </button>
      {/if}
    </div>
  </div>

  {#if entries.length === 0}
    <p class="dim">{empty}</p>
  {:else}
    {#if hint && !selectMode}<p class="small dim hint">{hint}</p>{/if}
    {#if selectMode}
      <div class="toolbar select-bar small">
        <span class:dim={picked.size === 0}>
          {fmt(pickedUnits)} selected{canSell ? ` · ${fmt(pickedValue)} 🪙` : ''}
        </span>
        <button class="small" onclick={selectAll}>All</button>
        <button class="small" disabled={picked.size === 0} onclick={setSelectClean}>Clear</button>
        {#if canSell}
          <button class="small" disabled={picked.size === 0} onclick={doSell}>
            Sell{hiGrade ? ' ⚠' : ''}
          </button>
        {/if}
        {#if canDump}
          <button class="small ghost" disabled={picked.size === 0} onclick={doDump}>
            Dump{hiGrade ? ' ⚠' : ''}
          </button>
        {/if}
        <button class="small done" onclick={() => setSelect(false)}>Done</button>
      </div>
      {#if tiersPresent.length}
        <div class="toolbar chips small">
          <span class="dim">Up to</span>
          {#each tiersPresent as t (t.rank)}
            <button
              class="small chip"
              class:selected={tierFilter === t.rank}
              style="--rar: {t.color}"
              onclick={() => toggleTier(t.rank)}
            >
              {t.label}
            </button>
          {/each}
        </div>
      {/if}
    {/if}
    <div class="grid">
      {#each entries as e (e.key)}
        {@const marked = selectMode && picked.has(e.key)}
        <Tip block>
          <button
            class="cell"
            class:marked
            class:dimmed={e.dim}
            style="--tint: {e.tint ?? 'var(--border)'}"
            aria-label={e.label}
            aria-pressed={selectMode ? picked.has(e.key) : undefined}
            onclick={() => click(e.key)}
            ondblclick={() => dbl(e.key)}
          >
            <span class="icon">{e.icon}</span>
            {#if marked}<span class="tick">✓</span>{/if}
            {#if e.qty > 1}<span class="count">{fmt(e.qty)}</span>{/if}
          </button>
          {#snippet tip()}{@render entryTip(e)}{/snippet}
        </Tip>
      {/each}
    </div>
  {/if}
</div>

<style>
  .section {
    margin-top: 12px;
  }

  .head-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .head-row h3 {
    margin: 0;
  }

  .head-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  .hint {
    margin: -2px 0 10px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
    gap: 8px;
  }

  .grid > :global(.tip-target) {
    display: block;
    border-bottom: none;
  }

  .cell {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border-radius: 8px;
    border: 1px solid var(--tint, var(--border));
    background: var(--bg-raised);
    cursor: pointer;
  }

  .cell:hover {
    background: var(--bg-hover);
  }

  .cell.dimmed {
    opacity: 0.45;
  }

  .cell.marked {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 18%, var(--bg-raised));
    box-shadow: inset 0 0 0 1px var(--accent);
  }

  .icon {
    font-size: 24px;
    line-height: 1;
  }

  .count {
    position: absolute;
    right: 2px;
    bottom: 2px;
    font-size: 10.5px;
    font-weight: 600;
    line-height: 1;
    padding: 1px 3px;
    border-radius: 4px;
    background: rgb(0 0 0 / 60%);
    color: var(--text);
  }

  .tick {
    position: absolute;
    top: 0;
    left: 3px;
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
    margin-bottom: 10px;
  }

  .toolbar button {
    padding: 3px 8px;
  }

  .select-bar {
    border: 1px solid var(--accent);
    border-radius: 8px;
    padding: 6px 8px;
    background: color-mix(in srgb, var(--accent) 7%, transparent);
  }

  .select-bar .ghost {
    border-color: #5d3030;
    color: var(--danger);
  }

  .select-bar .done {
    margin-left: auto;
  }

  .chips {
    margin: -4px 0 10px;
  }

  .chip {
    padding: 2px 8px;
    border-radius: 999px;
    border-color: var(--rar);
  }

  .chip.selected {
    border-color: var(--rar);
    background: color-mix(in srgb, var(--rar) 22%, var(--bg-raised));
  }
</style>
