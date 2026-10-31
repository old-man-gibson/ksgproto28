<script lang="ts">
  import { gs, game } from '../state.svelte';
  import { MONSTERS, ROYALE_STRATEGIES, SPOTS } from '../../core/registry';
  import {
    ARENA,
    ROYALE_DENS,
    ROYALE_FIELD,
    ROYALE_PLAN_SLOTS,
    ROYALE_SECTIONS,
    SURVIVOR_CHAMPION,
  } from '../../core/data/festival.data';
  import { royalePlan } from '../../core/systems/royale';
  import { mapOf, sectionAt, sectionKnown, sightAt } from '../../core/systems/royaleTerrain';
  import { MS_PER_TICK } from '../../core/engine/loop';
  import type { FieldFighter, MonsterInstance, RoyaleStrategyDef } from '../../core/types';
  import { msToTime } from './format';
  import {
    cameraBox,
    fieldPoint,
    ISO_K,
    isoDirection,
    isoEllipse,
    isoPoint,
    radarText,
    radarView,
    sectionCentres,
    visibleFeatures,
    visibleFighters,
  } from './royaleView';
  import { mapDataUrl, readPalette, themeStamp } from './royaleMapImage.svelte';
  import BattleStage from './BattleStage.svelte';
  import RoyaleMinimap from './RoyaleMinimap.svelte';

  /**
   * The royale's field, drawn isometrically (systems/royaleField.ts runs it).
   * The terrain is the field's map (systems/royaleMap.ts), drawn as one image
   * under the ground's transform, with its sections named and the village's
   * buildings outlined. The view follows the player, or shows the whole field,
   * with a minimap of the whole field. Fog: only the fighters in the player's
   * sight show, and the radar's target once the radar is on; a cache or a den
   * shows once its section is scouted or stood in, or while it is in sight.
   * Every pure rule is in royaleView.ts and systems/royaleTerrain.ts, shared
   * with the simulation. A click on the ground sends the player there by hand;
   * the ranked plan below decides every other step. A fight drops into the
   * battle stage under the field.
   */

  const field = $derived(gs.festival?.run?.field?.fighters ? gs.festival.run.field : undefined);
  const map = $derived(field ? mapOf(field) : undefined);
  const size = $derived(map?.size ?? ROYALE_FIELD.size);

  /** The terrain, redrawn when the field's seed or the page's theme changes. */
  const image = $derived.by(() => {
    themeStamp();
    return map ? mapDataUrl(map, readPalette()) : '';
  });

  const K = ISO_K;
  const iso = isoPoint;

  // ---------- Camera ----------

  let whole = $state(false);
  const me = $derived(field ? iso(field.player.x, field.player.y) : { sx: 0, sy: 0 });
  const view = $derived(cameraBox(me, size, whole));
  const viewBox = $derived(`${view.x} ${view.y} ${view.w} ${view.h}`);

  /** The map's size on screen, to size marks in pixels at any zoom. */
  let boxW = $state(0);
  let boxH = $state(0);
  /** SVG units in one screen pixel. */
  const u = $derived(boxW > 0 && boxH > 0 ? 1 / Math.min(boxW / view.w, boxH / view.h) : 1.4);

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

  // ---------- Terrain ----------

  const names = $derived(map ? sectionCentres(map) : []);
  const WALL = 10;
  /** Each building as a box on the ground: its footprint, its roof lifted by WALL, and the three corners facing the viewer. */
  const buildings = $derived(
    map
      ? [...map.buildings]
          .sort((a, b) => a.x0 + a.y0 - (b.x0 + b.y0))
          .map((b) => {
            const base = [iso(b.x0, b.y0), iso(b.x1, b.y0), iso(b.x1, b.y1), iso(b.x0, b.y1)];
            const roof = base.map((p) => ({ sx: p.sx, sy: p.sy - WALL }));
            const pts = (ps: { sx: number; sy: number }[]) => ps.map((p) => `${p.sx},${p.sy}`).join(' ');
            return { id: b.id, base: pts(base), roof: pts(roof), posts: [base[3], base[2], base[1]] };
          })
      : [],
  );

  const here = $derived(field && map ? sectionAt(map, field.player.x, field.player.y) : undefined);
  const sightRing = $derived(field && map ? isoEllipse(sightAt(map, field.player.x, field.player.y)) : { rx: 0, ry: 0 });

  // ---------- Fog, features and radar ----------

  const radar = $derived(field ? radarView(field, gs.totalTicks) : null);
  const shown = $derived(field && map && radar ? visibleFighters(map, field, radar) : []);
  const features = $derived(
    field && map ? visibleFeatures(map, field, (id) => sectionKnown(gs, field, id), field.player) : [],
  );
  /** Screen angle of the radar arrow, in degrees, or null while the radar is off. */
  const arrow = $derived.by(() => {
    if (radar?.state !== 'on' || !radar.target) return null;
    const d = isoDirection(radar.target.dx, radar.target.dy);
    return d ? (Math.atan2(d.uy, d.ux) * 180) / Math.PI : null;
  });
  const radarId = $derived(radar?.state === 'on' ? radar.target?.id : undefined);
  /** "Radar in 42 min (42s of play)" while it is off, "Radar: nearest fighter 34 units, north-east" once on. */
  const radarLine = $derived(
    radar
      ? radarText(radar) +
          (radar.state === 'off' ? ` (${msToTime(Math.ceil((radar.left * MS_PER_TICK) / 1000) * 1000)} of play)` : '')
      : '',
  );

  /** Far to near, so nearer bodies draw over farther ones. */
  const bodies = $derived([...shown].sort((a, b) => a.x + a.y - (b.x + b.y)));
  const last = $derived((field?.fighters.length ?? 0) === 1);
  const duelling = $derived(shown.filter((f) => f.duel).length);
  const engaged = $derived(field ? field.fighters.filter((f) => f.engaged).length : 0);
  const player = $derived(field ? me : null);
  const target = $derived(field?.player.target ? iso(field.player.target.x, field.player.target.y) : null);

  function icon(f: FieldFighter): string {
    return MONSTERS[last ? SURVIVOR_CHAMPION : f.monsterId]?.icon ?? '❔';
  }

  const denName = (id: string | undefined) => ROYALE_DENS.find((d) => d.id === id)?.name ?? id ?? '';

  // ---------- Walking by hand ----------

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
    const { x, y } = fieldPoint(p.x, p.y, K);
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

{#if field && map}
  <div class="royale">
    <div class="royale-status small">
      <span>👥 <b>{field.fighters.length}</b> on the field, <b>{shown.length}</b> on your map</span>
      {#if duelling}<span>⚔️ {duelling} duelling each other</span>{/if}
      {#if engaged}<span class="royale-engaged">🗡️ {engaged} fighting you</span>{/if}
      {#if last}<span class="royale-engaged">👑 The champion is the last one left.</span>{/if}
    </div>
    <div class="royale-status small">
      {#if radar}
        <span class:royale-engaged={radar.state === 'on'}>📡 {radarLine}</span>
      {/if}
      <span class="dim">
        📍 {here ? `${here.name}: pace ${here.pace}, sight ${here.sight}` : 'Open meadow'}
      </span>
      <button class="small royale-toggle" class:selected={whole} aria-pressed={whole} onclick={() => (whole = !whole)}>
        Whole field
      </button>
    </div>

    <div class="royale-frame">
      <svg
        bind:this={svg}
        bind:clientWidth={boxW}
        bind:clientHeight={boxH}
        {viewBox}
        class="royale-field"
        aria-label="The royale field"
      >
        <!-- The ground is the control: everything drawn on it lets clicks through. -->
        <polygon
          class="royale-ground"
          points={ground}
          role="button"
          tabindex="0"
          aria-label="Walk to a point on the field: click the ground, or use the arrow keys"
          onclick={send}
          onkeydown={nudge}
        />
        {#if image}
          <!-- One pixel per cell, laid on the ground by the same projection the sprites use. -->
          <image
            class="royale-terrain"
            href={image}
            x="0"
            y="0"
            width={size}
            height={size}
            transform="matrix({K} {K / 2} {-K} {K / 2} 0 0)"
          />
        {/if}
        <polygon class="royale-edge" points={ground} stroke-width={2 * u} />
        {#each grid as line, i (i)}
          <line class="royale-gridline" x1={line.a.sx} y1={line.a.sy} x2={line.b.sx} y2={line.b.sy} stroke-width={u} />
        {/each}

        {#each buildings as b (b.id)}
          <g class="royale-building" stroke-width={1.5 * u}>
            <polygon points={b.base} />
            {#each b.posts as p, i (i)}
              <line x1={p.sx} y1={p.sy} x2={p.sx} y2={p.sy - WALL} />
            {/each}
            <polygon class="royale-roof" points={b.roof} />
          </g>
        {/each}

        {#each names as n (n.id)}
          {@const p = iso(n.x, n.y)}
          <text class="royale-name" transform="translate({p.sx} {p.sy}) scale({u})" text-anchor="middle">
            {ROYALE_SECTIONS[n.id]?.name ?? n.id}
          </text>
        {/each}

        {#each features as f (f.kind + f.id)}
          {@const p = iso(f.x, f.y)}
          {#if f.kind === 'den' && !f.spent && f.radius}
            {@const ring = isoEllipse(f.radius)}
            <ellipse
              class="royale-den-ring"
              class:royale-den-fight={field.denFight === f.id}
              cx={p.sx}
              cy={p.sy}
              rx={ring.rx}
              ry={ring.ry}
              stroke-width={1.5 * u}
              stroke-dasharray="{5 * u} {4 * u}"
            />
          {/if}
          <g transform="translate({p.sx} {p.sy}) scale({u})" class:royale-spent={f.spent}>
            <ellipse class="royale-shadow" rx="8" ry="4" />
            <text class="royale-feature" y="-3" text-anchor="middle">{f.icon}</text>
          </g>
        {/each}

        {#if player && map}
          <ellipse
            class="royale-sight"
            cx={player.sx}
            cy={player.sy}
            rx={sightRing.rx}
            ry={sightRing.ry}
            stroke-width={1.5 * u}
            stroke-dasharray="{3 * u} {6 * u}"
          />
        {/if}

        {#if target && player}
          <line
            class="royale-path"
            x1={player.sx}
            y1={player.sy}
            x2={target.sx}
            y2={target.sy}
            stroke-width={1.5 * u}
            stroke-dasharray="{4 * u} {4 * u}"
          />
          <text class="royale-flag" transform="translate({target.sx} {target.sy}) scale({u})" text-anchor="middle">🚩</text>
        {/if}

        {#each bodies as f (f.id)}
          {@const p = iso(f.x, f.y)}
          <g transform="translate({p.sx} {p.sy}) scale({u})" class:royale-duel={!!f.duel} class:royale-engaged-body={f.engaged}>
            <ellipse class="royale-shadow" rx="9" ry="4.5" />
            {#if f.duel || f.engaged}<ellipse class="royale-ring" rx="12" ry="6" />{/if}
            {#if f.id === radarId}<ellipse class="royale-ring royale-radar-ring" rx="15" ry="7.5" />{/if}
            <text class="royale-sprite" y="-4" text-anchor="middle" opacity={0.55 + 0.45 * f.hp}>{icon(f)}</text>
          </g>
        {/each}

        {#if player}
          {#if arrow !== null}
            <g transform="translate({player.sx} {player.sy}) scale({u}) rotate({arrow})" class="royale-arrow">
              <line x1="30" y1="0" x2="76" y2="0" />
              <polygon points="86,0 72,-7 72,7" />
            </g>
          {/if}
          <g transform="translate({player.sx} {player.sy}) scale({u})" class="royale-you">
            <ellipse class="royale-ring" rx="15" ry="7.5" />
            <text class="royale-sprite" y="-6" text-anchor="middle">🧍</text>
            <text class="royale-you-label" y="-36" text-anchor="middle">you</text>
          </g>
        {/if}
      </svg>

      <svg class="royale-compass" viewBox="0 0 48 48" aria-hidden="true">
        <polygon points="24,9 39,24 24,39 9,24" />
        <text x="38" y="12" text-anchor="middle">N</text>
        <text x="38" y="43" text-anchor="middle">E</text>
        <text x="10" y="43" text-anchor="middle">S</text>
        <text x="10" y="12" text-anchor="middle">W</text>
      </svg>

      <div class="royale-minimap">
        <RoyaleMinimap
          {map}
          {image}
          {features}
          player={field.player}
          radar={radar?.state === 'on' ? radar.target : null}
          {view}
          onpick={(x, y) => game.moveOnField(x, y)}
          label="Minimap of the whole field: click a point to walk there"
        />
      </div>
    </div>

    {#if features.length}
      <details class="royale-known small">
        <summary>Known on this field ({features.length})</summary>
        <ul>
          {#each features as f (f.kind + f.id)}
            <li class:dim={f.spent}>
              {f.icon} {f.name}: {f.kind}{f.kind === 'den' ? (f.spent ? ', cleared' : '') : f.spent ? ', taken' : f.shut ? `, shut until ${denName(f.guard)} is cleared` : ''}
              ({ROYALE_SECTIONS[f.section]?.name ?? f.section})
            </li>
          {/each}
        </ul>
      </details>
    {/if}

    <div class="royale-plan">
      <div class="small"><b>Plan.</b> The first strategy whose condition holds decides where you walk. A plan alone can win; a click on the field sends you there by hand, and the plan takes over again when you arrive.</div>
      {#each Array.from({ length: ROYALE_PLAN_SLOTS }, (_, i) => i) as i (i)}
        {#if i <= plan.length}
          <label class="royale-slot small">
            <span class="dim">{i + 1}.</span>
            <select value={plan[i] ?? ''} onchange={(e) => setSlot(i, e.currentTarget.value)}>
              <option value="">—</option>
              {#each strategies as s (s.id)}
                <option value={s.id} disabled={plan.includes(s.id) && plan[i] !== s.id}>{s.icon} {s.name} ({whenText(s)})</option>
              {/each}
            </select>
          </label>
          {#if plan[i] && ROYALE_STRATEGIES[plan[i]]}
            <div class="dim small royale-desc">{ROYALE_STRATEGIES[plan[i]].desc}</div>
          {/if}
        {/if}
      {/each}
      {#if field.player.target}
        <button class="small" onclick={() => game.clearFieldTarget()}>Back to the plan</button>
      {/if}
    </div>

    {#if fighting}
      <!-- The fight the field just started: the ordinary battle stage. -->
      <div class="royale-stage">
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
    align-items: center;
    gap: 4px 12px;
  }

  .royale-engaged {
    color: var(--accent);
  }

  .royale-toggle {
    margin-left: auto;
    padding: 2px 10px;
  }

  .royale-frame {
    position: relative;
    container-type: inline-size;
  }

  .royale-field {
    display: block;
    width: 100%;
    max-height: 420px;
    background: var(--bg-sunken);
    border: 1px solid var(--border);
    border-radius: 8px;
    user-select: none;
  }

  /* Only the ground takes clicks; what stands on it lets them through. */
  .royale-field :global(*:not(.royale-ground)) {
    pointer-events: none;
  }

  .royale-ground {
    fill: color-mix(in srgb, var(--accent) 7%, var(--bg-raised));
    cursor: crosshair;
    outline: none;
  }

  .royale-ground:focus-visible ~ .royale-edge {
    stroke: var(--accent);
  }

  .royale-terrain {
    image-rendering: pixelated;
  }

  .royale-edge {
    fill: none;
    stroke: var(--border);
  }

  .royale-gridline {
    stroke: var(--text);
    opacity: 0.07;
  }

  .royale-building {
    fill: none;
    stroke: var(--text-dim);
  }

  .royale-building polygon {
    fill: color-mix(in srgb, var(--bg-sunken) 55%, transparent);
  }

  .royale-building .royale-roof {
    fill: color-mix(in srgb, var(--bg-raised) 80%, transparent);
  }

  /* Names of sections: small and quiet, readable over any ground colour. */
  .royale-name {
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    fill: var(--text);
    opacity: 0.7;
    paint-order: stroke;
    stroke: var(--bg-sunken);
    stroke-width: 3px;
    stroke-linejoin: round;
  }

  .royale-feature {
    font-size: 18px;
  }

  .royale-spent {
    opacity: 0.35;
  }

  .royale-den-ring {
    fill: color-mix(in srgb, var(--danger) 8%, transparent);
    stroke: var(--danger);
    opacity: 0.55;
  }

  .royale-den-fight {
    opacity: 1;
  }

  .royale-sight {
    fill: none;
    stroke: var(--text);
    opacity: 0.25;
  }

  .royale-path {
    stroke: var(--accent);
  }

  .royale-flag {
    font-size: 20px;
  }

  .royale-shadow {
    fill: rgb(0 0 0 / 45%);
  }

  .royale-ring {
    fill: none;
    stroke-width: 2px;
  }

  .royale-duel .royale-ring {
    stroke: var(--danger);
  }

  .royale-engaged-body .royale-ring {
    stroke: var(--action);
  }

  .royale-ring.royale-radar-ring {
    stroke: var(--danger);
    stroke-dasharray: 4 3;
  }

  .royale-you .royale-ring {
    stroke: var(--accent);
    stroke-width: 2.5px;
  }

  .royale-sprite {
    font-size: 18px;
  }

  .royale-you .royale-sprite {
    font-size: 28px;
  }

  .royale-you-label {
    font-size: 13px;
    font-weight: 600;
    fill: var(--accent);
    paint-order: stroke;
    stroke: var(--bg-sunken);
    stroke-width: 3px;
  }

  .royale-arrow line {
    stroke: var(--danger);
    stroke-width: 3px;
    stroke-linecap: round;
  }

  .royale-arrow polygon {
    fill: var(--danger);
    stroke: var(--bg-sunken);
    stroke-width: 1px;
  }

  /* Which way north points on the ground, top left. */
  .royale-compass {
    position: absolute;
    top: 6px;
    left: 8px;
    width: 52px;
    height: 52px;
    pointer-events: none;
  }

  .royale-compass polygon {
    fill: none;
    stroke: var(--text-dim);
    stroke-width: 1;
    opacity: 0.6;
  }

  .royale-compass text {
    font-size: 9px;
    font-weight: 600;
    fill: var(--text-dim);
  }

  .royale-minimap {
    position: absolute;
    right: 8px;
    bottom: 8px;
    width: clamp(120px, 28%, 220px);
    opacity: 0.94;
  }

  /* A narrow map has no room to spare: the minimap goes under it instead of over it. */
  @container (max-width: 520px) {
    .royale-minimap {
      position: static;
      width: min(100%, 240px);
      margin: 6px auto 0;
      opacity: 1;
    }
  }

  .royale-known ul {
    margin: 4px 0 0;
    padding-left: 18px;
  }

  .royale-plan {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .royale-slot {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .royale-slot select {
    flex: 1;
    min-width: 0;
  }

  .royale-desc {
    margin-left: 18px;
  }

  .royale-stage {
    margin-top: 4px;
  }
</style>
