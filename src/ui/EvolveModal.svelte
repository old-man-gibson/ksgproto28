<script lang="ts">
  import { gs, game } from './state.svelte';
  import { TPS } from '../core/engine/loop';
  import { msToTime } from './lib/format';
  import type { EvolutionChoice } from '../core/facet/host';
  import type { FacetDoc } from '../core/facet/facet';
  import FactLines from './lib/FactLines.svelte';

  /**
   * The run's ability evolving (facet/host.ts `pendingEvolution`). Save state,
   * not UI state: the offer is written onto the ability's saved document, so a
   * reload brings it back. No backdrop click and no Escape — play is held
   * until a branch is picked, and the held time is banked as bonus time.
   */
  let { from, choices }: { from: FacetDoc; choices: EvolutionChoice[] } = $props();

  const banked = $derived(msToTime((gs.bonusTime.banked / TPS) * 1000));
</script>

<div class="overlay" role="presentation">
  <div class="modal panel" role="dialog" aria-modal="true" aria-labelledby="evolve-title">
    <h2 id="evolve-title">⏸️ {from.reading?.icon} {from.reading?.name} evolves</h2>
    <p class="small dim">Pick 1 branch. Progress carries over. The pick is final for this run.</p>

    {#each choices as c (c.key)}
      <div class="branch">
        <div><b>{c.icon} {c.name}</b></div>
        <FactLines text={c.desc} />
        <div><button onclick={() => game.chooseEvolution(c.key)}>Take {c.name}</button></div>
      </div>
    {/each}

    <p class="small dim">Play is paused until you pick. Paused time goes to bonus time: ⏩ {banked}.</p>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 70%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 30;
    padding: 16px;
  }
  .modal {
    width: 560px;
    max-width: 100%;
    max-height: 88vh;
    overflow: auto;
  }
  .branch {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    margin-bottom: 8px;
  }
</style>
