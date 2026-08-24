import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { getDerivedStats, BASE_ACTION_BAR } from '../src/core/systems/derived';
import { attrXpNeeded } from '../src/core/systems/attributes';
import { activityCost, activityFillRate, currentActivity } from '../src/core/systems/actions';
import { migrate } from '../src/core/save/migrations';

describe('attribute training rank bonuses', () => {
  it('reaching a rank grants its bonuses through the modifier pipeline', () => {
    const g = new Game(createInitialState(60));
    g.state.attrs.str.level = 20;
    const before = getDerivedStats(g.state).damage;

    g.state.attrs.str.level = 21; // Intermediate: +2 flat damage
    const after = getDerivedStats(g.state).damage;
    // +1 trained STR (×1.2, compounded by the two ×1.01 milestones) plus the +2 rank bonus.
    expect(after - before).toBeCloseTo(1.2 * 1.01 ** 2 + 2, 5);
  });

  it('rank bonuses are cumulative and include multipliers', () => {
    const g = new Game(createInitialState(61));
    g.state.attrs.str.level = 41; // Intermediate (+2) AND Advanced (+4, +5%)
    const stats = getDerivedStats(g.state);
    const effStr = 45 * 1.01 ** 4; // 41 + 4 flat milestones, ×1.01^4
    const base = 2 + effStr * 1.2;
    expect(stats.damage).toBeCloseTo((base + 2 + 4) * 1.05, 5);
  });

  it('ranks read the TRAINED level, not the effective value', () => {
    const g = new Game(createInitialState(62));
    g.state.attrs.con.level = 19;
    // +5 effective CON from a buff must NOT trip the level-21 rank.
    g.state.combat = {
      enemies: [null, null, null, null, null], playerBar: 0, momentum: 0, position: 'neutral', cooldowns: {}, events: {},
      buffs: [{ name: 'Stoneskin', mods: [{ stat: 'con', op: 'add', value: 5 }], ticksLeft: 10 }],
    };
    const withBuff = getDerivedStats(g.state).maxHp;
    // effective CON = (19 + 5 buff + 2 milestones) ×1.01 — but no +20 rank HP.
    // Pool capacities floor, so this is the whole-number capacity.
    expect(withBuff).toBe(Math.floor(40 + 26 * 1.01 * 10));
  });

  it('milestones grant flat and % attribute bonuses between ranks', () => {
    const g = new Game(createInitialState(64));
    g.state.attrs.str.level = 4;
    expect(getDerivedStats(g.state).damage).toBeCloseTo(2 + 4 * 1.2, 5); // none below Lv 5
    g.state.attrs.str.level = 5;
    expect(getDerivedStats(g.state).damage).toBeCloseTo(2 + (5 + 1) * 1.2, 5); // +1 STR at 5
    g.state.attrs.str.level = 10;
    expect(getDerivedStats(g.state).damage).toBeCloseTo(2 + 11 * 1.01 * 1.2, 5); // +1% STR at 10
  });

  it("Wraith's Dexterity (81) shrinks the action bar below baseline", () => {
    const g = new Game(createInitialState(63));
    expect(getDerivedStats(g.state).actionBar).toBe(BASE_ACTION_BAR);
    g.state.attrs.dex.level = 81;
    expect(getDerivedStats(g.state).actionBar).toBeCloseTo(BASE_ACTION_BAR * 0.92, 5);
  });
});

describe('action bars for activities (chunked rewards)', () => {
  it('training pays XP only when a rep completes, in one chunk', () => {
    const g = new Game(createInitialState(70));
    g.state.spot = 'training_grounds';
    g.selectActivity('train_str');

    const stats = getDerivedStats(g.state);
    const act = currentActivity(g.state)!;
    const ticksPerRep = Math.ceil(activityCost(act, stats) / activityFillRate(act, stats, g.state));
    expect(ticksPerRep).toBeGreaterThan(1);

    for (let i = 0; i < ticksPerRep - 1; i++) g.tick();
    expect(g.state.attrs.str.xp).toBe(0); // nothing mid-rep
    expect(g.state.attrs.str.level).toBe(1);

    g.tick(); // rep completes
    const gained = g.state.attrs.str.xp + (g.state.attrs.str.level > 1 ? 20 : 0);
    expect(gained).toBeGreaterThan(0);
  });

  it('gathering yields the material and its XP as one chunk per completion', () => {
    const g = new Game(createInitialState(71));
    g.state.spot = 'malgeri_base';
    g.selectActivity('mine_scree');

    // The rate is not fixed across the cycle — Mining manifests on the first
    // tick and its speed factor kicks in — so walk the bar instead of
    // precomputing a tick count.
    const fillsThisTick = () => {
      const stats = getDerivedStats(g.state);
      const act = currentActivity(g.state)!;
      return g.state.activityProgress + activityFillRate(act, stats, g.state) >= activityCost(act, stats);
    };

    let guard = 0;
    while (!fillsThisTick() && guard++ < 1000) {
      g.tick();
      // Mid-cycle ticks pay nothing at all, however fast the bar is moving.
      expect(g.state.materials['iron_scrap'] ?? 0).toBe(0);
      expect(g.state.attrs.wis.xp).toBe(0);
    }
    expect(guard).toBeLessThan(1000);

    g.tick();
    // Chunked payout: at least the base yield lands on completion (output
    // factors can add more, but never less).
    expect(g.state.materials['iron_scrap'] ?? 0).toBeGreaterThanOrEqual(1);
  });

  it('a faster speed stat completes actions sooner', () => {
    // Lifetime XP across level-ups: current xp + everything spent on levels.
    function totalXp(level: number, xp: number): number {
      let sum = xp;
      for (let l = 1; l < level; l++) sum += attrXpNeeded(l);
      return sum;
    }
    const slow = new Game(createInitialState(72));
    const fast = new Game(createInitialState(72));
    fast.state.attrs.dex.level = 50;
    for (const g of [slow, fast]) {
      g.state.spot = 'training_grounds';
      g.selectActivity('train_str');
    }
    for (let i = 0; i < 200; i++) {
      slow.tick();
      fast.tick();
    }
    expect(totalXp(fast.state.attrs.str.level, fast.state.attrs.str.xp)).toBeGreaterThan(
      totalXp(slow.state.attrs.str.level, slow.state.attrs.str.xp),
    );
  });
});

describe('save migration v5 → v6', () => {
  it('resets in-flight activity progress (ticks became units)', () => {
    const raw = { version: 5, activityProgress: 137 } as Record<string, unknown>;
    migrate(raw, 6);
    expect(raw.activityProgress).toBe(0);
    expect(raw.version).toBe(6);
  });
});
