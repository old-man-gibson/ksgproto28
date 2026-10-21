import type { SceneId, SpotDef } from '../../core/types';
import { AREAS, REGIONS } from '../../core/registry';

/**
 * Which backdrop a place is painted against (see `SceneId`). A spot's own
 * `scene` wins, then its area's; with neither, the place tags choose, so
 * every spot in the game gets something rather than a blank.
 */
export function sceneFor(spot: SpotDef): SceneId {
  if (spot.scene) return spot.scene;
  const area = AREAS[spot.areaId];
  if (area?.scene) return area.scene;
  const region = REGIONS[area?.regionId ?? ''];
  const tags = new Set([...(region?.tags ?? []), ...(area?.tags ?? []), ...(spot.tags ?? [])]);
  if (tags.has('dark')) return 'crypt';
  if (tags.has('indoor')) return 'hall';
  return 'town';
}

/** A small deterministic stream, so a scene's scatter is the same every paint. */
export function scatter(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}
