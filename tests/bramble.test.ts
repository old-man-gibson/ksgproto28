// The hunting tests stand on the shelved countryside; the fixture mounts it.
import './fixtures/shelved-world';
import { afterEach, describe, expect, it } from 'vitest';
import { bindFacets, grantFacet, installFacet } from '../src/core/facet/host';
import { facetCombatTick } from '../src/core/facet/signal';
import { composeArcane } from '../src/core/systems/arcane';
import { castCraftedSelf } from '../src/core/systems/combat';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { getDerivedStats } from '../src/core/systems/derived';
import { damagePlayer } from '../src/core/systems/health';
import type { GameState, MonsterInstance } from '../src/core/types';

/**
 * Bramble (Facet repo core/facet.bank.js), the first bank ability that answers
 * the enemy who hit you: each enemy blow raises a thorn level (cap 10, +1 per
 * 200 fights), so does each second of fight time (1 + 5% of the cap) and each
 * Poison spell you cast on yourself (2 + 10% of the cap). Each level returns 2%
 * of the blow as thrown to its attacker as Piercing and slows the action bar
 * by 0.5%, a Heat blow burns 5 levels, and thorns clear when the fight ends.
 *
 * The core's cases check the rules against a fake host. These check this
 * game's side: hitTaken naming the attacker, the answer reaching it, the slow
 * reaching the stat block, and an attacker the thorns kill being swept.
 */

afterEach(() => globalThis.Facet.uninstall());

const thorns = (state: GameState) => state.facets[0].cells!.find((c) => c.key === 'thorns')!.state!.v;

/** A level-1 character strong enough for the woods' edge, with Bramble granted. */
function bramble(): { state: GameState; game: Game } {
  const state = createInitialState(7);
  for (const a of ['str', 'dex', 'con', 'int', 'wis'] as const) state.attrs[a].level = 25;
  state.resources.hp = getDerivedStats(state).maxHp;
  installFacet();
  bindFacets(state, true);
  expect(grantFacet(state, 'bramble')).toBe(true);
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

/** A blow from `by`, through the one door every blow takes. `thrown` is the blow before armour. */
const blow = (
  state: GameState,
  by: MonsterInstance | undefined,
  amount: number,
  type: 'slashing' | 'heat' = 'slashing',
  thrown?: number,
) => damagePlayer(state, amount, type, by ? { key: `monster:${by.defId}`, label: by.name, icon: by.icon, by, thrown } : undefined);

describe('Bramble in this game', () => {
  it('a blow grows a thorn and the thorns answer its attacker as Piercing', () => {
    const { state, game } = bramble();
    const front = intoFight(state, game);
    front.hp = 1e9;
    const before = front.hp;
    blow(state, front, 100);
    expect(thorns(state)).toBe(1);
    expect(front.hp).toBeLessThan(before);
    expect(front.lastHit).toBe('piercing');
    const run = state.floatingFeed?.find((f) => f.group === 'ability:Bramble');
    expect(run?.tally.find((x) => x.label === 'thorns')?.qty).toBe(1);
  });

  it('the answer is sized to the blow as thrown, not what got past your armour', () => {
    const { state, game } = bramble();
    const front = intoFight(state, game);
    front.hp = 1e9;
    const before = front.hp;
    // Armour took 90 of a 100 blow; one thorn returns 2% of the 100.
    blow(state, front, 10, 'slashing', 100);
    expect(before - front.hp).toBe(2);
  });

  it('each second of fight time adds a thorn at cap 10', () => {
    const { state, game } = bramble();
    intoFight(state, game);
    for (let t = 0; t < 9; t++) facetCombatTick(state);
    expect(thorns(state)).toBe(0);
    facetCombatTick(state);
    expect(thorns(state)).toBe(1);
  });

  it('a Poison spell cast on yourself adds 2 + 10% of the cap, and is credited to the spell', () => {
    const { state, game } = bramble();
    intoFight(state, game);
    const spec = composeArcane(['venom', 'cut', 'me'])!;
    expect(spec.target).toBe('self');
    expect(spec.strikes[0].type).toBe('poison');
    state.resources.mana = 1e6;
    castCraftedSelf(state, game.bus, 'venom_me', spec, getDerivedStats(state));
    expect(thorns(state)).toBe(3);
    expect(state.fight?.incoming.find((x) => x.key === 'spell:venom_me')?.amount).toBeGreaterThan(0);
  });

  it('a hit with no attacker neither grows nor answers', () => {
    const { state, game } = bramble();
    const front = intoFight(state, game);
    const before = front.hp;
    blow(state, undefined, 100);
    expect(thorns(state)).toBe(0);
    expect(front.hp).toBe(before);
  });

  it('each level slows the action bar by 0.5%, and Heat burns 5 levels', () => {
    const { state, game } = bramble();
    const front = intoFight(state, game);
    front.hp = 1e9;
    const speed = getDerivedStats(state).speed;
    for (let i = 0; i < 8; i++) blow(state, front, 10);
    expect(thorns(state)).toBe(8);
    expect(getDerivedStats(state).speed).toBeCloseTo(speed * (1 - 8 * 0.005), 6);
    blow(state, front, 10, 'heat');
    expect(thorns(state)).toBe(3);
    expect(getDerivedStats(state).speed).toBeCloseTo(speed * (1 - 3 * 0.005), 6);
  });

  it('an attacker the thorns kill is swept during the enemy phase: the kill and the win follow', () => {
    const { state, game } = bramble();
    intoFight(state, game);
    // One enemy at 1 HP, and a player who never acts, so only the thorns can kill it.
    const foe = state.combat!.enemies[0]!;
    state.combat!.enemies = [foe];
    foe.hp = 1;
    state.resources.hp = 1e6;
    let kills = 0;
    let won = false;
    game.bus.on('kill', () => kills++);
    game.bus.on('fight:won', () => (won = true));
    for (let t = 0; t < 400 && foe.hp > 0; t++) {
      if (state.combat) state.combat.playerBar = 0;
      game.step();
    }
    // The step whose blow the thorns answered also swept the dead attacker; the
    // ability tick's own sweep would come a tick later.
    expect(foe.hp).toBeLessThanOrEqual(0);
    expect(kills).toBe(1);
    expect(won).toBe(true);
    expect(state.floatingFeed?.some((f) => f.group === 'ability:Bramble')).toBe(true);
  });

  it('thorns clear when the fight ends, and the fight is counted', () => {
    const { state, game } = bramble();
    const front = intoFight(state, game);
    front.hp = 1e9;
    for (let i = 0; i < 3; i++) blow(state, front, 10);
    expect(thorns(state)).toBe(3);
    for (const e of state.combat!.enemies) if (e) e.hp = 0;
    game.step();
    expect(thorns(state)).toBe(0);
    expect(state.facets[0].cells!.find((c) => c.key === 'fights')!.state!.v).toBe(1);
  });
});
