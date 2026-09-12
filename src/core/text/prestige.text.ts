import type { ProseTable } from './prose';

// Player-facing text for src/core/data/prestige.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- PRESTIGE_BOONS ----------
export const PRESTIGE_BOONS_TEXT: ProseTable = {
  'talent.desc': 'Every skill’s effects grow by 0.01% × rank × the skill’s highest level at any past prestige × prestiges performed.',

  'endowment.desc': 'Every attribute grows by 0.01% × rank × its highest trained level at any past prestige × prestiges performed.',

  'provisions.desc': '+50 gold at the start of every run, per rank.',

  'grimoire_page.desc': '+1 prepared spell, per rank.',

  'chronosense_ceiling.desc': 'Chronosense can reach 5 levels higher, per rank.',

  'weathersense_ceiling.desc': 'Weathersense can reach 5 levels higher, per rank.',

  'darkvision_ceiling.desc': 'Darkvision can reach 10 levels higher, per rank.',
};
