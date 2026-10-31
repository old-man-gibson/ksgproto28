import { describe, expect, it } from 'vitest';
import { ROYALE_CACHES, ROYALE_DENS, ROYALE_FIELD, ROYALE_SECTIONS } from '../src/core/data/festival.data';
import {
  SECTION_IDS,
  SECTION_MIN_CELLS,
  asciiLegend,
  asciiMap,
  generate,
  royaleMap,
  sectionIdOf,
  type RoyaleMap,
} from '../src/core/systems/royaleMap';
import type { RoyaleCacheDef } from '../src/core/types';

// The field's terrain generator (docs/FESTIVAL.md §9.2, §9.2a rule 5): every rule is checked on
// many seeds, since a rule that holds for ten seeds and fails for one is a live bug the day that
// seed is drawn.

const SIZE = ROYALE_FIELD.size;
const SEEDS: number[] = [
  ...Array.from({ length: 120 }, (_, i) => i),
  ...Array.from({ length: 120 }, (_, i) => ((i + 1) * 2654435761) >>> 0),
  1_700_000_000_000, // a timestamp
  -5,
  0.5,
];

const idx = (id: string): number => SECTION_IDS.indexOf(id) + 1;
const CLIFF = idx('cliff');
const WATERFALL = idx('waterfall');
const RIVER = idx('river');
const BANK = idx('bank');
const FOREST = idx('forest');
const GLADE = idx('glade');
const CAVE = idx('cave');
const VILLAGE = idx('village');

const cellAt = (m: RoyaleMap, x: number, y: number): number =>
  x >= 0 && y >= 0 && x < m.size && y < m.size ? m.cells[Math.floor(y) * m.size + Math.floor(x)] : -1;
const sectionAt = (m: RoyaleMap, p: { x: number; y: number }): string | undefined => sectionIdOf(cellAt(m, p.x, p.y));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

/** The distance from a point to the nearest cell centre holding one of `sections`, looking `reach` cells out (Infinity past that). */
function nearest(m: RoyaleMap, p: { x: number; y: number }, sections: number[], reach: number): number {
  let best = Infinity;
  for (let y = Math.max(0, Math.floor(p.y) - reach); y <= Math.min(m.size - 1, Math.floor(p.y) + reach); y++) {
    for (let x = Math.max(0, Math.floor(p.x) - reach); x <= Math.min(m.size - 1, Math.floor(p.x) + reach); x++) {
      if (sections.includes(m.cells[y * m.size + x])) best = Math.min(best, dist({ x: x + 0.5, y: y + 0.5 }, p));
    }
  }
  return best;
}

/** Every cell of a section, as [x, y]. */
function cellsOf(m: RoyaleMap, section: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < m.cells.length; i++) if (m.cells[i] === section) out.push([i % m.size, Math.floor(i / m.size)]);
  return out;
}

/** The row holds a cell of the section. */
function cellsRowHas(m: RoyaleMap, y: number, section: number): boolean {
  for (let x = 0; x < m.size; x++) if (m.cells[y * m.size + x] === section) return true;
  return false;
}

const centroid = (cells: [number, number][]): { x: number; y: number } => ({
  x: cells.reduce((a, c) => a + c[0] + 0.5, 0) / cells.length,
  y: cells.reduce((a, c) => a + c[1] + 0.5, 0) / cells.length,
});

/** A point stands in a building: the rectangle from (x0, y0) to (x1, y1), edges included. */
const inside = (b: { x0: number; y0: number; x1: number; y1: number }, p: { x: number; y: number }): boolean =>
  p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;

/** The most violations kept per check, so a broken rule prints a readable list. */
function report(found: string[]): string[] {
  return found.slice(0, 8);
}

// ---------- Cache lists ----------

/** Each entry `times` over, the copies under new ids. A copy of a building cache drops its den: a den guards one building's cache. */
function inflate(defs: RoyaleCacheDef[], times: number): RoyaleCacheDef[] {
  return defs.flatMap((c) => Array.from({ length: times }, (_, k) => (k === 0 ? c : { ...c, id: `${c.id}~${k}`, den: c.building ? undefined : c.den })));
}

/** The data's caches plus three free ones in every section (meadow too), six more houses and two village yards. */
function crowd(defs: RoyaleCacheDef[]): RoyaleCacheDef[] {
  const extra: RoyaleCacheDef[] = [];
  for (const section of ['meadow', ...SECTION_IDS]) {
    for (let n = 1; n <= 3; n++) extra.push({ id: `extra_${section}_${n}`, name: 'Extra', icon: '?', section, heal: 0.1 });
  }
  for (let n = 1; n <= 6; n++) extra.push({ id: `extra_house_${n}`, name: 'Extra House', icon: '?', section: 'village', building: 'house', heal: 0.1 });
  for (let n = 1; n <= 2; n++) extra.push({ id: `extra_yard_${n}`, name: 'Extra Yard', icon: '?', section: 'village', heal: 0.1 });
  return [...defs, ...extra];
}

// ---------- Placement rules, checked on any cache list ----------

/** Everything a map must satisfy about where things stand, for the caches it was built for. */
function placementProblems(m: RoyaleMap, defs: RoyaleCacheDef[]): string[] {
  const found: string[] = [];
  const tag = `seed ${m.seed}`;

  // The buildings: enough of each kind, apart, on village cells.
  const demand: Record<string, number> = {};
  for (const c of defs) if (c.building) demand[c.building] = (demand[c.building] ?? 0) + 1;
  for (const [kind, n] of Object.entries(demand)) {
    const have = m.buildings.filter((b) => b.kind === kind).length;
    if (have < n) found.push(`${tag}: ${have} ${kind} buildings for ${n} caches`);
  }
  if (m.buildings.length < 6) found.push(`${tag}: only ${m.buildings.length} buildings`);
  if (new Set(m.buildings.map((b) => b.id)).size !== m.buildings.length) found.push(`${tag}: duplicate building ids`);
  m.buildings.forEach((a, i) => {
    if (a.x0 >= a.x1 || a.y0 >= a.y1) found.push(`${tag}: ${a.id} is empty`);
    for (let y = a.y0; y <= a.y1; y++) {
      for (let x = a.x0; x <= a.x1; x++) {
        if (cellAt(m, x, y) !== VILLAGE) {
          found.push(`${tag}: ${a.id} stands off the village at ${x},${y}`);
          return;
        }
      }
    }
    for (const b of m.buildings.slice(i + 1)) {
      if (a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1) found.push(`${tag}: ${a.id} and ${b.id} overlap`);
    }
  });

  // The start: near edge, meadow, clear of the water and of every den.
  const s = m.start;
  if (s.y !== m.size - 2) found.push(`${tag}: start at y ${s.y}`);
  if (cellAt(m, s.x, s.y) !== 0) found.push(`${tag}: start in ${sectionAt(m, s)}`);
  if (nearest(m, s, [RIVER, BANK], 12) < 10) found.push(`${tag}: start ${nearest(m, s, [RIVER, BANK], 12).toFixed(1)} from the river`);

  // The dens: in their section, off the edge, far from the start, apart.
  for (const d of ROYALE_DENS) {
    const p = m.dens[d.id];
    if (!p) {
      found.push(`${tag}: no place for ${d.id}`);
      continue;
    }
    if (sectionAt(m, p) !== d.section) found.push(`${tag}: ${d.id} in ${sectionAt(m, p) ?? 'meadow'}, not ${d.section}`);
    if (p.x < d.radius || p.y < d.radius || p.x > m.size - d.radius || p.y > m.size - d.radius) found.push(`${tag}: ${d.id} at the edge`);
    if (dist(p, s) < 30) found.push(`${tag}: ${d.id} ${dist(p, s).toFixed(1)} from the start`);
    if (dist(p, s) < d.radius + 10) found.push(`${tag}: start inside ${d.id}'s radius plus margin`);
    for (const o of ROYALE_DENS) if (o.id < d.id && m.dens[o.id] && dist(p, m.dens[o.id]) < d.radius + o.radius) found.push(`${tag}: ${d.id} and ${o.id} overlap`);
  }

  // The caches: in their section, in a building of their kind, inside their den, apart.
  const spoken = new Set<string>();
  const guardedBuilding = new Set<string>();
  for (const c of defs) {
    const p = m.caches[c.id];
    if (!p) {
      found.push(`${tag}: no place for ${c.id}`);
      continue;
    }
    const section = sectionAt(m, p) ?? 'meadow';
    if (section !== c.section) found.push(`${tag}: ${c.id} in ${section}, not ${c.section}`);
    if (dist(p, s) < 15) found.push(`${tag}: ${c.id} ${dist(p, s).toFixed(1)} from the start`);
    if (c.building) {
      const b = m.buildings.find((bb) => bb.kind === c.building && inside(bb, p));
      if (!b) found.push(`${tag}: ${c.id} is in no ${c.building}`);
      else if (spoken.has(b.id)) found.push(`${tag}: two caches in ${b.id}`);
      else {
        spoken.add(b.id);
        if (Math.abs(p.x - (b.x0 + b.x1) / 2) > 0.01 || Math.abs(p.y - (b.y0 + b.y1) / 2) > 0.01) found.push(`${tag}: ${c.id} is off the centre of ${b.id}`);
      }
    } else if (m.buildings.some((b) => inside(b, p))) {
      found.push(`${tag}: ${c.id} has no building kind but stands in one`);
    }
    // A den guards one building's cache; later building caches that name it stand in their buildings.
    const den = c.den ? ROYALE_DENS.find((d) => d.id === c.den) : undefined;
    const exempt = !!c.building && guardedBuilding.has(c.den ?? '');
    if (c.building && c.den) guardedBuilding.add(c.den);
    if (den && !exempt && dist(p, m.dens[den.id]) > den.radius) found.push(`${tag}: ${c.id} is ${dist(p, m.dens[den.id]).toFixed(1)} from ${den.id}, radius ${den.radius}`);
    if (den && sectionAt(m, m.dens[den.id]) !== c.section) found.push(`${tag}: ${c.id} guarded from another section`);
  }
  for (let i = 0; i < defs.length; i++) {
    for (let j = i + 1; j < defs.length; j++) {
      const a = defs[i];
      const b = defs[j];
      if (!m.caches[a.id] || !m.caches[b.id]) continue;
      const sameDen = a.den && a.den === b.den;
      const need = sameDen ? Math.min(6, ROYALE_DENS.find((d) => d.id === a.den)?.radius ?? 6) : 6;
      if (dist(m.caches[a.id], m.caches[b.id]) < need - 1e-9) found.push(`${tag}: ${a.id} and ${b.id} are ${dist(m.caches[a.id], m.caches[b.id]).toFixed(1)} apart`);
    }
  }
  return found;
}

// ---------- The maps ----------

const timed = SEEDS.map((seed) => {
  const t0 = performance.now();
  const map = generate(seed);
  return { seed, map, ms: performance.now() - t0 };
});
const maps = timed.map((t) => t.map);

describe('royale map generator: determinism', () => {
  it('builds the identical map for the same seed', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const a = generate(seed);
      const b = generate(seed);
      expect(Buffer.compare(Buffer.from(a.cells), Buffer.from(b.cells))).toBe(0);
      expect(JSON.stringify([a.buildings, a.caches, a.dens, a.start])).toBe(JSON.stringify([b.buildings, b.caches, b.dens, b.start]));
    }
  });

  it('is not affected by the order the maps are built in', () => {
    const solo = generate(77);
    for (const seed of [1, 2, 3, 4, 5, 6]) generate(seed);
    const again = generate(77);
    expect(Buffer.compare(Buffer.from(solo.cells), Buffer.from(again.cells))).toBe(0);
    expect(JSON.stringify(solo.caches)).toBe(JSON.stringify(again.caches));
  });

  it('the memoised read returns one map per seed, equal to a fresh build', () => {
    const memo = royaleMap(31);
    expect(royaleMap(31)).toBe(memo);
    for (const seed of [90, 91, 92, 93, 94]) royaleMap(seed);
    const rebuilt = royaleMap(31);
    expect(Buffer.compare(Buffer.from(rebuilt.cells), Buffer.from(memo.cells))).toBe(0);
    expect(rebuilt.start).toEqual(memo.start);
  });

  it('different seeds build different maps', () => {
    const seen = new Set(maps.map((m) => Buffer.from(m.cells).toString('base64')));
    expect(seen.size).toBe(maps.length);
    expect(new Set(maps.map((m) => m.start.x)).size).toBeGreaterThan(20);
  });

  it('builds a map for a seed of any shape', () => {
    for (const seed of [NaN, Infinity, -Infinity, 2 ** 53, -(2 ** 40), 1e-9]) {
      const m = generate(seed);
      expect(placementProblems(m, ROYALE_CACHES)).toEqual([]);
    }
  });
});

describe('royale map generator: sections', () => {
  it('is 180 across and holds only known sections, all walkable by pace', () => {
    expect(SIZE).toBe(180);
    for (const m of maps) {
      expect(m.size).toBe(SIZE);
      expect(m.cells.length).toBe(SIZE * SIZE);
      expect(Math.max(...m.cells)).toBeLessThanOrEqual(SECTION_IDS.length);
    }
    for (const id of SECTION_IDS) {
      expect(ROYALE_SECTIONS[id].pace, `${id} pace`).toBeGreaterThan(0);
      expect(ROYALE_SECTIONS[id].sight, `${id} sight`).toBeGreaterThan(0);
    }
  });

  it('has every section, each with a sane number of cells', () => {
    const found: string[] = [];
    for (const id of SECTION_IDS) if (!(SECTION_MIN_CELLS[id] > 0)) found.push(`no minimum for ${id}`);
    for (const m of maps) {
      const count = new Array<number>(SECTION_IDS.length + 1).fill(0);
      for (const c of m.cells) count[c]++;
      SECTION_IDS.forEach((id, i) => {
        if (count[i + 1] < SECTION_MIN_CELLS[id]) found.push(`seed ${m.seed}: ${id} has ${count[i + 1]} cells`);
        if (count[i + 1] > SIZE * SIZE * 0.5) found.push(`seed ${m.seed}: ${id} has ${count[i + 1]} cells`);
      });
      if (count[0] < 5000) found.push(`seed ${m.seed}: meadow has ${count[0]} cells`);
    }
    expect(report(found)).toEqual([]);
  });

  it('puts the cliff along the far edge, 8 to 18 deep and uneven', () => {
    const found: string[] = [];
    for (const m of maps) {
      let lo = Infinity;
      let hi = 0;
      for (let x = 0; x < SIZE; x++) {
        let d = 0;
        while (d < SIZE && m.cells[d * SIZE + x] === CLIFF) d++;
        for (let y = d; y < SIZE; y++) if (m.cells[y * SIZE + x] === CLIFF) found.push(`seed ${m.seed}: cliff cell below the ridge at ${x},${y}`);
        lo = Math.min(lo, d);
        hi = Math.max(hi, d);
      }
      if (lo < 8 || hi > 18) found.push(`seed ${m.seed}: cliff depth ${lo} to ${hi}`);
      if (hi - lo < 4) found.push(`seed ${m.seed}: cliff depth ${lo} to ${hi} is even`);
    }
    expect(report(found)).toEqual([]);
  });

  it('hangs the waterfall under the cliff in the middle third', () => {
    const found: string[] = [];
    for (const m of maps) {
      const cells = cellsOf(m, WATERFALL);
      const xs = cells.map((c) => c[0]).sort((a, b) => a - b);
      const mid = xs[Math.floor(xs.length / 2)];
      if (mid < 60 || mid >= 120) found.push(`seed ${m.seed}: waterfall at x ${mid}`);
      if (!cells.some(([x, y]) => y > 0 && m.cells[(y - 1) * SIZE + x] === CLIFF)) found.push(`seed ${m.seed}: waterfall does not touch the cliff`);
    }
    expect(report(found)).toEqual([]);
  });

  it('runs the river from the waterfall to the near edge, 5 to 8 wide', () => {
    const found: string[] = [];
    for (const m of maps) {
      const river = cellsOf(m, RIVER);
      const at = (x: number, y: number): number => (x >= 0 && y >= 0 && x < SIZE && y < SIZE ? m.cells[y * SIZE + x] : -1);
      const seen = new Set<number>();
      const stack: [number, number][] = river.filter(([x, y]) => [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)].includes(WATERFALL));
      if (!stack.length) found.push(`seed ${m.seed}: the river does not touch the waterfall`);
      for (const [x, y] of stack) seen.add(y * SIZE + x);
      while (stack.length) {
        const [x, y] = stack.pop()!;
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (at(nx, ny) === RIVER && !seen.has(ny * SIZE + nx)) {
            seen.add(ny * SIZE + nx);
            stack.push([nx, ny]);
          }
        }
      }
      if (![...seen].some((i) => Math.floor(i / SIZE) === SIZE - 1)) found.push(`seed ${m.seed}: the river does not reach the near edge`);
      if (seen.size < river.length) found.push(`seed ${m.seed}: ${river.length - seen.size} river cells are cut off`);
      const xs = river.map((c) => c[0]);
      if (Math.min(...xs) < 50 || Math.max(...xs) > 120) found.push(`seed ${m.seed}: river strays to x ${Math.min(...xs)} to ${Math.max(...xs)}`);
      const centres: number[] = [];
      for (let y = 40; y < SIZE; y++) {
        const row = river.filter((c) => c[1] === y).map((c) => c[0]);
        if (row.length) centres.push((Math.min(...row) + Math.max(...row)) / 2);
      }
      if (Math.max(...centres) - Math.min(...centres) < 4) found.push(`seed ${m.seed}: river runs straight`);
      for (let y = 0; y < SIZE; y++) {
        const row = river.filter((c) => c[1] === y).map((c) => c[0]);
        if (!row.length || cellsRowHas(m, y, WATERFALL)) continue;
        const width = row.length;
        if (width < 5 || width > 8 || Math.max(...row) - Math.min(...row) + 1 !== width) found.push(`seed ${m.seed}: river row ${y} is ${width} wide`);
      }
    }
    expect(report(found)).toEqual([]);
  });

  it('puts the bank 3 cells either side of the river and nowhere else', () => {
    const found: string[] = [];
    for (const m of maps) {
      for (const [x, y] of cellsOf(m, BANK)) {
        if (nearest(m, { x: x + 0.5, y: y + 0.5 }, [RIVER, WATERFALL], 3) > 3 + 1e-9) found.push(`seed ${m.seed}: bank cell ${x},${y} is far from the water`);
      }
      for (const [x, y] of cellsOf(m, RIVER)) {
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            if (Math.hypot(dx, dy) > 3 || cellAt(m, x + dx, y + dy) !== 0) continue;
            found.push(`seed ${m.seed}: meadow ${x + dx},${y + dy} within 3 of the river`);
          }
        }
      }
    }
    expect(report(found)).toEqual([]);
  });

  it('spreads the forest over the west half, off the water', () => {
    const found: string[] = [];
    for (const m of maps) {
      const forest = cellsOf(m, FOREST);
      const west = forest.filter((c) => c[0] < SIZE / 2).length;
      if (west < forest.length * 0.9) found.push(`seed ${m.seed}: ${forest.length - west} forest cells in the east half`);
      if (west < SIZE * SIZE * 0.5 * 0.3) found.push(`seed ${m.seed}: forest covers ${west} cells of the west half`);
      for (const [x, y] of forest) {
        if (nearest(m, { x: x + 0.5, y: y + 0.5 }, [RIVER], 2) < 2) {
          found.push(`seed ${m.seed}: forest at ${x},${y} touches the river`);
          break;
        }
      }
    }
    expect(report(found)).toEqual([]);
  });

  it('cuts a round glade inside the forest', () => {
    const found: string[] = [];
    for (const m of maps) {
      const glade = cellsOf(m, GLADE);
      const c = centroid(glade);
      const radius = Math.sqrt(glade.length / Math.PI);
      if (radius < 7 || radius > 13) found.push(`seed ${m.seed}: glade radius ${radius.toFixed(1)}`);
      const w = Math.max(...glade.map((g) => g[0])) - Math.min(...glade.map((g) => g[0])) + 1;
      const h = Math.max(...glade.map((g) => g[1])) - Math.min(...glade.map((g) => g[1])) + 1;
      if (Math.abs(w - h) > 3) found.push(`seed ${m.seed}: glade ${w} by ${h} is not round`);
      let forest = 0;
      let ring = 0;
      for (let a = 0; a < 48; a++) {
        const p = { x: c.x + Math.cos((a / 48) * Math.PI * 2) * (radius + 3), y: c.y + Math.sin((a / 48) * Math.PI * 2) * (radius + 3) };
        ring++;
        if (cellAt(m, p.x, p.y) === FOREST) forest++;
      }
      if (forest < ring * 0.6) found.push(`seed ${m.seed}: only ${forest} of ${ring} cells round the glade are forest`);
    }
    expect(report(found)).toEqual([]);
  });

  it('puts the cave in the far east corner, away from the forest, under the cliff', () => {
    const found: string[] = [];
    for (const m of maps) {
      const cave = cellsOf(m, CAVE);
      const c = centroid(cave);
      const f = centroid(cellsOf(m, FOREST));
      if (c.x < 130 || c.y > 60) found.push(`seed ${m.seed}: cave centred at ${c.x.toFixed(0)},${c.y.toFixed(0)}`);
      if (c.x - f.x < 50) found.push(`seed ${m.seed}: cave and forest are ${(c.x - f.x).toFixed(0)} apart`);
      if (Math.min(...cave.map((g) => g[1])) < 8) found.push(`seed ${m.seed}: cave reaches into the cliff rows`);
    }
    expect(report(found)).toEqual([]);
  });

  it('puts the village in the east half, off the river', () => {
    const found: string[] = [];
    for (const m of maps) {
      const village = cellsOf(m, VILLAGE);
      const c = centroid(village);
      if (c.x < 100) found.push(`seed ${m.seed}: village centred at x ${c.x.toFixed(0)}`);
      for (const [x, y] of village) {
        if (nearest(m, { x: x + 0.5, y: y + 0.5 }, [RIVER, BANK, WATERFALL], 4) < 4) {
          found.push(`seed ${m.seed}: village cell ${x},${y} is near the water`);
          break;
        }
      }
    }
    expect(report(found)).toEqual([]);
  });
});

describe('royale map generator: placements', () => {
  it('seats the start, the dens, the caches and the buildings by the rules', () => {
    const found: string[] = [];
    for (const m of maps) found.push(...placementProblems(m, ROYALE_CACHES));
    expect(report(found)).toEqual([]);
  });

  it('asks for the right buildings: at least one of each kind the caches name, six in all', () => {
    for (const m of maps) {
      for (const kind of new Set(ROYALE_CACHES.flatMap((c) => (c.building ? [c.building] : [])))) {
        expect(m.buildings.some((b) => b.kind === kind), `${kind} on seed ${m.seed}`).toBe(true);
      }
      expect(m.buildings.length).toBeGreaterThanOrEqual(6);
    }
  });

  it('sits a den that guards a building on that building', () => {
    for (const c of ROYALE_CACHES) {
      if (!c.building || !c.den) continue;
      for (const m of maps.slice(0, 60)) {
        const b = m.buildings.find((bb) => inside(bb, m.caches[c.id]))!;
        expect(inside(b, m.dens[c.den]), `${c.den} on seed ${m.seed}`).toBe(true);
      }
    }
  });
});

describe('royale map generator: any number of caches', () => {
  it('seats a list with every entry three times over', () => {
    const defs = inflate(ROYALE_CACHES, 3);
    expect(defs.length).toBe(ROYALE_CACHES.length * 3);
    const found: string[] = [];
    for (const seed of SEEDS.slice(0, 80)) found.push(...placementProblems(generate(seed, defs), defs));
    expect(report(found)).toEqual([]);
  });

  it('seats a crowded list: three free caches in every section, more houses, yards in the village', () => {
    const defs = crowd(ROYALE_CACHES);
    expect(defs.length).toBeGreaterThan(35);
    const found: string[] = [];
    for (const seed of SEEDS.slice(0, 80)) found.push(...placementProblems(generate(seed, defs), defs));
    expect(report(found)).toEqual([]);
  });

  it('grows the village with the houses asked for', () => {
    const small = generate(5, ROYALE_CACHES);
    const big = generate(5, crowd(ROYALE_CACHES));
    expect(big.buildings.length).toBeGreaterThan(small.buildings.length);
    expect(cellsOf(big, VILLAGE).length).toBeGreaterThan(cellsOf(small, VILLAGE).length);
  });

  it('seats no caches at all', () => {
    const m = generate(9, []);
    expect(Object.keys(m.caches)).toEqual([]);
    expect(m.buildings.length).toBeGreaterThanOrEqual(6);
    expect(placementProblems(m, [])).toEqual([]);
  });
});

describe('royale map generator: cost', () => {
  it('builds a map in under 50 ms', () => {
    const mean = timed.reduce((a, t) => a + t.ms, 0) / timed.length;
    const worst = Math.max(...timed.map((t) => t.ms));
    const defs = crowd(ROYALE_CACHES);
    const t0 = performance.now();
    for (const seed of SEEDS.slice(0, 40)) generate(seed, defs);
    const crowded = (performance.now() - t0) / 40;
    console.info(`royale map build: mean ${mean.toFixed(1)} ms, worst ${worst.toFixed(1)} ms over ${timed.length} seeds; ${defs.length} caches: mean ${crowded.toFixed(1)} ms`);
    expect(mean).toBeLessThan(50);
    expect(crowded).toBeLessThan(50);
  });
});

describe('royale map generator: text view', () => {
  it('draws one glyph per cell, the start once, and a legend', () => {
    const m = maps[3];
    const lines = asciiMap(m).split('\n');
    expect(lines.length).toBe(SIZE);
    expect(lines.every((l) => l.length === SIZE)).toBe(true);
    expect(asciiMap(m).split('@').length - 1).toBe(1);
    const small = asciiMap(m, 6).split('\n');
    expect(small.length).toBe(30);
    expect(small.every((l) => l.length === 30)).toBe(true);
    const legend = asciiLegend();
    for (const d of ROYALE_DENS) expect(legend).toContain(d.id);
    for (const c of ROYALE_CACHES) expect(legend).toContain(c.id);
  });
});
