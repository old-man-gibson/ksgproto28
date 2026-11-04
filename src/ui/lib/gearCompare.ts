/**
 * Spare marks and worn-piece deltas for the inventory
 * (docs/plans/ui-proposals.md, item C2). Pure: nothing here writes state.
 *
 * `beats(a, b)` is strict dominance between two items of the same base:
 *
 *  - same `defId` and same size (`size` absent reads as medium);
 *  - a's summed modifier terms, affix included, are >= b's on every
 *    (stat, op) key, with the comparison flipped for the stats where a smaller
 *    value is better (`lowerIsBetter`);
 *  - a's rune slots are >= b's;
 *  - a is better in at least one of those. Socketed runes are not compared, so
 *    two items that differ only in runes beat neither way.
 *
 * Dominance is a strict partial order: it has no cycles and it is transitive.
 * That is what makes selling every beaten item safe, because the items nothing
 * beats are never sold, so the best of each kind always stays.
 *
 * Never compared, on either side (`findSpares`): forged items, items with a
 * conditional modifier, and the festival's issued weapon and royale finds
 * (lent for an attempt and taken back). A conditional modifier is one the
 * (stat, op) key does not describe: it applies only under a tag, a style, a
 * target tag, a level or another stat.
 *
 * An item a saved Loadout names is compared as a beater and counts toward the
 * hand budget, but is never marked spare itself. A worse copy of it is spare.
 * Copies share a stack with it, so the stack shows as partly spare.
 *
 * Hands (`findSpares`): for a base that fits a hand, the best K copies are
 * kept. K = the arms left after the hands holding a different base (each
 * counted at its `armCost`), divided by this base's `armCost`, rounded down.
 * A second dagger is the off hand's weapon; a second greatsword is not, on
 * two arms. Only copies past K can be spare.
 *
 * While runecarving is shut, rune slots are hidden from the player, so a pair
 * that differs in slots is incomparable and neither beats the other.
 */
import type { GameState, ItemDef, ItemInstance, ModTarget, Modifier, SlotId } from '../../core/types';
import { runeContextFor, sizeRank } from '../../core/types';
import { itemDefOf } from '../../core/systems/assembly';
import { stackKey } from '../../core/systems/inventory';
import { HAND_SLOTS, armCost, armsFrom, wieldScale } from '../../core/systems/equipment';
import { resolveRune } from '../../core/systems/runes';
import { sizeFit } from '../../core/systems/wield';
import { bearerGrants, playerSizeRank } from '../../core/systems/mutagens';
import { subsystemUnlocked } from '../../core/systems/unlocks';
import { isIssuedWeapon } from '../../core/systems/festivalRules';
import { describeMod } from './format';

/** Numbers within this are equal: a summed 0.1 + 0.08 is not exactly 0.18. */
const EPS = 1e-9;

/**
 * Stats where the smaller value is the better one. The same set as
 * `LOWER_IS_BETTER` in systems/conditionHarm.ts, which does not export it;
 * tests/gearcompare.test.ts checks the two agree for every stat.
 */
const LOWER_IS_BETTER: ReadonlySet<string> = new Set([
  'damageTaken',
  'critTaken',
  'stumbleTaken',
  'staminaEff',
  'manaEff',
  'actionBar',
]);

/** A scoped stat (`damageTaken:heat`) reads by the stat before the colon. */
export function lowerIsBetter(stat: string): boolean {
  return LOWER_IS_BETTER.has(stat.split(':')[0]);
}

/**
 * A modifier the (stat, op) key does not fully describe. Any of these makes
 * the item incomparable. `undampened` joins the list because it changes how
 * the same number behaves under a condition.
 */
export function isConditional(mod: Modifier): boolean {
  return (
    !!mod.requiresTag ||
    !!mod.requiresStyle ||
    !!mod.requiresMonsterTag ||
    mod.perLevel !== undefined ||
    mod.levelCurve !== undefined ||
    mod.fromStat !== undefined ||
    mod.undampened === true
  );
}

interface Term {
  stat: string;
  op: Modifier['op'];
  value: number;
}

interface Profile {
  /** Summed value per `stat|op` key. */
  terms: Map<string, Term>;
  slots: number;
}

const termKey = (mod: Modifier): string => `${mod.stat}|${mod.op}`;

function addTerm(terms: Map<string, Term>, mod: Modifier, scale = 1): void {
  const key = termKey(mod);
  const held = terms.get(key);
  if (held) held.value += mod.value * scale;
  else terms.set(key, { stat: mod.stat, op: mod.op, value: mod.value * scale });
}

/** The comparable shape of an item, or null when it is never compared. */
function profileOf(item: ItemInstance, def: ItemDef): Profile | null {
  if (item.forged) return null;
  const terms = new Map<string, Term>();
  for (const mod of def.mods) {
    if (isConditional(mod)) return null;
    addTerm(terms, mod);
  }
  for (const mod of item.affix?.mods ?? []) {
    if (isConditional(mod)) return null;
    addTerm(terms, mod);
  }
  return { terms, slots: item.slots ?? 0 };
}

function dominates(a: Profile, b: Profile, runesOpen: boolean): boolean {
  if (!runesOpen && a.slots !== b.slots) return false;
  if (a.slots < b.slots) return false;
  let better = a.slots > b.slots;
  const keys = new Set([...a.terms.keys(), ...b.terms.keys()]);
  for (const key of keys) {
    const ta = a.terms.get(key);
    const tb = b.terms.get(key);
    const stat = (ta ?? tb)!.stat;
    const va = ta?.value ?? 0;
    const vb = tb?.value ?? 0;
    const gain = lowerIsBetter(stat) ? vb - va : va - vb;
    if (gain < -EPS) return false;
    if (gain > EPS) better = true;
  }
  return better;
}

/**
 * Whether `a` is at least as good as `b` in every compared respect and better
 * in one. `runesOpen` is the runecarving shutter (`subsystemUnlocked`): shut,
 * a difference in rune slots makes the pair incomparable.
 *
 * This is the pairwise rule only. Loadouts and lent gear need the whole state;
 * `findSpares` applies them.
 */
export function beats(a: ItemInstance, b: ItemInstance, runesOpen = true): boolean {
  if (a.defId !== b.defId || sizeRank(a.size) !== sizeRank(b.size)) return false;
  if (a.forged || b.forged) return false;
  const defA = itemDefOf(a) as ItemDef | undefined;
  const defB = itemDefOf(b) as ItemDef | undefined;
  if (!defA || !defB) return false;
  const pa = profileOf(a, defA);
  const pb = profileOf(b, defB);
  return !!pa && !!pb && dominates(pa, pb, runesOpen);
}

// ---------- Spare marks ----------

type Place = 'pack' | 'hand' | 'worn' | 'sheathed';

/** Order a beater is named in: the piece in use first. */
const PLACE_RANK: Record<Place, number> = { hand: 0, worn: 1, sheathed: 2, pack: 3 };

interface Held {
  item: ItemInstance;
  place: Place;
}

/** Items of one stack identity inside one (base, size) group. */
interface Variant {
  profile: Profile | null;
  held: Held[];
  beaters: Variant[];
  /** Held items in the variants that beat this one. */
  beatenBy: number;
}

/** The festival lends its weapon and the royale's finds, and takes them back. */
function isLent(state: GameState, uid: number): boolean {
  return isIssuedWeapon(state, uid) || !!state.festival?.run?.lent?.includes(uid);
}

function loadoutUids(state: GameState): Set<number> {
  const named = new Set<number>();
  for (const plan of state.loadouts ?? []) {
    for (const uid of Object.values(plan.equipment ?? {})) if (typeof uid === 'number') named.add(uid);
  }
  return named;
}

/**
 * How many copies of `def` the hands could hold at once: the arms left after
 * the hands holding another base (each at its `armCost`), over this base's
 * own `armCost`. Two arms hold two daggers or one greatsword.
 */
function handBudget(
  state: GameState,
  grants: ReadonlySet<string>,
  arms: number,
  defId: string,
  def: ItemDef,
): number {
  let used = 0;
  for (const slot of HAND_SLOTS.slice(0, arms)) {
    const worn = state.equipment[slot];
    if (!worn || worn.defId === defId) continue;
    const wornDef = itemDefOf(worn) as ItemDef | undefined;
    used += wornDef ? armCost(grants, wornDef, slot) : 1;
  }
  return Math.floor(Math.max(0, arms - used) / armCost(grants, def));
}

/** The item a beaten variant is named against: the piece in use, then the oldest. */
function representative(variant: Variant): ItemInstance {
  const sorted = [...variant.held].sort(
    (x, y) => PLACE_RANK[x.place] - PLACE_RANK[y.place] || x.item.uid - y.item.uid,
  );
  return sorted[0].item;
}

/**
 * The spare items in the pack: uid -> a held or worn item that beats it.
 *
 * An item is spare when a held or worn item beats it, it is not among the best
 * K copies of a base that fits a hand, and the rules in the file header leave
 * it comparable. Worn gear is never in the map; it is only compared against.
 *
 * The map is by item, not by stack: a display stack can be partly spare when the
 * hand budget keeps some of its copies (`spareCount`, `isSpareStack`).
 * `grants` defaults to the bearer's capabilities; a caller that already holds
 * them passes them in.
 */
export function findSpares(
  state: GameState,
  grants: ReadonlySet<string> = bearerGrants(state),
): Map<number, ItemInstance> {
  const arms = armsFrom(grants);
  const runesOpen = subsystemUnlocked(state, 'runecarving');
  const named = loadoutUids(state);
  const groups = new Map<string, { defId: string; def: ItemDef; variants: Map<string, Variant> }>();

  const take = (item: ItemInstance, place: Place) => {
    if (!item || item.forged || isLent(state, item.uid)) return;
    const def = itemDefOf(item) as ItemDef | undefined;
    if (!def) return;
    const groupKey = `${item.defId}|${sizeRank(item.size)}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = { defId: item.defId, def, variants: new Map() };
      groups.set(groupKey, group);
    }
    const key = stackKey(item);
    let variant = group.variants.get(key);
    if (!variant) {
      variant = { profile: profileOf(item, def), held: [], beaters: [], beatenBy: 0 };
      group.variants.set(key, variant);
    }
    variant.held.push({ item, place });
  };

  for (const item of state.inventory) take(item, 'pack');
  for (const slot of Object.keys(state.equipment) as SlotId[]) {
    const item = state.equipment[slot];
    if (!item) continue;
    const handIndex = HAND_SLOTS.indexOf(slot);
    take(item, handIndex >= 0 && handIndex < arms ? 'hand' : 'worn');
  }
  if (state.sheathed) take(state.sheathed, 'sheathed');

  const spare = new Map<number, ItemInstance>();
  for (const { defId, def, variants } of groups.values()) {
    const list = [...variants.values()].filter((v) => v.profile);
    for (const a of list) {
      for (const b of list) {
        if (a !== b && dominates(a.profile!, b.profile!, runesOpen)) b.beaters.push(a);
      }
    }
    const beaten = list.filter((v) => v.beaters.length > 0);
    if (beaten.length === 0) continue;
    for (const v of beaten) v.beatenBy = v.beaters.reduce((n, w) => n + w.held.length, 0);

    // Hands: the best K copies stay. A copy beaten by more held items ranks
    // lower, and that order never puts a beaten copy above its beater.
    let keep: Set<number> | null = null;
    if (HAND_SLOTS.includes(def.slot)) {
      const budget = handBudget(state, grants, arms, defId, def);
      const ranked = list
        .flatMap((v) => v.held.filter((h) => h.place === 'pack' || h.place === 'hand').map((h) => ({ h, v })))
        .sort(
          (x, y) =>
            x.v.beatenBy - y.v.beatenBy ||
            PLACE_RANK[x.h.place] - PLACE_RANK[y.h.place] ||
            x.h.item.uid - y.h.item.uid,
        );
      keep = new Set(ranked.slice(0, budget).map((r) => r.h.item.uid));
    }

    for (const v of beaten) {
      const best = [...v.beaters].sort((x, y) => x.beatenBy - y.beatenBy)[0];
      const by = representative(best);
      for (const h of v.held) {
        // A Loadout's piece beats and holds a hand, but is never itself for sale.
        if (h.place !== 'pack' || named.has(h.item.uid) || keep?.has(h.item.uid)) continue;
        spare.set(h.item.uid, by);
      }
    }
  }
  return spare;
}

/** How many items of a display stack are spare. */
export function spareCount(stack: { items: ItemInstance[] }, spare: ReadonlyMap<number, ItemInstance>): number {
  let n = 0;
  for (const item of stack.items) if (spare.has(item.uid)) n += 1;
  return n;
}

/** A display stack is spare when every item in it is. */
export function isSpareStack(stack: { items: ItemInstance[] }, spare: ReadonlyMap<number, ItemInstance>): boolean {
  return stack.items.length > 0 && spareCount(stack, spare) === stack.items.length;
}

export interface SpareTally {
  /** Spare items, which is what Sell spares sells. */
  items: number;
  /** Display stacks holding at least one spare item. */
  stacks: number;
  /** Display stacks that are spare whole. */
  whole: number;
}

/** The toolbar's numbers. Counting by item gives the same `items` grouped or not. */
export function tallySpares(
  stacks: readonly { items: ItemInstance[] }[],
  spare: ReadonlyMap<number, ItemInstance>,
): SpareTally {
  const tally: SpareTally = { items: 0, stacks: 0, whole: 0 };
  for (const stack of stacks) {
    const n = spareCount(stack, spare);
    if (n === 0) continue;
    tally.items += n;
    tally.stacks += 1;
    if (n === stack.items.length) tally.whole += 1;
  }
  return tally;
}

/** The spare items in the pack, in pack order: the lot Sell spares sells. */
export function spareLot(state: GameState, spare: ReadonlyMap<number, ItemInstance>): ItemInstance[] {
  return state.inventory.filter((item) => spare.has(item.uid));
}

// ---------- Deltas against the worn piece ----------

export interface DeltaLine {
  text: string;
  /** True when the change helps the wearer. */
  better: boolean;
}

export interface WornComparison {
  worn: ItemInstance;
  lines: DeltaLine[];
  /** Either piece has a conditional modifier. Those are left out of the lines. */
  conditional: boolean;
}

/**
 * What an item gives in `slot` for this wearer. Mirrors the equipment loop of
 * collectBaseMods (systems/attributes.ts):
 *  - the base and affix mods, scaled by hand fit and size fit;
 *  - each socketed rune's mods for the item's rune context, same scale;
 *  - the main-hand or off-hand bonus, unscaled, when its `pairedWith` tag is
 *    in the other hand.
 * A conditional modifier is left out and flagged.
 */
function effectiveTerms(
  state: GameState,
  item: ItemInstance,
  slot: SlotId,
  wielderRank: number,
): { terms: Map<string, Term>; conditional: boolean } {
  const terms = new Map<string, Term>();
  const def = itemDefOf(item) as ItemDef | undefined;
  if (!def) return { terms, conditional: false };
  const fit = wieldScale(def, slot) * sizeFit(item, slot, wielderRank);
  let conditional = false;
  const add = (mods: readonly Modifier[], scale: number) => {
    for (const mod of mods) {
      if (isConditional(mod)) conditional = true;
      else addTerm(terms, mod, scale);
    }
  };
  add(def.mods, fit);
  add(item.affix?.mods ?? [], fit);
  const context = runeContextFor(def.slot);
  for (const ref of item.runes ?? []) add(resolveRune(ref).effects[context]?.mods ?? [], fit);
  const bonus = slot === 'weapon' ? def.mainHand : slot === 'offhand' ? def.offHand : undefined;
  if (bonus) {
    const other = state.equipment[slot === 'weapon' ? 'offhand' : 'weapon'];
    const tags = other ? (itemDefOf(other)?.tags ?? []) : [];
    if (!bonus.pairedWith || tags.includes(bonus.pairedWith)) add(bonus.mods, 1);
  }
  return { terms, conditional };
}

/** "+3 Armor" as "Armor: +3 vs worn". */
function deltaText(term: Term, diff: number): string {
  const line = describeMod({ stat: term.stat as ModTarget, op: term.op, value: diff });
  const parts = /^([+−]\S+) (.+)$/.exec(line);
  return parts ? `${parts[2]}: ${parts[1]} vs worn` : `${line} vs worn`;
}

/**
 * How `item` differs from the piece worn in `slot`, stat by stat, as the wearer
 * would feel it: base and affix mods, socketed runes and the hand bonus, with
 * the slot's hand scale and the item's size fit (`effectiveTerms`). Typed
 * on-hit damage and technique changes are not compared. Null when the slot is
 * empty or already holds this item. Rune slots are listed only while
 * runecarving is open.
 */
export function compareToWorn(
  state: GameState,
  item: ItemInstance,
  slot: SlotId,
  runesOpen: boolean,
): WornComparison | null {
  const worn = state.equipment[slot];
  if (!worn || worn.uid === item.uid) return null;
  const rank = playerSizeRank(state);
  const mine = effectiveTerms(state, item, slot, rank);
  const theirs = effectiveTerms(state, worn, slot, rank);

  const lines: DeltaLine[] = [];
  const keys = new Set([...mine.terms.keys(), ...theirs.terms.keys()]);
  for (const key of keys) {
    const a = mine.terms.get(key);
    const b = theirs.terms.get(key);
    const term = (a ?? b)!;
    const diff = Math.round(((a?.value ?? 0) - (b?.value ?? 0)) * 1e6) / 1e6;
    if (Math.abs(diff) < EPS) continue;
    lines.push({
      text: deltaText(term, diff),
      better: lowerIsBetter(term.stat) ? diff < 0 : diff > 0,
    });
  }
  if (runesOpen) {
    const gap = (item.slots ?? 0) - (worn.slots ?? 0);
    if (gap !== 0) lines.push({ text: `Rune slots: ${gap > 0 ? '+' : '−'}${Math.abs(gap)}`, better: gap > 0 });
  }
  return { worn, lines, conditional: mine.conditional || theirs.conditional };
}
