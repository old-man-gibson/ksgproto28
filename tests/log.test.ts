import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import {
  appendFeed,
  appendLog,
  FEED_MAX,
  feedFloating,
  feedRepeat,
  LOG_MAX,
  renderLine,
  settleFloating,
} from '../src/core/systems/log';
import { applyStatus } from '../src/core/systems/statuses';
import type { GameState, LogEntry, LogTally } from '../src/core/types';

function line(group: string | undefined, prefix: string, tally: LogTally[], t = 0): LogEntry {
  return { msg: renderLine(prefix, tally), kind: 'loot', t, group, prefix, tally };
}

function msgs(state: GameState): string[] {
  return state.log.map((l) => l.msg);
}

describe('log line rendering', () => {
  it('counts things and reads amounts the other way round', () => {
    expect(renderLine('🔨 Crafted', [{ label: '🪨 Iron Ingot', qty: 1 }])).toBe(
      '🔨 Crafted 🪨 Iron Ingot',
    );
    expect(renderLine('🔨 Crafted', [{ label: '🪨 Iron Ingot', qty: 12 }])).toBe(
      '🔨 Crafted 🪨 Iron Ingot ×12',
    );
    expect(renderLine('💰 Shift pay:', [{ label: 'gold', qty: 500, style: 'amount' }])).toBe(
      '💰 Shift pay: 500 gold',
    );
  });
});

describe('repeat grouping', () => {
  it('folds repeats into a running count instead of a new line', () => {
    const s = createInitialState(1);
    for (let i = 0; i < 5; i++) {
      appendLog(s, line('act:mine', '🧺 Gathered:', [{ label: '🪨 Iron Ore', qty: 1 }], i));
    }
    expect(msgs(s)).toEqual(['🧺 Gathered: 🪨 Iron Ore ×5']);
  });

  it('keeps a separate count per output when a run yields several things', () => {
    const s = createInitialState(1);
    const g = 'act:orchard';
    // 100 runs: gold every other time, an apple most times, a rare golden one.
    for (let i = 0; i < 50; i++) {
      appendLog(s, line(g, '🧺 Gathered:', [{ label: 'gold', qty: 10, style: 'amount' }]));
    }
    for (let i = 0; i < 75; i++) {
      appendLog(s, line(g, '🧺 Gathered:', [{ label: '🍎 Apple', qty: 1 }]));
    }
    for (let i = 0; i < 2; i++) {
      appendLog(s, line(g, '🧺 Gathered:', [{ label: '✨ Golden Apple', qty: 1 }]));
    }
    expect(msgs(s)).toEqual(['🧺 Gathered: 500 gold, 🍎 Apple ×75, ✨ Golden Apple ×2']);
  });

  it('ends the run when anything else is logged in between', () => {
    const s = createInitialState(1);
    const gathered = () => line('act:mine', '🧺 Gathered:', [{ label: '🪨 Iron Ore', qty: 1 }]);
    appendLog(s, gathered());
    appendLog(s, gathered());
    appendLog(s, { msg: '📈 Mining level 5!', kind: 'skill', t: 0 });
    appendLog(s, gathered());
    expect(msgs(s)).toEqual([
      '🧺 Gathered: 🪨 Iron Ore ×2',
      '📈 Mining level 5!',
      '🧺 Gathered: 🪨 Iron Ore',
    ]);
  });

  it('never merges across different groups', () => {
    const s = createInitialState(1);
    appendLog(s, line('act:mine', '🧺 Gathered:', [{ label: '🪨 Iron Ore', qty: 1 }]));
    appendLog(s, line('act:woodcut', '🧺 Gathered:', [{ label: '🪵 Hardwood', qty: 1 }]));
    expect(msgs(s)).toHaveLength(2);
  });

  it('leaves ungrouped lines alone', () => {
    const s = createInitialState(1);
    appendLog(s, { msg: 'You arrive.', kind: 'travel', t: 0 });
    appendLog(s, { msg: 'You arrive.', kind: 'travel', t: 1 });
    expect(msgs(s)).toHaveLength(2);
  });

  it('carries the timestamp forward so a folded line reads as recent', () => {
    const s = createInitialState(1);
    appendLog(s, line('act:mine', '🧺 Gathered:', [{ label: '🪨 Iron Ore', qty: 1 }], 10));
    appendLog(s, line('act:mine', '🧺 Gathered:', [{ label: '🪨 Iron Ore', qty: 1 }], 99));
    expect(s.log[0].t).toBe(99);
  });

  it('still trims the feed to LOG_MAX', () => {
    const s = createInitialState(1);
    for (let i = 0; i < LOG_MAX + 20; i++) appendLog(s, { msg: `line ${i}`, kind: 'info', t: i });
    expect(s.log).toHaveLength(LOG_MAX);
    expect(s.log[0].msg).toBe('line 20');
  });
});

describe('fight feed grouping', () => {
  /** One tick's worth of a condition biting, as the tick paths emit it. */
  function tick(s: GameState, label: string, qty: number, group = 'cond:self') {
    feedRepeat(s, {
      group,
      prefix: '🩸 You suffer:',
      tally: [{ label, qty, style: 'amount' }],
    });
  }

  it('folds a long bleed into one running total instead of one line per tick', () => {
    const s = createInitialState(1);
    for (let i = 0; i < 15; i++) tick(s, '🩸 bleeding', 1);
    expect(s.combatFeed.map((f) => f.text)).toEqual(['🩸 You suffer: 15 🩸 bleeding']);
  });

  it('keeps each condition separate inside the one folded line', () => {
    const s = createInitialState(1);
    for (let i = 0; i < 10; i++) {
      tick(s, '🩸 bleeding', 2);
      tick(s, '🧪 poison', 1);
    }
    expect(s.combatFeed).toHaveLength(1);
    expect(s.combatFeed[0].text).toBe('🩸 You suffer: 20 🩸 bleeding, 10 🧪 poison');
  });

  it('accumulates at full precision and only rounds for display', () => {
    const s = createInitialState(1);
    // A slow bleed under a point per tick. Rounding each tick as it landed
    // would floor every one of these to zero and report damage that was
    // really taken as nothing at all.
    for (let i = 0; i < 5; i++) tick(s, '🩸 bleeding', 0.4);
    expect(s.combatFeed[0].text).toBe('🩸 You suffer: 2 🩸 bleeding');
    expect(s.combatFeed[0].tally?.[0].qty).toBeCloseTo(2);
  });

  it('ends the run when something else happens in the fight', () => {
    const s = createInitialState(1);
    tick(s, '🩸 bleeding', 3);
    s.combatFeed.push({ text: '⚔️ You strike the Rat for 12.' });
    tick(s, '🩸 bleeding', 3);
    expect(s.combatFeed.map((f) => f.text)).toEqual([
      '🩸 You suffer: 3 🩸 bleeding',
      '⚔️ You strike the Rat for 12.',
      '🩸 You suffer: 3 🩸 bleeding',
    ]);
  });

  it('never merges the player line into the enemies one', () => {
    const s = createInitialState(1);
    tick(s, '🩸 bleeding', 1, 'cond:self');
    tick(s, '🩸 Rat bleeding', 1, 'cond:foes');
    expect(s.combatFeed).toHaveLength(2);
  });

  it('does not alias the tally it was handed', () => {
    const s = createInitialState(1);
    // The tick paths rebuild their tally array every tick; the folded line must
    // own its own copy or it would go on accumulating into a caller's object.
    const mine: LogTally[] = [{ label: '🩸 bleeding', qty: 1, style: 'amount' }];
    feedRepeat(s, { group: 'cond:self', prefix: '🩸 You suffer:', tally: mine });
    feedRepeat(s, { group: 'cond:self', prefix: '🩸 You suffer:', tally: mine });
    expect(mine[0].qty).toBe(1);
    expect(s.combatFeed[0].tally?.[0].qty).toBe(2);
  });

  it('still trims the fight feed to FEED_MAX', () => {
    const s = createInitialState(1);
    for (let i = 0; i < FEED_MAX + 5; i++) {
      feedRepeat(s, { group: `g${i}`, prefix: 'x', tally: [{ label: `${i}`, qty: 1 }] });
    }
    expect(s.combatFeed).toHaveLength(FEED_MAX);
  });
});

describe('conditions in play', () => {
  it('announces damage the player takes, without taking a line to do it', () => {
    const g = new Game(createInitialState(3));
    applyStatus(g.state, g.state, { id: 'bleeding', intensity: 3 });
    for (let i = 0; i < 20; i++) g.tick();

    // The bar used to move in silence. Then it moved and said so — but folding
    // only reaches the NEWEST line, so a bleed running through an exchange was
    // broken by every swing in between. A run is now a floating total that owns
    // no line at all while it burns.
    expect(g.state.combatFeed.filter((f) => f.text.includes('You suffer'))).toHaveLength(0);
    const run = g.state.floatingFeed.find((f) => f.group === 'cond:self');
    expect(run).toBeDefined();
    expect(renderLine(run!.prefix, run!.tally)).toMatch(/^🩸 You suffer: \d+ .*bleeding$/);
    expect(run!.ids).toContain('bleeding');
  });

  it('leaves room in a ten-line feed for the fight that caused the bleed', () => {
    const g = new Game(createInitialState(3));
    applyStatus(g.state, g.state, { id: 'bleeding', intensity: 2 });
    applyStatus(g.state, g.state, { id: 'poison', intensity: 2 });
    for (let i = 0; i < 40; i++) g.tick();

    // Two conditions ticking forty times cost the feed NOTHING — FEED_MAX is
    // ten, and this is the case that used to evict the fight that caused them.
    expect(g.state.combatFeed.filter((f) => f.text.includes('You suffer'))).toHaveLength(0);
    expect(g.state.floatingFeed).toHaveLength(1);
    expect(g.state.combatFeed.length).toBeLessThan(FEED_MAX);
  });

  it('settles onto the newest line when it ends, and rides down with it', () => {
    const g = new Game(createInitialState(3));
    const s = g.state;
    appendFeed(s, { text: 'first exchange' });
    feedFloating(s, {
      group: 'cond:self',
      prefix: '🩸 You suffer:',
      tally: [{ label: '🩸 bleeding', qty: 4, style: 'amount' }],
      ids: ['bleeding'],
    });
    appendFeed(s, { text: 'second exchange' });
    // Still running: it belongs to no line yet.
    expect(s.combatFeed.some((f) => f.afflictions?.length)).toBe(false);

    settleFloating(s, 'cond:self');
    expect(s.floatingFeed).toHaveLength(0);
    // It stuck to whatever was newest at that moment — not to the line it
    // started under, which is the point of "floating".
    const stuck = s.combatFeed[s.combatFeed.length - 1];
    expect(stuck.text).toBe('second exchange');
    expect(renderLine(stuck.afflictions![0].prefix, stuck.afflictions![0].tally)).toBe(
      '🩸 You suffer: 4 🩸 bleeding',
    );

    // …and it travels with that line as the feed fills above it.
    appendFeed(s, { text: 'third exchange' });
    const carried = s.combatFeed.find((f) => f.text === 'second exchange');
    expect(carried?.afflictions).toHaveLength(1);
    expect(s.combatFeed[s.combatFeed.length - 1].afflictions).toBeUndefined();
  });

  it('becomes a line of its own only when there is nothing to stick to', () => {
    // A poison ticking out of combat, with an empty feed behind it. Dropping
    // the total on the floor would lose the only explanation for the health.
    const g = new Game(createInitialState(3));
    feedFloating(g.state, {
      group: 'cond:self',
      prefix: '🩸 You suffer:',
      tally: [{ label: '🩸 bleeding', qty: 7, style: 'amount' }],
      ids: ['bleeding'],
    });
    settleFloating(g.state, 'cond:self');
    expect(g.state.combatFeed).toHaveLength(1);
    expect(g.state.combatFeed[0].text).toBe('🩸 You suffer: 7 🩸 bleeding');
  });
});

describe('activities in play', () => {
  it('collapses a long gathering run into one line', () => {
    const g = new Game(createInitialState(7));
    g.state.spot = 'malgeri_base';
    g.selectActivity('mine_scree');
    for (let i = 0; i < 4000; i++) g.tick();

    const gathers = g.state.log.filter((l) => l.msg.startsWith('🧺 Gathered:'));
    expect(gathers.length).toBeGreaterThan(0);
    // Many cycles completed, but they occupy a handful of lines at most —
    // one per uninterrupted run between level-ups.
    const total = gathers.reduce((sum, l) => sum + (l.tally?.[0]?.qty ?? 0), 0);
    expect(total).toBeGreaterThan(gathers.length);
    expect(gathers[gathers.length - 1].msg).toMatch(/^🧺 Gathered: .+ ×\d+$/);
  });
});
