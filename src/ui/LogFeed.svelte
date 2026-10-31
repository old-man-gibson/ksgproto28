<script lang="ts">
  import { gs } from './state.svelte';

  // Each colour is a token with its default as the fallback, so a theme can
  // repaint the log without touching this file (src/themes/).
  const KIND_COLORS: Record<string, string> = {
    combat: 'var(--log-combat, #e0a1a1)',
    danger: 'var(--log-danger, #ff6b6b)',
    loot: 'var(--log-loot, #e8b84b)',
    item: 'var(--log-loot, #e8b84b)',
    skill: 'var(--log-skill, #b58fe0)',
    achievement: 'var(--log-achievement, #ffd700)',
    fusion: 'var(--log-fusion, #ff9d3c)',
    quest: 'var(--log-quest, #e0cd7d)',
    travel: 'var(--log-travel, #7db4e0)',
    explore: 'var(--log-explore, #7de0c3)',
    action: 'var(--log-plain, #9aa4ad)',
    info: 'var(--log-plain, #9aa4ad)',
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
      <div class="dim">No log entries yet.</div>
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
