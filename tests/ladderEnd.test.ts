import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { EventBus } from '../src/core/engine/events';
import { FLOORS, TOWERS } from '../src/core/registry';
import { serialize, deserialize } from '../src/core/save/save';
import { checkFloorClears } from '../src/core/systems/levels';
import { floorsReachedThisRun } from '../src/core/systems/ladder';
import { prestigeNow } from '../src/core/systems/prestige';
import {
  climbTo,
  floorUnlocked,
  ladderEnded,
  rideStops,
  topRung,
} from '../src/core/systems/towers';
import { ladderBands, ladderEnd, towerSection } from '../src/ui/lib/ladderView';
import type { GameState } from '../src/core/types';
import { clearFloors } from './fixtures/floors';

// The ladder stops at floor 20. Once its clear holds, the ladder says that
// floor 21 is not in this build. The notice is a reading of the clear
// counters: no save field, so nothing here changes the save. Delete this file
// when floor 21 ships; the notice then drops out on its own.

const ASCENT = TOWERS.the_ascent;
const NOTICE = 'Floor 21: not in this build.';

/** Floors 1 to n of the Ascent, by id. */
const floorsUpTo = (n: number): string[] => Array.from({ length: n }, (_, i) => `ascent_f${i + 1}`);

/** A run with floors 1 to n cleared, standing at the Foot. */
function clearedTo(n: number): GameState {
  const s = createInitialState(0, 'ascent_foot');
  clearFloors(s.stats, floorsUpTo(n));
  return s;
}

describe('the ladder ends at floor 20', () => {
  it('floor 20 is the top rung and nothing is above it', () => {
    expect(topRung('the_ascent')?.id).toBe('ascent_f20');
    expect(Object.values(FLOORS).filter((f) => f.bandId !== undefined && f.index > 20)).toEqual([]);
    expect(FLOORS.ascent_f21).toBeUndefined();
  });

  it('no notice until floor 20 is cleared', () => {
    for (const s of [createInitialState(0, 'ascent_foot'), clearedTo(19)]) {
      expect(ladderEnded(s, 'the_ascent')).toBe(false);
      expect(ladderEnd(s, ASCENT)).toBeNull();
      expect(towerSection(s, ASCENT, () => true).end).toBeNull();
    }
  });

  it('floor 20 cleared: the tower section says floor 21 is not in this build', () => {
    const s = clearedTo(20);
    expect(ladderEnded(s, 'the_ascent')).toBe(true);
    expect(ladderEnd(s, ASCENT)).toBe(NOTICE);
    expect(towerSection(s, ASCENT, () => true).end).toBe(NOTICE);
  });

  it('a save with floor 20 cleared yields the notice after a load, with no field added to the save', () => {
    const s = clearedTo(20);
    const loaded = deserialize(serialize(s));
    expect(ladderEnd(loaded, ASCENT)).toBe(NOTICE);
    const bare = Object.keys(JSON.parse(serialize(createInitialState(0, 'ascent_foot')))).sort();
    expect(Object.keys(JSON.parse(serialize(s))).sort()).toEqual(bare);
  });

  it('clearing floor 20 says it once in the log, and the stamp keeps it from repeating', () => {
    const s = clearedTo(20);
    const bus = new EventBus();
    const logs: string[] = [];
    bus.on('log', (e) => logs.push(e.msg));
    checkFloorClears(s, bus);
    checkFloorClears(s, bus);
    expect(logs.filter((m) => m === NOTICE)).toHaveLength(1);
    // The floor's own clear line is still there, unchanged.
    expect(logs.some((m) => m.includes(FLOORS.ascent_f20.name) && m.includes('cleared'))).toBe(true);
  });

  it('floor 19 clearing does not say it', () => {
    const s = clearedTo(19);
    const bus = new EventBus();
    const logs: string[] = [];
    bus.on('log', (e) => logs.push(e.msg));
    checkFloorClears(s, bus);
    expect(logs.filter((m) => m.includes('not in this build'))).toEqual([]);
  });

  it('a new run has no notice: the clear counters reset with the run', () => {
    const s = clearedTo(20);
    clearFloors(s.stats); // the prestige unlock, floors 1 to 6
    const next = prestigeNow(s, 1);
    expect(next).not.toBeNull();
    expect(ladderEnd(next!, ASCENT)).toBeNull();
  });
});

describe('nothing reaches for floor 21', () => {
  it('no floor, stop, band or card exists past floor 20, however much is cleared', () => {
    const s = clearedTo(20);
    const banded = Object.values(FLOORS).filter((f) => f.bandId !== undefined);
    expect(Math.max(...banded.filter((f) => floorUnlocked(s, f)).map((f) => f.index))).toBeLessThanOrEqual(20);
    expect(Math.max(...floorsReachedThisRun(s).map((id) => FLOORS[id].index))).toBeLessThanOrEqual(20);
    expect(Math.max(...rideStops(ASCENT).map((stop) => stop.index))).toBeLessThanOrEqual(20);
    // The ladder shows no "next band, name only" card above the desert.
    expect(ladderBands(s, ASCENT).filter((b) => b.titleOnly)).toEqual([]);
    expect(ladderBands(s, ASCENT)[0].band.id).toBe('ascent_desert');
  });

  it('a climb to floor 21 is refused and starts no travel', () => {
    const s = clearedTo(20);
    s.spot = FLOORS.ascent_f20.landing!;
    expect(climbTo(s, new EventBus(), 'ascent_f21')).toBe(false);
    expect(s.travel).toBeNull();
    expect(s.spot).toBe(FLOORS.ascent_f20.landing);
  });

  it('the clear pass stamps no floor 21 counter', () => {
    const s = clearedTo(20);
    checkFloorClears(s, new EventBus());
    expect(Object.keys(s.stats).filter((k) => /f21|floor.?21/i.test(k))).toEqual([]);
  });
});
