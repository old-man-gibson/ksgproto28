import type {
  ArcaneWordDef,
  MiracleDef,
  PsiAxisId,
  PsiQuantityDef,
  PsiQuantityId,
  PsionicAxisDef,
  PsionicRecognitionDef,
} from '../types';
import { prose } from '../text/prose';
import { ARCANE_WORDS_TEXT, MIRACLES_TEXT, PSI_AXES_TEXT, PSI_QUANTITIES_TEXT, PSI_RECOGNITIONS_TEXT } from '../text/spellcraft.text';

/**
 * Spellcraft content: the arcane lexicon, the divine litanies, and the psionic
 * tuning constants. Three schools, three grammars — what they share is the
 * SpellSpec they compile into (see systems/spellcraft.ts), not any of this.
 *
 * ARCANE words are stated at their baseline: a noun's `power` is what it deals
 * cast bare, in spell-power multiples, before word order, verbs and adverbs
 * have their say. Everything the composer does to these numbers is
 * deterministic — two mages who speak the same sentence get the same spell.
 */

export const ARCANE_WORDS = prose<ArcaneWordDef>('ARCANE_WORDS', ARCANE_WORDS_TEXT, {
  // ----- Nouns: the substance spoken into being -----
  fire: {
    id: 'fire',
    word: 'fire',
    stacked: ['flame', 'blaze'],
    kind: 'noun',
    icon: '🔥',
    mana: 2,
    element: 'heat',
    power: 1.0,
    inflicts: [{ id: 'on_fire', intensity: 1, chance: 0.35 }],
  },
  ice: {
    id: 'ice',
    word: 'ice',
    stacked: ['frost', 'glacier'],
    kind: 'noun',
    icon: '❄️',
    mana: 2,
    element: 'cold',
    power: 0.9,
    inflicts: [{ id: 'chilled', intensity: 1, chance: 0.4 }],
  },
  spark: {
    id: 'spark',
    word: 'spark',
    stacked: ['arc', 'bolt'],
    kind: 'noun',
    icon: '⚡',
    minLevel: 3,
    mana: 2,
    element: 'lightning',
    power: 0.85,
    inflicts: [{ id: 'jolted', intensity: 1, chance: 0.3 }],
  },
  water: {
    id: 'water',
    word: 'water',
    stacked: ['torrent', 'deluge'],
    kind: 'noun',
    icon: '💧',
    minLevel: 4,
    mana: 2,
    element: 'water',
    power: 0.8,
    inflicts: [{ id: 'wet', intensity: 1, chance: 0.5 }],
  },
  stone: {
    id: 'stone',
    word: 'stone',
    stacked: ['boulder', 'mountain'],
    kind: 'noun',
    icon: '🪨',
    minLevel: 5,
    mana: 3,
    element: 'earth',
    power: 1.15,
    inflicts: [{ id: 'shardbound', intensity: 1, chance: 0.3 }],
  },
  gust: {
    id: 'gust',
    word: 'gust',
    stacked: ['wind', 'storm'],
    kind: 'noun',
    icon: '💨',
    minLevel: 4,
    mana: 2,
    element: 'wind',
    power: 0.85,
    inflicts: [{ id: 'buffeted', intensity: 1, chance: 0.25 }],
  },
  seed: {
    id: 'seed',
    word: 'seed',
    stacked: ['bramble', 'wildwood'],
    kind: 'noun',
    icon: '🌱',
    minLevel: 5,
    mana: 2,
    // Poison-typed the way iron's magnetism is piercing-typed: a noun may own a
    // condition without owning a damage type of its own.
    element: 'poison',
    power: 0.7,
    inflicts: [{ id: 'seeded', intensity: 1, chance: 0.5 }],
  },
  iron: {
    id: 'iron',
    word: 'iron',
    stacked: ['steel', 'adamant'],
    kind: 'noun',
    icon: '📌',
    minLevel: 11,
    mana: 2,
    element: 'piercing',
    power: 0.9,
    inflicts: [{ id: 'magnetized', intensity: 1, chance: 0.35 }],
  },
  venom: {
    id: 'venom',
    word: 'venom',
    stacked: ['toxin', 'plague'],
    kind: 'noun',
    icon: '🐍',
    minLevel: 6,
    mana: 2,
    element: 'poison',
    power: 0.7,
    inflicts: [{ id: 'poison', intensity: 1, chance: 0.6 }],
  },
  acid: {
    id: 'acid',
    word: 'acid',
    stacked: ['corrosion', 'liquefaction'],
    kind: 'noun',
    icon: '🧪',
    minLevel: 6,
    mana: 2,
    element: 'acid',
    power: 0.7,
    inflicts: [{ id: 'corroded', intensity: 1, chance: 1 }],
  },
  light: {
    id: 'light',
    word: 'light',
    stacked: ['radiance', 'sun'],
    kind: 'noun',
    icon: '☀️',
    minLevel: 8,
    mana: 3,
    element: 'light',
    power: 0.9,
    inflicts: [{ id: 'dazzled', intensity: 1, chance: 0.3 }],
  },
  gloom: {
    id: 'gloom',
    word: 'gloom',
    stacked: ['dusk', 'abyss'],
    kind: 'noun',
    icon: '🌑',
    minLevel: 8,
    mana: 3,
    element: 'dark',
    power: 1.0,
    inflicts: [{ id: 'tainted', intensity: 1, chance: 0.15 }],
  },
  zero: {
    id: 'zero',
    word: 'zero',
    stacked: ['naught', 'null'],
    kind: 'noun',
    icon: '⭕',
    minLevel: 10,
    mana: 2,
    element: 'arcane',
    untyped: true,
    power: 1.0,
  },
  arcane: {
    id: 'arcane',
    word: 'arcane',
    stacked: ['eldritch', 'anathema'],
    kind: 'noun',
    icon: '🔮',
    minLevel: 13,
    mana: 3,
    element: 'arcane',
    power: 0.9,
    inflicts: [{ id: 'unravelling', intensity: 1, chance: 0.5 }],
  },


  // ----- Verbs: what the substance is made to DO, can exist on his own -----
  /*
   * The physical triangle. Cut, crush and pierce are the three ways to
   * deliver ANY substance, and each buys one leg at the other two's expense:
   *
   *   cut    — delivers deeply. Conditions take hold far more readily,
   *            the blow itself lands softest, nothing is bypassed.
   *   crush  — delivers hardest. The most damage of the three, and the
   *            substance barely takes hold; guard is met head on.
   *   pierce — delivers precisely. Guard means much less to it, at the
   *            cost of both weight and hold.
   *
   * So "fire cut one" burns readily and hits softly; "fire crush one" is
   * the biggest number; "fire pierce one" goes through what the others
   * cannot. Spoken bare, each is its own physical substance.
   */
  cut: {
    id: 'cut',
    word: 'cut',
    stacked: ['gash', 'sunder'],
    kind: 'verb',
    icon: '🔪',
    minLevel: 9,
    mana: 2,
    verb: {
      powerMult: 0.8,
      barePower: 0.55,
      statusRate: 2.2,
      bareType: 'slashing',
      bareInflicts: [{ id: 'bleeding', intensity: 1, chance: 0.4 }],
    },
  },
  crush: {
    id: 'crush',
    word: 'crush',
    stacked: ['crumple', 'implode'],
    kind: 'verb',
    icon: '🔨',
    minLevel: 9,
    mana: 2,
    verb: {
      powerMult: 1.3,
      barePower: 0.7,
      statusRate: 0.45,
      bareType: 'bludgeoning',
      bareInflicts: [{ id: 'concussed', intensity: 1, chance: 0.4 }],
    },
  },
  pierce: {
    id: 'pierce',
    word: 'pierce',
    stacked: ['impale', 'skewer'],
    kind: 'verb',
    icon: '🎯',
    mana: 1,
    verb: {
      powerMult: 0.95,
      barePower: 0.5,
      penetration: 0.35,
      statusRate: 0.6,
      bareType: 'piercing',
      bareInflicts: [{ id: 'punctured', intensity: 1, chance: 0.4 }],
    },
  },
  fly: {
    id: 'fly',
    word: 'fly',
    stacked: ['dart', 'blink'],
    kind: 'verb',
    icon: '🕊️',
    mana: 1,
    verb: { powerMult: 0.9, barePower: 0.4, cooldownMult: 0.75 },
  },
  expand: {
    id: 'expand',
    word: 'expand',
    stacked: ['engulf', 'everything'],
    kind: 'verb',
    icon: '💥',
    minLevel: 4,
    mana: 2,
    verb: { powerMult: 0.85, barePower: 0.4, splash: 0.5 },
  },
  burst: {
    id: 'burst',
    word: 'burst',
    stacked: ['erupt', 'detonate'],
    kind: 'verb',
    icon: '🎆',
    minLevel: 6,
    mana: 2,
    verb: { powerMult: 1.35, barePower: 0.6, cooldownMult: 1.3 },
  },
  grasp: {
    id: 'grasp',
    word: 'grasp',
    stacked: ['clutch', 'strangle'],
    kind: 'verb',
    icon: '🫳',
    minLevel: 8,
    mana: 2,
    verb: { powerMult: 0.6, barePower: 0.3, gripMult: 2.0 },
  },
  ward: {
    id: 'ward',
    word: 'ward',
    stacked: ['bulwark', 'sanctum'],
    kind: 'verb',
    icon: '🛡️',
    minLevel: 5,
    mana: 2,
    verb: { ward: { amount: 0.15, duration: 300 } },
  },
  mend: {
    id: 'mend',
    word: 'mend',
    stacked: ['knit', 'renew'],
    kind: 'verb',
    icon: '💚',
    minLevel: 7,
    mana: 3,
    verb: { restore: 1.0 },
  },
  /*
   * The unmaking. A clause that undoes neither strikes, mends nor wards: the
   * whole working becomes a COUNTERSPELL, held like a trap and sprung inside
   * an enemy's casting (see arcane.ts `counterEfficiency` for the matching
   * and combat.ts for the spring). Its noun tunes it — "fire undo" answers
   * fire best — and deepening buys efficiency rather than burn: the burn
   * follows the efficiency, so the better the answer, the harder it burns.
   */
  undo: {
    id: 'undo',
    word: 'undo',
    stacked: ['unsay', 'unmake'],
    kind: 'verb',
    icon: '↩️',
    minLevel: 10,
    mana: 3,
    verb: { undo: { burn: 1 }, cooldownMult: 1.2 },
  },

  // ----- Adverbs: how it is spoken -----
  slowly: {
    id: 'slowly',
    word: 'slowly',
    stacked: ['dragging', 'glacial'],
    kind: 'adverb',
    icon: '🐢',
    mana: 1,
    adverb: {
      powerMult: 1.4,
      cooldownMult: 1.5,
      manaMult: 1.2,
      // Leading: a long burn at full rate (damage). Trailing: an even longer
      // presence at a third the bite (uptime for the logic words).
      clock: { lead: { dur: 2, rate: 1 }, trail: { dur: 3, rate: 1 / 3 } },
    },
  },
  quickly: {
    id: 'quickly',
    word: 'quickly',
    stacked: ['flashing', 'instant'],
    kind: 'adverb',
    icon: '🐇',
    mana: 1,
    adverb: {
      powerMult: 0.75,
      cooldownMult: 0.65,
      // Leading: the whole condition in a quarter of the time, a share lost
      // to haste (speed). Trailing: compressed cleanly, nothing lost
      // (efficiency).
      clock: { lead: { dur: 0.25, rate: 3 }, trail: { dur: 0.5, rate: 2 } },
    },
  },
  gently: {
    id: 'gently',
    word: 'gently',
    stacked: ['faintly', 'barely'],
    kind: 'adverb',
    icon: '🕊️',
    minLevel: 7,
    mana: 1,
    /*
     * The SCAFFOLD word. Weight collapses (0.5 per tier — barely is an
     * eighth of a blow) while the affliction it carries is untouched:
     * intensity is the noun's business and delivery the verb's, and gently
     * is neither. That is what makes "gently venom cut me" a way to poison
     * YOURSELF for almost nothing — a stepping stone for the workings that
     * change the rules afterwards (Venom Feast strips it and spits it back
     * with interest; Blood Communion turns a self-inflicted bleed into
     * healing). Cost falls slower than weight, so it is never merely a
     * cheaper blow.
     */
    adverb: {
      powerMult: 0.5,
      manaMult: 0.85,
      crit: { lead: { chance: -0.05 }, trail: { damage: -0.2 } },
    },
  },
  viciously: {
    id: 'viciously',
    word: 'viciously',
    stacked: ['savagely', 'murderously'],
    kind: 'adverb',
    icon: '🩸',
    minLevel: 13,
    mana: 2,
    // Crit ADDS per tier (chance is a probability, severity a multiplier)
    // while the cost compounds. Spoken first it hunts the vital spot;
    // spoken last it tears the one it finds far wider.
    adverb: {
      manaMult: 1.4,
      crit: { lead: { chance: 0.07 }, trail: { damage: 0.25 } },
    },
  },
  intensely: {
    id: 'intensely',
    word: 'intensely',
    stacked: ['fiercely', 'overwhelmingly'],
    kind: 'adverb',
    icon: '🔆',
    minLevel: 10,
    mana: 2,
    // The pushing costs; the concentration trades length for depth.
    adverb: {
      intensity: 1.6,
      manaMult: 1.3,
      clock: { lead: { dur: 1, rate: 1 }, trail: { dur: 0.6, rate: 1 } },
    },
  },
  dimly: {
    id: 'dimly',
    word: 'dimly',
    stacked: ['thinly', 'scarcely'],
    kind: 'adverb',
    icon: '🔅',
    minLevel: 8,
    mana: 1,
    adverb: {
      intensity: 0.6,
      manaMult: 0.9,
      clock: { lead: { dur: 1, rate: 1 }, trail: { dur: 1.6, rate: 1 } },
    },
  },
  twice: {
    id: 'twice',
    word: 'twice',
    stacked: ['thrice', 'fourfold'],
    kind: 'adverb',
    icon: '✌️',
    minLevel: 6,
    mana: 2,
    adverb: { hits: 2, manaMult: 1.8 },
  },

  // ----- Conjunctions: how clauses relate -----
  then: {
    id: 'then',
    word: 'then',
    kind: 'conjunction',
    icon: '⏭️',
    minLevel: 12,
    mana: 1,
    conjunction: { inheritPenetration: true, followThrough: 1.3 },
  },
  and: {
    id: 'and',
    word: 'and',
    kind: 'conjunction',
    icon: '🤝',
    minLevel: 14,
    mana: 2,
    conjunction: { fuse: 0.85 },
  },
  but: {
    id: 'but',
    word: 'but',
    kind: 'conjunction',
    icon: '🔀',
    minLevel: 16,
    mana: 2,
    conjunction: { transmute: true },
  },
  or: {
    id: 'or',
    word: 'or',
    kind: 'conjunction',
    icon: '🎲',
    minLevel: 15,
    mana: 1,
    conjunction: { alternate: 0.5 },
  },
  if: {
    id: 'if',
    word: 'if',
    kind: 'conjunction',
    icon: '❓',
    minLevel: 18,
    mana: 1,
    conjunction: { condition: true },
  },
  /*
   * Accompaniment. Made for undoing — "undo with fire with ice" is one answer
   * tuned two ways, where two undo clauses would be two answers paying the
   * breadth tax — but it lends a bare substance to whatever the clause before
   * it was doing: riders to a blow, a coat to a ward, weight to a mending.
   */
  with: {
    id: 'with',
    word: 'with',
    kind: 'conjunction',
    icon: '🔗',
    minLevel: 11,
    mana: 1,
    conjunction: { accompany: 0.75 },
  },

  // ----- Targeting words: the address the spell is sent to -----
  one: {
    id: 'one',
    word: 'one',
    kind: 'target',
    icon: '👤',
    mana: 0,
    target: 'one',
  },
  others: {
    id: 'others',
    word: 'others',
    kind: 'target',
    icon: '👥',
    minLevel: 5,
    mana: 2,
    target: 'others',
  },
  me: {
    id: 'me',
    word: 'me',
    kind: 'target',
    icon: '🙋',
    minLevel: 2,
    mana: 0,
    target: 'self',
  },
});

export const ARCANE_WORD_LIST: ArcaneWordDef[] = Object.values(ARCANE_WORDS);

/**
 * Sentence length grows with the Arcana skill: three words to begin with, one
 * more every eight levels, eight at most. The cap is on WORDS, not clauses —
 * a targeting word spends a slot like everything else.
 */
export function maxSentenceWords(level: number): number {
  return Math.min(8, 3 + Math.floor(level / 8));
}

// ---------- Divine: the miracles ----------

/**
 * Miracles, keyed by id, each an aspect of one deity's power (see
 * data/deities.data.ts). Divine magic is received, not composed: every spec
 * is stated whole, because the shape of the prayer was fixed long before the
 * supplicant was born. Favor — with that deity, nobody else — is the only
 * currency the divine accepts.
 *
 * The three `litany_*` ids predate the pantheon and keep their ids for old
 * grimoires; they have been claimed by the deities they always belonged to.
 */
export const MIRACLES = prose<MiracleDef>('MIRACLES', MIRACLES_TEXT, {
  // ----- Ik'Thel'the, the Infinity between Zero and One -----
  unfold_geometry: {
    id: 'unfold_geometry',
    deity: 'ikthelthe',
    name: 'Unfold Geometry',
    icon: '📐',
    favorCost: 4,
    spec: {
      name: 'Unfold Geometry',
      icon: '📐',
      target: 'one',
      strikes: [
        { type: 'arcane', power: 0.4, inflicts: [{ id: 'unfolded', intensity: 1 }] },
      ],
      manaCost: 5,
      cooldown: 160,
    },
  },
  fractal_lance: {
    id: 'fractal_lance',
    deity: 'ikthelthe',
    name: 'Fractal Lance',
    icon: '🔱',
    favorCost: 5,
    minLevel: 5,
    spec: {
      name: 'Fractal Lance',
      icon: '🔱',
      target: 'one',
      strikes: [
        { type: 'arcane', power: 1.4 },
        { type: 'arcane', power: 0.7 },
        { type: 'arcane', power: 0.35 },
      ],
      manaCost: 6,
      cooldown: 130,
    },
  },
  fold_space: {
    id: 'fold_space',
    deity: 'ikthelthe',
    name: 'Fold Space',
    icon: '📄',
    favorCost: 4,
    spec: {
      name: 'Fold Space',
      icon: '📄',
      target: 'self',
      strikes: [],
      grants: [{ id: 'folded_space', intensity: 1 }],
      manaCost: 4,
      cooldown: 450,
    },
  },

  // ----- Xima, the Cold Sun -----
  litany_mending: {
    id: 'litany_mending',
    deity: 'xima',
    name: 'Rite of Mending',
    icon: '🙏',
    favorCost: 3,
    spec: {
      name: 'Rite of Mending',
      icon: '🙏',
      target: 'self',
      strikes: [],
      heal: 2.0,
      manaCost: 4,
      cooldown: 150,
    },
  },
  litany_aegis: {
    id: 'litany_aegis',
    deity: 'xima',
    name: 'Rite of the Aegis',
    icon: '🛡️',
    favorCost: 8,
    minLevel: 10,
    spec: {
      name: 'Rite of the Aegis',
      icon: '🛡️',
      target: 'self',
      strikes: [],
      buff: {
        name: 'Aegis',
        mods: [
          { stat: 'armor', op: 'add', value: 6 },
          { stat: 'resDark', op: 'add', value: 0.1 },
        ],
        duration: 300,
      },
      manaCost: 6,
      cooldown: 400,
    },
  },
  rime_of_the_cold_sun: {
    id: 'rime_of_the_cold_sun',
    deity: 'xima',
    name: 'Rime of the Cold Sun',
    icon: '❄️',
    favorCost: 6,
    spec: {
      name: 'Rime of the Cold Sun',
      icon: '❄️',
      target: 'self',
      strikes: [],
      grants: [{ id: 'ximas_rime', intensity: 1 }],
      manaCost: 6,
      // Xima's workings are long and slow, by doctrine.
      cooldown: 600,
    },
  },
  blood_communion: {
    id: 'blood_communion',
    deity: 'xima',
    name: 'Blood Communion',
    icon: '🩸',
    favorCost: 8,
    minLevel: 5,
    spec: {
      name: 'Blood Communion',
      icon: '🩸',
      target: 'self',
      strikes: [],
      grants: [
        { id: 'bleeding', intensity: 2 },
        { id: 'blood_communion', intensity: 1 },
      ],
      manaCost: 5,
      cooldown: 700,
    },
  },

  // ----- D'Enjalle, the Shining Rapier -----
  litany_retribution: {
    id: 'litany_retribution',
    deity: 'denjalle',
    name: 'Writ of Retribution',
    icon: '⚖️',
    favorCost: 5,
    minLevel: 5,
    spec: {
      name: 'Writ of Retribution',
      icon: '⚖️',
      target: 'one',
      strikes: [
        { type: 'light', power: 2.2, inflicts: [{ id: 'dazzled', intensity: 1, chance: 0.4 }] },
      ],
      manaCost: 5,
      cooldown: 120,
    },
  },
  holy_fire: {
    id: 'holy_fire',
    deity: 'denjalle',
    name: 'Holy Fire',
    icon: '🔥',
    favorCost: 6,
    spec: {
      name: 'Holy Fire',
      icon: '🔥',
      target: 'one',
      strikes: [
        { type: 'heat', orType: 'light', power: 2.0, inflicts: [{ id: 'on_fire', intensity: 1, chance: 0.3 }] },
      ],
      manaCost: 6,
      cooldown: 140,
    },
  },
  honorable_duel: {
    id: 'honorable_duel',
    deity: 'denjalle',
    name: 'Honorable Duel',
    icon: '⚔️',
    favorCost: 7,
    minLevel: 5,
    spec: {
      name: 'Honorable Duel',
      icon: '⚔️',
      target: 'self',
      strikes: [],
      grants: [{ id: 'honor_bound', intensity: 1 }],
      manaCost: 5,
      cooldown: 500,
    },
  },
  perfect_lunge: {
    id: 'perfect_lunge',
    deity: 'denjalle',
    name: 'Perfect Lunge',
    icon: '🤺',
    favorCost: 5,
    spec: {
      name: 'Perfect Lunge',
      icon: '🤺',
      target: 'self',
      strikes: [],
      buff: {
        name: 'Perfect Lunge',
        mods: [
          { stat: 'crit', op: 'add', value: 0.08 },
          { stat: 'critDamage', op: 'add', value: 0.2 },
          // The Shining Rapier favors his own weapon in an adherent's hand.
          { stat: 'damage', op: 'mult', value: 0.15, requiresTag: 'rapier' },
        ],
        duration: 300,
      },
      manaCost: 5,
      cooldown: 350,
    },
  },

  // ----- Usvýlgr, the Crafty Hammer -----
  artisans_cunning: {
    id: 'artisans_cunning',
    deity: 'usvylgr',
    name: "Artisan's Cunning",
    icon: '🔨',
    favorCost: 5,
    spec: {
      name: "Artisan's Cunning",
      icon: '🔨',
      target: 'self',
      strikes: [],
      grants: [{ id: 'artisans_cunning', intensity: 1 }],
      manaCost: 5,
      cooldown: 1200,
    },
  },
  veil_of_misdirection: {
    id: 'veil_of_misdirection',
    deity: 'usvylgr',
    name: 'Veil of Misdirection',
    icon: '🎭',
    favorCost: 6,
    spec: {
      name: 'Veil of Misdirection',
      icon: '🎭',
      target: 'self',
      strikes: [],
      grants: [{ id: 'veiled', intensity: 1 }],
      manaCost: 5,
      cooldown: 400,
    },
  },

  // ----- Kenese Paea, the Doubled Viper -----
  venom_feast: {
    id: 'venom_feast',
    deity: 'kenese_paea',
    name: 'Venom Feast',
    icon: '🐍',
    favorCost: 6,
    spec: {
      name: 'Venom Feast',
      icon: '🐍',
      target: 'one',
      strikes: [
        { type: 'poison', power: 0.5, inflicts: [{ id: 'poison', intensity: 1, chance: 0.4 }] },
      ],
      transfers: { statuses: ['poison', 'rotting'], mult: 1.2 },
      empowered: { statuses: ['poison', 'rotting'], mult: 1.5 },
      manaCost: 5,
      cooldown: 150,
    },
  },
  redouble_venom: {
    id: 'redouble_venom',
    deity: 'kenese_paea',
    name: 'Redouble Venom',
    icon: '🐍',
    favorCost: 8,
    minLevel: 5,
    spec: {
      name: 'Redouble Venom',
      icon: '🐍',
      target: 'one',
      strikes: [{ type: 'dark', power: 0.4 }],
      amplify: { statuses: ['poison', 'rotting'], mult: 2 },
      manaCost: 4,
      staminaCost: 15,
      cooldown: 200,
    },
  },
  night_shroud: {
    id: 'night_shroud',
    deity: 'kenese_paea',
    name: 'Night Shroud',
    icon: '🌑',
    favorCost: 5,
    spec: {
      name: 'Night Shroud',
      icon: '🌑',
      target: 'self',
      strikes: [],
      grants: [{ id: 'night_shroud', intensity: 1 }],
      manaCost: 5,
      cooldown: 450,
    },
  },
  // SPEC: create a nature-based defensive effect that entangles enemies and catches ranged attacks. enemies under 10% health are killed and turn into lumber. target self
  // TODO: description, icon
  sproutbringer: {
    id: 'sproutbringer',
    name: 'Sproutbringer',
    deity: 'tuigamala',
    icon: '📦',
    favorCost: 0,
    spec: { name: 'Sproutbringer', icon: '', target: 'self', strikes: [], manaCost: 0, cooldown: 0 },
  },
  // SPEC: enhances wooden weapons, causing them to penetrate armor and deal bonus bludgeoning damage based on the weapon's quality/tier
  tuigamalas_mighty_stick: {
    id: 'tuigamalas_mighty_stick',
    name: 'Tuigamala\'s Mighty Stick',
    deity: 'tuigamala',
    icon: '📦',
    favorCost: 0,
    spec: { name: '', icon: '', target: 'one', strikes: [], manaCost: 0, cooldown: 0 },
  },
  // SPEC: grant a bonus attack (alternating between piercing and slashing damage, analogous to the target being bitten and slashed) that happens at fixed intervals, hitting a random target and cause a mini-stun that stops enemy attack gauge for 0.2s
  spear_and_fang: {
    id: 'spear_and_fang',
    name: 'Spear And Fang',
    deity: 'cuixtli',
    icon: '📦',
    favorCost: 0,
    spec: { name: '', icon: '', target: 'self', strikes: [], manaCost: 0, cooldown: 0 },
  },

  // ----- yShicna', Logic Purified -----
  // The god grants no spells: both of its scriptures are PASSIVES that edit
  // the grammar itself, and they are mutually exclusive. Neither has a spec to
  // write — `MiracleDef` cannot express a passive yet, and that gap is the
  // first thing the build needs. Below them are the fourth utterances, one
  // authored block per word the god has an opinion about; a word with no entry
  // here simply cannot be overspoken. Full design: docs/NEXT.md.

  // SPEC: PASSIVE, no spell. Offered (not desired) once 80% of FOLDABLE words
  // — those with a `stacked` form, currently 31 of 40 — are completely
  // mastered. Aura on the whole encounter, both sides: everyone is held to the
  // lowest speaking. ONLY ARCANE MAGIC BECOMES ATOMIC — folding, and nothing
  // else. Statuses still escalate, multi-strike specs still land in full,
  // miracles and psionics are untouched. Anti-grammar, not anti-magic.
  // A folded token DEGRADES TO TIER 1 rather than failing — straight to the
  // bottom, whatever depth it was spoken at. Blazes become fires, `fourfold`
  // becomes `twice`, `instantly` merely becomes `quickly`; the working still
  // goes off, and its cost drops with the token (you said fire, not blaze). It is a weapon because monsters use
  // arcane magic too, more and more as the game goes on — it needs no devotion
  // and no trained mind, only repetition. Counterplay is shallow but smart:
  // word order, adverb position and conjunctions all work unchanged.
  atomic_state: {
    id: 'atomic_state',
    name: 'The Atomic State of Words',
    deity: 'yshicna',
    icon: '📦',
    favorCost: 0,
    spec: { name: '', icon: '', target: 'self', strikes: [], manaCost: 0, cooldown: 0 },
  },
  // SPEC: PASSIVE, no spell. The PERMISSION to trade a word for its fourth
  // utterance. Each trade is a transaction under it: the word is consumed and
  // leaves the lexicon, every grimoire spell using it becomes a Dead Spell.
  // Entries reading "yShicna' desires the Sound of <word>" are GENERATED from
  // save state — 1000 utterances of the word's tier-3 form — never authored.
  desired_sound: {
    id: 'desired_sound',
    name: 'The Sound of Words',
    deity: 'yshicna',
    icon: '📦',
    favorCost: 0,
    spec: { name: '', icon: '', target: 'self', strikes: [], manaCost: 0, cooldown: 0 },
  },

  // --- Fourth utterances (one per word; NOT on the stack curve) ---

  // SPEC: fire x4 — burn everything: every combatant takes fire damage every
  // tick, and loot has a chance of burning away (must NAME what it destroyed).
  // Sears become near-permanent, curable only by a long slow ritual — needs a
  // home, alembic or chapel. Breaks: statuses are temporary.
  fourth_fire: {
    id: 'fourth_fire',
    name: 'Fire, Fourfold',
    deity: 'yshicna',
    icon: '📦',
    favorCost: 0,
    spec: { name: '', icon: '', target: 'one', strikes: [], manaCost: 0, cooldown: 0 },
  },
  // SPEC: twice x4 — repeated casting that begins hitting every fighter
  // indiscriminately and intermittently, the player included, over time
  // spilling into randomly casting spells from the grimoire without consuming
  // mana. Must be able to fire the OTHER fourth utterances. Breaks: casting
  // requires mana, and requires you.
  fourth_twice: {
    id: 'fourth_twice',
    name: 'Twice, Fourfold',
    deity: 'yshicna',
    icon: '📦',
    favorCost: 0,
    spec: { name: '', icon: '', target: 'self', strikes: [], manaCost: 0, cooldown: 0 },
  },
  // SPEC: crush x4 — everyone takes damage on taking any action, slowly
  // incurring `concussed`; armor is crushed inward, dropping into the
  // negatives until it becomes its inverse. Breaks: armor has a floor — and
  // that floor is load-bearing in EVERY damage path, so check what clamps
  // before building this one.
  fourth_crush: {
    id: 'fourth_crush',
    name: 'Crush, Fourfold',
    deity: 'yshicna',
    icon: '📦',
    favorCost: 0,
    spec: { name: '', icon: '', target: 'one', strikes: [], manaCost: 0, cooldown: 0 },
  },
});

export const MIRACLE_LIST: MiracleDef[] = Object.values(MIRACLES);

/** The miracles a given deity grants, in declaration order. */
export function miraclesOf(deityId: string): MiracleDef[] {
  return MIRACLE_LIST.filter((m) => m.deity === deityId);
}

// ---------- Psionic ----------

/**
 * Psionic tuning. A shaping is points injected along AXES — no syntax, no
 * gods, just will. Every axis has its own point cap (3 + skill, 10 at most
 * from skill alone).
 *
 * The axes are not effects. They are TERMS: the resolver computes a handful of
 * quantities from them (pressure, momentum, inertia, acuity, awareness,
 * coherence, inward — see types.ts PsiQuantityId) and every part of the spell
 * is a function of those. That is what makes the same point spent in `mass`
 * build a wall in one shape and swing a hammer in another, with nothing
 * anywhere saying "wall" or "hammer".
 *
 * Psionics is deliberately the most aggressive school in power-in→power-out:
 * per-point output grows superlinearly (see pointCurve), and quantities built
 * from products compound that further.
 */
export const PSIONIC = {
  /** Per-axis cap: 3 + one per eight levels, 10 at most from skill alone. */
  axisCap: (level: number) => Math.min(10, 3 + Math.floor(level / 8)),
  /** Output grows FASTER than points spent — psionics' whole bargain. */
  pointCurve: (points: number) => Math.pow(points, 1.25),
  /** Bare force lands as blunt trauma, per curved point. */
  forcePower: 0.7,
  /** Mass in motion, per curved point of momentum-on-the-points-scale. */
  momentumPower: 0.85,
  /** A grip crushes a little as it holds, per curved point. */
  gripPower: 0.25,
  /**
   * The share of a strike a perfectly coherent shape withholds. Structure is
   * paid for out of the blow: space that holds its form is not space spent
   * arriving. Half of it comes back as what the standing shape grants.
   */
  holdCost: 0.4,
  /** Acuity at which the will arrives as a POINT rather than a push (piercing). */
  needleAcuity: 2,
  /** Acuity at which the working sees where the target will be, and cannot miss. */
  sureAcuity: 2,
  /** Armour ignored per unit of acuity carried through coherent space. */
  penPerAcuity: 0.09,
  /** Reach spills a share of the strike into flankers, per point of spread. */
  reachSplash: 0.2,
  /** At this much spread the working addresses every enemy at once. */
  reachAll: 4,
  /** How far sight spread across the field counts as reach (see `spread`). */
  awarenessSpread: 0.5,
  /** Grip presses on the mind: chance of a daze per point. */
  gripChance: 0.18,
  /** A hammer rattles the skull: concussion chance per point-scale momentum. */
  concussChance: 0.09,
  /** Speed compounds the cooldown down, per point. */
  speedCooldown: 0.93,
  /** Vitality knits the shaper back together, per curved point. */
  vitalityHeal: 0.35,
  /*
   * ---- The outward faces ----
   *
   * Gates for what each quantity does to THEM. Pressure and momentum arrive as
   * a blow and need nothing here; the rest are not force and never were, so
   * they arrive as conditions instead (SpellSpec.afflicts) rather than as
   * riders on a hit that a forceless working does not have.
   */
  /** Held mass, standing in the world as a wall. Structure only sets how long. */
  bulwarkInertia: 3,
  /**
   * Sight spent on someone: they have been seen, and cannot get out from under
   * it. Low, because sight spread thin across a field still reaches everyone
   * it is spread over — faintly, but a faint read of every enemy is a real
   * working and must not resolve to nothing.
   */
  readGate: 0.2,
  /**
   * Structure turned outward compresses the space they are standing in.
   *
   * Psionics authors its own conditions rather than borrowing. `unfolded` and
   * `folded_space` are Ik'Thel'the's — the two halves of that deity's whole
   * identity — and reaching for them made the coherence axis wear another
   * school's clothes on both faces. Native conditions also mean the per-unit
   * values can be sized for quantity-scale intensities, so nothing needs
   * capping the way a borrowed unit-scale condition did.
   */
  compressionGate: 1,

  /*
   * ---- The inward faces ----
   *
   * `inward` is not a healing switch; it is an AIM. Every quantity below has
   * an outward face already (a blow, a wall, a spread) and these are what the
   * same number does when the will is pointed at the shaper instead. The
   * share is what splits them, so nothing is ever discarded: momentum aimed
   * outward is a hammer, and the identical momentum aimed inward is speed.
   *
   * Each figure is a GATE — how much of the aimed quantity it takes before
   * the face appears at all. What one unit is worth lives on the status
   * itself (statuses.data.ts), because that is the status's own scaling.
   */
  /** Mass in motion, and the mass is you. */
  hasteMomentum: 0.5,
  /** Imposition held for yourself rather than spent on them. */
  braceGate: 1,
  /** Weight set inward: the shaper becomes the thing that will not move. */
  rootInertia: 2,
  /** Sight concentrated on where the blow means to go. */
  foresightGate: 0.5,
  /** Sight spanning the field, turned on your own footing. */
  wideSightGate: 2,
  /** Structure turned inward folds the shaper out of where the blows land. */
  foldCoherence: 1.5,
  /**
   * How long an inward face is worn, IN TICKS (10/s, as `cooldown` above is):
   * structure is what makes a working persist, so coherence — and nothing
   * else — buys duration. 20s bare, and past three minutes fully structured.
   */
  inwardDuration: (coherence: number) => 200 * (1 + coherence),
  /**
   * How long an AFFLICTION holds, in ticks. The mirror of the line above, and
   * a different source on purpose: structure is what keeps YOUR working
   * standing, purchase is what keeps it on THEM.
   *
   * Nothing is gated on it — every affliction still lands with no grip at all.
   * It decides how long any of it stays: 10s slippery, ~50s with a whole hand
   * on it and nothing rushing.
   */
  adhesion: (purchase: number) => 100 + 40 * purchase,
  /**
   * What a recognised shape is worth. ONE number for every recognition, on
   * purpose: a name is earned, not a payload. Deleting the whole recognition
   * table would change what workings are CALLED and nothing else.
   */
  recognitionBonus: 1.12,
  /*
   * What an INSTANT working costs, out of focus — psionics spends its own pool,
   * never the arcane one. The rate is deliberately gentle next to the old mana
   * cost (which was 2 + one per point): focus is a small, CHA-driven pool
   * (~18 at CHA 40) where mana is INT itself and runs to 50+. A quarter-point
   * per point keeps a heavy shape castable while making the very largest ones
   * genuinely unaffordable until the mind is wider — "you cannot hold that
   * thought yet" is a better wall than an arbitrary cap.
   *
   * A SUSTAINED working will not pay this. It eats focus's MAXIMUM for as long
   * as it is held instead (docs/PSIONIC.md §8), which is the whole distinction
   * between spending a pool and committing one.
   */
  focusBase: 1,
  focusPerPoint: 0.25,
  cooldown: 110,
} as const;

export const PSI_AXES = prose<PsionicAxisDef, PsiAxisId>('PSI_AXES', PSI_AXES_TEXT, {
  force: { id: 'force', name: 'Force', icon: '👊', color: '#e05555', },
  reach: { id: 'reach', name: 'Reach', icon: '🌊', color: '#5cbb6a', },
  grip: { id: 'grip', name: 'Grip', icon: '🫳', color: '#c98a3c', },
  speed: { id: 'speed', name: 'Speed', icon: '💨', color: '#f2d024', },
  clairvoyance: { id: 'clairvoyance', name: 'Clairvoyance', icon: '👁️', color: '#8f7ad8', },
  space: { id: 'space', name: 'Space', icon: '🌀', color: '#5591e0', },
  mass: { id: 'mass', name: 'Mass', icon: '🪨', color: '#9aa4b0', },
  vitality: { id: 'vitality', name: 'Vitality', icon: '💚', color: '#4caf7d', },
});

export const PSI_AXIS_LIST: PsionicAxisDef[] = Object.values(PSI_AXES);

/** The axes a mind starts with: raw power and its spread. The rest — and the
 * 4/8/12 threshold recognitions — are taught, when teachers exist to find. */
export const PSI_STARTING_AXES: PsiAxisId[] = ['force', 'reach'];

/**
 * The quantities a shape is read as, stated for the player.
 *
 * These are shown on the wheel and they update as the dials turn, because a
 * space is only a space if you can see where you are in it. `formula` is not
 * flavour: it is the literal arithmetic in systems/psionic.ts `deriveShape`,
 * and a player who reads it can predict the working without casting it.
 */
export const PSI_QUANTITIES = prose<PsiQuantityDef, PsiQuantityId>('PSI_QUANTITIES', PSI_QUANTITIES_TEXT, {
  pressure: {
    id: 'pressure',
    name: 'Pressure',
    icon: '💢',
    formula: 'force + grip',
    decimals: 0,
  },
  momentum: {
    id: 'momentum',
    name: 'Momentum',
    icon: '🔨',
    formula: 'mass × speed',
    decimals: 0,
  },
  inertia: {
    id: 'inertia',
    name: 'Inertia',
    icon: '🪨',
    formula: 'mass − speed',
    decimals: 0,
  },
  acuity: {
    id: 'acuity',
    name: 'Acuity',
    icon: '📍',
    formula: 'clairvoyance ÷ (reach + √momentum)',
    decimals: 2,
  },
  awareness: {
    id: 'awareness',
    name: 'Awareness',
    icon: '👁️',
    formula: 'clairvoyance × reach',
    decimals: 0,
  },
  coherence: {
    id: 'coherence',
    name: 'Coherence',
    icon: '🌀',
    formula: 'space ÷ (force + mass)',
    decimals: 2,
  },
  purchase: {
    id: 'purchase',
    name: 'Purchase',
    icon: '🫳',
    formula: 'grip ÷ (1 + speed)',
    decimals: 2,
  },
  inward: {
    id: 'inward',
    name: 'Inward',
    icon: '💚',
    formula: 'vitality ÷ (vitality + pressure)',
    decimals: 2,
  },
});

export const PSI_QUANTITY_LIST: PsiQuantityDef[] = Object.values(PSI_QUANTITIES);

/**
 * Recognitions: names earned for REGIONS of the derived space.
 *
 * These do not decide what a shape does. By the time one is looked for the
 * spec is already computed — the needle is unerring because its acuity is high,
 * not because this entry says `sure`. What an entry supplies is the name, and
 * the flat PSIONIC.recognitionBonus every recognition carries.
 *
 * Bands read the derived quantities, so a region is a statement about the
 * space rather than an answer key: "held mass across structured space" is one
 * region, and every shape that lands in it is a bulwark, including shapes
 * nobody enumerated. Adding a name here is pure content — it can never add
 * depth, which is exactly the point. Depth belongs in the quantities.
 */
export const PSI_RECOGNITIONS = prose<PsionicRecognitionDef>('PSI_RECOGNITIONS', PSI_RECOGNITIONS_TEXT, {
  unerring_needle: {
    id: 'unerring_needle',
    name: 'Unerring Needle',
    icon: '📍',
    region: {
      acuity: { min: 2 },
      pressure: { min: 4 },
      coherence: { min: 0.4 },
      momentum: { max: 0 },
      // A needle is thrown. The same sight worn inward is Second Sight.
      inward: { max: 0.5 },
    },
    tier: 4,
  },
  kinetic_bulwark: {
    id: 'kinetic_bulwark',
    name: 'Kinetic Bulwark',
    icon: '🛡️',
    region: {
      inertia: { min: 3 },
      coherence: { min: 0.4 },
      // A wall stands in the world. Held weight aimed at yourself is Immovable.
      inward: { max: 0.4 },
    },
    tier: 4,
  },
  still_mind: {
    id: 'still_mind',
    name: 'Still Mind',
    icon: '🧘',
    region: {
      inward: { min: 0.9 },
      vitality: { min: 3 },
      /*
       * The zeros are the point. An inward will carrying momentum is speed,
       * carrying weight is immovability, carrying sight is foresight; Still
       * Mind is the one that brought NOTHING but itself, which is why it is
       * the only shape that mends with its whole attention.
       */
      momentum: { max: 0 },
      inertia: { max: 0 },
      acuity: { max: 0 },
      awareness: { max: 0 },
      coherence: { max: 0.5 },
    },
  },
  kinetic_rush: {
    id: 'kinetic_rush',
    name: 'Kinetic Rush',
    icon: '💨',
    region: {
      momentum: { min: 36 },
      inward: { min: 0.8 },
    },
    tier: 4,
  },
  immovable: {
    id: 'immovable',
    name: 'Immovable',
    icon: '🌱',
    region: {
      inertia: { min: 5 },
      inward: { min: 0.8 },
    },
    tier: 4,
  },
  second_sight: {
    id: 'second_sight',
    name: 'Second Sight',
    icon: '🔮',
    region: {
      acuity: { min: 3 },
      inward: { min: 0.8 },
    },
    tier: 8,
  },
  psionic_obliteration: {
    id: 'psionic_obliteration',
    name: 'Obliteration',
    icon: '💥',
    region: {
      pressure: { min: 10 },
      momentum: { min: 48 },
      // Nothing held back for yourself. That is what makes it obliteration.
      inward: { max: 0.25 },
    },
    tier: 8,
  },
});

export const PSI_RECOGNITION_LIST: PsionicRecognitionDef[] = Object.values(PSI_RECOGNITIONS);
