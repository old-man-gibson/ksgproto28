import { describe, expect, it } from 'vitest';
import type { RegionDef, TerrainId } from '../src/core/types';
import { REGIONS } from '../src/core/registry';
import {
  CALM_HOURS,
  CALM_PERIOD_DAYS,
  FRONT_HOURS,
  SEASONS,
  SKY_TABLES,
  type SeasonId,
} from '../src/core/data/climate.data';
import { clockOf } from '../src/core/systems/clock';
import {
  FRONT_TICKS,
  calmSpell,
  classify,
  frontOfCell,
  isCalmAt,
  weatherAt,
  worldSeedOf,
} from '../src/core/systems/weather';

const SEED = worldSeedOf(1_754_000_000_000);
const MOUNTAIN = REGIONS.malgeri_range;
const TABLE = SKY_TABLES.malgeri;

const TICKS_PER_MINUTE = 10;
const MINUTES_PER_DAY = 1440;

describe('the Malgeri sky table', () => {
  it('names a registered table on a pinned mountain region', () => {
    expect(MOUNTAIN.sky).toBe('malgeri');
    expect(MOUNTAIN.terrain).toBe('mountains');
    expect(MOUNTAIN.world).toBeDefined();
    expect(MOUNTAIN.sheltered).toBeFalsy();
  });

  it('holds the five harsh kinds at the ruled weights, calm among none of them', () => {
    expect(TABLE.fronts.map((f) => [f.kind, f.weight])).toEqual([
      ['gale', 24],
      ['snow', 22],
      ['rain', 20],
      ['storm', 18],
      ['heatwave', 14.5],
    ]);
    expect(TABLE.fronts.some((f) => f.kind === 'calm')).toBe(false);
  });

  it('feeds classify values that give back each front\'s own kind, and calm', () => {
    for (const f of TABLE.fronts) {
      expect(classify(f, MOUNTAIN.terrain, false, true), f.kind).toBe(f.kind);
    }
    expect(classify(TABLE.calm, MOUNTAIN.terrain, false, true)).toBe('calm');
  });

  it('removes one kind per season: summer snow, winter heatwave, spring storm, autumn rain', () => {
    expect(TABLE.excluded).toEqual({ summer: 'snow', winter: 'heatwave', spring: 'storm', autumn: 'rain' });
  });

  it('keeps the thresholds out of the plain noise path', () => {
    // The same values, without the table's `extended` flag, are ordinary weather.
    expect(classify({ temp: 38, precip: 0.05, wind: 0.2 }, 'mountains', false)).toBe('clear');
    expect(classify(TABLE.calm, 'mountains', false)).toBe('clear');
  });
});

describe('fronts', () => {
  const CELLS_PER_SEASON = 20_000;

  /** The first `n` cells that start in each season, in order. */
  function cellsBySeason(n: number): Record<SeasonId, number[]> {
    const out: Record<SeasonId, number[]> = { winter: [], spring: [], summer: [], autumn: [] };
    for (let cell = 0; SEASONS.some((s) => out[s].length < n); cell++) {
      const season = clockOf(cell * FRONT_TICKS).season;
      if (out[season].length < n) out[season].push(cell);
    }
    return out;
  }
  const CELLS = cellsBySeason(CELLS_PER_SEASON);

  it('a front is FRONT_HOURS long and four of them make a day', () => {
    expect(FRONT_HOURS).toBe(6);
    expect(FRONT_TICKS).toBe(FRONT_HOURS * 60 * TICKS_PER_MINUTE);
    expect(24 % FRONT_HOURS).toBe(0);
  });

  for (const season of SEASONS) {
    it(`${season}: 20,000 cells land within 1% of the weights, the excluded kind never`, () => {
      const excluded = TABLE.excluded[season];
      const kept = TABLE.fronts.filter((f) => f.kind !== excluded);
      const total = kept.reduce((sum, f) => sum + f.weight, 0);
      const count = new Map<string, number>();
      for (const cell of CELLS[season]) {
        const f = frontOfCell(TABLE, season, SEED, MOUNTAIN.id, cell);
        count.set(f.kind, (count.get(f.kind) ?? 0) + 1);
      }
      expect(count.get(excluded) ?? 0, `${excluded} in ${season}`).toBe(0);
      for (const f of kept) {
        const share = (count.get(f.kind) ?? 0) / CELLS_PER_SEASON;
        expect(Math.abs(share - f.weight / total), `${f.kind} in ${season}`).toBeLessThan(0.01);
      }
    });
  }

  it('weatherAt never shows the excluded kind of the season it is read in', () => {
    // Every cell of two whole years, read through weatherAt at the cell start
    // and at the cell's last tick; calm is the only kind that may override.
    for (let cell = 0; cell < (2 * 368 * 24) / FRONT_HOURS; cell++) {
      const season = clockOf(cell * FRONT_TICKS).season;
      for (const tick of [cell * FRONT_TICKS, (cell + 1) * FRONT_TICKS - 1]) {
        const kind = weatherAt(SEED, MOUNTAIN, tick)!.kind;
        expect(kind, `cell ${cell} ${season}`).not.toBe(TABLE.excluded[season]);
      }
    }
  });

  it('holds one front for its whole cell', () => {
    // Pick a cell that no calm spell touches. Cells never straddle a calm
    // window (6 hours divides 12 days), so one window's spell is the only one
    // that can reach it.
    const cellMinutes = FRONT_HOURS * 60;
    const touched = (cell: number): boolean => {
      const [start, end] = calmSpell(SEED, MOUNTAIN.id, Math.floor((cell * cellMinutes) / (CALM_PERIOD_DAYS * MINUTES_PER_DAY)));
      return start < (cell + 1) * cellMinutes && end > cell * cellMinutes;
    };
    let cell = 40;
    while (touched(cell)) cell++;
    const first = weatherAt(SEED, MOUNTAIN, cell * FRONT_TICKS)!;
    for (let t = 0; t < FRONT_TICKS; t += 997) {
      expect(weatherAt(SEED, MOUNTAIN, cell * FRONT_TICKS + t)).toEqual(first);
    }
  });

  it('a different world, or a different region, draws a different run', () => {
    const run = (seed: number, id: string) =>
      Array.from({ length: 200 }, (_, cell) => frontOfCell(TABLE, 'autumn', seed, id, cell).kind).join();
    expect(run(SEED, 'a')).toBe(run(SEED, 'a'));
    expect(run(SEED, 'a')).not.toBe(run(worldSeedOf(42), 'a'));
    expect(run(SEED, 'a')).not.toBe(run(SEED, 'b'));
  });
});

describe('calm', () => {
  const WINDOW_MINUTES = CALM_PERIOD_DAYS * MINUTES_PER_DAY;
  const SPELL_MINUTES = CALM_HOURS * 60;

  it('is the ruled constants', () => {
    expect(CALM_PERIOD_DAYS).toBe(12);
    expect(CALM_HOURS).toBe(8);
  });

  it('puts exactly one spell of CALM_HOURS in every window, inside the window', () => {
    for (let w = 0; w < 30; w++) {
      const [start, end] = calmSpell(SEED, MOUNTAIN.id, w);
      expect(end - start).toBe(SPELL_MINUTES);
      expect(start).toBeGreaterThanOrEqual(w * WINDOW_MINUTES);
      expect(end).toBeLessThanOrEqual((w + 1) * WINDOW_MINUTES);
      // Scan the window minute by minute: one contiguous run, of the right length.
      let run = 0;
      let runs = 0;
      let was = false;
      for (let m = w * WINDOW_MINUTES; m < (w + 1) * WINDOW_MINUTES; m++) {
        const now = isCalmAt(SEED, MOUNTAIN.id, m * TICKS_PER_MINUTE);
        if (now) run++;
        if (now && !was) runs++;
        was = now;
      }
      expect(run, `window ${w}`).toBe(SPELL_MINUTES);
      expect(runs, `window ${w}`).toBe(1);
    }
  });

  it('starts at a different offset in different windows', () => {
    const starts = new Set<number>();
    for (let w = 0; w < 30; w++) starts.add(calmSpell(SEED, MOUNTAIN.id, w)[0] - w * WINDOW_MINUTES);
    expect(starts.size).toBeGreaterThan(25);
  });

  it('overrides the front for the whole spell and for nothing else', () => {
    for (let w = 0; w < 30; w++) {
      const [start, end] = calmSpell(SEED, MOUNTAIN.id, w);
      const at = (m: number) => weatherAt(SEED, MOUNTAIN, m * TICKS_PER_MINUTE)!;
      expect(at(start).kind).toBe('calm');
      expect(at(end - 1).kind).toBe('calm');
      expect(at(Math.floor((start + end) / 2)).kind).toBe('calm');
      expect(at(end).kind).not.toBe('calm');
      if (start > w * WINDOW_MINUTES) expect(at(start - 1).kind).not.toBe('calm');
    }
  });

  it('is deterministic: the same inputs give the same sky in any order', () => {
    const ticks = Array.from({ length: 400 }, (_, i) => i * 7919 + 13);
    const forward = ticks.map((t) => weatherAt(SEED, MOUNTAIN, t));
    const backward = [...ticks].reverse().map((t) => weatherAt(SEED, MOUNTAIN, t)).reverse();
    expect(backward).toEqual(forward);
    expect(calmSpell(SEED, MOUNTAIN.id, 5)).toEqual(calmSpell(SEED, MOUNTAIN.id, 5));
    expect(calmSpell(SEED, MOUNTAIN.id, 5)).not.toEqual(calmSpell(worldSeedOf(42), MOUNTAIN.id, 5));
  });

  it('is never drawn as a front', () => {
    // Outside the spells, 20,000 cell reads never come back calm.
    for (let cell = 0; cell < 20_000; cell++) {
      expect(frontOfCell(TABLE, SEASONS[cell % 4], SEED, MOUNTAIN.id, cell).kind).not.toBe('calm');
    }
  });
});

describe('regions without a sky table', () => {
  // A fixed digest of weatherAt over ten literal regions, two seeds and two
  // years, taken on the code before region skies existed. Any change to the
  // noise path, the baseline or classify for a plain region moves it.
  const TERRAINS: TerrainId[] = ['plains', 'forest', 'hills', 'mountains', 'coast', 'desert', 'volcanic', 'caves'];
  const regions: RegionDef[] = [
    { id: 'the_ascent', name: 'A', terrain: 'plains', sheltered: false, world: { x: 14.3, y: 21.6 } },
    { id: 'the_ascent', name: 'A', terrain: 'plains', sheltered: true, world: { x: 14.3, y: 21.6 } },
    ...TERRAINS.map(
      (terrain, i): RegionDef => ({
        id: `t_${terrain}`,
        name: terrain,
        terrain,
        sheltered: terrain === 'caves',
        world: { x: 10 + i * 9, y: 15 + i * 7 },
      }),
    ),
  ];

  function fnv(h: number, s: string): number {
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
    return h >>> 0;
  }

  function digest(created: number): number {
    const seed = worldSeedOf(created);
    let h = 0x811c9dc5;
    for (const r of regions) {
      for (let t = 0; t < 2 * 368 * 14400; t += 997) {
        const w = weatherAt(seed, r, t);
        h = fnv(h, w ? `${w.kind}|${w.band}|${w.temp}|${w.precip}|${w.wind}` : 'null');
      }
    }
    return h;
  }

  it('give byte-identical weather to the code before region skies', () => {
    expect(digest(1_754_000_000_000)).toBe(392195146);
    expect(digest(20260804)).toBe(438608177);
  });

  it('never show heatwave or calm', () => {
    const kinds = new Set<string>();
    for (const r of regions) {
      for (let t = 0; t < 368 * 14400; t += 1999) kinds.add(weatherAt(SEED, r, t)?.kind ?? 'none');
    }
    expect(kinds.has('heatwave')).toBe(false);
    expect(kinds.has('calm')).toBe(false);
  });

  it('a sheltered region with a sky table stays still', () => {
    const roofed: RegionDef = { ...MOUNTAIN, sheltered: true };
    expect(weatherAt(SEED, roofed, 123456)!.kind).toBe('still');
  });

  it('a sky table needs a pin: an unplaced region has no weather', () => {
    const unpinned: RegionDef = { ...MOUNTAIN, world: undefined };
    expect(weatherAt(SEED, unpinned, 123456)).toBeNull();
  });
});
