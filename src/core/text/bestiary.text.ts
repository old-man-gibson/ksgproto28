import type { ProseTable } from './prose';

// Player-facing text for src/core/data/bestiary.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- MONSTER_TAGS ----------
export const MONSTER_TAGS_TEXT: ProseTable = {
  'living.desc': 'Material tag: a flesh body. Adds no innate armour or resistance.',

  'inorganic.desc': 'Material tag: gel, stone or metal. Gives 3 innate armour unless the species declares its own.',

  'incorporeal.desc': 'Material tag: no solid body. Attaches no armour or resistance rule of its own.',

  'eldritch.desc': 'Taxon tag for eldritch creatures. Attaches no mechanical rule.',

  'non_elemental.desc': 'Element tag assigned when a monster claims no element. No elemental resistance or weakness follows from it.',

  'ranged.desc': 'Derived from the monster reach: it attacks from the back rank. Ranged resistance applies to its hits.',

  'swarm.desc': 'Derived from its group rule: spawns in groups of two or more.',

  'solitary.desc': 'Derived from its group rule: always spawns alone.',

  'leader.desc': 'Derived from its escort list: spawns with escorts of the listed species.',

  'unique.desc': 'Trait tag: one individual of this species exists.',

  'splitter.desc': 'Trait tag: splits into more units when damaged.',
};

// ---------- BESTIARY_FACTS ----------
export const BESTIARY_FACTS_TEXT: ProseTable = {
  'lore.hint': 'Reveals the field notes for this species. Can unlock from 1 kill; guaranteed at 10.',

  'rewards.hint': 'Reveals experience and coin per kill. Can unlock from 2 kills; guaranteed at 20.',

  'vitals.hint': 'Reveals health and evasion. Can unlock from 3 kills; guaranteed at 30.',

  'offense.hint': 'Reveals damage, damage type, attack interval and reach. Can unlock from 3 kills; guaranteed at 30.',

  'behavior.hint': 'Reveals group size, escorts and rank behaviour. Can unlock from 5 kills; guaranteed at 45.',

  'defenses.hint': 'Reveals resistances and weaknesses. Can unlock from 8 kills; guaranteed at 70.',

  'loot_common.hint': 'Reveals the common drop table with chances. Can unlock from 5 kills; guaranteed at 45.',

  'loot_rare.hint': 'Reveals the rare drop table with chances. Can unlock from 15 kills; guaranteed at 150.',
};
