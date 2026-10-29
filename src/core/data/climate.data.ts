import type { TerrainId } from '../types';

/**
 * The calendar and the sky, as data.
 *
 * The year is 13 months × 28 days = 364 month-days, plus four days that
 * belong to no month — the equinoxes and solstices — for 368. Each quarter is
 * 91 month-days, which is EXACTLY 13 weeks, and the holy days stand outside
 * the week: every month therefore starts on the same weekday forever, and a
 * date names its weekday by arithmetic alone. The holy days interrupt their
 * quarters at a drifting anchor — after week 1 of month 4, week 2 of month 7,
 * week 3 of month 10, week 4 of month 13 — which is the kind of pattern a
 * fantasy priesthood would absolutely gloat about.
 *
 * Each holy day is the MIDPOINT of its season, not the start: the Summer
 * Solstice is midsummer's day, folk-style — and it falls exactly on the peak
 * of the temperature curve, the Winter Solstice exactly on its trough, and
 * the equinoxes exactly on its zeroes. The calendar and the climate agree by
 * construction.
 *
 * The three moons count month-days too, so the 28-day one keeps the same
 * phase on the same date forever; see MOONS.
 *
 * Everything here is a knob. Tune freely; the systems in systems/clock.ts and
 * systems/weather.ts read this file and hard-code nothing.
 */

// ---------- The clock ----------

/** Logic ticks (see engine/loop.ts: 10/s) per in-game minute — so one real
 *  second is one game minute, a day is 24 real minutes, and a year of 368
 *  days passes in roughly six real days of play. */
export const TICKS_PER_GAME_MINUTE = 10;

export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
export const DAYS_PER_WEEK = 7;
export const DAYS_PER_MONTH = 28;
export const MONTHS_PER_YEAR = 13;
/** Month-days per quarter: 13 weeks exactly. */
export const DAYS_PER_QUARTER = 91;
export const MONTH_DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR; // 364
export const DAYS_PER_YEAR = MONTH_DAYS_PER_YEAR + 4; // 368

// TODO: name the months — these are scaffolding, not lore.
export const MONTHS: { id: string; name: string }[] = [
  { id: 'month_1', name: 'First Month' },
  { id: 'month_2', name: 'Second Month' },
  { id: 'month_3', name: 'Third Month' },
  { id: 'month_4', name: 'Fourth Month' },
  { id: 'month_5', name: 'Fifth Month' },
  { id: 'month_6', name: 'Sixth Month' },
  { id: 'month_7', name: 'Seventh Month' },
  { id: 'month_8', name: 'Eighth Month' },
  { id: 'month_9', name: 'Ninth Month' },
  { id: 'month_10', name: 'Tenth Month' },
  { id: 'month_11', name: 'Eleventh Month' },
  { id: 'month_12', name: 'Twelfth Month' },
  { id: 'month_13', name: 'Thirteenth Month' },
];

// TODO: name the weekdays — same scaffolding.
export const WEEKDAYS: string[] = [
  'Firstday',
  'Seconday',
  'Thirdday',
  'Fourthday',
  'Fifthday',
  'Sixthday',
  'Seventhday',
];

/**
 * The four monthless days, in year order. Each is the centre of its season
 * and a natural festival hook for the pantheon.
 */
export const HOLY_DAYS: { id: string; name: string; season: SeasonId }[] = [
  { id: 'vernal_equinox', name: 'Vernal Equinox', season: 'spring' },
  { id: 'summer_solstice', name: 'Summer Solstice', season: 'summer' },
  { id: 'autumnal_equinox', name: 'Autumnal Equinox', season: 'autumn' },
  { id: 'winter_solstice', name: 'Winter Solstice', season: 'winter' },
];

export type SeasonId = 'winter' | 'spring' | 'summer' | 'autumn';

/** Year order, starting from the season the year opens in. */
export const SEASONS: SeasonId[] = ['winter', 'spring', 'summer', 'autumn'];

// ---------- The moons ----------

/**
 * Three moons, each on its own cycle, all three new at the epoch (Firstday,
 * 1st of First Month, Year 1). A moon counts MONTH-days: on a holy day every
 * moon holds the phase it had at the end of the day before, the same way holy
 * days stand outside the week. With that rule the 28-day moon is locked to
 * the month — every month opens on its new moon, every year — and the four
 * holy days land on its four principal phases (Vernal Equinox first quarter,
 * Summer Solstice full, Autumnal Equinox last quarter, Winter Solstice new).
 * The 37- and 79-day moons do not divide the month and drift against the
 * calendar; all three are new together again after 28 × 37 × 79 = 81,844
 * month-days, about 225 years.
 *
 * `size` is relative: it sets how big the glyph is drawn and how much of the
 * night's moonlight the moon gives (MOONLIGHT_WEIGHT).
 */
export type MoonSize = 'small' | 'medium' | 'large';

export interface MoonDef {
  id: string;
  name: string;
  /** Month-days from one new moon to the next. */
  cycleDays: number;
  size: MoonSize;
}

// TODO: name the moons — scaffolding, like the months.
export const MOONS: MoonDef[] = [
  { id: 'large_moon', name: 'Large Moon', cycleDays: 79, size: 'large' },
  { id: 'middle_moon', name: 'Middle Moon', cycleDays: 28, size: 'medium' },
  { id: 'small_moon', name: 'Small Moon', cycleDays: 37, size: 'small' },
];

/**
 * Each moon's share of the moonlight when full. Sums to 1, so three full
 * moons are moonlight 1. What moonlight does to the dark is
 * systems/exposure.ts (MOONLIGHT_MAX, MOONLIGHT_THROUGH).
 */
export const MOONLIGHT_WEIGHT: Record<MoonSize, number> = { large: 0.5, medium: 0.3, small: 0.2 };

export type MoonPhaseId =
  | 'new'
  | 'waxing_crescent'
  | 'first_quarter'
  | 'waxing_gibbous'
  | 'full'
  | 'waning_gibbous'
  | 'last_quarter'
  | 'waning_crescent';

/**
 * The eight phase names, in cycle order. Even indices are the principal
 * phases: each names the one day that starts at its exact moment. The odd
 * ones (crescents, gibbouses) fill the days between.
 */
export const MOON_PHASES: { id: MoonPhaseId; name: string }[] = [
  { id: 'new', name: 'new moon' },
  { id: 'waxing_crescent', name: 'waxing crescent' },
  { id: 'first_quarter', name: 'first quarter' },
  { id: 'waxing_gibbous', name: 'waxing gibbous' },
  { id: 'full', name: 'full moon' },
  { id: 'waning_gibbous', name: 'waning gibbous' },
  { id: 'last_quarter', name: 'last quarter' },
  { id: 'waning_crescent', name: 'waning crescent' },
];

// ---------- The climate ----------

/**
 * The world's temperature geography, in atlas coordinates (y grows SOUTH).
 * The poles sit beyond the drawn canvas on purpose: the visible map is a
 * temperate slice of a larger world, so the knobs describe the planet and
 * the map inherits whatever band it covers.
 */
export const WORLD_CLIMATE = {
  /** Atlas y of the equator and the pole; both may lie off-canvas. */
  equatorY: 90,
  polarY: -30,
  /** Annual-mean surface temperature at each, °C. */
  equatorTemp: 32,
  polarTemp: -18,
  /** Seasonal swing amplitude at the pole, °C — scales toward 0 at the equator. */
  seasonalSwing: 14,
  /** Day/night swing amplitude, °C, warmest at 14:00. */
  diurnalSwing: 6,
  /** Baseline precipitation and wind (0–1) before terrain says otherwise. */
  precipBase: 0.45,
  windBase: 0.3,
} as const;

/**
 * What standing in this kind of country does to the baseline. `swingMult`
 * damps or exaggerates both the seasonal and the day/night temperature swing
 * — water steadies coasts, bare rock and sand do the opposite.
 */
export const TERRAIN_PROFILES: Record<
  TerrainId,
  { temp: number; precipMult: number; windMult: number; swingMult: number }
> = {
  plains: { temp: 0, precipMult: 1, windMult: 1.1, swingMult: 1 },
  forest: { temp: -1, precipMult: 1.15, windMult: 0.7, swingMult: 0.85 },
  hills: { temp: -3, precipMult: 1.05, windMult: 1.15, swingMult: 1 },
  mountains: { temp: -8, precipMult: 1.1, windMult: 1.4, swingMult: 1.1 },
  coast: { temp: 1, precipMult: 1.2, windMult: 1.3, swingMult: 0.6 },
  desert: { temp: 4, precipMult: 0.25, windMult: 1.2, swingMult: 1.5 },
  volcanic: { temp: 3, precipMult: 0.7, windMult: 1.1, swingMult: 1.2 },
  caves: { temp: -2, precipMult: 0, windMult: 0, swingMult: 0.1 },
};

/**
 * How hard the anomaly field pushes each variable at one standard deviation.
 * Temperature in °C; precipitation and wind in their own 0–1 units.
 */
export const ANOMALY_SCALE = { temp: 5, precip: 0.35, wind: 0.25 } as const;

/**
 * The anomaly field's octaves: spatial wavelength in atlas units, temporal
 * wavelength in game HOURS, and relative amplitude. The base octave spans
 * two or three region-spacings on purpose — a big excursion is automatically
 * a WIDE excursion, which is what lets one storm spill across neighbors.
 */
export const ANOMALY_OCTAVES: { space: number; hours: number; amp: number }[] = [
  { space: 8, hours: 144, amp: 1 },
  { space: 4, hours: 48, amp: 0.5 },
  { space: 2, hours: 18, amp: 0.3 },
];
