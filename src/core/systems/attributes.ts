import type {
  AttributeId,
  GameState,
  ItemInstance,
  LevelCurveId,
  Modifier,
  StatKey,
  ModOrigin,
  ModTarget,
  SlotId,
  SuperAttributeDef,
  SuperAttributeId,
} from '../types';
import { runeContextFor } from '../types';
import { sizeFit, wieldScale } from './wield';
import { sizeRank } from '../types';
import { fieldHunger, statusMods } from './statuses';
// Mutual with mutagens.ts, which reads `attrValue` from here. Safe the same way
// derived.ts's mutual is: neither side touches the other at module-evaluation
// time, only from inside functions.
import { fastGuard, fastOf } from './mutagens';
import { resolveRune } from './runes';
import { ATTRIBUTE_LIST, ATTRIBUTE_TRAINING } from '../data/attributes.data';
import { ATTRIBUTE_PROGRESSION } from '../data/progression.data';
import { bandedXpNeeded, settleLevels } from './progression';
import type { EventBus } from '../engine/events';
import { ACHIEVEMENTS, ITEMS, SKILLS, SUPERATTRS, TITLES } from '../registry';
import { endowmentBonus, talentBonus } from './legacy';

// ---------- Training (the skill-like base layer) ----------

/**
 * Attribute training rides the same banded curve as skills: the base cost steps
 * up as the attribute earns each named training rank, at an unchanging pace.
 * See ATTRIBUTE_PROGRESSION and systems/progression.ts.
 */
export function attrXpNeeded(level: number): number {
  return bandedXpNeeded(ATTRIBUTE_PROGRESSION, level);
}

/** Training and combat raise the TRAINED base level; bonuses never gain XP. */
export function grantAttrXp(state: GameState, bus: EventBus, attr: AttributeId, amount: number): void {
  const a = state.attrs[attr];
  a.xp += amount;
  const gained = settleLevels(a, ATTRIBUTE_PROGRESSION);
  for (let i = gained; i > 0; i--) {
    bus.emit({ type: 'attr:levelup', attr, level: a.level - i + 1 });
  }
}

/**
 * Spread one payout across several attributes, e.g. `{ cha: 0.5, str: 0.25 }`.
 * Weights scale `amount` independently — they are multipliers, not shares of a
 * fixed pool, so nothing is normalized and a total above 1 is legal content.
 */
export function grantAttrXpSplit(
  state: GameState,
  bus: EventBus,
  weights: Partial<Record<AttributeId, number>>,
  amount: number,
): void {
  for (const [attr, weight] of Object.entries(weights) as [AttributeId, number][]) {
    if (weight) grantAttrXp(state, bus, attr, amount * weight);
  }
}

// ---------- Modifier foundations (shared by attributes and derived stats) ----------

export function equippedTags(state: GameState): Set<string> {
  const tags = new Set<string>();
  for (const item of Object.values(state.equipment)) {
    if (!item) continue;
    for (const t of ITEMS[item.defId]?.tags ?? []) tags.add(t);
  }
  // Pseudo-tag: bare-handed counts as wielding 'unarmed'.
  if (!state.equipment.weapon) tags.add('unarmed');
  return tags;
}

// Memo of the resistTiered curve: index = level, value = total fraction
// blocked. Grown on demand — levels have no ceiling, so neither does this.
const resistBlocked: number[] = [0];

function resistTiered(level: number): number {
  const lv = Math.max(0, Math.floor(level));
  for (let i = resistBlocked.length; i <= lv; i++) {
    const step = i % 25 === 0 ? 0.1 : i % 10 === 0 ? 0.05 : i % 5 === 0 ? 0.03 : 0.01;
    resistBlocked[i] = 1 - (1 - resistBlocked[i - 1]) * (1 - step);
  }
  return resistBlocked[lv];
}

export const LEVEL_CURVES: Record<LevelCurveId, (level: number) => number> = {
  resistTiered,
};

/** Resolve a modifier's effective value given its source level (skill level etc.). */
export function resolveModValue(mod: Modifier, level = 0): number {
  const linear = mod.value + (mod.perLevel ?? 0) * level;
  return mod.levelCurve ? linear + LEVEL_CURVES[mod.levelCurve](level) : linear;
}

export interface ResolvedMod {
  stat: ModTarget;
  op: 'add' | 'mult';
  value: number;
  /** Human-readable origin, for stat tooltips ("Iron Sword", "Fighting Lv 12", ...). */
  source?: string;
  /**
   * Machine-readable origin. `source` is a label; this is what code tests
   * against when something needs to act on a CLASS of modifier — a chill that
   * dulls your weapon's bonuses has to find them without matching on names.
   */
  origin?: ModOrigin;
  /** Carried through from the Modifier: exempt from condition damping. */
  undampened?: boolean;
  /**
   * Carried through from the Modifier: this value is scaled by whatever
   * `fromStat` finally reads, in a pass after every other modifier.
   */
  fromStat?: StatKey;
}

const TIER_NUMERALS = ['I', 'II', 'III', 'IV', 'V'];

// Origins with no slot to speak of, hoisted so the hot path doesn't rebuild them.
const ACHIEVEMENT: ModOrigin = { kind: 'achievement' };
const SKILL: ModOrigin = { kind: 'skill' };
const TRAINING: ModOrigin = { kind: 'training' };
const TITLE: ModOrigin = { kind: 'title' };
const BUFF: ModOrigin = { kind: 'buff' };

const ATTR_IDS: ReadonlySet<string> = new Set(ATTRIBUTE_LIST.map((a) => a.id));

/**
 * An attribute's display name. Lives here, with the attributes, because three
 * modules had privately reinvented it — and a card that prices a blow off your
 * Charisma must call it exactly what the pricer called it.
 */
export function attrName(id: AttributeId): string {
  return ATTRIBUTE_LIST.find((a) => a.id === id)?.name ?? id;
}

export function isAttrTarget(target: ModTarget): target is AttributeId {
  return ATTR_IDS.has(target);
}

/**
 * Every permanent/temporary modifier source EXCEPT combat styles: equipment
 * (+affixes), achievement tiers, passive skills (scaled by their level),
 * attribute training ranks, and combat buffs. Styles are layered on in
 * derived.ts (they may only target derived stats — that rule keeps this
 * module free of style/condition imports).
 *
 * `styleId` is the style being fought in, supplied by the caller for the same
 * reason: modifiers gated with `requiresStyle` (a school's mastery bonus) need
 * it, and lapse when it is absent. Attribute-only callers may omit it — no
 * style-gated modifier targets an attribute.
 */
export function collectBaseMods(
  state: GameState,
  styleId?: string,
  vsTags?: ReadonlySet<string>,
  /**
   * The wielder's size on SIZE_LADDER, for armour that has to FIT. Passed in
   * rather than read here so this module never has to know about chromosomes;
   * absent means person-sized, which is what every caller but the stat pipeline
   * wants anyway.
   */
  wielderRank = sizeRank('medium'),
): ResolvedMod[] {
  const out: ResolvedMod[] = [];
  const wielding = equippedTags(state);
  const push = (mod: Modifier, source: string, origin: ModOrigin, level = 0, scale = 1) => {
    if (mod.requiresTag && !wielding.has(mod.requiresTag)) return;
    if (mod.requiresStyle && mod.requiresStyle !== styleId) return;
    // Target-gated bonuses are absent from the global block (no `vsTags`) and
    // present only against a monster carrying the tag.
    if (mod.requiresMonsterTag && !vsTags?.has(mod.requiresMonsterTag)) return;
    out.push({
      stat: mod.stat,
      op: mod.op,
      value: resolveModValue(mod, level) * scale,
      source,
      origin,
      // Carried through, not re-derived: whether a bonus is part of the
      // fighter is a property of the modifier itself, and damping asks later.
      ...(mod.undampened ? { undampened: true } : {}),
    });
  };

  /** What the OTHER hand is carrying — hand bonuses ask about the pairing. */
  const tagsIn = (slot: SlotId): Set<string> => {
    const held = state.equipment[slot];
    return new Set(held ? (ITEMS[held.defId]?.tags ?? []) : []);
  };

  for (const [slot, item] of Object.entries(state.equipment) as [SlotId, ItemInstance][]) {
    if (!item) continue;
    const def = ITEMS[item.defId];
    if (!def) continue;
    const label = item.affix ? `${item.affix.name} ${def.name}` : def.name;
    // A piece held somewhere it wasn't made for gives only part of itself —
    // and so does one built for a body a different size. Armour that does not
    // fit is barely armour; a weapon's size problem is a separate matter of
    // speed and damage, so `sizeFit` leaves weapons alone.
    const fit = wieldScale(def, slot) * sizeFit(item, slot, wielderRank);
    for (const m of def.mods) push(m, label, { kind: 'item', slot }, 0, fit);
    if (item.affix) for (const m of item.affix.mods) push(m, label, { kind: 'affix', slot }, 0, fit);
    // Socketed runes grant the effect matching this item's context.
    const context = runeContextFor(def.slot);
    for (const ref of item.runes ?? []) {
      const rune = resolveRune(ref);
      for (const m of rune.effects[context]?.mods ?? []) {
        push(m, `${rune.name} (${def.name})`, { kind: 'rune', slot }, 0, fit);
      }
    }
    // Hand bonuses: full strength, and only for the hand they name.
    const bonus = slot === 'weapon' ? def.mainHand : slot === 'offhand' ? def.offHand : undefined;
    const paired = !bonus?.pairedWith || tagsIn(slot === 'weapon' ? 'offhand' : 'weapon').has(bonus.pairedWith);
    if (bonus && paired) {
      const hand = slot === 'weapon' ? 'main hand' : 'off hand';
      for (const m of bonus.mods) push(m, `${label} (${hand})`, { kind: 'handBonus', slot });
    }
  }

  for (const [id, tiersClaimed] of Object.entries(state.achievements)) {
    const def = ACHIEVEMENTS[id];
    if (!def) continue;
    for (let i = 0; i < tiersClaimed && i < def.tiers.length; i++) {
      for (const m of def.tiers[i].bonus) push(m, `${def.name} ${TIER_NUMERALS[i] ?? i + 1}`, ACHIEVEMENT);
    }
  }

  for (const [id, s] of Object.entries(state.skills)) {
    const def = SKILLS[id];
    if (!def) continue;
    // Talent (prestige boon): a skill a past run carried far has its effects
    // scaled up — the one legacy that touches the stat block, so it also
    // sits in modFingerprint (derived.ts).
    const talent = talentBonus(state, id);
    const label = talent > 0 ? `${def.name} Lv ${s.level} (talent +${(talent * 100).toFixed(2)}%)` : `${def.name} Lv ${s.level}`;
    for (const m of def.effects ?? []) push(m, label, SKILL, s.level, 1 + talent);
    // Milestones are unscaled and cumulative, exactly like the training ones
    // below; the list is sorted, so the first unreached level ends the run.
    for (const milestone of def.milestones ?? []) {
      if (s.level < milestone.level) break;
      for (const m of milestone.bonus) push(m, `${def.name} milestones`, SKILL);
    }
  }

  // Training rank + milestone bonuses (cumulative). Both read the TRAINED base
  // level, so even attribute-targeted bonuses can never feed back into their
  // own threshold.
  for (const a of ATTRIBUTE_LIST) {
    const trained = state.attrs[a.id].level;
    const training = ATTRIBUTE_TRAINING[a.id];
    for (const rank of training.tierNames) {
      if (trained < rank.level) break;
      for (const m of rank.bonus ?? []) push(m, rank.name, TRAINING);
    }
    for (const milestone of training.milestones ?? []) {
      if (trained < milestone.level) break;
      // One shared label so tooltips can group all milestones into one line.
      for (const m of milestone.bonus) push(m, `${training.name} milestones`, TRAINING);
    }
  }

  // Titles: passive bonuses from every earned title, plus the worn title's
  // equipped bonuses.
  for (const id of state.titles) {
    for (const m of TITLES[id]?.passive ?? []) push(m, `Title: ${TITLES[id]!.name}`, TITLE);
  }
  if (state.title) {
    for (const m of TITLES[state.title]?.equipped ?? []) {
      push(m, `Title: ${TITLES[state.title]!.name} (worn)`, TITLE);
    }
  }

  if (state.combat) {
    for (const buff of state.combat.buffs) {
      for (const m of buff.mods) push(m, `Buff: ${buff.name}`, BUFF);
    }
  }

  // Afflictions. Their values are already scaled by intensity, so they go
  // through push at face value like any other source.
  /*
   * A fast dulls what afflictions DO to you, in proportion to the hunger loose
   * in the fight. Only penalties: a condition doing you a favour goes on doing
   * it at full strength.
   *
   * ⚠️ "Penalty" is approximated as a negative value, which is right for every
   * condition mod in the game today. It does NOT catch the stats where a
   * positive value is the bad one — `damageTaken`, `critTaken`, `stumbleTaken`
   * — so a condition leaning on that lane would bite a fasting body in full.
   * Revisit if one ever does; there is no "is this bad" flag on Modifier to
   * read instead.
   */
  const fast = fastOf(state);
  const ward = fast ? fastGuard(state, fieldHunger(state)).ward : 0;
  for (const { mod, source, origin } of statusMods(state)) {
    const dulled = ward > 0 && mod.value < 0 ? { ...mod, value: mod.value * (1 - ward) } : mod;
    push(dulled, source, origin);
  }

  return out;
}

// ---------- Effective attributes (the modifiable stat layer) ----------

/**
 * Effective attribute values: trained base + attribute-targeted modifiers
 * (adds, then mults), floored at 1. Fractional internally; the UI rounds.
 */
export function effectiveAttrsFrom(
  state: GameState,
  mods: ResolvedMod[],
): Record<AttributeId, number> {
  const eff = {} as Record<AttributeId, number>;
  for (const a of ATTRIBUTE_LIST) eff[a.id] = state.attrs[a.id].level;
  for (const m of mods) {
    if (m.op === 'add' && isAttrTarget(m.stat)) eff[m.stat] += m.value;
  }
  for (const m of mods) {
    if (m.op === 'mult' && isAttrTarget(m.stat)) eff[m.stat] *= 1 + m.value;
  }
  // Endowment (prestige boon, talent's twin): the last pass, over everything
  // the run has added — a legacy that scales the whole attribute, the way
  // talent scales the whole of a skill's effects. In modFingerprint too.
  for (const a of ATTRIBUTE_LIST) eff[a.id] *= 1 + endowmentBonus(state, a.id);
  for (const a of ATTRIBUTE_LIST) eff[a.id] = Math.max(1, eff[a.id]);
  return eff;
}

export function effectiveAttrs(state: GameState): Record<AttributeId, number> {
  return effectiveAttrsFrom(state, collectBaseMods(state));
}

export function effectiveAttr(state: GameState, attr: AttributeId): number {
  return effectiveAttrs(state)[attr];
}

// ---------- Super-attribute resolution (fusion over EFFECTIVE values) ----------

const SUPER_BY_COMPONENT: Partial<Record<AttributeId, SuperAttributeDef>> = {};
for (const def of Object.values(SUPERATTRS)) {
  for (const comp of def.components) SUPER_BY_COMPONENT[comp] = def;
}

export function superFor(attr: AttributeId): SuperAttributeDef | undefined {
  return SUPER_BY_COMPONENT[attr];
}

export function isFused(state: GameState, id: SuperAttributeId): boolean {
  return state.fused.includes(id);
}

/** Fusion-aware read over a precomputed effective-attribute map. */
export function attrValueFrom(
  state: GameState,
  eff: Record<AttributeId, number>,
  attr: AttributeId,
): number {
  const sup = superFor(attr);
  if (sup && isFused(state, sup.id)) {
    return eff[sup.components[0]] + eff[sup.components[1]];
  }
  return eff[attr];
}

/**
 * The effective value of an attribute for ALL checks and calculations:
 * trained base + every bonus (equipment, skills, achievements, buffs, future
 * titles), with fused super-attributes reading as the sum of both components.
 */
export function attrValue(state: GameState, attr: AttributeId): number {
  return attrValueFrom(state, effectiveAttrs(state), attr);
}

// ---------- Tooltip breakdowns ----------

export interface BreakdownLine {
  source: string;
  op: 'add' | 'mult';
  value: number;
}

/** Merge resolved mods into one line per (source, op) — adds sum, mults compound. */
export function groupModLines(mods: ResolvedMod[]): BreakdownLine[] {
  const groups = new Map<string, BreakdownLine>();
  for (const m of mods) {
    const source = m.source ?? 'Other';
    const key = `${m.op}:${source}`;
    const g = groups.get(key);
    if (!g) groups.set(key, { source, op: m.op, value: m.value });
    else g.value = m.op === 'add' ? g.value + m.value : (1 + g.value) * (1 + m.value) - 1;
  }
  return [...groups.values()].sort((a, b) => (a.op === b.op ? 0 : a.op === 'add' ? -1 : 1));
}

export interface AttrBreakdown {
  trained: number;
  lines: BreakdownLine[];
  effective: number;
  /** Endowment's multiplier as a fraction (0.05 = ×1.05), when any applies. */
  endowment?: number;
  /** Present when this attribute is a fused super-attribute component. */
  fusion?: { name: string; partner: AttributeId; partnerValue: number; total: number };
}

/** Everything contributing to one attribute's effective value, for tooltips. */
export function attrBreakdown(state: GameState, attr: AttributeId): AttrBreakdown {
  const mods = collectBaseMods(state);
  const eff = effectiveAttrsFrom(state, mods);
  const lines = groupModLines(mods.filter((m) => m.stat === attr));
  const result: AttrBreakdown = {
    trained: state.attrs[attr].level,
    lines,
    effective: eff[attr],
  };
  const endowment = endowmentBonus(state, attr);
  if (endowment > 0) result.endowment = endowment;
  const sup = superFor(attr);
  if (sup && isFused(state, sup.id)) {
    const partner = sup.components[0] === attr ? sup.components[1] : sup.components[0];
    result.fusion = {
      name: sup.name,
      partner,
      partnerValue: eff[partner],
      total: eff[attr] + eff[partner],
    };
  }
  return result;
}