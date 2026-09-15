// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { getDerivedStats, HP_REGEN_SHARE } from '../src/core/systems/derived';
import { TPS } from '../src/core/engine/loop';
import {
  IN_COMBAT_REGEN_MULT,
  RECOVERY_MULT,
  REST_MANA_MULT,
} from '../src/core/data/resources.data';
import { combatRegenMult } from '../src/core/systems/actions';
import { applyStatus, findStatus, hasStatus } from '../src/core/systems/statuses';
import { availableMax, resourceValue, trueMax } from '../src/core/systems/resources';

/**
 * The health trickle and what resting does to it.
 *
 * `woods_edge` is the spot of choice throughout: it carries a rest, an explore
 * and a hunt activity, so every recovery multiplier that matters can be
 * exercised without moving.
 */

/** A character standing at the woods' edge, wounded enough to have room to heal. */
function wounded(seed = 1, hp = 5): Game {
  const g = new Game(createInitialState(seed));
  g.state.spot = 'woods_edge';
  g.state.resources.hp = hp;
  return g;
}

/** HP gained over `ticks` ticks of whatever is currently selected. */
function healedOver(g: Game, ticks: number): number {
  const before = resourceValue(g.state, 'hp');
  g.step(ticks);
  return resourceValue(g.state, 'hp') - before;
}

/**
 * A wounded character with a real encounter under way, but stepped out of the
 * hunt loop so nothing swings while the trickle is measured. Assigning
 * `activity` directly is the point — `selectActivity` would abandon the fight,
 * and the fight is what is under test.
 */
function inCombat(seed = 1, hp = 5): Game {
  const g = wounded(seed, hp);
  g.selectActivity('hunt');
  g.step(1); // the first hunt tick starts the encounter, before anyone acts
  if (!g.state.combat) throw new Error('expected an encounter to have started');
  g.state.activity = 'explore';
  return g;
}

/** Wearing the one thing that currently grants HP regen: +0.4/s. */
function withVitalityCharm(g: Game): Game {
  g.state.equipment.accessory = {
    uid: 900,
    defId: 'lucky_charm',
    slots: 1,
    runes: ['greater_rune_vitality'],
  };
  return g;
}

describe('the hpRegen stat', () => {
  it('is a share of the pool it refills, plus a little constitution', () => {
    const g = new Game(createInitialState(1));
    const stats = getDerivedStats(g.state);
    const con = g.state.attrs.con.level;

    expect(stats.hpRegen).toBeCloseTo(stats.maxHp * HP_REGEN_SHARE + con * 0.01, 3);
  });

  it('grows with constitution — the pool gets bigger and refills no slower for it', () => {
    const weak = new Game(createInitialState(1));
    const hardy = new Game(createInitialState(1));
    hardy.state.attrs.con.level = 40;

    const w = getDerivedStats(weak.state);
    const h = getDerivedStats(hardy.state);
    expect(h.hpRegen).toBeGreaterThan(w.hpRegen);
    // Seconds to refill from empty: never worse than it was at a smaller size.
    expect(h.maxHp / h.hpRegen).toBeLessThanOrEqual(w.maxHp / w.hpRegen);
  });

  it('is reachable: a worn Greater Rune of Vitality mends as well as thickens', () => {
    const bare = new Game(createInitialState(1));
    const charmed = withVitalityCharm(new Game(createInitialState(1)));

    expect(getDerivedStats(charmed.state).hpRegen).toBeCloseTo(
      getDerivedStats(bare.state).hpRegen + 0.4,
      3,
    );
  });
});

describe('the health trickle', () => {
  it('runs while you are simply standing about', () => {
    const g = wounded();
    const rate = getDerivedStats(g.state).hpRegen;

    expect(healedOver(g, TPS)).toBeCloseTo(rate * RECOVERY_MULT.none, 2);
  });

  it('runs while you explore — the baseline is not something you have to earn', () => {
    const g = wounded();
    g.selectActivity('explore');
    const rate = getDerivedStats(g.state).hpRegen;

    expect(healedOver(g, TPS)).toBeCloseTo(rate * RECOVERY_MULT.explore, 2);
  });

  it('resting is the same trickle, several times over', () => {
    const idle = wounded();
    const resting = wounded();
    resting.selectActivity('rest_camp');

    const idleGain = healedOver(idle, TPS);
    const restGain = healedOver(resting, TPS);
    expect(restGain / idleGain).toBeCloseTo(RECOVERY_MULT.rest / RECOVERY_MULT.none, 3);
  });

  it('a live fight halves it — straining slows mending, it does not stop it', () => {
    const g = inCombat();
    g.state.resources.stamina = 1; // drawn off its ceiling: straining
    const rate = getDerivedStats(g.state).hpRegen;

    expect(healedOver(g, TPS)).toBeCloseTo(rate * IN_COMBAT_REGEN_MULT, 2);
  });

  it('but not while stamina is still at its ceiling', () => {
    const g = inCombat();
    const stats = getDerivedStats(g.state);
    g.state.resources.stamina = availableMax(g.state, stats, 'stamina');

    expect(healedOver(g, TPS)).toBeCloseTo(stats.hpRegen, 2);
  });

  it('the lulls between encounters mend you at the ordinary rate', () => {
    const g = wounded();
    g.selectActivity('hunt');
    g.state.respawnTimer = 5 * TPS; // nothing to fight yet
    g.state.resources.stamina = 1; // drawn down, but no fight to strain in
    const rate = getDerivedStats(g.state).hpRegen;

    expect(healedOver(g, TPS)).toBeCloseTo(rate * RECOVERY_MULT.hunt, 2);
    expect(g.state.combat).toBeNull(); // the timer really did hold the fight off
  });

  it('a wound that seals off stamina does not read as permanent strain', () => {
    const g = inCombat();
    const before = trueMax(getDerivedStats(g.state), 'stamina');
    // Skewered closes off part of the pool. A bar that reads full IS full.
    applyStatus(g.state, g.state, { id: 'perforated', intensity: 1 });
    const sealed = availableMax(g.state, getDerivedStats(g.state), 'stamina');
    expect(sealed).toBeLessThan(before);

    g.state.resources.stamina = sealed;
    expect(combatRegenMult(g.state, getDerivedStats(g.state))).toBe(1);
  });

  it('is not dragged lower by being winded or exhausted — half is the whole of it', () => {
    const g = inCombat();
    g.state.resources.stamina = 0;
    g.state.resourceLocks = { stamina: 'empty' };

    expect(combatRegenMult(g.state, getDerivedStats(g.state))).toBe(IN_COMBAT_REGEN_MULT);
  });

  it('carries what you were doing, so conditions can tell rest from idling', () => {
    const idle = wounded();
    const resting = wounded();
    resting.selectActivity('rest_camp');
    // A seared burn yields to real treatment and ignores getting on with things.
    applyStatus(idle.state, idle.state, { id: 'blaze_burn', intensity: 1 });
    applyStatus(resting.state, resting.state, { id: 'blaze_burn', intensity: 1 });

    idle.step(TPS);
    resting.step(TPS);
    expect(hasStatus(idle.state, 'blaze_burn')).toBe(true);
    expect(hasStatus(resting.state, 'blaze_burn')).toBe(false);
  });

  it('comes in through heal(), so a burn still rations what may be undone', () => {
    // Idling, not resting: a seared burn yields to rest, and the point here is
    // to keep it on long enough to watch it ration the trickle.
    const g = wounded(1, 5);
    // Seared caps healing at half of what the burn took — 10 of 20 dealt.
    applyStatus(g.state, g.state, { id: 'blaze_burn', intensity: 1 });
    findStatus(g.state, 'blaze_burn')!.data = { dealt: 20 };

    // Long enough that an uncapped trickle would have filled the bar outright.
    expect(healedOver(g, 120 * TPS)).toBeCloseTo(10, 1);
    expect(hasStatus(g.state, 'blaze_burn')).toBe(true);
  });

  it('picks up whatever raises the stat, and resting multiplies that too', () => {
    const bonus = 0.4; // the greater vitality rune, worn

    // The bonus is worth its face value while idling...
    const idleGain = healedOver(withVitalityCharm(wounded()), TPS) - healedOver(wounded(), TPS);
    expect(idleGain).toBeCloseTo(bonus * RECOVERY_MULT.none, 2);

    const plainRest = wounded();
    const charmedRest = withVitalityCharm(wounded());
    plainRest.selectActivity('rest_camp');
    charmedRest.selectActivity('rest_camp');
    // ...and RECOVERY_MULT.rest times that with your feet up.
    expect(healedOver(charmedRest, TPS) - healedOver(plainRest, TPS)).toBeCloseTo(
      bonus * RECOVERY_MULT.rest,
      2,
    );
  });

  it('recovering from a knockout rests you whether you chose it or not', () => {
    const g = wounded(1, 1);
    g.state.recovering = true;
    const rate = getDerivedStats(g.state).hpRegen;

    expect(healedOver(g, TPS)).toBeCloseTo(rate * RECOVERY_MULT.rest, 2);
  });
});

describe('resting and the other pools', () => {
  /** Mana gained over `ticks` ticks, from a pool with room to refill. */
  function manaOver(g: Game, ticks: number): number {
    g.state.attrs.int.level = 20; // a pool worth measuring
    g.state.resources.mana = 0;
    const before = resourceValue(g.state, 'mana');
    g.step(ticks);
    return resourceValue(g.state, 'mana') - before;
  }

  it('mana comes back faster while resting', () => {
    const idle = wounded();
    const resting = wounded();
    resting.selectActivity('rest_camp');

    expect(manaOver(resting, TPS) / manaOver(idle, TPS)).toBeCloseTo(REST_MANA_MULT, 3);
  });

  it('and at its ordinary rate for anything else', () => {
    const g = wounded();
    g.state.attrs.int.level = 20;
    const rate = getDerivedStats(g.state).manaRegen;
    g.selectActivity('explore');

    expect(manaOver(g, TPS)).toBeCloseTo(rate, 3);
  });

  it('leaves stamina alone — it declares no rest bonus', () => {
    const idle = wounded();
    const resting = wounded();
    resting.selectActivity('rest_camp');
    idle.state.resources.stamina = 0;
    resting.state.resources.stamina = 0;

    const before = resourceValue(idle.state, 'stamina');
    idle.step(TPS);
    resting.step(TPS);
    expect(resourceValue(resting.state, 'stamina') - before).toBeCloseTo(
      resourceValue(idle.state, 'stamina') - before,
      4,
    );
  });
});
