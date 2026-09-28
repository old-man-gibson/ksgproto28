import type {
  AttributeId,
  DamageType,
  GameState,
  Modifier,
  MonsterDef,
  MonsterInstance,
  StatKey,
} from '../types';
import { RES_STAT_BY_TYPE } from '../types';
import { MONSTERS, TIERS } from '../data/monsters.data';
import { rand } from '../engine/rng';
import { ATTRIBUTE_LIST } from '../data/attributes.data';
import { statusMods, statusResFloor, statusResOverrides } from './statuses';

/**
 * A monster's stat block, derived from its attributes rather than baked at
 * spawn — the enemy-side counterpart to derived.ts.
 *
 * Every specimen carries its own attributes: the def's base grown to its
 * level, jittered a little so two wolves are never identical, then scaled by
 * the three classification axes (intrinsic tier × rolled modifier × rarity).
 * Its HP, damage, speed and evasion all fall out of those numbers on read.
 *
 * That ordering — multipliers onto ATTRIBUTES, not onto finished stats — is
 * deliberate. A stat like HP is `12 + 7 × CON`: doubling CON is not doubling
 * HP, because the flat part does not scale. Tier scaling is therefore gentler
 * at low levels and unchanged at high ones, and, more importantly, an effect
 * that wants to alter a monster (a chill on its DEX, a wound on its CON) has a
 * single place to apply.
 */

/** Monsters act on a fixed 1000-unit bar; their speed sets how fast it fills. */
export const MONSTER_ACTION_BAR = 1000;

/**
 * How far an individual's attributes stray from the book value, either way.
 * This is the "no two wolves are the same" knob.
 */
export const MONSTER_ATTR_VARIANCE = 0.1;

export interface MonsterStats {
  maxHp: number;
  /**
   * Share of max health knitted back per tick. Zero for almost everything.
   *
   * The mirror of the player's `hpRegen`, and it exists for the same reason
   * the troll gene does: a thing that closes its own wounds is a different
   * fight, not a tougher one — you either out-damage it or you stop it. It is
   * SUPPRESSED while the monster is burning or corroding, exactly as a
   * regenerating player's is (health.ts `dousesRegen` and DOUSING_TYPES), so
   * the counterplay is the same on both sides of the swing.
   */
  hpRegen: number;
  damage: number;
  /**
   * What its WORKINGS land for, in the same spell-power multiples the player's
   * spells use — so a monster's arcane sentence, miracle or psionic shape
   * resolves through the identical maths (see MonsterDef.casts).
   *
   * Without this a monster's mind was decorative: `damage` reads STR alone, so
   * a caster statted with high INT and low STR was simply harmless.
   */
  spellPower: number;
  /** Action-bar fill per tick (it attacks when the bar reaches MONSTER_ACTION_BAR). */
  speed: number;
  dodge: number;
  /**
   * Chance a blow lands critical, and what one is worth.
   *
   * Deliberately the SAME formula the player runs on: everything that swings
   * has the ubiquitous one-in-twenty, and a quicker thing crits more often.
   * Monsters had neither for a long time, which quietly meant no fight could
   * ever spike — and made every "resists critical hits" effect unbuildable,
   * because there was nothing incoming to resist.
   */
  crit: number;
  critDamage: number;
  /**
   * Flat physical absorption, in the same currency the player's armour is in.
   *
   * Monsters had none at all for a long time, which meant nothing could ever
   * be *hard* as opposed to merely tough — and left acid's whole corrosion
   * line with nothing to eat. A species with no armouring material stays at 0,
   * so this changes nothing about anything soft.
   */
  armor: number;
  /**
   * Fractional damage reduction per type, negative for a vulnerability. Read
   * through the same pipeline the player's resistances use — the only
   * difference is where the BASE comes from. A player's is built up out of
   * skills, gear and training; a monster's is what its species simply is.
   * Conditions modify both the same way, so ice can make anything brittle.
   */
  resistances: Record<DamageType, number>;

  /*
   * ---- Parity with the player's block (docs/plans/monster-stat-parity.md) ----
   *
   * A gene modifier has to mean the same thing whoever is wearing it, or the
   * whole premise of authoring a body once is false in the small print. These
   * are the dials `DerivedStats` already had and this side did not, so a
   * modifier targeting one stopped dead at `MONSTER_STAT_KEYS` and was dropped
   * without a word.
   *
   * ⚠️ Every default here is what the pipeline ALREADY behaved as before the
   * field existed — 1 for a multiplier, 0 for an addend, `MONSTER_RESIST_CAP`
   * for the ceiling that used to be a constant. Nothing in this block changes a
   * number until something deliberately targets it. That is what let parity
   * land without re-tuning the bestiary.
   */

  /** Multiplies the action bar's fill, exactly as the player's does. */
  attackSpeed: number;
  /** Scales the SURPLUS of a critical hit taken. Bottoms out at neutral. */
  critTaken: number;
  /** Multiplies what survived armour and resistance. The body, not the barrier. */
  damageTaken: number;
  /** Flat absorb after resistances, any type. Never banks its surplus. */
  ward: number;
  /**
   * This body's own resistance ceiling. Was `MONSTER_RESIST_CAP` inline; it is
   * a stat now for the same reason the player's is — a body built to hold more
   * holds more, or the clamp undoes what it bought.
   */
  resistCap: number;
  /** Answers every elemental type at once, stacked before the cap. */
  resElemental: number;
  /** Answers blows that came from range, stacked before the cap. */
  resRanged: number;
  /** Extra damage per size step the TARGET is below this one. */
  vsSmaller: number;
  /** Damage reduction per size step the ATTACKER is below this one. */
  fromSmaller: number;
  /** Additional hits per swing, rolled the way the player's are. */
  extraSwings: number;
  /** Share of remaining cooldown handed back when a swing misses. */
  missRefund: number;
  /** Share of a missed swing that lands anyway. */
  graze: number;
}

/**
 * Every numeric dial on the block — which is all of it but `resistances`.
 *
 * Derived from the interface rather than listed, so a field added above cannot
 * be forgotten here. The hand-written union this replaced was already wrong by
 * four keys.
 */
export type MonsterStatKey = Exclude<keyof MonsterStats, 'resistances'>;

/** A monster's resistances never block more than this, or double damage past it. */
export const MONSTER_RESIST_CAP = 0.9;

/**
 * What a material is worth as armour, before anything scales it.
 *
 * Most monsters never declare armour, and asking every author to remember is
 * how a stone golem ends up as soft as a rat. A species' TAGS already say what
 * it is made of, so they can say how hard it is too — and an explicit
 * `MonsterDef.armor` overrides this, including `0` for something that ought to
 * be soft despite its material.
 *
 * Read as a MAXIMUM rather than a sum: a golem that is inorganic AND earth is
 * as hard as its hardest material, not the two added together.
 *
 * ⚠️ Every key here must be a REGISTERED monster tag. An invented one is not
 * an error anything catches — it simply never matches, silently, forever, and
 * the species it was meant to harden stays soft. There is a test for it.
 */
export const TAG_ARMOR: Record<string, number> = {
  inorganic: 3,
  nature: 2,
  ice: 4,
  earth: 5,
  construct: 6,
};

/**
 * Species-innate armour: the declared value, or the toughest material its tags
 * imply. Zero for anything soft, which is most things.
 */
export function innateArmor(defId: string): number {
  const def = MONSTERS[defId];
  if (!def) return 0;
  if (def.armor !== undefined) return def.armor;
  let best = 0;
  for (const tag of def.tags) best = Math.max(best, TAG_ARMOR[tag] ?? 0);
  return best;
}

/** One tag's opinion about one damage type. */
export interface TagResistance {
  /** What it is worth at `basic`. */
  base: number;
  /**
   * Added per tier step above basic. Absent = FLAT across every tier, which is
   * not an omission — see the two shapes below.
   */
  perTier?: number;
}

/**
 * WHAT A BODY'S MATERIAL RESISTS, before anything modifies it. The resistance
 * mirror of `TAG_ARMOR`, and it earns its place the same way: a species should
 * not have to restate what being made of slime already means.
 *
 * ⚠️ Every key must be a REGISTERED monster tag, exactly as for `TAG_ARMOR` —
 * an invented one never matches, silently, forever. Linted in both layers.
 *
 * **Every number here was derived from the monsters that already declare one,
 * never invented.** That is the whole reason to trust it: across the 35 species
 * these tags touch, the table reproduces 33 of them exactly. It is a pattern
 * that was already in the data, not one imposed on it.
 *
 * ---- The two shapes, and why there are two ----
 *
 * **Physical is FLAT per taxon.** Every base slime from `basic` to `elite` runs
 * 0.5 / 0.5 / −0.25, and each exception is a real identity rather than drift —
 * honey absorbs blunt (+0.35), metal is 0.9 across the board, the three bosses
 * are hand-tuned. Being made of slime does not get slimier with rank.
 *
 * **Elemental is TIER-SCALED**, and near-perfectly: fire runs heat 0.5 / 0.6 /
 * 0.7 with cold mirroring it at −0.5 / −0.6 / −0.7, lightning runs 0.7 / 0.8 /
 * 0.9. Exactly +0.1 a step. An elemental line getting *more* elemental as it
 * ascends is what the line IS, so the rank belongs in the rule.
 *
 * Deliberately absent: `water`, `wind`, `nature`, `earth`, `dark`, `holy`.
 * Those slimes declare no resistance to their own element today, which looks
 * like a gap rather than a decision — but filling it here would be a balance
 * change smuggled in under a refactor. Author it or don't; don't let a table
 * decide it.
 */
export const TAG_RESISTANCES: Record<string, Partial<Record<DamageType, TagResistance>>> = {
  slime: {
    slashing: { base: 0.5 },
    piercing: { base: 0.5 },
    bludgeoning: { base: -0.25 },
  },
  fire: {
    heat: { base: 0.5, perTier: 0.1 },
    cold: { base: -0.5, perTier: -0.1 },
  },
  ice: {
    cold: { base: 0.5, perTier: 0.1 },
    heat: { base: -0.25, perTier: -0.15 },
  },
  lightning: {
    lightning: { base: 0.7, perTier: 0.1 },
  },
};

const TIER_ORDER = Object.keys(TIERS);

/**
 * What this species' tags imply about one damage type, or undefined when none
 * of them has an opinion.
 *
 * Where two tags both speak, the **strongest opinion wins** — furthest from
 * zero, sign preserved. `TAG_ARMOR` takes a MAX for the same reason and this is
 * that rule made sign-aware: adding a tag may push a resistance further from
 * neutral in the direction that tag cares about, and may never cancel out what
 * another tag said. Summing would let a body with four tags resist everything
 * for having been described thoroughly.
 *
 * Two tags DISAGREEING in sign about one type is a content error rather than an
 * arithmetic outcome, and is linted as one.
 */
function taggedResistance(def: MonsterDef, type: DamageType): number | undefined {
  const step = Math.max(0, TIER_ORDER.indexOf(def.tier));
  let out: number | undefined;
  for (const tag of def.tags) {
    const rule = TAG_RESISTANCES[tag]?.[type];
    if (!rule) continue;
    const value = rule.base + (rule.perTier ?? 0) * step;
    if (out === undefined || Math.abs(value) > Math.abs(out)) out = value;
  }
  return out;
}

/**
 * Species-innate resistances: the base layer, before anything modifies it.
 *
 * Declared value wins PER TYPE, not per block. That is the authoring gesture
 * the field wants — "I am a slime, and I also resist heat" should be one line
 * saying `heat`, not a full restatement of what slime already means. It is also
 * how the existing data reads: `psionic_slime` declares `{ heat: 0.8 }` and
 * gets no physical resistance at all today, unlike every other slime in the
 * game, which is exactly the omission this layer exists to catch.
 *
 * A species that genuinely wants none of what its tags imply says so with an
 * explicit `0`. Absent means "whatever I am made of"; zero means "not that".
 */
export function innateResistances(defId: string): Record<DamageType, number> {
  const def = MONSTERS[defId];
  const declared = def?.resistances;
  const out = {} as Record<DamageType, number>;
  for (const type of Object.keys(RES_STAT_BY_TYPE) as DamageType[]) {
    out[type] = declared?.[type] ?? (def ? taggedResistance(def, type) ?? 0 : 0);
  }
  return out;
}

/** A monster's book-value attributes at a level, before variance or scaling. */
export function baseMonsterAttrs(def: MonsterDef, level: number): Record<AttributeId, number> {
  const attrs = {} as Record<AttributeId, number>;
  for (const a of ATTRIBUTE_LIST) {
    attrs[a.id] = (def.attrs[a.id] ?? 0) + (def.growth[a.id] ?? 0) * (level - 1);
  }
  return attrs;
}

/**
 * Roll one specimen's attributes: book value, jittered per attribute, then
 * scaled by whatever the classification axes multiply it by.
 */
export function rollMonsterAttrs(
  state: GameState,
  def: MonsterDef,
  level: number,
  statMult: number,
): Record<AttributeId, number> {
  const attrs = baseMonsterAttrs(def, level);
  for (const a of ATTRIBUTE_LIST) {
    const jitter = 1 + (rand(state) * 2 - 1) * MONSTER_ATTR_VARIANCE;
    attrs[a.id] = attrs[a.id] * jitter * statMult;
  }
  return attrs;
}

/** Book-value attributes scaled by a multiplier, with no roll — for the bestiary. */
export function scaledMonsterAttrs(
  def: MonsterDef,
  level: number,
  statMult: number,
): Record<AttributeId, number> {
  const attrs = baseMonsterAttrs(def, level);
  for (const a of ATTRIBUTE_LIST) attrs[a.id] *= statMult;
  return attrs;
}

/**
 * The formulas themselves. Everything that wants to know what a monster's
 * numbers are — combat, the bestiary's field notes — comes through here, so
 * there is exactly one copy of them.
 */
export function statsFromAttrs(
  attrs: Record<AttributeId, number>,
  /** Species-innate resistances; omitted for the bestiary's averaged profile. */
  resistances: Record<DamageType, number> = innateResistances(''),
  /** Species-innate armour; omitted for the bestiary's averaged profile. */
  innate = 0,
  /** Species-innate regeneration, as a share of max health per tick. */
  regen = 0,
  /** What level the specimen is; armour grows with it. */
  level = 1,
): MonsterStats {
  const attr = (id: AttributeId) => attrs[id] ?? 0;
  return {
    resistances,
    // Purely declared — there is no attribute that quietly grants it, because
    // "this thing knits itself back together" is a species trait rather than a
    // consequence of being tough.
    hpRegen: Math.max(0, regen),
    // The MATERIAL decides whether a thing is armoured at all; LEVEL decides
    // how much of that material there is. Nothing soft ever gains armour by
    // levelling, which is what keeps this from quietly hardening the world.
    //
    // ⚠️ Reads LEVEL, deliberately not CON. CON is already the health knob
    // (`maxHp` just below), so scaling armour off it made a tanky thing tough
    // twice over — and, because armour SUBTRACTS, eventually flatly immune
    // rather than merely durable. The benchmark posts found it the honest way:
    // 143k CON bought purely for a million health turned `armor: 100` into
    // thousands and ate whole swings.
    //
    // Growth is per level ABOVE 1, matching how `baseMonsterAttrs` reads
    // `growth`. So a declared `armor` is exactly what a level-1 specimen has —
    // which is what makes a benchmark post able to promise a number.
    armor: innate > 0 ? innate * (1 + Math.max(0, level - 1) * 0.05) : 0,
    maxHp: Math.max(1, Math.round(12 + attr('con') * 7)),
    damage: Math.max(0.5, 1.5 + attr('str') * 1.1),
    // Deliberately the same shape as the physical line, one attribute over —
    // a monster's mind is worth what its arm is, to the school that uses it.
    spellPower: Math.max(0.5, 1.5 + attr('int') * 1.1),
    // Capped at one attack per 6 ticks; the baseline is the old 24-tick interval.
    speed: Math.min(MONSTER_ACTION_BAR / 6, (MONSTER_ACTION_BAR / 24) * (1 + attr('dex') * 0.012)),
    dodge: Math.min(0.35, attr('dex') * 0.003),
    // Same shape as the player's, one for one — the floor is universal and DEX
    // is what sharpens it.
    crit: 0.05 + attr('dex') * 0.0015,
    critDamage: 2,
    // The parity block. Neutral by construction — see the interface.
    attackSpeed: 1,
    critTaken: 1,
    damageTaken: 1,
    ward: 0,
    resistCap: MONSTER_RESIST_CAP,
    resElemental: 0,
    resRanged: 0,
    vsSmaller: 0,
    fromSmaller: 0,
    extraSwings: 0,
    missRefund: 0,
    graze: 0,
  };
}

/**
 * Stat keys a monster actually has — modifiers targeting others are ignored.
 *
 * Derived from a neutral block rather than hand-listed. The list it replaced
 * held eight names while the block had nine fields, and `hpRegen` was the one
 * missing: a troll wearing the troll gene would not have regenerated, which is
 * the single thing a troll is.
 */
export const MONSTER_STAT_KEYS = new Set<string>(
  Object.keys(statsFromAttrs({} as Record<AttributeId, number>)).filter((k) => k !== 'resistances'),
);

/**
 * Stats that exist on the player and deliberately DO NOT apply to a monster.
 *
 * One name, one reason, and the reason has to be structural rather than "it was
 * hard". `castMonsterWorking` performs no mana check at all — monsters never
 * pay for a working, which docs/NEXT.md records as deliberate and which the
 * atomic-aura design leans on being structural. Giving them a pool is a new
 * resource with new balance, not parity.
 *
 * Named here rather than dropped silently so an author routing `maxMana` into a
 * genome can be TOLD it will do nothing (docs/MUTAGENS.md §11 applies to
 * authoring as much as to the panel). Adding a second name is a design
 * decision, not a place to put things that turned out to be awkward.
 */
export const MONSTER_EXEMPT_STATS = new Set<string>(['maxMana']);

/**
 * A monster's MIND, as manaburn sees it: the player's own pool arithmetic —
 * 1 × INT deep, recovering 0.01 × INT + 0.05 × WIS a second — read off this
 * specimen's attributes.
 *
 * It is NOT a pool a monster spends. `castMonsterWorking` still charges
 * nothing, and the exemption above still holds: no gene routes into this,
 * which is why it lives outside `MonsterStats`. It is only what a burn has to
 * eat before it can run a debt, and a mind IN debt (`mindInDebt`) cannot
 * shape a working — the same wall a player meets, who can afford nothing
 * below zero. A caster's mind is deep and a brute's shallow, which is what
 * lets manaburn devastate the one and barely trouble the other.
 */
export function monsterMind(inst: MonsterInstance): { current: number; max: number; regen: number } {
  const int = Math.max(0, inst.attrs.int ?? 0);
  const wis = Math.max(0, inst.attrs.wis ?? 0);
  return { current: inst.mana ?? int, max: int, regen: int * 0.01 + wis * 0.05 };
}

/** Burned past empty: the mind cannot shape a working until it recovers. */
export function mindInDebt(inst: MonsterInstance): boolean {
  return (inst.mana ?? 0) < 0;
}

/**
 * A live enemy's current stat block.
 *
 * Recomputed on read rather than stored, exactly as the player's is: an
 * encounter holds at most five monsters, so the cost is nothing, and it means
 * anything that alters a monster takes effect immediately with no cache to
 * invalidate.
 *
 * Conditions apply here, and they apply the same way they do to the player:
 * attribute-targeted modifiers change the attributes the formulas read, then
 * stat-targeted ones adjust the result, adds before mults. A chill that slows
 * its bearer is the same chill whichever side of the fight is wearing it.
 */
export function monsterStats(inst: MonsterInstance): MonsterStats {
  const innate = innateResistances(inst.defId);
  const mods = statusMods(inst);
  if (mods.length === 0) {
    return clampMonsterStats(applyResOverrides(inst, statsFromAttrs(inst.attrs, innate, innateArmor(inst.defId), MONSTERS[inst.defId]?.regen ?? 0, inst.level)));
  }

  const attrs = { ...inst.attrs };
  for (const { mod } of mods) {
    if (mod.op === 'add' && mod.stat in attrs) attrs[mod.stat as AttributeId] += mod.value;
  }
  for (const { mod } of mods) {
    if (mod.op === 'mult' && mod.stat in attrs) attrs[mod.stat as AttributeId] *= 1 + mod.value;
  }

  const stats = statsFromAttrs(attrs, innate, innateArmor(inst.defId), MONSTERS[inst.defId]?.regen ?? 0, inst.level);
  const num = (k: string) => stats[k as MonsterStatKey];
  for (const { mod } of mods) {
    if (mod.op !== 'add' || mod.fromStat) continue; // fromStat: layer 3, below
    if (MONSTER_STAT_KEYS.has(mod.stat)) {
      stats[mod.stat as MonsterStatKey] = num(mod.stat) + mod.value;
    } else if (RES_TYPE_BY_STAT[mod.stat]) {
      stats.resistances[RES_TYPE_BY_STAT[mod.stat]] += mod.value;
    }
  }
  for (const { mod } of mods) {
    if (mod.op !== 'mult' || mod.fromStat) continue;
    if (MONSTER_STAT_KEYS.has(mod.stat)) {
      stats[mod.stat as MonsterStatKey] = num(mod.stat) * (1 + mod.value);
    } else if (RES_TYPE_BY_STAT[mod.stat]) {
      stats.resistances[RES_TYPE_BY_STAT[mod.stat]] *= 1 + mod.value;
    }
  }
  applyDerivedMods(stats, mods);
  return clampMonsterStats(applyResOverrides(inst, stats));
}

/**
 * LAYER 3: modifiers whose value is derived from another stat (`fromStat`).
 *
 * The exact shape `computeDerivedStats` uses, and it has to be — a fire slime's
 * "damage rises with heat resistance" is one authored line that must resolve
 * identically whichever side of the fight is wearing it. This side had no such
 * pass at all, which meant `fromStat` was the single largest hole in parity:
 * it is the build identity of BOTH surviving genera (the troll's damage from
 * bludgeoning resistance, the fire slime's from heat).
 *
 * Two properties carried over exactly, because they are the load-bearing ones:
 *
 *  - **Last**, after every ordinary modifier, so each source reads its FINAL
 *    value. Reading a resistance mid-pass would pay for points it never had.
 *  - **Sources snapshotted before anything is written**, so the pass cannot
 *    feed itself: two mods each reading the other's target both see the
 *    pre-pass numbers. That makes cycles impossible by construction rather
 *    than by checking for them.
 *
 * A resistance is a legal source here as well as a legal target, which is what
 * `RES_TYPE_BY_STAT` is doing on both sides of the read.
 */
function applyDerivedMods(stats: MonsterStats, mods: { mod: Modifier }[]): void {
  const derived = mods.filter(({ mod }) => mod.fromStat);
  if (!derived.length) return;
  const before: MonsterStats = { ...stats, resistances: { ...stats.resistances } };
  const read = (key: string): number | undefined => {
    if (MONSTER_STAT_KEYS.has(key)) return before[key as MonsterStatKey];
    const type = RES_TYPE_BY_STAT[key];
    return type ? before.resistances[type] : undefined;
  };
  for (const { mod } of derived) {
    const from = read(mod.fromStat!);
    // A source this body has no slot for contributes NOTHING rather than zero
    // — `damage × 0` would silently delete the modifier's target instead of
    // leaving it alone, which is a very different answer.
    if (from === undefined || !Number.isFinite(from)) continue;
    const value = mod.value * from;
    const type = RES_TYPE_BY_STAT[mod.stat];
    if (MONSTER_STAT_KEYS.has(mod.stat)) {
      const key = mod.stat as MonsterStatKey;
      stats[key] = mod.op === 'add' ? stats[key] + value : stats[key] * (1 + value);
    } else if (type) {
      stats.resistances[type] =
        mod.op === 'add' ? stats.resistances[type] + value : stats.resistances[type] * (1 + value);
    }
  }
}

/** Damage type each resistance stat protects against — the reverse lookup. */
const RES_TYPE_BY_STAT: Record<string, DamageType> = Object.fromEntries(
  (Object.entries(RES_STAT_BY_TYPE) as [DamageType, StatKey][]).map(([type, key]) => [key, type]),
);

function applyResOverrides(inst: MonsterInstance, stats: MonsterStats): MonsterStats {
  const overrides = statusResOverrides(inst, (type) => stats.resistances[type]);
  for (const [type, value] of Object.entries(overrides) as [DamageType, number][]) {
    stats.resistances[type] = value;
  }
  const floor = statusResFloor(inst);
  if (floor !== undefined) {
    for (const type of Object.keys(stats.resistances) as DamageType[]) {
      stats.resistances[type] = Math.max(floor, stats.resistances[type]);
    }
  }
  return stats;
}

function clampMonsterStats(stats: MonsterStats): MonsterStats {
  stats.maxHp = Math.max(1, Math.round(stats.maxHp));
  stats.damage = Math.max(0, stats.damage);
  stats.speed = Math.max(1, stats.speed);
  stats.dodge = Math.min(0.9, Math.max(0, stats.dodge));
  stats.hpRegen = Math.max(0, stats.hpRegen);
  stats.armor = Math.max(0, stats.armor);
  // Neutral is the floor for both, exactly as on the player's side: a body
  // hardened against crits flattens the spike into an ordinary blow and never
  // below it — the hit still lands, it just stops being special.
  stats.critTaken = Math.max(0, stats.critTaken);
  stats.damageTaken = Math.max(0, stats.damageTaken);
  stats.ward = Math.max(0, stats.ward);
  stats.attackSpeed = Math.max(0.1, stats.attackSpeed);
  stats.extraSwings = Math.max(0, stats.extraSwings);
  stats.missRefund = Math.min(1, Math.max(0, stats.missRefund));
  stats.graze = Math.min(1, Math.max(0, stats.graze));
  // The body's OWN ceiling rather than the global constant — the same change
  // the player's block already made. Floored at zero so a stripped cap cannot
  // invert into "resistances must be negative".
  stats.resistCap = Math.max(0, stats.resistCap);
  for (const type of Object.keys(stats.resistances) as DamageType[]) {
    stats.resistances[type] = Math.max(-1, Math.min(stats.resistCap, stats.resistances[type]));
  }
  return stats;
}

/** Seconds between attacks at a given fill rate (ticks are 100 ms). */
export function attackIntervalOf(speed: number): number {
  return MONSTER_ACTION_BAR / speed / 10;
}
