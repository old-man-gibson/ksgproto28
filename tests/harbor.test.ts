import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { EventBus } from '../src/core/engine/events';
import { CONVOYS, FLOORS, NPCS, SEA_SIDES, SPOTS } from '../src/core/registry';
import {
  SEA,
  SEA_CRATES_OFFLINE,
  SEA_CRATES_WON,
  SEA_DEAL,
  SEA_MISSION_DONE,
  type ConvoyDef,
  type SeaSideDef,
} from '../src/core/data/sea.data';
import {
  batteryOf,
  cargoBefore,
  convoyView,
  dealPrice,
  fireBattery,
  heldCount,
  legEnding,
  legRoll,
  registerSeaListeners,
  resolveLeg,
  seaClock,
  seaSide,
  startingCargo,
  tickSea,
  type LegRoll,
} from '../src/core/systems/sea';
import { acceptQuest, acceptedKey, availableQuests } from '../src/core/systems/quests';
import { eligibleEncounters, fightsKey } from '../src/core/systems/combat';
import { visibleEdges } from '../src/core/systems/locations';
import { conditionsMet } from '../src/core/systems/conditions';
import { floorCleared, floorUnlocked } from '../src/core/systems/ladder';
import { runOfflineProgress } from '../src/core/save/offline';
import type { Game } from '../src/core/game';
import type { GameState, MonsterInstance } from '../src/core/types';
import { clearFloors } from './fixtures/floors';

/**
 * The harbor band (docs/FLOOR_IDEAS.md §4 idea 3): the convoy resolver, the
 * battery, the side pick, and floors 11 to 14 walked by each side.
 */

const fresh = (): GameState => createInitialState(0);

/** A row for formula tests, independent of the authored waters. */
const ROW: ConvoyDef = { id: 'test_water', raiders: [1, 3], monsters: [0, 2], guard: [1, 2], cargo: ['iron_ingot'] };

const roll = (raiders: number, monsters: number, guard: number): LegRoll => ({ raiders, monsters, guard });

/** Run four legs of one flow and return what the side is credited. */
function convoyCredit(flow: SeaSideDef['flow'], rolls: LegRoll[], battery: number, kills: number[] = [0, 0, 0, 0]): number {
  let cargo = startingCargo(flow);
  let credited = 0;
  rolls.forEach((r, i) => {
    const out = resolveLeg(flow, r, cargo, battery, kills[i]);
    cargo = out.cargo;
    credited += out.credited;
  });
  return flow === 'convoy' || flow === 'escort' ? cargo.crates : credited;
}

describe('the schedule', () => {
  it('a convoy every 3,600 ticks, four legs of 300, then port', () => {
    expect(seaClock(0)).toEqual({ convoy: 0, offset: 0, leg: 0 });
    expect(seaClock(299).leg).toBe(0);
    expect(seaClock(300).leg).toBe(1);
    expect(seaClock(1199).leg).toBe(3);
    expect(seaClock(1200).leg).toBeNull();
    expect(seaClock(3599).leg).toBeNull();
    expect(seaClock(3600)).toEqual({ convoy: 1, offset: 0, leg: 0 });
  });

  it('a leg resolves on the tick that ends it, and only then', () => {
    const ends = [];
    for (let t = 0; t < 2 * SEA.convoyTicks; t++) if (legEnding(t)) ends.push([t, legEnding(t)!.leg]);
    expect(ends).toEqual([
      [300, 0], [600, 1], [900, 2], [1200, 3],
      [3900, 0], [4200, 1], [4500, 2], [4800, 3],
    ]);
  });

  it('a leg roll is a pure function of water, convoy and leg, inside the row', () => {
    for (let c = 0; c < 50; c++) {
      for (let leg = 0; leg < SEA.legs; leg++) {
        const r = legRoll(ROW, c, leg);
        expect(r).toEqual(legRoll(ROW, c, leg));
        expect(r.raiders).toBeGreaterThanOrEqual(1);
        expect(r.raiders).toBeLessThanOrEqual(3);
        expect(r.monsters).toBeGreaterThanOrEqual(0);
        expect(r.monsters).toBeLessThanOrEqual(2);
        expect(r.guard).toBeGreaterThanOrEqual(1);
        expect(r.guard).toBeLessThanOrEqual(2);
      }
    }
    // Every value in a range turns up over enough convoys.
    const seen = new Set<number>();
    for (let c = 0; c < 200; c++) seen.add(legRoll(ROW, c, 0).raiders);
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });
});

describe('the convoy formulas, one per side', () => {
  // The spec's example (idea 3, the battery): threat [3, 3, 4, 4].
  const threat = [roll(2, 1, 0), roll(2, 1, 0), roll(2, 2, 0), roll(2, 2, 0)];

  it('merchants: crates lost = clamp(threat − kills − battery); the rest are sold', () => {
    // Base battery alone loses 2 + 2 + 3 + 3, clamped to all 8.
    expect(convoyCredit('convoy', threat, 1)).toBe(0);
    // Two cannons, a cannonball a leg and a ration: rating 4, nothing lost.
    expect(convoyCredit('convoy', threat, 4)).toBe(8);
    // Kills subtract threat on top of the battery.
    expect(convoyCredit('convoy', threat, 1, [2, 2, 3, 3])).toBe(8);
    expect(convoyCredit('convoy', threat, 1, [1, 1, 1, 1])).toBe(2);
  });

  it('navy: crates lost = clamp(monsters − kills − battery); raiders are not its fight', () => {
    expect(convoyCredit('escort', [roll(9, 2, 0), roll(9, 2, 0), roll(9, 3, 0), roll(9, 3, 0)], 1)).toBe(2);
    expect(convoyCredit('escort', [roll(9, 2, 0), roll(9, 2, 0), roll(9, 3, 0), roll(9, 3, 0)], 3)).toBe(8);
    expect(convoyCredit('escort', [roll(9, 2, 0), roll(9, 2, 0), roll(9, 3, 0), roll(9, 3, 0)], 1, [1, 1, 2, 2])).toBe(8);
  });

  it('pirates: crates seized = clamp(battery − (guard − kills)), credited per leg', () => {
    const guarded = [roll(0, 0, 2), roll(0, 0, 2), roll(0, 0, 3), roll(0, 0, 3)];
    expect(convoyCredit('raid', guarded, 1)).toBe(0);
    expect(convoyCredit('raid', guarded, 4)).toBe(2 + 2 + 1 + 1);
    expect(convoyCredit('raid', guarded, 1, [2, 2, 3, 3])).toBe(4);
    // Never more than the convoy holds.
    expect(convoyCredit('raid', guarded, 20)).toBe(SEA.crates);
  });

  it('privateers: crates recovered = clamp(battery − (crew − kills)) out of the pirates’ prize', () => {
    const crews = [roll(2, 0, 0), roll(2, 0, 0), roll(3, 0, 0), roll(3, 0, 0)];
    expect(startingCargo('recover')).toEqual({ crates: 0, carried: SEA.crates });
    expect(convoyCredit('recover', crews, 1)).toBe(0);
    expect(convoyCredit('recover', crews, 4)).toBe(2 + 2 + 1 + 1);
    expect(convoyCredit('recover', crews, 1, [2, 2, 3, 3])).toBe(4);
    expect(convoyCredit('recover', crews, 20)).toBe(SEA.crates);
  });

  it('crates are conserved and every number stays an integer', () => {
    for (const flow of ['convoy', 'escort', 'raid', 'recover'] as const) {
      for (let c = 0; c < 40; c++) {
        let cargo = startingCargo(flow);
        let credited = 0;
        for (let leg = 0; leg < SEA.legs; leg++) {
          const out = resolveLeg(flow, legRoll(ROW, c, leg), cargo, c % 6, c % 4);
          for (const n of [out.cargo.crates, out.cargo.carried, out.moved, out.credited]) {
            expect(Number.isInteger(n) && n >= 0).toBe(true);
          }
          cargo = out.cargo;
          credited += out.credited;
        }
        expect(cargo.crates + cargo.carried + credited).toBeLessThanOrEqual(SEA.crates);
      }
    }
  });
});

describe('the battery', () => {
  it('the ship alone fires 1: volleys 1, hit 1, morale 0', () => {
    expect(batteryOf(fresh())).toMatchObject({ volleys: 1, hit: 1, morale: 0, rating: 1 });
  });

  it('rating = volleys × hit + morale; the spec example rates 4', () => {
    const s = fresh();
    s.materials[SEA.cannon] = 2;
    s.materials[SEA.shot] = 5;
    s.stock[SEA.ration] = { c: 3 };
    expect(batteryOf(s)).toMatchObject({ cannons: 2, volleys: 3, hit: 1, morale: 1, rating: 4 });
    s.materials[SEA.powder] = 1;
    expect(batteryOf(s)).toMatchObject({ volleys: 3, hit: 2, morale: 1, rating: 7 });
  });

  it('cannons without shot are dry, and past four add nothing', () => {
    const s = fresh();
    s.materials[SEA.cannon] = 9;
    expect(batteryOf(s)).toMatchObject({ cannons: SEA.maxCannons, volleys: 1, shot: false });
    s.materials[SEA.shot] = 1;
    expect(batteryOf(s).volleys).toBe(1 + SEA.maxCannons);
  });

  it('a leg spends one shot, one powder and the worst ration; cannons are kept', () => {
    const s = fresh();
    s.materials[SEA.cannon] = 2;
    s.materials[SEA.shot] = 2;
    s.materials[SEA.powder] = 1;
    s.stock[SEA.ration] = { a: 1, d: 1 };
    expect(fireBattery(s).rating).toBe(3 * 2 + 1);
    expect(s.materials[SEA.cannon]).toBe(2);
    expect(s.materials[SEA.shot]).toBe(1);
    expect(s.materials[SEA.powder]).toBeUndefined();
    expect(s.stock[SEA.ration]).toEqual({ a: 1 });
    // Shot is not spent with no cannon to load.
    const bare = fresh();
    bare.materials[SEA.shot] = 3;
    fireBattery(bare);
    expect(bare.materials[SEA.shot]).toBe(3);
  });

  it('the merchants’ price per crate is the base plus each Speechcraft term met', () => {
    const s = fresh();
    expect(dealPrice(s).price).toBe(SEA_DEAL.base);
    s.skills[SEA_DEAL.skill] = { level: 15, xp: 0 } as GameState['skills'][string];
    expect(dealPrice(s).price).toBe(SEA_DEAL.base + 1 + 2);
    expect(dealPrice(s).terms.map((t) => t.met)).toEqual([true, true, false]);
  });
});

// ---------- The authored harbor (floors 11 to 14) ----------

const SIDES = Object.values(SEA_SIDES);

/** A later run, every floor below 11 cleared. */
function harborRun(): GameState {
  const s = fresh();
  s.stats['legacy:stronghold'] = 1;
  clearFloors(s.stats, Object.values(FLOORS).filter((f) => f.bandId && f.index < 11).map((f) => f.id));
  return s;
}

/** Accept a side's join quest the way the player does: at its giver's berth. */
function join(s: GameState, side: SeaSideDef, bus = new EventBus()): boolean {
  s.spot = NPCS[side.giver].spotId;
  return acceptQuest(s, bus, side.joinQuest);
}

/** Every spot reachable from `from` over the roads this state can see and use. */
function reachable(s: GameState, from: string): Set<string> {
  const seen = new Set([from]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    for (const e of visibleEdges(s, queue[i])) {
      if (seen.has(e.to) || (e.requires && !conditionsMet(s, e.requires))) continue;
      seen.add(e.to);
      queue.push(e.to);
    }
  }
  return seen;
}

/** Stand on a water, hunting, on the tick that ends `leg` of `convoy`. */
function atLegEnd(s: GameState, water: string, convoy: number, leg: number): void {
  s.spot = water;
  s.activity = 'hunt';
  s.totalTicks = convoy * SEA.convoyTicks + (leg + 1) * SEA.legTicks;
}

/** Everything held, plain counts and graded stock together. */
const holdings = (s: GameState): number =>
  Object.values(s.materials).reduce((n, q) => n + q, 0) +
  Object.values(s.stock).reduce((n, grades) => n + Object.values(grades).reduce((a, b) => a + (b ?? 0), 0), 0);

describe('the side pick', () => {
  it('accepting a join quest stamps it and picks the side; the other three are withdrawn', () => {
    for (const side of SIDES) {
      const s = harborRun();
      expect(seaSide(s)).toBeNull();
      expect(join(s, side)).toBe(true);
      expect(s.stats[acceptedKey(side.joinQuest)]).toBe(1);
      expect(seaSide(s)?.id).toBe(side.id);
      for (const other of SIDES) {
        if (other.id === side.id) continue;
        s.spot = NPCS[other.giver].spotId;
        expect(availableQuests(s, NPCS[other.giver]).map((q) => q.id)).not.toContain(other.joinQuest);
        expect(acceptQuest(s, new EventBus(), other.joinQuest)).toBe(false);
        expect(seaSide(s)?.id).toBe(side.id);
      }
    }
  });

  it('the pick holds for the run: turning the join quest in keeps the side', () => {
    const s = harborRun();
    join(s, SEA_SIDES.navy);
    s.quests[SEA_SIDES.navy.joinQuest].status = 'done';
    expect(seaSide(s)?.id).toBe('navy');
  });

  it('a new run starts with no side', () => {
    expect(seaSide(createInitialState(0))).toBeNull();
  });

  it('each water rolls only the side’s own crews; before a pick, sea monsters only', () => {
    for (const water of ['f11_roadstead', 'f12_strait', 'f12_far_water', 'f13_picket', 'f13_blockade']) {
      const none = harborRun();
      expect(eligibleEncounters(none, SPOTS[water]).every((e) => e.monsterId === 'ph_reef_eel'), water).toBe(true);
      for (const side of SIDES) {
        const s = harborRun();
        join(s, side);
        const ids = eligibleEncounters(s, SPOTS[water]).map((e) => e.monsterId);
        expect(ids.length, `${water} ${side.id}`).toBeGreaterThan(0);
        for (const id of ids) expect(side.prey, `${water} ${side.id} rolls ${id}`).toContain(id);
      }
    }
  });
});

describe('the convoy at a water', () => {
  it('a present merchant sells the crates left after the fourth leg, at the Speechcraft price', () => {
    const s = harborRun();
    const bus = new EventBus();
    join(s, SEA_SIDES.merchants, bus);
    // Strong enough that nothing is lost: four cannons, shot, powder, a ration a leg.
    s.materials[SEA.cannon] = 4;
    s.materials[SEA.shot] = 4;
    s.materials[SEA.powder] = 4;
    s.stock[SEA.ration] = { c: 4 };
    const gold = s.gold;
    for (let leg = 0; leg < SEA.legs; leg++) {
      atLegEnd(s, 'f11_roadstead', 7, leg);
      tickSea(s, bus, false);
      if (leg < SEA.legs - 1) expect(s.stats[SEA_CRATES_WON] ?? 0, 'paid at port, not per leg').toBe(0);
    }
    expect(s.stats[SEA_CRATES_WON]).toBe(SEA.crates);
    expect(s.gold - gold).toBe(SEA.crates * dealPrice(s).price);
    // Four legs spent four of each; the cannons stay.
    expect(heldCount(s, SEA.shot)).toBe(0);
    expect(heldCount(s, SEA.powder)).toBe(0);
    expect(heldCount(s, SEA.ration)).toBe(0);
    expect(heldCount(s, SEA.cannon)).toBe(4);
  });

  it('a present pirate is paid per leg, in cargo from the water’s row', () => {
    const s = harborRun();
    const bus = new EventBus();
    join(s, SEA_SIDES.pirates, bus);
    const row = CONVOYS.f11_roadstead;
    s.materials[SEA.cannon] = 4;
    s.materials[SEA.shot] = 4;
    s.materials[SEA.powder] = 4;
    let expected = 0;
    let cargo = startingCargo('raid');
    for (let leg = 0; leg < SEA.legs; leg++) {
      const out = resolveLeg('raid', legRoll(row, 3, leg), cargo, batteryOf(s).rating, 0);
      cargo = out.cargo;
      expected += out.credited;
      const held = holdings(s);
      atLegEnd(s, row.id, 3, leg);
      tickSea(s, bus, false);
      expect(s.stats[SEA_CRATES_WON] ?? 0).toBe(expected);
      // One shot and one powder spent, one cargo per crate seized.
      expect(holdings(s) - held).toBe(out.credited - 2);
    }
    expect(expected).toBeGreaterThan(0);
  });

  it('kills of the side’s prey at the water count against the leg they fall in', () => {
    const s = harborRun();
    const bus = new EventBus();
    registerSeaListeners(s, bus);
    join(s, SEA_SIDES.merchants, bus);
    const prey = { defId: 'ph_pirate_cutthroat' } as MonsterInstance;
    const other = { defId: 'ph_convoy_guard' } as MonsterInstance;
    s.spot = 'f11_roadstead';
    s.totalTicks = 5 * SEA.convoyTicks + 10; // leg 0 of convoy 5
    bus.emit({ type: 'kill', monster: prey, xp: 0 });
    bus.emit({ type: 'kill', monster: prey, xp: 0 });
    bus.emit({ type: 'kill', monster: other, xp: 0 });
    expect(convoyView(s)?.kills).toBe(2);
    s.totalTicks += SEA.legTicks; // leg 1 counts afresh
    expect(convoyView(s)?.kills).toBe(0);
    // The kills reach the formula: leg 0 resolves with them.
    const cargo = startingCargo('convoy');
    const expected = resolveLeg('convoy', legRoll(CONVOYS.f11_roadstead, 5, 0), cargo, 1, 2).cargo;
    atLegEnd(s, 'f11_roadstead', 5, 0);
    tickSea(s, bus, false);
    expect(cargoBefore(s, SEA_SIDES.merchants, CONVOYS.f11_roadstead, 5, 1)).toEqual(expected);
  });

  it('a won fight on a water counts under fights:<water>, and the water never clears', () => {
    const s = harborRun();
    const bus = new EventBus();
    registerSeaListeners(s, bus);
    for (let i = 0; i < 3; i++) bus.emit({ type: 'fight:won', spot: 'f11_roadstead', forced: false });
    expect(s.stats[fightsKey('f11_roadstead')]).toBe(3);
    expect(SPOTS.f11_roadstead.fightLimit).toBeUndefined();
  });

  it('no leg resolves for a player who is idle, travelling, elsewhere or sideless', () => {
    const cases: [string, (s: GameState) => void][] = [
      ['idle', (s) => (s.activity = null)],
      ['elsewhere', (s) => (s.spot = 'f11_quay')],
      ['travelling', (s) => (s.travel = { to: 'f11_quay', ticksLeft: 5 } as unknown as GameState['travel'])],
      ['sideless', (s) => delete s.stats[acceptedKey(SEA_SIDES.navy.joinQuest)]],
    ];
    for (const [why, spoil] of cases) {
      const s = harborRun();
      join(s, SEA_SIDES.navy);
      s.materials[SEA.shot] = 1;
      s.materials[SEA.cannon] = 1;
      atLegEnd(s, 'f11_roadstead', 2, 3);
      spoil(s);
      tickSea(s, new EventBus(), false);
      expect(s.stats[SEA_CRATES_WON] ?? 0, why).toBe(0);
      expect(s.materials[SEA.shot], `${why}: the hold is untouched`).toBe(1);
    }
  });

  it('legs sailed without the player are folded in with no battery and no kills', () => {
    const s = harborRun();
    join(s, SEA_SIDES.navy);
    const row = CONVOYS.f11_roadstead;
    // Present only for the last leg: the convoy met the monsters alone on the first three.
    let cargo = startingCargo('escort');
    for (let leg = 0; leg < 3; leg++) cargo = resolveLeg('escort', legRoll(row, 9, leg), cargo, 0, 0).cargo;
    expect(cargoBefore(s, SEA_SIDES.navy, row, 9, 3)).toEqual(cargo);
    const last = resolveLeg('escort', legRoll(row, 9, 3), cargo, 1, 0).cargo.crates;
    atLegEnd(s, row.id, 9, 3);
    tickSea(s, new EventBus(), false);
    expect(s.stats[SEA_CRATES_WON] ?? 0).toBe(last);
  });
});

describe('offline: the convoy coarsens', () => {
  it('offline legs fire the battery without kills, pay cargo at 25%, and never reach crates won', () => {
    const s = harborRun();
    const bus = new EventBus();
    join(s, SEA_SIDES.navy, bus);
    s.spot = 'f11_roadstead';
    s.activity = 'hunt';
    // Kills on record are ignored offline.
    s.stats['sea:f11_roadstead:kills:leg'] = 1;
    s.stats['sea:f11_roadstead:kills'] = 99;
    const before = holdings(s);
    // Eight hours of catch-up: 80 convoys at the base battery.
    let expected = 0;
    for (let c = 0; c < 80; c++) {
      let cargo = startingCargo('escort');
      for (let leg = 0; leg < SEA.legs; leg++) cargo = resolveLeg('escort', legRoll(CONVOYS.f11_roadstead, c, leg), cargo, 1, 0).cargo;
      expected += cargo.crates;
    }
    for (let t = 1; t <= 80 * SEA.convoyTicks; t++) {
      s.totalTicks = t;
      tickSea(s, bus, true);
    }
    expect(expected).toBeGreaterThan(0);
    expect(s.stats[SEA_CRATES_WON] ?? 0).toBe(0);
    expect(s.stats[SEA_CRATES_OFFLINE]).toBe(expected);
    expect(holdings(s) - before).toBe(Math.floor(expected / SEA.offlineShare));
    // No clear moves on offline crates.
    expect(floorCleared(s, FLOORS.ascent_f11)).toBe(false);
  });

  it('catch-up marks its ticks as offline for the convoy, and only its ticks', () => {
    const seen: boolean[] = [];
    const game = {
      state: fresh(),
      suppressLog: false,
      catchingUp: false,
      tick() {
        seen.push(this.catchingUp);
      },
    };
    runOfflineProgress(game as unknown as Game, 2 * 60 * 1000);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every(Boolean)).toBe(true);
    expect(game.catchingUp).toBe(false);
  });
});

describe('floors 11 to 14, walked by each side', () => {
  const lanes: Record<string, string> = {
    merchants: 'f12_trade_lane',
    pirates: 'f12_hidden_cove',
    privateers: 'f12_hunting_ground',
    navy: 'f12_patrol_lane',
  };

  for (const side of SIDES) {
    it(`${side.id}: every floor is reachable and clears`, () => {
      const s = harborRun();
      const bus = new EventBus();
      registerSeaListeners(s, bus);

      // Floor 11: the road leads to the berths and the roadstead.
      expect(floorUnlocked(s, FLOORS.ascent_f11)).toBe(true);
      expect(reachable(s, 'f11_road').has(NPCS[side.giver].spotId)).toBe(true);
      expect(reachable(s, 'f11_road').has('f11_roadstead')).toBe(true);
      join(s, side, bus);
      expect(floorCleared(s, FLOORS.ascent_f11)).toBe(false);
      s.stats[SEA_CRATES_WON] = 8;
      expect(floorCleared(s, FLOORS.ascent_f11), 'crates alone do not clear').toBe(false);
      bus.emit({ type: 'fight:won', spot: 'f11_roadstead', forced: false });
      expect(floorCleared(s, FLOORS.ascent_f11)).toBe(true);

      // Floor 12: the side's own lane and the strait, never another side's lane.
      // (The cove is hidden until the port is searched: mark it combed.)
      expect(floorUnlocked(s, FLOORS.ascent_f12)).toBe(true);
      s.explored['f12_landing'] = SPOTS.f12_landing.exploreTicks!;
      const r12 = reachable(s, 'f12_landing');
      expect(r12.has('f12_far_water')).toBe(true);
      expect(r12.has('f12_strait')).toBe(true);
      for (const [owner, lane] of Object.entries(lanes)) expect(r12.has(lane), `${side.id} sees ${lane}`).toBe(owner === side.id);
      s.stats[SEA_CRATES_WON] = 40;
      expect(floorCleared(s, FLOORS.ascent_f12)).toBe(false);
      bus.emit({ type: 'fight:won', spot: 'f12_far_water', forced: false });
      expect(floorCleared(s, FLOORS.ascent_f12)).toBe(true);

      // Floor 13: the blockade by the picket line; the pilot's channel once bought.
      expect(floorUnlocked(s, FLOORS.ascent_f13)).toBe(true);
      expect(reachable(s, 'f13_landing').has('f13_blockade')).toBe(true);
      const channel = visibleEdges(s, 'f13_landing').find((e) => e.to === 'f13_blockade')!;
      expect(conditionsMet(s, channel.requires!)).toBe(false);
      s.stats['shop:buys:f13_pilot'] = 1;
      expect(conditionsMet(s, channel.requires!)).toBe(true);
      s.stats[SEA_CRATES_WON] = 160;
      bus.emit({ type: 'fight:won', spot: 'f13_blockade', forced: false });
      expect(floorCleared(s, FLOORS.ascent_f13)).toBe(true);

      // Floor 14: only the side's own wing; its boss's kill is the clear.
      expect(floorUnlocked(s, FLOORS.ascent_f14)).toBe(true);
      const r14 = reachable(s, 'f14_landing');
      for (const other of SIDES) {
        expect(r14.has(other.mission.spot), `${side.id} reaches ${other.mission.spot}`).toBe(other.id === side.id);
      }
      expect(floorCleared(s, FLOORS.ascent_f14)).toBe(false);
      // Another side's boss stamps nothing.
      const stray = SIDES.find((o) => o.id !== side.id)!;
      s.spot = stray.mission.spot;
      bus.emit({ type: 'kill', monster: { defId: stray.mission.monsterId } as MonsterInstance, xp: 0 });
      expect(s.stats[SEA_MISSION_DONE] ?? 0).toBe(0);
      s.spot = side.mission.spot;
      bus.emit({ type: 'kill', monster: { defId: side.mission.monsterId } as MonsterInstance, xp: 0 });
      expect(s.stats[SEA_MISSION_DONE]).toBe(1);
      expect(floorCleared(s, FLOORS.ascent_f14)).toBe(true);
    });
  }

  it('a first climb never reaches the harbor', () => {
    expect(reachable(fresh(), 'f11_road').has('f11_quay')).toBe(false);
  });

  it('each mission boss is a once fight, and the side’s preparation opens its fight with a condition', () => {
    const prep: Record<string, string> = {
      merchants: 'f11_merchants_clearance',
      pirates: 'f11_pirates_signal',
      privateers: 'f11_privateers_letter',
      navy: 'f11_navy_lure',
    };
    for (const side of SIDES) {
      const spot = SPOTS[side.mission.spot];
      expect(spot.fightLimit).toBe(1);
      expect(spot.encounters?.some((e) => e.monsterId === side.mission.monsterId && e.once)).toBe(true);
      const way = Object.values(SPOTS)
        .flatMap((sp) => sp.connections)
        .find((c) => c.to === side.mission.spot)!;
      expect(way.approach?.requires).toEqual([{ type: 'quest', id: prep[side.id] }]);
      expect(way.approach?.enemies?.length).toBeGreaterThan(0);
    }
  });
});
