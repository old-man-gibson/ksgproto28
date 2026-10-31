import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { MONSTERS, SPOTS, STATUSES } from '../src/core/registry';
import { TECHNIQUES } from '../src/core/data/martial.data';
import { ATTRIBUTE_LIST } from '../src/core/data/attributes.data';
import { getDerivedStats } from '../src/core/systems/derived';
import { liveEnemies, monsterSlice, spawnMonster, startStagedGroup, type StagedMember } from '../src/core/systems/combat';
import {
  biasAttrs,
  innateArmor,
  innateResistances,
  kitOf,
  monsterStats,
  statsFromAttrs,
  TAG_RESISTANCES,
} from '../src/core/systems/monsterStats';
import { applyStatus, hasStatus } from '../src/core/systems/statuses';
import { TRIGGER_SUBJECTS } from '../src/core/systems/triggers';
import type { AttributeId, MonsterInstance, MonsterKit } from '../src/core/types';

/**
 * A specimen's own kit over its def's (docs/FESTIVAL.md §9.6, MonsterKit,
 * `kitOf`): every combat read of a def's rotation, damage type, reach,
 * resistances, armour and riders goes through it, and a specimen without a
 * kit behaves exactly as before. The royale's survivors carry one each.
 */

const HALL = 'f1_storerooms';
const BRUTE = 'ph_survivor_brute';
const GOBLIN = 'goblin';

/** A specimen of `defId` at `level`, minted the way a staged fight mints it. */
function minted(defId: string, level: number, kit?: MonsterKit): MonsterInstance {
  const s = createInitialState(1, HALL);
  const m = spawnMonster(s, SPOTS[HALL], { monsterId: defId, level, plain: true });
  if (kit) m.kit = kit;
  return m;
}

/** A player far past the specimen's reach to hurt and to kill, mid-fight with one staged member. */
function stage(member: StagedMember): { g: Game; e: MonsterInstance } {
  const s = createInitialState(3, HALL);
  s.stats['flag:tutorial_done'] = 1;
  for (const a of ATTRIBUTE_LIST) s.attrs[a.id].level = 100;
  const g = new Game(s);
  g.state.resources.hp = getDerivedStats(g.state).maxHp;
  startStagedGroup(g.state, g.bus, SPOTS[HALL], [member]);
  const e = liveEnemies(g.state.combat!)[0];
  // Nothing in a few hundred ticks kills it, so what it does can be read.
  e.attrs.con = 1e7;
  e.hp = monsterStats(e).maxHp;
  return { g, e };
}

/** Tick up to `max` times, topping the player up each tick, until `done` holds. */
function run(g: Game, max: number, done: () => boolean, each?: () => void): void {
  for (let i = 0; i < max && g.state.combat && !done(); i++) {
    each?.();
    g.tick();
    g.state.resources.hp = getDerivedStats(g.state).maxHp;
  }
}

const feed = (g: Game): string => g.state.combatFeed.map((f) => f.text).join('\n');

describe('kitOf', () => {
  it('a specimen without a kit reads exactly its def, for every species', () => {
    for (const def of Object.values(MONSTERS)) {
      const k = kitOf({ defId: def.id });
      expect(k.rotation, def.id).toBe(def.rotation);
      expect(k.damageType, def.id).toBe(def.damageType);
      expect(k.range, def.id).toBe(def.range ?? 'melee');
      expect(k.resistances, def.id).toBe(def.resistances);
      expect(k.armor, def.id).toBe(def.armor);
      expect(k.inflicts, def.id).toBe(def.inflicts);
    }
  });

  it('each field the kit holds replaces the def’s whole, and the rest stay the def’s', () => {
    const def = MONSTERS[GOBLIN];
    expect(def.inflicts?.length, 'the goblin bleeds its target').toBeGreaterThan(0);
    const k = kitOf({ defId: GOBLIN, kit: { damageType: 'cold', range: 'ranged', inflicts: [] } });
    expect(k.damageType).toBe('cold');
    expect(k.range).toBe('ranged');
    // An empty list is a replacement too: the def's riders are gone.
    expect(k.inflicts).toEqual([]);
    expect(k.resistances).toBe(def.resistances);
    expect(k.rotation).toBe(def.rotation);
  });

  it('reads the specimen, not a snapshot of it', () => {
    const m = minted(GOBLIN, 5);
    expect(kitOf(m).damageType).toBe(MONSTERS[GOBLIN].damageType);
    m.kit = { damageType: 'arcane' };
    expect(kitOf(m).damageType).toBe('arcane');
    delete m.kit;
    expect(kitOf(m).damageType).toBe(MONSTERS[GOBLIN].damageType);
  });
});

describe('the kit in a specimen’s stats', () => {
  it('kit.armor is a level-1 figure that grows 5% a level, and 0 beats what the tags imply', () => {
    const m = minted(GOBLIN, 21);
    expect(monsterStats(m).armor).toBe(0);
    m.kit = { armor: 10 };
    expect(innateArmor(GOBLIN, m.kit)).toBe(10);
    expect(monsterStats(m).armor).toBeCloseTo(10 * (1 + 0.05 * 20), 10);
    // A construct is armoured by what it is made of; a kit that says 0 is bare.
    const golem = minted('slime_golem', 21);
    expect(monsterStats(golem).armor).toBeGreaterThan(0);
    golem.kit = { armor: 0 };
    expect(monsterStats(golem).armor).toBe(0);
  });

  it('kit.resistances replace the def’s declared block; the tags still speak for the rest', () => {
    const def = MONSTERS[GOBLIN];
    expect(def.resistances?.poison, 'the goblin resists poison').toBeGreaterThan(0);
    const m = minted(GOBLIN, 5);
    expect(monsterStats(m).resistances.poison).toBeCloseTo(def.resistances!.poison!, 10);
    m.kit = { resistances: { cold: 0.4 } };
    const stats = monsterStats(m);
    expect(stats.resistances.cold).toBeCloseTo(0.4, 10);
    expect(stats.resistances.poison).toBe(0);
    expect(innateResistances(GOBLIN, m.kit).cold).toBe(0.4);
    // The golem declares its own slashing resistance, which a kit block replaces; its
    // slime tag still speaks for the type the kit does not name.
    const slime = minted('slime_golem', 5);
    expect(MONSTERS.slime_golem.resistances?.slashing).toBe(0.75);
    expect(monsterStats(slime).resistances.slashing).toBe(0.75);
    slime.kit = { resistances: { cold: 0.4 } };
    expect(monsterStats(slime).resistances.slashing).toBe(TAG_RESISTANCES.slime.slashing!.base);
  });

  it('is read fresh on every call: changing the kit changes the next read', () => {
    const m = minted(GOBLIN, 11, { armor: 4 });
    const a = monsterStats(m).armor;
    m.kit!.armor = 8;
    expect(monsterStats(m).armor).toBeCloseTo(a * 2, 10);
    m.kit!.resistances = { slashing: 0.5 };
    expect(monsterStats(m).resistances.slashing).toBeCloseTo(0.5, 10);
  });

  it('holds through a condition that moves stats', () => {
    const status = Object.values(STATUSES).find((d) => !d.hidden && d.mods?.some((x) => x.stat === 'speed' || x.stat === 'dex'));
    expect(status, 'a status with stat mods exists').toBeTruthy();
    const m = minted(GOBLIN, 11, { armor: 6, resistances: { cold: 0.3 } });
    const s = createInitialState(2, HALL);
    expect(applyStatus(s, m, { id: status!.id, intensity: 1 }, 'test')).toBeTruthy();
    const stats = monsterStats(m);
    expect(stats.armor).toBeCloseTo(6 * (1 + 0.05 * 10), 10);
    expect(stats.resistances.cold).toBeCloseTo(0.3, 10);
  });

  it('armour and resistance change what a blow does to it', () => {
    const bare = minted(GOBLIN, 21);
    const kitted = minted(GOBLIN, 21, { armor: 10, resistances: { slashing: 0.5 } });
    const a = monsterSlice(bare, 'slashing', 'test', 200);
    const b = monsterSlice(kitted, 'slashing', 'test', 200);
    expect(a.armor).toBe(0);
    expect(b.armor).toBeCloseTo(20, 10);
    expect(b.resistance).toBeCloseTo(0.5, 10);
    expect(b.dealt).toBeLessThan(a.dealt);
  });
});

describe('attribute emphasis', () => {
  const attrs = { str: 50, dex: 30, con: 40, int: 10, wis: 10, cha: 10 } as Record<AttributeId, number>;
  const total = (a: Record<AttributeId, number>) => ATTRIBUTE_LIST.reduce((s, x) => s + a[x.id], 0);

  it('moves points between attributes and keeps the total', () => {
    const out = biasAttrs(attrs, { int: 3, str: 0.5 });
    expect(total(out)).toBeCloseTo(total(attrs), 8);
    expect(out.int).toBeGreaterThan(attrs.int);
    expect(out.str).toBeLessThan(attrs.str);
  });

  it('treats a missing multiplier as 1, a negative one as 0, and no bias as no change', () => {
    expect(biasAttrs(attrs, {})).toEqual(attrs);
    const out = biasAttrs(attrs, { str: -4 });
    expect(out.str).toBe(0);
    expect(total(out)).toBeCloseTo(total(attrs), 8);
  });
});

describe('a staged member with a kit', () => {
  it('takes the name, the kit and the reach, and comes in wounded as a share of the biased maximum', () => {
    const s = createInitialState(4, HALL);
    const bus = new Game(s).bus;
    startStagedGroup(s, bus, SPOTS[HALL], [
      {
        monsterId: BRUTE,
        level: 30,
        hpShare: 0.5,
        name: 'Tamsin, mage',
        kit: { range: 'ranged', damageType: 'cold', armor: 3 },
        attrBias: { con: 2 },
      },
    ]);
    const e = liveEnemies(s.combat!)[0];
    expect(e.name).toBe('Tamsin, mage');
    expect(e.defId).toBe(BRUTE);
    expect(e.kit).toEqual({ range: 'ranged', damageType: 'cold', armor: 3 });
    expect(e.range).toBe('ranged');
    expect(e.range).toBe(kitOf(e).range);
    const max = monsterStats(e).maxHp;
    expect(e.hp).toBe(Math.round(max * 0.5));
    // CON doubled (then scaled back to keep the total): more health than the book value's.
    const plain = minted(BRUTE, 30);
    expect(max).toBeGreaterThan(statsFromAttrs(plain.attrs).maxHp * 0.9);
  });

  it('a member without one is the species as before', () => {
    const s = createInitialState(4, HALL);
    const bus = new Game(s).bus;
    startStagedGroup(s, bus, SPOTS[HALL], [{ monsterId: BRUTE, level: 30, hpShare: 1 }]);
    const e = liveEnemies(s.combat!)[0];
    expect(e.kit).toBeUndefined();
    expect(e.name).toBe(MONSTERS[BRUTE].name);
    expect(e.range).toBe(MONSTERS[BRUTE].range ?? 'melee');
    expect(e.hp).toBe(monsterStats(e).maxHp);
  });

  it('a melee member is put in front of a ranged one', () => {
    const s = createInitialState(4, HALL);
    const bus = new Game(s).bus;
    startStagedGroup(s, bus, SPOTS[HALL], [
      { monsterId: BRUTE, level: 30, name: 'Back', kit: { range: 'ranged' } },
      { monsterId: BRUTE, level: 30, name: 'Front' },
    ]);
    expect(s.combat!.enemies[0]!.name).toBe('Front');
    expect(s.combat!.enemies[1]!.name).toBe('Back');
  });
});

describe('the kit in a fight', () => {
  it('kit.range ranged: a standing wall stops its blows, which it does not stop for a melee specimen', () => {
    const wall = (g: Game) => () => applyStatus(g.state, g.state, { id: 'kinetic_bulwark', intensity: 1 }, 'test');
    const ranged = stage({ monsterId: BRUTE, level: 30, kit: { range: 'ranged', damageType: 'piercing' } });
    run(ranged.g, 600, () => /blocked by your Kinetic Bulwark/.test(feed(ranged.g)), wall(ranged.g));
    expect(feed(ranged.g)).toMatch(/blocked by your Kinetic Bulwark/);
    expect(feed(ranged.g)).not.toMatch(/hits you for|CRITS you for/);

    const melee = stage({ monsterId: BRUTE, level: 30 });
    run(melee.g, 600, () => /hits you for|CRITS you for/.test(feed(melee.g)), wall(melee.g));
    expect(feed(melee.g)).toMatch(/hits you for|CRITS you for/);
    expect(feed(melee.g)).not.toMatch(/blocked by your Kinetic Bulwark/);
  });

  it('kit.damageType is the type it deals', () => {
    const cold = stage({ monsterId: BRUTE, level: 30, kit: { damageType: 'cold', rotation: [] } });
    run(cold.g, 600, () => /(hits|CRITS) you for \d+ cold/.test(feed(cold.g)));
    expect(feed(cold.g)).toMatch(/(hits|CRITS) you for \d+ cold/);
    expect(feed(cold.g)).not.toMatch(new RegExp(`you for \\d+ ${MONSTERS[BRUTE].damageType}`));
    // …and the trigger subject that reads the front enemy's type reads the kit.
    const combat = cold.g.state.combat!;
    const ctx = { state: cold.g.state, combat, stats: getDerivedStats(cold.g.state) };
    expect(TRIGGER_SUBJECTS['enemy.damageType'].read(ctx)).toBe('cold');
  });

  it('kit.rotation is used over the def’s', () => {
    const own = stage({ monsterId: BRUTE, level: 30, kit: { rotation: [{ technique: 'pocket_sand' }] } });
    run(own.g, 900, () => /moves into/.test(feed(own.g)));
    expect(feed(own.g)).toContain(`moves into ${TECHNIQUES.pocket_sand.name}`);
    for (const entry of MONSTERS[BRUTE].rotation ?? []) {
      if ('technique' in entry && entry.technique !== 'pocket_sand') {
        expect(feed(own.g)).not.toContain(`moves into ${TECHNIQUES[entry.technique].name}`);
      }
    }
  });

  it('a working in a kit rotation is cast', () => {
    const fire = stage({
      monsterId: BRUTE,
      level: 30,
      kit: { rotation: [{ cast: { school: 'arcane', words: ['fire', 'pierce'] } }] },
    });
    run(fire.g, 900, () => /casts Fire Pierce/.test(feed(fire.g)));
    expect(feed(fire.g)).toMatch(/casts Fire Pierce/);
  });

  it('kit.inflicts are its riders, over the def’s', () => {
    expect(MONSTERS[BRUTE].inflicts, 'the brute inflicts nothing of its own').toBeUndefined();
    const stinging = stage({
      monsterId: BRUTE,
      level: 30,
      kit: { rotation: [], inflicts: [{ id: 'bleeding', intensity: 2, chance: 1 }] },
    });
    run(stinging.g, 900, () => hasStatus(stinging.g.state, 'bleeding'));
    expect(hasStatus(stinging.g.state, 'bleeding')).toBe(true);

    const plain = stage({ monsterId: BRUTE, level: 30, kit: { rotation: [] } });
    run(plain.g, 300, () => false);
    expect(hasStatus(plain.g.state, 'bleeding')).toBe(false);
  });

  it('an empty inflicts list removes a def’s riders', () => {
    const def = MONSTERS[GOBLIN];
    expect(def.inflicts?.some((a) => a.id === 'bleeding')).toBe(true);
    const bare = stage({ monsterId: GOBLIN, level: 30, kit: { inflicts: [], rotation: [] } });
    // Many blows at the def's 15% would have landed one by now.
    run(bare.g, 1500, () => false);
    expect(hasStatus(bare.g.state, 'bleeding')).toBe(false);
  });
});
