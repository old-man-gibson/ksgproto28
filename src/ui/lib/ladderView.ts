import type { BandDef, FloorDef, GameState, TowerDef } from '../../core/types';
import { bandsOf, floorsInBand } from '../../core/registry';
import { bandKnown, floorReached, hubStatus } from '../../core/systems/ladder';

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

/** Narrow ladders only: bands gathered under one collapsible heading. */
export interface LadderGroup {
  id: number;
  label: string;
  bands: LadderBand[];
}

/** A narrow ladder gathers this many bands, by band index, under one heading. */
export const BANDS_PER_GROUP = 3;

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

/**
 * The bands gathered BANDS_PER_GROUP at a time by band index (1–3, 4–6, …),
 * in the order `bands` gives, each labelled by the floors of its bands shown
 * in full (a group holding only the next band's title reads that title).
 */
export function ladderGroups(bands: LadderBand[]): LadderGroup[] {
  const groups: LadderGroup[] = [];
  for (const lb of bands) {
    const id = Math.floor((lb.band.index - 1) / BANDS_PER_GROUP);
    let group = groups.find((g) => g.id === id);
    if (!group) groups.push((group = { id, label: '', bands: [] }));
    group.bands.push(lb);
  }
  for (const group of groups) {
    const full = group.bands.filter((b) => !b.titleOnly);
    group.label = full.length
      ? floorRange(full.flatMap((b) => floorsInBand(b.band.id)))
      : group.bands.map((b) => b.band.name).join(', ');
  }
  return groups;
}

/**
 * The group a narrow ladder opens: the one holding `bandId` (where the
 * player stands), else the one holding the highest band shown in full.
 */
export function homeGroupId(groups: LadderGroup[], bandId: string | undefined): number | undefined {
  const holding = groups.find((g) => g.bands.some((b) => b.band.id === bandId));
  if (holding) return holding.id;
  let best: { id: number; index: number } | undefined;
  for (const g of groups) {
    for (const b of g.bands) {
      if (!b.titleOnly && (!best || b.band.index > best.index)) best = { id: g.id, index: b.band.index };
    }
  }
  return best?.id;
}
