import type { ProseTable } from './prose';

// Player-facing text for src/core/data/superattrs.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- SUPERATTRS ----------
export const SUPERATTRS_TEXT: ProseTable = {
  'dominion.desc': 'Fuses Strength and Charisma: once unlocked, each reads as the sum of both everywhere. Requires Strength 60, Charisma 60, 500 kills and 25,000 gold earned.',

  'force.desc': 'Fuses Intelligence and Constitution: once unlocked, each reads as the sum of both everywhere. Requires Intelligence 60, Constitution 60 and Magic 20.',

  'martial_prowess.desc': 'Fuses Dexterity and Wisdom: once unlocked, each reads as the sum of both everywhere. Requires Dexterity 60, Wisdom 60 and Ittou-ryu 10.',
};
