import type { AttributeId } from '../types';
import type { Game } from '../game';
import { MS_PER_TICK } from '../engine/loop';
import { ATTRIBUTE_LIST } from '../data/attributes.data';
import { SKILLS } from '../registry';
import { bankTicks } from '../systems/bonustime';
import { festivalHolds } from '../systems/festivalRules';

/** Cap offline progress at 8 hours of game time. */
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
/** Don't bother summarizing anything shorter than a minute. */
export const OFFLINE_MIN_MS = 60 * 1000;

export interface OfflineSummary {
  ticks: number;
  ms: number;
  capped: boolean;
  kills: number;
  goldGained: number;
  itemsGained: number;
  attrLevels: { attr: AttributeId; gained: number }[];
  skillLevels: { id: string; name: string; gained: number }[];
  /**
   * Ticks of the absence not simulated because the Vermin Festival held the
   * player (from the start, or from the tick a climb landed them inside),
   * whose clock runs only while the game does.
   */
  festivalSkipped?: number;
  /** How much of `festivalSkipped` the bonus-time bank took: less when it hit its cap. */
  festivalBanked?: number;
}

/** What a catch-up did: ticks simulated, and ticks the festival skipped and what the bank took of them. */
export interface CatchUp {
  simulated: number;
  skipped: number;
  banked: number;
}

/**
 * Run `ticks` ticks of time the player was away. `Game.catchingUp` is true
 * for exactly these ticks, so the harbor's convoys pay them at the offline
 * rate and never toward a clear (systems/sea.ts). Every catch-up loop goes
 * through here, the summarised one below and the UI's quiet short-gap one
 * (ui/state.svelte.ts runCatchup), so neither can forget the flag.
 *
 * The Vermin Festival is not simulated (docs/FLOOR_IDEAS.md §5.3 item 19):
 * the moment it holds the player, from the first tick or from the tick a
 * climb lands them in the dark room, the loop stops and the rest of the
 * absence goes to the bonus-time bank, 1:1 up to its cap.
 */
export function catchUpTicks(game: Game, ticks: number): CatchUp {
  game.catchingUp = true;
  let simulated = 0;
  try {
    for (; simulated < ticks; simulated++) {
      if (festivalHolds(game.state)) break;
      game.tick();
    }
  } finally {
    game.catchingUp = false;
  }
  const skipped = ticks - simulated;
  const before = game.state.bonusTime.banked;
  if (skipped > 0) bankTicks(game.state, skipped);
  return { simulated, skipped, banked: game.state.bonusTime.banked - before };
}

/**
 * Run capped catch-up ticks with logging suppressed and report what happened.
 * Returns null when the absence was too short to matter.
 */
export function runOfflineProgress(game: Game, elapsedMs: number): OfflineSummary | null {
  // A frozen world owes nobody catch-up: `tick()` would no-op every one of
  // these anyway, and reporting a summary of nothing happening is worse.
  if (game.state.paused) return null;
  if (elapsedMs < OFFLINE_MIN_MS) return null;
  const capped = elapsedMs > OFFLINE_CAP_MS;
  const simMs = Math.min(elapsedMs, OFFLINE_CAP_MS);
  const ticks = Math.floor(simMs / MS_PER_TICK);
  if (ticks <= 0) return null;

  const s = game.state;
  const before = {
    kills: s.stats['kills'] ?? 0,
    gold: s.gold,
    items: s.inventory.length,
    attrs: Object.fromEntries(ATTRIBUTE_LIST.map((a) => [a.id, s.attrs[a.id].level])),
    skills: Object.fromEntries(Object.entries(s.skills).map(([id, v]) => [id, v.level])),
  };

  game.suppressLog = true;
  const run = catchUpTicks(game, ticks);
  game.suppressLog = false;

  const attrLevels = ATTRIBUTE_LIST.map((a) => ({
    attr: a.id,
    gained: s.attrs[a.id].level - before.attrs[a.id],
  })).filter((x) => x.gained > 0);

  const skillLevels = Object.entries(s.skills)
    .map(([id, v]) => ({
      id,
      name: SKILLS[id]?.name ?? id,
      gained: v.level - (before.skills[id] ?? 0),
    }))
    .filter((x) => x.gained > 0);

  // A prestige during catch-up (the stronghold's, Game.tick) resets the run
  // under these counts, so a difference can go negative: report nothing for it.
  return {
    ticks: run.simulated,
    ms: simMs,
    capped,
    kills: Math.max(0, (s.stats['kills'] ?? 0) - before.kills),
    goldGained: Math.max(0, s.gold - before.gold),
    itemsGained: Math.max(0, s.inventory.length - before.items),
    attrLevels,
    skillLevels,
    ...(run.skipped > 0 ? { festivalSkipped: run.skipped, festivalBanked: run.banked } : {}),
  };
}
