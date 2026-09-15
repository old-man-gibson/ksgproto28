import type { ProseTable } from './prose';

// Player-facing text for src/core/data/runes.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- RUNES ----------
export const RUNES_TEXT: ProseTable = {
  'minor_rune_might.desc': 'Socketable rune. Weapon: +4 Damage. Armor: +2 Armor. Accessory: +2% Damage.',

  'greater_rune_might.desc': 'Socketable rune. Weapon: +9 Damage and +3% Damage. Armor: +5 Armor. Accessory: +5% Damage.',

  'minor_rune_vitality.desc': 'Socketable rune. Weapon: +10 Max HP. Armor: +25 Max HP. Accessory: +3% Max HP.',

  'greater_rune_vitality.desc': 'Socketable rune. Weapon: +25 Max HP. Armor: +60 Max HP and +3% Max HP. Accessory: +6% Max HP and +0.4 HP Regen.',

  'gale_rune.desc': 'Socketable rune. Weapon: Sidestep becomes Flash Step with 55% of its cooldown. Armor: +3% Dodge. Accessory: +2% Speed.',

  'earthbind_rune.desc': 'Socketable rune. Weapon: Thrust becomes Rooted Thrust and exits into the coiled position. Armor: +5% Armor. Accessory: +5% Earth Resistance.',

  'umbral_rune.desc': 'Socketable rune. Weapon: Riposte deals x1.1 damage and its Honed fork offers Sweeping; +3 dark damage per hit. Armor: +8% Dark Resistance. Accessory: +2% Crit.',

  'minor_rune_thunder.desc': 'Socketable rune. Weapon: +3 lightning damage per hit. Armor: +6% Lightning Resistance. Accessory: +3 Spell Power.',

  'greater_rune_thunder.desc': 'Socketable rune. Weapon: +12% of damage dealt as lightning. Armor: +10% Lightning Resistance. Accessory: +8% Spell Power.',

  'minor_rune_frost.desc': 'Socketable rune. Weapon: +3 cold damage per hit. Armor: +6% Cold Resistance. Accessory: +2% Crit.',

  'rune_swiftness.desc': 'Socketable rune. Weapon: +4% Attack Speed. Armor: +2% Speed. Accessory: +3% Speed.',
};

// ---------- RUNE_PATTERNS ----------
export const RUNE_PATTERNS_TEXT: ProseTable = {
  'pattern_might.desc': 'Carving pattern, available from Runecarving 1. On a Fair slab: weapon +4 Damage, armor +2 Armor, accessory +2% Damage. Slab grade scales the result.',

  'pattern_warding.desc': 'Carving pattern, available from Runecarving 1. On a Fair slab: weapon +2% Parry, armor +4 Armor, accessory +12 Max HP. Slab grade scales the result.',

  'pattern_swiftness.desc': 'Carving pattern, Runecarving 5. On a Fair slab: weapon +4% Attack Speed, armor +2% Speed, accessory +3% Speed. Slab grade scales the result.',

  'pattern_edge.desc': 'Carving pattern, Runecarving 12. On a Fair slab: weapon +3% Crit and +15% Crit Damage, accessory +2% Crit. Does nothing in armor. Slab grade scales the result.',
};

// ---------- NAMED_RUNES ----------
export const NAMED_RUNES_TEXT: ProseTable = {
  'stormbrand.desc': 'Rune of the Edge with charged slime gel inlay and a raw sapphire, on a Fine or better slab. Adds in a weapon: +8% of damage dealt as lightning and +20% Crit Damage.',

  'hearthward.desc': 'Rune of Warding with warm slime gel inlay, on any slab grade. Adds in armor: +8% Heat Resistance.',

  'winters_edge.desc': 'Rune of the Edge with chilled slime gel inlay and a cut garnet, on a Superb or better slab. Adds in a weapon: +6 cold damage per hit and +3% Crit.',

  'twiceforged.desc': 'Rune of Might and Rune of Warding cut on one slab with gold leaf inlay, Fine or better. Adds +6% Damage in a weapon or +5 Armor in armor.',
};
