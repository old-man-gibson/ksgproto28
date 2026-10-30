import type { FestivalRun, FloorDef, GameState } from '../types';
import { FLOOR_BY_AREA, SPOTS, TOWERS } from '../registry';
import {
  DARK_FLOOR,
  FESTIVAL_BAND,
  LOCKOUT_TICKS,
  PREP_TICKS,
  ROYALE_FLOOR,
  SURVIVORS,
  SURVIVOR_LEVELS,
} from '../data/festival.data';

/**
 * The Vermin Festival's pure reads and its one pure transition, the climb
 * into the royale (docs/FLOOR_IDEAS.md §5.3). Kept apart from
 * systems/festival.ts, which stages fights and so imports combat, so that the
 * ladder, the retreat and the climb can ask about the festival without an
 * import cycle: this module reads state and the registry and nothing else.
 */

/** The festival floor a spot stands on, or null. */
export function festivalFloorOf(spotId: string): FloorDef | null {
  const spot = SPOTS[spotId];
  if (!spot) return null;
  const floor = FLOOR_BY_AREA.get(spot.areaId);
  return floor?.bandId === FESTIVAL_BAND ? floor : null;
}

/** The player stands on floor 15 or 16. */
export function onFestivalFloor(state: GameState): boolean {
  return festivalFloorOf(state.spot) !== null;
}

/** The attempt in progress, if any. */
export function festivalRun(state: GameState): FestivalRun | undefined {
  return state.festival?.run;
}

/**
 * The attempt holds the player: an attempt is live and they stand on its
 * floors. While this holds the festival keeps its own clock, so offline
 * catch-up banks the time instead of simulating it (§5.3 item 19).
 */
export function festivalHolds(state: GameState): boolean {
  return !!festivalRun(state) && onFestivalFloor(state);
}

// ---------- The lockout ----------

/** World ticks left on the lockout after a lost attempt; 0 when the floors are open. */
export function lockoutLeft(state: GameState): number {
  return Math.max(0, (state.festival?.lockedUntil ?? 0) - state.totalTicks);
}

/**
 * Floors 15–16 are shut: a lost attempt, three days ago or less on the world
 * clock (§5.3 item 16). The lockout is run state, so the next prestige ends
 * it too. The ladder reads this in `floorUnlocked`.
 */
export function festivalLocked(state: GameState, floor: FloorDef): boolean {
  return floor.bandId === FESTIVAL_BAND && lockoutLeft(state) > 0;
}

/** The lockout a loss starts, as a world tick. */
export function lockoutEnd(state: GameState): number {
  return state.totalTicks + LOCKOUT_TICKS;
}

// ---------- Leaving ----------

/**
 * Where a knockout on floors 15–16 lands: outside the tower, at its hub
 * (§5.3 item 6, the exception to "every knockout retreats to the last
 * haven"). Null anywhere else. `retreatSpot` (systems/safety.ts) asks first.
 */
export function ejectionSpot(state: GameState): string | null {
  const floor = festivalFloorOf(state.spot);
  return floor ? (TOWERS[floor.towerId]?.hubSpot ?? null) : null;
}

/**
 * What the ladder means from inside an attempt (§5.3 item 25), for
 * `climbTo`: `royale` is the climb from floor 15 into floor 16 once the
 * dark room's door is open; `shut` is that climb while the room still
 * fights; `forfeit` is any other rung, the tower's hub or a band's hub, and
 * counts as a loss. Null when no attempt holds the player, or for a move
 * within the floor they stand on. `toFloorId` null is the tower's hub, and
 * `climbToHub` asks with null too: every hub is outside the festival.
 */
export type FestivalLadder = 'royale' | 'shut' | 'forfeit';

export function festivalLadder(state: GameState, toFloorId: string | null): FestivalLadder | null {
  const run = festivalRun(state);
  const here = festivalFloorOf(state.spot);
  if (!run || !here) return null;
  if (toFloorId === here.id) return null;
  if (here.id === DARK_FLOOR && toFloorId === ROYALE_FLOOR) return run.phase === 'dark' ? 'shut' : 'royale';
  return 'forfeit';
}

/**
 * The climb into the royale begins. Entering before the ten days are out is
 * a time jump: the clock goes to the end of the preparation, and the
 * survivors with it (§5.3 item 6, §5.4 Q7). `enteredAt` keeps the clock as
 * it read before the jump. Nothing else runs on this clock, so the jump
 * touches nothing outside the festival.
 */
export function beginRoyale(run: FestivalRun): void {
  if (run.phase === 'royale') return;
  run.enteredAt = run.clock;
  run.clock = Math.max(run.clock, PREP_TICKS);
  run.phase = 'royale';
}

// ---------- The festival's clock ----------

/** Share of the ten days of preparation done: 0 at the door, 1 at the royale. */
export function prepShare(clock: number): number {
  return Math.min(1, Math.max(0, clock / PREP_TICKS));
}

/** Festival ticks left before the royale opens on its own. */
export function prepLeft(run: FestivalRun): number {
  return run.phase === 'prep' ? Math.max(0, PREP_TICKS - run.clock) : 0;
}

/**
 * A survivor's level on the field: their preparation (the clock, capped at
 * the ten days), plus what outlasting the field adds as it empties. The
 * champion stands `champion` levels above.
 */
export function survivorLevel(clock: number, alive: number, champion = false): number {
  const s = SURVIVOR_LEVELS;
  const outlasted = 1 - Math.min(SURVIVORS, Math.max(0, alive)) / SURVIVORS;
  return (
    s.base +
    Math.round(s.growth * prepShare(clock)) +
    Math.round(s.shrink * outlasted) +
    (champion ? s.champion : 0)
  );
}
