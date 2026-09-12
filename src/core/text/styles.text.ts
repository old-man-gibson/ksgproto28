import type { ProseTable } from './prose';

// Player-facing text for src/core/data/styles.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- STYLES ----------
export const STYLES_TEXT: ProseTable = {
  'balanced.desc': 'Neutral stance. No stat modifiers. Exertion: 2% stamina per attack for +10% damage on that hit.',

  'aggressive.desc': 'Frenzy stance. +10% damage, +15% attack speed, −5% dodge, −15% armor. Exertion: 6% stamina per attack for a further +20% damage, +25% attack speed, −8% dodge and −30% armor.',

  'crush.desc': 'Crush stance. +40% damage, +10% penetration, −25% attack speed. Exertion: 10% stamina per attack for +50% damage and +15% penetration on that hit.',

  'cleave.desc': 'Cleave stance. +20% damage, +10% splash, −5% dodge. Exertion: 5% stamina per attack for +10% damage and +25% splash on that hit.',

  'quick.desc': 'Quick stance. +30% attack speed, −10% damage. Exertion: 2.5% stamina per attack, building +3% attack speed per exchange up to +45% for the rest of the fight.',

  'evasive.desc': 'Evasive stance. +12% dodge, +10% attack speed, −10% damage. Exertion: 5% stamina per incoming attack for +20% dodge against it.',

  'finesse.desc': 'Finesse stance. +12% crit, +40% crit damage, −10% damage. Exertion: 8% stamina per attack for a further +12% crit and −12% attack speed.',

  'defensive.desc': 'Brace stance. +50% armor, +15% max HP, −20% damage. Exertion: 5% stamina per incoming attack for +60% armor against it.',

  'multi.desc': 'Flurry stance. +45% attack speed, −30% damage. Exertion: 14% stamina per attack for one extra hit.',

  'jigen_ryu.desc': 'Katana school replacing Crush. +50% damage, +20% penetration, +50% crit damage, −30% attack speed, −50% dodge; damage and penetration scale with the school\'s level. Exertion: drains all stamina on attack for +150% damage and +30% penetration, then leaves you exhausted.',

  'niten_ichi_ryu.desc': 'Katana school replacing Flurry. +15% parry, +10% riposte, +5% crit, −15% damage; parry, riposte and damage improve with the school\'s level. Exertion: 12% stamina per attack for one extra hit and +10% damage.',

  'eishin_ryu.desc': 'Katana school replacing Finesse. +18% crit, +60% crit damage, −5% damage; crit and crit damage scale with the school\'s level. Exertion: 7% stamina per attack for +15% crit and −10% attack speed.',

  'ittou_ryu_style.desc': 'Katana school replacing Quick. +35% attack speed, +10% crit, +30% crit damage, −5% damage; crit and crit damage scale with the school\'s level. Exertion: 3% stamina per attack, building +3.5% attack speed per exchange up to +50% for the rest of the fight.',

  'destreza.desc': 'Rapier school replacing Evasive. +14% parry, +25% riposte, +4% dodge, +4% crit, −10% damage; parry and riposte scale with the school\'s level. Exertion: 5.5% stamina per incoming attack for +18% parry against it.',

  'bolognese.desc': 'Sword-and-buckler school replacing Brace. +10% parry, +15% riposte, +30% armor, −12% damage; parry, riposte and armor scale with the school\'s level. Exertion: 5% stamina per incoming attack for +14% parry and +25% armor against it.',

  'boxing.desc': 'Unarmed school replacing Evasive. +15% dodge, +15% attack speed, +5% damage; dodge and damage scale with the school\'s level. Exertion: 4.5% stamina per incoming attack for +22% dodge against it.',

  'taekwondo.desc': 'Unarmed school replacing Flurry. +50% attack speed, +5% dodge, −15% damage; attack speed scales with the school\'s level. Exertion: 13% stamina per attack for one extra hit.',

  'muay_thai.desc': 'Unarmed school replacing Crush. +45% damage, +40% crit damage, +15% armor, −15% attack speed; damage scales with the school\'s level. Exertion: 9% stamina per attack for +55% damage and +10% penetration on that hit.',

  'wrestling.desc': 'Unarmed school replacing Brace. +60% armor, +25% max HP, −10% damage; armor and max HP scale with the school\'s level. Exertion: 4.5% stamina per incoming attack for +75% armor against it.',

  'magic_combat.desc': 'Spellblade school replacing Finesse. +8% crit, +10% spell power; both scale with the school\'s level. Exertion: 8% mana per attack instead of stamina, for +50% damage and +12% penetration on that hit.',

  'capoeira.desc': 'Unarmed school replacing Quick. +8% dodge, scaling with the school\'s level. Exertion: 8% stamina per incoming attack for +15% dodge against it.',
};
