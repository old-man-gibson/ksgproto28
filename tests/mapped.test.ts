import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { EventBus } from '../src/core/engine/events';
import { AREAS, SPOTS, edgesFrom } from '../src/core/registry';
import { findPath, pathTicks, startTravel, tickTravel } from '../src/core/systems/locations';
import { inMappedRegion, revealMapped } from '../src/core/systems/mapped';
import { deserialize, serialize } from '../src/core/save/save';
import { TUTORIAL_STEPS } from '../src/core/data/tutorial.data';

const TOWN = Object.values(SPOTS)
  .filter((s) => AREAS[s.areaId]?.regionId === 'threshold')
  .map((s) => s.id);

function walk(from: string, to: string) {
  const state = createInitialState(1, from);
  const bus = new EventBus();
  const logs: string[] = [];
  bus.on('log', (ev) => logs.push(ev.msg));
  expect(startTravel(state, bus, to)).toBe(true);
  for (let i = 0; i < 1000 && state.travel; i++) tickTravel(state, bus);
  expect(state.spot).toBe(to);
  return { state, logs };
}

describe('Threshold has no fog (RegionDef.mapped)', () => {
  it('a new game in the holding cell knows no town spot, so the tutorial is not finished early', () => {
    const s = createInitialState(1);
    expect(s.discovered.some(inMappedRegion)).toBe(false);
    expect(revealMapped(s)).toEqual([]);
    expect(TUTORIAL_STEPS.leave.done(s)).toBe(false);
  });

  it('walking out of floor 0 puts the whole city on the map, with one log line', () => {
    const { state, logs } = walk('f0_gate', 'ascent_foot');
    for (const id of TOWN) expect(state.discovered).toContain(id);
    expect(logs.filter((m) => m.startsWith('🗺️ Threshold mapped'))).toHaveLength(1);
    expect(logs.some((m) => m.includes(`${TOWN.length - 1} places`))).toBe(true);
  });

  it('a save that knows one town spot loads knowing all of them', () => {
    const s = createInitialState(1, 'ascent_foot');
    s.discovered = ['f0_cell', 'ascent_foot'];
    const loaded = deserialize(serialize(s));
    for (const id of TOWN) expect(loaded.discovered).toContain(id);
    expect(loaded.discovered).toContain('f0_cell');
    expect(loaded.discovered.some((id) => AREAS[SPOTS[id].areaId].regionId === 'the_ascent')).toBe(false);
  });

  it('town roads are short; the doors out of town keep their length', () => {
    for (const id of TOWN) {
      for (const e of edgesFrom(id)) {
        if (TOWN.includes(e.to)) expect(e.ticks, `${id} -> ${e.to}`).toBeLessThanOrEqual(18);
      }
    }
    expect(edgesFrom('ascent_foot').find((e) => e.to === 'base_entrance')?.ticks).toBe(90);
    expect(edgesFrom('f0_gate').find((e) => e.to === 'ascent_foot')?.ticks).toBe(30);
  });

  it('the Foot to the Cages is two hops and under 2 s', () => {
    const s = createInitialState(1, 'ascent_foot');
    revealMapped(s);
    const path = findPath(s, 'ascent_foot', 'the_cages');
    expect(path).toEqual(['ironyard_gate', 'the_cages']);
    expect(pathTicks('ascent_foot', path!)).toBe(20);
  });
});
