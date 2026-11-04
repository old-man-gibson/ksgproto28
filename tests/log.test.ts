// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import {
  appendFeed,
  appendLog,
  FEED_MAX,
  feedFloating,
  feedRepeat,
  HUNT_WINDOW,
  hiddenLabels,
  LOG_LABELS_MAX,
  LOG_MAX,
  renderLine,
  settleFloating,
} from '../src/core/systems/log';
import { abandonCombat, startForcedFight, warrantsAppearsLine } from '../src/core/systems/combat';
import { MATERIALS, MODIFIER_WEIGHTS, MONSTERS, RARITY_WEIGHTS, SPOTS } from '../src/core/registry';
import { deserialize, serialize } from '../src/core/save/save';
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

describe('hunt lines fold per 30 s', () => {
  const PREFIX = '☠️ Hunt:';
  const wolf = (): LogTally[] => [
    { label: '🐺 Young Wolf', qty: 1 },
    { label: 'gold', qty: 10, style: 'amount' },
  ];
  const hunt = (tally: LogTally[], t: number): LogEntry => ({ ...line('hunt', PREFIX, tally, t), kind: 'combat' });

  it('the window is 300 ticks', () => {
    expect(HUNT_WINDOW).toBe(300);
  });

  it('folds 20 routine events inside 300 ticks into 1 line', () => {
    const s = createInitialState(1);
    for (let i = 0; i < 20; i++) appendLog(s, hunt(wolf(), i * 14));
    expect(s.log).toHaveLength(1);
    expect(s.log[0].msg).toBe('☠️ Hunt: 200 gold, 🐺 Young Wolf ×20');
    expect(s.log[0].since).toBe(0);
    expect(s.log[0].window).toBe(300);
    expect(s.log[0].t).toBe(19 * 14);
  });

  it('an equippable item line splits the run', () => {
    const s = createInitialState(1);
    appendLog(s, hunt(wolf(), 0));
    appendLog(s, hunt(wolf(), 10));
    appendLog(s, { msg: '📦 Loot: 🛡️ Leather Vest', kind: 'loot', t: 20 });
    appendLog(s, hunt(wolf(), 30));
    expect(msgs(s)).toEqual([
      '☠️ Hunt: 20 gold, 🐺 Young Wolf ×2',
      '📦 Loot: 🛡️ Leather Vest',
      '☠️ Hunt: 10 gold, 🐺 Young Wolf',
    ]);
  });

  it('a line older than 300 ticks does not absorb a new event', () => {
    const s = createInitialState(1);
    appendLog(s, hunt(wolf(), 0));
    appendLog(s, hunt(wolf(), 299));
    expect(s.log).toHaveLength(1);
    appendLog(s, hunt(wolf(), 300));
    expect(s.log).toHaveLength(2);
    expect(s.log[1].since).toBe(300);
  });

  it('measures the window from when the line opened, not from its latest event', () => {
    const s = createInitialState(1);
    appendLog(s, hunt(wolf(), 0));
    appendLog(s, hunt(wolf(), 200));
    // 400 is within 300 of the latest event (200) and not of the first (0).
    appendLog(s, hunt(wolf(), 400));
    expect(s.log).toHaveLength(2);
    expect(s.log[0].tally?.[1].qty).toBe(2);
  });

  it('reads a line that has a window and no `since` by its `t`', () => {
    const saved = (): GameState => {
      const s = createInitialState(1);
      s.log.push({ msg: '☠️ Hunt: 🐺 Young Wolf', kind: 'combat', t: 1000, group: 'hunt', prefix: PREFIX, tally: [{ label: '🐺 Young Wolf', qty: 1 }], window: 300 });
      return s;
    };
    const inside = saved();
    appendLog(inside, hunt(wolf(), 1299));
    expect(inside.log).toHaveLength(1);
    const outside = saved();
    appendLog(outside, hunt(wolf(), 1300));
    expect(outside.log).toHaveLength(2);
  });

  it('still folds a saved line that has no window for as long as it is the newest', () => {
    const s = createInitialState(1);
    s.log.push({ msg: '🧺 Gathered: 🪨 Iron Ore', kind: 'loot', t: 0, group: 'act:mine', prefix: '🧺 Gathered:', tally: [{ label: '🪨 Iron Ore', qty: 1 }] });
    appendLog(s, line('act:mine', '🧺 Gathered:', [{ label: '🪨 Iron Ore', qty: 1 }], 10_000_000));
    expect(msgs(s)).toEqual(['🧺 Gathered: 🪨 Iron Ore ×2']);
    expect(s.log[0].window).toBeUndefined();
    expect(s.log[0].since).toBeUndefined();
  });

  it('shows four labels and counts the rest', () => {
    const s = createInitialState(1);
    appendLog(s, hunt([{ label: '🐺 Young Wolf', qty: 4 }, { label: 'gold', qty: 90, style: 'amount' }], 0));
    appendLog(s, hunt([{ label: '🐀 Forest Rat', qty: 6 }, { label: 'Raw Meat (Fair)', qty: 1 }], 10));
    appendLog(s, hunt([{ label: 'Torn Fur', qty: 2 }, { label: 'Iron Scrap', qty: 1 }], 20));
    expect(LOG_LABELS_MAX).toBe(4);
    // Gold first, then the counts from the largest down.
    expect(s.log[0].msg).toBe('☠️ Hunt: 90 gold, 🐀 Forest Rat ×6, 🐺 Young Wolf ×4, Torn Fur ×2, +2 more');
    expect(hiddenLabels(s.log[0])).toEqual(['Raw Meat (Fair)', 'Iron Scrap']);
  });

  it('shows no "+N more" for exactly four labels, and hides nothing', () => {
    const s = createInitialState(1);
    appendLog(s, hunt([1, 2, 3, 4].map((n) => ({ label: `L${n}`, qty: 5 - n })), 0));
    expect(s.log[0].msg).toBe('☠️ Hunt: L1 ×4, L2 ×3, L3 ×2, L4');
    expect(hiddenLabels(s.log[0])).toEqual([]);
  });

  it('hides nothing on a line with no window', () => {
    const s = createInitialState(1);
    for (let i = 0; i < 6; i++) appendLog(s, line('act:mine', '🧺 Gathered:', [{ label: `L${i}`, qty: 1 }]));
    expect(s.log[0].msg).toBe('🧺 Gathered: L0, L1, L2, L3, L4, L5');
    expect(hiddenLabels(s.log[0])).toEqual([]);
  });

  it('does not alias the tally it was handed', () => {
    const s = createInitialState(1);
    const mine = wolf();
    appendLog(s, hunt(mine, 0));
    appendLog(s, hunt(wolf(), 10));
    expect(mine[0].qty).toBe(1);
    expect(s.log[0].tally?.find((t) => t.label === '🐺 Young Wolf')?.qty).toBe(2);
  });

  it('keeps `since` and `window` through a save, and loads a save without them', () => {
    const s = createInitialState(1);
    appendLog(s, hunt(wolf(), 5));
    const loaded = deserialize(serialize(s, 0));
    expect(loaded.log[0]).toMatchObject({ since: 5, window: 300, group: 'hunt' });

    // A line written before either field existed loads as it was written.
    const old = JSON.parse(serialize(s, 0));
    old.log = [{ msg: '🧺 Gathered: 🪨 Iron Ore ×3', kind: 'loot', t: 40, group: 'act:mine', prefix: '🧺 Gathered:', tally: [{ label: '🪨 Iron Ore', qty: 3 }] }];
    const legacy = deserialize(JSON.stringify(old));
    expect(legacy.log[0].since).toBeUndefined();
    expect(legacy.log[0].window).toBeUndefined();
    appendLog(legacy, line('act:mine', '🧺 Gathered:', [{ label: '🪨 Iron Ore', qty: 1 }], 41));
    expect(msgs(legacy)).toEqual(['🧺 Gathered: 🪨 Iron Ore ×4']);
  });
});

describe('hunting in play', () => {
  function huntingGame(seed = 7) {
    const g = new Game(createInitialState(seed));
    g.state.spot = 'woods_edge';
    g.equip(1);
    g.selectActivity('hunt');
    return g;
  }

  it('writes one line per window, not one line per kill', () => {
    const g = huntingGame();
    const killed: string[] = [];
    g.bus.on('kill', (ev) => killed.push(`${ev.monster.icon} ${ev.monster.name}`));
    for (let i = 0; i < 30000 && killed.length < 14; i++) {
      g.tick();
      // A knockout ends the activity and moves the character; go back to hunting.
      if (!g.state.recovering && g.state.spot !== 'woods_edge') {
        g.state.spot = 'woods_edge';
        g.selectActivity('hunt');
      }
    }
    expect(killed.length).toBe(14);

    const hunts = g.state.log.filter((l) => l.group === 'hunt');
    expect(hunts.length).toBeGreaterThan(0);
    // The per-kill, per-drop lines are gone from the main log.
    expect(g.state.log.filter((l) => /Defeated|Scavenged|^📦 [^L]/.test(l.msg))).toEqual([]);
    // No kill is lost in the fold: the tallies add up to the kills.
    const names = new Set(killed);
    const tallied = hunts
      .flatMap((l) => l.tally ?? [])
      .filter((t) => names.has(t.label))
      .reduce((n, t) => n + t.qty, 0);
    expect(tallied).toBe(killed.length);
    // So does the gold.
    const gold = hunts
      .flatMap((l) => l.tally ?? [])
      .filter((t) => t.label === 'gold')
      .reduce((n, t) => n + t.qty, 0);
    expect(gold).toBe(g.state.stats['gold:earned'] ?? 0);
    // Each line spans less than a window.
    for (const l of hunts) expect(l.t - (l.since ?? l.t)).toBeLessThan(HUNT_WINDOW);
  });

  describe('"appears" lines', () => {
    const appears = (g: Game) => g.state.log.filter((l) => /appears?!$/.test(l.msg));

    /** Runs `fn` with the spawn rolls pinned to one modifier and one rarity. */
    function pinned(modifier: string, rarity: string, fn: () => void): void {
      const mods = MODIFIER_WEIGHTS.splice(0, MODIFIER_WEIGHTS.length, { id: modifier, weight: 1 });
      const rars = RARITY_WEIGHTS.splice(0, RARITY_WEIGHTS.length, { id: rarity, weight: 1 });
      try {
        fn();
      } finally {
        MODIFIER_WEIGHTS.splice(0, MODIFIER_WEIGHTS.length, ...mods);
        RARITY_WEIGHTS.splice(0, RARITY_WEIGHTS.length, ...rars);
      }
    }

    /** Twenty encounters at the spot, each ended before the next. */
    function meet(g: Game): void {
      let met = 0;
      g.bus.on('encounter', () => met++);
      for (let i = 0; i < 20; i++) {
        startForcedFight(g.state, g.bus, SPOTS.woods_edge);
        abandonCombat(g.state, g.bus);
      }
      // A run that met nobody would pass every "no line" case below for free.
      expect(met).toBe(20);
    }

    const woodsGame = () => {
      const g = new Game(createInitialState(3));
      g.state.spot = 'woods_edge';
      return g;
    };

    it.each([
      ['normal', 'common'],
      ['normal', 'uncommon'],
      ['normal', 'rare'],
      ['demiboss', 'common'],
      ['demiboss', 'rare'],
    ])('drops the line for a %s %s spawn', (modifier, rarity) => {
      const g = woodsGame();
      pinned(modifier, rarity, () => meet(g));
      expect(appears(g)).toEqual([]);
    });

    it.each([
      ['boss', 'common'],
      ['aberrant', 'common'],
      ['normal', 'epic'],
    ])('keeps the line for a %s %s spawn', (modifier, rarity) => {
      const g = woodsGame();
      pinned(modifier, rarity, () => meet(g));
      expect(appears(g).length).toBeGreaterThan(0);
    });

    it('keeps the line for a spot keeper that rolled nothing notable', () => {
      // The chief's tent forces every modifier to normal. The chief rolls common
      // and has two escorts; the line still names him.
      const spot = SPOTS.f7_chiefs_tent;
      const g = new Game(createInitialState(3));
      g.state.spot = spot.id;
      g.state.stats['band:pos:ascent_f7'] = 1;
      const rars = RARITY_WEIGHTS.splice(0, RARITY_WEIGHTS.length, { id: 'common', weight: 1 });
      try {
        startForcedFight(g.state, g.bus, spot);
      } finally {
        RARITY_WEIGHTS.splice(0, RARITY_WEIGHTS.length, ...rars);
      }
      expect(g.state.combat).not.toBeNull();
      const lines = appears(g);
      expect(lines).toHaveLength(1);
      expect(lines[0].msg).toContain('Bandit Chief');
    });

    it('decides by modifier, rarity and the spot keeper row', () => {
      const m = (modifier: string, rarity: string, spot?: Parameters<typeof warrantsAppearsLine>[1]) =>
        warrantsAppearsLine({ modifier, rarity, defId: 'x' } as Parameters<typeof warrantsAppearsLine>[0], spot);
      expect(m('normal', 'common')).toBe(false);
      expect(m('normal', 'uncommon')).toBe(false);
      expect(m('normal', 'rare')).toBe(false);
      expect(m('demiboss', 'common')).toBe(false);
      expect(m('demiboss', 'rare')).toBe(false);
      expect(m('normal', 'epic')).toBe(true);
      for (const mod of ['boss', 'aberrant']) expect(m(mod, 'common')).toBe(true);

      const row = (extra: object) => ({ encounters: [{ monsterId: 'x', weight: 1, level: [1, 1] as [number, number], ...extra }] });
      expect(m('normal', 'common', row({ boss: true }))).toBe(true);
      expect(m('normal', 'common', row({ once: true }))).toBe(true);
      expect(m('normal', 'common', row({}))).toBe(false);
      // A keeper row for another monster does not count.
      expect(m('normal', 'common', { encounters: [{ monsterId: 'y', weight: 1, level: [1, 1], boss: true }] })).toBe(false);
    });
  });

  it('keeps a kill and its drop in one hunt line when a kill listener logs', () => {
    // Every monster drops one Leather, so every kill has a drop. A listener on
    // `kill` (the bestiary, a mutation, a level-up) logs a line of its own.
    const defs = Object.values(MONSTERS);
    const loot = defs.map((d) => d.loot);
    for (const d of defs) d.loot = { rolls: 1, entries: [{ kind: 'material', id: 'leather', weight: 1 }] };
    try {
      const g = huntingGame();
      const killed: string[] = [];
      g.bus.on('kill', (ev) => {
        killed.push(`${ev.monster.icon} ${ev.monster.name}`);
        g.bus.emit({ type: 'log', msg: '📖 listener line', kind: 'info' });
      });
      for (let i = 0; i < 30000 && killed.length < 10; i++) {
        g.tick();
        if (!g.state.recovering && g.state.spot !== 'woods_edge') {
          g.state.spot = 'woods_edge';
          g.selectActivity('hunt');
        }
      }
      expect(killed.length).toBe(10);

      const hunts = g.state.log.filter((l) => l.group === 'hunt');
      // The listener line follows every kill, so every kill is its own hunt line.
      expect(hunts).toHaveLength(10);
      const names = new Set(killed);
      for (const h of hunts) {
        // One kill label and that kill's Leather, in the same line.
        const labels = (h.tally ?? []).filter((t) => names.has(t.label));
        expect(labels.reduce((n, t) => n + t.qty, 0)).toBe(1);
        expect((h.tally ?? []).find((t) => t.label.includes(MATERIALS.leather.name))?.qty).toBe(1);
      }
      // The listener's line comes after the hunt line it belongs to, before the next one.
      const log = g.state.log;
      hunts.forEach((h, n) => {
        const end = n + 1 < hunts.length ? log.indexOf(hunts[n + 1]) : log.length;
        expect(log.slice(log.indexOf(h) + 1, end).some((l) => l.msg === '📖 listener line')).toBe(true);
      });
    } finally {
      defs.forEach((d, i) => (d.loot = loot[i]));
    }
  });
});
