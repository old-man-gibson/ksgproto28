import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { EventBus } from '../src/core/engine/events';
import { AREAS, SPOTS } from '../src/core/registry';
import { climbTo } from '../src/core/systems/towers';
import { tickTravel, visibleEdges } from '../src/core/systems/locations';
import { labelBox, mapNodes, placeLabels, type MapBox } from '../src/ui/lib/map';

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

describe('map labels', () => {
  const overlap = (a: MapBox, b: MapBox) =>
    Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

  it('places every Threshold name clear of the other pins and names, inside the map', () => {
    const state = createInitialState(1, 'ascent_foot');
    state.discovered = Object.keys(SPOTS);
    const pins = mapNodes(state, 'threshold').map((n) => ({
      id: n.spot.id,
      x: n.spot.map!.x,
      y: n.spot.map!.y,
      text: n.spot.name,
    }));
    expect(pins.length).toBeGreaterThan(20);
    const at = placeLabels(pins);
    const boxes = pins.map((p) => ({ id: p.id, box: labelBox(p.text, at.get(p.id)!) }));
    for (const { id, box } of boxes) {
      expect(box.x0, id).toBeGreaterThanOrEqual(0);
      expect(box.x1, id).toBeLessThanOrEqual(100);
      for (const p of pins) {
        if (p.id === id) continue;
        const dot = { x0: p.x - 3.1, y0: p.y - 3.1, x1: p.x + 3.1, y1: p.y + 3.1 };
        expect(overlap(box, dot), `${id} on the ${p.id} pin`).toBe(0);
      }
      for (const other of boxes) {
        if (other.id !== id) expect(overlap(box, other.box), `${id} on ${other.id}`).toBe(0);
      }
    }
  });

  it('keeps a name under its pin when nothing is in the way', () => {
    const at = placeLabels([{ id: 'a', x: 50, y: 30, text: 'Somewhere' }]);
    expect(at.get('a')).toEqual({ x: 50, y: 36.4, anchor: 'middle' });
  });
});
