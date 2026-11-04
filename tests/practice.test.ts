import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { EventBus } from '../src/core/engine/events';
import { SPOTS } from '../src/core/registry';
import { attrXpNeeded, grantAttrXp } from '../src/core/systems/attributes';
import { skillXpNeeded } from '../src/core/systems/skills';
import { isPracticeFight, practiceShare, practiceXp, practising } from '../src/core/systems/practice';
import {
  PRACTICE_FLOOR_GAP,
  PRACTICE_XP_CUT,
  PRACTICE_XP_FALLOFF,
  PRACTICE_XP_FLOOR,
} from '../src/core/data/practice.data';
import type { AttributeId, GameState, MonsterInstance } from '../src/core/types';

/** docs/PRACTICE.md: XP from training equipment. */

/** A save standing in a fight against `defIds`, without running the fight. */
function inFight(...defIds: string[]): GameState {
  const state = createInitialState(1);
  state.combat = {
    enemies: defIds.map((defId) => ({ defId, hp: 100 }) as MonsterInstance),
    playerBar: 0,
    momentum: 0,
    position: 'neutral',
    cooldowns: {},
    buffs: [],
    events: {},
  };
  return state;
}

/** Lifetime XP a skill holds: every level climbed plus what is banked. */
function skillTotal(state: GameState, id: string): number {
  const s = state.skills[id];
  if (!s) return 0;
  let total = s.xp;
  for (let l = 1; l < s.level; l++) total += skillXpNeeded(id, l);
  return total;
}
function attrTotal(state: GameState, attr: AttributeId): number {
  const a = state.attrs[attr];
  let total = a.xp;
  for (let l = 1; l < a.level; l++) total += attrXpNeeded(l);
  return total;
}

/** A fresh save on The Sand, beating the post. */
function onThePost(seed = 7): Game {
  const g = new Game(createInitialState(seed));
  g.state.spot = 'the_sand';
  g.selectActivity('hunt');
  g.state.respawnTimer = 0;
  return g;
}

describe('the share', () => {
  it('is the cut at level 1 and falls as F / (F + L − 1)', () => {
    expect(practiceShare(1)).toBeCloseTo(PRACTICE_XP_CUT, 9);
    expect(practiceShare(1 + PRACTICE_XP_FALLOFF)).toBeCloseTo(PRACTICE_XP_CUT / 2, 9);
    expect(practiceShare(1 + 2 * PRACTICE_XP_FALLOFF)).toBeCloseTo(PRACTICE_XP_CUT / 3, 9);
    for (let l = 1; l < 100; l++) expect(practiceShare(l + 1)).toBeLessThan(practiceShare(l));
  });
});

describe('practiceXp', () => {
  it('is the identity outside a practice tick', () => {
    const state = inFight('benchmark_dummy');
    expect(practiceXp(state, 'skill:fighting', 1, 4.5)).toBe(4.5);
    expect(state.combat!.practiceAt).toBeUndefined();
  });

  it('pays the larger of the cut payout and the floor for the gap', () => {
    const state = inFight('benchmark_dummy');
    practising(state, () => {
      // First payout of the fight: one second of floor.
      expect(practiceXp(state, 'skill:fighting', 1, 4.5)).toBeCloseTo(PRACTICE_XP_FLOOR, 9);
      // Same tick again: no time has passed, so only the cut payout.
      expect(practiceXp(state, 'skill:fighting', 1, 4.5)).toBeCloseTo(4.5 * PRACTICE_XP_CUT, 9);
      // Two seconds later: two seconds of floor.
      state.totalTicks += 20;
      expect(practiceXp(state, 'skill:fighting', 1, 4.5)).toBeCloseTo(2 * PRACTICE_XP_FLOOR, 9);
      // A payout big enough beats the floor.
      state.totalTicks += 10;
      expect(practiceXp(state, 'skill:fighting', 1, 100)).toBeCloseTo(100 * PRACTICE_XP_CUT, 9);
    });
  });

  it('credits at most PRACTICE_FLOOR_GAP seconds for a long pause', () => {
    const state = inFight('benchmark_dummy');
    practising(state, () => {
      practiceXp(state, 'attr:int', 1, 3);
      state.totalTicks += 600; // a minute without a cast
      // 30 cut to 3 is under five seconds of floor; sixty are not credited.
      expect(practiceXp(state, 'attr:int', 1, 30)).toBeCloseTo(PRACTICE_FLOOR_GAP * PRACTICE_XP_FLOOR, 9);
    });
  });

  it('never pays more than the uncut amount', () => {
    const state = inFight('benchmark_dummy');
    practising(state, () => {
      practiceXp(state, 'attr:dex', 1, 1);
      state.totalTicks += 30;
      expect(practiceXp(state, 'attr:dex', 1, 1)).toBe(1); // three seconds of floor, but the blow paid 1
    });
  });

  it('keeps one clock per skill and per attribute', () => {
    const state = inFight('benchmark_dummy');
    practising(state, () => {
      practiceXp(state, 'attr:str', 1, 2);
      state.totalTicks += 20;
      // DEX was never paid in this fight, so it gets the first-payout second.
      expect(practiceXp(state, 'attr:dex', 1, 2)).toBeCloseTo(PRACTICE_XP_FLOOR, 9);
      expect(practiceXp(state, 'attr:str', 1, 2)).toBeCloseTo(2 * PRACTICE_XP_FLOOR, 9);
    });
  });

  it('a payout made outside the tick is not shaped, even mid-fight', () => {
    const state = inFight('benchmark_dummy');
    grantAttrXp(state, new EventBus(), 'str', 7);
    expect(attrTotal(state, 'str')).toBe(7);
  });
});

describe('what counts as practice', () => {
  it('every standing enemy must be training equipment', () => {
    expect(isPracticeFight(inFight('benchmark_dummy').combat)).toBe(true);
    expect(isPracticeFight(inFight('training_dummy', 'training_dummy').combat)).toBe(true);
    expect(isPracticeFight(inFight('training_dummy', 'forest_rat').combat)).toBe(false);
    expect(isPracticeFight(inFight('forest_rat').combat)).toBe(false);
    expect(isPracticeFight(null)).toBe(false);
  });

  it('a real fight never touches the practice clock', () => {
    const g = new Game(createInitialState(3));
    g.state.spot = 'the_cages';
    g.selectActivity('hunt');
    g.state.respawnTimer = 0;
    for (let i = 0; i < 300 && !g.state.combat; i++) g.tick();
    expect(g.state.combat).not.toBeNull();
    for (let i = 0; i < 100 && g.state.combat; i++) {
      g.tick();
      expect(g.state.combat?.practiceAt).toBeUndefined();
    }
  });
});

describe('the post on The Sand', () => {
  it('The Sand offers it, and it is a lone practice target', () => {
    const sand = SPOTS.the_sand;
    expect(sand.activities.some((a) => a.kind === 'hunt')).toBe(true);
    expect(sand.encounters?.map((e) => e.monsterId)).toEqual(['benchmark_dummy']);
    const g = onThePost();
    for (let i = 0; i < 50 && !g.state.combat; i++) g.tick();
    expect(g.state.combat?.enemies.filter(Boolean).map((e) => e!.defId)).toEqual(['benchmark_dummy']);
    expect(isPracticeFight(g.state.combat)).toBe(true);
  });

  it('pays each combat skill about the floor per second, and Hunting nothing', () => {
    const g = onThePost();
    for (let i = 0; i < 50 && !g.state.combat; i++) g.tick();
    const seconds = 300;
    const before = { fighting: skillTotal(g.state, 'fighting'), str: attrTotal(g.state, 'str') };
    for (let t = 0; t < seconds * 10; t++) g.tick();
    expect(g.state.combat).not.toBeNull(); // the post is still standing
    // A swing lands about every two seconds and pays Fighting 4.5 uncut, so
    // every payout is floored: the earned total tracks the clock. It runs a
    // little under it: a run of misses can leave a gap over the cap, and the
    // seconds after the last swing are not paid yet.
    const fighting = skillTotal(g.state, 'fighting') - before.fighting;
    expect(fighting).toBeGreaterThan(seconds * PRACTICE_XP_FLOOR * 0.95);
    expect(fighting).toBeLessThan(seconds * PRACTICE_XP_FLOOR + 5);
    // STR is paid 2 a swing, so the floor is trimmed to it on slower swings.
    const str = attrTotal(g.state, 'str') - before.str;
    expect(str).toBeGreaterThan(seconds * 0.5);
    expect(str).toBeLessThan(seconds * PRACTICE_XP_FLOOR + 5);
    expect(skillTotal(g.state, 'hunting')).toBe(0);
    expect(g.state.level).toBe(1);
    expect(g.state.levelXp).toBe(0);
  });

  it('pays far less than the same fight would without the rule', () => {
    // The uncut figure: Fighting is paid 4.5 a swing. A post that cut nothing
    // would pay about that per swing; the floor holds it to the clock.
    const g = onThePost();
    let swings = 0;
    g.bus.on('tick:action', () => swings++);
    for (let t = 0; t < 3000; t++) g.tick();
    expect(swings).toBeGreaterThan(50);
    expect(skillTotal(g.state, 'fighting')).toBeLessThan(swings * 4.5 * 0.6);
  });
});

describe('the Training Area dummies', () => {
  it('die and respawn but pay no character-level XP', () => {
    const g = new Game(createInitialState(5));
    g.state.spot = 'base_training_area';
    g.selectActivity('hunt');
    g.state.respawnTimer = 0;
    for (let t = 0; t < 20000 && (g.state.stats['kills'] ?? 0) < 1; t++) g.tick();
    expect(g.state.stats['kills'] ?? 0).toBeGreaterThan(0);
    expect(g.state.level).toBe(1);
    expect(g.state.levelXp).toBe(0);
  });
});
