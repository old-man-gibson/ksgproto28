import type { GameState } from '../types';
import type { EventBus } from '../engine/events';
import { CONVOYS, MATERIALS, SEA_SIDES } from '../registry';
import {
  SEA,
  SEA_CRATES_OFFLINE,
  SEA_CRATES_WON,
  SEA_DEAL,
  SEA_MISSION_DONE,
  type ConvoyDef,
  type SeaFlow,
  type SeaSideDef,
} from '../data/sea.data';
import { randInt } from '../engine/rng';
import { bumpStat, setStat } from './achievements';
import { gradesHeld, grantMaterial, isGraded, takeGraded } from './disciplines';
import { fightsKey } from './combat';
import { checkFloorClears } from './levels';
import { acceptedKey } from './quests';
import { isIdle } from './bonustime';
import { text } from '../text/log';

/**
 * The harbor band's convoys (docs/FLOOR_IDEAS.md §4 idea 3; data in
 * data/sea.data.ts).
 *
 * Every water spot in `CONVOYS` runs the same clock: convoy n sails during
 * ticks [3600n, 3600n + 1200) in four legs of 300, then sits in port until
 * the next hour of ticks. Each leg's raiders, monsters and guard are a hash
 * of (spot, convoy, leg), so nothing about the schedule is stored and a
 * preview of the leg in progress is the number the resolver will use.
 *
 * A leg resolves on the tick that ends it, and only for a player PRESENT at
 * that water: standing on it, not idle, not travelling, not knocked out
 * (idea 2's definition, so a tick either banks bonus time or counts, never
 * both). Present online, the leg fires the battery, counts the kills made at
 * that water during the leg, and credits crates to `sea:crates:won`. Present
 * during offline catch-up, the leg fires the battery with no kills and pays
 * 25% of its crates as cargo, never to `sea:crates:won`, so a night away
 * cannot pass a harbor floor's clear.
 *
 * Legs sailed while the player was elsewhere are folded in on the next leg
 * they are present for, with a battery of 0 and no kills: the convoy sailed
 * without them. Only the running cargo of a convoy the player has joined is
 * stored, under `sea:<spot>:*` in `state.stats`; it never enters
 * `modFingerprint` (no modifier reads it).
 */

/** The cargo a convoy carries between legs. */
export interface ConvoyCargo {
  /** Crates still in the convoy's holds. */
  crates: number;
  /** Crates aboard the pirate ships (the privateers' prize). */
  carried: number;
}

/** One leg's roll. */
export interface LegRoll {
  raiders: number;
  monsters: number;
  guard: number;
}

export interface LegOutcome {
  cargo: ConvoyCargo;
  /** Crates this leg moved: lost (convoy, escort), seized (raid) or recovered (recover). */
  moved: number;
  /** Crates credited to the player by this leg itself: raid and recover only. */
  credited: number;
}

/** Where the schedule stands at a tick. `leg` is null while the convoy is in port. */
export interface SeaClock {
  convoy: number;
  /** Ticks into the convoy's hour. */
  offset: number;
  leg: number | null;
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

// ---------- Sides ----------

/**
 * The run's side: the one whose join quest has been accepted. Join quests
 * require the other sides' stamps at 0, so at most one holds; a save edited
 * into two gets the first in `SEA_SIDES` order.
 */
export function seaSide(state: GameState): SeaSideDef | null {
  for (const side of Object.values(SEA_SIDES)) {
    if ((state.stats[acceptedKey(side.joinQuest)] ?? 0) >= 1) return side;
  }
  return null;
}

/** True for a spot with a convoy. */
export function isWater(spotId: string): boolean {
  return CONVOYS[spotId] !== undefined;
}

// ---------- The schedule ----------

export function seaClock(totalTicks: number): SeaClock {
  const convoy = Math.floor(totalTicks / SEA.convoyTicks);
  const offset = totalTicks - convoy * SEA.convoyTicks;
  const leg = offset < SEA.legs * SEA.legTicks ? Math.floor(offset / SEA.legTicks) : null;
  return { convoy, offset, leg };
}

/** The leg that ends on this tick, if one does. The fourth ends as the convoy reaches port. */
export function legEnding(totalTicks: number): { convoy: number; leg: number } | null {
  const { convoy, offset } = seaClock(totalTicks);
  if (offset === 0 || offset % SEA.legTicks !== 0 || offset > SEA.legs * SEA.legTicks) return null;
  return { convoy, leg: offset / SEA.legTicks - 1 };
}

/** FNV-1a with a murmur finaliser: a stable, well-mixed 32-bit hash of a string. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

const inRange = ([lo, hi]: [number, number], seed: number): number => lo + (seed % (hi - lo + 1));

/** A leg's raiders, monsters and guard. Pure: the same spot, convoy and leg always roll the same. */
export function legRoll(row: ConvoyDef, convoy: number, leg: number): LegRoll {
  const at = `${row.id}:${convoy}:${leg}`;
  return {
    raiders: inRange(row.raiders, hash(`${at}:raiders`)),
    monsters: inRange(row.monsters, hash(`${at}:monsters`)),
    guard: inRange(row.guard, hash(`${at}:guard`)),
  };
}

// ---------- The formulas ----------

/** What a convoy holds before its first leg. The privateers' pirates have already taken it. */
export function startingCargo(flow: SeaFlow): ConvoyCargo {
  return flow === 'recover' ? { crates: 0, carried: SEA.crates } : { crates: SEA.crates, carried: 0 };
}

/**
 * One leg, by the side's formula (sea.data.ts `SeaFlow`). `battery` is the
 * rating fired this leg (0 for a leg sailed without the player); `kills` the
 * side's prey killed at this water during the leg. Integers in, integers out.
 */
export function resolveLeg(flow: SeaFlow, roll: LegRoll, cargo: ConvoyCargo, battery: number, kills: number): LegOutcome {
  switch (flow) {
    case 'convoy': {
      const lost = clamp(roll.raiders + roll.monsters - kills - battery, 0, cargo.crates);
      return { cargo: { ...cargo, crates: cargo.crates - lost }, moved: lost, credited: 0 };
    }
    case 'escort': {
      const lost = clamp(roll.monsters - kills - battery, 0, cargo.crates);
      return { cargo: { ...cargo, crates: cargo.crates - lost }, moved: lost, credited: 0 };
    }
    case 'raid': {
      const seized = clamp(battery - (roll.guard - kills), 0, cargo.crates);
      return { cargo: { ...cargo, crates: cargo.crates - seized }, moved: seized, credited: seized };
    }
    case 'recover': {
      const recovered = clamp(battery - (roll.raiders - kills), 0, cargo.carried);
      return { cargo: { ...cargo, carried: cargo.carried - recovered }, moved: recovered, credited: recovered };
    }
  }
}

/** Convoy and escort are paid at port, for the crates still aboard after the last leg. */
export function paidAtPort(flow: SeaFlow): boolean {
  return flow === 'convoy' || flow === 'escort';
}

// ---------- The battery ----------

export interface Battery {
  /** Cannons held, up to `SEA.maxCannons`. */
  cannons: number;
  volleys: number;
  hit: number;
  morale: number;
  /** volleys × hit + morale. */
  rating: number;
  /** What a leg fired now would spend: one of each that is true. */
  shot: boolean;
  powder: boolean;
  ration: boolean;
}

/** How many of a material the player holds, every grade together. */
export function heldCount(state: GameState, id: string): number {
  if (isGraded(id)) return gradesHeld(state, id).reduce((n, g) => n + g.qty, 0);
  return state.materials[id] ?? 0;
}

function spendOne(state: GameState, id: string): void {
  if (isGraded(id)) {
    // gradesHeld is best first: spend the worst.
    const worst = gradesHeld(state, id).pop();
    if (worst) takeGraded(state, id, worst.quality, 1);
    return;
  }
  const left = (state.materials[id] ?? 0) - 1;
  if (left > 0) state.materials[id] = left;
  else delete state.materials[id];
}

/**
 * The battery a leg fired now would have. The ship supplies volleys 1, hit 1,
 * morale 0, so a player with an empty hold still fires 1. Cannons (kept, up
 * to `maxCannons`) add a volley each when a cannonball loads them; a powder
 * charge adds 1 hit; a ration adds 1 morale. Smithing, alchemy and cooking
 * each raise it; none is required.
 */
export function batteryOf(state: GameState): Battery {
  const cannons = Math.min(heldCount(state, SEA.cannon), SEA.maxCannons);
  const shot = cannons > 0 && heldCount(state, SEA.shot) > 0;
  const powder = heldCount(state, SEA.powder) > 0;
  const ration = heldCount(state, SEA.ration) > 0;
  const volleys = 1 + (shot ? cannons : 0);
  const hit = 1 + (powder ? 1 : 0);
  const morale = ration ? 1 : 0;
  return { cannons, volleys, hit, morale, rating: volleys * hit + morale, shot, powder, ration };
}

/** Fire the battery for one leg: what `batteryOf` reports, and the hold pays for it. */
export function fireBattery(state: GameState): Battery {
  const b = batteryOf(state);
  if (b.shot) spendOne(state, SEA.shot);
  if (b.powder) spendOne(state, SEA.powder);
  if (b.ration) spendOne(state, SEA.ration);
  return b;
}

// ---------- The merchants' port sale ----------

export interface DealTerm {
  id: string;
  level: number;
  gold: number;
  met: boolean;
}

/** Gold per crate sold: `SEA_DEAL.base` plus every term the Speechcraft level meets. */
export function dealPrice(state: GameState): { price: number; level: number; terms: DealTerm[] } {
  const level = state.skills[SEA_DEAL.skill]?.level ?? 0;
  const terms = SEA_DEAL.terms.map((t) => ({ id: t.id, level: t.level, gold: t.gold, met: level >= t.level }));
  const price = SEA_DEAL.base + terms.reduce((n, t) => n + (t.met ? t.gold : 0), 0);
  return { price, level, terms };
}

// ---------- Presence and the stored convoy ----------

/** Present at a water: standing on it, doing something, not travelling, not knocked out. */
export function presentAt(state: GameState, spotId: string): boolean {
  return state.spot === spotId && !state.travel && !state.recovering && !isIdle(state);
}

const cargoKey = (spot: string, part: 'convoy' | 'leg' | 'crates' | 'carried'): string => `sea:${spot}:${part}`;
const killKey = (spot: string, part: 'kills' | 'leg'): string => `sea:${spot}:kills${part === 'leg' ? ':leg' : ''}`;

/**
 * The convoy's cargo as it stands before `leg` (0-based) of `convoy` at this
 * water: the stored cargo if the player has sailed with this convoy, else a
 * fresh convoy; then every leg since folded in without the player. Pure.
 */
export function cargoBefore(state: GameState, side: SeaSideDef, row: ConvoyDef, convoy: number, leg: number): ConvoyCargo {
  let cargo = startingCargo(side.flow);
  let next = 0;
  if ((state.stats[cargoKey(row.id, 'convoy')] ?? 0) === convoy + 1) {
    cargo = { crates: state.stats[cargoKey(row.id, 'crates')] ?? 0, carried: state.stats[cargoKey(row.id, 'carried')] ?? 0 };
    next = state.stats[cargoKey(row.id, 'leg')] ?? 0;
  }
  for (let j = next; j < leg; j++) cargo = resolveLeg(side.flow, legRoll(row, convoy, j), cargo, 0, 0).cargo;
  return cargo;
}

/** The side's prey killed at this water during this leg. */
export function legKills(state: GameState, spot: string, convoy: number, leg: number): number {
  return state.stats[killKey(spot, 'leg')] === convoy * SEA.legs + leg + 1 ? (state.stats[killKey(spot, 'kills')] ?? 0) : 0;
}

// ---------- The tick ----------

/**
 * Called once per advance (Game.advance), after the activity has ticked.
 * Cheap on every tick but the four a convoy hour that end a leg. `offline` is
 * true during catch-up (Game.catchingUp).
 */
export function tickSea(state: GameState, bus: EventBus, offline: boolean): void {
  const due = legEnding(state.totalTicks);
  if (!due) return;
  const row = CONVOYS[state.spot];
  if (!row || !presentAt(state, row.id)) return;
  const side = seaSide(state);
  if (!side) return;
  sailLeg(state, bus, side, row, due.convoy, due.leg, offline);
}

function sailLeg(
  state: GameState,
  bus: EventBus,
  side: SeaSideDef,
  row: ConvoyDef,
  convoy: number,
  leg: number,
  offline: boolean,
): void {
  const before = cargoBefore(state, side, row, convoy, leg);
  const battery = fireBattery(state);
  const kills = offline ? 0 : legKills(state, row.id, convoy, leg);
  const roll = legRoll(row, convoy, leg);
  const out = resolveLeg(side.flow, roll, before, battery.rating, kills);
  const last = leg === SEA.legs - 1;
  const credited = paidAtPort(side.flow) ? (last ? out.cargo.crates : 0) : out.credited;

  setStat(state, bus, cargoKey(row.id, 'convoy'), convoy + 1);
  setStat(state, bus, cargoKey(row.id, 'leg'), leg + 1);
  setStat(state, bus, cargoKey(row.id, 'crates'), out.cargo.crates);
  setStat(state, bus, cargoKey(row.id, 'carried'), out.cargo.carried);

  const n = leg + 1;
  const legs = SEA.legs;
  const rating = battery.rating;
  const moved = out.moved;
  const { crates, carried } = out.cargo;
  const line =
    side.flow === 'convoy'
      ? text('sea.leg_convoy', { leg: n, legs, threat: roll.raiders + roll.monsters, rating, kills, lost: moved, crates })
      : side.flow === 'escort'
        ? text('sea.leg_escort', { leg: n, legs, monsters: roll.monsters, rating, kills, lost: moved, crates })
        : side.flow === 'raid'
          ? text('sea.leg_raid', { leg: n, legs, guard: roll.guard, rating, kills, seized: moved })
          : text('sea.leg_recover', { leg: n, legs, crew: roll.raiders, rating, kills, recovered: moved, carried });
  bus.emit({ type: 'log', msg: line, kind: 'combat' });
  if (credited > 0) credit(state, bus, side, row, credited, offline);
}

/** Pay `n` credited crates: online to `sea:crates:won` and gold or cargo; offline as cargo at 25%. */
function credit(state: GameState, bus: EventBus, side: SeaSideDef, row: ConvoyDef, n: number, offline: boolean): void {
  if (offline) {
    const before = state.stats[SEA_CRATES_OFFLINE] ?? 0;
    bumpStat(state, bus, SEA_CRATES_OFFLINE, n);
    const after = before + n;
    const paid = Math.floor(after / SEA.offlineShare) - Math.floor(before / SEA.offlineShare);
    payCargo(state, row, paid);
    return;
  }
  bumpStat(state, bus, SEA_CRATES_WON, n);
  const total = state.stats[SEA_CRATES_WON] ?? 0;
  if (side.flow === 'convoy') {
    const { price } = dealPrice(state);
    const gold = n * price;
    state.gold += gold;
    bumpStat(state, bus, 'gold:earned', gold);
    bus.emit({ type: 'log', msg: text('sea.sold', { crates: n, price, gold, total }), kind: 'loot' });
  } else {
    const list = payCargo(state, row, n);
    bus.emit({ type: 'log', msg: text('sea.won', { crates: n, total, list }), kind: 'loot' });
  }
  checkFloorClears(state, bus);
}

/** One material per crate from the row; returns "Rock Salt ×2, Iron Ingot" for the log. */
function payCargo(state: GameState, row: ConvoyDef, n: number): string {
  const got: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const id = row.cargo[randInt(state, 0, row.cargo.length - 1)];
    grantMaterial(state, id, 1);
    got[id] = (got[id] ?? 0) + 1;
  }
  return Object.entries(got)
    .map(([id, qty]) => `${MATERIALS[id]?.name ?? id}${qty > 1 ? ` ×${qty}` : ''}`)
    .join(', ');
}

// ---------- Listeners ----------

/**
 * Kills on the water count against the leg in progress; a won fight on the
 * water counts under `fights:<spot>` (the harbor floors' clears read one, and
 * a water has no `fightLimit`, so it never clears); the run's mission boss on
 * floor 14 stamps `SEA_MISSION_DONE`. Registered before the level listeners,
 * so the floor-clear check that follows a kill sees the stamp.
 */
export function registerSeaListeners(state: GameState, bus: EventBus): void {
  bus.on('kill', (ev) => {
    const side = seaSide(state);
    if (!side) return;
    const id = ev.monster.defId;
    if (id === side.mission.monsterId && state.spot === side.mission.spot) setStat(state, bus, SEA_MISSION_DONE, 1);
    if (!isWater(state.spot) || !side.prey.includes(id)) return;
    const clock = seaClock(state.totalTicks);
    if (clock.leg === null) return;
    const legId = clock.convoy * SEA.legs + clock.leg + 1;
    const legKey = killKey(state.spot, 'leg');
    const killsKey = killKey(state.spot, 'kills');
    if (state.stats[legKey] !== legId) {
      setStat(state, bus, legKey, legId);
      setStat(state, bus, killsKey, 0);
    }
    bumpStat(state, bus, killsKey);
  });
  bus.on('fight:won', (ev) => {
    if (isWater(ev.spot)) bumpStat(state, bus, fightsKey(ev.spot));
  });
}

// ---------- The readout ----------

export interface ConvoyView {
  side: SeaSideDef;
  row: ConvoyDef;
  clock: SeaClock;
  /** Ticks until the current leg ends, or until the next convoy sails. */
  ticksToNext: number;
  /** The leg in progress and what it rolled; null in port. */
  roll: LegRoll | null;
  kills: number;
  /** Cargo before the leg in progress (or after the last leg, in port). */
  cargo: ConvoyCargo;
  present: boolean;
}

/** Everything the sea panel shows at a water. Pure: reads, never spends. */
export function convoyView(state: GameState): ConvoyView | null {
  const row = CONVOYS[state.spot];
  const side = seaSide(state);
  if (!row || !side) return null;
  const clock = seaClock(state.totalTicks);
  const leg = clock.leg;
  const ticksToNext =
    leg === null ? SEA.convoyTicks - clock.offset : (leg + 1) * SEA.legTicks - clock.offset;
  return {
    side,
    row,
    clock,
    ticksToNext,
    roll: leg === null ? null : legRoll(row, clock.convoy, leg),
    kills: leg === null ? 0 : legKills(state, row.id, clock.convoy, leg),
    cargo: cargoBefore(state, side, row, clock.convoy, leg ?? SEA.legs),
    present: presentAt(state, row.id),
  };
}
