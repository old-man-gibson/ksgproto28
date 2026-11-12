import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { ATTRIBUTE_LIST } from '../src/core/data/attributes.data';
import { CALM_SEEN_KEY } from '../src/core/data/climate.data';
import { calmSpell, worldSeedOf } from '../src/core/systems/weather';
import { startActivity } from '../src/core/systems/actions';
import { OFFLINE_CAP_MS, runOfflineProgress } from '../src/core/save/offline';
import type { GameState } from '../src/core/types';

/**
 * The calm secret across offline catch-up (docs/MALGERI.md, "The disclosure
 * rule"): the same ticks leave the same state whether the player watched them or
 * was away. Catch-up used to skip the first-calm stamp, so the calm lines were
 * fought offline with the flag unset, their kills stayed veiled and the
 * bestiary came out three entries short of the live run.
 */

const CREATED = 1_754_000_000_000;
const SEED = worldSeedOf(CREATED);
const TICKS_PER_MINUTE = 10;
const OFFLINE_TICKS = 288_000;

/** A strong hunter on the open east ridge, the clock a little before the first calm spell. */
function ridgeHunter(): GameState {
  const state = createInitialState(CREATED, 'f17_east_ridge');
  const [start] = calmSpell(SEED, 'malgeri_range', 2);
  state.totalTicks = Math.max(0, Math.ceil(start / 3) * 3 * TICKS_PER_MINUTE - 3000);
  for (const a of ATTRIBUTE_LIST) state.attrs[a.id].level = 150;
  state.level = 60;
  const bus = { emit: () => {}, on: () => () => {} };
  startActivity(state, bus as never, 'hunt');
  return state;
}

describe('catch-up and the first calm', () => {
  it('288,000 ticks offline and the same ticks live leave the same flag and bestiary count', () => {
    const live = new Game(ridgeHunter());
    for (let i = 0; i < OFFLINE_TICKS; i++) live.tick();

    const away = new Game(ridgeHunter());
    const summary = runOfflineProgress(away, OFFLINE_CAP_MS)!;

    const liveFlag = live.state.stats[CALM_SEEN_KEY] ?? 0;
    expect(liveFlag, 'the live run must stand under a calm for the comparison to mean anything').toBe(1);
    expect(away.state.stats[CALM_SEEN_KEY] ?? 0).toBe(liveFlag);
    expect(away.state.stats['bestiary:entries'] ?? 0).toBe(live.state.stats['bestiary:entries'] ?? 0);
    expect(summary.firstCalm).toBeTruthy();
    // The hunter really fought the calm lines, so the comparison covers veiled kills.
    expect(live.state.bestiary.malgeri_ridge_wolf?.kills ?? 0).toBeGreaterThan(0);
    for (const id of ['malgeri_ridge_wolf', 'malgeri_cairn_brute', 'malgeri_hollow_seer']) {
      expect((away.state.bestiary[id]?.firstKill ?? 0) > 0, id).toBe((live.state.bestiary[id]?.firstKill ?? 0) > 0);
      expect(away.state.bestiary[id]?.kills ?? 0, id).toBe(live.state.bestiary[id]?.kills ?? 0);
    }
  }, 120_000);
});
