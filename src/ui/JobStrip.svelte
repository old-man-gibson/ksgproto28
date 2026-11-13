<script lang="ts">
  import { gs, view } from './state.svelte';
  import { currentJob } from './lib/job';
  import { RateMeter } from './lib/rates.svelte';
  import { fmt } from './lib/format';
  import Tip from './lib/Tip.svelte';
  import type { Snippet } from 'svelte';

  /**
   * The header's job strip and rate chip. The strip is the status text with a
   * bar: what the character is doing, the progress of the current cycle and the
   * time left (lib/job.ts says which states exist). The chip is gold and kills
   * per minute over the last 600 game ticks (lib/rates.svelte.ts). Floor 0 hides
   * the chip, as it hides the gold readout until the first kill.
   *
   * Width rule: nothing in the header changes width with the job. The strip
   * takes the room the other chips leave (basis 0), the bar and the detail keep
   * their slots when the job has none, and the chip's figures have fixed-width
   * slots. A fight starting or ending moves nothing on screen.
   *
   * `compact` is the phone dock's block (Dock.svelte, docs/PHONE.md): the job
   * and its detail on one line, the bar under it, and a third line that holds
   * `lead` (the gold) and the rate chip. The hover text is a tap card.
   */
  let {
    showRate = true,
    compact = false,
    lead,
  }: { showRate?: boolean; compact?: boolean; lead?: Snippet } = $props();

  const job = $derived(currentJob(gs, view.stats));

  const meter = new RateMeter();
  $effect(() => {
    meter.sample(gs.totalTicks, gs.stats['gold:earned'] ?? 0, gs.stats.kills ?? 0, gs.prestige.count, gs.paused);
  });
  const rateTitle = $derived(
    meter.gold !== null && meter.kills !== null
      ? `Rate: ${fmt(meter.gold)} gold and ${fmt(meter.kills)} kills per minute over the last 60 s of game time. Not saved.`
      : 'Rate: shown after 30 s of unpaused game time since load or prestige.',
  );
</script>

{#snippet rateText()}
  <span class="rate-n">{meter.gold === null ? '–' : fmt(meter.gold)}</span> gold/min<span class="rate-kills">
    · <span class="rate-n">{meter.kills === null ? '–' : fmt(meter.kills)}</span> kills/min</span
  >
{/snippet}

{#if compact}
  <Tip block>
    <div class="job-compact" class:job-paused={gs.paused}>
      <div class="job-line">
        <span class="job-icon">{job.icon}</span>
        <span class="job-name">{gs.paused ? 'Paused: ' : ''}{job.name}</span>
        <span class="job-detail">{job.detail ?? ' '}</span>
      </div>
      <!-- Drawn in every state: a job without a bar hides it and keeps its slot. -->
      <div class="bar job-track job-track-wide" class:job-none={job.pct === null}>
        <div class="fill" style="width: {(job.pct ?? 0) * 100}%; background: var(--action)"></div>
      </div>
      <div class="job-sub">
        {@render lead?.()}
        <!-- Drawn before the first full window too ("–"), so the chip never appears or vanishes.
             Gold per minute only, as "120/min" beside the gold: the words and the kills
             figure are in the tap card. -->
        {#if showRate}
          <span class="rate-chip"><span class="rate-n">{meter.gold === null ? '–' : fmt(meter.gold)}</span>/min</span>
        {/if}
      </div>
    </div>
    {#snippet tip()}
      <div class="tip-line tip-base">{job.name}</div>
      <div class="tip-line">{job.tip}</div>
      {#if showRate}<div class="tip-line">{rateTitle}</div>{/if}
    {/snippet}
  </Tip>
{:else}
  <div class="job-strip" class:job-paused={gs.paused} title="{job.name}. {job.tip}">
    <span class="job-icon">{job.icon}</span>
    <span class="job-name">{gs.paused ? 'Paused: ' : ''}{job.name}</span>
    <!-- Drawn in every state: a job without a bar hides it and keeps its slot. -->
    <div class="bar job-track" class:job-none={job.pct === null}>
      <div class="fill" style="width: {(job.pct ?? 0) * 100}%; background: var(--action)"></div>
    </div>
    <!-- A no-break space when empty: an empty span has no line box and sits 7px
         lower, which would move it between a fight and the next. -->
    <span class="job-detail">{job.detail ?? ' '}</span>
  </div>

  {#if showRate}
    <!-- Drawn before the first full window too ("–"), so the chip never appears
         or vanishes under the cursor. -->
    <div class="rate-chip" title={rateTitle}>{@render rateText()}</div>
  {/if}
{/if}

<style>
  .job-strip {
    /* A fixed basis, not its content: the strip's width depends on the window,
       never on the job, so a job can neither widen the header nor wrap it. 330px
       holds the name, the bar and the detail; a narrower window shrinks it. A
       container, so its parts drop by its width (rules at the end). */
    flex: 1 1 330px;
    min-width: 0;
    container-type: inline-size;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-dim);
  }

  .job-icon {
    flex: none;
  }

  /* A slot of fixed width (the room, up to 240px; never the text), so the bar
     and the detail after it sit at one place whatever the job. A name longer
     than the slot ends in an ellipsis; the strip's title holds the whole name. */
  .job-name {
    flex: 1 1 0;
    min-width: 0;
    max-width: 240px;
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
    flex: 0 0 80px;
    height: 9px;
  }

  /* No bar for this job (idle, a hunt between fights): the slot stays. */
  .job-track.job-none {
    visibility: hidden;
  }

  .job-track .fill {
    /* Fills every tick; easing would lag behind the reset at the end of a cycle. */
    transition: none;
  }

  /* Fixed width, wide enough for "Foe HP 100%", empty when the job has no
     detail. */
  .job-detail {
    flex: 0 0 auto;
    width: 6.5em;
    overflow: hidden;
    white-space: nowrap;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  /* A narrow strip drops the detail first, then the bar, so the name keeps
     about 100px. The strip's title still says what runs. */
  @container (max-width: 329px) {
    .job-strip .job-detail {
      display: none;
    }
  }

  @container (max-width: 209px) {
    .job-strip .job-track {
      display: none;
    }
  }

  .rate-chip {
    flex: none;
    white-space: nowrap;
    color: var(--text-dim);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  /* The figures change every second: fixed slots, right-aligned, so the words
     after them stay put. fmt() writes at most 5 characters ("1.00K", "12.3K",
     "0.125"). */
  .rate-n {
    display: inline-block;
    min-width: 5ch;
    text-align: right;
  }

  /* Under 1470px the chip keeps gold per minute only: kills cost 103px the job
     strip needs for its full 330px. The title carries both figures. */
  @media (max-width: 1469px) {
    .rate-kills {
      display: none;
    }
  }

  /* Under 1180px the header wraps by design (App.svelte). The strip and the
     chip start the second row, so which row they sit on never depends on the
     job. */
  @media (max-width: 1179px) {
    .job-strip {
      order: 1;
      flex-basis: calc(100% - 20ch);
    }

    .rate-chip {
      order: 2;
    }
  }

  /* The dock's block: three lines of fixed height, so no job changes its size.
     A container, so the detail drops by the room there is (rule below). */
  .job-compact {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    color: var(--text-dim);
  }

  .job-line {
    display: flex;
    align-items: center;
    gap: 6px;
    line-height: 18px;
    font-size: 14px;
  }

  .job-compact .job-name {
    flex: 1 1 0;
    max-width: none;
  }

  .job-compact .job-detail {
    width: 5.5em;
    text-align: right;
    font-size: 12.5px;
  }

  /* The bar is the cycle's progress; the detail ("Foe HP 60%") has the room it needs from about 170px. */
  @container (max-width: 169px) {
    .job-compact .job-detail {
      display: none;
    }
  }

  .job-track-wide {
    flex: none;
    height: 5px;
  }

  .job-sub {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
    height: 16px;
    line-height: 16px;
    overflow: hidden;
    white-space: nowrap;
  }

  /* The gold keeps its slot; the rate gives way first and ends in an ellipsis. */
  .job-sub .rate-chip {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 12px;
  }

  /* The last item on its line: nothing sits after the figure, so it needs no fixed slot. */
  .job-sub .rate-n {
    min-width: 0;
    text-align: left;
  }
</style>
