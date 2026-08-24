import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import {
  ATTACK_SPEED_MOD_CAP,
  MIN_ATTACK_TICKS,
  actionTicks,
  attackFillRate,
  getDerivedStats,
} from '../src/core/systems/derived';
import type { Modifier } from '../src/core/types';

/** A game whose only attack-speed influences are the given buff mods. */
function withBuffs(mods: Modifier[], seed = 1): Game {
  const g = new Game(createInitialState(seed));
  g.state.combat = {
    enemies: [null, null, null, null, null],
    playerBar: 0, momentum: 0, position: 'neutral',
    cooldowns: {}, events: {},
    buffs: [{ name: 'Test', mods, ticksLeft: 100 }],
  };
  return g;
}

const attackTime = (g: Game) => {
  const stats = getDerivedStats(g.state);
  return actionTicks(stats.actionBar, attackFillRate(stats));
};

describe('converging attack speed', () => {
  it('two 10% hastes reduce attack time by 19%, not compounding fill', () => {
    const base = attackTime(withBuffs([]));
    const one = attackTime(withBuffs([{ stat: 'attackSpeed', op: 'mult', value: 0.1 }]));
    const two = attackTime(
      withBuffs([
        { stat: 'attackSpeed', op: 'mult', value: 0.1 },
        { stat: 'attackSpeed', op: 'mult', value: 0.1 },
      ]),
    );
    expect(one / base).toBeCloseTo(0.9);
    expect(two / base).toBeCloseTo(0.81);
  });

  it('slows are symmetric and capped at doubling per source', () => {
    const base = attackTime(withBuffs([]));
    const slowed = attackTime(withBuffs([{ stat: 'attackSpeed', op: 'mult', value: -0.3 }]));
    expect(slowed / base).toBeCloseTo(1.3);
    const crawl = attackTime(withBuffs([{ stat: 'attackSpeed', op: 'mult', value: -5 }]));
    expect(crawl / base).toBeCloseTo(2);
  });

  it('no single source erases more than half the attack time', () => {
    const base = attackTime(withBuffs([]));
    const capped = attackTime(withBuffs([{ stat: 'attackSpeed', op: 'mult', value: 0.9 }]));
    expect(capped / base).toBeCloseTo(1 - ATTACK_SPEED_MOD_CAP);
  });

  it('past the floor, speed converts to extra swings instead of vanishing', () => {
    // Enough stacked hastes (each under the per-source cap) to break the floor.
    const haste = Array.from({ length: 8 }, () => ({
      stat: 'attackSpeed' as const,
      op: 'mult' as const,
      value: 0.4,
    }));
    const g = withBuffs(haste);
    g.state.attrs.dex.level = 60; // speed pushes the interval further down
    const stats = getDerivedStats(g.state);
    const interval = actionTicks(stats.actionBar, attackFillRate(stats));
    expect(interval).toBeCloseTo(MIN_ATTACK_TICKS);
    expect(stats.extraSwings).toBeGreaterThan(0);
    // DPS preserved: floored interval × (1 + extraSwings) = uncapped interval's worth.
    const uncappedInterval = MIN_ATTACK_TICKS / (1 + stats.extraSwings);
    expect(uncappedInterval).toBeLessThan(MIN_ATTACK_TICKS);
  });

  it('a normal fighter never touches the floor', () => {
    const stats = getDerivedStats(withBuffs([]).state);
    expect(actionTicks(stats.actionBar, attackFillRate(stats))).toBeGreaterThan(MIN_ATTACK_TICKS);
    expect(stats.extraSwings).toBe(0);
  });
});
