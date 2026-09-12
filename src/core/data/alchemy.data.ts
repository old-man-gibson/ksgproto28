import type { BrewForm, BrewFormulaDef, ReagentDef } from '../types';
import { prose, proseList } from '../text/prose';
import { REAGENTS_TEXT, BREW_FORMS_TEXT, BREW_FORMULAS_TEXT } from '../text/alchemy.text';

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
export const REAGENTS = prose<ReagentDef>('REAGENTS', REAGENTS_TEXT, {
  // ---------- Menstruums: what the brew is raised in ----------
  //
  // The first solvent in decides the FORM the brew will take, whatever else
  // happens to it afterwards. A second one dilutes: weaker, calmer, and with
  // room for more.

  spring_water: {
    id: 'spring_water',
    name: 'Spring Water',
    icon: '💧',
    menstruum: { medium: 'water', body: 8 },
  },
  pressed_oil: {
    id: 'pressed_oil',
    name: 'Pressed Oil',
    icon: '🫙',
    menstruum: { medium: 'oil', body: 6 },
  },
  grain_spirit: {
    id: 'grain_spirit',
    name: 'Grain Spirit',
    icon: '🍶',
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
    minLevel: 2,
    act: { kind: 'agitate', amount: 1.3 },
  },
  fixing_salt: {
    id: 'fixing_salt',
    name: 'Fixing Salt',
    icon: '🧂',
    act: { kind: 'fix' },
  },
  brimstone: {
    id: 'brimstone',
    name: 'Brimstone',
    icon: '🟡',
    minLevel: 7,
    act: { kind: 'ignite', needs: 1.2, mult: 1.55 },
  },
  bone_ash: {
    id: 'bone_ash',
    name: 'Bone Ash',
    icon: '🦴',
    minLevel: 4,
    act: { kind: 'clarify', mult: 1.5 },
  },
  green_vitriol: {
    id: 'green_vitriol',
    name: 'Green Vitriol',
    icon: '🧪',
    minLevel: 11,
    act: { kind: 'corrode', penetration: 0.22, mult: 1.25, purity: 0.88 },
  },
});

export const REAGENT_LIST: ReagentDef[] = Object.values(REAGENTS);

export function reagent(id: string): ReagentDef | undefined {
  return REAGENTS[id];
}

// ---------- Forms ----------

/**
 * What each form is called and how it is delivered. `thrown` forms need a
 * fight; the rest are used on yourself, wherever you are standing.
 */
export const BREW_FORMS = prose<{ name: string; icon: string; verb: string; thrown: boolean; sustained: boolean; desc: string }, BrewForm>('BREW_FORMS', BREW_FORMS_TEXT, {
  elixir: {
    name: 'Elixir',
    icon: '🧴',
    verb: 'Drink',
    thrown: false,
    sustained: true,
  },
  draught: {
    name: 'Draught',
    icon: '🥃',
    verb: 'Drink',
    thrown: false,
    sustained: false,
  },
  salve: {
    name: 'Salve',
    icon: '🫗',
    verb: 'Apply',
    thrown: false,
    sustained: false,
  },
  oil: {
    name: 'Oil',
    icon: '🛢️',
    verb: 'Coat',
    thrown: false,
    sustained: false,
  },
  bomb: {
    name: 'Flask',
    icon: '💣',
    verb: 'Throw',
    thrown: true,
    sustained: false,
  },
  fume: {
    name: 'Fume',
    icon: '🌫️',
    verb: 'Throw',
    thrown: true,
    sustained: true,
  },
  residue: {
    name: 'Residue',
    icon: '🫧',
    verb: 'Discard',
    thrown: false,
    sustained: false,
  },
});

// ---------- The formulary ----------

/**
 * Sequences somebody has already written down. The match is EXACT and ordered —
 * the whole point of a formula is that the order is the secret — so stumbling
 * onto one is a genuine discovery rather than a naming convention.
 *
 * The mirror of NAMED_RUNES: recognition only, no mechanical bonus. What the
 * brew does is what its sequence says it does, named or not.
 */
export const BREW_FORMULAS = proseList<BrewFormulaDef>('BREW_FORMULAS', BREW_FORMULAS_TEXT, [
  {
    id: 'smoulder_flask',
    name: "Smoulderer's Flask",
    icon: '💥',
    sequence: ['grain_spirit', 'quicksilver', 'emberbloom', 'brimstone'],
  },
  {
    id: 'thief_draught',
    name: "Thief's Measure",
    icon: '🎭',
    sequence: ['spring_water', 'gloomcap', 'fixing_salt'],
  },
  {
    id: 'field_salve',
    name: 'Field Salve',
    icon: '🩹',
    sequence: ['pressed_oil', 'mendroot', 'mendroot', 'fixing_salt'],
  },
  {
    id: 'chokedamp',
    name: 'Chokedamp',
    icon: '☠️',
    sequence: ['grain_spirit', 'nightcap', 'fixing_salt'],
  },
]);

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
