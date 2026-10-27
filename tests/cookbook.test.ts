// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState, SAVE_VERSION } from '../src/core/state';
import { Game } from '../src/core/game';
import { DISCIPLINES } from '../src/core/data/disciplines.data';
import { MATERIALS, PRESTIGE_BOONS, SKILLS, STATUSES } from '../src/core/registry';
import { QUALITY_ORDER, qualityRank } from '../src/core/data/quality.data';
import { grantGraded, type Placement } from '../src/core/systems/disciplines';
import { cook, dishQualityRange } from '../src/core/systems/cooking';
import { startBenchWork } from '../src/core/systems/benchwork';
import { useConsumable } from '../src/core/systems/consumables';
import {
  COOK_TIME_COOKS,
  SIGNATURE_COOKS,
  carriedCookbook,
  cookbook,
  cookedGradeKey,
  cookedKey,
  cookingDishIds,
} from '../src/core/systems/cookbook';
import { computeDerivedStats, getDerivedStats, statBreakdown, FOOD_MULT_CAP } from '../src/core/systems/derived';
import { applyStatus, findStatus, hasStatus } from '../src/core/systems/statuses';
import { noveltyRemaining, skillProgression } from '../src/core/systems/skills';
import { bandedXpNeeded } from '../src/core/systems/progression';
import { migrate } from '../src/core/save/migrations';
import { deserialize, loadFromStorage, serialize, SAVE_KEY } from '../src/core/save/save';
import { foodProblems } from '../src/core/systems/disciplines';
import { harmOf, isHarmful } from '../src/core/systems/conditionHarm';
import type { CraftDisciplineDef, GameEvent, GameState, MaterialDef, QualityTier, StatusDef } from '../src/core/types';
import { clearFloors } from './fixtures/floors';

const STOVE = DISCIPLINES.cooking;
const at = (id: string, quality: QualityTier = 'c') => ({ id, quality });
const stew = (q: QualityTier = 'c'): Placement => ({ main: at('raw_meat', q), second: at('wild_onion', q) });

/** A kitchen with plenty of stock at five grades, and a cook of the given level. */
function kitchen(level = 1): Game {
  const g = new Game(createInitialState(1));
  g.state.skills.cooking = { level, xp: 0 };
  for (const id of ['raw_meat', 'wild_onion', 'cave_mushroom', 'common_herb', 'rock_salt', 'rough_flour', 'forest_berries']) {
    for (const q of ['e', 'd', 'c', 'b', 'a'] as QualityTier[]) grantGraded(g.state, id, q, 300);
  }
  return g;
}

/**
 * Cook the stove's stew `n` times from ingredients of one grade. Returns the grades
 * that came out, which is what the counters must add up to: the dish's grade
 * depends on the cook's level, and a level drifts as the XP lands.
 */
function cookStew(g: Game, n: number, q: QualityTier = 'c'): QualityTier[] {
  const out: QualityTier[] = [];
  for (let i = 0; i < n; i++) {
    const done = cook(g.state, g.bus, stew(q), STOVE, 12);
    expect(done).not.toBeNull();
    out.push(done!.quality);
  }
  return out;
}

const tally = (grades: QualityTier[]) => {
  const out: Record<string, number> = {};
  for (const q of grades) out[q] = (out[q] ?? 0) + 1;
  return out;
};

const row = (g: Game | GameState, benchId: string, outcomeId: string) =>
  cookbook('state' in g ? g.state : g).find((r) => r.benchId === benchId && r.outcomeId === outcomeId)!;

describe('food scales with Cooking, and the read is capped', () => {
  it('+0.06 Duration every 10 levels, +0.05 Potency every 20', () => {
    const at_ = (level: number) => {
      const g = kitchen(level);
      return getDerivedStats(g.state);
    };
    expect(at_(1).foodDuration).toBe(1);
    expect(at_(1).foodPotency).toBe(1);
    expect(at_(9).foodDuration).toBe(1);
    expect(at_(10).foodDuration).toBeCloseTo(1.06);
    expect(at_(10).foodPotency).toBe(1);
    expect(at_(19).foodPotency).toBe(1);
    expect(at_(20).foodDuration).toBeCloseTo(1.12);
    expect(at_(20).foodPotency).toBeCloseTo(1.05);
    expect(at_(60).foodDuration).toBeCloseTo(1.36);
    expect(at_(60).foodPotency).toBeCloseTo(1.15);
  });

  it('holds at ×1.5 from far past the last milestone, and the breakdown says it is capped', () => {
    expect(FOOD_MULT_CAP).toBe(1.5);
    for (const level of [200, 1000]) {
      const g = kitchen(level);
      const stats = getDerivedStats(g.state);
      expect(stats.foodDuration).toBe(1.5);
      expect(stats.foodPotency).toBe(1.5);
      expect(stats).toEqual(computeDerivedStats(g.state));
    }
    // Duration's milestones add up to 1.54 by level 90, Potency's to exactly 1.5
    // at 200: the raw total passes the cap for Duration and the clamp trims it.
    const g = kitchen(1000);
    expect(statBreakdown(g.state, 'foodDuration').capped).toBe(true);
    expect(getDerivedStats(g.state).foodDuration).toBe(1.5);
    // Duration reaches the cap at 90, Potency at 200; neither earlier.
    expect(getDerivedStats(kitchen(89).state).foodDuration).toBeLessThan(1.5);
    expect(getDerivedStats(kitchen(90).state).foodDuration).toBe(1.5);
    expect(getDerivedStats(kitchen(199).state).foodPotency).toBeLessThan(1.5);
    expect(getDerivedStats(kitchen(200).state).foodPotency).toBe(1.5);
  });

  it('anything else that adds to the stat is held at the same line', () => {
    // A condition from outside the skill (a stand-in for gear or a title).
    STATUSES.test_feast = {
      id: 'test_feast',
      name: 'Test Feast',
      icon: '🍽️',
      desc: 'A stand-in for any outside source of food multipliers.',
      stacking: { mode: 'highest' },
      duration: 600,
      mods: [
        { stat: 'foodDuration', op: 'add', value: 5 },
        { stat: 'foodPotency', op: 'add', value: 5 },
      ],
    };
    try {
      const g = kitchen(1);
      expect(applyStatus(g.state, g.state, { id: 'test_feast' }, 'test')).not.toBeNull();
      const stats = getDerivedStats(g.state);
      expect(stats.foodDuration).toBe(FOOD_MULT_CAP);
      expect(stats.foodPotency).toBe(FOOD_MULT_CAP);
      expect(stats).toEqual(computeDerivedStats(g.state));
    } finally {
      delete STATUSES.test_feast;
    }
  });

  it('a dish lasts foodDuration times as long and lands foodPotency times as hard', () => {
    const novice = kitchen(1);
    const master = kitchen(200);
    for (const g of [novice, master]) {
      grantGraded(g.state, 'hearty_stew', 'c', 1);
      useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    }
    const base = findStatus(novice.state, 'well_fed')!;
    const best = findStatus(master.state, 'well_fed')!;
    expect(base.intensity).toBe(1);
    expect(base.ticksLeft).toBe(STATUSES.well_fed.duration);
    expect(best.intensity).toBeCloseTo(1.5);
    expect(best.ticksLeft).toBe(Math.round(STATUSES.well_fed.duration! * 1.5));
    // The stat block follows: more max HP from the same dish.
    expect(getDerivedStats(master.state).maxHp).toBeGreaterThan(getDerivedStats(novice.state).maxHp);
  });

  it("scales a dish's own explicit duration, not just the condition's", () => {
    const g = kitchen(200);
    grantGraded(g.state, 'braised_meat', 'c', 1);
    useConsumable(g.state, g.bus, 'braised_meat', 'c');
    // Braised Meat asks for 9000 ticks (15 minutes) in the dish itself.
    expect(findStatus(g.state, 'well_fed')!.ticksLeft).toBe(Math.round(9000 * 1.5));
    expect(findStatus(g.state, 'well_fed')!.intensity).toBeCloseTo(1.5 * 1.5);
  });

  it('scales what a dish restores by potency', () => {
    const gain = (level: number) => {
      const g = kitchen(level);
      grantGraded(g.state, 'herb_rubbed_meat', 'c', 1);
      g.state.resources.hp = 1;
      return useConsumable(g.state, g.bus, 'herb_rubbed_meat', 'c')!.restored[0].amount;
    };
    expect(gain(200) / gain(1)).toBeCloseTo(1.5, 2);
  });

  it('leaves non-food alone, a spoiled grade alone, and the spoilage condition alone', () => {
    // A salve is not food: Cooking 200 changes nothing.
    const restored = (level: number) => {
      const g = kitchen(level);
      grantGraded(g.state, 'healing_salve', 'c', 1);
      g.state.resources.hp = 1;
      return useConsumable(g.state, g.bus, 'healing_salve', 'c')!.restored[0].amount;
    };
    expect(restored(200)).toBeCloseTo(restored(1));

    // Refuse grade: a better cook does not make the sickness worse.
    const sour = kitchen(200);
    grantGraded(sour.state, 'hearty_stew', 'f', 1);
    useConsumable(sour.state, sour.bus, 'hearty_stew', 'f');
    expect(findStatus(sour.state, 'queasy')!.intensity).toBeCloseTo(0.5);
    expect(findStatus(sour.state, 'queasy')!.ticksLeft).toBe(STATUSES.queasy.duration);

    // The Scorched Mess grants queasy at a positive grade: still unscaled.
    const mess = kitchen(200);
    grantGraded(mess.state, 'scorched_mess', 'c', 1);
    useConsumable(mess.state, mess.bus, 'scorched_mess', 'c');
    expect(findStatus(mess.state, 'queasy')!.intensity).toBe(1);
    expect(findStatus(mess.state, 'queasy')!.ticksLeft).toBe(STATUSES.queasy.duration);
  });
});

describe('what counts as a harmful condition', () => {
  const status = (patch: Partial<StatusDef>): StatusDef => ({
    id: 'test_status',
    name: 'Test Status',
    icon: '🧪',
    desc: 'A stand-in.',
    stacking: { mode: 'highest' },
    duration: 600,
    ...patch,
  });

  it('is read from the condition, field by field', () => {
    expect(harmOf(status({ dot: { type: 'poison', flat: 0.1 } }))).toBe('dot');
    expect(harmOf(status({ drains: { resource: 'mana', ofMax: 0.01 } }))).toBe('drains');
    expect(harmOf(status({ detonate: { type: 'arcane', ofDebt: 1 } }))).toBe('detonate');
    expect(harmOf(status({ expireDamage: { type: 'piercing', flat: 1 } }))).toBe('expireDamage');
    expect(harmOf(status({ fatalOnEmpty: { resource: 'hp', retains: 1 } }))).toBe('fatalOnEmpty');
    expect(harmOf(status({ blocks: ['spell'] }))).toBe('blocks');
    expect(harmOf(status({ blocksRegen: ['hp'] }))).toBe('blocksRegen');
    expect(harmOf(status({ ceilings: [{ resource: 'hp', per: 0.1 }] }))).toBe('ceilings');
    expect(harmOf(status({ missChance: 0.1 }))).toBe('missChance');
    expect(harmOf(status({ healCap: 0 }))).toBe('healCap');
    expect(harmOf(status({ disadvantage: true }))).toBe('disadvantage');
    expect(harmOf(status({ element: 'heat' }))).toBe('element');
    expect(harmOf(status({ escalatesTo: 'blazing' }))).toBe('escalatesTo');
    expect(harmOf(status({ expiresTo: 'rot_recovery' }))).toBe('expiresTo');
  });

  it('reads a modifier that makes the bearer worse, either way round', () => {
    expect(harmOf(status({ mods: [{ stat: 'maxHp', op: 'add', value: -8 }] }))).toContain('maxHp');
    expect(harmOf(status({ mods: [{ stat: 'craftSpeed:smithing', op: 'mult', value: -0.1 }] }))).toContain('craftSpeed');
    // Lower is better for damage taken: a negative value there helps.
    expect(harmOf(status({ mods: [{ stat: 'damageTaken', op: 'mult', value: -0.1 }] }))).toBeNull();
    expect(harmOf(status({ mods: [{ stat: 'damageTaken', op: 'mult', value: 0.1 }] }))).toContain('damageTaken');
    expect(harmOf(status({ mods: [{ stat: 'maxHp', op: 'add', value: 8 }] }))).toBeNull();
  });

  it('does not mark what helps or only changes other conditions', () => {
    expect(harmOf(status({ restores: [{ resource: 'hp', ofMax: 0.001 }] }))).toBeNull();
    expect(harmOf(status({ immune: { ids: ['poison'] } }))).toBeNull();
    expect(harmOf(status({ amplifies: [{ id: 'poison', mult: 2 }] }))).toBeNull();
    expect(harmOf(status({}))).toBeNull();
  });

  it('on the live conditions: the five food conditions are harmless, spoilage and the afflictions are not', () => {
    for (const id of ['well_fed', 'steady_hand', 'clear_headed', 'stoked', 'steeped']) {
      expect(harmOf(STATUSES[id]), id).toBeNull();
    }
    for (const id of ['queasy', 'poison', 'bleeding', 'on_fire', 'manaburn', 'blinded', 'fasting']) {
      expect(isHarmful(STATUSES[id]), id).toBe(true);
    }
  });
});

describe('the food flag lint', () => {
  const discs = Object.values(DISCIPLINES);
  const lint = (
    materials: Record<string, MaterialDef>,
    disciplines: CraftDisciplineDef[] = discs,
    statuses: Record<string, StatusDef> = STATUSES,
  ) => foodProblems(disciplines, materials, statuses).map((p) => p.message);
  const mark = (id: string, patch: Partial<NonNullable<MaterialDef['consumable']>>): Record<string, MaterialDef> => ({
    ...MATERIALS,
    [id]: { ...MATERIALS[id], consumable: { ...MATERIALS[id].consumable, ...patch } },
  });
  /** Several dishes patched at once. */
  const markAll = (
    patches: Record<string, Partial<NonNullable<MaterialDef['consumable']>>>,
  ): Record<string, MaterialDef> => {
    let out: Record<string, MaterialDef> = { ...MATERIALS };
    for (const [id, patch] of Object.entries(patches)) {
      out = { ...out, [id]: { ...MATERIALS[id], consumable: { ...MATERIALS[id].consumable, ...patch } } };
    }
    return out;
  };

  it('passes on the live content', () => {
    expect(lint(MATERIALS)).toEqual([]);
  });

  it('catches a flask marked as food', () => {
    expect(lint(mark('healing_salve', { food: true }))).toEqual([
      "'healing_salve' is marked food but no cooking bench makes it",
    ]);
    // An alchemy bench whose outcome makes a material: marking its product food is the same mistake.
    const brewery: CraftDisciplineDef = {
      ...DISCIPLINES.cooking,
      id: 'test_brewery',
      skill: 'alchemy',
      outcomes: [{ id: 'tonic', name: 'Tonic', icon: '🧪', requires: [{ tag: 'herb' }], result: { kind: 'material', id: 'test_tonic' } }],
    };
    const tonic = (food: boolean): MaterialDef => ({
      id: 'test_tonic', name: 'Test Tonic', icon: '🧪', value: 1, graded: true,
      consumable: { food, grants: [{ id: 'well_fed' }] },
    });
    expect(lint({ ...MATERIALS, test_tonic: tonic(true) }, [...discs, brewery])).toEqual([
      "'test_tonic' is marked food but no cooking bench makes it",
    ]);
    expect(lint({ ...MATERIALS, test_tonic: tonic(false) }, [...discs, brewery])).toEqual([]);
  });

  it('catches a dish left unmarked, one with no signature, and a failure dish that has one', () => {
    expect(lint(mark('hearty_stew', { food: false }))).toContain(
      "'hearty_stew' is made by cooking/stew, a cooking bench, but is not marked food",
    );
    expect(lint(mark('hearty_stew', { signature: undefined }))).toEqual(["'hearty_stew' is a dish and has no signature"]);
    const problems = lint(mark('scorched_mess', { signature: [{ id: 'stoked', intensity: 0.5 }] }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("'scorched_mess' is a failure dish");
  });

  it('catches a signature that does nothing, names nothing, or sits on non-food', () => {
    expect(lint(mark('hearty_stew', { signature: [{ id: 'well_fed', intensity: 0.5 }] }))).toEqual([
      "'hearty_stew' signature repeats its own grant 'well_fed'",
    ]);
    expect(lint(mark('hearty_stew', { signature: [{ id: 'no_such_condition', intensity: 0.5 }] }))).toEqual([
      "'hearty_stew' signature names unknown condition 'no_such_condition'",
    ]);
    expect(lint(mark('healing_salve', { signature: [{ id: 'stoked', intensity: 0.5 }] }))).toEqual([
      "'healing_salve' has a signature but is not food",
    ]);
  });

  it('catches a signature that lists a condition twice', () => {
    expect(
      lint(mark('hearty_stew', { signature: [{ id: 'stoked', intensity: 0.5 }, { id: 'stoked', intensity: 0.25 }] })),
    ).toEqual(["'hearty_stew' signature lists 'stoked' twice"]);
  });

  it('catches a signature that is the spoilage condition, derived from what the failure dish grants', () => {
    // Harmless-looking spoilage: the mess grants a benign condition, so the harm
    // rule is silent and only the spoilage rule can catch a signature on it.
    const benignMess = markAll({
      scorched_mess: { grants: [{ id: 'psionic_haste', intensity: 1 }] },
      berry_pie: { signature: [{ id: 'psionic_haste', intensity: 0.5 }] },
    });
    expect(lint(benignMess)).toEqual(["'berry_pie' signature is the spoilage condition 'psionic_haste'"]);
    // And on the live content, where spoilage is queasy, both rules fire.
    const problems = lint(mark('berry_pie', { signature: [{ id: 'queasy', intensity: 0.5 }] }));
    expect(problems).toContain("'berry_pie' signature is the spoilage condition 'queasy'");
    expect(problems.some((p) => p.includes('harmful condition (dot)'))).toBe(true);
  });

  it("catches food that never ends: 'permanent', or a duration of zero or less", () => {
    expect(lint(mark('hearty_stew', { grants: [{ id: 'well_fed', intensity: 1, duration: 'permanent' }] }))).toEqual([
      "'hearty_stew' grants 'well_fed' with duration 'permanent': a dish's effect must run out",
    ]);
    expect(lint(mark('hearty_stew', { signature: [{ id: 'stoked', intensity: 0.5, duration: 'permanent' }] }))).toEqual([
      "'hearty_stew' signature 'stoked' with duration 'permanent': a dish's effect must run out",
    ]);
    expect(lint(mark('hearty_stew', { grants: [{ id: 'well_fed', intensity: 1, duration: 0 }] }))).toEqual([
      "'hearty_stew' grants 'well_fed' with duration 0: it would end at once",
    ]);
    expect(lint(mark('hearty_stew', { signature: [{ id: 'stoked', intensity: 0.5, duration: -5 }] }))).toEqual([
      "'hearty_stew' signature 'stoked' with duration -5: it would end at once",
    ]);
    // The failure dish is not exempt from this one.
    expect(lint(mark('scorched_mess', { grants: [{ id: 'queasy', intensity: 1, duration: 'permanent' }] }))).toEqual([
      "'scorched_mess' grants 'queasy' with duration 'permanent': a dish's effect must run out",
    ]);
  });

  it('catches food that does nothing: intensity or chance of zero or less; a missing one is the default', () => {
    expect(lint(mark('hearty_stew', { grants: [{ id: 'well_fed', intensity: 0 }] }))).toEqual([
      "'hearty_stew' grants 'well_fed' with intensity 0: it would do nothing",
    ]);
    expect(lint(mark('hearty_stew', { signature: [{ id: 'stoked', intensity: -0.5 }] }))).toEqual([
      "'hearty_stew' signature 'stoked' with intensity -0.5: it would do nothing",
    ]);
    expect(lint(mark('hearty_stew', { grants: [{ id: 'well_fed', intensity: 1, chance: 0 }] }))).toEqual([
      "'hearty_stew' grants 'well_fed' with chance 0: it would never land",
    ]);
    // No intensity is intensity 1 (consumables.ts reads `app.intensity ?? 1`), no chance is certain.
    expect(lint(mark('hearty_stew', { grants: [{ id: 'well_fed' }] }))).toEqual([]);
    expect(lint(mark('hearty_stew', { signature: [{ id: 'stoked' }] }))).toEqual([]);
  });

  it('catches a harmful condition on food, whichever field makes it harmful', () => {
    expect(lint(mark('hearty_stew', { grants: [{ id: 'poison', intensity: 1 }] }))).toEqual([
      "'hearty_stew' grants 'poison' is a harmful condition (dot); food only nourishes",
    ]);
    expect(lint(mark('hearty_stew', { signature: [{ id: 'bleeding', intensity: 0.5 }] }))).toEqual([
      "'hearty_stew' signature 'bleeding' is a harmful condition (dot); food only nourishes",
    ]);
    // The rule reads the condition, not its id: patch the registry with new conditions.
    const harm = (patch: Partial<StatusDef>): Record<string, StatusDef> => ({
      ...STATUSES,
      test_harm: { id: 'test_harm', name: 'Test Harm', icon: '🧪', desc: 'x', stacking: { mode: 'highest' }, duration: 600, ...patch },
    });
    const eats = { grants: [{ id: 'test_harm', intensity: 1 }] };
    for (const [field, patch] of [
      ['drains', { drains: { resource: 'mana' as const, ofMax: 0.01 } }],
      ['detonate', { detonate: { type: 'arcane' as const, ofDebt: 1 } }],
      ['expireDamage', { expireDamage: { type: 'piercing' as const, flat: 1 } }],
    ] as const) {
      expect(lint(mark('hearty_stew', eats), discs, harm(patch)), field).toEqual([
        `'hearty_stew' grants 'test_harm' is a harmful condition (${field}); food only nourishes`,
      ]);
    }
    expect(lint(mark('hearty_stew', eats), discs, harm({ mods: [{ stat: 'maxHp', op: 'add', value: -8 }] }))).toEqual([
      "'hearty_stew' grants 'test_harm' is a harmful condition (mods (maxHp -8)); food only nourishes",
    ]);
    // A benign condition with the same shape passes.
    expect(lint(mark('hearty_stew', eats), discs, harm({ mods: [{ stat: 'maxHp', op: 'add', value: 8 }] }))).toEqual([]);
  });

  it("the failure dish's own harmful grants are the one exception", () => {
    // The live Scorched Mess grants queasy (a dot): the live-content test above already passes.
    expect(MATERIALS.scorched_mess.consumable!.grants!.map((g) => g.id)).toEqual(['queasy']);
    expect(isHarmful(STATUSES.queasy)).toBe(true);
    // Anywhere else queasy is refused as a grant.
    expect(lint(mark('hearty_stew', { grants: [{ id: 'queasy', intensity: 1 }] }))).toEqual([
      "'hearty_stew' grants 'queasy' is a harmful condition (dot); food only nourishes",
    ]);
  });

  it('the live content: every dish a cooking bench makes is food with a signature, the mess aside', () => {
    for (const id of cookingDishIds()) {
      const spec = MATERIALS[id].consumable!;
      expect(spec.food, id).toBe(true);
      expect(!!spec.signature?.length, id).toBe(id !== 'scorched_mess');
      for (const sig of spec.signature ?? []) expect(sig.intensity, id).toBe(0.5);
    }
    // And the converse: nothing that is not a cooking product is food.
    const dishes = new Set(cookingDishIds());
    for (const mat of Object.values(MATERIALS)) {
      if (mat.consumable?.food) expect(dishes.has(mat.id), mat.id).toBe(true);
    }
  });
});

describe('cook counts', () => {
  it('bump once per cook, for the dish and for the grade it came out at', () => {
    // Cooking 40: a level this deep does not move on a few cooks, so the grade
    // each ingredient set earns is steady (Poor -> Fine, Fair -> Superb, Superb -> Divine).
    const g = kitchen(40);
    const made = [...cookStew(g, 3, 'c'), ...cookStew(g, 2, 'e'), ...cookStew(g, 1, 'a')];
    expect(new Set(made).size).toBe(3);
    expect(g.state.stats[cookedKey('hearty_stew')]).toBe(6);
    for (const [grade, n] of Object.entries(tally(made))) {
      expect(g.state.stats[cookedGradeKey('hearty_stew', grade as QualityTier)], grade).toBe(n);
    }
    const gradeKeys = Object.keys(g.state.stats).filter((k) => k.startsWith('cooked:hearty_stew:'));
    expect(gradeKeys).toHaveLength(3);
    // Another dish keeps its own count.
    expect(g.state.stats[cookedKey('mushroom_broth')]).toBeUndefined();
  });

  it('are keyed by the dish, so one dish from two benches is one count', () => {
    const g = kitchen();
    const ration = (): Placement => ({ main: at('rough_flour', 'c') });
    // Traveler's Ration: any one ingredient on the grill, two on the stove.
    expect(cook(g.state, g.bus, ration(), DISCIPLINES.grilling)).not.toBeNull();
    expect(cook(g.state, g.bus, { main: at('rough_flour'), second: at('rock_salt') }, STOVE, 12)).not.toBeNull();
    expect(g.state.stats[cookedKey('travelers_ration')]).toBe(2);
  });

  it("do not count the cutting board's cuts, and a cut pays the ordinary rate", () => {
    const g = kitchen();
    const board: Placement = { board: at('wild_onion', 'c'), technique: at('sliced', 'c') };
    expect(cook(g.state, g.bus, board, DISCIPLINES.preparing)).not.toBeNull();
    expect(Object.keys(g.state.stats).filter((k) => k.startsWith('cooked:'))).toEqual([]);
    expect(g.state.novelty.cooking).toBeUndefined();
    expect(cookbook(g.state).every((r) => r.made === 0)).toBe(true);
  });

  it('count each cook of a bench run, batched or not', () => {
    const g = kitchen();
    g.state.spot = 'my_home';
    expect(startBenchWork(g.state, g.bus, 'cooking', stew('c'), { count: 3, duration: 8 })).toBe(true);
    for (let i = 0; i < 400 && g.state.benchWork; i++) g.tick();
    expect(g.state.benchWork).toBeNull();
    expect(g.state.stats[cookedKey('hearty_stew')]).toBe(3);
  });

  it('count the failure dish too', () => {
    const g = kitchen();
    grantGraded(g.state, 'wild_onion', 'f', 2);
    expect(cook(g.state, g.bus, { main: at('wild_onion', 'f'), second: at('wild_onion', 'f') }, STOVE, 12)!.dish).toBe('scorched_mess');
    expect(g.state.stats[cookedKey('scorched_mess')]).toBe(1);
  });
});

describe('the plate card event', () => {
  it('says what was made, at what grade, in what range', () => {
    const g = kitchen();
    const seen: GameEvent[] = [];
    g.bus.on('cooked', (e) => seen.push(e));
    g.bus.on('craft', (e) => seen.push(e));
    expect(cook(g.state, g.bus, stew('c'), STOVE, 12)).not.toBeNull();
    expect(seen).toEqual([
      { type: 'craft', discipline: 'cooking' },
      {
        type: 'cooked', discipline: 'cooking', outcome: 'stew', dish: 'hearty_stew',
        quality: 'c', low: 'c', high: 'c', qty: 1,
      },
    ]);
  });

  it("carries the preview's grade range, and the grade rolled lands inside it", () => {
    const g = kitchen(9);
    grantGraded(g.state, 'wild_onion_diced', 'c', 20);
    // Superb meat and a Fair diced onion at Cooking 9: the score straddles the
    // Fine / Superb line (2.46 to 2.60 against 2.5).
    const placement: Placement = { main: at('raw_meat', 'a'), second: at('wild_onion_diced', 'c') };
    const range = dishQualityRange(g.state, placement);
    expect([range.min, range.max]).toEqual(['b', 'a']);
    const cooked: Extract<GameEvent, { type: 'cooked' }>[] = [];
    g.bus.on('cooked', (e) => cooked.push(e));
    for (let i = 0; i < 6; i++) {
      g.state.skills.cooking = { level: 9, xp: 0 }; // the XP of the last cook must not move the range
      cook(g.state, g.bus, placement);
    }
    expect(cooked).toHaveLength(6);
    for (const e of cooked) {
      expect(e.low).toBe(range.min);
      expect(e.high).toBe(range.max);
      expect(qualityRank(e.quality)).toBeGreaterThanOrEqual(qualityRank(e.low));
      expect(qualityRank(e.quality)).toBeLessThanOrEqual(qualityRank(e.high));
    }
  });

  it('is not sent for a cut', () => {
    const g = kitchen();
    const seen: string[] = [];
    g.bus.on('cooked', () => seen.push('cooked'));
    g.bus.on('craft', () => seen.push('craft'));
    cook(g.state, g.bus, { board: at('wild_onion', 'c'), technique: at('sliced', 'c') }, DISCIPLINES.preparing);
    expect(seen).toEqual(['craft']);
  });
});

describe('Signatures', () => {
  it('arrive when a dish has been cooked 100 times, and not at 99', () => {
    expect(SIGNATURE_COOKS).toBe(100);
    const g = kitchen();
    g.state.stats[cookedKey('hearty_stew')] = SIGNATURE_COOKS - 2;
    cookStew(g, 1); // 99
    expect(g.state.stats[cookedKey('hearty_stew')]).toBe(99);
    const before = useConsumable(g.state, g.bus, 'hearty_stew', 'c')!;
    expect(before.signature).toEqual([]);
    expect(hasStatus(g.state, 'stoked')).toBe(false);

    cookStew(g, 1); // 100
    const after = useConsumable(g.state, g.bus, 'hearty_stew', 'c')!;
    expect(after.signature).toEqual(['stoked']);
    expect(after.granted).toEqual(['well_fed', 'stoked']);
    expect(findStatus(g.state, 'stoked')!.intensity).toBeCloseTo(0.5);
  });

  it('are scaled by grade like the dish itself', () => {
    const g = kitchen();
    g.state.stats[cookedKey('hearty_stew')] = 500;
    grantGraded(g.state, 'hearty_stew', 's', 1);
    useConsumable(g.state, g.bus, 'hearty_stew', 's');
    expect(findStatus(g.state, 'stoked')!.intensity).toBeCloseTo(0.5 * 4);
    expect(findStatus(g.state, 'well_fed')!.intensity).toBeCloseTo(4);
  });

  it('follow the cook as well: a Signature is food', () => {
    const g = kitchen(200);
    g.state.stats[cookedKey('hearty_stew')] = 100;
    grantGraded(g.state, 'hearty_stew', 'c', 1);
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    expect(findStatus(g.state, 'stoked')!.intensity).toBeCloseTo(0.5 * 1.5);
    expect(findStatus(g.state, 'stoked')!.ticksLeft).toBe(Math.round(STATUSES.stoked.duration! * 1.5));
  });

  it('are not granted by spoiled food', () => {
    const g = kitchen();
    g.state.stats[cookedKey('hearty_stew')] = 500;
    grantGraded(g.state, 'hearty_stew', 'f', 1);
    useConsumable(g.state, g.bus, 'hearty_stew', 'f');
    expect(hasStatus(g.state, 'stoked')).toBe(false);
    expect(hasStatus(g.state, 'queasy')).toBe(true);
  });

  it('every dish grants its own, a different condition from its main grants', () => {
    for (const id of cookingDishIds()) {
      const spec = MATERIALS[id].consumable!;
      if (!spec.signature) continue;
      const g = kitchen();
      g.state.stats[cookedKey(id)] = SIGNATURE_COOKS;
      grantGraded(g.state, id, 'c', 1);
      const result = useConsumable(g.state, g.bus, id, 'c')!;
      expect(result.signature, id).toEqual(spec.signature.map((s) => s.id));
      for (const sig of spec.signature) {
        expect(hasStatus(g.state, sig.id), `${id} -> ${sig.id}`).toBe(true);
        expect(spec.grants!.map((a) => a.id), id).not.toContain(sig.id);
      }
    }
  });
});

describe("the Cook's Book", () => {
  /** What the cooking benches can make, by bench then outcome, worked out from the data alone. */
  const expected = Object.values(DISCIPLINES)
    .filter((d) => d.skill === 'cooking')
    .flatMap((d) => d.outcomes.filter((o) => o.result.kind === 'material').map((o) => `${d.id}/${o.id}`));

  it('lists every cooking-bench outcome once, in bench order then outcome order', () => {
    const rows = cookbook(createInitialState(1));
    expect(rows.map((r) => `${r.benchId}/${r.outcomeId}`)).toEqual(expected);
    expect(new Set(rows.map((r) => `${r.benchId}/${r.outcomeId}`)).size).toBe(rows.length);
    // Stove, grill, oven, counter. The cutting board's cut is not a dish.
    expect([...new Set(rows.map((r) => r.benchId))]).toEqual(['cooking', 'grilling', 'baking', 'assembling']);
    expect(rows.some((r) => r.benchId === 'preparing')).toBe(false);
    // Learned dishes are listed although no card has been read.
    expect(rows.map((r) => r.outcomeId)).toContain('seared_stew');
    expect(rows.map((r) => r.outcomeId)).toContain('lectory_porridge');
    for (const r of rows) {
      expect(r.made).toBe(0);
      expect(r.best).toBeNull();
      expect(Object.keys(r.byGrade).sort()).toEqual([...QUALITY_ORDER].sort());
      expect(r.cookTimeKnown).toBe(false);
      expect(r.signature).toBe(false);
      expect(r.heat).toBeUndefined();
    }
  });

  it('reads the counters: made, by grade, best', () => {
    const g = kitchen(40);
    const made = [...cookStew(g, 2, 'c'), ...cookStew(g, 1, 'e')];
    const r = row(g, 'cooking', 'stew');
    expect(r.dishId).toBe('hearty_stew');
    expect(r.made).toBe(3);
    expect(r.byGrade).toEqual({ f: 0, e: 0, d: 0, c: 0, b: 0, a: 0, s: 0, ...tally(made) });
    expect(r.best).toBe(made.reduce((top, q) => (qualityRank(q) > qualityRank(top) ? q : top)));
    // The same dish from another bench shares the count; a different dish does not.
    expect(row(g, 'cooking', 'broth').made).toBe(0);
  });

  it('best never falls as more is cooked', () => {
    const g = kitchen(40);
    let top = -1;
    let seen = -1;
    for (const q of ['c', 'e', 'd', 'a', 'e', 'c', 'd'] as QualityTier[]) {
      const [made] = cookStew(g, 1, q);
      seen = Math.max(seen, qualityRank(made));
      const best = row(g, 'cooking', 'stew').best!;
      expect(qualityRank(best)).toBeGreaterThanOrEqual(top);
      top = qualityRank(best);
    }
    expect(top).toBe(seen);
  });

  it('shows a cook time at 25 cooks, with the window only then', () => {
    expect(COOK_TIME_COOKS).toBe(25);
    const g = kitchen();
    g.state.stats[cookedKey('seared_stew')] = COOK_TIME_COOKS - 1;
    expect(row(g, 'cooking', 'seared_stew').cookTimeKnown).toBe(false);
    expect(row(g, 'cooking', 'seared_stew').heat).toBeUndefined();
    g.state.stats[cookedKey('seared_stew')] = COOK_TIME_COOKS;
    const known = row(g, 'cooking', 'seared_stew');
    expect(known.cookTimeKnown).toBe(true);
    expect(known.heat).toEqual([{ tag: 'meat', to: 6 }]);
    // A dish with no window of its own is known but carries none.
    g.state.stats[cookedKey('hearty_stew')] = COOK_TIME_COOKS;
    expect(row(g, 'cooking', 'stew').cookTimeKnown).toBe(true);
    expect(row(g, 'cooking', 'stew').heat).toBeUndefined();
  });

  it('earns the Signature at 100 cooks; a dish with none never does', () => {
    const g = kitchen();
    g.state.stats[cookedKey('hearty_stew')] = SIGNATURE_COOKS - 1;
    expect(row(g, 'cooking', 'stew').signature).toBe(false);
    g.state.stats[cookedKey('hearty_stew')] = SIGNATURE_COOKS;
    expect(row(g, 'cooking', 'stew').signature).toBe(true);
    g.state.stats[cookedKey('scorched_mess')] = 1000;
    expect(row(g, 'cooking', 'mess').signature).toBe(false);
  });

  it('counts a dish once across the benches that make it', () => {
    const g = kitchen();
    g.state.stats[cookedKey('travelers_ration')] = 7;
    const rations = cookbook(g.state).filter((r) => r.dishId === 'travelers_ration');
    expect(rations.map((r) => r.benchId)).toEqual(['cooking', 'grilling', 'baking', 'assembling']);
    for (const r of rations) expect(r.made).toBe(7);
  });
});

describe('the cookery novelty domain', () => {
  const spec = SKILLS.cooking.novelty!;
  /** What the nth repeat of a dish is worth as a multiple of the ordinary payout. */
  const yieldAt = (n: number) => (spec.k + n) / (spec.c + n);

  it('is declared on the cooking skill, keyed by dish', () => {
    expect(spec.domain).toBe('cookery');
    expect(spec.k).toBeGreaterThanOrEqual(spec.c); // opens at k / c >= 1 and never pays below the ordinary rate
  });

  it('pays a dish new to the Book once, then settles to the ordinary rate', () => {
    // A high level, so no cook crosses a level mid-measure and hides its XP.
    const g = kitchen(40);
    const xpOf = () => g.state.skills.cooking.xp;
    const gain = () => {
      const before = xpOf();
      cookStew(g, 1);
      return xpOf() - before;
    };
    const skillXp = getDerivedStats(g.state).skillXp;
    const first = gain();
    const second = gain();
    const third = gain();
    // Same cook, same grade: the base is constant, so the novelty multiple is
    // visible directly as the ratio of one cook to the next.
    const base = second / yieldAt(1);
    expect(third / base).toBeCloseTo(yieldAt(2), 5);
    expect(second / base).toBeGreaterThan(third / base);
    // … and the first also carries the one-time discovery payout.
    expect(first - base * yieldAt(0)).toBeCloseTo(spec.discovery * skillXp, 5);
    expect(noveltyRemaining(g.state, 'cooking', 'hearty_stew')).toBeCloseTo(yieldAt(3));
    // A second dish is new again.
    const broth = (): Placement => ({ main: at('cave_mushroom'), second: at('common_herb') });
    const before = xpOf();
    cook(g.state, g.bus, broth(), STOVE, 12);
    expect(xpOf() - before).toBeGreaterThan(third);
  });

  it('re-pays after a prestige: the novelty record and the Book reset with the run', () => {
    const g = kitchen();
    clearFloors(g.state.stats);
    cookStew(g, 1);
    expect(noveltyRemaining(g.state, 'cooking', 'hearty_stew')).toBeCloseTo(yieldAt(1));
    expect(g.prestige(5)).toBe(true);
    expect(g.state.novelty.cooking).toBeUndefined();
    expect(noveltyRemaining(g.state, 'cooking', 'hearty_stew')).toBeCloseTo(yieldAt(0));
  });

  describe('is a garnish on the ordinary rate (tuning, measured at Cooking 1)', () => {
    // The ten dishes a fresh save can cook with no recipe card and no level gate.
    const TEN: { bench: string; place: Placement; duration?: number }[] = [
      { bench: 'cooking', place: { main: at('raw_meat'), second: at('wild_onion') }, duration: 12 }, // stew
      { bench: 'cooking', place: { main: at('cave_mushroom'), second: at('common_herb') }, duration: 12 }, // broth
      { bench: 'cooking', place: { main: at('rough_flour'), second: at('rock_salt') }, duration: 12 }, // ration
      { bench: 'grilling', place: { main: at('river_fish') } }, // skewered fish
      { bench: 'grilling', place: { main: at('raw_meat') } }, // seared steak
      { bench: 'grilling', place: { main: at('wild_onion'), second: at('cave_mushroom') } }, // charred roots
      { bench: 'baking', place: { main: at('rough_flour'), second: at('rough_flour') } }, // loaf
      { bench: 'baking', place: { main: at('rough_flour'), second: at('forest_berries') } }, // pie
      { bench: 'assembling', place: { main: at('rustic_loaf'), second: at('seared_steak') } }, // sandwich
      { bench: 'assembling', place: { main: at('wild_onion'), second: at('cave_mushroom') } }, // salad
    ];
    const fresh = (): Game => {
      const g = new Game(createInitialState(1));
      g.state.skills.cooking = { level: 1, xp: 0 };
      for (const id of [
        'raw_meat', 'wild_onion', 'cave_mushroom', 'common_herb', 'river_fish', 'rock_salt',
        'rough_flour', 'forest_berries', 'rustic_loaf', 'seared_steak',
      ]) {
        grantGraded(g.state, id, 'c', 50);
      }
      return g;
    };
    /** Level plus the share of the next level already earned. */
    const progress = (g: Game): number => {
      const s = g.state.skills.cooking;
      return s.level + s.xp / bandedXpNeeded(skillProgression('cooking'), s.level);
    };
    const runTen = (g: Game): number[] => {
      const after: number[] = [];
      for (const d of TEN) {
        expect(cook(g.state, g.bus, d.place, DISCIPLINES[d.bench], d.duration)).not.toBeNull();
        after.push(progress(g));
      }
      return after;
    };

    it('the first cook of a new dish is about one level and a third; one of each of ten is Cooking 8', () => {
      const withNovelty = runTen(fresh());
      // The first stew gains 1.0 to 1.6 levels, the ordinary cook's whole level included.
      expect(withNovelty[0] - 1).toBeGreaterThanOrEqual(1.0);
      expect(withNovelty[0] - 1).toBeLessThan(1.6);
      // Ten dishes land in 6 to 9 (a level shows as its integer part: 6, 7 or 8).
      expect(withNovelty[9]).toBeGreaterThanOrEqual(6);
      expect(withNovelty[9]).toBeLessThan(9);
    });

    it('adds at most two levels over the same ten cooks with no novelty at all', () => {
      const saved = SKILLS.cooking.novelty;
      let floor: number;
      try {
        SKILLS.cooking.novelty = undefined;
        floor = runTen(fresh())[9];
      } finally {
        SKILLS.cooking.novelty = saved;
      }
      const withNovelty = runTen(fresh())[9];
      expect(floor).toBeGreaterThan(6.5); // ten ordinary cooks are already Cooking 7
      expect(withNovelty).toBeGreaterThan(floor);
      expect(withNovelty - floor).toBeLessThan(2);
    });
  });
});

describe("Cook's Notes: a prestige carries part of the Book", () => {
  /** A run that has cleared band 1, with a Book worth carrying. */
  function veteran(): Game {
    const s = createInitialState(0);
    clearFloors(s.stats);
    s.stats[cookedKey('hearty_stew')] = 130; // cook time and Signature
    s.stats[cookedKey('mushroom_broth')] = 30; // cook time only
    s.stats[cookedKey('berry_pie')] = 24; // neither
    s.stats[cookedKey('scorched_mess')] = 200; // cook time; it has no Signature
    return new Game(s);
  }

  it('is one boon with two ranks', () => {
    const boon = PRESTIGE_BOONS.cooks_notes;
    expect(boon.name).toBe("Cook's Notes");
    expect(boon.cost).toHaveLength(2);
    expect(boon.effect).toEqual({ kind: 'cookbook' });
  });

  it('stores what reached each threshold at prestige, whatever rank is held then', () => {
    const g = veteran();
    expect(carriedCookbook(g.state)).toEqual({
      timed: ['hearty_stew', 'mushroom_broth', 'scorched_mess'],
      signed: ['hearty_stew'],
    });
    expect(g.prestige(5)).toBe(true);
    expect(g.state.prestige.cookbook.timed.slice().sort()).toEqual(['hearty_stew', 'mushroom_broth', 'scorched_mess']);
    expect(g.state.prestige.cookbook.signed).toEqual(['hearty_stew']);
    // The counters themselves reset with the run.
    expect(g.state.stats[cookedKey('hearty_stew')]).toBeUndefined();
  });

  it('without the boon the new run starts with an empty Book', () => {
    const g = veteran();
    g.prestige(5);
    for (const r of cookbook(g.state)) {
      expect(r.made).toBe(0);
      expect(r.cookTimeKnown).toBe(false);
      expect(r.signature).toBe(false);
    }
  });

  it('rank 1 keeps cook times, rank 2 also keeps Signatures', () => {
    const g = veteran();
    g.prestige(5);
    g.state.prestige.points = 10;

    expect(g.buyBoon('cooks_notes')).toBe(true);
    expect(row(g, 'cooking', 'stew').cookTimeKnown).toBe(true);
    expect(row(g, 'cooking', 'broth').cookTimeKnown).toBe(true);
    expect(row(g, 'baking', 'pie').cookTimeKnown).toBe(false);
    expect(row(g, 'cooking', 'stew').signature).toBe(false);
    // The kept cook time is a flag; the count is still the new run's own.
    expect(row(g, 'cooking', 'stew').made).toBe(0);
    grantGraded(g.state, 'hearty_stew', 'c', 1);
    expect(useConsumable(g.state, g.bus, 'hearty_stew', 'c')!.signature).toEqual([]);

    expect(g.buyBoon('cooks_notes')).toBe(true);
    expect(g.buyBoon('cooks_notes')).toBe(false); // two ranks only
    expect(row(g, 'cooking', 'stew').signature).toBe(true);
    expect(row(g, 'cooking', 'broth').signature).toBe(false);
    expect(row(g, 'cooking', 'mess').signature).toBe(false);
    grantGraded(g.state, 'hearty_stew', 'c', 1);
    expect(useConsumable(g.state, g.bus, 'hearty_stew', 'c')!.signature).toEqual(['stoked']);
    grantGraded(g.state, 'mushroom_broth', 'c', 1);
    expect(useConsumable(g.state, g.bus, 'mushroom_broth', 'c')!.signature).toEqual([]);
  });

  it('a kept cook time shows the heat window of a windowed dish', () => {
    const s = createInitialState(0);
    clearFloors(s.stats);
    s.stats[cookedKey('seared_stew')] = 40;
    const g = new Game(s);
    g.prestige(5);
    g.state.prestige.points = 5;
    expect(row(g, 'cooking', 'seared_stew').heat).toBeUndefined();
    g.buyBoon('cooks_notes');
    expect(row(g, 'cooking', 'seared_stew').heat).toEqual([{ tag: 'meat', to: 6 }]);
  });

  it('never shortens across prestiges: each one adds what its run reached', () => {
    const g = veteran();
    g.prestige(5);
    clearFloors(g.state.stats);
    g.state.stats[cookedKey('berry_pie')] = 60;
    expect(g.prestige(6)).toBe(true);
    expect(g.state.prestige.cookbook.timed).toEqual(
      expect.arrayContaining(['hearty_stew', 'mushroom_broth', 'scorched_mess', 'berry_pie']),
    );
    expect(g.state.prestige.cookbook.signed).toEqual(['hearty_stew']);
    // A run that cooked nothing leaves the lists as they were.
    clearFloors(g.state.stats);
    const before = JSON.stringify(g.state.prestige.cookbook);
    expect(g.prestige(7)).toBe(true);
    expect(JSON.stringify(g.state.prestige.cookbook)).toBe(before);
  });
});

describe('save v58', () => {
  function v57(): Record<string, unknown> {
    const s = createInitialState(3);
    const prestige: Record<string, unknown> = { ...s.prestige, count: 1 };
    delete prestige.cookbook;
    return { ...s, version: 57, prestige };
  }

  it('is the version this change took, or a later one', () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(58);
  });

  it('migrates a v57 legacy block by adding empty Cook\'s Book lists', () => {
    const migrated = migrate(v57(), SAVE_VERSION);
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.prestige.cookbook).toEqual({ timed: [], signed: [] });
    expect(migrated.prestige.count).toBe(1);
  });

  it('keeps lists a block already carries', () => {
    const raw = v57();
    (raw.prestige as Record<string, unknown>).cookbook = { timed: ['hearty_stew'], signed: [] };
    expect(migrate(raw, SAVE_VERSION).prestige.cookbook).toEqual({ timed: ['hearty_stew'], signed: [] });
  });

  it('round-trips through serialize and deserialize', () => {
    const s = createInitialState(4);
    s.prestige.cookbook = { timed: ['hearty_stew', 'berry_pie'], signed: ['hearty_stew'] };
    s.stats[cookedKey('hearty_stew')] = 12;
    s.stats[cookedGradeKey('hearty_stew', 'b')] = 3;
    const loaded = deserialize(serialize(s));
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.prestige.cookbook).toEqual({ timed: ['hearty_stew', 'berry_pie'], signed: ['hearty_stew'] });
    expect(loaded.stats[cookedKey('hearty_stew')]).toBe(12);
    expect(cookbook(loaded).find((r) => r.outcomeId === 'stew')!.byGrade.b).toBe(3);
  });

  it('loads an old save through the rails: a backup-v57 copy is kept, nothing is lost', () => {
    const map = new Map<string, string>();
    const storage = {
      get length() { return map.size; },
      key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
    } as Storage;
    const raw = v57();
    raw.gold = 4321;
    storage.setItem(SAVE_KEY, JSON.stringify(raw));
    const result = loadFromStorage(storage);
    expect(result.corrupted).toBe(false);
    expect(result.state?.version).toBe(SAVE_VERSION);
    expect(result.state?.gold).toBe(4321);
    expect(result.state?.prestige.cookbook).toEqual({ timed: [], signed: [] });
    expect(storage.getItem(`${SAVE_KEY}:backup-v57`)).toContain('"version":57');
  });

  it('the Game keeps working on a migrated save: a cook still counts and a prestige still carries', () => {
    const migrated = migrate(v57(), SAVE_VERSION);
    const g = new Game({ ...createInitialState(3), ...migrated });
    g.state.skills.cooking = { level: 1, xp: 0 };
    grantGraded(g.state, 'raw_meat', 'c', 5);
    grantGraded(g.state, 'wild_onion', 'c', 5);
    cookStew(g, 2);
    expect(g.state.stats[cookedKey('hearty_stew')]).toBe(2);
    clearFloors(g.state.stats);
    g.state.stats[cookedKey('hearty_stew')] = COOK_TIME_COOKS;
    expect(g.prestige(9)).toBe(true);
    expect(g.state.prestige.cookbook).toEqual({ timed: ['hearty_stew'], signed: [] });
  });
});

describe('the cook never amplifies a harmful condition a dish carries', () => {
  /** A dish no lint would pass: nourishment, a harmful grant and a harmful Signature. */
  const withCurry = (run: () => void) => {
    MATERIALS.test_curry = {
      id: 'test_curry',
      name: 'Test Curry',
      icon: '🍛',
      value: 1,
      graded: true,
      consumable: {
        food: true,
        grants: [{ id: 'well_fed', intensity: 1 }, { id: 'poison', intensity: 0.5 }],
        signature: [{ id: 'on_fire', intensity: 0.5 }],
      },
    };
    try {
      run();
    } finally {
      delete MATERIALS.test_curry;
    }
  };
  const eat = (level: number): Game => {
    const g = kitchen(level);
    g.state.stats[cookedKey('test_curry')] = SIGNATURE_COOKS;
    grantGraded(g.state, 'test_curry', 'c', 1);
    expect(useConsumable(g.state, g.bus, 'test_curry', 'c')!.signature).toEqual(['on_fire']);
    return g;
  };

  it('scales the nourishment and leaves the harm at its own terms, grants and Signature alike', () => {
    withCurry(() => {
      const novice = eat(1);
      const master = eat(200);
      // The harmless grant follows the cook...
      expect(findStatus(novice.state, 'well_fed')!.intensity).toBe(1);
      expect(findStatus(master.state, 'well_fed')!.intensity).toBeCloseTo(1.5);
      expect(findStatus(master.state, 'well_fed')!.ticksLeft).toBe(Math.round(STATUSES.well_fed.duration! * 1.5));
      // ...the harmful ones do not: same intensity, same default lifetime.
      for (const id of ['poison', 'on_fire']) {
        const a = findStatus(novice.state, id)!;
        const b = findStatus(master.state, id)!;
        expect(b.intensity, id).toBeCloseTo(a.intensity);
        expect(a.intensity, id).toBeCloseTo(0.5);
        expect(b.ticksLeft, id).toBe(STATUSES[id].duration);
        expect(a.ticksLeft, id).toBe(STATUSES[id].duration);
      }
    });
  });

  it('is read from the condition, so a patched harmful condition is not scaled and a benign one is', () => {
    withCurry(() => {
      const original = STATUSES.steeped;
      MATERIALS.test_curry.consumable!.grants = [{ id: 'steeped', intensity: 1 }];
      MATERIALS.test_curry.consumable!.signature = [{ id: 'stoked', intensity: 0.5 }];
      const eatAt200 = (): Game => {
        const g = kitchen(200);
        g.state.stats[cookedKey('test_curry')] = SIGNATURE_COOKS;
        grantGraded(g.state, 'test_curry', 'c', 1);
        useConsumable(g.state, g.bus, 'test_curry', 'c');
        return g;
      };
      try {
        // Make Steeped harmful by data alone: no id list is involved.
        STATUSES.steeped = { ...original, dot: { type: 'poison', flat: 0.01 } };
        const harmful = eatAt200();
        expect(findStatus(harmful.state, 'steeped')!.intensity).toBeCloseTo(1);
        expect(findStatus(harmful.state, 'steeped')!.ticksLeft).toBe(original.duration);
      } finally {
        STATUSES.steeped = original;
      }
      const benign = eatAt200();
      expect(findStatus(benign.state, 'steeped')!.intensity).toBeCloseTo(1.5);
      expect(findStatus(benign.state, 'steeped')!.ticksLeft).toBe(Math.round(original.duration! * 1.5));
    });
  });
});

describe('the Book says so when a cook crosses a threshold', () => {
  // No trailing period: the tally joins its entries with ", ".
  const TIME_NOTE = "Cook's Book: Seared Stew cook time noted (25 cooks)";
  const SIGNATURE_NOTE = 'Seared Stew is now a Signature dish: eating it also gives Well Fed (100 cooks)';
  /** A kitchen that has read the Seared Stew card. */
  function searedKitchen(): Game {
    const g = kitchen(1);
    g.state.stats['recipe:seared_stew'] = 1;
    return g;
  }
  /** Meat midway on a Quick simmer: 5.4 units on the heat, under 6. */
  const seared = (g: Game, n: number) => {
    for (let i = 0; i < n; i++) {
      const done = cook(g.state, g.bus, { main: at('wild_onion'), second: at('raw_meat') }, STOVE, 8);
      expect(done?.dish).toBe('seared_stew');
    }
  };
  /** Every Cook's Book note in the running log, in order: what the player reads. */
  const notes = (g: Game) =>
    g.state.log
      .flatMap((l) => (l.tally ?? []).map((tl) => tl.label))
      .filter((label) => /cook time noted|Signature dish/.test(label));

  it('notes the cook time at the 25th cook of a dish that has one, once', () => {
    const g = searedKitchen();
    seared(g, 30);
    expect(notes(g)).toEqual([TIME_NOTE]);
    // It rides the "Cooked:" tally of the cook that crossed it: the same group, the same folding path.
    const crossing = g.state.log.find((l) => l.tally?.some((tl) => tl.label === TIME_NOTE))!;
    expect(crossing.group).toBe('bench:cooking');
    expect(crossing.prefix).toBe('🍛 Cooked:');
    expect(crossing.msg).toMatch(/^🍛 Cooked: .*Seared Stew ×\d+, /);
    expect(crossing.msg).toContain(TIME_NOTE);
    // The Book on the bench agrees: this is the cook that made it known.
    expect(g.state.stats[cookedKey('seared_stew')]).toBe(30);
    expect(row(g, 'cooking', 'seared_stew').cookTimeKnown).toBe(true);
    // Thirty cooks leave the note once in the running log, not thirty times, and never on a line of its own.
    const logged = g.state.log.filter((l) => l.msg.includes('cook time noted'));
    expect(logged).toHaveLength(1);
    expect(logged[0].msg).toContain('Cooked:');
  });

  it('names the Signature at the 100th cook of a dish that has one, once', () => {
    const g = kitchen(1);
    g.state.stats[cookedKey('hearty_stew')] = 97;
    cookStew(g, 5);
    expect(notes(g)).toEqual(['Hearty Stew is now a Signature dish: eating it also gives Stoked (100 cooks)']);
  });

  it('says nothing at 25 for a dish with no window of its own, and nothing for the failure dish', () => {
    const g = kitchen(1);
    g.state.stats[cookedKey('hearty_stew')] = 22;
    cookStew(g, 5); // crosses 25: Hearty Stew has no cook-time window
    expect(notes(g)).toEqual([]);
    expect(row(g, 'cooking', 'stew').cookTimeKnown).toBe(true); // the Book still counts it

    grantGraded(g.state, 'wild_onion', 'f', 400);
    g.state.stats[cookedKey('scorched_mess')] = 98;
    for (let i = 0; i < 5; i++) {
      cook(g.state, g.bus, { main: at('wild_onion', 'f'), second: at('wild_onion', 'f') }, STOVE, 12);
    }
    expect(g.state.stats[cookedKey('scorched_mess')]).toBe(103); // past 25 and 100: no window, no Signature
    expect(notes(g)).toEqual([]);
  });

  it('names a Signature on a dish that also has a cook time', () => {
    const g = searedKitchen();
    g.state.stats[cookedKey('seared_stew')] = 99;
    seared(g, 2);
    expect(notes(g)).toEqual([SIGNATURE_NOTE]);
  });

  it("stays quiet for what Cook's Notes already carried, and speaks when the boon is not held", () => {
    /** Cross 25 and then 100 with the legacy lists naming the dish, at the given boon rank. */
    const crossBoth = (rank: number): string[] => {
      const g = searedKitchen();
      g.state.prestige.cookbook = { timed: ['seared_stew'], signed: ['seared_stew'] };
      if (rank > 0) g.state.prestige.purchases.cooks_notes = rank;
      g.state.stats[cookedKey('seared_stew')] = 24;
      seared(g, 1);
      g.state.stats[cookedKey('seared_stew')] = 99;
      seared(g, 1);
      return notes(g);
    };
    expect(crossBoth(2)).toEqual([]); // both were carried over: no news
    expect(crossBoth(1)).toEqual([SIGNATURE_NOTE]); // the cook time was carried, the Signature was not
    expect(crossBoth(0)).toEqual([TIME_NOTE, SIGNATURE_NOTE]); // the lists are ignored without the boon
  });

  it('a counted bench run crossing a threshold leaves one note, folded into the run, not a line of its own', () => {
    const g = searedKitchen();
    // Cooking 40: no level-up lines between the cooks to split the run on their own.
    g.state.skills.cooking = { level: 40, xp: 0 };
    g.state.spot = 'my_home';
    g.state.stats[cookedKey('seared_stew')] = 22;
    expect(
      startBenchWork(g.state, g.bus, 'cooking', { main: at('wild_onion'), second: at('raw_meat') }, { count: 6, duration: 8 }),
    ).toBe(true);
    for (let i = 0; i < 700 && g.state.benchWork; i++) g.tick();
    expect(g.state.stats[cookedKey('seared_stew')]).toBe(28);
    const logged = g.state.log.filter((l) => l.msg.includes('cook time noted'));
    expect(logged).toHaveLength(1);
    expect(logged[0].group).toBe('bench:cooking');
    expect(logged[0].msg).toMatch(/Cooked: .*Seared Stew.*Cook's Book: Seared Stew cook time noted \(25 cooks\)/);
    // The tally's ", " is the only punctuation between entries: no "., " run.
    expect(logged[0].msg).not.toMatch(/\.,/);
    // Nothing logged a line that is only the note.
    expect(g.state.log.some((l) => l.msg.startsWith("Cook's Book:"))).toBe(false);
  });
});
