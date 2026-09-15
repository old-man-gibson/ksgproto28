import type { AttributeId, GameState, PrestigeBoonDef } from '../types';
import { PRESTIGE_BOONS } from '../registry';

/**
 * Reads of the legacy block that other systems need at their use sites
 * (skillCap, preparedCap). Kept apart from systems/prestige.ts so those
 * modules never import the harvest — which imports the tower runtime, which
 * imports combat, which imports them.
 */

/** Rank bought of a boon (0 = never). */
export function boonRank(state: GameState, boonId: string): number {
  return state.prestige.purchases[boonId] ?? 0;
}

/** Every boon at its bought rank, for effect sums. */
export function boughtBoons(state: GameState): { def: PrestigeBoonDef; rank: number }[] {
  return Object.values(PRESTIGE_BOONS)
    .map((def) => ({ def, rank: boonRank(state, def.id) }))
    .filter((b) => b.rank > 0);
}

/** Whether locked skills and upcoming milestones show at any progress (the Foresight boon). */
export function hasForesight(state: GameState): boolean {
  return boughtBoons(state).some(({ def }) => def.effect.kind === 'foresight');
}

/** Whether the Quests and Skills tabs carry go links (the Wayfinding boon). */
export function hasWayfinding(state: GameState): boolean {
  return boughtBoons(state).some(({ def }) => def.effect.kind === 'wayfinding');
}

/** Cap levels a skill's ceiling gains from prestige. Manifested or not. */
export function legacyCapRaise(state: GameState, skillId: string): number {
  let by = 0;
  for (const { def, rank } of boughtBoons(state)) {
    if (def.effect.kind === 'skillCap' && def.effect.skill === skillId) by += def.effect.by * rank;
  }
  return by;
}

/**
 * Talent's multiplier on one skill's effects, as a fraction (0.05 = +5%):
 * rate × rank × the skill's peak level at any past prestige × prestiges.
 * Zero for a skill no finished run carried, and for a save that has never
 * prestiged. Constant within a run — every factor is written at prestige or
 * at purchase, so the derived-stats fingerprint only needs the rank.
 */
export function talentBonus(state: GameState, skillId: string): number {
  const peak = state.prestige.peakLevels[skillId] ?? 0;
  if (peak <= 0 || state.prestige.count <= 0) return 0;
  let bonus = 0;
  for (const { def, rank } of boughtBoons(state)) {
    if (def.effect.kind === 'talent') bonus += def.effect.rate * rank * peak * state.prestige.count;
  }
  return bonus;
}

/**
 * Endowment's multiplier on one attribute's effective value, as a fraction:
 * rate × rank × the attribute's peak TRAINED level at any past prestige ×
 * prestiges. Talent's twin; the same constancy-within-a-run argument holds.
 */
export function endowmentBonus(state: GameState, attr: AttributeId): number {
  const peak = state.prestige.peakAttrs[attr] ?? 0;
  if (peak <= 0 || state.prestige.count <= 0) return 0;
  let bonus = 0;
  for (const { def, rank } of boughtBoons(state)) {
    if (def.effect.kind === 'endowment') bonus += def.effect.rate * rank * peak * state.prestige.count;
  }
  return bonus;
}

/** Prepared-spell pages prestige adds to the grimoire. */
export function legacyPreparedPages(state: GameState): number {
  let pages = 0;
  for (const { def, rank } of boughtBoons(state)) {
    if (def.effect.kind === 'preparedPages') pages += def.effect.pages * rank;
  }
  return pages;
}
