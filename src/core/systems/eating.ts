import type { GameState, QualityTier } from '../types';
import type { EventBus } from '../engine/events';
import { MATERIALS } from '../data/materials.data';
import { QUALITY_TIERS, qualityMult } from '../data/quality.data';
import { STATUSES } from '../registry';
import { canUse, canUseOutOfFight, consumableSpec, useConsumable } from './consumables';
import { signatureEarned } from './cookbook';
import { isHarmful } from './conditionHarm';
import { mealToReplace, pruneMeals, sweepMeals, type ActiveMeal } from './meals';
import { text } from '../text/log';

/**
 * Eating a dish: now, or after the fight.
 *
 * Dishes are eaten between fights only (`canUse`). Pressing Eat on a dish
 * during a fight queues it instead (user, 2026-10-24): one dish waits at a time
 * (`state.queuedMeal`), pressing another replaces it, and it can be cancelled.
 * `tickMeals` eats it on the first tick with no fight AND no knockout recovery:
 * recovery runs conditions several times faster (`UNCONSCIOUS_CLOCK_RATE`), and
 * a dish eaten there would burn down while its eater lies on the floor.
 *
 * The queue is run state, so the core tick can fire it with no UI: a dish
 * queued in the last seconds before the tab closes is eaten by the offline
 * catch-up at the first idle tick. Nothing is spent until it fires, and the
 * stock and cooldown are checked again then; if they fail the queue is dropped
 * and the log says why.
 */

/** What pressing Eat on a dish does right now. */
export interface EatPlan {
  /** `eat`: eaten at once. `queue`: waits for the fight to end. `blocked`: refused. */
  mode: 'eat' | 'queue' | 'blocked';
  /** Why a blocked dish cannot be eaten or queued. */
  reason?: string;
  /** This exact dish and grade is already the queued one. */
  queued: boolean;
  /**
   * The dish eating it would push out of its slot: every slot is full and the
   * dish holds none yet. Absent for non-food, spoiled grades and dishes that
   * give nothing nourishing, none of which hold a slot (systems/meals.ts).
   */
  replaces?: ActiveMeal;
}

/** Whether eating this dish at this grade would put it in a dish slot. */
function holdsSlot(state: GameState, id: string, quality: QualityTier): boolean {
  const spec = consumableSpec(id);
  if (!spec?.food || qualityMult(quality) <= 0) return false;
  const gives = [...(spec.grants ?? []), ...(signatureEarned(state, id) ? (spec.signature ?? []) : [])];
  return gives.some((app) => {
    const def = STATUSES[app.id];
    return !!def && !isHarmful(def);
  });
}

/** What pressing Eat on this dish would do. Pure: the UI reads it for the button and its tip. */
export function eatPlan(state: GameState, id: string, quality: QualityTier): EatPlan {
  const spec = consumableSpec(id);
  const queued = state.queuedMeal?.dish === id && state.queuedMeal.quality === quality;
  const queue = !!spec?.food && !!state.combat;
  const check = queue ? canUseOutOfFight(state, id, quality) : canUse(state, id, quality);
  if (!check.ok) return { mode: 'blocked', reason: check.reason, queued };
  const replaces = holdsSlot(state, id, quality) ? mealToReplace(state, id) : undefined;
  return { mode: queue ? 'queue' : 'eat', queued, ...(replaces ? { replaces } : {}) };
}

/**
 * Press Eat. Eats at once, or queues a dish during a fight; a refusal is logged
 * by `useConsumable` and spends nothing.
 */
export function eat(
  state: GameState,
  bus: EventBus,
  id: string,
  quality: QualityTier = 'c',
): 'ate' | 'queued' | 'refused' {
  const plan = eatPlan(state, id, quality);
  if (plan.mode === 'queue') {
    queueMeal(state, bus, id, quality);
    return 'queued';
  }
  return useConsumable(state, bus, id, quality) ? 'ate' : 'refused';
}

/** "Fine Hearty Stew". */
function dishName(id: string, quality: QualityTier): string {
  return `${QUALITY_TIERS[quality].name} ${MATERIALS[id]?.name ?? id}`;
}

function queueMeal(state: GameState, bus: EventBus, id: string, quality: QualityTier): void {
  const was = state.queuedMeal;
  if (was && was.dish === id && was.quality === quality) return;
  state.queuedMeal = { dish: id, quality };
  const grade = QUALITY_TIERS[quality].name;
  const name = MATERIALS[id]?.name ?? id;
  bus.emit({
    type: 'log',
    msg: was
      ? text('meals.queue_replaced', { grade, name, old: dishName(was.dish, was.quality) })
      : text('meals.queued', { grade, name }),
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
 * Once a tick, after the world has moved: free the slots whose dish has run
 * out, and eat the queued dish if the fight and any recovery are over.
 */
export function tickMeals(state: GameState, bus: EventBus): void {
  pruneMeals(state);
  sweepMeals(state);
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
  useConsumable(state, bus, queued.dish, queued.quality, { queued: true });
}
