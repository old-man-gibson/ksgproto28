import type { ActivityDef, CloneJob, DerivedStats, GameState, Placement as ForgePlacement } from '../types';
import type { EventBus } from '../engine/events';
import { DISCIPLINES } from '../data/disciplines.data';
import { FLOOR_BY_AREA, MATERIALS, SPOTS } from '../registry';
import { getDerivedStats, scopedMult } from './derived';
import { activityCost, activityFillRate, activityOutputMult, activityXpTags, integerYield } from './actions';
import { grantMaterial, type Placement } from './disciplines';
import { benchJobTicks, cloneCraft } from './benchwork';
import { grantSkillXp, scaledSkillXp } from './skills';
import { bumpStat } from './achievements';
import { logRepeat } from './log';

/*
 * Shadow Clone, deployed (user 2026-11-03). A clone is sent to one task at one
 * spot: a gathering or job activity, or a bench run with its own copy of the
 * layout. It works that task on its own, whatever the player does, until:
 *   A) a clone is sent while every clone is out: the oldest one fades;
 *   B) the player recalls it;
 *   C) the player stands more than max(0, floor((level - 10) / 5)) floors
 *      from it (Threshold and the base are floor 0, the ascent's first floor 1);
 *   D) the player is knocked out, by anything.
 * At work it keeps the player's pace on an activity and yields its share (40%)
 * of the materials or pay; at a bench it makes whole crafts from the player's
 * stock, each taking the bench's time divided by that share. Its skill XP is
 * its own share (25%); it earns no attribute XP. The numbers come from the
 * held ability (facet/host.ts registers them); with no ability, no clones.
 */

/** What the held ability allows: the most clones out at once, a clone's yield share and its skill XP share. */
export interface CloneRules {
  max: number;
  yieldShare: number;
  xpShare: number;
}

interface CloneHost {
  /** The held ability's rules, or null when it has no clones. */
  rules(state: GameState): CloneRules | null;
  /** Told after the clones change, so the ability can show the count and reserve mana. */
  synced(state: GameState): void;
}

let host: CloneHost = { rules: () => null, synced: () => {} };

/** Registered by the ability host (facet/host.ts installFacet). */
export function setCloneHost(next: CloneHost): void {
  host = next;
}

export function cloneRules(state: GameState): CloneRules | null {
  return host.rules(state);
}

/** The floor a spot is on: its ascent floor's index, 0 off the ascent (Threshold, the base). */
export function floorOfSpot(spotId: string): number {
  const spot = SPOTS[spotId];
  return (spot && FLOOR_BY_AREA.get(spot.areaId)?.index) ?? 0;
}

/** How many floors from the player a clone keeps working. */
export function cloneReach(state: GameState): number {
  return Math.max(0, Math.floor((state.level - 10) / 5));
}

type CloneActivity = Extract<ActivityDef, { kind: 'gather' | 'job' }>;

/** A gathering or job activity at a spot, which a clone can work; null otherwise. */
export function cloneActivity(spotId: string, activityId: string | undefined): CloneActivity | null {
  const act = SPOTS[spotId]?.activities?.find((a) => a.id === activityId);
  return act && (act.kind === 'gather' || act.kind === 'job') ? act : null;
}

/** What a clone is doing, for logs and lists: "Wash Out the Retorts" or "Cooking". */
export function cloneTask(job: Pick<CloneJob, 'spot' | 'activity' | 'bench'>): string {
  if (job.bench) return DISCIPLINES[job.bench.disciplineId]?.name ?? job.bench.disciplineId;
  return cloneActivity(job.spot, job.activity)?.name ?? job.activity ?? 'work';
}

function clonesOf(state: GameState): CloneJob[] {
  if (!state.clones) state.clones = [];
  return state.clones;
}

function say(bus: EventBus, msg: string): void {
  bus.emit({ type: 'log', msg, kind: 'action' });
}

function remove(state: GameState, gone: CloneJob[]): void {
  if (!gone.length) return;
  state.clones = clonesOf(state).filter((c) => !gone.includes(c));
  host.synced(state);
}

/** Can a clone be sent now? Null when it can, else why not. */
export function cloneBlocked(state: GameState): string | null {
  const rules = cloneRules(state);
  if (!rules || rules.max < 1) return 'No Shadow Clone';
  if (state.recovering) return 'Knocked out';
  return null;
}

function send(state: GameState, bus: EventBus, job: Omit<CloneJob, 'order'>): boolean {
  const rules = cloneRules(state);
  if (cloneBlocked(state) || !rules) return false;
  const list = clonesOf(state);
  const faded: CloneJob[] = [];
  while (list.length - faded.length >= rules.max) {
    const oldest = list.find((c) => !faded.includes(c))!;
    faded.push(oldest);
    say(bus, `👥 Your oldest clone fades from ${cloneTask(oldest)}.`);
  }
  if (faded.length) state.clones = list.filter((c) => !faded.includes(c));
  const order = clonesOf(state).reduce((n, c) => Math.max(n, c.order), 0) + 1;
  state.clones.push({ order, ...job });
  host.synced(state);
  say(bus, `👥 A clone takes up ${cloneTask(job)} at ${SPOTS[job.spot]?.name ?? job.spot}.`);
  return true;
}

/** Send a clone to a gathering or job activity at the player's spot. */
export function sendCloneToActivity(state: GameState, bus: EventBus, activityId: string): boolean {
  if (!cloneActivity(state.spot, activityId)) return false;
  return send(state, bus, { spot: state.spot, activity: activityId, progress: 0 });
}

/** Send a clone to run a bench layout at the player's spot, on its own clock. */
export function sendCloneToBench(
  state: GameState,
  bus: EventBus,
  disciplineId: string,
  placement: Placement,
  opts: { duration?: number; forge?: ForgePlacement } = {},
): boolean {
  const rules = cloneRules(state);
  const disc = DISCIPLINES[disciplineId];
  if (!rules || !disc) return false;
  const pace = benchJobTicks(state, disc, placement, opts.duration, opts.forge);
  const ticksPer = Math.ceil(pace.ticksPer / rules.yieldShare);
  return send(state, bus, {
    spot: state.spot,
    bench: {
      disciplineId,
      placement: JSON.parse(JSON.stringify(placement)),
      duration: opts.duration,
      forge: opts.forge ? JSON.parse(JSON.stringify(opts.forge)) : undefined,
      ticksPer,
      ticksLeft: ticksPer,
      batch: pace.batch,
    },
    progress: 0,
  });
}

/** Recall one clone by its order. */
export function recallClone(state: GameState, bus: EventBus, order: number): boolean {
  const job = clonesOf(state).find((c) => c.order === order);
  if (!job) return false;
  remove(state, [job]);
  say(bus, `👥 You recall the clone from ${cloneTask(job)}.`);
  return true;
}

/** Recall every clone. */
export function recallClones(state: GameState, bus: EventBus): number {
  const all = [...clonesOf(state)];
  remove(state, all);
  if (all.length) say(bus, `👥 You recall ${all.length === 1 ? 'your clone' : `all ${all.length} clones`}.`);
  return all.length;
}

/** Each game tick: the end rules, then each clone's work. */
export function tickClones(state: GameState, bus: EventBus): void {
  const list = state.clones;
  if (!list?.length) return;
  const rules = cloneRules(state);
  if (!rules) {
    remove(state, [...list]);
    return;
  }
  if (state.recovering) {
    remove(state, [...list]);
    say(bus, '👥 Knocked out: your clones vanish.');
    return;
  }
  // Fewer allowed than are out (a reset level): the oldest go first.
  if (list.length > rules.max) remove(state, list.slice(0, list.length - rules.max));
  const reach = cloneReach(state);
  const here = floorOfSpot(state.spot);
  const far = state.clones.filter((c) => Math.abs(floorOfSpot(c.spot) - here) > reach);
  for (const c of far) say(bus, `👥 Too far away: your clone at ${cloneTask(c)} vanishes.`);
  remove(state, far);
  // Work whose activity no longer exists (content changed under a save) ends quietly.
  remove(state, state.clones.filter((c) => !c.bench && !cloneActivity(c.spot, c.activity)));
  if (!state.clones.length) return;
  const stats = getDerivedStats(state);
  for (const c of state.clones) {
    if (c.bench) workBench(state, bus, c.bench, rules);
    else workActivity(state, bus, c, cloneActivity(c.spot, c.activity)!, rules, stats);
  }
}

function workActivity(
  state: GameState,
  bus: EventBus,
  job: CloneJob,
  act: CloneActivity,
  rules: CloneRules,
  stats: DerivedStats,
): void {
  job.progress += activityFillRate(act, stats, state);
  const cost = activityCost(act, stats);
  if (job.progress < cost) return;
  job.progress -= cost;
  const tags = activityXpTags(act);
  grantSkillXp(state, bus, tags, 0.25 * act.ticksPer * rules.xpShare);
  if (act.kind === 'gather') {
    const amount = integerYield(state, activityOutputMult(state, stats, act) * rules.yieldShare);
    if (amount <= 0) return;
    grantMaterial(state, act.material, amount, stats.loot * scopedMult(state, 'loot', tags));
    bumpStat(state, bus, `gather:${act.material}`, amount);
    const mat = MATERIALS[act.material];
    logRepeat(bus, {
      group: `clone:${job.order}`,
      prefix: '👥 Clone gathered:',
      tally: [{ label: `${mat?.icon ?? '📦'} ${mat?.name ?? act.material}`, qty: amount }],
      kind: 'loot',
    });
  } else {
    const mult = act.outputFactors?.length ? activityOutputMult(state, stats, act) : stats.goldGain;
    const pay = Math.round(act.gold * mult * rules.yieldShare);
    if (pay <= 0) return;
    state.gold += pay;
    bumpStat(state, bus, 'gold:earned', pay);
    logRepeat(bus, {
      group: `clone:${job.order}`,
      prefix: '👥 Clone pay:',
      tally: [{ label: 'gold', qty: pay, style: 'amount' }],
      kind: 'action',
    });
  }
}

function workBench(state: GameState, bus: EventBus, bench: NonNullable<CloneJob['bench']>, rules: CloneRules): void {
  bench.ticksLeft -= 1;
  if (bench.ticksLeft > 0) return;
  bench.ticksLeft = bench.ticksPer;
  // Short of stock it waits for the next pass rather than leaving.
  scaledSkillXp(rules.xpShare, () => {
    for (let i = 0; i < bench.batch; i++) {
      if (!cloneCraft(state, bus, bench.disciplineId, bench.placement, bench.duration, bench.forge)) break;
    }
  });
}
