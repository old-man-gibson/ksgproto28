import { describe, expect, it } from 'vitest';
import {
  AUTOSAVE_MS,
  GAP_THRESHOLD_MS,
  OVERLAY_FROM_MS,
  SUSPEND_SLACK_MS,
  createPump,
} from '../src/ui/lib/pump';
import { OFFLINE_CAP_MS, OFFLINE_MIN_MS, type OfflineSummary } from '../src/core/save/offline';

// The frame pump reads a monotonic clock and the wall clock. A device asleep with
// the app alive stops the first and not the second; the pump credits the sleep as
// one absence, once, with one report (ui/lib/pump.ts). These stop and move the two
// clocks by hand, and the catch-up is a fake that takes time the way the real one
// does.

const HOUR = 3_600_000;
const SUMMARY = { ticks: 1, ms: 1, capped: false, kills: 0, goldGained: 0, itemsGained: 0, attrLevels: [], skillLevels: [] } as OfflineSummary;

/** Let the pump's promise chain run (the overlay's paint, the catch-up, the clean-up). */
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

function rig(opts: { paused?: boolean; hidden?: boolean; catchUpCostMs?: number; overlay?: boolean } = {}) {
  const clock = { perf: 1_000, wall: 1_700_000_000_000 };
  const log = {
    advance: [] as number[],
    catchUp: [] as number[],
    /** What the real catch-up would credit: the gap, capped (core/save/offline.ts). */
    credited: 0,
    reports: [] as OfflineSummary[],
    saves: 0,
    announced: [] as (number | null)[],
  };
  const state = { paused: opts.paused ?? false, hidden: opts.hidden ?? false, throwInCatchUp: false };
  let paint: (() => void) | null = null;
  const pump = createPump({
    perf: () => clock.perf,
    wall: () => clock.wall,
    paused: () => state.paused,
    hidden: () => state.hidden,
    advance: (ms) => void log.advance.push(ms),
    catchUp: (ms) => {
      if (state.throwInCatchUp) throw new Error('catch-up failed');
      log.catchUp.push(ms);
      log.credited += Math.min(ms, OFFLINE_CAP_MS);
      // The real catch-up takes real time: both clocks move while it runs.
      clock.perf += opts.catchUpCostMs ?? 0;
      clock.wall += opts.catchUpCostMs ?? 0;
      return ms >= OFFLINE_MIN_MS ? ({ ...SUMMARY, ms: Math.min(ms, OFFLINE_CAP_MS), capped: ms > OFFLINE_CAP_MS } as OfflineSummary) : null;
    },
    report: (s) => void log.reports.push(s),
    save: () => void log.saves++,
    ...(opts.overlay === false
      ? {}
      : {
          announce: (ms: number | null) => void log.announced.push(ms),
          nextPaint: () => new Promise<void>((resolve) => (paint = resolve)),
        }),
  });
  pump.start();
  /** Time passes on both clocks. */
  const run = (ms: number) => {
    clock.perf += ms;
    clock.wall += ms;
  };
  /** The device sleeps: only the wall clock moves. */
  const sleep = (ms: number) => {
    clock.wall += ms;
  };
  return {
    clock,
    log,
    state,
    pump,
    run,
    sleep,
    /** The overlay has painted. */
    paintNow: async () => {
      paint?.();
      paint = null;
      await flush();
    },
    waitingForPaint: () => paint !== null,
  };
}

describe('the frame pump', () => {
  it('credits an ordinary frame as ticks, once', () => {
    const r = rig();
    r.run(16);
    r.pump.pump();
    expect(r.log.advance).toEqual([16]);
    expect(r.log.catchUp).toEqual([]);
  });

  it('does nothing before start', () => {
    const clock = { perf: 0, wall: 0 };
    let ran = 0;
    const pump = createPump({
      perf: () => clock.perf,
      wall: () => clock.wall,
      paused: () => false,
      hidden: () => false,
      advance: () => void ran++,
      catchUp: () => (ran++, null),
      report: () => {},
      save: () => {},
    });
    clock.perf += 5000;
    clock.wall += 5000;
    pump.pump();
    pump.settle();
    expect(ran).toBe(0);
  });

  it('the overlay threshold is the minute the catch-up reports from', () => {
    expect(OVERLAY_FROM_MS).toBe(OFFLINE_MIN_MS);
  });
});

describe('a night asleep with the app alive', () => {
  it('is credited whole, once, with one report, when the app is back: the catch-up’s own 70 s are not a second gap', async () => {
    const r = rig({ catchUpCostMs: 70_000 });
    r.run(1000);
    r.pump.pump();
    r.sleep(8 * HOUR);
    r.run(16);
    r.pump.settle(); // Android resume
    // The overlay is up and nothing has run yet: it paints first.
    expect(r.log.announced).toEqual([8 * HOUR + 16]);
    expect(r.log.catchUp).toEqual([]);
    expect(r.waitingForPaint()).toBe(true);
    // Frames and the interval that come while it waits do nothing, and lose nothing.
    r.run(16);
    r.pump.pump();
    r.pump.settle();
    expect(r.log.catchUp).toEqual([]);
    await r.paintNow();
    expect(r.log.catchUp).toEqual([8 * HOUR + 16]);
    expect(r.log.reports).toHaveLength(1);
    expect(r.log.reports[0].ms).toBe(8 * HOUR);
    expect(r.log.announced).toEqual([8 * HOUR + 16, null]);
    // The next frames, a second after: no second gap out of the catch-up's 70 s.
    r.run(1000);
    r.pump.pump();
    r.pump.settle();
    r.run(16);
    r.pump.pump();
    expect(r.log.catchUp).toHaveLength(1);
    expect(r.log.reports).toHaveLength(1);
    expect(r.log.advance.filter((ms) => ms > 0)).toEqual([1000, 1000, 16]);
  });

  it('with a catch-up that takes 70 s, the next frame is not a 70 s gap even without the overlay (a sleep under a minute)', () => {
    const r = rig({ catchUpCostMs: 70_000 });
    r.sleep(30_000);
    r.pump.pump(); // 30 s: quiet catch-up, no overlay
    expect(r.log.catchUp).toEqual([30_000]);
    r.run(16);
    r.pump.pump();
    expect(r.log.catchUp).toHaveLength(1);
    expect(r.log.advance).toEqual([16]);
    expect(r.log.reports).toEqual([]);
  });

  it('is credited once however the app comes back: resume, visible and the next frame are one gap', async () => {
    const r = rig();
    r.sleep(2 * HOUR);
    r.run(5);
    r.pump.settle(); // Android resume
    r.pump.settle(); // visibilitychange
    r.run(16);
    r.pump.pump(); // the next frame
    await r.paintNow();
    r.run(1000);
    r.pump.pump(); // the interval
    expect(r.log.catchUp).toEqual([2 * HOUR + 5]);
    expect(r.log.reports).toHaveLength(1);
    expect(r.log.advance.filter((ms) => ms > 0)).toEqual([1000]);
  });

  it('a catch-up that throws takes the overlay down and does not wedge the pump', async () => {
    const r = rig();
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (e: unknown) => void errors.push(e);
    try {
      r.state.throwInCatchUp = true;
      r.sleep(HOUR);
      r.pump.settle();
      await r.paintNow();
      expect(errors).toHaveLength(1);
      expect(r.log.announced).toEqual([HOUR, null]);
      r.state.throwInCatchUp = false;
      r.run(16);
      r.pump.pump();
      expect(r.log.advance).toEqual([16]);
    } finally {
      console.error = original;
    }
  });
});

describe('a night asleep in wake windows', () => {
  it('three 7 h pieces while hidden are 8 h credited, in one report, not 21 h', async () => {
    const r = rig({ hidden: true });
    for (let i = 0; i < 3; i++) {
      r.sleep(7 * HOUR);
      r.run(1000); // the wake window: the interval fires, the monotonic clock moves a second
      r.pump.pump();
    }
    // Nothing credited as sleep, nothing reported, nothing saved over lastSaved.
    expect(r.log.catchUp).toEqual([]);
    expect(r.log.reports).toEqual([]);
    expect(r.log.advance).toEqual([1000, 1000, 1000]);
    expect(r.pump.carried()).toBe(21 * HOUR);
    // Morning: the page is visible again.
    r.state.hidden = false;
    r.run(16);
    r.pump.settle();
    await r.paintNow();
    expect(r.log.catchUp).toEqual([21 * HOUR + 16]);
    expect(r.log.credited).toBe(OFFLINE_CAP_MS);
    expect(r.log.reports).toHaveLength(1);
    expect(r.log.reports[0].capped).toBe(true);
    expect(r.pump.carried()).toBe(0);
  });

  it('a wake window the monotonic clock saw is credited as before, and the sleep over it is carried', () => {
    const r = rig({ hidden: true });
    r.sleep(7 * HOUR);
    r.run(40_000); // a 40 s throttled window: a stall, caught up quietly
    r.pump.pump();
    expect(r.log.catchUp).toEqual([40_000]);
    expect(r.pump.carried()).toBe(7 * HOUR);
  });

  it('settle() cashes even when the page still reports hidden (Android resume can come first)', async () => {
    const r = rig({ hidden: true });
    r.sleep(5 * HOUR);
    r.run(10);
    r.pump.pump();
    expect(r.pump.carried()).toBe(5 * HOUR);
    r.run(10);
    r.pump.settle();
    await r.paintNow();
    expect(r.log.catchUp).toEqual([5 * HOUR + 10]);
  });

  it('does not autosave while sleep is carried, and does once it is cashed', async () => {
    const r = rig({ hidden: true });
    r.sleep(HOUR);
    r.run(AUTOSAVE_MS + 1000);
    r.pump.pump();
    expect(r.log.saves).toBe(0);
    r.state.hidden = false;
    r.run(16);
    r.pump.settle();
    await r.paintNow();
    r.run(AUTOSAVE_MS + 1000);
    r.pump.pump();
    expect(r.log.saves).toBeGreaterThanOrEqual(1);
  });

  it('a hidden tab that kept running (both clocks) is credited by its own clock, once', () => {
    const r = rig({ hidden: true });
    for (let i = 0; i < 10; i++) {
      r.run(60_000);
      r.pump.pump();
    }
    expect(r.log.catchUp).toEqual(Array(10).fill(60_000));
    expect(r.pump.carried()).toBe(0);
    r.state.hidden = false;
    r.run(40);
    r.pump.settle();
    expect(r.log.catchUp).toHaveLength(10);
    expect(r.log.advance).toEqual([40]);
  });
});

describe('a short sleep', () => {
  it.each([5.1, 7, 9.9, 11])('%s s asleep is credited as %s s, in full', (seconds) => {
    const r = rig();
    const ms = Math.round(seconds * 1000);
    expect(ms).toBeGreaterThan(SUSPEND_SLACK_MS);
    r.sleep(ms);
    r.pump.pump();
    // Through the catch-up (no 30-tick valve), quietly: no overlay under a minute, no report.
    expect(r.log.catchUp).toEqual([ms]);
    expect(r.log.advance).toEqual([]);
    expect(r.log.credited).toBe(ms);
    expect(r.log.reports).toEqual([]);
    expect(r.log.announced).toEqual([]);
  });

  it('a minute asleep shows the overlay and reports', async () => {
    const r = rig();
    r.sleep(OVERLAY_FROM_MS);
    r.pump.pump();
    expect(r.log.announced).toEqual([OVERLAY_FROM_MS]);
    await r.paintNow();
    expect(r.log.reports).toHaveLength(1);
  });

  it('drift between the clocks under the slack is not sleep', () => {
    const r = rig();
    r.clock.perf += 1000;
    r.clock.wall += 1000 + SUSPEND_SLACK_MS - 1;
    r.pump.pump();
    expect(r.log.advance).toEqual([1000]);
    expect(r.log.catchUp).toEqual([]);
  });

  it('a wall clock set backwards credits what the monotonic clock saw', () => {
    const r = rig();
    r.clock.perf += 1000;
    r.clock.wall -= 3 * HOUR;
    r.pump.pump();
    expect(r.log.advance).toEqual([1000]);
    // ...and the next frame is measured from the new mark, not from the old one.
    r.run(16);
    r.pump.pump();
    expect(r.log.advance).toEqual([1000, 16]);
    expect(r.log.catchUp).toEqual([]);
  });
});

describe('the rest of the pump', () => {
  it('a monotonic stall over the threshold is a catch-up, and its own duration is not a second one', () => {
    const r = rig({ catchUpCostMs: 20_000 });
    r.run(GAP_THRESHOLD_MS + 1);
    r.pump.pump();
    expect(r.log.catchUp).toEqual([GAP_THRESHOLD_MS + 1]);
    r.run(16);
    r.pump.pump();
    expect(r.log.catchUp).toHaveLength(1);
    expect(r.log.advance).toEqual([16]);
  });

  it('a paused world drops the sleep and what was carried, and only what follows the unpause counts', () => {
    const r = rig({ paused: true, hidden: true });
    r.sleep(8 * HOUR);
    r.pump.pump();
    expect(r.pump.carried()).toBe(0);
    r.state.hidden = false;
    r.pump.settle();
    expect(r.log.catchUp).toEqual([]);
    expect(r.log.advance).toEqual([]);
    r.state.paused = false;
    r.run(16);
    r.pump.pump();
    expect(r.log.advance).toEqual([16]);
    expect(r.log.catchUp).toEqual([]);
  });

  it('autosaves every 30 s of monotonic time, and a save made elsewhere restarts that clock', () => {
    const r = rig();
    r.run(AUTOSAVE_MS - 1000);
    r.pump.pump();
    expect(r.log.saves).toBe(0);
    r.pump.saved();
    r.run(AUTOSAVE_MS - 1000);
    r.pump.pump();
    expect(r.log.saves).toBe(0);
    r.run(2000);
    r.pump.pump();
    expect(r.log.saves).toBe(1);
  });

  it('start() moves both marks, so the boot catch-up’s own duration is not caught up again', () => {
    const r = rig();
    r.run(30_000); // the boot catch-up ran this long
    r.pump.start();
    r.run(16);
    r.pump.pump();
    expect(r.log.catchUp).toEqual([]);
    expect(r.log.advance).toEqual([16]);
  });
});
