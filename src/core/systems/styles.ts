import type { CombatStyleDef, GameState } from '../types';
import { STYLES } from '../registry';
import { conditionsMet } from './conditions';
import { statusForcedStyle } from './statuses';

export function styleUnlocked(state: GameState, def: CombatStyleDef): boolean {
  return !def.unlock || conditionsMet(state, def.unlock);
}

/** The generic stances, in declaration order — the fixed roster of slots. */
export function stances(): CombatStyleDef[] {
  return Object.values(STYLES).filter((s) => !s.replaces);
}

/**
 * The stance slot a style id belongs to. A school resolves to the stance it
 * replaces, so an old save (or a trigger) naming a school still points at a
 * slot rather than at something the player can no longer select.
 */
export function stanceIdFor(id: string): string {
  const def = STYLES[id];
  if (!def) return 'balanced';
  return def.replaces ?? def.id;
}

/**
 * How strongly a school claims its slot when more than one qualifies. More
 * unlock conditions means a more specific loadout (sword + shield beats plain
 * sword), then higher mastery, then id for determinism.
 */
function claimScore(state: GameState, def: CombatStyleDef): number {
  const level = def.skill ? (state.skills[def.skill]?.level ?? 0) : 0;
  return (def.unlock?.length ?? 0) * 1e6 + level;
}

/**
 * The school currently filling a stance's slot: manifested, and its weapon
 * conditions hold right now. Derived from live state on every read, so
 * swapping weapons swaps the style with no player input.
 */
export function schoolForStance(state: GameState, stanceId: string): CombatStyleDef | undefined {
  let best: CombatStyleDef | undefined;
  let bestScore = -1;
  for (const def of Object.values(STYLES)) {
    if (def.replaces !== stanceId || !styleUnlocked(state, def)) continue;
    const score = claimScore(state, def);
    if (score > bestScore || (score === bestScore && best && def.id < best.id)) {
      best = def;
      bestScore = score;
    }
  }
  return best;
}

/**
 * The style that actually applies in combat: the selected stance, or the
 * school occupying that stance's slot for the current loadout.
 */
export function effectiveStyleId(state: GameState): string {
  // A condition can take the choice away entirely — a perforated fighter holds
  // whatever form they can, not the one they picked.
  const forced = statusForcedStyle(state);
  const stance = stanceIdFor(forced ?? state.style);
  return schoolForStance(state, stance)?.id ?? stance;
}

export function effectiveStyleDef(state: GameState): CombatStyleDef {
  return STYLES[effectiveStyleId(state)];
}

/** One selectable slot: the stance you pick, and what is fighting in it now. */
export interface StyleSlot {
  /** The generic stance — what `state.style` stores and what the button picks. */
  stance: CombatStyleDef;
  /** The stance, or the school that has supplanted it for this loadout. */
  active: CombatStyleDef;
}

/**
 * The style roster for the UI: one entry per stance, always in the same order.
 * Schools never get their own button — they take over their stance's slot.
 */
export function styleSlots(state: GameState): StyleSlot[] {
  return stances().map((stance) => ({
    stance,
    active: schoolForStance(state, stance.id) ?? stance,
  }));
}
