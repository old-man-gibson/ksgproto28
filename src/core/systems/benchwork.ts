import type { CraftDisciplineDef, GameState } from '../types';
import type { EventBus } from '../engine/events';
import { DISCIPLINES } from '../data/disciplines.data';
import { getDerivedStats } from './derived';
import { cook, previewCook } from './cooking';
import { brew, previewBrew } from './alchemy';
import { previewRefine, refineOnce } from './mutagens';
import { placed, type Placement } from './disciplines';

/**
 * Bench work: the same layout, worked over and over, on the clock.
 *
 * A single craft at a bench is a click. A RUN is a job: prep this stack of
 * onions, one cut every so many ticks, until the count is met or the stock
 * runs out. It is exclusive with activities — you are standing at the board,
 * not also lifting weights — and bound to the spot it was started at.
 *
 * Speed comes from craftSpeed, floored so a single craft never drops below a
 * legible moment; skill past the floor converts into BATCHING — several
 * crafts resolved per completion — so a master's board is not slower to
 * watch, just busier.
 */

/** No single craft under one second, however fast the hands. */
export const BENCH_FLOOR_TICKS = 10;

/** One timeline unit on a timed bench is one second on the clock. */
export const UNIT_TICKS = 10;

/** Ticks per completion and crafts per completion, from craft speed. */
export function benchPace(craftSpeed: number, baseTicks: number): { ticksPer: number; batch: number } {
  const effective = baseTicks / Math.max(0.1, craftSpeed);
  if (effective >= BENCH_FLOOR_TICKS) return { ticksPer: Math.round(effective), batch: 1 };
  return { ticksPer: BENCH_FLOOR_TICKS, batch: Math.max(1, Math.floor(BENCH_FLOOR_TICKS / effective)) };
}

/**
 * How long one craft takes at this bench, as laid out.
 *
 * Three clocks, per the bench's `work` declaration:
 *  - a TIMED bench (the stove) runs exactly its chosen duration — a stew
 *    simmers as long as a stew simmers, however good the cook;
 *  - `per: 'ingredient'` (the cold counter) adds a helping of `ticks` per
 *    filled slot — more layers, more time;
 *  - `skillScaled` benches divide by craftSpeed, floored, with speed past
 *    the floor converting into several crafts per pass.
 */
export function benchJobTicks(
  state: GameState,
  disc: CraftDisciplineDef,
  placement: Placement,
  duration?: number,
): { ticksPer: number; batch: number } {
  let base: number;
  if (disc.timeline) {
    base = (duration ?? disc.timeline.default) * UNIT_TICKS;
  } else {
    base = disc.ticks;
    if (disc.work?.per === 'ingredient') base *= Math.max(1, placed(placement).length);
  }
  if (disc.work?.skillScaled === false) return { ticksPer: base, batch: 1 };
  return benchPace(getDerivedStats(state).craftSpeed, base);
}

/**
 * Whether a layout would produce anything, whichever bench it is. The run loop
 * does not care what comes out — only that something would — so the two
 * disciplines that own results answer for their own benches here.
 */
function benchPreview(
  state: GameState,
  disc: CraftDisciplineDef,
  placement: Placement,
  duration?: number,
): { ok: boolean; reason?: string } {
  if (disc.refines) return previewRefine(state, placement);
  return disc.ordered ? previewBrew(state, placement, disc) : previewCook(state, placement, disc, duration);
}

/** Work it once. Null means it could not be done and the run should stop. */
function benchCraft(
  state: GameState,
  bus: EventBus,
  disc: CraftDisciplineDef,
  placement: Placement,
  duration?: number,
): unknown {
  if (disc.refines) return refineOnce(state, bus, placement);
  return disc.ordered ? brew(state, bus, placement, disc) : cook(state, bus, placement, disc, duration);
}

export interface BenchWorkStart {
  /** Crafts wanted; null = keep going until the stock runs out. */
  count: number | null;
  /** Duration for a timed bench, in units. */
  duration?: number;
}

/**
 * Start a run. Refuses (with the reason logged) if the layout would not
 * craft. Starting a run makes the bench the whole of what you are doing:
 * any selected activity is dropped.
 */
export function startBenchWork(
  state: GameState,
  bus: EventBus,
  disciplineId: string,
  placement: Placement,
  opts: BenchWorkStart,
): boolean {
  const disc = DISCIPLINES[disciplineId];
  if (!disc) return false;
  const check = benchPreview(state, disc, placement, opts.duration);
  if (!check.ok) {
    if (check.reason) bus.emit({ type: 'log', msg: `🔒 ${check.reason}`, kind: 'danger' });
    return false;
  }

  // The bench is the activity now.
  state.activity = null;
  state.activityProgress = 0;
  state.performance = null;

  const { ticksPer, batch } = benchJobTicks(state, disc, placement, opts.duration);
  state.benchWork = {
    disciplineId,
    spot: state.spot,
    placement: { ...placement },
    remaining: opts.count,
    ticksLeft: ticksPer,
    ticksPer,
    batch,
    duration: opts.duration,
    done: 0,
  };
  // A single craft announces itself when it lands; only a RUN is news now.
  if (opts.count !== 1) {
    bus.emit({
      type: 'log',
      msg: `▶️ ${disc.benchName ?? disc.name}: working${opts.count ? ` ×${opts.count}` : ' until stopped'}`,
      kind: 'action',
    });
  }
  return true;
}

export function stopBenchWork(state: GameState, bus: EventBus, reason?: string): void {
  const job = state.benchWork;
  if (!job) return;
  state.benchWork = null;
  // A single craft finishing quietly already logged its dish.
  if (reason === 'finished' && job.done === 1) return;
  const disc = DISCIPLINES[job.disciplineId];
  bus.emit({
    type: 'log',
    msg: `⏹️ ${disc?.benchName ?? job.disciplineId}: ${reason ?? 'stopped'} (${job.done} done)`,
    kind: 'action',
  });
}

/**
 * One tick of the run. Combat and walking away both abandon it — the pot
 * does not follow you, and neither does the board.
 */
export function tickBenchWork(state: GameState, bus: EventBus): void {
  const job = state.benchWork;
  if (!job) return;
  if (state.spot !== job.spot || state.travel) {
    stopBenchWork(state, bus, 'left behind');
    return;
  }
  if (state.combat) {
    stopBenchWork(state, bus, 'interrupted');
    return;
  }

  job.ticksLeft -= 1;
  if (job.ticksLeft > 0) return;

  const disc = DISCIPLINES[job.disciplineId];
  for (let i = 0; i < job.batch; i++) {
    const made = benchCraft(state, bus, disc, job.placement, job.duration);
    if (!made) {
      // The bench already logged why (out of stock, usually).
      stopBenchWork(state, bus, 'out of stock');
      return;
    }
    job.done += 1;
    if (job.remaining !== null) {
      job.remaining -= 1;
      if (job.remaining <= 0) {
        stopBenchWork(state, bus, 'finished');
        return;
      }
    }
  }
  job.ticksLeft = job.ticksPer;
}
