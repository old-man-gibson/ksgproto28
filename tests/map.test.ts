import { describe, expect, it } from 'vitest';
import { createInitialState, SAVE_VERSION } from '../src/core/state';
import { DEBUG_STARTING_SPOT } from '../src/core/registry';
import { Game } from '../src/core/game';
import { deserialize } from '../src/core/save/save';
import {
  canFastTravel,
  fastTravelCost,
  fastTravelTo,
  findPath,
  pathTicks,
  travelPlanTo,
} from '../src/core/systems/locations';

function discovered(g: Game, ...spots: string[]): void {
  for (const s of spots) if (!g.state.discovered.includes(s)) g.state.discovered.push(s);
}

// These journeys are all written from the square — the classic dev start the
// DebugPanel toggle preserves. The STORY now starts at home (my_home, 09:00).
const classicState = (seed: number) => createInitialState(seed, DEBUG_STARTING_SPOT);

describe('pathfinding', () => {
  it('finds the shortest route by ticks through discovered spots', () => {
    const g = new Game(classicState(1));
    discovered(g, 'village_square', 'training_grounds', 'village_library', 'woods_edge', 'deep_woods', 'ravine_rim', 'ravine_floor');
    // Without exploring deep_woods, the hidden chute is invisible:
    // village_square → ravine_rim → ravine_floor (150 + 250 = 400)
    expect(findPath(g.state, 'village_square', 'ravine_floor')).toEqual(['ravine_rim', 'ravine_floor']);

    // Exploring deep_woods reveals the one-way chute:
    // square → woods (80) → deep (100) → chute (40) = 220 beats 400.
    g.state.explored['deep_woods'] = 999;
    expect(findPath(g.state, 'village_square', 'ravine_floor')).toEqual(['woods_edge', 'deep_woods', 'ravine_floor']);
  });

  it('one-way edges only work forward — the way back differs', () => {
    const g = new Game(classicState(2));
    discovered(g, 'village_square', 'woods_edge', 'deep_woods', 'ravine_rim', 'ravine_floor');
    g.state.explored['deep_woods'] = 999;
    // ravine_floor → deep_woods cannot use the chute in reverse.
    expect(findPath(g.state, 'ravine_floor', 'deep_woods')).toEqual([
      'ravine_rim',
      'village_square',
      'woods_edge',
      'deep_woods',
    ]);
  });

  it('refuses undiscovered destinations and undiscovered intermediates', () => {
    const g = new Game(classicState(3));
    expect(findPath(g.state, 'village_square', 'ravine_floor')).toBeNull(); // undiscovered dest
    discovered(g, 'ravine_floor'); // but nothing in between
    expect(findPath(g.state, 'village_square', 'ravine_floor')).toBeNull();
  });

  it('pathTicks sums edge costs', () => {
    const g = new Game(classicState(4));
    discovered(g, 'village_square', 'ravine_rim', 'ravine_floor');
    const path = findPath(g.state, 'village_square', 'ravine_floor')!;
    expect(pathTicks('village_square', path)).toBe(400);
  });
});

describe('multi-leg journeys', () => {
  it('walks an auto-routed journey to completion, one arrive per hop', () => {
    const g = new Game(classicState(5));
    discovered(g, 'woods_edge', 'deep_woods');
    const arrivals: string[] = [];
    g.bus.on('arrive', (ev) => arrivals.push(ev.spot));

    expect(travelPlanTo(g.state, g.bus, 'deep_woods')).toBe(true);
    expect(g.state.travelPlan).toEqual(['deep_woods']);
    for (let i = 0; i < 200 && g.state.spot !== 'deep_woods'; i++) g.tick();
    expect(g.state.spot).toBe('deep_woods');
    expect(g.state.travelPlan).toEqual([]);
    expect(arrivals).toEqual(['woods_edge', 'deep_woods']);
  });

  it('cancel keeps the current leg but drops the rest', () => {
    const g = new Game(classicState(6));
    discovered(g, 'woods_edge', 'deep_woods');
    travelPlanTo(g.state, g.bus, 'deep_woods');
    g.cancelTravelPlan();
    for (let i = 0; i < 200 && g.state.travel; i++) g.tick();
    expect(g.state.spot).toBe('woods_edge'); // stopped at the first halt
    expect(g.state.travel).toBeNull();
  });

  it('walking grants Scouting XP by distance and can manifest it', () => {
    const g = new Game(classicState(20));
    expect(g.state.skills['scouting']).toBeUndefined();
    discovered(g, 'training_grounds');
    g.travelTo('training_grounds'); // 30 ticks
    for (let i = 0; i < 40; i++) g.tick();
    expect(g.state.spot).toBe('training_grounds');
    expect(g.state.skills['scouting']).toBeDefined(); // manifested by the road
    expect(g.state.skills['scouting'].xp).toBeGreaterThan(0); // 30 × 0.08 × skillXp

    // A long leg grants proportionally more.
    const before = g.state.skills['scouting'].xp;
    g.travelTo('village_square');
    for (let i = 0; i < 40; i++) g.tick();
    expect(g.state.skills['scouting'].xp).toBeCloseTo(before + 30 * 0.08 * 1.01, 1);
  });

  it('fast travel teaches nothing', () => {
    const g = new Game(classicState(21));
    discovered(g, 'hamlet_square');
    g.state.gold = 5000;
    fastTravelTo(g.state, g.bus, 'hamlet_square');
    expect(g.state.spot).toBe('hamlet_square');
    expect(g.state.skills['scouting']).toBeUndefined();
  });

  it('manual travel and activity selection clear a pending plan', () => {
    const g = new Game(classicState(7));
    discovered(g, 'training_grounds');
    g.state.travelPlan = ['deep_woods'];
    g.travelTo('training_grounds');
    expect(g.state.travelPlan).toEqual([]);

    const g2 = new Game(classicState(8));
    g2.state.travelPlan = ['deep_woods'];
    g2.selectActivity('rest_inn');
    expect(g2.state.travelPlan).toEqual([]);
  });
});

describe('fast travel', () => {
  function ready(seed: number): Game {
    const g = new Game(classicState(seed));
    discovered(g, 'village_square', 'hamlet_square', 'malgeri_base');
    g.state.gold = 50000;
    return g;
  }

  it('teleports between discovered waypoints for gold, emitting arrive', () => {
    const g = ready(9);
    let arrived = '';
    g.bus.on('arrive', (ev) => (arrived = ev.spot));
    const cost = fastTravelCost(g.state, 'hamlet_square');
    expect(fastTravelTo(g.state, g.bus, 'hamlet_square')).toBe(true);
    expect(g.state.spot).toBe('hamlet_square');
    expect(g.state.gold).toBe(50000 - cost);
    expect(g.state.travel).toBeNull(); // instant
    expect(arrived).toBe('hamlet_square');
  });

  it('cost follows the discovered walking route when one exists', () => {
    const g = ready(10);
    discovered(g, 'ravine_rim', 'malgeri_path', 'old_path', 'town_gates');
    // village → rim(150) → malgeri_path(400) → old_path(120) → gates(50) → hamlet(30) = 750
    expect(fastTravelCost(g.state, 'hamlet_square')).toBe(1500);
  });

  it('refuses off-waypoint, undiscovered targets, and empty purses', () => {
    const g = ready(11);
    g.state.spot = 'woods_edge'; // not a waypoint
    expect(canFastTravel(g.state, 'hamlet_square')).toBe(false);

    g.state.spot = 'village_square';
    g.state.discovered = g.state.discovered.filter((s) => s !== 'hamlet_square');
    expect(canFastTravel(g.state, 'hamlet_square')).toBe(false);

    discovered(g, 'hamlet_square');
    g.state.gold = 5;
    expect(fastTravelTo(g.state, g.bus, 'hamlet_square')).toBe(false);
    expect(g.state.spot).toBe('village_square');
  });
});

describe('migration', () => {
  it('v4 saves migrate to v5 with an empty travel plan', () => {
    const v4 = createInitialState(12) as unknown as Record<string, unknown>;
    v4.version = 4;
    delete v4.travelPlan;
    const loaded = deserialize(JSON.stringify(v4));
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.travelPlan).toEqual([]);
  });
});
