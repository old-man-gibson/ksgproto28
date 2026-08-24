import type { RegionDef, TerrainId } from '../types';
import {
  ANOMALY_OCTAVES,
  ANOMALY_SCALE,
  HOURS_PER_DAY,
  MINUTES_PER_HOUR,
  TERRAIN_PROFILES,
  TICKS_PER_GAME_MINUTE,
  WORLD_CLIMATE,
} from '../data/climate.data';
import { clockOf, type WorldClock } from './clock';

/**
 * Weather is SAMPLED, not simulated: a pure function of (world seed, region,
 * tick). There is no update loop, no stored state and no staleness — a region
 * unvisited for twenty game days is exactly right the moment you ask, because
 * asking is all there is. Two parts per variable:
 *
 * - a CLIMATE BASELINE from the region's atlas pin (latitude), its terrain
 *   profile and the calendar (seasonal + day/night curves);
 * - an ANOMALY drawn from a smooth seeded noise field over (world x, y,
 *   time). The base octave spans two or three region-spacings, so neighbors
 *   agree about the weather without ever being told to.
 *
 * The seed comes from the save's `createdAt` — already persisted, never
 * changing, different per playthrough. Nothing about weather touches the
 * save format.
 *
 * NOT YET a mod source: the day weather modifies player stats, its BUCKET
 * (`kind` + `tempBand`, not the raw floats) must join the derived-stats
 * `modFingerprint` — see docs/ENGINEERING.md and docs/WEATHER.md.
 */

// ---------- Seeded noise ----------

/** 32-bit mix of a save's `createdAt` into the world's one weather seed. */
export function worldSeedOf(createdAt: number): number {
  let h = (createdAt ^ 0x9e3779b9) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^= h >>> 16) >>> 0;
}

/** Lattice hash → [0, 1). Deterministic across sessions and platforms. */
function hash3(seed: number, cx: number, cy: number, ct: number): number {
  let h = seed | 0;
  h = Math.imul(h ^ Math.imul(cx | 0, 0x9e3779b1), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15) ^ Math.imul(cy | 0, 0xc2b2ae35), 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 13) ^ Math.imul(ct | 0, 0x165667b1), 0x45d9f3b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(u: number): number {
  return u * u * (3 - 2 * u);
}

/** Trilinear value noise on one octave's lattice, centred on zero. */
function valueNoise(seed: number, x: number, y: number, t: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const t0 = Math.floor(t);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const ft = smooth(t - t0);

  let sum = 0;
  for (let dx = 0; dx <= 1; dx++) {
    for (let dy = 0; dy <= 1; dy++) {
      for (let dt = 0; dt <= 1; dt++) {
        const w =
          (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dt ? ft : 1 - ft);
        sum += w * (hash3(seed, x0 + dx, y0 + dy, t0 + dt) - 0.5);
      }
    }
  }
  return sum;
}

/** Puts the summed octaves at unit variance (verified statistically in
 *  tests/weather.test.ts). Smooth interpolated noise is narrower than its
 *  corners; this stretches it back out. */
const NOISE_NORM = 4.67;

export type AnomalyChannel = 'temp' | 'precip' | 'wind';
const CHANNEL_SALT: Record<AnomalyChannel, number> = { temp: 0x51ab, precip: 0xa11ce, wind: 0x3a57 };

/**
 * The anomaly field: roughly standard-normal, smooth in space and time.
 * `x`/`y` in atlas units, `hours` in game hours since the epoch.
 */
export function anomalyAt(
  seed: number,
  channel: AnomalyChannel,
  x: number,
  y: number,
  hours: number,
): number {
  let sum = 0;
  for (let i = 0; i < ANOMALY_OCTAVES.length; i++) {
    const o = ANOMALY_OCTAVES[i];
    const octaveSeed = (seed ^ CHANNEL_SALT[channel] ^ Math.imul(i + 1, 0x9e3779b1)) | 0;
    sum += o.amp * valueNoise(octaveSeed, x / o.space, y / o.space, hours / o.hours);
  }
  return sum * NOISE_NORM;
}

// ---------- Climate baseline ----------

export interface WeatherValues {
  /** °C. */
  temp: number;
  /** 0–1. */
  precip: number;
  /** 0–1. */
  wind: number;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** What the sky is doing BEFORE the dice — pin latitude, terrain, calendar. */
export function climateBaseline(region: RegionDef, clock: WorldClock): WeatherValues | null {
  if (!region.world) return null;
  const c = WORLD_CLIMATE;
  const profile = TERRAIN_PROFILES[region.terrain ?? 'plains'];
  const shelter = region.sheltered ? 0.3 : 1;

  /** 0 at the equator, 1 at the pole. */
  const lat = clamp01((c.equatorY - region.world.y) / (c.equatorY - c.polarY));
  const mean = c.equatorTemp + (c.polarTemp - c.equatorTemp) * lat;
  const seasonal = c.seasonalSwing * lat * profile.swingMult * shelter * clock.seasonPhase;
  const hourFrac = clock.hour + clock.minute / MINUTES_PER_HOUR;
  const diurnal =
    c.diurnalSwing *
    profile.swingMult *
    shelter *
    Math.cos((2 * Math.PI * (hourFrac - 14)) / HOURS_PER_DAY);

  return {
    temp: mean + profile.temp + seasonal + diurnal,
    precip: region.sheltered ? 0 : clamp01(c.precipBase * profile.precipMult),
    wind: region.sheltered ? 0 : clamp01(c.windBase * profile.windMult),
  };
}

// ---------- The sample ----------

export type WeatherKind =
  | 'still'
  | 'clear'
  | 'overcast'
  | 'mist'
  | 'rain'
  | 'storm'
  | 'snow'
  | 'blizzard'
  | 'gale'
  | 'sandstorm';

export type TempBand = 'freezing' | 'cold' | 'mild' | 'warm' | 'hot';

/** One glyph per sky, shared by the game header and the forge's atlas. */
export const WEATHER_ICONS: Record<WeatherKind, string> = {
  still: '🕳️',
  clear: '☀️',
  overcast: '☁️',
  mist: '🌫️',
  rain: '🌧️',
  storm: '⛈️',
  snow: '🌨️',
  blizzard: '❄️',
  gale: '💨',
  sandstorm: '🌪️',
};

export interface WeatherSample extends WeatherValues {
  kind: WeatherKind;
  band: TempBand;
}

export function tempBand(temp: number): TempBand {
  if (temp <= 0) return 'freezing';
  if (temp <= 8) return 'cold';
  if (temp <= 19) return 'mild';
  if (temp <= 28) return 'warm';
  return 'hot';
}

/**
 * Phenomena are CLASSIFICATIONS of the continuous variables, not variables of
 * their own — snow is rain that is freezing, a sandstorm is a gale with sand
 * to carry. Terrain gates flavor; it never adds dimensions.
 */
export function classify(
  values: WeatherValues,
  terrain: TerrainId | undefined,
  sheltered: boolean | undefined,
): WeatherKind {
  if (sheltered || terrain === 'caves') return 'still';
  const freezing = values.temp <= 0;
  if (values.precip > 0.62) {
    if (freezing) return values.wind > 0.6 ? 'blizzard' : 'snow';
    return values.wind > 0.6 ? 'storm' : 'rain';
  }
  if (terrain === 'desert' && values.wind > 0.65 && values.precip < 0.2) return 'sandstorm';
  if (values.wind > 0.72) return 'gale';
  if (values.precip > 0.45) return freezing ? 'snow' : 'overcast';
  if (values.precip > 0.35 && values.wind < 0.15) return 'mist';
  if (values.precip < 0.18) return 'clear';
  return 'overcast';
}

/**
 * The whole sky over one region at one tick. Null for an unplaced region —
 * no pin, no latitude, no weather; place it on the World Atlas first.
 */
export function weatherAt(
  seed: number,
  region: RegionDef,
  totalTicks: number,
): WeatherSample | null {
  const clock = clockOf(totalTicks);
  const base = climateBaseline(region, clock);
  if (!base || !region.world) return null;

  const hours = totalTicks / (TICKS_PER_GAME_MINUTE * MINUTES_PER_HOUR);
  const { x, y } = region.world;
  const shelter = region.sheltered ? 0.3 : 1;

  const values: WeatherValues = {
    temp: base.temp + anomalyAt(seed, 'temp', x, y, hours) * ANOMALY_SCALE.temp * shelter,
    precip: region.sheltered
      ? 0
      : clamp01(base.precip + anomalyAt(seed, 'precip', x, y, hours) * ANOMALY_SCALE.precip),
    wind: region.sheltered
      ? 0
      : clamp01(base.wind + anomalyAt(seed, 'wind', x, y, hours) * ANOMALY_SCALE.wind),
  };
  return { ...values, kind: classify(values, region.terrain, region.sheltered), band: tempBand(values.temp) };
}
