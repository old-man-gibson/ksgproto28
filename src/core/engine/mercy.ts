import type { GameState } from '../types';
import { rand } from './rng';

/**
 * Drought prevention: a drop's chance climbs with every roll that misses it,
 * and resets the moment it lands.
 *
 * A plain `chance(state, 0.01)` is memoryless, so the wait between drops is
 * geometric — and a geometric tail is fat. At 1% the 99th-percentile wait is
 * 459 kills against a mean of 100, and the player who lands there is not
 * unlucky in any way the game can distinguish from broken.
 *
 * So the chance escalates instead: `P(n) = base + n * slope`, where `n` is the
 * number of consecutive misses on record. Both numbers are SOLVED (see
 * `mercyCurve`) so that the long-run rate is exactly the authored one. Nothing
 * in the drop tables changes meaning — a weight of 1 in 100 is still a 1%
 * drop, it just stops arriving in clumps.
 *
 * What this buys, measured at 1% (`tests/mercy.test.ts` asserts these):
 *
 * | | plain | mercy 0.85 |
 * |---|---|---|
 * | median wait | 69 | 93 |
 * | 99th percentile | 459 | 251 |
 * | 99.9th percentile | 688 | 306 |
 *
 * Read the median row before touching `MERCY`. The mean is pinned by
 * construction, so cutting the tail HAS to push the middle right: half of all
 * drops arrive later than they used to. That is the trade, and it is the trade
 * the drought is worth paying for — but it is not a free improvement, and a
 * player who never droughted has only lost something.
 *
 * The player is never told any of this. There is no UI, no counter, no "the
 * trail is warm" — the mechanic's whole job is to make the numbers behave the
 * way players already believe they behave.
 *
 * TWO DOMAINS, and they are not interchangeable. **Drops** are protected when
 * they are rare (`mercyTracked`, under 15%) and run uncapped, because the only
 * way to make a wolf owe you a fang blade is to kill wolves — the counter and
 * the reward come from the same act. **Procs** (crit, and the same lane as
 * dodge and parry) are protected when they are common (`procTracked`, 15% and
 * up) and run capped, because the counter is advanced by any swing at all and
 * spent on whichever swing you choose. Everything below the constants explains
 * why the thresholds point in opposite directions; the short version is that
 * both ask the same question — *is the run long enough for escalation to pay?*
 * — of runs four orders of magnitude apart.
 */

/**
 * How far below nominal the first roll after a hit starts, 0–1.
 *
 * 0 is plain geometric (no mercy at all); 1 is the pure form, where the first
 * roll is a rounding error and essentially all of the rate is earned back
 * through escalation. Between them it is a dial on how much *early luck*
 * survives: at 1% nominal, mercy 0.5 leaves the first roll at 0.50%, 0.85
 * leaves it at 0.16%, and 1.0 leaves it at 0.016%.
 *
 * 0.85 takes nearly the whole tail cut that the pure form does (99th
 * percentile 251 vs 241 kills) while keeping the first roll an order of
 * magnitude higher, so a drop can still turn up early — rarely, but it can.
 * Past ~0.85 the tail barely moves and only the early luck keeps dying.
 */
export const MERCY = 0.85;

/**
 * Rates at or above this roll plain, untracked — for DROPS.
 *
 * 15% droughts to about 28 misses at the 99th percentile. That is a bad
 * evening, not a grievance, and it is not worth a save key per monster per
 * entry to fix. Mercy is for the things that make a player check the wiki.
 */
export const MERCY_MAX_RATE = 0.15;

/**
 * The same number, read the other way, for COMBAT PROCS — a crit is protected
 * only if it is common ENOUGH.
 *
 * The thresholds look opposite and are the same rule: escalation only pays off
 * over a run longer than roughly `2/rate` rolls, and the run is thousands of
 * kills for a drop but the dozen swings of one fight for a proc. Under that
 * length mercy is not merely useless, it is BACKWARDS — the cold first rolls
 * dominate and short dry spells get more likely, not less. Measured over 8
 * swings, the odds of no crit at all:
 *
 * |  crit | plain | with mercy |
 * |---|---|---|
 * | 5% | 66.3% | 84.2% — worse |
 * | 10% | 43.0% | 56.2% — worse |
 * | 20% | 16.8% | **10.2%** |
 * | 30% | 5.8% | **0.1%** |
 *
 * So the game's 5% floor (`5% + 0.15% × DEX`) keeps rolling exactly as it
 * always has, and the smoothing arrives with the DEX that makes crits a plan.
 */
export const PROC_MIN_RATE = 0.15;

/**
 * A proc's escalation stops here: `min(rate × 3, 75%)`.
 *
 * Drops need no cap because the counter and the reward come from the same act —
 * the only way to make a wolf owe you a fang blade is to kill wolves. A proc
 * counter can be advanced CHEAPLY and spent EXPENSIVELY: swing at the training
 * dummy until the next crit is guaranteed, then walk into the boss. The cap is
 * what makes that ritual not worth performing, and it is nearly free — at 20%
 * crit it changes the odds of an 8-swing dry spell by 0.01pp (10.17% against
 * 10.18% uncapped) while taking the purchasable certainty off the table.
 */
export const PROC_CAP_MULT = 3;
export const PROC_CAP_MAX = 0.75;

/** True when a rate is rare enough for a DROP to be worth tracking. */
export function mercyTracked(rate: number): boolean {
  return rate > 0 && rate < MERCY_MAX_RATE;
}

/** True when a PROC is frequent enough that smoothing it helps rather than hurts. */
export function procTracked(rate: number): boolean {
  return rate >= PROC_MIN_RATE && rate < 1;
}

/** Where the escalation is on a curve, given the misses on record. */
export interface MercyCurve {
  /** Chance on the first roll after a hit. */
  base: number;
  /** Added per consecutive miss. */
  slope: number;
  /** The escalation stops climbing here (1 = no cap; see PROC_CAP_MULT). */
  cap: number;
}

/**
 * Expected rolls per hit for a curve: `E[N] = Σ S(n)`, the sum of the odds of
 * still being empty-handed after n rolls. Uncapped the series is
 * Gaussian-tailed and dies at roughly `6/rate` terms; a cap gives it a
 * geometric tail at the cap's own rate, which dies faster still.
 */
function meanRolls(base: number, slope: number, cap: number): number {
  let sum = 0;
  let survival = 1;
  for (let n = 0; n < 500_000 && survival > 1e-13; n++) {
    sum += survival;
    const p = Math.min(cap, base + n * slope);
    if (p >= 1) break;
    survival *= 1 - p;
  }
  return sum;
}

const CURVES = new Map<number, MercyCurve>();

/**
 * Solve the curve whose long-run rate is exactly `rate`.
 *
 * The slope is found by bisection: both `base` and `slope` rise together (the
 * mercy dial ties them), so the achieved rate is monotonic in the slope and 60
 * halvings pin it to machine precision. A `cap` is solved around, not applied
 * afterwards — clamping a solved curve would quietly lower its rate.
 *
 * Memoized on the rounded inputs because `rate` is a moving float on both
 * sides: loot luck makes the same 1% drop a different number under a different
 * hat, and a crit chance moves with every point of DEX. The key is arithmetic
 * rather than a string — this runs inside the per-blow combat path, where an
 * allocation per roll would be a real cost.
 *
 * Cost is one bisection over a `6/rate`-term series: a few microseconds at
 * proc rates, a few hundred at ordinary drop rates, a millisecond or two at
 * the very rare end. Paid once per distinct rate per session.
 */
export function mercyCurve(rate: number, mercy: number = MERCY, cap: number = 1): MercyCurve {
  if (mercy <= 0 || rate <= 0 || rate >= 1) return { base: rate, slope: 0, cap: 1 };
  const key = Math.round(rate * 1e5) * 1e6 + Math.round(mercy * 1e3) * 1e3 + Math.round(cap * 1e3);
  const cached = CURVES.get(key);
  if (cached) return cached;

  const baseFor = (slope: number) => rate * (1 - mercy) + slope * mercy;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const slope = (lo + hi) / 2;
    if (1 / meanRolls(baseFor(slope), slope, cap) > rate) hi = slope;
    else lo = slope;
  }
  const slope = (lo + hi) / 2;
  const curve = { base: baseFor(slope), slope, cap };
  CURVES.set(key, curve);
  return curve;
}

/** Misses on record for a key. */
export function mercyMisses(state: GameState, key: string): number {
  return state.mercy?.[key] ?? 0;
}

/** Where a curve sits after the misses on record. */
function curveRate(state: GameState, key: string, curve: MercyCurve): number {
  return Math.min(curve.cap, curve.base + mercyMisses(state, key) * curve.slope);
}

/**
 * The chance a tracked DROP actually rolls at right now.
 *
 * Callers that want to SHOW a rate should show the authored one instead — this
 * is the instantaneous number, and it is only true until the next roll.
 */
export function mercyRate(state: GameState, key: string, rate: number, mercy: number = MERCY): number {
  if (!mercyTracked(rate)) return rate;
  return curveRate(state, key, mercyCurve(rate, mercy));
}

/** The same, for a combat PROC — different threshold, and capped. */
export function procRate(state: GameState, key: string, rate: number): number {
  if (!procTracked(rate)) return rate;
  return curveRate(state, key, mercyCurve(rate, MERCY, Math.min(PROC_CAP_MAX, rate * PROC_CAP_MULT)));
}

/** Record a miss. Keys are created lazily and cleared on a hit, so the map stays sparse. */
export function mercyMiss(state: GameState, key: string): void {
  if (!state.mercy) state.mercy = {};
  state.mercy[key] = (state.mercy[key] ?? 0) + 1;
}

/** Record a hit: the debt is paid, the key goes away. */
export function mercyHit(state: GameState, key: string): void {
  if (state.mercy) delete state.mercy[key];
}

/** Roll at `p`, keeping the ledger if this roll is one of the tracked ones. */
function roll(state: GameState, key: string, p: number, tracked: boolean): boolean {
  const hit = rand(state) < p;
  // A hit clears the key even on an untracked roll (a rate can climb out of
  // its band — loot bonuses and DEX both do it), so a counter can never be
  // left standing to pay out twice.
  if (hit) mercyHit(state, key);
  else if (tracked) mercyMiss(state, key);
  return hit;
}

/**
 * Roll an independent chance under drop mercy. Drop-in for `chance()` at any
 * roll that is a DROP — something the player is waiting for and can count.
 */
export function mercyChance(state: GameState, key: string, rate: number, mercy: number = MERCY): boolean {
  return roll(state, key, mercyRate(state, key, rate, mercy), mercyTracked(rate));
}

/**
 * Roll a combat PROC under mercy: a crit, and the same lane as dodge, parry
 * and miss when those are wanted. Below `PROC_MIN_RATE` this is exactly
 * `chance()` and touches nothing.
 *
 * Key it per roller and per proc — `proc:crit` for the player, whose swings are
 * one long continuous run, and `proc:crit:<defId>` for a monster, whose
 * individuals are transient but whose species is not. A counter that died with
 * each monster would sit cold for the whole of most fights and quietly deliver
 * less than the authored rate (at 20%, about 17% over a ten-swing fight), which
 * would be a silent stat change on one side of the swing only.
 */
export function procChance(state: GameState, key: string, rate: number): boolean {
  return roll(state, key, procRate(state, key, rate), procTracked(rate));
}

/**
 * Weighted pick with mercy on whichever entries `keyOf` names.
 *
 * The table's own shares are what a tracked entry escalates AROUND, so
 * `weight / total` is read as that entry's rate and its mercy rate replaces it.
 * Everything untracked keeps its shape and shares out whatever mass is left —
 * which in a drop table means the `nothing` entry absorbs the difference,
 * exactly as it already does for loot luck.
 *
 * Returning `null` from `keyOf` opts an entry out (the `nothing` line itself,
 * anything common enough not to drought, anything whose key the caller cannot
 * form). An entry that is out is not written to, not read from, and not
 * distinguishable from how it behaves today.
 *
 * Consumes exactly one `rand()`, like the plain pick it replaces, so the
 * random stream downstream of it does not shift.
 */
export function mercyPick<T extends { weight: number }>(
  state: GameState,
  entries: T[],
  keyOf: (entry: T, rate: number) => string | null,
  mercy: number = MERCY,
): T {
  const total = entries.reduce((s, e) => s + e.weight, 0);
  if (total <= 0) return entries[entries.length - 1];

  const keys: (string | null)[] = [];
  const weights: number[] = [];
  let tracked = 0;
  let loose = 0;
  for (const e of entries) {
    const rate = e.weight / total;
    const key = keyOf(e, rate);
    keys.push(key);
    if (key === null) {
      weights.push(rate);
      loose += rate;
    } else {
      const p = mercyRate(state, key, rate, mercy);
      weights.push(p);
      tracked += p;
    }
  }

  // Tracked entries own their exact odds; the rest divide the remainder in
  // their own proportions. Two degenerate shapes fall back to plain
  // normalization, which is self-correcting rather than exact — whichever
  // entry is most overdue is favoured, and an entry that keeps losing keeps
  // climbing. Neither is reachable from authored content today (every drop
  // table has an entry above the tracking threshold): tracked demand over
  // 100%, which needs a table of rare lines all maturing at once, and a table
  // with no untracked entry at all to absorb the difference.
  const spare = Math.max(0, 1 - tracked);
  if (loose > 0) {
    for (let i = 0; i < entries.length; i++) {
      if (keys[i] === null) weights[i] = (weights[i] / loose) * spare;
    }
  }

  let roll = rand(state) * weights.reduce((s, w) => s + w, 0);
  let picked = entries.length - 1;
  for (let i = 0; i < entries.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      picked = i;
      break;
    }
  }

  for (let i = 0; i < entries.length; i++) {
    const key = keys[i];
    if (key === null) continue;
    if (i === picked) mercyHit(state, key);
    else mercyMiss(state, key);
  }
  return entries[picked];
}
