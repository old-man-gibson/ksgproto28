import { describe, expect, it } from 'vitest';
import {
  AREAS,
  BANDS,
  DISCIPLINES,
  FLOORS,
  ITEMS,
  KEY_ITEMS,
  MATERIALS,
  MONSTERS,
  NPCS,
  QUESTS,
  RECIPES,
  REGIONS,
  RUNES,
  SKILLS,
  SPOTS,
  STATUSES,
  TECHNIQUES,
  TOWERS,
  buildAdjacency,
  declaredConnections,
  edgesFrom,
  skyRegionOf,
} from '../src/core/registry';
import { CALM_SEEN_KEY, SKY_TABLES } from '../src/core/data/climate.data';
import { SPOTS_TEXT } from '../src/core/text/locations.text';
import { NPCS_TEXT } from '../src/core/text/npcs.text';
import { MONSTERS_TEXT } from '../src/core/text/monsters.text';
import { BANDS_TEXT, FLOORS_TEXT } from '../src/core/text/towers.text';
import { createInitialState } from '../src/core/state';
import { bestiaryProgress, isDiscovered, isVeiled, recordKill } from '../src/core/systems/bestiary';
import { EventBus } from '../src/core/engine/events';
import { npcDialogue } from '../src/core/systems/quests';
import { calmSpell, worldSeedOf } from '../src/core/systems/weather';
import { skyKindAt } from '../src/core/systems/exposure';
import { eligibleEncounters, spotCleared } from '../src/core/systems/combat';
import { clearMet } from '../src/core/systems/ladder';
import { spotThreat } from '../src/ui/lib/navigation';
import { exploreIssues, floorStructureIssues } from '../src/core/systems/floorRules';
import { validate } from '../forge/lib/validate';
import type { SpotDef, SpotEncounter } from '../src/core/types';

/**
 * Floor 17, the Malgeri Crossing (docs/MALGERI.md): the layout, the sky lines,
 * the calm rule and the disclosure rule that keeps the calm unnamed until the
 * first calm has been stood under.
 */

const FLOOR = FLOORS.ascent_f17;
const AREA_ID = 'ascent_f17_area';
const CALM_TRIO = ['malgeri_ridge_wolf', 'malgeri_cairn_brute', 'malgeri_hollow_seer'];
const SKY_SLIMES: Record<string, string> = {
  snow: 'malgeri_rime_slime',
  heatwave: 'malgeri_cinder_slime',
  gale: 'malgeri_squall_slime',
  storm: 'malgeri_storm_slime',
  rain: 'malgeri_downpour_slime',
};
const CREATED = 1_754_000_000_000;
const SEED = worldSeedOf(CREATED);
const TICKS_PER_MINUTE = 10;

const f17Spots = (): SpotDef[] => Object.values(SPOTS).filter((s) => s.areaId === AREA_ID);
const openHunts = () =>
  f17Spots().filter((s) => !s.tags?.includes('indoor') && (s.encounters ?? []).some((e) => e.sky));
const dropsAmber = (id: string) =>
  MONSTERS[id].loot.entries.some((l) => l.kind === 'material' && l.id === 'ridge_amber');
const sum = (lines: SpotEncounter[]) => lines.reduce((n, e) => n + e.weight, 0);

describe('floor 17: the layout', () => {
  it('is the Malgeri Crossing in the Malgeri Mountains, on the range\'s sky', () => {
    expect(FLOOR.areaId).toBe(AREA_ID);
    expect(FLOOR.bandId).toBe('ascent_aberrant');
    expect(FLOOR.landing).toBe('f17_landing');
    expect(AREAS[AREA_ID].regionId).toBe('the_ascent');
    expect(AREAS[AREA_ID].skyRegionId).toBe('malgeri_range');
    expect(skyRegionOf('f17_landing')?.id).toBe('malgeri_range');
    expect(skyRegionOf('f17_keeper')?.id).toBe('malgeri_range');
    expect(SKY_TABLES[skyRegionOf('f17_keeper')!.sky!]).toBeDefined();
    expect(BANDS.ascent_aberrant.name).toBe('The Malgeri Mountains');
    expect(FLOOR.name).toBe('The Malgeri Crossing');
  });

  it('clears on the gate boss\'s kill, which only a boss line of that spot can make', () => {
    expect(FLOOR.clear).toEqual([{ type: 'stat', key: 'boss:f17_keeper', value: 1 }]);
    expect(SPOTS.f17_keeper.encounters!.some((e) => e.boss)).toBe(true);
  });

  it('has eighteen spots in four zones', () => {
    expect(f17Spots().map((s) => s.id).sort()).toEqual(
      [
        'f17_landing', 'f17_cave_hub', 'f17_cave_crack', 'f17_nest', 'f17_central_caves',
        'f17_east_mouth', 'f17_east_ascent', 'f17_east_peak',
        'f17_east_ridge', 'f17_west_ridge', 'f17_west_peak', 'f17_peak',
        'f17_base', 'f17_path', 'f17_old_path', 'f17_hamlet_square', 'f17_hamlet_forge', 'f17_keeper',
      ].sort(),
    );
  });

  it('passes the floor structure rules and the explore rule, with the spine running landing to clear spot', () => {
    const report = floorStructureIssues(FLOOR, SPOTS, buildAdjacency(declaredConnections(SPOTS)));
    expect(report.issues).toEqual([]);
    expect(report.skipped).toBeUndefined();
    expect(exploreIssues(f17Spots())).toEqual([]);
  });

  it('shuts the descent behind the peak boss, in one direction only', () => {
    const down = edgesFrom('f17_peak').find((e) => e.to === 'f17_base')!;
    expect(down.requires).toEqual([{ type: 'stat', key: 'boss:f17_peak', value: 1 }]);
    // Nothing else leads into the descent, from the landing or from the ridge.
    const into = new Set(['f17_base', 'f17_path', 'f17_old_path', 'f17_hamlet_square', 'f17_hamlet_forge', 'f17_keeper']);
    const entries = f17Spots()
      .filter((s) => !into.has(s.id))
      .flatMap((s) => edgesFrom(s.id).filter((e) => into.has(e.to)).map((e) => `${s.id}>${e.to}`));
    expect(entries).toEqual(['f17_peak>f17_base']);
    // The reverse edge is open: the hamlet side is never a trap.
    const up = edgesFrom('f17_base').find((e) => e.to === 'f17_peak')!;
    expect(up.requires ?? []).toEqual([]);
  });

  it('keeps the hamlet off the fast-travel network, so it cannot skip the gate', () => {
    for (const id of ['f17_base', 'f17_path', 'f17_old_path', 'f17_hamlet_square', 'f17_hamlet_forge', 'f17_keeper']) {
      expect(SPOTS[id].waypoint, id).toBeFalsy();
    }
  });

  it('puts the roofs on the roofed spots: indoor, and the caves also dark', () => {
    for (const id of ['f17_landing', 'f17_cave_hub', 'f17_cave_crack', 'f17_nest', 'f17_central_caves']) {
      expect(SPOTS[id].tags, id).toEqual(expect.arrayContaining(['indoor', 'dark']));
    }
    for (const id of ['f17_east_mouth', 'f17_west_peak', 'f17_base', 'f17_hamlet_square', 'f17_hamlet_forge']) {
      expect(SPOTS[id].tags, id).toContain('indoor');
    }
    expect(SPOTS.f17_hamlet_forge.tags).toContain('heat');
  });

  it('puts an optional queen in the nest: one fight, and no gate or clear reads it', () => {
    const nest = SPOTS.f17_nest;
    expect(nest.fightLimit).toBe(1);
    expect(nest.encounters).toEqual([expect.objectContaining({ monsterId: 'malgeri_brood_queen', boss: true, level: [43, 43] })]);
    const reads = (conds: { type: string; key?: string }[] | undefined) =>
      JSON.stringify(conds ?? []).includes('f17_nest');
    expect(reads(FLOOR.clear)).toBe(false);
    expect(reads(edgesFrom('f17_peak').find((e) => e.to === 'f17_base')!.requires)).toBe(false);
  });

  it('has a camp in every roofed zone, and the gate boss without a fight limit', () => {
    const rests = (id: string) => SPOTS[id].activities.some((a) => a.kind === 'rest');
    expect(['f17_landing', 'f17_east_mouth', 'f17_west_peak', 'f17_base'].every(rests)).toBe(true);
    expect(SPOTS.f17_keeper.fightLimit).toBeUndefined();
    expect(SPOTS.f17_peak.fightLimit).toBeUndefined();
  });
});

describe('floor 17: monster levels', () => {
  const levels = (id: string) => SPOTS[id].encounters!.map((e) => e.level);

  it('has fixed levels, no dynamic ones', () => {
    // Dynamic levels are the band's (BandDef.dynamicLevel); a line can also rise with a stat.
    expect(BANDS.ascent_aberrant.dynamicLevel).toBeUndefined();
    for (const s of f17Spots()) {
      for (const e of s.encounters ?? []) {
        expect(e.levelRise, `${s.id} ${e.monsterId}`).toBeUndefined();
        expect(e.once, `${s.id} ${e.monsterId}`).toBeFalsy();
      }
    }
  });

  it('puts plain lines at 40 to 42, rising by zone', () => {
    const plain = (id: string) =>
      SPOTS[id].encounters!.filter((e) => !e.boss && !e.sky && e.monsterId !== 'malgeri_legionary').flatMap((e) => e.level);
    const range = (ids: string[]) => {
      const all = ids.flatMap(plain);
      return [Math.min(...all), Math.max(...all)];
    };
    expect(range(['f17_landing', 'f17_cave_hub', 'f17_central_caves'])).toEqual([40, 41]);
    expect(range(['f17_east_mouth', 'f17_east_ascent', 'f17_east_peak', 'f17_east_ridge', 'f17_west_ridge', 'f17_west_peak'])).toEqual([41, 42]);
    expect(range(['f17_base', 'f17_path', 'f17_old_path'])).toEqual([42, 42]);
  });

  it('puts the queen at 43, the peak boss at 44, the gate boss at 45 and its escorts at 42 to 43', () => {
    expect(levels('f17_nest')).toEqual([[43, 43]]);
    expect(levels('f17_peak')).toEqual([[44, 44]]);
    const keeper = SPOTS.f17_keeper.encounters!;
    expect(keeper.find((e) => e.monsterId === 'malgeri_slime_king')!.level).toEqual([45, 45]);
    expect(keeper.find((e) => e.monsterId === 'malgeri_legionary')!.level).toEqual([42, 43]);
  });

  it('flags the three bosses, and keeps a sky-less, daypart-less line on each boss and clear spot', () => {
    for (const id of ['f17_nest', 'f17_peak', 'f17_keeper']) {
      const lines = SPOTS[id].encounters!;
      expect(lines.some((e) => e.boss), id).toBe(true);
      expect(lines.some((e) => !e.sky && !e.daypart), id).toBe(true);
    }
  });
});

describe('floor 17: the sky lines', () => {
  it('has seven open-sky hunt spots, each with the same shape', () => {
    expect(openHunts().map((s) => s.id).sort()).toEqual(
      ['f17_east_ascent', 'f17_east_peak', 'f17_east_ridge', 'f17_old_path', 'f17_path', 'f17_west_ridge'].sort(),
    );
  });

  it('gives each one a slime line per front, each beside plain lines', () => {
    for (const spot of openHunts()) {
      const lines = spot.encounters!;
      const plain = lines.filter((e) => !e.sky);
      expect(plain.length, spot.id).toBeGreaterThanOrEqual(2);
      for (const [kind, slime] of Object.entries(SKY_SLIMES)) {
        const line = lines.find((e) => e.monsterId === slime);
        expect(line, `${spot.id} ${slime}`).toBeDefined();
        expect(line!.sky, `${spot.id} ${slime}`).toEqual([kind]);
      }
    }
  });

  it('gives each one calm lines: groups of 2 to 3 at 46 to 48, four times the plain weight, calm only', () => {
    for (const spot of openHunts()) {
      const lines = spot.encounters!;
      const calm = lines.filter((e) => e.sky?.includes('calm'));
      expect(calm.map((e) => e.monsterId).sort(), spot.id).toEqual([...CALM_TRIO].sort());
      for (const e of calm) {
        expect(e.sky, `${spot.id} ${e.monsterId}`).toEqual(['calm']);
        expect(e.level, `${spot.id} ${e.monsterId}`).toEqual([46, 48]);
      }
      expect(sum(calm), spot.id).toBe(4 * sum(lines.filter((e) => !e.sky)));
    }
  });

  it('keeps sky lines and calm lines off every roofed spot', () => {
    for (const spot of f17Spots().filter((s) => s.tags?.includes('indoor'))) {
      for (const e of spot.encounters ?? []) expect(e.sky, `${spot.id} ${e.monsterId}`).toBeUndefined();
    }
  });

  it('makes the calm trio elite, in groups of 2 or 3, escorting each other', () => {
    for (const id of CALM_TRIO) {
      const def = MONSTERS[id];
      expect(def.group, id).toMatchObject({ min: 2, max: 3 });
      expect(def.escorts, id).toEqual(CALM_TRIO);
      expect(def.veil, id).toEqual([{ type: 'stat', key: CALM_SEEN_KEY, value: 1 }]);
      expect(dropsAmber(id), id).toBe(true);
    }
    expect(MATERIALS.ridge_amber).toBeDefined();
  });

  it('drops Ridge Amber only from the calm trio', () => {
    for (const id of Object.keys(MONSTERS)) {
      expect(dropsAmber(id), id).toBe(CALM_TRIO.includes(id));
    }
  });

  it('rolls the calm lines only under a calm open sky, and never indoors', () => {
    const [start] = calmSpell(SEED, 'malgeri_range', 3);
    const state = createInitialState(CREATED, 'f17_east_ridge');
    state.totalTicks = Math.ceil(start / 3) * 3 * TICKS_PER_MINUTE;
    expect(skyKindAt(state, 'f17_east_ridge')).toBe('calm');
    const calmIds = (spotId: string) =>
      eligibleEncounters(state, SPOTS[spotId]).filter((e) => CALM_TRIO.includes(e.monsterId)).map((e) => e.monsterId);
    expect(calmIds('f17_east_ridge').sort()).toEqual([...CALM_TRIO].sort());
    for (const id of ['f17_east_mouth', 'f17_west_peak', 'f17_base', 'f17_cave_hub']) expect(calmIds(id), id).toEqual([]);
    // Each front over the same spot rolls its own slime line and none of the calm trio.
    for (const [kind, slime] of Object.entries(SKY_SLIMES)) {
      let tick = -1;
      for (let cell = 0; cell < 24 * 400 && tick < 0; cell++) {
        state.totalTicks = cell * 3600;
        if (skyKindAt(state, 'f17_east_ridge') === kind) tick = cell * 3600;
      }
      expect(tick, kind).toBeGreaterThanOrEqual(0);
      state.totalTicks = tick;
      const ids = eligibleEncounters(state, SPOTS.f17_east_ridge).map((e) => e.monsterId);
      const skyed = ids.filter((id) => Object.values(SKY_SLIMES).includes(id));
      expect(skyed, kind).toEqual([slime]);
      expect(ids.some((id) => CALM_TRIO.includes(id)), kind).toBe(false);
      expect(ids.length, kind).toBeGreaterThan(1);
    }
  });

  it('starts uncleared: a new save has neither the peak nor the floor cleared', () => {
    const state = createInitialState(CREATED, 'f17_peak');
    expect(spotCleared(state, SPOTS.f17_peak)).toBe(false);
    expect(clearMet(state, FLOOR)).toBe(false);
  });
});

describe('floor 17: the disclosure rule', () => {
  const NAMES = /calm|ridge wolf|cairn brute|hollow seer|ridge amber|\bwolves\b|\bseers?\b|\bbrutes?\b/i;
  const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : [String(v)]);
  const scan = (table: Record<string, unknown>, keep: (k: string) => boolean) =>
    Object.entries(table)
      .filter(([k]) => keep(k))
      .flatMap(([k, v]) => strings(v).map((text) => ({ key: k, text })));

  it('names none of it in the floor\'s spot, find, floor and band text, nor the neighbours that describe it', () => {
    const hits = [
      ...scan(SPOTS_TEXT, (k) => k.startsWith('f17_') || k.startsWith('f16_arena') || k.startsWith('f18_well_head')),
      ...scan(FLOORS_TEXT, (k) => k.startsWith('ascent_f17')),
      ...scan(BANDS_TEXT, (k) => k.startsWith('ascent_aberrant')),
    ].filter((e) => NAMES.test(e.text));
    expect(hits).toEqual([]);
  });

  it('names none of it in the hamlet\'s base dialogue or descriptions', () => {
    const hits = scan(NPCS_TEXT, (k) => k.startsWith('f17_') && !k.includes('.lore.')).filter((e) => NAMES.test(e.text));
    expect(hits).toEqual([]);
  });

  it('names none of it in the other Malgeri monsters\' text', () => {
    const hits = scan(MONSTERS_TEXT, (k) => k.startsWith('malgeri_') && !CALM_TRIO.some((id) => k.startsWith(`${id}.`))).filter((e) =>
      NAMES.test(e.text),
    );
    expect(hits).toEqual([]);
  });

  it('puts the only NPC mention behind the captain\'s lore entry, on the first-calm flag', () => {
    expect(NPCS.f17_bren.lore).toEqual([{ requires: [{ type: 'stat', key: CALM_SEEN_KEY, value: 1 }], dialogue: expect.any(Array) }]);
    expect(NPCS.f17_thora.lore).toBeUndefined();
    const lore = Object.entries(NPCS_TEXT).filter(([k]) => k.includes('.lore.'));
    expect(lore.map(([k]) => k)).toEqual(['f17_bren.lore.0.dialogue']);
    expect(NAMES.test(strings(lore[0][1]).join(' '))).toBe(true);
  });

  it('shows the captain\'s lore line after the flag and not before', () => {
    const state = createInitialState(CREATED, 'f17_hamlet_square');
    const before = npcDialogue(state, NPCS.f17_bren);
    expect(before).toEqual(NPCS.f17_bren.dialogue);
    expect(before.some((l) => NAMES.test(l))).toBe(false);
    state.stats[CALM_SEEN_KEY] = 1;
    const after = npcDialogue(state, NPCS.f17_bren);
    expect(after.length).toBe(before.length + 1);
    expect(after.some((l) => NAMES.test(l))).toBe(true);
    expect(npcDialogue(state, NPCS.f17_thora)).toEqual(NPCS.f17_thora.dialogue);
  });
});

describe('the veil on the calm monsters', () => {
  type Heard = { log: string[]; entries: string[] };
  /** Kill a species n times and return the log lines and entry events the kills emitted. */
  const kill = (state: ReturnType<typeof createInitialState>, id: string, n = 1): Heard => {
    const bus = new EventBus();
    const heard: Heard = { log: [], entries: [] };
    bus.on('log', (ev) => heard.log.push(ev.msg));
    bus.on('bestiary:entry', (ev) => heard.entries.push(ev.monsterId));
    for (let i = 0; i < n; i++) recordKill(state, bus, id);
    return heard;
  };

  it('is veiled until the flag, and lifts with it', () => {
    const state = createInitialState(CREATED, 'f17_east_ridge');
    for (const id of CALM_TRIO) expect(isVeiled(state, id), id).toBe(true);
    expect(isVeiled(state, 'malgeri_goblin')).toBe(false);
    state.stats[CALM_SEEN_KEY] = 1;
    for (const id of CALM_TRIO) expect(isVeiled(state, id), id).toBe(false);
  });

  it('counts a veiled kill and shows nothing for it: no entry, no log line, no XP, no count', () => {
    const state = createInitialState(CREATED, 'f17_east_ridge');
    const total = bestiaryProgress(state).total;
    const xpBefore = JSON.stringify(state.skills);
    const heard = kill(state, 'malgeri_ridge_wolf', 3);
    expect(state.bestiary.malgeri_ridge_wolf.kills).toBe(3);
    expect(state.bestiary.malgeri_ridge_wolf.firstKill).toBe(0);
    expect(state.bestiary.malgeri_ridge_wolf.facts).toEqual([]);
    expect(isDiscovered(state, 'malgeri_ridge_wolf')).toBe(false);
    expect(heard).toEqual({ log: [], entries: [] });
    expect(state.stats['bestiary:entries']).toBeUndefined();
    expect(JSON.stringify(state.skills)).toBe(xpBefore);
    expect(bestiaryProgress(state)).toEqual({ known: 0, total });
  });

  it('keeps the book total free of the veiled species, and adds them when the veil lifts', () => {
    const state = createInitialState(CREATED, 'f17_east_ridge');
    const veiled = bestiaryProgress(state).total;
    state.stats[CALM_SEEN_KEY] = 1;
    expect(bestiaryProgress(state).total).toBe(veiled + CALM_TRIO.length);
  });

  it('opens the entry on the first kill after the veil lifts, once, counting the kills made before it', () => {
    const state = createInitialState(CREATED, 'f17_east_ridge');
    kill(state, 'malgeri_cairn_brute', 2);
    state.stats[CALM_SEEN_KEY] = 1;
    state.totalTicks = 5000;
    // The veil is up: the two kills made under it count, and the book shows the species.
    expect(isDiscovered(state, 'malgeri_cairn_brute')).toBe(true);
    // The entry itself (log line, XP, count) waits for the next kill.
    expect(state.bestiary.malgeri_cairn_brute.firstKill).toBe(0);
    const first = kill(state, 'malgeri_cairn_brute');
    expect(first.entries).toEqual(['malgeri_cairn_brute']);
    expect(first.log.some((m) => m.includes('Cairn Brute'))).toBe(true);
    expect(state.bestiary.malgeri_cairn_brute.kills).toBe(3);
    expect(state.bestiary.malgeri_cairn_brute.firstKill).toBe(state.totalTicks);
    expect(state.stats['bestiary:entries']).toBe(1);
    // The next kill is an ordinary one: no second entry.
    expect(kill(state, 'malgeri_cairn_brute').entries).toEqual([]);
    expect(state.stats['bestiary:entries']).toBe(1);
  });

  it('leaves an unveiled species alone: the first kill opens its entry as before', () => {
    const state = createInitialState(CREATED, 'f17_landing');
    expect(kill(state, 'malgeri_goblin').entries).toEqual(['malgeri_goblin']);
    expect(isDiscovered(state, 'malgeri_goblin')).toBe(true);
    expect(state.bestiary.malgeri_goblin.kills).toBe(1);
  });
});

describe('the map badge', () => {
  const RIDGE = SPOTS.f17_east_ridge;

  it('names the plain levels before the first calm, even under a calm sky', () => {
    const state = createInitialState(CREATED, 'f17_east_ridge');
    const [start] = calmSpell(SEED, 'malgeri_range', 3);
    state.totalTicks = Math.ceil(start / 3) * 3 * TICKS_PER_MINUTE;
    expect(skyKindAt(state, 'f17_east_ridge')).toBe('calm');
    expect(spotThreat(state, RIDGE)).toBe('L41-42');
  });

  it('adds the calm levels only after the flag, under a calm sky', () => {
    const state = createInitialState(CREATED, 'f17_east_ridge');
    const [start] = calmSpell(SEED, 'malgeri_range', 3);
    state.totalTicks = Math.ceil(start / 3) * 3 * TICKS_PER_MINUTE;
    state.stats[CALM_SEEN_KEY] = 1;
    expect(spotThreat(state, RIDGE)).toBe('L41-48');
  });
});

/**
 * forge/lib/validate.ts holds the veil and lore rules of tests/content.test.ts.
 * The stand-in store is the registry with one monster and one NPC swapped for
 * edited copies.
 */
describe('the forge validator on veils and lore', () => {
  const KINDS: Record<string, unknown> = {
    area: AREAS, region: REGIONS, npc: NPCS, quest: QUESTS, material: MATERIALS, item: ITEMS, rune: RUNES,
    monster: MONSTERS, recipe: RECIPES, skill: SKILLS, discipline: DISCIPLINES, status: STATUSES,
    tower: TOWERS, band: BANDS, keyItem: KEY_ITEMS, technique: TECHNIQUES, spot: SPOTS, floor: FLOORS,
  };
  const forgeIssues = (swap: Record<string, Record<string, unknown>> = {}) => {
    const all = (kind: string): Record<string, unknown> => ({
      ...((KINDS[kind] as Record<string, unknown>) ?? {}),
      ...(swap[kind] ?? {}),
    });
    const store = { all, get: (kind: string, id: string) => all(kind)[id], meta: {}, catalog: [] } as unknown as Parameters<
      typeof validate
    >[0];
    return validate(store).filter((i) => /veil|lore|condition/.test(i.message));
  };

  it('says nothing about the live veils and lore', () => {
    expect(forgeIssues()).toEqual([]);
  });

  it('reports an empty veil, and a veil naming an unknown skill or quest', () => {
    const wolf = MONSTERS.malgeri_ridge_wolf;
    expect(forgeIssues({ monster: { malgeri_ridge_wolf: { ...wolf, veil: [] } } }).map((i) => i.message)).toEqual([
      'an empty veil hides nothing',
    ]);
    const bad = forgeIssues({
      monster: {
        malgeri_ridge_wolf: {
          ...wolf,
          veil: [
            { type: 'skill', id: 'no_such_skill', level: 1 },
            { type: 'quest', id: 'no_such_quest' },
          ],
        },
      },
    });
    expect(bad.map((i) => i.message)).toEqual([
      "condition names unknown skill 'no_such_skill'",
      "condition names unknown quest 'no_such_quest'",
    ]);
  });

  it('reports a lore entry with no conditions or no lines', () => {
    const bren = NPCS.f17_bren;
    const issues = forgeIssues({
      npc: { f17_bren: { ...bren, lore: [{ requires: [], dialogue: ['x'] }, { requires: bren.lore![0].requires, dialogue: [] }] } },
    });
    expect(issues.map((i) => i.message)).toEqual([
      'lore entry 0 has no conditions: it would always show',
      'lore entry 1 has nothing to say',
    ]);
  });
});
