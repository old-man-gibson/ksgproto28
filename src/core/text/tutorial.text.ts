import type { ProseTable } from './prose';

// Player-facing text for src/core/data/tutorial.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.
//
// Every number quoted below is a number in a data file: road times are the
// floor's connection ticks (10 ticks = 1 s), the slime's 1 damage is
// `fixedDamage`, the spell's 2 mana is the word's `mana`. Retune both.

// ---------- TUTORIAL_STEPS ----------
// One or two sentences each, about the game: the screen points at the
// control (ui/lib/tutorialFocus.ts), so the words do not have to say where
// it is or explain the panel itself.
export const TUTORIAL_TEXT: ProseTable = {
  'arm.desc':
    'Take a weapon from the rack; it is equipped at once. Sword, dagger and hammer leave the off hand free for the shield; the spear needs both hands.',

  'stance.desc':
    'A stance adds modifiers to your fighting while it is held; hover one to read them. Neutral has none.',

  'cellblock.desc':
    'Travel is done on the map. Click the marked ❓ pin in the corridor; the road takes 2 s.',

  'fight.desc':
    'Start ⚔️ Fight the Cell Slime. You swing each time your action bar fills; the slime hits for exactly 1.',

  'field.desc':
    'Kills pay XP and roll the monster’s loot; items and materials go to the Equipment tab. Click the marked ❓ pin in the yard (3 s).',

  'spell.desc':
    'Pick a one-word arcane spell; it costs 2 mana. Taking it raises Intelligence to 2, and mana is 1 per point of Intelligence.',

  'cast.desc':
    'Start ⚔️ Fight in the Field and win once. A prepared spell casts itself on a swing when you have the mana.',

  'gate.desc':
    'Click the marked ❓ pin on the gate (3 s). Past the Gate is Threshold, the city at the Foot of the Ascent.',

  'leave.desc':
    'Click → Threshold beside the Gate (3 s); the road is one-way and floor 0 closes behind you. The Warden of the Foot gives the next step, the floor 1 quest The First Ascent.',
};
