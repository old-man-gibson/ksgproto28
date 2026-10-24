// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { ITEMS, MAIN_GENES, MONSTERS, SPOTS, STATUSES, TITLES } from '../src/core/registry';
import { HUNGER_SLOW_CEILING } from '../src/core/data/statuses.data';
import { ELEMENTAL_TYPES, RES_STAT_BY_TYPE, type MonsterDef, type StatusDef } from '../src/core/types';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { getDerivedStats } from '../src/core/systems/derived';
import { getSpot } from '../src/core/registry';
import { spawnMonster } from '../src/core/systems/combat';
import { monsterStats } from '../src/core/systems/monsterStats';
import {
  APPLICATION_FLOOR,
  applyStatus,
  dueGraftSpread,
  escalationChance,
  fieldHunger,
  fireStatusEvent,
  findStatus,
  graftHarvest,
  graftLedger,
  hasStatus,
  removeStatus,
  statusDisplacedExit,
  tendOnDamage,
  healAllowance,
  statusBarDamage,
  statusBlocks,
  statusCeiling,
  statusCostMult,
  statusDampingFor,
  statusMissChance,
  statusDisadvantage,
  statusNegativeHeadroom,
  statusRetaliation,
  statusReversesBar,
  stripStatuses,
  tickStatuses,
} from '../src/core/systems/statuses';
import { effectiveStyleId } from '../src/core/systems/styles';
import { monsterResistance, monsterSlice, resistanceOf } from '../src/core/systems/combat';
import { heal } from '../src/core/systems/health';
import {
  availableMax,
  drawResource,
  regenResource,
  reserveFloor,
  resourceValue,
  trueMax,
} from '../src/core/systems/resources';

const fresh = (seed = 1) => new Game(createInitialState(seed));

/** A resistance block that stops nothing, for isolating one type at a time. */
const NO_RESIST = {
  slashing: 0, piercing: 0, bludgeoning: 0, heat: 0,
  cold: 0, poison: 0, acid: 0, arcane: 0, lightning: 0,
  earth: 0, water: 0, light: 0, dark: 0, wind: 0,
} as const;

/** Tick a bearer's conditions with plausible health numbers. */
function tick(g: Game, times = 1, inCombat = true) {
  let total = 0;
  for (let i = 0; i < times; i++) {
    const stats = getDerivedStats(g.state);
    total += tickStatuses(g.state, g.state, {
      hp: resourceValue(g.state, 'hp'),
      maxHp: availableMax(g.state, stats, 'hp'),
      inCombat,
    }).damage;
  }
  return total;
}

describe('stacking rules', () => {
  it("'highest' keeps the worst dose and ignores weaker ones", () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'poison', intensity: 2 });
    applyStatus(g.state, g.state, { id: 'poison', intensity: 1 }); // weaker — ignored
    expect(findStatus(g.state, 'poison')!.intensity).toBe(2);

    applyStatus(g.state, g.state, { id: 'poison', intensity: 3 }); // stronger — takes over
    expect(findStatus(g.state, 'poison')!.intensity).toBe(3);
  });

  it("'absorb' folds part of a new flame in without extending the clock", () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'on_fire', intensity: 2 });
    const before = findStatus(g.state, 'on_fire')!;
    const clock = before.ticksLeft;
    tick(g, 5); // let some of it burn away

    applyStatus(g.state, g.state, { id: 'on_fire', intensity: 2 });
    const after = findStatus(g.state, 'on_fire')!;
    expect(after.intensity).toBeCloseTo(3); // 2 + 50% of 2
    // Fiercer, not longer: the remaining time is untouched by the new flame.
    expect(after.ticksLeft).toBeLessThan(clock!);
  });

  it("'sum' adds up and gives way to something worse at its ceiling", () => {
    const g = fresh();
    for (let i = 0; i < 4; i++) applyStatus(g.state, g.state, { id: 'chilled', intensity: 0.25 });
    // Four quarter-chills reach 100% — which is no longer a chill.
    expect(hasStatus(g.state, 'chilled')).toBe(false);
    expect(hasStatus(g.state, 'frozen')).toBe(true);
  });

  it("'count' escalates once enough separate wounds are open", () => {
    const g = fresh();
    for (let i = 0; i < 4; i++) applyStatus(g.state, g.state, { id: 'bleeding', intensity: 1 });
    expect(findStatus(g.state, 'bleeding')!.stacks).toBe(4);

    applyStatus(g.state, g.state, { id: 'bleeding', intensity: 1 }); // the fifth
    expect(hasStatus(g.state, 'bleeding')).toBe(false);
    expect(hasStatus(g.state, 'lacerated')).toBe(true);
  });

  it('a condition can block another outright', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'frozen', intensity: 1 });
    applyStatus(g.state, g.state, { id: 'chilled', intensity: 0.5 });
    // You cannot be chilled while you are already frozen solid.
    expect(hasStatus(g.state, 'chilled')).toBe(false);
  });
});

describe('removal belongs to the source', () => {
  it('a source can make its condition permanent and name its own cure', () => {
    const g = fresh();
    applyStatus(g.state, g.state, {
      id: 'on_fire',
      intensity: 1,
      duration: 'permanent',
      removal: [{ on: 'cure', tag: 'water', effect: 'remove' }],
    });
    const held = findStatus(g.state, 'on_fire')!;
    expect(held.ticksLeft).toBeNull();

    tick(g, 500); // it will never simply burn out
    expect(hasStatus(g.state, 'on_fire')).toBe(true);

    fireStatusEvent(g.state, g.state, 'cure', { tag: 'fire' }); // wrong cure
    expect(hasStatus(g.state, 'on_fire')).toBe(true);
    fireStatusEvent(g.state, g.state, 'cure', { tag: 'water' });
    expect(hasStatus(g.state, 'on_fire')).toBe(false);
  });

  it('being tended to closes a bleed and eases a laceration back to one', () => {
    const g = fresh();
    const stats = getDerivedStats(g.state);
    g.state.resources.hp = 10; // room to actually heal

    applyStatus(g.state, g.state, { id: 'lacerated', intensity: 2 });
    heal(g.state, stats, 5, 'rest');
    // One treatment is not enough to close it — it drops back to a bleed.
    expect(hasStatus(g.state, 'lacerated')).toBe(false);
    expect(hasStatus(g.state, 'bleeding')).toBe(true);

    heal(g.state, stats, 5, 'rest');
    expect(hasStatus(g.state, 'bleeding')).toBe(false);
  });

  it('a seared burn ignores idling and yields only to real treatment', () => {
    const g = fresh();
    const stats = getDerivedStats(g.state);
    g.state.resources.hp = 10;
    applyStatus(g.state, g.state, { id: 'blaze_burn', intensity: 1 });

    heal(g.state, stats, 1, 'idle');
    expect(hasStatus(g.state, 'blaze_burn')).toBe(true);
    heal(g.state, stats, 1, 'salve');
    expect(hasStatus(g.state, 'blaze_burn')).toBe(false);
  });

  it('ice does not survive being hit', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'frozen', intensity: 1 });
    fireStatusEvent(g.state, g.state, 'damageTaken');
    expect(hasStatus(g.state, 'frozen')).toBe(false);
  });
});

describe('a parting blow on expiry', () => {
  it('pays out when the clock runs out — the blade working itself loose', () => {
    const g = fresh(40);
    applyStatus(g.state, g.state, { id: 'skewered', intensity: 1 });
    const def = STATUSES.skewered;

    // Nothing while it is still in: the mods are the cost, not the damage.
    expect(tick(g, 1)).toBe(0);
    // Run the clock out and it tears free on the way past.
    const total = tick(g, (def.duration as number) + 2);
    expect(total).toBeCloseTo(def.expireDamage!.flat!);
    expect(hasStatus(g.state, 'skewered')).toBe(false);
  });

  it('pays nothing when it is dealt with early — which is what a technique buys', () => {
    const g = fresh(41);
    applyStatus(g.state, g.state, { id: 'skewered', intensity: 1 });
    // Flesh Draw tears it out rather than waiting; no clock, no parting blow.
    stripStatuses(g.state, ['skewered']);
    expect(tick(g, 200)).toBe(0);
  });
});

describe('damage over time', () => {
  it('a bleed is priced off current health and eases off out of combat', () => {
    const g = fresh();
    g.state.resources.hp = 1000;
    applyStatus(g.state, g.state, { id: 'bleeding', intensity: 1 });

    const fighting = tick(g, 1, true);
    const resting = tick(g, 1, false);
    expect(fighting).toBeGreaterThan(0);
    expect(resting).toBeLessThan(fighting);
  });

  it('resistance blunts a condition the same way it blunts a blow', () => {
    const bare = fresh();
    const warded = fresh();
    for (const g of [bare, warded]) applyStatus(g.state, g.state, { id: 'poison', intensity: 4 });

    const plain = tickStatuses(bare.state, bare.state, { hp: 100, maxHp: 100, inCombat: true });
    const resisted = tickStatuses(warded.state, warded.state, {
      hp: 100,
      maxHp: 100,
      inCombat: true,
      resists: { ...NO_RESIST, poison: 0.5 },
    });
    expect(resisted.damage).toBeCloseTo(plain.damage * 0.5);
  });

  it('a condition can kill outside of combat', () => {
    const g = fresh(4);
    g.state.resources.hp = 3;
    applyStatus(g.state, g.state, { id: 'blazing', intensity: 5 });
    for (let i = 0; i < 40 && !g.state.recovering; i++) g.tick();
    expect(g.state.recovering).toBe(true);
  });
});

describe('a pierced dot is partly unresistable', () => {
  /*
   * Nothing in the shipped content carries `pierce` yet — Anupama's hunger is
   * the first — so these borrow poison's dot and put it back. The arithmetic is
   * what is under test, and the edges that matter (immunity, and worse than
   * immunity) are ones no real bestiary entry conveniently supplies.
   */
  function bite(share: number | undefined, res: number): number {
    const dot = STATUSES.poison.dot!;
    const original = dot.pierce;
    if (share === undefined) delete dot.pierce;
    else dot.pierce = share;
    try {
      const g = fresh();
      applyStatus(g.state, g.state, { id: 'poison', intensity: 4 });
      return tickStatuses(g.state, g.state, {
        hp: 100,
        maxHp: 100,
        inCombat: true,
        resists: { ...NO_RESIST, poison: res },
      }).damage;
    } finally {
      if (original === undefined) delete dot.pierce;
      else dot.pierce = original;
    }
  }

  it('is absent by default, and unset behaves exactly as zero', () => {
    expect(STATUSES.poison.dot!.pierce).toBeUndefined();
    expect(bite(undefined, 0.5)).toBeCloseTo(bite(0, 0.5));
  });

  it('resists only the share that was not pierced', () => {
    // Half unresistable, half meeting 50% resistance → 0.5 + 0.5 × 0.5.
    expect(bite(0.5, 0.5)).toBeCloseTo(bite(0, 0) * 0.75);
  });

  it('still lands against immunity, and against more than immunity', () => {
    const unresisted = bite(0, 0);
    expect(bite(0.5, 1)).toBeCloseTo(unresisted * 0.5);
    // The floor belongs to the resisted half ALONE. If the total were clamped
    // instead, a big enough resistance would drag the unresistable half down
    // with it and "bypasses immunities" would stop being true exactly where it
    // is supposed to matter.
    expect(bite(0.5, 5)).toBeCloseTo(unresisted * 0.5);
  });

  it('a fully pierced dot ignores resistance altogether', () => {
    expect(bite(1, 0.9)).toBeCloseTo(bite(0, 0));
  });

  it('clamps a mis-authored share instead of inverting the tick', () => {
    const unresisted = bite(0, 0);
    expect(bite(-1, 0.5)).toBeCloseTo(bite(0, 0.5));
    expect(bite(2, 0.5)).toBeCloseTo(unresisted);
  });
});

describe('Anupama: the fast', () => {
  it('hunger declares no cap, where every other stacking condition does', () => {
    const g = fresh();
    for (let i = 0; i < 30; i++) {
      applyStatus(g.state, g.state, { id: 'hunger_anupama', intensity: 0.3 });
    }
    const held = findStatus(g.state, 'hunger_anupama')!;
    // Poison would have escalated at 4 and chill at 1. This just keeps going —
    // that omission IS the rule Anupama breaks, so assert it rather than
    // leaving it to be "fixed" by someone tidying up the data file.
    expect(held.intensity).toBeCloseTo(9);
    expect(STATUSES.hunger_anupama.stacking.cap).toBeUndefined();
  });

  it('counts applications and magnitude separately', () => {
    const g = fresh();
    // Two imparters of different wisdom, hitting once each.
    applyStatus(g.state, g.state, { id: 'hunger_anupama', intensity: 0.2 });
    applyStatus(g.state, g.state, { id: 'hunger_anupama', intensity: 0.6 });
    const held = findStatus(g.state, 'hunger_anupama')!;
    // Magnitude follows whoever inflicted it; the count does not care.
    expect(held.intensity).toBeCloseTo(0.8);
    expect(held.stacks).toBe(2);
  });

  it('bites through dark immunity for exactly half', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'hunger_anupama', intensity: 4 });
    const ctx = { hp: 100, maxHp: 100, inCombat: true };
    const open = tickStatuses(g.state, g.state, {
      ...ctx,
      resists: { ...NO_RESIST, dark: 0 },
    }).damage;
    const immune = tickStatuses(g.state, g.state, {
      ...ctx,
      resists: { ...NO_RESIST, dark: 1 },
    }).damage;
    expect(open).toBeGreaterThan(0);
    expect(immune).toBeCloseTo(open * 0.5);
  });

  it("the weight lifts when the bar fills, not only when its clock runs out", () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'weight_of_hunger', intensity: 0.5 });
    expect(hasStatus(g.state, 'weight_of_hunger')).toBe(true);
    fireStatusEvent(g.state, g.state, 'barFill');
    expect(hasStatus(g.state, 'weight_of_hunger')).toBe(false);
  });

  it('a monster wears what it IS from the moment it spawns', () => {
    // `wears` has no content using it until Anupama itself lands, and the
    // mechanism is what is under test — so borrow a rat and put it back.
    const def = MONSTERS.forest_rat;
    expect(def.wears).toBeUndefined();
    def.wears = [{ id: 'fasting' }];
    try {
      const g = fresh();
      const m = spawnMonster(g.state, SPOTS.woods_edge, { monsterId: 'forest_rat', level: 1 });
      expect(hasStatus(m, 'fasting')).toBe(true);
      // And the gate reads the same on a monster as it does on the player —
      // one predicate, neither side named in it.
      expect(statusBlocks(m, 'swing')).toBe(true);
      expect(statusBlocks(m, 'spell')).toBe(false);
    } finally {
      delete def.wears;
    }
  });

  it('fasting refuses the plain blow without touching what is deliberate', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'fasting', intensity: 1 });
    expect(statusBlocks(g.state, 'swing')).toBe(true);
    // The broad gate stays shut — casting is what FEEDS the hunger, so a fast
    // that blocked spells would starve its own mechanic.
    expect(statusBlocks(g.state, 'attack')).toBe(false);
    expect(statusBlocks(g.state, 'spell')).toBe(false);
  });

  it('field hunger counts both sides, in stacks rather than magnitude', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'hunger_anupama', intensity: 0.2 });
    applyStatus(g.state, g.state, { id: 'hunger_anupama', intensity: 5 });
    // Two appetites, however hard either bites.
    expect(fieldHunger(g.state)).toBe(2);
  });

  it('a ward sheds a share of every wound', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'hunger_anupama', intensity: 4 });
    const ctx = { hp: 100, maxHp: 100, inCombat: true, resists: { ...NO_RESIST, dark: 0 } };
    const full = tickStatuses(g.state, g.state, ctx).damage;
    expect(tickStatuses(g.state, g.state, { ...ctx, ward: 0.5 }).damage).toBeCloseTo(full * 0.5);
  });

  it('a pierced tick is unresistable, but never unwardable', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'hunger_anupama', intensity: 4 });
    const ctx = { hp: 100, maxHp: 100, inCombat: true, resists: { ...NO_RESIST, dark: 1 } };
    // Immunity still eats the pierced half; the ward then takes its cut of it.
    const immune = tickStatuses(g.state, g.state, ctx).damage;
    expect(immune).toBeGreaterThan(0);
    expect(tickStatuses(g.state, g.state, { ...ctx, ward: 0.5 }).damage).toBeCloseTo(immune * 0.5);
  });

  it("the defence arm hardens the body and dulls what conditions do to it", () => {
    const bare = MAIN_GENES.bare;
    expect(bare.fasts).toBeUndefined();
    bare.fasts = {
      regenRoot: [4, 2.5],
      regenMult: 0.05,
      armorPerLogHunger: 6,
      wardPerLogHunger: 0.25,
      wardMax: 0.6,
    };
    try {
      const plain = fresh();
      applyStatus(plain.state, plain.state, { id: 'chilled', intensity: 1 });

      const fasting = fresh();
      applyStatus(fasting.state, fasting.state, { id: 'fasting', intensity: 1 });
      applyStatus(fasting.state, fasting.state, { id: 'chilled', intensity: 1 });
      for (let i = 0; i < 6; i++) {
        applyStatus(fasting.state, fasting.state, { id: 'hunger_anupama', intensity: 0.2 });
      }

      // Armour it did not have, paid for by the hunger it is standing in.
      expect(getDerivedStats(fasting.state).armor).toBeGreaterThan(
        getDerivedStats(plain.state).armor,
      );
      // And the chill's speed penalty bites less — a penalty, so it is dulled.
      expect(getDerivedStats(fasting.state).speed).toBeGreaterThan(
        getDerivedStats(plain.state).speed,
      );
    } finally {
      delete bare.fasts;
    }
  });

  it('the slow is scaled by intensity, so the ability owns the ceiling', () => {
    const light = fresh();
    const heavy = fresh();
    applyStatus(light.state, light.state, { id: 'weight_of_hunger', intensity: 0.2 });
    applyStatus(heavy.state, heavy.state, { id: 'weight_of_hunger', intensity: HUNGER_SLOW_CEILING });
    expect(getDerivedStats(heavy.state).speed).toBeLessThan(getDerivedStats(light.state).speed);
    // At the design's stated envelope the bar crawls at a third of its pace.
    expect(getDerivedStats(heavy.state).speed).toBeCloseTo(
      getDerivedStats(fresh().state).speed * (1 - HUNGER_SLOW_CEILING),
    );
  });
});

describe('a burn rations what healing may undo', () => {
  it('caps healing at a share of what it has burned, and remembers what it allowed', () => {
    const g = fresh();
    const stats = getDerivedStats(g.state);
    applyStatus(g.state, g.state, { id: 'blazing', intensity: 2 });
    const burned = tick(g, 3);
    expect(burned).toBeGreaterThan(0);

    g.state.resources.hp = 1;
    // Half of what the blaze took is all that may come back.
    expect(healAllowance(g.state)).toBeCloseTo(burned * 0.5);
    const healed = heal(g.state, stats, 999, 'rest');
    expect(healed).toBeCloseTo(burned * 0.5);
    // And it does not refill: the allowance is spent.
    expect(healAllowance(g.state)).toBeCloseTo(0);
  });
});

describe('conditions that seal off a pool', () => {
  it('a laceration cuts usable health without touching the true maximum', () => {
    const g = fresh();
    const stats = getDerivedStats(g.state);
    const full = trueMax(stats, 'hp');

    applyStatus(g.state, g.state, { id: 'lacerated', intensity: 3 });
    expect(trueMax(stats, 'hp')).toBe(full); // the stat is untouched
    expect(availableMax(g.state, stats, 'hp')).toBeCloseTo(full * (1 - 0.04 * 3));
    expect(statusCeiling(g.state, 'hp')).toBeLessThan(1);
  });

  it('rot eats what you spend, and the reserve floor does NOT shrink with it', () => {
    const g = fresh();
    const stats = getDerivedStats(g.state);
    const floorBefore = reserveFloor(stats, 'stamina');
    const fullBefore = availableMax(g.state, stats, 'stamina');

    applyStatus(g.state, g.state, { id: 'rotting', intensity: 1 });
    drawResource(g.state, stats, 'stamina', 4);

    // The pool is smaller...
    expect(availableMax(g.state, stats, 'stamina')).toBeLessThan(fullBefore);
    // ...but the floor is measured against the TRUE max, so being wounded never
    // hands back spendable stamina.
    expect(reserveFloor(stats, 'stamina')).toBeCloseTo(floorBefore);
  });

  it('what rot ate comes back slowly once it has passed', () => {
    const g = fresh();
    const stats = getDerivedStats(g.state);
    applyStatus(g.state, g.state, { id: 'rotting', intensity: 1, duration: 2 });
    drawResource(g.state, stats, 'stamina', 4);
    const debt = findStatus(g.state, 'rotting')!.data!.debt;
    expect(debt).toBeGreaterThan(0);

    tick(g, 3); // the rot itself passes
    expect(hasStatus(g.state, 'rotting')).toBe(false);
    // The debt survives it, carried by the recovery that replaced it.
    const wasted = findStatus(g.state, 'rot_recovery')!;
    expect(wasted.data!.debt).toBeCloseTo(debt);
    expect(availableMax(g.state, stats, 'stamina')).toBeLessThan(trueMax(stats, 'stamina'));

    tick(g, 5000); // and pays itself off in time
    expect(hasStatus(g.state, 'rot_recovery')).toBe(false);
    expect(availableMax(g.state, stats, 'stamina')).toBeCloseTo(trueMax(stats, 'stamina'));
  });
});

describe('conditions that dull equipment', () => {
  it('a chill takes the edge off the weapon, and says so in the breakdown', () => {
    const g = fresh();
    g.equip(1); // rusty sword
    const armed = getDerivedStats(g.state).damage;

    applyStatus(g.state, g.state, { id: 'chilled', intensity: 0.5 });
    const numb = getDerivedStats(g.state).damage;
    expect(numb).toBeLessThan(armed);

    // It dulls what the WEAPON gave, not the arm swinging it.
    expect(statusDampingFor(g.state, { kind: 'item', slot: 'weapon' })).toBeCloseTo(0.75);
    expect(statusDampingFor(g.state, { kind: 'item', slot: 'chest' })).toBe(1);
    expect(statusDampingFor(g.state, { kind: 'training' })).toBe(1);
  });
});

describe('conditions on the other side of the fight', () => {
  it('a chilled monster slows down, and a lacerated one has less to give', () => {
    const g = fresh(7);
    const m = spawnMonster(g.state, getSpot('woods_edge'));
    const before = monsterStats(m);

    applyStatus(g.state, m, { id: 'chilled', intensity: 0.5 });
    expect(monsterStats(m).speed).toBeLessThan(before.speed);
  });

  it('an affliction can finish a monster the player never lands a blow on', () => {
    const g = fresh(8);
    const m = spawnMonster(g.state, getSpot('woods_edge'));
    applyStatus(g.state, m, { id: 'on_fire', intensity: 50 });
    const burn = tickStatuses(g.state, m, {
      hp: m.hp,
      maxHp: monsterStats(m).maxHp,
      inCombat: true,
    });
    expect(burn.damage).toBeGreaterThan(0);
    expect(burn.hits[0].id).toBe('on_fire');
  });
});

describe('afflictions in a real fight', () => {
  it('fighting things that burn you leaves you burning', () => {
    const g = fresh(11);
    g.state.spot = 'malgeri_base';
    g.state.attrs.con.level = 60;
    g.state.resources.hp = 5000;
    g.equip(1);
    g.selectActivity('hunt');

    let sawStatus = false;
    for (let i = 0; i < 3000 && !sawStatus; i++) {
      g.tick();
      if (g.state.statuses.length > 0) sawStatus = true;
    }
    expect(sawStatus).toBe(true);
  });
});

describe('conditions that stop you doing things', () => {
  it('a rattled head blocks spells and sends blows wide', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'concussed', intensity: 1 });
    expect(statusBlocks(g.state, 'spell')).toBe(true);
    expect(statusBlocks(g.state, 'attack')).toBe(false);
    expect(statusMissChance(g.state)).toBeCloseTo(0.12);
    // Miss chances compound rather than adding, so they never reach certainty.
    applyStatus(g.state, g.state, { id: 'concussed', intensity: 2 });
    expect(statusMissChance(g.state)).toBeLessThan(1);
  });

  it('a daze costs one action per instance and wears off as they are spent', () => {
    const g = fresh();
    for (let i = 0; i < 3; i++) applyStatus(g.state, g.state, { id: 'dazed', intensity: 1 });
    expect(findStatus(g.state, 'dazed')!.stacks).toBe(3);
    expect(statusBlocks(g.state, 'attack')).toBe(true);
    for (let i = 0; i < 3; i++) fireStatusEvent(g.state, g.state, 'barFill');
    expect(hasStatus(g.state, 'dazed')).toBe(false);
  });

  it('being run through forces a plain stance and stops stamina coming back', () => {
    const g = fresh();
    g.setStyle('aggressive');
    expect(effectiveStyleId(g.state)).toBe('aggressive');

    applyStatus(g.state, g.state, { id: 'perforated', intensity: 1 });
    expect(effectiveStyleId(g.state)).toBe('balanced');
    // The selection itself is untouched, and returns when the wound closes.
    expect(g.state.style).toBe('aggressive');

    const stats = getDerivedStats(g.state);
    g.state.resources.stamina = 1;
    regenResource(g.state, stats, 'stamina', 5);
    expect(resourceValue(g.state, 'stamina')).toBe(1);
  });

  it('a puncture makes effort dearer and keeps widening, up to a cap', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'punctured', intensity: 1 });
    expect(statusCostMult(g.state, 'stamina')).toBeCloseTo(1.25);

    // It widens as it is held: 0.04% of the pool per tick, up to 5%.
    const stats = getDerivedStats(g.state);
    tick(g, 50);
    const partway = statusCeiling(g.state, 'stamina');
    expect(partway).toBeLessThan(1);
    expect(partway).toBeGreaterThan(0.95);

    // 125 ticks reaches the cap, and it stops there — still well inside the
    // wound's own 400-tick life, so this is the ceiling biting, not expiry.
    tick(g, 200);
    expect(hasStatus(g.state, 'punctured')).toBe(true);
    expect(statusCeiling(g.state, 'stamina')).toBeCloseTo(0.95);
    expect(availableMax(g.state, stats, 'stamina')).toBeLessThan(trueMax(stats, 'stamina'));
  });
});

describe('conditions that ride the action bar', () => {
  it('a jolt discharges when the bar completes', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'jolted', intensity: 2 });
    const owed = statusBarDamage(g.state, 'onFill');
    expect(owed).toHaveLength(1);
    expect(owed[0].amount).toBeCloseTo(2.4); // 1.2 flat, times intensity 2
    expect(owed[0].dropWeaponBelow).toBe(0.5);
    expect(statusBarDamage(g.state, 'onDeplete')).toHaveLength(0);
  });

  it('a shock runs the bar backwards and goes off when it empties', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'shocked', intensity: 1 });
    expect(statusReversesBar(g.state)).toBe(true);
    expect(statusBarDamage(g.state, 'onDeplete')[0].amount).toBeCloseTo(2.5);
    fireStatusEvent(g.state, g.state, 'barDeplete');
    expect(hasStatus(g.state, 'shocked')).toBe(false); // all at once
  });

  it('enough jolts stop being a jolt — the cap makes it certain', () => {
    const g = fresh();
    // Six doses of 1 under absorb:1 reach the cap of 6, where the roll is a
    // formality. WHICH earlier dose turned it is the roll's business.
    for (let i = 0; i < 6; i++) applyStatus(g.state, g.state, { id: 'jolted', intensity: 1 });
    expect(hasStatus(g.state, 'shocked')).toBe(true);
  });

  it('but never certain before the cap — a shock cannot be scheduled', () => {
    // Were this deterministic, every seed would turn on the same dose. It must
    // land on different ones, and never at or below `escalateFrom`.
    const turnedOn: number[] = [];
    for (let seed = 1; seed <= 40; seed++) {
      const g = new Game(createInitialState(seed));
      for (let dose = 1; dose <= 6; dose++) {
        applyStatus(g.state, g.state, { id: 'jolted', intensity: 1 });
        if (hasStatus(g.state, 'shocked')) {
          turnedOn.push(dose);
          break;
        }
      }
    }
    expect(turnedOn, 'every seed must shock by the cap').toHaveLength(40);
    expect(Math.min(...turnedOn), 'never at or below the threshold').toBeGreaterThan(2);
    expect(new Set(turnedOn).size, 'and not always the same dose').toBeGreaterThan(1);
  });

  it('the odds of a shock ride the charge, and the readout reads the same curve', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'jolted', intensity: 2 });
    const held = findStatus(g.state, 'jolted')!;
    // Sitting exactly ON the threshold is still safe.
    expect(escalationChance(g.state, held)).toBe(0);
    held.intensity = 4;
    expect(escalationChance(g.state, held)).toBeCloseTo(0.5);
    held.intensity = 6;
    expect(escalationChance(g.state, held)).toBe(1);
  });

  it('a blow earths part of the charge instead of all of it', () => {
    // The bug this fixed: `remove` made every per-hit lightning rider
    // self-cancelling, so `shocked` was unreachable by oil, enchant or rune.
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'jolted', intensity: 4 });
    fireStatusEvent(g.state, g.state, 'damageTaken', { damageType: 'slashing', amount: 5 });
    expect(hasStatus(g.state, 'jolted')).toBe(true);
    expect(findStatus(g.state, 'jolted')!.intensity).toBeCloseTo(2);
  });
});

describe('the action bar is not the player\'s alone', () => {
  /** Get into a real fight and hand back the front enemy. */
  function fighting(seed = 7) {
    const g = new Game(createInitialState(seed));
    g.state.spot = 'woods_edge';
    g.equip(1);
    g.selectActivity('hunt');
    for (let i = 0; i < 600 && !g.state.combat; i++) g.tick();
    const e = g.state.combat!.enemies[0]!;
    return { g, e };
  }

  it('what rides the bar is owed by a monster too', () => {
    // The data half: `statusBarDamage` never cared who was bearing it. Only
    // tickCombat's enemy loop did, which is what made all of this decorative.
    const { e } = fighting();
    applyStatus(createInitialState(1), e, { id: 'jolted', intensity: 2 });
    expect(statusBarDamage(e, 'onFill')[0].amount).toBeCloseTo(2.4);
  });

  it('a shocked enemy runs its bar backwards instead of filling it', () => {
    const { g, e } = fighting();
    e.bar = 30;
    applyStatus(g.state, e, { id: 'shocked', intensity: 1 });
    const before = e.bar;
    g.tick();
    expect(e.bar).toBeLessThan(before);
  });

  it('and a shock finally has a way OFF an enemy short of the fight ending', () => {
    // `barDeplete` is one of shocked's only two exits, and it never fired on a
    // monster — so a shocked enemy simply accumulated until combatEnd.
    const { g, e } = fighting();
    applyStatus(g.state, e, { id: 'shocked', intensity: 1 });
    e.bar = 0.01;
    for (let i = 0; i < 10 && g.state.combat && hasStatus(e, 'shocked'); i++) g.tick();
    expect(g.state.combat, 'the fight must still be live, or combatEnd did it').toBeTruthy();
    expect(hasStatus(e, 'shocked')).toBe(false);
  });
});

describe('conditions that strike back', () => {
  it('stone bites when you swing and when you are struck', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'shardbound', intensity: 2 });
    expect(statusRetaliation(g.state, 'onAttack')[0].amount).toBeCloseTo(1.6);
    expect(statusRetaliation(g.state, 'onContact')[0].amount).toBeCloseTo(1.6);
  });

  it('a bloom cuts less itself but opens a fresh wound each time', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'shardbloom', intensity: 1 });
    const back = statusRetaliation(g.state, 'onAttack')[0];
    expect(back.amount).toBeCloseTo(0.4); // less than shardbound's own bite
    expect(back.inflicts?.[0].id).toBe('shard_bleed');

    // And that bleed is a dead end: it never becomes a laceration.
    for (let i = 0; i < 10; i++) applyStatus(g.state, g.state, { id: 'shard_bleed', intensity: 2 });
    expect(hasStatus(g.state, 'shard_bleed')).toBe(true);
    expect(hasStatus(g.state, 'lacerated')).toBe(false);
  });
});

describe('a bleed sums its volume but not its depth', () => {
  it('stacks add flat damage while the proportional part tracks the deepest cut', () => {
    const g = fresh();
    const ctx = { hp: 1000, maxHp: 1000, inCombat: true };

    applyStatus(g.state, g.state, { id: 'bleeding', intensity: 1 });
    const one = tickStatuses(g.state, g.state, ctx).damage;

    // A second, shallower cut: more blood lost, but no deeper a wound.
    applyStatus(g.state, g.state, { id: 'bleeding', intensity: 1 });
    const two = tickStatuses(g.state, g.state, ctx).damage;
    const held = findStatus(g.state, 'bleeding')!;
    expect(held.intensity).toBe(2); // volume adds
    expect(held.peak).toBe(1); // depth does not

    // Only the flat part doubled; the share-of-current-HP part held still.
    expect(two).toBeCloseTo(one + 0.08);

    // A genuinely deeper cut does raise it.
    applyStatus(g.state, g.state, { id: 'bleeding', intensity: 3 });
    expect(findStatus(g.state, 'bleeding')!.peak).toBe(3);
  });
});

describe('monster resistances go through the same pipeline', () => {
  it('species innate is the base, and conditions modify it like the player', () => {
    const g = fresh(21);
    const golem = spawnMonster(g.state, getSpot('malgeri_peak'));
    golem.defId = 'stone_golem';
    expect(resistanceOf(golem, 'slashing')).toBeCloseTo(monsterResistance('stone_golem', 'slashing'));

    // Frozen makes anything brittle, via the same modifier that works on you.
    applyStatus(g.state, golem, { id: 'frozen', intensity: 1 });
    expect(resistanceOf(golem, 'bludgeoning')).toBeCloseTo(
      monsterResistance('stone_golem', 'bludgeoning') - 0.5,
    );
    // And a blow landing on it feels the difference.
    expect(monsterSlice(golem, 'bludgeoning', 'Club', 100).dealt).toBeGreaterThan(100);
  });
});

describe('a drenching decides your resistances rather than nudging them', () => {
  it('wet trades fire for everything fire is not', () => {
    const g = fresh();
    const dry = getDerivedStats(g.state);
    applyStatus(g.state, g.state, { id: 'wet', intensity: 1 });
    const damp = getDerivedStats(g.state);
    expect(damp.resHeat).toBeGreaterThan(dry.resHeat);
    expect(damp.resCold).toBeLessThan(dry.resCold);
    expect(damp.resLightning).toBeLessThan(dry.resLightning);
  });

  it('fire drives a drenching off one layer at a time, and nothing else does', () => {
    const g = fresh();
    for (let i = 0; i < 3; i++) applyStatus(g.state, g.state, { id: 'wet', intensity: 1 });
    expect(findStatus(g.state, 'wet')!.stacks).toBe(3);

    fireStatusEvent(g.state, g.state, 'damageTaken', { damageType: 'slashing' });
    expect(findStatus(g.state, 'wet')!.stacks).toBe(3); // a sword does nothing

    fireStatusEvent(g.state, g.state, 'damageTaken', { damageType: 'heat' });
    expect(findStatus(g.state, 'wet')!.stacks).toBe(2);
  });

  it('five layers is a soaking, which DICTATES the numbers', () => {
    const g = fresh();
    for (let i = 0; i < 5; i++) applyStatus(g.state, g.state, { id: 'wet', intensity: 1 });
    expect(hasStatus(g.state, 'wet')).toBe(false);
    expect(hasStatus(g.state, 'soaked')).toBe(true);

    const stats = getDerivedStats(g.state);
    expect(stats.resHeat).toBeCloseTo(0.75); // its 80% meets the resistance cap
    expect(stats.resCold).toBeCloseTo(-0.5);
    expect(stats.resLightning).toBeCloseTo(-0.5);
    expect(stats.resPoison).toBeCloseTo(-0.5);
  });

  it('a soaking sours venom, deepens cold, and shortens the road to a shock', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'poison', intensity: 3 });
    applyStatus(g.state, g.state, { id: 'soaked', intensity: 1 });
    // Venom in water does not stay venom.
    expect(hasStatus(g.state, 'poison')).toBe(false);
    expect(findStatus(g.state, 'rotting')!.intensity).toBeCloseTo(2); // 3 x 2/3

    // Cold carries three times as far.
    applyStatus(g.state, g.state, { id: 'chilled', intensity: 0.1 });
    expect(findStatus(g.state, 'chilled')!.intensity).toBeCloseTo(0.3);

    // And a charge reaches a shock in three jolts instead of six.
    for (let i = 0; i < 3; i++) applyStatus(g.state, g.state, { id: 'jolted', intensity: 1 });
    expect(hasStatus(g.state, 'shocked')).toBe(true);
  });

  it('a soaking takes three of what it conducts to drive off', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'soaked', intensity: 1 });
    for (let i = 0; i < 2; i++) {
      fireStatusEvent(g.state, g.state, 'damageTaken', { damageType: 'heat' });
    }
    expect(hasStatus(g.state, 'soaked')).toBe(true); // two is not enough
    fireStatusEvent(g.state, g.state, 'damageTaken', { damageType: 'heat' });
    expect(hasStatus(g.state, 'soaked')).toBe(false);
  });
});

describe('glare', () => {
  it('a second flash lasts longer rather than blinding harder', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'dazzled', intensity: 1 });
    const first = findStatus(g.state, 'dazzled')!;
    const clock = first.ticksLeft!;
    const bite = first.intensity;

    applyStatus(g.state, g.state, { id: 'dazzled', intensity: 1 });
    const after = findStatus(g.state, 'dazzled')!;
    expect(after.intensity).toBe(bite); // no worse
    expect(after.ticksLeft).toBeGreaterThan(clock); // just longer
    expect(after.stacks).toBe(2);
  });

  it('four flashes blind you, and blindness makes you roll twice for the worse', () => {
    const g = fresh();
    for (let i = 0; i < 4; i++) applyStatus(g.state, g.state, { id: 'dazzled', intensity: 1 });
    expect(hasStatus(g.state, 'dazzled')).toBe(false);
    expect(hasStatus(g.state, 'blinded')).toBe(true);
    expect(statusDisadvantage(g.state)).toBe(true);
    expect(getDerivedStats(g.state).dodge).toBeLessThan(getDerivedStats(fresh().state).dodge);
  });
});

describe('taint', () => {
  it('lowers everything, and light and dark twice over', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'tainted', intensity: 1 });
    const stats = getDerivedStats(g.state);
    expect(stats.resSlashing).toBeCloseTo(-0.05);
    expect(stats.resLight).toBeCloseTo(-0.1);
    expect(stats.resDark).toBeCloseTo(-0.1);
  });

  it('can only drag you so far, and each stack digs that floor deeper', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'tainted', intensity: 1 });
    const held = findStatus(g.state, 'tainted')!;

    // Set the bite past anything the floor will allow. (Applying this much
    // through the front door would escalate it instead — the cap is 5.)
    held.intensity = 20;
    expect(getDerivedStats(g.state).resSlashing).toBeCloseTo(-0.25);

    // A second stack lets it reach 5% further, without the penalty changing.
    held.stacks = 2;
    expect(getDerivedStats(g.state).resSlashing).toBeCloseTo(-0.3);
  });

  it('loosens its grip as its clock runs down', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'tainted', intensity: 2 });
    const held = findStatus(g.state, 'tainted')!;
    const atFull = getDerivedStats(g.state).resSlashing;

    held.ticksLeft = Math.floor(held.ticksLeft! * 0.25); // three quarters gone
    const nearlyDone = getDerivedStats(g.state).resSlashing;
    expect(nearlyDone).toBeGreaterThan(atFull); // less negative: it is fading
  });
});

describe('corruption', () => {
  it('closes off spirit, and takes a share of everything else with it', () => {
    const g = fresh();
    const stats = getDerivedStats(g.state);
    const wholeSpirit = availableMax(g.state, stats, 'spirit');
    const wholeHp = availableMax(g.state, stats, 'hp');

    applyStatus(g.state, g.state, { id: 'corrupted', intensity: 4 });
    // Spirit is a standing reserve, so what corruption takes it takes off the
    // ceiling — and the true max is untouched underneath.
    expect(statusCeiling(g.state, 'spirit')).toBeCloseTo(0.6);
    expect(availableMax(g.state, stats, 'spirit')).toBeLessThan(wholeSpirit);
    expect(availableMax(g.state, stats, 'hp')).toBeLessThan(wholeHp);
    expect(trueMax(stats, 'hp')).toBe(wholeHp);
  });

  it('emptying your spirit takes you down and keeps half its hold', () => {
    const g = fresh(31);
    // Ten points of corruption seals spirit away entirely.
    applyStatus(g.state, g.state, { id: 'corrupted', intensity: 7 });
    findStatus(g.state, 'corrupted')!.intensity = 10;

    for (let i = 0; i < 5 && !g.state.recovering; i++) g.tick();
    expect(g.state.recovering).toBe(true);
    // Half, rounded up, and it does not tick away on its own.
    const held = findStatus(g.state, 'corrupted')!;
    expect(held.intensity).toBe(5); // half of 10, rounded up
    expect(held.ticksLeft).toBeNull();
  });
});

describe('manaburn', () => {
  it('drives mana into debt and detonates for the overdraft', () => {
    const g = fresh(41);
    g.state.attrs.int.level = 60; // a pool worth burning
    const stats = getDerivedStats(g.state);
    const pool = trueMax(stats, 'mana');
    g.state.resources.mana = pool;

    // More burn than the pool and its debt limit can absorb.
    applyStatus(g.state, g.state, { id: 'manaburn', intensity: pool * 4 });

    let detonated = false;
    for (let i = 0; i < 4000 && !detonated; i++) {
      g.tick();
      if (!hasStatus(g.state, 'manaburn')) detonated = true;
      // While it burns, mana may sit below zero — that is the whole threat.
      expect(resourceValue(g.state, 'mana')).toBeGreaterThanOrEqual(-pool - 1);
    }
    expect(detonated).toBe(true);
  });

  it('a burn smaller than the pool gutters out instead of going off', () => {
    const g = fresh(42);
    g.state.attrs.int.level = 60;
    const stats = getDerivedStats(g.state);
    g.state.resources.mana = trueMax(stats, 'mana');

    applyStatus(g.state, g.state, { id: 'manaburn', intensity: 2 });
    for (let i = 0; i < 500 && hasStatus(g.state, 'manaburn'); i++) g.tick();
    expect(hasStatus(g.state, 'manaburn')).toBe(false);
    // It never got near the debt limit, so nothing detonated.
    expect(resourceValue(g.state, 'mana')).toBeGreaterThan(0);
  });

  it('each stack buys another quarter-pool of headroom', () => {
    const g = fresh();
    const one = { ...g.state, statuses: [{ id: 'manaburn', intensity: 10, peak: 10, stacks: 1, ticksLeft: null }] };
    const three = { ...g.state, statuses: [{ id: 'manaburn', intensity: 10, peak: 10, stacks: 3, ticksLeft: null }] };
    expect(statusNegativeHeadroom(one as never, 'mana', 100)).toBeCloseTo(100);
    expect(statusNegativeHeadroom(three as never, 'mana', 100)).toBeCloseTo(150);
  });
});

describe('flat-footed', () => {
  /**
   * The whole point is WHICH defences it takes: what you are wearing, not what
   * you are. A version that dulled everything would be a different condition
   * with the same name, and nothing in the numbers would say so.
   */
  function guarded(seed: number): Game {
    const g = new Game(createInitialState(seed));
    // One worn dodge bonus and one innate one, same size, same stat.
    TITLES['ff_probe'] = {
      id: 'ff_probe', name: 'Probe', icon: '🔬', desc: '', unlock: [],
      equipped: [{ stat: 'dodge', op: 'add', value: 0.1 }],
    } as never;
    g.state.titles = ['ff_probe'];
    g.state.title = 'ff_probe';
    return g;
  }

  it('leaves innate defences alone', () => {
    const g = guarded(1);
    const before = getDerivedStats(g.state).dodge;
    applyStatus(g.state, g.state, { id: 'flat_footed', intensity: 1 });
    // A title is who you are — untouched.
    expect(getDerivedStats(g.state).dodge).toBeCloseTo(before, 10);
  });

  it('strips a worn defence, and only on the stats it names', () => {
    const g = new Game(createInitialState(2));
    const mods = [
      { stat: 'dodge', op: 'add', value: 0.2 },
      { stat: 'damage', op: 'add', value: 5 },
    ];
    ITEMS['ff_cloak'] = {
      id: 'ff_cloak', name: 'Probe Cloak', icon: '🧥', slot: 'back',
      tags: [], mods, value: 0,
    } as never;
    g.state.equipment.back = { uid: 999, defId: 'ff_cloak', slots: 0, runes: [] };

    const before = getDerivedStats(g.state);
    applyStatus(g.state, g.state, { id: 'flat_footed', intensity: 1 });
    const after = getDerivedStats(g.state);

    expect(after.dodge).toBeLessThan(before.dodge); // the worn dodge is gone
    expect(after.damage).toBeCloseTo(before.damage, 10); // the sword arm is not
  });

  it('an undampened bonus keeps working — the uncanny-dodge hatch', () => {
    const g = new Game(createInitialState(3));
    ITEMS['ff_charm'] = {
      id: 'ff_charm', name: 'Probe Charm', icon: '🍀', slot: 'accessory',
      tags: [], mods: [{ stat: 'dodge', op: 'add', value: 0.2, undampened: true }], value: 0,
    } as never;
    g.state.equipment.accessory = { uid: 998, defId: 'ff_charm', slots: 0, runes: [] };

    const before = getDerivedStats(g.state).dodge;
    applyStatus(g.state, g.state, { id: 'flat_footed', intensity: 1 });
    expect(getDerivedStats(g.state).dodge).toBeCloseTo(before, 10);
  });
});

describe('the end of a fight lets go of what only a fight could shed', () => {
  /** A fresh character swinging at whatever lives at `spot`. */
  function fighting(seed: number, spot: string) {
    const g = fresh(seed);
    g.state.spot = spot;
    g.equip(1);
    g.selectActivity('hunt');
    for (let i = 0; i < 3000 && !g.state.combat; i++) g.tick();
    expect(g.state.combat).not.toBeNull();
    return g;
  }

  it('being knocked out sheds conditions the action bar was the only cure for', () => {
    const g = fighting(13, 'ravine_floor');

    // Both of these are timerless: a daze is worn off one swing at a time, a
    // shock only when the bar it is running backwards finally empties. Neither
    // clock turns outside a fight.
    for (let i = 0; i < 8; i++) applyStatus(g.state, g.state, { id: 'dazed', intensity: 1 });
    applyStatus(g.state, g.state, { id: 'shocked', intensity: 1 });
    g.state.combat!.playerBar = 1000; // a long way to reverse — it will not empty first
    g.state.resources.hp = 1; // the next thing that lands finishes it

    for (let i = 0; i < 500 && g.state.combat; i++) g.tick();
    expect(g.state.lastFight?.outcome).toBe('knocked_out');
    expect(hasStatus(g.state, 'dazed')).toBe(false);
    expect(hasStatus(g.state, 'shocked')).toBe(false);
  });

  it('winning does the same — a daze you never worked off does not follow you out', () => {
    const g = fighting(21, 'woods_edge');
    const enemy = g.state.combat!.enemies.find((e) => e)!;

    // Dazed blocks your swings, so the poison is what actually wins this one:
    // the fight ends with the daze still owed.
    for (let i = 0; i < 8; i++) applyStatus(g.state, g.state, { id: 'dazed', intensity: 1 });
    applyStatus(g.state, enemy, { id: 'poison', intensity: 40 });

    for (let i = 0; i < 500 && g.state.combat; i++) g.tick();
    expect(g.state.lastFight?.outcome).toBe('won');
    expect(hasStatus(g.state, 'dazed')).toBe(false);
  });
});

describe('a knockout is a floor, not a step you can fall through twice', () => {
  /**
   * Knocked out with something corrosive still running, and left alone to
   * come round — the activity is dropped so a resumed hunt cannot start a
   * second fight and muddy what is being measured.
   */
  function downedWithRot(seed = 3) {
    const g = fresh(seed);
    g.state.spot = 'ravine_floor';
    g.equip(1);
    g.selectActivity('hunt');
    for (let i = 0; i < 3000 && !g.state.recovering; i++) g.tick();
    expect(g.state.recovering).toBe(true);
    g.state.activity = null;
    // Deep enough to matter: rot deals 0.12 per point per tick, so this is the
    // ~24 a stacked-up boss leaves on you. A light dose is simply outpaced by
    // the recovery trickle and never reaches the floor at all.
    applyStatus(g.state, g.state, { id: 'rotting', intensity: 200 });
    return g;
  }

  it('a rot that outlives the fight cannot knock you out while you are down', () => {
    const g = downedWithRot();
    // Being finished after you have got back up is the game working: you stood
    // too early and it caught you. Being finished while STILL on the floor is
    // the bug, and it used to happen every single tick.
    let whileDown = 0;
    let down = false;
    g.bus.on('log', (e) => {
      if (down && (e as { msg: string }).msg.includes('finishes you')) whileDown += 1;
    });

    let peak = 0;
    for (let i = 0; i < 300; i++) {
      down = g.state.recovering;
      g.tick();
      peak = Math.max(peak, g.state.resources.hp);
    }
    expect(whileDown).toBe(0);
    // The knockout used to `return` before the recovery regen, pinning health
    // at exactly the 1 it was set to for as long as anything was eating it.
    expect(peak).toBeGreaterThan(1);
  });

  it('it does not overwrite the summary of the fight that actually felled you', () => {
    const g = downedWithRot();
    const real = g.state.lastFight;
    expect(real).toBeTruthy();
    expect(real!.foes.length).toBeGreaterThan(0); // the thing that beat you

    // The rot bills itself to a fresh out-of-combat tally (ensureLedger), which
    // must never be promoted over the encounter that put you on the floor.
    for (let i = 0; i < 300 && g.state.recovering; i++) g.tick();
    expect(g.state.lastFight).toBe(real);
    expect(g.state.lastFight!.foes.length).toBeGreaterThan(0);
  });

  it('you still come round once the rot has run its course', () => {
    const g = downedWithRot();
    // Long enough for the 45-second rot to run out and for the health it kept
    // eating to climb back afterwards. Being held on the floor must not be a
    // dead end — that is the difference between a hard fight and a soft-lock.
    for (let i = 0; i < 1500; i++) g.tick();
    expect(hasStatus(g.state, 'rotting')).toBe(false);
    expect(g.state.recovering).toBe(false);
    expect(g.state.resources.hp).toBeGreaterThan(1);
  });
});

describe('being out cold is time passing', () => {
  it('clocks run at the rate the caller asks for', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'rotting', intensity: 1 });
    const full = findStatus(g.state, 'rotting')!.ticksLeft!;

    const ctx = { hp: 100, maxHp: 100, inCombat: false };
    tickStatuses(g.state, g.state, ctx);
    expect(findStatus(g.state, 'rotting')!.ticksLeft).toBe(full - 1);

    tickStatuses(g.state, g.state, { ...ctx, clockRate: 5 });
    expect(findStatus(g.state, 'rotting')!.ticksLeft).toBe(full - 6);
  });

  it('a rot does not pick up where it left off once you are back on your feet', () => {
    const g = fresh(3);
    g.state.spot = 'ravine_floor';
    g.equip(1);
    g.selectActivity('hunt');
    for (let i = 0; i < 3000 && !g.state.recovering; i++) g.tick();
    expect(g.state.recovering).toBe(true);
    g.state.activity = null; // left alone to come round
    // Light enough that the recovery trickle outruns it — this is the band that
    // used to have you stand up at 60% with most of the fever still to come,
    // and go straight back down.
    applyStatus(g.state, g.state, { id: 'rotting', intensity: 5 });

    let rose = -1;
    let knockdowns = 0;
    let wasDown = true;
    for (let t = 1; t <= 1200; t++) {
      g.tick();
      if (rose < 0 && !g.state.recovering) rose = t;
      if (g.state.recovering && !wasDown) knockdowns += 1;
      wasDown = g.state.recovering;
    }
    expect(rose).toBeGreaterThan(0);
    expect(knockdowns).toBe(0); // it does not get a second go at you
    expect(hasStatus(g.state, 'rotting')).toBe(false);
  });

  it('and the floor is not a long stay — a heavy rot burns out in a fraction of its clock', () => {
    const g = fresh(3);
    g.state.spot = 'ravine_floor';
    g.equip(1);
    g.selectActivity('hunt');
    for (let i = 0; i < 3000 && !g.state.recovering; i++) g.tick();
    g.state.activity = null;
    applyStatus(g.state, g.state, { id: 'rotting', intensity: 200 });
    const clock = findStatus(g.state, 'rotting')!.ticksLeft!; // 45s = 450 ticks

    let down = 0;
    for (let t = 1; t <= 1200 && g.state.recovering; t++, down++) g.tick();
    expect(g.state.recovering).toBe(false);
    // At 1x this was the whole 450 plus the healing after it. The point of the
    // rate is that lying there is bounded by a fraction of the affliction.
    expect(down).toBeLessThan(clock / 2);
  });
});

// ---------- Wind: displacement ----------

describe('displacement — the wind takes your footing', () => {
  it('unfooted steals every exit; buffeted only sometimes', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'unfooted', intensity: 1 });
    for (let i = 0; i < 20; i++) {
      expect(statusDisplacedExit(g.state, g.state)).toBe('off_balance');
    }
    removeStatus(g.state, 'unfooted');

    // One point of buffeting is a 12% chance, so most exits survive it.
    applyStatus(g.state, g.state, { id: 'buffeted', intensity: 1 });
    let taken = 0;
    for (let i = 0; i < 200; i++) if (statusDisplacedExit(g.state, g.state)) taken += 1;
    expect(taken).toBeGreaterThan(0);
    expect(taken).toBeLessThan(100);
  });

  it('says nothing when the air is still — the technique keeps its own exit', () => {
    const g = fresh();
    expect(statusDisplacedExit(g.state, g.state)).toBeUndefined();
  });

  it('only ever displaces toward a dead end — the prime directive guardrail', () => {
    // Anything that could push a fighter into a position other techniques ENTER
    // from would be content spelling A-then-B through a status. Nothing entered
    // from off-balance when this was written, and that is the whole reason it
    // is the legal destination.
    for (const def of Object.values(STATUSES)) {
      if (!def.displaces) continue;
      expect(def.displaces.to).toBe('off_balance');
    }
  });

  it('buffeting escalates into being unfooted', () => {
    const g = fresh();
    // As everywhere else: the cap is checked when a SECOND dose lands, so the
    // first application never escalates however heavy it is.
    applyStatus(g.state, g.state, { id: 'buffeted', intensity: 4 });
    expect(hasStatus(g.state, 'unfooted')).toBe(false);
    applyStatus(g.state, g.state, { id: 'buffeted', intensity: 1 });
    expect(hasStatus(g.state, 'unfooted')).toBe(true);
    expect(hasStatus(g.state, 'buffeted')).toBe(false);
  });
});

// ---------- Wood: the seed ----------

describe('the seed — a condition that grows while it is ignored', () => {
  it('thickens on its own in a fight, and does not out of one', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'seeded', intensity: 1 });
    const start = findStatus(g.state, 'seeded')!.intensity;
    tick(g, 10, false);
    expect(findStatus(g.state, 'seeded')!.intensity).toBeCloseTo(start, 5);
    tick(g, 10, true);
    expect(findStatus(g.state, 'seeded')!.intensity).toBeGreaterThan(start);
  });

  it('matures into a root network if nobody sees to it', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'seeded', intensity: 1 });
    tick(g, 400);
    expect(hasStatus(g.state, 'rootbound')).toBe(true);
  });

  it('is pruned by a blow, and cut twice as hard by metal', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'seeded', intensity: 4 });
    tendOnDamage(g.state, 'bludgeoning');
    expect(findStatus(g.state, 'seeded')!.intensity).toBeCloseTo(3.5, 5);
    tendOnDamage(g.state, 'piercing');
    expect(findStatus(g.state, 'seeded')!.intensity).toBeCloseTo(2.5, 5);
  });

  it('is FED by water rather than pruned — the generative arrow, in combat', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'seeded', intensity: 2 });
    tendOnDamage(g.state, 'water');
    expect(findStatus(g.state, 'seeded')!.intensity).toBeCloseTo(3, 5);
  });

  it('records what else lands in the body, and carries the ledger when it matures', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'seeded', intensity: 1 });
    applyStatus(g.state, g.state, { id: 'chilled', intensity: 2 });
    applyStatus(g.state, g.state, { id: 'jolted', intensity: 1 });
    expect(graftLedger(findStatus(g.state, 'seeded')!)).toEqual(
      expect.arrayContaining([
        { id: 'chilled', intensity: 2 },
        { id: 'jolted', intensity: 1 },
      ]),
    );

    tick(g, 400);
    const grown = findStatus(g.state, 'rootbound');
    expect(grown).toBeTruthy();
    // Maturing must not throw away what being patient bought.
    expect(graftLedger(grown!)).toEqual(
      expect.arrayContaining([{ id: 'chilled', intensity: 2 }]),
    );
  });

  it('never records its own family', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'seeded', intensity: 1 });
    applyStatus(g.state, g.state, { id: 'seeded', intensity: 1 });
    expect(graftLedger(findStatus(g.state, 'seeded')!)).toEqual([]);
  });

  it('pays out when fire takes it — wood feeding fire, at the combat layer', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'seeded', intensity: 1 });
    applyStatus(g.state, g.state, { id: 'chilled', intensity: 3 });
    const [payout] = graftHarvest(g.state, 'heat');
    expect(payout.type).toBe('heat');
    expect(payout.amount).toBeCloseTo(12, 5); // 3 recorded × 4 per point

    // Nothing else harvests it — only the element it feeds.
    expect(graftHarvest(g.state, 'cold')).toEqual([]);
  });

  it('an empty ledger pays nothing', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'seeded', intensity: 3 });
    expect(graftHarvest(g.state, 'heat')).toEqual([]);
  });

  it('only the matured form spreads, and only on its own schedule', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'seeded', intensity: 1 });
    applyStatus(g.state, g.state, { id: 'chilled', intensity: 4 });
    // A seed records but does not propagate — that is what maturing buys.
    expect(dueGraftSpread(g.state, g.state)).toBeNull();

    removeStatus(g.state, 'seeded');
    const root = applyStatus(g.state, g.state, { id: 'rootbound', intensity: 1 })!;
    root.data = { 'graft:chilled': 4 };

    const first = dueGraftSpread(g.state, g.state);
    expect(first).toEqual([{ id: 'chilled', intensity: 1 }]); // a quarter of it
    expect(dueGraftSpread(g.state, g.state)).toBeNull(); // not due again yet
  });
});

describe('removal that answers to how HARD, not how often', () => {
  /** A bearer holding one condition with a magnitude-gated removal rule. */
  function bearing(afterDamage: number) {
    const g = new Game(createInitialState(11));
    applyStatus(g.state, g.state, {
      id: 'chilled',
      intensity: 4,
      removal: [{ on: 'damageTaken', damageTypes: ['heat'], afterDamage, effect: 'remove' }],
    });
    return g;
  }

  it('holds until enough has landed, then gives way', () => {
    // Three sparks and one thunderbolt are three events either way — which is
    // exactly why `after` is the wrong measure for anything that should answer
    // to force. Small blows accumulate and do not trip it early.
    const g = bearing(50);
    for (let i = 0; i < 4; i++) {
      fireStatusEvent(g.state, g.state, 'damageTaken', { damageType: 'heat', amount: 10 });
    }
    expect(hasStatus(g.state, 'chilled')).toBe(true);
    fireStatusEvent(g.state, g.state, 'damageTaken', { damageType: 'heat', amount: 10 });
    expect(hasStatus(g.state, 'chilled')).toBe(false);
  });

  it('takes one hard blow as readily as many soft ones', () => {
    const g = bearing(50);
    fireStatusEvent(g.state, g.state, 'damageTaken', { damageType: 'heat', amount: 500 });
    expect(hasStatus(g.state, 'chilled')).toBe(false);
  });

  it('still respects the type gate while accumulating', () => {
    const g = bearing(50);
    fireStatusEvent(g.state, g.state, 'damageTaken', { damageType: 'cold', amount: 999 });
    expect(hasStatus(g.state, 'chilled')).toBe(true);
  });
});

describe('a monster hears the type it was actually hit with', () => {
  it('never reports a slice key as a damage type', () => {
    // `addSlice` keys its map by `type|source`, so reading the KEYS as damage
    // types announced "cold|Frost Bolt" and every `damageTypes` rule silently
    // failed to match — the exact failure enemyTookDamage exists to end. The
    // guard is that every type a monster is told about is a real one.
    const g = new Game(createInitialState(12));
    g.state.spot = 'woods_edge';
    g.selectActivity('hunt');
    const seen = new Set<string>();
    for (let i = 0; i < 1200; i++) {
      g.tick();
      for (const e of g.state.combat?.enemies ?? []) {
        for (const s of e?.statuses ?? []) {
          for (const key of Object.keys(s.data ?? {})) seen.add(key);
        }
      }
    }
    // Whatever accumulated, no key may carry a composite slice id.
    for (const key of seen) expect(key).not.toContain('|');
    // And the resistance table only knows real types, so a bogus one would
    // have to come from somewhere: assert the source directly.
    expect(RES_STAT_BY_TYPE['cold|Frost Bolt' as never]).toBeUndefined();
  });
});

describe('conditions are resisted on APPLICATION, not only on their damage', () => {
  // The gap this closes: `applyStatus` never consulted a resistance, so an
  // ice-immune body took `chilled` at full strength and merely shrugged off the
  // ticks afterwards. `StatusDef.element` — the type that most commonly inflicts
  // a condition — is what answers for the dose now.

  it('an ice slime does not freeze from the chill that freezes anything else', () => {
    // `chilled` sums to a cap of 1 and escalates there. Two doses of 0.6 freeze
    // an ordinary body; the slime's cold 0.5 halves each of them, so the same
    // two land at 0.6 total and half a chill is still only a chill.
    // (The cap is only consulted on a SECOND application — the first creates
    // the instance and returns — so one enormous dose never escalates anything.)
    const chill = (defId: string) => {
      const g = fresh(31);
      const m = spawnMonster(g.state, getSpot('woods_edge'));
      m.defId = defId;
      applyStatus(g.state, m, { id: 'chilled', intensity: 0.6 });
      applyStatus(g.state, m, { id: 'chilled', intensity: 0.6 });
      return m;
    };
    expect(hasStatus(chill('goblin'), 'frozen')).toBe(true);

    const ice = chill('slime_ice_basic');
    expect(hasStatus(ice, 'frozen')).toBe(false);
    expect(findStatus(ice, 'chilled')!.intensity).toBeCloseTo(0.6);
  });

  it('vulnerability deepens the dose by the same arithmetic', () => {
    // A fire slime is cold -0.5, so a chill lands half again as hard. The same
    // line does both jobs; nothing special-cases the negative side.
    const g = fresh(32);
    const fire = spawnMonster(g.state, getSpot('woods_edge'));
    fire.defId = 'slime_fire';
    applyStatus(g.state, fire, { id: 'chilled', intensity: 0.4 });
    expect(findStatus(fire, 'chilled')!.intensity).toBeCloseTo(0.6);

    // Against a body with nothing to say about cold, the same dose is the dose.
    const goblin = spawnMonster(g.state, getSpot('woods_edge'));
    goblin.defId = 'goblin';
    applyStatus(g.state, goblin, { id: 'chilled', intensity: 0.4 });
    expect(findStatus(goblin, 'chilled')!.intensity).toBeCloseTo(0.4);
  });

  it('resistance buys the consequences, never the immunity', () => {
    // The floor is the whole reason this is tunable rather than binary: at 0.9
    // resistance a straight (1 - res) would need fifty doses to escalate a
    // bleed that costs five, which is immunity wearing a number.
    const g = fresh(33);
    const stone = spawnMonster(g.state, getSpot('malgeri_peak'));
    stone.defId = 'slime_golem';
    applyStatus(g.state, stone, { id: 'bleeding', intensity: 1 }, 'a very sharp thing');
    const held = findStatus(stone, 'bleeding')!;
    expect(held.intensity).toBeCloseTo(APPLICATION_FLOOR);
    expect(held.intensity).toBeGreaterThan(0);
  });

  it('a condition with no element is never resisted — that is every buff', () => {
    // 37 of 67 conditions carry an `element` and all 37 are afflictions. The
    // absence on the other 30 is the authoring, not an omission: you do not
    // resist your own steadying hand.
    const g = fresh(34);
    expect(STATUSES.steady_hand?.element).toBeUndefined();
    applyStatus(g.state, g.state, { id: 'steady_hand', intensity: 1 }, 'test', {
      ...NO_RESIST,
      resSlashing: 0.9,
      resCold: 0.9,
    });
    expect(findStatus(g.state, 'steady_hand')!.intensity).toBeCloseTo(1);
  });

  it("the player's block is honoured, and only ever for the player", () => {
    const g = fresh(35);
    applyStatus(g.state, g.state, { id: 'bleeding', intensity: 1 }, 'a claw', { resSlashing: 0.6 });
    expect(findStatus(g.state, 'bleeding')!.intensity).toBeCloseTo(0.4);

    // Passing it is ALWAYS safe: a call site whose target varies hands it over
    // without checking, and a monster still answers with its own resistances.
    const goblin = spawnMonster(g.state, getSpot('woods_edge'));
    goblin.defId = 'goblin';
    applyStatus(g.state, goblin, { id: 'bleeding', intensity: 1 }, 'a claw', { resSlashing: 0.6 });
    expect(findStatus(goblin, 'bleeding')!.intensity).toBeCloseTo(1);
  });

  it('a transformation is not billed a second time', () => {
    // Escalating, souring in water, and leaving a successor behind are all
    // conditions BECOMING other conditions. The dose that produced them was
    // already answered when it landed; taxing the change too would charge a
    // resistant body twice for one application.
    const g = fresh(36);
    const ice = spawnMonster(g.state, getSpot('woods_edge'));
    ice.defId = 'slime_ice_basic';
    applyStatus(g.state, ice, { id: 'chilled', intensity: 1.6 });
    // 1.6 halved is 0.8 — under the cap, so still a chill.
    expect(findStatus(ice, 'chilled')!.intensity).toBeCloseTo(0.8);
    // Another of the same tips it over, and `frozen` inherits the full depth
    // rather than being halved on the way through.
    applyStatus(g.state, ice, { id: 'chilled', intensity: 1.6 });
    expect(hasStatus(ice, 'frozen')).toBe(true);
    expect(findStatus(ice, 'frozen')!.intensity).toBeCloseTo(1.6);
  });

  it('raises applications-to-escalation where escalation is measured in depth', () => {
    // The number a stacking build actually plays toward. `punctured` sums to a
    // cap of 3, so a resistant body needs proportionally more of them.
    const doses = (defId: string) => {
      const g = fresh(37);
      const m = spawnMonster(g.state, getSpot('woods_edge'));
      m.defId = defId;
      let n = 0;
      while (!hasStatus(m, 'perforated') && n < 40) {
        applyStatus(g.state, m, { id: 'punctured', intensity: 0.5 });
        n++;
      }
      return n;
    };
    // stone_golem is piercing 0.6; a goblin has no piercing resistance at all.
    expect(doses('stone_golem')).toBeGreaterThan(doses('goblin'));
  });

  it('leaves count-measured conditions counting, which is what they are for', () => {
    // `bleeding` escalates on STACKS ("every fresh cut is its own wound") and
    // `dazzled` on duration ("longer, not worse"). Resistance makes each cut
    // shallower without making it take more cuts to lacerate — the number of
    // applications IS the mechanic in both, so scaling depth must not move it.
    const cuts = (defId: string) => {
      const g = fresh(38);
      const m = spawnMonster(g.state, getSpot('woods_edge'));
      m.defId = defId;
      let n = 0;
      while (!hasStatus(m, 'lacerated') && n < 40) {
        applyStatus(g.state, m, { id: 'bleeding', intensity: 1 });
        n++;
      }
      return n;
    };
    expect(cuts('stone_golem')).toBe(cuts('goblin'));
    // But each of those cuts is shallower, so the bleed still bites less.
    expect(STATUSES.bleeding?.stacking.mode).toBe('count');
  });
});

describe('immunity: resistance of 1, or a status that grants it', () => {
  // The floor means resistance below 1 never stops a condition outright. At
  // 1 and above, once the applier's penetration is taken off, nothing lands.

  /** Run `body` with extra conditions registered, then remove them. */
  function withStatuses(extra: Record<string, StatusDef>, body: () => void) {
    Object.assign(STATUSES, extra);
    try {
      body();
    } finally {
      for (const id of Object.keys(extra)) delete STATUSES[id];
    }
  }

  const ironblood: StatusDef = {
    id: 'test_ironblood',
    name: 'Ironblood',
    icon: '🩸',
    desc: 'Test-only: +100% poison resistance.',
    stacking: { mode: 'highest' },
    duration: null,
    removal: [{ on: 'combatEnd', effect: 'remove' }],
    mods: [{ stat: 'resPoison', op: 'add', value: 1 }],
  };
  const ward: StatusDef = {
    id: 'test_ward',
    name: 'Warded',
    icon: '🛡️',
    desc: 'Test-only: immune to poison conditions and to bleeding.',
    stacking: { mode: 'highest' },
    duration: null,
    removal: [{ on: 'combatEnd', effect: 'remove' }],
    immune: { elements: ['poison'], ids: ['bleeding'] },
  };

  const monsterOf = (g: Game, defId: string) => {
    const m = spawnMonster(g.state, getSpot('woods_edge'));
    m.defId = defId;
    return m;
  };

  it('a player at resistance 1 is not poisoned; at 0.99 the dose lands at the floor', () => {
    const g = fresh(40);
    expect(applyStatus(g.state, g.state, { id: 'poison', intensity: 1 }, 'a fang', { resPoison: 1 })).toBeNull();
    expect(hasStatus(g.state, 'poison')).toBe(false);
    const landed = applyStatus(g.state, g.state, { id: 'poison', intensity: 1 }, 'a fang', { resPoison: 0.99 });
    expect(landed!.intensity).toBeCloseTo(APPLICATION_FLOOR);
  });

  it('only the condition’s own element is stopped, and only by an afflicting dose', () => {
    const g = fresh(41);
    const block = { resPoison: 1.5 };
    expect(applyStatus(g.state, g.state, { id: 'bleeding', intensity: 1 }, 'a claw', block)).not.toBeNull();
    // A buff has no element, so no resistance reaches it however high.
    expect(STATUSES.steady_hand?.element).toBeUndefined();
    expect(applyStatus(g.state, g.state, { id: 'steady_hand', intensity: 1 }, 'a meal', block)).not.toBeNull();
    // Without a block the caller cannot see one: nothing is invented.
    expect(applyStatus(g.state, g.state, { id: 'poison', intensity: 1 }, 'a fang')).not.toBeNull();
  });

  it('the applier’s penetration comes off the resistance before the test', () => {
    const poison = (res: number, pen?: number) => {
      const fresher = fresh(42);
      return applyStatus(fresher.state, fresher.state, { id: 'poison', intensity: 1 }, 'a fang', { resPoison: res }, pen);
    };
    expect(poison(1)).toBeNull();
    expect(poison(1, 0)).toBeNull();
    expect(poison(1, 0.2)!.intensity).toBeCloseTo(APPLICATION_FLOOR);
    // Resistance past 1 needs more to get through: 1.5 − 0.4 is still 1.1.
    expect(poison(1.5, 0.4)).toBeNull();
    expect(poison(1.5, 0.6)).not.toBeNull();
  });

  it('penetration only opens the door: below 1 the dose is the dose it always was', () => {
    const lands = (pen: number) => {
      const g = fresh(43);
      return applyStatus(g.state, g.state, { id: 'bleeding', intensity: 1 }, 'a claw', { resSlashing: 0.5 }, pen)!
        .intensity;
    };
    expect(lands(0)).toBeCloseTo(0.5);
    expect(lands(0.4)).toBeCloseTo(0.5);
  });

  it('reads the player’s resistance before the cap that holds the stat under 1', () => {
    withStatuses({ test_ironblood: ironblood }, () => {
      const g = fresh(44);
      applyStatus(g.state, g.state, { id: 'test_ironblood', intensity: 1 }, 'test');
      const stats = getDerivedStats(g.state);
      // The damage cap holds the stat at 0.75…
      expect(stats.resPoison).toBeCloseTo(0.75);
      // …but the condition test saw the 1.0 under it.
      expect(applyStatus(g.state, g.state, { id: 'poison', intensity: 1 }, 'a fang', stats)).toBeNull();
      expect(applyStatus(g.state, g.state, { id: 'poison', intensity: 1 }, 'a fang', stats, 0.2)).not.toBeNull();
      // A copy of the block loses the record and falls back to the capped
      // number: immunity fails closed, never open.
      const copy = { ...stats };
      const landed = applyStatus(g.state, g.state, { id: 'poison', intensity: 2 }, 'a fang', copy);
      expect(landed).not.toBeNull();
    });
  });

  it('a monster at resistance 1 is immune; at 0.9 it is only slowed', () => {
    const g = fresh(45);
    const knight = monsterOf(g, 'death_knight');
    expect(MONSTERS.death_knight.resistances?.poison).toBe(1);
    expect(applyStatus(g.state, knight, { id: 'poison', intensity: 1 }, 'a fang')).toBeNull();
    expect(hasStatus(knight, 'poison')).toBe(false);
    // Its other elements still answer by the old arithmetic.
    expect(applyStatus(g.state, knight, { id: 'bleeding', intensity: 1 }, 'a blade')!.intensity).toBeCloseTo(1);

    // The player's penetration reaches a monster's condition immunity too.
    const pen = applyStatus(g.state, knight, { id: 'poison', intensity: 1 }, 'a fang', undefined, 0.2);
    expect(pen!.intensity).toBeCloseTo(APPLICATION_FLOOR);

    // Metal slime guards slashing at 0.9, one short: the floor, not a wall.
    const metal = monsterOf(g, 'slime_metal');
    expect(MONSTERS.slime_metal.resistances?.slashing).toBe(0.9);
    expect(applyStatus(g.state, metal, { id: 'bleeding', intensity: 1 }, 'a blade')!.intensity).toBeCloseTo(APPLICATION_FLOOR);
  });

  it('every species that declares resistance 1 or more is immune to that element’s conditions', () => {
    const g = fresh(46);
    const pairs: string[] = [];
    for (const def of Object.values(MONSTERS)) {
      for (const [type, res] of Object.entries(def.resistances ?? {})) {
        if ((res ?? 0) < 1) continue;
        pairs.push(`${def.id}:${type}`);
        for (const cond of Object.values(STATUSES).filter((s) => s.element === type)) {
          const m = monsterOf(g, def.id);
          expect(applyStatus(g.state, m, { id: cond.id, intensity: 1 }, 'test'), `${def.id} ${cond.id}`).toBeNull();
        }
      }
    }
    expect(pairs).toContain('death_knight:poison');
  });

  /** Run `body` with an extra species registered, then remove it. */
  function withSpecies(def: MonsterDef, body: () => void) {
    MONSTERS[def.id] = def;
    try {
      body();
    } finally {
      delete MONSTERS[def.id];
    }
  }

  it('a species whose TAGS give it resistance 1 is immune with nothing declared', () => {
    // Lightning-tagged slimes resist lightning 0.7 at basic plus 0.1 per tier
    // step (TAG_RESISTANCES), which is 1.0 at ancient. Damage already sees it;
    // so must the condition.
    const storm = (id: string, tier: MonsterDef['tier']): MonsterDef => ({
      ...MONSTERS.slime_thunder_elite,
      id,
      tier,
      resistances: undefined,
    });
    withSpecies(storm('test_storm_ancient', 'ancient'), () => {
      withSpecies(storm('test_storm_elite', 'elite'), () => {
        const g = fresh(52);
        const ancient = monsterOf(g, 'test_storm_ancient');
        expect(monsterStats(ancient).resistances.lightning).toBeCloseTo(0.9); // the damage clamp
        expect(applyStatus(g.state, ancient, { id: 'jolted', intensity: 1 }, 'a spark')).toBeNull();
        // One tier down it is 0.9: the floor, not a wall.
        const elite = monsterOf(g, 'test_storm_elite');
        expect(applyStatus(g.state, elite, { id: 'jolted', intensity: 1 }, 'a spark')!.intensity).toBeCloseTo(
          APPLICATION_FLOOR,
        );
      });
    });
  });

  it('a condition that dictates the resistance can take a declared 1 away', () => {
    // `soaked` decides what poison resistance is (-0.5). It must lower the
    // immunity too, or a drenched death knight would stay untouchable.
    const g = fresh(53);
    const knight = monsterOf(g, 'death_knight');
    expect(applyStatus(g.state, knight, { id: 'poison', intensity: 1 }, 'a fang')).toBeNull();
    applyStatus(g.state, knight, { id: 'soaked', intensity: 1 }, 'a bucket');
    expect(hasStatus(knight, 'soaked')).toBe(true);
    expect(monsterStats(knight).resistances.poison).toBeCloseTo(-0.5);
    // And the dose lands deeper than a plain one: vulnerability, not just no wall.
    expect(applyStatus(g.state, knight, { id: 'poison', intensity: 1 }, 'a fang')!.intensity).toBeGreaterThan(1);
  });

  it('elemental resistance counts toward the line for the elemental types only', () => {
    // incomingSlice and monsterSlice both add resElemental to an elemental
    // type's own resistance before the cap, so 0.95 + 0.05 is a full 1.
    const g = fresh(54);
    const poison = (stats: Record<string, number>) => {
      const f = fresh(54);
      return applyStatus(f.state, f.state, { id: 'poison', intensity: 1 }, 'a fang', stats);
    };
    expect(poison({ resPoison: 0.95, resElemental: 0.05 })).toBeNull();
    expect(poison({ resPoison: 0.95, resElemental: 0.04 })).not.toBeNull();
    // Slashing is not elemental: the bonus never reaches a bleed.
    expect(ELEMENTAL_TYPES.has('slashing')).toBe(false);
    const bleed = applyStatus(g.state, g.state, { id: 'bleeding', intensity: 1 }, 'a claw', {
      resSlashing: 0.95,
      resElemental: 0.05,
    });
    expect(bleed!.intensity).toBeCloseTo(APPLICATION_FLOOR);
  });

  it('the player’s elemental resistance is read through the real stat pipeline', () => {
    const warding: StatusDef = {
      id: 'test_warding',
      name: 'Warding',
      icon: '🛡️',
      desc: 'Test-only: +90% poison resistance and +10% elemental resistance.',
      stacking: { mode: 'highest' },
      duration: null,
      removal: [{ on: 'combatEnd', effect: 'remove' }],
      mods: [
        { stat: 'resPoison', op: 'add', value: 0.9 },
        { stat: 'resElemental', op: 'add', value: 0.1 },
      ],
    };
    withStatuses({ test_warding: warding }, () => {
      const g = fresh(55);
      applyStatus(g.state, g.state, { id: 'test_warding', intensity: 1 }, 'test');
      const stats = getDerivedStats(g.state);
      expect(stats.resPoison).toBeCloseTo(0.75); // capped; the 0.9 under it and the 0.1 beside it are not
      expect(applyStatus(g.state, g.state, { id: 'poison', intensity: 1 }, 'a fang', stats)).toBeNull();
      // Not a poison, not an element: still lands.
      expect(applyStatus(g.state, g.state, { id: 'bleeding', intensity: 1 }, 'a claw', stats)).not.toBeNull();
    });
  });

  it('a monster’s elemental resistance counts toward the line too', () => {
    const bog: MonsterDef = { ...MONSTERS.death_knight, id: 'test_bog', resistances: { poison: 0.95, slashing: 0.95 } };
    const plus5: StatusDef = {
      id: 'test_hardened',
      name: 'Hardened',
      icon: '🛡️',
      desc: 'Test-only: +5% elemental resistance.',
      stacking: { mode: 'highest' },
      duration: null,
      removal: [{ on: 'combatEnd', effect: 'remove' }],
      mods: [{ stat: 'resElemental', op: 'add', value: 0.05 }],
    };
    withSpecies(bog, () => {
      withStatuses({ test_hardened: plus5 }, () => {
        const g = fresh(56);
        const m = monsterOf(g, 'test_bog');
        expect(applyStatus(g.state, m, { id: 'poison', intensity: 1 }, 'a fang')!.intensity).toBeCloseTo(
          APPLICATION_FLOOR,
        );
        removeStatus(m, 'poison');
        applyStatus(g.state, m, { id: 'test_hardened', intensity: 1 }, 'test');
        expect(applyStatus(g.state, m, { id: 'poison', intensity: 1 }, 'a fang')).toBeNull();
        // The physical type has no elemental share.
        expect(applyStatus(g.state, m, { id: 'bleeding', intensity: 1 }, 'a claw')).not.toBeNull();
      });
    });
  });

  it('a condition that grants resistance 1 makes its bearer immune, monster or player', () => {
    withStatuses({ test_ironblood: ironblood }, () => {
      const g = fresh(47);
      const wolf = monsterOf(g, 'goblin');
      expect(applyStatus(g.state, wolf, { id: 'poison', intensity: 1 }, 'a fang')).not.toBeNull();
      removeStatus(wolf, 'poison');
      applyStatus(g.state, wolf, { id: 'test_ironblood', intensity: 1 }, 'test');
      expect(applyStatus(g.state, wolf, { id: 'poison', intensity: 1 }, 'a fang')).toBeNull();
    });
  });

  it('`immune` refuses the elements and ids it names, and nothing else', () => {
    withStatuses({ test_ward: ward }, () => {
      const g = fresh(48);
      applyStatus(g.state, g.state, { id: 'test_ward', intensity: 1 }, 'test');
      expect(applyStatus(g.state, g.state, { id: 'poison', intensity: 1 }, 'a fang')).toBeNull(); // element
      expect(applyStatus(g.state, g.state, { id: 'rotting', intensity: 1 }, 'a fang')).toBeNull(); // element
      expect(applyStatus(g.state, g.state, { id: 'bleeding', intensity: 1 }, 'a claw')).toBeNull(); // id
      expect(applyStatus(g.state, g.state, { id: 'on_fire', intensity: 1 }, 'a torch')).not.toBeNull();
      expect(applyStatus(g.state, g.state, { id: 'steady_hand', intensity: 1 }, 'a meal')).not.toBeNull();
    });
  });

  it('`immune` blocks applications only: a condition already held stays', () => {
    withStatuses({ test_ward: ward }, () => {
      const g = fresh(49);
      applyStatus(g.state, g.state, { id: 'poison', intensity: 1 }, 'a fang');
      applyStatus(g.state, g.state, { id: 'test_ward', intensity: 1 }, 'test');
      expect(hasStatus(g.state, 'poison')).toBe(true);
      // And a fresh dose of the same thing does not deepen it.
      applyStatus(g.state, g.state, { id: 'poison', intensity: 3 }, 'a fang');
      expect(findStatus(g.state, 'poison')!.intensity).toBeCloseTo(1);
    });
  });

  it('a monster can wear `immune`, and losing it ends the protection', () => {
    withStatuses({ test_ward: ward }, () => {
      const g = fresh(50);
      const goblin = monsterOf(g, 'goblin');
      applyStatus(g.state, goblin, { id: 'test_ward', intensity: 1 }, 'test');
      expect(applyStatus(g.state, goblin, { id: 'poison', intensity: 1 }, 'a fang')).toBeNull();
      expect(applyStatus(g.state, goblin, { id: 'bleeding', intensity: 1 }, 'a blade')).toBeNull();
      removeStatus(goblin, 'test_ward');
      expect(applyStatus(g.state, goblin, { id: 'poison', intensity: 1 }, 'a fang')).not.toBeNull();
    });
  });

  it('a transformation is refused by `immune` the way `blockedBy` refuses it', () => {
    // A condition that tips into something the bearer is immune to loses the
    // old one and gains nothing; it does not slip through as a successor.
    withStatuses({ test_ward: { ...ward, immune: { ids: ['frozen'] } } }, () => {
      const g = fresh(51);
      applyStatus(g.state, g.state, { id: 'test_ward', intensity: 1 }, 'test');
      applyStatus(g.state, g.state, { id: 'chilled', intensity: 0.6 }, 'frost');
      applyStatus(g.state, g.state, { id: 'chilled', intensity: 0.6 }, 'frost');
      expect(hasStatus(g.state, 'frozen')).toBe(false);
      expect(hasStatus(g.state, 'chilled')).toBe(false);
    });
  });
});
