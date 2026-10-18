<script lang="ts">
  /**
   * The world map, editable.
   *
   * Drag a spot to place it, drag from its rim to connect it, click an edge to
   * make it one-way or hidden. Everything writes straight back into
   * `locations.data.ts` — `map: { x, y }` is the same 0–100 × 0–75 space the
   * in-game map renders, so what you lay out here is literally what players see.
   *
   * The map draws DECLARED connections, not the mirrored adjacency the engine
   * builds: an edge on screen is a line of source you can edit. A two-way road
   * is one line with no arrows, a one-way drop is one line with an arrow, and
   * two separately-declared directions bow apart so both stay clickable.
   */
  import { tick, untrack } from 'svelte';
  import { store } from '../lib/store.svelte';
  import { validate, type Issue } from '../lib/validate';
  import type { Selection } from '../lib/selection';
  import ContextMenu, { type MenuItem } from '../lib/ContextMenu.svelte';
  import type { Connection, NpcDef, SpotDef } from '../../src/core/types';
  import { TOOLS, tilesUi, type Tool } from '../lib/tiles.svelte';
  import { eraseRect, fillRect, paintStamp, pickAt, spanRect, tileAt, tileCentre } from '../lib/tilemap';
  import { drawTileMap } from '../../src/ui/lib/tilemaps/draw';
  import type { TileRect } from '../../src/ui/lib/tilemaps/types';

  interface Props {
    selection: Selection;
    onselect: (s: Selection) => void;
  }
  let { selection, onselect }: Props = $props();

  const W = 100;
  const H = 75;
  const R = 3.2; // node radius, data units

  let svgEl = $state<SVGSVGElement | null>(null);
  let view = $state({ x: -4, y: -4, w: W + 8, h: H + 8 });
  let regionId = $state<string | null>(null);
  let snap = $state(true);
  let showLabels = $state(true);
  let showNpcs = $state(true);
  let showFinds = $state(true);
  let showTicks = $state(false);

  /** Live drag of a node, or a connection being pulled out of one. */
  let dragging = $state<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  /**
   * A connection being drawn. `drag` mode ends on pointerup (shift-drag);
   * `click` mode was started from the context menu and waits for a second
   * click, because there is no button held down to release.
   */
  let linking = $state<{
    from: string;
    x: number;
    y: number;
    over: string | null;
    mode: 'drag' | 'click';
  } | null>(null);
  /**
   * A region tab being dragged along the strip.
   *
   * Region order in the world map IS key order in the data file — there is no
   * rank field to set — so this drag writes source, staging a reorder op the
   * same way dragging a node stages its coordinates.
   */
  let tabDrag = $state<{ id: string; over: string | null; before: boolean } | null>(null);

  function onTabOver(ev: DragEvent, target: string): void {
    if (!tabDrag || tabDrag.id === target) return;
    ev.preventDefault(); // without this the drop never fires
    const box = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    tabDrag = { ...tabDrag, over: target, before: ev.clientX < box.left + box.width / 2 };
  }

  function onTabDrop(ev: DragEvent): void {
    ev.preventDefault();
    if (tabDrag?.over) store.reorder('region', tabDrag.id, tabDrag.over, tabDrag.before);
    tabDrag = null;
  }

  /** Alt+←/→ moves the focused tab, so the strip is not drag-only. */
  function onTabKey(ev: KeyboardEvent, id: string): void {
    if (!ev.altKey || (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight')) return;
    const order = regions.map((r) => r.id);
    const to = order.indexOf(id) + (ev.key === 'ArrowLeft' ? -1 : 1);
    if (to < 0 || to >= order.length) return;
    ev.preventDefault();
    const el = ev.currentTarget as HTMLElement;
    store.reorder('region', id, order[to], ev.key === 'ArrowLeft');
    // A keyed `{#each}` MOVES this node rather than rebuilding it, and a moved
    // node loses focus; hand it back once the strip has redrawn.
    tick().then(() => el.focus());
  }

  let menu = $state<{ x: number; y: number; title: string; items: MenuItem[] } | null>(null);

  const regions = $derived(store.list<{ id: string; name: string }>('region'));
  const areas = $derived(store.all<{ id: string; name: string; regionId: string }>('area'));
  const spots = $derived(store.all<SpotDef>('spot'));
  const npcs = $derived(store.list<NpcDef>('npc'));

  const region = $derived(regionId ?? regions[0]?.id ?? null);
  const issues = $derived(validate(store));

  /** Errors keyed by spot id, so a node can light up red. */
  const spotIssues = $derived.by(() => {
    const map = new Map<string, Issue[]>();
    for (const i of issues) {
      if (i.subject.kind !== 'spot') continue;
      map.set(i.subject.id, [...(map.get(i.subject.id) ?? []), i]);
    }
    // An NPC standing nowhere is really a problem with the map, so surface it
    // on the spot it names — otherwise it's invisible here.
    for (const i of issues) {
      if (i.subject.kind !== 'npc') continue;
      const npc = store.get<NpcDef>('npc', i.subject.id);
      if (npc?.spotId && spots[npc.spotId]) {
        map.set(npc.spotId, [...(map.get(npc.spotId) ?? []), i]);
      }
    }
    return map;
  });

  const inRegion = $derived(
    Object.values(spots).filter((s) => areas[s.areaId]?.regionId === region),
  );

  // ---------- The drawn map (Tiles mode) ----------
  //
  // A region with a map (store.maps) paints under the diagram whether or not
  // Tiles mode is on — the picture is what players see. With the mode on, a
  // paint tool turns the canvas into a brush target and the spot layer goes
  // pointer-transparent until the Hand tool is picked again.

  const tileMap = $derived(region ? (store.maps[region] ?? null) : null);
  const painting = $derived(tilesUi.on && tilesUi.tool !== 'hand');
  let tileCanvas = $state<HTMLCanvasElement | null>(null);
  let overlayCanvas = $state<HTMLCanvasElement | null>(null);
  let hover = $state<{ x: number; y: number } | null>(null);
  let strokeRect = $state<TileRect | null>(null);
  /** The stroke in progress; plain, because nothing renders from it but strokeRect. */
  let stroke: { tool: Tool; start: { x: number; y: number }; last: { x: number; y: number }; seed: number; changed: boolean } | null =
    null;

  $effect(() => {
    tilesUi.show(region);
  });

  // The picture: redrawn when the grid changes, a layer is hidden, or the region switches.
  $effect(() => {
    const canvas = tileCanvas;
    const map = tileMap;
    void tilesUi.version;
    const hidden = tilesUi.on ? new Set(tilesUi.hidden) : undefined;
    if (!canvas || !map) return;
    untrack(() => void drawTileMap(canvas, map, { resolve: tilesUi.resolveImage, hidden }));
  });

  // The overlay: grid, hovered cell with the stamp ghosted, the rectangle being dragged.
  $effect(() => {
    const canvas = overlayCanvas;
    const map = tileMap;
    const h = hover;
    const rect = strokeRect;
    const stamp = tilesUi.stamp;
    const tool = tilesUi.tool;
    const grid = tilesUi.grid;
    void tilesUi.loaded;
    if (!canvas || !map) return;
    const T = map.tile;
    canvas.width = map.width * T;
    canvas.height = map.height * T;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (grid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 1; x < map.width; x++) {
        ctx.moveTo(x * T + 0.5, 0);
        ctx.lineTo(x * T + 0.5, canvas.height);
      }
      for (let y = 1; y < map.height; y++) {
        ctx.moveTo(0, y * T + 0.5);
        ctx.lineTo(canvas.width, y * T + 0.5);
      }
      ctx.stroke();
    }
    if (rect) {
      ctx.fillStyle = tool === 'eraseRect' ? 'rgba(248, 113, 113, 0.28)' : 'rgba(108, 158, 255, 0.28)';
      ctx.fillRect(rect.x * T, rect.y * T, rect.w * T, rect.h * T);
      ctx.strokeStyle = tool === 'eraseRect' ? '#f87171' : '#6c9eff';
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x * T + 1, rect.y * T + 1, rect.w * T - 2, rect.h * T - 2);
    } else if (h && tool !== 'hand') {
      if (stamp && (tool === 'brush' || tool === 'rect')) {
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 0.65;
        untrack(() => {
          for (const layer of stamp.layers) {
            for (let y = 0; y < stamp.h; y++) {
              for (let x = 0; x < stamp.w; x++) {
                const cell = layer.cells[y]?.[x];
                if (!cell) continue;
                const img = tilesUi.imageNow(cell.key);
                if (!img) continue;
                ctx.drawImage(img, (cell.local % cell.columns) * T, Math.floor(cell.local / cell.columns) * T, T, T, (h.x + x) * T, (h.y + y) * T, T, T);
              }
            }
          }
        });
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#6c9eff';
        ctx.lineWidth = 2;
        ctx.strokeRect(h.x * T + 1, h.y * T + 1, stamp.w * T - 2, stamp.h * T - 2);
      } else {
        ctx.strokeStyle = tool === 'erase' || tool === 'eraseRect' ? '#f87171' : '#6c9eff';
        ctx.lineWidth = 2;
        ctx.strokeRect(h.x * T + 1, h.y * T + 1, T - 2, T - 2);
      }
    }
  });

  function cellUnder(ev: { clientX: number; clientY: number }): { x: number; y: number } | null {
    if (!tileMap) return null;
    const p = toData(ev);
    return tileAt(tileMap, p.x, p.y);
  }

  /** The nearest cell, for rectangles dragged past the picture's edge. */
  function cellNear(ev: { clientX: number; clientY: number }): { x: number; y: number } {
    const p = toData(ev);
    const map = tileMap!;
    return {
      x: Math.min(map.width - 1, Math.max(0, Math.floor((p.x / 100) * map.width))),
      y: Math.min(map.height - 1, Math.max(0, Math.floor((p.y / 75) * map.height))),
    };
  }

  /** Every cell on the straight line between two, so a fast drag leaves no gaps. */
  function cellsBetween(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number }[] {
    const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    const out: { x: number; y: number }[] = [];
    for (let i = 1; i <= n; i++) {
      out.push({ x: Math.round(a.x + ((b.x - a.x) * i) / n), y: Math.round(a.y + ((b.y - a.y) * i) / n) });
    }
    return out;
  }

  function applyCell(tool: Tool, cell: { x: number; y: number }): boolean {
    if (!tileMap) return false;
    if (tool === 'brush' && tilesUi.stamp) return paintStamp(tileMap, tilesUi.stamp, cell.x, cell.y, tilesUi.layer);
    if (tool === 'erase') return eraseRect(tileMap, tilesUi.layer, { x: cell.x, y: cell.y, w: 1, h: 1 });
    return false;
  }

  /** Returns true when the pointer-down was consumed by a paint tool. */
  function beginStroke(ev: PointerEvent): boolean {
    if (!tileMap || !region) return false;
    const cell = cellUnder(ev);
    const tool = tilesUi.tool;
    if (tool === 'pick') {
      if (!cell) return true;
      const picked = pickAt(tileMap, cell.x, cell.y, ev.shiftKey ? tilesUi.layer : null);
      if (!picked) {
        store.say('Nothing there to pick', 'warn');
        return true;
      }
      tilesUi.stamp = picked.stamp;
      tilesUi.layer = picked.layer;
      tilesUi.tool = 'brush';
      store.say(`Picked from layer '${tileMap.layers[picked.layer].name}'`, 'ok');
      return true;
    }
    if ((tool === 'brush' || tool === 'rect') && !tilesUi.stamp) {
      store.say('Load the brush first — drag a rectangle on a sheet in the palette', 'warn');
      return true;
    }
    const start = cell ?? (tool === 'rect' || tool === 'eraseRect' ? cellNear(ev) : null);
    if (!start) return true;
    tilesUi.snapshot(region);
    stroke = { tool, start, last: start, seed: Math.floor(Math.random() * 1e9), changed: false };
    if (tool === 'brush' || tool === 'erase') {
      stroke.changed = applyCell(tool, start);
      if (stroke.changed) tilesUi.changed();
    } else {
      strokeRect = spanRect(start, start);
    }
    svgEl?.setPointerCapture(ev.pointerId);
    return true;
  }

  function moveStroke(ev: PointerEvent): void {
    if (!stroke || !tileMap) return;
    if (stroke.tool === 'brush' || stroke.tool === 'erase') {
      const cell = cellUnder(ev);
      if (!cell || (cell.x === stroke.last.x && cell.y === stroke.last.y)) return;
      let changed = false;
      for (const c of cellsBetween(stroke.last, cell)) changed = applyCell(stroke.tool, c) || changed;
      stroke.last = cell;
      if (changed) {
        stroke.changed = true;
        tilesUi.changed();
      }
      return;
    }
    strokeRect = spanRect(stroke.start, cellNear(ev));
  }

  function endStroke(): void {
    if (!stroke) return;
    const s = stroke;
    stroke = null;
    if (!tileMap || !region) {
      strokeRect = null;
      return;
    }
    if (s.tool === 'rect' && strokeRect && tilesUi.stamp) {
      s.changed = fillRect(tileMap, strokeRect, tilesUi.stamp, tilesUi.layer, tilesUi.random ? 'random' : 'tile', s.seed);
    } else if (s.tool === 'eraseRect' && strokeRect) {
      s.changed = eraseRect(tileMap, tilesUi.layer, strokeRect);
    }
    strokeRect = null;
    if (s.changed) {
      store.touchTileMap(region);
      tilesUi.changed();
    } else {
      tilesUi.dropSnapshot(region);
    }
  }

  function toggleTiles(): void {
    tilesUi.on = !tilesUi.on;
    if (!tilesUi.on) tilesUi.tool = 'hand';
    onselect(null);
  }

  const npcsBySpot = $derived.by(() => {
    const map = new Map<string, NpcDef[]>();
    for (const n of npcs) map.set(n.spotId, [...(map.get(n.spotId) ?? []), n]);
    return map;
  });

  interface DrawnEdge {
    from: SpotDef;
    to: SpotDef;
    conn: Connection;
    /** Sideways offset so two declared directions don't overlap. */
    bow: number;
    /** Target is outside the shown region. */
    exit: boolean;
  }

  const edges = $derived.by(() => {
    const drawn: DrawnEdge[] = [];
    const exits: { from: SpotDef; to: SpotDef; conn: Connection }[] = [];
    // Count declarations per unordered pair so mutually-declared roads bow apart.
    const pairCount = new Map<string, number>();
    for (const s of inRegion) {
      for (const c of s.connections ?? []) {
        const key = [s.id, c.to].sort().join('|');
        pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
      }
    }
    const seenPair = new Map<string, number>();

    for (const s of inRegion) {
      for (const c of s.connections ?? []) {
        const target = spots[c.to];
        if (!target) continue;
        if (areas[target.areaId]?.regionId !== region) {
          exits.push({ from: s, to: target, conn: c });
          continue;
        }
        const key = [s.id, c.to].sort().join('|');
        const nth = seenPair.get(key) ?? 0;
        seenPair.set(key, nth + 1);
        const bow = (pairCount.get(key) ?? 1) > 1 ? (nth === 0 ? 3 : -3) : 0;
        drawn.push({ from: s, to: target, conn: c, bow, exit: false });
      }
    }
    return { drawn, exits };
  });

  // ---------- Geometry ----------

  function pt(spot: SpotDef): { x: number; y: number } {
    return { x: spot.map?.x ?? 50, y: spot.map?.y ?? 37 };
  }

  /** Path for an edge, pulled back from both node rims and bowed if needed. */
  function edgeGeom(e: DrawnEdge) {
    const a = pt(e.from);
    const b = pt(e.to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    // Perpendicular offset for the bow.
    const px = -uy * e.bow;
    const py = ux * e.bow;
    const gap = R + 0.6;
    const x1 = a.x + ux * gap + px;
    const y1 = a.y + uy * gap + py;
    const x2 = b.x - ux * gap + px;
    const y2 = b.y - uy * gap + py;
    return { x1, y1, x2, y2, ux, uy, mx: (x1 + x2) / 2, my: (y1 + y2) / 2, len };
  }

  /** Arrowhead triangle at the target end of a one-way edge. */
  function arrow(e: DrawnEdge): string {
    const g = edgeGeom(e);
    const size = 1.9;
    const tipX = g.x2;
    const tipY = g.y2;
    const backX = tipX - g.ux * size;
    const backY = tipY - g.uy * size;
    const nx = -g.uy * size * 0.55;
    const ny = g.ux * size * 0.55;
    return `${tipX},${tipY} ${backX + nx},${backY + ny} ${backX - nx},${backY - ny}`;
  }

  /** Suggested travel time from how far apart two spots sit on the map. */
  function suggestTicks(a: SpotDef, b: SpotDef): number {
    const d = Math.hypot((a.map?.x ?? 0) - (b.map?.x ?? 0), (a.map?.y ?? 0) - (b.map?.y ?? 0));
    return Math.max(5, Math.round((d * 3) / 5) * 5);
  }

  /** How far a declared tick count strays from what the drawn distance implies. */
  function tickDrift(e: DrawnEdge): number {
    const want = suggestTicks(e.from, e.to);
    if (!want || !e.conn.ticks) return 0;
    return e.conn.ticks / want;
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
    // The linter's canvas, not the viewBox: x 0–100, y 0–75.
    return {
      x: Math.min(100, Math.max(0, x)),
      y: Math.min(75, Math.max(0, y)),
    };
  }

  function round(v: number): number {
    return snap ? Math.round(v * 2) / 2 : Math.round(v * 10) / 10;
  }

  function startDrag(ev: PointerEvent, spot: SpotDef): void {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    const p = toData(ev);
    const here = pt(spot);

    // A link started from the menu is finished by clicking the target, not by
    // releasing a button — so this click completes it instead of starting a drag.
    if (linking?.mode === 'click') {
      const from = linking.from;
      linking = null;
      if (from !== spot.id) connect(from, spot.id);
      return;
    }

    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);

    if (ev.shiftKey || ev.metaKey || ev.ctrlKey) {
      linking = { from: spot.id, x: p.x, y: p.y, over: null, mode: 'drag' };
      return;
    }
    dragging = { id: spot.id, dx: p.x - here.x, dy: p.y - here.y, moved: false };
  }

  function onPointerMove(ev: PointerEvent): void {
    if (linking) {
      const p = toData(ev);
      linking = { ...linking, x: p.x, y: p.y, over: hitTest(p.x, p.y, linking.from) };
      return;
    }
    if (!dragging) return;
    const p = toData(ev);
    const spot = spots[dragging.id];
    if (!spot) return;
    let next = clampToCanvas(round(p.x - dragging.dx), round(p.y - dragging.dy));
    // On a drawn region a spot sits on a tile, so snap to the tile's centre.
    if (tileMap && snap) {
      const t = tileAt(tileMap, Math.min(99.99, next.x), Math.min(74.99, next.y));
      if (t) next = tileCentre(tileMap, t.x, t.y);
    }
    if (next.x === spot.map?.x && next.y === spot.map?.y) return;
    dragging.moved = true;
    store.set('spot', [dragging.id, 'map'], next);
  }

  function onPointerUp(): void {
    // A click-mode link outlives every pointerup until a target is chosen.
    if (linking?.mode === 'click') return;
    if (linking) {
      const target = linking.over;
      if (target && target !== linking.from) connect(linking.from, target);
      linking = null;
      return;
    }
    if (dragging && !dragging.moved) onselect({ type: 'spot', id: dragging.id });
    dragging = null;
  }

  function hitTest(x: number, y: number, exclude?: string): string | null {
    for (const s of inRegion) {
      if (s.id === exclude) continue;
      const p = pt(s);
      if (Math.hypot(p.x - x, p.y - y) <= R + 1.2) return s.id;
    }
    return null;
  }

  // ---------- Editing ----------

  function connect(from: string, to: string): void {
    const a = spots[from];
    const b = spots[to];
    if (!a || !b) return;
    if ((a.connections ?? []).some((c) => c.to === to)) {
      store.say(`${a.name} already declares a way to ${b.name}`, 'warn');
      onselect({ type: 'edge', from, to });
      return;
    }
    // Declaring the reverse of an existing two-way road would double it up.
    const reverse = (b.connections ?? []).find((c) => c.to === from);
    if (reverse && !reverse.oneWay) {
      store.say(`${b.name} already connects both ways — edit that edge instead`, 'warn');
      onselect({ type: 'edge', from: to, to: from });
      return;
    }
    const conn: Connection = { to, ticks: suggestTicks(a, b) };
    store.set('spot', [from, 'connections', `#to=${to}`], conn);
    onselect({ type: 'edge', from, to });
    store.say(`${a.name} → ${b.name}, ${conn.ticks} ticks`, 'ok');
  }

  function addSpot(x: number, y: number): void {
    if (!region) {
      store.say('Create a region first — the world is region › area › spot', 'bad');
      return;
    }
    // A spot lives in an area of THE REGION ON SCREEN. A fresh region has no
    // areas yet, so mint a starter one rather than falling back to the first
    // area in the registry — which is a different region entirely, and put
    // every new spot on the Verdant Frontier map no matter where you drew it.
    let areaId = Object.values(areas).find((a) => a.regionId === region)?.id;
    if (!areaId) {
      let candidate = `${region}_area`;
      let n = 2;
      while (areas[candidate]) candidate = `${region}_area_${n++}`;
      areaId = candidate;
      const regionName = regions.find((r) => r.id === region)?.name ?? region;
      store.add('area', areaId, { id: areaId, name: regionName, regionId: region });
      store.say(`Created area '${areaId}' in ${regionName} — rename it in the Areas browser`, 'ok');
    }
    let n = 1;
    while (spots[`new_spot_${n}`]) n++;
    const id = `new_spot_${n}`;
    const spot: SpotDef = {
      id,
      name: `New Spot ${n}`,
      icon: '📍',
      areaId,
      map: clampToCanvas(round(x), round(y)),
      desc: '',
      activities: [],
      connections: [],
    };
    store.add('spot', id, spot as unknown as Record<string, unknown>);
    onselect({ type: 'spot', id });
    store.say(`Added ${id} — give it a name and a way in`, 'ok');
  }

  // ---------- Right-click menus ----------

  function copyId(id: string): void {
    navigator.clipboard?.writeText(id).then(
      () => store.say(`Copied '${id}'`, 'ok'),
      () => store.say('Clipboard refused — copy it from the inspector', 'warn'),
    );
  }

  /** A fresh id derived from another, e.g. deep_woods → deep_woods_copy_2. */
  function freeId(base: string): string {
    if (!spots[`${base}_copy`]) return `${base}_copy`;
    let n = 2;
    while (spots[`${base}_copy_${n}`]) n++;
    return `${base}_copy_${n}`;
  }

  function duplicateSpot(spot: SpotDef): void {
    const id = freeId(spot.id);
    const clone = structuredClone($state.snapshot(spot)) as SpotDef;
    clone.id = id;
    clone.name = `${spot.name} Copy`;
    // Offset so it isn't hidden underneath the original, and drop the waypoint
    // flag — two caravan stops on the same square is never what you meant.
    clone.map = clampToCanvas(round((spot.map?.x ?? 50) + 7), round((spot.map?.y ?? 37) + 5));
    delete clone.waypoint;
    store.add('spot', id, clone as unknown as Record<string, unknown>);
    onselect({ type: 'spot', id });
    store.say(`Duplicated as ${id} — nothing points at it yet`, 'ok');
  }

  function deleteSpot(spot: SpotDef): void {
    const inbound = Object.values(spots).filter(
      (s) => s.id !== spot.id && (s.connections ?? []).some((c) => c.to === spot.id),
    );
    const warn = inbound.length
      ? `\n\n${inbound.length} spot(s) still connect to it: ${inbound.map((s) => s.name).join(', ')}. Those become dangling references.`
      : '';
    if (!confirm(`Delete ${spot.name} (${spot.id})?${warn}`)) return;
    store.del('spot', [spot.id]);
    onselect(null);
    store.say(`Deleted ${spot.id}`, 'warn');
  }

  function nextFindId(spot: SpotDef): string {
    let n = (spot.finds ?? []).length + 1;
    while ((spot.finds ?? []).some((f) => f.id === `find_${n}`)) n++;
    return `find_${n}`;
  }

  /** The shallowest gap left on the threshold track, so finds don't stack up. */
  function nextFindAt(spot: SpotDef): number {
    const taken = (spot.finds ?? []).map((f) => f.at).sort((a, b) => a - b);
    for (let at = 0.25; at <= 1; at = Math.round((at + 0.25) * 100) / 100) {
      if (!taken.includes(at)) return at;
    }
    return 1;
  }

  function addFind(spot: SpotDef): void {
    if (!spot.exploreTicks) store.set('spot', [spot.id, 'exploreTicks'], 150);
    if (!(spot.activities ?? []).some((a) => a.kind === 'explore')) {
      store.set('spot', [spot.id, 'activities', `#id=explore`], {
        id: 'explore',
        kind: 'explore',
        name: 'Explore',
        icon: '🧭',
      });
    }
    const id = nextFindId(spot);
    store.set('spot', [spot.id, 'finds', `#id=${id}`], { id, at: nextFindAt(spot), desc: '' });
    onselect({ type: 'spot', id: spot.id });
    store.say(`Added ${id} — set what it pays on the track`, 'ok');
  }

  function spotMenu(spot: SpotDef): MenuItem[] {
    const hiddenOut = (spot.connections ?? []).filter((c) => c.hidden);
    return [
      { icon: '🔗', label: 'Connect from here…', hint: 'or shift-drag', onclick: () => beginLink(spot) },
      { icon: '🔎', label: 'Add exploration find', onclick: () => addFind(spot) },
      {
        icon: '⚡',
        label: spot.waypoint ? 'Remove waypoint' : 'Make a waypoint',
        onclick: () =>
          spot.waypoint
            ? store.del('spot', [spot.id, 'waypoint'])
            : store.set('spot', [spot.id, 'waypoint'], true),
      },
      {
        icon: '⚔️',
        label: spot.forced ? 'Unforce the arrival' : 'Force a fight on arrival',
        hint: !spot.forced && !(spot.encounters ?? []).length ? 'no encounters here' : undefined,
        onclick: () =>
          spot.forced
            ? store.del('spot', [spot.id, 'forced'])
            : store.set('spot', [spot.id, 'forced'], true),
      },
      { separator: true },
      { icon: '⧉', label: 'Duplicate spot', onclick: () => duplicateSpot(spot) },
      { icon: '📋', label: 'Copy id', hint: spot.id, onclick: () => copyId(spot.id) },
      {
        icon: '🎯',
        label: 'Centre the view here',
        onclick: () => {
          const p = pt(spot);
          view = { ...view, x: p.x - view.w / 2, y: p.y - view.h / 2 };
        },
      },
      { separator: true },
      {
        icon: '🗑',
        label: 'Delete spot',
        danger: true,
        hint: hiddenOut.length ? `${hiddenOut.length} hidden way(s)` : undefined,
        onclick: () => deleteSpot(spot),
      },
    ];
  }

  function beginLink(spot: SpotDef): void {
    const p = pt(spot);
    linking = { from: spot.id, x: p.x, y: p.y, over: null, mode: 'click' };
    store.say(`Click the spot ${spot.name} should lead to — Esc to cancel`, 'ok');
  }

  function edgeMenu(e: DrawnEdge): MenuItem[] {
    // The kind goes to set/del as its own argument — a path starting with
    // 'spot' would edit a phantom entry named "spot" instead of this edge.
    const at = (k: string) => [e.from.id, 'connections', `#to=${e.to.id}`, k] as const;
    const want = suggestTicks(e.from, e.to);
    const canComb = (e.from.activities ?? []).some((a) => a.kind === 'explore');
    const opener = (e.from.finds ?? []).some((f) => f.path === e.to.id);
    return [
      {
        icon: e.conn.oneWay ? '↔' : '→',
        label: e.conn.oneWay ? 'Make two-way' : 'Make one-way',
        onclick: () =>
          e.conn.oneWay
            ? store.del('spot', [...at('oneWay')])
            : store.set('spot', [...at('oneWay')], true),
      },
      {
        icon: '🔒',
        label: e.conn.hidden ? 'Reveal (not hidden)' : 'Make hidden',
        hint: !e.conn.hidden && !canComb && !opener ? 'nothing could reveal it' : undefined,
        onclick: () =>
          e.conn.hidden
            ? store.del('spot', [...at('hidden')])
            : store.set('spot', [...at('hidden')], true),
      },
      {
        icon: '⚔️',
        label: e.conn.forced ? 'Unforce the arrival' : 'Force a fight on arrival',
        hint: !e.conn.forced && !(e.to.encounters ?? []).length ? `${e.to.name} has no encounters` : undefined,
        onclick: () =>
          e.conn.forced
            ? store.del('spot', [...at('forced')])
            : store.set('spot', [...at('forced')], true),
      },
      { icon: '⇄', label: 'Flip direction', onclick: () => flipEdge(e) },
      {
        icon: '📐',
        label: `Fit ticks to distance (${want})`,
        disabled: e.conn.ticks === want,
        onclick: () => store.set('spot', [...at('ticks')], want),
      },
      { separator: true },
      {
        icon: '🗑',
        label: 'Delete connection',
        danger: true,
        hint: 'Del',
        onclick: () => {
          store.del('spot', [e.from.id, 'connections', `#to=${e.to.id}`]);
          onselect(null);
        },
      },
    ];
  }

  /** Move a declared edge to the other spot, keeping everything about it. */
  function flipEdge(e: DrawnEdge): void {
    const conn: Connection = { ...$state.snapshot(e.conn), to: e.from.id };
    store.del('spot', [e.from.id, 'connections', `#to=${e.to.id}`]);
    store.set('spot', [e.to.id, 'connections', `#to=${e.from.id}`], conn);
    onselect({ type: 'edge', from: e.to.id, to: e.from.id });
    store.say(`${e.to.name} → ${e.from.name}`, 'ok');
  }

  function npcMenu(npc: NpcDef): MenuItem[] {
    return [
      { icon: '🧑', label: 'Edit NPC', onclick: () => onselect({ type: 'npc', id: npc.id }) },
      { icon: '📋', label: 'Copy id', hint: npc.id, onclick: () => copyId(npc.id) },
      { separator: true },
      {
        icon: '🗑',
        label: 'Delete NPC',
        danger: true,
        onclick: () => {
          if (!confirm(`Delete ${npc.name} (${npc.id})?`)) return;
          store.del('npc', [npc.id]);
          onselect(null);
          store.say(`Deleted ${npc.id}`, 'warn');
        },
      },
    ];
  }

  function canvasMenu(p: { x: number; y: number }): MenuItem[] {
    const onCanvas = p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 75;
    return [
      {
        icon: '➕',
        label: 'New spot here',
        hint: 'double-click',
        disabled: !onCanvas,
        onclick: () => addSpot(p.x, p.y),
      },
      { separator: true },
      { icon: '⤢', label: 'Fit the whole region', onclick: resetView },
      { icon: '🏷️', label: showLabels ? 'Hide names' : 'Show names', onclick: () => (showLabels = !showLabels) },
      { icon: '⏱️', label: showTicks ? 'Hide travel times' : 'Show travel times', onclick: () => (showTicks = !showTicks) },
    ];
  }

  function openMenu(ev: MouseEvent, title: string, items: MenuItem[]): void {
    ev.preventDefault();
    ev.stopPropagation();
    menu = { x: ev.clientX, y: ev.clientY, title, items };
  }

  function onCanvasDblClick(ev: MouseEvent): void {
    if (painting) return;
    const p = toData(ev);
    if (p.x < 0 || p.x > 100 || p.y < 0 || p.y > 75) return;
    addSpot(p.x, p.y);
  }

  function onWheel(ev: WheelEvent): void {
    ev.preventDefault();
    const p = toData(ev);
    const factor = ev.deltaY > 0 ? 1.12 : 1 / 1.12;
    const w = Math.min(320, Math.max(18, view.w * factor));
    const h = w * (view.h / view.w);
    // Zoom about the cursor so the point under it stays put.
    view = {
      w,
      h,
      x: p.x - ((p.x - view.x) * w) / view.w,
      y: p.y - ((p.y - view.y) * h) / view.h,
    };
  }

  /** The data-space point the pan grabbed; it stays under the cursor. */
  let panning = $state<{ x: number; y: number } | null>(null);

  function onCanvasPointerDown(ev: PointerEvent): void {
    if (painting && ev.button === 0 && beginStroke(ev)) return;
    // Middle button, or left button on empty canvas, pans.
    if (ev.button === 1 || (ev.button === 0 && ev.target === svgEl)) {
      const p = toData(ev);
      panning = { x: p.x, y: p.y };
      svgEl?.setPointerCapture(ev.pointerId);
      if (ev.button === 0 && ev.target === svgEl) onselect(null);
    }
  }

  function onCanvasPointerMove(ev: PointerEvent): void {
    if (tilesUi.on) hover = cellUnder(ev);
    if (stroke) {
      moveStroke(ev);
      return;
    }
    if (panning) {
      // Via the CTM, not the bounding rect: a viewBox with the default
      // preserveAspectRatio letterboxes, so rect-relative maths drifts by
      // however much empty space is at the edges.
      const p = toData(ev);
      view = { ...view, x: view.x + (panning.x - p.x), y: view.y + (panning.y - p.y) };
      return;
    }
    onPointerMove(ev);
  }

  function resetView(): void {
    view = { x: -4, y: -4, w: W + 8, h: H + 8 };
  }

  function onKey(ev: KeyboardEvent): void {
    const tag = (ev.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (tilesUi.on && region) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
        ev.preventDefault();
        if (ev.shiftKey) tilesUi.redo(region);
        else tilesUi.undo(region);
        return;
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') {
        ev.preventDefault();
        tilesUi.redo(region);
        return;
      }
      if (!ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        const tool = TOOLS.find((t) => t.key.toLowerCase() === ev.key.toLowerCase());
        if (tool && tileMap) {
          tilesUi.tool = tool.id;
          return;
        }
      }
    }
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      if (selection?.type === 'edge') {
        ev.preventDefault();
        store.del('spot', [selection.from, 'connections', `#to=${selection.to}`]);
        onselect(null);
        store.say('Connection removed', 'warn');
      }
    }
    if (ev.key === 'Escape') {
      // Back out one layer at a time: an in-flight link first, then the
      // selection — otherwise cancelling a mis-started link also loses your place.
      if (menu) menu = null;
      else if (linking) linking = null;
      else if (painting) tilesUi.tool = 'hand';
      else onselect(null);
    }
  }

  function edgeClass(e: DrawnEdge): string {
    const cls = ['edge'];
    if (e.conn.oneWay) cls.push('oneway');
    if (e.conn.hidden) cls.push('hidden');
    if (e.conn.forced || e.to.forced) cls.push('forced');
    if (selection?.type === 'edge' && selection.from === e.from.id && selection.to === e.to.id) {
      cls.push('selected');
    }
    return cls.join(' ');
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="map-wrap">
  <div class="toolbar">
    <div class="regions">
      {#each regions as r (r.id)}
        <button
          class="tiny"
          class:on={region === r.id}
          class:dragging={tabDrag !== null && tabDrag.id === r.id}
          class:drop-before={tabDrag !== null && tabDrag.over === r.id && tabDrag.before}
          class:drop-after={tabDrag !== null && tabDrag.over === r.id && !tabDrag.before}
          draggable="true"
          title="Drag to reorder — tab order is the order this region is written in the data file. Alt+← / Alt+→ moves it from the keyboard."
          onclick={() => (regionId = r.id)}
          ondragstart={() => (tabDrag = { id: r.id, over: null, before: false })}
          ondragover={(ev) => onTabOver(ev, r.id)}
          ondrop={onTabDrop}
          ondragend={() => (tabDrag = null)}
          onkeydown={(ev) => onTabKey(ev, r.id)}
        >
          {r.name}
        </button>
      {/each}
    </div>
    <div class="grow"></div>
    <button
      class="tiny tiles-toggle"
      class:on={tilesUi.on}
      onclick={toggleTiles}
      title="Tiles mode: paint this region's drawn map (docs/TILEMAPS.md). The side panel becomes the palette."
    >
      🧱 Tiles{tileMap ? '' : ' · none'}
    </button>
    <label class="toggle"><input type="checkbox" bind:checked={snap} /> {tileMap ? 'Snap tile' : 'Snap ½'}</label>
    <label class="toggle"><input type="checkbox" bind:checked={showLabels} /> Names</label>
    <label class="toggle"><input type="checkbox" bind:checked={showNpcs} /> NPCs</label>
    <label class="toggle"><input type="checkbox" bind:checked={showFinds} /> Finds</label>
    <label class="toggle"><input type="checkbox" bind:checked={showTicks} /> Ticks</label>
    <button class="tiny" onclick={resetView}>Fit</button>
  </div>

  <svg
    bind:this={svgEl}
    viewBox="{view.x} {view.y} {view.w} {view.h}"
    class="canvas"
    class:linking={!!linking}
    class:painting
    role="application"
    aria-label="World map editor"
    onpointerdown={onCanvasPointerDown}
    onpointermove={onCanvasPointerMove}
    onpointerleave={() => (hover = null)}
    onpointerup={() => {
      panning = null;
      endStroke();
      onPointerUp();
    }}
    onpointercancel={() => {
      panning = null;
      linking = null;
      dragging = null;
      stroke = null;
      strokeRect = null;
    }}
    ondblclick={onCanvasDblClick}
    oncontextmenu={(ev) => openMenu(ev, 'Map', canvasMenu(toData(ev)))}
    onwheel={onWheel}
  >
    <defs>
      <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
        <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#1a2130" stroke-width="0.15" />
      </pattern>
    </defs>

    <!-- The playable canvas: the linter rejects anything outside it. -->
    <rect x="0" y="0" width={W} height={H} fill="url(#grid)" stroke="#243049" stroke-width="0.2" />

    <!-- The drawn map, pinned to the same 100 × 75 the spots are placed in (as MapCard does). -->
    {#if tileMap}
      {#key region}
        <foreignObject x="0" y="0" width={W} height={H} class="tiles-fo">
          <div xmlns="http://www.w3.org/1999/xhtml" class="tiles-box">
            <canvas bind:this={tileCanvas} class="tiles-canvas"></canvas>
            {#if tilesUi.on}
              <canvas bind:this={overlayCanvas} class="tiles-canvas"></canvas>
            {/if}
          </div>
        </foreignObject>
      {/key}
    {/if}

    {#each edges.drawn as e (e.from.id + '>' + e.to.id)}
      {@const g = edgeGeom(e)}
      {@const drift = tickDrift(e)}
      <g class={edgeClass(e)}>
        <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} class="edge-line" />
        {#if e.conn.oneWay}
          <polygon points={arrow(e)} class="edge-arrow" />
        {/if}
        {#if e.conn.hidden}
          <text x={g.mx} y={g.my + 0.5} text-anchor="middle" class="edge-lock">🔒</text>
        {/if}
        {#if e.conn.forced}
          <text x={g.mx + (e.conn.hidden ? 2.4 : 0)} y={g.my + 0.5} text-anchor="middle" class="edge-lock">⚔️</text>
        {/if}
        {#if showTicks}
          <text x={g.mx} y={g.my - 1.2} text-anchor="middle" class="edge-ticks" class:drift={drift > 1.8 || drift < 0.55}>
            {e.conn.ticks}
          </text>
        {/if}
        {#if e.conn.label && showLabels}
          <text x={g.mx} y={g.my + 2.6} text-anchor="middle" class="edge-label">
            {e.conn.label}{e.conn.returnLabel ? ` ⇄ ${e.conn.returnLabel}` : ''}
          </text>
        {/if}
        <!-- Fat invisible line so a 0.5-unit stroke is still clickable. -->
        <line
          x1={g.x1}
          y1={g.y1}
          x2={g.x2}
          y2={g.y2}
          class="edge-hit"
          role="button"
          tabindex="-1"
          aria-label="Connection from {e.from.name} to {e.to.name}"
          onpointerdown={(ev) => {
            ev.stopPropagation();
            onselect({ type: 'edge', from: e.from.id, to: e.to.id });
          }}
          oncontextmenu={(ev) => {
            onselect({ type: 'edge', from: e.from.id, to: e.to.id });
            openMenu(ev, `${e.from.name} → ${e.to.name}`, edgeMenu(e));
          }}
        />
      </g>
    {/each}

    {#each edges.exits as x (x.from.id + '>' + x.to.id)}
      {@const p = pt(x.from)}
      <text x={p.x + R + 0.8} y={p.y - R} class="exit">→ {x.to.name}</text>
    {/each}

    {#if linking}
      {@const from = pt(spots[linking.from])}
      <line x1={from.x} y1={from.y} x2={linking.x} y2={linking.y} class="link-preview" />
    {/if}

    {#each inRegion as spot (spot.id)}
      {@const p = pt(spot)}
      {@const problems = spotIssues.get(spot.id) ?? []}
      {@const broken = problems.some((i) => i.severity === 'error')}
      {@const here = npcsBySpot.get(spot.id) ?? []}
      {@const findCount = (spot.finds ?? []).length}
      <g
        class="node"
        class:selected={selection?.type === 'spot' && selection.id === spot.id}
        class:target={linking?.over === spot.id}
        class:broken
        class:warned={!broken && problems.length > 0}
        role="button"
        tabindex="0"
        aria-label={spot.name}
        onpointerdown={(ev) => startDrag(ev, spot)}
        oncontextmenu={(ev) => {
          onselect({ type: 'spot', id: spot.id });
          openMenu(ev, `${spot.icon} ${spot.name}`, spotMenu(spot));
        }}
        onkeydown={(ev) => ev.key === 'Enter' && onselect({ type: 'spot', id: spot.id })}
      >
        <circle cx={p.x} cy={p.y} r={R} class="dot" />
        <text x={p.x} y={p.y + 1.4} text-anchor="middle" class="icon">{spot.icon || '📍'}</text>

        {#if spot.waypoint}
          <text x={p.x + R - 0.6} y={p.y - R + 1.4} class="badge wp">⚡</text>
        {/if}
        {#if spot.forced}
          <text x={p.x - R - 1.6} y={p.y + R + 0.6} class="badge menace">⚔️</text>
        {/if}
        {#if showFinds && findCount > 0}
          <g class="finds-badge">
            <circle cx={p.x + R - 0.4} cy={p.y + R - 0.4} r="1.5" class="badge-bg" />
            <text x={p.x + R - 0.4} y={p.y + R + 0.15} text-anchor="middle" class="badge-num">
              {findCount}
            </text>
          </g>
        {/if}
        {#if spot.exploreTicks}
          <circle cx={p.x} cy={p.y} r={R + 0.9} class="explore-ring" />
        {/if}
        {#if broken}
          <text x={p.x - R} y={p.y - R + 1} class="badge bad">⚠</text>
        {/if}

        {#if showLabels}
          <text x={p.x} y={p.y + R + 2.6} text-anchor="middle" class="label">{spot.name}</text>
        {/if}

        {#if showNpcs && here.length > 0}
          {#each here as npc, i (npc.id)}
            <g
              class="npc"
              class:selected={selection?.type === 'npc' && selection.id === npc.id}
              role="button"
              tabindex="-1"
              aria-label={npc.name}
              onpointerdown={(ev) => {
                ev.stopPropagation();
                onselect({ type: 'npc', id: npc.id });
              }}
              oncontextmenu={(ev) => {
                onselect({ type: 'npc', id: npc.id });
                openMenu(ev, `${npc.icon} ${npc.name}`, npcMenu(npc));
              }}
            >
              <circle cx={p.x - R - 0.6} cy={p.y - R + 0.4 + i * 3} r="1.35" class="npc-dot" />
              <text
                x={p.x - R - 0.6}
                y={p.y - R + 0.95 + i * 3}
                text-anchor="middle"
                class="npc-icon"
              >
                {npc.icon || '🧑'}
              </text>
            </g>
          {/each}
        {/if}
      </g>
    {/each}
  </svg>

  {#if linking?.mode === 'click'}
    <div class="linking-hint">
      🔗 Click where <b>{spots[linking.from]?.name}</b> should lead — <kbd>Esc</kbd> to cancel
    </div>
  {/if}

  {#if tilesUi.on}
    <div class="legend">
      {#if !tileMap}
        <span class="dim">This region draws the node diagram. Create a grid for it in the panel on the right.</span>
      {:else}
        <span class="dim">
          <b>{TOOLS.find((t) => t.id === tilesUi.tool)?.label ?? ''}</b>
          · layer <b>{tileMap.layers[tilesUi.layer]?.name ?? '—'}</b>
          {#if hover}· tile {hover.x},{hover.y}{/if}
        </span>
        <span class="grow"></span>
        <span class="dim">
          {#each TOOLS as t (t.id)}<kbd>{t.key}</kbd> {t.id} · {/each}<kbd>Ctrl+Z</kbd> undo · <kbd>Esc</kbd> back to the hand
        </span>
      {/if}
    </div>
  {:else}
  <div class="legend">
    <span class="k"><i class="ln"></i> two-way</span>
    <span class="k"><i class="ln one"></i> one-way</span>
    <span class="k"><i class="ln hid"></i> hidden</span>
    <span class="k"><i class="ln menaced"></i> forced fight</span>
    <span class="k"><i class="sw find"></i> finds</span>
    <span class="k"><i class="sw npc"></i> NPC</span>
    <span class="grow"></span>
    <span class="dim">
      drag to place · <b>shift-drag</b> a node to connect · double-click empty space for a new spot ·
      wheel to zoom · <b>right-click</b> anything for actions · <b>Del</b> removes a selected edge
    </span>
  </div>
  {/if}
</div>

{#if menu}
  <ContextMenu x={menu.x} y={menu.y} title={menu.title} items={menu.items} onclose={() => (menu = null)} />
{/if}

<style>
  .map-wrap {
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

  .regions {
    display: flex;
    gap: 4px;
  }

  .regions button {
    position: relative;
    cursor: grab;
  }

  .regions button.dragging {
    opacity: 0.45;
  }

  /* The line the tab will land on, drawn against the neighbour it lands beside. */
  .regions button.drop-before::before,
  .regions button.drop-after::after {
    content: '';
    position: absolute;
    top: -2px;
    bottom: -2px;
    width: 2px;
    background: var(--accent);
    border-radius: 1px;
  }

  .regions button.drop-before::before {
    left: -3px;
  }

  .regions button.drop-after::after {
    right: -3px;
  }

  .regions button.on {
    background: rgba(108, 158, 255, 0.18);
    border-color: var(--accent);
    color: var(--accent);
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

  .canvas {
    flex: 1;
    min-height: 0;
    width: 100%;
    background: #0a0d13;
    touch-action: none;
    cursor: grab;
    /* The map's primary gesture is a drag, and every node carries a <text>
       label — without this, dragging a spot rubber-band-selects the labels it
       passes and paints a blue box across the diagram. */
    user-select: none;
    -webkit-user-select: none;
  }

  /* Clicking a node focuses it (it is a button). Keyboard users still get a
     ring via :focus-visible; a mouse click should leave no box behind. */
  .canvas :global(:focus) {
    outline: none;
  }

  .canvas :global(:focus-visible) {
    outline: 1px solid var(--accent);
    outline-offset: 1px;
  }

  .canvas.linking {
    cursor: crosshair;
  }

  /* A paint tool in hand: the brush needs the whole picture, so spots, edges
     and NPCs stop catching the pointer until the Hand is picked again. */
  .canvas.painting {
    cursor: crosshair;
  }

  .canvas.painting .node,
  .canvas.painting .edge-hit,
  .canvas.painting .npc {
    pointer-events: none;
  }

  .tiles-fo {
    pointer-events: none;
  }

  .tiles-box {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .tiles-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
    display: block;
  }

  .tiles-toggle.on {
    background: rgba(108, 158, 255, 0.18);
    border-color: var(--accent);
    color: var(--accent);
  }

  .legend kbd {
    font-family: var(--mono);
    border: 1px solid var(--border-bright);
    border-radius: 3px;
    padding: 0 3px;
    font-size: 10px;
  }

  /* ---------- Edges ---------- */

  .edge-line {
    stroke: #46536e;
    stroke-width: 0.45;
    fill: none;
  }

  .edge-hit {
    stroke: transparent;
    stroke-width: 2.6;
    cursor: pointer;
  }

  .edge.oneway .edge-line {
    stroke: var(--oneway);
  }

  .edge-arrow {
    fill: var(--oneway);
  }

  .edge.hidden .edge-line {
    stroke-dasharray: 1.4 1;
    stroke: var(--hidden);
  }

  .edge.hidden .edge-arrow {
    fill: var(--hidden);
  }

  .edge.forced .edge-line {
    stroke: var(--bad);
  }

  .edge.forced .edge-arrow {
    fill: var(--bad);
  }

  .edge.selected .edge-line {
    stroke: var(--accent);
    stroke-width: 0.85;
  }

  .edge.selected .edge-arrow {
    fill: var(--accent);
  }

  .edge:hover .edge-line {
    stroke-width: 0.75;
  }

  .edge-lock {
    font-size: 1.8px;
  }

  .edge-ticks {
    font-size: 2.1px;
    fill: var(--dimmer);
  }

  .edge-ticks.drift {
    fill: var(--warn);
  }

  .edge-label {
    font-size: 2px;
    fill: var(--dim);
    font-style: italic;
  }

  .link-preview {
    stroke: var(--accent);
    stroke-width: 0.5;
    stroke-dasharray: 1 1;
  }

  .exit {
    font-size: 2.1px;
    fill: var(--dim);
    font-style: italic;
  }

  /* ---------- Nodes ---------- */

  .node {
    cursor: grab;
  }

  .node .dot {
    fill: #1a2233;
    stroke: #46536e;
    stroke-width: 0.35;
  }

  .node:hover .dot {
    stroke: var(--accent);
  }

  .node.selected .dot {
    stroke: var(--accent);
    stroke-width: 0.7;
    fill: #1e2b45;
  }

  .node.target .dot {
    stroke: var(--ok);
    stroke-width: 0.8;
  }

  .node.broken .dot {
    stroke: var(--bad);
  }

  .node.warned .dot {
    stroke: var(--warn);
  }

  .icon {
    font-size: 3.4px;
    pointer-events: none;
  }

  .label {
    font-size: 2.3px;
    fill: var(--dim);
    pointer-events: none;
  }

  .badge {
    font-size: 2.2px;
    pointer-events: none;
  }

  .badge.bad {
    fill: var(--bad);
    font-size: 2.8px;
  }

  .explore-ring {
    fill: none;
    stroke: #7de0c3;
    stroke-width: 0.2;
    stroke-dasharray: 0.8 0.8;
    opacity: 0.7;
    pointer-events: none;
  }

  .badge-bg {
    fill: var(--find);
  }

  .badge-num {
    font-size: 1.9px;
    fill: #221a00;
    font-weight: 700;
    pointer-events: none;
  }

  .npc {
    cursor: pointer;
  }

  .npc-dot {
    fill: #0d1620;
    stroke: var(--npc);
    stroke-width: 0.25;
  }

  .npc.selected .npc-dot {
    stroke-width: 0.6;
  }

  .npc-icon {
    font-size: 1.7px;
    pointer-events: none;
  }

  /* ---------- Legend ---------- */

  .linking-hint {
    padding: 5px 10px;
    background: rgba(108, 158, 255, 0.12);
    border-top: 1px solid var(--accent);
    font-size: 11.5px;
    color: var(--accent);
    flex-shrink: 0;
  }

  .linking-hint kbd {
    font-family: var(--mono);
    border: 1px solid var(--border-bright);
    border-radius: 3px;
    padding: 0 3px;
  }

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

  .ln.one {
    border-color: var(--oneway);
  }

  .ln.hid {
    border-top-style: dashed;
    border-color: var(--hidden);
  }

  .ln.menaced {
    border-color: var(--bad);
  }

  .sw {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .sw.find {
    background: var(--find);
  }

  .sw.npc {
    background: transparent;
    border: 1.5px solid var(--npc);
  }
</style>
