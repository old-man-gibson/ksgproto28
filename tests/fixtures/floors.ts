import { FLOORS } from '../../src/core/registry';

/** Band 1 of the Ascent, bottom to top. */
export const BAND_ONE = ['ascent_f1', 'ascent_f2', 'ascent_f3'];

/**
 * Every floor a run clears before it can prestige: bands 1 and 2, since the
 * prestige unlock moved to floor 6's warchief (docs/plans/bands-2-3.md R1).
 */
export const TO_PRESTIGE = [...BAND_ONE, 'ascent_f4', 'ascent_f5', 'ascent_f6'];

/**
 * Stamp the counters each floor's `clear` reads, as if the player had cleared
 * it. Read from the FloorDefs, so a test written against "the run is cleared"
 * survives a floor being rebuilt (the Long Hall replaced the cistern's
 * `fights:f2_cistern` on 2026-10-21). Defaults to every floor up to the
 * prestige unlock. Returns `stats` for chaining.
 */
export function clearFloors(stats: Record<string, number>, floorIds: string[] = TO_PRESTIGE): Record<string, number> {
  for (const id of floorIds) {
    for (const c of FLOORS[id].clear ?? []) {
      if (c.type === 'stat') stats[c.key] = Math.max(stats[c.key] ?? 0, c.value);
    }
  }
  return stats;
}
