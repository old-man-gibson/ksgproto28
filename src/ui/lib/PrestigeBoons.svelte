<script lang="ts">
  import { gs, game } from '../state.svelte';
  import { PRESTIGE_BOONS } from '../../core/registry';
  import { boonRank } from '../../core/systems/legacy';
  import { canBuyBoon, nextBoonCost } from '../../core/systems/prestige';

  // The boon list — one component, used by the post-prestige overlay and the
  // pre-prestige tab, so what points buy reads the same in both places.
  const boons = Object.values(PRESTIGE_BOONS);
</script>

<div class="boons">
  {#each boons as boon (boon.id)}
    {@const rank = boonRank(gs, boon.id)}
    {@const cost = nextBoonCost(gs, boon.id)}
    <div class="boon" class:bought={rank > 0}>
      <div class="head">
        <span class="name">{boon.icon} {boon.name}</span>
        <span class="rank dim small">rank {rank} / {boon.cost.length}</span>
      </div>
      <div class="dim small">{boon.desc}</div>
      {#if boon.auto}
        <div class="dim small">Rank 1 is granted by the first prestige.</div>
      {/if}
      <div class="buy">
        {#if cost === null}
          <span class="dim small">max rank</span>
        {:else if cost === 0}
          <span class="dim small">free — arrives with the first prestige</span>
        {:else}
          <button class="small" disabled={!canBuyBoon(gs, boon.id)} onclick={() => game.buyBoon(boon.id)}>
            Buy rank {rank + 1} — {cost} point{cost === 1 ? '' : 's'}
          </button>
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .boons {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px;
  }
  .boon {
    border: 1px solid var(--border, #333);
    border-radius: 6px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .boon.bought {
    border-color: var(--accent, #8a6);
  }
  .head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .name {
    font-weight: 600;
  }
  .buy {
    margin-top: 4px;
  }
</style>
