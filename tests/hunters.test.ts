import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { getDerivedStats } from '../src/core/systems/derived';
import { monsterTagSet } from '../src/core/systems/bestiary';
import { MONSTERS } from '../src/core/registry';

/**
 * Tag hunters: kills are tallied per monster TAG, and the bonuses they buy are
 * gated on the same tag, so they only pay out against that quarry. A monster
 * carrying several hunted tags takes every matching bonus at once.
 */

/** Fire the kill event the combat loop emits, without staging a whole fight. */
function killed(g: Game, defId: string, times = 1): void {
  const monster = { defId, name: MONSTERS[defId].name, level: 1 } as never;
  for (let i = 0; i < times; i++) g.bus.emit({ type: 'kill', monster, xp: 1 });
}

describe('tag kill counters', () => {
  it('one kill tallies every tag the corpse carried', () => {
    const g = new Game(createInitialState(1));
    // A basic Slime is inorganic + slime + small, plus its derived tier tag.
    killed(g, 'slime_base_basic');

    expect(g.state.stats['kills']).toBe(1);
    expect(g.state.stats['kills:slime_base_basic']).toBe(1);
    expect(g.state.stats['kills:tag:slime']).toBe(1);
    expect(g.state.stats['kills:tag:inorganic']).toBe(1);
    // Derived tags count too — they are as real as the authored ones.
    expect(g.state.stats['kills:tag:basic']).toBe(1);
    // Nothing it wasn't.
    expect(g.state.stats['kills:tag:living'] ?? 0).toBe(0);
  });

  it('a tag tally spans every species carrying it', () => {
    const g = new Game(createInitialState(2));
    killed(g, 'slime_base_basic', 3);
    killed(g, 'slime_fire', 2);

    expect(g.state.stats['kills:tag:slime']).toBe(5); // one counter, two species
    expect(g.state.stats['kills:slime_base_basic']).toBe(3);
  });

  it('crossing a tier threshold grants the hunter achievement', () => {
    const g = new Game(createInitialState(3));
    killed(g, 'slime_base_basic', 5); // Slime Hunter I at 5
    expect(g.state.achievements['slime_kills']).toBe(1);
  });
});

describe('tag-gated bonuses', () => {
  /** A hunter with every tier of both example achievements claimed. */
  function hunter(seed: number): Game {
    const g = new Game(createInitialState(seed));
    g.state.achievements['slime_kills'] = 3;
    g.state.achievements['inorganic_kills'] = 3;
    return g;
  }

  it('never reaches the global stat block', () => {
    const g = hunter(4);
    const plain = new Game(createInitialState(4));
    // The bonuses are claimed, but a stat block asked with no target is clean.
    expect(getDerivedStats(g.state).damage).toBeCloseTo(getDerivedStats(plain.state).damage, 5);
    expect(getDerivedStats(g.state).penetration).toBeCloseTo(
      getDerivedStats(plain.state).penetration,
      5,
    );
  });

  it('pays out against its quarry and nothing else', () => {
    const g = hunter(5);
    const base = getDerivedStats(g.state).damage;
    expect(getDerivedStats(g.state, new Set(['slime'])).damage).toBeGreaterThan(base);
    // A wolf is living flesh: neither hunter bonus touches it.
    expect(getDerivedStats(g.state, monsterTagSet('wolf')).damage).toBeCloseTo(base, 5);
  });

  it('stacks when one monster carries several hunted tags', () => {
    const g = hunter(6);
    const base = getDerivedStats(g.state).damage;
    const slimeOnly = getDerivedStats(g.state, new Set(['slime'])).damage;
    const inorganicOnly = getDerivedStats(g.state, new Set(['inorganic'])).damage;
    // A basic Slime is BOTH, so it eats both damage lines.
    const both = getDerivedStats(g.state, monsterTagSet('slime_base_basic')).damage;

    expect(slimeOnly).toBeGreaterThan(base);
    expect(inorganicOnly).toBeGreaterThan(base);
    expect(both).toBeGreaterThan(slimeOnly);
    expect(both).toBeGreaterThan(inorganicOnly);
    // Multiplicative lines compose, so the pair beats either alone by the
    // other's share rather than replacing it.
    expect(both).toBeCloseTo(base * (slimeOnly / base) * (inorganicOnly / base), 5);
  });

  it('gates non-damage stats the same way', () => {
    const g = hunter(7);
    const base = getDerivedStats(g.state).penetration;
    expect(getDerivedStats(g.state, new Set(['inorganic'])).penetration).toBeGreaterThan(base);
    expect(getDerivedStats(g.state, new Set(['slime'])).penetration).toBeCloseTo(base, 5);
  });
});
