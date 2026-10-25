import type { ProseTable } from './prose';

// Player-facing text for src/core/data/martial.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- POSITIONS ----------
export const POSITIONS_TEXT: ProseTable = {
  'neutral.desc': 'The starting position. Every encounter begins here, and every plain swing returns here.',

  'coiled.desc': 'Wind-up position. Entered by Gather and Ginga; Heavy Blow and other heavy techniques start from here.',

  'extended.desc': 'Reach position. Entered by Lunge, Riposte and Crosscut; Thrust starts from here.',

  'off_balance.desc': 'Incoming damage ×1.15 while here. Left in it by Heavy Blow, Weapon Drop and Overwhelming forks; Ginga and Meia Lua start from here.',

  'guarded.desc': 'Incoming damage ×0.9 while here. Entered by Sidestep and Clinch Knee; Flowing Shield and Electric Cross start from here.',

  'spell_ready.desc': 'Holds a readied spell. Incoming damage ×1.1 while here. Entered by Ready Spell; Spell Parry starts from here. Leaving it by any other move drops the spell.',

  'wide_open.desc': 'Incoming damage ×1.2 while here. Entered by Taunt, Impaling Swing and Exposing forks; German Suplex and Flesh Draw start from here.',
};

// ---------- FORK_ARCHETYPES ----------
export const FORK_ARCHETYPES_TEXT: ProseTable = {
  'split.desc': 'Strike fork: 2 hits at 0.65× damage each, 1.3× in total.',

  'overwhelm.desc': 'Strike fork: 1.6× damage; the move exits to Off Balance.',

  'exposing.desc': 'Strike fork: 1.3× damage and dodge ×0.8; the move exits to Wide Open.',

  'economy.desc': 'Strike fork: 0.9× damage, cooldown ×0.6.',

  'sweep.desc': 'Strike fork: 0.9× damage, +35% splash to enemies beside the target.',

  'flowing.desc': 'Strike fork: the move exits to Extended instead of its usual position.',

  'lasting.desc': 'Buff fork: duration ×1.6.',

  'sudden.desc': 'Buff fork: cooldown ×0.65.',
};

// ---------- TECHNIQUES ----------
export const TECHNIQUES_TEXT: ProseTable = {
  'gather.desc': 'Neutral → Coiled. 0.6× damage, +0.02 momentum, 3 s cooldown. Unlocks at Fighting 5; learned after 100 attacks, or after seeing it used on you 50 times.',

  'lunge.desc': 'Coiled → Extended. Any weapon. 1.3× damage, costs 3% stamina, 4 s cooldown. Unlocks at Fighting 8; learned after 400 attacks, or after seeing it used on you 50 times.',

  'heavy_blow.desc': 'Coiled → Off Balance. 2.0× damage, costs 8% stamina, 6 s cooldown. Unlocks at Fighting 5 and Strength 8; learned after 50 crits, or after seeing it used on you 50 times. Perfected, it also starts from Neutral.',

  'hamstring.desc': 'Goblin. Coiled → Extended. 0.9× damage, 50% chance to inflict Unfooted, 5 s cooldown. Unlocks at Fighting 5; learned after seeing it used on you 50 times.',

  'dirty_stab.desc': 'Goblin. Extended → Neutral. 1.1× damage, 50% chance to inflict Bleeding, 4 s cooldown. Unlocks at Fighting 5; learned after seeing it used on you 50 times.',

  'pocket_sand.desc': 'Goblin. From any position → Neutral. 0.3× damage, 60% chance to inflict Dazzled, 12 s cooldown. Unlocks at Fighting 5; learned after seeing it used on you 50 times.',

  'sidestep.desc': 'Triggers on being hit, from any position → Guarded. +40% dodge for 3 seconds, 12 s cooldown. Unlocks at Fighting 8 and Dexterity 10; learned after 100 hits taken.',

  'riposte.desc': 'Triggers on a dodge, from any position → Extended. 1.4× damage, 4 s cooldown. Unlocks at Fighting 12 and Dexterity 12; learned after 50 dodges.',

  'thrust.desc': 'Sword. Extended → Neutral. 1.5× damage, +15% penetration, 3 s cooldown. Unlocks at Swordsmanship 5; learned after 250 attacks.',

  'crosscut.desc': 'Sword. Triggers on a crit, from Neutral or Extended → Extended. 1.3× damage, 30% splash to adjacent enemies, 5 s cooldown. Unlocks at Swordsmanship 10; learned after 100 crits.',

  'iai_draw.desc': 'Katana. Triggers at encounter start, Neutral → Extended. 1.9× damage, +10% penetration, 30 s cooldown. Unlocks at Swordsmanship 15 with a katana; learned after 150 crits.',

  'deflecting_moon.desc': 'Katana. Triggers on a parry, from any position → Coiled. +20% crit for 3 seconds, 10 s cooldown. Unlocks at Swordsmanship 15 and Dexterity 15 with a katana; learned after 25 parries.',

  'finishing_cut.desc': 'Katana. Triggers while the enemy is at or below 25% HP, from Coiled or Extended → Neutral. 2.2× damage, costs 6% stamina, 8 s cooldown. Unlocks at Swordsmanship 25 with a katana; learned after 500 attacks.',

  'slip_jab.desc': 'Unarmed. Triggers on a dodge, from any position → Neutral. 1.15× damage, 2 s cooldown. Unlocks at Unarmed Combat 10; learned after 75 dodges.',

  'whirl_kick.desc': 'Unarmed. Coiled → Extended. 1.4× damage, 35% splash to adjacent enemies, costs 5% stamina, 5 s cooldown. Unlocks at Unarmed Combat 15; learned after 300 attacks.',

  'clinch_knee.desc': 'Unarmed. Triggers on being hit, from any position → Guarded. 1.5× damage, 35% chance to inflict Dazed, costs 5% stamina, 9 s cooldown. Unlocks at Unarmed Combat 20; learned after 150 hits taken.',

  'ginga.desc': 'Unarmed. Off Balance → Coiled. 0.8× damage, +0.03 momentum, 2 s cooldown. Unlocks at Unarmed Combat 12; learned after 120 hits taken.',

  'meia_lua.desc': 'Unarmed. Off Balance → Neutral. 1.35× damage, 40% splash to adjacent enemies, costs 5% stamina, 5 s cooldown. Unlocks at Unarmed Combat 18; learned after 100 dodges.',

  'weapon_drop.desc': 'Requires a wielded weapon. Any position → Off Balance. 0.9× damage and drops your weapon to the ground; you fight unarmed until Ground Draw recovers it. 10 s cooldown. Unlocks at Fighting 15 and Unarmed Combat 10; learned after 600 attacks.',

  'ground_draw.desc': 'Requires a grounded weapon. Coiled → Extended. 2.4× damage, +15% penetration, costs 6% stamina, recovers the weapon. 12 s cooldown. Unlocks at Fighting 15; learned after 800 attacks.',

  'hidden_draw.desc': 'Requires a sheathed dagger. Triggers when the enemy\'s attack bar reaches 65%, from any position → Extended. 2.6× damage, +25% penetration, draws the dagger. 15 s cooldown. Unlocks at Dagger Combat 10; learned after 120 crits.',

  'ready_spell.desc': 'Triggers when the enemy\'s attack bar reaches 55%, from Neutral or Guarded → Spell Ready. Takes up the first prepared spell you can pay for and spends its mana now; no strike of its own. 6 s cooldown. Leaving Spell Ready by any other move drops the spell. Unlocks at Magic Combat 1 and Magic 10; learned after 200 attacks.',

  'spell_parry.desc': 'Counter. Requires a readied spell. Triggers on a parry, Spell Ready → Guarded. Reduces the blow by 50% and casts the held spell in reply, off the action bar. 8 s cooldown. Unlocks at Magic Combat 5 and Intelligence 20; learned after 40 parries.',

  'flowing_shield.desc': 'Buckler. Triggers on a parry, Guarded → Coiled. 1.0× damage plus 120% of the damage the parry stopped, costs 4% stamina, 7 s cooldown. Unlocks at Shield Combat 10 and Deflection 5 with a buckler; learned after 40 parries. Drilled, it also starts from Neutral.',

  'electric_cross.desc': 'Counter. Unarmed. Triggers on being hit, Guarded → Extended. Takes 40% off the blow, then hits for 1.0× damage plus 100% of what it blocked as lightning. Costs 6% mana, 8 s cooldown. Unlocks at Magic Combat 10 and Boxing 15; learned after 200 hits taken. Drilled, it also starts from Neutral.',

  'german_suplex.desc': 'Unarmed. Wide Open → Off Balance. 2.0× bludgeoning damage, 12 s cooldown. Unlocks at Strength 30 and Wrestling 25; learned after 150 hits taken.',

  'taunt.desc': 'Any position → Wide Open. 0.25× damage, +0.5 momentum, 10 s cooldown. Unlocks at Speechcraft 15; learned after 200 dodges.',

  'impaling_swing.desc': 'Requires a wielded weapon. Coiled → Wide Open. 0.9× piercing damage, +20% penetration; leaves the weapon in the enemy and inflicts Skewered (−5% speed, −15% dodge for 10 s; 12 piercing damage if it expires). You are unarmed until Flesh Draw. 10 s cooldown. Unlocks at Fighting 15 and Unarmed Combat 10; learned after 600 attacks.',

  'flesh_draw.desc': 'Requires an impaled weapon. Coiled → Extended, or Wide Open → Extended on a dodge. Always crits, at half crit damage and never below 1.5×: 1.4× damage, +85% penetration, costs 6% stamina, recovers the weapon. 12 s cooldown. Unlocks at Fighting 15; learned after 800 attacks.',
};
