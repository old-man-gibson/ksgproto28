// Shared type definitions for the game core.
// Everything here is plain data — no DOM, no framework imports.

// ---------- Attributes ----------

export type AttributeId = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

// Attribute display metadata (ATTRIBUTE_LIST) and training-rank tables
// (ATTRIBUTE_TRAINING) are content — they live in data/attributes.data.ts.

// ---------- Super-attributes (fusion) ----------

export type SuperAttributeId = 'dominion' | 'force' | 'martial_prowess';

/**
 * Two base attributes fuse into a super-attribute once its unlock conditions
 * hold. From then on the super-attribute's value is the live sum of both
 * component levels, and every check that would read either component reads
 * the super-attribute instead.
 */
export interface SuperAttributeDef {
  id: SuperAttributeId;
  name: string;
  icon: string;
  /** Pixel icon: a name in src/ui/lib/icons/manifest.json; `icon` is the fallback. */
  art?: string;
  desc: string;
  components: [AttributeId, AttributeId];
  unlock: UnlockCondition[];
}

// ---------- Derived stats & modifiers ----------

/**
 * A quantity allowed to outgrow what a double can hold.
 *
 * Today this IS `number` — no runtime cost, no behaviour change. It exists so
 * that the day the game needs `break_eternity.js` (installed and ready), this
 * single line becomes:
 *
 *     import type Decimal from 'break_eternity.js';
 *     export type Big = Decimal;
 *
 * and the compiler enumerates every `+=`, comparison and `Math.*` call that has
 * to be converted, instead of leaving it to grep. Doubles run out at ~1.8e308,
 * which is a long way past anything currently reachable, so the swap is not
 * urgent — but everything it will touch is marked from here on.
 *
 * A transparent alias is a ledger, not a guard: it will not stop new raw-number
 * arithmetic being written against these fields in the meantime.
 */
export type Big = number;

export type StatKey =
  | 'maxHp'
  | 'hpRegen'
  | 'damage'
  | 'attackSpeed'
  | 'extraSwings'
  | 'dodge'
  | 'crit'
  | 'armor'
  | 'spellPower'
  | 'skillXp'
  | 'trainXp'
  | 'loot'
  | 'goldGain'
  | 'travelSpeed'
  | 'craftSpeed'
  /**
   * What the cook's skill does to the food you EAT (consumables.ts `foodScale`),
   * not to the food you make. Base 1; read at most ×1.5 (derived.ts FOOD_MULT_CAP).
   * Duration scales how long a dish's conditions last, Potency how hard they hit
   * and how much a dish restores. Player-side only: monsters do not eat.
   */
  | 'foodDuration'
  | 'foodPotency'
  | 'critDamage'
  | 'penetration'
  | 'splash'
  | 'parry'
  | 'riposte'
  | 'speed'
  | 'actionBar'
  | 'maxStamina'
  | 'staminaRegen'
  | 'staminaEff'
  | 'staminaPower'
  | 'maxMana'
  | 'manaRegen'
  | 'manaEff'
  | 'maxSpirit'
  | 'maxFocus'
  | 'focusRegen'
  /*
   * Psionic bias: multipliers on the DERIVED QUANTITIES a shape reads as
   * (systems/psionic.ts deriveShape). Base 1, and one per quantity on purpose
   * — matter carries a will unevenly, so bronze can sharpen sight while doing
   * nothing at all for a hammer.
   *
   * These are StatKeys rather than a bespoke item field so that everything
   * already feeding the Modifier pipeline can bias psionics for free: gear,
   * runes, affixes, achievements, titles, conditions, and a nullsteel-bearing
   * MONSTER via requiresMonsterTag. There is deliberately no `psiInward` —
   * gear changes how well a will does things, never which way it points.
   */
  | 'psiPressure'
  | 'psiMomentum'
  | 'psiInertia'
  | 'psiAcuity'
  | 'psiAwareness'
  | 'psiCoherence'
  | 'psiPurchase'
  | 'resSlashing'
  | 'resPiercing'
  | 'resBludgeoning'
  | 'resHeat'
  | 'resCold'
  | 'resPoison'
  | 'resAcid'
  | 'resArcane'
  | 'resLightning'
  | 'resEarth'
  | 'resWind'
  | 'resWater'
  | 'resLight'
  | 'resDark'
  /**
   * A general incoming multiplier, 1 by default and scaled DOWN by anything
   * that softens blows — `{ op: 'mult', value: -0.15 }` reads as "takes 15%
   * less". Applied after armor and resistances, because it describes the body
   * rather than the barrier.
   */
  | 'damageTaken'
  /**
   * A flat amount taken off every blow AFTER resistances, of any type.
   *
   * The mirror image of a resistance and the reason it exists separately: a
   * resistance is worth most against the biggest hit and a ward is worth most
   * against the smallest, so a body carrying both answers a swarm and a giant
   * with different halves of itself. Never takes a blow below the 1-damage
   * floor — nothing makes you untouchable.
   */
  | 'ward'
  /** Folded into every ELEMENTAL_TYPES resistance, so one modifier covers ten. */
  | 'resElemental'
  /** Reduction that applies only when the attacker is at range. */
  | 'resRanged'
  /**
   * How much of a critical hit's EXTRA damage gets through. 1 by default;
   * `{ op: 'mult', value: -0.4 }` reads as "crits hurt 40% less". Scales only
   * the surplus a crit adds, never the blow underneath it, so hardening
   * against crits can flatten them to an ordinary hit and never below.
   */
  | 'critTaken'
  /**
   * How much of a bad position's exposure you actually feel. 1 by default;
   * `{ op: 'mult', value: -0.4 }` reads as "stumbling costs you 40% less".
   *
   * Scales only the PENALTY — the share of a position's `incomingMult` above
   * 1. A guarded stance's 0.9 is a benefit and is never touched, so surefooted
   * bodies flatten their bad footing without also flattening their good.
   */
  | 'stumbleTaken'
  /**
   * The ceiling every resistance clamps to, 0.75 by default.
   *
   * A stat rather than a constant because raising the LIMIT is a different
   * thing from approaching it: a body built around an element wants headroom
   * nothing else can reach, and clamping to a global would have silently
   * discarded the last stretch of it.
   */
  | 'resistCap'
  /**
   * Extra damage PER SIZE STEP a target is smaller than you — 0.2 against
   * something two steps down is +40%. Nothing when the target is your size or
   * larger, so it is a bully's stat and never a general damage bonus.
   */
  | 'vsSmaller'
  /**
   * Damage reduction PER SIZE STEP an attacker is smaller than you. Same shape
   * in reverse: being enormous is its own armour against things that are not.
   */
  | 'fromSmaller'
  /**
   * Extra damage PER SIZE STEP a target is LARGER than you — `vsSmaller`'s
   * mirror, the underdog's stat. 0.2 against something one step up is +20%.
   * Nothing against your equals or anything smaller.
   */
  | 'vsLarger'
  /**
   * Share of every technique's REMAINING cooldown given back when a swing
   * misses — 0.1 takes a tenth off everything still ticking.
   *
   * A share rather than flat ticks, so it is worth the same to a long cooldown
   * as a short one and cannot be farmed by stacking cheap techniques. The
   * slimoid answer to whiffing: a body with nothing to over-commit recovers
   * from a miss faster than one that put its shoulder into it.
   */
  | 'missRefund'
  // `regenDoused` was here: a switch saying "heat and acid stop you knitting".
  // It could only ever say the ONE pair, because the types lived in a constant
  // rather than on the body. The rule is a condition now (`knitting`, conferred
  // by the gene, carrying its own `removal.damageTypes`), which is what makes
  // it per-body and rewritable — see MainGeneDef.confers.
  /**
   * Share of a swing that lands anyway when it misses — 0.25 means a whiff
   * still carries a quarter of the blow.
   *
   * A miss ordinarily produces no damage path at all, so this grows one. It
   * fires `onGraze` and counts toward `combat:grazes` and `kills:graze`, which
   * is what lets a technique be built to miss on purpose and an achievement ask
   * for kills that landed no cleanly.
   */
  | 'graze';

export const STAT_NAMES: Record<StatKey, string> = {
  damageTaken: 'Damage Taken',
  ward: 'Ward',
  resElemental: 'Elemental Resistance',
  resRanged: 'Ranged Resistance',
  critTaken: 'Crit Damage Taken',
  stumbleTaken: 'Exposure While Off Balance',
  resistCap: 'Resistance Ceiling',
  vsSmaller: 'Damage vs Smaller',
  fromSmaller: 'Resistance vs Smaller',
  vsLarger: 'Damage vs Larger',
  resAcid: 'Acid Resistance',
  missRefund: 'Cooldown Back on a Miss',
  graze: 'Graze Damage on a Miss',
  maxHp: 'Max HP',
  hpRegen: 'HP Regen',
  damage: 'Damage',
  attackSpeed: 'Attack Speed',
  extraSwings: 'Extra Swings',
  dodge: 'Dodge',
  crit: 'Crit Chance',
  armor: 'Armor',
  spellPower: 'Spell Power',
  skillXp: 'Skill XP',
  // Attribute XP, not "training" XP: it multiplies what STR/DEX/CON/INT/WIS/CHA
  // earn from training, jobs and crafting, and nothing a skill earns. The two
  // read alike in the sidebar until the name said which pool (2026-09-12).
  trainXp: 'Attribute XP',
  loot: 'Loot Luck',
  goldGain: 'Gold Gain',
  travelSpeed: 'Travel Speed',
  craftSpeed: 'Craft Speed',
  foodDuration: 'Food Duration',
  foodPotency: 'Food Potency',
  critDamage: 'Crit Damage',
  penetration: 'Penetration',
  splash: 'Splash Damage',
  parry: 'Parry',
  riposte: 'Riposte',
  speed: 'Speed',
  actionBar: 'Action Bar',
  maxStamina: 'Max Stamina',
  staminaRegen: 'Stamina Regen',
  staminaEff: 'Stamina Efficiency',
  staminaPower: 'Stamina Power',
  maxMana: 'Max Mana',
  manaRegen: 'Mana Regen',
  manaEff: 'Mana Efficiency',
  maxSpirit: 'Max Spirit',
  maxFocus: 'Max Focus',
  focusRegen: 'Focus Regen',
  psiPressure: 'Psi Pressure',
  psiMomentum: 'Psi Momentum',
  psiInertia: 'Psi Inertia',
  psiAcuity: 'Psi Acuity',
  psiAwareness: 'Psi Awareness',
  psiCoherence: 'Psi Coherence',
  psiPurchase: 'Psi Purchase',
  resSlashing: 'Slashing Res.',
  resPiercing: 'Piercing Res.',
  resBludgeoning: 'Bludgeon Res.',
  resHeat: 'Heat Res.',
  resCold: 'Cold Res.',
  resPoison: 'Poison Res.',
  resArcane: 'Arcane Res.',
  resLightning: 'Lightning Res.',
  resEarth: 'Earth Res.',
  resWind: 'Wind Res.',
  resWater: 'Water Res.',
  resLight: 'Light Res.',
  resDark: 'Dark Res.',
};

// ---------- Damage types ----------

export type DamageType =
  | 'slashing'
  | 'piercing'
  | 'bludgeoning'
  | 'heat'
  | 'cold'
  | 'poison'
  /**
   * Acid. Its signature condition eats ARMOUR rather than health — see
   * `corroded` — which makes it the answer to a thing that is hard rather than
   * a thing that is tough.
   */
  | 'acid'
  | 'arcane'
  | 'lightning'
  | 'earth'
  | 'water'
  | 'wind'
  | 'light'
  | 'dark';

export const DAMAGE_TYPE_NAMES: Record<DamageType, string> = {
  acid: 'Acid',
  slashing: 'Slashing',
  piercing: 'Piercing',
  bludgeoning: 'Bludgeoning',
  heat: 'Heat',
  cold: 'Cold',
  poison: 'Poison',
  arcane: 'Arcane',
  lightning: 'Lightning',
  earth: 'Earth',
  water: 'Water',
  wind: 'Wind',
  light: 'Light',
  dark: 'Dark',
};

// ---------- Wuxin ----------

/**
 * One slot of a five-element cycle: what it holds, what it feeds, what it
 * fights. A null arrow is SEVERED — deliberately cut, which is how the
 * non-harmonious configurations are expressed. See systems/wuxin.ts for the
 * grammar these are written in and the rules about which shapes are legal.
 */
export interface WuxinBond {
  /** An arcane noun id. The lexicon informs the vocabulary; it is not magic. */
  element: string;
  /** The element this one nourishes, or null if that arrow is cut. */
  nourishes: string | null;
  /** The element this one hinders, or null if that arrow is cut. */
  hinders: string | null;
}

/** A whole cycle — the player's, a sect's, a great beast's. */
export interface WuxinConfig {
  slots: WuxinBond[];
}

/** Physical types are reduced by flat armor before percentage resistance. */
export const PHYSICAL_TYPES: ReadonlySet<DamageType> = new Set(['slashing', 'piercing', 'bludgeoning']);

/** The player resistance stat protecting against each damage type. */
/**
 * The elemental damage types — everything `resElemental` folds into.
 *
 * Deliberately excludes the three physical types: a body that "resists the
 * elements" is saying something about heat and lightning, not about swords.
 */
/**
 * The size ladder, smallest first. Mirrors the `size` category in
 * bestiary.data.ts and IS the order — an index into this is a size, and the
 * gap between two indices is how many steps apart two things are.
 *
 * The player sits at `medium` unless a main gene says otherwise, which is what
 * lets a gigantoid mean something mechanical rather than only in the fiction.
 */
export const SIZE_LADDER = [
  'diminutive',
  'tiny',
  'small',
  'medium',
  'large',
  'huge',
  'gargantuan',
  'colossal',
] as const;

export type SizeTag = (typeof SIZE_LADDER)[number];

/** Where a size sits on the ladder. Anything unrecognised reads as medium. */
export function sizeRank(size: string | undefined): number {
  const i = SIZE_LADDER.indexOf(size as SizeTag);
  return i === -1 ? SIZE_LADDER.indexOf('medium') : i;
}

export const ELEMENTAL_TYPES: ReadonlySet<DamageType> = new Set<DamageType>([
  'heat',
  'cold',
  'poison',
  'acid',
  'arcane',
  'lightning',
  'earth',
  'wind',
  'water',
  'light',
  'dark',
]);

export const RES_STAT_BY_TYPE: Record<DamageType, StatKey> = {
  slashing: 'resSlashing',
  piercing: 'resPiercing',
  bludgeoning: 'resBludgeoning',
  heat: 'resHeat',
  cold: 'resCold',
  poison: 'resPoison',
  acid: 'resAcid',
  arcane: 'resArcane',
  lightning: 'resLightning',
  earth: 'resEarth',
  wind: 'resWind',
  water: 'resWater',
  light: 'resLight',
  dark: 'resDark',
};

// ---------- Damage reports (the maths behind a fight-feed number) ----------

/**
 * One typed slice of a single blow, from what produced it to what finally
 * landed: a sword's own slashing damage, a rune's lightning rider, a spell.
 * Everything here is pre-rounding — the feed line rounds the sum, not the parts.
 */
export interface DamageSlice {
  type: DamageType;
  /** What produced it: 'Iron Sword', 'Minor Rune of Thunder', 'Fireball'… */
  source: string;
  /** Before the target's defences. */
  raw: number;
  /** Absorbed by flat armor — physical blows against the player only. */
  armor: number;
  /** Shed by typed resistance. Negative when the target is vulnerable to it. */
  resisted: number;
  /** The resistance that actually applied, after penetration. */
  resistance: number;
  /** Resistance erased by penetration; 0 when nothing was pierced. */
  pierced: number;
  /** Eaten by a flat ward, after resistances. Player only. */
  warded?: number;
  /** What the target actually took from this slice. */
  dealt: number;
}

/**
 * One step in assembling a blow, before it meets the target. Either a starting
 * `value` ("Damage 34") or a `mult` applied to it ("×1.5 Heavy Strike"); a step
 * with neither is a plain note ("±10% variance").
 */
export interface DamageStep {
  label: string;
  value?: number;
  mult?: number;
}

/** Everything behind one damage number in the fight feed, for its tooltip. */
export interface DamageReport {
  /** What struck: 'Your attack', 'Fireball', 'The wolf'. */
  label: string;
  /** What was struck: a monster's name, or 'You'. */
  target: string;
  /** How the blow was built before the target's defences. */
  steps: DamageStep[];
  /** Where every point went, one row per (type, source). */
  slices: DamageSlice[];
  /** Simultaneous blows resolved into this one feed line (flurries). */
  hits: number;
  /** At least one of them critted. */
  crit: boolean;
  /** The player is the one taking it, not dealing it. */
  incoming?: boolean;
  /** The rounded number actually taken off the target's HP. */
  total: number;
}

/** A fight-feed line: what happened, plus the maths behind its number. */
/** One affliction run's running total, as shown beneath a feed line. */
export interface FeedAffliction {
  /** "🩸 Afflictions:" — the same prefix the folded line used to carry. */
  prefix: string;
  tally: LogTally[];
  /**
   * The run's accumulated working, when it has one.
   *
   * A run that reports DAMAGE owes the same tooltip an ordinary blow does —
   * more so, because a running total is the one number a player cannot check by
   * eye. Slices accumulate across the run; `steps` describe the newest blow,
   * which is the contract a flurry already ships.
   */
  report?: DamageReport;
}

/**
 * An affliction run still going. It is NOT a feed entry: while it runs it is
 * drawn against whatever line is newest, and it settles onto that line only
 * when it ends — see `feedFloating` / `settleFloating` in systems/log.ts.
 */
export interface FloatingAffliction extends FeedAffliction {
  /** Which run this is: one per bearer side, `cond:foes` / `cond:self`. */
  group: string;
  /** Status ids still feeding it. None held by anyone → the run is over. */
  ids: string[];
}

export interface FeedEntry {
  text: string;
  damage?: DamageReport;
  /**
   * Affliction runs that ENDED while this was the newest line, frozen onto it.
   * They ride it down the feed as new lines push in above, so "what the poison
   * cost you" stays next to the exchange it was still running during.
   */
  afflictions?: FeedAffliction[];
  /**
   * Repeat key, mirroring LogEntry's. A line with the same group as the newest
   * one folds into it instead of pushing; `prefix` and `tally` are what get
   * re-rendered. Condition ticks are why this exists: a bleed spends fifteen
   * ticks saying the same thing, and the feed only keeps ten lines, so without
   * folding a poison would evict the fight that caused it.
   */
  group?: string;
  prefix?: string;
  tally?: LogTally[];
}

/**
 * Modifiers can target a derived stat OR an attribute: "+2 Strength" from a
 * sword and "+10% damage" ride the same pipeline. Attribute-targeted mods
 * change the EFFECTIVE attribute (trained level stays untouched), which every
 * formula and unlock check reads.
 */
/**
 * A stat that only applies to work carrying a particular tag:
 * `craftSpeed:leatherworking` speeds up leatherworking and nothing else, while
 * plain `craftSpeed` is unconditional.
 *
 * Scoped mods deliberately never reach the flat stat block — `DerivedStats` is
 * a closed record, and a bonus that applies "sometimes" cannot be a single
 * number. They are resolved at the moment the tagged work is done, the same
 * way `requiresMonsterTag` is resolved at the moment of a blow.
 */
export type ScopedStat = `${StatKey}:${string}`;

export type ModTarget = StatKey | AttributeId | ScopedStat;

/**
 * Named nonlinear level curves (implemented in systems/attributes.ts).
 * `resistTiered`: each level multiplies damage TAKEN by (1 − step) — 1%
 * ordinarily, 3% every 5th level, 5% every 10th, 10% every 25th (the biggest
 * applicable step wins) — and the resolved value is the total fraction
 * blocked, 1 − Π(1 − stepᵢ). Crosses RESIST_CAP around level 75; the cap in
 * derived.ts does the clamping, so headroom exists if the cap is ever raised.
 */
export type LevelCurveId = 'resistTiered';

/**
 * A single stat modification. The universal building block used by equipment,
 * achievements, combat styles, passive skills and temporary buffs.
 * `op: 'add'` adds to the base value; `op: 'mult'` multiplies the total by (1 + value).
 * EXCEPTION: `attackSpeed` mults converge — each multiplies remaining attack
 * TIME by (1 − value), capped per source, floored at MIN_ATTACK_TICKS with
 * overflow paid as extra swings (see derived.ts).
 * `perLevel` scales the value with a source level (e.g. passive skill level).
 * `requiresTag` makes the modifier conditional on an equipped-item tag
 * ('unarmed' is a pseudo-tag present when no weapon is equipped).
 * `requiresStyle` makes it conditional on the style you are actually fighting
 * in — how a school's mastery pays off only while you practise that art.
 * NOTE: combat styles may only target StatKeys, never attributes.
 */
export interface Modifier {
  stat: ModTarget;
  op: 'add' | 'mult';
  value: number;
  perLevel?: number;
  /**
   * Nonlinear level scaling by name, for growth a straight `perLevel` line
   * cannot express. Adds LEVEL_CURVES[levelCurve](level) on top of `value` +
   * `perLevel` (see systems/attributes.ts for the curves themselves).
   */
  levelCurve?: LevelCurveId;
  requiresTag?: string;
  /** Style id that must be the effective one for this modifier to apply. */
  requiresStyle?: string;
  /**
   * Monster tag the CURRENT TARGET must carry, e.g. 'slime' or 'goblin'. These
   * never reach the global stat block — they are resolved per-target at the
   * moment of a blow, so several matching hunter bonuses stack on one monster
   * that carries several of their tags.
   */
  requiresMonsterTag?: string;
  /**
   * Derive this modifier's value from another stat: the value is multiplied by
   * whatever `fromStat` finally reads.
   *
   * The pattern both genera keep reaching for — a troll hitting harder for its
   * bludgeoning resistance, a fire slime whose technique damage rises with its
   * heat resistance, a slime bounce that lands for its armour. It turns a
   * DEFENSIVE stat into an offensive one, which is a build identity rather than
   * a number: stacking heat resistance becomes the damage plan.
   *
   * Resolved in a pass of its own, AFTER every ordinary modifier and every
   * clamp, so the source is always its final value. One consequence worth
   * knowing: a derived modifier cannot feed another derived modifier. That is
   * deliberate — it makes cycles impossible by construction rather than by
   * checking for them.
   */
  fromStat?: StatKey;
  /**
   * Immune to condition damping — this bonus is part of you rather than
   * something you are carrying. The escape hatch for an "uncanny dodge" that
   * keeps working while flat-footed, without teaching the Modifier about any
   * particular condition.
   */
  undampened?: boolean;
}

/**
 * Where a modifier came from, in a form code can test — as opposed to
 * `ResolvedMod.source`, which is a label for humans. A status that dulls "your
 * weapon's bonuses" has to be able to pick those lines out of the pile, and
 * "Oak Staff" is not something to pattern-match on.
 */
export type ModOriginKind =
  | 'item'
  | 'affix'
  | 'rune'
  | 'handBonus'
  | 'achievement'
  | 'skill'
  | 'training'
  | 'title'
  | 'buff'
  | 'status'
  | 'style'
  /** Character level (systems/levels.ts): a flat add to every attribute. */
  | 'level';

export interface ModOrigin {
  kind: ModOriginKind;
  /** Equipment slot the modifier is worn in, for the gear-borne kinds. */
  slot?: SlotId;
}

export type DerivedStats = Record<StatKey, number>;

/**
 * The stats that carry unbounded magnitude, and so become `Big` if the game
 * ever outgrows doubles. Everything else in `StatKey` is bounded by design —
 * chances (`crit`, `dodge`, `parry`), resistances, and rate multipliers all sit
 * in a small range no matter how far the game runs, and making them big-number
 * would be pure cost on the hot path.
 *
 * Declared here, now, because this is a CONTENT decision as much as a code one:
 * every item, rune and achievement modifier targets one of these keys, and
 * working out which side of the line each one falls on gets harder with every
 * one added. Adding a key later is fine; auditing a year of content is not.
 */
export const BIG_STATS = ['damage', 'maxHp', 'maxMana', 'spellPower', 'armor'] as const;
export type BigStatKey = (typeof BIG_STATS)[number];
export type BoundedStatKey = Exclude<StatKey, BigStatKey>;

// ---------- Unlock conditions ----------

export type UnlockCondition =
  | { type: 'skill'; id: string; level: number }
  | { type: 'attr'; attr: AttributeId; level: number }
  | { type: 'stat'; key: string; value: number }
  /**
   * Counter must be AT OR BELOW value — for purity/restraint conditions
   * ("defeat X while weapon:families ≤ 1"). Evaluated live: pair it with a
   * trigger condition (a kill/quest stat) so the whole set latches at the
   * moment the deed is done.
   */
  | { type: 'statMax'; key: string; value: number }
  | { type: 'equippedTag'; tag: string }
  /** Met once the named quest has been turned in. */
  | { type: 'quest'; id: string };

// ---------- Skills ----------

export type SkillCategory = 'combat' | 'magic' | 'resistance' | 'craft' | 'general' | 'environmental';

export interface SkillCategoryDef {
  id: SkillCategory;
  name: string;
  icon: string;
}

/** Display order of skill categories in the UI. */
export const SKILL_CATEGORIES: SkillCategoryDef[] = [
  { id: 'combat', name: 'Combat', icon: '⚔️' },
  { id: 'magic', name: 'Magic', icon: '✨' },
  { id: 'resistance', name: 'Resistances', icon: '🛡️' },
  { id: 'craft', name: 'Crafting', icon: '⚒️' },
  { id: 'general', name: 'General', icon: '🧭' },
  { id: 'environmental', name:'Environmental', icon: '🏞️'}
];

export type ActiveSpec =
  | { type: 'strike'; damageMult: number; cooldown: number }
  | { type: 'spell'; power: number; cooldown: number; damageType?: DamageType }
  | { type: 'buff'; mods: Modifier[]; duration: number; cooldown: number }
  /**
   * A body's own tool, scaling off whatever that body is good at.
   *
   * The fourth variant exists because the other three cannot say what every
   * gene ability says: a slime bounce lands for its ARMOUR, a flaming bounce
   * for its heat resistance, a slime crash for armour and speed. `strike`
   * multiplies weapon damage and `spell` multiplies spell power; neither can
   * read an arbitrary stat, and that reading is the whole identity — it is what
   * makes a defensive build an offensive one.
   */
  | {
      type: 'gene';
      /**
       * PER-POINT pricing: damage per point of `fromStat`. Right for an
       * UNBOUNDED stat — Damage, Armor and Max HP climb forever, so a blow
       * priced off one climbs with them.
       *
       * Omit both for a flat blow that is MULTIPLIED instead — see
       * `amplifiedBy`, which is what a bounded stat needs.
       */
      power?: number;
      fromStat?: StatKey;
      /**
       * Price per point of an ATTRIBUTE instead of a derived stat.
       *
       * Attributes are not StatKeys — they are the layer underneath — so a
       * blow that reads one needs its own field rather than a cast. Mutually
       * exclusive with `fromStat`; an ability priced off Charisma is saying
       * something about the body, not about its gear.
       */
      fromAttr?: AttributeId;
      /**
       * Damage owed to the SPECIES rather than the build, added before any
       * multiplier. This is what makes a jötunn's throw worth more than a hill
       * giant's at identical stats — the arm is bigger, not the technique.
       */
      flat?: number;
      /**
       * AMPLIFIED pricing: multiply the whole blow by `1 + this stat`.
       *
       * The shape a BOUNDED stat needs. A resistance runs 0…`resistCap`, so
       * pricing per point gives a blow worth almost nothing early, worth its
       * ceiling the moment the cap is reached, and worth exactly that forever
       * after — which is what "9000% of your Heat Res. (0.75)" was saying out
       * loud. As a multiplier the cap reads ×1.75 instead, and a NEGATIVE
       * resistance legitimately takes damage off rather than being ignored.
       *
       * Never per-point a resistance. There is no attribute behind one, so it
       * has no long-run growth of its own to lend.
       */
      amplifiedBy?: StatKey;
      /**
       * Multiply by `speed ÷ BASE_SPEED`, so an ordinary body is ×1.
       *
       * The bounce family's long-run scalar. A bounce is a body thrown at
       * somebody, so how fast it moves is how hard it lands — and unlike a
       * resistance, speed has an attribute behind it and climbs forever.
       */
      scalesWithSpeed?: boolean;
      cooldown: number;
      damageType?: DamageType;
      /** Typed damage carried alongside the main blow, resisted separately. */
      riders?: { type: DamageType; value: number }[];
      /**
       * PRICED OFF THE TARGET, not off you.
       *
       * Every other pricing field here reads the caster — `power`/`fromStat`,
       * `fromAttr`, `amplifiedBy`, `scalesWithSpeed`, `flat`. That is right for
       * a body throwing itself at somebody, and useless for a blow whose whole
       * idea is what the target has been accumulating.
       *
       * STACKS, not intensity: this asks how many times a thing has happened to
       * them, not how hard each one bit. A condition that separates the two —
       * `hunger_anupama` does — is the reason the distinction is worth having.
       */
      perTargetStacks?: {
        /** The condition on the target whose stacks price the blow. */
        status: string;
        /** Damage per stack, added alongside `flat`. */
        power: number;
        /**
         * When set, everything in `inflicts` lands at this root of the same
         * count instead of its authored intensity: [worst grade, best].
         *
         * A root because the count is uncapped by design — the thing this
         * exists for is an appetite with no ceiling, and a linear read of it
         * would make the slow absolute long before the fight ended.
         */
        inflictRoot?: [number, number];
      };
      /** Conditions the blow leaves behind, on everything it reached. */
      inflicts?: StatusApplication[];
      /** Ticks of the target's action bar this steals — the mini-stun. */
      stun?: number;
      /** Share of the blow that also reaches everything else in the formation. */
      splash?: number;
      /**
       * Splash reaches EVERY flank rather than one at random — the difference
       * between a blow that carries past its target and one thrown at the room.
       */
      splashAll?: boolean;
      /**
       * Doubles for every N size steps the target is below you. Multiplicative
       * where `vsSmaller` is linear, so it is reserved for the throws whose
       * whole joke is the scale of the thing being thrown.
       */
      sizeDouble?: number;
      /**
       * Kills outright anything whose remaining health is under this share of
       * the blow that just landed — "significantly weaker" measured against
       * the ability itself, so it scales with the build instead of with level.
       */
      execute?: number;
      /**
       * Ticks knocked off the player's OWN bar as the blow lands — a heavy
       * body's wind-up, paid next to the swing rather than before it. The
       * throughput cost is the same either way; only the order differs, and
       * this way it needs no queued-action machinery to say.
       */
      selfDelay?: number;
      /**
       * Footwork does not help against this. Authorable, but the reason it
       * exists is `ignores_dodge` routed into the Active arm — a capability
       * arriving at the centromere has to be able to say something about the
       * ability, and this is the field it says it in.
       */
      sure?: boolean;
      /**
       * A WIND-UP: using this begins an incantation instead of landing, and the
       * blow falls when it finishes.
       *
       * The bar keeps filling meanwhile, at `fillMult` of its usual rate — so
       * the cost is not "a turn" but "most of several", and everything else you
       * would have done in that window is what you are actually paying. What
       * lands at the end is this same spec, with the crit bonus applied.
       */
      incant?: {
        /** Ticks the incantation takes: [worst grade, best]. */
        ticks: [number, number];
        /** What the action bar fills at while it runs. ⅓ = 0.333. */
        fillMult: number;
        /** Added to crit chance for the blow it ends in. 1 = certain. */
        critBonus: number;
      };
      /**
       * Conditions the user puts on THEMSELVES — a ward, a stance, a shield.
       *
       * Distinct from `inflicts`, which lands on whoever was hit. Named
       * `grants` to match SpellSpec, where it already means exactly this.
       */
      grants?: StatusApplication[];
      /** How long `grants` hold, in ticks: [worst grade, best]. */
      grantDuration?: [number, number];
      /**
       * Strips every condition off everyone — you, them, all of them — and
       * pays out per condition taken, split evenly among whoever is standing.
       *
       * The blow is the ERASURE, so the payout scales with how much there was
       * to erase rather than with the target. It cuts both ways by design: a
       * body running on its own afflictions unsays those too.
       */
      clearsField?: boolean;
      /**
       * A VOLLEY: instead of a blow, every floating grip is reset and made to
       * strike, `hits` times, rippling over `ticks`.
       *
       * Says nothing about damage — each strike is an ordinary floating swing
       * (combat.ts, `floatingSwing`), so a volley is a burst of the throughput
       * the body already had rather than a second damage formula.
       */
      volley?: {
        /** Strikes the volley fires: [worst grade, best]. */
        hits: [number, number];
        /** Ticks they ripple over. */
        ticks: number;
      };
    };

/**
 * A flat bonus earned once a level threshold is passed, on top of the smooth
 * `perLevel` effects. Unlike effects, milestone bonuses are NOT scaled by level
 * — they are granted whole and stay granted, cumulatively.
 */
export interface Milestone {
  level: number;
  bonus: Modifier[];
}

// ---------- XP curves ----------

/** How much one level of a skill fundamentally costs. Values in progression.data.ts. */
export type XpBaseTier =
  | 'beginner'
  | 'novice'
  | 'adept'
  | 'proficient'
  | 'expert'
  | 'master'
  | 'legendary';

/** How steeply cost compounds per level, named from the learner's side ('fast' = levels arrive fast). */
export type XpGrowthRate = 'fast' | 'normal' | 'slow' | 'glacial';

/**
 * One stretch of a skill's XP curve, in force from `from` until the next band
 * starts. The first band must start at level 1 and the list must stay sorted.
 */
export interface ProgressionBand {
  from: number;
  base: XpBaseTier;
  rate: XpGrowthRate;
}

/**
 * The knowledge domains novelty is drawn from. A domain is the system that
 * knows what "something new" means: the bestiary knows a species is unfamiliar,
 * a library knows a book is unread. Skills declare which domain they learn in,
 * so the domain never has to know which skills are listening.
 */
export type NoveltyDomain =
  | 'bestiary'
  | 'library'
  | 'dialogue'
  | 'arcana'
  | 'geneshaping'
  | 'weather'
  /** Dishes cooked, keyed by dish material id (systems/cooking.ts `cook`). */
  | 'cookery';

/**
 * Novelty learning: a skill that advances on NEW information rather than on
 * repetition. Every input is worth `(k + n) / (c + n)` times the ordinary
 * payout, where `n` counts how often that exact input has already been offered.
 *
 * The curve starts at `k / c` for something never seen before and decays
 * asymptotically to 1 — repetition never becomes worthless, it just stops being
 * remarkable. `c` sets how fast the novelty wears off: a small `c` means the
 * second encounter already teaches far less than the first.
 *
 * The roadblock this creates is deliberate and emerges on its own: once every
 * input is familiar the yield sits at the floor while the XP curve keeps
 * climbing, so a hunter who has killed everything nearby has to go and find
 * something they have not killed before.
 */
export interface NoveltySpec {
  domain: NoveltyDomain;
  /** Numerator base. With `c`, fixes the opening yield at `k / c`. */
  k: number;
  /** Dampener: how quickly a repeated input stops being informative. */
  c: number;
  /** Flat XP each time the domain records something genuinely new. */
  discovery: number;
}

export interface SkillDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  kind: 'passive' | 'active';
  category: SkillCategory;
  /** Actions/combat ticks whose tags intersect these grant XP and can discover the skill. */
  tags: string[];
  /** Parent skill in the branch tree (display + implied progression). */
  parent?: string;
  /** All conditions must hold for the skill to manifest while performing a matching action. */
  unlock: UnlockCondition[];
  /** Passive stat effects, scaled by skill level via `perLevel`. */
  effects?: Modifier[];
  /** Present iff kind === 'active'. */
  active?: ActiveSpec;
  /** Cosmetic mastery-tier names shown at level thresholds (e.g. lv40 "Martial Arts"). */
  tierNames?: { level: number; name: string }[];
  /**
   * XP curve: how expensive this skill's levels are and how that escalates.
   * Normally one of the named shapes in progression.data.ts (`PROGRESSIONS.x`)
   * rather than hand-written bands. Omitted means `DEFAULT_PROGRESSION`.
   *
   * Deliberately independent of `tierNames`: a curve band and a title threshold
   * usually coincide, but neither should force the other to move.
   */
  progression?: ProgressionBand[];
  /**
   * Base level cap. At the cap the skill shows as maxed and further XP is
   * DISCARDED — not banked, unlike the usual settle — so time at the ceiling
   * buys nothing. Levels beyond it exist only through cap raises
   * (`SkillState.capRaised`: quests, events, prestige). Omitted = uncapped.
   */
  maxLevel?: number;
  /**
   * Present on skills that learn from new information rather than from drill.
   * Absent means the skill takes every payout at face value, however many times
   * it has done the same thing.
   */
  novelty?: NoveltySpec;
  /**
   * Unscaled bonuses granted at level thresholds, mirroring attribute training
   * milestones. Must stay sorted by level.
   */
  milestones?: Milestone[];
}

// ---------- Combat styles ----------

// ---------- Resource pools ----------

/**
 * Every pool the player spends and recovers. Adding one means adding an id
 * here and a `ResourceDef` in `data/resources.data.ts` — everything that reads
 * pools (regen, clamping, lockouts, trigger subjects, the sidebar bars) walks
 * the registry rather than naming fields, so nothing else has to change.
 */
export type ResourceId = 'hp' | 'stamina' | 'mana' | 'spirit' | 'focus';

/**
 * Spending lockout on a pool with a reserve. 'low' latches at the reserve
 * floor, 'empty' at zero; either way it stays locked until the pool has
 * refilled completely. Pools with no `reserve` are never anything but 'none'.
 */
export type ResourceLock = 'none' | 'low' | 'empty';

/**
 * A pool's reserve behaviour: the floor ordinary spending stops at, what to
 * call each lockout, and what running dry costs while it lasts.
 */
export interface ResourceReserve {
  /** Spending stops once the pool falls to this share of TRUE max. */
  share: number;
  /** Display names for the two lockouts ("Winded", "Exhausted"). */
  lowName: string;
  emptyName: string;
  lowIcon: string;
  emptyIcon: string;
  /** Bar colours while each lockout holds (fall back to the pool's own). */
  lowCssVar?: string;
  emptyCssVar?: string;
  /** Log lines announced once per transition (see Game.checkResourceLocks). */
  lowMsg: string;
  emptyMsg: string;
  /** Announced when either lockout clears. */
  clearedMsg: string;
  /** Recovery is slowed by this factor while 'empty' and below `slowUntil`. */
  emptyRegenMult: number;
  slowUntil: number;
  /** What being 'empty' costs, as ordinary modifiers (see lockMods). */
  emptyPenalty?: Modifier[];
}

/**
 * One resource pool. The current value lives in `state.resources[id]`; the
 * capacity and recovery rate are derived stats named here, so a pool never
 * stores anything it can compute.
 */
export interface ResourceDef {
  id: ResourceId;
  name: string;
  icon: string;
  /** Pixel icon: a name in src/ui/lib/icons/manifest.json; `icon` is the fallback. */
  art?: string;
  /** CSS custom property backing this pool's bar colour. */
  cssVar: string;
  /** Derived stat holding the pool's TRUE maximum. */
  maxStat: StatKey;
  /** Derived stat holding per-second recovery; absent = does not regenerate. */
  regenStat?: StatKey;
  /**
   * Recovery is applied by another system rather than by `tickResources` —
   * health is the case: every point of HP has to come in through `heal()` so
   * conditions can observe the treatment (a burn caps it, a bleed closes on
   * it), which the generic pool regen would bypass. The pool is still clamped
   * here, and `regenStat` still names the rate; only the topping-up moves.
   */
  viaHeal?: boolean;
  /**
   * What sitting down to rest multiplies this pool's recovery by. Absent = 1:
   * resting does nothing special for it. Health grades recovery by activity
   * more finely than this (see RECOVERY_MULT) — for every other pool, all that
   * matters is whether you are actually resting.
   */
  restRegenMult?: number;
  /** Derived stat holding the consumption multiplier applied to costs. */
  effStat?: StatKey;
  /** Reserve floor and lockout behaviour; absent = spendable to zero, no lock. */
  reserve?: ResourceReserve;
  /**
   * Held at max every tick rather than recovering gradually — a pool that is
   * a standing reserve rather than something spent (Spirit, today).
   */
  static?: boolean;
}

// ---------- Status conditions ----------

/**
 * How a second application of the same condition combines with the first.
 * Every one of these is in use by real content — see data/statuses.data.ts.
 */
export type StatusStackMode =
  /** Keep whichever is strongest; a weaker application is simply ignored. */
  | 'highest'
  /** Fold a share of the newcomer into the existing one; duration untouched. */
  | 'absorb'
  /** Intensities add, up to `cap` — which may then escalate the condition. */
  | 'sum'
  /** Each application is its own instance, counted rather than merged. */
  | 'count'
  /**
   * Duration adds instead of magnitude: a second flash does not dazzle you
   * worse, it dazzles you for longer. `cap` counts stacks.
   */
  | 'extend';

export interface StatusStacking {
  mode: StatusStackMode;
  /** Refresh the duration on reapplication without adding intensity or stacks. */
  refreshDuration?: boolean;
  /** 'absorb': share of the new application's intensity that is folded in. */
  absorb?: number;
  /** Ceiling on summed intensity ('sum') or instance count ('count'). */
  cap?: number;
  /** What reaching the cap does. Default: clamp. */
  onCap?: 'escalate' | 'clamp';
  /**
   * Escalation intensity multiplier: the worse form arrives at the held
   * intensity × this. What makes three threads of Unravelling catch as a
   * conflagration of manaburn rather than a candle of it.
   */
  escalateMult?: number;
  /**
   * Escalation becomes a ROLL rather than a certainty once the measure reaches
   * this, the odds climbing with the charge until `cap`, where it is certain.
   * A failed roll clamps and stays primed, so the next dose rolls again.
   *
   * For escalations dangerous enough that being able to *schedule* them would
   * be the whole exploit (jolted → shocked locks the action bar): the charge is
   * visibly building and which dose turns it is not yours to choose. Every
   * other ladder in the game is deterministic at `cap` — leave this absent and
   * nothing changes.
   *
   * Requires `cap`, `onCap: 'escalate'` and the def's `escalatesTo`, and must
   * sit below `cap`. All four are linted in both validation layers.
   */
  escalateFrom?: number;
}

/** Things that can end a condition, beyond its timer simply running out. */
export type StatusEvent =
  | 'heal'
  | 'damageTaken'
  | 'damageDealt'
  | 'barFill'
  | 'barDeplete'
  | 'combatEnd'
  /** A named cure — a water spell against a burn, a tourniquet against a bleed. */
  | 'cure';

/**
 * One way a condition can end. Sources declare their own, which is what lets
 * the same burn be a five-second nuisance from a torch and a permanent one
 * from a curse that only water will put out.
 */
export interface StatusRemoval {
  on: StatusEvent;
  /** For 'heal': only these kinds count (a blaze yields to salves, not to idling). */
  healKinds?: string[];
  /** For 'cure': the cure tag that matches, e.g. 'water'. */
  tag?: string;
  /**
   * For the damage events: only blows of these types count. A drenching is
   * driven off by fire and ignores everything else.
   */
  damageTypes?: DamageType[];
  /**
   * How many matching events it takes. Partial progress is remembered on the
   * instance, so "three fire hits" means three, not one per fight.
   */
  after?: number;
  /**
   * How much matching DAMAGE it takes, as a total rather than a count.
   *
   * The difference from `after` is the whole point: three sparks and one
   * thunderbolt are three events either way, and for anything that should
   * answer to *how hard* it was hit — a golem waking on the lightning it
   * absorbs — counting blows is the wrong measure. Progress accumulates on the
   * instance exactly as `after`'s does; declaring both means both must be met.
   */
  afterDamage?: number;
  /**
   * Gone entirely, dropped back to its milder form, weakened, or one stack
   * lighter ('unstack' — a daze that costs you one action per instance).
   */
  effect?: 'remove' | 'deescalate' | 'reduce' | 'unstack';
  /** For 'reduce': the share of intensity taken off. */
  amount?: number;
  /**
   * What takes its place when it goes — for 'remove' only.
   *
   * Distinct from 'deescalate', which walks down to the condition's own milder
   * form: this replaces it with something unrelated, which is what lets a pair
   * of conditions express a STATE MACHINE rather than only a ladder. A body
   * stops knitting and starts being doused; a golem's shutdown gives way to a
   * live one when the lightning lands.
   */
  becomes?: string;
}

/** Damage a condition deals each tick. All three sources add together. */
export interface StatusDot {
  type: DamageType;
  /** Flat damage per tick, per point of intensity. */
  flat?: number;
  /** Share of the bearer's CURRENT hp per tick, per intensity (a bleed). */
  currentHp?: number;
  /** Share of the bearer's MAX hp per tick, per intensity (a laceration). */
  maxHp?: number;
  /**
   * Parts that scale with the WORST single application rather than the total.
   *
   * Several cuts bleed more blood than one, so the flat part adds up — but they
   * do not each open you a little wider, so the proportional part is set by the
   * deepest cut alone. Listing a part here scales it by the instance's `peak`
   * instead of its `intensity`.
   */
  fromPeak?: ('flat' | 'currentHp' | 'maxHp')[];
  /** Multiplier applied while out of combat — a wound bleeds slower at rest. */
  outOfCombat?: number;
  /**
   * Share of this tick that ignores resistance to its type — and immunity to
   * it. 0, the default, is the ordinary behaviour: the whole tick is resisted.
   *
   * The resisted remainder is floored at zero SEPARATELY, so the pierced share
   * always lands in full. That is the whole difference between "resistance is
   * halved here" and "half of this cannot be resisted", and only the second
   * one survives meeting something actually immune.
   *
   * Deliberately a share rather than an untyped flag. The dot keeps a real
   * `type`, so resistance still means something for the remainder, and nothing
   * has to escape the damage-type system in order to be partly unblockable —
   * which is what an untyped dot would have cost.
   */
  pierce?: number;
}

/**
 * A pool this condition GIVES BACK, spread across its duration — the mirror of
 * StatusDot. This is what makes a cooked dish different from a potion: the
 * potion hands you the whole thing at once, the dish feeds it to you over the
 * time it lasts.
 */
export interface StatusRestore {
  resource: ResourceId;
  /** Restored per tick, per point of intensity. */
  flat?: number;
  /** Share of the pool's maximum per tick, per intensity. */
  ofMax?: number;
}

/** A pool this condition seals part of off (see resources.ts availableMax). */
export interface StatusCeiling {
  resource: ResourceId;
  /** Share of true max sealed off per point of intensity. */
  per: number;
  /** Never seals off more than this share, however deep the condition runs. */
  max?: number;
}

/** Modifiers a condition dulls, picked out by where they came from. */
export interface StatusDamping {
  /** Only modifiers from these origins are dulled; absent = all of them. */
  kinds?: ModOriginKind[];
  /**
   * Only modifiers targeting these stats are dulled; absent = all of them.
   * Being caught flat-footed takes away the defences you were *wearing*, not
   * your sword arm, so it names `dodge` and `parry` and leaves the rest alone.
   */
  stats?: ModTarget[];
  /** Only modifiers worn in this slot ('weapon' = your weapon's bonuses). */
  slot?: SlotId;
  /** Share of the modifier removed per point of intensity. */
  per: number;
  /** Never dulls more than this share. */
  max?: number;
}

export interface StatusDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /**
   * The damage type that most commonly inflicts it. Conditions are the
   * *signatures* of the elements, not their exclusive property — anything may
   * set you on fire, but heat usually does.
   */
  element?: DamageType;
  /** The worse condition this becomes when it is pushed far enough. */
  escalatesTo?: string;
  /** The milder condition a 'deescalate' removal drops this back to. */
  baseForm?: string;
  /**
   * What this becomes when its timer runs out, instead of simply ending —
   * how rot leaves you weakened for a while after it has passed.
   */
  expiresTo?: string;
  /**
   * A parting blow when the clock runs out: the blade working itself free, a
   * charge going off. Reported through the ordinary damage channel, so both
   * sides of a fight apply it the way they apply any other affliction damage.
   * Scaled by the instance's intensity, and resisted like a DoT.
   *
   * Only fires on the CLOCK running out — a condition ended early (cured,
   * torn free by a technique) has been dealt with, and deals nothing.
   */
  expireDamage?: {
    type: DamageType;
    /** Flat damage per point of intensity. */
    flat?: number;
    /** Share of the bearer's MAX hp per point of intensity. */
    maxHp?: number;
  };
  /** Conditions that prevent this one being applied at all while held. */
  blockedBy?: string[];
  /**
   * While the bearer holds this, applications that match do not land: any
   * condition whose `element` is listed, and any condition named by id. The
   * mirror of `blockedBy`, written on the protecting status instead of the
   * blocked one. A monster can wear it (`MonsterDef.wears`) as readily as a dish
   * can grant it. Only applications are refused; a condition already held stays.
   */
  immune?: { elements?: DamageType[]; ids?: string[] };
  stacking: StatusStacking;
  /** Default lifetime in ticks; null means only a removal rule can end it. */
  duration: number | null;
  /** Default removal rules. A source may replace them wholesale. */
  removal?: StatusRemoval[];
  /** Stat modifiers while held; values scale with intensity. */
  mods?: Modifier[];
  ceilings?: StatusCeiling[];
  /** Pools handed back a little at a time while this is held. */
  restores?: StatusRestore[];
  /**
   * A ceiling that GROWS as the bearer spends the pool: rot eats a share of
   * everything you burn, so the harder you work the less of yourself is left.
   * Accumulates into the instance's `data.debt`, as a share of true max.
   */
  ceilingFromSpend?: { resource: ResourceId; share: number; max?: number };
  /** Share of accumulated `data.debt` recovered per tick, as rot fades. */
  ceilingDecay?: number;
  dot?: StatusDot;
  damp?: StatusDamping;
  /**
   * Caps healing at this share of the damage the condition has dealt. A blaze
   * that has burned you for 40 lets healing undo at most 20 of it.
   */
  healCap?: number;
  /** Hidden from the status bar — bookkeeping rather than a condition. */
  hidden?: boolean;
  /**
   * A CSS colour for the condition, used wherever the UI has to show that this
   * particular affliction is the reason something looks different. Falls back
   * to the generic danger colour.
   */
  color?: string;
  /**
   * The condition's bite fades as its clock runs down, rather than holding full
   * strength and then vanishing. Effective intensity is scaled by the share of
   * the duration remaining.
   */
  decayWithDuration?: boolean;
  /**
   * Resistances forced to an absolute value, overriding whatever the bearer had
   * — a soaking does not add to your cold resistance, it decides it. When the
   * bearer is already at or past `to`, `bonusIfMet` is added instead, so being
   * drenched is never a downgrade for someone already fireproof.
   */
  overrideRes?: Partial<Record<DamageType, { to: number; bonusIfMet?: number }>>;
  /**
   * A floor on how far this condition's own resistance penalties may push the
   * bearer, deepened per stack. Separate from the penalty itself: more stacks
   * let it dig deeper without each one hurting more.
   */
  resFloor?: { base: number; perStack: number };
  /** Multiplies the intensity of OTHER conditions as they are applied. */
  amplifies?: { id: string; mult: number }[];
  /** Changes what it takes for another condition to escalate while this holds. */
  capOverrides?: { id: string; cap: number }[];
  /** Conditions transmuted the moment this one lands (poison souring into rot). */
  converts?: { from: string; to: string; ratio: number }[];
  /** Attack rolls take the worse of two — the bearer cannot see what they hit. */
  disadvantage?: boolean;
  /**
   * Lets a pool be spent past zero, into debt. The headroom is a share of the
   * pool's TRUE max, deepened per stack. When the debt reaches its limit the
   * condition detonates (see `detonate`).
   */
  negativeHeadroom?: { resource: ResourceId; base: number; perStack: number };
  /**
   * What happens when a debt-carrying condition bottoms out: the overdraft is
   * dealt as damage, optionally ignoring most of the matching resistance.
   */
  detonate?: { type: DamageType; ofDebt: number; bypassRes?: number };
  /** Drains a pool every tick while held. */
  drains?: { resource: ResourceId; flat?: number; ofMax?: number };
  /**
   * When `source` is emptied entirely the bearer is brought down, and keeps
   * this share of the condition (rounded up) through whatever comes after.
   */
  fatalOnEmpty?: { resource: ResourceId; retains: number };

  // ---- Behavioural gates ----
  // The fields above describe what a condition *is*; these describe what it
  // stops you doing. Everything here is declarative on purpose: adding a
  // condition should not mean adding a branch to combat.ts.

  /**
   * Actions the bearer simply cannot take while this holds.
   *
   * `attack` is the broad one — it stops the bar-fill outright, before anything
   * has even been chosen, so a condition carrying it forbids working and
   * technique alike. `swing` is the narrow one: only the PLAIN blow, the one
   * that costs no thought. Everything deliberate still spends the bar.
   *
   * The two are not a ladder. A thing that cannot bring itself to act at all
   * takes `attack`; a thing that has simply stopped reaching for the easy
   * answer takes `swing`.
   */
  blocks?: ('spell' | 'attack' | 'swing')[];
  /** Pools that stop recovering entirely. */
  blocksRegen?: ResourceId[];
  /** Chance per intensity that the bearer's attacks miss outright. */
  missChance?: number;
  /**
   * Damage ARRIVING at the bearer is amplified by this share per intensity
   * (0.3 = 30% harder per point). Applied exactly where `damageTaken` events
   * fire, so the blows it amplifies and the blows that can consume it are the
   * same set — pair it with a `damageTaken` removal for an ambush bite spent
   * on the first blow (surprised), or leave it standing for a lasting
   * exposure.
   */
  incomingBite?: number;
  /**
   * An encounter that BEGINS with an enemy holding this hands the player the
   * first move: the action bar starts one tick short of full. The ambusher
   * strikes before the ambushed has registered the fight. Read only at
   * encounter start — landing it mid-fight changes nothing here.
   */
  opensTempo?: boolean;
  /** Forces the bearer into this combat style, whatever they selected. */
  forceStyle?: string;
  /** Multiplier on what spending a pool costs — 0.5 = half again as expensive. */
  costMult?: { resource: ResourceId; per: number; max?: number };
  /**
   * A ceiling that creeps up every tick the condition is held, rather than
   * arriving all at once (a puncture that keeps weeping).
   */
  ceilingPerTick?: { resource: ResourceId; per: number; max: number };
  /** What happens when the bearer's action bar fills or empties. */
  bar?: {
    /** Damage taken when the bar completes (a jolt discharging). */
    onFill?: { type: DamageType; flat: number };
    /** Damage taken when the bar bottoms out. */
    onDeplete?: { type: DamageType; flat: number };
    /** The bar drains instead of filling, at the same rate. */
    reverse?: boolean;
    /**
     * The bearer loses the action the bar just completed. Pair it with an
     * `{ on: 'barFill', effect: 'unstack' }` removal so each instance costs
     * exactly one action.
     */
    skip?: number;
  };
  /**
   * The condition is fed by EXCESS HEALING: overflow past the bearer's full
   * health accumulates in the instance's `data.surplus` (absolute HP). At
   * `escalateAt` (share of max HP) the condition escalates, carrying the
   * ledger; at `detonateAt` the swollen body bursts — the bearer takes the
   * surplus as damage and every OTHER combatant on its side takes
   * `detonateShare` of it. Manaburn's mirror: an overdraft of life.
   */
  surplus?: {
    escalateAt?: number;
    detonateAt?: number;
    detonateType?: DamageType;
    detonateShare?: number;
    /**
     * Share of THE LEDGER ITSELF shed each tick — the body making peace with
     * what was forced into it, standing in for the natural regeneration HP
     * does not otherwise have. Relative to the ledger rather than to max HP
     * so that a big target does not shed a swelling faster than any working
     * could build it: what accrues is absolute (spell power), so what leaves
     * must be too. Decay IS the clock — these conditions carry no duration,
     * and end when the ledger empties.
     */
    decayShare?: number;
  };
  /**
   * Dots from these conditions FEED the bearer instead of bleeding them: the
   * damage they would deal each tick lands as healing. Xima's communion —
   * spilled blood, channelled back.
   */
  invertsDots?: string[];
  /**
   * While the bearer holds this, enemies other than the front slot cannot
   * act at all — the terms of an honorable duel, enforced.
   */
  pacifiesFlankers?: boolean;
  /**
   * Chance per intensity that an ENEMY attack on the bearer misses outright,
   * rolled after dodge — a shroud on top of footwork, not instead of it.
   */
  incomingMissChance?: number;
  /**
   * While held, RANGED enemy attacks on the bearer simply stop at the wall —
   * except the listed damage types (light passes through a kinetic shield).
   */
  blocksRanged?: { except?: DamageType[] };
  /**
   * The bearer has been made to attract what is aimed at it. Every field is
   * about blows the bearer RECEIVES, so the numbers read from the striker's
   * side: iron in the flesh drags the next thing toward it.
   */
  magnetism?: {
    /** Chance per intensity that the bearer's dodge simply does not apply. */
    dodgeIgnore?: number;
    /** Dodge does not apply at all, at any intensity. */
    nullifyDodge?: boolean;
    /** Blows of these types never miss the bearer, at any intensity. */
    alwaysHit?: DamageType[];
    /** Crit chance added per intensity, for blows of `critTypes`. */
    critChancePer?: number;
    critTypes?: DamageType[];
    /**
     * The next critical hit lands with this much extra crit damage per
     * stack — and consumes the condition. The pull collapses all at once.
     */
    critDamagePerStack?: number;
  };
  /**
   * The bearer is being shoved around. Whatever exit a technique declares,
   * a displaced motion leaves them at `to` instead.
   *
   * Legal under the martial prime directive (MARTIAL.md §9) because it rewrites
   * ONE node — "even its exit" is named there as a sanctioned rewrite — rather
   * than writing an edge list.
   *
   * GUARDRAIL: `to` must be a DEAD-END position, one nothing enters from.
   * Displacing someone into a useful entry (`coiled`, `extended`) would hand
   * out chain links, which is the prime directive violated by the back door.
   * Wind may cost you your footing; it may never buy you a follow-up.
   */
  displaces?: {
    /** Where a displaced exit actually lands. Must be a dead-end position. */
    to: string;
    /** Chance per point of intensity that a given exit is overridden. */
    chancePer?: number;
    /** Every exit is overridden, at any intensity. */
    always?: boolean;
  };
  /**
   * A condition that GROWS while it is ignored and recedes when it is
   * answered — the inversion of every clock in this file. Left alone it
   * thickens; hit it and it is pruned back.
   *
   * The strategic point is that it makes an enemy you are NOT fighting into a
   * decision: seed the back of the pack, and by the time you reach it the
   * thing has taken root.
   */
  tends?: {
    /** Intensity gained per second the bearer takes no damage at all. */
    growPerSecond: number;
    /** Intensity lost per damaging blow of any type. */
    prunePerHit?: number;
    /** Types that prune at double rate — metal cuts wood. */
    prunedBy?: DamageType[];
    /**
     * Types that FEED it instead of pruning it — water nourishes wood. These
     * are checked before `prunedBy`, so a type in both feeds.
     */
    fedBy?: DamageType[];
    /** Intensity gained per feeding blow. */
    feedPerHit?: number;
  };
  /**
   * A ledger of the OTHER conditions that land while this one is held. The
   * root network learns what is already in the body and, once it matures,
   * carries it to everything else in the fight.
   *
   * Kept in the instance's `data` under `graft:<id>` keys, the way a surplus
   * ledger is kept under `data.surplus`.
   */
  grafts?: {
    /** Conditions never recorded — the seed's own family, at minimum. */
    except?: string[];
    /** Ceiling on recorded intensity per condition. */
    cap?: number;
    /**
     * Share of each recorded intensity applied to every OTHER enemy on a
     * spread. Absent or 0 means this form only records — it does not yet
     * propagate, which is what makes the escalation matter.
     */
    spreadShare?: number;
    /** Ticks between spreads. */
    spreadEvery?: number;
    /**
     * Burned off rather than cut: when a removal rule ends this condition on
     * one of these damage types, the whole ledger comes back as damage.
     * Wood feeds fire, at the combat layer.
     */
    harvest?: { on: DamageType[]; type: DamageType; perIntensity: number };
  };
  /** Damage dealt back to whoever is on the other side of a blow. */
  retaliate?: {
    type: DamageType;
    /** Damage per point of intensity. */
    flat: number;
    /** Fires when the bearer attacks. */
    onAttack?: boolean;
    /** Fires when the bearer is struck in melee. */
    onContact?: boolean;
    /** Conditions inflicted on the bearer by each retaliation. */
    inflicts?: StatusApplication[];
  };
  /**
   * The bearer drops what they are holding if this condition's own damage
   * takes them below this share of their health.
   */
  dropWeaponBelow?: number;
}

/**
 * What a source (a monster's bite, a rune, a spell) declares it inflicts.
 * Everything except the id is optional: leave it out and the condition's own
 * defaults apply.
 */
export interface StatusApplication {
  id: string;
  /** Defaults to 1. */
  intensity?: number;
  /** Override the condition's lifetime; 'permanent' = removal-bound only. */
  duration?: number | 'permanent';
  /** Replace the condition's removal rules for this application. */
  removal?: StatusRemoval[];
  /** Probability the application lands at all. Defaults to 1. */
  chance?: number;
}

/** A condition as actually held by a player or a monster. */
export interface StatusInstance {
  id: string;
  /** Combined magnitude — what most effects scale off. */
  intensity: number;
  /**
   * The strongest single application this condition has taken. Parts listed in
   * `StatusDot.fromPeak` scale with this rather than the total.
   */
  peak: number;
  stacks: number;
  /** Ticks remaining; null means it waits for a removal rule instead. */
  ticksLeft: number | null;
  /** The rules in force for THIS affliction (from whatever inflicted it). */
  removal?: StatusRemoval[];
  /** What inflicted it, for the tooltip. */
  source?: string;
  /** Per-condition bookkeeping: damage dealt so far, healing already allowed. */
  data?: Record<string, number>;
  /**
   * The pool `data.debt` is held down on. Travels with the debt when a
   * condition expires into a recovery one, which inherits the debt but not the
   * configuration that produced it.
   */
  debtPool?: ResourceId;
}

/** What one exertion buys. Every value scales with the stamina actually spent. */
export interface ExertionHit {
  /** Fractional damage bonus on the strike. */
  damage?: number;
  /** Added to penetration for the strike. */
  penetration?: number;
  /** Share of the strike's damage splashed onto a random secondary target. */
  splash?: number;
  /** Extra simultaneous hits on the same target (a fraction is a chance). */
  extraHits?: number;
  /** Added dodge chance against the incoming attack ('defend' only). */
  dodge?: number;
  /** Fractional armor bonus against the incoming attack ('defend' only). */
  armor?: number;
  /**
   * Added parry chance against the incoming attack ('defend' only). The third
   * defensive answer: dodge is not being there, armor is absorbing it, parry is
   * putting steel in the way and answering (see `riposte`).
   */
  parry?: number;
}

/**
 * How a fighting style burns stamina. Physical attacks (and, for guarding
 * stances, incoming attacks) pay `cost` × max stamina and get `hit` in return,
 * scaled by whatever share of that cost was actually affordable. `mods` apply
 * for as long as there is stamina left to burn — run dry and they lapse.
 */
export interface ExertionSpec {
  /** Whether the spend happens on your attack or on an enemy's. */
  on: 'attack' | 'defend';
  /**
   * The pool the bargain draws from (default 'stamina'). A mana-burning
   * style is the magiknight seam: same mechanics, arcane fuel.
   */
  pool?: ResourceId;
  /** Cost per event as a fraction of the pool's MAX, before efficiency. */
  cost: number;
  /** Spend the entire pool instead of `cost` — bottoms out into exhaustion. */
  drain?: boolean;
  /** One-line flavour for the stance tooltip. */
  note?: string;
  /** Stats granted while stamina is still spendable (not winded/exhausted). */
  mods?: Modifier[];
  /** Per-event payoffs. */
  hit?: ExertionHit;
  /** Momentum: each spend adds `per` to `stat`, up to `cap`, for this fight. */
  ramp?: { stat: StatKey; per: number; cap: number };
}

export interface CombatStyleDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  mods: Modifier[];
  /** Stamina burned to fight in this style, and what that buys. */
  exertion?: ExertionSpec;
  /** Conditions to unlock the style; absent = always available. */
  unlock?: UnlockCondition[];
  /** Once unlocked, this style supersedes (hides) the named style. */
  replaces?: string;
  /**
   * School skill powering this style: modifiers resolve their `perLevel`
   * against its level, so named schools grow with mastery.
   */
  skill?: string;
}

// ---------- Martial techniques ----------

/**
 * A micro-position the fighter's body occupies mid-fight — the state a
 * technique enters from and the state it leaves behind. Distinct from combat
 * STYLES: a style is the macro posture you pick between fights; a position is
 * where the last exchange actually left you.
 */
export interface PositionDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** Identity color — pills, strip chips and card gradients all wear it. */
  color: string;
  /** What standing here does to you — positions are felt, not just gate-keys. */
  effects?: {
    /** Multiplier on incoming enemy damage while in this position. */
    incomingMult?: number;
    /**
     * Multiplier on your dodge chance while here. 0 is a real value: a stance
     * taken deliberately wide open is not dodging anything, and that is the
     * whole point of standing in it.
     */
    dodgeMult?: number;
  };
  /**
   * Gate on the position being SHOWN at all. Absent, a position reveals itself
   * once you know a technique that touches it — you cannot stand somewhere you
   * have no way of reaching, so knowing the move IS the discovery. Set this
   * for a position that must stay hidden even then.
   */
  unlock?: UnlockCondition[];
}

/** What executing a technique does. All strike damage scales off weapon damage. */
export interface TechniqueMove {
  /** Weapon damage multiplier; absent = no strike (a purely defensive form). */
  damageMult?: number;
  /**
   * Bonus damage as a share of the damage this reflex just stopped
   * (CombatState.prevented) — the deflection identity: what you answer with is
   * what they put into it, so the harder they swing the harder the answer.
   * Pairs with a defensive trigger: `onParry` reads the whole blow, `onHit`
   * reads only what the guard took off it.
   */
  preventedMult?: number;
  /**
   * Damage type of the RETURNED share (`preventedMult`) — the weapon still
   * types the `damageMult` half, so a counter lands as two slices: your own
   * blow in your own type, and what you took off theirs in this one. Absent =
   * the whole strike is the weapon's type.
   */
  damageType?: DamageType;
  /**
   * INTERCEPTION — the third kind of technique. A strike swings on the action
   * bar and a buff fires from the buff slot; a counter fires inside the
   * enemy's own attack, softening the blow that triggered it by `reduce` and
   * answering immediately, free of the action bar (the parry riposte, made
   * authorable). Its `trigger.event` names which incoming event it intercepts.
   *
   * Its reduction lands BEFORE armor, so what it prevents is folded into
   * `CombatState.prevented.onHit` and a `preventedMult` on the same move
   * answers with the whole block — the counter's share and the harness's both.
   */
  counter?: {
    /** Share of the incoming blow this reflex takes off it (0–1). */
    reduce: number;
    /** Pool the interception is paid from (default: no cost). */
    pool?: ResourceId;
    /** Cost as a fraction of that pool's max, like an exertion. */
    cost?: number;
  };
  /** Base hits per execution (default 1); each rolls its own crit/variance. */
  hits?: number;
  /** Added to penetration for this strike. */
  penetration?: number;
  /** Share of the strike splashed onto a random flanker. */
  splash?: number;
  /** Statuses the blow leaves on its target. */
  inflicts?: StatusApplication[];
  /** Self-buff granted on execution (defensive and reactive forms). */
  buff?: { mods: Modifier[]; duration: number };
  /** Stamina cost as a fraction of max stamina, on top of swing upkeep. */
  staminaCost?: number;
  /** Momentum added on execution — only counts under a ramping stance. */
  momentum?: number;
  /**
   * Weapon-state side-effect (see systems/martial.ts weapon states):
   * 'ground' drops the wielded weapon mid-fight, 'recover' takes the grounded
   * one back up, 'draw' unsheathes the concealed one, 'impale' leaves it in
   * the target, and 'wrench' tears an impaled one back out.
   *
   * Grounded and impaled are deliberately separate states: a blade in the dirt
   * and a blade in a ribcage are not interchangeable, and sharing one slot
   * would let Ground Draw pull a sword out of an enemy.
   */
  equipment?: 'ground' | 'recover' | 'draw' | 'impale' | 'wrench';
  /**
   * Force a critical hit, at a share of your usual crit damage — what a blade
   * already inside somebody buys you. `damageMult` scales critDamage and
   * `floor` is the multiplier it never drops below, so a fighter who has not
   * trained crit damage still gets something out of it.
   */
  crit?: { always: true; damageMult?: number; floor?: number };
  /**
   * Hold a prepared spell ready (paying its mana now) so a later technique can
   * deliver it. Sets `CombatState.readiedSpell`; pair with an exit into a
   * position that says so.
   */
  readiesSpell?: boolean;
  /**
   * Deliver whatever is readied INSTEAD of a weapon blow — the technique
   * decides when and from where, the grimoire decides what lands. Requires
   * `CombatState.readiedSpell`; spends it either way.
   */
  deliversSpell?: boolean;
  cooldown: number;
}

/**
 * A data annotation on one rung of the standard mastery ladder (see
 * MASTERY_LADDER in martial.data.ts — thresholds and generic bonuses live in
 * code so growth is uniform and logarithmic; data only names a rung or grows
 * the graph at it).
 */
export interface TechniqueMasteryNote {
  /** Overrides the generic tier name (Practiced/Drilled/Honed/Perfected). */
  name?: string;
  /** Entry positions this rung of practice permanently opens. */
  addFrom?: string[];
}

/**
 * How a technique was acquired, branding the form it takes.
 *  - rough: self-taught — reps internalize twice as fast, but the mechanics
 *    are inefficient (+stamina) until Perfected dissolves the tax (ten
 *    thousand swings of your own way is its own mastery).
 *  - canonical: taught the clean form.
 *  - syncretic: reserved — a personal blend of two schools' forms.
 */
export type TechniqueForm = 'rough' | 'canonical' | 'syncretic';

/** Autodidactic acquisition: the technique crystallizes (rough) when a fight
 *  counter crosses `count` while the eligibility conditions hold. */
export interface TechniqueSelfLearn {
  /** A `state.stats` counter (e.g. 'combat:dodges'). */
  stat: string;
  count: number;
}

/**
 * A martial technique: a trained reflex. Unlike a spell it is never composed —
 * its trigger is part of what it IS, and the player's only authored surface is
 * rotation order (techniques ride activeRotation as `technique:<id>` ids).
 * Sequencing is never scripted either: a technique fires only from its entry
 * positions and leaves the fighter in its exit position, a basic swing resets
 * to neutral, and chains emerge from whichever exits feed whichever entries
 * the fight happens to offer.
 */
export interface TechniqueDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** Weapon-family tag that must be equipped (absent = usable with anything). */
  family?: string;
  /**
   * The skill this technique is displayed under in the skill tree (its
   * "home" — usually the school it is flavored after). Falls back to the
   * first skill named in `unlock` when absent or not yet known.
   */
  skill?: string;
  /** The baked-in reflex: when this technique answers. Absent = any swing. */
  trigger?: SkillTrigger;
  /**
   * The ways into this technique. Three forms, shortest first:
   *   `'any'`                    — from anywhere
   *   `['coiled']`               — from these positions
   *   `[{ at, trigger? }, …]`    — several ways, each with its own read
   *
   * The long form is what lets one motion have a normal way in and an
   * opportunistic one: Flesh Draw out of a coil, OR out of somewhere worse
   * when the fight just handed you the moment. It is still ONE technique and
   * one node — the read is simply correlated with the footing instead of
   * floating free of it. `TechniqueDef.trigger` still applies to every way.
   */
  from: string[] | 'any' | TechniqueEntry[];
  /** The position executing it leaves you in. */
  to: string;
  move: TechniqueMove;
  /**
   * ELIGIBILITY to learn — the body that could hold this technique — not
   * knowledge itself. Knowledge is the ledger: `state.techniques[id]` existing
   * is knowing it (see systems/martial.ts).
   */
  unlock?: UnlockCondition[];
  /** How it can be acquired without a teacher. Absent = taught/granted only. */
  learn?: { self?: TechniqueSelfLearn };
  /** Annotations on the standard ladder, keyed by tier (1–4). */
  mastery?: Partial<Record<1 | 2 | 3 | 4, TechniqueMasteryNote>>;
  /**
   * Fork archetypes offered at the Honed choice (FORK_TIER). Absent = the
   * technique never forks. A syncretic form is offered the whole vocabulary.
   */
  forks?: string[];
  /** Requires a weapon in hand (any family) — for weapon-state verbs. */
  requiresWielded?: boolean;
  /** Requires your weapon lying grounded (see CombatState.grounded). */
  requiresGrounded?: boolean;
  /** Requires your weapon buried in the target (see CombatState.impaled). */
  requiresImpaled?: boolean;
  /** Requires a spell held ready (see CombatState.readiedSpell). */
  requiresReadiedSpell?: boolean;
  /** Requires a sheathed weapon carrying this tag (see GameState.sheathed). */
  requiresSheathed?: string;
}

/**
 * One way into a technique: where you must be standing, and (optionally) what
 * the fight must have just done. Several ways make a technique contextual
 * without making it a sequence — each is still one node's eligibility.
 */
export interface TechniqueEntry {
  /** Positions this way admits ('any' = from anywhere). */
  at: string[] | 'any';
  /** A read specific to THIS way in. Absent = the footing alone is enough. */
  trigger?: SkillTrigger;
}

/** One learned technique in the ledger (see systems/martial.ts). */
export interface TechniqueState {
  executions: number;
  /** How it was acquired — brands cost and learning speed. */
  form: TechniqueForm;
  /** The fork archetype chosen at Honed (permanent — your history is your build). */
  path?: string;
}

/**
 * A fork archetype: one way a technique can deepen at the Honed choice. A
 * transform on the base move that redistributes a strictly-positive budget —
 * every archetype must advance the move as a whole (a content test enforces
 * crude EV ≥ base), even where individual numbers shrink.
 */
export interface ForkArchetypeDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** Which moves it applies to: strikes (damageMult) or defensive buffs. */
  kind: 'strike' | 'buff';
  /** Multiplier on the move's strike damage. */
  damageMult?: number;
  /** Base hits per execution become this (each still rolls crit/variance). */
  hits?: number;
  cooldownMult?: number;
  /** Added to the move's splash share. */
  splashAdd?: number;
  staminaMult?: number;
  /** Multiplier on a defensive move's buff duration. */
  durationMult?: number;
  dodgeMult?: number;
  /** The technique's exit position becomes this. */
  exitTo?: string;
}

/**
 * A weapon family the planner can filter by — the vocabulary of `ItemDef.tags`
 * / `TechniqueDef.family` values that name a fighting identity. Purely a
 * grouping label: it grants nothing and carries no mechanics of its own.
 */
export interface WeaponFamilyDef {
  id: string;
  name: string;
  icon: string;
}

// ---------- Monsters ----------

/** Intrinsic monster tier (declared per monster def, proto26 model). */
export type TierId = 'basic' | 'veteran' | 'elite' | 'ancient' | 'legendary' | 'mythic' | 'divine';
/** Rolled-at-spawn modifier classification. */
export type ModifierTierId = 'normal' | 'demiboss' | 'boss' | 'aberrant';
export type RarityId = 'common' | 'uncommon' | 'rare' | 'epic';

export interface TierDef {
  id: TierId;
  name: string;
  /** Stat multiplier rolled uniformly within this range at spawn. */
  multiplierRange: [number, number];
  rewardMult: number;
}

export interface ModifierTierDef {
  id: ModifierTierId;
  name: string;
  multiplierRange: [number, number];
  rewardMult: number;
}

export interface RarityDef {
  id: RarityId;
  name: string;
  statMult: number;
  lootMult: number;
  color: string;
}

/** Reserved for milestone 2 — monster mutations. */
export interface MutationDef {
  id: string;
  name: string;
  mods: Modifier[];
}

/** One weighted entry in a drop table. */
export interface DropEntry {
  kind: 'item' | 'material' | 'gold' | 'rune' | 'nothing';
  /** Item, material, or rune id (required for those kinds). */
  id?: string;
  weight: number;
  /** Quantity range, default [1,1]. Gold amount for kind 'gold'. */
  qty?: [number, number];
}

export interface DropTable {
  rolls: number;
  entries: DropEntry[];
}

/** How far a monster can reach — decides which formation slot suits it. */
export type MonsterRange = 'melee' | 'ranged';

/** How many of this monster show up at once (overrides the spot's distribution). */
export interface GroupSpec {
  min?: number;
  max?: number;
  /** Weighted sizes, e.g. { 1: 20, 3: 50, 5: 30 }. */
  weights?: Record<number, number>;
}

/**
 * One entry in a monster's rotation: a working it composes, or a technique it
 * fights with. Both are authored — a monster never learns either.
 *
 * A `cast` is a `SpellSource`, the same shape the player's grimoire stores, so
 * arcane sentences, miracles and psionic shapes are all sayable here and any
 * school the player gains a monster gains too. A `technique` is a TECHNIQUES
 * id: what carries over is its `move` and its `from`/`to` walk, since the
 * ledger, mastery and forks all model LEARNING, which this skips.
 */
export type MonsterAction = ({ cast: SpellSource } | { technique: string }) & {
  /**
   * Times this entry may fire in ONE encounter. Absent = as often as its
   * cooldown allows.
   *
   * A finite resource a monster brings with it rather than a clock it waits
   * on — the alchemist's satchel of bombs, the shaman's one prepared miracle.
   * Spent when the clock is stamped, so "used it" means the same thing for
   * both kinds of entry.
   */
  uses?: number;
};

export interface MonsterDef {
  id: string;
  name: string;
  icon: string;
  /**
   * Bestiary tags — every one must be registered in `MONSTER_TAGS`. Tier, and a
   * `non_elemental` fallback, are derived at read time (see `monsterTags`), so
   * only the intrinsic ones (material, taxon, element, trait, size) go here.
   */
  tags: string[];
  /** Bestiary art file in src/assets/enemies (with extension); absent = icon only. */
  art?: string;
  /** Field-notes flavour, revealed with the bestiary's `lore` fact. */
  desc?: string;
  /** Intrinsic tier — part of the monster's identity, not rolled. */
  tier: TierId;
  /**
   * Every blow that LANDS deals exactly this much — no crit, no jitter, no
   * armour, no resistance, no counter reduction. Training equipment: the
   * tutorial's Cell Slime deals 1 so a first fight can be read while it
   * happens. Dodges, parries and misses still resolve normally; only the
   * number that reaches the HP bar is pinned. Absent for everything real.
   */
  fixedDamage?: number;
  /** The damage type of this monster's attacks. */
  damageType: DamageType;
  /** Conditions its blows can inflict, rolled per landed hit. */
  inflicts?: StatusApplication[];
  /**
   * Conditions this thing simply WEARS, from the moment it appears — not what
   * it does to you, but what it is. Applied once at spawn.
   *
   * The monster-side mirror of `MainGeneDef.confers`. That field only ever
   * dresses the player (`syncGeneStatuses` reads `expressedGene(state)`), so
   * without this a body whose rule lives in a worn condition would fast, knit
   * or refuse only while a PLAYER wore it, and be an ordinary monster in the
   * fight you take it from.
   *
   * Applied rather than synced, deliberately: a monster's body cannot change
   * mid-fight, so there is nothing to keep in step, and re-applying every tick
   * would fight with anything that legitimately strips it.
   */
  wears?: StatusApplication[];
  /**
   * What it does with its turn, in order, read top-down — the monster's
   * Active Skills. The first entry that is ready and open from where it stands
   * is the one it takes; if none is, it swings plainly.
   *
   * Workings and techniques share ONE list on purpose. Splitting them made a
   * whole category outrank the other, so a monster with any spell opened by
   * casting every spell it had before it remembered it was holding a sword.
   * Ordering them together is also how the player's rotation already works,
   * and it means a monster's character is authored by sequence alone.
   */
  rotation?: MonsterAction[];
  /** Attack reach; absent = melee. */
  range?: MonsterRange;
  /**
   * Harmless: it goes through the motions of attacking — you can dodge it, a
   * guarding stance still spends stamina on it — but its blows never land for
   * damage. Training equipment, not a monster.
   */
  passive?: boolean;
  /** Group-size rule for encounters led by this monster. */
  group?: GroupSpec;
  /** Monster ids that fill the remaining slots; absent = re-roll the spot table. */
  escorts?: string[];
  /**
   * Fractional damage reduction per incoming type: 0.5 = takes half damage,
   * negative = vulnerable (−0.5 = takes 50% more). Missing = 0. Damage is capped
   * at 0.9 on read, but a value of 1 or more also makes the species immune to
   * conditions of that element: they do not land (`applyStatus`).
   */
  resistances?: Partial<Record<DamageType, number>>;
  /**
   * Flat physical absorption **at level 1**, the same currency the player's
   * armour is in. It grows 5% of this per level above 1, the way `attrs` grow
   * by `growth` — so the number written here is literally what a level-1
   * specimen subtracts from every physical blow.
   *
   * Omit and the species falls back to whatever its TAGS imply (see
   * `TAG_ARMOR`) — a thing made of stone is armoured whether or not anyone
   * remembered to say so. Set it to override that, including to `0` for
   * something that ought to be soft despite its material.
   */
  armor?: number;
  /**
   * Share of max health knitted back per tick. Omit for the vast majority.
   *
   * A regenerating thing is a DIFFERENT fight rather than a tougher one: you
   * either out-damage it or you stop it closing. Suppressed while it burns or
   * corrodes, the same rule a regenerating player lives under, so both sides
   * of the swing answer regeneration the same way.
   */
  regen?: number;
  /** Attribute values at level 1 (missing entries count as 0). */
  attrs: Partial<Record<AttributeId, number>>;
  /** Attribute gain per level above 1. */
  growth: Partial<Record<AttributeId, number>>;
  /** Base XP reward, scaled by level/tier/rarity. */
  xp: number;
  /** Direct gold reward range at level 1 (drop tables can add more via 'gold' entries). */
  gold?: [number, number];
  loot: DropTable;
}

export interface MonsterInstance {
  defId: string;
  name: string;
  icon: string;
  level: number;
  tier: TierId;
  modifier: ModifierTierId;
  rarity: RarityId;
  mutation: string | null;
  /**
   * This specimen's attributes: the def's base grown to its level, jittered per
   * attribute, then scaled by tier × modifier × rarity. Every combat stat it
   * has is derived from these on read (see systems/monsterStats.ts), so a
   * status that chills it or cuts its max HP has somewhere to apply.
   */
  attrs: Record<AttributeId, number>;
  /** Current HP. The maximum is derived from `attrs`. */
  hp: Big;
  /** Conditions afflicting this specimen. Transient, like the encounter. */
  statuses: StatusInstance[];
  /** Attack reach, resolved from the def (absent there = melee). */
  range: MonsterRange;
  /**
   * Ticks (absolute, against `totalTicks`) at which each of this specimen's
   * workings comes ready again, keyed by its index in `MonsterDef.casts`.
   * Transient like the encounter, and per-SPECIMEN so two of the same monster
   * do not share one clock.
   */
  cooldowns?: Record<number, number>;
  /**
   * How many times each rotation entry has fired this encounter, keyed the
   * same way as `cooldowns` — the counter `MonsterAction.uses` is spent
   * against. Transient with the encounter, so a satchel refills per fight.
   */
  spent?: Record<number, number>;
  /**
   * The micro-position this specimen's last exchange left it in — its own copy
   * of what `CombatState.position` is for the player.
   *
   * Per-combatant on purpose: the position graph is nothing but `from`/`to`
   * data, so once each fighter walks its own, a monster using techniques needs
   * no special handling at all (see MonsterDef.techniques).
   */
  position?: string;
  /** This enemy's own action-bar progress. */
  bar: number;
  /** Bar progress shaved this fill cycle — caps the front-row ranged mini-stun. */
  stunSpent: number;
  /**
   * What is left of this specimen's MIND, once something has burned it.
   * Absent = untouched, which reads as full (see monsterStats.ts
   * `monsterMind`). A monster never spends this pool on a working — only
   * manaburn eats it — and while it sits below zero the mind cannot shape
   * one. Transient like the encounter.
   */
  mana?: number;
  xp: Big;
  gold: Big;
}

/**
 * ANYTHING THAT CAN WEAR SOMETHING. The player, or one specimen in a fight.
 *
 * Named because `systems/statuses.ts` had already settled the convention by
 * hand — `(state: GameState, bearer: GameState | MonsterInstance)`, world
 * first and wearer second — and every system that crosses the same seam should
 * spell it the same way rather than re-deriving the union at each door.
 *
 * `state` stays the WORLD: the rng, `totalTicks`, the bus, the combat field.
 * `bearer` is only ever who is carrying the thing being asked about. The
 * player passes itself as both, which is not a special case — it is the player
 * being the bearer at the centre of its own world.
 */
export type Bearer = GameState | MonsterInstance;

/**
 * Which side of the union this is.
 *
 * `defId` is the discriminator because it is the one field a specimen cannot
 * be without — it is what makes it a specimen OF something. Deliberately not
 * `statuses`, which both sides carry, nor `attrs`, which is coming to mean
 * different things on the two sides as the bearer seam widens.
 */
export function isMonsterBearer(bearer: Bearer): bearer is MonsterInstance {
  return 'defId' in bearer;
}

// ---------- Bestiary ----------

/**
 * Tag axes. Every monster tag belongs to exactly one, which is what lets the
 * bestiary filter row group them: a filter ORs within a category and ANDs
 * across categories ("living AND slime AND (fire OR cold)").
 */
export type MonsterTagCategory = 'material' | 'taxon' | 'element' | 'tier' | 'trait' | 'size';

export interface MonsterTagCategoryDef {
  id: MonsterTagCategory;
  name: string;
  /**
   * Whether the filter may hold several tags of this category at once (they OR
   * together). Material is a three-way switch — a thing is flesh or gel or
   * nothing you can grab — so it stays exclusive.
   */
  multi: boolean;
}

/** Filter axes, in the order the bestiary offers them. */
export const MONSTER_TAG_CATEGORIES: MonsterTagCategoryDef[] = [
  { id: 'material', name: 'Material', multi: false },
  { id: 'taxon', name: 'Taxonomy', multi: true },
  { id: 'element', name: 'Element', multi: true },
  { id: 'tier', name: 'Tier', multi: true },
  { id: 'trait', name: 'Trait', multi: true },
  { id: 'size', name: 'Size', multi: true },
];

export interface MonsterTagDef {
  id: string;
  name: string;
  category: MonsterTagCategory;
  icon: string;
  desc?: string;
  /**
   * Plural form, used for the bestiary's taxonomy group headings. Defaults to
   * `name + 's'` — set it where that reads wrong (Vermin, Undead, …).
   */
  plural?: string;
}

/**
 * One learnable section of a bestiary entry. The first kill opens the entry
 * (name, art, tags); everything else is earned — a fact may only be learned
 * after `minKills`, then rolls per kill against the hunter's insight, and is
 * granted outright at `sureKills` so pure grind always gets there eventually.
 */
export interface BestiaryFactDef {
  id: string;
  name: string;
  icon: string;
  /** Kills before this fact can be rolled at all. */
  minKills: number;
  /** Kills at which it is granted regardless of rolls. */
  sureKills: number;
  /** Per-kill roll multiplier — obscure knowledge sits below 1. */
  difficulty: number;
  /** Shown while locked, in place of the content. */
  hint: string;
}

export interface BestiaryEntry {
  /** Kills recorded; 1+ means the entry itself is unlocked. */
  kills: number;
  /** Encounters witnessed per spot id (drives habitat unlocks). */
  seen: Record<string, number>;
  /** Learned fact ids. */
  facts: string[];
  /** Spot ids whose habitat entry has been confirmed. */
  spots: string[];
  /** Game tick of the first kill. */
  firstKill: number;
}

// ---------- Materials ----------

export interface MaterialDef {
  id: string;
  name: string;
  icon: string;
  value: number;
  desc?: string;
  /**
   * Tags this material carries into a discipline's slots — 'runestone',
   * 'inlay', 'gem', 'herb'. Slots accept by tag, outcomes match by tag.
   */
  craftTags?: string[];
  /**
   * Graded materials are stocked PER QUALITY (see `state.stock`) rather than as
   * a single count. Opting in is per material, so a lump of iron scrap stays a
   * plain number while a runestone remembers whether it is any good.
   */
  graded?: boolean;
  /**
   * Makes this something you can use. Dishes and potions are graded materials
   * with one of these — which means they stack, sell and sit in stock exactly
   * like everything else, and a dish cooked from better ingredients is simply a
   * better grade of the same thing.
   */
  consumable?: ConsumableSpec;
}

// ---------- Consumables ----------

/**
 * What using something does.
 *
 * The split the player actually feels is INSTANT versus SUSTAINED. A potion
 * hands you its whole effect the moment you drink it (`restore`); a dish grants
 * a condition that feeds you over time (`grants`, whose statuses carry their
 * own `restores` and `mods`). One consumable may do both.
 *
 * Duration is not modelled here at all, and deliberately so: a granted status
 * already knows how to last for a set time, last until something happens to
 * you, or never end on its own. Consumables inherit all three for free.
 */
export interface ConsumableSpec {
  /** Restored in full, immediately. */
  restore?: { resource: ResourceId; flat?: number; ofMax?: number }[];
  /** Conditions granted — where every sustained effect lives. */
  grants?: StatusApplication[];
  /** Cure tags fired at whatever the eater is suffering (see StatusRemoval). */
  cures?: string[];
  /**
   * Conditions a dish also grants once the player has cooked it
   * `SIGNATURE_COOKS` times (systems/cookbook.ts `signatureEarned`), scaled by
   * grade like `grants`. Food only.
   */
  signature?: StatusApplication[];
  /**
   * This is FOOD: the cook's skill scales it as eaten. A status it grants lasts
   * `foodDuration` times as long and lands `foodPotency` times as hard, and
   * `restore` amounts are multiplied by `foodPotency` (consumables.ts
   * `foodScale`). Exactly the materials a cooking bench makes carry it, and
   * nothing else does (`foodProblems`, systems/disciplines.ts; linted in both
   * validation layers).
   */
  food?: boolean;
  /** Ticks before it can be used again; absent = no cooldown. */
  cooldown?: number;
  /** Flavour shown on the use button. */
  useVerb?: string;
  /**
   * A recipe card: using it teaches this recipe (a `CraftOutcomeDef.recipe`)
   * and is consumed. Refused once the recipe is known.
   */
  teaches?: string;
  /** Lifts a locked arcane word (`flag:word:<id>`). Refused once known. */
  unlocksWord?: string;
  /** Teaches a technique in canonical form (or upgrades a rough one). Refused once canonical. */
  teachesTechnique?: string;
  /**
   * Sets a `flag:` counter to 1 — what a hidden title, a secret recipe or a
   * standing rule (the Chancery price seal) reads. Refused once set.
   */
  stamps?: string;
  /**
   * The votive token (systems/consumables.ts): the first one offered gives +2
   * favor with every known god and +2 starting favor with gods met later;
   * each one after is 1 floating favor, assigned on the Divine tab.
   */
  votive?: boolean;
}

// ---------- Quality ----------

/**
 * How good a thing is, F through S. Every discipline that takes components
 * grades them on this one scale, so an ingredient, a runestone and a reagent
 * are all "C-tier" in the same sense.
 *
 * F is genuinely BAD — its multiplier is negative, so hot garbage does not
 * merely help less, it actively drags the result down. The tiers and their
 * multipliers live in data/quality.data.ts.
 */
export type QualityTier = 'f' | 'e' | 'd' | 'c' | 'b' | 'a' | 's';

export interface QualityTierDef {
  id: QualityTier;
  name: string;
  /** Scales whatever the component contributes. Negative at F. */
  mult: number;
  /** Bar/label colour for the UI. */
  color: string;
}

/** A quantity of something, at a grade. */
export interface GradedStack {
  id: string;
  quality: QualityTier;
  qty?: number;
}

// ---------- Modular crafting (disciplines) ----------

/**
 * A crafting discipline: a bench, the slots it offers, and what combinations
 * of things put in those slots produce.
 *
 * Deliberately not a skill. A discipline is CONTENT — what can be made, out of
 * what, in how many slots. A skill is PROGRESSION. They are linked by `skill`,
 * which is what gates slots, gates outcomes and scales quality; the same id in
 * both registries is a convenience, not an identity, and nothing stops two
 * disciplines sharing one skill.
 */
export interface CraftDisciplineDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /**
   * What the furniture is called where it stands — "Rune Table", "Cooking
   * Stove". The discipline is the craft; this is the thing in the room you
   * walk up to. Falls back to the discipline's own name.
   */
  benchName?: string;
  /** What working the bench is called — "Bake", "Grill". Falls back per bench kind. */
  verb?: string;
  /**
   * The prep tag this bench rewards — 'diced' for the stove, 'sliced' for the
   * cold counter. A basket of matching cuts comes out roughly a grade better;
   * a mismatched cut costs nothing but the time it took to make.
   */
  favoredPrep?: string;
  /**
   * A timed bench: the cook runs for a chosen number of units, and slots with
   * an `at` are entry points along it. WHEN an ingredient goes in decides how
   * much heat it sees — cooking's own axis, the way the slab is runecarving's.
   */
  timeline?: {
    /** The durations the bench offers, in units. */
    options: { units: number; name: string }[];
    /** Units assumed when the player hasn't chosen. */
    default: number;
  };
  /**
   * An ORDERED bench: its slots are a sequence read once, left to right, and
   * the same parts in a different order are a different craft. Two things
   * follow from it — the UI lays the slots out as a strip rather than stations,
   * and the novelty ledger keys on the order, so discovering "salt then
   * brimstone" teaches you nothing about "brimstone then salt".
   *
   * Alchemy's axis, the way `timeline` is cooking's. The two are deliberately
   * exclusive in spirit: a sequence has positions, not durations.
   */
  ordered?: boolean;
  /**
   * A REFINING bench: its one slot holds the thing being worked on, and what
   * comes out is that same thing at a better grade rather than a new object.
   *
   * Mutagens' axis, the way `ordered` is alchemy's and `timeline` is cooking's.
   * The distinction matters to the run loop, which otherwise assumes a craft
   * produces something it can hand over — here the output replaces the input,
   * and the bulk cost (biomatter) is spent outside the slots entirely.
   */
  refines?: boolean;
  /**
   * How the bench keeps time when worked as a job (see systems/benchwork.ts).
   * `per: 'ingredient'` makes each filled slot add a full helping of `ticks`
   * (assembly: more layers, more time). `skillScaled: false` pins the clock —
   * a stew simmers as long as a stew simmers, however good the cook. Absent
   * fields default to per-craft, skill-scaled. Timed benches (`timeline`)
   * ignore `ticks` entirely: their clock IS the chosen duration.
   */
  work?: { per?: 'craft' | 'ingredient'; skillScaled?: boolean };
  /** The SkillDef this discipline trains and is gated by. */
  skill: string;
  /** Tag emitted while working, so the skill (and any other) can train on it. */
  tag: string;
  slots: CraftSlotDef[];
  outcomes: CraftOutcomeDef[];
  /** Ticks per craft before craftSpeed. */
  ticks: number;
  /** Base skill XP per completed craft, before novelty. */
  xp: number;
}

/**
 * One place something goes. `unlockLevel` is how a discipline widens as its
 * skill grows — cooking opening a third ingredient, runecarving a second
 * pattern — without any of it being special-cased in code.
 */
export interface CraftSlotDef {
  id: string;
  name: string;
  /** What the slot is FOR: the thing worked on, what it is made of, or trim. */
  role: 'base' | 'component' | 'adornment';
  /**
   * Where this slot's options come from:
   *  - 'material' (default) — graded stock, filtered by `accepts`
   *  - 'design'   — the discipline's own catalogue (carving patterns; cooking
   *                 techniques later). Not a thing you own, a thing you know.
   *  - 'tool'     — an implement you work WITH rather than into the result.
   */
  picks?: 'material' | 'design' | 'tool';
  /** Tags accepted here. */
  accepts: string[];
  /** Skill level before this slot exists at all. Absent = always open. */
  unlockLevel?: number;
  /** A craft may proceed without it. */
  optional?: boolean;
  /** Spent by the craft. Tools are not; default is true for materials. */
  consumed?: boolean;
  /** Where the bench draws it, so the UI can lay a discipline out. */
  station?: 'centre' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  /**
   * On a timed bench (see CraftDisciplineDef.timeline): the fraction of the
   * cook already gone when this slot's content enters. What it holds is
   * exposed to heat for `duration × (1 − at)` units. Slots without `at`
   * (seasoning, cookware) stand outside time.
   */
  at?: number;
}

/**
 * What a combination makes. Matching is by TAG over what was actually put in,
 * so outcomes describe recipes without enumerating them — which is the whole
 * point of a modular discipline.
 */
export interface CraftOutcomeDef {
  id: string;
  name: string;
  icon: string;
  desc?: string;
  /** Tags the filled slots must carry between them. */
  requires: { tag: string; count?: number }[];
  /** The best component must reach this grade (S-tier unique results). */
  minQuality?: QualityTier;
  /**
   * The best component must be no BETTER than this — how a discipline expresses
   * "what you get when the basket is genuinely awful" as a different result
   * rather than merely a poor grade of the good one.
   */
  maxQuality?: QualityTier;
  /** Skill level needed to attempt it. */
  minLevel?: number;
  /** Higher wins when several outcomes match. */
  priority?: number;
  /**
   * A learned dish: the outcome matches only once this recipe is known
   * (`recipe:<id>`, taught by a recipe card — `ConsumableSpec.teaches`).
   */
  recipe?: string;
  /**
   * Heat windows, for outcomes on a bench with a `timeline`. Each entry names a
   * craft tag and a half-open exposure range [from, to) in timeline units
   * (`from` absent = 0, `to` absent = no upper end). The outcome matches only
   * when, for every entry, the MEAN exposure of the placed parts carrying that
   * tag (duration × (1 − slot.at), timed slots only) falls inside the range. If
   * no placed part carries the tag, or the bench has no timeline, it does not
   * match. Pair every windowed outcome with a window-less fallback on the same
   * tags (linted in both layers).
   */
  heat?: HeatWindow[];
  /** What comes out. */
  result: CraftResult;
}

/** One heat window: parts tagged `tag` must average an exposure in [from, to). */
export interface HeatWindow {
  tag: string;
  from?: number;
  to?: number;
}

export type CraftResult =
  | { kind: 'item'; id: string }
  | { kind: 'material'; id: string; qty?: number }
  /** A rune carved from the combination itself — see CarvedRune. */
  | { kind: 'carved'; pattern: string }
  /**
   * A prepped variant of whatever sits in the base slot — which material comes
   * out depends on what went in and the technique chosen, so it cannot be
   * named here. See systems/cooking.ts for how the cut grade is rolled.
   */
  | { kind: 'prepped' }
  /**
   * A flask brewed from the sequence itself — see BrewedFlask. Like a carved
   * rune, what comes out cannot be named in advance: it IS what went in, in
   * the order it went in.
   */
  | { kind: 'brewed' };

/**
 * A repeating run at a bench: the same layout worked again and again, each
 * craft taking real ticks. Skill compresses the clock — and once the per-craft
 * floor is hit, further speed converts into several crafts per completion.
 */
export interface BenchWork {
  disciplineId: string;
  /** Where the bench stands. Leaving cancels the run. */
  spot: string;
  /** The layout being repeated, slot id → what is in it. */
  placement: Record<string, GradedStack | undefined>;
  /** Crafts still wanted; null = keep going until the stock runs out. */
  remaining: number | null;
  /** Ticks left on the craft underway. */
  ticksLeft: number;
  /** Ticks each craft takes, for the progress display. */
  ticksPer: number;
  /** Crafts resolved per completion (skill past the floor batches up). */
  batch: number;
  /** Chosen duration for a timed bench, in units. */
  duration?: number;
  /** Crafts finished so far. */
  done: number;
}

// ---------- Alchemy ----------

/**
 * Alchemy is the crafting mirror of arcane spellcraft: a recipe is a SEQUENCE,
 * and the sequence is read left to right exactly once. See systems/alchemy.ts
 * for the two laws that make order mean something.
 *
 * Cooking's axis is a clock — WHEN a thing enters, measured in units. Alchemy's
 * is purely ordinal: nothing here has a duration, only a position. Reversing a
 * sequence makes a different brew; simmering one longer is not a thing you can
 * do to it.
 */

/** The solvent a brew was raised in. What decides how it is DELIVERED. */
export type BrewMedium = 'none' | 'water' | 'oil' | 'spirit';

/**
 * What a finished brew is. The medium decides the delivery, volatility decides
 * whether it is a burst or something that lingers — those two, crossed.
 */
export type BrewForm = 'elixir' | 'draught' | 'salve' | 'oil' | 'bomb' | 'fume' | 'residue';

/**
 * A reagent: what a material does when it goes into the alembic. Three kinds,
 * and a material may be more than one — a substance that is also a solvent is
 * perfectly ordinary chemistry.
 */
export interface ReagentDef {
  /** The material this describes. Reagents are graded stock like anything else. */
  id: string;
  name: string;
  icon: string;
  desc?: string;
  /** Alchemy level before the alembic will take it. */
  minLevel?: number;
  /** A SOLVENT: raises the brew, or dilutes one already raised. */
  menstruum?: { medium: Exclude<BrewMedium, 'none'>; body: number };
  /** A SUBSTANCE: what the brew is of. */
  essence?: EssenceSpec;
  /** An OPERATOR: what it does to the brew as it stands when it is added. */
  act?: ReagentAct;
}

/**
 * What a substance carries. Which of these registers is read depends on the
 * form: a thrown flask reads `type`/`inflicts`, a drunk one `grants`/`restore`,
 * a salve `restore`/`cures`. A substance with nothing to say in the register it
 * ends up in still lends its weight — it just does not speak.
 */
export interface EssenceSpec {
  /** Groups the same substance from different sources ('ember', 'venom'). */
  id: string;
  /** Reads as an adjective in the brew's name: "Ember Flask". */
  name: string;
  /** What it brings, before its grade. */
  power: number;
  /** What a thrown flask of it strikes as. */
  type?: DamageType;
  /** What it does to whatever it lands on. */
  inflicts?: StatusApplication[];
  /** What it does to whoever drinks it. */
  grants?: StatusApplication[];
  /** Immediate restoration, per point of potency. */
  restore?: { resource: ResourceId; per: number }[];
  /** Cure tags a salve of it fires (see StatusRemoval). */
  cures?: string[];
}

/**
 * What an operator does to the brew IT FINDS. Every one of these reads the
 * accumulator as it stands, which is the whole reason position matters: the
 * same salt thrown in first has nothing to fix.
 */
export type ReagentAct =
  /** Raises volatility — pushes the brew toward the instant and the violent. */
  | { kind: 'agitate'; amount: number }
  /**
   * Quenches it, and BANKS what it quenched as duration. Fixing a raging brew
   * is how a violent reaction becomes something you can carry in a bottle.
   */
  | { kind: 'fix' }
  /**
   * Needs a brew already volatile enough. Met, it takes hold: potency ×`mult`
   * and a heat signature. Unmet, it merely fouls what is there.
   */
  | { kind: 'ignite'; needs: number; mult: number }
  /**
   * Drops the WEAKEST substance in the brew and multiplies what remains —
   * purification. Added before there is anything to purify, it does nothing.
   */
  | { kind: 'clarify'; mult: number }
  /** Eats into what it lands on: penetration and potency, at a cost in purity. */
  | { kind: 'corrode'; penetration: number; mult: number; purity: number };

/**
 * A finished brew, as stocked. Nothing but the sequence is stored, because
 * nothing but the sequence decides what it is: two alchemists who add the same
 * reagents in the same order get the same flask, always. Skill buys length and
 * vocabulary, not quality — the mirror of a spoken sentence.
 */
export interface BrewedFlask {
  /** The sequence exactly as it went in. */
  steps: GradedStack[];
}

/**
 * An oil worked into a weapon. Measured in BLOWS rather than seconds, and for a
 * reason the outcome table forces: an oil is a *roused* brew, and rousing is
 * exactly what fixing salt undoes — so a coating can never have banked duration
 * the way an elixir or a fume can. Blows give the form a resource of its own,
 * and read the way an oil actually behaves: it wears off the edge.
 */
export interface WeaponCoating {
  /** The brew on the blade, stored as its sequence like the flask it came from. */
  brew: BrewedFlask;
  /** The weapon it was worked into. Draw a different blade and it is not on it. */
  weaponUid: number;
  blowsLeft: number;
}

/** A brew read out of its sequence — what the flask actually does. */
export interface BrewSpec {
  name: string;
  icon: string;
  form: BrewForm;
  medium: BrewMedium;
  /** Raw magnitude, after the solvent's capacity and every purity term. */
  potency: number;
  /** How badly it wants to release. Past the threshold it is a burst. */
  volatility: number;
  /** Ticks a sustained brew runs for. */
  duration: number;
  /** Blows a coating lasts. Oils only — see WeaponCoating for why not seconds. */
  blows?: number;
  penetration?: number;
  /** What it is of, strongest first, with each one's share of the whole. */
  essences: { spec: EssenceSpec; weight: number; share: number }[];
  /** Thrown forms. */
  strikes: SpellStrike[];
  inflicts: StatusApplication[];
  /** Drunk and applied forms. */
  restore: { resource: ResourceId; amount: number }[];
  grants: StatusApplication[];
  cures: string[];
  /** Roughly what it is worth. */
  value: number;
  /** The reading, line by line — how the alembic explains itself. */
  notes: string[];
}

/**
 * A sequence somebody has written down: a known formula. The mirror of a named
 * rune — the sequence has to match exactly, in order, to be recognised.
 */
export interface BrewFormulaDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** Reagent material ids, in the order they must be added. */
  sequence: string[];
}

/**
 * A knife technique the Cutting Board knows — a DESIGN in the discipline
 * sense: a thing you know, not a thing you own. See data/preps.data.ts.
 */
export interface PrepDef {
  id: string;
  /** The technique, as the menu names it: "Slice", "Dice". */
  name: string;
  /** How the result wears it: "Sliced", "Diced". */
  prefix: string;
  icon: string;
  /** The craft tag prepped variants carry, matched by `favoredPrep`. */
  tag: string;
  /** Cooking level before the hand knows this cut. */
  minLevel?: number;
  desc: string;
}

// ---------- Crafting ----------

/**
 * One alternative way to satisfy a recipe — the same product from different
 * stock. Leather is leather whether you got there from three torn hides or one
 * pristine one; without this, each route has to be its own recipe, and the
 * bench fills with four entries that make the same thing.
 *
 * `qty` lets a better input pay better: a pristine hide yielding two leather
 * is the whole reason to save it.
 */
export interface RecipeAlt {
  /** Unique within the recipe. */
  id: string;
  cost: { id: string; qty: number }[];
  /** Overrides the recipe's result quantity for this route. */
  qty?: number;
}

export interface RecipeDef {
  id: string;
  /**
   * Not listed anywhere until `unlock` is met — a recipe the player has to
   * discover (a smith's pattern turned up at work) rather than one shown
   * locked with its requirement.
   */
  secret?: boolean;
  /** Display name for the craft. Falls back to the result's own name. */
  name?: string;
  result: { kind: 'item' | 'material' | 'rune'; id: string; qty?: number };
  /**
   * The primary route. With `alts`, this is simply the FIRST route considered —
   * a craft uses the earliest one it can afford, so declare them in the order
   * you want them spent, cheapest and most plentiful first.
   */
  cost: { id: string; qty: number }[];
  /** Further routes to the same product (see RecipeAlt). */
  alts?: RecipeAlt[];
  /**
   * What KIND of work this is — 'smithing', 'leatherworking', 'cooking'. The
   * synthesized craft activity emits these, so they do double duty: they reach
   * skills the way any activity tag does, and they are what a scoped
   * `craftSpeed:leatherworking` matches against.
   */
  tags?: string[];
  /** Ticks per craft at craftSpeed ×1. */
  ticks: number;
  /** Smithing XP granted per completed craft. */
  xp: number;
  unlock?: UnlockCondition[];
}

// ---------- Items & equipment ----------

export type SlotId =
  | 'weapon'
  | 'offhand'
  /**
   * Arms past the usual two, for bodies that grew some (`arms:+N`, the asuroid
   * line — an asura rana reaches six). They behave exactly like the off hand
   * and are simply absent on an ordinary body: `equipment` is a Partial, so a
   * two-armed save never mentions them and no migration was needed to add them.
   */
  | 'hand3'
  | 'hand4'
  | 'hand5'
  | 'hand6'
  | 'head'
  | 'chest'
  | 'hands'
  | 'legs'
  | 'feet'
  | 'back'
  | 'accessory';

export const SLOT_NAMES: Record<SlotId, string> = {
  weapon: 'Weapon',
  offhand: 'Offhand',
  hand3: 'Third Hand',
  hand4: 'Fourth Hand',
  hand5: 'Fifth Hand',
  hand6: 'Sixth Hand',
  head: 'Head',
  chest: 'Chest',
  hands: 'Hands',
  legs: 'Legs',
  feet: 'Feet',
  back: 'Back',
  accessory: 'Accessory',
};

/**
 * How a held item occupies your hands.
 *  - `light`: at home in either hand, no penalty anywhere.
 *  - `one_handed`: made for the main hand; usable off-hand at reduced effect.
 *  - `two_handed`: fills both hands — nothing else may be held.
 *  - `offhand`: shields, focuses, parrying blades. Belongs off-hand; can be
 *    forced into the main hand at reduced effect unless it declares a
 *    `mainHand` bonus, which means it was built to be used that way.
 */
export type WieldClass = 'light' | 'one_handed' | 'two_handed' | 'offhand';

/**
 * A bonus an item grants only in one hand, optionally only when the OTHER hand
 * carries a matching item — the parrying dagger that comes alive beside a
 * rapier. Unlike the item's ordinary mods, hand bonuses are never scaled down:
 * they describe the item used exactly as intended.
 */
export interface HandBonus {
  /** Tag the other hand's item must carry ('rapier'); absent = any pairing. */
  pairedWith?: string;
  /** Tooltip line, e.g. 'Paired with a rapier: +5% Parry'. */
  desc: string;
  mods: Modifier[];
}

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  slot: SlotId;
  /** Hand items only. Defaults to one-handed in the weapon slot, off-hand in the other. */
  wield?: WieldClass;
  /** Granted while held in the main hand (also waives the misfit penalty there). */
  mainHand?: HandBonus;
  /** Granted while held in the off hand. */
  offHand?: HandBonus;
  tags: string[];
  mods: Modifier[];
  value: number;
  desc?: string;
  /** Conditions required to equip (attribute/skill thresholds). */
  requirements?: UnlockCondition[];
  /** Extra typed damage dealt on every weapon hit (enchants like the Ember Knife). */
  bonusDamage?: { type: DamageType; value: number };
  /**
   * Rune-slot size class override. Inferred when absent: daggers/accessories
   * roll small (fewer slots), chests/legs/greatswords large, the rest medium.
   */
  runeClass?: RuneSizeClass;
}

export interface Affix {
  name: string;
  mods: Modifier[];
}

export interface ItemInstance {
  uid: number;
  defId: string;
  affix?: Affix;
  /** Rune slots rolled at generation (0–4). Absent on legacy items = 0. */
  slots?: number;
  /** Socketed runes, at most `slots` long. See RuneRef. */
  runes?: RuneRef[];
  /**
   * How big THIS one is, on SIZE_LADDER. Absent reads as medium.
   *
   * On the instance rather than the def, because it is a property of the
   * specimen and not of the design: the same hammer drops person-sized off a
   * bandit and gargantuan off a jötunn, and the second is a different problem
   * to swing. It is what makes looting a giant's gear interesting rather than
   * just another hammer.
   */
  size?: SizeTag;
}

// ---------- Runes ----------

export type RuneSizeClass = 'small' | 'medium' | 'large';

/** Where a rune's host item sits: weapon slot, accessory slot, or any armor. */
export type RuneContext = 'weapon' | 'armor' | 'accessory';

/** Which rune-effect context an equipment slot provides (offhand counts as armor). */
export function runeContextFor(slot: SlotId): RuneContext {
  if (slot === 'weapon') return 'weapon';
  if (slot === 'accessory') return 'accessory';
  return 'armor';
}

/**
 * Rune graph surgery on ONE technique (weapon context only): magic may
 * rewrite any single node — tempo, payload, exit, even the Honed offering —
 * but never an edge list (see docs/MARTIAL.md §9).
 */
export interface RuneTechniqueMod {
  /** The technique this rune rewrites. */
  technique: string;
  /** Display name while socketed (e.g. Sidestep → "Flash Step"). */
  rename?: string;
  /** Multiplier on the move's strike damage. */
  damageMult?: number;
  cooldownMult?: number;
  /** Added to the strike's penetration / splash. */
  penetrationAdd?: number;
  splashAdd?: number;
  /** The technique's exit position becomes this while socketed. */
  exitTo?: string;
  /** An extra fork archetype offered at the Honed choice while socketed. */
  grantsFork?: string;
}

/** What a rune grants in ONE context (a rune defines up to three of these). */
export interface RuneEffect {
  /** Stat modifiers while the host item is equipped. */
  mods?: Modifier[];
  /** Weapon context only: flat typed damage added to every weapon hit. */
  bonusDamage?: { type: DamageType; value: number };
  /** Weapon context only: fraction of each hit dealt again as this type (0.12 = 12%). */
  bonusDamagePct?: { type: DamageType; value: number };
  /** Weapon context only: graph surgery on specific techniques. */
  techniqueMods?: RuneTechniqueMod[];
}

/**
 * A rune is a stackable socketable: its effects are fixed per context, and
 * what it grants simply depends on where it is slotted. Contexts without an
 * entry mean the rune does nothing there (still socketable, shown as inert).
 */
/**
 * A rune a player carved, stored as THE COMBINATION THAT MADE IT rather than
 * as a blob of finished effects.
 *
 * That choice buys three things at once. It is reverse-engineerable by
 * construction — the rune carries what went into it, so a rune passed to
 * somebody else needs no shared registry to be understood. It costs almost
 * nothing to store: a few ids and grades, not a stat block. And "named runes"
 * become a content table matched against the combination (see NAMED_RUNES)
 * rather than a special case, so discovering that an exact recipe has a name is
 * a thing the data can say.
 *
 * Two carvers who use the same things get the same rune, deterministically.
 */
export interface CarvedRune {
  /**
   * The patterns cut into the slab — what the rune fundamentally does. A slab
   * takes one to begin with and up to three as the carver's hands steady.
   */
  patterns: string[];
  /**
   * The slab it was cut into, and how good it was. A fine tool can bring this
   * out a grade better than the stone started, which is the only mark the tool
   * leaves — the rune stays purely a record of what it is made of.
   */
  stone: GradedStack;
  /**
   * Everything worked into the cuts: pigment, inlay, gems. Which station each
   * came from is a bench affordance, not a property of the finished rune — what
   * matters is that the gold is in it.
   */
  adornments: GradedStack[];
}

/** Either a catalogue rune (an id into RUNES) or one somebody carved. */
export type RuneRef = string | CarvedRune;

/**
 * An exact combination with a name of its own. Matched against a CarvedRune;
 * hitting one is how a carver discovers that their recipe is a known work.
 */
export interface NamedRuneDef {
  id: string;
  name: string;
  icon: string;
  desc?: string;
  /** Patterns that must ALL be cut into it (order irrelevant). */
  patterns: string[];
  /** Adornment ids that must ALL be present (order irrelevant). */
  adornments: string[];
  /** The stone must be at least this good. */
  minQuality?: QualityTier;
  /** Granted on top of what the combination already produces. */
  bonus?: Partial<Record<RuneContext, RuneEffect>>;
}

export interface RuneDef {
  id: string;
  name: string;
  icon: string;
  desc?: string;
  /** Sell value per rune. */
  value: number;
  effects: Partial<Record<RuneContext, RuneEffect>>;
}

// ---------- Spellcraft ----------

/**
 * The three ways a spell comes to exist. They share one resolved form
 * (SpellSpec) and one book (state.grimoire) but nothing about HOW a spell is
 * made: arcane magic is composed from syntax, divine magic is received whole,
 * psionic magic is shaped by pressure along axes. Each is a seed of a larger
 * system — the shared spec is what lets them grow independently.
 */
export type SpellSchool = 'arcane' | 'divine' | 'psionic';

/** Who a spell lands on. 'others' means every enemy in the formation. */
export type SpellTarget = 'one' | 'others' | 'self';

/** One damage clause of a resolved spell. Power is in spell-power multiples. */
export interface SpellStrike {
  type: DamageType;
  /**
   * A second nature the strike may resolve as: it lands as whichever of the
   * two types the TARGET resists less (holy fire finds the gap between fire
   * and light). Absent = single-typed.
   */
  orType?: DamageType;
  power: number;
  /** Share of the target's typed resistance ignored (0–0.95). */
  penetration?: number;
  /** The clause lands this many times per cast ("twice"). Default 1. */
  hits?: number;
  /**
   * Added to the caster's crit chance for this strike — how hungrily the
   * clause was spoken ("viciously" seeks the seam, "gently" declines to).
   * May be negative; the total is floored at zero when rolled.
   */
  critBonus?: number;
  /**
   * Added to the caster's crit DAMAGE for this strike — how wide the seam
   * opens once found. May be negative; floored at 1 (a crit is never worse
   * than an ordinary blow).
   */
  critDamageBonus?: number;
  /**
   * A follow-up strike ("then"): its power is multiplied by this when the
   * strike BEFORE it in the volley dealt damage. Resolved per cast, per
   * target — the follow-through is earned, not assumed.
   */
  followUp?: number;
  /**
   * Untyped: the strike bypasses resistance AND weakness — the raw number
   * lands, no more, no less. `type` remains for bookkeeping and display.
   */
  untyped?: boolean;
  /** "or": strikes sharing a group are alternatives — one rolled per cast. */
  altGroup?: number;
  /**
   * "if": the strike fires only while the target bears one of these
   * conditions. Empty = conditioned on nothing, which never comes true.
   */
  onlyIf?: string[];
  /** Conditions inflicted on whatever the strike lands on. */
  inflicts?: StatusApplication[];
}

/**
 * The resolved form every school compiles into — what a spell DOES, with no
 * memory of how it was made. Mirrors the rune model: the crafted spell stores
 * its combination, and this is derived from it deterministically on read.
 */
export interface SpellSpec {
  name: string;
  icon: string;
  desc?: string;
  school: SpellSchool;
  target: SpellTarget;
  /** Damage dealt per cast; empty for pure utility spells. */
  strikes: SpellStrike[];
  /** Healing, in spell-power multiples. The caster's, unless `healsEnemy`. */
  heal?: number;
  /**
   * The healing lands on the spell's TARGET instead of the caster — the
   * grammar's darkest gift ("water mend one"). Excess healing has nowhere to
   * go in a body that is already whole; it becomes overgrowth (see
   * StatusDef.surplus). Only set when the address was explicitly spoken.
   */
  healsEnemy?: boolean;
  /** Share of each strike carried into a random flanking enemy. */
  splash?: number;
  /** A buff granted to the caster on cast. */
  buff?: { name: string; mods: Modifier[]; duration: number };
  /**
   * Conditions granted to the CASTER on cast — how a blessing is worn.
   * Statuses rather than plain buffs, so blessings persist out of combat and
   * can carry the whole condition vocabulary (including deliberate self-harm:
   * Xima's communion opens the adherent's own veins).
   */
  grants?: StatusApplication[];
  /**
   * Conditions laid on the TARGET on cast — `grants`' mirror, and the only way
   * a working with no damage can do anything to an enemy. `SpellStrike.inflicts`
   * rides a blow and only lands if that blow dealt damage; these are the
   * working itself arriving, so they land whether or not anything was struck.
   * A spell that merely exposes someone, or argues with the space they are
   * standing in, has no blow to hang a rider on.
   */
  afflicts?: StatusApplication[];
  /**
   * The spell's strikes and healing are multiplied while any of these
   * conditions afflict ANY combatant, caster included — Kenese's miracles
   * feed on the poison in the room, whoever is carrying it.
   */
  empowered?: { statuses: string[]; mult: number };
  /**
   * Matching conditions are STRIPPED from the caster and inflicted on the
   * target at the accumulated intensity × mult (Poison Eater). Resolved per
   * cast; holding none of them simply transfers nothing.
   */
  transfers?: { statuses: string[]; mult: number };
  /**
   * Matching conditions already on the target are intensified × mult and
   * their clocks wound back up. Nothing there = nothing amplified.
   */
  amplify?: { statuses: string[]; mult: number };
  /** The deity whose miracle this is. Divine spells only. */
  deity?: string;
  /** The spell cannot be evaded — a working that sees where the target WILL be. */
  sure?: boolean;
  /**
   * The working is a COUNTERSPELL ("undo"): never cast on its own, but held
   * like a trap and sprung inside somebody else's casting. How well it
   * answers that casting is read against the other working's `signature` at
   * the moment it springs (see arcane.ts `counterEfficiency`).
   */
  counter?: SpellCounter;
  /**
   * What the working is MADE of, for a counterspell to match against: each
   * element spoken, and how deeply. An arcane sentence states it outright
   * (its nouns, and a bare verb's own substance); a miracle or a shape has no
   * words, so theirs is read off their strikes instead (`workingSignature`).
   */
  signature?: Partial<Record<DamageType, number>>;
  /** Mana spent per cast, before efficiency. */
  manaCost: number;
  /** Stamina spent per cast — miracles paid for in breath. */
  staminaCost?: number;
  /**
   * Focus spent per cast — psionic workings, paid out of the mind's own pool
   * rather than the arcane one. One pool per school: mana understands, spirit
   * believes, focus wills.
   *
   * This is what an INSTANT working costs. A sustained one will instead eat
   * focus's MAXIMUM for as long as it is held (see docs/PSIONIC.md §8) — two
   * different relationships to the same pool, and the reason focus is not
   * simply mana with another name.
   */
  focusCost?: number;
  /** Ticks between casts. */
  cooldown: number;
}

/**
 * An undoing, as the grammar composed it — everything a counterspell knows
 * before it has met the working it will answer. Efficiency is not stored:
 * it depends on what the OTHER side was saying, so it is read at the moment
 * the trap springs.
 */
export interface SpellCounter {
  /** Undo tiers spoken across the sentence — "unsay" is two, "undo undo" too. */
  tiers: number;
  /**
   * What the undoing is tuned against: element → units spoken (a noun's
   * depth — frost is two units of cold). `arcane` counts twice over: as a
   * tuning like any element, and as the universal substance of undoing.
   */
  tuning: Partial<Record<DamageType, number>>;
  /** Manaburn laid on the caster at 100% efficiency, in spell-power multiples. */
  burn: number;
  /** Separate applications of that burn — leading landing adverbs. Default 1. */
  burns?: number;
}

// ----- Arcane: the syntax -----

export type ArcaneWordKind = 'noun' | 'verb' | 'adverb' | 'target' | 'conjunction';

/**
 * What a conjunction does to the boundary it sits on. A conjunction belongs
 * to no clause: it closes the clause before it and types its relationship to
 * the clause after it — the difference between "fire pierce ice fly" (two
 * workings at once, each diluting the other) and "fire pierce THEN ice fly"
 * (one working following through into the opening the other made).
 */
export interface ArcaneConjunctionSpec {
  /** The following clause's strike inherits the preceding strike's penetration. */
  inheritPenetration?: boolean;
  /** The following strike's power ×this when the preceding strike LANDED. */
  followThrough?: number;
  /**
   * "and": the following clause FUSES into the preceding strike — one blow,
   * two natures (`orType` finds the weaker resistance), both riders, the
   * joined clause's power added at this efficiency.
   */
  fuse?: number;
  /**
   * "but": the following clause strikes NOT AT ALL — it transmutes instead,
   * replacing the preceding strike's inflicted conditions with its own.
   * "Dragging blaze but venom": the fire's full weight, the snake's bite.
   * A riderless clause (zero) strips the riders clean.
   */
  transmute?: boolean;
  /**
   * "or": the linked clauses become ALTERNATIVES — one is rolled per cast,
   * and each or-linked clause pays only this share of its mana. Chance as
   * thrift; luck and clairvoyance will learn to weight the roll.
   */
  alternate?: number;
  /**
   * "if": the following clause does not strike — its noun NAMES A CONDITION.
   * The preceding strike fires only while the target bears that noun's
   * signature affliction (or anything it escalates into).
   */
  condition?: boolean;
  /**
   * "with": the following clause ACCOMPANIES the one before rather than
   * acting on its own — a bare substance lent to whatever that clause was
   * doing. Undoing: it joins the tuning. A blow: its riders ride along, the
   * blow's nature and weight untouched. A ward: one more coat, against its
   * own element. A mending: its weight joins the mending. Coats and mending
   * weight are lent at this efficiency; tuning and riders arrive whole.
   * A linked clause that speaks a verb of its own acts for itself instead.
   */
  accompany?: number;
}

/** What a verb DOES to its clause. Declarative, so verbs are pure content. */
export interface ArcaneVerbSpec {
  /**
   * How the verb DELIVERS the substance, as a multiplier on the chance its
   * conditions take hold. This is the third leg of the physical triangle:
   * a cut delivers deeply (>1) and hits softer, a crush hits hardest and
   * delivers poorly (<1), a thrust bypasses guard and delivers poorly.
   */
  statusRate?: number;
  /**
   * The verb's OWN substance, for when it is spoken with no noun to shape.
   * "Cut one" is a slash; "fire cut one" is fire delivered as one. A verb
   * without these falls back to raw arcane force (see barePower).
   */
  bareType?: DamageType;
  bareInflicts?: StatusApplication[];
  /** Multiplier on the clause noun's damage. */
  powerMult?: number;
  /** Damage the verb carries on its own, cast with no noun (raw force). */
  barePower?: number;
  /** Penetration granted to the clause's strike. */
  penetration?: number;
  /** Multiplier on the intensity of conditions the noun inflicts. */
  gripMult?: number;
  /** Multiplier on the finished spell's cooldown. */
  cooldownMult?: number;
  /** Share of the strike carried into a flanking enemy. */
  splash?: number;
  /**
   * The clause heals the caster instead of harming the target: its damage
   * becomes healing at this efficiency. Restorative clauses always apply to
   * the caster — you cannot mend a slime.
   */
  restore?: number;
  /**
   * The clause becomes a ward: resistance against the noun's element (or a
   * touch of armor, cast bare), worn for `duration` ticks. Wards always apply
   * to the caster.
   */
  ward?: { amount: number; duration: number };
  /**
   * The clause UNMAKES: the working becomes a counterspell, held like a trap
   * and sprung inside an enemy's casting (SpellSpec.counter). Its noun tunes
   * the undoing to an element; `burn` is the manaburn it lays on that caster
   * at 100% efficiency, in spell-power multiples.
   */
  undo?: { burn: number };
}

/** What an adverb does to the clause it sits in. */
export interface ArcaneAdverbSpec {
  /**
   * What the adverb does to the clause's critical hits, per position — the
   * same lead/trail split the clock uses. LEADING speaks about the casting:
   * how often the working hunts the vital spot (chance). TRAILING speaks
   * about the substance: what it does when it finds one (damage). So
   * "viciously plague" seeks the seam oftener, "plague viciously" opens it
   * wider. Both ADD rather than compound over tiers.
   */
  crit?: {
    lead?: { chance?: number; damage?: number };
    trail?: { chance?: number; damage?: number };
  };
  /**
   * Multiplier on how DEEPLY the clause's conditions bite — purely their
   * intensity, never the blow's weight. Compounds over tiers, and is floored
   * (see INTENSITY_FLOOR) so a dimmed affliction is always still an
   * affliction. Position is the substance's business: spoken first the
   * pushing changes and the clock does not; spoken last the substance itself
   * is concentrated or diluted, and burns shorter or lingers longer to match.
   */
  intensity?: number;
  /** Multiplies the clause's damage / healing / ward strength. */
  powerMult?: number;
  /** Multiplies the finished spell's cooldown. */
  cooldownMult?: number;
  /** Multiplies the clause's share of the mana cost. */
  manaMult?: number;
  /** The clause lands this many times per cast. */
  hits?: number;
  /**
   * How the adverb moves a condition's CLOCK, with a distinct shape per
   * position so neither dominates: `dur` multiplies the window, `rate` the
   * per-tick bite. Leading ("slowly blaze") speaks about time; trailing
   * ("blaze slowly") about the substance. Slowly trades damage against
   * uptime; quickly trades delivery speed against efficiency.
   */
  clock?: {
    lead: { dur: number; rate: number };
    trail: { dur: number; rate: number };
  };
}

/**
 * One word of the arcane lexicon. A word is a thing you KNOW (gated by the
 * Arcana skill), not a thing you own — like a carving pattern. Exactly one of
 * the kind-specific fields is present, matching `kind`.
 */
export interface ArcaneWordDef {
  id: string;
  /** The word as spoken, lowercase — sentences read as chains of these. */
  word: string;
  /**
   * What the word BECOMES spoken twice and thrice in a row: fire→flame→blaze.
   * Adjacent repetition deepens a word instead of opening a new clause; its
   * effect grows faster than linear and its cost faster still (see
   * STACK_POWER / STACK_MANA in arcane.ts). Targeting words never stack —
   * an address repeated is just an address.
   */
  stacked?: [string, string];
  kind: ArcaneWordKind;
  icon: string;
  desc?: string;
  /** Arcana level before the word can be used. */
  minLevel?: number;
  /** What speaking it adds to the spell's mana cost. */
  mana?: number;
  /** Nouns: the substance. */
  element?: DamageType;
  /**
   * Nouns: the strike is UNTYPED — raw "get hit", unaffected by resistance
   * and weakness alike. Zero's whole identity: reliable, and never great.
   */
  untyped?: boolean;
  /** Nouns: base damage in spell-power multiples. */
  power?: number;
  /** Nouns: the substance's signature conditions. */
  inflicts?: StatusApplication[];
  /** Verbs. */
  verb?: ArcaneVerbSpec;
  /** Adverbs. */
  adverb?: ArcaneAdverbSpec;
  /** Targeting words. */
  target?: SpellTarget;
  /** Conjunctions. */
  conjunction?: ArcaneConjunctionSpec;
}

// ----- Divine: deities and their miracles -----

/**
 * One clause of a deity's disposition toward other deities: applies to any
 * deity carrying one of `anyOf`, unless it also carries one of `unless` —
 * and the exception itself is waived by `waiver`. This is exactly expressive
 * enough for dispositions like "humanoid gods who aren't tricksters, unless
 * they are also honorable".
 */
export interface DeityRelationRule {
  anyOf: string[];
  unless?: string[];
  waiver?: string[];
}

/**
 * A worshippable entity. Tags are its ASPECTS — the vocabulary its miracles
 * are cut from and the terms every relation rule speaks in. Relations are
 * declared per deity and resolved pairwise (see systems/deities.ts); when one
 * side's synergy meets the other side's grudge, THE GRUDGE WINS.
 */
export interface DeityDef {
  id: string;
  name: string;
  /** "the Cold Sun" — how the name is completed. */
  epithet: string;
  icon: string;
  /** Portrait file in src/assets/deities (with extension); absent = icon only. */
  art?: string;
  desc: string;
  tags: string[];
  /**
   * The pantheon this power is counted among, if any. Usually left unset and
   * claimed with a `membership` TAG instead — the tag already carries the
   * pantheon's name and glyph, so saying it twice invites the two to
   * disagree. This field overrides the tag when a god needs a pantheon that
   * is not among its aspects (see `deityGroups`).
   */
  pantheon?: string;
  synergies?: DeityRelationRule[];
  hostilities?: DeityRelationRule[];
}

/**
 * A body of gods worshipped together. Membership is the deity's claim, not
 * the pantheon's, so a pantheon needs no roster — see `deityGroups`.
 */
export interface PantheonDef {
  id: string;
  name: string;
  icon: string;
  desc?: string;
}

/**
 * Axes a deity's aspects fall along. A tag filter ORs within an axis and ANDs
 * across them, exactly as the bestiary's does — "a tribal god who is bestial
 * OR humanoid".
 */
export type DeityTagCategory = 'scope' | 'nature' | 'membership' | 'alignment' | 'temperament' | 'domain';

export interface DeityTagDef {
  id: string;
  name: string;
  icon: string;
  category: DeityTagCategory;
  desc?: string;
}

/** How two deities stand toward one another. */
export type DeityRelation = 'synergy' | 'hostile' | 'neutral';

/**
 * A miracle: a divine working, received whole from a particular deity.
 * Divine magic is not composed — the shape of the prayer was fixed long
 * before the supplicant was born. Learning one spends favor WITH THAT DEITY;
 * the miracle then sits in the grimoire like any other spell.
 */
export interface MiracleDef {
  id: string;
  /** The deity whose power this is an aspect of. */
  deity: string;
  name: string;
  icon: string;
  desc: string;
  /** Favor spent, once, to receive it. */
  favorCost: number;
  /** Devotion level required. */
  minLevel?: number;
  /** The granted spell, stated whole. */
  spec: Omit<SpellSpec, 'school'>;
}

// ----- Psionic: shaping -----

/**
 * A psionic working is raw mental pressure shaped along eight axes. Points
 * come from the Psionics skill; the shape is the whole of the spell's
 * identity, the way a sentence is an arcane spell's.
 *
 * The axes are only the INPUT. What a shape does is read off the quantities
 * they compute to (see PsiQuantityId) — force and mass are not effects, they
 * are terms.
 */
export type PsiAxisId =
  | 'force'
  | 'reach'
  | 'grip'
  | 'speed'
  | 'clairvoyance'
  | 'space'
  | 'mass'
  | 'vitality';

/** Points per axis; a missing axis is 0 — and ZERO is itself a threshold a
 * working may require ("no speed, no mass" is a shape, not an absence). */
export type PsionicShape = Partial<Record<PsiAxisId, number>>;

export interface PsionicAxisDef {
  id: PsiAxisId;
  name: string;
  icon: string;
  desc: string;
  /** CSS colour for the wheel. */
  color: string;
}

/** A band a quantity must sit in. Omitted min/max = unbounded that side. */
export interface PsiRequirement {
  min?: number;
  max?: number;
}

/**
 * The quantities a shape is READ as. Nothing downstream looks at raw point
 * counts: the axes are the input, these are the language the working is
 * actually spoken in, and every part of the resolved spell keys off one of
 * them. Two axes can therefore produce opposite workings with no table saying
 * so — mass held still is a wall (`inertia`), mass in motion is a hammer
 * (`momentum`), and that is a fact about multiplication, not about content.
 *
 * Zero stays meaningful for free: every quantity built from a product is 0
 * the moment either factor is.
 */
export type PsiQuantityId =
  | 'pressure'
  | 'momentum'
  | 'inertia'
  /** Sharpness of sight. Named `acuity`, not focus — Focus is the RESOURCE. */
  | 'acuity'
  | 'awareness'
  | 'coherence'
  | 'purchase'
  | 'inward';

/** A shape's derived reading. See `deriveShape` for each quantity's formula. */
export type PsiDerived = Record<PsiQuantityId, number>;

/**
 * Multipliers on the derived reading, gathered from whatever the shaper is
 * wearing (and from whatever they are aimed at). 1 = untouched.
 *
 * This is how matter argues with a working. Because recognitions read the
 * quantities, a bias can change which one FIRES — nullsteel dragging acuity
 * under the needle threshold turns an Unerring Needle back into a shove, with
 * nothing anywhere naming either.
 */
export type PsiBias = Partial<Record<PsiQuantityId, number>>;

/** One derived quantity, stated for the player (see PSI_QUANTITIES). */
export interface PsiQuantityDef {
  id: PsiQuantityId;
  name: string;
  icon: string;
  /** The literal arithmetic, so the wheel can teach the space rather than hint at it. */
  formula: string;
  desc: string;
  /** Decimals in the readout: ratios need them, counts do not. */
  decimals: number;
}

/**
 * A name earned for a REGION of the derived space — the psionic equivalent of
 * NAMED_RUNES (see systems/runes.ts `namedRuneFor`). A recognition never
 * decides what a shape does: the spec is already fully computed from the
 * quantities by the time one is looked for. It supplies a name, an icon, a
 * description, and the one flat bonus every recognition carries
 * (PSIONIC.recognitionBonus) for having found a shape worth naming.
 *
 * Bands are normally over derived quantities. Raw axes are allowed for the
 * rare case where the axis IS the statement (Still Mind wants vitality
 * itself, not a ratio), but reaching for one is a sign the space is missing a
 * quantity.
 */
export interface PsionicRecognitionDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  region: Partial<Record<PsiQuantityId | PsiAxisId, PsiRequirement>>;
  /** Teacher tier needed before the mind can hold this one (4, 8, 12). */
  tier?: number;
  /**
   * Explicit tie-break when regions overlap; higher wins. Rarely needed —
   * matching already prefers the more constrained region, then the tighter
   * one (a min-8 outranks its min-4 sibling automatically).
   */
  priority?: number;
}

/** A shape held in mind rather than inscribed — see PsiState.memorized. */
export interface PsiMemory {
  name: string;
  shape: PsionicShape;
}

/** The player's psionic development: which axes are open, which threshold
 * tier a teacher has unlocked (0 until one is found). */
export interface PsiState {
  axes: PsiAxisId[];
  tier: number;
  /**
   * Shapes held in mind, for moving an allocation around quickly — the point
   * of a school whose whole identity is reshaping will on demand. These are
   * NOT grimoire entries: nothing here has been inscribed, and recalling one
   * only fills the wheel with it.
   *
   * Optional on purpose, so saves from before the bench could memorise load
   * untouched and need no migration. Read it through `psiMemorized`.
   */
  memorized?: PsiMemory[];
}

// ----- The grimoire -----

/** What made a spell — the combination, not the result. */
export type SpellSource =
  | { school: 'arcane'; words: string[] }
  /** `litany` holds a MIRACLE id — the field name predates the pantheon. */
  | { school: 'divine'; litany: string }
  | { school: 'psionic'; shape: PsionicShape };

/**
 * A spell the player has crafted, stored as WHAT MADE IT (see CarvedRune for
 * the reasoning: reverse-engineerable, tiny, and named works become content).
 * Effects are derived on read via resolveSpell and memoised.
 */
export interface CraftedSpell {
  uid: number;
  source: SpellSource;
  /** A name the player gave it; absent = the school's generated one. */
  name?: string;
  /** Prepared spells join the combat rotation. */
  prepared?: boolean;
}

// ---------- Locations ----------

/**
 * What kind of country a region is, for the climate baseline (see
 * data/climate.data.ts for each terrain's profile). Deliberately coarse —
 * this drives weather, not art.
 */
export type TerrainId =
  | 'plains'
  | 'forest'
  | 'hills'
  | 'mountains'
  | 'coast'
  | 'desert'
  | 'volcanic'
  | 'caves';

export interface RegionDef {
  id: string;
  name: string;
  /**
   * Hand-placed world-atlas coordinates in the same 0–100 × 0–75 space the
   * region maps use. Authored by dragging pins in the forge's World Atlas.
   * Regions without one haven't been placed yet — systems that need world
   * geometry (inter-region distance, climate) must treat them as unplaced
   * rather than defaulting to a position.
   */
  world?: { x: number; y: number };
  /** Climate terrain. A region without one gets the neutral 'plains' profile. */
  terrain?: TerrainId;
  /**
   * Interiors: caves, the home base. Weather stops at the door — wind and
   * precipitation zero out and only a damped temperature leaks in.
   */
  sheltered?: boolean;
  /**
   * No fog: discovering any spot in the region discovers all of them
   * (systems/mapped.ts). Set on Threshold.
   */
  mapped?: boolean;
  /**
   * Place tags for the WHOLE region — see `SpotDef.tags`. A spot's effective
   * tags are the union down the chain (region ∪ area ∪ spot), so 'dark' on a
   * cave-system region darkens every chamber without tagging each one.
   */
  tags?: string[];
}

export interface AreaDef {
  id: string;
  name: string;
  regionId: string;
  /** Place tags for every spot in the area — see `SpotDef.tags`. */
  tags?: string[];
  /** The backdrop fights here are drawn against (see SceneId). */
  scene?: SceneId;
}

/**
 * Which backdrop the battle stage and the Location header paint behind a
 * place. Presentation only — nothing in the core reads it — but it lives on
 * the data so a place's look is authored where the place is, and a typo fails
 * the typecheck rather than quietly painting the default. A spot's own
 * `scene` wins over its area's; with neither, the UI picks from the place
 * tags (ui/lib/scenes.ts).
 */
export type SceneId = 'town' | 'hall' | 'crypt' | 'cistern' | 'webs';

/**
 * The opening a particular way into a fight buys — or costs. Declared on a
 * connection and applied to the FIRST encounter at the destination after
 * arriving along it, before anyone has swung: the quiet tunnel leaves the
 * nest surprised, the reckless slide leaves YOU flat-footed. Directional like
 * `forced`, and never mirrored.
 */
export interface ApproachSpec {
  /**
   * The approach only tells when these hold on arrival — the lever pulled in
   * another room, the skill to move quietly, the quest that taught the way.
   */
  requires?: UnlockCondition[];
  /** Conditions laid on every spawned enemy (surprised, burning...). */
  enemies?: StatusApplication[];
  /** ...and what the way in charges the traveler (flat_footed). */
  self?: StatusApplication[];
}

export interface Connection {
  to: string;
  ticks: number;
  /** Invisible until these hold; never copied onto the return edge. */
  revealWhen?: UnlockCondition[];
  /** One-way edges (drops, slides) get no automatic reverse edge. */
  oneWay?: boolean;
  /**
   * Arriving at `to` ALONG THIS EDGE starts a fight that cannot be fled (see
   * `SpotDef.forced` for the any-route version — the mechanics are its). The
   * registry mirror never carries this flag: the road back out of an ambush
   * is not itself an ambush.
   */
  forced?: boolean;
  /**
   * The road is visible but SHUT until these hold. Checked when travel is
   * attempted and shown, locked with its terms, at the door — advertised-but-
   * locked, the same shape as a gated floor, never a hidden wall. DIRECTIONAL
   * like `forced`: the registry mirror never carries it, so locking the way
   * out leaves the way back open.
   */
  requires?: UnlockCondition[];
  /** The opening this way in buys or costs (see ApproachSpec). Never mirrored. */
  approach?: ApproachSpec;
  /** Hidden until the source spot has been fully explored. */
  hidden?: boolean;
  /** How the road reads going OUT, e.g. 'Steep Climb', 'Old Road'. */
  label?: string;
  /**
   * How the mirrored edge reads coming BACK, when the way home isn't the same
   * act described in reverse — you slide down a chute but you scramble up it.
   * Defaults to `label`, which is right for a road that is simply a road.
   * Meaningless on a `oneWay` edge, since no mirror is built.
   */
  returnLabel?: string;
}

/**
 * One source that speeds up an activity or improves its output. Exactly one of
 * attr/stat/skill identifies the value read; `weight` is its additive
 * contribution per unit (factors stack as 1 + Σ weight·(value − base)).
 * `base` is subtracted from the value first — use 1 for multiplier stats
 * (goldGain, loot…) so only the amount above their 1.0 baseline counts;
 * attributes, skills, and chance stats keep the default 0. A `skill` may name a
 * not-yet-built skill, which reads as level 0 until it exists.
 */
export interface ActivityFactor {
  attr?: AttributeId;
  stat?: StatKey;
  skill?: string;
  weight: number;
  base?: number;
}

/** Fields shared by cycle-based activities (train/gather/job/craft). */
export interface ActivityCycleTags {
  /** Sources that speed up completion (ignored when `staticTime`). */
  speedFactors?: ActivityFactor[];
  /** Sources that improve output/reward (amount, with a diminishing cap). */
  outputFactors?: ActivityFactor[];
  /** Hyperbolic soft-cap on the output bonus; omit for uncapped. */
  outputCap?: number;
  /** Fixed duration: the speed stat and speedFactors are ignored; reward scales instead. */
  staticTime?: boolean;
  /**
   * Attribute XP split for one completed cycle, e.g. `{ cha: 0.5, str: 0.25,
   * dex: 0.25 }`. Weights MULTIPLY the kind's base payout rather than dividing
   * a fixed pool, so they may sum past 1 — a punishing task can legitimately
   * total ×1.5. Omit to keep the kind's default: train → its own `attr`,
   * gather → Wisdom, job → Charisma, craft → nothing.
   */
  attrXp?: Partial<Record<AttributeId, number>>;
  /**
   * Extra skill tags this activity emits on top of its kind's built-ins
   * (train → 'training' + each trained attribute, gather → 'explore'/'gather',
   * craft → 'craft'). This is how a skill becomes reachable from an activity:
   * `checkDiscovery` and `grantSkillXp` both match on these, so a Mining skill
   * tagged 'mining' only manifests at a site that emits 'mining'.
   *
   * Every cycle kind honors them, jobs included — paid work teaches the same
   * way unpaid work does. Built-ins per kind: train → 'training' + each
   * trained attribute, gather → 'explore'/'gather', craft → 'craft',
   * job → 'job'.
   */
  tags?: string[];
  /**
   * Rare finds rolled once per completed cycle (systems/activitydrops.ts):
   * `chance` per cycle, drought-protected like every roll under 15%. A drop
   * whose material teaches a recipe the player already knows (or holds) is
   * skipped, so a recipe card turns up once.
   */
  drops?: ActivityDrop[];
}

export interface ActivityDrop {
  material: string;
  chance: number;
  /** How many arrive at once. Default 1. */
  qty?: number;
  /** A graded drop arrives at this grade instead of a rolled one. */
  quality?: QualityTier;
  /**
   * Each previous find divides the chance by this (2 = every repeat takes
   * twice as long on average). Counted under `found:<material>`.
   */
  rarer?: number;
  /** Not rolled while one is held (a tool you only need one of). */
  unique?: boolean;
}

export type ActivityDef =
  | ({ id: string; kind: 'search'; name: string; icon: string; ticksPer: number; rewards: SearchReward[] } & ActivityCycleTags)
  /** Trains `attr`, or several at once via `attrXp` — at least one is required. */
  | ({ id: string; kind: 'train'; attr?: AttributeId; name: string; icon: string } & ActivityCycleTags)
  | { id: string; kind: 'hunt'; name: string; icon: string }
  /**
   * Somewhere to recover. `requires` makes it a CONDITIONAL haven — a cave you
   * can only camp in with a lantern, a shrine only the faithful may sleep at.
   * A rest spot with no conditions is a haven for anyone, which is what makes
   * it a safe fallback when a conditional one turns out to be shut (see
   * `safeSpots` in GameState).
   */
  | { id: string; kind: 'rest'; name: string; icon: string; requires?: UnlockCondition[] }
  /**
   * Searching a place. `tags` name what KIND of place it is ('cave', 'ruins'),
   * which both reaches skills and scopes a `loot:cave` bonus to it — the rest
   * of ActivityCycleTags is meaningless here, since exploring has no cycle.
   */
  | { id: string; kind: 'explore'; name: string; icon: string; tags?: string[] }
  /** Produces a material every `ticksPer` ticks. */
  | ({ id: string; kind: 'gather'; material: string; ticksPer: number; name: string; icon: string } & ActivityCycleTags)
  /** Pays gold every `ticksPer` ticks; trains Charisma on the side. */
  | ({ id: string; kind: 'job'; gold: number; ticksPer: number; name: string; icon: string } & ActivityCycleTags)
  /** Crafts a recipe repeatedly while materials last (synthesized from SpotDef.recipes). */
  | ({ id: string; kind: 'craft'; recipe: string; name: string; icon: string } & ActivityCycleTags);

/**
 * Something a spot gives up once you have searched it hard enough.
 *
 * `at` is a SHARE of the spot's `exploreTicks` (0–1], not a tick count, so a
 * find sits at a *depth of search* — retune `exploreTicks` and every find on
 * the spot moves with it. Each fires once per save (remembered in
 * `state.finds`), and at most one fires per tick, so a spot that gained finds
 * after you had already combed it hands them over one at a time rather than
 * all in one line.
 *
 * The payload fields are deliberately NOT a discriminated union: one find is
 * naturally "a pouch — 12 gold and a rusty key". Set as many as apply; the
 * content linter checks whichever are present.
 */
export interface SpotFind {
  /** Unique within its spot — this is the key the save remembers. */
  id: string;
  /** Share of `exploreTicks` that must be done before it turns up (0–1]. */
  at: number;
  /** The log line. Falls back to one generated from the payload. */
  desc?: string;
  material?: { id: string; qty?: number };
  item?: string;
  /** A permanent, unsellable journal item, retained until prestige. */
  keyItem?: string;
  rune?: string;
  /** Inclusive gold roll. */
  gold?: [number, number];
  /** A rumor of somewhere else: marks that spot discovered (map + fast travel). */
  spot?: string;
  /**
   * Reveals ONE hidden connection out of this spot early, named by its `to`.
   * Without a find, hidden edges only appear at 100% explored — this is how a
   * back door opens halfway through the search instead of at the end.
   */
  path?: string;
  /** Skill XP under these tags, which can also manifest the skill. */
  skillXp?: { tags: string[]; xp: number };
  /**
   * Touch a persistent counter — the cross-room wire. `amount` bumps it
   * (default 1); `set` overwrites it instead, which is how content RESETS
   * things (a slain `once` boss, a spent `fightLimit`). The key must live in
   * the `flag:` namespace, except that `set` may also target `slain:` and
   * `fights:` counters — those two are exactly what resets are for. Anything
   * anywhere can then read it via `{ type: 'stat', key, value }` conditions:
   * an approach, an encounter gate, an explore gate, another find.
   */
  stat?: { key: string; amount?: number; set?: number };
  /**
   * Conditions that must hold before this find will turn up at all. Depth of
   * search says WHEN you could find it; this says whether you are equipped to
   * — the sealed door you need the key for, the seam only a miner would spot.
   *
   * Unmet, the find simply waits: it is not claimed, not logged, and turns up
   * on a later visit once the conditions hold. Arriving early costs nothing.
   */
  requires?: UnlockCondition[];
}

export interface KeyItemDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

/** One weighted result per completed search. Limits and guarantees are per spot/activity, per run. */
export interface SearchReward extends Omit<SpotFind, 'at' | 'path' | 'spot'> {
  weight: number;
  limit?: number;
  /** Force this eligible result by this completed search if it has never paid. */
  guaranteedBy?: number;
}

/**
 * A depth of search that cannot be passed without meeting `requires` — the
 * flooded passage needing a light, the rubble needing a pick. Progress stops
 * dead at `at`, so a spot can hold its later finds behind real preparation
 * rather than behind patience.
 */
export interface ExploreGate {
  /** Share of `exploreTicks` where the search stalls (0–1). */
  at: number;
  requires: UnlockCondition[];
  /** Shown when it stalls. Falls back to a generic line. */
  desc?: string;
}

/** One line of a spot's encounter table. */
export interface SpotEncounter {
  monsterId: string;
  weight: number;
  level: [number, number];
  /** Rolled only while these hold — a boss that appears once the seal breaks. */
  requires?: UnlockCondition[];
  /**
   * Rolled only during this half of the day, on the darkness system's own
   * boundary (night = dusk through dawn, `naturalDarkness` ≥ 0.5). A floor
   * whose keeper changes with the clock is authored as two entries.
   */
  daypart?: 'day' | 'night';
  /**
   * This entry is the SPOT'S BOSS: killing it bumps `boss:<spotId>` (an
   * engine counter, `slain:*`'s sibling — announced on the first kill only).
   * Several variant bosses share the one latch, which is how a floor clear
   * reads "the keeper is down, whichever keeper it was" without the AND-only
   * condition language growing an OR.
   */
  boss?: boolean;
  /**
   * The ambush window (plans/alpha-threshold-quests.md, quest 3): rolled only
   * while the player's power sits inside [min, max] of this spawn's own —
   * power being damage × max HP on both sides, the spawn priced at its level
   * band's midpoint and its tier's mid roll (`encounterPowerRatio`). An
   * overtuned foe that appears exactly when it would be tough-but-possible,
   * and stops appearing once outgrown — unfarmable from above by
   * construction. Both validation layers demand 0 < min < max, and that a
   * boss-cleared spot keeps at least one windowless boss.
   */
  window?: { min: number; max: number };
  /**
   * Slain once, gone: the kill is recorded under `slain:<spotId>:<monsterId>`
   * in `state.stats`, and the entry stops rolling while that counter is ≥ 1.
   * Content resurrects it by resetting the counter (see `SpotFind.stat`).
   */
  once?: boolean;
}

export interface SpotDef {
  id: string;
  name: string;
  icon: string;
  areaId: string;
  desc: string;
  activities: ActivityDef[];
  encounters?: SpotEncounter[];
  /**
   * The spot holds only this many winnable fights: every encounter WON here
   * bumps `fights:<spotId>` (only counted when this field is set), and at the
   * limit the spot is CLEARED — hunts find nothing and a forced spot stops
   * forcing, because the thing that forced it is dead. Reset by clearing the
   * counter (see `SpotFind.stat`).
   */
  fightLimit?: number;
  /** How the place is drawn (see SceneId). Overrides the area's. */
  scene?: SceneId;
  /**
   * A menagerie: the fights here are staged, and so is the learning. Kills at
   * a caged spot skip the bestiary's insight roll — every fact unlocks
   * OUTRIGHT the moment its `minKills` is reached, so the book fills at
   * defined rates instead of rolled ones. The fights themselves are ordinary.
   */
  caged?: boolean;
  /**
   * A keeper who patches up beginners: after every fight WON here, a player
   * whose six attribute levels total at most `maxAttrTotal` is healed to full
   * and loses every condition that deals damage over time. Chained bouts are
   * what knock newcomers out (the next fight rolls with no recovery); this
   * removes the chain and leaves each bout its own risk. Outgrowing the cap
   * ends it, so it cannot become a free farm.
   */
  healBetweenBouts?: { maxAttrTotal: number };
  /**
   * The keeper's dare (systems/training.ts): every `every` fights won here
   * while `healBetweenBouts` still applies, play HOLDS on a question — fight
   * `monsterId` at `level`, alone and unfleeable, or decline and keep
   * training. Held time is banked as bonus time, never lost. Offers stop once
   * that monster has been beaten. `desc` is the keeper's line (prose).
   */
  dare?: SpotDare;
  /** Spawn weights for rolled modifier tiers (demiboss/boss/aberrant). */
  modifierWeights?: Partial<Record<ModifierTierId, number>>;
  /** Area group-size distribution, e.g. { 1: 20, 3: 40, 5: 40 } for a swarm zone. */
  groupWeights?: Partial<Record<number, number>>;
  /** Ticks of exploring needed to fully explore the spot (reveals hidden connections). */
  exploreTicks?: number;
  /** Graded rewards along the way to that total (see SpotFind). */
  finds?: SpotFind[];
  /** Depths the search cannot pass unprepared (see ExploreGate). */
  exploreGates?: ExploreGate[];
  /** Recipes craftable here (rendered as craft activities). */
  recipes?: string[];
  /** Modular crafting benches standing here (see data/disciplines.data.ts). */
  benches?: string[];
  /** Hand-placed map coordinates in a 0–100 space, per region. */
  map?: { x: number; y: number };
  /** Fast-travel hub (town squares, camps). */
  waypoint?: boolean;
  /**
   * Place tags (see systems/exposure.ts). Elemental tags ('heat' on a forge
   * floor, 'dark' in a tomb) seep passive resist XP into whoever loiters
   * here; 'indoor' puts a roof between the player and the weather; and
   * 'settlement' means lamplight — no darkness training, no night-fighting
   * penalty. Both linter layers check the vocabulary.
   */
  tags?: string[];
  /**
   * Arriving here BY ANY ROUTE starts a fight that cannot be fled: the
   * encounter table spawns on the spot, travel and activity switches are
   * refused until it resolves, and losing throws the player to a haven
   * (systems/safety.ts). The map and every travel button warn first — the
   * player walks in knowing, or not at all.
   */
  forced?: boolean;
  connections: Connection[];
}

// ---------- The tutorial ----------

/**
 * The choices the tutorial hands out, each exactly once per life. A choice
 * is a Game method (`chooseTutorialWeapon` …) that grants and equips, then
 * stamps its `flag:tutorial_<choice>` counter so the step reads done.
 */
export type TutorialChoice = 'weapon' | 'stance' | 'spell';

/** The rack in the holding cell. `unarmed` grants nothing and is a real pick. */
export type TutorialWeapon = 'spear' | 'sword' | 'dagger' | 'hammer' | 'unarmed';

/**
 * One panel of the tutorial (data/tutorial.data.ts). The current step is
 * DERIVED: the first one whose `done` is false. No step index is saved —
 * a step is finished when the world says so, which is what lets a player
 * who did things out of order see the right panel and never a stale one.
 */
export interface TutorialStepDef {
  id: string;
  title: string;
  /** The panel's text. Engineer register: what it is, what it does, what it costs. */
  desc: string;
  /** Where the step is done, for the panel's pointer. */
  spot?: string;
  /** Renders the choice widget for this step (weapon rack, stance list, spell pick). */
  choice?: TutorialChoice;
  /** True once the world shows the step was done. Pure; reads counters and position. */
  done: (state: GameState) => boolean;
}

// ---------- Towers, bands & floors ----------

/**
 * Which way a stack runs from its hub. Purely how it reads — a dungeon is a
 * tower with the index counted the other way, and nothing downstream branches
 * on this. It exists so the UI can say "descend" and mean it.
 */
export type StackDirection = 'up' | 'down';

/**
 * A vertical stack of floors hanging off one hub spot. Several stacks may
 * share a hub, and that independence is the point: bands are per-stack, so a
 * player walled on one ladder always has another open. It is the second
 * disjunction — the first being the band itself — and it is what keeps an
 * accumulation-gated tower from ever being the only thing to do.
 */
export interface TowerDef {
  id: string;
  name: string;
  icon: string;
  /**
   * The one spot every entrance converges on. Districts each get their own
   * road in, but they all arrive here, so the stack has exactly one mouth and
   * the 'every spot can get home' lint is satisfied by construction.
   */
  hubSpot: string;
  direction: StackDirection;
  /**
   * Floors ahead are visible before they open — you can see the ladder and
   * plan toward its gates. False reads as a descent into the unknown: bands
   * surface only as they unlock. **This is the real difference between a
   * tower and a dungeon**; `direction` is only the word for it.
   */
  foreknown?: boolean;
  desc: string;
}

/**
 * A run of floors that opens as a unit. **The band is the disjunction.**
 * `conditionsMet` is a pure AND with no `any`, so rather than growing the
 * predicate language, alternatives live in the topology: several floors per
 * band, each with its own flat gate, and clearing `clearsToAdvance` of them
 * opens the next band.
 *
 * That is also what lets a floor name a specific discipline safely — it
 * becomes a shortcut for the specialist rather than a wall for everyone else,
 * PROVIDED a sibling in the same band names none. Linted, both layers.
 */
export interface BandDef {
  id: string;
  name: string;
  towerId: string;
  /** Position along the stack, 1-based, counting away from the hub. */
  index: number;
  /**
   * How many of this band's floors must be cleared before the next opens.
   *
   * ⚠️ Currently UNREAD. The ascent went strictly sequential (2026-09-06,
   * plans/alpha-band-one.md): every rung below must be cleared, so a partial
   * band can never open the next one and this number does no work. Kept while
   * the field's fate is decided — the disjunction it encoded now has to live
   * in each floor's `clear` being reachable by the floor build instead.
   */
  clearsToAdvance: number;
  desc?: string;
}

/**
 * One floor. A floor **is** an area — `areaId` names the AreaDef whose spots
 * make it up — so the Region/Area/Spot graph, the forge's map editor, travel,
 * breadcrumbs and every existing world lint apply to floors for free. Nothing
 * about a floor's interior is new; what is new is the ladder it sits on.
 */
export interface FloorDef {
  id: string;
  name: string;
  towerId: string;
  /**
   * The band this floor belongs to, or absent for a floor that is **off the
   * ladder** — the player's own base, hidden side floors, anything reached
   * laterally. A bandless floor advances nothing and gates nothing, which is
   * exactly what makes it optional content by construction rather than by an
   * author remembering to say so.
   */
  bandId?: string;
  /** Position within the stack, counting away from the hub. 0 is hub level. */
  index: number;
  /** The area whose spots ARE this floor. */
  areaId: string;
  /**
   * What it costs to open, AND-ed like every other `UnlockCondition[]`.
   * Gates on accumulation and time — gold, quest counts, discovery counts,
   * skill totals — never on a power check (COMPLETABILITY.md §6). A gate
   * naming one discipline is legal only beside a band sibling that names none.
   */
  gate?: UnlockCondition[];
  /**
   * The spot the ladder delivers you to — the floor's own front step. Floors
   * have no authored stairs: movement between rungs is `climbTo`
   * (systems/towers.ts), and this is where it lands. Required on every banded
   * floor (both validation layers enforce it); optional off the ladder, where
   * an authored edge does the job (the hold's door).
   */
  landing?: string;
  /**
   * What FINISHES the floor, AND-ed like every other `UnlockCondition[]`.
   * The ascent is sequential — the floor above refuses entry until every rung
   * below is cleared — so this is the tower's whole pacing. Clearing is
   * derived state: the conditions read counters that already persist
   * (`slain:<spot>:<monster>` for a named `once` foe, `fights:<spot>` for a
   * den's fightLimit, quest turn-ins for bespoke work), so it costs no save
   * field and survives every migration by construction. A banded floor MUST
   * declare one — a floor with no clear seals everything above it, and both
   * validation layers reject the shape.
   */
  clear?: UnlockCondition[];
  /**
   * Character-level XP paid the first time `clear` holds in a run
   * (systems/levels.ts). The run's record is the `level:floor:<id>` counter.
   */
  clearXp?: number;
  /**
   * Only the owner may enter. Flavour today, since the game is single-player,
   * but it is the field content should read rather than hardcoding the base's
   * id in half a dozen places.
   */
  personal?: boolean;
  /**
   * Survives prestige/transcendence — a part of the tower a reset does not
   * take. Kept separate from `personal` on purpose: they coincide on a
   * player-owned floor and needn't anywhere else. (The hold was the first
   * such floor; since 2026-09-12 it is a region of its own behind the door
   * at the Foot, gated on `prestige:count` — the same system these two
   * fields wait for.)
   *
   * ⚠️ **Declaration only.** Prestige is unbuilt and nothing reads this yet.
   * When it lands this is the field it must honour, and COMPLETABILITY.md §7
   * is the constraint it answers to — a reset may never leave the player
   * below the floor build.
   */
  persists?: boolean;
  desc: string;
}

// ---------- Prestige (systems/prestige.ts, docs/PRESTIGE.md) ----------

/**
 * One axis the harvest measures. `per` units of the measure pay one point;
 * the preview and the harvest read the SAME function, so a preview can never
 * disagree with what it previews (house rule, docs/PRESTIGE.md §2).
 */
export interface PrestigeSourceDef {
  id: string;
  name: string;
  icon: string;
  /**
   * What is counted: a `state.stats` counter (`key`), cleared ladder floors
   * across every tower, the sum of all skill levels, or achievement tiers
   * claimed.
   */
  measure: 'stat' | 'floors' | 'skillLevels' | 'achievements';
  key?: string;
  /**
   * Units per point (linear), or with `growth` the FIRST threshold: point n
   * costs `per × growth^(n−1)` units in total, so each successive point is
   * `growth` times further than the last. Whole points only; the remainder
   * is the forecast.
   */
  per: number;
  /** Geometric thresholds: the factor between successive points. Omitted = linear. */
  growth?: number;
  /** Singular unit noun for the readout: "3 quests", "1 floor". */
  unit: string;
}

/** What a boon does. Every kind is a one-shot grant or a read at the use site — never a modifier, so the derived-stats cache is not involved. */
export type PrestigeBoonEffect =
  /** Gold on the first tick of every run (and at purchase, for the run in progress). */
  | { kind: 'startGold'; amount: number }
  /** A capped skill's ceiling, read by `skillCap`. Manifested or not. */
  | { kind: 'skillCap'; skill: string; by: number }
  /** Prepared-spell pages, read by `preparedCap`. */
  | { kind: 'preparedPages'; pages: number }
  /**
   * Talent: every skill's effects scale by
   * `1 + rate × rank × peakLevel(skill) × prestige.count`, where the peak is
   * the skill's highest level recorded at any prestige (`peakLevels`).
   * Constant within a run; read by `collectBaseMods` (attributes.ts).
   */
  | { kind: 'talent'; rate: number }
  /**
   * Endowment: talent's twin for attributes. Every effective attribute
   * scales by `1 + rate × rank × peakAttr(attr) × prestige.count`, the peak
   * being the trained level recorded at any prestige (`peakAttrs`). Applied
   * as the last pass of `effectiveAttrsFrom` (attributes.ts).
   */
  | { kind: 'endowment'; rate: number }
  /**
   * Foresight: locked skills and upcoming milestones are shown regardless of
   * progress. Without it a locked skill is hinted only once every threshold
   * in its `unlock` list is at 90% (`REVEAL_FRACTION`, skills.ts), and the
   * next milestone only once the level is at 90% of it. Read by
   * `skillTreeByCategory` and the Skills panel.
   */
  | { kind: 'foresight' }
  /**
   * Wayfinding: "go" links outside the map. Active quests link to where
   * their giver and `talk`/`reach` objectives stand; skills link to the
   * spots whose activities train them. Each link is the map's go-and-do
   * (systems/locations.ts `goAndDo` / `travelPlanTo`). Read by the Quests
   * and Skills panels.
   */
  | { kind: 'wayfinding' }
  /**
   * Head Start: a run starts at character level 1 + levels × rank, with the
   * level's attribute bonus. Applied at run start and at purchase; never
   * lowers a level already reached (systems/levels.ts applyStartingLevel).
   */
  | { kind: 'startLevel'; levels: number }
  /**
   * Cook's Notes: the Cook's Book (systems/cookbook.ts) resets with the run, and
   * this carries part of it over. Rank 1 keeps which dishes had their cook time
   * shown (`COOK_TIME_COOKS` cooks); rank 2 also keeps Signatures
   * (`SIGNATURE_COOKS`). What a prestige carries is stored in
   * `PrestigeState.cookbook` whatever the rank then; the rank gates the READ.
   */
  | { kind: 'cookbook' };

/** Something prestige points buy. Rank r (1-based) costs `cost[r-1]`; `cost.length` is the max rank. */
export interface PrestigeBoonDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cost: number[];
  effect: PrestigeBoonEffect;
  /** Rank 1 is granted on the first prestige, unasked. Its `cost[0]` must be 0. */
  auto?: boolean;
}

export interface HarvestLine {
  id: string;
  name: string;
  icon: string;
  points: number;
  /** The measure at harvest, e.g. "7 quests (2 per point)". */
  detail: string;
}

export interface HarvestReport {
  /** Which prestige this was (1 = the first). */
  ordinal: number;
  total: number;
  lines: HarvestLine[];
}

/** The legacy block: the one part of a save a prestige carries into the next run. */
export interface PrestigeState {
  /** Prestiges completed. Mirrored to `stats['prestige:count']`, which content gates read. */
  count: number;
  /** Unspent points. */
  points: number;
  /** Boon id → rank bought (absent = 0). */
  purchases: Record<string, number>;
  /**
   * Skill id → the highest level that skill reached in any run that ended in
   * a prestige. Written by `prestigeNow`, never lowered; the talent boon's
   * lever. A skill the current run has but no past run carried is absent.
   */
  peakLevels: Record<string, number>;
  /** Attribute id → the highest TRAINED level reached in any run that ended in a prestige. Endowment's lever. */
  peakAttrs: Partial<Record<AttributeId, number>>;
  /**
   * Dish ids whose Cook's Book entry reached a threshold in any run that ended
   * in a prestige: `timed` at `COOK_TIME_COOKS` cooks (cook time shown), `signed`
   * at `SIGNATURE_COOKS` (Signature earned). Written by `prestigeNow`, never
   * shortened. The Cook's Notes boon decides how much of it the Book reads.
   */
  cookbook: { timed: string[]; signed: string[] };
  /** The most recent harvest, shown on the post-prestige overlay. */
  lastHarvest: HarvestReport | null;
  /** The post-prestige overlay is owed: it survives a reload and closes only through `leaveReview`. */
  review: boolean;
  /** Points spent since the overlay opened — one is enough to leave without confirming. */
  spentThisReview: number;
}

// ---------- NPCs & quests ----------

export interface NpcDef {
  id: string;
  name: string;
  icon: string;
  /** Where this NPC stands. */
  spotId: string;
  desc: string;
  dialogue: string[];
  /** Quest ids this NPC gives, in intended order. */
  quests: string[];
  /**
   * What this person sells, if anything. A vendor is just an NPC with wares:
   * the smith stocks scrap beside the forge she already stands at, and the
   * general vendors (outfitter, apothecary, provisioner) are NPCs whose only
   * job is the counter. Stock is unlimited and lives in data — nothing about a
   * shop is saved. See systems/shops.ts.
   */
  shop?: ShopDef;
  /**
   * Techniques this person teaches (MARTIAL.md §10, the teacher half). A
   * lesson grants the CANONICAL form, or upgrades a rough one, through
   * `teachTechnique` in systems/martial.ts. Teaching ignores the `martial`
   * shutter on purpose: while it is shut, teachers are the only way in.
   */
  teaches?: TechniqueLesson[];
}

/** One lesson on a teacher's list. */
export interface TechniqueLesson {
  /** A TECHNIQUES id. */
  technique: string;
  /** Held back until these hold — a curriculum, not a price list. */
  requires?: UnlockCondition[];
}

/**
 * A counter. Prices derive from the ware's own `value` (the same number
 * selling reads) times a markup, so authoring a line is naming the ware; a
 * `price` override exists for the deliberate bargain or gouge.
 */
export interface ShopDef {
  /** The counter's name as the panel shows it — 'Wares', 'The Scrap Bin'. */
  name: string;
  lines: ShopLine[];
}

export type ShopLine =
  | {
      kind: 'material';
      id: string;
      /**
       * Graded wares are sold at ONE grade, this one (default 'c'). A vendor
       * sells what a vendor sells; the better dish is the one you cook.
       */
      quality?: QualityTier;
      /** Flat asking price per unit; replaces the derived one (the no-arbitrage floor still applies). */
      price?: number;
      /** Off the shelf until met — a line a boss's fall or a quest puts out. */
      requires?: UnlockCondition[];
    }
  | { kind: 'item'; id: string; price?: number; requires?: UnlockCondition[] };

export type QuestObjective = QuestObjectiveKind & {
  /**
   * Where the objective is usually done, for the Quests tab's Go link. Only
   * for kinds that name no place themselves ('talk' uses the NPC's spot,
   * 'reach' its spotId). A hint: progress never checks it.
   */
  at?: string;
};

type QuestObjectiveKind =
  | { type: 'kill'; monsterId?: string; count: number; desc: string }
  /**
   * Crafts of any kind. `recipeId` names one recipe; `discipline` instead
   * matches bench work by discipline id (cooking, alchemy…) — bench crafts
   * emit the same 'craft' event with their discipline on it. Neither field
   * set counts every craft.
   */
  | { type: 'craft'; recipeId?: string; discipline?: string; count: number; desc: string }
  /**
   * Meet someone. Read LIVE from the `met:<npcId>` counter (stamped by the
   * first greeting, `talkTo`), so a stranger greeted before the quest was
   * accepted still counts — meeting people is not un-meetable.
   */
  | { type: 'talk'; npcId: string; desc: string }
  /**
   * Any persistent counter reaching a bar — the quest twin of the `stat`
   * UnlockCondition, read LIVE. This is how a quest asks for things no other
   * verb can see: bestiary entries, spells inscribed, miracles received.
   */
  | { type: 'stat'; key: string; value: number; desc: string }
  /** Possession-based: progress reads live materials; consumed on turn-in. */
  | { type: 'collect'; materialId: string; qty: number; desc: string }
  | { type: 'reach'; spotId: string; desc: string };

export interface QuestRewards {
  gold?: number;
  materials?: { id: string; qty: number }[];
  items?: string[];
  skillXp?: { id: string; xp: number }[];
  /**
   * Character-level XP (systems/levels.ts). Absent: DEFAULT_QUEST_LEVEL_XP
   * (data/levels.data.ts). Every turn-in pays one or the other.
   */
  levelXp?: number;
  /**
   * Favor with every KNOWN deity, on top of the 1 every turn-in already pays.
   * The lever that makes a first miracle reachable without grinding five
   * errands — an introduction to the gods is worth more than a delivery.
   */
  favor?: number;
}

export interface QuestDef {
  id: string;
  name: string;
  desc: string;
  giver: string;
  objectives: QuestObjective[];
  rewards: QuestRewards;
  /** Conditions to be offered (quest chains use { type: 'quest' } here). */
  requirements?: UnlockCondition[];
}

export interface QuestState {
  status: 'active' | 'done';
  /** Progress per objective index (collect objectives are computed live instead). */
  progress: number[];
}

// ---------- Achievements ----------

export interface AchievementTier {
  threshold: number;
  bonus: Modifier[];
}

export interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  /** Counter key in GameState.stats this achievement tracks. */
  statKey: string;
  descTemplate: string;
  tiers: AchievementTier[];
}

// ---------- Titles ----------

/**
 * Titles are earned once (permanent, latched the moment all unlock conditions
 * hold) and one may be WORN at a time. `passive` mods apply from the moment
 * the title is earned, forever; `equipped` mods apply only while worn. Both
 * ride the shared Modifier pipeline.
 */
export interface TitleDef {
  id: string;
  name: string;
  icon: string;
  /** Flavor + how-to-earn hint, shown before unlocking (unless secret). */
  desc: string;
  unlock: UnlockCondition[];
  passive?: Modifier[];
  equipped?: Modifier[];
  /** Hidden from the UI until earned. */
  secret?: boolean;
  /**
   * Worn, this title waives the divine grimoire's conflict rules — hostile
   * deities' miracles may be prepared together. The iconoclast's privilege.
   */
  defiesDogma?: boolean;
}

// ---------- Game state ----------

export interface AttrState {
  level: number;
  xp: Big;
}

export interface SkillState {
  level: number;
  xp: Big;
  /**
   * Levels of cap granted past the skill's base `maxLevel` — by quests,
   * events, prestige. Meaningless on an uncapped skill. See `skillCap`.
   */
  capRaised?: number;
}

export interface BuffState {
  name: string;
  mods: Modifier[];
  ticksLeft: number;
}

/** Formation slots: index 0 is the centre/front, 1–4 the flanks. Nulls are empty. */
export const ENCOUNTER_SLOTS = 5;

export interface CombatState {
  /** Brief encounter introduction; neither side acts until it finishes. */
  introTicks?: number;
  /**
   * Fixed-length formation. Only `enemies[0]` (the centre) can be attacked;
   * when it dies a random survivor swaps into slot 0 and its own slot empties.
   */
  enemies: (MonsterInstance | null)[];
  /**
   * A fight there is no walking away from (forced arrival). While set, travel
   * and activity switches are refused, and the fight ticks whatever activity
   * is selected — it started on arrival, not from one. Losing it retreats to
   * a haven instead of recovering in place. Transient, like the encounter.
   */
  forced?: boolean;
  /** Player action-bar progress in units; attacks at stats.actionBar. */
  playerBar: number;
  /** Ramping stance bonus built up this fight (see ExertionSpec.ramp). */
  momentum: number;
  /**
   * The micro-position the last exchange left the fighter in (see
   * systems/martial.ts). Techniques move it; a basic swing resets to neutral.
   */
  position: string;
  /**
   * A weapon deliberately dropped mid-fight (Weapon Drop) — on the ground,
   * part of the encounter, recovered by technique or when the fight ends.
   */
  grounded?: ItemInstance | null;
  /**
   * A weapon left buried in something that is still moving. Distinct from
   * `grounded` on purpose — the fiction and the payoff differ (a blade already
   * inside them is what makes tearing it out a guaranteed opening), and one
   * shared slot would make the two recovery techniques interchangeable.
   * Returned when the fight ends, like the grounded one.
   */
  impaled?: ItemInstance | null;
  /**
   * The grimoire uid held ready to deliver through a martial opening — the
   * spell half of the magiknight seam (martial supplies the structure, magic
   * supplies the payload). Its mana was paid when it was readied, so letting
   * it lapse is a real loss. Companion to the `spell_ready` position the same
   * way `grounded` is to a dropped blade: the position says you are holding
   * something, this says WHAT. Transient with the encounter.
   */
  readiedSpell?: number | null;
  cooldowns: Record<string, number>;
  buffs: BuffState[];
  /** totalTicks at which each trigger event last fired (transient). */
  events: Record<string, number>;
  /**
   * The last miracle cast this fight, for succession synergy: casting a
   * friendly deity's miracle soon after another's empowers it. Transient,
   * like the encounter.
   */
  lastMiracle?: { deity: string; tick: number };
  /**
   * The working an enemy last began to cast — what `onEnemyCast` was stamped
   * for, kept so a trigger can ask WHAT is being cast (its school, its
   * leading element) and not merely that something is. Read fresh within the
   * event window; stale after it. Transient.
   */
  casting?: {
    /** Formation slot of the caster when it began. */
    index: number;
    name: string;
    school: SpellSchool;
    /** The element the working is most made of; absent when it names none. */
    element?: DamageType;
    tick: number;
  };
  /**
   * How much damage each kind of defence last stopped — what a deflection
   * technique answers with (see TechniqueMove.preventedMult). Two ways to
   * stamp it, one meaning ("what did not reach you"):
   *  - `onParry` stopped the whole blow, so it records the swing's full force;
   *  - `onHit` landed but was BLOCKED, so it records what armor and resistance
   *    took off it — a heavier guard answers harder.
   * A dodge stamps nothing: you were not there, so you stopped nothing.
   *
   * Keyed by the trigger event that produced it, so in a five-enemy formation
   * a bystander's blocked hit can never overwrite the parry a counter was
   * about to answer with. Spent by the technique that consumes it. Transient.
   */
  prevented?: { onParry?: number; onHit?: number };  /*
   * A `tongues` body's own clock and what it has already said this fight.
   * Both live on the ENCOUNTER: the rung climbs within a fight and starts the
   * next one quiet, which makes the escalation the shape of a fight rather
   * than a permanent upgrade.
   */
  /** Absolute tick the next word comes due. Undefined = not armed yet. */
  tongueAt?: number;
  /** Times each word has been spoken this fight, keyed by base word id. */
  spoken?: Record<string, number>;
  /*
   * What a refuting body has already argued with THIS FIGHT. Both die with the
   * encounter on purpose: a sealed working comes back next fight, because
   * losing one forever is loss of property rather than a difficulty.
   */
  /** Times each working has been cast this fight, keyed by caster+working. */
  refuted?: Record<string, number>;
  /** Workings sealed for the rest of this fight. */
  sealed?: string[];
  /**
   * Absolute tick a running incantation lands on, if one is running. The whole
   * of the state it needs: what it will do is read off the gene, so a swapped
   * centromere mid-incantation simply stops it.
   */
  incantAt?: number;
  /**
   * The floating grips' shared clock: one bar, and which blade goes next.
   *
   * ONE clock rather than one per weapon, deliberately. Six blades on six
   * clocks would roll six crits, six grazes and six oil charges in the time
   * the hands roll one, and no amount of dividing the damage fixes that — so
   * telekinesis moves your swing OFF the bar rather than multiplying it, and
   * the blades take turns. Which is also what makes a volley (`spec.volley`)
   * read as a burst instead of as a slightly faster tick.
   */
  floating?: {
    bar: number;
    /** Which blade goes next, as an index into the occupied floating grips. */
    nth: number;
    /**
     * Which ROTATION is being folded into the feed. It ticks over each time
     * `nth` wraps, which closes the folded line and opens a fresh one — so a
     * line always covers "every blade struck once" rather than an arbitrary
     * stretch of a long fight.
     */
    run: number;
  };
  /**
   * A volley in flight: strikes left, the accumulator, the per-tick rate, and
   * the name of the ability that ordered it — carried rather than looked up, so
   * a centromere swapped mid-burst cannot rename a volley already in the air.
   */
  volley?: { left: number; acc: number; rate: number; name: string };
}

// ---------- Skill triggers ----------

export type TriggerOp = '>=' | '<=' | '>' | '<' | '==' | 'is' | 'isNot';

/** One test against a registered trigger subject (see systems/triggers.ts). */
export interface TriggerCondition {
  subject: string;
  op: TriggerOp;
  value: number | string;
}

/**
 * When an active skill is allowed to fire. All conditions must hold (AND); an
 * `event` additionally gates it to the short window after that event occurred.
 * A skill with no trigger configured is always eligible (today's behaviour).
 */
export interface SkillTrigger {
  /** Defaults to true when absent. */
  enabled?: boolean;
  conditions: TriggerCondition[];
  event?: string;
  /**
   * Ticks the event stays fresh for, overriding the default EVENT_WINDOW.
   * Reactive techniques answer on their next swing, not within the moment —
   * their baked triggers carry a window wide enough to reach it.
   */
  window?: number;
}

/**
 * A saved combat plan — a whole fighting identity under one name: rotation
 * order, bench switches, drills, firing conditions, prepared spells and worn
 * gear. Applying one never grants anything: unknown ids are inert (rotation
 * already ignores them) and drilling filters to known techniques.
 *
 * `triggers`/`spells`/`equipment` are optional so a loadout saved before they
 * existed (or one built by hand, as in a test) still satisfies the type —
 * applying one just skips whichever half it lacks.
 */
export interface Loadout {
  name: string;
  order: string[];
  /**
   * Ids whose trigger switch is off in this plan. Superseded by `triggers`,
   * which carries `enabled` along with everything else, but still written and
   * still honoured on its own for plans saved before triggers were captured.
   */
  benched: string[];
  drilling: string[];
  /**
   * The player's firing conditions per entry, snapshotted whole (`enabled`,
   * `event`, `conditions`). When present it is AUTHORITATIVE: applying the
   * plan restores exactly this and clears overlays on ordered entries the
   * plan doesn't mention, because a plan you saved is the plan you get back.
   * Absent means a pre-`triggers` plan, which only ever knew on/off.
   */
  triggers?: Record<string, SkillTrigger>;
  /** Grimoire uids prepared under this plan. Missing/stale uids stay inert. */
  spells?: number[];
  /**
   * Worn item uid per slot, snapshotted when the plan was saved. Applying
   * re-equips a slot only if its uid is still owned and still equippable —
   * a sold or now-unmeetable piece just leaves that slot as it is.
   */
  equipment?: Partial<Record<SlotId, number>>;
}

export interface TravelState {
  from: string;
  to: string;
  ticksLeft: number;
  total: number;
}

/** One counted thing inside a grouped log line. */
export interface LogTally {
  /** Icon + name, e.g. "🪨 Iron Ore". */
  label: string;
  qty: number;
  /** 'count' reads "Iron Ore ×3"; 'amount' reads "3 gold". Default 'count'. */
  style?: 'count' | 'amount';
}

export interface LogEntry {
  msg: string;
  kind: string;
  t: number;
  /**
   * Repeat key. A new entry with the same group as the newest one folds into
   * it instead of adding a line; `prefix` and `tally` are what get re-rendered.
   */
  group?: string;
  prefix?: string;
  tally?: LogTally[];
}

// ---------- The fight ledger ----------

/**
 * How an encounter ended for the player.
 *
 * `dead` is the spirit-walk failure state and NOTHING produces it yet. The hook
 * is here so that when it lands it is one more outcome on a shape that already
 * exists, rather than a save migration and a second window that says the same
 * things in a different order.
 */
export type FightOutcome = 'won' | 'knocked_out' | 'dead';

/** One attributed source of damage, summed rather than kept per event. */
export interface LedgerSource {
  /** Stable key — `monster:<defId>`, `cond:<statusId>`, `working:<id>`. */
  key: string;
  label: string;
  icon: string;
  amount: number;
  /** How many times it landed. */
  hits: number;
}

/** The ways a blow came to less than it meant to, from the defender's side. */
export interface LedgerStopped {
  /** Armour, bracing, resistance and interception, off blows that still landed. */
  absorbed: number;
  /** Turned aside whole. */
  parried: number;
  /** What the free counters hit back for. */
  riposted: number;
  /** Never arrived at all. */
  dodged: number;
  parries: number;
  dodges: number;
}

/**
 * What one encounter came to.
 *
 * A ROLLUP, not a recording. Its size is O(distinct sources) and never O(ticks),
 * so a ten-minute fight and a ten-second one against the same cast cost the same
 * to keep — which is the only reason it is cheap enough to put in the save.
 * Anything added here must SUM. The moment a per-event field lands, fight length
 * starts driving save size and the invariant is gone.
 */
export interface FightLedger {
  outcome: FightOutcome;
  /** Ticks the encounter lasted. */
  ticks: number;
  /** Absolute tick it ended on, against `totalTicks`. */
  endedAt: number;
  /** Where it happened. */
  spot: string;
  /** The cast, as met — deduplicated by def, counted. */
  foes: { defId: string; name: string; icon: string; level: number; count: number }[];
  /** What hit you, worst first. */
  incoming: LedgerSource[];
  /** What you stopped, and how. */
  stopped: LedgerStopped;
  /** What you got back, keyed by HealKind. */
  healed: Record<string, number>;
  /** Healing a condition refused to let land (a blaze capping its own undoing). */
  healRefused: number;
  /** What you dealt. */
  outgoing: { damage: number; hits: number; kills: number };
  /**
   * Conditions on you when it ended — the ones that are still your problem
   * afterwards, which is most of why a knockout stings.
   */
  afflictions: { id: string; name: string; icon: string; intensity: number }[];
  /**
   * The fight's own folded feed, capped at TRANSCRIPT_MAX lines.
   *
   * The one bounded list on the ledger, and the exception that proves the size
   * rule: it is capped rather than summed, so it costs a fixed ceiling instead
   * of growing with the fight. Folding is what makes that ceiling usable.
   */
  transcript: FeedEntry[];
}

/** One fight the player chose to keep. */
export interface NotebookEntry {
  /** The tick the fight ended on — unique per fight, and its stable id. */
  id: number;
  /** Wall-clock stamp of when it was kept, for ordering and display. */
  keptAt: number;
  /** The player's own label for it, if they gave one. */
  note?: string;
  ledger: FightLedger;
}

export interface GameState {
  version: number;
  createdAt: number;
  lastSaved: number;
  totalTicks: number;
  rngState: number;
  uidCounter: number;
  /**
   * Global freeze — the whole world, not just the fight. While set, `tick()`
   * is a no-op for EVERY caller (the real-time driver, offline catch-up,
   * anything added later); `Game.step()` is the one deliberate way past it, so
   * studying a fight tick by tick can never bank free progress elsewhere.
   * Transient: never saved (see save/save.ts), so a loaded game always runs.
   */
  paused: boolean;

  attrs: Record<AttributeId, AttrState>;
  /** Unlocked super-attributes. */
  fused: SuperAttributeId[];
  /**
   * Character level and the XP banked toward the next one (systems/levels.ts).
   * +1 to every attribute per level above 1. Resets with the run.
   */
  level: number;
  levelXp: number;
  /**
   * Current value of every pool (see RESOURCES). Maxes, regen rates and
   * consumption multipliers are all derived stats — nothing here is a capacity.
   * Typed as `Big` for HP's sake; see the note on the alias above.
   */
  resources: Record<ResourceId, Big>;
  /** Spending lockout per pool; absent entries read as 'none'. */
  resourceLocks: Partial<Record<ResourceId, ResourceLock>>;
  /** Conditions currently afflicting the player (see systems/statuses.ts). */
  statuses: StatusInstance[];
  /** totalTicks at which each consumable may next be used. */
  useCooldowns: Record<string, number>;
  /** Opted in to paying your style's exertion cost for its bonuses. */
  exerting: boolean;
  skills: Record<string, SkillState>;
  style: string;
  /** Player-defined active-skill rotation; style priority fills in the rest. */
  skillOrder: string[];
  /** Per-skill firing conditions, keyed by skill id (global across styles). */
  skillTriggers: Record<string, SkillTrigger>;
  /** Per-technique practice counters, keyed by technique id. */
  techniques: Record<string, TechniqueState>;
  /** Techniques currently being drilled — only these advance their counters. */
  drilling: string[];
  /**
   * Where each unknown technique's self-learning count starts: the value its
   * `learn.self` counter had when the technique last became reachable
   * (systems/martial.ts, Reach). Follows the counter while the technique is
   * unreachable; absent means reachable all along. Not a counter, so not in
   * `stats`: it moves on every swing and must not run achievement checks.
   */
  learnFrom: Record<string, number>;
  /**
   * A weapon worn concealed instead of wielded (daggers). While sheathed you
   * are genuinely unarmed — tags, stats, schools all read bare hands — until
   * a hidden draw brings it out (see systems/martial.ts weapon states).
   */
  sheathed: ItemInstance | null;
  /** Saved combat plans (rotation + bench + drills). */
  loadouts: Loadout[];

  /** Selected activity id at the current spot (null = idle). */
  activity: string | null;
  /** Action-bar units accumulated toward the current train/gather/job/craft completion. */
  activityProgress: number;
  /**
   * An ongoing run at a crafting bench — batch prepping, mostly. Exclusive
   * with `activity` (starting either clears the other) and bound to the spot
   * it was started at; walking away abandons it. See systems/benchwork.ts.
   */
  benchWork: BenchWork | null;
  /** Knocked out — auto-resting until recovered. */
  recovering: boolean;
  combat: CombatState | null;
  /** Rolling fight log that outlives individual encounters (transient, not saved). */
  combatFeed: FeedEntry[];
  /**
   * Affliction runs in progress, drawn against the newest feed line rather than
   * pushed as lines of their own. Transient with the feed they belong to.
   */
  floatingFeed: FloatingAffliction[];
  /**
   * The encounter being tallied right now. Transient like `combat`, and created
   * lazily rather than only at an encounter's start — bleeding out while
   * chopping wood is a real outcome, and it deserves the same accounting as a
   * fight does.
   */
  fight: FightLedger | null;
  /**
   * The last encounter that finished, kept so closing the tab after a knockout
   * does not lose the explanation for it. One ledger, ~1 KB; see FightLedger on
   * why that stays true however long a fight runs.
   */
  lastFight: FightLedger | null;
  /**
   * Fights the player kept, newest first. The ONLY part of the ledger system
   * that grows, and it grows because someone chose it — capped, with the
   * eviction announced rather than silent.
   */
  notebook: NotebookEntry[];
  /** Ticks until the next encounter spawns while hunting. */
  respawnTimer: number;

  spot: string;
  travel: TravelState | null;
  /** Remaining hops of a multi-leg journey (after the current travel leg). */
  travelPlan: string[];
  /**
   * What the journey is for: on the final peaceful arrival at `spot`, start
   * `activity`. Set by "go and do" (the map's feature list, the destination
   * preview); cleared by anything that changes the plan. Wins over
   * `resumeActivity`. See systems/actions.ts `settleArrival`.
   */
  travelIntent: { spot: string; activity: string } | null;
  /**
   * The last activity chosen at each spot, keyed by spot id. A peaceful
   * arrival with no intent restarts it; deselecting an activity by hand
   * forgets the entry, so a spot left idle on purpose stays idle.
   */
  resumeActivity: Record<string, string>;
  /**
   * Banked idle time, in ticks. Doing nothing (see `isIdle`,
   * systems/bonustime.ts) banks one tick per tick up to a cap; while
   * `spending` is on, every non-idle tick runs twice and costs one.
   */
  bonusTime: { banked: number; spending: boolean };
  /**
   * Rest before the next fight (systems/huntrest.ts): below `at` (a share of
   * max HP; 0 = off) a hunt rests in place before rolling its next encounter,
   * until full or back to `at`. `active` is the rest in progress.
   */
  huntRest: HuntRest;
  discovered: string[];
  /** Explore progress (ticks) per spot id. */
  explored: Record<string, number>;
  /** Ids of the `finds` already turned up, per spot id — each fires once. */
  finds: Record<string, string[]>;
  /**
   * Where a forced fight throws you when it goes badly.
   *
   * Two slots, because a haven you can only use with the right gear is no
   * haven at all on the day you lost it. `nearest` is the most recent rest
   * spot you could use when you passed it — possibly a conditional one;
   * `unconditional` is the most recent one that asks nothing of anybody. On
   * defeat the nearest is re-checked against your CURRENT gear and skills,
   * and the unconditional one catches you when that check fails.
   */
  safeSpots: { nearest: string | null; unconditional: string | null };

  /**
   * The opening the road just walked bought (or charged) — stamped on
   * arrival along a connection with an `approach`, consumed by the FIRST
   * encounter at that spot, and overwritten by the next arrival anywhere.
   * Survives a save deliberately: closing the tab at the nest's mouth does
   * not un-sneak the way you got there.
   */
  pendingApproach: { spot: string; enemies: StatusApplication[]; self: StatusApplication[] } | null;

  inventory: ItemInstance[];
  equipment: Partial<Record<SlotId, ItemInstance>>;
  /** Stackable materials by id. */
  materials: Record<string, number>;
  /** Owned (unsocketed) catalogue runes by id. */
  runes: Record<string, number>;
  /** Runes the player has carved and not yet socketed. */
  carved: CarvedRune[];
  /** Flasks off the alembic, each remembering the sequence that made it. */
  flasks: BrewedFlask[];
  /** The oil worked into the weapon, if any. Wears off in blows, not seconds. */
  coating: WeaponCoating | null;
  /** Every spell the player has crafted, whatever school made it. */
  grimoire: CraftedSpell[];
  /** Written music, kept forever. Performing one is systems/music.ts's business. */
  compositions: Composition[];
  /** The performance in progress, if any — exclusive with activity and benchWork. */
  performance: PerformanceState | null;
  /** Standing with each deity, by id — earned by deeds, spent on miracles. */
  favor: Record<string, number>;
  /** Psionic development: open axes and the teacher-unlocked threshold tier. */
  psi: PsiState;
  /**
   * The chromosome, what it holds, and what has been catalogued. Genes and
   * mutagens themselves are NOT here — they are graded ids in `stock` like any
   * other component, which is what lets drops, grading and the bench reuse the
   * machinery they already have.
   */
  mutagens: MutagenState;
  /**
   * Graded materials, stocked per quality (see MaterialDef.graded). Ungraded
   * materials stay in `materials` as a plain count.
   */
  stock: Record<string, Partial<Record<QualityTier, number>>>;
  gold: Big;

  /** Quest lifecycle per quest id (absent = never accepted). */
  quests: Record<string, QuestState>;
  /** Number of tiers claimed per achievement id. */
  achievements: Record<string, number>;
  /** Legacy-scoped: the only field a prestige carries forward (systems/prestige.ts). */
  prestige: PrestigeState;
  /** Earned title ids (permanent). */
  titles: string[];
  /** Worn title id (at most one at a time). */
  title: string | null;
  /** Generic counters: kills, 'kills:wolf', 'gold:earned', 'travel:trips', 'skill:levels', ... */
  stats: Record<string, number>;
  /**
   * Consecutive misses per drought-protected roll, keyed by what is being
   * waited for (see engine/mercy.ts). Written only by that module: a key
   * appears on the first miss and is deleted the moment the thing drops, so
   * this holds the player's current run of bad luck and nothing else.
   */
  mercy: Record<string, number>;

  /** Monster knowledge per monster id (absent = never even encountered). */
  bestiary: Record<string, BestiaryEntry>;
  /**
   * How often each novelty skill has been offered each input, as skill id →
   * input key → count. This is the `n` in a skill's novelty curve; it is kept
   * per skill so that hunting the same wolf for a year never dulls what
   * reading a book teaches.
   */
  novelty: Record<string, Record<string, number>>;

  log: LogEntry[];
}

// ---------- Mutagens ----------

/**
 * The four domains of the character sheet a chromosome arm can write to.
 *
 * These are NOT faces of a particular gene — every character has all four
 * populated regardless of what is slotted, and a gene merely drops a headline
 * effect into one. That is what lets a modifier be authored once and keep its
 * meaning under any main gene. See docs/MUTAGENS.md §4.
 */
export type MutagenArm = 'attacks' | 'defenses' | 'active' | 'special';

/** The centromere's node id. Not a socket — nothing is ever placed "in" it. */
export const CENTROMERE = '@';

/**
 * One connection. `length` is the geometric measure (micrometres, baseline 3)
 * and is used ONLY for intensity; routing counts edges and never reads it.
 * `arm` is set exactly on the edges that touch the centromere, which is how the
 * arm→domain mapping travels with the layout rather than being global.
 */
export interface ChromosomeEdge {
  a: string;
  b: string;
  length: number;
  arm?: MutagenArm;
}

/**
 * A socket and where it sits. Coordinates are in a 0–100 space, the same
 * convention spot maps use, so a layout is drawable without the panel knowing
 * anything about a particular chromosome's shape.
 *
 * Position is presentation, never mechanics: routing counts edges and intensity
 * reads `edge.length`, and neither ever looks at x/y. Two layouts could draw
 * the same graph completely differently and play identically.
 */
export interface ChromosomeSocket {
  id: string;
  x: number;
  y: number;
}

export interface ChromosomeLayout {
  id: string;
  name: string;
  sockets: ChromosomeSocket[];
  edges: ChromosomeEdge[];
  /** Where the centromere itself sits, in the same 0–100 space. */
  centre: { x: number; y: number };
}

/** A gene or mutation the player actually holds. Tier lives in the def. */
export interface GeneInstance {
  id: string;
  quality: QualityTier;
}

/**
 * The kinds of rekey a nuclease performs. Each names a different SHAPE of
 * target data on the expressed gene, which is why they are separate materials
 * rather than one with a parameter.
 *
 * Only `vulnerability` is built. The rest are named here so the vocabulary is
 * settled and a half-built one cannot be mistaken for a finished one.
 */
export type NucleaseKind =
  /** The damage types this body is WEAK to — negative resistances and dousing. */
  | 'vulnerability'
  | 'resistance'
  | 'attribute'
  | 'skill'
  | 'offensive'
  | 'elemental';

/** What a mutation contributes, split into the two things §7 treats differently. */
export interface MutagenEffect {
  /** Magnitudes — scaled by intensity and capped by the main gene's ceiling. */
  mods?: Modifier[];
  /** Capabilities — never scaled, never capped. A cheap gene reaches every trick. */
  grants?: string[];
  /** The damage type this effect carries, if any. Transformable en route. */
  type?: DamageType;
}

/** How a mutation alters an effect passing THROUGH it, rather than its own. */
export interface MutationTransform {
  retype?: DamageType;
  grants?: string[];
  mult?: number;
}

/**
 * A secondary mutagen — what rides in the sockets around the centromere.
 *
 * Named `MutagenDef` rather than `MutationDef` because that name is already
 * taken above by the reserved monster-mutation type, and same-file interfaces
 * MERGE in TypeScript rather than colliding: a second `MutationDef` here would
 * silently inherit its required `mods` instead of erroring at the declaration.
 */
export interface MutagenDef {
  id: string;
  name: string;
  icon: string;
  /** The arm this mutation's own effect belongs to, derived from what it touches. */
  native: MutagenArm;
  /** The monster TAG that drops it — never a species. §9 */
  from?: string;
  effect?: MutagenEffect;
  transform?: MutationTransform;
  /**
   * WHAT THIS REWRITES, for a mutagen a nuclease has been fused into.
   *
   * The third thing a mutagen can be, and the one that finally gives the
   * non-Active arms a qualitative axis: an `effect` says how much, a
   * `transform` says what happens to what passes, and a rekey says **what
   * something IS** — changing the key without touching the magnitude.
   *
   * Never authored by hand. Fused mutagens are generated from
   * NUCLEASES × the mutations that carry an element (see `fusedMutagens`), so
   * the pairing rules live in one place and cannot drift per entry.
   */
  rekey?: { kind: NucleaseKind; to: DamageType };
  /**
   * AMPLIFICATION HANDED FORWARD: this socket multiplies the contribution of
   * whatever mutagen its own route flows INTO, and does nothing to what merely
   * passes through it.
   *
   * Deliberately neither `effect` nor `transform`, because it is neither. An
   * effect is what a socket sends; a transform is what passing through it does
   * to somebody else's effect. This is a third thing — what a socket does to
   * its NEIGHBOUR's output — and folding it into either would have made both
   * lie about their own meaning.
   *
   * Amplifiers compound through amplifiers: a chain is resolved outermost-first
   * (see `amplification`), so an amplifier feeding an amplifier raises what the
   * second one hands on. Ties divide the surplus, like everything else here.
   */
  amplify?: number;
}

export interface MainGeneDef {
  id: string;
  name: string;
  icon: string;
  genus: string;
  /**
   * What this body actually does, in words.
   *
   * Authoritative where the mechanics are not built yet — several gene effects
   * are abilities, triggers and entities rather than stat modifiers, and this
   * is where that intent lives until the systems to express it exist. A gene
   * with a `desc` and no matching `base` entry is a promise, not an oversight.
   */
  desc?: string;
  /**
   * Position in its genus, 0-based. Fixed at the drop and never raised.
   *
   * NOT unique: two species at the same tier are deliberate **sidegrades** —
   * equally powerful bodies you choose between on what they do rather than on
   * how much. A genus is a tree, not a ladder.
   */
  tier: number;
  /** The species that drops it. Absent for bare, which is manufactured. */
  from?: string;
  /** Flat term of the headline ability — decays into noise as gear improves. */
  flatBase: number;
  /** Weapon coefficient at S. Tier buys this ceiling; quality approaches it. */
  ceiling: number;
  /**
   * The active tool this body hands you.
   *
   * The other half of what a gene is for: a SPECIAL effect alters how you work,
   * an ABILITY gives you something new to do. It joins the ordinary rotation
   * under the id `gene`, so cooldowns, triggers and the rotation planner all
   * treat it as one more active rather than a special case.
   */
  ability?: { name: string; icon: string; spec: ActiveSpec };
  /**
   * Capabilities this body simply HAS — things it can do, as opposed to
   * numbers it changes. Never scaled and never capped (docs/MUTAGENS.md §7).
   *
   * `onehand:<family>` lets a two-handed weapon of that family leave the off
   * hand free; `onehand:*` covers every family. That one string covers both
   * halves of the design — a giant big enough to swing a greatsham one-handed
   * and an asura with an arm to spare are, mechanically, saying the same thing.
   */
  grants?: string[];
  /**
   * A WORD THE BODY SPEAKS BY ITSELF, on its own clock, beside the action bar.
   *
   * Not an `ability` — an ability joins the rotation and spends the bar you
   * would otherwise use for something else. This runs alongside, and asks for
   * nothing: the body is simply saying things.
   *
   * One word at a time, never a sentence. The grammar already treats a lone
   * word as a real cast (`barePower`/`bareType`/`bareInflicts`), so each of the
   * sixteen has its own damage type, its own strength and its own condition
   * without any of them being written twice.
   */
  /**
   * EVERY WORKING IN THE FIGHT IS ARGUED WITH — the player's own included.
   *
   * Not a resistance and not a counter-ability: a body that refuses creation
   * refuses it wherever it happens, which is what makes the gene a decision
   * rather than an upgrade. A caster wearing this has to want the argument.
   *
   * The lockout is per ENCOUNTER, never permanent. Destroying a prepared
   * working outright would be irreversible loss of player property, which this
   * game does not do to you (see the completability law) — and a fight you have
   * to finish with your hands is a story, where a bricked grimoire is a bug
   * report.
   */
  /**
   * Conditions a CRITICAL hit leaves behind, on top of whatever the blow was
   * already carrying. General rather than Niraksha-shaped: "crits do something
   * extra" is a thing several bodies will want, and putting it on the gene
   * keeps combat from learning any particular one's name.
   */
  onCrit?: StatusApplication[];
  refutes?: {
    /** Chance the cast simply does not happen: [worst grade, best]. */
    negate: [number, number];
    /** Chance the working is sealed for the rest of the fight: [worst, best]. */
    lockout: [number, number];
    /** Added to the lockout chance per previous cast of the SAME working. */
    perCast: number;
  };
  /**
   * A BODY THAT REFUSES, and takes a toll from everyone who does not.
   *
   * The third bespoke asurendra field, beside `tongues` and `refutes` — one per
   * rule-break that no general mechanism expresses. What the fast IS lives in
   * the `fasting` condition (see `confers` / `MonsterDef.wears`), because both
   * a gene and a monster have to be able to say it; this holds only the numbers
   * that shape it.
   *
   * Both arms resolve at ROLL TIME and never enter the flat stat block. The
   * defence arm reads the hunger on the field, which moves almost every tick —
   * fingerprinting that would thrash the derived-stats memo for no gain, so it
   * lives in the same lane as `requiresMonsterTag`.
   */
  fasts?: {
    /**
     * Which root of its own attack damage becomes regeneration:
     * [worst grade, best]. A LOWER root is stronger, so this pair descends —
     * 4 at F, 2.5 at S. Interpolated by quality through `atGrade`.
     */
    regenRoot: [number, number];
    /** Multiplier on what that root yields, before it joins the trickle. */
    regenMult: number;
    /** Armour per natural log of the hunger standing on the field. */
    armorPerLogHunger: number;
    /** Share of condition damage and penalties shed, at the same scale. */
    wardPerLogHunger: number;
    /** Cap on that share — nothing is ever wholly proof against conditions. */
    wardMax: number;
  };
  tongues?: {
    /** Arcane word ids it may speak. Each is cast ALONE. */
    words: string[];
    /** Ticks between words: [worst grade, best]. Interpolated by quality. */
    everyTicks: [number, number];
    /** Share of spell power a word lands at: [worst grade, best]. */
    power: [number, number];
  };
  /**
   * Conditions this body simply WEARS while the gene is expressed — usually
   * hidden ones, standing for a rule rather than announcing themselves.
   *
   * The reason it is a condition and not a stat: a condition carries its own
   * `removal`, so the rule's TRIGGER TYPES are per-application data rather than
   * a constant in a system file. A troll knits itself shut until heat or acid
   * lands, and "heat or acid" is written here, on this gene — which is what
   * makes it a thing a nuclease can rewrite and a stat could never be.
   *
   * Kept in step by `syncGeneStatuses` each tick, so slotting a gene puts them
   * on and swapping it takes them off.
   */
  confers?: StatusApplication[];
  /** What each arm carries before anything is routed into it. */
  base?: Partial<Record<MutagenArm, Modifier[]>>;
  /**
   * How big this body is, on SIZE_LADDER. Absent reads as medium.
   *
   * The first thing mutagens were ever described as doing — "a gigantoid main
   * gene makes the player larger, whatever implications that has" — and this
   * is the implications. Size is what `vsSmaller` and `fromSmaller` measure
   * against, so a giant's bonus against small things is a property of the body
   * rather than a list of tags it happens to beat up.
   */
  size?: SizeTag;
  /**
   * Bare writes ATTRIBUTES rather than derived stats, which is the whole of
   * why it is the generalist — attributes feed formulas across several
   * domains, so the spill is the mechanic. docs/MUTAGENS.md §8.
   */
  writesAttributes?: boolean;
  /**
   * This gene has no grade to speak of. It is still HELD at `c` — the neutral
   * anchor, so every curve keyed to quality reads it without a special case —
   * but nothing should ever show the player a grade for it.
   *
   * A separate axis from `writesAttributes` on purpose: gradeless is about
   * whether refinement applies, write-channel is about what it modifies, and a
   * future gene could plausibly be one without the other.
   */
  gradeless?: boolean;
}

export interface GenusDef {
  id: string;
  name: string;
  /** Quality grades equal to one tier step. Baseline 2 — see MUTAGENS.md §5. */
  gradesPerStep: number;
  /**
   * Every species in the genus, ordered by tier but NOT strictly — ties are
   * sidegrades, and a genus may branch into parallel lines that share tiers
   * (a plain slime and a fire slime are both rung one of the same family).
   */
  tiers: string[];
}

/** A player's chromosome. Slice 1 passes this in; slice 2 will persist it. */
export interface Chromosome {
  layout: string;
  main: GeneInstance | null;
  /** socket id → the mutation in it. */
  placed: Record<string, GeneInstance>;
  /** Edge keys paid for. Permanent — establishing is one-way. */
  established: string[];
  /** Established edges currently switched off. Reversible, costs capacity. */
  cut: string[];
}

export interface MutagenState {
  /**
   * Opened by quest. Until then nothing drops at all — a monster carrying a
   * gene is only carrying one once you know to look.
   */
  unlocked: boolean;
  chromosome: Chromosome;
  /**
   * Everything ever SEEN, which is a different thing from everything held: a
   * gene refined away or a mutagen spent stays catalogued. This is what
   * discovery pays against, so a find can only ever pay once.
   */
  known: { genes: string[]; mutagens: string[] };
}

// ---------- Music ----------

/**
 * Note durations, as fractions of a 4/4 bar. The rhythmic grid is
 * BAR_UNITS = 48 per bar (data/music.data.ts) — divisible by 16 AND by 3, so
 * straight notes down to the sixteenth and triplet feels share one integer
 * lattice and no duration ever needs a fraction. A duration is content: its
 * units, drawing hints and unlock level live in NOTE_DURATIONS.
 */
export type NoteDurId =
  | 'whole'
  | 'half'
  | 'quarter'
  | 'eighth'
  | 'sixteenth'
  | 'dottedHalf'
  | 'dottedQuarter'
  | 'dottedEighth'
  | 'tripletQuarter'
  | 'tripletEighth'
  | 'quintupletEighth'
  | 'quintupletSixteenth';

/**
 * One event on the sheet: a note, or (pitch null) a rest. A bar is a
 * monophonic SEQUENCE read left to right — an event's position is the sum of
 * what came before it, never stored, so bars can neither overlap nor gap.
 */
export interface NoteEvent {
  dur: NoteDurId;
  /** Semitones above middle C (the tonic row is the composition's `tonic`); null = a rest. */
  pitch: number | null;
  /**
   * Tied to the NEXT written event (across the barline if need be): the two
   * sound as one unbroken note. Only meaningful on a note whose written
   * successor is a note of the SAME pitch — anything else is flagged by
   * checkComposition (a tie to a different pitch would be a slur, which
   * this notation does not have). Ties are what let an off-beat note sound
   * THROUGH the next bar's downbeat — long syncopation, at last.
   */
  tie?: boolean;
}

/**
 * A repeat span — the ‖: :‖ barlines. Bars `from`..`to` (0-based, inclusive)
 * are played `times` times in a row before the piece moves on. Spans may not
 * overlap and may not cross the theme/coda boundary. Verbatim replays pay
 * harmonically-decaying power (1, ½, ⅓…): the world has heard it before —
 * the same novelty philosophy as everything else in this game.
 */
export interface RepeatSpan {
  from: number;
  to: number;
  times: number;
}

/** How a piece's last gesture lands, read against its detected key. */
export type MusicCadence = 'closed' | 'open' | 'deceptive' | 'wandering' | 'silent';

/**
 * A piece of written music. Bars 1–4 are the THEME — the basic performance.
 * Bars 5–8 are the CODA: read separately, and either swelling the theme
 * (same reading = a reprise, magnifying) or turning it somewhere else
 * (a different reading = a turn — the breakdown, made mechanical).
 *
 * Composing is free scribbling; what the player may PERFORM is gated by
 * Musicianship (checkComposition) while the reading itself is a pure function
 * of the sheet (readComposition) — the same seam arcana cut between
 * checkSentence and composeArcane, and for the same reason: the bench can
 * analyze a piece your hands cannot play yet.
 */
export interface Composition {
  id: number;
  name: string;
  /** Scale the staff is ruled in (MUSIC_SCALES); locked to 'major' until the unlock. */
  scale: string;
  /** Tonic pitch class 0–11 (0 = C); locked to 0 until tuning unlocks. */
  tonic: number;
  /**
   * Time signature (MUSIC_METERS); locked to 'common' (4/4) until meters
   * unlock. The meter sets each bar's CAPACITY (beats × beatUnits) and its
   * ACCENT table — where the strong pulses fall — which is what the
   * syncopation measure reads. One meter per piece, not per bar.
   */
  meter: string;
  /**
   * Tempo, as scores write it: ♩ = bpm, the QUARTER note per minute.
   * Deliberately quarter-referenced rather than beat-referenced, so it means
   * the same thing in every meter — changing 4/4 to 6/8 must not silently
   * change the speed. Locked to DEFAULT_BPM until tempo unlocks.
   */
  bpm: number;
  /**
   * A PEDAL TONE: one pitch sounding under the whole piece, unchanging —
   * the bagpipe/hurdy-gurdy trick. Null = none.
   *
   * Named `pedal` (the proper term, from organ pedal point) rather than
   * "drone" on purpose: `MUSIC_ARCHETYPES.drone` already means something
   * else — a MELODY that stands still — and the two would be a permanent
   * source of confusion sharing a word.
   *
   * It is the system's first VERTICAL dimension: with a pedal there are
   * simultaneous pitches, so consonance-against-it becomes measurable (the
   * `harmony` axis) and the pedal weighs on key-finding as heavily as its
   * length deserves. The cheap gateway to real polyphony.
   */
  pedal: number | null;
  bars: NoteEvent[][];
  /**
   * Repeat spans (the ‖: :‖ barlines). May not overlap, and may not cross
   * the theme/coda boundary — the coda is a separate reading, and a repeat
   * straddling it would make "which archetype is this" meaningless.
   */
  repeats: RepeatSpan[];
}

/**
 * A time signature. NOT a speed: tempo is a separate (future) dial — meter
 * decides how LONG a bar is and where its heartbeats land. 6/8 and 3/4 hold
 * the same 180 units and are completely different music, because 6/8 puts a
 * secondary pulse at its midpoint and swings in threes; that difference
 * lives entirely in `accents` + `beatUnits`, read by metricWeight.
 */
export interface MusicMeterDef {
  id: string;
  /** "4/4 — Common time". */
  name: string;
  icon: string;
  desc: string;
  /** Beats per bar (the top number). */
  beats: number;
  /** Grid units of ONE beat: 60 = a quarter (x/4 meters), 30 = an eighth (x/8). */
  beatUnits: number;
  /**
   * Unit positions of SECONDARY strong pulses (the downbeat is implied and
   * always strongest). 4/4 names its half-bar [120]; 5/4 as 3+2 names beat
   * four [180]; 3/4 names nothing — one accent per bar is its whole point.
   */
  accents: number[];
  /** Musicianship level that offers this ruling (0 = from the start). */
  unlockLevel: number;
}

/**
 * A performance in progress — benchWork's sibling and exclusive with it (and
 * with activities): you are on the stage, not also at the board. Bound to the
 * spot it began at; walking away or being jumped ends the set.
 */
export interface PerformanceState {
  compositionId: number;
  spot: string;
  ticksLeft: number;
  ticksTotal: number;
}

/** The shapes a melody's outline can take (see contourOf in systems/music.ts). */
export type MusicContour = 'rising' | 'falling' | 'arch' | 'valley' | 'level' | 'undulating';

/**
 * The normalized 0–1 measures a performance is judged on. Every axis is a
 * classifier output (systems/music.ts analyzeBars): `mode` is 1 major / 0
 * minor (0.5 when no key can be heard), `clarity` is Krumhansl-Schmuckler
 * correlation, `conjunct` the share of stepwise motion, `density` sounded
 * notes per bar against a 16-note bar, `range` the melodic span against an
 * octave. The rest are what they say.
 */
export type MusicAxis =
  | 'mode'
  | 'clarity'
  | 'consonance'
  | 'syncopation'
  | 'pitchEntropy'
  | 'rhythmEntropy'
  | 'density'
  | 'restRatio'
  | 'conjunct'
  | 'range'
  /** Motif self-similarity: does a figure recur? 1 = the piece is one idea repeated. */
  | 'motif'
  /**
   * How fast it actually goes, from the composition's own tempo — the one
   * axis not read off the notes. Density used to stand in for it, badly: a
   * dirge and a reel can hold the very same notes and differ only here.
   */
  | 'pace'
  /**
   * VERTICAL consonance: how agreeably the melody sits against the pedal
   * tone. The first axis that measures two pitches sounding at once rather
   * than one after another. Neutral (0.5) when there is no pedal — with no
   * second voice there is no harmony to have an opinion about.
   */
  | 'harmony';

/** A scale the staff can be ruled in. Degrees are semitones above the tonic. */
export interface MusicScaleDef {
  id: string;
  name: string;
  desc: string;
  /** Ascending, starting at 0 (the tonic), all within 0–11. The octave row is implied. */
  degrees: number[];
  /**
   * Which way this scale leans, when it leans at all. Present = the reading
   * takes the composition's key as GIVEN (see `keyIn`) instead of searching
   * for it, because the composer already ruled the staff. Absent = genuinely
   * ambiguous (a fully chromatic scale has no honest mode) and the 24-way
   * `findKey` search still runs.
   *
   * This matters more than it looks: the `mode` axis is binary, so a mistaken
   * reading is a full 1.0 error — the largest single term the classifier can
   * produce, and enough on its own to file Ode to Joy under `dirge`.
   */
  mode?: 'major' | 'minor';
}

/**
 * One kind of music a performance can be READ as. Classification is nearest-
 * centroid over the declared axes and therefore TOTAL: every composition,
 * however degenerate, is closest to something — a held single note is a
 * drone, maximal chaos is a rhapsody — so there are no hidden recipes, only
 * a chart that fills in. Omitted axes simply don't pull; `contours` shave a
 * little distance when the melody's outline matches.
 */
export interface MusicArchetypeDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  target: Partial<Record<MusicAxis, number>>;
  /** Per-axis emphasis (default 1). */
  weights?: Partial<Record<MusicAxis, number>>;
  contours?: MusicContour[];
  /** Cadences that suit this music — a small discount, like `contours`. */
  cadences?: MusicCadence[];
  /**
   * WHAT THIS MUSIC DOES — the effect hook. A condition applied to the
   * performer when a piece reading as this archetype is carried to its end,
   * at `intensity = max(1, round(power × perPower))`. The effect itself is
   * an ordinary StatusDef: statuses are already a fingerprinted mod source
   * with stacking, duration and escalation semantics, so authoring a
   * performance effect means writing a status and pointing at it — no new
   * machinery, and applyStatuses is side-agnostic, so a monster bard's hymn
   * lands through the exact same door. A TURN coda confers its own
   * archetype's status too, scaled by the share of the sheet it holds (a
   * reprise never double-confers — its magnification is already in power).
   * Absent = this music does nothing yet. Dormant until content says so.
   */
  confers?: {
    /** StatusDef id — the effect lives in the status registry. */
    status: string;
    /** Intensity per point of the reading's power. */
    perPower: number;
    /** Override the condition's own lifetime, in ticks. */
    duration?: number;
  };
}

// ---------- Events ----------

export type GameEvent =
  | { type: 'log'; msg: string; kind?: string; group?: string; prefix?: string; tally?: LogTally[] }
  | { type: 'tick:action'; tags: string[]; skillXp: number }
  | { type: 'skill:unlock'; id: string }
  | { type: 'skill:levelup'; id: string; level: number }
  | { type: 'attr:levelup'; attr: AttributeId; level: number }
  | { type: 'superattr:unlock'; id: SuperAttributeId }
  | { type: 'encounter'; spot: string; monsterIds: string[] }
  | { type: 'kill'; monster: MonsterInstance }
  /** The last enemy of a fight fell. `forced`: it was a fight that could not be fled. */
  | { type: 'fight:won'; spot: string; forced: boolean }
  | { type: 'defeat'; monster: MonsterInstance }
  | { type: 'loot'; item: ItemInstance }
  | { type: 'achievement'; id: string; tier: number }
  | { type: 'title:unlock'; id: string }
  | { type: 'arrive'; spot: string }
  /** A finished craft: recipe crafts name the recipe, bench work its discipline. */
  | { type: 'craft'; recipe?: string; discipline?: string }
  /**
   * A dish came off a cooking bench (cutting-board cuts are not dishes). The plate
   * card's payload: `outcome` is the bench outcome that matched, `dish` the
   * material made, `quality` the grade rolled and `low`..`high` the range the
   * preview promised (equal when the basket had no uniformity roll). Emitted
   * beside `craft`, not instead of it.
   */
  | {
      type: 'cooked';
      discipline: string;
      outcome: string;
      dish: string;
      quality: QualityTier;
      low: QualityTier;
      high: QualityTier;
      qty: number;
    }
  /** A first greeting — `talkTo` stamped `met:<npcId>` just now. */
  | { type: 'talk'; npcId: string }
  | { type: 'quest:accept'; id: string }
  | { type: 'quest:complete'; id: string }
  | { type: 'level:up'; level: number }
  | { type: 'bestiary:entry'; monsterId: string }
  | { type: 'bestiary:fact'; monsterId: string; factId: string }
  | { type: 'bestiary:habitat'; monsterId: string; spot: string };

export type GameEventType = GameEvent['type'];

/** See `GameState.huntRest`. */
export interface HuntRest {
  at: number;
  toFull: boolean;
  active: boolean;
}

/** See `SpotDef.dare`. */
export interface SpotDare {
  monsterId: string;
  level: number;
  every: number;
  /** What the keeper says when play holds (text table: `<spot>.dare.desc`). */
  desc: string;
}
