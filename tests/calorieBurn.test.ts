// The hunting tests stand on the shelved countryside; the fixture mounts it.
import './fixtures/shelved-world';
import { afterEach, describe, expect, it } from 'vitest';
import { bindFacets, chooseFacetOption, debugSetCell, grantFacet, installFacet } from '../src/core/facet/host';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { CALORIES_PER_WELL_FED, CALORIES_PLAIN_DISH, dishCalories, useConsumable } from '../src/core/systems/consumables';
import { grantGraded } from '../src/core/systems/disciplines';
import { effectiveAttr } from '../src/core/systems/attributes';
import { getDerivedStats } from '../src/core/systems/derived';
import { qualityMult } from '../src/core/data/quality.data';
import type { GameState } from '../src/core/types';

/**
 * Calorie Burn (Facet repo core/facet.bank.js, docs/FACET.md): dishes give
 * calories from their Well Fed, a full store costs up to 10% of every
 * attribute, a fight burns the store for a bonus, a long fight burns max HP
 * and can end as a death, and a 0% cutoff can run dry into a knockout.
 */

afterEach(() => globalThis.Facet.uninstall());

function holding(): { state: GameState; game: Game } {
  const state = createInitialState(7);
  for (const a of ['str', 'dex', 'con', 'int', 'wis'] as const) state.attrs[a].level = 25;
  state.resources.hp = getDerivedStats(state).maxHp;
  installFacet();
  bindFacets(state, true);
  expect(grantFacet(state, 'calorie_burn')).toBe(true);
  const game = new Game(state);
  state.spot = 'woods_edge';
  return { state, game };
}

const cell = (state: GameState, key: string) => state.facets[0].cells!.find((c) => c.key === key)!.state!.v;

function intoFight(state: GameState, game: Game): void {
  game.selectActivity('hunt');
  for (let t = 0; t < 2_000 && !state.combat?.enemies.some((e) => e && e.hp > 0); t++) game.step();
  expect(state.combat).toBeTruthy();
}

describe('Calorie Burn', () => {
  it('a dish gives 400 calories per point of Well Fed, 100 without it, times its grade', () => {
    expect(dishCalories('hearty_stew', 'c')).toBe(CALORIES_PER_WELL_FED * qualityMult('c'));
    expect(dishCalories('skewered_fish', 'c')).toBe(CALORIES_PLAIN_DISH * qualityMult('c'));
    expect(dishCalories('hearty_stew', 'f')).toBe(0);
  });

  it('eating fills the store', () => {
    const { state, game } = holding();
    grantGraded(state, 'hearty_stew', 'c', 1);
    useConsumable(state, game.bus, 'hearty_stew', 'c');
    expect(cell(state, 'kcal')).toBeCloseTo(dishCalories('hearty_stew', 'c'));
  });

  it('a full store takes 10% off every attribute', () => {
    const { state } = holding();
    const before = effectiveAttr(state, 'str');
    debugSetCell(state, 'kcal', 1);
    globalThis.Facet.minute('player');
    // The minute digests half a calorie first, so the store is a hair under full.
    expect(cell(state, 'sated')).toBeCloseTo(10, 1);
    expect(effectiveAttr(state, 'str')).toBeCloseTo(before * (1 - cell(state, 'sated') / 100));
  });

  it('max HP burned to 90% ends the fight as a death that is a setback', () => {
    const { state, game } = holding();
    intoFight(state, game);
    for (const e of state.combat!.enemies) if (e) e.hp = 1e9;
    debugSetCell(state, 'debt', 1e-5);
    for (let t = 0; t < 20 && state.combat; t++) game.step();
    expect(state.combat).toBeNull();
    expect(state.lastFight?.outcome).toBe('dead');
    expect(state.lastFight?.cause).toMatch(/max HP burned away/);
    expect(state.recovering).toBe(true);
  });

  it('at a 0% cutoff, running dry mid-burn knocks you out', () => {
    const { state, game } = holding();
    expect(chooseFacetOption(state, 2)).toBe(true);
    debugSetCell(state, 'kcal', 0.01);
    intoFight(state, game);
    for (const e of state.combat!.enemies) if (e) e.hp = 1e9;
    for (let t = 0; t < 2_000 && state.combat; t++) game.step();
    expect(state.lastFight?.outcome).toBe('knocked_out');
    expect(state.lastFight?.cause).toMatch(/ran dry/);
  });
});
