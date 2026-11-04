// The bench test stands in the shelved home; the fixture mounts it.
import './fixtures/shelved-world';
import { afterEach, describe, expect, it } from 'vitest';
import { bindFacets, grantFacet, installFacet } from '../src/core/facet/host';
import { facetSignal } from '../src/core/facet/signal';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { getDerivedStats } from '../src/core/systems/derived';
import { grantGraded, gradesHeld, stockOf, type Placement } from '../src/core/systems/disciplines';
import { cloneReach, floorOfSpot } from '../src/core/systems/clones';
import { deserialize, serialize } from '../src/core/save/save';
import { FLOOR_BY_AREA, SPOTS } from '../src/core/registry';
import type { GameState } from '../src/core/types';

/**
 * Shadow Clone, deployed (systems/clones.ts, docs/FACET.md): a clone sent to a
 * job, gathering or a bench works it on its own at 40% of the yield and 25% of
 * the skill XP; bench crafts are whole but take 2.5 times as long. Clones end
 * when replaced, recalled, left too many floors behind, or on a knockout.
 */

afterEach(() => globalThis.Facet?.uninstall());

function at(spot: string, clones: boolean, level = 1): { state: GameState; game: Game } {
  const state = createInitialState(7);
  state.level = level;
  state.spot = spot;
  installFacet();
  bindFacets(state, true);
  if (clones) expect(grantFacet(state, 'shadow_clone')).toBe(true);
  return { state, game: new Game(state) };
}

const spotOnFloor = (index: number) =>
  Object.values(SPOTS).find((s) => FLOOR_BY_AREA.get(s.areaId)?.index === index)!.id;

describe('Shadow Clone, deployed', () => {
  it('a clone works a job on its own for 40% of the pay', () => {
    // The player on the job, for comparison.
    const self = at('the_alembics', false);
    self.game.selectActivity('job_retorts');
    for (let t = 0; t < 2_100; t++) self.game.step();
    const paid = self.state.gold;
    globalThis.Facet.uninstall();
    // A clone on it while the player stands idle.
    const { state, game } = at('the_alembics', true);
    expect(game.sendClone('job_retorts')).toBe(true);
    for (let t = 0; t < 2_100; t++) game.step();
    expect(paid).toBeGreaterThan(0);
    expect(state.gold / paid).toBeGreaterThan(0.3);
    expect(state.gold / paid).toBeLessThan(0.5);
  });

  it('a craft by a clone pays 25% of the skill XP yours does', () => {
    const board: Placement = { board: { id: 'wild_onion', quality: 'c' }, technique: { id: 'sliced', quality: 'c' } };
    const one = (clone: boolean) => {
      const { state, game } = at('my_home', clone);
      grantGraded(state, 'wild_onion', 'c', 1);
      state.skills.cooking = { level: 1, xp: 0 };
      if (clone) game.sendCloneToBench('preparing', board);
      else game.startBenchWork('preparing', board, { count: 1 });
      for (let t = 0; t < 400; t++) game.step();
      globalThis.Facet.uninstall();
      return Number(state.skills.cooking.xp);
    };
    const mine = one(false);
    expect(mine).toBeGreaterThan(0);
    expect(one(true)).toBeCloseTo(mine * 0.25);
  });

  it('a new clone with every clone out replaces the oldest; recall ends one or all', () => {
    const { state, game } = at('the_alembics', true, 25);
    game.sendClone('job_retorts');
    game.sendClone('job_retorts');
    game.sendClone('job_retorts');
    expect(state.clones.map((c) => c.order)).toEqual([1, 2, 3]);
    game.sendClone('job_retorts');
    expect(state.clones.map((c) => c.order)).toEqual([2, 3, 4]);
    expect(game.recallClone(3)).toBe(true);
    expect(state.clones.map((c) => c.order)).toEqual([2, 4]);
    expect(game.recallClones()).toBe(2);
    expect(state.clones).toEqual([]);
  });

  it('level 1 allows one clone, and each clone out takes 5% off max mana', () => {
    const { state, game } = at('the_alembics', true, 25);
    const mana = getDerivedStats(state).maxMana;
    game.sendClone('job_retorts');
    game.sendClone('job_retorts');
    expect(Math.abs(getDerivedStats(state).maxMana - mana * 0.9)).toBeLessThan(1);
    globalThis.Facet.uninstall();
    const low = at('the_alembics', true, 1);
    low.game.sendClone('job_retorts');
    low.game.sendClone('job_retorts');
    expect(low.state.clones).toHaveLength(1);
  });

  it('clones stop when the player is more floors away than (level - 10) / 5', () => {
    expect(floorOfSpot('the_alembics')).toBe(0);
    const one = spotOnFloor(1);
    const three = spotOnFloor(3);
    const near = at('the_alembics', true, 1);
    expect(cloneReach(near.state)).toBe(0);
    near.game.sendClone('job_retorts');
    near.state.spot = one;
    near.game.step();
    expect(near.state.clones).toHaveLength(0);
    globalThis.Facet.uninstall();
    const far = at('the_alembics', true, 20);
    expect(cloneReach(far.state)).toBe(2);
    far.game.sendClone('job_retorts');
    far.state.spot = one;
    far.game.step();
    expect(far.state.clones).toHaveLength(1);
    far.state.spot = three;
    far.game.step();
    expect(far.state.clones).toHaveLength(0);
  });

  it('a knockout ends every clone; a hit does not', () => {
    const { state, game } = at('the_alembics', true, 25);
    game.sendClone('job_retorts');
    facetSignal(state, 'hitTaken', { amount: 3, attacker: 'e0' });
    game.step();
    expect(state.clones).toHaveLength(1);
    state.recovering = true;
    game.step();
    expect(state.clones).toHaveLength(0);
    expect(game.sendClone('job_retorts')).toBe(false);
  });

  it('at a bench a clone makes whole crafts from stock, 2.5 times slower than you', () => {
    const board: Placement = { board: { id: 'wild_onion', quality: 'c' }, technique: { id: 'sliced', quality: 'c' } };
    const sliced = (s: GameState) => gradesHeld(s, 'wild_onion_sliced').reduce((n, e) => n + e.qty, 0);
    const { state, game } = at('my_home', true);
    grantGraded(state, 'wild_onion', 'c', 4);
    state.skills.cooking = { level: 1, xp: 0 };
    expect(game.sendCloneToBench('preparing', board)).toBe(true);
    const per = state.clones[0].bench!.ticksPer;
    for (let t = 0; t < per * 2 + 1; t++) game.step();
    expect(sliced(state)).toBe(2 * state.clones[0].bench!.batch);
    for (let t = 0; t < per * 10; t++) game.step();
    expect(sliced(state)).toBe(4);
    expect(stockOf(state, 'wild_onion', 'c')).toBe(0);
    expect(state.clones).toHaveLength(1);
  });

  it('clones survive a save and load', () => {
    const { state, game } = at('the_alembics', true, 25);
    game.sendClone('job_retorts');
    const loaded = deserialize(serialize(state));
    expect(loaded.clones).toHaveLength(1);
    expect(loaded.clones[0].activity).toBe('job_retorts');
  });
});
