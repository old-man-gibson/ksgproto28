import type { GameState, QualityTier } from '../../core/types';
import { MATERIALS, STATUSES } from '../../core/registry';
import { QUALITY_TIERS } from '../../core/data/quality.data';
import { activeMeals, dishLimit, type ActiveMeal } from '../../core/systems/meals';
import { eatPlan } from '../../core/systems/eating';
import { cooldownLeft, consumableSpec } from '../../core/systems/consumables';
import { findStatus } from '../../core/systems/statuses';
import { ticksToTime } from './format';

/**
 * The words and numbers for dish slots and the queued dish, read from the core
 * (systems/meals.ts, eating.ts) and rendered by `DishSlots.svelte` (the sidebar
 * list) and the Provisions window's Eat button.
 */

/** "Fair Hearty Stew". */
export function dishLabel(dish: string, quality: QualityTier): string {
  return `${QUALITY_TIERS[quality].name} ${MATERIALS[dish]?.name ?? dish}`;
}

/** Time left as the list shows it; a dish with no clock has no time limit. */
export function timeLeftText(ticksLeft: number | null): string {
  return ticksLeft === null ? 'no time limit' : ticksToTime(ticksLeft);
}

export interface DishRow {
  dish: string;
  icon: string;
  /** Grade and name. */
  name: string;
  /** Time left, in words. */
  time: string;
  /** One line per condition the dish still gives: name and its own time. */
  conditions: string[];
  /** This is the dish a new dish would replace first (every slot is full). */
  replacedFirst: boolean;
}

/** "Dishes 2/3". */
export function dishHeading(state: GameState, meals: ActiveMeal[] = activeMeals(state)): string {
  return `Dishes ${meals.length}/${dishLimit(state)}`;
}

/** One row per dish in a slot, oldest first. */
export function dishRows(state: GameState): DishRow[] {
  const meals = activeMeals(state);
  const full = meals.length >= dishLimit(state);
  let least: ActiveMeal | undefined;
  for (const m of meals) {
    if (!least || (m.ticksLeft ?? Infinity) < (least.ticksLeft ?? Infinity)) least = m;
  }
  return meals.map((m) => ({
    dish: m.slot.dish,
    icon: MATERIALS[m.slot.dish]?.icon ?? '🍽️',
    name: dishLabel(m.slot.dish, m.slot.quality),
    time: timeLeftText(m.ticksLeft),
    conditions: m.slot.statuses.flatMap((e) => {
      const held = findStatus(state, e.id);
      if (!held) return [];
      const def = STATUSES[e.id];
      return [`${def?.icon ?? ''} ${def?.name ?? e.id}: ${timeLeftText(held.ticksLeft)}`.trim()];
    }),
    replacedFirst: full && m === least,
  }));
}

/** The queued dish, for the "after this fight" line; null when none waits. */
export function queuedRow(state: GameState): { icon: string; name: string } | null {
  const q = state.queuedMeal;
  if (!q) return null;
  return { icon: MATERIALS[q.dish]?.icon ?? '🍽️', name: dishLabel(q.dish, q.quality) };
}

/** What the Eat button on a dish says and does, and what its tooltip adds. */
export interface EatButton {
  label: string;
  disabled: boolean;
  /** Pressing it cancels the queued dish instead of eating or queueing. */
  cancels: boolean;
  /** Tooltip lines, empty when there is nothing to add. */
  tip: string[];
  /** The dish eating this would push out, said plainly under the button. */
  replaces: string | null;
}

/** "Eat" or "Drink": the button's verb, from the dish's own past-tense one. */
function verbOf(id: string): string {
  return consumableSpec(id)?.useVerb === 'Drank' ? 'Drink' : 'Eat';
}

export function eatButton(state: GameState, id: string, quality: QualityTier): EatButton {
  const spec = consumableSpec(id);
  const plan = eatPlan(state, id, quality);
  // Food reads as a verb the player would say; everything else keeps the
  // spec's own word, as it always has.
  const base = spec?.food ? verbOf(id) : (spec?.useVerb ?? 'Use');
  const tip: string[] = [];
  const meals = activeMeals(state);
  const active = meals.find((m) => m.slot.dish === id);
  const replaces = plan.replaces
    ? `Replaces ${dishLabel(plan.replaces.slot.dish, plan.replaces.slot.quality)}${
        plan.replaces.ticksLeft === null ? '' : ` (${timeLeftText(plan.replaces.ticksLeft)} left)`
      }`
    : null;

  if (plan.mode === 'blocked') {
    // A cooldown is the one refusal that passes by itself, so it counts down on
    // the button; any other refusal is the tooltip's.
    const cooling = cooldownLeft(state, id);
    if (cooling > 0) return { label: `Cooling ${(cooling / 10).toFixed(1)}s`, disabled: true, cancels: false, tip, replaces: null };
    if (plan.reason) tip.push(plan.reason);
    return { label: base, disabled: true, cancels: false, tip, replaces: null };
  }

  if (active) tip.push(`Already active (${timeLeftText(active.ticksLeft)} left): eating it again renews its time.`);
  if (replaces) tip.push(`${replaces}. At most ${dishLimit(state)} dishes can be active at once.`);

  if (plan.mode === 'queue') {
    if (plan.queued) {
      return {
        label: 'Queued: cancel',
        disabled: false,
        cancels: true,
        tip: ['It is eaten the moment the fight ends. Pressing this takes it off the queue.'],
        replaces: null,
      };
    }
    tip.unshift(
      'Dishes are eaten between fights. This one waits and is eaten the moment the fight ends. One dish waits at a time: choosing another replaces it.',
    );
    return { label: `${base} after this fight`, disabled: false, cancels: false, tip, replaces };
  }

  return { label: base, disabled: false, cancels: false, tip, replaces };
}
