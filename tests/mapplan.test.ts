import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { AREAS, BANDS, FLOORS, SPOTS, TOWERS } from '../src/core/registry';
import { revealMapped } from '../src/core/systems/mapped';
import { findPath, visibleEdges } from '../src/core/systems/locations';
import { spawnMonster, spotCleared } from '../src/core/systems/combat';
import type { GameState, SpotDef } from '../src/core/types';
import { boxInCells, labelBox, pinBox, roadClasses, type MapBox } from '../src/ui/lib/map';
import { buildPlan, buildRouteDraw, groundFor, planThreats, stableThreats, type MapPlan } from '../src/ui/lib/mapPlan';
import { Game } from '../src/core/game';
import {
  legTime,
  nextTrail,
  noRouteSummary,
  routeInfo,
  routeLegs,
  routeSummary,
  spotThreat,
} from '../src/ui/lib/navigation';
import { clearFloors } from './fixtures/floors';

/**
 * The surveyed plan (docs/NAVIGATION.md §3, plans/navigation-alternatives.md
 * N3 and N5): what the map draws, worked out in pixels from state and a width.
 */

const FOOT = TOWERS.the_ascent.hubSpot;
const CITY = BANDS.ascent_upper;

/** A save standing at `spot`, `cleared` floors done, their landings and `extra` places discovered. */
function opened(spot: string, cleared: string[], extra: string[] = []): GameState {
  const s = createInitialState(0, spot);
  clearFloors(s.stats, cleared);
  s.stats['gold:earned'] = 1_000_000;
  s.stats['kills:tag:goblin'] = 1_000;
  for (const id of [FOOT, ...cleared.map((f) => FLOORS[f].landing!), ...extra]) {
    if (!s.discovered.includes(id)) s.discovered.push(id);
  }
  revealMapped(s);
  return s;
}

/** Every place discovered, the player at `spot`. */
function allKnown(spot: string): GameState {
  const s = createInitialState(1, spot);
  s.discovered = Object.keys(SPOTS);
  return s;
}

const BAND_ONE_TWO = ['ascent_f1', 'ascent_f2', 'ascent_f3'];
const TO_SIX = [...BAND_ONE_TWO, 'ascent_f4', 'ascent_f5', 'ascent_f6'];

function plan(state: GameState, region: string, area: string | null, width = 788, extra: Partial<Parameters<typeof buildPlan>[1]> = {}): MapPlan {
  return buildPlan(state, { region, area, width, tiled: false, focus: state.spot, target: null, ...extra });
}

const overlaps = (a: MapBox, b: MapBox) => Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0);

describe('districts', () => {
  const threshold = plan(allKnown(FOOT), 'threshold', null);

  it('tints a cell for every known pin and names each district inside its own cells', () => {
    const areas = new Set(threshold.nodes.map((n) => SPOTS[n.id].areaId));
    expect(areas.size).toBe(9);
    expect(threshold.districts.map((d) => d.area).sort()).toEqual([...areas].sort());
    expect(threshold.districts.flatMap((d) => d.cells)).toHaveLength(threshold.nodes.length);
    for (const d of threshold.districts) {
      const pins = threshold.nodes.filter((n) => SPOTS[n.id].areaId === d.area);
      // A district of one pin is named by that pin.
      if (pins.length < 2) {
        expect(d.name, d.area).toBeNull();
        continue;
      }
      expect(d.name, d.area).not.toBeNull();
      expect(d.name!.text).toBe(AREAS[d.area].name.toUpperCase());
      expect(boxInCells(d.name!.box, d.cells), `${d.area} name leaves its cells`).toBe(true);
      expect(d.name!.lines.join(' ')).toBe(d.name!.text);
    }
  });

  it('keeps every district name off the pins and the names of the places', () => {
    for (const d of threshold.districts) {
      if (!d.name) continue;
      for (const n of threshold.nodes) {
        expect(overlaps(d.name.box, pinBox(n, threshold.frame.pinR)), `${d.area} on the ${n.id} pin`).toBe(false);
        if (n.label) {
          const text = n.label.threat ? `${n.label.name} · ${n.label.threat}` : n.label.name;
          expect(overlaps(d.name.box, labelBox(text, n.label, threshold.frame.font)), `${d.area} on ${n.id}'s name`).toBe(false);
        }
      }
    }
  });

  it('adds no cell for a "?" pin, and names no district from one', () => {
    // Two places known, the rest of Threshold unmapped: the "?" pins are the Foot's neighbours.
    const s = createInitialState(1, FOOT);
    s.discovered = [FOOT, 'lectory_steps'];
    const p = plan(s, 'threshold', null);
    const ghosts = p.nodes.filter((n) => !n.known);
    expect(ghosts.length).toBeGreaterThan(0);
    expect(p.districts.flatMap((d) => d.cells)).toHaveLength(2);
    const known = new Set(p.nodes.filter((n) => n.known).map((n) => SPOTS[n.id].areaId));
    expect(p.districts.map((d) => d.area).sort()).toEqual([...known].sort());
    for (const g of ghosts) {
      expect(g.icon).toBe('❓');
      expect(g.label?.name).toBe('???');
      expect(g.label?.threat ?? null).toBeNull();
      expect(g.chips).toEqual([]);
    }
    for (const d of p.districts) expect(d.name).toBeNull();
  });

  it('draws no districts on a floor, which is one area', () => {
    const s = allKnown('f4_woods_edge');
    expect(plan(s, 'the_ascent', 'ascent_f4_area').districts).toEqual([]);
  });
});

describe('roads', () => {
  it('draws only roads the player can see', () => {
    const cases: [string, string, string | null][] = [
      [FOOT, 'threshold', null],
      ['f1_landing', 'the_ascent', 'ascent_f1_area'],
      ['f12_landing', 'the_ascent', 'ascent_f12_area'],
    ];
    for (const [spot, region, area] of cases) {
      const s = allKnown(spot);
      const p = plan(s, region, area);
      expect(p.roads.length).toBeGreaterThan(0);
      for (const road of p.roads) {
        const seen = visibleEdges(s, road.from).some((e) => e.to === road.to) || visibleEdges(s, road.to).some((e) => e.to === road.from);
        expect(seen, `${road.from} - ${road.to}`).toBe(true);
      }
    }
  });

  it('leaves a hidden road out, and the place at its end off the map', () => {
    const s = opened('f12_landing', [], ['f12_landing']);
    const cove = 'f12_hidden_cove';
    const on = () => plan(s, 'the_ascent', 'ascent_f12_area');
    expect(on().nodes.some((n) => n.id === cove)).toBe(false);
    // The quest names the cove; the road still waits for the landing to be searched.
    s.stats['flag:quest:f11_join_pirates:accepted'] = 1;
    expect(visibleEdges(s, 'f12_landing').some((e) => e.to === cove)).toBe(false);
    expect(on().nodes.some((n) => n.id === cove)).toBe(false);
    expect(on().roads.some((r) => r.from === cove || r.to === cove)).toBe(false);
  });

  it('classes roads by the junctions they join: hub roads widest, spurs narrowest', () => {
    expect(roadClasses([['hub', 'a'], ['hub', 'b'], ['hub', 'c'], ['hub', 'd'], ['hub', 'e'], ['hub', 'f']]).every((c) => c === 'main')).toBe(true);
    // Two junctions of three roads each: a road between them. The leaves hang off as paths.
    const pairs: [string, string][] = [['a', 'b'], ['a', 'x1'], ['a', 'x2'], ['b', 'y1'], ['b', 'y2']];
    expect(roadClasses(pairs)).toEqual(['road', 'path', 'path', 'path', 'path']);
    const p = plan(allKnown(FOOT), 'threshold', null);
    const rank = { path: 0, road: 1, main: 2 };
    const foot = p.roads.filter((r) => r.from === FOOT || r.to === FOOT);
    expect(foot.every((r) => r.cls === 'main')).toBe(true);
    expect(p.roads.some((r) => rank[r.cls] < rank.main)).toBe(true);
  });

  it('marks a road with no road back by an arrowhead into the pin it leads to', () => {
    const s = allKnown('f7_docks');
    const p = plan(s, 'the_ascent', 'ascent_f7_area');
    const out = p.roads.find((r) => r.from === 'f7_chiefs_tent' && r.to === 'f7_docks');
    expect(out, 'the Back Gate road').toBeTruthy();
    expect(out!.head).not.toBeNull();
    const docks = p.nodes.find((n) => n.id === 'f7_docks')!;
    const tip = out!.head![0];
    expect(Math.hypot(tip.x - docks.x, tip.y - docks.y)).toBeCloseTo(p.frame.pinR + 2, 5);
    // An arrowhead says there is no road back, and no other road says it.
    for (const r of p.roads) {
      const back = visibleEdges(s, r.to).some((e) => e.to === r.from);
      expect(r.head === null, `${r.from} - ${r.to}`).toBe(back);
    }
  });

  it('paints a forced road red and rings the pin it leads into, from the road alone', () => {
    const s = allKnown('f12_landing');
    const p = plan(s, 'the_ascent', 'ascent_f12_area');
    const road = p.roads.find((r) => r.key === ['f12_landing', 'f12_strait'].sort().join('|'))!;
    expect(road.forced).toBe(true);
    const ring = (id: string) => p.nodes.find((n) => n.id === id)!;
    expect(ring('f12_strait').ringed).toBe(true);
    // The way back out of an ambush is not an ambush.
    expect(ring('f12_landing').ringed).toBe(false);
    // The strait itself does not force a fight: the ring is not the ⚔️.
    expect(ring('f12_strait').menace).toBe(false);
  });

  it('rings a forced place and drops the ring once it is cleared', () => {
    const s = allKnown('f1_landing');
    const before = plan(s, 'the_ascent', 'ascent_f1_area');
    const hall = before.nodes.find((n) => n.id === 'f1_toll_hall')!;
    expect(hall.ringed).toBe(true);
    expect(hall.menace).toBe(true);
    expect(before.roads.filter((r) => r.from === 'f1_toll_hall' || r.to === 'f1_toll_hall').every((r) => r.forced)).toBe(true);
    s.stats['fights:f1_toll_hall'] = SPOTS.f1_toll_hall.fightLimit!;
    expect(spotCleared(s, SPOTS.f1_toll_hall)).toBe(true);
    const after = plan(s, 'the_ascent', 'ascent_f1_area');
    const cleared = after.nodes.find((n) => n.id === 'f1_toll_hall')!;
    expect(cleared.ringed).toBe(false);
    expect(after.roads.some((r) => r.forced)).toBe(false);
  });

  it('shows a shut road as a gap with a bar across it, and a road that opens closes the gap', () => {
    // The door into the office section waits for the clerk's daybook.
    const s = allKnown('f1_forms');
    const key = ['f1_forms', 'f1_reception'].sort().join('|');
    const shutAt = (st: GameState) => plan(st, 'the_ascent', 'ascent_f1_area').roads.find((r) => r.key === key)!;
    const road = shutAt(s);
    expect(road.shut).not.toBeNull();
    expect(road.shut!.terms).toMatch(/\S/);
    const [first, second] = road.shut!.pieces;
    // Two pieces of road, with room between them for the bar.
    const gap = Math.hypot(second[0].x - first[1].x, second[0].y - first[1].y);
    expect(gap).toBeGreaterThan(8);
    const mid = { x: (road.a.x + road.b.x) / 2, y: (road.a.y + road.b.y) / 2 };
    const [b0, b1] = road.shut!.bar;
    expect((b0.x + b1.x) / 2).toBeCloseTo(mid.x, 5);
    expect((b0.y + b1.y) / 2).toBeCloseTo(mid.y, 5);
    // The bar crosses the road at right angles.
    const dot = (b1.x - b0.x) * (road.b.x - road.a.x) + (b1.y - b0.y) * (road.b.y - road.a.y);
    expect(Math.abs(dot)).toBeLessThan(1e-6);
    s.stats['flag:key_item:toll_clerk_book'] = 1;
    expect(shutAt(s).shut).toBeNull();
  });
});

describe('ground', () => {
  it('comes from the area, else from the scene', () => {
    expect(plan(allKnown('f4_woods_edge'), 'the_ascent', 'ascent_f4_area').ground).toBe('grass');
    expect(plan(allKnown('f1_landing'), 'the_ascent', 'ascent_f1_area').ground).toBe('flags');
    expect(plan(allKnown(FOOT), 'threshold', null).ground).toBe('cobbles');
    expect(plan(allKnown('f5_causeway'), 'the_ascent', 'ascent_f5_area').ground).toBe('water');
    expect(groundFor(SPOTS.f6_warren_mouth)).toBe('crypt');
  });

  it('is the picture, not code, on a tiled region', () => {
    const s = createInitialState(1, 'f0_gate');
    const p = buildPlan(s, { region: 'holding_level', area: null, width: 900, tiled: true, focus: s.spot, target: null });
    expect(p.ground).toBeNull();
    expect(p.frame.tiled).toBe(true);
    expect(p.frame.w).toBe(560);
    expect(p.districts).toEqual([]);
  });
});

describe('region exits', () => {
  it('keeps the exit at the gate, and the tutorial classes follow its pointer', () => {
    const s = createInitialState(1, 'f0_gate');
    s.discovered = [...new Set([...s.discovered, 'f0_gate'])];
    const idle = buildPlan(s, { region: 'holding_level', area: null, width: 560, tiled: true, focus: s.spot, target: null });
    expect(idle.exits.map((e) => e.to)).toEqual(['ascent_foot']);
    expect(idle.exits[0].label).toBe('Threshold');
    expect(idle.exits[0].pointed).toBe(false);
    const pointed = buildPlan(s, { region: 'holding_level', area: null, width: 560, tiled: true, focus: s.spot, target: 'exit:ascent_foot' });
    expect(pointed.exits[0].pointed).toBe(true);
    expect(pointed.exits[0].arrow).not.toBeNull();
    // The label sits clear of the frame's edge, to the right of its pin or, when it would not fit, the left.
    const gate = pointed.nodes.find((n) => n.id === 'f0_gate')!;
    expect(pointed.exits[0].anchor).toBe(pointed.exits[0].x > gate.x ? 'start' : 'end');
    expect(pointed.nodes.find((n) => n.pointed)).toBeUndefined();
  });

  it('points at a pin by id', () => {
    const s = createInitialState(1, 'f0_cell');
    const p = buildPlan(s, { region: 'holding_level', area: null, width: 560, tiled: true, focus: s.spot, target: 'spot:f0_cellblock' });
    expect(p.nodes.filter((n) => n.pointed).map((n) => n.id)).toEqual(['f0_cellblock']);
  });
});

describe('names in a narrow frame', () => {
  it('labels every pin at the column width, and only here and its neighbours below 560 px', () => {
    const s = allKnown('chancery_arch');
    const wide = plan(s, 'threshold', null, 788);
    expect(wide.nodes.every((n) => n.label)).toBe(true);
    const narrow = plan(s, 'threshold', null, 420);
    const named = narrow.nodes.filter((n) => n.label).map((n) => n.id).sort();
    const near = [s.spot, ...visibleEdges(s, s.spot).map((e) => e.to)].filter((id) => narrow.nodes.some((n) => n.id === id)).sort();
    expect(named).toEqual(near);
    expect(named.length).toBeLessThan(narrow.nodes.length);
    expect(narrow.frame.pinR).toBeLessThan(wide.frame.pinR);
  });

  it('keeps the names that are drawn clear of every pin', () => {
    const s = allKnown('chancery_arch');
    const p = plan(s, 'threshold', null, 420);
    for (const n of p.nodes) {
      if (!n.label) continue;
      const box = labelBox(n.label.threat ? `${n.label.name} · ${n.label.threat}` : n.label.name, n.label, p.frame.font);
      for (const o of p.nodes) if (o.id !== n.id) expect(overlaps(box, pinBox(o, p.frame.pinR)), `${n.id} on ${o.id}`).toBe(false);
    }
  });
});

describe('feature chips', () => {
  it('are static: the same plan twice, and one chip per feature up to four, then a count', () => {
    const s = allKnown(FOOT);
    const a = plan(s, 'threshold', null);
    const b = plan(s, 'threshold', null);
    expect(a.nodes.map((n) => n.chips)).toEqual(b.nodes.map((n) => n.chips));
    const forges = a.nodes.find((n) => n.id === 'the_forges')!;
    expect(forges.chips.length).toBeGreaterThan(0);
    expect(forges.chips.length).toBeLessThanOrEqual(4);
    for (const n of a.nodes) {
      if (n.more) expect(n.chips).toHaveLength(4);
    }
  });
});

describe('threat text', () => {
  it('reads the level range of what a place can roll', () => {
    const s = opened('f4_woods_edge', TO_SIX.slice(0, 3), ['f4_woods_edge']);
    expect(spotThreat(s, SPOTS.f4_woods_edge)).toBe('L7-9');
    const p = plan(s, 'the_ascent', 'ascent_f4_area');
    expect(p.nodes.find((n) => n.id === 'f4_woods_edge')!.label?.threat).toBe('L7-9');
  });

  const RAT = 'forest_rat';
  const line = (level: [number, number], extra: object = {}) => ({ monsterId: RAT, weight: 1, level, ...extra });
  const woods = (encounters: SpotDef['encounters']): SpotDef => ({ ...SPOTS.f4_woods_edge, id: 'threat_probe', fightLimit: undefined, encounters });

  it('prints one number when the range is one level', () => {
    expect(spotThreat(createInitialState(0), woods([line([5, 5])]))).toBe('L5');
  });

  it('leaves out a line that is gated, and prints nothing when every line is', () => {
    const s = createInitialState(0);
    const gated = line([30, 40], { requires: [{ type: 'stat', key: 'flag:never', value: 1 }] });
    expect(spotThreat(s, woods([line([6, 8]), gated]))).toBe('L6-8');
    expect(spotThreat(s, woods([gated]))).toBeNull();
    s.stats['flag:never'] = 1;
    expect(spotThreat(s, woods([line([6, 8]), gated]))).toBe('L6-40');
  });

  it('leaves out a slain once line', () => {
    const s = createInitialState(0);
    const once = line([30, 40], { once: true });
    const spot = woods([line([6, 8]), once]);
    expect(spotThreat(s, spot)).toBe('L6-40');
    s.stats[`slain:${spot.id}:${RAT}`] = 1;
    expect(spotThreat(s, spot)).toBe('L6-8');
  });

  it('leaves out an ambush window, which is meant to be met', () => {
    const s = createInitialState(0);
    const ambush = line([30, 40], { window: { min: 0, max: 1e12 } });
    expect(spotThreat(s, woods([line([6, 8]), ambush]))).toBe('L6-8');
    expect(spotThreat(s, woods([ambush]))).toBeNull();
  });

  it('quotes the levels a fight there spawns at, steps and dynamic levels included', () => {
    // Band 2 raises levels with the player (dynamic levels); the number on the pin must be the one the fight shows.
    for (const level of [1, 30, 80]) {
      const s = opened('f4_woods_edge', BAND_ONE_TWO);
      s.level = level;
      const spot = SPOTS.f4_woods_edge;
      const text = spotThreat(s, spot)!;
      const m = /^L(\d+)(?:-(\d+))?$/.exec(text)!;
      const lo = Number(m[1]);
      const top = m[2] === undefined ? lo : Number(m[2]);
      const seen: number[] = [];
      for (let i = 0; i < 200; i++) seen.push(spawnMonster(s, spot).level);
      expect(Math.min(...seen), `level ${level}: ${text}`).toBeGreaterThanOrEqual(lo);
      expect(Math.max(...seen), `level ${level}: ${text}`).toBeLessThanOrEqual(top);
      // And the range is not slack: spawns reach both ends of it within 200 rolls.
      expect(Math.min(...seen)).toBe(lo);
      expect(Math.max(...seen)).toBe(top);
    }
  });

  it('hands the plan the same Map while no range changes: idle ticks, fight ticks and a walk', () => {
    // `planThreats` reads the clock through `eligibleEncounters`, and builds a new Map on every call. The plan
    // rebuilds when the Map it is given changes identity, so identity must follow the ranges and nothing else.
    const g = new Game(opened('f4_woods_edge', BAND_ONE_TWO, ['f4_treeline', 'f4_woods_edge']));
    g.state.level = 24;
    let cache: ReadonlyMap<string, string> = new Map();
    const raw = new Set<ReadonlyMap<string, string>>();
    const seen: string[] = [];
    let handedOut = 0;
    let calls = 0;
    const look = () => {
      const now = planThreats(g.state, 'the_ascent', 'ascent_f4_area');
      raw.add(now);
      calls++;
      const next = stableThreats(cache, now);
      if (next !== cache) handedOut++;
      cache = next;
      seen.push([...now].map(([id, t]) => `${id}=${t}`).join(';'));
    };
    look();
    for (let i = 0; i < 30; i++) {
      g.tick();
      look();
    }
    g.selectActivity('hunt');
    for (let i = 0; i < 30; i++) {
      g.tick();
      look();
    }
    g.selectActivity(null);
    g.travelTo('f4_treeline');
    for (let i = 0; i < 200 && g.state.travel; i++) {
      g.tick();
      look();
    }
    expect(g.state.spot).toBe('f4_treeline');
    expect(calls).toBeGreaterThan(60);
    // The cause: every call returns a new Map.
    expect(raw.size).toBe(calls);
    // The fix: a new Map only where the text changed (the first look counts).
    const changes = 1 + seen.slice(1).filter((text, i) => text !== seen[i]).length;
    expect(handedOut).toBe(changes);
    expect(handedOut).toBeLessThan(5);
  });

  it('keeps the previous Map when an equal one arrives, and takes the new one when an entry differs or goes', () => {
    const a = new Map([['x', 'L1'], ['y', 'L2-3']]);
    expect(stableThreats(a, new Map(a))).toBe(a);
    const b = new Map([['x', 'L1'], ['y', 'L2-4']]);
    expect(stableThreats(a, b)).toBe(b);
    const c = new Map([['x', 'L1']]);
    expect(stableThreats(a, c)).toBe(c);
    const d = new Map([['x', 'L1'], ['z', 'L2-3']]);
    expect(stableThreats(a, d)).toBe(d);
  });

  it('prints nothing for a place with nothing left to fight', () => {
    const s = createInitialState(0);
    const spot: SpotDef = { ...woods([line([6, 8])]), fightLimit: 2 };
    expect(spotThreat(s, spot)).toBe('L6-8');
    s.stats[`fights:${spot.id}`] = 2;
    expect(spotThreat(s, spot)).toBeNull();
  });
});

describe('the route line', () => {
  const GRANARY_GATE = 'granary_gate';

  it('names each leg and its time: roads and a ladder ride', () => {
    const s = opened(GRANARY_GATE, BAND_ONE_TWO, ['f4_treeline', 'f4_woods_edge']);
    const path = findPath(s, s.spot, 'f4_woods_edge')!;
    expect(path).toEqual([FOOT, 'f4_treeline', 'f4_woods_edge']);
    const legs = routeLegs(s.spot, path, 1);
    expect(legs.map((l) => l.ride)).toEqual([false, true, false]);
    expect(routeSummary(s, 'Route', legs)).toEqual({
      head: 'Route to The Woods Edge: 3 legs, 21 s.',
      rest: 'The Granary Gate → The Foot of the Ascent 1.2 s → ride to Floor 4 18 s → The Woods Edge 2 s',
    });
    expect(routeSummary(s, 'Journey', legs.slice(0, 1)).head).toBe('Journey to The Foot of the Ascent: 1 leg, 1.2 s.');
  });

  it('charges each leg what startTravel charges, at the speed given', () => {
    const s = opened(FOOT, BAND_ONE_TWO, ['f4_treeline']);
    const [ride] = routeLegs(FOOT, ['f4_treeline'], 1.5);
    expect(ride.ticks).toBe(Math.round((4 * 45) / 1.5));
    expect(ride.ride).toBe(true);
    expect(routeInfo(s, 'f4_treeline', 1.5).ticks).toBe(ride.ticks);
  });

  it('never names a place the player has not been', () => {
    const s = opened(FOOT, BAND_ONE_TWO, ['f4_treeline']);
    s.discovered.splice(s.discovered.indexOf('f4_treeline'), 1);
    const legs = routeLegs(FOOT, ['f4_treeline'], 1);
    const line = routeSummary(s, 'Journey', legs);
    expect(line.head).toBe('Journey to Unknown place: 1 leg, 18 s.');
    expect(line.rest).toBe('The Foot of the Ascent → ride to Unknown place 18 s');
  });

  it('writes a time to the tenth of a second below ten, whole seconds above', () => {
    expect(legTime(12)).toBe('1.2 s');
    expect(legTime(20)).toBe('2 s');
    expect(legTime(8)).toBe('0.8 s');
    expect(legTime(180)).toBe('18 s');
    expect(legTime(99)).toBe('9.9 s');
    expect(legTime(635)).toBe('1m 4s');
  });

  it('remembers the legs walked: grows with each leg, resets for a new journey and at rest', () => {
    expect(nextTrail([], { from: 'a', to: 'b' })).toEqual(['a', 'b']);
    const t1 = ['a', 'b'];
    expect(nextTrail(t1, { from: 'a', to: 'b' })).toBe(t1);
    expect(nextTrail(t1, { from: 'b', to: 'c' })).toEqual(['a', 'b', 'c']);
    expect(nextTrail(['a', 'b', 'c'], { from: 'x', to: 'y' })).toEqual(['x', 'y']);
    expect(nextTrail(['a', 'b'], null)).toEqual([]);
    const empty: string[] = [];
    expect(nextTrail(empty, null)).toBe(empty);
  });
});

describe('the route line when there is no route', () => {
  it('says nothing more for a hidden road', () => {
    const s = opened('f12_landing', [], ['f12_landing', 'f12_hidden_cove']);
    s.discovered.push(...Object.keys(SPOTS).filter((id) => id.startsWith('f12_')));
    const info = routeInfo(s, 'f12_hidden_cove', 1);
    expect(info.path).toBeNull();
    expect(noRouteSummary(s, 'f12_hidden_cove', info)).toEqual({ head: 'No open route to The Hidden Cove.', rest: '' });
  });

  it('says nothing more for an uncleared forced place in the way', () => {
    const s = allKnown('f12_landing');
    const info = routeInfo(s, 'f12_isle', 1);
    expect(info.path).toBeNull();
    expect(info.shut).toBeUndefined();
    expect(noRouteSummary(s, 'f12_isle', info).rest).toBe('');
  });

  it('gives the terms of a ride the ladder refuses', () => {
    const s = opened(FOOT, TO_SIX, [FLOORS.ascent_f7.landing!]);
    expect(findPath(s, FOOT, FLOORS.ascent_f7.landing!)).toBeNull();
    const line = noRouteSummary(s, FLOORS.ascent_f7.landing!, routeInfo(s, FLOORS.ascent_f7.landing!, 1));
    expect(line.head).toMatch(/^No open route to /);
    expect(line.rest).toMatch(/^Floor 7: /);
    expect(line.rest).toContain(SPOTS[CITY.hub!].name);
    // The hub's own terms.
    s.discovered.push(CITY.hub!);
    const hub = noRouteSummary(s, CITY.hub!, routeInfo(s, CITY.hub!, 1));
    expect(hub.rest).toContain('Key to the City');
  });

  it('gives no terms for a floor or a hub the ladder has not named', () => {
    const s = opened(FOOT, BAND_ONE_TWO, [FLOORS.ascent_f11.landing!, CITY.hub!]);
    const info = routeInfo(s, FLOORS.ascent_f11.landing!, 1);
    expect(info.path).toBeNull();
    expect(noRouteSummary(s, FLOORS.ascent_f11.landing!, info).rest).toBe('');
    // Floors 4 to 6 are not cleared, so the city's hub is sealed and its band not shown.
    const hub = routeInfo(s, CITY.hub!, 1);
    expect(hub.path).toBeNull();
    expect(noRouteSummary(s, CITY.hub!, hub).rest).toBe('');
  });

  it('gives the terms of a shut road the player can see, as the hover card does', () => {
    const s = allKnown('f1_forms');
    const info = routeInfo(s, 'f1_reception', 1);
    expect(info.path).toBeNull();
    expect(info.shut).toBeTruthy();
    expect(noRouteSummary(s, 'f1_reception', info).rest).toBe(`Shut: ${info.shut}`);
  });

  it('gives no terms for a shut road that is not revealed yet', () => {
    // The way on from the storerooms is hidden until six fights are won, and shut by the same count.
    const s = allKnown('f1_storerooms');
    expect(visibleEdges(s, 'f1_storerooms').some((e) => e.to === 'f1_bonded_deep')).toBe(false);
    const info = routeInfo(s, 'f1_bonded_deep', 1);
    expect(info.path).toBeNull();
    expect(noRouteSummary(s, 'f1_bonded_deep', info).rest).toBe('');
  });
});

describe('the route drawn over the plan', () => {
  const s = allKnown(FOOT);
  const p = plan(s, 'threshold', null);
  const legsOf = (path: string[], from = FOOT) => routeLegs(from, path, 1);

  it('draws each road leg between its two pins, with its time, and the preview has no marker', () => {
    const draw = buildRouteDraw(p, legsOf(findPath(s, FOOT, 'the_forges')!), legTime, null);
    expect(draw.legs.map((l) => l.time)).toEqual(['1.2 s', '0.8 s']);
    expect(draw.legs.every((l) => l.state === 'preview')).toBe(true);
    const foot = p.nodes.find((n) => n.id === FOOT)!;
    expect(draw.legs[0].a).toEqual({ x: foot.x, y: foot.y });
    expect(draw.marker).toBeNull();
    expect(draw.ladders).toEqual([]);
  });

  it('keeps each leg time clear of the pins and names where there is room', () => {
    const draw = buildRouteDraw(p, legsOf(findPath(s, FOOT, 'the_forges')!), legTime, null);
    for (const leg of draw.legs) {
      const box = labelBox(leg.time, { ...leg.at, anchor: 'middle' }, 11);
      for (const n of p.nodes) expect(overlaps(box, pinBox(n, p.frame.pinR)), `${leg.key} on ${n.id}`).toBe(false);
    }
  });

  it('while walking: legs done and under way are solid, the rest dashed, a marker rides the leg under way', () => {
    const legs = legsOf(findPath(s, FOOT, 'the_forges')!);
    const draw = buildRouteDraw(p, legs, legTime, { current: 0, fraction: 0.5 });
    expect(draw.legs.map((l) => l.state)).toEqual(['now', 'todo']);
    const [a, b] = [draw.legs[0].a, draw.legs[0].b];
    expect(draw.marker).toEqual({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const later = buildRouteDraw(p, legs, legTime, { current: 1, fraction: 0 });
    expect(later.legs.map((l) => l.state)).toEqual(['done', 'now']);
    expect(later.marker).toEqual(later.legs[1].a);
  });

  it('draws only the legs on the map shown: a ride has no line, and a leg to another map is left out', () => {
    // From floor 4 to a Threshold pin: the ride leaves floor 4, so only the Threshold legs lie on this map.
    const at4 = opened('f4_woods_edge', BAND_ONE_TWO, ['f4_woods_edge']);
    const path = findPath(at4, 'f4_woods_edge', 'the_forges')!;
    expect(path[0]).toBe(FOOT);
    const legs = routeLegs('f4_woods_edge', path, 1);
    expect(legs[0].ride).toBe(true);
    const draw = buildRouteDraw(plan(at4, 'threshold', null), legs, legTime, null);
    expect(draw.legs.map((l) => `${l.key}`)).toEqual([`${FOOT}>wrights_gate`, 'wrights_gate>the_forges']);
    expect(draw.ladders).toEqual([]);
    // The same route on floor 4's map: no road leg lies there, and the ride's departure is on it.
    const floor = buildRouteDraw(plan(at4, 'the_ascent', 'ascent_f4_area'), legs, legTime, null);
    expect(floor.legs).toEqual([]);
    expect(floor.ladders).toHaveLength(1);
  });

  it('marks where a ride leaves the map shown, and the marker waits there while it runs', () => {
    const atFoot = opened(FOOT, BAND_ONE_TWO, ['f4_treeline']);
    const legs = routeLegs(FOOT, ['f4_treeline'], 1);
    const onThreshold = plan(atFoot, 'threshold', null);
    const draw = buildRouteDraw(onThreshold, legs, legTime, { current: 0, fraction: 0.3 });
    expect(draw.legs).toEqual([]);
    expect(draw.ladders).toHaveLength(1);
    const foot = onThreshold.nodes.find((n) => n.id === FOOT)!;
    // Above and to the right of the pin, clear of its icon.
    expect(draw.ladders[0].x).toBeGreaterThan(foot.x);
    expect(draw.ladders[0].y).toBeLessThan(foot.y - onThreshold.frame.pinR);
    expect(draw.marker).not.toBeNull();
  });
});

describe('Threshold pins at the 818 px column', () => {
  it('stay apart, each name sits clear, and the plan lies inside the frame', () => {
    const p = plan(allKnown(FOOT), 'threshold', null, 788);
    for (const n of p.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(p.frame.pinR);
      expect(n.x).toBeLessThanOrEqual(p.frame.w - p.frame.pinR);
      expect(n.y).toBeGreaterThanOrEqual(p.frame.pinR);
      expect(n.y).toBeLessThanOrEqual(p.frame.h - p.frame.pinR);
      expect(n.label, n.id).not.toBeNull();
    }
  });
});
