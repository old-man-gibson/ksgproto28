<script lang="ts">
  import { gs, game, view } from '../state.svelte';
  import { MATERIALS, PART_KINDS, RECIPES, ITEM_CLASSES } from '../../core/registry';
  import { SLOT_NAMES } from '../../core/types';
  import type { ForgeSlot, PartKindDef } from '../../core/types';
  import { clonePlacement, forgeTicks, neighbours, placementKey } from '../../core/systems/assembly';
  import { FORGING, formKnown, previewForge } from '../../core/systems/forging';
  import { benchPace } from '../../core/systems/benchwork';
  import { recipeHidden, recipeResultName } from '../../core/systems/crafting';
  import { WIELD_NAMES, familySkillFor } from '../../core/systems/wield';
  import { conditionsMet } from '../../core/systems/conditions';
  import { ticksToTime } from '../lib/format';
  import { anvil, setLayout, syncAnvil } from '../lib/anvil.svelte';
  import {
    COMPARE_COLUMNS,
    cellsOfMaterial,
    compareKinds,
    distinctNeighbours,
    familiesOf,
    familyOf,
    kindLabel,
    kindRowLabel,
    kindsOfFamily,
    materialColor,
    materialLabel,
    neighbourLabel,
    offeredMaterials,
    pairStatLines,
    pieceLines,
    slotRole,
    withPart,
    type PartFamilyId,
  } from '../lib/anvilView';
  import ForgeSilhouette from '../lib/ForgeSilhouette.svelte';
  import FormChart from './FormChart.svelte';

  /**
   * The anvil: five slots, a part kind and a material in each, and the screen
   * says what the proportions make before anything is spent. Every number
   * comes from `previewForge` (systems/forging.ts); this panel lays them out
   * and edits the layout, which lives in `anvil` so closing the window keeps it.
   */

  // The layout is this run's: a hard reset, an import or a prestige since it was last used clears it.
  syncAnvil(gs);
  $effect.pre(() => syncAnvil(gs));

  /** What is on the anvil. The forge buttons, their reason and "one change away" read this, never a preview. */
  const placement = $derived(anvil.placement);
  const preview = $derived(previewForge(gs, placement));
  /** Nothing placed: an empty layout still resolves (to the last class), but there is nothing to say about it. */
  const empty = $derived(preview.parts.length === 0);
  const knownCount = $derived(Object.keys(ITEM_CLASSES).filter((id) => formKnown(gs, id)).length);
  const totalCount = Object.keys(ITEM_CLASSES).length;

  // ---- Previewing a kind from the comparison table ----
  /** The kind the pointer or the keyboard is on in a table: drawn and priced everywhere, applied nowhere. */
  let hover = $state.raw<{ slot: ForgeSlot; kind: string } | null>(null);
  /**
   * The anvil with that kind in its slot; null when nothing is hovered or it would change nothing.
   * A row that left the page without a pointer-leave (its slot shut, or locked under it) ends the preview too.
   */
  const hoverPlacement = $derived.by(() => {
    if (!hover || anvil.open !== hover.slot || preview.slotLocks[hover.slot] !== undefined) return null;
    const next = withPart(placement, hover.slot, hover.kind);
    return next && placementKey(next) !== placementKey(placement) ? next : null;
  });
  const previewing = $derived(hoverPlacement !== null);
  /** The layout the drawing and the middle column show. */
  const shownPlacement = $derived(hoverPlacement ?? placement);
  const shown = $derived(hoverPlacement ? previewForge(gs, hoverPlacement) : preview);
  const cls = $derived(shown.class);
  const known = $derived(formKnown(gs, cls.id));
  /** A previewed form is "?" until the save has made it, as in the table and "one change away". */
  const shownName = $derived(previewing && !known ? '?' : shown.def.name);
  /** Every line of the middle column, a previewed value set against the current one. */
  const lines = $derived(
    pairStatLines(pieceLines(preview.stats, preview.def.mods), pieceLines(shown.stats, shown.def.mods)),
  );

  /** The bench run underway at the anvil, if any. */
  const job = $derived(gs.benchWork?.disciplineId === FORGING.id ? gs.benchWork : null);
  // The clock `benchJobTicks` gives an assembling bench, read from the shared derived stats
  // (PITFALLS §4) instead of calling getDerivedStats here; tests/anvilview.test.ts pins the two equal.
  const pace = $derived(benchPace(view.stats.craftSpeed, forgeTicks(shownPlacement)));
  /** How many pieces the pack could pay for. */
  const affordableCopies = $derived(
    preview.cost.length ? Math.min(...preview.cost.map((c) => Math.floor(c.held / c.qty))) : 0,
  );
  const batchCopies = $derived(Math.min(5, affordableCopies));

  const slotName = (slot: ForgeSlot) => FORGING.slots.find((s) => s.id === slot)?.name ?? slot;

  // ---- The family chip and the requirement check ----
  const family = $derived(cls.slot === 'weapon' || cls.slot === 'offhand' ? cls.tags[0] : undefined);
  const familyClaimed = $derived(family ? familySkillFor(family) !== undefined : true);
  const meetsRequirement = $derived(conditionsMet(gs, shown.def.requirements ?? []));

  /** The recipe line that makes the same piece, if one is listed to this player. */
  const twin = $derived(
    Object.values(RECIPES).find(
      (r) => r.forge && !recipeHidden(gs, r) && placementKey(r.forge) === placementKey(shownPlacement),
    ),
  );

  // ---- One change away ----
  /** One-change buttons shown before "show all". */
  const NEAR_LIMIT = 10;
  let nearOpen = $state(false);
  let showAllNear = $state(false);
  const near = $derived(distinctNeighbours(neighbours(placement), preview.slotLocks));
  const nearShown = $derived(showAllNear ? near : near.slice(0, NEAR_LIMIT));

  // ---- The slot pickers ----
  /** The family a slot's table lists: the one picked by hand, else the held part's, else the role's only one. */
  function activeFamily(slot: ForgeSlot): PartFamilyId | undefined {
    const picked = anvil.family[slot];
    if (picked) return picked;
    const families = familiesOf(slotRole(slot));
    if (families.length === 1) return families[0].id;
    const held = placement[slot] ? PART_KINDS[placement[slot].kind] : undefined;
    return held ? familyOf(held).id : undefined;
  }

  /** Opens a slot's picker and shuts the one that was open; the open one shuts again. */
  function toggleSlot(slot: ForgeSlot) {
    hover = null;
    if (anvil.open === slot) {
      anvil.open = null;
      return;
    }
    anvil.open = slot;
    delete anvil.family[slot];
  }

  function pickFamily(slot: ForgeSlot, id: PartFamilyId) {
    hover = null;
    anvil.family[slot] = id;
  }

  function previewKind(slot: ForgeSlot, kind: string) {
    hover = { slot, kind };
  }

  /** Only the row that set the preview ends it: moving from one row to the next must not clear the new one. */
  function endPreview(slot: ForgeSlot, kind: string) {
    if (hover?.slot === slot && hover.kind === kind) hover = null;
  }

  // ---- Edits: every edit replaces the layout, never mutates it ----
  function setPart(slot: ForgeSlot, kindId: string | null) {
    const next = withPart(placement, slot, kindId);
    if (!next) return;
    hover = null;
    anvil.placement = next;
    if (!kindId) delete anvil.family[slot];
  }

  function setMaterial(slot: ForgeSlot, mat: string) {
    const next = clonePlacement(placement);
    const part = next[slot];
    if (!part) return;
    next[slot] = { ...part, mat };
    anvil.placement = next;
  }

  function stepQty(slot: ForgeSlot, delta: number) {
    const next = clonePlacement(placement);
    const part = next[slot];
    const kind = part ? PART_KINDS[part.kind] : undefined;
    if (!part || !kind) return;
    const qty = Math.max(1, Math.min(kind.qtyMax ?? 1, (part.qty ?? 1) + delta));
    next[slot] = { kind: part.kind, mat: part.mat, ...(qty > 1 ? { qty } : {}) };
    anvil.placement = next;
  }

  function clear() {
    hover = null;
    setLayout({});
  }
</script>

{#snippet glyph(kind: PartKindDef)}
  <!-- The kind's footprint at a glance: one 3px square per cell, capped at 4×10. -->
  <span class="glyph" style="grid-template-columns: repeat({Math.min(kind.w, 4)}, 3px)" aria-hidden="true">
    {#each { length: Math.min(kind.w, 4) * Math.min(kind.l, 10) } as _}<i></i>{/each}
  </span>
{/snippet}

<div class="anvil">
  <div class="view-switch">
    <button
      aria-pressed={anvil.view === 'anvil'}
      class:selected={anvil.view === 'anvil'}
      onclick={() => (anvil.view = 'anvil')}>Anvil</button
    >
    <button
      aria-pressed={anvil.view === 'chart'}
      class:selected={anvil.view === 'chart'}
      onclick={() => (anvil.view = 'chart')}
    >
      Form chart <span class="dim small">{knownCount} of {totalCount}</span>
    </button>
  </div>

  {#if anvil.view === 'chart'}
    <div class="chart-view"><FormChart /></div>
  {:else}
    <!-- Three columns that scroll on their own: the piece and the forge buttons,
         what it resolves to, and the parts. Changing a part never moves the
         numbers out of view. -->
    <div class="work">
      <div class="col col-piece">
        <div class="plate" class:previewing>
          <ForgeSilhouette
            placement={shownPlacement}
            label={empty ? 'Empty anvil' : previewing ? `Preview: ${shownName}` : preview.def.name}
          />
          {#if previewing}<span class="plate-caption">Preview</span>{/if}
        </div>

        <div class="run-bar">
          {#if job}
            {@const single = job.done === 0 && job.remaining === 1}
            <div class="run">
              <div class="progress">
                <div
                  class="progress-fill"
                  style="width: {((1 - Math.max(0, job.ticksLeft) / job.ticksPer) * 100).toFixed(1)}%"
                ></div>
              </div>
              <span class="small dim">
                {(Math.max(0, job.ticksLeft) / 10).toFixed(1)}s
                {#if !single}
                  · {job.done}{job.remaining != null ? ` / ${job.done + job.remaining}` : ''} done
                {/if}
                {#if job.batch > 1}· ×{job.batch} per pass{/if}
              </span>
            </div>
            <button class="small" onclick={() => game.stopBenchWork()}>Stop</button>
          {:else}
            <button disabled={!preview.ok} onclick={() => game.forge(placement, 1)}>
              {FORGING.icon} {FORGING.verb}
            </button>
            {#if affordableCopies >= 2}
              <button class="small" disabled={!preview.ok} onclick={() => game.forge(placement, batchCopies)}>
                ×{batchCopies}
              </button>
              <button class="small" disabled={!preview.ok} onclick={() => game.forge(placement, null)}>
                Until out of stock
              </button>
            {/if}
            <button class="small" onclick={clear}>Clear</button>
          {/if}
        </div>
        {#if !preview.ok && !job}
          <div class="small reason">{preview.reason}</div>
        {/if}
      </div>

      <div class="col col-info">
        {#if empty}
          <div>
            <div class="small dim">Resolves to</div>
            <h3 class="form-name">Nothing</h3>
          </div>
          <div class="small dim">The anvil is empty. Open a slot in the list of parts and choose a part kind.</div>
        {:else}
          <div>
            <div class="small dim">{previewing ? 'Would resolve to' : 'Resolves to'}</div>
            <h3 class="form-name">{shownName}</h3>
          </div>
          {#if previewing && hover}
            <div class="note small">
              Preview, not applied: {kindLabel(PART_KINDS[hover.kind])} in the {slotName(hover.slot).toLowerCase()} slot.
              A changed line reads current → preview. Click the row to apply it.
            </div>
          {/if}
          <div class="chips">
            <span class="chip">{SLOT_NAMES[cls.slot]}</span>
            {#if cls.wield}<span class="chip">{WIELD_NAMES[cls.wield]}</span>{/if}
            <!-- The family tag is the form's own name for most weapons: not shown for a previewed form still masked as "?". -->
            {#if family && !(previewing && !known)}
              {#if familyClaimed}
                <span class="chip">family: {family}</span>
              {:else}
                <span class="chip warn" title="It equips and fights, but no combat skill trains on it.">
                  family: {family}, no combat skill claims it
                </span>
              {/if}
            {/if}
            {#if cls.degenerate}<span class="chip deg">degenerate form</span>{/if}
            {#if !known}<span class="chip new">new form: added to the chart when forged</span>{/if}
          </div>
          {#if cls.degenerate && cls.desc}<div class="small dim">{cls.desc}</div>{/if}

          <dl class="stats">
            {#each lines as line}
              {@const unmet = line.label === 'Requires' && !meetsRequirement}
              <dt class="dim">{line.label}</dt>
              <dd class:short={unmet}>
                {#if line.from !== undefined}<span class="was">{line.from} →</span>{/if}
                {line.value}{unmet ? ' (not met)' : ''}
              </dd>
            {/each}
          </dl>
          <div class="small dim">Drawn at Fair quality. The grade is rolled from Smithing when the piece is finished.</div>

          <div class="bill">
            <div class="small dim">Bill</div>
            {#each shown.cost as line (line.id)}
              <div class="bill-line" class:short={line.held < line.qty}>
                <span>{line.qty} × {MATERIALS[line.id]?.name ?? line.id}</span>
                <span class="dim small">{cellsOfMaterial(shownPlacement, line.id)} cells</span>
                <span class="small">held {line.held}</span>
              </div>
            {:else}
              <div class="small dim">Nothing on the anvil.</div>
            {/each}
            <div class="small">
              <span class="dim">Time:</span>
              {ticksToTime(pace.ticksPer)}{#if pace.batch > 1}<span class="dim"> · ×{pace.batch} per pass</span>{/if}
            </div>
          </div>

          {#if twin}
            <div class="note small">
              Same parts as the <b>{recipeResultName(twin)}</b> recipe. The recipe makes the standard
              {recipeResultName(twin)}; the anvil makes a forged one that keeps its quality roll.
            </div>
          {/if}

          <details class="near" bind:open={nearOpen}>
            <summary class="small dim">Other forms one change away ({near.length})</summary>
            <div class="near-list">
              {#each nearShown as n (n.to.id)}
                <button
                  class="small"
                  onclick={() => {
                    hover = null;
                    setLayout(n.placement);
                  }}
                >
                  {neighbourLabel(n, slotName(n.slot))} → {formKnown(gs, n.to.id) ? n.to.name : '?'}
                </button>
              {:else}
                <span class="small dim">No single change alters the form.</span>
              {/each}
              {#if near.length > NEAR_LIMIT}
                <button class="small more" onclick={() => (showAllNear = !showAllNear)}>
                  {showAllNear ? 'show fewer' : `show all ${near.length}`}
                </button>
              {/if}
            </div>
          </details>
        {/if}
      </div>

      <div class="col col-parts">
        <!-- The five slots as one row each; the open one shows its three steps. -->
        <div class="slots">
          {#each FORGING.slots as def (def.id)}
            {@const slot = def.id as ForgeSlot}
            {@const part = placement[slot]}
            {@const partKind = part ? PART_KINDS[part.kind] : undefined}
            {@const lock = preview.slotLocks[slot]}
            {@const isOpen = anvil.open === slot}
            <section class="slot" class:open={isOpen}>
              <button
                class="part-row"
                class:selected={isOpen}
                aria-expanded={isOpen}
                aria-controls="slot-body-{slot}"
                onclick={() => toggleSlot(slot)}
              >
                <span class="part-row-name">{def.name}</span>
                <span class="part-row-part">
                  {#if lock !== undefined}
                    <span class="dim">Smithing {lock}</span>
                    {#if partKind}<span class="dim">· holds {partKind.name}</span>{/if}
                  {:else if part && partKind}
                    {@render glyph(partKind)}
                    <span>{partKind.name}</span>
                    <span class="dim">{partKind.w}×{partKind.l}</span>
                    <span>
                      <span class="swatch" style="background: {materialColor(part.mat)}"></span>{materialLabel(part.mat)}
                    </span>
                    {#if (part.qty ?? 1) > 1}<span>×{part.qty}</span>{/if}
                  {:else}
                    <span class="dim">empty</span>
                  {/if}
                </span>
                <span class="part-row-chev" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
              </button>

              {#if isOpen}
                <div class="slot-body" id="slot-body-{slot}">
                  {#if lock !== undefined}
                    <div class="small dim">The {def.name.toLowerCase()} slot opens at Smithing {lock}.</div>
                    {#if part}<button class="small" onclick={() => setPart(slot, null)}>Clear the slot</button>{/if}
                  {:else}
                    {@const families = familiesOf(slotRole(slot))}
                    {@const active = activeFamily(slot)}
                    {@const activeName = families.find((f) => f.id === active)?.name}
                    {@const rows = active ? compareKinds(gs, placement, slot, active) : []}

                    <div class="step">
                      <div class="step-label small dim">Shape family</div>
                      <div class="picks">
                        <button class="small" class:selected={!part} aria-pressed={!part} onclick={() => setPart(slot, null)}>
                          none
                        </button>
                        {#if families.length > 1}
                          {#each families as fam (fam.id)}
                            <button
                              class="small"
                              class:selected={active === fam.id}
                              aria-pressed={active === fam.id}
                              title="{fam.name}: {kindsOfFamily(fam.id).length} kinds"
                              onclick={() => pickFamily(slot, fam.id)}
                            >
                              {fam.name} <span class="dim">{kindsOfFamily(fam.id).length}</span>
                            </button>
                          {/each}
                        {:else if active}
                          <span class="small dim">{activeName}: {kindsOfFamily(active).length} kinds</span>
                        {/if}
                      </div>
                    </div>

                    {#if active}
                      <div class="step">
                        <div class="step-label small dim">
                          {activeName}: each row is the piece with that kind in the {def.name.toLowerCase()} slot
                        </div>
                        <div class="kind-table">
                          <div class="kind-head" aria-hidden="true">
                            <span>Kind</span>
                            <span>Makes</span>
                            {#each COMPARE_COLUMNS as col (col.key)}
                              <span class="kind-num-head" title={col.hint}>{col.label}</span>
                            {/each}
                          </div>
                          {#each rows as row (row.kind.id)}
                            <button
                              class="kind-row"
                              class:selected={row.current}
                              aria-pressed={row.current}
                              aria-label={kindRowLabel(row)}
                              title="{row.kind.w}×{row.kind.l} = {row.kind.w * row.kind.l} cells"
                              onclick={() => setPart(slot, row.kind.id)}
                              onpointerenter={(e) => e.pointerType !== 'touch' && previewKind(slot, row.kind.id)}
                              onpointerleave={() => endPreview(slot, row.kind.id)}
                              onfocus={(e) => e.currentTarget.matches(':focus-visible') && previewKind(slot, row.kind.id)}
                              onblur={() => endPreview(slot, row.kind.id)}
                            >
                              <span class="kind-name">
                                <span class="kind-title">
                                  {@render glyph(row.kind)}
                                  <span>{row.kind.name}</span>
                                </span>
                                <span class="dim">{row.kind.w}×{row.kind.l}</span>
                                {#if row.current}<span class="kind-tag">current</span>{/if}
                              </span>
                              <span class="kind-form">
                                <span class="kind-num-label">Makes</span>
                                <span class:dim={!row.known}>{row.form}</span>
                              </span>
                              {#each COMPARE_COLUMNS as col (col.key)}
                                {@const cell = row.cells[col.key]}
                                <span class="kind-num">
                                  <span class="kind-num-label">{col.label}</span>
                                  <span class="kind-value">{cell.text}</span>
                                  {#if cell.delta}
                                    <span
                                      class="kind-delta"
                                      class:better={cell.tone === 'better'}
                                      class:worse={cell.tone === 'worse'}>({cell.delta})</span
                                    >
                                  {/if}
                                </span>
                              {/each}
                            </button>
                          {/each}
                        </div>
                      </div>
                    {:else}
                      <div class="small dim">Choose a shape family to list its kinds.</div>
                    {/if}

                    {#if part && partKind}
                      <div class="step">
                        <div class="step-label small dim">Material{(partKind.qtyMax ?? 1) > 1 ? ' and count' : ''}</div>
                        <div class="mats">
                          {#each offeredMaterials(partKind, gs.materials, part.mat) as mat (mat.id)}
                            <button class="small" class:selected={part.mat === mat.id} onclick={() => setMaterial(slot, mat.id)}>
                              <span class="swatch" style="background: {materialColor(mat.id)}"></span>
                              {mat.name}
                              <span class="dim">{gs.materials[mat.id] ?? 0}</span>
                            </button>
                          {/each}
                          {#if (partKind.qtyMax ?? 1) > 1}
                            <span class="stepper">
                              <span class="small dim">count</span>
                              <button class="small" aria-label="Fewer" disabled={(part.qty ?? 1) <= 1} onclick={() => stepQty(slot, -1)}>−</button>
                              <span>{part.qty ?? 1}</span>
                              <button
                                class="small"
                                aria-label="More"
                                disabled={(part.qty ?? 1) >= (partKind.qtyMax ?? 1)}
                                onclick={() => stepQty(slot, 1)}>+</button
                              >
                            </span>
                          {/if}
                        </div>
                      </div>
                    {/if}
                  {/if}
                </div>
              {/if}
            </section>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Fills the window's body (Modal `fill`): the switch on top, the work area
     takes the rest of the height, and each column scrolls on its own. */
  .anvil {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 12px;
    min-width: 0;
    height: 100%;
    min-height: 0;
  }

  .view-switch {
    display: flex;
    gap: 6px;
  }

  .chart-view {
    min-height: 0;
    overflow: auto;
  }

  .work {
    display: grid;
    grid-template-areas: 'piece info parts';
    grid-template-columns: minmax(170px, 0.7fr) minmax(250px, 1fr) minmax(300px, 1.3fr);
    grid-template-rows: minmax(0, 1fr);
    gap: 18px;
    min-height: 0;
  }

  .col {
    display: grid;
    gap: 9px;
    align-content: start;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    padding-right: 4px;
  }

  .col-piece {
    grid-area: piece;
  }

  .col-info {
    grid-area: info;
  }

  .col-parts {
    grid-area: parts;
  }

  /* Phone: one column, and the window body scrolls instead (Modal `fill`). */
  @media (max-width: 900px) {
    .anvil {
      height: auto;
    }

    .work {
      grid-template-areas:
        'piece'
        'info'
        'parts';
      grid-template-columns: 1fr;
      grid-template-rows: auto;
    }

    .col {
      overflow: visible;
      padding-right: 0;
    }
  }

  /* The plate the piece is drawn on: a well with a faint cell grid. */
  .plate {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 240px;
    padding: 10px;
    background-color: var(--bg-sunken);
    background-image:
      linear-gradient(color-mix(in srgb, var(--border) 45%, transparent) 1px, transparent 1px),
      linear-gradient(90deg, color-mix(in srgb, var(--border) 45%, transparent) 1px, transparent 1px);
    background-size: 20px 20px;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  /* A kind hovered in a table is drawn here, not applied: dashed accent edge and a caption. */
  .plate.previewing {
    border-style: dashed;
    border-color: var(--accent);
  }

  .plate-caption {
    position: absolute;
    top: 6px;
    left: 6px;
    padding: 0 7px;
    font-size: 12px;
    color: var(--accent);
    background: var(--bg-raised);
    border: 1px solid var(--accent);
  }

  .form-name {
    margin: 0;
    font-size: 21px;
    line-height: 1.2;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .chip {
    font-size: 12px;
    padding: 0 7px;
    border: 1px solid var(--border);
    border-radius: 10px;
    color: var(--text-dim);
    white-space: nowrap;
  }

  .chip.warn {
    color: var(--danger);
    border-color: color-mix(in srgb, var(--danger) 55%, var(--border));
    white-space: normal;
  }

  .chip.deg {
    color: var(--skill);
    border-color: color-mix(in srgb, var(--skill) 55%, var(--border));
  }

  .chip.new {
    color: var(--xp);
    border-color: color-mix(in srgb, var(--xp) 55%, var(--border));
  }

  .stats {
    display: grid;
    grid-template-columns: max-content minmax(max-content, 1fr);
    gap: 1px 18px;
    margin: 0;
  }

  .stats dt,
  .stats dd {
    margin: 0;
  }

  .stats dd {
    text-align: right;
  }

  /* The anvil's own value on a previewed line, before the arrow. */
  .was {
    margin-right: 5px;
    color: var(--text-dim);
  }

  .short {
    color: var(--danger);
  }

  .bill {
    display: grid;
    gap: 2px;
  }

  .bill-line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 12px;
  }

  .note {
    border-left: 2px solid var(--accent);
    padding: 4px 10px;
    background: color-mix(in srgb, var(--accent) 6%, transparent);
  }

  .near summary {
    cursor: pointer;
  }

  .near-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 3px;
  }

  .near-list button {
    padding: 1px 7px;
  }

  .run-bar {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }

  .reason {
    color: var(--danger);
  }

  .run {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 140px;
  }

  .progress {
    height: 6px;
    border: 1px solid var(--border);
    background: var(--bg-sunken);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent);
    transition: width 120ms linear;
  }

  .slots {
    display: grid;
    gap: 4px;
  }

  /* One row per slot: its name and what it holds. The open slot's steps hang under its row. */
  button.part-row {
    display: grid;
    grid-template-columns: 7.5em minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 6px 9px;
    text-align: left;
  }

  .part-row-name {
    font-size: 13px;
    font-weight: 600;
  }

  .part-row-part {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 9px;
    min-width: 0;
  }

  .part-row-chev {
    font-size: 16px;
    color: var(--text-dim);
  }

  .slot-body {
    display: grid;
    gap: 10px;
    min-width: 0;
    margin: 2px 0 8px;
    padding: 6px 0 4px 10px;
    border-left: 2px solid var(--accent);
  }

  .step {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .picks,
  .mats {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }

  /* The comparison table: one button per kind. Wide, the numbers are columns under a header;
     in a narrow column each row stacks its name, its form and a strip of labelled numbers. */
  .kind-table {
    container-type: inline-size;
    display: grid;
    gap: 3px;
  }

  .kind-head,
  button.kind-row {
    display: grid;
    grid-template-columns: minmax(0, 2.2fr) minmax(0, 1.1fr) repeat(5, minmax(0, 0.8fr));
    align-items: center;
    gap: 0 8px;
  }

  .kind-head {
    padding: 0 9px;
    align-items: end;
    font-size: 11.5px;
    color: var(--text-dim);
  }

  .kind-num-head {
    text-align: right;
  }

  button.kind-row {
    width: 100%;
    padding: 3px 9px;
    text-align: left;
  }

  .kind-name {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1px 7px;
    min-width: 0;
  }

  /* The glyph stays beside the first word of the name; the size and the tag wrap under them. */
  .kind-title {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }

  .kind-tag {
    font-size: 11.5px;
    color: var(--accent);
  }

  .kind-form {
    display: flex;
    gap: 6px;
    min-width: 0;
  }

  .kind-num {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    line-height: 1.2;
  }

  .kind-num-label {
    display: none;
    font-size: 11px;
    color: var(--text-dim);
  }

  .kind-delta {
    font-size: 11.5px;
    color: var(--text-dim);
  }

  .kind-delta.better {
    color: var(--xp);
  }

  .kind-delta.worse {
    color: var(--danger);
  }

  @container (max-width: 500px) {
    .kind-head {
      display: none;
    }

    button.kind-row {
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 3px 6px;
    }

    .kind-name,
    .kind-form {
      grid-column: 1 / -1;
    }

    .kind-num {
      align-items: flex-start;
    }

    .kind-num-label {
      display: block;
    }
  }

  button.small {
    padding: 2px 7px;
  }

  /* The part's footprint at a glance: one 3px square per cell, capped at 4×10. */
  .glyph {
    display: inline-grid;
    gap: 1px;
  }

  .glyph i {
    display: block;
    width: 3px;
    height: 3px;
    background: var(--text-dim);
  }

  .selected .glyph i {
    background: var(--accent);
  }

  .swatch {
    display: inline-block;
    width: 9px;
    height: 9px;
    margin-right: 4px;
    border: 1px solid var(--bg-sunken);
  }

  .stepper {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-left: 8px;
  }
</style>
