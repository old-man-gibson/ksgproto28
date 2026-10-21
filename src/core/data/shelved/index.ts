import { SHELVED_AREAS, SHELVED_REGIONS, SHELVED_ROADS, SHELVED_SPOTS } from './locations.shelved';
import { SHELVED_FLOOR_AREAS, SHELVED_FLOOR_ROADS, SHELVED_FLOOR_SPOTS } from './floors.shelved';
import { SHELVED_NPCS } from './npcs.shelved';
import { SHELVED_QUESTS } from './quests.shelved';

/**
 * THE SHELF, bundled. Not imported by the registry, the forge, or any UI —
 * only by tests/fixtures/shelved-world.ts, which mounts it so the tests
 * written against the countryside keep running and the shelf stays valid
 * content. docs/LONGTERM.md §"The countryside" is the entry; the tower floors
 * replaced on 2026-10-21 (floors.shelved.ts) ride along.
 */
export const SHELVED_WORLD = {
  regions: SHELVED_REGIONS,
  areas: { ...SHELVED_AREAS, ...SHELVED_FLOOR_AREAS },
  spots: { ...SHELVED_SPOTS, ...SHELVED_FLOOR_SPOTS },
  npcs: SHELVED_NPCS,
  quests: SHELVED_QUESTS,
  roads: [...SHELVED_ROADS, ...SHELVED_FLOOR_ROADS],
};
