// The hunting tests stand on the shelved countryside; the fixture mounts it.
import './fixtures/shelved-world';
import { afterEach, describe, expect, it } from 'vitest';
import {
  bindFacets,
  chooseFacetOption,
  facetReadouts,
  grantFacet,
  installFacet,
  levelsPast,
} from '../src/core/facet/host';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { attrValue, formulaAttr, grantAttrXp } from '../src/core/systems/attributes';
import { getDerivedStats } from '../src/core/systems/derived';
import {
  masteryTier,
  masteryTierName,
  recordExecution,
  repsToNextTier,
  resolvedMove,
} from '../src/core/systems/martial';
import { findStatus } from '../src/core/systems/statuses';
import { MASTERY_POWER, MAX_MASTERY_TIER, TECHNIQUE_LIST } from '../src/core/data/martial.data';
import { SKILLS } from '../src/core/registry';
import type { GameState, TechniqueDef } from '../src/core/types';

/**
 * Weakest Weapon Master (Facet repo core/facet.bank.js, docs/FACET.md):
 * formulas read attributes at 20 or less and XP past it buys hidden levels;
 * technique uses record x2 to x64 reps for every slotted technique; rungs past
 * 10,000 for every build; four stances picked at the player's bar fill.
 */

afterEach(() => globalThis.Facet.uninstall());

/** A character with every attribute at `attrs`, holding Weakest Weapon Master. */
function wearing(attrs = 30): { state: GameState; game: Game } {
  const state = createInitialState(7);
  for (const a of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const) state.attrs[a].level = attrs;
  state.resources.hp = getDerivedStats(state).maxHp;
  installFacet();
  bindFacets(state, true);
  expect(grantFacet(state, 'weakest_weapon_master')).toBe(true);
  const game = new Game(state);
  // One game minute sets the ability's numbers.
  globalThis.Facet.minute('player');
  return { state, game };
}

const cell = (state: GameState, key: string) => state.facets[0].cells!.find((c) => c.key === key)!.state!.v;

/** Every combat skill at `level`, so Power is large. */
function trained(state: GameState, level: number): void {
  for (const [id, def] of Object.entries(SKILLS)) {
    if (def.category !== 'combat') continue;
    state.skills[id] = { ...(state.skills[id] ?? { xp: 0 }), level } as GameState['skills'][string];
  }
  globalThis.Facet.minute('player');
}

/** Steps until a fight is on at `spot`. */
function intoFight(state: GameState, game: Game, spot: string): void {
  state.spot = spot;
  game.selectActivity('hunt');
  for (let t = 0; t < 2_000 && !state.combat?.enemies.some((e) => e && e.hp > 0); t++) game.step();
  expect(state.combat).toBeTruthy();
}

describe('Weakest Weapon Master: the ceiling', () => {
  it('formulas read 20, gates read the real value', () => {
    const { state } = wearing(30);
    expect(attrValue(state, 'str')).toBeGreaterThanOrEqual(30);
    expect(formulaAttr(state, 'str')).toBe(20);
    // 30 and 40 both read as 20, so the stats match; without the ability 30 is more.
    const at30 = getDerivedStats(state).maxHp;
    globalThis.Facet.uninstall();
    const { state: higher } = wearing(40);
    expect(getDerivedStats(higher).maxHp).toBe(at30);
    globalThis.Facet.uninstall();
    const bare = createInitialState(7);
    for (const a of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const) bare.attrs[a].level = 30;
    expect(getDerivedStats(bare).maxHp).toBeGreaterThan(at30);
  });

  it('routes XP for an attribute at the ceiling into hidden levels, and trains one below it', () => {
    const { state, game } = wearing(30);
    state.attrs.dex.level = 5;
    const before = state.attrs.str.xp;
    grantAttrXp(state, game.bus, 'str', 5_000);
    expect(state.attrs.str.xp).toBe(before);
    expect(cell(state, 'past_str')).toBe(5_000);
    expect(cell(state, 'hidden')).toBe(levelsPast(20, 5_000));
    expect(cell(state, 'hidden')).toBeGreaterThan(0);
    const dex = state.attrs.dex.xp;
    grantAttrXp(state, game.bus, 'dex', 3);
    expect(state.attrs.dex.xp).toBe(dex + 3);
    expect(cell(state, 'past_dex')).toBe(0);
  });
});

describe('Weakest Weapon Master: reps and rungs', () => {
  const strike = TECHNIQUE_LIST.find((t) => t.move.damageMult !== undefined && !t.move.counter) as TechniqueDef;
  const counter = TECHNIQUE_LIST.find((t) => t.move.counter) as TechniqueDef;
  const form = TECHNIQUE_LIST.find(
    (t) => t.move.buff && t.move.damageMult === undefined && t.move.preventedMult === undefined,
  ) as TechniqueDef;

  it('every slotted technique records the multiplied reps, drilled or not', () => {
    const { state } = wearing(30);
    state.drilling = ['a', 'b', 'c'];
    state.techniques[strike.id] = { executions: 0, form: 'canonical' };
    recordExecution(state, strike);
    expect(state.techniques[strike.id].executions).toBe(Math.max(1, Math.round(cell(state, 'reps'))));
    expect(state.techniques[strike.id].executions).toBeGreaterThanOrEqual(2);
    expect(state.drilling).toEqual(['a', 'b', 'c']);
  });

  it('rungs continue past 10,000: power doubles and the cooldown shrinks at each', () => {
    const state = createInitialState(7);
    state.techniques[strike.id] = { executions: 100_000, form: 'canonical' };
    expect(masteryTier(state, strike)).toBe(5);
    expect(masteryTierName(strike, 5)).toBe('Beyond I');
    expect(resolvedMove(state, strike).damageMult).toBeCloseTo(strike.move.damageMult! * MASTERY_POWER[3] * 2);
    expect(repsToNextTier(state, strike)).toBe(900_000);
  });

  it('every tier stays finite for a strike, a counter and a defensive form', () => {
    const state = createInitialState(7);
    for (const def of [strike, counter, form]) {
      for (let tier = 0; tier <= MAX_MASTERY_TIER; tier++) {
        state.techniques[def.id] = { executions: tier === 0 ? 0 : tier <= 4 ? 10 ** tier : 10 ** tier, form: 'canonical' };
        expect(masteryTier(state, def)).toBe(tier);
        const move = resolvedMove(state, def);
        for (const v of [move.damageMult, move.preventedMult, move.cooldown, move.buff?.duration]) {
          if (v !== undefined) expect(Number.isFinite(v)).toBe(true);
        }
        expect(move.cooldown).toBeGreaterThanOrEqual(Math.min(10, def.move.cooldown));
      }
      expect(repsToNextTier(state, def)).toBeUndefined();
    }
  });
});

describe('Weakest Weapon Master: stances', () => {
  it('Power adds Power to damage; the readout offers the four stances', () => {
    const { state } = wearing(30);
    trained(state, 50);
    const power = cell(state, 'power');
    expect(power).toBeGreaterThan(0);
    const ab = facetReadouts(state)[0];
    expect(ab.choice?.options.map((o) => o.name)).toEqual(['Power', 'Flowing', 'Heavy', 'Empty']);
    expect(ab.cells.find((c) => c.key === 'power')?.acts).toBe(true);
    expect(ab.cells.find((c) => c.key === 'flowing')?.acts).toBe(true);
    expect(ab.cells.find((c) => c.key === 'ceiling')?.acts).toBe(false);
  });

  it('a stance picked in a fight applies at the next bar fill', () => {
    const { state, game } = wearing(30);
    intoFight(state, game, 'woods_edge');
    for (const e of state.combat!.enemies) if (e) e.hp = 1e9;
    expect(chooseFacetOption(state, 3)).toBe(true);
    expect(cell(state, 'want')).toBe(3);
    expect(cell(state, 'stance')).toBe(1);
    for (let t = 0; t < 60 && cell(state, 'stance') !== 3; t++) game.step();
    expect(cell(state, 'stance')).toBe(3);
  });

  it('Heavy turns aside a blow smaller than Power and rattles the attacker', () => {
    const { state, game } = wearing(30);
    trained(state, 500);
    chooseFacetOption(state, 3);
    intoFight(state, game, 'woods_edge');
    for (const e of state.combat!.enemies) if (e) e.hp = 1e9;
    const hp = state.resources.hp;
    const taken = state.stats['combat:hitsTaken'] ?? 0;
    let rattled = false;
    for (let t = 0; t < 200; t++) {
      game.step();
      rattled ||= state.combat?.enemies.some((e) => e && findStatus(e, 'rattled')) ?? false;
    }
    expect(state.stats['combat:hitsTaken'] ?? 0).toBe(taken);
    expect(state.resources.hp).toBeGreaterThanOrEqual(hp);
    expect(rattled).toBe(true);
  });

  it('Flowing parries every blow when Power is twice the blow or more', () => {
    const { state, game } = wearing(30);
    trained(state, 500);
    chooseFacetOption(state, 2);
    intoFight(state, game, 'woods_edge');
    for (const e of state.combat!.enemies) if (e) e.hp = 1e9;
    const parries = state.stats['combat:parries'] ?? 0;
    const taken = state.stats['combat:hitsTaken'] ?? 0;
    for (let t = 0; t < 200; t++) game.step();
    expect(state.stats['combat:parries'] ?? 0).toBeGreaterThan(parries);
    expect(state.stats['combat:hitsTaken'] ?? 0).toBe(taken);
  });

  it('Empty blows skip the dummy\'s resistance', () => {
    const { state, game } = wearing(30);
    chooseFacetOption(state, 4);
    intoFight(state, game, 'base_training_area');
    for (let t = 0; t < 120; t++) game.step();
    const blows = state.combatFeed.filter((f) => f.damage && !f.damage.incoming && f.damage.slices.length);
    expect(blows.length).toBeGreaterThan(0);
    for (const f of blows) {
      expect(f.damage!.slices[0].resisted).toBe(0);
      expect(f.damage!.slices[0].armor).toBe(0);
    }
  });
});
