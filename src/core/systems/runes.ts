import type {
  CarvedRune,
  QualityTier,
  RuneContext,
  GameState,
  ItemDef,
  ItemInstance,
  RuneDef,
  RuneEffect,
  RuneRef,
  RuneSizeClass,
  RuneTechniqueMod,
  SlotId,
} from '../types';
import { runeContextFor } from '../types';
import type { EventBus } from '../engine/events';
import { weightedPick } from '../engine/rng';
import { ITEMS, RUNES } from '../registry';
import { NAMED_RUNES, RUNE_ADORNMENTS, RUNE_PATTERNS } from '../data/runes.data';
import { QUALITY_TIERS, qualityAtLeast, qualityMult } from '../data/quality.data';
import { nextUid } from './equipment';
import { getDerivedStats } from './derived';
import { bumpStat } from './achievements';
import { text } from '../text/log';

export const MAX_RUNE_SLOTS = 4;

/**
 * Slot-count weights per size class (index = slot count 0–4). Small gear
 * (rings, daggers) averages well under one slot; large gear (breastplates,
 * greatswords) averages nearly two and can roll the full four.
 */
const SLOT_WEIGHTS: Record<RuneSizeClass, number[]> = {
  small: [50, 32, 14, 4, 0],
  medium: [25, 35, 25, 12, 3],
  large: [12, 24, 32, 22, 10],
};

/** Size class of an item: explicit override, else inferred from tags/slot. */
export function runeClassOf(def: ItemDef): RuneSizeClass {
  if (def.runeClass) return def.runeClass;
  if (def.tags.includes('dagger')) return 'small';
  if (def.tags.includes('greatsword')) return 'large';
  switch (def.slot) {
    case 'accessory':
      return 'small';
    case 'chest':
    case 'legs':
      return 'large';
    default:
      return 'medium';
  }
}

/**
 * The most slots this item's size class can ever roll. Small gear tops out
 * below the global cap, so a 3-slot dagger is as socketed as a dagger gets.
 */
export function maxRuneSlots(def: ItemDef): number {
  const weights = SLOT_WEIGHTS[runeClassOf(def)];
  for (let slots = weights.length - 1; slots >= 0; slots--) {
    if (weights[slots] > 0) return slots;
  }
  return 0;
}

/**
 * The slots a fresh item CAN roll, lowest to highest — what a counter can
 * honestly promise before the roll happens.
 */
export function runeSlotRange(def: ItemDef): [number, number] {
  const weights = SLOT_WEIGHTS[runeClassOf(def)];
  const min = weights.findIndex((w) => w > 0);
  return [Math.max(0, min), maxRuneSlots(def)];
}
/** Roll how many rune slots a freshly generated item gets (0–4). */
export function rollRuneSlots(state: GameState, def: ItemDef): number {
  const weights = SLOT_WEIGHTS[runeClassOf(def)];
  const entries = weights.map((weight, slots) => ({ slots, weight })).filter((e) => e.weight > 0);
  return weightedPick(state, entries).slots;
}

/**
 * The one way to mint an equipment instance: uid + rolled rune slots.
 * Loot drops, craft results, and quest rewards all come through here.
 */
export function createItem(state: GameState, defId: string): ItemInstance {
  const def = ITEMS[defId];
  return {
    uid: nextUid(state),
    defId,
    slots: def ? rollRuneSlots(state, def) : 0,
    runes: [],
  };
}


// ---------- Resolving a rune ----------

/**
 * A carved rune's identity, and its shareable form.
 *
 * The key is the combination itself, which is exactly what makes a carving
 * reverse-engineerable: hand somebody this string and they can reconstruct the
 * rune with no registry of yours. It doubles as the memo key below.
 */
export function carvedKey(rune: CarvedRune): string {
  const cuts = [...rune.patterns].sort().join(',');
  const adorn = rune.adornments
    .map((a) => `${a.id}.${a.quality}`)
    .sort()
    .join('+');
  return `${cuts}@${rune.stone.id}.${rune.stone.quality}${adorn ? `/${adorn}` : ''}`;
}

/** Scale everything an effect grants by one multiplier. */
function scaleEffect(effect: RuneEffect | undefined, mult: number): RuneEffect | undefined {
  if (!effect) return undefined;
  const out: RuneEffect = {};
  if (effect.mods) out.mods = effect.mods.map((m) => ({ ...m, value: m.value * mult }));
  if (effect.bonusDamage) {
    out.bonusDamage = { ...effect.bonusDamage, value: effect.bonusDamage.value * mult };
  }
  if (effect.bonusDamagePct) {
    out.bonusDamagePct = { ...effect.bonusDamagePct, value: effect.bonusDamagePct.value * mult };
  }
  return out;
}

/** Fold `add` into `into`, summing anything they both grant. */
function mergeEffect(into: RuneEffect | undefined, add: RuneEffect | undefined): RuneEffect | undefined {
  if (!add) return into;
  if (!into) return { ...add, mods: add.mods ? [...add.mods] : undefined };
  const out: RuneEffect = { ...into };
  if (add.mods) out.mods = [...(into.mods ?? []), ...add.mods];
  if (add.bonusDamage) {
    out.bonusDamage =
      into.bonusDamage && into.bonusDamage.type === add.bonusDamage.type
        ? { ...into.bonusDamage, value: into.bonusDamage.value + add.bonusDamage.value }
        : (into.bonusDamage ?? add.bonusDamage);
  }
  if (add.bonusDamagePct) {
    out.bonusDamagePct =
      into.bonusDamagePct && into.bonusDamagePct.type === add.bonusDamagePct.type
        ? { ...into.bonusDamagePct, value: into.bonusDamagePct.value + add.bonusDamagePct.value }
        : (into.bonusDamagePct ?? add.bonusDamagePct);
  }
  return out;
}

/**
 * The named work this combination happens to be, if any. A name is earned by
 * an EXACT recipe: the right pattern, every listed adornment present, and a
 * stone good enough.
 */
export function namedRuneFor(rune: CarvedRune) {
  // Multisets, not sets: a slab cut twice with the same figure is a different
  // work from one cut once, and must not inherit the other's name.
  const cuts = [...rune.patterns].sort().join(',');
  const have = [...rune.adornments.map((a) => a.id)].sort().join(',');
  return NAMED_RUNES.find(
    (n) =>
      [...n.patterns].sort().join(',') === cuts &&
      [...n.adornments].sort().join(',') === have &&
      (!n.minQuality || qualityAtLeast(rune.stone.quality, n.minQuality)),
  );
}

/**
 * What one adornment contributes at a given grade — the same scaling the
 * finished rune uses. The bench shows this on hover so a player can tell what a
 * piece is worth BEFORE spending it, rather than having to read the total and
 * work backwards.
 */
export function adornmentEffectAt(
  id: string,
  quality: QualityTier,
  ctx: RuneContext,
): RuneEffect | undefined {
  return scaleEffect(RUNE_ADORNMENTS[id]?.effects[ctx], qualityMult(quality));
}

/**
 * What one pattern contributes, cut `copies` times into a slab of `quality`.
 * Mirrors composeCarved's maths for a single group, so a preview cannot
 * disagree with the rune it is previewing.
 */
export function patternEffectAt(
  id: string,
  quality: QualityTier,
  ctx: RuneContext,
  copies = 1,
): RuneEffect | undefined {
  const stacked = copies + (copies - 1) * RESONANCE;
  return scaleEffect(RUNE_PATTERNS[id]?.effects[ctx], qualityMult(quality) * stacked);
}

/** Composed carvings, keyed by combination. Carvings never change once made. */
const CARVED_CACHE = new Map<string, RuneDef>();

/**
 * Compose a carving into an ordinary RuneDef: the pattern is what it does, the
 * stone's grade decides how strongly, and each adornment adds its own thing at
 * its own grade. Nothing downstream needs to know it was carved rather than
 * found.
 */
function composeCarved(rune: CarvedRune): RuneDef {
  const key = carvedKey(rune);
  const cached = CARVED_CACHE.get(key);
  if (cached) return cached;

  const patterns = rune.patterns.map((id) => RUNE_PATTERNS[id]).filter(Boolean);
  const stone = qualityMult(rune.stone.quality);
  const effects: RuneDef['effects'] = {};
  const contexts = ['weapon', 'armor', 'accessory'] as const;

  /*
   * Several DIFFERENT cuts on one slab share it: each distinct pattern lands at
   * a diminishing share, so breadth costs something and the widest carving is
   * not automatically the best one.
   *
   * Repeating the SAME cut works the other way. It concentrates the rune rather
   * than broadening it, so the copies add up and reinforce each other a little
   * on top (RESONANCE). Two of a figure is worth more than two separate
   * figures — which is the whole reason to spend a fine slab on it, and why a
   * fine slab is required (see REPEAT_MIN_QUALITY).
   */
  const share = (i: number) => 1 / (1 + i * 0.6);

  // Distinct patterns in first-appearance order, with how many copies of each.
  const groups: { pattern: (typeof patterns)[number]; copies: number }[] = [];
  for (const p of patterns) {
    const seen = groups.find((g) => g.pattern.id === p.id);
    if (seen) seen.copies += 1;
    else groups.push({ pattern: p, copies: 1 });
  }

  for (const ctx of contexts) {
    let effect: RuneEffect | undefined;
    groups.forEach((g, i) => {
      const stacked = g.copies + (g.copies - 1) * RESONANCE;
      effect = mergeEffect(effect, scaleEffect(g.pattern.effects[ctx], stone * share(i) * stacked));
    });
    for (const a of rune.adornments) {
      effect = mergeEffect(effect, scaleEffect(RUNE_ADORNMENTS[a.id]?.effects[ctx], qualityMult(a.quality)));
    }
    if (effect) effects[ctx] = effect;
  }

  const named = namedRuneFor(rune);
  if (named?.bonus) {
    for (const ctx of contexts) effects[ctx] = mergeEffect(effects[ctx], named.bonus[ctx]);
  }

  const grade = QUALITY_TIERS[rune.stone.quality];
  const lead = patterns[0];
  const leadName = lead?.name ?? rune.patterns[0];
  const leadCopies = rune.patterns.filter((id) => id === rune.patterns[0]).length;
  const distinct = new Set(rune.patterns).size;
  const plainName =
    leadCopies > 1 && distinct === 1
      ? // Nothing but the same cut, over and over: it is concentrated, not broad.
        `${grade.name} ${leadName} ×${leadCopies}`
      : distinct > 1
        ? `${grade.name} ${leadName} (+${distinct - 1})`
        : `${grade.name} ${leadName}`;
  const composed: RuneDef = {
    id: key,
    name: named?.name ?? plainName,
    icon: named?.icon ?? lead?.icon ?? '🔷',
    desc: named?.desc ?? lead?.desc,
    value: Math.max(1, Math.round(10 * Math.max(0.1, stone) * (1 + rune.adornments.length))),
    effects,
  };
  CARVED_CACHE.set(key, composed);
  return composed;
}

/**
 * How much extra each repeat of a pattern is worth beyond simply adding.
 * 0 would make two copies exactly twice one; this makes concentrating a rune
 * modestly better than the sum of its cuts, which is what makes it a choice.
 */
export const RESONANCE = 0.25;

/** A blank for a reference that resolves to nothing (a deleted pattern). */
const INERT: RuneDef = { id: 'unknown', name: 'Worn Rune', icon: '🔘', value: 1, effects: {} };

/**
 * The single door every reader goes through. Catalogue runes are a lookup;
 * carvings are composed from their combination and memoised.
 */
export function resolveRune(ref: RuneRef | undefined): RuneDef {
  if (!ref) return INERT;
  if (typeof ref === 'string') return RUNES[ref] ?? INERT;
  return composeCarved(ref);
}

/** Is this reference something the player carved rather than found? */
export function isCarved(ref: RuneRef): ref is CarvedRune {
  return typeof ref !== 'string';
}

/** The effect a rune grants inside the given item (undefined = inert there). */
export function runeEffectIn(ref: RuneRef, def: ItemDef): RuneEffect | undefined {
  return resolveRune(ref).effects[runeContextFor(def.slot)];
}

/** Find an item instance by uid across inventory AND worn equipment. */
export function findItem(state: GameState, uid: number): ItemInstance | null {
  return (
    state.inventory.find((i) => i.uid === uid) ??
    Object.values(state.equipment).find((i) => i?.uid === uid) ??
    null
  );
}

/**
 * Socket a rune into a free slot. `ref` is either a catalogue id (drawn from
 * the owned pool) or the index of one of your carvings.
 */
export function socketRune(state: GameState, bus: EventBus, uid: number, ref: string): boolean {
  const item = findItem(state, uid);
  if (!item) return false;
  const runes = (item.runes ??= []);
  if (runes.length >= (item.slots ?? 0)) return false;

  // A carving is referenced by its position in the carved pile.
  const carvedIndex = ref.startsWith('carved:') ? Number(ref.slice(7)) : -1;
  const carving = carvedIndex >= 0 ? state.carved?.[carvedIndex] : undefined;
  if (carvedIndex >= 0 && !carving) return false;
  if (carvedIndex < 0 && (!RUNES[ref] || (state.runes[ref] ?? 0) <= 0)) return false;

  const rune = carving ? resolveRune(carving) : RUNES[ref];
  runes.push(carving ?? ref);
  if (carving) {
    state.carved.splice(carvedIndex, 1);
  } else {
    state.runes[ref] -= 1;
    if (state.runes[ref] <= 0) delete state.runes[ref];
  }
  const def = ITEMS[item.defId];
  bus.emit({
    type: 'log',
    msg: text('runes.socketed', { icon: rune.icon, name: rune.name, itemIcon: def?.icon ?? '', item: def?.name ?? item.defId }),
    kind: 'item',
  });
  return true;
}

/** Pry a rune back out of an item (returned to the owned pool). */
export function unsocketRune(state: GameState, bus: EventBus, uid: number, index: number): boolean {
  const item = findItem(state, uid);
  const ref = item?.runes?.[index];
  if (!item || !ref) return false;
  item.runes!.splice(index, 1);
  // A carving goes back to the carved pile; a catalogue rune to the pool.
  if (isCarved(ref)) {
    state.carved ??= [];
    state.carved.push(ref);
  } else {
    grantRune(state, bus, ref, 1, true);
  }
  return true;
}

// ---------- Selling & discarding loose runes ----------
//
// A held rune is referenced the same way it is for socketing: a catalogue id,
// or `carved:<index>` into the carved pile. Both can be sold for their worth
// or simply thrown away.

/** Resolve a held-rune ref to what it is and where it lives. */
function heldRune(
  state: GameState,
  ref: string,
): { rune: RuneDef; take: () => boolean } | null {
  if (ref.startsWith('carved:')) {
    const i = Number(ref.slice(7));
    const carving = state.carved?.[i];
    if (!carving) return null;
    return { rune: resolveRune(carving), take: () => (state.carved.splice(i, 1), true) };
  }
  if ((state.runes[ref] ?? 0) <= 0) return null;
  return {
    rune: RUNES[ref],
    take: () => {
      state.runes[ref] -= 1;
      if (state.runes[ref] <= 0) delete state.runes[ref];
      return true;
    },
  };
}

export function runeSellPrice(
  state: GameState,
  ref: string,
  /** Pass the goldGain already in hand when pricing many rows (see sellPrice). */
  goldGain = getDerivedStats(state).goldGain,
): number {
  const held = heldRune(state, ref);
  const value = held?.rune.value ?? resolveRune(ref).value;
  return Math.max(1, Math.round(value * goldGain));
}

/** Sell one loose rune. A carving is gone for good; a catalogue rune loses one. */
export function sellRune(state: GameState, bus: EventBus, ref: string): number {
  const held = heldRune(state, ref);
  if (!held) return 0;
  const price = runeSellPrice(state, ref);
  held.take();
  state.gold += price;
  bumpStat(state, bus, 'gold:earned', price);
  bus.emit({
    type: 'log',
    msg: text('runes.sold', { icon: held.rune.icon, name: held.rune.name, price }),
    kind: 'item',
  });
  return price;
}

/** Throw one loose rune away. */
export function discardRune(state: GameState, bus: EventBus, ref: string): boolean {
  const held = heldRune(state, ref);
  if (!held) return false;
  held.take();
  bus.emit({ type: 'log', msg: text('runes.discarded', { icon: held.rune.icon, name: held.rune.name }), kind: 'info' });
  return true;
}

/**
 * Resolve a batch of rune refs into concrete removals, computed BEFORE any
 * mutation. Catalogue refs take the whole owned pile; carved refs are removed
 * by descending index so earlier splices don't shift later ones.
 */
function planRuneBatch(
  state: GameState,
  refs: string[],
): { unitValue: number; count: number; catalogue: string[]; carvedDesc: number[] } {
  const catalogue: string[] = [];
  const carved = new Set<number>();
  let unitValue = 0;
  let count = 0;
  for (const ref of refs) {
    if (ref.startsWith('carved:')) {
      const i = Number(ref.slice(7));
      if (state.carved?.[i] && !carved.has(i)) {
        carved.add(i);
        unitValue += resolveRune(state.carved[i]).value;
        count += 1;
      }
    } else {
      const qty = state.runes[ref] ?? 0;
      if (qty > 0 && !catalogue.includes(ref)) {
        catalogue.push(ref);
        unitValue += (RUNES[ref]?.value ?? 1) * qty;
        count += qty;
      }
    }
  }
  return { unitValue, count, catalogue, carvedDesc: [...carved].sort((a, b) => b - a) };
}

function applyRuneBatch(state: GameState, plan: ReturnType<typeof planRuneBatch>): void {
  for (const ref of plan.catalogue) delete state.runes[ref];
  for (const i of plan.carvedDesc) state.carved.splice(i, 1);
}

/** Sell many loose runes at once (catalogue piles whole, carvings one each). */
export function sellRunesBatch(state: GameState, bus: EventBus, refs: string[]): number {
  const plan = planRuneBatch(state, refs);
  if (plan.count === 0) return 0;
  const price = Math.max(plan.count, Math.round(plan.unitValue * getDerivedStats(state).goldGain));
  applyRuneBatch(state, plan);
  state.gold += price;
  bumpStat(state, bus, 'gold:earned', price);
  bus.emit({
    type: 'log',
    msg: text('runes.sold_many', { count: plan.count, plural: plan.count === 1 ? '' : 's', price }),
    kind: 'item',
  });
  return price;
}

/** Dump many loose runes at once. */
export function discardRunesBatch(state: GameState, bus: EventBus, refs: string[]): number {
  const plan = planRuneBatch(state, refs);
  if (plan.count === 0) return 0;
  applyRuneBatch(state, plan);
  bus.emit({
    type: 'log',
    msg: text('runes.discarded_many', { count: plan.count, plural: plan.count === 1 ? '' : 's' }),
    kind: 'info',
  });
  return plan.count;
}

/** Add runes to the owned pool (loot drops, crafting, unsocketing). */
export function grantRune(state: GameState, bus: EventBus, runeId: string, qty = 1, silent = false): void {
  state.runes[runeId] = (state.runes[runeId] ?? 0) + qty;
  if (!silent) {
    const rune = RUNES[runeId];
    bus.emit({
      type: 'log',
      msg: text('runes.found', {
        icon: rune?.icon ?? '🔮',
        name: rune?.name ?? runeId,
        qty: qty > 1 ? text('common.times', { qty }) : '',
      }),
      kind: 'loot',
    });
  }
}

/**
 * Typed on-hit damage granted by the equipped weapon's socketed runes. Each
 * bonus carries the rune it came from, so a damage tooltip can name it.
 */
/**
 * Graph-surgery mods the socketed weapon's runes apply to ONE technique
 * (see docs/MARTIAL.md §9 — a rune may rewrite a node, never an edge list).
 */
export function weaponTechniqueMods(
  state: GameState,
  techniqueId: string,
): RuneTechniqueMod[] {
  const weapon = state.equipment.weapon;
  if (!weapon) return [];
  const out: RuneTechniqueMod[] = [];
  for (const ref of weapon.runes ?? []) {
    for (const m of resolveRune(ref).effects.weapon?.techniqueMods ?? []) {
      if (m.technique === techniqueId) out.push(m);
    }
  }
  return out;
}

/**
 * On-hit rune riders from the weapon in `slot` — the main hand unless asked
 * otherwise, because a blade the mind is holding out at arm's length carries
 * its OWN runes, not the ones cut into whatever is in your fist.
 */
export function weaponRuneBonuses(
  state: GameState,
  slot: SlotId = 'weapon',
): { flat: RuneDamageBonus[]; pct: RuneDamageBonus[] } {
  const weapon = state.equipment[slot];
  const flat: RuneDamageBonus[] = [];
  const pct: RuneDamageBonus[] = [];
  if (!weapon) return { flat, pct };
  for (const ref of weapon.runes ?? []) {
    const rune = resolveRune(ref);
    const effect = rune.effects.weapon;
    const source = rune.name;
    if (effect?.bonusDamage) flat.push({ ...effect.bonusDamage, source });
    if (effect?.bonusDamagePct) pct.push({ ...effect.bonusDamagePct, source });
  }
  return { flat, pct };
}

/** A rune's on-hit damage rider, labelled with the rune that granted it. */
export interface RuneDamageBonus {
  type: string;
  value: number;
  source: string;
}
