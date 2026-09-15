import type { GameState, UnlockCondition } from '../types';
import { attrValue, equippedTags } from './attributes';

// Re-exported for existing consumers; the implementation lives in attributes.ts.
export { equippedTags };

/**
 * Shared unlock-condition evaluation (skills, super-attributes, future quests).
 * Attribute checks go through attrValue, so a fused super-attribute satisfies
 * conditions on either of its components.
 */
export function conditionMet(state: GameState, cond: UnlockCondition): boolean {
  switch (cond.type) {
    case 'skill':
      return (state.skills[cond.id]?.level ?? 0) >= cond.level;
    case 'attr':
      return attrValue(state, cond.attr) >= cond.level;
    case 'stat':
      return (state.stats[cond.key] ?? 0) >= cond.value;
    case 'statMax':
      return (state.stats[cond.key] ?? 0) <= cond.value;
    case 'equippedTag':
      return equippedTags(state).has(cond.tag);
    case 'quest':
      return state.quests[cond.id]?.status === 'done';
  }
}

/**
 * How far along a threshold condition is, 0..1 (capped at 1). Conditions
 * that are not thresholds (a quest turned in, a tag equipped, a counter kept
 * low) read as 1 so they never hide anything on their own: the reveal rule
 * is about distance to a number.
 */
export function conditionProgress(state: GameState, cond: UnlockCondition): number {
  switch (cond.type) {
    case 'skill':
      return cond.level <= 0 ? 1 : Math.min(1, (state.skills[cond.id]?.level ?? 0) / cond.level);
    case 'attr':
      return cond.level <= 0 ? 1 : Math.min(1, attrValue(state, cond.attr) / cond.level);
    case 'stat':
      return cond.value <= 0 ? 1 : Math.min(1, (state.stats[cond.key] ?? 0) / cond.value);
    case 'statMax':
    case 'equippedTag':
    case 'quest':
      return 1;
  }
}

/** The least-advanced threshold in a set, 0..1. Empty sets read as 1. */
export function conditionsProgress(state: GameState, conds: UnlockCondition[]): number {
  let least = 1;
  for (const c of conds) least = Math.min(least, conditionProgress(state, c));
  return least;
}

export function conditionsMet(state: GameState, conds: UnlockCondition[]): boolean {
  return conds.every((c) => conditionMet(state, c));
}
