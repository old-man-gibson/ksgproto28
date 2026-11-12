import { describe, expect, it } from 'vitest';
import { FLOORS } from '../src/core/registry';
import { createInitialState, SAVE_VERSION } from '../src/core/state';
import { migrate } from '../src/core/save/migrations';
import { deserialize, serialize } from '../src/core/save/save';
import { clearMet } from '../src/core/systems/ladder';
import type { GameState } from '../src/core/types';

/**
 * Save v64 → v65: floor 17 changed its clear from the placeholder fight
 * (`fights:f17_keeper`) to the regent's boss kill (`boss:f17_keeper`) behind
 * the peak gate (`boss:f17_peak`). The fixtures below have the v64 shape: the
 * placeholder floor's two spots and the old counter.
 */

/** A v64 save: version 64 and the given fields over a fresh state, as plain JSON. */
const v64 = (fields: Record<string, unknown>): Record<string, unknown> =>
  JSON.parse(JSON.stringify({ ...createInitialState(7), version: 64, ...fields }));

describe('save v65: the placeholder floor 17 carries over', () => {
  it('stamps the new clear and the peak gate on a save that spent the placeholder fight', () => {
    const old = v64({ spot: 'f18_well_head', stats: { 'fights:f17_keeper': 1 } });
    const state = migrate(old, SAVE_VERSION);
    expect(state.version).toBe(SAVE_VERSION);
    expect(state.stats['boss:f17_keeper']).toBe(1);
    expect(state.stats['boss:f17_peak']).toBe(1);
    // Floors 18 to 20 were open on the old clear; they stay open.
    expect(clearMet(state, FLOORS.ascent_f17)).toBe(true);
    expect(state.spot).toBe('f18_well_head');
  });

  it('keeps a save that was cleared and standing at the old keeper spot where it is', () => {
    const old = v64({ spot: 'f17_keeper', activity: 'hunt', stats: { 'fights:f17_keeper': 1 } });
    const state = migrate(old, SAVE_VERSION);
    expect(state.spot).toBe('f17_keeper');
    expect(state.activity).toBe('hunt');
  });

  it('moves a save standing at the old keeper spot without the peak to the landing', () => {
    const old = v64({
      spot: 'f17_keeper',
      activity: 'hunt',
      activityProgress: 5,
      travelPlan: ['f17_keeper'],
      travelIntent: { spot: 'f17_keeper', activity: 'hunt' },
      discovered: ['ascent_foot', 'f17_landing', 'f17_keeper'],
      resumeActivity: { f17_keeper: 'hunt', f17_landing: 'hunt' },
      pendingReturn: { target: { spot: 'f17_keeper', activity: 'hunt' }, phase: 'return', wins: 0 },
      proven: { spot: 'f17_keeper', activity: 'hunt' },
      safeSpots: { nearest: 'f17_keeper', unconditional: 'f17_landing' },
    });
    const state = migrate(old, SAVE_VERSION);
    expect(state.spot).toBe('f17_landing');
    expect(state.activity).toBeNull();
    expect(state.activityProgress).toBe(0);
    expect(state.travel).toBeNull();
    expect(state.travelPlan).toEqual([]);
    expect(state.travelIntent).toBeNull();
    expect(state.pendingApproach).toBeNull();
    expect(state.discovered).toEqual(['ascent_foot', 'f17_landing']);
    expect(state.resumeActivity).toEqual({ f17_landing: 'hunt' });
    expect(state.pendingReturn).toBeNull();
    expect(state.proven).toBeNull();
    expect(state.safeSpots).toEqual({ nearest: null, unconditional: 'f17_landing' });
    // It did not clear anything by being moved.
    expect(state.stats['boss:f17_keeper'] ?? 0).toBe(0);
    expect(clearMet(state, FLOORS.ascent_f17)).toBe(false);
  });

  it('leaves a save at the landing, and an uncleared save elsewhere, untouched', () => {
    const atLanding = migrate(v64({ spot: 'f17_landing', activity: 'hunt' }), SAVE_VERSION);
    expect(atLanding.spot).toBe('f17_landing');
    expect(atLanding.activity).toBe('hunt');
    expect(atLanding.stats['boss:f17_peak'] ?? 0).toBe(0);
    const below = migrate(v64({ spot: 'ascent_foot' }), SAVE_VERSION);
    expect(below.stats['boss:f17_keeper'] ?? 0).toBe(0);
    expect(below.stats['boss:f17_peak'] ?? 0).toBe(0);
  });

  it('is idempotent: a second pass over a migrated save changes nothing', () => {
    const once = migrate(v64({ spot: 'f17_keeper', stats: { 'fights:f17_keeper': 1 } }), SAVE_VERSION);
    const snapshot = JSON.stringify(once);
    // Run the step again as if the version had not been stamped.
    const again = migrate({ ...JSON.parse(snapshot), version: 64 }, SAVE_VERSION);
    expect(JSON.stringify(again)).toBe(snapshot);
    const moved = migrate(v64({ spot: 'f17_keeper' }), SAVE_VERSION);
    const movedAgain = migrate({ ...JSON.parse(JSON.stringify(moved)), version: 64 }, SAVE_VERSION);
    expect(JSON.stringify(movedAgain)).toBe(JSON.stringify(moved));
  });

  it('loads through deserialize, and a v64 payload round-trips to the current version', () => {
    const json = JSON.stringify(v64({ spot: 'f18_well_head', stats: { 'fights:f17_keeper': 1 } }));
    const loaded: GameState = deserialize(json);
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.stats['boss:f17_peak']).toBe(1);
    expect(deserialize(serialize(loaded)).stats['boss:f17_keeper']).toBe(1);
  });
});
