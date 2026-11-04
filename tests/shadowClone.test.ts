// The bench test stands in the shelved home; the fixture mounts it.
import './fixtures/shelved-world';
import { afterEach, describe, expect, it } from 'vitest';
import { bindFacets, grantFacet, installFacet } from '../src/core/facet/host';
import { facetSignal } from '../src/core/facet/signal';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { getDerivedStats } from '../src/core/systems/derived';
import { grantGraded, gradesHeld, type Placement } from '../src/core/systems/disciplines';
import { startBenchWork } from '../src/core/systems/benchwork';
import { stockOf } from '../src/core/systems/disciplines';
import type { GameState, QualityTier } from '../src/core/types';

/**
 * Shadow Clone (Facet repo core/facet.bank.js, docs/FACET.md): gathering, a
 * job or a bench run brings clones; each adds 40% yield and skill XP, bench
 * clone crafts use their own stock, and a hit or a change of work dispels them.
 */

afterEach(() => globalThis.Facet?.uninstall());

/** A game at `spot`, holding Shadow Clone when `clones` is set. */
function at(spot: string, clones: boolean, level = 1): { state: GameState; game: Game } {
  const state = createInitialState(7);
  state.level = level;
  state.spot = spot;
  installFacet();
  bindFacets(state, true);
  if (clones) expect(grantFacet(state, 'shadow_clone')).toBe(true);
  return { state, game: new Game(state) };
}

const cell = (state: GameState, key: string) => state.facets[0].cells!.find((c) => c.key === key)!.state!.v;

function work(spot: string, activity: string, clones: boolean, ticks: number): GameState {
  const { state, game } = at(spot, clones);
  const gold = state.gold;
  game.selectActivity(activity);
  for (let t = 0; t < ticks; t++) game.step();
  state.gold -= gold;
  globalThis.Facet.uninstall();
  return state;
}

describe('Shadow Clone', () => {
  it('starting a job brings one clone at level 1, and pay is 40% more', () => {
    const { state, game } = at('the_alembics', true);
    game.selectActivity('job_retorts');
    game.step();
    expect(cell(state, 'clones')).toBe(1);
    globalThis.Facet.uninstall();
    const alone = work('the_alembics', 'job_retorts', false, 2_100);
    const helped = work('the_alembics', 'job_retorts', true, 2_100);
    expect(alone.gold).toBeGreaterThan(0);
    // Pay rounds per shift: 11 x goldGain x 1.4 against 11 x goldGain.
    expect(helped.gold / alone.gold).toBeGreaterThan(1.3);
    expect(helped.gold / alone.gold).toBeLessThan(1.5);
  });

  it('gathering yields about 40% more', () => {
    const alone = work('base_farm', 'tend_rows', false, 24_000);
    const helped = work('base_farm', 'tend_rows', true, 24_000);
    const got = (s: GameState) => s.stats['gather:wild_onion'] ?? 0;
    expect(got(alone)).toBeGreaterThan(50);
    expect(got(helped) / got(alone)).toBeGreaterThan(1.25);
    expect(got(helped) / got(alone)).toBeLessThan(1.55);
    // Two runs of 24,000 ticks: about 2 s alone, past the 5 s default under a full suite.
  }, 30_000);

  it('counts 1 + 1 per 10 levels, and each clone takes 5% off max mana', () => {
    const { state, game } = at('the_alembics', true, 25);
    const mana = getDerivedStats(state).maxMana;
    game.selectActivity('job_retorts');
    game.step();
    expect(cell(state, 'clones')).toBe(3);
    // Pool maxima are whole numbers.
    expect(Math.abs(getDerivedStats(state).maxMana - mana * 0.85)).toBeLessThan(1);
  });

  it('a hit dispels them until the work changes; switching away dispels them too', () => {
    const { state, game } = at('the_alembics', true);
    game.selectActivity('job_retorts');
    game.step();
    expect(cell(state, 'clones')).toBe(1);
    facetSignal(state, 'hitTaken', { amount: 3, attacker: 'e0' });
    expect(cell(state, 'clones')).toBe(0);
    for (let t = 0; t < 10; t++) game.step();
    expect(cell(state, 'clones')).toBe(0);
    game.selectActivity(null);
    game.step();
    game.selectActivity('job_retorts');
    game.step();
    expect(cell(state, 'clones')).toBe(1);
    game.selectActivity(null);
    game.step();
    expect(cell(state, 'clones')).toBe(0);
  });

  it('at a bench, clone crafts use their own stock: more crafts, never more than the stock', () => {
    const board = (q: QualityTier): Placement => ({ board: { id: 'wild_onion', quality: q }, technique: { id: 'sliced', quality: 'c' } });
    const sliced = (s: GameState) => gradesHeld(s, 'wild_onion_sliced').reduce((n, e) => n + e.qty, 0);
    const run = (clones: boolean, stock: number, ticks: number) => {
      const { state, game } = at('my_home', clones);
      grantGraded(state, 'wild_onion', 'c', stock);
      state.skills.cooking = { level: 1, xp: 0 };
      expect(startBenchWork(state, game.bus, 'preparing', board('c'), { count: null })).toBe(true);
      for (let t = 0; t < ticks; t++) game.tick();
      globalThis.Facet.uninstall();
      return state;
    };
    const alone = run(false, 200, 300);
    const helped = run(true, 200, 300);
    expect(sliced(helped)).toBeGreaterThan(sliced(alone));
    const dry = run(true, 5, 400);
    expect(sliced(dry)).toBe(5);
    expect(stockOf(dry, 'wild_onion', 'c')).toBe(0);
  });
});
