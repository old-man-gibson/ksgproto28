import type { ProseTable } from './prose';

// Player-facing text for src/core/data/attributes.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- ATTRIBUTE_TRAINING ----------
export const ATTRIBUTE_TRAINING_TEXT: ProseTable = {
  'str.desc': 'Trains Strength: +1 every 5 levels, +1% every 10. Ranks at 21, 41, 61 and 81 add flat and percentage damage.',

  'dex.desc': 'Trains Dexterity: +1 every 5 levels, +1% every 10. Ranks at 21, 41, 61 and 81 add speed; rank 81 also shortens the action bar by 8%.',

  'con.desc': 'Trains Constitution: +1 every 5 levels, +1% every 10. Ranks at 21, 41, 61 and 81 add maximum health; rank 61 also adds 2 armour.',

  'int.desc': 'Trains Intelligence. Ranks at 21, 41, 61 and 81 add spell power and skill experience; milestones at 5, 7 and 10 add skill experience, Intelligence and maximum mana.',

  'wis.desc': 'Trains Wisdom: +1 every 5 levels, +1% every 10. Ranks at 21, 41, 61 and 81 add training experience and loot.',

  'cha.desc': 'Trains Charisma: +1 every 5 levels, +1% every 10. Ranks at 21, 41, 61 and 81 add gold gain.',
};
