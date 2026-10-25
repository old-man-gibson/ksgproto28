import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { NPCS, SKILLS } from '../src/core/registry';
import { lessonState, schoolTaughtKey, schoolTeacher } from '../src/core/systems/martial';
import { checkDiscovery } from '../src/core/systems/skills';
import type { SchoolLesson } from '../src/core/types';

// Magic Combat is taught, not found (user, 2026-10-25): Old Brannoc's school
// lesson stamps taught:school_magic_combat and manifests the skill, and
// fighting in Finesse no longer manifests it on its own.

const fresh = (seed = 1) => new Game(createInitialState(seed));
const SCHOOL = 'school_magic_combat';
const lessonOf = () =>
  NPCS.hall_tutor.teaches!.find((l): l is SchoolLesson => 'school' in l && l.school === SCHOOL)!;

/** A player who meets every old manifest condition: Fighting 10, Magic 10, INT 20. */
function qualified() {
  const g = fresh();
  g.state.skills.fighting = { level: 10, xp: 0 };
  g.state.skills.magic = { level: 10, xp: 0 };
  g.state.attrs.int.level = 20;
  return g;
}

describe('Magic Combat is taught by Old Brannoc', () => {
  it('no longer manifests from fighting in Finesse, however qualified', () => {
    const g = qualified();
    checkDiscovery(g.state, g.bus, SKILLS[SCHOOL].tags ?? []);
    expect(g.state.skills[SCHOOL]).toBeUndefined();
  });

  it('the lesson is held until the old conditions hold, then manifests the school', () => {
    const g = fresh();
    expect(lessonState(g.state, lessonOf())).toBe('held');
    expect(g.learnSchoolFromTeacher('hall_tutor', SCHOOL)).toBe(false);
    expect(g.state.skills[SCHOOL]).toBeUndefined();

    const q = qualified();
    expect(lessonState(q.state, lessonOf())).toBe('open');
    expect(q.learnSchoolFromTeacher('hall_tutor', SCHOOL)).toBe(true);
    expect(q.state.skills[SCHOOL]?.level).toBe(1);
    expect(q.state.stats[schoolTaughtKey(SCHOOL)]).toBe(1);
    expect(lessonState(q.state, lessonOf())).toBe('taught');
    expect(q.state.log.some((l) => l.msg.includes('Old Brannoc') && l.msg.includes('Magic Combat'))).toBe(true);
  });

  it('is refused twice, and refused by anyone who does not teach it', () => {
    const g = qualified();
    expect(g.learnSchoolFromTeacher('hall_quartermaster', SCHOOL)).toBe(false);
    expect(g.learnSchoolFromTeacher('hall_tutor', SCHOOL)).toBe(true);
    expect(g.learnSchoolFromTeacher('hall_tutor', SCHOOL)).toBe(false);
  });

  it('a save that already manifested it keeps it, and the lesson reads as taught', () => {
    const g = fresh();
    g.state.skills[SCHOOL] = { level: 7, xp: 0 };
    expect(lessonState(g.state, lessonOf())).toBe('taught');
  });

  it('the skill tree can name who teaches it', () => {
    expect(schoolTeacher(SCHOOL)?.npcId).toBe('hall_tutor');
  });
});
