import type { ProseTable } from './prose';

// Player-facing text for src/core/data/festival.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- ROYALE_STRATEGIES ----------
export const ROYALE_STRATEGIES_TEXT: ProseTable = {
  'press_nearest.desc': 'Walk at the nearest fighter on the field. Fights come quickly, one after another.',
  'hunt_weakest.desc': 'Walk at the weakest fighter within sight: the wounded and the ones who have won least. Falls back on the nearest when no one is in sight.',
  'hold_centre.desc': 'Walk to the middle of the field and stand there. Whoever crosses it comes to you.',
  'keep_away.desc': 'Walk away from the nearest fighter. A fight still starts when someone corners you.',
  'wait_at_edge.desc': 'Walk to the nearest edge of the field and stand there while the middle thins out.',
  'fall_back_hurt.desc': 'While hurt, walk away from the nearest fighter until health returns.',
  'lie_low.desc': 'While the field is crowded, walk away from the nearest fighter.',
};
