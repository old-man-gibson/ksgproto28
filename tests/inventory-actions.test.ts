import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { AFFIXES } from '../src/core/registry';
import {
  categoriesPresent,
  itemCategory,
  rarityAtMost,
} from '../src/core/systems/inventory';
import {
  gradedUnitPrice,
  sellStackable,
  discardStackable,
  sellStackablesBatch,
  discardStackablesBatch,
} from '../src/core/systems/equipment';
import {
  sellRune,
  discardRune,
  runeSellPrice,
  sellRunesBatch,
  discardRunesBatch,
} from '../src/core/systems/runes';
import { grantGraded } from '../src/core/systems/disciplines';
import type { Affix, ItemInstance } from '../src/core/types';

const SWIFT = AFFIXES.find((a) => a.name === 'Swift') as Affix;

let uid = 0;
function item(defId: string, opts: Partial<ItemInstance> = {}): ItemInstance {
  return { uid: ++uid, defId, slots: 0, runes: [], ...opts };
}

describe('item categories', () => {
  it('groups weapons by their broad type, incl. katanas as swords', () => {
    expect(itemCategory(item('iron_sword')).key).toBe('sword');
    expect(itemCategory(item('katana')).key).toBe('sword');
    expect(itemCategory(item('steel_greatsword')).key).toBe('greatsword');
    expect(itemCategory(item('iron_dagger')).key).toBe('dagger');
  });

  it('falls back to the slot for armour', () => {
    expect(itemCategory(item('leather_jerkin')).key).toBe('slot:chest');
    expect(itemCategory(item('leather_boots')).key).toBe('slot:feet');
  });

  it('lists distinct categories, weapons before armour', () => {
    const cats = categoriesPresent([
      item('leather_boots'),
      item('iron_sword'),
      item('iron_dagger'),
      item('iron_sword'),
    ]);
    expect(cats.map((c) => c.key)).toEqual(['sword', 'dagger', 'slot:feet']);
  });
});

describe('rarity threshold', () => {
  it('matches items at or below a ceiling', () => {
    expect(rarityAtMost(item('iron_sword'), 'common')).toBe(true); // plain = common
    expect(rarityAtMost(item('iron_sword', { affix: SWIFT }), 'common')).toBe(false); // uncommon
    expect(rarityAtMost(item('iron_sword', { affix: SWIFT }), 'uncommon')).toBe(true);
  });
});

function sold(g: Game): string[] {
  return g.state.log.filter((l) => l.msg.startsWith('Sold')).map((l) => l.msg);
}

describe('selling and dumping graded stackables', () => {
  it('prices a grade above the base and reduces its stock', () => {
    const g = new Game(createInitialState(1));
    g.state.gold = 0;
    grantGraded(g.state, 'hearty_stew', 'b', 3); // Fine, ×1.6
    const unit = gradedUnitPrice(g.state, 'hearty_stew', 'b');
    const base = gradedUnitPrice(g.state, 'hearty_stew', 'c'); // Fair, ×1.0
    expect(unit).toBeGreaterThan(base);

    sellStackable(g.state, g.bus, 'hearty_stew', 'b', 2);
    expect(g.state.gold).toBe(unit * 2);
    expect(g.state.stock['hearty_stew']?.['b']).toBe(1);
    expect(sold(g)[0]).toMatch(/Sold .*Fine Hearty Stew ×2 for \d+ gold\./);
  });

  it('dumps a grade for nothing', () => {
    const g = new Game(createInitialState(1));
    grantGraded(g.state, 'hearty_stew', 'c', 2);
    discardStackable(g.state, g.bus, 'hearty_stew', 'c', 5); // asking for more than held
    expect(g.state.gold).toBe(0);
    expect(g.state.stock['hearty_stew']).toBeUndefined();
  });

  it('handles plain (ungraded) materials too', () => {
    const g = new Game(createInitialState(1));
    g.state.gold = 0;
    g.state.materials['hardwood'] = 4;
    sellStackable(g.state, g.bus, 'hardwood', 'c', 3);
    expect(g.state.materials['hardwood']).toBe(1);
    expect(g.state.gold).toBeGreaterThan(0);
  });
});

describe('pouch housekeeping (batch)', () => {
  function stocked(): Game {
    const g = new Game(createInitialState(1));
    g.state.gold = 0;
    g.state.log.length = 0;
    grantGraded(g.state, 'common_herb', 'e', 5); // Poor
    grantGraded(g.state, 'common_herb', 'c', 3); // Fair
    grantGraded(g.state, 'raw_meat', 'd', 4); // Common
    grantGraded(g.state, 'warm_slime_gel', 'a', 2); // Superb
    return g;
  }

  it('sells every listed stack whole, in one summed log line', () => {
    const g = stocked();
    const refs = [
      { id: 'common_herb', quality: 'e' as const },
      { id: 'raw_meat', quality: 'd' as const },
    ];
    const each =
      gradedUnitPrice(g.state, 'common_herb', 'e') * 5 + gradedUnitPrice(g.state, 'raw_meat', 'd') * 4;

    sellStackablesBatch(g.state, g.bus, refs, 'ingredient');

    expect(g.state.gold).toBe(each);
    expect(g.state.stock['common_herb']?.['e']).toBeUndefined();
    expect(g.state.stock['raw_meat']).toBeUndefined();
    expect(g.state.stock['common_herb']?.['c']).toBe(3); // untouched grade stays
    const lines = g.state.log.filter((l) => l.msg.startsWith('Sold'));
    expect(lines).toHaveLength(1);
    expect(lines[0].msg).toBe(`Sold 9 ingredients for ${each} gold.`);
  });

  it('dumps listed stacks for nothing, in one line', () => {
    const g = stocked();
    discardStackablesBatch(
      g.state,
      g.bus,
      [
        { id: 'common_herb', quality: 'e' },
        { id: 'common_herb', quality: 'c' },
      ],
      'ingredient',
    );
    expect(g.state.gold).toBe(0);
    expect(g.state.stock['common_herb']).toBeUndefined();
    const lines = g.state.log.filter((l) => l.msg.startsWith('Discarded'));
    expect(lines).toEqual([{ msg: 'Discarded 8 ingredients.', kind: 'info', t: g.state.totalTicks }]);
  });

  it('does nothing (and logs nothing) for an empty batch', () => {
    const g = stocked();
    expect(sellStackablesBatch(g.state, g.bus, [])).toBe(0);
    expect(discardStackablesBatch(g.state, g.bus, [])).toBe(0);
    expect(g.state.log.filter((l) => /Sold|Discarded/.test(l.msg))).toHaveLength(0);
  });
});

describe('selling and dumping runes', () => {
  it('sells a catalogue rune for its worth and decrements the pile', () => {
    const g = new Game(createInitialState(1));
    g.state.gold = 0;
    g.state.runes['minor_rune_might'] = 2;
    const price = runeSellPrice(g.state, 'minor_rune_might');
    sellRune(g.state, g.bus, 'minor_rune_might');
    expect(g.state.gold).toBe(price);
    expect(g.state.runes['minor_rune_might']).toBe(1);
  });

  it('discards a carved rune, removing it from the carved pile', () => {
    const g = new Game(createInitialState(1));
    g.state.carved = [
      { patterns: ['pattern_might'], stone: { id: 'slime_gel', quality: 'c' }, adornments: [] },
    ];
    expect(discardRune(g.state, g.bus, 'carved:0')).toBe(true);
    expect(g.state.carved).toHaveLength(0);
  });

  it('refuses a ref that is not held', () => {
    const g = new Game(createInitialState(1));
    expect(sellRune(g.state, g.bus, 'minor_rune_might')).toBe(0);
    expect(discardRune(g.state, g.bus, 'carved:5')).toBe(false);
  });

  it('sells a batch: catalogue piles whole, carvings one each, one log line', () => {
    const g = new Game(createInitialState(1));
    g.state.gold = 0;
    g.state.log.length = 0;
    g.state.runes['minor_rune_might'] = 3;
    g.state.carved = [
      { patterns: ['pattern_might'], stone: { id: 'slime_gel', quality: 'c' }, adornments: [] },
      { patterns: ['pattern_warding'], stone: { id: 'slime_gel', quality: 'b' }, adornments: [] },
    ];
    const before = g.state.gold;

    sellRunesBatch(g.state, g.bus, ['minor_rune_might', 'carved:0']);

    expect(g.state.runes['minor_rune_might']).toBeUndefined(); // whole pile of 3
    expect(g.state.carved).toHaveLength(1); // carved:0 gone, carved:1 remains
    expect(g.state.gold).toBeGreaterThan(before);
    const lines = g.state.log.filter((l) => l.msg.startsWith('Sold'));
    expect(lines).toHaveLength(1);
    expect(lines[0].msg).toBe(`Sold 4 runes for ${g.state.gold} gold.`);
  });

  it('dumps carved runes by descending index without shifting mishaps', () => {
    const g = new Game(createInitialState(1));
    g.state.carved = [
      { patterns: ['a'], stone: { id: 'slime_gel', quality: 'c' }, adornments: [] },
      { patterns: ['b'], stone: { id: 'slime_gel', quality: 'c' }, adornments: [] },
      { patterns: ['c'], stone: { id: 'slime_gel', quality: 'c' }, adornments: [] },
    ];
    discardRunesBatch(g.state, g.bus, ['carved:0', 'carved:2']);
    // The survivor is the middle one, intact — not corrupted by index shifting.
    expect(g.state.carved).toHaveLength(1);
    expect(g.state.carved[0].patterns).toEqual(['b']);
  });

  it('does nothing for an empty rune batch', () => {
    const g = new Game(createInitialState(1));
    expect(sellRunesBatch(g.state, g.bus, [])).toBe(0);
    expect(discardRunesBatch(g.state, g.bus, ['minor_rune_might'])).toBe(0);
  });
});
