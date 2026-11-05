/**
 * Talent's bar under the XP bar (PRESTIGE.md §4). One lap of the bar is 100% of
 * bonus; each lap wears the next colour, starting yellow, so the fill reads as
 * "how far into this hundred" and the colour as "which hundred". Wraps around
 * the palette past the last colour.
 *
 * These are authored identity colours: a theme does not replace them. They pass
 * through `ink()` where they are drawn (lib/ink.ts), and the theme test checks
 * them with the other authored colours (tests/themes.test.ts).
 */
export const TALENT_LAP_COLORS = [
  '#e6c84a',
  '#f0883e',
  '#e5534b',
  '#d65db1',
  '#9b6ef3',
  '#4c8ff0',
  '#3fc9d6',
  '#57c46b',
  '#f2f2f2',
];

export function talentBar(bonus: number): { width: number; color: string } {
  const pct = bonus * 100;
  const lap = Math.max(0, Math.ceil(pct / 100) - 1);
  return { width: pct - lap * 100, color: TALENT_LAP_COLORS[lap % TALENT_LAP_COLORS.length] };
}
