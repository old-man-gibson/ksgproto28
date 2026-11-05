/**
 * Tileset sheets, by pack key + path. The list of packs and the sheet glob
 * live in `sheets.gen.ts`, which the forge rewrites on every apply that
 * touches a map: only the sheets some map actually draws from are globbed,
 * because the packs hold thousands of files and every glob entry is a build
 * input. Never edit the generated file — paint in the forge instead.
 *
 * `eager: false` on purpose: the packs are licensed art kept out of version
 * control (docs/AUTHORSHIP.md §9), so a checkout without them must still
 * build and run. A sheet the bundle lacks is asked of the imported art pack
 * (artPack/artPack.svelte.ts, key = the glob path under src/assets). One
 * that neither has resolves to null and the map falls back to the node
 * diagram (TileMap.svelte).
 */
import { PACKS, SHEETS } from './sheets.gen';
import { artPack, resolveArtAsync } from '../artPack/artPack.svelte';
import type { TileMapDef } from './types';

/** Where the glob paths in sheets.gen.ts start; the rest is the art pack's key. */
const GLOB_ROOT = '../../../assets/';

/** The glob path of a sheet key (`<packKey>/<path inside the pack>`), or null for an unknown pack. */
function sheetPath(key: string): string | null {
  const slash = key.indexOf('/');
  const pack = PACKS[key.slice(0, slash)];
  return pack ? pack + key.slice(slash + 1) : null;
}

/**
 * True when drawing `map` is expected to find no sheet at all, so MapCard can
 * start in the diagram layout instead of switching to it after the first
 * paint: the build bundles none of the map's sheets and the art pack hint says
 * no pack is stored (artPack.hinted, known synchronously). A map with some
 * sheet bundled draws, partly if need be (drawTileMap), so it is not expected
 * to fall back. The expectation can be wrong when the hint is (artPack
 * rewrites it once the manifest is read); the draw result then corrects the
 * layout, as it always has.
 */
export function expectsNoSheets(map: TileMapDef): boolean {
  if (artPack.hinted) return false;
  return !map.tilesets.some((t) => {
    const path = sheetPath(t.key);
    return path !== null && SHEETS[path] !== undefined;
  });
}

/** The URL of a sheet (bundled, else the art pack), or null when neither has it. */
export async function tilesetUrl(key: string): Promise<string | null> {
  const path = sheetPath(key);
  if (!path) return null;
  const loader = SHEETS[path];
  let bundled: string | null = null;
  if (loader) {
    try {
      bundled = await loader();
    } catch {
      // Unreadable in the bundle: the art pack may still have it.
    }
  }
  return resolveArtAsync(path.startsWith(GLOB_ROOT) ? path.slice(GLOB_ROOT.length) : path, bundled);
}

const IMAGES = new Map<string, { epoch: number; image: Promise<HTMLImageElement | null> }>();

/**
 * A decoded sheet, cached; null when it cannot be had. A cached sheet is
 * dropped when the art pack was imported or removed since it was made.
 */
export function tilesetImage(key: string): Promise<HTMLImageElement | null> {
  const epoch = artPack.epoch;
  const hit = IMAGES.get(key);
  if (hit && hit.epoch === epoch) return hit.image;
  const image = tilesetUrl(key).then(
    (url) =>
      new Promise<HTMLImageElement | null>((resolve) => {
        if (!url) return resolve(null);
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
      }),
  );
  IMAGES.set(key, { epoch, image });
  return image;
}
