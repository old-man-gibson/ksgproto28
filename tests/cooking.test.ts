// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { getDerivedStats } from '../src/core/systems/derived';
import { grantGraded, stockOf, type Placement } from '../src/core/systems/disciplines';
import { cook, dishQuality, dishQualityRange, previewCook } from '../src/core/systems/cooking';
import { benchJobTicks, benchPace, startBenchWork } from '../src/core/systems/benchwork';
import { gradesHeld } from '../src/core/systems/disciplines';
import { DISCIPLINES } from '../src/core/data/disciplines.data';
import {
  canUse,
  cooldownLeft,
  heldConsumables,
  useConsumable,
} from '../src/core/systems/consumables';
import { findStatus, hasStatus } from '../src/core/systems/statuses';
import { availableMax, resourceValue } from '../src/core/systems/resources';
import { qualityRank } from '../src/core/data/quality.data';
import type { QualityTier } from '../src/core/types';

const fresh = (seed = 1) => new Game(createInitialState(seed));
const at = (id: string, quality: QualityTier) => ({ id, quality });

/** Stock a kitchen and make the cook competent enough to be predictable. */
function kitchen(g: Game, level = 1) {
  for (const id of [
    'raw_meat', 'wild_onion', 'cave_mushroom', 'common_herb', 'river_fish', 'rock_salt',
    'rough_flour', 'forest_berries', 'bird_egg', 'wild_honey',
  ]) {
    for (const q of ['f', 'c', 'a', 's'] as QualityTier[]) grantGraded(g.state, id, q, 5);
  }
  g.state.skills.cooking = { level, xp: 0 };
}

const pot = (main: [string, QualityTier], second: [string, QualityTier], extra: Placement = {}): Placement => ({
  main: at(...main),
  second: at(...second),
  ...extra,
});

describe('what comes out of the pot', () => {
  it('the combination picks the dish, not a recipe list', () => {
    const g = fresh();
    kitchen(g);
    // Meat + vegetable is a stew; mushroom + herb is a broth. Same two slots.
    expect(previewCook(g.state, pot(['raw_meat', 'c'], ['wild_onion', 'c'])).outcome?.id).toBe('stew');
    expect(previewCook(g.state, pot(['cave_mushroom', 'c'], ['common_herb', 'c'])).outcome?.id).toBe('broth');
    // Fish and salt form no named pot dish — skewers live at the grill now.
    expect(previewCook(g.state, pot(['river_fish', 'c'], ['rock_salt', 'c'])).outcome?.id).toBe('ration');
  });

  it('the most specific match wins', () => {
    const g = fresh();
    kitchen(g, 20);
    // Meat + vegetable alone is a stew; add seasoning at high grade and skill
    // and the same pot becomes a feast.
    const plain = pot(['raw_meat', 'a'], ['wild_onion', 'a']);
    const seasoned = pot(['raw_meat', 'a'], ['wild_onion', 'a'], { seasoning: at('rock_salt', 'a') });
    expect(previewCook(g.state, plain).outcome?.id).toBe('stew');
    expect(previewCook(g.state, seasoned).outcome?.id).toBe('feast');
  });

  it('a feast is gated on both the cook and the basket', () => {
    const g = fresh();
    kitchen(g, 20);
    // The right shape, but poor ingredients: it falls back rather than refusing.
    const poor = pot(['raw_meat', 'f'], ['wild_onion', 'f'], { seasoning: at('rock_salt', 'f') });
    expect(previewCook(g.state, poor).outcome?.id).not.toBe('feast');

    // The right basket, but an unskilled cook.
    g.state.skills.cooking = { level: 1, xp: 0 };
    const good = pot(['raw_meat', 'a'], ['wild_onion', 'a'], { seasoning: at('rock_salt', 'a') });
    expect(previewCook(g.state, good).outcome?.id).not.toBe('feast');
  });

  it('anything edible produces SOMETHING — a bad basket is a bad dish', () => {
    const g = fresh();
    kitchen(g);
    // Nothing here forms a named dish, but two ingredients still feed someone.
    const odd = pot(['rock_salt', 'c'], ['rock_salt', 'c']);
    const check = previewCook(g.state, odd);
    expect(check.ok).toBe(true);
    expect(check.outcome?.id).toBe('ration');
  });

  it('a basket of pure refuse is a mess, whatever else it would have matched', () => {
    const g = fresh();
    kitchen(g);
    // Meat + vegetable would be a stew at any decent grade...
    expect(previewCook(g.state, pot(['raw_meat', 'c'], ['wild_onion', 'c'])).outcome?.id).toBe('stew');
    // ...but rubbish in, rubbish out.
    expect(previewCook(g.state, pot(['raw_meat', 'f'], ['wild_onion', 'f'])).outcome?.id).toBe('mess');
  });

  it('needs both starting slots filled', () => {
    const g = fresh();
    kitchen(g);
    expect(previewCook(g.state, { main: at('raw_meat', 'c') }).reason).toMatch(/Added Midway/);
  });

  it('widens as the cook improves', () => {
    const g = fresh();
    kitchen(g);
    // The third ingredient needs Cooking 8.
    const three = pot(['raw_meat', 'c'], ['wild_onion', 'c'], { third: at('common_herb', 'c') });
    expect(previewCook(g.state, three).ok).toBe(false);

    g.state.skills.cooking = { level: 8, xp: 0 };
    expect(previewCook(g.state, three).ok).toBe(true);
  });
});

describe('the kitchen is several benches on one skill', () => {
  const GRILL = DISCIPLINES.grilling;
  const OVEN = DISCIPLINES.baking;
  const COUNTER = DISCIPLINES.assembling;

  it('the grill is happy with a single fine ingredient', () => {
    const g = fresh();
    kitchen(g);
    // One fish, nothing else — the grill's second slot is optional.
    expect(previewCook(g.state, { main: at('river_fish', 'c') }, GRILL).outcome?.id).toBe('skewer');
    expect(previewCook(g.state, { main: at('raw_meat', 'c') }, GRILL).outcome?.id).toBe('steak');
  });

  it('wheat becomes bread becomes lunch — products are ingredients', () => {
    const g = fresh();
    kitchen(g);

    // Bake: two measures of flour make a loaf.
    const loaf = cook(g.state, g.bus, { main: at('rough_flour', 'c'), second: at('rough_flour', 'c') }, OVEN)!;
    expect(loaf.dish).toBe('rustic_loaf');

    // Grill: a steak to put on it.
    const steak = cook(g.state, g.bus, { main: at('raw_meat', 'c') }, GRILL)!;
    expect(steak.dish).toBe('seared_steak');

    // Assemble: the loaf is now a foundation, the steak a filling.
    const lunch = previewCook(
      g.state,
      { main: at('rustic_loaf', loaf.quality), second: at('seared_steak', steak.quality) },
      COUNTER,
    );
    expect(lunch.outcome?.id).toBe('sandwich');
  });

  it('the hot benches refuse cooked food', () => {
    const g = fresh();
    kitchen(g);
    grantGraded(g.state, 'rustic_loaf', 'c', 1);
    // Bread does not go back in the pot: the stove's slots take only `raw`.
    const check = previewCook(g.state, pot(['rustic_loaf', 'c'], ['wild_onion', 'c']));
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/does not belong/);
  });

  it('the counter tells raw dishes from cooked ones', () => {
    const g = fresh();
    kitchen(g);
    // Two vegetables, no flame: a salad on the counter...
    const cold = previewCook(g.state, pot(['wild_onion', 'c'], ['cave_mushroom', 'c']), COUNTER);
    expect(cold.outcome?.id).toBe('salad');
    // ...where the same pair in the pot would have been nothing in particular.
    expect(previewCook(g.state, pot(['wild_onion', 'c'], ['cave_mushroom', 'c'])).outcome?.id).toBe('ration');
  });

  it('the oven climbs from loaf to pie to cake as the baker learns', () => {
    const g = fresh();
    kitchen(g);
    const pie = previewCook(g.state, pot(['rough_flour', 'c'], ['forest_berries', 'c']), OVEN);
    expect(pie.outcome?.id).toBe('pie');

    // The cake needs Cooking 12 — below that, the same tin falls back.
    const tin = pot(['rough_flour', 'c'], ['bird_egg', 'c'], { sweetening: at('wild_honey', 'c') });
    expect(previewCook(g.state, tin, OVEN).outcome?.id).not.toBe('cake');
    g.state.skills.cooking = { level: 12, xp: 0 };
    expect(previewCook(g.state, tin, OVEN).outcome?.id).toBe('cake');
  });

  it('every cooking bench pays the one cooking skill', () => {
    const g = fresh();
    kitchen(g);
    const before = g.state.skills.cooking?.xp ?? 0;
    cook(g.state, g.bus, { main: at('raw_meat', 'c') }, GRILL);
    expect(g.state.skills.cooking!.xp).toBeGreaterThan(before);
  });
});

describe('the cutting board', () => {
  const BOARD = DISCIPLINES.preparing;
  const lay = (id: string, q: QualityTier, tech: string): Placement => ({
    board: at(id, q),
    technique: at(tech, 'c'),
  });

  it('preps an ingredient into its variant and spends the whole one', () => {
    const g = fresh();
    kitchen(g);
    const before = stockOf(g.state, 'wild_onion', 'c');
    const done = cook(g.state, g.bus, lay('wild_onion', 'c', 'sliced'), BOARD)!;
    expect(done.dish).toBe('wild_onion_sliced');
    expect(stockOf(g.state, 'wild_onion', 'c')).toBe(before - 1);
    expect(stockOf(g.state, 'wild_onion_sliced', done.quality)).toBe(1);
  });

  it('no knife exceeds the ingredient — the cut grade is capped', () => {
    const g = fresh();
    kitchen(g, 50); // A masterful hand...
    const done = cook(g.state, g.bus, lay('wild_onion', 'f', 'sliced'), BOARD)!;
    // ...still cannot slice refuse into anything but refuse.
    expect(done.quality).toBe('f');
  });

  it('techniques are knowledge, gated by the skill', () => {
    const g = fresh();
    kitchen(g, 1);
    const check = previewCook(g.state, lay('wild_onion', 'c', 'julienned'), BOARD);
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/Cooking 10/);
  });

  it('a cut cannot be cut again', () => {
    const g = fresh();
    kitchen(g);
    grantGraded(g.state, 'wild_onion_sliced', 'c', 1);
    const check = previewCook(g.state, lay('wild_onion_sliced', 'c', 'sliced'), BOARD);
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/does not belong/);
  });

  it('a prepped ingredient is still itself — a diced onion still makes stew', () => {
    const g = fresh();
    kitchen(g);
    grantGraded(g.state, 'wild_onion_diced', 'c', 1);
    expect(previewCook(g.state, pot(['raw_meat', 'c'], ['wild_onion_diced', 'c'])).outcome?.id).toBe('stew');
  });
});

describe('uniformity: the cut grade is predictability', () => {
  it('perfect cuts preview exact; mid cuts preview a range', () => {
    const g = fresh();
    kitchen(g, 5);
    grantGraded(g.state, 'wild_onion_diced', 's', 2);
    grantGraded(g.state, 'wild_onion_diced', 'c', 2);

    // Divine cuts introduce no variance — the promise stays exact.
    const exact = previewCook(g.state, pot(['wild_onion_diced', 's'], ['wild_onion_diced', 's']));
    expect(exact.qualityHigh).toBeUndefined();

    // Fair knife work is the widest gamble in the book. (A range only shows
    // when it actually crosses a grade boundary — variance inside one tier
    // is still an exact promise.)
    const spread = previewCook(g.state, pot(['wild_onion_diced', 'c'], ['wild_onion_diced', 'c']));
    expect(spread.qualityHigh).toBeDefined();
    expect(qualityRank(spread.qualityHigh!)).toBeGreaterThan(qualityRank(spread.quality!));
  });

  it('the cooked dish lands inside the previewed range', () => {
    const g = fresh();
    kitchen(g);
    grantGraded(g.state, 'wild_onion_diced', 'c', 3);
    const placement = pot(['raw_meat', 'a'], ['wild_onion_diced', 'c']);
    const { min, max } = dishQualityRange(g.state, placement);
    const done = cook(g.state, g.bus, placement)!;
    expect(qualityRank(done.quality)).toBeGreaterThanOrEqual(qualityRank(min));
    expect(qualityRank(done.quality)).toBeLessThanOrEqual(qualityRank(max));
  });

  it('the favored cut is worth real grades on the right bench', () => {
    const g = fresh();
    kitchen(g);
    grantGraded(g.state, 'wild_onion_diced', 'b', 2);
    // The same two diced onions: the stove favors dice, the oven is indifferent.
    const placement = pot(['wild_onion_diced', 'b'], ['wild_onion_diced', 'b']);
    const stove = dishQualityRange(g.state, placement, DISCIPLINES.cooking);
    const oven = dishQualityRange(g.state, placement, DISCIPLINES.baking);
    expect(qualityRank(stove.min)).toBeGreaterThan(qualityRank(oven.min));
  });
});

describe('the stove cooks in time', () => {
  const STOVE = DISCIPLINES.cooking;

  it('WHEN an ingredient enters matters — julienne goes in late or goes to waste', () => {
    const g = fresh();
    kitchen(g, 8); // third entry point open
    grantGraded(g.state, 'wild_onion_julienned', 's', 2);

    // The same three things; only the julienne's entry point differs.
    const early: Placement = {
      main: at('raw_meat', 'c'),
      second: at('wild_onion_julienned', 's'),
      third: at('cave_mushroom', 'c'),
    };
    const late: Placement = {
      main: at('raw_meat', 'c'),
      second: at('cave_mushroom', 'c'),
      third: at('wild_onion_julienned', 's'),
    };
    const scorched = dishQualityRange(g.state, early, STOVE);
    const bright = dishQualityRange(g.state, late, STOVE);
    expect(qualityRank(bright.min)).toBeGreaterThan(qualityRank(scorched.min));
  });

  it('the duration is a dial — the same layout simmered longer is a different dish', () => {
    const g = fresh();
    kitchen(g);
    grantGraded(g.state, 'wild_onion_julienned', 's', 2);
    const placement = pot(['raw_meat', 'c'], ['wild_onion_julienned', 's']);
    const quick = dishQualityRange(g.state, placement, STOVE, 8);
    const braise = dishQualityRange(g.state, placement, STOVE, 16);
    // Matchsticks survive a quick simmer; a long braise obliterates them.
    expect(qualityRank(quick.min)).toBeGreaterThan(qualityRank(braise.min));
  });

  it('seasoning stands outside time', () => {
    const g = fresh();
    kitchen(g);
    const placement = pot(['raw_meat', 'c'], ['wild_onion', 'c'], { seasoning: at('rock_salt', 'c') });
    // Whole food is forgiving and salt is timeless: no duration changes this pot.
    expect(dishQualityRange(g.state, placement, STOVE, 8).min)
      .toBe(dishQualityRange(g.state, placement, STOVE, 16).min);
  });
});

describe('bench runs: prepping on the clock', () => {
  const board = (id: string, q: QualityTier, tech: string): Placement => ({
    board: at(id, q),
    technique: at(tech, 'c'),
  });
  const slicedHeld = (g: Game) =>
    gradesHeld(g.state, 'wild_onion_sliced').reduce((sum, e) => sum + e.qty, 0);

  it('skill compresses the clock, and past the floor it batches instead', () => {
    expect(benchPace(1, 15)).toEqual({ ticksPer: 15, batch: 1 });
    // Fast hands hit the floor rather than vanishing into it...
    expect(benchPace(2, 15)).toEqual({ ticksPer: 10, batch: 1 });
    // ...and genuinely fast hands do several per pass.
    expect(benchPace(4, 15)).toEqual({ ticksPer: 10, batch: 2 });
  });

  it('a counted run works through the stack and stops', () => {
    const g = fresh();
    kitchen(g);
    g.state.spot = 'my_home';
    const ok = startBenchWork(g.state, g.bus, 'preparing', board('wild_onion', 'c', 'sliced'), { count: 3 });
    expect(ok).toBe(true);
    expect(g.state.benchWork).toBeTruthy();

    for (let i = 0; i < 100; i++) g.tick();
    expect(g.state.benchWork).toBeNull();
    expect(slicedHeld(g)).toBe(3);
    expect(stockOf(g.state, 'wild_onion', 'c')).toBe(2); // five stocked, three spent
  });

  it('"keep going" runs until the stock is dry', () => {
    const g = fresh();
    grantGraded(g.state, 'wild_onion', 'c', 2);
    g.state.skills.cooking = { level: 1, xp: 0 };
    g.state.spot = 'my_home';
    startBenchWork(g.state, g.bus, 'preparing', board('wild_onion', 'c', 'sliced'), { count: null });

    for (let i = 0; i < 200; i++) g.tick();
    expect(g.state.benchWork).toBeNull();
    expect(slicedHeld(g)).toBe(2);
    expect(stockOf(g.state, 'wild_onion', 'c')).toBe(0);
  });

  it('walking away abandons the board', () => {
    const g = fresh();
    kitchen(g);
    g.state.spot = 'my_home';
    startBenchWork(g.state, g.bus, 'preparing', board('wild_onion', 'c', 'sliced'), { count: null });
    g.state.spot = 'hamlet_square';
    g.tick();
    expect(g.state.benchWork).toBeNull();
  });

  it('the stove answers to the clock, not the cook', () => {
    const g = fresh();
    kitchen(g, 50); // a master, and it will not matter
    g.state.spot = 'my_home';
    startBenchWork(g.state, g.bus, 'cooking', pot(['raw_meat', 'c'], ['wild_onion', 'c']), {
      count: 1,
      duration: 8,
    });
    // A quick simmer of 8 units is 80 ticks, at Cooking 50 as at Cooking 1.
    expect(g.state.benchWork!.ticksPer).toBe(80);

    const stews = () => gradesHeld(g.state, 'hearty_stew').reduce((s, e) => s + e.qty, 0);
    for (let i = 0; i < 79; i++) g.tick();
    expect(stews()).toBe(0); // nothing until the timer lands
    g.tick();
    expect(stews()).toBe(1);
    expect(g.state.benchWork).toBeNull();
  });

  it('the grill and oven run their own fixed clocks', () => {
    const g = fresh();
    kitchen(g, 50);
    expect(benchJobTicks(g.state, DISCIPLINES.grilling, { main: at('raw_meat', 'c') }).ticksPer).toBe(30);
    expect(
      benchJobTicks(g.state, DISCIPLINES.baking, pot(['rough_flour', 'c'], ['rough_flour', 'c'])).ticksPer,
    ).toBe(50);
  });

  it('assembly grows with the stack and shrinks with skill', () => {
    const slow = fresh();
    kitchen(slow, 1);
    const two = pot(['wild_onion', 'c'], ['cave_mushroom', 'c']);
    const three = pot(['wild_onion', 'c'], ['cave_mushroom', 'c'], { third: at('common_herb', 'c') });
    const twoTicks = benchJobTicks(slow.state, DISCIPLINES.assembling, two).ticksPer;
    const threeTicks = benchJobTicks(slow.state, DISCIPLINES.assembling, three).ticksPer;
    expect(threeTicks).toBeGreaterThan(twoTicks);

    const fast = fresh();
    kitchen(fast, 50);
    expect(benchJobTicks(fast.state, DISCIPLINES.assembling, two).ticksPer).toBeLessThan(twoTicks);
  });

  it('the bench and the activity are exclusive, both ways', () => {
    const g = fresh();
    kitchen(g);
    g.state.spot = 'my_home';
    // Picking up other work drops the run...
    startBenchWork(g.state, g.bus, 'preparing', board('wild_onion', 'c', 'sliced'), { count: null });
    g.selectActivity('rest_home');
    expect(g.state.benchWork).toBeNull();
    // ...and starting a run drops the work.
    startBenchWork(g.state, g.bus, 'preparing', board('wild_onion', 'c', 'sliced'), { count: null });
    expect(g.state.activity).toBeNull();
    expect(g.state.benchWork).toBeTruthy();
  });
});

describe('the basket decides the grade', () => {
  it('better ingredients make a better dish', () => {
    const g = fresh();
    kitchen(g);
    const poor = dishQuality(g.state, pot(['raw_meat', 'f'], ['wild_onion', 'f']));
    const fair = dishQuality(g.state, pot(['raw_meat', 'c'], ['wild_onion', 'c']));
    const fine = dishQuality(g.state, pot(['raw_meat', 's'], ['wild_onion', 's']));
    expect(qualityRank(fair)).toBeGreaterThan(qualityRank(poor));
    expect(qualityRank(fine)).toBeGreaterThan(qualityRank(fair));
  });

  it('one rotten ingredient drags the dish down', () => {
    const g = fresh();
    kitchen(g);
    const clean = dishQuality(g.state, pot(['raw_meat', 'a'], ['wild_onion', 'a']));
    const spoiled = dishQuality(g.state, pot(['raw_meat', 'a'], ['wild_onion', 'f']));
    expect(qualityRank(spoiled)).toBeLessThan(qualityRank(clean));
  });

  it('skill nudges the grade but cannot conjure a feast from refuse', () => {
    const g = fresh();
    kitchen(g, 1);
    const raw = dishQuality(g.state, pot(['raw_meat', 'f'], ['wild_onion', 'f']));
    g.state.skills.cooking = { level: 40, xp: 0 };
    const skilled = dishQuality(g.state, pot(['raw_meat', 'f'], ['wild_onion', 'f']));
    expect(qualityRank(skilled)).toBeGreaterThanOrEqual(qualityRank(raw));
    expect(skilled).not.toBe('s');
  });

  it('cooking spends the basket and stocks the dish at its grade', () => {
    const g = fresh();
    kitchen(g);
    const before = stockOf(g.state, 'raw_meat', 'c');

    const result = cook(g.state, g.bus, pot(['raw_meat', 'c'], ['wild_onion', 'c']))!;
    expect(result.dish).toBe('hearty_stew');
    expect(stockOf(g.state, 'raw_meat', 'c')).toBe(before - 1);
    expect(stockOf(g.state, 'hearty_stew', result.quality)).toBe(1);
  });

  it('cookware is worked with, not eaten', () => {
    const g = fresh();
    kitchen(g);
    grantGraded(g.state, 'iron_pot', 'b', 1);
    cook(g.state, g.bus, pot(['raw_meat', 'c'], ['wild_onion', 'c'], { pot: at('iron_pot', 'b') }));
    expect(stockOf(g.state, 'iron_pot', 'b')).toBe(1);
  });
});

describe('using what you cooked', () => {
  it('an instant restores the whole amount at once', () => {
    const g = fresh();
    grantGraded(g.state, 'healing_salve', 'c', 2);
    const stats = getDerivedStats(g.state);
    g.state.resources.hp = 1;

    useConsumable(g.state, g.bus, 'healing_salve', 'c');
    // 25 flat + 10% of max, all of it immediately.
    expect(resourceValue(g.state, 'hp')).toBeGreaterThan(25);
    expect(stockOf(g.state, 'healing_salve', 'c')).toBe(1);
    void stats;
  });

  it('a sustained effect grants a condition instead, and feeds you over time', () => {
    const g = fresh();
    grantGraded(g.state, 'hearty_stew', 'c', 1);
    g.state.resources.hp = 10;

    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    expect(hasStatus(g.state, 'well_fed')).toBe(true);
    // Nothing arrives at the moment of eating — it comes with the ticks.
    const justAfter = resourceValue(g.state, 'hp');
    for (let i = 0; i < 60; i++) g.tick();
    expect(resourceValue(g.state, 'hp')).toBeGreaterThan(justAfter);
  });

  it('grade scales what a dish is worth', () => {
    const poor = fresh();
    const fine = fresh();
    grantGraded(poor.state, 'hearty_stew', 'e', 1);
    grantGraded(fine.state, 'hearty_stew', 's', 1);
    useConsumable(poor.state, poor.bus, 'hearty_stew', 'e');
    useConsumable(fine.state, fine.bus, 'hearty_stew', 's');

    const bite = (g: Game) => findStatus(g.state, 'well_fed')!.intensity;
    expect(bite(fine)).toBeGreaterThan(bite(poor));
    // And the buff it grants is worth more, measurably.
    expect(getDerivedStats(fine.state).maxHp).toBeGreaterThan(getDerivedStats(poor.state).maxHp);
  });

  it('spoiled food makes you ill instead of feeding you', () => {
    const g = fresh();
    // Even a dish that MEANT to be nourishing turns on you at refuse grade.
    grantGraded(g.state, 'hearty_stew', 'f', 1);
    useConsumable(g.state, g.bus, 'hearty_stew', 'f');
    expect(hasStatus(g.state, 'well_fed')).toBe(false);
    expect(hasStatus(g.state, 'queasy')).toBe(true);
  });

  it('will not use what you do not have, and spends nothing trying', () => {
    const g = fresh();
    expect(canUse(g.state, 'hearty_stew', 'c').ok).toBe(false);
    expect(useConsumable(g.state, g.bus, 'hearty_stew', 'c')).toBeNull();
  });

  it('respects a cooldown', () => {
    const g = fresh();
    grantGraded(g.state, 'healing_salve', 'c', 2);
    useConsumable(g.state, g.bus, 'healing_salve', 'c');
    expect(cooldownLeft(g.state, 'healing_salve')).toBeGreaterThan(0);
    expect(useConsumable(g.state, g.bus, 'healing_salve', 'c')).toBeNull();
    expect(stockOf(g.state, 'healing_salve', 'c')).toBe(1); // nothing wasted

    g.state.totalTicks += 200;
    expect(canUse(g.state, 'healing_salve', 'c').ok).toBe(true);
  });

  it('a salve counts as real treatment, so it closes wounds', () => {
    const g = fresh();
    grantGraded(g.state, 'healing_salve', 'c', 1);
    g.state.resources.hp = 10;
    g.state.statuses.push({ id: 'bleeding', intensity: 1, peak: 1, stacks: 1, ticksLeft: null });

    useConsumable(g.state, g.bus, 'healing_salve', 'c');
    expect(hasStatus(g.state, 'bleeding')).toBe(false);
  });

  it('lists what is held, per grade', () => {
    const g = fresh();
    grantGraded(g.state, 'hearty_stew', 'c', 2);
    grantGraded(g.state, 'hearty_stew', 'a', 1);
    const held = heldConsumables(g.state);
    expect(held).toHaveLength(2);
    expect(held.map((h) => h.quality)).toContain('a');
  });
});

describe('a dish lasts the way its condition does', () => {
  it('a set duration runs out on its own', () => {
    const g = fresh();
    grantGraded(g.state, 'skewered_fish', 'c', 1);
    useConsumable(g.state, g.bus, 'skewered_fish', 'c');
    const held = findStatus(g.state, 'steady_hand')!;
    expect(held.ticksLeft).toBeGreaterThan(0);

    held.ticksLeft = 1;
    g.tick();
    expect(hasStatus(g.state, 'steady_hand')).toBe(false);
  });

  it('a buff actually reaches the stat block while it holds', () => {
    const g = fresh();
    const before = getDerivedStats(g.state).crit;
    grantGraded(g.state, 'skewered_fish', 'c', 1);
    useConsumable(g.state, g.bus, 'skewered_fish', 'c');
    expect(getDerivedStats(g.state).crit).toBeGreaterThan(before);
  });

  it('a dish that only restores does so within its pool ceiling', () => {
    const g = fresh();
    grantGraded(g.state, 'hearty_stew', 'c', 1);
    const stats = getDerivedStats(g.state);
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    for (let i = 0; i < 200; i++) g.tick();
    expect(resourceValue(g.state, 'hp')).toBeLessThanOrEqual(
      availableMax(g.state, getDerivedStats(g.state), 'hp'),
    );
    void stats;
  });
});
