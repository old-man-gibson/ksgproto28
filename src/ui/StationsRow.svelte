<script lang="ts">
  import { gs, game, view } from './state.svelte';
  import GoButton from './lib/GoButton.svelte';
  import { legTime, returnLine, stayLabel, stations } from './lib/navigation';
  import { tutorialScreen } from './lib/tutorialFocus';

  /**
   * The Stations row (docs/NAVIGATION.md §3.6): above the map, the places the
   * character has worked at, newest first. One click on a station walks (or
   * rides) there and starts the work on arrival (`goAndDo`, through GoButton,
   * so its tooltip and its disabled rules apply). With a knockout return in
   * flight the row shows that return as one line with a "Stay here" button, and
   * does not offer the return's target.
   *
   * The row is one line of one fixed height in every state, so nothing below it
   * moves when a station appears, a return starts or a walk begins. A row too
   * long for the column scrolls sideways inside itself.
   *
   * Floor 0's tutorial hides it, as it hides the region tabs and the map's
   * fold: the screen shows only what the current step points at.
   */
  const tutorial = $derived(!!tutorialScreen(gs));
  const list = $derived(tutorial ? [] : stations(gs, view.stats.travelSpeed));
  const line = $derived(returnLine(gs));

  // A row wider than the column scrolls sideways (the scrollbar, shift+wheel, a
  // trackpad, a swipe, keyboard focus). The wheel is not taken over: a vertical
  // wheel over the row scrolls the page.
  let scroller = $state<HTMLElement | null>(null);

  // What the row is showing: a return, a walk, stations or nothing. When that
  // changes the row starts from its left end again, so "Back" and "Stay here"
  // are where the eye expects them rather than where an earlier scroll left them.
  const mode = $derived(`${line ? 'return' : ''}:${gs.travel ? 'walk' : list.length ? 'list' : 'none'}`);
  $effect(() => {
    void mode;
    if (scroller) scroller.scrollLeft = 0;
  });
</script>

{#if !tutorial}
  <div class="panel stations-row" role="group" aria-label="Stations">
    <div class="st-scroll" bind:this={scroller}>
      {#if line}
        <div class="st-return">
          <span class="st-cap">Return</span>
          <span class="st-line">{line}</span>
          <button class="small st-stay" onclick={() => game.stayHere()}>{stayLabel(gs)}</button>
        </div>
      {/if}
      {#if gs.travel}
        <span class="st-note dim">Stations open on arrival.</span>
      {:else if list.length}
        {#each list as st, i (st.spot)}
          <!-- The newest is "Back"; with a return in flight the row has no "Back", the return owns it. -->
          {#if i === 0 && !line}
            <span class="st-cap">Back</span>
          {:else if i === (line ? 0 : 1)}
            <span class="st-cap">Stations</span>
          {/if}
          <GoButton spot={st.spot} activity={st.activity} class={i === 0 && !line ? 'station back' : 'station'}>
            {#snippet children()}
              <span class="st-what">{st.what} · {st.place}</span>
              <span class="st-time">{legTime(st.ticks)}{st.noExit ? ' ⚔️' : ''}{st.oneWay ? ' ⤵' : ''}</span>
            {/snippet}
          </GoButton>
        {/each}
      {:else if !line}
        <span class="st-note dim">No stations. A place where you start work is listed here once you leave it.</span>
      {/if}
    </div>
  </div>
{/if}

<style>
  .stations-row {
    padding: 0 10px;
    margin-bottom: 12px;
  }

  /*
   * One line, 42 px, in every state. A station is never cut: a row too long for
   * the column scrolls sideways inside itself. The scrollbar is thin and takes
   * the room under the buttons, which the row reserves whether or not it shows,
   * and the buttons are pinned to the top, so a scrollbar appearing moves
   * nothing: not the row, not the page, not the buttons.
   */
  .st-scroll {
    display: flex;
    flex-wrap: nowrap;
    align-items: flex-start;
    gap: 8px;
    height: 42px;
    padding-top: 6px;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }

  /* Letter-spaced capitals; a theme with a caps face sets --font-caps. */
  .st-cap {
    flex: none;
    font-family: var(--font-caps, inherit);
    font-size: 11.5px;
    line-height: 26px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  .st-cap:not(:first-child) {
    margin-left: 6px;
  }

  /*
   * The return: its caption, its line and its button, as one cell. The cell
   * never shrinks for the stations after it (it is `flex: none`, so a long row
   * of stations scrolls instead of squeezing it); it is capped at the width of
   * the column, and only then does its line give up width.
   */
  .st-return {
    flex: none;
    max-width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  /*
   * 34 em wide, so the wins and the minutes counting down never move what
   * follows. In a column too narrow for the whole cell it gives up width, down
   * to 10 em, before the button beside it does.
   */
  .st-line {
    width: 34em;
    flex: 0 1 auto;
    min-width: 10em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12.5px;
    line-height: 26px;
    color: var(--accent);
  }

  .st-stay {
    flex: none;
    height: 26px;
    padding: 0 10px;
    line-height: 1;
  }

  .st-note {
    flex: none;
    white-space: nowrap;
    font-size: 12.5px;
    line-height: 26px;
  }

  /* GoButton's own button: the extra classes come in through its `class` prop. */
  .st-scroll :global(.station) {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 26px;
    padding: 0 10px;
    line-height: 1;
  }

  /* The newest station is marked; a disabled one (knocked out, walking) loses the mark like any disabled button. */
  .st-scroll :global(.station.back:not(:disabled)) {
    border-color: var(--accent);
  }

  .st-what {
    white-space: nowrap;
  }

  .st-time {
    flex: none;
    color: var(--text-dim);
  }
</style>
