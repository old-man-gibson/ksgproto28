import type {
  ConsumableSpec,
  DerivedStats,
  GameState,
  MaterialDef,
  QualityTier,
  StatusApplication,
  StatusInstance,
} from '../types';
import type { EventBus } from '../engine/events';
import { MATERIALS } from '../data/materials.data';
import { QUALITY_TIERS, qualityMult } from '../data/quality.data';
import { getDerivedStats } from './derived';
import { availableMax, resourceValue, restoreResource } from './resources';
import { heal } from './health';
import { applyStatus, findStatus, fireStatusEvent, statusesOf } from './statuses';
import { gradesHeld, knowsRecipe, recipeKey, recipeName, stockOf } from './disciplines';
import { bumpStat } from './achievements';
import { STATUSES, TECHNIQUES } from '../registry';
import { signatureEarned } from './cookbook';
import { dishHoldsSlot, mealToReplace, recordMeal, type MealLanding } from './meals';
import { isHarmful } from './conditionHarm';
import { learnTechnique, techniqueReachable } from './martial';
import { wordUnlocked, wordUnlockKey } from './unlocks';
import { checkTitleUnlocks } from './titles';
import { grantFavorAll } from './divine';

/** Votive tokens offered so far (systems/consumables.ts, the votive card). */
export const VOTIVE_KEY = 'votive:tokens';
/** Starting favor a newly met god receives (paid by `meetDeity`). */
export const VOTIVE_BASELINE_KEY = 'votive:baseline';
/** Favor held unassigned, placed on a god of your choice on the Divine tab. */
export const FLOATING_FAVOR_KEY = 'favor:floating';
/** What the first votive token gives every god, now and later. */
export const VOTIVE_FIRST_FAVOR = 2;

/**
 * Cards: consumables that are read (or offered) for a one-time effect rather
 * than eaten. They have no grade and none of the eating rules apply.
 */
export function isCard(spec: ConsumableSpec | undefined): boolean {
  return !!spec && !!(spec.teaches || spec.unlocksWord || spec.teachesTechnique || spec.stamps || spec.votive);
}

/**
 * Whether a card's effect has already happened — a recipe known, a word
 * lifted, a technique held in canonical form, a flag set. A spent card is
 * refused at use and never rolled as a rare find. The votive token never
 * spends: each one after the first is another floating favor.
 */
export function cardSpent(state: GameState, spec: ConsumableSpec | undefined): boolean {
  if (!spec) return false;
  if (spec.teaches) return knowsRecipe(state, spec.teaches);
  if (spec.unlocksWord) return wordUnlocked(state, spec.unlocksWord);
  if (spec.teachesTechnique) return state.techniques?.[spec.teachesTechnique]?.form === 'canonical';
  if (spec.stamps) return (state.stats[spec.stamps] ?? 0) >= 1;
  return false;
}
import { text } from '../text/log';

/**
 * Using things: food, potions, salves.
 *
 * The split that matters to a player is INSTANT versus SUSTAINED, and both are
 * expressed here without a duration system of their own:
 *
 *  - **Instant** is `restore` — the whole effect the moment you use it. A
 *    healing potion.
 *  - **Sustained** is `grants` — a status that feeds you across its lifetime.
 *    A cooked dish.
 *
 * Everything about how long a sustained effect lasts is the status's business,
 * which is why consumables get all three of the shapes conditions already
 * support for free: a set duration, one that runs until something happens to
 * you (`removal`), or one that never ends on its own (`'permanent'`).
 *
 * Quality scales the lot. A dish is a graded material, so the same recipe
 * cooked from better ingredients is simply a better grade of the same thing.
 *
 * Food (`ConsumableSpec.food`: what the cooking benches make) is scaled a second
 * time by the eater's cook: conditions last `foodDuration` times as long and land
 * `foodPotency` times as hard, and `restore` amounts follow potency. A dish the
 * player has cooked `SIGNATURE_COOKS` times also grants its `signature`.
 *
 * Food is eaten between fights only (`canUse`), and at most `dishLimit` dishes
 * are active at once: each food holds a slot (`recordMeal`, systems/meals.ts).
 * A dish pressed during a fight waits in a queue instead (systems/eating.ts).
 */

/** What eating something spoiled does to you, whatever it was meant to be. */
export const SPOILED = 'queasy';

/**
 * Spoiled dishes eaten so far (`isSpoiledFood`), a persistent counter in
 * `state.stats`. The hidden title Iron Stomach reads it.
 */
export const SPOILED_EATEN_KEY = 'food:spoiled';

export function consumableSpec(id: string): ConsumableSpec | undefined {
  return MATERIALS[id]?.consumable;
}

export function isConsumable(id: string): boolean {
  return consumableSpec(id) !== undefined;
}

/** Everything usable the player is currently holding, best grade first. */
export function heldConsumables(
  state: GameState,
): { def: MaterialDef; quality: QualityTier; qty: number }[] {
  const out: { def: MaterialDef; quality: QualityTier; qty: number }[] = [];
  for (const def of Object.values(MATERIALS)) {
    if (!def.consumable) continue;
    if (def.graded) {
      for (const g of gradesHeld(state, def.id)) out.push({ def, quality: g.quality, qty: g.qty });
    } else {
      const qty = state.materials[def.id] ?? 0;
      if (qty > 0) out.push({ def, quality: 'c', qty });
    }
  }
  return out;
}

/** Ticks until this can be used again; 0 when it is ready. */
export function cooldownLeft(state: GameState, id: string): number {
  const ready = state.useCooldowns?.[id] ?? 0;
  return Math.max(0, ready - state.totalTicks);
}

export interface UseCheck {
  ok: boolean;
  reason?: string;
}

export function canUse(state: GameState, id: string, quality: QualityTier): UseCheck {
  return checkUse(state, id, quality, !!state.combat);
}

/**
 * `canUse` as if no fight were on: stock, cooldown and the card rules, without
 * the one that keeps dishes out of a fight. What a queued dish is checked
 * against (systems/eating.ts), both when it is queued and when it fires.
 */
export function canUseOutOfFight(state: GameState, id: string, quality: QualityTier): UseCheck {
  return checkUse(state, id, quality, false);
}

function checkUse(state: GameState, id: string, quality: QualityTier, fighting: boolean): UseCheck {
  const spec = consumableSpec(id);
  if (!spec) return { ok: false, reason: text('consumables.reason.not_usable') };
  const held = MATERIALS[id]?.graded
    ? stockOf(state, id, quality)
    : (state.materials[id] ?? 0);
  if (held < 1) return { ok: false, reason: text('consumables.reason.none_held') };
  if (cardSpent(state, spec)) {
    return { ok: false, reason: text(spec.teaches ? 'consumables.reason.recipe_known' : 'consumables.reason.card_spent') };
  }
  // A technique nothing you know leads into is held back, not spent: the
  // card keeps until a way into its position exists (martial.ts, Reach).
  const tech = spec.teachesTechnique ? TECHNIQUES[spec.teachesTechnique] : undefined;
  if (tech && !techniqueReachable(state, tech)) {
    return { ok: false, reason: text('consumables.reason.technique_unreachable', { name: tech.name }) };
  }
  // Dishes are long-lasting and eaten between fights (user, 2026-10-24: cooking
  // is eaten only out of combat, alchemy is usable any time). The respawn gap
  // and a hunt's rest before the next fight have no `state.combat`, so they are
  // between fights. Flasks, salves and cards are not food and are unaffected.
  if (spec.food && fighting) return { ok: false, reason: text('consumables.reason.in_combat') };
  const left = cooldownLeft(state, id);
  if (left > 0) return { ok: false, reason: text('consumables.reason.cooldown', { seconds: (left / 10).toFixed(1) }) };
  return { ok: true };
}

/** Take one from stock, wherever it is kept. */
function consumeOne(state: GameState, id: string, quality: QualityTier): boolean {
  if (!MATERIALS[id]?.graded) {
    const have = state.materials[id] ?? 0;
    if (have < 1) return false;
    if (have - 1 > 0) state.materials[id] = have - 1;
    else delete state.materials[id];
    return true;
  }
  const have = stockOf(state, id, quality);
  if (have < 1) return false;
  const bucket = state.stock[id]!;
  if (have - 1 > 0) bucket[quality] = have - 1;
  else delete bucket[quality];
  if (Object.keys(bucket).length === 0) delete state.stock[id];
  return true;
}

function useCard(state: GameState, bus: EventBus, def: MaterialDef, spec: ConsumableSpec): void {
  if (spec.teaches) {
    bumpStat(state, bus, recipeKey(spec.teaches));
    bus.emit({ type: 'log', msg: text('consumables.recipe_learned', { name: recipeName(spec.teaches) }), kind: 'skill' });
    return;
  }
  if (spec.unlocksWord) {
    bumpStat(state, bus, wordUnlockKey(spec.unlocksWord));
    bus.emit({ type: 'log', msg: text('consumables.word_learned', { word: spec.unlocksWord }), kind: 'skill' });
    return;
  }
  if (spec.teachesTechnique) {
    const tech = TECHNIQUES[spec.teachesTechnique];
    if (tech) learnTechnique(state, tech, 'canonical');
    bus.emit({
      type: 'log',
      msg: text('consumables.technique_learned', { name: tech?.name ?? spec.teachesTechnique }),
      kind: 'skill',
    });
    return;
  }
  if (spec.stamps) {
    bumpStat(state, bus, spec.stamps);
    bus.emit({ type: 'log', msg: text('consumables.card_used', { icon: def.icon, verb: spec.useVerb ?? 'Used', name: def.name }), kind: 'skill' });
    // A stamped flag is what hidden titles read; titles do not watch stats.
    checkTitleUnlocks(state, bus);
    return;
  }
  if (spec.votive) {
    bumpStat(state, bus, VOTIVE_KEY);
    if ((state.stats[VOTIVE_KEY] ?? 0) === 1) {
      grantFavorAll(state, bus, VOTIVE_FIRST_FAVOR);
      bumpStat(state, bus, VOTIVE_BASELINE_KEY, VOTIVE_FIRST_FAVOR);
      bus.emit({ type: 'log', msg: text('consumables.votive_first', { amount: VOTIVE_FIRST_FAVOR }), kind: 'skill' });
    } else {
      bumpStat(state, bus, FLOATING_FAVOR_KEY);
      bus.emit({ type: 'log', msg: text('consumables.votive_floating'), kind: 'skill' });
    }
  }
}

/** How the cook's skill scales food as eaten. 1 and 1 is no scaling. */
export interface FoodScale {
  /** Multiplies how long each granted condition lasts. */
  duration: number;
  /** Multiplies each granted condition's intensity and each `restore` amount. */
  potency: number;
}

const NO_FOOD_SCALE: FoodScale = { duration: 1, potency: 1 };

/**
 * What Cooking does to a dish when it is eaten. Both factors are read from the
 * stat block, which already holds them at `FOOD_MULT_CAP` (derived.ts) — there is
 * no second clamp here to drift from it.
 */
export function foodScale(stats: DerivedStats): FoodScale {
  return { duration: stats.foodDuration, potency: stats.foodPotency };
}

/**
 * One granted condition as eaten: intensity × grade × potency, and a lifetime
 * scaled by duration — the application's own, else the condition's. A condition
 * that never ends on its own (`'permanent'`, or a null duration) keeps its
 * terms. A harmful condition (`isHarmful`, conditionHarm.ts: read from the
 * condition's data, so it covers the spoilage condition and anything a dish is
 * ever authored to carry) is harm, not nourishment, and is never scaled.
 */
function eatenApplication(app: StatusApplication, scale: number, food: FoodScale): StatusApplication {
  const def = STATUSES[app.id];
  const f = def && isHarmful(def) ? NO_FOOD_SCALE : food;
  const out: StatusApplication = { ...app, intensity: (app.intensity ?? 1) * scale * f.potency };
  if (f.duration !== 1 && app.duration !== 'permanent') {
    const base = app.duration ?? STATUSES[app.id]?.duration;
    if (typeof base === 'number') out.duration = Math.round(base * f.duration);
  }
  return out;
}

/** A dose's full lifetime in ticks; null when it does not run out by clock. */
function doseTicks(app: StatusApplication): number | null {
  if (app.duration === 'permanent') return null;
  const base = app.duration ?? STATUSES[app.id]?.duration;
  return typeof base === 'number' ? base : null;
}

export interface UseResult {
  /** What each pool actually gained, for the log. */
  restored: { resource: string; amount: number }[];
  /** Status ids granted (a Signature's included). */
  granted: string[];
  /** The subset of `granted` that came from the dish's Signature. */
  signature: string[];
  /** Status ids a cure cleared. */
  cured: string[];
}

/**
 * Use one. Returns null when it could not be used at all — nothing is spent in
 * that case, so a mis-click costs nothing.
 *
 * Grade scales everything: the instant restore, the intensity of whatever it
 * grants, and therefore the size of a sustained effect too. A Refuse-grade dish
 * has a NEGATIVE multiplier, so eating badly is genuinely worse than eating
 * nothing — the same rule that governs every other graded thing.
 */
export function useConsumable(
  state: GameState,
  bus: EventBus,
  id: string,
  quality: QualityTier = 'c',
  /** `queued`: eaten from the queue (systems/eating.ts), and the log line says what it waited for. */
  opts: { queued?: 'fight' | 'recovery' } = {},
): UseResult | null {
  const check = canUse(state, id, quality);
  if (!check.ok) {
    if (check.reason) bus.emit({ type: 'log', msg: text('common.locked', { reason: check.reason }), kind: 'danger' });
    return null;
  }
  const spec = consumableSpec(id)!;
  const def = MATERIALS[id]!;
  if (!consumeOne(state, id, quality)) return null;

  // A card is read (or offered), not eaten: it does its one thing and is
  // gone. No grade and no effects, so none of the eating rules below apply.
  if (isCard(spec)) {
    useCard(state, bus, def, spec);
    return { restored: [], granted: [], signature: [], cured: [] };
  }

  const stats = getDerivedStats(state);
  const scale = qualityMult(quality);
  const result: UseResult = { restored: [], granted: [], signature: [], cured: [] };
  /** Each Signature condition granted, with its dose, for the log line. */
  const signatureText: string[] = [];
  // The cook's skill improves food. It reaches the benefit side only: a spoiled
  // grade (scale < 0) is not helped by a better cook, and non-food is untouched.
  const food = spec.food && scale > 0 ? foodScale(stats) : NO_FOOD_SCALE;
  // What this dish puts on you, for its dish slot (systems/meals.ts). Which dish
  // a full set of slots would drop is chosen NOW, before any dose lands, because
  // that is the dish the screen named; and the conditions held before the first
  // dose are remembered, so one no dish accounts for is recorded as it stood.
  const victim =
    spec.food && dishHoldsSlot(state, id, quality) ? mealToReplace(state, id)?.slot.dish : undefined;
  const before = new Map(
    statusesOf(state).map((s) => [s.id, { intensity: s.intensity, ticksLeft: s.ticksLeft }] as const),
  );
  const landings: MealLanding[] = [];
  const land = (dose: StatusApplication, resistedBy?: typeof stats): StatusInstance | null => {
    const held = findStatus(state, dose.id)?.intensity;
    const inst = applyStatus(state, state, dose, def.name, resistedBy);
    if (inst && spec.food) {
      // The dose's own strength: what it raised the condition to, else what it
      // offered (a weaker dose that the stacking rule ignored is still a dose).
      const raised = held === undefined || inst.intensity > held;
      landings.push({
        id: inst.id,
        dose: raised ? inst.intensity : (dose.intensity ?? 1),
        ticks: doseTicks(dose),
        before: before.get(inst.id) ?? null,
      });
    }
    return inst;
  };

  // Instant: the whole thing, now.
  for (const r of spec.restore ?? []) {
    const amount =
      ((r.flat ?? 0) + (r.ofMax ?? 0) * availableMax(state, stats, r.resource)) * scale * food.potency;
    if (amount === 0) continue;
    const before = resourceValue(state, r.resource);
    if (amount > 0) {
      if (r.resource === 'hp') heal(state, stats, amount, 'salve');
      else restoreResource(state, stats, r.resource, amount);
    } else {
      // Spoiled food takes rather than gives.
      const after = Math.max(0, before + amount);
      state.resources[r.resource] = after;
    }
    const gained = resourceValue(state, r.resource) - before;
    if (gained !== 0) result.restored.push({ resource: r.resource, amount: gained });
  }

  // Sustained: a condition that carries the effect across its own lifetime.
  //
  // Spoiled food does not feed you weakly — it makes you ill. Refuse grade has
  // a negative multiplier, and rather than quietly scaling a benefit to nothing
  // (which would make eating rubbish merely pointless) it replaces whatever the
  // dish meant to do with the consequences of having eaten it.
  if (scale < 0) {
    // Spoilage is something done TO the eater, so the stat block goes in and
    // poison resistance thins it (applyStatus documents the one exception to
    // "a grant is not resisted").
    const inst = applyStatus(state, state, { id: SPOILED, intensity: -scale }, def.name, stats);
    if (inst) result.granted.push(inst.id);
  } else {
    for (const app of spec.grants ?? []) {
      // Only the failure dish may grant harm (the Scorched Mess grants the
      // spoilage condition); that is done to the eater too, where nourishment
      // is not resisted.
      const granted = STATUSES[app.id];
      const inst = land(eatenApplication(app, scale, food), granted && isHarmful(granted) ? stats : undefined);
      if (inst) result.granted.push(inst.id);
    }
    // A Signature rides along once the dish has been cooked enough times
    // (systems/cookbook.ts), graded and scaled like the dish's own grants.
    if (signatureEarned(state, id)) {
      for (const app of spec.signature ?? []) {
        const dose = eatenApplication(app, scale, food);
        const inst = land(dose);
        if (inst) {
          result.granted.push(inst.id);
          result.signature.push(inst.id);
          // The log line names it with the dose it landed at, e.g. "Stoked ×0.8".
          signatureText.push(`${STATUSES[inst.id]?.name ?? inst.id} ×${+(dose.intensity ?? 1).toFixed(2)}`);
        }
      }
    }
  }

  // Curing is just a status event with a tag — a tonic and a temple use the
  // same door, so anything a condition already yields to works here too.
  for (const tag of spec.cures ?? []) {
    const before = statusesOf(state).map((s) => s.id);
    fireStatusEvent(state, state, 'cure', { tag });
    const after = new Set(statusesOf(state).map((s) => s.id));
    result.cured.push(...before.filter((sid) => !after.has(sid)));
  }

  if (spec.cooldown) {
    state.useCooldowns ??= {};
    state.useCooldowns[id] = state.totalTicks + spec.cooldown;
  }

  const grade = QUALITY_TIERS[quality];
  const verb = spec.useVerb ?? 'Used';
  const note = text(opts.queued === 'recovery' ? 'meals.note_recovery' : 'meals.note_fight');
  const msg = signatureText.length
    ? opts.queued
      ? text('consumables.used_signature_queued', {
          icon: def.icon,
          verb,
          grade: grade.name,
          name: def.name,
          note,
          status: signatureText.join(' and '),
        })
      : text('consumables.used_signature', {
          icon: def.icon,
          verb,
          grade: grade.name,
          name: def.name,
          status: signatureText.join(' and '),
        })
    : opts.queued
      ? text('consumables.used_queued', { icon: def.icon, verb, grade: grade.name, name: def.name, note })
      : text('consumables.used', { icon: def.icon, verb, grade: grade.name, name: def.name });
  bus.emit({ type: 'log', msg, kind: scale < 0 ? 'danger' : 'action' });

  // Bad food eaten is counted whether or not the sickness landed (a resistant or
  // immune eater still ate it). Titles do not watch stats, so ask them.
  if (isSpoiledFood(spec, scale)) {
    bumpStat(state, bus, SPOILED_EATEN_KEY);
    checkTitleUnlocks(state, bus);
  }
  // After the eating line, so a dish pushed out reads as what eating caused.
  if (landings.length > 0) recordMeal(state, bus, id, quality, landings, victim);
  return result;
}

/**
 * Whether eating this was eating something spoiled: a dish at refuse grade
 * (a negative multiplier, whatever it was meant to be) or the failure dish, the
 * one dish that grants the spoilage condition outright (the Scorched Mess).
 * Food only: a refuse-grade salve is not a meal. Read from the dish's data, so
 * a second failure dish counts without being listed.
 */
export function isSpoiledFood(spec: ConsumableSpec, scale: number): boolean {
  return !!spec.food && (scale < 0 || !!spec.grants?.some((g) => g.id === SPOILED));
}
