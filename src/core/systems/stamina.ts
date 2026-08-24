import type { DerivedStats, ExertionSpec, GameState, ResourceId } from '../types';
import { chance } from '../engine/rng';
import { RESOURCES } from '../data/resources.data';
import {
  availableMax,
  costMult,
  drawResource,
  regenResource,
  resourceReady,
  resourceValue,
  spendResource,
} from './resources';

/**
 * Stamina as a fighting resource, spent at two levels.
 *
 *  - UPKEEP: swinging a weapon at all costs a little. The cost tracks how long
 *    the swing took, so a flurry of light blows and one heavy chop cost the
 *    same per second — and that rate sits just under what you recover, so
 *    fighting normally is sustainable and the bar tops back up between fights.
 *  - EXERTION: the style's real bargain (see ExertionSpec), paid only while
 *    you have opted in with `state.exerting`. This is the cost that bites.
 *
 * Two floors govern the pool:
 *
 *  - the RESERVE (20% of max): spending stops there and stays stopped until the
 *    bar is full again — you are `winded`, fighting on technique alone;
 *  - zero: bottoming out (Jigen-ryu's all-in strike, a poison, anything) leaves
 *    you `exhausted` — every action slows, and the first half of the refill
 *    crawls before regen returns to normal.
 *
 * Both locks clear at exactly one moment: a completely full bar.
 *
 * The pool mechanics themselves are generic and live in resources.ts; what is
 * stamina-specific — what a swing costs, what a stance buys with it — is here.
 */

/** Stamina's reserve behaviour, as declared in resources.data.ts. */
const RESERVE = RESOURCES.stamina.reserve!;

/** Spending stops once the pool falls to this share of max. */
export const STAMINA_RESERVE = RESERVE.share;
/** Exhaustion drags every action bar down by this fraction (see lockMods). */
export const EXHAUSTED_SPEED_PENALTY = -(RESERVE.emptyPenalty?.[0]?.value ?? 0);
/** Regen multiplier while exhausted and still below EXHAUSTED_SLOW_UNTIL. */
export const EXHAUSTED_REGEN_MULT = RESERVE.emptyRegenMult;
/** Exhausted regen is slowed until the pool passes this share of max. */
export const EXHAUSTED_SLOW_UNTIL = RESERVE.slowUntil;

/**
 * Upkeep per attack, as a share of the stamina recovered while winding it up.
 * Below 1, so simply fighting never runs you down on its own.
 */
export const UPKEEP_SHARE = 0.9;

/** True while stamina may still be spent (neither winded nor exhausted). */
export function staminaReady(state: GameState): boolean {
  return resourceReady(state, 'stamina');
}

/**
 * Whether the style's exertion is being paid for right now: the player has
 * opted in, and the fuelling pool (stamina by default; a mana-burning school
 * names its own) is above its floor.
 */
export function exerting(state: GameState, pool: ResourceId = 'stamina'): boolean {
  return state.exerting === true && resourceReady(state, pool);
}

/**
 * What one attack costs simply for being thrown, before any style bargain.
 * Priced per second of wind-up (so a flurry of light blows and one heavy chop
 * cost the same over a minute) at just under the rate you recover.
 */
export function attackUpkeep(stats: DerivedStats, secondsPerAttack: number): number {
  return stats.staminaRegen * secondsPerAttack * UPKEEP_SHARE * stats.staminaEff;
}

/**
 * Draw stamina for a cost that respects the reserve floor: pays what it can,
 * latches `winded` on reaching the floor, and pays nothing at all while locked.
 * Returns the amount actually spent.
 */
export function drawStamina(state: GameState, stats: DerivedStats, want: number): number {
  return drawResource(state, stats, 'stamina', want);
}

/**
 * Spend stamina from any source, ignoring the reserve. Bottoming out latches
 * exhaustion, so poisons and drains land the player in the same state a
 * Jigen-ryu strike does. Returns the amount actually paid.
 */
export function spendStamina(state: GameState, amount: number): number {
  return spendResource(state, 'stamina', amount);
}

/** What an exertion actually bought — all fields already scaled by `ratio`. */
export interface Exertion {
  /** Stamina paid. Zero when locked out, out of reserve, or not exerting. */
  spent: number;
  /**
   * How much the spend bought: the share of the intended cost that was
   * affordable, times stamina power — so it can exceed 1 for an efficient
   * fighter paying full price.
   */
  ratio: number;
  damage: number;
  penetration: number;
  splash: number;
  extraHits: number;
  dodge: number;
  armor: number;
  parry: number;
}

export const NO_EXERTION: Exertion = {
  spent: 0,
  ratio: 0,
  damage: 0,
  penetration: 0,
  splash: 0,
  extraHits: 0,
  dodge: 0,
  armor: 0,
  parry: 0,
};

/**
 * Burn stamina for a style's per-event payoff — only while the player has
 * opted in. Costs are a fraction of MAX stamina (so the drain keeps pace as the
 * pool grows) and are trimmed by stamina efficiency; a partial payment buys a
 * proportional bonus, and everything bought is multiplied by stamina power, so
 * a fighter who spends less gets more out of what they do spend. Reaching the
 * reserve floor — or zero, for `drain` styles — latches the lockout.
 */
export function exert(
  state: GameState,
  stats: DerivedStats,
  spec: ExertionSpec | undefined,
): Exertion {
  // The pool is the style's to name — 'mana' is the magiknight seam; the
  // mechanics (fraction of max, efficiency, partial payment, floors) are
  // pool-generic because resources.ts already is.
  const pool = spec?.pool ?? 'stamina';
  const max = pool === 'stamina' ? stats.maxStamina : availableMax(state, stats, pool);
  if (!spec || !exerting(state, pool) || max <= 0) return NO_EXERTION;

  // An all-in style intends to spend a full bar; efficiency can't cheapen what
  // is by definition "everything you have left".
  // A puncture wound makes every effort dearer without making it worth more.
  const eff = pool === 'stamina' ? stats.staminaEff : pool === 'mana' ? stats.manaEff : 1;
  const wound = costMult(state, pool);
  const want = spec.drain ? max : max * spec.cost * eff * wound;
  if (want <= 0) return NO_EXERTION;

  // Draining styles dig below the reserve, all the way into exhaustion.
  const spent = spec.drain
    ? spendResource(state, pool, Math.min(want, resourceValue(state, pool)))
    : drawResource(state, stats, pool, want);
  if (spent <= 0) return NO_EXERTION;

  // Stamina training pays back as power; other pools pay at par.
  const payoff = Math.min(1, spent / want) * (pool === 'stamina' ? stats.staminaPower : 1);
  const hit = spec.hit;
  return {
    spent,
    ratio: payoff,
    damage: (hit?.damage ?? 0) * payoff,
    penetration: (hit?.penetration ?? 0) * payoff,
    splash: (hit?.splash ?? 0) * payoff,
    extraHits: (hit?.extraHits ?? 0) * payoff,
    dodge: (hit?.dodge ?? 0) * payoff,
    armor: (hit?.armor ?? 0) * payoff,
    parry: (hit?.parry ?? 0) * payoff,
  };
}

/** Turn a fractional extra-hit count into whole swings (the fraction is a chance). */
export function rollExtraHits(state: GameState, extraHits: number): number {
  if (extraHits <= 0) return 0;
  const whole = Math.floor(extraHits);
  return whole + (chance(state, extraHits - whole) ? 1 : 0);
}

/**
 * One tick of stamina recovery. Exhaustion halves regen until the pool is back
 * over half, then lets it run normally; a full bar clears any lockout.
 */
export function regenStamina(state: GameState, stats: DerivedStats, perTick: number): void {
  regenResource(state, stats, 'stamina', perTick);
}
