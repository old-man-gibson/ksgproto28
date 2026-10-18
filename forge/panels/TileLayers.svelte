<script lang="ts">
  /**
   * The drawn map's layers, top to bottom as they paint, plus the grid's
   * size. Every structural edit here snapshots first, so it undoes like a
   * brush stroke, and stages the map whole like everything in Tiles mode.
   */
  import { store } from '../lib/store.svelte';
  import { tilesUi } from '../lib/tiles.svelte';
  import { emptyLayer, isLayerEmpty, resizeMap } from '../lib/tilemap';

  let { region }: { region: string } = $props();

  const map = $derived(store.maps[region] ?? null);

  let width = $state(0);
  let height = $state(0);
  let anchor = $state<'nw' | 'c'>('nw');

  $effect(() => {
    if (map) {
      width = map.width;
      height = map.height;
    }
  });

  function commit(): void {
    store.touchTileMap(region);
    tilesUi.changed();
  }

  function toggleHidden(name: string): void {
    tilesUi.hidden = tilesUi.hidden.includes(name) ? tilesUi.hidden.filter((n) => n !== name) : [...tilesUi.hidden, name];
  }

  function addLayer(): void {
    if (!map) return;
    let n = map.layers.length + 1;
    while (map.layers.some((l) => l.name === `layer ${n}`)) n++;
    const name = prompt('Layer name', `layer ${n}`)?.trim();
    if (!name) return;
    if (map.layers.some((l) => l.name === name)) {
      store.say(`There is already a layer named '${name}'`, 'warn');
      return;
    }
    tilesUi.snapshot(region);
    map.layers.push(emptyLayer(name, map.width, map.height));
    tilesUi.layer = map.layers.length - 1;
    commit();
  }

  function rename(i: number): void {
    if (!map) return;
    const name = prompt('Layer name', map.layers[i].name)?.trim();
    if (!name || name === map.layers[i].name) return;
    if (map.layers.some((l, j) => j !== i && l.name === name)) {
      store.say(`There is already a layer named '${name}'`, 'warn');
      return;
    }
    tilesUi.snapshot(region);
    map.layers[i].name = name;
    commit();
  }

  function remove(i: number): void {
    if (!map) return;
    const layer = map.layers[i];
    if (map.layers.length === 1) {
      store.say('A map keeps at least one layer — delete the drawn map instead', 'warn');
      return;
    }
    if (!isLayerEmpty(layer) && !confirm(`Delete layer '${layer.name}' and everything painted on it?`)) return;
    tilesUi.snapshot(region);
    map.layers.splice(i, 1);
    tilesUi.clampLayer(map);
    commit();
  }

  /** Swap with the neighbour above (`+1`, paints later) or below (`-1`). */
  function shift(i: number, dir: 1 | -1): void {
    if (!map) return;
    const j = i + dir;
    if (j < 0 || j >= map.layers.length) return;
    tilesUi.snapshot(region);
    [map.layers[i], map.layers[j]] = [map.layers[j], map.layers[i]];
    if (tilesUi.layer === i) tilesUi.layer = j;
    else if (tilesUi.layer === j) tilesUi.layer = i;
    commit();
  }

  function resize(): void {
    if (!map) return;
    const w = Math.round(width);
    const h = Math.round(height);
    if (!(w >= 4 && h >= 3 && w <= 256 && h <= 192)) {
      store.say('Size must be between 4×3 and 256×192 tiles', 'warn');
      return;
    }
    if (w === map.width && h === map.height) return;
    tilesUi.snapshot(region);
    resizeMap(map, w, h, anchor);
    commit();
    store.say(`Map is now ${w}×${h} — spots keep their 0–100 × 0–75 places, so they may sit on different tiles`, 'ok');
  }

  function dropMap(): void {
    if (!map) return;
    if (!confirm(`Delete the drawn map for ${region}? The region goes back to the node diagram. Spot positions are untouched.`)) return;
    store.dropTileMap(region);
    tilesUi.forget(region);
    tilesUi.changed();
    store.say(`Dropped the drawn map for ${region}`, 'warn');
  }
</script>

{#if map}
  <div class="layers">
    <div class="section row">
      Layers
      <span class="grow"></span>
      <button class="tiny" onclick={addLayer} title="Add an empty layer on top">＋ layer</button>
    </div>
    {#each [...map.layers.keys()].reverse() as i (i)}
      {@const layer = map.layers[i]}
      {@const hidden = tilesUi.hidden.includes(layer.name)}
      <div class="layer" class:active={tilesUi.layer === i} class:hidden>
        <button class="ghost eye" title={hidden ? 'Show layer' : 'Hide layer (editing aid, never written)'} onclick={() => toggleHidden(layer.name)}>
          {hidden ? '◌' : '👁'}
        </button>
        <button class="ghost name" onclick={() => (tilesUi.layer = i)} ondblclick={() => rename(i)} title="Click to paint here · double-click to rename">
          {layer.name}
          {#if isLayerEmpty(layer)}<span class="dim"> · empty</span>{/if}
        </button>
        <button class="ghost tiny" onclick={() => shift(i, 1)} disabled={i === map.layers.length - 1} title="Paint later (move up)">▲</button>
        <button class="ghost tiny" onclick={() => shift(i, -1)} disabled={i === 0} title="Paint earlier (move down)">▼</button>
        <button class="ghost tiny danger" onclick={() => remove(i)} title="Delete layer">✕</button>
      </div>
    {/each}

    <div class="section">Size</div>
    <div class="row size">
      <input type="number" min="4" max="256" bind:value={width} aria-label="Width in tiles" />
      <span class="dim">×</span>
      <input type="number" min="3" max="192" bind:value={height} aria-label="Height in tiles" />
      <select bind:value={anchor} aria-label="Anchor">
        <option value="nw">keep top-left</option>
        <option value="c">keep centre</option>
      </select>
      <button class="tiny" onclick={resize} disabled={width === map.width && height === map.height}>Resize</button>
    </div>
    <div class="dim note">
      {map.tile} px tiles · {map.tilesets.length} sheet{map.tilesets.length === 1 ? '' : 's'} in use · spots land on tile
      <code>(x/100·{map.width}, y/75·{map.height})</code>
    </div>

    <div class="row" style="margin-top: 10px">
      <span class="grow"></span>
      <button class="tiny danger" onclick={dropMap}>Delete drawn map</button>
    </div>
  </div>
{/if}

<style>
  .layers {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .layer {
    display: flex;
    align-items: center;
    gap: 2px;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 1px 4px;
    background: var(--bg2);
  }

  .layer.active {
    border-color: var(--accent);
    background: rgba(108, 158, 255, 0.12);
  }

  .layer.hidden .name {
    opacity: 0.5;
    text-decoration: line-through;
  }

  .layer .name {
    flex: 1;
    text-align: left;
    padding: 4px 6px;
    font-size: 12.5px;
  }

  .layer .eye {
    padding: 2px 5px;
  }

  .layer .tiny {
    padding: 1px 5px;
  }

  .size input {
    width: 64px;
  }

  .size select {
    width: auto;
  }

  .note {
    font-size: 11px;
  }
</style>
