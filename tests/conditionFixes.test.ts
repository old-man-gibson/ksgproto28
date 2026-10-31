// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { MAIN_GENES, SPOTS } from '../src/core/registry';
import { spawnMonster, tickCombat } from '../src/core/systems/combat';
import { getDerivedStats } from '../src/core/systems/derived';
import { MONSTER_ACTION_BAR, monsterStats } from '../src/core/systems/monsterStats';
import { perTargetInflictIntensity } from '../src/core/systems/mutagens';
import { applyStatus, findStatus, hasStatus } from '../src/core/systems/statuses';
import { HUNGER_SLOW_CEILING } from '../src/core/data/statuses.data';

describe('the Weight of Hunger', () => {
  it('slows at most 3× however much hunger the target carries', () => {
    const g = new Game(createInitialState(14));
    const foe = spawnMonster(g.state, SPOTS.woods_edge, { monsterId: 'forest_rat', level: 1, plain: true });
    applyStatus(g.state, foe, { id: 'hunger_anupama', intensity: 1 }, 'test', undefined, 1);
    findStatus(foe, 'hunger_anupama')!.stacks = 100000;
    const spec = MAIN_GENES.asurendra_anupama.ability!.spec;
    if (spec.type !== 'gene') throw new Error('unreachable');
    const at = perTargetInflictIntensity(spec, { id: 'asurendra_anupama', quality: 's' }, foe);
    expect(at).toBeCloseTo(HUNGER_SLOW_CEILING);
  });
});

describe('Tainted’s resistance floor', () => {
  it('stops its own penalty at the floor but never raises a lower resistance', () => {
    const g = new Game(createInitialState(15));
    const foe = spawnMonster(g.state, SPOTS.woods_edge, { monsterId: 'slime_metal', level: 5, plain: true });
    const before = monsterStats(foe).resistances;
    applyStatus(g.state, foe, { id: 'tainted', intensity: 1 }, 'test', undefined, 1);
    expect(hasStatus(foe, 'tainted')).toBe(true);
    const after = monsterStats(foe).resistances;
    // Lightning was -60% before: Tainted adds nothing below its floor, and does not lift it to -25%.
    expect(after.lightning).toBeCloseTo(before.lightning!);
    // Heat was +50%: Tainted's -5% applies normally.
    expect(after.heat).toBeCloseTo(before.heat! - 0.05, 2);
  });
});

describe('Magnetized on weapon blows', () => {
  /** Player crits over many spear swings at a target that never acts. */
  function crits(magnetized: boolean): number {
    const g = new Game(createInitialState(16));
    g.state.spot = 'woods_edge';
    g.state.equipment.weapon = { uid: 10, defId: 'old_spear', slots: 0, runes: [] };
    const foe = spawnMonster(g.state, SPOTS.woods_edge, { monsterId: 'forest_rat', level: 1, plain: true });
    g.state.combat = {
      enemies: [foe, null, null, null, null],
      playerBar: 0, momentum: 0, position: 'neutral', cooldowns: {}, buffs: [], events: {},
    };
    if (magnetized) {
      applyStatus(g.state, foe, { id: 'magnetized', intensity: 5, duration: 1e7 }, 'test', undefined, 1);
    }
    const maxHp = getDerivedStats(g.state).maxHp;
    for (let i = 0; i < 4000 && g.state.combat; i++) {
      g.state.resources.hp = maxHp;
      foe.hp = 1e9;
      foe.bar = 0;
      g.state.totalTicks += 1;
      tickCombat(g.state, g.bus, SPOTS.woods_edge);
    }
    return g.state.stats['combat:crits'] ?? 0;
  }

  it('raises the crit chance of piercing weapon hits', () => {
    const bare = crits(false);
    const iron = crits(true);
    expect(iron).toBeGreaterThan(bare * 1.5 + 5);
  });
});

/**
 * One forest rat (melee) against the player, with the rat's bar full every
 * tick and both sides kept alive, until the rat has landed a blow.
 */
function ratLands(setup: (g: Game, foe: ReturnType<typeof spawnMonster>) => void): string[] {
  const g = new Game(createInitialState(11));
  g.state.spot = 'woods_edge';
  const foe = spawnMonster(g.state, SPOTS.woods_edge, { monsterId: 'forest_rat', level: 1, plain: true });
  g.state.combat = {
    enemies: [foe, null, null, null, null],
    playerBar: 0, momentum: 0, position: 'neutral', cooldowns: {}, buffs: [], events: {},
  };
  setup(g, foe);
  const maxHp = getDerivedStats(g.state).maxHp;
  for (let i = 0; i < 400 && g.state.combat && !(g.state.stats['combat:hitsTaken'] ?? 0); i++) {
    g.state.resources.hp = maxHp;
    foe.hp = 1e9;
    foe.bar = MONSTER_ACTION_BAR;
    g.state.totalTicks += 1;
    tickCombat(g.state, g.bus, SPOTS.woods_edge);
  }
  expect(g.state.stats['combat:hitsTaken'] ?? 0, 'the rat landed a blow').toBeGreaterThan(0);
  return (g.state.combatFeed ?? []).map((l) => l.text);
}

describe('a monster’s own miss chance', () => {
  it('Steam-blinded makes an enemy’s attacks miss', () => {
    const g = new Game(createInitialState(12));
    g.state.spot = 'woods_edge';
    const foe = spawnMonster(g.state, SPOTS.woods_edge, { monsterId: 'forest_rat', level: 1, plain: true });
    g.state.combat = {
      enemies: [foe, null, null, null, null],
      playerBar: 0, momentum: 0, position: 'neutral', cooldowns: {}, buffs: [], events: {},
    };
    const maxHp = getDerivedStats(g.state).maxHp;
    for (let i = 0; i < 60 && g.state.combat; i++) {
      applyStatus(g.state, foe, { id: 'toll_steam', intensity: 1 });
      g.state.resources.hp = maxHp;
      foe.hp = 1e9;
      foe.bar = MONSTER_ACTION_BAR;
      g.state.totalTicks += 1;
      tickCombat(g.state, g.bus, SPOTS.woods_edge);
    }
    const feed = (g.state.combatFeed ?? []).map((l) => l.text);
    expect(feed.some((t) => t.includes('attack misses: a condition on it'))).toBe(true);
  });
});

describe('sealed monster workings', () => {
  /** A firetongue (two casts in its rotation) taking 30 turns; returns how many it cast. */
  function castsWith(sealed: boolean): number {
    const g = new Game(createInitialState(13));
    g.state.spot = 'woods_edge';
    const foe = spawnMonster(g.state, SPOTS.woods_edge, { monsterId: 'goblin_firetongue', level: 5, plain: true });
    g.state.combat = {
      enemies: [foe, null, null, null, null],
      playerBar: 0, momentum: 0, position: 'neutral', cooldowns: {}, buffs: [], events: {},
      ...(sealed ? { sealed: ['goblin_firetongue:0:0', 'goblin_firetongue:1:0'] } : {}),
    };
    const maxHp = getDerivedStats(g.state).maxHp;
    for (let i = 0; i < 30 && g.state.combat; i++) {
      g.state.resources.hp = maxHp;
      foe.hp = 1e9;
      foe.bar = MONSTER_ACTION_BAR;
      g.state.totalTicks += 50;
      tickCombat(g.state, g.bus, SPOTS.woods_edge);
    }
    return (g.state.combatFeed ?? []).filter((l) => l.text.includes('The Goblin Firetongue casts')).length;
  }

  it('are not cast again in the same fight', () => {
    expect(castsWith(false), 'unsealed, the firetongue casts').toBeGreaterThan(0);
    expect(castsWith(true)).toBe(0);
  });
});

describe('conditions that answer a blow', () => {
  it('Refutation hurts the attacker that strikes you in melee, not you', () => {
    const feed = ratLands((g) => applyStatus(g.state, g.state, { id: 'refutation', intensity: 1 }));
    expect(feed.some((t) => t.includes('Refutation hits the'))).toBe(true);
    expect(feed.some((t) => t.includes('Refutation tears at you'))).toBe(false);
  });

  it('Shardbound on an enemy cuts that enemy when it attacks', () => {
    const feed = ratLands((g, foe) => applyStatus(g.state, foe, { id: 'shardbound', intensity: 2 }));
    expect(feed.some((t) => t.includes('Shardbound hits the'))).toBe(true);
  });

  it('Shardbound on you still cuts you when you are struck', () => {
    const feed = ratLands((g) => applyStatus(g.state, g.state, { id: 'shardbound', intensity: 2 }));
    expect(feed.some((t) => t.includes('Shardbound tears at you'))).toBe(true);
  });
});
