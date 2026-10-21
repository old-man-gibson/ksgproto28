// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState, SAVE_VERSION } from '../src/core/state';
import { Game } from '../src/core/game';
import { deserialize } from '../src/core/save/save';
import { FLOORS, SPOTS, STARTING_SPOT } from '../src/core/registry';
import { canRestAt, isUnconditionalHaven, noteSafeSpot, retreatSpot, retreatToSafety } from '../src/core/systems/safety';
import type { SpotDef } from '../src/core/types';
import { BAND_ONE } from './fixtures/floors';

/**
 * Where a fight you could not flee throws you. The invariant under test is
 * that you ALWAYS land somewhere: a haven gated on gear is no haven on the day
 * the gear is gone, which is the entire reason two slots are tracked.
 */
describe('safe spots', () => {
  const openCamp: SpotDef = {
    id: 'open_camp', name: 'Open Camp', icon: '🏕️', areaId: 'oakrest', desc: '',
    activities: [{ id: 'rest', kind: 'rest', name: 'Camp', icon: '🏕️' }],
    connections: [],
  };
  const gatedCamp: SpotDef = {
    id: 'gated_camp', name: 'Sheltered Cave', icon: '🕳️', areaId: 'oakrest', desc: '',
    activities: [
      { id: 'rest', kind: 'rest', name: 'Shelter', icon: '🔥', requires: [{ type: 'equippedTag', tag: 'lantern' }] },
    ],
    connections: [],
  };

  it('tells a haven anyone may use from one that asks something', () => {
    const g = new Game(createInitialState(1));
    expect(isUnconditionalHaven(openCamp)).toBe(true);
    expect(isUnconditionalHaven(gatedCamp)).toBe(false);
    expect(canRestAt(g.state, openCamp)).toBe(true);
    expect(canRestAt(g.state, gatedCamp)).toBe(false); // no lantern
  });

  it('records both slots, and the conditional one only when usable', () => {
    const g = new Game(createInitialState(2));
    SPOTS['open_camp'] = openCamp;
    SPOTS['gated_camp'] = gatedCamp;
    try {
      noteSafeSpot(g.state, 'open_camp');
      expect(g.state.safeSpots).toEqual({ nearest: 'open_camp', unconditional: 'open_camp' });

      // Walking past a shelter you cannot use changes nothing.
      noteSafeSpot(g.state, 'gated_camp');
      expect(g.state.safeSpots.nearest).toBe('open_camp');
      expect(g.state.safeSpots.unconditional).toBe('open_camp');
    } finally {
      delete SPOTS['open_camp'];
      delete SPOTS['gated_camp'];
    }
  });

  it('falls back when the nearest haven has closed behind you', () => {
    const g = new Game(createInitialState(3));
    SPOTS['open_camp'] = openCamp;
    SPOTS['gated_camp'] = gatedCamp;
    try {
      g.state.safeSpots = { nearest: 'gated_camp', unconditional: 'open_camp' };
      // The lantern is gone, so the shelter is shut — the open camp catches it.
      expect(retreatSpot(g.state)).toBe('open_camp');
    } finally {
      delete SPOTS['open_camp'];
      delete SPOTS['gated_camp'];
    }
  });

  it('always lands somewhere, even with nothing recorded — and that somewhere is the start, not data order', () => {
    const g = new Game(createInitialState(4));
    expect(g.state.safeSpots).toEqual({ nearest: null, unconditional: null });
    const to = retreatSpot(g.state);
    expect(SPOTS[to], 'retreat must name a real spot').toBeDefined();
    expect(isUnconditionalHaven(SPOTS[to])).toBe(true);
    expect(to).toBe(STARTING_SPOT);
  });

  it('every tower landing is a camp, so a fall on a floor lands on that floor', () => {
    for (const landing of BAND_ONE.map((id) => FLOORS[id].landing!)) {
      const g = new Game(createInitialState(6));
      expect(isUnconditionalHaven(SPOTS[landing]), `${landing} has no camp`).toBe(true);
      noteSafeSpot(g.state, landing);
      expect(retreatSpot(g.state)).toBe(landing);
    }
  });

  it('retreating moves you, clears what you were doing, and marks the spot known', () => {
    const g = new Game(createInitialState(5));
    g.state.spot = 'deep_woods';
    g.state.activity = 'explore';
    g.state.safeSpots = { nearest: 'village_square', unconditional: 'village_square' };

    const from = retreatToSafety(g.state, g.bus, 'The pack drags you down.');
    expect(from).toBe('deep_woods');
    expect(g.state.spot).toBe('village_square');
    expect(g.state.activity).toBeNull();
    expect(g.state.discovered).toContain('village_square');
  });

  it('a v37 save standing in an inn wakes up remembering it', () => {
    const v37 = createInitialState(6) as unknown as Record<string, unknown>;
    v37.version = 37;
    v37.spot = 'village_square'; // has an unconditional rest
    delete v37.safeSpots;
    const migrated = deserialize(JSON.stringify(v37));
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.safeSpots).toEqual({ nearest: 'village_square', unconditional: 'village_square' });
  });

  it('a v37 save standing somewhere wild starts with nothing recorded', () => {
    const v37 = createInitialState(7) as unknown as Record<string, unknown>;
    v37.version = 37;
    v37.spot = 'benchmark_post'; // no rest activity
    delete v37.safeSpots;
    const migrated = deserialize(JSON.stringify(v37));
    expect(migrated.safeSpots).toEqual({ nearest: null, unconditional: null });
  });
});
