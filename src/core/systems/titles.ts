import type { GameState, TitleDef } from '../types';
import type { EventBus } from '../engine/events';
import { TITLES } from '../registry';
import { conditionsMet } from './conditions';
import { text } from '../text/log';

export function hasTitle(state: GameState, id: string): boolean {
  return state.titles.includes(id);
}

export function equippedTitle(state: GameState): TitleDef | null {
  return state.title ? (TITLES[state.title] ?? null) : null;
}

/**
 * Earn any title whose unlock conditions now hold. Titles latch: once earned
 * they are permanent even if a `statMax` restraint is later exceeded — which
 * is exactly how "do X while never having done Y" deeds work: the check runs
 * on the event that completes X, while Y is still intact.
 */
export function checkTitleUnlocks(state: GameState, bus: EventBus): void {
  for (const def of Object.values(TITLES)) {
    if (hasTitle(state, def.id)) continue;
    if (!conditionsMet(state, def.unlock)) continue;

    state.titles.push(def.id);
    bus.emit({ type: 'title:unlock', id: def.id });
    bus.emit({
      type: 'log',
      msg: text('titles.earned', { icon: def.icon, name: def.name }),
      kind: 'achievement',
    });
  }
}

/** Wear a title (null to go bare). Only earned titles can be worn. */
export function setTitle(state: GameState, bus: EventBus, id: string | null): void {
  if (id !== null && (!TITLES[id] || !hasTitle(state, id))) return;
  if (state.title === id) return;
  state.title = id;
  if (id) {
    const def = TITLES[id];
    bus.emit({ type: 'log', msg: text('titles.worn', { name: def.name }), kind: 'achievement' });
  }
}

/** Wire title checks to every event that can complete an unlock condition. */
export function registerTitleListeners(state: GameState, bus: EventBus): void {
  const check = () => checkTitleUnlocks(state, bus);
  bus.on('attr:levelup', check);
  bus.on('skill:levelup', check);
  bus.on('kill', check);
  bus.on('quest:complete', check);
  bus.on('achievement', check);
  bus.on('craft', check);
  bus.on('arrive', check);
  bus.on('superattr:unlock', check);
}
