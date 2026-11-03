<script lang="ts">
  import { gs } from '../state.svelte';
  import { facetReadouts } from '../../core/facet/host';
  import { abilityValue, pct } from '../lib/format';

  /**
   * The run's ability in full (docs/FACET.md): what it does, every cell its
   * document marks for showing, the inputs it reads, the conditions it puts
   * on fighters, and its evolution. The sidebar carries only the cells acting
   * on you right now (Sidebar.svelte).
   */
  const abilities = $derived(facetReadouts(gs));
</script>

{#each abilities as ab (ab.name)}
  <div class="panel ability">
    <h2>{ab.icon} {ab.name}</h2>
    {#if ab.desc}<p class="small">{ab.desc}</p>{/if}

    <div class="rows">
      {#each ab.cells as cell (cell.key)}
        <div class="row">
          <div class="head">
            <span>{cell.icon} {cell.label}</span>
            <b class:low={cell.show === 'signedPct' && cell.value < 0}>{abilityValue(cell)}</b>
          </div>
          {#if cell.show === 'bar'}
            <div class="bar">
              <div class="fill" style="width: {cell.cap > 0 ? (100 * cell.value) / cell.cap : 0}%; background: var(--accent)"></div>
            </div>
          {/if}
          {#if cell.desc}<div class="small dim">{cell.desc}</div>{/if}
        </div>
      {/each}
      {#each ab.inputs as input (input.label)}
        <div class="row">
          <div class="head">
            <span>{input.label}</span>
            <b>{input.show === 'pct' ? pct(input.value, 0) : input.value}</b>
          </div>
        </div>
      {/each}
    </div>

    {#if ab.conditions.length}
      <h3>Conditions it applies</h3>
      <div class="rows">
        {#each ab.conditions as cond (cond.name)}
          <div class="row">
            <div><b>{cond.icon} {cond.name}</b></div>
            <div class="small">{cond.desc}</div>
            {#if cond.becomes}
              <div class="small">
                At its cap it becomes <b>{cond.becomes.icon} {cond.becomes.name}</b>: {cond.becomes.desc}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    {#if ab.evolves}
      <h3>Evolution</h3>
      <p class="small">
        At {ab.evolves.at} {ab.evolves.label} play holds and you pick one branch. The branch keeps
        everything the ability has earned, and the pick is final for the run.
      </p>
      <div class="rows">
        {#each ab.evolves.into as branch (branch.key)}
          <div class="row">
            <div><b>{branch.icon} {branch.name}</b></div>
            {#if branch.desc}<div class="small">{branch.desc}</div>{/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <div class="panel"><p class="dim">No ability this run.</p></div>
{/each}

<style>
  .ability + .ability {
    margin-top: 12px;
  }
  h3 {
    margin: 14px 0 6px;
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  h2 + .rows,
  p + .rows {
    margin-top: 10px;
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  .low {
    color: var(--danger);
  }
</style>
