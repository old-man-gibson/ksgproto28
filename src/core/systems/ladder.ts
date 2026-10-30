import type { BandDef, FloorDef, GameState, SpotDef } from '../types';
import { BANDS, FLOORS, FLOOR_BY_AREA, PRESTIGE_BOONS, floorsInBand } from '../registry';
import { conditionsMet } from './conditions';
import { boonRank } from './legacy';

/**
 * The ladder's reads: which rungs are cleared, open, gated or sealed, where
 * a rung sits for pricing a climb, and what a band adds to the monsters on
 * its floors. Pure reads of state and the registry, kept apart from
 * systems/towers.ts (which moves the player and so imports combat) so that
 * combat and levels can read them with no import cycle. towers.ts
 * re-exports all of it.
 *
 * Two band shapes (docs/plans/bands-2-3.md M4):
 *
 * - **sequence** (bands 1 and 2): a floor waits on every rung below it.
 * - **any** (band 3): the band's floors open together once every floor of
 *   the lower bands is cleared and the band's `gate` holds, and are cleared
 *   in any order. A band above it waits on all of it.
 */

/** The banded floors of one tower in ladder order — the rungs, nothing personal. */
export function ladderFloors(towerId: string): FloorDef[] {
  return Object.values(FLOORS)
    .filter((f) => f.towerId === towerId && f.bandId !== undefined)
    .sort((a, b) => a.index - b.index);
}

/**
 * The floor's own clear holds: its fights fought, its keeper killed. A
 * floor with no `clear` can never be finished, only visited; the lint keeps
 * that shape off the ladder, and this reads false rather than trivially true
 * so a missing clear can never silently open everything above it.
 */
export function clearMet(state: GameState, floor: FloorDef): boolean {
  return !!floor.clear?.length && conditionsMet(state, floor.clear);
}

/** An owned band pass covers this band (boon effect `bandPass`). */
export function bandPassed(state: GameState, bandId: string): boolean {
  return Object.values(PRESTIGE_BOONS).some(
    (b) => b.effect.kind === 'bandPass' && b.effect.bandId === bandId && boonRank(state, b.id) > 0,
  );
}

/**
 * Cleared for the ladder: the floor's own clear holds, or a pass covers its
 * band. The harvest and clear XP read `clearMet` instead, so a pass opens
 * the way up without paying for floors it skipped.
 */
export function floorCleared(state: GameState, floor: FloorDef): boolean {
  if (floor.bandId !== undefined && bandPassed(state, floor.bandId)) return true;
  return clearMet(state, floor);
}

function bandIndexOf(floor: FloorDef): number {
  return floor.bandId === undefined ? 0 : (BANDS[floor.bandId]?.index ?? 0);
}

/** Every floor of the bands below this one, on the same tower. */
function belowBand(band: BandDef): FloorDef[] {
  return ladderFloors(band.towerId).filter((f) => bandIndexOf(f) < band.index);
}

/**
 * The rungs a floor waits on: every lower rung in a `sequence` band, every
 * floor of the lower bands in an `any` band (its siblings are not in the way).
 */
export function floorsBelow(floor: FloorDef): FloorDef[] {
  const band = floor.bandId === undefined ? undefined : BANDS[floor.bandId];
  if (band?.order === 'any') return belowBand(band);
  return ladderFloors(floor.towerId).filter((f) => f.index < floor.index);
}

/**
 * Every rung below must be CLEARED, and the band's gate and the floor's own
 * gate met. Off-ladder floors are never "unlocked" — they are reached by
 * authored edges (the hold's door) and advance nothing. A passed band waives
 * its gates too: in play a cleared floor's gate was always met first (gates
 * read counters that only grow), and a pass must not leave a floor that
 * reads cleared but cannot be entered — floor 6's warchief, who still opens
 * prestige, is behind a 40-goblin gate.
 */
export function floorUnlocked(state: GameState, floor: FloorDef): boolean {
  if (floor.bandId === undefined) return false;
  if (!floorsBelow(floor).every((f) => floorCleared(state, f))) return false;
  if (bandPassed(state, floor.bandId)) return true;
  const band = BANDS[floor.bandId];
  if (band?.gate && !conditionsMet(state, band.gate)) return false;
  return !floor.gate || conditionsMet(state, floor.gate);
}

/**
 * How a rung reads on the ladder. `sealed` outranks `gated` on purpose: a
 * floor whose gate happens to be met while the rung below is unfinished is
 * still shut, and saying "locked by gold" about it would be a lie.
 */
export type RungStatus = 'cleared' | 'open' | 'gated' | 'sealed';

export function rungStatus(state: GameState, floor: FloorDef): RungStatus {
  if (floorCleared(state, floor)) return 'cleared';
  if (floorUnlocked(state, floor)) return 'open';
  return floorsBelow(floor).every((f) => floorCleared(state, f)) ? 'gated' : 'sealed';
}

/** The band whose hub is this spot, if any. */
export function bandHubAt(spotId: string): BandDef | undefined {
  return Object.values(BANDS).find((b) => b.hub === spotId);
}

/** A band's hub reads like a rung that is never cleared: open, gated or sealed. */
export function hubStatus(state: GameState, band: BandDef): Exclude<RungStatus, 'cleared'> {
  if (!belowBand(band).every((f) => floorCleared(state, f))) return 'sealed';
  return !band.gate || conditionsMet(state, band.gate) ? 'open' : 'gated';
}

/** The band can be entered: everything below it cleared and its gate met. */
export function bandOpen(state: GameState, band: BandDef): boolean {
  return hubStatus(state, band) === 'open';
}

/** The lowest floor index in a band: where an `any` band and its hub sit on the stack. */
export function bandBaseIndex(band: BandDef): number {
  const floors = floorsInBand(band.id);
  return floors.length ? floors[0].index : 0;
}

/**
 * Where a rung sits for pricing a climb. An `any` band's floors all sit at
 * the band's lowest index, as its hub does: none is further up than
 * another, so moving between them is one rung.
 */
export function rungIndex(floor: FloorDef): number {
  const band = floor.bandId === undefined ? undefined : BANDS[floor.bandId];
  return band?.order === 'any' ? bandBaseIndex(band) : floor.index;
}

/**
 * Levels added to a monster spawned at this spot: its band's `levelSteps`,
 * indexed by how many of the band's floors are cleared (bands-2-3.md M5).
 * Zero off the ladder and on bands with no steps.
 */
export function bandLevelStep(state: GameState, spot: Pick<SpotDef, 'areaId'>): number {
  const floor = FLOOR_BY_AREA.get(spot.areaId);
  const band = floor?.bandId === undefined ? undefined : BANDS[floor.bandId];
  const steps = band?.levelSteps;
  if (!band || !steps?.length) return 0;
  const cleared = floorsInBand(band.id).filter((f) => floorCleared(state, f)).length;
  return steps[Math.min(cleared, steps.length - 1)];
}

/** Every floor of the band cleared (a pass counts). */
export function bandCleared(state: GameState, band: BandDef): boolean {
  const floors = floorsInBand(band.id);
  return floors.length > 0 && floors.every((f) => floorCleared(state, f));
}

/** The run's stamp for a band whose every floor is cleared; content reads it. */
export function bandClearedKey(bandId: string): string {
  return `cleared:band:${bandId}`;
}
