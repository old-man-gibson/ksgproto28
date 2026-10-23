import type { Placement } from '../../core/types';
import { clonePlacement } from '../../core/systems/assembly';

/**
 * The anvil's working layout and which screen of it is open. UI-only, like
 * `ui.benchOnArrival`: the window closes when you walk away from the bench and
 * the layout is still there when you come back, but it is not game state, so a
 * reload starts from the default and nothing here touches the save.
 *
 * The first layout is an Iron Sword (a long blade on a short handle), the
 * piece the kernel is calibrated against.
 */
export const anvil = $state({
  placement: {
    head: { kind: 'long', mat: 'iron_ingot' },
    haft: { kind: 'h3', mat: 'hardwood' },
  } as Placement,
  view: 'anvil' as 'anvil' | 'chart',
  /** The form chart's selectors. */
  chart: { guard: null as string | null, bind: null as string | null, count: 1 },
});

/** Put a placement on the anvil (a copy: the caller's object, often a recipe's, is never edited). */
export function loadOnAnvil(placement: Placement): void {
  anvil.placement = clonePlacement(placement);
  anvil.view = 'anvil';
}
