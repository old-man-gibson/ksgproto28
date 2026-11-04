<script lang="ts">
  import { gs, ui } from './state.svelte';
  import { isNewEntry, navMark, navSections, type NavRow } from './lib/nav';
  import Icon from './lib/icons/Icon.svelte';

  /**
   * The screen list in the left column (lib/nav.ts). It replaced the tab rows:
   * one entry per visible screen, in Act, Build and Records groups. The caller
   * decides whether the list is drawn at all (`navListShown`), so this renders
   * whatever it is given. An entry that became visible and was never opened
   * reads "new"; an entry's `mark` (the quests ready to turn in) reads as text.
   */
  let { entries }: { entries: readonly NavRow[] } = $props();

  const sections = $derived(navSections(entries));
</script>

<nav class="panel nav-list" aria-label="Screens">
  {#each sections as section (section.group)}
    {#if section.caption}<div class="nav-caption">{section.caption}</div>{/if}
    {#each section.entries as entry (entry.id)}
      {@const mark = navMark(entry, gs)}
      {@const fresh = isNewEntry(entry, ui.navSeen)}
      <button
        class="nav-entry"
        class:nav-on={ui.tab === entry.id}
        aria-current={ui.tab === entry.id ? 'page' : undefined}
        onclick={() => (ui.tab = entry.id)}
      >
        <Icon of={entry} />
        <span class="nav-label">{entry.label}</span>
        {#if fresh || mark}
          <span class="nav-marks">
            {#if fresh}<span class="nav-new">new</span>{/if}
            {#if mark}<span class="nav-mark">{mark}</span>{/if}
          </span>
        {/if}
      </button>
    {/each}
  {/each}
</nav>

<style>
  .nav-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 8px;
  }

  /* Letter-spaced capitals; a theme with a caps face sets --font-caps. */
  .nav-caption {
    font-family: var(--font-caps, inherit);
    font-size: 11.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-dim);
    border-bottom: 1px solid var(--frame, var(--border));
    padding: 8px 0 2px;
    margin-bottom: 2px;
  }

  .nav-caption:first-child {
    padding-top: 0;
  }

  /* Rows are flat list entries, not pills. The extra class beats the global
     button rules (app.css, and each theme's own) on specificity. */
  .nav-list .nav-entry {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 3px 6px;
    background: none;
    border: 0;
    border-left: 2px solid transparent;
    border-radius: 0;
    text-align: left;
    font-size: 15px;
    color: var(--text);
  }

  .nav-list .nav-entry:hover:not(:disabled) {
    background: var(--bg-hover);
  }

  .nav-list .nav-entry.nav-on {
    border-left-color: var(--accent);
    background: var(--bg-raised);
    color: var(--accent);
  }

  .nav-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nav-marks {
    margin-left: auto;
    display: flex;
    gap: 8px;
    font-size: 12.5px;
    white-space: nowrap;
  }

  .nav-new {
    color: var(--xp);
  }

  .nav-mark {
    color: var(--text-dim);
  }
</style>
