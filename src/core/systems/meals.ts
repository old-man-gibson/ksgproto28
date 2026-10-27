import type { GameState, MealClaim, MealSlot, QualityTier, StatusApplication, StatusInstance } from '../types';
import type { EventBus } from '../engine/events';
import { MATERIALS } from '../data/materials.data';
import { QUALITY_TIERS, qualityMult, qualityRank } from '../data/quality.data';
import { STATUSES } from '../registry';
import { isHarmful } from './conditionHarm';
import { signatureEarned } from './cookbook';
import { removeStatus } from './statuses';
import { text } from '../text/log';

/**
 * Dish slots: at most `dishLimit` dishes active at once (user, 2026-10-24).
 *
 * A dish is ONE slot holding everything it gave: its grants and its Signature.
 * Eating a dish already in a slot refreshes that slot. Eating a different dish
 * with every slot full replaces the dish with the least time left, and the
 * replaced dish's conditions end.
 *
 * **A claim is one dose with a clock of its own.** A held condition is a single
 * instance however many things gave it, and its stacking rule keeps only the
 * strongest dose and the last clock, which forgets the rest. So each dish
 * records, per condition it gave, a `MealClaim`: the dose and the ticks that
 * dose has left. Anything that is not a dish (a flask, a condition already
 * running in an old save) records its own claim in `state.foreignClaims`.
 *
 *  - A slot's time left is the longest clock among its own claims, never the
 *    instance's, which another source may have set. Eviction chooses by it, and
 *    chooses BEFORE the dish being eaten lands, which is the choice the screen
 *    showed.
 *  - A claim's clock counts at the pace the conditions' clocks run: 5 ticks a
 *    tick while knocked out, none while travelling (`Game.advance` passes the
 *    rate it read before anything moved).
 *  - Where a condition stacks as `highest`, the instance is kept at its LEADING
 *    claim: the strongest live dose, with that claim's own remaining time (the
 *    longest among equals) (`reconcile`). A strong flask is the leader for as
 *    long as its own clock runs, and a dish's longer clock cannot lend the flask
 *    more time: when the flask's claim is about to lapse the instance is handed
 *    to the next claim before the conditions tick (`handOffMeals`), so the dish's
 *    dose carries on for the dish's time without the condition ever expiring in
 *    between. `Game.advance` fires a queued dish BEFORE the hand-off: a dish that
 *    lands reconciles the instance onto the leader, which may be the claim
 *    lapsing this very tick, and only a hand-off that runs after it can move the
 *    condition on.
 *  - Re-eating a dish: a helping at least as strong as a live claim of the same
 *    slot replaces and renews it. A weaker one never lowers or extends the
 *    stronger claim; it is a second claim on the condition, which takes over when
 *    the stronger one lapses. Claims another claim of the slot outlasts at an
 *    equal or higher dose are dropped. The slot's label is the best grade among
 *    its live claims, so it reads the grade that is still in effect.
 *  - Evicting a dish removes its claims. A condition another live claim still
 *    gives is left at that claim's dose and remaining time, not the evicted
 *    dish's; with none left it ends. A claim that has run out counts for nothing.
 *  - A change nobody recorded (a flask used through alchemy's own `useFlask`
 *    rather than `Game.useFlask`) is noticed when the instance is stronger or
 *    longer than the claims explain, and recorded as a foreign claim from what
 *    it shows. A weaker dose the stacking rule discarded leaves nothing to notice
 *    and is lost; `Game.useFlask` passes the brew's doses to `noteForeignDoses`
 *    so the real game loses nothing.
 *  - A condition whose stacking is not `highest` (none of the food conditions)
 *    is not re-derived: it ends only when no claim is left, and is otherwise
 *    left as it is.
 *
 * The per-tick work runs while a dish is live through every tick of an offline
 * catch-up, so it scans the claims in place and allocates nothing when nothing
 * changes.
 *
 * A dish that gave nothing nourishing (every condition it gave is harmful, as
 * with spoiled food, or none landed) holds no slot and evicts nobody: eating a
 * Scorched Mess for the Queasy immunity must not cost you a stew.
 */

/** How many dishes can be active at once. */
export const MAX_ACTIVE_DISHES = 3;

/**
 * The dish limit for this player. A constant today; the one function a skill or
 * a mutagen would raise, so nothing else reads `MAX_ACTIVE_DISHES` directly.
 */
export function dishLimit(_state: GameState): number {
  return MAX_ACTIVE_DISHES;
}

function isNourishing(id: string): boolean {
  const def = STATUSES[id];
  return !!def && !isHarmful(def);
}

/** The condition ids some food gives that do not hurt: the ones a dish slot can hold. */
function dishConditionIds(): Set<string> {
  const ids = new Set<string>();
  for (const def of Object.values(MATERIALS)) {
    const spec = def.consumable;
    if (!spec?.food) continue;
    for (const app of [...(spec.grants ?? []), ...(spec.signature ?? [])]) {
      if (isNourishing(app.id)) ids.add(app.id);
    }
  }
  return ids;
}

/**
 * Whether eating this dish at this grade would put it in a dish slot: it is food,
 * not spoiled, and gives (or, with its Signature earned, would give) a condition
 * that does not hurt. A dish that does not holds no slot and evicts nobody.
 */
export function dishHoldsSlot(state: GameState, id: string, quality: QualityTier): boolean {
  const spec = MATERIALS[id]?.consumable;
  if (!spec?.food || qualityMult(quality) <= 0) return false;
  const gives = [...(spec.grants ?? []), ...(signatureEarned(state, id) ? (spec.signature ?? []) : [])];
  return gives.some((app) => isNourishing(app.id));
}

// ---------- Claims ----------

const live = (c: MealClaim): boolean => c.left === null || c.left > 0;

/** The held condition with this id, scanned in place (no closure per call). */
function heldStatus(state: GameState, id: string): StatusInstance | undefined {
  const list = state.statuses;
  if (!list) return undefined;
  for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return undefined;
}

const longerThan = (a: number | null, b: number | null): boolean =>
  a === null ? b !== null : b !== null && a > b;

/** The better of two claims on one condition: the stronger dose, the longer clock among equals. */
function lead(best: MealClaim | undefined, c: MealClaim): MealClaim {
  if (!best || c.dose > best.dose || (c.dose === best.dose && longerThan(c.left, best.left))) return c;
  return best;
}

/**
 * The leading live claim on a condition, the dishes' and the other sources', or
 * undefined when none is live. `exclude` leaves one claim out; `survive` counts
 * only claims still live after that many more ticks. Scans in place.
 */
function leadOn(state: GameState, id: string, exclude?: MealClaim, survive = 0): MealClaim | undefined {
  let best: MealClaim | undefined;
  const slots = state.meals;
  if (slots) {
    for (let i = 0; i < slots.length; i++) {
      const claims = slots[i].claims;
      if (!claims) continue;
      for (let j = 0; j < claims.length; j++) {
        const c = claims[j];
        if (c.id === id && c !== exclude && (c.left === null || c.left > survive)) best = lead(best, c);
      }
    }
  }
  const foreign = state.foreignClaims;
  if (foreign) {
    for (let j = 0; j < foreign.length; j++) {
      const c = foreign[j];
      if (c.id === id && c !== exclude && (c.left === null || c.left > survive)) best = lead(best, c);
    }
  }
  return best;
}

const longer = (a: number | null, b: number | null): number | null =>
  a === null || b === null ? null : Math.max(a, b);

/** Scratch for `dishConditions`: reused, so the per-tick calls allocate nothing. */
const scratchIds: string[] = [];

/**
 * The conditions some dish slot holds a claim on. The returned array is shared
 * scratch: read it before calling this again.
 */
function dishConditions(state: GameState): readonly string[] {
  scratchIds.length = 0;
  const slots = state.meals;
  if (slots) {
    for (let i = 0; i < slots.length; i++) {
      const claims = slots[i].claims;
      if (!claims) continue;
      for (let j = 0; j < claims.length; j++) {
        if (!scratchIds.includes(claims[j].id)) scratchIds.push(claims[j].id);
      }
    }
  }
  return scratchIds;
}

const modelled = (id: string): boolean => STATUSES[id]?.stacking.mode === 'highest';

/**
 * Put a held condition at its leading claim's dose and remaining time. Only for a
 * condition that stacks as `highest` and that is in `ids`, the conditions a dish
 * holds a claim on (null: skip that test, for one a dish has just let go of that
 * another source's claim now leads, or when the caller has already checked);
 * anything else is left to the status system.
 */
function reconcile(state: GameState, id: string, ids: readonly string[] | null): void {
  if (!modelled(id) || (ids !== null && !ids.includes(id))) return;
  const inst = heldStatus(state, id);
  const top = inst ? leadOn(state, id) : undefined;
  if (!inst || !top) return;
  if (inst.intensity !== top.dose) {
    inst.intensity = top.dose;
    inst.peak = top.dose;
  }
  if (inst.ticksLeft !== top.left) inst.ticksLeft = top.left;
}

/** A dish in a slot, with the time it has left. */
export interface ActiveMeal {
  slot: MealSlot;
  /** Ticks until its last claim runs out; null when one has no clock. */
  ticksLeft: number | null;
  /** The best grade among its live claims: the grade still in effect. */
  quality: QualityTier;
}

/** The slots with a live claim on a condition that is still held, oldest first. */
export function activeMeals(state: GameState): ActiveMeal[] {
  const out: ActiveMeal[] = [];
  for (const slot of state.meals ?? []) {
    let any = false;
    let left: number | null = 0;
    let quality: QualityTier | undefined;
    for (const c of slot.claims ?? []) {
      if (!live(c) || !heldStatus(state, c.id)) continue;
      any = true;
      if (c.left === null) left = null;
      else if (left !== null) left = Math.max(left, c.left);
      const grade = c.grade ?? slot.quality;
      if (!quality || qualityRank(grade) > qualityRank(quality)) quality = grade;
    }
    if (any) out.push({ slot, ticksLeft: left, quality: quality ?? slot.quality });
  }
  return out;
}

/** The dish in the slot with the least time left; the oldest of a tie. */
function leastTimeLeft(meals: ActiveMeal[]): ActiveMeal | undefined {
  let pick: ActiveMeal | undefined;
  for (const m of meals) {
    const left = m.ticksLeft ?? Infinity;
    if (!pick || left < (pick.ticksLeft ?? Infinity)) pick = m;
  }
  return pick;
}

/**
 * The dish eating `dish` would push out, or undefined when it would not: the
 * dish already holds a slot (that refreshes it) or a slot is free. The same
 * answer the screen shows and `useConsumable` takes before the dish lands.
 */
export function mealToReplace(state: GameState, dish: string): ActiveMeal | undefined {
  const meals = activeMeals(state);
  if (meals.some((m) => m.slot.dish === dish)) return undefined;
  if (meals.length < dishLimit(state)) return undefined;
  return leastTimeLeft(meals);
}

/** Whether any claim has stopped counting: run out, or its condition gone. */
function anyLapsed(state: GameState): boolean {
  const slots = state.meals;
  if (slots) {
    for (let i = 0; i < slots.length; i++) {
      const claims = slots[i].claims;
      if (!Array.isArray(claims)) return true;
      for (let j = 0; j < claims.length; j++) {
        if (!live(claims[j]) || !heldStatus(state, claims[j].id)) return true;
      }
    }
  }
  const foreign = state.foreignClaims;
  if (foreign) {
    for (let j = 0; j < foreign.length; j++) {
      if (!live(foreign[j]) || !heldStatus(state, foreign[j].id)) return true;
    }
  }
  return false;
}

/**
 * Drop what has stopped counting: claims that ran out or whose condition is no
 * longer held, then the slots left with none. Does nothing, and allocates
 * nothing, when every claim still counts.
 */
export function pruneClaims(state: GameState): void {
  if (!anyLapsed(state)) return;
  const slots = state.meals;
  if (slots && slots.length > 0) {
    const kept: MealSlot[] = [];
    for (const slot of slots) {
      const all = Array.isArray(slot.claims) ? slot.claims : [];
      const held = all.filter((c) => live(c) && heldStatus(state, c.id) !== undefined);
      if (held.length > 0) kept.push(held.length === all.length ? slot : { ...slot, claims: held });
    }
    state.meals = kept;
  }
  const foreign = state.foreignClaims;
  if (foreign && foreign.length > 0) {
    state.foreignClaims = foreign.filter((c) => live(c) && heldStatus(state, c.id) !== undefined);
  }
}

/**
 * Record what a flask just gave, as claims of a source that is not a dish. Only
 * conditions some dish can also give are kept (nothing else is ever evicted).
 * `Game.useFlask` calls it with the brew's grants, doses and durations, so a
 * dose the stacking rule ignores as weaker is still remembered and still keeps
 * the condition once a stronger dish is evicted, until the flask's own clock
 * runs out.
 */
export function noteForeignDoses(state: GameState, doses: StatusApplication[]): void {
  const ours = dishConditionIds();
  for (const app of doses) {
    const def = STATUSES[app.id];
    if (!def || !ours.has(app.id) || !heldStatus(state, app.id)) continue;
    const span = app.duration === 'permanent' ? null : (app.duration ?? def.duration ?? null);
    if (!state.foreignClaims) state.foreignClaims = [];
    state.foreignClaims.push({ id: app.id, dose: app.intensity ?? 1, left: span });
    reconcile(state, app.id, dishConditions(state));
  }
}

/** One dose of a dish that landed, as `useConsumable` saw it. */
export interface MealLanding {
  /** The condition's id. */
  id: string;
  /** What the dose gave it. */
  dose: number;
  /** The dose's full lifetime in ticks; null when it has none. */
  ticks: number | null;
  /** The condition as it stood before the dish's first dose; null when not held. */
  before: { intensity: number; ticksLeft: number | null } | null;
}

/**
 * Whether claim `b` makes claim `a` of the same slot pointless: the same
 * condition, at least as strong and lasting at least as long, and either better
 * in one of them or (`bLater`) newer.
 */
function dominates(b: MealClaim, a: MealClaim, bLater: boolean): boolean {
  if (b.id !== a.id || b.dose < a.dose || longerThan(a.left, b.left)) return false;
  return b.dose > a.dose || longerThan(b.left, a.left) || bLater;
}

/**
 * Put a dish that has just been eaten into its slot, and make room for it.
 * Called by `useConsumable` after the dish's conditions have landed.
 *
 * `victim` is the dish `mealToReplace` named before any dose landed. It is the
 * one that goes (while the slots are over the limit); only if more room is still
 * needed is another chosen, by the least time left.
 */
export function recordMeal(
  state: GameState,
  bus: EventBus,
  dish: string,
  quality: QualityTier,
  landings: MealLanding[],
  victim?: string,
): void {
  const nourishing = landings.filter((l) => isNourishing(l.id));
  if (nourishing.length === 0) return;
  // A state built before the fields existed. Assigned on their own lines, never
  // used as expressions (docs/PITFALLS.md §1).
  if (!state.meals) state.meals = [];
  if (!state.foreignClaims) state.foreignClaims = [];
  pruneClaims(state);

  const prior = state.meals.find((s) => s.dish === dish);
  // One claim per condition from one helping: a dish that gives one twice (a
  // grant and its Signature) holds the stronger dose for the longer clock.
  const fresh: MealClaim[] = [];
  for (const l of nourishing) {
    const have = fresh.find((c) => c.id === l.id);
    if (have) {
      have.dose = Math.max(have.dose, l.dose);
      have.left = longer(have.left, l.ticks);
    } else {
      fresh.push({ id: l.id, dose: l.dose, left: l.ticks, grade: quality });
    }
  }
  // A condition that was held before the dish and that no claim accounts for is
  // some other source's (an old save, a blessing): record it as it stood, so it
  // keeps the condition only for the time it had left.
  for (const l of nourishing) {
    if (!l.before || leadOn(state, l.id)) continue;
    state.foreignClaims.push({ id: l.id, dose: l.before.intensity, left: l.before.ticksLeft });
  }
  // The slot's claims: what the earlier helpings gave and still runs, and this
  // helping's, less any claim another of the slot's outlasts at as high a dose.
  // A weaker helping therefore never lowers or extends the stronger one: it stays
  // a claim of its own and takes over when the stronger lapses.
  const merged: MealClaim[] = [];
  for (const c of prior?.claims ?? []) {
    if (live(c) && heldStatus(state, c.id)) merged.push({ ...c, grade: c.grade ?? prior!.quality });
  }
  for (const c of fresh) merged.push(c);
  const claims = merged.filter((a, i) => !merged.some((b, j) => j !== i && dominates(b, a, j > i)));
  let best = claims[0].grade ?? quality;
  for (const c of claims) if (qualityRank(c.grade ?? quality) > qualityRank(best)) best = c.grade ?? quality;
  const slot: MealSlot = { dish, quality: best, claims };
  state.meals = [...state.meals.filter((s) => s.dish !== dish), slot];

  // Make room. The dish just eaten is never the one that goes.
  const by = `${QUALITY_TIERS[quality].name} ${MATERIALS[dish]?.name ?? dish}`;
  let named = victim;
  for (;;) {
    const meals = activeMeals(state);
    if (meals.length <= dishLimit(state)) break;
    const rest = meals.filter((m) => m.slot.dish !== dish);
    const chosen = rest.find((m) => m.slot.dish === named) ?? leastTimeLeft(rest);
    named = undefined;
    if (!chosen) break;
    release(state, bus, chosen, by);
  }
  const ids = dishConditions(state);
  for (const c of claims) reconcile(state, c.id, ids);
}

/**
 * Take a dish out of its slot. Each condition it gave ends when no live claim is
 * left on it; otherwise it drops to the strongest remaining claim's dose and that
 * claim's remaining time.
 */
function release(state: GameState, bus: EventBus, meal: ActiveMeal, by: string): void {
  const slot = meal.slot;
  state.meals = state.meals.filter((s) => s.dish !== slot.dish);
  const ended: string[] = [];
  const kept: string[] = [];
  const seen: string[] = [];
  for (const claim of slot.claims) {
    if (seen.includes(claim.id) || !heldStatus(state, claim.id)) continue;
    seen.push(claim.id);
    const name = STATUSES[claim.id]?.name ?? claim.id;
    if (leadOn(state, claim.id)) {
      reconcile(state, claim.id, null);
      kept.push(name);
    } else {
      removeStatus(state, claim.id);
      ended.push(name);
    }
  }
  const detail = [
    ended.length ? text('meals.ended', { list: ended.join(', ') }) : '',
    kept.length ? text('meals.kept', { list: kept.join(', ') }) : '',
  ]
    .filter(Boolean)
    .join(' ');
  bus.emit({
    type: 'log',
    msg: text('meals.replaced', {
      grade: QUALITY_TIERS[meal.quality].name,
      name: MATERIALS[slot.dish]?.name ?? slot.dish,
      by,
      limit: dishLimit(state),
      detail,
    }),
    kind: 'action',
  });
}

/** Whether any claim runs out within `rate` more ticks. One pass, the common answer is no. */
function anyDue(state: GameState, rate: number): boolean {
  const slots = state.meals;
  if (slots) {
    for (let i = 0; i < slots.length; i++) {
      const claims = slots[i].claims;
      if (!claims) continue;
      for (let j = 0; j < claims.length; j++) {
        const left = claims[j].left;
        if (left !== null && left <= rate) return true;
      }
    }
  }
  const foreign = state.foreignClaims;
  if (foreign) {
    for (let j = 0; j < foreign.length; j++) {
      const left = foreign[j].left;
      if (left !== null && left <= rate) return true;
    }
  }
  return false;
}

/**
 * Before the conditions tick: hand a condition over to its next claim when its
 * leading claim runs out this tick, so the condition does not expire on the
 * leader's clock and leave a dish's longer claim with nothing behind it. `rate`
 * is how far the conditions' clocks advance this tick (`Game.advance` reads it
 * before anything moves). Run it AFTER the queued dish has been eaten: a dish
 * landing reconciles the instance back onto the leader.
 */
export function handOffMeals(state: GameState, rate: number): void {
  if (rate <= 0 || !state.meals || state.meals.length === 0 || !anyDue(state, rate)) return;
  const ids = dishConditions(state);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (!modelled(id)) continue;
    const inst = heldStatus(state, id);
    const top = inst ? leadOn(state, id) : undefined;
    if (!inst || !top || top.left === null || top.left - rate > 0) continue;
    const next = leadOn(state, id, top, rate);
    if (!next) continue;
    inst.intensity = next.dose;
    inst.peak = next.dose;
    inst.ticksLeft = next.left;
  }
}

/**
 * Once a tick, after the world has moved. `rate` is how far the conditions'
 * clocks advanced this tick, read by `Game.advance` before anything moved (0
 * while travelling, 5 while knocked out, else 1).
 *
 *  1. Run every claim's clock down by `rate`, and drop claims that ran out or
 *     whose condition is gone, and the slots left with none.
 *  2. For each condition a dish holds, in one pass: if it is now stronger or
 *     longer than its leading claim explains, nobody recorded the change, so it
 *     gets a foreign claim from what it shows; otherwise it is put back at its
 *     leading claim.
 */
export function tickMealClaims(state: GameState, rate: number): void {
  const slots = state.meals;
  const foreign = state.foreignClaims;
  if ((!slots || slots.length === 0) && (!foreign || foreign.length === 0)) return;
  if (rate > 0) {
    if (slots) {
      for (let i = 0; i < slots.length; i++) {
        const claims = slots[i].claims;
        if (!claims) continue;
        for (let j = 0; j < claims.length; j++) if (claims[j].left !== null) claims[j].left! -= rate;
      }
    }
    if (foreign) {
      for (let j = 0; j < foreign.length; j++) if (foreign[j].left !== null) foreign[j].left! -= rate;
    }
  }
  pruneClaims(state);
  if (!state.meals || state.meals.length === 0) return;

  const ids = dishConditions(state);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (!modelled(id)) continue;
    const inst = heldStatus(state, id);
    const top = inst ? leadOn(state, id) : undefined;
    if (!inst || !top) continue;
    if (inst.intensity > top.dose || (inst.ticksLeft !== null && top.left !== null && inst.ticksLeft > top.left)) {
      // Nobody recorded this: take the instance as it stands as a claim of its own.
      if (!state.foreignClaims) state.foreignClaims = [];
      state.foreignClaims.push({ id, dose: inst.intensity, left: inst.ticksLeft });
      continue;
    }
    // Otherwise put the condition back at its leading claim.
    if (inst.intensity !== top.dose) {
      inst.intensity = top.dose;
      inst.peak = top.dose;
    }
    if (inst.ticksLeft !== top.left) inst.ticksLeft = top.left;
  }
}
