import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { ITEMS, MATERIALS, MIRACLES, MONSTERS, SPOTS, STATUSES, TECHNIQUES } from '../src/core/registry';
import { NEUTRAL_POSITION } from '../src/core/data/martial.data';
import { ATTRIBUTE_LIST } from '../src/core/data/attributes.data';
import { SURVIVORS, SURVIVOR_CHAMPION, SURVIVOR_LEVELS } from '../src/core/data/festival.data';
import {
  SURVIVOR_ARCHETYPES,
  SURVIVOR_FAMILIES,
  SURVIVOR_FAMILY_ORDER,
  SURVIVOR_MENDING,
  SURVIVOR_NAME_FIRST,
  SURVIVOR_NAME_LAST,
  SURVIVOR_NAME_MID,
  SURVIVOR_TOOLS,
  SURVIVOR_WEAPON_INFLICTS,
} from '../src/core/data/survivors.data';
import {
  givenName,
  orderTechniques,
  survivorBuild,
  survivorMember,
  weaponFamilyOf,
  weaponQuality,
  type SurvivorBuild,
} from '../src/core/systems/survivorGen';
import { declaredPositions } from '../src/core/systems/martial';
import { specForSource } from '../src/core/systems/spellcraft';
import { baseMonsterAttrs, biasAttrs, kitOf, monsterStats } from '../src/core/systems/monsterStats';
import { getDerivedStats } from '../src/core/systems/derived';
import { liveEnemies, startStagedGroup } from '../src/core/systems/combat';
import { RES_STAT_BY_TYPE } from '../src/core/types';
import type { DamageType } from '../src/core/types';

/**
 * The enemy generator for the royale's survivors (docs/FESTIVAL.md §9.6,
 * systems/survivorGen.ts, data/survivors.data.ts): a build is rebuilt from
 * the field's seed, a survivor's id and species and its tools, and a staged
 * fight carries it as the specimen's kit.
 */

const BLADE = 'ph_survivor_blade';
const BRUTE = 'ph_survivor_brute';
const HALL = 'f1_storerooms';
const SEED = 424242;

const build = (id: number, tools?: string[], monsterId = BLADE, seed = SEED): SurvivorBuild =>
  survivorBuild(seed, { id, monsterId, tools });

/** The first id on a field whose survivor of `monsterId` draws `archetype`. */
function idOf(archetype: string, monsterId = BLADE, seed = SEED): number {
  for (let id = 1; id < 5000; id++) if (build(id, undefined, monsterId, seed).archetype === archetype) return id;
  throw new Error(`no ${archetype} among 5000 survivors`);
}

/** Every technique can be entered from neutral, or from where the others leave a fighter. */
function allReachable(ids: readonly string[]): boolean {
  const reach = new Set<string>([NEUTRAL_POSITION]);
  const open = (id: string) => {
    const from = declaredPositions(TECHNIQUES[id]);
    return from === 'any' || from.some((p) => reach.has(p));
  };
  for (let changed = true; changed; ) {
    changed = false;
    for (const id of ids) {
      if (open(id) && !reach.has(TECHNIQUES[id].to)) {
        reach.add(TECHNIQUES[id].to);
        changed = true;
      }
    }
  }
  return ids.every(open);
}

const techniquesOf = (b: SurvivorBuild): string[] =>
  b.kit.rotation!.flatMap((a) => ('technique' in a ? [a.technique] : []));
const castsOf = (b: SurvivorBuild) => b.kit.rotation!.flatMap((a) => ('cast' in a ? [a] : []));

describe('the tables', () => {
  it('hold at least eight archetypes, each of a known family', () => {
    expect(SURVIVOR_ARCHETYPES.length).toBeGreaterThanOrEqual(8);
    expect(new Set(SURVIVOR_ARCHETYPES.map((a) => a.id)).size).toBe(SURVIVOR_ARCHETYPES.length);
    for (const a of SURVIVOR_ARCHETYPES) expect(SURVIVOR_FAMILIES[a.family], `${a.id} family`).toBeDefined();
    for (const f of SURVIVOR_FAMILY_ORDER) expect(SURVIVOR_FAMILIES[f], `${f} is in the order but is no family`).toBeDefined();
  });

  it('every technique a family can draw exists and is one a monster rotation can run', () => {
    for (const family of Object.values(SURVIVOR_FAMILIES)) {
      expect(RES_STAT_BY_TYPE[family.damageType], `${family.id} damage type`).toBeDefined();
      expect(['melee', 'ranged']).toContain(family.range);
      expect(family.techniques.length, `${family.id} pool`).toBeGreaterThanOrEqual(4);
      expect(new Set(family.techniques).size, `${family.id} lists a technique twice`).toBe(family.techniques.length);
      for (const id of family.techniques) {
        const t = TECHNIQUES[id];
        expect(t, `${family.id} -> ${id}`).toBeDefined();
        // A monster reads a technique's entry positions, its cooldown and its move's
        // damage, type, hits and riders. A buff-only or counter move would be a bare
        // swing that only moves the fighter; a gear-bound one has nothing to act on.
        expect(t.move.damageMult ?? 0, `${id} deals no damage`).toBeGreaterThan(0);
        expect(t.move.buff, `${id} is a buff`).toBeUndefined();
        expect(t.move.counter, `${id} is a counter`).toBeUndefined();
        expect(['weapon_drop', 'ground_draw', 'hidden_draw']).not.toContain(id);
        // Its own family, none, or the family it is a kind of (a katana is also a sword).
        const kin = family.id === 'katana' ? ['katana', 'sword'] : [family.id];
        expect(t.family === undefined || kin.includes(t.family), `${id} belongs to ${t.family}`).toBe(true);
        expect(declaredPositions(t), `${id} has no way in`).not.toEqual([]);
      }
      // Whatever is drawn, the whole pool can be played from neutral.
      expect(allReachable(family.techniques), `${family.id} pool has an unreachable technique`).toBe(true);
      for (const id of family.signature) expect(family.techniques, `${family.id} signature ${id}`).toContain(id);
    }
  });

  it('every archetype’s weapons exist, and are of its family', () => {
    for (const a of SURVIVOR_ARCHETYPES) {
      if (a.family === 'unarmed') expect(a.weapons).toEqual([]);
      else expect(a.weapons.length, `${a.id} has no weapon`).toBeGreaterThan(0);
      for (const id of a.weapons) {
        const item = ITEMS[id];
        expect(item, `${a.id} -> ${id}`).toBeDefined();
        expect(item.slot, `${id} is no weapon`).toBe('weapon');
        expect(weaponFamilyOf(item), `${id} is not a ${a.family}`).toBe(a.family);
      }
    }
  });

  it('every archetype’s numbers and ids are real', () => {
    for (const a of SURVIVOR_ARCHETYPES) {
      expect(a.armor[0], `${a.id} armour`).toBeGreaterThanOrEqual(0);
      expect(a.armor[1], `${a.id} armour`).toBeGreaterThanOrEqual(a.armor[0]);
      expect(a.power).toBeGreaterThanOrEqual(0);
      for (const type of Object.keys(a.resistances ?? {})) expect(RES_STAT_BY_TYPE[type as DamageType], `${a.id} ${type}`).toBeDefined();
      for (const app of a.inflicts ?? []) expect(STATUSES[app.id], `${a.id} inflicts ${app.id}`).toBeDefined();
      for (const [attr, mult] of Object.entries(a.attrs)) {
        expect(ATTRIBUTE_LIST.some((x) => x.id === attr), `${a.id} emphasises ${attr}`).toBe(true);
        expect(mult).toBeGreaterThan(0);
      }
      for (const species of Object.keys(a.species)) expect(MONSTERS[species], `${a.id} species ${species}`).toBeDefined();
    }
    for (const [weapon, apps] of Object.entries(SURVIVOR_WEAPON_INFLICTS)) {
      expect(ITEMS[weapon], weapon).toBeDefined();
      for (const app of apps) expect(STATUSES[app.id], `${weapon} inflicts ${app.id}`).toBeDefined();
    }
  });

  it('every working composes into something real, and a caster or priest has enough to draw from', () => {
    const real = (source: Parameters<typeof specForSource>[0], who: string) => {
      const spec = specForSource(source);
      expect(spec.name, `${who} does not compose`).not.toBe('Faded Inscription');
      expect(spec.cooldown, `${who} cooldown`).toBeGreaterThan(0);
      return spec;
    };
    for (const a of SURVIVOR_ARCHETYPES) {
      if (!a.workings) continue;
      expect(new Set(a.workings.pool.map((w) => w.group)).size, `${a.id} groups`).toBeGreaterThanOrEqual(a.workings.count);
      for (const w of a.workings.pool) {
        if (w.cast.school === 'divine') expect(MIRACLES[w.cast.litany], `${a.id} -> ${w.cast.litany}`).toBeDefined();
        const spec = real(w.cast, `${a.id} ${JSON.stringify(w.cast)}`);
        expect(spec.strikes.length, `${a.id} working strikes nothing`).toBeGreaterThan(0);
      }
    }
    expect(SURVIVOR_ARCHETYPES.some((a) => a.workings?.pool.some((w) => w.cast.school === 'arcane'))).toBe(true);
    expect(SURVIVOR_ARCHETYPES.some((a) => a.workings?.pool.some((w) => w.cast.school === 'divine'))).toBe(true);
    const mending = real(SURVIVOR_MENDING, 'the mending');
    expect(mending.target).toBe('self');
    expect(mending.heal ?? 0).toBeGreaterThan(0);
    for (const a of SURVIVOR_ARCHETYPES) if (a.mending) expect(a.mending).toBeGreaterThan(0);
  });

  it('the name lists give every survivor on a field a name of their own', () => {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const lists = [SURVIVOR_NAME_FIRST, SURVIVOR_NAME_MID, SURVIVOR_NAME_LAST];
    for (const list of lists) expect(new Set(list).size, 'a syllable is listed twice').toBe(list.length);
    // Pairwise coprime lengths: the three positions repeat together only after every combination.
    expect(gcd(lists[0].length, lists[1].length)).toBe(1);
    expect(gcd(lists[0].length, lists[2].length)).toBe(1);
    expect(gcd(lists[1].length, lists[2].length)).toBe(1);
    expect(lists[0].length * lists[1].length * lists[2].length).toBeGreaterThan(SURVIVORS);
  });

  it('the tool dials are sane', () => {
    expect(SURVIVOR_TOOLS.power.cap).toBeGreaterThan(0);
    expect(SURVIVOR_TOOLS.armorCap).toBeGreaterThan(0);
    expect(SURVIVOR_TOOLS.heals).toBeGreaterThanOrEqual(0);
  });
});

describe('determinism', () => {
  it('the same inputs always give the same build, and a build shares nothing with the tables', () => {
    const tools = ['iron_breastplate', 'healing_salve'];
    for (let id = 1; id <= 40; id++) {
      const a = build(id, tools, id % 2 ? BLADE : BRUTE);
      const b = build(id, tools, id % 2 ? BLADE : BRUTE);
      expect(b).toEqual(a);
    }
    const a = build(7);
    // Writing into a returned build changes nothing the next call returns.
    a.kit.rotation!.length = 0;
    (a.kit.inflicts ?? []).push({ id: 'poisoned' });
    for (const w of SURVIVOR_ARCHETYPES.flatMap((x) => x.workings?.pool ?? [])) {
      if (w.cast.school === 'arcane') a.kit.rotation = [{ cast: w.cast }];
    }
    expect(build(7)).toEqual(build(7));
    expect(build(7).kit.rotation!.length).toBeGreaterThan(0);
  });

  it('never touches the game’s own randomness', () => {
    const spy = vi.spyOn(Math, 'random');
    for (let id = 1; id <= 30; id++) build(id, ['iron_sword']);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('a different id or a different field gives a different build', () => {
    const json = (b: SurvivorBuild) => JSON.stringify(b);
    expect(json(build(1))).not.toBe(json(build(2)));
    expect(json(build(1, undefined, BLADE, 1))).not.toBe(json(build(1, undefined, BLADE, 2)));
  });

  it('two hundred survivors are varied, and every archetype appears', () => {
    const builds: SurvivorBuild[] = [];
    for (let id = 1; id <= 200; id++) builds.push(build(id, undefined, id % 2 ? BLADE : BRUTE));
    const seen = new Set(builds.map((b) => b.archetype));
    for (const a of SURVIVOR_ARCHETYPES) expect(seen.has(a.id), `no ${a.id} in 200`).toBe(true);
    expect(new Set(builds.map((b) => JSON.stringify(b.kit))).size).toBeGreaterThan(120);
    expect(new Set(builds.map((b) => b.weapon)).size).toBeGreaterThan(8);
    expect(new Set(builds.flatMap(techniquesOf)).size).toBeGreaterThan(15);
  });

  it('a field’s survivors all have names of their own, whatever the seed', () => {
    for (const seed of [0, 1, 2, 99, 12345, 987654321, -5, 3.7, 0.25]) {
      const names = new Set<string>();
      for (let id = 1; id <= SURVIVORS; id++) names.add(givenName(seed, id));
      expect(names.size, `seed ${seed}`).toBe(SURVIVORS);
    }
  });

  it('the species lean shows in who they are', () => {
    const count = (monsterId: string, ids: string[]) => {
      let n = 0;
      for (let id = 1; id <= 400; id++) if (ids.includes(build(id, undefined, monsterId).archetype)) n++;
      return n;
    };
    const bladeSet = ['duelist', 'assassin', 'archer', 'caster', 'ronin'];
    const bruteSet = ['brawler', 'knight', 'spearman', 'berserker', 'priest'];
    expect(count(BLADE, bladeSet)).toBeGreaterThan(count(BRUTE, bladeSet));
    expect(count(BRUTE, bruteSet)).toBeGreaterThan(count(BLADE, bruteSet));
    expect(count(BLADE, bladeSet)).toBeGreaterThan(400 * 0.6);
    expect(count(BRUTE, bruteSet)).toBeGreaterThan(400 * 0.6);
  });
});

describe('what a build holds', () => {
  const sample: SurvivorBuild[] = [];
  for (let id = 1; id <= 300; id++) sample.push(build(id, undefined, id % 2 ? BLADE : BRUTE));

  it('has two to four techniques of its family, all reachable, deepest first', () => {
    for (const b of sample) {
      const techniques = techniquesOf(b);
      expect(techniques.length, b.name).toBeGreaterThanOrEqual(2);
      expect(techniques.length, b.name).toBeLessThanOrEqual(4);
      expect(new Set(techniques).size, b.name).toBe(techniques.length);
      for (const id of techniques) expect(SURVIVOR_FAMILIES[b.family].techniques, `${b.name} ${id}`).toContain(id);
      expect(allReachable(techniques), `${b.name}: ${techniques.join(', ')}`).toBe(true);
      expect(orderTechniques(techniques), b.name).toEqual(techniques);
    }
  });

  it('orders a chain so that its end is tried before its start', () => {
    expect(orderTechniques(['gather', 'lunge', 'thrust'])).toEqual(['thrust', 'lunge', 'gather']);
    expect(orderTechniques(['thrust', 'gather', 'lunge'])).toEqual(['thrust', 'lunge', 'gather']);
    // Ties keep the order given.
    expect(orderTechniques(['pocket_sand', 'gather'])).toEqual(['pocket_sand', 'gather']);
  });

  it('is a complete kit that resolves through kitOf', () => {
    for (const b of sample) {
      const kit = b.kit;
      expect(kit.rotation!.length, b.name).toBeGreaterThan(0);
      for (const entry of kit.rotation!) {
        if ('technique' in entry) expect(TECHNIQUES[entry.technique], `${b.name} ${entry.technique}`).toBeDefined();
        else expect(specForSource(entry.cast).name, `${b.name} cast`).not.toBe('Faded Inscription');
      }
      expect(RES_STAT_BY_TYPE[kit.damageType!]).toBeDefined();
      expect(['melee', 'ranged']).toContain(kit.range);
      expect(kit.armor).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(kit.inflicts)).toBe(true);
      expect(kit.resistances).toBeDefined();
      // The kit wins over the species' def on every field it holds.
      const read = kitOf({ defId: BLADE, kit });
      expect(read.rotation).toBe(kit.rotation);
      expect(read.damageType).toBe(kit.damageType);
      expect(read.range).toBe(kit.range);
      expect(read.inflicts).toBe(kit.inflicts);
    }
  });

  it('fights with a weapon of its family: its damage type and reach follow it', () => {
    for (const b of sample) {
      const arch = SURVIVOR_ARCHETYPES.find((a) => a.id === b.archetype)!;
      const family = SURVIVOR_FAMILIES[b.family];
      expect(b.family, b.name).toBe(arch.family);
      if (b.weapon === null) {
        expect(arch.weapons, b.name).toEqual([]);
      } else {
        expect(arch.weapons, b.name).toContain(b.weapon);
        expect(weaponFamilyOf(ITEMS[b.weapon]), b.name).toBe(b.family);
      }
      expect(b.kit.damageType, b.name).toBe(ITEMS[b.weapon ?? '']?.damageType ?? family.damageType);
      expect(b.kit.range, b.name).toBe(arch.range ?? family.range);
    }
    expect(build(idOf('archer')).kit.range).toBe('ranged');
    expect(build(idOf('caster')).kit.range).toBe('ranged');
    expect(build(idOf('spearman')).kit.range).toBe('melee');
    expect(build(idOf('spearman')).kit.damageType).toBe('piercing');
    expect(build(idOf('berserker')).kit.damageType).toBe('slashing');
    expect(build(idOf('knight')).kit.damageType).toBe('bludgeoning');
  });

  it('a caster speaks its arcane workings first, a priest its miracles and a mending that waits', () => {
    const count = (id: string) => SURVIVOR_ARCHETYPES.find((a) => a.id === id)!.workings!.count;
    const casters = sample.filter((x) => x.archetype === 'caster');
    expect(casters.length).toBeGreaterThan(5);
    for (const b of casters) {
      const casts = castsOf(b);
      expect(casts.length, b.name).toBe(count('caster'));
      expect(casts.every((c) => 'cast' in c && c.cast.school === 'arcane'), b.name).toBe(true);
      expect(b.kit.rotation!.slice(0, casts.length), b.name).toEqual(casts);
      // Different elements: no sentence twice.
      expect(new Set(casts.map((c) => JSON.stringify(c))).size).toBe(casts.length);
    }
    const priests = sample.filter((x) => x.archetype === 'priest');
    expect(priests.length).toBeGreaterThan(5);
    for (const b of priests) {
      const rotation = b.kit.rotation!;
      const casts = castsOf(b);
      // The miracles it strikes with, then one mending of its own (two uses) after the techniques.
      expect(casts.length, b.name).toBe(count('priest') + 1);
      expect(casts.every((c) => 'cast' in c && c.cast.school === 'divine'), b.name).toBe(true);
      expect(rotation.slice(0, count('priest')), b.name).toEqual(casts.slice(0, count('priest')));
      const last = rotation[rotation.length - 1];
      expect('cast' in last && last.cast.school === 'divine' && last.uses === 2, b.name).toBe(true);
    }
    for (const b of sample.filter((x) => !['caster', 'priest'].includes(x.archetype))) {
      expect(castsOf(b), b.name).toEqual([]);
    }
  });

  it('keeps its armour in the archetype’s range, and its riders and resistances to the archetype’s', () => {
    for (const b of sample) {
      const arch = SURVIVOR_ARCHETYPES.find((a) => a.id === b.archetype)!;
      expect(b.kit.armor!, b.name).toBeGreaterThanOrEqual(arch.armor[0] - 0.01);
      expect(b.kit.armor!, b.name).toBeLessThanOrEqual(arch.armor[1] + 0.01);
      expect(b.kit.resistances, b.name).toEqual(arch.resistances ?? {});
      const own = arch.inflicts ?? [];
      const extra = (b.weapon ? SURVIVOR_WEAPON_INFLICTS[b.weapon] : undefined) ?? [];
      expect(b.kit.inflicts, b.name).toEqual([...own, ...extra]);
    }
    // The knight is the armoured one.
    const knight = build(idOf('knight'));
    const caster = build(idOf('caster'));
    expect(knight.kit.armor!).toBeGreaterThan(caster.kit.armor! + 2);
  });

  it('puts its emphasis where the archetype does, and keeps the total', () => {
    for (const b of sample) {
      for (const a of ATTRIBUTE_LIST) expect(b.attrBias[a.id], `${b.name} ${a.id}`).toBeGreaterThan(0);
    }
    const caster = build(idOf('caster'));
    expect(caster.attrBias.int!).toBeGreaterThan(caster.attrBias.str! * 2);
    const knight = build(idOf('knight', BRUTE), undefined, BRUTE);
    expect(knight.attrBias.con!).toBeGreaterThan(knight.attrBias.dex!);

    // The total holds at the level the survivors start the royale at…
    for (const species of [BLADE, BRUTE]) {
      const reference = baseMonsterAttrs(MONSTERS[species], SURVIVOR_LEVELS.base + SURVIVOR_LEVELS.growth);
      for (let id = 1; id <= 60; id++) {
        const b = build(id, undefined, species);
        const before = ATTRIBUTE_LIST.reduce((s, a) => s + reference[a.id], 0);
        const after = ATTRIBUTE_LIST.reduce((s, a) => s + reference[a.id] * b.attrBias[a.id]!, 0);
        expect(after / before, `${b.name} ${species}`).toBeCloseTo(1, 2);
      }
    }
    // …and exactly, wherever it is applied.
    const attrs = baseMonsterAttrs(MONSTERS[BRUTE], 40);
    const biased = biasAttrs(attrs, build(3, undefined, BRUTE).attrBias);
    const sum = (a: Record<string, number>) => Object.values(a).reduce((s, v) => s + v, 0);
    expect(sum(biased)).toBeCloseTo(sum(attrs), 8);
  });

  it('has a power bonus in levels, bounded', () => {
    for (const b of sample) {
      expect(b.power, b.name).toBeGreaterThanOrEqual(0);
      expect(b.power, b.name).toBeLessThanOrEqual(SURVIVOR_TOOLS.power.cap);
    }
    const powers = new Set(sample.map((b) => b.power));
    expect(powers.size).toBeGreaterThan(5);
  });

  it('is named for the person and the archetype', () => {
    for (const b of sample) {
      const arch = SURVIVOR_ARCHETYPES.find((a) => a.id === b.archetype)!;
      expect(b.name).toBe(`${b.given}, ${arch.name}`);
      expect(b.given).toMatch(/^[A-Z][a-z]+$/);
    }
  });
});

describe('tools merge in', () => {
  it('ignore ids nothing knows, and change nothing', () => {
    const bare = build(5);
    expect(build(5, ['no_such_item', '', 'constructor'])).toEqual(bare);
    expect(build(5, [])).toEqual(bare);
  });

  it('a better weapon replaces the one in hand; damage type, reach and techniques follow its family', () => {
    const id = idOf('duelist');
    const bare = build(id);
    expect(bare.family).toBe('sword');
    expect(weaponQuality(ITEMS.steel_greatsword)).toBeGreaterThan(weaponQuality(ITEMS[bare.weapon!]));
    const armed = build(id, ['steel_greatsword']);
    expect(armed.weapon).toBe('steel_greatsword');
    expect(armed.family).toBe('greatsword');
    expect(armed.kit.damageType).toBe('slashing');
    expect(armed.archetype).toBe(bare.archetype);
    expect(armed.name).toBe(bare.name);
    for (const t of techniquesOf(armed)) expect(SURVIVOR_FAMILIES.greatsword.techniques).toContain(t);
    expect(allReachable(techniquesOf(armed))).toBe(true);
    expect(armed.power).toBeGreaterThan(bare.power - 0.01);

    // Bare hands lose to anything: a bow gives a brawler reach and its family's blows.
    const brawler = build(idOf('brawler', BRUTE), undefined, BRUTE);
    expect(brawler.weapon).toBeNull();
    const archer = build(idOf('brawler', BRUTE), ['hunting_bow'], BRUTE);
    expect(archer.weapon).toBe('hunting_bow');
    expect(archer.kit.range).toBe('ranged');
    expect(archer.kit.damageType).toBe('piercing');
  });

  it('a worse weapon, or a slotless junk id, leaves the weapon alone', () => {
    const id = idOf('ronin');
    const bare = build(id);
    expect(weaponQuality(ITEMS.rusty_sword)).toBeLessThan(weaponQuality(ITEMS[bare.weapon!]));
    expect(build(id, ['rusty_sword'])).toEqual(bare);
  });

  it('the best of several weapons wins, whatever the order', () => {
    const id = idOf('brawler', BRUTE);
    const tools = ['oak_club', 'steel_greatsword', 'old_spear'];
    const a = build(id, tools, BRUTE);
    const b = build(id, [...tools].reverse(), BRUTE);
    expect(a).toEqual(b);
    expect(a.weapon).toBe('steel_greatsword');
  });

  it('a caster keeps its staff and its reach, and an archer its bow', () => {
    for (const archetype of ['caster', 'priest', 'archer']) {
      const id = idOf(archetype);
      const bare = build(id);
      const armed = build(id, ['steel_greatsword', 'moonlit_katana']);
      expect(armed.weapon, archetype).toBe(bare.weapon);
      expect(armed.kit, archetype).toEqual(bare.kit);
    }
  });

  it('worn armour adds to the kit’s armour at the survivors’ level, to a cap, and resistances add as they are', () => {
    const id = idOf('duelist');
    const bare = build(id);
    const factor = 1 + 0.05 * (SURVIVOR_LEVELS.base + SURVIVOR_LEVELS.growth - 1);
    const plated = build(id, ['iron_breastplate']);
    expect(plated.kit.armor! - bare.kit.armor!).toBeCloseTo(14 / factor, 1);
    // One piece a slot: the better chest piece counts, the other does not.
    expect(build(id, ['cloth_tunic', 'iron_breastplate']).kit).toEqual(plated.kit);
    expect(build(id, ['iron_breastplate', 'cloth_tunic']).kit).toEqual(plated.kit);
    // Two slots add.
    const two = build(id, ['iron_breastplate', 'soldier_greaves']);
    expect(two.kit.armor!).toBeGreaterThan(plated.kit.armor!);
    // A cloak that resists.
    const cloaked = build(id, ['wolf_cloak']);
    expect(cloaked.kit.resistances!.slashing).toBeCloseTo(0.12, 5);
    // The cap.
    const all = ['iron_breastplate', 'soldier_greaves', 'iron_gauntlets', 'leather_cap', 'leather_boots', 'tower_shield', 'spellwoven_cloak'];
    expect(build(idOf('knight'), all).kit.armor!).toBeLessThanOrEqual(SURVIVOR_TOOLS.armorCap + 0.01);
  });

  it('an accessory adds a little armour, and at most two count', () => {
    const id = idOf('assassin');
    const bare = build(id);
    const one = build(id, ['pilgrim_amulet']);
    expect(one.kit.armor!).toBeCloseTo(bare.kit.armor! + SURVIVOR_TOOLS.accessoryArmor, 1);
    const two = build(id, ['pilgrim_amulet', 'lucky_charm']);
    const three = build(id, ['pilgrim_amulet', 'lucky_charm', 'hawk_feather_band']);
    expect(two.kit.armor!).toBeCloseTo(bare.kit.armor! + 2 * SURVIVOR_TOOLS.accessoryArmor, 1);
    expect(three.kit.armor!).toBeCloseTo(two.kit.armor!, 5);
    // A charm that resists adds what it resists.
    expect(build(id, ['herbal_charm']).kit.resistances!.poison).toBeCloseTo(0.15, 5);
  });

  it('a healing tool becomes a one-use mending at the end of the rotation, up to the limit', () => {
    expect(MATERIALS.healing_salve.consumable?.restore?.some((r) => r.resource === 'hp')).toBe(true);
    const id = idOf('duelist');
    const bare = build(id);
    const one = build(id, ['healing_salve']);
    expect(one.kit.rotation).toEqual([...bare.kit.rotation!, { cast: SURVIVOR_MENDING, uses: 1 }]);
    const many = build(id, ['healing_salve', 'healing_salve', 'healing_salve', 'healing_salve']);
    expect(many.kit.rotation!.length).toBe(bare.kit.rotation!.length + SURVIVOR_TOOLS.heals);
    const mendings = castsOf(many);
    expect(mendings.every((m) => m.uses === 1)).toBe(true);
    // The mending is a working that closes the caster's wounds.
    const spec = specForSource(SURVIVOR_MENDING);
    expect(spec.target).toBe('self');
    expect(spec.heal ?? 0).toBeGreaterThan(0);
    // A priest keeps its own mending as well.
    const priest = build(idOf('priest'), ['healing_salve']);
    expect(castsOf(priest).filter((c) => 'cast' in c && c.cast.school === 'divine').length).toBeGreaterThanOrEqual(2);
  });

  it('each tool raises power a little, and the total stays bounded', () => {
    const id = idOf('spearman');
    const bare = build(id);
    const kitted = build(id, ['iron_breastplate', 'pilgrim_amulet', 'healing_salve']);
    expect(kitted.power).toBeGreaterThan(bare.power);
    const everything = Object.keys(ITEMS).filter((k) => !k.startsWith('forged:'));
    const loaded = build(id, [...everything, 'healing_salve', 'healing_salve']);
    expect(loaded.power).toBeLessThanOrEqual(SURVIVOR_TOOLS.power.cap);
    expect(loaded.power).toBeGreaterThan(kitted.power);
    expect(loaded.kit.armor!).toBeLessThanOrEqual(SURVIVOR_TOOLS.armorCap + 0.01);
  });

  it('tools never change who the survivor is', () => {
    for (let id = 1; id <= 60; id++) {
      const bare = build(id);
      const kitted = build(id, ['iron_breastplate', 'steel_greatsword', 'healing_salve']);
      expect(kitted.name, String(id)).toBe(bare.name);
      expect(kitted.archetype, String(id)).toBe(bare.archetype);
      expect(kitted.attrBias, String(id)).toEqual(bare.attrBias);
    }
  });
});

describe('survivorMember', () => {
  it('is the staged member for a survivor meeting the player', () => {
    const fighter = { id: 12, monsterId: BRUTE, tools: ['iron_breastplate'] };
    const b = survivorBuild(SEED, fighter);
    const member = survivorMember(SEED, fighter, 37, 0.6, false);
    expect(member.monsterId).toBe(BRUTE);
    expect(member.level).toBe(37);
    expect(member.hpShare).toBe(0.6);
    expect(member.name).toBe(b.name);
    expect(member.kit).toEqual(b.kit);
    expect(member.attrBias).toEqual(b.attrBias);
  });

  it('the champion is the champion’s def, keeps its title after the given name, and fights with its build', () => {
    const fighter = { id: 12, monsterId: BLADE };
    const b = survivorBuild(SEED, fighter);
    const member = survivorMember(SEED, fighter, 40, 1, true);
    expect(member.monsterId).toBe(SURVIVOR_CHAMPION);
    expect(member.name).toBe(`${b.given}, ${MONSTERS[SURVIVOR_CHAMPION].name}`);
    expect(member.kit).toEqual(b.kit);
  });
});

describe('a staged fight with generated kits', () => {
  function fight(archetype: string, strong: boolean): { g: Game; ticks: number } {
    const monsterId = archetype === 'knight' || archetype === 'brawler' ? BRUTE : BLADE;
    const id = idOf(archetype, monsterId);
    const s = createInitialState(9, HALL);
    s.stats['flag:tutorial_done'] = 1;
    if (strong) for (const a of ATTRIBUTE_LIST) s.attrs[a.id].level = 400;
    const g = new Game(s);
    g.state.resources.hp = getDerivedStats(g.state).maxHp;
    startStagedGroup(g.state, g.bus, SPOTS[HALL], [
      survivorMember(SEED, { id, monsterId, tools: ['iron_breastplate', 'healing_salve'] }, 36, 1, false),
    ]);
    const e = liveEnemies(g.state.combat!)[0];
    expect(e.kit, archetype).toBeDefined();
    expect(monsterStats(e).armor, archetype).toBeGreaterThan(0);
    let ticks = 0;
    for (; ticks < 20000 && g.state.combat; ticks++) g.tick();
    return { g, ticks };
  }

  it('runs to an end for every archetype, won against a strong player', () => {
    for (const a of SURVIVOR_ARCHETYPES) {
      const { g, ticks } = fight(a.id, true);
      expect(g.state.combat, `${a.id} never ended (${ticks} ticks)`).toBeNull();
      expect(g.state.lastFight?.outcome, a.id).toBe('won');
    }
  });

  it('runs to an end for every archetype, lost against a new player', () => {
    for (const a of SURVIVOR_ARCHETYPES) {
      const { g, ticks } = fight(a.id, false);
      expect(g.state.combat, `${a.id} never ended (${ticks} ticks)`).toBeNull();
      expect(['knocked_out', 'dead'], a.id).toContain(g.state.lastFight?.outcome);
    }
  });
});
