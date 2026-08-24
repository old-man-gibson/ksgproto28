import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { EventBus } from '../src/core/engine/events';
import { clockOf, TICKS_PER_DAY } from '../src/core/systems/clock';
import {
  CHRONOSENSE_ID,
  CHRONOSENSE_MANIFEST_TICKS,
  describeTimeSense,
  SENSE_LEVELS,
  tickChronosense,
  timePenaltyMult,
} from '../src/core/systems/chronosense';
import { grantSkillXp, raiseSkillCap, skillCap } from '../src/core/systems/skills';
import { SKILLS } from '../src/core/registry';

const at = (d: number, h = 0, m = 0) => (d * 1440 + h * 60 + m) * 10;

function world(totalTicks: number) {
  const state = createInitialState();
  state.totalTicks = totalTicks;
  return { state, bus: new EventBus() };
}

describe('chronosense manifests from lived time alone', () => {
  it('is registered content with tier names matching the sense ladder', () => {
    const def = SKILLS[CHRONOSENSE_ID];
    expect(def).toBeDefined();
    expect(def.tierNames?.map((t) => t.level)).toEqual(Object.values(SENSE_LEVELS));
  });

  it('stays dormant before a full day, wakes after one', () => {
    const early = world(CHRONOSENSE_MANIFEST_TICKS - 1);
    tickChronosense(early.state, early.bus);
    expect(early.state.skills[CHRONOSENSE_ID]).toBeUndefined();

    const ready = world(CHRONOSENSE_MANIFEST_TICKS);
    tickChronosense(ready.state, ready.bus);
    expect(ready.state.skills[CHRONOSENSE_ID]).toEqual({ level: 1, xp: 0 });
    expect(CHRONOSENSE_MANIFEST_TICKS).toBe(TICKS_PER_DAY);
  });

  it('drinks XP once per game minute, not per tick', () => {
    const { state, bus } = world(TICKS_PER_DAY + 10);
    state.skills[CHRONOSENSE_ID] = { level: 1, xp: 0 };
    tickChronosense(state, bus); // tick divisible by 10 — a minute boundary
    const afterMinute = state.skills[CHRONOSENSE_ID].xp;
    expect(afterMinute).toBeGreaterThan(0);

    state.totalTicks += 1; // mid-minute
    tickChronosense(state, bus);
    expect(state.skills[CHRONOSENSE_ID].xp).toBe(afterMinute);
  });
});

describe('the sense ladder', () => {
  const noon = clockOf(at(12, 9, 23)); // Sixthday, 13th of First Month, 09:23

  it('does not exist below level 1', () => {
    expect(describeTimeSense(noon, 0)).toBeNull();
  });

  it('accretes precision level by level', () => {
    expect(describeTimeSense(noon, SENSE_LEVELS.daypart)).toBe('Morning');
    expect(describeTimeSense(noon, SENSE_LEVELS.season)).toBe('Morning · winter');
    expect(describeTimeSense(noon, SENSE_LEVELS.bell)).toBe('about 09:00 · winter');
    expect(describeTimeSense(noon, SENSE_LEVELS.weekday)).toBe('Sixthday · about 09:00 · winter');
    expect(describeTimeSense(noon, SENSE_LEVELS.date)).toBe(
      'Sixthday, 13th of First Month, Year 1 · about 09:00',
    );
    expect(describeTimeSense(noon, SENSE_LEVELS.minute)).toBe(
      'Sixthday, 13th of First Month, Year 1 · 09:23',
    );
  });

  it('a holy day is felt before it can be named', () => {
    const solstice = clockOf(at(183, 12));
    expect(describeTimeSense(solstice, SENSE_LEVELS.season)).toBe('Midday · summer · a holy day');
    expect(describeTimeSense(solstice, SENSE_LEVELS.date)).toBe(
      'Summer Solstice, Year 1 · about 12:00',
    );
  });
});

describe('the ceiling at 20', () => {
  it('is declared on the skill', () => {
    expect(SKILLS[CHRONOSENSE_ID].maxLevel).toBe(20);
    // The minute tier deliberately sits past it: exact time is raised-cap
    // content, not patience content.
    expect(SENSE_LEVELS.minute).toBeGreaterThan(20);
  });

  it('discards XP at the cap instead of banking it', () => {
    const { state, bus } = world(0);
    state.skills[CHRONOSENSE_ID] = { level: 20, xp: 0 };
    grantSkillXp(state, bus, ['time'], 10_000);
    expect(state.skills[CHRONOSENSE_ID]).toMatchObject({ level: 20, xp: 0 });
  });

  it('a grant that crosses the cap stops there and forfeits the overflow', () => {
    const { state, bus } = world(0);
    state.skills[CHRONOSENSE_ID] = { level: 19, xp: 0 };
    grantSkillXp(state, bus, ['time'], 1_000_000);
    expect(state.skills[CHRONOSENSE_ID]).toMatchObject({ level: 20, xp: 0 });
  });

  it('a raised cap opens the road again, then closes at the new ceiling', () => {
    const { state, bus } = world(0);
    state.skills[CHRONOSENSE_ID] = { level: 20, xp: 0 };
    expect(skillCap(state, CHRONOSENSE_ID)).toBe(20);
    raiseSkillCap(state, bus, CHRONOSENSE_ID, 5);
    expect(skillCap(state, CHRONOSENSE_ID)).toBe(25);
    grantSkillXp(state, bus, ['time'], 1_000_000);
    expect(state.skills[CHRONOSENSE_ID]).toMatchObject({ level: 25, xp: 0 });
  });

  it('uncapped skills are untouched by all of this', () => {
    const { state, bus } = world(0);
    state.skills.fighting = { level: 90, xp: 0 };
    expect(skillCap(state, 'fighting')).toBe(Infinity);
    raiseSkillCap(state, bus, 'fighting', 5);
    expect(state.skills.fighting.capRaised).toBeUndefined();
  });
});

describe('time-resistance past the ceiling', () => {
  it('grants nothing at or below the base cap', () => {
    expect(timePenaltyMult(1)).toBe(1);
    expect(timePenaltyMult(20)).toBe(1);
  });

  it('follows the schedule: 1% a level, 3% on decades, 5% extra at 50/75/100', () => {
    expect(timePenaltyMult(21)).toBeCloseTo(0.99, 10);
    expect(timePenaltyMult(30)).toBeCloseTo(0.99 ** 9 * 0.97, 10);
    expect(timePenaltyMult(50)).toBeCloseTo(0.99 ** 27 * 0.97 ** 3 * 0.95, 10);
    expect(timePenaltyMult(75)).toBeCloseTo(0.99 ** 50 * 0.97 ** 5 * 0.95 ** 2, 10);
    expect(timePenaltyMult(100)).toBeCloseTo(0.99 ** 72 * 0.97 ** 8 * 0.95 ** 3, 10);
  });

  it('the full ladder shaves roughly two thirds off a time penalty', () => {
    const remaining = timePenaltyMult(100);
    expect(remaining).toBeGreaterThan(0.3);
    expect(remaining).toBeLessThan(0.35);
  });
});
