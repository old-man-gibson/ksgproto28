<script lang="ts">
  import { gs, game } from './state.svelte';
  import { TPS } from '../core/engine/loop';
  import { BONUS_CAP_TICKS } from '../core/systems/bonustime';
  import { fmt, msToTime } from './lib/format';
  import { dockParts } from './lib/shell';
  import type { TutorialScreen } from './lib/tutorialFocus';
  import JobStrip from './JobStrip.svelte';
  import SkyStrip from './SkyStrip.svelte';
  import SystemMenu from './SystemMenu.svelte';
  import ResourceBars from './panels/ResourceBars.svelte';
  import Tip from './lib/Tip.svelte';

  /**
   * The phone layout's top block (below 700px; docs/PHONE.md), sticky to the top
   * of the window. It is the header's content for a narrow screen, in rows of
   * fixed height:
   *
   * - Pause, the bonus toggle, the job block (what the character is doing, the
   *   cycle's bar, the gold and the rate line) and the Menu. The Menu also holds
   *   the step buttons a phone has no keys for.
   * - HP, then stamina, mana, spirit and focus as thin bars (ResourceBars.svelte).
   * - The sky line, while there is a sky to show (SkyStrip.svelte).
   *
   * Floor 0 follows the tutorial's screen like the header does (`dockParts`):
   * the bars from the first fight, the gold from the first kill, and the buttons
   * and the rate line after the tutorial. The block's height is published as
   * `--dock-h` on the page, which the tutorial card's sticky offset reads.
   *
   * The class is `dock`, never `bar`: app.css styles `.bar` globally
   * (docs/PITFALLS.md §8). It is a `header`, a child of `.layout`, so the display
   * themes' header rules (`.layout > header`) frame it like the desktop header.
   */
  let { screen, ondebug }: { screen: TutorialScreen | null; ondebug?: () => void } = $props();

  const parts = $derived(dockParts(screen));

  let el: HTMLElement;
  $effect(() => {
    const root = document.documentElement;
    const publish = () => root.style.setProperty('--dock-h', `${el.offsetHeight}px`);
    publish();
    const watch = new ResizeObserver(publish);
    // Border box: a change in the safe-area padding is a change in height.
    watch.observe(el, { box: 'border-box' });
    return () => {
      watch.disconnect();
      root.style.removeProperty('--dock-h');
    };
  });

  function toggleBonus(ev: MouseEvent) {
    game.setBonusSpending(!gs.bonusTime.spending);
    (ev.currentTarget as HTMLButtonElement).blur();
  }

  function togglePause(ev: MouseEvent) {
    game.togglePause();
    (ev.currentTarget as HTMLButtonElement).blur();
  }
</script>

<header class="dock" bind:this={el}>
  <div class="dock-main">
    {#if parts.controls}
      <!-- Pause freezes the whole world, not just the fight. The class names are
           the header's (`clock`, `pause`, `bonus`): the themes size the chips by them. -->
      <div class="clock">
        <Tip block>
          <button class="pause" class:on={gs.paused} aria-label={gs.paused ? 'Resume' : 'Pause'} onclick={togglePause}>
            {gs.paused ? '▶️' : '⏸️'}
          </button>
          {#snippet tip()}
            <div class="tip-line tip-base">{gs.paused ? 'Resume' : 'Pause'}</div>
            <div class="tip-line">Freezes the whole world: activities, benches, travel and all.</div>
          {/snippet}
        </Tip>
        <Tip block>
          <button class="bonus" class:on={gs.bonusTime.spending} onclick={toggleBonus}>
            ⏩ {msToTime((gs.bonusTime.banked / TPS) * 1000)}
          </button>
          {#snippet tip()}
            <div class="tip-line tip-base">Bonus time: {gs.bonusTime.spending ? 'on, 2× speed' : 'off'}</div>
            <div class="tip-line">Banked 1:1 while nothing runs (no activity, travel, bench, performance, fight). Cap {msToTime((BONUS_CAP_TICKS / TPS) * 1000)}.</div>
            <div class="tip-line">While on, every working tick runs twice and spends one banked tick.</div>
          {/snippet}
        </Tip>
      </div>
    {/if}

    <div class="dock-job">
      <JobStrip compact showRate={parts.controls}>
        {#snippet lead()}
          {#if parts.gold}<span class="gold">🪙 {fmt(gs.gold)}</span>{/if}
        {/snippet}
      </JobStrip>
    </div>

    <div class="actions small">
      {#if parts.controls}<SystemMenu />{/if}
      {#if ondebug}<button class="dev" onclick={ondebug} title="Developer tools">🐞</button>{/if}
    </div>
  </div>

  {#if parts.bars}<ResourceBars mode="dock" />{/if}
  {#if parts.controls}<SkyStrip />{/if}
</header>

<style>
  .dock {
    position: sticky;
    top: 0;
    z-index: 6;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-top-width: 0;
    border-radius: 0 0 10px 10px;
    padding: calc(6px + var(--safe-top)) calc(8px + var(--safe-right)) 6px calc(8px + var(--safe-left));
  }

  /* A frozen world should be unmistakable at a glance, from any screen. */
  :global(.layout.paused) .dock {
    border-color: var(--accent);
  }

  .dock-main {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .clock {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: none;
  }

  .clock button {
    min-width: 44px;
    min-height: 44px;
    padding: 4px 8px;
    font-size: 13px;
  }

  /* The bank counts up every second: a fixed slot as wide as its longest text,
     "⏩ 59m 59s" (80.3px at 13px in Gothic; the "2×" of the header's chip is
     the button's accent border here), so the job block after it stays put. */
  .dock .clock .bonus {
    min-width: 6.5em;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }

  .dock .clock .bonus.on,
  .dock .clock .pause.on {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* The job block takes what the buttons leave; a long job name ends in an ellipsis. */
  .dock-job {
    flex: 1 1 0;
    min-width: 0;
  }

  .gold {
    flex: none;
    display: inline-block;
    min-width: 6.5ch;
    font-weight: 600;
    color: var(--accent);
    white-space: nowrap;
  }

  .actions {
    flex: none;
    display: flex;
    gap: 4px;
  }

  .actions :global(button) {
    min-height: 44px;
    min-width: 44px;
  }

  /* The developer button (npm run dev only) takes no more width than its glyph. */
  .actions .dev {
    min-width: 0;
    padding: 4px 6px;
  }
</style>
