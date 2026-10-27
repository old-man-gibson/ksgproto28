import type { GameState, QualityTier } from '../../core/types';
import { MATERIALS, STATUSES } from '../../core/registry';
import { QUALITY_TIERS, qualityRank } from '../../core/data/quality.data';
import { activeMeals, dishLimit, type ActiveMeal } from '../../core/systems/meals';
import { eatPlan } from '../../core/systems/eating';
import { cooldownLeft, consumableSpec } from '../../core/systems/consumables';

/**
 * The words and numbers for dish slots and the queued dish, read from the core
 * (systems/meals.ts, eating.ts) and rendered by `DishSlots.svelte` (the sidebar
 * list) and the Provisions window's Eat button.
 */

/**
 * One line per condition a dish still gives, with the longest time any of its
 * claims on it has left (a dish eaten twice at different grades has two).
 */
function conditionLines(m: ActiveMeal): string[] {
  const ids: string[] = [];
  const left = new Map<string, number | null>();
  for (const c of m.slot.claims) {
    if (c.left !== null && c.left <= 0) continue;
    if (!left.has(c.id)) ids.push(c.id);
    const was = left.get(c.id);
    left.set(c.id, was === undefined ? c.left : was === null || c.left === null ? null : Math.max(was, c.left));
  }
  return ids.map((id) => {
    const def = STATUSES[id];
    return `${def?.icon ?? ''} ${def?.name ?? id}: ${timeLeftText(left.get(id) ?? null)}`.trim();
  });
}

/** "Fair Hearty Stew". */
export function dishLabel(dish: string, quality: QualityTier): string {
  return `${QUALITY_TIERS[quality].name} ${MATERIALS[dish]?.name ?? dish}`;
}

/**
 * Time left as the list shows it, counted down in whole seconds and rounded up, so
 * it never reads "9m 60s" and never reads zero while any time is left. A dish with
 * no clock has no time limit.
 */
export function timeLeftText(ticksLeft: number | null): string {
  if (ticksLeft === null) return 'no time limit';
  const seconds = Math.ceil(Math.max(0, ticksLeft) / 10);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
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
    name: dishLabel(m.slot.dish, m.quality),
    time: timeLeftText(m.ticksLeft),
    conditions: conditionLines(m),
    replacedFirst: full && m === least,
  }));
}

/**
 * The queued dish for the sidebar line, and what it is waiting for right now: the
 * knockout to pass when you are down with no fight on, else the fight. Null when
 * none waits.
 */
export function queuedRow(
  state: GameState,
): { icon: string; name: string; label: string } | null {
  const q = state.queuedMeal;
  if (!q) return null;
  return {
    icon: MATERIALS[q.dish]?.icon ?? '🍽️',
    name: dishLabel(q.dish, q.quality),
    label: state.recovering && !state.combat ? 'After recovering:' : 'After this fight:',
  };
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
    ? `Replaces ${dishLabel(plan.replaces.slot.dish, plan.replaces.quality)}${
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

  if (active) {
    // A helping at least as good as the one still in effect renews it; a worse
    // one never lowers or extends it, and only takes over when it runs out.
    tip.push(
      qualityRank(quality) < qualityRank(active.quality)
        ? `Already active as ${QUALITY_TIERS[active.quality].name} (${timeLeftText(active.ticksLeft)} left): a worse grade takes over when that one runs out.`
        : `Already active (${timeLeftText(active.ticksLeft)} left): eating it again renews its time.`,
    );
  }
  if (replaces) tip.push(`${replaces}. At most ${dishLimit(state)} dishes can be active at once.`);

  if (plan.mode === 'queue') {
    const knockedOut = plan.wait === 'recovery';
    if (plan.queued) {
      return {
        label: 'Queued: cancel',
        disabled: false,
        cancels: true,
        tip: [
          knockedOut
            ? 'It is eaten the moment you are back on your feet. Pressing this takes it off the queue.'
            : 'It is eaten the moment the fight ends. Pressing this takes it off the queue.',
        ],
        replaces: null,
      };
    }
    tip.unshift(
      knockedOut
        ? 'You are knocked out, and conditions run several times faster until you wake. This dish waits and is eaten the moment you are back on your feet. One dish waits at a time: choosing another replaces it.'
        : 'Dishes are eaten between fights. This one waits and is eaten the moment the fight ends. One dish waits at a time: choosing another replaces it.',
    );
    return {
      label: `${base} ${knockedOut ? 'after recovering' : 'after this fight'}`,
      disabled: false,
      cancels: false,
      tip,
      replaces,
    };
  }

  return { label: base, disabled: false, cancels: false, tip, replaces };
}
