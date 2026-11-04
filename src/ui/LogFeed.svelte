<script lang="ts">
  import { gs } from './state.svelte';
  import Tip from './lib/Tip.svelte';
  import { hiddenLabels } from '../core/systems/log';
  import { logColor } from './lib/logKinds';

  /**
   * The full log. It sits in the right column (App.svelte) while the log is
   * open and inside the drawer (LogDrawer.svelte) while it is folded. `actions`
   * are the small buttons in its header: Fold in the column, Dock and Close in
   * the drawer. None while floor 0 runs.
   */
  let {
    actions = [],
  }: { actions?: { label: string; title: string; run: () => void }[] } = $props();

  // Newest first. A folded line shows its first labels; the ones it cut are
  // listed in a tooltip. The block below is keyed by the entry object, which
  // stays the same object while the line folds and while newer lines push it
  // down, so a tooltip opened on a line stays on that line.
  const entries = $derived([...gs.log].reverse().map((entry) => ({ entry, rest: hiddenLabels(entry) })));
</script>

<div class="panel log">
  <div class="log-head">
    <h3>Log</h3>
    {#each actions as action (action.label)}
      <button class="log-action" title={action.title} onclick={action.run}>{action.label}</button>
    {/each}
  </div>
  <div class="entries small">
    {#each entries as { entry, rest } (entry)}
      <div class="entry" style="color: {logColor(entry.kind)}">
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

  .log-head {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 8px;
  }

  .log-head h3 {
    flex: 1;
    margin: 0;
  }

  .log-action {
    padding: 1px 8px;
    font-size: 12px;
    color: var(--text-dim);
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
