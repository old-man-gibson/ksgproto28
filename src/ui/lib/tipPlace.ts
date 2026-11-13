/**
 * Where a touch card goes (Tip.svelte). The card is as tall as its text, so its
 * place is worked out once it is on the page and its height is known.
 */

/** Space kept between the card and the window's top and bottom edge, in px. */
export const CARD_MARGIN = 8;

/** Space between the card and the thing it is about, in px. */
export const CARD_GAP = 6;

/**
 * The card's top edge: under the target when the whole card fits there, else
 * over it, and in either case inside the window. A card taller than the window
 * (the stylesheet caps it at the window's height less two margins and scrolls
 * it) starts at the top margin.
 */
export function cardTop(targetTop: number, targetBottom: number, height: number, windowHeight: number): number {
  const below = targetBottom + CARD_GAP;
  const top = below + height <= windowHeight - CARD_MARGIN ? below : targetTop - height - CARD_GAP;
  return Math.max(CARD_MARGIN, Math.min(top, windowHeight - CARD_MARGIN - height));
}
