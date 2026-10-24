// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { computeDerivedStats, getDerivedStats } from '../src/core/systems/derived';
import { grantAttrXp, attrXpNeeded } from '../src/core/systems/attributes';
import { applyStatus } from '../src/core/systems/statuses';
import { monsterTagSet } from '../src/core/systems/bestiary';
import { STATUSES } from '../src/core/registry';

/**
 * The derived-stats cache (see modFingerprint in systems/derived.ts) promises
 * two things: identical inputs return the IDENTICAL object, and any change to
 * a modifier source is noticed. The long-simulation sweep at the bottom is the
 * tripwire for the second promise — a mod source added to collectBaseMods but
 * not to the fingerprint fails it as soon as a fight exercises the new source.
 */

function huntingGame(seed = 7, spot = 'woods_edge') {
  const game = new Game(createInitialState(seed));
  game.state.spot = spot;
  game.selectActivity('hunt');
  return game;
}

describe('derived-stats cache', () => {
  it('returns the identical object while nothing modifier-relevant changes', () => {
    const g = huntingGame();
    const first = getDerivedStats(g.state);
    expect(getDerivedStats(g.state)).toBe(first);
    expect(first).toEqual(computeDerivedStats(g.state));
  });

  it('invalidates on equipment changes', () => {
    const g = huntingGame();
    const bare = getDerivedStats(g.state);
    g.equip(1); // rusty sword
    const armed = getDerivedStats(g.state);
    expect(armed).not.toBe(bare);
    expect(armed).toEqual(computeDerivedStats(g.state));
    g.unequip('weapon');
    const disarmed = getDerivedStats(g.state);
    expect(disarmed).not.toBe(armed);
    expect(disarmed).toEqual(computeDerivedStats(g.state));
  });

  it('invalidates on the exertion toggle', () => {
    const g = huntingGame();
    const calm = getDerivedStats(g.state);
    g.setExerting(true);
    const exerting = getDerivedStats(g.state);
    expect(exerting).not.toBe(calm);
    expect(exerting).toEqual(computeDerivedStats(g.state));
  });

  it('invalidates on an attribute level-up', () => {
    const g = huntingGame();
    const before = getDerivedStats(g.state);
    grantAttrXp(g.state, g.bus, 'str', attrXpNeeded(g.state.attrs.str.level));
    const after = getDerivedStats(g.state);
    expect(after).not.toBe(before);
    expect(after).toEqual(computeDerivedStats(g.state));
    expect(after.damage).toBeGreaterThan(before.damage);
  });

  it('invalidates on a condition and follows its decay', () => {
    const g = huntingGame();
    // Any real condition with mods will do; find one so the test survives
    // content renames without hardcoding an id.
    const withMods = Object.values(STATUSES).find((s) => s.mods?.length && s.duration);
    expect(withMods).toBeTruthy();
    const before = getDerivedStats(g.state);
    applyStatus(g.state, g.state, { id: withMods!.id, intensity: 2 }, 'test');
    const afflicted = getDerivedStats(g.state);
    expect(afflicted).not.toBe(before);
    expect(afflicted).toEqual(computeDerivedStats(g.state));
  });

  it('invalidates on a cooked status and its grade, resistance past the cap included', () => {
    // Steeped Broth: resPoison +0.25 per intensity, and a Divine broth is 4 —
    // 1.0 before the cap, which condition immunity reads (statuses.ts).
    const g = huntingGame();
    const before = getDerivedStats(g.state);
    applyStatus(g.state, g.state, { id: 'steeped', intensity: 1 }, 'a broth');
    const fair = getDerivedStats(g.state);
    expect(fair).not.toBe(before);
    expect(fair.resPoison).toBeCloseTo(before.resPoison + 0.25);
    expect(fair).toEqual(computeDerivedStats(g.state));

    applyStatus(g.state, g.state, { id: 'steeped', intensity: 4 }, 'a broth');
    const divine = getDerivedStats(g.state);
    expect(divine).not.toBe(fair);
    expect(divine.resPoison).toBeCloseTo(0.75); // the damage cap
    expect(divine).toEqual(computeDerivedStats(g.state));
    // The immunity test sees the 1.0 under the cap on the cached block too.
    expect(applyStatus(g.state, g.state, { id: 'poison', intensity: 1 }, 'a fang', divine)).toBeNull();
  });

  it('invalidates when Cooking crosses a food milestone, and holds at the ×1.5 cap', () => {
    // The food stats come from Cooking's milestones (skills.data.ts), so the
    // skill level in modFingerprint is their whole invalidation input.
    const g = huntingGame();
    g.state.skills.cooking = { level: 9, xp: 0 };
    const before = getDerivedStats(g.state);
    expect(before.foodDuration).toBe(1);
    expect(before.foodPotency).toBe(1);

    g.state.skills.cooking = { level: 10, xp: 0 };
    const tenth = getDerivedStats(g.state);
    expect(tenth).not.toBe(before);
    expect(tenth.foodDuration).toBeCloseTo(1.06);
    expect(tenth).toEqual(computeDerivedStats(g.state));

    g.state.skills.cooking = { level: 20, xp: 0 };
    const twentieth = getDerivedStats(g.state);
    expect(twentieth).not.toBe(tenth);
    expect(twentieth.foodDuration).toBeCloseTo(1.12);
    expect(twentieth.foodPotency).toBeCloseTo(1.05);
    expect(twentieth).toEqual(computeDerivedStats(g.state));

    // Far past the last milestone the read is held at the cap, cached or not.
    g.state.skills.cooking = { level: 1000, xp: 0 };
    const deep = getDerivedStats(g.state);
    expect(deep).not.toBe(twentieth);
    expect(deep.foodDuration).toBe(1.5);
    expect(deep.foodPotency).toBe(1.5);
    expect(deep).toEqual(computeDerivedStats(g.state));
    expect(getDerivedStats(g.state)).toBe(deep);
  });

  it('serves target-gated variants from the same entry, consistently', () => {
    const g = huntingGame();
    g.equip(1);
    const tags = monsterTagSet('forest_rat');
    const vs = getDerivedStats(g.state, tags);
    expect(getDerivedStats(g.state, tags)).toBe(vs);
    expect(vs).toEqual(computeDerivedStats(g.state, tags));
    // The empty set is the base entry, not a variant.
    expect(getDerivedStats(g.state, new Set())).toBe(getDerivedStats(g.state));
  });

  it('never drifts from a fresh compute across a long fight', () => {
    const g = huntingGame(11);
    g.equip(1);
    g.suppressLog = true;
    const tags = new Set(['beast']);
    for (let i = 0; i < 4000; i++) {
      g.step(1);
      expect(getDerivedStats(g.state)).toEqual(computeDerivedStats(g.state));
      expect(getDerivedStats(g.state, tags)).toEqual(computeDerivedStats(g.state, tags));
    }
  }, 60000);
});
