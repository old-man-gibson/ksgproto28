/** Logic ticks per second. One tick = 100 ms of game time. */
export const TPS = 10;
export const MS_PER_TICK = 1000 / TPS;

/**
 * Fixed-timestep accumulator. The UI driver (requestAnimationFrame) feeds it
 * elapsed wall-clock time; it answers how many logic ticks to run. Keeping it
 * pure lets us unit-test the timing behaviour headlessly.
 */
export class TickAccumulator {
  private acc = 0;
  /** Safety valve: never run more than this many ticks in one frame (tab lag, breakpoints). */
  constructor(private maxTicksPerFrame = 30) {}

  advance(elapsedMs: number): number {
    this.acc += elapsedMs;
    let ticks = Math.floor(this.acc / MS_PER_TICK);
    this.acc -= ticks * MS_PER_TICK;
    if (ticks > this.maxTicksPerFrame) {
      ticks = this.maxTicksPerFrame;
      this.acc = 0;
    }
    return ticks;
  }
}
