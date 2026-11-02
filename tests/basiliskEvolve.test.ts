// The hunting tests stand on the shelved countryside; the fixture mounts it.
import './fixtures/shelved-world';
import { afterEach, describe, expect, it } from 'vitest';
import {
  bindFacets,
  debugSetCell,
  grantFacet,
  installFacet,
  pendingEvolution,
} from '../src/core/facet/host';
import { facetCombatTick } from '../src/core/facet/signal';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { deserialize, serialize } from '../src/core/save/save';
import { effectiveAttr } from '../src/core/systems/attributes';
import { isStatue, sweepDead } from '../src/core/systems/combat';
import { getDerivedStats } from '../src/core/systems/derived';
import { damagePlayer } from '../src/core/systems/health';
import { applyStatus, findStatus } from '../src/core/systems/statuses';
import type { GameState, MonsterInstance } from '../src/core/types';

/**
 * Basilisk Hide's evolution (Facet repo core/facet.bank.js, docs/FACET.md).
 * A statue counts when the enemy stood at 85% of your level or attribute
 * total or more; at 100 play holds until one of three branches is picked:
 * Gorgon's Gaze (Stone each second on the front enemy), Rubble (rocks add
 * Stone, an unbroken statue bursts, no Stone Chunks) or Stoneskin (statues
 * stay out of the centre, armour per statue, no rocks).
 */

afterEach(() => globalThis.Facet.uninstall());

/** A level-1 character strong enough for the woods' edge, holding `ability`. */
function holding(ability: string): { state: GameState; game: Game } {
  const state = createInitialState(7);
  for (const a of ['str', 'dex', 'con', 'int', 'wis'] as const) state.attrs[a].level = 25;
  state.resources.hp = getDerivedStats(state).maxHp;
  installFacet();
  bindFacets(state, true);
  expect(grantFacet(state, ability)).toBe(true);
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
const cell = (state: GameState, key: string) => state.facets[0].cells!.find((c) => c.key === key)!.state!.v;

/** An enemy like `like`, fresh: no conditions, plenty of HP, CON 1. */
function another(like: MonsterInstance, over: Partial<MonsterInstance> = {}): MonsterInstance {
  return { ...like, statuses: [], hp: 1e9, attrs: { ...like.attrs, con: 1 }, ...over } as MonsterInstance;
}

/** Blows from `e` until it turns to stone. */
function petrify(state: GameState, e: MonsterInstance): void {
  for (let i = 0; i < 200 && !isStatue(e); i++) blow(state, e);
  expect(isStatue(e)).toBe(true);
}

describe('Basilisk Hide evolves', () => {
  it('a statue counts when the enemy stood at 85% of your level or attribute total', () => {
    const { state, game } = holding('basilisk_hide');
    const front = intoFight(state, game);
    const rival = another(front, { level: state.level });
    const weak = another(front, { level: 0, attrs: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 } });
    state.combat!.enemies = [rival, weak, null, null, null];
    petrify(state, rival);
    expect(cell(state, 'statues')).toBe(1);
    petrify(state, weak);
    expect(cell(state, 'statues')).toBe(1);
  });

  it('at 100 play holds on the pick, the offer survives a save, and the branch keeps the count', () => {
    const { state, game } = holding('basilisk_hide');
    const front = intoFight(state, game);
    const rival = another(front, { level: state.level });
    state.combat!.enemies = [rival, null, null, null, null];
    debugSetCell(state, 'statues', 0.99);
    expect(pendingEvolution(state)).toBeNull();
    petrify(state, rival);
    const offer = pendingEvolution(state)!;
    expect(offer.choices.map((c) => c.name)).toEqual(["Gorgon's Gaze", 'Rubble', 'Stoneskin']);
    expect(offer.choices.every((c) => c.desc.length > 0)).toBe(true);

    // Held: the clock does not move, and the time is banked.
    const ticks = state.totalTicks;
    const banked = state.bonusTime.banked;
    game.tick();
    expect(state.totalTicks).toBe(ticks);
    expect(state.bonusTime.banked).toBeGreaterThan(banked);

    // The offer is on the saved document.
    expect(pendingEvolution(deserialize(serialize(state)))).not.toBeNull();

    expect(game.chooseEvolution('bramble')).toBe(false);
    expect(game.chooseEvolution('basilisk_stoneskin')).toBe(true);
    expect(state.facets).toHaveLength(1);
    expect(state.facets[0].reading?.name).toBe('Stoneskin');
    expect(cell(state, 'statues')).toBe(100);
    expect(pendingEvolution(state)).toBeNull();
    game.tick();
    expect(state.totalTicks).toBe(ticks + 1);
  });
});

describe("Gorgon's Gaze", () => {
  it('stones the front enemy each second, blows add half, and a statue moves the gaze on', () => {
    const { state, game } = holding('basilisk_gorgon');
    const front = intoFight(state, game);
    const first = another(front);
    const second = another(front);
    state.combat!.enemies = [first, second, null, null, null];
    // One second of the ability's clock: 2 + CON / 50, resisted.
    const con = effectiveAttr(state, 'con');
    for (let t = 0; t < 10; t++) facetCombatTick(state);
    const second1 = stoneOn(first);
    expect(second1).toBeGreaterThan(0);
    expect(stoneOn(second)).toBe(0);
    const resisted = second1 / (2 + con / 50);
    // A blow adds half of 6 + CON / 10, through the same resistance.
    blow(state, first);
    expect(stoneOn(first) - second1).toBeCloseTo(resisted * 0.5 * (6 + con / 10), 6);
    // Turned to stone, the next enemy takes 25, and the gaze is on it now.
    petrify(state, first);
    expect(stoneOn(second)).toBeCloseTo(resisted * 25, 6);
    const before = stoneOn(second);
    for (let t = 0; t < 10; t++) facetCombatTick(state);
    expect(stoneOn(second)).toBeCloseTo(before + second1, 6);
  });
});

describe('Rubble', () => {
  it('rocks put Stone on what they hit, and a statue pays no Stone Chunks', () => {
    const { state, game } = holding('basilisk_rubble');
    const front = intoFight(state, game);
    const behind = another(front);
    state.combat!.enemies = [front, behind, null, null, null];
    front.gold = 100;
    applyStatus(state, front, { id: 'petrified_rubble' });
    const gold = state.gold;
    front.hp = 0;
    sweepDead(state, game.bus);
    expect(behind.hp).toBeLessThan(1e9);
    expect(stoneOn(behind)).toBeGreaterThan(0);
    expect(state.gold).toBe(gold);
    expect(state.combatFeed.some((f) => f.text.includes('statue breaks'))).toBe(true);
  });

  it('a statue left alone bursts when it would crumble', () => {
    const { state, game } = holding('basilisk_rubble');
    const front = intoFight(state, game);
    const behind = another(front);
    state.combat!.enemies = [front, behind, null, null, null];
    applyStatus(state, front, { id: 'petrified_rubble' });
    for (let t = 0; t < 40 && state.combat?.enemies.includes(front); t++) {
      state.combat.playerBar = 0;
      state.resources.hp = getDerivedStats(state).maxHp;
      game.step();
    }
    expect(state.combat?.enemies.includes(front)).toBe(false);
    expect(state.combatFeed.some((f) => f.text.includes('statue bursts'))).toBe(true);
    expect(behind.hp).toBeLessThan(1e9);
  });
});

describe('Stoneskin', () => {
  it('a statue steps out of the centre, raises your armour, and crumbles when the fight is won', () => {
    const { state, game } = holding('basilisk_stoneskin');
    const front = intoFight(state, game);
    const behind = another(front);
    state.combat!.enemies = [front, behind, null, null, null];
    front.gold = 100;
    applyStatus(state, front, { id: 'petrified_standing' });
    state.combat!.playerBar = 0;
    game.step();
    expect(state.combat!.enemies[0]).toBe(behind);
    expect(state.combat!.enemies).toContain(front);
    expect(cell(state, 'standing')).toBe(1);

    // The last enemy still fighting falls: the fight is won and the statue pays its Chunks.
    const gold = state.gold;
    let won = false;
    let kills = 0;
    game.bus.on('fight:won', () => (won = true));
    game.bus.on('kill', () => kills++);
    behind.gold = 0;
    behind.hp = 0;
    sweepDead(state, game.bus);
    expect(won).toBe(true);
    expect(kills).toBe(2);
    // Read after: the first kill's XP can level you up, and CHA moves gold gain.
    expect(state.gold - gold).toBe(Math.round(100 * getDerivedStats(state).goldGain * 0.5));
    expect(state.combat).toBeNull();
  });

  it('a standing statue that falls throws no rocks', () => {
    const { state, game } = holding('basilisk_stoneskin');
    const front = intoFight(state, game);
    const statue = another(front);
    const behind = another(front);
    state.combat!.enemies = [front, statue, behind, null, null];
    applyStatus(state, statue, { id: 'petrified_standing' });
    statue.hp = 0;
    sweepDead(state, game.bus);
    expect(behind.hp).toBe(1e9);
    expect(state.combatFeed.some((f) => f.text.includes('rocks hit'))).toBe(false);
  });

  it('when the last enemy fighting turns to stone, the fight is won', () => {
    const { state, game } = holding('basilisk_stoneskin');
    const front = intoFight(state, game);
    state.combat!.enemies = [front, null, null, null, null];
    let won = false;
    game.bus.on('fight:won', () => (won = true));
    applyStatus(state, front, { id: 'petrified_standing' });
    state.combat!.playerBar = 0;
    game.step();
    expect(won).toBe(true);
    expect(state.combat).toBeNull();
  });
});
