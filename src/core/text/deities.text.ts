import type { ProseTable } from './prose';

// Player-facing text for src/core/data/deities.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- DEITIES ----------
export const DEITIES_TEXT: ProseTable = {
  'ikthelthe.desc': 'Aspects: aberrant, zero, curious, warping, outer. Miracles: arcane strikes, a debuff that lowers physical and arcane resistance (Unfold Geometry), and a dodge buff (Fold Space). None of them heal. No synergies or hostilities with any other deity.',

  'denjalle.desc': 'Aspects: humanoid, honorable, fire, organized. Miracles: Writ of Retribution (light strike), Holy Fire (heat or light strike), Honorable Duel (flanking enemies do not attack, +10% damage) and Perfect Lunge (+8% crit chance, +20% crit damage, +15% damage with a rapier). Synergy (+25% damage and healing on a miracle cast within 10 seconds after theirs or the same deity’s) with organized or honorable deities, and with humanoid ones unless they are evil or trickster (honorable waives that).',

  'usvylgr.desc': 'Aspects: gigantoid, earth, crafting, trickster, organized. Miracles: Artisan\'s Cunning (+15% craft speed and +8% loot for 120 seconds) and Veil of Misdirection (12% of incoming attacks miss for 30 seconds). Synergy (+25% damage and healing on a miracle cast within 10 seconds after theirs or the same deity’s) with crafting or earth deities. Hostile to trickster deities that are neither crafting nor earth: the two cannot be prepared together.',

  'xima.desc': 'Aspects: bestial, cold, honorable, sacrificial, tribal, Yolixoch pantheon. Self-targeted miracles with 15 to 70 second cooldowns: Rite of Mending (heal), Rite of the Aegis (+6 armor, +10% dark resistance), Rime of the Cold Sun (+12% heat, cold and lightning resistance) and Blood Communion (your bleeding heals you instead of harming you, +8% damage). Synergy (+25% damage and healing on a miracle cast within 10 seconds after theirs or the same deity’s) with bestial, tribal or Yolixoch deities unless they are fire or poison.',

  'cuixtli.desc': 'A paired deity. Aspects: bestial, honorable, tribal, humanoid, lightning, wind, Yolixoch pantheon. Miracles strengthen spears, grant periodic bonus attacks, and improve hunting against newly encountered opponents. Synergy (+25% damage and healing on a miracle cast within 10 seconds after theirs or the same deity’s) with bestial, tribal, honorable or Yolixoch deities unless they are poison, evil or aberrant.',

  'kenese_paea.desc': 'Aspects: humanoid, poison, dark, sacrificial, tribal, Foai pantheon. Miracles: Venom Feast (moves your Poisoned and Rotting onto the target at 1.2x intensity; 1.5x damage while anyone is Poisoned or Rotting), Redouble Venom (doubles the target\'s Poisoned and Rotting) and Night Shroud (12% of incoming attacks miss for 30 seconds). Synergy (+25% damage and healing on a miracle cast within 10 seconds after theirs or the same deity’s) with bestial, evil, poison or sacrificial deities. Hostile to honorable and light deities: the two cannot be prepared together.',

  'tuigamala.desc': 'Aspects: humanoid, tribal, nature, honorable, unaligned, Foai pantheon. Miracles strengthen wooden weapons and grow plants. Synergy (+25% damage and healing on a miracle cast within 10 seconds after theirs or the same deity’s) with honorable, nature or Foai deities. Hostile to evil, poison and fire deities: the two cannot be prepared together.',

  'yshicna.desc': 'Aspects: aberrant, atomic, arcane, curious, warping, outer. Miracles act on arcane words: one returns a word\'s Meaning to its basic state, another raises the Sound of a word the caster has uttered many times. No synergies or hostilities with any other deity.',

  'goblin_fire.desc': 'Aspects: tribal, humanoid, fire, chaotic, Goblin pantheon. Miracles set enemies on fire. Synergy (+25% damage and healing on a miracle cast within 10 seconds after theirs or the same deity’s) with the Goblin pantheon. Hostile to water and cold deities outside it: the two cannot be prepared together.',

  'goblin_mud.desc': 'Aspects: tribal, humanoid, earth, water, Goblin pantheon. Miracles heal the caster\'s allies (Mud Poultice) and inflict Unfooted and Wet on an enemy (Sucking Mire). Synergy (+25% damage and healing on a miracle cast within 10 seconds after theirs or the same deity’s) with the Goblin pantheon and earth deities.',

  'goblin_hunt.desc': 'Aspects: tribal, bestial, nature, Goblin pantheon. Miracles: Vermin Swarm (three 0.4 piercing strikes, 25% chance of Punctured each) and Pack Scent (Steady Hand on the caster\'s allies: +3% crit chance, +2% parry). Synergy (+25% damage and healing on a miracle cast within 10 seconds after theirs or the same deity’s) with the Goblin pantheon and bestial deities. Hostile to honorable deities: the two cannot be prepared together.',
};
