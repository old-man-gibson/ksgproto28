/**
 * Three test spots in the Malgeri Range region (data/locations.data.ts), so a
 * test can stand under the mountain sky, under a roof inside it, and in a
 * sheltered area of it.
 *
 *   import './fixtures/malgeri';
 *
 * Floor 17's real spots (docs/MALGERI.md) have tables the engine tests should
 * not depend on; these give them one of known shape. The registry's
 * tables are plain objects re-exported by reference (see ./shelved-world), so
 * assigning into them is enough, and a mount never leaks between test files.
 * The three spots share one encounter table: a plain line, a line that waits on
 * a gale or a storm, and a line that waits on a calm.
 */
import { AREAS, SPOTS } from '../../src/core/registry';
import type { SpotDef, SpotEncounter } from '../../src/core/types';

/** Open sky: weather reaches it. */
export const RIDGE = 'test_malgeri_ridge';
/** A roof inside the same region: the `indoor` tag, so no weather. */
export const HUT = 'test_malgeri_hut';
/** An area that overrides the region to sheltered: no weather either. */
export const CAVE = 'test_malgeri_cave';

export const PLAIN = 'goblin';
export const WINDY = 'hobgoblin';
export const STILL = 'slime_king';

const table = (): SpotEncounter[] => [
  { monsterId: PLAIN, weight: 10, level: [1, 1] },
  { monsterId: WINDY, weight: 10, level: [1, 1], sky: ['gale', 'storm'] },
  { monsterId: STILL, weight: 10, level: [1, 1], sky: ['calm'] },
];

const spot = (id: string, areaId: string, tags?: string[]): SpotDef => ({
  id,
  name: id,
  icon: '⛰️',
  areaId,
  desc: 'A test spot.',
  activities: [],
  encounters: table(),
  connections: [],
  ...(tags ? { tags } : {}),
});

AREAS.test_malgeri_area = { id: 'test_malgeri_area', name: 'Test Malgeri', regionId: 'malgeri_range' };
AREAS.test_malgeri_cave_area = {
  id: 'test_malgeri_cave_area',
  name: 'Test Malgeri Cave',
  regionId: 'malgeri_range',
  sheltered: true,
};
SPOTS[RIDGE] = spot(RIDGE, 'test_malgeri_area');
SPOTS[HUT] = spot(HUT, 'test_malgeri_area', ['indoor']);
SPOTS[CAVE] = spot(CAVE, 'test_malgeri_cave_area');
