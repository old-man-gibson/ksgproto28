import type { PrepDef, QualityTier } from '../types';
import { prose } from '../text/prose';
import { PREPS_TEXT } from '../text/preps.text';

/**
 * Knife work: the techniques the Cutting Board knows.
 *
 * A technique is a DESIGN in the discipline sense — a thing you know, not a
 * thing you own — exactly as carving patterns are to the rune table. Applying
 * one to a whole ingredient rolls a CUT GRADE from the cook's skill, capped by
 * the ingredient's own grade: a Divine cut takes both a Divine ingredient and
 * a masterful hand, and no knife ever polished refuse.
 *
 * For a prepped ingredient, grade means UNIFORMITY — how even the work is —
 * and uniformity means predictability. See `UNIFORMITY` below.
 *
 * Fit is the other half. Each hot-or-cold bench names one prep tag it rewards
 * (`favoredPrep` on the discipline), and a basket of well-matched cuts comes
 * out roughly a grade better than the same basket thrown in whole. A
 * mismatched cut costs nothing but the time it took — the punishment for
 * julienning everything is merely that the stew never notices.
 *
 * Chilling, curing and other non-knife preparations belong here too
 * eventually, but they wait on cold storage and the fermentation crocks.
 */
export const PREPS = prose<PrepDef>('PREPS', PREPS_TEXT, {
  sliced: {
    id: 'sliced',
    name: 'Slice',
    prefix: 'Sliced',
    icon: '🔪',
    tag: 'sliced',
  },
  diced: {
    id: 'diced',
    name: 'Dice',
    prefix: 'Diced',
    icon: '🎲',
    tag: 'diced',
    minLevel: 4,
  },
  julienned: {
    id: 'julienned',
    name: 'Julienne',
    prefix: 'Julienned',
    icon: '🥢',
    tag: 'julienned',
    minLevel: 10,
  },
});

export const PREP_LIST: PrepDef[] = Object.values(PREPS);

/** The id a prepped variant of a material is registered under. */
export function preppedIdOf(baseId: string, prepId: string): string {
  return `${baseId}_${prepId}`;
}

/**
 * What a cut grade means when the dish is made: the fraction of the
 * ingredient's contribution that actually arrives, rolled uniformly within
 * the band. Whole ingredients contribute their full multiplier, flat.
 *
 * The shape is deliberate. A Divine cut is perfectly even, so it introduces
 * NO variance — the ingredient lands at exactly its worth. Refuse-grade
 * butchery is also predictable: uniformly mangled, shredded into
 * near-irrelevance. The middle is where the gamble lives — Fair knife work
 * has the widest band of the lot, and its ceiling never reaches what the
 * ingredient was worth whole. Better hands raise the floor before they raise
 * the ceiling: uniformity is bought as certainty first.
 *
 * This is also the economy that gates prepping by skill without a lock: a
 * novice's cuts lose more than the bench-fit bonus returns, so novices do
 * better throwing things in whole. The crossover comes with the grades.
 */
export const UNIFORMITY: Record<QualityTier, [number, number]> = {
  f: [0.1, 0.2],
  e: [0.25, 0.4],
  d: [0.4, 0.6],
  c: [0.55, 0.8],
  b: [0.72, 0.9],
  a: [0.9, 1],
  s: [1, 1],
};
