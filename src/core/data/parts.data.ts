import type { PartKindDef, Placement, RuneSizeClass } from '../types';

/**
 * The parts the anvil can place (docs/plans/blueprint-weaponsmithing.md,
 * "Parts"). A part is a rectangle of cells, `w` across the item axis by `l`
 * along it, and the bill for it is `w × l` cells of its material. Which parts
 * an item is made of, and their proportions, decide what class it is
 * (data/itemclasses.data.ts); materials set the numbers (MaterialDef.smith).
 *
 * `accepts` names material tags (`MaterialDef.craftTags`): 'metal', 'wood',
 * 'leather'. A part with no accepting material with a smith profile is
 * unplaceable, and a lint checks that every one is.
 *
 * Notation is width × length as written: a dagger blade is 2×3, a sword blade
 * 2×6. A 4×3 head is an axe head.
 */
export const PART_KINDS: Record<string, PartKindDef> = {
  // ---- Blades: the edge heads ----
  thin: { id: 'thin', name: 'Thin blade', icon: '🗡️', role: 'head', shape: 'edge', w: 1, l: 6, accepts: ['metal'] },
  short: { id: 'short', name: 'Short blade', icon: '🔪', role: 'head', shape: 'edge', w: 2, l: 3, accepts: ['metal'] },
  medium: { id: 'medium', name: 'Medium blade', icon: '🗡️', role: 'head', shape: 'edge', w: 2, l: 4, accepts: ['metal'] },
  long: { id: 'long', name: 'Long blade', icon: '⚔️', role: 'head', shape: 'edge', w: 2, l: 6, accepts: ['metal'] },
  great: { id: 'great', name: 'Great blade', icon: '⚔️', role: 'head', shape: 'edge', w: 2, l: 10, accepts: ['metal'] },
  curved: { id: 'curved', name: 'Curved blade', icon: '🗡️', role: 'head', shape: 'edge', w: 2, l: 6, curved: true, accepts: ['metal'] },
  // The odachi rule needs a curved head of length 9 or more; without this
  // part that class could never be reached.
  curved_l: { id: 'curved_l', name: 'Long curved blade', icon: '🗡️', role: 'head', shape: 'edge', w: 2, l: 10, curved: true, accepts: ['metal'] },
  // ---- Points, axes and mauls ----
  spearhead: { id: 'spearhead', name: 'Spearhead', icon: '🔱', role: 'head', shape: 'point', w: 1, l: 3, accepts: ['metal'] },
  axehead: { id: 'axehead', name: 'Axe head', icon: '🪓', role: 'head', shape: 'edge', w: 4, l: 3, cross: true, accepts: ['metal'] },
  maulhead: { id: 'maulhead', name: 'Maul head', icon: '🔨', role: 'head', shape: 'mass', w: 3, l: 3, cross: true, accepts: ['metal'] },
  // ---- Plates: shields and body armour ----
  plate_s: { id: 'plate_s', name: 'Small plate', icon: '🛡️', role: 'head', shape: 'plate', w: 2, l: 2, accepts: ['metal', 'wood'] },
  plate_m: { id: 'plate_m', name: 'Plate', icon: '🛡️', role: 'head', shape: 'plate', w: 3, l: 3, accepts: ['metal', 'wood'] },
  plate_w: { id: 'plate_w', name: 'Wide plate', icon: '🛡️', role: 'head', shape: 'plate', w: 4, l: 4, accepts: ['metal', 'wood'] },
  plate_t: { id: 'plate_t', name: 'Tall plate', icon: '🛡️', role: 'head', shape: 'plate', w: 3, l: 5, accepts: ['metal', 'wood'] },
  // ---- Bent pieces: helms, limb armour, sickles, bows ----
  bent_s: { id: 'bent_s', name: 'Bent metal (small)', icon: '🪖', role: 'head', shape: 'bent', w: 2, l: 2, qtyMax: 2, accepts: ['metal'] },
  bent_m: { id: 'bent_m', name: 'Bent metal', icon: '🪖', role: 'head', shape: 'bent', w: 2, l: 3, qtyMax: 2, accepts: ['metal'] },
  bent_l: { id: 'bent_l', name: 'Long bent', icon: '🏹', role: 'head', shape: 'bent', w: 2, l: 5, qtyMax: 2, accepts: ['metal', 'wood'] },
  // ---- Rings: mail and jewellery ----
  ring: { id: 'ring', name: 'Metal ring', icon: '⭕', role: 'head', shape: 'ring', w: 1, l: 1, qtyMax: 8, accepts: ['metal'] },
  // ---- Hafts ----
  h3: { id: 'h3', name: 'Short handle', icon: '🪵', role: 'haft', shape: 'bar', w: 1, l: 3, accepts: ['wood', 'metal'] },
  h4: { id: 'h4', name: 'Grip', icon: '🪵', role: 'haft', shape: 'bar', w: 1, l: 4, accepts: ['wood', 'metal'] },
  h6: { id: 'h6', name: 'Long handle', icon: '🪵', role: 'haft', shape: 'bar', w: 1, l: 6, accepts: ['wood', 'metal'] },
  pole: { id: 'pole', name: 'Pole', icon: '🪵', role: 'haft', shape: 'bar', w: 1, l: 9, accepts: ['wood', 'metal'] },
  club: { id: 'club', name: 'Thick bar', icon: '🏏', role: 'haft', shape: 'bar', w: 2, l: 4, accepts: ['wood', 'metal'] },
  // ---- Guards ----
  cross: { id: 'cross', name: 'Crossguard', icon: '✝️', role: 'guard', shape: 'guard', w: 3, l: 1, accepts: ['metal'] },
  swept: { id: 'swept', name: 'Swept guard', icon: '🛡️', role: 'guard', shape: 'guard', w: 3, l: 2, accepts: ['metal'] },
  boss: { id: 'boss', name: 'Boss', icon: '⚙️', role: 'guard', shape: 'guard', w: 2, l: 2, accepts: ['metal'] },
  // ---- Bindings ----
  strap: { id: 'strap', name: 'Strap', icon: '〰️', role: 'bind', shape: 'cord', w: 1, l: 3, accepts: ['leather'] },
  cord: { id: 'cord', name: 'Cord', icon: '〰️', role: 'bind', shape: 'cord', w: 1, l: 4, accepts: ['leather'] },
};

/** The five anvil slots in their canonical order. */
export const FORGE_SLOTS = ['head', 'head2', 'guard', 'haft', 'bind'] as const;

/**
 * Cells in a placement: every part's `w × l`, times its quantity. This is the
 * metal bill and the weight's raw material; it lives here, at the leaf of the
 * smithing module graph, so data files that generate stubs can read it.
 */
export function placementCells(placement: Placement): number {
  let cells = 0;
  for (const slot of FORGE_SLOTS) {
    const part = placement[slot];
    const kind = part ? PART_KINDS[part.kind] : undefined;
    if (part && kind) cells += kind.w * kind.l * (part.qty ?? 1);
  }
  return cells;
}

/** Rune-slot size class of a forged item, from its total cells: ≤9 small, 10–17 medium, ≥18 large. */
export function runeClassForCells(cells: number): RuneSizeClass {
  if (cells <= 9) return 'small';
  return cells <= 17 ? 'medium' : 'large';
}
