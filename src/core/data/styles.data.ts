import type { CombatStyleDef } from '../types';
import { prose } from '../text/prose';
import { STYLES_TEXT } from '../text/styles.text';

/**
 * Combat styles, restored to the proto26 vision.
 *
 * GENERIC STANCES (always available, distinct purposes) can each be
 * SUPPLANTED by a named weapon school: manifest the school's skill (by
 * fighting in the stance it upgrades, with the right weapon and prereqs)
 * and the stance transforms into the school while that weapon is held.
 * School styles scale with their skill's level via the `skill` link;
 * unequip the weapon and `effectiveStyle` falls back to the generic stance.
 *
 * Every style also declares an EXERTION (see ExertionSpec): the stamina it
 * burns per exchange and what that buys. Costs are fractions of max stamina,
 * so they keep pace as the pool grows; spending halts at the 20% reserve and
 * resumes only once the bar is full again. Rough cost bands:
 *   ~2–3%  cheap and constant (Neutral, Quick)   ~5–8%  middling (Cleave,
 *   Evasive, Brace, Finesse, Frenzy)   ~10–15% heavy burst (Crush, Flurry)
 *   drain  everything, straight into exhaustion (Jigen-ryu)
 */
export const STYLES = prose<CombatStyleDef>('STYLES', STYLES_TEXT, {
  // ==================== GENERIC STANCES ====================
  balanced: {
    id: 'balanced',
    name: 'Neutral',
    icon: '⚖️',
    mods: [],
    exertion: {
      on: 'attack',
      cost: 0.02,
      note: 'A measured breath per swing',
      hit: { damage: 0.1 },
    },
  },
  aggressive: {
    id: 'aggressive',
    name: 'Frenzy',
    icon: '🐺',
    mods: [
      { stat: 'damage', op: 'mult', value: 0.1 },
      { stat: 'attackSpeed', op: 'mult', value: 0.15 },
      { stat: 'dodge', op: 'add', value: -0.05 },
      { stat: 'armor', op: 'mult', value: -0.15 },
    ],
    exertion: {
      on: 'attack',
      cost: 0.06,
      note: 'Guard abandoned while the fire lasts',
      mods: [
        { stat: 'damage', op: 'mult', value: 0.2 },
        { stat: 'attackSpeed', op: 'mult', value: 0.25 },
        { stat: 'dodge', op: 'add', value: -0.08 },
        { stat: 'armor', op: 'mult', value: -0.3 },
      ],
    },
  },
  crush: {
    id: 'crush',
    name: 'Crush',
    icon: '🔨',
    mods: [
      { stat: 'damage', op: 'mult', value: 0.4 },
      { stat: 'penetration', op: 'add', value: 0.1 },
      { stat: 'attackSpeed', op: 'mult', value: -0.25 },
    ],
    exertion: {
      on: 'attack',
      cost: 0.1,
      note: 'Every ounce of weight behind the swing',
      hit: { damage: 0.5, penetration: 0.15 },
    },
  },
  cleave: {
    id: 'cleave',
    name: 'Cleave',
    icon: '🪓',
    mods: [
      { stat: 'damage', op: 'mult', value: 0.2 },
      { stat: 'splash', op: 'add', value: 0.1 },
      { stat: 'dodge', op: 'add', value: -0.05 },
    ],
    exertion: {
      on: 'attack',
      cost: 0.05,
      note: 'Follow the arc all the way through',
      hit: { damage: 0.1, splash: 0.25 },
    },
  },
  quick: {
    id: 'quick',
    name: 'Quick',
    icon: '💨',
    mods: [
      { stat: 'attackSpeed', op: 'mult', value: 0.3 },
      { stat: 'damage', op: 'mult', value: -0.1 },
    ],
    exertion: {
      on: 'attack',
      cost: 0.025,
      note: 'Momentum builds while the breath holds out',
      ramp: { stat: 'attackSpeed', per: 0.03, cap: 0.45 },
    },
  },
  evasive: {
    id: 'evasive',
    name: 'Evasive',
    icon: '🌀',
    mods: [
      { stat: 'dodge', op: 'add', value: 0.12 },
      { stat: 'attackSpeed', op: 'mult', value: 0.1 },
      { stat: 'damage', op: 'mult', value: -0.1 },
    ],
    exertion: {
      on: 'defend',
      cost: 0.05,
      note: 'A burst of footwork per incoming attack',
      hit: { dodge: 0.2 },
    },
  },
  finesse: {
    id: 'finesse',
    name: 'Finesse',
    icon: '🎯',
    mods: [
      { stat: 'crit', op: 'add', value: 0.12 },
      { stat: 'critDamage', op: 'mult', value: 0.4 },
      { stat: 'damage', op: 'mult', value: -0.1 },
    ],
    exertion: {
      on: 'attack',
      cost: 0.08,
      note: 'Breath held, eyes on the gap',
      mods: [
        { stat: 'crit', op: 'add', value: 0.12 },
        { stat: 'attackSpeed', op: 'mult', value: -0.12 },
      ],
    },
  },
  defensive: {
    id: 'defensive',
    name: 'Brace',
    icon: '🐢',
    mods: [
      { stat: 'armor', op: 'mult', value: 0.5 },
      { stat: 'maxHp', op: 'mult', value: 0.15 },
      { stat: 'damage', op: 'mult', value: -0.2 },
    ],
    exertion: {
      on: 'defend',
      cost: 0.05,
      note: 'Set against every incoming blow',
      hit: { armor: 0.6 },
    },
  },
  multi: {
    id: 'multi',
    name: 'Flurry',
    icon: '🌪️',
    mods: [
      { stat: 'attackSpeed', op: 'mult', value: 0.45 },
      { stat: 'damage', op: 'mult', value: -0.3 },
    ],
    exertion: {
      on: 'attack',
      cost: 0.14,
      note: 'Several blows in the space of one',
      hit: { extraHits: 1 },
    },
  },

  // ==================== SWORD SCHOOLS ====================
  jigen_ryu: {
    id: 'jigen_ryu',
    name: 'Jigen-ryu',
    icon: '⚡',
    mods: [
      { stat: 'damage', op: 'mult', value: 0.5, perLevel: 0.004 },
      { stat: 'penetration', op: 'add', value: 0.2, perLevel: 0.002 },
      { stat: 'critDamage', op: 'mult', value: 0.5 },
      { stat: 'attackSpeed', op: 'mult', value: -0.3 },
      { stat: 'dodge', op: 'add', value: -0.5 },
    ],
    exertion: {
      on: 'attack',
      cost: 1,
      drain: true,
      note: 'One breath, one blow, nothing left',
      hit: { damage: 1.5, penetration: 0.3 },
    },
    unlock: [
      { type: 'skill', id: 'school_jigen_ryu', level: 1 },
      { type: 'equippedTag', tag: 'katana' },
    ],
    replaces: 'crush',
    skill: 'school_jigen_ryu',
  },
  niten_ichi_ryu: {
    id: 'niten_ichi_ryu',
    name: 'Niten-Ichi-ryu',
    icon: '🗡️',
    mods: [
      { stat: 'parry', op: 'add', value: 0.15, perLevel: 0.002 },
      // The second blade is already moving when the first turns a blow aside,
      // so the answer comes free and hard — but this is still an ATTACKING
      // school: it parries more often than it parries well.
      { stat: 'riposte', op: 'add', value: 0.1, perLevel: 0.004 },
      { stat: 'damage', op: 'mult', value: -0.15, perLevel: 0.002 },
      { stat: 'crit', op: 'add', value: 0.05 },
    ],
    exertion: {
      on: 'attack',
      cost: 0.12,
      note: 'Twin arcs from one breath',
      hit: { extraHits: 1, damage: 0.1 },
    },
    unlock: [
      { type: 'skill', id: 'school_niten_ichi', level: 1 },
      { type: 'equippedTag', tag: 'katana' },
    ],
    replaces: 'multi',
    skill: 'school_niten_ichi',
  },
  eishin_ryu: {
    id: 'eishin_ryu',
    name: 'Eishin-ryu',
    icon: '🌙',
    mods: [
      { stat: 'crit', op: 'add', value: 0.18, perLevel: 0.001 },
      { stat: 'critDamage', op: 'mult', value: 0.6, perLevel: 0.005 },
      { stat: 'damage', op: 'mult', value: -0.05 },
    ],
    exertion: {
      on: 'attack',
      cost: 0.07,
      note: 'Stillness before the draw',
      mods: [
        { stat: 'crit', op: 'add', value: 0.15 },
        { stat: 'attackSpeed', op: 'mult', value: -0.1 },
      ],
    },
    unlock: [
      { type: 'skill', id: 'school_eishin', level: 1 },
      { type: 'equippedTag', tag: 'katana' },
    ],
    replaces: 'finesse',
    skill: 'school_eishin',
  },
  ittou_ryu_style: {
    id: 'ittou_ryu_style',
    name: 'Ittou-ryu',
    icon: '👁️',
    mods: [
      { stat: 'attackSpeed', op: 'mult', value: 0.35 },
      { stat: 'crit', op: 'add', value: 0.1, perLevel: 0.001 },
      { stat: 'critDamage', op: 'mult', value: 0.3, perLevel: 0.004 },
      { stat: 'damage', op: 'mult', value: -0.05 },
    ],
    exertion: {
      on: 'attack',
      cost: 0.03,
      note: 'The pace climbs with every cut',
      ramp: { stat: 'attackSpeed', per: 0.035, cap: 0.5 },
    },
    unlock: [
      { type: 'skill', id: 'school_ittou_ryu', level: 1 },
      { type: 'equippedTag', tag: 'katana' },
    ],
    replaces: 'quick',
    skill: 'school_ittou_ryu',
  },

  // ==================== PARRY SCHOOLS ====================
  // Parry's two homes outside the katana. Both take a DEFENSIVE stance's slot,
  // because parry is a defensive answer — and both spend their breath on
  // `defend`, buying parry the way Evasive buys dodge and Brace buys armor.
  // Where they differ is the trade: Destreza gives up the guard entirely and
  // lives on the blade; Bolognese keeps Brace's armor and adds the bind.
  destreza: {
    id: 'destreza',
    name: 'Destreza',
    icon: '🤺',
    mods: [
      { stat: 'parry', op: 'add', value: 0.14, perLevel: 0.002 },
      { stat: 'riposte', op: 'add', value: 0.25, perLevel: 0.008 },
      { stat: 'dodge', op: 'add', value: 0.04 },
      { stat: 'crit', op: 'add', value: 0.04 },
      { stat: 'damage', op: 'mult', value: -0.1 },
    ],
    exertion: {
      on: 'defend',
      cost: 0.055,
      note: 'The point already covering the line',
      hit: { parry: 0.18 },
    },
    unlock: [
      { type: 'skill', id: 'school_destreza', level: 1 },
      { type: 'equippedTag', tag: 'rapier' },
    ],
    replaces: 'evasive',
    skill: 'school_destreza',
  },
  bolognese: {
    id: 'bolognese',
    name: 'Bolognese',
    icon: '🔰',
    mods: [
      { stat: 'parry', op: 'add', value: 0.1, perLevel: 0.0015 },
      { stat: 'riposte', op: 'add', value: 0.15, perLevel: 0.005 },
      { stat: 'armor', op: 'mult', value: 0.3, perLevel: 0.003 },
      { stat: 'damage', op: 'mult', value: -0.12 },
    ],
    exertion: {
      on: 'defend',
      cost: 0.05,
      note: 'Buckler out to meet it, sword ready behind',
      hit: { parry: 0.14, armor: 0.25 },
    },
    unlock: [
      { type: 'skill', id: 'school_bolognese', level: 1 },
      { type: 'equippedTag', tag: 'sword' },
      { type: 'equippedTag', tag: 'buckler' },
    ],
    replaces: 'defensive',
    skill: 'school_bolognese',
  },

  // ==================== UNARMED SCHOOLS ====================
  boxing: {
    id: 'boxing',
    name: 'Boxing',
    icon: '🥊',
    mods: [
      { stat: 'dodge', op: 'add', value: 0.15, perLevel: 0.001 },
      { stat: 'attackSpeed', op: 'mult', value: 0.15 },
      { stat: 'damage', op: 'mult', value: 0.05, perLevel: 0.003 },
    ],
    exertion: {
      on: 'defend',
      cost: 0.045,
      note: 'Slip the punch, spend the breath',
      hit: { dodge: 0.22 },
    },
    unlock: [
      { type: 'skill', id: 'school_boxing', level: 1 },
      { type: 'equippedTag', tag: 'unarmed' },
    ],
    replaces: 'evasive',
    skill: 'school_boxing',
  },
  taekwondo: {
    id: 'taekwondo',
    name: 'Taekwondo',
    icon: '🦵',
    mods: [
      { stat: 'attackSpeed', op: 'mult', value: 0.5, perLevel: 0.003 },
      { stat: 'dodge', op: 'add', value: 0.05 },
      { stat: 'damage', op: 'mult', value: -0.15 },
    ],
    exertion: {
      on: 'attack',
      cost: 0.13,
      note: 'A chain of kicks off one breath',
      hit: { extraHits: 1 },
    },
    unlock: [
      { type: 'skill', id: 'school_taekwondo', level: 1 },
      { type: 'equippedTag', tag: 'unarmed' },
    ],
    replaces: 'multi',
    skill: 'school_taekwondo',
  },
  muay_thai: {
    id: 'muay_thai',
    name: 'Muay Thai',
    icon: '🐘',
    mods: [
      { stat: 'damage', op: 'mult', value: 0.45, perLevel: 0.004 },
      { stat: 'critDamage', op: 'mult', value: 0.4 },
      { stat: 'armor', op: 'mult', value: 0.15 },
      { stat: 'attackSpeed', op: 'mult', value: -0.15 },
    ],
    exertion: {
      on: 'attack',
      cost: 0.09,
      note: 'Hips turned into every strike',
      hit: { damage: 0.55, penetration: 0.1 },
    },
    unlock: [
      { type: 'skill', id: 'school_muay_thai', level: 1 },
      { type: 'equippedTag', tag: 'unarmed' },
    ],
    replaces: 'crush',
    skill: 'school_muay_thai',
  },
  wrestling: {
    id: 'wrestling',
    name: 'Wrestling',
    icon: '🤼',
    mods: [
      { stat: 'armor', op: 'mult', value: 0.6, perLevel: 0.004 },
      { stat: 'maxHp', op: 'mult', value: 0.25, perLevel: 0.002 },
      { stat: 'damage', op: 'mult', value: -0.1 },
    ],
    exertion: {
      on: 'defend',
      cost: 0.045,
      note: 'Hips set against every blow',
      hit: { armor: 0.75 },
    },
    unlock: [
      { type: 'skill', id: 'school_wrestling', level: 1 },
      { type: 'equippedTag', tag: 'unarmed' },
    ],
    replaces: 'defensive',
    skill: 'school_wrestling',
  },

  // ==================== MAGIKNIGHT ====================
  magic_combat: {
    id: 'magic_combat',
    name: 'Magic Combat',
    icon: '🔮',
    mods: [
      { stat: 'crit', op: 'add', value: 0.08, perLevel: 0.001 },
      { stat: 'spellPower', op: 'mult', value: 0.1, perLevel: 0.002 },
    ],
    exertion: {
      on: 'attack',
      pool: 'mana',
      cost: 0.08,
      note: 'Will behind the edge — paid in mana',
      hit: { damage: 0.5, penetration: 0.12 },
    },
    unlock: [{ type: 'skill', id: 'school_magic_combat', level: 1 }],
    replaces: 'finesse',
    skill: 'school_magic_combat',
  },
  capoeira: {
    id: 'capoeira',
    name: 'Capoeira',
    icon: '📦',
    mods: [
      { stat: 'dodge', op: 'mult', value: 0.08, perLevel: 0.01 },
    ],
    exertion: {
      on: 'defend',
      cost: 0.08,
      note: 'Stay in motion to slip away from an incoming attack.',
      hit: {
             dodge: 0.15,
           },
    },
    unlock: [
      { type: 'equippedTag', tag: 'unarmed' },
      { type: 'skill', id: 'school_capoeira', level: 1 },
    ],
    replaces: 'quick',
    skill: 'school_capoeira',
  },
});
