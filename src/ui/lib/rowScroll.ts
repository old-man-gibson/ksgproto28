/**
 * Where to scroll a sideways row so that one entry sits in its middle, clamped to
 * the row's own range. `entryLeft` is the entry's left edge in the row's content
 * (its offset from the row's left edge plus the row's current `scrollLeft`).
 *
 * The bottom bar uses this instead of `scrollIntoView`: that call also scrolls
 * every ancestor to show the entry, and with the page's `scroll-padding-bottom`
 * (the bar's own height) it moved the whole page about 100 px on every tab change
 * (docs/PHONE.md section 2).
 */
export function centeredScrollLeft(
  row: { clientWidth: number; scrollWidth: number },
  entryLeft: number,
  entryWidth: number,
): number {
  const max = Math.max(0, row.scrollWidth - row.clientWidth);
  const left = entryLeft + entryWidth / 2 - row.clientWidth / 2;
  return Math.min(max, Math.max(0, left));
}

/** Scroll `row` sideways, and only it, so `entry` is centred. */
export function centerInRow(row: HTMLElement, entry: HTMLElement): void {
  const at = entry.getBoundingClientRect();
  const from = row.getBoundingClientRect();
  const entryLeft = at.left - from.left - row.clientLeft + row.scrollLeft;
  row.scrollTo({ left: centeredScrollLeft(row, entryLeft, at.width) });
}
