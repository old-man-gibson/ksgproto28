<script lang="ts">
  import { gs } from '../state.svelte';
  import { fightsKey } from '../../core/systems/combat';
  import type { SpotDef } from '../../core/types';

  /**
   * A nest's fight budget as a row of pips: won, the next, and — where the
   * spot has one — the finale's crown at the end. A streak spot draws its
   * pips as a chain, because breaking it drops every link at once.
   */
  let { spot, compact = false }: { spot: SpotDef; compact?: boolean } = $props();

  const limit = $derived(spot.fightLimit ?? 0);
  const won = $derived(Math.min(limit, gs.stats[fightsKey(spot.id)] ?? 0));
  const cleared = $derived(won >= limit);
  const finale = $derived(!!spot.encounters?.some((e) => e.finale));
</script>

{#if limit > 0}
  <div
    class="raid"
    class:compact
    class:streak={spot.streak}
    class:cleared
    title={spot.streak
      ? `${won}/${limit} in one push — leaving, resting or a knockout resets it`
      : `${won}/${limit} fights won`}
  >
    <span class="pips">
      {#each Array.from({ length: limit }, (_, i) => i) as i (i)}
        {@const last = finale && i === limit - 1}
        <span class="pip" class:won={i < won} class:next={i === won && !cleared} class:finale={last}>
          {#if last}👑{/if}
        </span>
      {/each}
    </span>
    <span class="label">
      {#if cleared}
        ✔ Cleared
      {:else if spot.streak}
        ⛓️ {won}/{limit} unbroken
      {:else}
        {won}/{limit}
      {/if}
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
  .raid.compact {
    background: var(--bg-raised);
    backdrop-filter: none;
  }
  .raid.cleared {
    border-color: color-mix(in srgb, var(--xp) 60%, transparent);
  }
  .pips {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    position: relative;
  }
  .streak .pips::before {
    /* The chain the streak's links hang on. */
    content: '';
    position: absolute;
    left: 4px;
    right: 4px;
    top: 50%;
    border-top: 2px dotted color-mix(in srgb, var(--accent) 45%, transparent);
  }
  .pip {
    position: relative;
    width: 10px;
    height: 10px;
    transform: rotate(45deg);
    border: 1.5px solid color-mix(in srgb, var(--accent) 60%, transparent);
    background: color-mix(in srgb, #000 40%, transparent);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
  }
  .streak .pip {
    border-radius: 50%;
    transform: none;
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
  .pip.finale {
    width: 18px;
    height: 18px;
    transform: none;
    border-radius: 50%;
    border-color: #ffd36b;
  }
  .pip.finale.won {
    background: #ffd36b;
  }
  .label {
    color: var(--text);
    font-weight: 600;
  }
  .cleared .label {
    color: var(--xp);
  }
</style>
