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

/** Where the glob paths in sheets.gen.ts start; the rest is the art pack's key. */
const GLOB_ROOT = '../../../assets/';

/** The URL of a sheet (bundled, else the art pack), or null when neither has it. */
export async function tilesetUrl(key: string): Promise<string | null> {
  const slash = key.indexOf('/');
  const pack = PACKS[key.slice(0, slash)];
  if (!pack) return null;
  const path = pack + key.slice(slash + 1);
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
