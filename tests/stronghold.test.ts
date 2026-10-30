import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { FLOORS, SPOTS } from '../src/core/registry';
import { STRONGHOLD_KEY, STRONGHOLD_WAVE } from '../src/core/data/prestige.data';
import { TUTORIAL_EXIT } from '../src/core/data/tutorial.data';
import { autoPrestigeDue, canPrestige, prestigeNow, strongholdHeld } from '../src/core/systems/prestige';
import { eligibleEncounters } from '../src/core/systems/combat';
import { floorUnlocked } from '../src/core/systems/ladder';
import { runOfflineProgress } from '../src/core/save/offline';
import type { GameState } from '../src/core/types';
import { clearFloors } from './fixtures/floors';

/**
 * Floor 11's stronghold (docs/FLOOR_IDEAS.md §1.5, §5.3 items 1–3, 9):
 * holding the wave ends the run unasked, and the stronghold is kept on
 * every run after.
 */

const fresh = (): GameState => createInitialState(0);

/** The wave held: every fight on the wall won. */
function held(s: GameState): GameState {
  s.stats['fights:f11_wall'] = STRONGHOLD_WAVE;
  return s;
}

const armed = (s: GameState): GameState => {
  s.quests['f11_arm_the_wall'] = { status: 'done', progress: [] };
  return s;
};

const wallMonsters = (s: GameState): string[] => eligibleEncounters(s, SPOTS.f11_wall).map((e) => e.monsterId);

describe('the stronghold opens prestige and ends the run', () => {
  it('holding the wave opens prestige without the warchief', () => {
    const s = fresh();
    expect(canPrestige(s)).toBe(false);
    held(s);
    expect(strongholdHeld(s)).toBe(true);
    expect(canPrestige(s)).toBe(true);
    expect(autoPrestigeDue(s)).toBe(true);
  });

  it('the next run keeps the stronghold and stamps its key', () => {
    const next = prestigeNow(held(fresh()), 1)!;
    expect(next.prestige.stronghold).toBe(true);
    expect(next.stats[STRONGHOLD_KEY]).toBe(1);
    // A later run cannot hold it again, so it never prestiges unasked.
    held(next);
    expect(strongholdHeld(next)).toBe(false);
    expect(autoPrestigeDue(next)).toBe(false);
  });

  it('the stronghold carries through every later prestige', () => {
    const second = prestigeNow(held(fresh()), 1)!;
    clearFloors(second.stats);
    const third = prestigeNow(second, 2)!;
    expect(third.prestige.stronghold).toBe(true);
    expect(third.stats[STRONGHOLD_KEY]).toBe(1);
  });

  it('a prestige from the warchief alone leaves the stronghold unheld', () => {
    const s = fresh();
    clearFloors(s.stats);
    const next = prestigeNow(s, 1)!;
    expect(next.prestige.stronghold).toBe(false);
    expect(next.stats[STRONGHOLD_KEY]).toBeUndefined();
  });

  it('Game.tick prestiges on the tick after the wave is held', () => {
    const game = new Game(held(fresh()));
    game.tick();
    expect(game.state.prestige.count).toBe(1);
    expect(game.state.prestige.review).toBe(true);
    expect(game.state.prestige.stronghold).toBe(true);
    expect(game.state.spot).toBe(TUTORIAL_EXIT);
  });

  it('offline catch-up prestiges once, banks the rest and reports no negative gains', () => {
    const s = held(fresh());
    s.stats['kills'] = 500;
    s.gold = 10_000;
    const game = new Game(s);
    const summary = runOfflineProgress(game, 60 * 60 * 1000)!;
    expect(game.state.prestige.count).toBe(1);
    expect(game.state.bonusTime.banked).toBeGreaterThan(0);
    expect(summary.kills).toBeGreaterThanOrEqual(0);
    expect(summary.goldGained).toBeGreaterThanOrEqual(0);
  });
});

describe('the wave on the wall', () => {
  it('is shut until the second repair quest is done', () => {
    expect(wallMonsters(fresh())).toEqual([]);
    expect(wallMonsters(armed(fresh())).length).toBeGreaterThan(0);
  });

  it('seven fights of raiders and brutes, then the captain', () => {
    const s = armed(fresh());
    for (let won = 0; won < STRONGHOLD_WAVE - 1; won++) {
      s.stats['fights:f11_wall'] = won;
      expect(wallMonsters(s), `after ${won} won`).not.toContain('ph_siege_captain');
    }
    s.stats['fights:f11_wall'] = STRONGHOLD_WAVE - 1;
    expect(wallMonsters(s)).toEqual(['ph_siege_captain']);
  });

  it('the wall holds as many fights as the wave needs', () => {
    expect(SPOTS.f11_wall.fightLimit).toBe(STRONGHOLD_WAVE);
  });

  it('is shut on every run after the stronghold', () => {
    const s = armed(fresh());
    s.stats[STRONGHOLD_KEY] = 1;
    expect(wallMonsters(s)).toEqual([]);
  });
});

describe('floor 11 on the ladder', () => {
  it('opens only once every floor below is cleared', () => {
    const s = fresh();
    s.prestige.purchases['city_key'] = 1;
    expect(floorUnlocked(s, FLOORS.ascent_f11)).toBe(false);
    clearFloors(s.stats, Object.values(FLOORS).filter((f) => f.bandId && f.index < 11).map((f) => f.id));
    expect(floorUnlocked(s, FLOORS.ascent_f11)).toBe(true);
  });

  it('its clear is the harbor’s roadstead, which a first climb never reaches', () => {
    expect(FLOORS.ascent_f11.clear).toEqual([
      { type: 'stat', key: 'sea:crates:won', value: 8 },
      { type: 'stat', key: 'fights:f11_roadstead', value: 1 },
    ]);
    expect(SPOTS.f11_road.connections.find((c) => c.to === 'f11_quay')?.requires).toEqual([
      { type: 'stat', key: STRONGHOLD_KEY, value: 1 },
    ]);
  });
});
