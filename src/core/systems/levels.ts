import type { GameState, QuestDef } from '../types';
import type { EventBus } from '../engine/events';
import { FLOORS } from '../registry';
import { setStat } from './achievements';
import { conditionsMet } from './conditions';
import { startingLevel } from './legacy';
import { text } from '../text/log';
import {
  DEFAULT_QUEST_LEVEL_XP,
  KILL_LEVEL_XP_RATE,
  LEVEL_ATTR_BONUS,
  LEVEL_XP_BASE,
  LEVEL_XP_EXP,
} from '../data/levels.data';

/**
 * Character level (docs/LEVELS.md, data/levels.data.ts).
 *
 * - state.level starts at 1 (or the Head Start level); state.levelXp is the
 *   XP banked toward the next level, fractional.
 * - The attribute bonus is read by collectBaseMods (attributes.ts) and the
 *   level is part of modFingerprint (derived.ts).
 */

/** XP to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return Math.round(LEVEL_XP_BASE * Math.pow(Math.max(1, level), LEVEL_XP_EXP));
}

/** XP from level 1 to the start of `level`. */
export function xpToReach(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNext(l);
  return total;
}

/** Level and leftover XP for a lifetime total, counting up from `from`. */
export function levelFromXp(xp: number, from = 1): { level: number; xp: number } {
  let level = from;
  let rest = xp;
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  return { level, xp: rest };
}

/** The flat bonus every attribute gets from the current level. */
export function levelAttrBonus(state: GameState): number {
  return Math.max(0, (state.level ?? 1) - 1) * LEVEL_ATTR_BONUS;
}

/** Add level XP and take every level it pays for. One log line per level. */
export function grantLevelXp(state: GameState, bus: EventBus, xp: number): void {
  if (!(xp > 0)) return;
  state.levelXp += xp;
  while (state.levelXp >= xpToNext(state.level)) {
    state.levelXp -= xpToNext(state.level);
    state.level += 1;
    bus.emit({ type: 'level:up', level: state.level });
    bus.emit({
      type: 'log',
      msg: text('levels.up', { level: state.level, bonus: LEVEL_ATTR_BONUS }),
      kind: 'info',
    });
  }
}

/** Level XP a quest pays on turn-in. */
export function questLevelXp(quest: QuestDef): number {
  return quest.rewards.levelXp ?? DEFAULT_QUEST_LEVEL_XP;
}

/** Once-per-run stamp for a floor's clear XP. Reset with the run like every counter. */
export function floorXpKey(floorId: string): string {
  return `level:floor:${floorId}`;
}

/**
 * Pay `clearXp` for every floor whose clear holds and is not stamped yet.
 * Runs after kills, won fights, quest turn-ins and arrivals: the events that
 * move a clear counter today. A clear met some other way pays on the next of
 * those.
 */
export function checkFloorClears(state: GameState, bus: EventBus): void {
  for (const floor of Object.values(FLOORS)) {
    if (!floor.clearXp) continue;
    const key = floorXpKey(floor.id);
    // towers.ts floorCleared, inlined: towers imports combat, which reaches back here.
    if ((state.stats[key] ?? 0) >= 1 || !floor.clear?.length || !conditionsMet(state, floor.clear)) continue;
    setStat(state, bus, key, 1);
    bus.emit({ type: 'log', msg: text('levels.floor', { name: floor.name, xp: floor.clearXp }), kind: 'info' });
    grantLevelXp(state, bus, floor.clearXp);
  }
}

/** Raise the level to the Head Start level when it is higher. Never lowers. */
export function applyStartingLevel(state: GameState): void {
  const start = startingLevel(state);
  if (state.level >= start) return;
  state.level = start;
  state.levelXp = 0;
}

export function registerLevelListeners(state: GameState, bus: EventBus): void {
  bus.on('kill', (ev) => {
    grantLevelXp(state, bus, ev.monster.xp * KILL_LEVEL_XP_RATE);
    checkFloorClears(state, bus);
  });
  bus.on('fight:won', () => checkFloorClears(state, bus));
  bus.on('quest:complete', () => checkFloorClears(state, bus));
  bus.on('arrive', () => checkFloorClears(state, bus));
}
