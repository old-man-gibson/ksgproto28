import { describe, expect, it } from 'vitest';
import { AUTOSAVE_MS, GAP_THRESHOLD_MS, SUSPEND_SLACK_MS, createPump } from '../src/ui/lib/pump';
import type { OfflineSummary } from '../src/core/save/offline';

// The frame pump reads a monotonic clock and the wall clock. A device asleep with
// the app alive stops the first and not the second; the pump credits the sleep as
// one long gap, once (ui/lib/pump.ts). These stop and move the two clocks by hand.

const HOUR = 3_600_000;
const SUMMARY = { ticks: 1, ms: 1, capped: false, kills: 0, goldGained: 0, itemsGained: 0, attrLevels: [], skillLevels: [] } as OfflineSummary;

function rig(opts: { paused?: boolean } = {}) {
  const clock = { perf: 1_000, wall: 1_700_000_000_000 };
  const log = { advance: [] as number[], catchUp: [] as number[], reports: 0, saves: 0 };
  const state = { paused: opts.paused ?? false };
  const pump = createPump({
    perf: () => clock.perf,
    wall: () => clock.wall,
    paused: () => state.paused,
    advance: (ms) => void log.advance.push(ms),
    catchUp: (ms) => {
      log.catchUp.push(ms);
      return ms >= 60_000 ? SUMMARY : null;
    },
    report: () => void log.reports++,
    save: () => void log.saves++,
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
  return { clock, log, state, pump, run, sleep };
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

  it('a night asleep with the process alive is credited as a long gap with its report, not as the few ms the monotonic clock saw', () => {
    const r = rig();
    r.run(1000);
    r.pump.pump();
    r.sleep(8 * HOUR);
    r.run(16); // the first frame after waking
    r.pump.pump();
    expect(r.log.catchUp).toEqual([8 * HOUR + 16]);
    expect(r.log.advance).toEqual([1000]);
    expect(r.log.reports).toBe(1);
  });

  it('is credited once however the app comes back: resume, visible and the next frame are the same gap', () => {
    const r = rig();
    r.sleep(2 * HOUR);
    r.run(5);
    r.pump.settle(); // Android resume
    r.pump.settle(); // visibilitychange
    r.run(16);
    r.pump.pump(); // the next frame
    r.run(1000);
    r.pump.pump(); // the interval
    expect(r.log.catchUp).toEqual([2 * HOUR + 5]);
    expect(r.log.reports).toBe(1);
    expect(r.log.advance.filter((ms) => ms > 0)).toEqual([16, 1000]);
  });

  it('a hidden tab that kept running is credited by its own clock, not twice', () => {
    const r = rig();
    // Throttled to one call a minute for ten minutes: both clocks moved together.
    for (let i = 0; i < 10; i++) {
      r.run(60_000);
      r.pump.pump();
    }
    expect(r.log.catchUp).toEqual(Array(10).fill(60_000));
    // Coming back: the interval has just run, so the settle credits the sliver since.
    r.run(40);
    r.pump.settle();
    expect(r.log.catchUp).toHaveLength(10);
    expect(r.log.advance).toEqual([40]);
    expect(r.log.reports).toBe(10);
  });

  it('a short sleep under the gap threshold is run as ticks, from the wall clock', () => {
    const r = rig();
    r.sleep(SUSPEND_SLACK_MS + 2000);
    r.pump.pump();
    expect(r.log.advance).toEqual([SUSPEND_SLACK_MS + 2000]);
    expect(SUSPEND_SLACK_MS + 2000).toBeLessThan(GAP_THRESHOLD_MS);
    expect(r.log.catchUp).toEqual([]);
  });

  it('drift between the clocks under the slack is not sleep', () => {
    const r = rig();
    r.clock.perf += 1000;
    r.clock.wall += 1000 + SUSPEND_SLACK_MS - 1;
    r.pump.pump();
    expect(r.log.advance).toEqual([1000]);
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

  it('a paused world drops the sleep, and only what follows the unpause counts', () => {
    const r = rig({ paused: true });
    r.sleep(8 * HOUR);
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
