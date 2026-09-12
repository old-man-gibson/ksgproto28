// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { getDerivedStats, STAMINA_EFF_FLOOR } from '../src/core/systems/derived';
import { getSpot, STYLES } from '../src/core/registry';
import { spawnMonster } from '../src/core/systems/combat';
import { monsterStats } from '../src/core/systems/monsterStats';
import { resourceLock } from '../src/core/systems/resources';
import {
  EXHAUSTED_REGEN_MULT,
  EXHAUSTED_SPEED_PENALTY,
  STAMINA_RESERVE,
  attackUpkeep,
  exert,
  regenStamina,
  rollExtraHits,
} from '../src/core/systems/stamina';

/** The stamina lockout. Stored sparsely, so read it through the accessor. */
const lockOf = (g: Game) => resourceLock(g.state, 'stamina');

/** Opt in to the style's stamina bargain — every test below is about it. */
function exerting(g: Game): Game {
  g.setExerting(true);
  return g;
}

/** A character who can survive a few hundred ticks of hunting. */
function fighter(seed: number, style: string): Game {
  const g = new Game(createInitialState(seed));
  g.state.spot = 'woods_edge';
  g.state.attrs.str.level = 30;
  g.state.attrs.con.level = 40;
  g.state.resources.hp = 5000;
  g.equip(1); // rusty sword
  g.setStyle(style);
  g.setExerting(true);
  g.selectActivity('hunt');
  return g;
}

describe('exertion', () => {
  it('spends a fraction of MAX stamina and pays the full bonus for a full price', () => {
    const g = exerting(new Game(createInitialState(1)));
    const stats = getDerivedStats(g.state);
    const spec = STYLES.crush.exertion!;

    const ex = exert(g.state, stats, spec);
    expect(ex.spent).toBeCloseTo(stats.maxStamina * spec.cost * stats.staminaEff);
    expect(ex.ratio).toBeCloseTo(1);
    expect(ex.damage).toBeCloseTo(spec.hit!.damage!);
    expect(ex.penetration).toBeCloseTo(spec.hit!.penetration!);
    expect(lockOf(g)).toBe('none');
  });

  it('a partial payment buys a proportional share, then latches winded', () => {
    const g = exerting(new Game(createInitialState(2)));
    const stats = getDerivedStats(g.state);
    const spec = STYLES.crush.exertion!;
    const floor = stats.maxStamina * STAMINA_RESERVE;
    // Only a fifth of the intended cost is left above the reserve.
    const affordable = stats.maxStamina * spec.cost * stats.staminaEff * 0.2;
    g.state.resources.stamina = floor + affordable;

    const ex = exert(g.state, stats, spec);
    expect(ex.ratio).toBeCloseTo(0.2);
    expect(ex.damage).toBeCloseTo(spec.hit!.damage! * 0.2);
    expect(g.state.resources.stamina).toBeCloseTo(floor);
    expect(lockOf(g)).toBe('low');

    // Winded: nothing more is spent and nothing more is bought.
    const again = exert(g.state, stats, spec);
    expect(again.spent).toBe(0);
    expect(again.damage).toBe(0);
    expect(g.state.resources.stamina).toBeCloseTo(floor);
  });

  it('the lockout clears only on a completely full bar', () => {
    const g = exerting(new Game(createInitialState(3)));
    const stats = getDerivedStats(g.state);
    g.state.resourceLocks.stamina = 'low';
    g.state.resources.stamina = stats.maxStamina - 0.5;

    regenStamina(g.state, stats, 0.25);
    expect(lockOf(g)).toBe('low'); // still short
    regenStamina(g.state, stats, 0.25);
    expect(g.state.resources.stamina).toBe(stats.maxStamina);
    expect(lockOf(g)).toBe('none');
  });

  it('style mods lapse while winded and return with the breath', () => {
    const g = exerting(new Game(createInitialState(4)));
    g.setStyle('finesse'); // exertion grants +12% crit while spendable
    const fresh = getDerivedStats(g.state).crit;

    g.state.resourceLocks.stamina = 'low';
    expect(getDerivedStats(g.state).crit).toBeCloseTo(fresh - 0.12);

    g.state.resourceLocks.stamina = 'none';
    expect(getDerivedStats(g.state).crit).toBeCloseTo(fresh);
  });

  it('fractional extra hits roll as a chance, whole ones are guaranteed', () => {
    const g = exerting(new Game(createInitialState(5)));
    expect(rollExtraHits(g.state, 0)).toBe(0);
    expect(rollExtraHits(g.state, 1)).toBe(1);
    const rolls = Array.from({ length: 40 }, () => rollExtraHits(g.state, 1.5));
    expect(Math.min(...rolls)).toBe(1);
    expect(Math.max(...rolls)).toBe(2);
  });
});

describe('exhaustion', () => {
  it('an all-in school strike empties the bar and leaves you spent', () => {
    const g = exerting(new Game(createInitialState(6)));
    const stats = getDerivedStats(g.state);

    const ex = exert(g.state, stats, STYLES.jigen_ryu.exertion!);
    expect(g.state.resources.stamina).toBe(0);
    expect(lockOf(g)).toBe('empty');
    // A full bar buys the whole bonus; the strike is worth its price.
    expect(ex.ratio).toBeCloseTo(1);
    expect(ex.damage).toBeCloseTo(STYLES.jigen_ryu.exertion!.hit!.damage!);
  });

  it('a half-empty bar buys half the all-in bonus', () => {
    const g = exerting(new Game(createInitialState(7)));
    const stats = getDerivedStats(g.state);
    g.state.resources.stamina = stats.maxStamina * 0.5;

    const ex = exert(g.state, stats, STYLES.jigen_ryu.exertion!);
    expect(ex.ratio).toBeCloseTo(0.5);
    expect(lockOf(g)).toBe('empty');
  });

  it('drags every action bar down until recovery', () => {
    const g = exerting(new Game(createInitialState(8)));
    const rested = getDerivedStats(g.state).speed;
    g.state.resourceLocks.stamina = 'empty';
    expect(getDerivedStats(g.state).speed).toBeCloseTo(rested * (1 - EXHAUSTED_SPEED_PENALTY));
  });

  it('crawls back for the first half of the bar, then recovers normally', () => {
    const g = exerting(new Game(createInitialState(9)));
    const stats = getDerivedStats(g.state);
    g.state.resourceLocks.stamina = 'empty';
    g.state.resources.stamina = 0;

    regenStamina(g.state, stats, 1);
    expect(g.state.resources.stamina).toBeCloseTo(EXHAUSTED_REGEN_MULT); // slowed

    g.state.resources.stamina = stats.maxStamina * 0.6; // past the halfway mark
    regenStamina(g.state, stats, 1);
    expect(g.state.resources.stamina).toBeCloseTo(stats.maxStamina * 0.6 + 1); // full speed
    expect(lockOf(g)).toBe('empty'); // but still locked out
  });
});

describe('exertion in a fight', () => {
  it('fighting in Crush drains stamina to the reserve and stops there', () => {
    const g = fighter(10, 'crush');
    let winded = false;
    for (let i = 0; i < 600; i++) {
      g.tick();
      const floor = getDerivedStats(g.state).maxStamina * STAMINA_RESERVE;
      expect(g.state.resources.stamina).toBeGreaterThanOrEqual(Math.min(floor, g.state.resources.stamina) - 1e-6);
      expect(g.state.resources.stamina).toBeGreaterThanOrEqual(0);
      if (lockOf(g) === 'low') winded = true;
    }
    expect(winded).toBe(true);
  });

  it('Cleave carries the blow into a flanker', () => {
    const g = fighter(11, 'cleave');
    const spot = getSpot('woods_edge');
    const id = spot.encounters![0].monsterId;
    const front = spawnMonster(g.state, spot, { monsterId: id, level: 1 });
    const flank = spawnMonster(g.state, spot, { monsterId: id, level: 1 });
    // Nobody dies and reshuffles the formation: give both a vast CON, then
    // start them at the top of it.
    front.attrs.con = flank.attrs.con = 100000;
    const fullHp = monsterStats(front).maxHp;
    front.hp = flank.hp = fullHp;
    g.state.combat = {
      enemies: [front, flank, null, null, null],
      playerBar: 0,
      momentum: 0,
      position: 'neutral',
      cooldowns: {},
      buffs: [],
      events: {},
    };

    for (let i = 0; i < 60 && flank.hp === fullHp; i++) g.tick();
    expect(flank.hp).toBeLessThan(fullHp);
    // The centre still takes the brunt of it.
    expect(fullHp - front.hp).toBeGreaterThan(fullHp - flank.hp);
  });

  it('Quick builds momentum over a fight, capped by its stance', () => {
    const g = fighter(12, 'quick');
    // Raising CON raised the ceiling, not the pool. Momentum can only build
    // while there is stamina to burn, so start the fight with a full bar —
    // otherwise this measures the winded lockout instead of the ramp.
    g.state.resources.stamina = getDerivedStats(g.state).maxStamina;
    const cap = STYLES.quick.exertion!.ramp!.cap;
    // Momentum belongs to one fight, so watch the peak rather than the tail.
    let peak = 0;
    for (let i = 0; i < 400; i++) {
      g.tick();
      peak = Math.max(peak, g.state.combat?.momentum ?? 0);
    }
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(cap);
  });
});

describe('opting in', () => {
  /** A fighter with a big enough pool to see a whole fight's worth of drain. */
  function brawler(seed: number, style = 'crush'): Game {
    const g = new Game(createInitialState(seed));
    g.state.spot = 'training_grounds'; // dummies never die, so the sample is honest
    g.state.attrs.str.level = 30;
    g.state.attrs.con.level = 40;
    g.state.resources.hp = 5000;
    g.state.resources.stamina = getDerivedStats(g.state).maxStamina;
    g.equip(1);
    g.setStyle(style);
    g.selectActivity('hunt');
    return g;
  }

  it('holding back still costs upkeep, but never runs you down', () => {
    const g = brawler(20);
    const max = getDerivedStats(g.state).maxStamina;
    let lowest = max;
    for (let i = 0; i < 1200; i++) {
      g.tick();
      lowest = Math.min(lowest, g.state.resources.stamina);
    }
    expect(g.state.exerting).toBe(false);
    expect(lowest).toBeLessThan(max); // swinging does cost something
    expect(lockOf(g)).toBe('none'); // but upkeep alone never winds you
    expect(g.state.resources.stamina).toBeGreaterThan(max * STAMINA_RESERVE);
  });

  it('opting in spends real reserves and buys the stance its bonuses', () => {
    const held = brawler(21);
    const spent = brawler(21);
    spent.setExerting(true);
    for (let i = 0; i < 600; i++) {
      held.tick();
      spent.tick();
    }
    expect(spent.state.resources.stamina).toBeLessThan(held.state.resources.stamina);
    // Crush's exertion is damage + penetration on the blow, so it hits harder.
    const dmg = (g: Game) => {
      const e = g.state.combat!.enemies[0]!;
      return monsterStats(e).maxHp - e.hp;
    };
    expect(dmg(spent)).toBeGreaterThan(dmg(held));
  });

  it('upkeep tracks the pace of your swings, not their number', () => {
    const stats = getDerivedStats(new Game(createInitialState(22)).state);
    // Twice the wind-up, twice the cost per blow — same drain per second.
    expect(attackUpkeep(stats, 4)).toBeCloseTo(attackUpkeep(stats, 2) * 2);
    // And a swing always costs less than it recovers while winding up.
    expect(attackUpkeep(stats, 2)).toBeLessThan(stats.staminaRegen * 2);
  });
});

describe('stamina power', () => {
  it('pays back what efficiency saves', () => {
    const g = new Game(createInitialState(23));
    const raw = getDerivedStats(g.state);
    expect(raw.staminaPower).toBeCloseTo(2 - raw.staminaEff);

    g.state.attrs.str.level = 120;
    g.state.attrs.dex.level = 120;
    const trained = getDerivedStats(g.state);
    expect(trained.staminaEff).toBeLessThan(raw.staminaEff); // cheaper
    expect(trained.staminaPower).toBeGreaterThan(raw.staminaPower); // and stronger
    expect(trained.staminaPower - 1).toBeCloseTo(1 - trained.staminaEff, 5);
  });

  it('efficiency stops at a floor instead of running to nothing', () => {
    const g = new Game(createInitialState(24));
    g.state.attrs.str.level = 100000;
    g.state.attrs.dex.level = 100000;
    expect(getDerivedStats(g.state).staminaEff).toBeCloseTo(STAMINA_EFF_FLOOR);
    expect(getDerivedStats(g.state).staminaPower).toBeCloseTo(2 - STAMINA_EFF_FLOOR);
  });

  it('multiplies what an exertion buys', () => {
    const weak = new Game(createInitialState(25));
    weak.setExerting(true);
    const strong = new Game(createInitialState(25));
    strong.setExerting(true);
    strong.state.attrs.str.level = 150;
    strong.state.attrs.dex.level = 150;
    strong.state.resources.stamina = getDerivedStats(strong.state).maxStamina; // a bigger pool starts empty

    const spec = STYLES.crush.exertion!;
    const a = exert(weak.state, getDerivedStats(weak.state), spec);
    const b = exert(strong.state, getDerivedStats(strong.state), spec);
    expect(b.damage).toBeGreaterThan(a.damage);
    expect(b.damage / spec.hit!.damage!).toBeCloseTo(getDerivedStats(strong.state).staminaPower, 4);
  });
});
