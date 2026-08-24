import type { Milestone, Modifier, SkillDef } from '../types';
import { ARCANE_WORDS } from './spellcraft.data';
import { PROGRESSIONS } from './progression.data';

/**
 * A skill per WORD.
 *
 * Arcana is the grammar; these are the vocabulary. Knowing a word and folding
 * it deeper (see WORD_MASTERY) says what you may SAY — this says how well you
 * say it. Every word grows from use, pays a small compounding bonus to
 * whatever clause it sits in, and at milestones gives back something of its
 * own nature: lightning quickens the hand, earth thickens the skin, wind
 * teaches the feet.
 *
 * Generated rather than hand-written, because the lexicon is the source of
 * truth: add a word to ARCANE_WORDS and it arrives here with a skill, a
 * curve and its own tag already wired.
 */

/** Skill id for a word, and back again. One place, so nothing guesses. */
export function wordSkillId(wordId: string): string {
  return `word_${wordId}`;
}

/** The tag a sentence emits for each word it spoke. */
export function wordTag(wordId: string): string {
  return `word:${wordId}`;
}

const mods = (...m: Modifier[]) => m;

/**
 * What mastering a word gives back, beyond its own strength.
 *
 * Each is the word's nature turned on the speaker: you do not merely wield
 * lightning better, you become a little quicker for having understood it.
 * Stated at the three thresholds every word shares, so a word's identity is
 * one line rather than a schedule.
 */
const WORD_GIFTS: Record<string, Modifier[]> = {
  // ----- Nouns: the substance leaves its mark on whoever speaks it -----
  spark: mods({ stat: 'speed', op: 'mult', value: 0.02 }),
  stone: mods({ stat: 'armor', op: 'add', value: 1.5 }),
  gust: mods({ stat: 'dodge', op: 'add', value: 0.01 }),
  fire: mods({ stat: 'resHeat', op: 'add', value: 0.03 }),
  ice: mods({ stat: 'resCold', op: 'add', value: 0.03 }),
  water: mods({ stat: 'resWater', op: 'add', value: 0.03 }),
  venom: mods({ stat: 'resPoison', op: 'add', value: 0.03 }),
  light: mods({ stat: 'resLight', op: 'add', value: 0.03 }),
  gloom: mods({ stat: 'resDark', op: 'add', value: 0.03 }),
  arcane: mods({ stat: 'maxMana', op: 'add', value: 2 }),
  zero: mods({ stat: 'penetration', op: 'add', value: 0.02 }),
  cut: mods({ stat: 'crit', op: 'add', value: 0.01 }),
  crush: mods({ stat: 'damage', op: 'mult', value: 0.02 }),
  iron: mods({ stat: 'resPiercing', op: 'add', value: 0.03 }),
  // Patience turned on the speaker: what regrows in the enemy regrows in you.
  seed: mods({ stat: 'hpRegen', op: 'add', value: 0.05 }),

  // ----- Verbs: the doing sharpens the doer -----
  pierce: mods({ stat: 'penetration', op: 'add', value: 0.02 }),
  fly: mods({ stat: 'speed', op: 'mult', value: 0.015 }),
  expand: mods({ stat: 'splash', op: 'add', value: 0.02 }),
  burst: mods({ stat: 'critDamage', op: 'add', value: 0.05 }),
  grasp: mods({ stat: 'spellPower', op: 'mult', value: 0.02 }),
  ward: mods({ stat: 'armor', op: 'add', value: 1 }),
  mend: mods({ stat: 'maxHp', op: 'add', value: 6 }),

  // ----- Adverbs: how you speak becomes how you are -----
  slowly: mods({ stat: 'maxMana', op: 'add', value: 2 }),
  quickly: mods({ stat: 'attackSpeed', op: 'mult', value: 0.02 }),
  twice: mods({ stat: 'crit', op: 'add', value: 0.01 }),
  gently: mods({ stat: 'manaEff', op: 'mult', value: -0.02 }),
  viciously: mods({ stat: 'critDamage', op: 'add', value: 0.05 }),
  intensely: mods({ stat: 'spellPower', op: 'mult', value: 0.02 }),
  dimly: mods({ stat: 'manaRegen', op: 'add', value: 0.02 }),

  // ----- Conjunctions and addresses: the shape of thought itself -----
  then: mods({ stat: 'critDamage', op: 'add', value: 0.04 }),
  and: mods({ stat: 'spellPower', op: 'mult', value: 0.02 }),
  but: mods({ stat: 'spellPower', op: 'mult', value: 0.02 }),
  or: mods({ stat: 'loot', op: 'mult', value: 0.02 }),
  if: mods({ stat: 'skillXp', op: 'mult', value: 0.02 }),
  one: mods({ stat: 'crit', op: 'add', value: 0.01 }),
  others: mods({ stat: 'splash', op: 'add', value: 0.02 }),
  me: mods({ stat: 'maxHp', op: 'add', value: 5 }),
};

/**
 * Where a word's understanding pays out. Deep enough that a gift is an
 * achievement rather than a trickle, and the same for every word so a player
 * can read one schedule and know them all.
 */
export const WORD_MILESTONE_LEVELS = [10, 25, 45];

/** How much of its own strength a word adds per level (compounding per clause). */
export const WORD_POWER_PER_LEVEL = 0.015;

function giftsFor(wordId: string): Milestone[] {
  const gift = WORD_GIFTS[wordId];
  if (!gift) return [];
  // The same gift at each threshold: three of them is a word truly known.
  return WORD_MILESTONE_LEVELS.map((level) => ({ level, bonus: gift }));
}

/** Every word's skill, built from the lexicon itself. */
export function buildWordSkills(): Record<string, SkillDef> {
  const out: Record<string, SkillDef> = {};
  for (const w of Object.values(ARCANE_WORDS)) {
    const id = wordSkillId(w.id);
    out[id] = {
      id,
      name: w.word.charAt(0).toUpperCase() + w.word.slice(1),
      icon: w.icon,
      desc: `Speaking "${w.word}" until it answers. Every level lends the word a little of its own weight; understanding it deeply gives something back.`,
      kind: 'passive',
      category: 'magic',
      // Words are learned by SAYING them, so they grow fast and shallow
      // beside Arcana itself, which is the grammar behind all of them.
      progression: PROGRESSIONS.simple,
      // Only this word's own tag: a sentence emits one per word it spoke, so
      // saying "fire" never teaches "ice".
      tags: [wordTag(w.id)],
      parent: 'arcana',
      unlock: [],
      milestones: giftsFor(w.id),
    };
  }
  return out;
}

export const WORD_SKILLS: Record<string, SkillDef> = buildWordSkills();
