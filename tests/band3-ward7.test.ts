import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { EventBus } from '../src/core/engine/events';
import { ADJACENCY, FLOORS, MONSTERS, SPOTS } from '../src/core/registry';
import { WARD_WINDOWS } from '../src/core/data/wards.data';
import { eligibleEncounters, spawnGroup, spawnMonster } from '../src/core/systems/combat';
import { floorCleared } from '../src/core/systems/towers';
import { startTravel, visibleEdges } from '../src/core/systems/locations';
import { floorStructureIssues } from '../src/core/systems/floorRules';
import { TICKS_PER_DAY } from '../src/core/systems/clock';
import type { GameState } from '../src/core/types';
import { clearFloors } from './fixtures/floors';

// Floor 7, the city's south ward (docs/plans/bands-2-3.md "The four wards"):
// one ward, three forms, picked by its position. The ward engine is not on
// this branch, so the tests write the position stat by hand.

const FLOOR = FLOORS.ascent_f7;
const POS = 'band:pos:ascent_f7';
const DONE = 'ward:f7:done';
const GONE = 'ward:f7:demon:gone';
/** The other three wards, cleared in this order to raise floor 7's position. */
const OTHERS = ['ascent_f8', 'ascent_f9', 'ascent_f10'];

/** Floors 1-6 and the city key: the city is open. */
function cityOpen(): GameState {
  const s = createInitialState(0, 'ascent_foot');
  clearFloors(s.stats);
  s.prestige.purchases.city_key = 1;
  return s;
}

/**
 * Floor 7 at a position, made the way a run makes it: that many other wards
 * cleared (so the band's step matches), and the position stat the ward engine
 * would keep beside it.
 */
function atPosition(pos: number): GameState {
  const s = cityOpen();
  clearFloors(s.stats, OTHERS.slice(0, pos));
  s.stats[POS] = pos;
  return s;
}

const ids = (s: GameState, spotId: string) => eligibleEncounters(s, SPOTS[spotId]).map((e) => e.monsterId).sort();

describe('ward 7: each position has one form', () => {
  const BANDITS = ['ph_bandit_archer', 'ph_bandit_cutthroat', 'ph_bandit_thug'];
  const FORM_SPOTS = ['f7_merchant_road', 'f7_stockade', 'f7_watchtowers', 'f7_chiefs_tent', 'f7_burnt_camp'];
  const expected: Record<number, Record<string, string[]>> = {
    0: { f7_merchant_road: BANDITS },
    1: { f7_stockade: BANDITS, f7_watchtowers: BANDITS, f7_chiefs_tent: ['ph_bandit_chief'] },
    2: { f7_stockade: BANDITS, f7_watchtowers: BANDITS, f7_chiefs_tent: ['ph_bandit_chief'] },
    3: { f7_burnt_camp: ['ph_camp_demon'] },
  };

  for (const pos of [0, 1, 2, 3]) {
    it(`position ${pos}: only its form's spots can spawn`, () => {
      const s = atPosition(pos);
      for (const spot of FORM_SPOTS) expect(ids(s, spot), `${spot} at ${pos}`).toEqual(expected[pos][spot] ?? []);
    });
  }

  it('the docks shows the road into the current form and no other', () => {
    const roads: Record<number, string[]> = {
      0: ['f7_merchant_road'],
      1: ['f7_stockade'],
      2: ['f7_stockade'],
      3: ['f7_burnt_camp'],
    };
    for (const pos of [0, 1, 2, 3]) {
      const s = atPosition(pos);
      expect(visibleEdges(s, FLOOR.landing!).map((e) => e.to), `position ${pos}`).toEqual(roads[pos]);
    }
  });

  it('at every position some spot that stamps the clear can spawn', () => {
    const stamping = Object.values(SPOTS).filter((sp) => sp.areaId === FLOOR.areaId && sp.stampOnClear === DONE);
    for (const pos of [0, 1, 2, 3]) {
      const s = atPosition(pos);
      expect(floorCleared(s, FLOOR)).toBe(false);
      const open = stamping.filter((sp) => eligibleEncounters(s, sp).length > 0).map((sp) => sp.id);
      expect(open.length, `position ${pos}`).toBeGreaterThan(0);
    }
  });

  it('a cleared ward reopens no form at any position', () => {
    const CAMP = ['f7_stockade', 'f7_watchtowers', 'f7_chiefs_tent'];
    for (const pos of [0, 1, 2, 3]) {
      const s = atPosition(pos);
      s.stats[DONE] = 1;
      for (const spot of FORM_SPOTS) expect(ids(s, spot), `${spot} at ${pos}`).toEqual([]);
      // No authored camp road shows, from the docks or inside the camp. (The
      // mirrors, the ways back, carry no gate by design.)
      for (const from of [FLOOR.landing!, ...CAMP]) {
        const authored = new Set(SPOTS[from].connections.map((c) => c.to));
        const shown = visibleEdges(s, from).filter((e) => authored.has(e.to) && CAMP.includes(e.to));
        expect(shown.map((e) => `${from} -> ${e.to}`), `position ${pos}`).toEqual([]);
      }
    }
  });

  it('a form that ended still has a free road back to the docks', () => {
    // One hop each: the watchtowers reach the docks through the stockade.
    const hops = [
      ['f7_merchant_road', 1, FLOOR.landing!],
      ['f7_stockade', 3, FLOOR.landing!],
      ['f7_watchtowers', 3, 'f7_stockade'],
      ['f7_chiefs_tent', 3, FLOOR.landing!],
    ] as const;
    for (const [spot, pos, to] of hops) {
      const s = atPosition(pos);
      s.spot = spot;
      expect(startTravel(s, new EventBus(), to), `${spot} -> ${to} at ${pos}`).toBe(true);
    }
    // The chief's kill writes the clear; the way out of the tent still opens.
    const s = atPosition(1);
    s.stats[DONE] = 1;
    s.spot = 'f7_chiefs_tent';
    expect(startTravel(s, new EventBus(), FLOOR.landing!)).toBe(true);
  });

  it('the road fields 2 to 4 bandits, the tent the chief and two, the burnt camp the demon alone', () => {
    const sizes = (s: GameState, spotId: string) => {
      const seen = new Set<number>();
      for (let i = 0; i < 80; i++) seen.add(spawnGroup(s, SPOTS[spotId]).filter((m) => m !== null).length);
      return [...seen].sort();
    };
    expect(sizes(atPosition(0), 'f7_merchant_road')).toEqual([2, 3, 4]);
    expect(sizes(atPosition(1), 'f7_chiefs_tent')).toEqual([3]);
    expect(sizes(atPosition(3), 'f7_burnt_camp')).toEqual([1]);
  });
});

describe('ward 7: levels after the band step', () => {
  const range = (s: GameState, spotId: string) => {
    const levels = new Set<number>();
    for (let i = 0; i < 60; i++) levels.add(spawnMonster(s, SPOTS[spotId]).level);
    return [Math.min(...levels), Math.max(...levels)];
  };

  it('road 12-13; camp 13-14 then 16-17; chief 14 then 17; demon 21', () => {
    expect(range(atPosition(0), 'f7_merchant_road')).toEqual([12, 13]);
    expect(range(atPosition(1), 'f7_stockade')).toEqual([13, 14]);
    expect(range(atPosition(1), 'f7_chiefs_tent')).toEqual([14, 14]);
    expect(range(atPosition(2), 'f7_watchtowers')).toEqual([16, 17]);
    expect(range(atPosition(2), 'f7_chiefs_tent')).toEqual([17, 17]);
    expect(range(atPosition(3), 'f7_burnt_camp')).toEqual([21, 21]);
  });
});

describe("ward 7: the chief's tent", () => {
  for (const from of ['f7_stockade', 'f7_watchtowers']) {
    it(`is drawn from ${from}, and shut until both camp budgets are spent`, () => {
      const tryEnter = (fights: Record<string, number>) => {
        const s = atPosition(1);
        s.spot = from;
        Object.assign(s.stats, fights);
        expect(visibleEdges(s, from).map((e) => e.to)).toContain('f7_chiefs_tent');
        return startTravel(s, new EventBus(), 'f7_chiefs_tent');
      };
      expect(tryEnter({})).toBe(false);
      expect(tryEnter({ 'fights:f7_stockade': 4, 'fights:f7_watchtowers': 2 })).toBe(false);
      expect(tryEnter({ 'fights:f7_stockade': 3, 'fights:f7_watchtowers': 3 })).toBe(false);
      expect(tryEnter({ 'fights:f7_stockade': 4, 'fights:f7_watchtowers': 3 })).toBe(true);
    });
  }

  it('asks for exactly the two budgets the camp spots hold', () => {
    for (const from of ['f7_stockade', 'f7_watchtowers']) {
      const edge = SPOTS[from].connections.find((c) => c.to === 'f7_chiefs_tent')!;
      expect(edge.requires).toEqual([
        { type: 'stat', key: 'fights:f7_stockade', value: SPOTS.f7_stockade.fightLimit },
        { type: 'stat', key: 'fights:f7_watchtowers', value: SPOTS.f7_watchtowers.fightLimit },
      ]);
    }
  });
});

describe('ward 7: the demon', () => {
  it("its row shuts when the window's gone key is set", () => {
    const s = atPosition(3);
    expect(ids(s, 'f7_burnt_camp')).toEqual(['ph_camp_demon']);
    s.stats[GONE] = 1;
    expect(ids(s, 'f7_burnt_camp')).toEqual([]);
  });

  it('is not forced, so walking away is the retreat, and it keeps half its wounds', () => {
    expect(SPOTS.f7_burnt_camp.forced).toBeFalsy();
    expect(SPOTS.f7_docks.connections.find((c) => c.to === 'f7_burnt_camp')?.forced).toBeFalsy();
    expect(MONSTERS.ph_camp_demon.keepsWounds).toEqual({ key: 'ward:f7:demon:wounds', share: 0.5 });
  });

  it("the window's ids resolve to floor 7, the burnt camp and its row", () => {
    const w = WARD_WINDOWS.find((x) => x.id === 'f7_demon');
    expect(w).toBeDefined();
    const win = w!;
    expect(FLOORS[win.floorId]).toBe(FLOOR);
    const spot = SPOTS[win.spotId];
    expect(spot?.areaId).toBe(FLOOR.areaId);
    expect(MONSTERS[win.monsterId]).toBeDefined();
    expect(win.position).toBe(3);
    expect(win.ticks).toBe(TICKS_PER_DAY);
    // The kill and the lapse write the same stamp, and it is the floor's clear.
    expect(win.doneKey).toBe(DONE);
    expect(spot.stampOnClear).toBe(win.doneKey);
    expect(FLOOR.clear).toEqual([{ type: 'stat', key: win.doneKey, value: 1 }]);
    // The row is the window's monster, open from the window's position until gone.
    const row = spot.encounters!.find((e) => e.monsterId === win.monsterId)!;
    expect(row.requires).toContainEqual({ type: 'stat', key: `band:pos:${win.floorId}`, value: win.position });
    expect(row.requires).toContainEqual({ type: 'statMax', key: win.goneKey, value: 0 });
    // Every key the window writes is its own.
    const keys = [win.doneKey, win.atKey, win.goneKey, win.foughtKey, win.flags.fought, win.flags.unmet];
    expect(new Set(keys).size).toBe(keys.length);
    expect(win.flags.fought.startsWith('flag:') && win.flags.unmet.startsWith('flag:')).toBe(true);
  });
});

describe('ward 7: the clear', () => {
  it('is the stamp, written by the last spot of each form and by nothing else', () => {
    expect(FLOOR.clear).toEqual([{ type: 'stat', key: DONE, value: 1 }]);
    const stamping = Object.values(SPOTS).filter((sp) => sp.stampOnClear !== undefined);
    const mine = stamping.filter((sp) => sp.areaId === FLOOR.areaId);
    expect(mine.map((sp) => sp.id).sort()).toEqual(['f7_burnt_camp', 'f7_chiefs_tent', 'f7_merchant_road']);
    for (const sp of mine) {
      expect(sp.stampOnClear, sp.id).toBe(DONE);
      expect(sp.fightLimit ?? 0, sp.id).toBeGreaterThan(0);
    }
    expect(stamping.filter((sp) => sp.stampOnClear === DONE && sp.areaId !== FLOOR.areaId)).toEqual([]);
    expect(SPOTS.f7_merchant_road.fightLimit).toBe(12);
  });

  it('floor 7 reads cleared once the stamp is written', () => {
    const s = atPosition(0);
    expect(floorCleared(s, FLOOR)).toBe(false);
    s.stats[DONE] = 1;
    expect(floorCleared(s, FLOOR)).toBe(true);
  });

  /**
   * The floor standard's spine rules cannot run on a stamp clear yet
   * (towers.data.ts SPINE_EXEMPT, until floorRules reads stampOnClear), so
   * each form is checked as if its last spot were the clear. The clear-table
   * rule is left out on purpose: every form's table is empty outside its
   * positions, and the coverage test above pins that one is always open.
   */
  for (const [spot, fights] of [['f7_merchant_road', 12], ['f7_chiefs_tent', 1], ['f7_burnt_camp', 1]] as const) {
    it(`passes the floor rules with ${spot} as the clear`, () => {
      const floor = { ...FLOOR, clear: [{ type: 'stat' as const, key: `fights:${spot}`, value: fights }] };
      const report = floorStructureIssues(floor, SPOTS, ADJACENCY);
      expect(report.skipped).toBeUndefined();
      expect(report.issues.filter((i) => i.rule !== 'clear-table')).toEqual([]);
    });
  }
});
