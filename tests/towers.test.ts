import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { EventBus } from '../src/core/engine/events';
import { AREAS, FLOORS, FLOOR_BY_AREA, SPOTS, STARTING_SPOT } from '../src/core/registry';
import {
  climbTo,
  currentFloor,
  floorCleared,
  floorUnlocked,
  rungStatus,
  towerAt,
} from '../src/core/systems/towers';
import { startTravel, tickTravel } from '../src/core/systems/locations';
import type { GameState } from '../src/core/types';

/** A fresh save standing wherever the game opens (the foot of the tower). */
const fresh = (): GameState => createInitialState(0);

const bus = () => new EventBus();

/** Run the current travel to arrival. */
function arrive(state: GameState, b: EventBus): void {
  expect(state.travel).toBeTruthy();
  for (let i = 0; i < 10_000 && state.travel; i++) tickTravel(state, b);
  expect(state.travel).toBeNull();
}

describe('the sequential ascent', () => {
  it('opens exactly one rung to a fresh save', () => {
    const state = fresh();
    expect(state.spot).toBe(STARTING_SPOT);
    expect(floorUnlocked(state, FLOORS.ascent_f1)).toBe(true);
    expect(floorUnlocked(state, FLOORS.ascent_f2)).toBe(false);
    expect(floorUnlocked(state, FLOORS.ascent_f3)).toBe(false);
    // Sealed outranks gated: floor 2's gold gate being unmet is not the
    // reason it is shut, and the ladder must not claim it is.
    expect(rungStatus(state, FLOORS.ascent_f2)).toBe('sealed');
  });

  it('clears floors from counters that already persist, and unlocks in order', () => {
    const state = fresh();
    expect(floorCleared(state, FLOORS.ascent_f1)).toBe(false);
    state.stats['boss:f1_toll_hall'] = 1;
    expect(floorCleared(state, FLOORS.ascent_f1)).toBe(true);
    // Below cleared but the gate unmet: gated, and not yet unlocked.
    expect(rungStatus(state, FLOORS.ascent_f2)).toBe('gated');
    expect(floorUnlocked(state, FLOORS.ascent_f2)).toBe(false);
    state.stats['gold:earned'] = 150;
    expect(floorUnlocked(state, FLOORS.ascent_f2)).toBe(true);
    // Floor 3 still waits on floor 2's fight budget, whatever the gold says.
    state.stats['gold:earned'] = 10_000;
    expect(floorUnlocked(state, FLOORS.ascent_f3)).toBe(false);
    state.stats['fights:f2_cistern'] = 8;
    expect(floorUnlocked(state, FLOORS.ascent_f3)).toBe(true);
  });

  it('climbs to an open floor, refuses a shut one, and always comes down', () => {
    const state = fresh();
    const b = bus();
    expect(towerAt(state)?.id).toBe('the_ascent');

    expect(climbTo(state, b, 'ascent_f2')).toBe(false);
    expect(state.travel).toBeNull();

    expect(climbTo(state, b, 'ascent_f1')).toBe(true);
    arrive(state, b);
    expect(state.spot).toBe('f1_landing');
    expect(currentFloor(state)?.id).toBe('ascent_f1');

    // Down is always open: back to the hub from the floor.
    expect(climbTo(state, b, null)).toBe(true);
    arrive(state, b);
    expect(state.spot).toBe(STARTING_SPOT);
  });

  it('the ladder only answers at the tower — not from a city district', () => {
    const state = fresh();
    state.spot = 'lectory_steps';
    expect(towerAt(state)).toBeNull();
    expect(climbTo(state, bus(), 'ascent_f1')).toBe(false);
  });
});

describe('the hold (shut roads: Connection.requires)', () => {
  it('is its own map, off every ladder', () => {
    // 2026-09-12: the hold left the tower. No floor names its area, so
    // nothing on the ladder can ever gate on it or be gated by it.
    expect(FLOOR_BY_AREA.has('player_base_v1_area')).toBe(false);
    expect(AREAS.player_base_v1_area.regionId).toBe('the_hold');
    expect(AREAS.player_base_v1_area.regionId).not.toBe(AREAS[SPOTS[STARTING_SPOT].areaId].regionId);
  });

  it('the door at the Foot refuses travel until the first prestige, and only outbound', () => {
    const state = fresh();
    const b = bus();
    expect(state.spot).toBe(STARTING_SPOT);
    expect(startTravel(state, b, 'base_entrance')).toBe(false);
    expect(state.travel).toBeNull();

    state.stats['prestige:count'] = 1;
    expect(startTravel(state, b, 'base_entrance')).toBe(true);
    arrive(state, b);
    expect(state.spot).toBe('base_entrance');

    // The mirror never carries `requires`: a save already inside can always
    // walk back out, counter or no counter — nobody is ever stranded.
    state.stats['prestige:count'] = 0;
    expect(startTravel(state, b, STARTING_SPOT)).toBe(true);
  });
});
