import type { GameState } from '../types';
import type { EventBus } from '../engine/events';
import { KEY_ITEMS } from '../data/keyitems.data';
import { setStat } from './achievements';

export const keyItemKey = (id: string): string => `flag:key_item:${id}`;
export const hasKeyItem = (state: GameState, id: string): boolean => (state.stats[keyItemKey(id)] ?? 0) > 0;

export function grantKeyItem(state: GameState, bus: EventBus, id: string): void {
  const item = KEY_ITEMS[id];
  if (!item || hasKeyItem(state, id)) return;
  setStat(state, bus, keyItemKey(id), 1);
  bus.emit({ type: 'log', kind: 'loot', msg: `${item.icon} Found ${item.name}. ${item.desc}` });
}
