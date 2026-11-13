import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OfflineSummary } from '../src/core/save/offline';

// main.ts hands the game to `startRuntime` (ui/lib/runtime.ts) once the app has
// mounted. This runs that wiring on fake clocks, a fake frame loop and a fake App
// plugin: the pump starts after the boot and never before, and the page turning
// visible and Android's `resume` both settle the pump, once.

const listeners = new Map<string, () => void>();
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (name: string, fn: () => void) => {
      listeners.set(name, fn);
      return Promise.resolve({ remove: () => {} });
    },
    minimizeApp: () => Promise.resolve(),
  },
}));

const { startRuntime } = await import('../src/ui/lib/runtime');

const HOUR = 3_600_000;
const SUMMARY = { ticks: 1, ms: 1, capped: false, kills: 0, goldGained: 0, itemsGained: 0, attrLevels: [], skillLevels: [] } as OfflineSummary;

function visibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

function world(opts: { catching?: number | null } = {}) {
  const clock = { perf: 5_000, wall: 1_700_000_000_000 };
  const calls: string[] = [];
  const game = { state: { paused: false }, tick: () => void calls.push('tick') };
  const ui = { catchingUp: (opts.catching ?? null) as number | null, offline: null as OfflineSummary | null };
  const frames: (() => void)[] = [];
  const laters: (() => void)[] = [];
  const intervals: { fn: () => void; ms: number }[] = [];
  const catchUps: number[] = [];
  const saves: string[] = [];
  const deps = {
    game,
    ui,
    boot: () => {
      calls.push('boot');
      ui.catchingUp = null;
    },
    catchUp: (ms: number) => {
      catchUps.push(ms);
      return SUMMARY;
    },
    save: () => void saves.push('save'),
    perf: () => clock.perf,
    wall: () => clock.wall,
    hidden: () => false,
    frame: (cb: () => void) => void frames.push(cb),
    later: (cb: () => void) => void laters.push(cb),
    every: (fn: () => void, ms: number) => void intervals.push({ fn, ms }),
  };
  /** One painted frame: the queued frame callbacks, then the timeouts they scheduled. */
  async function paint() {
    const f = frames.splice(0);
    for (const cb of f) cb();
    const l = laters.splice(0);
    for (const cb of l) cb();
    for (let i = 0; i < 12; i++) await Promise.resolve();
  }
  return { clock, calls, game, ui, frames, laters, intervals, catchUps, saves, deps, paint };
}

beforeEach(() => {
  listeners.clear();
  visibility('visible');
});

describe('the runtime wiring', () => {
  it('with nothing to catch up: boots, then starts the frame loop and a one-second interval', () => {
    const w = world();
    startRuntime(w.deps);
    expect(w.calls).toEqual(['boot']);
    expect(w.frames).toHaveLength(1);
    expect(w.intervals.map((i) => i.ms)).toEqual([1000]);
  });

  it('with a catch-up to run: waits for a painted frame, then boots, then starts', async () => {
    const w = world({ catching: 3 * HOUR });
    startRuntime(w.deps);
    // The overlay is up and nothing has booted or started: a frame is queued, no loop, no interval.
    expect(w.ui.catchingUp).toBe(3 * HOUR);
    expect(w.calls).toEqual([]);
    expect(w.intervals).toEqual([]);
    await w.paint(); // rAF, then the timeout after it: the boot runs
    expect(w.calls).toEqual(['boot']);
    expect(w.ui.catchingUp).toBeNull();
    expect(w.intervals).toHaveLength(1);
  });

  it('the page turning visible or the app resuming before the boot has run credits nothing', () => {
    const w = world({ catching: 3 * HOUR });
    startRuntime(w.deps);
    w.clock.wall += 8 * HOUR;
    visibility('hidden');
    visibility('visible');
    listeners.get('resume')!();
    expect(w.catchUps).toEqual([]);
    expect(w.saves).toEqual([]); // the hidden save is blocked too: it would erase the time away
  });

  it('the page turning visible after a night credits it once, with the overlay first, and resume right after adds nothing', async () => {
    const w = world();
    startRuntime(w.deps);
    visibility('hidden'); // the hidden save
    expect(w.saves).toEqual(['save']);
    w.clock.wall += 8 * HOUR; // asleep: only the wall clock moved
    w.clock.perf += 12;
    visibility('visible');
    expect(w.ui.catchingUp).toBeGreaterThanOrEqual(8 * HOUR);
    expect(w.catchUps).toEqual([]); // not yet: the overlay paints first
    listeners.get('resume')!(); // Android's resume, the same moment
    await w.paint();
    expect(w.catchUps).toHaveLength(1);
    expect(w.catchUps[0]).toBeGreaterThanOrEqual(8 * HOUR);
    expect(w.ui.offline).toBe(SUMMARY);
    expect(w.ui.catchingUp).toBeNull();
    // The loop and the interval after it: nothing left to credit.
    w.clock.perf += 16;
    w.clock.wall += 16;
    w.intervals[0].fn();
    expect(w.catchUps).toHaveLength(1);
  });

  it('the interval alone credits a night too (no event came), and ticks run for an ordinary frame', () => {
    const w = world();
    startRuntime(w.deps);
    w.clock.perf += 100;
    w.clock.wall += 100;
    w.intervals[0].fn();
    expect(w.calls.filter((c) => c === 'tick')).toHaveLength(1);
    w.clock.wall += 2 * HOUR;
    w.intervals[0].fn();
    expect(w.ui.catchingUp).toBeGreaterThanOrEqual(2 * HOUR);
  });

  it('the pause event saves, and not before the boot', () => {
    const w = world({ catching: HOUR });
    startRuntime(w.deps);
    listeners.get('pause')!();
    expect(w.saves).toEqual([]);
    const v = world();
    startRuntime(v.deps);
    listeners.get('pause')!();
    expect(v.saves).toEqual(['save']);
  });
});
