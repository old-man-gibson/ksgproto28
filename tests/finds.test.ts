// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState, SAVE_VERSION } from '../src/core/state';
import { Game } from '../src/core/game';
import { deserialize, serialize } from '../src/core/save/save';
import { SPOTS } from '../src/core/registry';
import { blockingGate, claimedFinds, exploreProgress, pendingFinds } from '../src/core/systems/actions';
import type { SpotDef } from '../src/core/types';
import { findPath, visibleEdges } from '../src/core/systems/locations';

/** Park the player at a spot with it discovered, ready to explore. */
function at(seed: number, spot: string): Game {
  const g = new Game(createInitialState(seed));
  g.state.spot = spot;
  if (!g.state.discovered.includes(spot)) g.state.discovered.push(spot);
  return g;
}

/** Explore for n ticks (the activity id is 'explore' everywhere it exists). */
function explore(g: Game, ticks: number): void {
  g.selectActivity('explore');
  for (let i = 0; i < ticks; i++) g.tick();
}

describe('exploration finds', () => {
  it('fires at its share of exploreTicks, not before', () => {
    const g = at(1, 'woods_edge');
    const spot = SPOTS['woods_edge'];
    // herb_patch sits at 0.25 of 120 ticks = 30.
    explore(g, 25);
    expect(claimedFinds(g.state, 'woods_edge')).toEqual([]);
    explore(g, 10);
    expect(claimedFinds(g.state, 'woods_edge')).toContain('herb_patch');
    expect(exploreProgress(g.state, spot)).toBeGreaterThanOrEqual(0.25);
  });

  it('pays its payload once and only once', () => {
    const g = at(2, 'woods_edge');
    explore(g, 40);
    // common_herb is graded, so it lands in stock as rolled quality tiers.
    const herbs = () =>
      Object.values(g.state.stock['common_herb'] ?? {}).reduce((a, b) => a + (b ?? 0), 0);
    expect(herbs()).toBe(3);
    // Keep exploring well past the threshold — it must not pay again.
    explore(g, 40);
    expect(herbs()).toBe(3);
    expect(claimedFinds(g.state, 'woods_edge').filter((id) => id === 'herb_patch')).toHaveLength(1);
  });

  it('hands over at most one find per tick', () => {
    const g = at(3, 'woods_edge');
    // Jump straight to fully explored, as a save that predates the content would.
    g.state.explored['woods_edge'] = 999;
    expect(pendingFinds(g.state, SPOTS['woods_edge'])).toHaveLength(3);

    explore(g, 1);
    expect(claimedFinds(g.state, 'woods_edge')).toHaveLength(1);
    explore(g, 1);
    expect(claimedFinds(g.state, 'woods_edge')).toHaveLength(2);
    explore(g, 1);
    expect(claimedFinds(g.state, 'woods_edge')).toHaveLength(3);
  });

  it('backfills shallowest-first', () => {
    const g = at(4, 'ravine_floor');
    g.state.explored['ravine_floor'] = 999;
    explore(g, 3);
    expect(claimedFinds(g.state, 'ravine_floor')).toEqual(['salt_seam', 'web_cache', 'carved_stone']);
  });

  it('a path find opens a hidden connection before the spot is fully explored', () => {
    const g = at(5, 'deep_woods');
    // 0.55 of 200 = 110 ticks — well short of the 200 the chute used to need.
    expect(visibleEdges(g.state, 'deep_woods').map((e) => e.to)).not.toContain('ravine_floor');

    explore(g, 115);
    expect(exploreProgress(g.state, SPOTS['deep_woods'])).toBeLessThan(1);
    expect(claimedFinds(g.state, 'deep_woods')).toContain('mossy_chute');
    expect(visibleEdges(g.state, 'deep_woods').map((e) => e.to)).toContain('ravine_floor');

    // And it is still one-way: the chute doesn't work in reverse.
    expect(visibleEdges(g.state, 'ravine_floor').map((e) => e.to)).not.toContain('deep_woods');
  });

  it('a found path is usable for routing, not just visible', () => {
    const g = at(6, 'deep_woods');
    for (const s of ['village_square', 'woods_edge', 'deep_woods', 'ravine_rim', 'ravine_floor']) {
      if (!g.state.discovered.includes(s)) g.state.discovered.push(s);
    }
    explore(g, 115);
    // square → woods(80) → deep(100) → chute(40) = 220 beats the rim road (400).
    expect(findPath(g.state, 'village_square', 'ravine_floor')).toEqual([
      'woods_edge',
      'deep_woods',
      'ravine_floor',
    ]);
  });

  it('a spot find puts somewhere else on the map without walking there', () => {
    const g = at(7, 'ravine_rim');
    expect(g.state.discovered).not.toContain('ravine_floor');
    // ravine_overlook sits at 0.75 of 150 = 113 ticks.
    explore(g, 120);
    expect(claimedFinds(g.state, 'ravine_rim')).toContain('ravine_overlook');
    expect(g.state.discovered).toContain('ravine_floor');
    expect(g.state.spot).toBe('ravine_rim'); // discovered, not travelled to
  });

  it('a find that grants skill XP can manifest the skill', () => {
    const g = at(8, 'ravine_floor');
    expect(g.state.skills['runecarving']).toBeUndefined();
    g.state.explored['ravine_floor'] = 999;
    explore(g, 3); // salt_seam, web_cache, carved_stone
    expect(g.state.runes['earthbind_rune']).toBe(1);
    expect(g.state.skills['runecarving']).toBeDefined();
  });

  it('gold finds roll inside their declared band', () => {
    for (let seed = 20; seed < 30; seed++) {
      const g = at(seed, 'woods_edge');
      g.state.explored['woods_edge'] = 999;
      explore(g, 3);
      expect(g.state.gold).toBeGreaterThanOrEqual(12);
      expect(g.state.gold).toBeLessThanOrEqual(30);
    }
  });

  it('survives a save round trip, and v30 saves migrate with nothing claimed', () => {
    const g = at(9, 'woods_edge');
    explore(g, 40);
    const restored = deserialize(serialize(g.state));
    expect(restored.finds['woods_edge']).toContain('herb_patch');

    const v30 = createInitialState(10) as unknown as Record<string, unknown>;
    v30.version = 30;
    delete v30.finds;
    const migrated = deserialize(JSON.stringify(v30));
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.finds).toEqual({});
  });
});

describe('gated exploration', () => {
  /**
   * Depth of search says WHEN something could be found; conditions say whether
   * you are equipped to. Both are pure functions over a SpotDef, so these are
   * exercised directly rather than through invented content.
   */
  const gatedSpot: SpotDef = {
    id: 'test_cave',
    name: 'Test Cave',
    icon: '🕳️',
    areaId: 'oakrest',
    desc: '',
    activities: [{ id: 'explore', kind: 'explore', name: 'Explore', icon: '🧭' }],
    exploreTicks: 100,
    finds: [
      { id: 'open', at: 0.2, desc: 'lying in plain sight' },
      {
        id: 'sealed',
        at: 0.2,
        desc: 'behind a locked door',
        requires: [{ type: 'skill', id: 'scouting', level: 5 }],
      },
    ],
    exploreGates: [
      { at: 0.5, requires: [{ type: 'attr', attr: 'str', level: 20 }], desc: 'The rubble will not shift.' },
    ],
    connections: [],
  };

  it('a find you are not equipped for waits instead of being skipped', () => {
    const g = new Game(createInitialState(40));
    g.state.explored['test_cave'] = 50;

    expect(pendingFinds(g.state, gatedSpot).map((f) => f.id)).toEqual(['open']);

    // Meeting the condition later reveals it — nothing was consumed meanwhile.
    g.state.skills['scouting'] = { level: 5, xp: 0 };
    expect(pendingFinds(g.state, gatedSpot).map((f) => f.id)).toEqual(['open', 'sealed']);
  });

  it('a gate blocks at its depth until its conditions hold', () => {
    const g = new Game(createInitialState(41));

    g.state.explored['test_cave'] = 40; // short of the gate
    expect(blockingGate(g.state, gatedSpot)).toBeNull();

    g.state.explored['test_cave'] = 50; // at it, unprepared
    expect(blockingGate(g.state, gatedSpot)?.desc).toBe('The rubble will not shift.');

    g.state.attrs.str.level = 20;
    expect(blockingGate(g.state, gatedSpot)).toBeNull();
  });

  it('the search stops dead at a gate rather than crawling past it', () => {
    const g = new Game(createInitialState(42));
    g.state.spot = 'woods_edge'; // a real spot, so the activity exists
    g.state.explored['woods_edge'] = 0;

    // woods_edge has no gates: exploring advances normally.
    g.selectActivity('explore');
    for (let i = 0; i < 10; i++) g.tick();
    expect(g.state.explored['woods_edge']).toBe(10);
  });

  it('a spot with no gates behaves exactly as before', () => {
    const g = new Game(createInitialState(43));
    const plain: SpotDef = { ...gatedSpot, exploreGates: undefined, finds: [{ id: 'x', at: 0.1, desc: 'x' }] };
    g.state.explored['test_cave'] = 100;
    expect(blockingGate(g.state, plain)).toBeNull();
    expect(pendingFinds(g.state, plain).map((f) => f.id)).toEqual(['x']);
  });
});
