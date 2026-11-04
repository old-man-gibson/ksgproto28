import { browserStore, patchShell, readShell, type ShellStore } from './nav';

/**
 * The log column's two states. Open is the right grid column; folded removes
 * that column, shows the newest line as a one-line row under the screen
 * (LogTicker.svelte) and opens the full log as a panel from the right edge on
 * demand (LogDrawer.svelte).
 *
 * The player's choice is stored in the shell key (nav.ts, `ksgproto28-shell`,
 * field `logOpen`) and beats the width default. With no choice stored, the log
 * is open from `LOG_OPEN_MIN_WIDTH` and folded below it.
 */

/**
 * Viewport width, in CSS px, from which the log is open by default. With the
 * log open, the main column is the viewport less 638 px (padding, gaps, the
 * 270 px left column, the 320 px log) and a scrollbar. The Combat screen's
 * two panels sit side by side from 760 px of that (CombatPanel.svelte), which
 * is about 1415 px of viewport; 1420 keeps the default from opening a log that
 * stacks them.
 */
export const LOG_OPEN_MIN_WIDTH = 1420;

/** The state a browser with no stored choice gets at this viewport width. */
export function logOpenDefault(width: number): boolean {
  return width >= LOG_OPEN_MIN_WIDTH;
}

/** Whether the log column is open: the stored choice if there is one, else the width default. */
export function logIsOpen(choice: boolean | null, width: number): boolean {
  return choice ?? logOpenDefault(width);
}

/**
 * The part of the clock chip's text a narrow header keeps: the part holding the
 * hour ("about 09:00", "09:23"), or the first part when the sense is too weak
 * to name an hour ("Morning"). Never more than the full text says
 * (systems/chronosense.ts gates the precision).
 */
export function shortClock(text: string): string {
  const parts = text.split(' · ');
  return parts.find((part) => /\d{1,2}:\d{2}/.test(part)) ?? parts[0];
}

/** The stored choice, or null when none is stored or the value is not a boolean. */
export function readLogChoice(store: ShellStore | null = browserStore()): boolean | null {
  const value = readShell(store)?.logOpen;
  return typeof value === 'boolean' ? value : null;
}

/** Store the choice, keeping the shell key's other fields. A failed write is ignored. */
export function writeLogChoice(open: boolean, store: ShellStore | null = browserStore()): void {
  patchShell({ logOpen: open }, store);
}
