import type { WuxinBond, WuxinConfig } from '../types';
import { ARCANE_WORDS } from '../data/spellcraft.data';

/**
 * Wuxin — the five-element cycle, as a graph the player rewires.
 *
 * WHAT THIS MODULE IS
 *
 * The shape of a configuration and the rules about what shapes are legal. Five
 * slots; each holds an element, points a *generative* arrow at one other slot
 * and a *destructive* arrow at another. That is the whole vocabulary.
 *
 * WHAT THIS MODULE DELIBERATELY IS NOT
 *
 * There is not one number in this file, and that is on purpose. Nothing here
 * says what nourishing DOES, what hindering COSTS, or how much of either. The
 * structure has to settle before the effects do, because the effects are going
 * to be argued about for a long time and the structure should not have to be
 * reopened every time they are. When the effects arrive they belong in their
 * own module reading this one — not bolted in here.
 *
 * THE TWO FACTS THAT MAKE CLASSIFICATION FREE
 *
 * 1. A permutation of five elements with no element pointing at itself
 *    decomposes into EITHER one 5-cycle OR a 2-cycle plus a 3-cycle. Nothing
 *    else is possible (2+2+1 and 4+1 and 3+1+1 all need a fixed point). So an
 *    unsevered cycle is either one ring through everything, or a mutually
 *    feeding pair standing apart from a triangle. There is no third shape, and
 *    that is a very small space to balance.
 *
 * 2. The classical loop is `hinders = nourishes ∘ nourishes`. Take the
 *    generative ring wood→fire→earth→metal→water→wood and apply it twice:
 *    wood→earth, fire→metal, earth→water, metal→wood, water→fire — which is
 *    exactly the classical destructive cycle, the pentagram inscribed in the
 *    pentagon. So harmony is a RELATION between the two arrow sets, not a
 *    hardcoded table: any five elements wired so that each one hinders what its
 *    nourished element nourishes is a harmonious variant, whatever is in the
 *    slots. `discord()` counts how far from that a configuration sits, which
 *    is also the natural balance dial.
 *
 * Configurations are not the player's alone. Sects, martial masters and great
 * beasts each carry one, authored as five lines of the grammar below.
 */

/** A cycle is five slots. Not a tuning knob — both facts above depend on it. */
export const WUXIN_SLOTS = 5;

/**
 * Elements are drawn from the arcane lexicon's nouns, which is what makes
 * adding a noun to spellcraft widen what a cycle can be built from. The nouns
 * INFORM the vocabulary; they are not substituted for, and a cycle is not a
 * sub-component of arcane magic. Nothing here casts anything.
 */
export const WUXIN_EXCLUDED = [
  // `zero` is untyped — nothing resists it and nothing fears it — so it has no
  // natural relation to anything and cannot meaningfully nourish or hinder.
  // Excluded until it is deliberately made the wildcard rather than an
  // accident. One line to reverse when that is decided.
  'zero',
];

/** Every element a slot may currently hold. */
export function eligibleElements(): string[] {
  return Object.values(ARCANE_WORDS)
    .filter((w) => w.kind === 'noun' && !WUXIN_EXCLUDED.includes(w.id))
    .map((w) => w.id);
}

// ---------- The grammar ----------

/**
 * One clause per element, five clauses per configuration:
 *
 *     fire  → earth ⊣ metal
 *     earth → metal ⊣ water
 *     metal → water ⊣ wood
 *     water → wood  ⊣ fire
 *     wood  → fire  ⊣ earth
 *
 * `→` nourishes, `⊣` hinders, `∅` severs an arrow. Read aloud: "fire nourishes
 * earth, hinders metal." That is the whole syntax — a sect, a beast or a
 * player's own cycle is five of these lines and nothing else.
 */
export const NOURISHES = '→';
export const HINDERS = '⊣';
export const SEVERED = '∅';

/** A configuration as text, one clause per line. */
export function formatWuxin(cfg: WuxinConfig): string {
  const width = Math.max(...cfg.slots.map((s) => s.element.length));
  return cfg.slots
    .map((s) => {
      const from = s.element.padEnd(width);
      return `${from} ${NOURISHES} ${s.nourishes ?? SEVERED} ${HINDERS} ${s.hinders ?? SEVERED}`;
    })
    .join('\n');
}

/**
 * Read a configuration back from the grammar. Lenient about whitespace and
 * accepts plain-ASCII `->` and `-|` so a configuration can be typed without
 * hunting for glyphs. Returns null on anything it cannot read — callers should
 * run `validateWuxin` on the result regardless, since parsing only proves the
 * text was well formed, not that the cycle is legal.
 */
export function parseWuxin(text: string): WuxinConfig | null {
  const slots: WuxinBond[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(
      new RegExp(`^(\\S+)\\s*(?:${NOURISHES}|->)\\s*(\\S+)\\s*(?:${HINDERS}|-\\|)\\s*(\\S+)$`),
    );
    if (!m) return null;
    const [, element, nourishes, hinders] = m;
    slots.push({
      element,
      nourishes: nourishes === SEVERED ? null : nourishes,
      hinders: hinders === SEVERED ? null : hinders,
    });
  }
  return slots.length ? { slots } : null;
}

// ---------- Legality ----------

export type WuxinProblem =
  | { kind: 'slotCount'; found: number }
  | { kind: 'duplicateElement'; element: string }
  | { kind: 'unknownElement'; element: string }
  | { kind: 'selfArrow'; element: string; relation: WuxinRelation }
  | { kind: 'danglingArrow'; element: string; relation: WuxinRelation; target: string }
  | { kind: 'contested'; relation: WuxinRelation; target: string; by: string[] };

export type WuxinRelation = 'nourishes' | 'hinders';

const RELATIONS: WuxinRelation[] = ['nourishes', 'hinders'];

/**
 * Everything wrong with a configuration, or an empty list. Severed arrows are
 * NOT a problem — they are how the non-harmonious shapes are expressed, and
 * `classify` is what has an opinion about them.
 */
export function validateWuxin(cfg: WuxinConfig): WuxinProblem[] {
  const problems: WuxinProblem[] = [];
  if (cfg.slots.length !== WUXIN_SLOTS) {
    problems.push({ kind: 'slotCount', found: cfg.slots.length });
  }

  const eligible = new Set(eligibleElements());
  const seen = new Set<string>();
  for (const slot of cfg.slots) {
    if (seen.has(slot.element)) problems.push({ kind: 'duplicateElement', element: slot.element });
    seen.add(slot.element);
    if (!eligible.has(slot.element)) {
      problems.push({ kind: 'unknownElement', element: slot.element });
    }
  }

  for (const relation of RELATIONS) {
    // In-degree: an element is pointed at by AT MOST one of each kind. More
    // than one and the cycle is not a cycle, it is a tangle.
    const pointedBy = new Map<string, string[]>();
    for (const slot of cfg.slots) {
      const target = slot[relation];
      if (target === null) continue;
      if (target === slot.element) {
        problems.push({ kind: 'selfArrow', element: slot.element, relation });
        continue;
      }
      if (!seen.has(target)) {
        problems.push({ kind: 'danglingArrow', element: slot.element, relation, target });
        continue;
      }
      pointedBy.set(target, [...(pointedBy.get(target) ?? []), slot.element]);
    }
    for (const [target, by] of pointedBy) {
      if (by.length > 1) problems.push({ kind: 'contested', relation, target, by });
    }
  }

  return problems;
}

export function isLegal(cfg: WuxinConfig): boolean {
  return validateWuxin(cfg).length === 0;
}

// ---------- Shape ----------

/** One relation as a lookup: element → what it points at, or null. */
export function arrowsOf(cfg: WuxinConfig, relation: WuxinRelation): Map<string, string | null> {
  return new Map(cfg.slots.map((s) => [s.element, s[relation]]));
}

export interface WuxinShape {
  /** Closed loops, each listed from an arbitrary starting element. */
  cycles: string[][];
  /** Open runs, from an element nothing points at to a severed end. */
  chains: string[][];
  /** How many arrows of this relation are cut. */
  severed: number;
}

/**
 * Decompose one relation into its loops and its open runs.
 *
 * With every arrow intact this can only ever return one 5-cycle or a 2-cycle
 * and a 3-cycle (see the header). Sever an arrow and a loop opens into a chain
 * — which is the "circular line" a burst configuration is made of: energy runs
 * down it and out the end rather than round and round.
 */
export function shapeOf(cfg: WuxinConfig, relation: WuxinRelation): WuxinShape {
  const arrows = arrowsOf(cfg, relation);
  const elements = cfg.slots.map((s) => s.element);
  const severed = elements.filter((e) => arrows.get(e) == null).length;

  // Anything nothing points at can only be the head of an open run.
  const targets = new Set([...arrows.values()].filter((t): t is string => t != null));
  const chains: string[][] = [];
  const visited = new Set<string>();
  for (const head of elements) {
    if (targets.has(head)) continue;
    const run: string[] = [];
    let at: string | null | undefined = head;
    while (at != null && !visited.has(at)) {
      visited.add(at);
      run.push(at);
      at = arrows.get(at);
    }
    chains.push(run);
  }

  // Whatever is left after the open runs is closed by definition.
  const cycles: string[][] = [];
  for (const start of elements) {
    if (visited.has(start)) continue;
    const loop: string[] = [];
    let at: string | null | undefined = start;
    while (at != null && !visited.has(at)) {
      visited.add(at);
      loop.push(at);
      at = arrows.get(at);
    }
    cycles.push(loop);
  }

  return { cycles, chains, severed };
}

/**
 * How far a configuration sits from harmony: the number of elements whose
 * destructive arrow is NOT where two generative steps would land. Zero is the
 * classical relation, whatever elements are actually in the slots — which is
 * what makes "a harmonious variant" emergent rather than a list somebody has
 * to maintain.
 *
 * A severed generative arrow makes its element's relation undefined rather than
 * merely wrong; it counts as discord, because a cycle you cannot walk twice is
 * not the classical cycle.
 */
export function discord(cfg: WuxinConfig): number {
  const gen = arrowsOf(cfg, 'nourishes');
  const des = arrowsOf(cfg, 'hinders');
  let count = 0;
  for (const slot of cfg.slots) {
    const once = gen.get(slot.element);
    const twice = once == null ? null : gen.get(once);
    if (twice == null || des.get(slot.element) !== twice) count += 1;
  }
  return count;
}

export function isHarmonious(cfg: WuxinConfig): boolean {
  return discord(cfg) === 0;
}

/**
 * Destruction is generation run BACKWARDS: every element hinders the one that
 * nourishes it. Stated the other way round, which is the striking form — X
 * nourishes Y, and Y hinders X. Every pair along the ring is feeding its own
 * attacker.
 *
 * The antipode of harmony, and always maximally discordant: for a single ring,
 * two generative steps and one backwards step can never agree anywhere, so a
 * counterflow reads `discord === WUXIN_SLOTS` whatever is in the slots, the
 * same way a harmonious cycle always reads zero.
 *
 * Written against the arrows directly rather than as "the fourth power", so it
 * still means what it says when generation closes as two loops instead of one.
 */
export function isCounterflow(cfg: WuxinConfig): boolean {
  const gen = arrowsOf(cfg, 'nourishes');
  const des = arrowsOf(cfg, 'hinders');
  return cfg.slots.every((slot) => {
    const hindered = des.get(slot.element);
    return hindered != null && gen.get(hindered) === slot.element;
  });
}

/**
 * How far around the generative ring destruction reaches: the k for which
 * `hinders = nourishes^k`, or null when there is no single such k.
 *
 * When both relations close into one ring, this one number IS the character of
 * the configuration, and the named kinds are points on it:
 *
 *   k = 1  destruction is generation — you feed and fight the same thing
 *   k = 2  HARMONIOUS: the classical relation, the pentagram inscribed
 *   k = 3  the pentagram traced the other way; unnamed
 *   k = 4  COUNTERFLOW: generation reversed, feeding your own attacker
 *
 * Null is not a failure — it is what a genuinely arbitrary rewiring looks like,
 * and it is the difference between "structured, just not the structure you were
 * looking for" and "no structure at all". A split cycle usually returns null
 * even when it is regular, because walking generation from inside a two-loop
 * never reaches the other three.
 */
export function alignment(cfg: WuxinConfig): number | null {
  const gen = arrowsOf(cfg, 'nourishes');
  const des = arrowsOf(cfg, 'hinders');
  let found: number | null = null;
  for (const slot of cfg.slots) {
    const target = des.get(slot.element);
    if (target == null) return null;
    let at: string | null | undefined = slot.element;
    let steps = 0;
    while (steps < cfg.slots.length) {
      at = gen.get(at as string);
      steps += 1;
      if (at == null) return null;
      if (at === target) break;
    }
    if (at !== target) return null;
    if (found === null) found = steps;
    else if (found !== steps) return null;
  }
  return found;
}

/**
 * Cyclic distance from the classical relation, or null when no single exponent
 * describes the configuration.
 *
 * Exponents live mod WUXIN_SLOTS and harmony is k = 2, so this is the ordering
 * `discord` fails to provide: 0 harmonious, 1 for either neighbour, 2 for the
 * antipode. Counterflow lands furthest by construction, which is what it ought
 * to do.
 *
 * WHY THIS EXISTS: on a closed ring `discord` takes only two values — 0 at k=2
 * and the maximum at every other power, because a ring's powers share no fixed
 * points. Brute-forcing all 1936 legal closed configurations, 692 of them (36%)
 * read maximum discord, and that bucket holds the 24 counterflows, the 24 at
 * k=3 and the 44 at k=1 alongside 600 configurations with no structure at all.
 * Discord answers "is this the classical relation" and nothing else; it is not
 * a distance and must not be presented as one.
 */
export function harmonyDistance(cfg: WuxinConfig): number | null {
  const k = alignment(cfg);
  if (k === null) return null;
  const n = cfg.slots.length;
  const raw = Math.abs(k - 2) % n;
  return Math.min(raw, n - raw);
}

// ---------- Landmarks ----------

/**
 * Elements that the SHAPE alone singles out. No numbers, no effects — just the
 * observation that some slots are structurally unlike the others, which is the
 * sort of thing worth having a name for before anything is balanced on it.
 */
export interface WuxinLandmarks {
  /**
   * No arrows at all, in or out. Unreachable without severing: a permutation
   * cannot leave an element out, so an orphan lives outside the closed space
   * entirely (zero of the 1936 closed configurations contain one).
   */
  orphans: string[];
  /**
   * When both relations split into a pair and a triangle on DISJOINT pairs,
   * four elements are spoken for and exactly one is left over — necessarily
   * the sole member of both triangles, and the only element in no mutual bond
   * of either kind. Forced by counting rather than chosen.
   */
  pivot: string | null;
  /** Points at nothing, yet both relations point at it: everything drains here. */
  sinks: string[];
  /** Points at both, yet nothing points at it: both lines start here. */
  sources: string[];
  /**
   * Elements whose two arrows name the same target — feeding and fighting the
   * same thing. Forced inside a generative pair whose partition destruction
   * shares; incidental everywhere else, which is the difference between two
   * elements being entangled and merely being co-partitioned.
   */
  doubled: string[];
}

export function landmarks(cfg: WuxinConfig): WuxinLandmarks {
  const gen = arrowsOf(cfg, 'nourishes');
  const des = arrowsOf(cfg, 'hinders');
  const pointedBy = (m: Map<string, string | null>, e: string) =>
    cfg.slots.some((s) => m.get(s.element) === e);

  const orphans: string[] = [];
  const sinks: string[] = [];
  const sources: string[] = [];
  const doubled: string[] = [];
  for (const slot of cfg.slots) {
    const e = slot.element;
    const out = (gen.get(e) != null ? 1 : 0) + (des.get(e) != null ? 1 : 0);
    const inGen = pointedBy(gen, e);
    const inDes = pointedBy(des, e);
    if (out === 0 && !inGen && !inDes) orphans.push(e);
    else if (out === 0 && inGen && inDes) sinks.push(e);
    else if (out === 2 && !inGen && !inDes) sources.push(e);
    if (slot.nourishes != null && slot.nourishes === slot.hinders) doubled.push(e);
  }

  return { orphans, pivot: pivotOf(cfg), sinks, sources, doubled };
}

function pivotOf(cfg: WuxinConfig): string | null {
  const pairOf = (relation: WuxinRelation): string[] | null => {
    const two = shapeOf(cfg, relation).cycles.filter((c) => c.length === 2);
    return two.length === 1 ? two[0] : null;
  };
  const g = pairOf('nourishes');
  const d = pairOf('hinders');
  if (!g || !d) return null;
  if (g.some((e) => d.includes(e))) return null; // pairs must be disjoint
  const spoken = new Set([...g, ...d]);
  const left = cfg.slots.map((s) => s.element).filter((e) => !spoken.has(e));
  return left.length === 1 ? left[0] : null;
}

/**
 * What kind of cycle this is. Named for what the shape MEANS rather than for
 * what it will eventually do, since what it does is not this module's business:
 *
 * - `harmonious` — the classical relation, however it is spelled. Generation
 *   closes and destruction is generation walked twice.
 * - `counterflow` — its antipode. Destruction is generation run backwards, so
 *   every element hinders the one that feeds it. Checked before `split`
 *   because it is the stronger statement about the same wiring.
 * - `split` — generation closes, but as two separate loops rather than one. A
 *   mutually feeding pair standing apart from a triangle: the only other way
 *   five arrows can close.
 * - `burst` — generation is cut somewhere, so it runs down a line instead of
 *   round a ring. The head has nothing feeding it; the tail has nothing to pass
 *   to. A "circular line".
 * - `sustain` — destruction is cut everywhere. Nothing in the cycle is fighting
 *   anything else in it.
 * - `tempered` — destruction is cut somewhere but not everywhere, over intact
 *   generation. Between sustain and a whole cycle: the antagonism is still
 *   there, with a gap deliberately left in it. Checked before the harmony
 *   tests, which is free — neither harmony nor counterflow survives a cut
 *   destructive arrow anyway — and after `burst`, since a cycle whose
 *   GENERATION is open is described by that first.
 * - `irregular` — closed generation that is neither harmonious nor split, or
 *   any other combination. Legal, and someone will eventually find out what it
 *   is good for.
 */
export type WuxinKind =
  | 'harmonious'
  | 'counterflow'
  | 'split'
  | 'burst'
  | 'sustain'
  | 'tempered'
  | 'irregular';

export function classify(cfg: WuxinConfig): WuxinKind {
  const gen = shapeOf(cfg, 'nourishes');
  const des = shapeOf(cfg, 'hinders');
  // Checked before generation's shape: a cycle with nothing destructive left in
  // it is a sustain configuration whatever its generative ring looks like.
  if (des.severed === cfg.slots.length) return 'sustain';
  if (gen.severed > 0) return 'burst';
  if (des.severed > 0) return 'tempered';
  if (isHarmonious(cfg)) return 'harmonious';
  if (isCounterflow(cfg)) return 'counterflow';
  if (gen.cycles.length > 1) return 'split';
  return 'irregular';
}
