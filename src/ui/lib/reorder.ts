/**
 * Placement rules for the three panels that reorder by dragging: the Active
 * Skills list (CombatPanel), the plan list (MartialPlanner) and the spell
 * sentence (SpellcraftPanel). Touch browsers do not fire HTML5 drag events, so
 * each panel also lets a tap pick an item up and a second tap place it
 * (docs/PHONE.md). The drag handlers and the tap path call these same
 * functions, so there is one set of placement rules.
 *
 * A slot is a gap in a list of n items: 0 is before the first, n is after the
 * last. Moving an item into the gap it already borders is no move.
 */

/**
 * Whether a pointer is a finger. A finger cannot drag a draggable element, so
 * a control that a mouse click removes or presses outright picks up instead.
 */
export function isTouchPointer(pointerType: string | undefined): boolean {
  return pointerType === 'touch';
}

/**
 * The `beforeId` for `game.moveSkillTo(id, beforeId)` that puts `id` into
 * `slot` of the drawn list, or `undefined` when that is no move (the item is
 * not drawn, the slot is outside the list, or it is the item's own gap).
 * `null` means last, as `moveSkillTo` reads it.
 */
export function slotTarget(
  visible: readonly string[],
  id: string,
  slot: number,
): string | null | undefined {
  const at = visible.indexOf(id);
  if (at === -1 || !Number.isInteger(slot) || slot < 0 || slot > visible.length) return undefined;
  if (slot === at || slot === at + 1) return undefined;
  return slot === visible.length ? null : visible[slot];
}

/**
 * `items` with the one at `from` moved into `slot`, a copy. The list comes back
 * unchanged for a slot outside it or the item's own gap.
 */
export function moveItem<T>(items: readonly T[], from: number, slot: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length) return next;
  if (!Number.isInteger(slot) || slot < 0 || slot > next.length) return next;
  if (slot === from || slot === from + 1) return next;
  const [item] = next.splice(from, 1);
  next.splice(slot > from ? slot - 1 : slot, 0, item);
  return next;
}

/** The slot one place earlier (-1) or later (+1) than the item at `from`, for `moveItem`. */
export function stepSlot(from: number, dir: -1 | 1): number {
  return dir === -1 ? from - 1 : from + 2;
}

/**
 * `items` with `item` inserted into `slot`, a copy. The list comes back
 * unchanged when it already holds `cap` items or the slot is outside it.
 */
export function insertItem<T>(items: readonly T[], slot: number, item: T, cap = Infinity): T[] {
  const next = [...items];
  if (next.length >= cap || !Number.isInteger(slot) || slot < 0 || slot > next.length) return next;
  next.splice(slot, 0, item);
  return next;
}

/**
 * `items` with the one at `target` replaced by `merged` and the one at `source`
 * (a tile from the list itself; null for a word taken from the palette)
 * removed, a copy. The target is written before the source goes, so the
 * indices stay honest.
 */
export function foldItem<T>(items: readonly T[], target: number, merged: T, source: number | null): T[] {
  const next = [...items];
  if (target < 0 || target >= next.length) return next;
  if (source !== null && (source === target || source < 0 || source >= next.length)) return next;
  next[target] = merged;
  if (source !== null) next.splice(source, 1);
  return next;
}
