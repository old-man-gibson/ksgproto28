import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SPOTS } from '../src/core/registry';
import { Game } from '../src/core/game';
import { createInitialState } from '../src/core/state';
import { canStartActivity, settleArrival } from '../src/core/systems/actions';
import { rollSearch, searchKey, searchSpent } from '../src/core/systems/search';
import type { ActivityDef } from '../src/core/types';

/**
 * A spent search refuses to start and stops a running one (docs/FLOOR_STANDARD.md
 * §2.3). No live search can be spent today (floor 1's salvage and coins are
 * unlimited), so the fixture is a search with one limited reward, attached to a
 * live spot for the length of each test.
 */
describe('a spent search', () => {
  const SPOT = 'f1_archive';
  const act: Extract<ActivityDef, { kind: 'search' }> = {
    id: 'limited', kind: 'search', name: 'Limited search', icon: '🔎', ticksPer: 5,
    rewards: [{ id: 'coin', weight: 1, limit: 1, gold: [2, 2] }],
  };
  const key = searchKey(SPOT, act.id);
  const fresh = (seed = 42) => new Game(createInitialState(seed, SPOT));
  function until(g: Game, predicate: () => boolean, ticks = 5000) {
    for (let i = 0; !predicate() && i < ticks; i++) g.tick();
    expect(predicate()).toBe(true);
  }

  beforeEach(() => {
    SPOTS[SPOT].activities.push(act);
  });
  afterEach(() => {
    SPOTS[SPOT].activities.splice(SPOTS[SPOT].activities.indexOf(act), 1);
  });

  it('is spent once every reward is at its limit, or its requires are unmet, and not before', () => {
    const g = fresh();
    expect(searchSpent(g.state, SPOT, act)).toBe(false);
    expect(rollSearch(g.state, g.bus, SPOT, act)?.id).toBe('coin');
    expect(searchSpent(g.state, SPOT, act)).toBe(true);

    const gated: typeof act = { ...act, id: 'gated', rewards: [{ id: 'book', weight: 1, requires: [{ type: 'stat', key: 'flag:gate', value: 1 }], gold: [1, 1] }] };
    expect(searchSpent(g.state, SPOT, gated)).toBe(true);
    g.state.stats['flag:gate'] = 1;
    expect(searchSpent(g.state, SPOT, gated)).toBe(false);
  });

  it('agrees with rollSearch: spent exactly when a roll would find nothing', () => {
    const g = fresh();
    for (let i = 0; i < 4; i++) {
      const spent = searchSpent(g.state, SPOT, act);
      expect(rollSearch(g.state, g.bus, SPOT, act) === null).toBe(spent);
    }
  });

  it('canStartActivity refuses it, and accepts it again when a reward becomes eligible', () => {
    const g = fresh();
    expect(canStartActivity(g.state, SPOT, act.id)).toBe(true);
    rollSearch(g.state, g.bus, SPOT, act);
    expect(canStartActivity(g.state, SPOT, act.id)).toBe(false);
    expect(g.goAndDo(SPOT, act.id)).toBe(false);
    expect(g.state.activity).toBeNull();
    g.state.stats[`${key}:coin`] = 0;
    expect(canStartActivity(g.state, SPOT, act.id)).toBe(true);
  });

  it('a running search pays its reward, then stops on the cycle that finds nothing', () => {
    const g = fresh();
    const gold = g.state.gold;
    g.selectActivity(act.id);
    until(g, () => g.state.activity === null);
    expect(g.state.gold - gold).toBe(2);
    expect(g.state.stats[`${key}:coin`]).toBe(1);
    expect(g.state.stats[key]).toBe(2); // one paying cycle, one that found nothing
    expect(g.state.activityProgress).toBe(0);
    expect(g.state.log.some((l) => l.msg.includes('Nothing remains to be found in this search.'))).toBe(true);
    for (let i = 0; i < 300; i++) g.tick();
    expect(g.state.activity).toBeNull();
    expect(g.state.stats[key]).toBe(2); // not spinning
  });

  it('picking a spent search by hand still starts it, and it stops after one cycle', () => {
    const g = fresh();
    rollSearch(g.state, g.bus, SPOT, act);
    g.selectActivity(act.id);
    expect(g.state.activity).toBe(act.id);
    until(g, () => g.state.activity === null);
    expect(g.state.stats[key]).toBe(2);
  });

  it('resume-on-return does not restart it, and does restart a search with a reward left', () => {
    const g = fresh();
    g.selectActivity(act.id);
    until(g, () => g.state.activity === null);
    expect(g.state.resumeActivity[SPOT]).toBe(act.id); // the entry stays; the arrival check refuses it
    settleArrival(g.state, g.bus);
    expect(g.state.activity).toBeNull();

    g.state.stats[`${key}:coin`] = 0;
    settleArrival(g.state, g.bus);
    expect(g.state.activity).toBe(act.id);
  });

  it('live searches are unchanged: a fresh run can start every one, and an unlimited one never stops', () => {
    const g = fresh();
    for (const spot of Object.values(SPOTS)) {
      for (const a of spot.activities) {
        if (a.kind === 'search' && a.id !== act.id) expect(searchSpent(g.state, spot.id, a), `${spot.id}/${a.id}`).toBe(false);
      }
    }
    g.selectActivity('search');
    until(g, () => (g.state.stats[searchKey(SPOT, 'search')] ?? 0) >= 8, 20000);
    expect(g.state.activity).toBe('search');
  });
});
