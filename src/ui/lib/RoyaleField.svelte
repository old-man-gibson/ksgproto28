<script lang="ts">
  import { gs, game } from '../state.svelte';
  import { ROYALE_STRATEGIES, SPOTS } from '../../core/registry';
  import { ARENA, ROYALE_PLAN_SLOTS, SURVIVOR_CHAMPION } from '../../core/data/festival.data';
  import { MONSTERS } from '../../core/registry';
  import { royalePlan } from '../../core/systems/royale';
  import type { FieldFighter, MonsterInstance, RoyaleStrategyDef } from '../../core/types';
  import BattleStage from './BattleStage.svelte';

  /**
   * The royale's field, drawn isometrically (systems/royaleField.ts runs it).
   * Every survivor, the player, the duels between survivors and the fight
   * the player is in. A click on the ground sends the player there by hand;
   * the ranked plan below decides every other step. A fight drops into the
   * battle stage under the field.
   */

  const field = $derived(gs.festival?.run?.field?.fighters ? gs.festival.run.field : undefined);
  const size = $derived(field?.size ?? 60);

  /** Pixels per field unit along a ground axis; the diamond is twice as wide as it is tall. */
  const K = 8;
  const MARGIN = 18;
  const iso = (x: number, y: number) => ({ sx: (x - y) * K, sy: ((x + y) * K) / 2 });
  const viewBox = $derived(`${-size * K - MARGIN} ${-MARGIN * 2} ${2 * size * K + MARGIN * 2} ${size * K + MARGIN * 3}`);

  /** The ground's four corners, and grid lines every ten units for depth. */
  const ground = $derived(
    [iso(0, 0), iso(size, 0), iso(size, size), iso(0, size)].map((p) => `${p.sx},${p.sy}`).join(' '),
  );
  const grid = $derived.by(() => {
    const lines: { a: { sx: number; sy: number }; b: { sx: number; sy: number } }[] = [];
    for (let v = 10; v < size; v += 10) {
      lines.push({ a: iso(v, 0), b: iso(v, size) });
      lines.push({ a: iso(0, v), b: iso(size, v) });
    }
    return lines;
  });

  /** Far to near, so nearer bodies draw over farther ones. */
  const bodies = $derived(field ? [...field.fighters].sort((a, b) => a.x + a.y - (b.x + b.y)) : []);
  const last = $derived((field?.fighters.length ?? 0) === 1);
  const duelling = $derived(field ? field.fighters.filter((f) => f.duel).length : 0);
  const engaged = $derived(field ? field.fighters.filter((f) => f.engaged).length : 0);
  const player = $derived(field ? iso(field.player.x, field.player.y) : null);
  const target = $derived(field?.player.target ? iso(field.player.target.x, field.player.target.y) : null);

  function icon(f: FieldFighter): string {
    return MONSTERS[last ? SURVIVOR_CHAMPION : f.monsterId]?.icon ?? '❔';
  }

  let svg: SVGSVGElement | undefined = $state();

  /** A click on the ground: the screen point back onto the field, and the player sent there. */
  function send(e: MouseEvent) {
    if (!svg || !field) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    const a = p.x / K;
    const b = (2 * p.y) / K;
    const x = (a + b) / 2;
    const y = (b - a) / 2;
    if (x < 0 || y < 0 || x > size || y > size) return;
    game.moveOnField(x, y);
  }

  /** Arrow keys walk the player by hand too, three units a press, in screen directions. */
  const NUDGE: Record<string, [number, number]> = {
    ArrowUp: [-1, -1],
    ArrowDown: [1, 1],
    ArrowLeft: [-1, 1],
    ArrowRight: [1, -1],
  };
  function nudge(e: KeyboardEvent) {
    const step = NUDGE[e.key];
    if (!step || !field) return;
    e.preventDefault();
    const from = field.player.target ?? field.player;
    game.moveOnField(from.x + step[0] * 3, from.y + step[1] * 3);
  }

  // ---------- The plan ----------

  const strategies = Object.values(ROYALE_STRATEGIES);
  const plan = $derived(royalePlan(gs).map((s) => s.id));

  /** Set slot `i` of the plan (or clear it with ''); the rest keep their order. */
  function setSlot(i: number, id: string) {
    const next = [...plan];
    if (id) next[i] = id;
    else next.splice(i, 1);
    game.setRoyalePlan(next.filter(Boolean));
  }

  /** "while below 50% health", "while more than 30 are left": the condition, from the data. */
  function whenText(s: RoyaleStrategyDef): string {
    const w = s.when;
    if (!w) return 'always';
    const parts: string[] = [];
    if (w.hpBelow !== undefined) parts.push(`below ${Math.round(w.hpBelow * 100)}% health`);
    if (w.fieldAbove !== undefined) parts.push(`more than ${w.fieldAbove} left`);
    if (w.fieldBelow !== undefined) parts.push(`fewer than ${w.fieldBelow} left`);
    return `while ${parts.join(' and ')}`;
  }

  const fighting = $derived(!!gs.combat && gs.spot === ARENA);
</script>

{#snippet foeTip(m: MonsterInstance)}
  <div class="tip-line tip-base">{m.icon} {m.name}</div>
  <div class="tip-line">Level {m.level}</div>
{/snippet}

{#if field}
  <div class="royale">
    <div class="royale-status small">
      <span>👥 <b>{field.fighters.length}</b> on the field</span>
      {#if duelling}<span>⚔️ {duelling} duelling each other</span>{/if}
      {#if engaged}<span class="engaged-note">🗡️ {engaged} fighting you</span>{/if}
      {#if last}<span class="engaged-note">👑 The champion is the last one left.</span>{/if}
    </div>

    <svg bind:this={svg} {viewBox} class="field" aria-label="The royale field">
      <!-- The ground is the control: everything drawn on it lets clicks through. -->
      <polygon
        class="ground"
        points={ground}
        role="button"
        tabindex="0"
        aria-label="Walk to a point on the field: click the ground, or use the arrow keys"
        onclick={send}
        onkeydown={nudge}
      />
      {#each grid as line, i (i)}
        <line class="gridline" x1={line.a.sx} y1={line.a.sy} x2={line.b.sx} y2={line.b.sy} />
      {/each}

      {#if target && player}
        <line class="path" x1={player.sx} y1={player.sy} x2={target.sx} y2={target.sy} />
        <text class="flag" x={target.sx} y={target.sy} text-anchor="middle">🚩</text>
      {/if}

      {#each bodies as f (f.id)}
        {@const p = iso(f.x, f.y)}
        <g transform="translate({p.sx} {p.sy})" class:duel={!!f.duel} class:engaged={f.engaged}>
          <ellipse class="shadow" rx="9" ry="4.5" />
          {#if f.duel || f.engaged}<ellipse class="ring" rx="12" ry="6" />{/if}
          <text class="sprite" y="-4" text-anchor="middle" opacity={0.55 + 0.45 * f.hp}>{icon(f)}</text>
        </g>
      {/each}

      {#if player}
        <g transform="translate({player.sx} {player.sy})" class="you">
          <ellipse class="ring" rx="15" ry="7.5" />
          <text class="sprite" y="-6" text-anchor="middle">🧍</text>
          <text class="you-label" y="-36" text-anchor="middle">you</text>
        </g>
      {/if}
    </svg>

    <div class="plan">
      <div class="small"><b>Plan.</b> The first strategy whose condition holds decides where you walk. A plan alone can win; a click on the field sends you there by hand, and the plan takes over again when you arrive.</div>
      {#each Array.from({ length: ROYALE_PLAN_SLOTS }, (_, i) => i) as i (i)}
        {#if i <= plan.length}
          <label class="slot small">
            <span class="dim">{i + 1}.</span>
            <select value={plan[i] ?? ''} onchange={(e) => setSlot(i, e.currentTarget.value)}>
              <option value="">—</option>
              {#each strategies as s (s.id)}
                <option value={s.id} disabled={plan.includes(s.id) && plan[i] !== s.id}>{s.icon} {s.name} ({whenText(s)})</option>
              {/each}
            </select>
          </label>
          {#if plan[i] && ROYALE_STRATEGIES[plan[i]]}
            <div class="dim small desc">{ROYALE_STRATEGIES[plan[i]].desc}</div>
          {/if}
        {/if}
      {/each}
      {#if field.player.target}
        <button class="small" onclick={() => game.clearFieldTarget()}>Back to the plan</button>
      {/if}
    </div>

    {#if fighting}
      <!-- The fight the field just started: the ordinary battle stage. -->
      <div class="stage">
        <BattleStage spot={SPOTS[ARENA]} {foeTip} />
      </div>
    {/if}
  </div>
{/if}

<style>
  .royale {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .royale-status {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .engaged-note {
    color: var(--accent);
  }

  .field {
    width: 100%;
    max-height: 420px;
    background: var(--bg-sunken);
    border: 1px solid var(--border);
    border-radius: 8px;
    user-select: none;
  }

  /* Only the ground takes clicks; what stands on it lets them through. */
  .field :global(*:not(.ground)) {
    pointer-events: none;
  }

  .ground {
    fill: color-mix(in srgb, var(--accent) 7%, var(--bg-raised));
    stroke: var(--border);
    stroke-width: 2;
    cursor: crosshair;
    outline: none;
  }

  .ground:focus-visible {
    stroke: var(--accent);
  }

  .gridline {
    stroke: color-mix(in srgb, var(--border) 70%, transparent);
    stroke-width: 1;
  }

  .path {
    stroke: var(--accent);
    stroke-width: 1.5;
    stroke-dasharray: 4 4;
  }

  .flag {
    font-size: 22px;
  }

  .shadow {
    fill: rgb(0 0 0 / 45%);
  }

  .ring {
    fill: none;
    stroke-width: 2;
  }

  .duel .ring {
    stroke: var(--danger);
  }

  .engaged .ring {
    stroke: var(--action);
  }

  .you .ring {
    stroke: var(--accent);
    stroke-width: 2.5;
  }

  .sprite {
    font-size: 20px;
    pointer-events: none;
  }

  .you .sprite {
    font-size: 30px;
  }

  .you-label {
    font-size: 15px;
    font-weight: 600;
    fill: var(--accent);
    pointer-events: none;
  }

  .plan {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .slot {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .slot select {
    flex: 1;
    min-width: 0;
  }

  .desc {
    margin-left: 18px;
  }

  .stage {
    margin-top: 4px;
  }
</style>
