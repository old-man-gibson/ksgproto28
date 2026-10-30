import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { EventBus } from '../src/core/engine/events';
import { ADJACENCY, FLOORS, MONSTERS, NPCS, SPOTS } from '../src/core/registry';
import { encounterLevel } from '../src/core/systems/levels';
import {
  dropRowsFor,
  eligibleEncounters,
  spawnGroup,
  spawnMonster,
  spotCleared,
  tickCombat,
} from '../src/core/systems/combat';
import { applyStatus, hasStatus } from '../src/core/systems/statuses';
import { clearMet, climbTo, floorUnlocked, ladderFloors } from '../src/core/systems/towers';
import { startTravel, tickTravel } from '../src/core/systems/locations';
import { claimedFinds } from '../src/core/systems/actions';
import { getDerivedStats } from '../src/core/systems/derived';
import { spawnLevels, monsterTagSet } from '../src/core/systems/bestiary';
import { materialSellPrice, sellMaterial } from '../src/core/systems/equipment';
import { resaleCeiling, visibleLines } from '../src/core/systems/shops';
import type { GameState, MonsterInstance, SpotEncounter } from '../src/core/types';
import { clearFloors } from './fixtures/floors';

/**
 * Band 5, the desert (docs/FLOOR_IDEAS.md §4): the Weighing on floor 19, the
 * judge's level rise, method drops and the killing blow's type, the seam
 * verb, the band's gates and clears, and the broker.
 */

const FOOT = 'ascent_foot';
const TAKEN = 'flag:tomb:taken';
const DESERT_FLOORS = ['ascent_f18', 'ascent_f19', 'ascent_f20'];

const fresh = (): GameState => createInitialState(0, FOOT);

/** Every ladder floor below rung `index`, by id. */
const below = (index: number): string[] =>
  ladderFloors('the_ascent')
    .filter((f) => f.index < index)
    .map((f) => f.id);

/** Park a game at a spot, discovered. */
function at(spot: string, seed = 1): Game {
  const g = new Game(createInitialState(seed, FOOT));
  g.state.spot = spot;
  if (!g.state.discovered.includes(spot)) g.state.discovered.push(spot);
  return g;
}

/** Units held of a material, plain or graded (graded ones live in `stock`). */
const held = (s: GameState, id: string): number =>
  (s.materials[id] ?? 0) + Object.values(s.stock[id] ?? {}).reduce((sum, n) => sum + (n ?? 0), 0);

function explore(g: Game, ticks: number): void {
  g.selectActivity('explore');
  for (let i = 0; i < ticks; i++) g.tick();
}

/** The judge's row on floor 19's door. */
const judgeRow = (): SpotEncounter => SPOTS.f19_door.encounters!.find((e) => e.monsterId === 'ph_sabaket')!;

/**
 * Win one fight at `spotId` by damage over time: every enemy at 1 HP and
 * carrying `statusId`, then the combat clock runs until the field is empty.
 * The player is kept standing so nothing but the conditions decides it.
 */
function winByCondition(g: Game, spotId: string, statusId: string): MonsterInstance[] {
  const s = g.state;
  s.spot = spotId;
  const spot = SPOTS[spotId];
  const enemies = spawnGroup(s, spot);
  s.combat = {
    enemies,
    playerBar: 0,
    momentum: 0,
    position: 'neutral',
    cooldowns: {},
    buffs: [],
    events: {},
  };
  const foes = enemies.filter((e): e is MonsterInstance => e !== null);
  for (const foe of foes) {
    applyStatus(s, foe, { id: statusId, intensity: 5 }, 'test');
    foe.hp = 1;
  }
  for (let i = 0; i < 50 && s.combat; i++) {
    s.resources.hp = getDerivedStats(s).maxHp;
    s.totalTicks += 1;
    tickCombat(s, g.bus, spot);
  }
  expect(s.combat, `${spotId}: the fight did not end`).toBeNull();
  s.respawnTimer = 0;
  return foes;
}

describe('the judge’s level (SpotEncounter.levelRise)', () => {
  // The entry's own example: B = 30, r = 0.1, C = 45.
  const EXAMPLE: Pick<SpotEncounter, 'levelRise'> = { levelRise: { stat: TAKEN, share: 0.1, ceiling: 45 } };
  const judgeAt = (taken: number, level: number): number => {
    const s = fresh();
    s.stats[TAKEN] = taken;
    s.level = level;
    return encounterLevel(s, EXAMPLE, 30);
  };

  it('matches the example points: six pieces at P 20, 30, 40, 50; three at P 30', () => {
    expect(judgeAt(6, 20)).toBe(42);
    expect(judgeAt(6, 30)).toBe(45);
    expect(judgeAt(6, 40)).toBe(45);
    expect(judgeAt(6, 50)).toBe(45);
    expect(judgeAt(3, 30)).toBe(39);
  });

  it('nothing taken is the base; every piece costs at least one level', () => {
    expect(judgeAt(0, 40)).toBe(30);
    expect(judgeAt(6, 5)).toBe(36); // round(6 × 0.1 × 5) = 3, floored at 6
    expect(judgeAt(1, 1)).toBe(31);
  });

  it('a line without levelRise keeps its roll', () => {
    const s = fresh();
    s.stats[TAKEN] = 6;
    expect(encounterLevel(s, {}, 30)).toBe(30);
  });

  it('the live judge keeps 6r < 1 and a ceiling at or under the band’s top monster level', () => {
    const rise = judgeRow().levelRise!;
    expect(6 * rise.share).toBeLessThan(1);
    const top = Math.max(
      ...DESERT_FLOORS.flatMap((id) =>
        Object.values(SPOTS)
          .filter((sp) => sp.areaId === FLOORS[id].areaId)
          .flatMap((sp) => (sp.encounters ?? []).filter((e) => !e.levelRise).map((e) => e.level[1])),
      ),
    );
    expect(rise.ceiling).toBeLessThanOrEqual(top);
    expect(rise.ceiling).toBeGreaterThanOrEqual(judgeRow().level[1]);
  });

  it('spawning applies it after the roll; a pinned override spawn does not', () => {
    const s = fresh();
    const door = SPOTS.f19_door;
    const base = judgeRow().level[0];
    expect(spawnMonster(s, door).level).toBe(base);
    s.stats[TAKEN] = 2;
    s.level = 10;
    expect(spawnMonster(s, door).level).toBe(base + 2); // max(2, round(2)) = 2
    s.stats[TAKEN] = 6;
    s.level = 20;
    expect(spawnMonster(s, door).level).toBe(judgeRow().levelRise!.ceiling);
    expect(spawnMonster(s, door, { monsterId: 'ph_sabaket', level: base }).level).toBe(base);
  });

  it('the bestiary’s level range reads the same function', () => {
    const s = fresh();
    const base = judgeRow().level[0];
    expect(spawnLevels('ph_sabaket')).toEqual([base, base]);
    expect(spawnLevels('ph_sabaket', s)).toEqual([base, base]);
    s.stats[TAKEN] = 1;
    s.level = 20;
    expect(spawnLevels('ph_sabaket', s)).toEqual([base + 2, base + 2]);
  });
});

describe('the Weighing: the tomb seals when the judge falls', () => {
  it('searching the treasury takes all six goods, each bumping flag:tomb:taken', () => {
    const g = at('f19_treasury');
    explore(g, 400);
    expect(g.state.stats[TAKEN]).toBe(6);
    expect(claimedFinds(g.state, 'f19_treasury')).toHaveLength(6);
    expect(g.state.materials.bronze_ingot ?? 0).toBeGreaterThan(0);
  });

  it('after the judge’s first kill nothing can be taken', () => {
    const g = at('f19_treasury');
    g.state.stats['boss:f19_door'] = 1;
    explore(g, 400);
    expect(g.state.stats[TAKEN] ?? 0).toBe(0);
    expect(claimedFinds(g.state, 'f19_treasury')).toEqual([]);
    expect(g.state.materials.bronze_ingot ?? 0).toBe(0);
  });

  it('goods taken before the clear stay counted; the rest stay sealed', () => {
    const g = at('f19_treasury');
    explore(g, 200); // past 0.16, 0.33 and 0.5 of 360 ticks
    const before = g.state.stats[TAKEN];
    expect(before).toBe(3);
    g.state.stats['boss:f19_door'] = 1;
    explore(g, 300);
    expect(g.state.stats[TAKEN]).toBe(before);
    expect(claimedFinds(g.state, 'f19_treasury')).toHaveLength(3);
  });

  it('the chamber → door edge is forced one way; the way back is a plain road', () => {
    const into = ADJACENCY.get('f19_chamber')!.find((e) => e.to === 'f19_door')!;
    const back = ADJACENCY.get('f19_door')!.find((e) => e.to === 'f19_chamber')!;
    expect(into.forced).toBe(true);
    expect(back.forced).toBeFalsy();
    // Exploring the chamber takes nothing: the goods are in their own room.
    expect(SPOTS.f19_chamber.finds ?? []).toEqual([]);
  });
});

describe('method drops (DropEntry.killedBy) and the killing blow (MonsterInstance.lastHit)', () => {
  it('unmatched rows leave the table and their weight rolls as nothing', () => {
    const loot = MONSTERS.ph_mummy.loot;
    const total = loot.entries.reduce((sum, e) => sum + e.weight, 0);
    const ids = (rows: ReturnType<typeof dropRowsFor>) => rows.filter((r) => r.kind !== 'nothing').map((r) => r.id);
    const weight = (rows: ReturnType<typeof dropRowsFor>) => rows.reduce((sum, e) => sum + e.weight, 0);

    expect(ids(dropRowsFor(loot, 'heat'))).toEqual(['bone_ash']);
    expect(ids(dropRowsFor(loot, 'bludgeoning'))).toEqual(['bone_dust']);
    expect(ids(dropRowsFor(loot, 'slashing'))).toEqual([]);
    expect(ids(dropRowsFor(loot, undefined))).toEqual([]);
    // Every row keeps its authored share: the table weighs the same.
    for (const type of ['heat', 'bludgeoning', 'slashing', undefined] as const) {
      expect(weight(dropRowsFor(loot, type))).toBe(total);
    }
  });

  it('damage over time sets lastHit to its type', () => {
    const g = at('f18_tomb_row');
    for (const [status, type] of [
      ['poison', 'poison'],
      ['on_fire', 'heat'],
    ] as const) {
      const [foe] = winByCondition(g, 'f18_forecourt', status);
      expect(foe.defId).toBe('ph_sand_colossus');
      expect(foe.lastHit).toBe(type);
    }
  });

  it('a kill by an unmatched type banks no drought miss for the keyed row', () => {
    // The colossus: quicksilver (6%) is keyed to bludgeoning, the boss token
    // (10%) to nothing. Both sit under the 15% line, so mercy tracks both.
    const g = at('f18_forecourt');
    const keyed = 'loot:ph_sand_colossus:material:quicksilver';
    const plain = 'loot:ph_sand_colossus:material:boss_token';
    let plainSeen = false;
    for (let i = 0; i < 12; i++) {
      winByCondition(g, 'f18_forecourt', 'poison');
      expect(g.state.mercy?.[keyed], `kill ${i}: a poison kill wrote the quicksilver ledger`).toBeUndefined();
      plainSeen ||= (g.state.mercy?.[plain] ?? 0) > 0;
    }
    expect(plainSeen, 'the unkeyed rare row never banked a miss').toBe(true);
    expect(held(g.state, 'quicksilver')).toBe(0);
  });

  it('heat kills of mummies pay bone ash and never bone dust', () => {
    const g = at('f18_tomb_row', 7);
    let kills = 0;
    for (let fights = 0; kills < 40 && fights < 200; fights++) {
      for (const foe of winByCondition(g, 'f18_tomb_row', 'on_fire')) {
        if (foe.defId === 'ph_mummy') kills += 1;
      }
    }
    expect(kills).toBeGreaterThanOrEqual(40);
    expect(held(g.state, 'bone_ash')).toBeGreaterThan(0);
    expect(held(g.state, 'bone_dust')).toBe(0);
  });
});

describe('the seam verb (FloorDef.seam)', () => {
  /** Floors up to 19 cleared and both gates met, standing on floor 18's landing. */
  function climber(): { s: GameState; bus: EventBus; lines: string[] } {
    const s = fresh();
    clearFloors(s.stats, below(20));
    s.stats['kills:tag:desert'] = 150;
    s.spot = FLOORS.ascent_f18.landing!;
    const bus = new EventBus();
    const lines: string[] = [];
    bus.on('log', (ev) => lines.push(ev.msg));
    return { s, bus, lines };
  }
  const arrive = (s: GameState, bus: EventBus) => {
    for (let i = 0; i < 10_000 && s.travel; i++) tickTravel(s, bus);
    expect(s.travel).toBeNull();
  };

  it('floor 20 → 21 is Sailing', () => {
    expect(FLOORS.ascent_f20.seam?.verb).toBe('Sailing');
  });

  it('is read on a climb of exactly one rung up from the floor that declares it', () => {
    // Floor 21 does not exist yet, so floor 18 lends its seam for the test.
    const had = FLOORS.ascent_f18.seam;
    FLOORS.ascent_f18.seam = { verb: 'Wading' };
    try {
      const { s, bus, lines } = climber();
      expect(climbTo(s, bus, 'ascent_f19')).toBe(true);
      expect(lines.at(-1)).toContain('Wading to');
      arrive(s, bus);

      // Down a rung, then two rungs up: neither is the seam.
      expect(climbTo(s, bus, 'ascent_f18')).toBe(true);
      expect(lines.at(-1)).toContain('Descending to');
      arrive(s, bus);
      expect(climbTo(s, bus, 'ascent_f20')).toBe(true);
      expect(lines.at(-1)).toContain('Climbing to');
      arrive(s, bus);

      // Out of floor 20, down, Sailing stays on its own step.
      expect(climbTo(s, bus, 'ascent_f19')).toBe(true);
      expect(lines.at(-1)).toContain('Descending to');
    } finally {
      if (had) FLOORS.ascent_f18.seam = had;
      else delete FLOORS.ascent_f18.seam;
    }
  });

  it('climbing into floor 20 is an ordinary climb', () => {
    const { s, bus, lines } = climber();
    s.spot = FLOORS.ascent_f19.landing!;
    expect(climbTo(s, bus, 'ascent_f20')).toBe(true);
    expect(lines.at(-1)).toContain('Climbing to');
  });
});

describe('the band’s gates', () => {
  it('every species on floors 18 to 20 carries the desert tag', () => {
    for (const id of DESERT_FLOORS) {
      for (const spot of Object.values(SPOTS).filter((sp) => sp.areaId === FLOORS[id].areaId)) {
        for (const e of spot.encounters ?? []) {
          expect(monsterTagSet(e.monsterId).has('desert'), `${spot.id}: ${e.monsterId}`).toBe(true);
        }
      }
    }
  });

  it('floor 19 opens at 60 desert kills, floor 20 at 150', () => {
    for (const [floor, needed] of [
      ['ascent_f19', 60],
      ['ascent_f20', 150],
    ] as const) {
      const s = fresh();
      clearFloors(s.stats, below(FLOORS[floor].index));
      s.stats['kills:tag:desert'] = needed - 1;
      expect(floorUnlocked(s, FLOORS[floor]), `${floor} at ${needed - 1}`).toBe(false);
      s.stats['kills:tag:desert'] = needed;
      expect(floorUnlocked(s, FLOORS[floor]), `${floor} at ${needed}`).toBe(true);
    }
  });

  it('a desert kill counts toward the gates', () => {
    const g = at('f18_forecourt');
    winByCondition(g, 'f18_forecourt', 'poison');
    expect(g.state.stats['kills:tag:desert']).toBe(1);
  });
});

describe('each floor’s clear', () => {
  it('floor 18: the forecourt guardian’s kill, and it fights again', () => {
    const g = at('f18_forecourt');
    expect(clearMet(g.state, FLOORS.ascent_f18)).toBe(false);
    winByCondition(g, 'f18_forecourt', 'poison');
    expect(clearMet(g.state, FLOORS.ascent_f18)).toBe(true);
    expect(eligibleEncounters(g.state, SPOTS.f18_forecourt).map((e) => e.monsterId)).toEqual(['ph_sand_colossus']);
  });

  it('floor 19: the judge’s kill, and it fights again', () => {
    const g = at('f19_door');
    expect(clearMet(g.state, FLOORS.ascent_f19)).toBe(false);
    const [judge] = winByCondition(g, 'f19_door', 'poison');
    expect(judge.defId).toBe('ph_sabaket');
    expect(clearMet(g.state, FLOORS.ascent_f19)).toBe(true);
    expect(eligibleEncounters(g.state, SPOTS.f19_door).map((e) => e.monsterId)).toEqual(['ph_sabaket']);
  });

  it('floor 20: the roadstead’s one fight, against all three of the crew', () => {
    const g = at('f20_roadstead');
    expect(clearMet(g.state, FLOORS.ascent_f20)).toBe(false);
    const crew = winByCondition(g, 'f20_roadstead', 'poison');
    expect(crew.map((m) => m.defId)).toEqual(['ph_roadstead_crew', 'ph_roadstead_crew', 'ph_roadstead_crew']);
    expect(clearMet(g.state, FLOORS.ascent_f20)).toBe(true);
    expect(spotCleared(g.state, SPOTS.f20_roadstead)).toBe(true);
  });

  it('three obelisk reads leave the roadstead crew surprised; two do not', () => {
    for (const [reads, surprised] of [
      [2, false],
      [3, true],
    ] as const) {
      const g = at('f20_quay');
      g.state.stats['flag:chart'] = reads;
      expect(startTravel(g.state, g.bus, 'f20_roadstead')).toBe(true);
      for (let i = 0; i < 10_000 && g.state.travel; i++) tickTravel(g.state, g.bus);
      const crew = (g.state.combat?.enemies ?? []).filter((e): e is MonsterInstance => e !== null);
      expect(crew.length, 'the forced edge started no fight').toBe(3);
      for (const m of crew) expect(hasStatus(m, 'surprised'), `${reads} reads`).toBe(surprised);
    }
  });
});

describe('the broker', () => {
  it('sells nothing, so nothing it holds can be bought back below resale', () => {
    const broker = NPCS.f20_broker;
    expect(broker.spotId).toBe('f20_quay');
    expect(visibleLines(fresh(), broker)).toEqual([]);
  });

  it('buys at the global sell price: the quay pays what any other spot pays', () => {
    // Bronze ingots: a grave good, and a plain (ungraded) stack.
    const paid = (spot: string): number => {
      const s = fresh();
      s.spot = spot;
      s.materials.bronze_ingot = 5;
      const expected = materialSellPrice(s, 'bronze_ingot') * 5;
      // The no-arbitrage floor reads the same global formula.
      expect(resaleCeiling(s, { kind: 'material', id: 'bronze_ingot' }, 1)).toBe(
        materialSellPrice(s, 'bronze_ingot', 1),
      );
      const before = s.gold;
      sellMaterial(s, new EventBus(), 'bronze_ingot');
      expect(s.gold - before).toBe(expected);
      return s.gold - before;
    };
    expect(paid('f20_quay')).toBe(paid(FOOT));
  });
});
