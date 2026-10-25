import type { ItemInstance, RarityId, SlotId } from '../types';
import { SLOT_NAMES } from '../types';
import { ITEMS } from '../registry';
import { itemName, itemValue } from './equipment';
import { maxRuneSlots, runeRefKey } from './runes';

// ---------- Categories (for group selection) ----------

/** Best-to-worst rank, so "X or lower" is a single comparison. */
export const RARITY_RANK: Record<RarityId, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
};

export function rarityAtMost(item: ItemInstance, max: RarityId): boolean {
  return RARITY_RANK[itemRarity(item)] <= RARITY_RANK[max];
}

export interface ItemCategory {
  key: string;
  label: string;
}

/**
 * A weapon's type is the broad tag it carries, so katanas and rapiers both
 * answer to "Swords". Armour has no such tag and is grouped by the slot it
 * fills instead. Order here is the order the selection chips appear in.
 */
const CATEGORY_TAGS: ItemCategory[] = [
  { key: 'sword', label: 'Swords' },
  { key: 'greatsword', label: 'Greatswords' },
  { key: 'dagger', label: 'Daggers' },
  { key: 'spear', label: 'Spears' },
  { key: 'blunt', label: 'Blunt' },
  { key: 'bow', label: 'Bows' },
  { key: 'staff', label: 'Staves' },
  { key: 'shield', label: 'Shields' },
];

export function itemCategory(item: ItemInstance): ItemCategory {
  const def = ITEMS[item.defId];
  if (def) {
    for (const cat of CATEGORY_TAGS) if (def.tags.includes(cat.key)) return cat;
    return { key: `slot:${def.slot}`, label: SLOT_NAMES[def.slot] };
  }
  return { key: 'other', label: 'Other' };
}

/** The distinct categories present in a bag, in chip order. */
export function categoriesPresent(items: ItemInstance[]): ItemCategory[] {
  const seen = new Map<string, ItemCategory>();
  for (const item of items) {
    const cat = itemCategory(item);
    if (!seen.has(cat.key)) seen.set(cat.key, cat);
  }
  // Weapon categories first (declaration order), then armour slots (slot order).
  const order = (c: ItemCategory) => {
    const w = CATEGORY_TAGS.findIndex((t) => t.key === c.key);
    if (w >= 0) return w;
    const slot = c.key.slice(5) as SlotId;
    const s = SLOT_ORDER.indexOf(slot);
    return CATEGORY_TAGS.length + (s < 0 ? SLOT_ORDER.length : s);
  };
  return [...seen.values()].sort((a, b) => order(a) - order(b));
}

/**
 * Inventory presentation logic — grouping duplicates and ordering.
 * Pure and state-free so the UI can lean on it and tests can pin it down.
 */

// ---------- Derived item rarity ----------

/**
 * Items carry no declared rarity; it falls out of what the instance rolled.
 * An affix is worth two rune slots, so a plain 2-slot vest and a Swift dagger
 * with no slots both read as uncommon.
 */
export function rarityScore(item: ItemInstance): number {
  return (item.affix ? 2 : 0) + (item.slots ?? 0);
}

export function itemRarity(item: ItemInstance): RarityId {
  const score = rarityScore(item);
  if (score >= 5) return 'epic';
  if (score >= 3) return 'rare';
  if (score >= 1) return 'uncommon';
  return 'common';
}

/**
 * Gear that cannot roll any better: an affix plus every rune slot its size
 * class allows. Measured per class, so a 3-slot Swift dagger counts even
 * though a breastplate can carry four.
 */
export function isMaxRarity(item: ItemInstance): boolean {
  const def = ITEMS[item.defId];
  if (!def || !item.affix) return false;
  return (item.slots ?? 0) >= maxRuneSlots(def);
}

// ---------- Grouping ----------

/**
 * Identity for stacking. Two items bundle only when they are the same base
 * item with the same affix, the same rune-slot count, and the same runes
 * socketed — so "Vest (2 slots)" is one stack and "Swift Dagger (1 rune)" and
 * "Swift Dagger (3 runes)" are two.
 *
 * Each rune goes through runeRefKey first: a carving is an object, and joined
 * raw every carving reads "[object Object]". Refs are sorted and joined with
 * ';' because a carving's own key contains commas.
 */
export function stackKey(item: ItemInstance): string {
  const runes = (item.runes ?? []).map(runeRefKey).sort().join(';');
  return `${item.defId}|${item.affix?.name ?? ''}|${item.slots ?? 0}|${runes}`;
}

export interface ItemStack {
  key: string;
  /** The instance shown and acted on — the first of the stack. */
  item: ItemInstance;
  items: ItemInstance[];
}

/** Bundle identical items. With `group` off every item gets its own stack. */
export function groupItems(items: ItemInstance[], group = true): ItemStack[] {
  const stacks: ItemStack[] = [];
  const byKey = new Map<string, ItemStack>();
  for (const item of items) {
    const key = stackKey(item);
    const existing = group ? byKey.get(key) : undefined;
    if (existing) {
      existing.items.push(item);
      continue;
    }
    const stack: ItemStack = { key: `${key}#${item.uid}`, item, items: [item] };
    if (group) byKey.set(key, stack);
    stacks.push(stack);
  }
  return stacks;
}

// ---------- Sorting ----------

export type SortMode = 'newest' | 'value' | 'runes' | 'rarity' | 'affix' | 'name';

export const SORT_LABELS: Record<SortMode, string> = {
  newest: 'Newest',
  value: 'Value',
  runes: 'Rune Slots',
  rarity: 'Rarity',
  affix: 'Bonus',
  name: 'Name',
};

const SLOT_ORDER = Object.keys(SLOT_NAMES) as SlotId[];

function slotRank(item: ItemInstance): number {
  const def = ITEMS[item.defId];
  const idx = def ? SLOT_ORDER.indexOf(def.slot) : -1;
  return idx < 0 ? SLOT_ORDER.length : idx;
}

function compare(a: ItemInstance, b: ItemInstance, mode: SortMode): number {
  switch (mode) {
    case 'value':
      // Charisma scales every price by the same factor, so the pre-charisma
      // worth orders identically and sorting can stay state-free.
      return itemValue(b) - itemValue(a);
    case 'runes':
      // Most slots first; among equals the more heavily socketed one wins.
      return (
        (b.slots ?? 0) - (a.slots ?? 0) || (b.runes?.length ?? 0) - (a.runes?.length ?? 0)
      );
    case 'rarity':
      return rarityScore(b) - rarityScore(a);
    case 'affix':
      // Affixed gear first, alphabetical by bonus; plain gear sinks to the end.
      if (!!a.affix !== !!b.affix) return a.affix ? -1 : 1;
      return (a.affix?.name ?? '').localeCompare(b.affix?.name ?? '');
    case 'name':
      return slotRank(a) - slotRank(b) || itemName(a).localeCompare(itemName(b));
    case 'newest':
      return b.uid - a.uid;
  }
}

/** Order stacks by the given mode, falling back to name then uid for stability. */
export function sortStacks(stacks: ItemStack[], mode: SortMode): ItemStack[] {
  return [...stacks].sort((x, y) => {
    const a = x.item;
    const b = y.item;
    return (
      compare(a, b, mode) ||
      (mode === 'name' ? 0 : compare(a, b, 'name')) ||
      a.uid - b.uid
    );
  });
}

/** One-call pipeline used by the inventory grid. */
export function arrangeInventory(
  items: ItemInstance[],
  mode: SortMode,
  group = true,
): ItemStack[] {
  return sortStacks(groupItems(items, group), mode);
}
