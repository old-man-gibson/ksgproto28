import type { GameState, QualityTier } from '../types';
import type { EventBus } from '../engine/events';
import { MATERIALS } from '../data/materials.data';
import { QUALITY_TIERS } from '../data/quality.data';
import { canUse, canUseOutOfFight, consumableSpec, useConsumable } from './consumables';
import { dishHoldsSlot, mealToReplace, type ActiveMeal } from './meals';
import { text } from '../text/log';

/**
 * Eating a dish: now, or after the fight.
 *
 * Dishes are eaten between fights only (`canUse`). Pressing Eat on a dish
 * during a fight queues it instead (user, 2026-10-24): one dish waits at a time
 * (`state.queuedMeal`), pressing another replaces it, and it can be cancelled.
 * `tickMeals` eats it on the first tick with no fight AND no knockout recovery:
 * recovery runs conditions several times faster (`conditionClockRate`), and a
 * dish eaten there would burn down while its eater lies on the floor. For the
 * same reason Eat pressed while knocked out, with no fight on, queues too: it
 * waits for the recovery.
 *
 * The queue is run state, so the core tick can fire it with no UI: a dish
 * queued in the last seconds before the tab closes is eaten by the offline
 * catch-up at the first idle tick. Nothing is spent until it fires, and the
 * stock and cooldown are checked again then; if they fail the queue is dropped
 * and the log says why.
 */

/** What a dish waits for. */
export type MealWait = 'fight' | 'recovery';

/** What pressing Eat on a dish does right now. */
export interface EatPlan {
  /** `eat`: eaten at once. `queue`: waits. `blocked`: refused. */
  mode: 'eat' | 'queue' | 'blocked';
  /** Why a blocked dish cannot be eaten or queued. */
  reason?: string;
  /** What a queued dish waits for: the fight to end, or the knockout to pass. */
  wait?: MealWait;
  /** This exact dish and grade is already the queued one. */
  queued: boolean;
  /**
   * The dish eating it would push out of its slot: every slot is full and the
   * dish holds none yet. Absent for non-food, spoiled grades and dishes that
   * give nothing nourishing, none of which hold a slot (systems/meals.ts).
   */
  replaces?: ActiveMeal;
}

/** What a dish pressed now has to wait for, if anything. */
function waitFor(state: GameState, id: string): MealWait | undefined {
  if (!consumableSpec(id)?.food) return undefined;
  if (state.combat) return 'fight';
  if (state.recovering) return 'recovery';
  return undefined;
}

/** What pressing Eat on this dish would do. Pure: the UI reads it for the button and its tip. */
export function eatPlan(state: GameState, id: string, quality: QualityTier): EatPlan {
  const queued = state.queuedMeal?.dish === id && state.queuedMeal.quality === quality;
  const wait = waitFor(state, id);
  const check = wait ? canUseOutOfFight(state, id, quality) : canUse(state, id, quality);
  if (!check.ok) return { mode: 'blocked', reason: check.reason, queued };
  const replaces = dishHoldsSlot(state, id, quality) ? mealToReplace(state, id) : undefined;
  return { mode: wait ? 'queue' : 'eat', ...(wait ? { wait } : {}), queued, ...(replaces ? { replaces } : {}) };
}

/**
 * Press Eat. Eats at once, or queues a dish during a fight or a knockout; a
 * refusal is logged by `useConsumable` and spends nothing.
 */
export function eat(
  state: GameState,
  bus: EventBus,
  id: string,
  quality: QualityTier = 'c',
): 'ate' | 'queued' | 'refused' {
  const plan = eatPlan(state, id, quality);
  if (plan.mode === 'queue') {
    queueMeal(state, bus, id, quality, plan.wait ?? 'fight');
    return 'queued';
  }
  return useConsumable(state, bus, id, quality) ? 'ate' : 'refused';
}

/** "Fine Hearty Stew". */
function dishName(id: string, quality: QualityTier): string {
  return `${QUALITY_TIERS[quality].name} ${MATERIALS[id]?.name ?? id}`;
}

function queueMeal(state: GameState, bus: EventBus, id: string, quality: QualityTier, why: MealWait): void {
  const was = state.queuedMeal;
  if (was && was.dish === id && was.quality === quality) return;
  state.queuedMeal = { dish: id, quality, why };
  const grade = QUALITY_TIERS[quality].name;
  const name = MATERIALS[id]?.name ?? id;
  const when = text(why === 'recovery' ? 'meals.when_recovery' : 'meals.when_fight');
  bus.emit({
    type: 'log',
    msg: was
      ? text('meals.queue_replaced', { grade, name, old: dishName(was.dish, was.quality), when })
      : text('meals.queued', { grade, name, when }),
    kind: 'action',
  });
}

/** Take the queued dish back off the queue. False when nothing was queued. */
export function cancelQueuedMeal(state: GameState, bus: EventBus): boolean {
  const was = state.queuedMeal;
  if (!was) return false;
  state.queuedMeal = null;
  bus.emit({
    type: 'log',
    msg: text('meals.queue_cancelled', {
      grade: QUALITY_TIERS[was.quality].name,
      name: MATERIALS[was.dish]?.name ?? was.dish,
    }),
    kind: 'action',
  });
  return true;
}

/**
 * At the start of a tick: eat the queued dish if the fight and any recovery are
 * over. (The slots' clocks run at the end of the tick, `tickMealClaims`.)
 */
export function tickMeals(state: GameState, bus: EventBus): void {
  const queued = state.queuedMeal;
  if (!queued || state.combat || state.recovering) return;
  // Cleared first: eating logs and may raise events, and none of it may fire
  // the same dish twice.
  state.queuedMeal = null;
  const check = canUse(state, queued.dish, queued.quality);
  if (!check.ok) {
    bus.emit({
      type: 'log',
      msg: text('meals.queue_dropped', {
        grade: QUALITY_TIERS[queued.quality].name,
        name: MATERIALS[queued.dish]?.name ?? queued.dish,
        reason: check.reason ?? text('consumables.reason.not_usable'),
      }),
      kind: 'danger',
    });
    return;
  }
  useConsumable(state, bus, queued.dish, queued.quality, { queued: queued.why ?? 'fight' });
}
