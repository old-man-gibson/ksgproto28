import type { ProseTable } from './prose';

// Player-facing text for src/core/data/titles.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- TITLES ----------
export const TITLES_TEXT: ProseTable = {
  'iconoclast.desc': 'Receive ten miracles. The gods call it devotion; you call it a collection — and worn, this title lets hostile powers share a grimoire page whether they like it or not.',

  'wanderer.desc': 'Complete 50 journeys between spots. The road knows your name.',

  'slayer.desc': 'Fell 100 creatures. They flinch before you swing.',

  'titan_incarnate.desc': 'Reach Strength 100. Mountains politely step aside.',

  'first_blade.desc': 'Defeat the Goblin Warchief having never raised any weapon family but your first.',

  'untouchable.desc': 'Defeat the Goblin Warchief without ever having been knocked out.',
};
