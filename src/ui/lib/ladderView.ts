import type { BandDef, FloorDef, GameState, TowerDef, UnlockCondition } from '../../core/types';
import { AREAS, BANDS, FLOORS, FLOOR_BY_AREA, SPOTS, TOWERS, bandsOf, floorsInBand, getSpot } from '../../core/registry';
import {
  bandBaseIndex,
  bandCleared,
  bandHubAt,
  bandKnown,
  floorCleared,
  floorReached,
  hubStatus,
  endNotice,
  ladderEnded,
  ladderFloors,
  rungStatus,
  topRung,
} from '../../core/systems/ladder';
import {
  climbVerb,
  currentFloor,
  rideGate,
  rideStops,
  rideTicks,
  standingIndex,
  towerAt,
  type RideStop,
} from '../../core/systems/towers';
import { festivalLadder, festivalLocked, lockoutLeft } from '../../core/systems/festivalRules';
import { MS_PER_TICK } from '../../core/engine/loop';
import { msToTime, termText, ticksToTime } from './format';

/**
 * The ladder's layout (AscentPanel.svelte and the map's tower section,
 * TowerSection.svelte), kept out of the components so it can be tested. A band
 * is a group; inside it, one card per floor in climb order, with the band's
 * hub first where it has one.
 *
 * What a foreknown tower (the goalpost) shows: every band up to the highest
 * known one (ladder.ts `bandKnown`) in full, a reached floor by name and an
 * unreached one by its number only; the band after that by its name only;
 * nothing above it. A discovery (not foreknown) shows reached floors only
 * and no band above them.
 */
export type LadderCard = { kind: 'floor'; floor: FloorDef; named: boolean } | { kind: 'hub'; band: BandDef };

export interface LadderBand {
  band: BandDef;
  /** The next band, not reached yet: its name and nothing else. */
  titleOnly: boolean;
  cards: LadderCard[];
}

/** The bands shown, the highest first for an up tower so climbing reads upward. */
export function ladderBands(state: GameState, tower: TowerDef): LadderBand[] {
  const all = bandsOf(tower.id);
  const top = all.reduce((hi, band, i) => (bandKnown(state, band) ? i : hi), -1);
  const shown: LadderBand[] = all.slice(0, top + 1).map((band) => {
    const cards: LadderCard[] = floorsInBand(band.id)
      .filter((floor) => tower.foreknown || floorReached(state, floor))
      .map((floor) => ({ kind: 'floor', floor, named: floorReached(state, floor) }));
    const hub = !!band.hub && (tower.foreknown || hubStatus(state, band) !== 'sealed');
    return { band, titleOnly: false, cards: hub ? [{ kind: 'hub', band }, ...cards] : cards };
  });
  const next = tower.foreknown ? all[top + 1] : undefined;
  if (next) shown.push({ band: next, titleOnly: true, cards: [] });
  return tower.direction === 'down' ? shown : shown.reverse();
}

/** "Floors 7–10", or "Floor 17" for a band of one. */
export function floorRange(floors: FloorDef[]): string {
  if (!floors.length) return '';
  const lo = Math.min(...floors.map((f) => f.index));
  const hi = Math.max(...floors.map((f) => f.index));
  return lo === hi ? `Floor ${lo}` : `Floors ${lo}–${hi}`;
}

// ---------- Folding ----------

/**
 * The band the player stands in: the band of the floor they are on, else the
 * band whose hub they are at. Undefined anywhere else.
 */
export function standingBandId(state: GameState): string | undefined {
  return currentFloor(state)?.bandId ?? bandHubAt(state.spot)?.id;
}

/** The floors the ladder shows for a band, and how many of them are cleared. */
export function bandProgress(state: GameState, lb: LadderBand): { cleared: number; total: number } {
  const floors = lb.cards.flatMap((c) => (c.kind === 'floor' ? [c.floor] : []));
  return { cleared: floors.filter((f) => floorCleared(state, f)).length, total: floors.length };
}

/**
 * A band may fold only when every floor in it is cleared (a pass counts), the
 * player is not standing in it, and none of its cards (floor or hub) carries a
 * term that is not dim. A band with an uncleared floor never folds, so none of
 * its gate terms is hidden. A cleared floor can still carry a live term: floors
 * 15 and 16 read cleared under a festival lockout, and a hub can be gated
 * while its floors are cleared. The next band, shown by name only, has nothing
 * to fold.
 */
export function bandFoldable(state: GameState, lb: LadderBand, standingBand: string | undefined): boolean {
  if (lb.titleOnly || lb.band.id === standingBand || !bandCleared(state, lb.band)) return false;
  return !lb.cards.some((c) =>
    (c.kind === 'floor' ? rungTerms(state, c.floor) : hubTerms(state, c.band)).terms.some((t) => !t.dim),
  );
}

/**
 * Whether a band is drawn open. A band that may not fold is always open. A
 * foldable band is folded unless the player opened it (`choice` true).
 */
export function bandDrawnOpen(foldable: boolean, choice: boolean | undefined): boolean {
  return !foldable || choice === true;
}

// ---------- Terms ----------

/** Which branch of the selection produced a rung's terms. */
export type RungTermsKind = 'locked' | 'closed' | 'shut' | 'gated' | 'sealed' | 'open' | 'cleared';

/** One line under a rung's name. */
export interface RungTerm {
  /** Leading icon, empty for none. */
  icon: string;
  text: string;
  /** A hint, not a thing to do: drawn dimmed. */
  dim: boolean;
  /** The condition `text` was made from. Absent on fixed lines. */
  cond?: UnlockCondition;
}

export interface RungTerms {
  kind: RungTermsKind;
  terms: RungTerm[];
}

const sealedTerm = (): RungTerm => ({ icon: '', text: 'The way up is not cleared.', dim: true });

function condTerms(state: GameState, conds: UnlockCondition[] | undefined, icon: string): RungTerm[] {
  return (conds ?? []).map((cond) => ({ icon, text: termText(cond, state), dim: false, cond }));
}

/**
 * What a floor's card says about getting in, for every state. The first
 * branch that holds wins:
 *
 * - `locked`: floors 15–16 after a lost festival attempt. Holds whatever the
 *   floor's status is, so a floor that reads `gated` with no gate of its own
 *   still names its reason.
 * - `closed`: floor 16 is entered from floor 15's hall during an attempt,
 *   never from the ladder. Only on a floor that reads open or cleared.
 * - `shut`: the same climb while the dark room still fights.
 * - `gated`: the floor's gate terms, then the band hub's name if the floor
 *   has no gate and waits on the hub.
 * - `sealed`: a rung below is not cleared.
 * - `open`: the floor's clear terms.
 * - `cleared`: no terms.
 */
export function rungTerms(state: GameState, floor: FloorDef): RungTerms {
  const status = rungStatus(state, floor);
  const verdict = festivalLadder(state, floor.id);
  const reached = status === 'open' || status === 'cleared';
  if (festivalLocked(state, floor)) {
    const left = msToTime(lockoutLeft(state) * MS_PER_TICK);
    const text = `Shut after a lost festival attempt: ${left} of play, or the next prestige.`;
    return { kind: 'locked', terms: [{ icon: '🔒', text, dim: false }] };
  }
  if (reached && verdict === 'closed') {
    // The royale has no door of its own: an attempt reaches it from floor 15's hall.
    return {
      kind: 'closed',
      terms: [{ icon: '🏟️', text: 'Entered from floor 15’s hall, during a festival attempt.', dim: true }],
    };
  }
  if (reached && verdict === 'shut') {
    return { kind: 'shut', terms: [{ icon: '🚪', text: 'Opens from the hall once the dark room is empty.', dim: true }] };
  }
  if (status === 'gated') {
    const terms = condTerms(state, floor.gate, '🔒');
    const band = floor.bandId ? BANDS[floor.bandId] : undefined;
    if (band?.hub && !floor.gate?.length) {
      terms.push({ icon: '', text: `Opens with ${getSpot(band.hub).name}.`, dim: true });
    }
    return { kind: 'gated', terms };
  }
  if (status === 'sealed') return { kind: 'sealed', terms: [sealedTerm()] };
  if (status === 'open') return { kind: 'open', terms: condTerms(state, floor.clear, '🎯') };
  return { kind: 'cleared', terms: [] };
}

/**
 * A band hub's terms. Only a gated hub has any of its own (the band's gate);
 * a sealed hub says the way up is not cleared; an open hub is `open` with no
 * terms, so a caller listing what is still needed skips it.
 */
export function hubTerms(state: GameState, band: BandDef): RungTerms {
  const status = hubStatus(state, band);
  if (status === 'gated') return { kind: 'gated', terms: condTerms(state, band.gate, '🔒') };
  if (status === 'sealed') return { kind: 'sealed', terms: [sealedTerm()] };
  return { kind: 'open', terms: [] };
}

// ---------- Stops: one source for the tower section and the Ascent panel ----------

/**
 * How a stop reads on the ladder, as a mark. `locked` is floors 15 and 16 after
 * a lost festival attempt; `door` is a floor whose ladder ride the festival
 * refuses (floor 16 outside an attempt, or while the dark room fights).
 */
export type StopMark = 'cleared' | 'open' | 'gated' | 'sealed' | 'locked' | 'door';

export const MARK_ICON: Record<StopMark, string> = {
  cleared: '✅',
  open: '🟢',
  gated: '🔒',
  sealed: '⛔',
  locked: '🔒',
  door: '🚪',
};

export const MARK_WORD: Record<StopMark, string> = {
  cleared: 'Cleared',
  open: 'Open',
  gated: 'Locked',
  sealed: 'Sealed',
  locked: 'Shut',
  door: 'Door',
};

/**
 * The button a stop offers, worked out from the core's own gate (`rideGate`):
 * `ride` is a plain climb, `royale` the climb into floor 16, `forfeit` any
 * climb out of a festival attempt. The ride's price is `rideTicks`, the one
 * `climbTo` charges before travel speed.
 */
export interface RideAction {
  /** Arming key: a floor id, `band:<id>` or `hub`. */
  key: string;
  kind: 'ride' | 'royale' | 'forfeit';
  /** The word on the button: Climb, Descend, Go. */
  verb: string;
  /** The word after "Forfeit ·". */
  forfeitVerb: string;
  /** Ticks for the ride before travel speed. */
  baseTicks: number;
  /** What the button calls: `climbTo(floor)`, `climbTo(null)` or `climbToHub(band)`. */
  target: { floor: string | null } | { band: string };
}

/** One stop of the ladder, as both the section and the panel draw it. */
export interface StopView {
  key: string;
  kind: 'floor' | 'bandHub' | 'foot';
  /** A floor's number; null for a hub. */
  number: number | null;
  /** The name, or null for a floor not reached (the number only; secret-content law). */
  name: string | null;
  /** A hub's spot icon, else empty. */
  icon: string;
  /** The ladder's own reading (`rungStatus`, `hubStatus`); the mark can differ (a lockout, a door). */
  status: 'cleared' | 'open' | 'gated' | 'sealed';
  mark: StopMark;
  /** The status in words: "Cleared", "Hub · Open". */
  word: string;
  /** The player stands here. */
  current: boolean;
  terms: RungTerm[];
  action: RideAction | null;
  /** Why a ride that would be open has no button, when the ladder does not answer here. */
  note: string | null;
  /** The area whose plan this stop shows on the map; null when it has none (the tower's hub). */
  areaId: string | null;
}

const stopCache = new Map<string, RideStop[]>();

/** The tower's ride stops (registry data, so built once). */
function stopsOf(tower: TowerDef): RideStop[] {
  let stops = stopCache.get(tower.id);
  if (!stops) {
    stops = rideStops(tower);
    stopCache.set(tower.id, stops);
  }
  return stops;
}

/** The move along the stack as the button words it. */
function moveWord(tower: TowerDef, fromIndex: number, toIndex: number): string {
  const verb = climbVerb(tower, fromIndex, toIndex);
  return verb === 'Crossing' ? 'Go' : verb === 'Climbing' ? 'Climb' : 'Descend';
}

function rideAction(
  state: GameState,
  stop: RideStop | undefined,
  key: string,
  target: RideAction['target'],
  words: { verb?: string; forfeitVerb?: string } = {},
): RideAction | null {
  if (!stop) return null;
  const gate = rideGate(state, stop);
  const kind = gate === 'open' ? 'ride' : gate === 'royale' ? 'royale' : gate === 'forfeit' ? 'forfeit' : null;
  const tower = towerAt(state);
  if (!kind || !tower) return null;
  const from = standingIndex(state);
  const move = moveWord(tower, from, stop.index);
  return {
    key,
    kind,
    verb: words.verb ?? move,
    forfeitVerb: words.forfeitVerb ?? move,
    baseTicks: rideTicks(from, stop.index),
    target,
  };
}

/** The line under a stop that would be open but for the player standing off the ladder. */
function offLadderNote(state: GameState, tower: TowerDef, mark: StopMark, current: boolean): string | null {
  if (towerAt(state) || current || (mark !== 'open' && mark !== 'cleared')) return null;
  return `Rides start at ${getSpot(tower.hubSpot).name} or on a floor of the tower.`;
}

function floorMark(
  status: ReturnType<typeof rungStatus>,
  locked: boolean,
  verdict: ReturnType<typeof festivalLadder>,
): StopMark {
  if (locked) return 'locked';
  if (status === 'cleared') return 'cleared';
  if (status === 'open') return verdict === 'closed' || verdict === 'shut' ? 'door' : 'open';
  return status === 'gated' ? 'gated' : 'sealed';
}

/**
 * A floor as the ladder shows it: its mark, terms and ride. The section and the
 * Ascent panel both read this, so the rule (`rideGate`), the price and the
 * festival's forfeit cannot differ between them. The ride is judged where the
 * player stands: off the ladder, or on the floor itself, it is null.
 */
export function rungView(state: GameState, floor: FloorDef): StopView {
  const tower = TOWERS[floor.towerId];
  const status = rungStatus(state, floor);
  const mark = floorMark(status, festivalLocked(state, floor), festivalLadder(state, floor.id));
  const current = currentFloor(state)?.id === floor.id;
  const stop = stopsOf(tower).find((s) => s.floor?.id === floor.id);
  return {
    key: floor.id,
    kind: 'floor',
    number: floor.index,
    name: floorReached(state, floor) ? floor.name : null,
    icon: '',
    status,
    mark,
    word: MARK_WORD[mark],
    current,
    terms: rungTerms(state, floor).terms,
    action: current ? null : rideAction(state, stop, floor.id, { floor: floor.id }),
    note: offLadderNote(state, tower, mark, current),
    areaId: floor.areaId,
  };
}

/** A band's hub (band 3's castle) as the ladder shows it. Its name is always shown, as the panel's card does. */
export function bandHubView(state: GameState, band: BandDef): StopView {
  const tower = TOWERS[band.towerId];
  const spot = getSpot(band.hub!);
  const status = hubStatus(state, band);
  const mark: StopMark = status === 'open' ? 'open' : status === 'gated' ? 'gated' : 'sealed';
  const current = state.spot === band.hub;
  const stop = stopsOf(tower).find((s) => s.band?.id === band.id);
  return {
    key: `band:${band.id}`,
    kind: 'bandHub',
    number: null,
    name: spot.name,
    icon: spot.icon,
    status,
    mark,
    word: `Hub · ${MARK_WORD[mark]}`,
    current,
    terms: hubTerms(state, band).terms,
    action: current ? null : rideAction(state, stop, `band:${band.id}`, { band: band.id }),
    note: offLadderNote(state, tower, mark, current),
    areaId: spot.areaId,
  };
}

/** The tower's own hub (The Foot): rung 0, the way back to the city, always open. */
export function towerHubView(state: GameState, tower: TowerDef): StopView {
  const spot = getSpot(tower.hubSpot);
  const current = state.spot === tower.hubSpot;
  const stop = stopsOf(tower).find((s) => !s.floor && !s.band);
  return {
    key: 'hub',
    kind: 'foot',
    number: null,
    name: spot.name,
    icon: spot.icon,
    status: 'open',
    mark: 'open',
    word: 'Hub',
    current,
    terms: [],
    action: current
      ? null
      : rideAction(
          state,
          stop,
          'hub',
          { floor: null },
          { verb: tower.direction === 'down' ? 'Climb out' : 'Descend', forfeitVerb: 'Leave the tower' },
        ),
    note: offLadderNote(state, tower, 'open', current),
    areaId: null,
  };
}

/** The stop a key names: a floor id, `band:<id>` or `hub`. Null for a key the tower does not have. */
export function stopViewOf(state: GameState, tower: TowerDef, key: string | null): StopView | null {
  if (!key) return null;
  if (key === 'hub') return towerHubView(state, tower);
  if (key.startsWith('band:')) {
    const band = BANDS[key.slice('band:'.length)];
    return band?.hub && band.towerId === tower.id ? bandHubView(state, band) : null;
  }
  const floor = FLOORS[key];
  return floor && floor.bandId !== undefined && floor.towerId === tower.id ? rungView(state, floor) : null;
}

/** Ticks a ride takes at the player's travel speed: the figure `climbTo` charges. */
export function rideDuration(action: RideAction, speed: number): number {
  return Math.max(1, Math.round(action.baseTicks / speed));
}

/** The button's text. `armed`: the first click of a forfeit has been made. */
export function rideLabel(action: RideAction, armed: boolean, speed: number): string {
  if (action.kind === 'forfeit') return armed ? 'Confirm: forfeit the festival' : `Forfeit · ${action.forfeitVerb}`;
  const time = ticksToTime(rideDuration(action, speed));
  return action.kind === 'royale' ? `Enter the royale · ${time}` : `${action.verb} · ${time}`;
}

// ---------- The tower section ----------

/**
 * The detail slot under the plan (StopDetail.svelte): its height and the gap
 * above it, px. A region with no section draws its plan this much taller, so
 * the ride that changes the map from a tower floor to the city, or back, moves
 * nothing below it.
 */
export const DETAIL_H = 100;
export const DETAIL_GAP = 6;

/** One band of the section: a header and its stops, highest first for an up tower. */
export interface SectionGroup {
  band: BandDef;
  /** The next band, not reached: its name and nothing else. */
  titleOnly: boolean;
  foldable: boolean;
  /** Drawn open. A band that may not fold is always open. */
  open: boolean;
  cleared: number;
  total: number;
  rows: StopView[];
}

export interface TowerSection {
  groups: SectionGroup[];
  /** The tower's hub, at the foot of the column. */
  foot: StopView;
  /** Past the top of the ladder: set once the top rung is cleared (`ladderEnd`), else null. */
  end: string | null;
}

/**
 * What the ladder says above its top rung once that rung is cleared: the floor
 * past it is not built. Derived from the clear counters (`ladderEnded`), so it
 * is stored nowhere and drops out when a floor is added above.
 */
export function ladderEnd(state: GameState, tower: TowerDef): string | null {
  const top = topRung(tower.id);
  return top && ladderEnded(state, tower.id) ? endNotice(top) : null;
}

/**
 * The section's rows: `ladderBands` (what the Ascent panel shows, so a floor
 * not reached is a number, the next band a name and nothing above it), the
 * C3 fold rules (`bandFoldable`, and `isOpen` for the player's choice), and one
 * `StopView` per card. No level range: a range derived from a floor's spots
 * would print rooms the player has not entered (navigation-alternatives §6 row 7).
 */
export function towerSection(
  state: GameState,
  tower: TowerDef,
  isOpen: (bandId: string, foldable: boolean) => boolean,
): TowerSection {
  const standing = standingBandId(state);
  const groups = ladderBands(state, tower).map((lb): SectionGroup => {
    const foldable = bandFoldable(state, lb, standing);
    const progress = bandProgress(state, lb);
    const views = lb.cards.map((c) => (c.kind === 'floor' ? rungView(state, c.floor) : bandHubView(state, c.band)));
    return {
      band: lb.band,
      titleOnly: lb.titleOnly,
      foldable,
      open: !lb.titleOnly && isOpen(lb.band.id, foldable),
      cleared: progress.cleared,
      total: progress.total,
      // Cards run lowest first; an up tower reads from its top.
      rows: tower.direction === 'down' ? views : views.reverse(),
    };
  });
  return { groups, foot: towerHubView(state, tower), end: ladderEnd(state, tower) };
}

// ---------- Which region a tower draws in, and which area a stop shows ----------

/** The region a tower's floors stand in (all of a tower's floors share one). */
export function regionOfTower(tower: TowerDef): string | null {
  const first = ladderFloors(tower.id)[0];
  return first ? AREAS[first.areaId].regionId : null;
}

const towerByRegion = new Map<string, TowerDef>();
for (const tower of Object.values(TOWERS)) {
  const region = regionOfTower(tower);
  if (region) towerByRegion.set(region, tower);
}

/** The tower a region draws as a stack, or null for a region that is a plain map. */
export function towerOfRegion(regionId: string): TowerDef | null {
  return towerByRegion.get(regionId) ?? null;
}

/**
 * The areas a stack region draws one at a time, bottom to top: the banded
 * floors' areas and the areas of the bands' hubs (a hub sorts under its band's
 * first floor). Empty for a region that is not a stack.
 */
export function stackAreas(regionId: string): string[] {
  const tower = towerOfRegion(regionId);
  if (!tower) return [];
  const areas: { area: string; at: number }[] = [];
  for (const floor of ladderFloors(tower.id)) {
    if (AREAS[floor.areaId].regionId === regionId) areas.push({ area: floor.areaId, at: floor.index });
  }
  for (const band of bandsOf(tower.id)) {
    if (!band.hub) continue;
    const area = getSpot(band.hub).areaId;
    if (AREAS[area].regionId === regionId) areas.push({ area, at: bandBaseIndex(band) - 0.5 });
  }
  return areas.sort((a, b) => a.at - b.at).map((a) => a.area);
}

/** Whether an area is a banded floor's (a rung), not a band hub's. */
function isFloorArea(areaId: string): boolean {
  return FLOOR_BY_AREA.get(areaId)?.bandId !== undefined;
}

/**
 * The area a stack region shows when the player has picked none, so the detail
 * under the plan always has a stop (and, from the city, the ride is the tab and
 * one click):
 * - the floor underfoot, when the player stands on one (`focusAreaId` is the
 *   area the map is about);
 * - otherwise (the city, the Foot, a band hub) the highest floor with a place
 *   found, which is where the old floor tabs opened;
 * - with no place found on any floor (a new run at the Foot) the lowest open
 *   floor, the next climb;
 * - else null.
 */
export function defaultStackArea(state: GameState, regionId: string, focusAreaId: string): string | null {
  const floors = stackAreas(regionId).filter(isFloorArea);
  if (floors.includes(focusAreaId)) return focusAreaId;
  const found = floors.filter((a) => state.discovered.some((id) => SPOTS[id]?.areaId === a));
  if (found.length) return found[found.length - 1];
  return floors.find((a) => rungStatus(state, FLOOR_BY_AREA.get(a)!) === 'open') ?? null;
}

/** The stop whose plan an area is: a floor id, `band:<id>` for a hub's area, else null. */
export function stopKeyOfArea(areaId: string): string | null {
  const floor = Object.values(FLOORS).find((f) => f.areaId === areaId && f.bandId !== undefined);
  if (floor) return floor.id;
  const band = Object.values(BANDS).find((b) => b.hub && getSpot(b.hub).areaId === areaId);
  return band ? `band:${band.id}` : null;
}
