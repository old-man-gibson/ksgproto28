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
    name: 'The Wilds',
    towerId: 'the_ascent',
    index: 2,
    clearsToAdvance: 2,
  },
  // Band 3, the city (docs/plans/bands-2-3.md R6-R8, M3-M5). The castle is
  // the band's hub, a place the ladder also answers; the four directions open
  // together behind the city key and are cleared in any order. Each one
  // cleared adds levels to every monster on the four floors: +2, +5, then +9
  // for the last (Q8).
  ascent_upper: {
    id: 'ascent_upper',
    name: 'The City',
    towerId: 'the_ascent',
    index: 3,
    clearsToAdvance: 4,
    order: 'any',
    gate: [{ type: 'boon', id: 'city_key' }],
    hub: 'castle_court',
    levelSteps: [0, 2, 5, 9],
  },
  // Band 4, the harbor band (docs/FLOOR_IDEAS.md idea 3), floors 11 to 14.
  // Only floor 11 exists so far: the stronghold siege on a first climb, and
  // a placeholder quay after it (§1.5).
  ascent_harbor: {
    id: 'ascent_harbor',
    name: 'The Harbor',
    towerId: 'the_ascent',
    index: 4,
    clearsToAdvance: 4,
  },
  // Skeleton bands (2026-10-30), fleshed out one by one. Index order is
  // ladder order; the docs call the desert 'band 5' by theme count.
  ascent_festival: {
    id: 'ascent_festival',
    name: 'The Vermin Festival',
    towerId: 'the_ascent',
    index: 5,
    clearsToAdvance: 2,
  },
  ascent_aberrant: {
    id: 'ascent_aberrant',
    name: 'Floor 17',
    towerId: 'the_ascent',
    index: 6,
    clearsToAdvance: 1,
  },
  ascent_desert: {
    id: 'ascent_desert',
    name: 'The Desert',
    towerId: 'the_ascent',
    index: 7,
    clearsToAdvance: 3,
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
    clearXp: 100,
  },
  ascent_f2: {
    id: 'ascent_f2',
    name: 'The Long Hall',
    towerId: 'the_ascent',
    bandId: 'ascent_lower',
    index: 2,
    areaId: 'ascent_f2_area',
    landing: 'f2_stairhead',
    // Pure accumulation: ~a dozen shifts at a Threshold job, or floor 1's
    // fights. Accrues from acting at all.
    gate: [{ type: 'stat', key: 'gold:earned', value: 150 }],
    // The clear is the far end's fight budget: f2_hall_4's fightLimit and
    // this number are the same dial (linted: the clear may not ask for more
    // fights than the limit allows). (The Flooded
    // Stair's cistern held it until 2026-10-21; it is on the shelf.)
    clear: [{ type: 'stat', key: 'fights:f2_hall_4', value: 3 }],
    clearXp: 150,
  },
  ascent_f3: {
    id: 'ascent_f3',
    name: 'The Descent',
    towerId: 'the_ascent',
    bandId: 'ascent_lower',
    index: 3,
    areaId: 'ascent_f3_area',
    landing: 'f3_stairhead',
    gate: [{ type: 'stat', key: 'gold:earned', value: 600 }],
    // A named kill: the puppet bureaucrat at the bottom of the stairwell, the
    // Hearing Room's one fight. (The Silk Gallery's queen held it until
    // 2026-10-21; that floor is on the shelf.)
    clear: [{ type: 'stat', key: 'slain:f3_hearing_room:puppet_bureaucrat', value: 1 }],
    clearXp: 200,
  },
  // ---- Band 2: the Wilds (docs/plans/bands-2-3.md), sketch fidelity. Every
  // hunt on these floors is endless, so each gate reads goblin kills, which
  // any den in the band pays (COMPLETABILITY §2: an endless source).
  ascent_f4: {
    id: 'ascent_f4',
    name: 'The Greenwood',
    towerId: 'the_ascent',
    bandId: 'ascent_middle',
    index: 4,
    areaId: 'ascent_f4_area',
    landing: 'f4_treeline',
    clear: [{ type: 'stat', key: 'slain:f4_ravine_floor:goblin_raid_leader', value: 1 }],
    clearXp: 250,
  },
  ascent_f5: {
    id: 'ascent_f5',
    name: 'The Mire',
    towerId: 'the_ascent',
    bandId: 'ascent_middle',
    index: 5,
    areaId: 'ascent_f5_area',
    landing: 'f5_causeway',
    gate: [{ type: 'stat', key: 'kills:tag:goblin', value: 12 }],
    clear: [{ type: 'stat', key: 'slain:f5_back_door:hobgoblin_champion', value: 1 }],
    clearXp: 300,
  },
  ascent_f6: {
    id: 'ascent_f6',
    name: 'The Warren',
    towerId: 'the_ascent',
    bandId: 'ascent_middle',
    index: 6,
    areaId: 'ascent_f6_area',
    landing: 'f6_warren_mouth',
    gate: [{ type: 'stat', key: 'kills:tag:goblin', value: 40 }],
    // The warchief's kill: also PRESTIGE_UNLOCK (prestige.data.ts).
    clear: [{ type: 'stat', key: 'slain:f6_great_hall:goblin_warchief', value: 1 }],
    clearXp: 400,
  },
  // ---- Band 3: the City, a SKELETON. South, West, North, East = floors 7 to
  // 10 (R6). Each is a district, the land past its wall, and a keeper at the
  // far end whose kill is the clear. Themes and monsters are stand-ins from
  // the existing roster until the user captions them (Q9); the band gate is
  // the city key, so the floors carry no gate of their own.
  ascent_f7: {
    id: 'ascent_f7',
    name: 'The South Ward',
    towerId: 'the_ascent',
    bandId: 'ascent_upper',
    index: 7,
    areaId: 'ascent_f7_area',
    landing: 'f7_docks',
    clear: [{ type: 'stat', key: 'slain:f7_wreck:giant_spider_queen', value: 1 }],
    clearXp: 500,
  },
  ascent_f8: {
    id: 'ascent_f8',
    name: 'The West Ward',
    towerId: 'the_ascent',
    bandId: 'ascent_upper',
    index: 8,
    areaId: 'ascent_f8_area',
    landing: 'f8_forest_gate',
    clear: [{ type: 'stat', key: 'slain:f8_lodge:hobgoblin_champion', value: 1 }],
    clearXp: 500,
  },
  ascent_f9: {
    id: 'ascent_f9',
    name: 'The North Ward',
    towerId: 'the_ascent',
    bandId: 'ascent_upper',
    index: 9,
    areaId: 'ascent_f9_area',
    landing: 'f9_cathedral_close',
    clear: [{ type: 'stat', key: 'slain:f9_ossuary:death_knight', value: 1 }],
    clearXp: 500,
  },
  ascent_f10: {
    id: 'ascent_f10',
    name: 'The East Ward',
    towerId: 'the_ascent',
    bandId: 'ascent_upper',
    index: 10,
    areaId: 'ascent_f10_area',
    landing: 'f10_artificers_row',
    clear: [{ type: 'stat', key: 'slain:f10_foundry:stone_golem', value: 1 }],
    clearXp: 500,
  },
  // ---- Floor 11 (docs/FLOOR_IDEAS.md §1.5, §5.3). One floor, two lives.
  // On a first climb the stronghold wing is the floor: repairs, then the wave
  // on the wall, whose hold ends the run (STRONGHOLD_HELD, an automatic
  // prestige). From the next run on (STRONGHOLD_KEY) the siege is shut, the
  // gatehouse holds the door to the hold, and the way to the quay is open.
  // The clear is the quay side's, so a first climb never clears floor 11;
  // it does not need to, because the wave ends the run. The quay and the
  // roadstead are placeholders for idea 3's floor 11.
  ascent_f11: {
    id: 'ascent_f11',
    name: 'The Stronghold Road',
    towerId: 'the_ascent',
    bandId: 'ascent_harbor',
    index: 11,
    areaId: 'ascent_f11_area',
    landing: 'f11_road',
    clear: [{ type: 'stat', key: 'fights:f11_roadstead', value: 1 }],
    clearXp: 600,
  },
  // ==== HARBOR: floors (skeleton 2026-10-30; the harbor builder's section) ====
  ascent_f12: {
    id: 'ascent_f12',
    name: 'The Outer Waters (placeholder)',
    towerId: 'the_ascent',
    bandId: 'ascent_harbor',
    index: 12,
    areaId: 'ascent_f12_area',
    landing: 'f12_landing',
    clear: [{ type: 'stat', key: 'fights:f12_keeper', value: 1 }],
    clearXp: 650,
  },
  ascent_f13: {
    id: 'ascent_f13',
    name: 'The Blockade (placeholder)',
    towerId: 'the_ascent',
    bandId: 'ascent_harbor',
    index: 13,
    areaId: 'ascent_f13_area',
    landing: 'f13_landing',
    clear: [{ type: 'stat', key: 'fights:f13_keeper', value: 1 }],
    clearXp: 700,
  },
  ascent_f14: {
    id: 'ascent_f14',
    name: 'The Final Mission (placeholder)',
    towerId: 'the_ascent',
    bandId: 'ascent_harbor',
    index: 14,
    areaId: 'ascent_f14_area',
    landing: 'f14_landing',
    clear: [{ type: 'stat', key: 'fights:f14_keeper', value: 1 }],
    clearXp: 750,
  },
  // ==== FESTIVAL: floors (skeleton 2026-10-30; the festival builder's section) ====
  ascent_f15: {
    id: 'ascent_f15',
    name: 'The Dark Room (placeholder)',
    towerId: 'the_ascent',
    bandId: 'ascent_festival',
    index: 15,
    areaId: 'ascent_f15_area',
    landing: 'f15_landing',
    clear: [{ type: 'stat', key: 'fights:f15_keeper', value: 1 }],
    clearXp: 800,
  },
  ascent_f16: {
    id: 'ascent_f16',
    name: 'The Royale (placeholder)',
    towerId: 'the_ascent',
    bandId: 'ascent_festival',
    index: 16,
    areaId: 'ascent_f16_area',
    landing: 'f16_landing',
    clear: [{ type: 'stat', key: 'fights:f16_keeper', value: 1 }],
    clearXp: 850,
  },
  // ==== ABERRANT: floors (skeleton 2026-10-30; the aberrant builder's section) ====
  ascent_f17: {
    id: 'ascent_f17',
    name: 'Floor 17 (placeholder)',
    towerId: 'the_ascent',
    bandId: 'ascent_aberrant',
    index: 17,
    areaId: 'ascent_f17_area',
    landing: 'f17_landing',
    clear: [{ type: 'stat', key: 'fights:f17_keeper', value: 1 }],
    clearXp: 900,
  },
  // ==== DESERT: floors (skeleton 2026-10-30; the desert builder's section) ====
  ascent_f18: {
    id: 'ascent_f18',
    name: 'The Necropolis Road (placeholder)',
    towerId: 'the_ascent',
    bandId: 'ascent_desert',
    index: 18,
    areaId: 'ascent_f18_area',
    landing: 'f18_landing',
    clear: [{ type: 'stat', key: 'fights:f18_keeper', value: 1 }],
    clearXp: 950,
  },
  ascent_f19: {
    id: 'ascent_f19',
    name: 'The Pyramid (placeholder)',
    towerId: 'the_ascent',
    bandId: 'ascent_desert',
    index: 19,
    areaId: 'ascent_f19_area',
    landing: 'f19_landing',
    clear: [{ type: 'stat', key: 'fights:f19_keeper', value: 1 }],
    clearXp: 1000,
  },
  ascent_f20: {
    id: 'ascent_f20',
    name: 'The Delta Port (placeholder)',
    towerId: 'the_ascent',
    bandId: 'ascent_desert',
    index: 20,
    areaId: 'ascent_f20_area',
    landing: 'f20_landing',
    clear: [{ type: 'stat', key: 'fights:f20_keeper', value: 1 }],
    clearXp: 1050,
  },
});

/**
 * Authored edges allowed across a banded floor's boundary. The ladder is the
 * only door into a floor (content.test.ts, forge validate); each pair here is
 * a decision, both directions listed.
 *
 * - The hold's door on floor 11 (FLOOR_IDEAS.md §5.3 item 9). Both edges are
 *   oneWay and gated on STRONGHOLD_KEY, and the hold's only other exit is
 *   one-way out to the Foot, so nothing reaches floor 11 through the hold
 *   without having climbed there first.
 */
export const OFF_LADDER_DOORS: [from: string, to: string][] = [
  ['f11_gatehouse', 'base_entrance'],
  ['base_entrance', 'f11_gatehouse'],
];

/** True for an authored edge listed in OFF_LADDER_DOORS. */
export function offLadderDoor(from: string, to: string): boolean {
  return OFF_LADDER_DOORS.some(([f, t]) => f === from && t === to);
}
