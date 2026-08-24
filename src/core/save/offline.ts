import type { AttributeId } from '../types';
import type { Game } from '../game';
import { MS_PER_TICK } from '../engine/loop';
import { ATTRIBUTE_LIST } from '../data/attributes.data';
import { SKILLS } from '../registry';

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
  for (let i = 0; i < ticks; i++) game.tick();
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

  return {
    ticks,
    ms: simMs,
    capped,
    kills: (s.stats['kills'] ?? 0) - before.kills,
    goldGained: s.gold - before.gold,
    itemsGained: Math.max(0, s.inventory.length - before.items),
    attrLevels,
    skillLevels,
  };
}
