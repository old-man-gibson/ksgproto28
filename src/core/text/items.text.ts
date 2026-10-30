import type { ProseTable } from './prose';

// Player-facing text for src/core/data/items.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- ITEMS ----------
export const ITEMS_TEXT: ProseTable = {
  'rusty_sword.desc': 'One-handed sword. +3 Damage.',
  'old_hammer.desc': 'One-handed hammer. +5 Damage, −12% Attack Speed.',

  'oak_club.desc': 'One-handed blunt weapon. +5 Damage, -10% Attack Speed.',

  'jotunshamarr.desc': 'Two-handed blunt weapon. +35 Damage, -24% Attack Speed.',

  'iron_sword.desc': 'One-handed sword. +7 Damage, +2% Crit.',

  'wolf_fang_blade.desc': 'One-handed sword. +10 Damage, +10% Attack Speed.',

  'old_spear.desc': 'Two-handed spear. +7 Damage, +2 Armor.',

  'spider_silk_garb.desc': 'Chest slot, cloth. +4 Armor, +6% Dodge, +10% Spell Power.',

  'oak_staff.desc': 'Two-handed staff. +2 INT, +2 Damage, +4 Spell Power.',

  'hunting_bow.desc': 'Two-handed ranged weapon. +2 DEX, +4 Damage, +2% Crit.',

  'iron_dagger.desc': 'Light dagger. +2 DEX, +2 Damage, +8% Attack Speed, +3% Crit.',

  'antipattern_bracers.desc': 'Hands slot, metal. +1 STR, +6 Armor. Lowers the wearer\'s own psionic quantities: -35% Acuity, -35% Coherence, -25% Purchase. The penalty costs nothing to a character who shapes no workings.',

  'ember_knife.desc': 'Light dagger. +2 DEX, +5 Damage, +10% Attack Speed, +4 heat damage per hit.',

  'steel_greatsword.desc': 'Two-handed sword. +3 STR, +14 Damage, -15% Attack Speed, +10% Crit Damage. Requires STR 12.',

  'wooden_shield.desc': 'Offhand light shield. +4 Armor, +8 Max HP.',

  'warden_buckler.desc': 'Offhand buckler. +8 Armor, +3% Dodge. Requires DEX 8. Counts as a shield and a parrying tool, so it trains Shield Combat and Deflection. No penalty in the main hand.',
  'warden_buckler.mainHand.desc': 'Punched forward: +3 Damage, +4% Parry',
  'warden_buckler.offHand.desc': 'Held back: +3% Parry',

  'rapier.desc': 'One-handed parrying sword. +6 Damage, +4% Crit, +10% Attack Speed, +3% Parry. Requires DEX 12. A Parrying Dagger in the off hand gains extra bonuses beside it.',

  'parrying_dagger.desc': 'Offhand parrying dagger. +4% Parry, +1 Damage. Requires DEX 10. Gains extra bonuses when a rapier is in the main hand.',
  'parrying_dagger.offHand.desc': 'Paired with a rapier: +5% Parry, +2% Crit, +10% Riposte',

  'leather_cap.desc': 'Head slot, leather. +2 Armor, +2% Dodge.',

  'leather_jerkin.desc': 'Chest slot, leather. +6 Armor, +3% Dodge.',

  'iron_breastplate.desc': 'Chest slot, heavy metal. +1 CON, +14 Armor, -5% Attack Speed. Requires STR 8.',

  'iron_gauntlets.desc': 'Hands slot, heavy metal. +1 STR, +4 Armor.',

  'scout_bracers.desc': 'Hands slot, leather. +6% Attack Speed, +3% Dodge.',

  'soldier_greaves.desc': 'Legs slot, heavy metal. +10 Armor, +10 Max HP.',

  'leather_boots.desc': 'Feet slot, leather. +5% Dodge, +8% Travel Speed.',

  'spellwoven_cloak.desc': 'Back slot, cloth. +2 INT, +6% Dodge, +3 Armor.',

  'apprentice_ring.desc': 'Accessory. +3 Spell Power, +4% Skill XP.',

  'pilgrim_amulet.desc': 'Accessory. +12 Max HP, +5% Travel Speed.',

  'katana.desc': 'One-handed katana; levels Swordsmanship. +6 Damage, +3% Crit, +5% Attack Speed. Requires DEX 8.',

  'uchigatana.desc': 'One-handed katana; levels Swordsmanship. +9 Damage, +4% Crit, +8% Attack Speed. Requires DEX 10.',

  'moonlit_katana.desc': 'One-handed katana; levels Swordsmanship. +14 Damage, +8% Crit, +20% Crit Damage, +10% Attack Speed. Requires Swordsmanship 20.',

  'herbal_charm.desc': 'Accessory. +15% Poison Resistance, +5% Loot.',

  'wolf_cloak.desc': 'Back slot, fur. +12% Slashing Resistance, +3% Dodge, +10 Max HP.',

  'bronze_dagger.desc': 'Light bronze dagger. +2 DEX, +1 Damage, +9% Attack Speed, +3% Crit. Raises the wielder\'s psionic quantities: +15% Acuity, +10% Coherence.',

  'tower_shield.desc': 'Offhand shield. +7 Armor, +6% Armor, -15% Speed.',

  'festival_laurel.desc': 'Accessory, placeholder. The Vermin Festival pays it to the first royale won in a run. +8% Damage, +8% Max HP.',

  'festival_regalia.desc': 'Accessory, placeholder, taken from a festival token. +15% Damage, +15% Max HP, +5% Attack Speed. Kept in the stronghold stash: every prestige returns it there, wherever it is.',
};
