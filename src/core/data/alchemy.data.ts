import type { BrewForm, BrewFormulaDef, ReagentDef } from '../types';

const SECOND = 10;

/**
 * Alchemy content: what each reagent IS to the alembic.
 *
 * A reagent is an ordinary graded material (see materials.data.ts) carrying the
 * `reagent` craft tag. This registry is the other half — what it does when it
 * goes in, which is deliberately kept out of the material so that a thing can
 * be food, inlay and reagent at once without any of those knowing about each
 * other. The same split PREPS and RUNE_PATTERNS use.
 *
 * Three kinds, and the sequence's whole grammar is which kind is where:
 *
 *  - a MENSTRUUM raises the brew and decides how it will be delivered;
 *  - an ESSENCE is what the brew is OF — and see systems/alchemy.ts for why
 *    adding it early buys strength and adding it late buys character;
 *  - an OPERATOR acts on the brew it finds, so it can only ever work on what
 *    was already added before it.
 */
export const REAGENTS: Record<string, ReagentDef> = {
  // ---------- Menstruums: what the brew is raised in ----------
  //
  // The first solvent in decides the FORM the brew will take, whatever else
  // happens to it afterwards. A second one dilutes: weaker, calmer, and with
  // room for more.

  spring_water: {
    id: 'spring_water',
    name: 'Spring Water',
    icon: '💧',
    desc: 'Raises a brew you can drink. Holds a great deal and asks for nothing.',
    menstruum: { medium: 'water', body: 8 },
  },
  pressed_oil: {
    id: 'pressed_oil',
    name: 'Pressed Oil',
    icon: '🫙',
    desc: 'Raises a brew for the skin rather than the throat — it works where it is put.',
    menstruum: { medium: 'oil', body: 6 },
  },
  grain_spirit: {
    id: 'grain_spirit',
    name: 'Grain Spirit',
    icon: '🍶',
    desc: 'Raises a brew that wants out of the bottle. Holds little, and holds it badly.',
    minLevel: 4,
    menstruum: { medium: 'spirit', body: 5 },
    // Spirits are already halfway to going off — raising a brew in them starts
    // the clock, which is why the throwables live here.
    act: { kind: 'agitate', amount: 0.5 },
  },

  // ---------- Essences: what the brew is of ----------

  emberbloom: {
    id: 'emberbloom',
    name: 'Emberbloom',
    icon: '🌺',
    desc: 'Holds the heat of the day it was picked. Nothing good comes of drinking it.',
    essence: {
      id: 'ember',
      name: 'Ember',
      power: 3.2,
      type: 'heat',
      inflicts: [{ id: 'on_fire', intensity: 1 }],
    },
  },
  frostmoss: {
    id: 'frostmoss',
    name: 'Frostmoss',
    icon: '🧊',
    desc: 'Cold to the touch hours after it leaves the shade.',
    essence: {
      id: 'rime',
      name: 'Rime',
      power: 2.8,
      type: 'cold',
      inflicts: [{ id: 'chilled', intensity: 1 }],
      grants: [{ id: 'ximas_rime', intensity: 1 }],
    },
  },
  nightcap: {
    id: 'nightcap',
    name: 'Nightcap',
    icon: '🍄',
    desc: 'Every part of it is poison. That is the useful bit.',
    minLevel: 3,
    essence: {
      id: 'venom',
      name: 'Venom',
      power: 3.4,
      type: 'poison',
      inflicts: [{ id: 'poison', intensity: 1 }],
    },
  },
  gloomcap: {
    id: 'gloomcap',
    name: 'Gloomcap',
    icon: '🌚',
    desc: 'Grown in the dark, and it takes some of the dark with it.',
    minLevel: 6,
    essence: {
      id: 'gloom',
      name: 'Gloom',
      power: 2.6,
      type: 'dark',
      inflicts: [{ id: 'dazzled', intensity: 1 }],
      // The invisibility line: a brew of it does not stop blows, it stops
      // being found.
      grants: [{ id: 'veiled', intensity: 1 }],
    },
  },
  mendroot: {
    id: 'mendroot',
    name: 'Mendroot',
    icon: '🌱',
    desc: 'The root everyone knows. Closes what it is put on and settles what it is drunk for.',
    essence: {
      id: 'mending',
      name: 'Mending',
      power: 2.6,
      restore: [{ resource: 'hp', per: 3.2 }],
      grants: [{ id: 'well_fed', intensity: 0.5 }],
      cures: ['poison', 'bleed'],
    },
  },
  bloodwort: {
    id: 'bloodwort',
    name: 'Bloodwort',
    icon: '🌡️',
    desc: 'Drives the blood. Steadies nothing.',
    minLevel: 5,
    essence: {
      id: 'vigor',
      name: 'Vigor',
      power: 2.4,
      restore: [{ resource: 'stamina', per: 2.6 }],
      grants: [{ id: 'blood_communion', intensity: 1 }],
    },
  },
  thunderbloom: {
    id: 'thunderbloom',
    name: 'Thunderbloom',
    icon: '⚡',
    desc: 'Picked in storm season, and it never quite stopped.',
    minLevel: 9,
    essence: {
      id: 'storm',
      name: 'Storm',
      power: 3.0,
      type: 'lightning',
      inflicts: [{ id: 'jolted', intensity: 1 }],
      restore: [{ resource: 'mana', per: 1.6 }],
      grants: [{ id: 'clear_headed', intensity: 0.6 }],
    },
  },

  // ---------- Operators: what acts on the brew ----------
  //
  // These are where sequence stops being a rule and starts being a puzzle. All
  // five read the brew AS IT STANDS, so each one has a position it wants and
  // several where it is worth nothing.

  quicksilver: {
    id: 'quicksilver',
    name: 'Quicksilver',
    icon: '🪙',
    desc: 'Will not sit still, and will not let anything else sit still either.',
    minLevel: 2,
    act: { kind: 'agitate', amount: 1.3 },
  },
  fixing_salt: {
    id: 'fixing_salt',
    name: 'Fixing Salt',
    icon: '🧂',
    desc:
      'Settles a brew — and the harder it was running when you settle it, the ' +
      'longer what is left will last.',
    act: { kind: 'fix' },
  },
  brimstone: {
    id: 'brimstone',
    name: 'Brimstone',
    icon: '🟡',
    desc: 'Takes hold in a brew already running hot. In a calm one it is only grit.',
    minLevel: 7,
    act: { kind: 'ignite', needs: 1.2, mult: 1.55 },
  },
  bone_ash: {
    id: 'bone_ash',
    name: 'Bone Ash',
    icon: '🦴',
    desc: 'Takes the weakest thing in the pot out of the pot. What is left reads louder.',
    minLevel: 4,
    act: { kind: 'clarify', mult: 1.5 },
  },
  green_vitriol: {
    id: 'green_vitriol',
    name: 'Green Vitriol',
    icon: '🧪',
    desc: 'Eats into whatever it is added to — and into whatever the brew is thrown at.',
    minLevel: 11,
    act: { kind: 'corrode', penetration: 0.22, mult: 1.25, purity: 0.88 },
  },
};

export const REAGENT_LIST: ReagentDef[] = Object.values(REAGENTS);

export function reagent(id: string): ReagentDef | undefined {
  return REAGENTS[id];
}

// ---------- Forms ----------

/**
 * What each form is called and how it is delivered. `thrown` forms need a
 * fight; the rest are used on yourself, wherever you are standing.
 */
export const BREW_FORMS: Record<
  BrewForm,
  { name: string; icon: string; verb: string; thrown: boolean; sustained: boolean; desc: string }
> = {
  elixir: {
    name: 'Elixir',
    icon: '🧴',
    verb: 'Drink',
    thrown: false,
    sustained: true,
    desc: 'Settled in water. Works on you, and keeps working for a while.',
  },
  draught: {
    name: 'Draught',
    icon: '🥃',
    verb: 'Drink',
    thrown: false,
    sustained: false,
    desc: 'Water that will not keep still. Everything it has, the moment it goes down.',
  },
  salve: {
    name: 'Salve',
    icon: '🫗',
    verb: 'Apply',
    thrown: false,
    sustained: false,
    desc: 'Settled oil, worked into skin. The form that clears what ails you.',
  },
  oil: {
    name: 'Oil',
    icon: '🛢️',
    verb: 'Coat',
    thrown: false,
    sustained: false,
    desc:
      'Oil that never settled. It goes on the blade instead of the wound, and ' +
      'every blow carries it until the edge wipes clean.',
  },
  bomb: {
    name: 'Flask',
    icon: '💣',
    verb: 'Throw',
    thrown: true,
    sustained: false,
    desc: 'Spirit raised past holding. It goes off on whatever it meets.',
  },
  fume: {
    name: 'Fume',
    icon: '🌫️',
    verb: 'Throw',
    thrown: true,
    sustained: true,
    desc: 'Spirit that never caught. It does not break so much as spread.',
  },
  residue: {
    name: 'Residue',
    icon: '🫧',
    verb: 'Discard',
    thrown: false,
    sustained: false,
    desc: 'Nothing raised it, so nothing came of it. Worth what the jar is worth.',
  },
};

// ---------- The formulary ----------

/**
 * Sequences somebody has already written down. The match is EXACT and ordered —
 * the whole point of a formula is that the order is the secret — so stumbling
 * onto one is a genuine discovery rather than a naming convention.
 *
 * The mirror of NAMED_RUNES: recognition only, no mechanical bonus. What the
 * brew does is what its sequence says it does, named or not.
 */
export const BREW_FORMULAS: BrewFormulaDef[] = [
  {
    id: 'smoulder_flask',
    name: "Smoulderer's Flask",
    icon: '💥',
    desc: 'Spirit, roused, fed to a bloom, and lit. The first thing every alchemist blows up.',
    sequence: ['grain_spirit', 'quicksilver', 'emberbloom', 'brimstone'],
  },
  {
    id: 'thief_draught',
    name: "Thief's Measure",
    icon: '🎭',
    desc: 'Gloom taken last, so none of it dissolves — all character, no strength.',
    sequence: ['spring_water', 'gloomcap', 'fixing_salt'],
  },
  {
    id: 'field_salve',
    name: 'Field Salve',
    icon: '🩹',
    desc: 'What a company medic carries. Root steeped first, then bound in oil.',
    sequence: ['pressed_oil', 'mendroot', 'mendroot', 'fixing_salt'],
  },
  {
    id: 'chokedamp',
    name: 'Chokedamp',
    icon: '☠️',
    desc: 'Never allowed to catch. It arrives as weather rather than as an explosion.',
    sequence: ['grain_spirit', 'nightcap', 'fixing_salt'],
  },
];

/** The formula this exact sequence is, if it is one. */
export function formulaFor(sequence: string[]): BrewFormulaDef | undefined {
  return BREW_FORMULAS.find(
    (f) => f.sequence.length === sequence.length && f.sequence.every((id, i) => id === sequence[i]),
  );
}

// ---------- Tuning ----------

/**
 * How long a sustained brew runs before anything is banked into it. Short on
 * purpose: cooking feeds you for ten minutes, alchemy is measured in the length
 * of one fight. That contrast IS the two disciplines' relationship.
 */
export const BREW_BASE_DURATION = 45 * SECOND;
/** The longest a fixed brew can be stretched to, however violently it was quenched. */
export const BREW_MAX_DURATION = 150 * SECOND;
