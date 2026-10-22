import type { GameState, MonsterInstance, DamageType } from '../types';
import type { EventBus } from '../engine/events';
import { applyStatus } from './statuses';
import { grantKeyItem, hasKeyItem } from './keyitems';
import { setStat } from './achievements';
import { randInt } from '../engine/rng';
import { SPOTS } from '../registry';

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
  // The first room starts a new attempt, so walking into the scribe's office
  // is enough to recover: that door opens where it says.
  const restart = hasKeyItem(state, 'toll_office_key') && to === OFFICE_SEQUENCE[0];
  setStat(state, bus, OFFICE_PROGRESS, restart ? 1 : 0);
  state.travelPlan = [];
  state.travelIntent = null;
  bus.emit({ type: 'log', kind: 'explore', msg: 'This is not the path to the toll collector.' });
  if (to === 'f1_toll_hall') {
    bus.emit({ type: 'log', kind: 'explore', msg: 'The collector’s doorway leads back to reception. You still have the key and daybook.' });
    return 'f1_reception';
  }
  if (restart) return to;
  // Any other wrong door lets out somewhere else (user, 2026-10-21): another
  // office, never the one chosen, reception, the collector's or the scribe's
  // (which would read as a restart). Every office links to every other and to
  // reception, so no drop strands anyone. The save's own RNG picks, so a run
  // replays the same.
  const drops = OFFICE_ROOMS.filter((r) => r !== to && r !== 'f1_reception' && r !== 'f1_toll_hall' && r !== OFFICE_SEQUENCE[0]);
  const landed = drops[randInt(state, 0, drops.length - 1)];
  bus.emit({
    type: 'log',
    kind: 'explore',
    msg: `The door lets out into ${SPOTS[landed]?.name ?? 'another office'}, not ${SPOTS[to]?.name ?? 'the office it named'}.`,
  });
  return landed;
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
