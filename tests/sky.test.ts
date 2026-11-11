import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { GameState, RegionDef, StatusDef, TerrainId } from '../src/core/types';
import { AREAS, REGIONS, SPOTS, STATUSES, skyRegionOf } from '../src/core/registry';
import {
  CALM_HOURS,
  CALM_PERIOD_DAYS,
  CALM_SEEN_KEY,
  FRONT_HOURS,
  SEASONS,
  SKY_RULES,
  SKY_TABLES,
  WEATHER_KINDS,
  type SeasonId,
  type WeatherKind,
} from '../src/core/data/climate.data';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { EventBus } from '../src/core/engine/events';
import { clockOf } from '../src/core/systems/clock';
import {
  FRONT_TICKS,
  WEATHER_ICONS,
  calmSpell,
  classify,
  frontOfCell,
  isCalmAt,
  weatherAt,
  worldSeedOf,
} from '../src/core/systems/weather';
import { skyKindAt, tickSky } from '../src/core/systems/exposure';
import { eligibleEncounters, spawnMonster } from '../src/core/systems/combat';
import {
  applyStatus,
  clearStatuses,
  findStatus,
  hasStatus,
  statusCeiling,
  statusIntensity,
  statusesOf,
} from '../src/core/systems/statuses';
import { getDerivedStats } from '../src/core/systems/derived';
import { availableMax } from '../src/core/systems/resources';
import { forecastFor } from '../src/core/systems/weathersense';
import { skyContentIssues } from '../src/core/systems/skyValidation';
import { LOG_TEXT } from '../src/core/text/log.text';
import { STATUSES_TEXT } from '../src/core/text/statuses.text';
import { CAVE, HUT, PLAIN, RIDGE, STILL, WINDY } from './fixtures/malgeri';

const CREATED = 1_754_000_000_000;
const SEED = worldSeedOf(CREATED);
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

describe('the sample memo', () => {
  it('holds one sample for a whole game minute', () => {
    const t = 600 * 40;
    expect(weatherAt(SEED, MOUNTAIN, t + 9)).toBe(weatherAt(SEED, MOUNTAIN, t));
    expect(weatherAt(SEED, MOUNTAIN, t + 10)).not.toBe(weatherAt(SEED, MOUNTAIN, t));
  });

  it('is keyed by value, not by object: a copy of the region reads the same entry', () => {
    const t = 600 * 41;
    expect(weatherAt(SEED, { ...MOUNTAIN }, t)).toEqual(weatherAt(SEED, MOUNTAIN, t));
  });

  it('never lets a roofed read and an open read of one region trade answers', () => {
    const t = 600 * 42;
    const open = weatherAt(SEED, MOUNTAIN, t)!.kind;
    expect(weatherAt(SEED, { ...MOUNTAIN, sheltered: true }, t)!.kind).toBe('still');
    expect(weatherAt(SEED, MOUNTAIN, t)!.kind).toBe(open);
    expect(open).not.toBe('still');
  });

  it('stays correct after its bound is passed and it empties', () => {
    const probes = [600 * 5, 600 * 977, 600 * 1500];
    const before = probes.map((t) => weatherAt(SEED, MOUNTAIN, t));
    // More distinct minutes than the memo holds, across several worlds.
    for (let m = 0; m < 9000; m++) weatherAt(SEED + (m % 3), MOUNTAIN, m * TICKS_PER_MINUTE);
    expect(probes.map((t) => weatherAt(SEED, MOUNTAIN, t))).toEqual(before);
  });

  it('returns a frozen sample, so no caller can edit what the next one reads', () => {
    expect(Object.isFrozen(weatherAt(SEED, MOUNTAIN, 600 * 43))).toBe(true);
  });
});

// ---------- What the open sky does ----------

/** A fresh state standing at `spot` with the clock at `tick`. */
function stateAt(spot: string, tick: number): GameState {
  const state = createInitialState(CREATED, spot);
  state.totalTicks = tick;
  return state;
}

/** The first tick on a rule boundary (a multiple of 3 game minutes) at which the mountain shows `kind`. */
function tickShowing(kind: WeatherKind, window = 3): number {
  if (kind === 'calm') {
    const [start] = calmSpell(SEED, MOUNTAIN.id, window);
    return Math.ceil(start / 3) * 3 * TICKS_PER_MINUTE;
  }
  // A front cell starts on a multiple of 3600 ticks, which is a multiple of 30.
  for (let cell = 0; ; cell++) {
    const tick = cell * FRONT_TICKS;
    if (weatherAt(SEED, MOUNTAIN, tick)!.kind === kind) return tick;
  }
}

describe('SKY_RULES: what the open sky does to the player', () => {
  const DOSES: [WeatherKind, Record<string, number>][] = [
    ['gale', { buffeted: 0.5 }],
    ['rain', { wet: 1 }],
    ['snow', { chilled: 0.15 }],
    ['storm', { wet: 1 }],
    ['heatwave', { sweltering: 0.5 }],
  ];

  it('names only statuses that exist, on whole-minute periods, and nothing for calm', () => {
    for (const [kind, rule] of Object.entries(SKY_RULES)) {
      expect(WEATHER_KINDS, kind).toContain(kind);
      expect(Number.isInteger(rule.every) && rule.every > 0, `${kind}: every`).toBe(true);
      for (const app of [...rule.self, ...(rule.foes ?? [])]) {
        expect(STATUSES[app.id], `${kind}: ${app.id}`).toBeDefined();
      }
    }
    expect(Object.keys(SKY_RULES).sort()).toEqual(['gale', 'heatwave', 'rain', 'snow', 'storm']);
    // Calm is dangerous through who appears, never through a status.
    expect(SKY_RULES.calm).toBeUndefined();
  });

  for (const [kind, want] of DOSES) {
    it(`${kind}: doses ${Object.keys(want).join(' and ')} under an open sky`, () => {
      const tick = tickShowing(kind);
      const state = stateAt(RIDGE, tick);
      expect(skyKindAt(state, RIDGE)).toBe(kind);
      tickSky(state, new EventBus());
      for (const [id, intensity] of Object.entries(want)) {
        expect(statusIntensity(state, id), `${kind}: ${id}`).toBeCloseTo(intensity, 5);
      }
    });
  }

  it('storm adds jolted to the rain', () => {
    const state = stateAt(RIDGE, tickShowing('storm'));
    tickSky(state, new EventBus());
    expect(hasStatus(state, 'wet')).toBe(true);
    expect(statusIntensity(state, 'jolted')).toBeGreaterThan(0);
  });

  it('applies on every third game minute and not between', () => {
    const tick = tickShowing('gale');
    const state = stateAt(RIDGE, tick);
    const bus = new EventBus();
    tickSky(state, bus);
    expect(findStatus(state, 'buffeted')!.intensity).toBeCloseTo(0.5, 5);
    for (let t = 1; t < 30; t++) {
      state.totalTicks = tick + t;
      tickSky(state, bus);
    }
    expect(findStatus(state, 'buffeted')!.intensity).toBeCloseTo(0.5, 5);
    state.totalTicks = tick + 30;
    tickSky(state, bus);
    expect(findStatus(state, 'buffeted')!.intensity).toBeCloseTo(1, 5);
  });

  it('does nothing under calm', () => {
    const state = stateAt(RIDGE, tickShowing('calm'));
    expect(skyKindAt(state, RIDGE)).toBe('calm');
    tickSky(state, new EventBus());
    expect(statusesOf(state)).toEqual([]);
  });

  it('does nothing indoors or in a sheltered area, whatever the sky', () => {
    for (const kind of Object.keys(SKY_RULES) as WeatherKind[]) {
      const tick = tickShowing(kind);
      for (const spot of [HUT, CAVE]) {
        const state = stateAt(spot, tick);
        expect(skyKindAt(state, spot), `${kind} at ${spot}`).toBeNull();
        tickSky(state, new EventBus());
        expect(statusesOf(state), `${kind} at ${spot}`).toEqual([]);
      }
    }
  });

  it('does nothing in a region with no sky table, whatever the noise field shows', () => {
    // Threshold's outdoor spots and the tower's open floors draw weather (the
    // sky readouts and `sky:` encounter lines see it) but take no rules.
    const spot = 'ascent_foot';
    const region = skyRegionOf(spot)!;
    expect(region.sky).toBeUndefined();
    let tick = 0;
    while (weatherAt(SEED, region, tick)?.kind !== 'rain') tick += 3600;
    const state = stateAt(spot, tick);
    expect(skyKindAt(state, spot)).toBe('rain');
    tickSky(state, new EventBus());
    expect(statusesOf(state)).toEqual([]);
  });

  describe('an area drawn in one region and standing under another region\'s sky', () => {
    const AREA = 'test_malgeri_sky_area';
    const FLOOR_SPOT = 'test_malgeri_sky_spot';
    beforeAll(() => {
      AREAS[AREA] = { id: AREA, name: 'Test Sky Area', regionId: 'the_ascent', skyRegionId: 'malgeri_range' };
      SPOTS[FLOOR_SPOT] = {
        id: FLOOR_SPOT,
        name: FLOOR_SPOT,
        icon: '⛰️',
        areaId: AREA,
        desc: 'A test spot.',
        activities: [],
        connections: [],
      };
    });
    afterAll(() => {
      delete AREAS[AREA];
      delete SPOTS[FLOOR_SPOT];
    });

    it('resolves to the sky region while the area keeps its own region', () => {
      expect(AREAS[AREA].regionId).toBe('the_ascent');
      expect(skyRegionOf(FLOOR_SPOT)!.id).toBe('malgeri_range');
    });

    it('shows the sky region\'s weather, calm included, and applies its rules', () => {
      const gale = stateAt(FLOOR_SPOT, tickShowing('gale'));
      expect(skyKindAt(gale, FLOOR_SPOT)).toBe('gale');
      tickSky(gale, new EventBus());
      expect(statusIntensity(gale, 'buffeted')).toBeCloseTo(0.5, 5);
      expect(skyKindAt(stateAt(FLOOR_SPOT, tickShowing('calm')), FLOOR_SPOT)).toBe('calm');
    });

    it('keeps the area\'s own sheltered override', () => {
      AREAS[AREA].sheltered = true;
      try {
        expect(skyKindAt(stateAt(FLOOR_SPOT, tickShowing('gale')), FLOOR_SPOT)).toBeNull();
      } finally {
        delete AREAS[AREA].sheltered;
      }
    });
  });

  describe('resistance', () => {
    const windward: StatusDef = {
      id: 'test_windward',
      name: 'Windward',
      icon: '🌬️',
      desc: 'Test-only: +50% wind resistance.',
      stacking: { mode: 'highest' },
      duration: null,
      mods: [{ stat: 'resWind', op: 'add', value: 0.5 }],
    };
    beforeAll(() => {
      STATUSES[windward.id] = windward;
    });
    afterAll(() => {
      delete STATUSES[windward.id];
    });

    it('thins the dose: 50% wind resistance halves a gale\'s buffeting', () => {
      const tick = tickShowing('gale');
      const bare = stateAt(RIDGE, tick);
      tickSky(bare, new EventBus());
      const warded = stateAt(RIDGE, tick);
      applyStatus(warded, warded, { id: windward.id });
      expect(getDerivedStats(warded).resWind).toBeCloseTo(0.5, 5);
      tickSky(warded, new EventBus());
      expect(statusIntensity(bare, 'buffeted')).toBeCloseTo(0.5, 5);
      expect(statusIntensity(warded, 'buffeted')).toBeCloseTo(0.25, 5);
    });

    it('leaves the other kinds alone: wind resistance does not thin rain', () => {
      const tick = tickShowing('rain');
      const warded = stateAt(RIDGE, tick);
      applyStatus(warded, warded, { id: windward.id });
      tickSky(warded, new EventBus());
      expect(statusIntensity(warded, 'wet')).toBeCloseTo(1, 5);
    });
  });

  describe('sweltering', () => {
    it('lowers the stamina ceiling by 5% per point of intensity, to at most 30%', () => {
      const tick = tickShowing('heatwave');
      const state = stateAt(RIDGE, tick);
      const bus = new EventBus();
      const stats = getDerivedStats(state);
      const full = availableMax(state, stats, 'stamina');
      expect(statusCeiling(state, 'stamina')).toBe(1);
      tickSky(state, bus);
      expect(statusCeiling(state, 'stamina')).toBeCloseTo(1 - 0.05 * 0.5, 5);
      expect(availableMax(state, stats, 'stamina')).toBeLessThanOrEqual(full);
      for (let i = 1; i < 30; i++) {
        state.totalTicks = tick + i * 30;
        tickSky(state, bus);
      }
      // Doses sum to the cap of 6 and stop there; it never escalates into something else.
      expect(findStatus(state, 'sweltering')!.intensity).toBeCloseTo(6, 5);
      expect(statusCeiling(state, 'stamina')).toBeCloseTo(0.7, 5);
      expect(availableMax(state, stats, 'stamina')).toBeLessThan(full);
    });

    it('is a heat condition, so heat resistance thins it', () => {
      expect(STATUSES.sweltering.element).toBe('heat');
      const tick = tickShowing('heatwave');
      const bare = stateAt(RIDGE, tick);
      tickSky(bare, new EventBus());
      const hardened = stateAt(RIDGE, tick);
      hardened.skills['heat_resistance'] = { level: 30, xp: 0 };
      const res = getDerivedStats(hardened).resHeat;
      expect(res).toBeGreaterThan(0);
      tickSky(hardened, new EventBus());
      expect(statusIntensity(hardened, 'sweltering')).toBeCloseTo(0.5 * (1 - res), 5);
    });
  });

  it('dazzles on about one heatwave dose in four', () => {
    const tick = tickShowing('heatwave');
    const state = stateAt(RIDGE, tick);
    const bus = new EventBus();
    const trials = 1200;
    let landed = 0;
    for (let i = 0; i < trials; i++) {
      clearStatuses(state);
      tickSky(state, bus);
      if (hasStatus(state, 'dazzled')) landed++;
    }
    expect(landed / trials).toBeGreaterThan(0.19);
    expect(landed / trials).toBeLessThan(0.31);
  });

  it('puts a rule\'s foes on the enemies of a fight in progress, and only there', () => {
    const rain = SKY_RULES.rain;
    SKY_RULES.rain = { every: 3, self: [], foes: [{ id: 'wet', intensity: 1 }] };
    try {
      const state = stateAt(RIDGE, tickShowing('rain'));
      const foe = spawnMonster(state, SPOTS[RIDGE], { monsterId: PLAIN, level: 1 });
      state.combat = {
        enemies: [foe, null, null, null, null],
        playerBar: 0,
        momentum: 0,
        position: 'neutral',
        cooldowns: {},
        buffs: [],
        events: {},
      };
      tickSky(state, new EventBus());
      expect(statusIntensity(foe, 'wet')).toBeCloseTo(1, 5);
      expect(hasStatus(state, 'wet')).toBe(false);
    } finally {
      SKY_RULES.rain = rain;
    }
  });
});

// ---------- SpotEncounter.sky ----------

describe('SpotEncounter.sky', () => {
  const ids = (spot: string, tick: number) =>
    eligibleEncounters(stateAt(spot, tick), SPOTS[spot]).map((e) => e.monsterId).sort();

  it('a gale or a storm adds the windy line and not the calm one', () => {
    expect(ids(RIDGE, tickShowing('gale'))).toEqual([PLAIN, WINDY].sort());
    expect(ids(RIDGE, tickShowing('storm'))).toEqual([PLAIN, WINDY].sort());
  });

  it('calm adds the calm line and not the windy one', () => {
    expect(ids(RIDGE, tickShowing('calm'))).toEqual([PLAIN, STILL].sort());
  });

  it('a sky no line waits on leaves the plain line alone', () => {
    expect(ids(RIDGE, tickShowing('rain'))).toEqual([PLAIN]);
    expect(ids(RIDGE, tickShowing('heatwave'))).toEqual([PLAIN]);
  });

  it('a roofed or sheltered spot has no sky, so no sky line rolls there, calm included', () => {
    for (const kind of ['gale', 'storm', 'calm', 'rain'] as WeatherKind[]) {
      for (const spot of [HUT, CAVE]) {
        expect(ids(spot, tickShowing(kind)), `${kind} at ${spot}`).toEqual([PLAIN]);
      }
    }
  });

  it('a calm line never comes out of an indoor spot\'s draw, in 300 draws through a whole calm', () => {
    const [start, end] = calmSpell(SEED, MOUNTAIN.id, 3);
    const state = stateAt(HUT, 0);
    const drawn = new Set<string>();
    for (let i = 0; i < 300; i++) {
      state.totalTicks = (start + Math.floor(((end - start) * i) / 300)) * TICKS_PER_MINUTE;
      expect(skyKindAt(state, HUT)).toBeNull();
      drawn.add(spawnMonster(state, SPOTS[HUT]).defId);
    }
    expect([...drawn]).toEqual([PLAIN]);
  });

  it('under an open calm sky the calm line is drawn, and the windy one never is', () => {
    const [start, end] = calmSpell(SEED, MOUNTAIN.id, 3);
    const state = stateAt(RIDGE, 0);
    const drawn = new Set<string>();
    for (let i = 0; i < 300; i++) {
      state.totalTicks = (start + Math.floor(((end - start) * i) / 300)) * TICKS_PER_MINUTE;
      drawn.add(spawnMonster(state, SPOTS[RIDGE]).defId);
    }
    expect(drawn.has(STILL)).toBe(true);
    expect(drawn.has(PLAIN)).toBe(true);
    expect(drawn.has(WINDY)).toBe(false);
  });

  it('is a pure function of the clock: the same tick draws from the same table', () => {
    const tick = tickShowing('gale');
    expect(ids(RIDGE, tick)).toEqual(ids(RIDGE, tick));
    expect(ids(RIDGE, tick)).not.toEqual(ids(RIDGE, tickShowing('calm')));
  });
});

// ---------- The first calm ----------

describe('the first calm', () => {
  const WINDOW_MINUTES = CALM_PERIOD_DAYS * MINUTES_PER_DAY;
  const WINDOW = 2;
  const calmStart = () => Math.ceil(calmSpell(SEED, MOUNTAIN.id, WINDOW)[0] / 3) * 3;

  /** Run tickSky over every game minute in [from, to), collecting log lines. */
  function walk(state: GameState, from: number, to: number, catchingUp = false): string[] {
    const bus = new EventBus();
    const lines: string[] = [];
    bus.on('log', (ev) => lines.push(ev.msg));
    for (let m = from; m < to; m++) {
      state.totalTicks = m * TICKS_PER_MINUTE;
      tickSky(state, bus, catchingUp);
    }
    return lines;
  }

  it('names nothing before the first calm: a window of every other sky logs no line at all', () => {
    const state = stateAt(RIDGE, 0);
    const lines = walk(state, WINDOW * WINDOW_MINUTES, calmStart());
    expect(lines).toEqual([]);
    expect(state.stats[CALM_SEEN_KEY]).toBeUndefined();
  });

  it('logs one line at the first calm minute, stamps the flag, and then never again', () => {
    const state = stateAt(RIDGE, 0);
    const [start, end] = calmSpell(SEED, MOUNTAIN.id, WINDOW);
    walk(state, WINDOW * WINDOW_MINUTES, calmStart());
    const first = walk(state, calmStart(), end);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatch(/calm/);
    expect(first[0]).toContain(WEATHER_ICONS.calm);
    expect(state.stats[CALM_SEEN_KEY]).toBe(1);
    expect(start).toBeLessThanOrEqual(calmStart());
    // The rest of the spell, and the whole next window with its own spell.
    expect(walk(state, end, (WINDOW + 2) * WINDOW_MINUTES)).toEqual([]);
  });

  it('says nothing indoors or in a sheltered area, and does not stamp the flag there', () => {
    const [start, end] = calmSpell(SEED, MOUNTAIN.id, WINDOW);
    for (const spot of [HUT, CAVE]) {
      const state = stateAt(spot, 0);
      expect(walk(state, start, end), spot).toEqual([]);
      expect(state.stats[CALM_SEEN_KEY], spot).toBeUndefined();
    }
  });

  it('waits out an offline catch-up: nothing is logged or stamped while catching up, the line fires once live', () => {
    const state = stateAt(RIDGE, 0);
    const [, end] = calmSpell(SEED, MOUNTAIN.id, WINDOW);
    expect(walk(state, calmStart(), end - 10, true)).toEqual([]);
    expect(state.stats[CALM_SEEN_KEY]).toBeUndefined();
    const live = walk(state, end - 10, end);
    expect(live).toHaveLength(1);
    expect(state.stats[CALM_SEEN_KEY]).toBe(1);
  });

  it('does not fire again for a save that already carries the flag', () => {
    const state = stateAt(RIDGE, 0);
    state.stats[CALM_SEEN_KEY] = 1;
    const [start, end] = calmSpell(SEED, MOUNTAIN.id, WINDOW);
    expect(walk(state, start, end)).toEqual([]);
  });

  it('is wired into the game tick: the real loop logs it once', () => {
    const g = new Game(stateAt(RIDGE, calmStart() * TICKS_PER_MINUTE - 5));
    g.step(40);
    const lines = g.state.log.map((l) => l.msg).filter((m) => /calm/i.test(m));
    expect(lines).toHaveLength(1);
    expect(g.state.stats[CALM_SEEN_KEY]).toBe(1);
  });

  it('needs no save version: the flag is a plain stats counter', () => {
    expect(CALM_SEEN_KEY.startsWith('flag:')).toBe(true);
    expect(typeof createInitialState(CREATED).stats).toBe('object');
  });
});

describe('what the texts say about calm', () => {
  it('only the first-calm line names calm among the log texts', () => {
    const naming = Object.entries(LOG_TEXT)
      .filter(([, value]) => /\bcalm\b/i.test(String(value)))
      .map(([key]) => key);
    expect(naming).toEqual(['exposure.calm_first']);
  });

  it('the line states the weather and never a danger', () => {
    const line = String(LOG_TEXT['exposure.calm_first']);
    expect(line).toMatch(/calm/i);
    expect(line).not.toMatch(/danger|monster|beware|threat|ambush|foe|enem|dread/i);
  });

  it('no sky-rule status text mentions calm', () => {
    const texts = ['buffeted', 'wet', 'chilled', 'jolted', 'sweltering', 'dazzled'].map(
      (id) => `${id}: ${STATUSES_TEXT[`${id}.desc`] ?? ''}`,
    );
    for (const t of texts) expect(t).not.toMatch(/calm/i);
  });

  it('sweltering carries a Label: fact text', () => {
    const desc = String(STATUSES_TEXT['sweltering.desc']);
    expect(desc).toMatch(/^Maximum stamina: /);
    expect(desc).toMatch(/Source: /);
  });
});

describe('the forecast', () => {
  const calmStart = calmSpell(SEED, MOUNTAIN.id, 3)[0] * TICKS_PER_MINUTE;
  // The 2-hour row looks 1200 ticks ahead; land it inside the spell.
  const now = calmStart + 600 - 1200;
  const sample = weatherAt(SEED, MOUNTAIN, now + 1200)!;

  it('looks at a calm sky from the 2-hour row', () => {
    expect(sample.kind).toBe('calm');
  });

  it('names a coming calm as weather at the fair and precise reads', () => {
    const fair = forecastFor(3, MOUNTAIN, SEED, now)[0];
    expect(fair.quality).toBe('fair');
    expect(fair.text).toBe(`${WEATHER_ICONS.calm} calm, ${sample.band}`);
    const precise = forecastFor(6, MOUNTAIN, SEED, now)[0];
    expect(precise.quality).toBe('precise');
    expect(precise.text).toBe(`${WEATHER_ICONS.calm} calm · ${Math.round(sample.temp)}°`);
  });

  it('reads a calm sky roughly as plain skies, and never says calm', () => {
    const rough = forecastFor(1, MOUNTAIN, SEED, now)[0];
    expect(rough.quality).toBe('rough');
    expect(rough.text).toMatch(/^plain skies, /);
    expect(rough.text).not.toMatch(/calm/i);
  });

  it('states no danger at any read', () => {
    for (const level of [1, 3, 6]) {
      for (const entry of forecastFor(level, MOUNTAIN, SEED, now)) {
        expect(entry.text).not.toMatch(/danger|monster|beware|threat|ambush|foe|enem/i);
      }
    }
  });

  it('shows a heatwave by name at a fair read and as plain skies at a rough one', () => {
    const tick = tickShowing('heatwave');
    const ahead = tick - 1200;
    const heat = weatherAt(SEED, MOUNTAIN, tick)!;
    expect(forecastFor(3, MOUNTAIN, SEED, ahead)[0].text).toBe(`${WEATHER_ICONS.heatwave} heatwave, ${heat.band}`);
    expect(forecastFor(1, MOUNTAIN, SEED, ahead)[0].text).toMatch(/^plain skies, /);
  });
});

describe('skyContentIssues', () => {
  const region = (extra: Partial<RegionDef> = {}) => ({ id: 'r', name: 'R', sky: 'malgeri', world: { x: 1, y: 1 }, ...extra });
  const area = (extra: Record<string, unknown> = {}) => ({ id: 'a', regionId: 'r', ...extra });
  const spot = (sky: string[] | undefined, tags?: string[]) => ({
    id: 's',
    areaId: 'a',
    ...(tags ? { tags } : {}),
    encounters: [{ monsterId: 'm', ...(sky ? { sky } : {}) }],
  });
  const issues = (r: ReturnType<typeof region>, a: ReturnType<typeof area>, s: ReturnType<typeof spot>) =>
    skyContentIssues({ regions: { r }, areas: { a }, spots: { s } }).map((i) => `${i.kind} ${i.id}: ${i.message}`);

  it('passes a placed region with a table and a line that can roll under it', () => {
    expect(issues(region(), area(), spot(['calm', 'gale']))).toEqual([]);
    expect(issues(region(), area(), spot(undefined))).toEqual([]);
  });

  it('passes the live registry', () => {
    expect(skyContentIssues({ regions: REGIONS, areas: {}, spots: {} })).toEqual([]);
  });

  it('refuses a sky that names no table, and a table with no atlas pin', () => {
    expect(issues(region({ sky: 'nowhere' }), area(), spot(undefined))).toEqual([
      expect.stringContaining("sky 'nowhere' is not in SKY_TABLES"),
    ]);
    expect(issues(region({ world: undefined }), area(), spot(undefined))).toEqual([
      expect.stringContaining('needs an atlas pin'),
    ]);
  });

  it('refuses an empty list and a name that is not a weather kind', () => {
    expect(issues(region(), area(), spot([]))).toEqual([expect.stringContaining('is empty')]);
    expect(issues(region(), area(), spot(['hail']))).toEqual([expect.stringContaining("'hail', which is not a weather kind")]);
  });

  it('refuses calm and heatwave in a region with no sky table', () => {
    const plain = region({ sky: undefined });
    expect(issues(plain, area(), spot(['calm']))).toEqual([expect.stringContaining('only a region sky table produces')]);
    expect(issues(plain, area(), spot(['heatwave']))).toEqual([expect.stringContaining('only a region sky table produces')]);
    // The kinds the noise field draws are fine anywhere with a sky.
    expect(issues(plain, area(), spot(['rain', 'storm']))).toEqual([]);
  });

  it('follows an area\'s skyRegionId for the table, and refuses one that names no region', () => {
    const plain = region({ sky: undefined, world: undefined });
    const under = { id: 'u', sky: 'malgeri', world: { x: 1, y: 1 } };
    // Drawn in a region with no table, standing under one with a table: calm is allowed.
    expect(
      skyContentIssues({
        regions: { r: plain, u: under },
        areas: { a: area({ skyRegionId: 'u' }) },
        spots: { s: spot(['calm']) },
      }),
    ).toEqual([]);
    // Without the override the same line has no table and no atlas pin under it.
    expect(
      skyContentIssues({ regions: { r: plain, u: under }, areas: { a: area() }, spots: { s: spot(['calm']) } }),
    ).not.toEqual([]);
    expect(
      skyContentIssues({ regions: { r: region() }, areas: { a: area({ skyRegionId: 'gone' }) }, spots: {} }).map(
        (i) => `${i.kind} ${i.id}: ${i.message}`,
      ),
    ).toEqual(["area a: skyRegionId 'gone' is not a region"]);
  });

  it('refuses a sky line where the sky is never open: indoor, sheltered, or unplaced', () => {
    expect(issues(region(), area(), spot(['gale'], ['indoor']))).toEqual([expect.stringContaining('never has')]);
    expect(issues(region(), area({ sheltered: true }), spot(['gale']))).toEqual([expect.stringContaining('never has')]);
    expect(issues(region({ sheltered: true }), area(), spot(['gale']))).toEqual([expect.stringContaining('never has')]);
    // An open area inside a sheltered region overrides it, as skyRegionOf does.
    expect(issues(region({ sheltered: true }), area({ sheltered: false }), spot(['gale']))).toEqual([]);
    expect(issues(region({ sky: undefined, world: undefined }), area(), spot(['gale']))).toEqual([
      expect.stringContaining('not on the atlas'),
    ]);
  });
});
