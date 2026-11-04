import type { GameState, SpotDef } from '../../core/types';
import { AREAS, FLOOR_BY_AREA, SPOTS, getSpot } from '../../core/registry';
import { visibleEdges } from '../../core/systems/locations';

/**
 * Known places and adjacent unexplored places, scoped to the displayed
 * region/floor. `floorArea` is the floor the map's tabs picked; without one,
 * the floor you stand on when the region is your own.
 */
export function mapNodes(
  state: GameState,
  shownRegion: string,
  floorArea?: string | null,
): { spot: SpotDef; known: boolean }[] {
  const here = getSpot(state.spot);
  const floor = FLOOR_BY_AREA.get(here.areaId);
  const currentRegion = AREAS[here.areaId].regionId;
  const scope = floorArea ?? (shownRegion === currentRegion ? floor?.areaId : undefined);
  const discovered = new Set(state.discovered);
  const ghosts = new Set<string>();
  for (const id of discovered) {
    for (const edge of visibleEdges(state, id)) {
      if (!discovered.has(edge.to)) ghosts.add(edge.to);
    }
  }
  return Object.values(SPOTS)
    .filter((spot) => spot.map && AREAS[spot.areaId].regionId === shownRegion)
    .filter((spot) => !scope || spot.areaId === scope)
    .filter((spot) => discovered.has(spot.id) || ghosts.has(spot.id))
    .map((spot) => ({ spot, known: discovered.has(spot.id) }));
}

// ---------- The frame: map units to pixels ----------

/** A point in the frame's pixel space. */
export interface Pt {
  x: number;
  y: number;
}

/**
 * The drawing's pixel space. The SVG's viewBox is `0 0 w h`, so one unit is
 * one CSS pixel and text sizes are real sizes.
 */
export interface MapFrame {
  w: number;
  h: number;
  /** Painted from tiles: the picture keeps its proportions and the diagram scales with it. */
  tiled: boolean;
  /** Pin radius, px. */
  pinR: number;
  /** Label size, px. */
  font: number;
  project: (p: { x: number; y: number }) => Pt;
}

/** A diagram region is this many px high at every width. */
export const PLAN_HEIGHT = 340;
/** The most a unit of map x or y may stretch, px per unit. */
export const PLAN_CAP_X = 8.1;
export const PLAN_CAP_Y = 5.6;
/** Below this frame width the diagram labels only the spot underfoot and its neighbours. */
export const FULL_LABELS_MIN_W = 560;
/** A tiled region never draws wider than its picture's useful size. */
export const TILE_MAX_W = 560;
/** Used before the first measurement, and where nothing can be measured. */
export const DEFAULT_W = 788;

/**
 * A diagram region at the column's width. The two axes scale separately, each
 * capped, and the drawing is centred. Pins are 30 px and labels 12 px; a frame
 * under FULL_LABELS_MIN_W takes 22 px pins and 11 px labels so the pins keep
 * clear of each other.
 */
export function diagramFrame(points: { x: number; y: number }[], w: number, h = PLAN_HEIGHT): MapFrame {
  const narrow = w < FULL_LABELS_MIN_W;
  const pinR = narrow ? 11 : 15;
  const font = narrow ? 11 : 12;
  const padX = pinR + 24;
  const padY = pinR + 22;
  // A region with nothing on it yet draws its middle.
  const placed = points.length ? points : [{ x: 50, y: 37.5 }];
  const xs = placed.map((p) => p.x);
  const ys = placed.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  // Never below half a pixel per unit, so a frame narrower than its padding
  // squeezes the drawing instead of mirroring it.
  const sx = Math.max(0.5, Math.min(PLAN_CAP_X, (w - 2 * padX) / Math.max(1, x1 - x0)));
  const sy = Math.max(0.5, Math.min(PLAN_CAP_Y, (h - 2 * padY) / Math.max(1, y1 - y0)));
  const ox = (w - (x1 - x0) * sx) / 2;
  const oy = (h - (y1 - y0) * sy) / 2;
  return {
    w,
    h,
    tiled: false,
    pinR,
    font,
    project: (p) => ({ x: ox + (p.x - x0) * sx, y: oy + (p.y - y0) * sy }),
  };
}

/**
 * A tiled region: the picture is 100 × 75 map units with six units of headroom
 * for labels above and three below, one scale on both axes, so the tiles are
 * never stretched. Pins and labels scale with it.
 */
export function tiledFrame(w: number): MapFrame {
  const width = Math.min(w, TILE_MAX_W);
  const s = width / 100;
  return {
    w: width,
    h: Math.round(width * 0.84),
    tiled: true,
    pinR: Math.max(11, 3.1 * s),
    font: Math.max(10, Math.round(2.4 * s * 10) / 10),
    project: (p) => ({ x: p.x * s, y: (p.y + 6) * s }),
  };
}

// ---------- Label placement ----------

/** An axis-aligned box in frame pixels. */
export interface MapBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** One pin as the label pass sees it: where it is, what it says, what sits on it. */
export interface LabelPin {
  id: string;
  x: number;
  y: number;
  /** Pin radius. */
  r: number;
  text: string;
  /** Boxes that belong to this pin and must stay clear: its chips, ⚔️, arrow. */
  avoid?: MapBox[];
  /** How far chips or an arrow stand above the pin, so a name above clears them. */
  lift?: number;
}

export interface LabelPlace {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
}

/** Width of a character as a share of the font size; errs wide for both themes' faces. */
const CHAR_W = 0.52;
const ASCENT = 0.85;
const DESCENT = 0.25;
/** Room for the text's outline on each side. */
const HALO = 2;
/** How far past its nearest place a name is moved, px, once every nearer place touches something. */
const RINGS = [0, 6, 14, 24, 36];
/** The slides tried on a name that still touches something, px. */
const NUDGE_X = [-2, 2, -4, 4, -6, 6, -9, 9, -13, 13, -18, 18, -24, 24];
const NUDGE_Y = [0, -2, 2, -4, 4, -7, 7, -10, 10];
/** How far from its pin the last search looks for a free spot for a name, px (plus half the name across). */
const SEARCH_REACH = 44;
/** What touching its own pin costs a name, against px² of overlap with anything else. */
const OWN_PIN = 1_000_000;

export function textWidth(text: string, font: number): number {
  return text.length * CHAR_W * font;
}

function overlap(a: MapBox, b: MapBox): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
}

/** The box a line of map text covers at a place, outline included. */
export function labelBox(text: string, at: LabelPlace, font = 12): MapBox {
  const w = textWidth(text, font) + 2 * HALO;
  const x0 = at.anchor === 'middle' ? at.x - w / 2 : at.anchor === 'start' ? at.x - HALO : at.x - w + HALO;
  return { x0, x1: x0 + w, y0: at.y - ASCENT * font, y1: at.y + DESCENT * font };
}

/** The square a pin covers. */
export function pinBox(p: { x: number; y: number }, r: number): MapBox {
  return { x0: p.x - r, y0: p.y - r, x1: p.x + r, y1: p.y + r };
}

/**
 * Where each pin's name goes. Under the pin unless that lands on another pin,
 * its chips or a name; then above, to either side, and the corners. Pins are
 * taken top to bottom so the result is stable, and a name that fits nowhere
 * takes the place it overlaps least. A centred name is slid back inside the
 * frame rather than cut at its edge. Crowded corners still need their pins
 * spread in the data: tests/map.test.ts holds Threshold to zero overlaps.
 */
export function placeLabels(
  pins: LabelPin[],
  obstacles: MapBox[] = [],
  frame: { w: number; h: number; font?: number } = { w: DEFAULT_W, h: PLAN_HEIGHT },
): Map<string, LabelPlace> {
  const font = frame.font ?? 12;
  const view: MapBox = { x0: 2, y0: 2, x1: frame.w - 2, y1: frame.h - 2 };
  const fixed: MapBox[] = [...obstacles];
  const dots = new Map<string, MapBox>();
  for (const p of pins) {
    dots.set(p.id, pinBox(p, p.r));
    for (const box of p.avoid ?? []) fixed.push(box);
  }
  type Choice = { at: LabelPlace; box: MapBox; cost: number };
  const chosen = new Map<string, Choice>();
  const gap = 4;

  /**
   * Where a name may go, nearest first: under, over, to either side, the four
   * ends of the under and over rows, the four corners, and the under and over
   * rows slid sideways by a quarter, three eighths and half of the name. The
   * whole list is tried again further from the pin (`RINGS`) before a name is
   * let to touch anything.
   */
  const candidatesAt = (p: LabelPin, away: number): LabelPlace[] => {
    const r = p.r + away;
    const below = p.y + r + gap + ASCENT * font;
    const above = p.y - r - gap - (p.lift ?? 0) - DESCENT * font;
    const mid = p.y + 0.35 * font;
    const eighth = textWidth(p.text, font) / 8;
    return [
      { x: p.x, y: below, anchor: 'middle' },
      { x: p.x, y: above, anchor: 'middle' },
      { x: p.x + r + gap + 2, y: mid, anchor: 'start' },
      { x: p.x - r - gap - 2, y: mid, anchor: 'end' },
      { x: p.x - r, y: below, anchor: 'start' },
      { x: p.x + r, y: below, anchor: 'end' },
      { x: p.x - r, y: above, anchor: 'start' },
      { x: p.x + r, y: above, anchor: 'end' },
      { x: p.x + r * 0.6, y: p.y + r * 0.85 + ASCENT * font + 1, anchor: 'start' },
      { x: p.x - r * 0.6, y: p.y + r * 0.85 + ASCENT * font + 1, anchor: 'end' },
      { x: p.x + r * 0.6, y: p.y - r * 0.85 - DESCENT * font - 1, anchor: 'start' },
      { x: p.x - r * 0.6, y: p.y - r * 0.85 - DESCENT * font - 1, anchor: 'end' },
      ...[-2, 2, -3, 3, -4, 4].flatMap((k): LabelPlace[] => [
        { x: p.x + k * eighth, y: below, anchor: 'middle' },
        { x: p.x + k * eighth, y: above, anchor: 'middle' },
      ]),
    ];
  };

  /**
   * A name at a place, with what it overlaps; null when it would leave the
   * frame. Touching the pin it names costs more than touching anything else,
   * so a slide never puts a name on its own pin.
   */
  const score = (p: LabelPin, place: LabelPlace): Choice | null => {
    const w = textWidth(p.text, font) + 2 * HALO;
    const at = { ...place };
    if (at.anchor === 'middle') at.x = Math.min(Math.max(at.x, view.x0 + w / 2), view.x1 - w / 2);
    const box = labelBox(p.text, at, font);
    if (box.x0 < view.x0 || box.x1 > view.x1 || box.y0 < view.y0 || box.y1 > view.y1) return null;
    let cost = 0;
    const nearX = Math.min(Math.max(p.x, box.x0), box.x1) - p.x;
    const nearY = Math.min(Math.max(p.y, box.y0), box.y1) - p.y;
    if (nearX * nearX + nearY * nearY < p.r * p.r) cost += OWN_PIN;
    for (const [id, dot] of dots) if (id !== p.id) cost += overlap(box, dot);
    for (const o of fixed) cost += overlap(box, o);
    for (const [id, o] of chosen) if (id !== p.id) cost += overlap(box, o.box);
    return { at, box, cost };
  };

  const choose = (p: LabelPin): Choice => {
    let best: Choice | null = null;
    for (const away of RINGS) {
      for (const c of candidatesAt(p, away)) {
        const got = score(p, c);
        if (!got) continue;
        if (!best || got.cost < best.cost) best = got;
        if (got.cost === 0) return best;
      }
    }
    // Every place touches something: slide the best one a few pixels, which
    // clears a name that only grazes a pin or another name.
    if (best) {
      const from = best.at;
      for (const dx of NUDGE_X) {
        for (const dy of NUDGE_Y) {
          const got = score(p, { ...from, x: from.x + dx, y: from.y + dy });
          if (!got) continue;
          if (got.cost < best.cost) best = got;
          if (got.cost === 0) return best;
        }
      }
    }
    // Still touching: the free spot nearest the pin within reach, on a grid.
    const reach = SEARCH_REACH + textWidth(p.text, font) / 2;
    const offsets: { dx: number; dy: number; d: number }[] = [];
    for (let dx = -reach; dx <= reach; dx += 6) {
      for (let dy = -SEARCH_REACH; dy <= SEARCH_REACH; dy += 4) offsets.push({ dx, dy, d: Math.hypot(dx, dy * 2) });
    }
    offsets.sort((u, v) => u.d - v.d);
    for (const { dx, dy } of offsets) {
      const got = score(p, { x: p.x + dx, y: p.y + dy, anchor: 'middle' });
      if (!got) continue;
      if (!best || got.cost < best.cost) best = got;
      if (got.cost === 0) return best;
    }
    const home = candidatesAt(p, 0)[0];
    return best ?? { at: home, box: labelBox(p.text, home, font), cost: Infinity };
  };

  const order = [...pins].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const p of order) chosen.set(p.id, choose(p));
  // A name placed early may sit where a later one needed to go; give the
  // ones still touching something another look now that every name is down.
  for (let round = 0; round < 3; round++) {
    for (const p of order) if (chosen.get(p.id)!.cost > 0) chosen.set(p.id, choose(p));
  }
  return new Map([...chosen].map(([id, c]) => [id, c.at]));
}

// ---------- Districts ----------

/**
 * The cell of point `i` among `pts`: the part of the frame nearer to it than
 * to any other point, no further than `reach` from it along either axis, by
 * half-plane clipping. The cells of one set tile the frame without overlap.
 */
export function voronoiCell(pts: Pt[], i: number, w: number, h: number, reach = Infinity): Pt[] {
  const p = pts[i];
  const x0 = Math.max(0, p.x - reach);
  const x1 = Math.min(w, p.x + reach);
  const y0 = Math.max(0, p.y - reach);
  const y1 = Math.min(h, p.y + reach);
  let poly: Pt[] = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  for (let j = 0; j < pts.length && poly.length; j++) {
    if (j === i) continue;
    const q = pts[j];
    const mx = (p.x + q.x) / 2;
    const my = (p.y + q.y) / 2;
    const nx = q.x - p.x;
    const ny = q.y - p.y;
    // Signed distance along the normal: negative on p's side of the bisector.
    const side = (v: Pt) => (v.x - mx) * nx + (v.y - my) * ny;
    const out: Pt[] = [];
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k];
      const b = poly[(k + 1) % poly.length];
      const da = side(a);
      const db = side(b);
      if (da <= 0) out.push(a);
      if ((da <= 0) !== (db <= 0)) {
        const t = da / (da - db);
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    poly = out;
  }
  return poly;
}

/** Whether a point lies inside a polygon (even-odd). */
export function inPolygon(pt: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** The box lies inside the union of the cells, sampled along its edges and through its middle. */
export function boxInCells(box: MapBox, cells: Pt[][]): boolean {
  const cols = Math.max(2, Math.ceil((box.x1 - box.x0) / 6));
  for (const fy of [0, 0.5, 1]) {
    const y = box.y0 + (box.y1 - box.y0) * fy;
    for (let c = 0; c <= cols; c++) {
      const pt = { x: box.x0 + ((box.x1 - box.x0) * c) / cols, y };
      if (!cells.some((poly) => inPolygon(pt, poly))) return false;
    }
  }
  return true;
}

/** A district's name as drawn: its lines of text, the first line's baseline point and the box. */
export interface DistrictName {
  text: string;
  /** One line, or two when the name had to be split to fit its district. */
  lines: string[];
  x: number;
  y: number;
  /** Distance between baselines. */
  leading: number;
  box: MapBox;
}

/** The name font is this share of the label font. */
const NAME_FONT = 0.88;
/** Width of a district-name character (capitals, letter-spaced) as a share of its font size. */
const NAME_CHAR_W = 0.8;

export function districtFont(font: number): number {
  return Math.round(font * NAME_FONT * 10) / 10;
}

/** A name as one line, then as two split at the space that leaves the lines most alike. */
function nameLayouts(text: string): string[][] {
  const out = [[text]];
  const spaces = [...text].map((c, i) => (c === ' ' ? i : -1)).filter((i) => i >= 0);
  if (spaces.length) {
    const at = spaces.reduce((best, i) => (Math.abs(2 * i - text.length) < Math.abs(2 * best - text.length) ? i : best));
    out.push([text.slice(0, at), text.slice(at + 1)]);
  }
  return out;
}

/**
 * Where a district's name goes: the nearest spot to the middle of its pins,
 * pushed away from the middle of the whole map, where every part of the name's
 * box lies inside the district's own cells and clear of everything in `taken`.
 * A name that finds no room on one line is tried on two. A district with no
 * such spot gets no name. The box is added to `taken` so the next district
 * keeps clear of it.
 */
export function placeDistrictName(
  text: string,
  pins: Pt[],
  cells: Pt[][],
  center: Pt,
  taken: MapBox[],
  frame: { w: number; h: number; font: number },
): DistrictName | null {
  const font = districtFont(frame.font);
  const leading = font * 1.15;
  const cx = pins.reduce((s, p) => s + p.x, 0) / pins.length;
  const cy = pins.reduce((s, p) => s + p.y, 0) / pins.length;
  const bias = Math.atan2(cy - center.y, cx - center.x);
  const margin = 2;
  for (const lines of nameLayouts(text)) {
    const w = Math.max(...lines.map((l) => l.length)) * NAME_CHAR_W * font;
    for (let rad = 0; rad <= 140; rad += 6) {
      for (let k = 0; k < 32; k++) {
        const a = bias + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 16);
        const x = cx + Math.cos(a) * rad;
        const y = cy + Math.sin(a) * rad;
        const box: MapBox = { x0: x - w / 2, y0: y - font, x1: x + w / 2, y1: y + 3 + leading * (lines.length - 1) };
        if (box.x0 < 4 || box.x1 > frame.w - 4 || box.y0 < 4 || box.y1 > frame.h - 4) continue;
        const clear = !taken.some(
          (o) => overlap(box, { x0: o.x0 - margin, y0: o.y0 - margin, x1: o.x1 + margin, y1: o.y1 + margin }) > 0,
        );
        if (!clear || !boxInCells(box, cells)) continue;
        taken.push(box);
        return { text, lines, x, y, leading, box };
      }
    }
  }
  return null;
}

// ---------- Roads ----------

export type RoadClass = 'path' | 'road' | 'main';

/**
 * A road's class from the roads drawn around it: `main` leaves a hub (six or
 * more roads), `road` joins two junctions (three or more each), anything else
 * is a `path`. Read off the drawn edges only, so a road to an unexplored pin
 * says nothing about what lies beyond it.
 */
export function roadClasses(pairs: [string, string][]): RoadClass[] {
  const degree = new Map<string, number>();
  for (const [a, b] of pairs) {
    degree.set(a, (degree.get(a) ?? 0) + 1);
    degree.set(b, (degree.get(b) ?? 0) + 1);
  }
  return pairs.map(([a, b]) => {
    const da = degree.get(a)!;
    const db = degree.get(b)!;
    if (Math.max(da, db) >= 6) return 'main';
    return Math.min(da, db) >= 3 ? 'road' : 'path';
  });
}

/** Stroke width, px, of a road class. */
export const ROAD_WIDTH: Record<RoadClass, number> = { path: 2, road: 3, main: 4 };

/** The triangle that marks a road with no road back, pointing into `to` and stopping at its rim. */
export function arrowhead(from: Pt, to: Pt, pinR: number): Pt[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const tip = { x: to.x - ux * (pinR + 2), y: to.y - uy * (pinR + 2) };
  const back = { x: tip.x - ux * 10, y: tip.y - uy * 10 };
  return [tip, { x: back.x - uy * 5, y: back.y + ux * 5 }, { x: back.x + uy * 5, y: back.y - ux * 5 }];
}

/** A shut road: two pieces of road with a gap between them, and the bar that stands in the gap. */
export function shutGap(
  a: Pt,
  b: Pt,
): { pieces: [Pt, Pt][]; bar: [Pt, Pt] } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const half = Math.min(9, len / 4);
  const bar = 8;
  return {
    pieces: [
      [a, { x: mid.x - ux * half, y: mid.y - uy * half }],
      [{ x: mid.x + ux * half, y: mid.y + uy * half }, b],
    ],
    bar: [
      { x: mid.x - uy * bar, y: mid.y + ux * bar },
      { x: mid.x + uy * bar, y: mid.y - ux * bar },
    ],
  };
}
