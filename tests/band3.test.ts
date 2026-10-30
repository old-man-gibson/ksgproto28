import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { EventBus } from '../src/core/engine/events';
import { BANDS, FLOORS, PRESTIGE_BOONS, PRESTIGE_UNLOCK, SPOTS } from '../src/core/registry';
import {
  CLIMB_TICKS_PER_FLOOR,
  bandLevelStep,
  climbTo,
  climbToHub,
  floorCleared,
  floorUnlocked,
  hubStatus,
  ladderFloors,
  rungStatus,
  towerAt,
} from '../src/core/systems/towers';
import { spawnMonster } from '../src/core/systems/combat';
import { tickTravel } from '../src/core/systems/locations';
import { canPrestige, harvest } from '../src/core/systems/prestige';
import { checkFloorClears } from '../src/core/systems/levels';
import { conditionsMet } from '../src/core/systems/conditions';
import { getDerivedStats } from '../src/core/systems/derived';
import type { GameState } from '../src/core/types';
import { BAND_ONE, TO_PRESTIGE, clearFloors } from './fixtures/floors';

// Band 3, the City (docs/plans/bands-2-3.md M3-M5): the city key, band
// passes, the castle hub and four any-order wards whose monsters level up
// with each ward cleared.

const CITY = BANDS.ascent_upper;
const WARDS = ['ascent_f7', 'ascent_f8', 'ascent_f9', 'ascent_f10'];
const FOOT = 'ascent_foot';

const fresh = (): GameState => createInitialState(0, FOOT);

/** Floors 1-6 cleared and the city key owned: the city is open. */
function cityOpen(): GameState {
  const s = fresh();
  clearFloors(s.stats);
  s.prestige.purchases.city_key = 1;
  return s;
}

function arrive(state: GameState, bus: EventBus): number {
  const total = state.travel!.total;
  for (let i = 0; i < 10_000 && state.travel; i++) tickTravel(state, bus);
  expect(state.travel).toBeNull();
  return total;
}

describe('the city gate', () => {
  it('is sealed until floor 6 is cleared, then gated on the city key', () => {
    const s = fresh();
    expect(hubStatus(s, CITY)).toBe('sealed');
    for (const id of WARDS) expect(rungStatus(s, FLOORS[id]), id).toBe('sealed');

    clearFloors(s.stats);
    expect(hubStatus(s, CITY)).toBe('gated');
    for (const id of WARDS) expect(rungStatus(s, FLOORS[id]), id).toBe('gated');

    s.prestige.purchases.city_key = 1;
    expect(conditionsMet(s, CITY.gate!)).toBe(true);
    expect(hubStatus(s, CITY)).toBe('open');
    for (const id of WARDS) expect(floorUnlocked(s, FLOORS[id]), id).toBe(true);
  });

  it('the key alone opens nothing: band 2 must still be cleared (or passed)', () => {
    const s = fresh();
    s.prestige.purchases.city_key = 1;
    clearFloors(s.stats, BAND_ONE);
    expect(hubStatus(s, CITY)).toBe('sealed');
    for (const id of WARDS) expect(floorUnlocked(s, FLOORS[id]), id).toBe(false);
  });

  it('the key costs no more than the floors source of a first harvest pays', () => {
    // Clearing floors 1-6 is what lets a run prestige, and the floors source
    // pays one point per floor, so the first prestige can always buy the key.
    const s = fresh();
    clearFloors(s.stats);
    const floorsLine = harvest(s).lines.find((l) => l.id === 'floors')!;
    expect(floorsLine.points).toBe(TO_PRESTIGE.length);
    expect(PRESTIGE_BOONS.city_key.cost[0]).toBeLessThanOrEqual(floorsLine.points);
  });
});

describe('any order', () => {
  it('a ward cleared changes nothing about whether the others are open', () => {
    const s = cityOpen();
    clearFloors(s.stats, ['ascent_f9']);
    expect(rungStatus(s, FLOORS.ascent_f9)).toBe('cleared');
    for (const id of ['ascent_f7', 'ascent_f8', 'ascent_f10']) expect(rungStatus(s, FLOORS[id]), id).toBe('open');
  });

  it('every ward is cleared from its own keeper, in any order', () => {
    for (const order of [WARDS, [...WARDS].reverse()]) {
      const s = cityOpen();
      for (const id of order) {
        clearFloors(s.stats, [id]);
        expect(floorCleared(s, FLOORS[id]), id).toBe(true);
      }
    }
  });
});

describe('the castle hub', () => {
  it('the ladder answers at the castle, and the climb lands there', () => {
    const s = cityOpen();
    const bus = new EventBus();
    const speed = getDerivedStats(s).travelSpeed;
    expect(climbToHub(s, bus, CITY.id)).toBe(true);
    const ticks = arrive(s, bus);
    expect(s.spot).toBe(CITY.hub);
    expect(towerAt(s)?.id).toBe('the_ascent');
    // Seven rungs up from the Foot: the band sits at its lowest floor index.
    expect(ticks).toBe(Math.max(1, Math.round((7 * CLIMB_TICKS_PER_FLOOR) / speed)));
  });

  it('each ward is one rung from the castle and from each other', () => {
    const s = cityOpen();
    const bus = new EventBus();
    climbToHub(s, bus, CITY.id);
    arrive(s, bus);
    // Travel speed can differ by place (shelter, weather), so price each leg
    // from where it departs.
    const one = () => Math.max(1, Math.round(CLIMB_TICKS_PER_FLOOR / getDerivedStats(s).travelSpeed));
    let expected = one();
    expect(climbTo(s, bus, 'ascent_f10')).toBe(true);
    expect(arrive(s, bus)).toBe(expected);
    expect(s.spot).toBe(FLOORS.ascent_f10.landing);
    expected = one();
    expect(climbTo(s, bus, 'ascent_f7')).toBe(true);
    expect(arrive(s, bus)).toBe(expected);
    expected = one();
    expect(climbToHub(s, bus, CITY.id)).toBe(true);
    expect(arrive(s, bus)).toBe(expected);
  });

  it('refuses a closed city', () => {
    const s = fresh();
    clearFloors(s.stats);
    expect(climbToHub(s, new EventBus(), CITY.id)).toBe(false);
    expect(climbTo(s, new EventBus(), 'ascent_f7')).toBe(false);
  });

  it('is a haven off the ladder: a rest spot no floor claims', () => {
    const hub = SPOTS[CITY.hub!];
    expect(hub.activities.some((a) => a.kind === 'rest')).toBe(true);
    expect(ladderFloors('the_ascent').some((f) => f.areaId === hub.areaId)).toBe(false);
  });
});

describe('direction scaling', () => {
  it('each ward cleared raises every ward: +0, +2, +5, +9, and +9 after the last', () => {
    const s = cityOpen();
    const docks = SPOTS.f7_docks;
    expect(bandLevelStep(s, docks)).toBe(0);
    const seen: number[] = [];
    for (const id of WARDS) {
      clearFloors(s.stats, [id]);
      seen.push(bandLevelStep(s, docks));
    }
    expect(seen).toEqual([2, 5, 9, 9]);
  });

  it('touches nothing off band 3', () => {
    const s = cityOpen();
    clearFloors(s.stats, WARDS);
    expect(bandLevelStep(s, SPOTS.f6_drop)).toBe(0);
    expect(bandLevelStep(s, SPOTS[CITY.hub!])).toBe(0);
  });

  it('spawns at the rolled level plus the step; escorts keep their leader’s level', () => {
    const s = cityOpen();
    clearFloors(s.stats, ['ascent_f7', 'ascent_f8']); // +5
    const docks = SPOTS.f7_docks;
    for (let i = 0; i < 40; i++) {
      const m = spawnMonster(s, docks);
      expect(m.level).toBeGreaterThanOrEqual(12 + 5);
      expect(m.level).toBeLessThanOrEqual(13 + 5);
    }
    const pinned = spawnMonster(s, docks, { monsterId: 'cave_spider', level: 20 });
    expect(pinned.level).toBe(20);
  });
});

describe('band passes', () => {
  it('the band 1 pass opens floor 4 on a fresh run', () => {
    const s = fresh();
    s.prestige.purchases.pass_lower = 1;
    for (const id of BAND_ONE) expect(rungStatus(s, FLOORS[id]), id).toBe('cleared');
    expect(floorUnlocked(s, FLOORS.ascent_f4)).toBe(true);
  });

  it('pays no harvest points and no clear XP for passed floors', () => {
    const s = fresh();
    s.prestige.purchases.pass_lower = 1;
    expect(harvest(s).lines.find((l) => l.id === 'floors')!.points).toBe(0);
    const before = s.levelXp + s.level * 1_000_000;
    checkFloorClears(s, new EventBus());
    expect(s.levelXp + s.level * 1_000_000).toBe(before);
  });

  it('the band 2 pass does not open prestige: the warchief must still fall', () => {
    const s = fresh();
    s.prestige.purchases.pass_lower = 1;
    s.prestige.purchases.pass_wilds = 1;
    expect(floorCleared(s, FLOORS.ascent_f6)).toBe(true);
    expect(conditionsMet(s, PRESTIGE_UNLOCK)).toBe(false);
    expect(canPrestige(s)).toBe(false);
    // ... and floor 6 is open to walk down to and fight: the pass waives its
    // 40-goblin gate, or the rung would read cleared and refuse the climb.
    expect(s.stats['kills:tag:goblin'] ?? 0).toBe(0);
    expect(floorUnlocked(s, FLOORS.ascent_f6)).toBe(true);
    expect(rungStatus(s, FLOORS.ascent_f6)).toBe('cleared');
  });

  it('a pass alone skips nothing below it: the band 2 pass waits on band 1', () => {
    const s = fresh();
    s.prestige.purchases.pass_wilds = 1;
    expect(floorUnlocked(s, FLOORS.ascent_f4)).toBe(false);
    clearFloors(s.stats, BAND_ONE);
    expect(floorUnlocked(s, FLOORS.ascent_f6)).toBe(true);
  });

  it('both passes and the key open the city on a fresh run', () => {
    const s = fresh();
    s.prestige.purchases.pass_lower = 1;
    s.prestige.purchases.pass_wilds = 1;
    s.prestige.purchases.city_key = 1;
    expect(hubStatus(s, CITY)).toBe('open');
  });

  it('are priced above every other boon rank, band 2 above band 1', () => {
    const others = Object.values(PRESTIGE_BOONS).filter((b) => b.effect.kind !== 'bandPass');
    const dearest = Math.max(...others.flatMap((b) => b.cost));
    expect(PRESTIGE_BOONS.pass_lower.cost[0]).toBeGreaterThan(dearest);
    expect(PRESTIGE_BOONS.pass_wilds.cost[0]).toBeGreaterThan(PRESTIGE_BOONS.pass_lower.cost[0]);
  });
});

describe('the castle is safe', () => {
  it('all four wards cleared stamps the band once, with one log line', () => {
    const s = cityOpen();
    const bus = new EventBus();
    const logs: string[] = [];
    bus.on('log', (e) => logs.push(e.msg));
    clearFloors(s.stats, WARDS.slice(0, 3));
    checkFloorClears(s, bus);
    expect(s.stats['cleared:band:ascent_upper'] ?? 0).toBe(0);
    clearFloors(s.stats, WARDS.slice(3));
    checkFloorClears(s, bus);
    checkFloorClears(s, bus);
    expect(s.stats['cleared:band:ascent_upper']).toBe(1);
    expect(logs.filter((m) => m.includes(CITY.name) && m.includes('every floor cleared'))).toHaveLength(1);
  });
});
