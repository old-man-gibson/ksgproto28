<script lang="ts">
  import { gs } from '../state.svelte';
  import { PART_KINDS } from '../../core/registry';
  import { SLOT_NAMES } from '../../core/types';
  import type { PartKindDef } from '../../core/types';
  import { formKnown } from '../../core/systems/forging';
  import { anvil, loadOnAnvil } from '../lib/anvil.svelte';
  import {
    adaptMaterials,
    chartEntries,
    classesForIndex,
    placementText,
    sameShape,
    type ChartEntry,
    type ChartSetup,
  } from '../lib/anvilView';

  /**
   * The form chart: head kind by haft kind, with the guard, the binding and the
   * head count set above. Each cell is the form that combination resolves to,
   * named once it has been forged on this save and "?" until then. The chart is
   * the way back to a form already found: a known cell loads on the anvil.
   */

  const kinds = Object.values(PART_KINDS);
  const heads = kinds.filter((k) => k.role === 'head');
  const hafts = kinds.filter((k) => k.role === 'haft');
  const guards = kinds.filter((k) => k.role === 'guard');
  const binds = kinds.filter((k) => k.role === 'bind');
  /** Head counts offered: a coif is four rings, a mail shirt eight, a pair of greaves two bent pieces. */
  const COUNTS = [1, 2, 4, 8];

  const setup = $derived<ChartSetup>({ guard: anvil.chart.guard, bind: anvil.chart.bind, count: anvil.chart.count });
  const rows: (PartKindDef | null)[] = [null, ...heads];
  const cols: (PartKindDef | null)[] = [null, ...hafts];
  /** Every cell's forms. They depend on the selectors only, not on what has been forged. */
  const grid = $derived(rows.map((h) => cols.map((f) => chartEntries(h?.id ?? null, f?.id ?? null, setup))));

  const classes = classesForIndex();
  const knownClasses = $derived(classes.filter((c) => formKnown(gs, c.id)));

  function load(entry: ChartEntry) {
    loadOnAnvil(gs, adaptMaterials(entry.placement, anvil.placement));
  }
</script>

<div class="chart">
  <p class="small dim intro">
    A form shows its name once it has been forged on this save, and "?" until then. Click a known form to load it on
    the anvil.
  </p>

  <div class="tools">
    <div class="group">
      <span class="small dim">Guard</span>
      <button class="small" class:selected={anvil.chart.guard === null} onclick={() => (anvil.chart.guard = null)}>none</button>
      {#each guards as g (g.id)}
        <button class="small" class:selected={anvil.chart.guard === g.id} onclick={() => (anvil.chart.guard = g.id)}>{g.name}</button>
      {/each}
    </div>
    <div class="group">
      <span class="small dim">Binding</span>
      <button class="small" class:selected={anvil.chart.bind === null} onclick={() => (anvil.chart.bind = null)}>none</button>
      {#each binds as b (b.id)}
        <button class="small" class:selected={anvil.chart.bind === b.id} onclick={() => (anvil.chart.bind = b.id)}>{b.name}</button>
      {/each}
    </div>
    <div class="group">
      <span class="small dim" title="Applies to rings and bent pieces, up to the most one slot takes">Head count</span>
      {#each COUNTS as n (n)}
        <button class="small" class:selected={anvil.chart.count === n} onclick={() => (anvil.chart.count = n)}>×{n}</button>
      {/each}
    </div>
    <span class="small dim">{knownClasses.length} of {classes.length} forms known</span>
  </div>

  <div class="scroll">
    <table>
      <thead>
        <tr>
          <th class="corner">Head \ Haft</th>
          {#each cols as f (f?.id ?? 'none')}
            <th>
              {f ? f.name : 'none'}
              {#if f}<div class="size">{f.w}×{f.l}</div>{/if}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as h, r (h?.id ?? 'none')}
          <tr>
            <th class="rowhead" scope="row">
              {h ? h.name : 'none'}
              {#if h}<span class="size">{h.w}×{h.l}</span>{/if}
            </th>
            {#each cols as f, c (f?.id ?? 'none')}
              {@const entries = grid[r][c]}
              <td>
                {#each entries as entry (entry.cls.id)}
                  {@const known = formKnown(gs, entry.cls.id)}
                  <button
                    class:unknown={!known}
                    class:degenerate={known && entry.cls.degenerate}
                    class:current={sameShape(entry.placement, anvil.placement)}
                    disabled={!known}
                    title={known
                      ? `${SLOT_NAMES[entry.cls.slot]}${entry.cls.degenerate ? ', degenerate form' : ''}. Load on the anvil.`
                      : 'Not forged on this save'}
                    onclick={() => load(entry)}
                  >
                    {known ? entry.cls.name : '?'}
                  </button>
                {:else}
                  <span class="dim">–</span>
                {/each}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="forms">
    <div class="small dim">
      Forms found
      {#if knownClasses.length < classes.length}
        <span>({classes.length - knownClasses.length} not forged yet)</span>
      {/if}
    </div>
    <div class="form-list">
      {#each knownClasses as c (c.id)}
        <button class="small" title={placementText(c.exemplar)} onclick={() => loadOnAnvil(gs, adaptMaterials(c.exemplar, anvil.placement))}>
          {c.icon} {c.name}
        </button>
      {:else}
        <span class="small dim">None yet. Forge a piece, or craft a recipe line, to record its form.</span>
      {/each}
    </div>
    <div class="small dim">
      Forms that use a second head are not on the grid. They are listed here once found.
    </div>
  </div>
</div>

<style>
  .chart {
    display: grid;
    gap: 10px;
    min-width: 0;
  }

  .intro {
    margin: 0;
  }

  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    align-items: center;
  }

  .group {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }

  button.small {
    padding: 2px 7px;
  }

  .scroll {
    overflow-x: auto;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    min-width: 560px;
    font-size: 12.5px;
  }

  th,
  td {
    border: 1px solid var(--border);
    padding: 3px 5px;
    text-align: center;
  }

  th {
    background: var(--bg-raised);
    color: var(--text-dim);
    font-weight: 500;
  }

  th.rowhead,
  th.corner {
    text-align: left;
    white-space: nowrap;
  }

  .size {
    font-size: 11px;
    opacity: 0.8;
  }

  td button {
    width: 100%;
    border: 0;
    background: transparent;
    padding: 2px;
    font-size: 12.5px;
    margin: 0;
  }

  td button:hover:not(:disabled) {
    background: var(--bg-hover);
  }

  /* A form not forged yet is shown as "?", dimmed rather than faded out. */
  td button.unknown {
    color: var(--text-dim);
    opacity: 1;
  }

  td button.degenerate {
    color: var(--skill);
  }

  /* The cell that matches the piece on the anvil now. */
  td button.current {
    box-shadow: inset 0 0 0 1px var(--accent);
  }

  .form-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: 3px 0;
  }
</style>
