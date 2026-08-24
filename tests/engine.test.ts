import { describe, expect, it } from 'vitest';
import { TickAccumulator, MS_PER_TICK } from '../src/core/engine/loop';
import { createInitialState } from '../src/core/state';
import { rand, randInt, weightedPick } from '../src/core/engine/rng';

describe('TickAccumulator', () => {
  it('produces one tick per MS_PER_TICK of elapsed time', () => {
    const acc = new TickAccumulator();
    expect(acc.advance(MS_PER_TICK * 3)).toBe(3);
    expect(acc.advance(MS_PER_TICK * 0.5)).toBe(0);
    expect(acc.advance(MS_PER_TICK * 0.5)).toBe(1); // remainder carried over
  });

  it('clamps runaway frames', () => {
    const acc = new TickAccumulator(30);
    expect(acc.advance(60_000)).toBe(30);
  });
});

describe('rng', () => {
  it('is deterministic for a given state', () => {
    const a = createInitialState(12345);
    const b = createInitialState(12345);
    for (let i = 0; i < 10; i++) expect(rand(a)).toBe(rand(b));
  });

  it('randInt stays in range', () => {
    const s = createInitialState(1);
    for (let i = 0; i < 200; i++) {
      const n = randInt(s, 2, 5);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(5);
    }
  });

  it('weightedPick honors zero-ish weights', () => {
    const s = createInitialState(2);
    const picks = new Set<string>();
    for (let i = 0; i < 300; i++) {
      picks.add(weightedPick(s, [
        { id: 'a', weight: 1 },
        { id: 'b', weight: 0 },
      ]).id);
    }
    expect(picks.has('b')).toBe(false);
  });
});

// Content cross-reference checks live in tests/content.test.ts (the content linter).
