import type { ActivityDef, GameState, SearchReward } from '../types';
import { rand } from '../engine/rng';
import { conditionsMet } from './conditions';
import type { EventBus } from '../engine/events';
import { bumpStat } from './achievements';

export const searchKey = (spot: string, activity: string): string => `flag:search:${spot}:${activity}`;
export function rollSearch(state: GameState, bus: EventBus, spot: string, act: Extract<ActivityDef, { kind: 'search' }>): SearchReward | null {
  const key = searchKey(spot, act.id);
  bumpStat(state, bus, key);
  const eligible = act.rewards.filter((r) => r.weight > 0 &&
    (r.limit === undefined || (state.stats[`${key}:${r.id}`] ?? 0) < r.limit) && conditionsMet(state, r.requires ?? []));
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
