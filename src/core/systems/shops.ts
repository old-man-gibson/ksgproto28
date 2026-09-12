import type { GameState, NpcDef, QualityTier, ShopLine } from '../types';
import type { EventBus } from '../engine/events';
import { ITEMS, MATERIALS, NPCS, QUALITY_TIERS } from '../registry';
import { conditionsMet } from './conditions';
import { bumpStat } from './achievements';
import { createItem, maxRuneSlots } from './runes';
import { grantGraded } from './disciplines';
import { gradedUnitPrice, materialSellPrice, sellPrice } from './equipment';
import { getDerivedStats } from './derived';
import { hasMet } from './quests';
import { qualityMult } from '../data/quality.data';
import { text } from '../text/log';

/**
 * Shops — buying, the other half of the counter.
 *
 * Selling already existed (equipment.ts, charisma-aware through `goldGain`).
 * Buying is its mirror with one law on top: **no arbitrage.** Whatever your
 * charisma, buying a thing and selling it straight back never profits — the
 * buy price is the derived markup or one coin over the best possible resale,
 * whichever is higher. Charisma therefore raises what you get, never lowers
 * what you pay; what lowers what you pay is being KNOWN. A stranger pays
 * full price at every counter in this city (the Warden's words) — `talkTo`
 * stamps the `met:` counter and the markup drops with it. Nothing about a
 * shop is saved: stock is data, prices are derived, the discount is a counter
 * that already exists.
 */

/** Markup over base value for a customer the vendor knows. */
export const BUY_MARKUP = 2;
/** Extra multiplier a stranger pays on top of BUY_MARKUP. */
export const STRANGER_MARKUP = 1.5;
/** Grade a graded ware is sold at when the line does not say. */
export const DEFAULT_SHOP_QUALITY: QualityTier = 'c';

export function lineQuality(line: ShopLine): QualityTier {
  return line.kind === 'material' ? (line.quality ?? DEFAULT_SHOP_QUALITY) : DEFAULT_SHOP_QUALITY;
}

/** Base worth of one unit of a line, before any markup. */
export function lineValue(line: ShopLine): number {
  if (line.kind === 'item') return ITEMS[line.id]?.value ?? 1;
  const def = MATERIALS[line.id];
  const mult = def?.graded ? Math.max(0.1, qualityMult(lineQuality(line))) : 1;
  return (def?.value ?? 1) * mult;
}

/** What a vendor asks before the no-arbitrage floor — state-free, so the linter can read it. */
export function askingPrice(line: ShopLine, met: boolean): number {
  const base = line.price ?? Math.ceil(lineValue(line) * BUY_MARKUP);
  return Math.max(1, Math.ceil(base * (met ? 1 : STRANGER_MARKUP)));
}

/**
 * The most one unit could sell back for right now. Rune slots roll on
 * purchase, so an item is priced as its best possible roll — otherwise a
 * lucky slot turns the counter into a mint.
 */
export function resaleCeiling(state: GameState, line: ShopLine, goldGain: number): number {
  if (line.kind === 'material') {
    return MATERIALS[line.id]?.graded
      ? gradedUnitPrice(state, line.id, lineQuality(line), goldGain)
      : materialSellPrice(state, line.id, goldGain);
  }
  const def = ITEMS[line.id];
  const slots = def ? maxRuneSlots(def) : 0;
  return sellPrice(state, { uid: 0, defId: line.id, slots, runes: [] }, goldGain);
}

/**
 * The price you pay per unit. The floor is applied last, so it survives a
 * `price` override too — a bargain is still never a mint.
 */
export function buyPrice(
  state: GameState,
  npcId: string,
  line: ShopLine,
  goldGain = getDerivedStats(state).goldGain,
): number {
  const asked = askingPrice(line, hasMet(state, npcId));
  return Math.max(asked, resaleCeiling(state, line, goldGain) + 1);
}

/** Lines a vendor shows this player: unresolved ids and unmet `requires` stay off the shelf. */
export function visibleLines(state: GameState, npc: NpcDef): ShopLine[] {
  return (npc.shop?.lines ?? []).filter((line) => {
    const known = line.kind === 'item' ? ITEMS[line.id] : MATERIALS[line.id];
    return !!known && (!line.requires || conditionsMet(state, line.requires));
  });
}

export function lineName(line: ShopLine): string {
  if (line.kind === 'item') return ITEMS[line.id]?.name ?? line.id;
  const def = MATERIALS[line.id];
  const grade = def?.graded ? `${QUALITY_TIERS[lineQuality(line)].name} ` : '';
  return `${grade}${def?.name ?? line.id}`;
}

export function lineIcon(line: ShopLine): string {
  return (line.kind === 'item' ? ITEMS[line.id]?.icon : MATERIALS[line.id]?.icon) ?? '📦';
}

/**
 * Buy `qty` of the line at `index` on this vendor's visible shelf. Returns
 * how many were bought: 0 when you are elsewhere, the line is not on the
 * shelf, or the gold is short for even one. Partial buys are deliberate —
 * "buy 5" with gold for 3 buys 3.
 */
export function buy(state: GameState, bus: EventBus, npcId: string, index: number, qty = 1): number {
  const npc = NPCS[npcId];
  if (!npc?.shop || state.spot !== npc.spotId) return 0;
  const line = visibleLines(state, npc)[index];
  if (!line || qty <= 0) return 0;
  const unit = buyPrice(state, npcId, line);
  const count = Math.min(Math.floor(qty), Math.floor(state.gold / unit));
  if (count <= 0) return 0;
  const total = unit * count;
  state.gold -= total;

  if (line.kind === 'item') {
    for (let i = 0; i < count; i++) state.inventory.push(createItem(state, line.id));
  } else if (MATERIALS[line.id]?.graded) {
    // Bought goods are a known grade, not a rolled one — the shelf said so.
    grantGraded(state, line.id, lineQuality(line), count);
  } else {
    state.materials[line.id] = (state.materials[line.id] ?? 0) + count;
  }

  bumpStat(state, bus, 'gold:spent', total);
  bumpStat(state, bus, 'shop:buys', count);
  bumpStat(state, bus, `shop:buys:${npcId}`, count);
  bus.emit({
    type: 'log',
    msg: text('shops.bought', {
      icon: lineIcon(line),
      name: lineName(line),
      qty: count > 1 ? text('common.times', { qty: count }) : '',
      total,
    }),
    kind: 'item',
  });
  return count;
}
