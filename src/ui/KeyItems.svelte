<script lang="ts">
  import { gs } from './state.svelte';
  import { KEY_ITEMS } from '../core/data/keyitems.data';
  import { hasKeyItem } from '../core/systems/keyitems';
  const owned = $derived(Object.values(KEY_ITEMS).filter((item) => hasKeyItem(gs, item.id)));
</script>

{#if owned.length}
  <div class="panel" style="margin-top: 12px">
    <h3>Key items</h3>
    {#each owned as item (item.id)}
      <details>
        <summary>{item.icon} {item.name}</summary>
        <p>{item.desc}</p>
      </details>
    {/each}
  </div>
{/if}
