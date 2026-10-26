<script lang="ts">
  import { gs, game, view } from '../state.svelte';
  import { MATERIALS, PART_KINDS, RECIPES, ITEM_CLASSES } from '../../core/registry';
  import { SLOT_NAMES } from '../../core/types';
  import type { ForgeSlot, PartKindDef, PartRole } from '../../core/types';
  import { clonePlacement, forgeTicks, neighbours, placementKey } from '../../core/systems/assembly';
  import { FORGING, formKnown, previewForge } from '../../core/systems/forging';
  import { benchPace } from '../../core/systems/benchwork';
  import { recipeHidden, recipeResultName } from '../../core/systems/crafting';
  import { WIELD_NAMES, familySkillFor } from '../../core/systems/wield';
  import { conditionsMet } from '../../core/systems/conditions';
  import { ticksToTime } from '../lib/format';
  import { anvil, syncAnvil } from '../lib/anvil.svelte';
  import {
    cellsOfMaterial,
    distinctNeighbours,
    materialColor,
    neighbourLabel,
    offeredMaterials,
    pickMaterial,
    statLines,
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

  const placement = $derived(anvil.placement);
  const preview = $derived(previewForge(gs, placement));
  const cls = $derived(preview.class);
  const known = $derived(formKnown(gs, cls.id));
  /** Nothing placed: an empty layout still resolves (to the last class), but there is nothing to say about it. */
  const empty = $derived(preview.parts.length === 0);
  const knownCount = $derived(Object.keys(ITEM_CLASSES).filter((id) => formKnown(gs, id)).length);
  const totalCount = Object.keys(ITEM_CLASSES).length;

  /** The bench run underway at the anvil, if any. */
  const job = $derived(gs.benchWork?.disciplineId === FORGING.id ? gs.benchWork : null);
  // The clock `benchJobTicks` gives an assembling bench, read from the shared derived stats
  // (PITFALLS §4) instead of calling getDerivedStats here; tests/anvilview.test.ts pins the two equal.
  const pace = $derived(benchPace(view.stats.craftSpeed, forgeTicks(placement)));
  /** How many pieces the pack could pay for. */
  const affordableCopies = $derived(
    preview.cost.length ? Math.min(...preview.cost.map((c) => Math.floor(c.held / c.qty))) : 0,
  );
  const batchCopies = $derived(Math.min(5, affordableCopies));

  const slotName = (slot: ForgeSlot) => FORGING.slots.find((s) => s.id === slot)?.name ?? slot;
  const roleOf = (slot: ForgeSlot): PartRole => (slot === 'head2' ? 'head' : (slot as PartRole));
  const kindsByRole = (role: PartRole): PartKindDef[] => Object.values(PART_KINDS).filter((k) => k.role === role);

  // ---- The family chip and the requirement check ----
  const family = $derived(cls.slot === 'weapon' || cls.slot === 'offhand' ? cls.tags[0] : undefined);
  const familyClaimed = $derived(family ? familySkillFor(family) !== undefined : true);
  const meetsRequirement = $derived(conditionsMet(gs, preview.def.requirements ?? []));

  /** The recipe line that makes the same piece, if one is listed to this player. */
  const twin = $derived(
    Object.values(RECIPES).find(
      (r) => r.forge && !recipeHidden(gs, r) && placementKey(r.forge) === placementKey(placement),
    ),
  );

  // ---- One change away ----
  /** One-change buttons shown before "show all". */
  const NEAR_LIMIT = 10;
  let showAllNear = $state(false);
  const near = $derived(distinctNeighbours(neighbours(placement), preview.slotLocks));
  const nearShown = $derived(showAllNear ? near : near.slice(0, NEAR_LIMIT));

  // ---- Edits: every edit replaces the layout, never mutates it ----
  function setPart(slot: ForgeSlot, kindId: string | null) {
    const next = clonePlacement(placement);
    const kind = kindId ? PART_KINDS[kindId] : undefined;
    if (!kind) {
      delete next[slot];
    } else {
      const prev = next[slot];
      // A head follows the other head's material; everything else keeps its own.
      const other = slot === 'head' ? placement.head2?.mat : slot === 'head2' ? placement.head?.mat : undefined;
      const mat = pickMaterial(kind, [prev?.mat, other]);
      if (!mat) return;
      const qty = Math.min(prev?.qty ?? 1, kind.qtyMax ?? 1);
      next[slot] = { kind: kind.id, mat, ...(qty > 1 ? { qty } : {}) };
    }
    anvil.placement = next;
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
    anvil.placement = {};
  }
</script>

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
        <div class="plate">
          <ForgeSilhouette {placement} label={empty ? 'Empty anvil' : preview.def.name} />
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
          <div class="small dim">The anvil is empty. Choose a part kind for a slot below.</div>
        {:else}
          <div>
            <div class="small dim">Resolves to</div>
            <h3 class="form-name">{preview.def.name}</h3>
          </div>
          <div class="chips">
            <span class="chip">{SLOT_NAMES[cls.slot]}</span>
            {#if cls.wield}<span class="chip">{WIELD_NAMES[cls.wield]}</span>{/if}
            {#if family}
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
            {#each statLines(preview.stats, preview.def.mods) as line (line.label + line.value)}
              <dt class="dim">{line.label}</dt>
              <dd>{line.value}</dd>
            {/each}
            {#if preview.stats.str > 0}
              <dt class="dim">Requires</dt>
              <dd class:short={!meetsRequirement}>
                STR {preview.stats.str}{meetsRequirement ? '' : ' (not met)'}
              </dd>
            {/if}
            <dt class="dim">Value</dt>
            <dd>{preview.stats.value} gold</dd>
          </dl>
          <div class="small dim">Drawn at Fair quality. The grade is rolled from Smithing when the piece is finished.</div>

          <div class="bill">
            <div class="small dim">Bill</div>
            {#each preview.cost as line (line.id)}
              <div class="bill-line" class:short={line.held < line.qty}>
                <span>{line.qty} × {MATERIALS[line.id]?.name ?? line.id}</span>
                <span class="dim small">{cellsOfMaterial(placement, line.id)} cells</span>
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

          <div class="near">
            <div class="small dim">One change away</div>
            <div class="near-list">
              {#each nearShown as n (n.to.id)}
                <button class="small" onclick={() => (anvil.placement = clonePlacement(n.placement))}>
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
          </div>
        {/if}
      </div>

      <div class="col col-parts">
        <div class="slots">
          {#each FORGING.slots as def (def.id)}
            {@const slot = def.id as ForgeSlot}
            {@const part = placement[slot]}
            {@const partKind = part ? PART_KINDS[part.kind] : undefined}
            {@const lock = preview.slotLocks[slot]}
            <div class="slot">
              <h4 class="slot-name">
                {def.name}
                {#if def.unlockLevel}<small class="dim">Smithing {def.unlockLevel}</small>{/if}
              </h4>
              <div class="slot-body">
                {#if lock !== undefined}
                  <div class="small dim">The {def.name.toLowerCase()} slot opens at Smithing {lock}.</div>
                  {#if part}<button class="small" onclick={() => setPart(slot, null)}>Clear the slot</button>{/if}
                {:else}
                  <div class="picks">
                    <button class="small" class:selected={!part} onclick={() => setPart(slot, null)}>none</button>
                    {#each kindsByRole(roleOf(slot)) as kind (kind.id)}
                      <button
                        class="small pick"
                        class:selected={part?.kind === kind.id}
                        title="{kind.w}×{kind.l} = {kind.w * kind.l} cells"
                        onclick={() => setPart(slot, kind.id)}
                      >
                        <span class="glyph" style="grid-template-columns: repeat({Math.min(kind.w, 4)}, 3px)" aria-hidden="true">
                          {#each { length: Math.min(kind.w, 4) * Math.min(kind.l, 10) } as _}<i></i>{/each}
                        </span>
                        {kind.name}
                        <span class="dim">{kind.w}×{kind.l}</span>
                      </button>
                    {/each}
                  </div>
                  {#if part && partKind}
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
                  {/if}
                {/if}
              </div>
            </div>
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
    grid-template-columns: max-content max-content;
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
    gap: 0;
  }

  .slot {
    display: grid;
    grid-template-columns: 7.5em 1fr;
    gap: 6px 12px;
    padding: 8px 0;
    border-top: 1px solid var(--border);
  }

  @media (max-width: 560px) {
    .slot {
      grid-template-columns: 1fr;
    }
  }

  .slot-name {
    margin: 3px 0 0;
    font-size: 13px;
  }

  .slot-name small {
    display: block;
    font-weight: 400;
  }

  .slot-body {
    min-width: 0;
  }

  .picks,
  .mats {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }

  .mats {
    margin-top: 5px;
  }

  .pick {
    display: inline-flex;
    align-items: center;
    gap: 6px;
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
