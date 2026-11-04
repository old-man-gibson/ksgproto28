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
import type { PendingReturn, SpotDef, StatusDef } from '../src/core/types';
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
      { to: 'kr_den', ticks: 5 },
      { to: 'kr_pit', ticks: 5, forced: true },
    ],
  }),
  kr_field: pocket('kr_field', 'Test Field', { activities: [hunt], encounters: rats }),
  kr_meadow: pocket('kr_meadow', 'Test Meadow', { waypoint: true, activities: [hunt], encounters: rats }),
  kr_hopeless: pocket('kr_hopeless', 'Test Pit of Golems', { activities: [hunt], encounters: golem }),
  kr_ring: pocket('kr_ring', 'Test Ring', { fightLimit: 1, activities: [hunt], encounters: rats }),
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
function fallAt(g: Game, spot: string, activity: string | null = 'hunt'): void {
  const s = g.state;
  s.spot = spot;
  s.activity = activity;
  s.combat = null;
  s.travel = null;
  s.travelPlan = [];
  s.travelIntent = null;
  const fall = captureFall(s);
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

  it('a fall with no work running falls back, or idles, and never invents a target', () => {
    const g = world(13);
    fallAt(g, 'kr_camp', null);
    expect(g.state.pendingReturn).toBeNull();
    expect(lines(g)).toContain('Test Camp: no work was running. No safer hunt known.');
    g.state.proven = { spot: 'kr_meadow', activity: 'hunt' };
    fallAt(g, 'kr_camp', null);
    expect(pending(g)).toMatchObject({ phase: 'fallback', target: null });
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
    let probes = 0;
    let lastPhase = s.pendingReturn?.phase;
    for (let i = 0; i < EIGHT_HOURS; i++) {
      g.tick();
      // Idle: nothing selected, not walking, not fighting. Being out cold counts.
      if (!s.activity && !s.travel && !s.combat) stretch++;
      else stretch = 0;
      if (stretch > longest) longest = stretch;
      const phase = s.pendingReturn?.phase;
      if (phase === 'return' && lastPhase === 'hold') probes++;
      lastPhase = phase;
    }
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
    let fallbacks = 0;
    let lastPhase = s.pendingReturn?.phase;
    for (let i = 0; i < EIGHT_HOURS; i++) {
      g.tick();
      if (!s.activity && !s.travel && !s.combat) stretch++;
      else stretch = 0;
      if (stretch > longest) longest = stretch;
      const phase = s.pendingReturn?.phase;
      if (phase === 'fallback' && lastPhase !== 'fallback') fallbacks++;
      lastPhase = phase;
    }
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
