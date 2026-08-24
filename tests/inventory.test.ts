import { describe, expect, it } from 'vitest';
import type { Affix, ItemInstance } from '../src/core/types';
import { AFFIXES, ITEMS } from '../src/core/registry';
import { itemValue, RUNE_SLOT_VALUE_MULT } from '../src/core/systems/equipment';
import {
  arrangeInventory,
  groupItems,
  isMaxRarity,
  itemRarity,
  sortStacks,
  stackKey,
} from '../src/core/systems/inventory';
import { maxRuneSlots } from '../src/core/systems/runes';

const SWIFT = AFFIXES.find((a) => a.name === 'Swift') as Affix;
const SHARP = AFFIXES.find((a) => a.name === 'Sharp') as Affix;

let uid = 0;
function item(defId: string, opts: Partial<ItemInstance> = {}): ItemInstance {
  return { uid: ++uid, defId, slots: 0, runes: [], ...opts };
}

/** Any two real item defs with different values, for value-sort checks. */
const CHEAP = 'rusty_sword';
const DEAR = 'iron_sword';

describe('item rarity', () => {
  it('scales with affix and rune slots', () => {
    expect(itemRarity(item(CHEAP))).toBe('common');
    expect(itemRarity(item(CHEAP, { slots: 1 }))).toBe('uncommon');
    expect(itemRarity(item(CHEAP, { affix: SWIFT }))).toBe('uncommon');
    expect(itemRarity(item(CHEAP, { affix: SWIFT, slots: 1 }))).toBe('rare');
    expect(itemRarity(item(CHEAP, { affix: SWIFT, slots: 3 }))).toBe('epic');
    expect(itemRarity(item(CHEAP, { slots: 4 }))).toBe('rare');
  });
});

describe('item value', () => {
  it('grows with each rolled rune slot', () => {
    const base = ITEMS[CHEAP].value;
    expect(itemValue(item(CHEAP))).toBe(base);
    expect(itemValue(item(CHEAP, { slots: 2 }))).toBeCloseTo(base * (1 + 2 * RUNE_SLOT_VALUE_MULT));
    expect(itemValue(item(CHEAP, { slots: 4 }))).toBeGreaterThan(
      itemValue(item(CHEAP, { slots: 3 })),
    );
  });

  it('stacks the affix and rune-slot premiums', () => {
    const plain = itemValue(item(CHEAP));
    expect(itemValue(item(CHEAP, { affix: SWIFT, slots: 2 }))).toBeGreaterThan(
      itemValue(item(CHEAP, { affix: SWIFT })),
    );
    expect(itemValue(item(CHEAP, { affix: SWIFT }))).toBeGreaterThan(plain);
  });

  it('ignores socketed runes — selling pries them out and keeps them', () => {
    expect(itemValue(item(CHEAP, { slots: 2, runes: ['minor_rune_might', 'x'] }))).toBe(
      itemValue(item(CHEAP, { slots: 2 })),
    );
  });

  it('sorts by value using the same premiums', () => {
    const bare = item(CHEAP);
    const socketed = item(CHEAP, { slots: 4 });
    expect(arrangeInventory([bare, socketed], 'value')[0].item.uid).toBe(socketed.uid);
  });
});

describe('max rarity', () => {
  // Rune-slot ceilings differ by size class: daggers/rings are small (3),
  // greatswords/chest are large (4).
  it('needs both an affix and every slot the item class can roll', () => {
    expect(isMaxRarity(item('iron_dagger', { affix: SWIFT, slots: 3 }))).toBe(true);
    expect(isMaxRarity(item('iron_dagger', { affix: SWIFT, slots: 2 }))).toBe(false);
    expect(isMaxRarity(item('iron_dagger', { slots: 3 }))).toBe(false);
  });

  it('measures the ceiling per class, not against the global cap', () => {
    // A small item at 3 slots is maxed; a large one at 3 still has room.
    expect(maxRuneSlots(ITEMS['iron_dagger'])).toBeLessThan(maxRuneSlots(ITEMS['steel_greatsword']));
    expect(isMaxRarity(item('steel_greatsword', { affix: SHARP, slots: 3 }))).toBe(false);
    expect(isMaxRarity(item('steel_greatsword', { affix: SHARP, slots: 4 }))).toBe(true);
  });
});

describe('stacking', () => {
  it('bundles identical items and splits on slots, affix, or socketed runes', () => {
    const items = [
      item(CHEAP, { slots: 2 }),
      item(CHEAP, { slots: 2 }),
      item(CHEAP, { slots: 3 }),
      item(CHEAP, { affix: SWIFT, slots: 2 }),
      item(CHEAP, { affix: SHARP, slots: 2 }),
      item(CHEAP, { slots: 2, runes: ['x'] }),
    ];
    const stacks = groupItems(items);
    expect(stacks.map((s) => s.items.length)).toEqual([2, 1, 1, 1, 1]);
  });

  it('ignores socket order when keying a stack', () => {
    expect(stackKey(item(CHEAP, { slots: 2, runes: ['a', 'b'] }))).toBe(
      stackKey(item(CHEAP, { slots: 2, runes: ['b', 'a'] })),
    );
  });

  it('leaves every item on its own when grouping is off', () => {
    const items = [item(CHEAP), item(CHEAP), item(CHEAP)];
    expect(groupItems(items, false)).toHaveLength(3);
  });

  it('gives each stack a distinct key so keyed each blocks stay stable', () => {
    const stacks = groupItems([item(CHEAP), item(CHEAP, { slots: 1 })]);
    expect(new Set(stacks.map((s) => s.key)).size).toBe(2);
  });
});

describe('sorting', () => {
  it('orders by value, rune slots, rarity, and bonus', () => {
    const plain = item(CHEAP);
    const pricey = item(DEAR);
    const socketed = item(CHEAP, { slots: 3 });
    const swift = item(CHEAP, { affix: SWIFT });

    expect(ITEMS[DEAR].value).toBeGreaterThan(ITEMS[CHEAP].value);

    const stacks = groupItems([plain, pricey, socketed, swift]);
    const first = (mode: Parameters<typeof sortStacks>[1]) =>
      sortStacks(stacks, mode)[0].item.uid;

    expect(first('value')).toBe(pricey.uid);
    expect(first('runes')).toBe(socketed.uid);
    expect(first('rarity')).toBe(socketed.uid);
    expect(first('affix')).toBe(swift.uid);
  });

  it('sinks unaffixed gear below affixed gear', () => {
    const stacks = sortStacks(groupItems([item(CHEAP), item(CHEAP, { affix: SHARP })]), 'affix');
    expect(stacks[0].item.affix?.name).toBe('Sharp');
    expect(stacks[1].item.affix).toBeUndefined();
  });

  it('arranges in one call and keeps the stack count', () => {
    const stacks = arrangeInventory([item(DEAR), item(CHEAP), item(CHEAP)], 'value');
    expect(stacks).toHaveLength(2);
    expect(stacks[0].item.defId).toBe(DEAR);
    expect(stacks[1].items).toHaveLength(2);
  });
});
