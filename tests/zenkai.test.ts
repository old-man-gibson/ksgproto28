// The hunting test at the bottom stands on the shelved countryside; the fixture mounts it.
import './fixtures/shelved-world';
import { afterEach, describe, expect, it } from 'vitest';
import { bindFacets, facetSignal, grantFacet, installFacet, PLAYER_REF } from '../src/core/facet/host';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { getDerivedStats } from '../src/core/systems/derived';
import { effectiveAttr } from '../src/core/systems/attributes';
import { damagePlayer } from '../src/core/systems/health';
import { markCombatEvent } from '../src/core/systems/combat';
import type { GameState } from '../src/core/types';

/**
 * Fight events (facet/signal.ts) and Zenkai, the first bank ability that
 * listens to them (Facet repo core/facet.bank.js). Zenkai as the user approved
 * it: after a win where HP fell to 20% or below, all attributes gain
 * 1.5% x (1 − lowest HP share) x min(1.5, enemy level / your level), times
 * 0.97 per Zenkai already gained. A flask, consumable or miracle in the fight
 * cancels it; an enemy under 70% of your level gives nothing.
 */

afterEach(() => globalThis.Facet.uninstall());

/** A level-`level` character at full HP with Zenkai granted. */
function zenkai(level = 10): GameState {
  const state = createInitialState(7);
  state.level = level;
  state.resources.hp = getDerivedStats(state).maxHp;
  installFacet();
  bindFacets(state, true);
  expect(grantFacet(state, 'zenkai')).toBe(true);
  return state;
}

const cell = (state: GameState, key: string) => state.facets[0].cells!.find((c) => c.key === key)!.state!.v;

/** A fight against a level-`foe` enemy in which HP drops to `share` of max, through the game's own damage door. */
function fight(state: GameState, foe: number, share: number) {
  facetSignal(state, 'fightStart', { enemies: 1, maxLevel: foe });
  damagePlayer(state, state.resources.hp - share * getDerivedStats(state).maxHp);
}

describe('Zenkai', () => {
  it('pays after a win from 10% HP: 1.5% x 0.9 to every attribute', () => {
    const state = zenkai();
    const before = effectiveAttr(state, 'str');
    fight(state, 10, 0.1);
    expect(cell(state, 'low')).toBeCloseTo(0.1);
    facetSignal(state, 'fightWon');
    expect(cell(state, 'bonus')).toBeCloseTo(0.015 * 0.9);
    expect(cell(state, 'gains')).toBe(1);
    expect(effectiveAttr(state, 'str')).toBeCloseTo(before * (1 + 0.015 * 0.9));
    expect(effectiveAttr(state, 'wis')).toBeGreaterThan(1);
  });

  it('pays nothing when HP stayed above 20%', () => {
    const state = zenkai();
    fight(state, 10, 0.3);
    facetSignal(state, 'fightWon');
    expect(cell(state, 'bonus')).toBe(0);
  });

  it('pays nothing after a flask, a consumable or a miracle in that fight', () => {
    for (const used of ['flaskUsed', 'itemUsed', 'miracleCast'] as const) {
      const state = zenkai();
      fight(state, 10, 0.1);
      facetSignal(state, used);
      facetSignal(state, 'fightWon');
      expect(cell(state, 'bonus'), used).toBe(0);
    }
  });

  it('forgets a flask from the fight before', () => {
    const state = zenkai();
    facetSignal(state, 'flaskUsed');
    fight(state, 10, 0.1);
    facetSignal(state, 'fightWon');
    expect(cell(state, 'bonus')).toBeGreaterThan(0);
  });

  it('scales by enemy level over yours: nothing under 70%, capped at 1.5', () => {
    const weak = zenkai(10);
    fight(weak, 6, 0.1);
    facetSignal(weak, 'fightWon');
    expect(cell(weak, 'bonus')).toBe(0);

    const even = zenkai(10);
    fight(even, 7, 0.1);
    facetSignal(even, 'fightWon');
    expect(cell(even, 'bonus')).toBeCloseTo(0.015 * 0.9 * 0.7);

    const strong = zenkai(10);
    fight(strong, 30, 0.1);
    facetSignal(strong, 'fightWon');
    expect(cell(strong, 'bonus')).toBeCloseTo(0.015 * 0.9 * 1.5);
  });

  it('gives nothing for a knockout: no fightWon, nothing paid', () => {
    const state = zenkai();
    fight(state, 10, 0.05);
    facetSignal(state, 'fightEnd', { won: 0 });
    expect(cell(state, 'bonus')).toBe(0);
  });

  it('multiplies each next gain by 0.97', () => {
    const state = zenkai();
    const first = 0.015 * 0.9;
    for (let i = 0; i < 2; i++) {
      state.resources.hp = getDerivedStats(state).maxHp;
      fight(state, 10, 0.1);
      facetSignal(state, 'fightWon');
    }
    expect(cell(state, 'gains')).toBe(2);
    expect(cell(state, 'bonus')).toBeCloseTo(first + first * 0.97);
  });
});

describe('fight events reach the ability', () => {
  it('from the bus: a fight:won on the Game bus pays Zenkai', () => {
    const state = zenkai();
    const game = new Game(state);
    fight(state, 10, 0.1);
    game.bus.emit({ type: 'fight:won', spot: state.spot, forced: false });
    expect(cell(state, 'gains')).toBe(1);
  });

  it("from combat's trigger stamps: onHit arrives as hit", () => {
    const state = zenkai();
    state.combat = { events: {} } as unknown as GameState['combat'];
    markCombatEvent(state, 'onHit');
    const rec = (globalThis.Facet as unknown as { recordOf(ref: string): { events: Record<string, number> } }).recordOf(PLAYER_REF);
    expect(rec.events.hit).toBe(state.totalTicks);
    state.combat = null;
  });

  it('in the real game loop: hunting from 15% HP, the first win pays', () => {
    const state = zenkai(1);
    // Strong enough to win from 15% HP at the woods' edge, still level 1.
    for (const a of ['str', 'dex', 'con'] as const) state.attrs[a].level = 25;
    const game = new Game(state);
    state.spot = 'woods_edge';
    state.resources.hp = 0.15 * getDerivedStats(state).maxHp;
    let won = false;
    let lost = false;
    game.bus.on('fight:won', () => (won = true));
    game.bus.on('defeat', () => (lost = true));
    game.selectActivity('hunt');
    for (let t = 0; t < 20_000 && !won && !lost; t++) game.step();
    expect(lost).toBe(false);
    expect(won).toBe(true);
    expect(cell(state, 'gains')).toBe(1);
    expect(cell(state, 'bonus')).toBeGreaterThan(0.015 * 0.8);
  });
});
