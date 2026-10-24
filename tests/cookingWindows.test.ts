import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { DISCIPLINES } from '../src/core/data/disciplines.data';
import { PREPS, UNIFORMITY } from '../src/core/data/preps.data';
import { QUALITY_ORDER, qualityMult } from '../src/core/data/quality.data';
import { MATERIALS, NPCS, STATUSES } from '../src/core/registry';
import {
  craftTagsOf,
  grantGraded,
  heatWindowProblems,
  knowsRecipe,
  matchOutcome,
  meanExposure,
  slotAccepts,
  slotPicks,
  stockOf,
  type Placement,
} from '../src/core/systems/disciplines';
import {
  JUDGEMENT_CAP,
  cook,
  cookJudgement,
  cookLedger,
  dishQuality,
  dishQualityRange,
  exposureInfo,
  isPrepped,
  previewCook,
  tierFor,
} from '../src/core/systems/cooking';
import { startBenchWork } from '../src/core/systems/benchwork';
import { useConsumable } from '../src/core/systems/consumables';
import { getDerivedStats } from '../src/core/systems/derived';
import { applyStatus, findStatus } from '../src/core/systems/statuses';
import type { CraftDisciplineDef, CraftOutcomeDef, GradedStack, QualityTier } from '../src/core/types';

const STOVE = DISCIPLINES.cooking;
const at = (id: string, quality: QualityTier = 'c'): GradedStack => ({ id, quality });
const CARDS = ['seared_stew', 'braised_meat', 'steeped_broth'];

function kitchen(level = 1, cards: string[] = []) {
  const g = new Game(createInitialState(1));
  g.state.skills.cooking = { level, xp: 0 };
  for (const c of cards) g.state.stats[`recipe:${c}`] = 1;
  for (const id of ['raw_meat', 'wild_onion', 'cave_mushroom', 'common_herb', 'river_fish']) {
    grantGraded(g.state, id, 'c', 10);
  }
  return g;
}

/** What the stove makes of two ingredients, in each of the two required slots. */
function dish(g: Game, first: string, second: string, duration: number): string | undefined {
  return previewCook(g.state, { main: at(first), second: at(second) }, STOVE, duration).outcome?.id;
}

describe('heat windows: the clock picks the dish', () => {
  it('meat and onion: seared, hearty or braised by when the meat goes in', () => {
    const g = kitchen(1, CARDS);
    // Exposure is duration × (1 − slot.at): first slot sees all of it, the
    // midway slot (at 0.33) sees 67%.
    //
    //   duration   meat first         meat midway
    //   8          8.0    hearty      5.4    SEARED  (under 6)
    //   12         12.0   hearty      8.0    hearty
    //   16         16.0   BRAISED     10.7   hearty  (14 or more)
    expect(dish(g, 'raw_meat', 'wild_onion', 8)).toBe('stew');
    expect(dish(g, 'wild_onion', 'raw_meat', 8)).toBe('seared_stew');
    expect(dish(g, 'raw_meat', 'wild_onion', 12)).toBe('stew');
    expect(dish(g, 'wild_onion', 'raw_meat', 12)).toBe('stew');
    expect(dish(g, 'raw_meat', 'wild_onion', 16)).toBe('braised_meat');
    expect(dish(g, 'wild_onion', 'raw_meat', 16)).toBe('stew');
  });

  it('mushroom and herb: steeped when the herb has 8 units, a plain broth below', () => {
    const g = kitchen(1, CARDS);
    expect(dish(g, 'common_herb', 'cave_mushroom', 8)).toBe('steeped_broth'); // 8.0, the edge is inside
    expect(dish(g, 'cave_mushroom', 'common_herb', 8)).toBe('broth'); // 5.4
    expect(dish(g, 'common_herb', 'cave_mushroom', 12)).toBe('steeped_broth');
    expect(dish(g, 'cave_mushroom', 'common_herb', 12)).toBe('steeped_broth'); // 8.04
    expect(dish(g, 'common_herb', 'cave_mushroom', 16)).toBe('steeped_broth');
    expect(dish(g, 'cave_mushroom', 'common_herb', 16)).toBe('steeped_broth'); // 10.7
  });

  it('every duration and slot: the expected dish with the cards read, the old dish with none', () => {
    const read = kitchen(1, CARDS);
    const bare = kitchen(1);
    for (const units of STOVE.timeline!.options.map((o) => o.units)) {
      for (const [meatSlot, at_] of [['main', 0], ['second', 0.33]] as const) {
        const placement: Placement =
          meatSlot === 'main'
            ? { main: at('raw_meat'), second: at('wild_onion') }
            : { main: at('wild_onion'), second: at('raw_meat') };
        const exposure = units * (1 - at_);
        const expected = exposure < 6 ? 'seared_stew' : exposure >= 14 ? 'braised_meat' : 'stew';
        const label = `${units} units, meat in ${meatSlot} (${exposure.toFixed(2)})`;
        expect(previewCook(read.state, placement, STOVE, units).outcome?.id, label).toBe(expected);
        expect(previewCook(bare.state, placement, STOVE, units).outcome?.id, `${label}, no cards`).toBe('stew');
      }
      for (const [herbSlot, at_] of [['main', 0], ['second', 0.33]] as const) {
        const placement: Placement =
          herbSlot === 'main'
            ? { main: at('common_herb'), second: at('cave_mushroom') }
            : { main: at('cave_mushroom'), second: at('common_herb') };
        const expected = units * (1 - at_) >= 8 ? 'steeped_broth' : 'broth';
        const label = `${units} units, herb in ${herbSlot}`;
        expect(previewCook(read.state, placement, STOVE, units).outcome?.id, label).toBe(expected);
        expect(previewCook(bare.state, placement, STOVE, units).outcome?.id, `${label}, no cards`).toBe('broth');
      }
    }
  });

  it('each card opens only its own dish', () => {
    const g = kitchen(1, ['braised_meat']);
    expect(dish(g, 'wild_onion', 'raw_meat', 8)).toBe('stew'); // seared window, no seared card
    expect(dish(g, 'raw_meat', 'wild_onion', 16)).toBe('braised_meat');
    expect(dish(g, 'common_herb', 'cave_mushroom', 12)).toBe('broth');
  });

  it('the default duration is used when none is passed', () => {
    const g = kitchen(1, CARDS);
    // Steady stew (12): herb first is 12 units.
    expect(previewCook(g.state, { main: at('common_herb'), second: at('cave_mushroom') }).outcome?.id)
      .toBe('steeped_broth');
    expect(STOVE.timeline!.default).toBe(12);
  });

  it('a stated mean stands in for the measured one, for read-only what-ifs', () => {
    const g = kitchen(1, CARDS);
    const pot: Placement = { main: at('raw_meat'), second: at('wild_onion') };
    // Measured, the meat sees 12 units: a Hearty Stew. Stated, it sees what we say.
    const asked = (mean: number) => matchOutcome(g.state, STOVE, pot, 12, { tag: 'meat', mean })?.id;
    expect(matchOutcome(g.state, STOVE, pot, 12)?.id).toBe('stew');
    expect(asked(5)).toBe('seared_stew');
    expect(asked(6)).toBe('stew'); // the edge of a half-open window is outside it
    expect(asked(14)).toBe('braised_meat');
    // Only the named tag is overridden, and nothing on the bench moves.
    expect(matchOutcome(g.state, STOVE, pot, 12, { tag: 'herb', mean: 5 })?.id).toBe('stew');
    expect(pot).toEqual({ main: at('raw_meat'), second: at('wild_onion') });
    expect(stockOf(g.state, 'raw_meat', 'c')).toBe(10);
  });

  it('the mean over every part with the tag decides, not the best of them', () => {
    const g = kitchen(8, CARDS); // third slot (0.66) opens
    // Meat first (16 units) and a fish midway (10.72) both carry `meat`:
    // the mean is 13.36, short of 14, so the dish is not braised.
    const placement: Placement = { main: at('raw_meat'), second: at('river_fish'), third: at('wild_onion') };
    expect(meanExposure(STOVE, placement, 'meat', 16)).toBeCloseTo(13.36, 2);
    expect(previewCook(g.state, placement, STOVE, 16).outcome?.id).toBe('stew');
    // With the fish out of the pot only the meat carries the tag, and 16 is enough.
    const alone: Placement = { main: at('raw_meat'), second: at('wild_onion'), third: at('cave_mushroom') };
    expect(meanExposure(STOVE, alone, 'meat', 16)).toBe(16);
    expect(previewCook(g.state, alone, STOVE, 16).outcome?.id).toBe('braised_meat');
  });

  it('the third slot reaches the seared window at every duration', () => {
    const g = kitchen(8, CARDS);
    // Late-addition meat sees 66% less of the pot: 2.7, 4.1, 5.4 units.
    for (const units of [8, 12, 16]) {
      const placement: Placement = { main: at('wild_onion'), second: at('cave_mushroom'), third: at('raw_meat') };
      expect(previewCook(g.state, placement, STOVE, units).outcome?.id, `${units}`).toBe('seared_stew');
    }
  });

  it('only timed slots count: seasoning and cookware stand outside time', () => {
    const placement: Placement = {
      main: at('wild_onion'),
      second: at('raw_meat'),
      seasoning: at('rock_salt'),
      pot: at('iron_pot'),
    };
    expect(meanExposure(STOVE, placement, 'meat', 8)).toBeCloseTo(5.36, 2);
    // A tag carried only by a part in an untimed slot has no exposure at all.
    expect(meanExposure(STOVE, placement, 'seasoning', 8)).toBeNull();
    expect(meanExposure(STOVE, placement, 'cookware', 8)).toBeNull();
  });

  it('a bench with no timeline never matches a windowed outcome', () => {
    const g = kitchen(1);
    // The stove's own outcomes, recipe gates stripped so the card is not what
    // decides; same layout, same tags.
    const outcomes = STOVE.outcomes.map((o) => ({ ...o, recipe: undefined }));
    const timed: CraftDisciplineDef = { ...STOVE, outcomes };
    const untimed: CraftDisciplineDef = { ...STOVE, timeline: undefined, outcomes };
    const placement: Placement = { main: at('wild_onion'), second: at('raw_meat') };
    expect(matchOutcome(g.state, timed, placement, 8)?.id).toBe('seared_stew');
    expect(matchOutcome(g.state, untimed, placement, 8)?.id).toBe('stew');
    expect(meanExposure(untimed, placement, 'meat', 8)).toBeNull();
  });

  it('an outcome whose tagged part is absent does not match', () => {
    const g = kitchen(1);
    const odd: CraftOutcomeDef = {
      id: 'odd',
      name: 'Odd',
      icon: '?',
      requires: [{ tag: 'vegetable' }],
      heat: [{ tag: 'meat', from: 0 }],
      priority: 99,
      result: { kind: 'material', id: 'hearty_stew' },
    };
    const disc: CraftDisciplineDef = { ...STOVE, outcomes: [odd, ...STOVE.outcomes] };
    // No part carries `meat`, so the window has nothing to average.
    expect(matchOutcome(g.state, disc, { main: at('wild_onion'), second: at('cave_mushroom') }, 8)?.id).not.toBe('odd');
    expect(matchOutcome(g.state, disc, { main: at('wild_onion'), second: at('raw_meat') }, 8)?.id).toBe('odd');
  });

  it('the preview names the windows that applied and the mean the parts got', () => {
    const g = kitchen(1, CARDS);
    const seared = previewCook(g.state, { main: at('wild_onion'), second: at('raw_meat') }, STOVE, 8);
    expect(seared.heatExposure).toHaveLength(1);
    expect(seared.heatExposure![0]).toMatchObject({ tag: 'meat', to: 6 });
    expect(seared.heatExposure![0].mean).toBeCloseTo(5.36, 2);
    const braised = previewCook(g.state, { main: at('raw_meat'), second: at('wild_onion') }, STOVE, 16);
    expect(braised.heatExposure![0]).toMatchObject({ tag: 'meat', from: 14, mean: 16 });
    // The fallback declares no window, so it reports none.
    expect(previewCook(g.state, { main: at('raw_meat'), second: at('wild_onion') }, STOVE, 12).heatExposure)
      .toBeUndefined();
  });

  it('cooking at the chosen duration makes the windowed dish, spending the basket', () => {
    const g = kitchen(1, CARDS);
    const before = stockOf(g.state, 'wild_onion', 'c');
    const done = cook(g.state, g.bus, { main: at('wild_onion'), second: at('raw_meat') }, STOVE, 8)!;
    expect(done.dish).toBe('seared_stew');
    expect(stockOf(g.state, 'seared_stew', done.quality)).toBe(1);
    expect(stockOf(g.state, 'wild_onion', 'c')).toBe(before - 1);
  });

  it('a bench run carries its duration into every craft', () => {
    const g = kitchen(1, CARDS);
    g.state.spot = 'granary_kitchens';
    const placement: Placement = { main: at('wild_onion'), second: at('raw_meat') };
    expect(startBenchWork(g.state, g.bus, 'cooking', placement, { count: 2, duration: 8 })).toBe(true);
    for (let i = 0; i < 200; i++) g.tick();
    const held = (id: string) => QUALITY_ORDER.reduce((n, q) => n + stockOf(g.state, id, q), 0);
    expect(held('seared_stew')).toBe(2);
    expect(held('hearty_stew')).toBe(0);
  });
});

describe('the cards and their dishes', () => {
  it('the Larder Door sells all five cards, and reading one teaches its dish', () => {
    const lines = NPCS.head_chef.shop!.lines.map((l) => l.id);
    for (const c of CARDS) expect(lines).toContain(`recipe_${c}`);
    const g = kitchen(1);
    for (const c of CARDS) {
      expect(knowsRecipe(g.state, c)).toBe(false);
      g.state.materials[`recipe_${c}`] = 1;
      expect(useConsumable(g.state, g.bus, `recipe_${c}`)).not.toBeNull();
      expect(knowsRecipe(g.state, c)).toBe(true);
    }
  });

  it('each card states its window in plain numbers', () => {
    expect(MATERIALS.recipe_seared_stew.desc).toMatch(/under 6 units/);
    expect(MATERIALS.recipe_braised_meat.desc).toMatch(/14 units or more/);
    expect(MATERIALS.recipe_steeped_broth.desc).toMatch(/8 units or more/);
  });

  it('dishes are priced near the dishes they sit beside', () => {
    for (const id of ['seared_stew', 'braised_meat', 'steeped_broth']) {
      const value = MATERIALS[id].value;
      expect(value, id).toBeGreaterThanOrEqual(MATERIALS.hearty_stew.value);
      expect(value, id).toBeLessThanOrEqual(MATERIALS.fish_onion_pot.value);
    }
  });

  it('Braised Meat feeds at 1.5 for fifteen minutes, longer than Hearty Stew', () => {
    const g = kitchen(1);
    grantGraded(g.state, 'braised_meat', 'c', 1);
    useConsumable(g.state, g.bus, 'braised_meat', 'c');
    const fed = findStatus(g.state, 'well_fed')!;
    expect(fed.intensity).toBeCloseTo(1.5);
    expect(fed.ticksLeft).toBe(15 * 60 * 10);
    expect(STATUSES.well_fed.duration).toBe(10 * 60 * 10);
  });

  it('Seared Stew grants Stoked, scaled by the dish grade', () => {
    const g = kitchen(1);
    grantGraded(g.state, 'seared_stew', 'b', 1);
    const before = getDerivedStats(g.state);
    useConsumable(g.state, g.bus, 'seared_stew', 'b');
    const stoked = findStatus(g.state, 'stoked')!;
    expect(stoked.intensity).toBeCloseTo(1.6);
    expect(stoked.ticksLeft).toBe(5 * 60 * 10);
    const after = getDerivedStats(g.state);
    // Fine is ×1.6: +8% damage, +0.08 on the crit multiplier.
    expect(after.damage / before.damage).toBeCloseTo(1.08, 5);
    expect(after.critDamage - before.critDamage).toBeCloseTo(0.08, 5);
  });

  it('Steeped Broth scales with grade: Fair +0.25 poison, Divine +1.00', () => {
    for (const [grade, poison, acid] of [['c', 0.25, 0.1], ['s', 1, 0.4]] as const) {
      const g = kitchen(1);
      const base = getDerivedStats(g.state);
      grantGraded(g.state, 'steeped_broth', grade, 1);
      useConsumable(g.state, g.bus, 'steeped_broth', grade);
      const after = getDerivedStats(g.state);
      const wanted = Math.min(0.75, base.resPoison + poison);
      expect(after.resPoison, grade).toBeCloseTo(wanted, 5);
      expect(after.resAcid, grade).toBeCloseTo(Math.min(0.75, base.resAcid + acid), 5);
    }
  });
});

describe('a Divine Steeped Broth makes poison fail to land', () => {
  const POISON = 'poison';

  function steeped(grade: QualityTier) {
    const g = kitchen(1);
    grantGraded(g.state, 'steeped_broth', grade, 1);
    useConsumable(g.state, g.bus, 'steeped_broth', grade);
    return g;
  }

  it('the condition under test is a poison affliction', () => {
    expect(STATUSES[POISON].element).toBe('poison');
  });

  it('at Divine (resistance 1.00) it does not land, though damage resistance stays capped', () => {
    const g = steeped('s');
    const stats = getDerivedStats(g.state);
    expect(stats.resPoison).toBeCloseTo(0.75); // the damage cap holds
    expect(applyStatus(g.state, g.state, { id: POISON, intensity: 1 }, 'a fang', stats)).toBeNull();
    expect(findStatus(g.state, POISON)).toBeUndefined();
  });

  it('the same dose lands at the floor once the applier has 0.2 penetration', () => {
    const g = steeped('s');
    const stats = getDerivedStats(g.state);
    const landed = applyStatus(g.state, g.state, { id: POISON, intensity: 1 }, 'a fang', stats, 0.2);
    expect(landed).not.toBeNull();
    expect(landed!.intensity).toBeCloseTo(0.25); // APPLICATION_FLOOR
  });

  it('Superb (0.625) is not immune: it lands at 37.5%', () => {
    const g = steeped('a');
    const stats = getDerivedStats(g.state);
    const landed = applyStatus(g.state, g.state, { id: POISON, intensity: 1 }, 'a fang', stats);
    expect(landed!.intensity).toBeCloseTo(1 - 0.625, 3);
  });

  it('without the broth the same bite lands in full', () => {
    const g = kitchen(1);
    const landed = applyStatus(g.state, g.state, { id: POISON, intensity: 1 }, 'a fang', getDerivedStats(g.state));
    expect(landed!.intensity).toBeCloseTo(1 - getDerivedStats(g.state).resPoison);
  });
});

describe('the cook’s judgement is capped', () => {
  it('is 1.00 at Cooking 15, 2.00 at 60 and flat after', () => {
    expect(cookJudgement(1)).toBeCloseTo(1 / 15, 6);
    expect(cookJudgement(15)).toBeCloseTo(1, 6);
    expect(cookJudgement(45)).toBeCloseTo(1 + 30 / 45, 6);
    expect(cookJudgement(60)).toBeCloseTo(2, 6);
    expect(cookJudgement(200)).toBe(JUDGEMENT_CAP);
    expect(cookJudgement(0)).toBe(0);
  });

  it('Fair ingredients top out at Superb; Divine needs Superb ingredients', () => {
    const grades = (level: number, grade: QualityTier) => {
      const g = kitchen(level);
      return dishQuality(g.state, { main: at('raw_meat', grade), second: at('wild_onion', grade) });
    };
    // Fair (1.0) + judgement: c, b, a, a, a
    expect([1, 15, 45, 60, 200].map((l) => grades(l, 'c'))).toEqual(['c', 'b', 'a', 'a', 'a']);
    // Fine (1.6) + 2.0 stays under Divine's 4.0; Superb (2.5) + 2.0 reaches it.
    expect(grades(200, 'b')).toBe('a');
    expect(grades(200, 'a')).toBe('s');
    expect(grades(60, 'a')).toBe('s');
    // Superb needs 1.5 of judgement to reach 4.0, which is Cooking 38.
    expect(grades(30, 'a')).toBe('a');
    expect(grades(38, 'a')).toBe('s');
  });
});

describe('the exposure read-out for the heat track', () => {
  const timed = STOVE.slots.filter((s) => s.at != null);

  it('reports the band, the peak and the entry window', () => {
    // Julienne wants 2–5 units: at 12 units it has to go in between unit 7 and 10.
    const julienne = exposureInfo(STOVE, timed[1], 'wild_onion_julienned', 12)!;
    expect(julienne.band).toEqual([2, 5]);
    expect(julienne.peak).toBe(1.15);
    expect(julienne.window[0]).toBeCloseTo(7, 6);
    expect(julienne.window[1]).toBeCloseTo(10, 6);
    // A whole onion (3–16) at 8 units: any entry from the start to unit 5.
    const whole = exposureInfo(STOVE, timed[0], 'wild_onion', 8)!;
    expect(whole.band).toEqual([3, 16]);
    expect(whole.window).toEqual([0, 5]);
  });

  it('the window agrees with the verdict for every cut, slot and duration', () => {
    const cuts = ['wild_onion', 'wild_onion_sliced', 'wild_onion_diced', 'wild_onion_julienned'];
    for (const id of cuts) {
      for (const units of STOVE.timeline!.options.map((o) => o.units)) {
        for (const slot of timed) {
          const info = exposureInfo(STOVE, slot, id, units)!;
          const entry = units * slot.at!;
          const inside = entry >= info.window[0] - 1e-9 && entry <= info.window[1] + 1e-9;
          expect(inside, `${id} in ${slot.id} at ${units}`).toBe(info.verdict === 'in its element');
        }
      }
    }
  });

  it('is null off the clock: seasoning, and benches with no timeline', () => {
    const salt = STOVE.slots.find((s) => s.id === 'seasoning')!;
    expect(exposureInfo(STOVE, salt, 'rock_salt', 12)).toBeNull();
    expect(exposureInfo(DISCIPLINES.grilling, DISCIPLINES.grilling.slots[0], 'raw_meat')).toBeNull();
  });
});

describe('the grade ledger', () => {
  it('lays a dish out part by part, with the gap to the next tier', () => {
    const g = kitchen(15);
    const ledger = cookLedger(g.state, { second: at('wild_onion'), main: at('raw_meat') }, STOVE, 12);
    // Rows come in the bench's slot order, whatever order they were placed in.
    expect(ledger.rows.map((r) => r.slotId)).toEqual(['main', 'second']);
    expect(ledger.rows.every((r) => !r.tool && r.fit === 1 && r.lo === 1 && r.hi === 1)).toBe(true);
    expect(ledger.mean).toEqual([1, 1]);
    expect(ledger.judgement).toBeCloseTo(1);
    expect(ledger.benchFit).toBe(0);
    expect(ledger.score[0]).toBeCloseTo(2);
    expect(tierFor(ledger.score[0])).toBe('b');
    expect(ledger.next).toMatchObject({ tier: 'a', at: 2.5 });
    expect(ledger.next!.shortWorst).toBeCloseTo(0.5);
    expect(ledger.next!.shortBest).toBeCloseTo(0.5);
  });

  it('marks cookware, which is averaged in like an ingredient', () => {
    const g = kitchen(1);
    const ledger = cookLedger(
      g.state,
      { main: at('raw_meat'), second: at('wild_onion'), pot: at('iron_pot', 'b'), seasoning: at('rock_salt') },
      STOVE,
    );
    expect(ledger.rows.map((r) => [r.slotId, r.tool])).toEqual([
      ['main', false],
      ['second', false],
      ['seasoning', false],
      ['pot', true],
    ]);
    // Iron pot at Fine (1.6) lifts the mean of Fair parts: (1 + 1 + 1 + 1.6) / 4.
    expect(ledger.mean[0]).toBeCloseTo(4.6 / 4);
  });

  it('rows carry the exposure fit and the cut’s uniformity band', () => {
    const g = kitchen(10);
    const ledger = cookLedger(
      g.state,
      { main: at('raw_meat'), second: at('wild_onion_julienned', 'c') },
      STOVE,
      16,
    );
    const julienne = ledger.rows.find((r) => r.slotId === 'second')!;
    const info = exposureInfo(STOVE, STOVE.slots.find((s) => s.id === 'second')!, 'wild_onion_julienned', 16)!;
    expect(julienne.fit).toBe(info.fit);
    expect(julienne.fit).toBeLessThan(1); // 10.7 units is far past julienne's 2–5
    const [a, b] = UNIFORMITY.c;
    expect(julienne.lo).toBeCloseTo(qualityMult('c') * info.fit * a);
    expect(julienne.hi).toBeCloseTo(qualityMult('c') * info.fit * b);
    expect(ledger.score[1]).toBeGreaterThan(ledger.score[0]);
  });

  it('an empty pot scores nothing and has no next tier; Divine has none either', () => {
    const g = kitchen(1);
    const empty = cookLedger(g.state, {}, STOVE);
    expect(empty).toMatchObject({ rows: [], mean: [0, 0], score: [0, 0] });
    expect(empty.next).toBeUndefined();
    expect(dishQualityRange(g.state, {}, STOVE)).toEqual({ min: 'f', max: 'f' });

    const top = kitchen(60);
    const divine = cookLedger(top.state, { main: at('raw_meat', 'a'), second: at('wild_onion', 'a') }, STOVE);
    expect(tierFor(divine.score[0])).toBe('s');
    expect(divine.next).toBeUndefined();
  });

  it('a best case that reaches the next tier reports zero short', () => {
    // Fair diced onions on the stove (which favors dice) at Cooking 3: each part
    // contributes 1.12 × [0.55, 0.8], the mean is [0.616, 0.896], and 0.2 of
    // judgement plus 0.6 of bench fit makes the score [1.416, 1.696] across
    // Fine's 1.6.
    const g = kitchen(3);
    const ledger = cookLedger(g.state, { main: at('wild_onion_diced'), second: at('wild_onion_diced') }, STOVE, 12);
    expect(ledger.score[0]).toBeCloseTo(1.416, 3);
    expect(ledger.score[1]).toBeCloseTo(1.696, 3);
    expect(dishQualityRange(g.state, { main: at('wild_onion_diced'), second: at('wild_onion_diced') }, STOVE, 12))
      .toEqual({ min: 'c', max: 'b' });
    expect(ledger.next).toMatchObject({ tier: 'b', at: 1.6, shortBest: 0 });
    expect(ledger.next!.shortWorst).toBeCloseTo(0.184, 3);
  });

  /** A small seeded generator so a failure names its own trial. */
  function rng(seed: number) {
    let s = seed;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const POOL = [
    'raw_meat', 'wild_onion', 'cave_mushroom', 'common_herb', 'river_fish', 'rock_salt', 'wild_honey',
    'rough_flour', 'forest_berries', 'bird_egg', 'rustic_loaf', 'seared_steak', 'iron_pot',
    ...['wild_onion', 'raw_meat', 'cave_mushroom'].flatMap((b) => Object.keys(PREPS).map((p) => `${b}_${p}`)),
  ];
  const BENCHES = [STOVE, DISCIPLINES.grilling, DISCIPLINES.baking, DISCIPLINES.assembling];

  /** The grade range as it was computed before the ledger existed (cap aside). */
  function referenceRange(level: number, disc: CraftDisciplineDef, placement: Placement, duration?: number) {
    const parts = Object.entries(placement).filter((e): e is [string, GradedStack] => !!e[1]);
    let lo = 0;
    let hi = 0;
    for (const [slotId, part] of parts) {
      const slot = disc.slots.find((s) => s.id === slotId)!;
      const fit = disc.timeline && slot.at != null ? exposureInfo(disc, slot, part.id, duration)!.fit : 1;
      const scaled = qualityMult(part.quality) * fit;
      if (!isPrepped(part.id)) {
        lo += scaled;
        hi += scaled;
      } else {
        const [a, b] = UNIFORMITY[part.quality];
        lo += scaled >= 0 ? scaled * a : scaled * b;
        hi += scaled >= 0 ? scaled * b : scaled * a;
      }
    }
    const matched = disc.favoredPrep
      ? parts.filter(([, p]) => craftTagsOf(p.id).includes(disc.favoredPrep!)).length
      : 0;
    const judgement = Math.min(2, Math.min(level, 15) / 15 + Math.max(0, level - 15) / 45);
    const nudge = judgement + (disc.favoredPrep ? 0.6 * (matched / parts.length) : 0);
    return { min: tierFor(lo / parts.length + nudge), max: tierFor(hi / parts.length + nudge) };
  }

  it('maps to exactly the range dishQualityRange returns, over seeded random layouts', () => {
    const rand = rng(20261023);
    const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
    const g = kitchen(1);
    let ranged = 0;
    for (let trial = 0; trial < 600; trial++) {
      const disc = pick(BENCHES);
      const level = 1 + Math.floor(rand() * 80);
      g.state.skills.cooking = { level, xp: 0 };
      const duration = disc.timeline ? pick(disc.timeline.options).units : undefined;
      const placement: Placement = {};
      for (const slot of disc.slots) {
        if ((slot.unlockLevel ?? 0) > level) continue;
        if (slot.optional && rand() < 0.4) continue;
        if (slotPicks(slot) === 'design') continue;
        const candidates = POOL.filter((id) => MATERIALS[id] && slotAccepts(slot, id));
        if (candidates.length === 0) continue;
        placement[slot.id] = at(pick(candidates), pick(QUALITY_ORDER));
      }
      if (Object.keys(placement).length === 0) continue;

      const label = `trial ${trial} ${disc.id} L${level} D${duration}`;
      const ledger = cookLedger(g.state, placement, disc, duration);
      const range = dishQualityRange(g.state, placement, disc, duration);

      // The ledger's score maps to exactly the range…
      expect(tierFor(ledger.score[0]), label).toBe(range.min);
      expect(tierFor(ledger.score[1]), label).toBe(range.max);
      // …which is what the arithmetic outside the module says it should be…
      const ref = referenceRange(level, disc, placement, duration);
      expect(range, label).toEqual(ref);
      // …and the ledger's own lines add up.
      expect(ledger.rows.length, label).toBe(Object.keys(placement).length);
      expect(ledger.mean[0], label).toBeCloseTo(ledger.rows.reduce((s, r) => s + r.lo, 0) / ledger.rows.length, 9);
      expect(ledger.mean[1], label).toBeCloseTo(ledger.rows.reduce((s, r) => s + r.hi, 0) / ledger.rows.length, 9);
      expect(ledger.score[0], label).toBeCloseTo(ledger.mean[0] + ledger.judgement + ledger.benchFit, 9);
      expect(ledger.score[1], label).toBeCloseTo(ledger.mean[1] + ledger.judgement + ledger.benchFit, 9);
      expect(ledger.judgement, label).toBeCloseTo(cookJudgement(level), 9);
      if (level <= 15) expect(ledger.judgement, label).toBeCloseTo(level / 15, 9);
      if (range.min !== range.max) ranged++;
    }
    // The sweep reached prepped parts, so ranges were really exercised.
    expect(ranged).toBeGreaterThan(5);
  });

  it('the cooked dish lands inside the ledger’s range', () => {
    const g = kitchen(30);
    for (const id of ['wild_onion_diced', 'wild_onion_sliced']) grantGraded(g.state, id, 'c', 20);
    const placement: Placement = { main: at('raw_meat'), second: at('wild_onion_diced') };
    const range = dishQualityRange(g.state, placement, STOVE, 12);
    for (let i = 0; i < 10; i++) {
      const made = cook(g.state, g.bus, placement, STOVE, 12)!;
      expect(QUALITY_ORDER.indexOf(made.quality)).toBeGreaterThanOrEqual(QUALITY_ORDER.indexOf(range.min));
      expect(QUALITY_ORDER.indexOf(made.quality)).toBeLessThanOrEqual(QUALITY_ORDER.indexOf(range.max));
    }
  });
});

describe('heat window lints (heatWindowProblems)', () => {
  const stew = STOVE.outcomes.find((o) => o.id === 'stew')!;
  const seared = STOVE.outcomes.find((o) => o.id === 'seared_stew')!;
  const withOutcomes = (outcomes: CraftOutcomeDef[]): CraftDisciplineDef => ({ ...STOVE, outcomes });
  const lint = (disc: CraftDisciplineDef) => heatWindowProblems(disc, MATERIALS).map((p) => `${p.outcome}: ${p.message}`);

  it('the live benches are clean', () => {
    for (const disc of Object.values(DISCIPLINES)) expect(lint(disc)).toEqual([]);
  });

  it('every windowed dish is gated by a card and sits above its fallback', () => {
    for (const o of STOVE.outcomes.filter((x) => x.heat?.length)) {
      expect(o.recipe, o.id).toBeTruthy();
      const fallback = STOVE.outcomes.find((f) => f.id === (o.id === 'steeped_broth' ? 'broth' : 'stew'))!;
      expect(o.priority ?? 0, o.id).toBeGreaterThan(fallback.priority ?? 0);
    }
  });

  it('refuses a windowed outcome on a bench with no timeline', () => {
    const grill = DISCIPLINES.grilling;
    const bad: CraftOutcomeDef = { ...seared, recipe: undefined, requires: [{ tag: 'meat' }] };
    expect(lint({ ...grill, outcomes: [...grill.outcomes, bad] }).join('\n')).toMatch(/has no timeline/);
  });

  it('refuses a window with no window-less fallback below it', () => {
    const noStew = withOutcomes(STOVE.outcomes.filter((o) => o.id !== 'stew'));
    expect(lint(noStew).filter((m) => m.startsWith('seared_stew'))[0]).toMatch(/no window-less fallback/);
    expect(lint(noStew).filter((m) => m.startsWith('braised_meat'))[0]).toMatch(/no window-less fallback/);
  });

  it('a fallback that is itself gated is not a fallback', () => {
    const swap = (patch: Partial<CraftOutcomeDef>) =>
      withOutcomes(STOVE.outcomes.map((o) => (o === stew ? { ...o, ...patch } : o)));
    for (const patch of [
      { recipe: 'x' },
      { minLevel: 5 },
      { minQuality: 'b' as QualityTier },
      { maxQuality: 'c' as QualityTier },
      { heat: [{ tag: 'meat', from: 0 }] },
      { priority: 30 }, // not below the windowed dish
    ]) {
      expect(lint(swap(patch)).some((m) => m.startsWith('seared_stew') && /no window-less fallback/.test(m)), JSON.stringify(patch)).toBe(true);
    }
  });

  it('a fallback must be covered by the windowed outcome’s own requirements', () => {
    const picky = withOutcomes(
      STOVE.outcomes.map((o) => (o === stew ? { ...o, requires: [{ tag: 'meat' }, { tag: 'vegetable' }, { tag: 'herb' }] } : o)),
    );
    expect(lint(picky).some((m) => m.startsWith('seared_stew'))).toBe(true);
  });

  it('refuses a window no timeline option and open slot can reach', () => {
    // On the slots open from the start the least meat can see is 5.4 units.
    const never: CraftOutcomeDef = { ...seared, id: 'never', heat: [{ tag: 'meat', to: 2 }] };
    expect(lint(withOutcomes([...STOVE.outcomes, never])).join('\n')).toMatch(/never: .*could never be made/);
    // The late slot opens at Cooking 8 and sees 2.7 units at best, so under 3
    // is reachable for an outcome that asks for that level, and not before it.
    const under3 = (minLevel: number): CraftOutcomeDef => ({ ...seared, id: 'late', minLevel, heat: [{ tag: 'meat', to: 3 }] });
    expect(lint(withOutcomes([...STOVE.outcomes, under3(0)])).join('\n')).toMatch(/late: .*could never be made/);
    expect(lint(withOutcomes([...STOVE.outcomes, under3(8)]))).toEqual([]);
  });

  it('a tag required twice is reachable only if some two slots average inside the window', () => {
    // Matching reads the mean over every meat part. With two required, the two
    // slots open at level 0 (first and midway) average 6.7, 10.0 and 13.4 units
    // at the three durations, so "under 6" is out of reach until the third slot
    // opens at Cooking 8 (2.7 and 5.4 average 4.0 at the quick simmer).
    const twoMeats = (minLevel: number, heat: CraftOutcomeDef['heat']): CraftOutcomeDef => ({
      ...seared,
      id: 'two_meats',
      minLevel,
      requires: [{ tag: 'meat', count: 2 }, { tag: 'vegetable' }],
      heat,
    });
    const under6 = [{ tag: 'meat', to: 6 }];
    expect(lint(withOutcomes([...STOVE.outcomes, twoMeats(0, under6)])).join('\n')).toMatch(/two_meats: .*2 × 'meat' under 6/);
    expect(lint(withOutcomes([...STOVE.outcomes, twoMeats(8, under6)]))).toEqual([]);
    // The same holds from above: the best pair at level 0 is 16 and 10.7, a
    // mean of 13.4, short of 14.
    const over14 = [{ tag: 'meat', from: 14 }];
    expect(lint(withOutcomes([...STOVE.outcomes, twoMeats(0, over14)])).join('\n')).toMatch(/two_meats: .*could never be made/);
    // A tag required once is unchanged: the single best slot decides.
    expect(lint(withOutcomes([...STOVE.outcomes, { ...twoMeats(0, over14), requires: [{ tag: 'meat' }, { tag: 'vegetable' }] }]))).toEqual([]);
    // And more parts than slots open is unreachable, whatever the window.
    const threeMeats: CraftOutcomeDef = { ...twoMeats(0, [{ tag: 'meat', from: 0 }]), requires: [{ tag: 'meat', count: 3 }] };
    expect(lint(withOutcomes([...STOVE.outcomes, threeMeats])).join('\n')).toMatch(/could never be made/);
  });

  it('refuses an empty window', () => {
    const empty: CraftOutcomeDef = { ...seared, id: 'empty', heat: [{ tag: 'meat', from: 10, to: 5 }] };
    expect(lint(withOutcomes([...STOVE.outcomes, empty])).join('\n')).toMatch(/empty: .*is empty/);
  });
});
