import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { SEA, SEA_DEAL, type ConvoyDef, type SeaSideDef } from '../src/core/data/sea.data';
import {
  batteryOf,
  dealPrice,
  fireBattery,
  legEnding,
  legRoll,
  resolveLeg,
  seaClock,
  startingCargo,
  type LegRoll,
} from '../src/core/systems/sea';
import type { GameState } from '../src/core/types';
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
