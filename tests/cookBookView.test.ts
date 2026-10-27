import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { DISCIPLINES } from '../src/core/data/disciplines.data';
import { QUALITY_ORDER } from '../src/core/data/quality.data';
import { COOK_TIME_COOKS, SIGNATURE_COOKS, cookedGradeKey, cookedKey, cookingDishIds } from '../src/core/systems/cookbook';
import { cook } from '../src/core/systems/cooking';
import { grantGraded, recipeKey, type Placement } from '../src/core/systems/disciplines';
import { useConsumable } from '../src/core/systems/consumables';
import {
  bookSections,
  bookSummary,
  dishMarks,
  plateFor,
  plateTracker,
  squaresLabel,
  tierColour,
  type BookRow,
  type CookedEvent,
  type Plate,
} from '../src/ui/lib/cookBook';
import { describeMod, statTipLines, sumMods } from '../src/ui/lib/format';
import { getDerivedStats } from '../src/core/systems/derived';
import type { GameState, QualityTier } from '../src/core/types';

const STOVE = DISCIPLINES.cooking;
const at = (id: string, quality: QualityTier = 'c') => ({ id, quality });

function newGame(level = 1): Game {
  const g = new Game(createInitialState(1));
  g.state.skills.cooking = { level, xp: 0 };
  for (const id of ['raw_meat', 'wild_onion']) {
    for (const q of ['c', 'b', 'a'] as QualityTier[]) grantGraded(g.state, id, q, 300);
  }
  return g;
}

const rowOf = (state: GameState, benchId: string, dishName: string): BookRow | undefined =>
  bookSections(state).find((s) => s.benchId === benchId)?.rows.find((r) => r.name === dishName);

/** The nth row of a bench, whatever it shows. */
const nth = (state: GameState, benchId: string, n: number): BookRow =>
  bookSections(state).find((s) => s.benchId === benchId)!.rows[n];

describe('the Cook’s Book sections', () => {
  it('has one section per bench that makes dishes, labelled with the bench, whether or not it is reached', () => {
    const sections = bookSections(createInitialState(1));
    expect(sections.map((s) => s.label)).toEqual(['Cooking Stove', 'Open Grill', 'Clay Oven', 'Cold Counter']);
    // The cutting board makes cuts, which are not dishes.
    expect(sections.some((s) => s.benchId === 'preparing')).toBe(false);
  });

  it('lists a row for every outcome, in the core’s order', () => {
    const state = createInitialState(1);
    const stove = bookSections(state)[0].rows;
    expect(stove).toHaveLength(DISCIPLINES.cooking.outcomes.length);
  });

  it('counts dishes, not rows: a dish several benches make is one', () => {
    const state = createInitialState(1);
    expect(bookSummary(state)).toEqual({ made: 0, total: cookingDishIds().length, text: `0 of ${cookingDishIds().length} dishes made` });
    // The Traveler's Ration is on all four benches.
    state.stats[cookedKey('travelers_ration')] = 3;
    expect(bookSummary(state).made).toBe(1);
    state.stats[cookedKey('hearty_stew')] = 1;
    expect(bookSummary(state).text).toBe(`2 of ${cookingDishIds().length} dishes made`);
  });
});

describe('what a row shows', () => {
  it('prints a dish whose card is unread as a blank row: no name, no icon, no requirements', () => {
    const state = createInitialState(1);
    const seared = nth(state, 'cooking', DISCIPLINES.cooking.outcomes.findIndex((o) => o.id === 'seared_stew'));
    expect(seared.blank).toBe(true);
    expect(seared.name).toBe('');
    expect(seared.icon).toBe('');
    expect(seared.made).toBe(0);
    expect(seared.cookTime).toBe('not yet made');
    expect(seared.signature).toBe('');
    expect(seared.squares.every((s) => s.state === 'none')).toBe(true);
    // Nothing the row prints names the dish, its tags or its window (`key` is for the list, not the page).
    const { key, ...printed } = seared;
    expect(key).toBeTruthy();
    expect(JSON.stringify(printed)).not.toMatch(/seared|meat|stew|units/i);
  });

  it('names a dish that needs no card, with zero counts, before it is ever made', () => {
    const stew = rowOf(createInitialState(1), 'cooking', 'Hearty Stew')!;
    expect(stew.blank).toBe(false);
    expect(stew.icon).toBe('🍲');
    expect(stew.made).toBe(0);
    expect(stew.squares.every((s) => s.state === 'none')).toBe(true);
    // No window on the fallback dish; its Signature is not earned yet.
    expect(stew.cookTime).toBe('—');
    expect(stew.signature).toBe(`after ${SIGNATURE_COOKS} cooks`);
  });

  it('shows a blank row’s dish once the card is read, with its cook time still to earn', () => {
    const state = createInitialState(1);
    state.stats[recipeKey('seared_stew')] = 1;
    const seared = rowOf(state, 'cooking', 'Seared Stew')!;
    expect(seared.blank).toBe(false);
    expect(seared.made).toBe(0);
    expect(seared.cookTime).toBe(`shown after ${COOK_TIME_COOKS} cooks`);
    expect(seared.cookTimeDim).toBe(true);
  });

  it('shows the window in words once the cook time is known, and not before', () => {
    const state = createInitialState(1);
    for (const id of ['seared_stew', 'braised_meat', 'steeped_broth']) state.stats[recipeKey(id)] = 1;
    state.stats[cookedKey('seared_stew')] = COOK_TIME_COOKS - 1;
    state.stats[cookedKey('braised_meat')] = COOK_TIME_COOKS;
    state.stats[cookedKey('steeped_broth')] = COOK_TIME_COOKS + 40;
    state.stats[cookedKey('hearty_stew')] = COOK_TIME_COOKS;
    expect(rowOf(state, 'cooking', 'Seared Stew')!.cookTime).toBe(`shown after ${COOK_TIME_COOKS} cooks`);
    expect(rowOf(state, 'cooking', 'Braised Meat')!.cookTime).toBe('meat 14 or more units');
    expect(rowOf(state, 'cooking', 'Steeped Broth')!.cookTime).toBe('herb 8 or more units');
    expect(rowOf(state, 'cooking', 'Braised Meat')!.cookTimeDim).toBe(false);
    // A dish with no window of its own has nothing to show, however often it is cooked.
    const hearty = rowOf(state, 'cooking', 'Hearty Stew')!;
    expect(hearty.cookTime).toBe('—');
    expect(hearty.cookTimeDim).toBe(true);
    state.stats[cookedKey('seared_stew')] = COOK_TIME_COOKS;
    expect(rowOf(state, 'cooking', 'Seared Stew')!.cookTime).toBe('meat under 6 units');
  });

  it('shows the Signature’s condition once earned, the count to go before, and a dash for the failure dish', () => {
    const state = createInitialState(1);
    state.stats[cookedKey('hearty_stew')] = SIGNATURE_COOKS - 1;
    const before = rowOf(state, 'cooking', 'Hearty Stew')!;
    expect(before.signature).toBe(`after ${SIGNATURE_COOKS} cooks`);
    expect(before.signatureDim).toBe(true);
    state.stats[cookedKey('hearty_stew')] = SIGNATURE_COOKS;
    const after = rowOf(state, 'cooking', 'Hearty Stew')!;
    expect(after.signature).toBe('Stoked');
    expect(after.signatureDim).toBe(false);
    state.stats[cookedKey('scorched_mess')] = 500;
    const mess = rowOf(state, 'cooking', 'Scorched Mess')!;
    expect(mess.signature).toBe('—');
    expect(mess.signatureDim).toBe(true);
  });

  it('shares one count between the benches that make a dish', () => {
    const state = createInitialState(1);
    state.stats[cookedKey('travelers_ration')] = 7;
    for (const bench of ['cooking', 'grilling', 'baking', 'assembling']) {
      expect(rowOf(state, bench, "Traveler's Ration")!.made, bench).toBe(7);
    }
  });
});

describe('the grade squares', () => {
  const squares = (tiers: Partial<Record<QualityTier, number>>) => {
    const state = createInitialState(1);
    for (const [tier, n] of Object.entries(tiers)) state.stats[cookedGradeKey('hearty_stew', tier as QualityTier)] = n;
    state.stats[cookedKey('hearty_stew')] = Object.values(tiers).reduce((a, b) => a + b, 0);
    return rowOf(state, 'cooking', 'Hearty Stew')!.squares;
  };
  const states = (sq: ReturnType<typeof squares>) => sq.map((s) => s.state);

  it('runs F to S, seven squares', () => {
    expect(squares({}).map((s) => s.tier)).toEqual(QUALITY_ORDER);
    expect(QUALITY_ORDER).toHaveLength(7);
  });

  it('fills the grades made and dashes the one above the best', () => {
    // Made Fair and Fine: the next grade up is Superb.
    expect(states(squares({ c: 4, b: 1 }))).toEqual(['none', 'none', 'none', 'made', 'made', 'next', 'none']);
    // Gaps stay empty: Poor and Superb made, Common and Fair not.
    expect(states(squares({ e: 2, a: 1 }))).toEqual(['none', 'made', 'none', 'none', 'none', 'made', 'next']);
  });

  it('dashes nothing at the top grade, nor before the first cook', () => {
    expect(states(squares({ s: 1 })).includes('next')).toBe(false);
    expect(states(squares({})).includes('next')).toBe(false);
  });

  it('carries the count per grade for the tooltip', () => {
    const sq = squares({ c: 4, b: 1 });
    expect(sq.find((s) => s.tier === 'c')!.count).toBe(4);
    expect(squaresLabel(sq)).toBe('Made at Fair (4), Fine (1). Next grade up: Superb.');
    expect(squaresLabel(squares({}))).toBe('Not made yet.');
  });

  it('draws Refuse in a legible colour', () => {
    expect(tierColour('f')).toBe('var(--text-dim)');
    expect(tierColour('s')).not.toBe('var(--text-dim)');
  });
});

describe('the plate card', () => {
  function cookOnce(g: Game, placement: Placement, duration = 12) {
    const events: CookedEvent[] = [];
    const off = g.bus.on('cooked', (e) => events.push(e));
    const before = dishMarks(g.state);
    const done = cook(g.state, g.bus, placement, STOVE, duration);
    off();
    expect(done).not.toBeNull();
    expect(events).toHaveLength(1);
    const ev = events[0];
    return { ev, before: before.get(ev.dish), after: dishMarks(g.state).get(ev.dish)! };
  }
  const stew = (q: QualityTier): Placement => ({ main: at('raw_meat', q), second: at('wild_onion', q) });

  it('names the dish, its grade and what the Book now holds', () => {
    const g = newGame();
    const { ev, before, after } = cookOnce(g, stew('c'));
    const plate = plateFor(ev, before, after, 1);
    expect(plate.name).toBe('Hearty Stew');
    expect(plate.icon).toBe('🍲');
    expect(plate.quality).toBe(ev.quality);
    expect(plate.made).toBe(1);
    expect(plate.best).toBe(ev.quality);
    expect(plate.signature).toBe(false);
    expect(plate.cooks).toBe(1);
  });

  it('gives a range only where the preview promised a spread', () => {
    const g = newGame();
    const { ev, before, after } = cookOnce(g, stew('c'));
    expect(plateFor(ev, before, after, 1).range).toBeNull();
    const spread: CookedEvent = { ...ev, low: 'b', high: 'a' };
    expect(plateFor(spread, before, after, 1).range).toBe('Fine to Superb');
  });

  it('says new best when the best grade rose, and not for the first cook, a repeat or a lower grade', () => {
    const g = newGame();
    const first = cookOnce(g, stew('c'));
    expect(plateFor(first.ev, first.before, first.after, 1).news.newBest).toBe(false);
    const again = cookOnce(g, stew('c'));
    expect(plateFor(again.ev, again.before, again.after, 2).news.newBest).toBe(false);
    const better = cookOnce(g, stew('a'));
    expect(QUALITY_ORDER.indexOf(better.ev.quality)).toBeGreaterThan(QUALITY_ORDER.indexOf(first.ev.quality));
    expect(plateFor(better.ev, better.before, better.after, 3).news.newBest).toBe(true);
    const lower = cookOnce(g, stew('c'));
    expect(plateFor(lower.ev, lower.before, lower.after, 4).news.newBest).toBe(false);
  });

  it('says the cook time is shown on the cook that makes it known, for a dish that has one', () => {
    const g = newGame();
    g.state.stats[recipeKey('seared_stew')] = 1;
    g.state.stats[cookedKey('seared_stew')] = COOK_TIME_COOKS - 1;
    // Meat midway on a Quick simmer: 5.4 units, under 6.
    const seared: Placement = { main: at('wild_onion'), second: at('raw_meat') };
    const crossing = cookOnce(g, seared, 8);
    expect(crossing.ev.dish).toBe('seared_stew');
    expect(plateFor(crossing.ev, crossing.before, crossing.after, 1).news.timeShown).toBe(true);
    const next = cookOnce(g, seared, 8);
    expect(plateFor(next.ev, next.before, next.after, 2).news.timeShown).toBe(false);
  });

  it('does not say it for a dish with no window to show', () => {
    const g = newGame();
    g.state.stats[cookedKey('hearty_stew')] = COOK_TIME_COOKS - 1;
    const crossing = cookOnce(g, stew('c'));
    expect(crossing.ev.dish).toBe('hearty_stew');
    expect(plateFor(crossing.ev, crossing.before, crossing.after, 1).news.timeShown).toBe(false);
  });

  it('does not say it when Cook’s Notes already carried the cook time', () => {
    const g = newGame();
    g.state.stats[recipeKey('seared_stew')] = 1;
    g.state.stats[cookedKey('seared_stew')] = COOK_TIME_COOKS - 1;
    g.state.prestige.count = 1;
    g.state.prestige.purchases.cooks_notes = 1;
    g.state.prestige.cookbook = { timed: ['seared_stew'], signed: [] };
    const crossing = cookOnce(g, { main: at('wild_onion'), second: at('raw_meat') }, 8);
    expect(crossing.ev.dish).toBe('seared_stew');
    expect(crossing.before!.timeKnown).toBe(true);
    expect(plateFor(crossing.ev, crossing.before, crossing.after, 1).news.timeShown).toBe(false);
  });

  it('marks a Signature dish once earned', () => {
    const g = newGame();
    g.state.stats[cookedKey('hearty_stew')] = SIGNATURE_COOKS - 1;
    const crossing = cookOnce(g, stew('c'));
    expect(plateFor(crossing.ev, crossing.before, crossing.after, 1).signature).toBe(true);
  });

  it('counts the dishes cooked with the layout it is handed', () => {
    const g = newGame();
    const { ev, before, after } = cookOnce(g, stew('c'));
    expect(plateFor(ev, before, after, 4).cooks).toBe(4);
  });
});

describe('a window that hears every bench’s cooks', () => {
  /** A stove window open since before the grill cooked anything; the Ration is made at both. */
  function windowOpenAtStove() {
    const g = newGame();
    for (const q of ['c', 'a'] as QualityTier[]) grantGraded(g.state, 'forest_berries', q, 20);
    const stoveRation = (): Placement => ({ main: at('wild_onion', 'c'), second: at('forest_berries', 'c') });
    // The best Ration made at the stove so far is Fair.
    expect(cook(g.state, g.bus, stoveRation(), STOVE, 12)!.quality).toBe('c');
    const tracker = plateTracker(g.state, 'cooking');
    const heard: (Plate | null)[] = [];
    g.bus.on('cooked', (ev) => heard.push(tracker.cooked(ev, 1)));
    return { g, stoveRation, heard };
  }

  it('does not call a Fair stove Ration a new best after the grill made a Superb one', () => {
    const { g, stoveRation, heard } = windowOpenAtStove();
    // A Superb Ration lands at the grill while the stove window is open.
    expect(cook(g.state, g.bus, { main: at('forest_berries', 'a') }, DISCIPLINES.grilling)!.quality).toBe('a');
    expect(cook(g.state, g.bus, stoveRation(), STOVE, 12)!.quality).toBe('c');
    expect(heard[0]).toBeNull(); // the grill's cook makes no card here
    expect(heard[1]!.news.newBest).toBe(false);
    expect(heard[1]!.best).toBe('a'); // the Book's best is still the grill's Superb
    expect(heard[1]!.made).toBe(3);
  });

  it('still says new best when the stove itself raises it', () => {
    const { g, heard } = windowOpenAtStove();
    const better: Placement = { main: at('wild_onion', 'a'), second: at('forest_berries', 'a') };
    expect(QUALITY_ORDER.indexOf(cook(g.state, g.bus, better, STOVE, 12)!.quality)).toBeGreaterThan(QUALITY_ORDER.indexOf('c'));
    expect(heard[0]!.news.newBest).toBe(true);
  });
});

describe('the eat line', () => {
  function eat(count: number, quality: QualityTier): string {
    const g = newGame();
    g.state.stats[cookedKey('hearty_stew')] = count;
    grantGraded(g.state, 'hearty_stew', quality, 1);
    g.state.log.length = 0;
    expect(useConsumable(g.state, g.bus, 'hearty_stew', quality)).not.toBeNull();
    return g.state.log.map((l) => l.msg).join('\n');
  }

  it('names the Signature and its dose when it comes with the dish', () => {
    // Fine is ×1.6 and the Signature is 0.5 of a dose: Stoked at 0.8.
    expect(eat(SIGNATURE_COOKS, 'b')).toBe('🍲 Ate Fine Hearty Stew. Signature: also Stoked ×0.8.');
  });

  it('stays the plain line before the Signature is earned', () => {
    expect(eat(SIGNATURE_COOKS - 1, 'b')).toBe('🍲 Ate Fine Hearty Stew.');
  });

  it('says nothing of it for spoiled food', () => {
    expect(eat(SIGNATURE_COOKS, 'f')).toBe('🍲 Ate Refuse Hearty Stew.');
  });
});

describe('food stats as percents', () => {
  it('reads a milestone as +6%, and the milestones together as a sum', () => {
    expect(describeMod({ stat: 'foodDuration', op: 'add', value: 0.06 })).toBe('+6% Food Duration');
    expect(describeMod({ stat: 'foodPotency', op: 'add', value: 0.05 })).toBe('+5% Food Potency');
    expect(
      sumMods([
        { stat: 'foodDuration', op: 'add', value: 0.06 },
        { stat: 'foodDuration', op: 'add', value: 0.06 },
      ]),
    ).toBe('+12% Food Duration');
  });

  it('reads the stat tooltip in percents from base to total', () => {
    const g = newGame(20);
    expect(getDerivedStats(g.state).foodDuration).toBeCloseTo(1.12);
    const lines = statTipLines(g.state, 'foodDuration');
    expect(lines).toEqual([
      'Base 100%  (Cooking milestones add; read at most 150%)',
      '+12% — Cooking milestones',
      'Total 112%',
    ]);
  });
});
