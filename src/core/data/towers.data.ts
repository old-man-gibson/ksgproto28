import type { BandDef, FloorDef, TowerDef } from '../types';

/**
 * Vertical content: stacks of floors hanging off a hub spot.
 *
 * The whole point of the structure is authoring atomicity — a floor declares
 * one required connection (its stack) and nothing else, so adding one never
 * means reasoning about the world in total. Three rules keep that true, and
 * all three are linted rather than trusted:
 *
 * 1. **Hidden access is never on a critical path.** A floor's *contents* may
 *    be unknown; the *door* may not. Advertised-but-locked is the normal
 *    shape — a visible edge whose destination carries a gate.
 * 2. **Every lateral edge is legal to delete.** Drop them all and the world
 *    still completes. This is the enforceable form of "laterals may add,
 *    never gate".
 * 3. **Optional is computed, not declared** — derived from the critical-path
 *    closure, so an author cannot mislabel it.
 *
 * They compose: a floor reached only through hidden edges is non-critical by
 * (1); one reached only laterally is deletable by (2), which is consistent
 * with being optional by (3). Critical floors are therefore always reachable
 * through visible edges — which is the teacher-reachability guarantee
 * COMPLETABILITY.md §3 needs, derived rather than bolted on.
 */

export const TOWERS: Record<string, TowerDef> = {
  // The first stack. `foreknown` is what makes it read as a tower rather than
  // a dungeon: you can see the ladder above you and plan toward its gates.
  // A descent would set it false and reveal bands only as they open.
  the_ascent: {
    id: 'the_ascent',
    name: 'The Ascent',
    icon: '🗼',
    hubSpot: 'ascent_foot',
    direction: 'up',
    foreknown: true,
    desc: 'It was here before Threshold was, and the city grew around its foot the way a town grows around a river crossing. Eight roads reach it. All eight arrive at the same door.',
  },
};

/**
 * Bands open as a unit, and that is deliberate: `conditionsMet` is a pure AND
 * with no `any`, so the OR a player needs lives in the topology instead of the
 * predicate language. Several floors per band, each with a flat gate, and
 * `clearsToAdvance` of them opens the next band.
 *
 * Keep at least one floor per band gated on pure accumulation — gold, quest
 * counts, discovery counts. Those accrue from acting at all, which is what
 * carries a player who engages with no subsystem on its own terms.
 */
export const BANDS: Record<string, BandDef> = {
  ascent_lower: {
    id: 'ascent_lower',
    name: 'The Lower Reaches',
    towerId: 'the_ascent',
    index: 1,
    clearsToAdvance: 2,
    desc: 'Floors the city still uses. Storerooms, a flooded stair, the old toll level nobody collects on any more.',
  },
  ascent_middle: {
    id: 'ascent_middle',
    name: 'The Middle Galleries',
    towerId: 'the_ascent',
    index: 2,
    clearsToAdvance: 2,
    desc: 'Above the last floor anyone has a key to.',
  },
  ascent_upper: {
    id: 'ascent_upper',
    name: 'The Upper Reaches',
    towerId: 'the_ascent',
    index: 3,
    clearsToAdvance: 2,
    desc: 'Visible from every district, and from nowhere else.',
  },
};

/**
 * A floor IS an area: `areaId` names the AreaDef whose spots make it up, so
 * travel, exploration, encounters, benches, the forge's map editor and every
 * existing world lint work on floors with no new machinery.
 *
 * A floor with no `bandId` is **off the ladder** — it advances nothing and
 * gates nothing. That is what makes the player's own base optional content by
 * construction rather than by an author remembering to say so.
 */
export const FLOORS: Record<string, FloorDef> = {
  // The one floor that is yours. It sits at hub level, opens off the city like
  // any district does, and is the single thing a prestige does not take —
  // see `persists`, which is a declaration only until prestige exists.
  ascent_hold: {
    id: 'ascent_hold',
    name: 'Your Hold',
    towerId: 'the_ascent',
    index: 0,
    areaId: 'player_base_v1_area',
    personal: true,
    persists: true,
    desc: 'A floor the tower was not using. It is yours now, in the sense that nobody has come to argue about it.',
  },
};
