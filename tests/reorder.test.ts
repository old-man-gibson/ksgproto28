import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { foldItem, insertItem, isTouchPointer, moveItem, slotTarget, stepSlot } from '../src/ui/lib/reorder';
import { stepTarget, visibleIds } from '../src/ui/lib/rotationView';
import { activeRotation } from '../src/core/systems/combat';
import { readText } from './themeCss';

// The placement rules the drag handlers and the tap-to-pick path share
// (ui/lib/reorder.ts): CombatPanel's Active Skills, MartialPlanner's plan and
// SpellcraftPanel's sentence. A tap path that placed differently from a drag
// would be a second rule set.

const ABCD = ['a', 'b', 'c', 'd'];

describe('slotTarget: the beforeId for placing a card into a slot', () => {
  it('a slot is a gap: before a card, or after the last (null)', () => {
    expect(slotTarget(ABCD, 'a', 2)).toBe('c');
    expect(slotTarget(ABCD, 'a', 4)).toBeNull();
    expect(slotTarget(ABCD, 'd', 0)).toBe('a');
    expect(slotTarget(ABCD, 'c', 1)).toBe('b');
  });

  it("a card's own two gaps are no move", () => {
    expect(slotTarget(ABCD, 'b', 1)).toBeUndefined();
    expect(slotTarget(ABCD, 'b', 2)).toBeUndefined();
    expect(slotTarget(ABCD, 'a', 0)).toBeUndefined();
    expect(slotTarget(ABCD, 'd', 4)).toBeUndefined();
  });

  it('an id that is not drawn, and a slot outside the list, are no move', () => {
    expect(slotTarget(ABCD, 'z', 1)).toBeUndefined();
    expect(slotTarget(ABCD, 'a', -1)).toBeUndefined();
    expect(slotTarget(ABCD, 'a', 5)).toBeUndefined();
    expect(slotTarget(ABCD, 'a', 1.5)).toBeUndefined();
    expect(slotTarget([], 'a', 0)).toBeUndefined();
  });

  it('a step is the slot one place on: stepTarget and slotTarget agree for every card', () => {
    for (const id of ABCD) {
      const at = ABCD.indexOf(id);
      expect(stepTarget(ABCD, id, -1)).toBe(slotTarget(ABCD, id, stepSlot(at, -1)));
      expect(stepTarget(ABCD, id, 1)).toBe(slotTarget(ABCD, id, stepSlot(at, 1)));
    }
  });
});

describe('placing a picked card writes what a drop writes', () => {
  const T = ['technique:gather', 'technique:lunge', 'technique:heavy_blow', 'technique:sidestep', 'technique:riposte'];

  /** A fighter who knows five techniques, in the order T. */
  function fighter(order: string[]): Game {
    const g = new Game(createInitialState(1));
    g.state.techniques = Object.fromEntries(
      T.map((id) => [id.slice('technique:'.length), { executions: 0, form: 'canonical' as const }]),
    );
    g.state.skillOrder = [...order];
    return g;
  }

  it('every slot of the drawn list, through moveSkillTo, lands the card in that gap', () => {
    for (const id of T) {
      for (let slot = 0; slot <= T.length; slot++) {
        const g = fighter(T);
        const before = slotTarget(T, id, slot);
        if (before !== undefined) g.moveSkillTo(id, before);
        expect(activeRotation(g.state)).toEqual(moveItem(T, T.indexOf(id), slot));
      }
    }
  });

  it('entries the panel does not draw travel along', () => {
    const g = fighter(T);
    g.setSkillEnabled('technique:lunge', false); // benched: in the order, not drawn
    const drawn = visibleIds(activeRotation(g.state), g.state.skillTriggers);
    expect(drawn).toEqual(['technique:gather', 'technique:heavy_blow', 'technique:sidestep', 'technique:riposte']);
    // Put riposte before gather.
    g.moveSkillTo('technique:riposte', slotTarget(drawn, 'technique:riposte', 0) ?? null);
    expect(activeRotation(g.state)).toEqual([
      'technique:riposte',
      'technique:gather',
      'technique:lunge',
      'technique:heavy_blow',
      'technique:sidestep',
    ]);
  });
});

describe('moveItem: a tile into a slot of the sentence', () => {
  const words = ['fire', 'pierce', 'slowly', 'self'];

  it('moves earlier and later, as a drop on a tile does', () => {
    expect(moveItem(words, 3, 0)).toEqual(['self', 'fire', 'pierce', 'slowly']);
    expect(moveItem(words, 0, 3)).toEqual(['pierce', 'slowly', 'fire', 'self']);
    expect(moveItem(words, 0, 4)).toEqual(['pierce', 'slowly', 'self', 'fire']);
    expect(moveItem(words, 2, 1)).toEqual(['fire', 'slowly', 'pierce', 'self']);
  });

  it("returns a copy, unchanged, for the tile's own gaps and for bad input", () => {
    for (const slot of [1, 2, -1, 5, 0.5]) {
      const out = moveItem(words, 1, slot);
      expect(out).toEqual(words);
      expect(out).not.toBe(words);
    }
    expect(moveItem(words, -1, 0)).toEqual(words);
    expect(moveItem(words, 4, 0)).toEqual(words);
  });

  it('a one-place step with stepSlot swaps neighbours, and is a no-op at either end', () => {
    expect(moveItem(words, 1, stepSlot(1, -1))).toEqual(['pierce', 'fire', 'slowly', 'self']);
    expect(moveItem(words, 1, stepSlot(1, 1))).toEqual(['fire', 'slowly', 'pierce', 'self']);
    expect(moveItem(words, 0, stepSlot(0, -1))).toEqual(words);
    expect(moveItem(words, 3, stepSlot(3, 1))).toEqual(words);
  });

  it('keeps every tile: no move loses or duplicates one', () => {
    for (let from = 0; from < words.length; from++) {
      for (let slot = 0; slot <= words.length; slot++) {
        expect([...moveItem(words, from, slot)].sort()).toEqual([...words].sort());
      }
    }
  });
});

describe('insertItem: a palette word into the sentence', () => {
  it('inserts into a slot, and appends at the end', () => {
    expect(insertItem(['a', 'b'], 1, 'x')).toEqual(['a', 'x', 'b']);
    expect(insertItem(['a', 'b'], 2, 'x')).toEqual(['a', 'b', 'x']);
    expect(insertItem(['a', 'b'], 0, 'x')).toEqual(['x', 'a', 'b']);
  });

  it('stops at the cap and outside the list', () => {
    expect(insertItem(['a', 'b'], 1, 'x', 2)).toEqual(['a', 'b']);
    expect(insertItem(['a', 'b'], 3, 'x')).toEqual(['a', 'b']);
    expect(insertItem(['a', 'b'], -1, 'x')).toEqual(['a', 'b']);
  });
});

describe('foldItem: two tiles of one word become one', () => {
  it('writes the merged word over the target and takes the source tile out', () => {
    expect(foldItem(['fire', 'pierce', 'fire'], 0, 'fire:2', 2)).toEqual(['fire:2', 'pierce']);
    expect(foldItem(['fire', 'pierce', 'fire'], 2, 'fire:2', 0)).toEqual(['pierce', 'fire:2']);
  });

  it('a word from the palette has no source tile to remove', () => {
    expect(foldItem(['fire', 'pierce'], 0, 'fire:2', null)).toEqual(['fire:2', 'pierce']);
  });

  it('folding a tile into itself, or into a tile that is not there, changes nothing', () => {
    expect(foldItem(['fire'], 0, 'fire:2', 0)).toEqual(['fire']);
    expect(foldItem(['fire'], 3, 'fire:2', null)).toEqual(['fire']);
    expect(foldItem(['fire', 'fire'], 0, 'fire:2', 5)).toEqual(['fire', 'fire']);
  });
});

describe('isTouchPointer', () => {
  it('is a finger, not a mouse, a pen or a key press', () => {
    expect(isTouchPointer('touch')).toBe(true);
    expect(isTouchPointer('mouse')).toBe(false);
    expect(isTouchPointer('pen')).toBe(false);
    expect(isTouchPointer('')).toBe(false);
    expect(isTouchPointer(undefined)).toBe(false);
  });
});

// The panels are Svelte files, which these tests do not mount. What they can pin
// is that the tap path and the drag path share one set of rules, and that every
// pick is on the overlay stack, which Escape and the Android back button read
// (lib/overlays.ts; the order is tests/pickOverlays.dom.test.ts).
describe('the panels wire the tap path to the shared rules', () => {
  const combat = readText('src/ui/panels/CombatPanel.svelte');
  const planner = readText('src/ui/panels/MartialPlanner.svelte');
  const spell = readText('src/ui/panels/SpellcraftPanel.svelte');

  it('the rotation and the plan place a dragged or a picked row through slotTarget', () => {
    for (const [name, src] of [['CombatPanel', combat], ['MartialPlanner', planner]] as const) {
      expect(src, name).toContain("from '../lib/reorder'");
      expect(src, name).toMatch(/const moving = dragging \?\? picked;/);
      expect(src, name).toContain('slotTarget(');
    }
  });

  it('a mouse has the gutter arrows on a card of any width; only a finger waits for the pick bar', () => {
    const fine = combat.match(/@media \(pointer: fine\) \{([\s\S]*?)\r?\n  \}\r?\n/);
    expect(fine, 'a (pointer: fine) block').not.toBeNull();
    expect(fine![1]).toMatch(/\.gutter \.step \{\s*display: inline-block;/);
    expect(fine![1]).toMatch(/\.pick-bar \.step \{\s*display: none;/);
    // The base rule still hides them, for a finger on a narrow card.
    expect(combat).toMatch(/\.gutter \.step \{\s*display: none;/);
  });

  it('the sentence moves, inserts and merges tiles through the shared functions, not its own splices', () => {
    expect(spell).toContain("from '../lib/reorder'");
    for (const fn of ['moveItem(', 'insertItem(', 'foldItem(']) expect(spell).toContain(fn);
    expect(spell).not.toMatch(/\.splice\(/);
  });

  it('a pick or an open roster is on the overlay stack, so Escape and the Android back button put it down, and no panel reads Escape itself', () => {
    for (const [name, src] of [['CombatPanel', combat], ['MartialPlanner', planner], ['SpellcraftPanel', spell]] as const) {
      expect(src, name).toContain('hostLayer(LAYER.page)');
      expect(src, name).toContain('pushOverlay(');
      expect(src, name).not.toMatch(/addEventListener\('keydown'/);
    }
    expect(combat).toContain('() => (picked = null)');
    expect(planner).toContain('() => (picked = null)');
    expect(planner).toContain('() => (openFamily = null)');
    expect(spell).toContain('() => (pickIndex = null)');
  });
});
