import type { ProseTable } from './prose';

// Player-facing text for src/core/data/tutorial.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.
//
// Every number quoted below is a number in a data file: road times are the
// floor's connection ticks (10 ticks = 1 s), the slime's 1 damage is
// `fixedDamage`, the spell's 2 mana is the word's `mana`. Retune both.

// ---------- TUTORIAL_STEPS ----------
export const TUTORIAL_TEXT: ProseTable = {
  'arm.desc':
    'You start on floor 0 of the tower, in a holding cell. This panel is the tutorial; it runs until you walk out through the Gate. Skip tutorial ends it now: you are put at the Foot of the Ascent with a rusty sword in your pack. Pick one weapon from the rack below. It is equipped at once and can be swapped later on the Equipment tab. Sword, dagger and hammer are one-handed and can take a shield in the off hand; the spear needs both hands; unarmed holds nothing.',

  'stance.desc':
    'A stance is a set of modifiers that applies while you fight; the Combat tab lists them and lets you change stance at any time, in or out of a fight. Neutral has no modifiers. Every stance also has an exertion: stamina spent per exchange for a bonus, switched on with the Exerting button on the Combat tab. Spending stops at the 20% stamina reserve and resumes when the bar is full. Pick one to continue.',

  'cellblock.desc':
    'The map on the Location tab is the only travel control. Click The Cellblock on it: a place you have not been to shows as ❓ ??? until you arrive, so it is the ❓ pin joined to the cell. A road costs the seconds shown on it (2 s here); arrival is written to the log.',

  'fight.desc':
    'Select Fight the Cell Slime under Activities. A fight starts and runs on its own: your action bar fills at your attack speed and each fill is one swing. The Combat tab shows both sides, your stance and the Exerting button. The Cell Slime deals exactly 1 damage per hit and has enough HP to take several of yours. HP, stamina and mana are the bars on the left. HP recovers over time and faster at a haven; the cell is one (Sleep on the Straw).',

  'field.desc':
    'The slime paid XP, gold and a bestiary entry (Bestiary tab); anything it dropped is on the Equipment tab. Click The Field on the map: the ❓ pin joined to the Cellblock (3 s).',

  'spell.desc':
    'Arcane spells are sentences of words, written at a Spell Table; the smallest sentence is one word. Pick one below. It goes into your grimoire as a prepared spell, and reading it trains Intelligence to 2. Mana is 1 per point of Intelligence and the spell costs 2, so it becomes castable at once. Prepared spells cast on their own in fights whenever the mana is there; the Combat tab lists what is prepared, and the grimoire is on the Location tab at any Spell Table.',

  'cast.desc':
    'Select Fight in the Field. Your prepared spell fires on one of your swings when you have the mana, and the Fight Feed on the Combat tab names it. Mana refills over time; Intelligence and Wisdom raise the rate. Win one fight here to continue. Study the Gate Plaque trains Intelligence if you want a bigger pool first.',

  'gate.desc':
    'Click The Gate on the map: the ❓ pin joined to the Field (3 s). Beyond it is Threshold, the city at the Foot of the Ascent.',

  'leave.desc':
    'Click → Threshold beside the Gate on the map (3 s). The road is one-way: floor 0 closes behind you. At the Foot, Rest at the Doorstep Inn is the city haven, the Warden of the Foot gives the first quests (People section, then the Quests tab), and the ladder panel lists the tower floors with what opens each. Recommended next: floor 1, the Warden’s quest The First Ascent. The city is optional before it: all of it is on the map, 1 s per road. These panels stay readable on the Quests tab under Guide.',
};
