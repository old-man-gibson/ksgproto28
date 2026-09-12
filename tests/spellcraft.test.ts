// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { migrate } from '../src/core/save/migrations';
import { ARCANE_WORDS, MIRACLE_LIST, maxSentenceWords } from '../src/core/data/spellcraft.data';
import {
  DEITIES,
  DEITY_LIST,
  DEITY_TAGS,
  DEITY_TAG_CATEGORIES,
  PANTHEONS,
} from '../src/core/data/deities.data';
import { INTENSITY_FLOOR, checkSentence, composeArcane, parseSentence } from '../src/core/systems/arcane';
import { learnMiracle, miracleSpec } from '../src/core/systems/divine';
import {
  deityGroups,
  deityRelation,
  grantFavor,
  pantheonOf,
  queryDeities,
} from '../src/core/systems/deities';
import {
  amplifyStatuses,
  applyStatus,
  findStatus,
  consumeMagnetCharge,
  magnetBypassesDodge,
  magnetCritChance,
  escalationPrimed,
  statusBlocksRangedType,
  statusIncomingMissChance,
  statusPacifiesFlankers,
  stripStatuses,
  tickStatuses,
} from '../src/core/systems/statuses';
import {
  MAX_PSI_MEMORIZED,
  checkShape,
  deriveShape,
  forgetPsiShape,
  learnPsiAxis,
  memorizePsiShape,
  psiAxisCap,
  psiMemorized,
  raisePsiTier,
  recogniseShape,
  shapeName,
  shapeSpec,
} from '../src/core/systems/psionic';
import { PSIONIC, PSI_RECOGNITIONS, PSI_RECOGNITION_LIST } from '../src/core/data/spellcraft.data';
import type { PsionicRecognitionDef, PsionicShape } from '../src/core/types';
import {
  BASE_PREPARED,
  preparedCap,
  canCastUtility,
  castUtility,
  forgetSpell,
  grantCastWordXp,
  isUtilityWorking,
  utilityCooldown,
  inscribeArcane,
  preparedSpells,
  resolveSpell,
  resolveSpellFor,
  setPrepared,
  specForSource,
  shapePsionic,
  spellKey,
} from '../src/core/systems/spellcraft';
import { STATUSES } from '../src/core/registry';
import { activeRotation, castCraftedAttack, healEnemy, spawnMonster, tickCombat } from '../src/core/systems/combat';
import { resourceValue, setResource } from '../src/core/systems/resources';
import { getDerivedStats } from '../src/core/systems/derived';
import { createItem } from '../src/core/systems/runes';
import { MONSTERS } from '../src/core/registry';
import { statsFromAttrs } from '../src/core/systems/monsterStats';
import { TECHNIQUES } from '../src/core/registry';
import { monsterStats } from '../src/core/systems/monsterStats';
import { SKILLS, SPOTS } from '../src/core/registry';
import {
  WORD_MILESTONE_LEVELS,
  WORD_POWER_PER_LEVEL,
  wordSkillId,
  wordTag,
} from '../src/core/data/wordskills.data';
import { grantWordXp } from '../src/core/systems/arcane';
import { skillXpNeeded } from '../src/core/systems/skills';
import { statusTipLines } from '../src/ui/lib/format';
import type { GameState, SpellSource } from '../src/core/types';

const fresh = (seed = 1) => new Game(createInitialState(seed));

/** A mage competent enough that gating never gets in a test's way. */
function mage(g: Game, level = 12) {
  g.state.skills.arcana = { level, xp: 0 };
  g.state.attrs.int.level = 20;
  g.state.attrs.wis.level = 20;
  // The whole lexicon, not the starter eleven — the shutter (unlocks.ts) is
  // onboarding.test.ts's subject, and everything here tests what lies past it.
  for (const id of Object.keys(ARCANE_WORDS)) {
    g.state.stats[`flag:word:${id}`] = 1;
  }
}

// ---------- The grammar ----------

describe('arcane syntax', () => {
  it('composes deterministically — same sentence, same spell, every time', () => {
    const a = composeArcane(['fire', 'pierce', 'quickly']);
    const b = composeArcane(['fire', 'pierce', 'quickly']);
    expect(a).toEqual(b);
    expect(a).not.toBeNull();
  });

  it('word order matters: noun-led hits harder, verb-led sharpens the verb', () => {
    const nounLed = composeArcane(['fire', 'pierce'])!;
    const verbLed = composeArcane(['pierce', 'fire'])!;
    // Same words, different spells — deterministically.
    expect(nounLed.strikes[0].power).toBeGreaterThan(verbLed.strikes[0].power);
    expect(verbLed.strikes[0].penetration!).toBeGreaterThan(nounLed.strikes[0].penetration!);
    // Both still speak fire.
    expect(nounLed.strikes[0].type).toBe('heat');
    expect(verbLed.strikes[0].type).toBe('heat');
  });

  it('a second noun opens a second clause, at a diminished share', () => {
    const two = composeArcane(['fire', 'pierce', 'ice', 'fly'])!;
    expect(two.strikes).toHaveLength(2);
    expect(two.strikes[0].type).toBe('heat');
    expect(two.strikes[1].type).toBe('cold');
    // The second clause lands at 1/1.5 of its solo weight.
    const solo = composeArcane(['ice', 'fly'])!;
    expect(two.strikes[1].power).toBeCloseTo(solo.strikes[0].power / 1.5, 5);
  });

  it('a bare noun is substance without shape — weaker than a shaped one', () => {
    const bare = composeArcane(['fire'])!;
    const shaped = composeArcane(['fire', 'pierce'])!;
    expect(bare.strikes[0].power).toBeLessThan(shaped.strikes[0].power);
  });

  it('adverbs weigh the clause: slowly trades cooldown for power, twice lands twice', () => {
    const plain = composeArcane(['fire', 'pierce'])!;
    const slow = composeArcane(['fire', 'pierce', 'slowly'])!;
    expect(slow.strikes[0].power).toBeGreaterThan(plain.strikes[0].power);
    expect(slow.cooldown).toBeGreaterThan(plain.cooldown);
    // Trailing, a landing-adverb is DEPTH: one blow at twice the weight.
    const doubled = composeArcane(['fire', 'pierce', 'twice'])!;
    expect(doubled.strikes[0].hits).toBeUndefined();
    expect(doubled.strikes[0].power).toBeCloseTo(plain.strikes[0].power * 2, 5);
    expect(doubled.manaCost).toBeGreaterThan(plain.manaCost);
  });

  it('targeting words address the whole spell, and the last one spoken wins', () => {
    expect(composeArcane(['fire', 'pierce'])!.target).toBe('one');
    expect(composeArcane(['fire', 'pierce', 'others'])!.target).toBe('others');
    expect(composeArcane(['others', 'fire', 'pierce', 'me'])!.target).toBe('self');
    // A broadside thins the pool.
    expect(composeArcane(['fire', 'pierce', 'others'])!.manaCost).toBeGreaterThan(
      composeArcane(['fire', 'pierce'])!.manaCost,
    );
  });

  it('ward and mend always land on the speaker', () => {
    const ward = composeArcane(['ice', 'ward'])!;
    expect(ward.strikes).toHaveLength(0);
    expect(ward.buff?.mods.some((m) => m.stat === 'resCold')).toBe(true);
    const mend = composeArcane(['water', 'mend'])!;
    expect(mend.strikes).toHaveLength(0);
    expect(mend.heal).toBeGreaterThan(0);
  });

  it('repetition deepens a word: stronger than the sum, costlier still', () => {
    const one = composeArcane(['fire', 'pierce'])!;
    const flame = composeArcane(['fire', 'fire', 'pierce'])!;
    const blaze = composeArcane(['fire', 'fire', 'fire', 'pierce'])!;
    // One clause throughout — repetition is not a second clause.
    expect(flame.strikes).toHaveLength(1);
    expect(blaze.strikes).toHaveLength(1);
    // Effect superlinear: flame > 2× fire, blaze > 3× fire.
    expect(flame.strikes[0].power).toBeGreaterThan(one.strikes[0].power * 2);
    expect(blaze.strikes[0].power).toBeGreaterThan(one.strikes[0].power * 3);
    // Cost grows FASTER than effect.
    expect(flame.manaCost / one.manaCost).toBeGreaterThan(flame.strikes[0].power / one.strikes[0].power);
    // The deepened word wears its deepened name.
    expect(flame.name).toBe('Flame Pierce');
    expect(blaze.name).toBe('Blaze Pierce');
    expect(composeArcane(['stone', 'stone'])!.name).toBe('Boulder');
    expect(composeArcane(['zero', 'zero', 'zero'])!.name).toBe('Null');
  });

  it('only ADJACENT repetition merges; a word said apart is two clauses', () => {
    const apart = composeArcane(['fire', 'pierce', 'fire'])!;
    expect(apart.strikes).toHaveLength(2);
    expect(apart.name).toBe('Fire Pierce Fire');
  });

  it('adverbs and verbs deepen too: thrice lands thrice, everything hits everyone', () => {
    // Leading, a landing-adverb is VOLUME: three separate landings.
    const thrice = composeArcane(['twice', 'twice', 'fire', 'pierce'])!;
    expect(thrice.strikes[0].hits).toBe(3);
    expect(thrice.name).toBe('Thrice Fire Pierce');
    const dragging = composeArcane(['fire', 'pierce', 'slowly', 'slowly'])!;
    const slow = composeArcane(['fire', 'pierce', 'slowly'])!;
    expect(dragging.strikes[0].power).toBeGreaterThan(slow.strikes[0].power);
    expect(dragging.cooldown).toBeGreaterThan(slow.cooldown);
    // Expand thrice: the working stops spilling and addresses everyone.
    const everything = composeArcane(['fire', 'expand', 'expand', 'expand'])!;
    expect(everything.target).toBe('others');
    expect(everything.splash).toBeUndefined();
    expect(everything.name).toBe('Fire Everything');
  });

  it('no mouth can hold a fourth, and addresses never deepen', () => {
    expect(composeArcane(['fire', 'fire', 'fire', 'fire'])).toBeNull();
    expect(parseSentence(['fire', 'fire', 'fire', 'fire']).reason).toMatch(/fourth/);
    // Repeated targets are just the address, said twice; last still wins.
    const spoken = composeArcane(['fire', 'me', 'me'])!;
    expect(spoken.target).toBe('self');
    expect(spoken.name).toBe('Fire Me Me');
  });

  it('deep words are earned: spoken enough, flame becomes a word of its own', () => {
    const g = fresh();
    mage(g);
    // Unearned, the deep form refuses to be spoken directly.
    expect(checkSentence(g.state, ['fire:2', 'pierce']).reason).toMatch(/earned/);
    // Mastery counts DISTINCT sentences: inscribing and forgetting the same
    // one forever teaches nothing (the delete-reinscribe farm the user found).
    for (let i = 0; i < 10; i++) {
      const spell = inscribeArcane(g.state, g.bus, ['fire', 'fly']);
      if (spell) forgetSpell(g.state, spell.uid);
    }
    expect(checkSentence(g.state, ['fire:2', 'pierce']).reason).toMatch(/earned/);
    // Five genuinely different workings, though, earn the flame.
    for (const words of [['fire'], ['pierce', 'fire'], ['fire', 'quickly'], ['fly', 'fire']]) {
      inscribeArcane(g.state, g.bus, words);
    }
    expect(checkSentence(g.state, ['fire:2', 'pierce']).ok).toBe(true);
    // One slot, but exactly the spell that saying it twice makes.
    expect(composeArcane(['fire:2', 'pierce'])).toEqual(composeArcane(['fire', 'fire', 'pierce']));
    // The grimoire knows they are one spell.
    expect(inscribeArcane(g.state, g.bus, ['fire', 'fire', 'pierce'])).not.toBeNull();
    expect(inscribeArcane(g.state, g.bus, ['fire:2', 'pierce'])).toBeNull();
    // A mastered flame deepens with a plain fire — and two flames are a fourth.
    expect(composeArcane(['fire:2', 'fire'])!.name).toBe('Blaze');
    expect(composeArcane(['fire:2', 'fire:2'])).toBeNull();
  });

  it('"then" chains clauses: inherited opening, earned follow-through, no breadth tax', () => {
    const linked = composeArcane(['fire', 'pierce', 'then', 'ice', 'fly'])!;
    const apart = composeArcane(['fire', 'pierce', 'ice', 'fly'])!;
    expect(linked.strikes).toHaveLength(2);
    // The follow-up rides the opening the first strike made...
    expect(linked.strikes[1].penetration).toBe(linked.strikes[0].penetration);
    expect(apart.strikes[1].penetration).toBeUndefined();
    // ...hits harder when it landed (resolved per cast in combat)...
    expect(linked.strikes[1].followUp).toBe(1.3);
    expect(apart.strikes[1].followUp).toBeUndefined();
    // ...and is depth, not breadth: no second-clause dilution.
    expect(linked.strikes[1].power).toBeCloseTo(apart.strikes[1].power * 1.5, 5);
    // The word itself costs a slot and its mana.
    expect(linked.manaCost).toBe(apart.manaCost + 1);
    expect(linked.name).toBe('Fire Pierce Then Ice Fly');
  });

  it('a conjunction must sit between clauses, and never deepens', () => {
    expect(parseSentence(['then', 'fire']).reason).toMatch(/follows nothing/);
    expect(parseSentence(['fire', 'pierce', 'then']).reason).toMatch(/leads nowhere/);
    expect(parseSentence(['fire', 'then', 'then', 'ice']).reason).toMatch(/follows nothing/);
    // A target after "then" does not satisfy it — clauses do.
    expect(parseSentence(['fire', 'then', 'me']).reason).toMatch(/leads nowhere/);
    // A mending after "then" is legal grammar; it simply breaks the strike
    // chain (nothing for a later "then" to ride).
    const mendAfter = composeArcane(['fire', 'pierce', 'then', 'water', 'mend'])!;
    expect(mendAfter.strikes).toHaveLength(1);
    expect(mendAfter.heal).toBeGreaterThan(0);
  });

  it('"and" fuses two clauses into one twin-natured blow', () => {
    const fused = composeArcane(['fire', 'pierce', 'and', 'ice', 'fly'])!;
    expect(fused.strikes).toHaveLength(1);
    const blow = fused.strikes[0];
    expect(blow.type).toBe('heat');
    expect(blow.orType).toBe('cold');
    // Both riders travel; the joined clause adds its weight at 0.85.
    expect(blow.inflicts?.map((a) => a.id).sort()).toEqual(['chilled', 'on_fire']);
    const apartHead = composeArcane(['fire', 'pierce'])!.strikes[0].power;
    const apartJoin = composeArcane(['ice', 'fly'])!.strikes[0].power;
    expect(blow.power).toBeCloseTo(apartHead + apartJoin * 0.85, 5);
    expect(fused.name).toBe('Fire Pierce And Ice Fly');
  });

  it('nothing cannot launder a substance: "zero and fire" is fire', () => {
    // The exploit this closes: an untyped head fusing a typed clause would
    // have made the WHOLE blow untyped, buying a resistance-proof blaze for
    // the price of one extra word — a bypass that scaled with the target's
    // own defences and made elemental resistance meaningless.
    const laundered = composeArcane(['zero', 'and', 'fire:3', 'crush'])!;
    expect(laundered.strikes).toHaveLength(1);
    expect(laundered.strikes[0].untyped).toBeUndefined();
    expect(laundered.strikes[0].type).toBe('heat');
    // Zero alone is still nothing, and nothing still ignores everything.
    expect(composeArcane(['zero', 'crush'])!.strikes[0].untyped).toBe(true);
    // The other way round is harmless: a substance is not purified by
    // having nothing folded into it.
    const mixed = composeArcane(['fire', 'crush', 'and', 'zero', 'crush'])!;
    expect(mixed.strikes[0].untyped).toBeUndefined();
    expect(mixed.strikes[0].type).toBe('heat');
  });

  it('"but" transmutes: the first clause’s weight, the second’s bite', () => {
    // The user's canonical sentence: massive fire damage that poisons
    // instead of burning.
    const spoken = composeArcane(['slowly', 'slowly', 'fire', 'fire', 'fire', 'but', 'venom'])!;
    expect(spoken.name).toBe('Dragging Blaze But Venom');
    expect(spoken.strikes).toHaveLength(1);
    expect(spoken.strikes[0].type).toBe('heat');
    expect(spoken.strikes[0].inflicts?.map((a) => a.id)).toEqual(['poison']);
    // The venom clause struck nothing of its own; the blaze kept its weight.
    const plain = composeArcane(['slowly', 'slowly', 'fire', 'fire', 'fire'])!;
    expect(spoken.strikes[0].power).toBeCloseTo(plain.strikes[0].power, 5);
    // A riderless word strips the blow clean (stone carries shards now; zero
    // is the word for nothing).
    expect(composeArcane(['fire', 'pierce', 'but', 'zero'])!.strikes[0].inflicts).toBeUndefined();
  });

  it('adverbs on a "but"-clause deepen the transmutation, not a discarded strike', () => {
    // The user's find: "blaze but glacier fourfold" changed nothing but mana.
    // A transmuting clause's whole expression is its riders, so its adverbs
    // multiply THEM — fourfold chills four times as deep.
    const plain = composeArcane(['fire', 'pierce', 'but', 'venom'])!;
    const doubled = composeArcane(['fire', 'pierce', 'but', 'venom', 'twice'])!;
    const heavy = composeArcane(['fire', 'pierce', 'but', 'venom', 'slowly'])!;
    const base = plain.strikes[0].inflicts![0].intensity!;
    expect(doubled.strikes[0].inflicts![0].intensity).toBeCloseTo(base * 2, 5);
    // Trailing slowly spaces the venom: ×1.4 weight × ⅓ thinning, over a
    // tripled clock — a long, seeping poison.
    expect(heavy.strikes[0].inflicts![0].intensity).toBeCloseTo((base * 1.4) / 3, 5);
    expect(heavy.strikes[0].inflicts![0].duration).toBe(STATUSES.poison.duration! * 3);
    // The blow itself is untouched — the fire kept its own weight.
    expect(doubled.strikes[0].power).toBeCloseTo(plain.strikes[0].power, 5);
  });

  it('adverb POSITION in a "but"-clause: trailing deepens, leading multiplies', () => {
    // "venom twice" — about the substance: one application, twice as deep.
    const deep = composeArcane(['fire', 'pierce', 'but', 'venom', 'twice'])!;
    expect(deep.strikes[0].inflicts).toHaveLength(1);
    expect(deep.strikes[0].inflicts![0].intensity).toBeCloseTo(2, 5);
    // "twice venom" — about the applying: two applications at base depth,
    // which meet the condition's own stacking rules (and can cap a sum).
    const many = composeArcane(['fire', 'pierce', 'but', 'twice', 'venom'])!;
    expect(many.strikes[0].inflicts).toHaveLength(2);
    for (const app of many.strikes[0].inflicts!) expect(app.intensity).toBeCloseTo(1, 5);
    // Striking clauses read the same axis now: leading = a volley of
    // landings, trailing = one spike carrying the weight — blow AND riders.
    const volley = composeArcane(['twice', 'fire', 'pierce'])!.strikes[0];
    const spike = composeArcane(['fire', 'pierce', 'twice'])!.strikes[0];
    expect(volley.hits).toBe(2);
    expect(spike.hits).toBeUndefined();
    expect(spike.power).toBeCloseTo(volley.power * 2, 5);
    expect(spike.inflicts![0].intensity).toBeCloseTo(volley.inflicts![0].intensity! * 2, 5);
  });

  it('"or" makes alternatives at half price; "if" names a condition', () => {
    const either = composeArcane(['fire', 'pierce', 'or', 'ice', 'fly'])!;
    expect(either.strikes).toHaveLength(2);
    expect(either.strikes[0].altGroup).toBe(either.strikes[1].altGroup);
    // The or-linked clause pays half: (2+1) + (2+1)×0.5 + 1 = 5.5 → 6,
    // versus 7 had it been "and"-fused word-for-word.
    expect(either.manaCost).toBeLessThan(composeArcane(['fire', 'pierce', 'and', 'ice', 'fly'])!.manaCost);

    // "if fire" is satisfied by On Fire — or by the Blazing it escalates into.
    const gated = composeArcane(['gloom', 'burst', 'if', 'fire'])!;
    expect(gated.strikes).toHaveLength(1);
    expect(gated.strikes[0].onlyIf).toEqual(['on_fire', 'blazing']);
    // Conditioned on the word for nothing: it never fires, and says so.
    expect(composeArcane(['gloom', 'burst', 'if', 'zero'])!.strikes[0].onlyIf).toEqual([]);
    // The new physical nouns carry their signatures.
    expect(composeArcane(['stone'])!.strikes[0].inflicts?.[0].id).toBe('shardbound');
    expect(composeArcane(['cut'])!.strikes[0].type).toBe('slashing');
    expect(composeArcane(['iron'])!.strikes[0].type).toBe('piercing');
    expect(composeArcane(['iron'])!.strikes[0].inflicts?.[0].id).toBe('magnetized');
  });

  it('zero is untyped; arcane frays, and enough fraying catches fire', () => {
    // Zero: the raw number lands — no type roulette either way.
    const nothing = composeArcane(['zero', 'pierce'])!;
    expect(nothing.strikes[0].untyped).toBe(true);
    // A typed word stays typed.
    expect(composeArcane(['fire', 'pierce'])!.strikes[0].untyped).toBeUndefined();

    // Arcane: not manaburn on arrival — a precursor that builds to it.
    const fray = composeArcane(['arcane'])!;
    expect(fray.strikes[0].inflicts?.[0].id).toBe('unravelling');

    // Three stacks of unravelling catch: the escalation IS manaburn.
    const g = fresh();
    for (let i = 0; i < 3; i++) {
      applyStatus(g.state, g.state, { id: 'unravelling', intensity: 1 }, 'test');
    }
    expect(findStatus(g.state, 'unravelling')).toBeUndefined();
    // The catch is a conflagration, not a candle: 3 threads × the ×8
    // escalation = a 24-point burn (manaburn's intensity is mana left to take).
    expect(findStatus(g.state, 'manaburn')?.intensity).toBe(24);

    // And "if arcane" reads the whole chain: fraying or already burning.
    expect(composeArcane(['gloom', 'burst', 'if', 'arcane'])!.strikes[0].onlyIf).toEqual([
      'unravelling',
      'manaburn',
    ]);
  });

  it('slowly and quickly move the condition clock, position deciding what is conserved', () => {
    const baseDur = STATUSES.on_fire.duration!;
    const plain = composeArcane(['fire', 'pierce'])!.strikes[0].inflicts![0];
    expect(plain.duration).toBeUndefined(); // the condition's own clock

    // Leading: about time. The window moves, the per-tick bite keeps.
    const longBurn = composeArcane(['slowly', 'fire', 'pierce'])!.strikes[0].inflicts![0];
    expect(longBurn.duration).toBe(baseDur * 2);
    expect(longBurn.intensity).toBeCloseTo(plain.intensity!, 5);
    // Leading quickly is haste incarnate: a quarter of the window at triple
    // rate — the fastest delivery, a share of the total lost to hurry.
    const shortBurn = composeArcane(['quickly', 'fire', 'pierce'])!.strikes[0].inflicts![0];
    expect(shortBurn.duration).toBe(Math.round(baseDur * 0.25));
    expect(shortBurn.intensity).toBeCloseTo(plain.intensity! * 3, 5);

    // Trailing: about the substance, each with its own shape so neither
    // position dominates. Slowly stretches presence at a third the bite;
    // quickly compresses cleanly, nothing lost.
    const spaced = composeArcane(['fire', 'pierce', 'slowly'])!.strikes[0].inflicts![0];
    expect(spaced.duration).toBe(baseDur * 3);
    expect(spaced.intensity).toBeCloseTo(plain.intensity! / 3, 5);
    const dense = composeArcane(['fire', 'pierce', 'quickly'])!.strikes[0].inflicts![0];
    expect(dense.duration).toBe(Math.round(baseDur * 0.5));
    expect(dense.intensity).toBeCloseTo(plain.intensity! * 2, 5);
  });

  it('gently is cheap but never efficient; viciously buys crit with mana', () => {
    const plain = composeArcane(['fire', 'crush'])!;
    const soft = composeArcane(['gently', 'fire', 'crush'])!;
    const cruel = composeArcane(['viciously', 'fire', 'crush'])!;

    // Gently: less weight, less malice, less cost — but weight falls FASTER
    // than price, so it is cheap rather than efficient.
    expect(soft.strikes[0].power).toBeLessThan(plain.strikes[0].power);
    expect(soft.strikes[0].critBonus).toBeLessThan(0);
    expect(soft.manaCost).toBeLessThanOrEqual(plain.manaCost);
    const dmgDrop = soft.strikes[0].power / plain.strikes[0].power;
    const costDrop = soft.manaCost / plain.manaCost;
    expect(dmgDrop).toBeLessThan(costDrop);

    // Viciously: crit for coin, the weight untouched.
    expect(cruel.strikes[0].critBonus).toBeGreaterThan(0);
    expect(cruel.strikes[0].power).toBeCloseTo(plain.strikes[0].power, 5);
    expect(cruel.manaCost).toBeGreaterThan(plain.manaCost);

    // Crit ADDS per tier rather than compounding: murderously is 3 × 0.07.
    expect(composeArcane(['viciously', 'viciously', 'viciously', 'fire', 'crush'])!.strikes[0].critBonus)
      .toBeCloseTo(0.21, 5);
  });

  it('gently is a scaffold: full affliction, almost no force — safe on yourself', () => {
    const plain = composeArcane(['venom', 'cut', 'me'])!.strikes[0];
    const soft = composeArcane(['gently', 'venom', 'cut', 'me'])!.strikes[0];
    const softest = composeArcane(['gently:3', 'venom', 'cut', 'me'])!.strikes[0];

    // The weight collapses...
    expect(soft.power).toBeCloseTo(plain.power * 0.5, 5);
    expect(softest.power).toBeCloseTo(plain.power * 0.125, 5);
    // ...while the poison it carries is exactly as deep, and lands exactly
    // as readily. That is the whole of the scaffold.
    for (const s of [soft, softest]) {
      expect(s.inflicts![0].intensity).toBeCloseTo(plain.inflicts![0].intensity!, 5);
      expect(s.inflicts![0].chance).toBeCloseTo(plain.inflicts![0].chance!, 5);
    }
    // And it is addressed at the speaker, so it lands on them.
    expect(composeArcane(['gently:3', 'venom', 'cut', 'me'])!.target).toBe('self');
  });

  it('the scaffold hands off: self-poison, then Venom Feast spits it back', () => {
    const g = fresh(31);
    g.state.spot = 'woods_edge';
    const foe = spawnMonster(g.state, SPOTS.woods_edge);
    g.state.combat = {
      enemies: [foe, null, null, null, null],
      playerBar: 0,
      momentum: 0,
      position: 'neutral',
      cooldowns: {},
      buffs: [],
      events: {},
    };

    // Scaffold: poison yourself for a pittance.
    applyStatus(g.state, g.state, { id: 'poison', intensity: 4 }, 'gently venom cut me');
    expect(findStatus(g.state, 'poison')!.intensity).toBe(4);

    // The miracle that changes the rules: it strips YOUR poison, delivers it
    // with interest, and feeds on the poison in the room while doing it.
    const feast = miracleSpec('venom_feast')!;
    castCraftedAttack(g.state, g.bus, 'venom_feast', feast);
    expect(findStatus(g.state, 'poison')).toBeUndefined();
    expect(findStatus(foe, 'poison')!.intensity).toBeGreaterThanOrEqual(4 * 1.2);
  });

  it('intensely and dimly move the affliction alone, never the blow', () => {
    const plain = composeArcane(['venom', 'cut'])!;
    const deep = composeArcane(['intensely', 'venom', 'cut'])!;
    const faint = composeArcane(['dimly', 'venom', 'cut'])!;

    const bite = (s: typeof plain) => s.strikes[0].inflicts![0].intensity!;
    expect(bite(deep)).toBeCloseTo(bite(plain) * 1.6, 5);
    expect(bite(faint)).toBeCloseTo(bite(plain) * 0.6, 5);
    // The blow itself is untouched by either — that is the whole point.
    expect(deep.strikes[0].power).toBeCloseTo(plain.strikes[0].power, 5);
    expect(faint.strikes[0].power).toBeCloseTo(plain.strikes[0].power, 5);
    // Effort is paid for, restraint is cheap — though every word spoken
    // still costs its own breath, so dimming is not free in absolute terms.
    expect(deep.manaCost).toBeGreaterThan(plain.manaCost);
    expect(faint.manaCost).toBeLessThan(deep.manaCost);
  });

  it('dimming is restraint, never erasure — the affliction survives any depth', () => {
    const base = composeArcane(['venom', 'cut'])!.strikes[0].inflicts![0].intensity!;
    const scarce = composeArcane(['dimly:3', 'venom', 'cut'])!.strikes[0].inflicts![0];
    expect(scarce.intensity).toBeGreaterThan(0);
    // Floored: 0.6³ = 0.216 would apply, but never below the floor share.
    expect(scarce.intensity).toBeGreaterThanOrEqual(base * INTENSITY_FLOOR);
    expect(scarce.chance).toBeCloseTo(composeArcane(['venom', 'cut'])!.strikes[0].inflicts![0].chance!, 5);
  });

  it('spoken last they concentrate or dilute: the clock moves to match', () => {
    const baseDur = STATUSES.poison.duration!;
    // Leading: the pushing changes, the clock does not.
    expect(composeArcane(['intensely', 'venom', 'cut'])!.strikes[0].inflicts![0].duration).toBeUndefined();
    // Trailing: concentrated — hotter for less long.
    const concentrated = composeArcane(['venom', 'cut', 'intensely'])!.strikes[0].inflicts![0];
    expect(concentrated.duration).toBe(Math.round(baseDur * 0.6));
    // Trailing dimly: diluted — fainter, but it lingers.
    const diluted = composeArcane(['venom', 'cut', 'dimly'])!.strikes[0].inflicts![0];
    expect(diluted.duration).toBe(Math.round(baseDur * 1.6));
    expect(diluted.intensity!).toBeLessThan(concentrated.intensity!);
  });

  it('volume pays on conditions that COUNT, depth on ones that keep the worst', () => {
    // The rule that makes leading-fourfold worth its price — and worth
    // knowing. A condition that sums or counts its applications escalates on
    // VOLUME, so four landings can push it over the cap in a single cast.
    const g = fresh(41);
    const bearer = g.state;
    const four = composeArcane(['twice:3', 'arcane', 'cut'])!.strikes[0];
    expect(four.hits).toBe(4);
    for (let i = 0; i < 3; i++) {
      applyStatus(g.state, bearer, { ...four.inflicts![0], chance: 1 }, 'test');
    }
    // unravelling sums to a cap of 3 and catches: one cast, one manaburn.
    expect(findStatus(bearer, 'unravelling')).toBeUndefined();
    expect(findStatus(bearer, 'manaburn')).toBeDefined();

    // A condition that keeps only the WORST dose ignores volume entirely —
    // there, depth (intensely, or a trailing landing adverb) is the answer.
    const g2 = fresh(43);
    for (let i = 0; i < 4; i++) {
      applyStatus(g2.state, g2.state, { id: 'poison', intensity: 1, chance: 1 }, 'test');
    }
    expect(findStatus(g2.state, 'poison')!.intensity).toBe(1);
    expect(findStatus(g2.state, 'rotting')).toBeUndefined();
  });

  it('on a keeps-the-worst condition, DEPTH is the only road to escalation', () => {
    // "venom fourfold cut" folds the affliction into itself: one dose at x4,
    // which reaches poison's cap — and the second cast tips it septic. The
    // plain sentence never can, however many times it is spoken, because a
    // dose no deeper than the last teaches the body nothing.
    const deep = composeArcane(['venom', 'twice:3', 'cut'])!.strikes[0].inflicts![0];
    const g = fresh(7);
    applyStatus(g.state, g.state, { ...deep, chance: 1 }, 'test');
    expect(findStatus(g.state, 'poison')!.intensity).toBe(4);
    applyStatus(g.state, g.state, { ...deep, chance: 1 }, 'test');
    expect(findStatus(g.state, 'rotting')).toBeDefined();

    const flat = composeArcane(['venom', 'cut'])!.strikes[0].inflicts![0];
    const g2 = fresh(7);
    for (let i = 0; i < 5; i++) applyStatus(g2.state, g2.state, { ...flat, chance: 1 }, 'test');
    expect(findStatus(g2.state, 'poison')!.intensity).toBe(1);
    expect(findStatus(g2.state, 'rotting')).toBeUndefined();
    // The one at its ceiling announces itself; the flat one has nothing to say.
    expect(escalationPrimed(g2.state, findStatus(g2.state, 'poison')!)).toBe(false);
  });

  it('a capped condition says it is one dose from turning', () => {
    // Below the ceiling: a stable equilibrium, and it says nothing.
    const mild = fresh(11);
    applyStatus(mild.state, mild.state, { id: 'poison', intensity: 2, chance: 1 }, 'test');
    const light = findStatus(mild.state, 'poison')!;
    expect(escalationPrimed(mild.state, light)).toBe(false);
    expect(statusTipLines(mild.state, light).join(' ')).not.toMatch(/next application/);

    // AT the ceiling — which only a first dose can reach without turning, so
    // this is precisely the "venom fourfold cut" state: ticking along at x4,
    // looking exactly as it did, one dose from septic.
    const primed = fresh(11);
    applyStatus(primed.state, primed.state, { id: 'poison', intensity: 4, chance: 1 }, 'test');
    const held = findStatus(primed.state, 'poison')!;
    expect(held.intensity).toBe(4);
    expect(escalationPrimed(primed.state, held)).toBe(true);
    expect(statusTipLines(primed.state, held).join(' ')).toMatch(/next application becomes .*Rotting/);

    // And the warning is honest: the very next dose does turn it.
    applyStatus(primed.state, primed.state, { id: 'poison', intensity: 1, chance: 1 }, 'test');
    expect(findStatus(primed.state, 'rotting')).toBeDefined();

    // A condition with nowhere worse to go never claims otherwise.
    const rotting = findStatus(primed.state, 'rotting')!;
    expect(escalationPrimed(primed.state, rotting)).toBe(false);
  });

  it('a ward reads every dial the rest of the grammar does', () => {
    const res = (words: string[]) =>
      composeArcane(words)!.buff!.mods.find((m) => m.stat === 'resCold')!.value;
    const secs = (words: string[]) => composeArcane(words)!.buff!.duration;
    const plain = res(['ice', 'ward']);
    const plainSecs = secs(['ice', 'ward']);

    // The SUBSTANCE's depth counts — a glacier wards harder than ice, which
    // it did not before: the coat was paying triple for nothing.
    expect(res(['ice:3', 'ward'])).toBeCloseTo(plain * 3.9, 5);
    // …and so does the verb's own depth.
    expect(res(['ice', 'ward:3'])).toBeCloseTo(plain * 3.9, 5);
    // Order still leads: warding-first sharpens the mechanic.
    expect(res(['ward', 'ice'])).toBeGreaterThan(plain);

    // Intensity thickens the coat; dimming thins it without removing it.
    expect(res(['intensely', 'ice', 'ward'])).toBeCloseTo(plain * 1.6, 5);
    expect(res(['dimly', 'ice', 'ward'])).toBeCloseTo(plain * 0.6, 5);

    // The clock adverbs move the CLOCK — and trailing thins what it stretches.
    expect(secs(['slowly', 'ice', 'ward'])).toBe(plainSecs * 2);
    expect(secs(['ice', 'ward', 'slowly'])).toBe(plainSecs * 3);
    expect(res(['ice', 'ward', 'slowly'])).toBeLessThan(res(['slowly', 'ice', 'ward']));
    expect(secs(['quickly', 'ice', 'ward'])).toBeLessThan(plainSecs);

    // Landing adverbs split the way they do everywhere: leading buys WEAR,
    // trailing buys thickness.
    expect(secs(['twice', 'ice', 'ward'])).toBe(plainSecs * 2);
    expect(res(['twice', 'ice', 'ward'])).toBeCloseTo(plain, 5);
    expect(res(['ice', 'ward', 'twice'])).toBeCloseTo(plain * 2, 5);
    expect(secs(['ice', 'ward', 'twice'])).toBe(plainSecs);
  });

  it('malice reads by position too: leading seeks the seam, trailing widens it', () => {
    const seeking = composeArcane(['viciously', 'venom', 'cut'])!.strikes[0];
    const widening = composeArcane(['venom', 'cut', 'viciously'])!.strikes[0];
    // Leading is about the casting: how OFTEN a vital spot is found.
    expect(seeking.critBonus).toBeCloseTo(0.07, 5);
    expect(seeking.critDamageBonus).toBeUndefined();
    // Trailing is about the substance: how WIDE the one found opens.
    expect(widening.critDamageBonus).toBeCloseTo(0.25, 5);
    expect(widening.critBonus).toBeUndefined();
    // Same for restraint, in the other direction.
    expect(composeArcane(['gently', 'venom', 'cut'])!.strikes[0].critBonus).toBeCloseTo(-0.05, 5);
    expect(composeArcane(['venom', 'cut', 'gently'])!.strikes[0].critDamageBonus).toBeCloseTo(-0.2, 5);
  });

  it('adverb position reads against the clause CORE, so verb-only clauses read both ways', () => {
    // A clause with no noun still has a substance — its verb. Before it is
    // volume, after it is depth, exactly as with a noun.
    const volley = composeArcane(['twice', 'cut'])!.strikes[0];
    const spike = composeArcane(['cut', 'twice'])!.strikes[0];
    expect(volley.hits).toBe(2);
    expect(spike.hits).toBeUndefined();
    expect(spike.power).toBeCloseTo(volley.power * 2, 5);

    // And in a verb-led clause the verb is the core: an adverb after it is
    // trailing even though the noun has not been spoken yet.
    const afterVerb = composeArcane(['pierce', 'twice', 'fire'])!.strikes[0];
    expect(afterVerb.hits).toBeUndefined();
    expect(composeArcane(['twice', 'pierce', 'fire'])!.strikes[0].hits).toBe(2);
  });

  it('a sentence of nothing but adverbs and targets fizzles', () => {
    expect(parseSentence(['slowly', 'me']).ok).toBe(false);
    expect(composeArcane(['slowly', 'me'])).toBeNull();
  });

  it('checkSentence gates on the mage, not the grammar', () => {
    const g = fresh();
    // Level 0: three words at most, and no high words.
    expect(maxSentenceWords(0)).toBe(3);
    expect(checkSentence(g.state, ['fire', 'pierce', 'ice', 'fly']).reason).toMatch(/3 words/);
    // An unlearned word reads as UNKNOWN before any level talk — the starter
    // lexicon (unlocks.ts) sits in front of the minLevel gate on purpose.
    expect(checkSentence(g.state, ['zero']).reason).toMatch(/do not know/);
    g.state.stats['flag:word:zero'] = 1;
    expect(checkSentence(g.state, ['zero']).reason).toMatch(/Arcana 10/);
    expect(checkSentence(g.state, ['fire', 'pierce']).ok).toBe(true);
    mage(g);
    expect(checkSentence(g.state, ['zero']).ok).toBe(true);
  });
});

// ---------- The grimoire ----------

describe('the grimoire', () => {
  it('inscribes a sentence once, and refuses the exact recomposition', () => {
    const g = fresh();
    mage(g);
    const spell = inscribeArcane(g.state, g.bus, ['fire', 'pierce']);
    expect(spell).not.toBeNull();
    expect(g.state.grimoire).toHaveLength(1);
    expect(inscribeArcane(g.state, g.bus, ['fire', 'pierce'])).toBeNull();
    // Different order is a different spell — that is the whole point.
    expect(inscribeArcane(g.state, g.bus, ['pierce', 'fire'])).not.toBeNull();
    expect(g.state.grimoire).toHaveLength(2);
  });

  it('inscription manifests and pays the Arcana skill', () => {
    const g = fresh();
    g.state.attrs.int.level = 15; // over the unlock bar; skill not yet manifested
    expect(g.state.skills.arcana).toBeUndefined();
    inscribeArcane(g.state, g.bus, ['fire', 'pierce']);
    expect(g.state.skills.arcana).toBeDefined();
    expect(g.state.skills.arcana.xp > 0 || g.state.skills.arcana.level > 0).toBe(true);
  });

  it('a spell resolves to the same spec as its sentence, under any given name', () => {
    const g = fresh();
    mage(g);
    const spell = inscribeArcane(g.state, g.bus, ['ice', 'fly'])!;
    const spec = resolveSpell(spell);
    expect(spec).toEqual(composeArcane(['ice', 'fly'])!);
    spell.name = 'Snowdart';
    const renamed = resolveSpell(spell);
    expect(renamed.name).toBe('Snowdart');
    expect(renamed.strikes).toEqual(spec.strikes);
  });

  it('holds at most the prepared cap', () => {
    const g = fresh();
    mage(g);
    const sentences = [['fire'], ['ice'], ['spark'], ['water']];
    const uids = sentences.map((s) => inscribeArcane(g.state, g.bus, s)!.uid);
    for (const uid of uids.slice(0, BASE_PREPARED)) {
      expect(setPrepared(g.state, g.bus, uid, true)).toBe(true);
    }
    expect(setPrepared(g.state, g.bus, uids[BASE_PREPARED], true)).toBe(false);
    expect(preparedSpells(g.state)).toHaveLength(BASE_PREPARED);
  });

  it('every twenty levels of a school buys another page', () => {
    const g = fresh();
    expect(preparedCap(g.state)).toBe(BASE_PREPARED);
    g.state.skills.arcana = { level: 19, xp: 0 };
    expect(preparedCap(g.state)).toBe(BASE_PREPARED);
    g.state.skills.arcana = { level: 40, xp: 0 };
    expect(preparedCap(g.state)).toBe(BASE_PREPARED + 2);
    // Each school counts on its own — a page earned anywhere is spendable
    // anywhere — but the shared `magic` parent behind them never counts.
    g.state.skills.devotion = { level: 20, xp: 0 };
    g.state.skills.psionics = { level: 20, xp: 0 };
    g.state.skills.magic = { level: 60, xp: 0 };
    expect(preparedCap(g.state)).toBe(BASE_PREPARED + 4);
  });

  it('a wider mind holds the spell the base cap refused', () => {
    const g = fresh();
    mage(g);
    const uids = [['fire'], ['ice'], ['spark'], ['water']].map(
      (s) => inscribeArcane(g.state, g.bus, s)!.uid,
    );
    for (const uid of uids.slice(0, BASE_PREPARED)) setPrepared(g.state, g.bus, uid, true);
    expect(setPrepared(g.state, g.bus, uids[BASE_PREPARED], true)).toBe(false);
    g.state.skills.devotion = { level: 20, xp: 0 };
    expect(setPrepared(g.state, g.bus, uids[BASE_PREPARED], true)).toBe(true);
  });
});

// ---------- Divine ----------

describe('browsing the powers', () => {
  it('tags OR within an axis and AND across them, like the bestiary', () => {
    const ids = (q: Parameters<typeof queryDeities>[0]) => queryDeities(q).map((d) => d.id).sort();
    // Expectations are DERIVED from the roster, so writing a new god is never
    // a failing test — only a broken filter is.
    const carrying = (...tags: string[]) =>
      DEITY_LIST.filter((d) => tags.some((t) => d.tags.includes(t))).map((d) => d.id).sort();

    // One axis, two tags: either will do.
    expect(ids({ tags: ['bestial', 'gigantoid'] })).toEqual(carrying('bestial', 'gigantoid'));
    // Two axes: both must be satisfied, so the result is the intersection.
    expect(ids({ tags: ['tribal', 'poison'] })).toEqual(
      DEITY_LIST.filter((d) => d.tags.includes('tribal') && d.tags.includes('poison'))
        .map((d) => d.id)
        .sort(),
    );
    // Tribal AND fire is nobody — Xima's exception is his own fondness, not a tag.
    expect(ids({ tags: ['tribal', 'fire'] })).toEqual([]);
    // No filter is everybody.
    expect(queryDeities()).toHaveLength(DEITY_LIST.length);
  });

  it('search reads names, epithets and what the god is like', () => {
    expect(queryDeities({ search: 'rapier' }).map((d) => d.id)).toEqual(['denjalle']);
    expect(queryDeities({ search: 'cold sun' }).map((d) => d.id)).toEqual(['xima']);
    // And it composes with tags rather than replacing them.
    expect(queryDeities({ search: 'poison', tags: ['honorable'] })).toEqual([]);
  });

  it('a membership tag is the pantheon claim', () => {
    // Membership is authored as a TAG, so a god states its allegiance once,
    // alongside the rest of its aspects — and the shelf groups on that.
    for (const d of DEITY_LIST) {
      const tag = d.tags.find((t) => DEITY_TAGS[t]?.category === 'membership');
      const found = deityGroups().find((g) => g.deities.includes(d));
      if (tag) {
        expect(found?.pantheon?.id, `${d.id} should shelve under ${tag}`).toBe(tag);
        expect(found?.pantheon?.name).toBe(DEITY_TAGS[tag].name);
      } else {
        expect(found?.pantheon, `${d.id} claims nothing and should stand alone`).toBeNull();
      }
    }
    // Every power lands in exactly one group, whatever it claims.
    const shelved = deityGroups().flatMap((g) => g.deities);
    expect(shelved).toHaveLength(DEITY_LIST.length);
    expect(new Set(shelved.map((d) => d.id)).size).toBe(DEITY_LIST.length);
  });

  it('groups by pantheon, with everyone unaffiliated together at the end', () => {
    // The unaffiliated always share the last group, however many there are.
    const alone = deityGroups().find((g) => g.pantheon === null);
    expect(alone?.deities.every((d) => !pantheonOf(d))).toBe(true);
    expect(deityGroups().at(-1)?.pantheon ?? null).toBe(alone ? null : deityGroups().at(-1)!.pantheon);

    // Give two of them a shared body and they shelve together, ahead of the rest.
    PANTHEONS.test_court = { id: 'test_court', name: 'The Test Court', icon: '🏛️' };
    const claimed = DEITY_LIST.filter((d) => d.id === 'xima' || d.id === 'denjalle');
    for (const d of claimed) d.pantheon = 'test_court';
    try {
      const groups = deityGroups();
      expect(groups[0].pantheon?.id).toBe('test_court');
      expect(groups[0].deities.map((d) => d.id).sort()).toEqual(['denjalle', 'xima']);
      expect(groups[groups.length - 1].pantheon).toBeNull();

      // An unknown pantheon must not swallow its claimant.
      claimed[0].pantheon = 'no_such_pantheon';
      const orphaned = deityGroups();
      expect(orphaned.flatMap((g) => g.deities.map((d) => d.id))).toContain(claimed[0].id);
    } finally {
      for (const d of claimed) delete d.pantheon;
      delete PANTHEONS.test_court;
    }
  });
});

describe('the pantheon', () => {
  it('resolves every relation the deities declared, and hostility always wins', () => {
    // Xima and Kenese court each other (Bestial/Tribal) — but Kenese despises
    // the Honorable, and Xima is exactly that. The grudge outweighs the tribes.
    expect(deityRelation('xima', 'kenese_paea')).toBe('hostile');
    // D'Enjalle befriends the honorable Cold Sun; Xima's fire-exception is an
    // exception to HIS OWN fondness, not a grudge, so the friendship stands.
    expect(deityRelation('denjalle', 'xima')).toBe('synergy');
    // Kenese despises the Honorable — and D'Enjalle is nothing else.
    expect(deityRelation('denjalle', 'kenese_paea')).toBe('hostile');
    // Both Organized; Usvýlgr's trickster grudge only covers tricksters.
    expect(deityRelation('usvylgr', 'denjalle')).toBe('synergy');
    // The Infinity is merely watching.
    for (const other of ['xima', 'denjalle', 'usvylgr', 'kenese_paea']) {
      expect(deityRelation('ikthelthe', other)).toBe('neutral');
    }
    expect(deityRelation('usvylgr', 'kenese_paea')).toBe('neutral');
    // A deity resonates with itself.
    expect(deityRelation('xima', 'xima')).toBe('synergy');
  });

  it('favor is standing with ONE deity, spent there and nowhere else', () => {
    const g = fresh();
    grantFavor(g.state, 'xima', 5);
    grantFavor(g.state, 'denjalle', 5);
    expect(learnMiracle(g.state, g.bus, 'litany_mending')).toBe(true); // Xima's, cost 3
    expect(g.state.favor.xima).toBe(2);
    expect(g.state.favor.denjalle).toBe(5);
    // Already received; and D'Enjalle's favor cannot buy Xima's rime.
    expect(learnMiracle(g.state, g.bus, 'litany_mending')).toBe(false);
    expect(learnMiracle(g.state, g.bus, 'rime_of_the_cold_sun')).toBe(false);
    expect(g.state.grimoire).toHaveLength(1);
  });

  it('a miracle resolves to its declared spec, wearing school and deity', () => {
    const g = fresh();
    grantFavor(g.state, 'xima', 3);
    learnMiracle(g.state, g.bus, 'litany_mending');
    const spec = resolveSpell(g.state.grimoire[0]);
    expect(spec.school).toBe('divine');
    expect(spec.deity).toBe('xima');
    expect(spec.heal).toBe(2);
  });

  it('hostile deities refuse to share a prepared page — unless dogma is defied', () => {
    const g = fresh();
    grantFavor(g.state, 'denjalle', 20);
    grantFavor(g.state, 'kenese_paea', 20);
    const fire = learnMiracle(g.state, g.bus, 'holy_fire');
    const shroud = learnMiracle(g.state, g.bus, 'night_shroud');
    expect(fire && shroud).toBe(true);
    const [a, b] = g.state.grimoire;
    expect(setPrepared(g.state, g.bus, a.uid, true)).toBe(true);
    expect(setPrepared(g.state, g.bus, b.uid, true)).toBe(false);
    // The iconoclast's privilege: worn, the title waives the veto.
    g.state.titles.push('iconoclast');
    g.state.title = 'iconoclast';
    expect(setPrepared(g.state, g.bus, b.uid, true)).toBe(true);
  });
});

describe('miracle mechanics', () => {
  it("Xima's communion turns bleeding into feeding", () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'bleeding', intensity: 2 }, 'test');
    const bleeding = tickStatuses(g.state, g.state, { hp: 100, maxHp: 100, inCombat: true });
    expect(bleeding.damage).toBeGreaterThan(0);

    applyStatus(g.state, g.state, { id: 'blood_communion', intensity: 1 }, 'test');
    const communed = tickStatuses(g.state, g.state, { hp: 100, maxHp: 100, inCombat: true });
    expect(communed.damage).toBe(0);
    expect(communed.restores.some((r) => r.resource === 'hp' && r.amount > 0)).toBe(true);
  });

  it('venom can be stripped from its bearer and redoubled on a victim', () => {
    const g = fresh();
    applyStatus(g.state, g.state, { id: 'poison', intensity: 3 }, 'test');
    const taken = stripStatuses(g.state, ['poison', 'rotting']);
    expect(taken).toEqual([{ id: 'poison', intensity: 3 }]);
    expect(findStatus(g.state, 'poison')).toBeUndefined();

    applyStatus(g.state, g.state, { id: 'poison', intensity: 2 }, 'test');
    expect(amplifyStatuses(g.state, ['poison'], 2)).toBe(1);
    expect(findStatus(g.state, 'poison')?.intensity).toBe(4);
  });

  it('duels pacify flankers and shrouds turn blows aside', () => {
    const g = fresh();
    expect(statusPacifiesFlankers(g.state)).toBe(false);
    expect(statusIncomingMissChance(g.state)).toBe(0);
    applyStatus(g.state, g.state, { id: 'honor_bound', intensity: 1 }, 'test');
    applyStatus(g.state, g.state, { id: 'night_shroud', intensity: 1 }, 'test');
    expect(statusPacifiesFlankers(g.state)).toBe(true);
    expect(statusIncomingMissChance(g.state)).toBeCloseTo(0.12, 5);
  });
});

// ---------- Psionic ----------

describe('psionic shaping', () => {
  it('axes have caps, closed axes await teachers, and an empty shape is nothing', () => {
    const g = fresh();
    expect(psiAxisCap(g.state)).toBe(3);
    expect(checkShape(g.state, { force: 4 }).ok).toBe(false);
    expect(checkShape(g.state, { force: 3 }).ok).toBe(true);
    // A fresh mind holds only force and reach.
    expect(checkShape(g.state, { grip: 1 }).reason).toMatch(/teacher/);
    learnPsiAxis(g.state, 'grip');
    expect(checkShape(g.state, { grip: 1 }).ok).toBe(true);
    expect(checkShape(g.state, {}).ok).toBe(false);
  });

  it('output outruns input: the point curve is superlinear', () => {
    const one = shapeSpec({ force: 1 }).strikes[0].power;
    const three = shapeSpec({ force: 3 }).strikes[0].power;
    expect(three).toBeGreaterThan(one * 3);
    expect(shapeSpec({ force: 1, reach: 4 }).target).toBe('others');
    expect(shapeSpec({ force: 1, speed: 3 }).cooldown).toBeLessThan(shapeSpec({ force: 1 }).cooldown);
    expect(shapeSpec({ vitality: 2, force: 1 }).heal).toBeGreaterThan(0);
  });

  it('the same two axes build a wall or swing a hammer, depending only on the product', () => {
    // The whole rebuild in one assertion. Mass and speed, nothing else moved:
    // held still it is inertia and stands as a wall; set moving it is momentum
    // and lands as a blow. Nothing anywhere names a wall or a hammer.
    const still = { reach: 4, mass: 4, space: 2 };
    const moving = { reach: 4, mass: 4, space: 2, speed: 4 };

    expect(deriveShape(still).inertia).toBe(4);
    expect(deriveShape(still).momentum).toBe(0);
    expect(deriveShape(moving).inertia).toBe(0);
    expect(deriveShape(moving).momentum).toBe(16);

    const wall = shapeSpec(still, 12);
    expect(wall.grants?.map((g) => g.id)).toContain('kinetic_bulwark');
    expect(wall.strikes).toHaveLength(0);

    const hammer = shapeSpec(moving, 12);
    expect(hammer.grants ?? []).toEqual([]);
    expect(hammer.strikes[0].power).toBeGreaterThan(0);
    expect(hammer.strikes[0].inflicts?.map((i) => i.id)).toContain('concussed');
    expect(hammer.cooldown).toBeLessThan(wall.cooldown);
  });

  it('acuity is a RATIO: spreading a working is what makes it missable', () => {
    const point = { force: 4, clairvoyance: 2, space: 2 };
    expect(deriveShape(point).acuity).toBe(2);
    const pinned = shapeSpec(point, 12);
    expect(pinned.sure).toBe(true);
    // Sight narrowed to a point punctures rather than shoves.
    expect(pinned.strikes[0].type).toBe('piercing');

    // Same sight, asked to cover four times the ground: it is no longer a point.
    const spread = shapeSpec({ ...point, reach: 4 }, 12);
    expect(spread.sure).toBeUndefined();
    expect(spread.strikes[0].type).toBe('bludgeoning');
    expect(spread.target).toBe('others');

    // Sight cannot hold a pinpoint on something it is also swinging, so a
    // shape is a needle or a hammer — never both.
    const swung = shapeSpec({ ...point, mass: 2, speed: 2 }, 12);
    expect(swung.sure).toBeUndefined();
    expect(swung.strikes[0].type).toBe('bludgeoning');
  });

  it('inward is an AIM: the same quantity is a hammer out and speed in', () => {
    // The mirror. Mass and speed, identical in both shapes; only the aim
    // differs, and nothing is discarded either way.
    const outward: PsionicShape = { mass: 10, speed: 10 };
    const inward: PsionicShape = { ...outward, vitality: 10 };
    const thrown = shapeSpec(outward, 12);
    const worn = shapeSpec(inward, 12);

    expect(deriveShape(outward).momentum).toBe(100);
    expect(deriveShape(inward).momentum).toBe(100);

    // Aimed out: a hammer, and no self-buff.
    expect(thrown.strikes[0].power).toBeGreaterThan(0);
    expect(thrown.grants ?? []).toEqual([]);

    // Aimed in: the identical 100 momentum is speed, and no blow at all.
    expect(worn.strikes).toHaveLength(0);
    const haste = worn.grants?.find((g) => g.id === 'psionic_haste');
    expect(haste?.intensity).toBe(10); // √momentum × inward
    expect(worn.name).toBe('Kinetic Rush');

    // The regression this was built for: a wholly inward shape used to
    // multiply its momentum by zero and silently bin twenty points.
    expect(worn.grants!.length).toBeGreaterThan(0);
  });

  it('every quantity has both faces, and the share splits them', () => {
    // Half in, half out: the same points do both jobs at half strength.
    const halved: PsionicShape = { mass: 10, speed: 10, vitality: 10, force: 10 };
    const split = shapeSpec(halved, 12);
    expect(deriveShape(halved).inward).toBe(0.5);
    expect(split.strikes[0].power).toBeGreaterThan(0);
    expect(split.grants?.find((g) => g.id === 'psionic_haste')?.intensity).toBe(5);
    expect(split.grants?.find((g) => g.id === 'psionic_bracing')?.intensity).toBe(5);

    // Each quantity's inward face, reached on its own.
    const faces: [PsionicShape, string][] = [
      [{ mass: 8, speed: 8, vitality: 8 }, 'psionic_haste'],
      [{ force: 6, vitality: 10 }, 'psionic_bracing'],
      [{ mass: 8, vitality: 8 }, 'psionic_root'],
      [{ clairvoyance: 6, vitality: 6 }, 'psionic_foresight'],
      [{ clairvoyance: 6, reach: 6, vitality: 6 }, 'psionic_wide_sight'],
    ];
    for (const [shape, id] of faces) {
      const grants = shapeSpec(shape, 12).grants ?? [];
      expect(grants.map((g) => g.id), JSON.stringify(shape)).toContain(id);
      // Turning the identical shape outward (drop the vitality) takes it away.
      const outward = shapeSpec({ ...shape, vitality: 0 }, 12).grants ?? [];
      expect(outward.map((g) => g.id), JSON.stringify(shape)).not.toContain(id);
    }
  });

  it('coherence buys how long an inward working is worn', () => {
    // Structure is what makes a working persist — and nothing else does.
    const loose: PsionicShape = { mass: 8, speed: 8, vitality: 8 };
    const structured: PsionicShape = { ...loose, space: 8 };
    const held = (shape: PsionicShape) =>
      Number(shapeSpec(shape, 12).grants!.find((g) => g.id === 'psionic_haste')!.duration);
    expect(deriveShape(structured).coherence).toBeGreaterThan(deriveShape(loose).coherence);
    expect(held(structured)).toBeGreaterThan(held(loose));
  });

  it('inward is a SHARE: a divided will does both, and worse', () => {
    const whole = shapeSpec({ vitality: 4 }, 12);
    const divided = shapeSpec({ vitality: 4, force: 4 }, 12);
    expect(deriveShape({ vitality: 4 }).inward).toBe(1);
    expect(deriveShape({ vitality: 4, force: 4 }).inward).toBe(0.5);

    // The same four points of vitality mend less once the will is split...
    expect(divided.heal!).toBeLessThan(whole.heal!);
    // ...and the four points of force land softer than they would alone.
    expect(divided.strikes[0].power).toBeLessThan(shapeSpec({ force: 4 }, 12).strikes[0].power);
    expect(whole.strikes).toHaveLength(0);
  });

  it('purchase: a grab made at speed does not hold, and zero grip is slippery', () => {
    /*
     * Grip used to be the one axis with no ratio of its own and no trade —
     * every other axis costs you something somewhere. Purchase is grip's, and
     * it is speed's SECOND cost (the first being inertia).
     */
    expect(deriveShape({ grip: 6 }).purchase).toBe(6);
    expect(deriveShape({ grip: 6, speed: 1 }).purchase).toBe(3);
    expect(deriveShape({ grip: 6, speed: 5 }).purchase).toBe(1);
    // Zero grip is a statement, not an absence: nothing holds.
    expect(deriveShape({ speed: 10 }).purchase).toBe(0);

    // It gates DURATION only — everything still lands with no grip at all.
    const slippery = shapeSpec({ clairvoyance: 6, space: 6, grip: 8, speed: 8 }, 12);
    const firm = shapeSpec({ clairvoyance: 6, space: 6, grip: 8 }, 12);
    const readOf = (s: typeof firm) => s.afflicts!.find((a) => a.id === 'psionic_read')!;
    expect(readOf(slippery).id).toBe('psionic_read'); // it lands either way
    expect(Number(readOf(firm).duration)).toBeGreaterThan(Number(readOf(slippery).duration));

    // Afflictions hold by PURCHASE; your own faces stand by COHERENCE. Two
    // different sources, so one cannot be bought with the other.
    const structured = shapeSpec({ clairvoyance: 6, space: 10, grip: 2 }, 12);
    const gripped = shapeSpec({ clairvoyance: 6, space: 2, grip: 10 }, 12);
    const readDur = (s: typeof structured) =>
      Number(s.afflicts!.find((a) => a.id === 'psionic_read')!.duration);
    expect(readDur(gripped)).toBeGreaterThan(readDur(structured));
  });

  it('a daze is spent, not held, so purchase never puts a clock on it', () => {
    // `dazed` has duration: null and comes off as the bearer loses actions to
    // it. Handing it a number would quietly make it an ordinary timed
    // condition, so the adhesion rule must skip it.
    const vise = shapeSpec({ grip: 8, force: 4 }, 12);
    const daze = vise.strikes[0].inflicts!.find((i) => i.id === 'dazed')!;
    expect(daze.duration).toBeUndefined();
    expect(STATUSES.dazed.duration).toBeNull();
    // Its hammer-mate is an ordinary condition and does take the clock.
    const hammer = shapeSpec({ mass: 6, speed: 6, force: 4, grip: 4 }, 12);
    const concussed = hammer.strikes[0].inflicts!.find((i) => i.id === 'concussed')!;
    expect(Number(concussed.duration)).toBeGreaterThan(0);
  });

  it('matter argues with a working, and can rob it of its name', () => {
    const needle: PsionicShape = { force: 4, clairvoyance: 2, space: 2 };
    expect(shapeSpec(needle, 12).name).toBe('Unerring Needle');

    // An antipattern drags acuity under the needle threshold. Nothing anywhere
    // names a needle or a shove — the shape simply stops reading as one.
    const dulled = shapeSpec(needle, 12, { acuity: 0.6 });
    expect(dulled.name).not.toBe('Unerring Needle');
    expect(dulled.sure).toBeUndefined();
    expect(dulled.strikes[0].type).toBe('bludgeoning');
    expect(shapeSpec(needle, 12).strikes[0].type).toBe('piercing');

    // Bronze pushes the other way, on the same lever.
    const carried = shapeSpec(needle, 12, { acuity: 1.15, coherence: 1.1 });
    expect(carried.strikes[0].penetration!).toBeGreaterThan(
      shapeSpec(needle, 12).strikes[0].penetration!,
    );

    // A bias never touches the aim: gear changes how well a will does things,
    // never which way it points (there is deliberately no psiInward).
    const worn: PsionicShape = { mass: 8, speed: 8, vitality: 8 };
    expect(deriveShape(worn, { momentum: 0.5 }).inward).toBe(deriveShape(worn).inward);
  });

  it('a bias reaches the shape through ordinary equipment, and only psionics feels it', () => {
    const g = fresh();
    g.state.skills.psionics = { level: 100, xp: 0 };
    for (const axis of ['clairvoyance', 'space'] as const) learnPsiAxis(g.state, axis);
    raisePsiTier(g.state, 12);
    const spell = shapePsionic(g.state, g.bus, { force: 4, clairvoyance: 2, space: 2 })!;

    // Bare-handed: the book's reading and the real one agree.
    expect(resolveSpellFor(g.state, spell).name).toBe(resolveSpell(spell).name);

    // Antipattern circuits on the hands, through the ordinary Modifier pipeline.
    g.state.equipment.hands = createItem(g.state, 'antipattern_bracers');
    expect(getDerivedStats(g.state).psiAcuity).toBeLessThan(1);
    const dulled = resolveSpellFor(g.state, spell);
    expect(dulled.name).not.toBe('Unerring Needle');
    // The grimoire still lists the bare shape — the memo is gear-blind on
    // purpose, or one spellKey would map to a spec per loadout.
    expect(resolveSpell(spell).name).toBe('Unerring Needle');
  });

  it('zero survives the rewrite, because every product carries it', () => {
    // "No speed, no mass" is still a statement about a shape — it just does
    // not need a `max: 0` band to be one.
    for (const shape of [{ mass: 10 }, { speed: 10 }] as const) {
      expect(deriveShape(shape).momentum).toBe(0);
    }
    for (const shape of [{ clairvoyance: 10 }, { reach: 10 }] as const) {
      expect(deriveShape(shape).awareness).toBe(0);
    }
    expect(deriveShape({ force: 10 }).coherence).toBe(0);
    expect(deriveShape({ force: 10 }).inward).toBe(0);
  });

  it('a recognition is a NAME for a region, not the content of one', () => {
    const needle = { force: 4, clairvoyance: 2, space: 2 };
    const named = shapeSpec(needle, 12);
    const nameless = shapeSpec(needle, 0); // below the teacher tier
    expect(named.name).toBe('Unerring Needle');
    expect(nameless.name).toBe('Mind Needle');

    // The working is the same working either way: same damage type, same
    // penetration, same unmissability — all of it computed before any name is
    // looked for. Only the flat recognition bonus separates them.
    expect(nameless.sure).toBe(true);
    expect(nameless.strikes[0].type).toBe(named.strikes[0].type);
    expect(nameless.strikes[0].penetration).toBe(named.strikes[0].penetration);
    expect(named.strikes[0].power).toBeCloseTo(
      nameless.strikes[0].power * PSIONIC.recognitionBonus,
      6,
    );

    // The old shapes still earn their old names.
    expect(shapeSpec({ reach: 4, mass: 4, space: 2 }, 4).name).toBe('Kinetic Bulwark');
    expect(shapeSpec({ vitality: 3 }, 0).name).toBe('Still Mind'); // no tier: takes untaught
    expect(shapeSpec({ force: 8, grip: 8, mass: 8, speed: 8, space: 4 }, 8).name).toBe('Obliteration');
  });

  it('an inward face is granted by the PATTERN, and a name changes nothing', () => {
    /*
     * Psionics is patterns: what a shape does comes from its quantities, and a
     * recognition is only a name for a region. So the haste ladder has to be
     * continuous straight THROUGH the point where Kinetic Rush starts being
     * recognised — an unnamed Mind Rush wears the same haste a named one of
     * equal momentum does, just less of it because it has less momentum.
     */
    const haste = (shape: PsionicShape) =>
      shapeSpec(shape, 12).grants?.find((g) => g.id === 'psionic_haste')?.intensity ?? 0;

    const rungs: PsionicShape[] = [
      { mass: 1, speed: 1, vitality: 1 },
      { mass: 4, speed: 4, vitality: 4 },
      { mass: 6, speed: 6, vitality: 6 }, // Kinetic Rush is recognised from here
      { mass: 8, speed: 8, vitality: 8 },
    ];
    // Every rung hastes, and each is stronger than the one below it.
    for (let i = 0; i < rungs.length; i++) {
      expect(haste(rungs[i]), JSON.stringify(rungs[i])).toBeGreaterThan(i === 0 ? 0 : haste(rungs[i - 1]));
    }
    // The name flips partway up and the curve does not notice: intensity is
    // exactly √momentum × inward on both sides of the boundary.
    expect(recogniseShape(rungs[1], 12)).toBeUndefined();
    expect(recogniseShape(rungs[2], 12)?.id).toBe('kinetic_rush');
    expect(haste(rungs[1])).toBeCloseTo(4, 5);
    expect(haste(rungs[2])).toBeCloseTo(6, 5);

    // Aim it half outward and the same momentum grants half the haste.
    expect(haste({ mass: 10, speed: 10, vitality: 4, force: 4 })).toBeCloseTo(5, 5);
    // Aim it wholly outward and there is nothing worn at all.
    expect(haste({ mass: 10, speed: 10 })).toBe(0);
  });

  it('an unrecognised shape is named and described by what it came out as', () => {
    const spec = shapeSpec({ force: 2, space: 6 }, 12);
    expect(spec.name).toBe('Mind Fold');
    // The description is the derived reading — the same numbers the resolver
    // used, so a player can predict a working instead of guessing at it.
    expect(spec.desc).toContain('Coherence 3.00');
    expect(spec.desc).toContain('Pressure 2');
    expect(spec.desc).not.toContain('Momentum'); // zeroes stay out of the readout
  });

  it('an untaught region refuses to be inscribed; a teacher unlocks it', () => {
    const g = fresh();
    g.state.skills.psionics = { level: 40, xp: 0 }; // cap 8
    for (const axis of ['grip', 'clairvoyance', 'space'] as const) learnPsiAxis(g.state, axis);
    const needle = { force: 4, clairvoyance: 2, space: 2 };
    expect(shapePsionic(g.state, g.bus, needle)).toBeNull();
    raisePsiTier(g.state, 4);
    expect(shapePsionic(g.state, g.bus, needle)).not.toBeNull();
    expect(resolveSpell(g.state.grimoire[0]).name).toBe('Unerring Needle');
  });

  it('shapes can be held in mind and recalled, without being inscribed', () => {
    const g = fresh();
    const jab: PsionicShape = { force: 3, reach: 1 };
    expect(memorizePsiShape(g.state, jab)).toBe(true);
    expect(psiMemorized(g.state)).toHaveLength(1);
    // Named from the shape itself when the player supplies nothing.
    expect(psiMemorized(g.state)[0].name).toBe(shapeName(jab));
    // Memorising is NOT inscribing — the grimoire is untouched.
    expect(g.state.grimoire).toHaveLength(0);

    // The same allocation twice is the same thought twice; zeros don't count.
    expect(memorizePsiShape(g.state, { force: 3, reach: 1, grip: 0 })).toBe(false);
    expect(psiMemorized(g.state)).toHaveLength(1);

    // An illegal shape is not a thought you can hold (grip awaits a teacher).
    expect(memorizePsiShape(g.state, { grip: 2 })).toBe(false);
    // Nor is an empty one.
    expect(memorizePsiShape(g.state, {})).toBe(false);

    // Held shapes are stored whole, so recalling one restores the allocation.
    expect(psiMemorized(g.state)[0].shape).toEqual(jab);
    // ...and by value: mutating the source afterwards must not rewrite memory.
    jab.force = 1;
    expect(psiMemorized(g.state)[0].shape.force).toBe(3);

    expect(forgetPsiShape(g.state, 0)).toBe(true);
    expect(psiMemorized(g.state)).toHaveLength(0);
    expect(forgetPsiShape(g.state, 0)).toBe(false);
  });

  it('the mind holds only so many shapes, and old saves hold none', () => {
    const g = fresh();
    g.state.skills.psionics = { level: 80, xp: 0 }; // cap 10, room to differ
    for (let i = 1; i <= MAX_PSI_MEMORIZED; i++) {
      expect(memorizePsiShape(g.state, { force: i }), `shape ${i}`).toBe(true);
    }
    expect(memorizePsiShape(g.state, { force: 10, reach: 1 })).toBe(false);
    expect(psiMemorized(g.state)).toHaveLength(MAX_PSI_MEMORIZED);

    // `memorized` is optional so pre-existing saves need no migration at all.
    // The shape must actually LAND, not merely report success: creating the
    // array and pushing into a detached copy of it is the failure mode this
    // guards (see memorizePsiShape on why the assignment is split in two).
    const old = fresh();
    delete old.state.psi.memorized;
    expect(psiMemorized(old.state)).toEqual([]);
    expect(memorizePsiShape(old.state, { force: 2 })).toBe(true);
    expect(psiMemorized(old.state)).toHaveLength(1);
    expect(psiMemorized(old.state)[0].shape).toEqual({ force: 2 });
  });

  it('a working is paid for in focus, never the arcane pool', () => {
    // One pool per school: mana understands, spirit believes, focus wills.
    const small = shapeSpec({ force: 2 }, 12);
    const large = shapeSpec({ force: 10, reach: 10 }, 12);
    expect(small.manaCost).toBe(0);
    expect(large.manaCost).toBe(0);
    expect(small.focusCost).toBeCloseTo(1 + 2 * 0.25, 5);
    expect(large.focusCost).toBeCloseTo(1 + 20 * 0.25, 5);
    // Gentle enough that investment scales cost without outrunning the pool.
    expect(large.focusCost!).toBeLessThan(small.focusCost! * 20);

    // Casting draws it down, and leaves mana alone.
    const g = fresh();
    g.state.attrs.cha.level = 40;
    g.state.spot = 'woods_edge';
    const foe = spawnMonster(g.state, SPOTS.woods_edge);
    g.state.combat = {
      enemies: [foe, null, null, null, null],
      playerBar: 0,
      momentum: 0,
      position: 'neutral',
      cooldowns: {},
      buffs: [],
      events: {},
    };
    setResource(g.state, 'focus', 20);
    const focusBefore = resourceValue(g.state, 'focus');
    const manaBefore = resourceValue(g.state, 'mana');
    castCraftedAttack(g.state, g.bus, 'psi:test', large);
    expect(resourceValue(g.state, 'focus')).toBeCloseTo(focusBefore - large.focusCost!, 5);
    expect(resourceValue(g.state, 'mana')).toBe(manaBefore);
  });

  it('a working wider than the mind holding it never fires', () => {
    /*
     * The gate lives inside pickActive, which is private, so this drives real
     * ticks. It tests the PERMANENT case rather than a momentarily empty pool:
     * focus regen would refill a small cost within a couple of hundred ticks,
     * but a working that costs more than max focus can never be afforded at
     * all — "you cannot hold that thought yet", which is what makes CHA the
     * ceiling on shape size instead of an arbitrary cap.
     */
    // 1 + 30×0.25 = 8.5 focus — past what an untalented mind (6) can hold.
    const wide: PsionicShape = { force: 10, reach: 10, grip: 10 };
    const run = (cha: number) => {
      const g = fresh(7);
      g.state.spot = 'woods_edge'; // somewhere with something to fight
      g.state.skills.psionics = { level: 100, xp: 0 }; // cap 10
      learnPsiAxis(g.state, 'grip');
      g.state.attrs.cha.level = cha;
      const spell = shapePsionic(g.state, g.bus, wide)!;
      setPrepared(g.state, g.bus, spell.uid, true);
      g.selectActivity('hunt');
      // An offensive working announces itself by STRIKING, not by "You cast" —
      // that line belongs to the self-targeted path (see castCraftedAttack).
      const name = resolveSpell(spell).name;
      const fired = () => g.state.combatFeed.some((f) => f.text.includes(name));
      for (let i = 0; i < 3000 && !fired(); i++) g.tick();
      return { fired: fired(), max: getDerivedStats(g.state).maxFocus };
    };

    // A narrow mind: the pool is smaller than the working, forever.
    const narrow = run(1);
    expect(narrow.max).toBeLessThan(shapeSpec(wide, 12).focusCost!);
    expect(narrow.fired, 'fired a working it could never afford').toBe(false);

    // A wider one holds it — so the silence above was the gate, not a dead
    // rotation or a shape that simply never comes up.
    const wideMind = run(30);
    expect(wideMind.max).toBeGreaterThan(shapeSpec(wide, 12).focusCost!);
    expect(wideMind.fired, 'never fired even with focus to spare').toBe(true);
  });

  it('a working that lands on you can be cast with nobody to fight', () => {
    const g = fresh();
    g.state.skills.psionics = { level: 100, xp: 0 };
    g.state.attrs.cha.level = 40;
    for (const axis of ['mass', 'speed', 'vitality'] as const) learnPsiAxis(g.state, axis);
    raisePsiTier(g.state, 12);

    // Kinetic Rush: momentum aimed wholly inward, so it grants and never strikes.
    const rush = shapePsionic(g.state, g.bus, { mass: 8, speed: 8, vitality: 8 })!;
    const spec = resolveSpell(rush);
    expect(spec.strikes).toHaveLength(0);
    expect(isUtilityWorking(spec)).toBe(true);

    // Raising CHA widens the ceiling; the pool itself only catches up as it
    // regenerates, which no ticks have run here.
    setResource(g.state, 'focus', getDerivedStats(g.state).maxFocus);
    const focusBefore = resourceValue(g.state, 'focus');
    expect(castUtility(g.state, g.bus, rush.uid)).toBe(true);
    expect(findStatus(g.state, 'psionic_haste')).toBeDefined();
    // It costs exactly what it costs in a fight — no free upkeep.
    expect(resourceValue(g.state, 'focus')).toBeCloseTo(focusBefore - spec.focusCost!, 5);
    // ...and it runs on the same clock consumables use, so it cannot be spammed.
    expect(utilityCooldown(g.state, rush.uid)).toBe(spec.cooldown);
    expect(castUtility(g.state, g.bus, rush.uid)).toBe(false);

    // Haste quickens work and the road, not just blows: `speed` drives every
    // action bar (see actions.ts), and travel is the one thing on its own stat.
    const hasted = getDerivedStats(g.state);
    expect(hasted.speed).toBeGreaterThan(getDerivedStats(fresh().state).speed);
    expect(hasted.travelSpeed).toBeGreaterThan(1);
  });

  it('a working with nothing to give the caster refuses to be cast idly', () => {
    const g = fresh();
    // Pure force: all of it aimed outward, so out here it is simply a raised
    // hand with nothing in front of it.
    const spike = shapePsionic(g.state, g.bus, { force: 3 })!;
    expect(isUtilityWorking(resolveSpell(spike))).toBe(false);
    expect(canCastUtility(g.state, spike.uid).reason).toMatch(/without a target/);
    expect(castUtility(g.state, g.bus, spike.uid)).toBe(false);
    expect(resourceValue(g.state, 'focus')).toBe(getDerivedStats(g.state).maxFocus);
  });

  it('a shape is held once; the same shape again is refused', () => {
    const g = fresh();
    expect(shapePsionic(g.state, g.bus, { force: 1, reach: 1 })).not.toBeNull();
    expect(shapePsionic(g.state, g.bus, { force: 1, reach: 1 })).toBeNull();
    expect(g.state.grimoire).toHaveLength(1);
  });

  it('overlapping regions resolve by nesting, never by declaration order', () => {
    // Twin regions differing only in one min: the region NESTED inside the
    // other is the more particular claim and must win when both fit. The
    // wider one is declared first on purpose, so falling through to file
    // order would fail this test.
    const lesser: PsionicRecognitionDef = {
      id: 'test_lesser', name: 'Lesser Test', icon: '🧪', desc: '',
      region: { pressure: { min: 4 }, momentum: { max: 0 } },
    };
    const greater: PsionicRecognitionDef = {
      id: 'test_greater', name: 'Greater Test', icon: '🧪', desc: '',
      region: { pressure: { min: 8 }, momentum: { max: 0 } },
    };
    PSI_RECOGNITIONS.test_lesser = lesser;
    PSI_RECOGNITIONS.test_greater = greater;
    PSI_RECOGNITION_LIST.push(lesser, greater);
    try {
      expect(recogniseShape({ force: 8 }, 12)?.id).toBe('test_greater');
      expect(recogniseShape({ force: 5 }, 12)?.id).toBe('test_lesser');
      // Explicit priority overrides even a nested region.
      lesser.priority = 10;
      expect(recogniseShape({ force: 8 }, 12)?.id).toBe('test_lesser');
    } finally {
      delete PSI_RECOGNITIONS.test_lesser;
      delete PSI_RECOGNITIONS.test_greater;
      PSI_RECOGNITION_LIST.splice(PSI_RECOGNITION_LIST.indexOf(lesser), 1);
      PSI_RECOGNITION_LIST.splice(PSI_RECOGNITION_LIST.indexOf(greater), 1);
    }
  });

  it('no legal shape costs points and does nothing', () => {
    /*
     * The invariant the mirror is FOR. Four quantities used to be nothing but
     * modifiers on a strike — inertia, acuity, awareness, coherence — so a
     * shape built out of them had nothing to modify and resolved to a spec
     * that did literally nothing. Forty points of reach/speed/clairvoyance/
     * space was the worst case found by hand; this sweeps for it instead.
     */
    const axes = ['force', 'reach', 'grip', 'speed', 'clairvoyance', 'space', 'mass', 'vitality'] as const;
    /*
     * Reach and speed are the DELIVERY axes — adverbs. They say how a working
     * arrives, not what it is, so a shape built only of them has nothing to
     * deliver and is empty on purpose, exactly as an arcane sentence of
     * nothing but adverbs is not a spell. Every other axis is content and must
     * stand on its own.
     */
    const CONTENT = ['force', 'grip', 'clairvoyance', 'space', 'mass', 'vitality'] as const;
    const does = (spec: ReturnType<typeof shapeSpec>) =>
      spec.strikes.length > 0 ||
      (spec.heal ?? 0) > 0 ||
      (spec.grants?.length ?? 0) > 0 ||
      (spec.afflicts?.length ?? 0) > 0;

    for (const a of CONTENT) {
      for (const b of axes) {
        for (const c of axes) {
          for (const points of [3, 10]) {
            const shape = { [a]: points, [b]: points, [c]: points };
            expect(does(shapeSpec(shape, 12)), `${JSON.stringify(shape)} does nothing`).toBe(true);
          }
        }
      }
    }
    // Delivery alone is deliberately empty — asserted so it stays a decision.
    expect(does(shapeSpec({ reach: 10, speed: 10 }, 12))).toBe(false);
    // The exact shapes found in play, named so a regression is legible.
    const found: [string, PsionicShape][] = [
      ['seen wall', { clairvoyance: 10, mass: 10 }],
      ['wide fold', { reach: 10, space: 10 }],
      ['quick fold', { speed: 10, space: 10 }],
      ['seen fold', { speed: 10, clairvoyance: 10, space: 10 }],
      ['the 40-point nothing', { reach: 10, speed: 10, clairvoyance: 10, space: 10 }],
    ];
    for (const [label, shape] of found) {
      expect(does(shapeSpec(shape, 12)), `${label} does nothing`).toBe(true);
    }
  });

  it('sight and structure reach the enemy without a blow to ride on', () => {
    // `inflicts` only land when their strike dealt damage, so a forceless
    // working has to arrive as the working itself.
    const forceless = shapeSpec({ clairvoyance: 10, space: 10 }, 12);
    expect(forceless.strikes).toHaveLength(0);
    const laid = forceless.afflicts?.map((a) => a.id) ?? [];
    expect(laid).toContain('psionic_read'); // they have been seen
    expect(laid).toContain('psionic_compression'); // and their space compressed

    // Aim the identical sight inward and it stops being about them entirely.
    const worn = shapeSpec({ clairvoyance: 10, space: 10, vitality: 10 }, 12);
    expect(worn.afflicts ?? []).toEqual([]);
    expect(worn.grants?.map((g) => g.id)).toContain('psionic_foresight');
  });

  it('psionics borrows no other school’s signature condition', () => {
    /*
     * Ik'Thel'the IS folded space — `unfolded` and `folded_space` are the two
     * halves of that deity's identity, and D'Enjalle owns `pacifiesFlankers`.
     * A school reaching for another's signature is how the pillars go mushy,
     * so psionics authors its own and this fails loudly if that slips.
     */
    const OWNED_ELSEWHERE = ['unfolded', 'folded_space', 'honor_bound', 'veiled', 'night_shroud'];
    const axes = ['force', 'reach', 'grip', 'speed', 'clairvoyance', 'space', 'mass', 'vitality'] as const;
    for (const a of axes) {
      for (const b of axes) {
        for (const points of [3, 10]) {
          const spec = shapeSpec({ [a]: points, [b]: points }, 12);
          const laid = [
            ...(spec.grants ?? []),
            ...(spec.afflicts ?? []),
            ...spec.strikes.flatMap((s) => s.inflicts ?? []),
          ].map((s) => s.id);
          for (const id of laid) {
            expect(OWNED_ELSEWHERE, `${a}/${b} reaches for '${id}'`).not.toContain(id);
          }
        }
      }
    }
  });

  it('every legal shape resolves to a total spec — old grimoires cannot break', () => {
    // Saved psionic spells are stored as shapes and resolved on read, so
    // resolution must be total: no throw, no null, no NaN, whatever the axes.
    const axes = ['force', 'reach', 'grip', 'speed', 'clairvoyance', 'space', 'mass', 'vitality'] as const;
    for (const a of axes) {
      for (const b of axes) {
        for (const points of [1, 4, 10]) {
          const shape = { [a]: points, [b]: points };
          const spec = shapeSpec(shape, 12);
          expect(spec.name.length, JSON.stringify(shape)).toBeGreaterThan(0);
          expect(Number.isFinite(spec.manaCost) && Number.isFinite(spec.cooldown)).toBe(true);
          for (const s of spec.strikes) {
            expect(Number.isFinite(s.power), JSON.stringify(shape)).toBe(true);
            expect(s.power).toBeGreaterThanOrEqual(0);
            expect(s.penetration ?? 0).toBeLessThanOrEqual(0.95);
          }
          expect(Number.isFinite(spec.heal ?? 0)).toBe(true);
          expect(spec.splash ?? 0).toBeLessThanOrEqual(0.75);
        }
      }
    }
  });

  it('v23 saves keep the grip they always had; the wall stops what is thrown', () => {
    const raw = JSON.parse(JSON.stringify(createInitialState(1))) as Record<string, unknown>;
    raw.version = 23;
    delete raw.psi;
    const migrated = migrate(raw, 24) as GameState;
    expect(migrated.psi.axes).toEqual(['force', 'reach', 'grip']);
    expect(migrated.psi.tier).toBe(0);

    const g = fresh();
    applyStatus(g.state, g.state, { id: 'kinetic_bulwark', intensity: 1 }, 'test');
    expect(statusBlocksRangedType(g.state, 'piercing')).toBe(true);
    expect(statusBlocksRangedType(g.state, 'light')).toBe(false);
  });
});

// ---------- Monsters using the player's systems ----------

describe('monsters that work', () => {
  /** Drop one specimen in front of the player, ready to act. */
  function facing(defId: string, seed = 5) {
    const g = fresh(seed);
    g.state.spot = 'woods_edge';
    const foe = spawnMonster(g.state, SPOTS.woods_edge, { monsterId: defId, level: 3 });
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

  it('a monster’s mind is worth something — spellPower reads INT', () => {
    // It was decorative before: `damage` reads STR alone, so a caster statted
    // with a high mind and low arm was simply harmless.
    const dull = statsFromAttrs({ str: 10, int: 1 } as never);
    const bright = statsFromAttrs({ str: 10, int: 20 } as never);
    expect(bright.spellPower).toBeGreaterThan(dull.spellPower);
    expect(bright.damage).toBe(dull.damage); // the arm is untouched by the mind
  });

  it('all three schools reach the player through one path', () => {
    /*
     * The point of `MonsterDef.rotation`: a sentence, a miracle and a shape
     * sit in ONE ordered list beside techniques, because each composes to a
     * SpellSpec from pure inputs. If this passes for all three, adding a
     * fourth school costs a monster nothing.
     */
    const schools: [string, string][] = [
      ['psionic_slime', 'psionic'],
      ['death_knight', 'arcane'],
      ['paladin_x', 'divine'],
    ];
    for (const [defId, school] of schools) {
      const casts = (MONSTERS[defId].rotation ?? []).flatMap((a) => ('cast' in a ? [a.cast] : []));
      expect(casts.length, `${defId} has no workings`).toBeGreaterThan(0);
      for (const src of casts) {
        const spec = specForSource(src);
        expect(src.school, `${defId} school`).toBe(school);
        // It composed into something real rather than falling back to FADED.
        expect(spec.name).not.toBe('Faded Inscription');
        expect(spec.cooldown).toBeGreaterThan(0);
      }
    }
  });

  it('every rotation entry resolves — a typo would be a monster that does nothing', () => {
    for (const m of Object.values(MONSTERS)) {
      for (const entry of m.rotation ?? []) {
        if ('technique' in entry) {
          expect(TECHNIQUES[entry.technique], `${m.id} -> ${entry.technique}`).toBeDefined();
        } else {
          expect(specForSource(entry.cast).name, `${m.id} cast`).not.toBe('Faded Inscription');
        }
      }
    }
  });

  it('a psionic slime shapes a working, and the space decides what it is', () => {
    // Its first shape is a needle by arithmetic, not by authoring.
    const first = MONSTERS.psionic_slime.rotation![0];
    expect('cast' in first).toBe(true);
    const spec = specForSource((first as { cast: SpellSource }).cast);
    expect(spec.school).toBe('psionic');
    expect(spec.strikes[0].type).toBe('piercing');
    expect(spec.sure).toBe(true);
  });

  /** Drive combat directly — the game loop only ticks it under a hunt. */
  const fight = (g: Game, ticks: number, until?: () => boolean) => {
    for (let i = 0; i < ticks; i++) {
      if (until?.()) return;
      g.state.totalTicks += 1;
      tickCombat(g.state, g.bus, SPOTS.woods_edge);
      if (!g.state.combat) return;
    }
  };

  it('a monster spends its turn on a working, and it lands', () => {
    // The slime, whose rotation is nothing but workings. A Death Knight would
    // NOT do here: its rotation leads with techniques, so it fights first and
    // curses second — which is the whole point of ordering them together.
    const { g } = facing('psionic_slime');
    const hpBefore = g.state.resources.hp;
    fight(g, 600, () => g.state.resources.hp < hpBefore);
    expect(
      g.state.combatFeed.some((f) => /works /.test(f.text)),
      'never cast a working',
    ).toBe(true);
    expect(g.state.resources.hp).toBeLessThan(hpBefore);
  });

  it('a working is not a blow: a bulwark does not stop one', () => {
    // kinetic_bulwark stops anything THROWN, and the slime is `ranged` — so a
    // rote shot would be blocked outright. The cast branch sits AHEAD of that
    // check because a shape is not thrown, and this is what proves the order.
    const { g } = facing('psionic_slime');
    applyStatus(g.state, g.state, { id: 'kinetic_bulwark', intensity: 1 }, 'test');
    expect(statusBlocksRangedType(g.state, 'heat')).toBe(true);
    fight(g, 600, () => g.state.combatFeed.some((f) => /works /.test(f.text)));
    expect(g.state.combatFeed.some((f) => /works /.test(f.text))).toBe(true);
  });

  it('a monster walks the position graph on its own, with nothing scripting it', () => {
    /*
     * The whole claim about techniques for monsters: give it a loadout and the
     * graph runs itself. The Death Knight starts at neutral, so only Gather is
     * open (neutral → coiled); coiled is the only door Heavy Blow has. Nothing
     * anywhere states that order — it falls out of `from`/`to` once each
     * specimen keeps its own position.
     */
    const { g, foe } = facing('death_knight');
    expect(TECHNIQUES.gather.from).toEqual(['neutral']);
    expect(TECHNIQUES.gather.to).toBe('coiled');
    expect(TECHNIQUES.heavy_blow.from).toEqual(['coiled']);

    // Collected from the whole feed, not the last line — the blow it shapes is
    // reported after it, so the technique line is never the most recent one.
    const moves = () =>
      g.state.combatFeed
        .map((f) => f.text.match(/moves into (Gather|Heavy Blow)/)?.[1])
        .filter((n): n is string => !!n);
    for (let i = 0; i < 1200 && moves().length < 2; i++) {
      g.state.totalTicks += 1;
      tickCombat(g.state, g.bus, SPOTS.woods_edge);
      if (!g.state.combat) break;
      // Kept upright on purpose: a Death Knight kills a fresh character in
      // about three blows, and the chain needs longer than that to show.
      g.state.resources.hp = getDerivedStats(g.state).maxHp;
    }
    const seen = moves();
    // It wound up before it swung hard — the order the graph forces.
    expect(seen[0], `saw ${JSON.stringify(seen)}`).toBe('Gather');
    expect(seen).toContain('Heavy Blow');
    // Position is per-specimen: it ends up somewhere a technique put it, and
    // the player's own position on CombatState was never touched.
    expect(foe.position).toBeDefined();
    expect(['coiled', 'off_balance', 'neutral']).toContain(foe.position);
  });

  it('order is character: a knight fights first and curses second', () => {
    /*
     * Workings and techniques share one ordered list precisely so neither
     * category outranks the other. The Death Knight leads with Gather, so its
     * OPENING is martial; the sentences come out only once the graph has
     * walked somewhere neither technique can enter from. Split into two fields
     * this was impossible — every spell fired before the first swing.
     */
    const { g } = facing('death_knight');
    const opening: string[] = [];
    for (let i = 0; i < 900 && opening.length < 1; i++) {
      g.state.totalTicks += 1;
      tickCombat(g.state, g.bus, SPOTS.woods_edge);
      if (!g.state.combat) break;
      g.state.resources.hp = getDerivedStats(g.state).maxHp;
      for (const f of g.state.combatFeed) {
        if (/moves into/.test(f.text)) opening.push('technique');
        else if (/works /.test(f.text)) opening.push('cast');
        if (opening.length) break;
      }
    }
    expect(opening[0], 'the knight opened by casting').toBe('technique');
  });

  it('a monster’s working runs on its own clock, per specimen', () => {
    const { g, foe } = facing('paladin_x');
    fight(g, 600, () => !!foe.cooldowns);
    expect(foe.cooldowns, 'no cooldown recorded').toBeDefined();
    // Keyed by index into `casts`, so authoring order reads as preference.
    expect(Object.keys(foe.cooldowns!)).toContain('0');
    expect(foe.cooldowns![0]).toBeGreaterThan(g.state.totalTicks);
  });
});

// ---------- The physical triangle ----------

describe('cut, crush and pierce as verbs', () => {
  it('each buys one leg at the other two’s expense', () => {
    const cut = composeArcane(['fire', 'cut'])!.strikes[0];
    const crush = composeArcane(['fire', 'crush'])!.strikes[0];
    const pierce = composeArcane(['fire', 'pierce'])!.strikes[0];

    // All three carry the SUBSTANCE — fire stays fire, however delivered.
    for (const s of [cut, crush, pierce]) expect(s.type).toBe('heat');

    // Damage: crush > pierce > cut.
    expect(crush.power).toBeGreaterThan(pierce.power);
    expect(pierce.power).toBeGreaterThan(cut.power);

    // Status rate: cut > pierce > crush (base chance 0.35).
    const rate = (s: typeof cut) => s.inflicts![0].chance!;
    expect(rate(cut)).toBeGreaterThan(rate(pierce));
    expect(rate(pierce)).toBeGreaterThan(rate(crush));
    expect(rate(cut)).toBeGreaterThan(0.35); // readier than the bare word

    // Penetration: pierce alone.
    expect(pierce.penetration).toBeGreaterThan(0);
    expect(cut.penetration).toBeUndefined();
    expect(crush.penetration).toBeUndefined();
  });

  it('spoken bare, a physical verb IS its own substance', () => {
    const cut = composeArcane(['cut'])!.strikes[0];
    expect(cut.type).toBe('slashing');
    expect(cut.inflicts?.[0].id).toBe('bleeding');
    expect(composeArcane(['crush'])!.strikes[0].type).toBe('bludgeoning');
    expect(composeArcane(['pierce'])!.strikes[0].inflicts?.[0].id).toBe('punctured');
    // A noun still overrides: the verb only supplies what is missing.
    expect(composeArcane(['ice', 'crush'])!.strikes[0].inflicts?.[0].id).toBe('chilled');
  });

  it('delivery never reaches certainty, however deep the verb is stacked', () => {
    const deep = composeArcane(['fire', 'cut', 'cut', 'cut'])!.strikes[0];
    expect(deep.inflicts![0].chance).toBeLessThanOrEqual(0.95);
    expect(deep.inflicts![0].chance).toBeGreaterThan(composeArcane(['fire', 'cut'])!.strikes[0].inflicts![0].chance!);
  });
});

// ---------- Overgrowth: the grammar's darkest gift ----------

describe('healing enemies into overgrowth', () => {
  it('a mending follows a SPOKEN address; unspoken stays the caster’s', () => {
    // Every sentence written before this rule means what it always meant.
    expect(composeArcane(['water', 'mend'])!.healsEnemy).toBeUndefined();
    expect(composeArcane(['water', 'mend', 'me'])!.healsEnemy).toBeUndefined();
    const cruel = composeArcane(['water', 'mend', 'one'])!;
    expect(cruel.healsEnemy).toBe(true);
    expect(cruel.heal).toBeGreaterThan(0);
  });

  function arena(seed = 3) {
    const g = fresh(seed);
    g.state.spot = 'woods_edge';
    const a = spawnMonster(g.state, SPOTS.woods_edge);
    const b = spawnMonster(g.state, SPOTS.woods_edge);
    g.state.combat = {
      enemies: [a, b, null, null, null],
      playerBar: 0,
      momentum: 0,
      position: 'neutral',
      cooldowns: {},
      buffs: [],
      events: {},
    };
    return { g, a, b };
  }

  it('overflow healing feeds the ledger, swells, escalates, and bursts', () => {
    const { g, a, b } = arena();
    const maxHp = monsterStats(a).maxHp;
    a.hp = maxHp; // already whole: every drop overflows

    // A first overdose: overgrown, ledger open.
    healEnemy(g.state, 0, maxHp * 0.3, 'test');
    let held = findStatus(a, 'overgrowth')!;
    expect(held).toBeDefined();
    expect(held.data!.surplus).toBeCloseTo(maxHp * 0.3, 3);

    // Past half its max HP in surplus: the growth takes on a will of its own.
    healEnemy(g.state, 0, maxHp * 0.3, 'test');
    expect(findStatus(a, 'overgrowth')).toBeUndefined();
    held = findStatus(a, 'proliferating')!;
    expect(held.data!.surplus).toBeCloseTo(maxHp * 0.6, 3);

    // A full max HP of surplus: the body cannot hold it.
    const otherHpBefore = b.hp;
    healEnemy(g.state, 0, maxHp * 0.5, 'test');
    expect(findStatus(a, 'proliferating')).toBeUndefined();
    expect(a.hp).toBeLessThan(0); // took its own ledger
    expect(b.hp).toBeLessThan(otherHpBefore); // showered its ally
  });

  it('a strikeless working deals no chip damage and prints no strike line', () => {
    const { g, a } = arena(5);
    const before = a.hp;
    const spec = composeArcane(['water', 'mend', 'one'])!;
    g.state.combatFeed.length = 0;
    castCraftedAttack(g.state, g.bus, 'test', spec);
    // The mending is the whole event: no blow, no "strikes for 1".
    expect(g.state.combatFeed.some((f) => f.text.includes('strikes'))).toBe(false);
    expect(a.hp).toBeGreaterThanOrEqual(before);
  });

  it('the ledger sheds on its own — a swelling left alone subsides', () => {
    const { g, a } = arena(11);
    const maxHp = monsterStats(a).maxHp;
    a.hp = maxHp;
    healEnemy(g.state, 0, maxHp * 0.05, 'test');
    const held = findStatus(a, 'overgrowth')!;
    const opened = held.data!.surplus!;

    const ctx = { hp: a.hp, maxHp, inCombat: true };
    tickStatuses(g.state, a, ctx);
    expect(findStatus(a, 'overgrowth')!.data!.surplus).toBeLessThan(opened);

    // Left entirely alone, it eventually empties and the condition ends.
    for (let i = 0; i < 2000 && findStatus(a, 'overgrowth'); i++) tickStatuses(g.state, a, ctx);
    expect(findStatus(a, 'overgrowth')).toBeUndefined();
  });

  it('forced life accrues in full, wounded or not — the healing is the price', () => {
    const { g, a } = arena(17);
    const maxHp = monsterStats(a).maxHp;
    // A wounded target: the working closes the wound AND still accrues the
    // whole of what was forced in. This is what makes it worth speaking at
    // anything that is not already whole.
    a.hp = maxHp * 0.5;
    healEnemy(g.state, 0, maxHp * 0.3, 'test');
    expect(a.hp).toBeCloseTo(maxHp * 0.8, 3);
    expect(findStatus(a, 'overgrowth')!.data!.surplus).toBeCloseTo(maxHp * 0.3, 3);

    // And it never over-fills: the wound closes, the rest simply arrives —
    // and 0.7 of a max HP in forced life has already taken on a will.
    healEnemy(g.state, 0, maxHp * 0.4, 'test');
    expect(a.hp).toBeCloseTo(maxHp, 3);
    const ledger = findStatus(a, 'proliferating') ?? findStatus(a, 'overgrowth')!;
    expect(ledger.id).toBe('proliferating');
    expect(ledger.data!.surplus).toBeCloseTo(maxHp * 0.7, 3);
  });

  it('a modest ledger survives on an enormous body — the floor is absolute', () => {
    // The Benchmark Post case: ~1M max HP. A few hundred points of forced
    // life is a real swelling on it, not a rounding error, so nothing about
    // getting rid of the ledger may scale with the body it rides.
    const { g, a } = arena(23);
    a.attrs.con = 143_000;
    const maxHp = monsterStats(a).maxHp;
    expect(maxHp).toBeGreaterThan(500_000);
    a.hp = maxHp;

    healEnemy(g.state, 0, 300, 'test');
    const ctx = { hp: a.hp, maxHp, inCombat: true };
    // A minute of ticking barely dents it, and it is certainly still there.
    for (let i = 0; i < 600; i++) tickStatuses(g.state, a, ctx);
    const held = findStatus(a, 'overgrowth');
    expect(held, 'a 300 ledger must not be discarded as a sliver').toBeDefined();
    expect(held!.data!.surplus).toBeGreaterThan(50);
  });

  it('kindness from their own side settles the growth instead of feeding it', () => {
    const { g, a } = arena(13);
    const maxHp = monsterStats(a).maxHp;
    // Open a ledger far deeper than the mending that follows, so the cure
    // is visible rather than total.
    a.hp = maxHp;
    healEnemy(g.state, 0, maxHp * 4, 'test');
    const held = findStatus(a, 'proliferating') ?? findStatus(a, 'overgrowth')!;
    const before = held.data!.surplus!;

    // Wound it, then have its OWN side mend it: two thirds lands as health,
    // and the ledger falls by the WHOLE amount (the withheld third undoing
    // three apiece). Hostile healing would have added instead.
    a.hp = maxHp * 0.5;
    healEnemy(g.state, 0, maxHp * 0.45, 'test', false);
    expect(a.hp).toBeCloseTo(maxHp * 0.5 + maxHp * 0.3, 3);
    const after = (findStatus(a, 'proliferating') ?? findStatus(a, 'overgrowth'))!.data!.surplus!;
    expect(after).toBeCloseTo(before - maxHp * 0.45, 3);
  });

  it('kindness toward an unswollen enemy is simply healing', () => {
    const { g, a } = arena(9);
    const maxHp = monsterStats(a).maxHp;
    a.hp = maxHp * 0.4;
    healEnemy(g.state, 0, maxHp * 0.3, 'test', false);
    expect(a.hp).toBeCloseTo(maxHp * 0.7, 3);
    expect(findStatus(a, 'overgrowth')).toBeUndefined();
  });
});

// ---------- Magnetism ----------

describe('magnetized iron', () => {
  const dummy = () => {
    const g = fresh(21);
    const m = spawnMonster(g.state, SPOTS.woods_edge);
    return { g, m };
  };

  it('lightning never misses magnetized flesh; iron finds the seam', () => {
    const { g, m } = dummy();
    expect(magnetBypassesDodge(g.state, m, 'lightning')).toBe(false);
    applyStatus(g.state, m, { id: 'magnetized', intensity: 2 }, 'test');
    // Always-hit is absolute for its element, whatever the roll says.
    for (let i = 0; i < 20; i++) expect(magnetBypassesDodge(g.state, m, 'lightning')).toBe(true);
    // Iron knows where the iron is: +5% crit per point, piercing only.
    expect(magnetCritChance(m, 'piercing')).toBeCloseTo(0.1, 5);
    expect(magnetCritChance(m, 'heat')).toBe(0);
  });

  it('the lock nullifies evasion outright and discharges into one crit', () => {
    const { g, m } = dummy();
    applyStatus(g.state, m, { id: 'magnet_lock', intensity: 3 }, 'test');
    // Nothing they do avoids anything, of any element.
    for (const type of ['heat', 'slashing', 'dark'] as const) {
      expect(magnetBypassesDodge(g.state, m, type)).toBe(true);
    }
    // The charge collapses into the next crit — once.
    const charge = consumeMagnetCharge(m);
    expect(charge).toBeGreaterThan(0);
    expect(findStatus(m, 'magnet_lock')).toBeUndefined();
    expect(consumeMagnetCharge(m)).toBe(0);
  });

  it('enough iron locks on its own', () => {
    const { g, m } = dummy();
    for (let i = 0; i < 6; i++) applyStatus(g.state, m, { id: 'magnetized', intensity: 1 }, 'test');
    expect(findStatus(m, 'magnetized')).toBeUndefined();
    expect(findStatus(m, 'magnet_lock')).toBeDefined();
  });
});

// ---------- Content sanity ----------

describe('spellcraft content', () => {
  it('every word carries exactly the payload its kind promises', () => {
    for (const w of Object.values(ARCANE_WORDS)) {
      expect(w.id).toBeTruthy();
      if (w.kind === 'noun') {
        expect(w.element).toBeTruthy();
        expect(w.power).toBeGreaterThan(0);
      }
      if (w.kind === 'verb') expect(w.verb).toBeTruthy();
      if (w.kind === 'adverb') expect(w.adverb).toBeTruthy();
      if (w.kind === 'target') expect(w.target).toBeTruthy();
      if (w.kind === 'conjunction') expect(w.conjunction).toBeTruthy();
      if (w.kind === 'target' || w.kind === 'conjunction') {
        // Addresses and conjunctions never deepen — tier names here are bugs.
        expect(w.stacked, `${w.id} must not stack`).toBeUndefined();
      } else {
        // Everything else deepens, and owns both of its deepened names.
        expect(w.stacked, `${w.id} needs stacked names`).toHaveLength(2);
      }
    }
  });

  it('every condition a word or miracle touches actually exists', () => {
    for (const w of Object.values(ARCANE_WORDS)) {
      for (const app of w.inflicts ?? []) expect(STATUSES[app.id], `${w.id} inflicts ${app.id}`).toBeTruthy();
    }
    for (const m of MIRACLE_LIST) {
      for (const s of m.spec.strikes) {
        for (const app of s.inflicts ?? []) expect(STATUSES[app.id], `${m.id} inflicts ${app.id}`).toBeTruthy();
      }
      for (const app of m.spec.grants ?? []) expect(STATUSES[app.id], `${m.id} grants ${app.id}`).toBeTruthy();
      for (const list of [m.spec.transfers?.statuses, m.spec.amplify?.statuses, m.spec.empowered?.statuses]) {
        for (const id of list ?? []) expect(STATUSES[id], `${m.id} references ${id}`).toBeTruthy();
      }
    }
  });

  it('every miracle belongs to a real deity, and every deity tag is registered', () => {
    for (const m of MIRACLE_LIST) {
      expect(DEITIES[m.deity], `${m.id} deity ${m.deity}`).toBeTruthy();
      expect(m.spec.deity, `${m.id} spec must not hardcode a deity — divine.ts stamps it`).toBeUndefined();
    }
    for (const d of Object.values(DEITIES)) {
      for (const t of d.tags) expect(DEITY_TAGS[t], `${d.id} tag ${t}`).toBeTruthy();
      for (const rule of [...(d.synergies ?? []), ...(d.hostilities ?? [])]) {
        for (const t of [...rule.anyOf, ...(rule.unless ?? []), ...(rule.waiver ?? [])]) {
          expect(DEITY_TAGS[t], `${d.id} rule tag ${t}`).toBeTruthy();
        }
      }
      // A deity with no miracles is a shrine to nothing.
      expect(MIRACLE_LIST.some((m) => m.deity === d.id), `${d.id} grants no miracles`).toBe(true);
      // A tag with no axis cannot be filtered on, so it would be invisible on
      // the shelf however faithfully it described the god.
      for (const t of d.tags) {
        const axis = DEITY_TAGS[t]?.category;
        expect(
          DEITY_TAG_CATEGORIES.some((c) => c.id === axis),
          `${d.id} tag ${t} has unknown axis '${axis}'`,
        ).toBe(true);
      }
      // A pantheon claimed must exist, or the claimant quietly stands alone.
      if (d.pantheon) {
        expect(PANTHEONS[d.pantheon], `${d.id} claims unknown pantheon ${d.pantheon}`).toBeTruthy();
      }
    }
  });

  it('every sentence of known starter words composes or fizzles, never throws', () => {
    const ids = Object.keys(ARCANE_WORDS);
    for (const a of ids) {
      for (const b of ids) {
        expect(() => composeArcane([a, b])).not.toThrow();
      }
    }
  });

  it('no two psionic recognitions claim the same region', () => {
    // Identical (region, priority, tier) means neither can ever beat the
    // other and the earlier-declared one always answers — the later would
    // exist but never be found, silently. That is a content bug; fail it here.
    const fingerprint = (r: PsionicRecognitionDef) =>
      JSON.stringify([
        Object.entries(r.region).sort(([a], [b]) => a.localeCompare(b)),
        r.priority ?? 0,
        r.tier ?? 0,
      ]);
    const seen = new Map<string, string>();
    for (const r of PSI_RECOGNITION_LIST) {
      const fp = fingerprint(r);
      expect(
        seen.get(fp),
        `recognitions '${seen.get(fp)}' and '${r.id}' claim the same region — one can never be found; change a bound or set priority`,
      ).toBeUndefined();
      seen.set(fp, r.id);
    }
  });

  it('every recognition names a region that some shape actually reaches', () => {
    // A region nobody can land in is a name that does not exist. Sweep the
    // shapes a maxed mind can hold and insist each recognition turns up.
    const axes = ['force', 'reach', 'grip', 'speed', 'clairvoyance', 'space', 'mass', 'vitality'] as const;
    const found = new Set<string>();
    // Coarse sweep: every axis at 0/4/8, three axes at a time.
    for (let i = 0; i < axes.length; i++) {
      for (let j = 0; j < axes.length; j++) {
        for (let k = 0; k < axes.length; k++) {
          for (const points of [[8, 4, 2], [8, 8, 8], [4, 2, 2], [10, 10, 10]]) {
            const shape = { [axes[i]]: points[0], [axes[j]]: points[1], [axes[k]]: points[2] };
            const r = recogniseShape(shape, 12);
            if (r) found.add(r.id);
          }
        }
      }
    }
    for (const r of PSI_RECOGNITION_LIST) {
      expect(found.has(r.id), `no shape reaches '${r.id}' — its region is unreachable content`).toBe(true);
    }
  });

  it('spell keys preserve order for arcane and identity for the rest', () => {
    expect(spellKey({ school: 'arcane', words: ['fire', 'pierce'] })).not.toBe(
      spellKey({ school: 'arcane', words: ['pierce', 'fire'] }),
    );
    expect(spellKey({ school: 'divine', litany: 'litany_mending' })).toBe('divine:litany_mending');
  });
});

// ---------- Saves ----------

describe('save migration', () => {
  it('v21 saves arrive with an empty grimoire and no standing anywhere', () => {
    const raw = JSON.parse(JSON.stringify(createInitialState(1))) as Record<string, unknown>;
    raw.version = 21;
    delete raw.grimoire;
    delete raw.favor;
    const migrated = migrate(raw, 23) as GameState;
    expect(migrated.grimoire).toEqual([]);
    expect(migrated.favor).toEqual({});
  });

  it('v22 pooled favor is honoured by every deity', () => {
    const raw = JSON.parse(JSON.stringify(createInitialState(1))) as Record<string, unknown>;
    raw.version = 22;
    raw.favor = 4;
    const migrated = migrate(raw, 23) as GameState;
    for (const id of Object.keys(DEITIES)) expect(migrated.favor[id]).toBe(4);
  });
});

// ---------- Casting ----------

describe('casting in combat', () => {
  function battleMage(seed = 7) {
    const g = fresh(seed);
    g.state.spot = 'woods_edge';
    mage(g);
    g.state.attrs.int.level = 30;
    g.state.resources.mana = 30;
    return g;
  }

  it('a prepared offensive spell casts on the swing and spends mana', () => {
    const g = battleMage();
    const spell = inscribeArcane(g.state, g.bus, ['fire', 'pierce'])!;
    setPrepared(g.state, g.bus, spell.uid, true);
    g.selectActivity('hunt');

    let cast = false;
    let spentSomething = false;
    for (let i = 0; i < 4000 && !cast; i++) {
      const before = g.state.resources.mana;
      g.tick();
      if (g.state.combatFeed.some((f) => f.text.includes('Fire Pierce'))) {
        cast = true;
        // The cast tick spends far more than a tick of regen gives back.
        spentSomething = g.state.resources.mana < before;
      }
    }
    expect(cast).toBe(true);
    expect(spentSomething).toBe(true);
  });

  it('prepared spells join the rotation and reorder like any entry', () => {
    const g = fresh();
    mage(g);
    // A known technique to order against.
    g.state.techniques.gather = { executions: 0, form: 'canonical' };
    const tid = 'technique:gather';
    const spell = inscribeArcane(g.state, g.bus, ['fire', 'pierce'])!;
    setPrepared(g.state, g.bus, spell.uid, true);
    const gid = `grimoire:${spell.uid}`;

    // In the rotation, after techniques by default.
    let rotation = activeRotation(g.state);
    expect(rotation).toContain(gid);
    expect(rotation.indexOf(gid)).toBeGreaterThan(rotation.indexOf(tid));

    // A nudge materialises the order and moves it like any entry would.
    g.moveSkill(gid, -1);
    rotation = activeRotation(g.state);
    expect(rotation.indexOf(gid)).toBeLessThan(rotation.indexOf(tid));

    // Standing it down removes it from the rotation; its slot in the saved
    // order stays inert until it is prepared again.
    setPrepared(g.state, g.bus, spell.uid, false);
    expect(activeRotation(g.state)).not.toContain(gid);
    setPrepared(g.state, g.bus, spell.uid, true);
    expect(activeRotation(g.state).indexOf(gid)).toBeLessThan(activeRotation(g.state).indexOf(tid));
  });

  it('a ward casts from the buff slot and is worn as a buff', () => {
    const g = battleMage(11);
    const spell = inscribeArcane(g.state, g.bus, ['ice', 'ward'])!;
    setPrepared(g.state, g.bus, spell.uid, true);
    g.selectActivity('hunt');

    let warded = false;
    for (let i = 0; i < 4000 && !warded; i++) {
      g.tick();
      if (g.state.combat?.buffs.some((b) => b.name === 'Ward')) warded = true;
    }
    expect(warded).toBe(true);
  });
});

// ---------- Skilling the vocabulary ----------

describe('word skills', () => {
  it('every word has one, parented to Arcana, tagged only to itself', () => {
    for (const w of Object.values(ARCANE_WORDS)) {
      const skill = SKILLS[wordSkillId(w.id)];
      expect(skill, `${w.id} has no word skill`).toBeDefined();
      expect(skill.parent).toBe('arcana');
      // Saying "fire" must never teach "ice": one tag, its own.
      expect(skill.tags).toEqual([wordTag(w.id)]);
    }
  });

  it('practice makes a word heavier — and only that word', () => {
    const g = fresh();
    const bare = composeArcane(['fire', 'crush'])!;
    const practised = composeArcane(['fire', 'crush'], { fire: 20 })!;
    expect(practised.strikes[0].power).toBeCloseTo(
      bare.strikes[0].power * (1 + WORD_POWER_PER_LEVEL * 20),
      5,
    );
    // A level in a word this sentence never spoke changes nothing.
    expect(composeArcane(['fire', 'crush'], { ice: 40 })!.strikes[0].power)
      .toBeCloseTo(bare.strikes[0].power, 5);
    // Every word in the clause compounds, so a practised sentence beats a
    // practised word.
    const both = composeArcane(['fire', 'crush'], { fire: 20, crush: 20 })!;
    expect(both.strikes[0].power).toBeGreaterThan(practised.strikes[0].power);
    // Mendings and wards read the same practice as strikes do.
    expect(composeArcane(['water', 'mend'], { mend: 30 })!.heal!).toBeGreaterThan(
      composeArcane(['water', 'mend'])!.heal!,
    );
    expect(g).toBeDefined();
  });

  it('the grimoire lists the BARE reading; the caster reads their own', () => {
    const g = fresh();
    mage(g);
    const spell = inscribeArcane(g.state, g.bus, ['fire', 'crush'])!;
    const bare = resolveSpell(spell).strikes[0].power;
    g.state.skills[wordSkillId('fire')] = { level: 30, xp: 0 };
    // The cache still holds the sentence as the grammar has it…
    expect(resolveSpell(spell).strikes[0].power).toBeCloseTo(bare, 5);
    // …while the speaker's own reading counts what they know.
    expect(resolveSpellFor(g.state, spell).strikes[0].power).toBeGreaterThan(bare);
  });

  it('inscribing practises nothing; only a cast wears a word in', () => {
    const g = fresh();
    mage(g);
    const before = { ...g.state.skills };
    const spell = inscribeArcane(g.state, g.bus, ['fire', 'crush'])!;
    // The grammar learned something; the words did not — nobody spoke them.
    expect(g.state.skills[wordSkillId('fire')]).toBeUndefined();
    expect(g.state.skills[wordSkillId('crush')]).toBeUndefined();
    expect(g.state.skills.arcana?.xp ?? 0).toBeGreaterThanOrEqual(before.arcana?.xp ?? 0);
    grantCastWordXp(g.state, g.bus, spell.uid);
    expect(g.state.skills[wordSkillId('fire')]?.xp ?? 0).toBeGreaterThan(0);
    expect(g.state.skills[wordSkillId('crush')]?.xp ?? 0).toBeGreaterThan(0);
  });

  it('a costly sentence teaches more, but logarithmically', () => {
    const xpFor = (mana: number) => {
      const g = fresh();
      g.state.skills.magic = { level: 1, xp: 0 };
      g.state.skills.arcana = { level: 1, xp: 0 };
      g.state.skills[wordSkillId('fire')] = { level: 1, xp: 0 };
      grantWordXp(g.state, g.bus, ['fire'], mana);
      // Total practice, not the residue in the current level — a dear sentence
      // can level the word outright and leave less xp showing than a cheap one.
      const s = g.state.skills[wordSkillId('fire')];
      let total = s.xp;
      for (let l = 1; l < s.level; l++) total += skillXpNeeded(wordSkillId('fire'), l);
      return total;
    };
    const cheap = xpFor(4);
    const dear = xpFor(80);
    expect(dear).toBeGreaterThan(cheap);
    // Twenty times the cost is worth far less than twenty times the practice.
    expect(dear).toBeLessThan(cheap * 4);
  });

  it('milestones give back the word\u2019s own nature', () => {
    const lightning = SKILLS[wordSkillId('spark')];
    expect(lightning.milestones?.length).toBe(WORD_MILESTONE_LEVELS.length);
    expect(lightning.milestones![0].bonus[0].stat).toBe('speed');
    expect(SKILLS[wordSkillId('stone')].milestones![0].bonus[0].stat).toBe('armor');
    expect(SKILLS[wordSkillId('gust')].milestones![0].bonus[0].stat).toBe('dodge');
  });
});
