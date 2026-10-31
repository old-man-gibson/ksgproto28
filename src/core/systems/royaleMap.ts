import { ROYALE_CACHES, ROYALE_DENS, ROYALE_FIELD, ROYALE_SECTIONS } from '../data/festival.data';

/**
 * The royale field's terrain, generated per attempt from the field's seed
 * (docs/FESTIVAL.md §9.2, after InfiniteGacha's mapgen.js): a square grid of
 * cells, each holding a section index, the village's buildings, and where
 * each cache, each den and the player's start stand. Only the seed is saved
 * (`RoyaleField.seed`); the map is rebuilt from it and kept in a small memo,
 * so every read of one field sees the same map.
 *
 * STAND-IN: the body below rasterises fixed rectangles so the field engine
 * and the map can be built against the interface. The map generator builder
 * replaces `generate` with the seeded generator; the interface stays.
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

type Rect = [number, number, number, number];

/** STAND-IN layout for a field 180 across. */
const STAND_IN: Record<string, Rect[]> = {
  cliff: [[0, 0, 180, 15]],
  waterfall: [[96, 15, 120, 33]],
  river: [
    [102, 33, 114, 75],
    [108, 75, 120, 120],
    [99, 120, 111, 180],
  ],
  bank: [
    [97, 33, 119, 75],
    [103, 75, 125, 120],
    [94, 120, 116, 180],
  ],
  cave: [[144, 15, 180, 60]],
  glade: [[33, 60, 60, 84]],
  forest: [[0, 15, 87, 117]],
  village: [[129, 93, 180, 156]],
};
const STAND_IN_BUILDINGS: RoyaleBuilding[] = [
  { id: 'smithy', kind: 'smithy', x0: 136, y0: 102, x1: 142, y1: 108 },
  { id: 'bakery', kind: 'bakery', x0: 148, y0: 128, x1: 154, y1: 134 },
  { id: 'guard_post', kind: 'guard_post', x0: 166, y0: 138, x1: 176, y1: 148 },
  { id: 'house_1', kind: 'house', x0: 154, y0: 102, x1: 160, y1: 108 },
  { id: 'house_2', kind: 'house', x0: 133, y0: 144, x1: 139, y1: 150 },
  { id: 'house_3', kind: 'house', x0: 142, y0: 118, x1: 148, y1: 124 },
];
const STAND_IN_DENS: Record<string, { x: number; y: number }> = {
  harpy_nest: { x: 45, y: 7 },
  serpent_pool: { x: 108, y: 25 },
  wolf_den: { x: 21, y: 36 },
  bear_cave: { x: 165, y: 36 },
  hound_yard: { x: 168, y: 132 },
};

function generate(seed: number): RoyaleMap {
  const size = ROYALE_FIELD.size;
  const cells = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      const i = SECTION_IDS.findIndex((id) =>
        (STAND_IN[id] ?? []).some(([x0, y0, x1, y1]) => cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1),
      );
      cells[y * size + x] = i + 1;
    }
  }
  const dens = { ...STAND_IN_DENS };
  const caches: Record<string, { x: number; y: number }> = {};
  const used = new Set<string>();
  for (const c of ROYALE_CACHES) {
    if (c.building) {
      const b = STAND_IN_BUILDINGS.find((bb) => bb.kind === c.building && !used.has(bb.id));
      if (b) {
        used.add(b.id);
        caches[c.id] = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
        continue;
      }
    }
    const den = c.den ? dens[c.den] : undefined;
    if (den) caches[c.id] = { x: den.x + 3, y: den.y - 3 };
    else if (c.section === 'bank') caches[c.id] = { x: 96, y: 142 };
  }
  // Every den and cache has a place even if the stand-in forgot one.
  for (const d of ROYALE_DENS) dens[d.id] ??= { x: size / 2, y: size / 2 };
  for (const c of ROYALE_CACHES) caches[c.id] ??= { x: size / 2, y: size / 2 };
  return { seed, size, cells, buildings: STAND_IN_BUILDINGS, caches, dens, start: { x: 90, y: size - 2 } };
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
