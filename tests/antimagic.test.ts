import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { ARCANE_WORDS } from '../src/core/data/spellcraft.data';
import {
  ARCANE_UNDO_PER_UNIT,
  MATCH_FIRST,
  UNDO_BASE,
  UNDO_PER_TIER,
  composeArcane,
  counterEfficiency,
  matchCeiling,
  parseSentence,
} from '../src/core/systems/arcane';
import {
  addSpell,
  isUtilityWorking,
  resolveSpellFor,
  specForSource,
  undoWorking,
  workingSignature,
} from '../src/core/systems/spellcraft';
import {
  castCraftedAttack,
  castMonsterWorking,
  pickActive,
  spawnMonster,
  tickCombat,
} from '../src/core/systems/combat';
import { readyableSpell } from '../src/core/systems/martial';
import { applyStatus, findStatus } from '../src/core/systems/statuses';
import { mindInDebt, monsterMind, monsterStats } from '../src/core/systems/monsterStats';
import { resourceValue, setResource } from '../src/core/systems/resources';
import { getDerivedStats } from '../src/core/systems/derived';
import { MONSTERS, SPOTS } from '../src/core/registry';
import { TRIGGER_EVENTS, TRIGGER_SUBJECTS } from '../src/core/systems/triggers';
import type { CraftedSpell } from '../src/core/types';

/**
 * Anti-magic: `undo`, `with`, and counterspells as traps.
 *
 * The efficiency formula is the user's (2026-09-28): 20% for undo, +7.5% per
 * further undo tier, +5% per arcane tier, and a match bonus whose ceiling
 * rises with every tier of tuning while what each tier is worth falls —
 * fire:1 +10%, fire:2 +18% (9% each), fire:3 and lightning:2 ~+32% (~6.4%
 * each). Uncapped: past 100% the working is gone and the burn keeps climbing.
 */

const fresh = (seed = 1) => new Game(createInitialState(seed));
const eff = (words: string[], against: string[]) =>
  counterEfficiency(composeArcane(words)!.counter!, workingSignature(composeArcane(against)!));

// ---------- The grammar ----------

describe('undo — a counterspell as the grammar composes it', () => {
  it('an undoing is a counterspell, never a blow', () => {
    const spec = composeArcane(['undo'])!;
    expect(spec.counter).toEqual({ tiers: 1, tuning: {}, burn: 1 });
    expect(spec.strikes).toEqual([]);
    expect(spec.heal).toBeUndefined();
    // With nobody casting there is nothing for it to spring on.
    expect(isUtilityWorking(spec)).toBe(false);
  });

  it('deepening buys efficiency: 20%, 27.5%, 35%', () => {
    const base = (words: string[]) => counterEfficiency(composeArcane(words)!.counter!, {}).efficiency;
    expect(base(['undo'])).toBeCloseTo(UNDO_BASE, 10);
    expect(base(['undo:2'])).toBeCloseTo(0.275, 10);
    expect(base(['undo', 'undo', 'undo'])).toBeCloseTo(0.35, 10);
    expect(UNDO_PER_TIER).toBe(0.075);
    // A mastered "unsay" is the same spell as "undo undo", as ever.
    expect(composeArcane(['undo:2'])).toEqual(composeArcane(['undo', 'undo']));
  });

  it('deepened undoings pay the grammar’s usual bargain: more mana, slower', () => {
    const [one, two, three] = [['undo'], ['undo:2'], ['undo:3']].map((w) => composeArcane(w)!);
    expect(two.manaCost).toBeGreaterThan(one.manaCost);
    expect(three.manaCost).toBeGreaterThan(two.manaCost);
    expect(three.cooldown).toBeGreaterThan(one.cooldown);
  });

  it('arcane answers everything, 5% a tier — and matches arcane like any element', () => {
    // Against a fire working, arcane cannot match; it still pays its 5% a tier.
    const vsFire = eff(['arcane:3', 'undo'], ['fire', 'pierce']);
    expect(vsFire.arcane).toBeCloseTo(3 * ARCANE_UNDO_PER_UNIT, 10);
    expect(vsFire.match).toBe(0);
    expect(vsFire.efficiency).toBeCloseTo(0.35, 10);
    // Against an arcane working it is BOTH: the universal 5% and a match.
    const vsArcane = eff(['arcane', 'undo'], ['arcane', 'pierce']);
    expect(vsArcane.efficiency).toBeCloseTo(0.2 + 0.05 + 0.1, 10);
  });

  it('the match ceiling climbs with every tier tuned while each tier is worth less', () => {
    expect(matchCeiling(1)).toBeCloseTo(MATCH_FIRST, 10);
    expect(matchCeiling(2)).toBeCloseTo(0.18, 10);
    for (let n = 1; n < 24; n++) {
      expect(matchCeiling(n + 1), `ceiling at ${n + 1}`).toBeGreaterThan(matchCeiling(n));
      expect(matchCeiling(n + 1) / (n + 1), `per tier at ${n + 1}`).toBeLessThan(matchCeiling(n) / n);
    }
  });

  it('the worked examples: fire:1 +10%, fire:2 +18% at 9% each, fire:3 and lightning:2 ~+33%', () => {
    expect(eff(['fire', 'undo'], ['fire', 'pierce']).match).toBeCloseTo(0.1, 10);
    const two = eff(['fire:2', 'undo'], ['fire:2', 'pierce']);
    expect(two.match).toBeCloseTo(0.18, 10);
    expect(two.perUnit).toBeCloseTo(0.09, 10);
    const five = eff(['undo', 'with', 'fire:3', 'with', 'spark:2'], ['fire:3', 'pierce', 'with', 'spark:2']);
    expect(five.tuned).toBe(5);
    expect(five.matched).toBe(5);
    expect(five.match).toBeGreaterThan(0.3);
    expect(five.match).toBeLessThan(0.35);
    expect(five.perUnit).toBeGreaterThan(0.06);
    expect(five.perUnit).toBeLessThan(0.07);
  });

  it('a perfect match is not required — but tuning deeper than the working pays for tiers that find nothing', () => {
    // frost against plain fire: nothing. Blaze against plain fire: one tier
    // of three matches, and it is worth a third of blaze's ceiling.
    expect(eff(['ice:2', 'undo'], ['fire', 'pierce']).match).toBe(0);
    const overTuned = eff(['fire:3', 'undo'], ['fire', 'pierce']);
    expect(overTuned.matched).toBe(1);
    expect(overTuned.efficiency).toBeLessThan(eff(['fire', 'undo'], ['fire', 'pierce']).efficiency);
    // A broad tuning answers more things, each less well than a specialist.
    const broad = eff(['undo', 'with', 'fire', 'with', 'ice'], ['fire', 'pierce']);
    const narrow = eff(['fire', 'undo'], ['fire', 'pierce']);
    expect(broad.efficiency).toBeGreaterThan(UNDO_BASE);
    expect(broad.efficiency).toBeLessThan(narrow.efficiency);
  });

  it('uncapped: efficiency passes 100% and keeps counting', () => {
    const counter = composeArcane(['undo:3', 'with', 'arcane:3', 'with', 'arcane:3', 'with', 'arcane:3'])!.counter!;
    const reading = counterEfficiency(counter, { arcane: 9 });
    expect(reading.efficiency).toBeGreaterThan(1.2);
  });

  it('zero is nothing to tune against, and nothing to match', () => {
    expect(composeArcane(['zero', 'undo'])!.counter!.tuning).toEqual({});
    expect(workingSignature(composeArcane(['zero', 'pierce'])!)).toEqual({});
  });

  it('the rest of the grammar speaks to the burn: leading, weight, volume', () => {
    // Noun-led undoes harder than verb-led, as a noun-led blow hits harder.
    expect(composeArcane(['fire', 'undo'])!.counter!.burn).toBeGreaterThan(
      composeArcane(['undo', 'fire'])!.counter!.burn,
    );
    // Leading "twice" lays the burn twice; trailing folds it into one deeper.
    expect(composeArcane(['twice', 'undo'])!.counter!.burns).toBe(2);
    expect(composeArcane(['undo', 'twice'])!.counter!.burn).toBeCloseTo(2, 10);
  });

  it('an undoing breaks a strike chain, the way a mending does', () => {
    const spec = composeArcane(['fire', 'pierce', 'undo', 'then', 'ice', 'pierce'])!;
    expect(spec.counter).toBeDefined();
    expect(spec.strikes).toHaveLength(2);
    expect(spec.strikes[1].followUp).toBeUndefined();
  });
});

describe('with — accompaniment', () => {
  it('undo with X with Y is ONE answer tuned two ways', () => {
    const spec = composeArcane(['undo', 'with', 'fire', 'with', 'ice'])!;
    expect(spec.counter!.tuning).toEqual({ heat: 1, cold: 1 });
    expect(spec.counter!.tiers).toBe(1);
    expect(spec.strikes).toEqual([]);
  });

  it('lent to a blow: its riders ride along, the blow’s nature and weight untouched', () => {
    const plain = composeArcane(['fire', 'pierce'])!.strikes[0];
    const lent = composeArcane(['fire', 'pierce', 'with', 'venom'])!;
    expect(lent.strikes).toHaveLength(1);
    expect(lent.strikes[0].type).toBe('heat');
    expect(lent.strikes[0].power).toBeCloseTo(plain.power, 10);
    expect(lent.strikes[0].inflicts!.map((a) => a.id)).toEqual(['on_fire', 'poison']);
  });

  it('zero with venom stays nothing — and poisons', () => {
    const strike = composeArcane(['zero', 'pierce', 'with', 'venom'])!.strikes[0];
    expect(strike.untyped).toBe(true);
    expect(strike.inflicts!.map((a) => a.id)).toEqual(['poison']);
  });

  it('lent to a ward: one more coat, against its own element, at 75%', () => {
    const mods = composeArcane(['fire', 'ward', 'with', 'ice'])!.buff!.mods;
    const heat = mods.find((m) => m.stat === 'resHeat')!.value;
    const cold = mods.find((m) => m.stat === 'resCold')!.value;
    expect(cold).toBeCloseTo(heat * ARCANE_WORDS.with.conjunction!.accompany!, 10);
  });

  it('lent to a mending: its weight joins, at 75%', () => {
    const joined = composeArcane(['water', 'mend', 'with', 'seed'])!.heal!;
    const water = composeArcane(['water', 'mend'])!.heal!;
    const seed = composeArcane(['seed', 'mend'])!.heal!;
    expect(joined).toBeCloseTo(water + 0.75 * seed, 10);
  });

  it('a linked clause that speaks its own verb acts for itself, untaxed', () => {
    const spec = composeArcane(['fire', 'pierce', 'with', 'ice', 'pierce'])!;
    expect(spec.strikes).toHaveLength(2);
    expect(spec.strikes[1].power).toBeCloseTo(composeArcane(['ice', 'pierce'])!.strikes[0].power, 10);
  });

  it('like every conjunction, it must follow something and lead somewhere', () => {
    expect(parseSentence(['with', 'fire']).ok).toBe(false);
    expect(parseSentence(['fire', 'with']).ok).toBe(false);
    expect(ARCANE_WORDS.with.stacked).toBeUndefined();
  });
});

describe('signature — what a working is made of', () => {
  it('an arcane sentence states its own: nouns at depth, bare verbs as their substance', () => {
    expect(composeArcane(['fire:3', 'pierce'])!.signature).toEqual({ heat: 3 });
    expect(composeArcane(['cut'])!.signature).toEqual({ slashing: 1 });
    expect(composeArcane(['fire', 'ward'])!.signature).toEqual({ heat: 1 });
    expect(composeArcane(['undo'])!.signature).toBeUndefined();
  });

  it('a miracle has no words, so each strike stands for one tier of its element', () => {
    expect(workingSignature(specForSource({ school: 'divine', litany: 'holy_fire' }))).toEqual({ heat: 1, light: 1 });
  });

  it('what an undoing leaves: every part of the working at the share that survives', () => {
    const spec = composeArcane(['fire', 'pierce'])!;
    const half = undoWorking(spec, 0.5);
    expect(half.strikes[0].power).toBeCloseTo(spec.strikes[0].power / 2, 10);
    expect(half.strikes[0].inflicts![0].intensity).toBeCloseTo((spec.strikes[0].inflicts![0].intensity ?? 1) / 2, 10);
    const ward = composeArcane(['fire', 'ward'])!;
    expect(undoWorking(ward, 0.5).buff!.mods[0].value).toBeCloseTo(ward.buff!.mods[0].value / 2, 10);
    expect(undoWorking(spec, 1)).toBe(spec);
  });
});

// ---------- The trap ----------

/**
 * A mage with the whole lexicon and a deep enough pool for any sentence here,
 * facing one specimen — both of them far too sturdy to end the fight, which
 * is not what any of this is about (a Death Knight kills a fresh character in
 * three blows, and a mage this bright kills the knight in one).
 */
function arena(defId = 'death_knight', seed = 5) {
  const g = fresh(seed);
  g.state.skills.arcana = { level: 40, xp: 0 };
  g.state.attrs.int.level = 120;
  g.state.attrs.wis.level = 20;
  g.state.attrs.con.level = 400;
  for (const id of Object.keys(ARCANE_WORDS)) g.state.stats[`flag:word:${id}`] = 1;
  const stats = getDerivedStats(g.state);
  setResource(g.state, 'mana', stats.maxMana);
  g.state.resources.hp = stats.maxHp;
  g.state.spot = 'woods_edge';
  const foe = spawnMonster(g.state, SPOTS.woods_edge, { monsterId: defId, level: 3 });
  foe.attrs.con = 1e5;
  foe.hp = monsterStats(foe).maxHp;
  g.state.combat = {
    enemies: [foe, null, null, null, null],
    playerBar: 0,
    momentum: 0,
    position: 'neutral',
    cooldowns: {},
    buffs: [],
    events: {},
  };
  return { g, foe };
}

function prepare(g: Game, words: string[]): CraftedSpell {
  const spell = addSpell(g.state, { school: 'arcane', words });
  spell.prepared = true;
  return spell;
}

const lines = (g: Game) => g.state.combatFeed.map((f) => f.text);

describe('the trap: a prepared counterspell springs inside an enemy casting', () => {
  it('never goes off on its own — not on the bar, not from the buff slot, not held in the seat', () => {
    const { g } = arena();
    prepare(g, ['fire', 'pierce', 'undo']);
    const stats = getDerivedStats(g.state);
    expect(pickActive(g.state, 'attack', stats)?.id ?? '').not.toMatch(/^grimoire:/);
    expect(pickActive(g.state, 'buff', stats)?.id ?? '').not.toMatch(/^grimoire:/);
    expect(readyableSpell(g.state, stats)).toBeNull();
  });

  it('an enemy casting springs it: paid, clocked, the caster burned, the working thinned', () => {
    const { g, foe } = arena();
    const trap = prepare(g, ['gloom', 'undo']);
    const spec = resolveSpellFor(g.state, trap);
    const manaBefore = resourceValue(g.state, 'mana');
    const { spellPower, manaEff } = getDerivedStats(g.state);
    castMonsterWorking(g.state, g.bus, foe, monsterStats(foe), { school: 'arcane', words: ['gloom', 'cut'] }, 99);

    const c = g.state.combat!;
    // The casting was visible first: stamped for triggers, with what it was.
    expect(c.events.onEnemyCast).toBe(g.state.totalTicks);
    expect(c.casting).toMatchObject({ school: 'arcane', element: 'dark', index: 0 });
    // Paid and clocked like any cast.
    expect(c.cooldowns[`grimoire:${trap.uid}`]).toBe(spec.cooldown);
    expect(resourceValue(g.state, 'mana')).toBeCloseTo(manaBefore - spec.manaCost * manaEff, 3);
    // gloom against gloom: 20% + 10%. The caster burns for that share of the
    // undoing's burn, in the speaker's spell power.
    const e = counterEfficiency(spec.counter!, { dark: 1 }).efficiency;
    expect(e).toBeCloseTo(0.3, 10);
    const burn = findStatus(foe, 'manaburn');
    expect(burn?.intensity).toBeCloseTo(e * spec.counter!.burn * spellPower, 6);
    expect(lines(g).some((t) => /springs on the Death Knight's Gloom Cut: 30% efficiency/.test(t))).toBe(true);
    // What survived still went off.
    expect(lines(g).some((t) => /works what is left of Gloom Cut/.test(t))).toBe(true);
  });

  it('at 100% or more nothing of the working arrives — and the burn is never capped', () => {
    const { g, foe } = arena();
    const trap = prepare(g, ['undo:3', 'with', 'arcane:3', 'with', 'arcane:3', 'with', 'arcane:3']);
    const spec = resolveSpellFor(g.state, trap);
    const working = ['arcane:3', 'pierce', 'with', 'arcane:3', 'with', 'arcane:3'];
    const e = counterEfficiency(spec.counter!, workingSignature(composeArcane(working)!)).efficiency;
    expect(e).toBeGreaterThan(1);

    const hp = g.state.resources.hp;
    const { spellPower } = getDerivedStats(g.state);
    castMonsterWorking(g.state, g.bus, foe, monsterStats(foe), { school: 'arcane', words: working }, 99);
    expect(g.state.resources.hp).toBe(hp);
    expect(lines(g).some((t) => /comes apart before it can land/.test(t))).toBe(true);
    // Uncapped: the burn is the whole efficiency's worth, past 100%.
    expect(findStatus(foe, 'manaburn')!.intensity).toBeCloseTo(e * spec.counter!.burn * spellPower, 6);
  });

  it('firing conditions route traps: one tuned for heat waits out a dark working', () => {
    const { g, foe } = arena();
    const trap = prepare(g, ['fire', 'undo']);
    g.state.skillTriggers = {
      [`grimoire:${trap.uid}`]: { conditions: [{ subject: 'enemy.castElement', op: 'is', value: 'heat' }] },
    };
    castMonsterWorking(g.state, g.bus, foe, monsterStats(foe), { school: 'arcane', words: ['gloom', 'cut'] }, 98);
    expect(g.state.combat!.cooldowns[`grimoire:${trap.uid}`]).toBeUndefined();
    castMonsterWorking(g.state, g.bus, foe, monsterStats(foe), { school: 'arcane', words: ['fire', 'cut'] }, 99);
    expect(g.state.combat!.cooldowns[`grimoire:${trap.uid}`]).toBeGreaterThan(0);
  });

  it('whatever else the sentence carries lands on the caster — and is not itself answered', () => {
    const { g, foe } = arena();
    prepare(g, ['fire', 'pierce', 'undo']);
    const hp = foe.hp;
    castMonsterWorking(g.state, g.bus, foe, monsterStats(foe), { school: 'arcane', words: ['gloom', 'cut'] }, 99);
    expect(foe.hp).toBeLessThan(hp);
    // The knight's own undoing is tuned against heat, and was ready — but an
    // undoing's own words cannot be undone.
    expect(foe.cooldowns?.[4]).toBeUndefined();
  });
});

describe('monsters undo too', () => {
  const KNIGHT_UNDO = 4;

  it('the Death Knight holds an undoing, and never spends a turn on it', () => {
    const entry = MONSTERS.death_knight.rotation![KNIGHT_UNDO];
    expect('cast' in entry && specForSource(entry.cast).counter?.tuning).toEqual({ light: 1, heat: 1 });
  });

  it('your light is answered: thinned, and you burn for it', () => {
    const { g, foe } = arena();
    const bolt = prepare(g, ['light', 'pierce']);
    const spec = resolveSpellFor(g.state, bolt);
    castCraftedAttack(g.state, g.bus, `grimoire:${bolt.uid}`, spec);
    expect(foe.cooldowns?.[KNIGHT_UNDO]).toBeGreaterThan(g.state.totalTicks);
    expect(findStatus(g.state, 'manaburn')?.intensity).toBeGreaterThan(0);
    expect(lines(g).some((t) => /Death Knight's .* springs on your .*: 29% efficiency/.test(t))).toBe(true);

    // On its clock, the next working goes through untouched.
    const burn = findStatus(g.state, 'manaburn')!.intensity;
    castCraftedAttack(g.state, g.bus, `grimoire:${bolt.uid}`, spec);
    expect(findStatus(g.state, 'manaburn')!.intensity).toBe(burn);
  });

  it('a mind in debt cannot shape an undoing', () => {
    const { g, foe } = arena();
    foe.mana = -1;
    const bolt = prepare(g, ['light', 'pierce']);
    castCraftedAttack(g.state, g.bus, `grimoire:${bolt.uid}`, resolveSpellFor(g.state, bolt));
    expect(foe.cooldowns?.[KNIGHT_UNDO]).toBeUndefined();
    expect(findStatus(g.state, 'manaburn')).toBeUndefined();
  });
});

describe('manaburn on a monster eats its mind', () => {
  const fight = (g: Game, ticks: number, each?: () => void) => {
    for (let i = 0; i < ticks; i++) {
      g.state.totalTicks += 1;
      tickCombat(g.state, g.bus, SPOTS.woods_edge);
      if (!g.state.combat) return;
      each?.();
    }
  };

  it('the mind is the player’s own arithmetic, read off its attributes', () => {
    const { foe } = arena('psionic_slime');
    const mind = monsterMind(foe);
    expect(mind.max).toBe(foe.attrs.int);
    expect(mind.current).toBe(mind.max);
    expect(mind.regen).toBeCloseTo(foe.attrs.int * 0.01 + foe.attrs.wis * 0.05, 10);
  });

  it('a burn deeper than the mind runs it into debt, then goes off', () => {
    const { g, foe } = arena('psionic_slime');
    // No wisdom to recover with. The slime's own WIS mends its mind nearly as
    // fast as a burn this size eats it — the player's rule exactly, and why a
    // wise caster shrugs off what floors a clever one.
    foe.attrs.wis = 0;
    const max = monsterMind(foe).max;
    applyStatus(g.state, foe, { id: 'manaburn', intensity: max * 3 }, 'test');
    let debt = false;
    let boom = false;
    const hp = foe.hp;
    fight(g, 600, () => {
      g.state.resources.hp = getDerivedStats(g.state).maxHp;
      if (mindInDebt(foe)) debt = true;
      if (lines(g).some((t) => /manaburn in the .* goes off/.test(t))) boom = true;
    });
    expect(debt).toBe(true);
    expect(boom).toBe(true);
    expect(findStatus(foe, 'manaburn')).toBeUndefined();
    expect(foe.hp).toBeLessThan(hp);
  });

  it('a wise mind outlasts a burn its own depth would not', () => {
    const { g, foe } = arena('psionic_slime');
    const max = monsterMind(foe).max;
    applyStatus(g.state, foe, { id: 'manaburn', intensity: max * 3 }, 'test');
    let boom = false;
    fight(g, 600, () => {
      g.state.resources.hp = getDerivedStats(g.state).maxHp;
      if (lines(g).some((t) => /manaburn in the .* goes off/.test(t))) boom = true;
    });
    expect(boom).toBe(false);
  });

  it('a mind in debt cannot shape a working — it swings instead', () => {
    // The slime's whole rotation is workings, so whole it casts within the
    // first few fills; in debt, every fill falls through to its plain attack.
    const { g, foe } = arena('psionic_slime');
    fight(g, 600, () => {
      foe.mana = -5;
      g.state.resources.hp = getDerivedStats(g.state).maxHp;
    });
    expect(g.state.combat).not.toBeNull();
    expect(lines(g).some((t) => / works /.test(t))).toBe(false);
    expect(lines(g).some((t) => /Psionic Slime/.test(t) && !/You /.test(t))).toBe(true);

    const { g: whole } = arena('psionic_slime');
    fight(whole, 600, () => {
      whole.state.resources.hp = getDerivedStats(whole.state).maxHp;
    });
    expect(lines(whole).some((t) => / works /.test(t))).toBe(true);
  });

  it('a burned mind recovers, and forgets once it is whole', () => {
    const { g, foe } = arena('psionic_slime');
    foe.mana = monsterMind(foe).max - 1e-6;
    fight(g, 1);
    expect(foe.mana).toBeUndefined();
  });
});

describe('the enemy-casting trigger', () => {
  it('is an event any entry can gate on, with subjects that read what is being cast', () => {
    expect(TRIGGER_EVENTS.map((e) => e.id)).toContain('onEnemyCast');
    const { g, foe } = arena();
    castMonsterWorking(g.state, g.bus, foe, monsterStats(foe), { school: 'arcane', words: ['gloom', 'cut'] }, 99);
    const ctx = { state: g.state, combat: g.state.combat!, stats: getDerivedStats(g.state) };
    expect(TRIGGER_SUBJECTS['enemy.castSchool'].read(ctx)).toBe('arcane');
    expect(TRIGGER_SUBJECTS['enemy.castElement'].read(ctx)).toBe('dark');
    // Stale once the window has passed: a trigger asks about NOW.
    g.state.totalTicks += 10;
    expect(TRIGGER_SUBJECTS['enemy.castElement'].read(ctx)).toBe('');
  });
});
