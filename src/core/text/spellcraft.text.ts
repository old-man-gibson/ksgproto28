import type { ProseTable } from './prose';

// Player-facing text for src/core/data/spellcraft.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- ARCANE_WORDS ----------
export const ARCANE_WORDS_TEXT: ProseTable = {
  'fire.desc': 'The first word most mages learn, and the last thing many say.',

  'ice.desc': 'Cold given a shape. It bites, and what it bites, it slows.',

  'spark.desc': 'A held breath of lightning. Quick to speak, quicker to land.',

  'water.desc': 'Gentle as words go. What it soaks, other words find easier to freeze.',

  'stone.desc': 'A heavy word. What it hits, it leaves full of splinters.',

  'gust.desc': 'A light word. can reach far and quickly. What it hits keeps losing its footing.',

  'seed.desc': 'A patient word. It does almost nothing, and then it does not stop.',

  'iron.desc': 'A point, spoken. It goes in, and the hole it leaves stays open.',

  'venom.desc': 'Weak on arrival. It does its arguing afterwards.',

  'acid.desc': 'Every hit slowly strips away what makes hard targets so intimidating.',

  'light.desc': 'Spoken plainly it illuminates. Spoken sharply it blinds.',

  'gloom.desc': 'The dark that saps will, prolonged exposure corrupts.',

  'zero.desc': 'The word for nothing, sharpened. It is not fire and not iron and not anything — so nothing resists it, and nothing suffers it especially. The raw number lands.',

  'arcane.desc': 'The stuff magic is made of, spoken at somebody. It frays whatever in them touches mana — and what frays far enough begins to burn.',

  'cut.desc': 'An edge. Whatever it carries, it carries INTO them — what it opens keeps working after the word has ended.',

  'crush.desc': 'Weight, brought down. The heaviest blow the grammar has — and the substance is mostly wasted in the impact.',

  'pierce.desc': 'Narrows the working to a point. Armor and wards mean less to it — and so does whatever it was carrying.',

  'fly.desc': 'Sends the working out fast and often. Haste costs a little weight.',

  'expand.desc': 'Tells the working to be bigger than its target. The spill is the point.',

  'burst.desc': 'Detonate the word for greater power at the cost of a long wind-down.',

  'grasp.desc': 'The working holds rather than harms. What the noun does lingers doubled.',

  'ward.desc': 'Turns the substance into a coat worn against its own element. Always lands on the speaker.',

  'mend.desc': 'Asks the substance to close a wound instead of opening one. Always lands on the speaker.',

  'slowly.desc': 'Every syllable given its full weight. Heavier, and much less often.',

  'quickly.desc': 'Clipped short. Lighter, and much more often.',

  'gently.desc': 'Spoken with the edge taken off. The substance still takes hold exactly as deeply — it simply arrives without the force behind it. The word for putting something ON someone (yourself included) rather than doing something TO them.',

  'viciously.desc': 'Spoken looking for the seam. Every syllable hunts the vital spot, and the working demands a great deal more to be said that way.',

  'intensely.desc': 'Spoken with everything behind the substance rather than the blow. Whatever it leaves in them bites far deeper — and spoken LAST it is concentrated rather than merely strong, burning hotter for less long.',

  'dimly.desc': 'Spoken with the substance held back. What it leaves barely takes — but it is never nothing, and spoken LAST it is diluted rather than merely weak, lingering far longer for how little it is.',

  'twice.desc': 'Said again before the echo of the first has finished landing.',

  'then.desc': 'Sequence, spoken. The clause that follows strikes through the opening the one before it made — and strikes harder if that opening was actually made.',

  'and.desc': 'Simultaneity, spoken. Two clauses fuse into one blow with two natures — it lands as whichever the target guards worse, and carries both riders.',

  'but.desc': 'Contradiction, spoken. The clause that follows does not strike — it transmutes, its riders replacing those of the blow before it. Spoken with a riderless word, it strips the blow clean instead.',

  'or.desc': 'Chance, spoken. The linked clauses become alternatives — one is rolled each cast, and each pays only half its mana. Thrift, at the price of knowing.',

  'if.desc': 'Condition, spoken. The clause that follows does not strike — its noun names an affliction, and the blow before it fires only while the target bears it.',

  'one.desc': 'The single foe before you. The default address of every spell.',

  'others.desc': 'Everyone on the wrong side of the argument. Spreading a word thins it.',

  'me.desc': 'The speaker. The grammar does not care whether that was wise.',
};

// ---------- MIRACLES ----------
export const MIRACLES_TEXT: ProseTable = {
  'unfold_geometry.desc': 'The target is briefly persuaded it has one face fewer than it needs.',
  'unfold_geometry.spec.desc': 'Breaks the target’s shape; what remains defends poorly.',

  'fractal_lance.desc': 'One thrust, containing two smaller thrusts, containing…',
  'fractal_lance.spec.desc': 'Strikes at every scale at once, each half the last.',

  'fold_space.desc': 'Defensive without being restorative: where you were is not where you are.',

  'litany_mending.desc': 'The oldest prayer there is: please, not yet.',
  'litany_mending.spec.desc': 'Closes wounds by asking nicely, firmly.',

  'litany_aegis.desc': 'A borrowed shield, on the understanding that it is returned dented.',
  'litany_aegis.spec.desc': 'The Cold Sun stands a little in front of you for a while.',

  'rime_of_the_cold_sun.desc': 'Slow to speak and slower to fade — a shield against the elements themselves.',

  'blood_communion.desc': 'Open your own veins; what spills is channelled back as his protection.',
  'blood_communion.spec.desc': 'You bleed, and the bleeding feeds you.',

  'litany_retribution.desc': 'A grievance, formally filed. The light does the rest.',
  'litany_retribution.spec.desc': 'Judgement, delivered as light.',

  'holy_fire.desc': 'Fire that is also light: it burns along whichever the target guards worse.',
  'holy_fire.spec.desc': 'Lands as fire or as light — whichever finds the gap.',

  'honorable_duel.desc': 'The terms are declared, and the terms are enforced: one against one.',

  'perfect_lunge.desc': 'Strike true. Struck with a rapier in hand, strike truer.',

  'artisans_cunning.desc': 'Worn to the bench: surer hands, finer results, and a knack for finding the good stock.',

  'veil_of_misdirection.desc': 'The enemy is not prevented from striking you. They are prevented from finding you.',

  'venom_feast.desc': 'Swallow your own poison whole and spit it, sharpened, at somebody who earned it.',
  'venom_feast.spec.desc': 'Strips your own poison and rot and delivers it, with interest.',

  'redouble_venom.desc': 'A venom already at work is asked to work twice as hard — paid for in her adherent’s breath.',
  'redouble_venom.spec.desc': 'Doubles and refreshes the target’s poison and rot.',

  'night_shroud.desc': 'Walk shrouded; let their blows find only dark.',

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
  'force.desc': 'How hard the will lands. Bludgeoning, from nowhere.',

  'reach.desc': 'How widely it lands. Enough reach touches everyone at once.',

  'grip.desc': 'How firmly it holds a mind. Dazes.',

  'speed.desc': 'How quickly the visualisation completes. Shortens the working’s cycle.',

  'clairvoyance.desc': 'Seeing where things WILL be. Precognition now; telepathy in time.',

  'space.desc': 'Where the working exists. Structure for other axes to key on.',

  'mass.desc': 'How much the working weighs. Walls are made of this.',

  'vitality.desc': 'The will turned inward: the body asked, firmly, to be whole.',
};

// ---------- PSI_QUANTITIES ----------
export const PSI_QUANTITIES_TEXT: ProseTable = {
  'pressure.desc': 'How much is being imposed at all. What the blow is made of, and what a will turned inward has to overcome.',

  'momentum.desc': 'Mass in motion. Weight that is going somewhere hits like a hammer and rattles what it hits.',

  'inertia.desc': 'Mass that is going nowhere. Held still it is a wall; every point of speed takes some of the wall away.',

  'acuity.desc': 'Sight per unit of what it must cover — ground, and motion. Concentrated, it punctures and cannot miss. A shape is a needle or a hammer; it cannot be both.',

  'awareness.desc': 'Sight spanning the field. Seeing where everyone is carries the working to them.',

  'coherence.desc': 'Structure against what wants to burst out of it. A coherent shape keeps some of itself back and leaves something standing.',

  'purchase.desc': 'How well the working holds what it caught. A grab made at speed does not hold: everything still lands, but with no purchase nothing stays. Zero grip is slippery, not empty.',

  'inward.desc': 'Which way the whole working faces. Every quantity above has an outward face and an inward one — momentum thrown is a hammer, momentum worn is speed — and this is the share going each way. Nothing is ever discarded; it is only aimed.',
};

// ---------- PSI_RECOGNITIONS ----------
export const PSI_RECOGNITIONS_TEXT: ProseTable = {
  'unerring_needle.desc': 'Sight narrowed past the point where a target can be anywhere else, and enough will behind it to arrive. Nothing in motion — a hammer is a different thought.',

  'kinetic_bulwark.desc': 'Mass that is going nowhere, held across structured space: a standing wall that stops anything thrown, shot or spat — light passes through, being in no hurry to be matter.',

  'still_mind.desc': 'Everything turned inward and nothing turned out — and nothing carried in with it. The body is asked to mend, and does.',

  'kinetic_rush.desc': 'Mass and motion, and the mass is you. Nothing is thrown, nothing is struck — you are simply somewhere else, sooner, for as long as you can hold the thought.',

  'immovable.desc': 'Weight set inward and told to stay. What tries to move you — a blow, a shove, a mind — finds nothing anywhere in you that consents to be moved.',

  'second_sight.desc': 'Sight narrowed to a point and turned around: not where they are, but where their blow means to be, half a second before they have decided it.',

  'psionic_obliteration.desc': 'Every term of the shape at once — the whole imposition thrown, at weight, at speed. There is no technique left in it. There is no need for any.',
};
