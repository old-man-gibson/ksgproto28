/**
 * Mounts the shelved countryside (src/core/data/shelved/) into the live
 * registry for the duration of a test file.
 *
 *   import '../fixtures/shelved-world';
 *
 * as the FIRST import of any test that stands on an old-world spot, talks to
 * one of its NPCs, or accepts one of its quests. The registry's tables are
 * plain objects re-exported by reference, so assigning into them is enough;
 * the adjacency map gets the shelf's edges plus the Hamlet Road that joined
 * it to Threshold, mirrored exactly as the registry mirrors live roads.
 *
 * Vitest gives every test file its own module graph, so a mount never leaks
 * between files, and importing this twice in one file is a no-op.
 */
import {
  ADJACENCY,
  AREAS,
  NPCS,
  QUESTS,
  REGIONS,
  SPOTS,
  buildAdjacency,
  declaredConnections,
} from '../../src/core/registry';
import { SHELVED_WORLD } from '../../src/core/data/shelved';

Object.assign(REGIONS, SHELVED_WORLD.regions);
Object.assign(AREAS, SHELVED_WORLD.areas);
Object.assign(SPOTS, SHELVED_WORLD.spots);
Object.assign(NPCS, SHELVED_WORLD.npcs);
Object.assign(QUESTS, SHELVED_WORLD.quests);
buildAdjacency([...declaredConnections(SHELVED_WORLD.spots), ...SHELVED_WORLD.roads], ADJACENCY);

/** The square the countryside hung off — the classic dev start, once. */
export const SHELVED_START = 'village_square';
