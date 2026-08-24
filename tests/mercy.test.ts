import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { migrate } from '../src/core/save/migrations';
import {
  MERCY,
  MERCY_MAX_RATE,
  PROC_CAP_MAX,
  PROC_MIN_RATE,
  mercyChance,
  mercyCurve,
  mercyPick,
  mercyRate,
  mercyTracked,
  procChance,
  procRate,
  procTracked,
} from '../src/core/engine/mercy';
import { rand } from '../src/core/engine/rng';
import type { GameState } from '../src/core/types';

/** Long-run rate a curve actually delivers, computed rather than sampled. */
function achievedRate(base: number, slope: number, cap = 1): number {
  let sum = 0;
  let survival = 1;
  for (let n = 0; n < 500_000 && survival > 1e-13; n++) {
    sum += survival;
    const p = Math.min(cap, base + n * slope);
    if (p >= 1) break;
    survival *= 1 - p;
  }
  return 1 / sum;
}

/** Wait-length percentiles under a curve. */
function percentile(base: number, slope: number, q: number): number {
  let survival = 1;
  for (let n = 1; n < 500_000; n++) {
    survival *= 1 - Math.min(1, base + (n - 1) * slope);
    if (1 - survival >= q) return n;
  }
  return Infinity;
}

const RATES = [0.15, 0.12, 0.05, 0.04, 0.03, 0.02, 0.01, 0.005, 0.001];

describe('the mercy curve', () => {
  it('holds the authored rate exactly, at every rate and every mercy', () => {
    for (const rate of RATES) {
      for (const mercy of [0.25, 0.5, MERCY, 1]) {
        const { base, slope } = mercyCurve(rate, mercy);
        // Solved, not fitted: a hand-picked coefficient would drift by tens of
        // percent across this range, which is the whole reason this is a
        // bisection and not a constant.
        expect(achievedRate(base, slope) / rate, `rate ${rate} mercy ${mercy}`).toBeCloseTo(1, 5);
      }
    }
  });

  it('starts below nominal and climbs, never past certainty', () => {
    const { base, slope } = mercyCurve(0.01);
    expect(base).toBeLessThan(0.01);
    expect(slope).toBeGreaterThan(0);
    const s = createInitialState(1);
    let last = -1;
    for (const misses of [0, 1, 10, 100, 1000, 100000]) {
      s.mercy['k'] = misses;
      const p = mercyRate(s, 'k', 0.01);
      expect(p).toBeGreaterThan(last);
      expect(p).toBeLessThanOrEqual(1);
      last = p;
    }
  });

  it('cuts the tail, and moves the median the other way', () => {
    // The trade, asserted so that nobody re-tunes MERCY believing it is free.
    const plain = { base: 0.01, slope: 0 };
    const merciful = mercyCurve(0.01);
    expect(percentile(merciful.base, merciful.slope, 0.99)).toBeLessThan(
      percentile(plain.base, plain.slope, 0.99) * 0.6,
    );
    expect(percentile(merciful.base, merciful.slope, 0.999)).toBeLessThan(
      percentile(plain.base, plain.slope, 0.999) * 0.5,
    );
    expect(percentile(merciful.base, merciful.slope, 0.5)).toBeGreaterThan(
      percentile(plain.base, plain.slope, 0.5),
    );
  });

  it('leaves common rates alone', () => {
    expect(mercyTracked(MERCY_MAX_RATE)).toBe(false);
    expect(mercyTracked(0.25)).toBe(false);
    expect(mercyTracked(0)).toBe(false);
    expect(mercyTracked(0.01)).toBe(true);
    const s = createInitialState(2);
    s.mercy['k'] = 500;
    expect(mercyRate(s, 'k', 0.25)).toBe(0.25);
  });
});

describe('mercy in the stream', () => {
  it('delivers the authored rate over a long run, and bounds the drought', () => {
    const s = createInitialState(7);
    const RATE = 0.02;
    const N = 200_000;
    let hits = 0;
    let dry = 0;
    let worst = 0;
    for (let i = 0; i < N; i++) {
      if (mercyChance(s, 'gene:wolf', RATE)) {
        hits++;
        worst = Math.max(worst, dry);
        dry = 0;
      } else dry++;
    }
    expect(hits / N).toBeGreaterThan(RATE * 0.93);
    expect(hits / N).toBeLessThan(RATE * 1.07);
    // Plain geometric over this many trials would be near-certain to show a
    // drought past 400 (the 99.97th percentile is 400 at 2%).
    expect(worst).toBeLessThan(300);
  });

  it('clears the key on a hit and never leaves one behind', () => {
    const s = createInitialState(11);
    for (let i = 0; i < 5000; i++) {
      if (mercyChance(s, 'k', 0.05)) expect(s.mercy['k']).toBeUndefined();
    }
    // Both above and below the tracking threshold, a hit pays the debt off.
    s.mercy['loose'] = 40;
    let cleared = false;
    for (let i = 0; i < 200 && !cleared; i++) cleared = mercyChance(s, 'loose', 0.5);
    expect(cleared).toBe(true);
    expect(s.mercy['loose']).toBeUndefined();
  });

  it('escalates only what missed', () => {
    const s = createInitialState(3);
    mercyChance(s, 'a', 0.01);
    expect(s.mercy['a']).toBe(1);
    expect(Object.keys(s.mercy)).toEqual(['a']);
  });
});

describe('mercy on a weighted table', () => {
  const table = [
    { id: 'common', weight: 60 },
    { id: 'rare', weight: 3 },
    { id: 'veryrare', weight: 1 },
    { id: 'nothing', weight: 36 },
  ];
  const keyOf = (e: { id: string }, rate: number) =>
    e.id !== 'nothing' && mercyTracked(rate) ? `loot:${e.id}` : null;

  it('keeps every entry on its authored share', () => {
    const s = createInitialState(21);
    const counts: Record<string, number> = {};
    const N = 200_000;
    for (let i = 0; i < N; i++) {
      const pick = mercyPick(s, table, keyOf);
      counts[pick.id] = (counts[pick.id] ?? 0) + 1;
    }
    for (const e of table) {
      expect(counts[e.id] / N, `${e.id} share`).toBeCloseTo(e.weight / 100, 2);
    }
  });

  it('protects the rare lines and lets the common one alone', () => {
    const s = createInitialState(22);
    for (let i = 0; i < 500; i++) mercyPick(s, table, keyOf);
    expect(Object.keys(s.mercy).sort()).toEqual(['loot:rare', 'loot:veryrare']);
  });

  it('bounds the drought on the rarest line', () => {
    const s = createInitialState(23);
    let dry = 0;
    let worst = 0;
    for (let i = 0; i < 200_000; i++) {
      if (mercyPick(s, table, keyOf).id === 'veryrare') {
        worst = Math.max(worst, dry);
        dry = 0;
      } else dry++;
    }
    // 1% under plain geometric would be all but certain to run past 800 here.
    expect(worst).toBeLessThan(500);
  });

  it('survives a table that is all rare lines maturing at once', () => {
    const s = createInitialState(24);
    const allRare = [
      { id: 'a', weight: 1 },
      { id: 'b', weight: 1 },
      { id: 'c', weight: 1 },
    ];
    const key = (e: { id: string }) => `x:${e.id}`;
    for (const e of allRare) s.mercy[`x:${e.id}`] = 100_000;
    const pick = mercyPick(s, allRare, key);
    expect(['a', 'b', 'c']).toContain(pick.id);
  });

  it('consumes one roll, like the plain pick it replaces', () => {
    const a = createInitialState(31);
    const b = createInitialState(31);
    mercyPick(a, table, keyOf);
    mercyPick(b, table, () => null);
    expect(a.rngState).toBe(b.rngState);
  });
});

describe('mercy on combat procs', () => {
  it('holds the authored crit rate over a long run', () => {
    const s = createInitialState(41);
    for (const rate of [0.15, 0.2, 0.3, 0.5]) {
      let hits = 0;
      const N = 100_000;
      for (let i = 0; i < N; i++) if (procChance(s, `proc:crit:${rate}`, rate)) hits++;
      expect(hits / N, `crit ${rate}`).toBeGreaterThan(rate * 0.95);
      expect(hits / N, `crit ${rate}`).toBeLessThan(rate * 1.05);
    }
  });

  it('cuts dry spells at the rates where a fight can feel them', () => {
    const s = createInitialState(42);
    let dry = 0;
    let eight = 0;
    let worst = 0;
    const N = 200_000;
    for (let i = 0; i < N; i++) {
      if (procChance(s, 'proc:crit', 0.2)) {
        worst = Math.max(worst, dry);
        dry = 0;
      } else if (++dry >= 8) eight++;
    }
    // Plain 20% spends about 17% of its swings inside a dry spell of 8+.
    expect(eight / N).toBeLessThan(0.1);
    expect(worst).toBeLessThan(25);
  });

  it('leaves the 5% floor exactly as it was — mercy there is backwards', () => {
    // Below PROC_MIN_RATE the roll must be untouched, not merely gentler:
    // over a fight's worth of swings, escalation makes short dry spells MORE
    // likely at low rates, which is the opposite of the point.
    expect(procTracked(0.05)).toBe(false);
    expect(procTracked(PROC_MIN_RATE)).toBe(true);
    const a = createInitialState(43);
    const b = createInitialState(43);
    let same = true;
    for (let i = 0; i < 2000; i++) {
      if (procChance(a, 'proc:crit', 0.05) !== (rand(b) < 0.05)) same = false;
    }
    expect(same).toBe(true);
    expect(a.mercy).toEqual({});
  });

  it('caps what a warmed-up counter can buy', () => {
    const s = createInitialState(44);
    s.mercy['proc:crit'] = 100_000;
    // No amount of swinging at a training dummy buys a certainty.
    expect(procRate(s, 'proc:crit', 0.2)).toBeCloseTo(Math.min(PROC_CAP_MAX, 0.6), 6);
    expect(procRate(s, 'proc:crit', 0.4)).toBe(PROC_CAP_MAX);
    expect(procRate(s, 'proc:crit', 0.2)).toBeLessThan(1);
  });

  it('holds its rate even against the cap', () => {
    for (const rate of [0.2, 0.3, 0.5]) {
      const c = mercyCurve(rate, MERCY, Math.min(PROC_CAP_MAX, rate * 3));
      expect(achievedRate(c.base, c.slope, c.cap) / rate, `capped ${rate}`).toBeCloseTo(1, 5);
    }
  });
});

describe('mercy in the save', () => {
  it('a fresh save has an empty ledger', () => {
    expect(createInitialState(1).mercy).toEqual({});
  });

  it('v45 saves migrate with no credit for droughts already suffered', () => {
    const raw: Record<string, unknown> = { ...(createInitialState(5) as unknown as Record<string, unknown>) };
    raw.version = 45;
    delete raw.mercy;
    const migrated = migrate(raw, 46) as GameState;
    expect(migrated.mercy).toEqual({});
  });
});
