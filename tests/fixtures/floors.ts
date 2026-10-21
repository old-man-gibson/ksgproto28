import { FLOORS } from '../../src/core/registry';

/** Band 1 of the Ascent, bottom to top. */
export const BAND_ONE = ['ascent_f1', 'ascent_f2', 'ascent_f3'];

/**
 * Stamp the counters each floor's `clear` reads, as if the player had cleared
 * it. Read from the FloorDefs, so a test written against "band 1 is cleared"
 * survives a floor being rebuilt (the Long Hall replaced the cistern's
 * `fights:f2_cistern` on 2026-10-21). Returns `stats` for chaining.
 */
export function clearFloors(stats: Record<string, number>, floorIds: string[] = BAND_ONE): Record<string, number> {
  for (const id of floorIds) {
    for (const c of FLOORS[id].clear ?? []) {
      if (c.type === 'stat') stats[c.key] = Math.max(stats[c.key] ?? 0, c.value);
    }
  }
  return stats;
}
