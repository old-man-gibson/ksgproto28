import type { ActivityDef, GameState, SearchReward } from '../types';
import { rand } from '../engine/rng';
import { conditionsMet } from './conditions';
import type { EventBus } from '../engine/events';
import { bumpStat } from './achievements';

type SearchActivity = Extract<ActivityDef, { kind: 'search' }>;

export const searchKey = (spot: string, activity: string): string => `flag:search:${spot}:${activity}`;

/** The rewards a search can pay now: positive weight, under its `limit`, `requires` met. */
function eligibleRewards(state: GameState, spot: string, act: SearchActivity): SearchReward[] {
  const key = searchKey(spot, act.id);
  return act.rewards.filter((r) => r.weight > 0 &&
    (r.limit === undefined || (state.stats[`${key}:${r.id}`] ?? 0) < r.limit) && conditionsMet(state, r.requires ?? []));
}

/**
 * A search with no eligible reward left: every remaining entry is limit-spent
 * or has unmet `requires`. Shares `rollSearch`'s eligibility, so it is true
 * exactly when a roll would find nothing. `canStartActivity` refuses a spent
 * search, and a running one stops on the cycle that finds nothing.
 */
export function searchSpent(state: GameState, spot: string, act: SearchActivity): boolean {
  return eligibleRewards(state, spot, act).length === 0;
}

export function rollSearch(state: GameState, bus: EventBus, spot: string, act: SearchActivity): SearchReward | null {
  const key = searchKey(spot, act.id);
  bumpStat(state, bus, key);
  const eligible = eligibleRewards(state, spot, act);
  if (!eligible.length) return null;
  const guaranteed = eligible.find((r) => r.guaranteedBy !== undefined && state.stats[key] >= r.guaranteedBy && !state.stats[`${key}:${r.id}`]);
  let chosen = guaranteed;
  if (!chosen) {
    let roll = rand(state) * eligible.reduce((n, r) => n + r.weight, 0);
    chosen = eligible.find((r) => (roll -= r.weight) < 0) ?? eligible[eligible.length - 1];
  }
  bumpStat(state, bus, `${key}:${chosen.id}`);
  return chosen;
}
