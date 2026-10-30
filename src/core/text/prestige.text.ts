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

  'foresight.desc': 'Locked skills and upcoming milestones are shown with their requirements at any progress. Without it they appear only at 90% of the requirement.',

  'wayfinding.desc': 'Go buttons outside town: quest givers and objectives anywhere on the map, and skills link to a spot that trains them (that activity starts on arrival). Town places have Go buttons on the Quests tab without it.',

  'head_start.desc': 'Every run starts 1 character level higher, per rank: +1 to every attribute per level. Never lowers a level already reached.',

  'city_key.desc': 'Opens band 3, the city (floors 7 to 10), on this run and every later one. Floors 1 to 6 must still be cleared first, or passed.',

  'pass_lower.desc': 'Floors 1 to 3 count as cleared on this run and every later one, so the climb starts at floor 4. Passed floors pay no clear XP and no harvest points.',

  'pass_wilds.desc': 'Floors 4 to 6 count as cleared on this run and every later one. Passed floors pay no clear XP and no harvest points. The warchief still waits on floor 6, and prestige opens only when it is killed.',
};
