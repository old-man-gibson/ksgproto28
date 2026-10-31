import type {
  ActiveSpec,
  Bearer,
  Chromosome,
  ChromosomeEdge,
  ChromosomeLayout,
  DamageStep,
  DamageType,
  DerivedStats,
  GameState,
  GeneInstance,
  MainGeneDef,
  Modifier,
  MutagenArm,
  MutagenEffect,
  MonsterInstance,
  MutagenDef,
  MutationTransform,
  QualityTier,
} from '../types';
import {
  CENTROMERE,
  RES_STAT_BY_TYPE,
  STAT_NAMES,
  isMonsterBearer,
  sizeRank,
} from '../types';
import type { EventBus } from '../engine/events';
import { mercyChance } from '../engine/mercy';
import { chance, rand } from '../engine/rng';
import { QUALITY_ORDER, QUALITY_TIERS, qualityRank } from '../data/quality.data';
import { STATUSES } from '../data/statuses.data';
import { ARCANE_WORDS } from '../data/spellcraft.data';
import { MAX_STACK } from './arcane';
import { attrName, attrValue } from './attributes';
import {
  applyStatus,
  fieldHunger,
  findStatus,
  hasStatus,
  removeStatus,
  statusesOf,
} from './statuses';
import { monsterTagSet } from './bestiary';
import { BASE_SPEED, getDerivedStats } from './derived';
import { grantDiscoveryXp, grantSkillXp } from './skills';
import {
  grantGraded,
  grantMaterial,
  rollQuality,
  stockOf,
  takeGraded,
  type Placement,
} from './disciplines';
import {
  BASELINE_EDGE,
  CUT_BASE,
  CUT_GROWTH,
  GENERA,
  LAYOUTS,
  MAIN_BASE_COST,
  MAIN_GENES,
  MUTATIONS,
  MUTATION_COST,
  NUCLEASES,
  elementOf,
  type NucleaseDef,
  QUALITY_APPROACH,
  QUALITY_COST,
  TIER_COST_EXPONENT,
  edgeKey,
  startingKit,
} from '../data/mutagens.data';
import { text } from '../text/log';

/**
 * Mutagens: the crafting mirror of divine magic.
 *
 * Runecarving is a SUM. Cooking is a CLOCK. Alchemy is a SEQUENCE the player
 * writes. Mutagens is none of those: it is a TOPOLOGY. The player authors
 * SPACE — which sockets are filled and which connections are live — and both
 * the sequence and the relationships fall out of it as consequences.
 *
 * That is the guard, and it is the one thing this module must never give up:
 * **there is no field anywhere that says "apply cold, then crystal."** If you
 * want a different order you move a gene or cut an edge so the shortest path
 * runs somewhere else. A feature that lets the player state an order directly
 * is an alchemy feature wearing a chromosome.
 *
 * ---- The two laws ----
 *
 * **1. Everything flows to the centromere.** Effects propagate inward along
 * active connections by the path of FEWEST EDGES, affecting every mutagen they
 * pass through. Where routes tie, the effect splits evenly between them — that
 * halving is the entire cost of a split, there is no second penalty.
 *
 * **2. You never write an order. You move things.**
 *
 * ---- Two metrics, deliberately ----
 *
 * Routing is TOPOLOGICAL: the count of edges crossed, and nothing else. Edge
 * length never enters the routing decision. Intensity is GEOMETRIC: how far the
 * effect actually travelled, summed and divided by BASELINE_EDGE.
 *
 * They must not be the same measure or the system defeats itself — routing by
 * physical length would steer every effect away from the long edges that make
 * it strong. Keeping them apart buys the distinction the whole design rests on:
 *
 *     DISTANCE BUYS MAGNITUDE. HOPS BUY CHARACTER.
 *
 * Six baseline edges and one 18μm edge both deliver ×6. The single long edge
 * delivers an effect untouched; the six-hop route delivers it just as strongly
 * having been reinterpreted five times on the way.
 *
 * See docs/MUTAGENS.md for the full spec.
 */

// ---------- Tuning ----------

/** What one branch of an even two-way split carries. Ties never cost more. */
export const SPLIT_SHARE = 0.5;

/**
 * How far past its own coefficient a main gene lets routed MAGNITUDE climb.
 *
 * Tier buys the ceiling and quality buys the approach; this is how much
 * topology may then multiply on top. It exists because the special arm's
 * payouts — skillXp, craftSpeed, loot — do not scale off a gene's base power
 * the way damage does, so without a cap the optimal build is a bottom-tier
 * F-rank gene bought for minimum capacity with everything poured into special.
 *
 * Capabilities are deliberately NOT clamped by this. A cheap gene should reach
 * every trick and simply not push any number very far (docs/MUTAGENS.md §7).
 */
export const CEILING_HEADROOM = 3;

// ---------- Reading the graph ----------

// Defined in the data module so state.ts and the migrations can build a
// starting chromosome without pulling in the engine; re-exported here because
// this is where callers expect to find it.
export { edgeKey } from '../data/mutagens.data';

export function layoutOf(chromo: Chromosome): ChromosomeLayout {
  return LAYOUTS[chromo.layout] ?? LAYOUTS.baseline;
}

/**
 * The floor every chromosome falls back to.
 *
 * An empty centromere does not express NOTHING — it expresses the bare
 * sequence, which is what docs/MUTAGENS.md §8 meant by "there is no unequipped
 * state". Three things follow, and all of them are why this is a default rather
 * than an item:
 *
 *  - **Nothing is ever wasted.** Effects routed at an unfilled centromere land
 *    on a baseline body instead of evaporating. On a split chromosome, where
 *    leaving a slot open is a real option, that is the difference between a
 *    choice and a trap.
 *  - **No softlock.** Bare as a manufactured item means spending your last
 *    biomatter while wearing a body you regret leaves you wearing it.
 *  - **Prestige has somewhere to land.** Raising or rewriting the floor
 *    improves every build that ever falls back to it, which is exactly the
 *    shape a prestige upgrade wants.
 *
 * Held at `c` for the same reason the def is `gradeless`: every quality-keyed
 * curve reads it without a special case, and nothing shows the player a grade.
 */
export const BARE: GeneInstance = { id: 'bare', quality: 'c' };

/**
 * What the centromere is actually expressing. Callers should prefer this to
 * reading `chromo.main` directly — the null case is a real body, not an absence.
 */
export function expressedMain(chromo: Chromosome): GeneInstance {
  return chromo.main ?? BARE;
}

/**
 * The graph a bearer with nothing written on it reads as.
 *
 * The same argument `BARE` makes one level down: an unwritten body expresses
 * the bare sequence rather than nothing, so **every** bearer has a chromosome
 * and no caller anywhere needs a null branch. A monster carrying no genome is
 * not a special case — it is a body with an empty graph, and every function
 * here already knows what one of those resolves to.
 *
 * Frozen and shared, which matters twice: `chromosomeKey` gives it one stable
 * key so all ungenomed monsters hit the same memo entry, and nothing can
 * quietly write a socket onto the thing every monster in the game is reading.
 */
const NO_GENOME: Chromosome = {
  layout: 'baseline',
  main: null,
  placed: {},
  established: [],
  cut: [],
};
// Frozen as statements rather than inline, so the declaration keeps its plain
// `Chromosome` type — `Object.freeze` inline infers `readonly never[]` for the
// empty arrays and the whole thing then needs casting through `unknown` to fit
// the field it is. Every level is frozen: a shallow freeze would still let
// something push a socket onto the array every monster in the game is reading.
Object.freeze(NO_GENOME);
Object.freeze(NO_GENOME.placed);
Object.freeze(NO_GENOME.established);
Object.freeze(NO_GENOME.cut);

/**
 * THE GRAPH A BEARER IS WEARING — the one seam this whole module turns on.
 *
 * Everything above is pure graph maths that never cared whose graph it was;
 * everything that USED to take a `GameState` only did so to get here. Widening
 * this one function is what lets a monster wear a body, and it is why the
 * routing engine itself needed no changes at all.
 *
 * A monster reads nothing yet — `MonsterDef.genome` is the next story
 * (docs/plans/monster-def-genome.md), and until it lands every specimen is
 * bare. That is deliberately not a stub: bare is a real body, so this is
 * already CORRECT rather than merely inert, and the story that adds genomes
 * changes one line here and nothing else.
 */
export function genomeOf(bearer: Bearer): Chromosome {
  if (isMonsterBearer(bearer)) return NO_GENOME;
  return bearer.mutagens.chromosome;
}

/**
 * How big the player currently is, on SIZE_LADDER.
 *
 * A property of the slotted gene, so it changes the moment the centromere does
 * — and bare, having no opinion, leaves you person-sized.
 */
export function playerSizeRank(state: GameState): number {
  return sizeRank(MAIN_GENES[expressedMain(state.mutagens.chromosome).id]?.size);
}

/**
 * The body currently expressed, def and all. Bare included — never null.
 *
 * Takes a BEARER rather than the world, and every existing caller passing
 * `state` keeps working untouched, because the player is a bearer. That is the
 * shape the whole widening uses: a function that only ever needed to know
 * *whose body* asks for a bearer, and one that also needs the rng, the clock or
 * the field keeps `state` in front of it (docs/plans/bearer-seam.md).
 */
export function expressedGene(bearer: Bearer): MainGeneDef {
  // Through the resolution, so anything a nuclease rewrote is already written
  // in. `syncGeneStatuses` reads this to decide what the body wears, and a
  // troll rekeyed to be doused by cold has to WEAR the cold version.
  return currentResolution(bearer).main ?? MAIN_GENES[expressedMain(genomeOf(bearer)).id];
}

/** The species as WRITTEN, before any rekey. For "the gene says X, the graph made it Y". */
export function expressedGeneBase(bearer: Bearer): MainGeneDef {
  return MAIN_GENES[expressedMain(genomeOf(bearer)).id];
}

/** The rotation id the body's own tool occupies. One centromere, one ability. */
export const GENE_ACTIVE = 'gene';

/**
 * The tool the slotted gene hands you, AS WRITTEN. Bare has none.
 *
 * Prefer `geneAbility` unless you specifically want the unmodified species —
 * this one is for the panel's "the gene says X, the graph made it Y" and for
 * the hot path that only needs to know whether an ability exists at all.
 */
export function geneAbilityBase(bearer: Bearer): MainGeneDef['ability'] {
  return MAIN_GENES[expressedMain(genomeOf(bearer)).id]?.ability;
}

/**
 * How a graded range reads at this body's grade. `[worst, best]`, walked by the
 * same approach curve every other magnitude uses — so a range in content is
 * written the way a designer thinks about it and resolved in one place.
 */
export function atGrade(range: [number, number], gene: GeneInstance): number {
  const t = QUALITY_APPROACH[gene.quality] ?? 1;
  return range[0] + (range[1] - range[0]) * t;
}

/**
 * The fast this body keeps, with the specimen whose grade shapes it — or null
 * when the expressed body is not one that refuses.
 */
export function fastOf(
  bearer: Bearer,
): { fasts: NonNullable<MainGeneDef['fasts']>; gene: GeneInstance } | null {
  /*
   * ⚠️ CHEAP GATE FIRST. This is read from the regeneration path, which runs
   * once per pool per tick, and resolving the chromosome to discover that a
   * body does not fast is far more than that path should ever pay.
   *
   * Sound as well as cheap: a fasting body always wears the condition, because
   * `confers` is what puts the rule on in the first place (syncGeneStatuses),
   * and a monster says the same thing through `MonsterDef.wears`. Both sides
   * arrive wearing it, which is exactly why the fast was made a CONDITION
   * rather than a gene field — the workaround that ended up predicting this
   * whole seam. There is no fast this scan can miss on either side.
   */
  if (!hasStatus(bearer, 'fasting')) return null;
  const gene = expressedMain(genomeOf(bearer));
  const fasts = MAIN_GENES[gene.id]?.fasts;
  return fasts ? { fasts, gene } : null;
}

/**
 * What the ATTACK arm hands back in place of damage.
 *
 * The root descends with grade (4 at F, 2.5 at S), so a better specimen keeps
 * more of a big number — `damage ** (1/root)` grows as the root shrinks. Rooted
 * rather than scaled because the arm is meant to reward a body that COULD hit
 * hard and does not: the curve flattens, so stacking damage you will never
 * swing stops paying long before it stops costing.
 */
export function fastRegenBonus(bearer: Bearer, damage: number): number {
  const held = fastOf(bearer);
  if (!held || damage <= 0) return 0;
  return damage ** (1 / atGrade(held.fasts.regenRoot, held.gene)) * held.fasts.regenMult;
}

/**
 * What the DEFENCE arm is worth against the hunger standing on the field.
 *
 * Logarithmic in the total, so the first few stacks are most of the gift and a
 * runaway fast does not turn the body invulnerable — the same shape that keeps
 * the uncapped stacking on the offence side from being uncapped on this one.
 *
 * `hunger` is passed in rather than read: the totals live in combat state, and
 * this file has no business reaching into a fight.
 */
export function fastGuard(
  bearer: Bearer,
  hunger: number,
): { armor: number; ward: number } {
  const held = fastOf(bearer);
  if (!held || hunger <= 0) return { armor: 0, ward: 0 };
  const scale = Math.log(1 + hunger);
  return {
    armor: held.fasts.armorPerLogHunger * scale,
    // Nothing is ever wholly proof against being afflicted — only against
    // what the affliction is worth.
    ward: Math.min(held.fasts.wardMax, held.fasts.wardPerLogHunger * scale),
  };
}

/**
 * The next word this body will speak, and which rung of it.
 *
 * The rung is how many times THIS word has been spoken in THIS fight, so a
 * mouth warms up over an encounter rather than arriving at full voice — and
 * resets when the fight does, because the escalation is the shape of a fight
 * rather than a permanent upgrade. `stacked` on the word already holds the
 * ladder, so a rung is a lookup and never a rule.
 */
export function spokenAs(word: string, spoken: number): string {
  const def = ARCANE_WORDS[word];
  if (!def?.stacked) return word;
  // ⚠️ A SENTENCE TOKEN, not a word id. `stacked` holds display names — there
  // is no word called "blaze" to look up. Depth is spoken as `fire:3`, which
  // `splitWordId` parses; building the display name instead composes nothing
  // and the mouth goes silent without ever erroring.
  const tier = Math.max(1, Math.min(MAX_STACK, spoken));
  return tier === 1 ? word : `${word}:${tier}`;
}

/** What a refuting body did to a working somebody tried to speak. */
export interface Refusal {
  /** The working did not happen. */
  negated: boolean;
  /** …and will not happen again for the rest of this fight. */
  sealed: boolean;
  /** What arguing with it cost the speaker, in health. */
  backlash: number;
}

const NO_REFUSAL: Refusal = { negated: false, sealed: false, backlash: 0 };

/** Whether this working is sealed for the rest of the fight. */
export function isSealed(state: GameState, key: string): boolean {
  return state.combat?.sealed?.includes(key) ?? false;
}

/**
 * ARGUE WITH A WORKING. Called for every cast in the fight, from either side.
 *
 * The escalation is per WORKING, not per caster: saying the same thing again in
 * front of something that refuses creation is what gets it sealed, so the
 * counterplay is to vary what you speak rather than to stop speaking. Rolled
 * once per cast and BEFORE anything is spent, so a refused working still costs
 * what it cost — the argument is the expensive part.
 */
export function refuteCast(
  state: GameState,
  key: string,
  cost: number,
  /**
   * WHOSE body is doing the refusing. Last and defaulted rather than second,
   * against the world-first convention, purely so the existing call sites read
   * unchanged — the refuting body is the player in every one of them today.
   * When a monster refuses, it names itself here.
   */
  bearer: Bearer = state,
): Refusal {
  const c = state.combat;
  const refutes = expressedGene(bearer)?.refutes;
  if (!c || !refutes) return NO_REFUSAL;
  const held = expressedMain(genomeOf(bearer));

  if (!c.refuted) c.refuted = {};
  const said = (c.refuted[key] ?? 0) + 1;
  c.refuted[key] = said;

  if (!chance(state, atGrade(refutes.negate, held))) return NO_REFUSAL;
  // Each repetition of the SAME working is easier to refuse than the last.
  const sealChance = atGrade(refutes.lockout, held) + refutes.perCast * (said - 1);
  const sealed = chance(state, Math.min(1, sealChance));
  if (sealed) {
    if (!c.sealed) c.sealed = [];
    if (!c.sealed.includes(key)) c.sealed.push(key);
  }
  return { negated: true, sealed, backlash: Math.max(0, cost) };
}

/** The gene half of an ActiveSpec, named once so the pricing can be typed. */
export type GeneSpec = Extract<ActiveSpec, { type: 'gene' }>;

/**
 * WHAT A GENE'S ABILITY LANDS FOR, before crits, size and everything else the
 * blow picks up on the way out.
 *
 *     (flat + power × fromStat) × speed × (1 + amplifiedBy)
 *
 * One formula, and every ability uses the parts it needs:
 *
 *  - **Giants** take `flat + power × damage`. Damage is unbounded, so pricing
 *    per point rides gear forever.
 *  - **Basic slimes** take `(flat + armor) × speed`. Armour is unbounded too,
 *    but a bounce is a body thrown at somebody — speed is how hard it lands.
 *  - **Elemental slimes** take `flat × speed × (1 + resistance)`, because a
 *    resistance is BOUNDED and must never be priced per point. It runs
 *    0…`resistCap` with no attribute behind it, so `power × resHeat` gave a
 *    blow worth nothing early, worth its ceiling the moment the cap was
 *    reached, and worth exactly that forever after. As a multiplier the cap is
 *    a ×1.75 and a negative resistance genuinely takes damage off.
 *
 * Returns the steps as well as the number, because the damage report shows its
 * working and combat must not describe the blow differently from the card that
 * advertised it. ONE function; the panel used to do this arithmetic separately.
 */
export function priceGeneAbility(
  state: GameState,
  spec: GeneSpec,
  stats: DerivedStats,
  name: string,
  /**
   * Who it is landing on. Only needed by `perTargetStacks`, and deliberately
   * optional: the ability panel prices a blow with nobody in front of it, and
   * a target-priced ability simply reads as its floor there.
   */
  target?: GameState | MonsterInstance,
): { damage: number; steps: DamageStep[] } {
  const steps: DamageStep[] = [];
  let damage = spec.flat ?? 0;
  // `!== undefined` rather than truthy: a gene that writes `flat: 0` on purpose
  // — Kritavya's, whose whole blow is the ward it leaves — is stating a zero,
  // and a stated zero belongs in the working. Skipping it printed a Swing
  // header over nothing at all.
  if (spec.flat !== undefined) steps.push({ label: `${name} (flat damage)`, value: damage });
  // Priced per point of a derived stat, or of an ATTRIBUTE — the layer
  // underneath, which a body can read about itself rather than about its gear.
  const priced =
    spec.fromStat !== undefined
      ? { label: STAT_NAMES[spec.fromStat], value: stats[spec.fromStat] }
      : spec.fromAttr !== undefined
        ? { label: attrName(spec.fromAttr), value: attrValue(state, spec.fromAttr) }
        : null;
  if (spec.power !== undefined && priced) {
    damage += spec.power * priced.value;
    steps.push({ label: priced.label, value: priced.value });
    if (spec.power !== 1) steps.push({ label: name, mult: spec.power });
  }
  // What THEY are carrying, rather than what you are. Added beside `flat`
  // rather than multiplying, so a target with nothing on them takes the blow's
  // floor instead of taking nothing at all.
  if (spec.perTargetStacks && target) {
    const stacks = findStatus(target, spec.perTargetStacks.status)?.stacks ?? 0;
    if (stacks > 0) {
      damage += spec.perTargetStacks.power * stacks;
      steps.push({
        label: `${STATUSES[spec.perTargetStacks.status]?.name ?? spec.perTargetStacks.status} on the target`,
        value: stacks,
      });
      if (spec.perTargetStacks.power !== 1) {
        steps.push({ label: name, mult: spec.perTargetStacks.power });
      }
    }
  }
  if (spec.scalesWithSpeed) {
    const mult = stats.speed / BASE_SPEED;
    damage *= mult;
    steps.push({ label: 'Speed', mult });
  }
  if (spec.amplifiedBy) {
    // Clamped at zero only: a resistance far enough underwater takes the whole
    // blow off, and that is a real outcome. It must never turn it into healing.
    const mult = Math.max(0, 1 + stats[spec.amplifiedBy]);
    damage *= mult;
    steps.push({ label: STAT_NAMES[spec.amplifiedBy], mult });
  }
  return { damage, steps };
}

/**
 * The intensity a target-priced ability's `inflicts` land at, or undefined when
 * they should keep whatever intensity they were authored with.
 *
 * Separate from `priceGeneAbility` because it is a different question asked at
 * a different moment: the damage is priced once as the blow is built, and this
 * is asked again for each thing the blow reached — a splash hitting four
 * targets owes four different answers, since each of them has been feeding the
 * fast at their own rate.
 */
export function perTargetInflictIntensity(
  spec: GeneSpec,
  gene: GeneInstance,
  target: GameState | MonsterInstance,
): number | undefined {
  const per = spec.perTargetStacks;
  if (!per?.inflictRoot) return undefined;
  const stacks = findStatus(target, per.status)?.stacks ?? 0;
  if (stacks <= 0) return undefined;
  return Math.min(per.inflictCap ?? Infinity, stacks ** (1 / atGrade(per.inflictRoot, gene)));
}

/** What one grant does to the ability when it arrives at the Active arm. */
export const SPLIT_SPLASH = 0.35;

/**
 * WHAT AN ABILITY CAN CARRY — which is not the same as what the arm delivered.
 *
 * Every gene ability used to be a blow, so the Active arm could hand it a type,
 * a split, a condition and an unmissable flag and be certain all four were read.
 * Two shapes broke that assumption, and both break it honestly:
 *
 *  - A **volley** lands nothing of its own. It points, and the floating grips
 *    strike on their own clock reading their OWN types (combat.ts,
 *    `floatingSwing`). Nothing on the ability's spec is consulted at all.
 *  - A **wind-up** lands later, through `landIncantation`, which reads the type
 *    and the conditions — but never the splash, and never a to-hit roll it was
 *    already carried past.
 *
 * Declining the write is the same choice `applyActiveArm` already makes for a
 * plain buff: a capability nothing reads must not be recorded as one, or the
 * panel goes on to report it, chip it live, and list it as a rewrite. §11 asks
 * the system to be legible; a legible lie is the worse failure.
 */
export function abilityCarries(spec: GeneSpec): {
  type: boolean;
  sure: boolean;
  splash: boolean;
  inflicts: boolean;
} {
  if (spec.volley) return { type: false, sure: false, splash: false, inflicts: false };
  if (spec.incant) return { type: true, sure: false, splash: false, inflicts: true };
  return { type: true, sure: true, splash: true, inflicts: true };
}

/**
 * Whether this ability lands a blow whose SIZE is worth quoting.
 *
 * A price with no terms in it is not a blow worth nothing — it is an ability
 * that does not work that way, and "0 damage" is the one thing a card must not
 * say about it. Kritavya's deliberate `flat: 0` is a real blow and stays true;
 * a volley, which has no terms at all, is not.
 */
export function pricesABlow(spec: GeneSpec): boolean {
  if (spec.volley) return false;
  if (spec.flat !== undefined) return true;
  return spec.power !== undefined && (spec.fromStat !== undefined || spec.fromAttr !== undefined);
}

/**
 * THE LOUDEST VOICE RE-TYPES YOU: the arriving damage type carried by the
 * heaviest route into an arm, or none if nothing typed reached it.
 *
 * Shared by the two arms that read a type, so "which one wins when three
 * arrive" can never be answered differently in two places. Weight rather than
 * recency or authoring order, because weight is the thing the player steers.
 */
export function loudestType(arm: ArmResolution, ceiling: number): DamageType | undefined {
  let loudest = 0;
  let winner: DamageType | undefined;
  for (const c of arm.contributions) {
    if (!c.arrived.type) continue;
    const weight = contributionWeight(c, ceiling);
    if (weight > loudest) {
      loudest = weight;
      winner = c.arrived.type;
    }
  }
  return winner;
}

/** The type an arm's routing delivered, read off live state. */
export function routedType(bearer: Bearer, arm: MutagenArm): DamageType | undefined {
  const res = currentResolution(bearer);
  return loudestType(res.arms[arm], res.ceiling);
}

/**
 * Put on whatever the expressed gene simply WEARS, and take off what it no
 * longer does. Run every tick; cheap, and idempotent by construction.
 *
 * Re-applying rather than applying once means the pair survives everything that
 * can interrupt it — a swapped centromere, a load, a status wiped by something
 * else. It cannot stomp a live state machine either, because the condition that
 * replaces one of these declares itself a `blockedBy` of it: while a troll is
 * doused, `knitting` simply refuses to land, and returns of its own accord the
 * tick after the dousing lifts.
 */
export function syncGeneStatuses(state: GameState, bearer: Bearer = state): void {
  const wears = expressedGene(bearer)?.confers;
  const worn = new Set<string>();
  for (const app of wears ?? []) {
    worn.add(app.id);
    if (!hasStatus(bearer, app.id)) applyStatus(state, bearer, app, 'your own sequence');
  }
  // A body that is no longer that body stops wearing its conditions. Only ever
  // conditions some gene confers, so nothing else on you is ever touched.
  for (const held of [...statusesOf(bearer)]) {
    if (worn.has(held.id)) continue;
    if (held.source === 'your own sequence') removeStatus(bearer, held.id);
  }
}

/** Whether a capability arrived in a PARTICULAR arm — the only place it is read. */
export function armGrants(bearer: Bearer, arm: MutagenArm, grant: string): boolean {
  return currentResolution(bearer).arms[arm].grants.includes(grant);
}

/**
 * The Active arm, applied to the ability. §12.3, adopted 2026-08-07.
 *
 * This is the hole the arm's own name advertised: the other three arms describe
 * stats and the stat pipeline eats them, while Active described an *ability*
 * and nothing consumed it — so pouring mutations into the arm named Active did
 * everything except what a player would bet money on.
 *
 * The rule is §12's proposal, adopted for this arm only:
 *   - **`type` re-types.** The arriving damage type REPLACES the ability's, and
 *     §7a is why it replaces rather than adds — additive re-typing widens your
 *     coverage for free, replacement costs you against the new type permanently
 *     and with no opt-out. Where several types arrive, the heaviest route wins:
 *     the loudest voice re-types you, and which one is loudest is a topology
 *     decision the player already controls.
 *   - **`grants` add behaviour**, and only behaviour — never a number.
 *   - **`mods` are NOT read here.** They land as ordinary stats, as they always
 *     have. An ability priced off a stat already feels them; paying twice would
 *     be the one thing §7a's ceiling argument cannot absorb.
 */
export function applyActiveArm(
  ability: NonNullable<MainGeneDef['ability']>,
  res: ChromosomeResolution,
): NonNullable<MainGeneDef['ability']> {
  const arm = res.arms.active;
  if (!arm.contributions.length) return ability;
  // A plain buff has no damage, no target and nothing to leave behind, so there
  // is nothing for an arriving type or condition to attach to. Left alone
  // rather than half-answered — see §12, still open for that shape.
  if (ability.spec.type !== 'gene') return ability;

  const spec = { ...ability.spec };
  const carries = abilityCarries(spec);
  const retype = loudestType(arm, res.ceiling);
  if (retype && carries.type) spec.damageType = retype;

  /**
   * What each capability arrived WITH — the summed weight of the routes that
   * carried it.
   *
   * §7 says a capability is free: whether the bite brands at all is a yes/no
   * that a cheap gene reaches as easily as an expensive one. How HARD it brands
   * is a magnitude, and magnitudes are capped — so a Brand's intensity is the
   * one thing about it the graph gets to decide. Without this every brand
   * applied at intensity 1 forever, which made distance, grade and placement
   * all mean nothing to a condition build.
   */
  const carried = new Map<string, number>();
  for (const c of arm.contributions) {
    // The origin's grade applies HERE rather than at the source, because a
    // Brand has no `mods` for `scaleEffect` to have scaled on the way out — so
    // without this a Divine brand and a Refuse one land identically, and the
    // whole refinement half of the system means nothing to a condition build.
    const weight = contributionWeight(c, res.ceiling) * mutagenApproach(c.quality);
    for (const g of c.arrived.grants ?? []) carried.set(g, (carried.get(g) ?? 0) + weight);
  }

  for (const grant of arm.grants) {
    if (grant === 'ignores_dodge') {
      if (carries.sure) spec.sure = true;
    } else if (grant === 'splits_target') {
      // Deliberately NOT scaled: splash above 1 would hit the bystanders harder
      // than the target, which is a different ability rather than a stronger
      // one. The capability is the whole of what this grant buys.
      if (!carries.splash) continue;
      spec.splashAll = true;
      spec.splash = Math.max(spec.splash ?? 0, SPLIT_SPLASH);
    } else if (grant.startsWith('inflicts_')) {
      if (!carries.inflicts) continue;
      const id = grant.slice('inflicts_'.length);
      // An unknown status is a content error, not a silent no-op — but it must
      // not crash a fight, so it is simply not applied.
      if (!STATUSES[id]) continue;
      if (spec.inflicts?.some((a) => a.id === id)) continue;
      spec.inflicts = [...(spec.inflicts ?? []), { id, intensity: carried.get(grant) ?? 1 }];
    }
  }
  return { ...ability, spec };
}

/**
 * The active tool as the body currently expresses it — the gene's own, with
 * whatever the Active arm routed in folded through `applyActiveArm`.
 *
 * Every consumer goes through here (combat's `pickActive`, the rotation card,
 * the chromosome panel), so re-typing a bite is one change in one place rather
 * than five sites remembering to ask.
 */
export function geneAbility(bearer: Bearer): MainGeneDef['ability'] {
  const base = geneAbilityBase(bearer);
  if (!base) return undefined;
  return applyActiveArm(base, currentResolution(bearer));
}

/**
 * Every capability the body currently has: the main gene's own, plus anything
 * the graph routed into an arm.
 *
 * Read straight off state rather than through the stat pipeline, for the same
 * reason size is — equipment rules are decided before stats are built, and a
 * capability is not a number anyway.
 */
/**
 * ⚠️ WHY THESE CACHES ARE KEYED MAPS AND NOT THE SINGLE SLOTS THEY WERE.
 *
 * Both this and `resolveChromosome` used to hold exactly one entry, which was
 * sound for precisely as long as exactly one chromosome existed. The moment a
 * monster can wear a body, the player and up to five specimens rotate through
 * that slot and the hit rate is **zero** — on the combat tick, where
 * `tickFloatingWeapons` asks for grants every tick, and through every one of an
 * offline catch-up's ~288k ticks.
 *
 * That is the whole reason this is the first story of the epic rather than a
 * cleanup after it: shipping the bearer seam over single-slot memos would be a
 * silent, system-wide performance regression that no test would fail on.
 *
 * Eight entries is the real working set — the player plus a full formation,
 * with room to spare. Least-recently-used eviction, so the player, asked far
 * more often than any one specimen, is never what a crowded fight throws out.
 */
const MEMO_CAP = 8;

function memoized<T>(store: Map<string, T>, key: string, build: () => T): T {
  const hit = store.get(key);
  if (hit !== undefined) {
    // Re-insert to refresh recency. Map iterates in insertion order, which is
    // what makes "delete the first key" an LRU eviction and not a random one.
    store.delete(key);
    store.set(key, hit);
    return hit;
  }
  const fresh = build();
  store.set(key, fresh);
  if (store.size > MEMO_CAP) store.delete(store.keys().next().value!);
  return fresh;
}

const grantsMemo = new Map<string, ReadonlySet<string>>();

export function bearerGrants(bearer: Bearer): ReadonlySet<string> {
  const chromo = genomeOf(bearer);
  /*
   * ⚠️ The returned Set is SHARED and must be treated as read-only, exactly as
   * `resolveChromosome`'s resolution is.
   */
  return memoized(grantsMemo, chromosomeKey(chromo), () => {
    const out = new Set(MAIN_GENES[expressedMain(chromo).id]?.grants ?? []);
    for (const arm of Object.values(resolveChromosome(chromo).arms)) {
      for (const g of arm.grants) out.add(g);
    }
    return out;
  });
}

/** Socket names only, for the places that do not care where anything sits. */
export function socketIds(layout: ChromosomeLayout): string[] {
  return layout.sockets.map((s) => s.id);
}

/** Where a node sits, centromere included. Presentation only. */
export function positionOf(
  layout: ChromosomeLayout,
  node: string,
): { x: number; y: number } | undefined {
  if (node === CENTROMERE) return layout.centre;
  return layout.sockets.find((s) => s.id === node);
}

/**
 * The edges an effect may actually travel: established, and not currently cut.
 * Establishing is permanent and costs a resource; cutting is reversible and
 * costs capacity. Those are different decisions on different horizons, which is
 * why they are two lists rather than one tri-state.
 */
export function activeEdges(chromo: Chromosome): ChromosomeEdge[] {
  const layout = layoutOf(chromo);
  const live = new Set(chromo.established);
  const cut = new Set(chromo.cut);
  return layout.edges.filter((e) => {
    const key = edgeKey(e.a, e.b);
    return live.has(key) && !cut.has(key);
  });
}

interface Adjacency {
  [node: string]: { to: string; edge: ChromosomeEdge }[];
}

function adjacencyOf(edges: ChromosomeEdge[]): Adjacency {
  const adj: Adjacency = {};
  for (const edge of edges) {
    (adj[edge.a] ??= []).push({ to: edge.b, edge });
    (adj[edge.b] ??= []).push({ to: edge.a, edge });
  }
  return adj;
}

/**
 * Edges from the centromere to every node that can reach it. This is the ONLY
 * distance the router reads — `edge.length` is deliberately ignored here.
 */
export function hopDistances(edges: ChromosomeEdge[]): Record<string, number> {
  const adj = adjacencyOf(edges);
  const dist: Record<string, number> = { [CENTROMERE]: 0 };
  const queue: string[] = [CENTROMERE];
  while (queue.length) {
    const node = queue.shift()!;
    for (const { to } of adj[node] ?? []) {
      if (dist[to] === undefined) {
        dist[to] = dist[node] + 1;
        queue.push(to);
      }
    }
  }
  return dist;
}

// ---------- Effects in transit ----------

function transformOf(chromo: Chromosome, socket: string): MutationTransform | undefined {
  const held = chromo.placed[socket];
  return held ? MUTATIONS[held.id]?.transform : undefined;
}

/**
 * How close to full strength a mutagen of this grade works.
 *
 * Quality used to buy a mutagen NOTHING — `walk` never read `held.quality` —
 * while costing more capacity through QUALITY_COST, which made F strictly
 * optimal and every refinement a self-inflicted wound. A main gene splits its
 * power into tier (the ceiling) and quality (the approach to it); a mutagen has
 * no tier, so quality is its whole power axis and rides the same curve.
 *
 * Magnitudes only. `grants` are untouched, because §7 says a capability reads
 * the same off a cheap thing as an expensive one.
 */
export function mutagenApproach(quality: QualityTier): number {
  return QUALITY_APPROACH[quality] ?? 1;
}

/** A mutagen's own effect at the strength its grade actually works at. */
export function scaleEffect(effect: MutagenEffect, approach: number): MutagenEffect {
  if (approach === 1 || !effect.mods?.length) return effect;
  return { ...effect, mods: effect.mods.map((m) => ({ ...m, value: m.value * approach })) };
}

/**
 * What passing through one mutagen does to an effect's CHARACTER. Applied in
 * traversal order, which is where the sequence identity lives: chill-then-
 * crystal and crystal-then-chill are not the same arrival.
 *
 * ⚠️ `mult` is deliberately NOT applied here any more — see `transformGain`.
 */
export function applyTransform(effect: MutagenEffect, t: MutationTransform | undefined): MutagenEffect {
  if (!t) return effect;
  const out: MutagenEffect = { ...effect };
  if (t.retype) out.type = t.retype;
  if (t.grants?.length) out.grants = [...(out.grants ?? []), ...t.grants];
  return out;
}

/**
 * What passing through one mutagen does to an effect's MAGNITUDE, as a factor
 * on the route rather than on the modifiers.
 *
 * It used to multiply `effect.mods` directly, which quietly put every transform
 * OUTSIDE the main gene's ceiling — §7 promises magnitudes are capped, and a
 * chain of multipliers escaped that promise entirely. Harmless while the only
 * two were ×1.15 and ×1.10; the moment amplifiers exist it is the only build
 * worth playing. Gain now rides on the contribution and is clamped with the
 * distance it travelled (`contributionWeight`), so amplifiers buy you a way to
 * REACH the ceiling from a cramped graph rather than a way past it.
 */
export function transformGain(t: MutationTransform | undefined, approach: number): number {
  if (t?.mult === undefined) return 1;
  // Quality buys the surplus, not the whole factor: a ×1.5 conduit is ×1.25 at
  // the bottom grade and never drops below ×1, so F is weak and never harmful.
  return 1 + (t.mult - 1) * approach;
}

// ---------- Routing ----------

/** One branch of one gene's journey, from its socket to one arm. */
export interface RoutedContribution {
  /** The socket it started in. */
  from: string;
  gene: MutagenDef;
  quality: QualityTier;
  /** Sockets passed THROUGH, in order. Excludes the origin. */
  through: string[];
  /** Edges crossed. What the router minimised. */
  hops: number;
  /** Micrometres travelled. What sets intensity. */
  distance: number;
  /** distance / BASELINE_EDGE, before any ceiling. Pure geometry. */
  intensity: number;
  /**
   * Everything multiplying the route that is NOT geometry: the conduits it
   * passed through, and the catalysts feeding its origin. 1 when neither.
   */
  gain: number;
  /** intensity × gain — what the ceiling is actually measured against. */
  magnitude: number;
  /** Product of the even splits taken. 1 when nothing tied. */
  share: number;
  /** The effect AS IT ARRIVES, after every transform en route. */
  arrived: MutagenEffect;
  arm: MutagenArm;
  notes: string[];
}

/**
 * Walk one gene inward, splitting evenly wherever routes tie.
 *
 * A node's successors are its neighbours strictly closer to the centromere, so
 * the walk always terminates and never revisits. Every successor is on *a*
 * shortest path by construction, which is what makes the even split correct
 * per branch point rather than merely uniform across whole routes.
 */
function walk(
  chromo: Chromosome,
  adj: Adjacency,
  dist: Record<string, number>,
  origin: string,
  gene: MutagenDef,
  quality: QualityTier,
  boost: Record<string, number>,
  out: RoutedContribution[],
): void {
  const step = (
    node: string,
    share: number,
    distance: number,
    gain: number,
    effect: MutagenEffect,
    through: string[],
    notes: string[],
  ): void => {
    const successors = (adj[node] ?? []).filter(({ to }) => dist[to] === dist[node] - 1);
    if (!successors.length) return;
    const each = share / successors.length;
    if (successors.length > 1) {
      notes.push(
        `${node} ties ${successors.length} ways — the effect divides evenly, ${(each * 100).toFixed(0)}% down each.`,
      );
    }
    for (const { to, edge } of successors) {
      const travelled = distance + edge.length;
      const branchNotes = [...notes];
      if (to === CENTROMERE) {
        const arm = edge.arm;
        if (!arm) continue; // A centromere edge with no arm is a content error.
        const intensity = travelled / BASELINE_EDGE;
        branchNotes.push(
          `arrives at the ${arm} arm after ${travelled}μm — ×${intensity.toFixed(2)} intensity` +
            (through.length ? `, reinterpreted ${through.length} time(s) on the way.` : ', untouched.'),
        );
        if (gain !== 1) {
          branchNotes.push(`amplified ×${gain.toFixed(2)} on top of the distance.`);
        }
        out.push({
          from: origin,
          gene,
          quality,
          through: [...through],
          hops: through.length + 1,
          distance: travelled,
          intensity,
          gain,
          magnitude: intensity * gain,
          share: each,
          arrived: effect,
          arm,
          notes: branchNotes,
        });
        continue;
      }
      const t = transformOf(chromo, to);
      let carried = gain;
      if (t) {
        const held = chromo.placed[to];
        const factor = transformGain(t, mutagenApproach(held.quality));
        carried *= factor;
        branchNotes.push(
          `passes through ${to} (${MUTATIONS[held.id]?.name ?? held.id}) and is rewritten` +
            (factor !== 1 ? `, ×${factor.toFixed(2)} stronger for it.` : '.'),
        );
      }
      step(to, each, travelled, carried, applyTransform(effect, t), [...through, to], branchNotes);
    }
  };

  const held = chromo.placed[origin];
  // Quality scales what this socket SENDS; the grade of anything it passes
  // through scales that hop's own multiplier instead (see `step`).
  const start = scaleEffect(MUTATIONS[held.id]?.effect ?? {}, mutagenApproach(quality));
  step(origin, 1, 0, boost[origin] ?? 1, start, [], []);
}

/**
 * What each socket's own output is multiplied by, before it sets off.
 *
 * This is the CATALYST's whole mechanic and the one thing on this graph that
 * travels a direction nothing else does. A conduit multiplies what passes
 * through it; a catalyst multiplies the output of whatever its own route runs
 * INTO — so it wants to sit one step further out than the thing it is helping,
 * and a catalyst pointed straight at the centromere helps nobody.
 *
 * Resolved OUTERMOST FIRST, which is what makes "including another amplifier"
 * work and what makes it terminate: amplification only ever flows toward the
 * centre, so by the time a socket is read, everything that could feed it has
 * already been counted. Ties divide the surplus, like every other magnitude
 * here — a catalyst that splits two ways is not two catalysts.
 */
export function amplification(
  chromo: Chromosome,
  adj: Adjacency,
  dist: Record<string, number>,
): Record<string, number> {
  const boost: Record<string, number> = {};
  const sockets = Object.keys(chromo.placed)
    .filter((s) => dist[s] !== undefined)
    .sort((a, b) => dist[b] - dist[a]);
  for (const socket of sockets) {
    const held = chromo.placed[socket];
    const amplify = MUTATIONS[held.id]?.amplify;
    if (amplify === undefined) continue;
    const own = 1 + (amplify - 1) * mutagenApproach(held.quality);
    // Its own surplus, raised by whatever is feeding IT. This is the compound.
    const strength = 1 + (own - 1) * (boost[socket] ?? 1);
    const successors = (adj[socket] ?? []).filter(({ to }) => dist[to] === dist[socket] - 1);
    if (!successors.length) continue;
    const each = 1 + (strength - 1) / successors.length;
    for (const { to } of successors) boost[to] = (boost[to] ?? 1) * each;
  }
  return boost;
}

// ---------- Resolution ----------

export interface ArmResolution {
  arm: MutagenArm;
  /** What the main gene puts here before anything is routed in. */
  base: Modifier[] | undefined;
  contributions: RoutedContribution[];
  /** Capabilities that reached this arm. Never scaled, never capped. */
  grants: string[];
  /** Summed magnitude weight — intensity × share, after the ceiling. */
  weight: number;
}

export interface CapacityUse {
  main: number;
  mutations: number;
  cuts: number;
  total: number;
}

export interface ChromosomeResolution {
  layout: ChromosomeLayout;
  main: MainGeneDef | null;
  /** The magnitude cap every arm is subject to. §7 */
  ceiling: number;
  arms: Record<MutagenArm, ArmResolution>;
  /** Sockets holding a gene with no live route to the centre. */
  stranded: string[];
  capacity: CapacityUse;
  notes: string[];
}

const ARMS: MutagenArm[] = ['attacks', 'defenses', 'active', 'special'];

/**
 * Read a chromosome. Pure: graph in, resolution out, no state and no roll.
 *
 * Everything the panel needs to SHOW its work comes back here — resolved
 * routes, what each hop did, which arm took what. That is not a convenience:
 * players can only game a system they can see, and a chromosome that reports a
 * final number and nothing else is a wiki lookup rather than a puzzle
 * (docs/MUTAGENS.md §11).
 */
/**
 * Everything about a chromosome that changes what it RESOLVES to, as one
 * comparable string — the same contract `modFingerprint` keeps for stats.
 * A new field on `Chromosome` that affects routing must appear here.
 */
function chromosomeKey(chromo: Chromosome): string {
  const placed = Object.keys(chromo.placed)
    .sort()
    .map((s) => `${s}:${chromo.placed[s].id}:${chromo.placed[s].quality}`)
    .join(',');
  return [
    chromo.layout,
    `${chromo.main?.id ?? '-'}:${chromo.main?.quality ?? '-'}`,
    placed,
    [...chromo.established].sort().join('|'),
    [...chromo.cut].sort().join('|'),
  ].join('#');
}

/**
 * Keyed memo. `geneAbility` consults the resolution, and it is asked on the
 * rotation's hot path every tick — including the ~288k ticks of an offline
 * catch-up — so resolving the graph afresh each time is not free the way it was
 * when only the panel asked.
 *
 * Keyed rather than single-slot for the reason spelled out at `memoized`: one
 * slot serves one chromosome, and a fight holds six. A def-side monster genome
 * is static, so it computes once and is then answered from here forever.
 *
 * ⚠️ The returned object is SHARED. Treat a resolution as read-only; every
 * caller here copies before sorting.
 */
const resolutionMemo = new Map<string, ChromosomeResolution>();

export function resolveChromosome(chromo: Chromosome): ChromosomeResolution {
  return memoized(resolutionMemo, chromosomeKey(chromo), () => computeResolution(chromo));
}

function computeResolution(chromo: Chromosome): ChromosomeResolution {
  const layout = layoutOf(chromo);
  const edges = activeEdges(chromo);
  const adj = adjacencyOf(edges);
  const dist = hopDistances(edges);
  const notes: string[] = [];

  // An empty centromere expresses the bare sequence rather than nothing, so a
  // resolution always has a body to modify and routed effects always land.
  const expressed = expressedMain(chromo);
  const written = MAIN_GENES[expressed.id] ?? null;
  /*
   * REKEYS FIRST, before anything reads the gene.
   *
   * A nuclease changes what the body IS, so it has to land before the arms are
   * built out of `main.base` and before `syncGeneStatuses` reads what the body
   * wears — otherwise half the game would see the rewritten troll and half the
   * one on the page. Nearest-first by hops, which is the distance routing
   * already minimises, so no new ordering concept enters the system.
   */
  const rekeys = Object.keys(chromo.placed)
    .filter((s) => dist[s] !== undefined && MUTATIONS[chromo.placed[s].id]?.rekey)
    .sort((a, b) => dist[a] - dist[b] || (a < b ? -1 : 1))
    .map((s) => MUTATIONS[chromo.placed[s].id].rekey!)
    .filter((r) => r.kind === 'vulnerability')
    .map((r) => r.to);
  const main = written ? rekeyGene(written, rekeys) : null;
  const ceiling = main ? coefficientOf(expressed) * CEILING_HEADROOM : 0;

  const arms = Object.fromEntries(
    ARMS.map((arm) => [
      arm,
      { arm, base: main?.base?.[arm], contributions: [], grants: [], weight: 0 } as ArmResolution,
    ]),
  ) as Record<MutagenArm, ArmResolution>;

  // An effect lands in whichever arm the edge it ARRIVED on carries — never in
  // the gene's native arm. Getting the right mutation to the right arm is the
  // routing puzzle; a misrouted one still arrives, and what it can do once it
  // is there is the content's business, not the engine's.
  const stranded: string[] = [];
  const all: RoutedContribution[] = [];
  const boost = amplification(chromo, adj, dist);
  for (const socket of Object.keys(chromo.placed)) {
    const held = chromo.placed[socket];
    const gene = MUTATIONS[held.id];
    if (!gene) continue;
    if (dist[socket] === undefined) {
      stranded.push(socket);
      notes.push(`${gene.name} in ${socket} has no live route to the centromere and contributes nothing.`);
      continue;
    }
    walk(chromo, adj, dist, socket, gene, held.quality, boost, all);
  }

  for (const c of all) {
    const arm = arms[c.arm];
    arm.contributions.push(c);
    // Distance × amplification × share, clamped by what the main gene can
    // carry. Capabilities ride free — a cheap gene reaches every trick.
    arm.weight += contributionWeight(c, ceiling);
    for (const g of c.arrived.grants ?? []) if (!arm.grants.includes(g)) arm.grants.push(g);
  }

  return {
    layout,
    main,
    ceiling,
    arms,
    stranded,
    capacity: capacityUsed(chromo),
    notes,
  };
}

// ---------- What a gene is worth ----------

/**
 * The weapon coefficient a gene reads at. Tier buys the CEILING, quality buys
 * how close you get to it — so a hill giant runs 0.9 at F and 1.8 at S, and a
 * jötunn runs the same fractions against a taller ceiling. This is also the
 * number every arm's magnitude cap is derived from.
 */
export function coefficientOf(gene: GeneInstance): number {
  const def = MAIN_GENES[gene.id];
  if (!def) return 0;
  return def.ceiling * (QUALITY_APPROACH[gene.quality] ?? 1);
}

/**
 * A headline ability's damage: a flat term the tier sets, plus a weapon-scaled
 * term the coefficient sets.
 *
 * The flat term decays into noise as gear improves while the coefficient rides
 * gear forever, which is why tier is what you feel early and quality is what
 * you feel late — and why tier raising the ceiling too is what stops a high
 * tier from becoming a decaying flat bonus you overpaid for.
 */
export function abilityDamage(gene: GeneInstance, weaponDamage: number): number {
  const def = MAIN_GENES[gene.id];
  if (!def) return 0;
  return def.flatBase + weaponDamage * coefficientOf(gene);
}

/**
 * Where a gene sits on its genus's power ladder, in tier-units.
 *
 * A genus is two numbers — how many tiers, and how many grades a tier step is
 * worth — and this is what they mean together. At the baseline two grades per
 * step, a B-rank gene reads level with a D-rank of the next tier up.
 */
export function powerRank(gene: GeneInstance): number {
  const def = MAIN_GENES[gene.id];
  if (!def) return 0;
  const genus = GENERA[def.genus];
  if (!genus) return def.tier;
  return def.tier + qualityRank(gene.quality) / genus.gradesPerStep;
}

// ---------- Capacity ----------

/**
 * Whether a gene has a grade worth showing. Bare is held at `c` so that every
 * quality-keyed curve reads it without a special case, but there is nothing to
 * refine and the player should never see a chip for it.
 */
export function showsGrade(gene: GeneInstance): boolean {
  return !MAIN_GENES[gene.id]?.gradeless;
}

/** What one main gene reserves. Bare is a fixed floor — it has no tier to price. */
export function mainCost(gene: GeneInstance): number {
  const def = MAIN_GENES[gene.id];
  if (!def) return 0;
  // Bare has no tier to measure power against, so it takes a flat floor. The
  // grade term stays in rather than being skipped: at `c` it is exactly 1, so
  // this reads identically today and behaves sanely if anything ever grades it.
  if (def.gradeless) return MAIN_BASE_COST * 0.4 * (QUALITY_COST[gene.quality] ?? 1);
  const genus = GENERA[def.genus];
  // The anchor is the WEAKEST species, not the first listed. A branching genus
  // has several species at its bottom rung, and `tiers[0]` is only whichever
  // one the author happened to type first.
  const bottom = genus?.tiers
    .map((id) => MAIN_GENES[id])
    .filter(Boolean)
    .reduce((lo, g) => (g.flatBase < lo.flatBase ? g : lo), def);
  const ratio = bottom && bottom.flatBase > 0 ? def.flatBase / bottom.flatBase : 1;
  // Anchored to the bottom tier's C-rank power and keyed to MEASURED power, not
  // to the ordinal tier index — otherwise a deep genus gets its strongest
  // species at a discount and every optimiser finds it on day one.
  return MAIN_BASE_COST * Math.pow(ratio, TIER_COST_EXPONENT) * (QUALITY_COST[gene.quality] ?? 1);
}

/** What n held cuts reserve. Compounding, so a heavily sculpted graph bites. */
export function cutCost(n: number): number {
  let total = 0;
  for (let i = 0; i < n; i++) total += CUT_BASE * Math.pow(CUT_GROWTH, i);
  return total;
}

export function capacityUsed(chromo: Chromosome): CapacityUse {
  const main = chromo.main ? mainCost(chromo.main) : 0;
  let mutations = 0;
  for (const socket of Object.keys(chromo.placed)) {
    const held = chromo.placed[socket];
    if (!MUTATIONS[held.id]) continue;
    mutations += MUTATION_COST * (QUALITY_COST[held.quality] ?? 1);
  }
  const cuts = cutCost(chromo.cut.length);
  return { main, mutations, cuts, total: main + mutations + cuts };
}

// ---------- Convenience for callers ----------

/** A chromosome with every edge established and nothing cut. */
export function fullyConnected(layoutId = 'baseline'): Chromosome {
  const layout = LAYOUTS[layoutId] ?? LAYOUTS.baseline;
  return {
    layout: layout.id,
    main: null,
    placed: {},
    established: layout.edges.map((e) => edgeKey(e.a, e.b)),
    cut: [],
  };
}

/** Every route currently reaching a given arm, strongest first. */
export function reaching(res: ChromosomeResolution, arm: MutagenArm): RoutedContribution[] {
  return [...res.arms[arm].contributions].sort(
    (x, y) => contributionWeight(y, res.ceiling) - contributionWeight(x, res.ceiling),
  );
}

// ---------- Rekeying: changing WHAT, never how much ----------

/**
 * THE BODY'S WEAK POINTS, in the order a nuclease rewrites them.
 *
 * A vulnerability is two different shapes of data, and both are genuinely one:
 *
 *  - a **negative resistance** in the gene's `base` — the troll's −25% heat,
 *    which combat.ts reads as "(vulnerable!)" below −0.15; and
 *  - a **dousing type** on a conferred condition — what interrupts a body that
 *    knits itself shut.
 *
 * Authored order, resistances first, because that is the order they read on the
 * card. `nth` is what the index rule matches against: the nearest rekeying
 * route rewrites the first, the next the second, and a body with no weak points
 * is rewritten not at all — there is nothing to point the nuclease at.
 */
export interface WeakPoint {
  /** Where it lives, so the rewrite knows what to edit. */
  where: 'base' | 'douses';
  arm?: MutagenArm;
  /** Index within that arm's base mods, for `where: 'base'`. */
  at?: number;
  /** Index within the conferred application's dousing types, for `douses`. */
  confers?: number;
  typeAt?: number;
  type: DamageType;
}

const TYPE_BY_RES_STAT: Record<string, DamageType> = Object.fromEntries(
  Object.entries(RES_STAT_BY_TYPE).map(([type, stat]) => [stat, type as DamageType]),
);

export function weakPointsOf(def: MainGeneDef): WeakPoint[] {
  const out: WeakPoint[] = [];
  for (const arm of ARMS) {
    const mods = def.base?.[arm] ?? [];
    for (let at = 0; at < mods.length; at++) {
      const mod = mods[at];
      const type = TYPE_BY_RES_STAT[mod.stat];
      if (type && mod.value < 0) out.push({ where: 'base', arm, at, type });
    }
  }
  for (let confers = 0; confers < (def.confers ?? []).length; confers++) {
    const rules = def.confers![confers].removal ?? [];
    for (const rule of rules) {
      for (let typeAt = 0; typeAt < (rule.damageTypes ?? []).length; typeAt++) {
        out.push({ where: 'douses', confers, typeAt, type: rule.damageTypes![typeAt] });
      }
    }
  }
  return out;
}

/**
 * The expressed gene with every routed rekey written into it.
 *
 * Deep-copied on the way, because the def is shared CONTENT — rewriting it in
 * place would rekey the species for every save in the process, which is the
 * kind of bug that only shows up on the second character.
 *
 * The index rule is the player's: rekeying routes are taken NEAREST FIRST (by
 * hops to the centromere, the same distance routing already minimises) and
 * matched one-to-one against the body's weak points in order. Surplus routes
 * past the last weak point do nothing, which is the honest outcome — there was
 * nothing left to rewrite.
 */
export function rekeyGene(def: MainGeneDef, rekeys: DamageType[]): MainGeneDef {
  if (!rekeys.length) return def;
  const points = weakPointsOf(def);
  if (!points.length) return def;
  const next: MainGeneDef = {
    ...def,
    base: Object.fromEntries(
      Object.entries(def.base ?? {}).map(([arm, mods]) => [arm, mods.map((m) => ({ ...m }))]),
    ),
    confers: (def.confers ?? []).map((app) => ({
      ...app,
      removal: app.removal?.map((r) => ({ ...r, damageTypes: r.damageTypes?.slice() })),
    })),
  };
  for (let i = 0; i < Math.min(rekeys.length, points.length); i++) {
    const point = points[i];
    const to = rekeys[i];
    if (point.where === 'base') {
      const mod = next.base![point.arm!]![point.at!];
      // The MAGNITUDE is untouched. A −25% heat weakness becomes a −25% cold
      // one; that is the whole of what a nuclease does.
      mod.stat = RES_STAT_BY_TYPE[to];
    } else {
      const rule = next.confers![point.confers!].removal!.find((r) => r.damageTypes);
      if (rule?.damageTypes) rule.damageTypes[point.typeAt!] = to;
    }
  }
  return next;
}

// ---------- What actually lands ----------
//
// §11 says legibility is a mechanic, and the way a readout starts lying about
// the thing it describes is by computing it a second time. Everything below is
// the ONE answer to "what did the graph deliver": `chromosomeMods` builds the
// character's stats out of it, and the panel prints the same objects.

/**
 * What one route's modifiers get multiplied by when they arrive: how far the
 * effect travelled, clamped by what the main gene can carry, times whatever the
 * splits along the way left of it.
 */
export function contributionWeight(c: RoutedContribution, ceiling: number): number {
  return Math.min(c.magnitude, ceiling) * c.share;
}

/** Whether the gene's ceiling actually bit this route, rather than merely applying. */
export function isClamped(c: RoutedContribution, ceiling: number): boolean {
  return c.magnitude > ceiling;
}

/** One route's modifiers AS THEY LAND — already scaled by its weight. */
export function deliveredBy(c: RoutedContribution, ceiling: number): Modifier[] {
  const weight = contributionWeight(c, ceiling);
  if (weight <= 0) return [];
  // `fromStat` rides along untouched: what the graph scales is how MUCH of the
  // source stat converts, not which stat it reads.
  return (c.arrived.mods ?? []).map((m) => ({ ...m, value: m.value * weight }));
}

/**
 * WHETHER ANYTHING ACTUALLY ASKS ABOUT THIS CAPABILITY — and it depends on
 * where it landed, which is the whole of §12.2's remaining half.
 *
 * `arms:+N` and `onehand:*` are read by systems/wield.ts wherever they arrive,
 * because equipment rules ask `bearerGrants` and never care which door a thing
 * came through. Those readers are all player-shaped (they take a `GameState`
 * and read `state.equipment`), which is why the whole `arms:`/`onehand:`/
 * `telekinetic:` family is inert on a monster without anything being done to
 * make it so — see docs/plans/genome-capability-rule.md. The mutagen family is read only by `applyActiveArm`, so the
 * same Bouncing Mutation that splits your bite in the Active arm does nothing
 * whatsoever in Attacks.
 *
 * That asymmetry is worth stating rather than hiding: it is a routing puzzle
 * with a right answer, and a player who cannot see it just spends capacity on
 * a socket that was never listening.
 */
export function grantIsLive(grant: string, arm?: MutagenArm, spec?: GeneSpec | null): boolean {
  if (
    grant.startsWith('arms:+') ||
    grant.startsWith('onehand:') ||
    grant.startsWith('telekinetic:')
  ) {
    return true;
  }
  /*
   * In ACTIVE the reader is the ability itself, so "does this arm read it" is
   * only half the question — the other half is whether there IS an ability, and
   * whether that ability's shape can carry the trick (`abilityCarries`). A body
   * with no active tool used to be told its routed conditions were live; so did
   * a volley, which lands no blow for a split or a brand to ride.
   *
   * `spec === undefined` means the caller does not know, and asks the weaker
   * question — "could anything, anywhere, read this?" — which is the right
   * answer for an inventory tooltip with no body in front of it. `null` means
   * the caller looked and found no ability, which is a different answer.
   */
  const active = (can: (c: ReturnType<typeof abilityCarries>) => boolean) => {
    if (arm !== undefined && arm !== 'active') return false;
    if (spec === undefined) return true;
    return !!spec && can(abilityCarries(spec));
  };
  // Read in ACTIVE (they shape the gene's ability) and in ATTACKS (they shape
  // your ordinary swing) — the same capability, said about two different blows.
  if (grant === 'ignores_dodge') return arm === 'attacks' || active((c) => c.sure);
  if (grant === 'splits_target') return arm === 'attacks' || active((c) => c.splash);
  // A condition needs something that LEAVES conditions, which is the ability.
  if (grant.startsWith('inflicts_') && STATUSES[grant.slice('inflicts_'.length)]) {
    return active((c) => c.inflicts);
  }
  return false;
}

/**
 * Every capability that is actually DOING something right now: the main gene's,
 * plus routed ones that landed in an arm which reads them.
 *
 * Distinct from `bearerGrants`, which unions everything the graph delivered
 * regardless of whether a system asks — equipment needs that wider set, and the
 * panel needs this narrower one so it never promises a trick you do not have.
 */
export function liveGrants(bearer: Bearer): ReadonlySet<string> {
  const chromo = genomeOf(bearer);
  const out = new Set(MAIN_GENES[expressedMain(chromo).id]?.grants ?? []);
  const res = resolveChromosome(chromo);
  // The resolved ability, so an Active-arm capability is judged against the tool
  // that would have to read it — `null` when this body has no tool at all,
  // which is a real answer and not an absence of one.
  const tool = geneAbility(bearer);
  const spec = tool?.spec.type === 'gene' ? tool.spec : null;
  for (const arm of ARMS) {
    for (const g of res.arms[arm].grants) if (grantIsLive(g, arm, spec)) out.add(g);
  }
  return out;
}

/** Everything routing put into one arm, folded the way the stat pipeline folds it. */
export interface ArmDelivery {
  /** Summed modifiers: flats add, multipliers compound — as derived.ts does. */
  mods: Modifier[];
  /** Capabilities that arrived, live or not. */
  grants: string[];
  /** Damage types that arrived. Read by nothing today — §12.1. */
  types: DamageType[];
  /** Routes that reached this arm carrying no modifier at all. */
  silent: number;
}

export function armDelivery(res: ChromosomeResolution, arm: MutagenArm): ArmDelivery {
  const groups = new Map<string, Modifier>();
  const grants: string[] = [];
  const types: DamageType[] = [];
  let silent = 0;
  for (const c of res.arms[arm].contributions) {
    const mods = deliveredBy(c, res.ceiling);
    if (!mods.length) silent += 1;
    for (const mod of mods) {
      // Conditions are part of a modifier's identity: a troll's bone-weapon
      // damage and its bludgeon-derived damage are both `damage|mult` and are
      // emphatically not the same line.
      const key = [
        mod.stat,
        mod.op,
        mod.fromStat,
        mod.requiresTag,
        mod.requiresStyle,
        mod.requiresMonsterTag,
      ].join('|');
      const seen = groups.get(key);
      if (!seen) groups.set(key, { ...mod });
      else if (mod.op === 'mult') seen.value = (1 + seen.value) * (1 + mod.value) - 1;
      else seen.value += mod.value;
    }
    for (const g of c.arrived.grants ?? []) if (!grants.includes(g)) grants.push(g);
    if (c.arrived.type && !types.includes(c.arrived.type)) types.push(c.arrived.type);
  }
  return { mods: [...groups.values()], grants, types, silent };
}

// ================= Stateful side =================
//
// Everything above is pure. Everything below touches GameState.

// ---------- Tuning ----------

/** Capacity the pool starts at, and what each Geneshaping level adds. */
export const CAPACITY_BASE = 20;
export const CAPACITY_PER_LEVEL = 1.5;

/** Per-kill drop odds, before the skill tilts them. */
export const GENE_DROP_BASE = 0.02;
export const MUTAGEN_DROP_BASE = 0.03;
export const BIOMATTER_DROP = 0.25;
export const DROP_PER_LEVEL = 0.0005;

/**
 * Discovery payouts ESCALATE with how much of the book is already filled, which
 * is the compounding the design asks for — and it lives here, in the payout,
 * rather than in the level curve, because a number the player can see is the
 * only kind that rewards the behaviour it is meant to encourage. Genes climb
 * faster than mutagens: they are the exhaustive long tail.
 */
export const GENE_DISCOVERY_GROWTH = 1.15;
export const MUTAGEN_DISCOVERY_GROWTH = 1.08;

/**
 * What rewriting the centromere costs.
 *
 * §8 says being a monster is a commitment *because stopping is one*, and that
 * used to be enforced by bare being a manufactured item you might not have.
 * Bare is a free floor now, so the cost had to move onto the SWAP itself or
 * there would be no commitment left — you could shrug off a bad body mid-fight
 * and put it back afterwards.
 *
 * Two costs, doing two different jobs. Biomatter makes it expensive, and scales
 * with what you are putting on: rewriting yourself into a jötunn is a bigger
 * job than into a slime. The settling period makes it DELIBERATE — the body has
 * to take, and nothing about the centromere can be touched until it has.
 */
export const SWAP_BIOMATTER_PER_CAPACITY = 0.6;
export const SWAP_SETTLE_TICKS = 600;
/** Keyed into `state.useCooldowns`, which already exists — so no save change. */
export const SWAP_COOLDOWN_KEY = 'centromere';

export function swapBiomatterCost(gene: GeneInstance): number {
  return Math.max(1, Math.round(mainCost(gene) * SWAP_BIOMATTER_PER_CAPACITY));
}

/**
 * Debug: when set, the centromere never has to settle.
 *
 * A MODULE flag rather than a field on the save. Settling is a property of the
 * game's rules, not of a character — putting a switch for it in `GameState`
 * would mean a save migration, a field every future reader has to know about,
 * and a real player's file carrying a testing convenience forever. The core
 * never reads `localStorage`; the debug panel owns persisting it and pushes
 * the value in, the same division `DEBUG_START_KEY` uses.
 */
let skipSettling = false;

export function setSkipSettling(on: boolean): void {
  skipSettling = on;
}

export function skippingSettling(): boolean {
  return skipSettling;
}

/** Ticks left before the centromere can be touched again. */
export function settlingLeft(state: GameState): number {
  if (skipSettling) return 0;
  return Math.max(0, (state.useCooldowns?.[SWAP_COOLDOWN_KEY] ?? 0) - state.totalTicks);
}

function beginSettling(state: GameState): void {
  state.useCooldowns ??= {};
  state.useCooldowns[SWAP_COOLDOWN_KEY] = state.totalTicks + SWAP_SETTLE_TICKS;
}

/** Same-grade copies consumed to push one of them up a grade. */
export const REFINE_COPIES = 2;
/** Biomatter a refinement burns, and how much worse that gets per grade. */
export const REFINE_BIOMATTER_BASE = 4;
export const REFINE_BIOMATTER_GROWTH = 1.9;

// ---------- Access ----------

/**
 * The PLAYER's chromosome, for the half of this module that WRITES one.
 *
 * `genomeOf` is the read-side accessor and takes any bearer; this is the
 * write-side one and deliberately does not. Slotting, placing, cutting,
 * establishing, refining and fusing are the player's crafting workflow, not a
 * property of wearing a body — a monster does not shape its chromosome, it
 * simply is one. Keeping the narrow name on the narrow half is what stops a
 * monster-side capacity pool from ever looking like the obvious next step.
 */
export function chromosomeOf(state: GameState): Chromosome {
  return state.mutagens.chromosome;
}

export function geneshapingLevel(state: GameState): number {
  return state.skills.geneshaping?.level ?? 0;
}

/** The whole pool. Everything the chromosome holds is spent against this. */
export function capacityLimit(state: GameState): number {
  return CAPACITY_BASE + geneshapingLevel(state) * CAPACITY_PER_LEVEL;
}

export function capacityFree(state: GameState): number {
  return capacityLimit(state) - capacityUsed(chromosomeOf(state)).total;
}

export interface MutagenCheck {
  ok: boolean;
  reason?: string;
}

/** Whether a change leaving the chromosome in `next` shape would fit the pool. */
function fits(state: GameState, next: Chromosome): MutagenCheck {
  const use = capacityUsed(next).total;
  const limit = capacityLimit(state);
  if (use > limit) {
    return {
      ok: false,
      reason: text('mutagens.reason.over_capacity', { use: use.toFixed(1), limit: limit.toFixed(1) }),
    };
  }
  return { ok: true };
}

// ---------- Opening the system ----------

/**
 * What the quest hands over: a centromere, one upper arm, and one lower.
 *
 * A complete body with write-access to two of its four aspects — expansion buys
 * the other two. The lower arm is a genuine first choice, because `g` and `i`
 * carry attacks and defenses respectively.
 */
export function unlockMutagens(state: GameState, bus: EventBus, lowerArm: 'g' | 'i' = 'g'): void {
  const mut = state.mutagens;
  if (mut.unlocked) return;
  mut.unlocked = true;
  mut.chromosome.established = startingKit(lowerArm);
  bus.emit({
    type: 'log',
    msg: text('mutagens.unlocked'),
    kind: 'action',
  });
}

// ---------- Acquisition ----------

/** The one gene a species carries. One species, one gene, tier fixed forever. */
export function geneFrom(monsterId: string): MainGeneDef | undefined {
  return Object.values(MAIN_GENES).find((g) => g.from === monsterId);
}

/**
 * Mutagens key on a monster TAG, never a species — a flaming rat and a flaming
 * ogre carry the same one. That asymmetry is the whole collection design: most
 * mutagens turn up off a handful of species, while the gene list needs the
 * entire bestiary.
 */
export function mutagensFrom(tags: ReadonlySet<string>): MutagenDef[] {
  // Fused ones are never FOUND — a nuclease and a mutation are found, and the
  // culture bench is what puts them together. Dropping the result would make
  // the bench optional and the fusion pointless.
  return Object.values(MUTATIONS).filter((m) => !m.rekey && m.from && tags.has(m.from));
}

/** Nucleases a kill could be carrying. Same tag key as everything else here. */
export function nucleasesFrom(tags: ReadonlySet<string>): NucleaseDef[] {
  return Object.values(NUCLEASES).filter((n) => n.from && tags.has(n.from));
}

/** Rarer than a mutagen: one nuclease reshapes every body you will ever wear. */
export const NUCLEASE_DROP_BASE = 0.012;

function discover(
  state: GameState,
  bus: EventBus,
  kind: 'genes' | 'mutagens',
  id: string,
  name: string,
): void {
  const book = state.mutagens.known[kind];
  if (book.includes(id)) return;
  const growth = kind === 'genes' ? GENE_DISCOVERY_GROWTH : MUTAGEN_DISCOVERY_GROWTH;
  // The nth entry pays more than the (n−1)th: rarer finds, larger payouts.
  const weight = Math.pow(growth, book.length);
  book.push(id);
  grantDiscoveryXp(state, bus, 'geneshaping', weight);
  bus.emit({ type: 'log', msg: text('mutagens.catalogued', { name }), kind: 'bestiary' });
}

/**
 * Roll one kill for what it was carrying. Registered on the `kill` event rather
 * than called from combat.ts, exactly as the bestiary is — the combat path
 * should not have to know this system exists.
 *
 * Everything here but the biomatter is rare enough to drought, so the three
 * rare rolls go through mercy (engine/mercy.ts), keyed per monster and per
 * thing — the harvest is the most farmed loop in the game and the one where a
 * dry spell is felt hardest. Biomatter at a quarter of all kills needs no help.
 */
export function harvestKill(state: GameState, bus: EventBus, monsterId: string): void {
  if (!state.mutagens.unlocked) return;
  const level = geneshapingLevel(state);
  const luck = getDerivedStats(state).loot;
  const tilt = level * DROP_PER_LEVEL;

  if (chance(state, BIOMATTER_DROP + tilt)) {
    grantMaterial(state, 'biomatter', 1 + Math.floor(rand(state) * 3));
    grantSkillXp(state, bus, ['craft', 'geneshaping'], 2);
  }

  const gene = geneFrom(monsterId);
  if (gene && mercyChance(state, `gene:${monsterId}:${gene.id}`, GENE_DROP_BASE + tilt)) {
    const quality = rollQuality(state, luck);
    grantGraded(state, gene.id, quality, 1);
    discover(state, bus, 'genes', gene.id, gene.name);
    grantSkillXp(state, bus, ['craft', 'geneshaping'], 12, gene.id);
    bus.emit({
      type: 'log',
      msg: text('mutagens.gene_recovered', { icon: gene.icon, name: gene.name, grade: QUALITY_TIERS[quality].name }),
      kind: 'loot',
    });
  }

  for (const mutagen of mutagensFrom(monsterTagSet(monsterId))) {
    if (!mercyChance(state, `mutagen:${monsterId}:${mutagen.id}`, MUTAGEN_DROP_BASE + tilt)) continue;
    const quality = rollQuality(state, luck);
    grantGraded(state, mutagen.id, quality, 1);
    discover(state, bus, 'mutagens', mutagen.id, mutagen.name);
    grantSkillXp(state, bus, ['craft', 'geneshaping'], 6, mutagen.id);
    bus.emit({
      type: 'log',
      msg: text('mutagens.mutagen_recovered', { icon: mutagen.icon, name: mutagen.name, grade: QUALITY_TIERS[quality].name }),
      kind: 'loot',
    });
  }

  for (const nuclease of nucleasesFrom(monsterTagSet(monsterId))) {
    if (!mercyChance(state, `nuclease:${monsterId}:${nuclease.id}`, NUCLEASE_DROP_BASE + tilt)) continue;
    // Ungraded, so it goes in as a plain material rather than through the
    // graded stock — there is no quality for a thing that carries no magnitude.
    grantMaterial(state, nuclease.id, 1);
    grantSkillXp(state, bus, ['craft', 'geneshaping'], 20, nuclease.id);
    bus.emit({
      type: 'log',
      msg: text('mutagens.nuclease_recovered', { icon: nuclease.icon, name: nuclease.name }),
      kind: 'loot',
    });
  }
}

export function registerMutagenListeners(state: GameState, bus: EventBus): void {
  bus.on('kill', (ev) => harvestKill(state, bus, ev.monster.defId));
}

// ---------- Refinement ----------

/**
 * Histones a connection costs, scaled by how long it is.
 *
 * Length has to be paid for or it is a free lunch: a 9μm ring edge delivers
 * three times the intensity of a 3μm cluster edge, and if both cost the same
 * there is never a reason to prefer the short one. Charging by the micrometre
 * makes the premium geography genuinely premium, and it is why expansion is
 * paced rather than merely gated.
 */
export function histoneCost(edge: ChromosomeEdge): number {
  return Math.max(1, Math.round(HISTONE_PER_BASELINE * (edge.length / BASELINE_EDGE)));
}

/** Histones one baseline-length connection costs. Longer edges scale up. */
export const HISTONE_PER_BASELINE = 3;

/** Biomatter a push into `target` costs. Steeper the closer to the top. */
export function refineCost(target: QualityTier): number {
  return Math.round(REFINE_BIOMATTER_BASE * Math.pow(REFINE_BIOMATTER_GROWTH, qualityRank(target)));
}

export function nextGrade(quality: QualityTier): QualityTier | null {
  return QUALITY_ORDER[qualityRank(quality) + 1] ?? null;
}

export function canRefine(state: GameState, id: string, from: QualityTier): MutagenCheck {
  if (!state.mutagens.unlocked) return { ok: false, reason: text('mutagens.reason.not_unlocked') };
  const target = nextGrade(from);
  if (!target) return { ok: false, reason: text('mutagens.reason.refine_ceiling') };
  if (stockOf(state, id, from) < REFINE_COPIES) {
    return { ok: false, reason: text('mutagens.reason.refine_copies', { copies: REFINE_COPIES }) };
  }
  const cost = refineCost(target);
  if ((state.materials.biomatter ?? 0) < cost) {
    return { ok: false, reason: text('mutagens.reason.refine_needs_biomatter', { cost }) };
  }
  return { ok: true };
}

/**
 * Push one grade up. Quality is the ONLY thing this moves — a hill giant gene
 * refined to Divine is still a hill giant gene, and no amount of bench work
 * makes it a cyclops. Tier is a property of the species that carried it and is
 * fixed at the drop forever, which is what keeps exploration and grinding from
 * substituting for each other.
 */
export function refine(
  state: GameState,
  bus: EventBus,
  id: string,
  from: QualityTier,
): QualityTier | null {
  const check = canRefine(state, id, from);
  if (!check.ok) {
    if (check.reason) bus.emit({ type: 'log', msg: text('common.locked', { reason: check.reason }), kind: 'danger' });
    return null;
  }
  const target = nextGrade(from)!;
  for (let i = 0; i < REFINE_COPIES; i++) takeGraded(state, id, from, 1);
  state.materials.biomatter = (state.materials.biomatter ?? 0) - refineCost(target);
  grantGraded(state, id, target, 1);

  const def = MAIN_GENES[id] ?? MUTATIONS[id];
  grantSkillXp(state, bus, ['craft', 'geneshaping'], 8 * (qualityRank(target) + 1), id);
  bus.emit({
    type: 'log',
    msg: text('mutagens.refined', { icon: def?.icon ?? '', name: def?.name ?? id, grade: QUALITY_TIERS[target].name }),
    kind: 'item',
  });
  return target;
}

// ---------- Fusion: putting a nuclease into a mutation ----------

/** Biomatter one fusion burns. Flat: a rekey has no magnitude to price. */
export const FUSE_BIOMATTER = 12;

/**
 * The grade every fused mutagen is produced at — the neutral one, so capacity
 * charges it a flat `MUTATION_COST` (QUALITY_COST.c is exactly 1). A rekey has
 * no magnitude, so there is nothing for a grade to mean.
 */
export const FUSED_GRADE: QualityTier = 'c';

/**
 * The fused mutagen a pairing produces, or undefined if they do not pair.
 *
 * Keyed on the mutation's ELEMENT, never on the mutation: the nuclease is the
 * product and the mutation is spent for its elemental tag alone, so a Venom
 * Edge and a Miasma Brand both make the one Poison Vulnerability. Everything
 * else the parent did is lost in the fusing.
 */
export function fusionOf(nucleaseId: string, mutagenId: string): MutagenDef | undefined {
  const parent = MUTATIONS[mutagenId];
  const element = parent && !parent.rekey ? elementOf(parent) : undefined;
  return element ? MUTATIONS[`${nucleaseId}_${element}`] : undefined;
}

export function canFuse(
  state: GameState,
  nucleaseId: string,
  mutagenId: string,
  quality: QualityTier,
): MutagenCheck {
  if (!state.mutagens.unlocked) return { ok: false, reason: text('mutagens.reason.not_unlocked') };
  if (!NUCLEASES[nucleaseId]) return { ok: false, reason: text('mutagens.reason.not_a_nuclease') };
  if (!fusionOf(nucleaseId, mutagenId)) {
    // The pairing rule, said plainly: a nuclease names an operation and the
    // MUTATION supplies the element it writes, so one that speaks for no
    // element has nothing to give it.
    return { ok: false, reason: text('mutagens.reason.no_element') };
  }
  if ((state.materials[nucleaseId] ?? 0) < 1) return { ok: false, reason: text('mutagens.reason.no_nuclease_held') };
  if (stockOf(state, mutagenId, quality) < 1) return { ok: false, reason: text('mutagens.reason.none_held') };
  if ((state.materials.biomatter ?? 0) < FUSE_BIOMATTER) {
    return { ok: false, reason: text('mutagens.reason.fuse_needs_biomatter', { cost: FUSE_BIOMATTER }) };
  }
  return { ok: true };
}

/**
 * Fuse a nuclease into a mutation.
 *
 * The result is produced at C — the neutral grade — because it carries no
 * magnitude for a grade to scale. Deliberately NOT the subject's grade: that
 * would put a number on the product that changes nothing, which is the trap
 * mutagen quality itself was in, and it would make refining a mutation before
 * fusing it look like an upgrade. It also means the honest thing to fuse is
 * your WORST spare, which gives junk grades a use.
 */
export function fuse(
  state: GameState,
  bus: EventBus,
  nucleaseId: string,
  mutagenId: string,
  quality: QualityTier,
): MutagenDef | null {
  const check = canFuse(state, nucleaseId, mutagenId, quality);
  if (!check.ok) {
    if (check.reason) bus.emit({ type: 'log', msg: text('common.locked', { reason: check.reason }), kind: 'danger' });
    return null;
  }
  const fused = fusionOf(nucleaseId, mutagenId)!;
  state.materials[nucleaseId] = (state.materials[nucleaseId] ?? 0) - 1;
  state.materials.biomatter = (state.materials.biomatter ?? 0) - FUSE_BIOMATTER;
  takeGraded(state, mutagenId, quality, 1);
  grantGraded(state, fused.id, FUSED_GRADE, 1);
  grantSkillXp(state, bus, ['craft', 'geneshaping'], 25, fused.id);
  bus.emit({
    type: 'log',
    msg: text('mutagens.fused', { icon: fused.icon, name: fused.name }),
    kind: 'item',
  });
  return fused;
}

// ---------- The bench ----------

/**
 * The refining bench, worked through the ordinary run loop.
 *
 * A refining bench is a different shape from the other two: its one slot holds
 * the SUBJECT rather than an ingredient, and what comes out replaces what went
 * in. So these two adapters are all benchwork needs — read the subject out of
 * the placement, and answer the same `{ ok, reason }` the other benches do.
 */
export function previewRefine(state: GameState, placement: Placement): MutagenCheck {
  const subject = placement.subject;
  if (!subject) return { ok: false, reason: text('mutagens.reason.bench_empty') };
  return canRefine(state, subject.id, subject.quality);
}

/** One pass of the bench. Null stops the run, exactly like a failed craft. */
export function refineOnce(
  state: GameState,
  bus: EventBus,
  placement: Placement,
): QualityTier | null {
  const subject = placement.subject;
  if (!subject) return null;
  const got = refine(state, bus, subject.id, subject.quality);
  // A run refines the SAME grade repeatedly — the placement still names the
  // grade it started from, and the next pass wants two more of those. It stops
  // on its own once the stock of that grade runs dry, which is the honest
  // behaviour: a bench cannot chase its own output up the ladder unattended.
  return got;
}

// ---------- Editing the chromosome ----------

/**
 * Every op below takes the same shape: build what the chromosome WOULD be, ask
 * whether it fits the pool, and only then commit. That keeps capacity a single
 * check in one place rather than a rule each operation has to remember, and it
 * means a refused edit changes nothing at all.
 */
function commit(state: GameState, next: Chromosome, bus?: EventBus): MutagenCheck {
  const check = fits(state, next);
  if (!check.ok) {
    if (bus && check.reason) bus.emit({ type: 'log', msg: text('common.locked', { reason: check.reason }), kind: 'danger' });
    return check;
  }
  state.mutagens.chromosome = next;
  return { ok: true };
}

/** Whether the centromere could take this gene right now, and what it wants. */
export function canSlotMain(state: GameState, gene: GeneInstance): MutagenCheck {
  if (!MAIN_GENES[gene.id]) return { ok: false, reason: text('mutagens.reason.not_a_main_gene') };
  if (stockOf(state, gene.id, gene.quality) < 1) {
    return { ok: false, reason: text('mutagens.reason.none_held') };
  }
  const settling = settlingLeft(state);
  if (settling > 0) {
    return { ok: false, reason: text('mutagens.reason.settling', { seconds: (settling / 10).toFixed(0) }) };
  }
  const cost = swapBiomatterCost(gene);
  if ((state.materials.biomatter ?? 0) < cost) {
    return { ok: false, reason: text('mutagens.reason.wear_needs_biomatter', { cost }) };
  }
  return { ok: true };
}

/**
 * Put a gene in the centromere, taking it from stock. Any previous one returns.
 *
 * Costs biomatter and starts a settling period — see SWAP_BIOMATTER_PER_CAPACITY.
 * Nothing is spent unless the whole thing goes through, so a refused swap is
 * free in every sense.
 */
export function slotMain(
  state: GameState,
  bus: EventBus,
  gene: GeneInstance,
): MutagenCheck {
  const allowed = canSlotMain(state, gene);
  if (!allowed.ok) {
    if (allowed.reason) bus.emit({ type: 'log', msg: text('common.locked', { reason: allowed.reason }), kind: 'danger' });
    return allowed;
  }
  const current = chromosomeOf(state);
  const next: Chromosome = { ...current, main: { ...gene } };
  const check = commit(state, next, bus);
  if (!check.ok) return check;

  const cost = swapBiomatterCost(gene);
  state.materials.biomatter = (state.materials.biomatter ?? 0) - cost;
  takeGraded(state, gene.id, gene.quality, 1);
  if (current.main) grantGraded(state, current.main.id, current.main.quality, 1);
  beginSettling(state);
  grantSkillXp(state, bus, ['craft', 'geneshaping'], 20 + cost);
  bus.emit({
    type: 'log',
    msg: text('mutagens.gene_worn', { icon: MAIN_GENES[gene.id].icon, name: MAIN_GENES[gene.id].name, cost, seconds: SWAP_SETTLE_TICKS / 10 }),
    kind: 'action',
  });
  return { ok: true };
}

/**
 * Take the main gene out and put it back in stock, reverting to the bare
 * sequence. Freeing capacity never fails.
 */
export function unslotMain(state: GameState): MutagenCheck {
  const current = chromosomeOf(state);
  const main = current.main;
  if (!main) return { ok: false, reason: text('mutagens.reason.already_own_sequence') };
  const settling = settlingLeft(state);
  if (settling > 0) {
    return { ok: false, reason: text('mutagens.reason.settling', { seconds: (settling / 10).toFixed(0) }) };
  }
  state.mutagens.chromosome = { ...current, main: null };
  grantGraded(state, main.id, main.quality, 1);
  // Falling back to your own sequence costs no material — you are not
  // manufacturing anything — but it still has to take. That is what stops a
  // bad body being shrugged off mid-fight and put back afterwards.
  beginSettling(state);
  return { ok: true };
}

/** Place a mutagen in a socket. Whatever was there goes back to stock. */
export function placeMutagen(
  state: GameState,
  bus: EventBus,
  socket: string,
  gene: GeneInstance,
): MutagenCheck {
  const current = chromosomeOf(state);
  if (!socketIds(layoutOf(current)).includes(socket)) return { ok: false, reason: text('mutagens.reason.no_such_socket') };
  if (!MUTATIONS[gene.id]) return { ok: false, reason: text('mutagens.reason.not_a_mutagen') };
  if (stockOf(state, gene.id, gene.quality) < 1) return { ok: false, reason: text('mutagens.reason.none_held') };
  const next: Chromosome = { ...current, placed: { ...current.placed, [socket]: { ...gene } } };
  const check = commit(state, next, bus);
  if (!check.ok) return check;
  takeGraded(state, gene.id, gene.quality, 1);
  const had = current.placed[socket];
  if (had) grantGraded(state, had.id, had.quality, 1);
  return { ok: true };
}

export function removeMutagen(state: GameState, socket: string): MutagenCheck {
  const current = chromosomeOf(state);
  const had = current.placed[socket];
  if (!had) return { ok: false, reason: text('mutagens.reason.socket_empty') };
  const placed = { ...current.placed };
  delete placed[socket];
  // Freeing capacity can never fail, so this commits unconditionally.
  state.mutagens.chromosome = { ...current, placed };
  grantGraded(state, had.id, had.quality, 1);
  return { ok: true };
}

/**
 * Pay for a connection. Permanent: there is no un-establishing, only cutting,
 * which is why this is the expensive half of the two and the cut is the cheap
 * reversible one.
 */
export function establish(state: GameState, bus: EventBus, a: string, b: string): MutagenCheck {
  const current = chromosomeOf(state);
  const key = edgeKey(a, b);
  const edge = layoutOf(current).edges.find((e) => edgeKey(e.a, e.b) === key);
  if (!edge) return { ok: false, reason: text('mutagens.reason.no_edge') };
  if (current.established.includes(key)) return { ok: false, reason: text('mutagens.reason.already_established') };

  const cost = histoneCost(edge);
  if ((state.materials.histone ?? 0) < cost) {
    return { ok: false, reason: text('mutagens.reason.histones_short', { cost, held: state.materials.histone ?? 0 }) };
  }
  const check = commit(state, { ...current, established: [...current.established, key] }, bus);
  if (!check.ok) return check;
  state.materials.histone = (state.materials.histone ?? 0) - cost;
  grantSkillXp(state, bus, ['craft', 'geneshaping'], 5 + cost);
  bus.emit({
    type: 'log',
    msg: text('mutagens.edge_coiled', { a, b, cost }),
    kind: 'action',
  });
  return { ok: true };
}

/** Switch an established connection off. Reversible, and reserves capacity. */
export function cutEdge(state: GameState, bus: EventBus, a: string, b: string): MutagenCheck {
  const current = chromosomeOf(state);
  const key = edgeKey(a, b);
  if (!current.established.includes(key)) return { ok: false, reason: text('mutagens.reason.edge_not_established') };
  if (current.cut.includes(key)) return { ok: false, reason: text('mutagens.reason.already_cut') };
  return commit(state, { ...current, cut: [...current.cut, key] }, bus);
}

/** Restore a cut connection, handing back the capacity it was reserving. */
export function restoreEdge(state: GameState, a: string, b: string): MutagenCheck {
  const current = chromosomeOf(state);
  const key = edgeKey(a, b);
  if (!current.cut.includes(key)) return { ok: false, reason: text('mutagens.reason.edge_not_cut') };
  state.mutagens.chromosome = { ...current, cut: current.cut.filter((k) => k !== key) };
  return { ok: true };
}

/** The live reading of what a bearer is currently wearing. */
export function currentResolution(bearer: Bearer): ChromosomeResolution {
  return resolveChromosome(genomeOf(bearer));
}

/**
 * Every modifier the chromosome contributes, for the stat pipeline.
 *
 * Two layers, and they are genuinely different things:
 *
 *  - **Base.** What the main gene simply IS in each arm — a slime's slashing
 *    resistance is true whether or not a single socket is filled.
 *  - **Routed.** What the graph delivered into that arm, each contribution
 *    scaled by its own `intensity × share` and clamped by the gene's ceiling.
 *    This is where distance, hops, splits and transforms finally become a
 *    number the character feels.
 *
 * Capabilities (`grants`) are deliberately absent: they are not stats, and the
 * systems that read them ask the resolution directly.
 *
 * ⚠️ **`arrived.type` is read here by nothing, and that is a known hole, not a
 * decision.** The retype chain is computed in `applyTransform` and printed by
 * the panel ("arrives as cold") — and then discarded, because what an arriving
 * damage type MEANS per arm is still open. See docs/MUTAGENS.md §12; the law
 * any answer has to satisfy is §7a. Do not quietly pick a meaning here.
 */
export function chromosomeMods(
  state: GameState,
  bearer: Bearer = state,
): { mod: Modifier; source: string }[] {
  const res = currentResolution(bearer);
  const out: { mod: Modifier; source: string }[] = [];
  const geneName = res.main?.name ?? 'Chromosome';

  for (const arm of Object.values(res.arms)) {
    for (const mod of arm.base ?? []) out.push({ mod, source: geneName });
    for (const c of arm.contributions) {
      // Through `deliveredBy`, which is also what the panel prints — the clamp
      // and the split are applied in exactly one place for both readers.
      for (const mod of deliveredBy(c, res.ceiling)) {
        out.push({ mod, source: `${c.gene.name} → ${arm.arm}` });
      }
    }
  }

  /*
   * A fast's DEFENCE arm cannot be authored into `base` like everything above:
   * it is paid by the hunger standing on the field, so its value moves during
   * the fight rather than being a property of the body.
   *
   * It joins the modifier path anyway rather than resolving at roll time,
   * because the thing it guards against — condition PENALTIES — are stat mods,
   * and stat mods only exist in here. That is affordable because the hunger
   * bucket is already part of `modFingerprint` whenever a body fasts.
   *
   * ⚠️ `fieldHunger` is computed INSIDE the guard, never as an argument to it:
   * an eager argument is how the regen hook briefly cost the whole game a
   * per-tick attribute resolution it never used.
   */
  const fast = fastOf(bearer);
  if (fast) {
    // The hunger is the FIELD's, read off the world; the fast that answers to
    // it is the bearer's. Both sides of a fight can be fasting on the same
    // field, and each reads its own arms against the one shared total.
    const guard = fastGuard(bearer, fieldHunger(state));
    if (guard.armor > 0) {
      out.push({
        mod: { stat: 'armor', op: 'add', value: guard.armor },
        source: `${geneName} → defenses`,
      });
    }
  }
  return out;
}
