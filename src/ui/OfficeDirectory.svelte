<script lang="ts">
  import { gs, game } from './state.svelte';
  import { SPOTS } from '../core/registry';
  import { hasKeyItem } from '../core/systems/keyitems';
  import { visibleEdges } from '../core/systems/locations';
  import { conditionsMet } from '../core/systems/conditions';
  import { spotCleared } from '../core/systems/combat';
  const rooms = ['f1_registry', 'f1_scribe', 'f1_auditor', 'f1_break_room', 'f1_dispatch', 'f1_records', 'f1_reception', 'f1_supplies', 'f1_toll_hall'];
  const edges = $derived(visibleEdges(gs, gs.spot));
  const busy = $derived(!!gs.travel || gs.recovering || !!gs.combat?.forced);
</script>

<h3>Office section</h3>
<p class="dim small">Follow the daybook’s sequence of named rooms. You can explore other rooms; only the collector’s doorway loops back to reception when the sequence is wrong.</p>
{#if !hasKeyItem(gs, 'toll_office_key')}
  <p>🔒 Explore reception to find the office key and open the doors.</p>
{/if}
<div class="office-directory">
  {#each rooms as id}
    {@const room = SPOTS[id]}
    {@const edge = edges.find((e) => e.to === id)}
    <button class:selected={gs.spot === id}
      disabled={busy || gs.spot === id || !edge || !conditionsMet(gs, edge.requires ?? [])}
      onclick={() => game.travelTo(id)}>
      {room.icon} {room.name}
      {#if gs.spot === id}<small>You are here</small>{/if}
      {#if room.forced && !spotCleared(gs, room)}<small>⚔️ No retreat once reached</small>{/if}
    </button>
  {/each}
</div>

<style>
  .office-directory { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 12px 0; }
  .office-directory button { min-height: 76px; white-space: normal; }
  .office-directory small { display: block; margin-top: 5px; }
</style>
