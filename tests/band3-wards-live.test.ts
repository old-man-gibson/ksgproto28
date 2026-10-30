import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { FLOORS, SPOTS } from '../src/core/registry';
import { WARD_WINDOWS } from '../src/core/data/wards.data';
import { eligibleEncounters, spawnMonster } from '../src/core/systems/combat';
import { statsFromAttrs } from '../src/core/systems/monsterStats';
import { floorCleared } from '../src/core/systems/ladder';
import { wardClockKey } from '../src/core/systems/wards';
import { catchUpTicks } from '../src/core/save/offline';
import type { GameState } from '../src/core/types';
import { clearFloors } from './fixtures/floors';

/**
 * Band 3's wards end to end on the live content: the engine (positions,
 * stamps, kept wounds, the window) and the four wards together
 * (docs/plans/bands-2-3.md, "The four wards"). The engine's own tests run on
 * fixtures; these run on floor 7's real demon.
 */

const WIN = WARD_WINDOWS.find((w) => w.id === 'f7_demon')!;

/** Floors 1-6 cleared, the city key owned, standing in the castle court. */
function cityOpen(): GameState {
  const s = createInitialState(0, 'castle_court');
  clearFloors(s.stats);
  s.prestige.purchases.city_key = 1;
  if (!s.discovered.includes('castle_court')) s.discovered.push('castle_court');
  return s;
}

const rows = (s: GameState, spot: string) => eligibleEncounters(s, SPOTS[spot]).map((e) => e.monsterId);

describe('band 3 wards, live', () => {
  it('positions follow the clears: one ward down puts the others at 1, and ward 7 goes to the siege', () => {
    const s = cityOpen();
    const game = new Game(s);
    game.tick();
    expect(s.stats['band:pos:ascent_f7'] ?? 0).toBe(0);
    expect(rows(s, 'f7_merchant_road').length).toBeGreaterThan(0);
    clearFloors(s.stats, ['ascent_f8']);
    game.resyncAnnouncers(); // what a load does; a real clear runs checkFloorClears
    game.tick();
    expect(s.stats['band:pos:ascent_f7']).toBe(1);
    expect(s.stats['band:pos:ascent_f9']).toBe(1);
    expect(rows(s, 'f7_merchant_road')).toEqual([]);
    expect(rows(s, 'f7_stockade').length).toBeGreaterThan(0);
  });

  it('ward 7 last: the window opens at the third clear, counts only live ticks, and its lapse clears the ward', () => {
    const s = cityOpen();
    const game = new Game(s);
    clearFloors(s.stats, ['ascent_f8', 'ascent_f9', 'ascent_f10']);
    game.resyncAnnouncers();
    game.tick();
    expect(s.stats['band:pos:ascent_f7']).toBe(3);
    expect(s.stats[WIN.atKey]).toBeGreaterThan(0);
    expect(rows(s, 'f7_burnt_camp')).toEqual(['ph_camp_demon']);
    // Catch-up does not move the window's clock.
    const before = s.stats[wardClockKey(WIN)] ?? 0;
    catchUpTicks(game, 2000);
    expect(s.stats[wardClockKey(WIN)] ?? 0).toBe(before);
    // Live ticks do; at the end the ward is cleared and the unmet flag set.
    for (let i = 0; i < WIN.ticks + 5 && !s.stats[WIN.doneKey]; i++) game.tick();
    expect(s.stats[WIN.doneKey]).toBe(1);
    expect(s.stats[WIN.goneKey]).toBe(1);
    expect(s.stats[WIN.flags.unmet]).toBe(1);
    expect(s.stats[WIN.flags.fought]).toBeUndefined();
    expect(floorCleared(s, FLOORS.ascent_f7)).toBe(true);
    expect(rows(s, 'f7_burnt_camp')).toEqual([]);
  });

  it("the demon's next spawn starts with its kept wounds", () => {
    const s = cityOpen();
    s.stats['band:pos:ascent_f7'] = 3;
    const maxOf = (m: ReturnType<typeof spawnMonster>) => statsFromAttrs(m.attrs).maxHp;
    const whole = spawnMonster(s, SPOTS.f7_burnt_camp);
    expect(whole.defId).toBe('ph_camp_demon');
    expect(whole.hp).toBe(maxOf(whole));
    s.stats['ward:f7:demon:wounds'] = 0.4;
    const wounded = spawnMonster(s, SPOTS.f7_burnt_camp);
    expect(wounded.hp).toBe(Math.max(1, Math.round(maxOf(wounded) * 0.6)));
  });
});
