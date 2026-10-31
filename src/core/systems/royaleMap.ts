import { ROYALE_CACHES, ROYALE_DENS, ROYALE_FIELD, ROYALE_SECTIONS } from '../data/festival.data';
import type { RoyaleCacheDef, RoyaleDenDef } from '../types';

/**
 * The royale field's terrain, generated per attempt from the field's seed
 * (docs/FESTIVAL.md §9.2, after InfiniteGacha's mapgen.js): a square grid of
 * cells, each holding a section index, the village's buildings, and where
 * each cache, each den and the player's start stand. Only the seed is saved
 * (`RoyaleField.seed`); the map is rebuilt from it and kept in a small memo,
 * so every read of one field sees the same map.
 *
 * One seeded random source (mulberry32, never the game state's rng) drives the
 * whole build, so a seed always builds the identical map. Every cell stays
 * walkable: a section changes pace and sight and nothing else. y = 0 is the far
 * edge, the player enters at the near edge (high y). The rules, for a field
 * 180 across:
 *   - cliff: a ridge along the far edge, 8 to 18 deep, uneven;
 *   - waterfall: a fan under the cliff, centred in the middle third;
 *   - river: a random walk from the waterfall to the near edge, 5 to 8 wide,
 *     drifting sideways inside the middle of the field;
 *   - bank: every cell within 3 of the river;
 *   - forest: a cellular blob over most of the west half, west of the river;
 *   - glade: a round clearing, radius 8 to 12, inside the forest;
 *   - cave: a cellular blob in the far east corner, under the cliff;
 *   - village: a rounded patch in the east half, clear of the river, holding
 *     non-overlapping buildings of the kinds the village caches ask for
 *     (RoyaleCacheDef.building, counted from the cache list at generation
 *     time) plus a few spare houses; the patch grows with the demand;
 *   - meadow: everything else.
 * Then the start (near edge, meadow, away from the water), the dens (inside
 * their section, away from the edge, 30 or more from the start, apart from
 * each other), and the caches (a village cache at the centre of a building of
 * its kind, a guarded cache inside its den's radius, the rest inside their
 * section and outside every building). Any number of caches seat: each keeps
 * 6 from every other and 15 from the start. A den that guards a building's
 * cache sits on that building, and guards that one cache only (a second
 * building cache naming the same den stands in its own building).
 *
 * Each step that can fail (no room for a building, no site for a den) throws
 * back to the start of the build, which retries on the same random stream; the
 * last try keeps what it has, so `royaleMap` always returns a map.
 *
 * Any change to `generate` (a rule, a dial, the order of a random draw)
 * rebuilds a different map from a saved seed: raise ROYALE_LAYOUT_VERSION in
 * festival.data.ts in the same commit.
 */

/** One building in the village, in field units (edges included). */
export interface RoyaleBuilding {
  id: string;
  /** smithy, bakery, guard_post or house: what a village cache asks for (RoyaleCacheDef.building). */
  kind: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface RoyaleMap {
  seed: number;
  /** Cells across and down; one cell is one field unit. */
  size: number;
  /**
   * Section per cell, row-major (`y * size + x`): 0 is open meadow, i + 1 is
   * the i-th entry of ROYALE_SECTIONS in declaration order.
   */
  cells: Uint8Array;
  buildings: RoyaleBuilding[];
  /** Where each ROYALE_CACHES entry stands, by id. */
  caches: Record<string, { x: number; y: number }>;
  /** Where each ROYALE_DENS entry stands, by id. */
  dens: Record<string, { x: number; y: number }>;
  /** Where the player walks onto the field: the near edge (high y). */
  start: { x: number; y: number };
}

/** Section ids in cell-index order: SECTION_IDS[i] is stored as i + 1. */
export const SECTION_IDS: string[] = Object.keys(ROYALE_SECTIONS);

/** The section id stored in a cell value, or undefined for meadow. */
export function sectionIdOf(cell: number): string | undefined {
  return cell > 0 ? SECTION_IDS[cell - 1] : undefined;
}

// ---------- Dials (tuned for a field 180 across) ----------

const SIZE = ROYALE_FIELD.size;
const TAU = Math.PI * 2;

type Range = [number, number];
type Site = { x: number; y: number };

/** Cliff depth along the far edge, in cells. */
const CLIFF_DEPTH: Range = [8, 18];
/** The waterfall's centre x (the middle third is 60 to 120), half width, and drop below the cliff at its middle. */
const WATERFALL_X: Range = [64, 100];
const WATERFALL_HALF: Range = [9, 12];
const WATERFALL_DROP: Range = [12, 15];
const RIVER_WIDTH: Range = [5, 8];
/** Where the river's centre may drift: west of 102, so the east stays wide enough for a large village. */
const RIVER_X: Range = [62, 102];
const BANK_REACH = 3;
/** The forest's east edge by row, its south edge by column, and the rows and cells it keeps clear of the water. */
const FOREST_EAST: Range = [84, 98];
const FOREST_SOUTH: Range = [125, 150];
const FOREST_GAP = 4;
const GLADE_RADIUS: Range = [8, 12];
/** The cave's radii; it sits in the far east corner under the cliff. */
const CAVE_RADIUS: Range = [18, 24];
/**
 * The village's radii for the smallest demand, how far they may grow when the
 * caches ask for more buildings (the patch is sized from the demand), its
 * centre's least x, the rows it may span, and the clearance from the water.
 */
const VILLAGE_RX: Range = [16, 20];
const VILLAGE_RY: Range = [14, 18];
const VILLAGE_MAX_RX = 32;
const VILLAGE_MAX_RY = 26;
const VILLAGE_MIN_X = 108;
const VILLAGE_ROWS: Range = [62, 140];
const VILLAGE_GAP = 6;
/** Share of the patch the buildings and the open-air caches may fill, for sizing it. */
const VILLAGE_FILL = 0.45;
/** Cells of open ground each village cache without a building takes. */
const VILLAGE_YARD = 40;
/** Width and height of each kind of building, in field units: [min w, max w, min h, max h]. */
const BUILDING_SIZE: Record<string, [number, number, number, number]> = {
  guard_post: [8, 9, 7, 8],
  smithy: [6, 7, 5, 6],
  bakery: [5, 6, 5, 6],
  house: [4, 5, 4, 5],
};
const BUILDING_DEFAULT: [number, number, number, number] = [5, 6, 5, 6];
/** Houses added beyond what the caches ask for, and the fewest buildings a village has. */
const EXTRA_HOUSES: Range = [2, 4];
const MIN_BUILDINGS = 6;
/** Empty cells kept between two buildings. */
const BUILDING_GAP = 1;
/** The start stands this far from any river or bank cell. */
const START_WATER = 12;
/** A den's centre is this far from the start, and from the field's edge by its radius plus the margin. */
const DEN_START = 31;
const DEN_EDGE = 2;
const DEN_GAP = 3;
/**
 * A cache keeps this far from every other cache (two caches guarded by one den
 * keep the smaller of this and the den's radius), and a free one keeps this far
 * from the edge, from the start, and from a den's radius.
 */
const CACHE_SPACING = 6;
const CACHE_EDGE = 6;
const CACHE_START = 15;
const CACHE_DEN = 3;

/**
 * The fewest cells each section may have in a built map. Sized well under
 * what the rules produce, so it catches a broken blob and never a normal map.
 */
export const SECTION_MIN_CELLS: Record<string, number> = {
  cliff: 1200,
  waterfall: 120,
  river: 500,
  bank: 400,
  cave: 300,
  glade: 150,
  forest: 2500,
  village: 400,
};

const sectionIndex = (id: string): number => SECTION_IDS.indexOf(id) + 1;
const CLIFF = sectionIndex('cliff');
const WATERFALL = sectionIndex('waterfall');
const RIVER = sectionIndex('river');
const BANK = sectionIndex('bank');
const CAVE = sectionIndex('cave');
const GLADE = sectionIndex('glade');
const FOREST = sectionIndex('forest');
const VILLAGE = sectionIndex('village');

// ---------- Random source and shapes ----------

type Rng = () => number;

/** mulberry32, started from a hash of the seed so neighbouring seeds share nothing. */
function rngOf(seed: number): Rng {
  let h = (seed >>> 0) ^ Math.imul(Math.floor(seed / 4294967296) >>> 0, 0x9e3779b1);
  h ^= Math.floor(Math.abs(seed % 1) * 4294967296);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** `n` values in [0, 1], smooth over about `step` cells, stretched to touch both ends. */
function smoothLine(rand: Rng, n: number, step: number): number[] {
  const knots = Array.from({ length: Math.ceil(n / step) + 2 }, () => rand());
  const out: number[] = [];
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    const t = i / step;
    const k = Math.floor(t);
    const f = t - k;
    const s = f * f * (3 - 2 * f);
    const v = knots[k] * (1 - s) + knots[k + 1] * s;
    out.push(v);
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return out.map((v) => (hi > lo ? (v - lo) / (hi - lo) : 0.5));
}

/** A closed outline: the radius scale at an angle, within 1 +- `amp`. */
function outline(rand: Rng, amp: number): (angle: number) => number {
  const phase = [rand() * TAU, rand() * TAU, rand() * TAU];
  const weight = [rand(), rand(), rand()];
  const total = weight[0] + weight[1] + weight[2] || 1;
  return (a) => 1 + (amp * (weight[0] * Math.sin(2 * a + phase[0]) + weight[1] * Math.sin(3 * a + phase[1]) + weight[2] * Math.sin(5 * a + phase[2]))) / total;
}

/** A cell centre is inside an elliptical blob whose edge follows `shape`. */
function inBlob(shape: (angle: number) => number, cx: number, cy: number, rx: number, ry: number, x: number, y: number): boolean {
  const dx = (x + 0.5 - cx) / rx;
  const dy = (y + 0.5 - cy) / ry;
  const d = Math.hypot(dx, dy);
  return d === 0 || d <= shape(Math.atan2(dy, dx));
}

// ---------- Cellular regions ----------

/** A box of cells with a flag each: the working area of a cellular pass. */
interface Mask {
  x0: number;
  y0: number;
  w: number;
  h: number;
  a: Uint8Array;
}

const maskHas = (m: Mask, x: number, y: number): boolean =>
  x >= m.x0 && y >= m.y0 && x < m.x0 + m.w && y < m.y0 + m.h && m.a[(y - m.y0) * m.w + (x - m.x0)] === 1;

/** Connected runs (four ways) of cells holding `value`, as lists of indices. */
function regions(a: Uint8Array, w: number, h: number, value: number): number[][] {
  const seen = new Uint8Array(w * h);
  const out: number[][] = [];
  const stack: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || a[s] !== value) continue;
    const run: number[] = [];
    seen[s] = 1;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop()!;
      run.push(i);
      const x = i % w;
      const y = (i - x) / w;
      if (x > 0 && !seen[i - 1] && a[i - 1] === value) { seen[i - 1] = 1; stack.push(i - 1); }
      if (x < w - 1 && !seen[i + 1] && a[i + 1] === value) { seen[i + 1] = 1; stack.push(i + 1); }
      if (y > 0 && !seen[i - w] && a[i - w] === value) { seen[i - w] = 1; stack.push(i - w); }
      if (y < h - 1 && !seen[i + w] && a[i + w] === value) { seen[i + w] = 1; stack.push(i + w); }
    }
    out.push(run);
  }
  return out;
}

/**
 * A cellular blob in the box (x0, y0, w, h): each cell starts live with the
 * probability `density` gives for it, then `passes` rounds of "live when five
 * of the nine cells around it, itself included, are live". A margin of cells
 * around the box copies the nearest edge cell's density, so a blob meant to run
 * to the field's edge is not eaten away there. Land under `minLand` cells is
 * dropped and meadow holes under `minHole` are filled; `largestOnly` keeps one
 * piece.
 */
function organic(
  rand: Rng,
  box: { x0: number; y0: number; w: number; h: number },
  density: (x: number, y: number) => number,
  passes: number,
  tidy: { minLand: number; minHole: number; largestOnly?: boolean },
): Mask {
  const pad = 4;
  const gw = box.w + pad * 2;
  const gh = box.h + pad * 2;
  let src = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const x = clamp(box.x0 + gx - pad, box.x0, box.x0 + box.w - 1);
      const y = clamp(box.y0 + gy - pad, box.y0, box.y0 + box.h - 1);
      src[gy * gw + gx] = rand() < density(x, y) ? 1 : 0;
    }
  }
  let dst = new Uint8Array(gw * gh);
  for (let p = 0; p < passes; p++) {
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = gy + dy;
          if (yy < 0 || yy >= gh) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = gx + dx;
            if (xx >= 0 && xx < gw) n += src[yy * gw + xx];
          }
        }
        dst[gy * gw + gx] = n >= 5 ? 1 : 0;
      }
    }
    [src, dst] = [dst, src];
  }
  const a = new Uint8Array(box.w * box.h);
  for (let y = 0; y < box.h; y++) a.set(src.subarray((y + pad) * gw + pad, (y + pad) * gw + pad + box.w), y * box.w);
  const land = regions(a, box.w, box.h, 1);
  const keep = tidy.largestOnly ? land.reduce((best, r) => (r.length > best.length ? r : best), [] as number[]) : null;
  for (const run of land) if (run.length < tidy.minLand || (keep && run !== keep)) for (const i of run) a[i] = 0;
  for (const run of regions(a, box.w, box.h, 0)) if (run.length < tidy.minHole) for (const i of run) a[i] = 1;
  return { ...box, a };
}

// ---------- The build ----------

/** Thrown by a step with no room; the build starts over on the same random stream. */
const RETRY = { retry: true };

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The two rectangles, widened by `gap` cells, share a cell. Edges count: a rectangle covers cells x0 to x1. */
const crowds = (a: Rect, b: Rect, gap: number): boolean =>
  a.x0 - gap <= b.x1 && b.x0 - gap <= a.x1 && a.y0 - gap <= b.y1 && b.y0 - gap <= a.y1;

function build(seed: number, rand: Rng, strict: boolean, defs: RoyaleCacheDef[]): RoyaleMap {
  /** A step that cannot be skipped: strict builds start over when it fails, the last build goes on without. */
  const need = (ok: boolean): boolean => {
    if (!ok && strict) throw RETRY;
    return ok;
  };
  const int = (lo: number, hi: number): number => lo + Math.floor(rand() * (hi - lo + 1));
  const within = (r: Range): number => int(r[0], r[1]);
  const cells = new Uint8Array(SIZE * SIZE);
  const inField = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
  const cellAt = (x: number, y: number): number => (inField(Math.floor(x), Math.floor(y)) ? cells[Math.floor(y) * SIZE + Math.floor(x)] : -1);
  /** Paints a cell only while it is still open meadow: the section painted first wins. */
  const put = (x: number, y: number, section: number): void => {
    if (inField(x, y) && cells[y * SIZE + x] === 0) cells[y * SIZE + x] = section;
  };

  // Cliff: a ridge along the far edge.
  const depth = smoothLine(rand, SIZE, 14).map((v) => {
    let d = CLIFF_DEPTH[0] + Math.round(v * (CLIFF_DEPTH[1] - CLIFF_DEPTH[0]));
    if (rand() < 0.25) d += rand() < 0.5 ? -1 : 1;
    return clamp(d, CLIFF_DEPTH[0], CLIFF_DEPTH[1]);
  });
  for (let x = 0; x < SIZE; x++) for (let y = 0; y < depth[x]; y++) put(x, y, CLIFF);

  // Waterfall: a fan hanging under the cliff, deepest at its middle.
  const wx = within(WATERFALL_X);
  const half = within(WATERFALL_HALF);
  const drop = within(WATERFALL_DROP);
  const lip = smoothLine(rand, half * 2 + 1, 6);
  for (let x = wx - half; x <= wx + half; x++) {
    const u = (x - wx) / (half + 0.5);
    const reach = drop * Math.sqrt(Math.max(0, 1 - u * u)) * (0.85 + 0.3 * lip[x - (wx - half)]);
    for (let y = depth[x]; y < depth[x] + reach; y++) put(x, y, WATERFALL);
  }

  // River: a random walk from the middle of the waterfall to the near edge.
  const riverL = new Int16Array(SIZE).fill(-1);
  const riverR = new Int16Array(SIZE).fill(-1);
  const head = depth[wx] + Math.round(drop * 0.5);
  let cx = wx;
  let drift = 0;
  let width = within(RIVER_WIDTH);
  for (let y = head; y < SIZE; y++) {
    drift = drift * 0.92 + (rand() - 0.5) * 0.6;
    if (cx < RIVER_X[0] + 4) drift += 0.08;
    if (cx > RIVER_X[1] - 4) drift -= 0.08;
    drift = clamp(drift, -0.8, 0.8);
    cx = clamp(cx + drift, RIVER_X[0], RIVER_X[1]);
    if (rand() < 0.12) width = clamp(width + (rand() < 0.5 ? -1 : 1), RIVER_WIDTH[0], RIVER_WIDTH[1]);
    riverL[y] = Math.round(cx - width / 2);
    riverR[y] = riverL[y] + width - 1;
    for (let x = riverL[y]; x <= riverR[y]; x++) put(x, y, RIVER);
  }
  // Bank: every cell within BANK_REACH of a river cell.
  for (let y = head; y < SIZE; y++) {
    for (let dy = -BANK_REACH; dy <= BANK_REACH; dy++) {
      const reach = Math.floor(Math.sqrt(BANK_REACH * BANK_REACH - dy * dy));
      for (let x = riverL[y] - reach; x <= riverR[y] + reach; x++) put(x, y + dy, BANK);
    }
  }

  // The water's extent per row, for the forest and the village to keep clear of.
  const waterL = new Int16Array(SIZE).fill(SIZE);
  const waterR = new Int16Array(SIZE).fill(-1);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = cells[y * SIZE + x];
      if (c !== WATERFALL && c !== RIVER && c !== BANK) continue;
      waterL[y] = Math.min(waterL[y], x);
      waterR[y] = Math.max(waterR[y], x);
    }
  }
  const waterWest = (y: number, rows: number): number => {
    let v = SIZE;
    for (let yy = Math.max(0, y - rows); yy <= Math.min(SIZE - 1, y + rows); yy++) v = Math.min(v, waterL[yy]);
    return v;
  };
  /** The east-most water cell within VILLAGE_GAP rows of each row, -1 where there is none. */
  const waterEastBy = Array.from({ length: SIZE }, (_, y) => {
    let v = -1;
    for (let yy = Math.max(0, y - VILLAGE_GAP); yy <= Math.min(SIZE - 1, y + VILLAGE_GAP); yy++) v = Math.max(v, waterR[yy]);
    return v;
  });

  // Forest: a cellular blob over the west half, west of the water.
  const eastLine = smoothLine(rand, SIZE, 20);
  const southLine = smoothLine(rand, SIZE, 18);
  const forestEdge = Array.from({ length: SIZE }, (_, y) =>
    Math.min(FOREST_EAST[0] + eastLine[y] * (FOREST_EAST[1] - FOREST_EAST[0]), waterWest(y, FOREST_GAP) - FOREST_GAP),
  );
  const forest = organic(
    rand,
    { x0: 0, y0: 0, w: FOREST_EAST[1] + 2, h: FOREST_SOUTH[1] + 2 },
    (x, y) => (x <= forestEdge[y] && y < FOREST_SOUTH[0] + southLine[x] * (FOREST_SOUTH[1] - FOREST_SOUTH[0]) ? 0.64 : 0),
    5,
    { minLand: 150, minHole: 60 },
  );

  // Glade: a round clearing where the most forest surrounds it.
  const gr = within(GLADE_RADIUS);
  const shape = outline(rand, 0.05);
  const ringShare = (gx: number, gy: number): number => {
    let hit = 0;
    let n = 0;
    for (const k of [0.5, 1, 1.4]) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        n++;
        if (maskHas(forest, Math.floor(gx + Math.cos(a) * (gr + 4) * k), Math.floor(gy + Math.sin(a) * (gr + 4) * k))) hit++;
      }
    }
    return hit / n;
  };
  let gladeAt: Site = { x: 40, y: 70 };
  let gladeShare = -1;
  for (let t = 0; t < 80; t++) {
    const c = { x: int(gr + 6, 70), y: int(36, 110) };
    const share = ringShare(c.x, c.y) + rand() * 0.05;
    if (share > gladeShare) {
      gladeShare = share;
      gladeAt = c;
    }
  }
  need(gladeShare > 0.8);
  for (let y = gladeAt.y - gr - 2; y <= gladeAt.y + gr + 2; y++) {
    for (let x = gladeAt.x - gr - 2; x <= gladeAt.x + gr + 2; x++) if (inBlob(shape, gladeAt.x + 0.5, gladeAt.y + 0.5, gr, gr, x, y)) put(x, y, GLADE);
  }
  for (let y = 0; y < forest.h; y++) for (let x = 0; x < forest.w; x++) if (forest.a[y * forest.w + x]) put(forest.x0 + x, forest.y0 + y, FOREST);

  // Cave: a blob in the far east corner under the cliff.
  const crx = within(CAVE_RADIUS);
  const cry = within(CAVE_RADIUS);
  const caveX = SIZE - crx - int(2, 6);
  const caveY = CLIFF_DEPTH[0] + cry - int(0, 4);
  const cave = organic(
    rand,
    { x0: Math.max(0, caveX - crx - 1), y0: Math.max(0, caveY - cry - 1), w: Math.min(SIZE, caveX + crx + 2) - Math.max(0, caveX - crx - 1), h: Math.min(SIZE, caveY + cry + 2) - Math.max(0, caveY - cry - 1) },
    (x, y) => {
      const d = Math.hypot((x + 0.5 - caveX) / crx, (y + 0.5 - caveY) / cry);
      return d >= 1 ? 0 : 0.9 - 0.45 * d * d * d;
    },
    4,
    { minLand: 0, minHole: 300, largestOnly: true },
  );
  for (let y = 0; y < cave.h; y++) for (let x = 0; x < cave.w; x++) if (cave.a[y * cave.w + x]) put(cave.x0 + x, cave.y0 + y, CAVE);

  // Village: a rounded patch in the east half, clear of the water, sized from the buildings the caches ask for.
  const wanted: Record<string, number> = {};
  for (const c of defs) if (c.building) wanted[c.building] = (wanted[c.building] ?? 0) + 1;
  const asked = Object.values(wanted).reduce((a, b) => a + b, 0);
  const spare = Math.max(within(EXTRA_HOUSES), MIN_BUILDINGS - asked);
  const sizeOf = (kind: string): [number, number, number, number] => BUILDING_SIZE[kind] ?? BUILDING_DEFAULT;
  // The asked-for buildings, largest first, then the spare houses (which may be left out when they find no room).
  const order: { kind: string; spare: boolean }[] = [];
  for (const kind of Object.keys(wanted).sort((a, b) => sizeOf(b)[1] - sizeOf(a)[1])) for (let n = 0; n < wanted[kind]; n++) order.push({ kind, spare: false });
  for (let n = 0; n < spare; n++) order.push({ kind: 'house', spare: true });
  const total: Record<string, number> = {};
  for (const o of order) total[o.kind] = (total[o.kind] ?? 0) + 1;
  let footprint = defs.filter((c) => c.section === 'village' && !c.building).length * VILLAGE_YARD;
  for (const o of order) {
    const [wMin, wMax, hMin, hMax] = sizeOf(o.kind);
    footprint += ((wMin + wMax) / 2 + 1 + BUILDING_GAP) * ((hMin + hMax) / 2 + 1 + BUILDING_GAP);
  }
  const mean = (r: Range): number => (r[0] + r[1]) / 2;
  const scale = Math.max(1, Math.sqrt(footprint / VILLAGE_FILL / (Math.PI * mean(VILLAGE_RX) * mean(VILLAGE_RY))));
  const vrx = Math.min(VILLAGE_MAX_RX, Math.round(within(VILLAGE_RX) * scale));
  const vry = Math.min(VILLAGE_MAX_RY, Math.round(within(VILLAGE_RY) * scale));
  const vShape = outline(rand, 0.1);
  const vReachX = Math.ceil(vrx * 1.1);
  const vReachY = Math.ceil(vry * 1.1);
  // A centre is clear when the patch's west edge, row by row, stays VILLAGE_GAP past the water.
  const clearOfWater = (cx: number, cy: number): boolean => {
    for (let y = cy - vReachY; y <= cy + vReachY; y++) {
      const u = (y - cy) / vReachY;
      if (cx - vReachX * Math.sqrt(Math.max(0, 1 - u * u)) - 1 <= waterEastBy[y] + VILLAGE_GAP) return false;
    }
    return true;
  };
  const rowLo = VILLAGE_ROWS[0] + vReachY;
  const rowHi = VILLAGE_ROWS[1] - vReachY;
  const colHi = SIZE - 3 - vReachX;
  let vcx = -1;
  let vcy = -1;
  for (let t = 0; t < 80 && vcx < 0 && rowLo <= rowHi && VILLAGE_MIN_X <= colHi; t++) {
    const cy = int(rowLo, rowHi);
    const cx = int(VILLAGE_MIN_X, colHi);
    if (clearOfWater(cx, cy)) {
      vcx = cx;
      vcy = cy;
    }
  }
  need(vcx >= 0);
  if (vcx < 0) {
    vcx = Math.max(vReachX, colHi);
    vcy = clamp(Math.floor((rowLo + rowHi) / 2), vReachY, SIZE - 1 - vReachY);
  }
  for (let y = vcy - vReachY; y <= vcy + vReachY; y++) {
    for (let x = vcx - vReachX; x <= vcx + vReachX; x++) if (inBlob(vShape, vcx + 0.5, vcy + 0.5, vrx, vry, x, y)) put(x, y, VILLAGE);
  }
  const centreOf = (b: Rect): Site => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 });
  const dist = (a: Site, b: Site): number => Math.hypot(a.x - b.x, a.y - b.y);
  const buildings: RoyaleBuilding[] = [];
  const made: Record<string, number> = {};
  for (const o of order) {
    const [wMin, wMax, hMin, hMax] = sizeOf(o.kind);
    let found: Rect | null = null;
    for (let t = 0; t < 400 && !found; t++) {
      const x0 = int(vcx - vReachX, vcx + vReachX);
      const y0 = int(vcy - vReachY, vcy + vReachY);
      const r: Rect = { x0, y0, x1: x0 + int(wMin, wMax), y1: y0 + int(hMin, hMax) };
      // Apart by BUILDING_GAP cells, and far enough that two buildings' caches keep CACHE_SPACING.
      if (buildings.some((b) => crowds(b, r, BUILDING_GAP) || dist(centreOf(b), centreOf(r)) < CACHE_SPACING)) continue;
      let onVillage = true;
      for (let y = r.y0; y <= r.y1 && onVillage; y++) for (let x = r.x0; x <= r.x1; x++) if (cellAt(x, y) !== VILLAGE) { onVillage = false; break; }
      if (onVillage) found = r;
    }
    if (!found) {
      need(o.spare);
      continue;
    }
    const n = (made[o.kind] = (made[o.kind] ?? 0) + 1);
    buildings.push({ id: total[o.kind] === 1 ? o.kind : `${o.kind}_${n}`, kind: o.kind, ...found });
  }
  need(buildings.length >= MIN_BUILDINGS);

  // Where each section's cells are, for the placements below.
  const bySection: number[][] = Array.from({ length: SECTION_IDS.length + 1 }, () => []);
  for (let i = 0; i < cells.length; i++) bySection[cells[i]].push(i);
  for (const id of SECTION_IDS) need((bySection[sectionIndex(id)]?.length ?? 0) >= (SECTION_MIN_CELLS[id] ?? 1));

  // Start: on the near edge, in meadow, well away from the water.
  const startY = SIZE - 2;
  const nearWater = (x: number): number => {
    let best = Infinity;
    for (let y = Math.max(head, startY - START_WATER - 1); y < SIZE; y++) {
      const l = riverL[y] - BANK_REACH;
      const r = riverR[y] + BANK_REACH;
      best = Math.min(best, Math.hypot(Math.max(0, l - x - 0.5, x + 0.5 - r), startY + 0.5 - (y + 0.5)));
    }
    return best;
  };
  const starts: number[] = [];
  for (let x = 8; x < SIZE - 8; x++) if (cells[startY * SIZE + x] === 0 && nearWater(x) >= START_WATER) starts.push(x);
  need(starts.length > 0);
  const start: Site = { x: (starts.length ? starts[int(0, starts.length - 1)] : SIZE / 2) + 0.5, y: startY };

  // Dens and caches.
  /** Share of sample points over a disc that lie in `section`. */
  const coverage = (section: number, c: Site, r: number): number => {
    let hit = cellAt(c.x, c.y) === section ? 1 : 0;
    let n = 1;
    for (const k of [0.5, 1]) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        n++;
        if (cellAt(c.x + Math.cos(a) * r * k, c.y + Math.sin(a) * r * k) === section) hit++;
      }
    }
    return hit / n;
  };
  const dens: Record<string, Site> = {};
  const caches: Record<string, Site> = {};
  const spent: { site: Site; r: number }[] = [];
  const denOk = (c: Site, r: number): boolean =>
    c.x >= r + DEN_EDGE && c.y >= r + DEN_EDGE && c.x <= SIZE - r - DEN_EDGE && c.y <= SIZE - r - DEN_EDGE &&
    dist(c, start) >= DEN_START && spent.every((p) => dist(c, p.site) >= r + p.r + DEN_GAP);
  /**
   * A cell of `section` that passes `ok`. With a radius, the best of a few
   * hundred tries, preferring the one whose disc lies most inside the section;
   * with none (a cache), the first that passes.
   */
  const siteIn = (section: number, r: number, ok: (c: Site) => boolean): Site | null => {
    const pool = bySection[section] ?? [];
    let best: Site | null = null;
    let bestScore = -1;
    for (let t = 0; pool.length && t < 400; t++) {
      const i = pool[int(0, pool.length - 1)];
      const c = { x: (i % SIZE) + 0.5, y: Math.floor(i / SIZE) + 0.5 };
      if (!ok(c)) continue;
      if (r === 0) return c;
      const score = coverage(section, c, r) + rand() * 0.15;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  };
  /** A place for something no rule can seat: strict builds start over, the last one takes any cell of the section. */
  const anywhere = (section: number): Site => {
    need(false);
    const i = bySection[section]?.[0] ?? (SIZE / 2) * SIZE + SIZE / 2;
    return { x: (i % SIZE) + 0.5, y: Math.floor(i / SIZE) + 0.5 };
  };
  const denDef = (id: string | undefined): RoyaleDenDef | undefined => (id ? ROYALE_DENS.find((d) => d.id === id) : undefined);
  const guardOf = new Map(defs.map((c) => [c.id, c.den]));
  /** Every placed cache keeps CACHE_SPACING from `site`; two guarded by one den keep the smaller of that and the den's radius. */
  const spaced = (site: Site, den?: RoyaleDenDef): boolean => {
    for (const id in caches) {
      if (dist(site, caches[id]) < (den && guardOf.get(id) === den.id ? Math.min(CACHE_SPACING, den.radius) : CACHE_SPACING)) return false;
    }
    return true;
  };
  const insideBuilding = (c: Site): boolean => buildings.some((b) => c.x >= b.x0 - 1 && c.x <= b.x1 + 2 && c.y >= b.y0 - 1 && c.y <= b.y1 + 2);

  // A village cache stands at the centre of a building of its kind, one cache to a building.
  const used = new Set<string>();
  for (const c of defs) {
    if (!c.building) continue;
    const pool = buildings.filter((b) => b.kind === c.building && !used.has(b.id));
    const b = pool.length ? pool[int(0, pool.length - 1)] : undefined;
    if (!b) {
      caches[c.id] = anywhere(sectionIndex(c.section));
      continue;
    }
    used.add(b.id);
    caches[c.id] = centreOf(b);
  }
  for (const d of ROYALE_DENS) {
    const section = sectionIndex(d.section);
    // A den guards at most one building's cache, the first that names it; it sits on that building.
    const anchor = defs.find((c) => c.den === d.id && c.building && caches[c.id]);
    let site: Site | null = null;
    if (anchor) {
      const around = Math.max(0, Math.min(2, d.radius - 2.5));
      const a = caches[anchor.id];
      const c = { x: Math.floor(a.x + (rand() * 2 - 1) * around) + 0.5, y: Math.floor(a.y + (rand() * 2 - 1) * around) + 0.5 };
      if (cellAt(c.x, c.y) === section && dist(c, a) < d.radius - 0.5 && denOk(c, d.radius)) site = c;
    } else {
      site = siteIn(section, d.radius, (c) => denOk(c, d.radius));
    }
    const placed = site ?? anywhere(section);
    dens[d.id] = placed;
    spent.push({ site: placed, r: d.radius });
  }
  for (const c of defs) {
    if (caches[c.id]) continue;
    const section = sectionIndex(c.section);
    const den = denDef(c.den);
    let site: Site | null = null;
    if (den) {
      // Guarded: inside the den's radius, in the cache's section, a little off the den's centre.
      const centre = dens[den.id];
      for (let t = 0; t < 300 && !site; t++) {
        const a = rand() * TAU;
        const d = den.radius * (0.2 + 0.7 * rand());
        const cand = { x: Math.floor(centre.x + Math.cos(a) * d) + 0.5, y: Math.floor(centre.y + Math.sin(a) * d) + 0.5 };
        if (cellAt(cand.x, cand.y) === section && dist(cand, centre) <= den.radius - 0.5 && spaced(cand, den)) site = cand;
      }
    } else {
      site = siteIn(
        section,
        0,
        (cand) =>
          cand.x >= CACHE_EDGE && cand.y >= CACHE_EDGE && cand.x <= SIZE - CACHE_EDGE && cand.y <= SIZE - CACHE_EDGE &&
          dist(cand, start) >= CACHE_START && spent.every((p) => dist(cand, p.site) >= p.r + CACHE_DEN) && !insideBuilding(cand) && spaced(cand),
      );
    }
    caches[c.id] = site ?? anywhere(section);
  }
  for (const d of ROYALE_DENS) dens[d.id] ??= { x: SIZE / 2, y: SIZE / 2 };

  return { seed, size: SIZE, cells, buildings, caches, dens, start };
}

const MAX_BUILDS = 12;

/**
 * The map for a seed, built fresh (the memoised read is `royaleMap`). `defs`
 * is the list of caches to seat, ROYALE_CACHES unless a test passes its own:
 * the village grows with the buildings they ask for.
 */
export function generate(seed: number, defs: RoyaleCacheDef[] = ROYALE_CACHES): RoyaleMap {
  const rand = rngOf(seed);
  for (let i = 0; i < MAX_BUILDS - 1; i++) {
    try {
      return build(seed, rand, true, defs);
    } catch (e) {
      if (e !== RETRY) throw e;
    }
  }
  return build(seed, rand, false, defs);
}

// ---------- A text view, for tests and for looking at a generator gone wrong ----------

const SECTION_GLYPH: Record<string, string> = {
  cliff: '^',
  waterfall: '=',
  river: '~',
  bank: ',',
  forest: '*',
  glade: 'o',
  cave: '%',
  village: '+',
};
const BUILDING_GLYPH = '#';

const CACHE_LETTERS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** The letter a den (capital, in ROYALE_DENS order) or a cache (lower case then digits, in ROYALE_CACHES order) shows as; ? for an id the data lacks. */
export function asciiLetter(kind: 'den' | 'cache', id: string): string {
  const i = (kind === 'den' ? ROYALE_DENS : ROYALE_CACHES).findIndex((e) => e.id === id);
  if (i < 0) return '?';
  return kind === 'den' ? String.fromCharCode(65 + (i % 26)) : CACHE_LETTERS[i % CACHE_LETTERS.length];
}

/** What each glyph of `asciiMap` means, one line each. */
export function asciiLegend(): string {
  const lines = ['. meadow', ...SECTION_IDS.map((id) => `${SECTION_GLYPH[id] ?? '?'} ${id}`), `${BUILDING_GLYPH} building`, '@ start'];
  for (const d of ROYALE_DENS) lines.push(`${asciiLetter('den', d.id)} den ${d.id}`);
  for (const c of ROYALE_CACHES) lines.push(`${asciiLetter('cache', c.id)} cache ${c.id}`);
  return lines.join('\n');
}

/**
 * The map as text, one glyph per cell: a glyph per section, `#` for a
 * building, capitals for dens, lower case for caches, `@` for the start. With
 * `scale` above 1 each glyph stands for a block of cells (the most common one).
 */
export function asciiMap(map: RoyaleMap, scale = 1): string {
  const size = map.size;
  const kinds = SECTION_IDS.length + 2;
  const building = SECTION_IDS.length + 1;
  const glyphOf = (k: number): string => (k === 0 ? '.' : k === building ? BUILDING_GLYPH : SECTION_GLYPH[SECTION_IDS[k - 1]] ?? '?');
  const rows = Math.ceil(size / scale);
  const layer = new Uint8Array(size * size);
  for (const b of map.buildings) for (let y = Math.floor(b.y0); y < b.y1; y++) for (let x = Math.floor(b.x0); x < b.x1; x++) layer[y * size + x] = 1;
  const grid: string[][] = [];
  for (let by = 0; by < rows; by++) {
    const row: string[] = [];
    for (let bx = 0; bx < rows; bx++) {
      const tally = new Array<number>(kinds).fill(0);
      for (let y = by * scale; y < Math.min(size, (by + 1) * scale); y++) {
        for (let x = bx * scale; x < Math.min(size, (bx + 1) * scale); x++) tally[layer[y * size + x] ? building : map.cells[y * size + x]]++;
      }
      row.push(glyphOf(tally.indexOf(Math.max(...tally))));
    }
    grid.push(row);
  }
  const mark = (p: { x: number; y: number }, glyph: string): void => {
    const row = grid[Math.floor(p.y / scale)];
    if (row) row[Math.floor(p.x / scale)] = glyph;
  };
  for (const [id, p] of Object.entries(map.caches)) mark(p, asciiLetter('cache', id));
  for (const [id, p] of Object.entries(map.dens)) mark(p, asciiLetter('den', id));
  mark(map.start, '@');
  return grid.map((r) => r.join('')).join('\n');
}

/** The last few maps built, by seed: a field reads its map every tick. */
const MEMO = new Map<number, RoyaleMap>();
const MEMO_SIZE = 4;

/** The map for a seed, built once and kept while it is in use. */
export function royaleMap(seed: number): RoyaleMap {
  const hit = MEMO.get(seed);
  if (hit) return hit;
  const map = generate(seed);
  MEMO.set(seed, map);
  if (MEMO.size > MEMO_SIZE) MEMO.delete(MEMO.keys().next().value!);
  return map;
}
