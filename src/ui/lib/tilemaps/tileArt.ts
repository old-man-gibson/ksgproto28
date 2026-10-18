/**
 * Tileset sheets, by pack key + path. The list of packs and the sheet glob
 * live in `sheets.gen.ts`, which the forge rewrites on every apply that
 * touches a map: only the sheets some map actually draws from are globbed,
 * because the packs hold thousands of files and every glob entry is a build
 * input. Never edit the generated file — paint in the forge instead.
 *
 * `eager: false` on purpose: the packs are licensed art kept out of version
 * control (docs/AUTHORSHIP.md §9), so a checkout without them must still
 * build and run. A missing sheet resolves to null and the map falls back to
 * the node diagram (TileMap.svelte).
 */
import { PACKS, SHEETS } from './sheets.gen';

/** The URL of a sheet, or null when the pack is not on this machine. */
export async function tilesetUrl(key: string): Promise<string | null> {
  const slash = key.indexOf('/');
  const pack = PACKS[key.slice(0, slash)];
  if (!pack) return null;
  const loader = SHEETS[pack + key.slice(slash + 1)];
  if (!loader) return null;
  try {
    return await loader();
  } catch {
    return null;
  }
}

const IMAGES = new Map<string, Promise<HTMLImageElement | null>>();

/** A decoded sheet, cached; null when it cannot be had. */
export function tilesetImage(key: string): Promise<HTMLImageElement | null> {
  let p = IMAGES.get(key);
  if (!p) {
    p = tilesetUrl(key).then(
      (url) =>
        new Promise<HTMLImageElement | null>((resolve) => {
          if (!url) return resolve(null);
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = url;
        }),
    );
    IMAGES.set(key, p);
  }
  return p;
}
