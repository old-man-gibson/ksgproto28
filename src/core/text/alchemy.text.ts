import type { ProseTable } from './prose';

// Player-facing text for src/core/data/alchemy.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- REAGENTS ----------
export const REAGENTS_TEXT: ProseTable = {
  'spring_water.desc': 'Raises a brew you can drink. Holds a great deal and asks for nothing.',

  'pressed_oil.desc': 'Raises a brew for the skin rather than the throat — it works where it is put.',

  'grain_spirit.desc': 'Raises a brew that wants out of the bottle. Holds little, and holds it badly.',

  'emberbloom.desc': 'Holds the heat of the day it was picked. Nothing good comes of drinking it.',

  'frostmoss.desc': 'Cold to the touch hours after it leaves the shade.',

  'nightcap.desc': 'Every part of it is poison. That is the useful bit.',

  'gloomcap.desc': 'Grown in the dark, and it takes some of the dark with it.',

  'mendroot.desc': 'The root everyone knows. Closes what it is put on and settles what it is drunk for.',

  'bloodwort.desc': 'Drives the blood. Steadies nothing.',

  'thunderbloom.desc': 'Picked in storm season, and it never quite stopped.',

  'quicksilver.desc': 'Will not sit still, and will not let anything else sit still either.',

  'fixing_salt.desc': 'Settles a brew — and the harder it was running when you settle it, the longer what is left will last.',

  'brimstone.desc': 'Takes hold in a brew already running hot. In a calm one it is only grit.',

  'bone_ash.desc': 'Takes the weakest thing in the pot out of the pot. What is left reads louder.',

  'green_vitriol.desc': 'Eats into whatever it is added to — and into whatever the brew is thrown at.',
};

// ---------- BREW_FORMS ----------
export const BREW_FORMS_TEXT: ProseTable = {
  'elixir.desc': 'Settled in water. Works on you, and keeps working for a while.',

  'draught.desc': 'Water that will not keep still. Everything it has, the moment it goes down.',

  'salve.desc': 'Settled oil, worked into skin. The form that clears what ails you.',

  'oil.desc': 'Oil that never settled. It goes on the blade instead of the wound, and every blow carries it until the edge wipes clean.',

  'bomb.desc': 'Spirit raised past holding. It goes off on whatever it meets.',

  'fume.desc': 'Spirit that never caught. It does not break so much as spread.',

  'residue.desc': 'Nothing raised it, so nothing came of it. Worth what the jar is worth.',
};

// ---------- BREW_FORMULAS ----------
export const BREW_FORMULAS_TEXT: ProseTable = {
  'smoulder_flask.desc': 'Spirit, roused, fed to a bloom, and lit. The first thing every alchemist blows up.',

  'thief_draught.desc': 'Gloom taken last, so none of it dissolves — all character, no strength.',

  'field_salve.desc': 'What a company medic carries. Root steeped first, then bound in oil.',

  'chokedamp.desc': 'Never allowed to catch. It arrives as weather rather than as an explosion.',
};
