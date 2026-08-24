import type {
  ArcaneWordDef,
  MiracleDef,
  PsiAxisId,
  PsiQuantityDef,
  PsiQuantityId,
  PsionicAxisDef,
  PsionicRecognitionDef,
} from '../types';

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

export const ARCANE_WORDS: Record<string, ArcaneWordDef> = {
  // ----- Nouns: the substance spoken into being -----
  fire: {
    id: 'fire',
    word: 'fire',
    stacked: ['flame', 'blaze'],
    kind: 'noun',
    icon: '🔥',
    desc: 'The first word most mages learn, and the last thing many say.',
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
    desc: 'Cold given a shape. It bites, and what it bites, it slows.',
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
    desc: 'A held breath of lightning. Quick to speak, quicker to land.',
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
    desc: 'Gentle as words go. What it soaks, other words find easier to freeze.',
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
    desc: 'A heavy word. What it hits, it leaves full of splinters.',
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
    desc: 'A light word. can reach far and quickly. What it hits keeps losing its footing.',
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
    desc: 'A patient word. It does almost nothing, and then it does not stop.',
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
    desc: 'A point, spoken. It goes in, and the hole it leaves stays open.',
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
    desc: 'Weak on arrival. It does its arguing afterwards.',
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
    desc: 'Every hit slowly strips away what makes hard targets so intimidating.',
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
    desc: 'Spoken plainly it illuminates. Spoken sharply it blinds.',
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
    desc: 'The dark that saps will, prolonged exposure corrupts.',
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
    desc:
      'The word for nothing, sharpened. It is not fire and not iron and not anything — ' +
      'so nothing resists it, and nothing suffers it especially. The raw number lands.',
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
    desc:
      'The stuff magic is made of, spoken at somebody. It frays whatever in them touches ' +
      'mana — and what frays far enough begins to burn.',
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
    desc: 'An edge. Whatever it carries, it carries INTO them — what it opens keeps working after the word has ended.',
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
    desc: 'Weight, brought down. The heaviest blow the grammar has — and the substance is mostly wasted in the impact.',
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
    desc: 'Narrows the working to a point. Armor and wards mean less to it — and so does whatever it was carrying.',
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
    desc: 'Sends the working out fast and often. Haste costs a little weight.',
    mana: 1,
    verb: { powerMult: 0.9, barePower: 0.4, cooldownMult: 0.75 },
  },
  expand: {
    id: 'expand',
    word: 'expand',
    stacked: ['engulf', 'everything'],
    kind: 'verb',
    icon: '💥',
    desc: 'Tells the working to be bigger than its target. The spill is the point.',
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
    desc: 'Detonate the word for greater power at the cost of a long wind-down.',
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
    desc: 'The working holds rather than harms. What the noun does lingers doubled.',
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
    desc: 'Turns the substance into a coat worn against its own element. Always lands on the speaker.',
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
    desc: 'Asks the substance to close a wound instead of opening one. Always lands on the speaker.',
    minLevel: 7,
    mana: 3,
    verb: { restore: 1.0 },
  },

  // ----- Adverbs: how it is spoken -----
  slowly: {
    id: 'slowly',
    word: 'slowly',
    stacked: ['dragging', 'glacial'],
    kind: 'adverb',
    icon: '🐢',
    desc: 'Every syllable given its full weight. Heavier, and much less often.',
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
    desc: 'Clipped short. Lighter, and much more often.',
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
    desc:
      'Spoken with the edge taken off. The substance still takes hold exactly as deeply — ' +
      'it simply arrives without the force behind it. The word for putting something ON ' +
      'someone (yourself included) rather than doing something TO them.',
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
    desc:
      'Spoken looking for the seam. Every syllable hunts the vital spot, and the working ' +
      'demands a great deal more to be said that way.',
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
    desc:
      'Spoken with everything behind the substance rather than the blow. Whatever it leaves ' +
      'in them bites far deeper — and spoken LAST it is concentrated rather than merely ' +
      'strong, burning hotter for less long.',
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
    desc:
      'Spoken with the substance held back. What it leaves barely takes — but it is never ' +
      'nothing, and spoken LAST it is diluted rather than merely weak, lingering far longer ' +
      'for how little it is.',
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
    desc: 'Said again before the echo of the first has finished landing.',
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
    desc:
      'Sequence, spoken. The clause that follows strikes through the opening the one before ' +
      'it made — and strikes harder if that opening was actually made.',
    minLevel: 12,
    mana: 1,
    conjunction: { inheritPenetration: true, followThrough: 1.3 },
  },
  and: {
    id: 'and',
    word: 'and',
    kind: 'conjunction',
    icon: '🤝',
    desc:
      'Simultaneity, spoken. Two clauses fuse into one blow with two natures — it lands as ' +
      'whichever the target guards worse, and carries both riders.',
    minLevel: 14,
    mana: 2,
    conjunction: { fuse: 0.85 },
  },
  but: {
    id: 'but',
    word: 'but',
    kind: 'conjunction',
    icon: '🔀',
    desc:
      'Contradiction, spoken. The clause that follows does not strike — it transmutes, its ' +
      'riders replacing those of the blow before it. Spoken with a riderless word, it strips ' +
      'the blow clean instead.',
    minLevel: 16,
    mana: 2,
    conjunction: { transmute: true },
  },
  or: {
    id: 'or',
    word: 'or',
    kind: 'conjunction',
    icon: '🎲',
    desc:
      'Chance, spoken. The linked clauses become alternatives — one is rolled each cast, and ' +
      'each pays only half its mana. Thrift, at the price of knowing.',
    minLevel: 15,
    mana: 1,
    conjunction: { alternate: 0.5 },
  },
  if: {
    id: 'if',
    word: 'if',
    kind: 'conjunction',
    icon: '❓',
    desc:
      'Condition, spoken. The clause that follows does not strike — its noun names an ' +
      'affliction, and the blow before it fires only while the target bears it.',
    minLevel: 18,
    mana: 1,
    conjunction: { condition: true },
  },

  // ----- Targeting words: the address the spell is sent to -----
  one: {
    id: 'one',
    word: 'one',
    kind: 'target',
    icon: '👤',
    desc: 'The single foe before you. The default address of every spell.',
    mana: 0,
    target: 'one',
  },
  others: {
    id: 'others',
    word: 'others',
    kind: 'target',
    icon: '👥',
    desc: 'Everyone on the wrong side of the argument. Spreading a word thins it.',
    minLevel: 5,
    mana: 2,
    target: 'others',
  },
  me: {
    id: 'me',
    word: 'me',
    kind: 'target',
    icon: '🙋',
    desc: 'The speaker. The grammar does not care whether that was wise.',
    minLevel: 2,
    mana: 0,
    target: 'self',
  },
};

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
export const MIRACLES: Record<string, MiracleDef> = {
  // ----- Ik'Thel'the, the Infinity between Zero and One -----
  unfold_geometry: {
    id: 'unfold_geometry',
    deity: 'ikthelthe',
    name: 'Unfold Geometry',
    icon: '📐',
    desc: 'The target is briefly persuaded it has one face fewer than it needs.',
    favorCost: 4,
    spec: {
      name: 'Unfold Geometry',
      icon: '📐',
      desc: 'Breaks the target’s shape; what remains defends poorly.',
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
    desc: 'One thrust, containing two smaller thrusts, containing…',
    favorCost: 5,
    minLevel: 5,
    spec: {
      name: 'Fractal Lance',
      icon: '🔱',
      desc: 'Strikes at every scale at once, each half the last.',
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
    desc: 'Defensive without being restorative: where you were is not where you are.',
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
    desc: 'The oldest prayer there is: please, not yet.',
    favorCost: 3,
    spec: {
      name: 'Rite of Mending',
      icon: '🙏',
      desc: 'Closes wounds by asking nicely, firmly.',
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
    desc: 'A borrowed shield, on the understanding that it is returned dented.',
    favorCost: 8,
    minLevel: 10,
    spec: {
      name: 'Rite of the Aegis',
      icon: '🛡️',
      desc: 'The Cold Sun stands a little in front of you for a while.',
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
    desc: 'Slow to speak and slower to fade — a shield against the elements themselves.',
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
    desc: 'Open your own veins; what spills is channelled back as his protection.',
    favorCost: 8,
    minLevel: 5,
    spec: {
      name: 'Blood Communion',
      icon: '🩸',
      desc: 'You bleed, and the bleeding feeds you.',
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
    desc: 'A grievance, formally filed. The light does the rest.',
    favorCost: 5,
    minLevel: 5,
    spec: {
      name: 'Writ of Retribution',
      icon: '⚖️',
      desc: 'Judgement, delivered as light.',
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
    desc: 'Fire that is also light: it burns along whichever the target guards worse.',
    favorCost: 6,
    spec: {
      name: 'Holy Fire',
      icon: '🔥',
      desc: 'Lands as fire or as light — whichever finds the gap.',
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
    desc: 'The terms are declared, and the terms are enforced: one against one.',
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
    desc: 'Strike true. Struck with a rapier in hand, strike truer.',
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
    desc: 'Worn to the bench: surer hands, finer results, and a knack for finding the good stock.',
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
    desc: 'The enemy is not prevented from striking you. They are prevented from finding you.',
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
    desc: 'Swallow your own poison whole and spit it, sharpened, at somebody who earned it.',
    favorCost: 6,
    spec: {
      name: 'Venom Feast',
      icon: '🐍',
      desc: 'Strips your own poison and rot and delivers it, with interest.',
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
    desc: 'A venom already at work is asked to work twice as hard — paid for in her adherent’s breath.',
    favorCost: 8,
    minLevel: 5,
    spec: {
      name: 'Redouble Venom',
      icon: '🐍',
      desc: 'Doubles and refreshes the target’s poison and rot.',
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
    desc: 'Walk shrouded; let their blows find only dark.',
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
    desc: '',
    favorCost: 0,
    spec: { name: 'Sproutbringer', icon: '', desc: '', target: 'self', strikes: [], manaCost: 0, cooldown: 0 },
  },
  // SPEC: enhances wooden weapons, causing them to penetrate armor and deal bonus bludgeoning damage based on the weapon's quality/tier
  tuigamalas_mighty_stick: {
    id: 'tuigamalas_mighty_stick',
    name: 'Tuigamala\'s Mighty Stick',
    deity: 'tuigamala',
    icon: '📦',
    desc: '',
    favorCost: 0,
    spec: { name: '', icon: '', desc: '', target: 'one', strikes: [], manaCost: 0, cooldown: 0 },
  },
  // SPEC: grant a bonus attack (alternating between piercing and slashing damage, analogous to the target being bitten and slashed) that happens at fixed intervals, hitting a random target and cause a mini-stun that stops enemy attack gauge for 0.2s
  spear_and_fang: {
    id: 'spear_and_fang',
    name: 'Spear And Fang',
    deity: 'cuixtli',
    icon: '📦',
    desc: '',
    favorCost: 0,
    spec: { name: '', icon: '', desc: '', target: 'self', strikes: [], manaCost: 0, cooldown: 0 },
  },

  // ----- yShicna', Logic Purified -----
  // The god grants no spells: both of its scriptures are PASSIVES that edit
  // the grammar itself, and they are mutually exclusive. Neither has a spec to
  // write — `MiracleDef` cannot express a passive yet, and that gap is the
  // first thing the build needs. Below them are the fourth utterances, one
  // authored block per word the god has an opinion about; a word with no entry
  // here simply cannot be overspoken. Full design: docs/NEXT.md.

  // SPEC: PASSIVE, no spell. Offered (not desired) once 80% of FOLDABLE words
  // — those with a `stacked` form, currently 28 of 36 — are completely
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
    desc: '',
    favorCost: 0,
    spec: { name: '', icon: '', desc: '', target: 'self', strikes: [], manaCost: 0, cooldown: 0 },
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
    desc: '',
    favorCost: 0,
    spec: { name: '', icon: '', desc: '', target: 'self', strikes: [], manaCost: 0, cooldown: 0 },
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
    desc: '',
    favorCost: 0,
    spec: { name: '', icon: '', desc: '', target: 'one', strikes: [], manaCost: 0, cooldown: 0 },
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
    desc: '',
    favorCost: 0,
    spec: { name: '', icon: '', desc: '', target: 'self', strikes: [], manaCost: 0, cooldown: 0 },
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
    desc: '',
    favorCost: 0,
    spec: { name: '', icon: '', desc: '', target: 'one', strikes: [], manaCost: 0, cooldown: 0 },
  },
};

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

export const PSI_AXES: Record<PsiAxisId, PsionicAxisDef> = {
  force: { id: 'force', name: 'Force', icon: '👊', color: '#e05555', desc: 'How hard the will lands. Bludgeoning, from nowhere.' },
  reach: { id: 'reach', name: 'Reach', icon: '🌊', color: '#5cbb6a', desc: 'How widely it lands. Enough reach touches everyone at once.' },
  grip: { id: 'grip', name: 'Grip', icon: '🫳', color: '#c98a3c', desc: 'How firmly it holds a mind. Dazes.' },
  speed: { id: 'speed', name: 'Speed', icon: '💨', color: '#f2d024', desc: 'How quickly the visualisation completes. Shortens the working’s cycle.' },
  clairvoyance: { id: 'clairvoyance', name: 'Clairvoyance', icon: '👁️', color: '#8f7ad8', desc: 'Seeing where things WILL be. Precognition now; telepathy in time.' },
  space: { id: 'space', name: 'Space', icon: '🌀', color: '#5591e0', desc: 'Where the working exists. Structure for other axes to key on.' },
  mass: { id: 'mass', name: 'Mass', icon: '🪨', color: '#9aa4b0', desc: 'How much the working weighs. Walls are made of this.' },
  vitality: { id: 'vitality', name: 'Vitality', icon: '💚', color: '#4caf7d', desc: 'The will turned inward: the body asked, firmly, to be whole.' },
};

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
export const PSI_QUANTITIES: Record<PsiQuantityId, PsiQuantityDef> = {
  pressure: {
    id: 'pressure',
    name: 'Pressure',
    icon: '💢',
    formula: 'force + grip',
    desc: 'How much is being imposed at all. What the blow is made of, and what a will turned inward has to overcome.',
    decimals: 0,
  },
  momentum: {
    id: 'momentum',
    name: 'Momentum',
    icon: '🔨',
    formula: 'mass × speed',
    desc: 'Mass in motion. Weight that is going somewhere hits like a hammer and rattles what it hits.',
    decimals: 0,
  },
  inertia: {
    id: 'inertia',
    name: 'Inertia',
    icon: '🪨',
    formula: 'mass − speed',
    desc: 'Mass that is going nowhere. Held still it is a wall; every point of speed takes some of the wall away.',
    decimals: 0,
  },
  acuity: {
    id: 'acuity',
    name: 'Acuity',
    icon: '📍',
    formula: 'clairvoyance ÷ (reach + √momentum)',
    desc: 'Sight per unit of what it must cover — ground, and motion. Concentrated, it punctures and cannot miss. A shape is a needle or a hammer; it cannot be both.',
    decimals: 2,
  },
  awareness: {
    id: 'awareness',
    name: 'Awareness',
    icon: '👁️',
    formula: 'clairvoyance × reach',
    desc: 'Sight spanning the field. Seeing where everyone is carries the working to them.',
    decimals: 0,
  },
  coherence: {
    id: 'coherence',
    name: 'Coherence',
    icon: '🌀',
    formula: 'space ÷ (force + mass)',
    desc: 'Structure against what wants to burst out of it. A coherent shape keeps some of itself back and leaves something standing.',
    decimals: 2,
  },
  purchase: {
    id: 'purchase',
    name: 'Purchase',
    icon: '🫳',
    formula: 'grip ÷ (1 + speed)',
    desc: 'How well the working holds what it caught. A grab made at speed does not hold: everything still lands, but with no purchase nothing stays. Zero grip is slippery, not empty.',
    decimals: 2,
  },
  inward: {
    id: 'inward',
    name: 'Inward',
    icon: '💚',
    formula: 'vitality ÷ (vitality + pressure)',
    desc: 'Which way the whole working faces. Every quantity above has an outward face and an inward one — momentum thrown is a hammer, momentum worn is speed — and this is the share going each way. Nothing is ever discarded; it is only aimed.',
    decimals: 2,
  },
};

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
export const PSI_RECOGNITIONS: Record<string, PsionicRecognitionDef> = {
  unerring_needle: {
    id: 'unerring_needle',
    name: 'Unerring Needle',
    icon: '📍',
    desc: 'Sight narrowed past the point where a target can be anywhere else, and enough will behind it to arrive. Nothing in motion — a hammer is a different thought.',
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
    desc: 'Mass that is going nowhere, held across structured space: a standing wall that stops anything thrown, shot or spat — light passes through, being in no hurry to be matter.',
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
    desc: 'Everything turned inward and nothing turned out — and nothing carried in with it. The body is asked to mend, and does.',
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
    desc: 'Mass and motion, and the mass is you. Nothing is thrown, nothing is struck — you are simply somewhere else, sooner, for as long as you can hold the thought.',
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
    desc: 'Weight set inward and told to stay. What tries to move you — a blow, a shove, a mind — finds nothing anywhere in you that consents to be moved.',
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
    desc: 'Sight narrowed to a point and turned around: not where they are, but where their blow means to be, half a second before they have decided it.',
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
    desc: 'Every term of the shape at once — the whole imposition thrown, at weight, at speed. There is no technique left in it. There is no need for any.',
    region: {
      pressure: { min: 10 },
      momentum: { min: 48 },
      // Nothing held back for yourself. That is what makes it obliteration.
      inward: { max: 0.25 },
    },
    tier: 8,
  },
};

export const PSI_RECOGNITION_LIST: PsionicRecognitionDef[] = Object.values(PSI_RECOGNITIONS);
