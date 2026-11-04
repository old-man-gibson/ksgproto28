import { bandDrawnOpen } from './ladderView';

/**
 * The player's choice per ladder band (AscentPanel.svelte): true opens a band
 * that would fold, false folds it again. Kept in module memory only, so a
 * reload starts from the default. Which bands may fold at all is
 * `bandFoldable` (lib/ladderView.ts); a choice never overrides that.
 */
const choices = $state<Record<string, boolean>>({});

/** Whether the band is drawn open now. */
export function bandIsOpen(bandId: string, foldable: boolean): boolean {
  return bandDrawnOpen(foldable, choices[bandId]);
}

/**
 * The band's <details> reported a toggle. A change the panel made itself
 * (a band that stopped being foldable opens, one that became foldable folds)
 * reports the state already drawn and is not a choice.
 */
export function setBandOpen(bandId: string, foldable: boolean, open: boolean): void {
  if (open === bandIsOpen(bandId, foldable)) return;
  choices[bandId] = open;
}

/** Forget every choice (tests). */
export function resetFoldChoices(): void {
  for (const id of Object.keys(choices)) delete choices[id];
}
