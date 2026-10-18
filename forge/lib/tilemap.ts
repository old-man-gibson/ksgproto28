/**
 * Pure edits on a TileMapDef — what the Tiles mode does to the grid between
 * a pointer-down and a pointer-up. Every function mutates the map it is
 * given (the store's working copy) and nothing here touches disk or the
 * DOM; the store stages the result whole when a stroke ends.
 *
 * Cells travel as `StampCell`s — sheet key + local index + flip flags —
 * never as gids, because a gid only means something inside one map's
 * tileset table. `gidOf` grows that table on demand and `compact` prunes
 * it, so a map lists exactly the sheets it draws from.
 */
import { GID_MASK, type TileLayer, type TileMapDef, type TileRect, type TileSetRef } from '../../src/ui/lib/tilemaps/types';

export interface StampCell {
  key: string;
  columns: number;
  tilecount: number;
  local: number;
  flags: number;
}

export interface StampLayer {
  /** Target layer by name; null means "the active layer". */
  name: string | null;
  /** `h` rows of `w` cells; null cells are transparent and never erase. */
  cells: (StampCell | null)[][];
}

/** What the brush carries: one or more layers of cells, w × h tiles. */
export interface Stamp {
  w: number;
  h: number;
  layers: StampLayer[];
}

export const FLAG_MASK = ~GID_MASK;

export function emptyMap(width: number, height: number, tile = 32): TileMapDef {
  return { width, height, tile, tilesets: [], layers: [emptyLayer('ground', width, height)] };
}

export function emptyLayer(name: string, width: number, height: number): TileLayer {
  return { name, data: Array.from({ length: height }, () => Array<number>(width).fill(0)) };
}

/** The gid a cell takes in this map, adding its sheet to the table if new. */
export function gidOf(map: TileMapDef, cell: StampCell): number {
  let set = map.tilesets.find((t) => t.key === cell.key);
  if (!set) {
    const next = map.tilesets.reduce((n, t) => Math.max(n, t.firstgid + t.tilecount), 1);
    set = { key: cell.key, columns: cell.columns, firstgid: next, tilecount: cell.tilecount };
    map.tilesets.push(set);
  }
  return (set.firstgid + cell.local) | cell.flags;
}

/** The cell a gid of this map stands for; null for empty or unknown. */
export function cellOf(map: TileMapDef, raw: number): StampCell | null {
  const gid = raw & GID_MASK;
  if (!gid) return null;
  const set = setFor(map.tilesets, gid);
  if (!set) return null;
  return { key: set.key, columns: set.columns, tilecount: set.tilecount, local: gid - set.firstgid, flags: raw & FLAG_MASK };
}

function setFor(tilesets: TileSetRef[], gid: number): TileSetRef | null {
  let best: TileSetRef | null = null;
  for (const t of tilesets) if (gid >= t.firstgid && (!best || t.firstgid > best.firstgid)) best = t;
  if (best && gid - best.firstgid >= best.tilecount) return null;
  return best;
}

/** Index of the named layer, appending an empty one on top when `create`. */
export function layerIndex(map: TileMapDef, name: string, create = true): number {
  const i = map.layers.findIndex((l) => l.name === name);
  if (i >= 0 || !create) return i;
  map.layers.push(emptyLayer(name, map.width, map.height));
  return map.layers.length - 1;
}

const inside = (map: TileMapDef, x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height;

/**
 * Put a stamp down with its top-left at (x, y). Named layers go where they
 * say (created if missing); unnamed ones go to `active`. Returns whether any
 * cell changed.
 */
export function paintStamp(map: TileMapDef, stamp: Stamp, x: number, y: number, active: number): boolean {
  let changed = false;
  for (const sl of stamp.layers) {
    const li = sl.name === null ? active : layerIndex(map, sl.name);
    const layer = map.layers[li];
    if (!layer) continue;
    for (let dy = 0; dy < stamp.h; dy++) {
      for (let dx = 0; dx < stamp.w; dx++) {
        const cell = sl.cells[dy]?.[dx];
        if (!cell || !inside(map, x + dx, y + dy)) continue;
        const gid = gidOf(map, cell);
        if (layer.data[y + dy][x + dx] !== gid) {
          layer.data[y + dy][x + dx] = gid;
          changed = true;
        }
      }
    }
  }
  return changed;
}

/** Small seeded PRNG so a scatter is the same picture on every run. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fill a rectangle with the stamp. `tile` mode repeats it on its own period
 * from the rect's corner (Tiled's rectangle fill); `random` mode scatters the
 * stamp's first layer's cells one per tile, seeded so the result is stable.
 */
export function fillRect(
  map: TileMapDef,
  rect: TileRect,
  stamp: Stamp,
  active: number,
  mode: 'tile' | 'random' = 'tile',
  seed = 1,
): boolean {
  let changed = false;
  if (mode === 'random') {
    const pool = stamp.layers[0]?.cells.flat().filter((c): c is StampCell => !!c) ?? [];
    if (!pool.length) return false;
    const li = stamp.layers[0].name === null ? active : layerIndex(map, stamp.layers[0].name);
    const layer = map.layers[li];
    if (!layer) return false;
    const rnd = prng(seed);
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        if (!inside(map, x, y)) continue;
        const gid = gidOf(map, pool[Math.floor(rnd() * pool.length)]);
        if (layer.data[y][x] !== gid) {
          layer.data[y][x] = gid;
          changed = true;
        }
      }
    }
    return changed;
  }
  for (const sl of stamp.layers) {
    const li = sl.name === null ? active : layerIndex(map, sl.name);
    const layer = map.layers[li];
    if (!layer) continue;
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        if (!inside(map, x, y)) continue;
        const cell = sl.cells[(y - rect.y) % stamp.h]?.[(x - rect.x) % stamp.w];
        if (!cell) continue;
        const gid = gidOf(map, cell);
        if (layer.data[y][x] !== gid) {
          layer.data[y][x] = gid;
          changed = true;
        }
      }
    }
  }
  return changed;
}

export function eraseRect(map: TileMapDef, layer: number, rect: TileRect): boolean {
  const l = map.layers[layer];
  if (!l) return false;
  let changed = false;
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (!inside(map, x, y) || l.data[y][x] === 0) continue;
      l.data[y][x] = 0;
      changed = true;
    }
  }
  return changed;
}

/**
 * The 1×1 stamp under a cell: the active layer's tile when `layer` is given,
 * otherwise the topmost non-empty one (which also says which layer it came
 * from, so the picker can switch to it).
 */
export function pickAt(map: TileMapDef, x: number, y: number, layer: number | null): { stamp: Stamp; layer: number } | null {
  if (!inside(map, x, y)) return null;
  const order = layer === null ? map.layers.map((_, i) => i).reverse() : [layer];
  for (const li of order) {
    const cell = cellOf(map, map.layers[li]?.data[y]?.[x] ?? 0);
    if (cell) return { stamp: { w: 1, h: 1, layers: [{ name: null, cells: [[cell]] }] }, layer: li };
  }
  return null;
}

/** Drop sheets no layer uses and renumber the rest, remapping every gid. */
export function compact(map: TileMapDef): void {
  const used = new Set<string>();
  for (const layer of map.layers) {
    for (const row of layer.data) {
      for (const raw of row) {
        const set = setFor(map.tilesets, raw & GID_MASK);
        if (set) used.add(set.key);
      }
    }
  }
  const kept = map.tilesets.filter((t) => used.has(t.key));
  let next = 1;
  const renumbered = kept.map((t) => {
    const out = { ...t, firstgid: next };
    next += t.tilecount;
    return out;
  });
  const same = renumbered.length === map.tilesets.length && renumbered.every((t, i) => t.firstgid === map.tilesets[i].firstgid);
  if (same) return;
  const oldByKey = new Map(map.tilesets.map((t) => [t.key, t]));
  const newByKey = new Map(renumbered.map((t) => [t.key, t]));
  for (const layer of map.layers) {
    for (const row of layer.data) {
      for (let x = 0; x < row.length; x++) {
        const raw = row[x];
        const gid = raw & GID_MASK;
        if (!gid) continue;
        const set = setFor(map.tilesets, gid);
        if (!set) {
          row[x] = 0;
          continue;
        }
        const from = oldByKey.get(set.key)!;
        const to = newByKey.get(set.key)!;
        row[x] = (gid - from.firstgid + to.firstgid) | (raw & FLAG_MASK);
      }
    }
  }
  map.tilesets = renumbered;
}

/** Change the grid size, keeping the picture pinned to the given corner or centre. */
export function resizeMap(map: TileMapDef, width: number, height: number, anchor: 'nw' | 'c' = 'nw'): void {
  const ox = anchor === 'c' ? Math.floor((width - map.width) / 2) : 0;
  const oy = anchor === 'c' ? Math.floor((height - map.height) / 2) : 0;
  for (const layer of map.layers) {
    const data = Array.from({ length: height }, () => Array<number>(width).fill(0));
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const nx = x + ox;
        const ny = y + oy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) data[ny][nx] = layer.data[y][x];
      }
    }
    layer.data = data;
  }
  map.width = width;
  map.height = height;
}

/** A rectangle of one sheet, in that sheet's tile columns and rows. */
export function stampFromSheet(
  sheet: { key: string; columns: number; tilecount: number },
  c0: number,
  r0: number,
  w: number,
  h: number,
): Stamp {
  const cells: (StampCell | null)[][] = [];
  for (let y = 0; y < h; y++) {
    const row: (StampCell | null)[] = [];
    for (let x = 0; x < w; x++) {
      const local = (r0 + y) * sheet.columns + (c0 + x);
      row.push(local < sheet.tilecount ? { key: sheet.key, columns: sheet.columns, tilecount: sheet.tilecount, local, flags: 0 } : null);
    }
    cells.push(row);
  }
  return { w, h, layers: [{ name: null, cells }] };
}

/** The gid grid of a pack's example map, as the palette shows it. */
export interface TmxLike {
  width: number;
  height: number;
  tilesets: { firstgid: number; tilecount: number; columns: number; key: string | null }[];
  layers: { name: string; data: number[] }[];
}

/** A rectangle of an example map, every listed layer kept under its own name. */
export function stampFromTmx(tmx: TmxLike, rect: TileRect, layers: string[]): Stamp {
  const sets: TileSetRef[] = tmx.tilesets
    .filter((t): t is typeof t & { key: string } => t.key !== null)
    .map((t) => ({ key: t.key, columns: t.columns, firstgid: t.firstgid, tilecount: t.tilecount }));
  const out: StampLayer[] = [];
  for (const layer of tmx.layers) {
    if (!layers.includes(layer.name)) continue;
    const cells: (StampCell | null)[][] = [];
    let any = false;
    for (let y = 0; y < rect.h; y++) {
      const row: (StampCell | null)[] = [];
      for (let x = 0; x < rect.w; x++) {
        const sx = rect.x + x;
        const sy = rect.y + y;
        const raw = sx < tmx.width && sy < tmx.height ? layer.data[sy * tmx.width + sx] : 0;
        const gid = raw & GID_MASK;
        const set = setFor(sets, gid);
        if (!gid || !set) {
          row.push(null);
          continue;
        }
        any = true;
        row.push({ key: set.key, columns: set.columns, tilecount: set.tilecount, local: gid - set.firstgid, flags: raw & FLAG_MASK });
      }
      cells.push(row);
    }
    if (any) out.push({ name: layer.name, cells });
  }
  return { w: rect.w, h: rect.h, layers: out };
}

/** An example map as something `drawTileMap` can paint. */
export function tmxToMap(tmx: TmxLike, tile = 32): TileMapDef {
  return {
    width: tmx.width,
    height: tmx.height,
    tile,
    tilesets: tmx.tilesets
      .filter((t): t is typeof t & { key: string } => t.key !== null)
      .map((t) => ({ key: t.key, columns: t.columns, firstgid: t.firstgid, tilecount: t.tilecount })),
    layers: tmx.layers.map((l) => ({
      name: l.name,
      data: Array.from({ length: tmx.height }, (_, y) => l.data.slice(y * tmx.width, (y + 1) * tmx.width)),
    })),
  };
}

/** The rectangle spanned by two cells, inclusive. */
export function spanRect(a: { x: number; y: number }, b: { x: number; y: number }): TileRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 };
}

/**
 * Map-space (0–100 × 0–75, what spots are placed in) → tile; null outside
 * the picture. The same projection MapCard uses in reverse.
 */
export function tileAt(map: TileMapDef, x: number, y: number): { x: number; y: number } | null {
  const tx = Math.floor((x / 100) * map.width);
  const ty = Math.floor((y / 75) * map.height);
  return inside(map, tx, ty) ? { x: tx, y: ty } : null;
}

/** The map-space centre of a tile — where a spot snaps to when the region is drawn. */
export function tileCentre(map: TileMapDef, tx: number, ty: number): { x: number; y: number } {
  return {
    x: Math.round(((tx + 0.5) / map.width) * 1000) / 10,
    y: Math.round(((ty + 0.5) / map.height) * 750) / 10,
  };
}

export function isLayerEmpty(layer: TileLayer): boolean {
  return layer.data.every((row) => row.every((g) => g === 0));
}
