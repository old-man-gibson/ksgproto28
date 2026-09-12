// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState, SAVE_VERSION } from '../src/core/state';
import { Game } from '../src/core/game';
import { deserialize } from '../src/core/save/save';
import {
  acceptQuest,
  availableQuests,
  canTurnIn,
  objectiveProgress,
  questComplete,
} from '../src/core/systems/quests';
import { NPCS, QUESTS } from '../src/core/registry';
import type { MonsterInstance } from '../src/core/types';

function killEvent(g: Game, defId: string): void {
  const monster: MonsterInstance = {
    defId, name: defId, icon: 'x', level: 5, tier: 'basic', modifier: 'normal',
    rarity: 'common', mutation: null, hp: 0, statuses: [], attrs: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    xp: 1, gold: 0, range: 'melee', bar: 0, stunSpent: 0,
  };
  g.state.combat = null;
  g.bus.emit({ type: 'kill', monster });
}

describe('quest lifecycle', () => {
  it('accept → kill progress → turn-in gated by location → rewards', () => {
    const g = new Game(createInitialState(1));
    g.state.spot = 'town_gates';
    const quest = QUESTS.first_posting;

    g.acceptQuest('first_posting');
    expect(g.state.quests.first_posting?.status).toBe('active');

    for (let i = 0; i < 9; i++) killEvent(g, 'goblin');
    killEvent(g, 'forest_rat'); // wrong monster — must not count
    expect(objectiveProgress(g.state, quest, 0)).toEqual({ current: 9, target: 10 });
    expect(questComplete(g.state, quest)).toBe(false);

    killEvent(g, 'goblin');
    expect(questComplete(g.state, quest)).toBe(true);

    // Away from the giver: cannot turn in.
    g.state.spot = 'hamlet_square';
    expect(canTurnIn(g.state, quest)).toBe(false);
    g.turnInQuest('first_posting');
    expect(g.state.quests.first_posting.status).toBe('active');

    // Back at the gates: rewards flow.
    g.state.spot = 'town_gates';
    g.state.skills['fighting'] = { level: 1, xp: 0 };
    const goldBefore = g.state.gold;
    g.turnInQuest('first_posting');
    expect(g.state.quests.first_posting.status).toBe('done');
    expect(g.state.gold).toBe(goldBefore + 100);
    expect(g.state.skills.fighting.xp > 0 || g.state.skills.fighting.level > 1).toBe(true);
    expect(g.state.stats['quests:completed']).toBe(1);
  });

  it('progress does not advance past the target or on inactive quests', () => {
    const g = new Game(createInitialState(2));
    g.state.spot = 'town_gates';
    g.acceptQuest('first_posting');
    for (let i = 0; i < 25; i++) killEvent(g, 'goblin');
    expect(objectiveProgress(g.state, QUESTS.first_posting, 0).current).toBe(10);
    // head_of_the_problem never accepted — no ghost progress
    expect(g.state.quests.head_of_the_problem).toBeUndefined();
  });
});

describe('objective types', () => {
  it('craft objectives advance via the craft event', () => {
    const g = new Game(createInitialState(3));
    g.state.spot = 'hamlet_forge';
    g.acceptQuest('hammer_and_anvil');
    g.state.materials['iron_scrap'] = 9;
    g.selectActivity('craft_iron_ingot');
    for (let i = 0; i < 400 && !questComplete(g.state, QUESTS.hammer_and_anvil); i++) g.tick();
    expect(questComplete(g.state, QUESTS.hammer_and_anvil)).toBe(true);

    const ingotsBefore = g.state.materials['iron_ingot'] ?? 0;
    g.turnInQuest('hammer_and_anvil');
    expect(g.state.materials['iron_ingot']).toBe(ingotsBefore + 2); // reward materials
    expect(g.state.quests.hammer_and_anvil.status).toBe('done');
  });

  it('reach objectives fire on arrival; collect objectives read and consume materials', () => {
    const g = new Game(createInitialState(4));
    g.state.spot = 'village_square';
    g.acceptQuest('word_from_the_west');
    g.bus.emit({ type: 'arrive', spot: 'hamlet_square' });
    g.state.spot = 'hamlet_square';
    expect(questComplete(g.state, QUESTS.word_from_the_west)).toBe(true);
    // Turn-in is at the GIVER (Elder Maren, village_square), not the destination.
    expect(canTurnIn(g.state, QUESTS.word_from_the_west)).toBe(false);
    g.state.spot = 'village_square';
    g.turnInQuest('word_from_the_west');
    expect(g.state.quests.word_from_the_west.status).toBe('done');

    // Chain unlocks; collect objective is possession-based and consumed.
    const maren = NPCS.elder_maren;
    expect(availableQuests(g.state, maren).map((q) => q.id)).toContain('eight_legs_too_many');
    g.acceptQuest('eight_legs_too_many');
    for (let i = 0; i < 15; i++) killEvent(g, 'cave_spider');
    expect(questComplete(g.state, QUESTS.eight_legs_too_many)).toBe(false); // no herbs yet
    g.state.materials['common_herb'] = 10;
    expect(questComplete(g.state, QUESTS.eight_legs_too_many)).toBe(true);
    g.turnInQuest('eight_legs_too_many');
    expect(g.state.materials['common_herb']).toBe(2); // 8 handed over
    expect(g.state.inventory.some((i) => i.defId === 'herbal_charm')).toBe(true);
  });
});

describe('chains & gating', () => {
  it('follow-ups are hidden until the predecessor is done', () => {
    const g = new Game(createInitialState(5));
    const bren = NPCS.captain_bren;
    g.state.spot = 'town_gates';
    expect(availableQuests(g.state, bren).map((q) => q.id)).toEqual(['first_posting']);

    g.state.quests['first_posting'] = { status: 'done', progress: [10] };
    expect(availableQuests(g.state, bren).map((q) => q.id)).toEqual(['head_of_the_problem']);
  });

  it('accepting requires standing at the giver spot and passing requirements', () => {
    const g = new Game(createInitialState(6));
    g.state.spot = 'village_square'; // not Bren's spot
    expect(acceptQuest(g.state, g.bus, 'first_posting')).toBe(false);
    g.state.spot = 'town_gates';
    expect(acceptQuest(g.state, g.bus, 'head_of_the_problem')).toBe(false); // chain locked
    expect(acceptQuest(g.state, g.bus, 'first_posting')).toBe(true);
  });

  it('questmaster achievement tiers on completions', () => {
    const g = new Game(createInitialState(7));
    // Complete three real quests the direct way.
    g.state.spot = 'town_gates';
    g.acceptQuest('first_posting');
    for (let i = 0; i < 10; i++) killEvent(g, 'goblin');
    g.turnInQuest('first_posting');
    g.acceptQuest('head_of_the_problem');
    killEvent(g, 'goblin_boss');
    g.turnInQuest('head_of_the_problem');
    g.state.spot = 'village_square';
    g.acceptQuest('word_from_the_west');
    g.bus.emit({ type: 'arrive', spot: 'hamlet_square' });
    g.turnInQuest('word_from_the_west');
    expect(g.state.stats['quests:completed']).toBe(3);
    expect(g.state.achievements['questmaster']).toBe(1);
  });
});

describe('migration', () => {
  it('v3 saves migrate to v4 with an empty quest log', () => {
    const v3 = createInitialState(8) as unknown as Record<string, unknown>;
    v3.version = 3;
    delete v3.quests;
    const loaded = deserialize(JSON.stringify(v3));
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.quests).toEqual({});
  });
});
