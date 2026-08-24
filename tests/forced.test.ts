import { afterAll, describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { ADJACENCY, SPOTS, type Edge } from '../src/core/registry';
import { findPath } from '../src/core/systems/locations';
import type { SpotDef } from '../src/core/types';

/**
 * Forced, unfleeable fights. The chain under test: a spot (or the road into
 * it) declares the ambush → arriving starts the fight with no activity
 * selected → every door out (travel, fast travel, switching work) is refused
 * → winning frees you where you stand, losing calls retreatToSafety.
 *
 * A pocket world is spliced into SPOTS/ADJACENCY for the duration:
 *
 *   ff_camp (haven,⚡) ⇄ ff_gate ⇄ ff_den (forced,⚡) ⇄ ff_beyond
 *                            ⇘ ff_arena (via a forced EDGE)
 */
const ARENA: Record<string, SpotDef> = {
  ff_camp: {
    id: 'ff_camp', name: 'Test Camp', icon: '🏕️', areaId: 'oakrest', desc: '', waypoint: true,
    activities: [{ id: 'rest', kind: 'rest', name: 'Camp', icon: '🏕️' }],
    connections: [{ to: 'ff_gate', ticks: 5 }],
  },
  ff_gate: {
    id: 'ff_gate', name: 'Test Gate', icon: '🚪', areaId: 'oakrest', desc: '',
    activities: [],
    connections: [
      { to: 'ff_den', ticks: 5 },
      { to: 'ff_arena', ticks: 5, forced: true },
    ],
  },
  ff_den: {
    id: 'ff_den', name: 'Test Den', icon: '🕳️', areaId: 'oakrest', desc: '', waypoint: true, forced: true,
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Hunt', icon: '🏹' },
      // Deliberately ALSO a haven: the loss test proves an ambushed arrival
      // never records the ambush site as the place its own loss returns to.
      { id: 'rest', kind: 'rest', name: 'Cold Fire Pit', icon: '🔥' },
    ],
    encounters: [{ monsterId: 'forest_rat', weight: 100, level: [1, 1] }],
    connections: [{ to: 'ff_beyond', ticks: 5 }],
  },
  ff_arena: {
    id: 'ff_arena', name: 'Test Arena', icon: '⚔️', areaId: 'oakrest', desc: '',
    activities: [],
    encounters: [{ monsterId: 'forest_rat', weight: 100, level: [1, 1] }],
    connections: [],
  },
  ff_beyond: {
    id: 'ff_beyond', name: 'Test Beyond', icon: '🌫️', areaId: 'oakrest', desc: '',
    activities: [],
    connections: [],
  },
};

// ADJACENCY was built from the real content at module load, so the pocket
// world's edges are spliced in by hand — declared direction and mirror both,
// with `forced` deliberately absent from every mirror (the rule under test).
const EDGES: Record<string, Edge[]> = {
  ff_camp: [{ from: 'ff_camp', to: 'ff_gate', ticks: 5 }],
  ff_gate: [
    { from: 'ff_gate', to: 'ff_camp', ticks: 5 },
    { from: 'ff_gate', to: 'ff_den', ticks: 5 },
    { from: 'ff_gate', to: 'ff_arena', ticks: 5, forced: true },
  ],
  ff_den: [
    { from: 'ff_den', to: 'ff_gate', ticks: 5 },
    { from: 'ff_den', to: 'ff_beyond', ticks: 5 },
  ],
  ff_arena: [{ from: 'ff_arena', to: 'ff_gate', ticks: 5 }],
  ff_beyond: [{ from: 'ff_beyond', to: 'ff_den', ticks: 5 }],
};

for (const [id, spot] of Object.entries(ARENA)) SPOTS[id] = spot;
for (const [id, edges] of Object.entries(EDGES)) ADJACENCY.set(id, edges);

afterAll(() => {
  for (const id of Object.keys(ARENA)) {
    delete SPOTS[id];
    ADJACENCY.delete(id);
  }
});

/** A game standing at `spot` with the whole pocket world on the map. */
function arenaGame(seed: number, spot: string): Game {
  const g = new Game(createInitialState(seed));
  g.state.spot = spot;
  g.state.discovered.push(...Object.keys(ARENA));
  g.state.safeSpots = { nearest: 'ff_camp', unconditional: 'ff_camp' };
  return g;
}

/** Walk one declared edge and tick until the travel resolves. */
function walkTo(g: Game, to: string): void {
  expect(g.travelTo(to), `travel to ${to} should start`).toBe(true);
  for (let i = 0; i < 200 && g.state.travel; i++) g.tick();
}

describe('forced fights', () => {
  it('arriving at a forced spot starts a fight that was never asked for', () => {
    const g = arenaGame(1, 'ff_gate');
    walkTo(g, 'ff_den');
    expect(g.state.spot).toBe('ff_den');
    expect(g.state.activity).toBeNull(); // nothing was selected...
    expect(g.state.combat?.forced).toBe(true); // ...and the fight is on anyway
    expect(g.state.log.some((l) => l.msg.includes('no way out'))).toBe(true);
  });

  it('a forced EDGE ambushes too, and the road back out does not', () => {
    const g = arenaGame(2, 'ff_gate');
    walkTo(g, 'ff_arena');
    expect(g.state.combat?.forced).toBe(true);

    // Win it, then walk home — the mirror is an ordinary road.
    //
    // The fight is scaffolding for the road, so it must not be decided by a
    // die. A fresh character has 50 HP and monsters can crit for double since
    // they gained the universal 1-in-20, which is enough to lose a level-1 rat
    // fight on an unlucky seed. Give this one a body that settles it.
    g.state.attrs.con = { level: 8, xp: 0 };
    g.state.resources.hp = 999; // clamped to the new max on the next tick
    for (let i = 0; i < 3000 && g.state.combat; i++) g.tick();
    expect(g.state.lastFight?.outcome).toBe('won');
    walkTo(g, 'ff_gate');
    expect(g.state.spot).toBe('ff_gate');
    expect(g.state.combat).toBeNull();
  });

  it('every door out is refused while the fight is live', () => {
    const g = arenaGame(3, 'ff_gate');
    g.state.gold = 5000;
    walkTo(g, 'ff_den');
    expect(g.state.combat?.forced).toBe(true);

    expect(g.travelTo('ff_gate')).toBe(false);
    expect(g.travelPlanTo('ff_camp')).toBe(false);
    expect(g.fastTravelTo('ff_camp')).toBe(false); // den and camp are both ⚡
    g.selectActivity('hunt');
    expect(g.state.activity).toBeNull();
    expect(g.state.gold).toBe(5000); // the caravan refusal cost nothing
    expect(g.state.spot).toBe('ff_den');
    expect(g.state.combat?.forced).toBe(true);
  });

  it('the fight resolves on its own, with no activity driving it', () => {
    const g = arenaGame(4, 'ff_gate');
    walkTo(g, 'ff_den');
    for (let i = 0; i < 3000 && g.state.combat; i++) g.tick();
    expect(g.state.lastFight?.outcome).toBe('won');
    expect(g.state.recovering).toBe(false);
    // Freedom returns with the win: travel works again.
    expect(g.travelTo('ff_gate')).toBe(true);
  });

  it('losing throws you to the haven instead of leaving you in the den', () => {
    const g = arenaGame(5, 'ff_gate');
    // Repopulate the den with something a fresh character cannot survive.
    SPOTS.ff_den.encounters = [{ monsterId: 'wolf', weight: 100, level: [35, 40] }];
    try {
      walkTo(g, 'ff_den');
      expect(g.state.combat?.forced).toBe(true);
      // The den offers a rest, but an ambushed arrival is not a peaceful
      // visit — it must NOT have been recorded as the nearest haven.
      expect(g.state.safeSpots.nearest).toBe('ff_camp');
      for (let i = 0; i < 5000 && g.state.combat; i++) g.tick();
      expect(g.state.lastFight?.outcome).toBe('knocked_out');
      expect(g.state.spot).toBe('ff_camp'); // retreatToSafety, not recovery in place
      expect(g.state.recovering).toBe(true);
      expect(g.state.combat).toBeNull();
    } finally {
      SPOTS.ff_den.encounters = [{ monsterId: 'forest_rat', weight: 100, level: [1, 1] }];
    }
  });

  it('the pathfinder walks around a forced spot, but will end a journey on one', () => {
    const g = arenaGame(6, 'ff_camp');
    // ff_beyond is only reachable THROUGH the den — no route may be offered.
    expect(findPath(g.state, 'ff_camp', 'ff_beyond')).toBeNull();
    // The den itself is a legal destination: clicking it IS the choice.
    expect(findPath(g.state, 'ff_camp', 'ff_den')).toEqual(['ff_gate', 'ff_den']);
    // The arena sits behind a forced EDGE — same rule, as a destination only.
    expect(findPath(g.state, 'ff_camp', 'ff_arena')).toEqual(['ff_gate', 'ff_arena']);
  });
});
