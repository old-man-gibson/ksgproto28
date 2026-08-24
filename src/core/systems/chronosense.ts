import type { GameState } from '../types';
import type { EventBus } from '../engine/events';
import { checkDiscovery, grantSkillXp } from './skills';
import { TICKS_PER_GAME_MINUTE, WEEKDAYS } from '../data/climate.data';
import { formatDate, formatTime, TICKS_PER_DAY, type WorldClock } from './clock';

/**
 * Chronosense: the body keeping its own calendar.
 *
 * The skill manifests from nothing but LIVED TIME — no action carries its tag,
 * so ordinary discovery can never fire; this hook is the only door. After the
 * first full day it wakes, and from then on it drinks a trickle of XP per game
 * minute (which offline catch-up replays, so time away counts too — of course
 * it does; it is a sense of time). Each precision threshold widens what the
 * clock chip in the header can say, from "morning-ish" to the minute.
 *
 * Why it exists: time-gated events. Post-prestige content and the base's hint
 * system will point at dates ("the caravan passes on Firstday", "the vein
 * opens at the Solstice") — pointless hints unless the player can READ time,
 * and reading time is a earned faculty like everything else here.
 */

export const CHRONOSENSE_ID = 'chronosense';

/** One full day lived, and the shape of days becomes a thing you feel. */
export const CHRONOSENSE_MANIFEST_TICKS = TICKS_PER_DAY;

/** XP per game minute. At one real second per game minute this is 180/real
 *  hour: season-sense in the first sitting, the full date after a few hours,
 *  minute-precision only after real weeks of returning. */
export const CHRONOSENSE_XP_PER_MINUTE = 0.05;

/** What each precision arrives at. Mirrored by the skill's tierNames. Note
 *  `minute` sits past the base cap of 20: reading the exact minute is
 *  post-prestige content by construction. */
export const SENSE_LEVELS = {
  daypart: 1,
  season: 4,
  bell: 8,
  weekday: 12,
  date: 16,
  minute: 25,
} as const;

/**
 * Time-resistance, the reward of the raised ceiling. Levels past the base cap
 * of 20 shrink time-imparted penalties multiplicatively: ×0.99 per level from
 * 21, decade levels (30, 40, …) ×0.97 instead, and levels 50, 75 and 100 a
 * further ×0.95 on top. The full ladder to 100 leaves ×0.326 of a penalty —
 * a 67% resistance, assembled across prestiges.
 *
 * This function is THE hook: any future time-based penalty (time-gated event
 * costs, chronal afflictions, missed-appointment fees) multiplies itself by
 * `timePenaltyMult(level)` rather than inventing its own scaling. Nothing
 * consumes it yet — see NEXT.md §2.
 */
export function timePenaltyMult(level: number): number {
  let mult = 1;
  for (let l = 21; l <= level; l++) {
    mult *= l >= 30 && l % 10 === 0 ? 0.97 : 0.99;
    if (l === 50 || l === 75 || l === 100) mult *= 0.95;
  }
  return mult;
}

/** Runs every tick from Game.advance(); cheap on purpose. */
export function tickChronosense(state: GameState, bus: EventBus): void {
  if (!state.skills[CHRONOSENSE_ID]) {
    // One full day lived and the sense wakes — through the ordinary discovery
    // door, with this system as the game's only emitter of the 'time' tag.
    if (state.totalTicks >= CHRONOSENSE_MANIFEST_TICKS) checkDiscovery(state, bus, ['time']);
    return;
  }
  // The trickle: every 'time'-tagged skill drinks it, so a future deeper
  // time-sense inherits the teacher for free.
  if (state.totalTicks % TICKS_PER_GAME_MINUTE === 0) {
    grantSkillXp(state, bus, ['time'], CHRONOSENSE_XP_PER_MINUTE);
  }
}

// ---------- Reading the clock through the skill ----------

const DAYPARTS: { until: number; name: string }[] = [
  { until: 4, name: 'Deep night' },
  { until: 6, name: 'Dawn' },
  { until: 11, name: 'Morning' },
  { until: 13, name: 'Midday' },
  { until: 17, name: 'Afternoon' },
  { until: 19, name: 'Dusk' },
  { until: 23, name: 'Night' },
];

function daypart(hour: number): string {
  return (DAYPARTS.find((d) => hour <= d.until) ?? DAYPARTS[0]).name;
}

/**
 * The clock as this player is able to perceive it. Null below level 1 — the
 * chip simply doesn't exist until the sense does. Precision accretes:
 *
 *   L1  "Morning"
 *   L4  "Morning · winter"          (a holy day FEELS like one, unnamed)
 *   L8  "About 09:00 · winter"
 *   L12 "Fifthday · about 09:00 · winter"
 *   L16 "Fifthday, 12th of Third Month, Year 1 · about 09:00"
 *   L25 "Fifthday, 12th of Third Month, Year 1 · 09:23"
 */
export function describeTimeSense(clock: WorldClock, level: number): string | null {
  if (level < SENSE_LEVELS.daypart) return null;

  if (level >= SENSE_LEVELS.date) {
    const time =
      level >= SENSE_LEVELS.minute
        ? formatTime(clock)
        : `about ${String(clock.hour).padStart(2, '0')}:00`;
    return `${formatDate(clock)} · ${time}`;
  }

  const parts: string[] = [];
  if (level >= SENSE_LEVELS.weekday && clock.weekday !== null) {
    parts.push(WEEKDAYS[clock.weekday]);
  }
  parts.push(
    level >= SENSE_LEVELS.bell
      ? `about ${String(clock.hour).padStart(2, '0')}:00`
      : daypart(clock.hour),
  );
  if (level >= SENSE_LEVELS.season) {
    parts.push(clock.season);
    if (clock.holyDay) parts.push('a holy day');
  }
  return parts.join(' · ');
}
