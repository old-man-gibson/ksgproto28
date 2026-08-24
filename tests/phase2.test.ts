import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import {
  damageVsMonster,
  incomingDamage,
  monsterResistance,
  playerDamageType,
} from '../src/core/systems/combat';
import { getDerivedStats, RESIST_CAP } from '../src/core/systems/derived';
import { canAfford, recipeUnlocked } from '../src/core/systems/crafting';
import { spotActivities } from '../src/core/systems/actions';
import { RECIPES, SPOTS } from '../src/core/registry';

describe('typed damage math', () => {
  it('monster resistance halves, vulnerability amplifies', () => {
    // fire slime: heat 0.5 resist, cold -0.5 vulnerable
    expect(damageVsMonster('slime_fire', 'heat', 100)).toBeCloseTo(50);
    expect(damageVsMonster('slime_fire', 'cold', 100)).toBeCloseTo(150);
    expect(damageVsMonster('slime_fire', 'arcane', 100)).toBeCloseTo(100); // unlisted = 0
  });

  it('slime golem arcane vulnerability clamps at double damage', () => {
    expect(monsterResistance('slime_golem', 'arcane')).toBe(-1);
    expect(damageVsMonster('slime_golem', 'arcane', 100)).toBeCloseTo(200);
  });

  it('player armor reduces physical but not elemental damage', () => {
    const g = new Game(createInitialState(1));
    const stats = { ...getDerivedStats(g.state), armor: 10 };
    expect(incomingDamage(stats, 'slashing', 30)).toBe(20);
    expect(incomingDamage(stats, 'heat', 30)).toBe(30);
    void g;
  });

  it('player resistance is percentage after armor and never below 1 damage', () => {
    const g = new Game(createInitialState(2));
    const stats = { ...getDerivedStats(g.state), armor: 10, resSlashing: 0.5, resHeat: 0.5 };
    expect(incomingDamage(stats, 'slashing', 30)).toBe(10); // (30-10)*0.5
    expect(incomingDamage(stats, 'heat', 30)).toBe(15);
    expect(incomingDamage(stats, 'slashing', 5)).toBe(1); // floor
  });

  it('derived resistances cap at 75%', () => {
    const g = new Game(createInitialState(3));
    g.state.skills['heat_resistance'] = { level: 500, xp: 0 }; // curve is far past the cap by 500
    expect(getDerivedStats(g.state).resHeat).toBe(RESIST_CAP);
  });

  it('resistance skills compound: 1%/level, 3% on 5ths, 5% on 10ths, 10% on 25ths', () => {
    const g = new Game(createInitialState(3));
    const resAt = (level: number) => {
      g.state.skills['heat_resistance'] = { level, xp: 0 };
      return getDerivedStats(g.state).resHeat;
    };
    expect(resAt(1)).toBeCloseTo(0.01, 6);
    expect(resAt(2)).toBeCloseTo(1 - 0.99 * 0.99, 6);
    // 5th levels take 3% off what's left, not 1%.
    expect(resAt(5)).toBeCloseTo(1 - 0.99 ** 4 * 0.97, 6);
    // 10 is also a multiple of 5 — the biggest step (5%) wins, applied once.
    expect(resAt(10)).toBeCloseTo(1 - 0.99 ** 8 * 0.97 * 0.95, 6);
    // 25 is a multiple of 5 and 25 — the 10% step wins.
    const block25 = 1 - 0.99 ** 20 * 0.97 ** 2 * 0.95 ** 2 * 0.9;
    expect(resAt(25)).toBeCloseTo(block25, 6);
    // The schedule crosses the 75% cap before level 100 (around level 75).
    expect(resAt(74)).toBeLessThan(RESIST_CAP);
    expect(resAt(75)).toBe(RESIST_CAP);
  });

  it('weapon tags determine the player damage type; fists bludgeon', () => {
    const g = new Game(createInitialState(4));
    expect(playerDamageType(g.state)).toBe('bludgeoning');
    g.equip(1); // rusty sword
    expect(playerDamageType(g.state)).toBe('slashing');
    g.state.inventory.push({ uid: 800, defId: 'iron_dagger' });
    g.equip(800);
    expect(playerDamageType(g.state)).toBe('piercing');
  });
});

describe('exposure resistance skills', () => {
  function fightAt(seed: number, spot: string, ticks: number): Game {
    const g = new Game(createInitialState(seed));
    g.state.spot = spot;
    g.state.attrs.con.level = 60; // survive the exposure therapy
    g.state.attrs.str.level = 15;
    g.state.resources.hp = 500;
    g.selectActivity('hunt');
    for (let i = 0; i < ticks; i++) g.tick();
    return g;
  }

  it('getting burned by fire slimes manifests and levels Heat Resistance', () => {
    const g = fightAt(31, 'malgeri_path', 12000); // fire slimes + goblins
    expect(g.state.skills['heat_resistance']).toBeDefined();
    expect(g.state.skills['heat_resistance'].level).toBeGreaterThanOrEqual(1);
    expect(getDerivedStats(g.state).resHeat).toBeGreaterThan(0);
  });

  it('spider venom manifests Poison Resistance in Verdant Frontier', () => {
    const g = fightAt(32, 'ravine_floor', 12000); // cave spiders (poison)
    expect(g.state.skills['poison_resistance']).toBeDefined();
  });

  it('resistance skills never manifest from the wrong damage type', () => {
    const g = fightAt(33, 'woods_edge', 6000); // rats/wolves: piercing only
    expect(g.state.skills['heat_resistance']).toBeUndefined();
    expect(g.state.skills['poison_resistance']).toBeUndefined();
    expect(g.state.skills['cold_resistance']).toBeUndefined();
  });
});

describe('crafting', () => {
  function smith(seed: number): Game {
    const g = new Game(createInitialState(seed));
    g.state.spot = 'hamlet_forge';
    return g;
  }

  it('spot activities include synthesized craft entries', () => {
    const acts = spotActivities(SPOTS.hamlet_forge);
    expect(acts.some((a) => a.id === 'craft_iron_ingot')).toBe(true);
    expect(acts.some((a) => a.kind === 'job')).toBe(true); // originals kept
  });

  it('crafts ingots from scrap, consuming materials and leveling Smithing', () => {
    const g = smith(41);
    g.state.materials['iron_scrap'] = 9;
    g.selectActivity('craft_iron_ingot');
    for (let i = 0; i < 400; i++) g.tick(); // 3 crafts at 120 ticks each
    expect(g.state.materials['iron_ingot']).toBe(3);
    expect(g.state.materials['iron_scrap']).toBeUndefined(); // fully consumed
    expect(g.state.skills['smithing']?.level).toBeGreaterThanOrEqual(1);
    // …AND NOTHING ELSE. Smelting an ingot used to level all six crafting
    // trades — every recipe emitted a bare 'craft' tag that smithing, cooking,
    // alchemy, geneshaping, runecarving and leathercrafting all claimed, so one
    // spool of histones manifested four skills that had nothing to do with it.
    // A craft pays its own discipline now, and this is what says so.
    for (const other of ['cooking', 'alchemy', 'runecarving', 'leathercrafting']) {
      expect(g.state.skills[other], `smelting must not teach ${other}`).toBeUndefined();
    }
    expect(g.state.stats['crafts']).toBe(3);
    expect(g.state.activity).toBeNull(); // stopped when starved (4th craft impossible)
  });

  it('crafted items land in the inventory', () => {
    const g = smith(42);
    g.state.materials['iron_ingot'] = 1;
    g.state.materials['hardwood'] = 1;
    g.selectActivity('craft_iron_dagger');
    for (let i = 0; i < 230; i++) g.tick();
    expect(g.state.inventory.some((i) => i.defId === 'iron_dagger')).toBe(true);
  });

  it('gated recipes refuse selection until the skill threshold', () => {
    const g = smith(43);
    g.state.materials['iron_ingot'] = 99;
    expect(recipeUnlocked(g.state, RECIPES.iron_breastplate)).toBe(false);
    g.selectActivity('craft_iron_breastplate');
    expect(g.state.activity).toBeNull();

    g.state.skills['smithing'] = { level: 8, xp: 0 };
    g.selectActivity('craft_iron_breastplate');
    expect(g.state.activity).toBe('craft_iron_breastplate');
  });

  it('craftSpeed shortens the craft cycle', () => {
    const g = smith(44);
    g.state.materials['iron_scrap'] = 99;
    g.state.skills['smithing'] = { level: 100, xp: 0 }; // craftSpeed ×2
    g.state.achievements['artisan'] = 0;
    g.selectActivity('craft_iron_ingot');
    for (let i = 0; i < 130; i++) g.tick(); // one cycle would take 120 at ×1, ~60 at ×2
    expect(g.state.materials['iron_ingot']).toBeGreaterThanOrEqual(2);
  });

  it('canAfford tracks material stacks', () => {
    const g = smith(45);
    expect(canAfford(g.state, RECIPES.iron_ingot)).toBe(false);
    g.state.materials['iron_scrap'] = 3;
    expect(canAfford(g.state, RECIPES.iron_ingot)).toBe(true);
  });
});

describe('gather counters (Miner achievement)', () => {
  it('gathering bumps gather:<materialId> and tiers the Miner achievement', () => {
    const g = new Game(createInitialState(51));
    g.state.spot = 'malgeri_base';
    g.selectActivity('mine_scree'); // iron_scrap every 180 ticks
    for (let i = 0; i < 180 * 5 + 20; i++) g.tick();
    expect(g.state.stats['gather:iron_scrap']).toBeGreaterThanOrEqual(5);
    expect(g.state.achievements['miner']).toBeGreaterThanOrEqual(1); // tier I at 5
  });
});
