import type { ProseTable } from './prose';

// Player-facing text for src/core/data/mutagens.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- MAIN_GENES ----------
export const MAIN_GENES_TEXT: ProseTable = {
  'slime_gene.desc': 'Special: takes less damage from critical hits. Active: Slime Bounce — crash into an enemy for a flat crash plus your armor, all of it carried by how fast you move, with a mini-stun costing them two ticks of action bar. Attacks: techniques shed a little cooldown when they miss.',

  'slimer_gene.desc': 'As the slime, further along. Same three tricks, more of each.',

  'slimest_gene.desc': 'The plain line at its limit — and the first rung that stops a point as well as an edge.',

  'slime_guardian_gene.desc': 'Special: takes less damage from everything, a little less from crits, and doubled (diminishing) against ranged attacks. Active: Slime Shield — raise armor and gain a flat shield applied AFTER resistances. Attacks: cooldown shed on miss, and off-balance hurts less.',

  'slime_golem_gene.desc': 'Special: takes far less damage from everything, moderately less from crits. Active: Slime Crash — hit for damage scaled by armor, spilling onto the flanks, and lose ten ticks of your own build-up. Attacks: techniques deal bonus damage, and that bonus still lands as a graze on a miss.',

  'slime_king_gene.desc': 'Special: a slime bodyguard with no armor of its own steps in front of attacks, and comes back ten seconds after it dies. Active: Suislime — detonate the bodyguard for damage to every enemy scaled by its remaining HP, usable at any time and off the attack gauge entirely. Attacks: bonus technique damage, half again while the bodyguard lives.',

  'fire_slime_gene.desc': 'Special: less damage from crits, and your blows carry fire. Active: Flaming Bounce — the slime bounce as a flame, carried by how fast you move and amplified by your own fire resistance. Attacks: technique damage rises with your fire resistance, so defence against heat IS the offence here.',

  'flame_slime_gene.desc': 'The fire line, further along. The same loop, wound tighter.',

  'blaze_slime_gene.desc': 'The fire line at its limit. Heat resistance has become a damage stat.',

  'troll.desc': 'Special: you knit yourself back together — until something burns or dissolves you, which stops it dead. Active: Troll Bite — piercing damage that opens a wound and leaves it open. Attacks: your hide is your fist, and bone in your hands is worth more. Defenses: hard to cut and hard to puncture, and dangerously soft to fire.',

  'rock_giant.desc': 'Special: more health, and less of what small things can do to you. Active: Rock Throw — a flat lump of damage that grows against anything beneath your size. Attacks: two-handed stone and wood. Defenses: bludgeoning and earth.',

  'hill_giant.desc': 'The rock giant, one size up and one rock heavier. Special: more health, and less of what small things can do to you. Active: Boulder Throw. Attacks: two-handed stone and wood. Defenses: bludgeoning and earth.',

  'forest_giant.desc': 'Special: more health, and any two-handed weapon sits in one hand — at a reduced rather than erased speed cost. Active: Tree Throw — the throw, and something takes root in what it hits. Attacks: two-handed wood and bone. Defenses: bludgeoning and poison.',

  'jotunn.desc': 'Special: much more health, and hammers and tower shields sit in one hand with their weight erased. Active: Mountain Crusher — the ground goes out from under every enemy at once, in earth and ice, and leaves them chilled. Attacks: two-handed hammers, enormously. Defenses: bludgeoning, ice and wind, and little things cannot reach you.',

  'fomorian.desc': 'Special: much more health, and spears and tower shields sit in one hand with their weight erased. Active: Deep Thrust — one target, run through, and the wound burns. Attacks: two-handed spears, with something dark riding the point. Defenses: bludgeoning, water and dark, and little things cannot reach you.',

  'storm_giant.desc': 'Special: enormous health, and greatswords, hammers and tower shields all sit in one hand weightlessly. Active: Mountain Throw — the flat throw, doubling for every two sizes the target is beneath you. Attacks: two-handed wood and stone. Defenses: bludgeoning, wind and lightning.',

  'balor.desc': 'Special: enormous health, and spears and tower shields sit in one hand weightlessly. Active: Eye of Balor — piercing gloom that finishes anything already failing. Attacks: two-handed spears, heavily shadowed. Defenses: bludgeoning, water and dark, and little things cannot reach you.',

  'surtr.desc': 'Special: enormous health, and a greatsword in one hand is FASTER than in two. Active: Ragnarök — fire on everything, fatal to whatever was already failing, and the survivors keep burning. Defenses: fire, slashing and earth, a higher ceiling on resistance than anything else can reach, and burning creatures cannot reach you.',

  'asurendra_tarunavak.desc': 'Special: two more arms, and a mouth that will not stop — one word of the sixteen at a time, spoken for free, each saying itself louder than the last. Active: tears every affliction out of the air at once and spends them on whoever is standing.',

  'asurendra_vashkara.desc': 'Special: six grips, and not one of them a hand. Everything you carry hangs in the air and fights on its own — no guard, no footwork, no answering a parry, just an edge that keeps finding its mark while you spend your own turn on something else. And nothing to punch with if you have not got anything else to spend it on. Active: every blade turns at once.',

  'asurendra_anupama.desc': 'Special: it does not reach for what is in front of it — the plain blow is gone, and everything deliberate remains. Anyone who attacks or casts, you included, takes on a hunger that never fills and that half of no resistance will answer. Arms: no damage at all, and regeneration in its place; armour and a dulling of afflictions that grows with every appetite loose in the fight. Active: everything in the room is made to carry what it has taken.',

  'asurendra_niraksha.desc': 'Special: four more arms, and no eyes to lose — the dark costs it nothing and nothing can blind what is already blind. What it does open, it opens for good. Active: a long, slowing incantation that ends in a blow which cannot fail to find the seam.',

  'asurendra_kritavya.desc': 'Special: every working spoken in its hearing is argued with — yours as readily as theirs — and the speaker pays for the argument. Say the same thing twice in front of it and it may stop being sayable at all. Active: holds a refusal in front of you that answers what strikes it.',
};

// ---------- NUCLEASES ----------
export const NUCLEASES_TEXT: ProseTable = {
  'vuln.desc': 'Rewrites what a body cannot bear. The wound stays the same size; it simply answers to something else.',
};
