import type { GameState, RoyaleCacheDef, RoyaleDenDef, RoyaleField, RoyaleSectionDef } from '../types';
import { COVER_SIGHT, RADAR_TICKS, ROYALE_FIELD, ROYALE_SECTIONS, scoutedKey } from '../data/festival.data';

/**
 * Pure reads of the royale field's layout (docs/FESTIVAL.md §9.2): which
 * section owns a point, how fast and how far a fighter there walks and sees,
 * who sees whom, the radar, and what the player's map may show. Shared by
 * the simulation (royaleField.ts) and the map (ui/lib/RoyaleField.svelte),
 * so the two can never disagree about what is visible.
 */

/** Sections in priority order, resolved once. */
const SECTIONS: RoyaleSectionDef[] = Object.values(ROYALE_SECTIONS);

/** The section that owns a point, or undefined for open meadow. */
export function sectionAt(x: number, y: number): RoyaleSectionDef | undefined {
  for (const s of SECTIONS) {
    for (const [x0, y0, x1, y1] of s.rects) {
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return s;
    }
  }
  return undefined;
}

/** Walking pace multiplier at a point. */
export function paceAt(x: number, y: number): number {
  return sectionAt(x, y)?.pace ?? 1;
}

/** How far a fighter standing at a point sees, in field units. */
export function sightAt(x: number, y: number): number {
  return ROYALE_FIELD.sight * (sectionAt(x, y)?.sight ?? 1);
}

/** A fighter at `from` sees one at `to`: within its sight, cut to COVER_SIGHT when `to` stands in cover. */
export function sees(from: { x: number; y: number }, to: { x: number; y: number }): boolean {
  const range = sightAt(from.x, from.y) * (sectionAt(to.x, to.y)?.cover ? COVER_SIGHT : 1);
  return Math.hypot(from.x - to.x, from.y - to.y) <= range;
}

/**
 * Ticks until the radar switches on for a fighter whose last fight ended at
 * `lastFight` (absent: it has not fought, so the field's opening counts).
 * 0 means it is on.
 */
export function radarLeft(lastFight: number | undefined, openedAt: number | undefined, now: number): number {
  const since = lastFight ?? openedAt ?? now;
  return Math.max(0, RADAR_TICKS - (now - since));
}

/** The radar is on: a festival hour without a fight. */
export function radarOn(lastFight: number | undefined, openedAt: number | undefined, now: number): boolean {
  return radarLeft(lastFight, openedAt, now) === 0;
}

/** The nearest survivor to a point, sight or no sight (the radar's read), or null on an empty field. */
export function nearestFighter(field: RoyaleField, x: number, y: number): { id: number; x: number; y: number; dist: number } | null {
  let best: { id: number; x: number; y: number; dist: number } | null = null;
  for (const f of field.fighters) {
    const d = Math.hypot(f.x - x, f.y - y);
    if (!best || d < best.dist) best = { id: f.id, x: f.x, y: f.y, dist: d };
  }
  return best;
}

/**
 * A section's caches and dens show on the player's map: scouted in the hub
 * this run (the survey's flags), or stood in this attempt.
 */
export function sectionKnown(state: GameState, field: RoyaleField | undefined, sectionId: string): boolean {
  return (state.stats[scoutedKey(sectionId)] ?? 0) >= 1 || !!field?.seen?.includes(sectionId);
}

/** The den still holds its place this attempt. */
export function denLive(field: RoyaleField, den: Pick<RoyaleDenDef, 'id'>): boolean {
  return !field.cleared?.includes(den.id);
}

/** The cache can be taken: not taken yet, and its den (if any) cleared. */
export function cacheOpen(field: RoyaleField, cache: Pick<RoyaleCacheDef, 'id' | 'den'>): boolean {
  if (field.taken?.includes(cache.id)) return false;
  return !cache.den || !!field.cleared?.includes(cache.den);
}
