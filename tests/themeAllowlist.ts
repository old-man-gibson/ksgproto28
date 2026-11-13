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
  {
    file: 'src/ui/MapPlan.svelte',
    line: 'fill: #fff;',
    reason: 'Tile labels: white ink over painted tile art, outlined with --tile-halo. The art does not change with the theme.',
  },
];

/**
 * State rules (`.selected`, `.nav-on`, `.here`, `:disabled`, `.picked`,
 * `.active`, `[aria-current]`) that set font size, font weight, padding or
 * border width. These shift layout when the state flips, which the UI rules
 * forbid (size and position never depend on per-tick or per-fight state).
 */
export const STATE_METRICS: Allow[] = [];

/**
 * A bar token (`--hp`, `--xp`, ...) written as a string literal in a script or
 * in markup. A bar fill read as text goes through its `-ink` token; a literal
 * has no property around it for the test to read, so each one is listed with
 * what it paints. Add a literal here only when it paints a fill, a border or a
 * background.
 */
export const BAR_LITERALS: Allow[] = [
  {
    file: 'src/ui/lib/HeatTrack.svelte',
    line: "before: 'var(--focus)',",
    reason: 'Border and fill of a cook window (--c). Its label reads --c-ink, from windowInk.',
  },
  {
    file: 'src/ui/lib/HeatTrack.svelte',
    line: "after: 'var(--hp)',",
    reason: 'Border and fill of a cook window (--c). Its label reads --c-ink, from windowInk.',
  },
  {
    file: 'src/ui/panels/QuestsPanel.svelte',
    line: "? 'var(--xp)'",
    reason: 'Background of a finished quest progress bar.',
  },
  {
    file: 'src/ui/panels/ResourceBars.svelte',
    line: "const manaColor = $derived(manaDebt > 0 ? 'var(--manaburn)' : `var(${RESOURCES.mana.cssVar})`);",
    reason: 'Fill of the mana bar.',
  },
  {
    file: 'src/ui/panels/WuxinPanel.svelte',
    line: '<path d="M 0 0 L 8 4 L 0 8 z" fill="var(--xp)" />',
    reason: 'Fill of an arrowhead marker, not text.',
  },
];

/** `outline: none` and `outline: 0`, each with the cue that replaces the focus ring. */
export const OUTLINE_NONE: Allow[] = [
  {
    file: 'src/ui/MapPlan.svelte',
    line: '.node:focus { outline: none }',
    reason: 'The pin draws .focus-ring, a circle in --ring, on :focus-visible.',
  },
  {
    file: 'src/ui/lib/RoyaleField.svelte',
    line: '.royale-ground { outline: none }',
    reason: 'The ground has no box; .royale-ground:focus-visible ~ .royale-edge turns the map edge to --ring.',
  },
  {
    file: 'src/ui/panels/MusicPanel.svelte',
    line: '.lane rect { outline: none }',
    reason: 'Pointer-only targets: the lanes are not reachable by Tab (see the comment on the rule), so a click would leave a ring across the staff.',
  },
  {
    file: 'src/ui/panels/MusicPanel.svelte',
    line: '.event { outline: none }',
    reason: 'Pointer-only target, same as the lanes.',
  },
];
