<script lang="ts">
  import { gs, ui } from './state.svelte';
  import { isNewEntry, navMark, type NavRow } from './lib/nav';
  import Icon from './lib/icons/Icon.svelte';
  import LogTicker from './LogTicker.svelte';

  /**
   * The phone layout's bottom block (docs/PHONE.md), sticky to the foot of the
   * window: the folded log's newest line (a tap opens the log drawer) and, under
   * it, the screens the player may open, scrolling sideways. The entries are the
   * ones the left column lists on a wider screen (`visibleNav`, lib/nav.ts), so
   * the two cannot disagree; one entry is no choice and draws no row, as there.
   *
   * It carries the page's bottom safe-area inset. Its height is published as
   * `--bottombar-h` on the page, which the log drawer reads.
   *
   * The entry classes are the left column's (`nav-list`, `nav-entry`, `nav-on`):
   * the display themes colour the open screen by them. The shape is this file's.
   */
  let {
    entries,
    showNav,
    logOpen,
    ontogglelog,
  }: { entries: readonly NavRow[]; showNav: boolean; logOpen: boolean; ontogglelog: () => void } = $props();

  let el: HTMLElement;
  let row = $state<HTMLElement>();

  $effect(() => {
    const root = document.documentElement;
    const publish = () => root.style.setProperty('--bottombar-h', `${el.offsetHeight}px`);
    publish();
    const watch = new ResizeObserver(publish);
    // Border box: a change in the safe-area padding is a change in height.
    watch.observe(el, { box: 'border-box' });
    return () => {
      watch.disconnect();
      root.style.removeProperty('--bottombar-h');
    };
  });

  // The open screen stays in view in the row, whichever way it was opened (a map card's link, the tutorial's pointer).
  $effect(() => {
    void ui.tab;
    row?.querySelector('[aria-current="page"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  });
</script>

<div class="bottombar" bind:this={el}>
  <LogTicker open={logOpen} ontoggle={ontogglelog} />
  {#if showNav}
    <nav class="nav-list tabs-row" aria-label="Screens" bind:this={row}>
      {#each entries as entry (entry.id)}
        {@const mark = navMark(entry, gs)}
        {@const fresh = isNewEntry(entry, ui.navSeen)}
        <button
          class="nav-entry"
          class:nav-on={ui.tab === entry.id}
          aria-current={ui.tab === entry.id ? 'page' : undefined}
          onclick={() => (ui.tab = entry.id)}
        >
          <Icon of={entry} size={16} />
          <span class="entry-label">{entry.label}</span>
          {#if fresh}
            <span class="entry-badge entry-new">new</span>
          {:else if mark}
            <!-- "2 ready": the count rides on the entry, the words are in the label for a screen reader. -->
            <span class="entry-badge entry-mark" aria-label={mark}>{mark.split(' ')[0]}</span>
          {/if}
        </button>
      {/each}
    </nav>
  {/if}
</div>

<style>
  .bottombar {
    position: sticky;
    bottom: 0;
    z-index: 6;
    order: 3;
    margin-top: auto;
    display: flex;
    flex-direction: column;
    background: var(--bg-panel);
    border-top: 1px solid var(--border);
    padding-bottom: var(--safe-bottom);
  }

  /* The sticky ticker of the desktop layout would stick twice here: it rides in this block. */
  .bottombar :global(.log-ticker) {
    position: static;
    border-width: 0 0 1px;
  }

  /* A row of fixed-height entries: the icon over the name. It scrolls sideways
     and hides its scrollbar; the entry cut off at the edge says there is more. */
  .tabs-row {
    display: flex;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    padding: 0 var(--safe-right) 0 var(--safe-left);
  }

  .tabs-row::-webkit-scrollbar {
    display: none;
  }

  /* The two class names beat the global button rules (app.css and each theme's)
     on specificity, as in NavIndex. The left border is the themes' marker for
     the open screen; with no border drawn here, the fill and the bar on top say it. */
  .tabs-row .nav-entry {
    position: relative;
    flex: 0 0 auto;
    min-width: 68px;
    min-height: 52px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 4px 10px;
    background: none;
    border: 0;
    border-radius: 0;
    color: var(--text);
    font-size: 12px;
    line-height: 1.1;
  }

  .tabs-row .nav-entry.nav-on {
    background: var(--bg-raised);
    color: var(--accent);
    box-shadow: inset 0 3px 0 var(--accent);
  }

  .entry-label {
    white-space: nowrap;
  }

  .entry-badge {
    position: absolute;
    top: 2px;
    right: 4px;
    font-size: 10px;
    line-height: 1;
    padding: 1px 3px;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    white-space: nowrap;
  }

  .entry-new {
    color: var(--xp-ink);
  }

  .entry-mark {
    color: var(--accent);
  }
</style>
