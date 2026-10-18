import type { GameState } from '../types';
import type { EventBus } from '../engine/events';
import { setStat } from './achievements';
import { grantFavor } from './deities';

/**
 * Piecemeal subsystem unlocking, alpha shape (plans/alpha-scope-locks.md).
 *
 * Five systems are shuttered for the alpha: their tabs, benches and school
 * pages simply do not render until the flag lifts. The latch is an ordinary
 * `flag:*` counter, which buys three things at once: content can lift it
 * today (`SpotFind.stat`, and quest rewards once those grow a stat kind), the
 * flag namespace is already linted in both validation layers, and no save
 * field exists to migrate. Saves from before v47 have seen all five systems,
 * so the v46→v47 migration stamps every flag — hiding a tab that holds a
 * player's own compositions would be a regression, not a lock.
 *
 * This is deliberately a UI shutter, not an engine gate: skills, statuses and
 * saved work behind a locked system keep functioning. Locking is about what a
 * NEW player is invited into, never about confiscating state.
 */
export const LOCKABLE_SUBSYSTEMS = ['runecarving', 'music', 'genes', 'psionics', 'wuxin'] as const;
export type LockableSubsystem = (typeof LOCKABLE_SUBSYSTEMS)[number];

/** The stat counter that opens a subsystem — `>= 1` is open. */
export const unlockKey = (id: LockableSubsystem): string => `flag:unlock_${id}`;

export function subsystemUnlocked(state: GameState, id: LockableSubsystem): boolean {
  return (state.stats[unlockKey(id)] ?? 0) >= 1;
}

// ---------- The starter lexicon ----------

/**
 * The arcane words a new life opens with (user, 2026-09-06): three elements,
 * three verbs, two adverbs, three targets. Everything else is neither
 * accessible nor VISIBLE until content unlocks it — `flag:word:<id>` is the
 * latch, liftable by finds today and quest rewards later. No conjunction is
 * in the set on purpose: single-clause speech is the whole opening game.
 *
 * The gate lives in LEGALITY (`checkSentence`) and the bench UI, never in the
 * reading — `composeArcane` stays pure, monsters speak what they like, and
 * the yShicna' seam (NEXT.md) is untouched.
 */
export const STARTER_LEXICON: ReadonlySet<string> = new Set([
  'fire', 'ice', 'spark',
  'pierce', 'ward', 'mend',
  'quickly', 'slowly',
  'one', 'me', 'others',
]);

export const wordUnlockKey = (wordId: string): string => `flag:word:${wordId}`;

/** May this speaker see and speak the word? (Base word id, never a stacked form.) */
export function wordUnlocked(state: GameState, wordId: string): boolean {
  return STARTER_LEXICON.has(wordId) || (state.stats[wordUnlockKey(wordId)] ?? 0) >= 1;
}

// ---------- The known gods ----------

/**
 * The two deities a new life can find unaided (user, 2026-09-06). The rest
 * wait to be MET — `met:deity:<id>`, stamped by future authored encounters —
 * which is the alpha-light form of the parked deities-must-be-met design
 * (NEXT.md): favor accrues and miracles show only for gods you know of.
 */
export const STARTER_DEITIES: ReadonlySet<string> = new Set(['denjalle', 'usvylgr']);

export const deityMetKey = (deityId: string): string => `met:deity:${deityId}`;

/**
 * Meet a god: the single entry point future authored encounters call. Stamps
 * `met:deity:<id>` and pays the votive baseline (the first votive token's
 * standing +2), so devotion shown before the meeting still counts. Returns
 * false for a god already known.
 */
export function meetDeity(state: GameState, bus: EventBus, deityId: string): boolean {
  if (deityKnown(state, deityId)) return false;
  setStat(state, bus, deityMetKey(deityId), 1);
  grantFavor(state, deityId, state.stats['votive:baseline'] ?? 0);
  return true;
}

export function deityKnown(state: GameState, deityId: string): boolean {
  return STARTER_DEITIES.has(deityId) || (state.stats[deityMetKey(deityId)] ?? 0) >= 1;
}
