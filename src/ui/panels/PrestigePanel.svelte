<script lang="ts">
  import { gs, game, ui } from '../state.svelte';
  import { PRESTIGE_UNLOCK } from '../../core/registry';
  import { canPrestige, forecast, harvest, unitText } from '../../core/systems/prestige';
  import { boughtBoons } from '../../core/systems/legacy';
  import { termsText } from '../lib/format';
  import { forgetLayouts } from '../lib/benchLayouts';
  import PrestigeBoons from '../lib/PrestigeBoons.svelte';

  // The PRE-prestige view: what a prestige pays right now (the same function
  // that will pay it), how far each source is from its next point, the
  // button, and — once any run has prestiged — what the points bought.
  const report = $derived(harvest(gs));
  const next = $derived(forecast(gs));
  const ready = $derived(canPrestige(gs));
  const bought = $derived(boughtBoons(gs));

  // Ending the run is the one irreversible click in the game: two steps.
  let arming = $state(false);
  function prestige() {
    if (!arming) {
      arming = true;
      return;
    }
    arming = false;
    if (game.prestige()) {
      // The stock the benches' remembered layouts name went with the run.
      forgetLayouts();
      ui.tab = 'location';
    }
  }
</script>

<div class="panel">
  <h2>♻️ Prestige {report.ordinal}</h2>
  <p class="dim small">
    Ends the run. Everything resets except prestige points and what they bought.
    Harvest pays whole points per source; the remainder carries nowhere.
  </p>

  <h3>Harvest now: {report.total} point{report.total === 1 ? '' : 's'}</h3>
  <table>
    <tbody>
      {#each report.lines as line (line.id)}
        {@const ahead = next.find((n) => n.id === line.id)}
        <tr>
          <td>{line.icon} {line.name}</td>
          <td class="num">+{line.points}</td>
          <td class="dim small">{line.detail}</td>
          <td class="dim small">
            {#if ahead}+1 at {unitText(ahead.need, ahead.unit)} more{/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  <div class="row">
    {#if ready}
      <button class:danger={arming} onclick={prestige}>
        {arming ? `Confirm: end the run for ${report.total} point${report.total === 1 ? '' : 's'}` : 'Prestige'}
      </button>
      {#if arming}<button class="small" onclick={() => (arming = false)}>Cancel</button>{/if}
    {:else}
      <span class="dim small">🔒 Opens when you: {termsText(PRESTIGE_UNLOCK, gs)}.</span>
    {/if}
  </div>
</div>

{#if gs.prestige.count > 0}
  <div class="panel">
    <h2>Points: {gs.prestige.points} unspent</h2>
    <p class="dim small">
      {gs.prestige.count} prestige{gs.prestige.count === 1 ? '' : 's'} so far.
      {#if bought.length === 0}Nothing bought yet.{:else}Bought: {bought.map((b) => `${b.def.name} ${b.rank}`).join(', ')}.{/if}
    </p>
    <PrestigeBoons />
  </div>
{/if}

<style>
  table {
    border-collapse: collapse;
    margin-bottom: 10px;
  }
  td {
    padding: 2px 10px 2px 0;
    vertical-align: top;
  }
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .danger {
    border-color: #c44;
  }
</style>
