import type { BandDef, FloorDef, GameState, TowerDef, UnlockCondition } from '../../core/types';
import { BANDS, bandsOf, floorsInBand, getSpot } from '../../core/registry';
import {
  bandCleared,
  bandHubAt,
  bandKnown,
  floorCleared,
  floorReached,
  hubStatus,
  rungStatus,
} from '../../core/systems/ladder';
import { currentFloor } from '../../core/systems/towers';
import { festivalLadder, festivalLocked, lockoutLeft } from '../../core/systems/festivalRules';
import { MS_PER_TICK } from '../../core/engine/loop';
import { msToTime, termText } from './format';

/**
 * The ladder panel's layout (AscentPanel.svelte), kept out of the component
 * so it can be tested. A band is a group; inside it, one card per floor in
 * climb order, with the band's hub first where it has one.
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
