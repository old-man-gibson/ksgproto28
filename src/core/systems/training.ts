import type { EventBus } from '../engine/events';
import type { GameState, SpotDef } from '../types';
import { MONSTERS, SPOTS, STATUSES } from '../registry';
import { ATTRIBUTE_LIST } from '../data/attributes.data';
import { bumpStat, setStat } from './achievements';
import { startStagedFight } from './combat';
import { getDerivedStats } from './derived';
import { heal } from './health';
import { removeStatus } from './statuses';
import { text } from '../text/log';

/**
 * Training spots: a keeper who looks after beginners (`SpotDef.healBetweenBouts`)
 * and, now and then, dares them (`SpotDef.dare`). The Cages are the first.
 *
 * Why it exists: a fresh character hunting the Cages was knocked out on the
 * first visit in 35 of 40 seeds with the rusty sword (playtest 2026-10-17),
 * because a hunt rolls the next bout with no recovery and a bleed rides
 * along. Healing between bouts removes the chain; each bout keeps its own
 * risk.
 *
 * The dare HOLDS play: while it waits, `Game.tick` advances nothing and banks
 * each tick as bonus time instead (the step buttons do nothing either), so a
 * question asked while the player is away costs them nothing. The pending
 * question is a stat (`dare:<spot>:pending`), so it survives a reload with no
 * save-shape change; `hold:dare` is the one key the tick reads.
 */

/** The one counter `Game.tick` reads: 1 while any dare waits for an answer. */
export const HOLD_KEY = 'hold:dare';
const pendingKey = (spotId: string) => `dare:${spotId}:pending`;
const winsKey = (spotId: string) => `dare:${spotId}:wins`;
/** How many times the keeper has healed you; the first time carries the line. */
const PATCHED_KEY = 'training:patched';

/** The six attribute levels added up: the "level" a keeper judges you by. */
export function attrTotal(state: GameState): number {
  return ATTRIBUTE_LIST.reduce((sum, a) => sum + (state.attrs[a.id]?.level ?? 0), 0);
}

/** Whether this spot's keeper still treats the player as a beginner. */
export function keeperTends(state: GameState, spot: SpotDef): boolean {
  return !!spot.healBetweenBouts && attrTotal(state) <= spot.healBetweenBouts.maxAttrTotal;
}

/** Whether the dare's monster has been beaten (then the keeper stops asking). */
export function dareBeaten(state: GameState, spot: SpotDef): boolean {
  return !!spot.dare && (state.stats[`kills:${spot.dare.monsterId}`] ?? 0) >= 1;
}

/** True while a dare is waiting for an answer — play is held. */
export function holdingForDare(state: GameState): boolean {
  return (state.stats[HOLD_KEY] ?? 0) > 0;
}

/**
 * Whether play is held right now — the check `Game.tick` makes. Reads one
 * stat on the ordinary path; only a set hold looks for its spot, and a hold
 * whose dare has vanished (content renamed under a save) is dropped rather
 * than left to freeze a game with no question on screen.
 */
export function dareHolds(state: GameState): boolean {
  if (!holdingForDare(state)) return false;
  if (pendingDare(state)) return true;
  delete state.stats[HOLD_KEY];
  return false;
}

/** The spot whose dare is waiting, if any. */
export function pendingDare(state: GameState): SpotDef | null {
  if (!holdingForDare(state)) return null;
  for (const spot of Object.values(SPOTS)) {
    if (spot.dare && (state.stats[pendingKey(spot.id)] ?? 0) > 0) return spot;
  }
  return null;
}

/** Wins left before the keeper dares you again (null when no dare is coming). */
export function winsUntilDare(state: GameState, spot: SpotDef): number | null {
  if (!spot.dare || dareBeaten(state, spot) || !keeperTends(state, spot)) return null;
  return Math.max(0, spot.dare.every - (state.stats[winsKey(spot.id)] ?? 0));
}

/** Heal to full and drop every condition that deals damage over time. */
function patchUp(state: GameState, bus: EventBus, cap: number): void {
  const stats = getDerivedStats(state);
  let did = heal(state, stats, stats.maxHp) > 0;
  for (const s of [...state.statuses]) {
    const def = STATUSES[s.id];
    if (!def?.dot || def.hidden) continue;
    removeStatus(state, s.id);
    did = true;
  }
  if (!did) return;
  const first = (state.stats[PATCHED_KEY] ?? 0) === 0;
  bumpStat(state, bus, PATCHED_KEY);
  const msg = first ? text('training.patched_first', { cap }) : text('training.patched');
  bus.emit({ type: 'log', msg, kind: 'skill' });
}

function onWin(state: GameState, bus: EventBus, spotId: string, forced: boolean): void {
  const spot = SPOTS[spotId];
  if (!spot || !keeperTends(state, spot)) return;
  patchUp(state, bus, spot.healBetweenBouts!.maxAttrTotal);
  // The dare's own fight is forced; it never counts toward the next dare.
  if (!spot.dare || forced || dareBeaten(state, spot)) return;
  bumpStat(state, bus, winsKey(spot.id));
  if ((state.stats[winsKey(spot.id)] ?? 0) < spot.dare.every) return;
  setStat(state, bus, winsKey(spot.id), 0);
  setStat(state, bus, pendingKey(spot.id), 1);
  setStat(state, bus, HOLD_KEY, 1);
  bus.emit({
    type: 'log',
    msg: text('training.dare_held', { name: MONSTERS[spot.dare.monsterId]?.name ?? spot.dare.monsterId }),
    kind: 'danger',
  });
}

/**
 * Answer the waiting dare. Accepting starts the staged, unfleeable fight
 * where the player stands; declining lets the cages carry on as before.
 * Either way the hold lifts.
 */
export function answerDare(state: GameState, bus: EventBus, accept: boolean): boolean {
  const spot = pendingDare(state);
  delete state.stats[HOLD_KEY];
  if (!spot?.dare) return false;
  delete state.stats[pendingKey(spot.id)];
  const name = MONSTERS[spot.dare.monsterId]?.name ?? spot.dare.monsterId;
  if (accept && state.spot === spot.id) {
    bus.emit({ type: 'log', msg: text('training.dare_taken', { name }), kind: 'danger' });
    startStagedFight(state, bus, spot, spot.dare.monsterId, spot.dare.level);
    return true;
  }
  bus.emit({ type: 'log', msg: text('training.dare_declined', { name, every: spot.dare.every }), kind: 'info' });
  return true;
}

export function registerTrainingListeners(state: GameState, bus: EventBus): void {
  bus.on('fight:won', (ev) => onWin(state, bus, ev.spot, ev.forced));
}
