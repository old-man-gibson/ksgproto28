import type { ProseTable } from './prose';

// Player-facing text for src/core/data/bestiary.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- MONSTER_TAGS ----------
export const MONSTER_TAGS_TEXT: ProseTable = {
  'living.desc': 'Flesh, blood, and the usual mortal weaknesses.',

  'inorganic.desc': 'Matter without metabolism — gel, stone, metal.',

  'incorporeal.desc': 'Has no body worth cutting.',

  'eldritch.desc': 'Wrong in a way the eye reports late.',

  'non_elemental.desc': 'Bound to no element. Derived when a monster claims none.',

  'ranged.desc': 'Attacks from the back rank. Derived from the monster’s reach.',

  'swarm.desc': 'Comes in numbers, or not at all.',

  'solitary.desc': 'Never seen with company. Derived from its group rule.',

  'leader.desc': 'Brings an escort. Derived from its escort list.',

  'unique.desc': 'There is only one, and it knows it.',

  'splitter.desc': 'Cut it and there is simply more of it.',
};

// ---------- BESTIARY_FACTS ----------
export const BESTIARY_FACTS_TEXT: ProseTable = {
  'lore.hint': 'You have seen it die. You have not yet understood it.',

  'rewards.hint': 'You would have to keep count to know what one is worth.',

  'vitals.hint': 'How much punishment it soaks is still guesswork.',

  'offense.hint': 'You know it hurts. You could not say how much, or with what.',

  'behavior.hint': 'Its habits — packs, escorts, tactics — remain unread.',

  'defenses.hint': 'Which blows it shrugs off, and which it fears, is unknown.',

  'loot_common.hint': 'You have not butchered enough to know what they carry.',

  'loot_rare.hint': 'Rumours of rarer prizes. Nothing you could put odds on.',
};
