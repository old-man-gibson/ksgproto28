import type { ProseTable } from './prose';

// Player-facing text for src/core/data/deities.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- DEITIES ----------
export const DEITIES_TEXT: ProseTable = {
  'ikthelthe.desc': 'Aspects: aberrant, zero, curious, warping, outer. Miracles are geometric and spatial: they damage by breaking enemy geometry and defend by altering space, and none of them heal. No synergies or hostilities with any other deity.',

  'denjalle.desc': 'Aspects: humanoid, honorable, fire, organized. Miracles deal fire damage, retaliate against attackers, improve accuracy and strengthen single combat, with extra effect for a rapier and parrying dagger. Shares a page with organized or honorable deities, and with humanoid ones unless they are evil or trickster (honorable waives that).',

  'usvylgr.desc': 'Aspects: gigantoid, earth, crafting, trickster, organized. Miracles raise crafting results at the bench and make enemies miss in combat. Shares a page with crafting or earth deities; refuses tricksters who are neither.',

  'xima.desc': 'Aspects: bestial, cold, honorable, sacrificial, tribal, Yolixoch pantheon. Miracles have long durations and long cooldowns: mending, elemental shielding, cold damage, and effects that turn the caster\'s own bleeding into a benefit. Shares a page with bestial, tribal or Yolixoch deities unless they are fire or poison.',

  'cuixtli.desc': 'A paired deity. Aspects: bestial, honorable, tribal, humanoid, lightning, wind, Yolixoch pantheon. Miracles strengthen spears, grant periodic bonus attacks, and improve hunting against newly encountered opponents. Shares a page with bestial, tribal, honorable or Yolixoch deities unless they are poison, evil or aberrant.',

  'kenese_paea.desc': 'Aspects: humanoid, poison, dark, sacrificial, tribal, Foai pantheon. Miracles gain power while anyone in the fight is poisoned or rotting: they spend the caster\'s own poison to envenom enemies, intensify a venom already applied, and shroud the caster so attacks miss. Shares a page with bestial, evil, poison or sacrificial deities; refuses honorable and light ones.',

  'tuigamala.desc': 'Aspects: humanoid, tribal, nature, honorable, unaligned, Foai pantheon. Miracles strengthen wooden weapons and grow plants. Shares a page with honorable, nature or Foai deities; refuses evil, poison and fire ones.',

  'yshicna.desc': 'Aspects: aberrant, atomic, arcane, curious, warping, outer. Miracles act on arcane words: one returns a word\'s Meaning to its basic state, another raises the Sound of a word the caster has uttered many times. No synergies or hostilities with any other deity.',

  'goblin_fire.desc': 'Placeholder. Aspects: tribal, humanoid, fire, chaotic, Goblin pantheon. Miracles set enemies on fire. Shares a page with the Goblin pantheon; refuses water and cold deities outside it.',

  'goblin_mud.desc': 'Placeholder. Aspects: tribal, humanoid, earth, water, Goblin pantheon. Miracles heal the caster\'s allies and bog enemies down. Shares a page with the Goblin pantheon and earth deities.',

  'goblin_hunt.desc': 'Placeholder. Aspects: tribal, bestial, nature, Goblin pantheon. The hunt of rats, birds and worms: miracles send vermin at enemies and sharpen the caster\'s allies. Shares a page with the Goblin pantheon and bestial deities; refuses the honorable.',
};
