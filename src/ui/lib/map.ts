import type { GameState, SpotDef } from '../../core/types';
import { AREAS, FLOOR_BY_AREA, SPOTS, getSpot } from '../../core/registry';
import { visibleEdges } from '../../core/systems/locations';

/** Known places and adjacent unexplored places, scoped to the displayed region/floor. */
export function mapNodes(state: GameState, shownRegion: string): { spot: SpotDef; known: boolean }[] {
  const here = getSpot(state.spot);
  const floor = FLOOR_BY_AREA.get(here.areaId);
  const currentRegion = AREAS[here.areaId].regionId;
  const discovered = new Set(state.discovered);
  const ghosts = new Set<string>();
  for (const id of discovered) {
    for (const edge of visibleEdges(state, id)) {
      if (!discovered.has(edge.to)) ghosts.add(edge.to);
    }
  }
  return Object.values(SPOTS)
    .filter((spot) => spot.map && AREAS[spot.areaId].regionId === shownRegion)
    .filter((spot) => shownRegion !== currentRegion || !floor || spot.areaId === floor.areaId)
    .filter((spot) => discovered.has(spot.id) || ghosts.has(spot.id))
    .map((spot) => ({ spot, known: discovered.has(spot.id) }));
}
