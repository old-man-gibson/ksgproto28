<script lang="ts">
  import { gs } from './state.svelte';
  import { logColor, logGlyph } from './lib/logKinds';
  import { viewport } from './lib/viewport.svelte';

  /**
   * The folded log: the newest line on one row, cut with an ellipsis, and the
   * Log button that opens the full log as a panel (LogDrawer.svelte). Docked
   * at the bottom of the main column (App.svelte). The button carries
   * `data-log-toggle` so the drawer's click-outside check leaves it to toggle.
   *
   * On the phone layout (docs/PHONE.md) the row is the button: a tap anywhere on
   * it opens the log, and the full line is in the drawer, not in a hover title.
   * BottomBar.svelte holds it there.
   */
  let { open, ontoggle }: { open: boolean; ontoggle: () => void } = $props();

  const newest = $derived(gs.log.length > 0 ? gs.log[gs.log.length - 1] : null);
  const ink = $derived(newest ? logColor(newest.kind) : 'var(--text-dim)');
</script>

{#if viewport.phone}
  <button class="log-ticker log-ticker-row" class:log-ticker-on={open} data-log-toggle aria-expanded={open} onclick={ontoggle}>
    <span class="log-ticker-glyph" aria-hidden="true" style="color: {ink}">{newest ? logGlyph(newest.kind) : ''}</span>
    <span class="log-ticker-line" style="color: {ink}">{newest ? newest.msg : 'No log entries yet.'}</span>
    <span class="log-ticker-label">Log {open ? '▾' : '▴'}</span>
  </button>
{:else}
  <div class="log-ticker">
    <span class="log-ticker-glyph" aria-hidden="true" style="color: {ink}">
      {newest ? logGlyph(newest.kind) : ''}
    </span>
    <span class="log-ticker-line" style="color: {ink}" title={newest?.msg}>
      {newest ? newest.msg : 'No log entries yet.'}
    </span>
    <button
      class="log-ticker-button"
      class:log-ticker-on={open}
      data-log-toggle
      aria-expanded={open}
      title="Open the full log. Escape, this button or a click outside closes it."
      onclick={ontoggle}
    >
      Log
    </button>
  </div>
{/if}

<style>
  /* Sticky to the foot of the window: at 1100px and below the page scrolls and
     main is not a scroll container, so without this the row sits at the end of
     the page. Above that it sits at the foot of main and sticking does
     nothing. Solid background, so content scrolls under it unseen. Layer 3:
     under the tutorial card (4), over the panels' own layers (2 to 3 earlier
     in the page). */
  .log-ticker {
    position: sticky;
    bottom: 0;
    z-index: 3;
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 3px 4px 3px 10px;
    background: var(--bg-panel);
    border: 1px solid var(--frame, var(--border));
    font-size: 13px;
  }

  /* A fixed-width gutter, as in the open log: the kind's glyph never moves the line. */
  .log-ticker-glyph {
    flex: none;
    width: 1.3em;
    margin-right: -6px;
    text-align: center;
  }

  .log-ticker-line {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .log-ticker-button {
    flex: none;
    padding: 1px 12px;
    font-size: 12.5px;
  }

  .log-ticker .log-ticker-button.log-ticker-on {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* The phone's row: one 44px button across the block, text left, label right.
     The extra class beats the global button rules (app.css, the themes). */
  .log-ticker.log-ticker-row {
    width: 100%;
    min-height: 44px;
    padding: 0 calc(10px + var(--safe-right)) 0 calc(10px + var(--safe-left));
    border-radius: 0;
    text-align: left;
    background: var(--bg-panel);
    color: var(--text);
    font-size: 13px;
  }

  .log-ticker-label {
    flex: none;
    color: var(--text-dim);
    font-size: 12.5px;
  }

  .log-ticker-row.log-ticker-on .log-ticker-label {
    color: var(--accent);
  }
</style>
