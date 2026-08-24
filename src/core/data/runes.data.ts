import type { NamedRuneDef, RuneDef } from '../types';

/**
 * Runes: stackable socketables for equipment rune slots. Each rune's effects
 * are fixed per context — the same rune grants different things depending on
 * whether it sits in a weapon, a piece of armor, or an accessory. Contexts
 * without an entry are inert (the rune can still be slotted there, it just
 * does nothing — the UI warns).
 */
export const RUNES: Record<string, RuneDef> = {
  minor_rune_might: {
    id: 'minor_rune_might',
    name: 'Minor Rune of Might',
    icon: '🔺',
    desc: 'A rough-cut stone humming with strength.',
    value: 25,
    effects: {
      weapon: { mods: [{ stat: 'damage', op: 'add', value: 4 }] },
      armor: { mods: [{ stat: 'armor', op: 'add', value: 2 }] },
      accessory: { mods: [{ stat: 'damage', op: 'mult', value: 0.02 }] },
    },
  },
  greater_rune_might: {
    id: 'greater_rune_might',
    name: 'Greater Rune of Might',
    icon: '🔻',
    desc: 'Cut by a master hand; it pulls at nearby iron.',
    value: 90,
    effects: {
      weapon: {
        mods: [
          { stat: 'damage', op: 'add', value: 9 },
          { stat: 'damage', op: 'mult', value: 0.03 },
        ],
      },
      armor: { mods: [{ stat: 'armor', op: 'add', value: 5 }] },
      accessory: { mods: [{ stat: 'damage', op: 'mult', value: 0.05 }] },
    },
  },
  minor_rune_vitality: {
    id: 'minor_rune_vitality',
    name: 'Minor Rune of Vitality',
    icon: '🟢',
    desc: 'Warm to the touch, like a heartbeat.',
    value: 25,
    effects: {
      weapon: { mods: [{ stat: 'maxHp', op: 'add', value: 10 }] },
      armor: { mods: [{ stat: 'maxHp', op: 'add', value: 25 }] },
      accessory: { mods: [{ stat: 'maxHp', op: 'mult', value: 0.03 }] },
    },
  },
  greater_rune_vitality: {
    id: 'greater_rune_vitality',
    name: 'Greater Rune of Vitality',
    icon: '💚',
    desc: 'Moss grows on whatever pouch you keep it in.',
    value: 90,
    effects: {
      weapon: { mods: [{ stat: 'maxHp', op: 'add', value: 25 }] },
      armor: {
        mods: [
          { stat: 'maxHp', op: 'add', value: 60 },
          { stat: 'maxHp', op: 'mult', value: 0.03 },
        ],
      },
      // Worn rather than worked into gear, the moss-grown thing mends you as
      // well as thickening you — the one place HP regen is reachable so far.
      accessory: {
        mods: [
          { stat: 'maxHp', op: 'mult', value: 0.06 },
          { stat: 'hpRegen', op: 'add', value: 0.4 },
        ],
      },
    },
  },
  // ---------- Technique surgery (docs/MARTIAL.md §9: rewrite a node, never
  // an edge list). One rune per surgery tier: tempo, exit, and the Honed
  // offering itself.
  gale_rune: {
    id: 'gale_rune',
    name: 'Gale Rune',
    icon: '🌬️',
    desc: 'Wind lives in the stone. Footwork it touches barely touches the ground.',
    value: 120,
    effects: {
      // Tempo surgery: Sidestep answers again far sooner, wearing a new name.
      weapon: {
        techniqueMods: [{ technique: 'sidestep', rename: 'Flash Step', cooldownMult: 0.55 }],
      },
      armor: { mods: [{ stat: 'dodge', op: 'add', value: 0.03 }] },
      accessory: { mods: [{ stat: 'speed', op: 'mult', value: 0.02 }] },
    },
  },
  earthbind_rune: {
    id: 'earthbind_rune',
    name: 'Earthbind Rune',
    icon: '⛰️',
    desc: 'The stone remembers standing still. Motion it touches ends rooted, not reaching.',
    value: 130,
    effects: {
      // Exit surgery: the thrust recovers into a load-bearing crouch instead
      // of centre — it feeds the coiled cluster now.
      weapon: {
        techniqueMods: [{ technique: 'thrust', rename: 'Rooted Thrust', exitTo: 'coiled' }],
      },
      armor: { mods: [{ stat: 'armor', op: 'mult', value: 0.05 }] },
      accessory: { mods: [{ stat: 'resEarth', op: 'add', value: 0.05 }] },
    },
  },
  umbral_rune: {
    id: 'umbral_rune',
    name: 'Umbral Rune',
    icon: '🌑',
    desc: 'A sliver of dark that widens what a blade believes it may become.',
    value: 140,
    effects: {
      // Choice surgery: the riposte hits harder AND its Honed fork offers
      // Sweeping — an archetype no counter-cut is normally allowed.
      weapon: {
        techniqueMods: [{ technique: 'riposte', damageMult: 1.1, grantsFork: 'sweep' }],
        bonusDamage: { type: 'dark', value: 3 },
      },
      armor: { mods: [{ stat: 'resDark', op: 'add', value: 0.08 }] },
      accessory: { mods: [{ stat: 'crit', op: 'add', value: 0.02 }] },
    },
  },
  minor_rune_thunder: {
    id: 'minor_rune_thunder',
    name: 'Minor Rune of Thunder',
    icon: '⚡',
    desc: 'Your hair stands up when you hold it.',
    value: 40,
    effects: {
      weapon: { bonusDamage: { type: 'lightning', value: 3 } },
      armor: { mods: [{ stat: 'resLightning', op: 'add', value: 0.06 }] },
      accessory: { mods: [{ stat: 'spellPower', op: 'add', value: 3 }] },
    },
  },
  greater_rune_thunder: {
    id: 'greater_rune_thunder',
    name: 'Greater Rune of Thunder',
    icon: '🌩️',
    desc: 'It rumbles faintly before storms.',
    value: 140,
    effects: {
      weapon: { bonusDamagePct: { type: 'lightning', value: 0.12 } },
      armor: { mods: [{ stat: 'resLightning', op: 'add', value: 0.1 }] },
      accessory: { mods: [{ stat: 'spellPower', op: 'mult', value: 0.08 }] },
    },
  },
  minor_rune_frost: {
    id: 'minor_rune_frost',
    name: 'Minor Rune of Frost',
    icon: '❄️',
    desc: 'It never warms, no matter the season.',
    value: 40,
    effects: {
      weapon: { bonusDamage: { type: 'cold', value: 3 } },
      armor: { mods: [{ stat: 'resCold', op: 'add', value: 0.06 }] },
      accessory: { mods: [{ stat: 'crit', op: 'add', value: 0.02 }] },
    },
  },
  rune_swiftness: {
    id: 'rune_swiftness',
    name: 'Rune of Swiftness',
    icon: '🌀',
    desc: 'Light as a held breath.',
    value: 60,
    effects: {
      weapon: { mods: [{ stat: 'attackSpeed', op: 'mult', value: 0.04 }] },
      armor: { mods: [{ stat: 'speed', op: 'mult', value: 0.02 }] },
      accessory: { mods: [{ stat: 'speed', op: 'mult', value: 0.03 }] },
    },
  },
};

// ---------- Carving: patterns, adornments, and named works ----------

/**
 * What a carver cuts into a stone. The pattern is WHAT the rune does; the
 * stone's grade decides how strongly, and adornments add their own things on
 * top. Everything here is stated at C-tier ("Fair") strength, because that
 * grade's multiplier is exactly 1 — read these numbers as the baseline.
 */
export interface RunePatternDef {
  id: string;
  name: string;
  icon: string;
  desc?: string;
  /** Runecarving level before it may be attempted. */
  minLevel?: number;
  effects: RuneDef['effects'];
}

export const RUNE_PATTERNS: Record<string, RunePatternDef> = {
  pattern_might: {
    id: 'pattern_might',
    name: 'Rune of Might',
    icon: '🔺',
    desc: 'Three strokes and a heavy downstroke. The first thing any carver learns.',
    effects: {
      weapon: { mods: [{ stat: 'damage', op: 'add', value: 4 }] },
      armor: { mods: [{ stat: 'armor', op: 'add', value: 2 }] },
      accessory: { mods: [{ stat: 'damage', op: 'mult', value: 0.02 }] },
    },
  },
  pattern_warding: {
    id: 'pattern_warding',
    name: 'Rune of Warding',
    icon: '🛡️',
    desc: 'A closed figure. Nothing gets in that the carver did not let in.',
    effects: {
      weapon: { mods: [{ stat: 'parry', op: 'add', value: 0.02 }] },
      armor: { mods: [{ stat: 'armor', op: 'add', value: 4 }] },
      accessory: { mods: [{ stat: 'maxHp', op: 'add', value: 12 }] },
    },
  },
  pattern_swiftness: {
    id: 'pattern_swiftness',
    name: 'Rune of Swiftness',
    icon: '🌀',
    desc: 'An open spiral, cut in one motion or not at all.',
    minLevel: 5,
    effects: {
      weapon: { mods: [{ stat: 'attackSpeed', op: 'mult', value: 0.04 }] },
      armor: { mods: [{ stat: 'speed', op: 'mult', value: 0.02 }] },
      accessory: { mods: [{ stat: 'speed', op: 'mult', value: 0.03 }] },
    },
  },
  pattern_edge: {
    id: 'pattern_edge',
    name: 'Rune of the Edge',
    icon: '🗡️',
    desc: 'Hairline work. Rewards a steady hand and punishes everything else.',
    minLevel: 12,
    effects: {
      weapon: {
        mods: [
          { stat: 'crit', op: 'add', value: 0.03 },
          { stat: 'critDamage', op: 'add', value: 0.15 },
        ],
      },
      accessory: { mods: [{ stat: 'crit', op: 'add', value: 0.02 }] },
    },
  },
};

/**
 * What a stone is painted, inlaid and adorned with. These are ordinary
 * materials — the discipline decides what they MEAN here, which is why the
 * mapping lives with the runes rather than on the material itself. The same
 * gel will mean something else entirely to a cook.
 */
export interface RuneAdornmentDef {
  id: string;
  effects: RuneDef['effects'];
}

export const RUNE_ADORNMENTS: Record<string, RuneAdornmentDef> = {
  warm_slime_gel: {
    id: 'warm_slime_gel',
    effects: {
      weapon: { bonusDamage: { type: 'heat', value: 2 } },
      armor: { mods: [{ stat: 'resHeat', op: 'add', value: 0.05 }] },
      accessory: { mods: [{ stat: 'resHeat', op: 'add', value: 0.04 }] },
    },
  },
  chilled_slime_gel: {
    id: 'chilled_slime_gel',
    effects: {
      weapon: { bonusDamage: { type: 'cold', value: 2 } },
      armor: { mods: [{ stat: 'resCold', op: 'add', value: 0.05 }] },
      accessory: { mods: [{ stat: 'resCold', op: 'add', value: 0.04 }] },
    },
  },
  charged_slime_gel: {
    id: 'charged_slime_gel',
    effects: {
      weapon: { bonusDamagePct: { type: 'lightning', value: 0.06 } },
      armor: { mods: [{ stat: 'resLightning', op: 'add', value: 0.05 }] },
      accessory: { mods: [{ stat: 'speed', op: 'mult', value: 0.02 }] },
    },
  },
  luminous_slime_gel: {
    id: 'luminous_slime_gel',
    effects: {
      weapon: { bonusDamage: { type: 'light', value: 3 } },
      armor: { mods: [{ stat: 'resDark', op: 'add', value: 0.06 }] },
      accessory: { mods: [{ stat: 'resLight', op: 'add', value: 0.05 }] },
    },
  },
  gold_leaf: {
    id: 'gold_leaf',
    effects: {
      weapon: { mods: [{ stat: 'damage', op: 'mult', value: 0.03 }] },
      armor: { mods: [{ stat: 'maxHp', op: 'add', value: 8 }] },
      accessory: { mods: [{ stat: 'goldGain', op: 'mult', value: 0.05 }] },
    },
  },
  bone_dust: {
    id: 'bone_dust',
    effects: {
      armor: { mods: [{ stat: 'maxHp', op: 'add', value: 5 }] },
      accessory: { mods: [{ stat: 'resDark', op: 'add', value: 0.03 }] },
    },
  },
  ochre_pigment: {
    id: 'ochre_pigment',
    effects: {
      weapon: { mods: [{ stat: 'damage', op: 'add', value: 1.5 }] },
      armor: { mods: [{ stat: 'armor', op: 'add', value: 1.5 }] },
      accessory: { mods: [{ stat: 'loot', op: 'mult', value: 0.02 }] },
    },
  },
  verdigris_pigment: {
    id: 'verdigris_pigment',
    effects: {
      weapon: { bonusDamage: { type: 'poison', value: 2 } },
      armor: { mods: [{ stat: 'resPoison', op: 'add', value: 0.05 }] },
      accessory: { mods: [{ stat: 'resPoison', op: 'add', value: 0.04 }] },
    },
  },
  raw_sapphire: {
    id: 'raw_sapphire',
    effects: {
      weapon: { mods: [{ stat: 'spellPower', op: 'add', value: 3 }] },
      armor: { mods: [{ stat: 'maxMana', op: 'add', value: 4 }] },
      accessory: { mods: [{ stat: 'manaRegen', op: 'add', value: 0.05 }] },
    },
  },
  cut_garnet: {
    id: 'cut_garnet',
    effects: {
      weapon: { mods: [{ stat: 'crit', op: 'add', value: 0.02 }] },
      armor: { mods: [{ stat: 'armor', op: 'add', value: 3 }] },
      accessory: { mods: [{ stat: 'critDamage', op: 'add', value: 0.1 }] },
    },
  },
};

/**
 * Combinations that are known works rather than merely competent ones.
 *
 * A name is earned by an EXACT recipe — the right pattern, every listed
 * adornment and nothing else, on a stone good enough. Because a carving stores
 * its combination rather than its results, this table is all it takes: no
 * flagging, no per-save bookkeeping, and anybody handed the rune can see what
 * it is.
 */
export const NAMED_RUNES: NamedRuneDef[] = [
  {
    id: 'stormbrand',
    name: 'Stormbrand',
    icon: '🌩️',
    desc: 'Sapphire drinks the charge and gives it back all at once. A duellist’s rune.',
    patterns: ['pattern_edge'],
    // One inlay and one gem — the bench has a station for each. Two inlays
    // would make this recipe unbuildable; the content test below enforces it.
    adornments: ['charged_slime_gel', 'raw_sapphire'],
    minQuality: 'b',
    bonus: {
      weapon: {
        bonusDamagePct: { type: 'lightning', value: 0.08 },
        mods: [{ stat: 'critDamage', op: 'add', value: 0.2 }],
      },
    },
  },
  {
    id: 'hearthward',
    name: 'Hearthward',
    icon: '🔥',
    desc: 'Warm gel worked into a closed ward. Cheap, ugly, and it has saved lives.',
    patterns: ['pattern_warding'],
    adornments: ['warm_slime_gel'],
    bonus: {
      armor: { mods: [{ stat: 'resHeat', op: 'add', value: 0.08 }] },
    },
  },
  {
    id: 'winters_edge',
    name: "Winter's Edge",
    icon: '❄️',
    desc: 'Cut cold, inlaid colder. The garnet is there to stop the stone splitting.',
    patterns: ['pattern_edge'],
    adornments: ['chilled_slime_gel', 'cut_garnet'],
    minQuality: 'a',
    bonus: {
      weapon: {
        bonusDamage: { type: 'cold', value: 6 },
        mods: [{ stat: 'crit', op: 'add', value: 0.03 }],
      },
    },
  },
  {
    id: 'twiceforged',
    name: 'Twiceforged Seal',
    icon: '🔱',
    desc: 'Might over warding, cut in one sitting. Carvers argue about whether it should work.',
    patterns: ['pattern_might', 'pattern_warding'],
    adornments: ['gold_leaf'],
    minQuality: 'b',
    bonus: {
      weapon: { mods: [{ stat: 'damage', op: 'mult', value: 0.06 }] },
      armor: { mods: [{ stat: 'armor', op: 'add', value: 5 }] },
    },
  },
];
