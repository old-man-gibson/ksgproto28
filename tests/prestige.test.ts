import { describe, expect, it } from 'vitest';
import { createInitialState, SAVE_VERSION } from '../src/core/state';
import { Game } from '../src/core/game';
import { EventBus } from '../src/core/engine/events';
import { migrate } from '../src/core/save/migrations';
import { deserialize, serialize } from '../src/core/save/save';
import { AREAS, FLOORS, PRESTIGE_BOONS, PRESTIGE_SOURCES, SKILLS, SPOTS, STARTING_SPOT } from '../src/core/registry';
import { TUTORIAL_EXIT } from '../src/core/data/tutorial.data';
import {
  buyBoon,
  canBuyBoon,
  canPrestige,
  forecast,
  harvest,
  leaveReview,
  nextBoonCost,
  nextThreshold,
  pointsFor,
  prestigeNow,
  prestigeVisible,
} from '../src/core/systems/prestige';
import { skillCap } from '../src/core/systems/skills';
import { endowmentBonus, talentBonus } from '../src/core/systems/legacy';
import { getDerivedStats } from '../src/core/systems/derived';
import { attrBreakdown, attrValue, collectBaseMods } from '../src/core/systems/attributes';
import { preparedCap } from '../src/core/systems/spellcraft';
import { startTravel } from '../src/core/systems/locations';
import type { GameState } from '../src/core/types';
import { clearFloors } from './fixtures/floors';

const fresh = (): GameState => createInitialState(0);

/** A run that has cleared band 1 — the brood queen is down. */
function bandOneCleared(): GameState {
  const s = fresh();
  clearFloors(s.stats);
  return s;
}

describe('prestige data', () => {
  it('every boon costs something at every rank (an auto boon\'s first rank excepted), and cap boons name capped skills', () => {
    for (const boon of Object.values(PRESTIGE_BOONS)) {
      expect(boon.cost.length, `${boon.id} has no ranks`).toBeGreaterThan(0);
      boon.cost.forEach((c, i) => {
        if (boon.auto && i === 0) expect(c, `${boon.id} is auto, so rank 1 must be free`).toBe(0);
        else expect(c, `${boon.id} has a free rank`).toBeGreaterThan(0);
      });
      if (boon.effect.kind === 'skillCap') {
        const def = SKILLS[boon.effect.skill];
        expect(def, `${boon.id} names an unknown skill`).toBeTruthy();
        expect(def.maxLevel, `${boon.id} raises the ceiling of an uncapped skill`).toBeTruthy();
      }
    }
  });

  it('every source pays whole points from a positive divisor', () => {
    for (const src of Object.values(PRESTIGE_SOURCES)) {
      expect(src.per, `${src.id}`).toBeGreaterThan(0);
      if (src.measure === 'stat') expect(src.key, `${src.id} counts a stat but names none`).toBeTruthy();
    }
  });
});

describe('the gate and the tab', () => {
  it('a fresh save can neither prestige nor see the tab', () => {
    const s = fresh();
    expect(canPrestige(s)).toBe(false);
    expect(prestigeVisible(s)).toBe(false);
    expect(prestigeNow(s, 1)).toBeNull();
  });

  it('the brood queen opens both', () => {
    const s = bandOneCleared();
    expect(canPrestige(s)).toBe(true);
    expect(prestigeVisible(s)).toBe(true);
  });

  it('once any run has prestiged the tab stays, even before the queen falls again', () => {
    const next = prestigeNow(bandOneCleared(), 1)!;
    expect(canPrestige(next)).toBe(false);
    expect(prestigeVisible(next)).toBe(true);
  });
});

describe('the harvest', () => {
  it('pays whole points per source and the preview is the harvest', () => {
    const s = bandOneCleared();
    s.stats['quests:completed'] = 5; // 2 per point → 2
    s.stats['bestiary:entries'] = 12; // 5 per point → 2
    s.stats['gold:earned'] = 999_999; // thresholds 10k, 100k, 1M → 2
    s.skills.fighting = { level: 30, xp: 0 } as GameState['skills'][string];
    s.skills.scouting = { level: 20, xp: 0 } as GameState['skills'][string];
    s.achievements = { a: 2, b: 5 }; // 7 tiers, 3 per point → 2
    const preview = harvest(s);
    const byId = Object.fromEntries(preview.lines.map((l) => [l.id, l.points]));
    expect(byId).toEqual({ floors: 3, quests: 2, bestiary: 2, skills: 2, achievements: 2, gold: 2 });
    expect(preview.total).toBe(13);
    expect(preview.ordinal).toBe(1);

    const next = prestigeNow(s, 1)!;
    expect(next.prestige.lastHarvest).toEqual(preview);
    expect(next.prestige.points).toBe(13);
  });

  it('gold pays geometrically: each point ten times further than the last, from 10,000', () => {
    const gold = PRESTIGE_SOURCES.gold;
    expect(pointsFor(0, gold)).toBe(0);
    expect(pointsFor(9_999, gold)).toBe(0);
    expect(pointsFor(10_000, gold)).toBe(1);
    expect(pointsFor(99_999, gold)).toBe(1);
    expect(pointsFor(100_000, gold)).toBe(2);
    expect(pointsFor(1_000_000, gold)).toBe(3);
    expect(pointsFor(10_000_000_000, gold)).toBe(7);
    expect(nextThreshold(0, gold)).toBe(10_000);
    expect(nextThreshold(10_000, gold)).toBe(100_000);
    expect(nextThreshold(250_000, gold)).toBe(1_000_000);
    const s = fresh();
    s.stats['gold:earned'] = 250_000;
    const line = harvest(s).lines.find((l) => l.id === 'gold')!;
    expect(line.points).toBe(2);
    expect(line.detail).toBe('250000 gold (next at 1000000)');
    expect(forecast(s).find((f) => f.id === 'gold')!.need).toBe(750_000);
    // Linear sources are unchanged by the machinery.
    expect(pointsFor(5, PRESTIGE_SOURCES.quests)).toBe(2);
    expect(nextThreshold(5, PRESTIGE_SOURCES.quests)).toBe(6);
  });

  it('forecasts the distance to the next point with the same arithmetic', () => {
    const s = fresh();
    s.stats['quests:completed'] = 5;
    const quests = forecast(s).find((f) => f.id === 'quests')!;
    expect(quests.need).toBe(1);
    s.stats['quests:completed'] = 6;
    expect(forecast(s).find((f) => f.id === 'quests')!.need).toBe(2);
  });
});

describe('the reset', () => {
  it('starts a fresh run at the Foot carrying only the legacy block and the world seed', () => {
    const s = bandOneCleared();
    s.createdAt = 12345;
    s.gold = 9999;
    s.spot = FLOORS.ascent_f3.landing!;
    s.discovered.push(FLOORS.ascent_f3.landing!);
    s.stats['gold:earned'] = 500;
    const next = prestigeNow(s, 777)!;
    // A second life skips the tutorial cell: it opens at the Foot, done-flag stamped.
    expect(next.spot).toBe(TUTORIAL_EXIT);
    // The Foot, then the rest of Threshold: the city has no fog (systems/mapped.ts).
    expect(next.discovered[0]).toBe(TUTORIAL_EXIT);
    expect(next.discovered.every((id) => AREAS[SPOTS[id].areaId].regionId === 'threshold')).toBe(true);
    expect(next.discovered).toContain('the_cages');
    expect(next.stats['flag:tutorial_done']).toBe(1);
    expect(STARTING_SPOT).not.toBe(TUTORIAL_EXIT);
    expect(next.gold).toBe(0);
    expect(next.stats['gold:earned']).toBeUndefined();
    for (const key of Object.keys(clearFloors({}))) expect(next.stats[key]).toBeUndefined();
    expect(next.createdAt).toBe(12345);
    expect(next.lastSaved).toBe(777);
    expect(next.prestige.count).toBe(1);
    expect(next.prestige.review).toBe(true);
    expect(next.prestige.spentThisReview).toBe(0);
  });

  it('stamps prestige:count, which is what opens the hold door', () => {
    const next = prestigeNow(bandOneCleared(), 1)!;
    expect(next.stats['prestige:count']).toBe(1);
    expect(startTravel(next, new EventBus(), 'base_entrance')).toBe(true);
  });

  it('counts up across runs and keeps unspent points', () => {
    const first = prestigeNow(bandOneCleared(), 1)!;
    const again = { ...first, stats: clearFloors({ ...first.stats }) };
    const second = prestigeNow(again as GameState, 2)!;
    expect(second.prestige.count).toBe(2);
    expect(second.prestige.points).toBe(first.prestige.points + 3);
    expect(second.prestige.lastHarvest?.ordinal).toBe(2);
  });

  it('through the Game: the state object keeps its identity, listeners keep working', () => {
    const g = new Game(bandOneCleared());
    const before = g.state;
    expect(g.prestige(5)).toBe(true);
    expect(g.state).toBe(before);
    expect(g.state.prestige.count).toBe(1);
    expect(g.state.spot).toBe(TUTORIAL_EXIT);
    // A second call refuses: the new run has not cleared band 1.
    expect(g.prestige(6)).toBe(false);
  });
});

describe('boons', () => {
  it('cost their rank, refuse without points, and stop at max rank', () => {
    const bus = new EventBus();
    const s = fresh();
    expect(canBuyBoon(s, 'provisions')).toBe(false);
    expect(buyBoon(s, bus, 'provisions')).toBe(false);
    s.prestige.points = 100;
    const def = PRESTIGE_BOONS.provisions;
    for (let r = 0; r < def.cost.length; r++) {
      expect(nextBoonCost(s, 'provisions')).toBe(def.cost[r]);
      expect(buyBoon(s, bus, 'provisions')).toBe(true);
    }
    expect(nextBoonCost(s, 'provisions')).toBeNull();
    expect(buyBoon(s, bus, 'provisions')).toBe(false);
    expect(s.prestige.points).toBe(100 - def.cost.reduce((a, b) => a + b, 0));
    expect(s.prestige.purchases.provisions).toBe(def.cost.length);
  });

  it('provisions pay now and at the start of every later run', () => {
    const bus = new EventBus();
    const s = bandOneCleared();
    s.prestige.points = 5;
    s.gold = 0;
    buyBoon(s, bus, 'provisions');
    buyBoon(s, bus, 'provisions');
    expect(s.gold).toBe(100);
    const next = prestigeNow(s, 1)!;
    expect(next.gold).toBe(100);
    expect(next.prestige.purchases.provisions).toBe(2);
  });

  it('ceilings and pages are read at their use sites, manifested or not', () => {
    const bus = new EventBus();
    const s = fresh();
    s.prestige.points = 20;
    const base = skillCap(s, 'chronosense');
    expect(buyBoon(s, bus, 'chronosense_ceiling')).toBe(true);
    expect(skillCap(s, 'chronosense')).toBe(base + 5);
    expect(s.skills.chronosense).toBeUndefined();
    const pages = preparedCap(s);
    expect(buyBoon(s, bus, 'grimoire_page')).toBe(true);
    expect(preparedCap(s)).toBe(pages + 1);
    // Carried into the next run without re-buying.
    const next = prestigeNow(bandOneCleared(), 1)!;
    next.prestige.purchases = { ...s.prestige.purchases };
    expect(skillCap(next, 'chronosense')).toBe(base + 5);
    expect(preparedCap(next)).toBe(pages + 1);
  });
});

describe('the post-prestige review', () => {
  it('is owed after a prestige, survives a save round-trip, and closes only through leaveReview', () => {
    const next = prestigeNow(bandOneCleared(), 1)!;
    expect(next.prestige.review).toBe(true);
    const loaded = deserialize(serialize(next));
    expect(loaded.prestige.review).toBe(true);
    expect(loaded.prestige.lastHarvest?.total).toBe(3);
    leaveReview(loaded);
    expect(loaded.prestige.review).toBe(false);
  });

  it('counts points spent while open, so the UI can waive the confirmation', () => {
    const next = prestigeNow(bandOneCleared(), 1)!;
    expect(next.prestige.spentThisReview).toBe(0);
    buyBoon(next, new EventBus(), 'provisions');
    expect(next.prestige.spentThisReview).toBe(1);
    leaveReview(next);
    expect(next.prestige.spentThisReview).toBe(0);
    // Spending outside a review does not count toward one.
    next.prestige.points = 5;
    buyBoon(next, new EventBus(), 'provisions');
    expect(next.prestige.spentThisReview).toBe(0);
  });
});

describe('talent', () => {
  const lvl = (level: number) => ({ level, xp: 0 }) as GameState['skills'][string];

  it('arrives free with the first prestige and records every skill\'s peak', () => {
    const s = bandOneCleared();
    s.skills.fighting = lvl(40);
    s.skills.scouting = lvl(12);
    const next = prestigeNow(s, 1)!;
    expect(next.prestige.purchases.talent).toBe(1);
    expect(next.prestige.points).toBe(5); // 3 floors + 52 skill levels; the free rank cost nothing
    expect(next.prestige.peakLevels).toEqual({ fighting: 40, scouting: 12 });
    expect(nextBoonCost(next, 'talent')).toBe(PRESTIGE_BOONS.talent.cost[1]);
  });

  it('peaks never lower, and a skill no finished run carried has none', () => {
    const first = prestigeNow({ ...bandOneCleared(), skills: { fighting: lvl(40) } }, 1)!;
    const second = prestigeNow(
      { ...bandOneCleared(), prestige: first.prestige, skills: { fighting: lvl(25), mining: lvl(9) } },
      2,
    )!;
    expect(second.prestige.peakLevels).toEqual({ fighting: 40, mining: 9 });
    expect(talentBonus(second, 'smithing')).toBe(0);
  });

  it('is rank × peak × prestiges × rate, and only ever grows with prestiges', () => {
    const rate = (PRESTIGE_BOONS.talent.effect as { rate: number }).rate;
    const s = fresh();
    s.skills.fighting = lvl(10);
    expect(talentBonus(s, 'fighting')).toBe(0); // never prestiged
    s.prestige = { ...s.prestige, count: 1, purchases: { talent: 1 }, peakLevels: { fighting: 30 } };
    expect(talentBonus(s, 'fighting')).toBeCloseTo(rate * 1 * 30 * 1, 10);
    s.prestige.count = 5;
    expect(talentBonus(s, 'fighting')).toBeCloseTo(rate * 1 * 30 * 5, 10);
    s.prestige.purchases.talent = 3;
    s.prestige.peakLevels.fighting = 300;
    expect(talentBonus(s, 'fighting')).toBeCloseTo(rate * 3 * 300 * 5, 10);
    // The user's brackets: a modest run is a fraction of a percent, a
    // monumental one is a multiple.
    expect(rate * 1 * 30 * 1).toBeLessThan(0.01);
    expect(rate * 5 * 300 * 10).toBeGreaterThan(1);
  });

  it('scales the skill\'s effects in the stat block, and the cache sees a rank change', () => {
    const s = fresh();
    s.skills.fighting = lvl(20);
    const base = getDerivedStats(s).damage;
    s.prestige = { ...s.prestige, count: 2, purchases: { talent: 1 }, peakLevels: { fighting: 100 } };
    const talented = getDerivedStats(s).damage;
    expect(talented).toBeGreaterThan(base);
    // Buying another rank mid-run must not be served from the cache.
    s.prestige.purchases.talent = 2;
    expect(getDerivedStats(s).damage).toBeGreaterThan(talented);
    // What the skill contributes is scaled by exactly 1 + bonus.
    const contribution = (state: GameState) =>
      collectBaseMods(state).filter((m) => m.source?.startsWith('Fighting')).reduce((n, m) => n + m.value, 0);
    const plain = fresh();
    plain.skills.fighting = lvl(20);
    expect(contribution(s)).toBeCloseTo(contribution(plain) * (1 + talentBonus(s, 'fighting')), 10);
  });
});

describe('endowment', () => {
  it('arrives free with the first prestige and records every attribute\'s trained peak', () => {
    const s = bandOneCleared();
    s.attrs.str.level = 12;
    s.attrs.wis.level = 4;
    const next = prestigeNow(s, 1)!;
    expect(next.prestige.purchases.endowment).toBe(1);
    expect(next.prestige.peakAttrs).toEqual({ str: 12, dex: 1, con: 1, int: 1, wis: 4, cha: 1 });
    // Peaks never lower.
    const again = prestigeNow({ ...bandOneCleared(), prestige: next.prestige, attrs: { ...s.attrs, str: { level: 5, xp: 0 } } }, 2)!;
    expect(again.prestige.peakAttrs.str).toBe(12);
  });

  it('scales the effective attribute as the last pass, rank × peak × prestiges × rate', () => {
    const rate = (PRESTIGE_BOONS.endowment.effect as { rate: number }).rate;
    const s = fresh();
    s.attrs.str.level = 20;
    expect(endowmentBonus(s, 'str')).toBe(0);
    const plain = attrValue(s, 'str');
    s.prestige = { ...s.prestige, count: 3, purchases: { endowment: 2 }, peakAttrs: { str: 50 } };
    const bonus = rate * 2 * 50 * 3;
    expect(endowmentBonus(s, 'str')).toBeCloseTo(bonus, 10);
    expect(attrValue(s, 'str')).toBeCloseTo(plain * (1 + bonus), 10);
    // Only attributes with a peak move; the breakdown reports the factor.
    expect(attrValue(s, 'dex')).toBe(1);
    expect(attrBreakdown(s, 'str').endowment).toBeCloseTo(bonus, 10);
    expect(attrBreakdown(s, 'dex').endowment).toBeUndefined();
    // The stat block follows, and the cache sees a rank change.
    const before = getDerivedStats(s).damage;
    s.prestige.purchases.endowment = 3;
    expect(getDerivedStats(s).damage).toBeGreaterThan(before);
  });
});

describe('migration', () => {
  it('v49 → v51 gives an old save an empty legacy block', () => {
    const v49: Record<string, unknown> = { ...createInitialState(3), version: 49 };
    delete v49.prestige;
    const migrated = migrate(v49, SAVE_VERSION);
    expect(migrated.prestige).toEqual({
      count: 0,
      points: 0,
      purchases: {},
      peakLevels: {},
      peakAttrs: {},
      lastHarvest: null,
      review: false,
      spentThisReview: 0,
    });
  });

  it('v50 → v51 adds peak levels to a legacy block that predates talent', () => {
    const v50: Record<string, unknown> = { ...createInitialState(4), version: 50 };
    v50.prestige = { count: 1, points: 2, purchases: { provisions: 1 }, lastHarvest: null, review: false, spentThisReview: 0 };
    const migrated = migrate(v50, SAVE_VERSION);
    expect(migrated.prestige.peakLevels).toEqual({});
    // Already prestiged once, so the free ranks of both auto boons are owed.
    expect(migrated.prestige.purchases).toEqual({ provisions: 1, talent: 1, endowment: 1 });
    expect(migrated.prestige.peakAttrs).toEqual({});
    // Never prestiged: nothing is owed.
    const never: Record<string, unknown> = { ...createInitialState(5), version: 50 };
    never.prestige = { count: 0, points: 0, purchases: {}, lastHarvest: null, review: false, spentThisReview: 0 };
    expect(migrate(never, SAVE_VERSION).prestige.purchases).toEqual({});
  });
});
