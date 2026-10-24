// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import {
  FLOORS,
  MONSTERS,
  SPOTS,
  STATUSES,
  TIERS,
  TITLES,
  getSpot,
} from '../src/core/registry';
import {
  ELEMENTAL_TYPES,
  RES_STAT_BY_TYPE,
  type MonsterDef,
  type StatusDef,
  type TitleDef,
} from '../src/core/types';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { getDerivedStats } from '../src/core/systems/derived';
import {
  APPLICATION_FLOOR,
  applyStatus,
  conditionResistance,
  findStatus,
  hasStatus,
  removeStatus,
  resistBlock,
  tickStatuses,
} from '../src/core/systems/statuses';
import {
  MONSTER_ACTION_BAR,
  NO_PENETRATION_THROUGH_FLOOR,
  monsterDamageResistance,
  monsterPenetration,
  monsterStats,
  penetrationOf,
  penetrationProblems,
} from '../src/core/systems/monsterStats';
import { castMonsterWorking, healEnemy, incomingSlice, monsterSlice, spawnMonster, tickCombat } from '../src/core/systems/combat';
import { harmOf, isHarmful, resistanceProblems } from '../src/core/systems/conditionHarm';
import { grantGraded } from '../src/core/systems/disciplines';
import { SPOILED, SPOILED_EATEN_KEY, isSpoiledFood, useConsumable } from '../src/core/systems/consumables';
import { hasTitle } from '../src/core/systems/titles';
import { qualityMult } from '../src/core/data/quality.data';
import { specForSource } from '../src/core/systems/spellcraft';

const fresh = (seed = 1) => new Game(createInitialState(seed));

/** Run `body` with extra conditions registered, then remove them. */
function withStatuses(extra: Record<string, StatusDef>, body: () => void) {
  Object.assign(STATUSES, extra);
  try {
    body();
  } finally {
    for (const id of Object.keys(extra)) delete STATUSES[id];
  }
}

/** Run `body` with an extra species registered, then remove it. */
function withSpecies(def: MonsterDef, body: () => void) {
  MONSTERS[def.id] = def;
  try {
    body();
  } finally {
    delete MONSTERS[def.id];
  }
}

const aStatus = (patch: Partial<StatusDef>): StatusDef => ({
  id: 'test_status',
  name: 'Test Status',
  icon: '🧪',
  desc: 'Test-only.',
  stacking: { mode: 'highest' },
  duration: 600,
  ...patch,
});

/** A stat block with every resistance, and the elemental bonus, far past 100%. */
const WALLED = {
  ...Object.fromEntries(Object.values(RES_STAT_BY_TYPE).map((key) => [key, 5])),
  resElemental: 5,
} as Record<string, number>;

const monsterOf = (g: Game, defId: string) => {
  const m = spawnMonster(g.state, getSpot('woods_edge'));
  m.defId = defId;
  return m;
};

// ---------- No resistance, by design ----------

describe('unresistable conditions', () => {
  const MARKED = [
    'fasting',
    'flat_footed',
    'surprised',
    'toll_steam',
    'toll_ice',
    'toll_overdrive',
    'doused',
    'psionic_compression',
    'psionic_read',
    'unfolded',
  ];

  it('exactly these ten are marked, each with a reason', () => {
    const marked = Object.values(STATUSES).filter((d) => d.unresistable);
    expect(marked.map((d) => d.id).sort()).toEqual([...MARKED].sort());
    for (const def of marked) expect(def.unresistable!.trim().length, def.id).toBeGreaterThan(0);
  });

  it('every harmful condition has an element or is marked, never both', () => {
    for (const def of Object.values(STATUSES).filter(isHarmful)) {
      expect(!!def.element !== !!def.unresistable, `${def.id} (${harmOf(def)})`).toBe(true);
    }
  });

  it('lands in full on a player whose every resistance is far past 100%', () => {
    // The control first: the same block turns an ordinary condition away.
    const control = fresh(3);
    expect(applyStatus(control.state, control.state, { id: 'poison', intensity: 1 }, 'a fang', WALLED)).toBeNull();
    for (const id of MARKED) {
      const g = fresh(3);
      const landed = applyStatus(g.state, g.state, { id, intensity: 1 }, 'test', WALLED);
      expect(landed, id).not.toBeNull();
      expect(landed!.intensity, id).toBeCloseTo(1);
    }
  });

  it('lands in full on a monster whose every resistance is far past 100%', () => {
    const wall: MonsterDef = {
      ...MONSTERS.goblin,
      id: 'test_wall',
      resistances: Object.fromEntries(Object.keys(RES_STAT_BY_TYPE).map((t) => [t, 5])),
    };
    withSpecies(wall, () => {
      const g = fresh(4);
      const m = monsterOf(g, 'test_wall');
      expect(applyStatus(g.state, m, { id: 'poison', intensity: 1 }, 'a fang')).toBeNull();
      for (const id of MARKED) {
        removeStatus(m, id);
        const landed = applyStatus(g.state, m, { id, intensity: 1 }, 'test');
        expect(landed, id).not.toBeNull();
        expect(landed!.intensity, id).toBeCloseTo(1);
      }
    });
  });

  it('the readout says so, and reads nothing for a buff', () => {
    const g = fresh(5);
    expect(conditionResistance(g.state, STATUSES.surprised)).toEqual({
      kind: 'unresistable',
      reason: STATUSES.surprised.unresistable,
    });
    expect(conditionResistance(g.state, STATUSES.steady_hand)).toEqual({ kind: 'none' });
  });
});

// ---------- The totality lint ----------

describe('resistanceProblems: who can resist what', () => {
  const lint = (extra: Record<string, StatusDef> = {}, titles: Record<string, TitleDef> = {}) =>
    resistanceProblems({ ...STATUSES, ...extra }, { ...TITLES, ...titles }).map((p) => p.message);

  it('the live content is clean', () => {
    expect(lint()).toEqual([]);
  });

  it('refuses a harmful condition that names neither an element nor unresistable', () => {
    const bare = aStatus({ id: 'test_bare', dot: { type: 'poison', flat: 0.1 } });
    expect(lint({ test_bare: bare })).toEqual([
      "'test_bare' harms its bearer (dot) but has neither an element to be resisted by nor unresistable: say which",
    ]);
    // Either answer clears it.
    expect(lint({ test_bare: { ...bare, element: 'poison' } })).toEqual([]);
    expect(lint({ test_bare: { ...bare, unresistable: 'state: a test' } })).toEqual([]);
  });

  it('refuses both at once', () => {
    const both = aStatus({ id: 'test_both', element: 'heat', unresistable: 'a test' });
    expect(lint({ test_both: both })).toEqual([
      "'test_both' has both an element (heat) and unresistable ('a test'): it is resisted or it is not",
    ]);
  });

  it('refuses a mark on a condition that harms no one, and an empty reason', () => {
    expect(lint({ test_buff: aStatus({ id: 'test_buff', unresistable: 'a test' }) })).toEqual([
      "'test_buff' is marked unresistable but harms no one: remove the mark",
    ]);
    expect(
      lint({ test_empty: aStatus({ id: 'test_empty', dot: { type: 'poison', flat: 0.1 }, unresistable: '  ' }) }),
    ).toEqual(["'test_empty' has an empty unresistable: give the reason in a few words"]);
  });

  it('refuses an immunity that would switch an unresistable condition off', () => {
    const wall = aStatus({ id: 'test_wall', immune: { ids: ['toll_ice', 'poison'] } });
    expect(lint({ test_wall: wall })).toEqual([
      "immune names 'toll_ice', which is unresistable: nothing may switch it off",
    ]);
    const stomach: TitleDef = {
      id: 'test_title', name: 'T', icon: 'T', desc: '', unlock: [], immune: { ids: ['fasting'] },
    };
    expect(lint({}, { test_title: stomach })).toEqual([
      "immune names 'fasting', which is unresistable: nothing may switch it off",
    ]);
    // A resistible condition is a fair target for a title, and an element is not a name.
    expect(lint({}, { test_title: { ...stomach, immune: { ids: ['queasy'], elements: ['poison'] } } })).toEqual([]);
  });

  it('names the entry and where in it, for the forge', () => {
    const problems = resistanceProblems({ ...STATUSES, x: aStatus({ id: 'x', element: 'heat', unresistable: 'a test' }) });
    expect(problems).toEqual([
      expect.objectContaining({ kind: 'status', id: 'x', path: ['unresistable'] }),
    ]);
  });
});

// ---------- Queasy, overgrowth, proliferating ----------

describe('queasy, overgrowth and proliferating are resisted through poison', () => {
  /** Poison resistance of 0.5 on whoever wears it, by the cooking buff built for it. */
  const steeped = (g: Game, target: Game['state'] | ReturnType<typeof monsterOf>, intensity: number) => {
    applyStatus(g.state, target, { id: 'steeped', intensity }, 'test');
  };

  it('carry the poison element', () => {
    for (const id of ['queasy', 'overgrowth', 'proliferating']) {
      expect(STATUSES[id].element, id).toBe('poison');
      expect(STATUSES[id].unresistable, id).toBeUndefined();
    }
  });

  it('queasy lands thinned by poison resistance and not at all at 100%', () => {
    const g = fresh(10);
    expect(applyStatus(g.state, g.state, { id: SPOILED, intensity: 1 }, 'a meal', { resPoison: 0.4 })!.intensity).toBeCloseTo(0.6);
    const sealed = fresh(10);
    expect(applyStatus(sealed.state, sealed.state, { id: SPOILED, intensity: 1 }, 'a meal', { resPoison: 1 })).toBeNull();
  });

  it('refuse-grade food is thinned by poison resistance, because it is done to the eater', () => {
    const eatSour = (poisonRes: number) => {
      const g = fresh(11);
      if (poisonRes > 0) steeped(g, g.state, poisonRes / 0.25);
      grantGraded(g.state, 'hearty_stew', 'f', 1);
      useConsumable(g.state, g.bus, 'hearty_stew', 'f');
      return findStatus(g.state, SPOILED)?.intensity ?? 0;
    };
    const bare = eatSour(0);
    expect(bare).toBeCloseTo(-qualityMult('f'));
    expect(eatSour(0.5)).toBeCloseTo(bare * 0.5);
    expect(eatSour(1)).toBe(0);
  });

  it('the Scorched Mess, which grants Queasy outright, is thinned the same way', () => {
    const eatMess = (poisonRes: number) => {
      const g = fresh(12);
      if (poisonRes > 0) steeped(g, g.state, poisonRes / 0.25);
      grantGraded(g.state, 'scorched_mess', 'c', 1);
      useConsumable(g.state, g.bus, 'scorched_mess', 'c');
      return findStatus(g.state, SPOILED)?.intensity ?? 0;
    };
    expect(eatMess(0)).toBe(1);
    expect(eatMess(0.5)).toBeCloseTo(0.5);
    expect(eatMess(1)).toBe(0);
  });

  it('nourishment is still not resisted: a dish’s own grants land in full', () => {
    const eat = (poisonRes: number) => {
      const g = fresh(13);
      if (poisonRes > 0) steeped(g, g.state, poisonRes / 0.25);
      grantGraded(g.state, 'hearty_stew', 'c', 1);
      useConsumable(g.state, g.bus, 'hearty_stew', 'c');
      return findStatus(g.state, 'well_fed')!.intensity;
    };
    expect(eat(0.9)).toBeCloseTo(eat(0));
  });

  /** A whole, living pair in a fight, so forced healing has somewhere to go. */
  function arena(defId: string) {
    const g = fresh(14);
    g.state.spot = 'woods_edge';
    const a = spawnMonster(g.state, SPOTS.woods_edge);
    a.defId = defId;
    g.state.combat = {
      enemies: [a, null, null, null, null],
      playerBar: 0, momentum: 0, position: 'neutral', cooldowns: {}, buffs: [], events: {},
    };
    a.hp = monsterStats(a).maxHp;
    return { g, a };
  }

  it('overgrowth lands thinned on a poison-resistant monster, and its escalation is not billed again', () => {
    const { g, a } = arena('goblin');
    steeped(g, a, 2);
    const res = monsterStats(a).resistances.poison;
    expect(res).toBeGreaterThan(0.5);
    expect(res).toBeLessThan(0.9);
    const maxHp = monsterStats(a).maxHp;

    healEnemy(g.state, 0, maxHp * 0.3, 'test');
    const swollen = findStatus(a, 'overgrowth')!;
    expect(swollen.intensity).toBeCloseTo(1 - res, 8);

    // Past half its max HP in surplus it becomes proliferating. That is a
    // transformation, not a fresh dose: the intensity carries over untaxed
    // (a second tax would leave (1 − res)², far less).
    healEnemy(g.state, 0, maxHp * 0.3, 'test');
    expect(findStatus(a, 'overgrowth')).toBeUndefined();
    const proliferating = findStatus(a, 'proliferating')!;
    expect(proliferating.intensity).toBeCloseTo(1 - res, 8);
    expect(proliferating.data!.surplus).toBeCloseTo(maxHp * 0.6, 3);
  });

  it('a monster at 100% poison resistance cannot be overgrown, though forced healing still heals', () => {
    const wall: MonsterDef = { ...MONSTERS.goblin, id: 'test_poison_wall', resistances: { poison: 1 } };
    withSpecies(wall, () => {
      const { g, a } = arena('test_poison_wall');
      const maxHp = monsterStats(a).maxHp;
      a.hp = Math.round(maxHp / 2);
      healEnemy(g.state, 0, maxHp * 0.25, 'test');
      expect(a.hp).toBeGreaterThan(Math.round(maxHp / 2));
      expect(hasStatus(a, 'overgrowth')).toBe(false);
      // The caster's penetration opens the line, as it does for any condition.
      a.hp = maxHp;
      healEnemy(g.state, 0, maxHp * 0.25, 'test', true, 0.2);
      expect(findStatus(a, 'overgrowth')!.intensity).toBeCloseTo(APPLICATION_FLOOR);
    });
  });
});

// ---------- Iron Stomach ----------

describe('Iron Stomach: eating enough spoiled food makes Queasy stop landing', () => {
  /** Eat one of something at a grade; the counter and the title follow. */
  function eat(g: Game, id: string, quality: Parameters<typeof grantGraded>[2]) {
    grantGraded(g.state, id, quality, 1);
    return useConsumable(g.state, g.bus, id, quality);
  }

  it('is a hidden title that confers an immunity rather than a stat', () => {
    const title = TITLES.iron_stomach;
    expect(title.secret).toBe(true);
    expect(title.immune).toEqual({ ids: ['queasy'] });
    expect(title.passive).toBeUndefined();
    expect(title.unlock).toEqual([{ type: 'stat', key: SPOILED_EATEN_KEY, value: 25 }]);
  });

  it('counts refuse-grade dishes and the Scorched Mess, and nothing else', () => {
    const g = fresh(20);
    eat(g, 'hearty_stew', 'c');
    expect(g.state.stats[SPOILED_EATEN_KEY] ?? 0).toBe(0);
    eat(g, 'hearty_stew', 'f');
    expect(g.state.stats[SPOILED_EATEN_KEY]).toBe(1);
    // The Scorched Mess at an ordinary grade, and at refuse grade (once, not twice).
    eat(g, 'scorched_mess', 'c');
    expect(g.state.stats[SPOILED_EATEN_KEY]).toBe(2);
    eat(g, 'scorched_mess', 'f');
    expect(g.state.stats[SPOILED_EATEN_KEY]).toBe(3);
    // A refuse-grade salve makes you ill too, but it is not a dish.
    eat(g, 'healing_salve', 'f');
    expect(g.state.stats[SPOILED_EATEN_KEY]).toBe(3);
    expect(isSpoiledFood({ food: true, grants: [{ id: SPOILED }] }, 1)).toBe(true);
    expect(isSpoiledFood({ grants: [{ id: SPOILED }] }, 1)).toBe(false);
  });

  it('earns the title on the 25th and refuses Queasy from then on', () => {
    const g = fresh(21);
    for (let i = 0; i < 24; i++) eat(g, 'scorched_mess', 'c');
    expect(g.state.stats[SPOILED_EATEN_KEY]).toBe(24);
    expect(hasTitle(g.state, 'iron_stomach')).toBe(false);
    expect(hasStatus(g.state, SPOILED)).toBe(true);

    eat(g, 'hearty_stew', 'f');
    expect(hasTitle(g.state, 'iron_stomach')).toBe(true);
    expect(g.state.log.some((l) => l.msg.includes('Iron Stomach'))).toBe(true);

    // A held Queasy stays (immunity refuses applications only); new doses do not land.
    removeStatus(g.state, SPOILED);
    const result = eat(g, 'scorched_mess', 'c')!;
    expect(hasStatus(g.state, SPOILED)).toBe(false);
    expect(result.granted).toEqual([]);
    // ...and the meal is still counted.
    expect(g.state.stats[SPOILED_EATEN_KEY]).toBe(26);
  });

  it('refuses nothing but Queasy', () => {
    const g = fresh(22);
    g.state.stats[SPOILED_EATEN_KEY] = 24;
    eat(g, 'scorched_mess', 'c');
    expect(hasTitle(g.state, 'iron_stomach')).toBe(true);
    removeStatus(g.state, SPOILED);
    expect(applyStatus(g.state, g.state, { id: SPOILED, intensity: 1 }, 'a meal', {})).toBeNull();
    expect(applyStatus(g.state, g.state, { id: 'poison', intensity: 1 }, 'a fang', {})).not.toBeNull();
    // Without the title the same dose lands.
    const other = fresh(22);
    expect(applyStatus(other.state, other.state, { id: SPOILED, intensity: 1 }, 'a meal', {})).not.toBeNull();
  });

  it('is the player’s alone: a monster has no titles', () => {
    const g = fresh(23);
    g.state.titles.push('iron_stomach');
    const goblin = monsterOf(g, 'goblin');
    expect(applyStatus(g.state, goblin, { id: SPOILED, intensity: 1 }, 'a meal')).not.toBeNull();
  });

  it('shows in the readout as an immunity', () => {
    const g = fresh(24);
    g.state.titles.push('iron_stomach');
    const stats = getDerivedStats(g.state);
    expect(conditionResistance(g.state, STATUSES.queasy, stats)).toMatchObject({ kind: 'resisted', immune: true });
    expect(conditionResistance(g.state, STATUSES.poison, stats)).toMatchObject({ kind: 'resisted', immune: false });
  });
});

// ---------- Ticks read the damage path ----------

describe('a condition’s damage ticks shed what a blow of the same type would', () => {
  const ctx = { hp: 100, maxHp: 100, inCombat: true };
  /** A body with no tags and no declared resistances, to put one thing on at a time. */
  const plain = (id: string, patch: Partial<MonsterDef> = {}): MonsterDef => ({
    ...MONSTERS.goblin,
    id,
    tags: [],
    resistances: undefined,
    ...patch,
  });
  /**
   * The condition is put on directly: a dose is thinned on arrival by the same
   * resistance, and these tests are about the ticks that follow.
   */
  const give = (m: ReturnType<typeof monsterOf>, id: string) =>
    m.statuses.push({ id, intensity: 1, peak: 1, stacks: 1, ticksLeft: null, data: {} });
  /** What one tick of a held condition deals, by condition. */
  const tickOf = (g: Game, m: ReturnType<typeof monsterOf>, id: string) =>
    tickStatuses(g.state, m, ctx).hits.find((h) => h.id === id)?.amount ?? 0;

  it('a monster’s resistance comes from its tags, not only from what its def declares', () => {
    // Slimes shed slashing by their material (TAG_RESISTANCES). The old tick
    // read only the declared value, so a bleed on a plain slime bit in full.
    withSpecies(plain('test_slime', { tags: ['slime'] }), () => {
      withSpecies(plain('test_bare'), () => {
        const g = fresh(30);
        const slime = monsterOf(g, 'test_slime');
        const bare = monsterOf(g, 'test_bare');
        expect(monsterStats(slime).resistances.slashing).toBeCloseTo(0.5);
        give(slime, 'bleeding');
        give(bare, 'bleeding');
        // 0.08 flat + 0.15 of 100 current HP = 0.23 a tick, before resistance.
        expect(tickOf(g, bare, 'bleeding')).toBeCloseTo(0.23, 8);
        expect(tickOf(g, slime, 'bleeding')).toBeCloseTo(0.115, 8);
      });
    });
  });

  it('elemental resistance counts for the elemental types, as it does for a blow', () => {
    const hardened = aStatus({ id: 'test_hardened', mods: [{ stat: 'resElemental', op: 'add', value: 0.4 }] });
    withStatuses({ test_hardened: hardened }, () => {
      withSpecies(plain('test_bare', { resistances: { poison: 0.2, slashing: 0.2 } }), () => {
        const g = fresh(31);
        const m = monsterOf(g, 'test_bare');
        give(m, 'poison');
        give(m, 'bleeding');
        expect(tickOf(g, m, 'poison')).toBeCloseTo(0.05 * 0.8, 8);
        expect(tickOf(g, m, 'bleeding')).toBeCloseTo(0.23 * 0.8, 8);
        give(m, 'test_hardened');
        // Poison is elemental: 0.2 + 0.4. Slashing is not, so the bonus never reaches a bleed.
        expect(tickOf(g, m, 'poison')).toBeCloseTo(0.05 * 0.4, 8);
        expect(tickOf(g, m, 'bleeding')).toBeCloseTo(0.23 * 0.8, 8);
      });
    });
  });

  it('is the figure monsterSlice stacks, for every type and a spread of bodies', () => {
    const hardened = aStatus({ id: 'test_hardened', mods: [{ stat: 'resElemental', op: 'add', value: 0.3 }] });
    withStatuses({ test_hardened: hardened }, () => {
      const g = fresh(32);
      for (const defId of ['goblin', 'slime_golem', 'death_knight', 'slime_fire', 'slime_ice_basic', 'forest_rat']) {
        const m = monsterOf(g, defId);
        for (const wearing of [false, true]) {
          if (wearing) applyStatus(g.state, m, { id: 'test_hardened', intensity: 1 }, 'test');
          for (const type of Object.keys(RES_STAT_BY_TYPE) as (keyof typeof RES_STAT_BY_TYPE)[]) {
            expect(monsterDamageResistance(m, type), `${defId}/${type}/${wearing}`).toBeCloseTo(
              monsterSlice(m, type, 'test', 100).resistance,
              10,
            );
          }
        }
      }
    });
  });

  it('the player’s block stacks resElemental on the elemental types and holds the body’s cap', () => {
    const block = resistBlock({ resPoison: 0.5, resSlashing: 0.5, resElemental: 0.1, resistCap: 0.75 });
    expect(block.poison).toBeCloseTo(0.6);
    expect(block.slashing).toBeCloseTo(0.5); // not elemental
    expect(ELEMENTAL_TYPES.has('slashing')).toBe(false);
    expect(resistBlock({ resPoison: 0.7, resElemental: 0.2, resistCap: 0.75 }).poison).toBeCloseTo(0.75);
    // A body built to hold more holds more.
    expect(resistBlock({ resPoison: 0.7, resElemental: 0.2, resistCap: 0.95 }).poison).toBeCloseTo(0.9);
    // Vulnerability passes through untouched.
    expect(resistBlock({ resSlashing: -0.5, resistCap: 0.75 }).slashing).toBeCloseTo(-0.5);
  });

  it('is the figure incomingSlice stacks for the real player, every type', () => {
    const warding = aStatus({
      id: 'test_warding',
      mods: [
        { stat: 'resPoison', op: 'add', value: 0.5 },
        { stat: 'resSlashing', op: 'add', value: 0.3 },
        { stat: 'resElemental', op: 'add', value: 0.4 },
      ],
    });
    withStatuses({ test_warding: warding }, () => {
      const g = fresh(33);
      applyStatus(g.state, g.state, { id: 'test_warding', intensity: 1 }, 'test');
      const stats = getDerivedStats(g.state);
      const block = resistBlock(stats);
      for (const type of Object.keys(RES_STAT_BY_TYPE) as (keyof typeof block)[]) {
        expect(block[type], type).toBeCloseTo(incomingSlice(stats, type, 'test', 100).resistance, 10);
      }
      // 0.5 + 0.4 would be 0.9; the cap holds it at 0.75, as it does a blow.
      expect(block.poison).toBeCloseTo(0.75);
    });
  });
});

// ---------- Monster penetration ----------

describe('monster penetration', () => {
  /** Poison resistance of 1.1 on the player, before the cap that holds the stat at 0.75. */
  const ironblood = aStatus({
    id: 'test_ironblood',
    duration: null,
    removal: [{ on: 'combatEnd', effect: 'remove' }],
    mods: [{ stat: 'resPoison', op: 'add', value: 1.1 }],
  });

  it('resolves to the species’ own value, else its tier’s, else none', () => {
    expect(penetrationOf({ tier: 'basic' })).toBe(0);
    expect(penetrationOf({ tier: 'ancient' })).toBe(TIERS.ancient.penetration);
    expect(TIERS.ancient.penetration).toBeCloseTo(0.15);
    expect(penetrationOf({ tier: 'ancient', penetration: 0 })).toBe(0);
    expect(penetrationOf({ tier: 'basic', penetration: 0.3 })).toBe(0.3);
    expect(penetrationOf({ tier: 'nonsense' as never })).toBe(0);
    const g = fresh(40);
    expect(monsterPenetration(monsterOf(g, 'goblin'))).toBe(0);
    expect(monsterPenetration({ ...monsterOf(g, 'goblin'), defId: 'no_such_species' })).toBe(0);
  });

  it('is zero for everything that can appear on floors 1 to 3 (live content)', () => {
    const early = new Set(
      Object.values(FLOORS).filter((f) => f.index <= NO_PENETRATION_THROUGH_FLOOR).map((f) => f.areaId),
    );
    const seen = new Set<string>();
    for (const spot of Object.values(SPOTS)) {
      if (!early.has(spot.areaId)) continue;
      for (const enc of spot.encounters ?? []) {
        for (const id of [enc.monsterId, ...(MONSTERS[enc.monsterId]?.escorts ?? [])]) seen.add(id);
      }
    }
    // The set is not empty (a lint over nothing proves nothing), and it holds the elite boss.
    expect(seen.size).toBeGreaterThan(8);
    expect(seen).toContain('puppet_bureaucrat');
    for (const id of seen) expect(penetrationOf(MONSTERS[id]), id).toBe(0);
  });

  describe('the lint', () => {
    const lint = (
      monsters: Record<string, MonsterDef> = MONSTERS,
      tiers = TIERS,
      spots = SPOTS,
    ) => penetrationProblems(monsters, tiers, spots, FLOORS).map((p) => p.message);

    it('is clean on the live content', () => {
      expect(lint()).toEqual([]);
    });

    it('refuses a species on an early floor with penetration of its own', () => {
      const monsters = { ...MONSTERS, puppet_bureaucrat: { ...MONSTERS.puppet_bureaucrat, penetration: 0.1 } };
      const problems = lint(monsters);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain("'puppet_bureaucrat' appears on");
      expect(problems[0]).toContain('f3_');
      expect(problems[0]).toContain('penetration 0.1');
    });

    it('refuses a tier that gives one to what is already there', () => {
      // Raise elite and the floor 3 boss (an elite) trips; nothing else does.
      const tiers = { ...TIERS, elite: { ...TIERS.elite, penetration: 0.15 } };
      const problems = penetrationProblems(MONSTERS, tiers, SPOTS, FLOORS);
      expect(problems.map((p) => p.monster)).toEqual(['puppet_bureaucrat']);
      // ...and an explicit 0 on the species is the fix.
      const fixed = { ...MONSTERS, puppet_bureaucrat: { ...MONSTERS.puppet_bureaucrat, penetration: 0 } };
      expect(penetrationProblems(fixed, tiers, SPOTS, FLOORS)).toEqual([]);
    });

    it('refuses a new species placed on an early floor, through an encounter or an escort', () => {
      const spotId = 'f2_hall_1';
      const spot = SPOTS[spotId];
      expect(spot, 'a floor 2 spot').toBeTruthy();
      const ancient = { ...MONSTERS.goblin, id: 'test_ancient', tier: 'ancient' as const, escorts: ['test_escort'] };
      const escort = { ...MONSTERS.goblin, id: 'test_escort', tier: 'ancient' as const };
      const monsters = { ...MONSTERS, test_ancient: ancient, test_escort: escort };
      const spots = {
        ...SPOTS,
        [spotId]: { ...spot, encounters: [...(spot.encounters ?? []), { monsterId: 'test_ancient', weight: 1, level: [1, 1] as [number, number] }] },
      };
      expect(penetrationProblems(monsters, TIERS, spots, FLOORS).map((p) => p.monster).sort()).toEqual([
        'test_ancient',
        'test_escort',
      ]);
    });

    it('lets the same species stand elsewhere, and refuses a value that is not a share', () => {
      // The ironyard is off the early floors; an ancient may live there.
      const monsters = { ...MONSTERS, goblin: { ...MONSTERS.goblin, tier: 'ancient' as const } };
      expect(lint(monsters)).toEqual([]);
      const wrong = { ...MONSTERS, goblin: { ...MONSTERS.goblin, penetration: 1.5 } };
      expect(lint(wrong)).toEqual(["'goblin' has penetration 1.5: it is a share, 0 to 1"]);
    });
  });

  it('opens the immunity line, and only the line: a dose below it is unchanged', () => {
    withStatuses({ test_ironblood: ironblood }, () => {
      const g = fresh(41);
      applyStatus(g.state, g.state, { id: 'test_ironblood', intensity: 1 }, 'test');
      const stats = getDerivedStats(g.state);
      expect(applyStatus(g.state, g.state, { id: 'poison', intensity: 1 }, 'a fang', stats, 0)).toBeNull();
      // 1.1 − 0.2 = 0.9: no longer immune, and the dose is the floor's, not thinner.
      const landed = applyStatus(g.state, g.state, { id: 'poison', intensity: 1 }, 'a fang', stats, 0.2);
      expect(landed!.intensity).toBeCloseTo(APPLICATION_FLOOR);
    });
    // Below the line penetration changes nothing at all.
    const g = fresh(42);
    const half = applyStatus(g.state, g.state, { id: 'bleeding', intensity: 1 }, 'a claw', { resSlashing: 0.5 }, 0.4);
    expect(half!.intensity).toBeCloseTo(0.5);
  });

  /**
   * A fight against one foe of a throwaway species with the given penetration
   * (absent = the tier's), with the player wearing the 1.1 poison resistance.
   */
  function duel(penetration: number | undefined, body: (g: Game, foe: ReturnType<typeof monsterOf>) => void) {
    const species: MonsterDef = {
      ...MONSTERS.goblin,
      id: 'test_biter',
      inflicts: [{ id: 'poison', intensity: 1 }],
      ...(penetration === undefined ? {} : { penetration }),
    };
    withStatuses({ test_ironblood: ironblood }, () => {
      withSpecies(species, () => {
        const g = fresh(43);
        g.state.spot = 'woods_edge';
        const foe = spawnMonster(g.state, SPOTS.woods_edge);
        foe.defId = 'test_biter';
        g.state.combat = {
          enemies: [foe, null, null, null, null],
          playerBar: 0, momentum: 0, position: 'neutral', cooldowns: {}, buffs: [], events: {},
        };
        applyStatus(g.state, g.state, { id: 'test_ironblood', intensity: 1 }, 'test');
        body(g, foe);
      });
    });
  }

  it('a monster’s bite carries its penetration into the player’s immunity test', () => {
    const bite = (penetration: number | undefined) => {
      let held: ReturnType<typeof findStatus>;
      duel(penetration, (g, foe) => {
        const maxHp = getDerivedStats(g.state).maxHp;
        let bitten = false;
        for (let i = 0; i < 400 && !bitten && g.state.combat; i++) {
          g.state.resources.hp = maxHp;
          foe.hp = 1e9;
          foe.bar = MONSTER_ACTION_BAR;
          g.state.totalTicks += 1;
          tickCombat(g.state, g.bus, SPOTS.woods_edge);
          bitten = (g.state.stats['combat:hitsTaken'] ?? 0) > 0;
        }
        expect(bitten, 'the foe landed a blow').toBe(true);
        held = findStatus(g.state, 'poison');
      });
      return held!;
    };
    // Basic tier, none of its own: the player's 1.1 turns the venom away.
    expect(bite(undefined)).toBeUndefined();
    // The same species with penetration 0.2 gets through, at the floor.
    expect(bite(0.2)!.intensity).toBeCloseTo(APPLICATION_FLOOR);
  });

  it('a monster’s working carries it too, on the strike’s rider', () => {
    const words = ['venom', 'cut'];
    const spec = specForSource({ school: 'arcane', words });
    expect(spec.strikes.flatMap((s) => s.inflicts ?? []).some((a) => a.id === 'poison')).toBe(true);
    // The rider rolls (60%), so cast enough times for a landing to be certain
    // in practice, and count how many of them got past the player's resistance.
    const landings = (penetration: number | undefined) => {
      let count = 0;
      duel(penetration, (g, foe) => {
        const maxHp = getDerivedStats(g.state).maxHp;
        for (let i = 0; i < 40; i++) {
          removeStatus(g.state, 'poison');
          g.state.resources.hp = maxHp;
          castMonsterWorking(g.state, g.bus, foe, monsterStats(foe), { school: 'arcane', words }, 99);
          if (hasStatus(g.state, 'poison')) count++;
        }
      });
      return count;
    };
    expect(landings(undefined)).toBe(0);
    expect(landings(0.2)).toBeGreaterThan(0);
  });
});
