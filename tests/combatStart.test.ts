import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { SPOTS } from '../src/core/registry';
import { soleCombatActivity } from '../src/core/systems/actions';
import type { ActivityDef, SpotDef } from '../src/core/types';

// The Combat tab's start button (CombatPanel): shown when the spot has exactly
// one combat activity, which is exactly one hunt.

const hunt = (id: string): ActivityDef => ({ id, kind: 'hunt', name: id, icon: '⚔️' });
const spar: ActivityDef = { id: 'spar', kind: 'train', attr: 'str', name: 'Spar', icon: '⚔️', tags: ['combat'] };
const withActivities = (activities: ActivityDef[]): SpotDef => ({ ...SPOTS.the_sand, activities });

describe('soleCombatActivity', () => {
  it('no hunt: null, even beside a combat-tagged train activity', () => {
    expect(soleCombatActivity(withActivities([]))).toBeNull();
    expect(soleCombatActivity(withActivities([spar]))).toBeNull();
  });

  it('exactly one hunt: that hunt; a combat-tagged train activity does not count', () => {
    expect(soleCombatActivity(withActivities([hunt('a')]))?.id).toBe('a');
    expect(soleCombatActivity(withActivities([spar, hunt('a')]))?.id).toBe('a');
  });

  it('several hunts: null', () => {
    expect(soleCombatActivity(withActivities([hunt('a'), hunt('b')]))).toBeNull();
    expect(soleCombatActivity(withActivities([hunt('a'), spar, hunt('b')]))).toBeNull();
  });

  it('live spots: the Sand offers Beat the Post, the Training Area its dummies', () => {
    expect(soleCombatActivity(SPOTS.the_sand)?.name).toBe('Beat the Post');
    expect(soleCombatActivity(SPOTS.base_training_area)?.name).toBe('Work the Dummies');
    for (const spot of Object.values(SPOTS)) {
      const hunts = spot.activities.filter((a) => a.kind === 'hunt');
      expect(soleCombatActivity(spot), spot.id).toBe(hunts.length === 1 ? hunts[0] : null);
    }
  });
});

describe('starting it', () => {
  it('runs a fight, and selecting it again stops the fight', () => {
    const g = new Game(createInitialState(5));
    g.state.spot = 'the_sand';
    const act = soleCombatActivity(SPOTS.the_sand)!;
    g.selectActivity(act.id);
    g.state.respawnTimer = 0;
    g.tick();
    expect(g.state.activity).toBe(act.id);
    expect(g.state.combat).not.toBeNull();
    g.selectActivity(null);
    expect(g.state.activity).toBeNull();
    expect(g.state.combat).toBeNull();
  });

  it('a forced fight keeps it locked, as on the Location tab', () => {
    const g = new Game(createInitialState(5));
    g.state.spot = 'f3_hearing_room';
    g.tick();
    expect(g.state.combat?.forced).toBe(true);
    g.selectActivity(soleCombatActivity(SPOTS.f3_hearing_room)!.id);
    expect(g.state.activity).toBeNull();
    expect(g.state.combat?.forced).toBe(true);
  });
});
