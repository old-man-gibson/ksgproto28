import { describe, expect, it } from 'vitest';
import {
  CACHE_WEAPONS,
  DEFAULT_ROYALE_PLAN,
  RADAR_TICKS,
  ROYALE_CACHES,
  ROYALE_DENS,
  ROYALE_FIELD,
  ROYALE_LAYOUT_VERSION,
  ROYALE_SECTIONS,
  ROYALE_STRATEGIES,
  SURVIVORS,
  SURVIVOR_SPECIES,
  denPower,
} from '../src/core/data/festival.data';
import { ITEMS } from '../src/core/registry';
import {
  activeStrategy,
  championFight,
  clearEngaged,
  createField,
  fighterPower,
  goalFor,
  restoreChampion,
  stepField,
  type Body,
  type FieldStep,
  type GoalContext,
} from '../src/core/systems/royaleField';
import { sectionIdOf, type RoyaleMap } from '../src/core/systems/royaleMap';
import { mapOf, sectionAt } from '../src/core/systems/royaleTerrain';
import type { FieldFighter, RoyaleField, RoyaleMove, RoyaleStrategyDef } from '../src/core/types';

/**
 * The royale's field engine (systems/royaleField.ts; docs/FESTIVAL.md §9.2,
 * §9.2a, §9.6) as a pure simulation. Nothing here names a coordinate: spots
 * come from the seed's map (`mapOf`), since the generator moves caches, dens
 * and the start with every seed. Tests that need open ground find a window of
 * plain meadow with nothing in it (`quietSpot`) and place everyone inside it.
 */

/** A seeded stand-in for the save's rng. */
function seeded(seed = 7): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 4242;
const MAP = mapOf({ seed: SEED });

interface Point {
  x: number;
  y: number;
}
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** The first window of plain meadow, `half` units each way, clear of the start, every den and every cache. */
function quietSpot(map: RoyaleMap, half = 16): Point {
  const margin = half + 4;
  for (let cy = margin; cy < map.size - margin; cy += 4) {
    for (let cx = margin; cx < map.size - margin; cx += 4) {
      const centre = { x: cx, y: cy };
      let clear = true;
      for (let y = cy - half; clear && y <= cy + half; y += 2) {
        for (let x = cx - half; clear && x <= cx + half; x += 2) clear = map.cells[y * map.size + x] === 0;
      }
      if (!clear || dist(centre, map.start) < margin) continue;
      if (ROYALE_DENS.some((d) => dist(centre, map.dens[d.id]) < d.radius + margin)) continue;
      if (ROYALE_CACHES.some((c) => dist(centre, map.caches[c.id]) < margin)) continue;
      return centre;
    }
  }
  throw new Error(`seed ${map.seed}: no window of plain meadow ${2 * half} across`);
}

/** The centre of the first cell the map gives to a section. */
function cellOf(map: RoyaleMap, sectionId: string): Point {
  for (let i = 0; i < map.cells.length; i++) {
    if (sectionIdOf(map.cells[i]) === sectionId) return { x: (i % map.size) + 0.5, y: Math.floor(i / map.size) + 0.5 };
  }
  throw new Error(`seed ${map.seed}: no ${sectionId} on the map`);
}

const Q = quietSpot(MAP);
/** A point in the quiet window, `dx` and `dy` from its middle (at most 15 each way). */
const at = (dx: number, dy: number): Point => ({ x: Q.x + dx, y: Q.y + dy });

const strat = (move: RoyaleMove, when?: RoyaleStrategyDef['when']): RoyaleStrategyDef => ({
  id: `t_${move}`,
  name: move,
  icon: '·',
  desc: '',
  move,
  ...(when ? { when } : {}),
});
const SPECIES_PLANS = new Map(SURVIVOR_SPECIES.map((s) => [s.monsterId, s.plan.map((id) => ROYALE_STRATEGIES[id])]));

function step(now: number, rng: () => number, over: Partial<FieldStep> = {}): FieldStep {
  return {
    now,
    rng,
    playerFree: true,
    playerHp: 1,
    playerPower: 40,
    playerSpeed: 1,
    plan: DEFAULT_ROYALE_PLAN.map((id) => ROYALE_STRATEGIES[id]),
    planOf: (id) => SPECIES_PLANS.get(id) ?? [],
    ...over,
  };
}
/** Every survivor and the player move by one move. */
const only = (move: RoyaleMove): Partial<FieldStep> => ({ plan: [strat(move)], planOf: () => [strat(move)] });

function fighter(id: number, p: Point, extra: Partial<FieldFighter> = {}): FieldFighter {
  return { id, monsterId: 'ph_survivor_blade', x: p.x, y: p.y, hp: 1, wins: 0, ...extra };
}
function fieldOf(fighters: FieldFighter[], player: Point = at(0, 0), seed = SEED): RoyaleField {
  return {
    size: ROYALE_FIELD.size,
    fighters,
    player: { x: player.x, y: player.y },
    fallen: 0,
    layout: ROYALE_LAYOUT_VERSION,
    seed,
    openedAt: 0,
    taken: [],
    cleared: [],
    seen: [],
  };
}
/** Three survivors out of each other's reach, in the quiet window: enough that duels and dens are allowed. */
const crowd = (): FieldFighter[] => [fighter(1, at(-15, -15)), fighter(2, at(10, -15)), fighter(3, at(15, 15))];

describe('the field opens', () => {
  it('ninety-nine survivors, the player at the map’s start, stamped for the layout, the seed and the tick', () => {
    const field = createField(seeded(), 1234, 5000);
    const map = mapOf(field);
    expect(field.fighters).toHaveLength(SURVIVORS);
    expect(field.seed).toBe(1234);
    expect(field.layout).toBe(ROYALE_LAYOUT_VERSION);
    expect(field.openedAt).toBe(5000);
    expect(field.player).toEqual({ x: map.start.x, y: map.start.y });
    expect([field.taken, field.cleared, field.seen]).toEqual([[], [], []]);
    expect(field.player.y).toBeGreaterThan(field.size - 5);
    // Species in turn.
    expect(field.fighters[0].monsterId).toBe(SURVIVOR_SPECIES[0].monsterId);
    expect(field.fighters[1].monsterId).toBe(SURVIVOR_SPECIES[1].monsterId);
  });

  it('without a seed it draws its own from the rng, the same one each time for the same rng', () => {
    const a = createField(seeded(9));
    const b = createField(seeded(9));
    expect(Number.isInteger(a.seed)).toBe(true);
    expect(a.seed).toBe(b.seed);
    expect(createField(seeded(10)).seed).not.toBe(a.seed);
  });

  it('survivors are spread: apart from each other, clear of the start and of every den, on the field', () => {
    const cfg = ROYALE_FIELD;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const field = createField(seeded(seed), seed * 977);
      const map = mapOf(field);
      let nearest = Infinity;
      for (const [i, f] of field.fighters.entries()) {
        expect(f.x).toBeGreaterThanOrEqual(0);
        expect(f.x).toBeLessThanOrEqual(field.size);
        expect(f.y).toBeGreaterThanOrEqual(0);
        expect(f.y).toBeLessThanOrEqual(field.size);
        expect(dist(f, map.start), `seed ${seed}: survivor ${f.id} by the start`).toBeGreaterThanOrEqual(cfg.startClear);
        for (const d of ROYALE_DENS) {
          expect(dist(f, map.dens[d.id]), `seed ${seed}: survivor ${f.id} in ${d.id}`).toBeGreaterThan(d.radius + cfg.denMargin);
        }
        for (const g of field.fighters.slice(i + 1)) nearest = Math.min(nearest, dist(f, g));
      }
      expect(nearest, `seed ${seed}`).toBeGreaterThanOrEqual(cfg.spread);
    }
  });
});

describe('what a fighter reads', () => {
  it('a strong fighter’s tools count in duels, a little each and up to a cap', () => {
    const base = { monsterId: 'ph_survivor_blade', wins: 0, hp: 1 };
    const none = fighterPower(base, 34);
    const two = fighterPower({ ...base, tools: ['iron_sword', 'wolf_cloak'] }, 34);
    expect(two - none).toBeCloseTo(2 * ROYALE_FIELD.toolBonus);
    const capped = fighterPower({ ...base, tools: Array(ROYALE_FIELD.toolCap).fill('x') }, 34);
    expect(fighterPower({ ...base, tools: Array(ROYALE_FIELD.toolCap + 6).fill('x') }, 34)).toBe(capped);
    // Wounds weaken, wins strengthen, as before.
    expect(fighterPower({ ...base, hp: 0.2 }, 34)).toBeLessThan(none);
    expect(fighterPower({ ...base, wins: 2 }, 34)).toBeGreaterThan(none);
  });

  it('the first strategy whose condition holds decides', () => {
    const plan = ['fall_back_hurt', 'lie_low', 'press_nearest'].map((id) => ROYALE_STRATEGIES[id]);
    expect(activeStrategy(plan, 0.3, 80)?.id).toBe('fall_back_hurt');
    expect(activeStrategy(plan, 0.9, 80)?.id).toBe('lie_low');
    expect(activeStrategy(plan, 0.9, 10)?.id).toBe('press_nearest');
    expect(activeStrategy([ROYALE_STRATEGIES.fall_back_hurt], 0.9, 10)).toBeNull();
    // The new strategies: loot while more than fifty are left, cover when hurt.
    const crowded = ['take_cover_hurt', 'loot_while_crowded', 'press_nearest'].map((id) => ROYALE_STRATEGIES[id]);
    expect(activeStrategy(crowded, 0.3, 80)?.move).toBe('cover');
    expect(activeStrategy(crowded, 0.9, 80)?.move).toBe('loot');
    expect(activeStrategy(crowded, 0.9, 50)?.move).toBe('nearest');
  });

  it('a fighter walks at the one it sees and not at the ones out of sight', () => {
    // Survivor 2 is ten units from survivor 1 and seventeen from the player; survivor 3 is out of sight of all.
    const field = fieldOf([fighter(1, at(-15, -15)), fighter(2, at(-5, -15)), fighter(3, at(15, 15))], at(12, -15));
    stepField(field, step(1, seeded(1), only('nearest')), 34);
    expect(dist(field.fighters[0].goal!, field.fighters[1]), 'survivor 1 walks at the one it sees').toBeLessThan(0.5);
    expect(dist(field.player.goal!, field.fighters[1]), 'the player walks at the one it sees').toBeLessThan(0.5);
    // Survivor 3 sees no one (thirty or more away from each): it roams instead.
    expect(dist(field.fighters[2].goal!, field.fighters[2])).toBeGreaterThanOrEqual(10);
  });

  it('a fighter in sight is walked at; the player’s plan reads the nearest in sight', () => {
    const field = fieldOf([fighter(1, at(-15, -15)), fighter(2, at(15, 15)), fighter(3, at(15, -15))], at(-5, -10));
    stepField(field, step(1, seeded(1), only('nearest')), 34);
    // Survivor 1 is ten units from the player and sees only it.
    expect(dist(field.fighters[0].goal!, field.player)).toBeLessThan(0.5);
    expect(dist(field.player.goal!, field.fighters[0])).toBeLessThan(0.5);
  });
});

describe('moves', () => {
  const ctx = (over: Partial<GoalContext> = {}): GoalContext => ({
    others: [],
    caches: [],
    size: ROYALE_FIELD.size,
    map: MAP,
    rng: seeded(5),
    ...over,
  });
  const others: Body[] = [
    { id: 1, x: Q.x - 10, y: Q.y - 10, power: 30 },
    { id: 2, x: Q.x + 8, y: Q.y + 8, power: 5 },
  ];
  const here = Q;

  it('nearest, weakest, centre, hold, away and edge go where they always did', () => {
    const near = { x: here.x - 2, y: here.y - 2 };
    expect(goalFor('nearest', near, ctx({ others }))).toEqual({ x: Q.x - 10, y: Q.y - 10 });
    // The weak one is out of the 20 units `weakest` looks (about 22 from here), so it falls back on the nearest.
    expect(goalFor('weakest', { x: Q.x - 14, y: Q.y - 14 }, ctx({ others }))).toEqual({ x: Q.x - 10, y: Q.y - 10 });
    expect(goalFor('weakest', here, ctx({ others }))).toEqual({ x: Q.x + 8, y: Q.y + 8 });
    expect(goalFor('centre', here, ctx({ others }))).toEqual({ x: 90, y: 90 });
    expect(goalFor('hold', here, ctx({ others }))).toEqual(here);
    const away = goalFor('away', near, ctx({ others }));
    expect(away.x).toBeGreaterThan(near.x);
    expect(away.y).toBeGreaterThan(near.y);
    expect(goalFor('edge', { x: 3, y: 90 }, ctx({ others }))).toEqual({ x: 1, y: 90 });
  });

  it('roam walks to a point in another section, far enough, and keeps it until reached', () => {
    const goal = goalFor('roam', here, ctx());
    const sectionOf = (p: Point) => sectionAt(MAP, p.x, p.y)?.id ?? '';
    expect(sectionOf(here)).toBe('');
    expect(sectionOf(goal)).not.toBe('');
    expect(dist(goal, here)).toBeGreaterThanOrEqual(15);
    // Held while the goal is still far, whatever the rng says.
    expect(goalFor('roam', here, ctx({ keep: goal, rng: seeded(99) }))).toEqual(goal);
    // Reached: a new one.
    const next = goalFor('roam', goal, ctx({ keep: goal, rng: seeded(99) }));
    expect(next).not.toEqual(goal);
    expect(dist(next, goal)).toBeGreaterThanOrEqual(15);
  });

  it('a move with nothing to work with falls back on roam, never on standing still', () => {
    for (const move of ['nearest', 'weakest', 'away', 'loot'] as RoyaleMove[]) {
      const goal = goalFor(move, here, ctx());
      expect(dist(goal, here), move).toBeGreaterThanOrEqual(15);
    }
    // `hold` is the one move that stands.
    expect(goalFor('hold', here, ctx())).toEqual(here);
  });

  it('loot walks to the nearest known open cache; none known, it roams', () => {
    const caches = [{ x: Q.x + 12, y: Q.y }, { x: Q.x - 14, y: Q.y - 14 }];
    expect(goalFor('loot', here, ctx({ caches }))).toEqual({ x: Q.x + 12, y: Q.y });
    expect(dist(goalFor('loot', here, ctx()), here)).toBeGreaterThanOrEqual(15);
  });

  it('cover walks to the nearest cell of a section with cover, and stays once under it', () => {
    const goal = goalFor('cover', here, ctx());
    expect(sectionAt(MAP, goal.x, goal.y)?.cover).toBe(true);
    const inside = cellOf(MAP, Object.values(ROYALE_SECTIONS).find((s) => s.cover)!.id);
    expect(goalFor('cover', inside, ctx())).toEqual(inside);
    // The nearest: no cover sample is closer than the one chosen.
    for (const d of [8, 20, 40]) {
      const near = goalFor('cover', { x: here.x + d, y: here.y }, ctx());
      expect(sectionAt(MAP, near.x, near.y)?.cover).toBe(true);
    }
  });
});

describe('terrain', () => {
  it('pace: a fighter in the river walks at the river’s share of the field’s speed', () => {
    const river = cellOf(MAP, 'river');
    const field = fieldOf([fighter(1, river, { goal: { x: river.x + 10, y: river.y } }), fighter(2, at(-15, -15)), fighter(3, at(15, 15))], at(15, -15));
    field.fighters[1].goal = { x: at(-15, -5).x, y: at(-15, -5).y };
    stepField(field, step(1, seeded(2), only('hold')), 34);
    expect(field.fighters[0].x - river.x).toBeCloseTo(ROYALE_FIELD.speed * ROYALE_SECTIONS.river.pace, 1);
    // On meadow the same walk is the field’s full speed.
    expect(Math.abs(field.fighters[1].y - at(-15, -15).y)).toBeCloseTo(ROYALE_FIELD.speed, 1);
  });

  it('the spring heals a free survivor beyond its own recovery, and reports the player’s share', () => {
    const glade = cellOf(MAP, 'glade');
    const spring = ROYALE_SECTIONS.glade.heal!;
    const field = fieldOf([fighter(1, glade, { hp: 0.5, goal: glade }), fighter(2, at(-15, -15), { hp: 0.5, goal: at(-15, -15) }), fighter(3, at(15, 15))], glade);
    const result = stepField(field, step(1, seeded(2), only('hold')), 34);
    const onGlade = field.fighters[0].hp;
    const onMeadow = field.fighters[1].hp;
    expect(onMeadow).toBeCloseTo(0.5 + ROYALE_FIELD.healPerTick, 5);
    expect(onGlade - onMeadow).toBeCloseTo(spring, 5);
    expect(result.playerHeal).toBe(spring);
    // Not while the player is in a fight, and not on meadow.
    expect(stepField(field, step(2, seeded(2), { ...only('hold'), playerFree: false }), 34).playerHeal).toBe(0);
    field.player.x = Q.x;
    field.player.y = Q.y;
    expect(stepField(field, step(3, seeded(2), only('hold')), 34).playerHeal).toBe(0);
  });

  it('the sections the player stands in are remembered', () => {
    const river = cellOf(MAP, 'river');
    const field = fieldOf(crowd(), river);
    stepField(field, step(1, seeded(1), only('hold')), 34);
    expect(field.seen).toEqual(['river']);
    field.player.x = Q.x;
    field.player.y = Q.y;
    stepField(field, step(2, seeded(1), only('hold')), 34);
    // Meadow is no section; the river is not forgotten, and not listed twice.
    expect(field.seen).toEqual(['river']);
    field.player.x = river.x;
    field.player.y = river.y;
    stepField(field, step(3, seeded(1), only('hold')), 34);
    expect(field.seen).toEqual(['river']);
  });
});

describe('the radar', () => {
  it('after RADAR_TICKS without a fight a survivor walks at the nearest enemy whatever its plan', () => {
    // Survivor 2 is the nearest enemy to survivor 1 (25 off), out of its sight.
    const field = fieldOf([fighter(1, at(-15, -15)), fighter(2, at(10, -15)), fighter(3, at(15, 15))], at(-15, 15));
    stepField(field, step(RADAR_TICKS - 1, seeded(1), only('hold')), 34);
    expect(field.fighters[0].goal).toEqual(at(-15, -15));
    for (const f of field.fighters) delete f.goal;
    stepField(field, step(RADAR_TICKS, seeded(1), only('hold')), 34);
    expect(dist(field.fighters[0].goal!, field.fighters[1])).toBeLessThan(0.5);
  });

  it('a fight resets it: the winner of a duel, and a survivor that fought lately, are off the radar', () => {
    const lately = fighter(1, at(-15, -15), { lastFight: RADAR_TICKS - 5 });
    const field = fieldOf([lately, fighter(2, at(10, -15), { lastFight: 0 }), fighter(3, at(15, 15), { lastFight: 0 })], at(-15, 15));
    // Fighter 1 fought five ticks ago, so it still holds; 2 and 3 fought at tick 0 and are on the radar.
    stepField(field, step(RADAR_TICKS, seeded(1), only('hold')), 34);
    expect(field.fighters[0].goal).toEqual(at(-15, -15));
    expect(field.fighters[1].goal).not.toEqual(at(10, -15));
    // A duel ends: the winner’s clock restarts.
    const duel = fieldOf([fighter(1, at(-15, -15), { duel: { foe: 2, until: 50 } }), fighter(2, at(-14, -15), { duel: { foe: 1, until: 50 } }), fighter(3, at(15, 15))]);
    stepField(duel, step(50, seeded(1), only('hold')), 34);
    expect(duel.fighters.filter((f) => f.id !== 3)[0].lastFight).toBe(50);
  });

  it('the player’s plan reads the radar’s target as in sight', () => {
    const field = fieldOf([fighter(1, at(-15, -15)), fighter(2, at(10, -15)), fighter(3, at(15, 15))], at(-15, 15));
    // 30 units from the nearest survivor: out of sight, so the plan roams...
    stepField(field, step(RADAR_TICKS - 1, seeded(3), { ...only('hold'), plan: [strat('nearest')] }), 34);
    expect(dist(field.player.goal!, field.fighters[0])).toBeGreaterThan(3);
    // ...and when the radar is on, the same plan walks at that survivor.
    delete field.player.goal;
    stepField(field, step(RADAR_TICKS, seeded(3), { ...only('hold'), plan: [strat('nearest')] }), 34);
    expect(dist(field.player.goal!, field.fighters[0])).toBeLessThan(0.5);
    // A fight the player won lately keeps it off.
    delete field.player.goal;
    field.player.lastFight = RADAR_TICKS - 1;
    stepField(field, step(RADAR_TICKS, seeded(3), { ...only('hold'), plan: [strat('nearest')] }), 34);
    expect(dist(field.player.goal!, field.fighters[0])).toBeGreaterThan(3);
  });

  it('with two survivors left both walk at the player, whatever their move', () => {
    const field = fieldOf([fighter(1, at(-15, -15)), fighter(2, at(15, -15))], at(0, 15));
    stepField(field, step(1, seeded(1), only('hold')), 34);
    for (const f of field.fighters) expect(dist(f.goal!, field.player), `survivor ${f.id}`).toBeLessThan(0.5);
  });

  it('two survivors left never duel each other, and always reach the player', () => {
    const rng = seeded(11);
    const field = fieldOf([fighter(1, at(-15, -15)), fighter(2, at(-14, -15))], at(15, 15));
    let engaged = false;
    for (let t = 0; t < 800 && !engaged; t++) {
      engaged = stepField(field, step(t, rng, only('hold')), 34).engaged.length > 0;
      expect(field.fighters.some((f) => f.duel)).toBe(false);
    }
    expect(engaged).toBe(true);
    expect(field.fighters).toHaveLength(2);
  });
});

describe('caches', () => {
  /** Survivors hold at a cache's place; the rest of the field stays in the quiet window. */
  function atCache(id: string, extra: Partial<FieldFighter> = {}) {
    const place = MAP.caches[id];
    const field = fieldOf([fighter(1, place, { goal: place, ...extra }), fighter(2, at(-15, -15)), fighter(3, at(15, 15))], at(15, -15));
    return { place, field };
  }

  it('a free survivor within reach takes an item cache once, and keeps the item as a tool', () => {
    const { field } = atCache('ferry_shed');
    stepField(field, step(1, seeded(1), only('hold')), 34);
    expect(field.taken).toContain('ferry_shed');
    expect(field.fighters[0].tools).toContain('iron_sword');
    const kept = field.fighters[0].tools!.length;
    // Taken once: another survivor on the same spot gets nothing, and the first keeps what it has.
    field.fighters[1].x = MAP.caches.ferry_shed.x;
    field.fighters[1].y = MAP.caches.ferry_shed.y;
    stepField(field, step(2, seeded(1), only('hold')), 34);
    expect(field.fighters[1].tools).toBeUndefined();
    expect(field.fighters[0].tools).toHaveLength(kept);
    expect(field.taken!.filter((id) => id === 'ferry_shed')).toHaveLength(1);
  });

  it('a weapon cache gives a survivor a weapon from CACHE_WEAPONS, a heal cache heals it', () => {
    const weapon = atCache('signal_post');
    stepField(weapon.field, step(1, seeded(1), only('hold')), 34);
    expect(weapon.field.taken).toContain('signal_post');
    expect(Object.values(CACHE_WEAPONS)).toContain(weapon.field.fighters[0].tools![0]);
    const heal = atCache('fisher_hut', { hp: 0.3 });
    stepField(heal.field, step(1, seeded(1), only('hold')), 34);
    expect(heal.field.taken).toContain('fisher_hut');
    // Its own recovery that tick, then the cache’s share.
    expect(heal.field.fighters[0].hp).toBeCloseTo(0.3 + ROYALE_CACHES.find((c) => c.id === 'fisher_hut')!.heal! + ROYALE_FIELD.healPerTick, 5);
  });

  it('a survivor busy in a duel takes nothing', () => {
    const { field } = atCache('ferry_shed', { duel: { foe: 2, until: 500 } });
    field.fighters[1].duel = { foe: 1, until: 500 };
    stepField(field, step(1, seeded(1), only('hold')), 34);
    expect(field.taken).not.toContain('ferry_shed');
  });

  it('the free player in reach takes it instead, reported to the caller and marked taken', () => {
    const place = MAP.caches.ferry_shed;
    const field = fieldOf(crowd(), place);
    const result = stepField(field, step(1, seeded(1), only('hold')), 34);
    expect(result.playerCaches.map((c) => c.id)).toContain('ferry_shed');
    expect(field.taken).toContain('ferry_shed');
    // A player in a fight takes nothing.
    const busy = fieldOf(crowd(), place);
    const none = stepField(busy, step(1, seeded(1), { ...only('hold'), playerFree: false }), 34);
    expect(none.playerCaches).toEqual([]);
    expect(busy.taken).not.toContain('ferry_shed');
  });

  it('a guarded cache stays shut until its den is cleared', () => {
    const cache = ROYALE_CACHES.find((c) => c.den)!;
    const field = fieldOf(crowd(), MAP.caches[cache.id]);
    const shut = stepField(field, step(1, seeded(1), only('hold')), 34);
    expect(shut.playerCaches).toEqual([]);
    expect(field.taken).not.toContain(cache.id);
    field.cleared!.push(cache.den!);
    const open = stepField(field, step(2, seeded(1), only('hold')), 34);
    expect(open.playerCaches.map((c) => c.id)).toContain(cache.id);
  });

  it('every cache lends or restores exactly one thing, from items that exist; about thirty-five of them', () => {
    expect(ROYALE_CACHES.length).toBeGreaterThanOrEqual(30);
    for (const c of ROYALE_CACHES) {
      expect([c.item, c.weapon, c.heal].filter((v) => v !== undefined), c.id).toHaveLength(1);
      if (c.item) expect(ITEMS[c.item], `${c.id}: ${c.item}`).toBeDefined();
    }
    for (const id of Object.values(CACHE_WEAPONS)) expect(ITEMS[id], id).toBeDefined();
    // None in the river.
    expect(ROYALE_CACHES.some((c) => c.section === 'river')).toBe(false);
  });
});

describe('dens', () => {
  const wolf = ROYALE_DENS.find((d) => d.id === 'wolf_den')!;
  const loses = () => 0.9999;
  const wins = () => 0;

  /** One survivor in the den, the rest of the field as given (by default two more, free). */
  function denField(rest: FieldFighter[] = [fighter(2, at(-15, -15)), fighter(3, at(15, 15))]) {
    const place = MAP.dens[wolf.id];
    return fieldOf([fighter(1, place), ...rest], at(15, -15));
  }

  it('a free survivor in a live den’s radius duels it for duelTicks', () => {
    const field = denField();
    stepField(field, step(0, seeded(1), only('hold')), 34);
    expect(field.fighters[0].duel).toEqual({ foe: 0, until: ROYALE_FIELD.duelTicks, den: wolf.id });
    expect(field.fighters[0].goal).toBeUndefined();
  });

  it('the den is stronger than a survivor: a power above 0 from its foes', () => {
    for (const d of ROYALE_DENS) expect(denPower(d), d.id).toBeGreaterThan(0);
    expect(denPower(wolf)).toBeGreaterThan(Math.max(...wolf.foes.map((f) => f.level)));
  });

  it('a survivor that wins clears the den, gains a win and is wounded', () => {
    const field = denField();
    stepField(field, step(0, wins, only('hold')), 34);
    const result = stepField(field, step(ROYALE_FIELD.duelTicks, wins, only('hold')), 34);
    expect(result.cleared).toEqual([wolf.id]);
    expect(field.cleared).toContain(wolf.id);
    expect(field.fighters[0].wins).toBe(1);
    expect(field.fighters[0].hp).toBeLessThan(1);
    expect(field.fighters[0].lastFight).toBe(ROYALE_FIELD.duelTicks);
    expect(field.fighters[0].duel).toBeUndefined();
  });

  it('a survivor that loses falls, while three stand and another survivor is free', () => {
    const field = denField();
    stepField(field, step(0, loses, only('hold')), 34);
    const result = stepField(field, step(ROYALE_FIELD.duelTicks, loses, only('hold')), 34);
    expect(result.fallen).toBe(1);
    expect(field.fallen).toBe(1);
    expect(field.fighters.map((f) => f.id)).toEqual([2, 3]);
    expect(field.cleared).not.toContain(wolf.id);
  });

  it('a den never fells the last survivor, nor one of two', () => {
    const field = denField([fighter(2, at(-15, -15))]);
    stepField(field, step(0, loses, only('hold')), 34);
    // Two stand: the one in the den is spared, the den holds.
    const result = stepField(field, step(ROYALE_FIELD.duelTicks, loses, only('hold')), 34);
    expect(result.fallen).toBe(0);
    expect(field.fighters).toHaveLength(2);
    expect(field.cleared).not.toContain(wolf.id);
    expect(field.fighters[0].duel).toBeUndefined();
    const alone = fieldOf([fighter(1, MAP.dens[wolf.id])], at(15, -15));
    stepField(alone, step(0, loses, only('hold')), 34);
    stepField(alone, step(ROYALE_FIELD.duelTicks, loses, only('hold')), 34);
    expect(alone.fighters).toHaveLength(1);
  });

  it('a den never fells the last free survivor while the player’s fight holds the others', () => {
    const field = denField([fighter(2, at(-15, -15), { engaged: true }), fighter(3, at(15, 15), { engaged: true })]);
    stepField(field, step(0, loses, only('hold')), 34);
    const result = stepField(field, step(ROYALE_FIELD.duelTicks, loses, only('hold')), 34);
    expect(result.fallen).toBe(0);
    expect(field.fighters).toHaveLength(3);
    // With one of the others free, the same loss falls.
    const spare = denField([fighter(2, at(-15, -15), { engaged: true }), fighter(3, at(15, 15))]);
    stepField(spare, step(0, loses, only('hold')), 34);
    expect(stepField(spare, step(ROYALE_FIELD.duelTicks, loses, only('hold')), 34).fallen).toBe(1);
  });

  it('a spared survivor starts no new den duel within a duel’s length of its last fight', () => {
    // The other two are held by the player’s fight, so the loss is spared and the survivor stays at the den.
    const field = denField([fighter(2, at(-15, -15), { engaged: true }), fighter(3, at(15, 15), { engaged: true })]);
    const d = ROYALE_FIELD.duelTicks;
    stepField(field, step(0, loses, only('hold')), 34);
    stepField(field, step(d, loses, only('hold')), 34);
    expect(field.fighters[0].duel).toBeUndefined();
    expect(field.fighters[0].lastFight).toBe(d);
    stepField(field, step(d + 1, loses, only('hold')), 34);
    stepField(field, step(2 * d - 1, loses, only('hold')), 34);
    expect(field.fighters[0].duel).toBeUndefined();
    stepField(field, step(2 * d, loses, only('hold')), 34);
    expect(field.fighters[0].duel).toEqual({ foe: 0, until: 3 * d, den: wolf.id });
  });

  it('the free player in a live den’s radius gets its fight; not a busy player, not a cleared den', () => {
    const place = MAP.dens[wolf.id];
    const field = fieldOf(crowd(), place);
    expect(stepField(field, step(1, seeded(1), only('hold')), 34).den?.id).toBe(wolf.id);
    expect(stepField(fieldOf(crowd(), place), step(1, seeded(1), { ...only('hold'), playerFree: false }), 34).den).toBeUndefined();
    const done = fieldOf(crowd(), place);
    done.cleared!.push(wolf.id);
    expect(stepField(done, step(1, seeded(1), only('hold')), 34).den).toBeUndefined();
    // Outside the radius: nothing.
    expect(stepField(fieldOf(crowd(), at(0, 0)), step(1, seeded(1), only('hold')), 34).den).toBeUndefined();
  });

  it('survivors reaching the player come before a den: one fight at a time', () => {
    const place = MAP.dens[wolf.id];
    const field = fieldOf([fighter(1, { x: place.x + 1, y: place.y }), fighter(2, at(-15, -15)), fighter(3, at(15, 15))], place);
    // The survivor is a duel away from a den and a step from the player: the player’s survivor fight comes first.
    const result = stepField(field, step(1, seeded(1), only('hold')), 34);
    expect(result.engaged.map((f) => f.id)).toEqual([1]);
    expect(result.den).toBeUndefined();
  });
});

describe('the end of the field', () => {
  it('the champion fight is the last survivor engaged, and nothing else', () => {
    const alone = fieldOf([fighter(1, at(0, 0), { engaged: true })]);
    expect(championFight(alone)).toBe(true);
    // Two engaged and nobody else standing is not it.
    expect(championFight(fieldOf([fighter(1, at(0, 0), { engaged: true }), fighter(2, at(1, 0), { engaged: true })]))).toBe(false);
    expect(championFight(fieldOf([fighter(1, at(0, 0))]))).toBe(false);
    expect(championFight(fieldOf([]))).toBe(false);
  });

  it('survivors who reach a free player are the player’s next fight; a busy player is left alone', () => {
    const rng = seeded(5);
    const busy = fieldOf([fighter(1, at(0, 2)), fighter(2, at(-15, -15)), fighter(3, at(15, 15))]);
    expect(stepField(busy, step(0, rng, { playerFree: false }), 34).engaged).toEqual([]);
    const free = fieldOf([fighter(1, at(0, 2)), fighter(2, at(-15, -15)), fighter(3, at(15, 15))]);
    const engaged = stepField(free, step(0, rng), 34).engaged;
    expect(engaged.map((f) => f.id)).toEqual([1]);
    expect(free.fighters.find((f) => f.id === 1)!.engaged).toBe(true);
    expect(clearEngaged(free)).toBe(1);
    expect(free.fighters.map((f) => f.id)).toEqual([2, 3]);
  });

  it('never puts every survivor left into one fight: the last is fought alone', () => {
    const rng = seeded(9);
    const field = fieldOf([fighter(1, at(0, 2)), fighter(2, at(1, 2))]);
    expect(stepField(field, step(0, rng, only('hold')), 34).engaged).toHaveLength(1);
    clearEngaged(field);
    for (let t = 1; t < 2000 && !field.fighters.some((f) => f.engaged); t++) stepField(field, step(t, rng, only('hold')), 34);
    expect(field.fighters).toHaveLength(1);
    expect(field.fighters[0].engaged).toBe(true);
    expect(championFight(field)).toBe(true);
  });

  it('a field with no one on it gets its champion back, so the royale can end', () => {
    const field = fieldOf([]);
    expect(restoreChampion(field)).toBe(true);
    expect(field.fighters).toHaveLength(1);
    expect(restoreChampion(field)).toBe(false);
  });

  it('two survivors who meet duel; when it ends the loser falls and the winner is wounded', () => {
    const rng = seeded(3);
    const field = fieldOf([fighter(1, at(-15, -15)), fighter(2, at(-14, -15)), fighter(3, at(15, 15))], at(15, -15));
    stepField(field, step(0, rng, only('hold')), 34);
    expect(field.fighters.find((f) => f.id === 1)!.duel?.foe).toBe(2);
    let fallen = 0;
    for (let t = 1; t <= ROYALE_FIELD.duelTicks; t++) fallen += stepField(field, step(t, rng, only('hold')), 34).fallen;
    expect(fallen).toBe(1);
    expect(field.fallen).toBe(1);
    const winner = field.fighters.find((f) => f.id === 1 || f.id === 2)!;
    expect(winner.wins).toBe(1);
    expect(winner.hp).toBeLessThan(1);
    expect(winner.duel).toBeUndefined();
    expect(winner.lastFight).toBe(ROYALE_FIELD.duelTicks);
  });
});

describe('a plan alone', () => {
  /**
   * The player wins every fight at once and a den at once; fights last
   * `fight` ticks. Returns the tick the field emptied at, how many survivor
   * fights there were, and the size of the last one.
   */
  function emptyField(plan: string[], seed: number, fight = 40) {
    const rng = seeded(seed);
    const field = createField(rng, seed * 7919 + 13, 0);
    let until = -1;
    let fights = 0;
    let lastFightSize = 0;
    let t = 0;
    for (; t < 60_000 && field.fighters.length > 0; t++) {
      if (t === until) {
        clearEngaged(field);
        field.player.lastFight = t;
      }
      const result = stepField(field, step(t, rng, { playerFree: t >= until, plan: plan.map((id) => ROYALE_STRATEGIES[id]) }), 37);
      if (result.engaged.length) {
        fights += 1;
        lastFightSize = result.engaged.length;
        until = t + fight;
      }
      if (result.den) {
        field.cleared!.push(result.den.id);
        field.player.lastFight = t;
        until = t + fight;
      }
    }
    return { field, t, fights, lastFightSize };
  }

  it('empties the field: every engagement won, the last one alone, and it ends', () => {
    for (const plan of [DEFAULT_ROYALE_PLAN, ['keep_away'], ['wait_at_edge'], ['hold_centre'], ['lie_low', 'hunt_weakest'], ['wander']]) {
      const { field, t, lastFightSize } = emptyField(plan, 21);
      expect(field.fighters, `plan ${plan.join(', ')} after ${t} ticks`).toHaveLength(0);
      expect(lastFightSize, `plan ${plan.join(', ')}: the champion is fought alone`).toBe(1);
    }
  });

  it('survivors take caches, and dens thin the field without ever emptying it', () => {
    const { field } = emptyField(DEFAULT_ROYALE_PLAN, 3);
    expect(field.taken!.length).toBeGreaterThan(10);
    expect(field.fallen).toBeGreaterThan(0);
  });

  it('a field step with ninety-nine survivors costs well under a tick’s budget', () => {
    const rng = seeded(8);
    const field = createField(rng, 77, 0);
    const plan = DEFAULT_ROYALE_PLAN.map((id) => ROYALE_STRATEGIES[id]);
    for (let t = 0; t < 20; t++) stepField(field, step(t, rng, { plan }), 37);
    const from = performance.now();
    const steps = 200;
    for (let t = 20; t < 20 + steps; t++) stepField(field, step(t, rng, { plan }), 37);
    // Measured about 0.1 ms; the bound only catches a pass gone quadratic in the wrong place.
    expect((performance.now() - from) / steps).toBeLessThan(5);
    expect(field.fighters.length).toBeGreaterThan(80);
  });
});
