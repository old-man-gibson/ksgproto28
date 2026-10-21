<script lang="ts">
  import { gs } from '../state.svelte';
  import { fightsKey } from '../../core/systems/combat';
  import type { SpotDef } from '../../core/types';

  /**
   * A spot's fight budget (`fightLimit`) as a row of pips: the fights won,
   * the next one pulsing, and the whole row turning green once cleared.
   */
  let { spot }: { spot: SpotDef } = $props();

  const limit = $derived(spot.fightLimit ?? 0);
  const won = $derived(Math.min(limit, gs.stats[fightsKey(spot.id)] ?? 0));
  const cleared = $derived(won >= limit);
</script>

{#if limit > 0}
  <div class="raid" class:cleared title="{won}/{limit} fights won">
    <span class="pips">
      {#each Array.from({ length: limit }, (_, i) => i) as i (i)}
        <span class="pip" class:won={i < won} class:next={i === won && !cleared}></span>
      {/each}
    </span>
    <span class="label">
      {#if cleared}✔ Cleared{:else}{won}/{limit}{/if}
    </span>
  </div>
{/if}

<style>
  .raid {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, #000 55%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    backdrop-filter: blur(3px);
    font-size: 12px;
    white-space: nowrap;
  }
  .raid.cleared {
    border-color: color-mix(in srgb, var(--xp) 60%, transparent);
  }
  .pips {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .pip {
    width: 10px;
    height: 10px;
    transform: rotate(45deg);
    border: 1.5px solid color-mix(in srgb, var(--accent) 60%, transparent);
    background: color-mix(in srgb, #000 40%, transparent);
  }
  .pip.won {
    background: var(--accent);
    box-shadow: 0 0 6px color-mix(in srgb, var(--accent) 70%, transparent);
  }
  .cleared .pip.won {
    background: var(--xp);
    border-color: var(--xp);
    box-shadow: 0 0 6px color-mix(in srgb, var(--xp) 70%, transparent);
  }
  .pip.next {
    animation: next 1.2s ease-in-out infinite;
  }
  @keyframes next {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 60%, transparent); }
    50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 0%, transparent); }
  }
  .label {
    color: var(--text);
    font-weight: 600;
  }
  .cleared .label {
    color: var(--xp);
  }
  @media (prefers-reduced-motion: reduce) {
    .pip.next {
      animation: none;
    }
  }
</style>
