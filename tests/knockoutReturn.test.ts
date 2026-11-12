import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createInitialState, SAVE_VERSION } from '../src/core/state';
import { Game } from '../src/core/game';
import { TPS } from '../src/core/engine/loop';
import {
  ADJACENCY,
  AREAS,
  FLOORS,
  SPOTS,
  buildAdjacency,
  declaredConnections,
  type Edge,
} from '../src/core/registry';
import { deserialize, serialize } from '../src/core/save/save';
import { MIGRATIONS } from '../src/core/save/migrations';
import { tickCombat } from '../src/core/systems/combat';
import { getDerivedStats } from '../src/core/systems/derived';
import { festivalFloorOf } from '../src/core/systems/festivalRules';
import { hpFraction } from '../src/core/systems/health';
import { retreatToSafety } from '../src/core/systems/safety';
import { applyStatus } from '../src/core/systems/statuses';
import { returnRecoverTarget } from '../src/core/systems/huntrest';
import { floorUnlocked } from '../src/core/systems/towers';
import {
  FALLBACK_TICKS,
  FALLBACK_WINS,
  HOLD_MINUTES,
  NEVER_TARGET_SPOTS,
  PROVEN_STREAK,
  STREAK_LIMIT,
  captureFall,
  defeatDialogDue,
  holdTicks,
  knockoutStreak,
  noteKnockout,
  returnBlock,
  tickKnockoutReturn,
} from '../src/core/systems/knockoutReturn';
import { STATUSES } from '../src/core/registry';
import type { GameState, PendingReturn, ReturnSpot, SpotDef, StatusDef } from '../src/core/types';
import { clearFloors } from './fixtures/floors';

/**
 * The knockout return (docs/plans/knockout-return.md): after a knockout the
 * character recovers to 95%, walks back and resumes, or falls back, or holds.
 *
 * A pocket world is spliced into the registry for the duration:
 *
 *   kr_camp (haven) - kr_gate - kr_field    (hunt)
 *                           |- kr_meadow   (hunt, the usual fallback)
 *                           |- kr_hopeless (hunt, a level-30 golem)
 *                           |- kr_ring     (hunt, one fight in its budget)
 *                           |- kr_lane     (hunt, three fights in its budget)
 *                           |- kr_yard     (drill, a training activity)
 *                           |- kr_den      (FORCED spot, hunt) - kr_behind (hunt)
 *                           '- kr_pit      (hunt, reached by a FORCED road)
 *
 * `fallAt` runs the decision a knockout makes (capture, retreat, record) on
 * a chosen spot, which is what the table in the plan is written against. The
 * integration tests further down lose real fights and let real conditions
 * kill, so the four hook sites are covered too.
 */

const hunt = { id: 'hunt', kind: 'hunt' as const, name: 'Hunt', icon: '🏹' };
const rats = [{ monsterId: 'forest_rat', weight: 100, level: [1, 1] as [number, number] }];
const golem = [{ monsterId: 'stone_golem', weight: 100, level: [30, 30] as [number, number] }];

function pocket(id: string, name: string, extra: Partial<SpotDef>): SpotDef {
  return {
    id,
    name,
    icon: '📍',
    areaId: 'kr_area',
    desc: '',
    activities: [],
    connections: [],
    ...extra,
  };
}

const KR: Record<string, SpotDef> = {
  kr_camp: pocket('kr_camp', 'Test Camp', {
    waypoint: true,
    activities: [{ id: 'rest', kind: 'rest', name: 'Camp', icon: '🏕️' }],
    connections: [{ to: 'kr_gate', ticks: 5 }],
  }),
  kr_gate: pocket('kr_gate', 'Test Gate', {
    connections: [
      { to: 'kr_field', ticks: 5 },
      { to: 'kr_meadow', ticks: 5 },
      { to: 'kr_hopeless', ticks: 5 },
      { to: 'kr_ring', ticks: 5 },
      { to: 'kr_lane', ticks: 5 },
      { to: 'kr_yard', ticks: 5 },
      { to: 'kr_den', ticks: 5 },
      { to: 'kr_pit', ticks: 5, forced: true },
    ],
  }),
  kr_field: pocket('kr_field', 'Test Field', { activities: [hunt], encounters: rats }),
  kr_meadow: pocket('kr_meadow', 'Test Meadow', { waypoint: true, activities: [hunt], encounters: rats }),
  kr_hopeless: pocket('kr_hopeless', 'Test Pit of Golems', { activities: [hunt], encounters: golem }),
  kr_ring: pocket('kr_ring', 'Test Ring', { fightLimit: 1, activities: [hunt], encounters: rats }),
  kr_lane: pocket('kr_lane', 'Test Lane', { fightLimit: 3, activities: [hunt], encounters: rats }),
  kr_yard: pocket('kr_yard', 'Test Yard', {
    activities: [{ id: 'drill', kind: 'train', attr: 'str', name: 'Drill', icon: '🏋️' }],
  }),
  kr_den: pocket('kr_den', 'Test Den', {
    forced: true,
    activities: [hunt],
    encounters: rats,
    connections: [{ to: 'kr_behind', ticks: 5 }],
  }),
  kr_behind: pocket('kr_behind', 'Test Behind', { activities: [hunt], encounters: rats }),
  kr_pit: pocket('kr_pit', 'Test Pit', { activities: [hunt], encounters: rats }),
};

beforeAll(() => {
  AREAS['kr_area'] = { id: 'kr_area', name: 'Return Test', regionId: 'the_ascent' };
  Object.assign(SPOTS, KR);
  // Mirrors every road and leaves `forced` off the way back, as the real build does.
  buildAdjacency(declaredConnections(KR), ADJACENCY);
});

afterAll(() => {
  for (const id of Object.keys(KR)) {
    delete SPOTS[id];
    ADJACENCY.delete(id);
  }
  // The mirrors the pocket world added to real spots (none: it touches only kr_*).
  delete AREAS['kr_area'];
});

/** A game standing at `spot`, the whole pocket world known, with a haven at the camp. */
function world(seed: number, spot = 'kr_field'): Game {
  const g = new Game(createInitialState(seed));
  const s = g.state;
  s.spot = spot;
  s.discovered.push(...Object.keys(KR));
  s.safeSpots = { nearest: 'kr_camp', unconditional: 'kr_camp' };
  return g;
}

const lines = (g: Game): string[] => g.state.log.map((l) => l.msg);
const koLines = (g: Game): string[] =>
  lines(g).filter((m) => /^(Returning to|Retrying|\d+ knockouts|No safer|.+: .+\. (Hunting|No safer))/.test(m));

/**
 * One knockout at `spot` doing `activity`, in the order combat.ts onDefeat
 * runs it: capture, hurt, retreat, record.
 */
function fallAt(g: Game, spot: string, activity: string | null = 'hunt', forced = false): void {
  const s = g.state;
  s.spot = spot;
  s.activity = activity;
  // A forced fight is open at the moment of capture, as in onDefeat.
  s.combat = forced ? ({ forced: true } as never) : null;
  s.travel = null;
  s.travelPlan = [];
  s.travelIntent = null;
  const fall = captureFall(s);
  s.combat = null;
  s.resources.hp = 1;
  s.recovering = true;
  retreatToSafety(s, g.bus, 'Knocked out.');
  noteKnockout(s, g.bus, fall);
}

/** Up and healthy at the haven, as if the recovery had run. */
function recovered(g: Game): void {
  g.state.recovering = false;
  g.state.resources.hp = getDerivedStats(g.state).maxHp;
}

/** A won hunt at `spot`. */
function win(g: Game, spot: string): void {
  g.state.spot = spot;
  g.state.activity = 'hunt';
  g.bus.emit({ type: 'fight:won', spot, forced: false });
}

const pending = (g: Game): PendingReturn => g.state.pendingReturn!;

/**
 * A tick where the world is not moving though it should be: a fight open on
 * the road, a fight open with no work selected (nothing ticks it), or a return
 * pending outside its hold with nothing running, walking or recovering.
 */
function stalled(s: GameState): boolean {
  if (s.combat && s.travel) return true;
  if (s.combat && !s.activity && !s.combat.forced) return true;
  const p = s.pendingReturn;
  return !!p && p.phase !== 'hold' && !s.activity && !s.travel && !s.combat && !s.recovering;
}

describe('a fall: haven, 95%, walk, hunting', () => {
  it('a real lost fight at a hunt spot is followed by the walk back', () => {
    const g = world(3, 'kr_hopeless');
    const s = g.state;
    g.selectActivity('hunt');
    for (let i = 0; i < 4000 && !s.recovering; i++) g.tick();

    // The retreat stays: the character wakes at the haven, out cold.
    expect(s.recovering).toBe(true);
    expect(s.spot).toBe('kr_camp');
    expect(s.activity).toBeNull();
    expect(pending(g)).toMatchObject({
      phase: 'return',
      target: { spot: 'kr_hopeless', activity: 'hunt' },
    });
    expect(knockoutStreak(s, 'kr_hopeless')).toBe(1);
    expect(lines(g)).toContain('Returning to Test Pit of Golems.');
    // The ledger is still written; only the window waits for nothing to follow.
    expect(s.lastFight?.outcome).toBe('knocked_out');
    expect(defeatDialogDue(s)).toBe(false);

    // Recovery runs to 95%, not the old 60%.
    for (let i = 0; i < 4000 && s.recovering; i++) g.tick();
    expect(s.recovering).toBe(false);
    expect(hpFraction(s, getDerivedStats(s))).toBeGreaterThanOrEqual(0.94);

    // Then the walk, the arrival, and the work: with nothing to clear it on the way.
    for (let i = 0; i < 400 && !(s.spot === 'kr_hopeless' && s.activity === 'hunt'); i++) g.tick();
    expect(s.spot).toBe('kr_hopeless');
    expect(s.activity).toBe('hunt');
    expect(pending(g).phase).toBe('return');
  });

  it('a fall at f4_deep_woods: the Treeline camp, 95%, the walk, then hunting', () => {
    const g = new Game(createInitialState(8));
    const s = g.state;
    s.spot = 'f4_deep_woods';
    s.discovered.push('f4_treeline', 'f4_woods_edge', 'f4_deep_woods');
    s.safeSpots = { nearest: 'f4_treeline', unconditional: 'f4_treeline' };
    g.selectActivity('hunt');
    for (let i = 0; i < 6000 && !s.recovering; i++) g.tick();

    expect(s.recovering).toBe(true);
    expect(s.spot).toBe('f4_treeline');
    expect(pending(g)).toMatchObject({ phase: 'return', target: { spot: 'f4_deep_woods', activity: 'hunt' } });
    expect(lines(g)).toContain('Returning to The Deep Woods.');

    for (let i = 0; i < 4000 && s.recovering; i++) g.tick();
    expect(hpFraction(s, getDerivedStats(s))).toBeGreaterThanOrEqual(0.94);
    for (let i = 0; i < 400 && !(s.spot === 'f4_deep_woods' && s.activity === 'hunt'); i++) g.tick();
    expect(s.spot).toBe('f4_deep_woods');
    expect(s.activity).toBe('hunt');
    expect(pending(g).phase).toBe('return');
  });

  it('the return’s own arrival does not clear it; a win at the target does', () => {
    const g = world(4);
    const s = g.state;
    fallAt(g, 'kr_field');
    recovered(g);
    expect(s.spot).toBe('kr_camp');

    // The tick after recovery sets out; settleArrival starts the hunt on arrival.
    for (let i = 0; i < 100 && !(s.spot === 'kr_field' && s.activity === 'hunt'); i++) {
      g.tick();
      if (s.spot === 'kr_field' && s.activity === 'hunt') break;
      // A rat would end the return by dying; this test is about the walk.
      s.combat = null;
    }
    expect(s.spot).toBe('kr_field');
    expect(s.activity).toBe('hunt');
    expect(s.travelIntent).toBeNull();
    expect(pending(g)).toMatchObject({ phase: 'return', target: { spot: 'kr_field' } });

    win(g, 'kr_field');
    expect(s.pendingReturn).toBeNull();
    expect(knockoutStreak(s, 'kr_field')).toBe(0);
  });

  it('a haven that is its own target starts the work in place', () => {
    const g = world(5, 'kr_camp');
    KR.kr_camp.activities.push(hunt);
    try {
      fallAt(g, 'kr_camp');
      expect(pending(g).phase).toBe('return');
      recovered(g);
      g.tick();
      expect(g.state.spot).toBe('kr_camp');
      expect(g.state.activity).toBe('hunt');
      expect(pending(g).phase).toBe('return');
    } finally {
      KR.kr_camp.activities.pop();
    }
  });

  it('work with no fights ends the return on arrival', () => {
    const g = world(6, 'kr_camp');
    fallAt(g, 'kr_camp', 'rest');
    recovered(g);
    g.tick();
    expect(g.state.activity).toBe('rest');
    g.tick();
    expect(g.state.pendingReturn).toBeNull();
  });
});

describe('the four knockout sites', () => {
  it('a condition that finishes the player is followed by the return too', () => {
    const g = world(4);
    g.selectActivity('hunt');
    g.state.respawnTimer = 1_000_000; // no fight: the condition does it
    g.state.resources.hp = 3;
    applyStatus(g.state, g.state, { id: 'blazing', intensity: 5 });
    for (let i = 0; i < 60 && !g.state.recovering; i++) g.tick();
    expect(g.state.recovering).toBe(true);
    expect(g.state.spot).toBe('kr_camp');
    expect(pending(g)).toMatchObject({ phase: 'return', target: { spot: 'kr_field', activity: 'hunt' } });
  });

  it('a sealed pool (the fatal-condition site) records the same fall', () => {
    const g = world(31);
    g.selectActivity('hunt');
    g.state.respawnTimer = 1_000_000;
    applyStatus(g.state, g.state, { id: 'corrupted', intensity: 7 });
    const held = g.state.statuses.find((h) => h.id === 'corrupted')!;
    held.intensity = 10;
    for (let i = 0; i < 10 && !g.state.recovering; i++) g.tick();
    expect(g.state.recovering).toBe(true);
    expect(pending(g)).toMatchObject({ phase: 'return', target: { spot: 'kr_field' } });
  });
});

describe('what the return never walks back into', () => {
  it('a forced spot: fall back, never walk in', () => {
    const g = world(7, 'kr_den');
    g.state.proven = { spot: 'kr_meadow', activity: 'hunt' };
    fallAt(g, 'kr_den');
    expect(pending(g)).toMatchObject({ phase: 'fallback', target: null, fallback: { spot: 'kr_meadow' } });
    expect(lines(g)).toContain('Test Den: forced fight, not re-entered. Hunting Test Meadow for 200 wins.');
  });

  it('a forced last road: fall back, never walk in', () => {
    const g = world(8, 'kr_pit');
    g.state.proven = { spot: 'kr_meadow', activity: 'hunt' };
    // The spot itself is not forced; only the road into it is.
    expect(SPOTS.kr_pit.forced).toBeUndefined();
    expect(returnBlock(g.state, { spot: 'kr_pit', activity: 'hunt' })).toBeNull(); // from the pit itself
    g.state.spot = 'kr_camp';
    expect(returnBlock(g.state, { spot: 'kr_pit', activity: 'hunt' })).toBe('forced_road');
    fallAt(g, 'kr_pit');
    expect(pending(g)).toMatchObject({ phase: 'fallback', target: null });
    expect(lines(g)).toContain('Test Pit: forced road in, not re-entered. Hunting Test Meadow for 200 wins.');
  });

  it('a spot only a forced spot leads to has no route, so it falls back', () => {
    const g = world(9, 'kr_behind');
    g.state.proven = { spot: 'kr_meadow', activity: 'hunt' };
    fallAt(g, 'kr_behind');
    expect(pending(g)).toMatchObject({ phase: 'fallback', target: null });
    expect(lines(g)).toContain('Test Behind: no known route back. Hunting Test Meadow for 200 wins.');
  });

  it('with no proven spot, an ineligible fall idles and the log says why', () => {
    const g = world(10, 'kr_den');
    fallAt(g, 'kr_den');
    expect(g.state.pendingReturn).toBeNull();
    expect(lines(g)).toContain('Test Den: forced fight, not re-entered. No safer hunt known.');
    expect(defeatDialogDue(g.state)).toBe(true);
  });

  it('the stronghold wall is never a target', () => {
    expect(NEVER_TARGET_SPOTS).toContain('f11_wall');
    for (const id of NEVER_TARGET_SPOTS) expect(SPOTS[id], `${id} must exist`).toBeDefined();
    const g = world(11);
    expect(returnBlock(g.state, { spot: 'f11_wall', activity: 'hunt' })).toBe('wall');
  });

  it('a festival floor is never a target', () => {
    const g = world(12);
    const festival = Object.values(SPOTS).find((s) => festivalFloorOf(s.id) && s.activities.length > 0);
    expect(festival, 'a festival spot with an activity to test with').toBeDefined();
    const act = festival!.activities[0];
    expect(returnBlock(g.state, { spot: festival!.id, activity: act.id })).toBe('festival');
    // The fall on a festival floor ejects to the tower's hub and earns no return.
    g.state.discovered.push(festival!.id);
    fallAt(g, festival!.id, act.id);
    expect(g.state.pendingReturn).toBeNull();
    expect(lines(g).some((m) => m.includes('festival floor, not re-entered'))).toBe(true);
  });

  it('an idle character is sent nowhere: no return, no fallback, no hold, no line', () => {
    const g = world(13);
    const before = lines(g).length;
    fallAt(g, 'kr_camp', null);
    expect(g.state.pendingReturn).toBeNull();
    // Even with a proven hunt in hand.
    g.state.proven = { spot: 'kr_meadow', activity: 'hunt' };
    fallAt(g, 'kr_camp', null);
    expect(g.state.pendingReturn).toBeNull();
    expect(koLines(g)).toEqual([]);
    expect(lines(g).length).toBeGreaterThan(before); // the retreat still says where it woke
    expect(knockoutStreak(g.state, 'kr_camp')).toBe(0);
    expect(defeatDialogDue(g.state)).toBe(true);
    // And it stays idle after recovering.
    recovered(g);
    for (let i = 0; i < 100; i++) g.tick();
    expect(g.state.activity).toBeNull();
    expect(g.state.travel).toBeNull();
  });

  it('a return already in flight carries on through a knockout with no work running', () => {
    const g = world(46);
    g.state.proven = { spot: 'kr_meadow', activity: 'hunt' };
    for (let i = 0; i < STREAK_LIMIT; i++) fallAt(g, 'kr_field');
    const before = JSON.parse(JSON.stringify(pending(g)));
    expect(before.phase).toBe('fallback');
    fallAt(g, 'kr_camp', null);
    expect(pending(g)).toEqual(before);
    expect(lines(g)).toContain('Returning to Test Meadow.');
  });

  it('a forced fight with no activity selected is still work walked into: it falls back', () => {
    // Travel clears the activity, so an ambush is lost with `activity` null.
    const g = world(47, 'kr_den');
    g.state.proven = { spot: 'kr_meadow', activity: 'hunt' };
    fallAt(g, 'kr_den', null, true);
    expect(pending(g)).toMatchObject({ phase: 'fallback', target: null, fallback: { spot: 'kr_meadow' } });
    expect(lines(g)).toContain('Test Den: forced fight, not re-entered. Hunting Test Meadow for 200 wins.');
    // By a forced road, on a spot that is not itself forced.
    const h = world(48, 'kr_pit');
    h.state.proven = { spot: 'kr_meadow', activity: 'hunt' };
    fallAt(h, 'kr_pit', null, true);
    expect(lines(h)).toContain('Test Pit: forced road in, not re-entered. Hunting Test Meadow for 200 wins.');
    // With nothing to fall back to, the character idles and the log says why.
    const k = world(49, 'kr_den');
    fallAt(k, 'kr_den', null, true);
    expect(k.state.pendingReturn).toBeNull();
    expect(lines(k)).toContain('Test Den: forced fight, not re-entered. No safer hunt known.');
  });

  it('a real ambush lost at a forced spot falls back to the proven hunt', () => {
    const g = world(50, 'kr_gate');
    const s = g.state;
    s.proven = { spot: 'kr_meadow', activity: 'hunt' };
    expect(g.travelTo('kr_den')).toBe(true);
    for (let i = 0; i < 100 && s.travel; i++) g.tick();
    expect(s.combat?.forced).toBe(true);
    expect(s.activity).toBeNull(); // nothing was selected: the walk cleared it
    s.resources.hp = 1;
    for (let i = 0; i < 3000 && !s.recovering; i++) g.tick();
    expect(s.recovering).toBe(true);
    expect(pending(g)).toMatchObject({ phase: 'fallback', target: null, fallback: { spot: 'kr_meadow' } });
  });
});

describe('the loop guard and the fallback', () => {
  it('the 5th knockout in a row goes to the proven hunt', () => {
    const g = world(14);
    g.state.proven = { spot: 'kr_meadow', activity: 'hunt' };
    for (let i = 1; i < STREAK_LIMIT; i++) {
      fallAt(g, 'kr_field');
      expect(pending(g).phase, `knockout ${i}`).toBe('return');
    }
    fallAt(g, 'kr_field');
    expect(knockoutStreak(g.state, 'kr_field')).toBe(5);
    expect(pending(g)).toMatchObject({
      phase: 'fallback',
      target: { spot: 'kr_field', activity: 'hunt' },
      fallback: { spot: 'kr_meadow', activity: 'hunt' },
      wins: 0,
    });
    expect(pending(g).until).toBe(g.state.totalTicks + FALLBACK_TICKS);
    expect(lines(g)).toContain('5 knockouts in a row at Test Field. Hunting Test Meadow for 200 wins.');
  });

  it('a win at the spot ends the streak', () => {
    const g = world(15);
    for (let i = 0; i < 3; i++) fallAt(g, 'kr_field');
    expect(knockoutStreak(g.state, 'kr_field')).toBe(3);
    win(g, 'kr_field');
    expect(knockoutStreak(g.state, 'kr_field')).toBe(0);
  });

  it('200 wins at the fallback lead to a retry of the target', () => {
    const g = world(16);
    g.state.proven = { spot: 'kr_meadow', activity: 'hunt' };
    for (let i = 0; i < STREAK_LIMIT; i++) fallAt(g, 'kr_field');
    for (let i = 1; i < FALLBACK_WINS; i++) win(g, 'kr_meadow');
    expect(pending(g)).toMatchObject({ phase: 'fallback', wins: FALLBACK_WINS - 1 });
    win(g, 'kr_meadow');
    expect(pending(g)).toMatchObject({ phase: 'return', target: { spot: 'kr_field', activity: 'hunt' }, wins: 0 });
    expect(lines(g)).toContain('Retrying Test Field.');

    // And the walk happens on the next free tick.
    recovered(g);
    g.tick();
    expect(g.state.travel?.from).toBe('kr_meadow');
  });

  it('2 h at the fallback also lead to a retry, at the next free tick', () => {
    const g = world(17);
    g.state.proven = { spot: 'kr_meadow', activity: 'hunt' };
    for (let i = 0; i < STREAK_LIMIT; i++) fallAt(g, 'kr_field');
    recovered(g);
    g.tick(); // sets out for the meadow
    for (let i = 0; i < 100 && !(g.state.spot === 'kr_meadow' && g.state.activity === 'hunt'); i++) g.tick();
    expect(g.state.activity).toBe('hunt');
    expect(pending(g).phase).toBe('fallback');
    g.state.combat = null;
    g.state.totalTicks = pending(g).until!;
    g.tick();
    expect(pending(g)).toMatchObject({ phase: 'return', target: { spot: 'kr_field' } });
  });

  it('a fallback with no target ends where it is, hunting on as normal', () => {
    const g = world(18, 'kr_den');
    g.state.proven = { spot: 'kr_meadow', activity: 'hunt' };
    fallAt(g, 'kr_den');
    for (let i = 0; i < FALLBACK_WINS; i++) win(g, 'kr_meadow');
    expect(g.state.pendingReturn).toBeNull();
  });

  it('a knockout at the fallback keeps the target and goes back to the fallback', () => {
    const g = world(19, 'kr_meadow');
    g.state.pendingReturn = {
      target: { spot: 'kr_field', activity: 'hunt' },
      phase: 'fallback',
      fallback: { spot: 'kr_meadow', activity: 'hunt' },
      wins: 7,
      until: g.state.totalTicks + FALLBACK_TICKS,
      probes: 0,
    };
    const until = pending(g).until;
    g.state.proven = { spot: 'kr_meadow', activity: 'hunt' };
    fallAt(g, 'kr_meadow');
    expect(pending(g)).toMatchObject({
      phase: 'fallback',
      target: { spot: 'kr_field' },
      fallback: { spot: 'kr_meadow' },
      wins: 7,
      until,
    });
    expect(lines(g)).toContain('Returning to Test Meadow.');
    // The mover goes to the fallback, not the target.
    recovered(g);
    g.tick();
    for (let i = 0; i < 100 && !(g.state.spot === 'kr_meadow' && g.state.activity === 'hunt'); i++) g.tick();
    expect(g.state.spot).toBe('kr_meadow');
  });

  it('5 knockouts in a row at the fallback hold on the target', () => {
    const g = world(20, 'kr_meadow');
    g.state.pendingReturn = {
      target: { spot: 'kr_field', activity: 'hunt' },
      phase: 'fallback',
      fallback: { spot: 'kr_meadow', activity: 'hunt' },
      wins: 3,
      until: g.state.totalTicks + FALLBACK_TICKS,
      probes: 0,
    };
    g.state.proven = { spot: 'kr_meadow', activity: 'hunt' };
    for (let i = 0; i < STREAK_LIMIT; i++) fallAt(g, 'kr_meadow');
    expect(pending(g)).toMatchObject({ phase: 'hold', target: { spot: 'kr_field' }, probes: 0 });
    expect(lines(g)).toContain('5 knockouts in a row at Test Meadow. Retrying Test Field in 10 min.');
    // A spot that sent the character down 5 times is no longer the proven one.
    expect(g.state.proven).toBeNull();
  });

  it('a cleared, forced, unreachable or higher-floor proven spot is not used', () => {
    const cases: [string, { spot: string; activity: string }, () => void][] = [
      ['cleared', { spot: 'kr_ring', activity: 'hunt' }, () => void 0],
      ['forced', { spot: 'kr_den', activity: 'hunt' }, () => void 0],
      ['behind a forced spot', { spot: 'kr_behind', activity: 'hunt' }, () => void 0],
      ['no hunt there', { spot: 'kr_gate', activity: 'hunt' }, () => void 0],
      ['an unknown spot', { spot: 'nowhere', activity: 'hunt' }, () => void 0],
    ];
    for (const [label, proven] of cases) {
      const g = world(21);
      g.state.stats['fights:kr_ring'] = 1; // the ring's one fight is spent
      g.state.proven = proven;
      for (let i = 0; i < STREAK_LIMIT; i++) fallAt(g, 'kr_field');
      expect(pending(g).phase, label).toBe('hold');
    }
  });

  it('a proven spot on a higher floor than the fall is not used; on the same floor it is', () => {
    const open = (seed: number): Game => {
      const g = new Game(createInitialState(seed));
      const s = g.state;
      // Floors 1 to 4 cleared and floor 5's gate met: the ladder reaches floor 5.
      clearFloors(s.stats, ['ascent_f1', 'ascent_f2', 'ascent_f3', 'ascent_f4']);
      s.stats['gold:earned'] = 100_000;
      s.stats['kills:tag:goblin'] = 100;
      expect(floorUnlocked(s, FLOORS.ascent_f5)).toBe(true);
      for (const spot of Object.values(SPOTS)) {
        if (/^ascent_f[45]_area$/.test(spot.areaId)) s.discovered.push(spot.id);
      }
      s.proven = { spot: 'f5_drowned_village', activity: 'hunt' };
      return g;
    };
    // Fell on floor 4 with the last haven there: floor 5 is above the fall.
    const below = open(22);
    below.state.safeSpots = { nearest: 'f4_treeline', unconditional: 'f4_treeline' };
    for (let i = 0; i < STREAK_LIMIT; i++) fallAt(below, 'f4_woods_edge');
    expect(pending(below).phase).toBe('hold');
    // The same candidate, fallen on floor 5: reachable and not higher, so it is used.
    const level = open(23);
    level.state.safeSpots = { nearest: 'f5_causeway', unconditional: 'f5_causeway' };
    for (let i = 0; i < STREAK_LIMIT; i++) fallAt(level, 'f5_bog');
    expect(pending(level)).toMatchObject({ phase: 'fallback', fallback: { spot: 'f5_drowned_village' } });
  });

  it('the proven hunt is the last spot with 10 wins in a row, never a budgeted, forced or festival spot', () => {
    const g = world(23);
    for (let i = 0; i < PROVEN_STREAK - 1; i++) win(g, 'kr_field');
    expect(g.state.proven).toBeNull();
    win(g, 'kr_field');
    expect(g.state.proven).toEqual({ spot: 'kr_field', activity: 'hunt' });
    // Ten more elsewhere move it.
    for (let i = 0; i < PROVEN_STREAK; i++) win(g, 'kr_meadow');
    expect(g.state.proven).toEqual({ spot: 'kr_meadow', activity: 'hunt' });
    // A knockout breaks the streak at that spot.
    fallAt(g, 'kr_field');
    for (let i = 0; i < PROVEN_STREAK - 1; i++) win(g, 'kr_field');
    expect(g.state.proven).toEqual({ spot: 'kr_meadow', activity: 'hunt' });
    // Spots with a fight budget or a forced arrival never qualify.
    const h = world(24);
    for (let i = 0; i < PROVEN_STREAK + 2; i++) win(h, 'kr_ring');
    for (let i = 0; i < PROVEN_STREAK + 2; i++) win(h, 'kr_den');
    expect(h.state.proven).toBeNull();
    // Nor does a forced fight, wherever it is.
    for (let i = 0; i < PROVEN_STREAK + 2; i++) {
      h.state.spot = 'kr_field';
      h.state.activity = 'hunt';
      h.bus.emit({ type: 'fight:won', spot: 'kr_field', forced: true });
    }
    expect(h.state.proven).toBeNull();
  });
});

describe('the hold', () => {
  it('waits 10, 20, 40, 80 and 80 minutes, probing the target each time', () => {
    const g = world(25);
    const waits: number[] = [];
    for (let i = 0; i < STREAK_LIMIT; i++) fallAt(g, 'kr_field');
    expect(pending(g).phase).toBe('hold');
    expect(lines(g)).toContain('No safer hunt known. Retrying Test Field in 10 min.');
    for (let probe = 0; probe < 5; probe++) {
      const p = pending(g);
      waits.push((p.until! - g.state.totalTicks) / (60 * TPS));
      // Nothing happens until the wait is over: idle at the haven.
      recovered(g);
      g.state.totalTicks = p.until! - 2; // a tick adds one before the world moves
      g.tick();
      expect(pending(g).phase).toBe('hold');
      expect(g.state.activity).toBeNull();
      g.tick();
      expect(pending(g).phase, `probe ${probe}`).toBe('return');
      expect(lines(g)).toContain('Retrying Test Field.');
      // The probe is lost: the wait doubles.
      fallAt(g, 'kr_field');
      expect(pending(g).phase).toBe('hold');
    }
    expect(waits).toEqual([10, 20, 40, 80, 80]);
    expect(waits).toEqual([...HOLD_MINUTES, HOLD_MINUTES[HOLD_MINUTES.length - 1]]);
    expect(holdTicks(99)).toBe(80 * 60 * TPS);
  });

  it('a win at the target ends the hold schedule', () => {
    const g = world(26);
    for (let i = 0; i < STREAK_LIMIT; i++) fallAt(g, 'kr_field');
    const p = pending(g);
    recovered(g);
    g.state.totalTicks = p.until! - 1;
    g.tick();
    expect(pending(g).phase).toBe('return');
    win(g, 'kr_field');
    expect(g.state.pendingReturn).toBeNull();
    // The next streak starts from zero: a fresh knockout is a plain return.
    fallAt(g, 'kr_field');
    expect(pending(g)).toMatchObject({ phase: 'return', probes: 0 });
  });

  it('a hopeless spot never idles the character for more than 80 minutes, over 8 hours', () => {
    const g = world(27, 'kr_hopeless');
    const s = g.state;
    g.selectActivity('hunt');
    const EIGHT_HOURS = 8 * 3600 * TPS;
    const LIMIT = 80 * 60 * TPS;
    let longest = 0;
    let stretch = 0;
    let longestStall = 0;
    let stall = 0;
    let probes = 0;
    let lastPhase = s.pendingReturn?.phase;
    for (let i = 0; i < EIGHT_HOURS; i++) {
      g.tick();
      // Idle: nothing selected, not walking, not fighting. Being out cold counts.
      if (!s.activity && !s.travel && !s.combat) stretch++;
      else stretch = 0;
      if (stretch > longest) longest = stretch;
      stall = stalled(s) ? stall + 1 : 0;
      if (stall > longestStall) longestStall = stall;
      const phase = s.pendingReturn?.phase;
      if (phase === 'return' && lastPhase === 'hold') probes++;
      lastPhase = phase;
    }
    // Nothing waited on a fight that no tick would ever resolve.
    expect(longestStall).toBeLessThanOrEqual(3);
    // The hold is counted from the knockout, so the recovery inside it adds nothing;
    // a minute of slack covers the tick that starts the probe.
    expect(longest).toBeLessThanOrEqual(LIMIT + 60 * TPS);
    // The stretch reaches the limit: the longest hold really was 80 minutes.
    expect(longest).toBeGreaterThanOrEqual(LIMIT - 60 * TPS);
    // It really did cycle: knocked out many times, waiting and probing between.
    expect(s.stats['ko:n:kr_hopeless']).toBeGreaterThan(STREAK_LIMIT + 3);
    expect(probes).toBeGreaterThanOrEqual(5);
    expect(s.totalTicks).toBeGreaterThanOrEqual(EIGHT_HOURS);
  }, 120_000);

  it('with a proven hunt to fall back to, the character is idle only while recovering, over 8 hours', () => {
    const g = world(44, 'kr_hopeless');
    const s = g.state;
    s.proven = { spot: 'kr_meadow', activity: 'hunt' };
    g.selectActivity('hunt');
    const EIGHT_HOURS = 8 * 3600 * TPS;
    let longest = 0;
    let stretch = 0;
    let longestStall = 0;
    let stall = 0;
    let fallbacks = 0;
    let lastPhase = s.pendingReturn?.phase;
    for (let i = 0; i < EIGHT_HOURS; i++) {
      g.tick();
      if (!s.activity && !s.travel && !s.combat) stretch++;
      else stretch = 0;
      if (stretch > longest) longest = stretch;
      stall = stalled(s) ? stall + 1 : 0;
      if (stall > longestStall) longestStall = stall;
      const phase = s.pendingReturn?.phase;
      if (phase === 'fallback' && lastPhase !== 'fallback') fallbacks++;
      lastPhase = phase;
    }
    expect(longestStall).toBeLessThanOrEqual(3);
    // Only the recovery after a knockout is idle time: seconds, never a hold.
    expect(longest).toBeLessThanOrEqual(60 * TPS);
    // The 5-knockout streak sent it to the meadow, and the retries sent it back again.
    expect(fallbacks).toBeGreaterThanOrEqual(2);
    expect(s.stats['kills'] ?? 0).toBeGreaterThan(200);
  }, 120_000);
});

describe('player commands end the return', () => {
  function pendingAtCamp(seed: number): Game {
    const g = world(seed);
    fallAt(g, 'kr_field');
    recovered(g);
    return g;
  }

  it('selecting an activity clears it, and John’s rest-while-recovering keeps today’s behaviour', () => {
    const g = world(28);
    fallAt(g, 'kr_field');
    expect(g.state.recovering).toBe(true);
    g.selectActivity('rest');
    expect(g.state.pendingReturn).toBeNull();
    for (let i = 0; i < 300; i++) g.tick();
    expect(g.state.recovering).toBe(false);
    expect(g.state.spot).toBe('kr_camp');
    expect(g.state.activity).toBe('rest');
  });

  it('stopping by hand clears it', () => {
    const g = pendingAtCamp(29);
    g.selectActivity(null);
    expect(g.state.pendingReturn).toBeNull();
    for (let i = 0; i < 50; i++) g.tick();
    expect(g.state.spot).toBe('kr_camp');
    expect(g.state.travel).toBeNull();
  });

  it('a refused command ends nothing', () => {
    const g = world(30);
    fallAt(g, 'kr_field'); // still out cold
    expect(g.travelPlanTo('kr_meadow')).toBe(false);
    expect(g.travelTo('kr_gate')).toBe(false);
    expect(g.goAndDo('kr_meadow', 'hunt')).toBe(false);
    expect(g.state.pendingReturn).not.toBeNull();
    // A pick the game refuses: a forced fight closes the door.
    g.state.combat = { forced: true } as never;
    g.selectActivity('rest');
    g.state.combat = null;
    expect(g.state.pendingReturn).not.toBeNull();
  });

  it.each([
    ['travelPlanTo', (g: Game) => g.travelPlanTo('kr_meadow')],
    ['travelTo', (g: Game) => g.travelTo('kr_gate')],
    ['goAndDo', (g: Game) => g.goAndDo('kr_meadow', 'hunt')],
    ['fastTravelTo', (g: Game) => { g.state.gold = 5000; return g.fastTravelTo('kr_meadow'); }],
  ])('%s clears it', (_name, command) => {
    const g = pendingAtCamp(31);
    expect(command(g)).toBe(true);
    expect(g.state.pendingReturn).toBeNull();
  });

  it('cancelling a walk clears it', () => {
    const g = pendingAtCamp(32);
    g.travelPlanTo('kr_field');
    g.state.pendingReturn = { target: { spot: 'kr_field', activity: 'hunt' }, phase: 'return', wins: 0, probes: 0 };
    g.cancelTravelPlan();
    expect(g.state.pendingReturn).toBeNull();
  });

  it('changing what a walk is for clears it', () => {
    const g = pendingAtCamp(32);
    g.travelPlanTo('kr_field');
    g.state.pendingReturn = { target: { spot: 'kr_field', activity: 'hunt' }, phase: 'return', wins: 0, probes: 0 };
    expect(g.setJourneyIntent(null)).toBe(true);
    expect(g.state.pendingReturn).toBeNull();
  });

  it('a climb clears it', () => {
    const g = new Game(createInitialState(33, 'ascent_foot'));
    g.state.pendingReturn = { target: { spot: 'f1_storerooms', activity: 'hunt' }, phase: 'return', wins: 0, probes: 0 };
    expect(g.climbTo('ascent_f1')).toBe(true);
    expect(g.state.pendingReturn).toBeNull();
  });

  it('a bench run or a performance is the player’s own work and ends it', () => {
    const g = pendingAtCamp(34);
    g.state.benchWork = {} as never;
    tickKnockoutReturn(g.state, g.bus);
    expect(g.state.pendingReturn).toBeNull();
  });

  it('a prestige clears it, and the proven hunt with it', () => {
    const g = world(35);
    g.state.stats['slain:f6_great_hall:goblin_warchief'] = 1;
    g.state.proven = { spot: 'kr_meadow', activity: 'hunt' };
    fallAt(g, 'kr_field');
    expect(g.state.pendingReturn).not.toBeNull();
    expect(g.prestige()).toBe(true);
    expect(g.state.pendingReturn).toBeNull();
    expect(g.state.proven).toBeNull();
  });
});

describe('recovery runs higher while a return is pending', () => {
  it('95%, or the hunt’s rest target when that is higher', () => {
    const g = world(36);
    const stats = getDerivedStats(g.state);
    expect(returnRecoverTarget(g.state, stats)).toBeNull();
    fallAt(g, 'kr_field');
    expect(returnRecoverTarget(g.state, stats)).toBe(0.95);
    g.setHuntRest(0.5, true);
    expect(returnRecoverTarget(g.state, stats)).toBe(1);
    g.setHuntRest(0.5, false);
    expect(returnRecoverTarget(g.state, stats)).toBe(0.95);
  });

  it('a body that cannot mend stops at the old 60%', () => {
    (STATUSES as Record<string, StatusDef>).test_no_mending = {
      id: 'test_no_mending',
      name: 'No Mending',
      icon: '🚫',
      desc: 'test',
      blocksRegen: ['hp'],
    } as StatusDef;
    try {
      const g = world(37);
      fallAt(g, 'kr_field');
      applyStatus(g.state, g.state, { id: 'test_no_mending', duration: 100_000 }, 'test');
      expect(returnRecoverTarget(g.state, getDerivedStats(g.state))).toBeNull();
    } finally {
      delete (STATUSES as Record<string, StatusDef>).test_no_mending;
    }
  });

  it('with no return pending the old 60% mark holds', () => {
    const g = world(38);
    g.selectActivity('hunt');
    fallAt(g, 'kr_camp', null); // nothing to return to, no proven spot
    expect(g.state.pendingReturn).toBeNull();
    const stats = getDerivedStats(g.state);
    g.state.resources.hp = stats.maxHp * 0.7;
    g.tick();
    expect(g.state.recovering).toBe(false);
  });
});

describe('the defeat window', () => {
  it('opens only when no return or fallback follows', () => {
    const g = world(39);
    const s = g.state;
    s.pendingReturn = null;
    expect(defeatDialogDue(s)).toBe(true);
    s.pendingReturn = { target: { spot: 'kr_field', activity: 'hunt' }, phase: 'return', wins: 0, probes: 0 };
    expect(defeatDialogDue(s)).toBe(false);
    s.pendingReturn = { target: null, phase: 'fallback', fallback: { spot: 'kr_meadow', activity: 'hunt' }, wins: 0, probes: 0 };
    expect(defeatDialogDue(s)).toBe(false);
    s.pendingReturn = { target: { spot: 'kr_field', activity: 'hunt' }, phase: 'hold', until: 10, wins: 0, probes: 0 };
    expect(defeatDialogDue(s)).toBe(true);
  });

  it('each knockout says what follows, in one line', () => {
    const g = world(40);
    fallAt(g, 'kr_field');
    expect(koLines(g)).toEqual(['Returning to Test Field.']);
    fallAt(g, 'kr_den');
    expect(koLines(g).slice(1)).toEqual(['Test Den: forced fight, not re-entered. No safer hunt known.']);
  });
});

describe('a saved return', () => {
  it('survives a save and a load', () => {
    const g = world(41);
    g.state.proven = { spot: 'kr_meadow', activity: 'hunt' };
    for (let i = 0; i < STREAK_LIMIT; i++) fallAt(g, 'kr_field');
    const before = JSON.parse(JSON.stringify(g.state.pendingReturn));
    const back = deserialize(serialize(g.state));
    expect(back.version).toBe(SAVE_VERSION);
    expect(back.pendingReturn).toEqual(before);
    expect(back.proven).toEqual({ spot: 'kr_meadow', activity: 'hunt' });
    expect(back.stats['ko:n:kr_field']).toBe(STREAK_LIMIT);
  });

  it('a v62 save loads with nothing pending and no proven hunt', () => {
    const g = world(42);
    const old = JSON.parse(serialize(g.state));
    delete old.pendingReturn;
    delete old.proven;
    old.version = 62;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.pendingReturn).toBeNull();
    expect(loaded.proven).toBeNull();
    const raw: Record<string, unknown> = { version: 62 };
    MIGRATIONS[62](raw);
    expect(raw).toMatchObject({ version: 63, pendingReturn: null, proven: null });
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(63);
  });

  it('a return in flight carries on after a load', () => {
    const g = world(43);
    fallAt(g, 'kr_field');
    const back = deserialize(serialize(g.state));
    const h = new Game(back);
    h.state.recovering = false;
    for (let i = 0; i < 100 && !(h.state.spot === 'kr_field' && h.state.activity === 'hunt'); i++) h.tick();
    expect(h.state.spot).toBe('kr_field');
    expect(h.state.activity).toBe('hunt');
  });
});

describe('across floors', () => {
  const rideEdges: Edge[] = [
    { from: 'f3_stairhead', to: 'f4_treeline', ticks: 40 },
    { from: 'f4_treeline', to: 'f3_stairhead', ticks: 40 },
  ];

  /** Fell at the Deep Woods with the last haven on floor 3. */
  function fellOnFloor4(seed: number): Game {
    const g = new Game(createInitialState(seed));
    const s = g.state;
    clearFloors(s.stats, ['ascent_f1', 'ascent_f2', 'ascent_f3']);
    s.stats['gold:earned'] = 100_000;
    s.discovered.push('f3_stairhead', 'f4_treeline', 'f4_woods_edge', 'f4_deep_woods');
    s.safeSpots = { nearest: 'f3_stairhead', unconditional: 'f3_stairhead' };
    expect(floorUnlocked(s, FLOORS.ascent_f4)).toBe(true);
    fallAt(g, 'f4_deep_woods');
    expect(s.spot).toBe('f3_stairhead');
    recovered(g);
    return g;
  }

  function walkBack(g: Game): string[] {
    const s = g.state;
    const stops: string[] = [];
    for (let i = 0; i < 1000 && !(s.spot === 'f4_deep_woods' && s.activity === 'hunt'); i++) {
      g.tick();
      if (s.travel && !stops.includes(s.travel.to)) stops.push(s.travel.to);
      s.combat = null;
    }
    return stops;
  }

  it('climbs to the target’s floor, then walks, when no route crosses', () => {
    const g = fellOnFloor4(44);
    expect(pending(g)).toMatchObject({ phase: 'return', target: { spot: 'f4_deep_woods' } });
    const stops = walkBack(g);
    expect(stops[0]).toBe('f4_treeline'); // the ladder
    expect(stops).toContain('f4_deep_woods');
    expect(g.state.spot).toBe('f4_deep_woods');
    expect(g.state.activity).toBe('hunt');
    expect(pending(g).phase).toBe('return');
  });

  it('uses the route when the router crosses floors (ride edges)', () => {
    for (const e of rideEdges) ADJACENCY.get(e.from)!.push(e);
    try {
      const g = fellOnFloor4(45);
      const stops = walkBack(g);
      expect(stops[0]).toBe('f4_treeline'); // the same first stop, by a road this time
      expect(g.state.spot).toBe('f4_deep_woods');
      expect(g.state.activity).toBe('hunt');
      expect(pending(g).phase).toBe('return');
      expect(lines(g).some((m) => /Climbing|Descending/.test(m))).toBe(false);
    } finally {
      for (const e of rideEdges) {
        ADJACENCY.set(e.from, ADJACENCY.get(e.from)!.filter((x) => x !== e));
      }
    }
  });
});

/** Floors 1 to 4 cleared and floor 5's gate met, the Greenwood and the Mire on the map. */
function greenwood(seed: number): Game {
  const g = new Game(createInitialState(seed));
  const s = g.state;
  clearFloors(s.stats, ['ascent_f1', 'ascent_f2', 'ascent_f3', 'ascent_f4']);
  s.stats['gold:earned'] = 100_000;
  s.stats['kills:tag:goblin'] = 100;
  for (const spot of Object.values(SPOTS)) {
    if (/^ascent_f[45]_area$/.test(spot.areaId)) s.discovered.push(spot.id);
  }
  s.safeSpots = { nearest: 'f4_treeline', unconditional: 'f4_treeline' };
  return g;
}

describe('a retry that sets out rolls no fight on the road', () => {
  /**
   * Hunting the fallback at the Woods Edge, the 2 h cap one tick away, the
   * respawn timer one tick from rolling an encounter: the tick the mover sets
   * out is also the tick a stale hunt would roll one.
   */
  function atCap(seed: number, target: ReturnSpot): Game {
    const g = greenwood(seed);
    const s = g.state;
    s.spot = 'f4_woods_edge';
    g.selectActivity('hunt');
    s.pendingReturn = {
      target,
      phase: 'fallback',
      fallback: { spot: 'f4_woods_edge', activity: 'hunt' },
      wins: 0,
      until: s.totalTicks + 1,
      probes: 0,
    };
    s.respawnTimer = 1;
    return g;
  }

  /** Tick to the target's hunt, failing if a fight is ever open on the road. */
  function walkThere(g: Game, spot: string): boolean {
    const s = g.state;
    let fightOnRoad = false;
    for (let i = 0; i < 800 && !(s.spot === spot && s.activity === 'hunt' && !s.travel); i++) {
      g.tick();
      if (s.travel && s.combat) fightOnRoad = true;
    }
    return fightOnRoad;
  }

  it('on the same floor', () => {
    const g = atCap(51, { spot: 'f4_deep_woods', activity: 'hunt' });
    g.tick();
    expect(pending(g).phase).toBe('return');
    g.tick();
    expect(g.state.travel).not.toBeNull();
    expect(g.state.combat).toBeNull();
    expect(walkThere(g, 'f4_deep_woods')).toBe(false);
    expect(g.state.spot).toBe('f4_deep_woods');
    expect(g.state.activity).toBe('hunt');
    expect(g.state.combat).toBeNull();
  });

  it('by the ladder, when the target is on another floor', () => {
    const g = atCap(52, { spot: 'f5_bog', activity: 'hunt' });
    g.tick();
    g.tick();
    expect(g.state.travel?.to).toBe('f5_causeway'); // the climb, not a road
    expect(g.state.combat).toBeNull();
    expect(walkThere(g, 'f5_bog')).toBe(false);
    expect(g.state.spot).toBe('f5_bog');
    expect(g.state.activity).toBe('hunt');
  });

  it('a hunt asked to roll an encounter on the road refuses', () => {
    const g = world(53, 'kr_field');
    const s = g.state;
    s.respawnTimer = 0;
    s.travel = { from: 'kr_field', to: 'kr_gate', ticksLeft: 5, total: 5 };
    tickCombat(s, g.bus, SPOTS.kr_field);
    expect(s.combat).toBeNull();
    s.travel = null;
    tickCombat(s, g.bus, SPOTS.kr_field);
    expect(s.combat).not.toBeNull(); // the same call rolls one standing still
  });

  it('a step that sets out gives the activity it leaves no tick of work', () => {
    const g = world(54, 'kr_yard');
    const s = g.state;
    g.selectActivity('drill');
    s.pendingReturn = { target: { spot: 'kr_field', activity: 'hunt' }, phase: 'return', wins: 0, probes: 0 };
    s.activityProgress = 0;
    g.tick();
    expect(s.travel).not.toBeNull();
    expect(s.activityProgress).toBe(0);
  });
});

describe('a probe whose route is shut', () => {
  it('holds again with the doubled wait, and walks back once the road is open', () => {
    const g = world(55);
    const s = g.state;
    for (let i = 0; i < STREAK_LIMIT; i++) fallAt(g, 'kr_field');
    expect(pending(g)).toMatchObject({ phase: 'hold', probes: 0 });
    recovered(g);
    const roads = ADJACENCY.get('kr_camp')!;
    ADJACENCY.set('kr_camp', []); // nothing leaves the haven
    try {
      s.totalTicks = pending(g).until! - 1;
      g.tick(); // the wait is over: a probe
      expect(pending(g).phase).toBe('return');
      g.tick(); // no route
      expect(pending(g)).toMatchObject({ phase: 'hold', probes: 1, target: { spot: 'kr_field' } });
      expect(pending(g).until).toBe(s.totalTicks + holdTicks(1));
      expect(lines(g)).toContain('Test Field: no known route back. No safer hunt known. Retrying in 20 min.');
      expect(s.activity).toBeNull();
    } finally {
      ADJACENCY.set('kr_camp', roads);
    }
    // Open again: the next probe walks back and resumes.
    s.totalTicks = pending(g).until! - 1;
    g.tick();
    for (let i = 0; i < 100 && !(s.spot === 'kr_field' && s.activity === 'hunt'); i++) g.tick();
    expect(s.spot).toBe('kr_field');
    expect(s.activity).toBe('hunt');
    expect(pending(g).phase).toBe('return');
  });

  it('a hold that keeps failing never waits longer than 80 minutes', () => {
    const g = world(56);
    const s = g.state;
    for (let i = 0; i < STREAK_LIMIT; i++) fallAt(g, 'kr_field');
    recovered(g);
    const roads = ADJACENCY.get('kr_camp')!;
    ADJACENCY.set('kr_camp', []);
    try {
      const waits: number[] = [];
      for (let i = 0; i < 6; i++) {
        waits.push((pending(g).until! - s.totalTicks) / (60 * TPS));
        s.totalTicks = pending(g).until! - 1;
        g.tick();
        g.tick();
        expect(pending(g).phase).toBe('hold');
      }
      expect(waits).toEqual([10, 20, 40, 80, 80, 80]);
    } finally {
      ADJACENCY.set('kr_camp', roads);
    }
  });

  /** The road into the field shut: the field is unreachable, the meadow is not. */
  function shutField(): () => void {
    const roads = ADJACENCY.get('kr_gate')!;
    ADJACENCY.set('kr_gate', roads.filter((e) => e.to !== 'kr_field'));
    return () => ADJACENCY.set('kr_gate', roads);
  }

  /** A hold on the field, then its probe at a shut road, with the meadow proven. */
  function probeAtShutRoad(seed: number): { g: Game; open: () => void } {
    const g = world(seed);
    const s = g.state;
    for (let i = 0; i < STREAK_LIMIT; i++) fallAt(g, 'kr_field');
    expect(pending(g).phase).toBe('hold');
    s.proven = { spot: 'kr_meadow', activity: 'hunt' };
    recovered(g);
    const open = shutField();
    s.totalTicks = pending(g).until! - 1;
    g.tick(); // the wait is over: a probe
    expect(pending(g).phase).toBe('return');
    g.tick(); // no road to the field
    return { g, open };
  }

  it('with a proven hunt it hunts there, keeps the target, and retries it after 200 wins', () => {
    const { g, open } = probeAtShutRoad(60);
    const s = g.state;
    try {
      expect(pending(g)).toMatchObject({
        phase: 'fallback',
        target: { spot: 'kr_field', activity: 'hunt' },
        fallback: { spot: 'kr_meadow', activity: 'hunt' },
        wins: 0,
        probes: 1,
      });
      expect(pending(g).until).toBe(s.totalTicks + FALLBACK_TICKS);
      expect(lines(g)).toContain('Test Field: no known route back. Hunting Test Meadow for 200 wins or 2 h, then retrying.');
    } finally {
      // The road opens again while the character hunts the meadow.
      open();
    }
    for (let i = 0; i < 100 && !(s.spot === 'kr_meadow' && s.activity === 'hunt'); i++) g.tick();
    expect(s.spot).toBe('kr_meadow');
    pending(g).wins = FALLBACK_WINS - 1;
    win(g, 'kr_meadow');
    expect(pending(g)).toMatchObject({ phase: 'return', target: { spot: 'kr_field' }, probes: 1 });
    for (let i = 0; i < 100 && !(s.spot === 'kr_field' && s.activity === 'hunt'); i++) g.tick();
    expect(s.spot).toBe('kr_field');
    expect(s.activity).toBe('hunt');
    expect(pending(g).phase).toBe('return');
  });

  it('still shut at the retry: it falls back again, and the target is still kept', () => {
    const { g, open } = probeAtShutRoad(61);
    const s = g.state;
    try {
      for (let i = 0; i < 100 && !(s.spot === 'kr_meadow' && s.activity === 'hunt'); i++) g.tick();
      pending(g).wins = FALLBACK_WINS - 1;
      win(g, 'kr_meadow');
      expect(pending(g).phase).toBe('return');
      g.tick(); // the road is still shut
      expect(pending(g)).toMatchObject({
        phase: 'fallback',
        target: { spot: 'kr_field' },
        fallback: { spot: 'kr_meadow' },
        wins: 0,
        probes: 2,
      });
    } finally {
      open();
    }
  });

  it('only a spot the return never walks into loses its target', () => {
    const g = world(62);
    const s = g.state;
    for (let i = 0; i < STREAK_LIMIT; i++) fallAt(g, 'kr_field');
    s.proven = { spot: 'kr_meadow', activity: 'hunt' };
    recovered(g);
    SPOTS.kr_field.forced = true; // the field turned into an ambush since the hold began
    try {
      s.totalTicks = pending(g).until! - 1;
      g.tick();
      g.tick();
      expect(pending(g)).toMatchObject({ phase: 'fallback', target: null, fallback: { spot: 'kr_meadow' } });
      expect(lines(g)).toContain('Test Field: forced fight, not re-entered. Hunting Test Meadow for 200 wins.');
      // And with no proven hunt there is nothing to fall back to: the return ends.
      s.proven = null;
      s.pendingReturn = { target: { spot: 'kr_field', activity: 'hunt' }, phase: 'return', wins: 0, probes: 0 };
      s.spot = 'kr_camp';
      s.activity = null;
      g.tick();
      expect(s.pendingReturn).toBeNull();
      expect(lines(g)).toContain('Test Field: forced fight, not re-entered. No safer hunt known.');
    } finally {
      delete SPOTS.kr_field.forced;
    }
  });
});

describe('a knockout at the fallback right after the retry', () => {
  it('keeps the target and the probe count', () => {
    const g = world(57, 'kr_meadow');
    const meadow = { spot: 'kr_meadow', activity: 'hunt' };
    g.state.pendingReturn = {
      target: { spot: 'kr_field', activity: 'hunt' },
      phase: 'fallback',
      fallback: meadow,
      wins: FALLBACK_WINS - 1,
      until: g.state.totalTicks + FALLBACK_TICKS,
      probes: 2,
    };
    win(g, 'kr_meadow'); // the 200th win: the retry begins, the character still at the meadow
    expect(pending(g)).toMatchObject({ phase: 'return', target: { spot: 'kr_field' }, fallback: meadow, probes: 2 });

    fallAt(g, 'kr_meadow');
    expect(pending(g)).toMatchObject({ phase: 'return', target: { spot: 'kr_field' }, probes: 2 });
    expect(lines(g)).toContain('Returning to Test Field.');

    // Five in a row at the fallback: a hold on the target, the wait from the kept count.
    for (let i = 1; i < STREAK_LIMIT; i++) fallAt(g, 'kr_meadow');
    expect(pending(g)).toMatchObject({ phase: 'hold', target: { spot: 'kr_field' }, probes: 2 });
    expect(pending(g).until).toBe(g.state.totalTicks + holdTicks(2));
    expect(lines(g)).toContain('5 knockouts in a row at Test Meadow. Retrying Test Field in 40 min.');
  });

  it('on the Greenwood: the target stays the Deep Woods', () => {
    const g = greenwood(58);
    const s = g.state;
    s.spot = 'f4_woods_edge';
    s.pendingReturn = {
      target: { spot: 'f4_deep_woods', activity: 'hunt' },
      phase: 'return',
      fallback: { spot: 'f4_woods_edge', activity: 'hunt' },
      wins: 0,
      probes: 2,
    };
    fallAt(g, 'f4_woods_edge');
    expect(pending(g)).toMatchObject({ phase: 'return', target: { spot: 'f4_deep_woods' }, probes: 2 });
  });

  it('a knockout at the target after the retry is still a knockout at the target', () => {
    const g = world(59, 'kr_field');
    g.state.pendingReturn = {
      target: { spot: 'kr_field', activity: 'hunt' },
      phase: 'return',
      fallback: { spot: 'kr_meadow', activity: 'hunt' },
      wins: 0,
      probes: 1,
    };
    for (let i = 0; i < STREAK_LIMIT; i++) fallAt(g, 'kr_field');
    expect(pending(g)).toMatchObject({ phase: 'hold', target: { spot: 'kr_field' } });
    expect(pending(g).fallback).toBeUndefined();
  });
});

describe('a spot with a fight budget as the fallback', () => {
  /** Five losses at the field: the fallback is needed. */
  const streak = (g: Game): void => {
    for (let i = 0; i < STREAK_LIMIT; i++) fallAt(g, 'kr_field');
  };

  it('is chosen when no proven hunt exists, if it was won at and has fights left', () => {
    const g = world(70);
    win(g, 'kr_ring');
    expect(g.state.proven).toBeNull(); // a budget runs out before 10 wins in a row
    streak(g);
    expect(pending(g)).toMatchObject({
      phase: 'fallback',
      target: { spot: 'kr_field' },
      fallback: { spot: 'kr_ring', activity: 'hunt' },
    });
    expect(lines(g)).toContain('5 knockouts in a row at Test Field. Hunting Test Ring for 200 wins.');
  });

  it('is chosen after a forced-spot loss too, with no target', () => {
    const g = world(71, 'kr_den');
    win(g, 'kr_ring');
    fallAt(g, 'kr_den', null, true);
    expect(pending(g)).toMatchObject({ phase: 'fallback', target: null, fallback: { spot: 'kr_ring' } });
    expect(lines(g)).toContain('Test Den: forced fight, not re-entered. Hunting Test Ring for 200 wins.');
  });

  it('loses to a usable proven hunt, which never runs out, even when it was won at less recently', () => {
    const g = world(72);
    g.state.proven = { spot: 'kr_meadow', activity: 'hunt' };
    win(g, 'kr_ring'); // the more recent win
    streak(g);
    expect(pending(g)).toMatchObject({ phase: 'fallback', fallback: { spot: 'kr_meadow' } });
  });

  it('takes the most recent win among the limited spots', () => {
    const g = world(73);
    win(g, 'kr_ring');
    g.state.totalTicks += 100;
    win(g, 'kr_lane');
    streak(g);
    expect(pending(g).fallback).toMatchObject({ spot: 'kr_lane' });

    const h = world(74);
    win(h, 'kr_lane');
    h.state.totalTicks += 100;
    win(h, 'kr_ring');
    streak(h);
    expect(pending(h).fallback).toMatchObject({ spot: 'kr_ring' });
  });

  it('is not used if a knockout there came after its last win; a later win makes it usable again', () => {
    const g = world(75);
    win(g, 'kr_ring');
    fallAt(g, 'kr_ring');
    expect(g.state.stats['win:n:kr_ring']).toBeUndefined();
    streak(g);
    expect(pending(g).phase).toBe('hold');

    const h = world(76);
    win(h, 'kr_ring');
    fallAt(h, 'kr_ring');
    win(h, 'kr_ring');
    streak(h);
    expect(pending(h)).toMatchObject({ phase: 'fallback', fallback: { spot: 'kr_ring' } });
  });

  it('is not used if it was never fought', () => {
    const g = world(77);
    streak(g);
    expect(pending(g).phase).toBe('hold');
  });

  it('is not used once cleared, and never when forced, a festival floor or the wall', () => {
    const g = world(78);
    win(g, 'kr_ring');
    g.state.stats['fights:kr_ring'] = 1; // the one fight is spent
    streak(g);
    expect(pending(g).phase).toBe('hold');

    // The wall is a limited hunt spot (8 fights) that ends the run: no win there is recorded.
    const h = world(79);
    win(h, 'f11_wall');
    win(h, 'kr_den'); // forced
    expect(h.state.stats['win:n:f11_wall']).toBeUndefined();
    expect(h.state.stats['win:n:kr_den']).toBeUndefined();
    streak(h);
    expect(pending(h).phase).toBe('hold');
  });

  it('counts its fights toward the retry like any fallback', () => {
    const g = world(80);
    win(g, 'kr_lane');
    streak(g);
    win(g, 'kr_lane');
    win(g, 'kr_lane');
    expect(pending(g)).toMatchObject({ phase: 'fallback', wins: 2 });
  });

  describe('when it is spent', () => {
    /** Hunting the lane as the fallback, a win at the ring behind it, 7 wins in. */
    function huntingLane(seed: number, target: boolean): Game {
      const g = world(seed, target ? 'kr_field' : 'kr_den');
      const s = g.state;
      win(g, 'kr_ring');
      g.state.totalTicks += 100;
      win(g, 'kr_lane');
      if (target) streak(g);
      else fallAt(g, 'kr_den', null, true);
      expect(pending(g).fallback).toMatchObject({ spot: 'kr_lane' });
      recovered(g);
      for (let i = 0; i < 100 && !(s.spot === 'kr_lane' && s.activity === 'hunt'); i++) g.tick();
      expect(s.activity).toBe('hunt');
      pending(g).wins = 7;
      return g;
    }

    it('picks again, with the wins and the clock carried over', () => {
      const g = huntingLane(81, true);
      const until = pending(g).until;
      g.state.stats['fights:kr_lane'] = 3; // the budget is spent
      g.tick();
      expect(pending(g)).toMatchObject({
        phase: 'fallback',
        target: { spot: 'kr_field' },
        fallback: { spot: 'kr_ring' },
        wins: 7,
        until,
      });
      expect(lines(g)).toContain('Test Lane: no fights left. Hunting Test Ring.');
      // And it walks there.
      for (let i = 0; i < 100 && !(g.state.spot === 'kr_ring' && g.state.activity === 'hunt'); i++) g.tick();
      expect(g.state.spot).toBe('kr_ring');
    });

    it('with none left and a target, holds on it and idles', () => {
      const g = huntingLane(82, true);
      g.state.stats['fights:kr_lane'] = 3;
      g.state.stats['fights:kr_ring'] = 1;
      g.tick();
      expect(pending(g)).toMatchObject({ phase: 'hold', target: { spot: 'kr_field' }, probes: 0 });
      expect(pending(g).until).toBe(g.state.totalTicks + holdTicks(0));
      expect(g.state.activity).toBeNull();
      expect(lines(g)).toContain('Test Lane: no fights left. No safer hunt known. Retrying Test Field in 10 min.');
    });

    it('with none left and no target (a forced-spot loss), the return ends and the character idles', () => {
      const g = huntingLane(83, false);
      g.state.stats['fights:kr_lane'] = 3;
      g.state.stats['fights:kr_ring'] = 1;
      g.tick();
      expect(g.state.pendingReturn).toBeNull();
      expect(g.state.activity).toBeNull();
      expect(lines(g)).toContain('Test Lane: no fights left. No safer hunt known.');
    });
  });

  it('after a band-1 boss loss, falls back to the Vermin Hall it has won at', () => {
    // Real content: the toll collector's office is a forced spot, lost with no activity selected.
    const g = new Game(createInitialState(84));
    const s = g.state;
    s.discovered.push('f1_landing', 'f1_storerooms', 'f1_toll_hall');
    s.safeSpots = { nearest: 'f1_landing', unconditional: 'f1_landing' };
    win(g, 'f1_storerooms');
    fallAt(g, 'f1_toll_hall', null, true);
    expect(pending(g)).toMatchObject({
      phase: 'fallback',
      target: null,
      fallback: { spot: 'f1_storerooms', activity: 'hunt' },
    });
    expect(lines(g)).toContain(
      'Toll Collector’s Office: forced fight, not re-entered. Hunting The Vermin Hall for 200 wins.',
    );
    // With the Vermin Hall cleared, nothing is left and the character idles as before.
    const h = new Game(createInitialState(85));
    h.state.discovered.push('f1_landing', 'f1_storerooms', 'f1_toll_hall');
    h.state.safeSpots = { nearest: 'f1_landing', unconditional: 'f1_landing' };
    win(h, 'f1_storerooms');
    h.state.stats['fights:f1_storerooms'] = 6;
    fallAt(h, 'f1_toll_hall', null, true);
    expect(h.state.pendingReturn).toBeNull();
  });
});

describe('a limited fallback is picked again from the fall floor', () => {
  // A hunt spot on floor 3, next to its landing, to fall at with a target.
  const F3: SpotDef = pocket('kr_f3', 'Test Landing Three', {
    areaId: 'ascent_f3_area',
    activities: [hunt],
    encounters: rats,
    connections: [{ to: 'f3_stairhead', ticks: 5 }],
  });
  beforeAll(() => {
    SPOTS.kr_f3 = F3;
    ADJACENCY.get('f3_stairhead')!.push({ from: 'f3_stairhead', to: 'kr_f3', ticks: 5 });
    ADJACENCY.set('kr_f3', [{ from: 'kr_f3', to: 'f3_stairhead', ticks: 5 }]);
  });
  afterAll(() => {
    delete SPOTS.kr_f3;
    ADJACENCY.delete('kr_f3');
    ADJACENCY.set('f3_stairhead', ADJACENCY.get('f3_stairhead')!.filter((e) => e.to !== 'kr_f3'));
  });

  /**
   * On floor 3 with the haven at its landing. Two limited spots won at: the
   * Mail Carts on floor 2 (the older win) and the Vermin Hall on floor 1 (the
   * newer one).
   */
  function floorThree(seed: number): Game {
    const g = new Game(createInitialState(seed));
    const s = g.state;
    clearFloors(s.stats, ['ascent_f1']);
    s.stats['gold:earned'] = 1000;
    s.discovered.push('f1_landing', 'f1_storerooms', 'f2_stairhead', 'f2_hall_1', 'f3_stairhead', 'f3_hearing_room', 'kr_f3');
    s.safeSpots = { nearest: 'f3_stairhead', unconditional: 'f3_stairhead' };
    expect(floorUnlocked(s, FLOORS.ascent_f2)).toBe(true);
    win(g, 'f2_hall_1');
    s.totalTicks += 100;
    win(g, 'f1_storerooms');
    return g;
  }
  const withTarget = (g: Game): void => {
    for (let i = 0; i < STREAK_LIMIT; i++) fallAt(g, 'kr_f3');
  };
  const spend = (g: Game, spot: string): void => {
    g.state.stats[`fights:${spot}`] = SPOTS[spot].fightLimit!;
    recovered(g);
    g.tick();
  };

  it('the floor-1 spot is picked first, and records where the fall was', () => {
    const g = floorThree(90);
    withTarget(g);
    expect(pending(g)).toMatchObject({
      phase: 'fallback',
      target: { spot: 'kr_f3' },
      fallback: { spot: 'f1_storerooms' },
      from: 'kr_f3',
    });
    const h = floorThree(91);
    fallAt(h, 'f3_hearing_room', null, true);
    expect(pending(h)).toMatchObject({ target: null, fallback: { spot: 'f1_storerooms' }, from: 'f3_hearing_room' });
  });

  it('when it is spent, the older floor-2 spot is still under the ceiling (a target)', () => {
    const g = floorThree(92);
    withTarget(g);
    pending(g).wins = 4;
    const until = pending(g).until;
    spend(g, 'f1_storerooms');
    expect(pending(g)).toMatchObject({
      phase: 'fallback',
      target: { spot: 'kr_f3' },
      fallback: { spot: 'f2_hall_1' },
      wins: 4,
      until,
      from: 'kr_f3',
    });
    spend(g, 'f2_hall_1');
    expect(pending(g)).toMatchObject({ phase: 'hold', target: { spot: 'kr_f3' } });
  });

  it('when it is spent, the older floor-2 spot is still under the ceiling (no target)', () => {
    const g = floorThree(93);
    fallAt(g, 'f3_hearing_room', null, true);
    spend(g, 'f1_storerooms');
    expect(pending(g)).toMatchObject({ phase: 'fallback', target: null, fallback: { spot: 'f2_hall_1' }, from: 'f3_hearing_room' });
    spend(g, 'f2_hall_1');
    expect(g.state.pendingReturn).toBeNull();
    expect(g.state.activity).toBeNull();
  });

  it('a knockout at the floor-1 fallback picks the floor-2 spot, not a hold', () => {
    const g = floorThree(94);
    withTarget(g);
    fallAt(g, 'f1_storerooms');
    expect(pending(g)).toMatchObject({ phase: 'fallback', target: { spot: 'kr_f3' }, fallback: { spot: 'f2_hall_1' } });
  });

  it('a fallback without the field (a v63 save) uses the target’s floor', () => {
    const g = floorThree(95);
    withTarget(g);
    const old = JSON.parse(serialize(g.state));
    expect(old.pendingReturn.from).toBe('kr_f3');
    delete old.pendingReturn.from;
    old.version = 63;
    const back = deserialize(JSON.stringify(old));
    expect(back.version).toBe(SAVE_VERSION);
    expect(back.pendingReturn?.from).toBeUndefined();
    expect(back.pendingReturn).toMatchObject({ phase: 'fallback', fallback: { spot: 'f1_storerooms' } });
    const h = new Game(back);
    spend(h, 'f1_storerooms');
    expect(h.state.pendingReturn).toMatchObject({ phase: 'fallback', fallback: { spot: 'f2_hall_1' } });
  });

  it('survives a save with the field set; the migration only moves the version', () => {
    const g = floorThree(96);
    withTarget(g);
    const back = deserialize(serialize(g.state));
    expect(back.pendingReturn).toEqual(JSON.parse(JSON.stringify(g.state.pendingReturn)));
    expect(back.pendingReturn?.from).toBe('kr_f3');
    const raw: Record<string, unknown> = { version: 63 };
    MIGRATIONS[63](raw);
    expect(raw).toEqual({ version: 64 });
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(64);
  });
});

describe('a knockout at a limited fallback', () => {
  /** Wins at the ring (older) and the lane (newer), then five losses at the field: the lane is the fallback. */
  function laneFallback(seed: number): Game {
    const g = world(seed);
    win(g, 'kr_ring');
    g.state.totalTicks += 100;
    win(g, 'kr_lane');
    for (let i = 0; i < STREAK_LIMIT; i++) fallAt(g, 'kr_field');
    expect(pending(g)).toMatchObject({ phase: 'fallback', fallback: { spot: 'kr_lane' } });
    return g;
  }

  it('ends it at once: another limited spot is picked, the wins and the clock carried', () => {
    const g = laneFallback(100);
    pending(g).wins = 4;
    const until = pending(g).until;
    fallAt(g, 'kr_lane');
    expect(g.state.stats['win:n:kr_lane']).toBeUndefined();
    expect(pending(g)).toMatchObject({
      phase: 'fallback',
      target: { spot: 'kr_field' },
      fallback: { spot: 'kr_ring' },
      wins: 4,
      until,
      from: 'kr_field',
    });
    expect(lines(g)).toContain('Test Lane: knocked out there. Hunting Test Ring.');
  });

  it('with none left, holds on the target at the haven', () => {
    const g = laneFallback(101);
    fallAt(g, 'kr_lane');
    fallAt(g, 'kr_ring');
    expect(pending(g)).toMatchObject({ phase: 'hold', target: { spot: 'kr_field' }, probes: 0 });
    expect(pending(g).until).toBe(g.state.totalTicks + holdTicks(0));
    expect(g.state.spot).toBe('kr_camp');
    expect(lines(g)).toContain('Test Ring: knocked out there. No safer hunt known. Retrying Test Field in 10 min.');
  });

  it('with none left and no target, ends the return and idles', () => {
    const g = world(102, 'kr_den');
    win(g, 'kr_ring');
    g.state.totalTicks += 100;
    win(g, 'kr_lane');
    fallAt(g, 'kr_den', null, true);
    expect(pending(g)).toMatchObject({ target: null, fallback: { spot: 'kr_lane' } });
    fallAt(g, 'kr_lane');
    expect(pending(g)).toMatchObject({ target: null, fallback: { spot: 'kr_ring' } });
    fallAt(g, 'kr_ring');
    expect(g.state.pendingReturn).toBeNull();
    expect(g.state.activity).toBeNull();
    expect(lines(g)).toContain('Test Ring: knocked out there. No safer hunt known.');
    expect(defeatDialogDue(g.state)).toBe(true);
  });

  it('a proven fallback is still returned to, and holds only after 5 in a row', () => {
    const g = world(103);
    g.state.proven = { spot: 'kr_meadow', activity: 'hunt' };
    win(g, 'kr_lane');
    for (let i = 0; i < STREAK_LIMIT; i++) fallAt(g, 'kr_field');
    expect(pending(g).fallback).toMatchObject({ spot: 'kr_meadow' });
    fallAt(g, 'kr_meadow');
    expect(pending(g)).toMatchObject({ phase: 'fallback', fallback: { spot: 'kr_meadow' }, target: { spot: 'kr_field' } });
    expect(lines(g)).toContain('Returning to Test Meadow.');
    for (let i = 1; i < STREAK_LIMIT; i++) fallAt(g, 'kr_meadow');
    expect(pending(g)).toMatchObject({ phase: 'hold', target: { spot: 'kr_field' } });
  });
});

describe('a roofed hunt as the last fallback', () => {
  /** Floor 17's spots as found in a walk up from the landing. */
  const FOUND = [
    'f17_landing',
    'f17_cave_hub',
    'f17_cave_crack',
    'f17_nest',
    'f17_central_caves',
    'f17_east_mouth',
    'f17_east_ascent',
    'f17_east_peak',
    'f17_east_ridge',
  ];

  /** At the open east ridge with `found` on the map and the landing as the haven. */
  function ridge(seed: number, found: string[] = FOUND): Game {
    const g = new Game(createInitialState(seed));
    const s = g.state;
    s.spot = 'f17_east_ridge';
    s.discovered.push(...found);
    s.safeSpots = { nearest: 'f17_landing', unconditional: 'f17_landing' };
    return g;
  }

  const streak = (g: Game, spot = 'f17_east_ridge'): void => {
    for (let i = 0; i < STREAK_LIMIT; i++) fallAt(g, spot);
  };

  it('five knockouts at the open ridge with nothing proven go to the lowest-level roofed hunt', () => {
    const g = ridge(110);
    expect(g.state.proven).toBeNull();
    streak(g);
    expect(pending(g)).toMatchObject({
      phase: 'fallback',
      target: { spot: 'f17_east_ridge', activity: 'hunt' },
      fallback: { spot: 'f17_landing', activity: 'hunt' },
      from: 'f17_east_ridge',
    });
    expect(lines(g)).toContain(
      `5 knockouts in a row at ${SPOTS.f17_east_ridge.name}. Hunting ${SPOTS.f17_landing.name} for 200 wins.`,
    );
    // The character is not left idle: recovered, it hunts the roofed spot.
    const s = g.state;
    recovered(g);
    for (let i = 0; i < 50 && !(s.spot === 'f17_landing' && s.activity === 'hunt'); i++) g.tick();
    expect(s.spot).toBe('f17_landing');
    expect(s.activity).toBe('hunt');
  });

  it('a forced-spot loss with no target takes it too', () => {
    const g = ridge(111);
    fallAt(g, 'f17_east_ridge', null, true);
    expect(pending(g)).toMatchObject({ phase: 'fallback', target: null, fallback: { spot: 'f17_landing' } });
  });

  it('takes the lowest level, then the earlier-found spot', () => {
    // The east mouth (41 to 42) is found first; the hub and the landing (40 to 41) follow.
    const g = ridge(112, ['f17_east_mouth', 'f17_cave_hub', 'f17_landing', 'f17_east_ridge']);
    streak(g);
    expect(pending(g).fallback).toMatchObject({ spot: 'f17_cave_hub' });
  });

  it('skips a spot with a fight budget, an unfound spot and a spot on another floor', () => {
    // Floor 5's roofed hunts are reachable by the ladder with floors 1 to 4 cleared (the Greenwood's
    // setup above), so only the same-floor rule keeps them out.
    const lower = Object.values(SPOTS).find(
      (sp) =>
        sp.areaId === 'ascent_f5_area' &&
        !!sp.tags?.includes('indoor') &&
        !sp.fightLimit &&
        sp.activities.some((a) => a.kind === 'hunt'),
    );
    expect(lower).toBeDefined();
    expect(SPOTS.f17_nest.fightLimit).toBeGreaterThan(0);
    // Found: floor 5 and the nest (a fight budget of 1) and the ridge, with the cave crack (no
    // hunt) as the haven. The landing, hub and caves are not found. The ridge has no route back
    // from the crack, so the fall is a blocked one, which idles with no pick.
    const g = ridge(113, ['f17_cave_crack', 'f17_nest', 'f17_east_ridge']);
    const s = g.state;
    clearFloors(s.stats, ['ascent_f1', 'ascent_f2', 'ascent_f3', 'ascent_f4']);
    s.stats['gold:earned'] = 100_000;
    s.stats['kills:tag:goblin'] = 100;
    for (const sp of Object.values(SPOTS)) if (sp.areaId === 'ascent_f5_area') s.discovered.push(sp.id);
    expect(floorUnlocked(s, FLOORS.ascent_f5)).toBe(true);
    const lowerHunt = lower!.activities.find((a) => a.kind === 'hunt')!;
    expect(returnBlock(s, { spot: lower!.id, activity: lowerHunt.id })).toBeNull();
    s.safeSpots = { nearest: 'f17_cave_crack', unconditional: 'f17_cave_crack' };
    streak(g);
    expect(g.state.spot).toBe('f17_cave_crack');
    expect(g.state.pendingReturn).toBeNull();
    expect(lines(g)).toContain(`${SPOTS.f17_east_ridge.name}: no known route back. No safer hunt known.`);
  });

  it('never picks the spot that was lost at', () => {
    const g = ridge(114, ['f17_landing', 'f17_east_ridge']);
    streak(g, 'f17_landing');
    // The landing is the only roofed hunt found, and it is the fall.
    expect(pending(g).phase).toBe('hold');
  });

  it('ranks behind a usable proven hunt', () => {
    const g = ridge(115);
    g.state.proven = { spot: 'f17_central_caves', activity: 'hunt' };
    streak(g);
    expect(pending(g).fallback).toMatchObject({ spot: 'f17_central_caves' });
  });

  it('ranks behind a limited hunt that was won at', () => {
    const g = ridge(116);
    win(g, 'f17_nest');
    expect(g.state.stats['win:n:f17_nest']).toBe(1);
    g.state.spot = 'f17_east_ridge';
    streak(g);
    expect(pending(g).fallback).toMatchObject({ spot: 'f17_nest' });
  });

  it('a knockout at the roofed fallback returns to it; five in a row hold on the target', () => {
    const g = ridge(117);
    streak(g);
    expect(pending(g).fallback).toMatchObject({ spot: 'f17_landing' });
    fallAt(g, 'f17_landing');
    expect(pending(g)).toMatchObject({
      phase: 'fallback',
      fallback: { spot: 'f17_landing' },
      target: { spot: 'f17_east_ridge' },
    });
    expect(lines(g)).toContain(`Returning to ${SPOTS.f17_landing.name}.`);
    for (let i = 1; i < STREAK_LIMIT; i++) fallAt(g, 'f17_landing');
    expect(pending(g)).toMatchObject({ phase: 'hold', target: { spot: 'f17_east_ridge' } });
  });

  it('a floor with no roofed hunt still holds', () => {
    const g = world(118);
    streak(g, 'kr_field');
    expect(pending(g).phase).toBe('hold');
  });

  it('a roofed fallback lost again and again doubles the hold: 10, 20, 40, 80 minutes', () => {
    const g = ridge(130);
    const s = g.state;
    const waits: number[] = [];
    streak(g);
    for (let round = 0; round < 4; round++) {
      expect(pending(g)).toMatchObject({ phase: 'fallback', fallback: { spot: 'f17_landing' } });
      // Five in a row at the roofed spot the first time; the streak stays reached after that.
      for (let i = 0; i < (round === 0 ? STREAK_LIMIT : 1); i++) fallAt(g, 'f17_landing');
      expect(pending(g)).toMatchObject({ phase: 'hold', target: { spot: 'f17_east_ridge' }, probes: round });
      waits.push((pending(g).until! - s.totalTicks) / (60 * TPS));
      // The wait is over, the probe is at the ridge, and the ridge loses again.
      recovered(g);
      s.totalTicks = pending(g).until! - 1;
      g.tick();
      expect(pending(g).phase).toBe('return');
      fallAt(g, 'f17_east_ridge');
    }
    expect(waits).toEqual([10, 20, 40, 80]);
  });

  it('a spot whose top level is above the fall spot is not a fallback', () => {
    const top = (id: string): number => Math.max(...SPOTS[id].encounters!.map((e) => e.level[1]));
    // The picks above are legal: the landing is no harder than the ridge.
    expect(top('f17_landing')).toBeLessThanOrEqual(top('f17_east_ridge'));
    // Lower the ridge under every roofed hunt on the floor: none is the answer to a loss there.
    const rows = SPOTS.f17_east_ridge.encounters!;
    const saved = rows.map((e) => e.level);
    for (const e of rows) e.level = [1, 1];
    try {
      const g = ridge(131);
      streak(g);
      expect(pending(g)).toMatchObject({ phase: 'hold', target: { spot: 'f17_east_ridge' } });
      expect(pending(g).fallback).toBeUndefined();
    } finally {
      rows.forEach((e, i) => (e.level = saved[i]));
    }
  });
});

describe('a roofed fallback is never harder than the spot that was lost at', () => {
  const ROW = 'f10_artificers_row';
  const MINE = 'f10_quarry';

  /** At the Artificers' Row (floor 10's landing, so the haven), the Mine found. */
  function row(seed: number): Game {
    const g = new Game(createInitialState(seed));
    const s = g.state;
    s.spot = ROW;
    s.discovered.push(ROW, MINE);
    s.safeSpots = { nearest: ROW, unconditional: ROW };
    return g;
  }

  it('the Mine is a roofed hunt one level above the Row', () => {
    expect(SPOTS[MINE].tags).toContain('indoor');
    const top = (id: string): number => Math.max(...SPOTS[id].encounters!.map((e) => e.level[1]));
    expect(top(MINE)).toBeGreaterThan(top(ROW));
  });

  it('five knockouts at the Row hold; they do not go to the Mine, and the holds double', () => {
    const g = row(140);
    const s = g.state;
    const waits: number[] = [];
    for (let round = 0; round < 5; round++) {
      for (let i = 0; i < (round === 0 ? STREAK_LIMIT : 1); i++) fallAt(g, ROW);
      expect(pending(g)).toMatchObject({ phase: 'hold', target: { spot: ROW } });
      expect(pending(g).fallback).toBeUndefined();
      waits.push((pending(g).until! - s.totalTicks) / (60 * TPS));
      recovered(g);
      s.totalTicks = pending(g).until! - 1;
      g.tick(); // the wait is over: the probe
      expect(pending(g).phase).toBe('return');
    }
    expect(waits).toEqual([10, 20, 40, 80, 80]);
    expect(lines(g)).not.toContain(`5 knockouts in a row at ${SPOTS[ROW].name}. Hunting ${SPOTS[MINE].name} for 200 wins.`);
  });

});

describe('a hunt behind a forced road with nothing to fall back to', () => {
  interface Water {
    spot: string;
    haven: string;
    /** Stat flags that open the road in and the table at the water. */
    flags: string[];
  }
  const WATERS: Water[] = [
    { spot: 'f12_trade_lane', haven: 'f12_landing', flags: ['flag:quest:f11_join_merchants:accepted'] },
    { spot: 'f12_patrol_lane', haven: 'f12_landing', flags: ['flag:quest:f11_join_navy:accepted'] },
    { spot: 'f13_picket', haven: 'f13_landing', flags: ['flag:quest:f11_join_merchants:accepted'] },
    { spot: 'f14_beast_grounds', haven: 'f14_landing', flags: ['flag:quest:f11_join_navy:accepted'] },
    { spot: 'f20_roadstead', haven: 'f20_quay', flags: [] },
  ];

  /** At the water, its haven and the water found, the side's flags set, nothing else known. */
  function sailor(seed: number, w: Water): Game {
    const g = new Game(createInitialState(seed));
    const s = g.state;
    s.spot = w.spot;
    s.discovered.push(w.haven, w.spot);
    s.safeSpots = { nearest: w.haven, unconditional: w.haven };
    for (const key of w.flags) s.stats[key] = 1;
    return g;
  }

  /** The wait is over: the probe sets out and the boarding fight opens at `spot`. */
  function sailBack(g: Game, spot: string): void {
    const s = g.state;
    recovered(g);
    s.totalTicks = pending(g).until! - 1;
    for (let i = 0; i < 600 && !s.combat; i++) g.tick();
    expect(s.spot).toBe(spot);
    expect(s.combat?.forced).toBe(true);
  }

  it.each(WATERS)('$spot: the fall holds 10 min, sails the road again and hunts', (w) => {
    const g = sailor(200, w);
    const s = g.state;
    // The water is the proven hunt, which is never its own fallback.
    s.proven = { spot: w.spot, activity: 'hunt' };
    fallAt(g, w.spot);
    expect(pending(g)).toMatchObject({ phase: 'hold', target: { spot: w.spot, activity: 'hunt' }, probes: 0 });
    expect(pending(g).until).toBe(s.totalTicks + holdTicks(0));
    expect(lines(g)).toContain(`No safer hunt known. Retrying ${SPOTS[w.spot].name} in 10 min.`);
    expect(s.activity).toBeNull();

    sailBack(g, w.spot);
    s.combat = null; // the boarding is won
    g.bus.emit({ type: 'fight:won', spot: w.spot, forced: true });
    expect(pending(g).phase).toBe('return'); // the boarding is not the hunt
    g.tick();
    expect(s.spot).toBe(w.spot);
    expect(s.activity).toBe('hunt');
    // The first hunt win ends the return.
    win(g, w.spot);
    expect(g.state.pendingReturn).toBeNull();
  });

  it.each(WATERS)('$spot: a boarding fight lost with no activity holds the same way', (w) => {
    const g = sailor(201, w);
    fallAt(g, w.spot, null, true);
    expect(pending(g)).toMatchObject({ phase: 'hold', target: { spot: w.spot, activity: 'hunt' }, probes: 0 });
  });

  it('a boarding that keeps being lost doubles the wait: 10, 20, 40, 80, 80 minutes', () => {
    const w = WATERS[0];
    const g = sailor(202, w);
    const s = g.state;
    fallAt(g, w.spot, null, true);
    const waits: number[] = [];
    for (let i = 0; i < 5; i++) {
      expect(pending(g).phase).toBe('hold');
      waits.push((pending(g).until! - s.totalTicks) / (60 * TPS));
      sailBack(g, w.spot);
      fallAt(g, w.spot, null, true);
    }
    expect(waits).toEqual([10, 20, 40, 80, 80]);
    expect(pending(g).probes).toBe(5);
  });

  it('the walk to a target may take the road; a fallback never does', () => {
    const w = WATERS[0];
    const g = sailor(203, w);
    const s = g.state;
    s.spot = w.haven;
    const goal = { spot: w.spot, activity: 'hunt' };
    expect(returnBlock(s, goal)).toBe('forced_road');
    expect(returnBlock(s, goal, true)).toBeNull();
  });

  it('a pocket pit behind a forced road: hold, sail again, hunt', () => {
    const g = world(204, 'kr_pit');
    const s = g.state;
    fallAt(g, 'kr_pit');
    expect(pending(g)).toMatchObject({ phase: 'hold', target: { spot: 'kr_pit', activity: 'hunt' }, probes: 0 });
    expect(lines(g)).toContain('No safer hunt known. Retrying Test Pit in 10 min.');
    sailBack(g, 'kr_pit');
    s.combat = null;
    g.bus.emit({ type: 'fight:won', spot: 'kr_pit', forced: true });
    g.tick();
    expect(s.activity).toBe('hunt');
  });

  it('a boss door is not sailed into again: it falls back where a fallback exists', () => {
    // The Door: a boss row behind the Burial Chamber's forced road.
    const g = new Game(createInitialState(205));
    const s = g.state;
    s.spot = 'f19_door';
    s.discovered.push('f19_causeway', 'f19_entrance', 'f19_gallery', 'f19_chamber', 'f19_door');
    s.safeSpots = { nearest: 'f19_causeway', unconditional: 'f19_causeway' };
    expect(SPOTS.f19_door.encounters!.some((e) => e.boss)).toBe(true);
    s.spot = 'f19_causeway';
    const goal = { spot: 'f19_door', activity: 'hunt' };
    expect(returnBlock(s, goal)).toBe('forced_road');
    expect(returnBlock(s, goal, true)).toBe('forced_road');
    fallAt(g, 'f19_door');
    // The lowest-level roofed hunt on the floor, and no target to come back to.
    expect(pending(g)).toMatchObject({ phase: 'fallback', target: null, fallback: { spot: 'f19_entrance' } });
    expect(lines(g)).toContain(
      `${SPOTS.f19_door.name}: forced road in, not re-entered. Hunting ${SPOTS.f19_entrance.name} for 200 wins.`,
    );
  });

  it('a boss row behind a forced road is one fight to be chosen: with nothing to fall back to, it idles', () => {
    const g = world(206, 'kr_pit');
    const pit = SPOTS.kr_pit;
    const saved = pit.encounters;
    pit.encounters = [{ monsterId: 'forest_rat', weight: 1, boss: true, level: [1, 1] }];
    try {
      fallAt(g, 'kr_pit');
      expect(g.state.pendingReturn).toBeNull();
      expect(g.state.activity).toBeNull();
      expect(lines(g)).toContain('Test Pit: forced road in, not re-entered. No safer hunt known.');
    } finally {
      pit.encounters = saved;
    }
  });
});
