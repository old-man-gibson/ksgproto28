import type { ProseTable } from './prose';

// Player-facing text for src/core/data/festival.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- ROYALE_STRATEGIES ----------
export const ROYALE_STRATEGIES_TEXT: ProseTable = {
  'press_nearest.desc': 'Walk at the nearest fighter you can see. With no one in sight, roam until the radar finds one. Fights come quickly, one after another.',
  'hunt_weakest.desc': 'Walk at the weakest fighter within sight: the wounded and the ones who have won least. Falls back on the nearest in sight; with no one in sight, roam.',
  'hold_centre.desc': 'Walk to the middle of the field and stand there. Whoever crosses it comes to you.',
  'keep_away.desc': 'Walk away from the nearest fighter you can see. With no one in sight, roam. A fight still starts when someone corners you.',
  'wait_at_edge.desc': 'Walk to the nearest edge of the field and stand there while the middle thins out.',
  'fall_back_hurt.desc': 'While hurt, walk away from the nearest fighter you can see until health returns. With no one in sight, roam.',
  'lie_low.desc': 'While the field is crowded, walk away from the nearest fighter you can see. With no one in sight, roam.',
  'loot_while_crowded.desc': 'While more than 50 survivors are left, walk to the nearest open cache you know of: in a section you have scouted or stood in, or in sight. With none, roam. Caches lend gear for the attempt or restore health.',
  'take_cover_hurt.desc': 'While hurt, walk to the nearest forest or cave and stay there: anyone inside is seen at half range. With no cover on the map, roam.',
  'wander.desc': 'Walk to a point in another section of the field, then another. Keeps the heading until it arrives, whoever is in sight.',
};

// ---------- ROYALE_SECTIONS ----------
export const ROYALE_SECTIONS_TEXT: ProseTable = {
  'cliff.desc': 'A ridge along the far edge of the field. Slow going, but whoever stands on it sees far. Harpies nest on it.',
  'waterfall.desc': 'Where the river comes off the cliff. Loud and wet: slow going and short sight. A serpent holds the pool.',
  'river.desc': 'The river from the waterfall to the near edge. Wading it is slow.',
  'bank.desc': 'The strips of firm ground either side of the river.',
  'cave.desc': 'A cave in the far corner. Dark: short sight, and anyone inside is hard to see. A bear sleeps in it.',
  'glade.desc': 'A clearing in the forest around a spring. Standing in it heals.',
  'forest.desc': 'The large wood on the west side. Slower going and short sight; anyone inside is hard to see. Wolves den in it.',
  'village.desc': 'A deserted village on the east side: a smithy, a baker, a guard post and houses, each with something left behind.',
};
