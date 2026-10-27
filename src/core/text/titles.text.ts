import type { ProseTable } from './prose';

// Player-facing text for src/core/data/titles.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- TITLES ----------
export const TITLES_TEXT: ProseTable = {
  'friend_of_the_court.desc': 'Read the unclaimed case file found on the Assize night watch. +2% gold gain always; +8% more while worn.',
  'david_and_goslimath.desc': 'Beat the Suspiciously Large Slime the Cages keeper dared you to fight. +3% damage per size step against anything larger than you, always; +15% more per step while worn.',
  'procedural_objection.desc': 'Defeat the Toll Collector without casting a spell during that encounter. The stamp yields to force.',
  'iron_stomach.desc': 'Eat 25 spoiled dishes (refuse-grade food or Scorched Mess). Always: Queasy no longer lands on you.',
  'iconoclast.desc': 'Learn ten miracles. Passive: +5 maximum spirit. Worn: +5% spell power, and miracles of hostile deities may be prepared together.',

  'wanderer.desc': 'Complete 50 journeys between spots. Passive: +5% travel speed. Worn: +10% travel speed and +10% loot.',

  'slayer.desc': 'Kill 100 creatures. Passive: +2% damage. Worn: +5% damage and +2% crit.',

  'titan_incarnate.desc': 'Reach Strength 100. Passive: +10 damage. Worn: +10% damage and +5% maximum health.',

  'first_blade.desc': 'Defeat the Goblin Warchief having attacked with only one weapon family. Passive: +3% damage. Worn: +8% damage and +5% speed.',

  'untouchable.desc': 'Defeat the Goblin Warchief without ever having been knocked out. Passive: +2% dodge. Worn: +3% dodge and a 3% shorter action bar.',
};
