// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { EventBus } from '../src/core/engine/events';
import {
  ACTIVITY_XP_PER_TICK,
  COLD_TRAINS_AT,
  darknessFactor,
  grantActivityExposure,
  HEAT_TRAINS_AT,
  MOONLIGHT_MAX,
  MOONLIGHT_THROUGH,
  moonlightOn,
  moonlightThrough,
  naturalDarkness,
  placeDarkness,
  skyDarkness,
  tickExposure,
  weatherExposure,
} from '../src/core/systems/exposure';
import {
  weatherAt,
  worldSeedOf,
  type WeatherKind,
  type WeatherSample,
} from '../src/core/systems/weather';
import { clockOf, moonlight } from '../src/core/systems/clock';
import { MOONLIGHT_WEIGHT } from '../src/core/data/climate.data';
import { AREAS, REGIONS, SPOTS, skyRegionOf } from '../src/core/registry';

const at = (d: number, h = 0) => (d * 1440 + h * 60) * 10;

function sample(over: Partial<WeatherSample>): WeatherSample {
  return { temp: 15, precip: 0.2, wind: 0.3, kind: 'clear', band: 'mild', ...over };
}

function world(spot: string, totalTicks: number) {
  const state = createInitialState();
  state.spot = spot;
  state.totalTicks = totalTicks;
  return { state, bus: new EventBus() };
}

describe('what each sky teaches', () => {
  const shares = (s: WeatherSample, base = 15, hour = 12) =>
    Object.fromEntries(weatherExposure(s, base, hour));

  it('rain is water, storms are the 65:30:5 lesson', () => {
    expect(shares(sample({ kind: 'rain' }))).toEqual({ water: 1 });
    expect(shares(sample({ kind: 'storm' }))).toEqual({ wind: 0.65, water: 0.3, lightning: 0.05 });
  });

  it('sandstorms split 80:20 wind and earth; gales and blizzards are wind', () => {
    expect(shares(sample({ kind: 'sandstorm' }))).toEqual({ wind: 0.8, earth: 0.2 });
    expect(shares(sample({ kind: 'gale' }))).toEqual({ wind: 1 });
    expect(shares(sample({ kind: 'blizzard', temp: -8 }))).toEqual({ wind: 1, cold: 1 });
  });

  it('only VERY hot or cold trains the skin', () => {
    expect(shares(sample({ temp: HEAT_TRAINS_AT }))).toHaveProperty('heat');
    expect(shares(sample({ temp: HEAT_TRAINS_AT - 1 }))).not.toHaveProperty('heat');
    expect(shares(sample({ temp: COLD_TRAINS_AT }))).toHaveProperty('cold');
    expect(shares(sample({ temp: COLD_TRAINS_AT + 1 }))).not.toHaveProperty('cold');
  });

  it('unseasonable glare is a clear DAYTIME sky running hot over its baseline', () => {
    expect(shares(sample({ kind: 'clear', temp: 22 }), 15, 12)).toEqual({ light: 1 });
    expect(shares(sample({ kind: 'clear', temp: 22 }), 15, 22)).toEqual({}); // night
    expect(shares(sample({ kind: 'clear', temp: 19 }), 15, 12)).toEqual({}); // merely nice
    expect(shares(sample({ kind: 'overcast', temp: 22 }), 15, 12)).toEqual({}); // clouds
  });
});

describe('the dark', () => {
  it('night is dark, twilight is half, day is not', () => {
    expect(naturalDarkness(23)).toBe(1);
    expect(naturalDarkness(2)).toBe(1);
    expect(naturalDarkness(19)).toBe(0.5);
    expect(naturalDarkness(5)).toBe(0.5);
    expect(naturalDarkness(12)).toBe(0);
  });

  it('lamplight, roofs and daylight all cancel it; darkvision erodes it', () => {
    const night = at(3, 23);
    expect(darknessFactor(world('village_square', night).state)).toBe(0); // settlement
    expect(darknessFactor(world('living_room', night).state)).toBe(0); // indoor
    expect(darknessFactor(world('deep_woods', at(3, 12)).state)).toBe(0); // daylight

    // Tick 0 is midnight with all three moons new: no moonlight, whatever the sky.
    const wild = world('deep_woods', 0).state;
    expect(darknessFactor(wild)).toBe(1);
    wild.skills.darkvision = { level: 25, xp: 0 };
    expect(darknessFactor(wild)).toBe(0.5);
    wild.skills.darkvision = { level: 50, xp: 0 };
    expect(darknessFactor(wild)).toBe(0);
  });

  it('true dark grows darkvision; a settled square never does', () => {
    const wild = world('deep_woods', at(3, 23));
    tickExposure(wild.state, wild.bus);
    expect(wild.state.skills.darkvision).toBeDefined();

    const town = world('village_square', at(3, 23));
    tickExposure(town.state, town.bus);
    expect(town.state.skills.darkvision).toBeUndefined();
  });

  it("a 'dark'-tagged REGION is black at noon, in every chamber", () => {
    // The tag sits on malgeri_cave_system, the region — the spot inherits it
    // through the union, and it beats both the daylight hour and the
    // sheltered roof: this dark is by NATURE, not by clock.
    const cave = world('malgeri_dc_central_hub', at(3, 12));
    expect(darknessFactor(cave.state)).toBe(1);
    cave.state.skills.darkvision = { level: 50, xp: 0 };
    expect(darknessFactor(cave.state)).toBe(0);
  });

  it('a dark cave trains darkvision AND dark resistance while you idle', () => {
    const { state, bus } = world('malgeri_dc_central_hub', at(3, 12));
    tickExposure(state, bus);
    expect(state.skills.darkvision).toBeDefined();
    expect(state.skills.dark_resistance).toBeDefined();
  });
});

describe('moonlight', () => {
  const newMoons = clockOf(0).moons;
  const fullMoons = newMoons.map((m) => ({ ...m, illumination: 1 }));

  it('is 0 with every moon new and 1 with every moon full', () => {
    expect(moonlight(newMoons)).toBe(0);
    expect(moonlight(fullMoons)).toBeCloseTo(1, 12);
    expect(Object.values(MOONLIGHT_WEIGHT).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it('clouds decide how much gets through; no weather sample means no clouds', () => {
    expect(moonlightThrough(fullMoons, 'clear')).toBeCloseTo(1, 12);
    expect(moonlightThrough(fullMoons, 'mist')).toBeCloseTo(0.5, 12);
    expect(moonlightThrough(fullMoons, 'overcast')).toBe(0);
    expect(moonlightThrough(fullMoons, 'snow')).toBe(0);
    expect(moonlightThrough(fullMoons, null)).toBeCloseTo(1, 12);
    for (const through of Object.values(MOONLIGHT_THROUGH)) {
      expect(through).toBeGreaterThanOrEqual(0);
      expect(through).toBeLessThanOrEqual(1);
    }
  });

  it('no moonlight leaves the sky as dark as before; the brightest night is still 0.4 dark', () => {
    for (let hour = 0; hour < 24; hour++) {
      expect(skyDarkness(hour, 0)).toBe(naturalDarkness(hour));
    }
    expect(skyDarkness(23, 1)).toBeCloseTo(1 - MOONLIGHT_MAX, 12);
    expect(skyDarkness(23, 1)).toBeCloseTo(0.4, 12);
    expect(skyDarkness(19, 1)).toBeCloseTo(0.2, 12);
    expect(skyDarkness(12, 1)).toBe(0);
  });

  it('never reaches a dark place, a roof or lamplight, and is not even sampled by day', () => {
    const full = () => 1;
    expect(placeDarkness(undefined, new Set(['dark']), 23, full)).toBe(1);
    expect(placeDarkness(undefined, new Set(['settlement']), 23, full)).toBe(0);
    expect(placeDarkness({ sheltered: true }, new Set(), 23, full)).toBe(0);
    const never = () => {
      throw new Error('sampled the sky');
    };
    expect(placeDarkness(undefined, new Set(), 12, never)).toBe(0);
    expect(placeDarkness(undefined, new Set(['indoor']), 23, never)).toBe(0);
    expect(placeDarkness(undefined, new Set(), 23, full)).toBeCloseTo(0.4, 12);
  });

  /** The first 23:00 in the woods whose sky is `kind`, under a fixed seed. */
  function woodsNightWith(kind: WeatherKind) {
    const region = REGIONS[AREAS[SPOTS.deep_woods.areaId].regionId];
    const createdAt = 20260804;
    for (let d = 1; d < 368; d++) {
      const t = at(d, 23);
      if (weatherAt(worldSeedOf(createdAt), region, t)?.kind !== kind) continue;
      if (kind === 'clear' && moonlight(clockOf(t).moons) < 0.2) continue;
      const w = world('deep_woods', t);
      w.state.createdAt = createdAt;
      return w;
    }
    throw new Error(`no ${kind} night found`);
  }

  it('a clear moonlit night in the woods is lighter; an overcast one is not', () => {
    const clear = woodsNightWith('clear');
    const lit = moonlightThrough(clockOf(clear.state.totalTicks).moons, 'clear');
    expect(darknessFactor(clear.state)).toBeCloseTo(1 - MOONLIGHT_MAX * lit, 12);
    expect(darknessFactor(clear.state)).toBeLessThan(0.9);
    expect(moonlightOn(clear.state)).toEqual({ lit, kind: 'clear' });

    const overcast = woodsNightWith('overcast');
    expect(darknessFactor(overcast.state)).toBe(1);
    expect(moonlightOn(overcast.state)).toEqual({ lit: 0, kind: 'overcast' });
  });

  it('the readout stays silent where moonlight cannot matter', () => {
    expect(moonlightOn(world('village_square', at(3, 23)).state)).toBeNull(); // lamplight
    expect(moonlightOn(world('malgeri_dc_central_hub', at(3, 23)).state)).toBeNull(); // dark place
    expect(moonlightOn(world('deep_woods', at(3, 12)).state)).toBeNull(); // daylight
  });

  it('a moonlit night teaches Darkvision less than a clouded one', () => {
    const xpAfterOneMinute = (w: ReturnType<typeof woodsNightWith>) => {
      w.state.skills.darkvision = { level: 1, xp: 0 };
      tickExposure(w.state, w.bus);
      return w.state.skills.darkvision.xp;
    };
    const moonlit = xpAfterOneMinute(woodsNightWith('clear'));
    const clouded = xpAfterOneMinute(woodsNightWith('overcast'));
    expect(moonlit).toBeGreaterThan(0);
    expect(moonlit).toBeLessThan(clouded);
  });
});

describe('open sky in the tower (user ruling, 2026-10-29)', () => {
  const seed = worldSeedOf(20260804);
  const ROOFED_F6 = ['f6_tunnels', 'f6_pens', 'f6_kitchens', 'f6_shrine', 'f6_great_hall'];

  it('band 1 keeps the roof; floors 4 and 5 and the Warren Mouth open onto the sky over the same pin', () => {
    expect(skyRegionOf('f1_landing')).toBe(REGIONS.the_ascent);
    expect(skyRegionOf('f1_landing')?.sheltered).toBe(true);
    for (const spot of ['f4_treeline', 'f4_ravine_floor', 'f5_bog', 'f5_back_door', 'f6_warren_mouth']) {
      const sky = skyRegionOf(spot)!;
      expect(sky.sheltered, spot).toBe(false);
      expect(sky.world, spot).toEqual(REGIONS.the_ascent.world);
    }
  });

  it('weather reaches floor 4 and never floor 1', () => {
    const kinds = new Set<WeatherKind>();
    for (let d = 1; d < 90; d++) {
      expect(weatherAt(seed, skyRegionOf('f1_landing')!, at(d, 12))?.kind).toBe('still');
      kinds.add(weatherAt(seed, skyRegionOf('f4_treeline')!, at(d, 12))!.kind);
    }
    expect(kinds.has('still')).toBe(false);
    expect(kinds.size).toBeGreaterThan(1);
  });

  it('a night on floor 4 is dark and moonlit; the same night on floor 1 is not dark', () => {
    const f4 = world('f4_deep_woods', at(3, 23));
    f4.state.createdAt = 20260804;
    const moon = moonlightOn(f4.state);
    expect(moon).not.toBeNull();
    expect(darknessFactor(f4.state)).toBeCloseTo(skyDarkness(23, moon!.lit), 12);
    expect(darknessFactor(f4.state)).toBeGreaterThan(0);

    const f1 = world('f1_landing', at(3, 23));
    expect(darknessFactor(f1.state)).toBe(0);
    expect(moonlightOn(f1.state)).toBeNull();
  });

  it('floor 6: the Mouth sees the night, the roofed warren does not, the caves stay dark', () => {
    expect(moonlightOn(world('f6_warren_mouth', at(3, 23)).state)).not.toBeNull();
    for (const spot of ROOFED_F6) {
      const { state } = world(spot, at(3, 23));
      expect(darknessFactor(state), spot).toBe(0);
      expect(moonlightOn(state), spot).toBeNull();
    }
    for (const spot of ['f5_hollows', 'f6_drop']) {
      expect(darknessFactor(world(spot, at(3, 12)).state), spot).toBe(1);
    }
  });

  it('rain on floor 5 trains the bog, never the caves or the roofed warren', () => {
    let rain = -1;
    for (let d = 1; d < 368 && rain < 0; d++) {
      if (weatherAt(seed, skyRegionOf('f5_bog')!, at(d, 12))?.kind === 'rain') rain = at(d, 12);
    }
    expect(rain).toBeGreaterThan(0);
    const wet = (spot: string) => {
      const w = world(spot, rain);
      w.state.createdAt = 20260804;
      tickExposure(w.state, w.bus);
      return w.state.skills.water_resistance !== undefined;
    };
    expect(wet('f5_bog')).toBe(true);
    expect(wet('f5_hollows')).toBe(false);
    expect(wet('f6_tunnels')).toBe(false);
    expect(wet('f1_landing')).toBe(false);
  });
});

describe('places and work that radiate', () => {
  it('loitering at the forge seeps Heat Resistance', () => {
    const { state, bus } = world('hamlet_forge', at(3, 12));
    tickExposure(state, bus);
    expect(state.skills.heat_resistance).toBeDefined();
  });

  it('elemental work pays exposure by cycle length; mundane work pays none', () => {
    const { state, bus } = world('village_square', 0);
    grantActivityExposure(state, bus, ['craft', 'heat'], 100);
    expect(state.skills.heat_resistance).toBeDefined();
    const xp =
      state.skills.heat_resistance.xp +
      // Level-ups fold XP away; reconstruct nothing — just require the grant
      // to have been material for a 100-tick cycle.
      (state.skills.heat_resistance.level - 1) * 10;
    expect(xp).toBeGreaterThanOrEqual(ACTIVITY_XP_PER_TICK * 100 * 0.9);

    const dull = world('village_square', 0);
    grantActivityExposure(dull.state, dull.bus, ['craft', 'woodwork'], 100);
    expect(dull.state.skills.heat_resistance).toBeUndefined();
  });

  it('off-minute ticks do nothing at all', () => {
    const { state, bus } = world('hamlet_forge', at(3, 12) + 3);
    tickExposure(state, bus);
    expect(state.skills.heat_resistance).toBeUndefined();
  });
});
