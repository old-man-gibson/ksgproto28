<script lang="ts">
  import { gs, view } from './state.svelte';
  import { currentJob } from './lib/job';
  import { RateMeter } from './lib/rates.svelte';
  import { fmt } from './lib/format';

  /**
   * The header's job strip and rate chip. The strip is the status text with a
   * bar: what the character is doing, the progress of the current cycle and the
   * time left (lib/job.ts says which states exist). The chip is gold and kills
   * per minute over the last 600 game ticks (lib/rates.svelte.ts). Floor 0 hides
   * the chip, as it hides the gold readout until the first kill.
   */
  let { showRate = true }: { showRate?: boolean } = $props();

  const job = $derived(currentJob(gs, view.stats));

  const meter = new RateMeter();
  $effect(() => {
    meter.sample(gs.totalTicks, gs.stats['gold:earned'] ?? 0, gs.stats.kills ?? 0, gs.prestige.count, gs.paused);
  });
</script>

<div class="job-strip" class:job-paused={gs.paused} title="{job.name}. {job.tip}">
  <span class="job-icon">{job.icon}</span>
  <span class="job-name">{gs.paused ? 'Paused: ' : ''}{job.name}</span>
  {#if job.pct !== null}
    <div class="bar job-track">
      <div class="fill" style="width: {job.pct * 100}%; background: var(--action)"></div>
    </div>
  {/if}
  {#if job.detail}<span class="job-detail">{job.detail}</span>{/if}
</div>

{#if showRate && meter.gold !== null && meter.kills !== null}
  <div class="rate-chip" title="Rate: gold and kills per minute over the last 60 s of game time. Not saved.">
    {fmt(meter.gold)} gold/min · {fmt(meter.kills)} kills/min
  </div>
{/if}

<style>
  .job-strip {
    /* The stretchy one: it takes the room the status text took, so the clock,
       weather and gold keep right of centre. Its basis is its content, so the
       header wraps before the job name loses a letter; inside it the bar gives
       way first (.job-track). */
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-dim);
  }

  .job-icon {
    flex: none;
  }

  /* Never shorter than its text, unless the strip itself is. */
  .job-name {
    flex: none;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* A frozen world should be unmistakable at a glance, from any screen. */
  .job-paused .job-name {
    color: var(--accent);
    font-weight: 600;
  }

  /* The bar is global `.bar` / `.fill` on purpose, so a theme frames it like
     every other bar. Only the size and the easing are set here. */
  .job-track {
    /* Small by basis so the header does not wrap on its account, wider when the
       row has room, and the first thing to shrink (weight 4) when it does not. */
    flex: 1 4 60px;
    min-width: 0;
    max-width: 160px;
    height: 9px;
  }

  .job-track .fill {
    /* Fills every tick; easing would lag behind the reset at the end of a cycle. */
    transition: none;
  }

  .job-detail {
    flex: none;
    min-width: 3ch;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  .rate-chip {
    white-space: nowrap;
    color: var(--text-dim);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
</style>
