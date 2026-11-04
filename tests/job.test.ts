import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { getDerivedStats } from '../src/core/systems/derived';
import { TPS } from '../src/core/engine/loop';
import type { GameState } from '../src/core/types';
import { currentJob, type Job, type JobKind } from '../src/ui/lib/job';
import {
  RATE_MIN_SPAN_TICKS,
  RATE_WINDOW_TICKS,
  RateMeter,
} from '../src/ui/lib/rates.svelte';

/** A post-tutorial game standing at the base's training area (a drill and a dummy to hunt). */
function atTraining(seed = 1): Game {
  const g = new Game(createInitialState(seed));
  g.state.stats['flag:tutorial_done'] = 1;
  g.state.spot = 'base_training_area';
  return g;
}

function expectBar(job: Job): void {
  if (job.pct !== null) {
    expect(job.pct, job.kind).toBeGreaterThanOrEqual(0);
    expect(job.pct, job.kind).toBeLessThanOrEqual(1);
    expect(Number.isFinite(job.pct), job.kind).toBe(true);
  }
  if (job.ticksLeft !== null) expect(job.ticksLeft, job.kind).toBeGreaterThanOrEqual(0);
  expect(job.name.length, job.kind).toBeGreaterThan(0);
  expect(job.tip.length, job.kind).toBeGreaterThan(0);
}

describe('currentJob', () => {
  it('reads idle with no bar when nothing runs', () => {
    const g = atTraining();
    const job = currentJob(g.state);
    expect(job.kind).toBe('idle');
    expect(job.pct).toBeNull();
    expect(job.detail).toBeNull();
    expectBar(job);
  });

  it('shows an activity cycle: the share done and the time left', () => {
    const g = atTraining();
    g.selectActivity('drill_forms');
    const start = currentJob(g.state);
    expect(start.kind).toBe('activity');
    expect(start.name).toBe('Drill Forms');
    expect(start.pct).toBe(0);
    expect(start.ticksLeft).toBeGreaterThan(0);
    let highest = 0;
    for (let i = 0; i < 20; i++) {
      g.tick();
      const job = currentJob(g.state);
      expectBar(job);
      expect(job.kind).toBe('activity');
      highest = Math.max(highest, job.pct!);
    }
    expect(highest).toBeGreaterThan(0);
  });

  it('agrees with the stats it is given', () => {
    const g = atTraining();
    g.selectActivity('drill_forms');
    g.tick();
    expect(currentJob(g.state, getDerivedStats(g.state))).toEqual(currentJob(g.state));
  });

  it('shows a hunt with no cycle bar between fights, then the front foe’s HP in a fight', () => {
    const g = atTraining();
    g.selectActivity('hunt');
    const between = currentJob(g.state);
    expect(between.kind).toBe('activity');
    expect(between.pct).toBeNull();
    expectBar(between);

    for (let i = 0; i < 5_000 && !g.state.combat; i++) g.tick();
    expect(g.state.combat).toBeTruthy();
    const fight = currentJob(g.state);
    expect(fight.kind).toBe('combat');
    expect(fight.name).toBe('Work the Dummies');
    expect(fight.pct).toBe(1);
    expectBar(fight);

    // Half the front foe's HP gone: the bar reads half.
    const front = g.state.combat!.enemies[0]!;
    front.hp = front.hp / 2;
    expect(currentJob(g.state).pct).toBeCloseTo(0.5, 5);
    front.hp = 0;
    expect(currentJob(g.state).pct).toBe(0);
    front.hp = -50; // overkill never reads below the bar
    expect(currentJob(g.state).pct).toBe(0);
  });

  it('shows a combat bar of null when no foe is up front', () => {
    const g = atTraining();
    g.selectActivity('hunt');
    for (let i = 0; i < 5_000 && !g.state.combat; i++) g.tick();
    g.state.combat!.enemies[0] = null;
    const job = currentJob(g.state);
    expect(job.kind).toBe('combat');
    expect(job.pct).toBeNull();
    expectBar(job);
  });

  it('shows the walk, a knockout, a performance, bench work and rest-before-a-fight', () => {
    const cases: { kind: JobKind; set: (s: GameState) => void; bar: number | null }[] = [
      {
        kind: 'travel',
        set: (s) => (s.travel = { from: 'base_training_area', to: 'base_arcane_library', ticksLeft: 25, total: 100 }),
        bar: 0.75,
      },
      {
        kind: 'performance',
        set: (s) => (s.performance = { compositionId: 1, spot: s.spot, ticksLeft: 30, ticksTotal: 120 }),
        bar: 0.75,
      },
      {
        kind: 'benchWork',
        set: (s) =>
          (s.benchWork = {
            disciplineId: 'mutagens',
            spot: s.spot,
            placement: {},
            remaining: null,
            ticksLeft: 10,
            ticksPer: 40,
            batch: 1,
            done: 0,
          }),
        bar: 0.75,
      },
    ];
    for (const c of cases) {
      const g = atTraining();
      c.set(g.state);
      const job = currentJob(g.state);
      expect(job.kind).toBe(c.kind);
      expect(job.pct).toBeCloseTo(c.bar!, 5);
      expect(job.ticksLeft).not.toBeNull();
      expectBar(job);
    }

    const down = atTraining();
    down.state.recovering = true;
    down.state.resources.hp = getDerivedStats(down.state).maxHp * 0.25;
    const knocked = currentJob(down.state);
    expect(knocked.kind).toBe('recovering');
    expect(knocked.pct).toBeCloseTo(0.25, 2);
    expectBar(knocked);

    const tired = atTraining();
    tired.selectActivity('hunt');
    tired.state.huntRest = { at: 0.8, toFull: true, active: true };
    tired.state.resources.hp = getDerivedStats(tired.state).maxHp * 0.5;
    const resting = currentJob(tired.state);
    expect(resting.kind).toBe('resting');
    expect(resting.pct).toBeCloseTo(0.5, 2);
    expect(resting.name).toBe('Resting before the next fight');
    expectBar(resting);
  });

  it('keeps pct inside 0..1 or null across a long mixed run', () => {
    const g = atTraining(5);
    g.state.level = 30;
    const picks = ['drill_forms', 'hunt', null, 'hunt', 'drill_forms'];
    for (const pick of picks) {
      g.selectActivity(pick);
      for (let i = 0; i < 400; i++) {
        g.tick();
        expectBar(currentJob(g.state));
      }
    }
  });

  it('puts the walk before a knockout, a knockout before everything it interrupts', () => {
    const g = atTraining();
    g.selectActivity('drill_forms');
    g.state.recovering = true;
    expect(currentJob(g.state).kind).toBe('recovering');
    g.state.travel = { from: 'a', to: 'b', ticksLeft: 5, total: 10 };
    expect(currentJob(g.state).kind).toBe('travel');
  });
});

describe('the rate chip', () => {
  /** Feed the meter one sample a second for `seconds`, earning 10 gold and 1 kill per second. */
  function feed(m: RateMeter, from: number, seconds: number, prestige = 0): { tick: number; gold: number; kills: number } {
    let tick = from;
    let gold = (from / TPS) * 10;
    let kills = from / TPS;
    for (let i = 0; i < seconds; i++) {
      tick += TPS;
      gold += 10;
      kills += 1;
      m.sample(tick, gold, kills, prestige, false);
    }
    return { tick, gold, kills };
  }

  it('reads blank until the window spans enough game time', () => {
    const m = new RateMeter();
    feed(m, 0, 20);
    expect(m.gold).toBeNull();
    expect(m.kills).toBeNull();
    feed(m, 200, RATE_MIN_SPAN_TICKS / TPS);
    expect(m.gold).not.toBeNull();
  });

  it('reports per-minute figures over the last 600 ticks', () => {
    const m = new RateMeter();
    feed(m, 0, 120);
    // 10 gold and 1 kill per second: 600 gold and 60 kills per minute.
    expect(m.gold).toBeCloseTo(600, 5);
    expect(m.kills).toBeCloseTo(60, 5);
  });

  it('forgets what is older than the window', () => {
    const m = new RateMeter();
    const end = feed(m, 0, 120);
    // Earnings double from here on: after a full window the old rate is gone.
    let { tick, gold, kills } = end;
    for (let i = 0; i < RATE_WINDOW_TICKS / TPS + 5; i++) {
      tick += TPS;
      gold += 20;
      kills += 2;
      m.sample(tick, gold, kills, 0, false);
    }
    expect(m.gold).toBeCloseTo(1200, 0);
    expect(m.kills).toBeCloseTo(120, 0);
  });

  it('stays at its figure while paused, and stepping while paused keeps it', () => {
    const m = new RateMeter();
    const end = feed(m, 0, 120);
    const before = { gold: m.gold, kills: m.kills };
    expect(before.gold).not.toBeNull();

    // The player pauses and steps 25 ticks, 1 s at a time, with counters moving.
    let { tick, gold, kills } = end;
    for (let i = 0; i < 25; i++) {
      tick += TPS;
      gold += 500;
      kills += 9;
      m.sample(tick, gold, kills, 0, true);
    }
    expect({ gold: m.gold, kills: m.kills }).toEqual(before);

    // Resuming picks the window up where it stood; nothing was cleared.
    m.sample(tick + TPS, gold + 10, kills + 1, 0, false);
    expect(m.gold).not.toBeNull();
  });

  it('clears on a jump of more than 600 ticks', () => {
    const m = new RateMeter();
    const end = feed(m, 0, 120);
    expect(m.gold).not.toBeNull();
    // 5,000 ticks at once (an offline catch-up): the old window says nothing about now.
    m.sample(end.tick + 5_000, end.gold + 9_999, end.kills + 999, 0, false);
    expect(m.gold).toBeNull();
    expect(m.kills).toBeNull();
    // The sample that cleared it starts the new window.
    feed(m, end.tick + 5_000, 60);
    expect(m.gold).not.toBeNull();
  });

  it('keeps its figure across a jump of exactly 600 ticks', () => {
    const m = new RateMeter();
    const end = feed(m, 0, 120);
    m.sample(end.tick + RATE_WINDOW_TICKS, end.gold + 100, end.kills + 10, 0, false);
    expect(m.gold).not.toBeNull();
  });

  it('clears when the prestige count changes', () => {
    const m = new RateMeter();
    const end = feed(m, 0, 120);
    expect(m.gold).not.toBeNull();
    m.sample(end.tick + TPS, end.gold + 10, end.kills + 1, 1, false);
    expect(m.gold).toBeNull();
    expect(m.kills).toBeNull();
  });

  it('clears on a sample lower than the one before it, and never reads negative', () => {
    for (const lower of [
      (e: { gold: number; kills: number }) => [e.gold - 1, e.kills],
      (e: { gold: number; kills: number }) => [e.gold, e.kills - 1],
      (e: { gold: number; kills: number }) => [0, 0],
    ]) {
      const m = new RateMeter();
      const end = feed(m, 0, 120);
      const [gold, kills] = lower(end);
      m.sample(end.tick + TPS, gold, kills, 0, false);
      expect(m.gold).toBeNull();
      expect(m.kills).toBeNull();
    }
    // Climbing again from the lower sample reads from that sample on.
    const m = new RateMeter();
    const end = feed(m, 0, 120);
    m.sample(end.tick + TPS, 0, 0, 0, false);
    let { tick } = { tick: end.tick + TPS };
    let gold = 0;
    let kills = 0;
    for (let i = 0; i < 40; i++) {
      tick += TPS;
      gold += 10;
      kills += 1;
      m.sample(tick, gold, kills, 0, false);
    }
    expect(m.gold).toBeCloseTo(600, 5);
    expect(m.gold!).toBeGreaterThanOrEqual(0);
  });

  it('ignores samples closer than a second apart', () => {
    const m = new RateMeter();
    const end = feed(m, 0, 120);
    const before = m.gold;
    m.sample(end.tick + 1, end.gold + 5000, end.kills + 500, 0, false);
    expect(m.gold).toBe(before);
  });

  it('clear() empties the window', () => {
    const m = new RateMeter();
    feed(m, 0, 120);
    m.clear();
    expect(m.gold).toBeNull();
    expect(m.kills).toBeNull();
  });
});
