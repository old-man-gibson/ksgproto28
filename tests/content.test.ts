// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { KEY_ITEMS } from '../src/core/data/keyitems.data';
import { searchContentIssues } from '../src/core/systems/searchValidation';
import { smithingContentIssues } from '../src/core/systems/assemblyValidation';
import { exploreIssues, floorStructureIssues, type FloorRule } from '../src/core/systems/floorRules';
import { SHELVED_WORLD } from '../src/core/data/shelved';
import { schoolTaughtKey } from '../src/core/systems/martial';
import {
  ACHIEVEMENTS,
  ADJACENCY,
  AREAS,
  BESTIARY_FACTS,
  ITEMS,
  ITEM_CLASSES,
  MATERIALS,
  MONSTERS,
  MONSTER_TAGS,
  NPCS,
  PART_KINDS,
  QUESTS,
  RECIPES,
  REGIONS,
  RUNES,
  SKILLS,
  SPOTS,
  STYLES,
  SUPERATTRS,
  TITLES,
  STATUSES,
  STATUS_LIST,
  DISCIPLINES,
  DISCIPLINE_LIST,
  NAMED_RUNES,
  RUNE_ADORNMENTS,
  RUNE_PATTERNS,
  REAGENTS,
  TECHNIQUES,
  POSITIONS,
  GENERA,
  MAIN_GENES,
  MUTATIONS,
  LAYOUTS,
  DEITIES,
  MIRACLES,
  MUSIC_ARCHETYPES,
  MUSIC_METERS,
  MUSIC_SCALES,
  TOWERS,
  BANDS,
  FLOORS,
  STARTING_SPOT,
  TIERS,
} from '../src/core/registry';
import { RES_STAT_BY_TYPE, SKILL_CATEGORIES, STAT_NAMES } from '../src/core/types';
import { ATTRIBUTE_LIST } from '../src/core/data/attributes.data';
import { RESOURCES } from '../src/core/data/resources.data';
import { XP_BASE, XP_RATE } from '../src/core/data/progression.data';
import { TERRAIN_PROFILES } from '../src/core/data/climate.data';
import { offLadderDoor } from '../src/core/data/towers.data';
import { ELEMENT_TAGS, PLACE_TAGS } from '../src/core/systems/exposure';
import { TAG_RESISTANCES, penetrationProblems } from '../src/core/systems/monsterStats';
import { resistanceProblems } from '../src/core/systems/conditionHarm';
import { monsterTags } from '../src/core/systems/bestiary';
import { ARCANE_WORDS } from '../src/core/data/spellcraft.data';
import { isCard } from '../src/core/systems/consumables';
import { foodProblems, heatWindowProblems } from '../src/core/systems/disciplines';
import { askingPrice, lineValue } from '../src/core/systems/shops';
import { wordTag } from '../src/core/data/wordskills.data';
import { attrXpWeights } from '../src/core/systems/actions';
import { recipeRoutes, routeYield } from '../src/core/systems/crafting';
import { BAR_UNITS, MUSIC_AXES, NOTE_DURATIONS } from '../src/core/data/music.data';
import type { ActivityFactor, MusicAxis, SpotDef, UnlockCondition } from '../src/core/types';

/**
 * The content linter. Every cross-reference between the data registries is
 * validated here — `npm run verify` names the offending id when something
 * doesn't resolve. See docs/CONTENT_GUIDE.md §8.
 */

const VALID_DAMAGE_TYPES = new Set(Object.keys(RES_STAT_BY_TYPE));
const VALID_ATTRS = new Set(ATTRIBUTE_LIST.map((a) => a.id));

/** Counters some system actually bumps (docs/CONTENT_GUIDE.md §5). */
function statCounterValid(key: string): boolean {
  const staticKeys = new Set([
    'kills',
    'defeats',
    'gold:earned',
    'crafts',
    'quests:completed',
    'travel:trips',
    'skill:levels',
    'weapon:families',
    'miracles:learned',
    'spells:inscribed', // spellcraft.ts inscribeArcane
    'bestiary:entries', // bestiary.ts recordKill, first of a species
    'gold:spent', // shops.ts buy
    'shop:buys', // shops.ts buy
    'prestige:count', // prestige.ts prestigeNow, from the legacy block
    'legacy:stronghold', // prestige.ts prestigeNow, once the stronghold is held
  ]);
  if (staticKeys.has(key)) return true;
  // What the fight itself counts, for conditions that learn from doing
  // (martial self-learn, and any unlock gated on having fought a certain way).
  const COMBAT_COUNTERS = new Set(['attacks', 'crits', 'dodges', 'parries', 'hitsTaken']);
  if (key.startsWith('combat:')) return COMBAT_COUNTERS.has(key.slice(7));
  // `used:<family>` is flagged the first time you swing that weapon family.
  if (key.startsWith('used:')) return key.slice(5).length > 0;
  // Per-vendor tallies: shops.ts stamps shop:buys:<npcId> on every purchase.
  if (key.startsWith('shop:buys:')) return key.slice(10).length > 0;
  // `taught:<skill>` is stamped by a teacher's school lesson (martial.ts
  // teachSchool), so it is bumped only if some NPC gives that lesson.
  if (key.startsWith('taught:')) {
    const school = key.slice(7);
    return Object.values(NPCS).some((n) => (n.teaches ?? []).some((l) => 'school' in l && l.school === school));
  }
  // Tag tallies are bumped for every tag a killed monster carried, including
  // the derived ones (tier, swarm, non_elemental), so check against tags in use
  // rather than the hand-written registry alone.
  if (key.startsWith('kills:tag:')) {
    const tag = key.slice(10);
    return Object.values(MONSTERS).some((m) => monsterTags(m).includes(tag));
  }
  // `boss:<spot>` is bumped when a boss-flagged spawn dies there (combat.ts).
  if (key.startsWith('boss:')) {
    return !!SPOTS[key.slice(5)]?.encounters?.some((e) => e.boss);
  }
  if (key.startsWith('fights:')) return (SPOTS[key.slice(7)]?.fightLimit ?? 0) > 0;
  // `slain:<spot>:<monster>` is bumped when a `once` entry dies there (combat.ts).
  if (key.startsWith('slain:')) {
    const [, spotId, monsterId] = key.split(':');
    return !!SPOTS[spotId]?.encounters?.some((e) => e.once && e.monsterId === monsterId);
  }
  if (key.startsWith('kills:')) return key.slice(6) in MONSTERS;
  if (key.startsWith('gather:')) return key.slice(7) in MATERIALS;
  // `forged:<class>` is bumped when the anvil makes a piece of that class, and
  // by a recipe line whose parts resolve to it (systems/forging.ts, actions.ts).
  if (key.startsWith('forged:')) return key.slice(7) in ITEM_CLASSES;
  if (key.startsWith('attr:')) return VALID_ATTRS.has(key.slice(5) as never);
  // `flag:*` is content's own namespace (SpotFind.stat): real only when some
  // find or search reward writes it, by bump or by set.
  if (key.startsWith('flag:')) return contentFlags().has(key);
  return false;
}

/** Every `flag:*` key a find or a search reward writes — what conditions may read. */
function contentFlags(): Set<string> {
  const keys = new Set<string>();
  for (const spot of Object.values(SPOTS)) {
    for (const f of spot.finds ?? []) if (f.stat?.key.startsWith('flag:')) keys.add(f.stat.key);
    for (const act of spot.activities) {
      if (act.kind !== 'search') continue;
      for (const r of act.rewards) if (r.stat?.key.startsWith('flag:')) keys.add(r.stat.key);
    }
  }
  // A card that stamps a flag when read (ConsumableSpec.stamps).
  for (const mat of Object.values(MATERIALS)) {
    const k = mat.consumable?.stamps;
    if (k?.startsWith('flag:')) keys.add(k);
  }
  return keys;
}

const VALID_STATS = new Set(Object.keys(STAT_NAMES));

/**
 * A modifier target: a stat, an attribute, or a SCOPED stat like
 * `craftSpeed:leatherwork`. The scope after the colon is a free tag, but the
 * stat before it must be real — `craftSpeeed:leatherwork` would otherwise sit
 * in the data doing nothing at all, forever.
 */
function modTargetValid(target: string): boolean {
  const [stat, ...rest] = target.split(':');
  if (rest.length > 1) return false; // one colon, one scope
  if (!VALID_STATS.has(stat) && !VALID_ATTRS.has(stat as never)) return false;
  return rest.length === 0 || rest[0].length > 0;
}
/** Skills the factor system may reference before they're built (see plan). */
const PLANNED_SKILLS = new Set(['mining', 'hunting', 'trapmaking']);

function checkFactors(owner: string, factors: ActivityFactor[] | undefined): void {
  for (const f of factors ?? []) {
    const keys = [f.attr, f.stat, f.skill].filter((v) => v !== undefined);
    expect(keys.length, `${owner}: factor needs exactly one of attr/stat/skill`).toBe(1);
    if (f.attr !== undefined) expect(VALID_ATTRS.has(f.attr), `${owner}: factor attr ${f.attr}`).toBe(true);
    if (f.stat !== undefined) expect(VALID_STATS.has(f.stat), `${owner}: factor stat ${f.stat}`).toBe(true);
    if (f.skill !== undefined)
      expect(
        SKILLS[f.skill] !== undefined || PLANNED_SKILLS.has(f.skill),
        `${owner}: factor skill '${f.skill}' is neither a known nor a planned skill`,
      ).toBe(true);
  }
}

function checkConditions(owner: string, conds: UnlockCondition[] | undefined): void {
  for (const c of conds ?? []) {
    if (c.type === 'skill') expect(SKILLS[c.id], `${owner}: unlock skill ${c.id}`).toBeDefined();
    if (c.type === 'quest') expect(QUESTS[c.id], `${owner}: unlock quest ${c.id}`).toBeDefined();
    if (c.type === 'attr') expect(VALID_ATTRS.has(c.attr), `${owner}: unlock attr ${c.attr}`).toBe(true);
    if (c.type === 'stat')
      expect(statCounterValid(c.key), `${owner}: stat counter '${c.key}' is never bumped`).toBe(true);
  }
}

describe('counters', () => {
  it('are only ever written through bumpStat/raiseStat', () => {
    // Writing `state.stats[k] = …` directly moves the number but never calls
    // checkAchievements, so the counter climbs while its thresholds stay
    // silent. Every write must go through achievements.ts, which is the only
    // place that notices a tier being crossed.
    const sources = import.meta.glob('../src/core/**/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;

    const offenders: string[] = [];
    for (const [path, source] of Object.entries(sources)) {
      if (path.endsWith('/achievements.ts')) continue; // the one legal writer
      source.split('\n').forEach((line, i) => {
        if (/\bstate\.stats\[[^\]]*\]\s*(=(?!=)|\+=)/.test(line)) {
          offenders.push(`${path}:${i + 1} — ${line.trim()}`);
        }
      });
    }

    expect(offenders.length, `direct counter writes bypass achievement checks:\n${offenders.join('\n')}`)
      .toBe(0);
  });

  it('never uses the VALUE of an assignment to a state field', () => {
    // `const held = (state.finds[id] ??= [])` hands back the RAW array, while
    // the UI's deep $state proxy stores a proxied copy of it — so everything
    // pushed into `held` lands somewhere nothing will ever read. It only
    // misfires when the key was ABSENT, so it works for new games, breaks for
    // saves predating the field, and never reproduces in a unit test (which
    // uses plain objects with no proxy). Confirmed in the browser: an
    // exploration find written this way paid out three times instead of once.
    //
    // Assign on its own line, then read the field back:
    //   state.finds[id] ??= [];
    //   state.finds[id].push(x);
    const sources = import.meta.glob('../src/core/**/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;

    // Rooted at `state.` on purpose: GameState is the object the UI proxies,
    // so it is the only place the assignment's raw value diverges from what is
    // stored. A local accumulator with the same shape is perfectly safe.
    const pattern = /\(\s*state(?:\.[\w$]+|\[[^\]]*\])+\s*(?:\?\?=|\|\|=|&&=|=(?!=))[^()]*\)\s*[.[]/;

    const offenders: string[] = [];
    for (const [path, source] of Object.entries(sources)) {
      source.split('\n').forEach((line, i) => {
        if (pattern.test(line)) offenders.push(`${path}:${i + 1} — ${line.trim()}`);
      });
    }

    expect(
      offenders.length,
      `the value of an assignment is the raw object, not the proxy's copy:\n${offenders.join('\n')}`,
    ).toBe(0);
  });
});

describe('world graph', () => {
  it('every area/spot/connection resolves', () => {
    for (const area of Object.values(AREAS)) {
      expect(REGIONS[area.regionId], `${area.id} region`).toBeDefined();
    }
    for (const spot of Object.values(SPOTS)) {
      expect(AREAS[spot.areaId], `${spot.id} area`).toBeDefined();
      for (const c of spot.connections) {
        expect(SPOTS[c.to], `${spot.id} -> ${c.to}`).toBeDefined();
      }
    }
  });

  it('a region\'s terrain names a real climate profile', () => {
    // Mirrored live in forge/lib/validate.ts. Terrain is optional (a new
    // region defaults to 'plains'), but a present value must resolve.
    for (const region of Object.values(REGIONS)) {
      if (region.terrain === undefined) continue;
      expect(TERRAIN_PROFILES[region.terrain], `${region.id} terrain '${region.terrain}'`).toBeDefined();
    }
  });

  it('place tags come from the exposure vocabulary, at every level', () => {
    // Mirrored live in forge/lib/validate.ts. A tag outside the vocabulary
    // would sit in the data radiating nothing, forever. Regions and areas
    // carry the same tags as spots — effective tags are the union down.
    for (const defs of [Object.values(REGIONS), Object.values(AREAS), Object.values(SPOTS)]) {
      for (const def of defs as { id: string; tags?: string[] }[]) {
        for (const tag of def.tags ?? []) {
          expect(
            ELEMENT_TAGS.has(tag) || PLACE_TAGS.has(tag),
            `${def.id}: tag '${tag}' is neither an element nor a place tag`,
          ).toBe(true);
        }
      }
    }
  });

  it('a return label only exists where there is a return trip to label', () => {
    for (const spot of Object.values(SPOTS)) {
      for (const c of spot.connections) {
        if (c.returnLabel === undefined) continue;
        expect(
          c.oneWay,
          `${spot.id} -> ${c.to}: returnLabel on a one-way edge, which has no mirror to wear it`,
        ).not.toBe(true);
        expect(c.label, `${spot.id} -> ${c.to}: returnLabel without an outbound label`).toBeDefined();
      }
    }
  });

  it('a forced fight always has someone to start it', () => {
    // Forced spots and forced-edge destinations spawn from the encounter
    // table on arrival — an empty one would be a fight with no one in it.
    for (const spot of Object.values(SPOTS)) {
      if (spot.forced) {
        expect(
          spot.encounters?.length ?? 0,
          `${spot.id} is forced but has no encounters`,
        ).toBeGreaterThan(0);
      }
      for (const c of spot.connections) {
        if (!c.forced) continue;
        expect(
          SPOTS[c.to]?.encounters?.length ?? 0,
          `${spot.id} -> ${c.to} is forced but '${c.to}' has no encounters`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('the mirror of a forced edge is an ordinary road home', () => {
    // `forced` means "arriving at THIS edge's far end is an ambush"; the
    // registry must never copy it onto the mirrored return edge.
    for (const [from, edges] of ADJACENCY) {
      for (const e of edges) {
        if (!e.forced) continue;
        const declared = SPOTS[from]?.connections.some((c) => c.to === e.to && c.forced);
        expect(declared, `${from} -> ${e.to}: forced appeared on a mirrored edge`).toBe(true);
      }
    }
  });

  it('the mirrored edge wears returnLabel, the declared one keeps its own', () => {
    const down = ADJACENCY.get('ravine_rim')!.find((e) => e.to === 'ravine_floor');
    const up = ADJACENCY.get('ravine_floor')!.find((e) => e.to === 'ravine_rim');
    expect(down?.label).toBe('Steep Descent');
    expect(up?.label).toBe('Steep Climb');

    // A road that reads the same both ways still mirrors its single label.
    const out = ADJACENCY.get('village_square')!.find((e) => e.to === 'ravine_rim');
    const back = ADJACENCY.get('ravine_rim')!.find((e) => e.to === 'village_square');
    expect(out?.label).toBe('Old Road');
    expect(back?.label).toBe('Old Road');
  });

  it('bidirectional edges are mirrored; one-way edges are not', () => {
    expect(ADJACENCY.get('village_square')!.map((e) => e.to)).toContain('training_grounds');
    expect(ADJACENCY.get('training_grounds')!.map((e) => e.to)).toContain('village_square');
    // deep_woods -> ravine_floor is a one-way slide.
    expect(ADJACENCY.get('deep_woods')!.map((e) => e.to)).toContain('ravine_floor');
    expect(ADJACENCY.get('ravine_floor')!.map((e) => e.to)).not.toContain('deep_woods');
  });

  /**
   * The ladder is a road that owns no edges: `climbTo` (systems/towers.ts)
   * moves between a tower's hub and any unlocked floor's landing directly.
   * Both graph walks here ride the same pseudo-edges, or every banded floor
   * would read as unreachable/trapped the moment it was authored correctly
   * (banded floor areas are CLOSED — see the towers suite).
   */
  const ladderEdges = (): Map<string, string[]> => {
    const extra = new Map<string, string[]>();
    const add = (from: string, to: string) => extra.set(from, [...(extra.get(from) ?? []), to]);
    for (const tower of Object.values(TOWERS)) {
      for (const floor of Object.values(FLOORS)) {
        if (floor.towerId !== tower.id || floor.bandId === undefined || !floor.landing) continue;
        add(tower.hubSpot, floor.landing);
        add(floor.landing, tower.hubSpot);
      }
      // A band's hub (band 3's castle) is a second place the ladder answers.
      for (const band of Object.values(BANDS)) {
        if (band.towerId !== tower.id || !band.hub) continue;
        add(tower.hubSpot, band.hub);
        add(band.hub, tower.hubSpot);
      }
    }
    return extra;
  };

  it('every spot is reachable from the starting spot', () => {
    const ladder = ladderEdges();
    const seen = new Set<string>([STARTING_SPOT]);
    const queue = [STARTING_SPOT];
    while (queue.length) {
      const at = queue.pop()!;
      const next = [
        ...(ADJACENCY.get(at) ?? []).map((e) => e.to),
        ...(ladder.get(at) ?? []),
      ];
      for (const to of next) {
        if (!seen.has(to)) {
          seen.add(to);
          queue.push(to);
        }
      }
    }
    for (const id of Object.keys(SPOTS)) expect(seen.has(id), `${id} unreachable`).toBe(true);
  });

  /**
   * COMPLETABILITY (docs/COMPLETABILITY.md, Invariant A: no reachable state is
   * terminal). Reaching every spot is only half of it. A one-way edge into a
   * pocket with no road out is a permanent trap, and the retreat valve is no
   * answer — `retreatToSafety` fires only when a FORCED fight is LOST, so a
   * quiet dead end strands the player with nothing to lose to. Getting to a
   * waypoint is the test because fast travel out is unlocked from there.
   *
   * Hidden edges count as usable here: the companion test below ('every hidden
   * path is reachable') already guarantees each one can be revealed from the
   * spot it leaves.
   */
  it('every spot can get home — no one-way edge is a trap', () => {
    const waypoints = Object.values(SPOTS)
      .filter((s) => s.waypoint)
      .map((s) => s.id);
    expect(waypoints.length, 'no waypoints, so there is nowhere to get home to').toBeGreaterThan(0);

    const inbound = new Map<string, string[]>();
    const noteInbound = (from: string, to: string) => {
      const list = inbound.get(to);
      if (list) list.push(from);
      else inbound.set(to, [from]);
    };
    for (const [from, edges] of ADJACENCY) {
      for (const edge of edges) noteInbound(from, edge.to);
    }
    // The ladder gets everyone home too: a landing always reaches its hub.
    for (const [from, tos] of ladderEdges()) {
      for (const to of tos) noteInbound(from, to);
    }

    const canGetHome = new Set<string>(waypoints);
    const queue = [...waypoints];
    while (queue.length) {
      for (const from of inbound.get(queue.pop()!) ?? []) {
        if (!canGetHome.has(from)) {
          canGetHome.add(from);
          queue.push(from);
        }
      }
    }

    for (const id of Object.keys(SPOTS)) {
      expect(
        canGetHome.has(id),
        `${id}: no route back to any waypoint — whoever walks in stays there`,
      ).toBe(true);
    }
  });

  it('every spot has map coordinates inside the canvas', () => {
    for (const spot of Object.values(SPOTS)) {
      expect(spot.map, `${spot.id} missing map coords`).toBeDefined();
      expect(spot.map!.x).toBeGreaterThanOrEqual(0);
      expect(spot.map!.x).toBeLessThanOrEqual(100);
      expect(spot.map!.y).toBeGreaterThanOrEqual(0);
      expect(spot.map!.y).toBeLessThanOrEqual(75);
    }
  });

  it('waypoints exist for fast travel', () => {
    const waypoints = Object.values(SPOTS).filter((s) => s.waypoint);
    expect(waypoints.length).toBeGreaterThanOrEqual(2);
  });

  it('spot activities and recipe lists resolve', () => {
    for (const spot of Object.values(SPOTS)) {
      for (const act of spot.activities) {
        if (act.kind === 'gather')
          expect(MATERIALS[act.material], `${spot.id} gathers ${act.material}`).toBeDefined();
        if (act.kind === 'train') {
          if (act.attr) expect(VALID_ATTRS.has(act.attr), `${spot.id} trains ${act.attr}`).toBe(true);
          // A train activity with neither `attr` nor `attrXp` would train
          // nothing at all — catch it here rather than in the tick loop.
          expect(
            Object.keys(attrXpWeights(act)).length,
            `${spot.id}/${act.id} trains nothing (needs attr or attrXp)`,
          ).toBeGreaterThan(0);
        }
        if (act.kind === 'train' || act.kind === 'gather' || act.kind === 'job' || act.kind === 'craft') {
          checkFactors(`${spot.id}/${act.id} speed`, act.speedFactors);
          checkFactors(`${spot.id}/${act.id} output`, act.outputFactors);
          for (const attr of Object.keys(act.attrXp ?? {})) {
            expect(VALID_ATTRS.has(attr as never), `${spot.id}/${act.id} attrXp ${attr}`).toBe(true);
          }
        }
      }
      for (const rid of spot.recipes ?? []) {
        expect(RECIPES[rid], `${spot.id} recipe ${rid}`).toBeDefined();
      }
      // A bench id that resolves to nothing renders nothing — silently, which
      // is the worst way for a typo to behave. 'spelltable' is furniture, not
      // a discipline: one table serving three schools, drawn by hand in
      // LocationPanel, so it is the one legal id with no DISCIPLINES entry.
      for (const bid of spot.benches ?? []) {
        expect(
          DISCIPLINES[bid] !== undefined || bid === 'spelltable',
          `${spot.id} bench '${bid}' is neither a discipline nor the spellcrafting table`,
        ).toBe(true);
      }
      for (const e of spot.encounters ?? []) {
        expect(MONSTERS[e.monsterId], `${spot.id} spawns ${e.monsterId}`).toBeDefined();
        expect(e.level[0]).toBeLessThanOrEqual(e.level[1]);
      }
    }
  });

  it('exploration finds resolve, sit inside the search, and pay something', () => {
    for (const spot of Object.values(SPOTS)) {
      expect(searchContentIssues(spot, { keyItems: KEY_ITEMS, items: ITEMS, materials: MATERIALS, runes: RUNES }), spot.id).toEqual([]);
      const finds = spot.finds ?? [];
      if (finds.length === 0) continue;
      // A find is a depth of search — without a search there is no depth.
      expect(spot.exploreTicks, `${spot.id} has finds but no exploreTicks`).toBeDefined();
      expect(
        spot.activities.some((a) => a.kind === 'explore'),
        `${spot.id} has finds but nothing to explore with`,
      ).toBe(true);

      const ids = new Set<string>();
      for (const f of finds) {
        const owner = `${spot.id}/${f.id}`;
        expect(ids.has(f.id), `${owner}: duplicate find id`).toBe(false);
        ids.add(f.id);
        // at = 0 would fire before a single tick of looking; > 1 never fires.
        expect(f.at, `${owner}: at must be > 0`).toBeGreaterThan(0);
        expect(f.at, `${owner}: at must be <= 1`).toBeLessThanOrEqual(1);

        const pays =
          f.material || f.item || f.keyItem || f.rune || f.gold || f.spot || f.path || f.skillXp || f.stat || f.desc;
        expect(pays, `${owner}: find yields nothing at all`).toBeTruthy();

        // The cross-room wire may only touch its own namespace — bumping
        // `kills` or `gather:` from a find would corrupt achievements. `set`
        // may additionally target slain:/fights: counters: that is how
        // content resets a once-boss or a spent fight budget.
        if (f.stat) {
          expect(
            f.stat.amount !== undefined && f.stat.set !== undefined,
            `${owner}: stat has both amount and set — pick one`,
          ).toBe(false);
          const resettable = f.stat.key.startsWith('slain:') || f.stat.key.startsWith('fights:');
          expect(
            f.stat.key.startsWith('flag:') || (f.stat.set !== undefined && resettable),
            `${owner}: stat key '${f.stat.key}' must be flag:* (or slain:*/fights:* with set)`,
          ).toBe(true);
        }

        if (f.material) {
          expect(MATERIALS[f.material.id], `${owner}: material ${f.material.id}`).toBeDefined();
          expect(f.material.qty ?? 1, `${owner}: material qty`).toBeGreaterThan(0);
        }
        if (f.item) expect(ITEMS[f.item], `${owner}: item ${f.item}`).toBeDefined();
        if (f.rune) expect(RUNES[f.rune], `${owner}: rune ${f.rune}`).toBeDefined();
        if (f.gold) {
          expect(f.gold[0], `${owner}: gold min`).toBeGreaterThanOrEqual(0);
          expect(f.gold[0], `${owner}: gold min > max`).toBeLessThanOrEqual(f.gold[1]);
        }
        if (f.spot) expect(SPOTS[f.spot], `${owner}: rumored spot ${f.spot}`).toBeDefined();
        if (f.path) {
          const edge = spot.connections.find((c) => c.to === f.path);
          expect(edge, `${owner}: opens a path to ${f.path} that isn't declared here`).toBeDefined();
          // Opening an already-visible edge early is a no-op the author almost
          // certainly didn't mean.
          expect(edge!.hidden, `${owner}: path to ${f.path} isn't hidden, so nothing opens`).toBe(true);
        }
        if (f.skillXp) {
          expect(f.skillXp.tags.length, `${owner}: skillXp needs at least one tag`).toBeGreaterThan(0);
          expect(f.skillXp.xp, `${owner}: skillXp xp`).toBeGreaterThan(0);
          // A tag no skill claims trains nothing and fails silently — the
          // easiest possible typo (naming the SKILL instead of its TAG).
          for (const tag of f.skillXp.tags) {
            expect(
              Object.values(SKILLS).some((s) => s.tags.includes(tag)),
              `${owner}: skill tag '${tag}' is claimed by no skill, so it trains nothing`,
            ).toBe(true);
          }
        }
      }
    }
  });

  it('every explore activity pays something — a find, or a hidden road to open', () => {
    // Mirrored live in forge/lib/validate.ts (both run floorRules.exploreIssues).
    // The shelf is not held to this: it is parked content, and the rule is
    // about what a player can reach today. As of 2026-10-23, 3 of its 14
    // explore spots would fail it (old_path, deep_forest_w, malgeri_peak).
    const shelved = new Set(Object.keys(SHELVED_WORLD.spots));
    const live = Object.values(SPOTS).filter((s) => !shelved.has(s.id));
    expect(exploreIssues(live).map((i) => `${i.spot}: ${i.message}`)).toEqual([]);
  });

  it('exploration gates sit inside the search and can be met', () => {
    for (const spot of Object.values(SPOTS)) {
      for (const gate of spot.exploreGates ?? []) {
        const owner = `${spot.id} gate@${gate.at}`;
        expect(spot.exploreTicks, `${owner}: gates need exploreTicks to measure against`).toBeDefined();
        expect(gate.at, `${owner}: at must be > 0`).toBeGreaterThan(0);
        // A gate AT 1 is legal (the last stretch); above it can never be hit.
        expect(gate.at, `${owner}: at must be <= 1`).toBeLessThanOrEqual(1);
        expect(gate.requires.length, `${owner}: a gate with no conditions blocks forever`).toBeGreaterThan(0);
        checkConditions(owner, gate.requires);
      }
      for (const f of spot.finds ?? []) {
        checkConditions(`${spot.id}/${f.id} requires`, f.requires);
      }
      for (const e of spot.encounters ?? []) {
        checkConditions(`${spot.id} encounter ${e.monsterId} requires`, e.requires);
      }
      for (const c of spot.connections) {
        checkConditions(`${spot.id} -> ${c.to} approach requires`, c.approach?.requires);
        checkConditions(`${spot.id} -> ${c.to} reveal`, c.revealWhen);
      }
    }
  });

  it('approaches lay real statuses, and fight budgets have fights to spend', () => {
    for (const spot of Object.values(SPOTS)) {
      for (const c of spot.connections) {
        if (!c.approach) continue;
        const owner = `${spot.id} -> ${c.to} approach`;
        const apps = [...(c.approach.enemies ?? []), ...(c.approach.self ?? [])];
        expect(apps.length, `${owner}: lays no statuses, so it does nothing`).toBeGreaterThan(0);
        for (const app of apps) {
          expect(STATUSES[app.id], `${owner}: unknown status '${app.id}'`).toBeDefined();
        }
      }
      if (spot.fightLimit !== undefined) {
        expect(spot.fightLimit, `${spot.id}: fightLimit must be positive`).toBeGreaterThan(0);
        expect(
          spot.encounters?.length ?? 0,
          `${spot.id}: a fight budget with no fights — fightLimit needs encounters`,
        ).toBeGreaterThan(0);
      }
      if (spot.caged) {
        // A menagerie with nothing in the cages teaches nothing; and a caged
        // fight budget would empty the cages for good, which is the opposite
        // of a syllabus.
        expect(
          spot.encounters?.length ?? 0,
          `${spot.id}: caged with no encounters — empty cages teach nothing`,
        ).toBeGreaterThan(0);
        expect(
          spot.fightLimit,
          `${spot.id}: caged spots must not carry a fightLimit — the cages restock`,
        ).toBeUndefined();
      }
      // Training spots (systems/training.ts): the keeper's care and dare.
      if (spot.healBetweenBouts) {
        expect(spot.healBetweenBouts.maxAttrTotal, `${spot.id}: healBetweenBouts needs a positive cap`).toBeGreaterThan(0);
      }
      if (spot.dare) {
        const d = spot.dare;
        expect(MONSTERS[d.monsterId], `${spot.id}: dares an unknown monster '${d.monsterId}'`).toBeDefined();
        expect(Number.isInteger(d.every) && d.every > 0, `${spot.id}: dare.every must be a positive whole number`).toBe(true);
        expect(d.level, `${spot.id}: dare.level must be at least 1`).toBeGreaterThanOrEqual(1);
        expect(spot.encounters?.length ?? 0, `${spot.id}: a dare with no fights to win toward it`).toBeGreaterThan(0);
        expect(spot.healBetweenBouts, `${spot.id}: a dare is offered only while the keeper tends you`).toBeDefined();
        expect(d.desc, `${spot.id}: the keeper's dare line (<spot>.dare.desc) is missing`).toBeTruthy();
      }
      // Ambush windows and the boss latch (SpotEncounter.window / .boss).
      for (const e of spot.encounters ?? []) {
        if (!e.window) continue;
        expect(e.window.min, `${spot.id}/${e.monsterId}: window.min must be > 0`).toBeGreaterThan(0);
        expect(
          e.window.max,
          `${spot.id}/${e.monsterId}: window needs min < max`,
        ).toBeGreaterThan(e.window.min);
      }
      // A rising line (SpotEncounter.levelRise): a share of 0 or less never
      // rises, and a ceiling under the authored range would pull the line
      // DOWN with nothing taken. Mirrored in forge/lib/validate.ts.
      for (const e of spot.encounters ?? []) {
        if (!e.levelRise) continue;
        expect(e.levelRise.share, `${spot.id}/${e.monsterId}: levelRise.share must be > 0`).toBeGreaterThan(0);
        expect(
          e.levelRise.ceiling,
          `${spot.id}/${e.monsterId}: levelRise.ceiling must be at least level[1]`,
        ).toBeGreaterThanOrEqual(e.level[1]);
      }
      const bosses = (spot.encounters ?? []).filter((e) => e.boss);
      if (bosses.length) {
        // COMPLETABILITY: the clock is not a wall (time passes on its own),
        // but a power window is — a player outside every window could never
        // latch boss:<spot>, and anything cleared on it would seal for good.
        expect(
          bosses.some((e) => !e.window),
          `${spot.id}: every boss hides behind a power window — keep one windowless keeper`,
        ).toBe(true);
      }
    }
  });

  it('every hidden path is reachable — by combing the spot or by a find', () => {
    // A hidden edge out of a spot with no explore activity could never be
    // revealed at all; a find is the only other key, so demand one.
    for (const spot of Object.values(SPOTS)) {
      const hidden = spot.connections.filter((c) => c.hidden);
      if (hidden.length === 0) continue;
      const canComb = spot.activities.some((a) => a.kind === 'explore');
      for (const c of hidden) {
        const opener = (spot.finds ?? []).some((f) => f.path === c.to);
        expect(
          canComb || opener,
          `${spot.id} -> ${c.to} is hidden with no way to reveal it`,
        ).toBe(true);
      }
    }
  });
});

describe('monsters', () => {
  it('damage types, resistances, and drop tables are valid', () => {
    for (const m of Object.values(MONSTERS)) {
      expect(VALID_DAMAGE_TYPES.has(m.damageType), `${m.id} damageType`).toBe(true);
      for (const key of Object.keys(m.resistances ?? {})) {
        expect(VALID_DAMAGE_TYPES.has(key), `${m.id} resistance ${key}`).toBe(true);
      }
      expect(m.loot.rolls).toBeGreaterThan(0);
      // Drought protection keys a drop's counter on kind+id (engine/mercy.ts),
      // so the same drop listed twice would escalate at double rate and land
      // above its authored share. Merge the lines and widen `qty` instead.
      const seen = new Set<string>();
      for (const e of m.loot.entries) {
        if (e.kind !== 'nothing') {
          const key = `${e.kind}:${e.id ?? ''}`;
          expect(seen.has(key), `${m.id} lists ${key} twice in one drop table`).toBe(false);
          seen.add(key);
        }
        expect(e.weight, `${m.id} drop weight`).toBeGreaterThan(0);
        if (e.kind === 'item') expect(ITEMS[e.id!], `${m.id} drops item ${e.id}`).toBeDefined();
        if (e.kind === 'material')
          expect(MATERIALS[e.id!], `${m.id} drops material ${e.id}`).toBeDefined();
        if (e.kind === 'rune') expect(RUNES[e.id!], `${m.id} drops rune ${e.id}`).toBeDefined();
        if (e.qty) expect(e.qty[0]).toBeLessThanOrEqual(e.qty[1]);
        // A method row (DropEntry.killedBy) names at least one real type:
        // `killedBy: []` matches no kill and is a row that never drops.
        // Mirrored in forge/lib/validate.ts.
        if (e.killedBy) {
          expect(e.killedBy.length, `${m.id} drops ${e.id ?? e.kind} on no kill: killedBy is empty`).toBeGreaterThan(0);
          for (const t of e.killedBy) expect(VALID_DAMAGE_TYPES.has(t), `${m.id} killedBy ${t}`).toBe(true);
        }
      }
    }
  });

  it('every tag is registered, and tier tags are never hand-written', () => {
    for (const m of Object.values(MONSTERS)) {
      for (const tag of m.tags) {
        const def = MONSTER_TAGS[tag];
        expect(def, `${m.id}: unregistered tag '${tag}'`).toBeDefined();
        // Tier and the derived traits come from the stats — authoring them by
        // hand lets the book contradict the monster.
        expect(
          ['tier'].includes(def.category) === false,
          `${m.id}: tag '${tag}' is derived from the def, don't declare it`,
        ).toBe(true);
      }
      const material = m.tags.filter((t) => MONSTER_TAGS[t]?.category === 'material');
      expect(material.length, `${m.id}: needs exactly one material tag`).toBe(1);
      const taxon = m.tags.filter((t) => MONSTER_TAGS[t]?.category === 'taxon');
      expect(taxon.length, `${m.id}: needs at least one taxonomy tag`).toBeGreaterThan(0);
    }
  });

  /*
   * The same silent failure `TAG_ARMOR` carries a warning about: a key that is
   * not a real tag never matches anything, forever, and the species it was
   * meant to harden simply stays soft with no error anywhere.
   */
  it('every TAG_RESISTANCES key is a registered monster tag', () => {
    for (const tag of Object.keys(TAG_RESISTANCES)) {
      expect(MONSTER_TAGS[tag], `TAG_RESISTANCES: unregistered tag '${tag}'`).toBeDefined();
    }
  });

  it('no monster carries two tags that disagree in sign about one damage type', () => {
    for (const m of Object.values(MONSTERS)) {
      const opinions = new Map<string, { tag: string; sign: number }>();
      for (const tag of m.tags) {
        for (const [type, rule] of Object.entries(TAG_RESISTANCES[tag] ?? {})) {
          const sign = Math.sign(rule!.base);
          if (sign === 0) continue;
          const seen = opinions.get(type);
          // Composition takes the strongest opinion, which is only meaningful
          // while the tags AGREE about the direction. Two that disagree make
          // the outcome depend on which happens to be larger, which is an
          // arithmetic accident rather than a design decision — so it is an
          // error here rather than something to discover in a fight.
          expect(
            seen === undefined || seen.sign === sign,
            `${m.id}: tags '${seen?.tag}' and '${tag}' disagree about ${type}`,
          ).toBe(true);
          if (!seen) opinions.set(type, { tag, sign });
        }
      }
    }
  });

  it('declared bestiary art exists on disk', () => {
    // Same glob the UI resolves portraits through, so a typo fails here first.
    const files = new Set(
      Object.keys(import.meta.glob('../src/assets/enemies/*.png')).map((p) => p.split('/').pop()!),
    );
    for (const m of Object.values(MONSTERS)) {
      if (!m.art) continue;
      expect(files.has(m.art), `${m.id}: missing art file ${m.art}`).toBe(true);
    }
  });
});

describe('bestiary', () => {
  it('facts are ordered by how hard they are to learn', () => {
    for (const fact of BESTIARY_FACTS) {
      expect(fact.minKills, `${fact.id}: minKills`).toBeGreaterThan(0);
      expect(fact.sureKills, `${fact.id}: sureKills below minKills`).toBeGreaterThanOrEqual(
        fact.minKills,
      );
      expect(fact.difficulty, `${fact.id}: difficulty`).toBeGreaterThan(0);
    }
    expect(new Set(BESTIARY_FACTS.map((f) => f.id)).size).toBe(BESTIARY_FACTS.length);
  });

  it('derived tags describe the monster the stats describe', () => {
    for (const def of Object.values(MONSTERS)) {
      const tags = monsterTags(def);
      expect(tags, `${def.id}: tier tag`).toContain(def.tier);
      expect(tags.includes('ranged'), `${def.id}: ranged tag`).toBe(def.range === 'ranged');
      expect(tags.includes('leader'), `${def.id}: leader tag`).toBe(!!def.escorts?.length);
      // Everything lands in exactly one element bucket, real or 'non_elemental'.
      const elements = tags.filter((t) => MONSTER_TAGS[t]?.category === 'element');
      expect(elements.length, `${def.id}: elements ${elements.join(',')}`).toBeGreaterThan(0);
    }
  });
});

describe('items & recipes', () => {
  it('item requirements resolve; katanas follow the sword-subgroup taxonomy', () => {
    for (const item of Object.values(ITEMS)) {
      checkConditions(`item ${item.id}`, item.requirements);
      if (item.bonusDamage)
        expect(VALID_DAMAGE_TYPES.has(item.bonusDamage.type), `${item.id} bonusDamage`).toBe(true);
      if (item.tags.includes('katana')) {
        expect(item.tags, `${item.id}: katana is a sword subgroup`).toContain('sword');
      }
    }
  });

  it('recipe costs, results, and gates resolve', () => {
    for (const r of Object.values(RECIPES)) {
      // Every route, not just the primary one — an alt with a typo'd material
      // is a craft that silently never becomes affordable.
      const ids = new Set<string>();
      for (const route of recipeRoutes(r)) {
        expect(ids.has(route.id), `${r.id}: duplicate route id '${route.id}'`).toBe(false);
        ids.add(route.id);
        expect(route.cost.length, `${r.id}/${route.id}: a route with no cost is free`).toBeGreaterThan(0);
        for (const c of route.cost) {
          expect(MATERIALS[c.id], `${r.id}/${route.id} cost ${c.id}`).toBeDefined();
          expect(c.qty, `${r.id}/${route.id} cost ${c.id} qty`).toBeGreaterThan(0);
        }
        expect(routeYield(r, route), `${r.id}/${route.id} yield`).toBeGreaterThan(0);
      }
      const pool = r.result.kind === 'item' ? ITEMS : r.result.kind === 'rune' ? RUNES : MATERIALS;
      expect(pool[r.result.id], `${r.id} result ${r.result.id}`).toBeDefined();
      checkConditions(`recipe ${r.id}`, r.unlock);
    }
  });

  it('every modifier in the game targets something real', () => {
    // One sweep over every Modifier-bearing registry. A scoped target
    // (`craftSpeed:leatherwork`) is only as good as the stat in front of the
    // colon — a typo there is invisible at runtime, since a scope nothing
    // matches simply never applies.
    const check = (owner: string, mods: { stat: string }[] | undefined) => {
      for (const m of mods ?? []) {
        expect(modTargetValid(m.stat), `${owner}: modifier targets unknown '${m.stat}'`).toBe(true);
      }
    };
    for (const s of Object.values(SKILLS)) {
      check(`skill ${s.id}`, s.effects);
      for (const t of s.tierNames ?? []) check(`skill ${s.id} tier`, (t as { bonus?: { stat: string }[] }).bonus);
    }
    for (const i of Object.values(ITEMS)) check(`item ${i.id}`, i.mods);
    for (const t of Object.values(TITLES)) {
      check(`title ${t.id} passive`, t.passive);
      check(`title ${t.id} equipped`, t.equipped);
    }
    for (const a of Object.values(ACHIEVEMENTS)) {
      for (const tier of a.tiers) check(`achievement ${a.id}`, tier.bonus);
    }
    for (const st of Object.values(STYLES)) check(`style ${st.id}`, st.mods);
  });

  it('every XP curve has a band, starting at level 1', () => {
    // An empty `progression: []` reads as "use the default" but isn't — it is
    // a curve with no bands, which used to throw on the first XP grant. A
    // curve that starts above 1 leaves the early levels with nothing to cost.
    for (const skill of Object.values(SKILLS)) {
      if (skill.progression === undefined) continue; // omitted = the real default
      expect(skill.progression.length, `${skill.id}: progression is empty — omit it to use the default`)
        .toBeGreaterThan(0);
      expect(skill.progression[0].from, `${skill.id}: first band must start at level 1`).toBe(1);
      for (const band of skill.progression) {
        expect(XP_BASE[band.base], `${skill.id}: unknown base tier '${band.base}'`).toBeDefined();
        expect(XP_RATE[band.rate], `${skill.id}: unknown growth rate '${band.rate}'`).toBeDefined();
      }
    }
  });

  it('a craft takes time — zero ticks would complete every tick forever', () => {
    for (const r of Object.values(RECIPES)) {
      expect(r.ticks, `${r.id}: ticks must be > 0`).toBeGreaterThan(0);
    }
  });
});

describe('skills & styles', () => {
  it('skill parents, categories, unlocks, and style tags resolve', () => {
    const validCategories = new Set(SKILL_CATEGORIES.map((c) => c.id));
    for (const def of Object.values(SKILLS)) {
      expect(validCategories.has(def.category), `${def.id} category`).toBe(true);
      if (def.parent) {
        expect(SKILLS[def.parent], `${def.id} parent`).toBeDefined();
        expect(SKILLS[def.parent].category, `${def.id} category matches parent`).toBe(def.category);
      }
      checkConditions(`skill ${def.id}`, def.unlock);
      for (const tag of def.tags) {
        if (tag.startsWith('style:'))
          expect(STYLES[tag.slice(6)], `${def.id} tag ${tag}`).toBeDefined();
        if (tag.startsWith('resist:'))
          expect(VALID_DAMAGE_TYPES.has(tag.slice(7)), `${def.id} tag ${tag}`).toBe(true);
      }
    }
  });

  it('every resistance walks poison\'s road', () => {
    // Mirrored live in forge/lib/validate.ts. The resistances are one family:
    // same XP curve, same tiered stat growth, whatever the element. Poison is
    // the reference member — retune IT and the family follows; retuning one
    // sibling alone is a bug this test exists to catch.
    const reference = SKILLS.poison_resistance;
    for (const def of Object.values(SKILLS)) {
      if (def.category !== 'resistance') continue;
      expect(def.progression, `${def.id} progression`).toEqual(reference.progression);
      expect(def.effects?.[0]?.levelCurve, `${def.id} effect curve`).toBe(
        reference.effects?.[0]?.levelCurve,
      );
    }
  });

  it('registry keys match their def ids', () => {
    // Lookups go through the KEY, so a def whose `id` disagrees is invisible to
    // every `{ type: 'skill', id }` reference — silently, at runtime.
    for (const [registry, defs] of Object.entries({ SKILLS, STYLES, ITEMS, MONSTERS, QUESTS, RUNES, PART_KINDS, ITEM_CLASSES })) {
      for (const [key, def] of Object.entries(defs as Record<string, { id: string }>)) {
        expect(def.id, `${registry}['${key}'] has id '${def.id}'`).toBe(key);
      }
    }
  });

  it('registry ids are lowercase snake_case', () => {
    // The mirror of the forge's rename gate (`idProblem` in
    // forge/lib/validate.ts). An id gets typed into counter keys, save files
    // and cross-references, so one casing everywhere is not a style choice —
    // `Woods_Edge` and `woods_edge` would be two different places to a save.
    const registries = {
      REGIONS, AREAS, SPOTS, NPCS, QUESTS, MONSTERS, ITEMS, MATERIALS, RECIPES,
      SKILLS, STYLES, STATUSES, RUNES, ACHIEVEMENTS, TITLES, DISCIPLINES,
      REAGENTS, TECHNIQUES, POSITIONS, GENERA, MAIN_GENES, MUTATIONS, LAYOUTS,
      DEITIES, MIRACLES, PART_KINDS, ITEM_CLASSES,
    };
    for (const [registry, defs] of Object.entries(registries)) {
      for (const rawKey of Object.keys(defs)) {
        // `ITEMS['forged:<classId>']` stubs are generated from ITEM_CLASSES: the
        // prefix is the one sanctioned colon, and the class id after it is
        // held to the same shape (and is checked as an ITEM_CLASSES key too).
        const key = registry === 'ITEMS' ? rawKey.replace(/^forged:/, '') : rawKey;
        expect(
          /^[a-z][a-z0-9_]*$/.test(key),
          `${registry}['${key}'] — ids are lowercase snake_case: a letter first, then letters, digits and _`,
        ).toBe(true);
      }
    }
  });

  it('every skill tag is emitted by something, so the skill can actually manifest', () => {
    // Everything the game can put into a `checkDiscovery` / `grantSkillXp` tag
    // list. A skill tagged with anything outside this set is unreachable: it
    // never appears in the Skills panel no matter what the player does.
    const emitted = new Set<string>([
      'training', // train activities
      'explore', 'gather', // gather + explore activities
      'travel', // arriving somewhere
      'craft', // craft cycles
      'combat', 'hunt', // any fight
      'social', // taking work from an NPC (quests.ts)
      'time', // lived time itself (chronosense.ts — manifest and trickle)
      'music', // ticks on the stage (music.ts tickPerformance — manifest and trickle)
      'darkness', // standing in true dark, outdoors (exposure.ts)
      'weather', // open skies, severe weather, and new regions (weathersense.ts)
      'unarmed', // implicit weapon family when bare-handed
      'spellcraft', 'magic', // working the spell table (spellcraft.ts, divine.ts)
      'arcane', 'divine', 'psionic', // each school's bench and its casts (combat.ts)
      'geneshaping', // harvesting genes off a kill, and the bench (mutagens.ts)
      // A DISCIPLINE BENCH NAMES ITS OWN TRADE. Each of these is emitted by the
      // bench that teaches it — cooking.ts, alchemy.ts, runecarving.ts — which
      // is how the skill manifests now that no craft skill claims the generic
      // 'craft' tag. ('smithing' and 'leatherwork' need no entry: they come off
      // the recipes, which the reachability scan below already walks.)
      'cooking', // the stove, the prep board and the whole cooking line
      'alchemy', // the alembic, and the still at my_home
      'runecarving', // the carving bench, and the carved slab in the ravine
      ...VALID_ATTRS, // train activities tag each attribute they train
    ]);
    for (const type of VALID_DAMAGE_TYPES) emitted.add(`resist:${type}`); // taking typed damage
    for (const id of Object.keys(STYLES)) emitted.add(`style:${id}`); // fighting in a stance
    // Speaking a sentence pays every word in it (arcane.ts grantWordXp), and
    // the word skills are generated FROM the lexicon — so the vocabulary is
    // its own proof that the tags are emitted.
    for (const id of Object.keys(ARCANE_WORDS)) emitted.add(wordTag(id));
    for (const item of Object.values(ITEMS)) for (const t of item.tags) emitted.add(t); // wielded gear
    // A recipe's tags ride the craft activity synthesized from it, so they
    // reach skills exactly like an authored activity tag — but only where the
    // recipe is actually listed, which is the same "is it reachable" question.
    for (const spot of Object.values(SPOTS)) {
      for (const rid of spot.recipes ?? []) {
        for (const t of RECIPES[rid]?.tags ?? []) emitted.add(t);
      }
      for (const act of spot.activities) {
        for (const t of (act as { tags?: string[] }).tags ?? []) emitted.add(t);
      }
    }

    for (const def of Object.values(SKILLS)) {
      for (const tag of def.tags) {
        expect(
          emitted.has(tag),
          `skill ${def.id}: nothing ever emits tag '${tag}' — it can never manifest from it`,
        ).toBe(true);
      }
    }
  });

  it('weapon-family bonuses only apply while that weapon is held', () => {
    const WEAPON_TAGS = new Set([
      'sword', 'greatsword', 'dagger', 'bow', 'blunt', 'staff', 'shield', 'unarmed',
    ]);
    /** The weapon family a skill belongs to — its own, or its nearest ancestor's. */
    const familyOf = (id: string): string | undefined => {
      const def = SKILLS[id];
      if (!def) return undefined;
      const own = def.tags.find((t) => WEAPON_TAGS.has(t));
      return own ?? (def.parent ? familyOf(def.parent) : undefined);
    };
    /**
     * A sub-family tag (katana ⊂ sword) is a legal, narrower gate: every item
     * carrying it also carries the family tag, so the bonus can never apply
     * outside the family.
     */
    const narrowerThan = (tag: string, family: string) => {
      const carriers = Object.values(ITEMS).filter((i) => i.tags.includes(tag));
      return carriers.length > 0 && carriers.every((i) => i.tags.includes(family));
    };
    // A school's bonus may instead require its style — narrower still, since a
    // school only ever takes over its stance while the right weapon is held.
    const gated = (mod: { requiresTag?: string; requiresStyle?: string }, family: string) =>
      mod.requiresTag === family ||
      (mod.requiresTag !== undefined && narrowerThan(mod.requiresTag, family)) ||
      (mod.requiresStyle !== undefined && STYLES[mod.requiresStyle] !== undefined);

    for (const def of Object.values(SKILLS)) {
      const family = familyOf(def.id);
      if (!family) continue;
      for (const mod of def.effects ?? []) {
        expect(gated(mod, family), `${def.id}: '${mod.stat}' must require ${family} or a style`).toBe(true);
      }
      for (const milestone of def.milestones ?? []) {
        for (const mod of milestone.bonus) {
          expect(gated(mod, family), `${def.id} milestone '${mod.stat}'`).toBe(true);
        }
      }
    }
  });

  it('style mods, replaces, and school links resolve', () => {
    const attrIds = new Set(ATTRIBUTE_LIST.map((a) => a.id as string));
    for (const style of Object.values(STYLES)) {
      for (const m of style.mods) {
        // Styles may only modify derived stats — attribute mods on styles
        // would create a resolution cycle (see docs/CONTENT_GUIDE.md).
        expect(attrIds.has(m.stat), `${style.id} mod targets attribute '${m.stat}'`).toBe(false);
      }
      checkConditions(`style ${style.id}`, style.unlock);
      if (style.replaces) {
        expect(STYLES[style.replaces], `${style.id} replaces`).toBeDefined();
        expect(STYLES[style.replaces].replaces, `${style.id} must replace a generic stance`).toBeUndefined();
        expect(style.skill, `${style.id} school style needs a skill link`).toBeDefined();
        expect(SKILLS[style.skill!], `${style.id} skill ${style.skill}`).toBeDefined();
      }
    }
  });
});

describe('npcs & quests', () => {
  it('every quest/NPC reference resolves and giver lists are bidirectional', () => {
    for (const npc of Object.values(NPCS)) {
      expect(SPOTS[npc.spotId], `${npc.id} spot`).toBeDefined();
      expect(npc.dialogue.length, `${npc.id} has dialogue`).toBeGreaterThan(0);
      for (const q of npc.quests) expect(QUESTS[q], `${npc.id} quest ${q}`).toBeDefined();
    }
    for (const npc of Object.values(NPCS)) {
      // A counter sells things that exist, at grades that exist, for prices
      // that clear the ware's worth — the runtime no-arbitrage floor
      // (buyPrice) covers charisma; this catches an authored bargain.
      if (!npc.shop) continue;
      expect(npc.shop.name, `${npc.id} shop name`).toBeTruthy();
      expect(npc.shop.lines.length, `${npc.id} shop has lines`).toBeGreaterThan(0);
      for (const line of npc.shop.lines) {
        const where = `${npc.id} sells ${line.kind} ${line.id}`;
        if (line.kind === 'item') expect(ITEMS[line.id], where).toBeDefined();
        else {
          expect(MATERIALS[line.id], where).toBeDefined();
          if (line.quality) expect(MATERIALS[line.id]?.graded, `${where}: quality on an ungraded ware`).toBe(true);
        }
        if (line.price !== undefined) expect(line.price, `${where}: price`).toBeGreaterThan(0);
        checkConditions(where, line.requires);
        expect(askingPrice(line, true), `${where}: asking price under value`).toBeGreaterThan(lineValue(line));
      }
    }
    for (const npc of Object.values(NPCS)) {
      // A teacher teaches techniques and schools that exist, each once
      // (systems/martial.ts). A school's skill waits on the lesson's stamp.
      const taught = (npc.teaches ?? []).map((l) => ('technique' in l ? l.technique : l.school));
      expect(new Set(taught).size, `${npc.id} teaches something twice`).toBe(taught.length);
      for (const lesson of npc.teaches ?? []) {
        if ('technique' in lesson) {
          expect(TECHNIQUES[lesson.technique], `${npc.id} teaches ${lesson.technique}`).toBeDefined();
        } else {
          const skill = SKILLS[lesson.school];
          expect(skill, `${npc.id} teaches school ${lesson.school}`).toBeDefined();
          expect(
            skill.unlock?.some((c) => c.type === 'stat' && c.key === schoolTaughtKey(lesson.school)),
            `${lesson.school} waits on ${schoolTaughtKey(lesson.school)}`,
          ).toBe(true);
        }
        checkConditions(`${npc.id} lesson ${'technique' in lesson ? lesson.technique : lesson.school}`, lesson.requires);
      }
    }
    for (const q of Object.values(QUESTS)) {
      expect(NPCS[q.giver], `${q.id} giver`).toBeDefined();
      expect(NPCS[q.giver].quests, `${q.id} listed by its giver`).toContain(q.id);
      checkConditions(`quest ${q.id}`, q.requirements);
      for (const o of q.objectives) {
        if (o.type === 'kill' && o.monsterId)
          expect(MONSTERS[o.monsterId], `${q.id} kill ${o.monsterId}`).toBeDefined();
        if (o.type === 'craft' && o.recipeId)
          expect(RECIPES[o.recipeId], `${q.id} craft ${o.recipeId}`).toBeDefined();
        if (o.type === 'craft' && o.discipline)
          expect(DISCIPLINES[o.discipline], `${q.id} craft discipline ${o.discipline}`).toBeDefined();
        if (o.type === 'collect')
          expect(MATERIALS[o.materialId], `${q.id} collect ${o.materialId}`).toBeDefined();
        if (o.type === 'reach') expect(SPOTS[o.spotId], `${q.id} reach ${o.spotId}`).toBeDefined();
        if (o.at) expect(SPOTS[o.at], `${q.id} objective at ${o.at}`).toBeDefined();
        if (o.type === 'talk') expect(NPCS[o.npcId], `${q.id} talk ${o.npcId}`).toBeDefined();
        if (o.type === 'stat') {
          expect(o.value, `${q.id} stat ${o.key}: the bar must be positive`).toBeGreaterThan(0);
          expect(
            statCounterValid(o.key),
            `${q.id}: stat counter '${o.key}' is never bumped`,
          ).toBe(true);
        }
      }
      for (const item of q.rewards.items ?? [])
        expect(ITEMS[item], `${q.id} reward item ${item}`).toBeDefined();
      for (const m of q.rewards.materials ?? [])
        expect(MATERIALS[m.id], `${q.id} reward material ${m.id}`).toBeDefined();
      for (const sx of q.rewards.skillXp ?? [])
        expect(SKILLS[sx.id], `${q.id} reward skill ${sx.id}`).toBeDefined();
    }
  });

  /**
   * COMPLETABILITY (docs/COMPLETABILITY.md, Invariant A: no reachable state is
   * terminal). Two mechanisms use a spawn up for good — `SpotEncounter.once`
   * (slain and gone) and `SpotDef.fightLimit` (the spot clears). Both are
   * reversible, but only by a find that writes the counter back down. A quest
   * whose every source is exhaustible and never restocked is one an
   * inattentive player can shut behind themselves, and nothing in the game
   * will ever tell them they did.
   *
   * Finds do not count as material sources: each fires once per save
   * (`state.finds`), so a find pays its quantity and never pays again.
   */
  it('no quest objective rests on a source that can run out', () => {
    const resets = new Set<string>();
    for (const spot of Object.values(SPOTS)) {
      for (const find of spot.finds ?? []) {
        if (find.stat?.set !== undefined) resets.add(find.stat.key);
      }
    }

    /** The counter that would use this spawn up, or null if it is endless. */
    const exhaustedBy = (spot: SpotDef, monsterId: string): string | null => {
      if (spot.encounters?.find((e) => e.monsterId === monsterId)?.once)
        return `slain:${spot.id}:${monsterId}`;
      if (spot.fightLimit !== undefined) return `fights:${spot.id}`;
      return null;
    };

    /** Can this monster be killed an unlimited number of times, somewhere? */
    const endlesslyKillable = (monsterId: string) =>
      Object.values(SPOTS).some((spot) => {
        if (!spot.encounters?.some((e) => e.monsterId === monsterId)) return false;
        const key = exhaustedBy(spot, monsterId);
        return key === null || resets.has(key);
      });

    for (const q of Object.values(QUESTS)) {
      for (const o of q.objectives) {
        if (o.type === 'kill' && o.monsterId) {
          expect(
            endlesslyKillable(o.monsterId),
            `${q.id}: every source of ${o.monsterId} can be used up, and no find restocks it`,
          ).toBe(true);
        }
        if (o.type === 'collect') {
          const gathered = Object.values(SPOTS).some((spot) =>
            spot.activities.some((a) => a.kind === 'gather' && a.material === o.materialId),
          );
          const dropped = Object.values(MONSTERS).some(
            (m) =>
              m.loot.entries.some((d) => d.kind === 'material' && d.id === o.materialId) &&
              endlesslyKillable(m.id),
          );
          expect(
            gathered || dropped,
            `${q.id}: ${o.materialId} has no repeatable source — a find pays once and never again`,
          ).toBe(true);
        }
      }
    }
  });
});

describe('status conditions', () => {
  it('every escalation, base form and successor names a real condition', () => {
    for (const def of STATUS_LIST) {
      for (const [field, id] of [
        ['escalatesTo', def.escalatesTo],
        ['baseForm', def.baseForm],
        ['expiresTo', def.expiresTo],
      ] as const) {
        if (id) expect(STATUSES[id], `${def.id}.${field} -> ${id}`).toBeTruthy();
      }
      for (const id of def.blockedBy ?? []) {
        expect(STATUSES[id], `${def.id}.blockedBy -> ${id}`).toBeTruthy();
      }
      // Mirrored in forge/lib/validate.ts.
      for (const id of def.immune?.ids ?? []) {
        expect(STATUSES[id], `${def.id}.immune -> ${id}`).toBeTruthy();
      }
      if (def.immune) {
        expect(
          (def.immune.ids?.length ?? 0) + (def.immune.elements?.length ?? 0),
          `${def.id}.immune names nothing`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('a condition that escalates on a cap actually declares one', () => {
    for (const def of STATUS_LIST) {
      if (def.stacking.onCap !== 'escalate') continue;
      expect(def.stacking.cap, `${def.id} escalates but has no cap`).toBeGreaterThan(0);
      expect(def.escalatesTo, `${def.id} escalates into nothing`).toBeTruthy();
    }
  });

  it('a chance-based escalation has room between its threshold and its cap', () => {
    // Mirrored in forge/lib/validate.ts §Statuses. `escalateFrom` is the point
    // where escalation starts being POSSIBLE and `cap` where it becomes
    // certain, so the gap between them is the entire mechanic: at or above the
    // cap the roll is a formality, and a threshold with no ladder above it is
    // just a deterministic escalation with extra words.
    for (const def of STATUS_LIST) {
      const from = def.stacking.escalateFrom;
      if (from === undefined) continue;
      expect(def.stacking.onCap, `${def.id}: escalateFrom without onCap: 'escalate'`).toBe(
        'escalate',
      );
      expect(def.escalatesTo, `${def.id}: escalateFrom but escalates into nothing`).toBeTruthy();
      expect(from, `${def.id}: escalateFrom must not be negative`).toBeGreaterThanOrEqual(0);
      expect(
        def.stacking.cap,
        `${def.id}: escalateFrom ${from} leaves no room below cap ${def.stacking.cap}`,
      ).toBeGreaterThan(from);
    }
  });

  it('a pierced dot pierces a share of itself, and no more', () => {
    // `pierce` is the fraction of the tick that ignores resistance AND
    // immunity. statuses.ts clamps it so a bad value cannot invert a tick, but
    // clamping silently is not the same as saying so: above 1 the author meant
    // something the field cannot express, and exactly 0 is just an omission
    // written the long way.
    for (const def of STATUS_LIST) {
      const pierce = def.dot?.pierce;
      if (pierce === undefined) continue;
      expect(pierce, `${def.id}.dot.pierce: 0 is the default — omit it instead`).toBeGreaterThan(0);
      expect(pierce, `${def.id}.dot.pierce is a share of the tick, so at most 1`).toBeLessThanOrEqual(1);
    }
  });

  it('a de-escalating removal has something milder to fall back to', () => {
    for (const def of STATUS_LIST) {
      for (const rule of def.removal ?? []) {
        if (rule.effect !== 'deescalate') continue;
        expect(def.baseForm, `${def.id} de-escalates into nothing`).toBeTruthy();
      }
    }
  });

  it('a condition with no timer can still be got rid of', () => {
    for (const def of STATUS_LIST) {
      if (def.duration !== null) continue;
      // Otherwise it is permanent with no cure — always a content mistake.
      // Paying itself off and detonating both count as ways out, and so does
      // a surplus ledger that sheds itself (the ledger IS such a condition's
      // clock — see StatusDef.surplus.decayShare).
      const escapable =
        (def.removal?.length ?? 0) > 0 ||
        def.ceilingDecay !== undefined ||
        def.detonate !== undefined ||
        def.drains !== undefined ||
        def.surplus?.decayShare !== undefined;
      expect(escapable, `${def.id} lasts forever with no way out`).toBe(true);
    }
  });

  it('a way out that only exists in a fight cannot be the ONLY way out', () => {
    // `barFill` and `barDeplete` are fired from tickCombat and nowhere else,
    // so a timerless condition whose only exit is one of them survives being
    // knocked out — and then rides into every future fight. That is how a
    // permanent Shocked (bar running backwards, forever) happened.
    const COMBAT_ONLY = new Set(['barFill', 'barDeplete']);
    for (const def of STATUS_LIST) {
      if (def.duration !== null) continue;
      const removals = def.removal ?? [];
      if (removals.length === 0) continue; // covered by the rule above
      if (!removals.every((r) => COMBAT_ONLY.has(r.on))) continue;
      // Every exit is combat-only: the fight ending must also release it.
      const otherExit =
        def.ceilingDecay !== undefined ||
        def.detonate !== undefined ||
        def.drains !== undefined ||
        def.surplus?.decayShare !== undefined;
      expect(
        otherExit,
        `${def.id}: every removal is combat-only (${removals.map((r) => r.on).join(', ')}) — ` +
          `add { on: 'combatEnd' } or it outlives the fight`,
      ).toBe(true);
    }
  });

  it('condition modifiers target real stats, and ceilings real pools', () => {
    for (const def of STATUS_LIST) {
      for (const mod of def.mods ?? []) {
        expect(modTargetValid(mod.stat), `${def.id} modifies unknown '${mod.stat}'`).toBe(true);
      }
      for (const c of def.ceilings ?? []) {
        expect(RESOURCES[c.resource], `${def.id} seals unknown pool '${c.resource}'`).toBeTruthy();
      }
      if (def.ceilingFromSpend) {
        expect(RESOURCES[def.ceilingFromSpend.resource]).toBeTruthy();
      }
    }
  });

  it('everything a monster inflicts exists', () => {
    for (const def of Object.values(MONSTERS)) {
      for (const app of def.inflicts ?? []) {
        expect(STATUSES[app.id], `${def.id} inflicts unknown '${app.id}'`).toBeTruthy();
        if (app.chance !== undefined) {
          expect(app.chance).toBeGreaterThan(0);
          expect(app.chance).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('every harmful condition says what resists it: an element, or unresistable, never both', () => {
    // Mirrored in forge/lib/validate.ts, which runs the same function against the
    // staged copy. Mutation cases for each rule are in tests/conditionResist.test.ts.
    // Titles are checked too: a title may not switch off an unresistable condition.
    const problems = resistanceProblems(STATUSES, TITLES).map((p) => `${p.kind} ${p.id}: ${p.message}`);
    expect(problems).toEqual([]);
  });
});

describe('monster penetration', () => {
  it('is a share on every tier', () => {
    // The tier table is code, not forge data, so this is not mirrored in the forge.
    for (const tier of Object.values(TIERS)) {
      expect(tier.penetration, `${tier.id} penetration`).toBeGreaterThanOrEqual(0);
      expect(tier.penetration, `${tier.id} penetration`).toBeLessThanOrEqual(1);
    }
  });

  it('is zero for everything that can appear on floors 1 to 3, and a share elsewhere', () => {
    // Mirrored in forge/lib/validate.ts, which runs the same function against the
    // staged copy. Mutation cases are in tests/conditionResist.test.ts.
    const problems = penetrationProblems(MONSTERS, TIERS, SPOTS, FLOORS).map((p) => p.message);
    expect(problems).toEqual([]);
  });
});

describe('crafting disciplines', () => {
  it('every discipline names a real skill', () => {
    for (const disc of DISCIPLINE_LIST) {
      expect(SKILLS[disc.skill], `${disc.id} -> ${disc.skill}`).toBeTruthy();
    }
  });

  it('every MATERIAL slot accepts a tag some material actually carries', () => {
    const known = new Set(Object.values(MATERIALS).flatMap((m) => m.craftTags ?? []));
    for (const disc of DISCIPLINE_LIST) {
      for (const slot of disc.slots) {
        // Design slots draw from a discipline's own catalogue and tool slots
        // from implements; neither is matched against material tags.
        if ((slot.picks ?? 'material') !== 'material') continue;
        for (const tag of slot.accepts) {
          expect(known.has(tag), `${disc.id}.${slot.id} accepts unknown tag '${tag}'`).toBe(true);
        }
      }
    }
  });

  it('a discipline gives the player something to decide', () => {
    // Four legitimate shapes: choose a DESIGN (runecarving picks patterns),
    // choose INGREDIENTS whose combination selects among many outcomes
    // (cooking), choose an ORDER (alchemy — one outcome, but the sequence it is
    // read in is the decision), or choose a SUBJECT (mutagens — one slot and no
    // outcome table, because the decision is which of the things you hold is
    // worth two copies and a pile of biomatter), or choose PARTS (the anvil — no
    // outcome table either, because the proportions of the parts name the
    // product). A discipline with none of the five is a button, not a bench.
    for (const disc of DISCIPLINE_LIST) {
      const designs = disc.slots.filter((s) => s.picks === 'design');
      const choosable =
        designs.length > 0 ||
        disc.outcomes.length > 1 ||
        !!disc.ordered ||
        !!disc.refines ||
        !!disc.assembles;
      expect(choosable, `${disc.id} has nothing to decide`).toBe(true);
      // An ordered bench needs room for an order to exist in the first place.
      if (disc.ordered) {
        expect(
          disc.slots.filter((s) => (s.unlockLevel ?? 0) === 0).length,
          `${disc.id} is ordered but has no sequence to arrange`,
        ).toBeGreaterThan(1);
      }
      if (designs.length) {
        expect(
          designs.some((s) => (s.unlockLevel ?? 0) === 0 && !s.optional),
          `${disc.id} has no design slot open from the start`,
        ).toBe(true);
      }
    }
  });

  it('every outcome produces something that exists', () => {
    for (const disc of DISCIPLINE_LIST) {
      for (const o of disc.outcomes) {
        if (o.result.kind === 'material') {
          expect(MATERIALS[o.result.id], `${disc.id}/${o.id} -> ${o.result.id}`).toBeTruthy();
        } else if (o.result.kind === 'item') {
          expect(ITEMS[o.result.id], `${disc.id}/${o.id} -> ${o.result.id}`).toBeTruthy();
        }
      }
    }
  });

  it('a discipline whose outcomes compete has a catch-all', () => {
    // Otherwise a combination can be legal to lay out and produce nothing,
    // which reads as a bug however it is worded.
    for (const disc of DISCIPLINE_LIST) {
      if (disc.outcomes.length < 2) continue;
      const loosest = Math.min(...disc.outcomes.map((o) => o.requires.length));
      expect(loosest, `${disc.id} has no broad fallback outcome`).toBe(1);
    }
  });

  it('heat windows sit on a timed bench, over a fallback, and can be reached', () => {
    // Mirrored in forge/lib/validate.ts, which runs the same function against
    // the staged copy. A windowed outcome on an untimed bench never matches; one
    // with no window-less fallback makes a player outside the window (or without
    // the card) cook something other than what the same basket makes today; one
    // no timeline option can land in is a dish nobody can make.
    const problems = DISCIPLINE_LIST.flatMap((disc) =>
      heatWindowProblems(disc, MATERIALS).map((p) => p.message),
    );
    expect(problems).toEqual([]);
  });

  it('food and signatures: exactly what a cooking bench makes is food, and each dish has a signature', () => {
    // Mirrored in forge/lib/validate.ts, which runs the same function against the
    // staged copy. A flask marked food would be scaled by the cook's skill; a dish
    // left unmarked would not be; a signature that repeats the dish's own grant
    // (or names no condition) does nothing; food that grants a permanent or a
    // harmful condition (the failure dish aside) would last forever or hurt, and
    // the cook's skill would amplify it.
    const problems = foodProblems(DISCIPLINE_LIST, MATERIALS, STATUSES).map((p) => p.message);
    expect(problems).toEqual([]);
  });

  it('tools are never consumed by the craft', () => {
    for (const disc of DISCIPLINE_LIST) {
      for (const slot of disc.slots) {
        if (slot.picks !== 'tool') continue;
        expect(slot.consumed ?? false, `${disc.id}.${slot.id} would eat the tool`).toBe(false);
      }
    }
  });

  it('a discipline has exactly one base slot, always open', () => {
    for (const disc of DISCIPLINE_LIST) {
      const bases = disc.slots.filter((s) => s.role === 'base');
      expect(bases.length, `${disc.id} base slots`).toBe(1);
      expect(bases[0].unlockLevel ?? 0, `${disc.id} base slot is gated`).toBe(0);
    }
  });

  it('outcomes require tags that some material can supply', () => {
    const known = new Set(Object.values(MATERIALS).flatMap((m) => m.craftTags ?? []));
    for (const disc of DISCIPLINE_LIST) {
      for (const outcome of disc.outcomes) {
        for (const req of outcome.requires) {
          expect(known.has(req.tag), `${disc.id}/${outcome.id} needs unknown tag '${req.tag}'`).toBe(true);
        }
      }
    }
  });

  it('graded materials are either usable in a discipline or usable outright', () => {
    for (const mat of Object.values(MATERIALS)) {
      if (!mat.graded) continue;
      const purposeful = (mat.craftTags?.length ?? 0) > 0 || !!mat.consumable;
      expect(purposeful, `${mat.id} is graded but nothing can do anything with it`).toBe(true);
    }
  });

  it('every consumable restores a real pool and grants real conditions', () => {
    for (const mat of Object.values(MATERIALS)) {
      const spec = mat.consumable;
      if (!spec) continue;
      for (const r of spec.restore ?? []) {
        expect(RESOURCES[r.resource], `${mat.id} restores unknown '${r.resource}'`).toBeTruthy();
      }
      for (const g of spec.grants ?? []) {
        expect(STATUSES[g.id], `${mat.id} grants unknown '${g.id}'`).toBeTruthy();
      }
      const doesSomething =
        (spec.restore?.length ?? 0) + (spec.grants?.length ?? 0) + (spec.cures?.length ?? 0) > 0 ||
        isCard(spec);
      expect(doesSomething, `${mat.id} is usable but does nothing`).toBe(true);
    }
  });
});

describe('modular smithing content', () => {
  // The rules live in systems/assemblyValidation.ts and are mirrored live in
  // forge/lib/validate.ts by calling the same function. Run once here with the
  // exhaustive enumeration (every part × every accepted material × both head
  // slots × every quantity, ~1.3M placements); one `it` per rule so a failure
  // names the rule.
  let cached: ReturnType<typeof smithingContentIssues> | undefined;
  const issuesOf = () => {
    if (!cached) {
      cached = smithingContentIssues(
        { parts: PART_KINDS, classes: ITEM_CLASSES, materials: MATERIALS, recipes: RECIPES },
        { materials: 'all' },
      );
    }
    return cached;
  };
  const report = (rule: string) =>
    issuesOf()
      .filter((i) => i.rule === rule)
      .map((i) => `${i.kind} ${i.id}: ${i.message}`);

  // The first test pays for `issuesOf()` (about 3 s alone, more on a busy
  // machine), so it gets a longer limit than vitest's 5 s default.
  it('parts, smith profiles and class rules are well formed', () => {
    expect(report('parts')).toEqual([]);
    expect(report('materials')).toEqual([]);
    expect(report('classes')).toEqual([]);
  }, 30_000);

  it('every class exemplar resolves to its own class', () => {
    expect(report('exemplars')).toEqual([]);
    for (const cls of Object.values(ITEM_CLASSES)) expect(cls.exemplar, `${cls.id} has no exemplar`).toBeDefined();
  });

  it('every class is reachable from the catalogue', () => {
    // A class no placement can produce is a dead rule, or a part that was
    // never authored (the odachi waited on the long curved blade).
    expect(report('reachable')).toEqual([]);
  });

  it('the resolver is total: the last class matches everything and no placement falls through', () => {
    expect(report('last-class')).toEqual([]);
    expect(report('total')).toEqual([]);
  });

  it("a recipe's listed cost equals the cost its parts derive", () => {
    expect(report('recipes')).toEqual([]);
    // And the lint has something to chew on: the recipe lines of slice 1.
    const placed = Object.values(RECIPES).filter((r) => r.forge).map((r) => r.id);
    expect(placed.sort()).toEqual(
      ['iron_breastplate', 'iron_dagger', 'iron_sword', 'katana', 'parrying_dagger', 'rapier'].sort(),
    );
  });

  it('every class has a generated item stub, and the stub carries no numbers', () => {
    for (const cls of Object.values(ITEM_CLASSES)) {
      const stub = ITEMS[`forged:${cls.id}`];
      expect(stub, `ITEMS['forged:${cls.id}']`).toBeDefined();
      expect(stub.slot, cls.id).toBe(cls.slot);
      expect(stub.tags, cls.id).toEqual(cls.tags);
      expect(stub.mods, `${cls.id}: a stub grants nothing`).toEqual([]);
    }
  });

  it('forging is the Forges bench; the Cold Counter stays in the kitchen', () => {
    expect(SPOTS.the_forges.benches).toEqual(['forging']);
    expect(DISCIPLINES.forging.assembles).toBe(true);
    expect(DISCIPLINES.forging.skill).toBe('smithing');
    expect(DISCIPLINES.assembling.assembles).toBeUndefined();
  });

  it('the Forges list the five smithing recipes that had no counter', () => {
    for (const id of ['rapier', 'parrying_dagger', 'katana', 'uchigatana', 'iron_breastplate']) {
      expect(SPOTS.the_forges.recipes, id).toContain(id);
    }
  });
});

describe('recipe cards and rare finds', () => {
  const recipeIds = new Set(
    Object.values(DISCIPLINES).flatMap((d) => d.outcomes.map((o) => o.recipe).filter((r): r is string => !!r)),
  );
  const dropped = new Set(
    Object.values(SPOTS).flatMap((s) => s.activities.flatMap((a) => ('drops' in a ? a.drops ?? [] : []).map((d) => d.material))),
  );
  const sold = new Set(
    Object.values(NPCS).flatMap((n) => (n.shop?.lines ?? []).filter((l) => l.kind === 'material').map((l) => l.id)),
  );

  it('every card teaches a learned dish, every dish has a card, every card can be had', () => {
    const taught = new Set<string>();
    for (const mat of Object.values(MATERIALS)) {
      const t = mat.consumable?.teaches;
      if (!t) continue;
      taught.add(t);
      expect(recipeIds.has(t), `${mat.id} teaches '${t}', which no bench outcome names`).toBe(true);
      expect(sold.has(mat.id) || dropped.has(mat.id), `${mat.id}: no counter sells it and no activity drops it`).toBe(true);
    }
    for (const id of recipeIds) expect(taught.has(id), `learned dish '${id}' has no card`).toBe(true);
  });

  it('every card names a real target and can be had', () => {
    for (const mat of Object.values(MATERIALS)) {
      const spec = mat.consumable;
      if (!isCard(spec)) continue;
      if (spec!.unlocksWord) expect(ARCANE_WORDS[spec!.unlocksWord], `${mat.id}: unknown word`).toBeDefined();
      if (spec!.teachesTechnique) expect(TECHNIQUES[spec!.teachesTechnique], `${mat.id}: unknown technique`).toBeDefined();
      if (spec!.stamps) expect(spec!.stamps.startsWith('flag:'), `${mat.id}: stamps must name a flag: counter`).toBe(true);
      expect(mat.graded, `${mat.id}: cards are ungraded`).toBeFalsy();
      expect(sold.has(mat.id) || dropped.has(mat.id), `${mat.id}: no counter sells it and no activity drops it`).toBe(true);
    }
  });

  it('a secret recipe has conditions to meet, or it would never appear', () => {
    for (const r of Object.values(RECIPES)) {
      if (!r.secret) continue;
      expect(r.unlock?.length ?? 0, `${r.id}: secret with no unlock`).toBeGreaterThan(0);
    }
  });

  it('activity drops name real materials, on kinds that roll them, at sane chances', () => {
    for (const spot of Object.values(SPOTS)) {
      for (const act of spot.activities) {
        const drops = 'drops' in act ? act.drops : undefined;
        if (!drops?.length) continue;
        expect(['train', 'gather', 'job'], `${spot.id}/${act.id}: only train/gather/job roll drops`).toContain(act.kind);
        for (const d of drops) {
          expect(MATERIALS[d.material], `${spot.id}/${act.id}: unknown drop '${d.material}'`).toBeDefined();
          expect(d.chance > 0 && d.chance <= 1, `${spot.id}/${act.id}: chance must be in (0, 1]`).toBe(true);
          if (d.quality) expect(MATERIALS[d.material]?.graded, `${spot.id}/${act.id}: quality on an ungraded drop`).toBe(true);
          if (d.rarer !== undefined) expect(d.rarer, `${spot.id}/${act.id}: rarer must be > 1`).toBeGreaterThan(1);
          if (d.qty !== undefined) expect(d.qty, `${spot.id}/${act.id}: qty must be >= 1`).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });
});

describe('runecarving content', () => {
  it('every adornment is a real material, tagged as an inlay', () => {
    for (const id of Object.keys(RUNE_ADORNMENTS)) {
      const mat = MATERIALS[id];
      expect(mat, `adornment '${id}' is not a material`).toBeTruthy();
      const usable = ['inlay', 'pigment', 'gem'].some((t) => (mat!.craftTags ?? []).includes(t));
      expect(usable, `${id} sits in no runecarving station`).toBe(true);
      expect(mat!.graded, `${id} must be graded to be adorned with`).toBe(true);
    }
  });

  it('every named work names a real pattern and real adornments', () => {
    for (const named of NAMED_RUNES) {
      for (const pid of named.patterns) {
        expect(RUNE_PATTERNS[pid], `${named.id} -> ${pid}`).toBeTruthy();
      }
      expect(named.patterns.length, `${named.id} names no pattern`).toBeGreaterThan(0);
      for (const a of named.adornments) {
        expect(RUNE_ADORNMENTS[a], `${named.id} adorned with unknown '${a}'`).toBeTruthy();
      }
      expect(named.adornments.length, `${named.id} has no adornments to identify it`).toBeGreaterThan(0);
    }
  });

  it('every named work can actually be laid out on the bench', () => {
    // A recipe needing two inlays when the bench has one inlay station is
    // unbuildable, and nothing else would ever tell you.
    const carving = DISCIPLINE_LIST.find((d) => d.id === 'runecarving')!;
    const capacity = new Map<string, number>();
    for (const slot of carving.slots) {
      if ((slot.picks ?? 'material') !== 'material' || slot.role !== 'adornment') continue;
      for (const tag of slot.accepts) capacity.set(tag, (capacity.get(tag) ?? 0) + 1);
    }

    /** Can these adornments be assigned to distinct stations? */
    const fits = (ids: string[]): boolean => {
      const left = new Map(capacity);
      // Most-constrained first: anything with only one possible station.
      const options = ids
        .map((id) => (MATERIALS[id]?.craftTags ?? []).filter((t) => left.has(t)))
        .sort((a, b) => a.length - b.length);
      for (const opts of options) {
        const pick = opts.find((t) => (left.get(t) ?? 0) > 0);
        if (!pick) return false;
        left.set(pick, left.get(pick)! - 1);
      }
      return true;
    };

    for (const named of NAMED_RUNES) {
      expect(fits(named.adornments), `${named.id} cannot be laid out on the bench`).toBe(true);
      expect(
        named.patterns.length <= carving.slots.filter((s) => s.picks === 'design').length,
        `${named.id} needs more cuts than the slab has`,
      ).toBe(true);
    }
  });

  it('no two named works claim the same recipe', () => {
    const seen = new Set<string>();
    for (const named of NAMED_RUNES) {
      const key = `${[...named.patterns].sort().join(',')}|${[...named.adornments].sort().join('+')}`;
      expect(seen.has(key), `${named.id} duplicates another recipe`).toBe(false);
      seen.add(key);
    }
  });
});

describe('runes', () => {
  it('every rune defines at least one non-inert context', () => {
    for (const rune of Object.values(RUNES)) {
      const contexts = Object.values(rune.effects);
      const live = contexts.some(
        (e) => (e.mods?.length ?? 0) > 0 || e.bonusDamage || e.bonusDamagePct,
      );
      expect(live, `${rune.id} has no effect anywhere`).toBe(true);
    }
  });
});

describe('achievements & super-attributes', () => {
  it('achievement statKeys are counters some system actually bumps', () => {
    for (const a of Object.values(ACHIEVEMENTS)) {
      expect(statCounterValid(a.statKey), `${a.id}: statKey '${a.statKey}' is never bumped`).toBe(true);
      let prev = 0;
      for (const tier of a.tiers) {
        expect(tier.threshold, `${a.id} thresholds ascend`).toBeGreaterThan(prev);
        prev = tier.threshold;
      }
    }
  });

  it('super-attribute components and unlocks resolve', () => {
    for (const s of Object.values(SUPERATTRS)) {
      for (const comp of s.components) expect(VALID_ATTRS.has(comp), `${s.id} ${comp}`).toBe(true);
      checkConditions(`superattr ${s.id}`, s.unlock);
    }
  });
});

describe('music content', () => {
  // Mirrored live in forge/lib/validate.ts §Music — this suite is the authority.
  const AXES = new Set(MUSIC_AXES);
  const CONTOURS = new Set(['rising', 'falling', 'arch', 'valley', 'level', 'undulating']);
  const CADENCES = new Set(['closed', 'open', 'deceptive', 'wandering', 'silent']);

  it('archetype targets are reachable coordinates on declared axes', () => {
    for (const arch of Object.values(MUSIC_ARCHETYPES)) {
      const axes = Object.keys(arch.target);
      expect(axes.length, `${arch.id} has no target axes — it would match everything equally`).toBeGreaterThan(0);
      // Pace is the one axis not read off the notes, so an archetype that
      // stays silent about it would be judged on the notes alone — exactly
      // the confusion (dirge vs reel) the axis was added to end.
      expect(arch.target.pace, `${arch.id} states no pace — how fast is it?`).toBeDefined();
      for (const [axis, v] of Object.entries(arch.target)) {
        expect(AXES.has(axis as MusicAxis), `${arch.id}: unknown axis '${axis}'`).toBe(true);
        expect(v, `${arch.id}: target.${axis} below 0`).toBeGreaterThanOrEqual(0);
        expect(v, `${arch.id}: target.${axis} above 1`).toBeLessThanOrEqual(1);
      }
      for (const [axis, w] of Object.entries(arch.weights ?? {})) {
        expect(AXES.has(axis as MusicAxis), `${arch.id}: unknown weight axis '${axis}'`).toBe(true);
        expect(w, `${arch.id}: weights.${axis} must be positive`).toBeGreaterThan(0);
        expect(
          arch.target[axis as MusicAxis],
          `${arch.id}: weights.${axis} has no matching target`,
        ).toBeDefined();
      }
      for (const c of arch.contours ?? []) {
        expect(CONTOURS.has(c), `${arch.id}: unknown contour '${c}'`).toBe(true);
      }
      for (const c of arch.cadences ?? []) {
        expect(CADENCES.has(c), `${arch.id}: unknown cadence '${c}'`).toBe(true);
      }
    }
  });

  // The CALIBRATION rules. These are content legality, not taste: an archetype
  // breaking one of them cannot be reached by writing music on purpose, and
  // will instead be won by dice. tests/music-identity.test.ts is what proves
  // each archetype is reachable; these four are what stop a new one being
  // authored into the noise cloud in the first place.
  it('archetypes are calibrated against noise, not into it', () => {
    for (const arch of Object.values(MUSIC_ARCHETYPES)) {
      // Random sheets sit at syncopation ~0.333, rhythmEntropy ~0.808 and
      // motif ~0.157; written music at ~0.000, ~0.20 and ~0.70. Those three
      // axes are the only reliable deliberateness detectors in the system, so
      // an archetype that stays silent about them is judged on axes dice can
      // fake just as well as a composer.
      for (const axis of ['motif', 'rhythmEntropy', 'syncopation'] as const) {
        expect(arch.target[axis], `${arch.id} declares no ${axis} — dice will reach it`).toBeDefined();
      }
      // The most syncopated thing a human can write on this grid measures
      // 0.267; the random median is 0.333. A target up there is a noise magnet
      // — which is exactly what shipped `reel: syncopation 0.30` was.
      expect(arch.target.syncopation ?? 0, `${arch.id}: syncopation target sits in the noise cloud`).toBeLessThanOrEqual(0.15);
      // The shipped duration palette tops out near 0.65, so a higher target is
      // a coordinate no sheet can occupy.
      expect(arch.target.rhythmEntropy ?? 0, `${arch.id}: rhythmEntropy target is unreachable`).toBeLessThanOrEqual(0.6);
      // 5,944 of 6,000 random sheets read `undulating`. Claiming it is not a
      // hint about shape, it is a flat purity bonus handed to dice.
      expect(arch.contours ?? [], `${arch.id} claims the default contour`).not.toContain('undulating');
    }
  });

  it('a scale either declares an honest mode or none at all', () => {
    for (const scale of Object.values(MUSIC_SCALES)) {
      if (scale.mode === undefined) continue;
      expect(['major', 'minor'], `${scale.id}: mode '${scale.mode}'`).toContain(scale.mode);
    }
  });

  it('conferred effects point at real conditions with positive scaling', () => {
    for (const arch of Object.values(MUSIC_ARCHETYPES)) {
      const c = arch.confers;
      if (!c) continue;
      expect(STATUSES[c.status], `${arch.id}: confers unknown status '${c.status}'`).toBeDefined();
      expect(c.perPower, `${arch.id}: confers.perPower must be positive`).toBeGreaterThan(0);
      if (c.duration !== undefined) {
        expect(c.duration, `${arch.id}: confers.duration must be positive`).toBeGreaterThan(0);
      }
    }
  });

  it('scales open on the tonic and ascend within the octave', () => {
    for (const scale of Object.values(MUSIC_SCALES)) {
      expect(scale.degrees[0], `${scale.id} must start at 0`).toBe(0);
      for (let i = 0; i < scale.degrees.length; i++) {
        const d = scale.degrees[i];
        expect(Number.isInteger(d), `${scale.id}: degree ${d} not an integer`).toBe(true);
        expect(d, `${scale.id}: degree below 0`).toBeGreaterThanOrEqual(0);
        expect(d, `${scale.id}: degree above 11`).toBeLessThanOrEqual(11);
        if (i > 0) expect(d, `${scale.id}: degrees must ascend strictly`).toBeGreaterThan(scale.degrees[i - 1]);
      }
    }
  });

  it('every duration is a whole number of grid units that fits a common bar', () => {
    // Divisibility is deliberately NOT required — a dotted quarter (90) does
    // not divide 240 and never will; what matters is grid integrality.
    for (const def of Object.values(NOTE_DURATIONS)) {
      expect(Number.isInteger(def.units), `${def.id}: units must be integer`).toBe(true);
      expect(def.units, `${def.id}: units must be positive`).toBeGreaterThan(0);
      expect(def.units, `${def.id}: longer than a common-time bar`).toBeLessThanOrEqual(BAR_UNITS);
      expect(def.unlockLevel, `${def.id}: unlockLevel must be 0+`).toBeGreaterThanOrEqual(0);
    }
    // The two starting durations the whole system opens with.
    expect(NOTE_DURATIONS.whole.unlockLevel).toBe(0);
    expect(NOTE_DURATIONS.half.unlockLevel).toBe(0);
  });

  it('meters are whole beats with accents on beat boundaries', () => {
    // Mirrored live in forge/lib/validate.ts §Music.
    expect(MUSIC_METERS.common, 'common time must always exist — sheets default to it').toBeDefined();
    expect(MUSIC_METERS.common.unlockLevel).toBe(0);
    for (const m of Object.values(MUSIC_METERS)) {
      expect(Number.isInteger(m.beats) && m.beats >= 1, `${m.id}: beats`).toBe(true);
      expect(Number.isInteger(m.beatUnits) && m.beatUnits >= 1, `${m.id}: beatUnits`).toBe(true);
      const cap = m.beats * m.beatUnits;
      for (const a of m.accents) {
        expect(a > 0 && a < cap, `${m.id}: accent ${a} outside the bar`).toBe(true);
        expect(a % m.beatUnits, `${m.id}: accent ${a} is off the beat`).toBe(0);
      }
      expect(m.unlockLevel, `${m.id}: unlockLevel`).toBeGreaterThanOrEqual(0);
    }
  });

  it('musicianship is registered and owns the music tag', () => {
    expect(SKILLS.musicianship).toBeDefined();
    expect(SKILLS.musicianship.tags).toContain('music');
  });
});

// ARCANE_WORDS is not a forge registry (only MIRACLES is catalogued out of
// spellcraft.data.ts), so these have no mirror in forge/lib/validate.ts. That
// is the reason, not an oversight.
describe('arcane lexicon', () => {
  /*
   * Lightning's tier 3 is `bolt` and not `storm` specifically so it does not
   * collide with gust's (user, 2026-08-10). The parser never reads a deepened
   * name — a token is `fire:2`, and `stacked` is display only (displayWord in
   * systems/arcane.ts) — so a collision is not an ambiguous parse. It is two
   * different workings printing the same word on the card, which is the same
   * crime by a slower route.
   */
  it('no two words share a surface form', () => {
    const owner = new Map<string, string>();
    for (const def of Object.values(ARCANE_WORDS)) {
      for (const form of [def.word, ...(def.stacked ?? [])]) {
        expect(owner.get(form), `"${form}" is claimed by both ${owner.get(form)} and ${def.id}`).toBeUndefined();
        owner.set(form, def.id);
      }
    }
  });

  // types.ts: "Targeting words never stack — an address repeated is just an
  // address", and a conjunction joins clauses rather than deepening. This is
  // also the denominator of every share-based gate over the lexicon (yShicna's
  // 80% of FOLDABLE words, NEXT.md), which is why it is worth pinning.
  it('addresses and logic words never fold', () => {
    for (const def of Object.values(ARCANE_WORDS)) {
      if (def.kind !== 'target' && def.kind !== 'conjunction') continue;
      expect(def.stacked, `${def.id} is a ${def.kind} and must not stack`).toBeUndefined();
    }
  });
});

/**
 * COMPLETABILITY (docs/COMPLETABILITY.md §6) — the vertical structure.
 *
 * REVISED 2026-09-06 with the first banded floors (plans/alpha-band-one.md):
 * the ascent is SEQUENTIAL (clear every rung to pass it, `FloorDef.clear`),
 * floors have no authored stairs (`climbTo` is the only door), and the two
 * once-unwritable closure rules landed in their sequential form —
 * "hidden access is never on a critical path" is now **banded floor areas are
 * closed**: with no authored edge crossing a rung's boundary, its one door is
 * the ladder, which is always visible and always states its terms. Lateral
 * edges onto the ladder do not exist to delete; fixed transition spots are
 * reserved for future hidden/special floors, which are BANDLESS and therefore
 * off the critical path by construction.
 */
describe('towers, bands & floors', () => {
  it('every tower opens on a real spot', () => {
    for (const tower of Object.values(TOWERS)) {
      expect(SPOTS[tower.hubSpot], `${tower.id}: unknown hubSpot ${tower.hubSpot}`).toBeTruthy();
    }
  });

  it('every band belongs to a real tower', () => {
    for (const band of Object.values(BANDS)) {
      expect(TOWERS[band.towerId], `${band.id}: unknown towerId ${band.towerId}`).toBeTruthy();
      expect(band.index, `${band.id}: index is 1-based`).toBeGreaterThan(0);
    }
  });

  it('band indexes are unique and contiguous within a tower', () => {
    for (const tower of Object.values(TOWERS)) {
      const idx = Object.values(BANDS)
        .filter((b) => b.towerId === tower.id)
        .map((b) => b.index)
        .sort((a, b) => a - b);
      if (!idx.length) continue;
      // A gap is a ladder with a rung missing: the band after it can never be
      // reached, which is Invariant A's terminal state wearing a number.
      expect(idx, `${tower.id}: band indexes must run 1..n with no gaps`).toEqual(
        idx.map((_, i) => i + 1),
      );
    }
  });

  it('every floor points at a real tower, band and area', () => {
    for (const floor of Object.values(FLOORS)) {
      expect(TOWERS[floor.towerId], `${floor.id}: unknown towerId ${floor.towerId}`).toBeTruthy();
      expect(AREAS[floor.areaId], `${floor.id}: unknown areaId ${floor.areaId}`).toBeTruthy();
      if (floor.bandId !== undefined) {
        const band = BANDS[floor.bandId];
        expect(band, `${floor.id}: unknown bandId ${floor.bandId}`).toBeTruthy();
        expect(band.towerId, `${floor.id}: band ${floor.bandId} is on another tower`).toBe(
          floor.towerId,
        );
      }
    }
  });

  it('no two floors claim the same area', () => {
    const byArea = new Map<string, string>();
    for (const floor of Object.values(FLOORS)) {
      const prior = byArea.get(floor.areaId);
      expect(prior, `${floor.id} and ${prior} both claim area ${floor.areaId}`).toBeUndefined();
      byArea.set(floor.areaId, floor.id);
    }
  });

  /**
   * A personal floor is yours; it can never be a rung everyone has to climb.
   * Putting one in a band would make the critical path run through content
   * only one player can enter, which is the sharpest possible violation of
   * "optional content may not be a requirement for critical paths".
   */
  it('personal floors are off the ladder', () => {
    for (const floor of Object.values(FLOORS)) {
      if (!floor.personal) continue;
      expect(floor.bandId, `${floor.id} is personal, so it may not sit in a band`).toBeUndefined();
    }
  });

  /**
   * A band you cannot advance past is a terminal state. Empty bands are exempt
   * on purpose — bands are routinely declared before their floors are authored,
   * and failing that would block scaffolding rather than catch a mistake.
   */
  it('no band asks for more clears than it has floors', () => {
    for (const band of Object.values(BANDS)) {
      const floors = Object.values(FLOORS).filter((f) => f.bandId === band.id);
      if (!floors.length) continue;
      expect(band.clearsToAdvance, `${band.id}: clearsToAdvance must be at least 1`).toBeGreaterThan(0);
      expect(
        band.clearsToAdvance,
        `${band.id} wants ${band.clearsToAdvance} clears but holds ${floors.length} floor(s)`,
      ).toBeLessThanOrEqual(floors.length);
    }
  });

  /**
   * Band 3's shape (docs/plans/bands-2-3.md M4, M5). A hub is a place the
   * ladder answers, so it must be a real spot that no floor claims (else it
   * would be a rung and a hub at once). Bands climb in floor order: an `any`
   * band's floors are one contiguous run of indexes above every lower band's,
   * or "everything below the band" would not be the rungs below it. Level
   * steps belong to `any` bands, start at 0 and never fall, one per floor.
   */
  it('band hubs, any-order bands and level steps are well formed', () => {
    const floorAreas = new Set(Object.values(FLOORS).map((f) => f.areaId));
    for (const band of Object.values(BANDS)) {
      const floors = Object.values(FLOORS)
        .filter((f) => f.bandId === band.id)
        .sort((a, b) => a.index - b.index);
      if (band.hub) {
        const spot = SPOTS[band.hub];
        expect(spot, `${band.id}: hub '${band.hub}' does not exist`).toBeTruthy();
        expect(floorAreas.has(spot?.areaId ?? ''), `${band.id}: hub '${band.hub}' sits on a floor`).toBe(false);
        expect(floors.length, `${band.id}: a hub with no floors leads nowhere`).toBeGreaterThan(0);
      }
      for (const f of floors) {
        for (const other of Object.values(FLOORS)) {
          if (other.towerId !== f.towerId || other.bandId === undefined) continue;
          const otherBand = BANDS[other.bandId];
          if (otherBand.index < band.index) {
            expect(other.index, `${other.id} (band ${otherBand.index}) sits above ${f.id} (band ${band.index})`).toBeLessThan(f.index);
          }
        }
      }
      if (band.levelSteps) {
        expect(band.order, `${band.id}: level steps belong to any-order bands`).toBe('any');
        expect(band.levelSteps.length, `${band.id}: one step per floor`).toBe(floors.length);
        expect(band.levelSteps[0], `${band.id}: the first direction starts at the base level`).toBe(0);
        for (let i = 1; i < band.levelSteps.length; i++) {
          expect(band.levelSteps[i], `${band.id}: steps never fall`).toBeGreaterThanOrEqual(band.levelSteps[i - 1]);
        }
      }
    }
  });

  /**
   * Under the SEQUENTIAL ascent every rung is mandatory, so the old band-level
   * disjunction ("one sibling names no skill") tightened to the floor: a rung
   * whose gate or clear names a skill makes that discipline mandatory for the
   * whole game above it — a wall for John Idle, not a shortcut for the
   * specialist. Accumulation gates (gold, kills at the floor's own dens,
   * quest counts) and quest clears stay legal; the quests themselves answer
   * to their own completability lints.
   */
  it('no rung is gated or cleared on a named discipline', () => {
    for (const floor of Object.values(FLOORS)) {
      if (floor.bandId === undefined) continue;
      for (const cond of [...(floor.gate ?? []), ...(floor.clear ?? [])]) {
        expect(
          cond.type,
          `${floor.id}: a skill condition on a mandatory rung makes that discipline mandatory`,
        ).not.toBe('skill');
      }
    }
  });

  /**
   * A banded floor without a landing cannot be climbed to, and one without a
   * clear can never be finished — either way everything above it is sealed
   * for good, which is Invariant A's terminal state wearing a ladder.
   */
  it('every banded floor declares a landing in its own area and a non-empty clear', () => {
    for (const floor of Object.values(FLOORS)) {
      if (floor.bandId === undefined) continue;
      expect(floor.landing, `${floor.id}: a rung needs a landing`).toBeTruthy();
      const landing = SPOTS[floor.landing!];
      expect(landing, `${floor.id}: landing '${floor.landing}' does not exist`).toBeTruthy();
      expect(
        landing?.areaId,
        `${floor.id}: landing '${floor.landing}' is not on the floor it lands on`,
      ).toBe(floor.areaId);
      expect(floor.clear?.length ?? 0, `${floor.id}: a rung needs a clear`).toBeGreaterThan(0);
    }
  });

  it('banded floor indexes are unique and contiguous within a tower', () => {
    for (const tower of Object.values(TOWERS)) {
      const idx = Object.values(FLOORS)
        .filter((f) => f.towerId === tower.id && f.bandId !== undefined)
        .map((f) => f.index)
        .sort((a, b) => a - b);
      if (!idx.length) continue;
      // A gap is a rung nobody can clear, so nobody passes it: sequential
      // ascent turns a numbering typo into a terminal state.
      expect(idx, `${tower.id}: banded floor indexes must run 1..n with no gaps`).toEqual(
        idx.map((_, i) => i + 1),
      );
    }
  });

  /**
   * A clear is a promise about counters, so the counters must be real: a
   * `slain:` clear needs that spot to hold that monster as a `once` spawn (or
   * the counter never latches), and a `fights:` clear needs the spot's
   * fightLimit to reach the number it asks for (or the budget runs out below
   * the bar and the floor is unfinishable — terminal again).
   */
  it('clear counters point at spawns that can actually pay them', () => {
    for (const floor of Object.values(FLOORS)) {
      for (const cond of floor.clear ?? []) {
        if (cond.type !== 'stat') continue;
        const slain = cond.key.match(/^slain:([^:]+):(.+)$/);
        if (slain) {
          const spot = SPOTS[slain[1]];
          expect(spot, `${floor.id}: clear names unknown spot '${slain[1]}'`).toBeTruthy();
          expect(
            spot?.encounters?.some((e) => e.monsterId === slain[2] && e.once),
            `${floor.id}: clear wants slain:${slain[1]}:${slain[2]} but that spot has no such 'once' spawn`,
          ).toBe(true);
        }
        const fights = cond.key.match(/^fights:(.+)$/);
        if (fights) {
          const spot = SPOTS[fights[1]];
          expect(spot, `${floor.id}: clear names unknown spot '${fights[1]}'`).toBeTruthy();
          expect(
            spot?.fightLimit ?? 0,
            `${floor.id}: clear wants ${cond.value} fights at ${fights[1]} but its fightLimit stops short`,
          ).toBeGreaterThanOrEqual(cond.value);
        }
        const boss = cond.key.match(/^boss:(.+)$/);
        if (boss) {
          const spot = SPOTS[boss[1]];
          expect(spot, `${floor.id}: clear names unknown spot '${boss[1]}'`).toBeTruthy();
          expect(
            spot?.encounters?.some((e) => e.boss),
            `${floor.id}: clear wants boss:${boss[1]} but no encounter there is boss-flagged`,
          ).toBe(true);
        }
      }
    }
  });

  /**
   * **Banded floor areas are closed.** The ladder is the only door on or off
   * a rung, so every gate is read at one visible place and no authored road
   * can smuggle a player past a seal (the registry MIRRORS edges — a single
   * floor→city edge would open city→floor for free). This is the sequential
   * form of "hidden access is never on a critical path". Future hidden/
   * special floors hang off fixed transition spots instead, and those floors
   * are BANDLESS — revisit this lint's exemption then, not before.
   */
  it('no authored edge crosses a banded floor boundary', () => {
    const bandedAreas = new Set(
      Object.values(FLOORS)
        .filter((f) => f.bandId !== undefined)
        .map((f) => f.areaId),
    );
    for (const spot of Object.values(SPOTS)) {
      for (const c of spot.connections) {
        const toArea = SPOTS[c.to]?.areaId;
        if (!toArea) continue; // unknown targets fail the referential lint instead
        const fromBanded = bandedAreas.has(spot.areaId);
        const toBanded = bandedAreas.has(toArea);
        // The listed doors are decisions (towers.data.ts OFF_LADDER_DOORS).
        if (offLadderDoor(spot.id, c.to)) {
          expect(c.oneWay, `${spot.id} -> ${c.to}: an off-ladder door is oneWay, so it brings no free mirror`).toBe(true);
          continue;
        }
        if (fromBanded || toBanded) {
          expect(
            spot.areaId,
            `${spot.id} -> ${c.to} crosses a banded floor boundary — the ladder is the only door`,
          ).toBe(toArea);
        }
      }
    }
  });

  /**
   * THE FLOOR STANDARD, step 1 (docs/FLOOR_STANDARD.md §2.2). The checks are
   * pure functions in systems/floorRules.ts, run here on the live registry and
   * mirrored live in forge/lib/validate.ts (which imports the same functions).
   * tests/floorrules.test.ts breaks each rule on a fixture to show it bites.
   * The mirrored adjacency is the registry's ADJACENCY: every non-oneWay edge
   * comes back without its conditions, so a gated road is a free road home.
   */
  const reports = () =>
    Object.values(FLOORS)
      .filter((f) => f.bandId !== undefined)
      .map((f) => ({ floor: f, report: floorStructureIssues(f, SPOTS, ADJACENCY) }));
  const issuesOf = (rule: FloorRule) =>
    reports().flatMap(({ report }) =>
      report.issues.filter((i) => i.rule === rule).map((i) => `${i.floor}: ${i.message}`),
    );

  it('every banded floor has a spine: its clear names a spot to measure from', () => {
    // A floor whose clear is a quest turn-in names no spot and skips the spine
    // rules below. None does today; list it here when one is added, so the
    // exemption is a decision and not an accident.
    const skipped = reports()
      .filter(({ report }) => report.skipped !== undefined)
      .map(({ floor, report }) => `${floor.id} (${report.skipped})`);
    expect(skipped, 'floors whose spine rules did not run').toEqual([]);
    expect(issuesOf('spine')).toEqual([]);
  });

  it('no skip: every floor-local gate is necessary', () => {
    expect(issuesOf('no-skip')).toEqual([]);
  });

  it('wing depth: every spot is within 3 hops of the spine', () => {
    expect(issuesOf('wing-depth')).toEqual([]);
  });

  it('wings loop: a wing of 3 or more spots joins the spine twice, or has a oneWay way back', () => {
    expect(issuesOf('wing-loop')).toEqual([]);
  });

  it("a clear spot's encounter table never empties", () => {
    expect(issuesOf('clear-table')).toEqual([]);
  });
});
