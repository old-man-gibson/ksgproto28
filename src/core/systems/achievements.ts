import type { GameState } from '../types';
import type { EventBus } from '../engine/events';
import { ACHIEVEMENTS } from '../registry';
import { attrValue } from './attributes';
import { monsterTagSet } from './bestiary';
import { text } from '../text/log';

/** Increment a counter and grant any achievement tiers it crosses. */
export function bumpStat(state: GameState, bus: EventBus, key: string, amount = 1): void {
  state.stats[key] = (state.stats[key] ?? 0) + amount;
  checkAchievements(state, bus, key);
}

/** For level-style stats we track the max rather than a running total. */
export function raiseStat(state: GameState, bus: EventBus, key: string, value: number): void {
  if ((state.stats[key] ?? 0) >= value) return;
  state.stats[key] = value;
  checkAchievements(state, bus, key);
}

/**
 * Overwrite a counter — the RESET path (a find setting `slain:*`/`fights:*`
 * back to 0, or clearing a `flag:*`). Lives here because this module is the
 * one legal writer of `state.stats`; the tier check still runs, though a
 * reset is normally a step DOWN and crosses nothing.
 */
export function setStat(state: GameState, bus: EventBus, key: string, value: number): void {
  state.stats[key] = value;
  checkAchievements(state, bus, key);
}

export function checkAchievements(state: GameState, bus: EventBus, statKey: string): void {
  const value = state.stats[statKey] ?? 0;
  for (const def of Object.values(ACHIEVEMENTS)) {
    if (def.statKey !== statKey) continue;
    let claimed = state.achievements[def.id] ?? 0;
    while (claimed < def.tiers.length && value >= def.tiers[claimed].threshold) {
      claimed += 1;
      state.achievements[def.id] = claimed;
      bus.emit({ type: 'achievement', id: def.id, tier: claimed });
      bus.emit({
        type: 'log',
        msg: text('achievements.claimed', { icon: def.icon, name: def.name, tier: tierNumeral(claimed) }),
        kind: 'achievement',
      });
    }
  }
}

export function tierNumeral(tier: number): string {
  return ['I', 'II', 'III', 'IV', 'V'][tier - 1] ?? `${tier}`;
}

/** Wire achievement tracking to the events other systems emit. */
export function registerAchievementListeners(state: GameState, bus: EventBus): void {
  // Threshold checks see the fused super-attribute value once fusion happens.
  bus.on('attr:levelup', (ev) => raiseStat(state, bus, `attr:${ev.attr}`, attrValue(state, ev.attr)));
  bus.on('skill:levelup', () => bumpStat(state, bus, 'skill:levels'));
  bus.on('kill', (ev) => {
    bumpStat(state, bus, 'kills');
    bumpStat(state, bus, `kills:${ev.monster.defId}`);
    // Per-tag tallies too, so an achievement can count "slimes" or "goblins"
    // without naming every species. Derived tags (tier, swarm…) count as well.
    for (const tag of monsterTagSet(ev.monster.defId)) {
      bumpStat(state, bus, `kills:tag:${tag}`);
    }
  });
  bus.on('arrive', () => bumpStat(state, bus, 'travel:trips'));
  bus.on('defeat', () => bumpStat(state, bus, 'defeats'));
}
