/**
 * The map's click card (docs/NAVIGATION.md §3.3): which pin is selected, and
 * where its card stands. Pure, so tests/mapselect.test.ts runs the whole state
 * machine; MapCard feeds it every event that can change the selection and acts
 * on the result.
 */

export type SelectEvent =
  /** A click, or Enter or Space, on a pin. `here`: the pin is the place underfoot. */
  | { type: 'pin'; id: string; here: boolean }
  | { type: 'escape' }
  /** A click outside the card and the pins. */
  | { type: 'outside' }
  /** The region or floor on show changed, or the map was folded. */
  | { type: 'view' }
  /** A button in the card ran an action that leaves the place (a walk, a go-and-do). */
  | { type: 'done' }
  /** The pins now on the map: a selected pin that is not among them is gone. */
  | { type: 'present'; ids: ReadonlySet<string> };

export interface SelectResult {
  /** The pin whose card is open, or null. */
  selected: string | null;
  /** The pin to walk to, when the event was the second click on the selected pin. */
  walk: string | null;
}

/**
 * One step. A click on a pin selects it; the next click on the same pin walks
 * there and closes the card (on the pin underfoot it only closes); a click on
 * another pin selects that one and walks nowhere. Everything else closes the
 * card, or leaves it alone.
 */
export function selectionStep(selected: string | null, ev: SelectEvent): SelectResult {
  switch (ev.type) {
    case 'pin':
      return selected === ev.id
        ? { selected: null, walk: ev.here ? null : ev.id }
        : { selected: ev.id, walk: null };
    case 'present':
      return { selected: selected !== null && ev.ids.has(selected) ? selected : null, walk: null };
    case 'escape':
    case 'outside':
    case 'view':
    case 'done':
      return { selected: null, walk: null };
  }
}

// ---------- Where the card stands ----------

/** A rectangle in window pixels. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The card's width, px, and its distance from the pin and from the window's edge. */
export const CARD_W = 290;
export const CARD_GAP = 8;

/**
 * The card's top left corner, so that it never covers the pin it describes:
 * the second click has to land on the pin. Right of the pin, else left of it,
 * else (a window too narrow for either) under it, else over it. Beside the pin
 * the card lines up with the pin's top and is kept inside the window.
 */
export function placeCard(
  pin: Box,
  view: { w: number; h: number },
  card: { w: number; h: number },
): { x: number; y: number } {
  const gap = CARD_GAP;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));
  const beside = clamp(pin.top - 4, gap, view.h - card.h - gap);
  if (pin.right + gap + card.w <= view.w - gap) return { x: pin.right + gap, y: beside };
  if (pin.left - gap - card.w >= gap) return { x: pin.left - gap - card.w, y: beside };
  const x = clamp(pin.left, gap, view.w - card.w - gap);
  if (pin.bottom + gap + card.h <= view.h - gap) return { x, y: pin.bottom + gap };
  return { x, y: Math.max(gap, pin.top - gap - card.h) };
}
