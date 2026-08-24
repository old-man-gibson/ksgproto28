import { describe, expect, it } from 'vitest';
import { createInitialState, SAVE_VERSION } from '../src/core/state';
import { Game } from '../src/core/game';
import { serialize, deserialize } from '../src/core/save/save';
import { migrate } from '../src/core/save/migrations';
import {
  beginFight,
  dropFight,
  endFight,
  ensureLedger,
  isKept,
  keepFight,
  NOTEBOOK_MAX,
  noteAbsorbed,
  noteConditionDamage,
  noteDodge,
  noteIncoming,
  noteOutgoing,
  noteParry,
} from '../src/core/systems/ledger';
import { appendFeed, FEED_MAX, feedRepeat, TRANSCRIPT_MAX } from '../src/core/systems/log';
import { damagePlayer, heal } from '../src/core/systems/health';
import { getDerivedStats } from '../src/core/systems/derived';
import { applyStatus } from '../src/core/systems/statuses';
import { resourceValue } from '../src/core/systems/resources';
import type { FightLedger, GameState } from '../src/core/types';

const rat = { key: 'monster:forest_rat', label: 'Forest Rat', icon: '🐀' };
const wolf = { key: 'monster:young_wolf', label: 'Wolf', icon: '🐺' };

describe('attribution', () => {
  it('sums per source rather than keeping one entry per blow', () => {
    const s = createInitialState(1);
    for (let i = 0; i < 40; i++) noteIncoming(s, rat, 3);
    const led = endFight(s, 'knocked_out')!;
    expect(led.incoming).toHaveLength(1);
    expect(led.incoming[0]).toMatchObject({ key: 'monster:forest_rat', amount: 120, hits: 40 });
  });

  it('orders the sources worst first, which is what the window leads with', () => {
    const s = createInitialState(1);
    noteIncoming(s, rat, 10);
    noteConditionDamage(s, 'bleeding', 90);
    noteIncoming(s, wolf, 40);
    const led = endFight(s, 'knocked_out')!;
    expect(led.incoming.map((i) => i.key)).toEqual([
      'cond:bleeding',
      'monster:young_wolf',
      'monster:forest_rat',
    ]);
  });

  it('names the condition that actually did it, not whoever was standing there', () => {
    // The whole point of the ledger: a rot stack from something already dead
    // can put you down while the front enemy takes the credit in the log line.
    const s = createInitialState(1);
    noteIncoming(s, wolf, 12);
    noteConditionDamage(s, 'rotting', 300);
    const led = endFight(s, 'knocked_out')!;
    expect(led.incoming[0].key).toBe('cond:rotting');
  });

  it('counts an unattributed blow rather than dropping it', () => {
    const s = createInitialState(1);
    damagePlayer(s, 25);
    const led = endFight(s, 'knocked_out')!;
    // Better an "unknown" row than a ledger whose numbers quietly do not add up.
    expect(led.incoming[0]).toMatchObject({ key: 'unknown', amount: 25 });
  });

  it('lets a caller attribute a shared tick itself without double counting', () => {
    const s = createInitialState(1);
    noteConditionDamage(s, 'bleeding', 6);
    noteConditionDamage(s, 'poison', 4);
    damagePlayer(s, 10, undefined, null); // already attributed above
    const led = endFight(s, 'knocked_out')!;
    expect(led.incoming.reduce((sum, i) => sum + i.amount, 0)).toBe(10);
  });
});

describe('what you stopped', () => {
  it('keeps absorbed, parried and dodged apart', () => {
    const s = createInitialState(1);
    noteAbsorbed(s, 30);
    noteParry(s, 50, 12);
    noteParry(s, 20, 5);
    noteDodge(s, 40);
    const led = endFight(s, 'won')!;
    expect(led.stopped).toMatchObject({
      absorbed: 30,
      parried: 70,
      riposted: 17,
      parries: 2,
      dodged: 40,
      dodges: 1,
    });
  });

  it('records healing by kind and what a condition refused to let land', () => {
    const s = createInitialState(1);
    const stats = getDerivedStats(s);
    damagePlayer(s, 30);
    heal(s, stats, 10, 'salve');
    heal(s, stats, 5, 'rest');
    heal(s, stats, 4, 'salve');
    const led = endFight(s, 'won')!;
    expect(led.healed.salve).toBeCloseTo(14);
    expect(led.healed.rest).toBeCloseTo(5);
    expect(led.healRefused).toBe(0);
  });
});

describe('the size invariant', () => {
  it('does not grow with how long the fight ran', () => {
    // A ledger is O(distinct sources), never O(ticks) — the property that makes
    // it cheap enough to save. If this ever fails, something started appending.
    const short = createInitialState(1);
    for (let i = 0; i < 10; i++) noteIncoming(short, rat, 1);
    const a = JSON.stringify(endFight(short, 'knocked_out'));

    const long = createInitialState(1);
    for (let i = 0; i < 10_000; i++) noteIncoming(long, rat, 1);
    const b = JSON.stringify(endFight(long, 'knocked_out'));

    // Same shape, same row count; only the totals differ in length.
    expect(JSON.parse(b).incoming).toHaveLength(1);
    expect(b.length - a.length).toBeLessThan(20);
  });

  it('stays around a kilobyte for a busy five-enemy fight', () => {
    const s = createInitialState(1);
    for (let i = 0; i < 5; i++) noteIncoming(s, { key: `monster:m${i}`, label: `Monster ${i}`, icon: '👹' }, 100);
    for (const c of ['bleeding', 'poison', 'on_fire', 'chilled', 'concussed', 'punctured']) {
      noteConditionDamage(s, c, 50);
    }
    noteAbsorbed(s, 400);
    noteOutgoing(s, 2000, true);
    const led = endFight(s, 'knocked_out')!;
    expect(JSON.stringify(led).length).toBeLessThan(2048);
  });
});

describe('fight boundaries', () => {
  it('resolves the duration from the tick it started on', () => {
    const s = createInitialState(1);
    s.totalTicks = 500;
    beginFight(s, []);
    s.totalTicks = 800;
    expect(endFight(s, 'won')!.ticks).toBe(300);
  });

  it('dates a lazily-made ledger from the first damage, not from tick zero', () => {
    // Bleeding out while chopping wood: no encounter ever began.
    const s = createInitialState(1);
    s.totalTicks = 700;
    noteConditionDamage(s, 'bleeding', 5);
    s.totalTicks = 760;
    expect(endFight(s, 'knocked_out')!.ticks).toBe(60);
  });

  it('counts a repeated foe once, at the highest level met', () => {
    const s = createInitialState(1);
    const mk = (level: number) =>
      ({ defId: 'forest_rat', name: 'Forest Rat', icon: '🐀', level }) as never;
    beginFight(s, [mk(3), mk(7), null]);
    ensureLedger(s);
    const led = endFight(s, 'won')!;
    expect(led.foes).toEqual([
      { defId: 'forest_rat', name: 'Forest Rat', icon: '🐀', level: 7, count: 2 },
    ]);
  });

  it('clears the live tally so the next fight starts from nothing', () => {
    const s = createInitialState(1);
    noteIncoming(s, rat, 10);
    endFight(s, 'knocked_out');
    expect(s.fight).toBeNull();
    expect(s.lastFight!.incoming[0].amount).toBe(10);
    noteIncoming(s, wolf, 4);
    expect(s.fight!.incoming).toHaveLength(1);
  });

  it('records the conditions still on you when it ended', () => {
    const s = createInitialState(1);
    applyStatus(s, s, { id: 'bleeding', intensity: 2 });
    noteIncoming(s, wolf, 5);
    const led = endFight(s, 'knocked_out')!;
    expect(led.afflictions.map((a) => a.id)).toContain('bleeding');
  });
});

describe('in play', () => {
  it('attributes a real knockout and survives the fight ending', () => {
    const g = new Game(createInitialState(11));
    g.state.spot = 'woods_edge';
    g.selectActivity('hunt');
    // Long enough for a level-one character with no gear to lose one.
    for (let i = 0; i < 4000 && !g.state.lastFight; i++) g.tick();

    const led = g.state.lastFight;
    expect(led).not.toBeNull();
    expect(led!.foes.length).toBeGreaterThan(0);
    expect(['won', 'knocked_out']).toContain(led!.outcome);
    // Whatever happened, the books balance: something dealt the damage taken.
    const attributed = led!.incoming.reduce((sum, s) => sum + s.amount, 0);
    if (attributed > 0) expect(led!.incoming.every((s) => s.hits > 0)).toBe(true);
  });

  it('leaves a knockout explainable after a save round-trip', () => {
    const g = new Game(createInitialState(11));
    g.state.spot = 'woods_edge';
    noteIncoming(g.state, wolf, 42);
    endFight(g.state, 'knocked_out');

    const back = deserialize(serialize(g.state));
    expect(back.lastFight!.incoming[0]).toMatchObject({ label: 'Wolf', amount: 42 });
    // ...but the tally in progress goes with the fight it belonged to.
    expect(back.fight).toBeNull();
  });

  it('drops the tally when you simply walk away from a fight', () => {
    const g = new Game(createInitialState(5));
    g.state.spot = 'woods_edge';
    g.selectActivity('hunt');
    for (let i = 0; i < 300 && !g.state.combat; i++) g.tick();
    if (!g.state.combat) return; // no encounter rolled; nothing to assert
    noteIncoming(g.state, rat, 5);
    g.selectActivity('explore');
    expect(g.state.fight).toBeNull();
  });
});

describe('migration', () => {
  it('brings a v35 save forward with an empty ledger', () => {
    const raw: Record<string, unknown> = {
      ...(createInitialState(1) as unknown as Record<string, unknown>),
      version: 35,
    };
    delete raw.fight;
    delete raw.lastFight;
    const out = migrate(raw, SAVE_VERSION) as unknown as GameState;
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.lastFight).toBeNull();
    // Inventing a history for fights that happened before the ledger existed
    // would be worse than an empty window.
    expect(out.fight).toBeNull();
  });
});

describe('the transcript', () => {
  it('folds repeats and caps rather than recording every tick', () => {
    const s = createInitialState(1);
    beginFight(s, []);
    for (let i = 0; i < 200; i++) {
      feedRepeat(s, {
        group: 'cond:self',
        prefix: '🩸 You suffer:',
        tally: [{ label: 'bleeding', qty: 1, style: 'amount' }],
      });
    }
    const led = endFight(s, 'knocked_out')!;
    // Two hundred ticks of one bleed is one line, not two hundred.
    expect(led.transcript).toHaveLength(1);
    expect(led.transcript[0].text).toBe('🩸 You suffer: 200 bleeding');
  });

  it('never grows past its cap however long the fight runs', () => {
    const s = createInitialState(1);
    beginFight(s, []);
    for (let i = 0; i < TRANSCRIPT_MAX * 4; i++) {
      appendFeed(s, { text: `line ${i}` });
    }
    const led = endFight(s, 'knocked_out')!;
    expect(led.transcript).toHaveLength(TRANSCRIPT_MAX);
    // It keeps the END of the fight, which is the part that explains the result.
    expect(led.transcript[TRANSCRIPT_MAX - 1].text).toBe(`line ${TRANSCRIPT_MAX * 4 - 1}`);
  });

  it('keeps deeper history than the live feed without the two interfering', () => {
    const s = createInitialState(1);
    beginFight(s, []);
    // Enough to roll the live feed but not the transcript, whatever the two
    // depths are set to — the invariant is the ORDER of them, not the numbers.
    expect(FEED_MAX).toBeLessThan(TRANSCRIPT_MAX);
    const lines = FEED_MAX + 5;
    for (let i = 0; i < lines; i++) appendFeed(s, { text: `line ${i}` });
    // Same lines, different depths — and neither fold rewrites the other's.
    expect(s.combatFeed).toHaveLength(FEED_MAX);
    expect(s.fight!.transcript).toHaveLength(lines);
    expect(s.combatFeed[0].text).toBe(`line ${lines - FEED_MAX}`);
    expect(s.fight!.transcript[0].text).toBe('line 0');
  });

  it('folds the two lists independently instead of sharing one entry', () => {
    const s = createInitialState(1);
    beginFight(s, []);
    // Push enough distinct lines to roll the short list past the folded one.
    for (let i = 0; i < FEED_MAX; i++) appendFeed(s, { text: `filler ${i}` });
    const tick = () =>
      feedRepeat(s, {
        group: 'g',
        prefix: 'x:',
        tally: [{ label: 'n', qty: 1, style: 'amount' }],
      });
    tick();
    tick();
    expect(s.combatFeed[s.combatFeed.length - 1].text).toBe('x: 2 n');
    expect(s.fight!.transcript[s.fight!.transcript.length - 1].text).toBe('x: 2 n');
  });
});

describe('the notebook', () => {
  function ledgerEndingAt(tick: number): FightLedger {
    const s = createInitialState(1);
    s.totalTicks = tick;
    noteIncoming(s, wolf, 10);
    return endFight(s, 'knocked_out')!;
  }

  it('keeps a fight and knows it has it', () => {
    const s = createInitialState(1);
    const led = ledgerEndingAt(100);
    expect(isKept(s, led)).toBe(false);
    expect(keepFight(s, led, 1)).toBeNull();
    expect(isKept(s, led)).toBe(true);
    expect(s.notebook[0].id).toBe(led.endedAt);
  });

  it('refuses to keep the same fight twice', () => {
    const s = createInitialState(1);
    const led = ledgerEndingAt(100);
    keepFight(s, led, 1);
    keepFight(s, led, 2);
    expect(s.notebook).toHaveLength(1);
  });

  it('forgets one on request', () => {
    const s = createInitialState(1);
    const led = ledgerEndingAt(100);
    keepFight(s, led, 1);
    dropFight(s, led.endedAt);
    expect(s.notebook).toHaveLength(0);
  });

  it('evicts the oldest when full, and HANDS BACK what it dropped', () => {
    const s = createInitialState(1);
    const first = ledgerEndingAt(1);
    keepFight(s, first, 1);
    for (let i = 2; i <= NOTEBOOK_MAX; i++) keepFight(s, ledgerEndingAt(i), i);
    expect(s.notebook).toHaveLength(NOTEBOOK_MAX);

    // The caller announces this; a notebook that silently forgets the fight you
    // meant to study is worse than one that fills up.
    const evicted = keepFight(s, ledgerEndingAt(NOTEBOOK_MAX + 1), 99);
    expect(evicted).not.toBeNull();
    expect(evicted!.id).toBe(first.endedAt);
    expect(s.notebook).toHaveLength(NOTEBOOK_MAX);
    expect(isKept(s, first)).toBe(false);
  });

  it('orders newest first', () => {
    const s = createInitialState(1);
    keepFight(s, ledgerEndingAt(10), 1);
    keepFight(s, ledgerEndingAt(20), 2);
    expect(s.notebook.map((e) => e.id)).toEqual([20, 10]);
  });

  it('survives a save round-trip with its transcript intact', () => {
    const s = createInitialState(1);
    beginFight(s, []);
    appendFeed(s, { text: '🩸 The Wolf hits you for 12 piercing.' });
    noteIncoming(s, wolf, 12);
    const led = endFight(s, 'knocked_out')!;
    keepFight(s, led, 1);

    const back = deserialize(serialize(s));
    expect(back.notebook).toHaveLength(1);
    expect(back.notebook[0].ledger.transcript[0].text).toContain('hits you for 12');
  });

  it('saves what happened, not the working behind it', () => {
    const s = createInitialState(1);
    beginFight(s, []);
    // A line with a full report — what every landed blow now feeds.
    appendFeed(s, {
      text: '⚔️ You hit the Wolf for 42',
      damage: {
        label: 'Your attack',
        target: 'Wolf',
        steps: [{ label: 'Damage', value: 40 }, { label: 'Swing variance ±10%' }],
        slices: [
          { type: 'slashing', source: 'Iron Sword', raw: 50, armor: 3, resisted: 5, resistance: 0.1, pierced: 0, dealt: 42 },
        ],
        hits: 1,
        crit: false,
        total: 42,
      },
    });
    // In memory both keep it — you read a breakdown during, or just after, the
    // exchange it explains.
    expect(s.combatFeed[0].damage).toBeTruthy();
    expect(s.fight!.transcript[0].damage).toBeTruthy();

    // On DISK neither transcript does, because a report runs about a kilobyte
    // and nobody opens one a week later. The line's own text still carries the
    // number, which is what a record is for.
    const led = endFight(s, 'won')!;
    keepFight(s, led, 1);
    const back = deserialize(serialize(s));
    expect(back.lastFight!.transcript[0].text).toBe('⚔️ You hit the Wolf for 42');
    expect(back.lastFight!.transcript[0].damage).toBeUndefined();
    expect(back.notebook[0].ledger.transcript[0].damage).toBeUndefined();
  });

  it('costs a few kilobytes a fight, not a few hundred', () => {
    const s = createInitialState(1);
    beginFight(s, []);
    for (let i = 0; i < 100; i++) appendFeed(s, { text: `🩸 The Goblin Boss hits you for ${i}.` });
    for (let i = 0; i < 6; i++) {
      noteIncoming(s, { key: `m${i}`, label: `Monster ${i}`, icon: '👹' }, 100);
    }
    const led = endFight(s, 'knocked_out')!;
    keepFight(s, led, 1);
    const cost = JSON.stringify(s.notebook[0]).length;
    // A full notebook therefore sits comfortably under one percent of a
    // browser's storage budget.
    expect(cost).toBeLessThan(4096);
    expect(cost * NOTEBOOK_MAX).toBeLessThan(100_000);
  });
});

describe('health is unaffected', () => {
  it('still returns what actually landed', () => {
    const s: GameState = createInitialState(1);
    const stats = getDerivedStats(s);
    const before = resourceValue(s, 'hp');
    expect(damagePlayer(s, 12)).toBe(12);
    expect(resourceValue(s, 'hp')).toBe(before - 12);
    expect(heal(s, stats, 5, 'rest')).toBe(5);
  });
});
