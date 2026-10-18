import type { BandDef, FloorDef, TowerDef } from '../types';
import { prose } from '../text/prose';
import { TOWERS_TEXT, BANDS_TEXT, FLOORS_TEXT } from '../text/towers.text';

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

export const TOWERS = prose<TowerDef>('TOWERS', TOWERS_TEXT, {
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
  },
});

/**
 * REVISED 2026-09-06 (plans/alpha-band-one.md): the ascent is SEQUENTIAL —
 * every rung must be cleared to pass it (`FloorDef.clear`), floors have no
 * fixed stairs (`climbTo` moves freely between the hub and unlocked floors),
 * and `clearsToAdvance` is currently unread. Bands remain as chapters: shared
 * theming, and the natural seam for future checkpoint behaviour.
 *
 * The completability duty the old band-disjunction carried now sits on each
 * floor's `clear` and `gate` directly: prefer accumulation — gold, kills at
 * the floor's own dens, quest counts. Those accrue from acting at all, which
 * is what carries a player who engages with no subsystem on its own terms,
 * and with every rung mandatory there is no sibling floor to hide a
 * discipline gate behind.
 */
export const BANDS = prose<BandDef>('BANDS', BANDS_TEXT, {
  ascent_lower: {
    id: 'ascent_lower',
    name: 'The Lower Reaches',
    towerId: 'the_ascent',
    index: 1,
    clearsToAdvance: 2,
  },
  ascent_middle: {
    id: 'ascent_middle',
    name: 'The Middle Galleries',
    towerId: 'the_ascent',
    index: 2,
    clearsToAdvance: 2,
  },
  ascent_upper: {
    id: 'ascent_upper',
    name: 'The Upper Reaches',
    towerId: 'the_ascent',
    index: 3,
    clearsToAdvance: 2,
  },
});

/**
 * A floor IS an area: `areaId` names the AreaDef whose spots make it up, so
 * travel, exploration, encounters, benches, the forge's map editor and every
 * existing world lint work on floors with no new machinery.
 *
 * A floor with no `bandId` is **off the ladder** — it advances nothing and
 * gates nothing. That is what makes hidden/special floors optional content by
 * construction rather than by an author remembering to say so. (The player's
 * hold was the first such floor; on 2026-09-12 it left the tower for a map of
 * its own, behind the first prestige — see the `the_hold` region.)
 */
export const FLOORS = prose<FloorDef>('FLOORS', FLOORS_TEXT, {
  // ---- Floor 0: the Holding Level, the tutorial. OFF the ladder (no bandId)
  // so it advances nothing, gates nothing and is exempt from the closed-area
  // rule: its gate is an authored one-way road into Threshold. Index 0 is
  // hub level, which is what it is — the floor the door at the Foot opens
  // onto from the inside. A fresh save starts on it (STARTING_SPOT); the
  // tutorial's steps and flags live in data/tutorial.data.ts.
  ascent_f0: {
    id: 'ascent_f0',
    name: 'The Holding Level',
    towerId: 'the_ascent',
    index: 0,
    areaId: 'ascent_f0_area',
    landing: 'f0_cell',
  },
  // ---- Band 1: the Lower Reaches. Names are placeholders (forge-renameable);
  // levels and gate numbers are first guesses, tuned in review. Every clear
  // reads a counter that already persists — nothing here added save state.
  ascent_f1: {
    id: 'ascent_f1',
    name: 'The Flooded Offices',
    towerId: 'the_ascent',
    bandId: 'ascent_lower',
    index: 1,
    areaId: 'ascent_f1_area',
    landing: 'f1_landing',
    // The flooded offices are the first rung after the prologue.
    // Keep the existing boss counter so old clears and the Warden quest
    // remain valid; the submerged collector now pays it and the toll stamp.
    clear: [{ type: 'stat', key: 'boss:f1_toll_hall', value: 1 }],
  },
  ascent_f2: {
    id: 'ascent_f2',
    name: 'The Flooded Stair',
    towerId: 'the_ascent',
    bandId: 'ascent_lower',
    index: 2,
    areaId: 'ascent_f2_area',
    landing: 'f2_landing',
    // Pure accumulation: ~a dozen shifts at a Threshold job, or floor 1's
    // fights. Accrues from acting at all.
    gate: [{ type: 'stat', key: 'gold:earned', value: 150 }],
    // The clear is a spent fight budget: the cistern's fightLimit and this
    // number are the same dial and are linted to agree.
    clear: [{ type: 'stat', key: 'fights:f2_cistern', value: 8 }],
  },
  ascent_f3: {
    id: 'ascent_f3',
    name: 'The Silk Gallery',
    towerId: 'the_ascent',
    bandId: 'ascent_lower',
    index: 3,
    areaId: 'ascent_f3_area',
    landing: 'f3_landing',
    gate: [{ type: 'stat', key: 'gold:earned', value: 600 }],
    // A named kill again — the brood den's `once` queen.
    clear: [{ type: 'stat', key: 'slain:f3_brood_den:giant_spider_queen', value: 1 }],
  },
});
