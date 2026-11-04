<script lang="ts">
  import { gs } from './state.svelte';
  import Tip from './lib/Tip.svelte';
  import { hiddenLabels } from '../core/systems/log';

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

  // Newest first. A folded line shows its first labels; the ones it cut are
  // listed in a tooltip. The block below is keyed by the entry object, which
  // stays the same object while the line folds and while newer lines push it
  // down, so a tooltip opened on a line stays on that line.
  const entries = $derived([...gs.log].reverse().map((entry) => ({ entry, rest: hiddenLabels(entry) })));
</script>

<div class="panel log">
  <h3>Log</h3>
  <div class="entries small">
    {#each entries as { entry, rest } (entry)}
      <div class="entry" style="color: {KIND_COLORS[entry.kind] ?? 'var(--text)'}">
        {#if rest.length > 0}
          <Tip>
            {entry.msg}
            {#snippet tip()}
              <div class="rest-head">Also in this line:</div>
              {#each rest as label}
                <div>{label}</div>
              {/each}
            {/snippet}
          </Tip>
        {:else}
          {entry.msg}
        {/if}
      </div>
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

  .rest-head {
    color: var(--text-dim);
    margin-bottom: 2px;
  }
</style>
