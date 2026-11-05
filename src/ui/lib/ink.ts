/**
 * `ink(color)`: an authored colour as it is drawn in the current theme.
 *
 * Authored colours (rarity, quality tier, status, school, position, talent lap)
 * come from data and are written for no particular ground. A theme sets
 * `--ink-lmin` and `--ink-lmax` (app.css; 0 and 1 give the authored colour) and
 * every authored colour is remapped in OKLCH: `l' = lmin + l * (lmax - lmin)`,
 * hue kept and chroma `c' = c * lmax`. A remap keeps the order and the spacing
 * of the colours; a clamp would merge the dark ones. The chroma factor is 1
 * wherever lmax is 1 (Default, the dark themes). A light theme lowers lmax: a
 * bright colour darkened with its chroma kept is outside the sRGB gamut and the
 * browser clips it channel by channel, which turns orange and red into one dark
 * red. Scaling chroma with lmax keeps it inside. A selected thing sets
 * `--ink-lmin` / `--ink-lmax` to its own `--sel-ink-lmin` / `--sel-ink-lmax`, so
 * the colours inside it are lifted for the selected fill (docs/THEMES.md §4).
 *
 * The result is a CSS value for `color`, `background`, a custom property, an SVG
 * `fill` or a `color-mix()` argument. It uses relative colour syntax, so a
 * browser without it gets the raw colour. Only a literal hex colour is
 * remapped; `var(--token)` and other values pass through, because a theme token
 * is already the theme's own colour.
 */

/** The remap, as a CSS `calc()` over the channel `l`. */
export const INK_LIGHTNESS = 'calc(var(--ink-lmin) + l * (var(--ink-lmax) - var(--ink-lmin)))';

/** The chroma factor, as a CSS `calc()` over the channel `c`: 1 where `--ink-lmax` is 1. */
export const INK_CHROMA = 'calc(c * var(--ink-lmax))';

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function relativeColorSupported(): boolean {
  try {
    return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('color', 'oklch(from red l c h)');
  } catch {
    return false;
  }
}

let supported: boolean | undefined;

export function ink(color: string | undefined): string {
  if (!color) return '';
  if (!HEX.test(color)) return color;
  supported ??= relativeColorSupported();
  return supported ? `oklch(from ${color} ${INK_LIGHTNESS} ${INK_CHROMA} h)` : color;
}
