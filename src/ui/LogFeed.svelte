<script lang="ts">
  import { gs } from './state.svelte';

  const KIND_COLORS: Record<string, string> = {
    combat: '#e0a1a1',
    danger: '#ff6b6b',
    loot: '#e8b84b',
    item: '#e8b84b',
    skill: '#b58fe0',
    achievement: '#ffd700',
    fusion: '#ff9d3c',
    quest: '#e0cd7d',
    travel: '#7db4e0',
    explore: '#7de0c3',
    action: '#9aa4ad',
    info: '#9aa4ad',
  };

  // Newest first.
  const entries = $derived([...gs.log].reverse());
</script>

<div class="panel log">
  <h3>Log</h3>
  <div class="entries small">
    {#each entries as entry}
      <div class="entry" style="color: {KIND_COLORS[entry.kind] ?? 'var(--text)'}">{entry.msg}</div>
    {/each}
    {#if entries.length === 0}
      <div class="dim">Your story begins...</div>
    {/if}
  </div>
</div>

<style>
  .log {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .entries {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 0;
  }

  .entry {
    line-height: 1.35;
  }
</style>
