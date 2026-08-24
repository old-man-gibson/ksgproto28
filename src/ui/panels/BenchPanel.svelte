<script lang="ts">
  import { gs, game } from '../state.svelte';
  import { MATERIALS, QUALITY_TIERS, SKILLS, STATUSES } from '../../core/registry';
  import { RUNE_PATTERNS } from '../../core/data/runes.data';
  import { PREPS, UNIFORMITY } from '../../core/data/preps.data';
  import { previewCarve, countPatterns } from '../../core/systems/runecarving';
  import { exposureInfo, previewCook } from '../../core/systems/cooking';
  import { REAGENTS, BREW_FORMS } from '../../core/data/alchemy.data';
  import { brewGrade, previewBrew, resolveBrew, sequenceOf } from '../../core/systems/alchemy';
  import { REFINE_COPIES, nextGrade, previewRefine, refineCost } from '../../core/systems/mutagens';
  import { MAIN_GENES, MUTATIONS } from '../../core/data/mutagens.data';
  import { DISCIPLINES } from '../../core/data/disciplines.data';
  import {
    gradesHeld,
    nextSlot,
    openSlots,
    slotConsumes,
    slotPicks,
    stockOf,
    usableIn,
    type Placement,
  } from '../../core/systems/disciplines';
  import { adornmentEffectAt, namedRuneFor, patternEffectAt, resolveRune } from '../../core/systems/runes';
  import { describeRuneEffect, fmt, pct } from '../lib/format';
  import type { CraftSlotDef, GradedStack, QualityTier, RuneContext } from '../../core/types';
  import Tip from '../lib/Tip.svelte';

  /**
   * The carving bench: a slab in the middle with its cuts around it, and four
   * stations at the corners. Clicking a square opens a picker of what may
   * legally go there — the legality comes from the discipline, not from
   * anything hardcoded here.
   *
   * Everything is small on purpose. A bench is a thing you glance at and click,
   * so grades are shown as a border colour rather than a word, and what a piece
   * contributes lives in its tooltip rather than on the face of it.
   */

  let {
    disciplineId = 'runecarving',
    /** Opened as furniture rather than embedded — room to see what you are doing. */
    large = false,
  }: { disciplineId?: string; large?: boolean } = $props();

  const disc = $derived(DISCIPLINES[disciplineId]);
  /** Runecarving has its own preview (patterns, tools, split chance); cooking
   * has its own (matched dish, resulting grade). The bench itself is the same. */
  const carving = $derived(disc.id === 'runecarving');
  /**
   * An ordered bench reads its slots as a SEQUENCE, so it is drawn as a strip
   * of numbered steps rather than stations around a slab — a thing whose order
   * matters should look like a thing with an order. Everything else about it
   * (cells, pickers, tooltips, the bench-run clock) is the same machinery.
   */
  const ordered = $derived(!!disc.ordered);
  /**
   * A REFINING bench hands back its own subject at a better grade rather than
   * producing a new thing, so it has no outcome table to match against and
   * must not fall through to the cooking preview — which would look for a dish
   * among no outcomes, find none, and disable the button with a reason about
   * ingredients that makes no sense at a culture bench.
   */
  const refining = $derived(!!disc.refines);
  /**
   * What a 'design' slot draws from: the discipline's own catalogue of things
   * you KNOW. Carving patterns for the rune table, knife techniques for the
   * cutting board — same slot machinery, different book.
   */
  const designBook = $derived<Record<string, { id: string; name: string; icon: string; desc?: string; minLevel?: number }>>(
    carving ? RUNE_PATTERNS : PREPS,
  );
  const open = $derived(openSlots(gs, disc));
  const level = $derived(gs.skills[disc.skill]?.level ?? 0);
  const coming = $derived(nextSlot(gs, disc));

  /** What is currently laid out. Slot id → what is in it. */
  let bench = $state<Placement>({});
  /** Which slot's picker is open, if any. */
  let picking = $state<string | null>(null);
  /** Which context the tooltips describe. Most runes end up in a weapon. */
  let ctx = $state<RuneContext>('weapon');
  /** Chosen duration on a timed bench; the discipline's default until touched. */
  let chosenUnits = $state<number | null>(null);

  const duration = $derived(disc.timeline ? (chosenUnits ?? disc.timeline.default) : undefined);
  const carve = $derived(carving ? previewCarve(gs, bench) : null);
  const dish = $derived(carving || ordered || refining ? null : previewCook(gs, bench, disc, duration));
  const potion = $derived(ordered ? previewBrew(gs, bench, disc) : null);
  const culture = $derived(refining ? previewRefine(gs, bench) : null);
  /** The subject on the bench, and where a push would take it. */
  const subject = $derived(refining ? bench.subject : undefined);
  const subjectDef = $derived(subject ? (MAIN_GENES[subject.id] ?? MUTATIONS[subject.id]) : undefined);
  const target = $derived(subject ? nextGrade(subject.quality) : null);
  const heldCopies = $derived(subject ? stockOf(gs, subject.id, subject.quality) : 0);
  /** The sequence as it currently reads, gaps closed — what the strip narrates. */
  const sequence = $derived(ordered ? sequenceOf(disc, bench) : []);

  /** The bench run underway at THIS bench, if any. */
  const job = $derived(gs.benchWork?.disciplineId === disc.id ? gs.benchWork : null);
  /** How many of the laid-out base ingredient are held, for "Prepare all". */
  const baseStack = $derived(bench[openSlots(gs, disc).find((s) => s.role === 'base')?.id ?? '']);
  const baseHeld = $derived(baseStack ? stockOf(gs, baseStack.id, baseStack.quality) : 0);
  const ok = $derived(
    refining ? !!culture?.ok : ordered ? !!potion?.ok : carving ? !!carve?.ok : !!dish?.ok,
  );
  const reason = $derived(
    refining ? culture?.reason : ordered ? potion?.reason : carving ? carve?.reason : dish?.reason,
  );

  const preview = $derived(carve?.preview ? resolveRune(carve.preview) : null);
  const named = $derived(carve?.preview ? namedRuneFor(carve.preview) : undefined);

  const slotAt = (station: string, index = 0) =>
    open.filter((s) => s.station === station && slotPicks(s) !== 'design')[index];

  /**
   * The middle column. For carving these are the pattern cuts around the slab;
   * for cooking they are the ingredients going into the pot.
   */
  const cuts = $derived(
    open.filter((sl) => sl.station === 'centre' && sl.role !== 'base'),
  );
  const baseSlot = $derived(open.find((sl) => sl.role === 'base'));

  /** Grade of the slab, which is what every cut's strength is scaled by. */
  const slabGrade = $derived<QualityTier>(bench.slab?.quality ?? 'c');

  function put(slotId: string, choice: GradedStack | undefined) {
    bench = { ...bench, [slotId]: choice };
    picking = null;
  }

  function clear() {
    bench = {};
    picking = null;
  }

  /** Kick off a repeating run with the current layout. */
  function startRun(count: number | null) {
    game.startBenchWork(disc.id, bench, { count, duration });
  }

  /** Everything spent by a craft leaves the bench; tools and the pot stay. */
  function clearConsumed() {
    const keep: Placement = {};
    for (const s of open) if (!slotConsumes(s) && bench[s.id]) keep[s.id] = bench[s.id];
    bench = keep;
  }

  function work() {
    if (carving) {
      if (game.carveRune(bench)) clearConsumed();
      return;
    }
    // Cooking runs on the clock: the button starts a one-craft job and the
    // bar fills. Nothing is spent until the timer lands, so stopping a cook
    // midway costs nothing but the time. The layout stays put afterwards —
    // cooking the same dish again is one click, and the preview says plainly
    // when the stock for it has run out.
    game.startBenchWork(disc.id, bench, { count: 1, duration });
  }

  interface Option {
    stack: GradedStack;
    icon: string;
    name: string;
    /** Border colour: the grade, or the accent for a design. */
    color: string;
    qty: number;
    note: string;
  }

  /** Options for a slot, whatever it draws from. */
  function optionsFor(slot: CraftSlotDef): Option[] {
    if (slotPicks(slot) === 'design') {
      return Object.values(designBook)
        .filter((p) => (p.minLevel ?? 0) <= level)
        .map((p) => ({
          stack: { id: p.id, quality: 'c' as QualityTier },
          icon: p.icon,
          name: p.name,
          color: 'var(--accent)',
          qty: 0,
          note: p.desc ?? '',
        }));
    }
    return usableIn(gs, slot).flatMap((mat) =>
      gradesHeld(gs, mat.id).map((g) => ({
        stack: { id: mat.id, quality: g.quality },
        icon: mat.icon,
        name: mat.name,
        color: QUALITY_TIERS[g.quality].color,
        qty: g.qty,
        note: QUALITY_TIERS[g.quality].name,
      })),
    );
  }

  /** What each solvent promises, said the way the bench says it. */
  const RAISES: Record<string, string> = {
    water: 'something to drink',
    oil: 'something to wear',
    spirit: 'something to throw',
  };

  /** Which step of the sequence a slot is, 1-based, gaps closed. Ordered benches only. */
  function stepNumber(slotId: string): number {
    let n = 0;
    for (const s of disc.slots) {
      if (bench[s.id]) n++;
      if (s.id === slotId) return n;
    }
    return n;
  }

  /** Swap a filled step with its filled neighbour — the fastest way to try an order. */
  function shift(slotId: string, dir: -1 | 1) {
    const filled = open.filter((s) => bench[s.id]).map((s) => s.id);
    const at = filled.indexOf(slotId);
    const to = at + dir;
    if (at < 0 || to < 0 || to >= filled.length) return;
    const other = filled[to];
    bench = { ...bench, [slotId]: bench[other], [other]: bench[slotId] };
  }

  /** What a placed piece is, and what it puts into the result. */
  function describePiece(slot: CraftSlotDef, held: GradedStack): { head: string; lines: string[] } {
    if (ordered) {
      // A reagent's tooltip is about its POSITION, because position is the
      // whole of what a reagent does here.
      const def = REAGENTS[held.id];
      const mat = MATERIALS[held.id];
      const grade = QUALITY_TIERS[held.quality];
      const lines: string[] = [`${grade.name} · ×${grade.mult} strength`];
      if (def?.desc) lines.push(def.desc);
      const step = stepNumber(slot.id);
      const after = sequence.length - step;
      if (def?.menstruum) {
        lines.push(
          step === 1
            ? `Raises the brew — ${RAISES[def.menstruum.medium]}`
            : 'Raised already, so this only thins it: weaker, calmer, roomier',
        );
      }
      if (def?.essence) {
        const dissolved = after / (after + 1);
        lines.push(
          after === 0
            ? 'Last in — none of it dissolves, all of its character reads'
            : `${after} more after it — ${Math.round(dissolved * 100)}% dissolves into raw strength`,
        );
      }
      if (def?.act) {
        lines.push(
          step === 1
            ? 'Acts on the brew it finds — and it finds nothing here'
            : `Acts on the ${step - 1} thing${step === 2 ? '' : 's'} added before it`,
        );
      }
      return { head: `${mat?.icon ?? '📦'} ${mat?.name ?? held.id}`, lines };
    }
    if (slotPicks(slot) === 'design') {
      const p = designBook[held.id];
      if (!carving) {
        // A knife technique: what it is, and that the grade is rolled.
        const lines = [p?.desc ?? ''].filter(Boolean);
        lines.push('Cut grade rolls from your skill, capped by the ingredient');
        return { head: `${p?.icon ?? '🔪'} ${p?.name ?? held.id}`, lines };
      }
      // A cut's worth depends on the slab under it and how many times it repeats.
      const copies = countPatterns(
        cuts.map((c) => bench[c.id]?.id).filter((id): id is string => !!id),
      ).get(held.id) ?? 1;
      const lines = [p?.desc ?? ''].filter(Boolean);
      lines.push(`On a ${QUALITY_TIERS[slabGrade].name} slab: ${describeRuneEffect(patternEffectAt(held.id, slabGrade, ctx, copies))}`);
      if (copies > 1) lines.push(`Cut ${copies}× — concentrated, not broadened`);
      return { head: `${p?.icon ?? '🔷'} ${p?.name ?? held.id}`, lines };
    }

    const mat = MATERIALS[held.id];
    const grade = QUALITY_TIERS[held.quality];
    const lines: string[] = [`${grade.name} · ×${grade.mult} strength`];
    if (!carving) {
      // Cooking: what a piece contributes is its GRADE, since the dish's grade
      // is the average of the basket. Its tags are what decides the recipe.
      const tags = mat?.craftTags ?? [];
      // On a timed bench, when this slot enters decides what the heat does.
      const heat = exposureInfo(disc, slot, held.id, duration);
      if (heat) {
        lines.push(
          heat.verdict === 'in its element'
            ? `${heat.exposure.toFixed(0)} units on the heat — in its element`
            : `${heat.exposure.toFixed(1)} units on the heat — ${heat.verdict} (×${heat.fit.toFixed(2)})`,
        );
      }
      if (tags.includes('prepped')) {
        // For a cut, the grade is uniformity: how much of its worth arrives.
        const [lo, hi] = UNIFORMITY[held.quality];
        lines.push(
          lo === hi
            ? `Perfectly even — contributes its full worth`
            : `Cut evenness: contributes ${Math.round(lo * 100)}–${Math.round(hi * 100)}% of its worth`,
        );
      }
      if (disc.favoredPrep && tags.includes(disc.favoredPrep)) {
        lines.push(`Cut the way the ${disc.benchName ?? disc.name} likes it`);
      }
      lines.push(`Tags: ${tags.join(', ')}`);
      if (mat?.consumable) lines.push('Already edible on its own');
      return { head: `${mat?.icon ?? '📦'} ${mat?.name ?? held.id}`, lines };
    }
    if (slot.picks === 'tool') {
      lines.push('Worked with, not into — never spent');
      lines.push('A better tool splits fewer slabs and cuts cleaner');
    } else if (slot.role === 'adornment') {
      const effect = adornmentEffectAt(held.id, held.quality, ctx);
      lines.push(`Adds: ${describeRuneEffect(effect)}`);
    } else {
      lines.push('Scales everything cut into it');
    }
    if (mat?.desc) lines.push(mat.desc);
    return { head: `${mat?.icon ?? '📦'} ${mat?.name ?? held.id}`, lines };
  }

  /**
   * A tray's caption. Slot names are written for tooltips ("Second Ingredient"),
   * so the ordinal is dropped and the rest lower-cased to sit under an icon.
   */
  function stationName(slot: CraftSlotDef): string {
    return slot.name.replace(/^(First|Second|Third|Fourth)\s+/i, '').toLowerCase();
  }

  function iconOf(slot: CraftSlotDef, held: GradedStack | undefined): string {
    if (!held) return '';
    if (slotPicks(slot) === 'design') return designBook[held.id]?.icon ?? '🔷';
    return MATERIALS[held.id]?.icon ?? '📦';
  }

  function tintOf(slot: CraftSlotDef, held: GradedStack | undefined): string {
    if (!held) return 'var(--border)';
    if (slotPicks(slot) === 'design') return 'var(--accent)';
    return QUALITY_TIERS[held.quality].color;
  }
</script>

{#snippet cell(slot: CraftSlotDef | undefined, big = false)}
  {#if slot}
    {@const held = bench[slot.id]}
    <Tip>
      <button
        class="cell"
        class:big
        class:filled={!!held}
        class:open={picking === slot.id}
        style="--tint: {tintOf(slot, held)}"
        onclick={() => (picking = picking === slot.id ? null : slot.id)}
        aria-label={slot.name}
      >
        {#if held}{iconOf(slot, held)}{:else}<span class="plus">+</span>{/if}
      </button>
      {#snippet tip()}
        {#if held}
          {@const info = describePiece(slot, held)}
          <div class="tip-line tip-base">{info.head}</div>
          <div class="tip-line tip-sub">{slot.name}</div>
          {#each info.lines as line}<div class="tip-line">{line}</div>{/each}
        {:else}
          <div class="tip-line tip-base">{slot.name}</div>
          <div class="tip-line tip-sub">
            {slot.optional ? 'Optional' : 'Required'} · click to fill
          </div>
          {#if disc.timeline && slot.at != null && duration}
            <div class="tip-line">
              Enters at unit {Math.round(slot.at * duration)} · {Math.round((1 - slot.at) * duration)} units on the heat
            </div>
          {/if}
        {/if}
      {/snippet}
    </Tip>
  {/if}
{/snippet}

{#snippet tray(station: string, count = 1)}
  {@const slots = Array.from({ length: count }, (_, i) => slotAt(station, i)).filter(Boolean)}
  {#if slots.length}
    <div class="station">
      <div class="cells">
        {#each slots as slot (slot!.id)}{@render cell(slot)}{/each}
      </div>
      <!-- The caption is the slot's own name, so a discipline never needs the
           bench to know its vocabulary. Several slots share the first one's. -->
      <span class="cap">{stationName(slots[0]!)}</span>
    </div>
  {/if}
{/snippet}

<div class="bench-panel" class:panel={!large} class:large>
  <div class="head" class:hidden={large}>
    <h3>{disc.icon} {disc.name}</h3>
    <div class="ctx small" class:hidden={!carving}>
      {#each ['weapon', 'armor', 'accessory'] as const as c}
        <button class="ctx-btn" class:on={ctx === c} onclick={() => (ctx = c)}>
          {c === 'weapon' ? '⚔️' : c === 'armor' ? '🛡️' : '💍'}
        </button>
      {/each}
    </div>
  </div>

  {#if large && carving}
    <div class="ctx-row small">
      <span class="dim">Showing effects in a</span>
      {#each ['weapon', 'armor', 'accessory'] as const as c}
        <button class="ctx-btn" class:on={ctx === c} onclick={() => (ctx = c)}>
          {c === 'weapon' ? '⚔️ weapon' : c === 'armor' ? '🛡️ armor' : '💍 accessory'}
        </button>
      {/each}
    </div>
  {/if}

  {#if disc.timeline}
    <!-- The stove's other dial: how long the whole cook runs. Every entry
         point's exposure follows from it, so the same layout simmered longer
         is a different dish. -->
    <div class="ctx-row small">
      <span class="dim">Cook for</span>
      {#each disc.timeline.options as opt (opt.units)}
        <button class="ctx-btn" class:on={duration === opt.units} onclick={() => (chosenUnits = opt.units)}>
          {opt.name} · {opt.units}
        </button>
      {/each}
    </div>
  {/if}

  {#if ordered}
    <!--
      The strip. Read left to right exactly once, which is why it is drawn as a
      line with arrows on it rather than as a bench with corners: the shape of
      the control is the shape of the mechanic.
    -->
    <div class="strip">
      {#each open as slot, i (slot.id)}
        {#if i > 0}<span class="arrow" aria-hidden="true">→</span>{/if}
        <div class="step">
          {@render cell(slot, true)}
          <span class="cap">{bench[slot.id] ? `#${stepNumber(slot.id)}` : slot.name}</span>
          <div class="nudge" class:hidden={!bench[slot.id]}>
            <button class="tiny" aria-label="Earlier" onclick={() => shift(slot.id, -1)}>◀</button>
            <button class="tiny" aria-label="Later" onclick={() => shift(slot.id, 1)}>▶</button>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="bench">
      {@render tray('topLeft')}

      <!-- The base, with its other centre slots around it: one above, two below. -->
      <div class="slab">
        <div class="slab-label">{baseSlot?.name ?? ''}</div>
        {@render cell(cuts[0])}
        {@render cell(baseSlot, true)}
        <div class="lower-cuts">
          {@render cell(cuts[1])}
          {@render cell(cuts[2])}
        </div>
      </div>

      {@render tray('topRight')}
      {@render tray('bottomLeft', 2)}
      {@render tray('bottomRight')}
    </div>
  {/if}

  {#if coming}
    <div class="locked small dim">🔒 {coming.slot.name} at {SKILLS[disc.skill]?.name ?? disc.skill} {coming.level}</div>
  {/if}

  <!--
    The picker lives in a WELL that is always present, open or not, and always
    the same height. Reserving the space is the whole point: a bench that grows
    when you click a slot re-centres the window under the cursor, which makes
    laying out a sequence — where you click slot after slot — genuinely hard to
    aim at. Nothing here changes the bench's height; the options scroll inside.
  -->
  <div class="picker-well">
    {#if picking}
      {@const slot = open.find((s) => s.id === picking)!}
      {@const options = optionsFor(slot)}
      <div class="picker">
        <div class="picker-head small">
          <b>{slot.name}</b>
          <button class="tiny" onclick={() => put(slot.id, undefined)}>clear</button>
          <button class="tiny" onclick={() => (picking = null)}>✕</button>
        </div>
        {#if options.length}
          <div class="opts">
          {#each options as opt (opt.stack.id + opt.stack.quality)}
            <Tip>
              <button
                class="cell opt"
                style="--tint: {opt.color}"
                onclick={() => put(slot.id, opt.stack)}
                aria-label={opt.name}
              >
                {opt.icon}
                {#if opt.qty > 1}<span class="qty">{opt.qty}</span>{/if}
              </button>
              {#snippet tip()}
                <div class="tip-line tip-base">{opt.icon} {opt.name}</div>
                <div class="tip-line tip-sub">
                  {opt.note}{opt.qty ? ` · ${opt.qty} held` : ''}
                </div>
                {#if slotPicks(slot) === 'design' && carving}
                  <div class="tip-line">
                    {describeRuneEffect(patternEffectAt(opt.stack.id, slabGrade, ctx))}
                  </div>
                {:else if slotPicks(slot) === 'design'}
                  <div class="tip-line">Cut grade rolls from your skill, capped by the ingredient</div>
                {:else if slot.role === 'adornment'}
                  <div class="tip-line">
                    {describeRuneEffect(adornmentEffectAt(opt.stack.id, opt.stack.quality, ctx))}
                  </div>
                {:else}
                  <div class="tip-line">×{QUALITY_TIERS[opt.stack.quality].mult} strength</div>
                {/if}
              {/snippet}
            </Tip>
          {/each}
          </div>
        {:else}
          <div class="small dim">Nothing you own belongs here.</div>
        {/if}
      </div>
    {:else}
      <div class="picker-idle small dim">
        {ordered ? 'Click a step to fill it — order is the recipe.' : 'Click a slot to fill it.'}
      </div>
    {/if}
  </div>

  <div class="result">
    {#if refining}
      <!--
        A refining bench's preview is the LADDER: what is on the bench, the
        grade it would reach, and the two costs that decide whether it is worth
        doing. Nothing new comes out, so there is no product to draw — the
        interesting thing is the step, and what it takes.
      -->
      {#if subject && subjectDef && target}
        {@const cost = refineCost(target)}
        <Tip block>
          <div class="preview" style="--tint: {QUALITY_TIERS[target].color}">
            <span class="pv-name">
              <b>{subjectDef.icon} {subjectDef.name}</b>
              <span class="dim">{QUALITY_TIERS[subject.quality].name} → {QUALITY_TIERS[target].name}</span>
            </span>
            <span class="odds small">
              <span class:risky={heldCopies < REFINE_COPIES}>🧬 {heldCopies}/{REFINE_COPIES}</span>
              <span class:risky={(gs.materials.biomatter ?? 0) < cost}>🩸 {fmt(cost)}</span>
            </span>
          </div>
          {#snippet tip()}
            <div class="tip-line tip-base">{subjectDef.icon} {subjectDef.name}</div>
            <div class="tip-line tip-sub">
              Two of a grade, held against each other until the better one wins.
            </div>
            <div class="tip-line">
              🧬 spends {REFINE_COPIES} × {QUALITY_TIERS[subject.quality].name} — you hold {heldCopies}
            </div>
            <div class="tip-line">
              🩸 burns {fmt(cost)} biomatter — you have {fmt(gs.materials.biomatter ?? 0)}
            </div>
            <div class="tip-line tip-sub">
              Tier never moves. A gene refined to Divine is the same species it was pulled from.
            </div>
          {/snippet}
        </Tip>
      {:else if subject && !target}
        <div class="dim small">Nothing refines past Divine.</div>
      {:else}
        <div class="dim small">Put a gene or a mutagen on the bench.</div>
      {/if}
    {:else if ordered && potion?.ok && potion.spec}
      <!--
        Alchemy's preview is the READING: not just what comes out, but the
        alembic's line-by-line account of how the sequence produced it. That is
        the whole teaching surface — a player who reads it twice knows why
        moving the salt one step later changed everything.
      -->
      {@const spec = potion.spec}
      {@const kind = BREW_FORMS[spec.form]}
      <Tip block>
        <div class="preview" class:named={!!potion.formula} style="--tint: {QUALITY_TIERS[brewGrade(spec)].color}">
          <span class="pv-name"><b>{spec.icon} {spec.name}</b></span>
          {#if potion.formula}<span class="known">known formula</span>{/if}
          <span class="odds small">
            <span>⚡ {spec.volatility.toFixed(2)}</span>
            <span>◆ {spec.potency.toFixed(1)}</span>
          </span>
        </div>
        {#snippet tip()}
          <div class="tip-line tip-base">{spec.icon} {spec.name}</div>
          <div class="tip-line tip-sub">{kind.desc}</div>
          {#each spec.notes as note}<div class="tip-line">{note}</div>{/each}
          <div class="tip-line tip-sub">
            {spec.form === 'oil' ? `What each blow carries — ${spec.blows} blows of it` : 'What it does'}
          </div>
          {#each spec.strikes as s}
            <!-- An oil's numbers are PER BLOW; a flask's are the whole burst.
                 Saying which is the difference between "that looks weak" and
                 "that is a coating". -->
            <div class="tip-line">
              💥 {s.power < 10 ? s.power.toFixed(1) : Math.round(s.power)} {s.type}{spec.form === 'oil' ? ' per blow' : ''}{s.penetration ? ` · ${pct(s.penetration)} through armor` : ''}
            </div>
          {/each}
          {#each spec.restore as r}
            <div class="tip-line">💚 restores {Math.round(r.amount)} {r.resource}</div>
          {/each}
          {#each spec.grants as g}
            <div class="tip-line">✨ {STATUSES[g.id]?.name ?? g.id} ×{(g.intensity ?? 1).toFixed(2)} for {((g.duration as number) / 10).toFixed(0)}s</div>
          {/each}
          {#each spec.inflicts as inf}
            <div class="tip-line">☠️ inflicts {STATUSES[inf.id]?.name ?? inf.id} ×{(inf.intensity ?? 1).toFixed(2)}</div>
          {/each}
          {#each spec.cures as c}<div class="tip-line">🩹 clears {c}</div>{/each}
          <div class="tip-line tip-total">Worth about {fmt(spec.value)} gold</div>
        {/snippet}
      </Tip>
    {:else if !carving && !ordered && dish?.ok}
      <!-- Cooking: what comes out, and at what grade the basket earned. -->
      <div class="preview" style="--tint: {QUALITY_TIERS[dish.quality!].color}">
        <span class="pv-name"><b>{dish.outcome?.icon} {dish.label}</b></span>
      </div>
    {:else if carving && preview && carve?.ok}
      <Tip block>
        <div class="preview" class:named={!!named}>
          <span class="pv-name"><b>{preview.icon} {preview.name}</b></span>
          {#if named}<span class="known">known work</span>{/if}
          <span class="odds small">
            <span class:risky={(carve?.failure ?? 0) > 0.35}>💥 {pct(carve?.failure ?? 0)}</span>
            {#if (carve?.upgrade ?? 0) > 0}
              <span class="good">✨ {pct(carve?.upgrade ?? 0)}</span>
            {/if}
          </span>
        </div>
        {#snippet tip()}
          <div class="tip-line tip-base">{preview.icon} {preview.name}</div>
          {#if preview.desc}<div class="tip-line">{preview.desc}</div>{/if}
          {#each ['weapon', 'armor', 'accessory'] as const as c}
            {#if preview.effects[c]}
              <div class="tip-line tip-sub">
                {c === 'weapon' ? '⚔️ In a weapon' : c === 'armor' ? '🛡️ In armor' : '💍 In an accessory'}:
              </div>
              <div class="tip-line">{describeRuneEffect(preview.effects[c])}</div>
            {/if}
          {/each}
          <div class="tip-line tip-sub">💥 {pct(carve?.failure ?? 0)} chance the slab splits</div>
          {#if (carve?.upgrade ?? 0) > 0}
            <div class="tip-line tip-sub">✨ {pct(carve?.upgrade ?? 0)} chance of a clean cut</div>
          {/if}
          <div class="tip-line tip-total">Worth about {fmt(preview.value)} gold</div>
        {/snippet}
      </Tip>
    {:else}
      <div class="small dim">{reason ?? 'Lay something out to begin.'}</div>
    {/if}
  </div>

  <div class="bench-actions">
    {#if job}
      <!-- Work underway: the bar is the craft in progress, the caption the run. -->
      {@const single = job.done === 0 && job.remaining === 1}
      <div class="run">
        <div class="bar">
          <div
            class="fill"
            style="width: {((1 - Math.max(0, job.ticksLeft) / job.ticksPer) * 100).toFixed(1)}%"
          ></div>
        </div>
        <span class="small dim">
          ⏳ {(Math.max(0, job.ticksLeft) / 10).toFixed(1)}s
          {#if !single}
            · {job.done}{job.remaining != null ? ` / ${job.done + job.remaining}` : ''} done
          {/if}
          {#if job.batch > 1}· ×{job.batch} per pass{/if}
        </span>
      </div>
      <button class="small" onclick={() => game.stopBenchWork()}>⏹ Stop</button>
    {:else}
      <button disabled={!ok} onclick={work}>{disc.icon} {disc.verb ?? (carving ? 'Carve' : 'Cook')}</button>
      {#if disc.outcomes.some((o) => o.result.kind === 'prepped' || o.result.kind === 'brewed')}
        <!-- Batch runs: the same cut, over and over, on the clock. -->
        <button class="small" disabled={!ok || baseHeld < 2} onclick={() => startRun(Math.min(5, baseHeld))}>
          ×{Math.min(5, Math.max(2, baseHeld))}
        </button>
        <button class="small" disabled={!ok || baseHeld < 2} onclick={() => startRun(baseHeld)}>
          All {baseHeld > 1 ? baseHeld : ''}
        </button>
        <button class="small" disabled={!ok} onclick={() => startRun(null)}>Keep going</button>
      {/if}
      <button class="small" onclick={clear}>Clear</button>
    {/if}
  </div>

  {#if ordered && gs.flasks?.length}
    <div class="carved">
      <div class="small dim">
        On the shelf — a flask remembers its sequence, so it is always exactly what it says
      </div>
      <div class="opts">
        {#each gs.flasks as flask, i (i)}
          {@const spec = resolveBrew(flask)}
          <Tip>
            <span
              class="cell opt static"
              style="--tint: {QUALITY_TIERS[brewGrade(spec)].color}"
              aria-label={spec.name}
            >{spec.icon}</span>
            {#snippet tip()}
              <div class="tip-line tip-base">{spec.icon} {spec.name}</div>
              <div class="tip-line tip-sub">
                {flask.steps.map((s) => MATERIALS[s.id]?.name ?? s.id).join(' → ')}
              </div>
              <div class="tip-line">{BREW_FORMS[spec.form].desc}</div>
            {/snippet}
          </Tip>
        {/each}
      </div>
    </div>
  {/if}

  {#if carving && gs.carved?.length}
    <div class="carved">
      <div class="small dim">Carved and unsocketed — socket them from the Equipment tab</div>
      <div class="opts">
        {#each gs.carved as carving, i (i)}
          {@const rune = resolveRune(carving)}
          <Tip>
            <span
              class="cell opt static"
              style="--tint: {QUALITY_TIERS[carving.stone.quality].color}"
              aria-label={rune.name}
            >{rune.icon}</span>
            {#snippet tip()}
              <div class="tip-line tip-base">{rune.icon} {rune.name}</div>
              <div class="tip-line tip-sub">
                {carving.patterns.length} cut{carving.patterns.length > 1 ? 's' : ''} ·
                {QUALITY_TIERS[carving.stone.quality].name} slab
              </div>
              {#each ['weapon', 'armor', 'accessory'] as const as c}
                {#if rune.effects[c]}
                  <div class="tip-line">
                    {c === 'weapon' ? '⚔️' : c === 'armor' ? '🛡️' : '💍'}
                    {describeRuneEffect(rune.effects[c])}
                  </div>
                {/if}
              {/each}
            {/snippet}
          </Tip>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  /* Embedded, the bench is a tool and stays narrow. Opened as furniture it
     gets room: bigger cells, more air, and the picker laid out beside it. */
  .bench-panel {
    max-width: 460px;
  }

  .bench-panel.large {
    max-width: none;
  }

  .head.hidden {
    display: none;
  }

  .ctx-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    color: var(--text-dim);
  }

  .large .bench {
    gap: 12px 40px;
    padding: 18px;
  }

  .large .cell {
    width: 42px;
    height: 42px;
    font-size: 21px;
    border-radius: 6px;
  }

  .large .cell.big {
    width: 56px;
    height: 56px;
    font-size: 27px;
  }

  .large .cell .plus {
    font-size: 18px;
  }

  .large .qty {
    font-size: 10px;
  }

  .large .cap {
    font-size: 12px;
  }

  .large .slab {
    gap: 6px;
    padding: 12px 26px;
  }

  .large .lower-cuts,
  .large .cells {
    gap: 6px;
  }

  .large .picker-well {
    height: 216px;
  }

  .large .picker {
    padding: 10px 12px;
  }

  .large .opts {
    gap: 6px;
  }

  .large .result {
    min-height: 34px;
  }

  .head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 6px;
  }

  .head h3 {
    margin: 0;
  }

  .ctx {
    margin-left: auto;
    display: flex;
    gap: 2px;
  }

  .ctx.hidden {
    visibility: hidden;
  }

  .ctx-btn {
    padding: 1px 5px;
    line-height: 1.3;
    opacity: 0.45;
  }

  .ctx-btn.on {
    opacity: 1;
    border-color: var(--accent);
  }

  /* Two rows of stations with the slab spanning both, down the middle. */
  .bench {
    display: grid;
    grid-template-columns: auto auto auto;
    gap: 6px 14px;
    justify-content: center;
    align-items: center;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg-raised);
  }

  .slab {
    grid-column: 2;
    grid-row: 1 / span 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: 40% / 16%;
    background: var(--bg-panel);
  }

  .lower-cuts {
    display: flex;
    gap: 3px;
  }

  /* An ordered bench: one line, left to right, with the arrows saying so. */
  .strip {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    flex-wrap: wrap;
    gap: 4px;
    padding: 10px 8px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg-raised);
  }

  .strip .arrow {
    align-self: center;
    margin-top: -12px;
    color: var(--text-dim);
    font-size: 12px;
  }

  .step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 46px;
  }

  .nudge {
    display: flex;
    gap: 2px;
  }

  .nudge.hidden {
    visibility: hidden;
  }

  .nudge .tiny {
    margin: 0;
    padding: 0 3px;
    font-size: 9px;
    line-height: 1.3;
  }

  .station {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .cells {
    display: flex;
    gap: 3px;
  }

  .cap {
    font-size: 10px;
    color: var(--text-dim);
  }

  .cell {
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    font-size: 14px;
    line-height: 1;
    border: 1px solid var(--tint, var(--border));
    border-radius: 4px;
    background: var(--bg);
    position: relative;
  }

  .cell.big {
    width: 36px;
    height: 36px;
    font-size: 17px;
  }

  .cell.filled {
    background: color-mix(in srgb, var(--tint) 22%, var(--bg));
  }

  .cell.open {
    outline: 1px solid var(--accent);
  }

  .cell .plus {
    color: var(--text-dim);
    font-size: 13px;
  }

  .cell.static {
    cursor: default;
  }

  .qty {
    position: absolute;
    right: 1px;
    bottom: 0;
    font-size: 8px;
    color: var(--text-dim);
  }

  .locked {
    font-size: 10px;
    margin-top: 3px;
  }

  /* Fixed height, always present: the bench must not change size when a slot
     is clicked, or the centred window walks away from the cursor. */
  .picker-well {
    height: 168px;
    margin-top: 6px;
    display: flex;
  }

  .picker {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 6px 8px;
    border: 1px solid var(--accent);
    border-radius: 8px;
    background: var(--bg-raised);
  }

  /* Only the options scroll, so "clear" and "✕" never leave the screen. */
  .picker .opts {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    align-content: flex-start;
  }

  .picker-idle {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px dashed var(--border);
    border-radius: 8px;
  }

  .picker-head {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 5px;
  }

  .picker-head .tiny {
    margin-left: 0;
    padding: 0 5px;
    font-size: 10px;
  }

  .picker-head .tiny:first-of-type {
    margin-left: auto;
  }

  /* Components read as a grid of graded squares — the border IS the grade. */
  .opts {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }

  .result {
    min-height: 26px;
    margin: 7px 0 6px;
  }

  .preview {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-raised);
  }

  .preview.named {
    border-color: var(--accent);
  }

  .pv-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .known {
    font-size: 9px;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .odds {
    margin-left: auto;
    display: flex;
    gap: 7px;
    white-space: nowrap;
    color: var(--text-dim);
  }

  .odds .risky { color: var(--danger); }
  .odds .good { color: var(--xp); }

  .bench-actions {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }

  .run {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 140px;
    color: var(--text-dim);
  }

  .bar {
    height: 6px;
    border: 1px solid var(--border);
    border-radius: 3px;
    background: var(--bg);
    overflow: hidden;
  }

  .bar .fill {
    height: 100%;
    background: var(--accent);
    transition: width 120ms linear;
  }

  .carved {
    margin-top: 9px;
    padding-top: 7px;
    border-top: 1px solid var(--border);
  }

  .carved .opts {
    margin-top: 4px;
  }
</style>
