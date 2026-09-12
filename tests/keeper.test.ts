import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { SPOTS } from '../src/core/registry';
import { eligibleEncounters, encounterPowerRatio } from '../src/core/systems/combat';
import { TICKS_PER_GAME_MINUTE } from '../src/core/data/climate.data';
import type { GameState } from '../src/core/types';

/**
 * Quest 3's machinery (plans/alpha-threshold-quests.md): the toll hall's
 * keeper changes with the clock, and the ambush pair spawns only inside the
 * power window. The `boss:` latch itself is exercised via floorCleared in
 * tests/towers.test.ts; here we prove WHO can appear WHEN.
 */

const hall = SPOTS.f1_toll_hall;

/** A fresh save standing in the hall at day `d`, hour `h`. */
function at(hour: number): GameState {
  const state = createInitialState(0);
  state.spot = 'f1_toll_hall';
  state.totalTicks = hour * 60 * TICKS_PER_GAME_MINUTE;
  return state;
}

const ids = (state: GameState) => eligibleEncounters(state, hall).map((e) => e.monsterId);

describe('the keeper changes with the clock', () => {
  it('daylight rolls the hobgoblin and never the night slime', () => {
    const noon = ids(at(12));
    expect(noon).toContain('hobgoblin');
    expect(noon).not.toContain('slime_base_advanced');
  });

  it('night rolls the slime and never the hobgoblin', () => {
    const midnight = ids(at(0));
    expect(midnight).toContain('slime_base_advanced');
    expect(midnight).not.toContain('hobgoblin');
  });

  it('the trash table ignores the clock', () => {
    for (const hour of [0, 12]) {
      expect(ids(at(hour))).toContain('goblin');
    }
  });
});

describe('the ambush window', () => {
  it('a fresh level-1 save is far below the window, so no champion appears', () => {
    const noon = at(12);
    const champion = hall.encounters!.find((e) => e.monsterId === 'hobgoblin_champion')!;
    expect(encounterPowerRatio(noon, champion)).toBeLessThan(0.9);
    expect(ids(noon)).not.toContain('hobgoblin_champion');
    expect(ids(at(0))).not.toContain('slime_king');
  });

  it('inside the window the champion joins the table; past it, gone again', () => {
    const champion = hall.encounters!.find((e) => e.monsterId === 'hobgoblin_champion')!;
    // Walk attributes up until the ratio crosses into the window, then past it.
    // This also guards the formula against sign/direction regressions: power
    // must rise with attributes.
    const stateFor = (base: number, conExtra: number): GameState => {
      const s = at(12);
      for (const a of Object.values(s.attrs)) a.level = base;
      s.attrs.con.level = base + conExtra;
      return s;
    };
    // Attribute levels are integers, and near the window one UNIFORM level
    // moves power by more than the window's whole width — but nobody levels
    // uniformly. A single attribute is the real grain (~2–3% here), so the
    // walk is a grid: uniform base × a few points of CON on top. This is
    // also the design's honest reading: hitting the window takes PLANNING.
    let inWindow: GameState | null = null;
    let past: GameState | null = null;
    outer: for (let base = 1; base <= 400; base++) {
      for (let extra = 0; extra < 10; extra++) {
        const s = stateFor(base, extra);
        const r = encounterPowerRatio(s, champion);
        if (!inWindow && r >= 0.9 && r <= 0.98) inWindow = s;
        if (!past && r > 0.98) past = s;
        if (past) break outer;
      }
    }
    // The window is reachable by ordinary growth (if this fails, the window
    // is unhittable and the ambush is dead content — retune min/max).
    expect(inWindow, 'no attribute level lands inside the 90–98% window').not.toBeNull();
    expect(ids(inWindow!)).toContain('hobgoblin_champion');
    expect(past).not.toBeNull();
    expect(ids(past!)).not.toContain('hobgoblin_champion');
  });
});
