import { describe, expect, it } from 'vitest';
import type { WuxinConfig } from '../src/core/types';
import {
  WUXIN_SLOTS,
  alignment,
  classify,
  isCounterflow,
  discord,
  eligibleElements,
  formatWuxin,
  harmonyDistance,
  isHarmonious,
  isLegal,
  landmarks,
  parseWuxin,
  shapeOf,
  validateWuxin,
} from '../src/core/systems/wuxin';

/**
 * A cycle written in the grammar. The classical relation, spelled with the
 * elements the lexicon actually has: seed stands in for wood, stone for earth,
 * iron for metal.
 */
const CLASSICAL = `
seed  → fire  ⊣ stone
fire  → stone ⊣ iron
stone → iron  ⊣ water
iron  → water ⊣ seed
water → seed  ⊣ fire
`;

/**
 * The antipode: destruction is the generative ring run backwards, so every
 * element hinders the one that feeds it. Found by hand in the panel.
 */
const COUNTERFLOW = `
seed  → iron  ⊣ stone
fire  → water ⊣ iron
stone → seed  ⊣ water
iron  → fire  ⊣ seed
water → stone ⊣ fire
`;

const parsed = (text: string): WuxinConfig => {
  const cfg = parseWuxin(text);
  expect(cfg).not.toBeNull();
  return cfg!;
};

describe('the grammar', () => {
  it('reads a configuration back from five clauses', () => {
    const cfg = parsed(CLASSICAL);
    expect(cfg.slots).toHaveLength(WUXIN_SLOTS);
    expect(cfg.slots[0]).toEqual({ element: 'seed', nourishes: 'fire', hinders: 'stone' });
  });

  it('accepts plain-ASCII arrows so a cycle can be typed without glyph-hunting', () => {
    const cfg = parsed('fire -> stone -| iron');
    expect(cfg.slots[0]).toEqual({ element: 'fire', nourishes: 'stone', hinders: 'iron' });
  });

  it('reads a severed arrow', () => {
    const cfg = parsed('fire → ∅ ⊣ iron');
    expect(cfg.slots[0].nourishes).toBeNull();
    expect(cfg.slots[0].hinders).toBe('iron');
  });

  it('round-trips', () => {
    const cfg = parsed(CLASSICAL);
    expect(parsed(formatWuxin(cfg))).toEqual(cfg);
  });

  it('refuses text it cannot read rather than guessing', () => {
    expect(parseWuxin('fire nourishes stone')).toBeNull();
  });
});

describe('legality', () => {
  it('accepts the classical cycle', () => {
    expect(validateWuxin(parsed(CLASSICAL))).toEqual([]);
  });

  it('rejects an element pointing at itself', () => {
    const cfg = parsed(CLASSICAL);
    cfg.slots[0].nourishes = 'seed';
    expect(validateWuxin(cfg)).toContainEqual({
      kind: 'selfArrow',
      element: 'seed',
      relation: 'nourishes',
    });
  });

  it('rejects two elements nourishing the same one', () => {
    const cfg = parsed(CLASSICAL);
    // water already nourishes seed; make iron do it too.
    cfg.slots[3].nourishes = 'seed';
    const problems = validateWuxin(cfg);
    expect(problems).toContainEqual({
      kind: 'contested',
      relation: 'nourishes',
      target: 'seed',
      by: ['iron', 'water'],
    });
  });

  it('rejects an arrow pointing outside the cycle', () => {
    const cfg = parsed(CLASSICAL);
    cfg.slots[0].hinders = 'gloom';
    expect(validateWuxin(cfg)).toContainEqual({
      kind: 'danglingArrow',
      element: 'seed',
      relation: 'hinders',
      target: 'gloom',
    });
  });

  it('rejects an element the lexicon does not have', () => {
    const cfg = parsed('wood → ∅ ⊣ ∅');
    expect(validateWuxin(cfg)).toContainEqual({ kind: 'unknownElement', element: 'wood' });
  });

  it('keeps zero out of the slots until it is deliberately made the wildcard', () => {
    expect(eligibleElements()).not.toContain('zero');
    expect(eligibleElements()).toContain('seed');
  });

  it('does not treat a severed arrow as a problem', () => {
    const cfg = parsed(CLASSICAL);
    cfg.slots[0].nourishes = null;
    expect(isLegal(cfg)).toBe(true);
  });
});

describe('convergence — the rule-break the canonical validator must keep refusing', () => {
  /**
   * Every arrow onto one element: the lightning master's shape. It is the
   * planned heterodox mode (Wuxia_Xianxia.md, "Convergence"), and it must stay
   * ILLEGAL in the canonical space — every structural result in that file
   * assumes both relations are permutations, and this is exactly the
   * configuration that breaks them.
   *
   * Pinned here so the boundary is documented before the mode exists, and so
   * that whoever adds it has to opt in deliberately rather than by loosening
   * validateWuxin and quietly voiding the guarantees.
   */
  const CONVERGENT = `
    seed  → spark ⊣ spark
    fire  → spark ⊣ spark
    stone → spark ⊣ spark
    water → spark ⊣ spark
    spark → ∅     ⊣ ∅
  `;

  it('is rejected, and says why in both relations', () => {
    const cfg = parsed(CONVERGENT);
    const problems = validateWuxin(cfg);
    expect(isLegal(cfg)).toBe(false);
    for (const relation of ['nourishes', 'hinders'] as const) {
      expect(problems).toContainEqual({
        kind: 'contested',
        relation,
        target: 'spark',
        by: ['seed', 'fire', 'stone', 'water'],
      });
    }
  });

  it('starves every feeder — the cost the shape forces on itself', () => {
    const cfg = parsed(CONVERGENT);
    const fed = new Set(cfg.slots.map((s) => s.nourishes).filter(Boolean));
    // Only the sink is fed by anything; the other four can be charged by
    // exposure alone, which is what forces breadth on the build.
    expect([...fed]).toEqual(['spark']);
  });
});

describe('harmony is a relation, not a table', () => {
  it('recognises the classical cycle without knowing what is in the slots', () => {
    expect(discord(parsed(CLASSICAL))).toBe(0);
    expect(isHarmonious(parsed(CLASSICAL))).toBe(true);
  });

  it('recognises a relabelled cycle just as readily', () => {
    // The same wiring with four elements swapped out entirely.
    const swapped = parsed(`
      gloom → light ⊣ venom
      light → venom ⊣ spark
      venom → spark ⊣ water
      spark → water ⊣ gloom
      water → gloom ⊣ light
    `);
    expect(isHarmonious(swapped)).toBe(true);
  });

  it('counts how far a rewiring sits from harmony', () => {
    const cfg = parsed(CLASSICAL);
    cfg.slots[0].hinders = 'water';
    expect(discord(cfg)).toBe(1);
  });
});

describe('counterflow — harmony run backwards', () => {
  it('recognises destruction as the reverse of generation', () => {
    expect(isCounterflow(parsed(COUNTERFLOW))).toBe(true);
    expect(isCounterflow(parsed(CLASSICAL))).toBe(false);
  });

  it('states the same thing the striking way: you feed your own attacker', () => {
    const cfg = parsed(COUNTERFLOW);
    for (const slot of cfg.slots) {
      const fed = cfg.slots.find((s) => s.element === slot.nourishes)!;
      expect(fed.hinders).toBe(slot.element);
    }
  });

  it('is always maximally discordant, whatever is in the slots', () => {
    expect(discord(parsed(COUNTERFLOW))).toBe(WUXIN_SLOTS);
    // The same wiring in five completely different elements: generation runs
    // gloom → venom → spark → light → ice → gloom, and every hinders arrow is
    // that ring read backwards.
    const swapped = parsed(`
      gloom → venom ⊣ ice
      venom → spark ⊣ gloom
      spark → light ⊣ venom
      light → ice   ⊣ spark
      ice   → gloom ⊣ light
    `);
    expect(isCounterflow(swapped)).toBe(true);
    expect(discord(swapped)).toBe(WUXIN_SLOTS);
  });
});

describe('what a split can and cannot be', () => {
  /**
   * A structural ceiling worth knowing before anything is balanced on it:
   * inside a generative PAIR, two steps land you back where you started, so
   * harmony would require an element to hinder itself — which is illegal. No
   * split configuration can ever be harmonious, and its discord can never drop
   * below one per member of the pair.
   */
  it('can never be harmonious — a pair walked twice is a self-arrow', () => {
    const split = parsed(`
      seed  → fire  ⊣ water
      fire  → seed  ⊣ stone
      stone → iron  ⊣ fire
      iron  → water ⊣ seed
      water → stone ⊣ iron
    `);
    expect(isLegal(split)).toBe(true);
    expect(shapeOf(split, 'nourishes').cycles.map((c) => c.length).sort()).toEqual([2, 3]);
    expect(isHarmonious(split)).toBe(false);
    expect(discord(split)).toBeGreaterThanOrEqual(2);
  });

  it('CAN be a counterflow, though — a pair reversed is just the pair', () => {
    // Generation: seed ↔ fire, and stone → iron → water → stone.
    // Destruction is that read backwards, which inside the pair is the pair.
    const split = parsed(`
      seed  → fire  ⊣ fire
      fire  → seed  ⊣ seed
      stone → iron  ⊣ water
      iron  → water ⊣ stone
      water → stone ⊣ iron
    `);
    expect(isLegal(split)).toBe(true);
    expect(isCounterflow(split)).toBe(true);
    expect(classify(split)).toBe('counterflow');
    // No single exponent covers it: one step round the pair, two round the
    // triangle. Structured, but not by a power.
    expect(alignment(split)).toBeNull();
  });
});

describe('alignment — how far around the ring destruction reaches', () => {
  it('reads the classical relation as the second power', () => {
    expect(alignment(parsed(CLASSICAL))).toBe(2);
  });

  it('reads a counterflow as the last power — generation reversed', () => {
    expect(alignment(parsed(COUNTERFLOW))).toBe(WUXIN_SLOTS - 1);
  });

  it('reads destruction laid straight onto generation as the first power', () => {
    const cfg = parsed(CLASSICAL);
    for (const slot of cfg.slots) slot.hinders = slot.nourishes;
    expect(alignment(cfg)).toBe(1);
    // Legal: nothing says the two arrows may not name the same target.
    expect(isLegal(cfg)).toBe(true);
  });

  it('has no answer when the two rings are unrelated', () => {
    const cfg = parsed(CLASSICAL);
    cfg.slots[0].hinders = 'water';
    cfg.slots[3].hinders = 'stone';
    expect(alignment(cfg)).toBeNull();
  });

  it('has no answer when an arrow is cut', () => {
    const cfg = parsed(CLASSICAL);
    cfg.slots[2].nourishes = null;
    expect(alignment(cfg)).toBeNull();
  });

  /**
   * A limitation worth having written down, because it is easy to assume the
   * opposite: on a CLOSED RING, discord carries no gradient. Harmony is the
   * only power that scores anything but the maximum, so discord answers "is
   * this the classical relation" and nothing else. The exponent is the axis
   * with an actual ordering on it; discord is a flag wearing a number's
   * clothes. It only takes intermediate values when arrows are severed or the
   * configuration is split or unaligned.
   */
  it('is the only real gradient — discord saturates on a closed ring', () => {
    const ring = ['seed', 'fire', 'stone', 'iron', 'water'];
    const power = (k: number): WuxinConfig => ({
      slots: ring.map((element, i) => ({
        element,
        nourishes: ring[(i + 1) % ring.length],
        hinders: ring[(i + k) % ring.length],
      })),
    });
    expect([1, 2, 3, 4].map((k) => ({ k, k2: alignment(power(k)), d: discord(power(k)) }))).toEqual([
      { k: 1, k2: 1, d: WUXIN_SLOTS },
      { k: 2, k2: 2, d: 0 },
      { k: 3, k2: 3, d: WUXIN_SLOTS },
      { k: 4, k2: 4, d: WUXIN_SLOTS },
    ]);
  });
});

describe('shape', () => {
  it('closes the classical cycle into one ring through all five', () => {
    const gen = shapeOf(parsed(CLASSICAL), 'nourishes');
    expect(gen.severed).toBe(0);
    expect(gen.chains).toEqual([]);
    expect(gen.cycles).toHaveLength(1);
    expect(gen.cycles[0]).toHaveLength(WUXIN_SLOTS);
  });

  it('finds the only other closed shape — a pair beside a triangle', () => {
    const split = parsed(`
      seed  → fire  ⊣ ∅
      fire  → seed  ⊣ ∅
      stone → iron  ⊣ ∅
      iron  → water ⊣ ∅
      water → stone ⊣ ∅
    `);
    const gen = shapeOf(split, 'nourishes');
    expect(gen.cycles.map((c) => c.length).sort()).toEqual([2, 3]);
  });

  it('opens a ring into a line when one arrow is cut', () => {
    const cfg = parsed(CLASSICAL);
    cfg.slots[4].nourishes = null;
    const gen = shapeOf(cfg, 'nourishes');
    expect(gen.cycles).toEqual([]);
    expect(gen.chains).toHaveLength(1);
    expect(gen.chains[0]).toEqual(['seed', 'fire', 'stone', 'iron', 'water']);
  });
});

describe('harmony distance — the gradient discord is not', () => {
  it('runs 0, 1, 1, 2 across the powers, with counterflow furthest', () => {
    const ring = ['seed', 'fire', 'stone', 'iron', 'water'];
    const power = (k: number): WuxinConfig => ({
      slots: ring.map((element, i) => ({
        element,
        nourishes: ring[(i + 1) % ring.length],
        hinders: ring[(i + k) % ring.length],
      })),
    });
    expect([1, 2, 3, 4].map((k) => harmonyDistance(power(k)))).toEqual([1, 0, 1, 2]);
    expect(classify(power(4))).toBe('counterflow');
  });

  it('has nothing to say about an unaligned cycle', () => {
    const cfg = parsed(CLASSICAL);
    cfg.slots[0].hinders = 'water';
    cfg.slots[3].hinders = 'stone';
    expect(harmonyDistance(cfg)).toBeNull();
  });
});

describe('landmarks — what the shape alone singles out', () => {
  it('finds the pivot when the two pairs are disjoint, and only then', () => {
    // Generation pairs seed/fire; destruction pairs iron/water. Stone is left.
    const crossed = parsed(`
      seed  → fire  ⊣ stone
      fire  → seed  ⊣ seed
      stone → iron  ⊣ fire
      iron  → water ⊣ water
      water → stone ⊣ iron
    `);
    expect(isLegal(crossed)).toBe(true);
    expect(landmarks(crossed).pivot).toBe('stone');

    // The same shape with OVERLAPPING pairs has no leftover element.
    const overlapping = parsed(`
      seed  → fire  ⊣ water
      fire  → seed  ⊣ stone
      stone → iron  ⊣ fire
      iron  → water ⊣ seed
      water → stone ⊣ iron
    `);
    expect(landmarks(overlapping).pivot).toBeNull();
  });

  it('finds an orphan, which severing is the only way to make', () => {
    const cfg = parsed(`
      seed  → fire  ⊣ fire
      fire  → seed  ⊣ seed
      stone → ∅     ⊣ ∅
      iron  → water ⊣ water
      water → iron  ⊣ iron
    `);
    expect(landmarks(cfg).orphans).toEqual(['stone']);
    // Doubled arrows in both pairs, which inside a pair is also a counterflow.
    expect(landmarks(cfg).doubled.sort()).toEqual(['fire', 'iron', 'seed', 'water']);
  });

  it('finds an element both lines drain into', () => {
    const cfg = parsed(`
      seed  → fire  ⊣ water
      fire  → stone ⊣ seed
      stone → iron  ⊣ fire
      iron  → water ⊣ stone
      water → ∅     ⊣ ∅
    `);
    expect(isLegal(cfg)).toBe(true);
    expect(landmarks(cfg).sinks).toEqual(['water']);
    expect(landmarks(cfg).orphans).toEqual([]);
  });

  it('sees nothing worth naming in the classical cycle', () => {
    const marks = landmarks(parsed(CLASSICAL));
    expect(marks).toEqual({ orphans: [], pivot: null, sinks: [], sources: [], doubled: [] });
  });
});

describe('classification', () => {
  it('names the classical cycle harmonious', () => {
    expect(classify(parsed(CLASSICAL))).toBe('harmonious');
  });

  it('names a cut generative ring a burst', () => {
    const cfg = parsed(CLASSICAL);
    cfg.slots[4].nourishes = null;
    expect(classify(cfg)).toBe('burst');
  });

  it('names a cycle with nothing destructive left in it a sustain', () => {
    const cfg = parsed(CLASSICAL);
    for (const slot of cfg.slots) slot.hinders = null;
    expect(classify(cfg)).toBe('sustain');
  });

  it('names destruction cut but not gone tempered — a gap, not an absence', () => {
    const cfg = parsed(CLASSICAL);
    cfg.slots[2].hinders = null;
    expect(classify(cfg)).toBe('tempered');
    // Still sustain once the last one goes.
    for (const slot of cfg.slots) slot.hinders = null;
    expect(classify(cfg)).toBe('sustain');
  });

  it('calls it a burst rather than tempered when generation is open too', () => {
    const cfg = parsed(CLASSICAL);
    cfg.slots[2].hinders = null;
    cfg.slots[4].nourishes = null;
    expect(classify(cfg)).toBe('burst');
  });

  it('names two closed loops a split', () => {
    const split = parsed(`
      seed  → fire  ⊣ stone
      fire  → seed  ⊣ iron
      stone → iron  ⊣ water
      iron  → water ⊣ seed
      water → stone ⊣ fire
    `);
    expect(classify(split)).toBe('split');
  });

  it('names a reversed cycle counterflow', () => {
    expect(classify(parsed(COUNTERFLOW))).toBe('counterflow');
  });

  it('names a closed but unharmonious ring irregular', () => {
    const cfg = parsed(CLASSICAL);
    cfg.slots[0].hinders = 'water';
    cfg.slots[3].hinders = 'stone';
    expect(classify(cfg)).toBe('irregular');
  });
});
