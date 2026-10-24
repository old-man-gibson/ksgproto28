import type { QualityTier } from '../../core/types';
import { QUALITY_ORDER, QUALITY_TIERS } from '../../core/data/quality.data';
import { cookJudgement, tierFor, type CookLedger } from '../../core/systems/cooking';

/**
 * What the grade ledger (lib/GradeLedger.svelte) says, worked out from
 * `cookLedger`. The numbers are the core's; this picks the words and the
 * positions on the tier ruler.
 */

/** The ruler runs from Refuse's multiplier to a little past Divine's. */
export const RULER_FROM = QUALITY_TIERS.f.mult;
export const RULER_TO = 5;

/** Where a score sits on the ruler, as a percentage of its width. Off-scale scores stop at the ends. */
export function rulerPct(score: number): number {
  const clamped = Math.min(RULER_TO, Math.max(RULER_FROM, score));
  return ((clamped - RULER_FROM) / (RULER_TO - RULER_FROM)) * 100;
}

export interface RulerBlock {
  tier: QualityTier;
  /** The score this tier starts at. */
  mult: number;
  left: number;
  width: number;
}

/** One block per tier, laid out at true scale: Fair to Fine is a short step, Superb to Divine a long one. */
export function rulerBlocks(): RulerBlock[] {
  return QUALITY_ORDER.map((tier, i) => {
    const from = QUALITY_TIERS[tier].mult;
    const next = QUALITY_ORDER[i + 1];
    const to = next ? QUALITY_TIERS[next].mult : RULER_TO;
    return { tier, mult: from, left: rulerPct(from), width: rulerPct(to) - rulerPct(from) };
  });
}

const two = (n: number) => n.toFixed(2);
const tierName = (t: QualityTier) => QUALITY_TIERS[t].name;

/** "2.11", or "2.11–2.40" when the cuts' rolls leave a spread. */
export function scoreText(ledger: CookLedger): string {
  const [lo, hi] = ledger.score;
  return two(lo) === two(hi) ? two(lo) : `${two(lo)}–${two(hi)}`;
}

/** "Fine", or "Fine–Superb" when the rolls leave a spread. */
export function gradeText(ledger: CookLedger): string {
  const [lo, hi] = [tierFor(ledger.score[0]), tierFor(ledger.score[1])];
  return lo === hi ? tierName(lo) : `${tierName(lo)}–${tierName(hi)}`;
}

/** "0.39 short", or "0.39–0.55 short" across a spread. */
function shortText(next: NonNullable<CookLedger['next']>): string {
  return two(next.shortBest) === two(next.shortWorst)
    ? `${two(next.shortBest)} short`
    : `${two(next.shortBest)}–${two(next.shortWorst)} short`;
}

/** How far the score is from the next tier: "Superb 0.39 short", or what the best roll can do. */
export function gapText(ledger: CookLedger): string {
  const next = ledger.next;
  if (!next) return 'top grade';
  if (next.shortBest <= 0) return `${tierName(next.tier)} reachable`;
  return `${tierName(next.tier)} ${shortText(next)}`;
}

/** The ledger's collapsed line: "Fine · 2.11 · Superb 0.39 short". */
export function ledgerSummary(ledger: CookLedger): string {
  return [gradeText(ledger), scoreText(ledger), gapText(ledger)].join(' · ');
}

/**
 * How the skill bonus is worked out, in the ledger's words. The numbers are
 * `cookJudgement`'s; tests/gradeLedger.test.ts holds the two together.
 */
export const JUDGEMENT_WORDS = '÷ 15 up to level 15, ÷ 45 after';

/** What the next Cooking level adds to the score; 0 once the skill bonus is capped. */
export function judgementStep(level: number): number {
  return cookJudgement(level + 1) - cookJudgement(level);
}

/**
 * The expanded ledger's sentence under the ruler: what the next tier needs and
 * what the skill can do about it. Null at the top grade.
 */
export function gapSentence(ledger: CookLedger, level: number, skill: string, timed: boolean): string | null {
  const next = ledger.next;
  if (!next) return null;
  const need =
    next.shortBest > 0
      ? `${tierName(next.tier)} needs ${two(next.at)}: ${shortText(next)}.`
      : `${tierName(next.tier)} needs ${two(next.at)}. The best roll reaches it; the worst is ${two(next.shortWorst)} short.`;
  const step = judgementStep(level);
  const help =
    step > 0
      ? `Each ${skill} level adds ${two(step)}.`
      : `The skill bonus is at its cap. Better ingredients${timed ? ' or cook times' : ''} raise the grade.`;
  return `${need} ${help}`;
}
