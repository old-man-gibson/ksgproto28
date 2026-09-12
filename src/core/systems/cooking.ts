import type {
  CraftDisciplineDef,
  CraftOutcomeDef,
  CraftSlotDef,
  GameState,
  GradedStack,
  QualityTier,
} from '../types';
import type { EventBus } from '../engine/events';
import { DISCIPLINES } from '../data/disciplines.data';
import { MATERIALS } from '../data/materials.data';
import { PREPS, UNIFORMITY, preppedIdOf } from '../data/preps.data';
import { QUALITY_ORDER, QUALITY_TIERS, qualityMult, qualityRank } from '../data/quality.data';
import { rand } from '../engine/rng';
import { logRepeat } from './log';
import { checkDiscovery, grantSkillXp } from './skills';
import {
  checkCraft,
  consumePlacement,
  craftTagsOf,
  grantGraded,
  matchOutcome,
  noveltyKeys,
  placed,
  rollQuality,
  skillLevel,
  type Placement,
} from './disciplines';

/**
 * Cooking: the framework read from the other end.
 *
 * Runecarving has one outcome and finds its variety in the parts. Cooking has
 * many outcomes and finds the right one by looking at what went in the pot —
 * same slots, same grading, same skill gating, opposite emphasis.
 *
 * Cooking is also not ONE bench: the stove, the oven, the grill, the cold
 * counter and the cutting board are separate disciplines sharing the one
 * `cooking` skill, which is why everything here takes the discipline as a
 * parameter. A method earns its own bench by accepting different things and
 * making different things of them.
 *
 * What this module knows that the framework does not:
 *
 *  - A dish's GRADE comes out of the ingredients that made it — the recipe
 *    decides what you cooked, the basket decides how good it is.
 *  - A PREPPED ingredient's grade is its cut, and the cut is uniformity:
 *    perfect knife work contributes exactly what the ingredient is worth,
 *    rough work rolls somewhere inside its band (see data/preps.data.ts).
 *    That roll is why a basket with mid-grade cuts previews as a RANGE.
 *  - On a TIMED bench, WHEN an ingredient enters decides how much heat it
 *    sees, and each cut has an exposure it wants (see EXPOSURE below).
 *    Julienne goes in late or goes to waste; dice wants the whole simmer.
 *  - Each bench may favor one cut (`favoredPrep`), worth about a grade
 *    across a fully matched basket.
 */

export const COOKING = DISCIPLINES.cooking;

/** Every bench that cooks — i.e. runs on the cooking skill. */
export function cookingBenches(): CraftDisciplineDef[] {
  return Object.values(DISCIPLINES).filter((d) => d.skill === 'cooking');
}

// ---------- Exposure: what time on the heat does to a cut ----------

/**
 * The heat exposure each kind of cut wants, in timeline units: its band, and
 * the reward for landing inside it. Outside the band the contribution decays
 * toward EXPOSURE_FLOOR — undercooked below, overcooked above.
 *
 * `whole` is the fallback for unprepped food: a wide, forgiving band with no
 * reward on top. Timing mastery is what knife work UNLOCKS — a whole onion
 * cannot be brilliant, only fine, which keeps the novice's stew exactly as it
 * always was.
 */
export const EXPOSURE: Record<string, { band: [number, number]; peak: number }> = {
  julienned: { band: [2, 5], peak: 1.15 },
  sliced: { band: [3, 8], peak: 1.08 },
  diced: { band: [6, 16], peak: 1.12 },
  whole: { band: [3, 16], peak: 1 },
};

const EXPOSURE_FLOOR = 0.5;

function exposureProfile(materialId: string) {
  const tags = craftTagsOf(materialId);
  for (const key of Object.keys(EXPOSURE)) {
    if (key !== 'whole' && tags.includes(key)) return EXPOSURE[key];
  }
  return EXPOSURE.whole;
}

function fitOf(exposure: number, profile: { band: [number, number]; peak: number }): number {
  const [lo, hi] = profile.band;
  if (exposure >= lo && exposure <= hi) return profile.peak;
  if (exposure < lo) {
    // Undercooked: hasn't given what it had. Scales with how close it came.
    return EXPOSURE_FLOOR + (profile.peak - EXPOSURE_FLOOR) * (exposure / lo);
  }
  // Overcooked: decays by how far past the band it sat, measured in bandwidths.
  const over = (exposure - hi) / (hi - lo);
  return Math.max(EXPOSURE_FLOOR, profile.peak - over * (profile.peak - EXPOSURE_FLOOR));
}

/** The chosen duration, or the bench's default; 0 on untimed benches. */
function durationOf(disc: CraftDisciplineDef, duration?: number): number {
  return disc.timeline ? (duration ?? disc.timeline.default) : 0;
}

/**
 * The exposure multiplier for what sits in a slot. 1 everywhere except a
 * timed slot on a timed bench — seasoning and cookware stand outside time.
 */
function exposureFit(
  disc: CraftDisciplineDef,
  slot: CraftSlotDef | undefined,
  materialId: string,
  duration: number,
): number {
  if (!disc.timeline || slot?.at == null) return 1;
  return fitOf(duration * (1 - slot.at), exposureProfile(materialId));
}

/** For the UI: how a piece would fare in a slot, at a duration. */
export function exposureInfo(
  disc: CraftDisciplineDef,
  slot: CraftSlotDef,
  materialId: string,
  duration?: number,
): { exposure: number; fit: number; verdict: 'in its element' | 'undercooked' | 'overcooked' } | null {
  if (!disc.timeline || slot.at == null) return null;
  const units = durationOf(disc, duration);
  const exposure = units * (1 - slot.at);
  const profile = exposureProfile(materialId);
  const fit = fitOf(exposure, profile);
  const verdict =
    exposure < profile.band[0] ? 'undercooked' : exposure > profile.band[1] ? 'overcooked' : 'in its element';
  return { exposure, fit, verdict };
}

// ---------- Contribution: what each part puts into the dish ----------

export function isPrepped(materialId: string): boolean {
  return craftTagsOf(materialId).includes('prepped');
}

/**
 * The band a part's contribution can land in: its multiplier, scaled by the
 * cut's uniformity band (prepped only) and by its exposure fit (timed slots
 * only). A negative multiplier scales toward zero the same way — refuse
 * shredded or scorched into near-irrelevance rather than poisoning the pot
 * at full strength (the all-refuse mess outcome still fires either way,
 * since outcomes read stored grades, not contributions).
 */
function contributionBand(
  disc: CraftDisciplineDef,
  slot: CraftSlotDef | undefined,
  part: GradedStack,
  duration: number,
): [number, number] {
  const scaled = qualityMult(part.quality) * exposureFit(disc, slot, part.id, duration);
  if (!isPrepped(part.id)) return [scaled, scaled];
  const [lo, hi] = UNIFORMITY[part.quality];
  return scaled >= 0 ? [scaled * lo, scaled * hi] : [scaled * hi, scaled * lo];
}

/** The filled slots, paired with their definitions. */
function laidOut(
  disc: CraftDisciplineDef,
  placement: Placement,
): { slot: CraftSlotDef | undefined; part: GradedStack }[] {
  return Object.entries(placement)
    .filter((e): e is [string, GradedStack] => !!e[1])
    .map(([slotId, part]) => ({ slot: disc.slots.find((s) => s.id === slotId), part }));
}

/**
 * The bench-fit bonus: the share of the basket cut the way this bench likes,
 * worth up to ~one grade when everything matches. There is no mismatch
 * penalty — the wrong cut merely goes unnoticed.
 */
function prepFitBonus(disc: CraftDisciplineDef, parts: GradedStack[]): number {
  if (!disc.favoredPrep || !parts.length) return 0;
  const matched = parts.filter((p) => craftTagsOf(p.id).includes(disc.favoredPrep!)).length;
  return 0.6 * (matched / parts.length);
}

/** The tier whose own multiplier a combined value has earned, from below. */
function tierFor(value: number): QualityTier {
  let best: QualityTier = 'f';
  for (const tier of QUALITY_ORDER) {
    if (QUALITY_TIERS[tier].mult <= value + 1e-9) best = tier;
  }
  return best;
}

/** avg contribution + the cook's judgement + the bench-fit bonus. */
function basketNudge(state: GameState, disc: CraftDisciplineDef, parts: GradedStack[]): number {
  // Every fifteen levels is worth roughly a grade of judgement.
  return skillLevel(state, disc) / 15 + prepFitBonus(disc, parts);
}

/**
 * The grade a basket is guaranteed, floor of the range. With no prepped parts
 * the range collapses and this IS the grade — deterministic, as before.
 */
export function dishQuality(
  state: GameState,
  placement: Placement,
  disc: CraftDisciplineDef = COOKING,
  duration?: number,
): QualityTier {
  return dishQualityRange(state, placement, disc, duration).min;
}

/** What the basket can come out as: floor and ceiling of the uniformity rolls. */
export function dishQualityRange(
  state: GameState,
  placement: Placement,
  disc: CraftDisciplineDef = COOKING,
  duration?: number,
): { min: QualityTier; max: QualityTier } {
  const out = laidOut(disc, placement);
  if (!out.length) return { min: 'f', max: 'f' };
  const units = durationOf(disc, duration);
  let lo = 0;
  let hi = 0;
  for (const { slot, part } of out) {
    const [a, b] = contributionBand(disc, slot, part, units);
    lo += a;
    hi += b;
  }
  const nudge = basketNudge(state, disc, out.map((o) => o.part));
  return {
    min: tierFor(lo / out.length + nudge),
    max: tierFor(hi / out.length + nudge),
  };
}

/** Cook-time resolution: every prepped part rolls inside its own band. */
function rollDishQuality(
  state: GameState,
  placement: Placement,
  disc: CraftDisciplineDef,
  duration?: number,
): QualityTier {
  const out = laidOut(disc, placement);
  if (!out.length) return 'f';
  const units = durationOf(disc, duration);
  let sum = 0;
  for (const { slot, part } of out) {
    const [a, b] = contributionBand(disc, slot, part, units);
    sum += a === b ? a : a + rand(state) * (b - a);
  }
  return tierFor(sum / out.length + basketNudge(state, disc, out.map((o) => o.part)));
}

// ---------- Preview ----------

export interface CookCheck {
  ok: boolean;
  reason?: string;
  outcome?: CraftOutcomeDef;
  /** The grade the basket is guaranteed — the floor of the range. */
  quality?: QualityTier;
  /** The ceiling, when uniformity rolls leave a spread; absent when exact. */
  qualityHigh?: QualityTier;
  /** What will come out, at the grade(s) it can come out at. */
  label?: string;
}

/** The cutting board's placement, picked apart. Null when not that bench. */
function prepParts(disc: CraftDisciplineDef, placement: Placement) {
  const outcome = disc.outcomes.find((o) => o.result.kind === 'prepped');
  if (!outcome) return null;
  const base = disc.slots.find((s) => s.role === 'base');
  const design = disc.slots.find((s) => s.picks === 'design');
  if (!base || !design) return null;
  return { outcome, ingredient: placement[base.id], technique: placement[design.id] };
}

/** What this bench would produce as laid out, without spending anything. */
export function previewCook(
  state: GameState,
  placement: Placement,
  disc: CraftDisciplineDef = COOKING,
  duration?: number,
): CookCheck {
  const check = checkCraft(state, disc, placement);
  if (!check.ok) return { ok: false, reason: check.reason };

  const outcome = matchOutcome(state, disc, placement);
  if (!outcome) return { ok: false, reason: 'Nothing edible comes of this' };

  // The cutting board: same machinery in, a transformed ingredient out. The
  // cut grade is rolled at work time, so the preview promises only the cap —
  // the ingredient's own grade, which no knife exceeds.
  if (outcome.result.kind === 'prepped') {
    const parts = prepParts(disc, placement);
    if (!parts?.ingredient || !parts.technique) return { ok: false, reason: 'Lay out the board first' };
    const prep = PREPS[parts.technique.id];
    if (!prep) return { ok: false, reason: 'No such technique' };
    if ((prep.minLevel ?? 0) > skillLevel(state, disc)) {
      return { ok: false, reason: `Your hands do not know that cut yet (Cooking ${prep.minLevel})` };
    }
    const target = MATERIALS[preppedIdOf(parts.ingredient.id, prep.id)];
    if (!target) return { ok: false, reason: 'That does not take a knife' };
    const cap = parts.ingredient.quality;
    return {
      ok: true,
      outcome,
      quality: cap,
      label: `${target.name} — cut up to ${QUALITY_TIERS[cap].name}`,
    };
  }

  const { min, max } = dishQualityRange(state, placement, disc, duration);
  const dish = outcome.result.kind === 'material' ? MATERIALS[outcome.result.id] : undefined;
  const name = dish?.name ?? outcome.name;
  return {
    ok: true,
    outcome,
    quality: min,
    qualityHigh: min === max ? undefined : max,
    label:
      min === max
        ? `${QUALITY_TIERS[min].name} ${name}`
        : `${QUALITY_TIERS[min].name}–${QUALITY_TIERS[max].name} ${name}`,
  };
}

// ---------- Working the bench ----------

export interface CookResult {
  dish: string;
  quality: QualityTier;
  qty: number;
}

/**
 * Cook it. Spends the basket, resolves any uniformity rolls, stocks the dish
 * at the grade the ingredients earned, and pays the skill for the combination
 * and each ingredient in it.
 *
 * There is no failure roll: a bad basket produces a bad dish rather than
 * nothing, which is what the catch-all outcome is for. Losing the ingredients
 * to a die roll on top of that would be punishing twice for one mistake.
 */
export function cook(
  state: GameState,
  bus: EventBus,
  placement: Placement,
  disc: CraftDisciplineDef = COOKING,
  duration?: number,
): CookResult | null {
  const check = previewCook(state, placement, disc, duration);
  if (!check.ok || !check.outcome || !check.quality) {
    if (check.reason) bus.emit({ type: 'log', msg: `🔒 ${check.reason}`, kind: 'danger' });
    return null;
  }

  // The cutting board rolls its cut BEFORE spending — the roll needs the
  // ingredient's grade as its cap, and nothing about it can fail after.
  if (check.outcome.result.kind === 'prepped') {
    const parts = prepParts(disc, placement)!;
    const prep = PREPS[parts.technique!.id]!;
    const cap = parts.ingredient!.quality;
    // Skill steadies the hand the way luck steadies loot; the ingredient caps it.
    const rolled = rollQuality(state, 1 + skillLevel(state, disc) / 20);
    const cut = qualityRank(rolled) > qualityRank(cap) ? cap : rolled;

    if (!consumePlacement(state, disc, placement)) return null;
    const id = preppedIdOf(parts.ingredient!.id, prep.id);
    grantGraded(state, id, cut, 1);

    // A bench manifests the trade it teaches. It never did: `checkDiscovery`
    // was only ever reached from the craft ACTIVITY, whose bare 'craft' tag
    // every craft skill claimed — so cooking a stew manifested Smithing, and
    // the benches themselves manifested nothing. Now that each skill claims
    // only its own discipline, the bench has to say its own name.
    checkDiscovery(state, bus, [disc.tag]);
    grantSkillXp(
      state,
      bus,
      ['craft', disc.tag],
      disc.xp * (1 + qualityRank(cut) * 0.15),
      noveltyKeys(disc, placement),
    );
    const made = MATERIALS[id];
    // Quest familiarization hears bench work the same way it hears recipes.
    bus.emit({ type: 'craft', discipline: disc.id });
    // Groupable: a batch run folds into one tallied line instead of a page.
    logRepeat(bus, {
      group: `bench:${disc.id}`,
      prefix: '🔪 Prepared:',
      tally: [{ label: `${made?.icon ?? ''} ${QUALITY_TIERS[cut].name} ${made?.name ?? id}`.trim(), qty: 1 }],
      kind: 'item',
    });
    return { dish: id, quality: cut, qty: 1 };
  }

  if (!consumePlacement(state, disc, placement)) return null;

  const result = check.outcome.result;
  if (result.kind !== 'material') return null;
  const quality = rollDishQuality(state, placement, disc, duration);
  const qty = result.qty ?? 1;
  grantGraded(state, result.id, quality, qty);

  // A bench manifests the trade it teaches. It never did: `checkDiscovery`
  // was only ever reached from the craft ACTIVITY, whose bare 'craft' tag
  // every craft skill claimed — so cooking a stew manifested Smithing, and
  // the benches themselves manifested nothing. Now that each skill claims
  // only its own discipline, the bench has to say its own name.
  checkDiscovery(state, bus, [disc.tag]);
  grantSkillXp(
    state,
    bus,
    ['craft', disc.tag],
    disc.xp * (1 + placed(placement).length * 0.2) * (1 + qualityRank(quality) * 0.15),
    noveltyKeys(disc, placement),
  );

  const dish = MATERIALS[result.id];
  bus.emit({ type: 'craft', discipline: disc.id });
  logRepeat(bus, {
    group: `bench:${disc.id}`,
    prefix: `${dish?.icon ?? '🍽️'} Cooked:`,
    tally: [{ label: `${QUALITY_TIERS[quality].name} ${dish?.name ?? result.id}`, qty }],
    kind: 'item',
  });
  return { dish: result.id, quality, qty };
}
