import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { EventBus } from '../src/core/engine/events';
import { Game } from '../src/core/game';
import { QUESTS, SPOTS } from '../src/core/registry';
import { checkInscription } from '../src/core/systems/spellcraft';
import { hasMet, metKey, objectiveProgress, talkTo } from '../src/core/systems/quests';
import { checkSentence } from '../src/core/systems/arcane';
import { grantFavorAll, favorWith } from '../src/core/systems/divine';
import { deityKnown, wordUnlocked, STARTER_LEXICON } from '../src/core/systems/unlocks';
import { recordKill } from '../src/core/systems/bestiary';
import { BESTIARY_FACTS } from '../src/core/data/bestiary.data';
import { DEITY_LIST } from '../src/core/data/deities.data';
import { MIGRATIONS } from '../src/core/save/migrations';
import type { GameState } from '../src/core/types';
import { text } from '../src/core/text/log';

const fresh = (): GameState => createInitialState(0);
const bus = () => new EventBus();

describe('meeting people (talk objectives)', () => {
  it('a greeting stamps met:* once, at the right spot only', () => {
    const state = fresh();
    const b = bus();
    expect(talkTo(state, b, 'master_smith')).toBe(false); // she is at the Forges, you are not
    state.spot = 'the_forges';
    expect(talkTo(state, b, 'master_smith')).toBe(true);
    expect(hasMet(state, 'master_smith')).toBe(true);
    expect(state.stats[metKey('master_smith')]).toBe(1);
    expect(talkTo(state, b, 'master_smith')).toBe(false); // already acquainted
    expect(state.stats[metKey('master_smith')]).toBe(1);
  });

  it('talk objectives read greetings live — met before accepting still counts', () => {
    const state = fresh();
    state.spot = 'the_sand';
    talkTo(state, bus(), 'dojo_master');
    const quest = QUESTS.faces_of_threshold;
    // Not even accepted, and the dojo master's line is already satisfied.
    const i = quest.objectives.findIndex((o) => o.type === 'talk' && o.npcId === 'dojo_master');
    expect(objectiveProgress(state, quest, i)).toEqual({ current: 1, target: 1 });
  });

  it('stat objectives read their counters live', () => {
    const state = fresh();
    const quest = QUESTS.a_taste_of_everything;
    const i = quest.objectives.findIndex((o) => o.type === 'stat' && o.key === 'spells:inscribed');
    expect(objectiveProgress(state, quest, i).current).toBe(0);
    state.stats['spells:inscribed'] = 1;
    expect(objectiveProgress(state, quest, i)).toEqual({ current: 1, target: 1 });
  });

  it('bench work advances discipline craft objectives through the bus', () => {
    const state = fresh();
    const game = new Game(state);
    state.quests.a_taste_of_everything = {
      status: 'active',
      progress: QUESTS.a_taste_of_everything.objectives.map(() => 0),
    };
    const i = QUESTS.a_taste_of_everything.objectives.findIndex(
      (o) => o.type === 'craft' && o.discipline === 'cooking',
    );
    game.bus.emit({ type: 'craft', discipline: 'cooking' });
    expect(state.quests.a_taste_of_everything.progress[i]).toBe(1);
    // The alchemy line is untouched by a cooked dish.
    const j = QUESTS.a_taste_of_everything.objectives.findIndex(
      (o) => o.type === 'craft' && o.discipline === 'alchemy',
    );
    game.bus.emit({ type: 'craft', recipe: 'iron_ingot' });
    expect(state.quests.a_taste_of_everything.progress[j]).toBe(0);
  });
});

describe("the Warden's second quest, played from a tutorial save", () => {
  it('the floor 0 word is refused before Inscribe is pressed; a new sentence counts', () => {
    const g = new Game(fresh());
    g.chooseTutorialSpell('fire');
    // The first thing a newcomer types at the table is the word they hold.
    const repeat = checkInscription(g.state, ['fire']);
    expect(repeat.ok).toBe(false);
    expect(repeat.reason).toBe(text('spellcraft.reason.already_inscribed'));
    expect(g.inscribeArcane(['fire'])).toBeNull();
    expect(g.state.stats['spells:inscribed'] ?? 0).toBe(0);

    expect(checkInscription(g.state, ['ice']).ok).toBe(true);
    expect(g.inscribeArcane(['ice'])).not.toBeNull();
    expect(g.state.stats['spells:inscribed']).toBe(1);
  });

  it('the Nine Chapels, where the quest sends you, can teach a miracle', () => {
    // The objective, the prior and the spot all say miracles are learned
    // there; the Divine tab lives on the spellcrafting table.
    expect(SPOTS.the_nine_chapels.benches ?? []).toContain('spelltable');
    const i = QUESTS.a_taste_of_everything.objectives.findIndex(
      (o) => o.type === 'stat' && o.key === 'miracles:learned',
    );
    expect(QUESTS.a_taste_of_everything.objectives[i].desc).toContain('Nine Chapels');
  });
});

describe('the starter lexicon', () => {
  it('a fresh speaker holds eleven words and no more', () => {
    const state = fresh();
    for (const id of STARTER_LEXICON) expect(wordUnlocked(state, id), id).toBe(true);
    expect(wordUnlocked(state, 'stone')).toBe(false);
    expect(wordUnlocked(state, 'gloom')).toBe(false);
  });

  it('checkSentence refuses a locked word as unknown, not as too advanced', () => {
    const state = fresh();
    const check = checkSentence(state, ['stone']);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe(text('arcane.reason.unknown_word', { word: 'stone' }));
    // Lift the latch and the refusal changes character (or disappears).
    state.stats['flag:word:stone'] = 1;
    const again = checkSentence(state, ['stone']);
    expect(again.reason ?? '').not.toContain('do not know the word');
  });

  it('a starter word is never refused for being unknown', () => {
    const check = checkSentence(fresh(), ['fire']);
    expect(check.reason ?? '').not.toContain('do not know the word');
  });
});

describe('the known gods', () => {
  it('a fresh life knows two, and favor accrues to them alone', () => {
    const state = fresh();
    expect(deityKnown(state, 'denjalle')).toBe(true);
    expect(deityKnown(state, 'usvylgr')).toBe(true);
    expect(deityKnown(state, 'ikthelthe')).toBe(false);
    grantFavorAll(state, bus(), 5);
    expect(favorWith(state, 'denjalle')).toBe(5);
    expect(favorWith(state, 'usvylgr')).toBe(5);
    for (const d of DEITY_LIST) {
      if (d.id === 'denjalle' || d.id === 'usvylgr') continue;
      expect(favorWith(state, d.id), d.id).toBe(0);
    }
  });

  it("quest 1's favor makes the cheapest miracle exactly affordable", () => {
    const state = fresh();
    const b = bus();
    // Turn-in pays 1 + the quest's own favor reward.
    grantFavorAll(state, b, 1 + (QUESTS.faces_of_threshold.rewards.favor ?? 0));
    expect(favorWith(state, 'usvylgr')).toBeGreaterThanOrEqual(5);
  });
});

describe('the cages (defined bestiary rates)', () => {
  it('caged kills unlock every fact exactly at its minKills, no rolls', () => {
    const state = fresh();
    const b = bus();
    state.spot = 'the_cages';
    const kills = Math.max(...BESTIARY_FACTS.map((f) => f.minKills));
    for (let k = 1; k <= kills; k++) {
      recordKill(state, b, 'forest_rat');
      for (const fact of BESTIARY_FACTS) {
        expect(
          state.bestiary.forest_rat.facts.includes(fact.id),
          `${fact.id} at ${k} kills (minKills ${fact.minKills})`,
        ).toBe(k >= fact.minKills);
      }
    }
    expect(state.stats['bestiary:entries']).toBe(1);
  });
});

describe('migration v47 → v48', () => {
  it('an older save keeps the whole lexicon and pantheon', () => {
    const raw: Record<string, unknown> = { version: 47, stats: {} };
    MIGRATIONS[47](raw);
    const stats = raw.stats as Record<string, number>;
    expect(stats['flag:word:stone']).toBe(1);
    expect(stats['met:deity:ikthelthe']).toBe(1);
    expect(raw.version).toBe(48);
  });
});
