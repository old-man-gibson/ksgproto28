/**
 * A live mirror of `tests/content.test.ts`, run against the staged working copy.
 *
 * The test suite stays the authority — the ✅ Verify button runs it for real.
 * This exists so a broken reference shows up the instant you make it, on the
 * node that made it, instead of after a save and a 10-second test run.
 */

import type { store as Store } from './store.svelte';
import { searchContentIssues } from '../../src/core/systems/searchValidation';
import { smithingContentIssues } from '../../src/core/systems/assemblyValidation';
import { exploreIssues, floorStructureIssues } from '../../src/core/systems/floorRules';
import { offLadderDoor } from '../../src/core/data/towers.data';
import type { ActivityDrop, Connection, CraftDisciplineDef, ItemClassDef, MaterialDef, MonsterDef, MusicArchetypeDef, MusicMeterDef, MusicScaleDef, NpcDef, PartKindDef, QuestDef, RecipeDef, SkillDef, SpotDef, SpotFind, StatusDef, TierDef, TitleDef } from '../../src/core/types';
import { ELEMENT_TAGS, PLACE_TAGS } from '../../src/core/systems/exposure';
import { TAG_RESISTANCES, penetrationProblems } from '../../src/core/systems/monsterStats';
import { resistanceProblems } from '../../src/core/systems/conditionHarm';
import { MUSIC_AXES } from '../../src/core/data/music.data';
import { ARCANE_WORDS } from '../../src/core/data/spellcraft.data';
import { askingPrice, lineValue } from '../../src/core/systems/shops';
import { foodProblems, heatWindowProblems } from '../../src/core/systems/disciplines';

/**
 * Benches that are furniture rather than disciplines. The spellcrafting table
 * is one table serving three schools, so `LocationPanel.svelte` renders it by
 * hand instead of from DISCIPLINES — a real id that resolves nowhere.
 */
const SPECIAL_BENCHES = new Set(['spelltable']);

export type Severity = 'error' | 'warn';

export interface Issue {
  severity: Severity;
  /** What it is about — used to light up the offending node on the map. */
  subject: { kind: string; id: string };
  message: string;
  /** Optional deep link into the entry, e.g. ['finds', '#id=mossy_chute']. */
  path?: (string | number)[];
}

/**
 * A gene the forge scaffolded for a species that had none.
 *
 * `genus` and `tier` ARE the gene — tier fixes both flatBase and ceiling, and
 * genus decides what one tier step is worth — so leaving them unset is the
 * honest way to say "drafted, not decided". Stubs stage as freely as anything
 * else; `store.apply` is where they are stopped, because that is the moment a
 * draft would become content.
 */
export function isGeneStub(def: { genus?: string; tier?: number } | undefined): boolean {
  if (!def) return false;
  return !def.genus || typeof def.tier !== 'number' || def.tier < 0;
}

type S = typeof Store;

/** The shape every registry id follows: lowercase snake_case, letter first. */
export const ID_SHAPE = /^[a-z][a-z0-9_]*$/;

/**
 * Why `next` cannot become an id in `kind`, or null if it can. This is the
 * gate the rename fields (browser header, spot inspector) run on every
 * keystroke; the shape half is mirrored by 'registry ids are lowercase
 * snake_case' in tests/content.test.ts.
 */
export function idProblem(store: S, kind: string, next: string): string | null {
  if (!next) return 'an id cannot be empty';
  if (!ID_SHAPE.test(next)) {
    return `'${next}' is not a usable id — lowercase snake_case: a letter first, then letters, digits and _`;
  }
  if (store.get(kind, next) !== undefined) return `${kind} '${next}' already exists`;
  return null;
}

export function validate(store: S): Issue[] {
  const issues: Issue[] = [];
  const spots = store.all<SpotDef>('spot');
  const areas = store.all<{ id: string; regionId: string }>('area');
  const regions = store.all<{ id: string }>('region');
  const npcs = store.all<NpcDef>('npc');
  const materials = store.all('material');
  const items = store.all('item');
  const runes = store.all('rune');
  const monsters = store.all('monster');
  const recipes = store.all('recipe');
  const quests = store.all<{ id: string; giver?: string }>('quest');
  const skills = store.all<{ id: string; tags?: string[] }>('skill');
  const disciplines = store.all('discipline');
  const statuses = store.all<StatusDef>('status');
  const towers = store.all<{ id: string; hubSpot: string }>('tower');
  const bands = store.all<{
    id: string;
    towerId: string;
    index: number;
    clearsToAdvance: number;
    order?: string;
    hub?: string;
    levelSteps?: number[];
  }>('band');
  const floors = store.all<{
    id: string;
    towerId: string;
    bandId?: string;
    index: number;
    areaId: string;
    gate?: { type: string }[];
    landing?: string;
    clear?: { type: string; key?: string; value?: number }[];
    personal?: boolean;
  }>('floor');

  const err = (kind: string, id: string, message: string, path?: (string | number)[]) =>
    issues.push({ severity: 'error', subject: { kind, id }, message, path });
  const warn = (kind: string, id: string, message: string, path?: (string | number)[]) =>
    issues.push({ severity: 'warn', subject: { kind, id }, message, path });

  // Text-table keys that named nothing (src/core/text/prose.ts). A typo in a
  // text file, or an entry renamed without its prose, shows up here rather
  // than as a silently missing description.
  const orphans = (store.meta.proseOrphans ?? []) as { table: string; key: string; reason: string }[];
  for (const o of orphans) {
    warn('text', o.table, `text key '${o.key}' in ${o.table}_TEXT: ${o.reason}`);
  }

  const claimedTags = new Set<string>();
  for (const s of Object.values(skills)) for (const t of s.tags ?? []) claimedTags.add(t);

  // ---------- Areas & regions ----------
  for (const area of Object.values(areas)) {
    if (!regions[area.regionId]) err('area', area.id, `region '${area.regionId}' does not exist`);
  }
  const terrains = (store.meta.terrains ?? []) as string[];
  for (const region of Object.values(regions) as { id: string; terrain?: string }[]) {
    if (region.terrain && terrains.length > 0 && !terrains.includes(region.terrain)) {
      err('region', region.id, `terrain '${region.terrain}' is not in TERRAIN_PROFILES`, ['terrain']);
    }
  }
  // Place tags at every level of the chain — a spot's effective set is the
  // union region ∪ area ∪ spot, so all three speak the same vocabulary.
  const placeTagged: [string, { id: string; tags?: string[] }[]][] = [
    ['region', Object.values(regions) as { id: string; tags?: string[] }[]],
    ['area', Object.values(areas) as { id: string; tags?: string[] }[]],
    ['spot', Object.values(spots)],
  ];
  for (const [kind, defs] of placeTagged) {
    for (const def of defs) {
      for (const tag of def.tags ?? []) {
        if (!ELEMENT_TAGS.has(tag) && !PLACE_TAGS.has(tag)) {
          err(kind, def.id, `tag '${tag}' is neither an element nor a place tag (exposure.ts)`, ['tags']);
        }
      }
    }
  }
  // The resistances are one family: same curve as poison, whatever the element.
  const reference = store.get<{ progression?: unknown; effects?: { levelCurve?: string }[] }>(
    'skill',
    'poison_resistance',
  );
  if (reference) {
    for (const s of Object.values(skills) as {
      id: string;
      category?: string;
      progression?: unknown;
      effects?: { levelCurve?: string }[];
    }[]) {
      if (s.category !== 'resistance') continue;
      if (JSON.stringify(s.progression) !== JSON.stringify(reference.progression)) {
        err('skill', s.id, `progression differs from poison_resistance — the family moves together`, ['progression']);
      }
      if (s.effects?.[0]?.levelCurve !== reference.effects?.[0]?.levelCurve) {
        err('skill', s.id, `effect levelCurve differs from poison_resistance`, ['effects']);
      }
    }
  }

  // ---------- Towers, bands & floors ----------
  // Live mirror of the 'towers, bands & floors' block in tests/content.test.ts,
  // which is the authority. REVISED 2026-09-06 for the sequential ascent
  // (plans/alpha-band-one.md): every rung needs a landing and a clear, no rung
  // may name a discipline, indexes are contiguous, clear counters must be
  // payable, and banded floor areas are closed (the ladder is the only door).
  for (const tower of Object.values(towers)) {
    if (!spots[tower.hubSpot]) err('tower', tower.id, `hubSpot '${tower.hubSpot}' does not exist`);
  }
  for (const band of Object.values(bands)) {
    if (!towers[band.towerId]) err('band', band.id, `tower '${band.towerId}' does not exist`);
    if (!(band.index > 0)) err('band', band.id, 'index is 1-based, so it must be at least 1');
  }
  // A gap in the ladder is a band that can never be reached — Invariant A's
  // terminal state wearing a number.
  for (const tower of Object.values(towers)) {
    const idx = Object.values(bands)
      .filter((b) => b.towerId === tower.id)
      .map((b) => b.index)
      .sort((a, b) => a - b);
    if (idx.length && idx.some((n, i) => n !== i + 1)) {
      err('tower', tower.id, `band indexes must run 1..n with no gaps (got ${idx.join(', ')})`);
    }
  }
  const floorByArea = new Map<string, string>();
  for (const floor of Object.values(floors)) {
    if (!towers[floor.towerId]) err('floor', floor.id, `tower '${floor.towerId}' does not exist`);
    if (!areas[floor.areaId]) err('floor', floor.id, `area '${floor.areaId}' does not exist`);
    if (floor.bandId !== undefined) {
      const band = bands[floor.bandId];
      if (!band) err('floor', floor.id, `band '${floor.bandId}' does not exist`);
      else if (band.towerId !== floor.towerId) {
        err('floor', floor.id, `band '${floor.bandId}' belongs to another tower`);
      }
    }
    // A personal floor can never be a rung everyone has to climb: that would
    // put the critical path through content only one player can enter.
    if (floor.personal && floor.bandId !== undefined) {
      err('floor', floor.id, 'a personal floor may not sit in a band');
    }
    const prior = floorByArea.get(floor.areaId);
    if (prior) err('floor', floor.id, `area '${floor.areaId}' is already claimed by '${prior}'`);
    else floorByArea.set(floor.areaId, floor.id);
  }
  for (const band of Object.values(bands)) {
    const inBand = Object.values(floors).filter((f) => f.bandId === band.id);
    // Empty bands are exempt: they are routinely declared before their floors
    // are authored, and failing that blocks scaffolding rather than catching
    // a mistake.
    if (!inBand.length) continue;
    if (band.clearsToAdvance < 1) err('band', band.id, 'clearsToAdvance must be at least 1');
    else if (band.clearsToAdvance > inBand.length) {
      err(
        'band',
        band.id,
        `wants ${band.clearsToAdvance} clears but holds ${inBand.length} floor(s)`,
      );
    }
  }
  // Band 3's shape (bands-2-3.md M4, M5): a hub is a spot no floor claims;
  // level steps belong to any-order bands, one per floor, from 0, never falling.
  for (const band of Object.values(bands)) {
    if (band.hub) {
      const hub = spots[band.hub];
      if (!hub) err('band', band.id, `hub '${band.hub}' does not exist`, ['hub']);
      else if (floorByArea.has(hub.areaId)) err('band', band.id, `hub '${band.hub}' sits on a floor`, ['hub']);
    }
    const steps = band.levelSteps;
    if (steps?.length) {
      const count = Object.values(floors).filter((f) => f.bandId === band.id).length;
      if (band.order !== 'any') err('band', band.id, 'level steps belong to any-order bands', ['levelSteps']);
      if (steps.length !== count) err('band', band.id, `${steps.length} level steps for ${count} floor(s)`, ['levelSteps']);
      if (steps[0] !== 0 || steps.some((v, i) => i > 0 && v < steps[i - 1])) {
        err('band', band.id, 'level steps start at 0 and never fall', ['levelSteps']);
      }
    }
  }
  // The sequential ascent's per-rung rules. Every rung is mandatory, so a
  // skill condition anywhere on one makes that discipline mandatory; a rung
  // without a landing cannot be climbed to; one without a clear seals
  // everything above it for good.
  const bandedAreas = new Set<string>();
  for (const floor of Object.values(floors)) {
    if (floor.bandId === undefined) continue;
    bandedAreas.add(floor.areaId);
    for (const cond of [...(floor.gate ?? []), ...(floor.clear ?? [])]) {
      if (cond.type === 'skill') {
        err('floor', floor.id, 'a skill condition on a mandatory rung makes that discipline mandatory');
      }
    }
    if (!floor.landing) err('floor', floor.id, 'a rung needs a landing', ['landing']);
    else if (!spots[floor.landing]) {
      err('floor', floor.id, `landing '${floor.landing}' does not exist`, ['landing']);
    } else if (spots[floor.landing].areaId !== floor.areaId) {
      err('floor', floor.id, `landing '${floor.landing}' is not on the floor it lands on`, ['landing']);
    }
    if (!floor.clear?.length) err('floor', floor.id, 'a rung needs a clear', ['clear']);
    for (const cond of floor.clear ?? []) {
      if (cond.type !== 'stat' || !cond.key) continue;
      const slain = cond.key.match(/^slain:([^:]+):(.+)$/);
      if (slain) {
        const spot = spots[slain[1]];
        if (!spot) err('floor', floor.id, `clear names unknown spot '${slain[1]}'`, ['clear']);
        else if (!spot.encounters?.some((e) => e.monsterId === slain[2] && e.once)) {
          err('floor', floor.id, `clear wants slain:${slain[1]}:${slain[2]} but that spot has no such 'once' spawn`, ['clear']);
        }
      }
      const fights = cond.key.match(/^fights:(.+)$/);
      if (fights) {
        const spot = spots[fights[1]];
        if (!spot) err('floor', floor.id, `clear names unknown spot '${fights[1]}'`, ['clear']);
        else if ((spot.fightLimit ?? 0) < (cond.value ?? 0)) {
          err('floor', floor.id, `clear wants ${cond.value} fights at ${fights[1]} but its fightLimit stops short`, ['clear']);
        }
      }
      const boss = cond.key.match(/^boss:(.+)$/);
      if (boss) {
        const spot = spots[boss[1]];
        if (!spot) err('floor', floor.id, `clear names unknown spot '${boss[1]}'`, ['clear']);
        else if (!spot.encounters?.some((e) => e.boss)) {
          err('floor', floor.id, `clear wants boss:${boss[1]} but no encounter there is boss-flagged`, ['clear']);
        }
      }
    }
  }
  // Banded floor indexes: sequential ascent turns a numbering gap into a rung
  // nobody can clear, so nobody passes it.
  for (const tower of Object.values(towers)) {
    const idx = Object.values(floors)
      .filter((f) => f.towerId === tower.id && f.bandId !== undefined)
      .map((f) => f.index)
      .sort((a, b) => a - b);
    if (idx.length && idx.some((n, i) => n !== i + 1)) {
      err('tower', tower.id, `banded floor indexes must run 1..n with no gaps (got ${idx.join(', ')})`);
    }
  }
  // Banded floor areas are closed: the registry mirrors edges, so one authored
  // road across the boundary would open both directions and bypass the seal.
  for (const spot of Object.values(spots)) {
    for (const c of spot.connections ?? []) {
      for (const condition of c.revealWhen ?? []) {
        if (condition.type === 'stat' && condition.key.startsWith('fights:') && !(spots[condition.key.slice(7)]?.fightLimit)) {
          err('spot', spot.id, `reveal condition '${condition.key}' needs a spot with a fight limit`);
        }
      }
      const toArea = spots[c.to]?.areaId;
      if (!toArea) continue; // unknown targets are caught by the spot lints
      if (offLadderDoor(spot.id, c.to) && !c.oneWay) {
        err('spot', spot.id, `the door to '${c.to}' crosses the ladder and must be oneWay, or its mirror is a free road onto the floor`, ['connections']);
      }
      if ((bandedAreas.has(spot.areaId) || bandedAreas.has(toArea)) && spot.areaId !== toArea && !offLadderDoor(spot.id, c.to)) {
        err('spot', spot.id, `edge to '${c.to}' crosses a banded floor boundary — the ladder is the only door`, ['connections']);
      }
    }
  }
  // Floor structure (docs/FLOOR_STANDARD.md §2.2): spine, no skip, wing depth,
  // wing loops, the clear spot's table, and explores that pay. Imported, not
  // mirrored: these are the same pure functions tests/content.test.ts runs, so
  // the two layers cannot drift. A floor whose clear names no spot has no spine
  // to measure from, so its spine rules are skipped with a warning.
  {
    const adjacency = buildAdjacency(spots);
    for (const floor of Object.values(floors)) {
      if (floor.bandId === undefined) continue;
      const report = floorStructureIssues(floor, spots, adjacency);
      for (const issue of report.issues) err('floor', floor.id, `${issue.rule}: ${issue.message}`);
      if (report.skipped === 'no-clear-spot') {
        warn('floor', floor.id, 'the clear names no spot, so the spine rules (no skip, wing depth, wing loops, clear table) did not run', ['clear']);
      }
    }
    for (const issue of exploreIssues(Object.values(spots))) err('spot', issue.spot, issue.message, ['activities']);
  }

  // ---------- Spots ----------
  for (const spot of Object.values(spots)) {
    if (!areas[spot.areaId]) err('spot', spot.id, `area '${spot.areaId}' does not exist`, ['areaId']);
    if (!spot.map) err('spot', spot.id, 'no map coordinates', ['map']);
    else {
      if (spot.map.x < 0 || spot.map.x > 100) err('spot', spot.id, `map.x ${spot.map.x} is outside 0–100`, ['map']);
      if (spot.map.y < 0 || spot.map.y > 75) err('spot', spot.id, `map.y ${spot.map.y} is outside 0–75`, ['map']);
    }
    if (!spot.icon) warn('spot', spot.id, 'no icon');
    if (!spot.desc) warn('spot', spot.id, 'no description');
    if (!spot.activities?.length) warn('spot', spot.id, 'nothing to do here');

    for (const c of spot.connections ?? []) {
      if (!spots[c.to]) err('spot', spot.id, `connects to unknown spot '${c.to}'`, ['connections', `#to=${c.to}`]);
      if (c.returnLabel && c.oneWay) {
        err('spot', spot.id, `connection to '${c.to}': returnLabel on a one-way edge — there is no mirror to wear it`, ['connections', `#to=${c.to}`]);
      }
      if (c.returnLabel && !c.label) {
        err('spot', spot.id, `connection to '${c.to}': returnLabel without an outbound label`, ['connections', `#to=${c.to}`]);
      }
      // typeof first: '120' > 0 coerces to true, so a string travel time would
      // sail through the range check and only surface in the typecheck.
      if (typeof c.ticks !== 'number') {
        err('spot', spot.id, `connection to '${c.to}': ticks is ${JSON.stringify(c.ticks)} — a ${typeof c.ticks}, not a number`, ['connections', `#to=${c.to}`]);
      } else if (!(c.ticks > 0)) {
        err('spot', spot.id, `connection to '${c.to}' has no travel time`, ['connections', `#to=${c.to}`]);
      }
      // A forced edge promises a fight the far end must be able to supply.
      if (c.forced && spots[c.to] && !spots[c.to].encounters?.length) {
        err('spot', spot.id, `forced edge into '${c.to}', but nothing lives there — the fight has no one to start it`, ['connections', `#to=${c.to}`]);
      }
      // An approach is an opening for the FIRST fight at the far end: it needs
      // real statuses to lay, on somebody who can actually show up.
      if (c.approach) {
        const at = ['connections', `#to=${c.to}`] as (string | number)[];
        const apps = [...(c.approach.enemies ?? []), ...(c.approach.self ?? [])];
        if (apps.length === 0) {
          warn('spot', spot.id, `approach into '${c.to}' lays no statuses — it does nothing`, at);
        }
        for (const app of apps) {
          if (!statuses[app.id]) err('spot', spot.id, `approach into '${c.to}' applies unknown status '${app.id}'`, at);
        }
        if (c.approach.enemies?.length && spots[c.to] && !spots[c.to].encounters?.length) {
          warn('spot', spot.id, `approach into '${c.to}' surprises enemies, but nothing lives there`, at);
        }
      }
    }

    if (spot.forced && !spot.encounters?.length) {
      err('spot', spot.id, 'forced, but nothing lives here — the fight has no one to start it', ['forced']);
    }
    if (spot.fightLimit !== undefined && (typeof spot.fightLimit !== 'number' || !(spot.fightLimit > 0))) {
      err('spot', spot.id, `fightLimit is ${JSON.stringify(spot.fightLimit)} — it must be a positive number`, ['fightLimit']);
    }
    if (spot.fightLimit && !spot.encounters?.length) {
      err('spot', spot.id, 'a fight budget with no fights — fightLimit needs encounters', ['fightLimit']);
    }
    if (spot.caged && !spot.encounters?.length) {
      err('spot', spot.id, 'caged with no encounters — empty cages teach nothing', ['caged']);
    }
    if (spot.caged && spot.fightLimit !== undefined) {
      err('spot', spot.id, 'caged spots must not carry a fightLimit — the cages restock', ['caged']);
    }
    // Training spots (systems/training.ts).
    if (spot.healBetweenBouts && !(spot.healBetweenBouts.maxAttrTotal > 0)) {
      err('spot', spot.id, 'healBetweenBouts needs a positive maxAttrTotal', ['healBetweenBouts']);
    }
    if (spot.dare) {
      const d = spot.dare;
      if (!monsters[d.monsterId]) err('spot', spot.id, `dares an unknown monster '${d.monsterId}'`, ['dare']);
      if (!(Number.isInteger(d.every) && d.every > 0)) err('spot', spot.id, 'dare.every must be a positive whole number of wins', ['dare']);
      if (!(d.level >= 1)) err('spot', spot.id, 'dare.level must be at least 1', ['dare']);
      // Wins are what count down to the dare, and the keeper only dares the
      // players it is still looking after.
      if (!spot.encounters?.length) err('spot', spot.id, 'a dare with no fights to win toward it', ['dare']);
      if (!spot.healBetweenBouts) err('spot', spot.id, 'a dare needs healBetweenBouts — it is offered only while the keeper tends you', ['dare']);
    }
    for (const e of spot.encounters ?? []) {
      if (!e.window) continue;
      if (!(e.window.min > 0) || !(e.window.max > e.window.min)) {
        err('spot', spot.id, `${e.monsterId}: ambush window needs 0 < min < max`, ['encounters']);
      }
    }
    const bossEntries = (spot.encounters ?? []).filter((e) => e.boss);
    if (bossEntries.length && !bossEntries.some((e) => !e.window)) {
      err('spot', spot.id, 'every boss hides behind a power window — keep one windowless keeper', ['encounters']);
    }
    // Retreats land on havens without re-triggering, so this cannot loop —
    // but a camp that ambushes its guests still reads as a mistake.
    if (spot.forced && (spot.activities ?? []).some((a) => a.kind === 'rest')) {
      warn('spot', spot.id, 'forced AND a rest spot — an ambush that offers its victims a bed is probably one flag too many', ['forced']);
    }

    for (const act of spot.activities ?? []) {
      if (act.kind === 'gather' && !materials[act.material]) {
        err('spot', spot.id, `gathers unknown material '${act.material}'`, ['activities', `#id=${act.id}`]);
      }
      if (act.kind === 'train' && !act.attr && !act.attrXp) {
        err('spot', spot.id, `activity '${act.id}' trains nothing (needs attr or attrXp)`, ['activities', `#id=${act.id}`]);
      }
    }
    for (const rid of spot.recipes ?? []) {
      if (!recipes[rid]) err('spot', spot.id, `unknown recipe '${rid}'`, ['recipes']);
    }
    for (const bid of spot.benches ?? []) {
      if (!disciplines[bid] && !SPECIAL_BENCHES.has(bid)) {
        err('spot', spot.id, `unknown bench '${bid}'`, ['benches']);
      }
    }
    // Rare finds on ordinary work (ActivityDef.drops, systems/activitydrops.ts).
    for (const act of spot.activities ?? []) {
      const drops = 'drops' in act ? act.drops : undefined;
      if (!drops?.length) continue;
      if (!['train', 'gather', 'job'].includes(act.kind)) {
        err('spot', spot.id, `activity '${act.id}' has drops, but only train/gather/job cycles roll them`, ['activities', `#id=${act.id}`]);
      }
      for (const d of drops) {
        const at = ['activities', `#id=${act.id}`];
        if (!materials[d.material]) err('spot', spot.id, `activity '${act.id}' drops unknown material '${d.material}'`, at);
        if (!(d.chance > 0 && d.chance <= 1)) err('spot', spot.id, `activity '${act.id}' drop chance must be in (0, 1]`, at);
        if (d.quality && !(materials[d.material] as { graded?: boolean } | undefined)?.graded) err('spot', spot.id, `activity '${act.id}' pins a grade on an ungraded drop`, at);
        if (d.rarer !== undefined && !(d.rarer > 1)) err('spot', spot.id, `activity '${act.id}' drop rarer must be > 1`, at);
        if (d.qty !== undefined && !(d.qty >= 1)) err('spot', spot.id, `activity '${act.id}' drop qty must be >= 1`, at);
      }
    }
    for (const e of spot.encounters ?? []) {
      if (!monsters[e.monsterId]) err('spot', spot.id, `spawns unknown monster '${e.monsterId}'`, ['encounters']);
      if (e.level?.[0] > e.level?.[1]) err('spot', spot.id, `encounter '${e.monsterId}' has an inverted level range`, ['encounters']);
    }

    validateFinds(spot, { materials, items, runes, spots, claimedTags }, err, warn);
    for (const message of searchContentIssues(spot, { materials, items, runes, keyItems: store.all('keyItem') })) err('spot', spot.id, message);

    // A hidden edge nobody can ever reveal.
    const canComb = (spot.activities ?? []).some((a) => a.kind === 'explore');
    for (const c of spot.connections ?? []) {
      if (!c.hidden) continue;
      const opener = (spot.finds ?? []).some((f) => f.path === c.to);
      if (!canComb && !opener) {
        err('spot', spot.id, `hidden path to '${c.to}' can never be revealed — add an Explore activity or a path find`, ['connections', `#to=${c.to}`]);
      }
    }
    if ((spot.finds ?? []).length > 0 && !spot.exploreTicks) {
      err('spot', spot.id, 'has finds but no exploreTicks to measure them against', ['exploreTicks']);
    }
    if ((spot.finds ?? []).length > 0 && !canComb) {
      err('spot', spot.id, 'has finds but no Explore activity to find them with', ['activities']);
    }
  }

  // ---------- Reachability ----------
  const adjacency = buildAdjacency(spots);
  const start = (store.meta.startingSpot as string) ?? 'ascent_foot';
  if (spots[start]) {
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      for (const e of adjacency.get(queue.pop()!) ?? []) {
        if (!seen.has(e.to)) {
          seen.add(e.to);
          queue.push(e.to);
        }
      }
    }
    for (const id of Object.keys(spots)) {
      if (!seen.has(id)) err('spot', id, `unreachable from ${start}`);
    }
  }

  // A spot you can walk into but never walk out of, ignoring hidden edges.
  for (const id of Object.keys(spots)) {
    const out = (adjacency.get(id) ?? []).filter((e) => !e.hidden);
    if (out.length === 0 && (adjacency.get(id) ?? []).length > 0) {
      warn('spot', id, 'one-way trap: every exit is hidden until explored');
    } else if (out.length === 0) {
      err('spot', id, 'dead end: no way out at all');
    }
  }

  // Having an exit is not the same as having a way home: a ring of one-way
  // edges gives every spot an exit and still keeps the player forever.
  // COMPLETABILITY (docs/COMPLETABILITY.md, Invariant A) — mirrors
  // 'every spot can get home' in tests/content.test.ts, which is the authority.
  const waypoints = Object.values(spots)
    .filter((s) => s.waypoint)
    .map((s) => s.id);
  if (waypoints.length > 0) {
    const inbound = new Map<string, string[]>();
    for (const [from, edges] of adjacency) {
      for (const e of edges) {
        const list = inbound.get(e.to);
        if (list) list.push(from);
        else inbound.set(e.to, [from]);
      }
    }
    const canGetHome = new Set(waypoints);
    const queue = [...waypoints];
    while (queue.length) {
      for (const from of inbound.get(queue.pop()!) ?? []) {
        if (!canGetHome.has(from)) {
          canGetHome.add(from);
          queue.push(from);
        }
      }
    }
    for (const id of Object.keys(spots)) {
      if (!canGetHome.has(id)) {
        err('spot', id, 'no route back to any waypoint — whoever walks in stays there');
      }
    }
  }

  // ---------- NPCs ----------
  for (const npc of Object.values(npcs)) {
    if (!spots[npc.spotId]) err('npc', npc.id, `stands at unknown spot '${npc.spotId}'`, ['spotId']);
    if (!npc.dialogue?.length) warn('npc', npc.id, 'has nothing to say');
    for (const qid of npc.quests ?? []) {
      const quest = quests[qid];
      if (!quest) err('npc', npc.id, `offers unknown quest '${qid}'`, ['quests']);
      else if (quest.giver && quest.giver !== npc.id) {
        err('npc', npc.id, `offers '${qid}', but that quest's giver is '${quest.giver}'`, ['quests']);
      }
    }
    // Shops: every line names a real ware, grades only graded wares, and
    // asks more than the ware is worth (mirrors tests/content.test.ts).
    (npc.shop?.lines ?? []).forEach((line, i) => {
      const path = ['shop', 'lines', i];
      const known = line.kind === 'item' ? items[line.id] : materials[line.id];
      if (!known) err('npc', npc.id, `sells unknown ${line.kind} '${line.id}'`, path);
      if (line.kind === 'material' && line.quality && known && !(known as { graded?: boolean }).graded) {
        err('npc', npc.id, `sells '${line.id}' at a grade, but it is not graded`, [...path, 'quality']);
      }
      if (line.price !== undefined && line.price <= 0) err('npc', npc.id, `'${line.id}' price must be positive`, [...path, 'price']);
      if (known && askingPrice(line, true) <= lineValue(line)) {
        warn('npc', npc.id, `'${line.id}' is priced under its worth`, [...path, 'price']);
      }
    });
    // Lessons: each names a real technique or school, once (mirrors
    // tests/content.test.ts). A school lesson's skill must wait on the stamp
    // the lesson writes, or the lesson teaches what fighting already gives.
    const taught = new Set<string>();
    (npc.teaches ?? []).forEach((lesson, i) => {
      const id = 'technique' in lesson ? lesson.technique : lesson.school;
      if ('technique' in lesson && !store.all('technique')[lesson.technique]) {
        err('npc', npc.id, `teaches unknown technique '${lesson.technique}'`, ['teaches', i, 'technique']);
      }
      if ('school' in lesson) {
        const skill = store.all<SkillDef>('skill')[lesson.school];
        if (!skill) err('npc', npc.id, `teaches unknown school '${lesson.school}'`, ['teaches', i, 'school']);
        else if (!(skill.unlock ?? []).some((c) => c.type === 'stat' && c.key === `taught:${lesson.school}`)) {
          err('npc', npc.id, `'${lesson.school}' does not wait on taught:${lesson.school} in its unlock`, ['teaches', i, 'school']);
        }
      }
      if (taught.has(id)) err('npc', npc.id, `teaches '${id}' twice`, ['teaches', i]);
      taught.add(id);
    });
  }
  for (const quest of Object.values(quests)) {
    if (!quest.giver) continue;
    const npc = npcs[quest.giver];
    if (!npc) err('quest', quest.id, `giver '${quest.giver}' does not exist`, ['giver']);
    else if (!(npc.quests ?? []).includes(quest.id)) {
      err('quest', quest.id, `giver '${quest.giver}' does not list this quest`, ['giver']);
    }
  }

  // An objective whose every source can be used up is a quest the player can
  // shut behind themselves — `once` encounters and `fightLimit` both spend a
  // spawn for good, and only a find writing the counter back down restocks it.
  // COMPLETABILITY (docs/COMPLETABILITY.md, Invariant A) — mirrors
  // 'no quest objective rests on a source that can run out' in
  // tests/content.test.ts, which is the authority.
  {
    const questDefs = store.all<QuestDef>('quest');
    const monsterDefs = store.all<MonsterDef>('monster');
    const resets = new Set<string>();
    for (const spot of Object.values(spots)) {
      for (const find of spot.finds ?? []) {
        if (find.stat?.set !== undefined) resets.add(find.stat.key);
      }
    }
    const endlesslyKillable = (monsterId: string) =>
      Object.values(spots).some((spot) => {
        if (!spot.encounters?.some((e) => e.monsterId === monsterId)) return false;
        if (spot.encounters.find((e) => e.monsterId === monsterId)?.once) {
          return resets.has(`slain:${spot.id}:${monsterId}`);
        }
        if (spot.fightLimit !== undefined) return resets.has(`fights:${spot.id}`);
        return true;
      });

    for (const quest of Object.values(questDefs)) {
      for (const [i, o] of (quest.objectives ?? []).entries()) {
        if (o.type === 'kill' && o.monsterId && !endlesslyKillable(o.monsterId)) {
          err(
            'quest',
            quest.id,
            `every source of '${o.monsterId}' can be used up, and no find restocks it`,
            ['objectives', i],
          );
        }
        if (o.type === 'talk' && !npcs[o.npcId]) {
          err('quest', quest.id, `talk objective names unknown NPC '${o.npcId}'`, ['objectives', i]);
        }
        if (o.type === 'craft' && o.discipline && !disciplines[o.discipline]) {
          err('quest', quest.id, `craft objective names unknown discipline '${o.discipline}'`, ['objectives', i]);
        }
        if (o.type === 'stat' && !(o.value > 0)) {
          err('quest', quest.id, `stat objective '${o.key}' needs a positive bar`, ['objectives', i]);
        }
        if (o.type === 'collect') {
          const gathered = Object.values(spots).some((spot) =>
            spot.activities.some((a) => a.kind === 'gather' && a.material === o.materialId),
          );
          const dropped = Object.values(monsterDefs).some(
            (m) =>
              m.loot?.entries?.some((d) => d.kind === 'material' && d.id === o.materialId) &&
              endlesslyKillable(m.id),
          );
          if (!gathered && !dropped) {
            err(
              'quest',
              quest.id,
              `'${o.materialId}' has no repeatable source — a find pays once and never again`,
              ['objectives', i],
            );
          }
        }
      }
    }
  }

  // ---------- Modifier targets ----------
  //
  // A scoped stat (`craftSpeed:leatherwork`) is only as good as the stat in
  // front of the colon: misspell it and the modifier is not an error, it is
  // simply a bonus that can never match anything.
  const statNames = (store.meta.statNames ?? {}) as Record<string, string>;
  const attrIds = new Set(
    ((store.meta.attributes ?? []) as { id: string }[]).map((a) => a.id),
  );
  if (Object.keys(statNames).length > 0) {
    const targetOk = (target: string): boolean => {
      const [stat, ...rest] = target.split(':');
      if (rest.length > 1) return false;
      return (stat in statNames || attrIds.has(stat)) && (rest.length === 0 || rest[0].length > 0);
    };
    const MOD_FIELDS = ['mods', 'effects', 'passive', 'equipped', 'bonus'];
    for (const cat of store.catalog) {
      for (const [id, def] of Object.entries(store.all<Record<string, unknown>>(cat.kind))) {
        const walk = (v: unknown, depth: number): void => {
          if (!v || typeof v !== 'object' || depth > 4) return;
          if (Array.isArray(v)) {
            for (const e of v) walk(e, depth + 1);
            return;
          }
          for (const [key, child] of Object.entries(v)) {
            if (MOD_FIELDS.includes(key) && Array.isArray(child)) {
              for (const m of child as { stat?: unknown }[]) {
                if (typeof m?.stat === 'string' && !targetOk(m.stat)) {
                  err(cat.kind, id, `modifier targets unknown stat '${m.stat}'`, [key]);
                }
              }
            }
            walk(child, depth + 1);
          }
        };
        walk(def, 0);
      }
    }
  }

  // ---------- Drop tables ----------
  //
  // Mirrors tests/content.test.ts. Drought protection keys a drop's counter on
  // kind+id (engine/mercy.ts), so one drop on two lines escalates twice per
  // kill and quietly outruns its authored share. Widen `qty` instead.
  for (const [id, def] of Object.entries(store.all<MonsterDef>('monster'))) {
    const seen = new Set<string>();
    for (const [i, e] of (def?.loot?.entries ?? []).entries()) {
      if (e.kind === 'nothing') continue;
      const key = `${e.kind}:${e.id ?? ''}`;
      if (seen.has(key)) {
        err('monster', id, `drop table lists '${key}' twice — merge the lines and widen qty`, [
          'loot',
          'entries',
          i,
        ]);
      }
      seen.add(key);
    }
  }

  // ---------- Monster tags ----------
  //
  // Mirrors the linter in tests/content.test.ts. Worth duplicating because an
  // untagged monster fails in three unrelated places at once — the bestiary
  // shelf, the material-tag count and the taxon count — and none of those
  // messages says "you left tags empty".
  const tagDefs = (store.meta.monsterTags ?? {}) as Record<string, { category?: string; name?: string }>;
  if (Object.keys(tagDefs).length > 0) {
    for (const [id, def] of Object.entries(store.all<{ tags?: string[] }>('monster'))) {
      const tags = def?.tags ?? [];
      const byCategory = (c: string) => tags.filter((t) => tagDefs[t]?.category === c);
      for (const t of tags) {
        if (!tagDefs[t]) {
          err('monster', id, `tag '${t}' is not registered in MONSTER_TAGS`, ['tags']);
        } else if (tagDefs[t].category === 'tier') {
          err('monster', id, `tag '${t}' is derived from \`tier\` — don't declare it by hand`, ['tags']);
        }
      }
      const material = byCategory('material').length;
      if (material !== 1) {
        err('monster', id, `needs exactly one material tag (living / inorganic / incorporeal) — has ${material}`, ['tags']);
      }
      if (byCategory('taxon').length === 0) {
        err('monster', id, 'needs at least one taxon tag (slime, beast, humanoid…) — it sets the bestiary shelf', ['tags']);
      }

      // Innate resistances compose by taking the STRONGEST opinion among the
      // tags, which only means anything while they agree on the direction. Two
      // that disagree make the result depend on which happens to be larger —
      // an arithmetic accident, not a decision. Mirrors tests/content.test.ts.
      const said: Record<string, { tag: string; sign: number }> = {};
      for (const t of tags) {
        for (const [type, rule] of Object.entries(TAG_RESISTANCES[t] ?? {})) {
          const sign = Math.sign(rule!.base);
          if (sign === 0) continue;
          const seen = said[type];
          if (seen && seen.sign !== sign) {
            err(
              'monster',
              id,
              `tags '${seen.tag}' and '${t}' disagree about ${type} resistance — one resists it, the other is weak to it`,
              ['tags'],
            );
          } else if (!seen) {
            said[type] = { tag: t, sign };
          }
        }
      }
    }

    // ---------- Mutagen sources ----------
    //
    // A mutagen keys on a monster TAG and a main gene keys on a SPECIES. Both
    // fail the same silent way: an id nothing carries means the thing simply
    // never drops, forever, with no error anywhere. Nothing else catches this,
    // which is exactly why it is worth a rule.
    const carried = new Set<string>();
    for (const def of Object.values(store.all<{ tags?: string[] }>('monster'))) {
      for (const t of def?.tags ?? []) carried.add(t);
    }
    // Severity splits on whether it is a mistake or a plan: a typo'd tag is
    // broken, while a real tag nothing carries yet is content authored ahead of
    // its monsters, which is a legitimate way to work.
    for (const [id, def] of Object.entries(store.all<{ from?: string }>('mutagen'))) {
      if (!def?.from) {
        err('mutagen', id, 'has no `from` tag, so nothing will ever drop it', ['from']);
      } else if (!tagDefs[def.from]) {
        err('mutagen', id, `'${def.from}' is not a registered monster tag`, ['from']);
      } else if (!carried.has(def.from)) {
        warn('mutagen', id, `no monster carries '${def.from}' yet, so it cannot drop`, ['from']);
      }
    }
    const species = store.all<unknown>('monster');
    const genes = store.all<{ from?: string; genus?: string; tier?: number }>('maingene');
    for (const [id, def] of Object.entries(genes)) {
      // A stub says nothing useful about its species yet, so the source checks
      // below would only pile a second complaint onto the same unfinished entry.
      if (isGeneStub(def)) {
        // Read the genera off their own registry rather than off what the
        // existing genes happen to use — a genus with no gene in it yet is
        // still a legitimate answer here.
        const options = Object.keys(store.all('genus')).join(', ');
        err(
          'maingene',
          id,
          `a stub — set a genus (${options}) and a tier; it will not be written until you do`,
          ['genus'],
        );
        continue;
      }
      // Bare is manufactured rather than harvested, so it names no species.
      if (!def?.from || def.genus === 'bare') continue;
      if (!species[def.from]) {
        warn('maingene', id, `'${def.from}' is not a monster yet — this gene is inert until it exists`, ['from']);
      }
    }
  }

  // ---------- Ways out of a condition ----------
  //
  // Mirrors tests/content.test.ts: a condition with `duration: null` has no
  // clock, so something else has to end it. The subtle half is WHERE that
  // something fires — `barFill` and `barDeplete` only ever come from
  // tickCombat, so a condition whose exits are all bar events survives a
  // knockout and rides into the next fight.
  const COMBAT_ONLY_EVENTS = new Set(['barFill', 'barDeplete']);
  for (const st of Object.values(statuses)) {
    if (st.duration !== null) continue;
    const otherExit =
      st.ceilingDecay !== undefined ||
      st.detonate !== undefined ||
      st.drains !== undefined ||
      st.surplus?.decayShare !== undefined;
    const removals = st.removal ?? [];
    if (!removals.length && !otherExit) {
      err('status', st.id, 'no duration and no removal — it would last forever', ['removal']);
      continue;
    }
    if (removals.length && !otherExit && removals.every((r) => COMBAT_ONLY_EVENTS.has(r.on))) {
      err(
        'status',
        st.id,
        `every removal is combat-only (${removals.map((r) => r.on).join(', ')}) — ` +
          `add { on: 'combatEnd' } or it outlives the fight`,
        ['removal'],
      );
    }
  }

  // ---------- Chance-based escalation ----------
  //
  // Mirrors tests/content.test.ts. `escalateFrom` is where escalation starts
  // being POSSIBLE and `cap` where it becomes certain, so the gap between them
  // is the whole mechanic: no gap and it is a deterministic escalation written
  // the long way.
  for (const st of Object.values(statuses)) {
    const from = st.stacking?.escalateFrom;
    if (from === undefined) continue;
    const path = ['stacking', 'escalateFrom'];
    if (st.stacking.onCap !== 'escalate') {
      err('status', st.id, "escalateFrom needs onCap: 'escalate'", path);
    }
    if (!st.escalatesTo) {
      err('status', st.id, 'escalateFrom but it escalates into nothing', path);
    }
    if (from < 0) {
      err('status', st.id, `escalateFrom must not be negative (got ${from})`, path);
    }
    if (st.stacking.cap === undefined || st.stacking.cap <= from) {
      err(
        'status',
        st.id,
        `escalateFrom ${from} leaves no room below cap ${st.stacking.cap ?? '(none)'}`,
        path,
      );
    }
  }

  // ---------- A pierced dot ----------
  //
  // Mirrors tests/content.test.ts. `dot.pierce` is the share of a tick that
  // ignores resistance and immunity alike. statuses.ts clamps it so a bad
  // value can never invert a tick, but a silent clamp is not feedback: above 1
  // the author meant something the field cannot express, and 0 is an omission
  // written the long way.
  for (const st of Object.values(statuses)) {
    const pierce = st.dot?.pierce;
    if (pierce === undefined) continue;
    if (pierce <= 0) {
      err('status', st.id, 'dot.pierce: 0 is the default — omit it instead', ['dot', 'pierce']);
    } else if (pierce > 1) {
      err('status', st.id, `dot.pierce is a share of the tick, so at most 1 (got ${pierce})`, ['dot', 'pierce']);
    }
  }

  // ---------- Blank values in closed vocabularies ----------
  //
  // `slot: ''`, `tier: ''`, `damageType: ''` are string UNIONS in the types, so
  // an empty scaffold value is a build error the moment it is written — but
  // nothing at the data level says which fields are unions. The corpus does:
  // a field where a few values repeat across many entries is an enum, and an
  // empty string is not one of them.
  for (const cat of store.catalog) {
    const defs = Object.values(store.all<Record<string, unknown>>(cat.kind));
    if (defs.length < 4) continue;
    const vocab = new Map<string, Map<string, number>>();
    for (const def of defs) {
      for (const [key, value] of Object.entries(def ?? {})) {
        if (typeof value !== 'string' || !value) continue;
        const counts = vocab.get(key) ?? new Map<string, number>();
        counts.set(value, (counts.get(value) ?? 0) + 1);
        vocab.set(key, counts);
      }
    }
    const closed = new Set(
      [...vocab]
        .filter(([, counts]) => {
          const total = [...counts.values()].reduce((a, b) => a + b, 0);
          return counts.size <= 12 && total >= 4 && counts.size <= total / 2;
        })
        .map(([key]) => key),
    );
    for (const [id, def] of Object.entries(store.all<Record<string, unknown>>(cat.kind))) {
      // A gene stub already carries one error naming both fields it is missing.
      // Repeating the genus half here would double the count without adding
      // anything — 44 drafts should read as 44 things to finish, not 88.
      if (cat.kind === 'maingene' && isGeneStub(def as { genus?: string; tier?: number })) continue;
      for (const key of closed) {
        const value = def?.[key];
        if (typeof value !== 'string') continue;
        const known = vocab.get(key)!;
        const options = [...known.keys()].slice(0, 8).join(', ');
        if (value === '') {
          err(cat.kind, id, `${key} is blank — expected one of: ${options}`, [key]);
        } else if (!known.has(value)) {
          // A warning, not an error: being the FIRST entry to use a legitimate
          // value looks identical to a typo from here. The typecheck settles
          // it either way, but this is the cheap early hint.
          warn(cat.kind, id, `${key} is '${value}', which no other ${cat.kind} uses — expected one of: ${options}`, [key]);
        }
      }
    }
  }

  // ---------- Numbers written as text ----------
  // The same class of bug the `ticks` check above guards one field against, swept
  // across the whole corpus: '0.5' sails through arithmetic ('0.5' * 2 is 1) but
  // fails typecheck and reads as a number in every UI, so it hides. Easy to
  // produce — the forge's new-field box defaults to text, so a numeric field
  // added without switching the type lands its value quoted.
  //
  // Ids are exempt: a bare-digit id ('1', tier-keyed groups) is legitimately a
  // string, and so is anything the corpus itself keys by.
  const NUMERIC_TEXT_EXEMPT = new Set(['id', 'name', 'icon', 'desc', 'color', 'label']);
  const findNumericText = (
    node: unknown,
    kindId: { kind: string; id: string },
    path: (string | number)[],
  ): void => {
    if (typeof node === 'string') {
      const key = path[path.length - 1];
      if (typeof key === 'string' && NUMERIC_TEXT_EXEMPT.has(key)) return;
      if (node.trim() !== '' && Number.isFinite(Number(node))) {
        err(
          kindId.kind,
          kindId.id,
          `${path.join('.')} is the string '${node}' — write it as a number (${Number(node)}), not text`,
          path,
        );
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((v, i) => findNumericText(v, kindId, [...path, i]));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) findNumericText(v, kindId, [...path, k]);
    }
  };
  for (const cat of store.catalog) {
    for (const [id, def] of Object.entries(store.all<Record<string, unknown>>(cat.kind))) {
      if (def) findNumericText(def, { kind: cat.kind, id }, []);
    }
  }

  // ---------- Music ----------
  // Mirrors 'music content' in tests/content.test.ts. Archetype targets are
  // coordinates in the unit cube — a target outside 0–1 is unreachable, so the
  // archetype could never win honestly; a scale that skips 0 has no tonic row.
  const MUSIC_CONTOURS = new Set(['rising', 'falling', 'arch', 'valley', 'level', 'undulating']);
  const MUSIC_CADENCES = new Set(['closed', 'open', 'deceptive', 'wandering', 'silent']);
  const axisSet = new Set<string>(MUSIC_AXES);
  for (const [id, arch] of Object.entries(store.all<MusicArchetypeDef>('musicArchetype'))) {
    for (const [axis, v] of Object.entries(arch.target ?? {})) {
      if (!axisSet.has(axis)) err('musicArchetype', id, `target axis '${axis}' is not a classifier output`, ['target']);
      if (typeof v !== 'number' || v < 0 || v > 1) err('musicArchetype', id, `target.${axis} must be within 0–1`, ['target']);
    }
    for (const [axis, w] of Object.entries(arch.weights ?? {})) {
      if (!axisSet.has(axis)) err('musicArchetype', id, `weight axis '${axis}' is not a classifier output`, ['weights']);
      if (typeof w !== 'number' || w <= 0) err('musicArchetype', id, `weights.${axis} must be positive`, ['weights']);
      if (arch.target?.[axis as keyof typeof arch.target] === undefined) {
        err('musicArchetype', id, `weights.${axis} has no matching target — a weight with nothing to pull toward`, ['weights']);
      }
    }
    if (Object.keys(arch.target ?? {}).length === 0) {
      err('musicArchetype', id, 'an archetype with no target axes matches everything equally');
    }
    // Calibration. Random sheets sit at syncopation ~0.333, rhythmEntropy
    // ~0.808 and motif ~0.157; written music at ~0.000, ~0.20 and ~0.70.
    // Those three axes are the only reliable deliberateness detectors, so an
    // archetype silent about them gets won by dice rather than by composing.
    for (const axis of ['motif', 'rhythmEntropy', 'syncopation'] as const) {
      if (arch.target?.[axis] === undefined) {
        err('musicArchetype', id, `declares no ${axis} — dice will reach this archetype as easily as a composer`, ['target']);
      }
    }
    if ((arch.target?.syncopation ?? 0) > 0.15) {
      err('musicArchetype', id, 'syncopation target sits in the noise cloud (random median 0.333; the most syncopated writable sheet measures 0.267)', ['target']);
    }
    if ((arch.target?.rhythmEntropy ?? 0) > 0.6) {
      err('musicArchetype', id, 'rhythmEntropy target is unreachable — the duration palette tops out near 0.65', ['target']);
    }
    if ((arch.contours ?? []).includes('undulating')) {
      err('musicArchetype', id, 'claims `undulating`, which 99% of random sheets read as — that is a flat purity bonus handed to dice, not a hint about shape', ['contours']);
    }
    for (const c of arch.contours ?? []) {
      if (!MUSIC_CONTOURS.has(c)) err('musicArchetype', id, `contour '${c}' is not one the classifier can produce`, ['contours']);
    }
    for (const c of arch.cadences ?? []) {
      if (!MUSIC_CADENCES.has(c)) err('musicArchetype', id, `cadence '${c}' is not one the classifier can produce`, ['cadences']);
    }
    if (arch.confers) {
      if (!statuses[arch.confers.status]) {
        err('musicArchetype', id, `confers unknown status '${arch.confers.status}'`, ['confers']);
      }
      if (!(arch.confers.perPower > 0)) {
        err('musicArchetype', id, 'confers.perPower must be positive', ['confers']);
      }
      if (arch.confers.duration !== undefined && !(arch.confers.duration > 0)) {
        err('musicArchetype', id, 'confers.duration must be positive', ['confers']);
      }
    }
  }
  for (const [id, scale] of Object.entries(store.all<MusicScaleDef>('musicScale'))) {
    if (scale.mode !== undefined && scale.mode !== 'major' && scale.mode !== 'minor') {
      err('musicScale', id, `mode '${scale.mode}' is neither major nor minor — omit it if the scale is genuinely ambiguous`, ['mode']);
    }
    const degrees = scale.degrees ?? [];
    if (degrees[0] !== 0) err('musicScale', id, 'degrees must start at 0 — every scale opens on its tonic', ['degrees']);
    for (let i = 0; i < degrees.length; i++) {
      const d = degrees[i];
      if (!Number.isInteger(d) || d < 0 || d > 11) err('musicScale', id, `degree ${d} is outside 0–11`, ['degrees']);
      if (i > 0 && d <= degrees[i - 1]) err('musicScale', id, 'degrees must ascend strictly', ['degrees']);
    }
  }
  for (const [id, meter] of Object.entries(store.all<MusicMeterDef>('musicMeter'))) {
    if (!Number.isInteger(meter.beats) || meter.beats < 1) {
      err('musicMeter', id, 'beats must be a positive whole number', ['beats']);
    }
    if (!Number.isInteger(meter.beatUnits) || meter.beatUnits < 1) {
      err('musicMeter', id, 'beatUnits must be a positive whole number of grid units', ['beatUnits']);
    }
    const cap = (meter.beats ?? 0) * (meter.beatUnits ?? 0);
    for (const a of meter.accents ?? []) {
      if (a <= 0 || a >= cap) err('musicMeter', id, `accent ${a} falls outside the bar (0–${cap})`, ['accents']);
      if (meter.beatUnits && a % meter.beatUnits !== 0) {
        err('musicMeter', id, `accent ${a} is not on a beat — accents sit on beat boundaries`, ['accents']);
      }
    }
    if (!(meter.unlockLevel >= 0)) err('musicMeter', id, 'unlockLevel must be 0 or higher', ['unlockLevel']);
  }

  // ---------- Modular smithing ----------
  //
  // Mirrors the 'modular smithing content' block of tests/content.test.ts by
  // calling the SAME rules (systems/assemblyValidation.ts) on the staged
  // copies, so a part, class, smith profile or forge recipe edited here is
  // checked as it stands. The enumeration is the lighter 'tags' one — one
  // material per accepted tag, every distinct classification — because this
  // runs on every keystroke; the test runs the exhaustive one.
  for (const issue of smithingContentIssues(
    {
      parts: store.all<PartKindDef>('part'),
      classes: store.all<ItemClassDef>('itemClass'),
      materials: store.all<MaterialDef>('material'),
      recipes: store.all<RecipeDef>('recipe'),
    },
    { materials: 'tags' },
  )) {
    err(issue.kind, issue.id, `${issue.rule}: ${issue.message}`);
  }

  // ---------- Duplicate ids ----------
  for (const cat of store.catalog) {
    for (const [key, def] of Object.entries(store.all<{ id?: string }>(cat.kind))) {
      if (def?.id && def.id !== key) {
        err(cat.kind, key, `registry key '${key}' does not match its id '${def.id}'`);
      }
    }
  }

  // ---------- Id shape ----------
  // The same rule the rename gate enforces (`idProblem` above), swept across
  // what is already on disk — an id gets typed into counter keys, save files
  // and cross-references, so one casing everywhere is not a style preference.
  for (const cat of store.catalog) {
    for (const rawKey of Object.keys(store.all(cat.kind))) {
      // `forged:<classId>` item stubs are generated from ITEM_CLASSES (the
      // prefix is the one sanctioned colon); the class id after it is held to
      // the shape here and is an ITEM_CLASSES key, checked in its own right.
      const key = cat.kind === 'item' ? rawKey.replace(/^forged:/, '') : rawKey;
      if (!ID_SHAPE.test(key)) {
        warn(cat.kind, key, `id '${key}' is not lowercase snake_case — rename it before anything else points here`);
      }
    }
  }

  // Recipe cards and learned dishes (ConsumableSpec.teaches ↔ CraftOutcomeDef.recipe):
  // every learned dish has a card, every card teaches a real dish, and every
  // card can be had — sold at a counter or dropped by some activity.
  {
    const taught = new Set<string>();
    const recipeIds = new Set<string>();
    for (const disc of Object.values(store.all<CraftDisciplineDef>('discipline'))) {
      for (const o of disc.outcomes ?? []) if (o.recipe) recipeIds.add(o.recipe);
    }
    const sold = new Set<string>();
    for (const npc of Object.values(npcs)) for (const line of npc.shop?.lines ?? []) if (line.kind === 'material') sold.add(line.id);
    const dropped = new Set<string>();
    for (const spot of Object.values(spots)) {
      for (const act of spot.activities ?? []) {
        const drops: ActivityDrop[] = ('drops' in act ? act.drops : undefined) ?? [];
        for (const d of drops) dropped.add(d.material);
      }
    }
    for (const mat of Object.values(store.all<MaterialDef>('material'))) {
      const c = mat.consumable;
      const card = !!c && !!(c.teaches || c.unlocksWord || c.teachesTechnique || c.stamps || c.votive);
      if (card && !sold.has(mat.id) && !dropped.has(mat.id)) err('material', mat.id, 'a card no counter sells and no activity drops', ['consumable']);
      if (c?.stamps && !c.stamps.startsWith('flag:')) err('material', mat.id, 'stamps must name a flag: counter', ['consumable']);
      if (c?.unlocksWord && !ARCANE_WORDS[c.unlocksWord]) err('material', mat.id, `unlocks unknown word '${c.unlocksWord}'`, ['consumable']);
      if (c?.teachesTechnique && !store.all('technique')[c.teachesTechnique]) err('material', mat.id, `teaches unknown technique '${c.teachesTechnique}'`, ['consumable']);
      const t = c?.teaches;
      if (!t) continue;
      taught.add(t);
      if (!recipeIds.has(t)) err('material', mat.id, `teaches '${t}', which no bench outcome names as its recipe`, ['consumable']);
    }
    for (const id of recipeIds) {
      if (!taught.has(id)) err('discipline', id, `learned dish '${id}' has no recipe card to teach it`);
    }
  }

  // Heat windows (CraftOutcomeDef.heat). Mirrors 'heat windows' in
  // tests/content.test.ts, and is the same function: a windowed outcome needs a
  // timed bench, a window-less fallback on the same tags, and a layout that
  // lands inside its window.
  for (const disc of Object.values(store.all<CraftDisciplineDef>('discipline'))) {
    for (const p of heatWindowProblems(disc, store.all<MaterialDef>('material'))) {
      err('discipline', disc.id, p.message, ['outcomes', `#id=${p.outcome}`, 'heat']);
    }
  }

  // Food and Signatures (ConsumableSpec.food, .signature). Mirrors 'food and
  // signatures' in tests/content.test.ts, and is the same function: exactly the
  // materials a cooking bench makes are food, a dish carries a signature that
  // names a real condition and repeats none of its own, the bench's failure dish
  // carries none, food grants nothing permanent, null or harmful (the failure
  // dish's own grants aside).
  for (const p of foodProblems(
    Object.values(store.all<CraftDisciplineDef>('discipline')),
    store.all<MaterialDef>('material'),
    statuses,
  )) {
    err('material', p.material, p.message, ['consumable']);
  }

  // Explicit condition immunity (StatusDef.immune). Mirrors tests/content.test.ts:
  // every id it names must be a real condition, and it must name something.
  for (const st of Object.values(statuses)) {
    if (!st.immune) continue;
    if (!st.immune.ids?.length && !st.immune.elements?.length) {
      err('status', st.id, 'immune names no condition and no element — it protects against nothing', ['immune']);
    }
    for (const id of st.immune.ids ?? []) {
      if (!statuses[id]) err('status', st.id, `immune names unknown condition '${id}'`, ['immune', 'ids']);
    }
  }

  // Who can resist what (StatusDef.element / unresistable, immune on a condition
  // or a title). Mirrors 'every harmful condition says what resists it' in
  // tests/content.test.ts, and is the same function: a harmful condition has an
  // element or is unresistable (never both), and nothing may switch an
  // unresistable one off.
  for (const p of resistanceProblems(statuses, store.all<TitleDef>('title'))) {
    err(p.kind, p.id, p.message, p.path);
  }

  // Monster penetration (MonsterDef.penetration, TierDef.penetration). Mirrors
  // 'monster penetration' in tests/content.test.ts, and is the same function:
  // an own value is a share, and nothing that can appear on floors 1 to 3
  // applies conditions with any.
  for (const p of penetrationProblems(
    store.all<MonsterDef>('monster'),
    (store.meta.tiers ?? {}) as Record<string, TierDef>,
    spots,
    floors,
  )) {
    err('monster', p.monster, p.message, ['penetration']);
  }
  return issues;
}

function validateFinds(
  spot: SpotDef,
  refs: {
    materials: Record<string, unknown>;
    items: Record<string, unknown>;
    runes: Record<string, unknown>;
    spots: Record<string, SpotDef>;
    claimedTags: Set<string>;
  },
  err: (kind: string, id: string, message: string, path?: (string | number)[]) => void,
  warn: (kind: string, id: string, message: string, path?: (string | number)[]) => void,
): void {
  const seen = new Set<string>();
  for (const f of spot.finds ?? []) {
    const at = ['finds', `#id=${f.id}`];
    if (!f.id) {
      err('spot', spot.id, 'a find has no id', ['finds']);
      continue;
    }
    if (seen.has(f.id)) err('spot', spot.id, `duplicate find id '${f.id}'`, at);
    seen.add(f.id);

    if (typeof f.at !== 'number') {
      err('spot', spot.id, `find '${f.id}': at is ${JSON.stringify(f.at)} — a ${typeof f.at}, not a number`, at);
    } else {
      if (!(f.at > 0)) err('spot', spot.id, `find '${f.id}': at must be greater than 0`, at);
      if (f.at > 1) err('spot', spot.id, `find '${f.id}': at must be 1 or less`, at);
    }

    if (!payloadOf(f)) err('spot', spot.id, `find '${f.id}' yields nothing at all`, at);

    if (f.material) {
      if (!refs.materials[f.material.id]) err('spot', spot.id, `find '${f.id}': unknown material '${f.material.id}'`, at);
      if ((f.material.qty ?? 1) <= 0) err('spot', spot.id, `find '${f.id}': material qty must be positive`, at);
    }
    if (f.item && !refs.items[f.item]) err('spot', spot.id, `find '${f.id}': unknown item '${f.item}'`, at);
    if (f.rune && !refs.runes[f.rune]) err('spot', spot.id, `find '${f.id}': unknown rune '${f.rune}'`, at);
    if (f.gold && (f.gold[0] < 0 || f.gold[0] > f.gold[1])) {
      err('spot', spot.id, `find '${f.id}': gold range is inverted or negative`, at);
    }
    if (f.spot && !refs.spots[f.spot]) err('spot', spot.id, `find '${f.id}': rumors unknown spot '${f.spot}'`, at);
    if (f.path) {
      const edge = (spot.connections ?? []).find((c: Connection) => c.to === f.path);
      if (!edge) err('spot', spot.id, `find '${f.id}': opens a path to '${f.path}' that isn't declared here`, at);
      else if (!edge.hidden) err('spot', spot.id, `find '${f.id}': path to '${f.path}' isn't hidden, so nothing opens`, at);
    }
    if (f.skillXp) {
      if (!f.skillXp.tags?.length) err('spot', spot.id, `find '${f.id}': skillXp needs at least one tag`, at);
      if (!(f.skillXp.xp > 0)) err('spot', spot.id, `find '${f.id}': skillXp xp must be positive`, at);
      for (const tag of f.skillXp.tags ?? []) {
        if (!refs.claimedTags.has(tag)) {
          err('spot', spot.id, `find '${f.id}': tag '${tag}' is claimed by no skill, so it trains nothing`, at);
        }
      }
    }
    // The cross-room wire touches ONLY its own namespace — bumping `kills` or
    // `gather:` counters from a find would quietly corrupt achievements. The
    // one exception: `set` may target `slain:`/`fights:` counters, which is
    // exactly how content resets a once-boss or a spent fight budget.
    if (f.stat) {
      const key = f.stat.key ?? '';
      if (f.stat.amount !== undefined && f.stat.set !== undefined) {
        err('spot', spot.id, `find '${f.id}': stat has both amount and set — pick one`, at);
      }
      const resettable = key.startsWith('slain:') || key.startsWith('fights:');
      if (!key.startsWith('flag:') && !(f.stat.set !== undefined && resettable)) {
        err('spot', spot.id, `find '${f.id}': stat key '${key}' must be flag:* (or slain:*/fights:* with set, for resets)`, at);
      }
    }
    if (!f.desc) warn('spot', spot.id, `find '${f.id}' has no description — the log line will be generic`, at);
  }

  // Two finds at the same depth is legal but almost never intended: they land
  // on consecutive ticks and read as one event stuttering.
  const byAt = new Map<number, string[]>();
  for (const f of spot.finds ?? []) {
    byAt.set(f.at, [...(byAt.get(f.at) ?? []), f.id]);
  }
  for (const [at, ids] of byAt) {
    if (ids.length > 1) warn('spot', spot.id, `finds ${ids.join(', ')} all sit at ${Math.round(at * 100)}%`, ['finds']);
  }
}

function payloadOf(f: SpotFind): boolean {
  return !!(f.material || f.item || f.keyItem || f.rune || f.gold || f.spot || f.path || f.skillXp || f.stat || f.desc);
}

export interface Edge extends Connection {
  from: string;
}

/** The same mirroring rule as `registry.ts`: two-way unless `oneWay`. */
export function buildAdjacency(spots: Record<string, SpotDef>): Map<string, Edge[]> {
  const adj = new Map<string, Edge[]>();
  const add = (from: string, c: Connection) => {
    const list = adj.get(from) ?? [];
    if (!list.some((e) => e.to === c.to)) list.push({ ...c, from });
    adj.set(from, list);
  };
  for (const spot of Object.values(spots)) {
    for (const c of spot.connections ?? []) {
      add(spot.id, c);
      // The mirror deliberately drops `hidden`: reaching a spot through a
      // hidden edge doesn't make the way back a secret.
      if (!c.oneWay) add(c.to, { to: spot.id, ticks: c.ticks, label: c.label });
    }
  }
  return adj;
}
