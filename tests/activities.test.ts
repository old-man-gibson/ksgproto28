import { describe, expect, it } from 'vitest';
import { RECIPES, SPOTS } from '../src/core/registry';
import { canAfford, chooseRoute, consumeCost, routeYield } from '../src/core/systems/crafting';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { getDerivedStats } from '../src/core/systems/derived';
import {
  activityCost,
  activityFillRate,
  activityOutputMult,
  activitySpeedMult,
  attrXpWeights,
  currentActivity,
  TRAIN_REP_TICKS,
} from '../src/core/systems/actions';
import { grantAttrXpSplit } from '../src/core/systems/attributes';
import { spotActivities } from '../src/core/systems/actions';
import { getSpot, TITLES } from '../src/core/registry';
import { scopedMult } from '../src/core/systems/derived';
import { monsterTagSet } from '../src/core/systems/bestiary';
import type { ActivityDef } from '../src/core/types';

/** ETA of one cycle, in ticks. */
function etaTicks(act: ActivityDef, g: Game): number {
  const stats = getDerivedStats(g.state);
  return activityCost(act, stats) / activityFillRate(act, stats, g.state);
}

describe('activity factor system', () => {
  it('speed factors raise the fill rate', () => {
    const g = new Game(createInitialState(1));
    const stats = getDerivedStats(g.state);
    const plain: ActivityDef = { id: 'p', kind: 'gather', material: 'iron_scrap', ticksPer: 100, name: '', icon: '' };
    const boosted: ActivityDef = { ...plain, speedFactors: [{ attr: 'str', weight: 0.5 }] };

    // STR 1 → ×(1 + 0.5·1) = ×1.5.
    expect(activitySpeedMult(g.state, stats, boosted)).toBeCloseTo(1.5, 5);
    expect(activityFillRate(boosted, stats, g.state)).toBeGreaterThan(activityFillRate(plain, stats, g.state));
  });

  it('static-time activities keep a fixed ETA regardless of speed', () => {
    const g = new Game(createInitialState(2));
    const staticJob: ActivityDef = {
      id: 's', kind: 'job', gold: 10, ticksPer: 200, name: '', icon: '', staticTime: true,
    };
    const pacedJob: ActivityDef = { ...staticJob, staticTime: false };

    expect(etaTicks(staticJob, g)).toBeCloseTo(200, 5);
    const pacedBefore = etaTicks(pacedJob, g);

    g.state.attrs.dex.level = 120; // a big speed jump
    expect(etaTicks(staticJob, g)).toBeCloseTo(200, 5); // unchanged
    expect(etaTicks(pacedJob, g)).toBeLessThan(pacedBefore); // the paced one speeds up
  });

  it('a factor for a not-yet-built skill contributes nothing', () => {
    const g = new Game(createInitialState(3));
    const stats = getDerivedStats(g.state);
    const act: ActivityDef = {
      id: 'm', kind: 'gather', material: 'iron_scrap', ticksPer: 100, name: '', icon: '',
      speedFactors: [{ skill: 'not_a_real_skill', weight: 1 }],
    };
    expect(activitySpeedMult(g.state, stats, act)).toBe(1); // skill level 0 → +0
  });

  it('output bonus is soft-capped toward 1 + cap', () => {
    const g = new Game(createInitialState(4));
    const stats = getDerivedStats(g.state);
    const cap = 2;
    const act: ActivityDef = {
      id: 'o', kind: 'gather', material: 'iron_scrap', ticksPer: 100, name: '', icon: '',
      outputFactors: [{ attr: 'str', weight: 1000 }], // absurd raw bonus
      outputCap: cap,
    };
    const mult = activityOutputMult(g.state, stats, act);
    expect(mult).toBeLessThan(1 + cap); // never exceeds the ceiling
    expect(mult).toBeGreaterThan(1 + cap * 0.95); // but gets very close
  });

  it('output factors raise the yield amount (mine the scree)', () => {
    const g = new Game(createInitialState(5));
    g.state.spot = 'malgeri_base';
    g.state.attrs.wis.level = 400; // loot ≈ 3.0 → (3−1)·1 = 2, softCap(2, cap 2) = 1 → ×2.0
    g.selectActivity('mine_scree');

    const stats = getDerivedStats(g.state);
    const act = currentActivity(g.state)!;
    const mult = activityOutputMult(g.state, stats, act);
    expect(mult).toBeGreaterThan(2); // well above the base yield of 1
    expect(mult).toBeLessThan(3); // but held under 1 + cap(2)

    // Force a single completion: at least the floored haul (≥2) lands, never more than ceil.
    g.state.activityProgress = activityCost(act, stats) - 1;
    g.tick();
    expect(g.state.materials['iron_scrap']).toBeGreaterThanOrEqual(2);
    expect(g.state.materials['iron_scrap']).toBeLessThanOrEqual(3);
  });

  it('untagged activities behave exactly as before (yield 1, speed ×1)', () => {
    const g = new Game(createInitialState(6));
    const stats = getDerivedStats(g.state);
    const plain: ActivityDef = { id: 'g', kind: 'gather', material: 'iron_scrap', ticksPer: 100, name: '', icon: '' };
    expect(activitySpeedMult(g.state, stats, plain)).toBe(1);
    expect(activityOutputMult(g.state, stats, plain)).toBe(1);
  });
});

describe('attribute XP splits', () => {
  it('falls back to each kind default when content says nothing', () => {
    const train: ActivityDef = { id: 't', kind: 'train', attr: 'str', name: '', icon: '' };
    const gather: ActivityDef = { id: 'g', kind: 'gather', material: 'iron_scrap', ticksPer: 100, name: '', icon: '' };
    const job: ActivityDef = { id: 'j', kind: 'job', gold: 5, ticksPer: 100, name: '', icon: '' };
    const craft: ActivityDef = { id: 'c', kind: 'craft', recipe: 'iron_ingot', name: '', icon: '' };

    expect(attrXpWeights(train)).toEqual({ str: 1 });
    expect(attrXpWeights(gather)).toEqual({ wis: 1 });
    expect(attrXpWeights(job)).toEqual({ cha: 1 });
    expect(attrXpWeights(craft)).toEqual({}); // crafting trains nothing until authored
  });

  it('an authored split replaces the default entirely', () => {
    const act: ActivityDef = {
      id: 'j', kind: 'job', gold: 5, ticksPer: 100, name: '', icon: '',
      attrXp: { cha: 0.5, str: 0.25, dex: 0.25 },
    };
    expect(attrXpWeights(act)).toEqual({ cha: 0.5, str: 0.25, dex: 0.25 });
  });

  it('weights scale the payout independently rather than dividing a pool', () => {
    const g = new Game(createInitialState(7));
    // 8 XP stays under the level-1 threshold, so banked XP is directly readable.
    grantAttrXpSplit(g.state, g.bus, { cha: 0.5, str: 0.25, dex: 0.25 }, 8);

    // Each attribute banks amount × its own weight; nothing is normalized.
    expect(g.state.attrs.cha.xp).toBeCloseTo(4, 5);
    expect(g.state.attrs.str.xp).toBeCloseTo(2, 5);
    expect(g.state.attrs.dex.xp).toBeCloseTo(2, 5);
    // A total above 1 is legal content, not clamped to a share of the pool.
    grantAttrXpSplit(g.state, g.bus, { int: 1.5 }, 4);
    expect(g.state.attrs.int.xp).toBeCloseTo(6, 5);
  });

  it('a train activity can define itself purely by its split', () => {
    const g = new Game(createInitialState(9));
    g.state.spot = 'training_grounds';
    g.selectActivity('train_everything');
    for (let i = 0; i < TRAIN_REP_TICKS * 2; i++) g.tick();

    // No `attr` on the def — every attribute in the split still gets paid.
    for (const id of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const) {
      expect(g.state.attrs[id].xp, `${id} xp`).toBeGreaterThan(0);
    }
  });

  it('training an attribute still pays only that attribute', () => {
    const g = new Game(createInitialState(8));
    g.state.spot = 'training_grounds';
    g.selectActivity('train_str');
    for (let i = 0; i < TRAIN_REP_TICKS * 2; i++) g.tick();

    expect(g.state.attrs.str.xp).toBeGreaterThan(0);
    for (const other of ['dex', 'con', 'int', 'wis', 'cha'] as const) {
      expect(g.state.attrs[other].xp).toBe(0);
      expect(g.state.attrs[other].level).toBe(1);
    }
  });
});

describe('jobs teach', () => {
  /**
   * Paid work reaches skills through `tags`, exactly like unpaid work — there
   * is no `skillXp` field on an activity, and the job branch used to be the
   * one kind that ignored tags entirely, which made a mining shift pay wages
   * and nothing else.
   */
  function atJob(seed: number): { g: Game; spot: string; act: string } {
    for (const spot of Object.values(SPOTS)) {
      for (const act of spot.activities) {
        if (act.kind === 'job' && act.tags?.includes('mining')) {
          const g = new Game(createInitialState(seed));
          g.state.spot = spot.id;
          return { g, spot: spot.id, act: act.id };
        }
      }
    }
    throw new Error('no mining job in content to test');
  }

  it('a tagged job manifests the skill and pays it XP', () => {
    const { g, act } = atJob(1);
    expect(g.state.skills['mining']).toBeUndefined();

    g.selectActivity(act);
    for (let i = 0; i < 400; i++) g.tick();

    expect(g.state.skills['mining']).toBeDefined();
    expect(g.state.skills['mining'].xp).toBeGreaterThan(0);
    // Still a job: the wages did not stop arriving.
    expect(g.state.gold).toBeGreaterThan(0);
  });

  it('an untagged job pays gold and teaches nothing', () => {
    const g = new Game(createInitialState(2));
    g.state.spot = 'hamlet_square';
    g.selectActivity('job_guard'); // no tags
    for (let i = 0; i < 400; i++) g.tick();

    expect(g.state.gold).toBeGreaterThan(0);
    expect(g.state.skills['mining']).toBeUndefined();
  });
});

describe('recipes with alternative routes', () => {
  /** A crafter standing where leather is made, with an empty satchel. */
  function crafter(seed: number): Game {
    const g = new Game(createInitialState(seed));
    g.state.materials = {};
    return g;
  }

  it('spends the junk first and only reaches for the good pelt last', () => {
    const g = crafter(1);
    const recipe = RECIPES['leather'];
    g.state.materials = { ruined_fur: 4, torn_fur: 3, pristine_fur: 1 };

    // Declaration order is preference order.
    expect(chooseRoute(g.state, recipe)?.id).toBe('primary');
    consumeCost(g.state, recipe);
    expect(g.state.materials['ruined_fur']).toBeUndefined();

    expect(chooseRoute(g.state, recipe)?.id).toBe('torn');
    consumeCost(g.state, recipe);
    expect(g.state.materials['torn_fur']).toBeUndefined();

    // Only now, with nothing worse left, does the pristine pelt go.
    expect(chooseRoute(g.state, recipe)?.id).toBe('pristine');
  });

  it('a better input pays a better yield', () => {
    const recipe = RECIPES['leather'];
    const g = crafter(2);

    g.state.materials = { ruined_fur: 4 };
    expect(routeYield(recipe, consumeCost(g.state, recipe))).toBe(1);

    g.state.materials = { pristine_fur: 1 };
    expect(routeYield(recipe, consumeCost(g.state, recipe))).toBe(2);
  });

  it('affordable means ANY route is affordable, not the first', () => {
    const recipe = RECIPES['leather'];
    const g = crafter(3);
    expect(canAfford(g.state, recipe)).toBe(false);

    // Nothing for route zero, but the pristine route is covered.
    g.state.materials = { pristine_fur: 1 };
    expect(canAfford(g.state, recipe)).toBe(true);
    expect(chooseRoute(g.state, recipe)?.id).toBe('pristine');
  });

  it('crafting through the tick loop banks the route’s own yield', () => {
    const g = crafter(4);
    g.state.spot = 'hamlet_forge';
    g.state.materials = { pristine_fur: 1 };
    g.selectActivity('craft_leather');
    for (let i = 0; i < 400 && !g.state.materials['leather']; i++) g.tick();

    // One pristine pelt in, two leather out — not one.
    expect(g.state.materials['leather']).toBe(2);
    expect(g.state.materials['pristine_fur']).toBeUndefined();
  });

  it('a recipe without alts is untouched', () => {
    const recipe = RECIPES['iron_ingot'];
    const g = crafter(5);
    expect(canAfford(g.state, recipe)).toBe(false);
    g.state.materials = { iron_scrap: 3 };
    expect(chooseRoute(g.state, recipe)?.id).toBe('primary');
    expect(routeYield(recipe, consumeCost(g.state, recipe))).toBe(1);
    expect(g.state.materials['iron_scrap']).toBeUndefined();
  });
});

describe('scoped stats', () => {
  /**
   * `craftSpeed:leatherwork` must speed up leatherwork and NOTHING else. The
   * failure mode worth guarding is the quiet one: a scoped mod leaking into
   * the flat stat block would make a leatherworker a better smith, and the
   * only symptom would be numbers that are slightly too good everywhere.
   */
  function leatherworker(seed: number, level: number): Game {
    const g = new Game(createInitialState(seed));
    g.state.spot = 'hamlet_forge';
    g.state.skills['leathercrafting'] = { level, xp: 0 };
    return g;
  }

  it('never reaches the flat stat block', () => {
    const plain = getDerivedStats(leatherworker(1, 0).state);
    const skilled = getDerivedStats(leatherworker(1, 50).state);
    // 50 levels of a scoped +1%/level bonus changes the global number by zero.
    expect(skilled.craftSpeed).toBeCloseTo(plain.craftSpeed, 10);
  });

  it('speeds up the tagged craft and leaves the others alone', () => {
    const none = leatherworker(2, 0);
    const skilled = leatherworker(2, 50);

    const rate = (g: Game, actId: string): number => {
      const act = spotActivities(getSpot(g.state.spot)).find((a) => a.id === actId)!;
      return activityFillRate(act, getDerivedStats(g.state), g.state);
    };

    // leather is tagged 'leatherwork'; iron_ingot is not.
    expect(rate(skilled, 'craft_leather')).toBeGreaterThan(rate(none, 'craft_leather'));
    expect(rate(skilled, 'craft_iron_ingot')).toBeCloseTo(rate(none, 'craft_iron_ingot'), 10);
  });

  it('scales with level the way the modifier says', () => {
    const at = (level: number) => {
      const g = leatherworker(3, level);
      const act = spotActivities(getSpot(g.state.spot)).find((a) => a.id === 'craft_leather')!;
      return activityFillRate(act, getDerivedStats(g.state), g.state);
    };
    // perLevel 0.01 as a mult: 20 levels → ×1.20 over the unskilled rate.
    expect(at(20) / at(0)).toBeCloseTo(1.2, 4);
  });
});

describe('scoped loot', () => {
  /**
   * `loot` is read in three unrelated places, each with its own idea of what a
   * scope means: the kind of WORK when gathering, the kind of PLACE when
   * exploring, and what was KILLED when a drop table rolls. All three route
   * through the same mechanism, so all three are worth pinning down.
   */
  function withMod(seed: number, stat: string): Game {
    const g = new Game(createInitialState(seed));
    // A title is the cheapest way to inject a modifier without inventing content.
    g.state.titles = ['scoped_probe'];
    g.state.title = 'scoped_probe';
    TITLES['scoped_probe'] = {
      id: 'scoped_probe', name: 'Probe', icon: '🔬', desc: '',
      unlock: [], equipped: [{ stat, op: 'mult', value: 4 }],
    } as never;
    return g;
  }

  it('a scoped loot bonus stays out of the flat stat block', () => {
    const plain = getDerivedStats(new Game(createInitialState(1)).state);
    const scoped = getDerivedStats(withMod(1, 'loot:herbalism').state);
    expect(scoped.loot).toBeCloseTo(plain.loot, 10);
  });

  it('matches the work being done, and only that work', () => {
    const g = withMod(2, 'loot:herbalism');
    expect(scopedMult(g.state, 'loot', ['herbalism'])).toBeCloseTo(5, 6);
    expect(scopedMult(g.state, 'loot', ['mining'])).toBe(1);
    expect(scopedMult(g.state, 'loot', [])).toBe(1);
  });

  it('matches what was killed, using the monster’s full derived tags', () => {
    const g = withMod(3, 'loot:beast');
    // 'beast' is declared on the wolf; 'non_elemental' is derived for it.
    expect(scopedMult(g.state, 'loot', [...monsterTagSet('wolf')])).toBeCloseTo(5, 6);
    expect(scopedMult(g.state, 'loot', [...monsterTagSet('slime_base_basic')])).toBe(1);
  });

  it('an unscoped loot bonus still applies everywhere', () => {
    const g = withMod(4, 'loot');
    const stats = getDerivedStats(g.state);
    expect(stats.loot).toBeGreaterThan(4);
    // …and contributes nothing a second time through the scoped path.
    expect(scopedMult(g.state, 'loot', ['herbalism'])).toBe(1);
  });
});
