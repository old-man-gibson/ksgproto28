// The hunting tests stand on the shelved countryside; the fixture mounts it.
import './fixtures/shelved-world';
import { afterEach, describe, expect, it } from 'vitest';
import { bindFacets, grantFacet, installFacet } from '../src/core/facet/host';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { getDerivedStats } from '../src/core/systems/derived';
import type { GameState, MonsterInstance } from '../src/core/types';

/**
 * Little Moons (Facet repo core/facet.bank.js), the first bank ability that
 * acts on enemies: three moons strike the front enemy every 2.8 s, 3.7 s and
 * 7.9 s for 30% of weapon damage (+5% per boss kill this run), strikes within
 * 0.3 s combine (x2 of the sum for two, x5 for three), and the moons cost 2
 * mana per second, going dark for 10 s when the pool cannot pay.
 *
 * The core's own cases check the strike timing against a fake host. These
 * check this game's side: enemy refs, damage through combat's path, the mana
 * cost, the kill sweep, and the boss flag on the kill event.
 */

afterEach(() => globalThis.Facet.uninstall());

type Host = {
  resolve(from: string, scope: object): string[];
  applyDamage(ref: string, amount: number, type: string, source?: string): number;
  spendPool(ref: string, pool: string, amount: number): number;
};
const host = () => globalThis.Facet.host() as unknown as Host;

const cell = (state: GameState, key: string) => state.facets[0].cells!.find((c) => c.key === key)!.state!.v;

/** A level-1 character strong enough for the woods' edge, with mana to run the moons and Little Moons granted. */
function moons(): { state: GameState; game: Game } {
  const state = createInitialState(7);
  for (const a of ['str', 'dex', 'con', 'int', 'wis'] as const) state.attrs[a].level = 25;
  const stats = getDerivedStats(state);
  state.resources.hp = stats.maxHp;
  state.resources.mana = stats.maxMana;
  installFacet();
  bindFacets(state, true);
  expect(grantFacet(state, 'little_moons')).toBe(true);
  const game = new Game(state);
  state.spot = 'woods_edge';
  return { state, game };
}

/** Steps until a fight is on, and returns its enemies. */
function intoFight(state: GameState, game: Game): MonsterInstance[] {
  game.selectActivity('hunt');
  for (let t = 0; t < 2_000 && !state.combat?.enemies.some((e) => e && e.hp > 0); t++) game.step();
  expect(state.combat).toBeTruthy();
  return state.combat!.enemies.filter((e): e is MonsterInstance => !!e);
}

describe('enemies in the adapter', () => {
  it('resolves the enemy side front first, and n: 1 is the front enemy', () => {
    const { state, game } = moons();
    intoFight(state, game);
    const foes = host().resolve('player', { side: 'enemy' });
    expect(foes[0]).toBe('foe:0');
    expect(foes.length).toBe(state.combat!.enemies.filter((e) => e && e.hp > 0).length);
    expect(host().resolve('player', { side: 'enemy', rank: 'front', n: 1 })).toEqual(['foe:0']);
    expect(host().resolve('player', { side: 'self' })).toEqual(['player']);
  });

  it('deals damage to an enemy through resistance, and not to the player', () => {
    const { state, game } = moons();
    const [front] = intoFight(state, game);
    const before = front.hp;
    const hpBefore = state.resources.hp;
    const dealt = host().applyDamage('foe:0', 5, 'light', state.facets[0].id);
    expect(dealt).toBeGreaterThan(0);
    expect(front.hp).toBe(before - dealt);
    expect(host().applyDamage('player', 5, 'light', state.facets[0].id)).toBe(0);
    expect(state.resources.hp).toBe(hpBefore);
  });

  it('spends a pool up to what is held, and never HP', () => {
    const { state } = moons();
    state.resources.mana = 3;
    expect(host().spendPool('player', 'mana', 2)).toBe(2);
    expect(host().spendPool('player', 'mana', 2)).toBe(1);
    expect(state.resources.mana).toBe(0);
    const hp = state.resources.hp;
    expect(host().spendPool('player', 'hp', 5)).toBe(0);
    expect(state.resources.hp).toBe(hp);
  });
});

describe('Little Moons in the game loop', () => {
  it('strikes during a hunt and drains mana while the fight lasts', () => {
    const { state, game } = moons();
    intoFight(state, game);
    const front = state.combat!.enemies[0]!;
    front.hp = 1e9; // a fight long enough to count strikes
    const mana = state.resources.mana;
    for (let t = 0; t < 80; t++) game.step();
    const run = state.floatingFeed?.find((f) => f.group === 'ability:Little Moons');
    // Due at 2.8, 3.7, 5.6 and 7.4 s, each striking 0.3 s later; the 7.9 s moon strikes at
    // 8.2 s, after the window. Four strikes in 8 s.
    expect(run?.tally.find((x) => x.label === 'strikes')?.qty).toBe(4);
    expect(state.resources.mana).toBeLessThan(mana);
  });

  it('a strike that kills is swept by combat: the kill and the win follow', () => {
    const { state, game } = moons();
    intoFight(state, game);
    for (const e of state.combat!.enemies) if (e) e.hp = 1;
    let kills = 0;
    let won = false;
    game.bus.on('kill', () => kills++);
    game.bus.on('fight:won', () => (won = true));
    const alive = state.combat!.enemies.filter((e) => e && e.hp > 0).length;
    for (const ref of host().resolve('player', { side: 'enemy' })) host().applyDamage(ref, 1e6, 'light', state.facets[0].id);
    game.step();
    expect(kills).toBe(alive);
    expect(won).toBe(true);
  });

  it('counts a boss kill, and only a boss kill', () => {
    const { state, game } = moons();
    state.spot = 'f7_chiefs_tent';
    const kill = (defId: string) =>
      game.bus.emit({ type: 'kill', monster: { defId, level: 30 } as MonsterInstance, xp: 0 });
    kill('ph_bandit_chief');
    kill('woods_rat');
    expect(cell(state, 'bosses')).toBe(1);
  });

  it('carries no status for its counters, so the stat cache does not move each tick', () => {
    const { state, game } = moons();
    intoFight(state, game);
    for (let t = 0; t < 30; t++) game.step();
    expect(state.statuses.filter((s) => s.id.startsWith('fc_'))).toEqual([]);
  });
});
