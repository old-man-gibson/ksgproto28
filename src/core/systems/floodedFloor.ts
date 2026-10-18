import type { GameState, MonsterInstance, DamageType } from '../types';
import type { EventBus } from '../engine/events';
import { applyStatus } from './statuses';
import { grantKeyItem, hasKeyItem } from './keyitems';
import { setStat } from './achievements';

export const TOLL_GOLEM = 'toll_collector_golem';
export const TOLL_SPELL_FLAG = 'flag:toll_encounter_spell';
export const OFFICE_PROGRESS = 'flag:toll_office_sequence';
export const OFFICE_ROOMS = ['f1_reception', 'f1_scribe', 'f1_auditor', 'f1_break_room', 'f1_registry', 'f1_dispatch', 'f1_supplies', 'f1_records', 'f1_toll_hall'];
export const OFFICE_SEQUENCE = ['f1_scribe', 'f1_auditor', 'f1_break_room', 'f1_scribe', 'f1_toll_hall'];
export const TOLL_REACTION_TICKS = 80;

/** Resolve a chosen room before discovery, quests or forced encounters observe arrival. */
export function officeArrival(state: GameState, bus: EventBus, from: string, to: string): string {
  if (!OFFICE_ROOMS.includes(to)) {
    if (OFFICE_ROOMS.includes(from)) setStat(state, bus, OFFICE_PROGRESS, 0);
    return to;
  }
  if (to === 'f1_reception') { setStat(state, bus, OFFICE_PROGRESS, 0); return to; }
  // Completed floors remain freely revisitable, including older saves.
  if ((state.stats['boss:f1_toll_hall'] ?? 0) > 0) return to;
  const progress = state.stats[OFFICE_PROGRESS] ?? 0;
  if (OFFICE_ROOMS.includes(from) && hasKeyItem(state, 'toll_office_key') && to === OFFICE_SEQUENCE[progress]) {
    setStat(state, bus, OFFICE_PROGRESS, progress + 1);
    return to;
  }
  // A wrong room is still a room the player can enter. The first room also
  // starts a new attempt, so revisiting the scribe is enough to recover.
  setStat(state, bus, OFFICE_PROGRESS, hasKeyItem(state, 'toll_office_key') && to === OFFICE_SEQUENCE[0] ? 1 : 0);
  state.travelPlan = [];
  state.travelIntent = null;
  bus.emit({ type: 'log', kind: 'explore', msg: 'This is not the path to the toll collector.' });
  if (to === 'f1_toll_hall') {
    bus.emit({ type: 'log', kind: 'explore', msg: 'The collector’s doorway leads back to reception. You still have the key and daybook.' });
    return 'f1_reception';
  }
  return to;
}

export function noteTollSpell(state: GameState, bus: EventBus): void {
  if (state.combat?.enemies.some((e) => e?.defId === TOLL_GOLEM)) setStat(state, bus, TOLL_SPELL_FLAG, 1);
}

export function reactTollGolem(state: GameState, target: MonsterInstance, type: DamageType): boolean {
  if (target.defId !== TOLL_GOLEM) return false;
  const id = type === 'heat' ? 'toll_steam' : type === 'cold' ? 'toll_ice' : type === 'lightning' ? 'toll_overdrive' : null;
  if (!id) return false;
  applyStatus(state, target, { id, intensity: 1, duration: TOLL_REACTION_TICKS }, 'Flooded office');
  return true;
}

export function rewardTollGolem(state: GameState, bus: EventBus): void {
  grantKeyItem(state, bus, 'toll_stamp');
  if (!state.stats[TOLL_SPELL_FLAG]) setStat(state, bus, 'flag:toll_brute_force', 1);
}
