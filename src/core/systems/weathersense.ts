import type { GameState } from '../types';
import type { EventBus } from '../engine/events';
import { AREAS, REGIONS, SPOTS } from '../registry';
import { checkDiscovery, grantSkillXp } from './skills';
import { clockOf, formatDate } from './clock';
import {
  WEATHER_ICONS,
  weatherAt,
  worldSeedOf,
  type WeatherKind,
  type WeatherSample,
} from './weather';

/**
 * Weathersense: reading the sky FORWARD.
 *
 * Weather is a pure function of (seed, region, tick), so the future is
 * computable and a forecast can be honestly TRUE — the skill does not fake a
 * prediction, it widens how far ahead you are allowed to look and how sharply
 * you see it. Each forecast row unlocks at a level and then sharpens with the
 * levels after it: rough guess → fair read → precise prognosis.
 *
 * It grows semi-novelty style: a slow watching trickle under any open sky,
 * with the real lessons coming from EXTREME weather (each kind novel until it
 * isn't — your first sandstorm is a curriculum, your tenth is Tuesday) and
 * from TRAVEL (each region's skies are their own dialect). It manifests the
 * first time severe weather catches you outdoors.
 */

export const WEATHERSENSE_ID = 'weathersense';

/** The prognosis tooltip (daily rows for the area) opens here. */
export const PROGNOSIS_TOOLTIP_AT = 5;

/** Watching an ordinary sky, per game minute. Deliberately near-nothing. */
export const WATCH_XP_PER_MINUTE = 0.01;
/** Standing in severe weather, per game minute, BEFORE the novelty multiple. */
export const SEVERE_XP_PER_MINUTE = 0.3;
/** Arriving somewhere, once per arrival, BEFORE the novelty multiple. */
export const TRAVEL_XP_PER_ARRIVAL = 1.5;

/** Severe by kind — the sky as an event, not a backdrop. */
const SEVERE_KINDS = new Set<WeatherKind>(['storm', 'blizzard', 'sandstorm', 'gale']);
/** …or severe by thermometer alone (own thresholds; exposure's "trains at"
 *  bar is lower — merely hot teaches the skin, only BRUTAL teaches the sky). */
export const SEVERE_HOT = 37;
export const SEVERE_COLD = -10;

export function isSevere(sample: WeatherSample): boolean {
  return SEVERE_KINDS.has(sample.kind) || sample.temp >= SEVERE_HOT || sample.temp <= SEVERE_COLD;
}

// ---------- Training ----------

/**
 * Called by exposure.ts once per game minute when the player stands under an
 * open sky (never indoors/sheltered — no sky, no lesson).
 */
export function tickWeathersense(state: GameState, bus: EventBus, sample: WeatherSample): void {
  if (isSevere(sample)) {
    // The first storm you stand through is where the sense comes from.
    checkDiscovery(state, bus, ['weather']);
    const key =
      sample.temp >= SEVERE_HOT ? 'wx:scorch' : sample.temp <= SEVERE_COLD ? 'wx:brutal_cold' : `wx:${sample.kind}`;
    grantSkillXp(state, bus, ['weather'], SEVERE_XP_PER_MINUTE, key);
    return;
  }
  // No source key: plain watching pays the novelty floor — drill, not news.
  grantSkillXp(state, bus, ['weather'], WATCH_XP_PER_MINUTE);
}

/** Called on travel arrival (locations.ts): every region's skies are their
 *  own dialect, and the first visits teach the most. */
export function noteTravelSkies(state: GameState, bus: EventBus, regionId: string): void {
  grantSkillXp(state, bus, ['weather'], TRAVEL_XP_PER_ARRIVAL, `skies:${regionId}`);
}

// ---------- The prognosis ----------

export interface ForecastRow {
  /** How far ahead this row looks. */
  hours: number;
  /** Level at which the row appears; it sharpens with levels past this. */
  req: number;
  label: string;
}

/** 2 hours at level 1, the tomorrow row (the tooltip) at 5, out to 7 days by
 *  the cap at 30 — each new day arriving rough and sharpening over levels. */
export const FORECAST_ROWS: ForecastRow[] = [
  { hours: 2, req: 1, label: 'in 2 hours' },
  { hours: 6, req: 2, label: 'in 6 hours' },
  { hours: 12, req: 3, label: 'in 12 hours' },
  { hours: 24, req: 5, label: 'tomorrow' },
  { hours: 48, req: 9, label: 'in 2 days' },
  { hours: 72, req: 13, label: 'in 3 days' },
  { hours: 96, req: 17, label: 'in 4 days' },
  { hours: 120, req: 21, label: 'in 5 days' },
  { hours: 144, req: 25, label: 'in 6 days' },
  { hours: 168, req: 29, label: 'in 7 days' },
];

export type ForecastQuality = 'rough' | 'fair' | 'precise';

/** Rows sharpen slowly: rough on arrival, fair two levels later, precise five on. */
export function rowQuality(level: number, req: number): ForecastQuality {
  const past = level - req;
  if (past >= 5) return 'precise';
  if (past >= 2) return 'fair';
  return 'rough';
}

/** The vague vocabulary a rough read speaks in. */
function roughWords(sample: WeatherSample): string {
  const sky =
    sample.kind === 'clear' || sample.kind === 'overcast' || sample.kind === 'mist' || sample.kind === 'still'
      ? 'calm skies'
      : sample.kind === 'gale' || sample.kind === 'sandstorm'
        ? 'wild wind'
        : 'wet weather';
  const warmth = sample.temp <= 0 ? 'freezing' : sample.temp <= 12 ? 'chilly' : sample.temp <= 24 ? 'mild' : 'hot';
  return `${sky}, ${warmth}`;
}

export interface ForecastEntry {
  label: string;
  quality: ForecastQuality;
  text: string;
}

/** The rows this level may read, each degraded to its earned precision. */
export function forecastFor(
  level: number,
  region: (typeof REGIONS)[string],
  seed: number,
  nowTicks: number,
): ForecastEntry[] {
  const out: ForecastEntry[] = [];
  for (const row of FORECAST_ROWS) {
    if (level < row.req) break;
    const atTick = nowTicks + row.hours * 600;
    const sample = weatherAt(seed, region, atTick);
    if (!sample) break;
    const quality = rowQuality(level, row.req);
    const text =
      quality === 'rough'
        ? roughWords(sample)
        : quality === 'fair'
          ? `${WEATHER_ICONS[sample.kind]} ${sample.kind}, ${sample.band}`
          : `${WEATHER_ICONS[sample.kind]} ${sample.kind} · ${Math.round(sample.temp)}°`;
    out.push({ label: row.label, quality, text });
  }
  return out;
}

/**
 * The weather chip's hover text: what today is doing, then every forecast
 * line the sense has earned. Levels 1–4 read only the coming hours; the
 * daily prognosis for the area opens at level 5.
 */
export function prognosisTitle(state: GameState, current: WeatherSample): string {
  const lines = [`${current.kind} · feels ${current.band}`];
  const level = state.skills[WEATHERSENSE_ID]?.level ?? 0;
  const spot = SPOTS[state.spot];
  const region = spot ? REGIONS[AREAS[spot.areaId]?.regionId] : undefined;
  if (level >= 1 && region?.world) {
    const entries = forecastFor(level, region, worldSeedOf(state.createdAt), state.totalTicks);
    if (entries.length > 0) {
      if (level >= PROGNOSIS_TOOLTIP_AT) {
        lines.push('', `🌦 Prognosis — ${region.name} · ${formatDate(clockOf(state.totalTicks))}`);
      } else {
        lines.push('');
      }
      for (const e of entries) lines.push(`${e.label}: ${e.text}${e.quality === 'rough' ? ' (?)' : ''}`);
    }
  }
  return lines.join('\n');
}
