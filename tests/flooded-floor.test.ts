import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { createInitialState } from '../src/core/state';
import { SPOTS, KEY_ITEMS, ITEMS, MATERIALS, RUNES, TITLES } from '../src/core/registry';
import type { ActivityDef, DamageType, SpellSpec } from '../src/core/types';
import { hasKeyItem, grantKeyItem } from '../src/core/systems/keyitems';
import { rollSearch, searchKey } from '../src/core/systems/search';
import { searchContentIssues } from '../src/core/systems/searchValidation';
import { visibleEdges } from '../src/core/systems/locations';
import { castCraftedAttack, startForcedFight, tickCombat } from '../src/core/systems/combat';
import { findStatus, statusMissChance } from '../src/core/systems/statuses';
import { monsterStats } from '../src/core/systems/monsterStats';
import { OFFICE_PROGRESS, OFFICE_ROOMS, OFFICE_SEQUENCE, TOLL_REACTION_TICKS, TOLL_SPELL_FLAG } from '../src/core/systems/floodedFloor';
import { deserialize, serialize } from '../src/core/save/save';
import { prestigeNow } from '../src/core/systems/prestige';
import { addSpell } from '../src/core/systems/spellcraft';
import { clearFloors } from './fixtures/floors';

const fresh = (spot = 'f1_landing', seed = 42) => new Game(createInitialState(seed, spot));
function walk(g: Game, id: string) {
  expect(g.travelTo(id), `${g.state.spot} -> ${id}`).toBe(true);
  for (let i = 0; g.state.travel && i < 1000; i++) g.tick();
  expect(g.state.travel).toBeNull();
}
function until(g: Game, predicate: () => boolean, ticks = 10000) {
  for (let i = 0; !predicate() && i < ticks; i++) g.tick();
  expect(predicate()).toBe(true);
}
function exploreReception(g: Game) {
  g.selectActivity('explore_reception');
  until(g, () => hasKeyItem(g.state, 'toll_office_key'));
  g.selectActivity(null);
}
function boss(seed = 42) {
  const g = fresh('f1_toll_hall', seed);
  g.state.attrs.con.level = 40;
  g.state.attrs.int.level = 10;
  g.state.resources.hp = 1000;
  g.state.resources.mana = 100;
  startForcedFight(g.state, g.bus, SPOTS.f1_toll_hall);
  return g;
}
function spell(type: DamageType, power = 0.01): SpellSpec {
  return { name: 'Test spell', icon: '✨', school: 'arcane', manaCost: 1, cooldown: 20, target: 'one', strikes: [{ type, power }] };
}
function finish(g: Game) {
  g.state.combat!.introTicks = 0;
  g.state.combat!.enemies[0]!.hp = 1;
  g.state.combat!.playerBar = 100000;
  until(g, () => !g.state.combat);
}

describe('repeatable searches and key items', () => {
  it('guarantees the book, caps that reward across reloads, and keeps other rewards repeatable', () => {
    const g = fresh('f1_archive');
    g.selectActivity('search');
    until(g, () => hasKeyItem(g.state, 'toll_clerk_book'));
    const key = searchKey('f1_archive', 'search');
    expect(g.state.stats[key]).toBeLessThanOrEqual(4);
    expect(g.state.stats[`${key}:daybook`]).toBe(1);
    const loaded = new Game(deserialize(serialize(g.state)));
    until(loaded, () => loaded.state.stats[key] >= 30);
    expect(loaded.state.stats[`${key}:daybook`]).toBe(1);
    expect(hasKeyItem(loaded.state, 'toll_clerk_book')).toBe(true);
    expect(loaded.state.stats[`${key}:salvage`] + loaded.state.stats[`${key}:coins`]).toBe(29);
    expect(loaded.state.finds.f1_archive ?? []).toEqual([]);
  });

  it('limited tables exhaust cleanly and gated rewards are not consumed', () => {
    const g = fresh();
    const act: Extract<ActivityDef, { kind: 'search' }> = { id: 'test', kind: 'search', name: 'Test', icon: '🔎', ticksPer: 1, rewards: [
      { id: 'coin', weight: 1, limit: 2, gold: [1, 1] },
      { id: 'book', weight: 1, limit: 1, keyItem: 'toll_clerk_book', requires: [{ type: 'stat', key: 'flag:gate', value: 1 }] },
    ] };
    expect(rollSearch(g.state, g.bus, 'f1_archive', act)?.id).toBe('coin');
    expect(rollSearch(g.state, g.bus, 'f1_archive', act)?.id).toBe('coin');
    expect(rollSearch(g.state, g.bus, 'f1_archive', act)).toBeNull();
    g.state.stats['flag:gate'] = 1;
    expect(rollSearch(g.state, g.bus, 'f1_archive', act)?.id).toBe('book');
  });

  it('rejects malformed rewards in the validator shared with the forge', () => {
    const spot = structuredClone(SPOTS.f1_archive);
    const act = spot.activities[0] as Extract<ActivityDef, { kind: 'search' }>;
    act.ticksPer = 0;
    act.rewards = [{ id: 'bad', weight: -1, limit: 0, guaranteedBy: 1.5, keyItem: 'missing', stat: { key: 'kills', amount: 1 } }, { id: 'bad', weight: 1 }];
    const errors = searchContentIssues(spot, { keyItems: KEY_ITEMS, items: ITEMS, materials: MATERIALS, runes: RUNES });
    for (const fragment of ['duration', 'weight', 'limit', 'guaranteedBy', 'unknown keyItem', 'namespace', 'duplicate']) expect(errors.some((e) => e.includes(fragment)), fragment).toBe(true);
  });
});

describe('the flooded floor route', () => {
  it('reveals the passage only after six victories and allows fighting no more vermin', () => {
    const g = fresh('f1_storerooms');
    expect(visibleEdges(g.state, g.state.spot).some((e) => e.to === 'f1_bonded_deep')).toBe(false);
    expect(g.travelTo('f1_bonded_deep')).toBe(false);
    g.state.attrs.str.level = 20;
    g.state.attrs.con.level = 20;
    g.state.resources.hp = 1000;
    g.selectActivity('hunt');
    until(g, () => (g.state.stats['fights:f1_storerooms'] ?? 0) === 6);
    for (let i = 0; i < 100; i++) g.tick();
    expect(g.state.combat).toBeNull();
    expect(g.state.stats['fights:f1_storerooms']).toBe(6);
    walk(g, 'f1_bonded_deep');
    expect(g.state.spot).toBe('f1_bonded_deep');
    expect(g.state.log.some((l) => l.msg.includes('scurry'))).toBe(true);
  });

  it('gates the offices on the book and every room door on the explored key', () => {
    const g = fresh('f1_forms');
    expect(g.travelTo('f1_reception')).toBe(false);
    grantKeyItem(g.state, g.bus, 'toll_clerk_book');
    walk(g, 'f1_reception');
    expect(g.travelTo('f1_scribe')).toBe(false);
    g.selectActivity('explore_reception');
    for (let i = 0; i < 39; i++) g.tick();
    expect(hasKeyItem(g.state, 'toll_office_key')).toBe(false);
    g.tick();
    expect(hasKeyItem(g.state, 'toll_office_key')).toBe(true);
    walk(g, 'f1_scribe');
    expect(g.state.spot).toBe('f1_scribe');
  });

  it('only a premature collector doorway loops home, without consuming items', () => {
    const g = fresh('f1_reception');
    grantKeyItem(g.state, g.bus, 'toll_clerk_book');
    exploreReception(g);
    walk(g, 'f1_scribe');
    walk(g, 'f1_toll_hall');
    expect(g.state.spot).toBe('f1_reception');
    expect(g.state.combat).toBeNull();
    expect(g.state.stats[OFFICE_PROGRESS]).toBe(0);
    expect(hasKeyItem(g.state, 'toll_clerk_book')).toBe(true);
    expect(hasKeyItem(g.state, 'toll_office_key')).toBe(true);
    expect(g.state.discovered).not.toContain('f1_toll_hall');
  });

  it('a wrong door lets out into another office, shows a hint, and the scribe restarts the sequence', () => {
    const g = fresh('f1_reception');
    grantKeyItem(g.state, g.bus, 'toll_clerk_book');
    exploreReception(g);
    walk(g, 'f1_scribe');
    walk(g, 'f1_registry');
    // Not the registry: somewhere else among the offices, never reception,
    // the collector's or the scribe's.
    const landed = g.state.spot;
    expect(OFFICE_ROOMS).toContain(landed);
    expect(['f1_registry', 'f1_reception', 'f1_toll_hall', 'f1_scribe']).not.toContain(landed);
    expect(g.state.discovered).toContain(landed);
    expect(g.state.stats[OFFICE_PROGRESS]).toBe(0);
    expect(g.state.log.some((l) => l.msg === 'This is not the path to the toll collector.')).toBe(true);
    expect(g.state.log.some((l) => l.msg.startsWith('The door lets out into') && l.msg.endsWith('not The Registry.'))).toBe(true);
    expect(hasKeyItem(g.state, 'toll_office_key')).toBe(true);
    for (const room of OFFICE_SEQUENCE) walk(g, room);
    expect(g.state.spot).toBe('f1_toll_hall');
    expect(g.state.combat?.forced).toBe(true);
  });

  it('an early revisit to the scribe starts a new sequence without going through reception', () => {
    const g = fresh('f1_reception');
    exploreReception(g);
    walk(g, 'f1_scribe');
    walk(g, 'f1_auditor');
    walk(g, 'f1_scribe');
    expect(g.state.spot).toBe('f1_scribe');
    expect(g.state.stats[OFFICE_PROGRESS]).toBe(1);
    for (const room of OFFICE_SEQUENCE.slice(1)) walk(g, room);
    expect(g.state.combat?.forced).toBe(true);
  });

  it('preserves partial sequence progress across saves and reaches the boss only after the return visit', () => {
    let g = fresh('f1_reception');
    exploreReception(g);
    for (const room of OFFICE_SEQUENCE.slice(0, 3)) walk(g, room);
    g = new Game(deserialize(serialize(g.state)));
    expect(g.state.stats[OFFICE_PROGRESS]).toBe(3);
    for (const room of OFFICE_SEQUENCE.slice(3)) walk(g, room);
    expect(g.state.spot).toBe('f1_toll_hall');
    expect(g.state.combat?.forced).toBe(true);
    expect(g.state.combat?.enemies[0]?.defId).toBe('toll_collector_golem');
  });
});

describe('the submerged toll collector', () => {
  it.each([['fire'], ['mend', 'me']])('automatic casts, including self-targeted spells, set the encounter flag: %j', (...words) => {
    const g = boss();
    const prepared = addSpell(g.state, { school: 'arcane', words });
    prepared.prepared = true;
    until(g, () => g.state.stats[TOLL_SPELL_FLAG] === 1);
  });

  it('interrogates before either combatant can act', () => {
    const g = boss();
    const e = g.state.combat!.enemies[0]!;
    const hp = e.hp;
    for (let i = 0; i < 30; i++) tickCombat(g.state, g.bus, SPOTS.f1_toll_hall);
    expect(e.hp).toBe(hp);
    expect(e.bar).toBe(0);
    expect(g.state.combat!.playerBar).toBe(0);
    expect(JSON.stringify(g.state.combatFeed)).toContain('Removing interrupting entity');
  });

  it.each([['heat', 'toll_steam'], ['cold', 'toll_ice'], ['lightning', 'toll_overdrive']] as const)('%s casts refresh one non-stacking condition', (type, id) => {
    const g = boss();
    const e = g.state.combat!.enemies[0]!;
    const before = monsterStats(e);
    castCraftedAttack(g.state, g.bus, 'test', spell(type));
    const held = findStatus(e, id)!;
    expect(held).toBeDefined();
    held.ticksLeft = 3;
    castCraftedAttack(g.state, g.bus, 'test', spell(type));
    expect(findStatus(e, id)?.ticksLeft).toBe(TOLL_REACTION_TICKS);
    expect(findStatus(e, id)?.intensity).toBe(1);
    expect(findStatus(e, id)?.stacks).toBe(1);
    if (type === 'heat') expect(statusMissChance(e)).toBeCloseTo(0.65);
    if (type === 'cold') {
      expect(monsterStats(e).dodge).toBe(0);
      expect(monsterStats(e).armor).toBeCloseTo(before.armor * 0.25);
    }
    if (type === 'lightning') expect(monsterStats(e).attackSpeed).toBeGreaterThan(before.attackSpeed);
  });

  it('overdrive damages the golem when it attacks, and can deliver the killing blow', () => {
    const g = boss();
    const e = g.state.combat!.enemies[0]!;
    castCraftedAttack(g.state, g.bus, 'test', spell('lightning'));
    g.state.combat!.introTicks = 0;
    e.hp = 1;
    e.bar = 100000;
    tickCombat(g.state, g.bus, SPOTS.f1_toll_hall);
    expect(g.state.combat).toBeNull();
    expect(hasKeyItem(g.state, 'toll_stamp')).toBe(true);
    expect(g.state.titles).not.toContain('procedural_objection');
  });

  it('awards the secret title on a spell-free kill; a lethal spell silently disqualifies it', () => {
    const brute = boss();
    finish(brute);
    expect(brute.state.titles).toContain('procedural_objection');
    expect(hasKeyItem(brute.state, 'toll_stamp')).toBe(true);
    expect(brute.state.stats['boss:f1_toll_hall']).toBe(1);
    expect(TITLES.procedural_objection.secret).toBe(true);
    const caster = boss();
    castCraftedAttack(caster.state, caster.bus, 'test', spell('heat', 100000));
    expect(caster.state.titles).not.toContain('procedural_objection');
    expect(JSON.stringify(caster.state.log)).not.toContain('Procedural Objection');
    expect(hasKeyItem(caster.state, 'toll_stamp')).toBe(true);
  });

  it('preserves cast disqualification across a reload and resumes the forced encounter', () => {
    const g = boss();
    castCraftedAttack(g.state, g.bus, 'test', spell('heat'));
    const loaded = new Game(deserialize(serialize(g.state)));
    expect(loaded.state.stats[TOLL_SPELL_FLAG]).toBe(1);
    loaded.tick();
    expect(loaded.state.combat?.forced).toBe(true);
    finish(loaded);
    expect(loaded.state.titles).not.toContain('procedural_objection');
    expect(loaded.state.stats[TOLL_SPELL_FLAG]).toBeUndefined();
  });

  it('resets items, search limits and disqualification on prestige', () => {
    const g = boss();
    grantKeyItem(g.state, g.bus, 'toll_clerk_book');
    g.state.stats[searchKey('f1_archive', 'search')] = 4;
    g.state.stats[TOLL_SPELL_FLAG] = 1;
    clearFloors(g.state.stats, ['ascent_f3']);
    const next = prestigeNow(g.state)!;
    expect(next).not.toBeNull();
    expect(hasKeyItem(next, 'toll_clerk_book')).toBe(false);
    expect(next.stats[TOLL_SPELL_FLAG]).toBeUndefined();
    expect(next.stats[searchKey('f1_archive', 'search')]).toBeUndefined();
  });

  it('can actually be defeated with ordinary attacks and no prepared spells', () => {
    const g = boss(17);
    g.state.attrs.str.level = 18;
    g.state.attrs.dex.level = 12;
    const sword = g.state.inventory.find((i) => i.defId === 'rusty_sword');
    if (sword) g.equip(sword.uid);
    until(g, () => !g.state.combat, 15000);
    expect(g.state.lastFight?.outcome).toBe('won');
    expect(g.state.titles).toContain('procedural_objection');
  });
});
