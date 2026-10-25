// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { BESTIARY_FACTS, BESTIARY_TUNING, MONSTERS, MONSTER_TAGS } from '../src/core/registry';
import {
  bestiaryInsight,
  bestiaryProgress,
  dropChance,
  entryOf,
  factChance,
  groupByTaxon,
  habitatNeeded,
  isDiscovered,
  knowsFact,
  matchesQuery,
  monsterProfile,
  monsterTags,
  primaryTaxon,
  queryMonsters,
  taxonPlural,
  recordEncounter,
  recordKill,
  spawnLevels,
} from '../src/core/systems/bestiary';
import type { GameState, MonsterInstance } from '../src/core/types';

function newGame(seed = 42): Game {
  return new Game(createInitialState(seed));
}

/** Kill the same monster n times through the real listener path. */
function kill(g: Game, monsterId: string, times = 1): void {
  for (let i = 0; i < times; i++) recordKill(g.state, g.bus, monsterId);
}

const fact = (id: string) => BESTIARY_FACTS.find((f) => f.id === id)!;

describe('bestiary unlocking', () => {
  it('the first kill opens the entry and nothing before it does', () => {
    const g = newGame();
    expect(isDiscovered(g.state, 'goblin')).toBe(false);

    // Seeing one, repeatedly, is not knowing one.
    recordEncounter(g.state, 'forest_edge_w', ['goblin', 'goblin']);
    expect(isDiscovered(g.state, 'goblin')).toBe(false);
    expect(entryOf(g.state, 'goblin')!.seen.forest_edge_w).toBe(1); // deduped per encounter

    kill(g, 'goblin');
    expect(isDiscovered(g.state, 'goblin')).toBe(true);
    expect(entryOf(g.state, 'goblin')!.kills).toBe(1);
  });

  it('a fact cannot be learned before its minimum kill count, however lucky', () => {
    const g = newGame(7);
    const defenses = fact('defenses');
    kill(g, 'wolf', defenses.minKills - 1);
    expect(knowsFact(g.state, 'wolf', 'defenses')).toBe(false);
  });

  it('grinding past sureKills guarantees every fact', () => {
    const g = newGame(3);
    const most = Math.max(...BESTIARY_FACTS.map((f) => f.sureKills));
    kill(g, 'wolf', most);
    for (const f of BESTIARY_FACTS) {
      expect(knowsFact(g.state, 'wolf', f.id), `${f.id} still unknown after ${most} kills`).toBe(true);
    }
  });

  it('facts are learned once and never duplicated', () => {
    const g = newGame(11);
    kill(g, 'wolf', 200);
    const facts = entryOf(g.state, 'wolf')!.facts;
    expect(new Set(facts).size).toBe(facts.length);
  });

  it('sharper hunters learn faster', () => {
    const dull = newGame();
    const sharp = newGame();
    sharp.state.skills.hunting = { level: 40, xp: 0 };
    sharp.state.attrs.int.level = 30;
    sharp.state.attrs.wis.level = 30;

    expect(bestiaryInsight(sharp.state)).toBeGreaterThan(bestiaryInsight(dull.state));
    expect(factChance(sharp.state, fact('vitals'))).toBeGreaterThan(
      factChance(dull.state, fact('vitals')),
    );
  });

  it('insight rides the same roll chance but never exceeds the cap', () => {
    const g = newGame();
    g.state.skills.hunting = { level: 500, xp: 0 };
    expect(factChance(g.state, fact('lore'))).toBe(BESTIARY_TUNING.maxChance);
  });

  it('progress counts only what has actually been killed', () => {
    const g = newGame();
    expect(bestiaryProgress(g.state)).toEqual({ known: 0, total: Object.keys(MONSTERS).length });
    kill(g, 'goblin');
    expect(bestiaryProgress(g.state).known).toBe(1);
  });
});

describe('habitats', () => {
  it('a location is confirmed only after enough sightings, and only once killed', () => {
    const g = newGame();
    const needed = habitatNeeded(g.state);
    for (let i = 0; i < needed + 3; i++) recordEncounter(g.state, 'forest_edge_w', ['goblin']);
    // Never killed one: nothing is confirmed yet.
    expect(entryOf(g.state, 'goblin')!.spots).toEqual([]);

    kill(g, 'goblin');
    expect(entryOf(g.state, 'goblin')!.spots).toEqual(['forest_edge_w']);
  });

  it('each location is learned separately', () => {
    const g = newGame();
    const needed = habitatNeeded(g.state);
    kill(g, 'goblin');
    for (let i = 0; i < needed; i++) recordEncounter(g.state, 'deep_forest_w', ['goblin']);
    for (let i = 0; i < needed - 1; i++) recordEncounter(g.state, 'malgeri_path', ['goblin']);
    kill(g, 'goblin');

    const entry = entryOf(g.state, 'goblin')!;
    expect(entry.spots).toContain('deep_forest_w');
    expect(entry.spots).not.toContain('malgeri_path');
  });

  it('hunting skill lowers the sightings needed, down to a floor', () => {
    const g = newGame();
    expect(habitatNeeded(g.state)).toBe(BESTIARY_TUNING.habitatBase);
    g.state.skills.hunting = { level: 20, xp: 0 };
    expect(habitatNeeded(g.state)).toBe(BESTIARY_TUNING.habitatBase - 2);
    g.state.skills.hunting = { level: 999, xp: 0 };
    expect(habitatNeeded(g.state)).toBe(BESTIARY_TUNING.habitatFloor);
  });
});

describe('recorded knowledge', () => {
  it('profile stats bracket what the spawner actually produces', () => {
    const profile = monsterProfile('wolf');
    const [lo, hi] = spawnLevels('wolf');
    expect(profile.levels).toEqual([lo, hi]);
    // Tier mid-point sits inside the rolled band, so the book's numbers are
    // plausible rather than extreme.
    expect(profile.hp[0]).toBeLessThanOrEqual(profile.hp[1]);
    expect(profile.damage[0]).toBeLessThanOrEqual(profile.damage[1]);
    expect(profile.attackInterval).toBeGreaterThan(0);
  });

  it('escort-only monsters still get a level band from their leader', () => {
    expect(spawnLevels('slime_soldier_spear')[1]).toBeGreaterThan(0);
  });

  it('drop chances account for multiple rolls', () => {
    const golem = MONSTERS.slime_golem;
    const index = golem.loot.entries.findIndex((e) => e.id === 'warm_slime_gel');
    const single = golem.loot.entries[index].weight / golem.loot.entries.reduce((s, e) => s + e.weight, 0);
    expect(dropChance(golem, index)).toBeGreaterThan(single); // 3 rolls beat 1
    expect(dropChance(golem, index)).toBeLessThanOrEqual(1);
  });
});

describe('tags and search', () => {
  it('derived tags come from the stats, not the data file', () => {
    expect(monsterTags(MONSTERS.slime_fire)).toContain('ranged'); // range: 'ranged'
    expect(monsterTags(MONSTERS.goblin_boss)).toContain('leader'); // has escorts
    expect(monsterTags(MONSTERS.stone_golem)).toContain('solitary'); // group.max 1
    expect(monsterTags(MONSTERS.slime_spider)).toContain('swarm'); // group.min > 1
    expect(monsterTags(MONSTERS.slime_base_basic)).toContain('non_elemental');
    expect(monsterTags(MONSTERS.slime_fire)).not.toContain('non_elemental');
  });

  it('filters OR within a category and AND across categories', () => {
    const slimeFire = queryMonsters({ tags: ['slime', 'fire'] }).map((d) => d.id);
    expect(slimeFire).toContain('slime_fire');
    expect(slimeFire).not.toContain('slime_water'); // slime, but not fire
    expect(slimeFire).not.toContain('goblin');

    // Two elements in one category widen the net rather than narrowing it.
    const either = queryMonsters({ tags: ['fire', 'ice'] }).map((d) => d.id);
    expect(either).toEqual(expect.arrayContaining(['slime_fire', 'slime_ice_basic']));
  });

  it('search matches names and tag names', () => {
    expect(matchesQuery(MONSTERS.slime_metal, { search: 'metal' })).toBe(true);
    expect(matchesQuery(MONSTERS.slime_metal, { search: 'construct' })).toBe(true);
    expect(matchesQuery(MONSTERS.slime_metal, { search: 'goblin' })).toBe(false);
  });

  it('results are ordered by tier', () => {
    const ids = queryMonsters({ tags: ['slime'] });
    const tiers = ids.map((d) => d.tier);
    expect(tiers.indexOf('basic')).toBeLessThan(tiers.lastIndexOf('elite'));
  });
});

describe('taxonomy shelves', () => {
  it('a monster files under its FIRST taxon tag', () => {
    // Slime Spider is slime + vermin, in that order: it shelves with the slimes.
    expect(primaryTaxon(MONSTERS.slime_spider)).toBe('slime');
    expect(primaryTaxon(MONSTERS.cave_spider)).toBe('vermin');
    expect(primaryTaxon(MONSTERS.goblin)).toBe('goblin');
    expect(primaryTaxon(MONSTERS.stone_golem)).toBe('construct');
  });

  it('every monster lands on a shelf, exactly once', () => {
    const all = Object.values(MONSTERS);
    const groups = groupByTaxon(all);
    const shelved = groups.flatMap((g) => g.defs.map((d) => d.id));
    expect(shelved.length).toBe(all.length);
    expect(new Set(shelved).size).toBe(all.length);
    for (const g of groups) expect(MONSTER_TAGS[g.tag], `unregistered shelf ${g.tag}`).toBeDefined();
  });

  it('headings pluralise, and irregulars are respected', () => {
    expect(taxonPlural('slime')).toBe('Slimes');
    expect(taxonPlural('goblin')).toBe('Goblins');
    expect(taxonPlural('vermin')).toBe('Vermin');
    expect(taxonPlural('undead')).toBe('Undead');
  });

  it('shelf order follows the tag registry, not discovery order', () => {
    const order = Object.keys(MONSTER_TAGS);
    const tags = groupByTaxon(Object.values(MONSTERS)).map((g) => g.tag);
    const positions = tags.map((t) => order.indexOf(t));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe('wired into the game', () => {
  it('killing through the event bus records the kill', () => {
    const g = newGame();
    const monster = { defId: 'goblin' } as MonsterInstance;
    g.bus.emit({ type: 'kill', monster, xp: monster.xp });
    expect(isDiscovered(g.state, 'goblin')).toBe(true);
  });

  it('encounters recorded through the bus count sightings', () => {
    const g = newGame();
    g.bus.emit({ type: 'encounter', spot: 'riverbank', monsterIds: ['slime_water'] });
    expect(entryOf(g.state, 'slime_water')!.seen.riverbank).toBe(1);
  });

  it('a fresh save starts with an empty book', () => {
    const state: GameState = createInitialState(1);
    expect(state.bestiary).toEqual({});
  });
});
