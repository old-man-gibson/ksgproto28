import type { GameState, ItemDef, ItemInstance, SlotId, WieldClass } from '../types';
import { ITEMS, SKILLS } from '../registry';
import { sizeRank } from '../types';

/**
 * How held gear occupies your hands, and what it costs to hold something where
 * it doesn't belong. Kept free of other systems so both the equipment commands
 * and the modifier pipeline can read it.
 */

/**
 * Attack speed lost per size step a held weapon is too big for its wielder.
 *
 * The game used to assert that every weapon fits — greatswords carried a flat
 * `attackSpeed` cost and that was the whole story. This says something more
 * specific and more interesting: the hammer is not slow, it is too big FOR YOU.
 * A gargantuan hammer is glacial in person-sized hands and ordinary in a
 * jötunn's, which is a real reason to be enormous rather than a stat bonus
 * wearing the word "large".
 *
 * Undersized costs nothing. A dagger in a giant's fist is still a dagger.
 */
export const OVERSIZE_SPEED_PER_STEP = 0.18;

/**
 * Damage lost per size step a held weapon is too SMALL for its wielder.
 *
 * The mirror of the above, and deliberately a different currency: an oversized
 * weapon is awkward (slow), an undersized one is simply not carrying enough
 * metal to matter (weak). A giant swinging a person's dagger is quick with it
 * and it does nothing.
 */
export const UNDERSIZE_DAMAGE_PER_STEP = 0.22;

/**
 * How much of itself a piece of ARMOUR gives when it does not fit.
 *
 * Far harsher than either weapon penalty, and in both directions, because
 * armour that does not fit is not awkward — it is not armour. One step off is
 * most of the way to worthless and two steps is worthless outright.
 *
 * That is deliberate rather than punishing: it turns a giant's breastplate into
 * something you cannot wear but can still *use* — material for the home base
 * and the workers built there. Loot that is useless to you personally becoming
 * an input to something else is the point, not a consolation.
 */
export const ARMOR_SIZE_FIT_PER_STEP = 0.65;

/**
 * How far practice alone can carry an oversized weapon, by wield class.
 *
 * The quiet multiplier behind swinging big things: a fighter who spends their
 * life heaving greatswords learns to heave a bigger one. It caps rather than
 * scales because there is a point past which technique is not the problem —
 * you can grow into a HUGE dagger with enough practice, and a LARGE greatsword,
 * and no further.
 *
 * That leaves the gigantoid line two honest roles rather than one: a shortcut
 * for anyone who has not put the levels in, and a way past the ceiling for
 * anyone who has — because size raises the baseline instead of forgiving the
 * gap, so the two stack without either being redundant.
 */
export const OVERSIZE_FORGIVENESS_CAP: Record<WieldClass, number> = {
  light: 0.9,
  one_handed: 0.9,
  // A greatsword you have outgrown is still a greatsword. Half the penalty
  // forgiven makes LARGE comfortable and leaves HUGE a real decision.
  two_handed: 0.5,
  offhand: 0.5,
};

/**
 * What one milestone of the governing weapon skill forgives, and how often one
 * arrives. Kept here rather than in the skill data so the milestone text and
 * the arithmetic cannot drift — a milestone reading "5% reduced penalty for
 * using oversized weapons" is describing exactly this.
 */
export const OVERSIZE_FORGIVENESS_PER_MILESTONE = 0.05;
export const OVERSIZE_MILESTONE_LEVELS = 10;

/** Effect lost by holding a main-hand weapon in the off hand. */
export const OFF_HAND_PENALTY = 0.4;
/** Effect lost by forcing an off-hand item into the main hand. */
export const MAIN_HAND_PENALTY = 0.25;

export const WIELD_NAMES: Record<WieldClass, string> = {
  light: 'Light',
  one_handed: 'One-handed',
  two_handed: 'Two-handed',
  offhand: 'Off-hand',
};

/**
 * Every hand a body could have, in order. Index 0 is the main hand and
 * everything after it is an off hand — which is the whole rule for the grown
 * ones, so `wieldScale` needs no case for them.
 *
 * A body only *has* `armsFrom(grants)` of these; the list is the ceiling, not
 * the count. Callers that care about what is actually available ask `armsFrom`.
 */
export const HAND_SLOTS: SlotId[] = ['weapon', 'offhand', 'hand3', 'hand4', 'hand5', 'hand6'];

/** How an item is wielded — inferred from its slot when it doesn't say. */
export function wieldOf(def: ItemDef): WieldClass {
  return def.wield ?? (def.slot === 'offhand' ? 'offhand' : 'one_handed');
}

/**
 * How well an item works in a given slot: 1 = exactly where it belongs, a
 * fraction = usable but awkward, 0 = it cannot go there at all. Everything the
 * piece contributes (its mods, its affix, its runes) is scaled by this.
 */
export function wieldScale(def: ItemDef, slot: SlotId): number {
  if (!HAND_SLOTS.includes(slot)) return def.slot === slot ? 1 : 0;
  // Only hand gear may occupy a hand.
  if (!HAND_SLOTS.includes(def.slot)) return 0;
  const wield = wieldOf(def);
  if (slot === 'weapon') {
    // An off-hand piece built to be used forward (a punched buckler) pays nothing.
    return wield === 'offhand' && !def.mainHand ? 1 - MAIN_HAND_PENALTY : 1;
  }
  if (wield === 'two_handed') return 0;
  return wield === 'one_handed' ? 1 - OFF_HAND_PENALTY : 1;
}

/**
 * Slots this item may be placed in, best fit first.
 *
 * `arms` bounds it to the hands a body actually has — an ordinary two-armed
 * player must never be offered a fifth hand to put a dagger in. Defaults to
 * BASE_ARMS so a caller that has no grant set on hand cannot accidentally
 * promise more than everyone has.
 */
export function allowedSlots(def: ItemDef, arms: number = BASE_ARMS): SlotId[] {
  if (!HAND_SLOTS.includes(def.slot)) return [def.slot];
  return HAND_SLOTS.slice(0, Math.max(BASE_ARMS, arms))
    .filter((s) => wieldScale(def, s) > 0)
    .sort((a, b) => wieldScale(def, b) - wieldScale(def, a));
}

/**
 * The weapon currently leaving you no hand to spare, if any.
 *
 * ⚠️ "Two-handed" is a property of the WEAPON; "no hand free" is a property of
 * the BODY, and they stopped being the same thing the moment genes could grow
 * arms or lighten a grip. A gigantoid holds a greatsword in one hand and an
 * asura has arms left over either way — so the question this answers has to be
 * how many arms are actually free, never what the weapon is called.
 *
 * Takes the grant set rather than reading it, like every other helper here, so
 * equipment rules never learn where a capability came from.
 */
export function twoHandedWeapon(
  state: GameState,
  grants: ReadonlySet<string>,
): ItemInstance | null {
  const weapon = state.equipment.weapon;
  const def = weapon ? ITEMS[weapon.defId] : undefined;
  if (!def || wieldOf(def) !== 'two_handed') return null;
  return armsFrom(grants) - armsUsed(state, grants) >= 1 ? null : weapon!;
}

/**
 * The two-hander that has taken `slot`, when `slot` is a hand it is occupying.
 * Null for every slot that is not a hand, and for a hand that is still free.
 *
 * ⚠️ THIS EXISTS BECAUSE THE RULE WAS INLINE IN A TEMPLATE AND GOT IT WRONG.
 * The equipment panel asked `slot === 'weapon' ? null : twoHandedWeapon(...)`,
 * which exempts the main hand and nothing else — so a greatsword blocked the
 * helmet, the boots and the ring, and the panel `disabled` all of them. A body
 * with no hand free has no hand free; it has not stopped having a head.
 *
 * A rule about what a wield costs belongs with the other wield rules, where it
 * can be tested, rather than in the one place that happens to draw it.
 */
export function handTakenBy(
  state: GameState,
  grants: ReadonlySet<string>,
  slot: SlotId,
): ItemInstance | null {
  // The main hand is where the two-hander IS, so it is never a hand it stole.
  if (!HAND_SLOTS.includes(slot) || slot === 'weapon') return null;
  return twoHandedWeapon(state, grants);
}

/** Hands an ordinary body has. Everything else is measured against this. */
export const BASE_ARMS = 2;

/**
 * How many arms a body has: the usual two, plus whatever it grew.
 *
 * `arms:+N` is the asuroid line's whole identity, and it is deliberately a
 * COUNT rather than a permission. Three arms is "a spear and a shield" without
 * anyone writing a rule for that combination, and six is three two-handers —
 * an asura rana's four extra arms need no new concept, only a bigger number.
 */
export function armsFrom(grants: ReadonlySet<string>): number {
  let arms = BASE_ARMS;
  for (const g of grants) {
    if (g.startsWith('arms:+')) arms += Number(g.slice(6)) || 0;
  }
  return arms;
}

/**
 * Grips held by the MIND rather than by a hand.
 *
 * The third capability, and orthogonal to the other two the same way they are
 * to each other: `arms:+N` says how many grips a body has, `onehand:*` says
 * what a grip can close around, and `telekinetic:N` says that N of those grips
 * are not hands at all.
 *
 * ⚠️ It is deliberately NOT a gene-only concept. A fighting style that lifts a
 * blade with the mind grants the same string and gets the same behaviour, which
 * is the whole reason it lives here with the other wield rules rather than in
 * mutagens.ts — nothing downstream may learn where the capability came from.
 */
export function telekineticFrom(grants: ReadonlySet<string>): number {
  let n = 0;
  for (const g of grants) {
    if (g.startsWith('telekinetic:')) n += Number(g.slice(12)) || 0;
  }
  return n;
}

/** Grips that are still hands. Never negative: six floats on two arms is zero. */
export function handsFrom(grants: ReadonlySet<string>): number {
  return Math.max(0, armsFrom(grants) - telekineticFrom(grants));
}

/**
 * Whether this grip is one the mind holds.
 *
 * The floating grips are the LAST ones a body has, which is the reading that
 * makes a partial grant behave the way a player would guess: one point of
 * telekinesis on an ordinary body floats the off hand and leaves the main hand
 * swinging, rather than the other way round.
 */
export function isTelekinetic(grants: ReadonlySet<string>, slot: SlotId): boolean {
  const i = HAND_SLOTS.indexOf(slot);
  return i >= 0 && i >= handsFrom(grants) && i < armsFrom(grants);
}

/** Occupied floating grips, in slot order — what actually goes and fights. */
export function floatingSlots(state: GameState, grants: ReadonlySet<string>): SlotId[] {
  return HAND_SLOTS.filter((s) => state.equipment[s] && isTelekinetic(grants, s));
}

/** Grips holding something at all, floating or not — the share denominator. */
export function heldGrips(state: GameState, grants: ReadonlySet<string>): number {
  const arms = armsFrom(grants);
  return HAND_SLOTS.filter((s, i) => i < arms && state.equipment[s]).length;
}

/**
 * The share of your weapon damage your HANDS still swing, 0..1.
 *
 * Everything a body holds contributes to one `damage` stat, so moving weapons
 * onto their own clocks has to move their share of that stat with them or the
 * same blade pays out twice. Both ends read this one function: the bar swing
 * scales by it, and each floating grip lands `1 / heldGrips` of the whole.
 *
 * Zero means the hands are holding nothing — which is Vashkara's whole posture,
 * and the reason the bar has to find something else to do.
 */
export function handSwingShare(state: GameState, grants: ReadonlySet<string>): number {
  // A body with no hands does not punch. This is where "no unarmed attacks
  // either" lives — as a consequence of having no hands, not as a rule about
  // one gene, so anything else that takes the hands away inherits it.
  if (handsFrom(grants) === 0) return 0;
  const held = heldGrips(state, grants);
  if (held === 0) return 1; // Bare-handed: the fists ARE the weapon, and they are yours.
  return (held - floatingSlots(state, grants).length) / held;
}

/**
 * Arms this piece occupies.
 *
 * The second capability, and orthogonal to the first: a gigantoid does not grow
 * arms, it makes a two-hander cost ONE of the two it has. Keeping them separate
 * is what lets a giant with an asura's gene do both — six arms, each holding a
 * greatsword — instead of the two capabilities quietly meaning the same thing.
 *
 * Matched on the item's TAGS, so `onehand:greatsword` is a statement about a
 * family and `onehand:*` about anything you can lift.
 */
export function armCost(grants: ReadonlySet<string>, def: ItemDef, slot?: SlotId): number {
  if (wieldOf(def) !== 'two_handed') return 1;
  // A mind has no second hand to run out of. "Two-handed" is a statement about
  // hands, so in a grip that is not one it simply does not apply — which is how
  // an asura holding six greatswords aloft costs six grips and not twelve.
  if (slot && isTelekinetic(grants, slot)) return 1;
  if (grants.has('onehand:*')) return 1;
  return (def.tags ?? []).some((t) => grants.has(`onehand:${t}`)) ? 1 : 2;
}

/** Whether this piece leaves a hand free — i.e. costs less than everything. */
export function canOneHand(grants: ReadonlySet<string>, def: ItemDef): boolean {
  return armCost(grants, def) < BASE_ARMS;
}

/** Arms currently spoken for by what is held. */
export function armsUsed(state: GameState, grants: ReadonlySet<string>): number {
  let used = 0;
  for (const slot of HAND_SLOTS) {
    const worn = state.equipment[slot];
    const def = worn ? ITEMS[worn.defId] : undefined;
    if (def) used += armCost(grants, def, slot);
  }
  return used;
}

/** How big this particular piece is. Absent reads as person-sized. */
export function itemSizeRank(item: ItemInstance | undefined | null): number {
  return sizeRank(item?.size);
}

/**
 * Size steps the held weapon is TOO BIG for a wielder of `wielderRank`.
 *
 * One direction only: being handed something small is not a problem, and a
 * signed gap would have quietly made a giant's dagger *faster* than a person's.
 */
/**
 * Steps of oversize this wielder has learned to ignore for the weapon in hand.
 *
 * Read straight off the skill rather than through a derived stat, deliberately:
 * the penalty is emitted DURING modifier collection, so anything it depends on
 * has to be knowable before the stat pipeline runs. Size has the same property
 * — it comes off the chromosome, not off a stat — which is why both sources
 * work here and neither needed a stat inventing for it.
 */
/**
 * The skill that governs a weapon family, found by what a skill CLAIMS rather
 * than by guessing its id.
 *
 * Weapon skills are not named to a pattern — `swordsmanship` was written years
 * before `greatsword_combat` — so deriving an id from a tag silently misses
 * whichever ones were named differently. They all declare their family in
 * `tags` though, and the martial schools stay out of the way by tagging
 * `style:*`, which makes the family tag unambiguous.
 *
 * Memoised: skills are static content and this is read on every stat build.
 */
const FAMILY_SKILL = new Map<string, string>();

export function familySkillFor(tag: string): string | undefined {
  if (FAMILY_SKILL.size === 0) {
    for (const skill of Object.values(SKILLS)) {
      if (skill.category !== 'combat') continue;
      for (const t of skill.tags ?? []) {
        if (t !== 'combat' && !FAMILY_SKILL.has(t)) FAMILY_SKILL.set(t, skill.id);
      }
    }
  }
  return FAMILY_SKILL.get(tag);
}

export function oversizeForgiveness(state: GameState): number {
  const weapon = state.equipment.weapon;
  const def = weapon ? ITEMS[weapon.defId] : undefined;
  if (!def) return 0;
  let level = 0;
  for (const tag of def.tags ?? []) {
    const skill = familySkillFor(tag);
    if (skill) level = Math.max(level, state.skills[skill]?.level ?? 0);
  }
  const earned = Math.floor(level / OVERSIZE_MILESTONE_LEVELS) * OVERSIZE_FORGIVENESS_PER_MILESTONE;
  return Math.min(OVERSIZE_FORGIVENESS_CAP[wieldOf(def)], earned);
}

/**
 * How much oversize the held weapon actually costs, in steps, after what
 * practice forgives.
 *
 * One direction only: a signed gap would have quietly made a giant's dagger
 * *faster* than a person's. Fractional on purpose — forgiveness shaves the
 * penalty smoothly rather than cancelling whole steps, so a milestone is felt
 * the moment it lands instead of at some invisible threshold.
 */
export function oversizeSteps(state: GameState, wielderRank: number): number {
  const raw = Math.max(0, itemSizeRank(state.equipment.weapon) - wielderRank);
  return raw * (1 - oversizeForgiveness(state));
}

/** Size steps the held weapon is too SMALL for a wielder of `wielderRank`. */
export function undersizeSteps(state: GameState, wielderRank: number): number {
  const weapon = state.equipment.weapon;
  return weapon ? Math.max(0, wielderRank - itemSizeRank(weapon)) : 0;
}

/**
 * How much of itself a piece gives at this wielder's size, 0–1.
 *
 * Weapons always return 1: theirs is a damage or a speed problem, not a "does
 * this do anything" problem, and they are handled separately. Armour is the
 * opposite — the wrong size in either direction guts it.
 */
export function sizeFit(item: ItemInstance, slot: SlotId, wielderRank: number): number {
  if (slot === 'weapon') return 1;
  const gap = Math.abs(itemSizeRank(item) - wielderRank);
  return Math.max(0, 1 - ARMOR_SIZE_FIT_PER_STEP * gap);
}

/** Why an item is at less than full effect where it sits, for tooltips. */
export function wieldNote(def: ItemDef, slot: SlotId): string {
  const scale = wieldScale(def, slot);
  if (scale >= 1) return '';
  return `${WIELD_NAMES[wieldOf(def)]} in the ${slot === 'weapon' ? 'main' : 'off'} hand — ${Math.round(scale * 100)}% effect`;
}

