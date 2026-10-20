import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { EventBus } from '../src/core/engine/events';
import { AREAS, SPOTS } from '../src/core/registry';
import { climbTo } from '../src/core/systems/towers';
import { tickTravel, visibleEdges } from '../src/core/systems/locations';
import { mapNodes } from '../src/ui/lib/map';

describe('region map after tower travel', () => {
  it('shows Threshold districts after descending from the cleared first floor', () => {
    const state = createInitialState(1, 'f1_toll_hall');
    state.stats['boss:f1_toll_hall'] = 1;
    state.discovered.push('ascent_foot', 'lectory_steps');
    const bus = new EventBus();
    expect(climbTo(state, bus, null)).toBe(true);
    for (let i = 0; i < 1000 && state.travel; i++) tickTravel(state, bus);
    expect(state.spot).toBe('ascent_foot');
    const nodes = mapNodes(state, 'threshold');
    expect(nodes.find((n) => n.spot.id === 'lectory_steps')?.known).toBe(true);
    const districtDoors = visibleEdges(state, 'ascent_foot')
      .filter((e) => AREAS[SPOTS[e.to].areaId].regionId === 'threshold');
    expect(districtDoors).toHaveLength(8);
    for (const door of districtDoors) expect(nodes.some((n) => n.spot.id === door.to)).toBe(true);
    // Threshold is mapped (RegionDef.mapped): standing in it puts all of it on the map.
    expect(nodes.every((n) => n.known)).toBe(true);
  });

  it('keeps other tower floors off the current floor map', () => {
    const state = createInitialState(1, 'f1_landing');
    state.discovered = Object.keys(SPOTS);
    const nodes = mapNodes(state, 'the_ascent');
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.every((n) => n.spot.areaId === 'ascent_f1_area')).toBe(true);
  });

  it('draws the floor a tab picks instead of the one underfoot', () => {
    const state = createInitialState(1, 'f1_landing');
    state.discovered = Object.keys(SPOTS);
    const nodes = mapNodes(state, 'the_ascent', 'ascent_f3_area');
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.every((n) => n.spot.areaId === 'ascent_f3_area')).toBe(true);
  });

  it('allows browsing Threshold from inside the tower', () => {
    const state = createInitialState(1, 'f1_landing');
    state.discovered.push('ascent_foot');
    expect(mapNodes(state, 'threshold').some((n) => n.spot.id === 'lectory_steps')).toBe(true);
  });
});
