import type { GameState } from '../../core/types';
import { activeQuests, questComplete } from '../../core/systems/quests';
import { prestigeVisible } from '../../core/systems/prestige';
import { subsystemUnlocked } from '../../core/systems/unlocks';
import { tutorialScreen, type TutorialScreen } from './tutorialFocus';

/**
 * The screen list: every main screen the game has, in the order the left
 * column draws them. One table, so a screen is one row.
 *
 * Adding a screen:
 *  1. Add a row to `NAV` (id, group, label, icon, and `shown` while it is gated).
 *  2. Add the panel to `SCREENS` in `App.svelte`. That record is typed
 *     `Record<MainTab, Component>`, so the build fails until the row has a panel.
 *  3. If floor 0's tutorial should show it, name its id in `SCREENS[step].tabs`
 *     in `tutorialFocus.ts`.
 *
 * `ui.tab` (state.svelte.ts), `MainTab` and the panel switch in App.svelte all
 * derive from this table. The table holds no components on purpose: the tests
 * run in node and could not load them.
 *
 * Presentation only. A row hidden here is not locked in the game; `shown`
 * repeats the gate the tab bar used before this table existed.
 */

export type NavGroup = 'act' | 'build' | 'records';

/** The groups in drawing order. */
export const NAV_GROUPS: readonly { id: NavGroup; name: string }[] = [
  { id: 'act', name: 'Act' },
  { id: 'build', name: 'Build' },
  { id: 'records', name: 'Records' },
];

export interface NavEntry {
  /** The `ui.tab` value. Do not rename: tutorialFocus.ts and saved habits name it. */
  id: string;
  group: NavGroup;
  label: string;
  /** Emoji. A pixel icon arrives as an `art` name beside it (docs/plans/pixel-icons.md). */
  icon: string;
  art?: string;
  /** Absent = always shown. Shuttered systems and gated screens say so here. */
  shown?: (gs: GameState) => boolean;
  /** Plain text drawn at the end of the row; null = none. */
  mark?: (gs: GameState) => string | null;
}

export const NAV = [
  { id: 'location', group: 'act', label: 'Location', icon: '🗺️' },
  { id: 'combat', group: 'act', label: 'Combat', icon: '⚔️' },
  { id: 'skills', group: 'build', label: 'Skills', icon: '📜' },
  // The run's ability (docs/FACET.md), while it holds one.
  { id: 'ability', group: 'build', label: 'Ability', icon: '✦', shown: (gs) => gs.facets.length > 0 },
  { id: 'equipment', group: 'build', label: 'Equipment', icon: '🎒' },
  // Shuttered subsystems (systems/unlocks.ts) keep their screens off the list
  // until content lifts the flag: a row for a system you have never heard of
  // is a spoiler, the same rule the benches follow.
  { id: 'chromosome', group: 'build', label: 'Chromosome', icon: '🧬', shown: (gs) => subsystemUnlocked(gs, 'genes') },
  { id: 'music', group: 'build', label: 'Music', icon: '🎼', shown: (gs) => subsystemUnlocked(gs, 'music') },
  { id: 'wuxin', group: 'build', label: 'Wuxin', icon: '☯️', shown: (gs) => subsystemUnlocked(gs, 'wuxin') },
  { id: 'bestiary', group: 'records', label: 'Bestiary', icon: '📖' },
  {
    id: 'quests',
    group: 'records',
    label: 'Quests',
    icon: '⭐',
    mark: (gs) => {
      const ready = activeQuests(gs).filter((q) => questComplete(gs, q)).length;
      return ready > 0 ? `${ready} ready` : null;
    },
  },
  { id: 'achievements', group: 'records', label: 'Achievements', icon: '🏆' },
  // Appears once the run could prestige (band 1 cleared), and stays once any
  // run has: the pre-prestige view lives here.
  { id: 'prestige', group: 'records', label: 'Prestige', icon: '♻️', shown: (gs) => prestigeVisible(gs) },
] as const satisfies readonly NavEntry[];

export type MainTab = (typeof NAV)[number]['id'];

/** A row with its id narrowed to a screen id. */
export type NavRow = NavEntry & { readonly id: MainTab };

const ROWS: readonly NavRow[] = NAV;

/** Every id, in list order. */
export const NAV_IDS: readonly MainTab[] = NAV.map((e) => e.id);

/**
 * The entries the player may open now, in list order: the row's own gate, and
 * during floor 0 the tutorial's list (`tutorialScreen(gs).tabs`) as well.
 */
export function visibleNav(gs: GameState, screen: TutorialScreen | null = tutorialScreen(gs)): NavRow[] {
  return ROWS.filter((e) => (screen ? screen.tabs.has(e.id) : true) && (e.shown ? e.shown(gs) : true));
}

/** One tab is no choice: the list appears with the second entry. */
export function navListShown(entries: readonly NavRow[]): boolean {
  return entries.length > 1;
}

/** Group captions draw once this many entries are visible. */
export const NAV_CAPTION_AT = 6;

export interface NavSection {
  group: NavGroup;
  /** Null below `NAV_CAPTION_AT` visible entries. */
  caption: string | null;
  entries: NavRow[];
}

/** The visible entries in their groups, in group order. A group with no entry is left out. */
export function navSections(entries: readonly NavRow[]): NavSection[] {
  const captions = entries.length >= NAV_CAPTION_AT;
  return NAV_GROUPS.map((g) => ({
    group: g.id,
    caption: captions ? g.name : null,
    entries: entries.filter((e) => e.group === g.id),
  })).filter((s) => s.entries.length > 0);
}

/** An entry's mark text, or null. */
export function navMark(entry: NavEntry, gs: GameState): string | null {
  return entry.mark ? entry.mark(gs) : null;
}

// ---------- Seen entries ----------

/**
 * Which entries the player has opened, in localStorage under `ksgproto28-shell`
 * (a per-browser preference, like the theme: outside the save's prefix, so a
 * hard reset keeps it and no save carries it). The stored value is an object so
 * other shell preferences can share the key; a write keeps the fields it does
 * not own.
 */
export const SHELL_KEY = 'ksgproto28-shell';

/** The part of `Storage` this file uses. */
export type ShellStore = Pick<Storage, 'getItem' | 'setItem'>;

/** The browser's storage, or null where there is none or access throws (private windows, node). */
export function browserStore(): ShellStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readShell(store: ShellStore | null): Record<string, unknown> | null {
  if (!store) return null;
  try {
    const raw = store.getItem(SHELL_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The stored seen ids, or null when nothing usable is stored. */
export function readSeen(store: ShellStore | null = browserStore()): string[] | null {
  const seen = readShell(store)?.seen;
  return Array.isArray(seen) ? seen.filter((id): id is string => typeof id === 'string') : null;
}

/** Store the seen ids. A failed write is ignored: the marks then last this visit only. */
export function writeSeen(ids: readonly string[], store: ShellStore | null = browserStore()): void {
  if (!store) return;
  try {
    store.setItem(SHELL_KEY, JSON.stringify({ ...readShell(store), seen: [...ids] }));
  } catch {
    // Blocked or full storage.
  }
}

/**
 * The seen ids to start a visit with. Stored ids win. With none stored (first
 * load in this browser, or an unreadable value) every entry visible now counts
 * as seen, so an existing save does not light up whole.
 */
export function initialSeen(
  gs: GameState,
  store: ShellStore | null = browserStore(),
  screen: TutorialScreen | null = tutorialScreen(gs),
): string[] {
  const stored = readSeen(store);
  if (stored) return stored;
  const ids = visibleNav(gs, screen).map((e) => e.id);
  writeSeen(ids, store);
  return ids;
}

/** True for an entry that is visible and was never opened. */
export function isNewEntry(entry: NavEntry, seen: readonly string[]): boolean {
  return !seen.includes(entry.id);
}
