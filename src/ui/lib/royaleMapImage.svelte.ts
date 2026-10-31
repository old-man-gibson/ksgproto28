import type { RoyaleMap } from '../../core/systems/royaleMap';
import { mapPalette, paletteKey, royaleMapPixels, type MapPalette } from './royaleView';

/**
 * The royale terrain as an image: one pixel per cell, a colour per section
 * from the theme's tokens (royaleView.ts `mapPalette`), drawn once per seed
 * and palette into an offscreen canvas and handed to the map as a data URL.
 * The map places it under the isometric transform as a single SVG image, so
 * a 180 by 180 field costs one element rather than 32,400.
 */

/** Bumped when the page's theme changes, so a map drawn under the old palette is drawn again. */
const theme = $state({ stamp: 0 });
let watching = false;

/**
 * The count of theme changes seen. Read it inside a `$derived` that draws the
 * map and the map redraws on a theme switch (the theme sets `data-theme` on
 * the page's root element, ui/lib/theme.ts).
 */
export function themeStamp(): number {
  if (!watching && typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
    watching = true;
    new MutationObserver(() => theme.stamp++).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }
  return theme.stamp;
}

/** The map palette under the page's current theme. */
export function readPalette(): MapPalette {
  const css = getComputedStyle(document.documentElement);
  return mapPalette((token) => css.getPropertyValue(token));
}

/** The last few images drawn, by seed and palette: a field reads its image every render. */
const DRAWN = new Map<string, string>();
const DRAWN_SIZE = 6;

/** The terrain of `map` as a PNG data URL ('' where there is no canvas to draw on). */
export function mapDataUrl(map: RoyaleMap, palette: MapPalette): string {
  const key = `${map.seed}:${map.size}:${paletteKey(palette)}`;
  const hit = DRAWN.get(key);
  if (hit !== undefined) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = map.size;
  canvas.height = map.size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const pixels = royaleMapPixels(map, palette);
  const image = ctx.createImageData(map.size, map.size);
  image.data.set(pixels);
  ctx.putImageData(image, 0, 0);
  const url = canvas.toDataURL('image/png');
  DRAWN.set(key, url);
  if (DRAWN.size > DRAWN_SIZE) DRAWN.delete(DRAWN.keys().next().value!);
  return url;
}
