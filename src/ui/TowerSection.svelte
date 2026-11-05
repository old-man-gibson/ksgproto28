<script lang="ts">
  import { gs, view } from './state.svelte';
  import type { TowerDef } from '../core/types';
  import {
    MARK_ICON,
    rideDuration,
    towerSection,
    type StopView,
  } from './lib/ladderView';
  import { bandIsOpen, setBandOpen } from './lib/ladderFold.svelte';
  import { ticksToTime } from './lib/format';

  /**
   * The tower as a column beside the floor plan (docs/NAVIGATION.md §3.5): one
   * row per stop, highest first, bands that fold by the same rules as the Ascent
   * panel. A row click picks the stop (`onpick`): the map shows its plan and
   * the detail under it shows its terms and ride button. A click never rides,
   * and nothing here opens on hover.
   *
   * The column is exactly `height` px tall (the map's) and scrolls inside
   * itself, so opening a fold or a ride starting moves nothing outside it.
   */
  let {
    tower,
    height,
    shownKey,
    onpick,
  }: {
    tower: TowerDef;
    /** The map's height, px. */
    height: number;
    /** The stop whose plan and terms are on show. */
    shownKey: string | null;
    onpick: (row: StopView) => void;
  } = $props();

  const section = $derived(towerSection(gs, tower, bandIsOpen));

  let scroller = $state<HTMLElement | null>(null);

  /** The row of the stop the player stands on. */
  const hereKey = $derived(
    [...section.groups.flatMap((g) => g.rows), section.foot].find((r) => r.current)?.key ?? null,
  );

  // Arriving on a stop brings its row into view inside the column. Only the
  // column scrolls; the page does not move.
  $effect(() => {
    void hereKey;
    const box = scroller;
    const row = box?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!box || !row) return;
    if (row.offsetTop < box.scrollTop || row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = row.offsetTop - (box.clientHeight - row.offsetHeight) / 2;
    }
  });

  /** What the right cell says: where you are, the ride's time, or that the ride is a forfeit. */
  function side(row: StopView): string {
    if (row.current) return 'here';
    if (!row.action) return '';
    if (row.action.kind === 'forfeit') return 'forfeit';
    return ticksToTime(rideDuration(row.action, view.stats.travelSpeed));
  }

  /** The row's name for a screen reader. */
  function rowLabel(row: StopView): string {
    const what = row.number !== null ? `Floor ${row.number}${row.name ? `, ${row.name}` : ''}` : (row.name ?? '');
    return `${what}: ${row.word}${row.current ? ', you are here' : ''}`;
  }
</script>

{#snippet stop(row: StopView)}
  <button
    class="ts-row"
    class:picked={row.key === shownKey}
    class:here={row.current}
    class:locked={row.mark === 'gated' || row.mark === 'sealed' || row.mark === 'locked'}
    aria-current={row.current ? 'location' : undefined}
    aria-pressed={row.key === shownKey}
    aria-label={rowLabel(row)}
    onclick={() => onpick(row)}
  >
    <span class="ts-mark">{row.kind === 'foot' ? row.icon : MARK_ICON[row.mark]}</span>
    <span class="ts-name">
      {#if row.number !== null}<span class="ts-num">{row.number}</span>{/if}
      {#if row.name}<span>{row.kind === 'bandHub' ? `${row.icon} ` : ''}{row.name}</span>{/if}
    </span>
    <span class="ts-side small" class:here-tag={row.current} class:forfeit={row.action?.kind === 'forfeit'}>{side(row)}</span>
  </button>
{/snippet}

<nav class="tower-section" style:height="{height}px" aria-label="{tower.name} floors" bind:this={scroller}>
  {#each section.groups as g (g.band.id)}
    {#if g.titleOnly}
      <!-- The next band, not reached: a name and nothing to fold. -->
      <div class="ts-band title-only">{g.band.name}</div>
    {:else}
      <details
        class="ts-group"
        class:fixed={!g.foldable}
        bind:open={() => g.open, (v) => setBandOpen(g.band.id, g.foldable, v)}
      >
        <!-- A band that may not fold keeps its header as a label: the click does nothing. -->
        <summary
          class="ts-band"
          onclick={(e) => {
            if (!g.foldable) e.preventDefault();
          }}
        >
          <span class="ts-band-name">{g.band.name}</span>
          <span class="ts-count">{g.cleared}/{g.total}</span>
        </summary>
        {#each g.rows as row (row.key)}
          {@render stop(row)}
        {/each}
      </details>
    {/if}
  {/each}
  <div class="ts-foot">{@render stop(section.foot)}</div>
</nav>

<style>
  .tower-section {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    margin-top: 2px;
    padding: 2px 0;
    overflow-x: hidden;
    overflow-y: auto;
    background: var(--bg-sunken);
    border: 1px solid var(--border);
    font-size: 13px;
  }

  .ts-band {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 5px 6px 2px;
    font-size: 11.5px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-dim);
    border-bottom: 1px solid var(--border);
  }

  .ts-band-name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ts-count {
    flex: none;
    font-variant-numeric: tabular-nums;
  }

  /* A band's header is its fold control: a marker, then name and progress. */
  summary.ts-band {
    list-style: none;
    cursor: pointer;
  }

  summary.ts-band::-webkit-details-marker {
    display: none;
  }

  summary.ts-band::before {
    content: '▸';
    flex: none;
    width: 1em;
  }

  details[open] > summary.ts-band::before {
    content: '▾';
  }

  /* A band that may not fold: no marker, no pointer. */
  details.fixed > summary.ts-band {
    cursor: default;
  }

  details.fixed > summary.ts-band::before {
    content: '';
  }

  /* The next band, not reached: its name, dimmed, lined up with the names above. */
  .ts-band.title-only {
    /* The band is already --text-dim; dimming it again with opacity took it under 4.5:1. */
    padding-left: calc(6px + 1em + 6px);
  }

  .ts-foot {
    margin-top: auto;
    border-top: 1px solid var(--border);
  }

  /* One row per stop, a fixed height so a status changing moves nothing. */
  .ts-row {
    display: grid;
    grid-template-columns: 1.6em minmax(0, 1fr) auto;
    align-items: center;
    gap: 4px;
    width: 100%;
    height: 26px;
    margin: 0;
    padding: 0 6px;
    border: 0;
    background: transparent;
    text-align: left;
    font-size: 13px;
    line-height: 1;
    overflow: hidden;
  }

  /* The stop whose plan is on show: a fill and an underlined name. */
  .ts-row.picked {
    background: var(--bg-raised);
  }

  .ts-row.picked .ts-name {
    text-decoration: underline;
  }

  /* Not open yet (locked, sealed or shut): hatched, next to the lock mark and the
     status word. The hatch is a background image, so it keeps the fixed row height. */
  .ts-row.locked {
    background-image: var(--hatch-lock);
  }

  /* The column scrolls and clips, so the focus ring sits inside the row. */
  .ts-row:focus-visible {
    outline-offset: -3px;
  }

  /* The stop underfoot: a bar on the left edge and the accent. */
  .ts-row.here {
    box-shadow: inset 2px 0 0 var(--accent);
    color: var(--accent);
  }

  .ts-mark {
    text-align: center;
    overflow: hidden;
  }

  .ts-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ts-num {
    display: inline-block;
    min-width: 1.4em;
    margin-right: 3px;
    font-variant-numeric: tabular-nums;
    color: var(--text-dim);
  }

  .ts-side {
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: var(--text-dim);
  }

  .ts-side.here-tag {
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .ts-side.forfeit {
    color: var(--danger);
  }
</style>
