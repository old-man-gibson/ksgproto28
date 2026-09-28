import type {
  ArcaneWordDef,
  DamageType,
  GameState,
  Modifier,
  SpellCounter,
  SpellSpec,
  SpellStrike,
  SpellTarget,
  StatusApplication,
} from '../types';
import { RES_STAT_BY_TYPE } from '../types';
import type { EventBus } from '../engine/events';
import { ARCANE_WORDS, maxSentenceWords } from '../data/spellcraft.data';
import { STATUSES } from '../data/statuses.data';
import { WORD_POWER_PER_LEVEL, wordSkillId, wordTag } from '../data/wordskills.data';
import { checkDiscovery, grantSkillXpDirect } from './skills';
import { wordUnlocked } from './unlocks';
import { text } from '../text/log';

/**
 * The conditions a noun's signature affliction can be RECOGNISED as: the
 * inflicted ids plus everything they escalate into — "if fire" is satisfied
 * by a target that is Blazing, not only one merely On Fire.
 */
function signatureStatuses(apps: { id: string }[] | undefined): string[] {
  const out: string[] = [];
  for (const app of apps ?? []) {
    let id: string | undefined = app.id;
    while (id && !out.includes(id)) {
      out.push(id);
      id = STATUSES[id]?.escalatesTo;
    }
  }
  return out;
}

/**
 * Arcane spellcraft: magic as syntax.
 *
 * A spell is a SENTENCE — nouns for substance, verbs for what the substance is
 * made to do, adverbs for how it is spoken, targeting words for where it is
 * sent. The composer reads the sentence left to right and the reading is
 * deterministic: two mages who speak the same words in the same order get the
 * same spell, always. There is no roll anywhere in here.
 *
 * WORD ORDER is the grammar's whole personality:
 *
 *  - Words group into CLAUSES as they are read. A clause holds one noun and
 *    one verb; speaking a second noun (or second verb) closes the clause and
 *    opens the next. "fire pierce ice fly" is two clauses.
 *  - Within a clause, whichever core word came FIRST leads it. "pierce fire"
 *    is verb-led: the action dominates, so the verb's mechanics (penetration,
 *    spread, grip) are amplified and the substance hits softer. "fire pierce"
 *    is noun-led: the substance dominates and hits harder, the mechanics
 *    fainter. Same words, different spells — slightly, and predictably.
 *  - An adverb attaches to the clause that is open when it is read, wherever
 *    in the clause it sits.
 *  - A targeting word belongs to no clause: it addresses the whole spell, and
 *    the LAST one spoken seals it. The grammar does not check the address for
 *    wisdom — "fire pierce me" does exactly what it says.
 *
 * Later clauses land at a diminishing share (the runecarving rule): breadth
 * costs, and the widest sentence is not automatically the best one.
 */

// ---------- Tuning ----------

/** How much the leading word of a clause dominates it. */
export const VERB_LED = { power: 0.85, mechanics: 1.3 };
export const NOUN_LED = { power: 1.15, mechanics: 0.8 };
/** A noun spoken with no verb at all: substance without shape. */
export const UNSHAPED_POWER = 0.8;
/** Clause i (0-based) contributes at this share — breadth costs. */
export const clauseShare = (i: number) => 1 / (1 + i * 0.5);
/** Sending a spell to 'others' costs half again as much mana... */
export const OTHERS_MANA_MULT = 1.5;
/** ...and lands on each enemy at this share of its power. */
export const OTHERS_POWER = 0.5;
/** Base cooldown in ticks, before verbs and adverbs have their say. */
export const BASE_COOLDOWN = 90;
/** However spoken, a spell is never faster or slower than these. */
export const COOLDOWN_RANGE: [number, number] = [30, 500];

// ----- Stacking: repetition as intensification -----

/** A word may be spoken at most this many times in a row. */
export const MAX_STACK = 3;
/**
 * However dimly a substance is spoken, what it leaves behind is still
 * something: an affliction's depth is floored at this share of its own.
 * Dimming is restraint, never erasure — a word that removed a condition
 * outright would be a different word.
 */
export const INTENSITY_FLOOR = 0.15;
/**
 * What repetition buys, indexed by copies−1: effect grows FASTER than linear
 * (two fires as flame beat two fires cast separately)...
 */
export const STACK_POWER = [1, 2.3, 3.9];
/** ...and cost grows faster than effect. Doubling down is never efficient. */
export const STACK_MANA = [1, 3, 6];
/** Accumulated raw spill at which an expanding working simply hits EVERYONE. */
export const EVERYTHING_SPLASH = 1.5;

// ----- Anti-magic: the undoing -----
//
// A counterspell's EFFICIENCY is how much of the working it answers it takes
// apart, and it is deliberately uncapped: past 100% there is nothing left of
// the working to undo, but the burn laid on its caster keeps climbing.
//
//   efficiency = UNDO_BASE
//              + UNDO_PER_TIER × (undo tiers − 1)
//              + ARCANE_UNDO_PER_UNIT × (arcane units in the tuning)
//              + match
//
// MATCH is where tuning pays. A tuning of n units can reach `matchCeiling(n)`
// in all — 10% for one unit, 18% for two, ~34% for five — and each unit is
// worth an even share of that ceiling, so the ceiling rises with every unit
// tuned while what each one is worth falls. A unit only counts when the
// working it meets was spoken with the same element at least as deep: tuning
// frost (two units) against a working that spoke plain ice matches one, and
// pays for both.

/** What an undoing is worth before it has matched anything: undo:1. */
export const UNDO_BASE = 0.2;
/** Each undo tier past the first — unsay adds one of these, unmake two. */
export const UNDO_PER_TIER = 0.075;
/**
 * Each unit of arcane in the tuning, whatever the working was made of.
 * Arcane is the substance of undoing itself, so it answers everything —
 * and, being an element like any other, it also MATCHES arcane workings.
 */
export const ARCANE_UNDO_PER_UNIT = 0.05;
/** The match ceiling for a single unit of tuning... */
export const MATCH_FIRST = 0.1;
/** ...and the share of it each further unit adds on top. */
export const MATCH_DECAY = 0.8;

/**
 * The most a tuning of `units` can add, every unit matched: a geometric sum,
 * so it rises with every unit and never passes MATCH_FIRST / (1 − MATCH_DECAY).
 */
export function matchCeiling(units: number): number {
  if (units <= 0) return 0;
  return (MATCH_FIRST * (1 - Math.pow(MATCH_DECAY, units))) / (1 - MATCH_DECAY);
}

/** A counterspell read against one working, term by term, for the card and the feed. */
export interface CounterReading {
  /** The whole of it. Uncapped. */
  efficiency: number;
  /** From the undo tiers alone. */
  base: number;
  /** From arcane in the tuning, whatever it met. */
  arcane: number;
  /** From tuning that met its element. */
  match: number;
  /** Units of tuning that met their element this time. */
  matched: number;
  /** Units of tuning in all. */
  tuned: number;
  /** What each matched unit was worth. */
  perUnit: number;
}

/**
 * How well an undoing answers a working. Pure: the counter as composed, the
 * working as `workingSignature` reads it, nothing else — so the bench can
 * state it for any working and combat reads the same number.
 */
export function counterEfficiency(
  counter: SpellCounter,
  signature: Partial<Record<DamageType, number>>,
): CounterReading {
  const base = UNDO_BASE + UNDO_PER_TIER * Math.max(0, counter.tiers - 1);
  const arcane = ARCANE_UNDO_PER_UNIT * (counter.tuning.arcane ?? 0);
  let tuned = 0;
  let matched = 0;
  for (const [element, units] of Object.entries(counter.tuning) as [DamageType, number][]) {
    tuned += units;
    matched += Math.min(units, signature[element] ?? 0);
  }
  const perUnit = tuned > 0 ? matchCeiling(tuned) / tuned : 0;
  const match = perUnit * matched;
  return { efficiency: base + arcane + match, base, arcane, match, matched, tuned, perUnit };
}

// ----- Word mastery: tier vocabulary earned by use -----

/**
 * Inscriptions using a word before its deeper forms may be spoken DIRECTLY:
 * speak fire in five sentences and "flame" becomes a word of its own — one
 * slot in the sentence, full stack cost and power. Fifteen earns "blaze".
 * The counters are the arcana novelty ledger; nothing new is tracked.
 */
export const WORD_MASTERY = [5, 15];

// ----- Skilling the vocabulary -----

/**
 * How well this speaker knows one word. Distinct from MASTERY (which says
 * what you may fold) — this is practice, and it makes the word itself heavier.
 */
export function wordLevel(state: GameState, wordId: string): number {
  return state.skills[wordSkillId(wordId)]?.level ?? 0;
}

/** Every known word's level, in the shape composeArcane wants. */
export function wordLevels(state: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of Object.keys(ARCANE_WORDS)) {
    const level = wordLevel(state, id);
    if (level > 0) out[id] = level;
  }
  return out;
}

/** What one word's practice is worth to the clause it sits in. */
export function wordBonusFor(levels: Record<string, number> | undefined, wordId: string): number {
  return 1 + WORD_POWER_PER_LEVEL * (levels?.[wordId] ?? 0);
}

/** Base XP a single casting or inscription pays each word it spoke. */
export const WORD_XP_BASE = 2;

/**
 * Pay every word a sentence spoke.
 *
 * The payout rises with what the working COST, because a sentence you can
 * barely afford teaches more than one you can rattle off — but logarithmically,
 * so a single enormous spell is never worth more than saying several ordinary
 * ones. Every distinct word is paid the same: using a word is using it,
 * whatever else was in the sentence beside it.
 */
export function grantWordXp(
  state: GameState,
  bus: EventBus,
  wordIds: string[],
  manaCost: number,
  weight = 1,
): void {
  const spoken = [...new Set(wordIds.map((w) => splitWordId(w).id))].filter((id) => ARCANE_WORDS[id]);
  if (spoken.length === 0) return;
  const amount = WORD_XP_BASE * weight * (1 + Math.log2(1 + Math.max(0, manaCost)));
  for (const id of spoken) {
    /*
     * Manifesting needs the WHOLE chain — skillTrainedBy walks up to Arcana
     * and Magic behind it, and a bare 'word:fire' satisfies neither — but the
     * XP is then handed to the one skill by name. Paying through the tags
     * would credit Arcana once per word in the sentence, so a six-word
     * working would teach the grammar six times for one breath; Arcana takes
     * its own cut at the inscription and the cast, and that is enough.
     */
    checkDiscovery(state, bus, ['spellcraft', 'magic', 'arcane', wordTag(id)]);
    grantSkillXpDirect(state, bus, wordSkillId(id), amount);
  }
}

export function wordUses(state: GameState, wordId: string): number {
  // DISTINCT inscribed sentences that spoke the word — not raw inscriptions,
  // which could be farmed by inscribing and forgetting the same sentence
  // forever. The combo keys already in the arcana ledger are exactly this
  // record: one per sentence ever inscribed, deleted or not. Mastery is
  // breadth of use, the way the rest of novelty already works.
  const ledger = state.novelty.arcana ?? {};
  let n = 0;
  for (const key of Object.keys(ledger)) {
    if (!key.startsWith('arcane:') || key.startsWith('arcane:word:')) continue;
    // Collapsed tokens read `fire2` — strip the depth to get the word back.
    if (key.slice(7).split(',').some((t) => t.replace(/\d+$/, '') === wordId)) n++;
  }
  return n;
}

/** The deepest tier of a word this mage may speak as a single word (1–3). */
export function masteredTier(state: GameState, wordId: string): number {
  const def = ARCANE_WORDS[wordId];
  if (!def?.stacked) return 1;
  const uses = wordUses(state, wordId);
  let tier = 1;
  for (let i = 0; i < WORD_MASTERY.length; i++) if (uses >= WORD_MASTERY[i]) tier = i + 2;
  return tier;
}

/** A sentence token: 'fire' is tier 1, 'fire:2' speaks flame, 'fire:3' blaze. */
export function splitWordId(token: string): { id: string; tier: number } {
  const [id, t] = token.split(':');
  return { id, tier: t ? Number(t) : 1 };
}

// ---------- Parsing ----------

/** One token of a sentence: a word, and how many times in a row it was said. */
export interface SpokenWord {
  def: ArcaneWordDef;
  /** Adjacent repetitions merged into this token (fire fire = count 2). */
  count: number;
  /**
   * An adverb spoken BEFORE its clause's core — whichever of noun or verb
   * arrived first. Position is meaning: a leading adverb speaks about the
   * applying, a trailing one about the substance — "fourfold glacier" chills
   * four times, "glacier fourfold" chills once, four times as deep.
   *
   * Measured against the CORE rather than the noun specifically, so a clause
   * with no noun still reads both ways: "quickly cut" is leading, "cut
   * quickly" trailing. A verb is a clause's substance when nothing else is.
   */
  preCore?: boolean;
}

/** What a token reads as: the word itself, or what repetition made of it. */
export function displayWord(t: SpokenWord): string {
  if (t.count <= 1) return t.def.word;
  return t.def.stacked?.[t.count - 2] ?? `${t.def.word} ×${t.count}`;
}

/** One clause as the composer read it, for the bench to show its parse. */
export interface ArcaneClause {
  noun?: SpokenWord;
  verb?: SpokenWord;
  adverbs: SpokenWord[];
  /** Which core word arrived first. */
  led: 'noun' | 'verb';
  /**
   * The conjunction that bound this clause to the one BEFORE it. A linked
   * clause is a continuation, not a new claim on the working — it escapes the
   * breadth tax and gains whatever its conjunction grants.
   */
  linked?: ArcaneWordDef;
}

export interface ArcaneParse {
  ok: boolean;
  reason?: string;
  clauses: ArcaneClause[];
  target: SpellTarget;
  /** The words as resolved, in spoken order. */
  words: ArcaneWordDef[];
  /** The sentence after repetition merged, for naming ("Blaze Pierce"). */
  tokens: SpokenWord[];
}

/** Words the mage knows at a given Arcana level. */
export function knownWords(level: number): ArcaneWordDef[] {
  return Object.values(ARCANE_WORDS).filter((w) => (w.minLevel ?? 0) <= level);
}

export function arcaneLevel(state: GameState): number {
  return state.skills.arcana?.level ?? 0;
}

/**
 * Read a sentence into clauses. Pure grammar — no legality checks beyond the
 * words existing; level gating and length caps belong to `checkSentence`,
 * so the bench can show the parse of a sentence you cannot yet speak.
 */
export function parseSentence(wordIds: string[]): ArcaneParse {
  const none = (reason: string): ArcaneParse => ({
    ok: false,
    reason,
    clauses: [],
    target: 'one',
    words: [],
    tokens: [],
  });
  const words: ArcaneWordDef[] = [];
  const spoken: { def: ArcaneWordDef; tier: number }[] = [];
  for (const raw of wordIds) {
    const { id, tier } = splitWordId(raw);
    const def = ARCANE_WORDS[id];
    if (!def) return none(`No such word: ${raw}`);
    // A tier token IS the deepened word: one slot, full weight. Legality of
    // speaking it (mastery) belongs to checkSentence; the grammar just reads.
    if (tier !== 1 && (!Number.isInteger(tier) || tier < 1 || tier > MAX_STACK || !def.stacked)) {
      return none(`No such word: ${raw}`);
    }
    words.push(def);
    spoken.push({ def, tier });
  }

  // Adjacent repetition DEEPENS a word rather than repeating it: fire fire is
  // one token, flame — and a mastered "flame" arrives already two deep. Only
  // adjacency counts: "fire pierce fire" is two fires in two clauses. Targets
  // never stack (an address repeated is an address), and no mouth holds a
  // fourth — not even a mastered one's worth.
  const tokens: SpokenWord[] = [];
  for (const s of spoken) {
    const last = tokens[tokens.length - 1];
    // Targets and conjunctions never deepen — an address repeated is an
    // address, and "then then" is not a deeper then, it is a broken sentence.
    if (last && last.def.id === s.def.id && s.def.kind !== 'target' && s.def.kind !== 'conjunction') {
      if (last.count + s.tier > MAX_STACK) {
        return none(`No mouth can hold a fourth "${s.def.word}"`);
      }
      last.count += s.tier;
    } else {
      tokens.push({ def: s.def, count: s.tier });
    }
  }

  const clauses: ArcaneClause[] = [];
  let target: SpellTarget = 'one';
  let open: ArcaneClause | null = null;
  /** A conjunction waiting for the clause it promised. */
  let pendingLink: ArcaneWordDef | null = null;

  const close = () => {
    if (open && (open.noun || open.verb || open.adverbs.length)) clauses.push(open);
    open = null;
  };
  const openClause = (): ArcaneClause => {
    const clause: ArcaneClause = { adverbs: [], led: 'noun' };
    if (pendingLink) {
      clause.linked = pendingLink;
      pendingLink = null;
    }
    return clause;
  };

  for (const t of tokens) {
    const w = t.def;
    if (w.kind === 'target') {
      // An address, not a clause member. The last one spoken seals the spell.
      target = w.target ?? 'one';
      continue;
    }
    if (w.kind === 'conjunction') {
      // Belongs to no clause: closes the one before, binds the one after.
      if (!open && clauses.length === 0) {
        return none(`"${w.word}" follows nothing`);
      }
      if (pendingLink) return none(`"${w.word}" follows nothing`);
      close();
      pendingLink = w;
      continue;
    }
    open ??= openClause();
    if (w.kind === 'adverb') {
      if (!open.noun && !open.verb) t.preCore = true;
      open.adverbs.push(t);
      continue;
    }
    if (w.kind === 'noun') {
      if (open.noun) {
        close();
        open = openClause();
      }
      open.noun = t;
      if (!open.verb) open.led = 'noun';
      continue;
    }
    // Verb.
    if (open.verb) {
      close();
      open = openClause();
    }
    open.verb = t;
    if (!open.noun) open.led = 'verb';
  }
  close();
  // A conjunction with no clause after it promised a sequel it never spoke.
  if (pendingLink) {
    return none(`"${(pendingLink as ArcaneWordDef).word}" leads nowhere`);
  }

  if (!clauses.some((c) => c.noun || c.verb)) {
    return { ok: false, reason: text('arcane.reason.no_noun_or_verb'), clauses, target, words, tokens };
  }
  return { ok: true, clauses, target, words, tokens };
}

// ---------- Composing ----------

/** Scale a status application's intensity, keeping its chance as declared. */
function scaleInflicts(apps: StatusApplication[] | undefined, mult: number): StatusApplication[] | undefined {
  if (!apps || mult <= 0) return undefined;
  return apps.map((a) => ({ ...a, intensity: (a.intensity ?? 1) * mult }));
}

/**
 * Scale how READILY conditions take hold — the verb's delivery, not the
 * substance's depth. Certainty is never quite reached: a cut delivers well,
 * but nothing in the grammar guarantees an affliction.
 */
function scaleChance(apps: StatusApplication[] | undefined, mult: number): StatusApplication[] | undefined {
  if (!apps || mult === 1) return apps;
  return apps.map((a) => ({ ...a, chance: Math.min(0.95, (a.chance ?? 1) * mult) }));
}

/**
 * Stretch or compress how long inflicted conditions run, thinning or
 * thickening their bite to match (`intMult` is the trailing adverb's
 * conservation term — 1 when only the window moved). Conditions with no
 * clock of their own (removal-bound) cannot be hurried and are left alone.
 */
function shapeConditions(
  apps: StatusApplication[] | undefined,
  durMult: number,
  intMult: number,
): StatusApplication[] | undefined {
  if (!apps || (durMult === 1 && intMult === 1)) return apps;
  return apps.map((a) => {
    const base = STATUSES[a.id]?.duration;
    const out: StatusApplication = { ...a, intensity: (a.intensity ?? 1) * intMult };
    if (base && durMult !== 1) out.duration = Math.max(1, Math.round(base * durMult));
    return out;
  });
}

/** Capitalise a spoken word for the generated name. */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * What "with" can accompany: the last clause that ACTED, and what each kind
 * needs remembered to take a lent substance. Wider than a strike chain on
 * purpose — a ward or a mending breaks "then", but can still be accompanied.
 */
type Acting =
  | { kind: 'strike'; strike: SpellStrike }
  /** `base` is the ward's thickness per unit of substance, dials aside. */
  | { kind: 'ward'; base: number; duration: number }
  /** Everything the mending multiplies a substance's weight by. */
  | { kind: 'mend'; restoreMult: number }
  | { kind: 'undo'; part: { burn: number; hits: number } };

/**
 * Compose a sentence into a SpellSpec. Pure: sentence in, spell out, no state.
 * Callers wanting legality (level gates, length caps) go through
 * `checkSentence`; this will happily compose a master's sentence for a novice
 * to read about.
 */
export function composeArcane(
  wordIds: string[],
  /**
   * How well the speaker knows each word (see wordLevels). Omitted gives the
   * BARE reading — the sentence as the grammar has it, which is what the
   * grimoire caches and what two mages comparing notes would agree on. The
   * contextual reading (resolveSpellFor) passes levels, exactly as psionics
   * passes its gear bias.
   */
  levels?: Record<string, number>,
): SpellSpec | null {
  const parse = parseSentence(wordIds);
  if (!parse.ok) return null;

  const strikes: SpellStrike[] = [];
  let heal = 0;
  let splash = 0;
  /** Spill before caps, so "everything" can be recognised when it is earned. */
  let splashRaw = 0;
  let manaCost = 0;
  let cooldownMult = 1;
  let wardMods: Modifier[] = [];
  let wardDuration = 0;
  let target = parse.target;
  /** Breadth index: linked clauses are depth, not breadth — they keep their
   * chain head's share instead of diluting the working further. */
  let shareIndex = -1;
  /** "or" groups minted so far. */
  let altGroups = 0;
  /** The previous DAMAGING clause's strike, for a conjunction to key off. */
  let prevStrike: SpellStrike | null = null;
  /** The previous clause that acted at all, for "with" to accompany. */
  let prevActing: Acting | null = null;
  /** What the working is made of, for somebody else's undoing to match. */
  const signature: Partial<Record<DamageType, number>> = {};
  /**
   * The undoing, pooled: every clause that undoes feeds ONE counterspell —
   * its tiers, its tuning, its share of the burn. A sentence answers a
   * working once, however many ways it was told to.
   */
  let undoTiers = 0;
  const tuning: Partial<Record<DamageType, number>> = {};
  const undoParts: { burn: number; hits: number }[] = [];
  // Nothing ("zero") is nothing to tune against.
  const tune = (noun: ArcaneWordDef, units: number) => {
    if (noun.untyped || !noun.element) return;
    tuning[noun.element] = (tuning[noun.element] ?? 0) + units;
  };

  parse.clauses.forEach((clause) => {
    if (!clause.linked) shareIndex += 1;
    const share = clauseShare(Math.max(0, shareIndex));
    const led = clause.led === 'verb' ? VERB_LED : NOUN_LED;
    const noun = clause.noun?.def;
    const verb = clause.verb?.def.verb;
    // Repetition deepens: flame is not two fires, it is fire squared-ish.
    const nounStack = STACK_POWER[(clause.noun?.count ?? 1) - 1];
    const verbStack = STACK_POWER[(clause.verb?.count ?? 1) - 1];
    const verbCount = clause.verb?.count ?? 1;

    // How the clause was spoken. A stacked adverb compounds itself. Landing
    // adverbs are tracked by POSITION — before the noun they speak about the
    // applying, after it about the substance; a striking clause lands either
    // way, but a transmuting one reads the difference (see the "but" branch).
    /*
     * Practice, folded in before anything else touches the clause.
     *
     * Every word the clause is made of lends it a little of its own weight,
     * compounding — so a sentence of well-worn words is stronger than the
     * same sentence from a novice, and the bonus reaches strikes, mendings
     * and wards alike because all three read powerMult. Conjunctions and
     * addresses are structure rather than force; they level for their gifts,
     * not for their weight.
     */
    let powerMult = [clause.noun, clause.verb, ...clause.adverbs].reduce(
      (mult, t) => (t ? mult * wordBonusFor(levels, t.def.id) : mult),
      1,
    );
    let manaMult = 1;
    let hitsPre = 1;
    let hitsPost = 1;
    /** Condition-clock shaping: window multiplier and per-tick rate, each
     * position bringing its own shape (see ArcaneAdverbSpec.clock). */
    let condDur = 1;
    let condRate = 1;
    /** How deeply this clause's conditions bite, before the floor. */
    let condIntensity = 1;
    /** How much likelier (or less) this clause is to find the vital spot... */
    let critAdd = 0;
    /** ...and how much wider (or narrower) the one it finds opens. */
    let critDamageAdd = 0;
    for (const adv of clause.adverbs) {
      const a = adv.def.adverb;
      if (!a) continue;
      powerMult *= Math.pow(a.powerMult ?? 1, adv.count);
      /*
       * Deliberately NOT raised to the power of `count`. A deepened word
       * already pays for its own repetition through STACK_MANA (2 → 6 → 12),
       * and compounding the clause multiplier on top charges twice for the
       * same breath — which is what made "fourfold" cost 93 mana and turned
       * the deepest landing adverb into a dead word. The word's own escalating
       * cost IS the price of saying it three times.
       */
      manaMult *= a.manaMult ?? 1;
      cooldownMult *= Math.pow(a.cooldownMult ?? 1, adv.count);
      condIntensity *= Math.pow(a.intensity ?? 1, adv.count);
      // Crit reads by position like everything else: leading is about the
      // casting (how often the seam is sought), trailing about the substance
      // (how wide it opens). Both ADD per tier rather than compounding.
      if (a.crit) {
        const side = adv.preCore ? a.crit.lead : a.crit.trail;
        critAdd += (side?.chance ?? 0) * adv.count;
        critDamageAdd += (side?.damage ?? 0) * adv.count;
      }
      if (a.clock) {
        const side = adv.preCore ? a.clock.lead : a.clock.trail;
        condDur *= Math.pow(side.dur, adv.count);
        condRate *= Math.pow(side.rate, adv.count);
      }
      // "twice twice" is thrice: repetition adds a landing, not a doubling.
      if (a.hits) {
        const landings = a.hits + (adv.count - 1);
        if (adv.preCore) hitsPre = Math.max(hitsPre, landings);
        else hitsPost = Math.max(hitsPost, landings);
      }
    }
    /**
     * The number/depth axis, applied to landings: LEADING landing-adverbs are
     * about the applying — N separate landings. TRAILING are about the
     * substance — ONE landing carrying N-fold weight, blow and riders alike.
     * "Fourfold blaze" is a volley; "blaze fourfold" is a spike.
     */
    const hits = hitsPre;
    const depth = hitsPost;

    // Mana: every word costs its share — and a deepened word costs its
    // STACK_MANA multiple, which outruns what the deepening buys. An
    // or-linked clause pays only its alternative's share: it might not fire.
    const spoken = [clause.noun, clause.verb, ...clause.adverbs];
    manaCost +=
      spoken.reduce(
        (sum, t) => sum + (t?.def.mana ?? 0) * STACK_MANA[(t?.count ?? 1) - 1],
        0,
      ) * manaMult * (clause.linked?.conjunction?.alternate ?? 1);

    if (verb?.cooldownMult) cooldownMult *= Math.pow(verb.cooldownMult, verbCount);

    // What the clause is MADE of, as spoken — its noun at its depth, or a
    // striking verb's own substance when it stands bare. Read for every clause
    // that says something, acting or not: an undoing matches the words, not
    // what they happened to be doing. Wards, mendings and undoings spoken
    // bare carry no substance of their own.
    if (noun && !noun.untyped && noun.element) {
      signature[noun.element] = (signature[noun.element] ?? 0) + (clause.noun?.count ?? 1);
    } else if (!noun && verb && verb.restore === undefined && !verb.ward && !verb.undo) {
      const substance = verb.bareType ?? 'arcane';
      signature[substance] = (signature[substance] ?? 0) + verbCount;
    }

    /*
     * "with": a bare substance lent to whatever the clause before it DID,
     * rather than a clause acting on its own. Only a noun with no verb is
     * lent — a linked clause that speaks its own verb acts for itself, and
     * has merely escaped the breadth tax like any linked clause.
     *
     * Undoing is what it was made for: the substance joins the TUNING, and
     * its adverbs ride the burn. Elsewhere it lends what the substance would
     * have given in that clause's place — riders to a blow (nature and weight
     * untouched, so "zero with venom" stays nothing, and poisons), a coat
     * against its own element to a ward, its weight to a mending.
     */
    const linkedBy = clause.linked?.conjunction;
    if (linkedBy?.accompany !== undefined && prevActing && noun && clause.noun && !clause.verb) {
      const acting: Acting = prevActing;
      const floored = Math.max(INTENSITY_FLOOR, condIntensity);
      switch (acting.kind) {
        case 'undo':
          tune(noun, clause.noun.count);
          acting.part.burn *= powerMult * floored * depth;
          acting.part.hits = Math.max(acting.part.hits, hits);
          break;
        case 'strike': {
          // Shaped as the substance would be on a blow of its own: depth and
          // intensity for how deep, the clock for how long. Leading landing
          // adverbs lend it that many times over, the way "but" donates.
          const lent = shapeConditions(scaleInflicts(noun.inflicts, nounStack * depth * floored), condDur, condRate);
          if (lent) {
            const copies = hits > 1 ? Array.from({ length: hits }, () => lent.map((a) => ({ ...a }))).flat() : lent;
            acting.strike.inflicts = [...(acting.strike.inflicts ?? []), ...copies];
          }
          break;
        }
        case 'ward': {
          const amount =
            acting.base * nounStack * powerMult * floored * depth * condRate * share * linkedBy.accompany;
          wardMods = [
            ...wardMods,
            noun.element
              ? { stat: RES_STAT_BY_TYPE[noun.element], op: 'add' as const, value: amount }
              : { stat: 'armor' as const, op: 'add' as const, value: amount * 20 },
          ];
          wardDuration = Math.max(wardDuration, Math.max(1, Math.round(acting.duration * condDur * hits)));
          break;
        }
        case 'mend':
          heal += (noun.power ?? 0) * nounStack * acting.restoreMult * powerMult * share * hits * depth * linkedBy.accompany;
          break;
      }
      return;
    }

    /*
     * An UNDOING: the clause neither strikes nor tends — it makes the working
     * a counterspell. Its noun tunes it; its tiers raise the efficiency the
     * trap will meet a working with; and everything else the grammar reads
     * (leading, weight, practice, intensity, depth, breadth) goes into the
     * BURN it lays on that working's caster. Like a mending, it breaks any
     * strike chain: there is no blow here for "then" to follow.
     */
    if (verb?.undo) {
      undoTiers += verbCount;
      if (noun && clause.noun) tune(noun, clause.noun.count);
      const part = {
        burn:
          verb.undo.burn *
          (noun ? led.power : 1) *
          powerMult *
          share *
          Math.max(INTENSITY_FLOOR, condIntensity) *
          depth,
        hits,
      };
      undoParts.push(part);
      prevActing = { kind: 'undo', part };
      prevStrike = null;
      return;
    }

    // Restorative clauses land on the caster — unless the sentence SPOKE an
    // address at somebody else. "Water mend" tends your own wounds; "water
    // mend one" pours the mending into the enemy, and a body already whole
    // has nowhere to put it (see StatusDef.surplus — overgrowth). Either way
    // a mending breaks a strike chain: no blow for "then" to follow.
    if (verb?.restore !== undefined) {
      const base = noun ? (noun.power ?? 0) * nounStack * (verb.powerMult ?? 1) : 0.5;
      heal += base * verb.restore * verbStack * led.power * powerMult * share * hits * depth;
      prevStrike = null;
      prevActing = { kind: 'mend', restoreMult: (verb.powerMult ?? 1) * verb.restore * verbStack * led.power };
      return;
    }
    if (verb?.ward) {
      /*
       * A ward is a coat worn against a substance, so it reads every dial the
       * rest of the grammar does — the substance's own depth included, which
       * is what makes "glacier ward" worth more than "ice ward" rather than
       * merely costlier. Strength and lifetime split along the same seam as
       * everywhere else: intensity and depth thicken the coat, the clock
       * lengthens it, and a trailing clock adverb thins what it stretches.
       */
      const amount =
        verb.ward.amount *
        verbStack *
        nounStack *
        led.mechanics *
        powerMult *
        Math.max(INTENSITY_FLOOR, condIntensity) *
        depth *
        condRate *
        share;
      wardMods = [
        ...wardMods,
        noun?.element
          ? { stat: RES_STAT_BY_TYPE[noun.element], op: 'add' as const, value: amount }
          : // Warded bare, the working hardens the skin a little instead.
            { stat: 'armor' as const, op: 'add' as const, value: amount * 20 },
      ];
      // Leading landing-adverbs buy WEAR rather than another coat: a ward
      // spoken twice over is one ward that lasts twice as long.
      wardDuration = Math.max(
        wardDuration,
        Math.max(1, Math.round(verb.ward.duration * condDur * hits)),
      );
      prevStrike = null;
      prevActing = {
        kind: 'ward',
        base: verb.ward.amount * verbStack * led.mechanics,
        duration: verb.ward.duration,
      };
      return;
    }

    // A damaging clause: substance shaped by action, or raw force alone.
    let power: number;
    if (noun && verb) power = (noun.power ?? 0) * nounStack * (verb.powerMult ?? 1) * led.power;
    else if (noun) power = (noun.power ?? 0) * nounStack * UNSHAPED_POWER;
    else power = (verb?.barePower ?? 0) * verbStack;
    // Depth folds into the single landing; volume stays as separate hits.
    power *= powerMult * share * depth;
    if (power <= 0) return;

    const mechanics = clause.verb ? led.mechanics : 1;
    const strike: SpellStrike = {
      // The substance decides what it is. Spoken bare, a physical verb IS
      // its own substance ("cut one" is a slash); anything else falls back
      // to raw arcane force.
      type: noun?.element ?? (verb?.bareType ?? 'arcane'),
      power,
    };
    // Zero's identity: not anything, so resisted by nothing, feared by nothing.
    if (noun?.untyped) strike.untyped = true;
    // How the clause was spoken decides how hungrily it looks for the seam,
    // and how wide the one it finds opens.
    if (critAdd !== 0) strike.critBonus = critAdd;
    if (critDamageAdd !== 0) strike.critDamageBonus = critDamageAdd;
    if (verb?.penetration) {
      strike.penetration = Math.min(0.95, verb.penetration * mechanics * verbStack);
    }
    if (hits > 1) strike.hits = hits;
    const grip = verb?.gripMult ? verb.gripMult * mechanics * verbStack : 1;
    // What the clause afflicts with: the substance's own signature, or —
    // spoken bare — the verb's. How DEEPLY is the noun's business (grip,
    // stacking, depth); how READILY is the verb's (statusRate).
    const carried = noun?.inflicts ?? (noun ? undefined : verb?.bareInflicts);
    const inflicts = shapeConditions(
      scaleChance(
        scaleInflicts(carried, nounStack * grip * depth * Math.max(INTENSITY_FLOOR, condIntensity)),
        verb?.statusRate ? Math.pow(verb.statusRate, verbCount) * mechanics : 1,
      ),
      condDur,
      condRate,
    );
    if (inflicts) strike.inflicts = inflicts;
    if (verb?.splash) {
      const raw = verb.splash * mechanics * verbStack;
      splashRaw += raw;
      splash = Math.min(0.75, splash + raw);
    }
    // The conjunction's grammar, keyed off whatever spec the word declared.
    // With no preceding strike to act on, a conjunction is a no-op and the
    // clause stands alone — deterministic, if a little lonely.
    const conj = clause.linked?.conjunction;
    if (conj && prevStrike) {
      if (conj.fuse) {
        // "and": one blow, two natures. The joined clause's whole weight —
        // hits folded in — is added at the fusion's efficiency; the blow
        // lands as whichever nature the target guards worse.
        //
        // Nothing fused with something is SOMETHING. An untyped head (zero)
        // may not launder a substance through itself: the mixture takes the
        // joined clause's nature and stops being nothing, which is what
        // stops "zero and blaze" being a resistance-proof blaze.
        if (prevStrike.untyped && !strike.untyped) {
          delete prevStrike.untyped;
          prevStrike.type = strike.type;
        } else if (!prevStrike.orType && strike.type !== prevStrike.type) {
          prevStrike.orType = strike.type;
        }
        prevStrike.power += strike.power * (strike.hits ?? 1) * conj.fuse;
        if (strike.penetration) {
          prevStrike.penetration = Math.max(prevStrike.penetration ?? 0, strike.penetration);
        }
        if (strike.inflicts) {
          prevStrike.inflicts = [...(prevStrike.inflicts ?? []), ...strike.inflicts];
        }
        return;
      }
      if (conj.transmute) {
        // "but": the clause does not strike — it transmutes, its riders
        // replacing the blow's own, and ORDER decides how a landing adverb
        // reads. Trailing ("glacier fourfold") speaks about the substance:
        // one application, four times as deep. Leading ("fourfold glacier")
        // speaks about the applying: four separate applications, which meet
        // the condition's own stacking rules — enough of them can cap a sum
        // and ESCALATE. Riderless words still strip the blow clean.
        // Depth and clock shaping are already folded into the riders; the
        // donation adds the clause's spoken weight, and volume duplicates.
        const donated = scaleInflicts(strike.inflicts, powerMult);
        prevStrike.inflicts =
          donated && hitsPre > 1
            ? Array.from({ length: hitsPre }, () => donated.map((a) => ({ ...a }))).flat()
            : donated;
        return;
      }
      if (conj.condition) {
        // "if": the clause does not strike — its noun names the affliction
        // the blow before it demands. Conditioned on a riderless word, the
        // blow is conditioned on nothing, and nothing never comes true.
        prevStrike.onlyIf = signatureStatuses(noun?.inflicts);
        return;
      }
      if (conj.alternate) {
        // "or": this clause and the one before become alternatives — both
        // real strikes, one rolled per cast.
        if (prevStrike.altGroup === undefined) prevStrike.altGroup = altGroups++;
        strike.altGroup = prevStrike.altGroup;
        prevStrike = strike;
        prevActing = { kind: 'strike', strike };
        strikes.push(strike);
        return;
      }
      if (conj.inheritPenetration) {
        strike.penetration = Math.max(strike.penetration ?? 0, prevStrike.penetration ?? 0) || undefined;
      }
      if (conj.followThrough) strike.followUp = conj.followThrough;
    }
    prevStrike = strike;
    prevActing = { kind: 'strike', strike };
    strikes.push(strike);
  });

  // Expanded far enough, a working stops spilling and simply addresses
  // EVERYONE — "expand expand expand". A spoken address still outranks it.
  if (splashRaw >= EVERYTHING_SPLASH && target === 'one') {
    target = 'others';
    splash = 0;
  }

  // Clause-less words — addresses and conjunctions — cost their mana too,
  // and a spoken broadside thins the pool (an EARNED one already paid for
  // its expands).
  manaCost += parse.words
    .filter((w) => w.kind === 'target' || w.kind === 'conjunction')
    .reduce((s, w) => s + (w.mana ?? 0), 0);
  if (parse.target === 'others') manaCost *= OTHERS_MANA_MULT;

  const cooldown = Math.round(
    Math.min(COOLDOWN_RANGE[1], Math.max(COOLDOWN_RANGE[0], BASE_COOLDOWN * cooldownMult)),
  );

  // The grammar's darkest gift: a mending explicitly ADDRESSED at an enemy
  // heals the enemy. Implicit addresses keep healing the caster, so every
  // sentence written before this rule existed means what it always meant.
  const spokeAddress = parse.words.some((w) => w.kind === 'target');
  const healsEnemy = heal > 0 && spokeAddress && target !== 'self';

  const lead = parse.clauses.find((c) => c.noun)?.noun ?? parse.clauses[0].verb;
  const spec: SpellSpec = {
    // Deepened words wear their deepened names: "Blaze Pierce", not
    // "Fire Fire Fire Pierce".
    name: parse.tokens.map((t) => cap(displayWord(t))).join(' '),
    icon: lead?.def.icon ?? '✨',
    school: 'arcane',
    target,
    strikes,
    manaCost: Math.max(1, Math.round(manaCost)),
    cooldown,
  };
  if (heal > 0) spec.heal = heal;
  if (healsEnemy) spec.healsEnemy = true;
  if (splash > 0) spec.splash = splash;
  if (wardMods.length) spec.buff = { name: 'Ward', mods: wardMods, duration: wardDuration };
  if (undoTiers > 0) {
    spec.counter = { tiers: undoTiers, tuning, burn: undoParts.reduce((sum, p) => sum + p.burn, 0) };
    const burns = Math.max(1, ...undoParts.map((p) => p.hits));
    if (burns > 1) spec.counter.burns = burns;
  }
  if (Object.keys(signature).length) spec.signature = signature;
  return spec;
}

// ---------- Legality ----------

export interface SentenceCheck {
  ok: boolean;
  reason?: string;
  spec?: SpellSpec;
  parse?: ArcaneParse;
}

/** Whether THIS mage may speak this sentence, and what it would make. */
export function checkSentence(state: GameState, wordIds: string[]): SentenceCheck {
  const level = arcaneLevel(state);
  if (wordIds.length === 0) return { ok: false, reason: text('arcane.reason.empty') };
  const max = maxSentenceWords(level);
  if (wordIds.length > max) {
    return { ok: false, reason: text('arcane.reason.too_many_words', { max, level }) };
  }
  for (const raw of wordIds) {
    const { id, tier } = splitWordId(raw);
    const w = ARCANE_WORDS[id];
    if (!w) return { ok: false, reason: text('arcane.reason.no_such_word', { word: raw }) };
    // The starter-lexicon shutter (systems/unlocks.ts): a locked word is not
    // merely too advanced, it is not yours at all — and the refusal says so
    // without naming what would unlock it. LEGALITY only: composeArcane never
    // hears about it, so monsters and the bench's pure reading are untouched.
    if (!wordUnlocked(state, id)) {
      return { ok: false, reason: text('arcane.reason.unknown_word', { word: w.word }) };
    }
    if ((w.minLevel ?? 0) > level) {
      return { ok: false, reason: text('arcane.reason.word_level', { word: w.word, level: w.minLevel }) };
    }
    // A deepened word must be EARNED: spoken enough in its plain form first.
    if (tier > 1 && masteredTier(state, id) < tier) {
      const name = w.stacked?.[tier - 2] ?? `${w.word} ×${tier}`;
      const need = WORD_MASTERY[tier - 2];
      return {
        ok: false,
        reason: text('arcane.reason.word_unearned', { name, word: w.word, uses: wordUses(state, id), need }),
      };
    }
  }
  const parse = parseSentence(wordIds);
  if (!parse.ok) return { ok: false, reason: parse.reason, parse };
  // The bench shows the sentence as THIS speaker would say it, practice and
  // all — the same reading resolveSpellFor gives once it is inscribed.
  const spec = composeArcane(wordIds, wordLevels(state));
  if (!spec) return { ok: false, reason: parse.reason ?? 'The words fizzle', parse };
  return { ok: true, spec, parse };
}
