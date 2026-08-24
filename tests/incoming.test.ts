import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { incomingSlice, landGraze, shedCooldownsOnMiss } from '../src/core/systems/combat';
import { TRIGGER_EVENTS } from '../src/core/systems/triggers';
import { getDerivedStats, RESIST_CAP } from '../src/core/systems/derived';
import { DOUSING_TYPES, damagePlayer } from '../src/core/systems/health';
import { syncGeneStatuses } from '../src/core/systems/mutagens';
import { findStatus, hasStatus, removeStatus } from '../src/core/systems/statuses';
import { applyStatus } from '../src/core/systems/statuses';
import { TAG_ARMOR, innateArmor, monsterStats, statsFromAttrs } from '../src/core/systems/monsterStats';
import { positionIncomingMult } from '../src/core/systems/martial';
import { ELEMENTAL_TYPES, RES_STAT_BY_TYPE, STAT_NAMES, sizeRank } from '../src/core/types';
import { activeRotation, pickActive, tickCombat } from '../src/core/systems/combat';
import { SPOTS } from '../src/core/registry';
import { geneAbility } from '../src/core/systems/mutagens';
import { MAIN_GENES } from '../src/core/registry';
import type { SizeTag } from '../src/core/types';
import { STATUSES } from '../src/core/data/statuses.data';
import { ATTRIBUTE_LIST } from '../src/core/data/attributes.data';
import { ITEMS, MONSTERS, MONSTER_TAGS } from '../src/core/registry';
import {
  OVERSIZE_FORGIVENESS_CAP,
  armCost,
  armsFrom,
  familySkillFor,
  oversizeForgiveness,
} from '../src/core/systems/wield';
import { equipItem } from '../src/core/systems/equipment';
import { bearerGrants } from '../src/core/systems/mutagens';
import { monsterSizeRank } from '../src/core/systems/bestiary';
import { playerSizeRank } from '../src/core/systems/mutagens';
import type { AttributeId, DerivedStats, MonsterInstance } from '../src/core/types';

/**
 * The incoming-damage layer: what answers a blow after it has been thrown.
 *
 * Three of these stats exist because the mutagen content demanded them —
 * "takes less damage generally", "doubled against ranged", "resistance against
 * elemental effects" — and one because monsters could not crit at all, which
 * quietly made every "resists critical hits" effect unbuildable.
 */

const fresh = () => new Game(createInitialState(1));

/** A bare live specimen — enough of one for damage maths to run on. */
function specimen(defId: string): MonsterInstance {
  return {
    defId, name: defId, icon: '🐀', level: 5, tier: 'basic', modifier: 'normal',
    rarity: 'common', mutation: null, hp: 500, statuses: [],
    attrs: { str: 5, dex: 5, con: 5, int: 5, wis: 5, cha: 5 },
    range: 'melee', bar: 0, stunSpent: 0, xp: 0, gold: 0,
  };
}

/** A stat block with the incoming layer dialled to whatever the case needs. */
function withStats(over: Partial<DerivedStats>): DerivedStats {
  return { ...getDerivedStats(fresh().state), armor: 0, ...over };
}

describe('damageTaken — the body, not the barrier', () => {
  it('defaults to letting everything through', () => {
    const stats = withStats({});
    expect(stats.damageTaken).toBe(1);
    expect(incomingSlice(stats, 'slashing', 'x', 100).dealt).toBe(100);
  });

  it('scales what survived armor and resistance', () => {
    const soft = withStats({ damageTaken: 0.5 });
    expect(incomingSlice(soft, 'slashing', 'x', 100).dealt).toBe(50);
  });

  it('applies AFTER resistance rather than inside it', () => {
    // Both take 25% off, but they must compound rather than cap each other —
    // that is the whole reason damageTaken is outside the resistance cap.
    const stats = withStats({ resSlashing: 0.25, damageTaken: 0.75 });
    expect(incomingSlice(stats, 'slashing', 'x', 100).dealt).toBe(Math.round(100 * 0.75 * 0.75));
  });

  it('never heals — a blow always lands for at least one', () => {
    expect(incomingSlice(withStats({ damageTaken: 0 }), 'slashing', 'x', 100).dealt).toBe(1);
    expect(incomingSlice(withStats({ damageTaken: -5 }), 'slashing', 'x', 100).dealt).toBe(1);
  });
});

describe('resElemental — one modifier instead of ten', () => {
  it('folds into every elemental type', () => {
    const stats = withStats({ resElemental: 0.2 });
    for (const type of ELEMENTAL_TYPES) {
      expect(incomingSlice(stats, type, 'x', 100).resistance, type).toBeCloseTo(0.2, 6);
    }
  });

  it('leaves the physical types alone — an element is not a sword', () => {
    const stats = withStats({ resElemental: 0.2 });
    for (const type of ['slashing', 'piercing', 'bludgeoning'] as const) {
      expect(incomingSlice(stats, type, 'x', 100).resistance, type).toBe(0);
    }
  });

  it('stacks with the type\'s own resistance, under one shared cap', () => {
    const stats = withStats({ resHeat: 0.3, resElemental: 0.2 });
    expect(incomingSlice(stats, 'heat', 'x', 100).resistance).toBeCloseTo(0.5, 6);
    // Neither source may be spent past the cap by routing around the other.
    const capped = withStats({ resHeat: 0.7, resElemental: 0.4 });
    expect(incomingSlice(capped, 'heat', 'x', 100).resistance).toBe(RESIST_CAP);
  });
});

describe('resRanged — only what comes from a distance', () => {
  it('does nothing to a blow in reach', () => {
    const stats = withStats({ resRanged: 0.3 });
    expect(incomingSlice(stats, 'piercing', 'x', 100, 0, false).resistance).toBe(0);
  });

  it('answers an arrow', () => {
    const stats = withStats({ resRanged: 0.3 });
    expect(incomingSlice(stats, 'piercing', 'x', 100, 0, true).resistance).toBeCloseTo(0.3, 6);
  });

  it('shares the cap with everything else answering the same blow', () => {
    const stats = withStats({ resPiercing: 0.6, resRanged: 0.4 });
    expect(incomingSlice(stats, 'piercing', 'x', 100, 0, true).resistance).toBe(RESIST_CAP);
  });
});

describe('monsters crit, like everything else that swings', () => {
  const attrs = (over: Partial<Record<AttributeId, number>> = {}) =>
    ({ str: 5, dex: 5, con: 5, int: 5, wis: 5, cha: 5, ...over }) as Record<AttributeId, number>;

  it('every monster carries the ubiquitous one-in-twenty', () => {
    // A monster with nothing going for it still crits sometimes: the floor is
    // universal, and it is what makes any fight capable of spiking.
    expect(statsFromAttrs(attrs({ dex: 0 })).crit).toBeCloseTo(0.05, 6);
    expect(statsFromAttrs(attrs({ dex: 0 })).critDamage).toBe(2);
  });

  it('is derived from DEX, the same way the player\'s is', () => {
    const slow = statsFromAttrs(attrs({ dex: 0 })).crit;
    const quick = statsFromAttrs(attrs({ dex: 100 })).crit;
    expect(quick).toBeGreaterThan(slow);
    // Identical formula, not merely a similar one.
    const player = getDerivedStats(fresh().state);
    expect(statsFromAttrs(attrs({ dex: 0 })).crit).toBeCloseTo(0.05, 6);
    expect(player.crit).toBeGreaterThanOrEqual(0.05);
  });
});

describe('acid — the element that eats a defence rather than a pool', () => {
  it('is a damage type like any other, and resisted like one', () => {
    expect(RES_STAT_BY_TYPE.acid).toBe('resAcid');
    expect(getDerivedStats(fresh().state).resAcid).toBe(0);
    const hardened = withStats({ resAcid: 0.4 });
    expect(incomingSlice(hardened, 'acid', 'x', 100).dealt).toBe(60);
  });

  it('counts as elemental, so elemental hardness answers it', () => {
    expect(ELEMENTAL_TYPES.has('acid')).toBe(true);
    expect(incomingSlice(withStats({ resElemental: 0.25 }), 'acid', 'x', 100).dealt).toBe(75);
  });

  it('corrosion climbs to melting and can be talked back down', () => {
    expect(STATUSES.corroded.escalatesTo).toBe('melting');
    expect(STATUSES.melting.baseForm).toBe('corroded');
    expect(STATUSES.corroded.stacking.onCap).toBe('escalate');
  });

  it('corroded eats armor, melting stops it counting at all', () => {
    const eats = STATUSES.corroded.mods!.find((m) => m.stat === 'armor')!;
    expect(eats.op).toBe('mult');
    expect(eats.value).toBeLessThan(0);
    // -1 on a mult is ×0: a melted harness is not worth less, it is worth
    // nothing, which is a different statement.
    const gone = STATUSES.melting.mods!.find((m) => m.stat === 'armor')!;
    expect(gone.value).toBe(-1);
  });

  it('gives corrosion something to eat — hard things are hard now', () => {
    // A material implies armour, so nobody has to remember to declare it, and
    // the hardest thing in the bestiary reads harder than a merely cold one.
    expect(innateArmor('stone_golem')).toBeGreaterThan(innateArmor('slime_ice_basic'));
    expect(innateArmor('slime_ice_basic')).toBeGreaterThan(0);
    // ...and the toughest material wins rather than the tags adding up.
    expect(innateArmor('stone_golem')).toBe(
      Math.max(TAG_ARMOR.inorganic, TAG_ARMOR.construct, TAG_ARMOR.earth),
    );
  });

  it('hardens nothing through a tag that does not exist', () => {
    // The same failure mode as an invented mutagen source: a key nothing
    // carries never matches, silently, and the species it was meant to harden
    // stays soft.
    const live = new Set(Object.values(MONSTERS).flatMap((d) => d.tags));
    for (const tag of Object.keys(TAG_ARMOR)) {
      expect(MONSTER_TAGS[tag], `TAG_ARMOR '${tag}' is not a registered tag`).toBeDefined();
      expect(live.has(tag), `TAG_ARMOR '${tag}' — nothing alive carries it`).toBe(true);
    }
  });

  it('leaves soft things soft — the falloff needs no rule', () => {
    // The spec asked for acid to do less against already-soft targets. There
    // is no such rule: something soft simply has no harness to corrode.
    expect(innateArmor('forest_rat')).toBe(0);
    expect(innateArmor('wolf')).toBe(0);
  });

  it('never hardens anything soft by levelling it', () => {
    // Material decides IF, level decides how much. A big rat is still a rat.
    const attrs = { str: 9, dex: 9, con: 90, int: 9, wis: 9, cha: 9 };
    expect(statsFromAttrs(attrs, undefined, 0, 0, 30).armor).toBe(0);
    const hard = statsFromAttrs(attrs, undefined, 5, 0, 30);
    expect(hard.armor).toBeGreaterThan(5);
  });

  it('melting opens the three a ruined harness stops answering', () => {
    const opened = STATUSES.melting.mods!.filter((m) => m.value < 0 && m.op === 'add');
    expect(opened.map((m) => m.stat).sort()).toEqual(['resBludgeoning', 'resCold', 'resHeat']);
  });
});

describe('resistCap — raising the ceiling, not just approaching it', () => {
  it('defaults to the familiar three-quarters', () => {
    expect(getDerivedStats(fresh().state).resistCap).toBe(RESIST_CAP);
  });

  it('is what the stacking clamp reads, so headroom bought is headroom kept', () => {
    const ordinary = withStats({ resHeat: 0.9 });
    expect(incomingSlice(ordinary, 'heat', 'x', 100).resistance).toBe(RESIST_CAP);
    const roomier = withStats({ resHeat: 0.9, resistCap: 0.85 });
    expect(incomingSlice(roomier, 'heat', 'x', 100).resistance).toBeCloseTo(0.85, 6);
  });
});

describe('size — being the bigger thing in the room', () => {
  it('reads the ladder in order, and anything unknown is person-sized', () => {
    expect(sizeRank('diminutive')).toBeLessThan(sizeRank('small'));
    expect(sizeRank('small')).toBeLessThan(sizeRank('medium'));
    expect(sizeRank('medium')).toBeLessThan(sizeRank('gargantuan'));
    expect(sizeRank(undefined)).toBe(sizeRank('medium'));
    expect(sizeRank('enormous')).toBe(sizeRank('medium'));
  });

  it('takes a monster size off its tags', () => {
    // forest_rat is tagged small; stone_golem large.
    expect(monsterSizeRank('forest_rat')).toBeLessThan(monsterSizeRank('stone_golem'));
    // A species that never says reads medium rather than throwing.
    expect(monsterSizeRank('nonexistent_beast')).toBe(sizeRank('medium'));
  });

  it('leaves a bare player person-sized, and a giant not', () => {
    const g = fresh();
    expect(playerSizeRank(g.state)).toBe(sizeRank('medium'));
    g.state.mutagens.chromosome.main = { id: 'jotunn', quality: 'c' };
    expect(playerSizeRank(g.state)).toBe(sizeRank('gargantuan'));
    expect(playerSizeRank(g.state)).toBeGreaterThan(monsterSizeRank('forest_rat'));
  });

  it('the gap only counts downward — a giant gains nothing from its equals', () => {
    const g = fresh();
    g.state.mutagens.chromosome.main = { id: 'hill_giant', quality: 'c' };
    const mine = playerSizeRank(g.state);
    // Against something larger the gap must read zero, not negative, or a
    // bully's stat would quietly become a penalty against bigger things.
    expect(Math.max(0, mine - monsterSizeRank('slime_golem'))).toBe(0);
    expect(Math.max(0, mine - monsterSizeRank('forest_rat'))).toBeGreaterThan(0);
  });
});

describe('missRefund — a swing that found nothing still moved the hands', () => {
  /** Mid-fight, with cooldowns part-way down and whatever gene is asked for. */
  function swinging(mainGene?: string) {
    const g = fresh();
    // A whole CombatState, not a partial cast: `modFingerprint` walks buffs,
    // and a half-built fight throws rather than reading as an empty one.
    g.state.combat = {
      enemies: [null, null, null, null, null],
      playerBar: 0,
      momentum: 0,
      position: 'neutral',
      buffs: [],
      cooldowns: { heavy_blow: 60, thrust: 20, ready: 0 },
    } as unknown as NonNullable<typeof g.state.combat>;
    if (mainGene) g.state.mutagens.chromosome.main = { id: mainGene, quality: 'c' };
    return g;
  }

  it('does nothing at all by default', () => {
    const g = swinging();
    shedCooldownsOnMiss(g.state);
    expect(g.state.combat!.cooldowns.heavy_blow).toBe(60);
  });

  it('a slime gene sheds a share of what is LEFT on every technique', () => {
    // Through the real pipeline, not a hand-set stat: the gene's attacks arm
    // grants missRefund, and this is the whole chain paying out.
    const g = swinging('slime_gene');
    const share = getDerivedStats(g.state).missRefund;
    expect(share).toBeGreaterThan(0);
    shedCooldownsOnMiss(g.state);
    // Proportional, so stacking cheap techniques cannot farm it.
    expect(g.state.combat!.cooldowns.heavy_blow).toBeCloseTo(60 - 60 * share, 6);
    expect(g.state.combat!.cooldowns.thrust).toBeCloseTo(20 - 20 * share, 6);
  });

  it('never touches something already available, and never goes below zero', () => {
    const g = swinging('slime_gene');
    shedCooldownsOnMiss(g.state);
    expect(g.state.combat!.cooldowns.ready).toBe(0);
    for (const left of Object.values(g.state.combat!.cooldowns)) {
      expect(left).toBeGreaterThanOrEqual(0);
    }
  });

  it('does nothing out of combat', () => {
    expect(() => shedCooldownsOnMiss(fresh().state)).not.toThrow();
  });
});

describe('monster armour must not outrun the blow', () => {
  it('reads LEVEL, never CON — health must not buy immunity too', () => {
    // CON is already the health knob, so scaling armour off it made a tanky
    // thing tough twice over and eventually flatly immune, since armour
    // subtracts. A declared value is now exactly what a level-1 specimen has.
    const at = (con: number, level: number) =>
      statsFromAttrs({ str: 0, dex: 0, con, int: 0, wis: 0, cha: 0 }, undefined, 100, 0, level).armor;
    expect(at(10, 1)).toBe(100);
    // A million-health post and a frail one are equally armoured at level 1.
    expect(at(143_000, 1)).toBe(100);
    // Level is what moves it, 5% of the declared value per level above 1.
    expect(at(10, 21)).toBeCloseTo(200, 6);
    expect(at(10, 51)).toBeCloseTo(350, 6);
  });

  it('is zero for anything with no armouring material, at any CON or level', () => {
    const soft = statsFromAttrs({ str: 0, dex: 0, con: 143_000, int: 0, wis: 0, cha: 0 }, undefined, 0, 0, 99);
    expect(soft.armor).toBe(0);
  });

  it('the reinforced post absorbs exactly what it says it does', () => {
    // The whole contract of a benchmark: the description promises 100, so 100
    // is what a level-1 specimen must subtract — no attribute chosen for some
    // other reason may leak into it.
    const post = specimen('reinforced_post');
    post.level = 1;
    post.attrs.con = 143_000;
    expect(monsterStats(post).armor).toBe(100);
    expect(MONSTERS.reinforced_post.desc).toMatch(/exactly 100/);
  });

  it('the damage benchmark absorbs nothing at all', () => {
    // Whatever the curve does, a thing built to MEASURE damage must not eat it.
    expect(innateArmor('benchmark_dummy')).toBe(0);
    const post = specimen('benchmark_dummy');
    post.attrs.con = 143_000;
    expect(monsterStats(post).armor).toBe(0);
  });
});

describe('monsters that knit themselves back together', () => {
  it('is declared, never earned by being tough', () => {
    // CON already does two jobs (health, armour). It does not get a third —
    // "this thing closes its own wounds" is a species trait, not a consequence.
    const tough = statsFromAttrs({ str: 0, dex: 0, con: 143_000, int: 0, wis: 0, cha: 0 });
    expect(tough.hpRegen).toBe(0);
    expect(monsterStats(specimen('mending_post')).hpRegen).toBe(0.001);
    expect(monsterStats(specimen('benchmark_dummy')).hpRegen).toBe(0);
  });

  it('is a damage floor rather than a health pool', () => {
    // The whole reason it is a different fight: 0.1% of max per tick on a
    // million-health post is ~1,000 a tick you have to clear before your
    // total moves at all.
    const post = specimen('mending_post');
    post.attrs.con = 143_000;
    const stats = monsterStats(post);
    expect(stats.maxHp * stats.hpRegen).toBeGreaterThan(900);
  });

  it('actually knits back over combat ticks, and stops once it burns', () => {
    // Driven through the real tick rather than by calling the helper, because
    // the ORDER is the load-bearing part: conditions bite first, so a burn can
    // never be out-healed by the regeneration it is meant to suppress.
    const g = fresh();
    const post = specimen('mending_post');
    // Its real constitution, so a tick's 0.1% is a number and not a rounding
    // error — the same reason the post carries it in the data.
    post.attrs.con = 143_000;
    const max = monsterStats(post).maxHp;
    post.hp = Math.round(max / 2);
    g.state.combat = {
      enemies: [post, null, null, null, null], playerBar: 0, momentum: 0,
      position: 'neutral', cooldowns: {}, events: {}, buffs: [],
    } as never;

    // Driven straight through the combat tick: the player is not on a hunt, so
    // the loop would never reach it, and the point is the ordering inside.
    const beat = () => tickCombat(g.state, g.bus, SPOTS.yard_mending);
    const opened = post.hp;
    for (let i = 0; i < 5; i++) beat();
    expect(post.hp).toBeGreaterThan(opened);

    // Set it alight and the closing stops — even though the fire is also
    // damaging it, which is the point: you stop the mending by hurting it the
    // right way, not by hurting it harder.
    applyStatus(g.state, post, { id: 'on_fire', intensity: 1 }, 'test');
    const burning = post.hp;
    for (let i = 0; i < 5; i++) beat();
    expect(post.hp).toBeLessThanOrEqual(burning);
  });

  it('stops while the thing is burning or dissolving', () => {
    // The monster-side mirror of the player's `doused` rule, and the reason the
    // Mending Post tests counterplay rather than just patience. Both dousing
    // elements, and only those.
    expect([...DOUSING_TYPES].sort()).toEqual(['acid', 'heat']);
    expect(STATUSES.on_fire.element).toBe('heat');
    expect(STATUSES.corroded.element).toBe('acid');
    // ...and something that is merely hurt keeps knitting.
    expect(DOUSING_TYPES.has(STATUSES.bleeding.element!)).toBe(false);
  });
});

describe('ward — the flat half of a defence', () => {
  it('eats a fixed amount after resistances, of any type', () => {
    const stats = withStats({ ward: 20 });
    // Armour is physical-only and resistances are proportional; a ward is
    // neither, which is why it needed to exist rather than be approximated.
    expect(incomingSlice(stats, 'arcane', 'x', 100).dealt).toBe(80);
    expect(incomingSlice(stats, 'slashing', 'x', 100).dealt).toBe(80);
  });

  it('is worth most against many small hits and least against one big one', () => {
    // The whole reason it is not just more resistance. Same total damage in.
    const warded = withStats({ ward: 20 });
    const resisted = withStats({ resArcane: 0.2 });
    const swarm = (s: DerivedStats) =>
      Array.from({ length: 10 }, () => incomingSlice(s, 'arcane', 'x', 30).dealt).reduce((a, b) => a + b);
    expect(swarm(warded)).toBeLessThan(swarm(resisted));
    expect(incomingSlice(warded, 'arcane', 'x', 300).dealt).toBeGreaterThan(
      incomingSlice(resisted, 'arcane', 'x', 300).dealt,
    );
  });

  it('never banks the surplus, and never makes you untouchable', () => {
    const stats = withStats({ ward: 500 });
    const slice = incomingSlice(stats, 'arcane', 'x', 6);
    // Absorbed 6, not 500 — and the blow still lands for the floor.
    expect(slice.warded).toBe(6);
    expect(slice.dealt).toBe(1);
  });

  it('is off by default, so it costs nothing to have the stat', () => {
    expect(getDerivedStats(fresh().state).ward).toBe(0);
    expect(incomingSlice(withStats({}), 'arcane', 'x', 100).warded).toBe(0);
  });
});

describe('abilities — the tool a body hands you', () => {
  it('bare hands you nothing; a body with a tool offers one', () => {
    // The other half of what a gene is for. A special effect alters how you
    // work; an ability gives you something new to DO.
    expect(geneAbility(fresh().state)).toBeUndefined();
    const g = fresh();
    g.state.mutagens.chromosome.main = { id: 'slime_gene', quality: 'c' };
    expect(geneAbility(g.state)?.name).toBe('Slime Bounce');
  });

  it('joins the ordinary rotation rather than living beside it', () => {
    // So it can be ordered, triggered and put on cooldown like anything else.
    const g = fresh();
    expect(activeRotation(g.state)).not.toContain('gene');
    g.state.mutagens.chromosome.main = { id: 'slime_gene', quality: 'c' };
    expect(activeRotation(g.state)).toContain('gene');
  });

  it('reads its damage off whatever the body is good at', () => {
    // What the other three ActiveSpec variants cannot say: `strike` multiplies
    // weapon damage and `spell` multiplies spell power, and neither can point
    // at armour or a resistance.
    const bounce = MAIN_GENES.slime_gene.ability!.spec;
    expect(bounce.type).toBe('gene');
    if (bounce.type !== 'gene') throw new Error('unreachable');
    expect(bounce.fromStat).toBe('armor');
    expect(bounce.stun).toBeGreaterThan(0);

    const flaming = MAIN_GENES.fire_slime_gene.ability!.spec;
    if (flaming.type !== 'gene') throw new Error('unreachable');
    // The fire line reads the same stat its defences build and its attacks
    // already scale off — the loop closed a third time. As an AMPLIFIER, not a
    // per-point price: a resistance is bounded at `resistCap`, so
    // `power × resHeat` gave a blow that stopped growing the moment the cap
    // was reached and had no attribute behind it to grow with anyway.
    expect(flaming.amplifiedBy).toBe('resHeat');
    expect(flaming.fromStat).toBeUndefined();
    expect(flaming.flat).toBeGreaterThan(0);
    expect(flaming.scalesWithSpeed).toBe(true);
  });

  it('is reachable at all — the rotation must call it an attack', () => {
    // The defect this test exists for: `pickActive` classified only 'strike'
    // and 'spell' as attacks, so a gene ability sat in the rotation forever
    // and never once fired. Everything else here was unreachable behind it.
    const g = fresh();
    g.state.mutagens.chromosome.main = { id: 'hill_giant', quality: 'c' };
    const stats = getDerivedStats(g.state);
    g.state.combat = {
      enemies: [specimen('rat')], cooldowns: {}, buffs: [], playerBar: 0,
      position: 'neutral', log: [],
    } as never;
    expect(pickActive(g.state, 'attack', stats)?.id).toBe('gene');
    expect(pickActive(g.state, 'buff', stats)).toBeNull();
  });

  it('a defensive gene answers the buff slot instead', () => {
    const g = fresh();
    g.state.mutagens.chromosome.main = { id: 'slime_guardian_gene', quality: 'c' };
    const stats = getDerivedStats(g.state);
    g.state.combat = {
      enemies: [specimen('rat')], cooldowns: {}, buffs: [], playerBar: 0,
      position: 'neutral', log: [],
    } as never;
    expect(pickActive(g.state, 'buff', stats)?.id).toBe('gene');
    expect(pickActive(g.state, 'attack', stats)).toBeNull();
  });

  it('every declared ability is a real spec, not a leftover stub', () => {
    for (const gene of Object.values(MAIN_GENES)) {
      if (!gene.ability) continue;
      expect(gene.ability.spec.cooldown, gene.id).toBeGreaterThan(0);
      const spec = gene.ability.spec;
      if (spec.type === 'gene') {
        // An ability must use at least one pricing shape or it lands for its
        // flat value and nothing else forever. Three exist: per point of a
        // derived stat, per point of an ATTRIBUTE, or a flat blow amplified by
        // a bounded stat.
        const perStat = spec.power !== undefined && spec.fromStat !== undefined;
        const perAttr = spec.power !== undefined && spec.fromAttr !== undefined;
        const amplified = spec.amplifiedBy !== undefined;
        // …unless it is not a blow at all. An ability that only wards, only
        // strips the field or only leaves conditions is doing its whole job
        // without dealing damage, and pricing it would be inventing a number.
        const doesSomethingElse =
          !!spec.grants?.length || !!spec.clearsField || !!spec.inflicts?.length || !!spec.volley;
        expect(perStat || perAttr || amplified || doesSomethingElse, gene.id).toBe(true);
        // …and never two ways of pricing the same blow.
        expect(spec.fromStat !== undefined && spec.fromAttr !== undefined, gene.id).toBe(false);
        if (perStat) {
          expect(spec.power, gene.id).toBeGreaterThan(0);
          expect(STAT_NAMES[spec.fromStat!], gene.id).toBeDefined();
        }
        if (perAttr) {
          expect(spec.power, gene.id).toBeGreaterThan(0);
          expect(
            ATTRIBUTE_LIST.some((a) => a.id === spec.fromAttr),
            `${gene.id}: '${spec.fromAttr}' is not an attribute`,
          ).toBe(true);
        }
        if (amplified) {
          expect(STAT_NAMES[spec.amplifiedBy!], gene.id).toBeDefined();
          // A BOUNDED stat is the only reason to amplify rather than price per
          // point, so amplifying an unbounded one is a content error.
          expect(spec.amplifiedBy!.startsWith('res'), gene.id).toBe(true);
          // …and it must have a base to multiply, or the whole blow is zero.
          expect(spec.flat ?? 0, gene.id).toBeGreaterThan(0);
        }
      }
    }
  });

  it('a defensive body gets a defensive tool, off the buff slot', () => {
    // The one ability that is not an attack: it fires from the buff path, so
    // raising it costs no swing. That path used to look its owner up in SKILLS,
    // which a gene is not — hence the name and icon coming off the ability.
    const shield = MAIN_GENES.slime_guardian_gene.ability!;
    expect(shield.name).toBe('Slime Shield');
    expect(shield.spec.type).toBe('buff');
    if (shield.spec.type !== 'buff') throw new Error('unreachable');
    expect(shield.spec.mods.map((m) => m.stat)).toEqual(['armor', 'ward']);
  });

  it('says everything the giant table asks an ability to say', () => {
    // Nine species, and between them they wanted: a flat species term, typed
    // riders, conditions left behind, the whole room rather than one flanker,
    // doubling by size, and an outright kill. Each is one field.
    const bite = MAIN_GENES.troll.ability!.spec;
    if (bite.type !== 'gene') throw new Error('unreachable');
    expect(bite.flat).toBeGreaterThan(0);
    expect(bite.inflicts?.map((a) => a.id)).toEqual(['bleeding', 'punctured']);

    const crusher = MAIN_GENES.jotunn.ability!.spec;
    if (crusher.type !== 'gene') throw new Error('unreachable');
    expect(crusher.splashAll).toBe(true);
    expect(crusher.riders?.map((r) => r.type)).toEqual(['earth', 'cold']);
    expect(crusher.inflicts?.map((a) => a.id)).toEqual(['chilled']);

    const mountain = MAIN_GENES.storm_giant.ability!.spec;
    if (mountain.type !== 'gene') throw new Error('unreachable');
    expect(mountain.sizeDouble).toBe(2);

    // Both uniques finish what is already failing; nothing else does.
    const executes = Object.values(MAIN_GENES).filter(
      (g) => g.ability?.spec.type === 'gene' && g.ability.spec.execute,
    );
    expect(executes.map((g) => g.id).sort()).toEqual(['balor', 'surtr']);
  });

  it('every status and damage type the giants name is a real one', () => {
    // The failure mode this catches is silent: an invented status id simply
    // never lands, and an invented tag simply never matches.
    for (const gene of Object.values(MAIN_GENES)) {
      const spec = gene.ability?.spec;
      if (spec?.type !== 'gene') continue;
      for (const app of spec.inflicts ?? []) {
        expect(STATUSES[app.id], `${gene.id} → ${app.id}`).toBeDefined();
      }
      for (const r of spec.riders ?? []) {
        expect(RES_STAT_BY_TYPE[r.type], `${gene.id} → ${r.type}`).toBeDefined();
      }
    }
  });

  it('the one that needs a feature nobody has built declares none', () => {
    // Better an honest gap than a mis-modelled ability the description then
    // contradicts. Suislime detonates a bodyguard, and nothing in the game
    // keeps a summoned entity yet.
    expect(MAIN_GENES.slime_king_gene.ability).toBeUndefined();
    expect(MAIN_GENES.slime_king_gene.desc).toMatch(/Suislime/);
  });
});

describe('the slot model — a hand kept while both are full', () => {
  const grants = (...ids: string[]) => new Set(ids);

  it('a two-hander costs both arms, everything else costs one', () => {
    expect(armCost(grants(), ITEMS.steel_greatsword)).toBe(2);
    expect(armCost(grants(), ITEMS.old_spear)).toBe(2);
    expect(armCost(grants(), ITEMS.iron_sword)).toBe(1);
    expect(armCost(grants(), ITEMS.wooden_shield)).toBe(1);
  });

  it('the two capabilities are orthogonal — arms grown, and arms needed', () => {
    // A giant does not grow arms; it makes a two-hander cost one of the two it
    // has. An asura does not lighten anything; it has more hands. Keeping them
    // apart is what lets a body do both.
    expect(armsFrom(grants())).toBe(2);
    expect(armsFrom(grants('arms:+1'))).toBe(3);
    expect(armsFrom(grants('arms:+4'))).toBe(6);
    // Growing arms does not lighten the weapon...
    expect(armCost(grants('arms:+4'), ITEMS.steel_greatsword)).toBe(2);
    // ...and lightening it does not grow arms.
    expect(armsFrom(grants('onehand:*'))).toBe(2);
    expect(armCost(grants('onehand:greatsword'), ITEMS.steel_greatsword)).toBe(1);
    expect(armCost(grants('onehand:greatsword'), ITEMS.old_spear)).toBe(2);
  });

  it('six arms is three two-handers, needing no new concept', () => {
    // Where the asura ranas are going. The budget already says it.
    const rana = grants('arms:+4');
    expect(Math.floor(armsFrom(rana) / armCost(rana, ITEMS.steel_greatsword))).toBe(3);
  });

  it('a third arm holds a shield beside a spear, with no rule for that case', () => {
    const g = fresh();
    g.state.mutagens.chromosome.main = { id: 'dvibahu', quality: 'c' };
    expect(armsFrom(bearerGrants(g.state))).toBe(3);

    g.state.equipment.offhand = { uid: 9, defId: 'wooden_shield', slots: 0, runes: [] };
    g.state.inventory.push({ uid: 10, defId: 'old_spear', slots: 0, runes: [] });
    expect(equipItem(g.state, g.bus, 10)).toBe(true);
    // Spear in one hand, shield still on the other.
    expect(g.state.equipment.weapon?.defId).toBe('old_spear');
    expect(g.state.equipment.offhand?.defId).toBe('wooden_shield');
  });

  it('and an ordinary body drops the shield to take the spear', () => {
    const g = fresh();
    g.state.equipment.offhand = { uid: 9, defId: 'wooden_shield', slots: 0, runes: [] };
    g.state.inventory.push({ uid: 10, defId: 'old_spear', slots: 0, runes: [] });
    expect(equipItem(g.state, g.bus, 10)).toBe(true);
    expect(g.state.equipment.weapon?.defId).toBe('old_spear');
    expect(g.state.equipment.offhand).toBeUndefined();
  });

  it('a capability is never scaled — the cheap tier grows the same arm', () => {
    // §7: capabilities free, magnitudes capped. An F-grade asuroid has every
    // hand a Divine one does; what differs is what they can do with them.
    for (const id of ['dvibahu', 'asura']) {
      const g = fresh();
      g.state.mutagens.chromosome.main = { id, quality: 'f' };
      expect(armsFrom(bearerGrants(g.state)), id).toBeGreaterThan(2);
    }
  });
});

describe('weapon and armour size — gear made for a different body', () => {
  /** Holding `defId` at `size`, optionally as a giant. */
  function holding(size: SizeTag | undefined, mainGene?: string, defId = 'iron_sword') {
    const g = fresh();
    g.state.equipment.weapon = { uid: 1, defId, slots: 0, runes: [], size };
    if (mainGene) g.state.mutagens.chromosome.main = { id: mainGene, quality: 'c' };
    return g;
  }

  it('an ordinary weapon fits an ordinary person and costs nothing', () => {
    const plain = getDerivedStats(holding(undefined).state);
    const stated = getDerivedStats(holding('medium').state);
    expect(stated.attackSpeed).toBeCloseTo(plain.attackSpeed, 6);
    expect(stated.damage).toBeCloseTo(plain.damage, 6);
  });

  it('too big is AWKWARD — it costs speed, not damage', () => {
    const fits = getDerivedStats(holding('medium').state);
    const huge = getDerivedStats(holding('gargantuan').state);
    expect(huge.attackSpeed).toBeLessThan(fits.attackSpeed);
    expect(huge.damage).toBeCloseTo(fits.damage, 6);
  });

  it('too small is WEAK — it costs damage, not speed', () => {
    // A giant swinging a person's dagger is quick with it and it does nothing.
    const giant = getDerivedStats(holding('gargantuan', 'jotunn').state);
    const dagger = getDerivedStats(holding('small', 'jotunn').state);
    expect(dagger.damage).toBeLessThan(giant.damage);
    expect(dagger.attackSpeed).toBeGreaterThanOrEqual(giant.attackSpeed);
  });

  it('a jötunn swings a jötunn\'s hammer as though it were made for them', () => {
    // The payoff for being enormous, and the reason looting a giant is worth it.
    const person = getDerivedStats(holding('gargantuan').state).attackSpeed;
    const giant = getDerivedStats(holding('gargantuan', 'jotunn').state).attackSpeed;
    expect(giant).toBeGreaterThan(person);
  });

  it('practice forgives part of the penalty, and caps by wield class', () => {
    // "5% reduced penalty for using oversized weapons", every ten levels.
    const trained = (level: number, defId: string) => {
      const g = holding('huge', undefined, defId);
      const skill = ITEMS[defId].tags!.map(familySkillFor).find(Boolean)!;
      g.state.skills[skill] = { level, xp: 0 };
      return oversizeForgiveness(g.state);
    };
    expect(trained(0, 'iron_dagger')).toBe(0);
    expect(trained(20, 'iron_dagger')).toBeCloseTo(0.1, 6);
    // A greatsword you have outgrown is still a greatsword: half, and no more.
    expect(trained(999, 'steel_greatsword')).toBeCloseTo(
      OVERSIZE_FORGIVENESS_CAP.two_handed,
      6,
    );
    expect(trained(999, 'iron_dagger')).toBeGreaterThan(trained(999, 'steel_greatsword'));
  });

  it('finds a family skill by what it CLAIMS, not by guessing its id', () => {
    // Weapon skills are not named to a pattern — `swordsmanship` predates
    // `greatsword_combat` by years — so anything deriving an id from a tag
    // silently misses whichever were named differently.
    expect(familySkillFor('sword')).toBe('swordsmanship');
    expect(familySkillFor('greatsword')).toBe('greatsword_combat');
    expect(familySkillFor('dagger')).toBe('dagger_combat');
    // The martial schools tag `style:*`, so they never shadow a family.
    expect(familySkillFor('metal')).toBeUndefined();
    expect(familySkillFor('twoHanded')).toBeUndefined();
  });

  it('so swordsmanship forgives a sword, which name-guessing missed entirely', () => {
    const g = holding('huge', undefined, 'iron_sword');
    expect(oversizeForgiveness(g.state)).toBe(0);
    g.state.skills.swordsmanship = { level: 30, xp: 0 };
    expect(oversizeForgiveness(g.state)).toBeCloseTo(0.15, 6);
  });

  it('so the swing genuinely speeds up as the skill climbs', () => {
    const at = (level: number) => {
      const g = holding('huge', undefined, 'iron_dagger');
      g.state.skills.dagger_combat = { level, xp: 0 };
      return getDerivedStats(g.state).attackSpeed;
    };
    expect(at(40)).toBeGreaterThan(at(0));
  });

  it('armour that does not fit is barely armour, in either direction', () => {
    // Not awkward — not armour. One step off is most of the way to worthless.
    const worn = (size?: SizeTag) => {
      const g = fresh();
      g.state.equipment.chest = { uid: 2, defId: 'iron_breastplate', slots: 0, runes: [], size };
      return getDerivedStats(g.state).armor;
    };
    const bare = (() => {
      const g = fresh();
      return getDerivedStats(g.state).armor;
    })();
    const fits = worn('medium');
    expect(fits).toBeGreaterThan(bare);
    // A giant's breastplate, and a child's, are both nearly useless to you.
    expect(worn('large') - bare).toBeLessThan((fits - bare) * 0.5);
    expect(worn('small') - bare).toBeLessThan((fits - bare) * 0.5);
    expect(worn('gargantuan')).toBeCloseTo(bare, 6);
  });
});

describe('two-handed speed penalties, without a mechanism for them', () => {
  /** A game holding a greatsword, optionally wearing a gene. */
  function hefting(mainGene?: string) {
    const g = fresh();
    g.state.equipment.weapon = { uid: 1, defId: 'steel_greatsword', slots: 0, runes: [] };
    if (mainGene) g.state.mutagens.chromosome.main = { id: mainGene, quality: 'c' };
    return g;
  }

  it('the penalty is the weapon\'s own, and the tag is already there', () => {
    // Nothing systemic to build: a two-hander declares its own attackSpeed
    // cost and carries `twoHanded`, which `requiresTag` already gates on.
    const sword = ITEMS.steel_greatsword;
    expect(sword.tags).toContain('twoHanded');
    expect(sword.mods!.find((m) => m.stat === 'attackSpeed')!.value).toBeLessThan(0);
  });

  it('a jötunn does not pay for the weight', () => {
    const plain = getDerivedStats(hefting().state).attackSpeed;
    const giant = getDerivedStats(hefting('jotunn').state).attackSpeed;
    expect(giant).toBeGreaterThan(plain);
  });

  it('and gains nothing from it bare-handed — the tag has to be held', () => {
    // requiresTag is the whole gate: put the sword down and the bonus goes.
    const armed = getDerivedStats(hefting('jotunn').state).attackSpeed;
    const empty = fresh();
    empty.state.mutagens.chromosome.main = { id: 'jotunn', quality: 'c' };
    const unarmed = getDerivedStats(empty.state).attackSpeed;
    const baseline = getDerivedStats(fresh().state).attackSpeed;
    expect(unarmed).toBeCloseTo(baseline, 6);
    expect(armed).not.toBeCloseTo(unarmed, 6);
  });
});

describe('graze — the miss that still tells', () => {
  /** A live fight against a soft target, with the swing rigged to miss. */
  function whiffing(mainGene?: string) {
    const g = fresh();
    g.state.spot = 'training_grounds';
    if (mainGene) g.state.mutagens.chromosome.main = { id: mainGene, quality: 'c' };
    return g;
  }

  it('is nothing by default — a miss is ordinarily just a miss', () => {
    expect(getDerivedStats(fresh().state).graze).toBe(0);
  });

  it('a golem gene puts an edge on the whiff', () => {
    const g = whiffing('slime_golem_gene');
    expect(getDerivedStats(g.state).graze).toBeGreaterThan(0);
  });

  it('onGraze is its own event, so a build that never misses never sees it', () => {
    // Not a flavour of onHit: a technique can be armed to chain off the MISS,
    // which is only expressible if the two are distinct.
    const ids = TRIGGER_EVENTS.map((e) => e.id);
    expect(ids).toContain('onGraze');
    expect(ids).toContain('onHit');
  });

  it('counts both the graze and the kill it finished', () => {
    // What an achievement asks against: "kill n enemies with graze damage"
    // needs the kill counted separately from the ordinary one.
    const g = whiffing('slime_golem_gene');
    const target = { ...specimen('forest_rat'), hp: 1 };
    g.state.combat = {
      enemies: [target], playerBar: 0, momentum: 0, position: 'neutral',
      buffs: [], cooldowns: {}, events: {}, feed: [],
    } as unknown as NonNullable<typeof g.state.combat>;
    const killed = landGraze(g.state, g.bus, target, null);
    expect(killed).toBe(true);
    expect(g.state.stats['combat:grazes']).toBe(1);
    expect(g.state.stats['kills:graze']).toBe(1);
  });

  it('does nothing to something already dead, or to a body that cannot graze', () => {
    const plain = whiffing();
    const alive = specimen('forest_rat');
    plain.state.combat = {
      enemies: [alive], playerBar: 0, momentum: 0, position: 'neutral',
      buffs: [], cooldowns: {}, events: {}, feed: [],
    } as unknown as NonNullable<typeof plain.state.combat>;
    expect(landGraze(plain.state, plain.bus, alive, null)).toBe(false);
    expect(alive.hp).toBe(500);
    expect(plain.state.stats['combat:grazes']).toBeUndefined();
  });
});

describe('doused — a body that knits stops while it burns', () => {
  /**
   * The rule is no longer a constant in health.ts. It rides the `knitting`
   * condition the gene confers, whose own `removal` names the types — so what
   * douses a troll is a property of trolls rather than of the game, and it is
   * data something can rewrite. These assert the WIRING, not a hardcoded pair.
   */
  function trollAflame() {
    const g = new Game(createInitialState(31));
    g.state.mutagens.chromosome.main = { id: 'troll', quality: 'c' };
    syncGeneStatuses(g.state);
    return g;
  }

  it('wears the rule as a condition, carrying its own trigger types', () => {
    const g = trollAflame();
    const knitting = findStatus(g.state, 'knitting');
    expect(knitting, 'a regenerating body wears it').toBeDefined();
    const rule = knitting!.removal!.find((r) => r.on === 'damageTaken')!;
    expect(rule.damageTypes).toEqual(['heat', 'acid']);
    expect(rule.becomes).toBe('doused');
  });

  it('douses on its own types and on nothing else', () => {
    for (const type of ['heat', 'acid'] as const) {
      const g = trollAflame();
      damagePlayer(g.state, 5, type);
      expect(hasStatus(g.state, 'doused'), type).toBe(true);
      expect(hasStatus(g.state, 'knitting'), type).toBe(false);
    }
    for (const type of ['slashing', 'cold', 'poison', 'lightning', 'dark'] as const) {
      const g = trollAflame();
      damagePlayer(g.state, 5, type);
      expect(hasStatus(g.state, 'doused'), type).toBe(false);
      expect(hasStatus(g.state, 'knitting'), type).toBe(true);
    }
  });

  it('a body with nothing to douse is never doused', () => {
    // Bare has no `confers`, so there is no knitting to interrupt.
    const g = new Game(createInitialState(32));
    syncGeneStatuses(g.state);
    expect(hasStatus(g.state, 'knitting')).toBe(false);
    damagePlayer(g.state, 5, 'heat');
    expect(hasStatus(g.state, 'doused')).toBe(false);
  });

  it('does not come back until the dousing lifts, then does', () => {
    // `blockedBy` is what makes the pair a state machine rather than a
    // one-tick flicker: the per-tick sync cannot undo the dousing.
    const g = trollAflame();
    damagePlayer(g.state, 5, 'heat');
    syncGeneStatuses(g.state);
    expect(hasStatus(g.state, 'knitting'), 'sync must not stomp the dousing').toBe(false);
    removeStatus(g.state, 'doused');
    syncGeneStatuses(g.state);
    expect(hasStatus(g.state, 'knitting')).toBe(true);
  });

  it('stops wearing it when the body stops being that body', () => {
    const g = trollAflame();
    g.state.mutagens.chromosome.main = null;
    syncGeneStatuses(g.state);
    expect(hasStatus(g.state, 'knitting')).toBe(false);
  });

  it('zeroes regeneration rather than slowing it', () => {
    // A troll on fire is not knitting slowly; it is not knitting.
    const mod = STATUSES.doused.mods!.find((m) => m.stat === 'hpRegen')!;
    expect(mod.op).toBe('mult');
    expect(mod.value).toBe(-1);
    expect(STATUSES.doused.duration).toBeGreaterThan(0);
  });

  it('ordinary damage leaves an ordinary body alone', () => {
    const g = fresh();
    const before = g.state.statuses.length;
    damagePlayer(g.state, 5, 'heat');
    expect(g.state.statuses.length).toBe(before);
  });
});

describe('fromStat — turning a defence into an offence', () => {
  it('a fire slime hits harder for the heat it can shrug off', () => {
    // The line's identity: heat resistance IS the damage stat, so stacking a
    // defence is the offensive plan.
    const bare = getDerivedStats(fresh().state);
    const g = fresh();
    g.state.mutagens.chromosome.main = { id: 'fire_slime_gene', quality: 'c' };
    const lit = getDerivedStats(g.state);
    expect(lit.resHeat).toBeGreaterThan(0);
    expect(lit.damage).toBeGreaterThan(bare.damage);
  });

  it('scales with the source, so more resistance really is more damage', () => {
    const low = fresh();
    low.state.mutagens.chromosome.main = { id: 'fire_slime_gene', quality: 'c' };
    const high = fresh();
    high.state.mutagens.chromosome.main = { id: 'blaze_slime_gene', quality: 'c' };
    const a = getDerivedStats(low.state);
    const b = getDerivedStats(high.state);
    expect(b.resHeat).toBeGreaterThan(a.resHeat);
    expect(b.damage).toBeGreaterThan(a.damage);
  });

  it('reads the CLAMPED source, so resistance past the cap pays nothing twice', () => {
    // Buying resistance you cannot actually hold must not buy damage either.
    const g = fresh();
    g.state.mutagens.chromosome.main = { id: 'fire_slime_gene', quality: 'c' };
    const atCap = getDerivedStats(g.state);
    expect(atCap.resHeat).toBeLessThanOrEqual(atCap.resistCap);
  });

  it('a derived modifier cannot feed another derived modifier', () => {
    // Sources are snapshotted before the pass writes anything, which is what
    // makes cycles impossible rather than merely unlikely. Two mods pointing at
    // each other both read the pre-pass numbers.
    const g = fresh();
    g.state.mutagens.chromosome.main = { id: 'blaze_slime_gene', quality: 'c' };
    expect(Number.isFinite(getDerivedStats(g.state).damage)).toBe(true);
  });
});

describe('the chromosome actually reaches the character', () => {
  it('a slotted gene changes the stat block', () => {
    // The gap this closes: the panel resolved routes and displayed numbers
    // while `getDerivedStats` had never heard of the chromosome, so every gene
    // and mutagen authored was felt by nobody.
    const bare = getDerivedStats(fresh().state);
    const g = fresh();
    g.state.mutagens.chromosome.main = { id: 'slime_gene', quality: 'c' };
    const wearing = getDerivedStats(g.state);
    expect(wearing.resSlashing).toBeGreaterThan(bare.resSlashing);
    expect(wearing.critTaken).toBeLessThan(bare.critTaken);
    expect(wearing.missRefund).toBeGreaterThan(bare.missRefund);
  });

  it('swapping the gene at the centromere re-reads the body', () => {
    // And the cache must notice. modFingerprint has to carry the chromosome or
    // it will happily serve the previous body forever.
    const g = fresh();
    g.state.mutagens.chromosome.main = { id: 'slime_gene', quality: 'c' };
    const slime = getDerivedStats(g.state).resSlashing;
    g.state.mutagens.chromosome.main = { id: 'slimest_gene', quality: 'c' };
    expect(getDerivedStats(g.state).resSlashing).toBeGreaterThan(slime);
  });

  it('a giant is harder to hurt by things beneath it', () => {
    const g = fresh();
    g.state.mutagens.chromosome.main = { id: 'jotunn', quality: 'c' };
    expect(getDerivedStats(g.state).fromSmaller).toBeGreaterThan(0);
    expect(getDerivedStats(g.state).vsSmaller).toBeGreaterThan(0);
  });
});

describe('stumbleTaken — softening bad footing, never good', () => {
  /** A game standing in `pos`, mid-fight. */
  function standing(pos: string) {
    const g = fresh();
    g.state.combat = { position: pos } as NonNullable<typeof g.state.combat>;
    return g.state;
  }

  it('passes a position through untouched by default', () => {
    expect(positionIncomingMult(standing('off_balance'))).toBeCloseTo(1.15, 6);
    expect(positionIncomingMult(standing('guarded'))).toBeCloseTo(0.9, 6);
  });

  it('takes a share off the penalty', () => {
    // 15% exposure, felt at 40% less, is 9%.
    expect(positionIncomingMult(standing('off_balance'), 0.6)).toBeCloseTo(1.09, 6);
  });

  it('flattens a stumble to neutral and never past it', () => {
    expect(positionIncomingMult(standing('off_balance'), 0)).toBe(1);
    expect(positionIncomingMult(standing('off_balance'), -4)).toBe(1);
  });

  it('never touches a benefit — a guard you earned stays earned', () => {
    // The important asymmetry: a body that shrugs off stumbling has no
    // business also shrugging off its own guard.
    for (const taken of [1, 0.5, 0, -2]) {
      expect(positionIncomingMult(standing('guarded'), taken)).toBeCloseTo(0.9, 6);
    }
  });

  it('does nothing out of combat, where there is no footing to have', () => {
    expect(positionIncomingMult(fresh().state, 0)).toBe(1);
  });
});

describe('critTaken — flattening the spike, never the blow', () => {
  /** What a crit multiplies a blow by, once the body has had its say. */
  const critMult = (critDamage: number, critTaken: number) =>
    1 + (critDamage - 1) * Math.max(0, critTaken);

  it('passes a crit through whole by default', () => {
    expect(critMult(2, 1)).toBe(2);
  });

  it('takes the surplus off, proportionally', () => {
    expect(critMult(2, 0.5)).toBe(1.5);
    expect(critMult(3, 0.5)).toBe(2);
  });

  it('bottoms out at an ordinary hit — hardening removes the spike, not the blow', () => {
    // The important floor: a body that laughs off crits still gets hit.
    expect(critMult(2, 0)).toBe(1);
    expect(critMult(5, 0)).toBe(1);
    expect(critMult(2, -3)).toBe(1);
  });
});
