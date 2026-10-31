import type { ProseTable } from './prose';

// Player-facing text for src/core/data/mutagens.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- MAIN_GENES ----------
export const MAIN_GENES_TEXT: ProseTable = {
  'slime_gene.desc': 'Special: critical hits deal 20% less bonus damage to you. Active: Slime Bounce, bludgeoning damage of a flat 60 plus your armour, scaled by your speed; the target loses two ticks of action bar. 7 s cooldown. Attacks: 6% of remaining cooldown refunded when a technique misses. Defences: +6% slashing resistance.',

  'slimer_gene.desc': 'Next tier of the slime line after Slime Gene. Crit bonus damage -28%, Slime Bounce flat 125, 9% cooldown refund on a miss, +10% slashing resistance.',

  'slimest_gene.desc': 'Top of the plain slime line. Crit bonus damage -36%, Slime Bounce flat 255, 12% cooldown refund on a miss, +14% slashing and +6% piercing resistance.',

  'slime_guardian_gene.desc': 'Special: 10% less damage from everything, 15% less crit bonus damage, +14% ranged resistance. Active: Slime Shield, a buff that raises armour by 50% and adds a flat 12 ward applied after resistances, 9 s on a 24 s cooldown; it fires off the buff slot, not the action bar. Attacks: 14% cooldown refund on a miss and 45% less off-balance penalty. Defences: +16% slashing, +10% piercing, +5% bludgeoning resistance and +15% armour.',

  'slime_golem_gene.desc': 'Special: 22% less damage from everything, 30% less crit bonus damage. Active: Slime Crash, bludgeoning damage of a flat 430 plus your armour, scaled by speed, with 50% splash onto the flanks; you lose ten ticks of action bar after it. 13 s cooldown. Attacks: +12% technique damage, and 20% of a missed swing lands as a graze. Defences: +18% slashing, +14% piercing, +10% bludgeoning resistance.',

  'slime_king_gene.desc': 'Special: a slime bodyguard with no armour of its own intercepts attacks and returns ten seconds after it dies. Active: Suislime detonates the bodyguard for damage to every enemy scaled by its remaining HP, usable at any time and off the attack gauge. Attacks: +18% technique damage, half again while the bodyguard lives. Defences: +20% slashing, +16% piercing, +12% bludgeoning and +6% elemental resistance.',

  'fire_slime_gene.desc': 'Special: 20% less crit bonus damage. Active: Flaming Bounce, heat damage of a flat 60, scaled by speed and multiplied by your heat resistance, with a two tick stun. 7 s cooldown. Attacks: technique damage +50% of your heat resistance value, so heat resistance is the damage stat for this line. Defences: +10% heat and +6% slashing resistance.',

  'flame_slime_gene.desc': 'Next tier of the fire line after Fire Slime Gene. Crit bonus damage -28%, Flaming Bounce flat 125, technique damage +70% of heat resistance, +16% heat and +10% slashing resistance.',

  'blaze_slime_gene.desc': 'Top of the fire line. Crit bonus damage -36%, Flaming Bounce flat 255, technique damage +95% of heat resistance, +22% heat, +12% slashing and +6% piercing resistance.',

  'troll.desc': 'Special: HP regeneration equal to 0.4% of max HP; heat or acid damage stops it (Doused) for four seconds. Active: Troll Bite, piercing damage at 1.4 times your damage plus a flat 30, inflicting Bleeding and Punctured. 8 s cooldown. Attacks: damage +50% of your bludgeoning resistance value, and +15% with a bone weapon. Defences: +16% slashing, +12% piercing, -25% heat resistance. Size: large.',

  'rock_giant.desc': 'Special: +15% max HP, and 6% less damage per size step the attacker is below you. Active: Rock Throw, bludgeoning damage at 1.6 times your damage plus a flat 100. 9 s cooldown. Attacks: +12% with stone or wood weapons, +5% damage per size step the target is below you. Defences: +12% bludgeoning and +12% earth resistance. Size: large.',

  'hill_giant.desc': 'Next tier after Rock Giant Gene. Special: +24% max HP, 8% less damage per size step the attacker is below you. Active: Boulder Throw, bludgeoning damage at 1.8 times your damage plus a flat 200. Attacks: +18% with stone or wood weapons, +7% per size step the target is below you. Defences: +18% bludgeoning and +18% earth resistance. Size: huge.',

  'forest_giant.desc': 'Special: +24% max HP, and any two-handed weapon can be held in one hand; the two-handed speed penalty is offset by 8% attack speed rather than removed. Active: Tree Throw, bludgeoning damage at 1.8 times your damage plus a flat 200, inflicting Seeded. Attacks: +22% with wood or bone weapons. Defences: +16% bludgeoning and +20% poison resistance. Size: huge.',

  'jotunn.desc': 'Special: +40% max HP, 10% less damage per size step the attacker is below you, and blunt weapons and tower shields can be held in one hand, with two-handed speed penalties offset by 15% attack speed. Active: Mountain Crusher, bludgeoning damage to every enemy at 2.2 times your damage plus a flat 400, with earth and cold riders of 60 each, inflicting Chilled. 14 s cooldown. Attacks: +35% with blunt weapons, +9% per size step the target is below you. Defences: +24% bludgeoning, +24% cold, +18% wind resistance. Size: gargantuan.',

  'fomorian.desc': 'Special: +40% max HP, 10% less damage per size step the attacker is below you, and spears and tower shields can be held in one hand, with two-handed speed penalties offset by 15% attack speed. Active: Deep Thrust, single-target piercing damage at 2.2 times your damage plus a flat 400 with a 90 dark rider, inflicting On Fire. 12 s cooldown. Attacks: +30% with spears, +9% per size step the target is below you. Defences: +20% bludgeoning, +22% water, +22% dark resistance. Size: gargantuan.',

  'storm_giant.desc': 'Special: +55% max HP, and greatswords, blunt weapons and tower shields can be held in one hand, with two-handed speed penalties offset by 15% attack speed. Active: Mountain Throw, bludgeoning damage at 2.4 times your damage plus a flat 800, doubling for every two size steps the target is below you. 11 s cooldown. Attacks: +30% with wood or stone weapons. Defences: +26% bludgeoning, +26% wind, +26% lightning resistance. Size: colossal.',

  'balor.desc': 'Unique fomorian variant. Special: +55% max HP, 12% less damage per size step the attacker is below you, spears and tower shields in one hand. Active: Eye of Balor, piercing damage at 2.6 times your damage plus a flat 1000 with a 200 dark rider, 25% splash to every enemy, and any target whose remaining HP is at most half the blow dies outright. 20 s cooldown. Attacks: +40% with spears, +12% per size step the target is below you. Defences: +26% bludgeoning, +28% water, +28% dark resistance. Size: gargantuan.',

  'surtr.desc': 'Unique jotunn variant. Special: +70% max HP, 12% less damage per size step the attacker is below you, and a greatsword in one hand swings faster than in two (+30% attack speed against the two-handed penalty). Active: Ragnarök, heat damage to every enemy at 3 times your damage plus a flat 1600; any target whose remaining HP is at most 60% of the blow dies outright, and survivors take Blazing, a heat damage over time. 26 s cooldown. Attacks: +35% with greatswords. Defences: +50% heat, +30% slashing, +30% earth resistance, and the resistance cap raised by 5%. Size: colossal.',

  'asurendra_tarunavak.desc': 'Special: two extra arms, and every 2 to 1 s it speaks one of sixteen single words (thirteen elements plus pierce, cut and crush) at no cost, at 0.6 to 1.2 power by grade; each repetition of the same word in a fight is cast as the next stacked form (e.g. fire, flame, blaze), up to three. Active: Unsaying, arcane damage scaled by CHA that removes every condition from everyone in the fight, you included, and multiplies the damage by the number removed (unchanged if none); splash from other sources hits every enemy. 20 s cooldown. Attacks: +0.35 extra hits per swing.',

  'asurendra_vashkara.desc': 'Special: six telekinetic arms, none of them a hand. Equipped weapons float and strike on their own clock, one weapon per swing in turn, with no technique, stance position, stamina cost, riposte or parry; crits, grazes, enchants, runes and oil still apply, and Wisdom adds up to +50% to their damage (+25% at Wisdom 120). No hands are left to punch with. Active: Every Blade at Once, a volley of 4 to 8 floating strikes over 1 s. 24 s cooldown. Attacks: +4% crit.',

  'asurendra_anupama.desc': 'Special: plain weapon swings cannot be taken; techniques and casts still can. Every attack or cast by anyone in the fight, you included, adds a stack of Hunger, an uncapped dark damage over time of which half ignores resistance. Attacks: no damage bonus; instead HP regeneration of 0.05 x your damage^(1/root), the root falling from 4 at grade F to 2.5 at S. Defences: armour +6 x ln(1 + total Hunger on the field) and a ward against afflictions of 25% x ln(1 + total Hunger), capped at 60%. Active: The Weight of Hunger, dark damage to every enemy scaled by the Hunger stacks it carries, and a slow scaled the same way. 24 s cooldown.',

  'asurendra_niraksha.desc': 'Special: four extra arms and no eyes, so darkness and blindness cost it nothing. Any critical hit inflicts Blinded for the rest of the fight. Active: The Long Word, dark damage at 2.2 times your damage plus a flat 120, after a 6 to 3 second incantation (by grade) during which the action bar fills at one third rate; the blow is a guaranteed crit, and crit chance above 100% rolls for a second crit multiplier. 26 s cooldown. Attacks: +0.35 extra hits per swing.',

  'asurendra_kritavya.desc': 'Special: every spell cast in the fight, yours included, is negated with 30% to 90% chance by grade; a negated spell has no effect, its cost is still paid, and the caster takes arcane damage equal to its mana cost. With 15% to 66% chance (plus 3% per earlier cast of the same spell) that spell cannot be cast again for the rest of the fight. Active: Refutation, a 10 to 20 second buff (by grade) that absorbs a flat 40 damage plus 1.5 times spell power from each hit; anything that strikes you in melee takes 6 piercing damage and is Punctured. 30 s cooldown. Attacks: +0.35 extra hits per swing.',
};

// ---------- NUCLEASES ----------
export const NUCLEASES_TEXT: ProseTable = {
  'vuln.desc': 'Changes the element of a weak point on the gene: a negative resistance, or an element that stops a conferred effect (heat and acid stop the Troll Gene’s regeneration), becomes the element of the mutation fused into the nuclease. Weak points change in the order they are listed on the card, using the routes nearest the main gene first. Amounts do not change. Drops from undead.',
};
