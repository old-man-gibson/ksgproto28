/**
 * The header's rate chip: gold per minute and kills per minute over the last
 * 600 game ticks (one minute of game time). Memory only: nothing here is saved,
 * and a reload starts an empty window.
 *
 * The window is measured in game ticks, so a paused world adds nothing to it.
 * `sample` ignores calls while paused, which keeps the chip at its last figure
 * while the player steps through a fight. Stepping and then resuming leaves the
 * window intact; the stepped ticks are in the next sample's counters.
 *
 * The window clears (and starts again from the sample that caused it) when:
 *  - the clock jumped more than `RATE_WINDOW_TICKS` since the last sample
 *    (offline catch-up, an import),
 *  - `prestige.count` changed (the run's counters restart),
 *  - gold or kills fell below the previous sample (a reset or an import).
 */

/** Length of the window, in game ticks. */
export const RATE_WINDOW_TICKS = 600;

/** The chip stays blank until the window spans this many ticks (30 s): shorter spans swing too far per kill. */
export const RATE_MIN_SPAN_TICKS = 300;

/** Samples are taken no closer than this many ticks (1 s). */
const SAMPLE_EVERY_TICKS = 10;

interface RateSample {
  tick: number;
  gold: number;
  kills: number;
  prestige: number;
}

export class RateMeter {
  /** Per-minute figures, or null while the window is too short. */
  gold = $state<number | null>(null);
  kills = $state<number | null>(null);

  private samples: RateSample[] = [];

  /**
   * Feed the meter the counters at `tick`. Call as often as convenient; calls
   * closer than a second to the last sample are ignored.
   */
  sample(tick: number, gold: number, kills: number, prestige: number, paused: boolean): void {
    if (paused) return;
    const last = this.samples[this.samples.length - 1];
    if (last) {
      if (
        tick - last.tick > RATE_WINDOW_TICKS ||
        tick < last.tick ||
        prestige !== last.prestige ||
        gold < last.gold ||
        kills < last.kills
      ) {
        this.samples = [];
      } else if (tick - last.tick < SAMPLE_EVERY_TICKS) {
        return;
      }
    }
    this.samples.push({ tick, gold, kills, prestige });
    while (this.samples.length > 1 && this.samples[0].tick < tick - RATE_WINDOW_TICKS) this.samples.shift();
    this.publish();
  }

  /** Forget the window. */
  clear(): void {
    this.samples = [];
    this.publish();
  }

  private publish(): void {
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const span = first && last ? last.tick - first.tick : 0;
    if (span < RATE_MIN_SPAN_TICKS) {
      this.gold = null;
      this.kills = null;
      return;
    }
    const perMinute = RATE_WINDOW_TICKS / span;
    this.gold = (last.gold - first.gold) * perMinute;
    this.kills = (last.kills - first.kills) * perMinute;
  }
}
