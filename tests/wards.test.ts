import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInitialState, SAVE_VERSION } from '../src/core/state';
import { Game } from '../src/core/game';
import { EventBus } from '../src/core/engine/events';
import { FLOORS, MONSTERS, PRESTIGE_BOONS, SPOTS } from '../src/core/registry';
import { WARD_WINDOWS } from '../src/core/data/wards.data';
import { bandPosKey, floorCleared } from '../src/core/systems/ladder';
import { checkFloorClears, syncBandPositions } from '../src/core/systems/levels';
import {
  KEPT_WOUND_CAP,
  liveEnemies,
  spawnMonster,
  startStagedGroup,
  sweepDead,
} from '../src/core/systems/combat';
import { statsFromAttrs } from '../src/core/systems/monsterStats';
import { tickWards, wardClockKey } from '../src/core/systems/wards';
import { wardContentIssues, wardStatKeys } from '../src/core/systems/wardValidation';
import { clearSpotIds } from '../src/core/systems/floorRules';
import { deserialize, serialize } from '../src/core/save/save';
import { migrate } from '../src/core/save/migrations';
import { runOfflineProgress } from '../src/core/save/offline';
import type { FloorDef, GameState, MonsterInstance, SpotDef, WardWindowDef } from '../src/core/types';
import { clearFloors } from './fixtures/floors';

// Band 3's ward engine (docs/plans/bands-2-3.md "The four wards"): ward
// positions, clear stamps (M10), kept wounds (M11) and ward windows (M12).
// The ward content is built elsewhere, so these run on fixtures: a window
// pushed into WARD_WINDOWS for the test, `keepsWounds` and `stampOnClear` set
// on floor 1's Vermin Hall and its rats, each restored after.

const WARDS = ['ascent_f7', 'ascent_f8', 'ascent_f9', 'ascent_f10'];
const HALL = 'f1_storerooms';
const RAT = 'forest_rat';
const FOOT = 'ascent_foot';

/** Floors 1-6 cleared and the city key owned: the city is open. */
function cityOpen(spot = FOOT): GameState {
  const s = createInitialState(0, spot);
  s.stats['flag:tutorial_done'] = 1;
  clearFloors(s.stats);
  s.prestige.purchases.city_key = 1;
  return s;
}

const pos = (s: GameState, floorId: string) => s.stats[bandPosKey(floorId)] ?? 0;

/** Hunt the Vermin Hall until a rat fight starts; returns the rat. */
function ratFight(g: Game): MonsterInstance {
  g.state.spot = HALL;
  g.state.activity = 'hunt';
  g.state.respawnTimer = 0;
  for (let i = 0; i < 50 && !g.state.combat; i++) g.tick();
  const rat = liveEnemies(g.state.combat!).find((e) => e.defId === RAT);
  expect(rat, 'a rat fight started').toBeTruthy();
  return rat!;
}

/** Take the front enemy down through the real kill path. */
function killFront(g: Game): void {
  g.state.combat!.enemies[0]!.hp = 0;
  sweepDead(g.state, g.bus);
}

const maxHpOf = (m: MonsterInstance) => statsFromAttrs(m.attrs).maxHp;

// ---------- Ward positions ----------

describe('ward positions (band:pos:<floor>)', () => {
  it('are live while a ward is uncleared and frozen at its clear', () => {
    const s = cityOpen();
    const bus = new EventBus();
    checkFloorClears(s, bus);
    for (const id of WARDS) expect(pos(s, id), id).toBe(0);

    clearFloors(s.stats, ['ascent_f8']);
    checkFloorClears(s, bus);
    expect([pos(s, 'ascent_f7'), pos(s, 'ascent_f8'), pos(s, 'ascent_f9'), pos(s, 'ascent_f10')]).toEqual([1, 0, 1, 1]);

    clearFloors(s.stats, ['ascent_f9']);
    checkFloorClears(s, bus);
    expect([pos(s, 'ascent_f7'), pos(s, 'ascent_f8'), pos(s, 'ascent_f9'), pos(s, 'ascent_f10')]).toEqual([2, 0, 1, 2]);

    clearFloors(s.stats, ['ascent_f10']);
    checkFloorClears(s, bus);
    expect([pos(s, 'ascent_f7'), pos(s, 'ascent_f8'), pos(s, 'ascent_f9'), pos(s, 'ascent_f10')]).toEqual([3, 0, 1, 2]);

    clearFloors(s.stats, ['ascent_f7']);
    checkFloorClears(s, bus);
    expect(pos(s, 'ascent_f7')).toBe(3);
  });

  it('a ward cleared first stays at position 0 while the others fall', () => {
    // Its later forms are gated on the position, so they never reopen.
    const s = cityOpen();
    const bus = new EventBus();
    clearFloors(s.stats, ['ascent_f7']);
    checkFloorClears(s, bus);
    for (const id of ['ascent_f8', 'ascent_f9', 'ascent_f10']) {
      clearFloors(s.stats, [id]);
      checkFloorClears(s, bus);
      expect(pos(s, 'ascent_f7')).toBe(0);
    }
  });

  it('two wards cleared between one check and the next freeze at the same count', () => {
    const s = cityOpen();
    const bus = new EventBus();
    clearFloors(s.stats, ['ascent_f8', 'ascent_f9']);
    checkFloorClears(s, bus);
    expect(pos(s, 'ascent_f8')).toBe(0);
    expect(pos(s, 'ascent_f9')).toBe(0);
    expect(pos(s, 'ascent_f7')).toBe(2);
    expect(pos(s, 'ascent_f10')).toBe(2);
  });

  it('a save that cleared wards before positions existed reads them on load and on import', () => {
    const s = cityOpen();
    clearFloors(s.stats, ['ascent_f8', 'ascent_f9']);
    expect(s.stats[bandPosKey('ascent_f7')]).toBeUndefined();

    const booted = new Game(deserialize(serialize(s)));
    expect(pos(booted.state, 'ascent_f7')).toBe(2);
    expect(pos(booted.state, 'ascent_f10')).toBe(2);
    // Cleared before any record: no position was ever taken, so it reads 0.
    expect(booted.state.stats[bandPosKey('ascent_f8')]).toBeUndefined();

    const g = new Game(cityOpen());
    Object.assign(g.state, deserialize(serialize(s)));
    g.resyncAnnouncers();
    expect(pos(g.state, 'ascent_f7')).toBe(2);
  });

  it('prestige wipes them: the new run reads 0 everywhere', () => {
    const g = new Game(cityOpen());
    clearFloors(g.state.stats, ['ascent_f8', 'ascent_f9', 'ascent_f10']);
    checkFloorClears(g.state, g.bus);
    expect(pos(g.state, 'ascent_f7')).toBe(3);
    expect(g.prestige(0)).toBe(true);
    for (const id of WARDS) expect(g.state.stats[bandPosKey(id)], id).toBeUndefined();
  });

  it('lower band passes move nothing; a pass on the band freezes every position where it stands', () => {
    const s = createInitialState(0, FOOT);
    s.prestige.purchases.pass_lower = 1;
    s.prestige.purchases.pass_wilds = 1;
    s.prestige.purchases.city_key = 1;
    const bus = new EventBus();
    syncBandPositions(s, bus);
    for (const id of WARDS) expect(pos(s, id), id).toBe(0);

    clearFloors(s.stats, ['ascent_f8']);
    syncBandPositions(s, bus);
    expect(pos(s, 'ascent_f7')).toBe(1);
    PRESTIGE_BOONS.test_pass_city = { ...PRESTIGE_BOONS.pass_wilds, id: 'test_pass_city', effect: { kind: 'bandPass', bandId: 'ascent_upper' } };
    try {
      s.prestige.purchases.test_pass_city = 1;
      clearFloors(s.stats, ['ascent_f9']);
      syncBandPositions(s, bus);
      expect([pos(s, 'ascent_f7'), pos(s, 'ascent_f9'), pos(s, 'ascent_f10')]).toEqual([1, 1, 1]);
    } finally {
      delete PRESTIGE_BOONS.test_pass_city;
    }
  });
});

// ---------- M10: stampOnClear ----------

describe('a spot stamps its clear (stampOnClear)', () => {
  const stamp = 'test:hall:done';
  beforeEach(() => {
    SPOTS[HALL].stampOnClear = stamp;
  });
  afterEach(() => {
    delete SPOTS[HALL].stampOnClear;
  });

  it('writes 1 the moment the fight budget is spent, not before', () => {
    const g = new Game(createInitialState(1, HALL));
    g.state.stats['flag:tutorial_done'] = 1;
    g.state.stats[`fights:${HALL}`] = 4;
    ratFight(g);
    killFront(g);
    expect(g.state.stats[`fights:${HALL}`]).toBe(5);
    expect(g.state.stats[stamp]).toBeUndefined();
    ratFight(g);
    killFront(g);
    expect(g.state.stats[`fights:${HALL}`]).toBe(6);
    expect(g.state.stats[stamp]).toBe(1);
  });

  it('once: a stamp another spot already wrote is left as it is', () => {
    const g = new Game(createInitialState(2, HALL));
    g.state.stats['flag:tutorial_done'] = 1;
    g.state.stats[`fights:${HALL}`] = 5;
    g.state.stats[stamp] = 2;
    ratFight(g);
    killFront(g);
    expect(g.state.stats[`fights:${HALL}`]).toBe(6);
    expect(g.state.stats[stamp]).toBe(2);
  });
});

// ---------- M11: keepsWounds ----------

describe('a monster keeps its wounds (keepsWounds)', () => {
  const key = 'test:rat:wounds';
  beforeEach(() => {
    MONSTERS[RAT].keepsWounds = { key, share: 0.5 };
  });
  afterEach(() => {
    delete MONSTERS[RAT].keepsWounds;
  });

  function hurtRat(seed: number): { g: Game; rat: MonsterInstance; expected: number } {
    const g = new Game(createInitialState(seed, HALL));
    g.state.stats['flag:tutorial_done'] = 1;
    const rat = ratFight(g);
    rat.hp = Math.round(maxHpOf(rat) * 0.4);
    return { g, rat, expected: 0.5 * (1 - rat.hp / maxHpOf(rat)) };
  }

  it('walking away (an activity switch) writes share × the share of max HP it is missing', () => {
    const { g, expected } = hurtRat(3);
    g.selectActivity(null);
    expect(g.state.combat).toBeNull();
    expect(g.state.stats[key]).toBeCloseTo(expected, 10);
  });

  it('travel and the ladder write it too', () => {
    const walk = hurtRat(4);
    expect(walk.g.travelTo('f1_landing')).toBe(true);
    expect(walk.g.state.stats[key]).toBeCloseTo(walk.expected, 10);

    const climb = hurtRat(5);
    expect(climb.g.climbTo(null)).toBe(true);
    expect(climb.g.state.combat).toBeNull();
    expect(climb.g.state.stats[key]).toBeCloseTo(climb.expected, 10);
  });

  it('a knockout writes it', () => {
    const g = new Game(createInitialState(6, HALL));
    g.state.stats['flag:tutorial_done'] = 1;
    startStagedGroup(g.state, g.bus, SPOTS[HALL], [{ monsterId: RAT, level: 60 }]);
    const rat = liveEnemies(g.state.combat!)[0];
    rat.hp = Math.round(maxHpOf(rat) * 0.5);
    for (let i = 0; i < 5000 && g.state.combat; i++) g.tick();
    expect(g.state.lastFight?.outcome).toBe('knocked_out');
    expect(g.state.stats[key]).toBeCloseTo(0.5 * (1 - rat.hp / maxHpOf(rat)), 10);
  });

  it('a save taken mid-fight records it as walked away, and leaves the live fight alone', () => {
    const { g, expected } = hurtRat(7);
    const saved = JSON.parse(serialize(g.state)) as GameState;
    expect(saved.stats[key]).toBeCloseTo(expected, 10);
    expect(g.state.stats[key]).toBeUndefined();
    expect(g.state.combat).not.toBeNull();
  });

  it('the next spawn starts that much lower, and never at or under 0', () => {
    const s = createInitialState(8, HALL);
    s.stats[key] = 0.3;
    const a = spawnMonster(s, SPOTS[HALL], { monsterId: RAT, level: 1 });
    expect(a.hp).toBe(Math.max(1, Math.round(maxHpOf(a) * 0.7)));
    s.stats[key] = 5;
    const b = spawnMonster(s, SPOTS[HALL], { monsterId: RAT, level: 1 });
    expect(b.hp).toBe(Math.max(1, Math.round(maxHpOf(b) * (1 - KEPT_WOUND_CAP))));
    expect(b.hp).toBeGreaterThanOrEqual(1);
  });

  it('is held to the cap', () => {
    MONSTERS[RAT].keepsWounds = { key, share: 1 };
    const g = new Game(createInitialState(9, HALL));
    g.state.stats['flag:tutorial_done'] = 1;
    const rat = ratFight(g);
    rat.hp = 1;
    g.selectActivity(null);
    expect(g.state.stats[key]).toBe(KEPT_WOUND_CAP);
  });

  it('keeps every earlier wound, and adds share × only what this fight took', () => {
    const g = new Game(createInitialState(11, HALL));
    g.state.stats['flag:tutorial_done'] = 1;
    g.state.stats[key] = 0.3;
    // Untouched: it leaves as hurt as it came in, never healed by a retreat.
    ratFight(g);
    g.selectActivity(null);
    expect(g.state.stats[key]).toBeGreaterThanOrEqual(0.3 - 1e-9);
    expect(g.state.stats[key]).toBeLessThan(0.31);
    // Hurt to 40% of max: of the missing share, 0.3 was old; keeps old + 0.5 × the rest.
    const before = g.state.stats[key];
    const rat = ratFight(g);
    rat.hp = Math.round(maxHpOf(rat) * 0.4);
    const missing = 1 - rat.hp / maxHpOf(rat);
    g.selectActivity(null);
    expect(g.state.stats[key]).toBeCloseTo(before + 0.5 * (missing - before), 10);
  });

  it('its death deletes the stat', () => {
    const g = new Game(createInitialState(10, HALL));
    g.state.stats['flag:tutorial_done'] = 1;
    g.state.stats[key] = 0.3;
    ratFight(g);
    killFront(g);
    expect(g.state.combat).toBeNull();
    expect(g.state.stats[key]).toBeUndefined();
  });
});

// ---------- M12: ward windows ----------

describe('ward windows', () => {
  const W: WardWindowDef = {
    id: 'test_window',
    floorId: 'ascent_f7',
    position: 3,
    ticks: 20,
    spotId: HALL,
    monsterId: RAT,
    doneKey: 'test:w:done',
    atKey: 'test:w:at',
    goneKey: 'test:w:gone',
    foughtKey: 'test:w:fought',
    flags: { fought: 'flag:test:w:fought', unmet: 'flag:test:w:unmet' },
  };
  const clock = wardClockKey(W);
  let savedClear: FloorDef['clear'];

  beforeEach(() => {
    WARD_WINDOWS.push(W);
    savedClear = FLOORS[W.floorId].clear;
    FLOORS[W.floorId].clear = [{ type: 'stat', key: W.doneKey, value: 1 }];
  });
  afterEach(() => {
    WARD_WINDOWS.splice(WARD_WINDOWS.indexOf(W), 1);
    FLOORS[W.floorId].clear = savedClear;
    delete SPOTS[HALL].stampOnClear;
  });

  /** Wards 8-10 cleared, so ward 7 sits at position 3; idle at the Foot. */
  function lastWardLeft(): Game {
    const g = new Game(cityOpen());
    clearFloors(g.state.stats, ['ascent_f8', 'ascent_f9', 'ascent_f10']);
    checkFloorClears(g.state, g.bus);
    return g;
  }

  /** Exactly one flag or none, and which. */
  const flags = (s: GameState) => [W.flags.fought, W.flags.unmet].filter((k) => (s.stats[k] ?? 0) >= 1);

  it('opens when the ward reaches its position, not before', () => {
    const g = new Game(cityOpen());
    clearFloors(g.state.stats, ['ascent_f8', 'ascent_f9']);
    checkFloorClears(g.state, g.bus);
    g.tick();
    expect(g.state.stats[W.atKey]).toBeUndefined();
    clearFloors(g.state.stats, ['ascent_f10']);
    checkFloorClears(g.state, g.bus);
    g.tick();
    expect(g.state.stats[W.atKey]).toBe(g.state.totalTicks);
  });

  it('never opens on a ward already cleared', () => {
    const g = lastWardLeft();
    g.state.stats[W.doneKey] = 1;
    g.tick();
    expect(g.state.stats[W.atKey]).toBeUndefined();
  });

  it('lapses unmet after its ticks of play: the ward is cleared, one silent flag', () => {
    // No clear XP for the ward here, so the lapse tick's only log line is the
    // city's "every floor cleared": nothing names the flag.
    const xp = FLOORS[W.floorId].clearXp;
    delete FLOORS[W.floorId].clearXp;
    try {
      const g = lastWardLeft();
      g.tick();
      expect(g.state.stats[W.atKey]).toBeDefined();
      for (let i = 0; i < W.ticks - 1; i++) g.tick();
      expect(g.state.stats[W.doneKey]).toBeUndefined();
      const logs: string[] = [];
      g.bus.on('log', (e) => logs.push(e.msg));
      g.tick();
      expect(g.state.stats[clock]).toBe(W.ticks);
      expect(g.state.stats[W.goneKey]).toBe(1);
      expect(g.state.stats[W.doneKey]).toBe(1);
      expect(flags(g.state)).toEqual([W.flags.unmet]);
      expect(floorCleared(g.state, FLOORS[W.floorId])).toBe(true);
      expect(g.state.stats['cleared:band:ascent_upper']).toBe(1);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain('The City');
      // Nothing more happens to it.
      for (let i = 0; i < 50; i++) g.tick();
      expect(flags(g.state)).toEqual([W.flags.unmet]);
    } finally {
      FLOORS[W.floorId].clearXp = xp;
    }
  });

  it('a fight that hurt the threat and was walked away from lapses as fought', () => {
    const g = lastWardLeft();
    g.tick();
    const rat = ratFight(g);
    for (let i = 0; i < 500 && g.state.combat && rat.lastHit === undefined; i++) g.tick();
    expect(rat.lastHit, 'the player landed a hit').toBeDefined();
    expect(g.state.combat, 'the rat is still standing').not.toBeNull();
    g.selectActivity(null);
    expect(g.state.stats[W.foughtKey]).toBe(1);
    for (let i = 0; i < W.ticks && !g.state.stats[W.doneKey]; i++) g.tick();
    expect(g.state.stats[W.goneKey]).toBe(1);
    expect(flags(g.state)).toEqual([W.flags.fought]);
  });

  it('walking in and straight out marks nothing', () => {
    const g = lastWardLeft();
    g.tick();
    ratFight(g);
    g.selectActivity(null);
    expect(g.state.stats[W.foughtKey]).toBeUndefined();
    for (let i = 0; i < W.ticks && !g.state.stats[W.doneKey]; i++) g.tick();
    expect(flags(g.state)).toEqual([W.flags.unmet]);
  });

  it('killed in the window: the stamp clears the ward and no flag is set', () => {
    SPOTS[HALL].stampOnClear = W.doneKey;
    const g = lastWardLeft();
    g.tick();
    g.state.stats[`fights:${HALL}`] = 5;
    ratFight(g);
    killFront(g);
    expect(g.state.stats[W.doneKey]).toBe(1);
    for (let i = 0; i < W.ticks + 5; i++) g.tick();
    expect(g.state.stats[W.goneKey]).toBeUndefined();
    expect(flags(g.state)).toEqual([]);
  });

  it('a fight with the threat live at the lapse is waited out', () => {
    const g = lastWardLeft();
    g.tick();
    g.state.stats[clock] = W.ticks - 1;
    ratFight(g);
    tickWards(g.state, g.bus, false);
    tickWards(g.state, g.bus, false);
    expect(g.state.stats[clock]).toBe(W.ticks);
    expect(g.state.stats[W.doneKey]).toBeUndefined();
    // Walked away unhurt: the next tick lapses it, unmet.
    g.selectActivity(null);
    tickWards(g.state, g.bus, false);
    expect(flags(g.state)).toEqual([W.flags.unmet]);
  });

  it('a kill in the waited-out fight sets no flag', () => {
    SPOTS[HALL].stampOnClear = W.doneKey;
    const g = lastWardLeft();
    g.tick();
    g.state.stats[clock] = W.ticks;
    g.state.stats[`fights:${HALL}`] = 5;
    ratFight(g);
    tickWards(g.state, g.bus, false);
    expect(g.state.stats[W.doneKey]).toBeUndefined();
    killFront(g);
    tickWards(g.state, g.bus, false);
    expect(g.state.stats[W.doneKey]).toBe(1);
    expect(g.state.stats[W.goneKey]).toBeUndefined();
    expect(flags(g.state)).toEqual([]);
  });

  it('offline catch-up does not run the clock; play does', () => {
    const g = lastWardLeft();
    g.tick();
    g.state.stats[clock] = 5;
    const summary = runOfflineProgress(g, 10 * 60 * 1000);
    expect(summary?.ticks).toBeGreaterThan(W.ticks);
    expect(g.state.stats[clock]).toBe(5);
    expect(g.state.stats[W.doneKey]).toBeUndefined();
    for (let i = 0; i < W.ticks - 5; i++) g.tick();
    expect(flags(g.state)).toEqual([W.flags.unmet]);
  });

  it('a bonus-time tick is a second advance and counts twice, travel included', () => {
    const g = lastWardLeft();
    g.tick();
    // On the road, so not idle: the bank is spent.
    g.state.travel = { from: FOOT, to: 'castle_court', ticksLeft: 100, total: 100 };
    g.state.bonusTime = { banked: 10, spending: true };
    const before = g.state.stats[clock] ?? 0;
    g.tick();
    expect(g.state.bonusTime.banked).toBe(9);
    expect(g.state.stats[clock]).toBe(before + 2);
  });
});

// ---------- Save migration v59 → v60 ----------

describe('save migration v59 → v60', () => {
  it('a skeleton keeper killed keeps its ward cleared under the new clears', () => {
    const raw = JSON.parse(serialize(createInitialState(0, FOOT))) as Record<string, unknown>;
    raw.version = 59;
    raw.stats = {
      'slain:f7_wreck:giant_spider_queen': 1,
      'slain:f8_lodge:hobgoblin_champion': 1,
      'slain:f10_foundry:stone_golem': 1,
      'fights:f10_foundry': 3,
    };
    const migrated = migrate(raw, SAVE_VERSION);
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.stats['ward:f7:done']).toBe(1);
    expect(migrated.stats['fights:f8_lodge']).toBe(1);
    expect(migrated.stats['fights:f9_ossuary']).toBeUndefined();
    expect(migrated.stats['fights:f10_foundry']).toBe(3);
  });
});

// ---------- The lints, on fixtures ----------

describe('ward lints', () => {
  const bands = { city: { id: 'city', order: 'any' }, low: { id: 'low', order: 'sequence' } };
  const floors = {
    w1: { id: 'w1', bandId: 'city', areaId: 'a1', clear: [{ type: 'stat', key: 'w1:done' }] },
    w2: { id: 'w2', bandId: 'city', areaId: 'a2', clear: [{ type: 'stat', key: 'x' }] },
    s1: { id: 's1', bandId: 'low', areaId: 'a3', clear: [{ type: 'stat', key: 'y' }] },
  };
  const spot = (id: string, areaId: string, extra: Partial<SpotDef> = {}) =>
    ({ id, areaId, fightLimit: 1, encounters: [{ monsterId: 'demon', weight: 1, level: [1, 1] }], ...extra }) as SpotDef;
  const spots = {
    camp: spot('camp', 'a1', { stampOnClear: 'w1:done' }),
    elsewhere: spot('elsewhere', 'a2', { stampOnClear: 'w1:done' }),
    loose: spot('loose', 'a2', { fightLimit: undefined, stampOnClear: 'z' }),
  };
  const monsters = { demon: {}, bad: { keepsWounds: { key: 'k', share: 0 } }, big: { keepsWounds: { key: 'k2', share: 1.5 } } };
  const good: WardWindowDef = {
    id: 'ok',
    floorId: 'w1',
    position: 1,
    ticks: 10,
    spotId: 'camp',
    monsterId: 'demon',
    doneKey: 'w1:done',
    atKey: 'w1:at',
    goneKey: 'w1:gone',
    foughtKey: 'w1:fought',
    flags: { fought: 'flag:w1:a', unmet: 'flag:w1:b' },
  };
  const run = (windows: WardWindowDef[]) =>
    wardContentIssues(windows, { bands, floors, spots, monsters }).map((i) => `${i.kind} ${i.id}: ${i.message}`);

  it('stamps need a fight budget; kept wounds need a share in (0, 1]', () => {
    const issues = run([]);
    expect(issues.some((m) => m.startsWith('spot loose') && m.includes('needs a fightLimit'))).toBe(true);
    expect(issues.some((m) => m.startsWith('monster bad'))).toBe(true);
    expect(issues.some((m) => m.startsWith('monster big'))).toBe(true);
    expect(issues).toHaveLength(3);
  });

  it('a well-formed window passes', () => {
    expect(run([good])).toHaveLength(3); // only the fixture's deliberate spot and monster faults
  });

  it('each window rule fires', () => {
    const cases: [Partial<WardWindowDef>, string][] = [
      [{ floorId: 'nope' }, "unknown floor 'nope'"],
      [{ floorId: 's1' }, 'not in an any-order band'],
      [{ spotId: 'elsewhere' }, "is not on floor 'w1'"],
      [{ monsterId: 'bad' }, 'never spawns'],
      [{ position: 2 }, 'outside 0..1'],
      [{ position: -1 }, 'outside 0..1'],
      [{ ticks: 0 }, 'ticks must be above 0'],
      [{ goneKey: 'w1:at' }, 'keys must be distinct'],
      [{ doneKey: 'w1:other' }, "must stamp 'w1:other'"],
    ];
    for (const [patch, needle] of cases) {
      const issues = run([{ ...good, ...patch }]);
      expect(issues.some((m) => m.includes(needle)), `${JSON.stringify(patch)} → ${needle}\n${issues.join('\n')}`).toBe(true);
    }
    expect(run([{ ...good, doneKey: 'x' }]).some((m) => m.includes("must clear on 'x'"))).toBe(true);
    const twins = run([good, { ...good, id: 'twin', floorId: 'w1', doneKey: 'w1:done', foughtKey: 'w1:fought2', goneKey: 'w1:gone2' }]);
    expect(twins.some((m) => m.includes("atKey 'w1:at' is window 'ok'"))).toBe(true);
  });

  it('the stat keys content may read include positions, stamps and window keys', () => {
    const keys = wardStatKeys([good], { bands, floors, spots });
    for (const k of ['band:pos:w1', 'band:pos:w2', 'w1:done', 'z', 'w1:at', 'w1:gone', 'w1:fought', 'flag:w1:a', 'flag:w1:b']) {
      expect(keys.has(k), k).toBe(true);
    }
    expect(keys.has('band:pos:s1')).toBe(false);
  });

  it('a floor that clears on a stamp names the stamping spots for the floor rules', () => {
    expect(clearSpotIds({ clear: [{ type: 'stat', key: 'w1:done' }] }, spots).sort()).toEqual(['camp', 'elsewhere']);
    expect(clearSpotIds({ clear: [{ type: 'stat', key: 'w1:done' }] })).toEqual([]);
  });
});
