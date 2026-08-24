import type { GameEvent, GameEventType } from '../types';

type Handler<T extends GameEventType> = (ev: Extract<GameEvent, { type: T }>) => void;

/**
 * Minimal synchronous typed event bus. Systems emit events; loosely-coupled
 * systems (achievements, logging, future quests) subscribe to them.
 */
export class EventBus {
  private handlers = new Map<GameEventType, ((ev: GameEvent) => void)[]>();

  on<T extends GameEventType>(type: T, fn: Handler<T>): () => void {
    const list = this.handlers.get(type) ?? [];
    list.push(fn as (ev: GameEvent) => void);
    this.handlers.set(type, list);
    return () => {
      const cur = this.handlers.get(type);
      if (cur) this.handlers.set(type, cur.filter((h) => h !== (fn as unknown)));
    };
  }

  emit(ev: GameEvent): void {
    const list = this.handlers.get(ev.type);
    if (!list) return;
    for (const fn of list) fn(ev);
  }
}
