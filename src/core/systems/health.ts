import type { DamageType, DerivedStats, GameState } from '../types';
import { availableMax, resourceValue, restoreResource, setResource, spendResource } from './resources';
import { fireStatusEvent, healAllowance, noteHealed } from './statuses';

/**
 * The damage types that stop a MONSTER knitting. Fire and acid: the two that
 * keep working on a wound after they land.
 *
 * ⚠️ Monster-side only. The player's version of this rule used to live here as
 * a matching constant, which made "what douses you" a property of the game
 * rather than of the body — so a gene could not carry its own answer and
 * nothing could rewrite it. That half now rides the `knitting` condition, whose
 * `removal.damageTypes` the conferring gene writes (see MainGeneDef.confers).
 * A monster has no chromosome to carry one, so it keeps the shared default
 * until something gives it a reason not to.
 */
export const DOUSING_TYPES: ReadonlySet<DamageType> = new Set<DamageType>(['heat', 'acid']);
import {
  noteHealed as ledgerHealed,
  noteHealRefused as ledgerHealRefused,
  noteIncoming,
} from './ledger';

/**
 * Health, and the one door it changes through.
 *
 * HP is an ordinary resource pool (see resources.ts) — what earns it its own
 * module is that a great many things want to *observe* it changing. Conditions
 * do: a bleed that stops when you are tended to, a burn that caps how much of
 * its damage healing may undo, ice that cannot survive being hit. None of that
 * is possible while healing is `state.hp += x` scattered across the codebase,
 * so every gain and loss goes through here instead.
 *
 * The `HealKind` matters for the same reason. "Healing" is not one thing:
 * sitting down to rest, smearing on a salve and casting a mending spell are
 * different acts, and conditions are entitled to care which one you performed.
 */

export type HealKind =
  /**
   * Deliberate recovery: the rest activity, or being knocked out and coming to.
   * Both are the `hpRegen` trickle, several times over — see RECOVERY_MULT.
   */
  | 'rest'
  /** The same trickle, at the pace doing something else quietly earns you. */
  | 'idle'
  /** A consumable applied to the wound. */
  | 'salve'
  /**
   * A brewed Draught, drunk: restores health and treats nothing. No condition's
   * removal rules name it, so it closes no wound (only the Salve does).
   */
  | 'draught'
  /** Restorative magic. */
  | 'spell'
  /** Damage turned back into health mid-fight. */
  | 'lifesteal'
  | 'other';

/**
 * Restore health. Returns the amount actually healed, which may be less than
 * asked for — the pool has a ceiling, and (once conditions land) a burn may
 * refuse to let a share of its damage be undone.
 *
 * Conditions get two say-sos here: they may cap the amount before it lands
 * (a blaze lets only half of its damage be undone), and they react to the
 * treatment afterwards — a bleed closes, a laceration eases back to a bleed.
 */
export function heal(
  state: GameState,
  stats: DerivedStats,
  amount: number,
  kind: HealKind = 'other',
): number {
  if (amount <= 0) return 0;
  // A burn refuses to let all of itself be undone, so the heal is capped
  // before it lands — and what does land is remembered against that cap.
  const allowed = Math.min(amount, healAllowance(state));
  const healed = allowed > 0 ? restoreResource(state, stats, 'hp', allowed) : 0;
  if (healed > 0) noteHealed(state, healed);
  ledgerHealed(state, kind, healed);
  // What a condition would not let you undo is worth as much to the post-fight
  // read as what you got back — a blaze is why the salve did nothing.
  ledgerHealRefused(state, amount - allowed);
  // Being tended to is itself an event: a bleed closes, a laceration eases
  // back to an ordinary one. This fires even when the cap swallowed the heal,
  // because the treatment still happened.
  fireStatusEvent(state, state, 'heal', { healKind: kind });
  return healed;
}

/**
 * Take damage. Returns the amount actually lost. The caller has already
 * resolved armor, resistances and every other defence — this is the ledger
 * entry, not the calculation.
 *
 * Conditions that cannot survive a blow resolve here — which is why even a
 * plain hit goes through this door rather than touching the pool directly.
 */
export function damagePlayer(
  state: GameState,
  amount: number,
  type?: DamageType,
  source?: { key: string; label: string; icon: string } | null,
): number {
  if (amount <= 0) return 0;
  const lost = spendResource(state, 'hp', amount);
  // Attribution happens HERE, at the one door, so nothing that can hurt you is
  // able to do it anonymously. An unattributed blow is still counted — better a
  // line reading "unknown" than a ledger that quietly does not add up.
  //
  // `null` is the one exception, and it means "already attributed": a tick of
  // conditions arrives as a single sum with its own per-condition breakdown,
  // and splitting it into one damagePlayer call each would fire `damageTaken`
  // once per affliction, shattering ice several times over for one tick.
  if (source !== null) {
    noteIncoming(state, source ?? { key: 'unknown', label: 'Unknown', icon: '❔' }, lost);
  }
  // Taking a blow shatters what could not survive one (ice), and drives off
  // what the blow's own element answers (fire against a drenching). The type
  // is passed on so conditions can care which it was.
  // The amount rides along with the type, for rules that answer to how hard a
  // blow was rather than how many there were (StatusRemoval.afterDamage).
  fireStatusEvent(state, state, 'damageTaken', type ? { damageType: type, amount: lost } : { amount: lost });
  // A body that knits itself back together stops while it is being burned or
  // eaten — but that rule is no longer written here. It rides the `knitting`
  // condition the gene confers, whose own `removal` names the types that douse
  // IT, so the trigger is per-body data instead of a constant everything
  // shares. The event fired above is what springs it, which also means every
  // source still counts: a condition ticking, a trap, a thrown flask.
  return lost;
}

/** Health as a fraction of the pool's current ceiling. */
export function hpFraction(state: GameState, stats: DerivedStats): number {
  const max = availableMax(state, stats, 'hp');
  return max > 0 ? resourceValue(state, 'hp') / max : 0;
}

export function isAlive(state: GameState): boolean {
  return resourceValue(state, 'hp') > 0;
}

/**
 * Drop to the sliver of health a knockout leaves you with. Deliberately not a
 * heal — nothing about being beaten unconscious should satisfy a condition
 * that is waiting to be tended to.
 */
export function setHpAfterDefeat(state: GameState): void {
  setResource(state, 'hp', 1);
}
