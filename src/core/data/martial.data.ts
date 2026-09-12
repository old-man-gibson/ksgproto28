import type { ForkArchetypeDef, PositionDef, TechniqueDef, WeaponFamilyDef } from '../types';
import { prose } from '../text/prose';
import { POSITIONS_TEXT, FORK_ARCHETYPES_TEXT, TECHNIQUES_TEXT } from '../text/martial.text';

/**
 * Martial technique content. The design mirror-image of the grimoire: magic is
 * composed BEFORE combat and played back; a technique is a trained reflex whose
 * trigger, entry and exit are baked into what it is, and whose sequencing is
 * decided by the fight itself. Progression is the inverse of arcana's novelty
 * ledger too — a technique deepens through repetition (see mastery tiers).
 */

/**
 * The universal position vocabulary. Weapon families will add their own.
 * Each position owns a COLOR: entry/exit pills, the strip chips and the card
 * gradients all wear it, so "these two chain" reads at a glance — a card
 * whose right edge matches another's left edge feeds it.
 */
export const POSITIONS = prose<PositionDef>('POSITIONS', POSITIONS_TEXT, {
  neutral: {
    id: 'neutral',
    name: 'Neutral',
    icon: '⚖️',
    color: '#9aa5b1',
  },
  coiled: {
    id: 'coiled',
    name: 'Coiled',
    icon: '🌀',
    color: '#b58fe0',
  },
  extended: {
    id: 'extended',
    name: 'Extended',
    icon: '🫱',
    color: '#e0a855',
  },
  off_balance: {
    id: 'off_balance',
    name: 'Off Balance',
    icon: '💫',
    color: '#e05555',
    // Positions are felt, not just gate-keys: stumbling is a real exposure…
    effects: { incomingMult: 1.15 },
  },
  guarded: {
    id: 'guarded',
    name: 'Guarded',
    icon: '🛡️',
    color: '#5b9bd5',
    // …and a set guard is real cover.
    effects: { incomingMult: 0.9 },
  },
  // The magiknight seat. Holding a working at the edge of release is a real
  // commitment: your attention is inside the spell, not on their footwork, so
  // it costs you defensively for as long as you carry it. Hidden until you
  // know a technique that reaches it (positionKnown), because standing here
  // deliberately is itself a trained thing.
  spell_ready: {
    id: 'spell_ready',
    name: 'Spell Ready',
    icon: '🔮',
    color: '#8ee1f6',
    effects: { incomingMult: 1.1 },
  },
  wide_open: {
    id: 'wide_open',
    name: 'Wide Open',
    icon: '🤷‍♂️',
    color: '#97f524',
    effects: {
               incomingMult: 1.2,
             },
  },
});

/** The pill/tint color for an 'any'-entry reflex — deliberately no position's. */
export const ANY_POSITION_COLOR = '#6b7280';

export const NEUTRAL_POSITION = 'neutral';

/** The seat a readied working is bound to — leaving it drops the spell. */
export const SPELL_READY_POSITION = 'spell_ready';

/**
 * The weapon families the planner filters by (matches `ItemDef.tags` and
 * `TechniqueDef.family`). A grouping label only — universal (family-less)
 * techniques such as Gather or Sidestep are never gated by this list, and
 * picking a family here grants nothing; it just narrows what the graph shows.
 */
export const WEAPON_FAMILIES: readonly WeaponFamilyDef[] = [
  { id: 'unarmed', name: 'Unarmed', icon: '🥊' },
  { id: 'sword', name: 'Sword', icon: '⚔️' },
  { id: 'katana', name: 'Katana', icon: '🗡️' },
  { id: 'dagger', name: 'Dagger', icon: '🔪' },
  { id: 'blunt', name: 'Blunt', icon: '🔨' },
  { id: 'spear', name: 'Spear', icon: '🔱' },
  { id: 'bow', name: 'Bow', icon: '🏹' },
  { id: 'greatsword', name: 'Greatsword', icon: '🪓' },
  { id: 'staff', name: 'Staff', icon: '🪄' },
  { id: 'shield', name: 'Shield', icon: '🛡️' },
  // ⊂ shield: the light one you aim at a blade rather than hide behind.
  { id: 'buckler', name: 'Buckler', icon: '🔰' },
];

/** How many techniques may advance their practice counters at once. */
export const MAX_DRILLED = 3;

// ---------- The standard mastery ladder ----------
// Powers of ten: the first rung lands in the first session, the last is the
// proverbial ten thousand swings. Growth per rep is logarithmic by
// construction, and every technique climbs the same ladder — data only names
// a rung or grows the graph at it (TechniqueDef.mastery notes).

export const MASTERY_LADDER = [10, 100, 1000, 10000] as const;
export const MASTERY_NAMES = ['Practiced', 'Drilled', 'Honed', 'Perfected'] as const;
/** Generic per-tier damage multiplier (tier 1–4). */
export const MASTERY_POWER = [1.05, 1.12, 1.2, 1.3] as const;
/** Generic per-tier cooldown multiplier (tier 1–4). */
export const MASTERY_COOLDOWN = [1, 0.92, 0.85, 0.75] as const;

// ---------- Forms ----------
/** Rough mechanics are all arm, no hips: stamina surcharge until Perfected. */
export const ROUGH_STAMINA_MULT = 1.25;
/** Your own tricks internalize fast: rough reps count double on the ladder. */
export const ROUGH_REP_MULT = 2;

// ---------- Fork archetypes ----------
/** The rung at which a forked technique offers its choice (Honed — 1,000 reps). */
export const FORK_TIER = 3;

/**
 * The fork vocabulary: reusable transforms a technique may offer at Honed.
 * Every archetype is a strict advancement of the move as a whole — the EV
 * content test (martial.test.ts) enforces it — even where a number shrinks.
 * The choice is permanent: your practice history is your build.
 */
export const FORK_ARCHETYPES = prose<ForkArchetypeDef>('FORK_ARCHETYPES', FORK_ARCHETYPES_TEXT, {
  split: {
    id: 'split',
    name: 'Split',
    icon: '⚡',
    kind: 'strike',
    hits: 2,
    damageMult: 0.65,
  },
  overwhelm: {
    id: 'overwhelm',
    name: 'Overwhelming',
    icon: '💥',
    kind: 'strike',
    damageMult: 1.6,
    exitTo: 'off_balance',
  },
  exposing: {
    id: 'exposing',
    name: 'Exposing',
    icon: '💥',
    kind: 'strike',
    damageMult: 1.3,
    dodgeMult: 0.8,
    exitTo: 'wide_open',
  },
  economy: {
    id: 'economy',
    name: 'Economical',
    icon: '♻️',
    kind: 'strike',
    damageMult: 0.9,
    cooldownMult: 0.6,
  },
  sweep: {
    id: 'sweep',
    name: 'Sweeping',
    icon: '🌊',
    kind: 'strike',
    damageMult: 0.9,
    splashAdd: 0.35,
  },
  flowing: {
    id: 'flowing',
    name: 'Flowing',
    icon: '🌀',
    kind: 'strike',
    exitTo: 'extended',
  },
  lasting: {
    id: 'lasting',
    name: 'Lasting',
    icon: '⏳',
    kind: 'buff',
    durationMult: 1.6,
  },
  sudden: {
    id: 'sudden',
    name: 'Sudden',
    icon: '💨',
    kind: 'buff',
    cooldownMult: 0.65,
  },
});

export const FORK_ARCHETYPE_LIST: readonly ForkArchetypeDef[] = Object.values(FORK_ARCHETYPES);

/**
 * The techniques. `trigger` reuses the SkillTrigger machinery, so a baked
 * reflex and a player-authored condition speak the same language — the baked
 * one just can't be edited away. Reactive triggers carry a wide `window`:
 * a reflex answers on your next swing, not within the moment itself.
 *
 * `unlock` is eligibility, `learn.self` is the fight counter that
 * crystallizes the rough form once eligibility holds; teachers (future
 * content) grant the canonical form directly.
 */
export const TECHNIQUES = prose<TechniqueDef>('TECHNIQUES', TECHNIQUES_TEXT, {
  gather: {
    id: 'gather',
    name: 'Gather',
    icon: '🌀',
    skill: 'fighting',
    from: ['neutral'],
    to: 'coiled',
    move: { damageMult: 0.6, momentum: 0.02, cooldown: 30 },
    unlock: [{ type: 'skill', id: 'fighting', level: 5 }],
    learn: { self: { stat: 'combat:attacks', count: 100 } },
    mastery: { 2: { name: 'Second Nature' } },
  },
  heavy_blow: {
    id: 'heavy_blow',
    name: 'Heavy Blow',
    icon: '🔨',
    skill: 'fighting',
    from: ['coiled'],
    to: 'off_balance',
    move: { damageMult: 2.0, staminaCost: 0.08, cooldown: 60 },
    unlock: [
      { type: 'skill', id: 'fighting', level: 5 },
      { type: 'attr', attr: 'str', level: 8 },
    ],
    learn: { self: { stat: 'combat:crits', count: 50 } },
    // Ten thousand cuts: perfected, it no longer needs the wind-up.
    mastery: { 4: { addFrom: ['neutral'] } },
    forks: ['split', 'overwhelm'],
  },
  sidestep: {
    id: 'sidestep',
    name: 'Sidestep',
    icon: '💨',
    skill: 'fighting',
    trigger: { conditions: [], event: 'onHit', window: 20 },
    from: 'any',
    to: 'guarded',
    move: {
      buff: { mods: [{ stat: 'dodge', op: 'add', value: 0.4 }], duration: 30 },
      cooldown: 120,
    },
    unlock: [
      { type: 'skill', id: 'fighting', level: 8 },
      { type: 'attr', attr: 'dex', level: 10 },
    ],
    learn: { self: { stat: 'combat:hitsTaken', count: 100 } },
    forks: ['lasting', 'sudden'],
  },
  riposte: {
    id: 'riposte',
    name: 'Riposte',
    icon: '⚡',
    skill: 'fighting',
    trigger: { conditions: [], event: 'onDodge', window: 20 },
    from: 'any',
    to: 'extended',
    move: { damageMult: 1.4, cooldown: 40 },
    unlock: [
      { type: 'skill', id: 'fighting', level: 12 },
      { type: 'attr', attr: 'dex', level: 12 },
    ],
    learn: { self: { stat: 'combat:dodges', count: 50 } },
    mastery: { 3: { name: 'Instinct' } },
    forks: ['economy', 'split'],
  },
  thrust: {
    id: 'thrust',
    name: 'Thrust',
    icon: '🗡️',
    family: 'sword',
    skill: 'swordsmanship',
    from: ['extended'],
    to: 'neutral',
    move: { damageMult: 1.5, penetration: 0.15, cooldown: 30 },
    unlock: [{ type: 'skill', id: 'swordsmanship', level: 5 }],
    learn: { self: { stat: 'combat:attacks', count: 250 } },
    mastery: { 3: { name: 'Needle' } },
    // Flowing Thrust exits extended — it can feed itself. That is the choice.
    forks: ['flowing', 'economy'],
  },
  crosscut: {
    id: 'crosscut',
    name: 'Crosscut',
    icon: '⚔️',
    family: 'sword',
    skill: 'swordsmanship',
    trigger: { conditions: [], event: 'onCrit', window: 20 },
    from: ['neutral', 'extended'],
    to: 'extended',
    move: { damageMult: 1.3, splash: 0.3, cooldown: 50 },
    unlock: [{ type: 'skill', id: 'swordsmanship', level: 10 }],
    learn: { self: { stat: 'combat:crits', count: 100 } },
    mastery: { 3: { name: 'Shearing Arc' } },
    forks: ['sweep', 'overwhelm'],
  },

  // ---------- Katana ----------
  // The blade of the four schools. Katana are also swords, so a katana hand
  // holds thrust/crosscut too — these are what only the curved blade teaches.
  iai_draw: {
    id: 'iai_draw',
    name: 'Iai Draw',
    icon: '🌙',
    family: 'katana',
    skill: 'school_eishin',
    // The opening moments of the fight — wide enough to reach the first swing.
    trigger: { conditions: [], event: 'onEncounterStart', window: 40 },
    from: ['neutral'],
    to: 'extended',
    move: { damageMult: 1.9, penetration: 0.1, cooldown: 300 },
    unlock: [
      { type: 'skill', id: 'swordsmanship', level: 15 },
      { type: 'equippedTag', tag: 'katana' },
    ],
    learn: { self: { stat: 'combat:crits', count: 150 } },
    mastery: { 3: { name: 'First Light' } },
    forks: ['overwhelm', 'economy'],
  },
  deflecting_moon: {
    id: 'deflecting_moon',
    name: 'Deflecting Moon',
    icon: '🌗',
    family: 'katana',
    skill: 'school_niten_ichi',
    trigger: { conditions: [], event: 'onParry', window: 20 },
    from: 'any',
    to: 'coiled',
    move: {
      buff: { mods: [{ stat: 'crit', op: 'add', value: 0.2 }], duration: 30 },
      cooldown: 100,
    },
    unlock: [
      { type: 'skill', id: 'swordsmanship', level: 15 },
      { type: 'attr', attr: 'dex', level: 15 },
      { type: 'equippedTag', tag: 'katana' },
    ],
    learn: { self: { stat: 'combat:parries', count: 25 } },
    forks: ['lasting', 'sudden'],
  },
  finishing_cut: {
    id: 'finishing_cut',
    name: 'Finishing Cut',
    icon: '👁️',
    family: 'katana',
    skill: 'school_ittou_ryu',
    // A finisher reads the enemy, not an event: it primes on their failing body.
    trigger: { conditions: [{ subject: 'enemy.hpPct', op: '<=', value: 25 }] },
    from: ['coiled', 'extended'],
    to: 'neutral',
    move: { damageMult: 2.2, staminaCost: 0.06, cooldown: 80 },
    unlock: [
      { type: 'skill', id: 'swordsmanship', level: 25 },
      { type: 'equippedTag', tag: 'katana' },
    ],
    learn: { self: { stat: 'combat:attacks', count: 500 } },
    mastery: { 3: { name: 'Single Stroke' } },
    forks: ['split', 'overwhelm', 'exposing'],
  },

  // ---------- Unarmed ----------
  // The body as the weapon: what the four unarmed halls have in common.
  slip_jab: {
    id: 'slip_jab',
    name: 'Slip Jab',
    icon: '🥊',
    family: 'unarmed',
    skill: 'school_boxing',
    trigger: { conditions: [], event: 'onDodge', window: 20 },
    from: 'any',
    to: 'neutral',
    move: { damageMult: 1.15, cooldown: 20 },
    unlock: [
      { type: 'skill', id: 'unarmed_combat', level: 10 },
      { type: 'equippedTag', tag: 'unarmed' },
    ],
    learn: { self: { stat: 'combat:dodges', count: 75 } },
    mastery: { 3: { name: 'Counterpuncher' } },
    forks: ['economy', 'split'],
  },
  whirl_kick: {
    id: 'whirl_kick',
    name: 'Whirl Kick',
    icon: '🦵',
    family: 'unarmed',
    skill: 'school_taekwondo',
    from: ['coiled'],
    to: 'extended',
    move: { damageMult: 1.4, splash: 0.35, staminaCost: 0.05, cooldown: 50 },
    unlock: [
      { type: 'skill', id: 'unarmed_combat', level: 15 },
      { type: 'equippedTag', tag: 'unarmed' },
    ],
    learn: { self: { stat: 'combat:attacks', count: 300 } },
    mastery: { 3: { name: 'Cyclone' } },
    forks: ['sweep', 'overwhelm'],
  },
  clinch_knee: {
    id: 'clinch_knee',
    name: 'Clinch Knee',
    icon: '🐘',
    family: 'unarmed',
    skill: 'school_muay_thai',
    trigger: { conditions: [], event: 'onHit', window: 20 },
    from: 'any',
    to: 'guarded',
    move: {
      damageMult: 1.5,
      staminaCost: 0.05,
      inflicts: [{ id: 'dazed', intensity: 1, chance: 0.35 }],
      cooldown: 90,
    },
    unlock: [
      { type: 'skill', id: 'unarmed_combat', level: 20 },
      { type: 'equippedTag', tag: 'unarmed' },
    ],
    learn: { self: { stat: 'combat:hitsTaken', count: 150 } },
    mastery: { 3: { name: 'Eight Limbs' } },
    forks: ['overwhelm', 'economy'],
  },

  // ---------- Capoeira (the off_balance seat) ----------
  // The school that claims the stumble: what everyone else calls a cost
  // position is capoeira's home rhythm. These are the game's first entrants
  // from off_balance — every producer of it (Heavy Blow, Overwhelming forks)
  // is retroactively re-priced for whoever knows them.
  ginga: {
    id: 'ginga',
    name: 'Ginga',
    icon: '🕺',
    family: 'unarmed',
    skill: 'unarmed_combat',
    from: ['off_balance'],
    to: 'coiled',
    move: { damageMult: 0.8, momentum: 0.03, cooldown: 20 },
    unlock: [{ type: 'skill', id: 'unarmed_combat', level: 12 }],
    learn: { self: { stat: 'combat:hitsTaken', count: 120 } },
    mastery: { 3: { name: 'Rhythm' } },
    forks: ['economy'],
  },
  meia_lua: {
    id: 'meia_lua',
    name: 'Meia Lua',
    icon: '🌜',
    family: 'unarmed',
    skill: 'unarmed_combat',
    from: ['off_balance'],
    to: 'neutral',
    move: { damageMult: 1.35, splash: 0.4, staminaCost: 0.05, cooldown: 50 },
    unlock: [{ type: 'skill', id: 'unarmed_combat', level: 18 }],
    learn: { self: { stat: 'combat:dodges', count: 100 } },
    mastery: { 3: { name: 'Crescent' } },
    forks: ['sweep', 'overwhelm'],
  },

  // ---------- Weapon states (see systems/martial.ts) ----------
  weapon_drop: {
    id: 'weapon_drop',
    name: 'Weapon Drop',
    icon: '🤲',
    skill: 'fighting',
    requiresWielded: true,
    from: 'any',
    to: 'off_balance',
    move: { damageMult: 0.9, equipment: 'ground', cooldown: 100 },
    unlock: [
      { type: 'skill', id: 'fighting', level: 15 },
      { type: 'skill', id: 'unarmed_combat', level: 10 },
    ],
    learn: { self: { stat: 'combat:attacks', count: 600 } },
  },
  ground_draw: {
    id: 'ground_draw',
    name: 'Ground Draw',
    icon: '🗡',
    skill: 'fighting',
    requiresGrounded: true,
    from: ['coiled'],
    to: 'extended',
    move: { damageMult: 2.4, penetration: 0.15, staminaCost: 0.06, equipment: 'recover', cooldown: 120 },
    unlock: [{ type: 'skill', id: 'fighting', level: 15 }],
    learn: { self: { stat: 'combat:attacks', count: 800 } },
    forks: ['overwhelm', 'split'],
  },
  hidden_draw: {
    id: 'hidden_draw',
    name: 'Hidden Draw',
    icon: '🔪',
    skill: 'dagger_combat',
    requiresSheathed: 'dagger',
    // The anticipation read: fires as the enemy winds up its own attack.
    trigger: { conditions: [{ subject: 'enemy.bar', op: '>=', value: 65 }] },
    from: 'any',
    to: 'extended',
    move: { damageMult: 2.6, penetration: 0.25, equipment: 'draw', cooldown: 150 },
    unlock: [{ type: 'skill', id: 'dagger_combat', level: 10 }],
    learn: { self: { stat: 'combat:crits', count: 120 } },
    forks: ['overwhelm', 'economy'],
  },

  // ---------- Spellblade (the magiknight seat) ----------
  // Martial supplies the structure, magic supplies the payload. Ready Spell
  // buys the seat (paying the mana up front — letting it lapse is the risk),
  // and Spell Parry spends it through an opening the fight gave you.
  ready_spell: {
    id: 'ready_spell',
    name: 'Ready Spell',
    icon: '🔮',
    skill: 'school_magic_combat',
    // The baked read: you take a working up BECAUSE something is winding up to
    // swing at you. Without this the form fires the instant it is off cooldown,
    // and since a plain swing drops the seat it becomes a mana furnace —
    // readying and losing a spell every cycle while never delivering one.
    trigger: { conditions: [{ subject: 'enemy.bar', op: '>=', value: 55 }] },
    from: ['neutral', 'guarded'],
    to: 'spell_ready',
    // No strike of its own: readying IS the action. Fires from the off-bar
    // slot like any other form that does not swing.
    move: { readiesSpell: true, cooldown: 60 },
    unlock: [
      { type: 'skill', id: 'school_magic_combat', level: 1 },
      { type: 'skill', id: 'magic', level: 10 },
    ],
    learn: { self: { stat: 'combat:attacks', count: 200 } },
  },
  spell_parry: {
    id: 'spell_parry',
    name: 'Spell Parry',
    icon: '✨',
    skill: 'school_magic_combat',
    requiresReadiedSpell: true,
    trigger: { conditions: [], event: 'onParry', window: 20 },
    from: ['spell_ready'],
    to: 'guarded',
    // A counter: it lives inside the enemy's swing rather than on your bar,
    // and what it answers with is the spell, not the sword.
    move: {
      counter: { reduce: 0.5 },
      deliversSpell: true,
      cooldown: 80,
    },
    unlock: [
      { type: 'skill', id: 'school_magic_combat', level: 5 },
      { type: 'attr', attr: 'int', level: 20 },
    ],
    learn: { self: { stat: 'combat:parries', count: 40 } },
    mastery: { 3: { name: 'Counterspell' } },
  },

  // ---------- Buckler (the deflection seat) ----------
  // The first technique that answers with THEIR force instead of yours: the
  // parry stamps how hard the blow was coming in, and `preventedMult` returns
  // a share of it. That makes it the one form that gets better the more
  // dangerous the thing swinging at you — a rat's tap answers for nothing, a
  // boss's haymaker comes straight back.
  flowing_shield: {
    id: 'flowing_shield',
    name: 'Flowing Shield',
    icon: '🛡️🌊',
    family: 'buckler',
    skill: 'shield_combat',
    trigger: { conditions: [], event: 'onParry', window: 20 },
    // From behind a set guard, and the deflection winds you up for what comes
    // next. The Flowing fork spends that wind-up on reach instead (→ extended).
    from: ['guarded'],
    to: 'coiled',
    move: { damageMult: 1, preventedMult: 1.2, staminaCost: 0.04, cooldown: 70 },
    unlock: [
      { type: 'skill', id: 'shield_combat', level: 10 },
      { type: 'skill', id: 'deflection', level: 5 },
      { type: 'equippedTag', tag: 'buckler' },
    ],
    learn: { self: { stat: 'combat:parries', count: 40 } },
    // Drilled, the reflex stops needing the guard to already be set.
    mastery: { 2: { addFrom: ['neutral'] }, 3: { name: 'The Wave Returns' } },
    forks: ['flowing', 'economy'],
  },

  // ---------- Magiknight ----------
  // The first COUNTER: a technique that lives inside the enemy's swing rather
  // than on your action bar. It needs two schools — the boxer's shell to be
  // worth hitting and the magiknight's will to make the contact cost them.
  electric_cross: {
    id: 'electric_cross',
    name: 'Electric Cross',
    icon: '⚡🥊',
    family: 'unarmed',
    skill: 'school_magic_combat',
    trigger: { conditions: [], event: 'onHit' },
    from: ['guarded'],
    to: 'extended',
    move: {
      counter: { reduce: 0.4, pool: 'mana', cost: 0.06 },
      damageMult: 1,
      preventedMult: 1,
      // Your fist is still a fist; what the guard ate comes back as lightning.
      damageType: 'lightning',
      cooldown: 80,
    },
    unlock: [
      { type: 'skill', id: 'school_magic_combat', level: 10 },
      { type: 'skill', id: 'school_boxing', level: 15 },
      { type: 'equippedTag', tag: 'unarmed' },
    ],
    learn: { self: { stat: 'combat:hitsTaken', count: 200 } },
    mastery: { 2: { addFrom: ['neutral'] }, 3: { name: 'Ground Through the Guard' } },
    forks: ['economy', 'overwhelm'],
  },
  german_suplex: {
    id: 'german_suplex',
    name: 'German Suplex',
    icon: '🤼',
    skill: 'school_wrestling',
    from: ['wide_open'],
    to: 'off_balance',
    move: { damageMult: 2, momentum: 0, cooldown: 120, damageType: "bludgeoning" },
    unlock: [
      { type: 'attr', attr: 'str', level: 30 },
      { type: 'skill', id: 'school_wrestling', level: 25 },
    ],
    learn: {
      self: { stat: 'combat:hitsTaken', count: 150 },
    },
    mastery: {
      2: { name: 'Northern Star Suplex' },
    },
    forks: ['split', 'flowing'],
    family: 'unarmed',
  },
  taunt: {
    id: 'taunt',
    name: 'Taunt',
    icon: '🤡',
    from: 'any',
    to: 'wide_open',
    // A slap with intent: barely damage, but it IS a strike, so it rides the
    // action bar and can carry strike forks. (A zero here would be the worst
    // of both — still a swing, still spending your turn, dealing nothing.)
    move: { damageMult: 0.25, momentum: 0.5, cooldown: 100 },
    unlock: [
      { type: 'skill', id: 'speechcraft', level: 15 },
    ],
    learn: {
      self: { stat: 'combat:dodges', count: 200 },
    },
    mastery: {
      2: { name: 'Greater Taunt' },
    },
    // Now that it strikes, the strike archetypes are the ones that fit.
    forks: ['economy', 'sweep'],
    family: 'unarmed',
  },
  impaling_swing: {
    id: 'impaling_swing',
    name: 'Impaling Swing',
    icon: '🫸🗡',
    skill: 'fighting',
    requiresWielded: true,
    from: ['coiled'],
    to: 'wide_open',
    move: {
      damageMult: 0.9,
      penetration: 0.2,
      equipment: 'impale',
      inflicts: [{ id: 'skewered', intensity: 1 }],
      cooldown: 100,
      damageType: "piercing",
    },
    unlock: [
      { type: 'skill', id: 'fighting', level: 15 },
      { type: 'skill', id: 'unarmed_combat', level: 10 },
    ],
    learn: {
      self: { stat: 'combat:attacks', count: 600 },
    },
  },
  flesh_draw: {
    id: 'flesh_draw',
    name: 'Flesh Draw',
    icon: '🗡🙍‍♂️',
    skill: 'fighting',
    requiresImpaled: true,
    from: [
      { at: ['coiled'] },
      { at: ['wide_open'], trigger: { conditions: [], event: 'onDodge', window: 20 }},
    ],
    to: 'extended',
    // Tearing it out is the opening — no roll needed, but a blade coming the
    // wrong way through flesh is not your cleanest crit either.
    move: {
      damageMult: 1.4,
      penetration: 0.85,
      staminaCost: 0.06,
      equipment: 'wrench',
      crit: { always: true, damageMult: 0.5, floor: 1.5 },
      cooldown: 120,
    },
    unlock: [
      { type: 'skill', id: 'fighting', level: 15 },
    ],
    learn: {
      self: { stat: 'combat:attacks', count: 800 },
    },
    forks: ['overwhelm', 'split'],
  },
});

export const TECHNIQUE_LIST: readonly TechniqueDef[] = Object.values(TECHNIQUES);
