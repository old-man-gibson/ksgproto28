import type { EventBus } from '../engine/events';
import type { FestivalRun, GameState, RoyaleField } from '../types';
import { SPOTS } from '../registry';
import {
  ARENA,
  ROYALE_COUNTER,
  SURVIVORS,
  SURVIVOR_CHAMPION,
  SURVIVOR_SPECIES,
  type FestivalFoe,
} from '../data/festival.data';
import { randInt } from '../engine/rng';
import { startStagedGroup } from './combat';
import { survivorLevel } from './festivalRules';
import { text } from '../text/log';

/**
 * The royale on floor 16, as a counter (docs/FLOOR_IDEAS.md §5.4 Q6's
 * default; stage 1 of the festival build). The ninety-nine thin out on their
 * own, and between the player's fights the field sends one or two at the
 * player, stronger as it empties. The last survivor is never thinned: the
 * champion waits for the player, and beating it wins the royale.
 *
 * Coarse on purpose: a count and two tick stamps, so nothing here needs a
 * full simulation of the other fights.
 */

/** The field as the climb into the royale finds it. */
export function freshField(state: GameState): RoyaleField {
  return { alive: SURVIVORS, engaged: 0, nextThin: state.totalTicks + ROYALE_COUNTER.thinTicks };
}

/** One tick of the field while the player stands on it. */
export function tickRoyale(state: GameState, bus: EventBus, run: FestivalRun): void {
  if (!run.field) {
    run.field = freshField(state);
    run.nextAt = state.totalTicks + ROYALE_COUNTER.firstEngage;
  }
  const field = run.field;
  // The others fight each other whatever the player is doing.
  if (state.totalTicks >= field.nextThin) {
    if (field.alive - field.engaged > 1) field.alive -= 1;
    field.nextThin = state.totalTicks + ROYALE_COUNTER.thinTicks;
  }
  if (state.combat || field.alive <= 0 || state.totalTicks < run.nextAt) return;
  const foes = engagement(state, run, field);
  field.engaged = foes.length;
  startStagedGroup(state, bus, SPOTS[ARENA], foes);
}

/** Who the field sends next: one or two survivors, or the champion alone at the end. */
function engagement(state: GameState, run: FestivalRun, field: RoyaleField): FestivalFoe[] {
  if (field.alive === 1) {
    return [{ monsterId: SURVIVOR_CHAMPION, level: survivorLevel(run.clock, 1, true) }];
  }
  // Never the last one with company: the champion is fought alone.
  const size = Math.min(field.alive - 1, randInt(state, 1, 2));
  const level = survivorLevel(run.clock, field.alive);
  return Array.from({ length: size }, () => ({
    monsterId: SURVIVOR_SPECIES[randInt(state, 0, SURVIVOR_SPECIES.length - 1)],
    level,
  }));
}

/**
 * The player's fight on the field was won: the survivors in it are gone.
 * True when none are left, which is the royale won.
 */
export function royaleFightWon(state: GameState, bus: EventBus, run: FestivalRun): boolean {
  const field = run.field;
  if (!field) return false;
  field.alive = Math.max(0, field.alive - field.engaged);
  field.engaged = 0;
  run.nextAt = state.totalTicks + ROYALE_COUNTER.engageGap;
  if (field.alive > 0) {
    bus.emit({ type: 'log', msg: text('festival.field_left', { alive: field.alive }), kind: 'combat' });
  }
  return field.alive === 0;
}
