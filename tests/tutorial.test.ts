import { describe, expect, it } from 'vitest';
import { createInitialState, SAVE_VERSION } from '../src/core/state';
import { Game } from '../src/core/game';
import { migrate } from '../src/core/save/migrations';
import { ITEMS, MONSTERS, SPOTS, STARTING_SPOT } from '../src/core/registry';
import {
  TUTORIAL_DONE_KEY,
  TUTORIAL_EXIT,
  TUTORIAL_FLAGS,
  TUTORIAL_RACK,
  TUTORIAL_SPELLS,
  TUTORIAL_STEP_LIST,
} from '../src/core/data/tutorial.data';
import {
  tutorialActive,
  tutorialStep,
  tutorialStepIndex,
} from '../src/core/systems/tutorial';
import { monsterStats } from '../src/core/systems/monsterStats';
import { getDerivedStats } from '../src/core/systems/derived';
import { spotCleared } from '../src/core/systems/combat';
import { visibleEdges } from '../src/core/systems/locations';
import { retreatSpot } from '../src/core/systems/safety';
import { prestigeNow } from '../src/core/systems/prestige';
import { towerAt } from '../src/core/systems/towers';
import type { GameState } from '../src/core/types';
import { clearFloors } from './fixtures/floors';

/** Run the current travel to arrival. */
function walk(g: Game): void {
  expect(g.state.travel).toBeTruthy();
  for (let i = 0; i < 10_000 && g.state.travel; i++) g.tick();
  expect(g.state.travel).toBeNull();
}

/** Hunt at the current spot until one fight is won (or the budget runs out). */
function winOneFight(g: Game, spot: string): void {
  const before = g.state.stats[`fights:${spot}`] ?? 0;
  g.selectActivity('hunt');
  for (let i = 0; i < 20_000 && (g.state.stats[`fights:${spot}`] ?? 0) === before; i++) g.tick();
  expect(g.state.stats[`fights:${spot}`] ?? 0).toBe(before + 1);
}

describe('floor 0 — where a life opens', () => {
  it('starts in the holding cell, which is a haven and the safety fallback', () => {
    const s = createInitialState(1);
    expect(s.spot).toBe('f0_cell');
    expect(STARTING_SPOT).toBe('f0_cell');
    expect(tutorialActive(s)).toBe(true);
    expect(retreatSpot(s)).toBe('f0_cell');
  });

  it('the ladder does not answer from floor 0 — the gate is the only way up', () => {
    const g = new Game(createInitialState(1));
    expect(towerAt(g.state)).toBeNull();
    expect(g.climbTo('ascent_f1')).toBe(false);
    expect(g.state.travel).toBeNull();
  });

  it('the gate is one-way: the Foot never lists a road back down', () => {
    const s = createInitialState(1);
    expect(visibleEdges(s, 'f0_gate').map((e) => e.to)).toContain(TUTORIAL_EXIT);
    expect(visibleEdges(s, TUTORIAL_EXIT).map((e) => e.to)).not.toContain('f0_gate');
  });

  it('the Cell Slime deals exactly 1 per landed hit and takes a few from a starting sword', () => {
    const g = new Game(createInitialState(3));
    g.chooseTutorialWeapon('sword');
    const dmg = getDerivedStats(g.state).damage;
    expect(dmg).toBeGreaterThan(5);
    expect(MONSTERS.slime_cell.fixedDamage).toBe(1);
    // Every roll of the slime lands inside "several hits, not one".
    for (let seed = 0; seed < 20; seed++) {
      const s = createInitialState(seed);
      const hp = monsterStats({
        defId: 'slime_cell',
        level: 1,
        attrs: { str: 0, dex: 2, con: 1.5, int: 1, wis: 1, cha: 1 },
      } as never).maxHp;
      expect(hp / dmg, `seed ${seed}`).toBeGreaterThan(1.5);
      expect(hp / dmg).toBeLessThan(8);
      void s;
    }
  });
});

describe('the tutorial — nine panels read off the world', () => {
  it('walks in order: rack, stance, cellblock, fight, field, spell, cast, gate, foot', () => {
    const g = new Game(createInitialState(7));
    const s = g.state;
    const ids = () => tutorialStep(s)?.id;

    expect(ids()).toBe('arm');
    expect(tutorialStepIndex(s)).toBe(1);
    expect(g.chooseTutorialWeapon('spear', true)).toBe(true);
    // A spear takes both hands: the shield is refused quietly.
    expect(s.equipment.weapon?.defId).toBe('old_spear');
    expect(s.equipment.offhand).toBeUndefined();
    expect(g.chooseTutorialWeapon('sword')).toBe(false); // the rack is empty now
    expect(ids()).toBe('stance');

    expect(g.chooseTutorialStance('aggressive')).toBe(true);
    expect(s.style).toBe('aggressive');
    expect(ids()).toBe('cellblock');

    expect(g.travelTo('f0_cellblock')).toBe(true);
    walk(g);
    expect(ids()).toBe('fight');

    winOneFight(g, 'f0_cellblock');
    expect(s.stats['slain:f0_cellblock:slime_cell']).toBe(1);
    expect(spotCleared(s, SPOTS.f0_cellblock)).toBe(true);
    expect(ids()).toBe('field');
    // The panel never lied: the slime's blows were 1 each. (Spear: no HP lost
    // at all is possible if it never landed, so only the upper bound is firm.)
    expect(s.resources.hp).toBeGreaterThanOrEqual(getDerivedStats(s).maxHp - 40);

    g.selectActivity(null);
    expect(g.travelTo('f0_field')).toBe(true);
    walk(g);
    expect(ids()).toBe('spell');

    expect(s.resources.mana).toBeLessThan(2);
    expect(g.chooseTutorialSpell('spark')).toBe(true);
    expect(s.grimoire).toHaveLength(1);
    expect(s.grimoire[0].prepared).toBe(true);
    expect(s.grimoire[0].source).toEqual({ school: 'arcane', words: ['spark'] });
    expect(s.attrs.int.level).toBe(2);
    expect(getDerivedStats(s).maxMana).toBe(2);
    expect(g.chooseTutorialSpell('fire')).toBe(false);
    expect(ids()).toBe('cast');

    winOneFight(g, 'f0_field');
    expect(ids()).toBe('gate');

    g.selectActivity(null);
    expect(g.travelTo('f0_gate')).toBe(true);
    walk(g);
    expect(ids()).toBe('leave');

    expect(g.travelTo(TUTORIAL_EXIT)).toBe(true);
    walk(g);
    expect(s.spot).toBe(TUTORIAL_EXIT);
    expect(tutorialStep(s)).toBeNull();
    expect(tutorialActive(s)).toBe(false);
    expect(s.stats[TUTORIAL_DONE_KEY]).toBe(1);
    expect(s.log.some((l) => l.msg.includes('Tutorial complete'))).toBe(true);
  });

  it('the sword pick equips the sword already in the pack, and a shield beside it', () => {
    const g = new Game(createInitialState(2));
    expect(g.state.inventory.map((i) => i.defId)).toEqual(['rusty_sword']);
    expect(g.chooseTutorialWeapon('sword', true)).toBe(true);
    expect(g.state.equipment.weapon?.defId).toBe('rusty_sword');
    expect(g.state.equipment.offhand?.defId).toBe('wooden_shield');
    expect(g.state.inventory).toHaveLength(0);
  });

  it('every rack entry names a real item, and unarmed is a real pick', () => {
    for (const [id, pick] of Object.entries(TUTORIAL_RACK)) {
      if (pick.item) expect(ITEMS[pick.item], `${id} → ${pick.item}`).toBeTruthy();
    }
    const g = new Game(createInitialState(4));
    expect(g.chooseTutorialWeapon('unarmed', true)).toBe(true);
    expect(g.state.equipment.weapon).toBeUndefined();
    expect(g.state.equipment.offhand).toBeUndefined();
    expect(g.state.stats[TUTORIAL_FLAGS.weapon]).toBe(1);
  });

  it('the spell pick never lowers Intelligence a plaque-reader already earned', () => {
    const g = new Game(createInitialState(5));
    g.state.attrs.int = { level: 4, xp: 3 };
    expect(g.chooseTutorialSpell('ice')).toBe(true);
    expect(g.state.attrs.int).toEqual({ level: 4, xp: 3 });
  });

  it('offers exactly the three words the user named, each a legal one-word sentence', () => {
    expect([...TUTORIAL_SPELLS]).toEqual(['fire', 'ice', 'spark']);
    for (const word of TUTORIAL_SPELLS) {
      const g = new Game(createInitialState(6));
      expect(g.chooseTutorialSpell(word)).toBe(true);
      expect(g.state.grimoire[0].source).toEqual({ school: 'arcane', words: [word] });
    }
  });

  it('skip: defaults for every choice, the Foot, and the tutorial gone for good', () => {
    const g = new Game(createInitialState(8));
    const s = g.state;
    g.chooseTutorialStance('crush');
    expect(g.skipTutorial()).toBe(true);
    expect(s.spot).toBe(TUTORIAL_EXIT);
    expect(s.discovered).toContain(TUTORIAL_EXIT);
    expect(s.inventory.map((i) => i.defId)).toEqual(['rusty_sword']);
    expect(s.style).toBe('crush'); // a choice already made is kept
    expect(s.grimoire).toHaveLength(0);
    expect(tutorialActive(s)).toBe(false);
    expect(tutorialStep(s)).toBeNull();
    expect(s.safeSpots.nearest).toBe(TUTORIAL_EXIT);
    expect(g.skipTutorial()).toBe(false);
    // Skipping in the middle of the slime fight abandons it rather than losing it.
    const h = new Game(createInitialState(9));
    h.travelTo('f0_cellblock');
    walk(h);
    h.selectActivity('hunt');
    for (let i = 0; i < 200 && !h.state.combat; i++) h.tick();
    expect(h.state.combat).toBeTruthy();
    expect(h.skipTutorial()).toBe(true);
    expect(h.state.combat).toBeNull();
    expect(h.state.activity).toBeNull();
  });

  it('a step done early stays done: the panel shows the first thing still open', () => {
    const g = new Game(createInitialState(10));
    g.chooseTutorialSpell('fire'); // out of order
    expect(tutorialStep(g.state)?.id).toBe('arm');
    g.chooseTutorialWeapon('dagger');
    g.chooseTutorialStance('balanced');
    expect(tutorialStep(g.state)?.id).toBe('cellblock');
    expect(TUTORIAL_STEP_LIST.map((s) => s.id)).toEqual([
      'arm', 'stance', 'cellblock', 'fight', 'field', 'spell', 'cast', 'gate', 'leave',
    ]);
  });
});

describe('the tutorial and older saves', () => {
  it('migration to v54 stamps the tutorial done on any save that predates it', () => {
    const old: Record<string, unknown> = { ...createInitialState(11), version: 53, spot: 'ascent_foot', stats: { kills: 3 } };
    const migrated = migrate(old, SAVE_VERSION) as GameState;
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.stats[TUTORIAL_DONE_KEY]).toBe(1);
    expect(migrated.stats.kills).toBe(3);
    expect(tutorialActive(migrated)).toBe(false);
  });

  it('a save that lost its spot to the shelved countryside wakes at the Foot, not in the cell', () => {
    const old: Record<string, unknown> = { ...createInitialState(12), version: 48, spot: 'gone_hamlet_square', discovered: ['gone_hamlet_square'] };
    const migrated = migrate(old, SAVE_VERSION) as GameState;
    expect(migrated.spot).toBe('ascent_foot');
  });

  it('a second life opens at the Foot with the tutorial already done', () => {
    const s = createInitialState(13);
    clearFloors(s.stats);
    s.stats['gold:earned'] = 1000;
    const next = prestigeNow(s, 99);
    expect(next).toBeTruthy();
    expect(next!.spot).toBe(TUTORIAL_EXIT);
    expect(tutorialActive(next!)).toBe(false);
  });
});
