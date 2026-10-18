import { FLIP_D, FLIP_H, FLIP_V, GID_MASK, type TileMapDef } from './types';
import { tilesetImage } from './tileArt';

/** How a sheet key becomes pixels; the game's resolver is the default. */
export type SheetResolver = (key: string) => Promise<HTMLImageElement | null>;

/**
 * Paint a map onto a canvas at native resolution. Resolves false when no
 * sheet could be loaded at all (the packs are absent), so the caller can
 * fall back to the node diagram; a partly-missing map paints what it can.
 *
 * `hidden` names layers to skip — an authoring aid in the forge, never set
 * by the game. `resolve` lets the forge, which serves the packs straight off
 * the dev server, paint the same map without the game's sheet glob.
 */
export async function drawTileMap(
  canvas: HTMLCanvasElement,
  map: TileMapDef,
  options: { resolve?: SheetResolver; hidden?: ReadonlySet<string> } = {},
): Promise<boolean> {
  const resolve = options.resolve ?? tilesetImage;
  const sheets = await Promise.all(map.tilesets.map((t) => resolve(t.key)));
  if (sheets.every((s) => s === null)) return false;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  canvas.width = map.width * map.tile;
  canvas.height = map.height * map.tile;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const T = map.tile;
  const sorted = map.tilesets.map((t, i) => ({ ...t, img: sheets[i] })).sort((a, b) => b.firstgid - a.firstgid);

  for (const layer of map.layers) {
    if (options.hidden?.has(layer.name)) continue;
    for (let y = 0; y < map.height; y++) {
      const row = layer.data[y];
      if (!row) continue;
      for (let x = 0; x < map.width; x++) {
        const raw = row[x] ?? 0;
        const gid = raw & GID_MASK;
        if (!gid) continue;
        const set = sorted.find((t) => gid >= t.firstgid);
        if (!set?.img) continue;
        const local = gid - set.firstgid;
        // A gid past the sheet's last tile names nothing (Tiled's automap
        // markers in a rule map land here); drawing it would sample air.
        if (set.tilecount && local >= set.tilecount) continue;
        const sx = (local % set.columns) * T;
        const sy = Math.floor(local / set.columns) * T;
        const h = (raw & FLIP_H) !== 0;
        const v = (raw & FLIP_V) !== 0;
        const d = (raw & FLIP_D) !== 0;
        if (!h && !v && !d) {
          ctx.drawImage(set.img, sx, sy, T, T, x * T, y * T, T, T);
          continue;
        }
        // Tiled's flags: diagonal is a transpose, applied before the flips.
        ctx.save();
        ctx.translate(x * T + T / 2, y * T + T / 2);
        if (d) {
          ctx.rotate(Math.PI / 2);
          ctx.scale(1, -1);
        }
        ctx.scale(h ? -1 : 1, v ? -1 : 1);
        ctx.drawImage(set.img, sx, sy, T, T, -T / 2, -T / 2, T, T);
        ctx.restore();
      }
    }
  }
  return true;
}
