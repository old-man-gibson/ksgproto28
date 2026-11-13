import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { loadFromStorage, saveToStorage } from '../src/core/save/save';
import { OFFLINE_CAP_MS, OFFLINE_MIN_MS, runOfflineProgress, type OfflineSummary } from '../src/core/save/offline';

// A phone sleeps overnight with the app hidden (the pump carries the sleep), and in
// the morning the app is swiped away from recents without being opened: the page
// gets `pagehide` (or a second pause). A trigger save then writes lastSaved = now,
// and the boot, which credits now - lastSaved, would lose the night. No trigger
// save is made while sleep is carried (ui/lib/runtime.ts); the boot credits from
// the save made when the page hid.

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
const listeners = new Map<string, () => void>();
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
/** The real catch-up of 7 to 8 h takes about 3 s alone and more with the whole suite running. */
const REAL_CATCH_UP_TIMEOUT_MS = 90_000;
const T0 = Date.UTC(2026, 10, 12, 22, 0, 0);

/** A Storage that is a Map: what a localStorage keeps between a swiped-away app and the next launch. */
function memoryStorage(): Storage {
  const mem = new Map<string, string>();
  return {
    get length() {
      return mem.size;
    },
    key: (i: number) => [...mem.keys()][i] ?? null,
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
  };
}

function setVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** A running app on fake clocks, its saves going to a memory storage. */
function app() {
  const storage = memoryStorage();
  const state = createInitialState(7);
  const clock = { perf: 10_000 };
  const flags = { hidden: false };
  const intervals: (() => void)[] = [];
  const frames: (() => void)[] = [];
  const saves: number[] = [];
  const ui = { catchingUp: null as number | null, offline: null as OfflineSummary | null };
  const runtime = startRuntime({
    game: { state, tick: () => {} },
    ui,
    boot: () => {},
    catchUp: () => null,
    save: () => {
      saveToStorage(state, storage);
      saves.push(Date.now());
    },
    perf: () => clock.perf,
    wall: () => Date.now(),
    hidden: () => flags.hidden,
    frame: (cb) => void frames.push(cb),
    later: (cb) => cb(),
    every: (fn) => void intervals.push(fn),
  });
  /** The page hides (the screen goes off): the hide-time save is written. */
  const hide = () => {
    flags.hidden = true;
    setVisibility('hidden');
  };
  /** A wake window while hidden: the wall clock has moved `sleepMs`, the monotonic clock a second. */
  const wake = (sleepMs: number) => {
    vi.setSystemTime(Date.now() + sleepMs);
    clock.perf += 1000;
    intervals[0]();
  };
  /** One painted frame: what was queued for the next one, then the microtasks that follow. */
  const paint = async () => {
    for (const cb of frames.splice(0)) cb();
    for (let i = 0; i < 12; i++) await Promise.resolve();
  };
  return { storage, state, ui, saves, runtime, hide, wake, paint };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  listeners.clear();
});
afterEach(() => {
  vi.useRealTimers();
  setVisibility('visible');
});

/** What the boot does with a save: read it back, and credit the time since `lastSaved`. */
function reboot(storage: Storage, bootAt: number) {
  vi.setSystemTime(bootAt);
  const state = loadFromStorage(storage).state!;
  const away = Math.max(0, Date.now() - state.lastSaved);
  return { state, away };
}

describe('a night asleep, then the app is swiped away', () => {
  it('pagehide while sleep is carried writes no save: lastSaved stays at the hide-time save', () => {
    const a = app();
    a.hide();
    expect(a.saves).toHaveLength(1);
    a.wake(7 * HOUR);
    expect(a.runtime.pump.carried()).toBeGreaterThan(6.9 * HOUR);
    window.dispatchEvent(new Event('beforeunload'));
    window.dispatchEvent(new Event('pagehide'));
    setVisibility('hidden'); // a second hidden event
    listeners.get('pause')!(); // and Android's pause
    expect(a.saves).toHaveLength(1);
    expect(loadFromStorage(a.storage).state!.lastSaved).toBe(T0);
  });

  it('the next boot credits the night from that save', () => {
    const a = app();
    a.hide();
    a.wake(7 * HOUR);
    window.dispatchEvent(new Event('pagehide'));
    const { state, away } = reboot(a.storage, Date.now() + 30 * 60_000);
    expect(away).toBeGreaterThanOrEqual(7 * HOUR);
    expect(away).toBeLessThan(8 * HOUR);
    expect(away).toBeGreaterThanOrEqual(OFFLINE_MIN_MS);
    const summary = runOfflineProgress(new Game(state), away)!;
    expect(summary.ms).toBe(Math.floor(away));
    expect(summary.capped).toBe(false);
    expect(summary.ticks).toBeGreaterThan(7 * 36_000);
  }, REAL_CATCH_UP_TIMEOUT_MS);

  it('three 7 h wake windows then a swipe-away: the boot credits 8 h, capped, once', () => {
    const a = app();
    a.hide();
    for (let i = 0; i < 3; i++) a.wake(7 * HOUR);
    window.dispatchEvent(new Event('pagehide'));
    const { state, away } = reboot(a.storage, Date.now() + 10 * 60_000);
    expect(away).toBeGreaterThan(21 * HOUR);
    const summary = runOfflineProgress(new Game(state), away)!;
    expect(summary.capped).toBe(true);
    expect(summary.ms).toBe(OFFLINE_CAP_MS);
  }, REAL_CATCH_UP_TIMEOUT_MS);

  it('control: a trigger save with no sleep carried is made, and moves lastSaved (the ordinary pagehide)', () => {
    const a = app();
    a.hide();
    vi.setSystemTime(T0 + 20_000);
    window.dispatchEvent(new Event('pagehide'));
    expect(a.saves).toHaveLength(2);
    expect(loadFromStorage(a.storage).state!.lastSaved).toBe(T0 + 20_000);
  });

  it('once the app is opened and the sleep cashed, trigger saves are made again', async () => {
    const a = app();
    a.hide();
    a.wake(7 * HOUR);
    expect(a.runtime.pump.carried()).toBeGreaterThan(0);
    a.runtime.pump.settle(); // the user opens the app: the overlay goes up first
    expect(a.runtime.pump.carried()).toBe(0);
    expect(a.ui.catchingUp).toBeGreaterThan(6.9 * HOUR);
    window.dispatchEvent(new Event('pagehide')); // blocked while the overlay waits, as at boot
    expect(a.saves).toHaveLength(1);
    await a.paint(); // the catch-up runs, the overlay goes down
    expect(a.ui.catchingUp).toBeNull();
    window.dispatchEvent(new Event('pagehide'));
    expect(a.saves).toHaveLength(2);
  });
});
