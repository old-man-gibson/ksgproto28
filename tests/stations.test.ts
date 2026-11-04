import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { TPS } from '../src/core/engine/loop';
import {
  ADJACENCY,
  AREAS,
  FLOOR_BY_AREA,
  PRESTIGE_BOONS,
  SPOTS,
  buildAdjacency,
  declaredConnections,
} from '../src/core/registry';
import { deserialize, serialize } from '../src/core/save/save';
import { hasWayfinding } from '../src/core/systems/legacy';
import { festivalFloorOf } from '../src/core/systems/festivalRules';
import { ARRIVE_IDLE, spotActivities } from '../src/core/systems/actions';
import { captureFall, noteKnockout, returnBlock, tickKnockoutReturn } from '../src/core/systems/knockoutReturn';
import { getDerivedStats } from '../src/core/systems/derived';
import { noteSafeSpot, retreatToSafety } from '../src/core/systems/safety';
import { returnLine, routeInfo, stationBlock, stations, stayLabel, STATION_MAX } from '../src/ui/lib/navigation';
import type { PendingReturn, SpotDef } from '../src/core/types';
import { clearFloors } from './fixtures/floors';

/**
 * The Stations row's list (ui/lib/navigation.ts `stations`, docs/plans/
 * navigation-alternatives.md N7): the spots with a `resumeActivity` key,
 * newest first, up to 5, not where the character stands, minus everything the
 * knockout return refuses to walk into.
 *
 * Two worlds. The real one (Threshold and floor 4, as the plan's errand is
 * written) holds the order, the cap, the walk and the real wall, festival floor
 * and locked floor. A pocket spliced into the registry holds the causes the
 * data has no safe example of: a forced spot, a forced last road, no route, an
 * activity that cannot start.
 */

// ---------- The real world ----------

/** A character past the tutorial with floors 1–6 cleared and floor 4 known, standing at the Granary Gate. */
function midgame(seed: number): Game {
  const g = new Game(createInitialState(seed));
  g.skipTutorial();
  clearFloors(g.state.stats);
  for (const id of ['f4_treeline', 'f4_woods_edge', 'f4_deep_woods']) {
    if (!g.state.discovered.includes(id)) g.state.discovered.push(id);
  }
  g.state.spot = 'granary_gate';
  return g;
}

/** Choose `activity` at `spot` through the player's command, as if standing there. */
function work(g: Game, spot: string, activity: string): void {
  g.state.spot = spot;
  g.selectActivity(activity);
  expect(g.state.activity, `${activity} at ${spot}`).toBe(activity);
}

/** Leave the work and stand at `spot` with nothing running. */
function standAt(g: Game, spot: string): void {
  g.state.activity = null;
  g.state.spot = spot;
}

const SPEED = 1;
const spotsOf = (g: Game): string[] => stations(g.state, SPEED).map((s) => s.spot);

function walkUntilStill(g: Game, max = 5000): number {
  let n = 0;
  for (; n < max && (g.state.travel || g.state.travelPlan.length > 0); n++) g.tick();
  return n;
}

describe('the list', () => {
  it('is the worked spots, newest first, and "Back" is the newest', () => {
    const g = midgame(1);
    work(g, 'the_sand', 'train_dex_sand');
    work(g, 'the_forges', 'train_str_forges');
    work(g, 'f4_woods_edge', 'hunt');
    standAt(g, 'granary_gate');
    const list = stations(g.state, SPEED);
    expect(list.map((s) => s.spot)).toEqual(['f4_woods_edge', 'the_forges', 'the_sand']);
    expect(list[0]).toMatchObject({ spot: 'f4_woods_edge', activity: 'hunt', place: 'The Woods Edge' });
    expect(list[0].what).toContain('Hunt the Edge');
  });

  it('lists at most 5 and keeps the 5 newest', () => {
    const g = midgame(2);
    const picks: [string, string][] = [
      ['the_sand', 'train_dex_sand'],
      ['the_forges', 'train_str_forges'],
      ['the_weighbridge', 'job_hauling'],
      ['granary_kitchens', 'job_pans'],
      ['the_alembics', 'job_retorts'],
      ['the_rolls', 'job_copying'],
      ['f4_woods_edge', 'hunt'],
    ];
    for (const [spot, act] of picks) work(g, spot, act);
    standAt(g, 'granary_gate');
    expect(Object.keys(g.state.resumeActivity)).toHaveLength(7);
    expect(spotsOf(g)).toEqual(['f4_woods_edge', 'the_rolls', 'the_alembics', 'granary_kitchens', 'the_weighbridge']);
    expect(spotsOf(g)).toHaveLength(STATION_MAX);
    expect(stations(g.state, SPEED, 2)).toHaveLength(2);
  });

  it('never lists the spot the character stands at', () => {
    const g = midgame(3);
    work(g, 'the_sand', 'train_dex_sand');
    work(g, 'the_forges', 'train_str_forges');
    expect(spotsOf(g)).toEqual(['the_sand']); // standing at the forges, working
    standAt(g, 'the_sand');
    expect(spotsOf(g)).toEqual(['the_forges']);
  });

  it('puts a spot first again each time work is picked there, and on a resumed arrival', () => {
    const g = midgame(4);
    work(g, 'the_sand', 'train_dex_sand');
    work(g, 'the_forges', 'train_str_forges');
    work(g, 'the_weighbridge', 'job_hauling');
    expect(Object.keys(g.state.resumeActivity).slice(-3)).toEqual(['the_sand', 'the_forges', 'the_weighbridge']);

    // A new pick at the sand moves it to the end, and replaces its activity.
    work(g, 'the_sand', 'spar_sand');
    expect(Object.keys(g.state.resumeActivity).slice(-3)).toEqual(['the_forges', 'the_weighbridge', 'the_sand']);
    expect(g.state.resumeActivity['the_sand']).toBe('spar_sand');

    // Walking back to the forges restarts its work on arrival: the resume is a pick too.
    g.travelPlanTo('the_forges');
    walkUntilStill(g);
    expect(g.state.spot).toBe('the_forges');
    expect(g.state.activity).toBe('train_str_forges');
    expect(Object.keys(g.state.resumeActivity).slice(-3)).toEqual(['the_weighbridge', 'the_sand', 'the_forges']);
  });

  it('forgets a spot the player stopped by hand', () => {
    const g = midgame(5);
    work(g, 'the_sand', 'train_dex_sand');
    work(g, 'the_forges', 'train_str_forges');
    g.selectActivity(null);
    standAt(g, 'granary_gate');
    expect(spotsOf(g)).toEqual(['the_sand']);
  });

  it('keeps its order through a save', () => {
    const g = midgame(6);
    work(g, 'the_sand', 'train_dex_sand');
    work(g, 'the_forges', 'train_str_forges');
    work(g, 'the_sand', 'spar_sand');
    standAt(g, 'granary_gate');
    const loaded = deserialize(serialize(g.state));
    expect(Object.keys(loaded.resumeActivity)).toEqual(Object.keys(g.state.resumeActivity));
    expect(stations(loaded, SPEED).map((s) => s.spot)).toEqual(['the_sand', 'the_forges']);
  });

  it('can rely on key order: no spot id is an integer index', () => {
    // Object.keys lists integer-like keys first, ascending, whatever their insertion order.
    expect(Object.keys(SPOTS).filter((id) => /^(0|[1-9]\d*)$/.test(id))).toEqual([]);
  });

  it('gives the route time the walk takes, rides included, and one click starts the work on arrival', () => {
    const g = midgame(7);
    work(g, 'f4_woods_edge', 'hunt');
    standAt(g, 'granary_gate');
    const [back] = stations(g.state, SPEED);
    expect(back.spot).toBe('f4_woods_edge');
    expect(back.ticks).toBe(routeInfo(g.state, 'f4_woods_edge', SPEED).ticks);
    // The Granary Gate to the Foot 1.2 s, the ride to floor 4 18 s, the landing to the Woods Edge 2 s.
    expect(back.ticks).toBe(212);

    expect(g.goAndDo(back.spot, back.activity)).toBe(true);
    const took = walkUntilStill(g);
    expect(g.state.spot).toBe('f4_woods_edge');
    expect(g.state.activity).toBe('hunt');
    expect(Math.abs(took - back.ticks)).toBeLessThanOrEqual(2);
  });

  it('is free outside town: no Wayfinding boon is held, and a floor 4 spot is still listed', () => {
    const g = midgame(8);
    work(g, 'f4_woods_edge', 'hunt');
    standAt(g, 'granary_gate');
    expect(hasWayfinding(g.state)).toBe(false);
    expect(spotsOf(g)).toContain('f4_woods_edge');
  });

  it('never names a place the character has not found', () => {
    const g = midgame(9);
    work(g, 'f4_woods_edge', 'hunt');
    standAt(g, 'granary_gate');
    expect(spotsOf(g)).toContain('f4_woods_edge');
    g.state.discovered = g.state.discovered.filter((id) => id !== 'f4_woods_edge');
    expect(stationBlock(g.state, { spot: 'f4_woods_edge', activity: 'hunt' })).toBe('undiscovered');
    expect(spotsOf(g)).not.toContain('f4_woods_edge');
    // The route line the row's click would draw says "Unknown place", never the name.
    const list = stations(g.state, SPEED);
    expect(JSON.stringify(list)).not.toContain('Woods Edge');
  });
});

describe('never offered, in the real world', () => {
  /** A resume entry at `spot` for the first activity it has, the character standing at the Granary Gate. */
  function withEntry(g: Game, spot: string, activity?: string): void {
    if (!g.state.discovered.includes(spot)) g.state.discovered.push(spot);
    g.state.resumeActivity[spot] = activity ?? spotActivities(SPOTS[spot])[0].id;
    standAt(g, 'granary_gate');
  }

  it('the stronghold wall', () => {
    const g = midgame(10);
    withEntry(g, 'f11_wall', 'hunt');
    expect(stationBlock(g.state, { spot: 'f11_wall', activity: 'hunt' })).toBe('wall');
    expect(spotsOf(g)).not.toContain('f11_wall');
  });

  it('a festival floor', () => {
    const g = midgame(11);
    const spot = Object.values(SPOTS).find((s) => festivalFloorOf(s.id) && !s.forced && spotActivities(s).length)!;
    withEntry(g, spot.id);
    expect(stationBlock(g.state, { spot: spot.id, activity: g.state.resumeActivity[spot.id] })).toBe('festival');
    expect(spotsOf(g)).not.toContain(spot.id);
  });

  it('a floor that is not unlocked', () => {
    const g = new Game(createInitialState(12));
    g.skipTutorial(); // no floor cleared
    const spot = Object.values(SPOTS).find(
      (s) => FLOOR_BY_AREA.get(s.areaId)?.id === 'ascent_f5' && !s.forced && spotActivities(s).some((a) => a.kind === 'hunt'),
    )!;
    withEntry(g, spot.id, 'hunt');
    expect(returnBlock(g.state, { spot: spot.id, activity: 'hunt' })).toBe('route'); // the router reads it as no ride
    expect(stationBlock(g.state, { spot: spot.id, activity: 'hunt' })).toBe('locked');
    expect(spotsOf(g)).not.toContain(spot.id);
  });

  it('a hunt whose fight budget is spent: offered at 5 of 6 fights, refused at 6', () => {
    const g = midgame(14);
    for (const id of ['f1_landing', 'f1_storerooms']) {
      if (!g.state.discovered.includes(id)) g.state.discovered.push(id);
    }
    work(g, 'f1_storerooms', 'hunt');
    expect(SPOTS['f1_storerooms'].fightLimit).toBe(6);
    standAt(g, 'granary_gate');
    const goal = { spot: 'f1_storerooms', activity: 'hunt' };

    g.state.stats['fights:f1_storerooms'] = 5;
    expect(stationBlock(g.state, goal)).toBeNull();
    expect(spotsOf(g)).toContain('f1_storerooms');

    g.state.stats['fights:f1_storerooms'] = 6;
    expect(returnBlock(g.state, goal)).toBeNull(); // the return's own check does not look
    expect(stationBlock(g.state, goal)).toBe('spent');
    expect(spotsOf(g)).not.toContain('f1_storerooms');
  });

  it('a hunt with no encounter eligible now', () => {
    const g = midgame(15);
    for (const id of ['f1_landing', 'f1_storerooms']) {
      if (!g.state.discovered.includes(id)) g.state.discovered.push(id);
    }
    work(g, 'f1_storerooms', 'hunt');
    standAt(g, 'granary_gate');
    const spot = SPOTS['f1_storerooms'];
    const lines = spot.encounters;
    try {
      // Every line gated behind a counter that is not there.
      spot.encounters = (lines ?? []).map((e) => ({ ...e, requires: [{ type: 'stat' as const, key: 'never:station', value: 1 }] }));
      expect(stationBlock(g.state, { spot: 'f1_storerooms', activity: 'hunt' })).toBe('empty');
      expect(spotsOf(g)).not.toContain('f1_storerooms');
    } finally {
      spot.encounters = lines;
    }
    expect(spotsOf(g)).toContain('f1_storerooms');
  });

  it('an undiscovered spot', () => {
    const g = midgame(13);
    g.state.resumeActivity['the_sand'] = 'train_dex_sand';
    g.state.discovered = g.state.discovered.filter((id) => id !== 'the_sand');
    standAt(g, 'granary_gate');
    expect(stationBlock(g.state, { spot: 'the_sand', activity: 'train_dex_sand' })).toBe('undiscovered');
    expect(spotsOf(g)).not.toContain('the_sand');
  });
});

// ---------- The pocket world ----------

const hunt = { id: 'hunt', kind: 'hunt' as const, name: 'Hunt', icon: '🏹' };
const rats = [{ monsterId: 'forest_rat', weight: 100, level: [1, 1] as [number, number] }];

function pocket(id: string, name: string, extra: Partial<SpotDef>): SpotDef {
  return { id, name, icon: '📍', areaId: 'st_area', desc: '', activities: [], connections: [], ...extra };
}

/**
 *   st_camp - st_gate - st_field   (hunt)
 *                    |- st_den     (FORCED spot, hunt)
 *                    |- st_pit     (hunt, reached by a FORCED road)
 *                    |- st_yard    (train)
 *   st_island                      (hunt, no road at all)
 */
const ST: Record<string, SpotDef> = {
  st_camp: pocket('st_camp', 'Station Camp', {
    waypoint: true,
    activities: [{ id: 'rest', kind: 'rest', name: 'Camp', icon: '🏕️' }],
    connections: [{ to: 'st_gate', ticks: 5 }],
  }),
  st_gate: pocket('st_gate', 'Station Gate', {
    connections: [
      { to: 'st_field', ticks: 5 },
      { to: 'st_den', ticks: 5 },
      { to: 'st_pit', ticks: 5, forced: true },
      { to: 'st_yard', ticks: 5 },
    ],
  }),
  st_field: pocket('st_field', 'Station Field', { activities: [hunt], encounters: rats }),
  st_den: pocket('st_den', 'Station Den', { forced: true, activities: [hunt], encounters: rats }),
  st_pit: pocket('st_pit', 'Station Pit', { activities: [hunt], encounters: rats }),
  st_yard: pocket('st_yard', 'Station Yard', {
    activities: [{ id: 'drill', kind: 'train', attr: 'str', name: 'Drill', icon: '🏋️' }],
  }),
  st_island: pocket('st_island', 'Station Island', { activities: [hunt], encounters: rats }),
};

describe('never offered, in a pocket world', () => {
  beforeAll(() => {
    AREAS['st_area'] = { id: 'st_area', name: 'Stations Test', regionId: 'the_ascent' };
    Object.assign(SPOTS, ST);
    buildAdjacency(declaredConnections(ST), ADJACENCY);
  });

  afterAll(() => {
    for (const id of Object.keys(ST)) {
      delete SPOTS[id];
      ADJACENCY.delete(id);
    }
    delete AREAS['st_area'];
  });

  function pocketGame(seed: number): Game {
    const g = new Game(createInitialState(seed));
    g.state.spot = 'st_camp';
    g.state.discovered.push(...Object.keys(ST));
    return g;
  }

  it('lists a plain spot, and refuses each of the rest for its own cause', () => {
    const g = pocketGame(20);
    const s = g.state;
    s.resumeActivity['st_field'] = 'hunt';
    s.resumeActivity['st_den'] = 'hunt';
    s.resumeActivity['st_pit'] = 'hunt';
    s.resumeActivity['st_island'] = 'hunt';
    s.resumeActivity['st_yard'] = 'ghost'; // an activity the spot does not have (a craft since locked, say)

    const why = (spot: string) => stationBlock(s, { spot, activity: s.resumeActivity[spot] });
    expect(why('st_field')).toBeNull();
    expect(why('st_den')).toBe('forced_spot');
    expect(why('st_pit')).toBe('forced_road');
    expect(why('st_island')).toBe('route');
    expect(why('st_yard')).toBe('start');

    expect(stations(s, SPEED).map((x) => x.spot)).toEqual(['st_field']);
  });

  it('refuses a spot whose last road is forced even when the spot itself is not', () => {
    const g = pocketGame(21);
    g.state.resumeActivity['st_pit'] = 'hunt';
    expect(SPOTS['st_pit'].forced).toBeUndefined();
    expect(spotsOf(g)).toEqual([]);
    // Standing at the gate, the pit is one forced road away: still refused.
    g.state.spot = 'st_gate';
    expect(spotsOf(g)).toEqual([]);
  });

  it('offers a spot whose road is open from where the character stands', () => {
    const g = pocketGame(22);
    g.state.resumeActivity['st_yard'] = 'drill';
    g.state.resumeActivity['st_field'] = 'hunt';
    expect(spotsOf(g)).toEqual(['st_field', 'st_yard']);
  });
});

// ---------- The knockout return owns knockouts ----------

describe('with a knockout return in flight', () => {
  /** The decision a knockout makes, in the order combat.ts onDefeat runs it, at the real Woods Edge. */
  function fall(g: Game): void {
    const s = g.state;
    s.spot = 'f4_woods_edge';
    s.activity = 'hunt';
    s.combat = null;
    s.travel = null;
    s.travelPlan = [];
    s.travelIntent = null;
    const f = captureFall(s);
    s.resources.hp = 1;
    s.recovering = true;
    retreatToSafety(s, g.bus, 'Knocked out.');
    noteKnockout(s, g.bus, f);
  }

  function knockedOut(seed: number, haven = 'f4_treeline'): Game {
    const g = midgame(seed);
    work(g, 'the_sand', 'train_dex_sand');
    work(g, 'the_forges', 'train_str_forges');
    work(g, 'f4_woods_edge', 'hunt');
    g.state.safeSpots = { nearest: haven, unconditional: haven };
    noteSafeSpot(g.state, haven);
    fall(g);
    return g;
  }

  function recovered(g: Game): void {
    g.state.recovering = false;
    g.state.resources.hp = getDerivedStats(g.state).maxHp;
  }

  it("does not offer the return's target, and keeps the other stations", () => {
    const g = knockedOut(30);
    const p = g.state.pendingReturn!;
    expect(p.target).toEqual({ spot: 'f4_woods_edge', activity: 'hunt' });
    expect(g.state.spot).toBe('f4_treeline');
    expect(g.state.resumeActivity['f4_woods_edge']).toBe('hunt'); // still a worked spot
    expect(spotsOf(g)).toEqual(['the_forges', 'the_sand']);
  });

  it('offers the target again once the return is gone', () => {
    const g = knockedOut(31);
    g.stayHere();
    expect(spotsOf(g)[0]).toBe('f4_woods_edge');
  });

  it('offers only the target of a fallback or a hold the return still owns', () => {
    const g = knockedOut(32);
    const p = g.state.pendingReturn!;
    g.state.pendingReturn = { ...p, phase: 'hold', until: g.state.totalTicks + 600 };
    expect(spotsOf(g)).not.toContain('f4_woods_edge');
    g.state.pendingReturn = { ...p, target: null, phase: 'fallback', fallback: { spot: 'the_sand', activity: 'train_dex_sand' } };
    expect(spotsOf(g)).toContain('f4_woods_edge'); // no target to own
  });

  describe('Stay here', () => {
    it('clears the return and keeps the character where it is, recovering', () => {
      const g = knockedOut(33);
      expect(g.stayHere()).toBe(true);
      expect(g.state.pendingReturn).toBeNull();
      expect(g.state.recovering).toBe(true);
      recovered(g);
      for (let i = 0; i < 100; i++) g.tick();
      expect(g.state.spot).toBe('f4_treeline');
      expect(g.state.travel).toBeNull();
      expect(g.state.activity).toBeNull();
      expect(g.state.log.map((l) => l.msg)).toContain('Return cancelled. Staying here.');
    });

    it('ends a hold, which nothing else could cancel without starting and stopping an activity', () => {
      const g = knockedOut(34);
      const p = g.state.pendingReturn!;
      g.state.pendingReturn = { ...p, phase: 'hold', wins: 0, until: g.state.totalTicks + 10 * 60 * TPS };
      recovered(g);
      g.tick();
      expect(g.state.pendingReturn).not.toBeNull();
      g.stayHere();
      for (let i = 0; i < 11 * 60 * TPS; i += 50) {
        for (let j = 0; j < 50; j++) g.tick();
      }
      expect(g.state.pendingReturn).toBeNull();
      expect(g.state.activity).toBeNull();
      expect(g.state.spot).toBe('f4_treeline');
    });

    it('drops the return\'s own walk: the legs not yet taken, and what the leg under way starts', () => {
      const g = knockedOut(35, 'ascent_foot');
      // The landing's camp was worked at before: it is remembered, and must stay so.
      g.state.resumeActivity['f4_treeline'] = 'camp_f4';
      recovered(g);
      for (let i = 0; i < 20 && !g.state.travel; i++) g.tick();
      expect(g.state.travel).not.toBeNull(); // the ride to floor 4 has begun
      expect(g.state.travelPlan.length).toBeGreaterThan(0);
      expect(g.state.travelIntent).toEqual({ spot: 'f4_woods_edge', activity: 'hunt' });
      g.stayHere();
      expect(g.state.pendingReturn).toBeNull();
      expect(g.state.travelPlan).toEqual([]);
      // The leg under way ends at the landing and starts nothing there.
      expect(g.state.travelIntent).toEqual({ spot: 'f4_treeline', activity: ARRIVE_IDLE });
      walkUntilStill(g);
      for (let i = 0; i < 100; i++) g.tick();
      expect(g.state.spot).toBe('f4_treeline'); // the road after it was not walked
      expect(g.state.activity).toBeNull();
      expect(g.state.combat).toBeNull();
      expect(g.state.resumeActivity['f4_treeline']).toBe('camp_f4');
      expect(g.state.travelIntent).toBeNull();
      expect(g.state.log.map((l) => l.msg)).toContain('Return cancelled. Stopping at The Treeline.');
    });

    it('the last leg of a walk back arrives at the target and starts nothing, and the target stays remembered', () => {
      const g = knockedOut(38);
      recovered(g);
      for (let i = 0; i < 20 && !g.state.travel; i++) g.tick();
      expect(g.state.travel?.to).toBe('f4_woods_edge');
      expect(g.state.travelPlan).toEqual([]);
      expect(g.state.travelIntent).toEqual({ spot: 'f4_woods_edge', activity: 'hunt' });
      expect(g.state.resumeActivity['f4_woods_edge']).toBe('hunt');

      g.stayHere();
      expect(g.state.pendingReturn).toBeNull();
      expect(g.state.travelIntent).toEqual({ spot: 'f4_woods_edge', activity: ARRIVE_IDLE });
      walkUntilStill(g);
      expect(g.state.spot).toBe('f4_woods_edge');
      // The arrival started nothing, and nothing starts later.
      for (let i = 0; i < 200; i++) g.tick();
      expect(g.state.activity).toBeNull();
      expect(g.state.combat).toBeNull();
      expect(g.state.travelIntent).toBeNull();
      expect(g.state.pendingReturn).toBeNull();
      // What the player had remembered there is still remembered: a later visit resumes it.
      expect(g.state.resumeActivity['f4_woods_edge']).toBe('hunt');
      expect(g.state.log.map((l) => l.msg)).toContain('Return cancelled. Stopping at The Woods Edge.');
      g.travelPlanTo('f4_treeline');
      walkUntilStill(g);
      g.travelPlanTo('f4_woods_edge');
      walkUntilStill(g);
      expect(g.state.activity).toBe('hunt');
    });

    it('without Stay here the same walk does start the hunt on arrival', () => {
      const g = knockedOut(39);
      recovered(g);
      for (let i = 0; i < 20 && !g.state.travel; i++) g.tick();
      walkUntilStill(g);
      expect(g.state.spot).toBe('f4_woods_edge');
      expect(g.state.activity).toBe('hunt');
    });

    it('says Stay here standing still, and where the leg ends while walking', () => {
      const g = knockedOut(40);
      expect(stayLabel(g.state)).toBe('Stay here');
      recovered(g);
      for (let i = 0; i < 20 && !g.state.travel; i++) g.tick();
      expect(stayLabel(g.state)).toBe('Stop at The Woods Edge');
      g.state.discovered = g.state.discovered.filter((id) => id !== 'f4_woods_edge');
      expect(stayLabel(g.state)).toBe('Stop at Unknown place');
    });

    it('an arrival ends a plain "Stay here" intent without starting what the spot remembers', () => {
      // The sentinel on its own, with no return: the arrival at the spot starts nothing.
      const g = midgame(41);
      work(g, 'the_sand', 'train_dex_sand');
      standAt(g, 'granary_gate');
      g.travelPlanTo('the_sand');
      g.state.travelIntent = { spot: 'the_sand', activity: ARRIVE_IDLE };
      walkUntilStill(g);
      expect(g.state.spot).toBe('the_sand');
      expect(g.state.activity).toBeNull();
      expect(g.state.resumeActivity['the_sand']).toBe('train_dex_sand');
    });

    it('does nothing when no return is in flight, and does not touch a walk the player started', () => {
      const g = midgame(36);
      expect(g.stayHere()).toBe(false);
      g.travelPlanTo('the_sand');
      const plan = [...g.state.travelPlan];
      const leg = g.state.travel;
      expect(g.stayHere()).toBe(false);
      expect(g.state.travelPlan).toEqual(plan);
      expect(g.state.travel).toEqual(leg);
    });

    it('is one of the player\'s commands: the return does not come back on the next tick', () => {
      const g = knockedOut(37);
      recovered(g);
      g.stayHere();
      tickKnockoutReturn(g.state, g.bus);
      expect(g.state.pendingReturn).toBeNull();
      expect(g.state.travel).toBeNull();
    });
  });

  describe('the line the row prints', () => {
    const base = (over: Partial<PendingReturn>): PendingReturn => ({
      target: { spot: 'f4_woods_edge', activity: 'hunt' },
      phase: 'return',
      wins: 0,
      probes: 0,
      ...over,
    });

    it('is null with no return', () => {
      const g = midgame(40);
      expect(returnLine(g.state)).toBeNull();
    });

    it('says what the return does next, with the wait or the wins left', () => {
      const g = midgame(41);
      const s = g.state;
      s.pendingReturn = base({});
      s.recovering = true;
      expect(returnLine(s)).toBe('Returning to The Woods Edge after recovery');
      s.recovering = false;
      expect(returnLine(s)).toBe('Returning to The Woods Edge');

      s.pendingReturn = base({ phase: 'hold', until: s.totalTicks + 10 * 60 * TPS, probes: 0 });
      expect(returnLine(s)).toBe('Retrying The Woods Edge in 10 min');
      s.pendingReturn = base({ phase: 'hold', until: s.totalTicks + 80 * 60 * TPS, probes: 3 });
      expect(returnLine(s)).toBe('Retrying The Woods Edge in 1 h 20 min');

      const fallback = { spot: 'the_sand', activity: 'train_dex_sand' };
      s.pendingReturn = base({ phase: 'fallback', fallback, wins: 0, until: s.totalTicks + 2 * 3600 * TPS });
      expect(returnLine(s)).toBe('Hunting The Sand for 200 wins or 2 h, then The Woods Edge');
      s.pendingReturn = base({ phase: 'fallback', fallback, wins: 13, until: s.totalTicks + 90 * 60 * TPS });
      expect(returnLine(s)).toBe('Hunting The Sand for 187 wins or 1 h 30 min, then The Woods Edge');
      s.pendingReturn = base({ target: null, phase: 'fallback', fallback, wins: 0, until: s.totalTicks + 3600 * TPS });
      expect(returnLine(s)).toBe('Hunting The Sand for 200 wins or 1 h');
    });

    it('at a hunt target, says the return ends at the first win instead of "Returning to" the place it stands at', () => {
      const s = midgame(43).state;
      s.pendingReturn = base({});
      s.spot = 'f4_woods_edge';
      expect(returnLine(s)).toBe('At The Woods Edge: the return ends at the first win.');
      // Work with no fights ends the return on arrival: no claim about a win.
      s.pendingReturn = base({ target: { spot: 'the_sand', activity: 'train_dex_sand' } });
      s.spot = 'the_sand';
      expect(returnLine(s)).toBe('Returning to The Sand');
      // A hold and a fallback are about somewhere else, wherever the character stands.
      s.pendingReturn = base({ phase: 'hold', until: s.totalTicks + 10 * 60 * TPS });
      s.spot = 'f4_woods_edge';
      expect(returnLine(s)).toBe('Retrying The Woods Edge in 10 min');
    });

    it('in a real return, changes to the first-win line when the walk back ends at the target', () => {
      const g = knockedOut(44);
      expect(returnLine(g.state)).toBe('Returning to The Woods Edge after recovery');
      recovered(g);
      for (let i = 0; i < 20 && !g.state.travel; i++) g.tick();
      expect(returnLine(g.state)).toBe('Returning to The Woods Edge');
      walkUntilStill(g);
      expect(g.state.spot).toBe('f4_woods_edge');
      expect(g.state.pendingReturn?.phase).toBe('return'); // it lasts until the first win
      expect(returnLine(g.state)).toBe('At The Woods Edge: the return ends at the first win.');
    });

    it('never names a place that is not discovered', () => {
      const g = midgame(42);
      const s = g.state;
      s.pendingReturn = base({ target: { spot: 'f4_ravine_floor', activity: 'hunt' } });
      expect(s.discovered).not.toContain('f4_ravine_floor');
      expect(returnLine(s)).toBe('Returning to Unknown place');
    });
  });
});

// ---------- The Wayfinding boon text ----------

describe('the Wayfinding boon text', () => {
  const desc = PRESTIGE_BOONS.wayfinding.desc;

  it('says what it still sells and what is free without it', () => {
    expect(desc).toContain('quest givers and objectives anywhere on the map');
    expect(desc).toContain('Trains at');
    expect(desc).toContain('Quests tab');
    expect(desc).toContain('Stations row');
    expect(desc).toContain('worked at');
  });

  it('stays in the engineer register: no mood language', () => {
    expect(desc).not.toMatch(/\b(wander|journey|adventur|explor|safely|easily)\b/i);
  });
});
