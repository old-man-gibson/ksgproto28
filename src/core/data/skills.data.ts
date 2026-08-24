import type { SkillDef } from '../types';
import { PROGRESSIONS } from './progression.data';
import { MUSIC_UNLOCKS } from './music.data';
import { WORD_SKILLS } from './wordskills.data';

/**
 * Skill content. Skills "manifest" (are discovered) when the player performs an
 * action whose tags intersect the skill's tags while all unlock conditions hold.
 * Branching: swordsmanship requires Fighting 10 + a sword equipped; ittou-ryu
 * requires Swordsmanship 25 + Dexterity 20.
 */
const HAND_WRITTEN: Record<string, SkillDef> = {
  fighting: {
    id: 'fighting',
    name: 'Fighting',
    icon: '👊',
    desc: 'The fundamentals of not dying in a brawl. Improves all combat.',
    kind: 'passive',
    category: 'combat',
    progression: PROGRESSIONS.foundational,
    tags: ['combat'],
    unlock: [],
    effects: [{ stat: 'damage', op: 'mult', value: 0, perLevel: 0.01 }],
  },
  swordsmanship: {
    id: 'swordsmanship',
    name: 'Swordsmanship',
    icon: '🗡️',
    desc: 'Formal blade technique. Manifests through sword combat once your fighting basics are solid.',
    kind: 'passive',
    category: 'combat',
    progression: PROGRESSIONS.specialist,
    tags: ['combat', 'sword'],
    parent: 'fighting',
    unlock: [
      { type: 'skill', id: 'fighting', level: 10 },
      { type: 'equippedTag', tag: 'sword' },
    ],
    effects: [
      { stat: 'damage', op: 'mult', value: 0, perLevel: 0.015, requiresTag: 'sword' },
      { stat: 'crit', op: 'add', value: 0, perLevel: 0.002, requiresTag: 'sword' },
    ],
  },
  // The old heavy_swing / active_dodge actives live on as martial TECHNIQUES
  // (data/martial.data.ts) — trained reflexes, not skills.
  scouting: {
    id: 'scouting',
    name: 'Scouting',
    icon: '🔭',
    desc: 'Reading terrain and traces. Explore faster, travel lighter.',
    kind: 'passive',
    category: 'general',
    progression: PROGRESSIONS.foundational,
    tags: ['explore', 'travel'],
    unlock: [],
    effects: [
      { stat: 'travelSpeed', op: 'mult', value: 0, perLevel: 0.01 },
      { stat: 'loot', op: 'mult', value: 0, perLevel: 0.005 },
    ],
  },
  chronosense: {
    id: 'chronosense',
    name: 'Chronosense',
    icon: '🕰️',
    desc:
      'The body keeping its own calendar. Manifests from nothing but lived time and sharpens ' +
      'the same way — first the shape of the day, then the season, the bell, the week, and at ' +
      'last the very minute. Some things in the world keep appointments.',
    kind: 'passive',
    category: 'general',
    progression: PROGRESSIONS.foundational,
    // No action carries this tag on purpose: time is the only teacher — the
    // manifest and the XP trickle both live in systems/chronosense.ts.
    tags: ['time'],
    unlock: [],
    // The flesh counts no further than 20 on its own; the ceiling rises only
    // through cap raises (quests, events, prestige). Levels past it buy
    // time-resistance — see timePenaltyMult in systems/chronosense.ts.
    maxLevel: 20,
    tierNames: [
      { level: 1, name: 'Sun-Guesser' },
      { level: 4, name: 'Season-Feeler' },
      { level: 8, name: 'Bell-Counter' },
      { level: 12, name: 'Week-Keeper' },
      { level: 16, name: 'Calendar-Mind' },
      { level: 25, name: 'Clockwork Soul' },
    ],
  },
  hunting: {
    id: 'hunting',
    name: 'Hunting',
    icon: '🏹',
    desc: 'Tracking, field-dressing, and knowing your quarry. Sharpens what a kill teaches you — the bestiary fills in faster, and habitats take fewer sightings to pin down.',
    kind: 'passive',
    category: 'general',
    progression: PROGRESSIONS.insightful,
    /**
     * A hunter learns from unfamiliar quarry. The first of a species is worth
     * 10x an ordinary kill (k/c = 20/2); by the tenth it is down to 2.5x, by the
     * hundredth it is barely above the floor. Filling in the bestiary — a new
     * entry, a fact pinned down, a den located — pays outright.
     */
    novelty: { domain: 'bestiary', k: 20, c: 2, discovery: 40 },
    tags: ['hunt'],
    unlock: [],
    effects: [
      { stat: 'loot', op: 'mult', value: 0, perLevel: 0.004 },
      { stat: 'goldGain', op: 'mult', value: 0, perLevel: 0.003 },
    ],
    tierNames: [
      { level: 10, name: 'Trapper' },
      { level: 25, name: 'Tracker' },
      { level: 40, name: 'Beast Scholar' },
      { level: 60, name: 'Monster Hunter' },
    ],
  },
  speechcraft: {
    id: 'speechcraft',
    name: 'Speechcraft',
    icon: '🗣️',
    desc: 'Reading people and knowing what to ask. Manifests the first time you take work from a stranger — and grows fastest among strangers.',
    kind: 'passive',
    category: 'general',
    progression: PROGRESSIONS.insightful,
    /**
     * A harder falloff than hunting: `c` of 1 against hunting's 2 halves the
     * novelty twice as fast, because a second conversation with the same person
     * teaches you much less than a second wolf does. The opening is 12x, but by
     * the fifth exchange with the same face it is under 3x.
     *
     * Turning work IN is where the real payout sits (see quests.ts) — carrying
     * a job through to its end teaches more than agreeing to it ever did.
     */
    novelty: { domain: 'dialogue', k: 12, c: 1, discovery: 30 },
    tags: ['social'],
    unlock: [],
    effects: [{ stat: 'goldGain', op: 'mult', value: 0, perLevel: 0.005 }],
    tierNames: [
      { level: 10, name: 'Fast Talker' },
      { level: 25, name: 'Negotiator' },
      { level: 40, name: 'Silver Tongue' },
      { level: 60, name: 'They Will Hear You Out' },
    ],
  },

  musicianship: {
    id: 'musicianship',
    name: 'Musicianship',
    icon: '🎼',
    desc:
      'Fingers, breath and timing — music as a made thing. Manifests the first time you truly ' +
      'perform, and every level buys more room on the page: finer notes, longer forms, stranger ' +
      'scales. What a piece IS is decided by what it measures as, not by what you meant.',
    kind: 'passive',
    category: 'general',
    progression: PROGRESSIONS.specialist,
    // Only performing carries this tag (systems/music.ts) — the stage is the
    // teacher, and the first honest set is the manifestation.
    tags: ['music'],
    unlock: [],
    // Tier names track the unlock ladder (MUSIC_UNLOCKS), so the title always
    // says what the hands just learned to hold.
    tierNames: [
      { level: 1, name: 'Busker' },
      { level: MUSIC_UNLOCKS.quarter, name: 'Time-Keeper' },
      { level: MUSIC_UNLOCKS.eighth, name: 'Melodist' },
      { level: MUSIC_UNLOCKS.scales, name: 'Scale-Walker' },
      { level: MUSIC_UNLOCKS.bar8, name: 'Virtuoso' },
    ],
  },

  magic: {
    id: 'magic',
    name: 'Magic',
    icon: '✨',
    desc: 'The world hums, and you have started to hear it.',
    kind: 'passive',
    category: 'magic',
    progression: PROGRESSIONS.specialist,
    tags: ['magic'],
    unlock: [{ type: 'attr', attr: 'int', level: 15 }],
    effects: [{ stat: 'spellPower', op: 'mult', value: 0, perLevel: 0.02 }],
  },
  /*
  // TODO: leveling these words only improves on efficiency and minor bonuses to intensity or duration on milestones,
      while also being a partial gate for higher words to be unlocked for use
  word_fire: {
    id: 'word_fire',
    name: 'Fire',
    icon: '',
    desc: '',
    kind: "passive",
    category: "magic",
    parent: "arcana"
    tags: [],
    unlock: []
  },
  word_ice: {
    id: "",
    name: "",
    icon: "",
    desc: "placeholder for the associated wor",
    kind: "passive",
    category: "magic",
    parent: "arcana"
    tags: [],
    unlock: []
  },
  word_spark: {
    id: "",
    name: "",
    icon: "",
    desc: "placeholder for the associated wor",
    kind: "passive",
    category: "magic",
    parent: "arcana"
    tags: [],
    unlock: []
  },
  word_water: {
    id: "",
    name: "",
    icon: "",
    desc: "placeholder for the associated wor",
    kind: "passive",
    category: "magic",
    parent: "arcana"
    tags: [],
    unlock: []
  },
  word_gust: {
    id: "",
    name: "",
    icon: "",
    desc: "placeholder for the associated wor",
    kind: "passive",
    category: "magic",
    parent: "arcana"
    tags: [],
    unlock: []
  },
  word_stone: {
    id: "",
    name: "",
    icon: "",
    desc: "placeholder for the associated wor",
    kind: "passive",
    category: "magic",
    parent: "arcana"
    tags: [],
    unlock: []
  },

  word_venom: {
    id: "",
    name: "",
    icon: "",
    desc: "placeholder for the associated wor",
    kind: "passive",
    category: "magic",
    parent: "arcana"
    tags: [],
    unlock: []
  },
  word_light: {
    id: "",
    name: "",
    icon: "",
    desc: "placeholder for the associated wor",
    kind: "passive",
    category: "magic",
    parent: "arcana"
    tags: [],
    unlock: []
  },
  word_gloom: {
    id: "",
    name: "",
    icon: "",
    desc: "placeholder for the associated wor",
    kind: "passive",
    category: "magic",
    parent: "arcana"
    tags: [],
    unlock: []
  },
  word_iron: {
    id: "",
    name: "",
    icon: "",
    desc: "placeholder for the associated wor",
    kind: "passive",
    category: "magic",
    parent: "arcana"
    tags: [],
    unlock: []
  },
  word_cut: {
    id: "",
    name: "",
    icon: "",
    desc: "placeholder for the associated wor",
    kind: "passive",
    category: "magic",
    parent: "arcana"
    tags: [],
    unlock: []
  },
  word_zero: {
    id: "",
    name: "",
    icon: "",
    desc: "placeholder for the associated wor",
    kind: "passive",
    category: "magic",
    parent: "arcana"
    tags: [],
    unlock: []
  },
  word_arcane: {
    id: "",
    name: "",
    icon: "",
    desc: "placeholder for the associated wor",
    kind: "passive",
    category: "magic",
    parent: "arcana"
    tags: [],
    unlock: []
  },
  word_pierce: {
    id: "",
    name: "",
    icon: "",
    desc: "placeholder for the associated wor",
    kind: "passive",
    category: "magic",
    parent: "arcana"
    tags: [],
    unlock: []
  },
  word_fly: {
    id: "",
    name: "",
    icon: "",
    desc: "placeholder for the associated wor",
    kind: "passive",
    category: "magic",
    parent: "arcana"
    tags: [],
    unlock: []
  },
  word_expand: {
    id: "",
    name: "",
    icon: "",
    desc: "placeholder for the associated wor",
    kind: "passive",
    category: "magic",
    parent: "arcana"
    tags: [],
    unlock: []
  },
  word_ward: {
    id: "",
    name: "",
    icon: "",
    desc: "placeholder for the associated wor",
    kind: "passive",
    category: "magic",
    parent: "arcana"
    tags: [],
    unlock: []
  },
  word_burst: {
    id: "",
    name: "",
    icon: "",
    desc: "placeholder for the associated wor",
    kind: "passive",
    category: "magic",
    parent: "arcana"
    tags: [],
    unlock: []
  },
  word_mend: {
    id: "",
    name: "",
    icon: "",
    desc: "placeholder for the associated wor",
    kind: "passive",
    category: "magic",
    parent: "arcana"
    tags: [],
    unlock: []
  },
  word_grasp: {
    id: "",
    name: "",
    icon: "",
    desc: "placeholder for the associated wor",
    kind: "passive",
    category: "magic",
    parent: "arcana"
    tags: [],
    unlock: []
  },*/

  // ---------- Spellcraft schools ----------
  // Three ways of making magic, each gating its own bench at the spell table.
  // They manifest by WORKING at the table (tag 'spellcraft' + the school's own),
  // the same way a carver manifests runecarving at the rune table.
  arcana: {
    id: 'arcana',
    name: 'Arcana',
    icon: '🪄',
    desc: 'The grammar underneath the world. Learn its words, and mind your word order.',
    kind: 'passive',
    category: 'magic',
    progression: PROGRESSIONS.perfectionist,
    // Only its own school's tag: the table emits a generic 'spellcraft' too,
    // but claiming it here would train every school from any school's work.
    tags: ['arcane'],
    parent: 'magic',
    unlock: [{ type: 'attr', attr: 'int', level: 10 }],
    /*
     * Arcana learns from NEW sentences, not from repetition — the reserved
     * 'arcana' novelty domain finally has its tenant. A sentence never spoken
     * before pays 8x; recomposing the same spell teaches almost nothing, which
     * is what pushes a mage to widen their vocabulary.
     */
    novelty: { domain: 'arcana', k: 16, c: 2, discovery: 30 },
    effects: [{ stat: 'spellPower', op: 'mult', value: 0, perLevel: 0.01 }],
    tierNames: [
      { level: 1, name: 'Speller' },
      { level: 20, name: 'Grammarian' },
      { level: 40, name: 'Rhetorician' },
      { level: 60, name: 'The Word Made Will' },
    ],
  },
  devotion: {
    id: 'devotion',
    name: 'Devotion',
    icon: '🙏',
    desc: 'Standing well with the divine. Litanies are given, never taken.',
    kind: 'passive',
    category: 'magic',
    progression: PROGRESSIONS.specialist,
    tags: ['divine'],
    unlock: [{ type: 'attr', attr: 'wis', level: 10 }],
    effects: [{ stat: 'maxSpirit', op: 'add', value: 0, perLevel: 0.5 }],
    tierNames: [
      { level: 1, name: 'Supplicant' },
      { level: 20, name: 'Acolyte' },
      { level: 40, name: 'Ordained' },
      { level: 60, name: 'Heard' },
    ],
  },
  psionics: {
    id: 'psionics',
    name: 'Psionics',
    icon: '🧠',
    desc: 'Pressure applied with the mind alone. More discipline buys more points to shape.',
    kind: 'passive',
    category: 'magic',
    progression: PROGRESSIONS.esoteric,
    tags: ['psionic'],
    unlock: [
      { type: 'attr', attr: 'int', level: 12 },
      { type: 'attr', attr: 'wis', level: 12 },
    ],
    effects: [{ stat: 'focusRegen', op: 'add', value: 0, perLevel: 0.01 }],
    tierNames: [
      { level: 1, name: 'Latent' },
      { level: 20, name: 'Awakened' },
      { level: 40, name: 'Disciplined' },
      { level: 60, name: 'Unbound Mind' },
    ],
  },

  // ---------- Environmental senses ----------
  darkvision: {
    id: 'darkvision',
    name: 'Darkvision',
    icon: '🌒',
    desc:
      'Eyes that stop insisting on the sun. Grows only in true dark, far from any hearth-light — ' +
      'and unpicks the night’s tax on your blade and your footwork, all of it gone by level 50.',
    kind: 'passive',
    category: 'environmental',
    progression: PROGRESSIONS.foundational,
    // Emitted solely by standing in natural darkness (systems/exposure.ts).
    tags: ['darkness'],
    unlock: [],
    // The combat penalty it erodes reaches zero exactly here (darknessFactor);
    // levels past it would buy nothing, so the ceiling says so.
    maxLevel: 50,
    tierNames: [
      { level: 1, name: 'Night-Squinter' },
      { level: 10, name: 'Low-Light Eyes' },
      { level: 25, name: 'Cat’s Custom' },
      { level: 50, name: 'Nothing Hides' },
    ],
  },

  weathersense: {
    id: 'weathersense',
    name: 'Weathersense',
    icon: '🌦️',
    desc:
      'Reading the sky forward. Manifests in the first severe weather that catches you outside, ' +
      'and learns best from storms it has not met and skies it has not stood under — two hours ' +
      'ahead at first, a whole week at its height, each new day arriving as a rough guess and ' +
      'sharpening into prognosis.',
    kind: 'passive',
    category: 'environmental',
    // Very slow on purpose: the sky gives up its grammar grudgingly.
    progression: PROGRESSIONS.esoteric,
    // Emitted by exposure.ts (standing under weather) and travel arrivals.
    tags: ['weather'],
    unlock: [],
    maxLevel: 30,
    /**
     * Semi-novelty: the watching trickle pays the floor, while each severe
     * KIND (wx:storm, wx:sandstorm…) and each region's skies (skies:<id>)
     * wear down separately — the first sandstorm is a curriculum, the tenth
     * is Tuesday. `discovery` waits on the chronicle: witnessing a NAMED
     * event will pay it outright.
     */
    novelty: { domain: 'weather', k: 15, c: 2, discovery: 25 },
    tierNames: [
      { level: 1, name: 'Sky-Glancer' },
      { level: 5, name: 'Cloud-Reader' },
      { level: 13, name: 'Front-Runner' },
      { level: 21, name: 'Storm-Cartographer' },
      { level: 29, name: 'Seven-Day Prophet' },
    ],
  },

  // ---------- Resistance skills (proto26, level by exposure) ----------
  heat_resistance: {
    id: 'heat_resistance',
    name: 'Heat Resistance',
    icon: '🌡️',
    desc: 'Resist fatigue from heat. Forged in fire — usually someone else’s.',
    kind: 'passive',
    category: 'resistance',
    progression: PROGRESSIONS.foundational,
    tags: ['resist:heat'],
    unlock: [],
    effects: [{ stat: 'resHeat', op: 'add', value: 0, levelCurve: 'resistTiered' }],
    tierNames: [
      { level: 1, name: 'Heat Adaptation' },
      { level: 20, name: 'Heat Resistance' },
      { level: 40, name: 'True Heat Resistance' },
      { level: 60, name: 'The Fire In Your Heart' },
    ],
  },
  cold_resistance: {
    id: 'cold_resistance',
    name: 'Cold Resistance',
    icon: '❄️',
    desc: 'Resist being exhausted in the cold.',
    kind: 'passive',
    category: 'resistance',
    progression: PROGRESSIONS.foundational,
    tags: ['resist:cold'],
    unlock: [],
    effects: [{ stat: 'resCold', op: 'add', value: 0, levelCurve: 'resistTiered' }],
    tierNames: [
      { level: 1, name: 'Cold Adaptation' },
      { level: 20, name: 'Cold Resistance' },
      { level: 40, name: 'Ice in Your Veins' },
      { level: 60, name: 'Colder Than Ice' },
    ],
  },
  poison_resistance: {
    id: 'poison_resistance',
    name: 'Poison Resistance',
    icon: '🧪',
    desc: 'Resist the effects of poisons, venom and toxins.',
    kind: 'passive',
    category: 'resistance',
    progression: PROGRESSIONS.foundational,
    tags: ['resist:poison'],
    unlock: [],
    effects: [{ stat: 'resPoison', op: 'add', value: 0, levelCurve: 'resistTiered' }],
    tierNames: [
      { level: 1, name: 'Poison Adaptation' },
      { level: 20, name: 'Accelerated Receptor Evolution' },
      { level: 40, name: 'Advanced Biochemical Resistance' },
      { level: 60, name: 'Absolute Antigen Production' },
    ],
  },
  water_resistance: {
    id: 'water_resistance',
    name: 'Water Resistance',
    icon: '💧',
    desc: 'Resist the wet, the current and the crushing wave. Rain is a patient teacher.',
    kind: 'passive',
    category: 'resistance',
    progression: PROGRESSIONS.foundational,
    tags: ['resist:water'],
    unlock: [],
    effects: [{ stat: 'resWater', op: 'add', value: 0, levelCurve: 'resistTiered' }],
    tierNames: [
      { level: 1, name: 'Water Adaptation' },
      { level: 20, name: 'Water Resistance' },
      { level: 40, name: 'Like Off a Duck' },
      { level: 60, name: 'The Sea Declines' },
    ],
  },
  wind_resistance: {
    id: 'wind_resistance',
    name: 'Wind Resistance',
    icon: '💨',
    desc: 'Resist gale and shear. Learned leaning into weather that wants you elsewhere.',
    kind: 'passive',
    category: 'resistance',
    progression: PROGRESSIONS.foundational,
    tags: ['resist:wind'],
    unlock: [],
    effects: [{ stat: 'resWind', op: 'add', value: 0, levelCurve: 'resistTiered' }],
    tierNames: [
      { level: 1, name: 'Wind Adaptation' },
      { level: 20, name: 'Wind Resistance' },
      { level: 40, name: 'Weathervane No More' },
      { level: 60, name: 'The Storm Walks Around You' },
    ],
  },
  earth_resistance: {
    id: 'earth_resistance',
    name: 'Earth Resistance',
    icon: '🪨',
    desc: 'Resist grit, stone and the ground’s own arguments. Sandstorms count.',
    kind: 'passive',
    category: 'resistance',
    progression: PROGRESSIONS.foundational,
    tags: ['resist:earth'],
    unlock: [],
    effects: [{ stat: 'resEarth', op: 'add', value: 0, levelCurve: 'resistTiered' }],
    tierNames: [
      { level: 1, name: 'Earth Adaptation' },
      { level: 20, name: 'Earth Resistance' },
      { level: 40, name: 'Unburied' },
      { level: 60, name: 'The Mountain Concedes' },
    ],
  },
  lightning_resistance: {
    id: 'lightning_resistance',
    name: 'Lightning Resistance',
    icon: '⚡',
    desc: 'Resist the sky’s temper. Best studied from inside a storm, worst studied twice.',
    kind: 'passive',
    category: 'resistance',
    progression: PROGRESSIONS.foundational,
    tags: ['resist:lightning'],
    unlock: [],
    effects: [{ stat: 'resLightning', op: 'add', value: 0, levelCurve: 'resistTiered' }],
    tierNames: [
      { level: 1, name: 'Lightning Adaptation' },
      { level: 20, name: 'Lightning Resistance' },
      { level: 40, name: 'Grounded' },
      { level: 60, name: 'The Bolt Apologizes' },
    ],
  },
  light_resistance: {
    id: 'light_resistance',
    name: 'Light Resistance',
    icon: '☀️',
    desc: 'Resist glare, radiance and the sanctified kind of brightness. Squinting, perfected.',
    kind: 'passive',
    category: 'resistance',
    progression: PROGRESSIONS.foundational,
    tags: ['resist:light'],
    unlock: [],
    effects: [{ stat: 'resLight', op: 'add', value: 0, levelCurve: 'resistTiered' }],
    tierNames: [
      { level: 1, name: 'Light Adaptation' },
      { level: 20, name: 'Light Resistance' },
      { level: 40, name: 'Unblinking' },
      { level: 60, name: 'Stared Down the Sun' },
    ],
  },
  dark_resistance: {
    id: 'dark_resistance',
    name: 'Dark Resistance',
    icon: '🌑',
    desc: 'Resist the umbral and the unlit — what the dark DOES, not what it hides. Seeing in it is Darkvision’s trade.',
    kind: 'passive',
    category: 'resistance',
    progression: PROGRESSIONS.foundational,
    tags: ['resist:dark'],
    unlock: [],
    effects: [{ stat: 'resDark', op: 'add', value: 0, levelCurve: 'resistTiered' }],
    tierNames: [
      { level: 1, name: 'Dark Adaptation' },
      { level: 20, name: 'Dark Resistance' },
      { level: 40, name: 'At Home in Shadow' },
      { level: 60, name: 'The Void Blinks First' },
    ],
  },
  arcane_resistance: {
    id: 'arcane_resistance',
    name: 'Arcane Resistance',
    icon: '🔮',
    desc: 'Resist raw magic. The hum of leyline and spellfire, taken as a seasoning.',
    kind: 'passive',
    category: 'resistance',
    progression: PROGRESSIONS.foundational,
    tags: ['resist:arcane'],
    unlock: [],
    effects: [{ stat: 'resArcane', op: 'add', value: 0, levelCurve: 'resistTiered' }],
    tierNames: [
      { level: 1, name: 'Arcane Adaptation' },
      { level: 20, name: 'Arcane Resistance' },
      { level: 40, name: 'Spell-Calloused' },
      { level: 60, name: 'Magic Asks Permission' },
    ],
  },

  // ---------- Crafting ----------
  smithing: {
    id: 'smithing',
    name: 'Smithing',
    icon: '⚒️',
    desc: 'The anvil’s song rewards patience. Craft faster with every piece.',
    kind: 'passive',
    category: 'craft',
    progression: PROGRESSIONS.specialist,
    tags: ['smithing'],
    unlock: [],
    effects: [{ stat: 'craftSpeed', op: 'mult', value: 0, perLevel: 0.01 }],
    tierNames: [
      { level: 1, name: 'Apprentice Smith' },
      { level: 20, name: 'Journeyman Smith' },
      { level: 40, name: 'Master Smith' },
      { level: 60, name: 'Forge Sage' },
    ],
    // Unscaled step-ups on top of the smooth per-level bonus. Sorted by level.
    milestones: [
      { level: 5, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.01 }] },
      { level: 10, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.02 }] },
      { level: 15, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.03 }] },
      { level: 20, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.04 }] },
      { level: 25, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.05 }] },
      { level: 30, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.06 }] },
      { level: 35, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.07 }] },
      { level: 40, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.08 }] },
      { level: 45, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.09 }] },
      { level: 50, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.10 }] },
      { level: 55, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.11 }] },
      { level: 60, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.12 }] },
      { level: 65, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.13 }] },
    ],
  },
  
   woodcutting: {
    id: 'woodcutting',
    name: 'Woodcutting',
    icon: '🪓',
    desc: 'Chop trees.',
    kind: 'passive',
    category: 'craft',
    progression: PROGRESSIONS.specialist,
    // Manifests at any gather site that emits 'mining' — NOT from crafting.
    tags: ['woodcutting'],
    unlock: [],
    effects: [{ stat: 'loot', op: 'mult', value: 0, perLevel: 0.01 }],
    tierNames: [
      { level: 1, name: 'Woodchuck' },
      { level: 20, name: 'Woodchucker' },
      { level: 40, name: 'Woodchuckest' },
      { level: 60, name: 'Deforester' },
    ],
    // Unscaled step-ups on top of the smooth per-level bonus. Sorted by level.
    milestones: [
      { level: 5, bonus: [{ stat: 'loot', op: 'add', value: 0.01 }] },
      { level: 10, bonus: [{ stat: 'loot', op: 'add', value: 0.02 }] },
      { level: 15, bonus: [{ stat: 'loot', op: 'add', value: 0.03 }] },
      { level: 20, bonus: [{ stat: 'loot', op: 'add', value: 0.04 }] },
      { level: 25, bonus: [{ stat: 'loot', op: 'add', value: 0.05 }] },
      { level: 30, bonus: [{ stat: 'loot', op: 'add', value: 0.06 }] },
      { level: 35, bonus: [{ stat: 'loot', op: 'add', value: 0.07 }] },
      { level: 40, bonus: [{ stat: 'loot', op: 'add', value: 0.08 }] },
      { level: 45, bonus: [{ stat: 'loot', op: 'add', value: 0.09 }] },
      { level: 50, bonus: [{ stat: 'loot', op: 'add', value: 0.10 }] },
      { level: 55, bonus: [{ stat: 'loot', op: 'add', value: 0.11 }] },
      { level: 60, bonus: [{ stat: 'loot', op: 'add', value: 0.12 }] },
      { level: 65, bonus: [{ stat: 'loot', op: 'add', value: 0.13 }] },
    ],
  },
  
   mining: {
    id: 'mining',
    name: 'Mining',
    icon: '⛏',
    desc: 'Dig. Dig. Dig through the mountains.',
    kind: 'passive',
    category: 'craft',
    progression: PROGRESSIONS.specialist,
    // Manifests at any gather site that emits 'mining' — NOT from crafting.
    tags: ['mining'],
    unlock: [],
    effects: [{ stat: 'loot', op: 'mult', value: 0, perLevel: 0.01 }],
    tierNames: [
      { level: 1, name: 'Junior Miner' },
      { level: 20, name: 'Senior Miner' },
      { level: 40, name: 'Deep Miner' },
      { level: 60, name: 'Dwarven Spirit' },
    ],
    // Unscaled step-ups on top of the smooth per-level bonus. Sorted by level.
    milestones: [
      { level: 5, bonus: [{ stat: 'loot', op: 'add', value: 0.01 }] },
      { level: 10, bonus: [{ stat: 'loot', op: 'add', value: 0.02 }] },
      { level: 15, bonus: [{ stat: 'loot', op: 'add', value: 0.03 }] },
      { level: 20, bonus: [{ stat: 'loot', op: 'add', value: 0.04 }] },
      { level: 25, bonus: [{ stat: 'loot', op: 'add', value: 0.05 }] },
      { level: 30, bonus: [{ stat: 'loot', op: 'add', value: 0.06 }] },
      { level: 35, bonus: [{ stat: 'loot', op: 'add', value: 0.07 }] },
      { level: 40, bonus: [{ stat: 'loot', op: 'add', value: 0.08 }] },
      { level: 45, bonus: [{ stat: 'loot', op: 'add', value: 0.09 }] },
      { level: 50, bonus: [{ stat: 'loot', op: 'add', value: 0.10 }] },
      { level: 55, bonus: [{ stat: 'loot', op: 'add', value: 0.11 }] },
      { level: 60, bonus: [{ stat: 'loot', op: 'add', value: 0.12 }] },
      { level: 65, bonus: [{ stat: 'loot', op: 'add', value: 0.13 }] },
    ],
  },
  
  
   herbalism: {
    id: 'herbalism',
    name: 'Herbalism',
    icon: '🌿',
    desc: 'Find only the best herbs you need for your concoctions.',
    kind: 'passive',
    category: 'craft',
    progression: PROGRESSIONS.specialist,
    tags: ['herbalism'],
    unlock: [],
    effects: [{ stat: 'loot', op: 'mult', value: 0, perLevel: 0.01 }],
    tierNames: [
      { level: 1, name: 'Hobbyist' },
      { level: 20, name: 'Devoted Gardener' },
      { level: 40, name: 'Herbsight' },
      { level: 60, name: 'Junior Druid' },
    ],
    // Unscaled step-ups on top of the smooth per-level bonus. Sorted by level.
    milestones: [
      { level: 5, bonus: [{ stat: 'loot', op: 'add', value: 0.01 }] },
      { level: 10, bonus: [{ stat: 'loot', op: 'add', value: 0.02 }] },
      { level: 15, bonus: [{ stat: 'loot', op: 'add', value: 0.03 }] },
      { level: 20, bonus: [{ stat: 'loot', op: 'add', value: 0.04 }] },
      { level: 25, bonus: [{ stat: 'loot', op: 'add', value: 0.05 }] },
      { level: 30, bonus: [{ stat: 'loot', op: 'add', value: 0.06 }] },
      { level: 35, bonus: [{ stat: 'loot', op: 'add', value: 0.07 }] },
      { level: 40, bonus: [{ stat: 'loot', op: 'add', value: 0.08 }] },
      { level: 45, bonus: [{ stat: 'loot', op: 'add', value: 0.09 }] },
      { level: 50, bonus: [{ stat: 'loot', op: 'add', value: 0.10 }] },
      { level: 55, bonus: [{ stat: 'loot', op: 'add', value: 0.11 }] },
      { level: 60, bonus: [{ stat: 'loot', op: 'add', value: 0.12 }] },
      { level: 65, bonus: [{ stat: 'loot', op: 'add', value: 0.13 }] },
    ],
  },
  
  cooking: {
    id: 'cooking',
    name: 'Cooking',
    icon: '🍳',
    desc: 'Heat, time and judgement. A better cook gets more out of the same basket.',
    kind: 'passive',
    category: 'craft',
    progression: PROGRESSIONS.specialist,
    tags: ['cooking'],
    unlock: [],
    effects: [{ stat: 'craftSpeed', op: 'mult', value: 0, perLevel: 0.008 }],
    tierNames: [
      { level: 1, name: 'Camp Cook' },
      { level: 8, name: 'Hearth Cook' },
      { level: 20, name: 'Kitchen Hand' },
      { level: 40, name: 'Chef' },
    ],
  },
  alchemy: {
    id: 'alchemy',
    name: 'Alchemy',
    icon: '⚗️',
    desc:
      'Sequence, and the nerve to write one down. Levels buy a longer sequence ' +
      'and a wider shelf — never a better brew, which is the sequence\'s business.',
    kind: 'passive',
    category: 'craft',
    progression: PROGRESSIONS.specialist,
    tags: ['alchemy'],
    unlock: [{ type: 'skill', id: 'herbalism', level: 3 }],
    // Alchemy makes what it makes; what levels buy is the room to sequence it.
    // The craftSpeed trickle is there so the skill is not inert between the
    // step unlocks that are its real progression.
    effects: [{ stat: 'craftSpeed', op: 'mult', value: 0, perLevel: 0.006 }],
    tierNames: [
      { level: 1, name: 'Pot-Boiler' },
      { level: 12, name: 'Apothecary' },
      { level: 30, name: 'Alchemist' },
      { level: 55, name: 'Adept of the Work' },
    ],
  },
  geneshaping: {
    id: 'geneshaping',
    name: 'Geneshaping',
    icon: '🧬',
    desc:
      'Reading what a body could have been, and talking it into being that instead. ' +
      'Levels sharpen what you can pull off a carcass and how far a bench can push a grade.',
    kind: 'passive',
    category: 'craft',
    // `esoteric` on purpose: it starts where other skills end and never eases.
    // The compounding lives in the DISCOVERY PAYOUT, where the player can see
    // it — a curve that quietly got cheaper would do the same arithmetic
    // invisibly, and invisible compounding rewards nothing. Do not pair this
    // with `insightful`, which already bends its own rate for the same reason.
    progression: PROGRESSIONS.esoteric,
    tags: ['geneshaping'],
    // Gated by the quest that opens the system, not by a skill condition —
    // state.mutagens.unlocked is the real door.
    unlock: [],
    // Hunting's shape at slightly longer odds, and a fatter discovery: genes
    // are rarer than kills and the whole point of the domain is filling in a
    // book nobody else has.
    novelty: { domain: 'geneshaping', k: 18, c: 2, discovery: 45 },
    effects: [{ stat: 'craftSpeed', op: 'mult', value: 0, perLevel: 0.006 }],
    tierNames: [
      { level: 1, name: 'Biomatter Harvester' },
      { level: 20, name: 'Mutation Documenter' },
      { level: 40, name: 'Master Geneshaper' },
      { level: 60, name: 'Life Transmuter' },
    ],
  },
  runecarving: {
    id: 'runecarving',
    name: 'Runecarving',
    icon: '💎️',
    desc: 'Precision work combining both the knowledge of magic and the delicacy of jewelcrafing.',
    kind: 'passive',
    category: 'craft',
    progression: PROGRESSIONS.perfectionist,
    tags: ['runecarving'],
    unlock: [],
    effects: [{ stat: 'craftSpeed', op: 'mult', value: 0, perLevel: 0.01 }],
    tierNames: [
      { level: 1, name: 'Apprentice Runecarver' },
      { level: 20, name: 'Journeyman Runecarver' },
      { level: 40, name: 'Master Runecarver' },
      { level: 60, name: 'One With The Runes' },
    ],
    // Unscaled step-ups on top of the smooth per-level bonus. Sorted by level.
    milestones: [
      { level: 5, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.01 }] },
      { level: 10, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.02 }] },
      { level: 15, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.03 }] },
      { level: 20, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.04 }] },
      { level: 25, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.05 }] },
      { level: 30, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.06 }] },
      { level: 35, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.07 }] },
      { level: 40, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.08 }] },
      { level: 45, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.09 }] },
      { level: 50, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.10 }] },
      { level: 55, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.11 }] },
      { level: 60, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.12 }] },
      { level: 65, bonus: [{ stat: 'craftSpeed', op: 'add', value: 0.13 }] },
    ],
  },

  // ---------- Weapon families (ported from proto26) ----------
  // Pattern: discovered by fighting with the matching weapon; bonuses only
  // apply while it's equipped (requiresTag). Tier names are cosmetic mastery
  // titles from proto26.
  unarmed_combat: {
    id: 'unarmed_combat',
    name: 'Unarmed Combat',
    icon: '👊',
    desc: 'The art of turning your body into a weapon.',
    kind: 'passive',
    category: 'combat',
    progression: PROGRESSIONS.simple,
    tags: ['combat', 'unarmed'],
    parent: 'fighting',
    unlock: [
      { type: 'skill', id: 'fighting', level: 3 },
      { type: 'equippedTag', tag: 'unarmed' },
    ],
    effects: [
      { stat: 'damage', op: 'mult', value: 0, perLevel: 0.02, requiresTag: 'unarmed' },
      { stat: 'attackSpeed', op: 'mult', value: 0, perLevel: 0.005, requiresTag: 'unarmed' },
    ],
    tierNames: [
      { level: 1, name: 'Unarmed Fighting' },
      { level: 20, name: 'Unarmed Combat' },
      { level: 40, name: 'Martial Arts' },
      { level: 60, name: 'Mind-Body Unity' },
    ],
  },
  dagger_combat: {
    id: 'dagger_combat',
    name: 'Dagger Combat',
    icon: '🔪',
    desc: 'The stealthy art of close-quarters stabbing.',
    kind: 'passive',
    category: 'combat',
    progression: PROGRESSIONS.simple,
    tags: ['combat', 'dagger'],
    parent: 'fighting',
    unlock: [
      { type: 'skill', id: 'fighting', level: 3 },
      { type: 'equippedTag', tag: 'dagger' },
    ],
    effects: [
      { stat: 'crit', op: 'add', value: 0, perLevel: 0.003, requiresTag: 'dagger' },
      { stat: 'damage', op: 'mult', value: 0, perLevel: 0.012, requiresTag: 'dagger' },
    ],
    tierNames: [
      { level: 1, name: 'Dagger Stabbing' },
      { level: 20, name: 'Dagger Combat' },
      { level: 40, name: "Assassin's Blade" },
      { level: 60, name: 'Phantom Edge' },
    ],
  },
  staff_combat: {
    id: 'staff_combat',
    name: 'Staff Combat',
    icon: '🪄',
    desc: 'The balanced art of pole fighting, often with magical affinity.',
    kind: 'passive',
    category: 'combat',
    progression: PROGRESSIONS.simple,
    tags: ['combat', 'staff'],
    parent: 'fighting',
    unlock: [
      { type: 'skill', id: 'fighting', level: 3 },
      { type: 'equippedTag', tag: 'staff' },
    ],
    effects: [
      { stat: 'damage', op: 'mult', value: 0, perLevel: 0.01, requiresTag: 'staff' },
      { stat: 'spellPower', op: 'mult', value: 0, perLevel: 0.012, requiresTag: 'staff' },
    ],
    tierNames: [
      { level: 1, name: 'Staff Twirling' },
      { level: 20, name: 'Staff Combat' },
      { level: 40, name: 'Bo Staff Mastery' },
      { level: 60, name: 'Arcane Pole Harmony' },
    ],
  },
  club_combat: {
    id: 'club_combat',
    name: 'Club Combat',
    icon: '🏏',
    desc: 'The primal art of bludgeoning foes.',
    kind: 'passive',
    category: 'combat',
    progression: PROGRESSIONS.simple,
    tags: ['combat', 'blunt'],
    parent: 'fighting',
    unlock: [
      { type: 'skill', id: 'fighting', level: 3 },
      { type: 'equippedTag', tag: 'blunt' },
    ],
    effects: [
      { stat: 'damage', op: 'mult', value: 0, perLevel: 0.016, requiresTag: 'blunt' },
      { stat: 'armor', op: 'add', value: 0, perLevel: 0.05, requiresTag: 'blunt' },
    ],
    tierNames: [
      { level: 1, name: 'Club Swinging' },
      { level: 20, name: 'Club Combat' },
      { level: 40, name: 'Mace Mastery' },
      { level: 60, name: 'Earth Shaker' },
    ],
  },
  greatsword_combat: {
    id: 'greatsword_combat',
    name: 'Greatsword Combat',
    icon: '⚔️',
    desc: 'The powerful art of two-handed sword fighting.',
    kind: 'passive',
    category: 'combat',
    progression: PROGRESSIONS.simple,
    tags: ['combat', 'greatsword'],
    parent: 'fighting',
    unlock: [
      { type: 'skill', id: 'fighting', level: 8 },
      { type: 'equippedTag', tag: 'greatsword' },
    ],
    effects: [
      { stat: 'damage', op: 'mult', value: 0, perLevel: 0.018, requiresTag: 'greatsword' },
      { stat: 'crit', op: 'add', value: 0, perLevel: 0.0015, requiresTag: 'greatsword' },
    ],
    tierNames: [
      { level: 1, name: 'Greatsword Wielding' },
      { level: 20, name: 'Greatsword Combat' },
      { level: 40, name: 'Claymore Mastery' },
      { level: 60, name: "Titan's Blade" },
    ],
  },
  spear_combat: {
    id: 'spear_combat',
    name: 'Spear Combat',
    icon: '🔱️',
    desc: 'The powerful art of two-handed sword fighting.',
    kind: 'passive',
    category: 'combat',
    progression: PROGRESSIONS.simple,
    tags: ['combat', 'spear'],
    parent: 'fighting',
    unlock: [
      { type: 'skill', id: 'fighting', level: 8 },
      { type: 'equippedTag', tag: 'spear' },
    ],
    effects: [
      { stat: 'attackSpeed', op: 'mult', value: 0, perLevel: 0.018, requiresTag: 'spear' },
      { stat: 'crit', op: 'add', value: 0, perLevel: 0.0015, requiresTag: 'spear' },
    ],
    tierNames: [
      { level: 1, name: 'Spearbearer' },
      { level: 20, name: 'Hussar' },
      { level: 40, name: 'Phalanx' },
      { level: 60, name: "Odin's Spear" },
    ],
  },
  bow_combat: {
    id: 'bow_combat',
    name: 'Bow Combat',
    icon: '🏹',
    desc: 'Strike from distance before they know you are there.',
    kind: 'passive',
    category: 'combat',
    progression: PROGRESSIONS.simple,
    tags: ['combat', 'bow'],
    parent: 'fighting',
    unlock: [
      { type: 'skill', id: 'fighting', level: 3 },
      { type: 'equippedTag', tag: 'bow' },
    ],
    effects: [
      { stat: 'crit', op: 'add', value: 0, perLevel: 0.002, requiresTag: 'bow' },
      { stat: 'dodge', op: 'add', value: 0, perLevel: 0.002, requiresTag: 'bow' },
      { stat: 'damage', op: 'mult', value: 0, perLevel: 0.01, requiresTag: 'bow' },
    ],
    tierNames: [
      { level: 1, name: 'Bow Handling' },
      { level: 20, name: 'Bow Combat' },
      { level: 40, name: "Marksman's Eye" },
      { level: 60, name: 'Storm of Arrows' },
    ],
  },
  /**
   * The parry line. Dodge is trained by DEX and any evasive fighting; armor by
   * CON and Shield Combat; parry had nothing until this — it was a stat you
   * could only BUY, on two items and one katana school.
   *
   * Deflection is deliberately not a weapon family: it keys on 'parrying', the
   * tag worn by anything built to catch someone else's edge (parrying dagger,
   * buckler, rapier). Carry one of those and every fight trains it, whatever
   * stance you are in. Its second effect is the riposte: turning the blade
   * aside is the beginner's half, making them pay for it is the rest.
   */
  deflection: {
    id: 'deflection',
    name: 'Deflection',
    icon: '🛡️',
    desc: 'Reading an incoming edge and putting steel across its path — then answering before they recover.',
    kind: 'passive',
    category: 'combat',
    progression: PROGRESSIONS.specialist,
    tags: ['parrying'],
    parent: 'fighting',
    unlock: [
      { type: 'skill', id: 'fighting', level: 5 },
      { type: 'equippedTag', tag: 'parrying' },
    ],
    effects: [
      { stat: 'parry', op: 'add', value: 0, perLevel: 0.002, requiresTag: 'parrying' },
      { stat: 'riposte', op: 'add', value: 0, perLevel: 0.006, requiresTag: 'parrying' },
    ],
    tierNames: [
      { level: 1, name: 'Catching Blades' },
      { level: 20, name: 'Deflection' },
      { level: 40, name: 'Blade Reader' },
      { level: 60, name: 'Nothing Lands' },
    ],
  },
  // ---------- Weapon schools (manifest by fighting in the stance they upgrade) ----------
  school_ittou_ryu: {
    id: 'school_ittou_ryu',
    name: 'Ittou-ryu',
    icon: '⚔️',
    desc: 'The school of the single stroke. One cut, one kill.',
    kind: 'passive',
    category: 'combat',
    progression: PROGRESSIONS.esoteric,
    parent: 'swordsmanship',
    tags: ['style:quick', 'style:ittou_ryu_style'],
    unlock: [
      { type: 'skill', id: 'swordsmanship', level: 25 },
      { type: 'attr', attr: 'dex', level: 20 },
      { type: 'equippedTag', tag: 'katana' },
    ],
    effects: [
      { stat: 'crit', op: 'add', value: 0.05, perLevel: 0.004, requiresStyle: 'ittou_ryu_style', requiresTag: 'katana' },
      { stat: 'damage', op: 'mult', value: 0.05, perLevel: 0.02, requiresStyle: 'ittou_ryu_style', requiresTag: 'katana' },
    ],
	tierNames: [
      { level: 1, name: 'Itto-ryu Initiate' },
      { level: 20, name: 'Itto-ryu Adept' },
      { level: 40, name: 'Itto-ryu Master' },
      { level: 60, name: 'Ittosai\'s Second Descent' },
    ],
  },
  school_jigen_ryu: {
    id: 'school_jigen_ryu',
    name: 'Jigen-ryu',
    icon: '⚡',
    desc: 'The doctrine of the single overwhelming strike. Studying it transforms your Crush stance.',
    kind: 'passive',
    category: 'combat',
    progression: PROGRESSIONS.esoteric,
    parent: 'swordsmanship',
    // Discovery is stance-gated like every other school; the katana requirement
    // lives in `unlock`, so listing it here would let any katana fight in any
    // stance manifest the school.
    tags: ['style:crush', 'style:jigen_ryu'],
    unlock: [
      { type: 'skill', id: 'swordsmanship', level: 15 },
      { type: 'attr', attr: 'str', level: 30 },
      { type: 'equippedTag', tag: 'katana' },
    ],
    effects: [{ stat: 'damage', op: 'mult', value: 0, perLevel: 0.005, requiresStyle: 'jigen_ryu', requiresTag: 'katana'  }],
    tierNames: [
      { level: 1, name: 'Jigen-ryu Initiate' },
      { level: 20, name: 'Jigen-ryu Adept' },
      { level: 40, name: 'Jigen-ryu Master' },
      { level: 60, name: 'The First Strike Is the Last' },
    ],
  },
  school_niten_ichi: {
    id: 'school_niten_ichi',
    name: 'Niten-Ichi-ryu',
    icon: '🗡️',
    desc: 'Two heavens, one will. Studying it transforms your Flurry stance.',
    kind: 'passive',
    category: 'combat',
    progression: PROGRESSIONS.esoteric,
    parent: 'swordsmanship',
    tags: ['style:multi', 'style:niten_ichi_ryu'],
    unlock: [
      { type: 'skill', id: 'swordsmanship', level: 25 },
      { type: 'attr', attr: 'dex', level: 35 },
      { type: 'equippedTag', tag: 'katana' },
    ],
    effects: [
      { stat: 'parry', op: 'add', value: 0, perLevel: 0.0015, requiresStyle: 'niten_ichi_ryu', requiresTag: 'katana' },
      { stat: 'riposte', op: 'add', value: 0, perLevel: 0.004, requiresStyle: 'niten_ichi_ryu', requiresTag: 'katana' },
    ],
    tierNames: [
      { level: 1, name: 'Two-Sword Novice' },
      { level: 20, name: 'Niten Adept' },
      { level: 40, name: 'Twin Heavens' },
      { level: 60, name: 'Both Blades, One Will' },
    ],
  },
  school_eishin: {
    id: 'school_eishin',
    name: 'Eishin-ryu',
    icon: '🌙',
    desc: 'The cut that begins inside the scabbard. Studying it transforms your Finesse stance.',
    kind: 'passive',
    category: 'combat',
    progression: PROGRESSIONS.esoteric,
    parent: 'swordsmanship',
    tags: ['style:finesse', 'style:eishin_ryu'],
    unlock: [
      { type: 'skill', id: 'swordsmanship', level: 20 },
      { type: 'attr', attr: 'dex', level: 40 },
      { type: 'equippedTag', tag: 'katana' },
    ],
    effects: [{ stat: 'crit', op: 'add', value: 0, perLevel: 0.0015, requiresStyle: 'eishin_ryu' , requiresTag: 'katana'}],
    tierNames: [
      { level: 1, name: 'Eishin Student' },
      { level: 20, name: 'Eishin Adept' },
      { level: 40, name: 'Eishin Master' },
      { level: 60, name: 'Draw Without Drawing' },
    ],
  },
  /**
   * The two parry schools — the European answer to Niten-Ichi, and the reason
   * parry is no longer a katana stat. Each takes a DEFENSIVE stance's slot,
   * which is the whole argument for them: Evasive and Brace are the two ways of
   * surviving a blow that the grid already has, and these are the versions of
   * each that hit back.
   */
  school_destreza: {
    id: 'school_destreza',
    name: 'Destreza',
    icon: '🤺',
    desc: 'The true art of the circle: the point covers the line. Studying it transforms your Evasive stance.',
    kind: 'passive',
    category: 'combat',
    progression: PROGRESSIONS.esoteric,
    parent: 'swordsmanship',
    tags: ['style:evasive', 'style:destreza'],
    unlock: [
      { type: 'skill', id: 'swordsmanship', level: 18 },
      { type: 'skill', id: 'deflection', level: 10 },
      { type: 'attr', attr: 'dex', level: 30 },
      { type: 'equippedTag', tag: 'rapier' },
    ],
    effects: [
      { stat: 'parry', op: 'add', value: 0, perLevel: 0.002, requiresStyle: 'destreza' },
      { stat: 'riposte', op: 'add', value: 0, perLevel: 0.008, requiresStyle: 'destreza' },
    ],
    tierNames: [
      { level: 1, name: 'Student of the Circle' },
      { level: 20, name: 'Diestro' },
      { level: 40, name: 'Master of the True Art' },
      { level: 60, name: 'The Point Covers Everything' },
    ],
  },
  school_bolognese: {
    id: 'school_bolognese',
    name: 'Bolognese',
    icon: '🔰',
    desc: 'Sword and buckler as one instrument: catch, bind, and strike from the bind. Studying it transforms your Brace stance.',
    kind: 'passive',
    category: 'combat',
    progression: PROGRESSIONS.esoteric,
    parent: 'shield_combat',
    tags: ['style:defensive', 'style:bolognese'],
    unlock: [
      { type: 'skill', id: 'shield_combat', level: 15 },
      { type: 'skill', id: 'swordsmanship', level: 12 },
      { type: 'skill', id: 'deflection', level: 8 },
      { type: 'attr', attr: 'dex', level: 20 },
      { type: 'equippedTag', tag: 'sword' },
      { type: 'equippedTag', tag: 'buckler' },
    ],
    effects: [
      { stat: 'parry', op: 'add', value: 0, perLevel: 0.0015, requiresStyle: 'bolognese' },
      { stat: 'riposte', op: 'add', value: 0, perLevel: 0.005, requiresStyle: 'bolognese' },
    ],
    tierNames: [
      { level: 1, name: 'Buckler Bearer' },
      { level: 20, name: 'Player of the Bind' },
      { level: 40, name: 'Bolognese Master' },
      { level: 60, name: 'Two Hands, One Guard' },
    ],
  },
  // The magiknight seam: a school whose exertion burns MANA, not sweat.
  school_magic_combat: {
    id: 'school_magic_combat',
    name: 'Magic Combat',
    icon: '🔮',
    desc: 'The blade as a wand that happens to have an edge. Studying it transforms your Finesse stance to draw on mana instead of breath.',
    kind: 'passive',
    category: 'combat',
    progression: PROGRESSIONS.esoteric,
    parent: 'fighting',
    tags: ['style:finesse', 'style:magic_combat', 'magic'],
    unlock: [
      { type: 'skill', id: 'fighting', level: 10 },
      { type: 'skill', id: 'magic', level: 10 },
      { type: 'attr', attr: 'int', level: 20 },
    ],
    effects: [
      { stat: 'damage', op: 'mult', value: 0, perLevel: 0.008, requiresStyle: 'magic_combat' },
    ],
    tierNames: [
      { level: 1, name: 'Spellblade Novice' },
      { level: 20, name: 'Spellblade' },
      { level: 40, name: 'War Mage' },
      { level: 60, name: 'The Edge Is a Detail' },
    ],
  },
  school_boxing: {
    id: 'school_boxing',
    name: 'Boxing',
    icon: '🥊',
    desc: 'The sweet science. Studying it transforms your Evasive stance.',
    kind: 'passive',
    category: 'combat',
    progression: PROGRESSIONS.esoteric,
    parent: 'unarmed_combat',
    tags: ['style:evasive', 'style:boxing'],
    unlock: [
      { type: 'skill', id: 'unarmed_combat', level: 20 },
      { type: 'attr', attr: 'str', level: 30 },
      { type: 'attr', attr: 'con', level: 25 },
      { type: 'equippedTag', tag: 'unarmed' },
    ],
    effects: [
      { stat: 'attackSpeed', op: 'mult', value: 0, perLevel: 0.003, requiresStyle: 'boxing' },
      { stat: 'dodge', op: 'add', value: 0, perLevel: 0.001, requiresStyle: 'boxing' },
    ],
    tierNames: [
      { level: 1, name: 'Amateur Boxer' },
      { level: 20, name: 'Contender' },
      { level: 40, name: 'Champion' },
      { level: 60, name: 'Pound for Pound' },
    ],
  },
  school_taekwondo: {
    id: 'school_taekwondo',
    name: 'Taekwondo',
    icon: '🦵',
    desc: 'Swift and powerful kicks. Studying it transforms your Flurry stance.',
    kind: 'passive',
    category: 'combat',
    progression: PROGRESSIONS.esoteric,
    parent: 'unarmed_combat',
    tags: ['style:multi', 'style:taekwondo'],
    unlock: [
      { type: 'skill', id: 'unarmed_combat', level: 25 },
      { type: 'attr', attr: 'dex', level: 40 },
      { type: 'equippedTag', tag: 'unarmed' },
    ],
    effects: [{ stat: 'dodge', op: 'add', value: 0, perLevel: 0.0015, requiresStyle: 'taekwondo' }],
    tierNames: [
      { level: 1, name: 'White Belt' },
      { level: 20, name: 'Black Belt' },
      { level: 40, name: 'Master Kicker' },
      { level: 60, name: 'Storm of Heels' },
    ],
  },
  school_muay_thai: {
    id: 'school_muay_thai',
    name: 'Muay Thai',
    icon: '🐘',
    desc: 'Eight deadly limbs. Studying it transforms your Crush stance.',
    kind: 'passive',
    category: 'combat',
    progression: PROGRESSIONS.esoteric,
    parent: 'unarmed_combat',
    tags: ['style:crush', 'style:muay_thai'],
    unlock: [
      { type: 'skill', id: 'unarmed_combat', level: 35 },
      { type: 'attr', attr: 'str', level: 40 },
      { type: 'attr', attr: 'con', level: 40 },
      { type: 'equippedTag', tag: 'unarmed' },
    ],
    effects: [{ stat: 'damage', op: 'mult', value: 0, perLevel: 0.005, requiresStyle: 'muay_thai' }],
    tierNames: [
      { level: 1, name: 'Nak Muay' },
      { level: 20, name: 'Clinch Fighter' },
      { level: 40, name: 'Eight Limbs' },
      { level: 60, name: 'Art of Eight Limbs' },
    ],
  },
  school_wrestling: {
    id: 'school_wrestling',
    name: 'Wrestling',
    icon: '🤼',
    desc: 'Control, leverage, and theatrical suplexes. Studying it transforms your Brace stance.',
    kind: 'passive',
    category: 'combat',
    progression: PROGRESSIONS.esoteric,
    parent: 'unarmed_combat',
    tags: ['style:defensive', 'style:wrestling'],
    unlock: [
      { type: 'skill', id: 'unarmed_combat', level: 20 },
      { type: 'attr', attr: 'str', level: 40 },
      { type: 'attr', attr: 'cha', level: 30 },
      { type: 'equippedTag', tag: 'unarmed' },
    ],
    effects: [{ stat: 'maxHp', op: 'add', value: 0, perLevel: 0.8, requiresStyle: 'wrestling' }],
    tierNames: [
      { level: 1, name: 'Grappler' },
      { level: 20, name: 'Suplex Artist' },
      { level: 40, name: 'Heavyweight' },
      { level: 60, name: 'The Immovable' },
    ],
  },

  shield_combat: {
    id: 'shield_combat',
    name: 'Shield Combat',
    icon: '🛡️',
    desc: 'The defensive art of blocking and bashing with shields.',
    kind: 'passive',
    category: 'combat',
    progression: PROGRESSIONS.simple,
    tags: ['combat', 'shield'],
    parent: 'fighting',
    unlock: [
      { type: 'skill', id: 'fighting', level: 3 },
      { type: 'equippedTag', tag: 'shield' },
    ],
    effects: [
      { stat: 'armor', op: 'mult', value: 0, perLevel: 0.02, requiresTag: 'shield' },
      { stat: 'maxHp', op: 'add', value: 0, perLevel: 1, requiresTag: 'shield' },
    ],
    tierNames: [
      { level: 1, name: 'Shield Bearing' },
      { level: 20, name: 'Shield Combat' },
      { level: 40, name: 'Buckler Mastery' },
      { level: 60, name: 'Aegis Guardian' },
    ],
  },
  leathercrafting: {
    id: 'leathercrafting',
    name: 'Leathercrafting',
    icon: '📦',
    desc: 'the ability to craft leather items',
    kind: 'passive',
    category: 'craft',
    progression: PROGRESSIONS.perfectionist,
    tags: ['leatherwork'],
    unlock: [],
    // Scoped: this speeds up leatherwork and leaves the anvil alone. Plain
    // `craftSpeed` here would have made a leatherworker a better smith.
    effects: [
      { stat: 'craftSpeed:leatherwork', op: 'mult', value: 0, perLevel: 0.01 },
    ],
    tierNames: [
      { level: 1, name: 'Novice Leatherworker' },
      { level: 21, name: 'Adept Leatherworker' },
      { level: 41, name: 'Professional Leatherworker' },
      { level: 61, name: 'Master Leatherworker' },
    ],
  },
  school_capoeira: {
    id: 'school_capoeira',
    name: 'Capoeira',
    icon: '🦵',
    desc: 'Swift and powerful kicks. Studying it transforms your Quick stance.',
    kind: 'passive',
    category: 'combat',
    parent: 'unarmed_combat',
    tags: ['style:multi', 'style:capoeira'],
    unlock: [
      { type: 'skill', id: 'unarmed_combat', level: 25 },
      { type: 'attr', attr: 'dex', level: 40 },
      { type: 'equippedTag', tag: 'unarmed' },
      { type: 'stat', key: 'combat:dodges', value: 100 },
    ],
    effects: [
      { stat: 'dodge', op: 'add', value: 0, perLevel: 0.0015, requiresStyle: 'capoeira' },
    ],
    tierNames: [
      { level: 1, name: 'Aluno' },
      { level: 20, name: 'Graduado' },
      { level: 40, name: 'Professor' },
      { level: 60, name: 'Mestre' },
    ],
  },
  school_eskrima: {
    id: 'school_eskrima',
    name: 'Eskrima',
    icon: '📦',
    desc: 'Placeholder. //TODO: Continue filling out',
    kind: 'passive',
    category: 'combat',
    tags: ['dagger'],
    unlock: [
      { type: 'skill', id: 'dagger_combat', level: 25 },
      { type: 'equippedTag', tag: 'dagger' },
      { type: 'attr', attr: 'dex', level: 30 },
    ],
    // TODO: bonuses. Each needs stat/op/value alongside the requiresTag —
    // `{ stat: 'crit', op: 'add', value: 0, perLevel: 0.002, requiresTag: 'dagger' }`.
    effects: [],
    parent: 'dagger_combat',
    tierNames: [
      { level: 1, name: 'Antas Isa' },
      { level: 21, name: 'Tagasanay ' },
      { level: 41, name: 'Guro Lakan' },
      { level: 61, name: 'Punong Guro' },
    ],
  },
};

/**
 * Every skill: the hand-written tree, plus one generated per arcane word.
 *
 * Words live in the lexicon rather than here (see data/wordskills.data.ts) —
 * writing a word into ARCANE_WORDS is meant to be the whole of adding it, and
 * a vocabulary of forty entries copied out by hand would rot the first time
 * one was renamed.
 */
export const SKILLS: Record<string, SkillDef> = { ...HAND_WRITTEN, ...WORD_SKILLS };
