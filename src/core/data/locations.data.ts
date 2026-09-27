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
  threshold: { id: 'threshold', name: 'Threshold', terrain: 'plains', tags: ['settlement'], world: { x: 14, y: 22 } },
  // Your hold — its own map, reached through the door at the Foot, and shut
  // until the first prestige (`prestige:count`, see the Foot's connection).
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
  the_hold: { id: 'the_hold', name: 'Your Hold', terrain: 'plains', sheltered: true, world: { x: 14.8, y: 21 } },
};

export const AREAS: Record<string, AreaDef> = {
  // Your hold. One area, one region, no floor: it is off every ladder by
  // construction, and its door (ascent_foot → base_entrance) is the single
  // gate the prestige system will lift. `FloorDef.personal` / `.persists`
  // remain the declarations prestige must honour when it lands.
  player_base_v1_area: { id: 'player_base_v1_area', name: 'Your Hold', regionId: 'the_hold' },
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
  ascent_f1_area: { id: 'ascent_f1_area', name: 'The Old Toll Level', regionId: 'the_ascent', scene: 'hall' },
  ascent_f2_area: { id: 'ascent_f2_area', name: 'The Wildwood', regionId: 'the_ascent', scene: 'forest' },
  ascent_f3_area: { id: 'ascent_f3_area', name: 'The Silk Gallery', regionId: 'the_ascent', scene: 'webs' },
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
    waypoint: true,
    activities: [],
    connections: [
      { to: 'base_main_hall', ticks: 60 },
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
    connections: [
      // The door to your hold. Shut until the first prestige: `requires` is
      // directional (the registry mirror never carries it), so a save already
      // inside can always walk back out. Prestige is unbuilt; when it lands,
      // stamping `prestige:count` is what opens this — nothing else to wire.
      {
        to: 'base_entrance',
        ticks: 90,
        requires: [{ type: 'stat', key: 'prestige:count', value: 1 }],
        label: 'the door',
        returnLabel: 'back out to the Foot',
      },
    ],
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
      { to: 'ascent_foot', ticks: 60, label: 'the Scholars’ Road' },
      { to: 'temple_rise_gate', ticks: 90 },
      { to: 'the_reading_hall', ticks: 40 },
      { to: 'chalk_yard', ticks: 40 },
    ],
  },
  the_reading_hall: {
    id: 'the_reading_hall',
    name: 'The Reading Hall',
    icon: '📖',
    areaId: 'scholars_quarter',
    map: { x: 38, y: 5 },
    tags: ['indoor'],
    activities: [
      { id: 'train_int_hall', kind: 'train', attr: 'int', name: 'Read Until It Sticks', icon: '📚' },
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
      { id: 'train_int_chalk', kind: 'train', attr: 'int', name: 'Copy Out a Proof', icon: '✏️' },
    ],
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
      { to: 'ascent_foot', ticks: 60, label: 'the Pilgrim Way' },
      { to: 'ironyard_gate', ticks: 90 },
      { to: 'the_nine_chapels', ticks: 40 },
      { to: 'censer_walk', ticks: 40 },
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
      { id: 'train_wis_chapels', kind: 'train', attr: 'wis', name: 'Keep a Vigil', icon: '🕯️', tags: ['magic'] },
    ],
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
      { to: 'ascent_foot', ticks: 60, label: 'the Muster Road' },
      { to: 'alembic_row_gate', ticks: 90 },
      { to: 'the_sand', ticks: 40 },
      { to: 'long_gallery', ticks: 40 },
      { to: 'the_cages', ticks: 40 },
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
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Step Into a Cage', icon: '🪤' }],
    encounters: [
      { monsterId: 'forest_rat', weight: 40, level: [1, 2] },
      { monsterId: 'slime_base_basic', weight: 40, level: [1, 2] },
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
      { id: 'spar_sand', kind: 'train', attr: 'str', name: 'Spar', icon: '⚔️', tags: ['combat'] },
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
      { to: 'ascent_foot', ticks: 60, label: 'the Retort Road' },
      { to: 'chancery_arch', ticks: 90 },
      { to: 'the_alembics', ticks: 40 },
      { to: 'the_vivarium', ticks: 40 },
    ],
  },
  the_alembics: {
    id: 'the_alembics',
    name: 'The Alembics',
    icon: '🧪',
    areaId: 'alembic_row',
    map: { x: 90, y: 55 },
    tags: ['indoor', 'heat'],
    activities: [],
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
      { to: 'ascent_foot', ticks: 60, label: 'the Chancery Road' },
      { to: 'assize_gate', ticks: 90 },
      { to: 'the_rolls', ticks: 40 },
      { to: 'seal_room', ticks: 40 },
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
      { id: 'job_copying', kind: 'job', gold: 12, ticksPer: 220, name: 'Copy Out Writs', icon: '🖋️', staticTime: true },
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
      { to: 'ascent_foot', ticks: 60, label: 'the Assize Road' },
      { to: 'wrights_gate', ticks: 90 },
      { to: 'the_high_bench', ticks: 40 },
      { to: 'the_holding', ticks: 40 },
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
      { id: 'job_watch', kind: 'job', gold: 14, ticksPer: 260, name: 'Stand the Night Watch', icon: '🌙', staticTime: true },
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
      { to: 'ascent_foot', ticks: 60, label: 'the Wrights’ Road' },
      { to: 'granary_gate', ticks: 90 },
      { to: 'the_forges', ticks: 40 },
      { to: 'the_long_bench', ticks: 40 },
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
      { id: 'job_bellows_threshold', kind: 'job', gold: 14, ticksPer: 250, name: 'Work the Bellows', icon: '🔥' },
      { id: 'train_str_forges', kind: 'train', attr: 'str', name: 'Swing the Sledge', icon: '🔨', tags: ['blunt'] },
    ],
    // The city's smithing counter: the same starter recipes the hamlet forge
    // teaches, because the Warden's iron has to become something somewhere.
    recipes: ['iron_ingot', 'iron_dagger', 'iron_sword'],
    benches: ['assembling'],
    connections: [],
  },
  the_long_bench: {
    id: 'the_long_bench',
    name: 'The Long Bench',
    icon: '🔣',
    areaId: 'wrights_ward',
    map: { x: 7, y: 28 },
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
      { to: 'ascent_foot', ticks: 60, label: 'the Granary Road' },
      { to: 'lectory_steps', ticks: 90 },
      { to: 'the_weighbridge', ticks: 40 },
      { to: 'the_undercrofts', ticks: 40 },
      { to: 'granary_kitchens', ticks: 40 },
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
      { id: 'job_pans', kind: 'job', gold: 10, ticksPer: 200, name: 'Scrub the Pans', icon: '🍳' },
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
    connections: [],
  },

  // ---------- The Ascent: band 1 ----------
  //
  // Three spots per floor on one pattern: the landing (where the ladder puts
  // you), a working spot, and the den that carries the floor's clear counter.
  // No edge leaves any of these areas — the ladder (systems/towers.ts) is the
  // only door, and the lint holds it shut. Names are placeholders; encounter
  // levels and clear numbers are first guesses for review.

  // --- Floor 1: the Old Toll Level (clear: kill the toll collector) ---
  f1_landing: {
    id: 'f1_landing',
    name: 'The First Landing',
    icon: '🪜',
    areaId: 'ascent_f1_area',
    map: { x: 18, y: 68 },
    // Every landing is a camp: a haven on the floor itself, so a knockout
    // above returns you here rather than all the way down to the Foot
    // (systems/safety.ts records the last haven stood in).
    activities: [{ id: 'camp_f1', kind: 'rest', name: 'Camp on the Landing', icon: '🏕️' }],
    connections: [
      { to: 'f1_storerooms', ticks: 40 },
      { to: 'f1_toll_hall', ticks: 50 },
    ],
  },
  f1_storerooms: {
    id: 'f1_storerooms',
    name: 'The Bonded Stores',
    icon: '📦',
    areaId: 'ascent_f1_area',
    map: { x: 8, y: 62 },
    exploreTicks: 360,
    activities: [
      { id: 'explore_f1', kind: 'explore', name: 'Go Through the Crates', icon: '🔍' },
      { id: 'hunt', kind: 'hunt', name: 'Clear Out the Vermin', icon: '⚔️' },
    ],
    encounters: [
      { monsterId: 'forest_rat', weight: 60, level: [1, 3] },
      { monsterId: 'slime_base_basic', weight: 40, level: [2, 4] },
    ],
    finds: [
      {
        id: 'f1_manifest_coin',
        at: 0.35,
        gold: [30, 50],
      },
      {
        id: 'f1_dried_herbs',
        at: 0.7,
        material: { id: 'common_herb', qty: 4 },
        skillXp: { tags: ['herbalism'], xp: 12 },
      },
    ],
    // "Relatively safe as long as they do not stray too far from the explored
    // path" — the straying, made literal: a hidden way down to stock nobody
    // bonded, guarded well above the floor's weight. Combing the stores
    // reveals it; walking it is the choice.
    connections: [{ to: 'f1_bonded_deep', ticks: 40, hidden: true }],
  },
  f1_bonded_deep: {
    id: 'f1_bonded_deep',
    name: 'The Bonded Deep',
    icon: '🕳️',
    areaId: 'ascent_f1_area',
    map: { x: 4, y: 70 },
    tags: ['dark'],
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Go In Anyway', icon: '⚔️' },
      { id: 'explore_f1_deep', kind: 'explore', name: 'Search Past the Manifests', icon: '🔍' },
    ],
    encounters: [
      { monsterId: 'slime_base_advanced', weight: 55, level: [8, 10] },
      { monsterId: 'slime_metal', weight: 45, level: [9, 11] },
    ],
    exploreTicks: 420,
    finds: [
      {
        id: 'f1_deep_strongroom',
        at: 0.8,
        gold: [180, 260],
      },
    ],
    connections: [],
  },
  f1_toll_hall: {
    id: 'f1_toll_hall',
    name: 'The Toll Hall',
    icon: '🪙',
    areaId: 'ascent_f1_area',
    map: { x: 26, y: 74 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Hunt the Hall', icon: '⚔️' }],
    // Quest 3's design (plans/alpha-threshold-quests.md): the KEEPER changes
    // with the clock — hobgoblin by day, an advanced slime by night — and the
    // clear latches on `boss:f1_toll_hall`, whichever keeper paid it. The two
    // windowed entries are the AMBUSH: a Champion or the Slime King, rolled
    // only while the player's power sits at 90–98% of theirs — a fight you
    // planned into, paying accordingly, and gone once outgrown.
    encounters: [
      { monsterId: 'goblin', weight: 40, level: [2, 5] },
      { monsterId: 'slime_base_basic', weight: 25, level: [3, 5] },
      // The toll collector: once, and gone — a purse on legs, not the keeper.
      { monsterId: 'slime_coin', weight: 10, level: [5, 5], once: true },
      { monsterId: 'hobgoblin', weight: 15, level: [6, 7], daypart: 'day', boss: true },
      { monsterId: 'slime_base_advanced', weight: 15, level: [6, 7], daypart: 'night', boss: true },
      { monsterId: 'hobgoblin_champion', weight: 15, level: [11, 12], daypart: 'day', boss: true, window: { min: 0.9, max: 0.98 } },
      { monsterId: 'slime_king', weight: 15, level: [11, 12], daypart: 'night', boss: true, window: { min: 0.9, max: 0.98 } },
    ],
    connections: [],
  },

  // --- Floor 2: the Wildwood (clear: wake the Grand Elevator) ---
  //
  // The first floor with a prestige behind it, so the first with a quest's
  // shape: find the Grand Elevator, raid the four nests that hold it shut,
  // wake it. Each nest asks a different question (see the Wildwood section
  // of monsters.data.ts): the Warren formations, the Crypt damage types, the
  // Runs crowds, the Mound sustain. The crypt and the Elevator are FOUND —
  // combing the deep wood reveals their paths — and everything else is in
  // plain sight from the edge. Levels and budgets are first guesses.
  f2_landing: {
    id: 'f2_landing',
    name: 'The Treeline Camp',
    icon: '🏕️',
    areaId: 'ascent_f2_area',
    map: { x: 10, y: 40 },
    activities: [{ id: 'camp_f2', kind: 'rest', name: 'Camp at the Treeline', icon: '🏕️' }],
    connections: [{ to: 'f2_edge', ticks: 40 }],
  },
  f2_edge: {
    id: 'f2_edge',
    name: 'The Wildwood Edge',
    icon: '🌲',
    areaId: 'ascent_f2_area',
    map: { x: 26, y: 34 },
    exploreTicks: 360,
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Hunt the Undergrowth', icon: '⚔️' },
      { id: 'explore_f2_edge', kind: 'explore', name: 'Scout the Edge', icon: '🔍' },
    ],
    encounters: [
      { monsterId: 'forest_rat', weight: 25, level: [3, 5] },
      { monsterId: 'young_wolf', weight: 30, level: [4, 6] },
      { monsterId: 'goblin', weight: 25, level: [4, 6] },
      { monsterId: 'boar', weight: 20, level: [5, 6] },
    ],
    finds: [
      { id: 'f2_snared_purse', at: 0.3, gold: [40, 70] },
      {
        id: 'f2_edge_herbs',
        at: 0.65,
        material: { id: 'mendroot', qty: 3 },
        skillXp: { tags: ['herbalism'], xp: 15 },
      },
    ],
    connections: [
      { to: 'f2_goblin_warren', ticks: 50 },
      { to: 'f2_wolf_runs', ticks: 50 },
      { to: 'f2_deepwood', ticks: 60 },
    ],
  },
  f2_deepwood: {
    id: 'f2_deepwood',
    name: 'The Deep Wildwood',
    icon: '🌳',
    areaId: 'ascent_f2_area',
    map: { x: 46, y: 26 },
    scene: 'deepwood',
    exploreTicks: 540,
    activities: [
      { id: 'hunt', kind: 'hunt', name: 'Hunt Under the Canopy', icon: '⚔️' },
      { id: 'explore_f2_deep', kind: 'explore', name: 'Comb the Deep Wood', icon: '🔍' },
    ],
    encounters: [
      { monsterId: 'young_wolf', weight: 25, level: [5, 7] },
      { monsterId: 'goblin', weight: 25, level: [5, 7] },
      { monsterId: 'boar', weight: 30, level: [6, 8] },
      { monsterId: 'goblin_archer', weight: 20, level: [5, 7] },
    ],
    // Two things in here are FOUND rather than seen: the crypt's stair (the
    // underground nest) and the Elevator's glade. The glade's find also sets
    // the flag the Pathwarden's quest reads, so finding it is a fact about the
    // save — accepted before or after, it counts.
    finds: [
      {
        id: 'f2_root_stair',
        at: 0.35,
        path: 'f2_crypt',
      },
      { id: 'f2_hunters_cache', at: 0.55, gold: [70, 110] },
      {
        id: 'f2_elevator_found',
        at: 0.8,
        path: 'f2_elevator',
        stat: { key: 'flag:elevator_found' },
      },
    ],
    connections: [
      { to: 'f2_hive', ticks: 60 },
      { to: 'f2_crypt', ticks: 50, hidden: true },
      { to: 'f2_elevator', ticks: 70, hidden: true },
    ],
  },

  // The four nests. Each holds a fixed budget of fights; the clear is the
  // budget spent, and the Elevator's gate reads all four.
  f2_goblin_warren: {
    id: 'f2_goblin_warren',
    name: 'The Goblin Warren',
    icon: '👺',
    areaId: 'ascent_f2_area',
    map: { x: 16, y: 18 },
    scene: 'warren',
    fightLimit: 7,
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Raid the Warren', icon: '⚔️' }],
    // Formations, not crowds: each line is a warband with a plan. The spear
    // line and the shield wall hold the front so the archers and the shaman
    // behind them keep working; the cutthroats come fast and all at once.
    // Anything that reaches past the front slot changes these fights.
    encounters: [
      { monsterId: 'goblin_spearman', weight: 25, level: [6, 7], party: ['goblin_spearman', 'goblin_archer', 'goblin_archer'] },
      { monsterId: 'goblin_shieldbearer', weight: 20, level: [6, 7], party: ['goblin_shieldbearer', 'goblin_archer'] },
      { monsterId: 'hobgoblin', weight: 20, level: [6, 7], party: ['goblin', 'goblin_shaman'] },
      { monsterId: 'goblin_cutthroat', weight: 20, level: [5, 6], party: ['goblin_cutthroat', 'goblin_cutthroat', 'goblin_cutthroat'] },
      { monsterId: 'goblin_spearman', weight: 15, level: [6, 7], party: ['goblin_shaman', 'goblin_shaman'] },
      // The last fight of every raid, and only the last: the king, his two
      // hobgoblins and a shaman. `boss` latches boss:f2_goblin_warren too.
      {
        monsterId: 'goblin_king',
        weight: 100,
        level: [8, 8],
        finale: true,
        boss: true,
        party: ['goblin_spearman', 'goblin_shaman'],
      },
    ],
    connections: [],
  },
  f2_crypt: {
    id: 'f2_crypt',
    name: 'The Sunken Crypt',
    icon: '⚰️',
    areaId: 'ascent_f2_area',
    map: { x: 58, y: 40 },
    scene: 'crypt',
    tags: ['dark'],
    fightLimit: 6,
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Descend into the Crypt', icon: '⚔️' }],
    // Bones up front, haunts behind. The bones fold to anything blunt and
    // the haunts to light, arcane and fire; a player with a club AND a
    // spell clears this quickly, a player with only a sword clears it all
    // the same, slower.
    encounters: [
      { monsterId: 'skeleton', weight: 30, level: [6, 8], party: ['haunt'] },
      { monsterId: 'haunt', weight: 20, level: [6, 8], party: ['skeleton'] },
      { monsterId: 'skeleton', weight: 20, level: [6, 8], party: ['skeleton_archer', 'haunt'] },
      { monsterId: 'skeleton', weight: 15, level: [6, 7], party: ['skeleton', 'haunt'] },
      { monsterId: 'haunt', weight: 15, level: [6, 7], party: ['haunt'] },
    ],
    connections: [],
  },
  f2_wolf_runs: {
    id: 'f2_wolf_runs',
    name: 'The Wolf Runs',
    icon: '🐾',
    areaId: 'ascent_f2_area',
    map: { x: 34, y: 50 },
    scene: 'wolfden',
    fightLimit: 6,
    // Never fewer than three: the runs are pack country.
    groupWeights: { 3: 45, 4: 35, 5: 20 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Walk the Runs', icon: '⚔️' }],
    encounters: [
      { monsterId: 'grey_wolf', weight: 60, level: [5, 7] },
      { monsterId: 'wolf_alpha', weight: 40, level: [6, 8] },
    ],
    connections: [],
  },
  f2_hive: {
    id: 'f2_hive',
    name: 'The Hive Mound',
    icon: '🐜',
    areaId: 'ascent_f2_area',
    map: { x: 64, y: 14 },
    scene: 'hive',
    fightLimit: 5,
    // One push: leave, rest or go down and the count starts again, and the
    // next wave comes before the last one is cold (SpotDef.streak). No camp
    // here on purpose — the lint forbids one.
    streak: true,
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Break into the Mound', icon: '⚔️' }],
    encounters: [
      { monsterId: 'worker_ant', weight: 25, level: [6, 7], party: ['worker_ant'] },
      { monsterId: 'soldier_ant', weight: 25, level: [6, 7], party: ['worker_ant'] },
      { monsterId: 'worker_ant', weight: 20, level: [6, 7], party: ['spitter_ant'] },
      { monsterId: 'soldier_ant', weight: 15, level: [6, 7], party: ['spitter_ant'] },
      { monsterId: 'worker_ant', weight: 15, level: [6, 7], party: ['worker_ant', 'worker_ant'] },
    ],
    connections: [],
  },

  // The Grand Elevator: not a machine, a thing that carries whoever it
  // accepts upward. Waking it IS the floor's clear. The search stalls a tenth
  // of the way in until all four nests are cleared; past that it runs to
  // the end, and the last find writes the flag the floor clear reads.
  f2_elevator: {
    id: 'f2_elevator',
    name: 'The Grand Elevator',
    icon: '🛗',
    areaId: 'ascent_f2_area',
    map: { x: 44, y: 8 },
    scene: 'glade',
    exploreTicks: 300,
    activities: [{ id: 'wake_elevator', kind: 'explore', name: 'Wake the Grand Elevator', icon: '✨' }],
    exploreGates: [
      {
        at: 0.1,
        requires: [
          { type: 'stat', key: 'fights:f2_goblin_warren', value: 7 },
          { type: 'stat', key: 'fights:f2_crypt', value: 6 },
          { type: 'stat', key: 'fights:f2_wolf_runs', value: 6 },
          { type: 'stat', key: 'fights:f2_hive', value: 5 },
        ],
      },
    ],
    finds: [{ id: 'f2_elevator_wakes', at: 1, stat: { key: 'flag:grand_elevator' } }],
    connections: [],
  },

  // --- Floor 3: the Silk Gallery (clear: kill the brood queen) ---
  f3_landing: {
    id: 'f3_landing',
    name: 'The Hushed Landing',
    icon: '🪜',
    areaId: 'ascent_f3_area',
    map: { x: 86, y: 68 },
    activities: [{ id: 'camp_f3', kind: 'rest', name: 'Camp on the Landing', icon: '🏕️' }],
    connections: [
      { to: 'f3_web_gallery', ticks: 40 },
      { to: 'f3_brood_den', ticks: 60 },
    ],
  },
  f3_web_gallery: {
    id: 'f3_web_gallery',
    name: 'The Silk Gallery',
    icon: '🕸️',
    areaId: 'ascent_f3_area',
    map: { x: 78, y: 62 },
    exploreTicks: 480,
    activities: [
      { id: 'explore_f3', kind: 'explore', name: 'Cut Through the Webs', icon: '🔍' },
      { id: 'hunt', kind: 'hunt', name: 'Hunt the Gallery', icon: '⚔️' },
    ],
    encounters: [
      { monsterId: 'cave_spider', weight: 60, level: [7, 10] },
      { monsterId: 'slime_spider', weight: 40, level: [8, 11] },
    ],
    finds: [
      {
        id: 'f3_wrapped_valuables',
        at: 0.5,
        gold: [120, 180],
      },
    ],
    connections: [],
  },
  f3_brood_den: {
    id: 'f3_brood_den',
    name: 'The Brood Den',
    icon: '🕷️',
    areaId: 'ascent_f3_area',
    map: { x: 94, y: 74 },
    activities: [{ id: 'hunt', kind: 'hunt', name: 'Go to the Centre', icon: '⚔️' }],
    encounters: [
      { monsterId: 'cave_spider', weight: 70, level: [8, 11] },
      // The floor's clear: `once`, latching slain:f3_brood_den:giant_spider_queen.
      { monsterId: 'giant_spider_queen', weight: 30, level: [12, 12], once: true },
    ],
    connections: [],
  },
});
/**
 * A new life opens at the foot of the tower, in the city that grew around it.
 * The Foot is the right root for three reasons rather than one: it is the
 * haven (the only `rest` in Threshold), it is the city's waypoint, and it is
 * the one spot all eight districts already reach — so the reachability lint
 * anchors on the same place the fiction does.
 */
export const STARTING_SPOT = 'ascent_foot';
