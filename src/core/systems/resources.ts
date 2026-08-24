import type {
  DerivedStats,
  GameState,
  Modifier,
  ResourceDef,
  ResourceId,
  ResourceLock,
} from '../types';
import { RESOURCES, RESOURCE_LIST } from '../data/resources.data';
import { fastOf, fastRegenBonus } from './mutagens';
import { unarmedDamage } from './derived';
import {
  noteResourceSpent,
  statusBlocksRegen,
  statusCeiling,
  statusCostMult,
  statusNegativeHeadroom,
} from './statuses';

/**
 * Resource pools, generically.
 *
 * Every pool has two capacities and they are not the same number:
 *
 *  - its TRUE max, straight off the derived stat (`maxHp`, `maxStamina`, …).
 *    This is what training, gear and titles grow, and it is the number the
 *    reserve floor is measured against;
 *  - its AVAILABLE max, the true max after whatever is currently clamping the
 *    pool shut — a laceration cutting into max HP, rot eating the stamina you
 *    spend. The split matters: a condition that takes 5% off your usable
 *    stamina must NOT drag the 20% reserve down with it, or being wounded
 *    would hand you back spendable stamina as a reward.
 *
 * So: `availableMax` bounds what the pool can hold, `reserveFloor` bounds what
 * ordinary spending may touch, and the two are computed from different maxes.
 */

/** Trims binary-float dust so a drained pool reads as a clean number. */
function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

export function resourceDef(id: ResourceId): ResourceDef {
  return RESOURCES[id];
}

export function resourceValue(state: GameState, id: ResourceId): number {
  return state.resources?.[id] ?? 0;
}

export function setResource(
  state: GameState,
  id: ResourceId,
  value: number,
  /** How far below zero the pool may go. Only a condition ever opens this. */
  floor = 0,
): void {
  state.resources[id] = round4(Math.max(floor, value));
}

/**
 * Draw a pool down, allowing it past zero into debt if something is currently
 * letting it. Manaburn is the case: mana runs negative, the bar goes with it,
 * and the overdraft is what eventually detonates.
 */
export function drainIntoDebt(
  state: GameState,
  stats: DerivedStats,
  id: ResourceId,
  amount: number,
): number {
  const before = resourceValue(state, id);
  const floor = -statusNegativeHeadroom(state, id, trueMax(stats, id));
  setResource(state, id, before - amount, floor);
  return before - resourceValue(state, id);
}

/** Live readings of every pool, for conditions that drain or run a debt. */
export function poolSnapshots(
  state: GameState,
  stats: DerivedStats,
): Partial<Record<ResourceId, { current: number; trueMax: number }>> {
  const out: Partial<Record<ResourceId, { current: number; trueMax: number }>> = {};
  for (const def of RESOURCE_LIST) {
    out[def.id] = { current: resourceValue(state, def.id), trueMax: trueMax(stats, def.id) };
  }
  return out;
}

// ---------- Capacities ----------

/** The pool's full size, before anything clamps it. */
export function trueMax(stats: DerivedStats, id: ResourceId): number {
  return Math.max(0, stats[RESOURCES[id].maxStat]);
}

/**
 * How much of the pool a wound has sealed off, as a share of true max.
 * Status conditions are the source; several wounds multiply together, so they
 * compound rather than overwrite one another.
 */
export function ceilingMult(state: GameState, id: ResourceId): number {
  return statusCeiling(state, id);
}

/**
 * The pool's usable size right now: true max, less anything clamping it.
 *
 * Floored, because a capacity is a whole number — the same rule the derived
 * maxes follow. Without it a wound that seals off 8% of a 1227-point pool
 * leaves the bar reading "1128.8400000000001".
 */
export function availableMax(state: GameState, stats: DerivedStats, id: ResourceId): number {
  return Math.floor(trueMax(stats, id) * ceilingMult(state, id));
}

/**
 * The floor ordinary spending stops at — measured against TRUE max on purpose,
 * so shrinking the usable pool never cheapens the reserve.
 */
export function reserveFloor(stats: DerivedStats, id: ResourceId): number {
  const reserve = RESOURCES[id].reserve;
  return reserve ? trueMax(stats, id) * reserve.share : 0;
}

// ---------- Lockouts ----------

export function resourceLock(state: GameState, id: ResourceId): ResourceLock {
  return state.resourceLocks?.[id] ?? 'none';
}

function setLock(state: GameState, id: ResourceId, lock: ResourceLock): void {
  state.resourceLocks ??= {};
  state.resourceLocks[id] = lock;
}

/** True while the pool may still be spent (neither low- nor empty-locked). */
export function resourceReady(state: GameState, id: ResourceId): boolean {
  return resourceLock(state, id) === 'none';
}

/**
 * The penalties every empty-locked pool is currently imposing, as ordinary
 * modifiers. Exhaustion's action-bar drag lives in resources.data.ts rather
 * than being special-cased here, so a future pool can bite in its own way.
 */
export function lockMods(state: GameState): { mod: Modifier; source: string }[] {
  const out: { mod: Modifier; source: string }[] = [];
  for (const def of RESOURCE_LIST) {
    if (!def.reserve?.emptyPenalty) continue;
    if (resourceLock(state, def.id) !== 'empty') continue;
    for (const mod of def.reserve.emptyPenalty) out.push({ mod, source: def.reserve.emptyName });
  }
  return out;
}

// ---------- Spending ----------

/**
 * Spend from a pool, ignoring the reserve floor. Bottoming out latches the
 * empty lock, so a drain, a poison and an all-in strike all land in the same
 * place. Returns the amount actually paid.
 */
export function spendResource(
  state: GameState,
  id: ResourceId,
  amount: number,
  /** True max, when the caller has the stats to hand — see noteResourceSpent. */
  max?: number,
): number {
  const have = resourceValue(state, id);
  const spent = Math.min(have, Math.max(0, amount));
  setResource(state, id, have - spent);
  if (resourceValue(state, id) <= 0 && RESOURCES[id].reserve) setLock(state, id, 'empty');
  // Rot and its like feed on effort: a condition may eat a share of whatever
  // was just spent, and not give it back when it passes.
  if (max !== undefined) noteResourceSpent(state, id, spent, max);
  return spent;
}

/**
 * Spend from a pool while respecting its reserve floor: pays what it can,
 * latches the low lock on reaching the floor, and pays nothing at all while
 * locked. Returns the amount actually spent.
 */
export function drawResource(
  state: GameState,
  stats: DerivedStats,
  id: ResourceId,
  want: number,
): number {
  if (want <= 0 || !resourceReady(state, id)) return 0;
  const floor = reserveFloor(stats, id);
  const available = resourceValue(state, id) - floor;
  if (available <= 0) {
    // Already at (or under) the floor without a lock — e.g. max just grew.
    // Latch now so the pool has to refill before it pays out again.
    if (RESOURCES[id].reserve) setLock(state, id, 'low');
    return 0;
  }
  const spent = spendResource(state, id, Math.min(want, available), trueMax(stats, id));
  // spendResource latches the empty lock at zero; the floor is our business.
  if (resourceReady(state, id) && resourceValue(state, id) <= floor + 1e-6) {
    setLock(state, id, 'low');
  }
  return spent;
}

/** Put value back into a pool, up to its currently usable maximum. */
export function restoreResource(
  state: GameState,
  stats: DerivedStats,
  id: ResourceId,
  amount: number,
): number {
  if (amount <= 0) return 0;
  const before = resourceValue(state, id);
  const max = availableMax(state, stats, id);
  setResource(state, id, Math.min(max, before + amount));
  return resourceValue(state, id) - before;
}

// ---------- Recovery ----------

/**
 * One tick of recovery for one pool. An empty-locked pool crawls back until it
 * passes `slowUntil`, then recovers normally; any lockout clears the moment the
 * pool is completely full.
 *
 * "Full" means the AVAILABLE max: a wound that seals off part of the pool must
 * not also make the lockout unclearable.
 */
export function regenResource(
  state: GameState,
  stats: DerivedStats,
  id: ResourceId,
  perTick: number,
): void {
  const def = RESOURCES[id];
  const max = availableMax(state, stats, id);
  if (max <= 0) return; // no pool to speak of — nothing to latch
  // Some wounds simply stop you recovering at all.
  if (statusBlocksRegen(state, id)) return;

  if (def.static) {
    setResource(state, id, max);
    return;
  }

  // A pool driven into debt claws back toward zero first; nothing else about
  // it behaves normally until it is out of the red.
  if (resourceValue(state, id) < 0) {
    setResource(state, id, Math.min(0, resourceValue(state, id) + perTick), -Infinity);
    return;
  }

  const lock = resourceLock(state, id);
  const reserve = def.reserve;
  const crawling =
    !!reserve && lock === 'empty' && resourceValue(state, id) < trueMax(stats, id) * reserve.slowUntil;
  // A body that has stopped reaching for the fight puts what it is not spending
  // into staying whole — and into EVERY pool, since a fast that could not
  // recover mana would be unplayable for the caster it otherwise suits. Rooted
  // off what the body itself hits for, never off what it is holding, so a
  // greatsword nobody can swing buys nothing (see `unarmedDamage`).
  // ⚠️ Gate BEFORE computing the damage. `unarmedDamage` resolves an attribute,
  // and as an eagerly-evaluated ARGUMENT it ran once per pool per tick for
  // every body in the game, fasting or not — measured at roughly 2.3× the test
  // suite's wall clock until this line stopped calling it unconditionally.
  const fasting = fastOf(state) ? 1 + fastRegenBonus(state, unarmedDamage(state)) : 1;
  const gain = perTick * (crawling ? reserve!.emptyRegenMult : 1) * fasting;
  setResource(state, id, Math.min(max, resourceValue(state, id) + gain));

  if (!reserve) return;
  if (resourceValue(state, id) <= 0) setLock(state, id, 'empty');
  else if (lock !== 'none' && resourceValue(state, id) >= max) setLock(state, id, 'none');
}

/** What spending this pool currently costs, as a multiplier (1 = as normal). */
export function costMult(state: GameState, id: ResourceId): number {
  return statusCostMult(state, id);
}

/** Per-second regen for a pool, as this tick's share. */
export function regenPerTick(
  stats: DerivedStats,
  id: ResourceId,
  tps: number,
  /** What the current activity does to the rate — 1 is going about your business. */
  mult = 1,
): number {
  const stat = RESOURCES[id].regenStat;
  return stat ? (stats[stat] * mult) / tps : 0;
}

/**
 * Top every pool off toward its maximum for one tick, and keep them all inside
 * their current bounds. Pools with no regen stat are only clamped, and so is
 * HP — health recovers through systems/health.ts's door instead, so that
 * conditions get their say over it (`viaHeal`).
 *
 * Sitting down to rest speeds a pool up by its own `restRegenMult`; a pool that
 * declares none simply refills at its usual rate whatever you are doing.
 */
export function tickResources(
  state: GameState,
  stats: DerivedStats,
  tps: number,
  resting = false,
): void {
  for (const def of RESOURCE_LIST) {
    const max = availableMax(state, stats, def.id);
    if (resourceValue(state, def.id) > max) setResource(state, def.id, max);
    if (def.viaHeal) continue;
    const mult = resting ? (def.restRegenMult ?? 1) : 1;
    if (def.static || def.regenStat) {
      regenResource(state, stats, def.id, regenPerTick(stats, def.id, tps, mult));
    }
  }
}
