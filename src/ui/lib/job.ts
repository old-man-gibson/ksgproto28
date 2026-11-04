import type { DerivedStats, GameState } from '../../core/types';
import { activityCost, activityFillRate, currentActivity } from '../../core/systems/actions';
import { getDerivedStats } from '../../core/systems/derived';
import { hpFraction } from '../../core/systems/health';
import { huntRest, restingForFight, restTarget } from '../../core/systems/huntrest';
import { monsterStats } from '../../core/systems/monsterStats';
import { DISCIPLINES } from '../../core/registry';
import { ticksToTime } from './format';

/**
 * What the character is doing right now, for the header's job strip
 * (App.svelte, JobStrip.svelte). Pure: it reads the state and returns one
 * description. The states are tested in this order:
 *
 *   travel, recovering, performance, benchWork, combat, resting, activity, idle
 *
 * The first six name something that suppresses the rest (a fight beats the
 * hunt that started it; a knockout beats everything but the walk it ended).
 */

export type JobKind =
  | 'travel'
  | 'recovering'
  | 'performance'
  | 'benchWork'
  | 'combat'
  | 'resting'
  | 'activity'
  | 'idle';

export interface Job {
  kind: JobKind;
  icon: string;
  name: string;
  /** Bar fill, 0 to 1. Null draws no bar (idle, a hunt between fights, an activity with no cycle). */
  pct: number | null;
  /** Ticks to the end of the cycle the bar shows; null when the state has no known end. */
  ticksLeft: number | null;
  /** The text at the end of the strip: the time left, or an HP share. Null = none. */
  detail: string | null;
  /** What the bar measures, as one fact. Shown as the strip's tooltip. */
  tip: string;
}

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);
const pctText = (share: number): string => `${Math.round(clamp01(share) * 100)}%`;

/**
 * `stats` is the derived block; the strip passes `view.stats` so its reads go
 * through the shared cache. Omitted, it reads the cached `getDerivedStats`.
 */
export function currentJob(gs: GameState, stats: DerivedStats = getDerivedStats(gs)): Job {
  if (gs.travel) {
    const t = gs.travel;
    const left = Math.max(0, t.ticksLeft);
    return {
      kind: 'travel',
      icon: '🥾',
      name: 'Traveling',
      pct: t.total > 0 ? clamp01(1 - left / t.total) : 0,
      ticksLeft: left,
      detail: ticksToTime(left),
      tip: 'Bar: share of the walk done.',
    };
  }

  if (gs.recovering) {
    const share = clamp01(hpFraction(gs, stats));
    return {
      kind: 'recovering',
      icon: '💫',
      name: 'Recovering',
      pct: share,
      ticksLeft: null,
      detail: `HP ${pctText(share)}`,
      tip: 'Bar: your HP. Work resumes when recovery ends.',
    };
  }

  if (gs.performance) {
    const p = gs.performance;
    const left = Math.max(0, p.ticksLeft);
    return {
      kind: 'performance',
      icon: '🎵',
      name: 'Performing',
      pct: p.ticksTotal > 0 ? clamp01(1 - left / p.ticksTotal) : 0,
      ticksLeft: left,
      detail: ticksToTime(left),
      tip: 'Bar: share of the performance played.',
    };
  }

  if (gs.benchWork) {
    const b = gs.benchWork;
    const disc = DISCIPLINES[b.disciplineId];
    const left = Math.max(0, b.ticksLeft);
    return {
      kind: 'benchWork',
      icon: disc?.icon ?? '🔨',
      name: disc?.benchName ?? 'Bench work',
      pct: b.ticksPer > 0 ? clamp01(1 - left / b.ticksPer) : 0,
      ticksLeft: left,
      detail: ticksToTime(left),
      tip: 'Bar: share of the current craft done.',
    };
  }

  const act = currentActivity(gs);

  if (gs.combat) {
    const front = gs.combat.enemies[0] ?? null;
    const share = front ? clamp01(front.hp / monsterStats(front).maxHp) : null;
    return {
      kind: 'combat',
      icon: act?.icon ?? '⚔️',
      name: act?.name ?? 'Fight',
      pct: share,
      ticksLeft: null,
      detail: share === null ? null : `Foe HP ${pctText(share)}`,
      tip: front ? `Bar: ${front.name}'s HP.` : 'No foe is up front.',
    };
  }

  if (act?.kind === 'hunt' && restingForFight(gs)) {
    const share = clamp01(hpFraction(gs, stats));
    const target = restTarget(huntRest(gs));
    return {
      kind: 'resting',
      icon: '🛌',
      name: 'Resting before the next fight',
      pct: target > 0 ? clamp01(share / target) : 0,
      ticksLeft: null,
      detail: `HP ${pctText(share)}`,
      tip: `Bar: your HP toward ${pctText(target)}. The next fight starts there.`,
    };
  }

  if (act) {
    const cost = activityCost(act, stats);
    if (cost > 0) {
      const rate = activityFillRate(act, stats, gs);
      const left = rate > 0 ? Math.max(0, (cost - gs.activityProgress) / rate) : null;
      return {
        kind: 'activity',
        icon: act.icon,
        name: act.name,
        pct: clamp01(gs.activityProgress / cost),
        ticksLeft: left,
        detail: left === null ? null : ticksToTime(left),
        tip: 'Bar: share of the current cycle done. Rewards land when it fills.',
      };
    }
    return {
      kind: 'activity',
      icon: act.icon,
      name: act.name,
      pct: null,
      ticksLeft: null,
      detail: null,
      tip: 'This activity has no cycle bar.',
    };
  }

  return {
    kind: 'idle',
    icon: '💤',
    name: 'Idle',
    pct: null,
    ticksLeft: null,
    detail: null,
    tip: 'Nothing is running. Idle time banks bonus time.',
  };
}
