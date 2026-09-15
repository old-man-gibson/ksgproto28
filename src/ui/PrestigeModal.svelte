<script lang="ts">
  import { gs, game } from './state.svelte';
  import PrestigeBoons from './lib/PrestigeBoons.svelte';

  // The POST-prestige overlay. No backdrop click, no Escape: it closes only
  // once a point has been spent, or through the two-step leave below. The
  // "owed" flag is save state (gs.prestige.review), so a reload brings it back.
  const report = $derived(gs.prestige.lastHarvest);
  const spent = $derived(gs.prestige.spentThisReview > 0);
  let confirming = $state(false);

  function leave() {
    if (spent || confirming) {
      confirming = false;
      game.leavePrestigeReview();
      return;
    }
    confirming = true;
  }
</script>

<div class="overlay" role="presentation">
  <div class="modal panel" role="dialog" aria-modal="true" aria-labelledby="prestige-title">
    <h2 id="prestige-title">♻️ Prestige {gs.prestige.count} complete</h2>
    {#if report}
      <p class="dim small">Harvested {report.total} point{report.total === 1 ? '' : 's'}:</p>
      <ul>
        {#each report.lines as line (line.id)}
          <li>{line.icon} {line.name}: <b>+{line.points}</b> <span class="dim small">({line.detail})</span></li>
        {/each}
      </ul>
    {/if}
    <h3>{gs.prestige.points} point{gs.prestige.points === 1 ? '' : 's'} to spend</h3>
    <PrestigeBoons />
    <div class="row">
      <button onclick={leave}>
        {#if spent}
          Continue
        {:else if confirming}
          Confirm: leave with {gs.prestige.points} point{gs.prestige.points === 1 ? '' : 's'} unspent
        {:else}
          Leave without spending
        {/if}
      </button>
      {#if confirming && !spent}<button class="small" onclick={() => (confirming = false)}>Back</button>{/if}
      {#if !spent && !confirming && gs.prestige.points > 0}
        <span class="dim small">Spend one point, or confirm leaving. Unspent points keep; the Prestige tab sells the same list.</span>
      {/if}
    </div>
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
    width: 720px;
    max-width: 100%;
    max-height: 88vh;
    overflow: auto;
  }
  ul {
    margin: 4px 0 10px;
    padding-left: 20px;
  }
  .row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 12px;
    flex-wrap: wrap;
  }
</style>
