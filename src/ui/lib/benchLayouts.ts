import type { Placement } from '../../core/systems/disciplines';

/**
 * The last layout laid out at each bench, kept for the session.
 *
 * A bench panel is built when its window opens and thrown away when it closes,
 * so the layout would otherwise vanish with it: close the stove to check the
 * map and the pot is empty again. This is UI state, not game state. It lives at
 * module level, is never saved, and is gone on reload.
 */
export interface BenchLayout {
  placement: Placement;
  /** A timed bench's chosen duration; null while it is still the default. */
  units: number | null;
}

const layouts = new Map<string, BenchLayout>();

/** Remember the layout now on a bench. The placement is copied, so later edits do not leak in. */
export function rememberLayout(disciplineId: string, placement: Placement, units: number | null): void {
  const copy: Placement = {};
  for (const [slot, stack] of Object.entries(placement)) {
    if (stack) copy[slot] = { id: stack.id, quality: stack.quality };
  }
  layouts.set(disciplineId, { placement: copy, units });
}

/** The layout last left at a bench, or undefined if the session has not touched it. */
export function recallLayout(disciplineId: string): BenchLayout | undefined {
  return layouts.get(disciplineId);
}

/** Forget every remembered layout. */
export function forgetLayouts(): void {
  layouts.clear();
}
