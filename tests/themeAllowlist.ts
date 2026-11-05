/**
 * Allowlists for the source lints in tests/themes.test.ts. Every entry names
 * the reason it is allowed. A stale entry (one that no longer matches a line)
 * fails the test, so the lists cannot grow unnoticed.
 */

export interface Allow {
  /** Repo-relative path, forward slashes. */
  file: string;
  /** The exact trimmed source line. Omitted: the whole file is allowed. */
  line?: string;
  reason: string;
}

/**
 * Colour literals in .svelte files. Themed UI reads tokens. A literal stays
 * only where the pixels under it are painted art or a fixed identity colour
 * that a theme must not change.
 */
export const COLOR_LITERALS: Allow[] = [
  {
    file: 'src/ui/lib/BattleStage.svelte',
    reason: 'Painted stage: the backdrop, shadows and name plates sit on art that does not change with the theme.',
  },
  {
    file: 'src/ui/lib/SceneBackdrop.svelte',
    reason: 'Painted scene art: sky, ground and weather are drawn in fixed colours.',
  },
];

/**
 * State rules (`.selected`, `.nav-on`, `.here`, `:disabled`, `.picked`,
 * `.active`, `[aria-current]`) that set font size, font weight, padding or
 * border width. These shift layout when the state flips, which the UI rules
 * forbid (size and position never depend on per-tick or per-fight state).
 */
export const STATE_METRICS: Allow[] = [];

/** `outline: none` and `outline: 0`, each with the cue that replaces the focus ring. */
export const OUTLINE_NONE: Allow[] = [];
