import type { ProseTable } from './prose';

// Player-facing text for src/core/data/preps.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- PREPS ----------
export const PREPS_TEXT: ProseTable = {
  'sliced.desc': 'Knife technique. Sliced ingredients fit the Cold Counter; a basket of fitted cuts comes out about a grade better than the same basket whole.',

  'diced.desc': 'Knife technique, Cooking 4. Diced ingredients fit the Cooking Stove; a basket of fitted cuts comes out about a grade better than the same basket whole.',

  'julienned.desc': 'Knife technique, Cooking 10. Julienned ingredients fit the Open Grill; a basket of fitted cuts comes out about a grade better than the same basket whole.',
};
