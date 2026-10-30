import { prose } from '../text/prose';
import { SEA_SIDES_TEXT } from '../text/sea.text';

/**
 * The harbor band's sea (docs/FLOOR_IDEAS.md §4 idea 3, floors 11 to 14).
 *
 * Two registries and one constant block. A side is a row (`SEA_SIDES`): a
 * fifth side is a fifth row. A convoy is a row too (`CONVOYS`), keyed by the
 * water spot it sails past. The resolver that reads them is systems/sea.ts.
 *
 * Nothing here is saved. The schedule is derived from `totalTicks`, the side
 * is the join quest's accept stamp, and the running cargo of the convoy the
 * player is sailing with lives in `state.stats` under `sea:<spot>:*`.
 */

/**
 * Which end of the convoy's flow a side stands on. Each value is one formula
 * in `resolveLeg` (systems/sea.ts):
 *
 * - `convoy` (merchants): crates lost = clamp(raiders + monsters − kills − battery, 0, crates); the rest are sold at port.
 * - `escort` (navy): crates lost = clamp(monsters − kills − battery, 0, crates); the rest are kept.
 * - `raid` (pirates): crates seized = clamp(battery − (guard − kills), 0, crates).
 * - `recover` (privateers): crates recovered = clamp(battery − (raiders − kills), 0, carried), from the pirate ships' prize.
 */
export type SeaFlow = 'convoy' | 'escort' | 'raid' | 'recover';

export interface SeaSideDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** The recruiter at a floor-11 berth who gives `joinQuest`. */
  giver: string;
  /**
   * Accepting it picks the side for the run: its accept stamp
   * (`flag:quest:<id>:accepted`, systems/quests.ts) is the side record. Every
   * join quest requires the other sides' stamps at 0, so one side per run.
   */
  joinQuest: string;
  flow: SeaFlow;
  /**
   * Monster ids whose kills on the water count against the leg: one kill
   * subtracts one from the threat (convoy, escort), the guard (raid) or the
   * pirate crew (recover). Kills of anything else count for nothing here.
   */
  prey: string[];
  /** Floor 14's wing: killing `monsterId` at `spot` stamps `SEA_MISSION_DONE`. */
  mission: { spot: string; monsterId: string };
}

/**
 * One water spot's convoy. Every `SEA.convoyTicks` a convoy of `SEA.crates`
 * sails past; each of its `SEA.legs` legs rolls these three numbers
 * (inclusive ranges, deterministic per convoy, leg and spot), so a preview of
 * the leg in progress is the number the resolver will use.
 */
export interface ConvoyDef {
  /** The water spot. Also the registry key. */
  id: string;
  /** Pirate raiders on the lane this leg: the merchants' threat, the privateers' pirate crew. */
  raiders: [number, number];
  /** Sea monsters this leg: threat for merchants and the navy. */
  monsters: [number, number];
  /** The convoy's own guard this leg: what the pirates' raid has to beat. */
  guard: [number, number];
  /** Each crate won pays one material from this row (merchants are paid gold instead, `SEA_DEAL`). */
  cargo: string[];
}

/** The schedule, the battery and offline credit. All integers. */
export const SEA = {
  /** A convoy sails every hour of ticks: 6 minutes. */
  convoyTicks: 3600,
  /** Each leg runs 30 seconds; legs fill the first 1,200 ticks of the hour, then the convoy is in port. */
  legTicks: 300,
  legs: 4,
  crates: 8,
  /** Offline, one cargo is paid per this many crates credited (25%), and none reach `sea:crates:won`. */
  offlineShare: 4,
  /** The battery: rating = volleys × hit + morale (systems/sea.ts `batteryOf`). */
  cannon: 'ship_cannon',
  /** Cannons held past this many add nothing. */
  maxCannons: 4,
  /** One spent per leg; loads every fitted cannon. Without it the fitted cannons are dry. */
  shot: 'cannonball',
  /** One spent per leg; +1 hit. */
  powder: 'powder_charge',
  /** One spent per leg, lowest grade first; +1 morale. */
  ration: 'travelers_ration',
} as const;

/**
 * The merchants' port sale: gold per crate sold, set by Speechcraft
 * thresholds, never dice (FLOOR_IDEAS.md idea 3, rulings, the merchants'
 * role). Each term met adds its gold to `base`. A missed term costs price,
 * never crates.
 */
export const SEA_DEAL = {
  skill: 'speechcraft',
  base: 9,
  terms: [
    { id: 'duty', level: 5, gold: 1 },
    { id: 'buyer', level: 15, gold: 2 },
    { id: 'price', level: 30, gold: 3 },
  ],
} as const;

/** Every crate won while present, across every water. The harbor floors' clears read it. */
export const SEA_CRATES_WON = 'sea:crates:won';
/** Crates credited during offline catch-up. Pays cargo at `SEA.offlineShare`; no clear reads it. */
export const SEA_CRATES_OFFLINE = 'sea:crates:offline';
/** Stamped when the run's side kills its mission boss on floor 14. Floor 14's clear reads it. */
export const SEA_MISSION_DONE = 'flag:sea:14:done';

/** The four sides. Order is the berths' order on the quay. */
export const SEA_SIDES = prose<SeaSideDef>('SEA_SIDES', SEA_SIDES_TEXT, {
  merchants: {
    id: 'merchants',
    name: 'The Merchants',
    icon: '⚖️',
    giver: 'f11_factor',
    joinQuest: 'f11_join_merchants',
    flow: 'convoy',
    prey: ['ph_pirate_cutthroat', 'ph_pirate_gunner', 'ph_pirate_captain', 'ph_reef_eel', 'ph_deep_serpent', 'ph_brood_matron'],
    mission: { spot: 'f14_closed_port', monsterId: 'ph_port_warden' },
  },
  pirates: {
    id: 'pirates',
    name: 'The Pirates',
    icon: '🏴‍☠️',
    giver: 'f11_bosun',
    joinQuest: 'f11_join_pirates',
    flow: 'raid',
    prey: ['ph_convoy_guard', 'ph_navy_marine', 'ph_navy_frigate'],
    mission: { spot: 'f14_treasure_galleon', monsterId: 'ph_galleon_master' },
  },
  privateers: {
    id: 'privateers',
    name: 'The Privateers',
    icon: '📜',
    giver: 'f11_letter_agent',
    joinQuest: 'f11_join_privateers',
    flow: 'recover',
    prey: ['ph_pirate_cutthroat', 'ph_pirate_gunner', 'ph_pirate_captain'],
    mission: { spot: 'f14_flagship', monsterId: 'ph_pirate_king' },
  },
  navy: {
    id: 'navy',
    name: 'The Navy',
    icon: '⚓',
    giver: 'f11_lieutenant',
    joinQuest: 'f11_join_navy',
    flow: 'escort',
    prey: ['ph_reef_eel', 'ph_deep_serpent', 'ph_brood_matron'],
    mission: { spot: 'f14_beast_lair', monsterId: 'ph_sea_beast' },
  },
});

/**
 * The convoy table: one row per water spot. Threat rises with the floor; a
 * floor's lanes trade distance for threat (FLOOR_IDEAS.md idea 3, floor 12:
 * long and weak, short and strong, hidden and cheap).
 */
export const CONVOYS: Record<string, ConvoyDef> = {
  // Floor 11.
  f11_roadstead: {
    id: 'f11_roadstead',
    raiders: [1, 2],
    monsters: [1, 2],
    guard: [1, 2],
    cargo: ['rock_salt', 'rough_flour', 'iron_ingot', 'grain_spirit'],
  },
  // Floor 12. The four side lanes are long and weak; the strait is short and
  // strong; the cove is hidden and cheap; the far water is the clear.
  f12_trade_lane: {
    id: 'f12_trade_lane',
    raiders: [1, 2],
    monsters: [0, 2],
    guard: [1, 2],
    cargo: ['rock_salt', 'wild_honey', 'copper_ingot', 'pressed_oil'],
  },
  f12_patrol_lane: {
    id: 'f12_patrol_lane',
    raiders: [0, 2],
    monsters: [1, 2],
    guard: [1, 2],
    cargo: ['rough_flour', 'iron_ingot', 'tin_ingot', 'brimstone'],
  },
  f12_hidden_cove: {
    id: 'f12_hidden_cove',
    raiders: [0, 1],
    monsters: [0, 1],
    guard: [0, 1],
    cargo: ['wild_honey', 'copper_ingot', 'grain_spirit'],
  },
  f12_hunting_ground: {
    id: 'f12_hunting_ground',
    raiders: [1, 2],
    monsters: [0, 1],
    guard: [1, 2],
    cargo: ['rock_salt', 'bronze_ingot', 'tin_ingot', 'grain_spirit'],
  },
  f12_strait: {
    id: 'f12_strait',
    raiders: [2, 3],
    monsters: [2, 3],
    guard: [2, 3],
    cargo: ['iron_ingot', 'copper_ingot', 'tin_ingot', 'bronze_ingot', 'brimstone'],
  },
  f12_far_water: {
    id: 'f12_far_water',
    raiders: [2, 3],
    monsters: [1, 3],
    guard: [2, 3],
    cargo: ['wild_honey', 'bronze_ingot', 'pressed_oil', 'brimstone'],
  },
  // Floor 13.
  f13_picket: {
    id: 'f13_picket',
    raiders: [2, 3],
    monsters: [2, 3],
    guard: [2, 3],
    cargo: ['rough_flour', 'iron_ingot', 'tin_ingot', 'grain_spirit', 'brimstone'],
  },
  f13_blockade: {
    id: 'f13_blockade',
    raiders: [3, 4],
    monsters: [2, 4],
    guard: [3, 4],
    cargo: ['rock_salt', 'wild_honey', 'copper_ingot', 'bronze_ingot', 'pressed_oil', 'brimstone'],
  },
};
