import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { DISCIPLINES } from '../src/core/data/disciplines.data';
import { QUALITY_ORDER, qualityMult } from '../src/core/data/quality.data';
import {
  bestQuality,
  checkCraft,
  combinedQuality,
  gradesHeld,
  grantGraded,
  grantMaterial,
  nextSlot,
  noveltyKeys,
  openSlots,
  stockOf,
  type Placement,
} from '../src/core/systems/disciplines';
import { carveRune, failureChance, previewCarve } from '../src/core/systems/runecarving';
import { carvedKey, namedRuneFor, resolveRune } from '../src/core/systems/runes';
import { runeRiders, type CarvedRune, type QualityTier } from '../src/core/types';

const RC = DISCIPLINES.runecarving;
const fresh = (seed = 1) => new Game(createInitialState(seed));

/**
 * Stock a bench, and make the carver good enough that the slab does not split.
 * Failure is rolled, so anything asserting on the RESULT of a carve has to
 * remove that variable deliberately rather than hope.
 */
function supply(g: Game, stone: QualityTier = 'c', adornments: [string, QualityTier][] = []) {
  grantGraded(g.state, 'runestone_blank', stone, 5);
  for (const [id, q] of adornments) grantGraded(g.state, id, q, 5);
  g.state.skills.runecarving = { level: 30, xp: 0 };
}

const at = (id: string, quality: QualityTier) => ({ id, quality });

/** A minimal legal bench: a slab and one cut. */
const bench = (stone: QualityTier, pattern = 'pattern_might', extra: Placement = {}): Placement => ({
  slab: at('runestone_blank', stone),
  rune1: at(pattern, 'c'),
  ...extra,
});

describe('graded stock', () => {
  it('keeps graded materials per grade and plain ones as a count', () => {
    const g = fresh();
    grantMaterial(g.state, 'slime_gel', 3); // ungraded
    expect(g.state.materials.slime_gel).toBe(3);
    expect(g.state.stock.slime_gel).toBeUndefined();

    grantMaterial(g.state, 'runestone_blank', 4); // graded
    expect(g.state.materials.runestone_blank).toBeUndefined();
    const held = gradesHeld(g.state, 'runestone_blank');
    expect(held.reduce((n, e) => n + e.qty, 0)).toBe(4);
  });

  it('a stack of found things can hold several grades', () => {
    const g = fresh(7);
    grantMaterial(g.state, 'runestone_blank', 40);
    expect(gradesHeld(g.state, 'runestone_blank').length).toBeGreaterThan(1);
  });

  it('refuse is genuinely worse than nothing, not merely less good', () => {
    expect(qualityMult('f')).toBeLessThan(0);
    expect(qualityMult('c')).toBe(1);
    expect(qualityMult('s')).toBeGreaterThan(qualityMult('a'));
    // The scale is strictly ordered.
    for (let i = 1; i < QUALITY_ORDER.length; i++) {
      expect(qualityMult(QUALITY_ORDER[i])).toBeGreaterThan(qualityMult(QUALITY_ORDER[i - 1]));
    }
  });
});

describe('slots widen with the skill', () => {
  it('opens one cut to begin with, and more as the carver steadies', () => {
    const g = fresh();
    const ids = () => openSlots(g.state, RC).map((s) => s.id);
    expect(ids()).toContain('rune1');
    expect(ids()).not.toContain('rune2');

    g.state.skills.runecarving = { level: 10, xp: 0 };
    expect(ids()).toContain('rune2');

    g.state.skills.runecarving = { level: 25, xp: 0 };
    expect(ids()).toContain('rune3');
  });

  it('the stations around the slab are open from the start', () => {
    const g = fresh();
    const ids = openSlots(g.state, RC).map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['slab', 'inlay', 'color', 'gem1', 'gem2', 'tool']));
  });

  it('names the next slot so the bench can tease it', () => {
    const g = fresh();
    expect(nextSlot(g.state, RC)).toMatchObject({ level: 10 });
    g.state.skills.runecarving = { level: 30, xp: 0 };
    expect(nextSlot(g.state, RC)).toBeUndefined();
  });

  it('refuses to work a slot that is not open yet', () => {
    const g = fresh();
    grantGraded(g.state, 'runestone_blank', 'c', 1);
    // rune3 needs Runecarving 25.
    const placement: Placement = { slab: at('runestone_blank', 'c'), rune3: at('pattern_might', 'c') };
    expect(checkCraft(g.state, RC, placement).ok).toBe(false);
  });
});

describe('the bench validates what is laid on it', () => {
  it('rejects an empty slab, the wrong material, and stock you do not have', () => {
    const g = fresh();
    expect(checkCraft(g.state, RC, {}).reason).toMatch(/Rune Slab is empty/);

    supply(g);
    // Gold leaf is an inlay, not a slab.
    grantGraded(g.state, 'gold_leaf', 'c', 1);
    expect(checkCraft(g.state, RC, { slab: at('gold_leaf', 'c') }).reason).toMatch(/does not belong/);

    // A grade the player holds none of.
    expect(checkCraft(g.state, RC, { slab: at('runestone_blank', 's') }).reason).toMatch(/no /i);
  });

  it('accepts a slab and one cut — every station around it is optional', () => {
    const g = fresh();
    supply(g);
    // The first rune is required; inlay, colour, gems and tool are not.
    expect(checkCraft(g.state, RC, bench('c')).ok).toBe(true);
    expect(checkCraft(g.state, RC, { slab: at('runestone_blank', 'c') }).reason).toMatch(
      /First Rune is empty/,
    );
  });

  it('needs at least one cut, however well stocked the bench is', () => {
    const g = fresh();
    supply(g, 'a', [['gold_leaf', 'a']]);
    const noCut: Placement = { slab: at('runestone_blank', 'a'), inlay: at('gold_leaf', 'a') };
    expect(previewCarve(g.state, noCut).reason).toMatch(/No rune chosen/);
  });

  it('a plain slab cannot hold the same cut twice', () => {
    const g = fresh();
    supply(g);
    const twice = bench('c', 'pattern_might', { rune2: at('pattern_might', 'c') });
    expect(previewCarve(g.state, twice).reason).toMatch(/Fine slab or better/);
  });

  it('a fine slab can, and a superb one takes three', () => {
    const g = fresh();
    supply(g, 'b');
    grantGraded(g.state, 'runestone_blank', 'a', 2);
    const twice = (q: QualityTier) => bench(q, 'pattern_might', { rune2: at('pattern_might', 'c') });
    expect(previewCarve(g.state, twice('b')).ok).toBe(true);

    const thrice = {
      ...bench('b', 'pattern_might'),
      rune2: at('pattern_might', 'c'),
      rune3: at('pattern_might', 'c'),
    };
    // Three copies asks more of the slab than a Fine one can give.
    expect(previewCarve(g.state, thrice).reason).toMatch(/Superb slab or better/);
    expect(previewCarve(g.state, { ...thrice, slab: at('runestone_blank', 'a') }).ok).toBe(true);
  });
});

describe('quality of a combination', () => {
  it('averages what went in, so one piece of refuse drags it down', () => {
    const good: Placement = { slab: at('runestone_blank', 'a'), inlay: at('gold_leaf', 'a') };
    const spoiled: Placement = { slab: at('runestone_blank', 'a'), inlay: at('gold_leaf', 'f') };
    expect(combinedQuality(spoiled)).toBeLessThan(combinedQuality(good));
    expect(bestQuality(spoiled)).toBe('a'); // the best piece is still the best piece
  });
});

describe('carving', () => {
  it('produces a rune whose strength tracks the slab', () => {
    const poor = fresh();
    const fine = fresh();
    supply(poor, 'e');
    supply(fine, 'a');

    const a = carveRune(poor.state, poor.bus, bench('e'))!.carved!;
    const b = carveRune(fine.state, fine.bus, bench('a'))!.carved!;
    const dmgOf = (c: CarvedRune) =>
      resolveRune(c).effects.weapon!.mods!.find((m) => m.stat === 'damage')!.value;
    expect(dmgOf(b)).toBeGreaterThan(dmgOf(a));
  });

  it('spends exactly what was on the bench', () => {
    const g = fresh();
    supply(g, 'c', [['gold_leaf', 'c']]);
    const before = stockOf(g.state, 'runestone_blank', 'c');

    carveRune(g.state, g.bus, bench('c', 'pattern_might', { inlay: at('gold_leaf', 'c') }));
    expect(stockOf(g.state, 'runestone_blank', 'c')).toBe(before - 1);
    expect(stockOf(g.state, 'gold_leaf', 'c')).toBe(4);
    expect(g.state.carved).toHaveLength(1);
  });

  it('a tool is worked WITH, not spent', () => {
    const g = fresh();
    supply(g);
    grantGraded(g.state, 'steel_burin', 'b', 1);
    carveRune(g.state, g.bus, bench('c', 'pattern_might', { tool: at('steel_burin', 'b') }));
    // Still there for the next slab.
    expect(stockOf(g.state, 'steel_burin', 'b')).toBe(1);
  });

  it('refuses a pattern the carver has not grown into, and spends nothing', () => {
    const g = fresh();
    grantGraded(g.state, 'runestone_blank', 'c', 5); // deliberately unskilled
    const before = stockOf(g.state, 'runestone_blank', 'c');
    // pattern_edge needs Runecarving 12.
    expect(carveRune(g.state, g.bus, bench('c', 'pattern_edge'))).toBeNull();
    expect(stockOf(g.state, 'runestone_blank', 'c')).toBe(before);
    expect(g.state.carved).toHaveLength(0);
  });

  it('adornments add their own effects on top of the pattern', () => {
    const g = fresh();
    supply(g, 'c', [['warm_slime_gel', 'c']]);
    const plain = previewCarve(g.state, bench('c'));
    const inlaid = previewCarve(g.state, bench('c', 'pattern_might', { inlay: at('warm_slime_gel', 'c') }));
    expect(runeRiders(resolveRune(plain.preview!).effects.weapon?.bonusDamage)).toEqual([]);
    // The gel is what puts fire on the blade; the pattern never did.
    expect(runeRiders(resolveRune(inlaid.preview!).effects.weapon?.bonusDamage).map((r) => r.type)).toEqual(['heat']);
  });

  it('a second cut adds a new capability, but at a diminished share', () => {
    const g = fresh();
    supply(g, 'c');
    const armorOf = (c: CarvedRune) =>
      resolveRune(c).effects.armor?.mods?.find((m) => m.stat === 'armor')?.value ?? 0;

    const alone = previewCarve(g.state, bench('c', 'pattern_warding')).preview!;
    const second = previewCarve(
      g.state,
      bench('c', 'pattern_might', { rune2: at('pattern_warding', 'c') }),
    ).preview!;

    // Warding in the second seat is worth less than warding on its own slab...
    expect(armorOf(second)).toBeGreaterThan(0);
    expect(armorOf(second)).toBeLessThan(armorOf(alone));
    // ...and the slab now does something a single cut could not.
    expect(resolveRune(second).effects.weapon?.mods?.some((m) => m.stat === 'damage')).toBe(true);
  });
});

describe('repeating a cut concentrates the rune', () => {
  it('two of one figure beat two different ones, and beat a single', () => {
    const g = fresh();
    supply(g, 'b');
    const dmg = (p: Placement) => {
      const c = previewCarve(g.state, p).preview!;
      return resolveRune(c).effects.weapon?.mods?.find((m) => m.stat === 'damage')?.value ?? 0;
    };

    const single = dmg(bench('b'));
    const doubled = dmg(bench('b', 'pattern_might', { rune2: at('pattern_might', 'c') }));
    const broad = dmg(bench('b', 'pattern_might', { rune2: at('pattern_warding', 'c') }));

    // Concentrating beats spreading, for the thing you concentrated on...
    expect(doubled).toBeGreaterThan(broad);
    // ...and two cuts of it beat one, by more than simply adding a diluted copy.
    expect(doubled).toBeGreaterThan(single * 2);
  });

  it('a concentrated rune says so in its name', () => {
    const g = fresh();
    supply(g, 'b');
    const c = previewCarve(g.state, bench('b', 'pattern_might', { rune2: at('pattern_might', 'c') }))
      .preview!;
    expect(resolveRune(c).name).toContain('×2');
  });

  it('a doubled cut is not the same work as a single one', () => {
    const one: CarvedRune = {
      patterns: ['pattern_warding'],
      stone: at('runestone_blank', 'b'),
      adornments: [at('warm_slime_gel', 'c')],
    };
    const two: CarvedRune = { ...one, patterns: ['pattern_warding', 'pattern_warding'] };
    // Hearthward is a single warding cut; doubling it must not inherit the name.
    expect(namedRuneFor(one)?.id).toBe('hearthward');
    expect(namedRuneFor(two)).toBeUndefined();
    expect(carvedKey(one)).not.toBe(carvedKey(two));
  });
});

describe('the tool and the risk of splitting', () => {
  it('bare-handed work on a fresh carver is a real gamble', () => {
    const g = fresh();
    expect(failureChance(g.state, bench('c'))).toBeGreaterThan(0.25);
  });

  it('a good tool takes most of the risk out of it', () => {
    const g = fresh();
    const bare = failureChance(g.state, bench('c'));
    const armed = failureChance(g.state, bench('c', 'pattern_might', { tool: at('steel_burin', 'a') }));
    expect(armed).toBeLessThan(bare);
  });

  it('an F-grade tool counts as no tool, never worse', () => {
    const g = fresh();
    const bare = failureChance(g.state, bench('c'));
    expect(failureChance(g.state, bench('c', 'pattern_might', { tool: at('steel_burin', 'f') }))).toBe(bare);
    // The next grade up is the first that helps.
    expect(failureChance(g.state, bench('c', 'pattern_might', { tool: at('steel_burin', 'e') }))).toBeLessThan(bare);
  });

  it('every extra cut is another thing that can go wrong', () => {
    const g = fresh();
    g.state.skills.runecarving = { level: 25, xp: 0 };
    const one = failureChance(g.state, bench('c'));
    const three = failureChance(g.state, {
      ...bench('c'),
      rune2: at('pattern_warding', 'c'),
      rune3: at('pattern_swiftness', 'c'),
    });
    expect(three).toBeGreaterThan(one);
  });

  it('mastery and a fine tool can finish the job outright', () => {
    const g = fresh();
    g.state.skills.runecarving = { level: 30, xp: 0 };
    expect(failureChance(g.state, bench('c', 'pattern_might', { tool: at('steel_burin', 's') }))).toBe(0);
  });

  it('a split slab is still a spent slab', () => {
    const g = fresh(3);
    grantGraded(g.state, 'runestone_blank', 'c', 20);
    g.state.skills.runecarving = { level: 1, xp: 0 };

    let failures = 0;
    for (let i = 0; i < 20; i++) {
      const before = stockOf(g.state, 'runestone_blank', 'c');
      const result = carveRune(g.state, g.bus, bench('c'));
      if (result?.failed) failures++;
      expect(stockOf(g.state, 'runestone_blank', 'c')).toBe(before - 1);
    }
    expect(failures).toBeGreaterThan(0); // an unskilled carver does split slabs
  });
});

describe('a carving is its own recipe', () => {
  it('encodes the whole combination, so it can be read back', () => {
    const rune: CarvedRune = {
      patterns: ['pattern_edge'],
      stone: at('runestone_blank', 'a'),
      adornments: [at('gold_leaf', 'b'), at('charged_slime_gel', 'c')],
    };
    const key = carvedKey(rune);
    expect(key).toContain('pattern_edge');
    expect(key).toContain('runestone_blank.a');
    expect(key).toContain('gold_leaf.b');
    // Order of adornments must not change its identity.
    const shuffled: CarvedRune = { ...rune, adornments: [...rune.adornments].reverse() };
    expect(carvedKey(shuffled)).toBe(key);
  });

  it('the same combination always composes to the same rune', () => {
    const rune: CarvedRune = {
      patterns: ['pattern_might'],
      stone: at('runestone_blank', 'b'),
      adornments: [at('gold_leaf', 'c')],
    };
    const copy: CarvedRune = JSON.parse(JSON.stringify(rune));
    expect(resolveRune(copy)).toEqual(resolveRune(rune));
  });

  it('an exact recipe is a named work, and a near miss is not', () => {
    const stormbrand: CarvedRune = {
      patterns: ['pattern_edge'],
      stone: at('runestone_blank', 'a'),
      adornments: [at('charged_slime_gel', 'b'), at('raw_sapphire', 'b')],
    };
    expect(namedRuneFor(stormbrand)?.id).toBe('stormbrand');
    expect(resolveRune(stormbrand).name).toBe('Stormbrand');

    // A stone too poor for it.
    expect(namedRuneFor({ ...stormbrand, stone: at('runestone_blank', 'e') })).toBeUndefined();
    // An extra adornment is a different work entirely.
    expect(
      namedRuneFor({ ...stormbrand, adornments: [...stormbrand.adornments, at('cut_garnet', 'c')] }),
    ).toBeUndefined();
    // The right things, wrong pattern.
    expect(namedRuneFor({ ...stormbrand, patterns: ['pattern_might'] })).toBeUndefined();
  });

  it('a named work grants more than its parts alone', () => {
    const named: CarvedRune = {
      patterns: ['pattern_edge'],
      stone: at('runestone_blank', 'a'),
      adornments: [at('charged_slime_gel', 'b'), at('raw_sapphire', 'b')],
    };
    const unnamed: CarvedRune = { ...named, patterns: ['pattern_might'] };
    const critOf = (c: CarvedRune) =>
      resolveRune(c).effects.weapon?.mods?.find((m) => m.stat === 'critDamage')?.value ?? 0;
    expect(critOf(named)).toBeGreaterThan(critOf(unnamed));
  });
});

describe('carvings behave like any other rune', () => {
  it('sockets, contributes its modifiers, and comes back out', () => {
    const g = fresh();
    supply(g, 'a');
    carveRune(g.state, g.bus, bench('a'));

    const sword = g.state.inventory[0];
    sword.slots = 1;
    expect(g.socketRune(sword.uid, 'carved:0')).not.toBe(false);
    expect(g.state.carved).toHaveLength(0);
    expect(sword.runes).toHaveLength(1);

    g.equip(sword.uid);
    // The rune's damage is in the block, sourced by its own name.
    const named = resolveRune(sword.runes![0]).name;
    expect(named).toBeTruthy();

    g.unsocketRune(sword.uid, 0);
    expect(g.state.carved).toHaveLength(1); // one of a kind: it goes back to the pile
  });
});

describe('what a craft teaches', () => {
  it('credits the combination and every part of it separately', () => {
    const keys = noveltyKeys(RC, {
      slab: at('runestone_blank', 'c'),
      inlay: at('gold_leaf', 'c'),
    });
    expect(keys[0]).toBe('runecarving:gold_leaf+runestone_blank');
    expect(keys).toContain('runecarving:part:gold_leaf');
    expect(keys).toContain('runecarving:part:runestone_blank');
  });
});
