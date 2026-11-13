/**
 * The Active Skills list's order logic (CombatPanel.svelte), kept out of the
 * component so it can be tested.
 *
 * The stored order (`skillOrder`, read through `activeRotation`) holds more
 * than the panel draws: a benched technique stays in it and is listed under
 * its skill in the Skills tab instead. The panel's cards, rank numbers and
 * move buttons all work on the drawn list; `game.moveSkillTo` writes the
 * full order and carries the hidden entries along.
 */

import { slotTarget, stepSlot } from './reorder';

/** What the panel reads of a skill's trigger overlay (`GameState.skillTriggers`). */
type TriggerOverlays = Record<string, { enabled?: boolean } | undefined>;

/** The rotation as the panel draws it: the order minus benched techniques. */
export function visibleIds(order: readonly string[], triggers: TriggerOverlays): string[] {
  return order.filter((id) => !(id.startsWith('technique:') && triggers[id]?.enabled === false));
}

/**
 * Why a card's rank number is not a turn, or null when it is one. A counter
 * technique or counterspell is never picked in turn (`pickActive` skips it):
 * it springs on a trigger, and its position only orders it among the other
 * counters. An entry switched off is never picked at all, so off wins.
 */
export function rankNote(counter: boolean, off: boolean): string | null {
  if (off) return 'Order: switched off.';
  if (counter) return 'Order: not fired in turn. Counters fire on a trigger.';
  return null;
}

/**
 * The `beforeId` for `game.moveSkillTo(id, beforeId)` that moves a card one
 * place among the drawn cards, or `undefined` when there is no move (the top
 * card up, the bottom card down, an id that is not drawn).
 *
 * Up places the card before the previous drawn card. Down places it after the
 * next drawn card, which is before the card two places on, or last (`null`)
 * when the next card is the bottom one. Hidden entries between two cards are
 * never counted as a place, so a click is never spent on one.
 */
export function stepTarget(
  visible: readonly string[],
  id: string,
  dir: -1 | 1,
): string | null | undefined {
  return slotTarget(visible, id, stepSlot(visible.indexOf(id), dir));
}
