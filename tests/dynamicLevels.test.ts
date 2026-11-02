import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { createInitialState } from '../src/core/state';
import { BANDS, SPOTS } from '../src/core/registry';
import { spawnMonster, startForcedFight } from '../src/core/systems/combat';
import { dynamicLevelBonus, killXp, rewardLevel } from '../src/core/systems/levels';
import { spawnLevels } from '../src/core/systems/bestiary';
import { finalAttributes } from '../src/core/systems/derived';
import { createItem } from '../src/core/systems/runes';
import type { AttributeId, GameState } from '../src/core/types';

/**
 * Dynamic monster levels (BandDef.dynamicLevel, levels.ts dynamicLevelBonus):
 * on band 2 a table-rolled spawn gains floor(factor × gap / growth) levels, at
 * most `cap`, where gap is the player's three highest final attributes (gear,
 * titles, conditions and the level bonus included) over the monster's three
 * highest at its rolled level. Bosses are exempt and rewards read the level
 * without the bonus.
 *
 * The worked case is a forest rat at L8: book DEX 9.6, STR 6.2, CON 5.5
 * (mean 7.1), growth 0.8 / 0.6 / 0.5 (mean 0.633). Band 2 closes half the
 * gap, up to 8 levels.
 */

const ATTRS: AttributeId[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

function character(attrs: Partial<Record<AttributeId, number>>, level = 1): GameState {
  const s = createInitialState(7, 'f4_woods_edge');
  for (const a of ATTRS) s.attrs[a].level = attrs[a] ?? 1;
  s.level = level;
  return s;
}
const all = (n: number) => Object.fromEntries(ATTRS.map((a) => [a, n])) as Record<AttributeId, number>;
const edge = SPOTS.f4_woods_edge;

/** The worked case by hand: half the gap over a L8 rat's top three (7.1), over its growth (0.633), capped at 8. */
function ratBonus(s: GameState): number {
  const f = finalAttributes(s);
  const top = ATTRS.map((a) => f[a])
    .sort((a, b) => b - a)
    .slice(0, 3);
  const p = (top[0] + top[1] + top[2]) / 3;
  return Math.min(8, Math.max(0, Math.floor((0.5 * (p - 7.1)) / (1.9 / 3))));
}

describe('the bonus', () => {
  it('band 2 carries it: half the gap, up to 8 levels', () => {
    expect(BANDS.ascent_middle.dynamicLevel).toEqual({ factor: 0.5, cap: 8 });
  });

  it('a fresh character gets none', () => {
    const s = character({});
    for (const e of edge.encounters!) expect(dynamicLevelBonus(s, edge, e.monsterId, e.level[1]), e.monsterId).toBe(0);
  });

  it('closes half the gap, divided by the species growth: a rat at L8', () => {
    const s = character(all(12));
    expect(dynamicLevelBonus(s, edge, 'forest_rat', 8)).toBe(ratBonus(s));
    expect(ratBonus(s)).toBeGreaterThan(0);
  });

  it('reads the three highest final attributes, whichever they are: a caster counts', () => {
    const caster = character({ int: 14, wis: 14, cha: 14 });
    expect(dynamicLevelBonus(caster, edge, 'forest_rat', 8)).toBe(ratBonus(caster));
    expect(ratBonus(caster)).toBeGreaterThan(0);
  });

  it('reads the character-level bonus', () => {
    const lower = dynamicLevelBonus(character(all(8), 1), edge, 'forest_rat', 8);
    const higher = dynamicLevelBonus(character(all(8), 5), edge, 'forest_rat', 8);
    expect(higher).toBeGreaterThan(lower);
  });

  it('reads gear: a weapon that adds STR raises it', () => {
    const g = new Game(character({ str: 14, dex: 10, con: 10 }));
    const before = dynamicLevelBonus(g.state, edge, 'forest_rat', 8);
    const blade = createItem(g.state, 'steel_greatsword'); // +3 STR
    g.state.inventory.push(blade);
    g.equip(blade.uid, 'weapon');
    expect(finalAttributes(g.state).str).toBeGreaterThan(14 + 2);
    expect(dynamicLevelBonus(g.state, edge, 'forest_rat', 8)).toBe(ratBonus(g.state));
    expect(dynamicLevelBonus(g.state, edge, 'forest_rat', 8)).toBeGreaterThan(before);
  });

  it('stops at the cap', () => {
    expect(dynamicLevelBonus(character(all(40)), edge, 'forest_rat', 8)).toBe(8);
  });

  it('a strong species takes fewer levels for the same player', () => {
    const s = character(all(14));
    expect(dynamicLevelBonus(s, edge, 'goblin', 8)).toBeLessThan(dynamicLevelBonus(s, edge, 'forest_rat', 8));
  });

  it('is band 2 only', () => {
    const s = character(all(40));
    expect(dynamicLevelBonus(s, SPOTS.f2_hall_1, 'forest_rat', 4)).toBe(0);
  });
});

describe('spawning', () => {
  it('a hunt spawn carries its bonus; the rest of its level is the authored roll', () => {
    const s = character(all(40));
    const g = new Game(s);
    for (let i = 0; i < 40; i++) {
      const m = spawnMonster(g.state, edge);
      const line = edge.encounters!.find((e) => e.monsterId === m.defId)!;
      expect(m.levelBonus, m.defId).toBe(8);
      expect(rewardLevel(m)).toBeGreaterThanOrEqual(line.level[0]);
      expect(rewardLevel(m)).toBeLessThanOrEqual(line.level[1]);
    }
  });

  it('a fresh character spawns the authored levels and no bonus field', () => {
    const g = new Game(character({}));
    for (let i = 0; i < 20; i++) {
      const m = spawnMonster(g.state, edge);
      expect(m.levelBonus).toBeUndefined();
      expect(m.level).toBeLessThanOrEqual(9);
    }
  });

  it('a group filler takes its own bonus, pinned with its level', () => {
    const g = new Game(character(all(40)));
    const s = g.state;
    s.activity = 'hunt';
    let groups = 0;
    for (let t = 0; t < 20_000 && groups < 5; t++) {
      g.tick();
      const foes = s.combat?.enemies.filter((m) => m !== null) ?? [];
      if (foes.length > 1) {
        groups++;
        for (const m of foes) expect(m!.levelBonus, m!.defId).toBe(8);
        s.combat = null;
      }
      s.resources.hp = 1e6;
    }
    expect(groups).toBe(5);
  });

  it('a boss and its escorts are exempt', () => {
    const g = new Game(character(all(40)));
    const s = g.state;
    s.spot = 'f4_ravine_floor';
    startForcedFight(s, g.bus, SPOTS.f4_ravine_floor);
    const foes = s.combat!.enemies.filter((m) => m !== null);
    expect(foes.length).toBeGreaterThan(1);
    for (const m of foes) {
      expect(m!.levelBonus, m!.defId).toBeUndefined();
      expect(m!.level).toBe(9);
    }
  });
});

describe('rewards read the level without the bonus', () => {
  it('kill XP takes its level-gap share from the paid level', () => {
    const s = character({}, 15);
    // Paid level 12: three below the fighter, a third of the XP. At 20 it would be all of it.
    expect(killXp(s, { xp: 90, level: 20, levelBonus: 8 })).toBeCloseTo(30);
    expect(killXp(s, { xp: 90, level: 20 })).toBeCloseTo(90);
  });

  it('a spawn with a bonus is worth what the same spawn without it is worth', () => {
    const strong = new Game(character(all(40)));
    const plain = new Game(character({}));
    const a = spawnMonster(strong.state, edge);
    const b = spawnMonster(plain.state, edge);
    // Same seed, same draws: the same species, roll and modifier, eight levels apart.
    expect(a.defId).toBe(b.defId);
    expect(a.level - b.level).toBe(8);
    expect(a.xp).toBeCloseTo(b.xp);
    expect(a.gold).toBe(b.gold);
  });
});

describe('the bestiary', () => {
  it('quotes the levels this player meets', () => {
    const [, plainHi] = spawnLevels('young_wolf');
    expect(spawnLevels('young_wolf', character({}))[1]).toBe(plainHi);
    expect(spawnLevels('young_wolf', character(all(40)))[1]).toBeGreaterThan(plainHi);
  });
});
