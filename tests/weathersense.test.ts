import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { EventBus } from '../src/core/engine/events';
import { REGIONS, SKILLS } from '../src/core/registry';
import { weatherAt, worldSeedOf, type WeatherSample } from '../src/core/systems/weather';
import {
  FORECAST_ROWS,
  forecastFor,
  isSevere,
  noteTravelSkies,
  PROGNOSIS_TOOLTIP_AT,
  prognosisTitle,
  rowQuality,
  SEVERE_COLD,
  SEVERE_HOT,
  tickWeathersense,
  WEATHERSENSE_ID,
} from '../src/core/systems/weathersense';

const SEED = worldSeedOf(1_754_000_000_000);

function sample(over: Partial<WeatherSample>): WeatherSample {
  return { temp: 15, precip: 0.2, wind: 0.3, kind: 'clear', band: 'mild', ...over };
}

function world() {
  const state = createInitialState(7);
  return { state, bus: new EventBus() };
}

describe('the sense itself', () => {
  it('is capped at 30 and grows on the weather novelty domain', () => {
    const def = SKILLS[WEATHERSENSE_ID];
    expect(def.maxLevel).toBe(30);
    expect(def.novelty?.domain).toBe('weather');
  });

  it('manifests in the first severe weather, not under a pleasant sky', () => {
    const calm = world();
    tickWeathersense(calm.state, calm.bus, sample({ kind: 'overcast' }));
    expect(calm.state.skills[WEATHERSENSE_ID]).toBeUndefined();

    const storm = world();
    tickWeathersense(storm.state, storm.bus, sample({ kind: 'storm', precip: 0.8, wind: 0.7 }));
    // The manifesting minute also pays its first lesson.
    expect(storm.state.skills[WEATHERSENSE_ID]?.level).toBe(1);
    expect(storm.state.skills[WEATHERSENSE_ID]?.xp).toBeGreaterThan(0);
  });

  it('severity: the event kinds, and only BRUTAL temperatures', () => {
    expect(isSevere(sample({ kind: 'sandstorm' }))).toBe(true);
    expect(isSevere(sample({ kind: 'rain' }))).toBe(false);
    expect(isSevere(sample({ temp: SEVERE_HOT }))).toBe(true);
    expect(isSevere(sample({ temp: SEVERE_COLD }))).toBe(true);
    expect(isSevere(sample({ temp: 33 }))).toBe(false); // hot skin, calm sky
  });

  it('a second storm teaches less than the first — novelty wears', () => {
    const { state, bus } = world();
    state.skills[WEATHERSENSE_ID] = { level: 1, xp: 0 };
    tickWeathersense(state, bus, sample({ kind: 'storm' }));
    const first = state.skills[WEATHERSENSE_ID].xp;
    tickWeathersense(state, bus, sample({ kind: 'storm' }));
    const second = state.skills[WEATHERSENSE_ID].xp - first;
    expect(first).toBeGreaterThan(second);
    // A NEW kind opens at full novelty again.
    tickWeathersense(state, bus, sample({ kind: 'blizzard', temp: -2 }));
    const blizzard = state.skills[WEATHERSENSE_ID].xp - first - second;
    expect(blizzard).toBeGreaterThan(second);
  });

  it('new regions pay travel novelty; repeats fade', () => {
    const { state, bus } = world();
    state.skills[WEATHERSENSE_ID] = { level: 1, xp: 0 };
    noteTravelSkies(state, bus, 'westlands');
    const first = state.skills[WEATHERSENSE_ID].xp;
    noteTravelSkies(state, bus, 'westlands');
    expect(state.skills[WEATHERSENSE_ID].xp - first).toBeLessThan(first);
  });
});

describe('the prognosis', () => {
  const region = REGIONS.westlands;

  it('opens at two hours and reaches seven days only at the cap', () => {
    expect(forecastFor(1, region, SEED, 0)).toHaveLength(1);
    expect(forecastFor(4, region, SEED, 0)).toHaveLength(3);
    expect(forecastFor(PROGNOSIS_TOOLTIP_AT, region, SEED, 0)).toHaveLength(4);
    expect(forecastFor(30, region, SEED, 0)).toHaveLength(FORECAST_ROWS.length);
    expect(FORECAST_ROWS[FORECAST_ROWS.length - 1].hours).toBe(168);
  });

  it('each row arrives rough and sharpens with the levels after it', () => {
    expect(rowQuality(5, 5)).toBe('rough');
    expect(rowQuality(7, 5)).toBe('fair');
    expect(rowQuality(10, 5)).toBe('precise');
  });

  it('a precise row tells the TRUTH — it is the future, sampled', () => {
    const now = 100_000;
    const entries = forecastFor(10, region, SEED, now);
    const tomorrow = entries[3]; // 24h row, req 5, precise at 10
    const truth = weatherAt(SEED, region, now + 24 * 600)!;
    expect(tomorrow.quality).toBe('precise');
    expect(tomorrow.text).toContain(truth.kind);
    expect(tomorrow.text).toContain(`${Math.round(truth.temp)}°`);
  });

  it('the chip text grows with the sense', () => {
    const { state } = world();
    const current = weatherAt(worldSeedOf(state.createdAt), REGIONS.westlands, state.totalTicks)!;
    const blind = prognosisTitle(state, current);
    expect(blind).not.toContain('Prognosis');

    state.skills[WEATHERSENSE_ID] = { level: 1, xp: 0 };
    const glance = prognosisTitle(state, current);
    expect(glance).toContain('in 2 hours');
    expect(glance).not.toContain('Prognosis');

    state.skills[WEATHERSENSE_ID] = { level: PROGNOSIS_TOOLTIP_AT, xp: 0 };
    const read = prognosisTitle(state, current);
    expect(read).toContain('Prognosis');
    expect(read).toContain('tomorrow');
  });
});
