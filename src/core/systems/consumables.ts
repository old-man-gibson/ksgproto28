import type { ConsumableSpec, GameState, MaterialDef, QualityTier } from '../types';
import type { EventBus } from '../engine/events';
import { MATERIALS } from '../data/materials.data';
import { QUALITY_TIERS, qualityMult } from '../data/quality.data';
import { getDerivedStats } from './derived';
import { availableMax, resourceValue, restoreResource } from './resources';
import { heal } from './health';
import { applyStatus, fireStatusEvent, statusesOf } from './statuses';
import { gradesHeld, knowsRecipe, recipeKey, recipeName, stockOf } from './disciplines';
import { bumpStat } from './achievements';
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
 */

/** What eating something spoiled does to you, whatever it was meant to be. */
export const SPOILED = 'queasy';

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
  const spec = consumableSpec(id);
  if (!spec) return { ok: false, reason: text('consumables.reason.not_usable') };
  const held = MATERIALS[id]?.graded
    ? stockOf(state, id, quality)
    : (state.materials[id] ?? 0);
  if (held < 1) return { ok: false, reason: text('consumables.reason.none_held') };
  if (spec.teaches && knowsRecipe(state, spec.teaches)) {
    return { ok: false, reason: text('consumables.reason.recipe_known') };
  }
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

export interface UseResult {
  /** What each pool actually gained, for the log. */
  restored: { resource: string; amount: number }[];
  /** Status ids granted. */
  granted: string[];
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
): UseResult | null {
  const check = canUse(state, id, quality);
  if (!check.ok) {
    if (check.reason) bus.emit({ type: 'log', msg: text('common.locked', { reason: check.reason }), kind: 'danger' });
    return null;
  }
  const spec = consumableSpec(id)!;
  const def = MATERIALS[id]!;
  if (!consumeOne(state, id, quality)) return null;

  // A recipe card is read, not eaten: it teaches and is gone. No grade, no
  // effects, so none of the eating rules below apply.
  if (spec.teaches) {
    bumpStat(state, bus, recipeKey(spec.teaches));
    bus.emit({
      type: 'log',
      msg: text('consumables.recipe_learned', { name: recipeName(spec.teaches) }),
      kind: 'skill',
    });
    return { restored: [], granted: [], cured: [] };
  }

  const stats = getDerivedStats(state);
  const scale = qualityMult(quality);
  const result: UseResult = { restored: [], granted: [], cured: [] };

  // Instant: the whole thing, now.
  for (const r of spec.restore ?? []) {
    const amount =
      ((r.flat ?? 0) + (r.ofMax ?? 0) * availableMax(state, stats, r.resource)) * scale;
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
    const inst = applyStatus(state, state, { id: SPOILED, intensity: -scale }, def.name);
    if (inst) result.granted.push(inst.id);
  } else {
    for (const app of spec.grants ?? []) {
      const inst = applyStatus(
        state,
        state,
        { ...app, intensity: (app.intensity ?? 1) * scale },
        def.name,
      );
      if (inst) result.granted.push(inst.id);
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
  bus.emit({
    type: 'log',
    msg: text('consumables.used', { icon: def.icon, verb, grade: grade.name, name: def.name }),
    kind: scale < 0 ? 'danger' : 'action',
  });
  return result;
}
