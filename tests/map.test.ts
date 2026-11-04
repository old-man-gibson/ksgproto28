import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { EventBus } from '../src/core/engine/events';
import { AREAS, FLOOR_BY_AREA, REGIONS, SPOTS } from '../src/core/registry';
import { buildPlan } from '../src/ui/lib/mapPlan';
import { climbTo } from '../src/core/systems/towers';
import { tickTravel, visibleEdges } from '../src/core/systems/locations';
import {
  DEFAULT_W,
  diagramFrame,
  labelBox,
  mapNodes,
  pinBox,
  placeLabels,
  tiledFrame,
  type LabelPin,
  type MapBox,
} from '../src/ui/lib/map';

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

  /** Threshold as the diagram draws it at a frame width: every pin projected, its name as a label. */
  function thresholdAt(width: number) {
    const state = createInitialState(1, 'ascent_foot');
    state.discovered = Object.keys(SPOTS);
    const nodes = mapNodes(state, 'threshold');
    const frame = diagramFrame(nodes.map((n) => n.spot.map!), width);
    const pins: LabelPin[] = nodes.map((n) => {
      const at = frame.project(n.spot.map!);
      return { id: n.spot.id, x: at.x, y: at.y, r: frame.pinR, text: n.spot.name };
    });
    return { frame, pins };
  }

  it('places every Threshold name clear of the pins and names, inside the frame, at the 818 px column', () => {
    const { frame, pins } = thresholdAt(DEFAULT_W);
    expect(frame.pinR).toBe(15);
    expect(frame.font).toBe(12);
    expect(pins.length).toBeGreaterThan(20);
    const at = placeLabels(pins, [], frame);
    const boxes = pins.map((p) => ({ id: p.id, box: labelBox(p.text, at.get(p.id)!, frame.font) }));
    for (const { id, box } of boxes) {
      expect(box.x0, id).toBeGreaterThanOrEqual(0);
      expect(box.x1, id).toBeLessThanOrEqual(frame.w);
      expect(box.y0, id).toBeGreaterThanOrEqual(0);
      expect(box.y1, id).toBeLessThanOrEqual(frame.h);
      for (const p of pins) {
        if (p.id === id) continue;
        expect(overlap(box, pinBox(p, p.r)), `${id} on the ${p.id} pin`).toBe(0);
      }
      for (const other of boxes) {
        if (other.id !== id) expect(overlap(box, other.box), `${id} on ${other.id}`).toBe(0);
      }
    }
  });

  it('keeps Threshold pins from touching each other at the column widths the layout gives', () => {
    for (const width of [560, 600, 788, 900, 1100]) {
      const { frame, pins } = thresholdAt(width);
      for (const a of pins) {
        for (const b of pins) {
          if (a.id >= b.id) continue;
          expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id} and ${b.id} at ${width}`).toBeGreaterThanOrEqual(2 * frame.pinR);
        }
      }
    }
  });

  it('keeps a name under its pin when nothing is in the way', () => {
    const frame = { w: 788, h: 340, font: 12 };
    const at = placeLabels([{ id: 'a', x: 400, y: 150, r: 15, text: 'Somewhere' }], [], frame);
    // Under the pin: below its rim, a 4 px gap, then the text's ascent.
    expect(at.get('a')).toEqual({ x: 400, y: 150 + 15 + 4 + 0.85 * 12, anchor: 'middle' });
  });

  it('moves a name off the chips standing above its pin', () => {
    const frame = { w: 788, h: 340, font: 12 };
    const chips: MapBox = { x0: 380, y0: 150 - 15 - 20, x1: 420, y1: 150 - 15 - 3 };
    const box = labelBox('Somewhere', placeLabels([{ id: 'a', x: 400, y: 150, r: 15, text: 'Somewhere', avoid: [chips], lift: 20 }], [], frame).get('a')!);
    expect(overlap(box, chips)).toBe(0);
  });
});

describe('names at the widths the layout gives', () => {
  const overlaps = (a: MapBox, b: MapBox) => Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0);

  /**
   * The widths the browser measured for `.map-wrap` (703 at a 1024 px window, 773 at 1094, 757 at 1440 with the
   * log column open, 1237 at 1920), and every 20 px from 680 to 1300.
   */
  const WIDTHS = [703, 757, 773, 1237];
  for (let w = 680; w <= 1300; w += 20) WIDTHS.push(w);

  /** Every region, and every floor of a tower, as a diagram. */
  const MAPS: { name: string; region: string; area: string | null; spot: string }[] = [];
  for (const region of Object.values(REGIONS)) {
    const areas = Object.values(AREAS).filter((a) => a.regionId === region.id);
    const floors = areas.filter((a) => FLOOR_BY_AREA.has(a.id));
    for (const area of floors.length ? floors : [null]) {
      const spot = Object.values(SPOTS).find(
        (s) => s.map && AREAS[s.areaId].regionId === region.id && (!area || s.areaId === area.id),
      );
      if (spot) MAPS.push({ name: area?.id ?? region.id, region: region.id, area: area?.id ?? null, spot: spot.id });
    }
  }

  it('covers every region and every floor', () => {
    expect(MAPS.length).toBe(23);
    expect(MAPS.some((m) => m.region === 'threshold')).toBe(true);
    expect(MAPS.filter((m) => m.region === "the_ascent").length).toBe(20);
  });

  it('touch nothing: no name on another name, a pin or a chip, and none outside the frame', () => {
    const problems: string[] = [];
    for (const m of MAPS) {
      const state = createInitialState(1, m.spot);
      state.discovered = Object.keys(SPOTS);
      for (const width of WIDTHS) {
        const plan = buildPlan(state, { region: m.region, area: m.area, width, tiled: false, focus: state.spot, target: null });
        const named = plan.nodes
          .filter((n) => n.label)
          .map((n) => ({ id: n.id, box: labelBox(n.label!.threat ? `${n.label!.name} · ${n.label!.threat}` : n.label!.name, n.label!, plan.frame.font) }));
        const chips = plan.nodes.flatMap((n) => [...n.chips, ...(n.more ? [n.more] : [])].map((c) => ({ id: n.id, box: { x0: c.x - 8, y0: c.y - 8, x1: c.x + 8, y1: c.y + 8 } })));
        for (const a of named) {
          const at = `${m.name} @${width}: ${a.id}`;
          if (a.box.x0 < 0 || a.box.x1 > plan.frame.w || a.box.y0 < 0 || a.box.y1 > plan.frame.h) problems.push(`${at} outside the frame`);
          for (const o of named) if (o.id > a.id && overlaps(a.box, o.box)) problems.push(`${at} on the name of ${o.id}`);
          for (const n of plan.nodes) if (n.id !== a.id && overlaps(a.box, pinBox(n, plan.frame.pinR))) problems.push(`${at} on the ${n.id} pin`);
          for (const c of chips) if (overlaps(a.box, c.box)) problems.push(`${at} on a chip of ${c.id}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('holds Threshold to zero at the four widths the browser measured', () => {
    // The pins themselves stay clear of each other too.
    const state = createInitialState(1, 'ascent_foot');
    state.discovered = Object.keys(SPOTS);
    for (const width of [703, 757, 773, 1237]) {
      const plan = buildPlan(state, { region: 'threshold', area: null, width, tiled: false, focus: state.spot, target: null });
      expect(plan.nodes.length).toBeGreaterThan(20);
      for (const a of plan.nodes) {
        expect(a.label, `${a.id} @${width}`).not.toBeNull();
        for (const b of plan.nodes) {
          if (a.id < b.id) expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id} and ${b.id} @${width}`).toBeGreaterThanOrEqual(2 * plan.frame.pinR);
        }
      }
    }
  });
});

describe('map frames', () => {
  it('stretches a diagram at most 8.1 px per unit across and 5.6 down, and centres it', () => {
    const frame = diagramFrame([{ x: 40, y: 20 }, { x: 60, y: 30 }], 788);
    const a = frame.project({ x: 40, y: 20 });
    const b = frame.project({ x: 60, y: 30 });
    expect((b.x - a.x) / 20).toBeCloseTo(8.1, 5);
    expect((b.y - a.y) / 10).toBeCloseTo(5.6, 5);
    expect(a.x + b.x).toBeCloseTo(788, 5);
    expect(a.y + b.y).toBeCloseTo(340, 5);
  });

  it('fits a tall spread inside the frame', () => {
    const frame = diagramFrame([{ x: 5, y: 5 }, { x: 95, y: 70 }], 788);
    for (const p of [{ x: 5, y: 5 }, { x: 95, y: 70 }]) {
      const at = frame.project(p);
      expect(at.x).toBeGreaterThanOrEqual(frame.pinR);
      expect(at.x).toBeLessThanOrEqual(788 - frame.pinR);
      expect(at.y).toBeGreaterThanOrEqual(frame.pinR);
      expect(at.y).toBeLessThanOrEqual(340 - frame.pinR);
    }
  });

  it('keeps a tiled picture at its own proportions on one scale', () => {
    const wide = tiledFrame(900);
    expect(wide.w).toBe(560);
    expect(wide.h).toBe(470);
    const a = wide.project({ x: 0, y: 0 });
    const b = wide.project({ x: 100, y: 75 });
    expect((b.x - a.x) / 100).toBeCloseTo((b.y - a.y) / 75, 5);
    // Six units of headroom above the picture.
    expect(a.y).toBeCloseTo((6 * 560) / 100, 5);
    expect(tiledFrame(300).tiled).toBe(true);
  });
});
