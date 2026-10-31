import type { FieldFighter, RoyaleField } from '../../core/types';
import { ROYALE_CACHES, ROYALE_DENS } from '../../core/data/festival.data';
import { TICKS_PER_GAME_MINUTE } from '../../core/data/climate.data';
import { SECTION_IDS, sectionIdOf, type RoyaleMap } from '../../core/systems/royaleMap';
import { cacheOpen, denLive, nearestFighter, radarLeft, sees } from '../../core/systems/royaleTerrain';

/**
 * The royale field's map, as pure reads (ui/lib/RoyaleField.svelte draws
 * them, docs/FESTIVAL.md §9.2). Everything that decides what the player's map
 * shows is here, built on the same terrain reads the simulation uses
 * (systems/royaleTerrain.ts), so the map and the simulation agree: the
 * isometric projection and its inverse, the camera window, the compass, the
 * fog (which fighters and which features show), the radar and the colour of
 * each section's cells.
 */

// ---------- Projection ----------

/** Pixels per field unit along a ground axis; the diamond is twice as wide as it is tall. */
export const ISO_K = 8;

export interface ScreenPoint {
  sx: number;
  sy: number;
}

/** A field point on the isometric ground: iso(x, y) = ((x - y) K, (x + y) K / 2). */
export function isoPoint(x: number, y: number, k = ISO_K): ScreenPoint {
  return { sx: (x - y) * k, sy: ((x + y) * k) / 2 };
}

/** The inverse of `isoPoint`: a ground point on the screen back to field units. */
export function fieldPoint(sx: number, sy: number, k = ISO_K): { x: number; y: number } {
  const a = sx / k;
  const b = (2 * sy) / k;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** The unit vector on the screen of a field direction, or null for no direction. */
export function isoDirection(dx: number, dy: number): { ux: number; uy: number } | null {
  const p = isoPoint(dx, dy);
  const len = Math.hypot(p.sx, p.sy);
  return len === 0 ? null : { ux: p.sx / len, uy: p.sy / len };
}

/** The ellipse a circle of `radius` field units makes on the isometric ground. */
export function isoEllipse(radius: number, k = ISO_K): { rx: number; ry: number } {
  const rx = radius * k * Math.SQRT2;
  return { rx, ry: rx / 2 };
}

// ---------- Compass ----------

export type Compass = 'north' | 'north-east' | 'east' | 'south-east' | 'south' | 'south-west' | 'west' | 'north-west';

const COMPASS: Compass[] = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

/**
 * The compass direction of a field vector. North is toward the field's far
 * edge (low y, the cliff side), east toward high x. On the isometric ground
 * north points up and to the right, east down and to the right.
 */
export function compassDirection(dx: number, dy: number): Compass {
  if (dx === 0 && dy === 0) return 'north';
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const turn = ((deg % 360) + 360) % 360;
  return COMPASS[Math.round(turn / 45) % 8];
}

// ---------- Camera ----------

/** A rectangle in the ground's screen space (an SVG viewBox). */
export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** How many field units across the following view is: a field this size fits it exactly. */
export const VIEW_SPAN = 60;
/** Room around the diamond for what stands on its edge. */
export const VIEW_MARGIN = 18;

/** The whole field, with room around the diamond for sprites on its edge. */
export function fieldBounds(size: number, k = ISO_K, margin = VIEW_MARGIN): ViewBox {
  return { x: -size * k - margin, y: -margin * 2, w: 2 * size * k + margin * 2, h: size * k + margin * 3 };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** How far inside the window the player stays, in screen units: room for the sprite and its label. */
export const VIEW_PAD = { x: 60, y: 70 };

/**
 * The view: `span` field units across, following `center` (the player), or
 * the whole field. A span as large as the field is the whole field.
 *
 * The diamond fills only part of a window centred near its edge, so the
 * window is pulled toward the middle of the field until it lies inside the
 * diamond, but never so far that the player leaves it (VIEW_PAD keeps the
 * player's sprite and label in view). Measured from the field's middle as
 * |sx| + 2 |sy|, the diamond's edge is `size * k` away and a window of width
 * w and height h lies inside it while its centre is within
 * `size * k - w / 2 - h`. The window always stays inside the field's bounds.
 */
export function cameraBox(center: ScreenPoint, size: number, whole: boolean, span = VIEW_SPAN, k = ISO_K): ViewBox {
  const bounds = fieldBounds(size, k);
  if (whole || span >= size) return bounds;
  const w = Math.min(bounds.w, 2 * span * k);
  const h = Math.min(bounds.h, span * k);
  // The field's middle, and how far the player is from it in diamond distance
  // (|sx| + 2 |sy|: the diamond's edge is at size * k).
  const mid = { sx: 0, sy: (size * k) / 2 };
  const dx = center.sx - mid.sx;
  const dy = center.sy - mid.sy;
  const reach = Math.abs(dx) + 2 * Math.abs(dy);
  const inner = Math.max(0, size * k - w / 2 - h);
  const pull = reach > inner && reach > 0 ? 1 - inner / reach : 0;
  const maxX = Math.max(0, w / 2 - VIEW_PAD.x);
  const maxY = Math.max(0, h / 2 - VIEW_PAD.y);
  const ox = clamp(dx * pull, -maxX, maxX);
  const oy = clamp(dy * pull, -maxY, maxY);
  const cx = center.sx - ox;
  const cy = center.sy - oy;
  return {
    x: clamp(cx - w / 2, bounds.x, bounds.x + bounds.w - w),
    y: clamp(cy - h / 2, bounds.y, bounds.y + bounds.h - h),
    w,
    h,
  };
}

// ---------- Sections ----------

export interface SectionCentre {
  id: string;
  /** A cell of the section, in field units, nearest the middle of its cells. */
  x: number;
  y: number;
  cells: number;
}

const CENTRES = new WeakMap<RoyaleMap, SectionCentre[]>();

/**
 * Where to write each section's name: the centroid of its cells, moved to the
 * section's own cell nearest it (a river's centroid may lie on its bank). A
 * section with no cells has no name on the map.
 */
export function sectionCentres(map: RoyaleMap): SectionCentre[] {
  const hit = CENTRES.get(map);
  if (hit) return hit;
  const n = SECTION_IDS.length + 1;
  const count = new Array<number>(n).fill(0);
  const sumX = new Array<number>(n).fill(0);
  const sumY = new Array<number>(n).fill(0);
  const { size, cells } = map;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = cells[y * size + x];
      if (c <= 0 || c >= n) continue;
      count[c]++;
      sumX[c] += x + 0.5;
      sumY[c] += y + 0.5;
    }
  }
  const best = new Array<number>(n).fill(Infinity);
  const at: ({ x: number; y: number } | undefined)[] = new Array(n).fill(undefined);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = cells[y * size + x];
      if (c <= 0 || c >= n) continue;
      const d = Math.hypot(x + 0.5 - sumX[c] / count[c], y + 0.5 - sumY[c] / count[c]);
      if (d < best[c]) {
        best[c] = d;
        at[c] = { x: x + 0.5, y: y + 0.5 };
      }
    }
  }
  const out: SectionCentre[] = [];
  for (let c = 1; c < n; c++) {
    const p = at[c];
    const id = sectionIdOf(c);
    if (p && id) out.push({ id, x: p.x, y: p.y, cells: count[c] });
  }
  CENTRES.set(map, out);
  return out;
}

// ---------- Features ----------

export interface FieldFeature {
  kind: 'cache' | 'den';
  id: string;
  name: string;
  icon: string;
  section: string;
  x: number;
  y: number;
  /** A cache taken, or a den cleared: drawn dimmed. */
  spent: boolean;
  /** A cache whose den is not cleared yet. */
  shut: boolean;
  /** A cache's den, by id, where it has one. */
  guard?: string;
  /** A den's radius in field units. */
  radius?: number;
}

/** A field with nothing taken or cleared, for the hub's preview of a field not yet opened. */
const UNOPENED: RoyaleField = { size: 0, fighters: [], player: { x: 0, y: 0 }, fallen: 0 };

/**
 * The caches and dens the map shows. A feature shows when its section is
 * known (`known`: scouted in the hub, or stood in this attempt) or when it
 * stands in the viewer's sight (`sees`, the simulation's own read). Without a
 * viewer only the known sections show.
 */
export function visibleFeatures(
  map: RoyaleMap,
  field: Pick<RoyaleField, 'taken' | 'cleared'> | undefined,
  known: (section: string) => boolean,
  viewer?: { x: number; y: number },
): FieldFeature[] {
  const state = { ...UNOPENED, taken: field?.taken, cleared: field?.cleared };
  const shows = (section: string, p: { x: number; y: number }) => known(section) || (!!viewer && sees(map, viewer, p));
  const out: FieldFeature[] = [];
  for (const d of ROYALE_DENS) {
    const p = map.dens[d.id];
    if (!p || !shows(d.section, p)) continue;
    out.push({
      kind: 'den',
      id: d.id,
      name: d.name,
      icon: d.icon,
      section: d.section,
      x: p.x,
      y: p.y,
      spent: !denLive(state, d),
      shut: false,
      radius: d.radius,
    });
  }
  for (const c of ROYALE_CACHES) {
    const p = map.caches[c.id];
    if (!p || !shows(c.section, p)) continue;
    const taken = !!state.taken?.includes(c.id);
    out.push({
      kind: 'cache',
      id: c.id,
      name: c.name,
      icon: c.icon,
      section: c.section,
      x: p.x,
      y: p.y,
      spent: taken,
      shut: !taken && !cacheOpen(state, c),
      guard: c.den,
    });
  }
  return out;
}

// ---------- Fog and radar ----------

export type RadarView =
  | { state: 'off'; left: number }
  | { state: 'on'; target: { id: number; x: number; y: number; dist: number; dx: number; dy: number; dir: Compass } | null };

/** The player's radar at world tick `now`: ticks until it switches on, or its target. */
export function radarView(field: RoyaleField, now: number): RadarView {
  const p = field.player;
  const left = radarLeft(p.lastFight, field.openedAt, now);
  if (left > 0) return { state: 'off', left };
  const t = nearestFighter(field, p.x, p.y);
  if (!t) return { state: 'on', target: null };
  const dx = t.x - p.x;
  const dy = t.y - p.y;
  return { state: 'on', target: { ...t, dx, dy, dir: compassDirection(dx, dy) } };
}

/**
 * The fighters the player's map draws: those in the player's sight, the ones
 * in the player's own fight, and the radar's target while the radar is on.
 */
export function visibleFighters(map: RoyaleMap, field: RoyaleField, radar: RadarView): FieldFighter[] {
  const target = radar.state === 'on' ? radar.target?.id : undefined;
  return field.fighters.filter((f) => f.engaged || f.id === target || sees(map, field.player, f));
}

/** Festival minutes in a span of ticks, rounded up so a running countdown never reads 0 early. */
export function festivalMinutes(ticks: number): number {
  return Math.ceil(ticks / TICKS_PER_GAME_MINUTE);
}

/** The radar line under the map: the nearest fighter's distance and direction, or the wait until it switches on. */
export function radarText(radar: RadarView): string {
  if (radar.state === 'off') return `Radar in ${festivalMinutes(radar.left)} min`;
  if (!radar.target) return 'Radar: no fighters left';
  const units = Math.round(radar.target.dist);
  return `Radar: nearest fighter ${units} unit${units === 1 ? '' : 's'}, ${radar.target.dir}`;
}

// ---------- Section colours ----------

export type Rgb = [number, number, number];

/** Parse a CSS colour as the theme tokens write it: `#rgb`, `#rrggbb` or `rgb(r g b)` / `rgb(r, g, b)`. */
export function parseColor(text: string): Rgb | null {
  const s = text.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) return [...m[1]].map((h) => parseInt(h + h, 16)) as Rgb;
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(s);
  if (m) return [0, 2, 4].map((i) => parseInt(m![1].slice(i, i + 2), 16)) as Rgb;
  m = /^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)/.exec(s);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])].map((v) => clamp(Math.round(v), 0, 255)) as Rgb;
  return null;
}

/** `share` of `a` over the rest of `b`, per channel (the CSS `color-mix(in srgb)` of two tokens). */
export function mixColor(a: Rgb, b: Rgb, share: number): Rgb {
  return [0, 1, 2].map((i) => Math.round(a[i] * share + b[i] * (1 - share))) as Rgb;
}

/** Colour per cell kind: `meadow` for open ground, then one per section id. */
export type MapPalette = Record<string, Rgb>;

/**
 * Each section's colour as `[token, token, share]`: `share` of the first
 * theme token over the second. The terrain reads the tokens in src/app.css
 * (and a theme's overrides of them), so a theme restyles the map. A section
 * with no entry takes a colour from FALLBACK_TOKENS by its place in the list.
 */
export const PALETTE_RECIPE: Record<string, [string, string, number]> = {
  meadow: ['--accent', '--bg-raised', 0.07],
  cliff: ['--text-dim', '--bg-sunken', 0.4],
  waterfall: ['--mana', '--text', 0.62],
  river: ['--mana', '--bg-sunken', 0.5],
  bank: ['--mat-wood', '--bg-raised', 0.3],
  cave: ['--spirit', '--bg-sunken', 0.18],
  glade: ['--xp', '--accent', 0.55],
  forest: ['--stamina', '--bg-sunken', 0.3],
  village: ['--mat-leather', '--bg-raised', 0.5],
};
export const FALLBACK_TOKENS = ['--skill', '--focus', '--spirit', '--mana', '--stamina'];
const NEUTRAL: Rgb = [90, 90, 90];

/** The palette from a reader of theme tokens (`--name` to its value); an unreadable token falls back to grey. */
export function mapPalette(read: (token: string) => string | undefined): MapPalette {
  const tok = (name: string) => parseColor(read(name) ?? '') ?? NEUTRAL;
  const mix = ([a, b, share]: [string, string, number]) => mixColor(tok(a), tok(b), share);
  const out: MapPalette = { meadow: mix(PALETTE_RECIPE.meadow) };
  SECTION_IDS.forEach((id, i) => {
    const recipe = PALETTE_RECIPE[id] ?? [FALLBACK_TOKENS[i % FALLBACK_TOKENS.length], '--bg-raised', 0.3];
    out[id] = mix(recipe);
  });
  return out;
}

/** A string that changes when the palette does: the cache key for a drawn map. */
export function paletteKey(palette: MapPalette): string {
  return Object.keys(palette)
    .sort()
    .map((k) => `${k}=${palette[k].join(',')}`)
    .join(';');
}

/** The map as RGBA pixels, one per cell, row-major: the canvas the terrain is drawn from. */
export function royaleMapPixels(map: RoyaleMap, palette: MapPalette): Uint8ClampedArray {
  const { size, cells } = map;
  const out = new Uint8ClampedArray(size * size * 4);
  const meadow = palette.meadow ?? NEUTRAL;
  const byCell: Rgb[] = [meadow, ...SECTION_IDS.map((id) => palette[id] ?? NEUTRAL)];
  for (let i = 0; i < size * size; i++) {
    const rgb = byCell[cells[i]] ?? meadow;
    out[i * 4] = rgb[0];
    out[i * 4 + 1] = rgb[1];
    out[i * 4 + 2] = rgb[2];
    out[i * 4 + 3] = 255;
  }
  return out;
}
