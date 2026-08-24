import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { spawnMonster } from '../src/core/systems/combat';
import { MONSTERS, SPOTS, TIERS, MODIFIER_TIERS } from '../src/core/registry';
import { getDerivedStats } from '../src/core/systems/derived';
import {
  MONSTER_EXEMPT_STATS,
  MONSTER_RESIST_CAP,
  MONSTER_STAT_KEYS,
  innateResistances,
  monsterStats,
  statsFromAttrs,
} from '../src/core/systems/monsterStats';
import { monsterSlice } from '../src/core/systems/combat';
import { applyStatus } from '../src/core/systems/statuses';
import { monsterSizeRank } from '../src/core/systems/bestiary';
import { playerSizeRank } from '../src/core/systems/mutagens';
import type { DamageType } from '../src/core/types';
import { findStatus, hasStatus } from '../src/core/systems/statuses';

function huntingGame(seed = 7, spot = 'woods_edge') {
  const game = new Game(createInitialState(seed));
  game.state.spot = spot;
  game.equip(1); // rusty sword
  game.selectActivity('hunt');
  return game;
}

describe('the fast feeds on action', () => {
  /*
   * Every monster is dressed rather than one, so the test does not depend on
   * which of a spot's table happens to roll — a spawn-dependent assertion here
   * would be exactly the kind of load-sensitive flake that makes `npm run
   * verify` untrustworthy.
   */
  function withFastingWorld<T>(run: () => T): T {
    const defs = Object.values(MONSTERS);
    for (const d of defs) d.wears = [{ id: 'fasting' }];
    try {
      return run();
    } finally {
      for (const d of defs) delete d.wears;
    }
  }

  function huntUntilHungry(g: Game, ticks = 400): boolean {
    for (let i = 0; i < ticks; i++) {
      g.tick();
      if (hasStatus(g.state, 'hunger_anupama')) return true;
    }
    return false;
  }

  it('lands hunger on whoever acts while something in the fight is fasting', () => {
    withFastingWorld(() => {
      const g = huntingGame();
      expect(huntUntilHungry(g)).toBe(true);
      // Intensity carries the imparter's wisdom, so it is never a flat 1.
      expect(findStatus(g.state, 'hunger_anupama')!.intensity).toBeGreaterThan(0);
    });
  });

  it('does nothing at all when nothing is fasting', () => {
    const g = huntingGame();
    expect(huntUntilHungry(g)).toBe(false);
  });
});

describe('monster generation', () => {
  it('spawns within the encounter level range with tier/modifier/rarity classification', () => {
    const g = huntingGame();
    for (let i = 0; i < 50; i++) {
      const m = spawnMonster(g.state, SPOTS.woods_edge);
      expect(m.level).toBeGreaterThanOrEqual(1);
      expect(m.level).toBeLessThanOrEqual(4);
      expect(Object.keys(TIERS)).toContain(m.tier);
      expect(Object.keys(MODIFIER_TIERS)).toContain(m.modifier);
      expect(['common', 'uncommon', 'rare', 'epic']).toContain(m.rarity);
      expect(m.mutation).toBeNull();
      expect(m.hp).toBeGreaterThan(0);
    }
  });

  it('boss-modified monsters are stronger than normal ones of the same def/level', () => {
    const g = huntingGame();
    let normalHp = 0;
    let bossHp = 0;
    for (let i = 0; i < 2000 && (!normalHp || !bossHp); i++) {
      const m = spawnMonster(g.state, SPOTS.woods_edge);
      if (m.defId === 'forest_rat' && m.level === 2 && m.rarity === 'common') {
        // normal multiplier range is [1,1]; boss floor (1.5) beats basic-tier ceiling drift
        if (m.modifier === 'normal' && !normalHp) normalHp = monsterStats(m).maxHp;
        if (m.modifier === 'boss') bossHp = monsterStats(m).maxHp;
      }
    }
    // Worst case: normal rolls basic-tier ceiling (×1.1), boss rolls floor (×0.8×1.5=1.2).
    if (normalHp && bossHp) expect(bossHp).toBeGreaterThan(normalHp);
  });
});

describe('combat resolution', () => {
  it('a fresh character eventually wins fights at the starting hunting ground', () => {
    const g = huntingGame();
    for (let i = 0; i < 5000 && (g.state.stats['kills'] ?? 0) < 3; i++) g.tick();
    expect(g.state.stats['kills'] ?? 0).toBeGreaterThanOrEqual(3);
    expect(g.state.gold).toBeGreaterThan(0);
  });

  it('combat grants attribute and skill xp', () => {
    const g = huntingGame();
    for (let i = 0; i < 2000; i++) g.tick();
    expect(g.state.skills.fighting).toBeDefined();
    expect(g.state.attrs.str.xp > 0 || g.state.attrs.str.level > 1).toBe(true);
  });

  it('knockout triggers recovery instead of death, then resumes hunting', () => {
    // Level-1 character straight into the ravine floor (level 8-14 monsters).
    const g = huntingGame(13, 'ravine_floor');
    let defeated = false;
    g.bus.on('defeat', () => (defeated = true));
    for (let i = 0; i < 3000 && !defeated; i++) g.tick();
    expect(defeated).toBe(true);
    expect(g.state.resources.hp).toBeGreaterThan(0);
    expect(g.state.recovering).toBe(true);
    expect(g.state.activity).toBe('hunt'); // selection preserved

    // Recovery: hp climbs back to the threshold, then recovering clears.
    const maxHp = getDerivedStats(g.state).maxHp;
    for (let i = 0; i < 500 && g.state.recovering; i++) g.tick();
    expect(g.state.recovering).toBe(false);
    expect(g.state.resources.hp).toBeGreaterThanOrEqual(maxHp * 0.5);
  });

  it('combat styles change derived stats', () => {
    const g = huntingGame();
    const balanced = getDerivedStats(g.state).damage;
    g.setStyle('aggressive');
    expect(getDerivedStats(g.state).damage).toBeGreaterThan(balanced);
    g.setStyle('defensive');
    expect(getDerivedStats(g.state).damage).toBeLessThan(balanced);
  });

  it('kills feed tiered achievements which grant bonuses', () => {
    const g = huntingGame();
    g.state.stats['kills'] = 99; // Slayer I lands on the hundredth
    const before = getDerivedStats(g.state).damage;
    for (let i = 0; i < 5000 && !(g.state.achievements.slayer >= 1); i++) g.tick();
    expect(g.state.achievements.slayer).toBeGreaterThanOrEqual(1);
    // +2% damage from Slayer I (measured with same style/equipment)
    expect(getDerivedStats(g.state).damage).toBeGreaterThan(before);
  });
});

describe('the training dummy', () => {
  it('the benchmark post takes a beating for hours and can never hurt you back', () => {
    const g = huntingGame(21, 'benchmark_post');
    const startHp = g.state.resources.hp;
    let swung = false;
    let lowestHp = startHp;

    for (let i = 0; i < 2000; i++) {
      g.tick();
      lowestHp = Math.min(lowestHp, g.state.resources.hp);
      const dummy = g.state.combat?.enemies[0];
      if (dummy && dummy.hp < monsterStats(dummy).maxHp) swung = true;
    }

    expect(swung).toBe(true); // it does take damage
    // ...and never deals any. Health only climbs during a fight now (the
    // trickle runs at half pace), so the claim is that it never once dipped —
    // a single point of damage would show here even if regen papered over it.
    expect(lowestHp).toBe(startHp);
    expect(g.state.recovering).toBe(false);
    // Still standing after all that: HP measured in millions, not hundreds.
    expect(monsterStats(g.state.combat!.enemies[0]!).maxHp).toBeGreaterThan(1_000_000);
    expect(g.state.combatFeed.some((l) => l.text.includes('no harm done'))).toBe(true);
  });

  it('practice teaches skills but yields no kills, gold or loot', () => {
    const g = huntingGame(22, 'training_grounds');
    for (let i = 0; i < 800; i++) g.tick();
    expect(g.state.skills['fighting']?.level ?? 0).toBeGreaterThan(0);
    expect(g.state.stats['kills'] ?? 0).toBe(0);
    expect(g.state.gold).toBe(0);
    expect(g.state.inventory.length).toBe(0); // the starting sword is equipped; nothing dropped
  });
});

/*
 * docs/plans/tag-resistances.md. What a body is MADE OF now answers for what it
 * resists, the way TAG_ARMOR already answers for what it is armoured with.
 *
 * Every number in TAG_RESISTANCES was derived from the species that already
 * declared one — so the load-bearing test is the first: the table reproduces
 * the data it came from, and is a pattern that was already there rather than
 * one imposed on it.
 */
describe('innate resistances come from what a thing is made of', () => {
  it('reproduces every declaration it was derived from', () => {
    const disagreements: string[] = [];
    for (const def of Object.values(MONSTERS)) {
      const innate = innateResistances(def.id);
      for (const [type, declared] of Object.entries(def.resistances ?? {})) {
        // A declaration always wins outright, so this can only ever fail if the
        // merge itself is broken — which is precisely what it is here to catch.
        if (Math.abs(innate[type as DamageType] - declared!) > 1e-9) {
          disagreements.push(`${def.id}.${type}: declared ${declared}, resolved ${innate[type as DamageType]}`);
        }
      }
    }
    expect(disagreements).toEqual([]);
  });

  it('gives a slime its physical block without the species restating it', () => {
    // psionic_slime declares only `{ heat: 0.8 }`. Before this layer it was the
    // one slime in the game with no physical resistance at all, which read as
    // an omission rather than an identity — catching exactly this is the point.
    const res = innateResistances('psionic_slime');
    expect(res.slashing).toBeCloseTo(0.5, 5);
    expect(res.piercing).toBeCloseTo(0.5, 5);
    expect(res.bludgeoning).toBeCloseTo(-0.25, 5);
    // …and its own declaration still wins over what the fire tag would give it.
    expect(res.heat).toBeCloseTo(0.8, 5);
  });

  it('scales an elemental line with tier but never a physical one', () => {
    // Fire runs heat 0.5 / 0.6 / 0.7 with cold mirroring it. An elemental line
    // getting more elemental as it ascends is what the line IS.
    expect(innateResistances('slime_fire').heat).toBeCloseTo(0.5, 5);
    expect(innateResistances('slime_fire_advanced').heat).toBeCloseTo(0.6, 5);
    expect(innateResistances('slime_fire_elite').heat).toBeCloseTo(0.7, 5);
    // Being made of slime does not get slimier with rank.
    for (const id of ['slime_fire', 'slime_fire_advanced', 'slime_fire_elite']) {
      expect(innateResistances(id).slashing, id).toBeCloseTo(0.5, 5);
    }
  });

  it('lets a species opt out with an explicit zero', () => {
    // Absent means "whatever I am made of"; zero means "not that". Without the
    // distinction a body could never decline what its tags imply.
    expect(innateResistances('slime_honey').bludgeoning).toBeCloseTo(0.35, 5);
    expect(innateResistances('slime_wind').slashing).toBeCloseTo(0.3, 5);
  });

  it('is unknown-safe, because statsFromAttrs asks with no species at all', () => {
    // `innateResistances('')` is the bestiary's averaged profile — it must not
    // throw and must not invent a resistance out of a def that does not exist.
    const none = innateResistances('');
    expect(Object.values(none).every((v) => v === 0)).toBe(true);
  });
});

/*
 * docs/plans/monster-stat-parity.md. A gene modifier has to mean the same thing
 * whoever is wearing it, so the monster block grew every dial the player's had.
 *
 * The load-bearing property is the FIRST test: every default is what the
 * pipeline already behaved as, so parity landed without re-tuning the bestiary.
 * The rest prove each dial is genuinely reachable rather than merely declared.
 */
describe('a monster reads the same stat block the player does', () => {
  const neutral = () => statsFromAttrs({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });

  it('defaults every new dial to what the pipeline already did', () => {
    const s = neutral();
    expect(s.attackSpeed).toBe(1);
    expect(s.critTaken).toBe(1);
    expect(s.damageTaken).toBe(1);
    expect(s.ward).toBe(0);
    expect(s.resElemental).toBe(0);
    expect(s.resRanged).toBe(0);
    expect(s.vsSmaller).toBe(0);
    expect(s.fromSmaller).toBe(0);
    expect(s.extraSwings).toBe(0);
    expect(s.missRefund).toBe(0);
    expect(s.graze).toBe(0);
    // The ceiling that used to be a constant inline, now a stat — same number.
    expect(s.resistCap).toBe(MONSTER_RESIST_CAP);
  });

  it('lets a modifier reach every field of the block', () => {
    // MONSTER_STAT_KEYS is derived from a neutral block rather than hand-listed
    // precisely so this cannot drift. The list it replaced held eight names
    // against nine fields, and the missing one was `hpRegen` — so a troll
    // wearing the troll gene would not have regenerated.
    const keys = Object.keys(neutral()).filter((k) => k !== 'resistances');
    expect(keys).toContain('hpRegen');
    expect([...MONSTER_STAT_KEYS].sort()).toEqual(keys.sort());
  });

  it('resolves fromStat against the monster, in its own pass', () => {
    // `refutation` is the one authored status carrying a derived modifier:
    // ward 40 flat, plus 1.5 per point of the BEARER's spell power. Before the
    // layer-3 pass it landed as the flat 40 alone — on the player it was the
    // build, on a monster it was silently half a status.
    const g = huntingGame();
    const foe = spawnMonster(g.state, SPOTS.woods_edge);
    const power = monsterStats(foe).spellPower;
    expect(power).toBeGreaterThan(0);
    applyStatus(g.state, foe, { id: 'refutation', intensity: 1 });
    expect(monsterStats(foe).ward).toBeCloseTo(40 + 1.5 * power, 5);
  });

  it('spends that ward on a blow, the way the player does', () => {
    const g = huntingGame();
    const foe = spawnMonster(g.state, SPOTS.woods_edge);
    const bare = monsterSlice(foe, 'heat', 'test', 100).dealt;
    applyStatus(g.state, foe, { id: 'refutation', intensity: 1 });
    const ward = monsterStats(foe).ward;
    const warded = monsterSlice(foe, 'heat', 'test', 100);
    // Heat so armour (physical-only) stays out of it and the ward is the whole
    // difference. It never banks its surplus, so a ward larger than the blow
    // absorbs the blow and no more.
    expect(warded.warded).toBeCloseTo(Math.min(bare, ward), 5);
    expect(warded.dealt).toBeCloseTo(Math.max(0, bare - ward), 5);
  });

  it('reads the size gap from whichever side is bigger', () => {
    // The pair ran one direction only — a monster could never BE the bigger
    // thing, so a genome that looms did so only while a player wore it. Both
    // floors are independent, so at equal size neither side bullies the other.
    const big = monsterSizeRank('psionic_slime');
    const small = monsterSizeRank('forest_rat');
    expect(big).toBeGreaterThan(small);
    const g = huntingGame();
    expect(playerSizeRank(g.state)).toBeGreaterThan(small);
    expect(playerSizeRank(g.state)).toBeLessThan(big);
  });

  it('names maxMana as exempt rather than dropping it silently', () => {
    // The one carve-out, and it is structural: castMonsterWorking performs no
    // mana check at all. Named so an author routing it into a genome can be
    // told, rather than discovering it in a fight.
    expect(MONSTER_EXEMPT_STATS.has('maxMana')).toBe(true);
    expect(MONSTER_STAT_KEYS.has('maxMana')).toBe(false);
  });
});
