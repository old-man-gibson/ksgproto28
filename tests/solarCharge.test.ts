// The hunting tests stand on the shelved countryside; the fixture mounts it.
import './fixtures/shelved-world';
import { afterEach, describe, expect, it } from 'vitest';
import {
  bindFacets,
  debugSetCell,
  facetActions,
  facetReadouts,
  grantFacet,
  installFacet,
  queueFacetAction,
  tickFacets,
} from '../src/core/facet/host';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { getDerivedStats } from '../src/core/systems/derived';
import { effectiveAttr } from '../src/core/systems/attributes';
import type { GameState, MonsterInstance } from '../src/core/types';

/**
 * Solar Charge's tiers (user 2026-11-04, Facet repo core/facet.bank.js): at a
 * charge share of 20% Cold and Poison resistance, at 40% Heat on unarmed
 * blows, at 60% healing that costs charge, at 80% Sun Blast, a rotation entry
 * (`facet:sun_blast`) and a button on the Ability tab. Empty is -15%.
 *
 * The core's own case checks the document against a fake host. These check
 * this game's side: the resistances in the stat block, the Heat slice on a
 * bare-handed blow, the heal through health.ts, the blast through the
 * rotation, its trigger and the pressed button.
 */

afterEach(() => globalThis.Facet.uninstall());

const BLAST = 'facet:sun_blast';
const cell = (state: GameState, key: string) => state.facets[0].cells!.find((c) => c.key === key)!.state!.v;
const capOf = (state: GameState) =>
  globalThis.Facet.evalExpr(state.facets[0].cells!.find((c) => c.key === 'charge')!.cap, {
    ref: 'player',
    facet: state.facets[0],
    bindings: {},
  });

/** Charge at `share` of the cap, then one game minute of the ability so the tiers follow. */
function charged(state: GameState, share: number) {
  debugSetCell(state, 'charge', share);
  globalThis.Facet.minute('player');
}

/** A bare-handed level-1 character strong enough for the woods' edge, with Solar Charge. */
function solar(): { state: GameState; game: Game } {
  const state = createInitialState(7);
  for (const a of ['str', 'dex', 'con', 'int', 'wis'] as const) state.attrs[a].level = 25;
  state.resources.hp = getDerivedStats(state).maxHp;
  installFacet();
  bindFacets(state, true);
  expect(grantFacet(state, 'solar_charge')).toBe(true);
  const game = new Game(state);
  state.spot = 'woods_edge';
  return { state, game };
}

function intoFight(state: GameState, game: Game): MonsterInstance[] {
  game.selectActivity('hunt');
  for (let t = 0; t < 2_000 && !state.combat?.enemies.some((e) => e && e.hp > 0); t++) game.step();
  expect(state.combat).toBeTruthy();
  return state.combat!.enemies.filter((e): e is MonsterInstance => !!e && e.hp > 0);
}

/** This fight's lines: the transcript keeps them all, the feed only the last ten. */
const lines = (state: GameState) => state.fight?.transcript ?? state.combatFeed;
const blasts = (state: GameState) => lines(state).filter((l) => l.text.includes('You use Sun Blast')).length;

describe('Solar Charge tiers', () => {
  it('turns each tier on at its share: 20%, 40%, 60%, 80%', () => {
    const { state } = solar();
    const tiers = () => ['warmth', 'infuse', 'mend', 'blast'].map((k) => cell(state, k));
    charged(state, 0.1);
    expect(tiers()).toEqual([0, 0, 0, 0]);
    charged(state, 0.3);
    expect(tiers()).toEqual([1, 0, 0, 0]);
    charged(state, 0.45);
    expect(tiers()).toEqual([1, 0.25, 0, 0]);
    charged(state, 0.65);
    expect(tiers()).toEqual([1, 0.25, 1, 0]);
    charged(state, 0.9);
    expect(tiers()).toEqual([1, 0.25, 1, 1]);
  });

  it('is -15% damage at empty', () => {
    const { state } = solar();
    charged(state, 0);
    expect(cell(state, 'power')).toBeCloseTo(-0.15);
  });

  it('adds 10% Cold and Poison resistance from 20%', () => {
    const { state } = solar();
    charged(state, 0.1);
    const before = getDerivedStats(state);
    charged(state, 0.3);
    const after = getDerivedStats(state);
    expect(after.resCold - before.resCold).toBeCloseTo(0.1);
    expect(after.resPoison - before.resPoison).toBeCloseTo(0.1);
    expect(after.resHeat).toBeCloseTo(before.resHeat);
  });

  it('puts Heat on a bare-handed blow from 40%, and none below', () => {
    const heatSlices = (state: GameState) =>
      lines(state).filter((l) => l.damage && !l.damage.incoming && l.damage.slices.some((s) => s.type === 'heat')).length;
    const cold = solar();
    intoFight(cold.state, cold.game);
    charged(cold.state, 0.3);
    for (let t = 0; t < 200 && cold.state.combat; t++) cold.game.step();
    expect(heatSlices(cold.state)).toBe(0);

    const warm = solar();
    intoFight(warm.state, warm.game);
    charged(warm.state, 0.5);
    for (let t = 0; t < 200 && warm.state.combat && heatSlices(warm.state) === 0; t++) warm.game.step();
    expect(heatSlices(warm.state)).toBeGreaterThan(0);
  });

  it('heals 5% of missing HP a minute from 60%, at CON / 40 charge per HP', () => {
    const { state } = solar();
    charged(state, 0.95);
    const max = getDerivedStats(state).maxHp;
    state.resources.hp = Math.round(max / 2);
    const start = state.resources.hp;
    const missing = max - start;
    const charge = cell(state, 'charge');
    state.totalTicks += 10;
    tickFacets(state);
    expect(state.resources.hp).toBeCloseTo(start + 0.05 * missing, 1);
    const con = effectiveAttr(state, 'con');
    const wis = effectiveAttr(state, 'wis');
    const drain = 0.02 * Math.pow(con + wis, 0.75);
    // Woods' edge is open sky, so a minute of sun is folded in as well.
    const spent = charge - cell(state, 'charge');
    expect(spent).toBeGreaterThan(0.05 * missing * (con / 40) + drain - 2);
    expect(spent).toBeLessThan(0.05 * missing * (con / 40) + drain + 0.01);
  });

  it('does not heal below 60%', () => {
    const { state } = solar();
    charged(state, 0.5);
    const max = getDerivedStats(state).maxHp;
    state.resources.hp = Math.round(max / 2);
    state.totalTicks += 10;
    tickFacets(state);
    expect(state.resources.hp).toBe(Math.round(max / 2));
  });
});

describe('Sun Blast', () => {
  it('is offered from 80% only', () => {
    const { state } = solar();
    charged(state, 0.7);
    expect(facetActions(state)).toMatchObject([{ id: BLAST, ready: false }]);
    charged(state, 0.85);
    expect(facetActions(state)).toMatchObject([{ id: BLAST, ready: true }]);
  });

  it('fires from the rotation, hits every enemy, and pays 5% of the cap', () => {
    const { state, game } = solar();
    state.skillOrder = [BLAST];
    const foes = intoFight(state, game);
    // Tough enough that the Heat half kills no one before the Light half lands.
    for (const f of foes) f.hp *= 100;
    charged(state, 1);
    const hp = foes.map((f) => f.hp);
    const before = cell(state, 'charge');
    for (let t = 0; t < 400 && blasts(state) === 0 && state.combat; t++) game.step();
    expect(blasts(state)).toBe(1);
    foes.forEach((f, i) => expect(f.hp, f.name).toBeLessThan(hp[i]));
    // The ability's running line for this fight holds both halves.
    const run = state.floatingFeed?.find((f) => f.group === 'ability:Solar Charge');
    expect(run?.report?.slices.map((s) => s.type).sort()).toEqual(['heat', 'light']);
    // 5% of the cap, give or take the minutes of sun and drain that passed.
    expect(before - cell(state, 'charge')).toBeGreaterThan(0.05 * capOf(state) - 3);
    expect(before - cell(state, 'charge')).toBeLessThan(0.05 * capOf(state) + 3);
  });

  it('answers to its trigger like any rotation entry', () => {
    const { state, game } = solar();
    state.skillOrder = [BLAST];
    state.skillTriggers[BLAST] = { enabled: false, conditions: [] };
    intoFight(state, game);
    charged(state, 1);
    for (let t = 0; t < 300 && state.combat; t++) game.step();
    expect(blasts(state)).toBe(0);
  });

  it('is pressed for the next bar fill from the Ability tab, and pressed again to cancel', () => {
    const { state, game } = solar();
    state.skillTriggers[BLAST] = { enabled: false, conditions: [] };
    charged(state, 1);
    expect(queueFacetAction(state, 'sun_blast')).toBe(false); // no fight yet
    intoFight(state, game);
    charged(state, 1);
    expect(queueFacetAction(state, 'sun_blast')).toBe(true);
    expect(state.combat!.queuedAct).toBe('sun_blast');
    expect(facetReadouts(state)[0].actions).toMatchObject([{ key: 'sun_blast', under: 'charge', queued: true }]);
    expect(queueFacetAction(state, 'sun_blast')).toBe(true);
    expect(state.combat!.queuedAct).toBeUndefined();
    queueFacetAction(state, 'sun_blast');
    for (let t = 0; t < 300 && blasts(state) === 0 && state.combat; t++) game.step();
    expect(blasts(state)).toBe(1);
    if (state.combat) expect(state.combat.queuedAct).toBeUndefined();
  });

  it('cannot be pressed below 80%', () => {
    const { state, game } = solar();
    intoFight(state, game);
    charged(state, 0.7);
    expect(queueFacetAction(state, 'sun_blast')).toBe(false);
  });
});
