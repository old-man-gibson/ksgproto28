<script lang="ts">
  import type { Snippet } from 'svelte';
  import { gs } from '../state.svelte';
  import { MATERIALS, QUALITY_TIERS, SKILLS } from '../../core/registry';
  import type { CookCheck } from '../../core/systems/cooking';
  import type { Placement } from '../../core/systems/disciplines';
  import type { CraftDisciplineDef, CraftSlotDef, QualityTier } from '../../core/types';
  import {
    COOKED_WORDS,
    axisMax,
    cookTimeRows,
    heatHint,
    outsideSlots,
    trackRows,
    windowWords,
    type CookWindow,
  } from './heatTrack';

  /**
   * The stove's slots as rows on a time axis. A row is one entry point: its
   * square sits where the ingredient goes in, and the bar under it runs to the
   * end of the cook, split into not cooked enough, cooked right and overcooked.
   * Pick another cook length and every square and bar moves with it.
   *
   * The rows, bars and hint come from lib/heatTrack.ts, which reads the core;
   * this draws them. The squares are the bench's own (`cell`): same tooltip,
   * same picker, so the track adds a way of seeing the stove, not another one.
   */
  let {
    disc,
    bench,
    duration,
    check,
    elapsed = null,
    cell,
  }: {
    disc: CraftDisciplineDef;
    bench: Placement;
    /** The chosen cook length, in units. */
    duration: number;
    /** What the bench would make now, for the hint. */
    check: CookCheck;
    /** Units into the cook a run at this bench has reached; null when none is running. */
    elapsed?: number | null;
    /** One bench square for a slot, with its tooltip; clicking it opens the picker. */
    cell: Snippet<[CraftSlotDef]>;
  } = $props();

  const max = $derived(axisMax(disc, duration));
  const rows = $derived(trackRows(gs, disc, bench, duration));
  const outside = $derived(outsideSlots(disc));
  const cook = $derived(cookTimeRows(gs, disc, bench, duration));
  const hint = $derived(heatHint(gs, disc, bench, duration, rows, cook, check));
  const skillName = $derived(SKILLS[disc.skill]?.name ?? disc.skill);

  /** Tick marks along the axis, every other unit. */
  const ticks = $derived(Array.from({ length: Math.floor(max / 2) + 1 }, (_, i) => i * 2));

  /** The lane's width in pixels, to tell which cook-time windows have room for their name. */
  let areaWidth = $state(320);
  const labelOf = (w: CookWindow) => w.outcome?.name ?? 'no dish';
  /** About 6.4 px a character at the window label's size, plus its padding. */
  const roomy = (w: CookWindow) => ((w.to - w.from) / max) * areaWidth >= labelOf(w).length * 6.4 + 12;

  const pct = (units: number) => `${((units / max) * 100).toFixed(2)}%`;
  const units1 = (n: number) => n.toFixed(1);
  const plain = (n: number) => String(Math.round(n * 10) / 10);

  /** A window's colour: shorter than the default dish, the default, or longer. */
  const windowColour: Record<CookWindow['side'], string> = {
    before: 'var(--focus)',
    default: 'var(--accent)',
    after: 'var(--hp)',
  };

  const gradeName = (id: string, quality: QualityTier) =>
    `${QUALITY_TIERS[quality].name} ${MATERIALS[id]?.name ?? id}`;
</script>

{#snippet playhead()}
  {#if elapsed !== null}
    <i class="ht-elapsed" style="width: {pct(Math.min(elapsed, max))}"></i>
    <i class="ht-playhead" style="left: {pct(Math.min(elapsed, max))}"></i>
  {/if}
{/snippet}

<div class="heat-track" style="--ht-steps: {max / 2}">
  <div class="ht-row ht-axis">
    <span class="ht-name ht-dim">Cook time, in units</span>
    <div class="ht-area" bind:clientWidth={areaWidth}>
      <i class="ht-after" style="left: {pct(duration)}"></i>
      {#each ticks as t (t)}
        <b class="ht-tick" style="left: {pct(t)}">{t}</b>
      {/each}
      {@render playhead()}
    </div>
    <span class="ht-tail"></span>
  </div>

  {#each rows as row (row.slot.id)}
    <div class="ht-row" class:ht-locked={row.locked}>
      <div class="ht-name">
        {#if row.part}
          <span>{gradeName(row.part.id, row.part.quality)}</span>
          <small class="ht-dim">{row.slot.name} · unit {plain(row.entry)}</small>
        {:else}
          <span class:ht-dim={row.locked}>{row.slot.name}</span>
          <small class="ht-dim">enters at unit {plain(row.entry)}</small>
        {/if}
      </div>
      <div class="ht-area ht-grid">
        <i class="ht-after" style="left: {pct(duration)}"></i>
        {#each row.zones as z (z.kind + z.from)}
          <i class="ht-zone ht-{z.kind}" style="left: {pct(z.from)}; width: {pct(z.to - z.from)}"></i>
        {/each}
        {#if row.part}<i class="ht-end" style="left: {pct(duration)}"></i>{/if}
        {@render playhead()}
        <div class="ht-cell" style="left: {pct(row.entry)}">
          {#if row.locked}
            <span class="ht-lock" aria-label="{row.slot.name}: locked">🔒</span>
          {:else}
            {@render cell(row.slot)}
          {/if}
        </div>
      </div>
      <div class="ht-tail">
        {#if row.locked}
          <span class="ht-dim">opens at {skillName} {row.slot.unlockLevel}</span>
        {:else if row.part && row.info}
          <span
            class:ht-right={row.info.verdict === 'in its element'}
            class:ht-over={row.info.verdict === 'overcooked'}
            class:ht-under={row.info.verdict === 'undercooked'}
          >×{row.info.fit.toFixed(2)} {COOKED_WORDS[row.info.verdict]}</span>
          <span class="ht-dim ht-nowrap">
            {units1(row.info.exposure)} units (right: {plain(row.info.band[0])}–{plain(row.info.band[1])})
          </span>
        {:else}
          <span class="ht-dim">empty</span>
        {/if}
      </div>
    </div>
  {/each}

  {#each cook as c (c.tag)}
    <div class="ht-row ht-cook">
      <div class="ht-name">
        <span>{c.tag.charAt(0).toUpperCase() + c.tag.slice(1)} cook time</span>
        <small class="ht-dim">decides the dish</small>
      </div>
      <div class="ht-area ht-windows" class:ht-capped={c.windows.some((w) => !roomy(w))}>
        <i class="ht-after" style="left: {pct(duration)}"></i>
        {#if c.mean === null}
          <span class="ht-dim ht-hold">Put {c.tag} in a row to see its cook time.</span>
        {:else}
          {#each c.windows as w (w.from)}
            <span
              class="ht-win"
              class:ht-on={w === c.here}
              style="--c: {windowColour[w.side]}; left: {pct(w.from)}; width: calc({pct(w.to - w.from)} - 2px)"
              title="{w.outcome?.name ?? 'No dish'}: {c.tag} {windowWords(w, max)}"
            >{#if roomy(w)}{labelOf(w)}{/if}</span>
          {/each}
          <!-- A window too narrow for its name is named under the strip instead of cut off. -->
          {#each c.windows.filter((w) => !roomy(w)) as w (w.from)}
            <span class="ht-cap" style="--c: {windowColour[w.side]}; right: calc(100% - {pct(w.to)})">
              {labelOf(w)}: {c.tag} {windowWords(w, max)}
            </span>
          {/each}
          <i class="ht-mark" style="left: {pct(c.mean)}"></i>
        {/if}
        {@render playhead()}
      </div>
      <div class="ht-tail">
        {#if c.mean !== null && c.here?.outcome}
          <span>{c.here.outcome.icon} <b>{c.here.outcome.name}</b></span>
          <span class="ht-dim ht-nowrap">{units1(c.mean)} units</span>
        {:else if c.mean !== null}
          <span class="ht-dim">no dish yet · {units1(c.mean)} units</span>
        {/if}
      </div>
    </div>
  {/each}

  {#if outside.length}
    <div class="ht-row ht-outside">
      <div class="ht-name">
        <span>Outside time</span>
        <small class="ht-dim">no cook time</small>
      </div>
      <div class="ht-items">
        {#each outside as slot (slot.id)}
          <span class="ht-item">
            {@render cell(slot)}
            <small class="ht-dim">{slot.name.toLowerCase()}</small>
          </span>
        {/each}
      </div>
      <!-- What the three kinds of bar mean. It sits in the row's spare room. -->
      <div class="ht-legend ht-dim">
        <span><i class="ht-swatch ht-raw"></i> not cooked enough</span>
        <span><i class="ht-swatch ht-ready"></i> cooked right</span>
        <span><i class="ht-swatch ht-burnt"></i> overcooked</span>
      </div>
    </div>
  {/if}
</div>
<div class="ht-hint" class:ht-fix={hint.kind === 'fix'} aria-live="polite">
  <span class="ht-arrow" aria-hidden="true">▸</span>
  {hint.text}
</div>

<style>
  .heat-track {
    container-type: inline-size;
    --ht-name: 150px;
    --ht-tail: 206px;
    --ht-row: 38px;
    border: 1px solid var(--border);
    background: var(--bg-sunken);
    padding: 6px 10px 8px;
  }

  .ht-dim {
    color: var(--text-dim);
  }

  .ht-nowrap {
    white-space: nowrap;
  }

  .ht-row {
    display: grid;
    grid-template-columns: var(--ht-name) minmax(0, 1fr) var(--ht-tail);
    column-gap: 10px;
    align-items: center;
    min-height: var(--ht-row);
    border-top: 1px dashed color-mix(in srgb, var(--border) 70%, transparent);
  }

  .ht-axis {
    min-height: 20px;
    border-top: none;
  }

  .ht-axis .ht-name {
    font-size: 11.5px;
  }

  .ht-name,
  .ht-tail {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    font-size: 13px;
    line-height: 1.2;
  }

  .ht-name small {
    font-size: 11.5px;
  }

  .ht-tail {
    font-size: 12.5px;
  }

  /* The lane. Everything in it is placed by percentage of the longest cook, so
     the same unit is the same x in every row and every row's line joins up. */
  .ht-area {
    position: relative;
    align-self: stretch;
    min-height: 20px;
  }

  .ht-grid {
    background: repeating-linear-gradient(
      90deg,
      color-mix(in srgb, var(--border) 55%, transparent) 0 1px,
      transparent 1px calc(100% / var(--ht-steps))
    );
  }

  .ht-tick {
    position: absolute;
    top: 3px;
    font-weight: 400;
    color: var(--text-dim);
    transform: translateX(-50%);
  }

  /* Past the end of the chosen cook: nothing happens there. */
  .ht-after {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    background: color-mix(in srgb, var(--bg) 70%, transparent);
    pointer-events: none;
  }

  .ht-zone {
    position: absolute;
    top: calc(50% - 6px);
    height: 12px;
    box-sizing: border-box;
  }

  .ht-raw {
    background: repeating-linear-gradient(135deg, var(--text-dim) 0 2px, transparent 2px 4px);
    border: 1px solid var(--text-dim);
  }

  .ht-ready {
    background: var(--accent);
    border: 1px solid var(--accent);
  }

  .ht-burnt {
    background: repeating-linear-gradient(135deg, var(--danger) 0 2px, var(--bg-sunken) 2px 4px);
    border: 1px solid var(--danger);
  }

  .ht-end {
    position: absolute;
    top: calc(50% - 11px);
    height: 22px;
    width: 3px;
    margin-left: -3px;
    background: var(--text);
  }

  .ht-playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: var(--text);
    box-shadow: 0 0 0 1px var(--bg-sunken);
    z-index: 3;
    pointer-events: none;
  }

  .ht-elapsed {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    background: color-mix(in srgb, var(--text) 8%, transparent);
    pointer-events: none;
  }

  .ht-cell {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2;
    display: flex;
  }

  .ht-lock {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    font-size: 13px;
    color: var(--text-dim);
    border: 1px dashed var(--border);
    background: repeating-linear-gradient(135deg, transparent 0 3px, var(--bg-raised) 3px 6px);
  }

  .ht-locked .ht-name {
    opacity: 0.8;
  }

  .ht-right {
    color: var(--accent);
  }

  .ht-under {
    color: var(--focus);
  }

  .ht-over {
    color: var(--danger);
  }

  /* The cook-time row: which dish each stretch of the axis makes. */
  .ht-windows {
    min-height: 40px;
  }

  .ht-windows.ht-capped {
    min-height: 56px;
  }

  .ht-cap {
    position: absolute;
    top: 34px;
    font-size: 11.5px;
    white-space: nowrap;
    color: var(--c);
  }

  .ht-hold {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    font-size: 12.5px;
  }

  .ht-win {
    position: absolute;
    top: 6px;
    height: 20px;
    box-sizing: border-box;
    padding: 0 5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    line-height: 18px;
    color: var(--c);
    border: 1px solid var(--c);
    background: color-mix(in srgb, var(--c) 16%, var(--bg-sunken));
  }

  .ht-win.ht-on {
    color: var(--text);
    background: color-mix(in srgb, var(--c) 45%, var(--bg-sunken));
  }

  .ht-mark {
    position: absolute;
    top: 2px;
    height: 28px;
    width: 2px;
    margin-left: -1px;
    background: var(--text);
    z-index: 2;
  }

  .ht-mark::after {
    content: '▲';
    position: absolute;
    top: 25px;
    left: -4px;
    font-size: 9px;
    line-height: 1;
    color: var(--text);
  }

  .ht-outside {
    grid-template-columns: var(--ht-name) auto minmax(0, 1fr);
    padding: 4px 0;
  }

  .ht-items {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 22px;
  }

  .ht-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .ht-legend {
    display: flex;
    flex-direction: column;
    gap: 1px;
    justify-self: end;
    font-size: 11.5px;
    line-height: 1.25;
  }

  .ht-swatch {
    display: inline-block;
    width: 16px;
    height: 9px;
    margin-right: 3px;
    vertical-align: -1px;
    box-sizing: border-box;
  }

  .ht-hint {
    margin-top: 6px;
    min-height: 2.9em;
    font-size: 13px;
    line-height: 1.4;
  }

  .ht-arrow {
    color: var(--text-dim);
  }

  .ht-fix .ht-arrow {
    color: var(--focus);
  }

  /* A narrow bench: the right-hand text drops under its row. */
  @container (max-width: 560px) {
    .ht-row {
      grid-template-columns: 7.6em minmax(0, 1fr);
    }

    .ht-row > .ht-tail {
      grid-column: 1 / -1;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 2px 8px;
      padding-bottom: 4px;
    }

    .ht-axis > .ht-tail {
      display: none;
    }

    /* The names of windows too narrow for their own are right-aligned to each
       window's end, and on a narrow strip two of them meet. Each takes a line of
       its own under the strip instead; the strip keeps the top 40px. */
    .ht-windows.ht-capped {
      min-height: 0;
      padding-top: 40px;
    }

    .ht-cap {
      position: static;
      display: block;
    }

    .ht-outside {
      grid-template-columns: 7.6em minmax(0, 1fr);
    }

    .ht-legend {
      grid-column: 1 / -1;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 2px 14px;
      justify-self: start;
    }
  }
</style>
