import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { STATUSES } from '../src/core/registry';
import { getDerivedStats } from '../src/core/systems/derived';
import { hpFraction } from '../src/core/systems/health';
import { applyStatus } from '../src/core/systems/statuses';
import { restingForFight } from '../src/core/systems/huntrest';
import { deserialize, serialize } from '../src/core/save/save';
import type { StatusDef } from '../src/core/types';

/** Hunting the Cages between fights, at `hp` share of max. */
function hunting(hp: number, seed = 3) {
  const g = new Game(createInitialState(seed));
  g.state.spot = 'the_cages';
  g.selectActivity('hunt');
  g.state.resources.hp = getDerivedStats(g.state).maxHp * hp;
  g.state.respawnTimer = 0;
  return g;
}
const share = (g: Game) => hpFraction(g.state, getDerivedStats(g.state));

describe('rest before the next fight', () => {
  afterEach(() => {
    delete (STATUSES as Record<string, StatusDef>).test_no_mending;
  });

  it('is off by default: a hunt at 20% HP rolls its next fight at once', () => {
    const g = hunting(0.2);
    g.tick();
    expect(g.state.combat).not.toBeNull();
  });

  it('below the threshold the hunt rests first, at the rest rate, then fights at full', () => {
    const g = hunting(0.2);
    g.setHuntRest(0.5, true);
    g.tick();
    expect(g.state.combat).toBeNull();
    expect(restingForFight(g.state)).toBe(true);
    // Resting heals at the rest multiplier (15x a hunt's lull).
    const stats = getDerivedStats(g.state);
    const before = g.state.resources.hp;
    g.tick();
    expect(g.state.resources.hp - before).toBeGreaterThan((stats.hpRegen / 10) * 10);
    for (let i = 0; i < 20000 && !g.state.combat; i++) g.tick();
    expect(g.state.combat).not.toBeNull();
    expect(restingForFight(g.state)).toBe(false);
    expect(share(g)).toBeGreaterThan(0.99);
  });

  it('"until the threshold" stops resting at the threshold', () => {
    const g = hunting(0.2);
    g.setHuntRest(0.5, false);
    for (let i = 0; i < 20000 && !g.state.combat; i++) g.tick();
    expect(g.state.combat).not.toBeNull();
    expect(share(g)).toBeGreaterThanOrEqual(0.5);
    expect(share(g)).toBeLessThan(0.6);
  });

  it('above the threshold nothing waits', () => {
    const g = hunting(0.8);
    g.setHuntRest(0.5, true);
    g.tick();
    expect(g.state.combat).not.toBeNull();
  });

  it('never waits on a pool that cannot recover', () => {
    (STATUSES as Record<string, StatusDef>).test_no_mending = {
      id: 'test_no_mending',
      name: 'No Mending',
      icon: '🚫',
      desc: 'test',
      blocksRegen: ['hp'],
    } as StatusDef;
    const g = hunting(0.2);
    g.setHuntRest(0.5, true);
    applyStatus(g.state, g.state, { id: 'test_no_mending', duration: 1000 }, 'test');
    g.tick();
    expect(g.state.combat).not.toBeNull();
  });

  it('the setting survives a save, and an older save without it loads as off', () => {
    const g = hunting(0.9);
    g.setHuntRest(0.4, false);
    const back = deserialize(serialize(g.state));
    expect(back.huntRest).toMatchObject({ at: 0.4, toFull: false });

    const old = JSON.parse(serialize(g.state));
    delete old.huntRest;
    expect(deserialize(JSON.stringify(old)).huntRest.at).toBe(0);
  });
});
