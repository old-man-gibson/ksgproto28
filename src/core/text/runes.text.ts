import type { ProseTable } from './prose';

// Player-facing text for src/core/data/runes.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- RUNES ----------
export const RUNES_TEXT: ProseTable = {
  'minor_rune_might.desc': 'A rough-cut stone humming with strength.',

  'greater_rune_might.desc': 'Cut by a master hand; it pulls at nearby iron.',

  'minor_rune_vitality.desc': 'Warm to the touch, like a heartbeat.',

  'greater_rune_vitality.desc': 'Moss grows on whatever pouch you keep it in.',

  'gale_rune.desc': 'Wind lives in the stone. Footwork it touches barely touches the ground.',

  'earthbind_rune.desc': 'The stone remembers standing still. Motion it touches ends rooted, not reaching.',

  'umbral_rune.desc': 'A sliver of dark that widens what a blade believes it may become.',

  'minor_rune_thunder.desc': 'Your hair stands up when you hold it.',

  'greater_rune_thunder.desc': 'It rumbles faintly before storms.',

  'minor_rune_frost.desc': 'It never warms, no matter the season.',

  'rune_swiftness.desc': 'Light as a held breath.',
};

// ---------- RUNE_PATTERNS ----------
export const RUNE_PATTERNS_TEXT: ProseTable = {
  'pattern_might.desc': 'Three strokes and a heavy downstroke. The first thing any carver learns.',

  'pattern_warding.desc': 'A closed figure. Nothing gets in that the carver did not let in.',

  'pattern_swiftness.desc': 'An open spiral, cut in one motion or not at all.',

  'pattern_edge.desc': 'Hairline work. Rewards a steady hand and punishes everything else.',
};

// ---------- NAMED_RUNES ----------
export const NAMED_RUNES_TEXT: ProseTable = {
  'stormbrand.desc': 'Sapphire drinks the charge and gives it back all at once. A duellist’s rune.',

  'hearthward.desc': 'Warm gel worked into a closed ward. Cheap, ugly, and it has saved lives.',

  'winters_edge.desc': 'Cut cold, inlaid colder. The garnet is there to stop the stone splitting.',

  'twiceforged.desc': 'Might over warding, cut in one sitting. Carvers argue about whether it should work.',
};
