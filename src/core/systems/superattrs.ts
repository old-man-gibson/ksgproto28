import type { GameState } from '../types';
import type { EventBus } from '../engine/events';
import { SUPERATTRS } from '../registry';
import { conditionsMet } from './conditions';
import { attrName, attrValue, isFused } from './attributes';
import { raiseStat } from './achievements';

/**
 * Fuse any super-attribute whose unlock conditions now hold. Cheap enough to
 * run on every relevant event (attribute/skill levelups, kills).
 */
export function checkSuperUnlocks(state: GameState, bus: EventBus): void {
  for (const def of Object.values(SUPERATTRS)) {
    if (isFused(state, def.id)) continue;
    if (!conditionsMet(state, def.unlock)) continue;

    state.fused.push(def.id);
    bus.emit({ type: 'superattr:unlock', id: def.id });
    const [a, b] = def.components;
    bus.emit({
      type: 'log',
      msg: `${def.icon} FUSION! ${attrName(a)} and ${attrName(b)} coalesce into ${def.name.toUpperCase()} (${attrValue(state, a)})!`,
      kind: 'fusion',
    });
    // Attribute-threshold achievements must see the fused value immediately.
    raiseStat(state, bus, `attr:${a}`, attrValue(state, a));
    raiseStat(state, bus, `attr:${b}`, attrValue(state, b));
  }
}

/** Wire fusion checks to the events that can satisfy unlock conditions. */
export function registerSuperAttrListeners(state: GameState, bus: EventBus): void {
  bus.on('attr:levelup', () => checkSuperUnlocks(state, bus));
  bus.on('skill:levelup', () => checkSuperUnlocks(state, bus));
  bus.on('skill:unlock', () => checkSuperUnlocks(state, bus));
  bus.on('kill', () => checkSuperUnlocks(state, bus));
}
