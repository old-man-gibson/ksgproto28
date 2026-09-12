import type { ProseTable } from './prose';

// Player-facing text for src/core/data/attributes.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- ATTRIBUTE_TRAINING ----------
export const ATTRIBUTE_TRAINING_TEXT: ProseTable = {
  'str.desc': 'Grow stronger with each passing day.',

  'dex.desc': 'Sprints, hurdles, and drills to hone reflex and precision.',

  'con.desc': 'Endure more than yesterday. Then more than that.',

  'int.desc': 'Study poems, plays, and treatises to sharpen intellect.',

  'wis.desc': 'Observe, listen, and glean what others miss.',

  'cha.desc': 'Practice rhetoric, presence, and persuasive argument.',
};
