<script lang="ts">
  import { gs } from '../state.svelte';
  import { facetReadouts, type FacetReadout } from '../../core/facet/host';
  import { abilityValue, pct } from '../lib/format';
  import FactLines from '../lib/FactLines.svelte';
  import { game } from '../state.svelte';
  import { SPOTS } from '../../core/registry';
  import { cloneReach, cloneRules, cloneTask } from '../../core/systems/clones';

  /**
   * The run's ability in full (docs/FACET.md): what it does, every cell its
   * document marks for showing, the inputs it reads, the conditions it puts
   * on fighters, and its evolution. The sidebar carries only the cells acting
   * on you right now (Sidebar.svelte).
   */
  const abilities = $derived(facetReadouts(gs));

  /**
   * What a pressed action is waiting on. One line always, so the panel keeps
   * its height when the state changes each tick.
   */
  function actionState(act: { ready: boolean; queued: boolean }): string {
    if (!gs.combat) return 'In fights only.';
    if (act.queued) return 'Pressed: it takes your next action. Press again to cancel.';
    return act.ready ? 'Ready: it takes your next action.' : 'Not ready.';
  }
</script>

<!-- An ability action (Sun Blast): pressed here for the next bar fill, or fired by
     the rotation on the Combat tab under its trigger (facet/host.ts queueFacetAction). -->
{#snippet action(act: FacetReadout['actions'][number])}
  <div class="act">
    <button
      class:selected={act.queued}
      disabled={!gs.combat || (!act.ready && !act.queued)}
      onclick={() => game.queueFacetAction(act.key)}
    >
      {act.icon} {act.name}
    </button>
    <span class="small dim">{actionState(act)}</span>
  </div>
  {#if act.desc}<div class="facts"><FactLines text={act.desc} /></div>{/if}
{/snippet}

{#each abilities as ab (ab.name)}
  <div class="panel ability">
    <h2>{ab.icon} {ab.name}</h2>
    {#if ab.desc}<div class="facts"><FactLines text={ab.desc} /></div>{/if}

    <div class="rows">
      {#each ab.cells as cell (cell.key)}
        <div class="row">
          <div class="head">
            <span>{cell.icon} {cell.label}</span>
            {#if cell.line}
              <b>{cell.value > 0 ? cell.line : 'Not in effect'}</b>
            {:else}
              <b class:low={(cell.show === 'signedPct' && cell.value < 0) || (cell.show === 'minusPct' && cell.value > 0)}>{abilityValue(cell)}</b>
            {/if}
          </div>
          {#if cell.show === 'bar'}
            <div class="bar">
              <div class="fill" style="width: {cell.cap > 0 ? (100 * cell.value) / cell.cap : 0}%; background: var(--accent-fill)"></div>
            </div>
          {/if}
          {#if cell.desc}<div class="small dim">{cell.desc}</div>{/if}
          {#each ab.actions.filter((a) => a.under === cell.key) as act (act.key)}
            {@render action(act)}
          {/each}
        </div>
      {/each}
      {#each ab.actions.filter((a) => !ab.cells.some((c) => c.key === a.under)) as act (act.key)}
        <div class="row">{@render action(act)}</div>
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
      <h3>Conditions</h3>
      <div class="rows">
        {#each ab.conditions as cond (cond.name)}
          <div class="row">
            <div><b>{cond.icon} {cond.name}</b></div>
            <div class="small">{cond.desc}</div>
            {#if cond.becomes}
              <div class="small"><b>At cap:</b> becomes {cond.becomes.icon} {cond.becomes.name}. {cond.becomes.desc}</div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    {#if ab.evolves}
      <h3>Evolution</h3>
      <div class="facts">
        <FactLines
          text={[
            `Trigger: ${ab.evolves.at} ${ab.evolves.label}.`,
            'Pick: Play pauses until you pick 1 branch. The pick is final for this run.',
            'Keeps: Progress carries over.',
          ].join('\n')}
        />
      </div>
      <div class="rows">
        {#each ab.evolves.into as branch (branch.key)}
          <div class="row">
            <div><b>{branch.icon} {branch.name}</b></div>
            {#if branch.desc}<FactLines text={branch.desc} />{/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <div class="panel"><p class="dim">No ability this run.</p></div>
{/each}

<!-- Shadow Clone (systems/clones.ts): who is working where, and the way back. -->
{#if cloneRules(gs)}
  <div class="panel ability">
    <h3>Clones at work</h3>
    {#if gs.clones?.length}
      <div class="rows">
        {#each gs.clones as c (c.order)}
          <div class="row">
            <div class="head">
              <span>👥 {cloneTask(c)} · {SPOTS[c.spot]?.name ?? c.spot}</span>
              <button class="small" onclick={() => game.recallClone(c.order)}>Recall</button>
            </div>
            {#if c.bench}
              <div class="small dim">Next craft in {Math.max(0, Math.ceil(c.bench.ticksLeft / 10))} s</div>
            {/if}
          </div>
        {/each}
      </div>
      <div class="facts">
        <FactLines
          text={`Reach: They stop when you are more than ${cloneReach(gs)} floors away. Threshold is floor 0.`}
        />
      </div>
      <button class="small" onclick={() => game.recallClones()}>Recall all</button>
    {:else}
      <p class="small dim">None out. Send one from a job, gathering or a bench.</p>
    {/if}
  </div>
{/if}

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
  .facts {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  h2 + .rows,
  .facts + .rows {
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
  .act {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 4px;
  }
</style>
