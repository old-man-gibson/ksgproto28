import type { ForgeSlot, GameState, Placement } from '../../core/types';
import { clonePlacement } from '../../core/systems/assembly';
import type { PartFamilyId } from './anvilView';

/**
 * The anvil's working layout and which screen of it is open. UI-only, like
 * `ui.benchOnArrival`: the window closes when you walk away from the bench and
 * the layout is still there when you come back, but it is not game state, so a
 * reload starts from the default and nothing here touches the save.
 *
 * The layout belongs to ONE run of ONE save. A hard reset, an import and a
 * prestige each replace the state object's contents in place (the module-level
 * store never sees them happen), so the store is keyed on the run it was
 * last used in and resets itself when that changes (`syncAnvil`). Without
 * that, a layout holding a material the new save has never heard of (bronze)
 * would greet the fresh save with "Short of Bronze Ingot".
 *
 * The first layout is an Iron Sword (a long blade on a short handle), the
 * piece the kernel is calibrated against.
 */

/** The layout and selectors a run starts with. A function: every reset needs fresh objects. */
function fresh() {
  return {
    placement: {
      head: { kind: 'long', mat: 'iron_ingot' },
      haft: { kind: 'h3', mat: 'hardwood' },
    } as Placement,
    view: 'anvil' as 'anvil' | 'chart',
    /** The slot whose picker is open (one at a time), or none. The head's is open on a new run. */
    open: 'head' as ForgeSlot | null,
    /**
     * The shape family a slot's picker was switched to by hand. A slot with no
     * entry shows the family of the part it holds, so this is only set while
     * the player browses a family other than the held part's.
     */
    family: {} as Partial<Record<ForgeSlot, PartFamilyId>>,
    /** The form chart's selectors. */
    chart: { guard: null as string | null, bind: null as string | null, count: 1 },
  };
}

export const anvil = $state(fresh());

/** The run the store was last used in; '' before its first use. Not reactive: it only gates a reset. */
let owner = '';

/**
 * Which run a state is: the save (`createdAt` is the world seed, new for a
 * hard reset and for a different save) and how many times it has prestiged
 * (a prestige keeps `createdAt` but starts the run over).
 */
export function runKey(state: Pick<GameState, 'createdAt' | 'prestige'>): string {
  return `${state.createdAt}:${state.prestige?.count ?? 0}`;
}

/** Back to the layout a new run starts with. */
export function resetAnvil(): void {
  const next = fresh();
  anvil.placement = next.placement;
  anvil.view = next.view;
  anvil.open = next.open;
  anvil.family = next.family;
  anvil.chart = next.chart;
}

/**
 * Claim the store for this state's run, resetting it if it was last used in
 * another. Call before reading or writing the layout (a component's setup, and
 * `loadOnAnvil`). The first claim of a session leaves the default as it is.
 */
export function syncAnvil(state: Pick<GameState, 'createdAt' | 'prestige'>): void {
  const key = runKey(state);
  if (key === owner) return;
  if (owner !== '') resetAnvil();
  owner = key;
}

/**
 * Replace the whole layout (a copy: the caller's object, often a recipe's, is
 * never edited). The hand-picked families belonged to the old layout, so they
 * go with it; editing one slot sets `anvil.placement` directly and keeps them.
 */
export function setLayout(placement: Placement): void {
  anvil.placement = clonePlacement(placement);
  anvil.family = {};
}

/** Put a placement on the anvil. */
export function loadOnAnvil(state: Pick<GameState, 'createdAt' | 'prestige'>, placement: Placement): void {
  syncAnvil(state);
  setLayout(placement);
  anvil.view = 'anvil';
}
