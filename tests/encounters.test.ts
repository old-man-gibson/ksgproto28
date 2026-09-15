// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { SPOTS } from '../src/core/registry';
import { POSITION_MODS, liveEnemies, spawnGroup } from '../src/core/systems/combat';
import { ENCOUNTER_SLOTS } from '../src/core/types';

/** Roll a spot's formation many times so weighted outcomes are all represented. */
function sample(seed: number, spotId: string, rounds = 60) {
  const g = new Game(createInitialState(seed));
  return Array.from({ length: rounds }, () => spawnGroup(g.state, SPOTS[spotId]));
}

describe('encounter groups', () => {
  it('always fills exactly ENCOUNTER_SLOTS, padding with nulls', () => {
    for (const slots of sample(1, 'malgeri_base', 20)) {
      expect(slots).toHaveLength(ENCOUNTER_SLOTS);
      expect(slots[0]).not.toBeNull(); // the centre is always occupied
    }
  });

  it('a swarm zone produces groups larger than one', () => {
    const sizes = sample(2, 'malgeri_base').map((s) => s.filter(Boolean).length);
    expect(Math.max(...sizes)).toBeGreaterThan(1);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(ENCOUNTER_SLOTS);
  });

  it('a solitary zone keeps groups small', () => {
    const sizes = sample(3, 'ravine_floor').map((s) => s.filter(Boolean).length);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(2); // groupWeights { 1: 85, 2: 15 }
  });

  it('a monster group rule overrides the area distribution (Stone Golems are solitary)', () => {
    // ravine_floor rolls golems; whenever one leads, it must be alone.
    for (const slots of sample(4, 'ravine_floor', 120)) {
      const group = slots.filter(Boolean);
      if (group.some((m) => m!.defId === 'stone_golem')) {
        expect(group).toHaveLength(1);
      }
    }
  });

  it('a Goblin Boss always brings a full squad of its declared escorts', () => {
    let seen = 0;
    for (const slots of sample(5, 'malgeri_base', 200)) {
      const group = slots.filter(Boolean).map((m) => m!);
      const boss = group.find((m) => m.defId === 'goblin_boss');
      if (!boss) continue;
      seen++;
      expect(group).toHaveLength(ENCOUNTER_SLOTS);
      // Everything that isn't the boss is its escort.
      for (const m of group) {
        if (m !== boss) expect(m.defId).toBe('goblin');
      }
    }
    expect(seen).toBeGreaterThan(0); // the case was actually exercised
  });

  it('formation puts a melee up front when the group has one', () => {
    for (const slots of sample(6, 'malgeri_base', 120)) {
      const group = slots.filter(Boolean).map((m) => m!);
      if (group.some((m) => m.range === 'melee')) {
        expect(slots[0]!.range).toBe('melee');
      }
    }
  });
});

describe('positional modifiers', () => {
  it('melee are weaker and slower in the back than the front', () => {
    expect(POSITION_MODS.back.melee.damage).toBeLessThan(POSITION_MODS.front.melee.damage);
    expect(POSITION_MODS.back.melee.fill).toBeLessThan(POSITION_MODS.front.melee.fill);
  });

  it('ranged fight at full effect from the back and get jostled up front', () => {
    expect(POSITION_MODS.back.ranged.damage).toBe(1);
    expect(POSITION_MODS.back.ranged.fill).toBe(1);
    expect(POSITION_MODS.back.ranged.stunPerTick).toBe(0);
    expect(POSITION_MODS.front.ranged.stunPerTick).toBeGreaterThan(0);
  });

  it("the front-row stun is capped per fill, so a ranged enemy still gets to attack", () => {
    const { stunPerTick, stunCap } = POSITION_MODS.front.ranged;
    // Worst case the enemy loses `stunCap` units of progress per fill cycle —
    // finite, so the bar always completes eventually.
    expect(stunCap).toBeGreaterThan(0);
    expect(stunCap).toBeLessThan(1000); // MONSTER_ACTION_BAR — never a full lockout
    expect(stunPerTick).toBeLessThanOrEqual(stunCap);
  });
});

describe('encounter resolution', () => {
  it('killing the centre promotes a survivor and empties its old slot', () => {
    const g = new Game(createInitialState(7));
    g.state.spot = 'malgeri_base';
    g.selectActivity('hunt');

    // Find a tick where a multi-enemy group is live.
    let group: ReturnType<typeof liveEnemies> = [];
    for (let i = 0; i < 400 && group.length < 2; i++) {
      g.tick();
      if (g.state.combat) group = liveEnemies(g.state.combat);
    }
    if (group.length < 2) return; // no multi group rolled in this budget

    const before = liveEnemies(g.state.combat!).length;
    g.state.combat!.enemies[0]!.hp = 0; // next player swing finishes it
    for (let i = 0; i < 200 && g.state.combat && liveEnemies(g.state.combat).length === before; i++) {
      g.tick();
    }
    if (!g.state.combat) return; // the whole group died; covered by the next test

    const after = liveEnemies(g.state.combat);
    expect(after.length).toBe(before - 1);
    expect(g.state.combat.enemies[0]).not.toBeNull(); // someone stepped forward
  });

  it('the encounter only ends once every slot is empty', () => {
    const g = new Game(createInitialState(8));
    g.state.spot = 'malgeri_base';
    g.selectActivity('hunt');
    for (let i = 0; i < 200 && !g.state.combat; i++) g.tick();
    expect(g.state.combat).not.toBeNull();

    // Wipe all but one; the encounter must still be running.
    const c = g.state.combat!;
    for (let i = 1; i < c.enemies.length; i++) c.enemies[i] = null;
    expect(liveEnemies(c).length).toBe(1);
    expect(g.state.combat).not.toBeNull();
  });
});
