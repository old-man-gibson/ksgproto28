import type { QualityTier, QualityTierDef } from '../types';

/**
 * The one grading scale, shared by every discipline that takes components.
 *
 * F is not "a small bonus" — its multiplier is NEGATIVE. Cooking with rotten
 * meat should hand you a worse dish than not cooking at all, and a flawed
 * runestone should make a worse rune than a plain one. That asymmetry is the
 * whole reason the scale runs below zero rather than from 0 upward: it makes
 * *what you put in* a decision rather than a formality.
 *
 * The curve above C is deliberately steep. S-tier is meant to be remarkable —
 * rare enough to hoard, and the only thing that opens the outcomes gated behind
 * `minQuality: 's'`.
 */
/**
 * Colours follow the ladder players already read without being told: refuse is
 * a dead black, then grey, white, and up through green / blue / purple to gold.
 * A border in this colour is how the bench shows a grade without spending a
 * word on it.
 */
export const QUALITY_TIERS: Record<QualityTier, QualityTierDef> = {
  f: { id: 'f', name: 'Refuse', mult: -0.5, color: '#3a3a3a' },
  e: { id: 'e', name: 'Poor', mult: 0.25, color: '#8b8b8b' },
  d: { id: 'd', name: 'Common', mult: 0.6, color: '#e8edf4' },
  c: { id: 'c', name: 'Fair', mult: 1, color: '#4caf7d' },
  b: { id: 'b', name: 'Fine', mult: 1.6, color: '#42a5f5' },
  a: { id: 'a', name: 'Superb', mult: 2.5, color: '#ab6fd6' },
  s: { id: 's', name: 'Divine', mult: 4, color: '#e8b84b' },
};

/** Worst to best. Comparisons and roll tables use this order. */
export const QUALITY_ORDER: QualityTier[] = ['f', 'e', 'd', 'c', 'b', 'a', 's'];

export function qualityRank(q: QualityTier): number {
  return QUALITY_ORDER.indexOf(q);
}

/** True when `q` is at least as good as `min`. */
export function qualityAtLeast(q: QualityTier, min: QualityTier): boolean {
  return qualityRank(q) >= qualityRank(min);
}

export function qualityMult(q: QualityTier): number {
  return QUALITY_TIERS[q].mult;
}
