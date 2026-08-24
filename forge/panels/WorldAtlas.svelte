<script lang="ts">
  /**
   * The world atlas: every region as a pin on one canvas.
   *
   * Spots place themselves inside a region; this is where the REGIONS place
   * themselves in the world. Drag a pin and the only bytes that change are the
   * two numbers in that region's `world: { x, y }`. Regions that haven't been
   * placed yet sit on a dashed ring around the centre — a layout, not data —
   * and dragging one writes its first real position.
   *
   * The lines are travel connections that cross a region border, aggregated
   * per pair. They are the sanity check the atlas exists for: a pair of
   * regions the player can walk between should not be pinned a world apart,
   * and two overlapping pins are two regions pretending to share a location.
   * Both light up amber — the same "the drawing disagrees with the data"
   * warning the World Map uses for travel ticks.
   */
  import { onMount } from 'svelte';
  import { store } from '../lib/store.svelte';
  import ContextMenu, { type MenuItem } from '../lib/ContextMenu.svelte';
  import type { AreaDef, RegionDef, SpotDef } from '../../src/core/types';
  // The game's OWN clock and weather — imported, not reimplemented, so the
  // overlay can never drift from what players will live under.
  import { clockOf, formatDate, formatTime, TICKS_PER_DAY } from '../../src/core/systems/clock';
  import { WEATHER_ICONS, weatherAt, worldSeedOf } from '../../src/core/systems/weather';
  import { DAYS_PER_YEAR } from '../../src/core/data/climate.data';

  interface Props {
    /** Open the Regions browser, for edits a pin can't express. */
    onbrowse?: () => void;
  }
  let { onbrowse }: Props = $props();

  const W = 100;
  const H = 75;
  const R = 5; // pin radius at the default zoom, data units
  /** Two pinned regions closer than this are pretending to share a location. */
  const OVERLAP_DIST = 2.5;

  /** A connected pair pinned further than this multiple of the median pinned
   *  link distance is probably a mistake. Needs a few pinned links before the
   *  median means anything. */
  const FAR_MULT = 2.5;
  const FAR_MIN_LINKS = 3;

  /**
   * Optional backdrop: drop any image at `forge/atlas-bg.svg` (an Azgaar
   * export, a sketch, anything) and it draws under the pins, letterboxed into
   * the canvas. Swap the file to swap the world; delete it for the bare grid.
   * The dev server answers missing files with the SPA page, so presence is
   * confirmed by content-type, not by status.
   */
  const BG_URL = '/forge/atlas-bg.svg';
  let bg = $state(false);
  /** Natural aspect of the backdrop, once known — the default view fits it. */
  let bgAspect = $state<number | null>(null);

  onMount(async () => {
    try {
      const res = await fetch(BG_URL, { method: 'HEAD' });
      const type = res.headers.get('content-type') ?? '';
      bg = res.ok && (type.includes('svg') || type.startsWith('image/'));
    } catch {
      bg = false;
    }
    if (bg) {
      const img = new Image();
      img.onload = () => {
        bgAspect = img.naturalWidth / img.naturalHeight || null;
        resetView();
      };
      img.src = BG_URL;
    }
  });

  /** The rect the letterboxed backdrop actually occupies on the canvas. */
  const bgRect = $derived.by(() => {
    if (!bgAspect) return null;
    if (bgAspect > W / H) {
      const ih = W / bgAspect;
      return { x: 0, y: (H - ih) / 2, w: W, h: ih };
    }
    const iw = H * bgAspect;
    return { x: (W - iw) / 2, y: 0, w: iw, h: H };
  });

  let svgEl = $state<SVGSVGElement | null>(null);
  let view = $state({ x: -4, y: -4, w: W + 8, h: H + 8 });
  let snap = $state(true);
  let showNames = $state(true);
  let showStats = $state(true);
  let showMap = $state(true);
  let mapOpacity = $state(0.55);

  /**
   * The sky preview. Every SAVE rolls its own weather (the seed is the save's
   * `createdAt`), so the forge shows one representative world — the shapes and
   * rhythms are what you tune here, never one player's exact Tuesday.
   */
  const PREVIEW_SEED = worldSeedOf(20260804);
  let showSky = $state(true);
  let scrubDay = $state(0);
  let scrubHour = $state(12);

  const previewTicks = $derived(scrubDay * TICKS_PER_DAY + scrubHour * (TICKS_PER_DAY / 24));
  const previewClock = $derived(clockOf(previewTicks));
  const sky = $derived.by(() => {
    const map = new Map<string, ReturnType<typeof weatherAt>>();
    if (!showSky) return map;
    for (const r of regions) map.set(r.id, weatherAt(PREVIEW_SEED, r, previewTicks));
    return map;
  });

  /** Cold blue → hot red, tuned dark enough for the icon to sit on. */
  function tempColor(t: number): string {
    const f = Math.min(1, Math.max(0, (t + 20) / 55));
    return `hsl(${Math.round(215 * (1 - f))}, 62%, ${Math.round(24 + f * 10)}%)`;
  }
  let selected = $state<string | null>(null);
  let dragging = $state<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  let panning = $state<{ x: number; y: number } | null>(null);
  let menu = $state<{ x: number; y: number; title: string; items: MenuItem[] } | null>(null);

  const regions = $derived(store.list<RegionDef>('region'));
  const areas = $derived(store.all<AreaDef>('area'));
  const spots = $derived(store.all<SpotDef>('spot'));

  /**
   * Pins keep a constant ON-SCREEN size: everything about them (radius,
   * strokes, text) scales with the view width, so zooming into a cluster of
   * small neighboring regions shrinks the pins in map terms and lets the
   * geography between them show. The map is the thing being inspected; the
   * pins are markers on it.
   */
  const s = $derived(view.w / (W + 8));

  const pinned = $derived(regions.filter((r) => r.world).length);

  /** Where a region draws: its pin, or its slot on the unplaced ring. */
  function pt(region: RegionDef): { x: number; y: number } {
    if (region.world) return region.world;
    const i = regions.findIndex((r) => r.id === region.id);
    const angle = -Math.PI / 2 + (i / Math.max(1, regions.length)) * Math.PI * 2;
    return { x: 50 + 34 * Math.cos(angle), y: 37.5 + 25 * Math.sin(angle) };
  }

  const stats = $derived.by(() => {
    const map = new Map<string, { areas: number; spots: number }>();
    for (const r of regions) map.set(r.id, { areas: 0, spots: 0 });
    for (const a of Object.values(areas)) {
      const s = map.get(a.regionId);
      if (s) s.areas++;
    }
    for (const sp of Object.values(spots)) {
      const s = map.get(areas[sp.areaId]?.regionId ?? '');
      if (s) s.spots++;
    }
    return map;
  });

  interface Link {
    a: RegionDef;
    b: RegionDef;
    /** Declared spot connections crossing this border. */
    crossings: number;
    /** Both ends pinned and the pins disagree with being connected. */
    far: boolean;
  }

  const links = $derived.by(() => {
    const byPair = new Map<string, { a: RegionDef; b: RegionDef; crossings: number }>();
    const region = (spot: SpotDef | undefined) =>
      spot ? areas[spot.areaId]?.regionId : undefined;
    for (const s of Object.values(spots)) {
      const ra = region(s);
      for (const c of s.connections ?? []) {
        const rb = region(spots[c.to]);
        if (!ra || !rb || ra === rb) continue;
        const key = [ra, rb].sort().join('|');
        const found = byPair.get(key);
        if (found) found.crossings++;
        else {
          const a = regions.find((r) => r.id === ra);
          const b = regions.find((r) => r.id === rb);
          if (a && b) byPair.set(key, { a, b, crossings: 1 });
        }
      }
    }
    const all = [...byPair.values()];

    // Far = out of step with the other pinned links, the way a travel time can
    // be out of step with its drawn length. Unpinned ends can't disagree yet.
    const dist = (l: { a: RegionDef; b: RegionDef }) =>
      Math.hypot(pt(l.a).x - pt(l.b).x, pt(l.a).y - pt(l.b).y);
    const measurable = all.filter((l) => l.a.world && l.b.world);
    const sorted = measurable.map(dist).sort((x, y) => x - y);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const far = (l: { a: RegionDef; b: RegionDef }) =>
      measurable.length >= FAR_MIN_LINKS && dist(l) > median * FAR_MULT;
    return all.map((l): Link => ({ ...l, far: !!(l.a.world && l.b.world) && far(l) }));
  });

  /**
   * Pinned regions sitting on top of each other, keyed by region id.
   * Travel-connected pairs are exempt: regions the player walks between are
   * SUPPOSED to be near each other — a dense home cluster is a layout, not a
   * mistake. The warning is for two UNRELATED regions claiming one location.
   */
  const overlapping = $derived.by(() => {
    const bad = new Set<string>();
    const placed = regions.filter((r) => r.world);
    const linked = new Set(links.map((l) => [l.a.id, l.b.id].sort().join('|')));
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        if (linked.has([placed[i].id, placed[j].id].sort().join('|'))) continue;
        const a = placed[i].world!;
        const b = placed[j].world!;
        if (Math.hypot(a.x - b.x, a.y - b.y) < OVERLAP_DIST) {
          bad.add(placed[i].id);
          bad.add(placed[j].id);
        }
      }
    }
    return bad;
  });

  // ---------- Geometry ----------

  function linkGeom(l: Link) {
    const a = pt(l.a);
    const b = pt(l.b);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const gap = (R + 0.6) * s;
    return {
      x1: a.x + ux * gap,
      y1: a.y + uy * gap,
      x2: b.x - ux * gap,
      y2: b.y - uy * gap,
      mx: (a.x + b.x) / 2,
      my: (a.y + b.y) / 2,
    };
  }

  // ---------- Pointer plumbing ----------

  function toData(ev: { clientX: number; clientY: number }): { x: number; y: number } {
    if (!svgEl) return { x: 0, y: 0 };
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function clampToCanvas(x: number, y: number): { x: number; y: number } {
    return { x: Math.min(100, Math.max(0, x)), y: Math.min(75, Math.max(0, y)) };
  }

  function round(v: number): number {
    return snap ? Math.round(v * 2) / 2 : Math.round(v * 10) / 10;
  }

  function startDrag(ev: PointerEvent, region: RegionDef): void {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
    const p = toData(ev);
    const here = pt(region);
    dragging = { id: region.id, dx: p.x - here.x, dy: p.y - here.y, moved: false };
  }

  function onPointerMove(ev: PointerEvent): void {
    if (panning) {
      const p = toData(ev);
      view = { ...view, x: view.x + (panning.x - p.x), y: view.y + (panning.y - p.y) };
      return;
    }
    if (!dragging) return;
    const region = store.get<RegionDef>('region', dragging.id);
    if (!region) return;
    const p = toData(ev);
    const next = clampToCanvas(round(p.x - dragging.dx), round(p.y - dragging.dy));
    if (next.x === region.world?.x && next.y === region.world?.y) return;
    dragging.moved = true;
    store.set('region', [dragging.id, 'world'], next);
  }

  function onPointerUp(): void {
    if (dragging && !dragging.moved) selected = dragging.id;
    dragging = null;
    panning = null;
  }

  function onCanvasPointerDown(ev: PointerEvent): void {
    if (ev.button === 1 || (ev.button === 0 && ev.target === svgEl)) {
      const p = toData(ev);
      panning = { x: p.x, y: p.y };
      svgEl?.setPointerCapture(ev.pointerId);
      if (ev.button === 0 && ev.target === svgEl) selected = null;
    }
  }

  function onWheel(ev: WheelEvent): void {
    ev.preventDefault();
    const p = toData(ev);
    const factor = ev.deltaY > 0 ? 1.12 : 1 / 1.12;
    const w = Math.min(320, Math.max(18, view.w * factor));
    const h = w * (view.h / view.w);
    view = {
      w,
      h,
      x: p.x - ((p.x - view.x) * w) / view.w,
      y: p.y - ((p.y - view.y) * h) / view.h,
    };
  }

  function resetView(): void {
    // With a backdrop, "Fit" means the MAP fills the pane — the empty bands
    // above and below a wide image are reachable by zooming out, not the
    // default. Without one, fit the whole canvas as before.
    if (bg && showMap && bgRect) {
      view = { x: bgRect.x - 2, y: bgRect.y - 2, w: bgRect.w + 4, h: bgRect.h + 4 };
    } else {
      view = { x: -4, y: -4, w: W + 8, h: H + 8 };
    }
  }

  function onKey(ev: KeyboardEvent): void {
    const tag = (ev.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (ev.key === 'Escape') {
      if (menu) menu = null;
      else selected = null;
    }
  }

  // ---------- Right-click menus ----------

  function copyId(id: string): void {
    navigator.clipboard?.writeText(id).then(
      () => store.say(`Copied '${id}'`, 'ok'),
      () => store.say('Clipboard refused', 'warn'),
    );
  }

  function regionMenu(region: RegionDef): MenuItem[] {
    return [
      { icon: '📋', label: 'Copy id', hint: region.id, onclick: () => copyId(region.id) },
      {
        icon: '🎯',
        label: 'Centre the view here',
        onclick: () => {
          const p = pt(region);
          view = { ...view, x: p.x - view.w / 2, y: p.y - view.h / 2 };
        },
      },
      ...(onbrowse
        ? [{ icon: '🗂️', label: 'Open the Regions browser', onclick: onbrowse }]
        : []),
      { separator: true },
      {
        icon: '📌',
        label: 'Unpin (back to the ring)',
        danger: true,
        disabled: !region.world,
        hint: region.world ? undefined : 'not pinned',
        onclick: () => {
          store.del('region', [region.id, 'world']);
          store.say(`Unpinned ${region.name}`, 'warn');
        },
      },
    ];
  }

  function canvasMenu(): MenuItem[] {
    return [
      { icon: '⤢', label: 'Fit the whole world', onclick: resetView },
      { icon: '🏷️', label: showNames ? 'Hide names' : 'Show names', onclick: () => (showNames = !showNames) },
      { icon: '🧮', label: showStats ? 'Hide contents' : 'Show contents', onclick: () => (showStats = !showStats) },
    ];
  }

  function openMenu(ev: MouseEvent, title: string, items: MenuItem[]): void {
    ev.preventDefault();
    ev.stopPropagation();
    menu = { x: ev.clientX, y: ev.clientY, title, items };
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="atlas-wrap">
  <div class="toolbar">
    <span class="pill" class:done={pinned === regions.length}>
      📌 {pinned} / {regions.length} pinned
    </span>
    <div class="grow"></div>
    {#if bg}
      <label class="toggle"><input type="checkbox" bind:checked={showMap} /> Map</label>
      {#if showMap}
        <input
          class="opacity"
          type="range"
          min="0.15"
          max="1"
          step="0.05"
          bind:value={mapOpacity}
          title="Map opacity"
        />
      {/if}
    {/if}
    <label class="toggle"><input type="checkbox" bind:checked={snap} /> Snap ½</label>
    <label class="toggle"><input type="checkbox" bind:checked={showNames} /> Names</label>
    <label class="toggle"><input type="checkbox" bind:checked={showStats} /> Contents</label>
    <label class="toggle"><input type="checkbox" bind:checked={showSky} /> Sky</label>
    <button class="tiny" onclick={resetView}>Fit</button>
  </div>

  {#if showSky}
    <div class="skybar">
      <span class="date">{formatDate(previewClock)} · {formatTime(previewClock)}</span>
      <span class="season">{previewClock.season}</span>
      <input
        class="scrub grow"
        type="range"
        min="0"
        max={DAYS_PER_YEAR - 1}
        step="1"
        bind:value={scrubDay}
        title="day of the year"
      />
      <input
        class="scrub hour"
        type="range"
        min="0"
        max="23"
        step="1"
        bind:value={scrubHour}
        title="hour of the day"
      />
    </div>
  {/if}

  <svg
    bind:this={svgEl}
    viewBox="{view.x} {view.y} {view.w} {view.h}"
    style="--s: {s}"
    class="canvas"
    role="application"
    aria-label="World atlas editor"
    onpointerdown={onCanvasPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={() => {
      panning = null;
      dragging = null;
    }}
    oncontextmenu={(ev) => openMenu(ev, 'Atlas', canvasMenu())}
    onwheel={onWheel}
  >
    <defs>
      <pattern id="atlas-grid" width="10" height="10" patternUnits="userSpaceOnUse">
        <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#1a2130" stroke-width="0.15" />
      </pattern>
    </defs>

    {#if bg && showMap}
      <image
        href={BG_URL}
        x="0"
        y="0"
        width={W}
        height={H}
        preserveAspectRatio="xMidYMid meet"
        opacity={mapOpacity}
        pointer-events="none"
      />
    {/if}
    <rect x="0" y="0" width={W} height={H} fill="url(#atlas-grid)" stroke="#243049" stroke-width="0.2" />

    {#each links as l (l.a.id + '|' + l.b.id)}
      {@const g = linkGeom(l)}
      <g class="link" class:far={l.far}>
        <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} class="link-line" />
        {#if l.crossings > 1}
          <text x={g.mx} y={g.my - s} text-anchor="middle" class="link-count">{l.crossings}</text>
        {/if}
        <title>
          {l.a.name} ↔ {l.b.name}: {l.crossings} crossing{l.crossings === 1 ? '' : 's'}{l.far
            ? ' — pinned much further apart than other connected regions'
            : ''}
        </title>
      </g>
    {/each}

    {#each regions as region (region.id)}
      {@const p = pt(region)}
      {@const counts = stats.get(region.id)}
      {@const sample = sky.get(region.id)}
      <g
        class="pin"
        class:unpinned={!region.world}
        class:selected={selected === region.id}
        class:warned={overlapping.has(region.id)}
        role="button"
        tabindex="0"
        aria-label={region.name}
        onpointerdown={(ev) => startDrag(ev, region)}
        oncontextmenu={(ev) => {
          selected = region.id;
          openMenu(ev, `🗺️ ${region.name}`, regionMenu(region));
        }}
        onkeydown={(ev) => ev.key === 'Enter' && (selected = region.id)}
      >
        <circle
          cx={p.x}
          cy={p.y}
          r={R * s}
          class="dot"
          style={sample ? `fill: ${tempColor(sample.temp)}` : ''}
        />
        <text x={p.x} y={p.y + 1.6 * s} text-anchor="middle" class="icon">🗺️</text>
        {#if showNames}
          <text x={p.x} y={p.y + (R + 2.8) * s} text-anchor="middle" class="label">{region.name}</text>
        {/if}
        {#if showStats && counts}
          <text x={p.x} y={p.y + (R + (showNames ? 5.4 : 2.8)) * s} text-anchor="middle" class="stats">
            {counts.areas} area{counts.areas === 1 ? '' : 's'} · {counts.spots} spot{counts.spots === 1 ? '' : 's'}
          </text>
        {/if}
        {#if sample}
          {@const wxRow = (showNames ? 1 : 0) + (showStats ? 1 : 0)}
          <text x={p.x} y={p.y + (R + 2.8 + wxRow * 2.6) * s} text-anchor="middle" class="wx">
            {WEATHER_ICONS[sample.kind]} {sample.kind} · {Math.round(sample.temp)}°
          </text>
        {/if}
        <title>{region.world ? `${region.name} — ${p.x}, ${p.y}` : `${region.name} — not pinned yet; drag to place`}</title>
      </g>
    {/each}
  </svg>

  <div class="legend">
    <span class="k"><i class="sw solid"></i> pinned</span>
    <span class="k"><i class="sw dashed"></i> unpinned — drag to place</span>
    <span class="k"><i class="ln"></i> travel crosses the border</span>
    <span class="k"><i class="ln far"></i> pins disagree with the roads</span>
    <span class="grow"></span>
    <span class="dim">
      drag to pin · wheel to zoom · <b>right-click</b> a pin for actions · positions land in
      <code>world: &lbrace; x, y &rbrace;</code> on Review &amp; Apply
    </span>
  </div>
</div>

{#if menu}
  <ContextMenu x={menu.x} y={menu.y} title={menu.title} items={menu.items} onclose={() => (menu = null)} />
{/if}

<style>
  .atlas-wrap {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 10px;
    border-bottom: 1px solid var(--border);
    background: var(--bg2);
    flex-shrink: 0;
  }

  .pill {
    font-size: 11.5px;
    color: var(--warn);
    border: 1px solid var(--warn);
    border-radius: 99px;
    padding: 1px 8px;
  }

  .pill.done {
    color: var(--ok);
    border-color: var(--ok);
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11.5px;
    color: var(--dim);
    white-space: nowrap;
    cursor: pointer;
  }

  .opacity {
    width: 70px;
  }

  .canvas {
    flex: 1;
    min-height: 0;
    width: 100%;
    background: #0a0d13;
    touch-action: none;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
  }

  .canvas :global(:focus) {
    outline: none;
  }

  .canvas :global(:focus-visible) {
    outline: 1px solid var(--accent);
    outline-offset: 1px;
  }

  /* ---------- Links ---------- */

  .link-line {
    stroke: #46536e;
    stroke-width: calc(0.5px * var(--s, 1));
  }

  .link.far .link-line {
    stroke: var(--warn);
    stroke-dasharray: calc(1.6px * var(--s, 1)) calc(1px * var(--s, 1));
  }

  .link-count {
    font-size: calc(2px * var(--s, 1));
    fill: var(--dimmer);
  }

  .link.far .link-count {
    fill: var(--warn);
  }

  /* ---------- Pins ---------- */

  .pin {
    cursor: grab;
  }

  .pin .dot {
    fill: #1a2233;
    stroke: #46536e;
    stroke-width: calc(0.45px * var(--s, 1));
  }

  .pin.unpinned .dot {
    stroke-dasharray: calc(1.2px * var(--s, 1)) calc(0.9px * var(--s, 1));
    fill: #131926;
  }

  .pin.unpinned .icon,
  .pin.unpinned .label {
    opacity: 0.65;
  }

  .pin:hover .dot {
    stroke: var(--accent);
  }

  .pin.selected .dot {
    stroke: var(--accent);
    stroke-width: calc(0.8px * var(--s, 1));
    fill: #1e2b45;
  }

  .pin.warned .dot {
    stroke: var(--warn);
  }

  .icon {
    font-size: calc(4px * var(--s, 1));
    pointer-events: none;
  }

  .label {
    font-size: calc(2.6px * var(--s, 1));
    fill: var(--dim);
    pointer-events: none;
  }

  .stats {
    font-size: calc(1.9px * var(--s, 1));
    fill: var(--dimmer);
    pointer-events: none;
  }

  .wx {
    font-size: calc(2px * var(--s, 1));
    fill: var(--dim);
    pointer-events: none;
  }

  /* ---------- Sky scrubber ---------- */

  .skybar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 10px;
    border-bottom: 1px solid var(--border);
    background: var(--bg2);
    flex-shrink: 0;
    font-size: 11.5px;
  }

  .skybar .date {
    color: var(--dim);
    white-space: nowrap;
  }

  .skybar .season {
    color: var(--accent);
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.7px;
  }

  .skybar .scrub {
    min-width: 60px;
  }

  .skybar .hour {
    max-width: 110px;
  }

  /* ---------- Legend ---------- */

  .legend {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 10px;
    border-top: 1px solid var(--border);
    background: var(--bg2);
    font-size: 11px;
    color: var(--dim);
    flex-shrink: 0;
  }

  .k {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
  }

  .ln {
    display: inline-block;
    width: 16px;
    height: 0;
    border-top: 2px solid #46536e;
  }

  .ln.far {
    border-top-style: dashed;
    border-color: var(--warn);
  }

  .sw {
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    border: 1.5px solid #46536e;
  }

  .sw.dashed {
    border-style: dashed;
  }
</style>
