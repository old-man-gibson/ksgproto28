import { describe, expect, it } from 'vitest';
import {
  clockOf,
  formatDate,
  formatTime,
  HOLY_DAY_INDICES,
  TICKS_PER_DAY,
} from '../src/core/systems/clock';
import { DAYS_PER_YEAR, HOLY_DAYS, TICKS_PER_GAME_MINUTE } from '../src/core/data/climate.data';
import { createInitialState } from '../src/core/state';
import { DEBUG_STARTING_SPOT } from '../src/core/registry';

/** Ticks at day `d` (0-based absolute), hour `h`, minute `m`. */
const at = (d: number, h = 0, m = 0) => (d * 1440 + h * 60 + m) * TICKS_PER_GAME_MINUTE;

describe('the world clock', () => {
  it('opens on the first day of Year 1 at midnight', () => {
    const c = clockOf(0);
    expect(c.year).toBe(1);
    expect(c.dayOfYear).toBe(0);
    expect(c.monthIndex).toBe(0);
    expect(c.dayOfMonth).toBe(1);
    expect(c.weekday).toBe(0);
    expect(c.hour).toBe(0);
    expect(c.season).toBe('winter');
  });

  it('a day is 14400 ticks and a year is 368 days', () => {
    expect(TICKS_PER_DAY).toBe(14400);
    expect(clockOf(at(1)).dayIndex).toBe(1);
    expect(clockOf(at(DAYS_PER_YEAR)).year).toBe(2);
    expect(clockOf(at(DAYS_PER_YEAR)).dayOfYear).toBe(0);
  });

  it('the calendar is perpetual — every month opens on the same weekday, forever', () => {
    for (let d = 0; d < DAYS_PER_YEAR * 2; d++) {
      const c = clockOf(at(d));
      if (c.dayOfMonth === 1) expect(c.weekday, `day ${d}`).toBe(0);
    }
  });

  it('the four holy days quarter the year and stand outside month and week', () => {
    expect(HOLY_DAY_INDICES).toEqual([91, 183, 275, 367]);
    HOLY_DAY_INDICES.forEach((day, q) => {
      const c = clockOf(at(day));
      expect(c.holyDay?.id).toBe(HOLY_DAYS[q].id);
      expect(c.monthIndex).toBeNull();
      expect(c.weekday).toBeNull();
      // Each holy day sits at the CENTRE of its own season.
      expect(c.season).toBe(HOLY_DAYS[q].season);
    });
  });

  it('a holy day interrupts the month, and the week resumes unbroken after it', () => {
    // Day 91 is the Vernal Equinox; day 92 resumes the 4th month at its 8th
    // day — and lands on a week boundary, because 91 days is 13 exact weeks.
    const after = clockOf(at(92));
    expect(after.monthIndex).toBe(3);
    expect(after.dayOfMonth).toBe(8);
    expect(after.weekday).toBe(0);
  });

  it('the temperature phase peaks at the solstices and zeroes at the equinoxes', () => {
    expect(clockOf(at(183)).seasonPhase).toBeCloseTo(1, 9);
    expect(clockOf(at(367)).seasonPhase).toBeCloseTo(-1, 9);
    expect(clockOf(at(91)).seasonPhase).toBeCloseTo(0, 9);
    expect(clockOf(at(275)).seasonPhase).toBeCloseTo(0, 9);
  });

  it('seasons are centred on their holy days, not started by them', () => {
    expect(clockOf(at(321)).season).toBe('autumn');
    expect(clockOf(at(322)).season).toBe('winter');
    expect(clockOf(at(45)).season).toBe('winter');
    expect(clockOf(at(46)).season).toBe('spring');
  });

  it('dates and times read like dates and times', () => {
    expect(formatDate(clockOf(at(0)))).toBe('Firstday, 1st of First Month, Year 1');
    expect(formatDate(clockOf(at(183)))).toBe('Summer Solstice, Year 1');
    expect(formatTime(clockOf(at(0, 7, 5)))).toBe('07:05');
  });

  it('a new life opens at 09:00, at the tower foot — the square stays a debug start', () => {
    const fresh = createInitialState(1);
    const opening = clockOf(fresh.totalTicks);
    expect([opening.hour, opening.minute, opening.dayOfYear]).toEqual([9, 0, 0]);
    // The story now starts in Threshold, at the door all eight districts
    // reach. `my_home` is still authored and still walkable — it is simply no
    // longer the root, so an existing save standing there is untouched.
    expect(fresh.spot).toBe('ascent_foot');
    expect(fresh.discovered).toEqual(['ascent_foot']);
    expect(createInitialState(1, DEBUG_STARTING_SPOT).spot).toBe('village_square');
  });
});
