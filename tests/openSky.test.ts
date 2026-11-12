import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { EventBus } from '../src/core/engine/events';
import { AREAS, FLOORS, SPOTS, skyRegionOf } from '../src/core/registry';
import {
  darknessFactor,
  moonlightOn,
  skyDarkness,
  skyKindAt,
  sunlight,
  tickExposure,
} from '../src/core/systems/exposure';
import { WEATHER_KINDS } from '../src/core/data/climate.data';

/**
 * The open sky of the tower (user ruling, 2026-11-11): every tower area is open
 * sky except floors 1 to 3, the castle of the floors 7 to 10 band and the Vermin
 * Festival (floors 15 and 16, all of it). Inside an open area a spot that is
 * inside carries the `indoor` tag. docs/WEATHER.md has the per-floor table.
 */

const CREATED = 20260804;
const at = (d: number, h = 0) => (d * 1440 + h * 60) * 10;

/** The areas that stay roofed: the Ascent's `sheltered` is not overridden. */
const ROOFED_AREAS = new Set([
  'ascent_f1_area',
  'ascent_f2_area',
  'ascent_f3_area',
  'ascent_castle_area',
  'ascent_f15_area',
  'ascent_f16_area',
]);

/** The tower's areas: every floor's, and the castle, which no floor claims. */
const TOWER_AREAS = [...Object.values(FLOORS).map((f) => f.areaId), 'ascent_castle_area'];

/** Spots inside an open area that carry `indoor`, by floor (the text names a roof, a cave, a tomb or a building). */
const INDOOR_SPOTS: Record<string, string[]> = {
  f7: ['f7_chiefs_tent'],
  f8: ['f8_lodge'],
  f9: ['f9_ossuary'],
  f10: ['f10_quarry', 'f10_foundry'],
  f19: ['f19_side_tomb', 'f19_entrance', 'f19_gallery', 'f19_chamber', 'f19_treasury'],
  f20: ['f20_warehouses'],
};

/** Spots whose text does not name a roof, a cave, a tomb or a building: open until it does. */
const LEFT_OPEN = [
  'f0_gate',
  'f5_cave_mouth',
  'f5_back_door',
  'f6_warren_mouth',
  'f7_watchtowers',
  'f10_artificers_row',
  'f11_gatehouse',
  'f14_beast_lair',
  'f18_tomb_row',
  'f19_valley',
  'f19_door',
  'f20_notice_wall',
];

/** One open spot per floor that is open sky, for the night checks. */
const NIGHT_SPOT: Record<number, string> = {
  7: 'f7_docks',
  8: 'f8_forest_gate',
  9: 'f9_cathedral_close',
  10: 'f10_artificers_row',
  11: 'f11_road',
  12: 'f12_landing',
  13: 'f13_landing',
  14: 'f14_landing',
  18: 'f18_well_head',
  19: 'f19_causeway',
  20: 'f20_river_road',
};

function stateAt(spot: string, ticks: number) {
  const state = createInitialState(CREATED, spot);
  state.totalTicks = ticks;
  return state;
}

const spotsOf = (areaId: string) => Object.values(SPOTS).filter((s) => s.areaId === areaId);

describe('the tower is open sky unless an area is on the roofed list', () => {
  it('walks floors 0 to 20 and the castle: roofed areas have a sheltered sky, every other area an open one', () => {
    expect(Object.values(FLOORS).length).toBeGreaterThanOrEqual(21);
    for (const areaId of TOWER_AREAS) {
      const spots = spotsOf(areaId);
      expect(spots.length, areaId).toBeGreaterThan(0);
      const roofed = ROOFED_AREAS.has(areaId);
      for (const spot of spots) {
        // The region the spot's sky is read from, with the area's override applied.
        const sky = skyRegionOf(spot.id);
        expect(!!sky?.sheltered, `${spot.id} in ${areaId}: sheltered`).toBe(roofed);
      }
    }
  });

  it('a spot has no sky exactly when its area is roofed or it carries indoor', () => {
    const state = stateAt('f12_landing', at(40, 12));
    for (const areaId of TOWER_AREAS) {
      for (const spot of spotsOf(areaId)) {
        const noSky = ROOFED_AREAS.has(areaId) || !!spot.tags?.includes('indoor');
        const kind = skyKindAt(state, spot.id);
        expect(kind === null, `${spot.id}: ${kind}`).toBe(noSky);
        if (kind !== null) expect(WEATHER_KINDS, spot.id).toContain(kind);
      }
    }
  });

  it('the floors that set sheltered: false are exactly the open Ascent floors', () => {
    const open = Object.values(FLOORS)
      .filter((f) => AREAS[f.areaId].regionId === 'the_ascent' && AREAS[f.areaId].sheltered === false)
      .map((f) => f.index);
    // Floor 17 reads the Malgeri range's sky through `skyRegionId` and floor 0 is not in the Ascent's region.
    expect(open).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 18, 19, 20]);
  });
});

describe('inside spots of an open area', () => {
  it('every named spot is roofed by its tag and not by its area', () => {
    for (const [floor, ids] of Object.entries(INDOOR_SPOTS)) {
      for (const id of ids) {
        const spot = SPOTS[id];
        expect(spot, id).toBeDefined();
        expect(AREAS[spot.areaId].sheltered, `${id} (${floor}): area open`).toBe(false);
        expect(spot.tags, id).toContain('indoor');
        expect(skyKindAt(stateAt(id, at(40, 12)), id), id).toBeNull();
      }
    }
  });

  it('floor 0: the cell and the cellblock stay roofed, the field is open', () => {
    expect(skyKindAt(stateAt('f0_cell', at(40, 12)), 'f0_cell')).toBeNull();
    expect(skyKindAt(stateAt('f0_cellblock', at(40, 12)), 'f0_cellblock')).toBeNull();
    expect(skyKindAt(stateAt('f0_field', at(40, 12)), 'f0_field')).not.toBeNull();
  });

  it('the spots judged open still have a sky', () => {
    for (const id of LEFT_OPEN) {
      expect(SPOTS[id], id).toBeDefined();
      expect(SPOTS[id].tags ?? [], id).not.toContain('indoor');
      expect(skyKindAt(stateAt(id, at(40, 12)), id), id).not.toBeNull();
    }
  });

  it('no spot of the Vermin Festival is open, the herb yard and the arena included', () => {
    for (const id of ['f15_herb_yard', 'f16_arena', 'f15_dark_room', 'f15_hall']) {
      expect(skyKindAt(stateAt(id, at(40, 12)), id), id).toBeNull();
    }
  });
});

describe('weather on the new floors', () => {
  it('a floor 12 spot has a sky; a festival spot and a floor 1 spot have none', () => {
    const state = stateAt('f12_landing', at(40, 12));
    const kind = skyKindAt(state, 'f12_landing');
    expect(kind).not.toBeNull();
    expect(WEATHER_KINDS).toContain(kind);
    expect(skyKindAt(state, 'f16_arena')).toBeNull();
    expect(skyKindAt(state, 'f15_herb_yard')).toBeNull();
    expect(skyKindAt(state, 'f1_landing')).toBeNull();
  });

  it('floors 7 to 14 and 18 to 20 read the one sky the Ascent pins, so two floors share a kind at one tick', () => {
    const kinds = new Set<string>();
    for (const spot of Object.values(NIGHT_SPOT)) {
      const state = stateAt(spot, at(120, 9));
      kinds.add(String(skyKindAt(state, spot)));
    }
    expect(kinds.size).toBe(1);
  });

  it('weather changes over 120 days on floor 12 and on floor 18 (it is not a fixed still)', () => {
    const seen = new Set<string>();
    for (let d = 1; d < 120; d++) {
      seen.add(String(skyKindAt(stateAt('f12_landing', at(d, 12)), 'f12_landing')));
      seen.add(String(skyKindAt(stateAt('f18_well_head', at(d, 12)), 'f18_well_head')));
    }
    expect(seen.has('still')).toBe(false);
    expect(seen.size).toBeGreaterThan(2);
  });
});

describe('the night on the new floors', () => {
  it('is dark and moonlit under the open sky, and teaches Darkvision', () => {
    for (const [floor, spot] of Object.entries(NIGHT_SPOT)) {
      const state = stateAt(spot, at(3, 23));
      const moon = moonlightOn(state);
      expect(moon, `f${floor} ${spot}: moonlight`).not.toBeNull();
      expect(darknessFactor(state), `f${floor} ${spot}`).toBeCloseTo(skyDarkness(23, moon!.lit), 12);
      expect(darknessFactor(state), `f${floor} ${spot}`).toBeGreaterThan(0);

      tickExposure(state, new EventBus());
      expect(state.skills.darkvision?.xp ?? 0, `f${floor} ${spot}: darkvision xp`).toBeGreaterThan(0);
    }
  });

  it('is not dark by day', () => {
    for (const spot of Object.values(NIGHT_SPOT)) {
      expect(darknessFactor(stateAt(spot, at(3, 12))), spot).toBe(0);
    }
  });

  it('is not dark at an inside spot, and is not dark on a roofed floor', () => {
    for (const ids of Object.values(INDOOR_SPOTS)) {
      for (const id of ids) {
        const state = stateAt(id, at(3, 23));
        expect(darknessFactor(state), id).toBe(0);
        expect(moonlightOn(state), id).toBeNull();
      }
    }
    for (const id of ['f15_herb_yard', 'f16_arena', 'castle_court', 'f1_landing']) {
      const state = stateAt(id, at(3, 23));
      expect(darknessFactor(state), id).toBe(0);
      expect(moonlightOn(state), id).toBeNull();
    }
  });

  it('lets the sun in by day at an open spot and not at an inside one', () => {
    expect(sunlight(stateAt('f10_artificers_row', at(3, 12)))).toBeGreaterThan(0);
    expect(sunlight(stateAt('f10_quarry', at(3, 12)))).toBe(0);
    expect(sunlight(stateAt('f16_arena', at(3, 12)))).toBe(0);
  });
});
