// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { computeDerivedStats, getDerivedStats } from '../src/core/systems/derived';
import { grantAttrXp, attrXpNeeded } from '../src/core/systems/attributes';
import { applyStatus } from '../src/core/systems/statuses';
import { monsterTagSet } from '../src/core/systems/bestiary';
import { createItem } from '../src/core/systems/runes';
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

  it('invalidates when the parts or the grade of a forged piece change under the same uid', () => {
    // A forged item's definition is derived from `forged`, and the uid never
    // moves, so the parts and the grade have to be in the fingerprint
    // themselves (modFingerprint appends forgeKey to the equipment entry).
    const g = huntingGame();
    const sword = createItem(g.state, 'forged:sword');
    g.state.inventory.push(sword);
    g.equip(sword.uid);
    const first = getDerivedStats(g.state);
    expect(first).toEqual(computeDerivedStats(g.state));
    expect(getDerivedStats(g.state)).toBe(first);

    // Re-forge the blade in place: same instance, different parts.
    const worn = g.state.equipment.weapon!;
    worn.forged!.parts[0].kind = 'short';
    const shorter = getDerivedStats(g.state);
    expect(shorter).not.toBe(first);
    expect(shorter).toEqual(computeDerivedStats(g.state));
    expect(shorter.damage).toBeLessThan(first.damage);

    // And the grade alone.
    worn.forged!.q = 's';
    const fine = getDerivedStats(g.state);
    expect(fine).not.toBe(shorter);
    expect(fine).toEqual(computeDerivedStats(g.state));
    expect(fine.damage).toBeGreaterThan(shorter.damage);
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
