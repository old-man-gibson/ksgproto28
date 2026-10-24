<script lang="ts">
  import { gs, view } from '../state.svelte';
  import { MATERIALS, QUALITY_TIERS, SKILLS } from '../../core/registry';
  import { JUDGEMENT_CAP, exposureInfo, tierFor, type CookCheck, type CookLedger } from '../../core/systems/cooking';
  import { gradedUnitPrice } from '../../core/systems/equipment';
  import { skillLevel } from '../../core/systems/disciplines';
  import type { CraftDisciplineDef, GameState, QualityTier } from '../../core/types';
  import { foodLines } from './format';
  import { COOKED_WORDS } from './heatTrack';
  import {
    JUDGEMENT_WORDS,
    gapSentence,
    gradeText,
    ledgerSummary,
    rulerBlocks,
    rulerPct,
    scoreText,
  } from './gradeLedger';
  import GradeBadge from './GradeBadge.svelte';

  /**
   * Where a dish's grade comes from. Collapsed it is one line, "Fine · 2.11 ·
   * Superb 0.39 short"; opened it shows the tier ruler with the score on it,
   * what each part adds, the skill bonus, the cut bonus, and what the dish does
   * once eaten and sells for. Every number is `cookLedger`'s: the grade the
   * bench promises is `tierFor` of this same score, so the two cannot differ.
   */
  let {
    disc,
    ledger,
    dish,
    duration,
    open = $bindable(false),
  }: {
    disc: CraftDisciplineDef;
    ledger: CookLedger;
    dish: CookCheck;
    /** A timed bench's chosen cook length. */
    duration?: number;
    open?: boolean;
  } = $props();

  const state: GameState = gs;
  const level = $derived(skillLevel(state, disc));
  const skill = $derived(SKILLS[disc.skill]?.name ?? disc.skill);
  const blocks = rulerBlocks();
  /** Columns before "adds": part and grade, and how it cooked on a timed bench. */
  const span = $derived(disc.timeline ? 3 : 2);

  const lowTier = $derived(tierFor(ledger.score[0]));
  const highTier = $derived(tierFor(ledger.score[1]));
  const sentence = $derived(gapSentence(ledger, level, skill, !!disc.timeline));

  const two = (n: number) => n.toFixed(2);
  const signed = (n: number) => `${n < 0 ? '−' : '+'}${two(Math.abs(n))}`;
  const range = (a: number, b: number) => (two(a) === two(b) ? two(a) : `${two(a)}–${two(b)}`);

  /** The dish this bench makes, when it makes a material (the cutting board does not). */
  const dishId = $derived(dish.outcome?.result.kind === 'material' ? dish.outcome.result.id : undefined);
  const grades = $derived<QualityTier[]>(
    dish.quality ? (dish.qualityHigh ? [dish.quality, dish.qualityHigh] : [dish.quality]) : [],
  );
  const eaten = $derived(dishId ? grades.map((g) => ({ grade: g, lines: foodLines(dishId, g) })) : []);
  const verb = $derived.by(() => {
    const used = dishId ? MATERIALS[dishId]?.consumable?.useVerb : undefined;
    return used === 'Drank' ? 'Drunk' : used === 'Ate' ? 'Eaten' : 'Used';
  });
  const prices = $derived(dishId ? grades.map((g) => gradedUnitPrice(state, dishId, g, view.stats.goldGain)) : []);
  const sells = $derived(
    prices.length ? (prices[0] === prices[prices.length - 1] ? `${prices[0]}` : `${prices[0]}–${prices[prices.length - 1]}`) : '',
  );

  /** One row of the table: what is in the slot, how it cooked, what it adds. */
  const parts = $derived(
    ledger.rows.map((r) => {
      const slot = disc.slots.find((s) => s.id === r.slotId);
      const heat = slot && slot.at != null ? exposureInfo(disc, slot, r.id, duration) : null;
      return { ...r, slotName: slot?.name ?? r.slotId, heat };
    }),
  );
</script>

<div class="grade-ledger">
  <button class="gl-toggle" aria-expanded={open} onclick={() => (open = !open)}>
    <span class="gl-caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
    {ledgerSummary(ledger)}
  </button>

  {#if open}
    <div class="gl-body">
      <div class="gl-ruler" aria-hidden="true">
        {#each blocks as b (b.tier)}
          {@const on = b.tier === lowTier || b.tier === highTier}
          <!-- Refuse's colour is near-black: it would vanish on the well. -->
          {@const colour = b.tier === 'f' ? 'var(--text-dim)' : QUALITY_TIERS[b.tier].color}
          <i
            class="gl-block"
            class:gl-on={on}
            style="--c: {colour}; left: {b.left}%; width: {b.width}%"
            title={QUALITY_TIERS[b.tier].name}
          ></i>
          <span class="gl-lbl" style="--c: {colour}; left: {b.left}%">{b.tier.toUpperCase()}</span>
          <span class="gl-val" style="left: {b.left}%">{b.mult}</span>
        {/each}
        <i
          class="gl-at"
          style="left: {rulerPct(ledger.score[0])}%; width: max(4px, {rulerPct(ledger.score[1]) - rulerPct(ledger.score[0])}%)"
        ></i>
      </div>
      {#if sentence}<p class="gl-note">{sentence}</p>{/if}

      <div class="gl-scroll">
        <table class="gl-table">
          <thead>
            <tr>
              <th>part</th>
              <th>grade</th>
              {#if disc.timeline}<th>cooked</th>{/if}
              <th class="gl-num">adds</th>
            </tr>
          </thead>
          <tbody>
            {#each parts as p (p.slotId)}
              <tr>
                <td>
                  {MATERIALS[p.id]?.icon ?? ''} {MATERIALS[p.id]?.name ?? p.id}
                  <small class="gl-dim">{p.slotName.toLowerCase()}</small>
                  {#if p.tool}
                    <small class="gl-dim gl-block-note">Cookware counts in the grade like an ingredient.</small>
                  {/if}
                </td>
                <td class="gl-nowrap"><GradeBadge tier={p.quality} /> {QUALITY_TIERS[p.quality].name}</td>
                {#if disc.timeline}
                  <td class="gl-nowrap">
                    {#if p.heat}
                      ×{two(p.fit)} <small class="gl-dim">{COOKED_WORDS[p.heat.verdict]}</small>
                    {:else}
                      <span class="gl-dim">—</span>
                    {/if}
                  </td>
                {/if}
                <td class="gl-num">{range(p.lo, p.hi)}</td>
              </tr>
            {/each}
            <tr class="gl-sum">
              <td colspan={span} class="gl-dim">mean of {ledger.rows.length} part{ledger.rows.length === 1 ? '' : 's'}</td>
              <td class="gl-num">{range(ledger.mean[0], ledger.mean[1])}</td>
            </tr>
            <tr>
              <td colspan={span}>
                + skill bonus
                <small class="gl-dim">{skill} {level}: {JUDGEMENT_WORDS} (at most {two(JUDGEMENT_CAP)})</small>
              </td>
              <td class="gl-num">{signed(ledger.judgement)}</td>
            </tr>
            {#if disc.favoredPrep}
              <tr>
                <td colspan={span}>
                  + cut bonus
                  <small class="gl-dim">for ingredients cut {disc.favoredPrep}, the cut this bench favors</small>
                </td>
                <td class="gl-num">{signed(ledger.benchFit)}</td>
              </tr>
            {/if}
            <tr class="gl-sum gl-score">
              <td colspan={span}>
                score
                <GradeBadge tier={lowTier} />
                {#if highTier !== lowTier}–<GradeBadge tier={highTier} />{/if}
                {gradeText(ledger)}
              </td>
              <td class="gl-num">{scoreText(ledger)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {#each eaten as e (e.grade)}
        {#if e.lines.length}
          <p class="gl-line">
            {verb} at {QUALITY_TIERS[e.grade].name}:
            {#each e.lines as line, i (i)}<span class="gl-eat">{line}</span>{/each}
          </p>
        {/if}
      {/each}
      {#if sells}<p class="gl-line gl-dim">Sells for {sells} gold.</p>{/if}
    </div>
  {/if}
</div>

<style>
  .grade-ledger {
    margin-top: 4px;
    font-size: 13px;
  }

  /* A text line that opens, not a bar: the ledger stays out of the way until asked. */
  .gl-toggle {
    display: block;
    width: 100%;
    padding: 2px 0;
    text-align: left;
    color: var(--text);
    background: none;
    border: none;
    font-size: 13px;
  }

  .gl-toggle:hover:not(:disabled) {
    background: none;
    color: var(--accent);
  }

  .gl-caret {
    display: inline-block;
    width: 1em;
    color: var(--text-dim);
  }

  .gl-body {
    margin: 4px 0 2px 4px;
    padding: 2px 0 2px 12px;
    border-left: 2px solid var(--border);
  }

  .gl-dim {
    color: var(--text-dim);
  }

  .gl-nowrap {
    white-space: nowrap;
  }

  .gl-ruler {
    position: relative;
    height: 44px;
    margin: 4px 0 6px;
  }

  .gl-block {
    position: absolute;
    top: 15px;
    height: 12px;
    box-sizing: border-box;
    border: 1px solid var(--c);
    background: color-mix(in srgb, var(--c) 22%, var(--bg-sunken));
    opacity: 0.55;
  }

  .gl-block.gl-on {
    opacity: 1;
    background: color-mix(in srgb, var(--c) 55%, var(--bg-sunken));
  }

  .gl-lbl {
    position: absolute;
    top: 0;
    font-size: 11.5px;
    font-weight: 700;
    color: var(--c);
  }

  .gl-val {
    position: absolute;
    top: 29px;
    font-size: 11px;
    color: var(--text-dim);
  }

  .gl-at {
    position: absolute;
    top: 10px;
    height: 22px;
    box-sizing: border-box;
    border: 1px solid var(--text);
    background: color-mix(in srgb, var(--text) 35%, transparent);
    z-index: 2;
  }

  .gl-note {
    margin: 0 0 6px;
    font-size: 13px;
  }

  .gl-scroll {
    overflow-x: auto;
  }

  .gl-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .gl-table th,
  .gl-table td {
    padding: 3px 12px 3px 0;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  }

  .gl-table th {
    font-weight: 400;
    font-size: 11.5px;
    color: var(--text-dim);
  }

  .gl-table .gl-num {
    padding-right: 0;
    text-align: right;
    white-space: nowrap;
  }

  .gl-table small {
    font-size: 11.5px;
  }

  .gl-block-note {
    display: block;
  }

  .gl-sum td {
    border-top: 1px solid var(--border);
  }

  .gl-score td {
    font-weight: 600;
  }

  .gl-line {
    margin: 6px 0 0;
  }

  .gl-eat {
    display: block;
    padding-left: 1em;
  }
</style>
