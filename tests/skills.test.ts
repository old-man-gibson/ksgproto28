// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import type { ProgressionBand } from '../src/core/types';
import { settleLevels } from '../src/core/systems/progression';
import { createInitialState } from '../src/core/state';
import { collectModifiers, getDerivedStats } from '../src/core/systems/derived';
import { Game } from '../src/core/game';
import {
  checkDiscovery,
  grantSkillXp,
  noveltyRemaining,
  skillXpNeeded,
  hintedSkills,
  skillTreeByCategory,
} from '../src/core/systems/skills';
import { recordKill } from '../src/core/systems/bestiary';
import { acceptQuest, turnInQuest } from '../src/core/systems/quests';
import { NPCS, QUESTS, SKILLS } from '../src/core/registry';

function newGame(seed = 42) {
  const game = new Game(createInitialState(seed));
  return game;
}

const KATANA_UID = 2;

/**
 * A skill's yield for something never seen: k/c, read from the spec rather than
 * written down here, so retuning a curve in skills.data.ts stays a one-file
 * change instead of a test failure.
 */
function opening(skillId: string): number {
  const spec = SKILLS[skillId].novelty!;
  return spec.k / spec.c;
}

/** Arm with a katana — the sword schools are gated on that sub-family, not on any sword. */
function armKatana(g: Game): void {
  g.state.attrs.dex.level = Math.max(g.state.attrs.dex.level, 8); // katana requirement
  if (!g.state.inventory.some((i) => i.uid === KATANA_UID)) {
    g.state.inventory.push({ uid: KATANA_UID, defId: 'katana', slots: 1, runes: [] });
  }
  g.equip(KATANA_UID);
}

describe('banded xp curves', () => {
  it('different skills cost differently at the same level', () => {
    // Runecarving is a craft you pay full price for from day one; Fighting is
    // where everyone starts.
    expect(skillXpNeeded('runecarving', 1)).toBeGreaterThan(skillXpNeeded('fighting', 1));
  });

  it('a band boundary is a wall, never a discount', () => {
    // Fighting steps beginner → novice at 20: the level costs more the moment
    // the tier turns over, and the curve keeps climbing after it.
    expect(skillXpNeeded('fighting', 20)).toBeGreaterThan(skillXpNeeded('fighting', 19) * 1.5);
    for (let level = 1; level < 80; level++) {
      expect(skillXpNeeded('fighting', level + 1)).toBeGreaterThan(skillXpNeeded('fighting', level));
    }
  });

  it('a skill that only changes rate has no wall, just a steeper climb', () => {
    // Runecarving holds one base and slows fast → normal → slow → glacial, so
    // crossing a band bends the curve without a step in it.
    const step = (l: number) => skillXpNeeded('runecarving', l + 1) / skillXpNeeded('runecarving', l);
    expect(skillXpNeeded('runecarving', 20) / skillXpNeeded('runecarving', 19)).toBeLessThan(1.3);
    expect(step(60)).toBeGreaterThan(step(10));
  });

  it('hunting pays to enter its second tier, then levels faster than before', () => {
    // Base adept → expert at 25 (the wall), rate slow → fast (the payoff).
    expect(skillXpNeeded('hunting', 25)).toBeGreaterThan(skillXpNeeded('hunting', 24) * 1.5);
    const before = skillXpNeeded('hunting', 20) / skillXpNeeded('hunting', 19);
    const after = skillXpNeeded('hunting', 40) / skillXpNeeded('hunting', 39);
    expect(after).toBeLessThan(before);
  });

  it('a broken curve stalls instead of running away', () => {
    // A cost of NaN/0/Infinity means the curve is not intact. The XP stays
    // banked; what must never happen is six figures of levels in one call.
    for (const bands of [
      [{ from: 1, base: 'nonsense', rate: 'normal' }],
      // A broken rate only shows up from level 2, since level 1 multiplies an
      // empty product — so this one stalls a level in rather than immediately.
      [{ from: 1, base: 'beginner', rate: 'nonsense' }],
    ] as unknown as ProgressionBand[][]) {
      const p = { level: 1, xp: 1e9 };
      expect(settleLevels(p, bands)).toBeLessThanOrEqual(1);
      expect(p.xp).toBeGreaterThan(1e9 - 100); // the bank is intact
    }
  });

  it('caps how many levels one grant can award', () => {
    // Even a degenerate 1-XP-per-level curve cannot empty a huge bank in one
    // tick; the remainder settles later instead of landing in the save at once.
    const cheap = [{ from: 1, base: 'beginner', rate: 'fast' }] as ProgressionBand[];
    const p = { level: 1, xp: 1e9 };
    expect(settleLevels(p, cheap)).toBeLessThanOrEqual(1000);
    expect(p.level).toBeLessThanOrEqual(1001);
  });

  it('grants level up against the skill’s own curve', () => {
    const g = newGame();
    g.state.skills.runecarving = { level: 1, xp: 0 };
    g.state.skills.fighting = { level: 1, xp: 0 };
    const cheap = skillXpNeeded('fighting', 1);
    // 'runecarving', not 'craft'. It was the bare tag, which every craft skill
    // once claimed — so this test would now hand runecarving nothing at all and
    // go on passing, guarding the band costs it was written to guard against
    // exactly nothing.
    grantSkillXp(g.state, g.bus, ['runecarving'], cheap);
    grantSkillXp(g.state, g.bus, ['combat'], cheap);
    expect(g.state.skills.fighting.level).toBe(2);
    expect(g.state.skills.runecarving.xp).toBeGreaterThan(0); // it really landed
    expect(g.state.skills.runecarving.level).toBe(1); // same XP, costlier craft
  });
});

describe('skill discovery & branching', () => {
  it('discovers Fighting on first combat-tagged action with no prerequisites', () => {
    const g = newGame();
    expect(g.state.skills.fighting).toBeUndefined();
    checkDiscovery(g.state, g.bus, ['combat']);
    expect(g.state.skills.fighting).toBeDefined();
    expect(g.state.skills.fighting.level).toBe(1);
  });

  it('does not discover Swordsmanship without Fighting 10 + equipped sword', () => {
    const g = newGame();
    checkDiscovery(g.state, g.bus, ['combat', 'sword']);
    expect(g.state.skills.swordsmanship).toBeUndefined();

    // Fighting 10 but bare-handed: still locked.
    g.state.skills.fighting = { level: 10, xp: 0 };
    checkDiscovery(g.state, g.bus, ['combat', 'sword']);
    expect(g.state.skills.swordsmanship).toBeUndefined();
  });

  it('unlocks the full branch chain when conditions are met', () => {
    const g = newGame();
    g.state.skills.fighting = { level: 10, xp: 0 };
    g.equip(1); // starting rusty sword
    checkDiscovery(g.state, g.bus, ['combat', 'sword']);
    expect(g.state.skills.swordsmanship).toBeDefined();

    // Ittou-ryu is a school: it manifests from its own stance tag, and wants
    // Swordsmanship 25 + DEX 20 + a katana in hand.
    g.state.skills.swordsmanship.level = 25;
    g.state.attrs.dex.level = 20;
    // Practice flows up the tree: the school's stance tag AND the sword its
    // parent chain claims.
    checkDiscovery(g.state, g.bus, ['combat', 'sword', 'style:quick']);
    expect(g.state.skills.school_ittou_ryu).toBeUndefined(); // no katana yet

    armKatana(g);
    // Practice flows up the tree: the school's stance tag AND the sword its
    // parent chain claims.
    checkDiscovery(g.state, g.bus, ['combat', 'sword', 'style:quick']);
    expect(g.state.skills.school_ittou_ryu).toBeDefined();
  });

  it('skills gain xp only from matching tags and level up', () => {
    const g = newGame();
    g.state.skills.fighting = { level: 1, xp: 0 };
    grantSkillXp(g.state, g.bus, ['explore'], 100);
    expect(g.state.skills.fighting.xp).toBe(0);

    grantSkillXp(g.state, g.bus, ['combat'], skillXpNeeded('fighting', 1) + skillXpNeeded('fighting', 2));
    expect(g.state.skills.fighting.level).toBeGreaterThanOrEqual(2);
  });

  it('hints children of known skills', () => {
    const g = newGame();
    g.state.skills.fighting = { level: 1, xp: 0 };
    const hints = hintedSkills(g.state);
    expect(hints).toContain('swordsmanship');
    expect(hints).toContain('unarmed_combat');
    expect(hints).not.toContain('arcana'); // parent (magic) unknown
  });
});

describe('categorized skill tree', () => {
  it('nests branches and hints correctly; undiscovered roots stay hidden', () => {
    const g = newGame();
    g.state.skills.fighting = { level: 30, xp: 0 };
    g.state.skills.swordsmanship = { level: 30, xp: 0 };
    g.state.skills.school_ittou_ryu = { level: 5, xp: 0 };

    const sections = skillTreeByCategory(g.state);
    expect(sections.map((s) => s.category.id)).toEqual(['combat']); // magic/resistances undiscovered

    const combat = sections[0];
    const fighting = combat.nodes.find((n) => n.def.id === 'fighting')!;
    expect(fighting.state).toBe('unlocked');

    const sword = fighting.children.find((c) => c.def.id === 'swordsmanship')!;
    expect(sword.state).toBe('unlocked');
    const ittou = sword.children.find((c) => c.def.id === 'school_ittou_ryu')!;
    expect(ittou.state).toBe('unlocked');

    // Locked children of known parents are hinted with no visible subtree.
    const unarmed = fighting.children.find((c) => c.def.id === 'unarmed_combat')!;
    expect(unarmed.state).toBe('hinted');
    expect(unarmed.children).toEqual([]);
  });

  it('discovered resistances and crafting show as their own sections', () => {
    const g = newGame();
    g.state.skills.heat_resistance = { level: 3, xp: 0 };
    g.state.skills.smithing = { level: 2, xp: 0 };
    const ids = skillTreeByCategory(g.state).map((s) => s.category.id);
    expect(ids).toEqual(['resistance', 'craft']);
  });
});

describe('practice only flows upward', () => {
  /** Every combat skill known, so nothing is missing merely because it's locked. */
  function veteran(seed = 5): Game {
    const g = newGame(seed);
    for (const id of [
      'fighting', 'swordsmanship', 'ittou_ryu', 'unarmed_combat', 'dagger_combat',
      'bow_combat', 'club_combat', 'shield_combat', 'school_jigen_ryu', 'magic',
    ]) {
      g.state.skills[id] = { level: 1, xp: 0 };
    }
    return g;
  }

  it('a club fight trains Club Combat and Fighting, and nothing sideways', () => {
    const g = veteran();
    grantSkillXp(g.state, g.bus, ['combat', 'hunt', 'blunt'], 500);
    expect(g.state.skills.club_combat.xp).toBeGreaterThan(0);
    expect(g.state.skills.fighting.xp).toBeGreaterThan(0);
    for (const idle of ['swordsmanship', 'ittou_ryu', 'unarmed_combat', 'dagger_combat', 'bow_combat']) {
      expect(g.state.skills[idle].xp, `${idle} should learn nothing from a club`).toBe(0);
    }
  });

  it('sword schools only train through the branch that leads to them', () => {
    const g = veteran(6);
    // Crushing with a club: the stance matches, the weapon does not.
    grantSkillXp(g.state, g.bus, ['combat', 'hunt', 'blunt', 'style:crush'], 500);
    expect(g.state.skills.school_jigen_ryu.xp).toBe(0);

    grantSkillXp(g.state, g.bus, ['combat', 'hunt', 'sword', 'style:crush'], 500);
    expect(g.state.skills.school_jigen_ryu.xp).toBeGreaterThan(0);
    expect(g.state.skills.swordsmanship.xp).toBeGreaterThan(0); // and up the chain
    expect(g.state.skills.fighting.xp).toBeGreaterThan(0);
  });

  it('casting a spell trains magic, not the blade at your hip', () => {
    const g = veteran(7);
    grantSkillXp(g.state, g.bus, ['combat', 'magic'], 500);
    expect(g.state.skills.magic.xp).toBeGreaterThan(0);
    expect(g.state.skills.fighting.xp).toBeGreaterThan(0);
    expect(g.state.skills.swordsmanship.xp).toBe(0);
  });

  it('kills no longer spray XP across every weapon family', () => {
    const g = veteran(8);
    g.state.spot = 'woods_edge';
    g.equip(1); // rusty sword
    g.selectActivity('hunt');
    for (let i = 0; i < 600; i++) g.tick();
    expect(g.state.skills.swordsmanship.xp + g.state.skills.swordsmanship.level).toBeGreaterThan(1);
    expect(g.state.skills.bow_combat.xp).toBe(0);
    expect(g.state.skills.dagger_combat.xp).toBe(0);
    expect(g.state.skills.unarmed_combat.xp).toBe(0);
  });

  it('sword bonuses stay in the scabbard when the sword does', () => {
    const g = newGame(9);
    g.state.skills.swordsmanship = { level: 40, xp: 0 };
    g.state.skills.ittou_ryu = { level: 20, xp: 0 };
    const bare = getDerivedStats(g.state);
    g.equip(1); // rusty sword
    const armed = getDerivedStats(g.state);
    expect(armed.damage).toBeGreaterThan(bare.damage * 1.5);
    expect(armed.crit).toBeGreaterThan(bare.crit);
  });
});

describe('school mastery only pays while you practise the art', () => {
  function jigenMaster(): Game {
    const g = newGame(31);
    g.state.skills.fighting = { level: 20, xp: 0 };
    g.state.skills.swordsmanship = { level: 30, xp: 0 };
    g.state.skills.school_jigen_ryu = { level: 40, xp: 0 };
    armKatana(g); // the school claims the Crush slot, and its bonus needs a katana
    return g;
  }

  it('the school bonus lapses in any other stance', () => {
    const g = jigenMaster();
    g.setStyle('crush'); // becomes Jigen-ryu in hand
    const practising = getDerivedStats(g.state).damage;
    g.setStyle('quick');
    const elsewhere = getDerivedStats(g.state).damage;
    // Both stances change damage, so compare the school's own line instead.
    const line = (state: typeof g.state) =>
      collectModifiers(state).filter((m) => (m.source ?? "").startsWith('Jigen-ryu Lv')).length;
    expect(practising).toBeGreaterThan(0);
    expect(elsewhere).toBeGreaterThan(0);
    g.setStyle('crush');
    expect(line(g.state)).toBe(1);
    g.setStyle('quick');
    expect(line(g.state)).toBe(0);
  });

  it('Swordsmanship still pays with any sword, in any stance', () => {
    const g = jigenMaster();
    g.setStyle('quick');
    const swordLine = collectModifiers(g.state).filter((m) => (m.source ?? "").startsWith('Swordsmanship'));
    expect(swordLine.length).toBeGreaterThan(0);
    g.unequip('weapon');
    expect(collectModifiers(g.state).filter((m) => (m.source ?? "").startsWith('Swordsmanship')).length).toBe(0);
  });
});


describe('novelty learning', () => {
  /**
   * High levels so a grant is never eaten by a level-up — these tests measure
   * what a payout is worth, not what it buys.
   */
  function hunter(): Game {
    const g = newGame();
    g.state.skills.hunting = { level: 40, xp: 0 };
    g.state.skills.fighting = { level: 40, xp: 0 };
    return g;
  }

  /** XP that one grant actually delivered to a skill. */
  function gained(g: Game, skill: string, grant: () => void): number {
    const before = g.state.skills[skill].xp;
    grant();
    return g.state.skills[skill].xp - before;
  }

  it('a first sighting is worth k/c times a worn-out one', () => {
    const g = hunter();
    const first = gained(g, 'hunting', () => grantSkillXp(g.state, g.bus, ['hunt'], 10, 'wolf'));
    for (let i = 0; i < 2000; i++) grantSkillXp(g.state, g.bus, ['hunt'], 10, 'wolf');
    const worn = gained(g, 'hunting', () => grantSkillXp(g.state, g.bus, ['hunt'], 10, 'wolf'));

    // k/c = 20/2 is the exact ceiling, approached from below as the worn-out
    // yield settles onto its floor of 1.
    expect(first / worn).toBeLessThanOrEqual(opening('hunting'));
    expect(first / worn).toBeGreaterThan(opening('hunting') * 0.95);
  });

  it('decays towards the floor without ever reaching it', () => {
    const g = hunter();
    for (let i = 0; i < 400; i++) grantSkillXp(g.state, g.bus, ['hunt'], 10, 'wolf');
    const worn = noveltyRemaining(g.state, 'hunting', 'wolf');
    expect(worn).toBeLessThan(1.1); // all but exhausted
    expect(worn).toBeGreaterThan(1); // but a kill still teaches something
  });

  it('counts each input separately, so a new species is fresh again', () => {
    const g = hunter();
    for (let i = 0; i < 50; i++) grantSkillXp(g.state, g.bus, ['hunt'], 10, 'wolf');
    expect(noveltyRemaining(g.state, 'hunting', 'wolf')).toBeLessThan(1.5);
    expect(noveltyRemaining(g.state, 'hunting', 'bear')).toBeCloseTo(opening('hunting'), 5);
  });

  it('leaves drill skills alone — Fighting never tires of wolves', () => {
    const g = hunter();
    const grant = () => grantSkillXp(g.state, g.bus, ['combat', 'hunt'], 10, 'wolf');
    const first = gained(g, 'fighting', grant);
    const tenth = gained(g, 'fighting', grant);
    expect(tenth).toBeCloseTo(first, 5);
  });

  it('an unattributed payout pays the floor, never the novelty bonus', () => {
    const g = hunter();
    const anonymous = gained(g, 'hunting', () => grantSkillXp(g.state, g.bus, ['hunt'], 10));
    const attributed = gained(g, 'hunting', () => grantSkillXp(g.state, g.bus, ['hunt'], 10, 'wolf'));
    expect(anonymous * 10).toBeCloseTo(attributed, 5);
  });

  it('filling in the bestiary pays out on top of whatever the kill was worth', () => {
    const g = hunter();
    const opening = gained(g, 'hunting', () => recordKill(g.state, g.bus, 'goblin'));
    const repeat = gained(g, 'hunting', () => recordKill(g.state, g.bus, 'goblin'));
    // A new species is discovery 40 x weight 3; a repeat kill teaches the book
    // nothing by itself.
    expect(opening).toBeGreaterThanOrEqual(120);
    expect(repeat).toBeLessThan(opening);
  });

  it('a locked skill banks no novelty, so nothing is spent before it exists', () => {
    const g = newGame();
    grantSkillXp(g.state, g.bus, ['hunt'], 10, 'wolf');
    expect(g.state.novelty.hunting).toBeUndefined();
  });
});

describe('speechcraft: novelty from people, payout from finishing', () => {
  /** At a spot with a questgiver, ready to take work. */
  function talker(): Game {
    const g = newGame();
    const quest = QUESTS.first_posting;
    g.state.spot = NPCS[quest.giver].spotId;
    return g;
  }

  it('manifests on the first exchange, with nothing before it', () => {
    const g = talker();
    expect(g.state.skills.speechcraft).toBeUndefined();
    acceptQuest(g.state, g.bus, 'first_posting');
    expect(g.state.skills.speechcraft).toBeDefined();
  });

  it('wears out per person, not per job', () => {
    const g = talker();
    acceptQuest(g.state, g.bus, 'first_posting');
    const giver = QUESTS.first_posting.giver;
    // The giver is what was spent, so their NEXT job teaches less...
    expect(noveltyRemaining(g.state, 'speechcraft', giver)).toBeLessThan(opening('speechcraft'));
    // ...while anyone not yet spoken to is still worth the full opening.
    expect(noveltyRemaining(g.state, 'speechcraft', 'elder_maren')).toBeCloseTo(
      opening('speechcraft'),
      5,
    );
  });

  it('falls off harder than hunting does', () => {
    const speech = SKILLS.speechcraft.novelty!;
    const hunt = SKILLS.hunting.novelty!;
    const after = (s: typeof speech, n: number) => (s.k + n) / (s.c + n) / (s.k / s.c);
    // Same number of repeats, more of the novelty gone.
    expect(after(speech, 4)).toBeLessThan(after(hunt, 4));
  });

  it('pays more for turning work in than for taking it on', () => {
    const g = talker();
    g.state.skills.speechcraft = { level: 40, xp: 0 };
    const accepted = g.state.skills.speechcraft.xp;
    acceptQuest(g.state, g.bus, 'first_posting');
    const onAccept = g.state.skills.speechcraft.xp - accepted;

    const quest = QUESTS.first_posting;
    g.state.quests.first_posting.progress = quest.objectives.map(() => 999);
    g.state.stats['kills'] = 999;
    const before = g.state.skills.speechcraft.xp;
    turnInQuest(g.state, g.bus, 'first_posting');
    const onTurnIn = g.state.skills.speechcraft.xp - before;

    expect(onTurnIn).toBeGreaterThan(onAccept);
  });
});
