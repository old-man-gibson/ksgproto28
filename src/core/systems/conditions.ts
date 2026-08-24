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

export function conditionsMet(state: GameState, conds: UnlockCondition[]): boolean {
  return conds.every((c) => conditionMet(state, c));
}
