import type { ProseTable } from './prose';

// Player-facing text for src/core/data/alchemy.data.ts. Keys are dotted paths from the
// entry id; see src/core/text/prose.ts. Edit the words here, the numbers there.

// ---------- REAGENTS ----------
export const REAGENTS_TEXT: ProseTable = {
  'spring_water.desc': 'Menstruum, water medium. Calm: Elixir. Roused: Draught. Capacity 8.',

  'pressed_oil.desc': 'Menstruum, oil medium. Calm: Salve. Roused: weapon Oil. Capacity 6.',

  'grain_spirit.desc': 'Menstruum, spirit medium. Calm: Fume. Roused: Flask. Capacity 5. Also adds 0.5 volatility, so spirit brews start halfway to roused.',

  'emberbloom.desc': 'Essence: Ember, heat, power 3.2. Inflicts On Fire in a Flask or Oil. No effect in drinkable forms.',

  'frostmoss.desc': "Essence: Rime, cold, power 2.8. Inflicts Chilled in a Flask, Fume or Oil; grants Xima's Rime in an Elixir.",

  'nightcap.desc': 'Essence: Venom, poison, power 3.4. Inflicts Poisoned in a Flask, Fume or Oil. Alchemy 3.',

  'gloomcap.desc': 'Essence: Gloom, dark, power 2.6. Inflicts Dazzled in a Flask, Fume or Oil; grants Veiled in an Elixir. Alchemy 6.',

  'mendroot.desc': 'Essence: Mending, power 2.6. Restores 3.2 HP per potency in a Draught or Salve; grants Well Fed in an Elixir; cures poison and bleed in a Salve.',

  'bloodwort.desc': 'Essence: Vigor, power 2.4. Restores 2.6 stamina per potency in a Draught or Salve; grants Blood Communion in an Elixir. Alchemy 5.',

  'thunderbloom.desc': 'Essence: Storm, lightning, power 3.0. Inflicts Jolted in a Flask, Fume or Oil; restores 1.6 mana per potency in a Draught; grants Clear-Headed in an Elixir. Alchemy 9.',

  'quicksilver.desc': 'Operator: +1.3 volatility. Rouses a calm brew (the line is 1.0). Alchemy 2.',

  'fixing_salt.desc': 'Operator: sets volatility to calm and banks the amount quenched as duration. Rouse first, then settle, for a longer brew. Base 45 seconds, cap 150.',

  'brimstone.desc': 'Operator: needs volatility of at least 1.2 when it lands. If met, potency ×1.55. If not, it fouls the brew. Alchemy 7.',

  'bone_ash.desc': 'Operator: removes the weakest essence already in the pot and multiplies the remaining potency by 1.5. Does nothing to an empty pot. Alchemy 4.',

  'green_vitriol.desc': 'Operator: +22% penetration and potency ×1.25, purity ×0.88. Alchemy 11.',
};

// ---------- BREW_FORMS ----------
export const BREW_FORMS_TEXT: ProseTable = {
  'elixir.desc': "Calm water brew. Drink. Grants the essences' conditions for the banked duration (45 seconds base). Does not restore.",

  'draught.desc': "Roused water brew. Drink. Restores at once from the essences' restore values. Does not grant conditions.",

  'salve.desc': 'Calm oil brew. Apply. Restores at once. The only form that cures.',

  'oil.desc': "Roused oil brew. Coat your drawn weapon. Lasts 3 + potency × 0.8 blows (max 12); each blow adds typed damage and applies the essences' afflictions. A second oil replaces the first.",

  'bomb.desc': "Roused spirit brew. Throw in a fight. Deals typed damage (potency × 2.4) and applies the essences' afflictions to what it hits.",

  'fume.desc': "Calm spirit brew. Throw in a fight. Applies the essences' afflictions to every enemy for the banked duration. Deals no damage.",

  'residue.desc': 'A sequence with no menstruum. No effect. Discard or sell.',
};

// ---------- BREW_FORMULAS ----------
export const BREW_FORMULAS_TEXT: ProseTable = {
  'smoulder_flask.desc': 'Grain Spirit, Quicksilver, Emberbloom, Brimstone. Spirit and quicksilver put volatility past 1.2, so the brimstone ignites: a Flask of about 13 heat damage plus On Fire at Fair grade.',

  'thief_draught.desc': 'Spring Water, Gloomcap, Fixing Salt. An Elixir granting Veiled (×0.65 at Fair grade); the salt banks the duration.',

  'field_salve.desc': 'Pressed Oil, Mendroot, Mendroot, Fixing Salt. A Salve: about 19 HP at Fair grade, and cures poison and bleed.',

  'chokedamp.desc': 'Grain Spirit, Nightcap, Fixing Salt. The salt settles the spirit before anything ignites it, so it comes out a Fume: Poisoned on every enemy for 53 seconds at Fair grade.',
};
