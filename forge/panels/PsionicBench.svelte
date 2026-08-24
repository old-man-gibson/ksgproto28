<script lang="ts">
  /**
   * The psionic bench, for authoring rather than playing.
   *
   * Psionics is the one school whose data says nothing at all about what it
   * does: `{ shape: { force: 6, mass: 4 } }` is eight numbers, and everything
   * that matters — what it hits, how hard, what it grips, what it costs —
   * lives in the derived space those numbers resolve to. Reading a shape off
   * the page is not possible; you have to run it.
   *
   * So this is the in-game wheel with the game taken out: no axis caps, no
   * teachers, no focus pool. Dial anything, read the quantities the resolver
   * reads, and copy the shape straight into a monster's rotation.
   *
   * Everything here goes through `deriveShape` / `shapeSpec`, the same two
   * functions combat calls. The forge must never own a second copy of the
   * arithmetic — the whole point of the derived space is that one set of
   * formulas answers for both sides of the fight.
   */
  import type { PsiAxisId, PsiQuantityId, PsionicShape, StatusApplication } from '../../src/core/types';
  import { PSI_AXIS_LIST, PSI_QUANTITIES, PSI_QUANTITY_LIST } from '../../src/core/data/spellcraft.data';
  import { deriveShape, recogniseShape, shapeName, shapeSpec, shapeTotal } from '../../src/core/systems/psionic';
  import { STATUSES } from '../../src/core/registry';
  import { TPS } from '../../src/core/engine/loop';

  /** No cap here on purpose — the forge asks "what would this do", not "may I". */
  const MAX_POINTS = 12;

  let shape = $state<PsionicShape>({});
  /**
   * What the caster multiplies strike power by. 1 reads the shape bare; a
   * monster's is `1.5 + INT × 1.1`, the same number the Field test shows.
   */
  let spellPower = $state(1);
  /** Recognitions above the shaper's tier stay unnamed — 12 sees everything. */
  let tier = $state(12);
  let copied = $state(false);

  const points = (axis: PsiAxisId) => shape[axis] ?? 0;

  function set(axis: PsiAxisId, value: number): void {
    const v = Math.max(0, Math.min(MAX_POINTS, Math.round(value)));
    // A zero is a STATEMENT in this space ("no speed, no mass" is a shape),
    // but an absent key and a zero read identically — so drop it and keep the
    // copied JSON clean.
    const next: PsionicShape = { ...shape };
    if (v === 0) delete next[axis];
    else next[axis] = v;
    shape = next;
  }

  const space = $derived(deriveShape(shape));
  const total = $derived(shapeTotal(shape));
  const spec = $derived(shapeSpec(shape, tier));
  const known = $derived(recogniseShape(shape, tier));

  const json = $derived(
    `{ school: 'psionic', shape: { ${PSI_AXIS_LIST.filter((a) => points(a.id) > 0)
      .map((a) => `${a.id}: ${points(a.id)}`)
      .join(', ')} } }`,
  );

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(json);
    copied = true;
    setTimeout(() => (copied = false), 1200);
  }

  const n = (v: number, places = 1) => (Math.round(v * 10 ** places) / 10 ** places).toString();

  function quantity(id: PsiQuantityId): string {
    const def = PSI_QUANTITIES[id];
    return (space[id] ?? 0).toFixed(def.decimals);
  }

  /** "Held ×2 · 6s (40%)" — the same reading the monster preview gives. */
  function statusLine(apps: StatusApplication[] | undefined): string {
    return (apps ?? [])
      .map((a) => {
        const def = STATUSES[a.id];
        if (!def) return `⚠ ${a.id}`;
        const life = a.duration ?? def.duration;
        const parts = [def.name, `×${n(a.intensity ?? 1)}`];
        parts.push(life === 'permanent' || life === null ? '· until removed' : `· ${n(life / TPS)}s`);
        if (a.chance !== undefined && a.chance < 1) parts.push(`(${Math.round(a.chance * 100)}%)`);
        return parts.join(' ');
      })
      .join(', ');
  }

  const strikes = $derived(
    spec.strikes.map((s) => ({
      ...s,
      landed: s.power * (s.hits ?? 1) * spellPower,
    })),
  );
  const totalDamage = $derived(strikes.reduce((sum, s) => sum + s.landed, 0));
</script>

<div class="bench scroll">
  <div class="cols">
    <!-- ---------- The eight dials ---------- -->
    <section class="card">
      <h2>Shape</h2>
      <div class="axes">
        {#each PSI_AXIS_LIST as axis (axis.id)}
          {@const v = points(axis.id)}
          <div class="axis" class:zero={v === 0}>
            <div class="alabel" title={axis.desc}>
              <span class="ico">{axis.icon}</span>
              {axis.name}
            </div>
            <input
              type="range"
              min="0"
              max={MAX_POINTS}
              value={v}
              oninput={(e) => set(axis.id, +e.currentTarget.value)}
            />
            <!-- The thresholds the recognitions read: 4 / 8 / 12. -->
            <div class="ticks" aria-hidden="true">
              {#each [4, 8, 12] as t (t)}
                <span class="tick" class:lit={v >= t} style="left: {(t / MAX_POINTS) * 100}%"></span>
              {/each}
            </div>
            <input
              class="mono pts"
              type="number"
              min="0"
              max={MAX_POINTS}
              value={v}
              oninput={(e) => set(axis.id, +e.currentTarget.value)}
            />
          </div>
        {/each}
      </div>
      <div class="row">
        <button class="tiny" onclick={() => (shape = {})}>Clear</button>
        <span class="dim small">{total} point{total === 1 ? '' : 's'} spent</span>
      </div>
    </section>

    <!-- ---------- What it resolves to ---------- -->
    <section class="card">
      <h2>Derived space</h2>
      <p class="small dim lead">
        Every line of the resolver reads one of these, never a point count. A shape that does
        nothing has nothing here.
      </p>
      <table>
        <tbody>
          {#each PSI_QUANTITY_LIST as q (q.id)}
            {@const v = space[q.id] ?? 0}
            <tr class:off={v <= 0}>
              <td title={q.desc}>{q.name}</td>
              <td class="num mono">{quantity(q.id)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>

    <!-- ---------- The working itself ---------- -->
    <section class="card wide">
      <h2>
        {known?.icon ?? spec.icon}
        {known?.name ?? shapeName(shape)}
        {#if known}<span class="pill">recognised</span>{/if}
      </h2>
      <p class="small dim lead">{spec.desc}</p>

      <div class="row">
        <label class="small dim">
          spellPower
          <input class="mono w60" type="number" min="0" step="0.1" bind:value={spellPower} />
        </label>
        <label class="small dim" title="Recognitions above a shaper's tier stay nameless">
          tier
          <input class="mono w60" type="number" min="0" max="12" bind:value={tier} />
        </label>
        <span class="grow"></span>
        <span class="small dim">
          {spec.focusCost ?? 0} focus · {n(spec.cooldown / TPS)}s · {spec.target}
        </span>
      </div>

      {#if strikes.length}
        <table>
          <thead>
            <tr><th>strike</th><th class="num">power</th><th class="num">lands</th><th>inflicts</th></tr>
          </thead>
          <tbody>
            {#each strikes as s, i (i)}
              <tr>
                <td>{s.type}{s.hits && s.hits > 1 ? ` ×${s.hits}` : ''}</td>
                <td class="num mono dim">{n(s.power, 2)}</td>
                <td class="num mono">{n(s.landed)}</td>
                <td class="small dim">{statusLine(s.inflicts) || '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <div class="small dim">
          {n(totalDamage)} total at spellPower {spellPower}, before armor and resistances.
        </div>
      {/if}

      <div class="lines small">
        {#if spec.heal}<div>heals {n(spec.heal * spellPower)}</div>{/if}
        {#if spec.grants?.length}<div>grants {statusLine(spec.grants)}</div>{/if}
        {#if spec.afflicts?.length}<div>afflicts {statusLine(spec.afflicts)}</div>{/if}
        {#if spec.buff}<div>buffs the shaper — {spec.buff.name}, {n(spec.buff.duration / TPS)}s</div>{/if}
        {#if !strikes.length && !spec.heal && !spec.grants?.length && !spec.afflicts?.length && !spec.buff}
          <div class="dim">Nothing lands. The shape has no working in it yet.</div>
        {/if}
      </div>

      <div class="row">
        <code class="json mono">{json}</code>
        <button class="tiny" onclick={copy}>{copied ? '✓ copied' : '⧉ copy'}</button>
      </div>
      <div class="small dim">
        Paste into a monster's <code>rotation</code> as a cast entry. Monsters never pay focus —
        their only limiter is the cooldown.
      </div>
    </section>
  </div>
</div>

<style>
  .bench {
    padding: 14px;
    height: 100%;
    overflow: auto;
  }

  .cols {
    display: grid;
    grid-template-columns: minmax(320px, 1fr) minmax(220px, 0.6fr);
    gap: 12px;
    align-items: start;
  }

  .card {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 10px 12px 12px;
  }

  .wide {
    grid-column: 1 / -1;
  }

  h2 {
    font-size: 13px;
    margin: 0 0 6px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .lead {
    margin: 0 0 8px;
    line-height: 1.4;
  }

  .axes {
    display: grid;
    gap: 6px;
  }

  .axis {
    display: grid;
    grid-template-columns: 130px 1fr 56px;
    align-items: center;
    gap: 8px;
    position: relative;
  }

  .axis.zero .alabel {
    opacity: 0.55;
  }

  .alabel {
    font-size: 12px;
    white-space: nowrap;
  }

  .ico {
    margin-right: 3px;
  }

  input[type='range'] {
    width: 100%;
    grid-column: 2;
  }

  /* Sit the threshold marks under the track, in the slider's own column. */
  .ticks {
    grid-column: 2;
    position: relative;
    height: 0;
    pointer-events: none;
  }

  .tick {
    position: absolute;
    top: -4px;
    width: 1px;
    height: 7px;
    background: var(--line);
  }

  .tick.lit {
    background: var(--accent, var(--text));
  }

  .pts {
    width: 56px;
  }

  .w60 {
    width: 60px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
    flex-wrap: wrap;
  }

  .grow {
    flex: 1;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11.5px;
  }

  th {
    text-align: left;
    font-weight: 500;
    color: var(--dimmer);
    border-bottom: 1px solid var(--line);
    padding: 2px 4px;
  }

  td {
    padding: 2px 4px;
  }

  tr.off td {
    opacity: 0.4;
  }

  .num {
    text-align: right;
    white-space: nowrap;
  }

  .lines {
    margin-top: 6px;
    line-height: 1.5;
  }

  .json {
    flex: 1;
    font-size: 11px;
    padding: 5px 7px;
    border: 1px solid var(--line);
    border-radius: 5px;
    overflow-x: auto;
    white-space: nowrap;
    color: var(--dim);
  }

  .pill {
    font-size: 10px;
    padding: 1px 6px;
    border: 1px solid var(--line);
    border-radius: 99px;
    color: var(--dim);
  }

  .small {
    font-size: 11px;
  }

  .dim {
    color: var(--dimmer);
  }
</style>
