import type { MonsterDef, SpotDef, WardWindowDef } from '../types';
import { bandPosKey } from './ladder';

/**
 * Band 3's ward machinery as content uses it (docs/plans/bands-2-3.md "The
 * four wards", M10 to M12). Shared by tests/content.test.ts and the forge's
 * validator, so the two layers cannot drift. Takes the window table as a
 * parameter (WARD_WINDOWS in both callers) and plain registries, so the forge
 * runs it on its staged copy.
 */

/** Plain shapes, so the registries and the forge's staged copies both fit. */
interface WardRefs {
  bands: Record<string, { id: string; order?: string }>;
  floors: Record<string, { id: string; bandId?: string; areaId: string; clear?: { type: string; key?: string }[] }>;
  spots: Record<string, Pick<SpotDef, 'id' | 'areaId' | 'fightLimit' | 'stampOnClear' | 'encounters'>>;
  monsters: Record<string, Pick<MonsterDef, 'keepsWounds'>>;
}

/** One problem, on the registry entry it is about (the forge lights that node). */
export interface WardIssue {
  kind: 'floor' | 'spot' | 'monster';
  id: string;
  message: string;
}

/** A window's own state: what no other window may share. */
const STATE_KEYS = ['atKey', 'goneKey', 'foughtKey'] as const;

function windowKeys(w: WardWindowDef): string[] {
  return [w.doneKey, w.atKey, w.goneKey, w.foughtKey, w.flags?.fought, w.flags?.unmet];
}

/** The floors of a band, from the plain floor table. */
function floorsOf(refs: WardRefs, bandId: string) {
  return Object.values(refs.floors).filter((f) => f.bandId === bandId);
}

/**
 * - `stampOnClear` needs a `fightLimit`: the stamp is written when the budget
 *   is spent, and a spot with none never spends it.
 * - `keepsWounds.share` is a share of the HP lost, above 0 and at most 1, with
 *   a key to keep it under.
 * - Every window names a real floor of an `any` band, a real spot on that
 *   floor's area, a real monster in that spot's encounters, a position the
 *   band can reach (0 to its floors less one) and a positive tick count. Its
 *   six keys are distinct, and no other window shares its own state (open
 *   tick, gone, fought). The kill path and the lapse must both clear the
 *   ward: the spot's `stampOnClear` writes `doneKey`, and the floor's clear
 *   reads it.
 */
export function wardContentIssues(windows: WardWindowDef[], refs: WardRefs): WardIssue[] {
  const issues: WardIssue[] = [];
  const on = (kind: WardIssue['kind'], id: string, message: string) => issues.push({ kind, id, message });

  for (const spot of Object.values(refs.spots)) {
    if (spot.stampOnClear === undefined) continue;
    if (!spot.stampOnClear) on('spot', spot.id, 'stampOnClear names no stat');
    if (!spot.fightLimit) on('spot', spot.id, 'stampOnClear needs a fightLimit: the stamp is written when the budget is spent');
  }
  for (const [id, m] of Object.entries(refs.monsters)) {
    const kept = m.keepsWounds;
    if (!kept) continue;
    if (!kept.key) on('monster', id, 'keepsWounds names no stat');
    if (!(kept.share > 0 && kept.share <= 1)) on('monster', id, 'keepsWounds.share is a share of the HP lost, above 0 and at most 1');
  }

  const ids = new Set<string>();
  const stateOwner = new Map<string, string>();
  for (const w of windows) {
    const at = (message: string) => on('floor', w.floorId, `ward window '${w.id}': ${message}`);
    if (ids.has(w.id)) at('another window has this id');
    ids.add(w.id);

    const floor = refs.floors[w.floorId];
    const band = floor?.bandId === undefined ? undefined : refs.bands[floor.bandId];
    if (!floor) at(`unknown floor '${w.floorId}'`);
    else if (band?.order !== 'any') at(`floor '${w.floorId}' is not in an any-order band, so it has no position`);
    const spot = refs.spots[w.spotId];
    if (!spot) at(`unknown spot '${w.spotId}'`);
    else if (floor && spot.areaId !== floor.areaId) at(`spot '${w.spotId}' is not on floor '${w.floorId}'`);
    if (!refs.monsters[w.monsterId]) at(`unknown monster '${w.monsterId}'`);
    else if (spot && !spot.encounters?.some((e) => e.monsterId === w.monsterId)) {
      at(`monster '${w.monsterId}' never spawns at '${w.spotId}'`);
    }
    const count = band ? floorsOf(refs, band.id).length : 0;
    if (!(Number.isInteger(w.position) && w.position >= 0 && w.position <= count - 1)) {
      at(`position ${w.position} is outside 0..${count - 1}, the positions its band can reach`);
    }
    if (!(w.ticks > 0)) at('ticks must be above 0');

    const keys = windowKeys(w);
    if (keys.some((k) => !k)) at('every key and both flags must name a stat');
    if (new Set(keys).size !== keys.length) at('its keys must be distinct');
    for (const field of STATE_KEYS) {
      const key = w[field];
      const owner = stateOwner.get(key);
      if (owner !== undefined && owner !== w.id) at(`${field} '${key}' is window '${owner}'s too`);
      stateOwner.set(key, w.id);
    }
    if (spot && spot.stampOnClear !== w.doneKey) {
      at(`spot '${w.spotId}' must stamp '${w.doneKey}' on clear (stampOnClear), or killing the threat clears nothing`);
    }
    if (floor && !floor.clear?.some((c) => c.type === 'stat' && c.key === w.doneKey)) {
      at(`floor '${w.floorId}' must clear on '${w.doneKey}', or the lapse leaves the ward unfinished`);
    }
  }
  return issues;
}

/**
 * Every run stat the ward machinery writes, for the content linter's "is this
 * counter ever written" check: each `any`-band floor's position, each spot's
 * `stampOnClear`, and each window's keys and flags.
 */
export function wardStatKeys(windows: WardWindowDef[], refs: Pick<WardRefs, 'bands' | 'floors' | 'spots'>): Set<string> {
  const keys = new Set<string>();
  for (const band of Object.values(refs.bands)) {
    if (band.order !== 'any') continue;
    for (const f of Object.values(refs.floors)) if (f.bandId === band.id) keys.add(bandPosKey(f.id));
  }
  for (const spot of Object.values(refs.spots)) if (spot.stampOnClear) keys.add(spot.stampOnClear);
  for (const w of windows) for (const k of windowKeys(w)) if (k) keys.add(k);
  return keys;
}
