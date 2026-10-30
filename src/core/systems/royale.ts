import type { EventBus } from '../engine/events';
import type { FestivalRun, GameState, RoyaleStrategyDef } from '../types';
import { ROYALE_STRATEGIES, SPOTS } from '../registry';
import {
  ARENA,
  DEFAULT_ROYALE_PLAN,
  ROYALE_PLAN_SLOTS,
  SURVIVOR_CHAMPION,
  SURVIVOR_LEVELS,
  SURVIVOR_SPECIES,
} from '../data/festival.data';
import { rand } from '../engine/rng';
import { startStagedGroup } from './combat';
import { getDerivedStats } from './derived';
import { hpFraction } from './health';
import { prepShare, survivorLevel } from './festivalRules';
import { clearEngaged, createField, stepField } from './royaleField';
import { text } from '../text/log';

/**
 * The royale on floor 16 (docs/FLOOR_IDEAS.md §5.3 items 13 and 18): the
 * isometric field (systems/royaleField.ts, drawn by ui/lib/RoyaleField.svelte)
 * with its engagements fought in the battle stage. The player moves by a
 * ranked plan of strategies, or by hand at any time; a plan alone can win.
 *
 * The survivors who reach the player become an ordinary staged fight at the
 * arena, at their own levels and with the wounds they carry. Won, they leave
 * the field. The last survivor is the champion, fought alone: floor 16's
 * boss line, so its fall is the win (systems/festival.ts counts it).
 */

/** The player's ranked strategies: their own, or the default plan. Unknown ids are skipped. */
export function royalePlan(state: GameState): RoyaleStrategyDef[] {
  const ids = state.festival?.plan?.length ? state.festival.plan : DEFAULT_ROYALE_PLAN;
  return ids.map((id) => ROYALE_STRATEGIES[id]).filter((s): s is RoyaleStrategyDef => !!s);
}

/** Rank the player's strategies (at most ROYALE_PLAN_SLOTS, known ids only, no repeats). */
export function setRoyalePlan(state: GameState, ids: string[]): void {
  const plan = [...new Set(ids)].filter((id) => !!ROYALE_STRATEGIES[id]).slice(0, ROYALE_PLAN_SLOTS);
  if (!state.festival) state.festival = {};
  state.festival.plan = plan;
}

/**
 * Send the player to a point on the field by hand (§5.3 item 18). The plan
 * takes over again on arrival. Ignored off the field.
 */
export function moveOnField(state: GameState, x: number, y: number): boolean {
  const field = state.festival?.run?.field;
  if (!field || state.spot !== ARENA || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const size = field.size;
  field.player.target = { x: Math.max(0, Math.min(size, x)), y: Math.max(0, Math.min(size, y)) };
  return true;
}

/** Clear a hand-set destination: the plan decides again. */
export function clearFieldTarget(state: GameState): void {
  const field = state.festival?.run?.field;
  if (field?.player.target) delete field.player.target;
}

/** Every species' plan, resolved once. */
const SPECIES_PLANS = new Map(
  SURVIVOR_SPECIES.map((s) => [
    s.monsterId,
    s.plan.map((id) => ROYALE_STRATEGIES[id]).filter((d): d is RoyaleStrategyDef => !!d),
  ]),
);

/** One tick of the field while the player stands on it. */
export function tickRoyale(state: GameState, bus: EventBus, run: FestivalRun): void {
  // A field from before the isometric layer (a counter) is replaced whole.
  if (!run.field?.fighters) run.field = createField(() => rand(state));
  const field = run.field;
  // A fight is staged the tick its survivors are engaged, and a won one takes
  // them off the field, so engaged survivors with no fight are left over from
  // a fight dropped without an ending (a reload mid-fight): they walk again.
  if (!state.combat) {
    for (const f of field.fighters) if (f.engaged) delete f.engaged;
  }
  const stats = getDerivedStats(state);
  const baseLevel = SURVIVOR_LEVELS.base + Math.round(SURVIVOR_LEVELS.growth * prepShare(run.clock));
  const result = stepField(
    field,
    {
      now: state.totalTicks,
      rng: () => rand(state),
      playerFree: !state.combat,
      playerHp: hpFraction(state, stats),
      playerPower: state.level,
      playerSpeed: stats.travelSpeed,
      plan: royalePlan(state),
      planOf: (id) => SPECIES_PLANS.get(id) ?? [],
    },
    baseLevel,
  );
  if (result.engaged.length === 0) return;
  // The last survivor is the champion, whatever it walked the field as.
  const last = field.fighters.length === 1;
  startStagedGroup(
    state,
    bus,
    SPOTS[ARENA],
    result.engaged.map((f) => ({
      monsterId: last ? SURVIVOR_CHAMPION : f.monsterId,
      level: survivorLevel(run.clock, f.wins, last),
      hpShare: f.hp,
    })),
  );
}

/**
 * The player's fight on the field was won: the survivors in it are gone.
 * True when none are left, which is the royale won.
 */
export function royaleFightWon(state: GameState, bus: EventBus, run: FestivalRun): boolean {
  const field = run.field;
  if (!field?.fighters) return false;
  clearEngaged(field);
  const left = field.fighters.length;
  if (left > 0) bus.emit({ type: 'log', msg: text('festival.field_left', { alive: left }), kind: 'combat' });
  return left === 0;
}
