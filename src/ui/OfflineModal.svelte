<script lang="ts">
  import type { OfflineSummary } from '../core/save/offline';
  import { ATTRIBUTE_LIST } from '../core/data/attributes.data';
  import { MS_PER_TICK } from '../core/engine/loop';
  import { fmt, msToTime } from './lib/format';

  let { summary, onclose }: { summary: OfflineSummary; onclose: () => void } = $props();

  function attrName(id: string): string {
    return ATTRIBUTE_LIST.find((a) => a.id === id)?.name ?? id;
  }
</script>

<div
  class="overlay"
  role="presentation"
  onclick={(e) => e.target === e.currentTarget && onclose()}
>
  <div class="modal panel" role="dialog">
    <h2>⏳ Welcome back!</h2>
    <p class="dim">
      While you were away for {msToTime(summary.ms)}{summary.capped ? ' (capped at 8h)' : ''}:
    </p>
    <ul>
      {#if summary.kills > 0}<li>☠️ Defeated <b>{fmt(summary.kills)}</b> monsters</li>{/if}
      {#if summary.goldGained > 0}<li>🪙 Earned <b>{fmt(summary.goldGained)}</b> gold</li>{/if}
      {#if summary.itemsGained > 0}<li>📦 Found <b>{summary.itemsGained}</b> items</li>{/if}
      {#each summary.attrLevels as a}
        <li>📈 {attrName(a.attr)} +{a.gained} levels</li>
      {/each}
      {#each summary.skillLevels as s}
        <li>📜 {s.name} +{s.gained} levels</li>
      {/each}
      {#if summary.festivalSkipped}
        <!-- The festival's clock runs only while the game does: that part of the absence did not happen. -->
        <li>
          🎪 The Vermin Festival held you for {msToTime(summary.festivalSkipped * MS_PER_TICK)}: not simulated.
          {#if summary.festivalBanked}{msToTime(summary.festivalBanked * MS_PER_TICK)} of it went to banked bonus time (⏩){summary.festivalBanked < summary.festivalSkipped ? '; the bank is full' : ''}.{:else}The bonus-time bank is full, so none of it was banked.{/if}
        </li>
      {:else if summary.kills === 0 && summary.goldGained <= 0 && summary.itemsGained === 0 && summary.attrLevels.length === 0 && summary.skillLevels.length === 0}
        <li class="dim">Not much happened — pick an activity before you leave next time!</li>
      {/if}
    </ul>
    <button onclick={onclose}>Continue</button>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 60%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .modal {
    max-width: 420px;
    width: 90%;
  }

  ul {
    margin: 10px 0 16px;
    padding-left: 20px;
    line-height: 1.7;
  }
</style>
