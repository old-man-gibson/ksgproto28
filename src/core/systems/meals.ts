import type { GameState, MealSlot, MealStatus, QualityTier, StatusInstance } from '../types';
import type { EventBus } from '../engine/events';
import { MATERIALS } from '../data/materials.data';
import { QUALITY_TIERS, qualityRank } from '../data/quality.data';
import { STATUSES } from '../registry';
import { isHarmful } from './conditionHarm';
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
 * **Time left is read, not stored.** A slot lists the conditions its dish put
 * on you (`MealSlot.statuses`) and has no clock of its own; its time left is
 * the longest clock among those it still lists. That keeps a dish in step with
 * the one clock conditions already have: a knockout's faster clock and a pause
 * in travel apply to it exactly as they apply to a poison. A slot frees when
 * none of its conditions are held any more, however that came about (they ran
 * out, a cure took them, a reset cleared them).
 *
 * **A condition has one instance.** Two dishes that both give Well Fed share
 * the instance, and so do a dish and an alchemy flask. Eviction therefore ends
 * a condition only when the evicted dish provably owns it, which takes all of:
 *
 *  - no other slot lists it;
 *  - it was not already held when the dish landed (`MealStatus.shared`: a
 *    flask, a blessing or an older dish gave it first);
 *  - it still reads as the dish left it (`intensity`, `stacks`), so a stronger
 *    dose from a source that landed afterwards keeps it.
 *
 * A condition kept this way is not weakened either: it runs on with whatever
 * strength and clock it has. A dose the stacking rule discarded left nothing of
 * its own on the instance, so there is nothing for eviction to keep.
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

/** A dish in a slot, with the time it has left. */
export interface ActiveMeal {
  slot: MealSlot;
  /** Ticks until the last of its conditions ends; null when one has no clock. */
  ticksLeft: number | null;
}

/** The slots whose dish still has something running, oldest first. */
export function activeMeals(state: GameState): ActiveMeal[] {
  const out: ActiveMeal[] = [];
  for (const slot of state.meals ?? []) {
    let alive = false;
    let left: number | null = 0;
    for (const entry of slot.statuses) {
      const held = findStatus(state, entry.id);
      if (!held) continue;
      alive = true;
      if (held.ticksLeft === null) left = null;
      else if (left !== null) left = Math.max(left, held.ticksLeft);
    }
    if (alive) out.push({ slot, ticksLeft: left });
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
 * dish already holds a slot (that refreshes it) or a slot is free.
 */
export function mealToReplace(state: GameState, dish: string): ActiveMeal | undefined {
  const live = activeMeals(state);
  if (live.some((m) => m.slot.dish === dish)) return undefined;
  if (live.length < dishLimit(state)) return undefined;
  return leastTimeLeft(live);
}

/**
 * Drop what no longer holds a slot: conditions that have ended, and then the
 * slots left with none. Run every tick; writes only when something changed.
 * Dropping a listed condition the moment it ends matters: a later dose from
 * another source must not read as the dish's.
 */
export function pruneMeals(state: GameState): void {
  const slots = state.meals;
  if (!slots || slots.length === 0) return;
  let changed = false;
  const kept: MealSlot[] = [];
  for (const slot of slots) {
    const held = slot.statuses.filter((e) => findStatus(state, e.id) !== undefined);
    if (held.length !== slot.statuses.length) changed = true;
    if (held.length > 0) kept.push(held.length === slot.statuses.length ? slot : { ...slot, statuses: held });
  }
  if (changed) state.meals = kept;
}

/** One dose of a dish that landed, as `useConsumable` saw it. */
export interface MealLanding {
  /** The held condition the dose landed on (a new one, or the one it joined). */
  inst: StatusInstance;
  /** The condition was already held before the dose. */
  had: boolean;
  /** The dose's full lifetime in ticks; null when it has none. */
  ticks: number | null;
}

/**
 * Put a dish that has just been eaten into its slot, and make room for it.
 * Called by `useConsumable` after the dish's conditions have landed.
 *
 * Re-eating a dish already in a slot refreshes it: the slot is renewed (and
 * moves to the back of the age order), and each condition's clock is raised to
 * the new dose's full lifetime. The status system's own rule for a weaker or
 * equal dose of a `highest` condition is to ignore it, which would make a
 * second helping a wasted dish; the clock is the part of the refresh it does
 * not give. Strength stays whatever that rule left.
 */
export function recordMeal(
  state: GameState,
  bus: EventBus,
  dish: string,
  quality: QualityTier,
  landings: MealLanding[],
): void {
  const nourishing = landings.filter((l) => {
    const def = STATUSES[l.inst.id];
    return !!def && !isHarmful(def);
  });
  if (nourishing.length === 0) return;
  // A state built before the field existed. Assigned on its own line, never
  // used as an expression (docs/PITFALLS.md §1).
  if (!state.meals) state.meals = [];
  pruneMeals(state);

  const prior = state.meals.find((s) => s.dish === dish);
  const entries: MealStatus[] = [];
  for (const l of nourishing) {
    if (entries.some((e) => e.id === l.inst.id)) continue;
    // A condition this slot already listed keeps its flag: the instance exists
    // because the dish put it there, not because someone else did.
    const before = prior?.statuses.find((e) => e.id === l.inst.id);
    if (prior && l.ticks !== null && l.inst.ticksLeft !== null) {
      l.inst.ticksLeft = Math.max(l.inst.ticksLeft, l.ticks);
    }
    entries.push({
      id: l.inst.id,
      shared: before ? before.shared : l.had,
      intensity: l.inst.intensity,
      stacks: l.inst.stacks,
    });
  }
  // A condition the earlier helping listed that this one did not land (a dose
  // can be resisted) stays listed while it is still held.
  for (const e of prior?.statuses ?? []) {
    if (!entries.some((x) => x.id === e.id) && findStatus(state, e.id)) entries.push({ ...e });
  }
  const best =
    prior && qualityRank(prior.quality) > qualityRank(quality) ? prior.quality : quality;
  const slot: MealSlot = { dish, quality: best, statuses: entries };
  state.meals = [...state.meals.filter((s) => s.dish !== dish), slot];

  // Make room. The dish just eaten is never the one that goes.
  for (;;) {
    const live = activeMeals(state);
    if (live.length <= dishLimit(state)) break;
    const victim = leastTimeLeft(live.filter((m) => m.slot.dish !== dish));
    if (!victim) break;
    release(state, bus, victim.slot);
  }
}

/**
 * Take a dish out of its slot and end what it owns. See the header for what
 * "owns" means; a condition it does not own is left exactly as it is.
 */
function release(state: GameState, bus: EventBus, slot: MealSlot): void {
  const others = state.meals.filter((s) => s.dish !== slot.dish);
  const ended: string[] = [];
  const kept: string[] = [];
  for (const entry of slot.statuses) {
    const held = findStatus(state, entry.id);
    if (!held) continue;
    const name = STATUSES[entry.id]?.name ?? entry.id;
    const claimed =
      entry.shared ||
      others.some((o) => o.statuses.some((e) => e.id === entry.id)) ||
      held.intensity !== entry.intensity ||
      held.stacks !== entry.stacks;
    if (claimed) {
      kept.push(name);
    } else {
      removeStatus(state, entry.id);
      ended.push(name);
    }
  }
  state.meals = others;
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
      limit: dishLimit(state),
      detail,
    }),
    kind: 'action',
  });
}
