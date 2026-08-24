import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { EventBus } from '../src/core/engine/events';
import {
  ACTIVITY_XP_PER_TICK,
  COLD_TRAINS_AT,
  darknessFactor,
  grantActivityExposure,
  HEAT_TRAINS_AT,
  naturalDarkness,
  tickExposure,
  weatherExposure,
} from '../src/core/systems/exposure';
import type { WeatherSample } from '../src/core/systems/weather';

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

    const wild = world('deep_woods', night).state;
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
