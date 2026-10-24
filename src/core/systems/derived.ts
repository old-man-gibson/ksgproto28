import type { AttributeId, DamageType, DerivedStats, GameState, StatKey } from '../types';
import { RES_STAT_BY_TYPE } from '../types';
import {
  attrValue,
  attrValueFrom,
  collectBaseMods,
  effectiveAttrsFrom,
  equippedTags,
  groupModLines,
  isAttrTarget,
  resolveModValue,
  type BreakdownLine,
  type ResolvedMod,
} from './attributes';
import { effectiveStyleDef, effectiveStyleId } from './styles';
import { exerting } from './stamina';
import { lockMods } from './resources';
// Mutual with mutagens.ts, which reads derived stats for loot luck when
// harvesting a kill. Safe both ways: neither side touches the other at
// module-evaluation time, only inside functions.
import { chromosomeMods, playerSizeRank } from './mutagens';
import {
  OVERSIZE_SPEED_PER_STEP,
  UNDERSIZE_DAMAGE_PER_STEP,
  oversizeSteps,
  undersizeSteps,
} from './wield';
import {
  effectiveIntensity,
  fieldHungerBucket,
  hasDamping,
  hasStatus,
  noteUncappedResistance,
  statusDampingFor,
  statusResFloor,
  statusResOverrides,
} from './statuses';
import { ATTRIBUTE_LIST } from '../data/attributes.data';
import { RESOURCE_LIST } from '../data/resources.data';

// Re-exported for existing consumers (format.ts, tests).
export { resolveModValue };
export type { ResolvedMod };

/**
 * Every active modifier: the base sources (equipment, achievements, skills,
 * buffs — see collectBaseMods) plus the effective combat style, whose mods
 * scale with its school skill's level. Styles may only target derived stats.
 *
 * Stamina rides along here too: a style's exertion mods hold only while there
 * is stamina left to burn, the momentum a ramping stance has built this fight
 * applies as its own line, and exhaustion drags every action bar down.
 */
export function collectModifiers(state: GameState, vsTags?: ReadonlySet<string>): ResolvedMod[] {
  const style = effectiveStyleDef(state);
  const mySize = playerSizeRank(state);
  const out = collectBaseMods(state, style.id, vsTags, mySize);
  const wielding = equippedTags(state);
  const schoolLevel = style.skill ? (state.skills[style.skill]?.level ?? 0) : 0;
  for (const m of style.mods) {
    if (m.requiresTag && !wielding.has(m.requiresTag)) continue;
    if (m.requiresMonsterTag && !vsTags?.has(m.requiresMonsterTag)) continue;
    out.push({
      stat: m.stat,
      op: m.op,
      value: resolveModValue(m, schoolLevel),
      source: `Stance: ${style.name}`,
    });
  }

  const exertion = style.exertion;
  if (exertion?.mods && exerting(state, exertion.pool)) {
    for (const m of exertion.mods) {
      if (m.requiresTag && !wielding.has(m.requiresTag)) continue;
      out.push({
        stat: m.stat,
        op: m.op,
        value: resolveModValue(m, schoolLevel),
        source: `${style.name}: exertion`,
      });
    }
  }
  if (exertion?.ramp && state.combat?.momentum) {
    out.push({
      stat: exertion.ramp.stat,
      op: 'mult',
      value: Math.min(exertion.ramp.cap, state.combat.momentum),
      source: `${style.name}: momentum`,
    });
  }
  // Running a pool dry costs you for as long as it stays dry. What it costs is
  // declared with the pool (resources.data.ts), not hardcoded here.
  for (const { mod, source } of lockMods(state)) {
    out.push({ stat: mod.stat, op: mod.op, value: resolveModValue(mod, 0), source });
  }

  // A weapon too big for the hands holding it. Emitted as an ORDINARY
  // attackSpeed modifier rather than applied afterwards, so it converges with
  // every other speed source instead of compounding past them — and so
  // "reduces / eliminates / inverts the penalty" is just a positive
  // attackSpeed modifier, needing no mechanism of its own.
  const oversize = oversizeSteps(state, mySize);
  if (oversize > 0) {
    out.push({
      stat: 'attackSpeed',
      op: 'mult',
      value: -OVERSIZE_SPEED_PER_STEP * oversize,
      source: `Oversized by ${oversize} step${oversize === 1 ? '' : 's'}`,
    });
  }
  // ...and one too small is quick and useless. A different currency on
  // purpose: awkward is slow, undersized is weak.
  const undersize = undersizeSteps(state, mySize);
  if (undersize > 0) {
    out.push({
      stat: 'damage',
      op: 'mult',
      value: -Math.min(0.9, UNDERSIZE_DAMAGE_PER_STEP * undersize),
      source: `Undersized by ${undersize} step${undersize === 1 ? '' : 's'}`,
    });
  }

  // The body you are wearing. Two layers, and they are different things: what
  // the main gene simply IS in each arm, and what the graph routed into that
  // arm on top of it.
  for (const { mod, source } of chromosomeMods(state)) {
    if (mod.requiresTag && !wielding.has(mod.requiresTag)) continue;
    if (mod.requiresMonsterTag && !vsTags?.has(mod.requiresMonsterTag)) continue;
    out.push({
      stat: mod.stat,
      op: mod.op,
      value: resolveModValue(mod, 0),
      source,
      // A body may turn one of its own stats into another — see Modifier.fromStat.
      fromStat: mod.fromStat,
    });
  }

  // Numb hands get less out of fine equipment. A condition can dull a whole
  // CLASS of modifier (see StatusDamping), which is what `origin` is for.
  // The dulled lines keep their own identity in tooltips — the label says so
  // rather than the number quietly shrinking with no explanation.
  if (hasDamping(state)) {
    for (const m of out) {
      // A bonus marked `undampened` is part of the fighter rather than part of
      // their kit — an uncanny dodge does not stop working because they were
      // caught off guard.
      if (m.undampened) continue;
      const keep = statusDampingFor(state, m.origin, m.stat);
      if (keep >= 1) continue;
      m.value *= keep;
      m.source = `${m.source ?? 'Other'} (dulled)`;
    }
  }
  return out;
}

function baseStats(attr: (id: AttributeId) => number): DerivedStats {
  // Stamina regen is a share of the pool, not a flat CON ramp: a bigger
  // reserve takes proportionally as long to refill, so styles that burn it
  // stay a real cost at every level (a flat ramp refilled 60 stamina in six
  // seconds and made exertion free). CON still adds a little on top.
  const maxStamina = 10 + attr('str') * 0.5 + attr('con');
  const maxHp = 40 + attr('con') * 10;
  /*
   * Small and precious, like spirit — psionic overload is going to eat this
   * CEILING rather than the pool, so a big number here would blunt the threat.
   *
   * The BASE is what makes the school playable before any charisma: at a base
   * of 3 a CHA-1 mind held three focus, and any working past eight points cost
   * more than that outright — shapeable, inscribable, and permanently
   * uncastable. Six is enough to use psionics while untalented for it and
   * still leaves CHA as what makes you good at it.
   */
  const maxFocus = 6 + attr('cha') * 0.3 + attr('wis') * 0.1;
  // Efficiency decays toward a floor rather than toward zero: a lifetime of
  // training makes exertion cheaper, never free. What it saves it also gives
  // back as POWER — every point of cost you no longer pay is a point of extra
  // payoff on what you do spend (and milestones/titles can raise it further).
  const staminaEff =
    STAMINA_EFF_FLOOR +
    (1 - STAMINA_EFF_FLOOR) * Math.pow(0.999, attr('str')) * Math.pow(0.9985, attr('dex'));
  return {
    maxHp,
    // A share of the pool it refills, the way stamina and focus regen read
    // theirs — so a bigger constitution never leaves health taking longer to
    // come back than it did at half the size. Deliberately a slow trickle on
    // its own: what makes it matter is that resting multiplies it (see
    // RECOVERY_MULT), and that gear, skills and conditions can all move it.
    hpRegen: maxHp * HP_REGEN_SHARE + attr('con') * 0.01,
    damage: BARE_DAMAGE_FLAT + attr('str') * BARE_DAMAGE_PER_STR,
    // Action-bar fill per tick; DEX quickens ALL actions. Baseline 50 fills a
    // 1000-unit bar in 20 ticks (2s), matching the old base attack interval.
    speed: BASE_SPEED * (1 + attr('dex') * 0.015),
    actionBar: BASE_ACTION_BAR,
    // Pure multiplier on combat attack fill (DEX scaling moved into speed).
    // Modifiers combine CONVERGING on attack time — see getDerivedStats.
    attackSpeed: 1,
    // Attack-time overflow past the floor, paid back as extra hits per swing
    // (the fraction is a chance — see MIN_ATTACK_TICKS).
    extraSwings: 0,
    // Multiplicative like the efficiency stats: each DEX shaves DODGE_PER_DEX
    // off the REMAINING chance of being hit, so dodge climbs with diminishing
    // returns toward (but never reaching) 100%. Matches the old +0.4%/DEX at
    // low DEX; softer than the old linear ramp up high.
    dodge: 1 - (1 - DODGE_BASE) * Math.pow(1 - DODGE_PER_DEX, attr('dex')),
    crit: 0.05 + attr('dex') * 0.0015,
    armor: attr('con') * 0.3,
    spellPower: 2 + attr('int') * 1.5,
    skillXp: 1 + attr('int') * 0.01,
    trainXp: 1 + attr('wis') * 0.012,
    loot: 1 + attr('wis') * 0.005,
    goldGain: 1 + attr('cha') * 0.012,
    travelSpeed: 1,
    craftSpeed: 1,
    // Cooking's milestones add to both (skills.data.ts); read at most FOOD_MULT_CAP.
    foodDuration: 1,
    foodPotency: 1,
    critDamage: 2,
    penetration: 0,
    // Share of a landed hit that spills onto a random secondary target.
    splash: 0,
    // Chance to turn a blow aside and answer it for free, and the share of your
    // damage that answer carries. Parry is the only defence that hits back, so
    // it scales on two axes: how often it happens, and how much it costs them.
    parry: 0,
    riposte: PARRY_RIPOSTE,
    // Resource pools (max / regen-per-second / consumption multiplier).
    // Efficiency is multiplicative per point: each STR trims stamina cost to
    // 99.9% of its previous value, so N points → 0.999^N consumption.
    maxStamina,
    staminaRegen: maxStamina * STAMINA_REGEN_SHARE + attr('con') * 0.005,
    staminaEff,
    staminaPower: 2 - staminaEff,
    maxMana: attr('int'),
    manaRegen: attr('int') * 0.01 + attr('wis') * 0.05,
    manaEff: Math.pow(0.99967, attr('int')) * Math.pow(0.9999, attr('wis')),
    /*
     * The three casting pools, one per school: understand, believe, will.
     * INT → mana (arcane), WIS → spirit (divine), CHA → focus (psionic). Each
     * of those three attributes is also half of exactly one super-attribute
     * (INT+CON, WIS+DEX, CHA+STR — see superattrs.data.ts), so committing to a
     * school advances a fusion for free.
     */
    maxSpirit: 5 + attr('wis') * 0.25 + attr('cha') * 0.1,
    maxFocus,
    // Reads the pool it refills, the way staminaRegen does, so the two can
    // never drift apart when one of them is retuned.
    focusRegen: maxFocus * FOCUS_REGEN_SHARE + attr('cha') * 0.01,
    /*
     * Psionic bias — multipliers on the quantities a shape reads as, so 1 is
     * "matter has nothing to say about it". No attribute feeds these: they
     * come entirely from what you are wearing (and what you are aimed at),
     * which is the point. See systems/psionic.ts `psiBiasFrom`.
     */
    psiPressure: 1,
    psiMomentum: 1,
    psiInertia: 1,
    psiAcuity: 1,
    psiAwareness: 1,
    psiCoherence: 1,
    psiPurchase: 1,
    resSlashing: 0,
    resPiercing: 0,
    resBludgeoning: 0,
    resHeat: 0,
    resCold: 0,
    resPoison: 0,
    resAcid: 0,
    resArcane: 0,
    resLightning: 0,
    resEarth: 0,
    resWind: 0,
    resWater: 0,
    resLight: 0,
    resDark: 0,
    // Starts at 1 and is scaled DOWN by anything that softens blows, so a
    // -0.15 mult reads as "takes 15% less". Applied last, after armor and
    // resistances, because it is a property of the body rather than of the
    // barrier — a slime does not resist a sword, it just minds it less.
    damageTaken: 1,
    // A flat bite off every blow after resistances. Worth most against many
    // small hits, where a resistance is worth most against one large one.
    ward: 0,
    // Folded into whichever elemental resistance is being checked, so a single
    // modifier can say "resists the elements" without naming six of them.
    resElemental: 0,
    // Only consulted when the attacker is at range. A body built to shrug off
    // arrows is a different thing from one built to shrug off swords.
    resRanged: 0,
    // Scales only what a crit ADDS. At 0 a crit lands as an ordinary blow,
    // never softer — hardening against crits removes the spike, not the hit.
    critTaken: 1,
    // Scales only a position's PENALTY. At 0 stumbling costs nothing extra; a
    // guarded stance's benefit is never touched by it.
    stumbleTaken: 1,
    // The ceiling on every resistance. A stat rather than a constant so a body
    // can be built to hold more than the usual three-quarters.
    resistCap: RESIST_CAP,
    // Both read PER SIZE STEP and only downward, so they are bully's stats:
    // nothing at all against your equals, and nothing against anything bigger.
    vsSmaller: 0,
    fromSmaller: 0,
    // The mirror, read upward only: nothing against your equals or smaller.
    vsLarger: 0,
    // Nothing back by default: a miss is ordinarily just a miss.
    missRefund: 0,
    // Only a body that knits itself has anything to douse.
    // A miss is ordinarily just a miss.
    graze: 0,
  };
}

/** Resistances never block more than this fraction of incoming damage. */
export const RESIST_CAP = 0.75;

/** No amount of gear turns every blow aside. */
export const PARRY_CAP = 0.5;

/**
 * The most the cook's skill ever multiplies food by, duration and potency alike.
 * Cooking has no level cap, so the stat is clamped where it is read: milestones,
 * and anything else that adds to it, stop paying here.
 */
export const FOOD_MULT_CAP = 1.5;

/**
 * A parry answers with this share of your damage, for free. It is the BASE of
 * the `riposte` stat, not a constant: frequency is capped at PARRY_CAP, so the
 * force of the answer is where a parry build keeps growing.
 */
export const PARRY_RIPOSTE = 0.3;

/** Round to 4 decimals — trims binary-float dust on resource pools. */
function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

// ---------- Action bars ----------

/** Baseline action-bar size in units. Conditions and rare bonuses can shrink or grow it. */
export const BASE_ACTION_BAR = 1000;
/** Baseline action-bar fill per tick at DEX 0. */
export const BASE_SPEED = 50;
/** The action bar can never shrink below this (hard superhuman ceiling). */
export const MIN_ACTION_BAR = 100;

/**
 * The attack interval never drops below this (0.5s at 10 TPS). Speed past the
 * floor is not lost: the overflow becomes `extraSwings` — additional hits per
 * swing, the fraction rolled as a chance — so DPS is preserved while the
 * fight stays readable.
 */
export const MIN_ATTACK_TICKS = 5;

/** One attack-speed source can never erase more than this share of attack time. */
export const ATTACK_SPEED_MOD_CAP = 0.5;

/**
 * Share of the health pool recovered per second while doing something ordinary
 * (see baseStats). One percent is a hundred seconds from death's door to full
 * — small enough that a fight is still won or lost on the fight, and the reason
 * to sit down and rest is that resting multiplies it fifteenfold.
 */
export const HP_REGEN_SHARE = 0.01;

/** Flat part of what a body hits for before any gear speaks. */
export const BARE_DAMAGE_FLAT = 2;
/** What each point of STR adds on top of it. */
export const BARE_DAMAGE_PER_STR = 1.2;

/**
 * What the body hits for with NOTHING IN ITS HANDS — attributes alone, before a
 * single modifier from weapon, rune, oil or condition.
 *
 * Deliberately not `stats.damage`, which is the finished figure and includes
 * whatever is equipped. Anupama's attack arm converts this into regeneration,
 * and reading the finished number there would mean a fasting player equips the
 * largest weapon they own, never swings it — they cannot — and farms the
 * trickle off a number they have no way to use. "Unarmed" is meant literally.
 */
export function unarmedDamage(state: GameState): number {
  return BARE_DAMAGE_FLAT + attrValue(state, 'str') * BARE_DAMAGE_PER_STR;
}

/** Share of the stamina pool recovered per second (see baseStats). */
export const STAMINA_REGEN_SHARE = 0.02;
/**
 * Share of the focus pool recovered per second (see baseStats). Deliberately
 * the same rate as stamina: psionic overload eats the pool's MAXIMUM, and the
 * ceiling is meant to come back at roughly the speed the pool itself refills.
 */
export const FOCUS_REGEN_SHARE = 0.02;
/** Exertion never costs less than this share of its listed price. */
export const STAMINA_EFF_FLOOR = 0.5;

/** Innate dodge chance at DEX 0. */
export const DODGE_BASE = 0.02;
/** Each DEX multiplies the remaining chance-to-be-hit by (1 − this). */
export const DODGE_PER_DEX = 0.004;

const RES_KEYS: StatKey[] = [
  'resSlashing',
  'resPiercing',
  'resBludgeoning',
  'resHeat',
  'resCold',
  'resPoison',
  'resAcid',
  'resArcane',
  'resLightning',
  'resEarth',
  'resWind',
  'resWater',
  'resLight',
  'resDark',
];

/** `craftSpeed:leatherworking` is scoped; `craftSpeed` and `str` are not. */
export function isScopedTarget(target: string): boolean {
  return target.includes(':');
}

/**
 * The multiplier scoped mods contribute to `stat` for work carrying `tags`.
 * Returns 1 when nothing matches, so callers can multiply unconditionally.
 *
 * Layered the same way the flat block is — every matching `add` first, then
 * every matching `mult` — so `craftSpeed:smithing` behaves like `craftSpeed`
 * for anyone reading the numbers, just conditionally.
 */
export function scopedMult(
  state: GameState,
  stat: StatKey,
  tags: readonly string[],
): number {
  if (tags.length === 0) return 1;
  const wanted = new Set(tags.map((t) => `${stat}:${t}`));
  // Reads the memoized collection — this runs per tick on tagged work, and a
  // fresh pass would rebuild every modifier just to keep a handful of them.
  const mods = statsCacheEntry(state).mods.filter((m) => wanted.has(m.stat));
  if (mods.length === 0) return 1;
  let out = 1;
  for (const m of mods) if (m.op === 'add') out += m.value;
  for (const m of mods) if (m.op === 'mult') out *= 1 + m.value;
  return out;
}

/**
 * Build the stat block from scratch — the full pipeline, uncached. Everything
 * in the game reads stats through `getDerivedStats` below; this stays exported
 * so the cache-consistency test can compare the two.
 *
 * `precollected` lets the cache reuse the modifier collection it already made
 * for the entry; it must be the no-vsTags collection when vsTags is absent.
 */
export function computeDerivedStats(
  state: GameState,
  vsTags?: ReadonlySet<string>,
  precollected?: ResolvedMod[],
): DerivedStats {
  const mods = precollected ?? collectModifiers(state, vsTags);
  // Layer 1: effective attributes (trained base + attribute-targeted mods,
  // fusion-aware) feed the base formulas.
  const eff = effectiveAttrsFrom(state, mods);
  const stats = baseStats((id) => attrValueFrom(state, eff, id));
  // Layer 2: stat-targeted mods — additive first, then multiplicative.
  for (const m of mods) {
    // Scoped targets are skipped on purpose: they apply only to tagged work,
    // so folding them into the flat block would grant them everywhere. They
    // are picked up by `scopedMult` where the tags are known.
    if (isScopedTarget(m.stat)) continue;
    if (m.fromStat) continue; // layer 3 — its source is not final yet
    if (!isAttrTarget(m.stat) && m.op === 'add') stats[m.stat as StatKey] += m.value;
  }
  for (const m of mods) {
    if (isScopedTarget(m.stat)) continue;
    if (m.fromStat) continue;
    if (m.stat === 'attackSpeed') continue; // converging — aggregated below
    if (!isAttrTarget(m.stat) && m.op === 'mult') stats[m.stat as StatKey] *= 1 + m.value;
  }
  // Attack speed converges instead of compounding: each source multiplies the
  // REMAINING attack time by (1 − v) — two 10% hastes are −19% time, not −21%
  // fill-rate escalation — and no single source may erase more than half the
  // time (slows are symmetric: −v lengthens time by the same rule, capped at
  // doubling). Runes, schools, buffs and momentum all pass through here.
  let timeMult = 1;
  for (const m of mods) {
    if (m.stat !== 'attackSpeed' || m.op !== 'mult') continue;
    timeMult *= Math.min(2, Math.max(1 - ATTACK_SPEED_MOD_CAP, 1 - m.value));
  }
  stats.attackSpeed /= timeMult;
  stats.dodge = Math.min(0.75, Math.max(0, stats.dodge));
  stats.crit = Math.min(0.9, Math.max(0, stats.crit));
  stats.damage = Math.max(0.5, stats.damage);
  stats.maxHp = Math.max(1, Math.floor(stats.maxHp));
  stats.hpRegen = round4(Math.max(0, stats.hpRegen));
  stats.critDamage = Math.max(1, stats.critDamage);
  stats.penetration = Math.min(0.6, Math.max(0, stats.penetration));
  stats.splash = Math.min(1, Math.max(0, stats.splash));
  stats.parry = Math.min(PARRY_CAP, Math.max(0, stats.parry));
  // Uncapped on purpose — the parry CHANCE is capped, so the answer's force is
  // the axis a fencing build is allowed to keep climbing.
  stats.riposte = Math.max(0, stats.riposte);
  stats.speed = Math.max(1, stats.speed);
  stats.actionBar = Math.max(MIN_ACTION_BAR, stats.actionBar);
  stats.attackSpeed = Math.max(0.1, stats.attackSpeed);
  stats.craftSpeed = Math.max(0.1, stats.craftSpeed);
  stats.foodDuration = Math.min(FOOD_MULT_CAP, Math.max(0, stats.foodDuration));
  stats.foodPotency = Math.min(FOOD_MULT_CAP, Math.max(0, stats.foodPotency));
  stats.extraSwings = Math.max(0, stats.extraSwings);
  // The attack-time floor: speed past it converts to extra hits per swing
  // rather than vanishing — superhuman pace reads as flurries, not blur.
  {
    const interval = stats.actionBar / (stats.speed * stats.attackSpeed);
    if (interval < MIN_ATTACK_TICKS) {
      stats.extraSwings += MIN_ATTACK_TICKS / interval - 1;
      stats.attackSpeed = stats.actionBar / (MIN_ATTACK_TICKS * stats.speed);
    }
  }
  // Every pool capacity is a whole number — partial current values still read
  // to 2 decimals in the UI, but a max of "11" beats "11.50".
  stats.maxStamina = Math.floor(Math.max(0, stats.maxStamina));
  stats.staminaRegen = round4(Math.max(0, stats.staminaRegen));
  stats.staminaEff = Math.min(1, Math.max(STAMINA_EFF_FLOOR, stats.staminaEff));
  stats.staminaPower = Math.max(0, stats.staminaPower);
  stats.maxMana = Math.floor(Math.max(0, stats.maxMana));
  stats.manaRegen = round4(Math.max(0, stats.manaRegen));
  stats.manaEff = Math.min(1, Math.max(0, stats.manaEff));
  stats.maxSpirit = Math.floor(Math.max(0, stats.maxSpirit));
  stats.maxFocus = Math.floor(Math.max(0, stats.maxFocus));
  stats.focusRegen = round4(Math.max(0, stats.focusRegen));
  // Conditions may DICTATE a resistance rather than nudge it (a soaking decides
  // what your cold resistance is), and may open a deeper hole than the ordinary
  // floor allows. Both are resolved after the normal pipeline, before the cap.
  const overrides = statusResOverrides(state, (type) => stats[RES_STAT_BY_TYPE[type]]);
  for (const [type, value] of Object.entries(overrides) as [DamageType, number][]) {
    stats[RES_STAT_BY_TYPE[type]] = value;
  }
  const floor = statusResFloor(state);
  // The ceiling is itself a stat, so a body can be built to hold more than the
  // usual three-quarters. Read here rather than from the constant — a fire
  // giant that shrugs off flame is raising the LIMIT, not merely approaching it,
  // and clamping to a global would have quietly thrown that away.
  const cap = Math.max(0, stats.resistCap);
  // What the cap is about to hide, for the one reader that needs it: condition
  // immunity is resistance reaching 1, and the cap holds the stat under that.
  const aboveCap: Record<string, number> = {};
  for (const key of RES_KEYS) {
    if (stats[key] > cap) aboveCap[key] = stats[key];
    stats[key] = Math.min(cap, stats[key]);
    if (floor !== undefined) stats[key] = Math.max(floor, stats[key]);
  }
  if (Object.keys(aboveCap).length > 0) noteUncappedResistance(stats, aboveCap);

  // Layer 3: modifiers whose value is DERIVED from another stat. Deliberately
  // last, so every source reads its final, clamped value — a fire slime paid
  // for heat resistance it never actually had would otherwise be paid for
  // everything it stacked past the cap.
  //
  // Sources are snapshotted before anything is written, so the pass cannot feed
  // itself: two mods each reading the other's target both see the pre-pass
  // numbers. That is what makes cycles impossible rather than merely unlikely.
  const derived = mods.filter(
    (m) => m.fromStat && !isScopedTarget(m.stat) && !isAttrTarget(m.stat),
  );
  if (derived.length > 0) {
    const before = { ...stats };
    for (const m of derived) {
      const from = before[m.fromStat as StatKey];
      if (!Number.isFinite(from)) continue;
      const value = m.value * from;
      if (m.op === 'add') stats[m.stat as StatKey] += value;
      else stats[m.stat as StatKey] *= 1 + value;
    }
    // The floors the ordinary pipeline guarantees still have to hold.
    stats.damage = Math.max(0.5, stats.damage);
    stats.maxHp = Math.max(1, Math.floor(stats.maxHp));
  }
  return stats;
}

// ---------- Memoized read path ----------

interface StatsCacheEntry {
  fp: string;
  /** The no-vsTags modifier collection — shared with scopedMult. Read-only. */
  mods: ResolvedMod[];
  stats: DerivedStats;
  /** Target-gated variants (hunter bonuses), keyed by sorted tag string. */
  vs: Map<string, DerivedStats>;
}

const STATS_CACHE = new WeakMap<GameState, StatsCacheEntry>();

/**
 * Every input to `collectModifiers`/`computeDerivedStats`, folded into one
 * comparable string. THE CONTRACT: a new modifier source added to
 * collectBaseMods or collectModifiers must contribute its inputs here, or the
 * cache will serve stale stats. The consistency test in tests/derivedcache
 * compares cached against fresh computes across a long simulated fight to
 * catch exactly that omission.
 *
 * Latched fields keep this both cheap and quiet: modifiers read pool LOCKS
 * (resourceLocks), never pool values, so ordinary regen leaves the fingerprint
 * untouched. In a Svelte tracking context a cache hit reads only these fields,
 * so a $derived over getDerivedStats settles into recomputing exactly when a
 * modifier source really changed.
 */
function modFingerprint(state: GameState): string {
  const parts: string[] = [effectiveStyleId(state), state.exerting ? 'x' : '-', state.title ?? ''];
  for (const def of RESOURCE_LIST) parts.push(state.resourceLocks?.[def.id] ?? 'none');
  const combat = state.combat;
  if (combat) {
    parts.push(`m${combat.momentum ?? 0}`);
    // Names, not ticksLeft: a buff's mods hold steady while it burns down, so
    // only the roster of buffs matters. Expiry replaces the array — seen here.
    for (const b of combat.buffs) parts.push(`b${b.name}`);
    // A fast's defence arm sheds condition penalties in proportion to the
    // hunger on the FIELD — enemy stacks included, which the per-status lines
    // below cannot see, since they only ever walk the bearer's own list.
    //
    // Bucketed, not raw. The arm is logarithmic anyway, and the raw total moves
    // every time anyone takes an action: fingerprinting it directly would
    // rebuild the whole stat block on nearly every tick of every fight.
    //
    // ⚠️ And gated, because this runs on EVERY getDerivedStats. Only a body
    // that fasts sheds condition penalties by hunger, so for everyone else
    // walking the enemy roster here would be pure cost.
    if (hasStatus(state, 'fasting')) parts.push(`h${fieldHungerBucket(state)}`);
  }
  // Effective intensity, not raw: a decaying condition's mods genuinely change
  // as it wanes, and the stats must wane with them.
  for (const s of state.statuses ?? []) parts.push(`s${s.id}:${effectiveIntensity(s)}:${s.stacks}`);
  for (const [slot, item] of Object.entries(state.equipment ?? {})) {
    if (!item) continue;
    // The uid pins the instance (def, affix); runes are the one thing that
    // mutates inside it, so they are spelled out. Carved runes are objects —
    // rare enough per slot that stringifying them stays cheap.
    parts.push(`e${slot}:${item.uid}`);
    for (const ref of item.runes ?? []) {
      parts.push(typeof ref === 'string' ? ref : `c${JSON.stringify(ref)}`);
    }
  }
  for (const a of ATTRIBUTE_LIST) parts.push(String(state.attrs?.[a.id]?.level ?? 0));
  // Character level: +1 to every attribute per level (attributes.ts).
  parts.push(`L${state.level ?? 1}`);
  for (const [id, s] of Object.entries(state.skills ?? {})) parts.push(`k${id}:${s.level}`);
  // Talent (prestige boon) scales skill effects. Peaks and the count only
  // change when the whole state is replaced at a prestige; the rank can
  // change mid-run at the boon list, so it is what needs spelling out.
  parts.push(
    `T${state.prestige?.purchases?.talent ?? 0}:${state.prestige?.purchases?.endowment ?? 0}:${state.prestige?.count ?? 0}`,
  );
  for (const [id, tiers] of Object.entries(state.achievements ?? {})) parts.push(`a${id}:${tiers}`);
  for (const id of state.titles ?? []) parts.push(`t${id}`);
  for (const id of state.fused ?? []) parts.push(`f${id}`);
  // The chromosome. Everything that changes what it RESOLVES to has to be in
  // here or the cache will happily serve the old body: the gene at the centre,
  // what is in each socket, and which connections are live — because a single
  // cut reroutes every effect on the board.
  const chromo = state.mutagens?.chromosome;
  if (chromo) {
    parts.push(`g${chromo.main?.id ?? '-'}:${chromo.main?.quality ?? '-'}`);
    for (const [socket, held] of Object.entries(chromo.placed)) {
      parts.push(`p${socket}:${held.id}:${held.quality}`);
    }
    parts.push(`n${chromo.established.length}`, `x${chromo.cut.join(',')}`);
  }
  return parts.join('|');
}

/** The fingerprint-fresh cache entry for this state, computing it if stale. */
function statsCacheEntry(state: GameState): StatsCacheEntry {
  const fp = modFingerprint(state);
  const hit = STATS_CACHE.get(state);
  if (hit && hit.fp === fp) return hit;
  const mods = collectModifiers(state);
  const entry: StatsCacheEntry = {
    fp,
    mods,
    stats: computeDerivedStats(state, undefined, mods),
    vs: new Map(),
  };
  STATS_CACHE.set(state, entry);
  return entry;
}

/**
 * The player's stat block, memoized per state object. Recomputes only when a
 * modifier source changed (see modFingerprint); identical inputs return the
 * IDENTICAL object, so Svelte deriveds propagate nothing when nothing changed
 * and the many per-tick readers collapse to one compute. Treat the result as
 * frozen — it is shared by every caller until the next real change.
 *
 * An empty `vsTags` set resolves like no set at all (no monster-gated modifier
 * can match it), so both spellings share the base entry.
 */
export function getDerivedStats(state: GameState, vsTags?: ReadonlySet<string>): DerivedStats {
  const entry = statsCacheEntry(state);
  if (!vsTags || vsTags.size === 0) return entry.stats;
  const key = [...vsTags].sort().join(',');
  let vs = entry.vs.get(key);
  if (!vs) {
    vs = computeDerivedStats(state, vsTags);
    entry.vs.set(key, vs);
  }
  return vs;
}

// ---------- Tooltip breakdowns ----------

/** Human-readable base formula per stat (mirrors baseStats — keep in sync). */
export const BASE_FORMULA_TEXT: Record<StatKey, string> = {
  damageTaken: '1 (a multiplier — lower is better)',
  ward: '0 (flat, taken off every blow after resistances)',
  resElemental: '0 (added to every elemental resistance)',
  resRanged: '0 (added only against attackers at range)',
  critTaken: '1 (scales the SURPLUS a crit adds, never the blow under it)',
  stumbleTaken: "1 (scales a position's PENALTY, never its benefit)",
  resistCap: '0.75 — the ceiling every resistance clamps to',
  resAcid: '0',
  missRefund: '0 (share of remaining cooldown handed back on a miss)',
  graze: '0 (share of a swing that lands anyway when it misses)',
  vsSmaller: '0 (added damage per size step the target is below you)',
  fromSmaller: '0 (damage reduction per size step the attacker is below you)',
  vsLarger: '0 (added damage per size step the target is above you)',
  maxHp: '40 + 10 × CON',
  hpRegen: '1% of Max HP + 0.01 × CON /s',
  damage: '2 + 1.2 × STR',
  speed: '50 × (1 + 1.5% × DEX)',
  actionBar: '1000 units',
  attackSpeed: '×1 — sources converge: each multiplies remaining attack time by (1 − v)',
  extraSwings: 'overflow past the 0.5s attack-time floor, as extra hits per swing',
  dodge: '1 − 98% × 0.996^DEX',
  crit: '5% + 0.15% × DEX',
  armor: '0.3 × CON',
  spellPower: '2 + 1.5 × INT',
  skillXp: '1 + 1% × INT',
  trainXp: '1 + 1.2% × WIS',
  loot: '1 + 0.5% × WIS',
  goldGain: '1 + 1.2% × CHA',
  travelSpeed: '×1',
  craftSpeed: '×1',
  foodDuration: 'Cooking milestones add; read at most 150%',
  foodPotency: 'Cooking milestones add; read at most 150%',
  critDamage: '×2',
  penetration: '0',
  splash: '0',
  parry: '0',
  riposte: '30% of your damage',
  maxStamina: '10 + 0.5 × STR + 1 × CON',
  staminaRegen: '2% of Max Stamina + 0.005 × CON /s',
  staminaEff: '50% + 50% × 0.999^STR × 0.9985^DEX',
  staminaPower: '2 − Stamina Efficiency',
  maxMana: '1 × INT',
  manaRegen: '0.01 × INT + 0.05 × WIS /s',
  manaEff: '0.99967^INT × 0.9999^WIS',
  maxSpirit: '5 + 0.25 × WIS + 0.1 × CHA',
  maxFocus: '6 + 0.3 × CHA + 0.1 × WIS',
  focusRegen: '2% of Max Focus + 0.01 × CHA /s',
  psiPressure: '×1 — bias from gear only',
  psiMomentum: '×1 — bias from gear only',
  psiInertia: '×1 — bias from gear only',
  psiAcuity: '×1 — bias from gear only',
  psiAwareness: '×1 — bias from gear only',
  psiCoherence: '×1 — bias from gear only',
  psiPurchase: '×1 — bias from gear only',
  resSlashing: '0',
  resPiercing: '0',
  resBludgeoning: '0',
  resHeat: '0',
  resCold: '0',
  resPoison: '0',
  resArcane: '0',
  resLightning: '0',
  resEarth: '0',
  resWind: '0',
  resWater: '0',
  resLight: '0',
  resDark: '0',
};

/** Caps applied in getDerivedStats, surfaced in tooltips when they bite. */
const STAT_CAPS: Partial<Record<StatKey, number>> = {
  foodDuration: FOOD_MULT_CAP,
  foodPotency: FOOD_MULT_CAP,
  dodge: 0.75,
  crit: 0.9,
  penetration: 0.6,
  splash: 1,
  parry: PARRY_CAP,
  resSlashing: RESIST_CAP,
  resPiercing: RESIST_CAP,
  resBludgeoning: RESIST_CAP,
  resHeat: RESIST_CAP,
  resCold: RESIST_CAP,
  resPoison: RESIST_CAP,
  resArcane: RESIST_CAP,
  resLightning: RESIST_CAP,
  resEarth: RESIST_CAP,
  resWind: RESIST_CAP,
  resWater: RESIST_CAP,
  resLight: RESIST_CAP,
  resDark: RESIST_CAP,
};

export interface StatBreakdown {
  key: StatKey;
  /** Value from the base formula (attribute-driven), before any modifiers. */
  base: number;
  baseText: string;
  /** One line per modifier source — adds first, then multipliers. */
  lines: BreakdownLine[];
  /** Final value as the game uses it (clamps and rounding applied). */
  total: number;
  /** True when a hard cap trimmed the raw total. */
  capped: boolean;
}

/** Everything contributing to one derived stat, for tooltips. */
export function statBreakdown(state: GameState, key: StatKey): StatBreakdown {
  const mods = collectModifiers(state);
  const eff = effectiveAttrsFrom(state, mods);
  const base = baseStats((id) => attrValueFrom(state, eff, id))[key];
  const lines = groupModLines(mods.filter((m) => m.stat === key));
  let raw = base + lines.filter((l) => l.op === 'add').reduce((s, l) => s + l.value, 0);
  for (const l of lines) if (l.op === 'mult') raw *= 1 + l.value;
  const cap = STAT_CAPS[key];
  return {
    key,
    base,
    baseText: BASE_FORMULA_TEXT[key],
    lines,
    total: getDerivedStats(state)[key],
    capped: cap !== undefined && raw > cap,
  };
}

/** Combat attack fill per tick: speed scaled by the attack-speed multiplier. */
export function attackFillRate(stats: DerivedStats): number {
  return stats.speed * stats.attackSpeed;
}

/** Estimated ticks for an action bar of `size` units to fill at `fillPerTick`. */
export function actionTicks(size: number, fillPerTick: number): number {
  return size / Math.max(0.001, fillPerTick);
}