import type { BandDef, Connection, FloorDef, SpotDef } from './types';
export { KEY_ITEMS } from './data/keyitems.data';
import { SKILLS } from './data/skills.data';
import { STYLES } from './data/styles.data';
import { ITEMS, AFFIXES } from './data/items.data';
import {
  MONSTERS,
  TIERS,
  MODIFIER_TIERS,
  RARITIES,
  MODIFIER_WEIGHTS,
  RARITY_WEIGHTS,
} from './data/monsters.data';
import { BESTIARY_FACTS, BESTIARY_TUNING, MONSTER_TAGS } from './data/bestiary.data';
import { MATERIALS } from './data/materials.data';
import { RECIPES } from './data/recipes.data';
import { NPCS } from './data/npcs.data';
import { QUESTS } from './data/quests.data';
import { REGIONS, AREAS, SPOTS, STARTING_SPOT } from './data/locations.data';
import { ACHIEVEMENTS } from './data/achievements.data';
import { SUPERATTRS } from './data/superattrs.data';
import { TITLES } from './data/titles.data';
import { RUNES } from './data/runes.data';
import { STATUSES, STATUS_LIST } from './data/statuses.data';
import { DISCIPLINES, DISCIPLINE_LIST } from './data/disciplines.data';
import { POSITIONS, TECHNIQUES, TECHNIQUE_LIST } from './data/martial.data';
import { QUALITY_TIERS, QUALITY_ORDER } from './data/quality.data';
import { NAMED_RUNES, RUNE_ADORNMENTS, RUNE_PATTERNS } from './data/runes.data';
import { BREW_FORMS, BREW_FORMULAS, REAGENTS, REAGENT_LIST } from './data/alchemy.data';
import { GENERA, LAYOUTS, MAIN_GENES, MUTATIONS } from './data/mutagens.data';
import { DEITIES } from './data/deities.data';
import { MIRACLES } from './data/spellcraft.data';
import { MUSIC_ARCHETYPES, MUSIC_METERS, MUSIC_SCALES } from './data/music.data';
import { BANDS, FLOORS, TOWERS } from './data/towers.data';
import { PRESTIGE_BOONS, PRESTIGE_SOURCES, PRESTIGE_UNLOCK } from './data/prestige.data';
import { TUTORIAL_STEPS, TUTORIAL_STEP_LIST } from './data/tutorial.data';

export {
  SKILLS,
  STYLES,
  ITEMS,
  AFFIXES,
  MATERIALS,
  RECIPES,
  NPCS,
  QUESTS,
  MONSTERS,
  MONSTER_TAGS,
  BESTIARY_FACTS,
  BESTIARY_TUNING,
  TIERS,
  MODIFIER_TIERS,
  RARITIES,
  MODIFIER_WEIGHTS,
  RARITY_WEIGHTS,
  REGIONS,
  AREAS,
  SPOTS,
  STARTING_SPOT,
  ACHIEVEMENTS,
  SUPERATTRS,
  TITLES,
  RUNES,
  STATUSES,
  STATUS_LIST,
  DISCIPLINES,
  DISCIPLINE_LIST,
  POSITIONS,
  TECHNIQUES,
  TECHNIQUE_LIST,
  QUALITY_TIERS,
  QUALITY_ORDER,
  NAMED_RUNES,
  RUNE_ADORNMENTS,
  RUNE_PATTERNS,
  REAGENTS,
  REAGENT_LIST,
  BREW_FORMS,
  BREW_FORMULAS,
  DEITIES,
  MIRACLES,
  GENERA,
  MAIN_GENES,
  MUTATIONS,
  LAYOUTS,
  MUSIC_ARCHETYPES,
  MUSIC_METERS,
  MUSIC_SCALES,
  TOWERS,
  BANDS,
  FLOORS,
  PRESTIGE_UNLOCK,
  PRESTIGE_SOURCES,
  PRESTIGE_BOONS,
  TUTORIAL_STEPS,
  TUTORIAL_STEP_LIST,
};

export interface Edge extends Connection {
  from: string;
}

/**
 * Directed adjacency built from spot connection declarations.
 * Bidirectional edges are declared once and mirrored here; oneWay edges are not.
 *
 * `into` lets a caller extend an existing map — the test fixture that mounts
 * the shelved countryside (tests/fixtures/shelved-world.ts) is the one user.
 */
export function buildAdjacency(
  connections: Iterable<{ from: string; connection: Connection }>,
  into: Map<string, Edge[]> = new Map(),
): Map<string, Edge[]> {
  const adj = into;
  const add = (from: string, c: Connection) => {
    const list = adj.get(from) ?? [];
    // Don't duplicate if the reverse direction was also declared explicitly.
    if (!list.some((e) => e.to === c.to)) list.push({ ...c, from });
    adj.set(from, list);
  };
  for (const { from, connection: c } of connections) {
    add(from, c);
    // The mirror wears `returnLabel` when the way back is its own act, and
    // falls back to `label` for a road that reads the same both ways. It
    // never carries `forced` — that flag means "arriving at THIS edge's far
    // end starts an unfleeable fight", and the mirror's far end is home.
    // `requires` stays off it for the same reason: a lock on the way out
    // must never bar the way back in.
    if (!c.oneWay) add(c.to, { to: from, ticks: c.ticks, label: c.returnLabel ?? c.label });
  }
  return adj;
}

/** Every declared connection of a spot table, tagged with its source spot. */
export function declaredConnections(
  spots: Record<string, SpotDef>,
): { from: string; connection: Connection }[] {
  return Object.values(spots).flatMap((spot) =>
    spot.connections.map((connection) => ({ from: spot.id, connection })),
  );
}

export const ADJACENCY: Map<string, Edge[]> = buildAdjacency(declaredConnections(SPOTS));

export function getSpot(id: string): SpotDef {
  const spot = SPOTS[id];
  if (!spot) throw new Error(`Unknown spot: ${id}`);
  return spot;
}

/** Edges leaving a spot, including hidden ones (callers filter by explored state). */
export function edgesFrom(spotId: string): Edge[] {
  return ADJACENCY.get(spotId) ?? [];
}

/**
 * Which floor an area is, if it is one. A floor IS an area, so this is the
 * whole of the mapping — "what floor am I standing on" is
 * `FLOOR_BY_AREA.get(getSpot(state.spot).areaId)`, and areas outside any tower
 * simply aren't in here.
 */
export const FLOOR_BY_AREA: Map<string, FloorDef> = new Map(
  Object.values(FLOORS).map((f) => [f.areaId, f]),
);

/** Floors of one band, in stack order. The band is the disjunction — these are the alternatives. */
export function floorsInBand(bandId: string): FloorDef[] {
  return Object.values(FLOORS)
    .filter((f) => f.bandId === bandId)
    .sort((a, b) => a.index - b.index);
}

/** Bands of one stack, in ladder order. */
export function bandsOf(towerId: string): BandDef[] {
  return Object.values(BANDS)
    .filter((b) => b.towerId === towerId)
    .sort((a, b) => a.index - b.index);
}
