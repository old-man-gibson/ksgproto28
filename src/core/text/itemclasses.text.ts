import type { ProseTable } from './prose';

// Player-facing text for src/core/data/itemclasses.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.
//
// Only the degenerate classes carry a line: they are the placements that resolve to a
// product nobody set out to make, and the player is told what it counts as.

// ---------- ITEM_CLASSES ----------
export const ITEM_CLASSES_TEXT: ProseTable = {
  'hoop_pole.desc': 'A ring on a haft. Counts as a two-handed staff at 60% strength.',
  'signpost.desc': 'A plate on a long haft. Counts as a two-handed blunt weapon at 60% strength.',
  'armour_scrap.desc': 'A strapped plate under 9 cells. Counts as an accessory at 60% strength.',
  'unstrapped_plate.desc': 'A plate with no strap. Counts as chest armour at 60% strength.',
  'nail.desc': 'A spearhead with no haft. Counts as a light weapon at 60% strength.',
  'twin_blade.desc': 'Two blades on one pole. Counts as a two-handed weapon at 60% strength.',
  'bare_blade.desc': 'A blade with no handle. Counts as a light weapon at 60% strength.',
  'stick.desc': 'A handle with no head. Counts as a light weapon at 60% strength.',
  'paperweight.desc': 'Matches any placement no other class accepts. An accessory with no stats.',
};
