import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { deserialize, serialize } from '../src/core/save/save';
import { runOfflineProgress, OFFLINE_CAP_MS } from '../src/core/save/offline';
import { TPS } from '../src/core/engine/loop';

function huntingGame(seed = 7, spot = 'woods_edge') {
  const game = new Game(createInitialState(seed));
  game.state.spot = spot;
  game.equip(1); // rusty sword
  game.selectActivity('hunt');
  return game;
}

describe('global pause', () => {
  it('freezes the whole world, not just the fight', () => {
    const g = huntingGame();
    for (let i = 0; i < 300; i++) g.tick();

    g.setPaused(true);
    const before = JSON.stringify({
      ticks: g.state.totalTicks,
      gold: g.state.gold,
      hp: g.state.resources.hp,
      combat: g.state.combat,
      respawn: g.state.respawnTimer,
      progress: g.state.activityProgress,
      stats: g.state.stats,
    });

    for (let i = 0; i < 5000; i++) g.tick();

    expect(
      JSON.stringify({
        ticks: g.state.totalTicks,
        gold: g.state.gold,
        hp: g.state.resources.hp,
        combat: g.state.combat,
        respawn: g.state.respawnTimer,
        progress: g.state.activityProgress,
        stats: g.state.stats,
      }),
    ).toBe(before);
  });

  it('freezes non-combat work too — a gathering run banks nothing while paused', () => {
    const g = new Game(createInitialState(3));
    g.state.spot = 'forest_edge_w';
    g.selectActivity('gather_herbs');
    expect(g.state.activity).toBe('gather_herbs');

    const haul = () =>
      JSON.stringify([g.state.materials, g.state.stock, g.state.stats, g.state.skills]);

    // Prove the run actually yields something when the clock is running...
    for (let i = 0; i < 2000; i++) g.tick();
    const gathered = g.state.stats['gather:common_herb'] ?? 0;
    expect(gathered).toBeGreaterThan(0);

    // ...then that a frozen world adds nothing to it.
    g.setPaused(true);
    const ticks = g.state.totalTicks;
    const progress = g.state.activityProgress;
    const before = haul();
    for (let i = 0; i < 2000; i++) g.tick();
    expect(g.state.totalTicks).toBe(ticks);
    expect(g.state.activityProgress).toBe(progress);
    expect(haul()).toBe(before);
  });

  it('resumes exactly where it left off', () => {
    const g = huntingGame();
    for (let i = 0; i < 200; i++) g.tick();
    g.setPaused(true);
    const at = g.state.totalTicks;
    for (let i = 0; i < 1000; i++) g.tick();
    g.setPaused(false);
    g.tick();
    expect(g.state.totalTicks).toBe(at + 1);
  });

  it('offline catch-up refuses to run against a paused world', () => {
    const g = huntingGame();
    for (let i = 0; i < 100; i++) g.tick();
    g.setPaused(true);
    const ticks = g.state.totalTicks;
    expect(runOfflineProgress(g, OFFLINE_CAP_MS)).toBeNull();
    expect(g.state.totalTicks).toBe(ticks);
  });

  it('is transient — a save never carries a pause into the next session', () => {
    const g = huntingGame();
    for (let i = 0; i < 100; i++) g.tick();
    g.setPaused(true);
    const loaded = deserialize(serialize(g.state));
    expect(loaded.paused).toBe(false);
  });

  it('toggle reports the state it landed in', () => {
    const g = huntingGame();
    expect(g.togglePause()).toBe(true);
    expect(g.state.paused).toBe(true);
    expect(g.togglePause()).toBe(false);
    expect(g.state.paused).toBe(false);
  });
});

describe('stepping', () => {
  it('step advances exactly the requested ticks while paused', () => {
    const g = huntingGame();
    g.setPaused(true);
    const start = g.state.totalTicks; // a new life opens at 08:00, not tick 0
    g.step();
    expect(g.state.totalTicks).toBe(start + 1);
    g.step(TPS);
    expect(g.state.totalTicks).toBe(start + 1 + TPS);
    expect(g.state.paused).toBe(true); // stepping never unfreezes the world
  });

  it('a stepped tick does the same work a live tick would', () => {
    const live = huntingGame(11);
    const stepped = huntingGame(11);
    stepped.setPaused(true);
    for (let i = 0; i < 400; i++) {
      live.tick();
      stepped.step();
    }
    expect(stepped.state.totalTicks).toBe(live.state.totalTicks);
    expect(stepped.state.gold).toBe(live.state.gold);
    expect(stepped.state.stats['kills'] ?? 0).toBe(live.state.stats['kills'] ?? 0);
    expect(stepped.state.combatFeed.map((f) => f.text)).toEqual(
      live.state.combatFeed.map((f) => f.text),
    );
  });

  it('stepToEvent stops on the fight’s next line', () => {
    const g = huntingGame();
    g.setPaused(true);
    // Get into a fight first, so there is a feed to advance.
    for (let i = 0; i < 100 && !g.state.combat; i++) g.step();
    expect(g.state.combat).not.toBeNull();

    const last = g.state.combatFeed[g.state.combatFeed.length - 1];
    const took = g.stepToEvent();
    expect(took).toBeGreaterThan(0);
    expect(g.state.combatFeed[g.state.combatFeed.length - 1]).not.toBe(last);
  });

  it('stepToEvent gives up on a lull instead of running away', () => {
    const g = new Game(createInitialState(5));
    g.selectActivity(null); // nothing to fight, nothing to report
    g.setPaused(true);
    const start = g.state.totalTicks;
    const max = 10 * TPS;
    expect(g.stepToEvent()).toBe(max);
    expect(g.state.totalTicks).toBe(start + max);
  });
});
