<script lang="ts">
  /**
   * Where the brush is loaded: the packs under src/assets/tilemaps, sheet by
   * sheet, and each pack's own example maps. Drag a rectangle on a sheet for
   * a stamp of those tiles; drag one on an example map for a stamp of every
   * checked layer at once, each landing on a layer of the same name (the
   * crop that built floor 0, live).
   *
   * Pixels come straight off the dev server — the forge never needs the
   * game's sheet glob, which only lists what shipped maps draw.
   */
  import { untrack } from 'svelte';
  import { api, type ExampleInfo, type PackInfo, type SheetInfo, type TmxMap } from '../lib/api';
  import { store } from '../lib/store.svelte';
  import { tilesUi } from '../lib/tiles.svelte';
  import { spanRect, stampFromSheet, stampFromTmx, tmxToMap } from '../lib/tilemap';
  import { drawTileMap } from '../../src/ui/lib/tilemaps/draw';
  import type { TileRect } from '../../src/ui/lib/tilemaps/types';

  let packKey = $state('');
  let tab = $state<'sheets' | 'examples'>('sheets');
  let sheetPath = $state('');
  let examplePath = $state('');
  let zoom = $state(1);
  let exampleZoom = $state(0.5);
  let filter = $state('');

  let tmx = $state<TmxMap | null>(null);
  let tmxError = $state<string | null>(null);
  let tmxLoading = $state(false);
  let includedLayers = $state<string[]>([]);
  let exampleCanvas = $state<HTMLCanvasElement | null>(null);
  let exampleReady = $state(false);

  let sel = $state<TileRect | null>(null);
  let selecting: { x: number; y: number } | null = null;

  const packs = $derived(tilesUi.packs ?? []);
  const pack = $derived(packs.find((p) => p.key === packKey) ?? null);
  const sheets = $derived.by(() => {
    const q = filter.trim().toLowerCase();
    const all = pack?.sheets ?? [];
    return q ? all.filter((s) => s.path.toLowerCase().includes(q)) : all;
  });
  const sheet = $derived<SheetInfo | null>(pack?.sheets.find((s) => s.path === sheetPath) ?? null);
  const example = $derived<ExampleInfo | null>(pack?.examples.find((e) => e.path === examplePath) ?? null);

  $effect(() => {
    void tilesUi.loadPacks();
  });

  // First pack: whichever the current map already draws from, else the first.
  $effect(() => {
    if (!packs.length || packs.some((p) => p.key === packKey)) return;
    const map = tilesUi.region ? store.maps[tilesUi.region] : null;
    const used = map?.tilesets[0]?.key.split('/')[0];
    packKey = packs.find((p) => p.key === used)?.key ?? packs[0].key;
  });

  $effect(() => {
    const p = pack;
    untrack(() => {
      if (p && !p.sheets.some((s) => s.path === sheetPath)) sheetPath = p.sheets[0]?.path ?? '';
      if (p && !p.examples.some((e) => e.path === examplePath)) examplePath = p.examples[0]?.path ?? '';
      sel = null;
    });
  });

  // Load and paint the chosen example map.
  $effect(() => {
    const p = pack;
    const ex = example;
    tmx = null;
    tmxError = null;
    exampleReady = false;
    sel = null;
    if (!p || !ex || tab !== 'examples') return;
    let live = true;
    tmxLoading = true;
    api.tiles
      .tmx(p.dir, ex.path)
      .then(({ map }) => {
        if (!live) return;
        tmx = map;
        includedLayers = map.layers.map((l) => l.name);
      })
      .catch((err) => {
        if (live) tmxError = err instanceof Error ? err.message : String(err);
      })
      .finally(() => {
        if (live) tmxLoading = false;
      });
    return () => {
      live = false;
    };
  });

  $effect(() => {
    const canvas = exampleCanvas;
    const map = tmx;
    const hidden = new Set((map?.layers ?? []).map((l) => l.name).filter((n) => !includedLayers.includes(n)));
    if (!canvas || !map) return;
    let live = true;
    untrack(() => drawTileMap(canvas, tmxToMap(map), { resolve: tilesUi.resolveImage, hidden })).then((ok) => {
      if (live) exampleReady = ok;
    });
    return () => {
      live = false;
    };
  });

  // ---------- Rubber-band selection, shared by sheet and example ----------

  function cellOf(ev: PointerEvent, el: Element, px: number, cols: number, rows: number): { x: number; y: number } {
    const r = el.getBoundingClientRect();
    return {
      x: Math.min(cols - 1, Math.max(0, Math.floor((ev.clientX - r.left) / px))),
      y: Math.min(rows - 1, Math.max(0, Math.floor((ev.clientY - r.top) / px))),
    };
  }

  function down(ev: PointerEvent, px: number, cols: number, rows: number): void {
    if (ev.button !== 0) return;
    const el = ev.currentTarget as Element;
    el.setPointerCapture(ev.pointerId);
    selecting = cellOf(ev, el, px, cols, rows);
    sel = spanRect(selecting, selecting);
  }

  function move(ev: PointerEvent, px: number, cols: number, rows: number): void {
    if (!selecting) return;
    sel = spanRect(selecting, cellOf(ev, ev.currentTarget as Element, px, cols, rows));
  }

  function upSheet(): void {
    if (!selecting || !sel || !sheet) return;
    selecting = null;
    tilesUi.stamp = stampFromSheet(sheet, sel.x, sel.y, sel.w, sel.h);
    if (tilesUi.tool === 'hand' || tilesUi.tool === 'pick') tilesUi.tool = 'brush';
    store.say(`Stamp: ${sel.w}×${sel.h} from ${sheet.name}`, 'ok');
  }

  function upExample(): void {
    if (!selecting || !sel || !tmx) return;
    selecting = null;
    const stamp = stampFromTmx(tmx, sel, includedLayers);
    if (!stamp.layers.length) {
      store.say('Nothing on the checked layers there', 'warn');
      return;
    }
    tilesUi.stamp = stamp;
    if (tilesUi.tool === 'hand' || tilesUi.tool === 'pick') tilesUi.tool = 'brush';
    store.say(`Stamp: ${sel.w}×${sel.h}, ${stamp.layers.length} layer(s) — ${stamp.layers.map((l) => l.name).join(', ')}`, 'ok');
  }

  const sheetCols = $derived(sheet?.columns ?? 1);
  const sheetRows = $derived(sheet ? Math.ceil(sheet.tilecount / sheet.columns) : 1);
  const sheetPx = $derived(32 * zoom);
  const examplePx = $derived(32 * exampleZoom);

  function toggleLayer(name: string): void {
    includedLayers = includedLayers.includes(name) ? includedLayers.filter((n) => n !== name) : [...includedLayers, name];
  }

  function packLabel(p: PackInfo): string {
    return `${p.key} — ${p.sheets.length} sheet${p.sheets.length === 1 ? '' : 's'}`;
  }
</script>

<div class="palette">
  <div class="section">Palette</div>

  {#if tilesUi.packs === null}
    <div class="empty small">Reading the packs…</div>
  {:else if tilesUi.packsError}
    <div class="empty small" style="color: var(--bad)">{tilesUi.packsError}</div>
  {:else if !packs.length}
    <div class="empty small">
      No tile packs under <code>src/assets/tilemaps/</code>. The folders are not in version control
      (AUTHORSHIP §9) — copy them in and reload.
    </div>
  {:else}
    <div class="row">
      <select bind:value={packKey} title="Pack folder; the key is the folder name without its version">
        {#each packs as p (p.key)}
          <option value={p.key}>{packLabel(p)}</option>
        {/each}
      </select>
    </div>
    {#if pack}
      <div class="dim tiny-note" title={pack.dir}>{pack.dir}</div>
      <div class="tabs">
        <button class="tiny" class:on={tab === 'sheets'} onclick={() => (tab = 'sheets')}>Sheets ({pack.sheets.length})</button>
        <button class="tiny" class:on={tab === 'examples'} onclick={() => (tab = 'examples')} disabled={!pack.examples.length}>
          Example maps ({pack.examples.length})
        </button>
      </div>

      {#if tab === 'sheets'}
        <div class="row">
          <input placeholder="filter sheets…" bind:value={filter} />
          <select bind:value={sheetPath}>
            {#each sheets as s (s.path)}
              <option value={s.path}>{s.path}</option>
            {/each}
          </select>
        </div>
        {#if sheet}
          <div class="row meta">
            <span class="dim">{sheet.columns} × {sheetRows} tiles{sheet.tiled ? '' : ' · no .tsx — geometry from the PNG'}</span>
            <span class="grow"></span>
            {#each [1, 2, 3] as z (z)}
              <button class="tiny" class:on={zoom === z} onclick={() => (zoom = z)}>{z}×</button>
            {/each}
          </div>
          <div class="view scroll">
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="pickbox"
              style="width: {sheetCols * sheetPx}px; height: {sheetRows * sheetPx}px"
              onpointerdown={(ev) => down(ev, sheetPx, sheetCols, sheetRows)}
              onpointermove={(ev) => move(ev, sheetPx, sheetCols, sheetRows)}
              onpointerup={upSheet}
              onpointercancel={() => (selecting = null)}
            >
              <img src={sheet.url} alt={sheet.name} draggable="false" style="width: {sheetCols * sheetPx}px" />
              {#if sel}
                <div class="sel" style="left: {sel.x * sheetPx}px; top: {sel.y * sheetPx}px; width: {sel.w * sheetPx}px; height: {sel.h * sheetPx}px"></div>
              {/if}
            </div>
          </div>
        {/if}
        {#if pack.collections.length}
          <div class="dim tiny-note">
            {pack.collections.length} sprite collection(s) not shown — odd-sized props; every one is also on an atlas sheet above.
          </div>
        {/if}
      {:else}
        <div class="row">
          <select bind:value={examplePath}>
            {#each pack.examples as e (e.path)}
              <option value={e.path}>{e.name} ({e.width}×{e.height})</option>
            {/each}
          </select>
        </div>
        {#if tmxLoading}
          <div class="empty small">Reading the map…</div>
        {:else if tmxError}
          <div class="empty small" style="color: var(--bad)">{tmxError}</div>
        {:else if tmx}
          <div class="layers">
            {#each tmx.layers as l (l.name)}
              <label class="toggle">
                <input type="checkbox" checked={includedLayers.includes(l.name)} onchange={() => toggleLayer(l.name)} />
                {l.name}
              </label>
            {/each}
          </div>
          <div class="row meta">
            <span class="dim">drag a rectangle — every checked layer comes along</span>
            <span class="grow"></span>
            {#each [0.25, 0.5, 1] as z (z)}
              <button class="tiny" class:on={exampleZoom === z} onclick={() => (exampleZoom = z)}>{z}×</button>
            {/each}
          </div>
          <div class="view scroll">
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="pickbox"
              style="width: {tmx.width * examplePx}px; height: {tmx.height * examplePx}px"
              onpointerdown={(ev) => down(ev, examplePx, tmx!.width, tmx!.height)}
              onpointermove={(ev) => move(ev, examplePx, tmx!.width, tmx!.height)}
              onpointerup={upExample}
              onpointercancel={() => (selecting = null)}
            >
              <canvas bind:this={exampleCanvas} style="width: {tmx.width * examplePx}px; height: {tmx.height * examplePx}px"></canvas>
              {#if !exampleReady}
                <div class="dim tiny-note overlay-note">painting…</div>
              {/if}
              {#if sel}
                <div class="sel" style="left: {sel.x * examplePx}px; top: {sel.y * examplePx}px; width: {sel.w * examplePx}px; height: {sel.h * examplePx}px"></div>
              {/if}
            </div>
          </div>
        {/if}
      {/if}
    {/if}
  {/if}
</div>

<style>
  .palette {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tabs {
    display: flex;
    gap: 4px;
  }

  .tiny-note {
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .meta {
    font-size: 11px;
  }

  button.on {
    background: rgba(108, 158, 255, 0.18);
    border-color: var(--accent);
    color: var(--accent);
  }

  .view {
    max-height: 340px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: #0a0d13;
    overflow: auto;
  }

  .pickbox {
    position: relative;
    cursor: crosshair;
    user-select: none;
    touch-action: none;
  }

  .pickbox img,
  .pickbox canvas {
    display: block;
    image-rendering: pixelated;
    pointer-events: none;
  }

  .sel {
    position: absolute;
    border: 2px solid var(--accent);
    background: rgba(108, 158, 255, 0.18);
    pointer-events: none;
    box-sizing: border-box;
  }

  .overlay-note {
    position: absolute;
    left: 6px;
    top: 4px;
  }

  .layers {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
  }

  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11.5px;
    color: var(--dim);
    cursor: pointer;
  }

  .toggle input {
    width: auto;
  }

  .empty.small {
    padding: 10px;
    font-size: 12px;
  }
</style>
