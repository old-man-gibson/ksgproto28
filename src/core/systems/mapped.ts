import type { GameState } from '../types';
import { AREAS, REGIONS, SPOTS } from '../registry';

/**
 * Mapped regions (RegionDef.mapped) have no fog. Once any spot in one is
 * discovered, every spot in it is. Threshold is the only one: the city is a
 * directory, the tower is the place you scout.
 */

/** Whether a spot sits in a mapped region. */
export function inMappedRegion(spotId: string): boolean {
  const spot = SPOTS[spotId];
  const region = spot && REGIONS[AREAS[spot.areaId]?.regionId ?? ''];
  return !!region?.mapped;
}

/**
 * Discover the rest of every mapped region the player has a foothold in.
 * Called on arrival and on load, and wherever a spot is discovered without a
 * walk (tutorial skip, a new run, a haven carry, a rumor find). On load it
 * also covers saves from before the flag and town spots added since.
 * Returns one entry per region that gained spots, for the log.
 */
export function revealMapped(state: GameState): { region: string; added: number }[] {
  const known = new Set(state.discovered);
  const byRegion = new Map<string, string[]>();
  for (const spot of Object.values(SPOTS)) {
    const regionId = AREAS[spot.areaId]?.regionId;
    if (!regionId || !REGIONS[regionId]?.mapped) continue;
    const list = byRegion.get(regionId);
    if (list) list.push(spot.id);
    else byRegion.set(regionId, [spot.id]);
  }
  const opened: { region: string; added: number }[] = [];
  for (const [regionId, spots] of byRegion) {
    if (!spots.some((id) => known.has(id))) continue;
    let added = 0;
    for (const id of spots) {
      if (known.has(id)) continue;
      state.discovered.push(id);
      known.add(id);
      added++;
    }
    if (added > 0) opened.push({ region: regionId, added });
  }
  return opened;
}
