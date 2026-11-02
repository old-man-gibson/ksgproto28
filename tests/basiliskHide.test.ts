// The hunting tests stand on the shelved countryside; the fixture mounts it.
import './fixtures/shelved-world';
import { afterEach, describe, expect, it } from 'vitest';
import { bindFacets, grantFacet, installFacet } from '../src/core/facet/host';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { effectiveAttr } from '../src/core/systems/attributes';
import { isStatue, sweepDead } from '../src/core/systems/combat';
import { getDerivedStats } from '../src/core/systems/derived';
import { damagePlayer } from '../src/core/systems/health';
import { monsterStats } from '../src/core/systems/monsterStats';
import { applyStatus, findStatus } from '../src/core/systems/statuses';
import type { GameState, MonsterInstance } from '../src/core/types';

/**
 * Basilisk Hide (Facet repo core/facet.bank.js): each enemy blow puts Stone on
 * its attacker, 6 + CON / 10 a hit (1.5 on a boss), resisted by Earth and by
 * the attacker's CON against yours; Stone slows it 1% a point and at 100 it
 * becomes a statue (statuses.data.ts `petrified`). A statue does nothing; left
 * alone 3 seconds it crumbles, broken first it throws rocks at the enemies
 * behind it; either way it pays Stone Chunks worth half its gold and half its
 * XP, and drops nothing else.
 */

afterEach(() => globalThis.Facet.uninstall());

/** A level-1 character strong enough for the woods' edge, with Basilisk Hide granted. */
function basilisk(): { state: GameState; game: Game } {
  const state = createInitialState(7);
  for (const a of ['str', 'dex', 'con', 'int', 'wis'] as const) state.attrs[a].level = 25;
  state.resources.hp = getDerivedStats(state).maxHp;
  installFacet();
  bindFacets(state, true);
  expect(grantFacet(state, 'basilisk_hide')).toBe(true);
  const game = new Game(state);
  state.spot = 'woods_edge';
  return { state, game };
}

/** Steps until a fight is on, and returns its front enemy. */
function intoFight(state: GameState, game: Game): MonsterInstance {
  game.selectActivity('hunt');
  for (let t = 0; t < 2_000 && !state.combat?.enemies.some((e) => e && e.hp > 0); t++) game.step();
  expect(state.combat).toBeTruthy();
  return state.combat!.enemies[0]!;
}

const blow = (state: GameState, by: MonsterInstance, amount = 5) =>
  damagePlayer(state, amount, 'slashing', { key: `monster:${by.defId}`, label: by.name, icon: by.icon, by, thrown: amount });

const stoneOn = (e: MonsterInstance) => findStatus(e, 'basilisk_stone')?.intensity ?? 0;

describe('Basilisk Hide in this game', () => {
  it('a blow puts Stone on its attacker, and an attacker with more CON resists it', () => {
    const { state, game } = basilisk();
    const front = intoFight(state, game);
    front.hp = 1e9;
    const con = effectiveAttr(state, 'con');
    front.attrs.con = 1;
    blow(state, front);
    const full = stoneOn(front);
    expect(full).toBeGreaterThan(0);
    expect(full).toBeLessThanOrEqual(6 + con / 10 + 1e-9);
    // Twice your CON: half the dose.
    front.statuses = front.statuses.filter((s) => s.id !== 'basilisk_stone');
    front.attrs.con = con * 2;
    blow(state, front);
    expect(stoneOn(front)).toBeCloseTo(full / 2, 6);
  });

  it('Stone slows the attacker 1% a point', () => {
    const { state, game } = basilisk();
    const front = intoFight(state, game);
    front.hp = 1e9;
    front.attrs.con = 1;
    const speed = monsterStats(front).speed;
    blow(state, front);
    expect(monsterStats(front).speed).toBeCloseTo(speed * (1 - 0.01 * stoneOn(front)), 6);
  });

  it('at 100 Stone the attacker becomes a statue that does nothing', () => {
    const { state, game } = basilisk();
    const front = intoFight(state, game);
    front.hp = 1e9;
    front.attrs.con = 1;
    for (let i = 0; i < 100 && !isStatue(front); i++) blow(state, front);
    expect(isStatue(front)).toBe(true);
    expect(stoneOn(front)).toBe(0);
    const bar = front.bar;
    state.combat!.enemies = [front];
    for (let t = 0; t < 10; t++) {
      state.combat!.playerBar = 0;
      game.step();
    }
    expect(front.bar).toBe(bar);
  });

  it('a statue left alone crumbles after 3 seconds: half its gold, no drops, and the fight is won', () => {
    const { state, game } = basilisk();
    const front = intoFight(state, game);
    state.combat!.enemies = [front];
    front.gold = 100;
    applyStatus(state, front, { id: 'petrified' });
    const gold = state.gold;
    // Read before the payout: the statue's XP can level you up, and CHA moves gold gain.
    const gain = getDerivedStats(state).goldGain;
    const items = state.inventory.length;
    let won = false;
    let kills = 0;
    game.bus.on('fight:won', () => (won = true));
    game.bus.on('kill', () => kills++);
    for (let t = 0; t < 40 && state.combat; t++) {
      state.combat.playerBar = 0;
      game.step();
    }
    expect(won).toBe(true);
    expect(kills).toBe(1);
    expect(state.gold - gold).toBe(Math.round(100 * gain * 0.5));
    expect(state.inventory.length).toBe(items);
  });

  it('a statue broken before it crumbles throws rocks at the enemies behind it', () => {
    const { state, game } = basilisk();
    const front = intoFight(state, game);
    const behind = { ...front, statuses: [], hp: 1e6 } as MonsterInstance;
    state.combat!.enemies = [front, behind, null, null, null];
    applyStatus(state, front, { id: 'petrified' });
    front.hp = 0;
    sweepDead(state, game.bus);
    expect(behind.hp).toBeLessThan(1e6);
    expect(state.combat!.enemies[0]).toBe(behind);
    expect(state.combatFeed.some((f) => f.text.includes('statue breaks'))).toBe(true);
  });

  it('rocks that kill the last enemy behind the statue end the fight', () => {
    const { state, game } = basilisk();
    const front = intoFight(state, game);
    const behind = { ...front, statuses: [], hp: 1 } as MonsterInstance;
    state.combat!.enemies = [front, behind, null, null, null];
    applyStatus(state, front, { id: 'petrified' });
    let won = false;
    let kills = 0;
    game.bus.on('fight:won', () => (won = true));
    game.bus.on('kill', () => kills++);
    front.hp = 0;
    sweepDead(state, game.bus);
    expect(kills).toBe(2);
    expect(won).toBe(true);
    expect(state.combat).toBeNull();
  });
});
