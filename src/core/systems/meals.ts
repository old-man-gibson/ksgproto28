import type { GameState, MealClaim, MealSlot, QualityTier, StatusApplication } from '../types';
import type { EventBus } from '../engine/events';
import { MATERIALS } from '../data/materials.data';
import { QUALITY_TIERS, qualityMult, qualityRank } from '../data/quality.data';
import { STATUSES } from '../registry';
import { isHarmful } from './conditionHarm';
import { signatureEarned } from './cookbook';
import { findStatus, removeStatus } from './statuses';
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
 *    between. Re-eating a dish needs no special case: its new claim renews its
 *    own clock, and the instance follows only if that claim leads.
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

/** Every live claim on a condition: the dishes' and the other sources'. */
function claimsOn(state: GameState, id: string): MealClaim[] {
  const out: MealClaim[] = [];
  for (const slot of state.meals ?? []) {
    for (const c of slot.claims ?? []) if (c.id === id && live(c)) out.push(c);
  }
  for (const c of state.foreignClaims ?? []) if (c.id === id && live(c)) out.push(c);
  return out;
}

const longerThan = (a: number | null, b: number | null): boolean =>
  a === null ? b !== null : b !== null && a > b;

/** The claim that sets the condition: the strongest dose, the longest clock among equals. */
function leading(claims: MealClaim[]): MealClaim {
  let lead = claims[0];
  for (const c of claims) {
    if (c.dose > lead.dose || (c.dose === lead.dose && longerThan(c.left, lead.left))) lead = c;
  }
  return lead;
}

const longer = (a: number | null, b: number | null): number | null =>
  a === null || b === null ? null : Math.max(a, b);

/** The conditions some dish slot holds a claim on. */
function dishConditions(state: GameState): Set<string> {
  const ids = new Set<string>();
  for (const slot of state.meals ?? []) for (const c of slot.claims ?? []) ids.add(c.id);
  return ids;
}

const modelled = (id: string): boolean => STATUSES[id]?.stacking.mode === 'highest';

/**
 * Put a held condition at its leading claim's dose and remaining time. Only for a
 * condition that stacks as `highest` and that a dish holds a claim on (`always`:
 * or one a dish has just let go of, which another source's claim now leads);
 * anything else is left to the status system.
 */
function reconcile(state: GameState, id: string, always = false): void {
  if (!modelled(id) || (!always && !dishConditions(state).has(id))) return;
  const held = findStatus(state, id);
  if (!held) return;
  const claims = claimsOn(state, id);
  if (claims.length === 0) return;
  const lead = leading(claims);
  if (held.intensity !== lead.dose) {
    held.intensity = lead.dose;
    held.peak = lead.dose;
  }
  if (held.ticksLeft !== lead.left) held.ticksLeft = lead.left;
}

/** A dish in a slot, with the time it has left. */
export interface ActiveMeal {
  slot: MealSlot;
  /** Ticks until its last claim runs out; null when one has no clock. */
  ticksLeft: number | null;
}

/** The slots with a live claim on a condition that is still held, oldest first. */
export function activeMeals(state: GameState): ActiveMeal[] {
  const out: ActiveMeal[] = [];
  for (const slot of state.meals ?? []) {
    let any = false;
    let left: number | null = 0;
    for (const c of slot.claims ?? []) {
      if (!live(c) || !findStatus(state, c.id)) continue;
      any = true;
      if (c.left === null) left = null;
      else if (left !== null) left = Math.max(left, c.left);
    }
    if (any) out.push({ slot, ticksLeft: left });
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

/**
 * Drop what has stopped counting: claims that ran out or whose condition is no
 * longer held, then the slots left with none. Writes only when something changed.
 */
export function pruneClaims(state: GameState): void {
  const slots = state.meals;
  if (slots && slots.length > 0) {
    let changed = false;
    const kept: MealSlot[] = [];
    for (const slot of slots) {
      const all = Array.isArray(slot.claims) ? slot.claims : [];
      const held = all.filter((c) => live(c) && findStatus(state, c.id) !== undefined);
      if (!Array.isArray(slot.claims) || held.length !== all.length) changed = true;
      if (held.length > 0) kept.push(held.length === all.length ? slot : { ...slot, claims: held });
    }
    if (changed) state.meals = kept;
  }
  const foreign = state.foreignClaims;
  if (foreign && foreign.length > 0) {
    const held = foreign.filter((c) => live(c) && findStatus(state, c.id) !== undefined);
    if (held.length !== foreign.length) state.foreignClaims = held;
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
    if (!def || !ours.has(app.id) || !findStatus(state, app.id)) continue;
    const span = app.duration === 'permanent' ? null : (app.duration ?? def.duration ?? null);
    if (!state.foreignClaims) state.foreignClaims = [];
    state.foreignClaims.push({ id: app.id, dose: app.intensity ?? 1, left: span });
    reconcile(state, app.id);
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
  // One claim per condition: a dish that gives one twice (a grant and its
  // Signature) holds the stronger dose for the longer clock.
  const claims: MealClaim[] = [];
  for (const l of nourishing) {
    const have = claims.find((c) => c.id === l.id);
    if (have) {
      have.dose = Math.max(have.dose, l.dose);
      have.left = longer(have.left, l.ticks);
    } else {
      claims.push({ id: l.id, dose: l.dose, left: l.ticks });
    }
  }
  // A condition that was held before the dish and that no claim accounts for is
  // some other source's (an old save, a blessing): record it as it stood, so it
  // keeps the condition only for the time it had left.
  for (const l of nourishing) {
    if (!l.before || claimsOn(state, l.id).length > 0) continue;
    state.foreignClaims.push({ id: l.id, dose: l.before.intensity, left: l.before.ticksLeft });
  }
  // What the earlier helping gave and this one did not land (a dose can be
  // resisted) stays while its clock runs.
  for (const c of prior?.claims ?? []) {
    if (live(c) && !claims.some((x) => x.id === c.id) && findStatus(state, c.id)) claims.push({ ...c });
  }
  const best = prior && qualityRank(prior.quality) > qualityRank(quality) ? prior.quality : quality;
  const slot: MealSlot = { dish, quality: best, claims };
  state.meals = [...state.meals.filter((s) => s.dish !== dish), slot];

  // Make room. The dish just eaten is never the one that goes.
  const by = `${QUALITY_TIERS[best].name} ${MATERIALS[dish]?.name ?? dish}`;
  let named = victim;
  for (;;) {
    const meals = activeMeals(state);
    if (meals.length <= dishLimit(state)) break;
    const rest = meals.filter((m) => m.slot.dish !== dish);
    const chosen = rest.find((m) => m.slot.dish === named) ?? leastTimeLeft(rest);
    named = undefined;
    if (!chosen) break;
    release(state, bus, chosen.slot, by);
  }
  for (const c of claims) reconcile(state, c.id);
}

/**
 * Take a dish out of its slot. Each condition it gave ends when no live claim is
 * left on it; otherwise it drops to the strongest remaining claim's dose and that
 * claim's remaining time.
 */
function release(state: GameState, bus: EventBus, slot: MealSlot, by: string): void {
  state.meals = state.meals.filter((s) => s.dish !== slot.dish);
  const ended: string[] = [];
  const kept: string[] = [];
  for (const claim of slot.claims) {
    if (!findStatus(state, claim.id)) continue;
    const name = STATUSES[claim.id]?.name ?? claim.id;
    if (claimsOn(state, claim.id).length > 0) {
      reconcile(state, claim.id, true);
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
      grade: QUALITY_TIERS[slot.quality].name,
      name: MATERIALS[slot.dish]?.name ?? slot.dish,
      by,
      limit: dishLimit(state),
      detail,
    }),
    kind: 'action',
  });
}

/**
 * Before the conditions tick: hand a condition over to its next claim when its
 * leading claim runs out this tick, so the condition does not expire on the
 * leader's clock and leave a dish's longer claim with nothing behind it. `rate`
 * is how far the conditions' clocks advance this tick (`Game.advance` reads it
 * before anything moves).
 */
export function handOffMeals(state: GameState, rate: number): void {
  if (rate <= 0) return;
  for (const id of dishConditions(state)) {
    if (!modelled(id)) continue;
    const held = findStatus(state, id);
    const claims = claimsOn(state, id);
    if (!held || claims.length === 0) continue;
    const lead = leading(claims);
    if (lead.left === null || lead.left - rate > 0) continue;
    const rest = claims.filter((c) => c !== lead && (c.left === null || c.left - rate > 0));
    if (rest.length === 0) continue;
    const next = leading(rest);
    held.intensity = next.dose;
    held.peak = next.dose;
    held.ticksLeft = next.left;
  }
}

/**
 * Once a tick, after the world has moved. `rate` is how far the conditions'
 * clocks advanced this tick, read by `Game.advance` before anything moved (0
 * while travelling, 5 while knocked out, else 1).
 *
 *  1. Run every claim's clock down by `rate`, and drop claims that ran out or
 *     whose condition is gone, and the slots left with none.
 *  2. Notice what nobody recorded: a condition a dish holds that is now stronger
 *     or longer than its leading claim explains gets a foreign claim from what it
 *     shows.
 *  3. Put each condition a dish holds back at its leading claim.
 */
export function tickMealClaims(state: GameState, rate: number): void {
  if ((state.meals ?? []).length === 0 && (state.foreignClaims ?? []).length === 0) return;
  if (rate > 0) {
    for (const slot of state.meals ?? []) {
      for (const c of slot.claims ?? []) if (c.left !== null) c.left -= rate;
    }
    for (const c of state.foreignClaims ?? []) if (c.left !== null) c.left -= rate;
  }
  pruneClaims(state);

  const adopted: MealClaim[] = [];
  for (const id of dishConditions(state)) {
    if (!modelled(id)) continue;
    const held = findStatus(state, id);
    const claims = claimsOn(state, id);
    if (!held || claims.length === 0) continue;
    const lead = leading(claims);
    const stronger = held.intensity > lead.dose;
    const extended = held.ticksLeft !== null && lead.left !== null && held.ticksLeft > lead.left;
    if (stronger || extended) adopted.push({ id, dose: held.intensity, left: held.ticksLeft });
  }
  if (adopted.length > 0) {
    if (!state.foreignClaims) state.foreignClaims = [];
    for (const c of adopted) state.foreignClaims.push(c);
  }
  for (const id of dishConditions(state)) reconcile(state, id);
}
