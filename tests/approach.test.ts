import { afterAll, describe, expect, it } from 'vitest';
import { createInitialState, SAVE_VERSION } from '../src/core/state';
import { Game } from '../src/core/game';
import { ADJACENCY, SPOTS, type Edge } from '../src/core/registry';
import { deserialize } from '../src/core/save/save';
import {
  eligibleEncounters,
  fightsKey,
  slainKey,
  spotCleared,
  spawnMonster,
} from '../src/core/systems/combat';
import { applyStatus, hasStatus, statusIncomingDamageMult } from '../src/core/systems/statuses';
import { getDerivedStats } from '../src/core/systems/derived';
import type { MonsterInstance, SpotDef } from '../src/core/types';

/**
 * Approach bonuses, surprised's teeth, and finite fights. Pocket world:
 *
 *   ap_camp (haven) ⇄ ap_gate (explore + lever find) ⇄ ap_nest (forced)
 *                          ⇘ ap_lair (forced, once-boss, fightLimit 1)
 *
 * The road gate → nest carries an approach: enemies surprised, self
 * flat-footed. The camp → gate road carries one gated on the lever flag.
 */
const ARENA: Record<string, SpotDef> = {
  ap_camp: {
    id: 'ap_camp', name: 'Approach Camp', icon: '🏕️', areaId: 'oakrest', desc: '',
    activities: [{ id: 'rest', kind: 'rest', name: 'Camp', icon: '🏕️' }],
    connections: [{ to: 'ap_gate', ticks: 5 }],
  },
  ap_gate: {
    id: 'ap_gate', name: 'Approach Gate', icon: '🚪', areaId: 'oakrest', desc: '',
    activities: [{ id: 'explore', kind: 'explore', name: 'Explore', icon: '🧭' }],
    exploreTicks: 10,
    finds: [{ id: 'lever', at: 0.5, desc: '🎚️ A lever, and you pull it.', stat: { key: 'flag:test_lever' } }],
    connections: [
      { to: 'ap_nest', ticks: 5 },
      { to: 'ap_lair', ticks: 5 },
    ],
  },
  ap_nest: {
    id: 'ap_nest', name: 'Approach Nest', icon: '🕸️', areaId: 'oakrest', desc: '', forced: true,
    activities: [],
    encounters: [
      { monsterId: 'forest_rat', weight: 100, level: [1, 1] },
      // Only prowls once the lever elsewhere has been pulled.
      { monsterId: 'young_wolf', weight: 100, level: [2, 2], requires: [{ type: 'stat', key: 'flag:test_lever', value: 1 }] },
    ],
    groupWeights: { 1: 100 },
    connections: [],
  },
  ap_lair: {
    id: 'ap_lair', name: 'Approach Lair', icon: '🕳️', areaId: 'oakrest', desc: '', forced: true,
    fightLimit: 1,
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Hunt', icon: '🏹' }],
    encounters: [{ monsterId: 'forest_rat', weight: 100, level: [1, 1], once: true }],
    groupWeights: { 1: 100 },
    connections: [],
  },
};

const EDGES: Record<string, Edge[]> = {
  ap_camp: [
    // Gated approach: tells only once the lever flag is set. The gate itself
    // has nothing to fight — the stamp is what this edge exists to test.
    {
      from: 'ap_camp', to: 'ap_gate', ticks: 5,
      approach: { requires: [{ type: 'stat', key: 'flag:test_lever', value: 1 }], enemies: [{ id: 'surprised' }] },
    },
  ],
  ap_gate: [
    { from: 'ap_gate', to: 'ap_camp', ticks: 5 },
    {
      from: 'ap_gate', to: 'ap_nest', ticks: 5,
      approach: { enemies: [{ id: 'surprised' }], self: [{ id: 'flat_footed' }] },
    },
    { from: 'ap_gate', to: 'ap_lair', ticks: 5 },
  ],
  ap_nest: [{ from: 'ap_nest', to: 'ap_gate', ticks: 5 }],
  ap_lair: [{ from: 'ap_lair', to: 'ap_gate', ticks: 5 }],
};

for (const [id, spot] of Object.entries(ARENA)) SPOTS[id] = spot;
for (const [id, edges] of Object.entries(EDGES)) ADJACENCY.set(id, edges);

afterAll(() => {
  for (const id of Object.keys(ARENA)) {
    delete SPOTS[id];
    ADJACENCY.delete(id);
  }
});

function arenaGame(seed: number, spot: string): Game {
  const g = new Game(createInitialState(seed));
  g.state.spot = spot;
  g.state.discovered.push(...Object.keys(ARENA));
  g.state.safeSpots = { nearest: 'ap_camp', unconditional: 'ap_camp' };
  return g;
}

function walkTo(g: Game, to: string): void {
  expect(g.travelTo(to), `travel to ${to} should start`).toBe(true);
  for (let i = 0; i < 200 && g.state.travel; i++) g.tick();
}

describe('the surprised condition', () => {
  it('amplifies incoming damage by 30% per intensity, on either side', () => {
    const g = arenaGame(1, 'ap_camp');
    const bearer = { statuses: [] } as unknown as MonsterInstance;
    expect(statusIncomingDamageMult(bearer)).toBe(1);
    applyStatus(g.state, bearer, { id: 'surprised' });
    expect(statusIncomingDamageMult(bearer)).toBeCloseTo(1.3);

    applyStatus(g.state, g.state, { id: 'surprised', intensity: 2 });
    expect(statusIncomingDamageMult(g.state)).toBeCloseTo(1.6);
  });
});

describe('approach bonuses', () => {
  it('the road in surprises the nest and leaves you flat-footed, before anyone swings', () => {
    const g = arenaGame(2, 'ap_gate');
    walkTo(g, 'ap_nest');

    expect(g.state.combat?.forced).toBe(true);
    const front = g.state.combat!.enemies[0]!;
    expect(hasStatus(front, 'surprised')).toBe(true);
    expect(hasStatus(g.state, 'flat_footed')).toBe(true);
    expect(g.state.pendingApproach).toBeNull(); // spent on this first meeting

    // Opening tempo: the bar starts one tick short of full, not at zero.
    const stats = getDerivedStats(g.state);
    expect(g.state.combat!.playerBar).toBeGreaterThan(stats.actionBar * 0.5);
  });

  it('the bite lands in the books: a blow on the surprised rat carries the step, once', () => {
    const g = arenaGame(3, 'ap_gate');
    walkTo(g, 'ap_nest');
    for (let i = 0; i < 3000 && g.state.combat; i++) g.tick();
    expect(g.state.lastFight?.outcome).toBe('won');

    // The transcript keeps every blow's breakdown; the ambush names itself
    // there — and only on the blow that spent it.
    const bitten = g.state.lastFight!.transcript.filter((e) =>
      e.damage?.steps.some((s) => s.label === 'Conditions on the target'),
    );
    expect(bitten.length).toBe(1);
  });

  it('a gated approach does not tell until the lever is pulled', () => {
    const g = arenaGame(4, 'ap_camp');
    walkTo(g, 'ap_gate');
    expect(g.state.pendingApproach).toBeNull(); // flag unset: the stamp never lands

    walkTo(g, 'ap_camp');
    g.state.stats['flag:test_lever'] = 1;
    walkTo(g, 'ap_gate');
    expect(g.state.pendingApproach?.spot).toBe('ap_gate'); // now it tells
  });

  it('pulling the lever is a find like any other', () => {
    const g = arenaGame(5, 'ap_gate');
    g.selectActivity('explore');
    for (let i = 0; i < 40 && !g.state.stats['flag:test_lever']; i++) g.tick();
    expect(g.state.stats['flag:test_lever']).toBe(1);
  });

  it('a gated encounter joins the table when its flag is set', () => {
    const g = arenaGame(6, 'ap_nest');
    expect(eligibleEncounters(g.state, SPOTS.ap_nest).map((e) => e.monsterId)).toEqual(['forest_rat']);
    g.state.stats['flag:test_lever'] = 1;
    expect(eligibleEncounters(g.state, SPOTS.ap_nest).map((e) => e.monsterId)).toEqual([
      'forest_rat',
      'young_wolf',
    ]);
    // ...and the spawner reads the same list.
    const spawned = spawnMonster(g.state, SPOTS.ap_nest);
    expect(['forest_rat', 'young_wolf']).toContain(spawned.defId);
  });
});

describe('finite fights', () => {
  it('a once-kill is recorded, the budget spends, and the lair goes quiet', () => {
    const g = arenaGame(7, 'ap_gate');
    walkTo(g, 'ap_lair');
    expect(g.state.combat?.forced).toBe(true);
    for (let i = 0; i < 3000 && g.state.combat; i++) g.tick();
    expect(g.state.lastFight?.outcome).toBe('won');

    expect(g.state.stats[slainKey('ap_lair', 'forest_rat')]).toBe(1);
    expect(g.state.stats[fightsKey('ap_lair')]).toBe(1);
    expect(spotCleared(g.state, SPOTS.ap_lair)).toBe(true);
    expect(eligibleEncounters(g.state, SPOTS.ap_lair)).toEqual([]);

    // Cleared: re-entering is just arriving, and hunting finds no one.
    walkTo(g, 'ap_gate');
    walkTo(g, 'ap_lair');
    expect(g.state.combat).toBeNull();
    g.selectActivity('hunt');
    for (let i = 0; i < 100; i++) g.tick();
    expect(g.state.combat).toBeNull();
  });

  it('resetting the counters repopulates the lair — the flag brings the boss back', () => {
    const g = arenaGame(8, 'ap_gate');
    walkTo(g, 'ap_lair');
    for (let i = 0; i < 3000 && g.state.combat; i++) g.tick();
    expect(spotCleared(g.state, SPOTS.ap_lair)).toBe(true);

    // What a reset find would write (stat: { key, set: 0 } on both counters).
    g.state.stats[slainKey('ap_lair', 'forest_rat')] = 0;
    g.state.stats[fightsKey('ap_lair')] = 0;
    expect(spotCleared(g.state, SPOTS.ap_lair)).toBe(false);

    walkTo(g, 'ap_gate');
    walkTo(g, 'ap_lair');
    expect(g.state.combat?.forced).toBe(true); // forced again: the lair is restocked
  });
});

describe('migration', () => {
  it('a v38 save arrives with no approach pending', () => {
    const v38 = createInitialState(9) as unknown as Record<string, unknown>;
    v38.version = 38;
    delete v38.pendingApproach;
    const migrated = deserialize(JSON.stringify(v38));
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.pendingApproach).toBeNull();
  });
});
