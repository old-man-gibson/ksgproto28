/**
 * Runecarving is deterministic: the same inputs make the same rune, whatever
 * order they were laid down, cut or socketed in. These tests hold that line.
 *
 * Findings from docs/RUNECARVING_REVIEW.md §3 that they cover: F1 pattern
 * order, F2 adornment riders, F3 stack keys, F4 the random upgrade, F5 Refuse
 * grades, F6 technique surgery on carved runes, F7 socket order.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { RUNES } from '../src/core/registry';
import { RUNE_PATTERNS } from '../src/core/data/runes.data';
import { TECHNIQUES } from '../src/core/data/martial.data';
import {
  DAMAGE_TYPE_NAMES,
  runeRiders,
  type CarvedRune,
  type ItemInstance,
  type QualityTier,
  type RuneRef,
} from '../src/core/types';
import {
  adornmentEffectAt,
  carvedKey,
  clearCarvedCache,
  patternEffectAt,
  resolveRune,
  runeRefKey,
  weaponRuneBonuses,
  weaponTechniqueMods,
} from '../src/core/systems/runes';
import { carveRune, previewCarve } from '../src/core/systems/runecarving';
import { grantGraded, stockOf, type Placement } from '../src/core/systems/disciplines';
import { groupItems, stackKey } from '../src/core/systems/inventory';
import { forkOptions, resolvedMove, techniqueDisplayName, techniqueExit } from '../src/core/systems/martial';
import { describeRuneEffect, statTipLines } from '../src/ui/lib/format';

const at = (id: string, quality: QualityTier) => ({ id, quality });
const slab = (quality: QualityTier) => at('runestone_blank', quality);

/** Every ordering of `xs` (repeats included, so duplicates give duplicate orderings). */
function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs.slice()];
  return xs.flatMap((x, i) =>
    permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]),
  );
}

/** A minimal legal bench: a slab and one cut. */
const bench = (stone: QualityTier, pattern = 'pattern_might', extra: Placement = {}): Placement => ({
  slab: slab(stone),
  rune1: at(pattern, 'c'),
  ...extra,
});

/** A carver good enough that the slab never splits. */
function carver(seed = 1): Game {
  const g = new Game(createInitialState(seed));
  g.state.skills.runecarving = { level: 30, xp: 0 };
  return g;
}

function swordWith(runes: RuneRef[], uid = 700): ItemInstance {
  return { uid, defId: 'iron_sword', slots: runes.length, runes };
}

// ---------- F1 + F2: one multiset, one rune ----------

describe('a carving depends on what is in it, never on the order', () => {
  type Parts = Pick<CarvedRune, 'patterns' | 'adornments'>;
  const CARVINGS: [string, Parts][] = [
    ['one cut', { patterns: ['pattern_warding'], adornments: [] }],
    ['two different cuts', { patterns: ['pattern_warding', 'pattern_might'], adornments: [] }],
    ['a repeated cut beside another', { patterns: ['pattern_might', 'pattern_warding', 'pattern_might'], adornments: [] }],
    ['two repeated cuts, tied', { patterns: ['pattern_warding', 'pattern_might', 'pattern_warding', 'pattern_might'], adornments: [] }],
    ['three different cuts', { patterns: ['pattern_might', 'pattern_warding', 'pattern_edge'], adornments: [] }],
    ['two gels of different types', { patterns: ['pattern_might'], adornments: [at('warm_slime_gel', 'c'), at('chilled_slime_gel', 'c')] }],
    ['two gels of one type', { patterns: ['pattern_might'], adornments: [at('warm_slime_gel', 'c'), at('warm_slime_gel', 'b')] }],
    ['a gem', { patterns: ['pattern_edge'], adornments: [at('raw_sapphire', 'b')] }],
    [
      'gels, a gem and a pigment on two cuts',
      {
        patterns: ['pattern_warding', 'pattern_swiftness'],
        adornments: [at('warm_slime_gel', 'b'), at('chilled_slime_gel', 'c'), at('charged_slime_gel', 'a'), at('raw_sapphire', 'b')],
      },
    ],
    ['a named work (Stormbrand)', { patterns: ['pattern_edge'], adornments: [at('charged_slime_gel', 'b'), at('raw_sapphire', 'b')] }],
    ['a named work with two cuts (Twiceforged)', { patterns: ['pattern_warding', 'pattern_might'], adornments: [at('gold_leaf', 'c')] }],
  ];
  const STONES: QualityTier[] = ['c', 'b', 'a'];

  beforeEach(() => clearCarvedCache());
  afterEach(() => clearCarvedCache());

  it('every ordering of patterns and adornments resolves to the same rune, cold cache or not', () => {
    for (const [label, parts] of CARVINGS) {
      for (const stone of STONES) {
        const canonical: CarvedRune = { ...parts, stone: slab(stone), patterns: [...parts.patterns].sort() };
        clearCarvedCache();
        const expected = resolveRune(canonical);
        for (const patterns of permutations(parts.patterns)) {
          for (const adornments of permutations(parts.adornments)) {
            const spelled: CarvedRune = { patterns, stone: slab(stone), adornments };
            // The key sorts both lists, so every spelling shares one cache slot...
            expect(carvedKey(spelled)).toBe(carvedKey(canonical));
            // ...which is exactly why the FIRST spelling resolved must not matter:
            // empty the memo so this spelling is the one that fills it.
            clearCarvedCache();
            expect(resolveRune(spelled), `${label} @ ${stone}: ${patterns} | ${adornments.map((a) => a.id)}`).toStrictEqual(expected);
          }
        }
      }
    }
  });

  it('is not trivially equal: the carvings read as something', () => {
    for (const [label, parts] of CARVINGS) {
      const rune = resolveRune({ ...parts, stone: slab('c') });
      expect(Object.keys(rune.effects).length, label).toBeGreaterThan(0);
    }
  });

  it('the most-repeated cut leads, then the lower pattern id; it names the rune', () => {
    const stone = slab('c');
    const mightFirst = resolveRune({ patterns: ['pattern_warding', 'pattern_might'], stone, adornments: [] });
    expect(mightFirst.name).toBe('Fair Rune of Might (+1)');
    // Might takes the full share (damage 4); Warding the second share (armor 4 / 1.6) beside Might's armor 2.
    const damage = mightFirst.effects.weapon!.mods!.find((m) => m.stat === 'damage')!.value;
    expect(damage).toBe(4);
    const armor = mightFirst.effects.armor!.mods!.reduce((n, m) => n + (m.stat === 'armor' ? m.value : 0), 0);
    expect(armor).toBeCloseTo(2 + 4 / 1.6, 10);

    clearCarvedCache();
    const wardingTwice = resolveRune({ patterns: ['pattern_might', 'pattern_warding', 'pattern_warding'], stone, adornments: [] });
    expect(wardingTwice.name).toBe('Fair Rune of Warding (+1)');
  });
});

describe('F2: adornment riders are all kept', () => {
  const stone = slab('c');
  const warmThenChilled: CarvedRune = {
    patterns: ['pattern_might'],
    stone,
    adornments: [at('warm_slime_gel', 'c'), at('chilled_slime_gel', 'c')],
  };
  const chilledThenWarm: CarvedRune = { ...warmThenChilled, adornments: [...warmThenChilled.adornments].reverse() };

  beforeEach(() => clearCarvedCache());
  afterEach(() => clearCarvedCache());

  it('warm and chilled gel keep both heat and cold, in either order', () => {
    for (const rune of [warmThenChilled, chilledThenWarm]) {
      clearCarvedCache();
      const riders = runeRiders(resolveRune(rune).effects.weapon!.bonusDamage);
      // One rider per damage type, in damage-type order.
      expect(riders).toEqual([
        { type: 'cold', value: 2 },
        { type: 'heat', value: 2 },
      ]);
    }
  });

  it('weaponRuneBonuses returns every rider, each credited to the rune', () => {
    for (const rune of [warmThenChilled, chilledThenWarm]) {
      clearCarvedCache();
      const g = new Game(createInitialState(11));
      g.state.equipment.weapon = swordWith([rune]);
      const name = resolveRune(rune).name;
      expect(weaponRuneBonuses(g.state)).toEqual({
        flat: [
          { type: 'cold', value: 2, source: name },
          { type: 'heat', value: 2, source: name },
        ],
        pct: [],
      });
    }
  });

  it('the readers show every rider', () => {
    const g = new Game(createInitialState(12));
    g.state.equipment.weapon = swordWith([warmThenChilled]);
    const effect = resolveRune(warmThenChilled).effects.weapon;
    const text = describeRuneEffect(effect);
    expect(text).toContain(`+2 ${DAMAGE_TYPE_NAMES.heat} damage`);
    expect(text).toContain(`+2 ${DAMAGE_TYPE_NAMES.cold} damage`);
    const tip = statTipLines(g.state, 'damage').filter((l) => l.startsWith('on hit:'));
    expect(tip).toHaveLength(2);
    expect(tip.join('\n')).toContain(DAMAGE_TYPE_NAMES.heat);
    expect(tip.join('\n')).toContain(DAMAGE_TYPE_NAMES.cold);
  });

  it('riders of one type sum, flat and percent kept apart', () => {
    const twoWarm = resolveRune({ patterns: ['pattern_might'], stone, adornments: [at('warm_slime_gel', 'c'), at('warm_slime_gel', 'b')] });
    const heat = runeRiders(twoWarm.effects.weapon!.bonusDamage);
    expect(heat).toHaveLength(1);
    expect(heat[0].value).toBeCloseTo(2 + 2 * 1.6, 10);

    const mixed = resolveRune({ patterns: ['pattern_might'], stone, adornments: [at('warm_slime_gel', 'c'), at('charged_slime_gel', 'c')] });
    expect(runeRiders(mixed.effects.weapon!.bonusDamage)).toEqual([{ type: 'heat', value: 2 }]);
    expect(runeRiders(mixed.effects.weapon!.bonusDamagePct)).toEqual([{ type: 'lightning', value: 0.06 }]);
  });

  it("a named work's own rider sums into the same type (Winter's Edge)", () => {
    const winters = resolveRune({
      patterns: ['pattern_edge'],
      stone: slab('a'),
      adornments: [at('chilled_slime_gel', 'b'), at('cut_garnet', 'c')],
    });
    expect(winters.name).toBe("Winter's Edge");
    const cold = runeRiders(winters.effects.weapon!.bonusDamage);
    expect(cold).toHaveLength(1);
    expect(cold[0].type).toBe('cold');
    expect(cold[0].value).toBeCloseTo(2 * 1.6 + 6, 10);
  });

  it('authored single riders still read through the same door', () => {
    expect(runeRiders(RUNES.minor_rune_thunder.effects.weapon!.bonusDamage)).toEqual([{ type: 'lightning', value: 3 }]);
    expect(runeRiders(undefined)).toEqual([]);
  });
});

// ---------- F3: stack keys ----------

describe('F3: items stack by what is carved on them', () => {
  const might: CarvedRune = { patterns: ['pattern_might'], stone: slab('c'), adornments: [] };
  const warding: CarvedRune = { patterns: ['pattern_warding'], stone: slab('c'), adornments: [] };

  it('different carvings do not share a stack key', () => {
    expect(stackKey(swordWith([might], 1))).not.toBe(stackKey(swordWith([warding], 2)));
    expect(stackKey(swordWith([might], 1))).not.toContain('[object Object]');
    const stacks = groupItems([swordWith([might], 1), swordWith([warding], 2)]);
    expect(stacks).toHaveLength(2);
  });

  it('the same carvings in another socket order share one', () => {
    expect(stackKey(swordWith([might, warding], 1))).toBe(stackKey(swordWith([warding, might], 2)));
    const stacks = groupItems([swordWith([might, warding], 1), swordWith([warding, might], 2)]);
    expect(stacks).toHaveLength(1);
    expect(stacks[0].items).toHaveLength(2);
  });

  it('one carving spelled two ways is one carving', () => {
    const a: CarvedRune = { patterns: ['pattern_might', 'pattern_warding'], stone: slab('b'), adornments: [at('warm_slime_gel', 'c'), at('gold_leaf', 'c')] };
    const b: CarvedRune = { patterns: ['pattern_warding', 'pattern_might'], stone: slab('b'), adornments: [at('gold_leaf', 'c'), at('warm_slime_gel', 'c')] };
    expect(stackKey(swordWith([a], 1))).toBe(stackKey(swordWith([b], 2)));
  });

  it('catalogue runes still group, and never collide with a carving', () => {
    expect(stackKey(swordWith(['minor_rune_might', 'rune_swiftness'], 1))).toBe(
      stackKey(swordWith(['rune_swiftness', 'minor_rune_might'], 2)),
    );
    expect(stackKey(swordWith(['minor_rune_might'], 1))).not.toBe(stackKey(swordWith([might], 2)));
    expect(runeRefKey('minor_rune_might')).toBe('minor_rune_might');
    expect(runeRefKey(might)).toBe(carvedKey(might));
  });
});

// ---------- F4: the tool does not change the rune ----------

describe('F4: the tool only lowers the chance the slab splits', () => {
  it('a fine tool never lifts the slab a grade', () => {
    const g = carver(3);
    grantGraded(g.state, 'runestone_blank', 'c', 30);
    grantGraded(g.state, 'steel_burin', 's', 1);
    for (let i = 0; i < 30; i++) {
      const result = carveRune(g.state, g.bus, bench('c', 'pattern_might', { tool: at('steel_burin', 's') }));
      expect(result?.carved?.stone.quality).toBe('c');
    }
    expect(g.state.carved).toHaveLength(30);
  });

  it('the same bench makes the same rune every time', () => {
    const g = carver(4);
    grantGraded(g.state, 'runestone_blank', 'b', 2);
    grantGraded(g.state, 'steel_burin', 'a', 1);
    const placement = bench('b', 'pattern_might', { tool: at('steel_burin', 'a') });
    const first = carveRune(g.state, g.bus, placement)!.carved!;
    const second = carveRune(g.state, g.bus, placement)!.carved!;
    expect(second).toEqual(first);
  });

  it('the preview reports a split chance and no upgrade chance', () => {
    const g = carver(5);
    grantGraded(g.state, 'runestone_blank', 'c', 1);
    grantGraded(g.state, 'steel_burin', 'a', 1);
    const check = previewCarve(g.state, bench('c', 'pattern_might', { tool: at('steel_burin', 'a') }));
    expect(check.ok).toBe(true);
    expect(check.failure).toBeDefined();
    expect(check).not.toHaveProperty('upgrade');
  });
});

// ---------- F5: Refuse grades ----------

describe('F5: a Refuse (F) grade is refused, and reads as nothing in old saves', () => {
  it('previewCarve refuses an F slab with a reason, and carving spends nothing', () => {
    const g = carver(6);
    grantGraded(g.state, 'runestone_blank', 'f', 2);
    const check = previewCarve(g.state, bench('f'));
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/Refuse slab cannot be cut/);
    expect(carveRune(g.state, g.bus, bench('f'))).toBeNull();
    expect(stockOf(g.state, 'runestone_blank', 'f')).toBe(2);
    expect(g.state.carved).toHaveLength(0);
  });

  it('previewCarve refuses an F adornment in an inlay or a gem seat', () => {
    const g = carver(7);
    grantGraded(g.state, 'runestone_blank', 'c', 2);
    grantGraded(g.state, 'warm_slime_gel', 'f', 1);
    grantGraded(g.state, 'raw_sapphire', 'f', 1);
    const inlay = previewCarve(g.state, bench('c', 'pattern_might', { inlay: at('warm_slime_gel', 'f') }));
    expect(inlay.ok).toBe(false);
    expect(inlay.reason).toMatch(/Warm Slime Gel at Refuse cannot be worked in/);
    const gem = previewCarve(g.state, bench('c', 'pattern_might', { gem1: at('raw_sapphire', 'f') }));
    expect(gem.ok).toBe(false);
    expect(gem.reason).toMatch(/Raw Sapphire at Refuse cannot be worked in/);
  });

  it('the grade just above Refuse is still allowed', () => {
    const g = carver(8);
    grantGraded(g.state, 'runestone_blank', 'e', 1);
    grantGraded(g.state, 'warm_slime_gel', 'e', 1);
    expect(previewCarve(g.state, bench('e', 'pattern_might', { inlay: at('warm_slime_gel', 'e') })).ok).toBe(true);
  });

  it('the bench previews of a single F contribution are empty', () => {
    expect(patternEffectAt('pattern_might', 'f', 'weapon')).toBeUndefined();
    expect(adornmentEffectAt('warm_slime_gel', 'f', 'weapon')).toBeUndefined();
  });

  /** Every number a composed rune grants, across contexts and kinds. */
  function allValues(rune: ReturnType<typeof resolveRune>): number[] {
    const out: number[] = [];
    for (const effect of Object.values(rune.effects)) {
      for (const m of effect.mods ?? []) out.push(m.value);
      for (const r of runeRiders(effect.bonusDamage)) out.push(r.value);
      for (const r of runeRiders(effect.bonusDamagePct)) out.push(r.value);
    }
    return out;
  }

  it('a legacy F carving composes to nothing negative', () => {
    clearCarvedCache();
    const refuse = resolveRune({
      patterns: ['pattern_might', 'pattern_warding'],
      stone: slab('f'),
      adornments: [at('warm_slime_gel', 'f'), at('gold_leaf', 'f')],
    });
    expect(refuse.effects).toEqual({});
    expect(allValues(refuse).every((v) => v >= 0)).toBe(true);
  });

  it('an F adornment on a good slab adds nothing and takes nothing', () => {
    clearCarvedCache();
    const plain = resolveRune({ patterns: ['pattern_might'], stone: slab('b'), adornments: [at('chilled_slime_gel', 'c')] });
    const spoiled = resolveRune({
      patterns: ['pattern_might'],
      stone: slab('b'),
      adornments: [at('chilled_slime_gel', 'c'), at('warm_slime_gel', 'f')],
    });
    expect(spoiled.effects).toEqual(plain.effects);
    expect(allValues(spoiled).every((v) => v >= 0)).toBe(true);
  });
});

// ---------- F6: technique surgery survives composition ----------

describe('F6: a carved rune keeps its patterns\' technique surgery', () => {
  beforeEach(() => {
    RUNE_PATTERNS['test_surgery_a'] = {
      id: 'test_surgery_a',
      name: 'Test Surgery A',
      icon: 'A',
      effects: {
        weapon: {
          mods: [{ stat: 'damage', op: 'add', value: 1 }],
          techniqueMods: [{ technique: 'thrust', rename: 'Alpha Thrust', exitTo: 'coiled' }],
        },
      },
    };
    RUNE_PATTERNS['test_surgery_b'] = {
      id: 'test_surgery_b',
      name: 'Test Surgery B',
      icon: 'B',
      effects: {
        weapon: {
          techniqueMods: [
            { technique: 'sidestep', cooldownMult: 0.5 },
            { technique: 'riposte', damageMult: 1.1, grantsFork: 'sweep' },
          ],
        },
      },
    };
    clearCarvedCache();
  });
  afterEach(() => {
    delete RUNE_PATTERNS['test_surgery_a'];
    delete RUNE_PATTERNS['test_surgery_b'];
    clearCarvedCache();
  });

  it('merging two patterns keeps both contributors\' mods, unscaled by the stone', () => {
    const both = resolveRune({ patterns: ['test_surgery_b', 'test_surgery_a'], stone: slab('a'), adornments: [] });
    expect(both.effects.weapon!.techniqueMods).toEqual([
      { technique: 'thrust', rename: 'Alpha Thrust', exitTo: 'coiled' },
      { technique: 'sidestep', cooldownMult: 0.5 },
      { technique: 'riposte', damageMult: 1.1, grantsFork: 'sweep' },
    ]);
    // The stat mod beside them IS a magnitude, and does scale: 1 x 2.5 (Superb).
    expect(both.effects.weapon!.mods![0].value).toBe(2.5);
  });

  it('a single pattern carries its surgery through the scaling too', () => {
    const one = resolveRune({ patterns: ['test_surgery_b'], stone: slab('b'), adornments: [] });
    expect(one.effects.weapon!.techniqueMods).toHaveLength(2);
    expect(one.effects.weapon!.techniqueMods![1].damageMult).toBe(1.1);
  });

  it('the surgery reaches the technique once the carving is socketed', () => {
    const rune: CarvedRune = { patterns: ['test_surgery_a'], stone: slab('c'), adornments: [] };
    const g = new Game(createInitialState(13));
    g.state.equipment.weapon = swordWith([rune]);
    expect(techniqueExit(g.state, TECHNIQUES.thrust)).toBe('coiled');
    expect(techniqueDisplayName(g.state, TECHNIQUES.thrust)).toBe('Alpha Thrust');
  });
});

// ---------- F7: socket order ----------

describe('F7: socket order does not decide a technique', () => {
  // Catalogue runes target different techniques, so build the conflict: two
  // runes that both rewrite Thrust, with clashing names, exits, tempo and forks.
  beforeEach(() => {
    RUNES['test_rune_a'] = {
      id: 'test_rune_a',
      name: 'Test Rune A',
      icon: 'A',
      value: 1,
      effects: {
        weapon: {
          techniqueMods: [{ technique: 'thrust', rename: 'Alpha Thrust', exitTo: 'coiled', cooldownMult: 0.2, grantsFork: 'sweep' }],
        },
      },
    };
    RUNES['test_rune_b'] = {
      id: 'test_rune_b',
      name: 'Test Rune B',
      icon: 'B',
      value: 1,
      effects: {
        weapon: {
          techniqueMods: [{ technique: 'thrust', rename: 'Beta Thrust', exitTo: 'extended', cooldownMult: 1.5, grantsFork: 'split' }],
        },
      },
    };
  });
  afterEach(() => {
    delete RUNES['test_rune_a'];
    delete RUNES['test_rune_b'];
    clearCarvedCache();
  });

  function wielding(runes: RuneRef[]): Game {
    const g = new Game(createInitialState(14));
    g.state.equipment.weapon = swordWith(runes);
    return g;
  }

  it('the exit and the name are the same in both socket orders', () => {
    const ab = wielding(['test_rune_a', 'test_rune_b']);
    const ba = wielding(['test_rune_b', 'test_rune_a']);
    expect(techniqueExit(ab.state, TECHNIQUES.thrust)).toBe(techniqueExit(ba.state, TECHNIQUES.thrust));
    expect(techniqueDisplayName(ab.state, TECHNIQUES.thrust)).toBe(techniqueDisplayName(ba.state, TECHNIQUES.thrust));
    // And it is the canonical winner: the lower rune key.
    expect(techniqueExit(ab.state, TECHNIQUES.thrust)).toBe('coiled');
    expect(techniqueDisplayName(ab.state, TECHNIQUES.thrust)).toBe('Alpha Thrust');
  });

  it('the mods come back in one order whichever socket holds which rune', () => {
    const names = (g: Game) => weaponTechniqueMods(g.state, 'thrust').map((m) => m.rename);
    expect(names(wielding(['test_rune_a', 'test_rune_b']))).toEqual(['Alpha Thrust', 'Beta Thrust']);
    expect(names(wielding(['test_rune_b', 'test_rune_a']))).toEqual(['Alpha Thrust', 'Beta Thrust']);
  });

  it('tempo and the Honed offering do not depend on it either', () => {
    // 30 x 0.2 clamps up to 10, then x 1.5 = 15. The other way round, 30 x 1.5 = 45, x 0.2 = 9, clamped to 10:
    // the cooldown step is order-dependent, so the order has to be fixed.
    const ab = wielding(['test_rune_a', 'test_rune_b']);
    const ba = wielding(['test_rune_b', 'test_rune_a']);
    expect(resolvedMove(ab.state, TECHNIQUES.thrust).cooldown).toBe(15);
    expect(resolvedMove(ba.state, TECHNIQUES.thrust)).toEqual(resolvedMove(ab.state, TECHNIQUES.thrust));
    const offered = (g: Game) => forkOptions(g.state, TECHNIQUES.thrust).map((a) => a.id);
    expect(offered(ab)).toEqual(offered(ba));
    expect(offered(ab)).toEqual(expect.arrayContaining(['sweep', 'split']));
  });

  it('carved runes and catalogue runes order the same way', () => {
    // A carving's key starts with its pattern ids; a catalogue id is the id itself.
    // 'aa_..' sorts before 'test_rune_..', so the carving's mod wins either way round.
    RUNE_PATTERNS['aa_test_surgery_c'] = {
      id: 'aa_test_surgery_c',
      name: 'Test Surgery C',
      icon: 'C',
      effects: { weapon: { techniqueMods: [{ technique: 'thrust', rename: 'Gamma Thrust', exitTo: 'wide_open' }] } },
    };
    try {
      const carved: CarvedRune = { patterns: ['aa_test_surgery_c'], stone: slab('c'), adornments: [] };
      const one = wielding([carved, 'test_rune_a']);
      const two = wielding(['test_rune_a', carved]);
      expect(techniqueExit(one.state, TECHNIQUES.thrust)).toBe(techniqueExit(two.state, TECHNIQUES.thrust));
      expect(techniqueDisplayName(one.state, TECHNIQUES.thrust)).toBe(techniqueDisplayName(two.state, TECHNIQUES.thrust));
      expect(techniqueDisplayName(one.state, TECHNIQUES.thrust)).toBe('Gamma Thrust');
    } finally {
      delete RUNE_PATTERNS['aa_test_surgery_c'];
      clearCarvedCache();
    }
  });
});
