import type { AreaDef, RegionDef, SpotDef } from '../types';
import { prose } from '../text/prose';
import { SPOTS_TEXT } from '../text/locations.text';
export const REGIONS: Record<string, RegionDef> = {
  // The stack itself: everything on the far side of the tower door. Floors
  // live here; the door and the city around it stay in `threshold`.
  the_ascent: { id: 'the_ascent', name: 'The Ascent', terrain: 'plains', sheltered: true, world: { x: 14.3, y: 21.6 } },
  // The city that grew around the tower's foot, and where a new life now
  // opens. `settlement` on the REGION is lamplight everywhere inside the
  // walls — no darkness training anywhere in Threshold, and no night-fighting
  // penalty either. Districts that want a dark room say so on the spot.
  threshold: { id: 'threshold', name: 'Threshold', terrain: 'plains', mapped: true, tags: ['settlement'], world: { x: 14, y: 22 } },
  // Your hold — its own map. Since 2026-10-30 its door is in floor 11's
  // gatehouse, open once the stronghold is held (`legacy:stronghold`,
  // FLOOR_IDEAS.md §5.3 item 9); before that it opened from the Foot at the
  // first prestige.
  // It stopped being a floor of the tower on 2026-09-12; the user's call was
  // "a new map, accessible only once the player has prestiged". NAME AND PIN
  // ARE PLACEHOLDERS (forge-renameable). The atlas pin sits beside the
  // Ascent because the door does; where the hold *is* is fiction not yet
  // written.
  //
  // TODO: the yard's weather question. The old SPEC was "entirely exposed to
  // the weather at the start, upgradeable to entirely sheltered so it always
  // functions at 100%". `sheltered: true` is carried over unchanged so
  // nothing about exposure has silently shifted; decide whether the hold
  // keeps an open yard (drop `sheltered`, tag the indoor rooms individually)
  // or is simply indoors.
  // Floor 0 of the tower, the tutorial (plans/floor-zero-tutorial.md): a
  // holding cell, the cellblock outside it, the field and the gate into
  // Threshold. Its own map so it can be drawn as tiles (ui/lib/tilemaps).
  // `settlement` = lamplight: no night-fighting penalty on a floor that
  // exists to explain fighting.
  holding_level: { id: 'holding_level', name: 'The Holding Level', terrain: 'plains', tags: ['settlement'], world: { x: 14.3, y: 22.4 } },
  the_hold: { id: 'the_hold', name: 'Your Hold', terrain: 'plains', sheltered: true, world: { x: 14.8, y: 21 } },
};

export const AREAS: Record<string, AreaDef> = {
  // Your hold. One area, one region, no floor: it is off every ladder by
  // construction, and its door (ascent_foot → base_entrance) is the single
  // gate the prestige system will lift. `FloorDef.personal` / `.persists`
  // remain the declarations prestige must honour when it lands.
  player_base_v1_area: { id: 'player_base_v1_area', name: 'Your Hold', regionId: 'the_hold', scene: 'hall' },
  // Threshold's eight districts. Each one has a SIGNATURE subsystem rather
  // than a monopoly on it — the Ironyard is where martial training is best
  // supported, not the only place a blade is welcome. Keeping them signatures
  // is what stops a district becoming a mandatory stop for a discipline.
  scholars_quarter: { id: 'scholars_quarter', name: "Scholars' Quarter", regionId: 'threshold' },
  temple_rise: { id: 'temple_rise', name: 'Temple Rise', regionId: 'threshold' },
  the_ironyard: { id: 'the_ironyard', name: 'The Ironyard', regionId: 'threshold' },
  alembic_row: { id: 'alembic_row', name: 'Alembic Row', regionId: 'threshold' },
  the_chancery: { id: 'the_chancery', name: 'The Chancery', regionId: 'threshold' },
  the_assize: { id: 'the_assize', name: 'The Assize', regionId: 'threshold' },
  wrights_ward: { id: 'wrights_ward', name: "Wrights' Ward", regionId: 'threshold' },
  the_granaries: { id: 'the_granaries', name: 'The Granaries', regionId: 'threshold' },
  // The tower's mouth is part of the CITY, not the stack: it sits at the
  // centre of Threshold's map with all eight roads running to it, and the
  // stack proper begins on the far side of the door.
  ascent_foot_area: { id: 'ascent_foot_area', name: 'The Foot', regionId: 'threshold' },
  // Band 1 of the Ascent — one area per floor, because a floor IS an area
  // (towers.data.ts). These areas are CLOSED: no authored edge crosses their
  // boundary (linted, both layers) — the ladder is the only way on or off a
  // banded floor, which is what keeps every gate readable at one door.
  // Floor 0: off the ladder, closed behind the player by a one-way gate.
  ascent_f0_area: { id: 'ascent_f0_area', name: 'The Holding Level', regionId: 'holding_level', scene: 'hall' },
  ascent_f1_area: { id: 'ascent_f1_area', name: 'The Flooded Offices', regionId: 'the_ascent', scene: 'hall' },
  ascent_f2_area: { id: 'ascent_f2_area', name: 'The Long Hall', regionId: 'the_ascent', scene: 'hall' },
  ascent_f3_area: { id: 'ascent_f3_area', name: 'The Descent', regionId: 'the_ascent', scene: 'hall' },
  // Band 2 (bands-2-3.md). No forest scene exists yet; the swamp borrows the
  // cistern's and the warren the crypt's.
  ascent_f4_area: { id: 'ascent_f4_area', name: 'The Greenwood', regionId: 'the_ascent' },
  ascent_f5_area: { id: 'ascent_f5_area', name: 'The Mire', regionId: 'the_ascent', scene: 'cistern' },
  ascent_f6_area: { id: 'ascent_f6_area', name: 'The Warren', regionId: 'the_ascent', scene: 'crypt' },
  // Band 3, the City (bands-2-3.md), a skeleton. The castle is the band's hub:
  // no floor claims its area, and the ladder answers there (BandDef.hub).
  ascent_castle_area: { id: 'ascent_castle_area', name: 'The Castle', regionId: 'the_ascent', scene: 'hall' },
  ascent_f7_area: { id: 'ascent_f7_area', name: 'The South Ward', regionId: 'the_ascent' },
  ascent_f8_area: { id: 'ascent_f8_area', name: 'The West Ward', regionId: 'the_ascent' },
  ascent_f9_area: { id: 'ascent_f9_area', name: 'The North Ward', regionId: 'the_ascent', scene: 'crypt' },
  ascent_f10_area: { id: 'ascent_f10_area', name: 'The East Ward', regionId: 'the_ascent', scene: 'hall' },
  // Floor 11 (FLOOR_IDEAS.md §1.5): the stronghold road, a placeholder name.
  ascent_f11_area: { id: 'ascent_f11_area', name: 'The Stronghold Road', regionId: 'the_ascent', scene: 'hall' },
  // ==== HARBOR: areas (skeleton 2026-10-30; the harbor builder's section) ====
  // Band 4's sea floors (FLOOR_IDEAS.md idea 3). No ship scene exists yet.
  ascent_f12_area: { id: 'ascent_f12_area', name: 'The Crossings', regionId: 'the_ascent' },
  ascent_f13_area: { id: 'ascent_f13_area', name: 'The Blockade', regionId: 'the_ascent' },
  ascent_f14_area: { id: 'ascent_f14_area', name: 'The Final Mission', regionId: 'the_ascent' },
  // ==== FESTIVAL: areas (skeleton 2026-10-30; the festival builder's section) ====
  ascent_f15_area: { id: 'ascent_f15_area', name: 'The Dark Room and the Hall', regionId: 'the_ascent', scene: 'hall' },
  ascent_f16_area: { id: 'ascent_f16_area', name: 'The Royale Field', regionId: 'the_ascent', scene: 'hall' },
  // ==== ABERRANT: areas (skeleton 2026-10-30; the aberrant builder's section) ====
  ascent_f17_area: { id: 'ascent_f17_area', name: 'Floor 17 (placeholder)', regionId: 'the_ascent' },
  // ==== DESERT: areas (skeleton 2026-10-30; the desert builder's section) ====
  // Heat trains heat_resistance through place tags only: the Ascent region is
  // sheltered, and open sky with a per-area climate pin is not built here
  // (FLOOR_IDEAS §4, "It waits on"). Floor 18 is all open road.
  ascent_f18_area: { id: 'ascent_f18_area', name: 'The Necropolis Road', regionId: 'the_ascent', tags: ['heat'] },
  ascent_f19_area: { id: 'ascent_f19_area', name: 'The Pyramid', regionId: 'the_ascent', scene: 'crypt' },
  ascent_f20_area: { id: 'ascent_f20_area', name: 'The Delta Port', regionId: 'the_ascent' },
};

/**
 * The world. Connections are declared on the source spot; unless marked
 * oneWay, the registry adds the reverse edge automatically. A one-way edge
 * that is also `hidden` stays invisible until the spot is explored — the
 * long way round is the way back.
 *
 * The countryside outside Threshold (Oakrest, the Westlands, the Malgeri
 * ranges, the swamps) was SHELVED on 2026-09-12: shelved/locations.shelved.ts
 * holds it verbatim and docs/LONGTERM.md holds the why.
 */
export const SPOTS = prose<SpotDef>('SPOTS', SPOTS_TEXT, {
  base_entrance: {
    id: 'base_entrance',
    name: 'Player Base Entrance',
    icon: '🚪',
    areaId: 'player_base_v1_area',
    map: { x: 48, y: 68 },
    // Not a caravan stop: the door is on floor 11 now, and a save that rode
    // here before the move would ride in without the stronghold.
    activities: [],
    connections: [
      { to: 'base_main_hall', ticks: 60 },
      // The door is on floor 11 (FLOOR_IDEAS.md §5.3 item 9). The way back
      // there needs the stronghold; the way out to the Foot is free and
      // one-way, so a save already inside is never stranded and nobody
      // walks in from the Foot.
      {
        to: 'f11_gatehouse',
        ticks: 60,
        oneWay: true,
        label: 'out to the gatehouse',
        requires: [{ type: 'stat', key: 'legacy:stronghold', value: 1 }],
      },
      { to: 'ascent_foot', ticks: 90, oneWay: true, label: 'out to the Foot' },
    ],
  },
  base_equipment_depot: {
    id: 'base_equipment_depot',
    name: 'Equipment Depot',
    icon: '🎒',
    areaId: 'player_base_v1_area',
    map: { x: 30, y: 52.5 },
    activities: [],
    connections: [
      { to: 'base_main_hall', ticks: 75 },
      { to: 'base_training_area', ticks: 40 },
    ],
  },
  base_main_hall: {
    id: 'base_main_hall',
    name: 'Player Base Main Hall',
    icon: '🏛️',
    areaId: 'player_base_v1_area',
    map: { x: 48, y: 40 },
    activities: [],
    connections: [
      { to: 'base_research_hallway', ticks: 60 },
      { to: 'base_trophy_hallway', ticks: 60 },
    ],
  },
  base_trophy_hallway: {
    id: 'base_trophy_hallway',
    name: 'Trophy Hallway',
    icon: '🏆',
    areaId: 'player_base_v1_area',
    map: { x: 48, y: 27 },
    activities: [],
    connections: [
      { to: 'base_throneroom', ticks: 40 },
    ],
  },
  base_arcane_library: {
    id: 'base_arcane_library',
    name: 'Arcane Library',
    icon: '📚',
    areaId: 'player_base_v1_area',
    map: { x: 75, y: 26 },
    activities: [
      { id: 'study_stacks', kind: 'train', attr: 'int', name: 'Study the Stacks', icon: '📖' },
    ],
    // The proper spellcrafting table — the base's copy of the one at my_home.
    benches: ['spelltable'],
    connections: [
      { to: 'base_research_hallway', ticks: 60 },
      { to: 'base_psionics_lab', ticks: 60 },
      { to: 'base_library_annex', ticks: 30 },
    ],
  },
  base_research_hallway: {
    id: 'base_research_hallway',
    name: 'Research Hallway',
    icon: '🧪',
    areaId: 'player_base_v1_area',
    map: { x: 75, y: 40 },
    activities: [],
    connections: [
      { to: 'base_alchemy_lab', ticks: 60 },
      { to: 'base_mutagen_lab', ticks: 60 },
      { to: 'base_psionics_lab', ticks: 85 },
    ],
  },
  base_alchemy_lab: {
    id: 'base_alchemy_lab',
    name: 'Alchemy Lab',
    icon: '⚗️',
    areaId: 'player_base_v1_area',
    map: { x: 75, y: 60 },
    activities: [
      { id: 'train_skill', kind: 'train', attr: 'int', name: 'Study Alchemical ', icon: '🛠️', tags: ['alchemy'], attrXp: { str: 0, dex: 0, con: 0, int: 0.33, wis: 0, cha: 0 } },
    ],
    benches: ['alchemy'],
    connections: [
      { to: 'base_clone_vats', ticks: 60 },
    ],
  },
  base_mutagen_lab: {
    id: 'base_mutagen_lab',
    name: 'Mutagen Lab',
    icon: '🧬',
    areaId: 'player_base_v1_area',
    map: { x: 90, y: 46.5 },
    activities: [],
    // Same culture bench as the basement — the lab is where the work moves
    // once the base exists; the basement keeps its copy for the slimes.
    benches: ['mutagens'],
    connections: [
      { to: 'base_psionics_lab', ticks: 60 },
      { to: 'base_clone_vats', ticks: 60 },
    ],
  },
  base_clone_vats: {
    id: 'base_clone_vats',
    name: 'Clone Vats',
    icon: '🧫',
    areaId: 'player_base_v1_area',
    map: { x: 90, y: 60 },
    activities: [],
    connections: [],
  },
  base_psionics_lab: {
    id: 'base_psionics_lab',
    name: 'Psionics Lab',
    icon: '🧠',
    areaId: 'player_base_v1_area',
    map: { x: 90, y: 32 },
    activities: [
      { id: 'meditate_will', kind: 'train', attr: 'cha', name: 'Meditate on the Will', icon: '🧘' },
    ],
    connections: [],
  },
  base_dining_hall: {
    id: 'base_dining_hall',
    name: 'Dining Hall',
    icon: '🍽️',
    areaId: 'player_base_v1_area',
    map: { x: 30, y: 40 },
    activities: [],
    connections: [
      { to: 'base_main_hall', ticks: 60 },
      { to: 'base_staff_quarters', ticks: 85 },
      { to: 'base_equipment_depot', ticks: 60 },
    ],
  },
  base_chapel: {
    id: 'base_chapel',
    name: 'Chapel',
    icon: '⛪',
    areaId: 'player_base_v1_area',
    map: { x: 34.5, y: 7 },
    activities: [
      { id: 'keep_vigil', kind: 'train', attr: 'wis', name: 'Keep a Vigil', icon: '🕯️' },
    ],
    connections: [
      { to: 'base_chapel_annex', ticks: 30 },
    ],
  },
  base_farm: {
    id: 'base_farm',
    name: 'Farm',
    icon: '🌾',
    areaId: 'player_base_v1_area',
    map: { x: 10, y: 20 },
    activities: [
      {
        id: 'tend_rows',
        kind: 'gather',
        material: 'wild_onion',
        ticksPer: 120,
        name: 'Tend the Vegetable Rows',
        icon: '🧅',
        tags: ['herbalism'],
        speedFactors: [
          { attr: 'wis', weight: 0.008 },
          { skill: 'herbalism', weight: 0.01 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
      {
        id: 'keep_henhouse',
        kind: 'gather',
        material: 'bird_egg',
        ticksPer: 160,
        name: 'Keep the Henhouse',
        icon: '🥚',
        speedFactors: [{ attr: 'wis', weight: 0.008 }],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
      {
        id: 'cut_herb_beds',
        kind: 'gather',
        material: 'common_herb',
        ticksPer: 140,
        name: 'Cut the Herb Beds',
        icon: '🌿',
        tags: ['herbalism'],
        speedFactors: [
          { attr: 'wis', weight: 0.008 },
          { skill: 'herbalism', weight: 0.01 },
        ],
        outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
        outputCap: 2,
      },
    ],
    connections: [
      { to: 'base_dining_hall', ticks: 85 },
      { to: 'base_pantry', ticks: 60 },
    ],
  },
  base_kitchen: {
    id: 'base_kitchen',
    name: 'Kitchen',
    icon: '🍳',
    areaId: 'player_base_v1_area',
    map: { x: 15, y: 40 },
    activities: [],
    // The whole cooking line — the base's working copies of the my_home set.
    benches: [
      'preparing',
      'assembling',
      'cooking',
      'baking',
      'grilling',
    ],
    connections: [
      { to: 'base_dining_hall', ticks: 45 },
      { to: 'base_farm', ticks: 60 },
      { to: 'base_staff_quarters', ticks: 60 },
    ],
  },
  base_staff_quarters: {
    id: 'base_staff_quarters',
    name: 'Staff Quarters',
    icon: '🛖',
    areaId: 'player_base_v1_area',
    map: { x: 9.5, y: 52.5 },
    activities: [],
    connections: [
      { to: 'base_equipment_depot', ticks: 65 },
      { to: 'base_infirmary', ticks: 40 },
    ],
  },
  base_chapel_annex: {
    id: 'base_chapel_annex',
    name: 'Chapel Annex',
    icon: '🕯️',
    areaId: 'player_base_v1_area',
    map: { x: 22.5, y: 10 },
    activities: [],
    connections: [],
  },
  base_bedroom: {
    id: 'base_bedroom',
    name: 'Player Bedroom',
    icon: '🛏️',
    areaId: 'player_base_v1_area',
    map: { x: 60, y: 5 },
    activities: [
      { id: 'sleep_own_bed', kind: 'rest', name: 'Sleep in Your Own Bed', icon: '🛏️' },
    ],
    connections: [
      { to: 'base_library_annex', ticks: 35 },
    ],
  },
  base_throneroom: {
    id: 'base_throneroom',
    name: 'Throneroom',
    icon: '👑',
    areaId: 'player_base_v1_area',
    map: { x: 48, y: 14 },
    activities: [
      { id: 'hold_court', kind: 'train', attr: 'cha', name: 'Hold Court', icon: '👑' },
    ],
    connections: [
      { to: 'base_bedroom', ticks: 30 },
      { to: 'base_chapel', ticks: 30, label: 'To the Chapel', returnLabel: 'To the Throneroom' },
      { to: 'base_library_annex', ticks: 60 },
    ],
  },
  base_strategy_room: {
    id: 'base_strategy_room',
    name: 'Strategy Room',
    icon: '🗺️',
    areaId: 'player_base_v1_area',
    map: { x: 60.5, y: 23.5 },
    activities: [
      { id: 'draw_campaigns', kind: 'train', attr: 'int', name: 'Draw Up Campaigns', icon: '🗺️' },
    ],
    connections: [
      { to: 'base_throneroom', ticks: 70 },
      { to: 'base_main_hall', ticks: 70 },
    ],
  },
  base_pantry: {
    id: 'base_pantry',
    name: 'Pantry',
    icon: '🫙',
    areaId: 'player_base_v1_area',
    map: { x: 5.5, y: 40 },
    activities: [],
    connections: [
      { to: 'base_kitchen', ticks: 30 },
    ],
  },
  base_library_annex: {
    id: 'base_library_annex',
    name: 'Library Annex',
    icon: '📖',
    areaId: 'player_base_v1_area',
    map: { x: 70, y: 14 },
    activities: [
      { id: 'annotate_margins', kind: 'train', attr: 'wis', name: 'Annotate the Margins', icon: '✒️' },
    ],
    connections: [],
  },
  base_training_area: {
    id: 'base_training_area',
    name: 'Training Area',
    icon: '🎯',
    areaId: 'player_base_v1_area',
    map: { x: 30, y: 64 },
    activities: [
      { id: 'drill_forms', kind: 'train', attr: 'str', name: 'Drill Forms', icon: '🤺', tags: ['combat'] },
      { id: 'hunt', kind: 'hunt', name: 'Work the Dummies', icon: '🎯' },
    ],
    // Same rule as the village yard: dummies never roll a modifier, so the
    // numbers you measure here are the numbers you measured last time.
    encounters: [{ monsterId: 'training_dummy', weight: 100, level: [1, 1] }],
    modifierWeights: { normal: 100 },
    connections: [],
  },
  base_infirmary: {
    id: 'base_infirmary',
    name: 'Infirmary',
    icon: '🩹',
    areaId: 'player_base_v1_area',
    map: { x: 15.5, y: 64 },
    activities: [
      { id: 'convalesce', kind: 'rest', name: 'Convalesce', icon: '🛌' },
    ],
    connections: [
      { to: 'base_equipment_depot', ticks: 55 },
      { to: 'base_training_area', ticks: 45 },
    ],
  },
  base_workshop: {
    id: 'base_workshop',
    name: 'Workshop',
    icon: '🛠️',
    areaId: 'player_base_v1_area',
    map: { x: 62, y: 50.5 },
    activities: [],
    benches: ['runecarving'],
    connections: [
      { to: 'base_material_storage', ticks: 35 },
      { to: 'base_research_hallway', ticks: 50 },
    ],
  },
  base_material_storage: {
    id: 'base_material_storage',
    name: 'Material Storage',
    icon: '📦',
    areaId: 'player_base_v1_area',
    map: { x: 62, y: 62.5 },
    activities: [],
    connections: [],
  },

  // ---------- Threshold ----------
  //
  // Eight districts in a ring, each with its own road to the tower's foot at
  // the centre, and each joined to its two neighbours so the city is walkable
  // without routing through the door every time. The eight roads are the
  // point: the stack has one mouth, so the 'every spot can get home' lint is
  // satisfied by construction, and no district can become the only way in.
  //
  // District subsystems are SIGNATURES, never monopolies. The Ironyard is
  // where martial training is best supported; it is not the only place a
  // blade is welcome, and nothing on a critical path may ever require a
  // particular district.

  ascent_foot: {
    id: 'ascent_foot',
    name: 'The Foot of the Ascent',
    icon: '🗼',
    areaId: 'ascent_foot_area',
    map: { x: 50, y: 37.5 },
    waypoint: true,
    // The hub is the haven: resting here is what makes the whole city the
    // place a lost fight returns you to.
    activities: [
      { id: 'rest_foot', kind: 'rest', name: 'Rest at the Doorstep Inn', icon: '🛏️' },
    ],
    // The hold's door moved to floor 11 (FLOOR_IDEAS.md §5.3 item 9); the
    // hold keeps a one-way way out to here.
    connections: [],
  },

  // --- Scholars' Quarter (signature: arcane) ---
  lectory_steps: {
    id: 'lectory_steps',
    name: 'The Lectory Steps',
    icon: '📐',
    areaId: 'scholars_quarter',
    map: { x: 50, y: 17.5 },
    activities: [
      { id: 'train_int_steps', kind: 'train', attr: 'int', name: 'Argue on the Steps', icon: '💬' },
    ],
    connections: [
      { to: 'ascent_foot', ticks: 12, label: 'the Scholars’ Road' },
      { to: 'temple_rise_gate', ticks: 18 },
      { to: 'the_reading_hall', ticks: 8 },
      { to: 'chalk_yard', ticks: 8 },
    ],
  },
  the_reading_hall: {
    id: 'the_reading_hall',
    name: 'The Reading Hall',
    icon: '📖',
    areaId: 'scholars_quarter',
    map: { x: 38, y: 6 },
    tags: ['indoor'],
    activities: [
      // The hall's rare find (ActivityDef.drops): the one recipe no counter
      // sells. 0.0008 per rep is about 1 in 1,250, drought-protected.
      { id: 'train_int_hall', kind: 'train', attr: 'int', name: 'Read Until It Sticks', icon: '📚',
        drops: [{ material: 'recipe_lectory_porridge', chance: 0.0008 }] },
      { id: 'train_wis_hall', kind: 'train', attr: 'wis', name: 'Sit With a Hard Passage', icon: '🧘', tags: ['magic'] },
    ],
    benches: ['spelltable'],
    connections: [],
  },
  chalk_yard: {
    id: 'chalk_yard',
    name: 'The Chalk Yard',
    icon: '🔠',
    areaId: 'scholars_quarter',
    map: { x: 62, y: 5 },
    exploreTicks: 420,
    activities: [
      { id: 'explore_chalk', kind: 'explore', name: 'Read the Old Working', icon: '🔍' },
      // Scholars' find (arcane): a slip with a word the lexicon locks.
      { id: 'train_int_chalk', kind: 'train', attr: 'int', name: 'Copy Out a Proof', icon: '✏️',
        drops: [{ material: 'word_slip_stone', chance: 0.0008 }] },
    ],
    // PLACEHOLDER find (floor standard: every explore pays something). Gold,
    // not skill XP: the only arcane skill unlocks at INT 10, and a find that
    // pays nothing to a new player is no find.
    finds: [{ id: 'chalk_yard_purse', at: 0.6, gold: [10, 15] }],
    connections: [],
  },

  // --- Temple Rise (signature: divine) ---
  temple_rise_gate: {
    id: 'temple_rise_gate',
    name: "Pilgrims' Stair",
    icon: '🪜',
    areaId: 'temple_rise',
    map: { x: 68.4, y: 23.4 },
    activities: [
      { id: 'train_con_stair', kind: 'train', attr: 'con', name: 'Walk the Stair', icon: '🚶' },
    ],
    connections: [
      { to: 'ascent_foot', ticks: 12, label: 'the Pilgrim Way' },
      { to: 'ironyard_gate', ticks: 18 },
      { to: 'the_nine_chapels', ticks: 8 },
      { to: 'censer_walk', ticks: 8 },
    ],
  },
  the_nine_chapels: {
    id: 'the_nine_chapels',
    name: 'The Nine Chapels',
    icon: '⛪',
    areaId: 'temple_rise',
    map: { x: 80, y: 10 },
    tags: ['indoor'],
    activities: [
      // Temple's find (divine): votive tokens, each twice as rare as the last.
      { id: 'train_wis_chapels', kind: 'train', attr: 'wis', name: 'Keep a Vigil', icon: '🕯️', tags: ['magic'],
        drops: [{ material: 'votive_token', chance: 0.0008, rarer: 2 }] },
    ],
    // A Taste of Everything, the prior and this spot's own text all send
    // the player here to learn a miracle; the table's Divine tab is where
    // miracles are bought. Same furniture as the Reading Hall's.
    benches: ['spelltable'],
    connections: [],
  },
  censer_walk: {
    id: 'censer_walk',
    name: 'Censer Walk',
    icon: '🪔',
    areaId: 'temple_rise',
    map: { x: 90, y: 20 },
    activities: [
      { id: 'train_cha_censer', kind: 'train', attr: 'cha', name: 'Work the Colonnade', icon: '🎭' },
    ],
    connections: [],
  },

  // --- The Ironyard (signature: martial; wuxia once it lands) ---
  ironyard_gate: {
    id: 'ironyard_gate',
    name: 'The Muster Gate',
    icon: '🛡️',
    areaId: 'the_ironyard',
    map: { x: 76, y: 37.5 },
    activities: [
      { id: 'train_str_muster', kind: 'train', attr: 'str', name: 'Drill in Formation', icon: '🪖' },
    ],
    connections: [
      { to: 'ascent_foot', ticks: 12, label: 'the Muster Road' },
      { to: 'alembic_row_gate', ticks: 18 },
      { to: 'the_sand', ticks: 8 },
      { to: 'long_gallery', ticks: 8 },
      { to: 'the_cages', ticks: 8 },
    ],
  },
  the_cages: {
    id: 'the_cages',
    name: 'The Cages',
    icon: '🪤',
    areaId: 'the_ironyard',
    map: { x: 84, y: 18 },
    // A menagerie (SpotDef.caged): staged one-at-a-time fights, no rolled
    // champions, and every bestiary fact lands exactly at its minKills.
    caged: true,
    // The keeper looks after beginners (systems/training.ts): healed after
    // every win while the six attributes total 30 or less, and dared to take
    // on the Suspiciously Large Slime every 8 wins until it is beaten.
    // Level 16 measured at the first offer with the bred (neutral) slime, 24
    // seeds per tutorial pick: every pick wins 9-12 of 24.
    healBetweenBouts: { maxAttrTotal: 30 },
    dare: { monsterId: 'suspiciously_large_slime', level: 16, every: 8 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Step Into a Cage', icon: '🪤' }],
    encounters: [
      { monsterId: 'forest_rat', weight: 40, level: [1, 2] },
      { monsterId: 'cage_slime', weight: 40, level: [1, 2] },
      { monsterId: 'goblin', weight: 20, level: [2, 3] },
    ],
    modifierWeights: { normal: 100 },
    groupWeights: { 1: 100 },
    connections: [],
  },
  the_sand: {
    id: 'the_sand',
    name: 'The Sand',
    icon: '🤺',
    areaId: 'the_ironyard',
    map: { x: 93, y: 28 },
    activities: [
      { id: 'train_dex_sand', kind: 'train', attr: 'dex', name: 'Footwork on the Sand', icon: '👣' },
      // Ironyard's find (martial): a drill manual, the stand-in for a teacher.
      { id: 'spar_sand', kind: 'train', attr: 'str', name: 'Spar', icon: '⚔️', tags: ['combat'],
        drops: [{ material: 'drill_manual_riposte', chance: 0.0008 }] },
    ],
    connections: [],
  },
  long_gallery: {
    id: 'long_gallery',
    name: 'The Long Gallery',
    icon: '🏹',
    areaId: 'the_ironyard',
    map: { x: 93, y: 47 },
    tags: ['indoor'],
    activities: [
      { id: 'train_dex_gallery', kind: 'train', attr: 'dex', name: 'Shoot the Long Butts', icon: '🎯' },
      { id: 'train_con_gallery', kind: 'train', attr: 'con', name: 'Draw Until It Hurts', icon: '💪' },
    ],
    connections: [],
  },

  // --- Alembic Row (signature: alchemy, mutagens) ---
  alembic_row_gate: {
    id: 'alembic_row_gate',
    name: 'The Retort Gate',
    icon: '⚗️',
    areaId: 'alembic_row',
    map: { x: 68.4, y: 51.6 },
    activities: [],
    connections: [
      { to: 'ascent_foot', ticks: 12, label: 'the Retort Road' },
      { to: 'chancery_arch', ticks: 18 },
      { to: 'the_alembics', ticks: 8 },
      { to: 'the_vivarium', ticks: 8 },
    ],
  },
  the_alembics: {
    id: 'the_alembics',
    name: 'The Alembics',
    icon: '🧪',
    areaId: 'alembic_row',
    map: { x: 90, y: 55 },
    tags: ['indoor', 'heat'],
    // Alembic Row's find (alchemy) needs a cycle to roll on; the district had
    // none, so the Alembics get a job. Emberbloom is not on the shelf.
    activities: [
      { id: 'job_retorts', kind: 'job', gold: 11, ticksPer: 210, name: 'Wash Out the Retorts', icon: '🧽',
        drops: [{ material: 'emberbloom', chance: 0.00875, qty: 3 }] },
    ],
    benches: ['alchemy', 'preparing'],
    connections: [],
  },
  the_vivarium: {
    id: 'the_vivarium',
    name: 'The Vivarium',
    icon: '🧫',
    areaId: 'alembic_row',
    map: { x: 80, y: 65 },
    tags: ['indoor'],
    activities: [],
    benches: ['mutagens'],
    connections: [],
  },

  // --- The Chancery (signature: administrative) ---
  chancery_arch: {
    id: 'chancery_arch',
    name: 'The Chancery Arch',
    icon: '🏛️',
    areaId: 'the_chancery',
    map: { x: 50, y: 57.5 },
    activities: [],
    connections: [
      { to: 'ascent_foot', ticks: 12, label: 'the Chancery Road' },
      { to: 'assize_gate', ticks: 18 },
      { to: 'the_rolls', ticks: 8 },
      { to: 'seal_room', ticks: 8 },
    ],
  },
  the_rolls: {
    id: 'the_rolls',
    name: 'The Rolls',
    icon: '📜',
    areaId: 'the_chancery',
    map: { x: 62, y: 70 },
    tags: ['indoor'],
    activities: [
      // Chancery's find (administrative): a standing discount at every counter.
      { id: 'job_copying', kind: 'job', gold: 12, ticksPer: 220, name: 'Copy Out Writs', icon: '🖋️', staticTime: true,
        drops: [{ material: 'chancery_price_seal', chance: 0.0092 }] },
      { id: 'train_int_rolls', kind: 'train', attr: 'int', name: 'Read the Indexes', icon: '🗂️' },
    ],
    connections: [],
  },
  seal_room: {
    id: 'seal_room',
    name: 'The Seal Room',
    icon: '🔏',
    areaId: 'the_chancery',
    map: { x: 38, y: 70 },
    tags: ['indoor'],
    activities: [
      { id: 'train_wis_seals', kind: 'train', attr: 'wis', name: 'Learn Which Stamp', icon: '🧠' },
    ],
    connections: [],
  },

  // --- The Assize (signature: law) ---
  assize_gate: {
    id: 'assize_gate',
    name: 'The Assize Gate',
    icon: '⚖️',
    areaId: 'the_assize',
    map: { x: 31.6, y: 51.6 },
    activities: [
      { id: 'train_cha_assize', kind: 'train', attr: 'cha', name: 'Watch a Case Argued', icon: '👂' },
    ],
    connections: [
      { to: 'ascent_foot', ticks: 12, label: 'the Assize Road' },
      { to: 'wrights_gate', ticks: 18 },
      { to: 'the_high_bench', ticks: 8 },
      { to: 'the_holding', ticks: 8 },
    ],
  },
  the_high_bench: {
    id: 'the_high_bench',
    name: 'The High Bench',
    icon: '🪑',
    areaId: 'the_assize',
    map: { x: 20, y: 65 },
    tags: ['indoor'],
    activities: [
      { id: 'train_cha_bench', kind: 'train', attr: 'cha', name: 'Plead a Small Matter', icon: '🗣️' },
      { id: 'train_wis_bench', kind: 'train', attr: 'wis', name: 'Weigh Both Sides', icon: '⚖️' },
    ],
    connections: [],
  },
  the_holding: {
    id: 'the_holding',
    name: 'The Holding',
    icon: '🔒',
    areaId: 'the_assize',
    map: { x: 10, y: 55 },
    tags: ['indoor'],
    activities: [
      // Assize's find (law): a case file that earns a hidden title.
      { id: 'job_watch', kind: 'job', gold: 14, ticksPer: 260, name: 'Stand the Night Watch', icon: '🌙', staticTime: true,
        drops: [{ material: 'unclaimed_case_file', chance: 0.0108 }] },
    ],
    connections: [],
  },

  // --- Wrights' Ward (signature: crafting) ---
  wrights_gate: {
    id: 'wrights_gate',
    name: "The Wrights' Gate",
    icon: '⚒️',
    areaId: 'wrights_ward',
    map: { x: 24, y: 37.5 },
    activities: [],
    connections: [
      { to: 'ascent_foot', ticks: 12, label: 'the Wrights’ Road' },
      { to: 'granary_gate', ticks: 18 },
      { to: 'the_forges', ticks: 8 },
      { to: 'the_long_bench', ticks: 8 },
    ],
  },
  the_forges: {
    id: 'the_forges',
    name: 'The Forges',
    icon: '🔥',
    areaId: 'wrights_ward',
    map: { x: 7, y: 47 },
    tags: ['heat'],
    activities: [
      // Wrights' find (crafting): the pattern that opens the bronze line.
      { id: 'job_bellows_threshold', kind: 'job', gold: 14, ticksPer: 250, name: 'Work the Bellows', icon: '🔥',
        drops: [{ material: 'smiths_pattern_bronze', chance: 0.0104 }] },
      { id: 'train_str_forges', kind: 'train', attr: 'str', name: 'Swing the Sledge', icon: '🔨', tags: ['blunt'] },
    ],
    // The city's smithing counter: the same starter recipes the hamlet forge
    // teaches, because the Warden's iron has to become something somewhere.
    // The bronze line is SECRET (RecipeDef.secret): listed only once the
    // Smith's Pattern found working the bellows has been studied.
    // The last five had a recipe and no counter to craft it at.
    recipes: ['iron_ingot', 'iron_dagger', 'iron_sword', 'copper_ingot', 'tin_ingot', 'bronze_ingot', 'bronze_dagger', 'rapier', 'parrying_dagger', 'katana', 'uchigatana', 'iron_breastplate'],
    // The anvil. This was `assembling`, which is cooking's Cold Counter and had
    // stood in the smithy since the prototype import.
    benches: ['forging'],
    connections: [],
  },
  the_long_bench: {
    id: 'the_long_bench',
    name: 'The Long Bench',
    icon: '🔣',
    areaId: 'wrights_ward',
    map: { x: 7, y: 31 },
    tags: ['indoor'],
    activities: [],
    benches: ['runecarving'],
    connections: [],
  },

  // --- The Granaries (signature: resources & logistics) ---
  granary_gate: {
    id: 'granary_gate',
    name: 'The Granary Gate',
    icon: '🌾',
    areaId: 'the_granaries',
    map: { x: 31.6, y: 23.4 },
    activities: [],
    connections: [
      { to: 'ascent_foot', ticks: 12, label: 'the Granary Road' },
      { to: 'lectory_steps', ticks: 18 },
      { to: 'the_weighbridge', ticks: 8 },
      { to: 'the_undercrofts', ticks: 8 },
      { to: 'granary_kitchens', ticks: 8 },
    ],
  },
  granary_kitchens: {
    id: 'granary_kitchens',
    name: 'The Granary Kitchens',
    icon: '🍲',
    areaId: 'the_granaries',
    map: { x: 30, y: 8 },
    tags: ['indoor', 'heat'],
    activities: [
      // Granaries' find (resources): a good pot for the stove's tool slot.
      { id: 'job_pans', kind: 'job', gold: 10, ticksPer: 200, name: 'Scrub the Pans', icon: '🍳',
        drops: [{ material: 'iron_pot', chance: 0.0083, quality: 'b', unique: true }] },
    ],
    benches: ['cooking', 'preparing'],
    connections: [],
  },
  the_weighbridge: {
    id: 'the_weighbridge',
    name: 'The Weighbridge',
    icon: '⚓',
    areaId: 'the_granaries',
    map: { x: 10, y: 20 },
    activities: [
      { id: 'job_hauling', kind: 'job', gold: 11, ticksPer: 180, name: 'Haul and Stack', icon: '📦' },
      { id: 'train_str_haul', kind: 'train', attr: 'str', name: 'Shift the Heavy Lots', icon: '🪨' },
    ],
    // The Hamlet Road out of the city went to the shelf with the countryside
    // it led to (shelved/locations.shelved.ts, `SHELVED_ROADS`). The
    // logistics district stays the honest place for Threshold's land link
    // when the world outside is written again.
    connections: [],
  },
  the_undercrofts: {
    id: 'the_undercrofts',
    name: 'The Undercrofts',
    icon: '🪵',
    areaId: 'the_granaries',
    map: { x: 20, y: 10 },
    tags: ['indoor'],
    exploreTicks: 520,
    activities: [
      { id: 'explore_undercrofts', kind: 'explore', name: 'Go Through the Back Stores', icon: '🔍' },
      { id: 'train_con_undercrofts', kind: 'train', attr: 'con', name: 'Shift Barrels All Day', icon: '🛢️' },
    ],
    // PLACEHOLDER find (floor standard: every explore pays something). Rough
    // Flour is on the Granary Kitchens' shelf (head_chef).
    finds: [{ id: 'undercroft_flour_sack', at: 0.5, material: { id: 'rough_flour', qty: 3 } }],
    connections: [],
  },

  // ---------- The Ascent: band 1 ----------
  //
  // The flooded first floor has three sections; later floors retain their
  // landing / working spot / den structure. No edge leaves a floor's area:
  // the ladder is the only door, enforced by both validation layers.

  // --- Floor 1: flooded halls, records search, then the office sequence. ---
  f1_landing: {
    id: "f1_landing",
    name: "The Flooded Landing",
    icon: "🪜",
    areaId: "ascent_f1_area",
    map: {"x": 10, "y": 68},
    tags: ["indoor"],
    activities: [
      {"id": "camp_f1", "kind": "rest", "name": "Camp Above the Water", "icon": "🏕️"},
    ],
    connections: [
      {"to": "f1_storerooms", "ticks": 25, "oneWay": true},
    ],
  },
  f1_storerooms: {
    id: "f1_storerooms",
    name: "The Vermin Hall",
    icon: "🐀",
    areaId: "ascent_f1_area",
    map: {"x": 10, "y": 49},
    tags: ["indoor"],
    activities: [
      {"id": "hunt", "kind": "hunt", "name": "Drive Out the Vermin", "icon": "⚔️"},
    ],
    connections: [
      {"to": "f1_landing", "ticks": 25, "oneWay": true},
      {"to": "f1_bonded_deep", "revealWhen": [{"type": "stat", "key": "fights:f1_storerooms", "value": 6}], "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "fights:f1_storerooms", "value": 6}], "label": "Follow the Fleeing Vermin"},
    ],
    fightLimit: 6,
    groupWeights: {"1": 100},
    modifierWeights: {"normal": 100},
    // The first real fights after the tutorial. Rats only for four wins, so a
    // fresh character grows a little before it meets something that shrugs
    // off a blade: a basic slime resists slashing and piercing by half, and
    // walked into hurt it beat a rusty sword or a dagger about one run in three.
    // (Skip tutorial starts this hall at level-1 attributes and can still be
    // worn down by the rats alone; one knockout, then he walks back stronger.)
    encounters: [
      {"monsterId": "forest_rat", "weight": 75, "level": [1, 2]},
      {"monsterId": "slime_base_basic", "weight": 25, "level": [1, 1], "requires": [{"type": "stat", "key": "fights:f1_storerooms", "value": 4}]},
    ],
  },
  f1_bonded_deep: {
    id: "f1_bonded_deep",
    name: "The Records Passage",
    icon: "📚",
    areaId: "ascent_f1_area",
    map: {"x": 10, "y": 30},
    tags: ["indoor"],
    activities: [],
    connections: [
      {"to": "f1_storerooms", "ticks": 25, "oneWay": true},
      {"to": "f1_archive", "ticks": 25, "oneWay": true},
      {"to": "f1_lockers", "ticks": 25, "oneWay": true},
      {"to": "f1_forms", "ticks": 25, "oneWay": true},
    ],
  },
  f1_archive: {
    id: "f1_archive",
    name: "The Archive",
    icon: "🔎",
    areaId: "ascent_f1_area",
    map: {"x": 29, "y": 19},
    tags: ["indoor"],
    activities: [
      {"id": "search", "kind": "search", "name": "Search the Shelves", "icon": "🔎", "ticksPer": 50, "rewards": [{"id": "salvage", "weight": 65, "material": {"id": "common_herb", "qty": 1}}, {"id": "coins", "weight": 35, "gold": [3, 8]}, {"id": "daybook", "weight": 25, "limit": 1, "guaranteedBy": 4, "keyItem": "toll_clerk_book"}]},
    ],
    connections: [
      {"to": "f1_bonded_deep", "ticks": 25, "oneWay": true},
    ],
  },
  f1_lockers: {
    id: "f1_lockers",
    name: "Staff Lockers",
    icon: "🔎",
    areaId: "ascent_f1_area",
    map: {"x": 29, "y": 34},
    tags: ["indoor"],
    activities: [
      {"id": "search", "kind": "search", "name": "Search the Room", "icon": "🔎", "ticksPer": 50, "rewards": [{"id": "salvage", "weight": 65, "material": {"id": "iron_scrap", "qty": 1}}, {"id": "coins", "weight": 35, "gold": [3, 8]}]},
    ],
    connections: [
      {"to": "f1_bonded_deep", "ticks": 25, "oneWay": true},
    ],
  },
  f1_forms: {
    id: "f1_forms",
    name: "Forms Store",
    icon: "🔎",
    areaId: "ascent_f1_area",
    map: {"x": 29, "y": 49},
    tags: ["indoor"],
    activities: [
      {"id": "search", "kind": "search", "name": "Search the Room", "icon": "🔎", "ticksPer": 50, "rewards": [{"id": "salvage", "weight": 65, "material": {"id": "iron_scrap", "qty": 1}}, {"id": "coins", "weight": 35, "gold": [3, 8]}]},
    ],
    connections: [
      {"to": "f1_bonded_deep", "ticks": 25, "oneWay": true},
      {"to": "f1_reception", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_clerk_book", "value": 1}], "label": "Enter the Office Section"},
    ],
  },
  f1_reception: {
    id: "f1_reception",
    name: "Office Reception",
    icon: "🗝️",
    areaId: "ascent_f1_area",
    map: {"x": 48, "y": 58},
    tags: ["indoor"],
    activities: [
      {"id": "explore_reception", "kind": "explore", "name": "Search Beneath the Desk", "icon": "🔍"},
    ],
    connections: [
      {"to": "f1_forms", "ticks": 25, "oneWay": true},
      {"to": "f1_scribe", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Scribe’s Office"},
      {"to": "f1_auditor", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "The Auditor"},
      {"to": "f1_break_room", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Break Room"},
      {"to": "f1_toll_hall", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Toll Collector’s Office"},
      {"to": "f1_registry", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "The Registry"},
      {"to": "f1_dispatch", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Dispatch Office"},
      {"to": "f1_records", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Records Office"},
      {"to": "f1_supplies", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Supply Office"},
    ],
    exploreTicks: 40,
    finds: [
      {"id": "office_key", "at": 1, "keyItem": "toll_office_key"},
    ],
  },
  f1_registry: {
    id: "f1_registry",
    name: "The Registry",
    icon: "🗃️",
    areaId: "ascent_f1_area",
    map: {"x": 48, "y": 18},
    tags: ["indoor"],
    activities: [],
    connections: [
      {"to": "f1_scribe", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Scribe’s Office"},
      {"to": "f1_auditor", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "The Auditor"},
      {"to": "f1_break_room", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Break Room"},
      {"to": "f1_toll_hall", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Toll Collector’s Office"},
      {"to": "f1_dispatch", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Dispatch Office"},
      {"to": "f1_records", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Records Office"},
      {"to": "f1_supplies", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Supply Office"},
      {"to": "f1_reception", "ticks": 25, "oneWay": true, "label": "Return to Reception"},
    ],
  },
  f1_scribe: {
    id: "f1_scribe",
    name: "Scribe’s Office",
    icon: "✒️",
    areaId: "ascent_f1_area",
    map: {"x": 68, "y": 18},
    tags: ["indoor"],
    activities: [],
    connections: [
      {"to": "f1_auditor", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "The Auditor"},
      {"to": "f1_break_room", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Break Room"},
      {"to": "f1_toll_hall", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Toll Collector’s Office"},
      {"to": "f1_registry", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "The Registry"},
      {"to": "f1_dispatch", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Dispatch Office"},
      {"to": "f1_records", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Records Office"},
      {"to": "f1_supplies", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Supply Office"},
      {"to": "f1_reception", "ticks": 25, "oneWay": true, "label": "Return to Reception"},
    ],
  },
  f1_auditor: {
    id: "f1_auditor",
    name: "The Auditor",
    icon: "🔍",
    areaId: "ascent_f1_area",
    map: {"x": 88, "y": 18},
    tags: ["indoor"],
    activities: [],
    connections: [
      {"to": "f1_scribe", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Scribe’s Office"},
      {"to": "f1_break_room", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Break Room"},
      {"to": "f1_toll_hall", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Toll Collector’s Office"},
      {"to": "f1_registry", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "The Registry"},
      {"to": "f1_dispatch", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Dispatch Office"},
      {"to": "f1_records", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Records Office"},
      {"to": "f1_supplies", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Supply Office"},
      {"to": "f1_reception", "ticks": 25, "oneWay": true, "label": "Return to Reception"},
    ],
  },
  f1_break_room: {
    id: "f1_break_room",
    name: "Break Room",
    icon: "🍎",
    areaId: "ascent_f1_area",
    map: {"x": 48, "y": 38},
    tags: ["indoor"],
    activities: [],
    connections: [
      {"to": "f1_scribe", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Scribe’s Office"},
      {"to": "f1_auditor", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "The Auditor"},
      {"to": "f1_toll_hall", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Toll Collector’s Office"},
      {"to": "f1_registry", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "The Registry"},
      {"to": "f1_dispatch", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Dispatch Office"},
      {"to": "f1_records", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Records Office"},
      {"to": "f1_supplies", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Supply Office"},
      {"to": "f1_reception", "ticks": 25, "oneWay": true, "label": "Return to Reception"},
    ],
  },
  f1_dispatch: {
    id: "f1_dispatch",
    name: "Dispatch Office",
    icon: "📨",
    areaId: "ascent_f1_area",
    map: {"x": 68, "y": 38},
    tags: ["indoor"],
    activities: [],
    connections: [
      {"to": "f1_scribe", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Scribe’s Office"},
      {"to": "f1_auditor", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "The Auditor"},
      {"to": "f1_break_room", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Break Room"},
      {"to": "f1_toll_hall", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Toll Collector’s Office"},
      {"to": "f1_registry", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "The Registry"},
      {"to": "f1_records", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Records Office"},
      {"to": "f1_supplies", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Supply Office"},
      {"to": "f1_reception", "ticks": 25, "oneWay": true, "label": "Return to Reception"},
    ],
  },
  f1_records: {
    id: "f1_records",
    name: "Records Office",
    icon: "📑",
    areaId: "ascent_f1_area",
    map: {"x": 88, "y": 38},
    tags: ["indoor"],
    activities: [],
    connections: [
      {"to": "f1_scribe", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Scribe’s Office"},
      {"to": "f1_auditor", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "The Auditor"},
      {"to": "f1_break_room", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Break Room"},
      {"to": "f1_toll_hall", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Toll Collector’s Office"},
      {"to": "f1_registry", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "The Registry"},
      {"to": "f1_dispatch", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Dispatch Office"},
      {"to": "f1_supplies", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Supply Office"},
      {"to": "f1_reception", "ticks": 25, "oneWay": true, "label": "Return to Reception"},
    ],
  },
  f1_supplies: {
    id: "f1_supplies",
    name: "Supply Office",
    icon: "📦",
    areaId: "ascent_f1_area",
    map: {"x": 68, "y": 58},
    tags: ["indoor"],
    activities: [],
    connections: [
      {"to": "f1_scribe", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Scribe’s Office"},
      {"to": "f1_auditor", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "The Auditor"},
      {"to": "f1_break_room", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Break Room"},
      {"to": "f1_toll_hall", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Toll Collector’s Office"},
      {"to": "f1_registry", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "The Registry"},
      {"to": "f1_dispatch", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Dispatch Office"},
      {"to": "f1_records", "ticks": 25, "oneWay": true, "requires": [{"type": "stat", "key": "flag:key_item:toll_office_key", "value": 1}], "label": "Records Office"},
      {"to": "f1_reception", "ticks": 25, "oneWay": true, "label": "Return to Reception"},
    ],
  },
  f1_toll_hall: {
    id: "f1_toll_hall",
    name: "Toll Collector’s Office",
    icon: "🗿",
    areaId: "ascent_f1_area",
    map: {"x": 88, "y": 58},
    tags: ["indoor"],
    activities: [],
    connections: [
      {"to": "f1_reception", "ticks": 25, "oneWay": true, "label": "Return to Reception"},
    ],
    forced: true,
    fightLimit: 1,
    groupWeights: {"1": 100},
    modifierWeights: {"normal": 100},
    encounters: [
      {"monsterId": "toll_collector_golem", "weight": 1, "level": [4, 4], "once": true, "boss": true},
    ],
  },

  // --- Floor 2: the Long Hall (plans/alpha-band-one-floors.md "One building").
  // The same office building as floor 1, one storey up: a straight corridor
  // of four stretches, each a small fight budget whose spending opens the
  // next, with three rooms off it (the tutor, the quartermaster, a break
  // room). The clear is the far end's budget. All names are placeholders.
  f2_stairhead: {
    id: 'f2_stairhead',
    name: 'The Stairhead',
    icon: '🪜',
    areaId: 'ascent_f2_area',
    map: { x: 8, y: 50 },
    tags: ['indoor'],
    activities: [{ id: 'camp_f2', kind: 'rest', name: 'Camp on the Landing', icon: '🏕️' }],
    connections: [{ to: 'f2_hall_1', ticks: 25 }],
  },
  f2_hall_1: {
    id: 'f2_hall_1',
    name: 'The Mail Carts',
    icon: '📬',
    areaId: 'ascent_f2_area',
    map: { x: 26, y: 50 },
    tags: ['indoor'],
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Clear the Stretch', icon: '⚔️' }],
    fightLimit: 3,
    groupWeights: { 1: 100 },
    encounters: [
      { monsterId: 'ledger_tome', weight: 70, level: [3, 4] },
      { monsterId: 'filing_automaton', weight: 30, level: [3, 4] },
    ],
    connections: [
      // The tutor is the first door, open from the start: the lessons are
      // meant to be in hand before the hall gets harder.
      { to: 'f2_gym', ticks: 15 },
      {
        to: 'f2_hall_2',
        ticks: 30,
        label: 'On Down the Hall',
        requires: [{ type: 'stat', key: 'fights:f2_hall_1', value: 3 }],
        revealWhen: [{ type: 'stat', key: 'fights:f2_hall_1', value: 3 }],
      },
    ],
  },
  f2_gym: {
    id: 'f2_gym',
    name: 'The Cleared Office',
    icon: '🥋',
    areaId: 'ascent_f2_area',
    map: { x: 26, y: 28 },
    tags: ['indoor'],
    activities: [{ id: 'train_str_gym', kind: 'train', attr: 'str', name: 'Work the Heavy Bag', icon: '🥊' }],
    connections: [],
  },
  f2_hall_2: {
    id: 'f2_hall_2',
    name: 'The Filing Bays',
    icon: '🗄️',
    areaId: 'ascent_f2_area',
    map: { x: 44, y: 50 },
    tags: ['indoor'],
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Clear the Stretch', icon: '⚔️' }],
    fightLimit: 3,
    groupWeights: { 1: 80, 2: 20 },
    encounters: [
      { monsterId: 'filing_automaton', weight: 60, level: [4, 5] },
      { monsterId: 'ledger_tome', weight: 40, level: [4, 5] },
    ],
    connections: [
      { to: 'f2_stores', ticks: 15 },
      {
        to: 'f2_hall_3',
        ticks: 30,
        label: 'On Down the Hall',
        requires: [{ type: 'stat', key: 'fights:f2_hall_2', value: 3 }],
        revealWhen: [{ type: 'stat', key: 'fights:f2_hall_2', value: 3 }],
      },
    ],
  },
  f2_stores: {
    id: 'f2_stores',
    name: 'The Quartermaster’s Cage',
    icon: '📦',
    areaId: 'ascent_f2_area',
    map: { x: 44, y: 72 },
    tags: ['indoor'],
    activities: [],
    connections: [],
  },
  f2_hall_3: {
    id: 'f2_hall_3',
    name: 'Copy Room Row',
    icon: '🖨️',
    areaId: 'ascent_f2_area',
    map: { x: 62, y: 50 },
    tags: ['indoor'],
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Clear the Stretch', icon: '⚔️' }],
    fightLimit: 3,
    groupWeights: { 1: 80, 2: 20 },
    encounters: [
      { monsterId: 'sorting_automaton', weight: 50, level: [5, 6] },
      { monsterId: 'living_doll', weight: 50, level: [5, 6] },
    ],
    connections: [
      { to: 'f2_break_room', ticks: 15 },
      {
        to: 'f2_hall_4',
        ticks: 30,
        label: 'On Down the Hall',
        requires: [{ type: 'stat', key: 'fights:f2_hall_3', value: 3 }],
        revealWhen: [{ type: 'stat', key: 'fights:f2_hall_3', value: 3 }],
      },
    ],
  },
  f2_break_room: {
    id: 'f2_break_room',
    name: 'The Break Room',
    icon: '☕',
    areaId: 'ascent_f2_area',
    map: { x: 62, y: 28 },
    tags: ['indoor'],
    exploreTicks: 300,
    activities: [
      { id: 'rest_break_room', kind: 'rest', name: 'Sit Down for a While', icon: '🪑' },
      { id: 'explore_f2', kind: 'explore', name: 'Go Through the Cupboards', icon: '🔍' },
    ],
    // Most of the floor's coin: the next floor's gate wants gold earned.
    finds: [{ id: 'f2_petty_cash', at: 0.4, gold: [70, 110] }],
    connections: [],
  },
  f2_hall_4: {
    id: 'f2_hall_4',
    name: 'The Far End',
    icon: '🚪',
    areaId: 'ascent_f2_area',
    map: { x: 80, y: 50 },
    tags: ['indoor'],
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Clear the Stretch', icon: '⚔️' }],
    // The floor's clear: this number and ascent_f2.clear are the same dial.
    fightLimit: 3,
    groupWeights: { 1: 80, 2: 20 },
    encounters: [
      { monsterId: 'living_doll', weight: 50, level: [6, 7] },
      { monsterId: 'filing_automaton', weight: 50, level: [6, 7] },
    ],
    connections: [],
  },

  // --- Floor 3: the Descent (plans/alpha-band-one-floors.md "One building").
  // Inside the same building, going down a stairwell: three landings, a side
  // room off each, and the Hearing Room at the bottom. Each side room's search
  // finds the way to the next flight (a flag the landing's stair requires),
  // one of the three string anchors the puppet bureaucrat hangs from, and
  // something to carry. Every anchor cut takes a level off the bureaucrat
  // (12 uncut, 9 with all three); it stays winnable uncut, only harder. All
  // names are placeholders.
  f3_stairhead: {
    id: 'f3_stairhead',
    name: 'The Stairwell Head',
    icon: '🪜',
    areaId: 'ascent_f3_area',
    map: { x: 50, y: 6 },
    tags: ['indoor'],
    activities: [{ id: 'camp_f3', kind: 'rest', name: 'Camp on the Landing', icon: '🏕️' }],
    connections: [
      { to: 'f3_mail_room', ticks: 15 },
      {
        to: 'f3_landing_2',
        ticks: 30,
        label: 'Down the Stairwell',
        requires: [{ type: 'stat', key: 'flag:f3_stairs_1', value: 1 }],
        revealWhen: [{ type: 'stat', key: 'flag:f3_stairs_1', value: 1 }],
      },
    ],
  },
  f3_mail_room: {
    id: 'f3_mail_room',
    name: 'The Mail Room',
    icon: '📮',
    areaId: 'ascent_f3_area',
    map: { x: 24, y: 6 },
    tags: ['indoor'],
    exploreTicks: 360,
    activities: [{ id: 'search_room', kind: 'explore', name: 'Sort Through the Sacks', icon: '🔍' }],
    finds: [
      { id: 'f3_mail_plan', at: 0.3, stat: { key: 'flag:f3_stairs_1' } },
      { id: 'f3_mail_purse', at: 0.5, gold: [60, 90] },
      { id: 'f3_mail_string', at: 0.75, stat: { key: 'flag:f3_strings_cut' } },
    ],
    connections: [],
  },
  f3_landing_2: {
    id: 'f3_landing_2',
    name: 'The Second Landing',
    icon: '🪜',
    areaId: 'ascent_f3_area',
    map: { x: 50, y: 27 },
    tags: ['indoor'],
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Clear the Landing', icon: '⚔️' }],
    fightLimit: 2,
    groupWeights: { 1: 100 },
    encounters: [
      { monsterId: 'living_doll', weight: 60, level: [6, 7] },
      { monsterId: 'sorting_automaton', weight: 40, level: [6, 7] },
    ],
    connections: [
      { to: 'f3_archive', ticks: 15 },
      {
        to: 'f3_landing_3',
        ticks: 30,
        label: 'Down the Stairwell',
        requires: [{ type: 'stat', key: 'flag:f3_stairs_2', value: 1 }],
        revealWhen: [{ type: 'stat', key: 'flag:f3_stairs_2', value: 1 }],
      },
    ],
  },
  f3_archive: {
    id: 'f3_archive',
    name: 'The Archive Stacks',
    icon: '🗄️',
    areaId: 'ascent_f3_area',
    map: { x: 76, y: 27 },
    tags: ['indoor'],
    exploreTicks: 420,
    activities: [{ id: 'search_room', kind: 'explore', name: 'Search the Stacks', icon: '🔍' }],
    // The floor's own answer: the bureaucrat is a construct, and constructs
    // take more from a blunt blow than from an edge or a point.
    finds: [
      { id: 'f3_archive_plan', at: 0.3, stat: { key: 'flag:f3_stairs_2' } },
      { id: 'f3_archive_club', at: 0.5, item: 'oak_club' },
      { id: 'f3_archive_string', at: 0.75, stat: { key: 'flag:f3_strings_cut' } },
    ],
    connections: [],
  },
  f3_landing_3: {
    id: 'f3_landing_3',
    name: 'The Third Landing',
    icon: '🪜',
    areaId: 'ascent_f3_area',
    map: { x: 50, y: 48 },
    tags: ['indoor'],
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Clear the Landing', icon: '⚔️' }],
    fightLimit: 2,
    groupWeights: { 1: 100 },
    encounters: [
      { monsterId: 'living_doll', weight: 50, level: [7, 8] },
      { monsterId: 'filing_automaton', weight: 50, level: [7, 8] },
    ],
    connections: [
      { to: 'f3_annex', ticks: 15 },
      // The way to the Hearing Room is walked knowing: arriving is the fight.
      {
        to: 'f3_hearing_room',
        ticks: 30,
        label: 'Down to the Hearing Room',
        requires: [{ type: 'stat', key: 'flag:f3_stairs_3', value: 1 }],
        revealWhen: [{ type: 'stat', key: 'flag:f3_stairs_3', value: 1 }],
      },
    ],
  },
  f3_annex: {
    id: 'f3_annex',
    name: 'The Records Annex',
    icon: '📂',
    areaId: 'ascent_f3_area',
    map: { x: 24, y: 48 },
    tags: ['indoor'],
    exploreTicks: 420,
    activities: [{ id: 'search_room', kind: 'explore', name: 'Go Through the Files', icon: '🔍' }],
    finds: [
      { id: 'f3_annex_plan', at: 0.3, stat: { key: 'flag:f3_stairs_3' } },
      { id: 'f3_annex_salve', at: 0.5, material: { id: 'healing_salve', qty: 2 } },
      { id: 'f3_annex_string', at: 0.75, stat: { key: 'flag:f3_strings_cut' } },
    ],
    connections: [],
  },
  f3_hearing_room: {
    id: 'f3_hearing_room',
    name: 'The Hearing Room',
    icon: '⚖️',
    areaId: 'ascent_f3_area',
    map: { x: 50, y: 69 },
    tags: ['indoor'],
    // The bureaucrat does not let anyone past: arriving is the fight, and it
    // is the room's one fight. Won, the room is cleared and stops forcing.
    // The floor's clear is the kill (slain:f3_hearing_room:puppet_bureaucrat),
    // which is also what opens prestige.
    forced: true,
    fightLimit: 1,
    groupWeights: { 1: 100 },
    modifierWeights: { normal: 100 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Answer the Summons', icon: '⚔️' }],
    // One table per anchor count: every cut string is a level off. `once`
    // is what latches slain:f3_hearing_room:puppet_bureaucrat, the clear.
    encounters: [
      { monsterId: 'puppet_bureaucrat', weight: 1, once: true, level: [12, 12], requires: [{ type: 'statMax', key: 'flag:f3_strings_cut', value: 0 }] },
      { monsterId: 'puppet_bureaucrat', weight: 1, once: true, level: [11, 11], requires: [{ type: 'stat', key: 'flag:f3_strings_cut', value: 1 }, { type: 'statMax', key: 'flag:f3_strings_cut', value: 1 }] },
      { monsterId: 'puppet_bureaucrat', weight: 1, once: true, level: [10, 10], requires: [{ type: 'stat', key: 'flag:f3_strings_cut', value: 2 }, { type: 'statMax', key: 'flag:f3_strings_cut', value: 2 }] },
      { monsterId: 'puppet_bureaucrat', weight: 1, once: true, level: [9, 9], requires: [{ type: 'stat', key: 'flag:f3_strings_cut', value: 3 }] },
    ],
    connections: [],
  },

  // ---------- The Ascent: band 2, the Wilds (floors 4–6) ----------
  //
  // docs/plans/bands-2-3.md. Sketch fidelity: names, numbers and text are
  // placeholders for the user to caption. Unlike band 1, every hunt here is
  // ENDLESS (no fightLimit): the dens stay open after the clear, and which den
  // to hunt for which material is the band's decision. Goblin kills anywhere
  // in the band pay the next floor's gate (kills:tag:goblin).

  // --- Floor 4: the Greenwood. Forest, hills and a ravine; goblin raid
  // parties roll into the hunts. The raid leader at the ravine floor is the
  // clear. Herbs feed alchemy, game meat feeds cooking, hill ore feeds the anvil.
  f4_treeline: {
    id: 'f4_treeline',
    name: 'The Treeline',
    icon: '🌲',
    areaId: 'ascent_f4_area',
    map: { x: 50, y: 6 },
    activities: [{ id: 'camp_f4', kind: 'rest', name: 'Camp at the Treeline', icon: '🏕️' }],
    connections: [{ to: 'f4_woods_edge', ticks: 20 }],
  },
  f4_woods_edge: {
    id: 'f4_woods_edge',
    name: 'The Woods Edge',
    icon: '🌳',
    areaId: 'ascent_f4_area',
    map: { x: 50, y: 20 },
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Hunt the Edge', icon: '🏹' },
      { id: 'explore', kind: 'explore', name: 'Forage', icon: '🌿' },
    ],
    groupWeights: { 1: 75, 2: 25 },
    encounters: [
      { monsterId: 'forest_rat', weight: 35, level: [7, 8] },
      { monsterId: 'young_wolf', weight: 35, level: [7, 9] },
      { monsterId: 'goblin', weight: 30, level: [7, 9] },
    ],
    exploreTicks: 240,
    finds: [
      { id: 'f4_edge_herbs', at: 0.25, material: { id: 'common_herb', qty: 4 } },
      { id: 'f4_edge_berries', at: 0.6, material: { id: 'forest_berries', qty: 4 } },
      { id: 'f4_edge_purse', at: 1, gold: [30, 60] },
    ],
    connections: [
      { to: 'f4_deep_woods', ticks: 30 },
      { to: 'f4_hills', ticks: 30 },
    ],
  },
  f4_hills: {
    id: 'f4_hills',
    name: 'The Barrow Hills',
    icon: '⛰️',
    areaId: 'ascent_f4_area',
    map: { x: 82, y: 36 },
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Hunt the Hills', icon: '🏹' },
      { id: 'explore', kind: 'explore', name: 'Search the Barrows', icon: '🔍' },
    ],
    groupWeights: { 1: 80, 2: 20 },
    encounters: [
      { monsterId: 'boar', weight: 45, level: [8, 9] },
      { monsterId: 'cliff_hawk', weight: 35, level: [8, 9] },
      { monsterId: 'goblin', weight: 20, level: [8, 9] },
    ],
    exploreTicks: 300,
    finds: [
      { id: 'f4_hills_ore', at: 0.3, material: { id: 'copper_ore', qty: 3 } },
      { id: 'f4_hills_barrow', at: 0.7, gold: [50, 90], material: { id: 'iron_scrap', qty: 2 } },
    ],
    connections: [{ to: 'f4_ravine_rim', ticks: 30 }],
  },
  f4_deep_woods: {
    id: 'f4_deep_woods',
    name: 'The Deep Woods',
    icon: '🌲',
    areaId: 'ascent_f4_area',
    map: { x: 40, y: 36 },
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Hunt the Deep Woods', icon: '🏹' },
      { id: 'explore', kind: 'explore', name: 'Explore', icon: '🧭' },
    ],
    // The raid parties: two and three goblins at a time, rolled into the hunt.
    groupWeights: { 1: 55, 2: 25, 3: 20 },
    encounters: [
      { monsterId: 'wolf', weight: 35, level: [8, 9] },
      { monsterId: 'boar', weight: 25, level: [8, 9] },
      { monsterId: 'goblin', weight: 40, level: [8, 9] },
    ],
    exploreTicks: 300,
    finds: [
      { id: 'f4_deep_mushrooms', at: 0.3, material: { id: 'cave_mushroom', qty: 3 } },
      { id: 'f4_deep_camp', at: 0.8, gold: [40, 80], material: { id: 'iron_scrap', qty: 2 } },
    ],
    connections: [{ to: 'f4_ravine_rim', ticks: 30 }],
  },
  f4_ravine_rim: {
    id: 'f4_ravine_rim',
    name: 'The Ravine Rim',
    icon: '🪨',
    areaId: 'ascent_f4_area',
    map: { x: 55, y: 52 },
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Hunt the Rim', icon: '🏹' },
      { id: 'explore', kind: 'explore', name: 'Look Over the Edge', icon: '🔭' },
    ],
    groupWeights: { 1: 70, 2: 20, 3: 10 },
    encounters: [
      { monsterId: 'cliff_hawk', weight: 45, level: [8, 10] },
      { monsterId: 'goblin', weight: 55, level: [8, 10] },
    ],
    exploreTicks: 240,
    finds: [
      { id: 'f4_rim_nest', at: 0.4, gold: [20, 40], material: { id: 'gold_leaf', qty: 1 } },
      { id: 'f4_rim_camp', at: 0.75, spot: 'f4_ravine_floor' },
    ],
    connections: [{ to: 'f4_ravine_floor', ticks: 40, label: 'Down into the Ravine', returnLabel: 'Climb Out' }],
  },
  f4_ravine_floor: {
    id: 'f4_ravine_floor',
    name: 'The Raid Camp',
    icon: '⛺',
    areaId: 'ascent_f4_area',
    map: { x: 55, y: 70 },
    // The raid leader's camp: one fight, the floor's clear. Not forced — the
    // player walks in when ready.
    fightLimit: 1,
    modifierWeights: { normal: 100 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Raid the Camp', icon: '⚔️' }],
    encounters: [{ monsterId: 'goblin_raid_leader', weight: 1, once: true, level: [9, 9] }],
    connections: [],
  },

  // --- Floor 5: the Mire. A swamp and the caves under it: the first
  // firetongues (burning) and hobgoblins (techniques you can learn by
  // watching), and the dark. Searching the Hollows finds the warren's back
  // door; the hobgoblin champion guarding it is the clear.
  f5_causeway: {
    id: 'f5_causeway',
    name: 'The Causeway',
    icon: '🪵',
    areaId: 'ascent_f5_area',
    map: { x: 50, y: 6 },
    activities: [{ id: 'camp_f5', kind: 'rest', name: 'Camp on the Causeway', icon: '🏕️' }],
    connections: [{ to: 'f5_bog', ticks: 25 }],
  },
  f5_bog: {
    id: 'f5_bog',
    name: 'The Bog',
    icon: '🟤',
    areaId: 'ascent_f5_area',
    map: { x: 50, y: 20 },
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Hunt the Bog', icon: '🏹' },
      { id: 'explore', kind: 'explore', name: 'Wade the Bog', icon: '🌿' },
    ],
    groupWeights: { 1: 70, 2: 30 },
    encounters: [
      { monsterId: 'slime_water', weight: 30, level: [9, 10] },
      { monsterId: 'slime_zombie', weight: 20, level: [9, 10] },
      { monsterId: 'goblin_firetongue', weight: 25, level: [9, 10] },
      { monsterId: 'goblin', weight: 25, level: [9, 10] },
    ],
    exploreTicks: 300,
    finds: [
      { id: 'f5_bog_herbs', at: 0.3, material: { id: 'common_herb', qty: 5 } },
      { id: 'f5_bog_purse', at: 0.8, gold: [50, 90] },
    ],
    connections: [
      { to: 'f5_drowned_village', ticks: 30 },
      { to: 'f5_cave_mouth', ticks: 30 },
    ],
  },
  f5_drowned_village: {
    id: 'f5_drowned_village',
    name: 'The Drowned Village',
    icon: '🛖',
    areaId: 'ascent_f5_area',
    map: { x: 18, y: 32 },
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Clear the Huts', icon: '⚔️' },
      { id: 'explore', kind: 'explore', name: 'Search the Huts', icon: '🔍' },
    ],
    groupWeights: { 1: 60, 2: 30, 3: 10 },
    encounters: [
      { monsterId: 'goblin_firetongue', weight: 45, level: [9, 11] },
      { monsterId: 'goblin', weight: 55, level: [9, 11] },
    ],
    exploreTicks: 300,
    finds: [
      { id: 'f5_village_salves', at: 0.4, material: { id: 'healing_salve', qty: 2 } },
      { id: 'f5_village_cache', at: 0.8, gold: [70, 120] },
    ],
    connections: [{ to: 'f5_cave_mouth', ticks: 35 }],
  },
  f5_cave_mouth: {
    id: 'f5_cave_mouth',
    name: 'The Cave Mouth',
    icon: '🕳️',
    areaId: 'ascent_f5_area',
    map: { x: 50, y: 38 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Hunt the Cave Mouth', icon: '🏹' }],
    groupWeights: { 1: 70, 2: 30 },
    encounters: [
      { monsterId: 'hobgoblin', weight: 40, level: [9, 11] },
      { monsterId: 'slime_spider', weight: 25, level: [9, 11] },
      { monsterId: 'goblin', weight: 35, level: [9, 11] },
    ],
    connections: [{ to: 'f5_hollows', ticks: 30 }],
  },
  f5_hollows: {
    id: 'f5_hollows',
    name: 'The Hollows',
    icon: '🦇',
    areaId: 'ascent_f5_area',
    map: { x: 50, y: 54 },
    // Dark: footwork suffers until Darkvision pays it off (combat.ts).
    tags: ['dark'],
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Hunt the Hollows', icon: '🏹' },
      { id: 'explore', kind: 'explore', name: 'Map the Hollows', icon: '🔦' },
    ],
    groupWeights: { 1: 70, 2: 30 },
    encounters: [
      { monsterId: 'hobgoblin', weight: 50, level: [10, 11] },
      { monsterId: 'slime_spider', weight: 30, level: [10, 11] },
      { monsterId: 'stone_golem', weight: 20, level: [10, 11] },
    ],
    exploreTicks: 360,
    finds: [
      { id: 'f5_hollows_ore', at: 0.3, material: { id: 'copper_ore', qty: 4 } },
      { id: 'f5_hollows_door', at: 0.6, stat: { key: 'flag:f5_back_door' } },
      { id: 'f5_hollows_scrap', at: 0.9, material: { id: 'iron_scrap', qty: 4 } },
    ],
    connections: [
      {
        to: 'f5_back_door',
        ticks: 30,
        label: 'To the Back Door',
        requires: [{ type: 'stat', key: 'flag:f5_back_door', value: 1 }],
        revealWhen: [{ type: 'stat', key: 'flag:f5_back_door', value: 1 }],
      },
    ],
  },
  f5_back_door: {
    id: 'f5_back_door',
    name: 'The Back Door',
    icon: '🚪',
    areaId: 'ascent_f5_area',
    map: { x: 50, y: 70 },
    fightLimit: 1,
    modifierWeights: { normal: 100 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Take the Door', icon: '⚔️' }],
    encounters: [{ monsterId: 'hobgoblin_champion', weight: 1, once: true, level: [8, 8] }],
    connections: [],
  },

  // --- Floor 6: the Warren, two maps. The outer warren (mouth, tunnels,
  // pens, kitchens, shrine) and, down the drop, the deep encampment. Each of
  // the three sabotages takes a level off the warchief (11 with none, 8 with
  // all three), the floor 3 pattern. Arriving in the great hall is the fight.
  f6_warren_mouth: {
    id: 'f6_warren_mouth',
    name: 'The Warren Mouth',
    icon: '🕳️',
    areaId: 'ascent_f6_area',
    map: { x: 50, y: 6 },
    activities: [{ id: 'camp_f6', kind: 'rest', name: 'Camp at the Mouth', icon: '🏕️' }],
    connections: [{ to: 'f6_tunnels', ticks: 20 }],
  },
  f6_tunnels: {
    id: 'f6_tunnels',
    name: 'The Tunnels',
    icon: '🪨',
    areaId: 'ascent_f6_area',
    map: { x: 50, y: 20 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Fight Through the Tunnels', icon: '⚔️' }],
    groupWeights: { 1: 50, 2: 30, 3: 20 },
    encounters: [
      { monsterId: 'goblin', weight: 40, level: [10, 12] },
      { monsterId: 'hobgoblin', weight: 30, level: [10, 12] },
      { monsterId: 'goblin_firetongue', weight: 15, level: [10, 12] },
      { monsterId: 'goblin_witch_doctor', weight: 15, level: [10, 12] },
    ],
    connections: [
      { to: 'f6_pens', ticks: 20 },
      { to: 'f6_kitchens', ticks: 20 },
      { to: 'f6_shrine', ticks: 25 },
    ],
  },
  f6_pens: {
    id: 'f6_pens',
    name: 'The Pens',
    icon: '🐗',
    areaId: 'ascent_f6_area',
    map: { x: 18, y: 20 },
    activities: [{ id: 'explore', kind: 'explore', name: 'Break Open the Pens', icon: '🔓' }],
    exploreTicks: 300,
    finds: [
      { id: 'f6_pens_meat', at: 0.3, material: { id: 'raw_meat', qty: 4 } },
      { id: 'f6_pens_sabotage', at: 0.7, stat: { key: 'flag:f6_sabotage' } },
    ],
    connections: [],
  },
  f6_kitchens: {
    id: 'f6_kitchens',
    name: 'The Kitchens',
    icon: '🍲',
    areaId: 'ascent_f6_area',
    map: { x: 82, y: 20 },
    activities: [{ id: 'explore', kind: 'explore', name: 'Foul the Stores', icon: '🧪' }],
    exploreTicks: 300,
    finds: [
      { id: 'f6_kitchens_food', at: 0.3, material: { id: 'rustic_loaf', qty: 3 } },
      { id: 'f6_kitchens_sabotage', at: 0.7, stat: { key: 'flag:f6_sabotage' } },
    ],
    connections: [],
  },
  f6_shrine: {
    id: 'f6_shrine',
    name: 'The Shrine',
    icon: '🗿',
    areaId: 'ascent_f6_area',
    map: { x: 50, y: 34 },
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Clear the Shrine', icon: '⚔️' },
      { id: 'explore', kind: 'explore', name: 'Desecrate the Shrine', icon: '🔥' },
    ],
    groupWeights: { 1: 60, 2: 40 },
    encounters: [
      { monsterId: 'goblin_witch_doctor', weight: 50, level: [11, 12] },
      { monsterId: 'goblin_firetongue', weight: 50, level: [11, 12] },
    ],
    exploreTicks: 300,
    finds: [
      { id: 'f6_shrine_offering', at: 0.3, gold: [80, 140] },
      { id: 'f6_shrine_sabotage', at: 0.7, stat: { key: 'flag:f6_sabotage' } },
    ],
    connections: [{ to: 'f6_drop', ticks: 30, label: 'Down the Drop', returnLabel: 'Back Up the Drop' }],
  },
  f6_drop: {
    id: 'f6_drop',
    name: 'The Drop',
    icon: '🕳️',
    areaId: 'ascent_f6_area',
    map: { x: 50, y: 52 },
    tags: ['dark'],
    activities: [
      { id: 'camp_f6_deep', kind: 'rest', name: 'Camp in the Drop', icon: '🏕️' },
      { id: 'hunt', kind: 'hunt', name: 'Hold the Drop', icon: '⚔️' },
    ],
    groupWeights: { 1: 40, 2: 35, 3: 25 },
    encounters: [
      { monsterId: 'hobgoblin', weight: 45, level: [11, 13] },
      { monsterId: 'goblin_witch_doctor', weight: 20, level: [11, 13] },
      { monsterId: 'goblin_firetongue', weight: 20, level: [11, 13] },
      { monsterId: 'goblin', weight: 15, level: [11, 13] },
    ],
    connections: [{ to: 'f6_great_hall', ticks: 30, label: 'Into the Great Hall' }],
  },
  f6_great_hall: {
    id: 'f6_great_hall',
    name: 'The Great Hall',
    icon: '🔥',
    areaId: 'ascent_f6_area',
    map: { x: 50, y: 70 },
    forced: true,
    fightLimit: 1,
    modifierWeights: { normal: 100 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Face the Warchief', icon: '⚔️' }],
    // One line per sabotage count, as on floor 3: every sabotage is a level
    // off. `once` latches slain:f6_great_hall:goblin_warchief, the clear and
    // PRESTIGE_UNLOCK.
    encounters: [
      { monsterId: 'goblin_warchief', weight: 1, once: true, level: [11, 11], requires: [{ type: 'statMax', key: 'flag:f6_sabotage', value: 0 }] },
      { monsterId: 'goblin_warchief', weight: 1, once: true, level: [10, 10], requires: [{ type: 'stat', key: 'flag:f6_sabotage', value: 1 }, { type: 'statMax', key: 'flag:f6_sabotage', value: 1 }] },
      { monsterId: 'goblin_warchief', weight: 1, once: true, level: [9, 9], requires: [{ type: 'stat', key: 'flag:f6_sabotage', value: 2 }, { type: 'statMax', key: 'flag:f6_sabotage', value: 2 }] },
      { monsterId: 'goblin_warchief', weight: 1, once: true, level: [8, 8], requires: [{ type: 'stat', key: 'flag:f6_sabotage', value: 3 }] },
    ],
    connections: [],
  },

  // ---------- The Ascent, band 3: the City (bands-2-3.md), a SKELETON ----------
  //
  // The castle hub and four direction floors, three spots each: the district
  // (landing, camp, a patrol hunt), the land past the wall (hunt and search),
  // and the keeper's room at the far end (one fight, the clear). Every level
  // below is the BASE: the band's levelSteps add +2, +5, +9 as directions
  // fall (systems/ladder.ts bandLevelStep). Monsters, names and finds are
  // stand-ins from the existing roster until the user captions the band (Q9).
  castle_court: {
    id: 'castle_court',
    name: 'The Castle Court',
    icon: '🏰',
    areaId: 'ascent_castle_area',
    map: { x: 50, y: 50 },
    // A haven: a knockout anywhere on the four floors can fall back here.
    activities: [{ id: 'rest_castle', kind: 'rest', name: 'Rest in the Castle', icon: '🛏️' }],
    connections: [],
  },

  // --- Floor 7, south: the docks and the salt marsh past them. Stand-in
  // threat: poison (marsh slimes, cave spiders).
  f7_docks: {
    id: 'f7_docks',
    name: 'The Docks',
    icon: '⚓',
    areaId: 'ascent_f7_area',
    map: { x: 50, y: 10 },
    activities: [
      { id: 'camp_f7', kind: 'rest', name: 'Camp on the Docks', icon: '🏕️' },
      { id: 'hunt', kind: 'hunt', name: 'Patrol the Docks', icon: '⚔️' },
    ],
    groupWeights: { 1: 70, 2: 30 },
    encounters: [
      { monsterId: 'forest_rat', weight: 50, level: [12, 13] },
      { monsterId: 'slime_water', weight: 50, level: [12, 13] },
    ],
    connections: [{ to: 'f7_salt_marsh', ticks: 30, label: 'Out the South Gate', returnLabel: 'Back Through the South Gate' }],
  },
  f7_salt_marsh: {
    id: 'f7_salt_marsh',
    name: 'The Salt Marsh',
    icon: '🌾',
    areaId: 'ascent_f7_area',
    map: { x: 50, y: 40 },
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Hunt the Marsh', icon: '🏹' },
      { id: 'explore', kind: 'explore', name: 'Wade the Marsh', icon: '🌿' },
    ],
    groupWeights: { 1: 60, 2: 30, 3: 10 },
    encounters: [
      { monsterId: 'slime_nature', weight: 40, level: [13, 14] },
      { monsterId: 'cave_spider', weight: 35, level: [13, 14] },
      { monsterId: 'slime_water', weight: 25, level: [13, 14] },
    ],
    exploreTicks: 300,
    finds: [
      { id: 'f7_marsh_herbs', at: 0.3, material: { id: 'common_herb', qty: 5 } },
      { id: 'f7_marsh_purse', at: 1, gold: [100, 180] },
    ],
    connections: [{ to: 'f7_wreck', ticks: 30, label: 'To the Wreck' }],
  },
  f7_wreck: {
    id: 'f7_wreck',
    name: 'The Wreck',
    icon: '🕸️',
    areaId: 'ascent_f7_area',
    map: { x: 50, y: 70 },
    fightLimit: 1,
    modifierWeights: { normal: 100 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Board the Wreck', icon: '⚔️' }],
    encounters: [{ monsterId: 'giant_spider_queen', weight: 1, once: true, level: [14, 14] }],
    connections: [],
  },

  // --- Floor 8, west: the forest gate and the old forest past it, facing the
  // Greenwood of band 2 (the Five Moons' way in, FLOOR_IDEAS idea 1). Stand-in
  // threat: bleeding (wolves) and the goblin remnant.
  f8_forest_gate: {
    id: 'f8_forest_gate',
    name: 'The Forest Gate',
    icon: '🚪',
    areaId: 'ascent_f8_area',
    map: { x: 50, y: 10 },
    activities: [
      { id: 'camp_f8', kind: 'rest', name: 'Camp at the Gate', icon: '🏕️' },
      { id: 'hunt', kind: 'hunt', name: 'Hold the Gate', icon: '⚔️' },
    ],
    groupWeights: { 1: 70, 2: 30 },
    encounters: [
      { monsterId: 'goblin', weight: 60, level: [12, 13] },
      { monsterId: 'young_wolf', weight: 40, level: [12, 13] },
    ],
    connections: [{ to: 'f8_old_forest', ticks: 30, label: 'Out the West Gate', returnLabel: 'Back Through the West Gate' }],
  },
  f8_old_forest: {
    id: 'f8_old_forest',
    name: 'The Old Forest',
    icon: '🌲',
    areaId: 'ascent_f8_area',
    map: { x: 50, y: 40 },
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Hunt the Old Forest', icon: '🏹' },
      { id: 'explore', kind: 'explore', name: 'Forage', icon: '🌿' },
    ],
    groupWeights: { 1: 60, 2: 30, 3: 10 },
    encounters: [
      { monsterId: 'wolf', weight: 40, level: [13, 14] },
      { monsterId: 'boar', weight: 30, level: [13, 14] },
      { monsterId: 'hobgoblin', weight: 30, level: [13, 14] },
    ],
    exploreTicks: 300,
    finds: [
      { id: 'f8_forest_berries', at: 0.3, material: { id: 'forest_berries', qty: 5 } },
      { id: 'f8_forest_meat', at: 0.6, material: { id: 'raw_meat', qty: 4 } },
    ],
    connections: [{ to: 'f8_lodge', ticks: 30, label: 'To the Hunting Lodge' }],
  },
  f8_lodge: {
    id: 'f8_lodge',
    name: 'The Hunting Lodge',
    icon: '🛖',
    areaId: 'ascent_f8_area',
    map: { x: 50, y: 70 },
    fightLimit: 1,
    modifierWeights: { normal: 100 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Take the Lodge', icon: '⚔️' }],
    encounters: [{ monsterId: 'hobgoblin_champion', weight: 1, once: true, level: [14, 14] }],
    connections: [],
  },

  // --- Floor 9, north: the cathedral close and the barrow fields past it.
  // Stand-in threat: the dead (zombie slimes, a death knight).
  f9_cathedral_close: {
    id: 'f9_cathedral_close',
    name: 'The Cathedral Close',
    icon: '⛪',
    areaId: 'ascent_f9_area',
    map: { x: 50, y: 10 },
    activities: [
      { id: 'camp_f9', kind: 'rest', name: 'Shelter in the Close', icon: '🏕️' },
      { id: 'hunt', kind: 'hunt', name: 'Clear the Close', icon: '⚔️' },
    ],
    groupWeights: { 1: 70, 2: 30 },
    encounters: [
      { monsterId: 'living_doll', weight: 50, level: [12, 13] },
      { monsterId: 'slime_zombie', weight: 50, level: [12, 13] },
    ],
    connections: [{ to: 'f9_barrow_fields', ticks: 30, label: 'Out the North Gate', returnLabel: 'Back Through the North Gate' }],
  },
  f9_barrow_fields: {
    id: 'f9_barrow_fields',
    name: 'The Barrow Fields',
    icon: '🪦',
    areaId: 'ascent_f9_area',
    map: { x: 50, y: 40 },
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Walk the Barrows', icon: '⚔️' },
      { id: 'explore', kind: 'explore', name: 'Search the Barrows', icon: '🔍' },
    ],
    groupWeights: { 1: 60, 2: 30, 3: 10 },
    encounters: [
      { monsterId: 'slime_zombie', weight: 45, level: [13, 14] },
      { monsterId: 'living_doll', weight: 30, level: [13, 14] },
      { monsterId: 'death_knight', weight: 25, level: [13, 14] },
    ],
    exploreTicks: 300,
    finds: [
      { id: 'f9_barrow_salves', at: 0.3, material: { id: 'healing_salve', qty: 2 } },
      { id: 'f9_barrow_grave_gold', at: 1, gold: [100, 180] },
    ],
    connections: [{ to: 'f9_ossuary', ticks: 30, label: 'Into the Ossuary' }],
  },
  f9_ossuary: {
    id: 'f9_ossuary',
    name: 'The Ossuary',
    icon: '💀',
    areaId: 'ascent_f9_area',
    map: { x: 50, y: 70 },
    fightLimit: 1,
    modifierWeights: { normal: 100 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Enter the Ossuary', icon: '⚔️' }],
    encounters: [{ monsterId: 'death_knight', weight: 1, once: true, level: [15, 15] }],
    connections: [],
  },

  // --- Floor 10, east: the artificers' row and the quarry past it. Stand-in
  // threat: armour (automata, stone golems) that blunt weapons answer.
  f10_artificers_row: {
    id: 'f10_artificers_row',
    name: "The Artificers' Row",
    icon: '⚙️',
    areaId: 'ascent_f10_area',
    map: { x: 50, y: 10 },
    activities: [
      { id: 'camp_f10', kind: 'rest', name: 'Camp in a Workshop', icon: '🏕️' },
      { id: 'hunt', kind: 'hunt', name: 'Patrol the Row', icon: '⚔️' },
    ],
    groupWeights: { 1: 70, 2: 30 },
    encounters: [
      { monsterId: 'sorting_automaton', weight: 50, level: [12, 13] },
      { monsterId: 'filing_automaton', weight: 50, level: [12, 13] },
    ],
    connections: [{ to: 'f10_quarry', ticks: 30, label: 'Out the East Gate', returnLabel: 'Back Through the East Gate' }],
  },
  f10_quarry: {
    id: 'f10_quarry',
    name: 'The Quarry',
    icon: '⛏️',
    areaId: 'ascent_f10_area',
    map: { x: 50, y: 40 },
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Work the Quarry', icon: '⚔️' },
      { id: 'explore', kind: 'explore', name: 'Search the Spoil Heaps', icon: '🔍' },
    ],
    groupWeights: { 1: 70, 2: 30 },
    encounters: [
      { monsterId: 'filing_automaton', weight: 45, level: [13, 14] },
      { monsterId: 'sorting_automaton', weight: 35, level: [13, 14] },
      { monsterId: 'stone_golem', weight: 20, level: [13, 14] },
    ],
    exploreTicks: 300,
    finds: [
      { id: 'f10_quarry_ore', at: 0.3, material: { id: 'copper_ore', qty: 5 } },
      { id: 'f10_quarry_scrap', at: 0.6, material: { id: 'iron_scrap', qty: 5 } },
    ],
    connections: [{ to: 'f10_foundry', ticks: 30, label: 'Into the Foundry' }],
  },
  f10_foundry: {
    id: 'f10_foundry',
    name: 'The Foundry',
    icon: '🔥',
    areaId: 'ascent_f10_area',
    map: { x: 50, y: 70 },
    fightLimit: 1,
    modifierWeights: { normal: 100 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Enter the Foundry', icon: '⚔️' }],
    encounters: [{ monsterId: 'stone_golem', weight: 1, once: true, level: [14, 14] }],
    connections: [],
  },

  // ---------- The Ascent, floor 11: the stronghold (FLOOR_IDEAS.md §1.5) ----------
  //
  // A first climb: take the derelict stronghold, repair it through the
  // steward's two quests, then hold the wave on the wall. The eighth fight won
  // there ends the run (STRONGHOLD_HELD, an automatic prestige). Every later
  // run reads STRONGHOLD_KEY: the repairs and the wave are shut, the gatehouse
  // holds the door to the hold, and the road leads on to the harbor (the
  // HARBOR spots section below), whose roadstead convoy is the floor's
  // clear. Monsters are placeholders at floor 11's levels; no band step.
  f11_road: {
    id: 'f11_road',
    name: 'The Stronghold Road',
    icon: '🛤️',
    areaId: 'ascent_f11_area',
    map: { x: 50, y: 70 },
    activities: [
      { id: 'camp_f11', kind: 'rest', name: 'Camp by the Road', icon: '🏕️' },
      { id: 'hunt', kind: 'hunt', name: 'Clear the Road', icon: '⚔️' },
    ],
    groupWeights: { 1: 70, 2: 30 },
    encounters: [
      { monsterId: 'ph_siege_raider', weight: 70, level: [22, 23] },
      { monsterId: 'ph_siege_brute', weight: 30, level: [22, 23] },
    ],
    connections: [
      { to: 'f11_gatehouse', ticks: 30, label: 'Up to the Gatehouse', returnLabel: 'Down to the Road' },
      // The harbor side opens once the stronghold is yours (a later run).
      {
        to: 'f11_quay',
        ticks: 40,
        label: 'On to the Harbor',
        returnLabel: 'Back to the Road',
        revealWhen: [{ type: 'stat', key: 'legacy:stronghold', value: 1 }],
        requires: [{ type: 'stat', key: 'legacy:stronghold', value: 1 }],
      },
    ],
  },
  f11_gatehouse: {
    id: 'f11_gatehouse',
    name: 'The Gatehouse',
    icon: '🏯',
    areaId: 'ascent_f11_area',
    map: { x: 50, y: 60 },
    activities: [],
    connections: [
      { to: 'f11_yard', ticks: 20, label: 'Into the Yard', returnLabel: 'Back to the Gatehouse' },
      // The hold's door (FLOOR_IDEAS.md §5.3 item 9, towers.data.ts
      // OFF_LADDER_DOORS). OneWay both ways, so neither direction brings a
      // free mirror; the hold's own way back is authored on base_entrance.
      {
        to: 'base_entrance',
        ticks: 60,
        oneWay: true,
        label: 'the door to your hold',
        revealWhen: [{ type: 'stat', key: 'legacy:stronghold', value: 1 }],
        requires: [{ type: 'stat', key: 'legacy:stronghold', value: 1 }],
      },
    ],
  },
  f11_yard: {
    id: 'f11_yard',
    name: 'The Yard',
    icon: '🪵',
    areaId: 'ascent_f11_area',
    map: { x: 30, y: 40 },
    activities: [
      { id: 'gather_f11_timber', kind: 'gather', material: 'hardwood', ticksPer: 120, name: 'Salvage Timber', icon: '🪵' },
    ],
    connections: [
      // The wall is reachable only while the wave is armed and not yet held,
      // so nobody stands on it hunting an empty table (which spends banked
      // time on nothing). Hidden on every run after the stronghold.
      {
        to: 'f11_wall',
        ticks: 20,
        label: 'Up onto the Wall',
        returnLabel: 'Down to the Yard',
        revealWhen: [{ type: 'statMax', key: 'legacy:stronghold', value: 0 }],
        requires: [
          { type: 'quest', id: 'f11_arm_the_wall' },
          { type: 'statMax', key: 'legacy:stronghold', value: 0 },
        ],
      },
    ],
  },
  // The wave: eight fights, the last always the captain. Shut until both of
  // the steward's quests are done, and on every run after the stronghold.
  f11_wall: {
    id: 'f11_wall',
    name: 'The Wall',
    icon: '🧱',
    areaId: 'ascent_f11_area',
    map: { x: 70, y: 40 },
    fightLimit: 8,
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Hold the Wall', icon: '🛡️' }],
    groupWeights: { 2: 50, 3: 50 },
    encounters: [
      {
        monsterId: 'ph_siege_raider',
        weight: 60,
        level: [24, 25],
        requires: [
          { type: 'quest', id: 'f11_arm_the_wall' },
          { type: 'statMax', key: 'legacy:stronghold', value: 0 },
          { type: 'statMax', key: 'fights:f11_wall', value: 6 },
        ],
      },
      {
        monsterId: 'ph_siege_brute',
        weight: 40,
        level: [24, 25],
        requires: [
          { type: 'quest', id: 'f11_arm_the_wall' },
          { type: 'statMax', key: 'legacy:stronghold', value: 0 },
          { type: 'statMax', key: 'fights:f11_wall', value: 6 },
        ],
      },
      {
        monsterId: 'ph_siege_captain',
        weight: 1,
        level: [27, 27],
        requires: [
          { type: 'quest', id: 'f11_arm_the_wall' },
          { type: 'statMax', key: 'legacy:stronghold', value: 0 },
          { type: 'stat', key: 'fights:f11_wall', value: 7 },
        ],
      },
    ],
    // The postern: a one-way stair down to the road, so the yard wing has a
    // way back that is not the gate (the wing-loop rule).
    connections: [{ to: 'f11_road', ticks: 30, oneWay: true, label: 'Down the Postern Stair' }],
  },
  // ==== HARBOR: spots (skeleton 2026-10-30; the harbor builder's section) ====
  // Band 4, the harbor (docs/FLOOR_IDEAS.md §4 idea 3), at placeholder
  // fidelity. Ports are havens; the sea is the water spots between them, each
  // with a convoy (sea.data.ts CONVOYS, systems/sea.ts). A side is picked by
  // accepting a join quest on floor 11, and its stamp,
  // flag:quest:f11_join_<side>:accepted, decides which lanes, crews and wing
  // exist. Every water carries a line per side; a clear spot also carries one
  // for no side (the four stamps at 0), so its table never empties.
  // Named ships are `once` lines on floors 12 and 13.

  // ---------- Floor 11, the harbor (runs after the stronghold) ----------
  // The road's gated edge (f11_road, legacy:stronghold) leads here. The quay
  // is the haven and makes the battery's hold; four berths each hold a
  // recruiter; the roadstead is the floor's water and its clear.
  f11_quay: {
    id: 'f11_quay',
    name: 'The Quay',
    icon: '⚓',
    areaId: 'ascent_f11_area',
    map: { x: 70, y: 58 },
    activities: [{ id: 'camp_f11_quay', kind: 'rest', name: 'Rest at the Quay', icon: '🛏️' }],
    recipes: ['ship_cannon', 'cannonball', 'powder_charge'],
    connections: [
      { to: 'f11_merchant_berth', ticks: 20, label: 'To the Merchant Berth', returnLabel: 'Back to the Quay' },
      { to: 'f11_smugglers_berth', ticks: 20, label: 'To the Smugglers’ Berth', returnLabel: 'Back to the Quay' },
      { to: 'f11_privateer_berth', ticks: 20, label: 'To the Privateer Berth', returnLabel: 'Back to the Quay' },
      { to: 'f11_navy_berth', ticks: 20, label: 'To the Navy Berth', returnLabel: 'Back to the Quay' },
      { to: 'f11_roadstead', ticks: 30, label: 'Row Out to the Roadstead', returnLabel: 'Back to the Quay' },
    ],
  },
  f11_merchant_berth: {
    id: 'f11_merchant_berth',
    name: 'The Merchant Berth',
    icon: '⚖️',
    areaId: 'ascent_f11_area',
    map: { x: 92, y: 36 },
    activities: [],
    connections: [],
  },
  f11_smugglers_berth: {
    id: 'f11_smugglers_berth',
    name: 'The Smugglers’ Berth',
    icon: '🏴‍☠️',
    areaId: 'ascent_f11_area',
    map: { x: 92, y: 48 },
    activities: [],
    connections: [],
  },
  f11_privateer_berth: {
    id: 'f11_privateer_berth',
    name: 'The Privateer Berth',
    icon: '📜',
    areaId: 'ascent_f11_area',
    map: { x: 92, y: 60 },
    activities: [],
    connections: [],
  },
  f11_navy_berth: {
    id: 'f11_navy_berth',
    name: 'The Navy Berth',
    icon: '🎖️',
    areaId: 'ascent_f11_area',
    map: { x: 92, y: 72 },
    activities: [],
    connections: [],
  },
  f11_roadstead: {
    id: 'f11_roadstead',
    name: 'The Roadstead',
    icon: '⛵',
    areaId: 'ascent_f11_area',
    map: { x: 82, y: 20 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Sail With the Convoy', icon: '⚔️' }],
    groupWeights: { 1: 70, 2: 30 },
    encounters: [
      { monsterId: 'ph_pirate_cutthroat', weight: 35, level: [24, 26], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_gunner', weight: 15, level: [24, 26], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_reef_eel', weight: 35, level: [24, 26], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_deep_serpent', weight: 15, level: [24, 26], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_convoy_guard', weight: 60, level: [24, 26], requires: [{ type: 'stat', key: 'flag:quest:f11_join_pirates:accepted', value: 1 }] },
      { monsterId: 'ph_navy_marine', weight: 40, level: [24, 26], requires: [{ type: 'stat', key: 'flag:quest:f11_join_pirates:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_cutthroat', weight: 60, level: [24, 26], requires: [{ type: 'stat', key: 'flag:quest:f11_join_privateers:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_gunner', weight: 40, level: [24, 26], requires: [{ type: 'stat', key: 'flag:quest:f11_join_privateers:accepted', value: 1 }] },
      { monsterId: 'ph_reef_eel', weight: 60, level: [24, 26], requires: [{ type: 'stat', key: 'flag:quest:f11_join_navy:accepted', value: 1 }] },
      { monsterId: 'ph_deep_serpent', weight: 40, level: [24, 26], requires: [{ type: 'stat', key: 'flag:quest:f11_join_navy:accepted', value: 1 }] },
      // No side yet: sea monsters, and no convoy work until a side is picked.
      {
        monsterId: 'ph_reef_eel',
        weight: 1,
        level: [24, 25],
        requires: [
          { type: 'statMax', key: 'flag:quest:f11_join_merchants:accepted', value: 0 },
          { type: 'statMax', key: 'flag:quest:f11_join_pirates:accepted', value: 0 },
          { type: 'statMax', key: 'flag:quest:f11_join_privateers:accepted', value: 0 },
          { type: 'statMax', key: 'flag:quest:f11_join_navy:accepted', value: 0 },
        ],
      },
    ],
    connections: [],
  },

  // ---------- Floor 12, the crossings ----------
  // Two ports and the water between them. Sailing out of a port onto open
  // water is a boarding (`forced`); the way back is free. Each side has its own
  // long, weak lane (revealed by its stamp; the lane's way back from the isle
  // is authored oneWay with the same reveal, so no mirror shows another
  // side's lane); the strait is short and strong for every side; the pirates'
  // cove is hidden and cheap. The far water is the clear.
  f12_landing: {
    id: 'f12_landing',
    name: 'The Outer Port',
    icon: '⚓',
    areaId: 'ascent_f12_area',
    map: { x: 20, y: 60 },
    activities: [
      { id: 'camp_f12', kind: 'rest', name: 'Rest at the Outer Port', icon: '🛏️' },
      { id: 'explore', kind: 'explore', name: 'Search the Port', icon: '🔍' },
    ],
    exploreTicks: 300,
    finds: [{ id: 'f12_port_purse', at: 0.5, gold: [40, 80] }],
    connections: [
      { to: 'f12_strait', ticks: 30, forced: true, label: 'Through the Strait', returnLabel: 'Back to the Outer Port' },
      {
        to: 'f12_trade_lane',
        ticks: 90,
        forced: true,
        revealWhen: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }],
        label: 'Out the Trade Lane',
        returnLabel: 'Back to the Outer Port',
      },
      {
        to: 'f12_hidden_cove',
        ticks: 45,
        forced: true,
        hidden: true,
        revealWhen: [{ type: 'stat', key: 'flag:quest:f11_join_pirates:accepted', value: 1 }],
        label: 'Into the Hidden Cove',
        returnLabel: 'Back to the Outer Port',
      },
      {
        to: 'f12_hunting_ground',
        ticks: 90,
        forced: true,
        revealWhen: [{ type: 'stat', key: 'flag:quest:f11_join_privateers:accepted', value: 1 }],
        label: 'Out to the Hunting Ground',
        returnLabel: 'Back to the Outer Port',
      },
      {
        to: 'f12_patrol_lane',
        ticks: 90,
        forced: true,
        revealWhen: [{ type: 'stat', key: 'flag:quest:f11_join_navy:accepted', value: 1 }],
        label: 'Out the Patrol Lane',
        returnLabel: 'Back to the Outer Port',
      },
    ],
  },
  f12_strait: {
    id: 'f12_strait',
    name: 'The Strait',
    icon: '🌊',
    areaId: 'ascent_f12_area',
    map: { x: 45, y: 50 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Sail With the Convoy', icon: '⚔️' }],
    groupWeights: { 1: 50, 2: 50 },
    encounters: [
      { monsterId: 'ph_pirate_cutthroat', weight: 35, level: [28, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_gunner', weight: 15, level: [28, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_reef_eel', weight: 35, level: [28, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_deep_serpent', weight: 15, level: [28, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_captain', weight: 8, once: true, level: [30, 30], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_convoy_guard', weight: 50, level: [28, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_pirates:accepted', value: 1 }] },
      { monsterId: 'ph_navy_marine', weight: 50, level: [28, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_pirates:accepted', value: 1 }] },
      { monsterId: 'ph_navy_frigate', weight: 8, once: true, level: [30, 30], requires: [{ type: 'stat', key: 'flag:quest:f11_join_pirates:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_cutthroat', weight: 50, level: [28, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_privateers:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_gunner', weight: 50, level: [28, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_privateers:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_captain', weight: 8, once: true, level: [30, 30], requires: [{ type: 'stat', key: 'flag:quest:f11_join_privateers:accepted', value: 1 }] },
      { monsterId: 'ph_reef_eel', weight: 50, level: [28, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_navy:accepted', value: 1 }] },
      { monsterId: 'ph_deep_serpent', weight: 50, level: [28, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_navy:accepted', value: 1 }] },
      { monsterId: 'ph_brood_matron', weight: 8, once: true, level: [30, 30], requires: [{ type: 'stat', key: 'flag:quest:f11_join_navy:accepted', value: 1 }] },
    ],
    connections: [{ to: 'f12_isle', ticks: 30, label: 'On to the Isle Anchorage', returnLabel: 'Back Through the Strait' }],
  },
  f12_trade_lane: {
    id: 'f12_trade_lane',
    name: 'The Trade Lane',
    icon: '🌊',
    areaId: 'ascent_f12_area',
    map: { x: 40, y: 72 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Sail With the Convoy', icon: '⚔️' }],
    groupWeights: { 1: 80, 2: 20 },
    encounters: [
      { monsterId: 'ph_pirate_cutthroat', weight: 35, level: [25, 27] },
      { monsterId: 'ph_pirate_gunner', weight: 15, level: [25, 27] },
      { monsterId: 'ph_reef_eel', weight: 35, level: [25, 27] },
      { monsterId: 'ph_deep_serpent', weight: 15, level: [25, 27] },
    ],
    connections: [{ to: 'f12_isle', ticks: 90, oneWay: true, label: 'On to the Isle Anchorage' }],
  },
  f12_hidden_cove: {
    id: 'f12_hidden_cove',
    name: 'The Hidden Cove',
    icon: '🌊',
    areaId: 'ascent_f12_area',
    map: { x: 25, y: 35 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Lie in Wait for the Convoy', icon: '⚔️' }],
    groupWeights: { 1: 90, 2: 10 },
    encounters: [
      { monsterId: 'ph_convoy_guard', weight: 80, level: [24, 26] },
      { monsterId: 'ph_navy_marine', weight: 20, level: [24, 26] },
    ],
    connections: [{ to: 'f12_isle', ticks: 60, oneWay: true, label: 'On to the Isle Anchorage' }],
  },
  f12_hunting_ground: {
    id: 'f12_hunting_ground',
    name: 'The Hunting Ground',
    icon: '🌊',
    areaId: 'ascent_f12_area',
    map: { x: 55, y: 72 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Hunt the Pirates', icon: '⚔️' }],
    groupWeights: { 1: 80, 2: 20 },
    encounters: [
      { monsterId: 'ph_pirate_cutthroat', weight: 60, level: [25, 27] },
      { monsterId: 'ph_pirate_gunner', weight: 40, level: [25, 27] },
    ],
    connections: [{ to: 'f12_isle', ticks: 90, oneWay: true, label: 'On to the Isle Anchorage' }],
  },
  f12_patrol_lane: {
    id: 'f12_patrol_lane',
    name: 'The Patrol Lane',
    icon: '🌊',
    areaId: 'ascent_f12_area',
    map: { x: 40, y: 28 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Escort the Convoy', icon: '⚔️' }],
    groupWeights: { 1: 80, 2: 20 },
    encounters: [
      { monsterId: 'ph_reef_eel', weight: 60, level: [25, 27] },
      { monsterId: 'ph_deep_serpent', weight: 40, level: [25, 27] },
    ],
    connections: [{ to: 'f12_isle', ticks: 90, oneWay: true, label: 'On to the Isle Anchorage' }],
  },
  f12_isle: {
    id: 'f12_isle',
    name: 'The Isle Anchorage',
    icon: '⚓',
    areaId: 'ascent_f12_area',
    map: { x: 70, y: 50 },
    activities: [{ id: 'camp_f12_isle', kind: 'rest', name: 'Rest at the Anchorage', icon: '🛏️' }],
    connections: [
      { to: 'f12_far_water', ticks: 60, forced: true, label: 'Out to the Far Water', returnLabel: 'Back to the Isle Anchorage' },
      {
        to: 'f12_trade_lane',
        ticks: 90,
        oneWay: true,
        revealWhen: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }],
        label: 'Back Out the Trade Lane',
      },
      {
        to: 'f12_hidden_cove',
        ticks: 60,
        oneWay: true,
        revealWhen: [{ type: 'stat', key: 'flag:quest:f11_join_pirates:accepted', value: 1 }],
        label: 'Back to the Hidden Cove',
      },
      {
        to: 'f12_hunting_ground',
        ticks: 90,
        oneWay: true,
        revealWhen: [{ type: 'stat', key: 'flag:quest:f11_join_privateers:accepted', value: 1 }],
        label: 'Back Out to the Hunting Ground',
      },
      {
        to: 'f12_patrol_lane',
        ticks: 90,
        oneWay: true,
        revealWhen: [{ type: 'stat', key: 'flag:quest:f11_join_navy:accepted', value: 1 }],
        label: 'Back Out the Patrol Lane',
      },
    ],
  },
  f12_far_water: {
    id: 'f12_far_water',
    name: 'The Far Water',
    icon: '🌊',
    areaId: 'ascent_f12_area',
    map: { x: 90, y: 40 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Sail With the Convoy', icon: '⚔️' }],
    groupWeights: { 1: 60, 2: 40 },
    encounters: [
      { monsterId: 'ph_pirate_cutthroat', weight: 35, level: [27, 28], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_gunner', weight: 15, level: [27, 28], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_reef_eel', weight: 35, level: [27, 28], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_deep_serpent', weight: 15, level: [27, 28], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_captain', weight: 8, once: true, level: [29, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_convoy_guard', weight: 50, level: [27, 28], requires: [{ type: 'stat', key: 'flag:quest:f11_join_pirates:accepted', value: 1 }] },
      { monsterId: 'ph_navy_marine', weight: 50, level: [27, 28], requires: [{ type: 'stat', key: 'flag:quest:f11_join_pirates:accepted', value: 1 }] },
      { monsterId: 'ph_navy_frigate', weight: 8, once: true, level: [29, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_pirates:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_cutthroat', weight: 50, level: [27, 28], requires: [{ type: 'stat', key: 'flag:quest:f11_join_privateers:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_gunner', weight: 50, level: [27, 28], requires: [{ type: 'stat', key: 'flag:quest:f11_join_privateers:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_captain', weight: 8, once: true, level: [29, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_privateers:accepted', value: 1 }] },
      { monsterId: 'ph_reef_eel', weight: 50, level: [27, 28], requires: [{ type: 'stat', key: 'flag:quest:f11_join_navy:accepted', value: 1 }] },
      { monsterId: 'ph_deep_serpent', weight: 50, level: [27, 28], requires: [{ type: 'stat', key: 'flag:quest:f11_join_navy:accepted', value: 1 }] },
      { monsterId: 'ph_brood_matron', weight: 8, once: true, level: [29, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_navy:accepted', value: 1 }] },
      {
        monsterId: 'ph_reef_eel',
        weight: 1,
        level: [27, 28],
        requires: [
          { type: 'statMax', key: 'flag:quest:f11_join_merchants:accepted', value: 0 },
          { type: 'statMax', key: 'flag:quest:f11_join_pirates:accepted', value: 0 },
          { type: 'statMax', key: 'flag:quest:f11_join_privateers:accepted', value: 0 },
          { type: 'statMax', key: 'flag:quest:f11_join_navy:accepted', value: 0 },
        ],
      },
    ],
    connections: [],
  },

  // ---------- Floor 13, the blockade ----------
  // The Last Port, the picket line and the blockade (the clear). The way in
  // sets the approach: through the picket line the player arrives
  // Flat-Footed; through the Pilot's Channel, open once the pilot's passage
  // is bought (shop:buys:f13_pilot), the blockaders start Surprised.
  f13_landing: {
    id: 'f13_landing',
    name: 'The Last Port',
    icon: '⚓',
    areaId: 'ascent_f13_area',
    map: { x: 20, y: 55 },
    activities: [{ id: 'camp_f13', kind: 'rest', name: 'Rest at the Last Port', icon: '🛏️' }],
    connections: [
      { to: 'f13_picket', ticks: 40, forced: true, label: 'Out to the Picket Line', returnLabel: 'Back to the Last Port' },
      {
        to: 'f13_blockade',
        ticks: 60,
        forced: true,
        requires: [{ type: 'stat', key: 'shop:buys:f13_pilot', value: 1 }],
        approach: { enemies: [{ id: 'surprised' }] },
        label: 'The Pilot’s Channel',
        returnLabel: 'Back to the Last Port',
      },
    ],
  },
  f13_picket: {
    id: 'f13_picket',
    name: 'The Picket Line',
    icon: '🌊',
    areaId: 'ascent_f13_area',
    map: { x: 50, y: 38 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Sail With the Convoy', icon: '⚔️' }],
    groupWeights: { 1: 60, 2: 40 },
    encounters: [
      { monsterId: 'ph_pirate_cutthroat', weight: 35, level: [28, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_gunner', weight: 15, level: [28, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_reef_eel', weight: 35, level: [28, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_deep_serpent', weight: 15, level: [28, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_captain', weight: 8, once: true, level: [30, 30], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_convoy_guard', weight: 50, level: [28, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_pirates:accepted', value: 1 }] },
      { monsterId: 'ph_navy_marine', weight: 50, level: [28, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_pirates:accepted', value: 1 }] },
      { monsterId: 'ph_navy_frigate', weight: 8, once: true, level: [30, 30], requires: [{ type: 'stat', key: 'flag:quest:f11_join_pirates:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_cutthroat', weight: 50, level: [28, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_privateers:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_gunner', weight: 50, level: [28, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_privateers:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_captain', weight: 8, once: true, level: [30, 30], requires: [{ type: 'stat', key: 'flag:quest:f11_join_privateers:accepted', value: 1 }] },
      { monsterId: 'ph_reef_eel', weight: 50, level: [28, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_navy:accepted', value: 1 }] },
      { monsterId: 'ph_deep_serpent', weight: 50, level: [28, 29], requires: [{ type: 'stat', key: 'flag:quest:f11_join_navy:accepted', value: 1 }] },
      { monsterId: 'ph_brood_matron', weight: 8, once: true, level: [30, 30], requires: [{ type: 'stat', key: 'flag:quest:f11_join_navy:accepted', value: 1 }] },
    ],
    connections: [
      {
        to: 'f13_blockade',
        ticks: 40,
        forced: true,
        approach: { self: [{ id: 'flat_footed' }] },
        label: 'Run the Blockade',
        returnLabel: 'Back to the Picket Line',
      },
    ],
  },
  f13_blockade: {
    id: 'f13_blockade',
    name: 'The Blockade',
    icon: '🌊',
    areaId: 'ascent_f13_area',
    map: { x: 80, y: 50 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Sail With the Convoy', icon: '⚔️' }],
    groupWeights: { 1: 40, 2: 60 },
    encounters: [
      { monsterId: 'ph_pirate_cutthroat', weight: 35, level: [30, 31], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_gunner', weight: 15, level: [30, 31], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_reef_eel', weight: 35, level: [30, 31], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_deep_serpent', weight: 15, level: [30, 31], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_captain', weight: 8, once: true, level: [32, 32], requires: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }] },
      { monsterId: 'ph_convoy_guard', weight: 50, level: [30, 31], requires: [{ type: 'stat', key: 'flag:quest:f11_join_pirates:accepted', value: 1 }] },
      { monsterId: 'ph_navy_marine', weight: 50, level: [30, 31], requires: [{ type: 'stat', key: 'flag:quest:f11_join_pirates:accepted', value: 1 }] },
      { monsterId: 'ph_navy_frigate', weight: 8, once: true, level: [32, 32], requires: [{ type: 'stat', key: 'flag:quest:f11_join_pirates:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_cutthroat', weight: 50, level: [30, 31], requires: [{ type: 'stat', key: 'flag:quest:f11_join_privateers:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_gunner', weight: 50, level: [30, 31], requires: [{ type: 'stat', key: 'flag:quest:f11_join_privateers:accepted', value: 1 }] },
      { monsterId: 'ph_pirate_captain', weight: 8, once: true, level: [32, 32], requires: [{ type: 'stat', key: 'flag:quest:f11_join_privateers:accepted', value: 1 }] },
      { monsterId: 'ph_reef_eel', weight: 50, level: [30, 31], requires: [{ type: 'stat', key: 'flag:quest:f11_join_navy:accepted', value: 1 }] },
      { monsterId: 'ph_deep_serpent', weight: 50, level: [30, 31], requires: [{ type: 'stat', key: 'flag:quest:f11_join_navy:accepted', value: 1 }] },
      { monsterId: 'ph_brood_matron', weight: 8, once: true, level: [32, 32], requires: [{ type: 'stat', key: 'flag:quest:f11_join_navy:accepted', value: 1 }] },
      {
        monsterId: 'ph_reef_eel',
        weight: 1,
        level: [30, 31],
        requires: [
          { type: 'statMax', key: 'flag:quest:f11_join_merchants:accepted', value: 0 },
          { type: 'statMax', key: 'flag:quest:f11_join_pirates:accepted', value: 0 },
          { type: 'statMax', key: 'flag:quest:f11_join_privateers:accepted', value: 0 },
          { type: 'statMax', key: 'flag:quest:f11_join_navy:accepted', value: 0 },
        ],
      },
    ],
    connections: [],
  },

  // ---------- Floor 14, the final mission ----------
  // One floor, four wings, one per side; a wing exists only for its side's
  // stamp. Each wing is a water with an endless hunt and the mission boss's
  // spot. The boss's kill stamps flag:sea:14:done (systems/sea.ts), which is
  // the floor's clear. The way into the boss spot carries the side's
  // preparation: turned in, the boss and its escorts start the fight with a
  // condition. Spine-lint exempt: the clear names no spot.
  f14_landing: {
    id: 'f14_landing',
    name: 'The Staging Anchorage',
    icon: '⚓',
    areaId: 'ascent_f14_area',
    map: { x: 50, y: 62 },
    activities: [{ id: 'camp_f14', kind: 'rest', name: 'Rest at the Anchorage', icon: '🛏️' }],
    connections: [
      {
        to: 'f14_closed_port_roads',
        ticks: 60,
        forced: true,
        revealWhen: [{ type: 'stat', key: 'flag:quest:f11_join_merchants:accepted', value: 1 }],
        label: 'Make for the Closed Port',
        returnLabel: 'Back to the Anchorage',
      },
      {
        to: 'f14_galleon_track',
        ticks: 60,
        forced: true,
        revealWhen: [{ type: 'stat', key: 'flag:quest:f11_join_pirates:accepted', value: 1 }],
        label: 'Shadow the Treasure Galleon',
        returnLabel: 'Back to the Anchorage',
      },
      {
        to: 'f14_kings_reef',
        ticks: 60,
        forced: true,
        revealWhen: [{ type: 'stat', key: 'flag:quest:f11_join_privateers:accepted', value: 1 }],
        label: 'Make for the King’s Reef',
        returnLabel: 'Back to the Anchorage',
      },
      {
        to: 'f14_beast_grounds',
        ticks: 60,
        forced: true,
        revealWhen: [{ type: 'stat', key: 'flag:quest:f11_join_navy:accepted', value: 1 }],
        label: 'Out to the Beast’s Grounds',
        returnLabel: 'Back to the Anchorage',
      },
    ],
  },
  // The merchants' wing: land the charter cargo past the closed port.
  f14_closed_port_roads: {
    id: 'f14_closed_port_roads',
    name: 'The Closed Port’s Roads',
    icon: '🌊',
    areaId: 'ascent_f14_area',
    map: { x: 20, y: 40 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Fight Off the Raiders', icon: '⚔️' }],
    groupWeights: { 1: 50, 2: 50 },
    encounters: [
      { monsterId: 'ph_pirate_cutthroat', weight: 40, level: [30, 32] },
      { monsterId: 'ph_pirate_gunner', weight: 30, level: [30, 32] },
      { monsterId: 'ph_deep_serpent', weight: 30, level: [30, 32] },
    ],
    connections: [
      {
        to: 'f14_closed_port',
        ticks: 30,
        approach: {
          requires: [{ type: 'quest', id: 'f11_merchants_clearance' }],
          enemies: [{ id: 'flat_footed' }],
        },
        label: 'Run In to the Closed Port',
        returnLabel: 'Back to the Roads',
      },
    ],
  },
  f14_closed_port: {
    id: 'f14_closed_port',
    name: 'The Closed Port',
    icon: '🚧',
    areaId: 'ascent_f14_area',
    map: { x: 10, y: 20 },
    fightLimit: 1,
    modifierWeights: { normal: 100 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Land the Charter Cargo', icon: '⚔️' }],
    encounters: [{ monsterId: 'ph_port_warden', weight: 1, once: true, level: [33, 33] }],
    connections: [],
  },
  // The pirates' wing: board the treasure galleon.
  f14_galleon_track: {
    id: 'f14_galleon_track',
    name: 'The Galleon’s Track',
    icon: '🌊',
    areaId: 'ascent_f14_area',
    map: { x: 40, y: 30 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Pick Off the Escort', icon: '⚔️' }],
    groupWeights: { 1: 50, 2: 50 },
    encounters: [
      { monsterId: 'ph_convoy_guard', weight: 40, level: [30, 32] },
      { monsterId: 'ph_navy_marine', weight: 60, level: [30, 32] },
    ],
    connections: [
      {
        to: 'f14_treasure_galleon',
        ticks: 30,
        approach: {
          requires: [{ type: 'quest', id: 'f11_pirates_signal' }],
          enemies: [{ id: 'surprised' }],
        },
        label: 'Board the Treasure Galleon',
        returnLabel: 'Back to the Galleon’s Track',
      },
    ],
  },
  f14_treasure_galleon: {
    id: 'f14_treasure_galleon',
    name: 'The Treasure Galleon',
    icon: '💰',
    areaId: 'ascent_f14_area',
    map: { x: 35, y: 10 },
    fightLimit: 1,
    modifierWeights: { normal: 100 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Take the Galleon', icon: '⚔️' }],
    encounters: [{ monsterId: 'ph_galleon_master', weight: 1, once: true, level: [33, 33] }],
    connections: [],
  },
  // The privateers' wing: take the pirate king's flagship as a prize.
  f14_kings_reef: {
    id: 'f14_kings_reef',
    name: 'The King’s Reef',
    icon: '🌊',
    areaId: 'ascent_f14_area',
    map: { x: 65, y: 30 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Hunt the King’s Crews', icon: '⚔️' }],
    groupWeights: { 1: 50, 2: 50 },
    encounters: [
      { monsterId: 'ph_pirate_cutthroat', weight: 40, level: [30, 32] },
      { monsterId: 'ph_pirate_gunner', weight: 60, level: [30, 32] },
    ],
    connections: [
      {
        to: 'f14_flagship',
        ticks: 30,
        approach: {
          requires: [{ type: 'quest', id: 'f11_privateers_letter' }],
          enemies: [{ id: 'flat_footed' }],
        },
        label: 'Board the Flagship',
        returnLabel: 'Back to the King’s Reef',
      },
    ],
  },
  f14_flagship: {
    id: 'f14_flagship',
    name: 'The Pirate King’s Flagship',
    icon: '👑',
    areaId: 'ascent_f14_area',
    map: { x: 70, y: 10 },
    fightLimit: 1,
    modifierWeights: { normal: 100 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Take the Flagship', icon: '⚔️' }],
    encounters: [{ monsterId: 'ph_pirate_king', weight: 1, once: true, level: [33, 33] }],
    connections: [],
  },
  // The navy's wing: kill the sea beast that closes the lanes.
  f14_beast_grounds: {
    id: 'f14_beast_grounds',
    name: 'The Beast’s Grounds',
    icon: '🌊',
    areaId: 'ascent_f14_area',
    map: { x: 85, y: 45 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Cull the Brood', icon: '⚔️' }],
    groupWeights: { 1: 50, 2: 50 },
    encounters: [
      { monsterId: 'ph_reef_eel', weight: 40, level: [30, 32] },
      { monsterId: 'ph_deep_serpent', weight: 60, level: [30, 32] },
    ],
    connections: [
      {
        to: 'f14_beast_lair',
        ticks: 30,
        approach: {
          requires: [{ type: 'quest', id: 'f11_navy_lure' }],
          enemies: [{ id: 'surprised' }],
        },
        label: 'Down to the Beast’s Lair',
        returnLabel: 'Back to the Grounds',
      },
    ],
  },
  f14_beast_lair: {
    id: 'f14_beast_lair',
    name: 'The Beast’s Lair',
    icon: '🐋',
    areaId: 'ascent_f14_area',
    map: { x: 92, y: 22 },
    fightLimit: 1,
    modifierWeights: { normal: 100 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Fight the Sea Beast', icon: '⚔️' }],
    encounters: [{ monsterId: 'ph_sea_beast', weight: 1, once: true, level: [33, 33] }],
    connections: [],
  },

  // ==== FESTIVAL: spots (skeleton 2026-10-30; the festival builder's section) ====
  // The Vermin Festival: floors 15–16 (§5.3 items 6, 10–20, 23–25). Nothing
  // here rolls its encounter table: systems/festival.ts stages every fight
  // (data/festival.data.ts holds the waves and the field's dials). The tables
  // are what the bestiary and the lints read. Placeholder monsters.
  f15_dark_room: {
    id: 'f15_dark_room',
    name: 'The Dark Room',
    icon: '🌑',
    areaId: 'ascent_f15_area',
    map: { x: 25, y: 45 },
    tags: ['indoor'],
    activities: [],
    encounters: [
      { monsterId: 'ph_room_brawler', weight: 50, level: [32, 33] },
      { monsterId: 'ph_room_bruiser', weight: 50, level: [32, 33] },
      // The last of the nine, fought alone: floor 15's clear.
      { monsterId: 'ph_room_last', weight: 1, level: [35, 35], boss: true },
    ],
    // The door opens when the room is empty, and shuts again at the start of
    // the next attempt (festival:door, systems/festival.ts).
    connections: [
      {
        to: 'f15_hall',
        ticks: 20,
        label: 'Through the Door',
        returnLabel: 'Back to the Dark Room',
        revealWhen: [{ type: 'stat', key: 'festival:door', value: 1 }],
        requires: [{ type: 'stat', key: 'festival:door', value: 1 }],
      },
    ],
  },
  // The hub: ten festival days with what the hall and the stores hold.
  f15_hall: {
    id: 'f15_hall',
    name: 'The Survivors’ Hall',
    icon: '🏮',
    areaId: 'ascent_f15_area',
    map: { x: 55, y: 45 },
    tags: ['indoor'],
    activities: [
      { id: 'rest_f15_hall', kind: 'rest', name: 'Sleep on the Benches', icon: '🛏️' },
      { id: 'train_f15_drill', kind: 'train', attr: 'str', name: 'Drill With the Others', icon: '🤺' },
      { id: 'train_f15_spar', kind: 'train', attr: 'dex', name: 'Spar Between the Benches', icon: '🥊' },
    ],
    benches: ['cooking'],
    connections: [{ to: 'f15_stores', ticks: 15, label: 'To the Stores', returnLabel: 'Back to the Hall' }],
  },
  // Limited by its search: the limits restart with every attempt.
  f15_stores: {
    id: 'f15_stores',
    name: 'The Ration Stores',
    icon: '📦',
    areaId: 'ascent_f15_area',
    map: { x: 78, y: 35 },
    tags: ['indoor'],
    activities: [
      {
        id: 'search_f15_stores',
        kind: 'search',
        name: 'Search the Stores',
        icon: '🔍',
        ticksPer: 120,
        rewards: [
          { id: 'rations', weight: 3, limit: 3, material: { id: 'travelers_ration', qty: 2 } },
          { id: 'meat', weight: 2, limit: 2, material: { id: 'raw_meat', qty: 3 } },
          { id: 'salve', weight: 2, limit: 2, material: { id: 'healing_salve', qty: 1 } },
        ],
      },
    ],
    connections: [],
  },
  // Floor 16: the royale's field (systems/royale.ts). Empty outside an attempt.
  f16_arena: {
    id: 'f16_arena',
    name: 'The Royale Field',
    icon: '🏟️',
    areaId: 'ascent_f16_area',
    map: { x: 50, y: 40 },
    activities: [],
    encounters: [
      { monsterId: 'ph_survivor_blade', weight: 50, level: [34, 38] },
      { monsterId: 'ph_survivor_brute', weight: 50, level: [34, 38] },
      // The field's last survivor, fought alone once every other has fallen:
      // floor 16's clear.
      { monsterId: 'ph_survivor_champion', weight: 1, level: [38, 39], boss: true },
    ],
    connections: [],
  },

  // ==== ABERRANT: spots (skeleton 2026-10-30; the aberrant builder's section) ====
  // Floor 17, the aberrant floor (theme parked). Two spots a floor, placeholder monsters.
  f17_landing: {
    id: 'f17_landing',
    name: 'Floor 17',
    icon: '🏕️',
    areaId: 'ascent_f17_area',
    map: { x: 50, y: 65 },
    activities: [
      { id: 'camp_f17', kind: 'rest', name: 'Camp', icon: '🏕️' },
      { id: 'hunt', kind: 'hunt', name: 'Hunt', icon: '⚔️' },
    ],
    groupWeights: { 1: 70, 2: 30 },
    encounters: [
      { monsterId: 'ph_siege_raider', weight: 70, level: [36, 37] },
      { monsterId: 'ph_siege_brute', weight: 30, level: [36, 37] },
    ],
    connections: [{ to: 'f17_keeper', ticks: 30, label: 'To the Keeper' }],
  },
  f17_keeper: {
    id: 'f17_keeper',
    name: 'The Keeper of Floor 17',
    icon: '💀',
    areaId: 'ascent_f17_area',
    map: { x: 50, y: 25 },
    fightLimit: 1,
    modifierWeights: { normal: 100 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Fight the Keeper', icon: '⚔️' }],
    encounters: [{ monsterId: 'ph_siege_captain', weight: 1, level: [39, 39] }],
    connections: [],
  },

  // ==== DESERT: spots (skeleton 2026-10-30; the desert builder's section) ====
  // Band 5, the desert: floors 18–20 (FLOOR_IDEAS.md §4), placeholder
  // fidelity. Every hunt is endless except the roadstead's one fight, and
  // every species is tagged `desert`, so any den pays the next floor's gate.
  // Havens: the well-head, the five obelisks, the causeway, the river road
  // and the quay (L3: a knockout lands at the last one visited).

  // --- Floor 18: the Necropolis Road. Obelisk to obelisk up the road to the
  // forecourt. Each obelisk read is a find that bumps flag:chart; three or
  // more leave floor 20's roadstead crew surprised. The forecourt guardian
  // is a boss row with no fightLimit: the clear, and repeatable.
  f18_well_head: {
    id: 'f18_well_head',
    name: 'The Well-Head',
    icon: '🪣',
    areaId: 'ascent_f18_area',
    map: { x: 50, y: 70 },
    activities: [{ id: 'camp_f18', kind: 'rest', name: 'Rest at the Well-Head', icon: '🏕️' }],
    connections: [{ to: 'f18_first_obelisk', ticks: 25 }],
  },
  f18_first_obelisk: {
    id: 'f18_first_obelisk',
    name: 'The First Obelisk',
    icon: '🗿',
    areaId: 'ascent_f18_area',
    map: { x: 50, y: 60 },
    activities: [
      { id: 'rest_f18_obelisk_1', kind: 'rest', name: 'Rest in the Shade', icon: '🛏️' },
      { id: 'explore', kind: 'explore', name: 'Read the Obelisk', icon: '📜' },
    ],
    exploreTicks: 180,
    finds: [{ id: 'f18_read_first', at: 1, stat: { key: 'flag:chart' } }],
    connections: [{ to: 'f18_dune_den', ticks: 30 }],
  },
  f18_dune_den: {
    id: 'f18_dune_den',
    name: 'The Dunes',
    icon: '🏜️',
    areaId: 'ascent_f18_area',
    map: { x: 32, y: 50 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Hunt the Dunes', icon: '🏹' }],
    groupWeights: { 1: 55, 2: 30, 3: 15 },
    encounters: [
      { monsterId: 'ph_scarab', weight: 45, level: [38, 39] },
      { monsterId: 'ph_cobra', weight: 35, level: [38, 39] },
      { monsterId: 'ph_scorpion', weight: 20, level: [38, 39] },
    ],
    connections: [{ to: 'f18_second_obelisk', ticks: 30 }],
  },
  f18_second_obelisk: {
    id: 'f18_second_obelisk',
    name: 'The Second Obelisk',
    icon: '🗿',
    areaId: 'ascent_f18_area',
    map: { x: 50, y: 40 },
    activities: [
      { id: 'rest_f18_obelisk_2', kind: 'rest', name: 'Rest in the Shade', icon: '🛏️' },
      { id: 'explore', kind: 'explore', name: 'Read the Obelisk', icon: '📜' },
    ],
    exploreTicks: 180,
    finds: [{ id: 'f18_read_second', at: 1, stat: { key: 'flag:chart' } }],
    connections: [
      { to: 'f18_tomb_row', ticks: 30 },
      { to: 'f18_salt_flat', ticks: 35 },
    ],
  },
  // A wing of two off the second obelisk: rock salt and a fourth obelisk.
  f18_salt_flat: {
    id: 'f18_salt_flat',
    name: 'The Salt Flat',
    icon: '🧂',
    areaId: 'ascent_f18_area',
    map: { x: 78, y: 46 },
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Hunt the Flat', icon: '🏹' },
      { id: 'gather_f18_salt', kind: 'gather', material: 'rock_salt', ticksPer: 120, name: 'Cut Rock Salt', icon: '🧂' },
    ],
    groupWeights: { 1: 65, 2: 35 },
    encounters: [
      { monsterId: 'ph_scorpion', weight: 60, level: [38, 40] },
      { monsterId: 'ph_cobra', weight: 40, level: [38, 40] },
    ],
    connections: [{ to: 'f18_fourth_obelisk', ticks: 30 }],
  },
  f18_fourth_obelisk: {
    id: 'f18_fourth_obelisk',
    name: 'The Fourth Obelisk',
    icon: '🗿',
    areaId: 'ascent_f18_area',
    map: { x: 90, y: 30 },
    activities: [
      { id: 'rest_f18_obelisk_4', kind: 'rest', name: 'Rest in the Shade', icon: '🛏️' },
      { id: 'explore', kind: 'explore', name: 'Read the Obelisk', icon: '📜' },
    ],
    exploreTicks: 180,
    finds: [{ id: 'f18_read_fourth', at: 1, stat: { key: 'flag:chart' } }],
    connections: [],
  },
  f18_tomb_row: {
    id: 'f18_tomb_row',
    name: 'The Tomb Row',
    icon: '⚰️',
    areaId: 'ascent_f18_area',
    map: { x: 32, y: 28 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Clear the Tomb Row', icon: '⚔️' }],
    groupWeights: { 1: 60, 2: 30, 3: 10 },
    encounters: [
      { monsterId: 'ph_mummy', weight: 60, level: [39, 40] },
      { monsterId: 'ph_scarab', weight: 40, level: [39, 40] },
    ],
    connections: [
      { to: 'f18_third_obelisk', ticks: 30 },
      { to: 'f18_fifth_obelisk', ticks: 30 },
    ],
  },
  f18_fifth_obelisk: {
    id: 'f18_fifth_obelisk',
    name: 'The Fifth Obelisk',
    icon: '🗿',
    areaId: 'ascent_f18_area',
    map: { x: 10, y: 20 },
    activities: [
      { id: 'rest_f18_obelisk_5', kind: 'rest', name: 'Rest in the Shade', icon: '🛏️' },
      { id: 'explore', kind: 'explore', name: 'Read the Obelisk', icon: '📜' },
    ],
    exploreTicks: 180,
    finds: [{ id: 'f18_read_fifth', at: 1, stat: { key: 'flag:chart' } }],
    connections: [],
  },
  f18_third_obelisk: {
    id: 'f18_third_obelisk',
    name: 'The Third Obelisk',
    icon: '🗿',
    areaId: 'ascent_f18_area',
    map: { x: 50, y: 18 },
    activities: [
      { id: 'rest_f18_obelisk_3', kind: 'rest', name: 'Rest in the Shade', icon: '🛏️' },
      { id: 'explore', kind: 'explore', name: 'Read the Obelisk', icon: '📜' },
    ],
    exploreTicks: 180,
    finds: [{ id: 'f18_read_third', at: 1, stat: { key: 'flag:chart' } }],
    connections: [{ to: 'f18_forecourt', ticks: 30, label: 'Into the Forecourt', returnLabel: 'Back to the Obelisk' }],
  },
  f18_forecourt: {
    id: 'f18_forecourt',
    name: 'The Forecourt',
    icon: '🏛️',
    areaId: 'ascent_f18_area',
    map: { x: 50, y: 6 },
    modifierWeights: { normal: 100 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Fight the Guardian', icon: '⚔️' }],
    encounters: [{ monsterId: 'ph_sand_colossus', weight: 1, boss: true, level: [41, 41] }],
    connections: [],
  },

  // --- Floor 19: the Pyramid, the Weighing. The treasury's six grave goods
  // each bump flag:tomb:taken and each requires boss:f19_door at 0, so the
  // tomb seals when the judge first falls and `taken` always prices the
  // judge the clear is paid with. The goods sit in their own room: exploring
  // the chamber takes nothing. The judge is one boss row with levelRise
  // (levels.ts encounterLevel): base 33, share 0.1 (6 × 0.1 < 1), ceiling 45,
  // the band's top monster level, so the door is never the band's best XP.
  // The 12 levels between base and ceiling keep every piece priced: at
  // character level 25, three pieces fight a 41 and six a 45; at 20, 39 and
  // 45. Restraint fights a judge below the floor's dens, on purpose.
  //
  // The chamber -> door edge is the first live Connection.forced. It is
  // authored on the chamber ONLY: buildAdjacency keeps the first edge it sees
  // per destination, so a door -> chamber edge declared too could drop the
  // forced flag. The registry's mirror is the plain way back.
  f19_causeway: {
    id: 'f19_causeway',
    name: 'The Causeway',
    icon: '🛤️',
    areaId: 'ascent_f19_area',
    map: { x: 50, y: 70 },
    tags: ['heat'],
    activities: [{ id: 'camp_f19', kind: 'rest', name: 'Camp on the Causeway', icon: '🏕️' }],
    connections: [
      { to: 'f19_entrance', ticks: 30, label: 'Into the Pyramid', returnLabel: 'Out to the Causeway' },
      { to: 'f19_valley', ticks: 30 },
    ],
  },
  f19_valley: {
    id: 'f19_valley',
    name: 'The Valley Temples',
    icon: '🏜️',
    areaId: 'ascent_f19_area',
    map: { x: 80, y: 62 },
    tags: ['heat'],
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Hunt the Temples', icon: '🏹' }],
    groupWeights: { 1: 60, 2: 30, 3: 10 },
    encounters: [
      { monsterId: 'ph_cobra', weight: 50, level: [40, 41] },
      { monsterId: 'ph_scorpion', weight: 50, level: [40, 41] },
    ],
    // The skill door (FLOOR_STANDARD §2.2): optional, and the only use heat
    // resistance has on this floor besides heat damage. Level 10, not the
    // entry's 15, while heat trains through spot tags alone (about 60 real
    // minutes; 15 would take about 158). It returns to 15 once the area has
    // open sky and its own climate pin (FLOOR_IDEAS idea 4, "It waits on").
    connections: [
      {
        to: 'f19_side_tomb',
        ticks: 40,
        label: 'Into the Side Tomb',
        returnLabel: 'Out to the Temples',
        requires: [{ type: 'skill', id: 'heat_resistance', level: 10 }],
      },
    ],
  },
  f19_side_tomb: {
    id: 'f19_side_tomb',
    name: 'The Side Tomb',
    icon: '🔥',
    areaId: 'ascent_f19_area',
    map: { x: 92, y: 44 },
    tags: ['heat'],
    activities: [{ id: 'explore', kind: 'explore', name: 'Search the Side Tomb', icon: '🔍' }],
    exploreTicks: 360,
    finds: [
      { id: 'f19_side_quicksilver', at: 0.3, material: { id: 'quicksilver', qty: 3 } },
      { id: 'f19_side_ash', at: 0.6, material: { id: 'bone_ash', qty: 4 } },
      { id: 'f19_side_coffer', at: 1, gold: [150, 250], material: { id: 'brimstone', qty: 2 } },
    ],
    connections: [],
  },
  f19_entrance: {
    id: 'f19_entrance',
    name: 'The Entrance Passage',
    icon: '🔺',
    areaId: 'ascent_f19_area',
    map: { x: 50, y: 56 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Clear the Passage', icon: '⚔️' }],
    groupWeights: { 1: 60, 2: 30, 3: 10 },
    encounters: [
      { monsterId: 'ph_mummy', weight: 50, level: [40, 42] },
      { monsterId: 'ph_scarab', weight: 50, level: [40, 42] },
    ],
    connections: [{ to: 'f19_gallery', ticks: 30 }],
  },
  f19_gallery: {
    id: 'f19_gallery',
    name: 'The Grand Gallery',
    icon: '🔺',
    areaId: 'ascent_f19_area',
    map: { x: 50, y: 42 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Clear the Gallery', icon: '⚔️' }],
    groupWeights: { 1: 60, 2: 30, 3: 10 },
    encounters: [
      { monsterId: 'ph_mummy', weight: 60, level: [41, 42] },
      { monsterId: 'ph_scorpion', weight: 40, level: [41, 42] },
    ],
    connections: [{ to: 'f19_chamber', ticks: 30 }],
  },
  f19_chamber: {
    id: 'f19_chamber',
    name: 'The Burial Chamber',
    icon: '⚱️',
    areaId: 'ascent_f19_area',
    map: { x: 50, y: 26 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Clear the Chamber', icon: '⚔️' }],
    groupWeights: { 1: 70, 2: 30 },
    encounters: [{ monsterId: 'ph_mummy', weight: 1, level: [42, 43] }],
    connections: [
      { to: 'f19_treasury', ticks: 20, label: 'Into the Treasury', returnLabel: 'Back to the Chamber' },
      { to: 'f19_door', ticks: 20, forced: true, label: 'To the Door', returnLabel: 'Back to the Chamber' },
    ],
  },
  f19_treasury: {
    id: 'f19_treasury',
    name: 'The Treasury',
    icon: '🏺',
    areaId: 'ascent_f19_area',
    map: { x: 80, y: 22 },
    activities: [{ id: 'explore', kind: 'explore', name: 'Search the Treasury', icon: '🔍' }],
    exploreTicks: 360,
    finds: [
      { id: 'f19_good_ewer', at: 0.16, gold: [80, 140], material: { id: 'bronze_ingot', qty: 2 }, stat: { key: 'flag:tomb:taken' }, requires: [{ type: 'statMax', key: 'boss:f19_door', value: 0 }] },
      { id: 'f19_good_mask', at: 0.33, gold: [80, 140], material: { id: 'gold_leaf', qty: 2 }, stat: { key: 'flag:tomb:taken' }, requires: [{ type: 'statMax', key: 'boss:f19_door', value: 0 }] },
      { id: 'f19_good_bowls', at: 0.5, gold: [80, 140], material: { id: 'copper_ingot', qty: 2 }, stat: { key: 'flag:tomb:taken' }, requires: [{ type: 'statMax', key: 'boss:f19_door', value: 0 }] },
      { id: 'f19_good_chest', at: 0.66, gold: [80, 140], material: { id: 'bronze_ingot', qty: 2 }, stat: { key: 'flag:tomb:taken' }, requires: [{ type: 'statMax', key: 'boss:f19_door', value: 0 }] },
      { id: 'f19_good_figures', at: 0.83, gold: [80, 140], material: { id: 'tin_ingot', qty: 2 }, stat: { key: 'flag:tomb:taken' }, requires: [{ type: 'statMax', key: 'boss:f19_door', value: 0 }] },
      { id: 'f19_good_collar', at: 1, gold: [80, 140], material: { id: 'gold_leaf', qty: 2 }, stat: { key: 'flag:tomb:taken' }, requires: [{ type: 'statMax', key: 'boss:f19_door', value: 0 }] },
    ],
    connections: [],
  },
  f19_door: {
    id: 'f19_door',
    name: 'The Door',
    icon: '⚖️',
    areaId: 'ascent_f19_area',
    map: { x: 50, y: 8 },
    modifierWeights: { normal: 100 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Face the Weigher', icon: '⚔️' }],
    encounters: [
      {
        monsterId: 'ph_sabaket',
        weight: 1,
        boss: true,
        level: [33, 33],
        levelRise: { stat: 'flag:tomb:taken', share: 0.1, ceiling: 45 },
      },
    ],
    connections: [],
  },

  // --- Floor 20: the Delta Port, the seam to the island (floors 21 to 30).
  // Idea 3's quay and roadstead pair, no convoy table. The roadstead is one
  // fight behind a forced edge, and the crossing: the clear. Three obelisk
  // reads on floor 18 (flag:chart >= 3) leave its crew surprised.
  f20_river_road: {
    id: 'f20_river_road',
    name: 'The River Road',
    icon: '🛤️',
    areaId: 'ascent_f20_area',
    map: { x: 50, y: 70 },
    tags: ['heat'],
    activities: [
      { id: 'camp_f20', kind: 'rest', name: 'Camp on the River Road', icon: '🏕️' },
      { id: 'hunt', kind: 'hunt', name: 'Hunt the Road', icon: '🏹' },
    ],
    groupWeights: { 1: 60, 2: 30, 3: 10 },
    encounters: [
      { monsterId: 'ph_cobra', weight: 40, level: [42, 44] },
      { monsterId: 'ph_scorpion', weight: 35, level: [42, 44] },
      { monsterId: 'ph_scarab', weight: 25, level: [42, 44] },
    ],
    connections: [{ to: 'f20_quay', ticks: 30, label: 'Down to the Quay', returnLabel: 'Up the River Road' }],
  },
  f20_quay: {
    id: 'f20_quay',
    name: 'The Quay',
    icon: '⚓',
    areaId: 'ascent_f20_area',
    map: { x: 50, y: 44 },
    activities: [{ id: 'rest_f20_quay', kind: 'rest', name: 'Rest at the Quay', icon: '🛏️' }],
    connections: [
      { to: 'f20_warehouses', ticks: 20 },
      { to: 'f20_notice_wall', ticks: 15 },
      {
        to: 'f20_roadstead',
        ticks: 30,
        forced: true,
        label: 'Row Out to the Roadstead',
        returnLabel: 'Back to the Quay',
        approach: {
          requires: [{ type: 'stat', key: 'flag:chart', value: 3 }],
          enemies: [{ id: 'surprised' }],
        },
      },
    ],
  },
  f20_warehouses: {
    id: 'f20_warehouses',
    name: 'The Warehouses',
    icon: '📦',
    areaId: 'ascent_f20_area',
    map: { x: 80, y: 50 },
    activities: [
      { id: 'job_f20_cargo', kind: 'job', gold: 30, ticksPer: 240, name: 'Haul Cargo', icon: '📦' },
      { id: 'gather_f20_flour', kind: 'gather', material: 'rough_flour', ticksPer: 120, name: 'Sweep the Grain Floor', icon: '🌾' },
    ],
    connections: [],
  },
  f20_notice_wall: {
    id: 'f20_notice_wall',
    name: 'The Notice Wall',
    icon: '📜',
    areaId: 'ascent_f20_area',
    map: { x: 20, y: 40 },
    activities: [],
    connections: [],
  },
  f20_roadstead: {
    id: 'f20_roadstead',
    name: 'The Roadstead',
    icon: '⛵',
    areaId: 'ascent_f20_area',
    map: { x: 50, y: 14 },
    fightLimit: 1,
    modifierWeights: { normal: 100 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Take the Ferry', icon: '⚔️' }],
    encounters: [{ monsterId: 'ph_roadstead_crew', weight: 1, level: [45, 45] }],
    connections: [],
  },

  // ---------- The Ascent: floor 0, the Holding Level (the tutorial) ----------
  //
  // Where a new life opens (STARTING_SPOT). Four spots in a line — cell,
  // cellblock, field, gate — and the gate's road into Threshold is ONE-WAY:
  // the floor is off the ladder (bandless, see towers.data.ts) and closes
  // behind the player. The tutorial itself (data/tutorial.data.ts) reads
  // these spot ids and the counters the fights here pay; nothing on the
  // floor gates on a tutorial choice, so a player who ignores every panel
  // still walks out. Numbers: 2–3 s roads, a one-fight cellblock, a
  // three-fight field.
  f0_cell: {
    id: 'f0_cell',
    name: 'The Holding Cell',
    icon: '🔒',
    areaId: 'ascent_f0_area',
    // Map coordinates on this floor are laid over the drawn map
    // (ui/lib/tilemaps/holding_level.map.json, 20 × 15 tiles): x = tile × 5,
    // y = tile × 5. Each pin sits in its room (docs/TILEMAPS.md §4.1); the
    // cell is the open one at the top left of the cell block.
    map: { x: 15, y: 22 },
    tags: ['indoor'],
    // A haven: the tutorial's own knockouts (there should be none — the
    // slime deals 1) return here rather than to a city the player has not
    // seen yet. Also what makes STARTING_SPOT the safety fallback.
    activities: [{ id: 'rest_f0', kind: 'rest', name: 'Sleep on the Straw', icon: '🛏️' }],
    connections: [{ to: 'f0_cellblock', ticks: 20, label: 'the cell door' }],
  },
  f0_cellblock: {
    id: 'f0_cellblock',
    name: 'The Cellblock',
    icon: '🚪',
    areaId: 'ascent_f0_area',
    map: { x: 27.5, y: 50 },
    tags: ['indoor'],
    // One fight, then quiet: the Cell Slime is `once` (so the tutorial can
    // read `slain:f0_cellblock:slime_cell`) and the fightLimit clears the
    // spot after that single win, so a second hunt here finds nothing.
    fightLimit: 1,
    // Always one slime, never a boss variant: a first fight with nothing
    // unexplained in it.
    modifierWeights: { normal: 100 },
    groupWeights: { 1: 100 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Fight the Cell Slime', icon: '⚔️' }],
    encounters: [{ monsterId: 'slime_cell', weight: 100, level: [1, 1], once: true }],
    connections: [{ to: 'f0_field', ticks: 30, label: 'the yard door' }],
  },
  f0_field: {
    id: 'f0_field',
    name: 'The Field',
    icon: '🌾',
    areaId: 'ascent_f0_area',
    map: { x: 67.5, y: 32.5 },
    // Three fights' worth of Cell Slimes, so the spell the tutorial hands
    // out has something to be cast at; then the field goes quiet too.
    fightLimit: 3,
    modifierWeights: { normal: 100 },
    groupWeights: { 1: 100 },
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Fight in the Field', icon: '⚔️' },
      { id: 'train_int_f0', kind: 'train', attr: 'int', name: 'Study the Gate Plaque', icon: '📖' },
    ],
    encounters: [{ monsterId: 'slime_cell', weight: 100, level: [1, 2] }],
    connections: [{ to: 'f0_gate', ticks: 30, label: 'the path to the gate' }],
  },
  f0_gate: {
    id: 'f0_gate',
    name: 'The Gate',
    icon: '🚧',
    areaId: 'ascent_f0_area',
    map: { x: 80, y: 11 },
    activities: [],
    // One way. The floor is a tutorial, not a place; once the player is in
    // the city there is nothing here to come back for, and the 'every spot
    // can get home' lint is satisfied because the Foot is a waypoint.
    connections: [{ to: 'ascent_foot', ticks: 30, oneWay: true, label: 'through the gate into Threshold' }],
  },
});
/**
 * A new life opens in a holding cell on floor 0 of the tower (the tutorial,
 * data/tutorial.data.ts). The cell is a haven, so it is also the safety
 * fallback for a save that has never stood anywhere else. The gate at the
 * end of the floor is a one-way road into Threshold, whose Foot is the
 * city’s waypoint and the hub every district reaches — the reachability
 * lint walks from here and through that gate.
 */
export const STARTING_SPOT = 'f0_cell';
