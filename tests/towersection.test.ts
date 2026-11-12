import { beforeAll, describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { Component } from 'svelte';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { AREAS, BANDS, FLOORS, FLOOR_BY_AREA, SPOTS, TOWERS } from '../src/core/registry';
import { DARK_FLOOR, DARK_ROOM, ROYALE_FLOOR } from '../src/core/data/festival.data';
import { ATTRIBUTE_LIST } from '../src/core/data/attributes.data';
import { TUTORIAL_DONE_KEY } from '../src/core/data/tutorial.data';
import { getDerivedStats } from '../src/core/systems/derived';
import { floorReached, rungStatus } from '../src/core/systems/ladder';
import { rideTicks } from '../src/core/systems/towers';
import { festivalLadder, festivalRun, lockoutLeft } from '../src/core/systems/festivalRules';
import { prestigeNow } from '../src/core/systems/prestige';
import { ticksToTime } from '../src/ui/lib/format';
import { buildPlan } from '../src/ui/lib/mapPlan';
import { labelBox, pinBox, PLAN_HEIGHT, type MapBox } from '../src/ui/lib/map';
import {
  DETAIL_GAP,
  DETAIL_H,
  bandDrawnOpen,
  bandHubView,
  defaultStackArea,
  ladderBands,
  regionOfTower,
  rideDuration,
  rideLabel,
  rungView,
  stackAreas,
  stopKeyOfArea,
  stopViewOf,
  towerHubView,
  towerOfRegion,
  towerSection,
  type RideAction,
  type StopView,
} from '../src/ui/lib/ladderView';
import { bandIsOpen, resetFoldChoices, setBandOpen } from '../src/ui/lib/ladderFold.svelte';
import { SECTION_MIN_WIDTH, viewport } from '../src/ui/lib/viewport.svelte';
import type { GameState } from '../src/core/types';
import { clearFloors } from './fixtures/floors';

/**
 * The tower section (docs/NAVIGATION.md §3.5; plans/navigation-alternatives.md
 * N4): the rows it draws, the one source (`rungView`) it shares with the Ascent
 * panel, the 600 px rule, and the floor 0 tutorial staying clear of it.
 */

const ASCENT = TOWERS.the_ascent;
const FOOT = ASCENT.hubSpot;
const fresh = (): GameState => createInitialState(0, FOOT);

/** Floors 1 to n of the Ascent, by id. */
const floorsUpTo = (n: number): string[] => Array.from({ length: n }, (_, i) => `ascent_f${i + 1}`);

/** Stamp the counters floors 1 to n clear on and open on, as if climbed. */
function climbed(s: GameState, n: number): GameState {
  clearFloors(s.stats, floorsUpTo(n));
  for (const id of floorsUpTo(n)) {
    for (const c of FLOORS[id].gate ?? []) if (c.type === 'stat') s.stats[c.key] = Math.max(s.stats[c.key] ?? 0, c.value);
  }
  return s;
}

/** Stand on a floor's landing, found. */
function stoodOn(s: GameState, spot: string): GameState {
  s.spot = spot;
  if (!s.discovered.includes(spot)) s.discovered.push(spot);
  return s;
}

/** The section's rows for the default fold (a foldable band folds). */
const sectionOf = (s: GameState) => towerSection(s, ASCENT, (_id, foldable) => bandDrawnOpen(foldable, undefined));

function strong(s: GameState): GameState {
  for (const a of ATTRIBUTE_LIST) s.attrs[a.id].level = 400;
  s.resources.hp = getDerivedStats(s).maxHp;
  return s;
}

// ---------- States to judge a ride in ----------

/** Floor 14 with everything below it cleared: the festival's door is the next climb. */
function atFourteen(): GameState {
  const s = fresh();
  clearFloors(s.stats, Object.values(FLOORS).filter((f) => f.bandId !== undefined && f.index < 15).map((f) => f.id));
  s.prestige.purchases.city_key = 1;
  return stoodOn(s, FLOORS.ascent_f14.landing!);
}

/** An attempt just begun: the player in the dark room, the door shut. */
function inDarkRoom(): GameState {
  const game = new Game(strong(atFourteen()));
  expect(game.climbTo(DARK_FLOOR)).toBe(true);
  for (let i = 0; i < 2000 && game.state.travel; i++) game.tick();
  expect(game.state.spot).toBe(DARK_ROOM);
  expect(festivalRun(game.state)?.phase).toBe('dark');
  return game.state;
}

const SCENARIOS: { name: string; make: () => GameState }[] = [
  { name: 'at the Foot, nothing climbed', make: fresh },
  { name: 'at the Foot, floors 1 to 5 cleared', make: () => climbed(fresh(), 5) },
  { name: 'on floor 4, floors 1 to 6 cleared', make: () => stoodOn(climbed(fresh(), 6), FLOORS.ascent_f4.landing!) },
  { name: 'on floor 1, nothing cleared', make: () => stoodOn(fresh(), FLOORS.ascent_f1.landing!) },
  {
    name: 'at the castle court, the city key owned',
    make: () => {
      const s = climbed(fresh(), 6);
      s.prestige.purchases.city_key = 1;
      return stoodOn(s, 'castle_court');
    },
  },
  { name: 'in the city, off the ladder', make: () => stoodOn(climbed(fresh(), 6), 'the_forges') },
  { name: 'on floor 14, the festival next', make: atFourteen },
  {
    name: 'at the Foot after a lost attempt',
    make: () => {
      const s = atFourteen();
      s.spot = FOOT;
      s.festival = { lockedUntil: s.totalTicks + 5000 };
      return s;
    },
  },
  { name: 'in the dark room, the door shut', make: inDarkRoom },
  {
    name: 'in the hall, the royale open',
    make: () => {
      const s = inDarkRoom();
      // The dark room emptied: floor 15 is cleared and the door to floor 16 opens.
      clearFloors(s.stats, ['ascent_f15']);
      festivalRun(s)!.phase = 'prep';
      return s;
    },
  },
];

/** The keys of every stop of the Ascent: each floor, the castle's hub, the Foot. */
const KEYS = [...Object.values(FLOORS).filter((f) => f.bandId !== undefined).map((f) => f.id), 'band:ascent_upper', 'hub'];

/** Whether the core takes the ride a key names from `state`. */
function accepted(state: GameState, key: string): { ok: boolean; total: number | null } {
  const game = new Game(structuredClone(state));
  const ok = key === 'hub' ? game.climbTo(null) : key.startsWith('band:') ? game.climbToHub(key.slice(5)) : game.climbTo(key);
  return { ok, total: game.state.travel?.total ?? null };
}

describe('the stop views are the core’s gate, not a copy of it', () => {
  for (const sc of SCENARIOS) {
    it(`${sc.name}: a button is offered exactly where climbTo takes the ride`, () => {
      const state = sc.make();
      const problems: string[] = [];
      for (const key of KEYS) {
        const view = stopViewOf(state, ASCENT, key)!;
        expect(view, key).not.toBeNull();
        // The panel never offers the rung underfoot, and neither does the section.
        if (view.current) {
          expect(view.action, `${key} underfoot`).toBeNull();
          continue;
        }
        const core = accepted(state, key);
        if (!!view.action !== core.ok) problems.push(`${key}: view ${view.action?.kind ?? 'none'}, climbTo ${core.ok}`);
      }
      expect(problems).toEqual([]);
    });

    it(`${sc.name}: the kind is the festival's verdict and the price is the one climbTo charges`, () => {
      const state = sc.make();
      const speed = getDerivedStats(state).travelSpeed;
      for (const key of KEYS) {
        const view = stopViewOf(state, ASCENT, key)!;
        const action = view.action;
        if (!action) continue;
        const toFloor = 'band' in action.target ? null : action.target.floor;
        const verdict = 'band' in action.target ? festivalLadder(state, null) : festivalLadder(state, toFloor);
        expect(action.kind, `${key} kind`).toBe(verdict === 'forfeit' ? 'forfeit' : verdict === 'royale' ? 'royale' : 'ride');
        // A forfeit is an ejection, not a ride: only the rides have a price to compare.
        if (action.kind === 'forfeit') continue;
        const core = accepted(state, key);
        expect(core.total, `${key} price`).toBe(rideDuration(action, speed));
      }
    });
  }

  it('a ride takes at least one tick and rounds as the core does', () => {
    const action = { baseTicks: 45 } as RideAction;
    expect(rideDuration(action, 1)).toBe(45);
    expect(rideDuration(action, 2)).toBe(Math.max(1, Math.round(45 / 2)));
    expect(rideDuration(action, 1000)).toBe(1);
    // The one price table the ride and the label both read.
    expect(rideTicks(4, 5)).toBe(45);
  });

  it('prices from where the player stands: the Foot is 18 s from floor 4, floor 5 is 5 s', () => {
    const s = stoodOn(climbed(fresh(), 6), FLOORS.ascent_f4.landing!);
    expect(rideDuration(towerHubView(s, ASCENT).action!, 1)).toBe(4 * 45);
    expect(rideDuration(rungView(s, FLOORS.ascent_f5).action!, 1)).toBe(45);
    expect(rideDuration(rungView(s, FLOORS.ascent_f1).action!, 1)).toBe(3 * 45);
  });
});

describe('what the button says', () => {
  const action = (kind: RideAction['kind'], verb = 'Climb', forfeitVerb = verb): RideAction => ({
    key: 'k',
    kind,
    verb,
    forfeitVerb,
    baseTicks: 45,
    target: { floor: 'ascent_f5' },
  });

  it('a ride reads its verb and its time at the travel speed', () => {
    expect(rideLabel(action('ride'), false, 1)).toBe('Climb · 5s');
    expect(rideLabel(action('ride', 'Descend'), false, 1.5)).toBe(`Descend · ${ticksToTime(30)}`);
  });

  it('the royale and the forfeit read as the Ascent panel always has', () => {
    expect(rideLabel(action('royale'), false, 1)).toBe('Enter the royale · 5s');
    expect(rideLabel(action('forfeit', 'Climb'), false, 1)).toBe('Forfeit · Climb');
    expect(rideLabel(action('forfeit', 'Descend', 'Leave the tower'), false, 1)).toBe('Forfeit · Leave the tower');
    expect(rideLabel(action('forfeit'), true, 1)).toBe('Confirm: forfeit the festival');
  });

  it('inside an attempt every other stop is a forfeit and the hub says it leaves the tower', () => {
    const s = inDarkRoom();
    const hub = towerHubView(s, ASCENT).action!;
    expect(hub.kind).toBe('forfeit');
    expect(rideLabel(hub, false, 1)).toBe('Forfeit · Leave the tower');
    // Every hub is outside the festival: from inside an attempt it is a forfeit too.
    expect(bandHubView(s, BANDS.ascent_upper).action?.kind).toBe('forfeit');
    expect(rungView(s, FLOORS.ascent_f14).action?.kind).toBe('forfeit');
    // The door onto floor 16 is shut while the dark room fights, and the section offers nothing there.
    expect(rungView(s, FLOORS[ROYALE_FLOOR]).action).toBeNull();
  });
});

describe('the tower section: rows from the ladder, nothing the panel does not show', () => {
  /** A row as `id` or `id?` (a floor shown by its number only). */
  const shape = (s: GameState) =>
    sectionOf(s).groups.map((g) => [
      g.band.id,
      g.titleOnly,
      g.rows.map((r) => (r.kind === 'floor' ? (r.name ? r.key : `${r.key}?`) : r.key)),
    ]);

  it('a fresh run: the Wilds by name only, band 1 with floor 1 named and the rest numbers, highest first', () => {
    expect(shape(fresh())).toEqual([
      ['ascent_middle', true, []],
      ['ascent_lower', false, ['ascent_f3?', 'ascent_f2?', 'ascent_f1']],
    ]);
    expect(sectionOf(fresh()).foot.key).toBe('hub');
  });

  it('floors 1 to 6 cleared: the city in full with its hub last, the harbor by name, nothing above', () => {
    const s = climbed(fresh(), 6);
    expect(shape(s)).toEqual([
      ['ascent_harbor', true, []],
      ['ascent_upper', false, ['ascent_f10', 'ascent_f9', 'ascent_f8', 'ascent_f7', 'band:ascent_upper']],
      ['ascent_middle', false, ['ascent_f6', 'ascent_f5', 'ascent_f4']],
      ['ascent_lower', false, ['ascent_f3', 'ascent_f2', 'ascent_f1']],
    ]);
  });

  it('draws the rows of the panel’s cards and no others, with the floor numbers and names the panel prints', () => {
    for (let n = 0; n <= 16; n++) {
      const s = climbed(fresh(), n);
      const cards = ladderBands(s, ASCENT).flatMap((lb) =>
        lb.cards.map((c) => (c.kind === 'floor' ? c.floor.id : `band:${c.band.id}`)),
      );
      const rows = sectionOf(s).groups.flatMap((g) => g.rows.map((r) => r.key));
      expect(rows.sort(), `after ${n} floors`).toEqual(cards.sort());
      for (const g of sectionOf(s).groups) {
        for (const r of g.rows) {
          if (r.kind !== 'floor') continue;
          // Named exactly when the panel names it: a floor not reached is its number.
          expect(r.name !== null, `${r.key} after ${n}`).toBe(floorReached(s, FLOORS[r.key]));
          expect(r.number).toBe(FLOORS[r.key].index);
        }
      }
    }
  });

  it('prints no name, area or level for a floor not reached, and no row under the next band', () => {
    for (let n = 0; n <= 16; n++) {
      for (const owned of [false, true]) {
        const s = climbed(fresh(), n);
        if (owned) s.prestige.purchases.city_key = 1;
        const section = sectionOf(s);
        // The rows: a band header may carry the name of the floor inside it (floor 17's band is "Floor 17").
        const text = JSON.stringify(section.groups.flatMap((g) => g.rows));
        for (const floor of Object.values(FLOORS)) {
          if (floor.bandId === undefined || floorReached(s, floor)) continue;
          expect(text, `${floor.name} after ${n}`).not.toContain(floor.name);
          expect(text, `${AREAS[floor.areaId].name} after ${n}`).not.toContain(AREAS[floor.areaId].name);
        }
        // A level range would print rooms the player has not entered (plan §6 row 7).
        expect(text).not.toMatch(/\bL\d+\s?[-–]\s?\d+/);
        for (const g of section.groups) if (g.titleOnly) expect(g.rows).toEqual([]);
        // The next band is the highest group, and nothing is above it.
        const above = section.groups.findIndex((g) => g.titleOnly);
        expect(above === -1 || above === 0).toBe(true);
      }
    }
  });

  it('the row underfoot is marked, and only it', () => {
    const here = (s: GameState) =>
      [...sectionOf(s).groups.flatMap((g) => g.rows), sectionOf(s).foot].filter((r) => r.current).map((r) => r.key);
    expect(here(stoodOn(climbed(fresh(), 6), FLOORS.ascent_f4.landing!))).toEqual(['ascent_f4']);
    expect(here(fresh())).toEqual(['hub']);
    const court = climbed(fresh(), 6);
    court.prestige.purchases.city_key = 1;
    expect(here(stoodOn(court, 'castle_court'))).toEqual(['band:ascent_upper']);
    expect(here(stoodOn(climbed(fresh(), 6), 'the_forges'))).toEqual([]);
  });

  it('a stop that has no ride says why when the player stands off the ladder', () => {
    const s = stoodOn(climbed(fresh(), 6), 'the_forges');
    const view = rungView(s, FLOORS.ascent_f4);
    expect(view.action).toBeNull();
    expect(view.note).toBe('Rides start at The Foot of the Ascent or on a floor of the tower.');
    // On the ladder there is nothing to explain.
    expect(rungView(fresh(), FLOORS.ascent_f1).note).toBeNull();
    // A floor that is shut says its terms, not the ladder's absence.
    expect(rungView(s, FLOORS.ascent_f7).note).toBeNull();
  });
});

describe('the tower section: folds by the ladder’s rules', () => {
  const group = (s: GameState, id: string, open = (_id: string, foldable: boolean) => bandDrawnOpen(foldable, undefined)) =>
    towerSection(s, ASCENT, open).groups.find((g) => g.band.id === id)!;

  it('cleared bands fold, the one underfoot and the ones with a live term do not', () => {
    const s = stoodOn(climbed(fresh(), 6), FLOORS.ascent_f4.landing!);
    expect(group(s, 'ascent_lower')).toMatchObject({ foldable: true, open: false, cleared: 3, total: 3 });
    expect(group(s, 'ascent_middle')).toMatchObject({ foldable: false, open: true });
    expect(group(s, 'ascent_upper')).toMatchObject({ foldable: false, open: true, cleared: 0, total: 4 });
    expect(group(s, 'ascent_harbor')).toMatchObject({ titleOnly: true, open: false });
  });

  it('the same fold store drives both places: the player’s choice opens a foldable band and nothing else', () => {
    resetFoldChoices();
    const s = climbed(fresh(), 6);
    expect(group(s, 'ascent_lower', bandIsOpen).open).toBe(false);
    setBandOpen('ascent_lower', true, true);
    expect(group(s, 'ascent_lower', bandIsOpen).open).toBe(true);
    // A band that may not fold stays open whatever was chosen.
    setBandOpen('ascent_upper', false, false);
    expect(group(s, 'ascent_upper', bandIsOpen).open).toBe(true);
    resetFoldChoices();
  });
});

describe('the festival on the ladder', () => {
  it('floor 16 outside an attempt is a door with no button, and a lockout shuts both floors', () => {
    const s = atFourteen();
    clearFloors(s.stats, ['ascent_f15']);
    expect(rungStatus(s, FLOORS.ascent_f16)).toBe('open');
    expect(festivalLadder(s, ROYALE_FLOOR)).toBe('closed');
    const door = rungView(s, FLOORS.ascent_f16);
    expect(door.mark).toBe('door');
    expect(door.action).toBeNull();
    expect(door.terms[0].text).toBe('Entered from floor 15’s hall, during a festival attempt.');

    s.festival = { lockedUntil: s.totalTicks + 5000 };
    for (const id of ['ascent_f15', 'ascent_f16']) {
      const v = rungView(s, FLOORS[id]);
      expect(v.mark, id).toBe('locked');
      expect(v.action, id).toBeNull();
      expect(v.terms[0].text).toMatch(/^Shut after a lost festival attempt/);
    }
  });

  it('the hall’s climb into the royale reads as an entry once the dark room is empty', () => {
    const s = inDarkRoom();
    clearFloors(s.stats, ['ascent_f15']);
    festivalRun(s)!.phase = 'prep';
    const v = rungView(s, FLOORS[ROYALE_FLOOR]);
    expect(v.action?.kind).toBe('royale');
    expect(rideLabel(v.action!, false, 1)).toBe('Enter the royale · 5s');
  });
});

describe('which area a region draws, and which stop an area is', () => {
  it('the Ascent draws its floors and the castle, bottom to top; the city and the cell are not stacks', () => {
    const areas = stackAreas('the_ascent');
    expect(areas[0]).toBe('ascent_f1_area');
    expect(areas.indexOf('ascent_castle_area')).toBe(areas.indexOf('ascent_f6_area') + 1);
    expect(areas.indexOf('ascent_f7_area')).toBe(areas.indexOf('ascent_castle_area') + 1);
    expect(areas.filter((a) => FLOOR_BY_AREA.has(a)).length).toBe(20);
    expect(stackAreas('threshold')).toEqual([]);
    expect(stackAreas('holding_level')).toEqual([]);
    expect(towerOfRegion('the_ascent')).toBe(ASCENT);
    expect(towerOfRegion('threshold')).toBeNull();
    expect(towerOfRegion('holding_level')).toBeNull();
    expect(regionOfTower(ASCENT)).toBe('the_ascent');
  });

  it('an area is a floor, or the castle’s hub, or no stop', () => {
    expect(stopKeyOfArea('ascent_f4_area')).toBe('ascent_f4');
    expect(stopKeyOfArea('ascent_castle_area')).toBe('band:ascent_upper');
    // Floor 0 is off the ladder: no row, no detail.
    expect(stopKeyOfArea('ascent_f0_area')).toBeNull();
    expect(stopKeyOfArea('the_ironyard')).toBeNull();
    expect(stopViewOf(fresh(), ASCENT, 'ascent_f0')).toBeNull();
    expect(stopViewOf(fresh(), ASCENT, 'nothing')).toBeNull();
    expect(stopViewOf(fresh(), ASCENT, null)).toBeNull();
  });
});

// ---------- The plan's height ----------

describe('the plan keeps a height the section’s detail can stand in', () => {
  const overlaps = (a: MapBox, b: MapBox) => Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0);

  it('a region with no section is as tall as a tower region’s plan and detail together', () => {
    const s = fresh();
    s.discovered = Object.keys(SPOTS);
    const tall = PLAN_HEIGHT + DETAIL_H + DETAIL_GAP;
    const city = buildPlan(s, { region: 'threshold', area: null, width: 773, height: tall, tiled: false, focus: FOOT, target: null });
    expect(city.frame.h).toBe(tall);
    // Without the option a diagram is PLAN_HEIGHT, as it always was; a tiled picture ignores it.
    expect(buildPlan(s, { region: 'threshold', area: null, width: 773, tiled: false, focus: FOOT, target: null }).frame.h).toBe(PLAN_HEIGHT);
    expect(buildPlan(s, { region: 'holding_level', area: null, width: 560, height: tall, tiled: true, focus: FOOT, target: null }).frame.h).toBe(470);
  });

  it('Threshold at that height keeps every name clear of pins, names and chips at the measured widths', () => {
    const s = fresh();
    s.discovered = Object.keys(SPOTS);
    const problems: string[] = [];
    for (const width of [703, 757, 773, 1237]) {
      const plan = buildPlan(s, {
        region: 'threshold',
        area: null,
        width,
        height: PLAN_HEIGHT + DETAIL_H + DETAIL_GAP,
        tiled: false,
        focus: FOOT,
        target: null,
      });
      const named = plan.nodes
        .filter((n) => n.label)
        .map((n) => ({ id: n.id, box: labelBox(n.label!.threat ? `${n.label!.name} · ${n.label!.threat}` : n.label!.name, n.label!, plan.frame.font) }));
      for (const a of named) {
        const at = `@${width}: ${a.id}`;
        if (a.box.x0 < 0 || a.box.x1 > plan.frame.w || a.box.y0 < 0 || a.box.y1 > plan.frame.h) problems.push(`${at} outside the frame`);
        for (const o of named) if (o.id > a.id && overlaps(a.box, o.box)) problems.push(`${at} on the name of ${o.id}`);
        for (const n of plan.nodes) if (n.id !== a.id && overlaps(a.box, pinBox(n, plan.frame.pinR))) problems.push(`${at} on the ${n.id} pin`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('every floor, drawn at the widths the section leaves it (column less 192 px), touches nothing', () => {
    const problems: string[] = [];
    // 300 to 700 in steps of 10, and the widths measured at 1094 (581), 1440 with the log open (565) and 1024 (511).
    const widths = [511, 565, 581];
    for (let w = 300; w <= 700; w += 10) widths.push(w);
    for (const area of Object.values(AREAS)) {
      if (!stackAreas('the_ascent').includes(area.id)) continue;
      const spot = Object.values(SPOTS).find((sp) => sp.map && sp.areaId === area.id);
      if (!spot) continue;
      const s = createInitialState(1, spot.id);
      s.discovered = Object.keys(SPOTS);
      for (const width of widths) {
        const plan = buildPlan(s, { region: area.regionId, area: area.id, width, tiled: false, focus: s.spot, target: null });
        const named = plan.nodes
          .filter((n) => n.label)
          .map((n) => ({ id: n.id, box: labelBox(n.label!.threat ? `${n.label!.name} · ${n.label!.threat}` : n.label!.name, n.label!, plan.frame.font) }));
        const chips = plan.nodes.flatMap((n) => [...n.chips, ...(n.more ? [n.more] : [])].map((c) => ({ id: n.id, box: { x0: c.x - 8, y0: c.y - 8, x1: c.x + 8, y1: c.y + 8 } })));
        for (const a of named) {
          const at = `${area.id} @${width}: ${a.id}`;
          if (a.box.x0 < 0 || a.box.x1 > plan.frame.w || a.box.y0 < 0 || a.box.y1 > plan.frame.h) problems.push(`${at} outside the frame`);
          for (const o of named) if (o.id > a.id && overlaps(a.box, o.box)) problems.push(`${at} on the name of ${o.id}`);
          for (const n of plan.nodes) if (n.id !== a.id && overlaps(a.box, pinBox(n, plan.frame.pinR))) problems.push(`${at} on the ${n.id} pin`);
          for (const c of chips) if (overlaps(a.box, c.box)) problems.push(`${at} on a chip of ${c.id}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  /**
   * Floor 17 is the densest floor: 18 spots, and below 560 px a plan names only the
   * spot underfoot and its neighbours, so the names drawn depend on where the player
   * stands. The test above stands on the first spot only. This one stands on every
   * spot at every integer width from a phone column to the widest the section leaves.
   */
  it('floor 17 keeps every name clear of pins, names and chips from every spot, at every width 320 to 700', () => {
    const area = 'ascent_f17_area';
    const spots = Object.values(SPOTS).filter((sp) => sp.map && sp.areaId === area);
    expect(spots.length).toBe(18);
    const grown = (b: MapBox, by: number): MapBox => ({ x0: b.x0 - by, y0: b.y0 - by, x1: b.x1 + by, y1: b.y1 + by });
    const problems: string[] = [];
    for (const spot of spots) {
      const s = createInitialState(1, spot.id);
      s.discovered = Object.keys(SPOTS);
      for (let width = 320; width <= 700; width++) {
        const plan = buildPlan(s, { region: AREAS[area].regionId, area, width, tiled: false, focus: spot.id, target: null });
        const named = plan.nodes
          .filter((n) => n.label)
          .map((n) => ({ id: n.id, box: labelBox(n.label!.threat ? `${n.label!.name} · ${n.label!.threat}` : n.label!.name, n.label!, plan.frame.font) }));
        const chips = plan.nodes.flatMap((n) => [...n.chips, ...(n.more ? [n.more] : [])].map((c) => ({ id: n.id, box: { x0: c.x - 8, y0: c.y - 8, x1: c.x + 8, y1: c.y + 8 } })));
        for (const a of named) {
          // The estimator errs wide on both faces, so touching boxes are a real overlap
          // only by a pixel or two. The landing's and the hamlet gates' names overlapped by
          // 2 to 3 px in the browser at 670 to 700, and the landing's touched two pins at 320:
          // they keep 2 px clear of every other name and pin.
          const margin = a.id === 'f17_landing' || a.id === 'f17_keeper' ? 2 : 0;
          const box = grown(a.box, margin);
          const at = `${spot.id} @${width}: ${a.id}`;
          if (a.box.x0 < 0 || a.box.x1 > plan.frame.w || a.box.y0 < 0 || a.box.y1 > plan.frame.h) problems.push(`${at} outside the frame`);
          for (const o of named) if (o.id > a.id && overlaps(box, o.box)) problems.push(`${at} on the name of ${o.id}`);
          for (const n of plan.nodes) if (n.id !== a.id && overlaps(box, pinBox(n, plan.frame.pinR))) problems.push(`${at} on the ${n.id} pin`);
          for (const c of chips) if (overlaps(a.box, c.box)) problems.push(`${at} on a chip of ${c.id}`);
        }
      }
    }
    expect(problems.slice(0, 20)).toEqual([]);
  });
});

// ---------- The components, rendered on the server ----------

type State = typeof import('../src/ui/state.svelte');
type Arm = typeof import('../src/ui/lib/rideArm.svelte');
let st: State;
let arm: Arm;
let MapCard: Component;
let AscentPanel: Component;
let StopDetail: Component<{ tower: typeof ASCENT; stopKey: string | null }>;
let TowerSection: Component<{ tower: typeof ASCENT; height: number; shownKey: string | null; onpick: (row: StopView) => void }>;

beforeAll(async () => {
  const store: Record<string, string> = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
    key: () => null,
    length: 0,
    clear: () => {},
  };
  st = await import('../src/ui/state.svelte');
  arm = await import('../src/ui/lib/rideArm.svelte');
  MapCard = (await import('../src/ui/MapCard.svelte')).default as Component;
  // A tiled region is the first paint when the build bundles its sheets or the art pack hint says a
  // pack is stored (tilemaps/tileArt.ts expectsNoSheets). A checkout without the art has neither, so
  // the hint is set: the floor 0 test below judges the tiled frame. The read of the (absent) store has finished.
  const { artPack } = await import('../src/ui/lib/artPack/artPack.svelte');
  await artPack.ready;
  artPack.hinted = true;
  AscentPanel = (await import('../src/ui/panels/AscentPanel.svelte')).default as Component;
  StopDetail = (await import('../src/ui/StopDetail.svelte')).default as typeof StopDetail;
  TowerSection = (await import('../src/ui/TowerSection.svelte')).default as typeof TowerSection;
  // The first import transforms the Svelte tree; under the parallel suite that passes the 10 s default.
}, 60_000);

/** Put the UI's own game state where a test wants it: floors 1 to `climbedTo` cleared and open, the rest not. */
function place(climbedTo: number, spot: string, owned = false): void {
  st.gs.stats[TUTORIAL_DONE_KEY] = 1;
  for (const f of Object.values(FLOORS)) {
    for (const c of [...(f.clear ?? []), ...(f.gate ?? [])]) if (c.type === 'stat') delete st.gs.stats[c.key];
  }
  climbed(st.gs, climbedTo);
  st.gs.prestige.purchases.city_key = owned ? 1 : 0;
  st.gs.spot = spot;
  if (!st.gs.discovered.includes(spot)) st.gs.discovered.push(spot);
}

const classOf = (html: string, name: string) => new RegExp(`class="[^"]*\\b${name}\\b`).test(html);

describe('floor 0 and the tutorial', () => {
  it('the map has no tower section, fold or detail while the tutorial runs (there are no floor tabs there either)', () => {
    // A new game: the holding cell, the tutorial's first step.
    expect(st.gs.spot).toBe('f0_cell');
    viewport.wide = true;
    const wide = render(MapCard).body;
    expect(classOf(wide, 'map-wrap')).toBe(true);
    for (const name of ['tower-section', 'tower-fold', 'stop-detail', 'section-cell', 'with-section']) {
      expect(classOf(wide, name), name).toBe(false);
    }
    // The picture is a tiled map: the plan is not made taller for a detail that is not there.
    expect(wide).toMatch(/map-wrap[^>]*style="height: ?4\d\dpx/);
    viewport.wide = false;
    const narrow = render(MapCard).body;
    expect(classOf(narrow, 'tower-fold')).toBe(false);
    viewport.wide = true;
  });
});

describe('the 600 px rule: one set of ride buttons', () => {
  const rideTexts = (html: string) => html.match(/(?:Climb|Descend|Go) · \d+s/g) ?? [];

  it('the width it turns on is 600 px', () => {
    expect(SECTION_MIN_WIDTH).toBe(600);
  });

  it('wide: the section’s detail has the button and the Ascent panel prints terms and no button', () => {
    place(6, FLOORS.ascent_f4.landing!);
    viewport.wide = true;
    const panel = render(AscentPanel).body;
    expect(rideTexts(panel)).toEqual([]);
    expect(panel).toContain('Show in map');
    // The terms are still there: floor 6's clear condition.
    expect(panel).toContain('The Warren');
    const detail = render(StopDetail, { props: { tower: ASCENT, stopKey: 'ascent_f5' } }).body;
    expect(rideTexts(detail)).toEqual(['Climb · 5s']);
    expect(classOf(detail, 'sd-ride')).toBe(true);
  });

  it('narrow: the Ascent panel has its buttons and the detail points to it', () => {
    place(6, FLOORS.ascent_f4.landing!);
    viewport.wide = false;
    const panel = render(AscentPanel).body;
    expect(rideTexts(panel)).toContain('Climb · 5s');
    expect(rideTexts(panel)).toContain('Descend · 18s');
    expect(panel).not.toContain('Show in map');
    const detail = render(StopDetail, { props: { tower: ASCENT, stopKey: 'ascent_f5' } }).body;
    expect(rideTexts(detail)).toEqual([]);
    expect(detail).toContain('Rides start from the Ascent panel below.');
    viewport.wide = true;
  });

  it('at any width exactly one of the two places carries the button for a stop', () => {
    place(6, FLOORS.ascent_f4.landing!);
    for (const wide of [true, false]) {
      viewport.wide = wide;
      const both = render(AscentPanel).body + render(StopDetail, { props: { tower: ASCENT, stopKey: 'ascent_f5' } }).body;
      expect(both.match(/Climb · 5s/g), `wide ${wide}`).toHaveLength(1);
    }
    viewport.wide = true;
  });
});

describe('the map in a tower region', () => {
  it('draws the section beside a 340 px plan, a detail under it, and no floor tabs', () => {
    place(6, FLOORS.ascent_f4.landing!);
    viewport.wide = true;
    const html = render(MapCard).body;
    expect(classOf(html, 'with-section')).toBe(true);
    expect(classOf(html, 'tower-section')).toBe(true);
    expect(classOf(html, 'stop-detail')).toBe(true);
    expect(html).not.toContain('region-switch floors');
    // The plan is PLAN_HEIGHT plus its border; the section is as tall.
    expect(html).toMatch(/map-wrap[^>]*style="height: ?342px/);
    expect(html).toMatch(/tower-section[^>]*style="height: ?342px/);
    expect(html).toMatch(new RegExp(`stop-detail[^>]*style="height: ?${DETAIL_H}px`));
    // Names: floor 4 and its neighbours, by name; the section is the row list the panel shows.
    expect(html).toContain('The Greenwood');
    expect(html).toContain('aria-current="location"');
    // Nothing opens on hover: no tooltip on a row or on the detail.
    const section = html.slice(html.indexOf('class="tower-section'), html.indexOf('</nav>'));
    expect(section).not.toMatch(/\btitle=/);
  });

  it('the city view is as tall as the tower view and its detail: a ride between them moves nothing', () => {
    place(6, FOOT);
    viewport.wide = true;
    const html = render(MapCard).body;
    expect(classOf(html, 'with-section')).toBe(false);
    expect(classOf(html, 'tower-section')).toBe(false);
    const stack = PLAN_HEIGHT + 2 + DETAIL_GAP + DETAIL_H;
    expect(html).toMatch(new RegExp(`map-wrap[^>]*style="height: ?${stack}px`));
  });

  it('under 600 px the section is a fold in every region, so the page does not change shape on a ride', () => {
    viewport.wide = false;
    for (const spot of [FOOT, FLOORS.ascent_f4.landing!]) {
      place(6, spot);
      const html = render(MapCard).body;
      expect(classOf(html, 'tower-fold'), spot).toBe(true);
      expect(classOf(html, 'with-section'), spot).toBe(false);
      // No reserved height: the detail is inside the fold.
      expect(html).toMatch(new RegExp(`map-wrap[^>]*style="height: ?${PLAN_HEIGHT + 2}px`));
    }
    viewport.wide = true;
  });

  it('the tower section lists the stops and marks the one underfoot', () => {
    place(6, FLOORS.ascent_f4.landing!);
    const html = render(TowerSection, { props: { tower: ASCENT, height: 342, shownKey: 'ascent_f5', onpick: () => {} } }).body;
    expect(html).toContain('aria-label="The Ascent floors"');
    expect(html).toContain('The Foot of the Ascent');
    expect(html).toContain('aria-label="Floor 4, The Greenwood: Cleared, you are here"');
    expect(html).toContain('aria-pressed="true"');
    // The next band by name only; nothing above it (floor 11 is in the harbor).
    expect(html).toContain('The Harbor');
    expect(html).not.toContain('The Stronghold Road');
  });

  it('shows a floor not reached as its number, in the row and in the label', () => {
    place(0, FOOT);
    const html = render(TowerSection, { props: { tower: ASCENT, height: 342, shownKey: null, onpick: () => {} } }).body;
    expect(html).toContain('aria-label="Floor 2: Sealed"');
    expect(html).toContain('aria-label="Floor 3: Sealed"');
    expect(html).toContain('aria-label="Floor 1, The Flooded Offices: Open"');
    expect(html).not.toContain('The Long Hall');
    expect(html).not.toContain('The Descent');
    expect(html).toContain('The Wilds');
    expect(html).not.toContain('The City');
  });
});

describe('the forfeit asks twice, from either place', () => {
  it('the first press arms and runs nothing; the second runs the climb out of the attempt', () => {
    st.gs.stats[TUTORIAL_DONE_KEY] = 1;
    clearFloors(st.gs.stats, Object.values(FLOORS).filter((f) => f.bandId !== undefined && f.index < 15).map((f) => f.id));
    st.gs.prestige.purchases.city_key = 1;
    st.gs.spot = FLOORS.ascent_f14.landing!;
    st.gs.discovered.push(st.gs.spot);
    for (const a of ATTRIBUTE_LIST) st.gs.attrs[a.id].level = 400;
    expect(st.game.climbTo(DARK_FLOOR)).toBe(true);
    for (let i = 0; i < 2000 && st.gs.travel; i++) st.game.tick();
    expect(st.gs.spot).toBe(DARK_ROOM);

    const hub = towerHubView(st.gs, ASCENT).action!;
    expect(hub.kind).toBe('forfeit');
    arm.disarmRide();
    expect(arm.armedKey()).toBeNull();

    arm.pressRide(hub);
    expect(arm.armedKey()).toBe('hub');
    expect(festivalRun(st.gs)).toBeDefined();
    expect(st.gs.spot).toBe(DARK_ROOM);
    // The detail reads the same arming: the label asks for the second press.
    viewport.wide = true;
    const armed = render(StopDetail, { props: { tower: ASCENT, stopKey: 'hub' } }).body;
    expect(armed).toContain('Confirm: forfeit the festival');

    // Another stop's button does not inherit the press.
    const other = rungView(st.gs, FLOORS.ascent_f14).action!;
    expect(arm.armedKey()).not.toBe(other.key);
    arm.pressRide(other);
    expect(arm.armedKey()).toBe(other.key);
    expect(festivalRun(st.gs)).toBeDefined();

    arm.pressRide(other);
    expect(arm.armedKey()).toBeNull();
    // Ejected outside the tower, the attempt over.
    expect(st.gs.spot).toBe(FOOT);
    expect(festivalRun(st.gs)).toBeUndefined();
  });

  it('a ride that is not a forfeit runs on the first press', () => {
    st.gs.spot = FOOT;
    st.gs.festival = undefined;
    st.gs.travel = null;
    st.gs.recovering = false;
    arm.disarmRide();
    const view = rungView(st.gs, FLOORS.ascent_f1);
    expect(view.action?.kind).toBe('ride');
    arm.pressRide(view.action!);
    expect(arm.armedKey()).toBeNull();
    // `travel` was set to null above, so the checker narrows it; the ride sets it.
    expect((st.gs as GameState).travel?.to).toBe(FLOORS.ascent_f1.landing);
  });
});

describe('an arm belongs to the moment it was made in', () => {
  const BELOW = Object.values(FLOORS).filter((f) => f.bandId !== undefined && f.index < 15).map((f) => f.id);

  /** An attempt in its hall with the dark room emptied: where the arm, walk, press sequence starts. */
  function inHall(): void {
    st.gs.festival = undefined;
    st.gs.travel = null;
    st.gs.travelPlan = [];
    st.gs.recovering = false;
    st.gs.combat = null;
    st.gs.stats[TUTORIAL_DONE_KEY] = 1;
    clearFloors(st.gs.stats, BELOW);
    st.gs.prestige.purchases.city_key = 1;
    st.gs.spot = FLOORS.ascent_f14.landing!;
    for (const a of ATTRIBUTE_LIST) st.gs.attrs[a.id].level = 400;
    expect(st.game.climbTo(DARK_FLOOR)).toBe(true);
    for (let i = 0; i < 2000 && st.gs.travel; i++) st.game.tick();
    expect(st.gs.spot).toBe(DARK_ROOM);
    // The dark room emptied: the clear that opens the hall, and the attempt's phase.
    clearFloors(st.gs.stats, ['ascent_f15']);
    festivalRun(st.gs)!.phase = 'prep';
    st.gs.combat = null;
    st.gs.spot = 'f15_hall';
    if (!st.gs.discovered.includes('f15_hall')) st.gs.discovered.push('f15_hall');
    if (!st.gs.discovered.includes('f15_stores')) st.gs.discovered.push('f15_stores');
    arm.disarmRide();
    viewport.wide = true;
  }

  const walk = () => {
    for (let i = 0; i < 2000 && st.gs.travel; i++) st.game.tick();
    expect(st.gs.travel).toBeNull();
  };

  it('arm in the hall, walk to the stores, press once: the attempt is still on', () => {
    inHall();
    const hub = towerHubView(st.gs, ASCENT).action!;
    expect(hub.kind).toBe('forfeit');
    arm.pressRide(hub);
    expect(arm.armedKey()).toBe('hub');

    st.game.travelTo('f15_stores');
    expect(st.gs.travel).not.toBeNull();
    walk();
    expect(st.gs.spot).toBe('f15_stores');
    // The press was made at the hall: here it reads unarmed, in the button and in the store.
    expect(arm.armedKey()).toBeNull();
    const here = towerHubView(st.gs, ASCENT).action!;
    expect(render(StopDetail, { props: { tower: ASCENT, stopKey: 'hub' } }).body).toContain('Forfeit · Leave the tower');

    // One press at the stores arms; it does not forfeit.
    arm.pressRide(here);
    expect(festivalRun(st.gs)).toBeDefined();
    expect(lockoutLeft(st.gs)).toBe(0);
    expect(st.gs.spot).toBe('f15_stores');
    expect(arm.armedKey()).toBe('hub');
  });

  it('walking away and back does not bring the arm back', () => {
    inHall();
    arm.pressRide(towerHubView(st.gs, ASCENT).action!);
    expect(arm.armedKey()).toBe('hub');

    // The effect on the spot and the travel state runs as the walk begins (a server render runs no effects).
    st.game.travelTo('f15_stores');
    arm.syncArm(st.gs.spot, !!st.gs.travel, viewport.wide);
    walk();
    st.game.travelTo('f15_hall');
    walk();
    expect(st.gs.spot).toBe('f15_hall');
    expect(arm.armedKey()).toBeNull();

    arm.pressRide(towerHubView(st.gs, ASCENT).action!);
    expect(festivalRun(st.gs)).toBeDefined();
    expect(st.gs.spot).toBe('f15_hall');
  });

  it('no press counts while a walk is under way', () => {
    inHall();
    arm.pressRide(towerHubView(st.gs, ASCENT).action!);
    st.game.travelTo('f15_stores');
    expect(st.gs.travel).not.toBeNull();
    expect(arm.armedKey()).toBeNull();
    walk();
  });

  it('crossing 600 px voids it, as the button moves between the detail and the panel', () => {
    inHall();
    const hub = towerHubView(st.gs, ASCENT).action!;
    arm.pressRide(hub);
    expect(arm.armedKey()).toBe('hub');

    viewport.wide = false;
    expect(arm.armedKey()).toBeNull();
    arm.syncArm(st.gs.spot, !!st.gs.travel, viewport.wide);
    viewport.wide = true;
    // Back at the first width the old press is not revived.
    expect(arm.armedKey()).toBeNull();
    arm.pressRide(hub);
    expect(festivalRun(st.gs)).toBeDefined();
    expect(arm.armedKey()).toBe('hub');

    // The same press made under 600 px stands there.
    viewport.wide = false;
    arm.pressRide(hub);
    expect(arm.armedKey()).toBe('hub');
    viewport.wide = true;
  });

  it('syncArm clears an arm made under other conditions and keeps one made under these', () => {
    inHall();
    const hub = towerHubView(st.gs, ASCENT).action!;
    arm.pressRide(hub);
    arm.syncArm('f15_hall', false, true);
    expect(arm.armedKey()).toBe('hub');
    arm.syncArm('f15_stores', false, true);
    expect(arm.armedKey()).toBeNull();
    arm.pressRide(hub);
    arm.syncArm('f15_hall', true, true);
    expect(arm.armedKey()).toBeNull();
  });
});

describe('the detail always has a stop when the tower’s tab is shown', () => {
  /** Found places on floors 1 to n: each landing. */
  function found(s: GameState, n: number): GameState {
    for (const id of floorsUpTo(n)) if (!s.discovered.includes(FLOORS[id].landing!)) s.discovered.push(FLOORS[id].landing!);
    return s;
  }
  const areaOf = (s: GameState) => defaultStackArea(s, 'the_ascent', SPOTS[s.spot].areaId);

  it('standing on a floor: that floor', () => {
    const s = found(stoodOn(climbed(fresh(), 6), FLOORS.ascent_f4.landing!), 6);
    expect(areaOf(s)).toBe('ascent_f4_area');
    expect(stopKeyOfArea(areaOf(s)!)).toBe('ascent_f4');
  });

  it('at the Foot: the highest floor with a place found, the old floor tabs’ choice', () => {
    const s = found(climbed(fresh(), 6), 4);
    expect(areaOf(s)).toBe('ascent_f4_area');
    const view = stopViewOf(s, ASCENT, stopKeyOfArea(areaOf(s)!))!;
    // One click on the tab and the ride is there.
    expect(view.action?.verb).toBe('Climb');
    // A higher floor found moves it up.
    expect(areaOf(found(s, 6))).toBe('ascent_f6_area');
  });

  it('in the city: the same floor as from the Foot', () => {
    const s = found(stoodOn(climbed(fresh(), 6), 'the_forges'), 5);
    expect(areaOf(s)).toBe('ascent_f5_area');
    expect(stopViewOf(s, ASCENT, 'ascent_f5')?.action).toBeNull();
    expect(stopViewOf(s, ASCENT, 'ascent_f5')?.note).toMatch(/^Rides start at/);
  });

  it('at a band hub: the highest floor found, not the hub', () => {
    const s = climbed(fresh(), 6);
    s.prestige.purchases.city_key = 1;
    found(stoodOn(s, 'castle_court'), 4);
    expect(AREAS[SPOTS.castle_court.areaId].name).toBeTruthy();
    expect(areaOf(s)).toBe('ascent_f4_area');
    expect(stopViewOf(s, ASCENT, 'ascent_f4')?.action?.verb).toBe('Descend');
  });

  it('a new run at the Foot: floor 1, the next climb, with its button', () => {
    const s = fresh();
    expect(s.discovered).not.toContain(FLOORS.ascent_f1.landing);
    expect(areaOf(s)).toBe('ascent_f1_area');
    const view = stopViewOf(s, ASCENT, stopKeyOfArea(areaOf(s)!))!;
    expect(view.key).toBe('ascent_f1');
    expect(view.name).toBe('The Flooded Offices');
    expect(view.action).toMatchObject({ kind: 'ride', verb: 'Climb', baseTicks: 45 });
  });

  it('a run after a prestige, with floors seen but none found: floor 1 again', () => {
    const next = prestigeNow(climbed(fresh(), 6), 1)!;
    expect(next).not.toBeNull();
    expect(next.prestige.floorsSeen).toContain('ascent_f6');
    expect(next.discovered.some((id) => FLOOR_BY_AREA.get(SPOTS[id].areaId)?.bandId !== undefined)).toBe(false);
    expect(areaOf(next)).toBe('ascent_f1_area');
    expect(stopViewOf(next, ASCENT, 'ascent_f1')?.action?.verb).toBe('Climb');
  });

  it('with no floor found and none open there is no default, and the detail asks for a pick', () => {
    const s = fresh();
    clearFloors(s.stats, Object.values(FLOORS).filter((f) => f.bandId !== undefined).map((f) => f.id));
    expect(areaOf(s)).toBeNull();
  });

  it('a new game after the tutorial: the tab, then the button, two clicks from the Foot', () => {
    place(0, FOOT);
    st.gs.discovered = ['ascent_foot'];
    st.gs.travel = null;
    st.gs.festival = undefined;
    st.gs.recovering = false;
    st.gs.combat = null;
    viewport.wide = true;
    // Click 1: the tower's tab is there at the Foot, with no floor found.
    const city = render(MapCard).body;
    expect(city).toMatch(/region-switch[\s\S]*?>\s*The Ascent\s*<\/button>/);
    // What the tab opens: floor 1, named, with its Climb button.
    const key = stopKeyOfArea(defaultStackArea(st.gs, 'the_ascent', SPOTS[st.gs.spot].areaId)!);
    expect(key).toBe('ascent_f1');
    const detail = render(StopDetail, { props: { tower: ASCENT, stopKey: key } }).body;
    expect(detail).toContain('Floor 1 · The Flooded Offices');
    // Click 2: the button.
    expect(detail).toMatch(/sd-ride[^>]*>\s*Climb · \d+s\s*</);
    expect(detail).not.toContain('Pick a floor in the list');
  });
});
