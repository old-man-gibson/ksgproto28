import type { ProseTable } from './prose';

// Player-facing text for src/core/data/mutagens.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- MAIN_GENES ----------
export const MAIN_GENES_TEXT: ProseTable = {
  'slime_gene.desc': 'Special: critical hits deal 20% less bonus damage to you. Active: Slime Bounce, bludgeoning damage of a flat 60 plus your armour, scaled by your speed; the target loses two ticks of action bar. 70 tick cooldown. Attacks: 6% of remaining cooldown refunded when a technique misses. Defences: +6% slashing resistance.',

  'slimer_gene.desc': 'The slime line, one rung up. Crit bonus damage -28%, Slime Bounce flat 125, 9% cooldown refund on a miss, +10% slashing resistance.',

  'slimest_gene.desc': 'Top of the plain slime line. Crit bonus damage -36%, Slime Bounce flat 255, 12% cooldown refund on a miss, +14% slashing and +6% piercing resistance.',

  'slime_guardian_gene.desc': 'Special: 10% less damage from everything, 15% less crit bonus damage, +14% ranged resistance. Active: Slime Shield, a buff that raises armour by 50% and adds a flat 12 ward applied after resistances, 90 ticks on a 240 tick cooldown; it fires off the buff slot, not the action bar. Attacks: 14% cooldown refund on a miss and 45% less off-balance penalty. Defences: +16% slashing, +10% piercing, +5% bludgeoning resistance and +15% armour.',

  'slime_golem_gene.desc': 'Special: 22% less damage from everything, 30% less crit bonus damage. Active: Slime Crash, bludgeoning damage of a flat 430 plus your armour, scaled by speed, with 50% splash onto the flanks; you lose ten ticks of action bar after it. 130 tick cooldown. Attacks: +12% technique damage, and 20% of a missed swing lands as a graze. Defences: +18% slashing, +14% piercing, +10% bludgeoning resistance.',

  'slime_king_gene.desc': 'Special: a slime bodyguard with no armour of its own intercepts attacks and returns ten seconds after it dies. Active: Suislime detonates the bodyguard for damage to every enemy scaled by its remaining HP, usable at any time and off the attack gauge. Attacks: +18% technique damage, half again while the bodyguard lives. Defences: +20% slashing, +16% piercing, +12% bludgeoning and +6% elemental resistance.',

  'fire_slime_gene.desc': 'Special: 20% less crit bonus damage. Active: Flaming Bounce, heat damage of a flat 60, scaled by speed and multiplied by your heat resistance, with a two tick stun. 70 tick cooldown. Attacks: technique damage +50% of your heat resistance value, so heat resistance is the damage stat for this line. Defences: +10% heat and +6% slashing resistance.',

  'flame_slime_gene.desc': 'The fire line, one rung up. Crit bonus damage -28%, Flaming Bounce flat 125, technique damage +70% of heat resistance, +16% heat and +10% slashing resistance.',

  'blaze_slime_gene.desc': 'Top of the fire line. Crit bonus damage -36%, Flaming Bounce flat 255, technique damage +95% of heat resistance, +22% heat, +12% slashing and +6% piercing resistance.',

  'troll.desc': 'Special: HP regeneration equal to 0.4% of max HP; heat or acid damage stops it (Doused) for four seconds. Active: Troll Bite, piercing damage at 1.4 times your damage plus a flat 30, inflicting Bleeding and Punctured. 80 tick cooldown. Attacks: damage +50% of your bludgeoning resistance value, and +15% with a bone weapon. Defences: +16% slashing, +12% piercing, -25% heat resistance. Size: large.',

  'rock_giant.desc': 'Special: +15% max HP, and 6% less damage per size step the attacker is below you. Active: Rock Throw, bludgeoning damage at 1.6 times your damage plus a flat 100. 90 tick cooldown. Attacks: +12% with stone or wood weapons, +5% damage per size step the target is below you. Defences: +12% bludgeoning and +12% earth resistance. Size: large.',

  'hill_giant.desc': 'The rock giant, one rung up. Special: +24% max HP, 8% less damage per size step the attacker is below you. Active: Boulder Throw, bludgeoning damage at 1.8 times your damage plus a flat 200. Attacks: +18% with stone or wood weapons, +7% per size step the target is below you. Defences: +18% bludgeoning and +18% earth resistance. Size: huge.',

  'forest_giant.desc': 'Special: +24% max HP, and any two-handed weapon can be held in one hand; the two-handed speed penalty is offset by 8% attack speed rather than removed. Active: Tree Throw, bludgeoning damage at 1.8 times your damage plus a flat 200, inflicting Seeded. Attacks: +22% with wood or bone weapons. Defences: +16% bludgeoning and +20% poison resistance. Size: huge.',

  'jotunn.desc': 'Special: +40% max HP, 10% less damage per size step the attacker is below you, and blunt weapons and tower shields can be held in one hand, with two-handed speed penalties offset by 15% attack speed. Active: Mountain Crusher, bludgeoning damage to every enemy at 2.2 times your damage plus a flat 400, with earth and cold riders of 60 each, inflicting Chilled. 140 tick cooldown. Attacks: +35% with blunt weapons, +9% per size step the target is below you. Defences: +24% bludgeoning, +24% cold, +18% wind resistance. Size: gargantuan.',

  'fomorian.desc': 'Special: +40% max HP, 10% less damage per size step the attacker is below you, and spears and tower shields can be held in one hand, with two-handed speed penalties offset by 15% attack speed. Active: Deep Thrust, single-target piercing damage at 2.2 times your damage plus a flat 400 with a 90 dark rider, inflicting On Fire. 120 tick cooldown. Attacks: +30% with spears, +9% per size step the target is below you. Defences: +20% bludgeoning, +22% water, +22% dark resistance. Size: gargantuan.',

  'storm_giant.desc': 'Special: +55% max HP, and greatswords, blunt weapons and tower shields can be held in one hand, with two-handed speed penalties offset by 15% attack speed. Active: Mountain Throw, bludgeoning damage at 2.4 times your damage plus a flat 800, doubling for every two size steps the target is below you. 110 tick cooldown. Attacks: +30% with wood or stone weapons. Defences: +26% bludgeoning, +26% wind, +26% lightning resistance. Size: colossal.',

  'balor.desc': 'Unique fomorian variant. Special: +55% max HP, 12% less damage per size step the attacker is below you, spears and tower shields in one hand. Active: Eye of Balor, piercing damage at 2.6 times your damage plus a flat 1000 with a 200 dark rider, 25% splash to every enemy, and any target whose remaining HP is at most half the blow dies outright. 200 tick cooldown. Attacks: +40% with spears, +12% per size step the target is below you. Defences: +26% bludgeoning, +28% water, +28% dark resistance. Size: gargantuan.',

  'surtr.desc': 'Unique jotunn variant. Special: +70% max HP, 12% less damage per size step the attacker is below you, and a greatsword in one hand swings faster than in two (+30% attack speed against the two-handed penalty). Active: Ragnarök, heat damage to every enemy at 3 times your damage plus a flat 1600; any target whose remaining HP is at most 60% of the blow dies outright, and survivors take Blazing, a heat damage over time. 260 tick cooldown. Attacks: +35% with greatswords. Defences: +50% heat, +30% slashing, +30% earth resistance, and the resistance cap raised by 5%. Size: colossal.',

  'asurendra_tarunavak.desc': 'Special: two extra arms, and every 10 to 20 ticks it speaks one of sixteen single words (thirteen elements plus pierce, cut and crush) at no cost, at 0.6 to 1.2 power by grade; each repetition of the same word in a fight is cast one rung louder. Active: Unsaying, arcane damage scaled by CHA that consumes every affliction on the field, multiplies by the count consumed, and splits across all enemies. 200 tick cooldown. Attacks: +0.35 extra hits per swing.',

  'asurendra_vashkara.desc': 'Special: six telekinetic grips that count as arms; none of them is a hand. Held weapons float and strike on their own with no guard, footwork or parry response while your action bar is spent elsewhere, and nothing is left to punch with. Active: Every Blade at Once, a volley of 4 to 8 floating strikes over ten ticks. 240 tick cooldown. Attacks: +4% crit.',

  'asurendra_anupama.desc': 'Special: the plain swing is removed; techniques and castings remain. Every attack or cast by anyone in the fight, you included, adds a stack of Hunger, an uncapped dark damage over time of which half ignores resistance. Attacks: no damage bonus; HP regeneration rooted off your damage instead. Defences: armour, and a ward against afflictions capped at 60%, both growing with the total Hunger on the field. Active: The Weight of Hunger, dark damage to every enemy priced off the Hunger stacks each one carries, leaving a slow scaled the same way. 240 tick cooldown.',

  'asurendra_niraksha.desc': 'Special: four extra arms and no eyes, so darkness and blindness cost it nothing. Any critical hit inflicts Blinded for the rest of the fight. Active: The Long Word, dark damage at 2.2 times your damage plus a flat 120, after a 30 to 60 tick incantation during which the action bar fills at one third rate; the blow is a guaranteed crit, and crit chance past certainty rolls a second multiplier. 260 tick cooldown. Attacks: +0.35 extra hits per swing.',

  'asurendra_kritavya.desc': 'Special: every casting in the fight, yours included, is refuted with 30% to 90% chance by grade; a refuted cast is negated, its cost is still paid, and with 15% to 66% chance (plus 3% per repeat of the same working) that working is sealed for the rest of the fight. Active: Refutation, a 100 to 200 tick buff granting a flat 40 ward plus 1.5 times spell power; anything that strikes you takes 6 piercing and Punctured. 300 tick cooldown. Attacks: +0.35 extra hits per swing.',
};

// ---------- NUCLEASES ----------
export const NUCLEASES_TEXT: ProseTable = {
  'vuln.desc': 'Rekeys a weak point of the gene it is applied to: negative resistances and dousing types are rewritten to the element of the mutation fused in, nearest first. Magnitudes do not change. Drops from undead.',
};
