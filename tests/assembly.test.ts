import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { ITEMS, ITEM_CLASSES, MATERIALS, NPCS, PART_KINDS, RECIPES } from '../src/core/registry';
import {
  classifyPlacement,
  enumeratePlacements,
  exemplarSpec,
  featuresOf,
  forgeKey,
  forgeStats,
  forgedDef,
  itemDefOf,
  neighbours,
  partsOf,
  placementCost,
  placementKey,
  placementOf,
  placementProblem,
} from '../src/core/systems/assembly';
import { forgeSlotLocks, formKnown, previewForge } from '../src/core/systems/forging';
import { itemValue, sellPrice, canEquip } from '../src/core/systems/equipment';
import { groupItems, stackKey } from '../src/core/systems/inventory';
import { createItem } from '../src/core/systems/runes';
import { getDerivedStats } from '../src/core/systems/derived';
import { equippedTags } from '../src/core/systems/attributes';
import { deserialize, serialize } from '../src/core/save/save';
import { playerDamageType } from '../src/core/systems/combat';
import { buyPrice } from '../src/core/systems/shops';
import { runeClassOf } from '../src/core/systems/runes';
import { QUALITY_ORDER } from '../src/core/data/quality.data';
import type { ItemDef, ItemInstance, Placement, QualityTier } from '../src/core/types';

/**
 * Modular smithing, slice 1 (docs/plans/blueprint-weaponsmithing.md): the
 * resolver, the kernel, the seam and the anvil's job. The content rules (every
 * exemplar resolves to itself, every class is reachable, the table is total)
 * live in tests/content.test.ts; this file is the numbers and the behaviour.
 */

const IRON = 'iron_ingot';
const WOOD = 'hardwood';
const LEATHER = 'leather';

const part = (kind: string, mat: string, qty?: number) => ({ kind, mat, ...(qty ? { qty } : {}) });
const sword: Placement = { head: part('long', IRON), haft: part('h3', WOOD) };

const spec = (placement: Placement, q: QualityTier = 'c') => ({ parts: partsOf(placement), q });
const modOf = (def: ItemDef, stat: string) => def.mods.find((m) => m.stat === stat)?.value;

/** An instance carrying a placement, the way the anvil makes one. */
function forgedItem(state: { uidCounter: number }, placement: Placement, q: QualityTier = 'c'): ItemInstance {
  state.uidCounter += 1;
  return {
    uid: state.uidCounter,
    defId: `forged:${classifyPlacement(placement).id}`,
    slots: 0,
    runes: [],
    forged: spec(placement, q),
  };
}

describe('calibration: the kernel reproduces the numbers the shop items already have', () => {
  it('long blade 2×6 iron + short handle: a sword, damage 7, crit 2%, speed 0, 2 ingots + 1 hardwood', () => {
    expect(classifyPlacement(sword).id).toBe('sword');
    const def = forgedDef(spec(sword));
    expect(modOf(def, 'damage')).toBe(7);
    expect(modOf(def, 'crit')).toBeCloseTo(0.02, 3);
    expect(modOf(def, 'attackSpeed') ?? 0).toBeCloseTo(0, 3);
    expect(def.requirements).toBeUndefined();
    expect(def.name).toBe('Iron Sword');
    expect(placementCost(sword)).toEqual([
      { id: IRON, qty: 2 },
      { id: WOOD, qty: 1 },
    ]);
  });

  it('great blade 2×10 iron + grip: a greatsword, damage 12, −15% speed, +10% crit damage, STR 12', () => {
    const p: Placement = { head: part('great', IRON), haft: part('h4', WOOD) };
    expect(classifyPlacement(p).id).toBe('greatsword');
    const def = forgedDef(spec(p));
    expect(modOf(def, 'damage')).toBe(12);
    expect(Math.abs(modOf(def, 'attackSpeed')! + 0.15)).toBeLessThan(0.005);
    expect(modOf(def, 'critDamage')).toBeCloseTo(0.1, 2);
    expect(def.requirements).toEqual([{ type: 'attr', attr: 'str', level: 12 }]);
  });

  it('wide plate 4×4 iron + strap: a breastplate, armour 14, −4.9% speed, STR 7, 3 ingots + 1 leather', () => {
    const p: Placement = { head: part('plate_w', IRON), bind: part('strap', LEATHER) };
    expect(classifyPlacement(p).id).toBe('breastplate');
    const def = forgedDef(spec(p));
    expect(modOf(def, 'armor')).toBe(14);
    expect(Math.abs(modOf(def, 'attackSpeed')! + 0.049)).toBeLessThan(0.005);
    expect(def.requirements).toEqual([{ type: 'attr', attr: 'str', level: 7 }]);
    expect(modOf(def, 'damage')).toBeUndefined();
    expect(placementCost(p)).toEqual([
      { id: IRON, qty: 3 },
      { id: LEATHER, qty: 1 },
    ]);
  });

  it('eight rings: chain mail, armour 7, no STR requirement', () => {
    const p: Placement = { head: part('ring', IRON, 8) };
    expect(classifyPlacement(p).id).toBe('chain_mail');
    const def = forgedDef(spec(p));
    expect(modOf(def, 'armor')).toBe(7);
    expect(def.requirements).toBeUndefined();
    expect(modOf(def, 'attackSpeed') ?? 0).toBeCloseTo(0, 3);
  });

  it('the rest of the card’s table: dagger, katana, axe and halberd', () => {
    const dagger = forgedDef(spec({ head: part('short', IRON), haft: part('h3', WOOD) }));
    expect(dagger.name).toBe('Iron Dagger');
    expect(modOf(dagger, 'damage')).toBe(3);
    expect(modOf(dagger, 'attackSpeed')!).toBeCloseTo(0.08, 2);

    const katana = forgedDef(spec({ head: part('curved', IRON), haft: part('h3', WOOD) }));
    expect(katana.name).toBe('Iron Katana');
    expect(modOf(katana, 'damage')).toBe(7);

    const axe = forgedDef(spec({ head: part('axehead', IRON), haft: part('h3', WOOD) }));
    expect(axe.name).toBe('Iron Axe');
    expect(modOf(axe, 'damage')).toBe(8);

    const halberd = forgedDef(spec({ head: part('axehead', IRON), haft: part('h6', WOOD) }));
    expect(halberd.name).toBe('Iron Halberd');
    expect(modOf(halberd, 'damage')).toBe(11);
    expect(halberd.requirements).toEqual([{ type: 'attr', attr: 'str', level: 4 }]);
  });

  it('quality moves damage, armour and value, and is bounded below', () => {
    const at = (q: QualityTier) => forgedDef(spec(sword, q));
    expect(modOf(at('s'), 'damage')!).toBeGreaterThan(modOf(at('c'), 'damage')!);
    expect(modOf(at('f'), 'damage')!).toBeLessThanOrEqual(modOf(at('c'), 'damage')!);
    expect(modOf(at('f'), 'damage')!).toBeGreaterThanOrEqual(1);
    expect(at('s').value).toBeGreaterThan(at('c').value);
    expect(at('f').value).toBeGreaterThanOrEqual(1);
  });

  it('a bronze head carries bronze’s will once; a bronze guard on an iron blade does not', () => {
    const bronze = forgedDef(spec({ head: part('short', 'bronze_ingot'), haft: part('h3', WOOD) }));
    expect(modOf(bronze, 'psiAcuity')).toBe(0.15);
    expect(modOf(bronze, 'psiCoherence')).toBe(0.1);
    expect(bronze.tags).toContain('bronze');
    expect(bronze.name).toBe('Bronze Dagger');
    const iron = forgedDef(spec({ head: part('short', IRON), haft: part('h3', WOOD) }));
    expect(modOf(iron, 'psiAcuity')).toBeUndefined();
    const guarded = forgedDef(
      spec({ head: part('thin', IRON), guard: part('swept', 'bronze_ingot'), haft: part('h3', WOOD) }),
    );
    expect(modOf(guarded, 'psiAcuity')).toBeUndefined();
    // And bronze_dagger itself is untouched.
    expect(ITEMS.bronze_dagger.mods.find((m) => m.stat === 'psiAcuity')?.value).toBe(0.15);
  });

  it('tags are the class tags plus the head materials’; a piece with no head takes its haft’s', () => {
    // The shop's Oak Club is ['blunt', 'wood'], and `requiresTag: 'wood'` mods
    // (mutagens.data.ts) key off it: the forged club and staff must carry it too.
    expect(ITEMS.oak_club.tags).toContain('wood');
    const club = forgedDef(spec({ haft: part('club', WOOD) }));
    expect(club.name).toBe('Hardwood Club');
    expect(club.tags).toEqual(['blunt', 'wood']);
    const staff = forgedDef(spec({ haft: part('h6', WOOD) }));
    expect(staff.name).toBe('Hardwood Quarterstaff');
    expect(staff.tags).toEqual(['staff', 'wood']);
    // The same shapes in iron are metal, not wood.
    expect(forgedDef(spec({ haft: part('club', IRON) })).tags).toEqual(['blunt', 'metal', 'iron']);
    // An iron sword on a hardwood handle is an iron weapon: the handle is not its body.
    const handled = forgedDef(spec(sword));
    expect(handled.tags).toEqual(['sword', 'metal', 'iron']);
    expect(handled.tags).not.toContain('wood');
    // A wooden head is the body: bow limb and shield plate.
    expect(forgedDef(spec(ITEM_CLASSES.bow.exemplar)).tags).toEqual(['bow', 'ranged', 'wood']);
    // And the tag reaches the wield check the mods read.
    const g = new Game(createInitialState(9));
    g.state.equipment.weapon = forgedItem(g.state, { haft: part('club', WOOD) });
    expect(equippedTags(g.state).has('wood')).toBe(true);
    g.state.equipment.weapon = forgedItem(g.state, sword);
    expect(equippedTags(g.state).has('wood')).toBe(false);
  });

  it('rune size follows the cells: ≤9 small, 10–17 medium, ≥18 large', () => {
    const runeOf = (p: Placement) => forgedDef(spec(p)).runeClass;
    expect(runeOf({ head: part('short', IRON), haft: part('h3', WOOD) })).toBe('small'); // 9
    expect(runeOf(sword)).toBe('medium'); // 15
    expect(runeOf({ head: part('plate_w', IRON), bind: part('strap', LEATHER) })).toBe('large'); // 19
    expect(runeClassOf(forgedDef(spec(sword)))).toBe('medium');
  });

  it('damage types: the class names its own, else the family implies one', () => {
    const g = new Game(createInitialState(2));
    const typeOf = (p: Placement) => {
      g.state.equipment.weapon = forgedItem(g.state, p);
      return playerDamageType(g.state);
    };
    expect(typeOf({ head: part('axehead', IRON), haft: part('h3', WOOD) })).toBe('slashing'); // axe
    expect(typeOf({ head: part('axehead', IRON), haft: part('h6', WOOD) })).toBe('slashing'); // halberd, a spear-family weapon
    expect(typeOf({ head: part('spearhead', IRON), haft: part('h6', WOOD) })).toBe('piercing'); // spear family
    expect(typeOf(sword)).toBe('slashing'); // sword family
    expect(typeOf({ head: part('maulhead', IRON), haft: part('h3', WOOD) })).toBe('bludgeoning'); // hammer
  });
});

describe('the resolver is total and finite', () => {
  it('every placement of the catalogue resolves, and every number it produces is finite', () => {
    const bad: string[] = [];
    let n = 0;
    for (const p of enumeratePlacements({ materials: 'tags' })) {
      n++;
      const cls = classifyPlacement(p);
      const k = forgeStats(p, 'c', cls);
      // The empty anvil resolves (to the paperweight) and is the one placement
      // the bench refuses: it has no cells to cost or to sell.
      if (placementProblem(p)) {
        expect(placementKey(p)).toBe('');
        expect(cls.id).toBe('paperweight');
        continue;
      }
      const nums = [k.cells, k.weight, k.g, k.attackSpeed, k.critDamage, k.str, k.value, k.ticks];
      for (const v of [k.damage, k.crit, k.armour]) if (v !== undefined) nums.push(v);
      for (const c of placementCost(p)) nums.push(c.qty);
      const sane =
        nums.every(Number.isFinite) &&
        k.value >= 1 &&
        k.cells >= 1 &&
        k.str >= 0 &&
        (cls.slot !== 'weapon' || k.damage! >= 1) &&
        placementCost(p).every((c) => c.qty >= 1);
      if (!sane && bad.length < 5) bad.push(placementKey(p));
    }
    expect(n).toBeGreaterThan(100_000);
    expect(bad).toEqual([]);
  });

  it('a stratified sample over EVERY accepted material is finite at every quality', () => {
    const bad: string[] = [];
    let i = 0;
    for (const p of enumeratePlacements({ materials: 'all' })) {
      if (i++ % 211 !== 0) continue;
      for (const q of QUALITY_ORDER) {
        const k = forgeStats(p, q);
        const nums = [k.weight, k.g, k.attackSpeed, k.critDamage, k.str, k.value, k.damage ?? 0, k.crit ?? 0, k.armour ?? 0];
        if (!nums.every(Number.isFinite) && bad.length < 5) bad.push(`${placementKey(p)}@${q}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('fill order and slot order are never read: features, class, key and definition are invariant', () => {
    let i = 0;
    for (const p of enumeratePlacements({ materials: 'tags' })) {
      if (i++ % 3001 !== 0) continue;
      const parts = partsOf(p);
      // The same parts handed over in every rotation and in reverse.
      const orders = parts.map((_, r) => [...parts.slice(r), ...parts.slice(0, r)]);
      orders.push([...parts].reverse());
      for (const order of orders) {
        const rebuilt = placementOf(order);
        expect(featuresOf(rebuilt)).toEqual(featuresOf(p));
        expect(classifyPlacement(rebuilt).id).toBe(classifyPlacement(p).id);
        expect(placementKey(rebuilt)).toBe(placementKey(p));
        expect(forgeKey({ parts: order, q: 'c' })).toBe(forgeKey(spec(p)));
      }
      // And the keys of the placement object itself, inserted backwards.
      const backwards: Placement = {};
      for (const slot of Object.keys(p).reverse() as (keyof Placement)[]) backwards[slot] = p[slot];
      expect(featuresOf(backwards)).toEqual(featuresOf(p));
    }
  });

  it('a lone second head is the head moved up: same features, same key', () => {
    const lone: Placement = { head2: part('long', IRON), haft: part('h3', WOOD) };
    expect(featuresOf(lone)).toEqual(featuresOf(sword));
    expect(placementKey(lone)).toBe(placementKey(sword));
    expect(classifyPlacement(lone).id).toBe('sword');
  });

  it('unknown parts and stale quantities still resolve (the resolver never throws)', () => {
    expect(classifyPlacement({ head: part('no_such_part', IRON), haft: part('h3', WOOD) }).id).toBe('stick');
    expect(classifyPlacement({ head: part('ring', IRON, 99) }).id).toBe('chain_mail');
    expect(classifyPlacement({}).id).toBe('paperweight');
    expect(Number.isFinite(forgeStats({ head: part('ring', IRON, -3) }, 'c').weight)).toBe(true);
    // A corrupt stored spec reads as an empty anvil at Fair grade, not as a crash in every stat read.
    const corrupt = { parts: undefined, q: 'zz' } as unknown as Parameters<typeof forgedDef>[0];
    expect(forgedDef(corrupt).id).toBe('forged:paperweight');
    expect(typeof forgeKey(corrupt)).toBe('string');
  });

  it('the last class is the lowest priority and accepts every placement', () => {
    const lowest = Object.values(ITEM_CLASSES).reduce((a, b) => (b.priority < a.priority ? b : a));
    expect(lowest.id).toBe('paperweight');
    expect(lowest.match).toEqual({});
  });

  it('proportions name the product: blade length walks dagger → shortsword → sword → greatsword', () => {
    const by = (kind: string) => classifyPlacement({ head: part(kind, IRON), haft: part('h3', WOOD) }).id;
    expect([by('short'), by('medium'), by('long'), by('great')]).toEqual(['dagger', 'shortsword', 'sword', 'greatsword']);
    expect(by('curved')).toBe('katana');
    expect(by('curved_l')).toBe('odachi');
    expect(by('thin')).toBe('estoc');
  });
});

describe('a corrupt stored spec cannot make a save unbootable', () => {
  // `forged` comes off a save, and every stat read (the cache fingerprint, the
  // modifier pass) reads it for each equipped piece, so one malformed item that
  // throws there would be a save that never loads again. Each shape below
  // threw a TypeError in placementOf before it was made total.
  const SHAPES: [string, unknown][] = [
    ['parts is an object', {}],
    ['parts is a number', 5],
    ['parts holds a null', [null]],
    ['parts holds a bare string and a half-part', ['head', { slot: 'head' }, { slot: 'nowhere', kind: 'long', mat: IRON }]],
  ];

  it.each(SHAPES)('boots and ticks with an equipped piece whose %s', (_name, parts) => {
    const g = new Game(createInitialState(8));
    const item = createItem(g.state, 'forged:sword');
    g.state.inventory.push(item);
    g.equip(item.uid);
    // A second, unequipped copy in the pack, so grouping and stacking read it too.
    g.state.inventory.push({ ...createItem(g.state, 'forged:sword'), forged: { parts: parts as never, q: 'c' } });

    const raw = JSON.parse(serialize(g.state));
    raw.equipment.weapon.forged = { parts, q: 'c' };
    const loaded = deserialize(JSON.stringify(raw));
    const worn = loaded.equipment.weapon!;

    expect(typeof forgeKey(worn.forged!)).toBe('string');
    expect(itemDefOf(worn).id).toBe('forged:paperweight'); // an empty anvil: nothing the parts could name
    expect(() => stackKey(worn)).not.toThrow();
    expect(() => groupItems(loaded.inventory)).not.toThrow();

    const game = new Game(loaded);
    expect(() => getDerivedStats(loaded)).not.toThrow();
    expect(() => game.tick()).not.toThrow();
    expect(loaded.equipment.weapon).toBeDefined(); // still worn: the save did not eat it
  });

  it('keeps the entries it can read and drops the ones it cannot', () => {
    const mixed = [
      null,
      { slot: 'head', kind: 'long', mat: IRON },
      { slot: 'head', kind: 7, mat: IRON },
      { slot: 'haft', kind: 'h3', mat: WOOD, qty: 'many' },
      'junk',
    ];
    expect(placementOf(mixed)).toEqual(sword);
    expect(placementOf({})).toEqual({});
    expect(placementOf(undefined)).toEqual({});
  });

  it('a stored part named like an Object.prototype member does not resolve to it', () => {
    const p: Placement = { head: part('__proto__', IRON), haft: part('constructor', WOOD) };
    expect(classifyPlacement(p).id).toBe('paperweight');
    expect(Number.isFinite(forgeStats(p, 'c').value)).toBe(true);
  });
});

describe('neighbours: one edit away, and a different thing', () => {
  it('every neighbour changes the class and is itself a legal placement', () => {
    for (const cls of Object.values(ITEM_CLASSES)) {
      for (const n of neighbours(cls.exemplar)) {
        expect(n.to.id, `${cls.id} → ${n.change} ${n.slot}`).not.toBe(cls.id);
        expect(classifyPlacement(n.placement).id).toBe(n.to.id);
        expect(placementKey(n.placement)).not.toBe(placementKey(cls.exemplar));
      }
    }
  });

  it('a longer blade is a sword, one more ring is chain mail, a missing haft is a bare blade', () => {
    const from = (p: Placement) => neighbours(p).map((n) => `${n.change}:${n.slot}:${n.part?.kind ?? '-'}>${n.to.id}`);
    expect(from(sword)).toContain('swap:head:great>greatsword');
    expect(from(sword)).toContain('swap:head:short>dagger');
    expect(from(sword)).toContain('remove:haft:->bare_blade');
    expect(from({ head: part('ring', IRON, 7) })).toContain('qty:head:ring>chain_mail');
    // Adding a guard to a sword changes nothing, so it is not offered.
    expect(from(sword).some((s) => s.startsWith('add:guard'))).toBe(false);
  });
});

describe('the item seam', () => {
  it('statics fall through; a forged instance derives from its parts; a stub id mints the exemplar', () => {
    expect(itemDefOf({ defId: 'iron_sword' })).toBe(ITEMS.iron_sword);
    const g = new Game(createInitialState(3));
    const item = forgedItem(g.state, sword);
    expect(itemDefOf(item).name).toBe('Iron Sword');
    expect(itemDefOf(item)).toBe(forgedDef(item.forged!)); // memoised

    const minted = createItem(g.state, 'forged:sword');
    expect(minted.forged).toEqual(exemplarSpec(ITEM_CLASSES.sword));
    expect(minted.slots).toBe(0);
    expect(minted.size).toBe('medium');
    expect(itemDefOf(minted).mods.length).toBeGreaterThan(0);
  });

  it('forged value reads the parts only: sockets and affixes add nothing', () => {
    const g = new Game(createInitialState(3));
    const plain = forgedItem(g.state, sword);
    const dressed: ItemInstance = {
      ...plain,
      slots: 4,
      affix: { name: 'Sharp', mods: [{ stat: 'damage', op: 'mult', value: 0.1 }] },
    };
    expect(itemValue(dressed)).toBe(itemValue(plain));
    expect(itemValue(plain)).toBe(forgedDef(plain.forged!).value);
    // A static item of the same worth still gets both multipliers.
    const stock: ItemInstance = { uid: 99, defId: 'iron_sword', slots: 4, runes: [] };
    expect(itemValue(stock)).toBeGreaterThan(ITEMS.iron_sword.value);
  });

  it('two different forged swords never stack; two identical ones do; grade separates', () => {
    const g = new Game(createInitialState(3));
    const a = forgedItem(g.state, sword);
    const b = forgedItem(g.state, sword);
    const bronze = forgedItem(g.state, { head: part('long', 'bronze_ingot'), haft: part('h3', WOOD) });
    const fine = forgedItem(g.state, sword, 'b');
    expect(a.defId).toBe(bronze.defId); // both swords
    expect(stackKey(a)).toBe(stackKey(b));
    expect(stackKey(a)).not.toBe(stackKey(bronze));
    expect(stackKey(a)).not.toBe(stackKey(fine));
    const stacks = groupItems([a, b, bronze, fine]);
    expect(stacks.map((s) => s.items.length).sort()).toEqual([1, 1, 2]);
    // Static items key exactly as they always did.
    expect(stackKey({ uid: 1, defId: 'iron_sword', slots: 2, runes: [] })).toBe('iron_sword||2|');
  });

  it('equipping a forged weapon changes the derived stats, and the requirement gates it', () => {
    const g = new Game(createInitialState(4));
    const bare = getDerivedStats(g.state);
    const item = forgedItem(g.state, sword);
    g.state.inventory.push(item);
    g.equip(item.uid);
    expect(g.state.equipment.weapon?.uid).toBe(item.uid);
    const armed = getDerivedStats(g.state);
    expect(armed).not.toBe(bare);
    expect(armed.damage - bare.damage).toBeCloseTo(7, 5);
    expect(armed.crit - bare.crit).toBeCloseTo(0.02, 5);

    // STR 12 to hold a great blade.
    const great = forgedItem(g.state, { head: part('great', IRON), haft: part('h4', WOOD) });
    expect(canEquip(g.state, great)).toBe(false);
    g.state.attrs.str.level = 12;
    expect(canEquip(g.state, great)).toBe(true);
  });

  it('nothing in src or forge reads an item’s definition as ITEMS[<instance>.defId]', () => {
    // A site that still spells it that way sees the empty class stub of a
    // forged item: no mods, value 1, no requirements. Silent, so scanned for.
    const ROOT = join(__dirname, '..');
    const WHITELIST = new Set([
      // Migrations read items as they were saved, before `forged` existed.
      'src/core/save/migrations.ts',
      // itemDefOf is the one place that does it, on purpose.
      'src/core/systems/assembly.ts',
    ]);
    const RAW = /ITEMS\[[^\]\n]*\.defId/;
    // The scanner itself: it flags the spellings that matter and not id lookups.
    expect(RAW.test('ITEMS[item.defId]')).toBe(true);
    expect(RAW.test("ITEMS[state.equipment.weapon?.defId ?? '']")).toBe(true);
    expect(RAW.test('ITEMS[defId]')).toBe(false);
    expect(RAW.test('ITEMS[line.id]')).toBe(false);

    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === 'assets' || name.startsWith('.')) continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|svelte)$/.test(name)) files.push(full);
      }
    };
    walk(join(ROOT, 'src'));
    walk(join(ROOT, 'forge'));
    const hits: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      if (WHITELIST.has(rel)) continue;
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (RAW.test(line)) hits.push(`${rel}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(hits).toEqual([]);
  });
});

describe('the price of a forged piece never beats the price of its parts', () => {
  const state = createInitialState(5);
  const lines = NPCS.master_smith.shop!.lines;
  const sold = new Set(lines.map((l) => l.id));
  const stranger = state; // nothing met: the markup is highest
  const known = createInitialState(5);
  known.stats['met:master_smith'] = 1;

  /** What the smith charges for the bill, at charisma 1. */
  const buyCost = (p: Placement, s = known) =>
    placementCost(p).reduce((sum, c) => sum + c.qty * buyPrice(s, 'master_smith', lines.find((l) => l.id === c.id)!, 1), 0);
  const sale = (p: Placement) => sellPrice(state, forgedItem({ uidCounter: 1 }, p), 1);

  it('every class exemplar made of what the smith sells sells for less than buying it all', () => {
    let checked = 0;
    for (const cls of Object.values(ITEM_CLASSES)) {
      const mats = partsOf(cls.exemplar).map((p) => p.mat);
      if (!mats.every((m) => sold.has(m))) continue;
      checked++;
      expect(sale(cls.exemplar), cls.id).toBeLessThanOrEqual(buyCost(cls.exemplar));
      expect(buyCost(cls.exemplar, stranger), cls.id).toBeGreaterThanOrEqual(buyCost(cls.exemplar));
    }
    expect(checked).toBe(Object.keys(ITEM_CLASSES).length);
  });

  it('and so does a sweep of the catalogue in the smith’s materials', () => {
    const mine = Object.fromEntries([IRON, WOOD, LEATHER].map((id) => [id, MATERIALS[id]]));
    const worst: string[] = [];
    let i = 0;
    for (const p of enumeratePlacements({ materials: 'all', materialDefs: mine })) {
      if (i++ % 5 !== 0 || placementProblem(p)) continue;
      if (sale(p) > buyCost(p) && worst.length < 5) worst.push(`${placementKey(p)}: ${sale(p)} > ${buyCost(p)}`);
    }
    expect(worst).toEqual([]);
  });
});

describe('the anvil', () => {
  function smithy(seed = 1) {
    const g = new Game(createInitialState(seed));
    g.state.spot = 'the_forges';
    g.state.materials = { [IRON]: 5, [WOOD]: 5, [LEATHER]: 3 };
    return g;
  }
  const runJob = (g: Game, cap = 3000) => {
    for (let i = 0; i < cap && g.state.benchWork; i++) g.tick();
  };

  it('forges one piece: nothing is spent until it lands, then the bill goes and a forged item arrives', () => {
    const g = smithy();
    expect(formKnown(g.state, 'sword')).toBe(false);
    expect(g.forge(sword)).toBe(true);
    const job = g.state.benchWork!;
    expect(job.disciplineId).toBe('forging');
    expect(job.forge).toEqual(sword);
    expect(job.ticksPer).toBeGreaterThan(100); // 100 + 15 per cell, before skill
    g.tick();
    expect(g.state.materials[IRON]).toBe(5);

    runJob(g);
    expect(g.state.benchWork).toBeNull();
    expect(g.state.materials[IRON]).toBe(3);
    expect(g.state.materials[WOOD]).toBe(4);
    const made = g.state.inventory.at(-1)!;
    expect(made.defId).toBe('forged:sword');
    expect(made.forged!.parts).toEqual(partsOf(sword));
    expect(QUALITY_ORDER).toContain(made.forged!.q);
    expect(made.slots).toBe(0);
    expect(made.size).toBe('medium');
    // Counted for the form chart, and Smithing hears it.
    expect(g.state.stats['forged:sword']).toBe(1);
    expect(formKnown(g.state, 'sword')).toBe(true);
    expect(formKnown(g.state, 'dagger')).toBe(false);
    expect(g.state.stats['crafts']).toBe(1);
    expect(g.state.skills.smithing).toBeDefined();
    expect(g.state.skills.smithing.xp + g.state.skills.smithing.level).toBeGreaterThan(1);
  });

  it('a counted run makes that many; "until the stock runs out" stops dry', () => {
    const g = smithy(2);
    expect(g.forge(sword, 2)).toBe(true);
    runJob(g, 6000);
    expect(g.state.inventory.filter((i) => i.forged).length).toBe(2);
    expect(g.state.materials[IRON]).toBe(1);

    const h = smithy(3);
    h.state.materials = { [IRON]: 4, [WOOD]: 9 };
    h.forge(sword, null);
    runJob(h, 9000);
    expect(h.state.inventory.filter((i) => i.forged).length).toBe(2);
    expect(h.state.materials[IRON]).toBeUndefined();
  });

  it('leaving the anvil abandons the piece at no cost', () => {
    const g = smithy(4);
    g.forge(sword);
    g.state.spot = 'the_long_bench';
    g.tick();
    expect(g.state.benchWork).toBeNull();
    expect(g.state.materials[IRON]).toBe(5);
    expect(g.state.inventory.some((i) => i.forged)).toBe(false);
  });

  it('refuses what it cannot make: too little stock, and slots the smith has not earned', () => {
    const g = smithy(5);
    g.state.materials = { [IRON]: 1, [WOOD]: 1 };
    expect(g.forge(sword)).toBe(false);
    expect(g.state.benchWork).toBeNull();
    expect(previewForge(g.state, sword).reason).toMatch(/Short of Iron Ingot/);

    // Rapier: a guard, which opens at Smithing 5.
    const rapier: Placement = { head: part('thin', IRON), guard: part('swept', IRON), haft: part('h3', WOOD) };
    g.state.materials = { [IRON]: 5, [WOOD]: 5 };
    g.state.skills.smithing = { level: 4, xp: 0 };
    expect(forgeSlotLocks(g.state)).toEqual({ head2: 15, guard: 5 });
    expect(previewForge(g.state, rapier).ok).toBe(false);
    expect(previewForge(g.state, rapier).reason).toMatch(/Smithing 5/);
    expect(g.forge(rapier)).toBe(false);
    g.state.skills.smithing = { level: 5, xp: 0 };
    expect(forgeSlotLocks(g.state)).toEqual({ head2: 15 });
    expect(previewForge(g.state, rapier).ok).toBe(true);
    expect(g.forge(rapier)).toBe(true);
  });

  it('previews the class, the definition, the bill and what is held, for any placement', () => {
    const g = smithy(6);
    const p = previewForge(g.state, { head: part('plate_w', IRON), bind: part('strap', LEATHER) });
    expect(p.class.id).toBe('breastplate');
    expect(p.def.name).toBe('Iron Breastplate');
    expect(p.cost).toEqual([
      { id: IRON, qty: 3, held: 5 },
      { id: LEATHER, qty: 1, held: 3 },
    ]);
    expect(p.affordable).toBe(true);
    expect(p.ticks).toBe(100 + 15 * 19);
    // Not ok yet (the strap slot opens at Smithing 3), but it still answers.
    expect(p.ok).toBe(false);
    expect(p.slotLocks).toEqual({ head2: 15, guard: 5, bind: 3 });
    // A nonsense layout still names a product.
    expect(previewForge(g.state, {}).class.id).toBe('paperweight');
    expect(previewForge(g.state, {}).ok).toBe(false);
  });

  it('a recipe line still mints its static item and also fills in the form chart', () => {
    const g = smithy(7);
    g.state.skills.smithing = { level: 3, xp: 0 };
    g.state.materials = { [IRON]: 2, [WOOD]: 1 };
    g.selectActivity('craft_iron_sword');
    for (let i = 0; i < 2000 && !g.state.inventory.some((it) => it.defId === 'iron_sword'); i++) g.tick();
    const made = g.state.inventory.find((it) => it.defId === 'iron_sword')!;
    expect(made).toBeDefined();
    expect(made.forged).toBeUndefined(); // the static twin, not a forged piece
    expect(g.state.stats['forged:sword']).toBe(1);
    expect(g.state.materials[IRON]).toBeUndefined();
  });

  it('the listed costs of the placed recipes follow their parts', () => {
    const cost = (id: string) => Object.fromEntries(RECIPES[id].cost.map((c) => [c.id, c.qty]));
    expect(cost('iron_dagger')).toEqual({ [IRON]: 1, [WOOD]: 1 });
    expect(cost('iron_sword')).toEqual({ [IRON]: 2, [WOOD]: 1 });
    expect(cost('katana')).toEqual({ [IRON]: 2, [WOOD]: 1 });
    expect(cost('parrying_dagger')).toEqual({ [IRON]: 2, [WOOD]: 1 });
    // The two that moved.
    expect(cost('rapier')).toEqual({ [IRON]: 2, [WOOD]: 1 });
    expect(cost('iron_breastplate')).toEqual({ [IRON]: 3, [LEATHER]: 1 });
  });
});

describe('part kinds', () => {
  it('the odachi part exists, and notation is width × length', () => {
    expect(PART_KINDS.curved_l).toMatchObject({ w: 2, l: 10, curved: true, shape: 'edge' });
    expect(PART_KINDS.short).toMatchObject({ w: 2, l: 3 });
    expect(PART_KINDS.long).toMatchObject({ w: 2, l: 6 });
    expect(PART_KINDS.axehead).toMatchObject({ w: 4, l: 3, cross: true });
  });
});
