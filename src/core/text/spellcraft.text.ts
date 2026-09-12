import type { ProseTable } from './prose';

// Player-facing text for src/core/data/spellcraft.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- ARCANE_WORDS ----------
export const ARCANE_WORDS_TEXT: ProseTable = {
  'fire.desc': 'Heat noun. 2 mana, 1.0 power. 35% chance to set the target On Fire; further fire deepens the burn rather than extending it.',

  'ice.desc': 'Cold noun. 2 mana, 0.9 power. 40% chance to Chill the target: -40% speed.',

  'spark.desc': 'Lightning noun. 2 mana, 0.85 power. 30% chance to Jolt the target; the charge discharges when it next acts.',

  'water.desc': 'Water noun. 2 mana, 0.8 power. 50% chance to make the target Wet: cold, lightning and poison resistance drop, heat resistance rises.',

  'stone.desc': 'Earth noun. 3 mana, 1.15 power. 30% chance to Shardbind the target: it takes piercing damage whenever it attacks or is hit.',

  'gust.desc': 'Wind noun. 2 mana, 0.85 power. 25% chance to Buffet the target: each point gives a 12% chance that a technique ends Off Balance instead of at its declared position.',

  'seed.desc': 'Poison noun. 2 mana, 0.7 power. 50% chance to Seed the target. Seeded does nothing on arrival, grows +0.15 per second while the target is not hit, and records every other condition landed; matured to Rootbound it spreads that record to the other enemies.',

  'iron.desc': 'Piercing noun. 2 mana, 0.9 power. 35% chance to Magnetize the target: each point ignores 10% of its dodge and adds 5% crit chance against it, and lightning cannot miss it.',

  'venom.desc': 'Poison noun. 2 mana, 0.7 power. 60% chance to Poison the target: poison damage over time and -20% stamina regeneration. Only a stronger dose deepens it.',

  'acid.desc': 'Acid noun. 2 mana, 0.7 power. Always Corrodes the target: -12% armor per point, stacking to 6.',

  'light.desc': 'Light noun. 3 mana, 0.9 power. 30% chance to Dazzle the target: 8% miss chance and -5% dodge; repeat hits extend the duration.',

  'gloom.desc': 'Dark noun. 3 mana, 1.0 power. 15% chance to Taint the target: every resistance drops, light and dark resistance most; at 5 stacks it escalates to Corrupted.',

  'zero.desc': 'Untyped noun. 2 mana, 1.0 power. No element and no condition: no resistance reduces it and no weakness increases it.',

  'arcane.desc': 'Arcane noun. 3 mana, 0.9 power. 50% chance to inflict Unravelling: lowers arcane resistance; at 3 stacks it escalates to Manaburn.',

  'cut.desc': 'Verb, slashing delivery. 2 mana. Damage x0.8; the noun’s condition applies at 2.2x the usual rate. Spoken with no noun: 0.55 slashing power, 40% chance to Bleed.',

  'crush.desc': 'Verb, bludgeoning delivery. 2 mana. Damage x1.3; the noun’s condition applies at 0.45x the usual rate. Spoken with no noun: 0.7 bludgeoning power, 40% chance to Concuss.',

  'pierce.desc': 'Verb, piercing delivery. 1 mana. Damage x0.95, ignores 35% of armor; the noun’s condition applies at 0.6x the usual rate. Spoken with no noun: 0.5 piercing power, 40% chance to Puncture.',

  'fly.desc': 'Verb. 1 mana. Cooldown x0.75, damage x0.9. Spoken with no noun: 0.4 power.',

  'expand.desc': 'Verb. 2 mana. Damage x0.85; 50% of the main target’s raw damage spills onto one random flanker. Enough accumulated spill (1.5 raw) makes the spell hit every enemy. Spoken with no noun: 0.4 power.',

  'burst.desc': 'Verb. 2 mana. Damage x1.35, cooldown x1.3. Spoken with no noun: 0.6 power.',

  'grasp.desc': 'Verb. 2 mana. Damage x0.6; the noun’s condition lasts twice as long. Spoken with no noun: 0.3 power.',

  'ward.desc': 'Verb. 2 mana. Always lands on the speaker: +15% resistance to the noun’s element for 30 seconds. Spoken with no noun: +3 armor instead. Leading words lengthen it, trailing words thicken it.',

  'mend.desc': 'Verb. 3 mana. Heals for 1.0 spell power. Lands on the speaker unless another target is spoken; addressed at an enemy, it heals the enemy.',

  'slowly.desc': 'Adverb. 1 mana, spell mana x1.2. Damage x1.4, cooldown x1.5. Leading: conditions last 2x as long at full rate. Trailing: 3x as long at a third of the rate.',

  'quickly.desc': 'Adverb. 1 mana. Damage x0.75, cooldown x0.65. Leading: conditions run in a quarter of the time at 3x rate. Trailing: half the time at 2x rate.',

  'gently.desc': 'Adverb. 1 mana, spell mana x0.85. Damage x0.5 per tier; condition intensity is unchanged. Leading: -5% crit chance. Trailing: -20% crit damage. Use it to apply a condition, to an enemy or to yourself, at low cost.',

  'viciously.desc': 'Adverb. 2 mana, spell mana x1.4. Leading: +7% crit chance per tier. Trailing: +25% crit damage per tier.',

  'intensely.desc': 'Adverb. 2 mana, spell mana x1.3. Condition intensity x1.6. Trailing: condition duration x0.6 as well.',

  'dimly.desc': 'Adverb. 1 mana, spell mana x0.9. Condition intensity x0.6, never below 15% of the condition’s base. Trailing: condition duration x1.6 as well.',

  'twice.desc': 'Adverb. 2 mana, spell mana x1.8. Leading: two separate landings, each rolling its own crit and conditions. Trailing: one landing at double weight.',

  'then.desc': 'Conjunction. 1 mana. The next clause takes the better armor penetration of the two clauses and deals x1.3 damage, but only if the previous strike landed on that target.',

  'and.desc': 'Conjunction. 2 mana. Fuses the next clause into the previous blow: its weight is added at 85%, the blow deals whichever of the two damage types the target resists less, and both conditions apply.',

  'but.desc': 'Conjunction. 2 mana. The next clause does not strike; its condition replaces the previous blow’s condition. A word with no condition removes the blow’s condition instead.',

  'or.desc': 'Conjunction. 1 mana. The linked clauses become alternatives: one is rolled per cast, and each linked clause pays half its mana.',

  'if.desc': 'Conjunction. 1 mana. The next clause does not strike; its noun names a condition, and the previous blow fires only while the target has that condition or one it escalates into.',

  'one.desc': 'Target word: the front enemy. 0 mana. The default when no target is spoken.',

  'others.desc': 'Target word: every enemy. 2 mana, and the spell’s mana x1.5. Each enemy takes 50% power.',

  'me.desc': 'Target word: the speaker. 0 mana. Damage and conditions land on you.',
};

// ---------- MIRACLES ----------
export const MIRACLES_TEXT: ProseTable = {
  'unfold_geometry.desc': 'Ik’Thel’the. 4 favor, 5 mana, 16 second cooldown. One 0.4 arcane strike that inflicts Unfolded for 15 seconds: -12% slashing, piercing and bludgeoning resistance, -15% arcane resistance.',
  'unfold_geometry.spec.desc': '0.4 arcane strike; inflicts Unfolded, lowering physical and arcane resistance for 15 seconds.',

  'fractal_lance.desc': 'Ik’Thel’the. 5 favor, 6 mana, 13 second cooldown. Three arcane strikes on one target at 1.4, 0.7 and 0.35 power.',
  'fractal_lance.spec.desc': 'Three arcane strikes, each half the power of the one before.',

  'fold_space.desc': 'Ik’Thel’the. 4 favor, 4 mana, 45 second cooldown. Self: +12% dodge for 40 seconds. No healing.',

  'litany_mending.desc': 'Xima. 3 favor, 4 mana, 15 second cooldown. Self: heals for 2.0 spell power.',
  'litany_mending.spec.desc': 'Heals the caster for 2.0 spell power.',

  'litany_aegis.desc': 'Xima. 8 favor, 6 mana, 40 second cooldown. Self: +6 armor and +10% dark resistance for 30 seconds.',
  'litany_aegis.spec.desc': '+6 armor and +10% dark resistance on the caster for 30 seconds.',

  'rime_of_the_cold_sun.desc': 'Xima. 6 favor, 6 mana, 60 second cooldown. Self: +12% heat, cold and lightning resistance for 60 seconds.',

  'blood_communion.desc': 'Xima. 8 favor, 5 mana, 70 second cooldown. Self: applies Bleeding at intensity 2, plus Blood Communion for 60 seconds, under which bleed damage heals you instead and you deal +8% damage.',
  'blood_communion.spec.desc': 'You bleed; while Blood Communion holds, the bleed heals you instead of harming you.',

  'litany_retribution.desc': 'D’Enjalle. 5 favor, 5 mana, 12 second cooldown. One 2.2 light strike with a 40% chance to Dazzle.',
  'litany_retribution.spec.desc': '2.2 light strike, 40% chance to Dazzle.',

  'holy_fire.desc': 'D’Enjalle. 6 favor, 6 mana, 14 second cooldown. One 2.0 strike dealt as heat or light, whichever the target resists less; 30% chance to set it On Fire.',
  'holy_fire.spec.desc': '2.0 strike as heat or light, whichever the target resists less.',

  'honorable_duel.desc': 'D’Enjalle. 7 favor, 5 mana, 50 second cooldown. Self: Honor Bound for 20 seconds: flanking enemies do not attack, and you deal +10% damage.',

  'perfect_lunge.desc': 'D’Enjalle. 5 favor, 5 mana, 35 second cooldown. Self for 30 seconds: +8% crit chance, +20% crit damage, and +15% damage while a rapier is equipped.',

  'artisans_cunning.desc': 'Usvýlgr. 5 favor, 5 mana, 120 second cooldown. Self for 120 seconds: +15% craft speed and +8% loot.',

  'veil_of_misdirection.desc': 'Usvýlgr. 6 favor, 5 mana, 40 second cooldown. Self: Veiled for 30 seconds: incoming attacks have a 12% chance to miss.',

  'venom_feast.desc': 'Kenese Paea. 6 favor, 5 mana, 15 second cooldown. One 0.5 poison strike with a 40% chance to Poison. Removes Poisoned and Rotting from you and applies them to the target at 1.2x intensity. Deals 1.5x if anyone in the fight is Poisoned or Rotting.',
  'venom_feast.spec.desc': 'Moves your Poisoned and Rotting onto the target at 1.2x intensity; 1.5x damage if anyone is Poisoned or Rotting.',

  'redouble_venom.desc': 'Kenese Paea. 8 favor, 4 mana, 15 stamina, 20 second cooldown. One 0.4 dark strike; doubles the intensity of the target’s Poisoned and Rotting and refreshes their duration.',
  'redouble_venom.spec.desc': 'Doubles and refreshes the target’s Poisoned and Rotting.',

  'night_shroud.desc': 'Kenese Paea. 5 favor, 5 mana, 45 second cooldown. Self: Night Shroud for 30 seconds: incoming attacks have a 12% chance to miss.',

  'sproutbringer.desc': '',
  'sproutbringer.spec.desc': '',

  'tuigamalas_mighty_stick.desc': '',
  'tuigamalas_mighty_stick.spec.desc': '',

  'spear_and_fang.desc': '',
  'spear_and_fang.spec.desc': '',

  'atomic_state.desc': '',
  'atomic_state.spec.desc': '',

  'desired_sound.desc': '',
  'desired_sound.spec.desc': '',

  'fourth_fire.desc': '',
  'fourth_fire.spec.desc': '',

  'fourth_twice.desc': '',
  'fourth_twice.spec.desc': '',

  'fourth_crush.desc': '',
  'fourth_crush.spec.desc': '',
};

// ---------- PSI_AXES ----------
export const PSI_AXES_TEXT: ProseTable = {
  'force.desc': 'Raw imposition. Feeds Pressure (force + grip). Bare force lands as bludgeoning damage, 0.7 per curved point.',

  'reach.desc': 'Spread. Feeds Awareness (clairvoyance x reach) and lowers Acuity. Each point splashes 20% of the strike onto flankers; at 4 spread the working hits every enemy. Delivery only: reach with nothing to deliver does nothing.',

  'grip.desc': 'Hold. Feeds Pressure and Purchase (grip / (1 + speed)). 18% daze chance per point, 0.25 damage per curved point, and Purchase sets how long afflictions stay on the target.',

  'speed.desc': 'Cycle rate. Cooldown x0.93 per point. Multiplies mass into Momentum, subtracts from Inertia, and divides Purchase. Delivery only: speed with nothing to deliver does nothing.',

  'clairvoyance.desc': 'Sight. Feeds Acuity (concentrated: piercing, cannot miss, armor penetration) and Awareness (spread: reaches every enemy). Aimed inward, it becomes Foresight: enemy blows miss.',

  'space.desc': 'Structure. Feeds Coherence (space / (force + mass)), which withholds part of the strike, carries acuity as armor penetration, and sets how long every inward effect lasts.',

  'mass.desc': 'Weight. With speed it becomes Momentum (a strike, 0.85 per curved point, and concussion); without speed it becomes Inertia (a standing wall outward, blunt resistance inward).',

  'vitality.desc': 'The aim dial. Sets Inward (vitality / (vitality + pressure)): the share of every quantity applied to you instead of the target. Vitality alone heals, 0.35 per curved point.',
};

// ---------- PSI_QUANTITIES ----------
export const PSI_QUANTITIES_TEXT: ProseTable = {
  'pressure.desc': 'force + grip. Outward: the blow. Inward: Braced, extra armor. Also the denominator of Inward, so more pressure means less of the working goes to you.',

  'momentum.desc': 'mass x speed. Outward: bludgeoning strike power and a 9% concussion chance per point. Inward: Kinetic Haste, faster actions. Its square root also lowers Acuity.',

  'inertia.desc': 'mass minus speed, floored at 0. Outward at 3 or more: Kinetic Bulwark, a wall that stops thrown, shot and spat attacks. Inward at 2 or more: Rooted, blunt resistance and dazes at half strength.',

  'acuity.desc': 'clairvoyance / (reach + square root of momentum). At 2 or more the strike is piercing and cannot miss; each unit through coherent space ignores 9% armor. Outward: Read, lowers the target’s dodge and parry. Inward: Foresight, enemy blows miss. Momentum spoils it, so a shape is a needle or a hammer, not both.',

  'awareness.desc': 'clairvoyance x reach. Outward: spread, so the working splashes and then hits every enemy, afflictions included. Inward: Wide Sight, physical resistances.',

  'coherence.desc': 'space / (force + mass). Withholds up to 40% of the strike and returns half of that as a standing effect. Outward: Compressed, the target loses time. Inward: sets duration of every inward effect, 20 seconds bare, over 3 minutes fully structured.',

  'purchase.desc': 'grip / (1 + speed). Sets how long afflictions stay on the target: 10 seconds at 0, about 50 seconds at full grip with no speed. Nothing is gated on it; everything still lands.',

  'inward.desc': 'vitality / (vitality + pressure). The share of every quantity applied to you rather than the target; the rest goes outward. Momentum outward is a strike, inward is action speed. Nothing is discarded.',
};

// ---------- PSI_RECOGNITIONS ----------
export const PSI_RECOGNITIONS_TEXT: ProseTable = {
  'unerring_needle.desc': 'Acuity 2 or more, Pressure 4 or more, Coherence 0.4 or more, Momentum 0, Inward at most 0.5. A piercing strike that cannot miss. Recognition bonus x1.12.',

  'kinetic_bulwark.desc': 'Inertia 3 or more, Coherence 0.4 or more, Inward at most 0.4. A standing wall that stops thrown, shot and spat attacks; light passes through. Recognition bonus x1.12.',

  'still_mind.desc': 'Inward 0.9 or more, Vitality 3 or more, with Momentum, Inertia, Acuity and Awareness at 0 and Coherence at most 0.5. Pure healing: the whole working goes to mending you. Recognition bonus x1.12.',

  'kinetic_rush.desc': 'Momentum 36 or more, Inward 0.8 or more. The momentum is worn instead of thrown: Kinetic Haste, faster actions for as long as coherence sustains it. Recognition bonus x1.12.',

  'immovable.desc': 'Inertia 5 or more, Inward 0.8 or more. Rooted: blunt resistance, and dazes land at half strength. Recognition bonus x1.12.',

  'second_sight.desc': 'Acuity 3 or more, Inward 0.8 or more. Foresight: enemy blows miss outright. Recognition bonus x1.12.',

  'psionic_obliteration.desc': 'Pressure 10 or more, Momentum 48 or more, Inward at most 0.25. Maximum outward strike: pressure and momentum thrown together with almost nothing kept for you. Recognition bonus x1.12.',
};
