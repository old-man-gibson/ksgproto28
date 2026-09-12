import type { ProseTable } from './prose';

// Player-facing text for src/core/data/skills.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- HAND_WRITTEN ----------
export const HAND_WRITTEN_TEXT: ProseTable = {
  'fighting.desc': 'Base combat skill. Trained by any combat. Each level adds +1% damage.',

  'swordsmanship.desc': 'Sword skill. Manifests at Fighting 10 with a sword equipped; trained by sword combat. Each level adds +1.5% damage and +0.2% crit while a sword is equipped.',

  'scouting.desc': 'Trained by exploring and travelling. Each level adds +1% travel speed and +0.5% loot.',

  'chronosense.desc': 'Trained by elapsed game time only; no action raises it. Levels unlock time readings in order: time of day, season, hour, week, minute. Capped at 20 until the cap is raised; levels past the cap reduce time-based penalties.',

  'hunting.desc': 'Trained by kills; the first kill of a new species pays most, and new bestiary entries pay outright. Each level adds +0.4% loot and +0.3% gold gain, raises the per-kill chance of learning a bestiary fact, and lowers the sightings needed to confirm a habitat.',

  'speechcraft.desc': 'Trained by dialogue and by quests; a new person pays most, and turning work in pays more than accepting it. Manifests the first time you take work from a stranger. Each level adds +0.5% gold gain.',

  'musicianship.desc': 'Trained by performing; manifests on the first performance. Levels unlock notation: quarter notes at 5, eighth notes at 12, other scales at 20, 8-bar forms at 30. A piece is classified by what it measures as, not by what you intended.',

  'magic.desc': 'Base magic skill. Manifests at Intelligence 15; trained by casting. Each level adds +2% spell power.',

  'arcana.desc': 'Arcane spellcraft. Manifests at Intelligence 10 by working at the spell table; trained by composing new sentences, not by repeating old ones. Word order changes what a sentence does. Each level adds +1% spell power.',

  'devotion.desc': 'Divine spellcraft. Manifests at Wisdom 10 by working at the spell table. Litanies are granted by a deity, not composed. Each level adds +0.5 max spirit.',

  'psionics.desc': 'Psionic spellcraft. Manifests at Intelligence 12 and Wisdom 12 by working at the spell table. Levels buy more points to allocate and add +0.01 focus regeneration each.',

  'darkvision.desc': 'Trained only by standing in natural darkness away from lamplight. Each level removes 2% of the darkness penalty to hit chance and dodge; the penalty is gone at level 50, which is the cap.',

  'weathersense.desc': 'Trained by standing in weather and by arriving somewhere by travel; manifests in the first severe weather met outdoors. New weather kinds and new regions pay most. Levels unlock forecast rows: 2 hours at level 1, tomorrow at 5, out to 7 days at 29; each row starts rough and sharpens with levels past its unlock. Capped at 30.',

  'heat_resistance.desc': 'Trained by taking heat damage. Each level cuts heat damage taken by 1%, 3% every 5th level, 5% every 10th, 10% every 25th; the resistance caps at 75%.',

  'cold_resistance.desc': 'Trained by taking cold damage. Each level cuts cold damage taken by 1%, 3% every 5th level, 5% every 10th, 10% every 25th; the resistance caps at 75%.',

  'poison_resistance.desc': 'Trained by taking poison damage. Each level cuts poison damage taken by 1%, 3% every 5th level, 5% every 10th, 10% every 25th; the resistance caps at 75%.',

  'water_resistance.desc': 'Trained by taking water damage, including from rain. Each level cuts water damage taken by 1%, 3% every 5th level, 5% every 10th, 10% every 25th; the resistance caps at 75%.',

  'wind_resistance.desc': 'Trained by taking wind damage, including from weather. Each level cuts wind damage taken by 1%, 3% every 5th level, 5% every 10th, 10% every 25th; the resistance caps at 75%.',

  'earth_resistance.desc': 'Trained by taking earth damage, including from sandstorms. Each level cuts earth damage taken by 1%, 3% every 5th level, 5% every 10th, 10% every 25th; the resistance caps at 75%.',

  'lightning_resistance.desc': 'Trained by taking lightning damage, including from storms. Each level cuts lightning damage taken by 1%, 3% every 5th level, 5% every 10th, 10% every 25th; the resistance caps at 75%.',

  'light_resistance.desc': 'Trained by taking light damage, including glare and holy light. Each level cuts light damage taken by 1%, 3% every 5th level, 5% every 10th, 10% every 25th; the resistance caps at 75%.',

  'dark_resistance.desc': 'Trained by taking dark damage. Each level cuts dark damage taken by 1%, 3% every 5th level, 5% every 10th, 10% every 25th; the resistance caps at 75%. Seeing in darkness is Darkvision, not this.',

  'arcane_resistance.desc': 'Trained by taking arcane damage. Each level cuts arcane damage taken by 1%, 3% every 5th level, 5% every 10th, 10% every 25th; the resistance caps at 75%.',

  'smithing.desc': 'Trained by smithing. Each level adds +1% craft speed, plus a step bonus every 5 levels.',

  'woodcutting.desc': 'Trained at woodcutting sites. Each level adds +1% loot, plus a step bonus every 5 levels.',

  'mining.desc': 'Trained at mining sites. Each level adds +1% loot, plus a step bonus every 5 levels.',

  'herbalism.desc': 'Trained at herb-gathering sites. Each level adds +1% loot, plus a step bonus every 5 levels. Herbalism 3 unlocks Alchemy.',

  'cooking.desc': 'Trained by cooking. Each level adds +0.8% craft speed.',

  'alchemy.desc': 'Manifests at Herbalism 3; trained by brewing. Levels buy sequence length (2 steps to 6, at levels 5, 12, 22 and 35) and reagent vocabulary, never brew quality; quality comes from the sequence. Each level adds +0.6% craft speed.',

  'geneshaping.desc': 'Unlocked by quest; trained by geneshaping, and a new gene pays most. Levels raise what a carcass yields and how far a bench can push a grade. Each level adds +0.6% craft speed.',

  'runecarving.desc': 'Trained at the rune table. Each level adds +1% craft speed, plus a step bonus every 5 levels.',

  'unarmed_combat.desc': 'Manifests at Fighting 3 while unarmed; trained by unarmed combat. Each level adds +2% damage and +0.5% attack speed while unarmed.',

  'dagger_combat.desc': 'Manifests at Fighting 3 with a dagger equipped; trained by dagger combat. Each level adds +0.3% crit and +1.2% damage while a dagger is equipped.',

  'staff_combat.desc': 'Manifests at Fighting 3 with a staff equipped; trained by staff combat. Each level adds +1% damage and +1.2% spell power while a staff is equipped.',

  'club_combat.desc': 'Manifests at Fighting 3 with a blunt weapon equipped; trained by blunt combat. Each level adds +1.6% damage and +0.05 armor while a blunt weapon is equipped.',

  'greatsword_combat.desc': 'Manifests at Fighting 8 with a greatsword equipped; trained by greatsword combat. Each level adds +1.8% damage and +0.15% crit while a greatsword is equipped.',

  'spear_combat.desc': 'Manifests at Fighting 8 with a spear equipped; trained by spear combat. Each level adds +1.8% attack speed and +0.15% crit while a spear is equipped.',

  'bow_combat.desc': 'Manifests at Fighting 3 with a bow equipped; trained by bow combat. Each level adds +0.2% crit, +0.2% dodge and +1% damage while a bow is equipped.',

  'deflection.desc': 'Manifests at Fighting 5 with a parrying item equipped (parrying dagger, buckler, rapier); any fight while carrying one trains it, in any stance. Each level adds +0.2% parry and +0.6% riposte while one is equipped.',

  'school_ittou_ryu.desc': 'Katana school. Manifests by fighting in the Quick stance with a katana at Swordsmanship 25 and Dexterity 20; replaces Quick with Ittou-ryu. In that style with a katana: +5% crit and +5% damage, plus +0.4% crit and +2% damage per level.',

  'school_jigen_ryu.desc': 'Katana school. Manifests by fighting in the Crush stance with a katana at Swordsmanship 15 and Strength 30; replaces Crush with Jigen-ryu. Each level adds +0.5% damage in that style.',

  'school_niten_ichi.desc': 'Katana school. Manifests by fighting in the Flurry stance with a katana at Swordsmanship 25 and Dexterity 35; replaces Flurry with Niten-Ichi-ryu. Each level adds +0.15% parry and +0.4% riposte in that style.',

  'school_eishin.desc': 'Katana school. Manifests by fighting in the Finesse stance with a katana at Swordsmanship 20 and Dexterity 40; replaces Finesse with Eishin-ryu. Each level adds +0.15% crit in that style.',

  'school_destreza.desc': 'Rapier school. Manifests by fighting in the Evasive stance with a rapier at Swordsmanship 18, Deflection 10 and Dexterity 30; replaces Evasive with Destreza. Each level adds +0.2% parry and +0.8% riposte in that style.',

  'school_bolognese.desc': 'Sword-and-buckler school. Manifests by fighting in the Brace stance with a sword and a buckler at Shield Combat 15, Swordsmanship 12, Deflection 8 and Dexterity 20; replaces Brace with Bolognese. Each level adds +0.15% parry and +0.5% riposte in that style.',

  'school_magic_combat.desc': 'Spellblade school. Manifests by fighting in the Finesse stance at Fighting 10, Magic 10 and Intelligence 20; replaces Finesse with Magic Combat, whose exertion spends mana instead of stamina. Each level adds +0.8% damage in that style.',

  'school_boxing.desc': 'Unarmed school. Manifests by fighting in the Evasive stance while unarmed at Unarmed Combat 20, Strength 30 and Constitution 25; replaces Evasive with Boxing. Each level adds +0.3% attack speed and +0.1% dodge in that style.',

  'school_taekwondo.desc': 'Unarmed school. Manifests by fighting in the Flurry stance while unarmed at Unarmed Combat 25 and Dexterity 40; replaces Flurry with Taekwondo. Each level adds +0.15% dodge in that style.',

  'school_muay_thai.desc': 'Unarmed school. Manifests by fighting in the Crush stance while unarmed at Unarmed Combat 35, Strength 40 and Constitution 40; replaces Crush with Muay Thai. Each level adds +0.5% damage in that style.',

  'school_wrestling.desc': 'Unarmed school. Manifests by fighting in the Brace stance while unarmed at Unarmed Combat 20, Strength 40 and Charisma 30; replaces Brace with Wrestling. Each level adds +0.8 max HP in that style.',

  'shield_combat.desc': 'Manifests at Fighting 3 with a shield equipped; trained by fighting with one. Each level adds +2% armor and +1 max HP while a shield is equipped.',

  'leathercrafting.desc': 'Trained by leatherwork. Each level adds +1% craft speed for leatherwork only; other crafts are unaffected.',

  'school_capoeira.desc': 'Unarmed school. Manifests by fighting in the Flurry stance while unarmed at Unarmed Combat 25 and Dexterity 40, after 100 dodges; replaces the Quick stance with Capoeira. Each level adds +0.15% dodge in that style.',

  'school_eskrima.desc': 'Dagger school. Manifests at Dagger Combat 25 and Dexterity 30 with a dagger equipped. Grants no bonuses yet.',
};
