/**
 * What the map says about a place: the features standing there (icons over
 * its node, rows in its card) and the road to it from where you stand. One
 * derivation for the map card, the destination preview and the location
 * panel, so they cannot disagree about what is where.
 */
import type { GameState, SpotDef } from '../../core/types';
import { DISCIPLINES } from '../../core/data/disciplines.data';
import { SPOTS, edgesFrom, getSpot } from '../../core/registry';
import { spotActivities } from '../../core/systems/actions';
import { spotCleared } from '../../core/systems/combat';
import { conditionsMet } from '../../core/systems/conditions';
import { findPath } from '../../core/systems/locations';
import { availableQuests, canTurnIn, npcsAt } from '../../core/systems/quests';
import { restActivities } from '../../core/systems/safety';
import { visibleLines } from '../../core/systems/shops';
import { subsystemUnlocked } from '../../core/systems/unlocks';
import { QUESTS } from '../../core/registry';
import { condsText } from './format';

/**
 * Benches you can actually see. Furniture for a system you have never heard
 * of is a spoiler rather than a discovery, so a bench stays out of the room
 * while its subsystem is locked — the same rule the bench itself enforces,
 * applied before it can be clicked.
 *
 * ⚠️ ALPHA: mutagens currently start OPEN (see freshMutagenState), so that
 * branch is inert today. It is kept wired because it is exactly what the
 * unlock quest will switch on.
 */
export function visibleBenches(state: GameState, spot: SpotDef): string[] {
  return (spot.benches ?? []).filter((id) => {
    if (id === 'mutagens') return state.mutagens.unlocked && subsystemUnlocked(state, 'genes');
    if (id === 'runecarving') return subsystemUnlocked(state, 'runecarving');
    return true;
  });
}

/** A bench's icon and name as the room shows it. The spelltable is not a discipline. */
export function benchLabel(benchId: string): { icon: string; name: string } {
  if (benchId === 'spelltable') return { icon: '🔮', name: 'Spellcrafting Table' };
  const bench = DISCIPLINES[benchId];
  return { icon: bench?.icon ?? '🛠️', name: bench?.benchName ?? bench?.name ?? benchId };
}

export type SpotFeatureKind = 'bench' | 'shop' | 'quest' | 'turnin' | 'rest';

export interface SpotFeature {
  key: string;
  kind: SpotFeatureKind;
  icon: string;
  label: string;
  /** Rest features: the activity that rests. */
  activity?: string;
  /** Bench features: the bench to open. */
  bench?: string;
}

/**
 * The features of a spot, in the order the icon badge cycles them: quests
 * ready to turn in first (the one thing a player walks back for), then new
 * quests, shops, benches, rest.
 */
export function spotFeatures(state: GameState, spot: SpotDef): SpotFeature[] {
  const turnins: SpotFeature[] = [];
  const quests: SpotFeature[] = [];
  const shops: SpotFeature[] = [];
  for (const npc of npcsAt(spot.id)) {
    const ready = npc.quests
      .map((id) => QUESTS[id])
      .filter((q) => q && state.quests[q.id]?.status === 'active' && canTurnIn(state, q));
    if (ready.length) {
      turnins.push({
        key: `turnin:${npc.id}`,
        kind: 'turnin',
        icon: '✅',
        label: `${npc.name}: ${ready.length === 1 ? ready[0].name : `${ready.length} quests`} ready to turn in`,
      });
    }
    const open = availableQuests(state, npc);
    if (open.length) {
      quests.push({
        key: `quest:${npc.id}`,
        kind: 'quest',
        icon: '📜',
        label: `${npc.name}: ${open.length === 1 ? open[0].name : `${open.length} quests`} available`,
      });
    }
    if (npc.shop && visibleLines(state, npc).length) {
      shops.push({ key: `shop:${npc.id}`, kind: 'shop', icon: '🪙', label: `${npc.shop.name} (${npc.name})` });
    }
  }
  const benches: SpotFeature[] = visibleBenches(state, spot).map((id) => {
    const { icon, name } = benchLabel(id);
    return { key: `bench:${id}`, kind: 'bench', bench: id, icon, label: name };
  });
  const haven = state.safeSpots.nearest === spot.id || state.safeSpots.unconditional === spot.id;
  const rests: SpotFeature[] = restActivities(spot)
    .filter((a) => !a.requires || conditionsMet(state, a.requires))
    .map((a) => ({
      key: `rest:${a.id}`,
      kind: 'rest',
      activity: a.id,
      icon: a.icon,
      label: haven ? `${a.name} (your haven)` : a.name,
    }));
  return [...turnins, ...quests, ...shops, ...benches, ...rests];
}

export interface RouteInfo {
  /** Hops excluding the start; empty when standing there. Null: no open route. */
  path: string[] | null;
  /** Walk time in ticks at the current travel speed. */
  ticks: number;
  /** The last road's label, when the destination is one road away. */
  label?: string;
  /** Some road on the route has no way back. */
  oneWay: boolean;
  /** Arriving starts a fight that cannot be fled. */
  noExit: boolean;
  /** The direct road is shut: its terms, as words. */
  shut?: string;
}

/** The road from where you stand to `toId`, as the old Travel list described it. */
export function routeInfo(state: GameState, toId: string, travelSpeed: number): RouteInfo {
  const from = state.spot;
  const dest = getSpot(toId);
  const direct = edgesFrom(from).find((e) => e.to === toId);
  const shut = direct?.requires && !conditionsMet(state, direct.requires) ? condsText(direct.requires) : undefined;
  const path = toId === from ? [] : findPath(state, from, toId, { unknownDest: true });
  let ticks = 0;
  let oneWay = false;
  let lastForced = false;
  let label: string | undefined;
  if (path) {
    let at = from;
    for (const hop of path) {
      const edge = edgesFrom(at).find((e) => e.to === hop);
      if (edge) {
        ticks += Math.max(1, Math.round(edge.ticks / travelSpeed));
        // A one-way edge has no mirror; the registry never builds its reverse.
        if (!edgesFrom(hop).some((r) => r.to === at)) oneWay = true;
        lastForced = !!edge.forced;
        if (path.length === 1) label = edge.label;
      }
      at = hop;
    }
  } else if (direct) {
    ticks = Math.max(1, Math.round(direct.ticks / travelSpeed));
    label = direct.label;
    oneWay = !edgesFrom(toId).some((r) => r.to === from);
    lastForced = !!direct.forced;
  }
  const noExit = toId !== from && !!(lastForced || dest.forced) && !spotCleared(state, dest);
  return { path, ticks, label, oneWay, noExit, shut };
}

/** An activity's icon and name at a spot, for callers that hold only the id. */
export function activityName(spotId: string, activityId: string): string {
  const spot = SPOTS[spotId];
  const act = spot && spotActivities(spot).find((a) => a.id === activityId);
  return act ? `${act.icon} ${act.name}` : activityId;
}
