import type { GameState, ItemInstance, QualityTier, SlotId } from '../types';
import type { EventBus } from '../engine/events';
import { MATERIALS } from '../registry';
import { itemDefOf } from './assembly';
import { getDerivedStats } from './derived';
import { conditionsMet } from './conditions';
import { HAND_SLOTS, armCost, armsFrom, armsUsed, wieldNote, wieldScale } from './wield';
import { bearerGrants } from './mutagens';
import { bumpStat } from './achievements';
import { stockOf, takeGraded } from './disciplines';
import { QUALITY_TIERS, qualityMult } from '../data/quality.data';
import { text } from '../text/log';

// The wield rules live in their own module (no system dependencies, so the
// modifier pipeline can read them too); re-exported here for equipment callers.
export {
  BASE_ARMS,
  HAND_SLOTS,
  MAIN_HAND_PENALTY,
  OFF_HAND_PENALTY,
  WIELD_NAMES,
  allowedSlots,
  armCost,
  armsFrom,
  armsUsed,
  canOneHand,
  floatingSlots,
  handSwingShare,
  handTakenBy,
  handsFrom,
  heldGrips,
  isTelekinetic,
  telekineticFrom,
  twoHandedWeapon,
  wieldNote,
  wieldOf,
  wieldScale,
} from './wield';

/** An affix is worth half again the base item. */
export const AFFIX_VALUE_MULT = 1.5;
/** Each rolled rune slot adds this share of the base item's worth. */
export const RUNE_SLOT_VALUE_MULT = 0.3;

/**
 * What an item is worth before the seller's charisma is applied. Socketed
 * runes add nothing — selling pries them out and keeps them — but the slots
 * themselves are what makes a piece worth hoarding, so they carry the price.
 *
 * A forged item is worth its parts and nothing else: no affix multiplier, no
 * rune-slot multiplier, and no finish will ever add one. Sockets that raised
 * the price would turn the anvil into a mint (72 gold of inputs sold as 156).
 */
export function itemValue(item: ItemInstance): number {
  const def = itemDefOf(item);
  if (item.forged) return def?.value ?? 1;
  const affix = item.affix ? AFFIX_VALUE_MULT : 1;
  return (def?.value ?? 1) * affix * (1 + RUNE_SLOT_VALUE_MULT * (item.slots ?? 0));
}

/**
 * Charisma-aware sell price. Callers rendering many rows pass the `goldGain`
 * they already hold so each row depends on one number, not the stat block;
 * one-off callers let it default.
 */
export function sellPrice(
  state: GameState,
  item: ItemInstance,
  goldGain = getDerivedStats(state).goldGain,
): number {
  return Math.max(1, Math.round(itemValue(item) * goldGain));
}

export function itemName(item: ItemInstance): string {
  const def = itemDefOf(item);
  const base = def ? def.name : item.defId;
  return item.affix ? `${item.affix.name} ${base}` : base;
}

export function canEquip(state: GameState, item: ItemInstance): boolean {
  const def = itemDefOf(item);
  return !!def && (!def.requirements || conditionsMet(state, def.requirements));
}

/**
 * Equip an item, optionally into a chosen hand. A two-handed weapon clears the
 * off hand, and anything going off-hand displaces a two-handed weapon —
 * whatever is turned out goes back to the pack.
 */
export function equipItem(state: GameState, bus: EventBus, uid: number, slot?: SlotId): boolean {
  const idx = state.inventory.findIndex((i) => i.uid === uid);
  if (idx < 0) return false;
  const item = state.inventory[idx];
  const def = itemDefOf(item);
  if (!def) return false;
  if (!canEquip(state, item)) {
    bus.emit({
      type: 'log',
      msg: text('equipment.requirements_unmet', { icon: def.icon, item: itemName(item) }),
      kind: 'danger',
    });
    return false;
  }
  const target = slot ?? def.slot;
  if (wieldScale(def, target) <= 0) {
    bus.emit({
      type: 'log',
      msg: text('equipment.wrong_slot', { icon: def.icon, item: itemName(item) }),
      kind: 'danger',
    });
    return false;
  }

  state.inventory.splice(idx, 1);
  const displaced: ItemInstance[] = [];
  const takeOff = (s: SlotId) => {
    const worn = state.equipment[s];
    if (worn) {
      displaced.push(worn);
      delete state.equipment[s];
    }
  };
  takeOff(target);
  // Hands are a budget, not a pair of special cases. Whatever is already held
  // gives way until the newcomer fits — which is the same code for two arms,
  // three, or an asura rana's six, and the same code whether the room was made
  // by growing an arm or by needing fewer of them.
  if (HAND_SLOTS.includes(target)) {
    const grants = bearerGrants(state);
    const available = armsFrom(grants);
    const incoming = armCost(grants, def, target);
    for (const other of HAND_SLOTS) {
      if (other === target) continue;
      if (armsUsed(state, grants) + incoming <= available) break;
      takeOff(other);
    }
  }
  state.equipment[target] = item;
  state.inventory.push(...displaced);

  const note = wieldNote(def, target);
  bus.emit({
    type: 'log',
    msg: text('equipment.equipped', {
      icon: def.icon,
      item: itemName(item),
      note: note ? text('equipment.equip_note', { note }) : '',
    }),
    kind: 'item',
  });
  return true;
}

export function unequipSlot(state: GameState, slot: keyof GameState['equipment']): void {
  const item = state.equipment[slot];
  if (!item) return;
  delete state.equipment[slot];
  state.inventory.push(item);
}

/**
 * One line for the whole sale, however many items it covered — a bulk sale
 * should not bury the feed. A uniform lot keeps its name; a mixed one is
 * summarised by count.
 */
function saleMessage(sold: ItemInstance[], total: number): string {
  const first = sold[0];
  if (sold.length === 1) return text('equipment.sold_one', { item: itemName(first), total });
  const uniform = sold.every((i) => itemName(i) === itemName(first));
  return uniform
    ? text('equipment.sold_uniform', { item: itemName(first), count: sold.length, total })
    : text('equipment.sold_mixed', { count: sold.length, total });
}

/** Sell any number of inventory items as a single transaction. Returns the take. */
export function sellItems(state: GameState, bus: EventBus, uids: number[]): number {
  const sold: ItemInstance[] = [];
  let total = 0;
  for (const uid of uids) {
    const idx = state.inventory.findIndex((i) => i.uid === uid);
    if (idx < 0) continue;
    const item = state.inventory[idx];
    total += sellPrice(state, item);
    state.inventory.splice(idx, 1);
    // Socketed runes are pried out and kept — selling never destroys them.
    // A carving is one of a kind, so it goes back to the carved pile.
    for (const ref of item.runes ?? []) {
      if (typeof ref === 'string') state.runes[ref] = (state.runes[ref] ?? 0) + 1;
      else {
        state.carved ??= [];
        state.carved.push(ref);
      }
    }
    sold.push(item);
  }
  if (sold.length === 0) return 0;
  state.gold += total;
  bumpStat(state, bus, 'gold:earned', total);
  bus.emit({ type: 'log', msg: saleMessage(sold, total), kind: 'item' });
  return total;
}

export function sellItem(state: GameState, bus: EventBus, uid: number): void {
  sellItems(state, bus, [uid]);
}

export function nextUid(state: GameState): number {
  state.uidCounter += 1;
  return state.uidCounter;
}

/** Sell price for one unit of a material (charisma-aware, see sellPrice). */
export function materialSellPrice(
  state: GameState,
  materialId: string,
  goldGain = getDerivedStats(state).goldGain,
): number {
  const def = MATERIALS[materialId];
  return Math.max(1, Math.round((def?.value ?? 1) * goldGain));
}

// ---------- Graded stackables (provisions & ingredients) ----------
//
// Dishes, potions and raw ingredients are all held as materials — graded ones
// per quality in `stock`, plain ones as a flat count. These handle both, so a
// Fair dish and a plain herb sell and dump through the same door.

/** Sell price of one unit at a grade. Refuse still fetches a token coin. */
export function gradedUnitPrice(
  state: GameState,
  id: string,
  quality: QualityTier,
  goldGain = getDerivedStats(state).goldGain,
): number {
  const def = MATERIALS[id];
  const mult = MATERIALS[id]?.graded ? Math.max(0.1, qualityMult(quality)) : 1;
  return Math.max(1, Math.round((def?.value ?? 1) * mult * goldGain));
}

/** Remove up to `qty` from stock/materials; returns how many were actually removed. */
function takeStack(state: GameState, id: string, quality: QualityTier, qty: number): number {
  if (MATERIALS[id]?.graded) {
    const take = Math.min(stockOf(state, id, quality), qty);
    if (take > 0) takeGraded(state, id, quality, take);
    return take;
  }
  const have = state.materials[id] ?? 0;
  const take = Math.min(have, qty);
  if (take <= 0) return 0;
  if (have - take > 0) state.materials[id] = have - take;
  else delete state.materials[id];
  return take;
}

/** A grade prefix for the log, empty for ungraded things. */
function gradeLabel(id: string, quality: QualityTier): string {
  return MATERIALS[id]?.graded ? `${QUALITY_TIERS[quality].name} ` : '';
}

/** Sell some of a held stackable (a provision grade, an ingredient grade). */
export function sellStackable(
  state: GameState,
  bus: EventBus,
  id: string,
  quality: QualityTier,
  qty: number,
): number {
  const removed = takeStack(state, id, quality, qty);
  if (removed <= 0) return 0;
  const price = gradedUnitPrice(state, id, quality) * removed;
  state.gold += price;
  bumpStat(state, bus, 'gold:earned', price);
  const def = MATERIALS[id];
  bus.emit({
    type: 'log',
    msg: text('equipment.sold_stack', { icon: def?.icon ?? '', grade: gradeLabel(id, quality), name: def?.name ?? id, qty: removed, price }),
    kind: 'item',
  });
  return price;
}

/** Throw some of a held stackable away — no gold, gone for good. */
export function discardStackable(
  state: GameState,
  bus: EventBus,
  id: string,
  quality: QualityTier,
  qty: number,
): number {
  const removed = takeStack(state, id, quality, qty);
  if (removed <= 0) return 0;
  const def = MATERIALS[id];
  bus.emit({
    type: 'log',
    msg: text('equipment.discarded_stack', { icon: def?.icon ?? '', grade: gradeLabel(id, quality), name: def?.name ?? id, qty: removed }),
    kind: 'info',
  });
  return removed;
}

/** One (material, grade) pair to act on in bulk. */
export interface StackRef {
  id: string;
  quality: QualityTier;
}

/**
 * Sell whole stacks in one sweep — pouch housekeeping. Each ref's entire held
 * quantity goes, and the lot is summed into a single log line rather than one
 * per grade. Returns the gold taken.
 */
export function sellStackablesBatch(
  state: GameState,
  bus: EventBus,
  refs: StackRef[],
  noun = 'item',
): number {
  let total = 0;
  let units = 0;
  for (const { id, quality } of refs) {
    const have = MATERIALS[id]?.graded ? stockOf(state, id, quality) : (state.materials[id] ?? 0);
    const removed = takeStack(state, id, quality, have);
    if (removed > 0) {
      total += gradedUnitPrice(state, id, quality) * removed;
      units += removed;
    }
  }
  if (units === 0) return 0;
  state.gold += total;
  bumpStat(state, bus, 'gold:earned', total);
  bus.emit({
    type: 'log',
    msg: text('equipment.sold_units', { units, noun, plural: units === 1 ? '' : 's', total }),
    kind: 'item',
  });
  return total;
}

/** Dump whole stacks in one sweep — pouch housekeeping. Returns the count binned. */
export function discardStackablesBatch(
  state: GameState,
  bus: EventBus,
  refs: StackRef[],
  noun = 'item',
): number {
  let units = 0;
  for (const { id, quality } of refs) {
    const have = MATERIALS[id]?.graded ? stockOf(state, id, quality) : (state.materials[id] ?? 0);
    units += takeStack(state, id, quality, have);
  }
  if (units === 0) return 0;
  bus.emit({
    type: 'log',
    msg: text('equipment.discarded_units', { units, noun, plural: units === 1 ? '' : 's' }),
    kind: 'info',
  });
  return units;
}

/** Sell the entire stack of a material. */
export function sellMaterial(state: GameState, bus: EventBus, materialId: string): void {
  const qty = state.materials[materialId] ?? 0;
  if (qty <= 0) return;
  const price = materialSellPrice(state, materialId) * qty;
  delete state.materials[materialId];
  state.gold += price;
  bumpStat(state, bus, 'gold:earned', price);
  const def = MATERIALS[materialId];
  bus.emit({
    type: 'log',
    msg: text('equipment.sold_material', { icon: def?.icon ?? '', name: def?.name ?? materialId, qty, price }),
    kind: 'item',
  });
}
