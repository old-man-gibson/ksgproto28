<script lang="ts">
  /**
   * The right-hand column while Tiles mode is on: the tool in hand, the
   * stamp it carries, the map's layers, and the palette to load it from.
   * Replaces the spot inspector for as long as the mode is on; the spot layer
   * stays live on the map underneath (the Hand tool still drags spots).
   */
  import { untrack } from 'svelte';
  import { store } from '../lib/store.svelte';
  import { TOOLS, tilesUi } from '../lib/tiles.svelte';
  import { emptyMap } from '../lib/tilemap';
  import TileLayers from './TileLayers.svelte';
  import TilePalette from './TilePalette.svelte';

  const region = $derived(tilesUi.region);
  const regionName = $derived(region ? (store.get<{ name: string }>('region', region)?.name ?? region) : '');
  const map = $derived(region ? (store.maps[region] ?? null) : null);

  let newW = $state(32);
  let newH = $state(24);
  let preview = $state<HTMLCanvasElement | null>(null);

  function create(): void {
    if (!region) return;
    const w = Math.round(newW);
    const h = Math.round(newH);
    if (!(w >= 4 && h >= 3 && w <= 256 && h <= 192)) {
      store.say('Size must be between 4×3 and 256×192 tiles', 'warn');
      return;
    }
    store.setTileMap(region, emptyMap(w, h));
    tilesUi.forget(region);
    tilesUi.layer = 0;
    tilesUi.changed();
    store.say(`${regionName} is drawn from tiles now — pick a sheet and paint`, 'ok');
  }

  // The stamp, drawn at native size so you can see what the brush holds.
  $effect(() => {
    const canvas = preview;
    const stamp = tilesUi.stamp;
    void tilesUi.loaded;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const T = 32;
    if (!stamp) {
      canvas.width = T;
      canvas.height = T;
      ctx.clearRect(0, 0, T, T);
      return;
    }
    canvas.width = stamp.w * T;
    canvas.height = stamp.h * T;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    untrack(() => {
      for (const layer of stamp.layers) {
        for (let y = 0; y < stamp.h; y++) {
          for (let x = 0; x < stamp.w; x++) {
            const cell = layer.cells[y]?.[x];
            if (!cell) continue;
            const img = tilesUi.imageNow(cell.key);
            if (!img) continue;
            ctx.drawImage(img, (cell.local % cell.columns) * T, Math.floor(cell.local / cell.columns) * T, T, T, x * T, y * T, T, T);
          }
        }
      }
    });
  });

  const stampNote = $derived.by(() => {
    const s = tilesUi.stamp;
    if (!s) return 'no stamp — pick from the palette or the map';
    const named = s.layers.filter((l) => l.name !== null).map((l) => l.name);
    return `${s.w}×${s.h}${named.length ? ` → ${named.join(', ')}` : ''}`;
  });
</script>

<div class="pad">
  {#if !region}
    <div class="empty">No region on the map.</div>
  {:else}
    <div class="head">
      <b>🧱 {regionName}</b>
      <span class="dim">{map ? `${map.width}×${map.height} tiles` : 'node diagram'}</span>
    </div>

    {#if !map}
      <div class="card create">
        <div>This region has no drawn map. The game shows its node diagram; give it a grid to paint on.</div>
        <div class="row">
          <input type="number" min="4" max="256" bind:value={newW} aria-label="Width in tiles" />
          <span class="dim">×</span>
          <input type="number" min="3" max="192" bind:value={newH} aria-label="Height in tiles" />
          <button class="primary" onclick={create}>Create</button>
        </div>
        <div class="dim small">
          32 px tiles. Floor 0 is 32×24 — the same 4:3 as the 0–100 × 0–75 space spots are placed in, so a
          spot at (50, 37.5) lands on the centre tile.
        </div>
      </div>
    {:else}
      <div class="section">Tool</div>
      <div class="tools">
        {#each TOOLS as t (t.id)}
          <button class="tool" class:on={tilesUi.tool === t.id} title="{t.label} ({t.key})" onclick={() => (tilesUi.tool = t.id)}>
            {t.icon}
          </button>
        {/each}
        <span class="grow"></span>
        <button class="tiny" onclick={() => tilesUi.undo(region)} disabled={!tilesUi.canUndo} title="Undo (Ctrl+Z)">↶</button>
        <button class="tiny" onclick={() => tilesUi.redo(region)} disabled={!tilesUi.canRedo} title="Redo (Ctrl+Y)">↷</button>
      </div>
      <div class="row opts">
        <label class="toggle" title="Rectangle fills scatter the stamp's tiles at random instead of repeating it">
          <input type="checkbox" bind:checked={tilesUi.random} /> Random fill
        </label>
        <label class="toggle"><input type="checkbox" bind:checked={tilesUi.grid} /> Grid</label>
      </div>

      <div class="section">Stamp</div>
      <div class="stamp">
        <canvas bind:this={preview} class="stamp-canvas"></canvas>
        <div class="dim small">{stampNote}</div>
        {#if tilesUi.stamp}
          <button class="ghost tiny" onclick={() => (tilesUi.stamp = null)}>clear</button>
        {/if}
      </div>

      <TileLayers {region} />
    {/if}

    <div class="gap"></div>
    <TilePalette />
  {/if}
</div>

<style>
  .pad {
    padding: 12px 14px 40px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .head {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .create {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
  }

  .create input {
    width: 64px;
  }

  .tools {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .tool {
    padding: 4px 8px;
    font-size: 15px;
  }

  .tool.on {
    background: rgba(108, 158, 255, 0.18);
    border-color: var(--accent);
  }

  .opts {
    gap: 12px;
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

  .stamp {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .stamp-canvas {
    max-width: 128px;
    max-height: 96px;
    min-width: 32px;
    min-height: 32px;
    image-rendering: pixelated;
    background:
      repeating-conic-gradient(#1a2130 0 25%, #0f1219 0 50%) 0 0 / 16px 16px;
    border: 1px solid var(--border);
    border-radius: 4px;
  }

  .small {
    font-size: 11px;
  }

  .gap {
    height: 6px;
    border-top: 1px solid var(--border);
    margin-top: 6px;
  }
</style>
