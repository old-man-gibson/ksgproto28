import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { EventBus } from '../src/core/engine/events';
import { FLOORS, MONSTERS, NPCS, QUESTS, SPOTS } from '../src/core/registry';
import { MIGRATIONS } from '../src/core/save/migrations';
import { effectiveAttrs } from '../src/core/systems/attributes';
import { getDerivedStats } from '../src/core/systems/derived';
import {
  checkFloorClears,
  floorXpKey,
  grantLevelXp,
  killXp,
  levelFromXp,
  levelGapXpMult,
  questLevelXp,
  xpToNext,
  xpToReach,
} from '../src/core/systems/levels';
import { buyBoon, prestigeNow } from '../src/core/systems/prestige';
import { DEFAULT_QUEST_LEVEL_XP, LEVEL_ATTR_BONUS, LEVEL_XP_BASE, MIN_KILL_XP } from '../src/core/data/levels.data';
import type { SpotEncounter } from '../src/core/types';
import { clearFloors } from './fixtures/floors';

describe('the level curve', () => {
  it('level 1 → 2 costs the base; every next level costs more', () => {
    expect(xpToNext(1)).toBe(LEVEL_XP_BASE);
    for (let l = 1; l < 30; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
    expect(xpToReach(1)).toBe(0);
    expect(xpToReach(3)).toBe(xpToNext(1) + xpToNext(2));
  });

  it('levelFromXp inverts xpToReach', () => {
    for (const level of [1, 2, 5, 12]) {
      expect(levelFromXp(xpToReach(level))).toEqual({ level, xp: 0 });
      expect(levelFromXp(xpToReach(level) + 1)).toEqual({ level, xp: 1 });
    }
  });
});

describe('kill XP by level gap (user, 2026-10-22)', () => {
  it('full at or above the fighter, then 1/N when the fighter is N levels above', () => {
    expect(levelGapXpMult(5, 9)).toBe(1); // the monster is higher: no bonus, no cut
    expect(levelGapXpMult(5, 5)).toBe(1);
    expect(levelGapXpMult(5, 4)).toBe(1); // one above: 1/1
    expect(levelGapXpMult(5, 3)).toBe(1 / 2);
    expect(levelGapXpMult(5, 2)).toBe(1 / 3);
    expect(levelGapXpMult(20, 1)).toBe(1 / 19);
  });

  it('a kill earns at least MIN_KILL_XP however wide the gap', () => {
    const s = createInitialState(1);
    s.level = 40;
    expect(MIN_KILL_XP).toBe(1);
    expect(killXp(s, { xp: 8, level: 1 })).toBe(1); // 8 / 39 is under one
    expect(killXp(s, { xp: 390, level: 1 })).toBeCloseTo(10, 6); // 390 / 39
    expect(killXp(s, { xp: 8, level: 40 })).toBe(8);
  });
});

describe('grantLevelXp', () => {
  it('takes every level the XP pays for, keeps the rest, and says so once per level', () => {
    const s = createInitialState(1);
    const bus = new EventBus();
    const ups: number[] = [];
    const logs: string[] = [];
    bus.on('level:up', (ev) => ups.push(ev.level));
    bus.on('log', (ev) => logs.push(ev.msg));
    grantLevelXp(s, bus, xpToReach(4) + 7);
    expect(s.level).toBe(4);
    expect(s.levelXp).toBeCloseTo(7, 6);
    expect(ups).toEqual([2, 3, 4]);
    expect(logs.filter((m) => m.startsWith('⬆️ Level'))).toHaveLength(3);
    grantLevelXp(s, bus, 0);
    grantLevelXp(s, bus, -5);
    expect(s.level).toBe(4);
  });
});

describe('the level bonus', () => {
  it('adds LEVEL_ATTR_BONUS to all six attributes per level above 1, and the stat block follows', () => {
    const s = createInitialState(1);
    const before = effectiveAttrs(s);
    const hpBefore = getDerivedStats(s).maxHp;
    s.level = 4;
    const after = effectiveAttrs(s);
    for (const id of Object.keys(before) as (keyof typeof before)[]) {
      expect(after[id] - before[id]).toBeCloseTo(3 * LEVEL_ATTR_BONUS, 6);
    }
    // modFingerprint carries the level: the cached block is rebuilt.
    expect(getDerivedStats(s).maxHp).toBeGreaterThan(hpBefore);
  });

  it('is not trained level: the Cages keeper still reads the trained total', async () => {
    const { attrTotal } = await import('../src/core/systems/training');
    const s = createInitialState(1);
    const trained = attrTotal(s);
    s.level = 10;
    expect(attrTotal(s)).toBe(trained);
  });
});

describe('what pays level XP', () => {
  const realTable = SPOTS.the_cages.encounters;
  afterEach(() => {
    SPOTS.the_cages.encounters = realTable;
  });

  it('a kill pays the spawned monster’s XP', () => {
    SPOTS.the_cages.encounters = [{ monsterId: 'goblin', weight: 1, level: [1, 1] }] as SpotEncounter[];
    const g = new Game(createInitialState(4));
    g.state.attrs.str.level = 30;
    g.state.attrs.con.level = 30;
    g.state.spot = 'the_cages';
    g.selectActivity('hunt');
    for (let i = 0; i < 3000 && !(g.state.stats['kills:goblin'] ?? 0); i++) g.tick();
    expect(g.state.stats['kills:goblin']).toBe(1);
    expect(xpToReach(g.state.level) + g.state.levelXp).toBeCloseTo(MONSTERS.goblin.xp, 6);
  });

  it('a kill by a fighter far above the monster pays 1/gap, never under one XP', () => {
    SPOTS.the_cages.encounters = [{ monsterId: 'goblin', weight: 1, level: [1, 1] }] as SpotEncounter[];
    const g = new Game(createInitialState(4));
    g.state.level = 4; // three levels above a level-1 goblin: a third
    g.state.attrs.str.level = 30;
    g.state.attrs.con.level = 30;
    g.state.spot = 'the_cages';
    g.selectActivity('hunt');
    for (let i = 0; i < 3000 && !(g.state.stats['kills:goblin'] ?? 0); i++) g.tick();
    expect(g.state.stats['kills:goblin']).toBe(1);
    const earned = Math.max(MIN_KILL_XP, MONSTERS.goblin.xp / 3);
    expect(g.state.levelXp).toBeCloseTo(earned, 6);
  });

  it('a floor pays its clear XP once per run', () => {
    const s = createInitialState(1);
    const bus = new EventBus();
    const f1 = FLOORS.ascent_f1;
    expect(f1.clearXp).toBeGreaterThan(0);
    checkFloorClears(s, bus);
    expect(s.levelXp).toBe(0);
    s.stats['boss:f1_toll_hall'] = 1;
    checkFloorClears(s, bus);
    checkFloorClears(s, bus);
    expect(xpToReach(s.level) + s.levelXp).toBe(f1.clearXp);
    expect(s.stats[floorXpKey('ascent_f1')]).toBe(1);
  });

  it('every ladder floor of band 1 pays clear XP', () => {
    for (const id of ['ascent_f1', 'ascent_f2', 'ascent_f3']) expect(FLOORS[id].clearXp, id).toBeGreaterThan(0);
  });

  it('a quest turn-in pays its level XP and lists it in the turn-in line', () => {
    const g = new Game(createInitialState(1, 'ascent_foot'));
    const logs: string[] = [];
    g.bus.on('log', (ev) => logs.push(ev.msg));
    const quest = QUESTS.faces_of_threshold;
    g.acceptQuest(quest.id);
    for (const o of quest.objectives) if (o.type === 'talk') g.state.stats[`met:${o.npcId}`] = 1;
    expect(g.state.spot).toBe(NPCS[quest.giver].spotId);
    g.turnInQuest(quest.id);
    expect(g.state.quests[quest.id].status).toBe('done');
    expect(xpToReach(g.state.level) + g.state.levelXp).toBeGreaterThanOrEqual(questLevelXp(quest));
    expect(logs.some((m) => m.includes(`${questLevelXp(quest)} level XP`))).toBe(true);
  });

  it('a quest without its own number pays the default', () => {
    const quest = { ...QUESTS.faces_of_threshold, rewards: {} };
    expect(questLevelXp(quest)).toBe(DEFAULT_QUEST_LEVEL_XP);
  });
});

describe('Head Start (prestige)', () => {
  function bandOneCleared() {
    const s = createInitialState(1);
    clearFloors(s.stats);
    return s;
  }

  it('the level resets with the run; each rank starts the next one a level higher', () => {
    const s = bandOneCleared();
    s.level = 9;
    s.levelXp = 40;
    s.prestige.purchases.head_start = 2;
    const next = prestigeNow(s, 2)!;
    expect(next.level).toBe(3);
    expect(next.levelXp).toBe(0);
    expect(next.stats[floorXpKey('ascent_f1')]).toBeUndefined();
  });

  it('a rank bought in review applies now, and never lowers a level already reached', () => {
    const s = createInitialState(1);
    const bus = new EventBus();
    s.prestige.points = 10;
    expect(buyBoon(s, bus, 'head_start')).toBe(true);
    expect(s.level).toBe(2);
    s.level = 7;
    s.levelXp = 12;
    expect(buyBoon(s, bus, 'head_start')).toBe(true);
    expect(s.level).toBe(7);
    expect(s.levelXp).toBe(12);
  });
});

describe('save v56', () => {
  it('a new game starts at level 1 with no XP', () => {
    const s = createInitialState(1);
    expect(s.level).toBe(1);
    expect(s.levelXp).toBe(0);
  });

  it('an older save is back-paid from its kills, quests and cleared floors', () => {
    const raw: Record<string, unknown> = {
      version: 55,
      stats: { 'kills:goblin': 10, 'kills:no_such_monster': 99, 'boss:f1_toll_hall': 1 },
      quests: { faces_of_threshold: { status: 'done', progress: [] }, a_taste_of_everything: { status: 'active', progress: [] } },
    };
    MIGRATIONS[55](raw);
    const expected = MONSTERS.goblin.xp * 10 + questLevelXp(QUESTS.faces_of_threshold) + FLOORS.ascent_f1.clearXp!;
    const lifetime = xpToReach(raw.level as number) + (raw.levelXp as number);
    expect(lifetime).toBeCloseTo(expected, 6);
    expect((raw.stats as Record<string, number>)[floorXpKey('ascent_f1')]).toBe(1);
    expect((raw.stats as Record<string, number>)[floorXpKey('ascent_f2')]).toBeUndefined();
    expect(raw.version).toBe(56);
  });

  it('a save with nothing on record migrates to level 1', () => {
    const raw: Record<string, unknown> = { version: 55 };
    MIGRATIONS[55](raw);
    expect(raw.level).toBe(1);
    expect(raw.levelXp).toBe(0);
  });
});
