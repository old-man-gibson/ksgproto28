import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { ADJACENCY, FLOORS, MATERIALS, REAGENTS, RECIPES, SPOTS } from '../src/core/registry';
import {
  DARK_FLOOR,
  FESTIVAL_RESTOCK,
  PREP_TICKS,
  ROYALE_SECTIONS,
  scoutedKey,
} from '../src/core/data/festival.data';
import { festivalRun } from '../src/core/systems/festivalRules';
import { searchKey, searchSpent } from '../src/core/systems/search';
import { spotActivities } from '../src/core/systems/actions';
import { floorStructureIssues } from '../src/core/systems/floorRules';
import { getDerivedStats } from '../src/core/systems/derived';
import { ATTRIBUTE_LIST } from '../src/core/data/attributes.data';
import type { ActivityDef, GameState, SpotDef } from '../src/core/types';
import { clearFloors } from './fixtures/floors';

/**
 * The festival's prep hub (docs/FESTIVAL.md §9.1): the hall and the five spots
 * off it, their finite stock, and the budget of the ten days. The hub is data
 * in locations.data.ts; the restock is systems/festival.ts.
 */

const HUB_NEW = ['f15_survey', 'f15_herb_yard', 'f15_workshop', 'f15_gallery'];
const HUB = ['f15_stores', ...HUB_NEW];
const BELOW = Object.values(FLOORS)
  .filter((f) => f.bandId !== undefined && f.index < 15)
  .map((f) => f.id);

/** Festival hours are 600 ticks; a festival day is 14,400. */
const HOUR = 600;
const DAY = 24 * HOUR;
/** What the benches take beyond the searches, as budgeted in locations.data.ts: about a third of a day. */
const BENCH_ALLOWANCE = 4_000;

type SearchActivity = Extract<ActivityDef, { kind: 'search' }>;

const searchesOf = (spot: SpotDef): SearchActivity[] =>
  spot.activities.filter((a): a is SearchActivity => a.kind === 'search');

/** Every finite search of the restocked spots, with the finds it pays and the ticks each takes. */
function restocked(): { spot: string; act: SearchActivity; finds: number; ticks: number }[] {
  return FESTIVAL_RESTOCK.flatMap((id) =>
    searchesOf(SPOTS[id]).map((act) => ({
      spot: id,
      act,
      finds: act.rewards.reduce((n, r) => n + (r.limit ?? 0), 0),
      ticks: act.ticksPer,
    })),
  );
}

function atFourteen(): GameState {
  const s = createInitialState(0);
  clearFloors(s.stats, BELOW);
  s.spot = FLOORS.ascent_f14.landing!;
  s.discovered.push(s.spot);
  return s;
}

/** Far past anything on floors 15–16, so the hub's clock is the only thing under test. */
function strong(s: GameState): GameState {
  for (const a of ATTRIBUTE_LIST) s.attrs[a.id].level = 400;
  s.resources.hp = getDerivedStats(s).maxHp;
  return s;
}

function climb(game: Game, floorId: string | null): void {
  expect(game.climbTo(floorId), `climb to ${floorId}`).toBe(true);
  for (let i = 0; i < 2000 && game.state.travel; i++) game.tick();
  expect(game.state.travel).toBeNull();
}

function tickUntil(game: Game, done: () => boolean, max = 200_000): number {
  let n = 0;
  for (; n < max && !done(); n++) game.tick();
  expect(done(), 'condition never held').toBe(true);
  return n;
}

/** Walk to a spot and wait for the arrival. */
function goTo(game: Game, spotId: string): void {
  expect(game.travelTo(spotId), `travel to ${spotId}`).toBe(true);
  tickUntil(game, () => !game.state.travel && game.state.spot === spotId, 500);
}

/** A festival attempt with the dark room emptied, standing in the hall. */
function inHall(s = strong(atFourteen())): Game {
  const game = new Game(s);
  climb(game, DARK_FLOOR);
  tickUntil(game, () => festivalRun(game.state)?.phase === 'prep');
  goTo(game, 'f15_hall');
  return game;
}

describe('the hub’s spots', () => {
  it('the four new spots exist on floor 15, each reached from the hall by a road that runs both ways', () => {
    const area = FLOORS.ascent_f15.areaId;
    for (const id of HUB_NEW) {
      expect(SPOTS[id], `${id} exists`).toBeDefined();
      expect(SPOTS[id].areaId, `${id} lies on floor 15`).toBe(area);
      expect(ADJACENCY.get('f15_hall')!.some((e) => e.to === id), `hall -> ${id}`).toBe(true);
      expect(ADJACENCY.get(id)!.some((e) => e.to === 'f15_hall'), `${id} -> hall`).toBe(true);
    }
    const hall = SPOTS.f15_hall;
    for (const id of HUB) {
      const edge = hall.connections.find((c) => c.to === id);
      expect(edge, `the hall declares the road to ${id}`).toBeDefined();
      expect(edge!.ticks, `${id} is a short walk`).toBeLessThanOrEqual(20);
      expect(edge!.oneWay, `${id} is not a one-way road`).toBeFalsy();
    }
  });

  it('the dark room’s door to the hall is as it was', () => {
    const door = SPOTS.f15_dark_room.connections.find((c) => c.to === 'f15_hall')!;
    expect(door.ticks).toBe(20);
    expect(door.requires).toEqual([{ type: 'stat', key: 'festival:door', value: 1 }]);
    expect(door.revealWhen).toEqual([{ type: 'stat', key: 'festival:door', value: 1 }]);
  });

  it('floor 15 passes the floor rules: the gallery’s stair is the wing’s one-way way back to the dark room', () => {
    const stair = SPOTS.f15_gallery.connections.find((c) => c.to === 'f15_dark_room');
    expect(stair?.oneWay).toBe(true);
    expect(floorStructureIssues(FLOORS.ascent_f15, SPOTS, ADJACENCY).issues).toEqual([]);
  });

  it('the map places every floor-15 spot on the canvas, apart from each other', () => {
    const spots = Object.values(SPOTS).filter((s) => s.areaId === FLOORS.ascent_f15.areaId);
    expect(spots.length).toBe(2 + HUB.length);
    for (const s of spots) {
      expect(s.map, `${s.id} has a map position`).toBeDefined();
      expect(s.map!.x).toBeGreaterThanOrEqual(0);
      expect(s.map!.x).toBeLessThanOrEqual(100);
      expect(s.map!.y).toBeGreaterThanOrEqual(0);
      expect(s.map!.y).toBeLessThanOrEqual(75);
    }
    for (const a of spots) {
      for (const b of spots) {
        if (a.id >= b.id) continue;
        const apart = Math.hypot(a.map!.x - b.map!.x, a.map!.y - b.map!.y);
        expect(apart, `${a.id} and ${b.id} are ${apart.toFixed(1)} apart`).toBeGreaterThanOrEqual(15);
      }
    }
  });

  it('every spot has a description', () => {
    for (const id of ['f15_hall', ...HUB]) expect(SPOTS[id].desc, `${id}.desc`).toBeTruthy();
  });

  it('the workshop holds the alchemy and forging benches and the smelt; the hall keeps its stove', () => {
    expect(SPOTS.f15_workshop.benches).toEqual(['alchemy', 'forging']);
    expect(SPOTS.f15_workshop.recipes).toContain('iron_ingot');
    expect(SPOTS.f15_hall.benches).toEqual(['cooking']);
  });

  it('the gallery trains several attributes at once, and has a rest', () => {
    const acts = SPOTS.f15_gallery.activities;
    const train = acts.find((a) => a.kind === 'train');
    expect(train).toBeDefined();
    const weights = Object.entries((train as { attrXp?: Record<string, number> }).attrXp ?? {}).filter(([, w]) => w > 0);
    expect(weights.length).toBeGreaterThanOrEqual(3);
    expect(acts.some((a) => a.kind === 'rest')).toBe(true);
  });
});

describe('the hub’s stock', () => {
  it('every restocked spot exists and holds a search, and every hub search is restocked', () => {
    for (const id of FESTIVAL_RESTOCK) {
      expect(SPOTS[id], `${id} exists`).toBeDefined();
      expect(searchesOf(SPOTS[id]).length, `${id} has a search`).toBeGreaterThan(0);
    }
    const hubSearches = HUB.filter((id) => searchesOf(SPOTS[id]).length > 0);
    expect(hubSearches.sort()).toEqual([...FESTIVAL_RESTOCK].sort());
  });

  it('every reward is limited, so the stock is finite', () => {
    for (const { spot, act } of restocked()) {
      for (const r of act.rewards) expect(r.limit, `${spot}/${act.id}/${r.id}`).toBeGreaterThan(0);
    }
  });

  it('every search runs on the clock: a fast body does not shorten the ten days', () => {
    for (const { spot, act } of restocked()) {
      expect((act as { staticTime?: boolean }).staticTime, `${spot}/${act.id}`).toBe(true);
    }
  });

  it('the stores pay about twelve finds', () => {
    const stores = restocked().find((r) => r.spot === 'f15_stores')!;
    expect(stores.finds).toBe(12);
    expect(stores.ticks).toBe(4 * HOUR);
  });

  it('the herb yard pays about eight finds, every one a reagent the alembic reads', () => {
    const yard = restocked().find((r) => r.spot === 'f15_herb_yard')!;
    expect(yard.finds).toBe(8);
    for (const r of yard.act.rewards) {
      const id = r.material!.id;
      expect(REAGENTS[id], `${id} is a reagent`).toBeDefined();
      expect(MATERIALS[id].craftTags, `${id} carries the reagent tag`).toContain('reagent');
    }
  });

  it('the workshop pays six finds, each one a bench takes: scrap smelts, the rest goes to the anvil or the alembic', () => {
    const shop = restocked().find((r) => r.spot === 'f15_workshop')!;
    expect(shop.finds).toBe(6);
    const smelts = new Set(
      (SPOTS.f15_workshop.recipes ?? []).flatMap((id) => RECIPES[id].cost.map((c) => c.id)),
    );
    for (const r of shop.act.rewards) {
      const id = r.material!.id;
      const m = MATERIALS[id];
      const anvil = !!m.smith && (m.craftTags ?? []).some((t) => ['metal', 'wood', 'leather'].includes(t));
      expect(smelts.has(id) || anvil || !!REAGENTS[id], `${id} has a use at the workshop`).toBe(true);
    }
    // The smelt turns the scrap into ingots the anvil takes.
    const scrap = shop.act.rewards.filter((r) => r.material!.id === 'iron_scrap');
    const scrapQty = scrap.reduce((n, r) => n + (r.limit ?? 0) * (r.material!.qty ?? 1), 0);
    const smelt = RECIPES.iron_ingot;
    expect(smelt.cost).toEqual([{ id: 'iron_scrap', qty: 3 }]);
    expect(Math.floor(scrapQty / 3), 'ingots from the scrap').toBeGreaterThanOrEqual(4);
  });

  it('the survey pays one find per royale section, each setting that section’s scouted flag', () => {
    const survey = restocked().find((r) => r.spot === 'f15_survey')!;
    expect(survey.ticks).toBe(12 * HOUR);
    const sections = Object.keys(ROYALE_SECTIONS);
    expect(sections).toHaveLength(8);
    expect(survey.act.rewards.map((r) => r.id)).toEqual(sections);
    for (const r of survey.act.rewards) {
      expect(r.limit).toBe(1);
      expect(r.stat).toEqual({ key: scoutedKey(r.id), set: 1 });
      expect(r.desc, `${r.id} says what the scouting shows`).toMatch(/caches and dens/);
    }
  });

  it('a full clear plus the benches takes 8 to 10 of the 10 days', () => {
    const searches = restocked().reduce((n, r) => n + r.finds * r.ticks, 0);
    const survey = restocked().find((r) => r.spot === 'f15_survey')!;
    expect(survey.finds * survey.ticks, 'the survey alone is four days').toBe(4 * DAY);
    expect(PREP_TICKS).toBe(10 * DAY);
    const days = (searches + BENCH_ALLOWANCE) / DAY;
    expect(days, `${days.toFixed(2)} days`).toBeGreaterThanOrEqual(8);
    expect(days).toBeLessThanOrEqual(10);
  });
});

describe('a new attempt restocks the hub', () => {
  it('resets every restocked search’s limits and clears the scouted flags', () => {
    const s = strong(atFourteen());
    // A previous attempt's leavings: every limit spent, every section scouted.
    for (const { spot, act } of restocked()) {
      const key = searchKey(spot, act.id);
      s.stats[key] = 9;
      for (const r of act.rewards) s.stats[`${key}:${r.id}`] = r.limit!;
    }
    for (const id of Object.keys(ROYALE_SECTIONS)) s.stats[scoutedKey(id)] = 1;
    // A flag outside the festival's namespace is left alone.
    s.stats['flag:festival:unrelated'] = 3;

    const game = new Game(s);
    climb(game, DARK_FLOOR);
    expect(festivalRun(game.state), 'the attempt started').toBeDefined();

    for (const { spot, act } of restocked()) {
      const key = searchKey(spot, act.id);
      expect(game.state.stats[key] ?? 0, `${key} reset`).toBe(0);
      expect(searchSpent(game.state, spot, act), `${spot}/${act.id} can be searched again`).toBe(false);
      for (const r of act.rewards) expect(game.state.stats[`${key}:${r.id}`] ?? 0, `${key}:${r.id} reset`).toBe(0);
    }
    for (const id of Object.keys(ROYALE_SECTIONS)) expect(game.state.stats[scoutedKey(id)] ?? 0, id).toBe(0);
    expect(game.state.stats['flag:festival:unrelated']).toBe(3);
  });
});

describe('the hub played through', () => {
  it('a full clear of the searches takes the budgeted clock, whatever the body’s speed', () => {
    const game = inHall();
    const s = game.state;
    const run = festivalRun(s)!;
    const safe = { ...s.safeSpots };
    const start = run.clock;
    let searchTicks = 0;

    for (const { spot, act, finds, ticks } of restocked()) {
      // The map's route: a click on a spot two roads away walks through the hall.
      expect(game.goAndDo(spot, act.id), `go to ${spot}`).toBe(true);
      tickUntil(game, () => s.spot === spot && !s.travel && s.activity === act.id, 500);
      // Stop at the last find: a search left running spends one more cycle finding nothing.
      const took = tickUntil(game, () => searchSpent(s, spot, act));
      game.selectActivity(null);
      searchTicks += took;
      // One find per cycle, to the tick.
      expect(took, `${act.id}`).toBeGreaterThanOrEqual(finds * ticks - 8);
      expect(took, `${act.id}`).toBeLessThanOrEqual(finds * ticks + 8);
    }

    // The survey scouted all eight sections.
    for (const id of Object.keys(ROYALE_SECTIONS)) expect(s.stats[scoutedKey(id)], id).toBe(1);
    // What the searches paid is in hand: scrap, wood, hide, spirit, water.
    expect(s.materials.iron_scrap).toBe(15);
    expect(s.materials.hardwood).toBe(3);
    expect(s.materials.leather).toBe(2);
    expect(Object.values(s.stock.healing_salve ?? {}).reduce((n, c) => n + (c ?? 0), 0)).toBe(2);

    // The searches alone leave the budgeted clock, plus the walking, in the ten days.
    const elapsed = run.clock - start;
    expect(elapsed).toBeGreaterThanOrEqual(searchTicks - 8);
    expect(elapsed / DAY).toBeGreaterThan(8);
    expect(elapsed / DAY).toBeLessThan(9);
    expect(run.phase).toBe('prep');

    // The smelt takes the scrap three to an ingot, at the workshop.
    expect(game.goAndDo('f15_workshop', 'craft_iron_ingot')).toBe(true);
    tickUntil(game, () => s.spot === 'f15_workshop' && !s.travel && s.activity === 'craft_iron_ingot', 500);
    tickUntil(game, () => (s.materials.iron_ingot ?? 0) >= 5);
    game.selectActivity(null);
    expect(s.materials.iron_ingot).toBe(5);
    expect(s.materials.iron_scrap ?? 0).toBe(0);

    // No hub spot is a haven: a knockout does not land back in the hall.
    expect(s.safeSpots).toEqual(safe);
    // 120,000 ticks through the whole game loop: seconds alone, longer under a full run.
  }, 60_000);

  it('the gallery trains Constitution, Intelligence and Wisdom together', () => {
    const game = inHall();
    const s = game.state;
    goTo(game, 'f15_gallery');
    const mark = () => Object.fromEntries(ATTRIBUTE_LIST.map((a) => [a.id, { ...s.attrs[a.id] }]));
    const before = mark();
    game.selectActivity('train_f15_gallery');
    for (let i = 0; i < 200; i++) game.tick();
    const after = mark();
    // A level gained resets the bar, so a gain is a higher level or more XP at the same level.
    const gained = (id: string) =>
      after[id].level > before[id].level || (after[id].level === before[id].level && after[id].xp > before[id].xp);
    for (const id of ['con', 'int', 'wis']) expect(gained(id), `${id} trained`).toBe(true);
    for (const id of ['str', 'dex', 'cha']) expect(gained(id), `${id} untouched`).toBe(false);
    expect(spotActivities(SPOTS.f15_gallery).some((a) => a.id === 'rest_f15_gallery')).toBe(true);
  });

  it('the gallery’s stair leads down to the dark room without starting another attempt', () => {
    const game = inHall();
    const s = game.state;
    goTo(game, 'f15_gallery');
    const run = festivalRun(s);
    goTo(game, 'f15_dark_room');
    expect(festivalRun(s)).toBe(run);
    expect(festivalRun(s)!.phase).toBe('prep');
  });
});
