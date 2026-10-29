import { describe, expect, it } from 'vitest';
import {
  clockOf,
  formatDate,
  formatTime,
  HOLY_DAY_INDICES,
  TICKS_PER_DAY,
} from '../src/core/systems/clock';
import {
  DAYS_PER_YEAR,
  HOLY_DAYS,
  MOON_PHASES,
  MOONS,
  TICKS_PER_GAME_MINUTE,
} from '../src/core/data/climate.data';
import { createInitialState } from '../src/core/state';
import { deserialize, serialize } from '../src/core/save/save';

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

  it('a new life opens at 09:00, in the holding cell — the square stays a debug start', () => {
    const fresh = createInitialState(1);
    const opening = clockOf(fresh.totalTicks);
    expect([opening.hour, opening.minute, opening.dayOfYear]).toEqual([9, 0, 0]);
    // The story starts on floor 0 of the tower, in the tutorial's cell; the
    // gate at the end of it lets out at the Foot, the door every district reaches.
    expect(fresh.spot).toBe('f0_cell');
    expect(fresh.discovered).toEqual(['f0_cell']);
  });
});

describe('the moons', () => {
  const middle = (t: number) => clockOf(t).moons.find((m) => m.id === 'middle_moon')!;

  it('three moons: 79 days largest, 28 days medium, 37 days smallest', () => {
    expect(MOONS.map((m) => [m.cycleDays, m.size])).toEqual([
      [79, 'large'],
      [28, 'medium'],
      [37, 'small'],
    ]);
    expect(clockOf(0).moons.map((m) => m.id)).toEqual(MOONS.map((m) => m.id));
  });

  it('all three are new at the epoch', () => {
    for (const m of clockOf(0).moons) {
      expect(m.phase).toBe(0);
      expect(m.phaseId).toBe('new');
      expect(m.illumination).toBe(0);
    }
  });

  it('the phase is a pure function of the tick', () => {
    for (const t of [0, at(3, 7, 15), at(200, 23, 59), at(DAYS_PER_YEAR * 5 + 41, 12)]) {
      expect(clockOf(t).moons).toEqual(clockOf(t).moons);
      for (const m of clockOf(t).moons) {
        expect(m.phase).toBeGreaterThanOrEqual(0);
        expect(m.phase).toBeLessThan(1);
      }
    }
  });

  it('each moon wraps at its cycle length', () => {
    // Days 0..90 hold no holy day, so absolute days are month-days here.
    for (const [i, moon] of MOONS.entries()) {
      for (let d = 0; d + moon.cycleDays <= 90; d += 3) {
        const a = clockOf(at(d, 13, 20)).moons[i];
        const b = clockOf(at(d + moon.cycleDays, 13, 20)).moons[i];
        expect(b.phase, `${moon.id} day ${d}`).toBeCloseTo(a.phase, 9);
        expect(b.phaseId).toBe(a.phaseId);
      }
      expect(clockOf(at(moon.cycleDays) - 1).moons[i].phase).toBeGreaterThan(0.99);
      expect(clockOf(at(moon.cycleDays)).moons[i].phase).toBe(0);
    }
  });

  it('the 28-day moon opens every month new, for years', () => {
    for (let d = 0; d < DAYS_PER_YEAR * 3; d++) {
      const c = clockOf(at(d, 6));
      if (c.dayOfMonth === 1) expect(middle(at(d)).phaseId, `day ${d}`).toBe('new');
      if (c.dayOfMonth === 8) expect(middle(at(d)).phaseId).toBe('first_quarter');
      if (c.dayOfMonth === 15) expect(middle(at(d)).phaseId).toBe('full');
      if (c.dayOfMonth === 22) expect(middle(at(d)).phaseId).toBe('last_quarter');
    }
  });

  it('a holy day holds every moon; the 28-day moon sits on a principal phase', () => {
    const expected = ['first_quarter', 'full', 'last_quarter', 'new'];
    HOLY_DAY_INDICES.forEach((day, q) => {
      const dawn = clockOf(at(day));
      const dusk = clockOf(at(day, 23, 59));
      expect(dusk.moons).toEqual(dawn.moons);
      expect(middle(at(day)).phaseId).toBe(expected[q]);
      // The day after picks up exactly where the holy day held.
      expect(clockOf(at(day + 1)).moons).toEqual(dawn.moons);
    });
  });

  it('names the 28-day cycle one principal day per quarter, six between', () => {
    const counts: Record<string, number> = {};
    for (let d = 0; d < 28; d++) {
      const id = middle(at(d, 12)).phaseId;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    expect(counts).toEqual(
      Object.fromEntries(MOON_PHASES.map((p, i) => [p.id, i % 2 === 0 ? 1 : 6])),
    );
    expect(middle(at(14)).illumination).toBeCloseTo(1, 9);
    expect(middle(at(14)).phaseName).toBe('full moon');
  });

  it('adds nothing to the save: a round trip keeps the save and the sky identical', () => {
    const state = createInitialState(1);
    state.totalTicks = at(DAYS_PER_YEAR + 200, 21, 30);
    const json = serialize(state, 1_000);
    expect(json).not.toMatch(/"moons?"\s*:/);
    const loaded = deserialize(json);
    expect(serialize(loaded, 1_000)).toBe(json);
    expect(clockOf(loaded.totalTicks).moons).toEqual(clockOf(state.totalTicks).moons);
  });
});
