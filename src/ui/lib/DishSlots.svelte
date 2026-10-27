<script lang="ts">
  import { game, gs } from '../state.svelte';
  import { dishHeading, dishRows, queuedRow } from './meals';
  import Tip from './Tip.svelte';

  /**
   * The dishes in their slots, and the dish waiting for the end of the fight
   * (systems/meals.ts, eating.ts). Hidden while neither exists. Reads `gs`
   * directly: the times count down with the conditions they are read from.
   */
  const rows = $derived(dishRows(gs));
  const queued = $derived(queuedRow(gs));
</script>

{#if rows.length > 0 || queued}
  <div class="dishes">
    {#if rows.length > 0}
      <div class="dishes-head">{dishHeading(gs)}</div>
      {#each rows as row (row.dish)}
        <Tip block>
          <div class="dish">
            <span class="dish-icon" aria-hidden="true">{row.icon}</span>
            <span class="dish-name">{row.name}</span>
            <span class="dish-time">{row.time}</span>
          </div>
          {#snippet tip()}
            <div class="tip-line tip-base">{row.icon} {row.name}</div>
            {#each row.conditions as line (line)}
              <div class="tip-line">{line}</div>
            {/each}
            {#if row.replacedFirst}
              <div class="tip-line tip-sub">Least time left: the next new dish replaces this one.</div>
            {/if}
          {/snippet}
        </Tip>
      {/each}
    {/if}
    {#if queued}
      <div class="queued">
        <span>{queued.label}</span>
        <div class="queued-row">
          <span class="queued-name">{queued.icon} {queued.name}</span>
          <button class="small" onclick={() => game.cancelQueuedMeal()}>Cancel</button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .dishes {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 6px;
    padding: 5px 8px 6px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-sunken);
    font-size: 0.78rem;
  }

  .dishes-head {
    font-weight: 600;
    color: var(--text-dim);
  }

  .dish {
    display: flex;
    align-items: baseline;
    gap: 5px;
    min-width: 0;
  }

  .dish-icon {
    flex: none;
  }

  .dish-name {
    flex: 1 1 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dish-time {
    flex: none;
    font-variant-numeric: tabular-nums;
    color: var(--text-dim);
  }

  .queued {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-top: 3px;
    border-top: 1px dashed var(--border);
    color: var(--text-dim);
  }

  .queued-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .queued-name {
    flex: 1 1 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
    color: var(--accent);
  }

  .queued button {
    flex: none;
    padding: 1px 8px;
  }
</style>
