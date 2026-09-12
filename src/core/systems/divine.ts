import type { GameState, MiracleDef, SpellSpec } from '../types';
import type { EventBus } from '../engine/events';
import { MIRACLES, MIRACLE_LIST } from '../data/spellcraft.data';
import { DEITIES, DEITY_LIST } from '../data/deities.data';
import { checkDiscovery, grantSkillXp } from './skills';
import { grantFavor as addFavor, favorWith, spendFavor } from './deities';
import { bumpStat } from './achievements';
import { addSpell, hasDivine } from './spellcraft';
import { deityKnown } from './unlocks';

/**
 * Divine magic: worship, favor, miracles.
 *
 * Where arcane magic is composed and psionic magic is shaped, divine magic
 * is RECEIVED. Each miracle is an aspect of one deity's power (see
 * data/deities.data.ts for the pantheon and how it regards itself); what the
 * player brings is standing — favor with that deity, earned by deeds and
 * spent, once, to be taught the working. Which miracles may share a grimoire
 * page is the pantheon's business, enforced at PREPARE time in spellcraft.ts.
 */

export function devotionLevel(state: GameState): number {
  return state.skills.devotion?.level ?? 0;
}

export { favorWith };

/**
 * Every KNOWN god takes note of a deed. Deities the player has not met
 * (systems/unlocks.ts — the alpha-light form of deities-must-be-met) accrue
 * nothing: standing with a god you have never heard of was exactly the smell
 * that design exists to fix. Deity-specific deeds will bias this later.
 */
export function grantFavorAll(state: GameState, bus: EventBus, amount: number): void {
  if (amount <= 0) return;
  for (const deity of DEITY_LIST) {
    if (deityKnown(state, deity.id)) addFavor(state, deity.id, amount);
  }
  bus.emit({ type: 'log', msg: `🕊️ The gods you know take note. (+${amount} favor)`, kind: 'skill' });
}

export interface MiracleCheck {
  ok: boolean;
  reason?: string;
}

export function checkMiracle(state: GameState, id: string): MiracleCheck {
  const miracle = MIRACLES[id];
  if (!miracle) return { ok: false, reason: 'No such miracle' };
  if (hasDivine(state, id)) return { ok: false, reason: 'Already received' };
  if ((miracle.minLevel ?? 0) > devotionLevel(state)) {
    return { ok: false, reason: `Needs Devotion ${miracle.minLevel}` };
  }
  const held = favorWith(state, miracle.deity);
  if (held < miracle.favorCost) {
    const deity = DEITIES[miracle.deity];
    return { ok: false, reason: `Needs ${miracle.favorCost} favor with ${deity?.name ?? miracle.deity} (you have ${held})` };
  }
  return { ok: true };
}

/**
 * Receive a miracle: favor with its deity is spent, the working arrives
 * whole, and it goes into the same grimoire every other school writes to.
 * Learning is unrestricted — hostile powers only refuse to be PREPARED
 * side by side, not studied.
 */
export function learnMiracle(state: GameState, bus: EventBus, id: string): boolean {
  const check = checkMiracle(state, id);
  if (!check.ok) {
    if (check.reason) bus.emit({ type: 'log', msg: `🔒 ${check.reason}`, kind: 'danger' });
    return false;
  }
  const miracle = MIRACLES[id]!;
  spendFavor(state, miracle.deity, miracle.favorCost);
  addSpell(state, { school: 'divine', litany: id });
  bumpStat(state, bus, 'miracles:learned');

  // Receiving a miracle is an act of devotion; it may be the first.
  checkDiscovery(state, bus, ['spellcraft', 'magic', 'divine']);
  grantSkillXp(state, bus, ['spellcraft', 'magic', 'divine'], 20, [`divine:${id}`]);
  const deity = DEITIES[miracle.deity];
  bus.emit({
    type: 'log',
    msg: `${miracle.icon} Received: ${miracle.name} — an aspect of ${deity?.name ?? miracle.deity}.`,
    kind: 'item',
  });
  return true;
}

/** Resolve a miracle to its spec. Missing miracles read as nothing at all. */
export function miracleSpec(id: string): SpellSpec | null {
  const miracle = MIRACLES[id];
  if (!miracle) return null;
  return { ...miracle.spec, school: 'divine', deity: miracle.deity };
}

/** Every miracle, learned or not, for the divine bench. */
export function availableMiracles(): MiracleDef[] {
  return MIRACLE_LIST;
}
