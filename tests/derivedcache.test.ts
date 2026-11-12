// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { computeDerivedStats, getDerivedStats } from '../src/core/systems/derived';
import { grantAttrXp, attrXpNeeded } from '../src/core/systems/attributes';
import { applyStatus, hasStatus } from '../src/core/systems/statuses';
import { monsterTagSet } from '../src/core/systems/bestiary';
import { createItem } from '../src/core/systems/runes';
import { stashToken } from '../src/core/systems/stash';
import { startActivity } from '../src/core/systems/actions';
import { FRONT_TICKS, weatherAt, worldSeedOf } from '../src/core/systems/weather';
import { ATTRIBUTE_LIST } from '../src/core/data/attributes.data';
import { REGIONS, STATUSES } from '../src/core/registry';

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

  it('invalidates when a festival token buys a stack of the permanent bonus', () => {
    // The Vermin Festival's legacy bonus (systems/stash.ts, legacy.ts): a
    // modifier source that moves mid-run, when a token is spent.
    const g = huntingGame();
    const before = getDerivedStats(g.state);
    stashToken(g.state, 1);
    expect(g.spendFestivalToken(0, { kind: 'bonus' })).toBe(true);
    const after = getDerivedStats(g.state);
    expect(after).not.toBe(before);
    expect(after).toEqual(computeDerivedStats(g.state));
    expect(after.damage).toBeGreaterThan(before.damage);
    expect(after.maxHp).toBeGreaterThan(before.maxHp);
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

/**
 * A condition that fades with its clock (`decayWithDuration`) changes its
 * effective intensity on every tick it is held. The fingerprint keys it by that
 * only when the stat block reads it (statuses.ts statBlockIntensity); otherwise
 * a gale's buffeted rebuilt the whole block on nearly every tick.
 */
describe('a decaying condition and the cache', () => {
  const DECAYING = Object.values(STATUSES).filter((s) => s.decayWithDuration);
  const reads = (s: (typeof DECAYING)[number]) => (s.mods?.length ?? 0) > 0 || !!s.damp || !!s.resFloor || !!s.attrCeiling;

  /**
   * Hold `id` on an idle character until it expires, checking the cached block
   * against a fresh compute on every tick. Returns the number of distinct blocks
   * served from the first tick after the dose to the end, and the ticks it ran.
   */
  function life(id: string, doses: number[]): { blocks: number; ticks: number } {
    const g = new Game(createInitialState(21));
    g.suppressLog = true;
    for (const intensity of doses) applyStatus(g.state, g.state, { id, intensity }, 'test');
    expect(hasStatus(g.state, id)).toBe(true);
    let last = getDerivedStats(g.state);
    expect(last).toEqual(computeDerivedStats(g.state));
    let blocks = 1;
    let ticks = 0;
    for (; hasStatus(g.state, id) && ticks < 20_000; ticks++) {
      g.step(1);
      const cur = getDerivedStats(g.state);
      expect(cur, `${id} at tick ${ticks}`).toEqual(computeDerivedStats(g.state));
      if (cur !== last) {
        blocks++;
        last = cur;
      }
    }
    expect(hasStatus(g.state, id), `${id} ran out`).toBe(false);
    return { blocks, ticks };
  }

  it('every decaying condition matches a fresh compute on every tick of its life', () => {
    for (const def of DECAYING) life(def.id, [2, 1]);
  });

  it('a held tainted keeps its decay in the fingerprint: the block follows it down', () => {
    const { blocks, ticks } = life('tainted', [2]);
    expect(ticks).toBeGreaterThan(100);
    // Its mods wane with its clock, so the block changes on most ticks of its life.
    expect(blocks).toBeGreaterThan(ticks / 2);
  });

  it('a decaying condition with no field the stat block reads rebuilds nothing as it fades', () => {
    for (const def of DECAYING.filter((s) => !reads(s))) {
      const { blocks, ticks } = life(def.id, [2, 1]);
      expect(ticks, def.id).toBeGreaterThan(100);
      // The dose, and the block after it is gone: nothing between.
      expect(blocks, def.id).toBeLessThanOrEqual(2);
    }
  });

  describe('under a gale on the open ridge', () => {
    const CREATED = 1_754_000_000_000;
    const SEED = worldSeedOf(CREATED);
    const TICKS = 3000;

    /** A strong hunter on the open east ridge at the start of the first gale; hp is held so no knockout ends the stay. */
    function galeHunter(): Game {
      const state = createInitialState(CREATED, 'f17_east_ridge');
      for (let cell = 0; ; cell++) {
        if (weatherAt(SEED, REGIONS.malgeri_range, cell * FRONT_TICKS)!.kind === 'gale') {
          state.totalTicks = cell * FRONT_TICKS;
          break;
        }
      }
      for (const a of ATTRIBUTE_LIST) state.attrs[a.id].level = 150;
      state.level = 60;
      startActivity(state, { emit: () => {}, on: () => () => {} } as never, 'hunt');
      const g = new Game(state);
      g.suppressLog = true;
      return g;
    }

    it('serves a block equal to a fresh compute on every tick, and rebuilds on a minority of them', () => {
      const g = galeHunter();
      let last = getDerivedStats(g.state);
      let rebuilds = 0;
      let buffeted = 0;
      for (let i = 0; i < TICKS; i++) {
        g.state.resources.hp = 1e9;
        g.tick();
        if (hasStatus(g.state, 'buffeted')) buffeted++;
        const cur = getDerivedStats(g.state);
        expect(cur, `tick ${i}`).toEqual(computeDerivedStats(g.state));
        if (cur !== last) {
          rebuilds++;
          last = cur;
        }
      }
      expect(g.state.spot).toBe('f17_east_ridge');
      // The gale must really be on the character, or the count means nothing.
      expect(buffeted).toBeGreaterThan(TICKS / 2);
      // Keyed by its decaying intensity, buffeted rebuilt the block on nearly every one of those
      // ticks (2,764 of 3,000 when measured); now only its dose, its expiry and the fights do.
      expect(rebuilds).toBeLessThan(TICKS / 4);
    }, 60_000);
  });
});
