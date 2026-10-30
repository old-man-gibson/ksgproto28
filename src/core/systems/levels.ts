import type { GameState, MonsterInstance, QuestDef, SpotEncounter } from '../types';
import type { EventBus } from '../engine/events';
import { BANDS, FLOORS } from '../registry';
import { setStat } from './achievements';
import { bandCleared, bandClearedKey, clearMet } from './ladder';
import { startingLevel } from './legacy';
import { text } from '../text/log';
import {
  DEFAULT_QUEST_LEVEL_XP,
  KILL_LEVEL_XP_RATE,
  LEVEL_ATTR_BONUS,
  LEVEL_XP_BASE,
  LEVEL_XP_EXP,
  MIN_KILL_XP,
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

/**
 * The share of a kill's XP a fighter earns by level gap (user, 2026-10-22):
 * all of it against a monster at or above the fighter's level, and 1/N of
 * it when the fighter is N levels above. One level above is 1/1, so the cut
 * starts at two (half), then three (a third), and so on.
 */
export function levelGapXpMult(playerLevel: number, monsterLevel: number): number {
  const gap = playerLevel - monsterLevel;
  return gap <= 0 ? 1 : 1 / gap;
}

/**
 * The XP a kill earns: the spawned monster's XP times the level-gap share,
 * never under MIN_KILL_XP. Computed once in combat and handed to both skill
 * XP and level XP (the `kill` event carries it), so the two never disagree.
 */
export function killXp(state: GameState, monster: Pick<MonsterInstance, 'xp' | 'level'>): number {
  return Math.max(MIN_KILL_XP, monster.xp * levelGapXpMult(state.level ?? 1, monster.level));
}

/**
 * The level an encounter line spawns at, from the level its range rolled.
 * A line with `levelRise` (SpotEncounter) adds the counter it names priced
 * against the character level, capped at its ceiling; any other line keeps
 * the roll. With k the counter and P the character level:
 *
 *   min(ceiling, rolled + max(k, round(k × share × P)))
 *
 * The `max(k, …)` floor costs every unit at least one level, so a weak
 * character's greed always shows. The product is rounded once, not per unit,
 * so one character level never moves the line by k. On floor 19 k tops out at
 * six, and 6 × share < 1 there: each character level adds less than one to a
 * full-greed judge, so levelling always closes the gap (FLOOR_IDEAS §4).
 *
 * `spawnMonster` applies it after the roll (never to a pinned `override`
 * spawn), `spawnGroup` applies it to a table-rolled filler before pinning
 * that filler's level, and the bestiary's level range reads it, so the book
 * and the fight quote the same number.
 */
export function encounterLevel(state: GameState, e: Pick<SpotEncounter, 'levelRise'>, rolled: number): number {
  const rise = e.levelRise;
  if (!rise) return rolled;
  const k = state.stats[rise.stat] ?? 0;
  const p = state.level ?? 1;
  return Math.min(rise.ceiling, rolled + Math.max(k, Math.round(k * rise.share * p)));
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
    // The floor's own clear: a band pass opens the way but pays no XP.
    if ((state.stats[key] ?? 0) >= 1 || !clearMet(state, floor)) continue;
    setStat(state, bus, key, 1);
    bus.emit({ type: 'log', msg: text('levels.floor', { name: floor.name, xp: floor.clearXp }), kind: 'info' });
    grantLevelXp(state, bus, floor.clearXp);
  }
  // A band whose every floor is cleared stamps it once a run, for content to
  // read (band 3: the castle is safe, bands-2-3.md R8). Only an `any` band
  // says so in the log; a sequence band's last floor clear already did.
  for (const band of Object.values(BANDS)) {
    const key = bandClearedKey(band.id);
    if ((state.stats[key] ?? 0) >= 1 || !bandCleared(state, band)) continue;
    setStat(state, bus, key, 1);
    if (band.order === 'any') bus.emit({ type: 'log', msg: text('levels.band', { name: band.name }), kind: 'info' });
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
    grantLevelXp(state, bus, ev.xp * KILL_LEVEL_XP_RATE);
    checkFloorClears(state, bus);
  });
  bus.on('fight:won', () => checkFloorClears(state, bus));
  bus.on('quest:complete', () => checkFloorClears(state, bus));
  bus.on('arrive', () => checkFloorClears(state, bus));
}
