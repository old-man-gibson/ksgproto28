import { describe, expect, it } from 'vitest';
import { createInitialState, SAVE_VERSION } from '../src/core/state';
import { Game } from '../src/core/game';
import { EventBus } from '../src/core/engine/events';
import { migrate } from '../src/core/save/migrations';
import { FLOORS, MONSTERS, QUESTS, SPOTS, STARTING_SPOT } from '../src/core/registry';
import {
  eligibleEncounters,
  onFinaleFight,
  packMates,
  packMultiplier,
  positionMod,
  spawnGroup,
  spotCleared,
  streakHolding,
  tickStreaks,
} from '../src/core/systems/combat';
import { monsterTags } from '../src/core/systems/bestiary';
import { floorCleared, floorUnlocked } from '../src/core/systems/towers';
import { canPrestige } from '../src/core/systems/prestige';
import { exploreProgress } from '../src/core/systems/actions';
import { visibleEdges } from '../src/core/systems/locations';
import { acceptQuest, questComplete } from '../src/core/systems/quests';
import { createItem } from '../src/core/systems/runes';
import { getDerivedStats } from '../src/core/systems/derived';
import type { AttributeId, CombatState, GameState, MonsterInstance, SpotDef } from '../src/core/types';

/**
 * Floor 2, the Wildwood (plans/alpha-band-one-floors.md): four nests, each
 * built on one mechanism — fixed parties and a finale (the Warren), damage
 * types (the Crypt), pack tactics (the Runs), an unbroken streak (the Mound)
 * — and the Grand Elevator whose waking is the floor's clear and the first
 * prestige.
 */

const fresh = (seed = 1): GameState => createInitialState(seed);
const NESTS = { f2_goblin_warren: 7, f2_crypt: 6, f2_wolf_runs: 6, f2_hive: 5 } as const;

function clearNests(s: GameState): void {
  for (const [spot, n] of Object.entries(NESTS)) s.stats[`fights:${spot}`] = n;
}

function living(slots: (MonsterInstance | null)[]): MonsterInstance[] {
  return slots.filter((m): m is MonsterInstance => m !== null);
}

describe('parties: a nest fields a composition, not a crowd', () => {
  const spot = (party: string[], lead = 'goblin_spearman'): SpotDef => ({
    id: 'test_nest',
    name: 'Test Nest',
    icon: '🧪',
    areaId: 'ascent_f2_area',
    desc: '',
    activities: [],
    connections: [],
    encounters: [{ monsterId: lead, weight: 1, level: [5, 5], party }],
  });

  it('spawns exactly the leader and its party, at the leader level', () => {
    const s = fresh();
    const members = living(spawnGroup(s, spot(['goblin_archer', 'goblin_archer'])));
    expect(members.map((m) => m.defId)).toEqual(['goblin_spearman', 'goblin_archer', 'goblin_archer']);
    expect(new Set(members.map((m) => m.level))).toEqual(new Set([5]));
  });

  it('still puts a melee in front when a ranged body leads', () => {
    const s = fresh();
    const slots = spawnGroup(s, spot(['goblin_archer', 'goblin_spearman'], 'goblin_archer'));
    expect(slots[0]?.defId).toBe('goblin_spearman');
    expect(living(slots)).toHaveLength(3);
  });

  it('ignores the leader group rule and escorts — the party is the whole formation', () => {
    const s = fresh();
    // The alpha's own rule is three to five with grey wolves; a party wins.
    const members = living(spawnGroup(s, spot(['goblin'], 'wolf_alpha')));
    expect(members.map((m) => m.defId).sort()).toEqual(['goblin', 'wolf_alpha']);
  });
});

describe('the finale: the Goblin King always ends the raid', () => {
  const warren = SPOTS.f2_goblin_warren;

  it('owns the last budgeted fight and no other', () => {
    const s = fresh();
    for (let won = 0; won < warren.fightLimit! - 1; won++) {
      s.stats['fights:f2_goblin_warren'] = won;
      expect(onFinaleFight(s, warren)).toBe(false);
      expect(eligibleEncounters(s, warren).some((e) => e.monsterId === 'goblin_king')).toBe(false);
    }
    s.stats['fights:f2_goblin_warren'] = warren.fightLimit! - 1;
    expect(onFinaleFight(s, warren)).toBe(true);
    expect(eligibleEncounters(s, warren).map((e) => e.monsterId)).toEqual(['goblin_king']);
  });

  it('brings his guard: the king leads, with the party beside him', () => {
    const s = fresh();
    s.stats['fights:f2_goblin_warren'] = warren.fightLimit! - 1;
    const members = living(spawnGroup(s, warren));
    expect(members[0].defId).toBe('goblin_king');
    expect(members.map((m) => m.defId).slice(1).sort()).toEqual(['goblin_shaman', 'goblin_spearman']);
  });

  it('is nothing special on a spot without a finale', () => {
    const s = fresh();
    s.stats['fights:f2_crypt'] = SPOTS.f2_crypt.fightLimit! - 1;
    expect(onFinaleFight(s, SPOTS.f2_crypt)).toBe(false);
    expect(eligibleEncounters(s, SPOTS.f2_crypt).length).toBeGreaterThan(0);
  });
});

describe('the streak: the Hive Mound is one push', () => {
  function atTheMound(won: number): { g: Game; s: GameState } {
    const g = new Game(fresh());
    const s = g.state;
    s.spot = 'f2_hive';
    s.discovered.push('f2_hive');
    g.selectActivity('hunt');
    s.stats['fights:f2_hive'] = won;
    return { g, s };
  }

  it('holds while you keep hunting there', () => {
    const { s } = atTheMound(3);
    expect(streakHolding(s, SPOTS.f2_hive)).toBe(true);
    tickStreaks(s, new EventBus());
    expect(s.stats['fights:f2_hive']).toBe(3);
  });

  it('breaks the moment you stop — through the ordinary game loop', () => {
    const { g, s } = atTheMound(3);
    g.selectActivity(null);
    g.tick();
    expect(s.stats['fights:f2_hive']).toBe(0);
  });

  it('breaks when you walk away or go down', () => {
    const away = atTheMound(2);
    away.s.spot = 'f2_deepwood';
    tickStreaks(away.s, new EventBus());
    expect(away.s.stats['fights:f2_hive']).toBe(0);

    const down = atTheMound(4);
    down.s.recovering = true;
    tickStreaks(down.s, new EventBus());
    expect(down.s.stats['fights:f2_hive']).toBe(0);
  });

  it('never un-clears a cleared mound', () => {
    const { g, s } = atTheMound(SPOTS.f2_hive.fightLimit!);
    g.selectActivity(null);
    s.spot = 'f2_deepwood';
    g.tick();
    expect(s.stats['fights:f2_hive']).toBe(SPOTS.f2_hive.fightLimit);
    expect(spotCleared(s, SPOTS.f2_hive)).toBe(true);
  });
});

describe('pack tactics: the Wolf Runs', () => {
  function field(s: GameState, ids: string[]): CombatState {
    const nest: SpotDef = { ...SPOTS.f2_wolf_runs, encounters: [] };
    const slots: (MonsterInstance | null)[] = [null, null, null, null, null];
    ids.forEach((monsterId, i) => {
      nest.encounters = [{ monsterId, weight: 1, level: [5, 5], party: [] }];
      slots[i] = spawnGroup(s, nest)[0];
    });
    return {
      enemies: slots,
      playerBar: 0,
      momentum: 0,
      position: 'neutral',
      cooldowns: {},
      buffs: [],
      events: {},
    };
  }

  it('each packmate still standing adds to the bite, and only pack animals count', () => {
    const s = fresh();
    const c = field(s, ['wolf_alpha', 'grey_wolf', 'grey_wolf', 'goblin']);
    const alpha = c.enemies[0]!;
    const per = MONSTERS.wolf_alpha.pack!.perMate;
    expect(packMates(c, alpha)).toBe(2);
    expect(packMultiplier(c, alpha)).toBeCloseTo(1 + 2 * per, 10);
    // The pack thins, the bite eases.
    c.enemies[1] = null;
    expect(packMultiplier(c, alpha)).toBeCloseTo(1 + per, 10);
    // A goblin is not family.
    expect(packMultiplier(c, c.enemies[3]!)).toBe(1);
  });

  it('flanks: a pack wolf in a back slot takes the front terms, a goblin does not', () => {
    const s = fresh();
    const c = field(s, ['grey_wolf', 'grey_wolf', 'goblin']);
    const back = positionMod(c, c.enemies[1]!, 1);
    expect(back.fill).toBe(1);
    expect(back.damage).toBeCloseTo(packMultiplier(c, c.enemies[1]!), 10);
    const goblin = positionMod(c, c.enemies[2]!, 2);
    expect(goblin.fill).toBeLessThan(1);
    expect(goblin.damage).toBeLessThan(1);
  });

  it('is a trait the bestiary can see', () => {
    expect(monsterTags(MONSTERS.grey_wolf)).toContain('pack');
    expect(monsterTags(MONSTERS.goblin)).not.toContain('pack');
  });

  it('never fields fewer than three', () => {
    const s = fresh(9);
    for (let i = 0; i < 40; i++) {
      expect(living(spawnGroup(s, SPOTS.f2_wolf_runs)).length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('the Grand Elevator', () => {
  function atTheGlade(): { g: Game; s: GameState } {
    const g = new Game(fresh());
    const s = g.state;
    s.spot = 'f2_elevator';
    s.discovered.push('f2_elevator');
    g.selectActivity('wake_elevator');
    return { g, s };
  }

  it('stalls a tenth of the way in until every nest is cleared', () => {
    const { g, s } = atTheGlade();
    for (let i = 0; i < 200; i++) g.tick();
    expect(exploreProgress(s, SPOTS.f2_elevator)).toBeCloseTo(0.1, 5);
    // Three of four is not four.
    clearNests(s);
    s.stats['fights:f2_hive'] = 4;
    for (let i = 0; i < 200; i++) g.tick();
    expect(exploreProgress(s, SPOTS.f2_elevator)).toBeCloseTo(0.1, 5);
    expect(s.stats['flag:grand_elevator'] ?? 0).toBe(0);
  });

  it('wakes once they are, which clears floor 2, opens floor 3 and lights prestige', () => {
    const { g, s } = atTheGlade();
    s.stats['boss:f1_toll_hall'] = 1;
    s.stats['gold:earned'] = 600;
    clearNests(s);
    expect(floorCleared(s, FLOORS.ascent_f2)).toBe(false);
    expect(canPrestige(s)).toBe(false);
    for (let i = 0; i < SPOTS.f2_elevator.exploreTicks! + 5; i++) g.tick();
    expect(s.stats['flag:grand_elevator']).toBe(1);
    expect(floorCleared(s, FLOORS.ascent_f2)).toBe(true);
    expect(floorUnlocked(s, FLOORS.ascent_f3)).toBe(true);
    expect(canPrestige(s)).toBe(true);
  });

  it('is found, not seen: combing the deep wood reveals the crypt, then the glade', () => {
    const g = new Game(fresh());
    const s = g.state;
    s.spot = 'f2_deepwood';
    s.discovered.push('f2_deepwood');
    const shown = () => visibleEdges(s, 'f2_deepwood').map((e) => e.to);
    expect(shown()).not.toContain('f2_crypt');
    expect(shown()).not.toContain('f2_elevator');
    g.selectActivity('explore_f2_deep');
    const ticks = SPOTS.f2_deepwood.exploreTicks!;
    for (let i = 0; i < ticks * 0.5; i++) g.tick();
    expect(shown()).toContain('f2_crypt');
    expect(shown()).not.toContain('f2_elevator');
    for (let i = 0; i < ticks * 0.4; i++) g.tick();
    expect(shown()).toContain('f2_elevator');
    expect(s.stats['flag:elevator_found']).toBe(1);
  });

  it('the Pathwarden quest reads it all live, so work done before accepting counts', () => {
    const s = fresh();
    const b = new EventBus();
    s.stats['flag:elevator_found'] = 1;
    clearNests(s);
    s.stats['flag:grand_elevator'] = 1;
    s.spot = 'f2_landing';
    acceptQuest(s, b, 'the_grand_elevator');
    expect(questComplete(s, QUESTS.the_grand_elevator)).toBe(true);
  });
});

describe('migration', () => {
  it('v53 → v54 wakes a save standing in the drowned cistern at the Foot', () => {
    const v53: Record<string, unknown> = { ...createInitialState(5), version: 53 };
    v53.spot = 'f2_cistern';
    v53.discovered = [STARTING_SPOT, 'f2_landing', 'f2_sluice', 'f2_cistern'];
    v53.resumeActivity = { f2_cistern: 'hunt', f2_landing: 'camp_f2' };
    v53.stats = { 'fights:f2_cistern': 8 };
    const s = migrate(v53, SAVE_VERSION);
    expect(s.spot).toBe(STARTING_SPOT);
    expect(s.discovered).toEqual([STARTING_SPOT, 'f2_landing']);
    expect(s.resumeActivity).toEqual({ f2_landing: 'camp_f2' });
    // The old budget is inert: it clears nothing on the new floor.
    expect(floorCleared(s, FLOORS.ascent_f2)).toBe(false);
  });
});

/**
 * COMPLETABILITY (docs/COMPLETABILITY.md §8, "John"): the road exists. A
 * longsword, the Outfitter's kit, no active skills, no food, no potions —
 * the narrowest build — played the way the floor is played: hunt each nest
 * until it clears, and when knocked out walk back from the camp and go
 * again. It must get through. The level is the dial the probe numbers in
 * the plan card were measured at; it is not a claim about how long the
 * floor takes.
 */
describe('John clears the Wildwood', () => {
  it('raids every nest to its end and wakes the Elevator, on the longsword floor build', () => {
    const g = new Game(fresh(42));
    const s = g.state;
    for (const a of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as AttributeId[]) {
      s.attrs[a] = { level: a === 'int' || a === 'wis' ? 8 : 16, xp: 0 } as GameState['attrs'][AttributeId];
    }
    s.skills.fighting = { level: 16, xp: 0 } as GameState['skills'][string];
    s.equipment.weapon = createItem(s, 'iron_sword');
    s.equipment.head = createItem(s, 'leather_cap');
    s.equipment.chest = createItem(s, 'leather_vest');
    s.equipment.feet = createItem(s, 'leather_boots');
    s.equipment.hands = createItem(s, 'iron_gauntlets');
    s.resources.hp = getDerivedStats(s).maxHp;

    let knockouts = 0;
    for (const nest of Object.keys(NESTS)) {
      const spot = SPOTS[nest];
      let t = 0;
      while (!spotCleared(s, spot) && t < 200_000) {
        if (s.spot !== nest && !s.recovering && !s.travel) {
          // Back from the camp, rested: the walk is not what is under test.
          knockouts++;
          s.resources.hp = getDerivedStats(s).maxHp;
          s.spot = nest;
          g.selectActivity('hunt');
        } else if (s.spot === nest && !s.activity && !s.combat) {
          g.selectActivity('hunt');
        }
        g.tick();
        t++;
      }
      expect(spotCleared(s, spot), `${nest} never cleared`).toBe(true);
    }
    expect(s.stats['boss:f2_goblin_warren']).toBe(1);
    // A handful of knockouts is the floor working; dozens would be a wall.
    expect(knockouts).toBeLessThan(15);

    s.spot = 'f2_elevator';
    g.selectActivity('wake_elevator');
    for (let i = 0; i < SPOTS.f2_elevator.exploreTicks! + 5; i++) g.tick();
    expect(floorCleared(s, FLOORS.ascent_f2)).toBe(true);
  });
});
