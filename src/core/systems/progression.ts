import type { ProgressionBand } from '../types';
import { XP_BASE, XP_RATE, XP_SCALE } from '../data/progression.data';

/**
 * Banded XP curves.
 *
 * The cost of level L is the band's base cost carried forward by every growth
 * rate the skill has lived through:
 *
 *     cost(L) = scale · base(band of L) · Π rate(band of i)   for i = 1..L-1
 *
 * The product is the continuous part: inside a band the curve is the familiar
 * `base · rate^n`, and when a band with a different rate takes over, the curve
 * simply bends — no seam. The base is the discontinuous part: crossing into a
 * band with a costlier base multiplies the whole curve by the ratio between
 * them, so a tier-up is a deliberate wall (beginner→novice doubles it) rather
 * than a reset. The alternative — re-anchoring each band at its own base —
 * makes every tier-up CHEAPER than the levels before it, which is a sawtooth,
 * not a progression.
 *
 * Both halves are content decisions: a skill that raises its base each tier
 * (attribute training) gets steady walls at an unchanging pace; one that keeps
 * its base and slows its rate (runecarving) gets no walls and an ever-steeper
 * climb; one that does both in opposite directions (hunting) pays a wall to
 * enter a tier where levels then come easier.
 */

/** The band in force at `level` — the last one that has started. */
/** The curve a bandless skill falls back on, so authoring slips can't crash a save. */
const FALLBACK_BAND: ProgressionBand = { from: 1, base: 'beginner', rate: 'normal' };

function bandAt(bands: ProgressionBand[], level: number): ProgressionBand {
  // `progression: []` is a content error the linter rejects, but it must not
  // take a live game down with it — an empty list used to hand back undefined
  // and throw on the first XP grant.
  let current = bands[0] ?? FALLBACK_BAND;
  for (const band of bands) {
    if (level >= band.from) current = band;
  }
  return current;
}

/**
 * Π rate(i) over every level already climbed (1..level-1), evaluated per band
 * rather than per level — each band contributes `rate ^ (levels spent in it)`.
 */
function growthFactor(bands: ProgressionBand[], level: number): number {
  let factor = 1;
  for (let i = 0; i < bands.length; i++) {
    const start = Math.max(bands[i].from, 1);
    const end = Math.min(bands[i + 1]?.from ?? Infinity, level); // exclusive
    if (end > start) factor *= Math.pow(XP_RATE[bands[i].rate], end - start);
  }
  return factor;
}

/** XP to advance FROM `level` to the next one. Never below 1. */
export function bandedXpNeeded(bands: ProgressionBand[], level: number): number {
  const base = XP_BASE[bandAt(bands, level).base];
  return Math.max(1, Math.floor(XP_SCALE * base * growthFactor(bands, level)));
}

/**
 * Most levels anything may gain from a single grant. Real play never comes
 * close — even eight hours of offline catch-up at level 1 is a few dozen — so
 * this is purely a blast radius. Leftover XP stays banked and settles on the
 * next grant, so hitting the cap costs the player nothing.
 */
const MAX_LEVELS_PER_GRANT = 1000;

/**
 * Drain banked XP into levels until the remainder fits under the current
 * threshold, reporting how many levels were gained. Retuning a curve can leave
 * a save holding more XP than its next level costs; this settles that up
 * without granting anything the player had not already earned.
 *
 * Deliberately paranoid about the threshold. A cost that is NaN, zero, or
 * infinite means the curve is broken — a half-applied hot reload, a band list
 * that lost its data — and a naive loop against a cost of 1 will award six
 * figures of levels in one tick and then autosave them. Bad input stops the
 * loop and banks the XP instead: the character stalls until the curve is sane
 * again, which is recoverable, where a runaway is not.
 */
export function settleLevels(
  progress: { level: number; xp: number },
  bands: ProgressionBand[],
): number {
  let gained = 0;
  while (gained < MAX_LEVELS_PER_GRANT) {
    const need = bandedXpNeeded(bands, progress.level);
    if (!Number.isFinite(need) || need <= 0) break;
    if (progress.xp < need) break;
    progress.xp -= need;
    progress.level += 1;
    gained += 1;
  }
  return gained;
}
