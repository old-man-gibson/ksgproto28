import type { ItemClassDef } from '../types';
import { prose } from '../text/prose';
import { ITEM_CLASSES_TEXT } from '../text/itemclasses.text';

/**
 * What the anvil can make (docs/plans/blueprint-weaponsmithing.md, "Resolution").
 *
 * A placement is classified by the FIRST class, highest `priority` first,
 * whose `match` accepts it. The proportions of the parts name the product: a
 * 2×3 blade on a handle is a dagger, a 2×6 blade a sword, a 2×10 blade a
 * greatsword. The last class has an empty match, so every combination
 * resolves to something and none is a dead end.
 *
 * Classes carry no numbers. Damage, speed, armour, weight and value come from
 * one kernel that reads the parts (systems/assembly.ts); the class decides the
 * equipment slot, the hands, the weapon family (and with it the combat skill
 * and the martial techniques) and the damage type.
 *
 * Ranges are inclusive and 99 means "no upper bound". A `degenerate` class is
 * a placement that has to resolve to something and is not a good product: the
 * kernel scales it by 0.6. `cover` is the share of the body a piece of armour
 * covers; a class without one grants no armour.
 *
 * Axe and sickle have no combat skill. They equip and fight with no family
 * skill until a skill claims them; that is code, not data.
 *
 * Keep `priority` unique and keep the empty-match class last: the content test
 * enumerates every placement and fails on an unreachable class.
 */
export const ITEM_CLASSES = prose<ItemClassDef>('ITEM_CLASSES', ITEM_CLASSES_TEXT, {
  // ---- Rings and mail ----
  chain_mail: {
    id: 'chain_mail', name: 'Chain Mail', icon: '⛓️', slot: 'chest', tags: [], priority: 440, cover: 1,
    match: { head: { shape: ['ring'], count: [8, 99] }, haft: 'none' },
    exemplar: { head: { kind: 'ring', mat: 'iron_ingot', qty: 8 } },
  },
  chain_coif: {
    id: 'chain_coif', name: 'Chain Coif', icon: '⛓️', slot: 'head', tags: [], priority: 430, cover: 0.5,
    match: { head: { shape: ['ring'], count: [4, 7] }, haft: 'none' },
    exemplar: { head: { kind: 'ring', mat: 'iron_ingot', qty: 4 } },
  },
  amulet: {
    id: 'amulet', name: 'Amulet', icon: '📿', slot: 'accessory', tags: ['trinket'], priority: 420,
    match: { head: { shape: ['ring'] }, bind: true, haft: 'none' },
    exemplar: { head: { kind: 'ring', mat: 'iron_ingot' }, bind: { kind: 'cord', mat: 'leather' } },
  },
  ring: {
    id: 'ring', name: 'Ring', icon: '💍', slot: 'accessory', tags: ['trinket'], priority: 410,
    match: { head: { shape: ['ring'] }, haft: 'none' },
    exemplar: { head: { kind: 'ring', mat: 'iron_ingot' } },
  },
  hoop_pole: {
    id: 'hoop_pole', name: 'Hoop-Pole', icon: '🪄', slot: 'weapon', wield: 'two_handed', tags: ['staff'], priority: 400, degenerate: true,
    match: { head: { shape: ['ring'] }, haft: 'any' },
    exemplar: { head: { kind: 'ring', mat: 'iron_ingot' }, haft: { kind: 'h4', mat: 'hardwood' } },
  },
  // ---- Bent metal: bows, sickles and limb armour ----
  bow: {
    id: 'bow', name: 'Bow', icon: '🏹', slot: 'weapon', wield: 'two_handed', tags: ['bow', 'ranged'], priority: 390,
    match: { head: { shape: ['bent'], mat: ['wood'], l: [5, 99] }, bind: true, haft: 'none' },
    exemplar: { head: { kind: 'bent_l', mat: 'hardwood' }, bind: { kind: 'cord', mat: 'leather' } },
  },
  sickle: {
    id: 'sickle', name: 'Sickle', icon: '🌙', slot: 'weapon', wield: 'one_handed', tags: ['sickle'], priority: 380, damageType: 'slashing',
    match: { head: { shape: ['bent'] }, haft: 'any' },
    exemplar: { head: { kind: 'bent_m', mat: 'iron_ingot' }, haft: { kind: 'h3', mat: 'hardwood' } },
  },
  helm: {
    id: 'helm', name: 'Helm', icon: '🪖', slot: 'head', tags: [], priority: 370, cover: 0.5,
    match: { head: { shape: ['bent'], count: [1, 1], area: [0, 6] } },
    exemplar: { head: { kind: 'bent_s', mat: 'iron_ingot' } },
  },
  gauntlets: {
    id: 'gauntlets', name: 'Gauntlets', icon: '🧤', slot: 'hands', tags: [], priority: 360, cover: 0.5,
    match: { head: { shape: ['bent'], count: [2, 2], l: [0, 2] } },
    exemplar: { head: { kind: 'bent_s', mat: 'iron_ingot', qty: 2 } },
  },
  boots: {
    id: 'boots', name: 'Boots', icon: '🥾', slot: 'feet', tags: [], priority: 350, cover: 0.4,
    match: { head: { shape: ['bent'], count: [2, 2], l: [0, 4] } },
    exemplar: { head: { kind: 'bent_m', mat: 'iron_ingot', qty: 2 } },
  },
  greaves: {
    id: 'greaves', name: 'Greaves', icon: '🦵', slot: 'legs', tags: [], priority: 340, cover: 0.6,
    match: { head: { shape: ['bent'], count: [2, 2] } },
    exemplar: { head: { kind: 'bent_l', mat: 'iron_ingot', qty: 2 } },
  },
  shin_guard: {
    id: 'shin_guard', name: 'Shin Guard', icon: '🦵', slot: 'legs', tags: [], priority: 330, cover: 0.6,
    match: { head: { shape: ['bent'] } },
    exemplar: { head: { kind: 'bent_l', mat: 'iron_ingot' } },
  },
  // ---- Plates: shields, signs and body armour ----
  bladed_shield: {
    id: 'bladed_shield', name: 'Bladed Shield', icon: '🛡️', slot: 'offhand', wield: 'offhand', tags: ['shield'], priority: 320, cover: 0.5,
    match: { head: { shape: ['plate'] }, anyHead: ['edge'], haft: 'any' },
    exemplar: { head: { kind: 'plate_m', mat: 'iron_ingot' }, head2: { kind: 'short', mat: 'iron_ingot' }, haft: { kind: 'h3', mat: 'hardwood' } },
  },
  signpost: {
    id: 'signpost', name: 'Signpost', icon: '🪧', slot: 'weapon', wield: 'two_handed', tags: ['blunt'], priority: 310, degenerate: true,
    match: { head: { shape: ['plate'] }, haft: { l: [5, 99] } },
    exemplar: { head: { kind: 'plate_m', mat: 'hardwood' }, haft: { kind: 'pole', mat: 'hardwood' } },
  },
  tower_shield: {
    id: 'tower_shield', name: 'Tower Shield', icon: '🛡️', slot: 'offhand', wield: 'offhand', tags: ['shield', 'tower shield'], priority: 300, cover: 0.5,
    match: { head: { shape: ['plate'], area: [15, 99] }, haft: 'any' },
    exemplar: { head: { kind: 'plate_w', mat: 'hardwood' }, haft: { kind: 'h3', mat: 'hardwood' } },
  },
  shield: {
    id: 'shield', name: 'Shield', icon: '🛡️', slot: 'offhand', wield: 'offhand', tags: ['shield'], priority: 290, cover: 0.5,
    match: { head: { shape: ['plate'], area: [9, 99] }, haft: 'any' },
    exemplar: { head: { kind: 'plate_m', mat: 'hardwood' }, haft: { kind: 'h3', mat: 'hardwood' } },
  },
  buckler: {
    id: 'buckler', name: 'Buckler', icon: '🔰', slot: 'offhand', wield: 'offhand', tags: ['shield', 'buckler', 'parrying'], priority: 280, cover: 0.5,
    match: { head: { shape: ['plate'] }, haft: 'any' },
    exemplar: { head: { kind: 'plate_s', mat: 'iron_ingot' }, haft: { kind: 'h3', mat: 'hardwood' } },
  },
  breastplate: {
    id: 'breastplate', name: 'Breastplate', icon: '🎽', slot: 'chest', tags: [], priority: 270, cover: 1,
    match: { head: { shape: ['plate'], area: [9, 99] }, bind: true },
    exemplar: { head: { kind: 'plate_w', mat: 'iron_ingot' }, bind: { kind: 'strap', mat: 'leather' } },
  },
  armour_scrap: {
    id: 'armour_scrap', name: 'Armour Scrap', icon: '🔩', slot: 'accessory', tags: ['trinket'], priority: 260, cover: 0.2, degenerate: true,
    match: { head: { shape: ['plate'] }, bind: true },
    exemplar: { head: { kind: 'plate_s', mat: 'iron_ingot' }, bind: { kind: 'strap', mat: 'leather' } },
  },
  unstrapped_plate: {
    id: 'unstrapped_plate', name: 'Unstrapped Plate', icon: '🛡️', slot: 'chest', tags: [], priority: 250, cover: 1, degenerate: true,
    match: { head: { shape: ['plate'] } },
    exemplar: { head: { kind: 'plate_m', mat: 'iron_ingot' } },
  },
  // ---- Masses, axes and points ----
  maul: {
    id: 'maul', name: 'Maul', icon: '🔨', slot: 'weapon', wield: 'two_handed', tags: ['blunt'], priority: 240,
    match: { head: { shape: ['mass'] }, haft: { l: [5, 99] } },
    exemplar: { head: { kind: 'maulhead', mat: 'iron_ingot' }, haft: { kind: 'h6', mat: 'hardwood' } },
  },
  hammer: {
    id: 'hammer', name: 'Hammer', icon: '🔨', slot: 'weapon', wield: 'one_handed', tags: ['blunt'], priority: 230,
    match: { head: { shape: ['mass'] }, haft: 'any' },
    exemplar: { head: { kind: 'maulhead', mat: 'iron_ingot' }, haft: { kind: 'h3', mat: 'hardwood' } },
  },
  halberd: {
    id: 'halberd', name: 'Halberd', icon: '🪓', slot: 'weapon', wield: 'two_handed', tags: ['spear'], priority: 220, damageType: 'slashing',
    match: { head: { shape: ['edge'], cross: true }, haft: { l: [5, 99] } },
    exemplar: { head: { kind: 'axehead', mat: 'iron_ingot' }, haft: { kind: 'h6', mat: 'hardwood' } },
  },
  axe: {
    id: 'axe', name: 'Axe', icon: '🪓', slot: 'weapon', wield: 'one_handed', tags: ['axe'], priority: 210, damageType: 'slashing',
    match: { head: { shape: ['edge'], cross: true }, haft: 'any' },
    exemplar: { head: { kind: 'axehead', mat: 'iron_ingot' }, haft: { kind: 'h3', mat: 'hardwood' } },
  },
  lance: {
    id: 'lance', name: 'Lance', icon: '🔱', slot: 'weapon', wield: 'two_handed', tags: ['spear'], priority: 200,
    match: { head: { shape: ['point'] }, haft: { l: [9, 99] } },
    exemplar: { head: { kind: 'spearhead', mat: 'iron_ingot' }, haft: { kind: 'pole', mat: 'hardwood' } },
  },
  spear: {
    id: 'spear', name: 'Spear', icon: '🔱', slot: 'weapon', wield: 'two_handed', tags: ['spear'], priority: 190,
    match: { head: { shape: ['point'] }, haft: { l: [5, 99] } },
    exemplar: { head: { kind: 'spearhead', mat: 'iron_ingot' }, haft: { kind: 'h6', mat: 'hardwood' } },
  },
  short_spear: {
    id: 'short_spear', name: 'Short Spear', icon: '🔱', slot: 'weapon', wield: 'one_handed', tags: ['spear'], priority: 180,
    match: { head: { shape: ['point'] }, haft: { l: [3, 99] } },
    exemplar: { head: { kind: 'spearhead', mat: 'iron_ingot' }, haft: { kind: 'h3', mat: 'hardwood' } },
  },
  nail: {
    id: 'nail', name: 'Nail', icon: '📌', slot: 'weapon', wield: 'light', tags: ['dagger'], priority: 170, degenerate: true,
    match: { head: { shape: ['point'] } },
    exemplar: { head: { kind: 'spearhead', mat: 'iron_ingot' } },
  },
  // ---- Blades on long hafts ----
  twin_blade: {
    id: 'twin_blade', name: 'Twin-Blade', icon: '⚔️', slot: 'weapon', wield: 'two_handed', tags: ['spear'], priority: 160, degenerate: true,
    match: { head: { shape: ['edge'], count: [2, 99] }, haft: { l: [5, 99] } },
    exemplar: { head: { kind: 'long', mat: 'iron_ingot' }, head2: { kind: 'long', mat: 'iron_ingot' }, haft: { kind: 'h6', mat: 'hardwood' } },
  },
  glaive: {
    id: 'glaive', name: 'Glaive', icon: '🗡️', slot: 'weapon', wield: 'two_handed', tags: ['spear'], priority: 150,
    match: { head: { shape: ['edge'], l: [4, 99] }, haft: { l: [5, 99] } },
    exemplar: { head: { kind: 'medium', mat: 'iron_ingot' }, haft: { kind: 'h6', mat: 'hardwood' } },
  },
  bladed_spear: {
    id: 'bladed_spear', name: 'Bladed Spear', icon: '🔱', slot: 'weapon', wield: 'two_handed', tags: ['spear'], priority: 140,
    match: { head: { shape: ['edge'] }, haft: { l: [5, 99] } },
    exemplar: { head: { kind: 'short', mat: 'iron_ingot' }, haft: { kind: 'h6', mat: 'hardwood' } },
  },
  // ---- Swords ----
  rapier: {
    id: 'rapier', name: 'Rapier', icon: '🤺', slot: 'weapon', wield: 'one_handed', tags: ['sword', 'rapier', 'parrying'], priority: 130,
    match: { head: { shape: ['edge'], w: [1, 1], l: [5, 99] }, guard: true, haft: 'any' },
    exemplar: { head: { kind: 'thin', mat: 'iron_ingot' }, guard: { kind: 'swept', mat: 'iron_ingot' }, haft: { kind: 'h3', mat: 'hardwood' } },
  },
  estoc: {
    id: 'estoc', name: 'Estoc', icon: '🗡️', slot: 'weapon', wield: 'one_handed', tags: ['sword'], priority: 120,
    match: { head: { shape: ['edge'], w: [1, 1], l: [5, 99] }, haft: 'any' },
    exemplar: { head: { kind: 'thin', mat: 'iron_ingot' }, haft: { kind: 'h3', mat: 'hardwood' } },
  },
  odachi: {
    id: 'odachi', name: 'Odachi', icon: '🗡️', slot: 'weapon', wield: 'two_handed', tags: ['sword', 'katana'], priority: 110,
    match: { head: { shape: ['edge'], curved: true, l: [9, 99] }, haft: 'any' },
    exemplar: { head: { kind: 'curved_l', mat: 'iron_ingot' }, haft: { kind: 'h3', mat: 'hardwood' } },
  },
  katana: {
    id: 'katana', name: 'Katana', icon: '🗡️', slot: 'weapon', wield: 'one_handed', tags: ['sword', 'katana'], priority: 100,
    match: { head: { shape: ['edge'], curved: true, l: [5, 99] }, haft: 'any' },
    exemplar: { head: { kind: 'curved', mat: 'iron_ingot' }, haft: { kind: 'h3', mat: 'hardwood' } },
  },
  greatsword: {
    id: 'greatsword', name: 'Greatsword', icon: '⚔️', slot: 'weapon', wield: 'two_handed', tags: ['greatsword'], priority: 90,
    // Long, or wide enough to weigh like it: two clauses, either one.
    match: [
      { head: { shape: ['edge'], l: [9, 99] }, haft: 'any' },
      { head: { shape: ['edge'], area: [18, 99] }, haft: 'any' },
    ],
    exemplar: { head: { kind: 'great', mat: 'iron_ingot' }, haft: { kind: 'h4', mat: 'hardwood' } },
  },
  sword: {
    id: 'sword', name: 'Sword', icon: '⚔️', slot: 'weapon', wield: 'one_handed', tags: ['sword'], priority: 80,
    match: { head: { shape: ['edge'], l: [6, 99] }, haft: 'any' },
    exemplar: { head: { kind: 'long', mat: 'iron_ingot' }, haft: { kind: 'h3', mat: 'hardwood' } },
  },
  shortsword: {
    id: 'shortsword', name: 'Shortsword', icon: '🗡️', slot: 'weapon', wield: 'one_handed', tags: ['sword'], priority: 70,
    match: { head: { shape: ['edge'], l: [4, 99] }, haft: 'any' },
    exemplar: { head: { kind: 'medium', mat: 'iron_ingot' }, haft: { kind: 'h3', mat: 'hardwood' } },
  },
  dagger: {
    id: 'dagger', name: 'Dagger', icon: '🔪', slot: 'weapon', wield: 'light', tags: ['dagger'], priority: 60,
    match: { head: { shape: ['edge'] }, haft: 'any' },
    exemplar: { head: { kind: 'short', mat: 'iron_ingot' }, haft: { kind: 'h3', mat: 'hardwood' } },
  },
  bare_blade: {
    id: 'bare_blade', name: 'Bare Blade', icon: '🔪', slot: 'weapon', wield: 'light', tags: ['dagger'], priority: 50, degenerate: true,
    match: { head: { shape: ['edge'] } },
    exemplar: { head: { kind: 'short', mat: 'iron_ingot' } },
  },
  // ---- No head: clubs and staves ----
  club: {
    id: 'club', name: 'Club', icon: '🏏', slot: 'weapon', wield: 'one_handed', tags: ['blunt'], priority: 40,
    match: { head: 'none', haft: { w: [2, 99] } },
    exemplar: { haft: { kind: 'club', mat: 'hardwood' } },
  },
  quarterstaff: {
    id: 'quarterstaff', name: 'Quarterstaff', icon: '🪄', slot: 'weapon', wield: 'two_handed', tags: ['staff'], priority: 30,
    match: { head: 'none', haft: { l: [4, 99] } },
    exemplar: { haft: { kind: 'h6', mat: 'hardwood' } },
  },
  stick: {
    id: 'stick', name: 'Stick', icon: '🪵', slot: 'weapon', wield: 'light', tags: ['staff'], priority: 20, degenerate: true,
    match: { head: 'none', haft: 'any' },
    exemplar: { haft: { kind: 'h3', mat: 'hardwood' } },
  },
  // The last rule. It accepts everything, so no placement is left unresolved.
  paperweight: {
    id: 'paperweight', name: 'Paperweight', icon: '🪨', slot: 'accessory', tags: ['trinket'], priority: 10, degenerate: true,
    match: {},
    exemplar: { guard: { kind: 'boss', mat: 'iron_ingot' } },
  },
});

/** The id prefix of the generated item stubs, `ITEMS['forged:<classId>']`. */
export const FORGED_PREFIX = 'forged:';

/** The `ITEMS` id a class is stubbed under, and the `defId` of a forged item of that class. */
export function forgedIdOf(classId: string): string {
  return `${FORGED_PREFIX}${classId}`;
}

/** The class id behind a `forged:<classId>` item id, or undefined for any other id. */
export function classIdOfForged(defId: string): string | undefined {
  return defId.startsWith(FORGED_PREFIX) ? defId.slice(FORGED_PREFIX.length) : undefined;
}
