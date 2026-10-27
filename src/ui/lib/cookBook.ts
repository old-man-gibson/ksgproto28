import type { GameEvent, GameState, QualityTier } from '../../core/types';
import { DISCIPLINES, MATERIALS, QUALITY_ORDER, QUALITY_TIERS, STATUSES } from '../../core/registry';
import {
  COOK_TIME_COOKS,
  SIGNATURE_COOKS,
  cookbook,
  cookingDishIds,
  dishHasCookTime,
  type CookbookEntry,
} from '../../core/systems/cookbook';
import { describeHeatWindow, knowsRecipe } from '../../core/systems/disciplines';

/**
 * What the Cook's Book screen and the plate card say, worked out from
 * `cookbook(state)` (core/systems/cookbook.ts). The counters, thresholds and
 * windows are the core's; this picks the rows to print, the words, and which
 * rows stay blank so the Book prints no gate (an unread recipe card is what
 * teaches a dish's requirements).
 */

/** A grade as a CSS colour. Refuse's own colour is near-black and vanishes on the well. */
export function tierColour(tier: QualityTier): string {
  return tier === 'f' ? 'var(--text-dim)' : QUALITY_TIERS[tier].color;
}

// ---------- The Book ----------

/** `made`: cooked at this grade. `next`: the grade above the best made. `none`: neither. */
export type SquareState = 'made' | 'next' | 'none';

export interface GradeSquare {
  tier: QualityTier;
  state: SquareState;
  /** Cooks that came out at this grade. */
  count: number;
}

export interface BookRow {
  key: string;
  /** Never made, and the recipe card is unread: no name and no icon. */
  blank: boolean;
  icon: string;
  name: string;
  /** One square per grade, worst to best (F to S). */
  squares: GradeSquare[];
  made: number;
  /** The heat window in words, "shown after 25 cooks", or "—" for a dish with no window. */
  cookTime: string;
  /** The Signature's condition names, "after 100 cooks", or "—" for a dish with none. */
  signature: string;
  /** The cell says what is missing rather than what is known; the screen dims it. */
  cookTimeDim: boolean;
  signatureDim: boolean;
}

export interface BookSection {
  benchId: string;
  /** The bench's own name ("Cooking Stove"), whether or not the player has reached it. */
  label: string;
  rows: BookRow[];
}

const NONE = '—';

/** Condition names a dish's Signature grants, in data order. Empty for a dish with no Signature. */
export function signatureNames(dishId: string): string[] {
  return (MATERIALS[dishId]?.consumable?.signature ?? []).map((s) => STATUSES[s.id]?.name ?? s.id);
}

/** "meat under 6 units", "herb 8 or more units"; several windows join with "and". */
function windowWords(heat: NonNullable<CookbookEntry['heat']>): string {
  return heat.map((w) => `${w.tag} ${describeHeatWindow(w)} units`).join(' and ');
}

function squaresFor(entry: CookbookEntry): GradeSquare[] {
  const above = entry.best ? QUALITY_ORDER[QUALITY_ORDER.indexOf(entry.best) + 1] : undefined;
  return QUALITY_ORDER.map((tier) => {
    const count = entry.byGrade[tier];
    const state: SquareState = count > 0 ? 'made' : tier === above ? 'next' : 'none';
    return { tier, state, count };
  });
}

function rowFor(state: GameState, entry: CookbookEntry): BookRow {
  const outcome = DISCIPLINES[entry.benchId]?.outcomes.find((o) => o.id === entry.outcomeId);
  const key = `${entry.benchId}:${entry.outcomeId}`;
  // A dish never made, whose card is unread: the row exists, and says nothing.
  const blank = entry.made === 0 && !!outcome?.recipe && !knowsRecipe(state, outcome.recipe);
  if (blank) {
    return {
      key,
      blank,
      icon: '',
      name: '',
      squares: squaresFor(entry),
      made: 0,
      cookTime: 'not yet made',
      signature: '',
      cookTimeDim: true,
      signatureDim: true,
    };
  }

  const dish = MATERIALS[entry.dishId];
  const windowed = !!outcome?.heat?.length;
  const known = !!entry.heat?.length;
  const cookTime = known
    ? windowWords(entry.heat!)
    : windowed && !entry.cookTimeKnown
      ? `shown after ${COOK_TIME_COOKS} cooks`
      : NONE;
  const sig = signatureNames(entry.dishId);
  const signature = !sig.length ? NONE : entry.signature ? sig.join(' and ') : `after ${SIGNATURE_COOKS} cooks`;

  return {
    key,
    blank,
    icon: dish?.icon ?? '',
    name: dish?.name ?? entry.dishId,
    squares: squaresFor(entry),
    made: entry.made,
    cookTime,
    signature,
    cookTimeDim: !known,
    signatureDim: !sig.length || !entry.signature,
  };
}

/** One section per cooking bench that makes dishes, in `cookbook()` order. */
export function bookSections(state: GameState): BookSection[] {
  const sections: BookSection[] = [];
  for (const entry of cookbook(state)) {
    let section = sections[sections.length - 1];
    if (section?.benchId !== entry.benchId) {
      const disc = DISCIPLINES[entry.benchId];
      section = { benchId: entry.benchId, label: disc?.benchName ?? disc?.name ?? entry.benchId, rows: [] };
      sections.push(section);
    }
    section.rows.push(rowFor(state, entry));
  }
  return sections;
}

/** "N of M dishes made": dishes, not rows, so the Traveler's Ration counts once. */
export function bookSummary(state: GameState): { made: number; total: number; text: string } {
  const ids = cookingDishIds();
  const made = new Set(cookbook(state).filter((e) => e.made > 0).map((e) => e.dishId)).size;
  return { made, total: ids.length, text: `${made} of ${ids.length} dishes made` };
}

/** What a row's grade squares say to a screen reader, and in their tooltip. */
export function squaresLabel(squares: GradeSquare[]): string {
  const made = squares.filter((s) => s.state === 'made');
  const next = squares.find((s) => s.state === 'next');
  const parts = [
    made.length ? `Made at ${made.map((s) => `${QUALITY_TIERS[s.tier].name} (${s.count})`).join(', ')}.` : 'Not made yet.',
  ];
  if (next) parts.push(`Next grade up: ${QUALITY_TIERS[next.tier].name}.`);
  return parts.join(' ');
}

// ---------- The plate card ----------

/** Where one dish stands in the Book, taken before and after a cook to find what the cook changed. */
export interface DishMark {
  made: number;
  best: QualityTier | null;
  timeKnown: boolean;
  signature: boolean;
}

/** Every dish a cooking bench makes, by material id, as the Book reads now. */
export function dishMarks(state: GameState): Map<string, DishMark> {
  const marks = new Map<string, DishMark>();
  for (const e of cookbook(state)) {
    marks.set(e.dishId, { made: e.made, best: e.best, timeKnown: e.cookTimeKnown, signature: e.signature });
  }
  return marks;
}

export interface PlateNews {
  /** The best grade rose with this cook. Not said for the first cook of a dish. */
  newBest: boolean;
  /** This cook made the cook time known, for a dish that has one to show. */
  timeShown: boolean;
}

export type CookedEvent = Extract<GameEvent, { type: 'cooked' }>;

export interface Plate {
  dishId: string;
  icon: string;
  name: string;
  quality: QualityTier;
  /** "Fine to Superb" when the preview promised a spread, else null. */
  range: string | null;
  /** Cooks of this dish this run, and the best grade made, after this cook. */
  made: number;
  best: QualityTier | null;
  news: PlateNews;
  /** The dish is a Signature dish. */
  signature: boolean;
  /** Dishes cooked at this bench since the layout last changed, this one included. */
  cooks: number;
}

/**
 * The card for a cook that just landed. `before` is the dish's mark from before
 * the cook (`dishMarks` at the previous cook, or when the bench opened); the
 * card says what changed between it and now.
 */
export function plateFor(
  ev: CookedEvent,
  before: DishMark | undefined,
  after: DishMark,
  cooks: number,
): Plate {
  const dish = MATERIALS[ev.dish];
  const rose =
    before?.best != null && after.best !== null && QUALITY_ORDER.indexOf(after.best) > QUALITY_ORDER.indexOf(before.best);
  return {
    dishId: ev.dish,
    icon: dish?.icon ?? '🍽️',
    name: dish?.name ?? ev.dish,
    quality: ev.quality,
    range: ev.low === ev.high ? null : `${QUALITY_TIERS[ev.low].name} to ${QUALITY_TIERS[ev.high].name}`,
    made: after.made,
    best: after.best,
    news: {
      newBest: rose,
      timeShown: !!before && !before.timeKnown && after.timeKnown && dishHasCookTime(ev.dish),
    },
    signature: after.signature,
    cooks,
  };
}

/**
 * What a bench window keeps between the `cooked` events it hears: where each dish
 * stood in the Book after the last cook of it ANYWHERE. A dish more than one bench
 * makes (the Traveler's Ration, the Scorched Mess) can be cooked at another bench
 * while this window is open, so every event refreshes that dish's mark, and only
 * a cook at this bench makes a card. Otherwise the next cook here would compare
 * itself with a mark that predates the other bench's cook and call it a new best.
 */
export function plateTracker(state: GameState, benchId: string) {
  const marks = dishMarks(state);
  return {
    /** The card for a cook at this bench; null (after noting the cook) for a cook at another. */
    cooked(ev: CookedEvent, cooks: number): Plate | null {
      const after = dishMarks(state).get(ev.dish);
      if (!after) return null;
      const before = marks.get(ev.dish);
      marks.set(ev.dish, after);
      return ev.discipline === benchId ? plateFor(ev, before, after, cooks) : null;
    },
  };
}
