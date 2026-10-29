import {
  DAYS_PER_MONTH,
  DAYS_PER_QUARTER,
  DAYS_PER_WEEK,
  DAYS_PER_YEAR,
  HOLY_DAYS,
  HOURS_PER_DAY,
  MINUTES_PER_HOUR,
  MONTH_DAYS_PER_YEAR,
  MONTHS,
  MOON_PHASES,
  MOONLIGHT_WEIGHT,
  MOONS,
  SEASONS,
  TICKS_PER_GAME_MINUTE,
  WEEKDAYS,
  type MoonDef,
  type MoonPhaseId,
  type SeasonId,
} from '../data/climate.data';

/**
 * The world clock, as a pure function of `state.totalTicks`.
 *
 * Nothing about the date is stored anywhere: the tick counter the game
 * already keeps IS the calendar, and offline catch-up replays ticks, so the
 * clock catches up by construction. See data/climate.data.ts for the year's
 * shape (13 × 28 + 4 holy days) and why weekdays never drift. The moons are
 * part of the same reading; nothing about them is stored either.
 */

const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY;
export const TICKS_PER_DAY = TICKS_PER_GAME_MINUTE * MINUTES_PER_DAY;
export const TICKS_PER_YEAR = TICKS_PER_DAY * DAYS_PER_YEAR;

/** 0-based day-of-year positions of the four holy days. Quarter q's holy day
 *  falls after (q+1) × 91 month-days plus the q holy days already passed. */
export const HOLY_DAY_INDICES = HOLY_DAYS.map((_, q) => (q + 1) * DAYS_PER_QUARTER + q);

export interface WorldClock {
  /** Whole in-game minutes since the epoch. */
  totalMinutes: number;
  minute: number;
  hour: number;
  /** 0-based absolute day since the epoch. */
  dayIndex: number;
  /** 0-based day inside the year (0..367). */
  dayOfYear: number;
  /** 1-based, for display. */
  year: number;
  /** null on a holy day — those days belong to no month. */
  monthIndex: number | null;
  /** 1-based day inside the month; null on a holy day. */
  dayOfMonth: number | null;
  /** 0-based weekday; null on a holy day — they stand outside the week. */
  weekday: number | null;
  /** Which holy day this is, if any. */
  holyDay: (typeof HOLY_DAYS)[number] | null;
  season: SeasonId;
  /**
   * Where the year stands on the temperature curve: +1 at the Summer
   * Solstice, −1 at the Winter Solstice, 0 at both equinoxes. This is the
   * number the climate reads; the season label is just its name.
   */
  seasonPhase: number;
  /** Every moon, in MOONS order. */
  moons: MoonState[];
}

export interface MoonState extends MoonDef {
  /** 0..1 through the cycle: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
  phase: number;
  /** Whole month-days into the cycle, 0..cycleDays−1. */
  age: number;
  /** Lit fraction of the disc, 0 at new, 1 at full. */
  illumination: number;
  phaseId: MoonPhaseId;
  /** 'waxing gibbous' */
  phaseName: string;
}

/** One moon at `monthDays` month-days (fractional) since the epoch. */
function moonOf(moon: MoonDef, monthDays: number): MoonState {
  const days = monthDays % moon.cycleDays;
  const quarter = moon.cycleDays / 4;
  const q = Math.floor(days / quarter);
  // A principal phase names the one day that starts at its exact moment.
  const { id, name } = MOON_PHASES[q * 2 + (days - q * quarter < 1 ? 0 : 1)];
  return {
    ...moon,
    phase: days / moon.cycleDays,
    age: Math.floor(days),
    illumination: (1 - Math.cos((2 * Math.PI * days) / moon.cycleDays)) / 2,
    phaseId: id,
    phaseName: name,
  };
}

/** The moons' combined light above the clouds, 0 (all new) to 1 (all full):
 *  each moon's illumination weighted by its size (MOONLIGHT_WEIGHT). */
export function moonlight(moons: MoonState[]): number {
  return moons.reduce((sum, m) => sum + m.illumination * MOONLIGHT_WEIGHT[m.size], 0);
}

export function clockOf(totalTicks: number): WorldClock {
  const totalMinutes = Math.floor(totalTicks / TICKS_PER_GAME_MINUTE);
  const minuteOfDay = totalMinutes % MINUTES_PER_DAY;
  const dayIndex = Math.floor(totalMinutes / MINUTES_PER_DAY);
  const dayOfYear = dayIndex % DAYS_PER_YEAR;
  const year = Math.floor(dayIndex / DAYS_PER_YEAR) + 1;

  const holy = HOLY_DAY_INDICES.indexOf(dayOfYear);
  // Month-days count 0..363, skipping the holy days already passed this year.
  const passed = HOLY_DAY_INDICES.filter((d) => d < dayOfYear).length;
  const monthDay = dayOfYear - passed;

  // The Summer Solstice (dayOfYear 183) sits exactly on the peak: its centre
  // is 184 days after the Winter Solstice's, and 184 is half of 368.
  const seasonPhase = Math.cos((2 * Math.PI * (dayOfYear - HOLY_DAY_INDICES[1])) / DAYS_PER_YEAR);
  // Seasons are CENTRED on their holy days: winter spans the Winter Solstice,
  // midsummer is a day, not a boundary.
  const season = SEASONS[Math.floor(((dayOfYear + 46) % DAYS_PER_YEAR) / (DAYS_PER_YEAR / 4))];

  // The moons count month-days only, so on a holy day they hold where the day
  // before left them (`monthDay` already counts the month-days passed).
  const monthDays =
    (year - 1) * MONTH_DAYS_PER_YEAR + monthDay + (holy >= 0 ? 0 : minuteOfDay / MINUTES_PER_DAY);

  return {
    totalMinutes,
    minute: minuteOfDay % MINUTES_PER_HOUR,
    hour: Math.floor(minuteOfDay / MINUTES_PER_HOUR),
    dayIndex,
    dayOfYear,
    year,
    monthIndex: holy >= 0 ? null : Math.floor(monthDay / DAYS_PER_MONTH),
    dayOfMonth: holy >= 0 ? null : (monthDay % DAYS_PER_MONTH) + 1,
    weekday: holy >= 0 ? null : monthDay % DAYS_PER_WEEK,
    holyDay: holy >= 0 ? HOLY_DAYS[holy] : null,
    season,
    seasonPhase,
    moons: MOONS.map((m) => moonOf(m, monthDays)),
  };
}

// ---------- Display ----------

const ORDINAL_RULES = new Intl.PluralRules('en', { type: 'ordinal' });
const ORDINAL_SUFFIX: Record<string, string> = { one: 'st', two: 'nd', few: 'rd', other: 'th' };

function ordinal(n: number): string {
  return `${n}${ORDINAL_SUFFIX[ORDINAL_RULES.select(n)]}`;
}

/** "Thirdday, 5th of First Month, Year 2" — or "Summer Solstice, Year 2". */
export function formatDate(clock: WorldClock): string {
  if (clock.holyDay) return `${clock.holyDay.name}, Year ${clock.year}`;
  const month = MONTHS[clock.monthIndex!];
  return `${WEEKDAYS[clock.weekday!]}, ${ordinal(clock.dayOfMonth!)} of ${month.name}, Year ${clock.year}`;
}

/** "07:05" — the world runs on a 24-hour bell. */
export function formatTime(clock: WorldClock): string {
  return `${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`;
}

/** One glyph per phase, shared by the game header and the forge's atlas. */
export const MOON_ICONS: Record<MoonPhaseId, string> = {
  new: '🌑',
  waxing_crescent: '🌒',
  first_quarter: '🌓',
  waxing_gibbous: '🌔',
  full: '🌕',
  waning_gibbous: '🌖',
  last_quarter: '🌗',
  waning_crescent: '🌘',
};

/** "Large Moon: waxing gibbous", or with the day, "… (day 12 of 79)". */
export function formatMoon(moon: MoonState, withDay = false): string {
  const day = withDay ? ` (day ${moon.age + 1} of ${moon.cycleDays})` : '';
  return `${moon.name}: ${moon.phaseName}${day}`;
}
