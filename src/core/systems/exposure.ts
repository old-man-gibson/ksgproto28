import type { GameState } from '../types';
import type { EventBus } from '../engine/events';
import { AREAS, REGIONS, SPOTS } from '../registry';
import { checkDiscovery, grantSkillXp } from './skills';
import { clockOf } from './clock';
import { hasStatus } from './statuses';
import {
  climateBaseline,
  weatherAt,
  worldSeedOf,
  type WeatherKind,
  type WeatherSample,
} from './weather';
import { TICKS_PER_GAME_MINUTE } from '../data/climate.data';
import { tickWeathersense } from './weathersense';

/**
 * Exposure: the world training the body just by being stood in.
 *
 * Three teachers, all routed through the same resist:<type> skills that
 * taking typed damage manifests and levels (combat.ts):
 *
 * - WEATHER, per game minute, from the sampled sky over the player's region:
 *   extreme temperature, rain, storms, sandstorms, unseasonable glare.
 * - PLACES, per game minute: a spot tagged with an element ('heat' on a forge
 *   floor, 'dark' in a deep cave) seeps into whoever loiters there.
 * - WORK, per completion: an activity tagged with an element pays exposure
 *   scaled by the time a cycle represents (actions.ts calls in).
 *
 * Plus DARKNESS, which trains a sense rather than a resistance: true dark,
 * away from any hearth-light, grows `darkvision` — and darkvision is what
 * unpicks the night's combat penalties (see `darknessFactor`, consumed in
 * combat.ts).
 *
 * Everything here is deliberately small-per-minute: exposure should reward
 * living somewhere, not replace getting hit.
 */

// ---------- Vocabulary ----------

/** Damage types a place or activity may radiate. Physical types are not
 *  weather. Mirrored by the content linter's spot-tag rule. */
export const ELEMENT_TAGS = new Set([
  'heat',
  'cold',
  'water',
  'wind',
  'earth',
  'lightning',
  'poison',
  'arcane',
  'light',
  'dark',
]);

/** Non-elemental place tags with mechanical meaning. */
export const PLACE_TAGS = new Set(['indoor', 'settlement']);

// ---------- Tuning ----------

/** Resist XP per game minute of standing in weather that qualifies. */
export const WEATHER_XP_PER_MINUTE = 0.1;
/** Resist XP per game minute per elemental tag on the spot you loiter at. */
export const SPOT_XP_PER_MINUTE = 0.05;
/** Darkvision XP per game minute of true dark. */
export const DARKNESS_XP_PER_MINUTE = 0.1;
/** Exposure XP per tick of an elemental activity's base cycle time. */
export const ACTIVITY_XP_PER_TICK = 0.02;

/** "Very" hot/cold, °C — the skin only learns past these. */
export const HEAT_TRAINS_AT = 32;
export const COLD_TRAINS_AT = -5;
/** Clear daytime sky this far above the seasonal baseline is glare. */
export const UNSEASONABLY_BRIGHT = 6;

/** Full darkness costs an untrained fighter this much of their dodge... */
export const DARK_DODGE_PENALTY = 0.25;
/** ...and this flat chance of swinging at shadows. */
export const DARK_MISS_CHANCE = 0.15;
/** The level at which darkvision has unpicked the night entirely. */
export const DARKVISION_CEILING = 50;

// ---------- Weather → elements ----------

/** How hard each sky leans on each element, as shares of the base rate. */
const KIND_EXPOSURE: Partial<Record<WeatherKind, [string, number][]>> = {
  rain: [['water', 1]],
  storm: [
    ['wind', 0.65],
    ['water', 0.3],
    ['lightning', 0.05],
  ],
  gale: [['wind', 1]],
  blizzard: [['wind', 1]], // the cold half arrives via the temperature rule
  sandstorm: [
    ['wind', 0.8],
    ['earth', 0.2],
  ],
};

/** The elements a given sky trains, with their shares of the base rate. */
export function weatherExposure(
  sample: WeatherSample,
  baselineTemp: number,
  hour: number,
): [string, number][] {
  const out: [string, number][] = [...(KIND_EXPOSURE[sample.kind] ?? [])];
  if (sample.temp >= HEAT_TRAINS_AT) out.push(['heat', 1]);
  if (sample.temp <= COLD_TRAINS_AT) out.push(['cold', 1]);
  // Unseasonable glare: a clear daytime sky running well above what the
  // season owes — brightness is inferred, not simulated.
  if (
    sample.kind === 'clear' &&
    hour >= 7 &&
    hour <= 17 &&
    sample.temp - baselineTemp >= UNSEASONABLY_BRIGHT
  ) {
    out.push(['light', 1]);
  }
  return out;
}

// ---------- Darkness ----------

/** How dark the SKY is at this hour: 1 through the night, half at the
 *  twilight fringes, 0 in daylight. Moonless on purpose, for now. */
export function naturalDarkness(hour: number): number {
  if (hour >= 20 || hour <= 4) return 1;
  if (hour === 19 || hour === 5) return 0.5;
  return 0;
}

/**
 * Where the player stands, resolved once. A place's effective tags are the
 * UNION down the chain — region ∪ area ∪ spot — so 'dark' on a cave-system
 * region darkens every chamber, and one poisonous chamber inside it can still
 * add 'poison' (and 'heat', if it borders magma) on its own line.
 */
function placeOf(state: GameState) {
  const spot = SPOTS[state.spot];
  const area = spot ? AREAS[spot.areaId] : undefined;
  const region = area ? REGIONS[area.regionId] : undefined;
  const tags = new Set([...(region?.tags ?? []), ...(area?.tags ?? []), ...(spot?.tags ?? [])]);
  return { spot, region, tags };
}

/**
 * How dark this PLACE is, 0..1, before darkvision has its say. A 'dark' tag
 * is darkness by nature — a deep cave at noon is as black as it is at
 * midnight, and no lamplight rule applies, because you tagged it dark on
 * purpose. Otherwise it is the sky's darkness, cancelled by roofs and
 * settlement lamplight.
 */
export function placeDarkness(
  region: { sheltered?: boolean } | undefined,
  tags: Set<string>,
  hour: number,
): number {
  if (tags.has('dark')) return 1;
  if (region?.sheltered || tags.has('indoor') || tags.has('settlement')) return 0;
  return naturalDarkness(hour);
}

/**
 * The dark's remaining grip on this player, 0..1 — 0 in daylight or
 * lamplight, and eroded to 0 by darkvision at its ceiling wherever the dark
 * comes from. Combat multiplies its darkness penalties by this; anything
 * else that cares about "can they see" should too.
 */
export function darknessFactor(state: GameState): number {
  // A body with no eyes was never using them. Darkness taxes footwork and
  // accuracy through SIGHT, so the whole tax simply does not apply — checked
  // here, at the one place the factor is computed, rather than at each of the
  // sites that spend it.
  if (hasStatus(state, 'eyeless')) return 0;
  const { region, tags } = placeOf(state);
  const dark = placeDarkness(region, tags, clockOf(state.totalTicks).hour);
  if (dark === 0) return 0;
  const level = Math.min(state.skills.darkvision?.level ?? 0, DARKVISION_CEILING);
  return dark * (1 - level / DARKVISION_CEILING);
}

// ---------- The per-minute tick ----------

function grantExposure(state: GameState, bus: EventBus, element: string, amount: number): void {
  const tag = `resist:${element}`;
  checkDiscovery(state, bus, [tag]);
  grantSkillXp(state, bus, [tag], amount);
}

/** Runs every tick from Game.advance(); does its work once per game minute. */
export function tickExposure(state: GameState, bus: EventBus): void {
  if (state.totalTicks % TICKS_PER_GAME_MINUTE !== 0) return;
  const { spot, region, tags } = placeOf(state);
  if (!spot || !region) return;

  // The sky — unless a roof (spot or whole region) is in the way.
  if (!region.sheltered && !tags.has('indoor')) {
    const sample = weatherAt(worldSeedOf(state.createdAt), region, state.totalTicks);
    if (sample) {
      const clock = clockOf(state.totalTicks);
      const base = climateBaseline(region, clock)!;
      for (const [element, share] of weatherExposure(sample, base.temp, clock.hour)) {
        grantExposure(state, bus, element, WEATHER_XP_PER_MINUTE * share);
      }
      // The same open sky teaches the sense that reads it forward.
      tickWeathersense(state, bus, sample);
    }
  }

  // The dark grows a faculty wherever it reigns — the night sky far from
  // hearth-light, or a place that is dark by NATURE (a 'dark' tag: deep
  // caves are as black at noon as at midnight).
  const darkness = placeDarkness(region, tags, clockOf(state.totalTicks).hour);
  if (darkness > 0) {
    checkDiscovery(state, bus, ['darkness']);
    grantSkillXp(state, bus, ['darkness'], DARKNESS_XP_PER_MINUTE * darkness);
  }

  // The ground itself: a forge floor, a geyser field, a tomb — tags unioned
  // from region, area and spot, each element its own trickle.
  for (const tag of tags) {
    if (ELEMENT_TAGS.has(tag)) grantExposure(state, bus, tag, SPOT_XP_PER_MINUTE);
  }
}

// ---------- Per-completion work exposure ----------

/**
 * Called by actions.ts when an activity cycle completes. Elemental tags on
 * the activity pay resist XP scaled by the cycle's base length — the smith
 * is IN the heat for the whole job, and a faster smith completes more jobs
 * an hour, which is where efficiency pays.
 */
export function grantActivityExposure(
  state: GameState,
  bus: EventBus,
  tags: string[],
  baseTicks: number,
): void {
  for (const tag of tags) {
    if (ELEMENT_TAGS.has(tag)) {
      grantExposure(state, bus, tag, ACTIVITY_XP_PER_TICK * baseTicks);
    }
  }
}
