import { describe, expect, it } from 'vitest';
import { ITEM_CLASSES, MATERIALS, PART_KINDS } from '../src/core/registry';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { deserialize, serialize } from '../src/core/save/save';
import { getDerivedStats } from '../src/core/systems/derived';
import {
  classifyPlacement,
  enumeratePlacements,
  forgeStats,
  forgeTicks,
  neighbours,
  placementKey,
} from '../src/core/systems/assembly';
import { benchJobTicks, benchPace } from '../src/core/systems/benchwork';
import { FORGING, previewForge } from '../src/core/systems/forging';
import { FORGE_SLOTS } from '../src/core/data/parts.data';
import type { GameState, Placement } from '../src/core/types';
import { anvil, loadOnAnvil, resetAnvil, runKey, setLayout, syncAnvil } from '../src/ui/lib/anvil.svelte';
import { clearFloors } from './fixtures/floors';
import {
  COMPARE_COLUMNS,
  PART_FAMILIES,
  adaptMaterials,
  cellsOfMaterial,
  chartEntries,
  classesForIndex,
  compareKinds,
  distinctNeighbours,
  familiesOf,
  familyOf,
  kindRowLabel,
  kindsOfFamily,
  materialColor,
  materialsFor,
  metalUnits,
  neighbourLabel,
  offeredMaterials,
  pairStatLines,
  partText,
  pickMaterial,
  pieceLines,
  placementText,
  sameShape,
  silhouetteOf,
  slotRole,
  statLines,
  withPart,
  type ChartSetup,
  type PartFamilyId,
} from '../src/ui/lib/anvilView';

/**
 * The anvil screens' pure half (src/ui/lib/anvilView.ts): the silhouette's
 * geometry, the stat lines, the form chart's cells and the material choices.
 * What a placement resolves to and what it is worth are pinned in
 * tests/assembly.test.ts; this file is what the panels do with those numbers.
 */

const IRON = 'iron_ingot';
const BRONZE = 'bronze_ingot';
const WOOD = 'hardwood';
const LEATHER = 'leather';

const part = (kind: string, mat: string, qty?: number) => ({ kind, mat, ...(qty ? { qty } : {}) });
const sword: Placement = { head: part('long', IRON), haft: part('h3', WOOD) };
const NO_SETUP: ChartSetup = { guard: null, bind: null, count: 1 };

describe('anvil view: materials', () => {
  it('offers a part the materials it accepts, in the order it lists its tags', () => {
    expect(materialsFor(PART_KINDS.h3).map((m) => m.id)).toEqual([WOOD, IRON, BRONZE]);
    expect(materialsFor(PART_KINDS.strap).map((m) => m.id)).toEqual([LEATHER]);
    // A metal-only part never offers wood or leather.
    expect(materialsFor(PART_KINDS.long).map((m) => m.id)).toEqual([IRON, BRONZE]);
  });

  it('shows what is held and what is already chosen, not a metal the player has never seen', () => {
    const held = { [IRON]: 4, [WOOD]: 2 };
    expect(offeredMaterials(PART_KINDS.h3, held).map((m) => m.id)).toEqual([WOOD, IRON]);
    // The slot's own material stays offered even at zero held: it can be switched away from.
    expect(offeredMaterials(PART_KINDS.h3, { [IRON]: 4 }, WOOD).map((m) => m.id)).toEqual([WOOD, IRON]);
  });

  it('never leaves a picker empty: with nothing held, one stand-in per accepted tag', () => {
    expect(offeredMaterials(PART_KINDS.h3, {}).map((m) => m.id)).toEqual([WOOD, IRON]);
    expect(offeredMaterials(PART_KINDS.long, {}).map((m) => m.id)).toEqual([IRON]);
  });

  it('adds the stand-in even when the slot holds a material the pack has none of', () => {
    // A bronze head with no bronze (and no iron) in the pack: iron is offered beside it, in canonical order.
    expect(offeredMaterials(PART_KINDS.long, {}, BRONZE).map((m) => m.id)).toEqual([IRON, BRONZE]);
    // A hardwood haft with nothing held: wood stays, iron is the metal stand-in.
    expect(offeredMaterials(PART_KINDS.h3, {}, WOOD).map((m) => m.id)).toEqual([WOOD, IRON]);
    // Once anything accepted is held the stand-in is not added: bronze held, no iron shown.
    expect(offeredMaterials(PART_KINDS.long, { [BRONZE]: 3 }, BRONZE).map((m) => m.id)).toEqual([BRONZE]);
  });

  it('gives a new part the first material it lists, or one it was asked to keep', () => {
    expect(pickMaterial(PART_KINDS.h3, [])).toBe(WOOD);
    expect(pickMaterial(PART_KINDS.h3, [IRON])).toBe(IRON);
    // A preference the part does not accept is skipped.
    expect(pickMaterial(PART_KINDS.strap, [IRON])).toBe(LEATHER);
    expect(pickMaterial(PART_KINDS.long, [WOOD, undefined, BRONZE])).toBe(BRONZE);
  });

  it('colours a material by its tag, with a token for every forgeable one', () => {
    expect(materialColor(IRON)).toBe('var(--mat-iron)');
    expect(materialColor(BRONZE)).toBe('var(--mat-bronze)');
    expect(materialColor(WOOD)).toBe('var(--mat-wood)');
    expect(materialColor(LEATHER)).toBe('var(--mat-leather)');
    expect(materialColor('nothing_like_this')).toBe('var(--text-dim)');
    for (const m of Object.values(MATERIALS)) {
      if (m.smith) expect(materialColor(m.id), m.id).toMatch(/^var\(--mat-/);
    }
  });
});

describe('anvil view: text', () => {
  it('writes a part as its kind, size, count and material', () => {
    expect(partText(part('long', IRON))).toBe('Long blade 2×6 (Iron)');
    expect(partText(part('ring', IRON, 8))).toBe('Metal ring 1×1 ×8 (Iron)');
    expect(placementText(sword)).toBe('Long blade 2×6 (Iron) + Short handle 1×3 (Hardwood)');
  });

  it('counts cells per material across slots and quantities', () => {
    const p: Placement = { head: part('ring', IRON, 8), haft: part('h4', IRON), bind: part('cord', LEATHER) };
    expect(cellsOfMaterial(p, IRON)).toBe(8 + 4);
    expect(cellsOfMaterial(p, LEATHER)).toBe(4);
    expect(cellsOfMaterial(p, WOOD)).toBe(0);
  });

  it('prints the kernel numbers of the calibration sword', () => {
    const stats = forgeStats(sword, 'c');
    const lines = Object.fromEntries(statLines(stats, []).map((l) => [l.label, l.value]));
    expect(lines['Damage']).toBe('+7');
    expect(lines['Crit chance']).toBe('+2.0%');
    expect(lines['Cells']).toBe('15');
    // A reference-weight sword has no attack speed line and no crit damage line.
    expect(lines['Attack speed']).toBeUndefined();
    expect(lines['Crit damage']).toBeUndefined();
  });

  it('says "none" for a piece with no base stats, and lists a material\'s own mods', () => {
    const ring: Placement = { head: part('ring', IRON) };
    const cls = classifyPlacement(ring);
    expect(cls.slot).toBe('accessory');
    const lines = statLines(forgeStats(ring, 'c'), []);
    expect(lines.find((l) => l.label === 'Base stats')?.value).toBe('none');
    const bronze: Placement = { head: part('short', BRONZE), haft: part('h3', WOOD) };
    const mods = MATERIALS[BRONZE].smith!.mods ?? [];
    expect(mods.length).toBeGreaterThan(0);
    const withMods = statLines(forgeStats(bronze, 'c'), mods);
    expect(withMods.filter((l) => l.label === 'Material')).toHaveLength(mods.length);
  });
});

describe('anvil view: silhouette', () => {
  it('draws one rect per cell, with a plain blade narrowed at the tip', () => {
    const sil = silhouetteOf(sword);
    const rects = sil.shapes.filter((s) => s.t === 'rect');
    // Blade 2×6 less the narrowed tip row (1 cell), plus the 1×3 handle.
    expect(rects).toHaveLength(2 * 6 - 1 + 3);
    expect(sil.shapes.every((s) => s.t === 'rect')).toBe(true);
    // The handle is below the blade: the piece is taller than it is wide.
    expect(sil.maxY - sil.minY).toBe(9);
    expect(sil.maxX - sil.minX).toBe(2);
  });

  it('draws rings as circles, four to a row, and a coif or mail shirt side by side', () => {
    const mail = silhouetteOf({ head: part('ring', IRON, 8) });
    expect(mail.shapes.filter((s) => s.t === 'ring')).toHaveLength(8);
    expect(mail.shapes.some((s) => s.t === 'rect')).toBe(false);
    const rows = new Set(mail.shapes.map((s) => (s.t === 'ring' ? s.cy : -1)));
    expect(rows.size).toBe(2);
  });

  it('keeps the rings of two head slots apart', () => {
    const both = silhouetteOf({ head: part('ring', IRON, 2), head2: part('ring', IRON, 2) });
    const centres = both.shapes.flatMap((s) => (s.t === 'ring' ? [`${s.cx},${s.cy}`] : []));
    expect(new Set(centres).size).toBe(4);
  });

  it('draws a bow as an arc with a string, and a necklace as a curve over its ring', () => {
    const bow = silhouetteOf({ head: part('bent_l', WOOD), bind: part('cord', LEATHER) });
    expect(bow.shapes.filter((s) => s.t === 'line')).toHaveLength(1);
    const amulet = silhouetteOf({ head: part('ring', IRON), bind: part('cord', LEATHER) });
    expect(amulet.shapes.filter((s) => s.t === 'arc')).toHaveLength(1);
    expect(amulet.shapes.filter((s) => s.t === 'ring')).toHaveLength(1);
  });

  it('hangs an axe head to one side of its haft', () => {
    const axe = silhouetteOf({ head: part('axehead', IRON), haft: part('h3', WOOD) });
    const xs = axe.shapes.flatMap((s) => (s.t === 'rect' ? [s.x] : []));
    expect(Math.min(...xs)).toBe(-3);
    expect(Math.max(...xs)).toBe(0);
  });

  it('gives an empty anvil a unit box and nothing to draw', () => {
    const sil = silhouetteOf({});
    expect(sil.shapes).toHaveLength(0);
    expect([sil.minX, sil.minY, sil.maxX, sil.maxY]).toEqual([0, 0, 1, 1]);
  });

  it('is total: placements across the catalogue have finite bounds and hold their shapes', () => {
    // Every 31st placement (the sweep is tens of thousands, and each draw classifies it) plus every exemplar.
    const sample: Placement[] = Object.values(ITEM_CLASSES).map((c) => c.exemplar);
    let n = 0;
    for (const p of enumeratePlacements({ materials: 'tags' })) if (n++ % 31 === 0) sample.push(p);
    for (const p of sample) {
      // The empty layout is enumerated (it resolves) but has nothing to draw: the panel says so instead.
      if (Object.keys(p).length === 0) continue;
      const sil = silhouetteOf(p);
      const key = placementKey(p);
      expect(Number.isFinite(sil.minX + sil.minY + sil.maxX + sil.maxY), key).toBe(true);
      expect(sil.maxX).toBeGreaterThan(sil.minX);
      expect(sil.maxY).toBeGreaterThan(sil.minY);
      expect(sil.shapes.length, key).toBeGreaterThan(0);
    }
  });
});

describe('anvil view: one change away', () => {
  it('shows one change per product and none that touch a shut slot', () => {
    const all = neighbours(sword);
    const distinct = distinctNeighbours(all, {});
    expect(new Set(distinct.map((n) => n.to.id)).size).toBe(distinct.length);
    expect(distinct.length).toBeLessThan(all.length);
    // A guard on a thin blade makes a rapier; with the guard slot shut that is not offered.
    const estoc: Placement = { head: part('thin', IRON), haft: part('h3', WOOD) };
    const withGuard = distinctNeighbours(neighbours(estoc), {});
    expect(withGuard.some((n) => n.slot === 'guard' && n.to.id === 'rapier')).toBe(true);
    const shut = distinctNeighbours(neighbours(estoc), { guard: 5 });
    expect(shut.some((n) => n.slot === 'guard')).toBe(false);
  });

  it('labels a swap, an addition, a removal and a count', () => {
    const estoc: Placement = { head: part('thin', IRON), haft: part('h3', WOOD) };
    const find = (change: string, slot: string) => neighbours(estoc).find((n) => n.change === change && n.slot === slot)!;
    expect(neighbourLabel(find('remove', 'haft'), 'Haft')).toBe('no haft');
    expect(neighbourLabel(find('add', 'guard'), 'Guard')).toMatch(/^\+ guard: /);
    const swap = find('swap', 'head');
    expect(neighbourLabel(swap, 'Head')).toBe(`${PART_KINDS[swap.part!.kind].name} ${PART_KINDS[swap.part!.kind].w}×${PART_KINDS[swap.part!.kind].l}`);
    const rings: Placement = { head: part('ring', IRON, 4) };
    const more = neighbours(rings).find((n) => n.change === 'qty' && n.part?.qty === 8);
    // Stepping by one does not reach mail from four rings; five rings is still a coif.
    expect(more).toBeUndefined();
    const seven = neighbours({ head: part('ring', IRON, 7) }).find((n) => n.change === 'qty' && n.part?.qty === 8);
    expect(seven && neighbourLabel(seven, 'Head')).toBe('Metal ring ×8');
  });
});

describe('anvil view: form chart', () => {
  it('resolves a cell to the form its parts make', () => {
    const cell = chartEntries('long', 'h3', NO_SETUP);
    expect(cell.map((e) => e.cls.id)).toEqual(['sword']);
    expect(chartEntries('short', null, NO_SETUP).map((e) => e.cls.id)).toEqual(['bare_blade']);
    expect(chartEntries(null, 'club', NO_SETUP).map((e) => e.cls.id)).toEqual(['club']);
  });

  it('honours the guard, the binding and the head count', () => {
    expect(chartEntries('thin', 'h3', { ...NO_SETUP, guard: 'swept' }).map((e) => e.cls.id)).toEqual(['rapier']);
    expect(chartEntries('plate_w', null, { ...NO_SETUP, bind: 'strap' }).map((e) => e.cls.id)).toEqual(['breastplate']);
    expect(chartEntries('ring', null, { ...NO_SETUP, count: 8 }).map((e) => e.cls.id)).toEqual(['chain_mail']);
    expect(chartEntries('ring', null, { ...NO_SETUP, count: 4 }).map((e) => e.cls.id)).toEqual(['chain_coif']);
    // A head that takes one copy ignores the count.
    expect(chartEntries('long', 'h3', { ...NO_SETUP, count: 8 }).map((e) => e.cls.id)).toEqual(['sword']);
    // Bent pieces take two at most.
    expect(chartEntries('bent_s', null, { ...NO_SETUP, count: 8 })[0].placement.head?.qty).toBe(2);
  });

  it('shows both products when the head\'s material changes the form', () => {
    // A long bent piece with a cord and no haft is a bow in wood and a shin guard in metal.
    const ids = chartEntries('bent_l', null, { ...NO_SETUP, bind: 'cord' }).map((e) => e.cls.id);
    expect(ids.sort()).toEqual(['bow', 'shin_guard']);
  });

  it('has nothing to say about a cell with nothing in it', () => {
    expect(chartEntries(null, null, NO_SETUP)).toEqual([]);
    // With a guard chosen the cell is a real placement, and resolves to the last class.
    expect(chartEntries(null, null, { ...NO_SETUP, guard: 'boss' }).map((e) => e.cls.id)).toEqual(['paperweight']);
  });

  it('every placement a cell offers is valid and resolves to the class it names', () => {
    for (const head of [null, ...Object.values(PART_KINDS).filter((k) => k.role === 'head').map((k) => k.id)]) {
      for (const haft of [null, ...Object.values(PART_KINDS).filter((k) => k.role === 'haft').map((k) => k.id)]) {
        for (const e of chartEntries(head, haft, { guard: 'cross', bind: 'strap', count: 2 })) {
          expect(classifyPlacement(e.placement).id, `${head}/${haft}`).toBe(e.cls.id);
        }
      }
    }
  });

  it('reaches every form that does not need a second head', () => {
    const reached = new Set<string>();
    const heads = [null, ...Object.values(PART_KINDS).filter((k) => k.role === 'head').map((k) => k.id)];
    const hafts = [null, ...Object.values(PART_KINDS).filter((k) => k.role === 'haft').map((k) => k.id)];
    const guards = [null, ...Object.values(PART_KINDS).filter((k) => k.role === 'guard').map((k) => k.id)];
    const binds = [null, ...Object.values(PART_KINDS).filter((k) => k.role === 'bind').map((k) => k.id)];
    for (const guard of guards) {
      for (const bind of binds) {
        for (const count of [1, 2, 4, 8]) {
          for (const h of heads) {
            for (const f of hafts) {
              for (const e of chartEntries(h, f, { guard, bind, count })) reached.add(e.cls.id);
            }
          }
        }
      }
    }
    // The chart's footnote says forms using a second head are not on the grid. This is that list.
    const missing = Object.values(ITEM_CLASSES)
      .filter((c) => !reached.has(c.id))
      .map((c) => c.id)
      .sort();
    for (const id of missing) {
      expect(ITEM_CLASSES[id].exemplar.head2, `${id} is off the grid but needs no second head`).toBeDefined();
    }
  });

  it('dresses a chart placement in the anvil\'s materials unless that changes the form', () => {
    const chart = chartEntries('short', 'h3', NO_SETUP)[0].placement;
    const mine: Placement = { head: part('long', BRONZE), haft: part('h4', IRON) };
    const dressed = adaptMaterials(chart, mine);
    expect(dressed.head?.mat).toBe(BRONZE);
    // A haft keeps the anvil's haft material, not the head's.
    expect(dressed.haft?.mat).toBe(IRON);
    expect(classifyPlacement(dressed).id).toBe(classifyPlacement(chart).id);

    // The bow needs a wooden head: the anvil's metal head must not be forced on it.
    const bow = chartEntries('bent_l', null, { ...NO_SETUP, bind: 'cord' }).find((e) => e.cls.id === 'bow')!.placement;
    const adapted = adaptMaterials(bow, { head: part('long', IRON) });
    expect(classifyPlacement(adapted).id).toBe('bow');
  });

  it('compares layouts by kinds and counts, not materials', () => {
    expect(sameShape(sword, { head: part('long', BRONZE), haft: part('h3', IRON) })).toBe(true);
    expect(sameShape(sword, { head: part('long', IRON) })).toBe(false);
    expect(sameShape({ head: part('ring', IRON, 2) }, { head: part('ring', IRON, 3) })).toBe(false);
    expect(sameShape({}, {})).toBe(true);
  });

  it('lists every class once, weapons first', () => {
    const list = classesForIndex();
    expect(list).toHaveLength(Object.keys(ITEM_CLASSES).length);
    expect(new Set(list.map((c) => c.id)).size).toBe(list.length);
    const firstNonWeapon = list.findIndex((c) => c.slot !== 'weapon');
    expect(list.slice(0, firstNonWeapon).every((c) => c.slot === 'weapon')).toBe(true);
    expect(list.slice(firstNonWeapon).some((c) => c.slot === 'weapon')).toBe(false);
  });
});

describe('anvil view: the silhouette draws every part that is billed', () => {
  const sig = (p: Placement) => JSON.stringify(silhouetteOf(p).shapes);

  /** Every slot of a placement, removed one at a time; the drawing must change each time. */
  function removalsThatChangeNothing(p: Placement): string[] {
    const filled = FORGE_SLOTS.filter((s) => p[s]);
    if (filled.length < 2) return [];
    const base = sig(p);
    const same: string[] = [];
    for (const slot of filled) {
      const rest: Placement = { ...p };
      delete rest[slot];
      if (sig(rest) === base) same.push(`${placementKey(p)} without ${slot} (${classifyPlacement(p).id})`);
    }
    return same;
  }

  it('draws a guard on armour and jewellery', () => {
    const plain: Placement = { head: part('plate_w', IRON), bind: part('strap', LEATHER) };
    const bossed: Placement = { ...plain, guard: part('boss', IRON) };
    expect(classifyPlacement(bossed).id).toBe('breastplate');
    expect(sig(bossed)).not.toBe(sig(plain));
    // The guard is beside the plate, not on it: it widens the drawing.
    expect(silhouetteOf(bossed).maxX).toBeGreaterThan(silhouetteOf(plain).maxX);
  });

  it('draws a second head and a guard on a bow, below it', () => {
    const bow: Placement = { head: part('bent_l', WOOD), bind: part('cord', LEATHER) };
    const armed: Placement = { ...bow, head2: part('long', IRON) };
    expect(classifyPlacement(bow).id).toBe('bow');
    expect(classifyPlacement(armed).id).toBe('bow');
    expect(sig(armed)).not.toBe(sig(bow));
    expect(silhouetteOf(armed).maxY).toBeGreaterThan(silhouetteOf(bow).maxY);
    const guarded: Placement = { ...bow, guard: part('cross', IRON) };
    expect(classifyPlacement(guarded).id).toBe('bow');
    expect(sig(guarded)).not.toBe(sig(bow));
  });

  it('places rings after a bent piece beside it instead of on top of it', () => {
    const p: Placement = { head: part('bent_s', IRON), head2: part('ring', IRON, 2) };
    const sil = silhouetteOf(p);
    const bentX = sil.shapes.flatMap((s) => (s.t === 'rect' ? [s.x] : []));
    const ringX = sil.shapes.flatMap((s) => (s.t === 'ring' ? [s.cx] : []));
    expect(ringX).toHaveLength(2);
    expect(Math.min(...ringX)).toBeGreaterThan(Math.max(...bentX) + 1);
  });

  it('changes when any part of a multi-part exemplar is removed', () => {
    for (const cls of Object.values(ITEM_CLASSES)) {
      expect(removalsThatChangeNothing(cls.exemplar), cls.id).toEqual([]);
    }
  });

  it('changes when any part of a sample of the whole catalogue is removed, degenerate classes included', () => {
    // Every 13th placement (the sweep is 157,000 and each drawing classifies it). The full sweep
    // was run once by hand when this was written: no removal in any class left the drawing alone,
    // so no class is exempt.
    let n = 0;
    const same: string[] = [];
    for (const p of enumeratePlacements({ materials: 'tags' })) {
      if (n++ % 13 === 0) same.push(...removalsThatChangeNothing(p));
    }
    expect(same.slice(0, 5)).toEqual([]);
  });
});

describe('anvil view: the layout belongs to one run', () => {
  const swordKey = placementKey(sword);
  const bronzeDagger: Placement = { head: part('short', BRONZE), haft: part('h3', WOOD) };

  /** Dirty every field the store holds, the way a player would after a session at the anvil. */
  function dirty(state: GameState) {
    syncAnvil(state);
    anvil.placement = { ...bronzeDagger };
    anvil.view = 'chart';
    anvil.open = 'haft';
    anvil.family.head = 'axes';
    anvil.chart.guard = 'cross';
    anvil.chart.bind = 'strap';
    anvil.chart.count = 8;
  }

  /** The default layout, whole, and nothing in it or on the new save's anvil that names bronze. */
  function expectDefault(state: GameState) {
    expect(placementKey(anvil.placement)).toBe(swordKey);
    expect(anvil.view).toBe('anvil');
    // The head's picker is the one open on a new run, and no family was picked by hand.
    expect(anvil.open).toBe('head');
    expect({ ...anvil.family }).toEqual({});
    expect({ ...anvil.chart }).toEqual({ guard: null, bind: null, count: 1 });
    expect(placementText(anvil.placement)).not.toMatch(/Bronze/);
    const preview = previewForge(state, anvil.placement);
    expect(preview.cost.map((c) => c.id)).not.toContain(BRONZE);
    expect(preview.reason ?? '').not.toMatch(/Bronze/);
    const head = anvil.placement.head!;
    const offered = offeredMaterials(PART_KINDS[head.kind], state.materials, head.mat).map((m) => m.id);
    expect(offered).not.toContain(BRONZE);
  }

  it('a hard reset, which assigns a new game into the same state object, clears it', () => {
    const state = createInitialState(1_000);
    dirty(state);
    // hardReset in ui/state.svelte.ts: Object.assign(gs, createInitialState(Date.now())).
    Object.assign(state, createInitialState(2_000));
    syncAnvil(state);
    expectDefault(state);
  });

  it('an import, which assigns the loaded save in, clears it', () => {
    const state = createInitialState(3_000);
    dirty(state);
    // importSave: Object.assign(gs, deserialize(text)).
    Object.assign(state, deserialize(serialize(createInitialState(4_000))));
    syncAnvil(state);
    expectDefault(state);
  });

  it('a prestige, which keeps createdAt, clears it', () => {
    const state = createInitialState(5_000);
    clearFloors(state.stats);
    const game = new Game(state);
    dirty(state);
    const before = runKey(state);
    expect(game.prestige(6_000)).toBe(true);
    expect(state.createdAt).toBe(5_000);
    expect(runKey(state)).not.toBe(before);
    syncAnvil(state);
    expectDefault(state);
  });

  it('keeps the layout while the run is the same, including across an in-place copy of itself', () => {
    const state = createInitialState(7_000);
    dirty(state);
    syncAnvil(state);
    expect(placementKey(anvil.placement)).toBe(placementKey(bronzeDagger));
    // The offline catch-up assigns a copy of the same save back into the state.
    Object.assign(state, deserialize(serialize(state)));
    syncAnvil(state);
    expect(placementKey(anvil.placement)).toBe(placementKey(bronzeDagger));
    expect(anvil.view).toBe('chart');
    expect(anvil.chart.count).toBe(8);
  });

  it('loading a placement claims the store for the new run first', () => {
    const old = createInitialState(8_000);
    dirty(old);
    const next = createInitialState(9_000);
    loadOnAnvil(next, { head: part('spearhead', IRON), haft: part('h6', WOOD) });
    expect(placementKey(anvil.placement)).toBe(placementKey({ head: part('spearhead', IRON), haft: part('h6', WOOD) }));
    expect(anvil.view).toBe('anvil');
    // The old run's chart selectors did not come along.
    expect({ ...anvil.chart }).toEqual({ guard: null, bind: null, count: 1 });
  });

  it('replacing the whole layout drops the families picked by hand, and leaves the open slot alone', () => {
    const state = createInitialState(8_500);
    dirty(state);
    setLayout(sword);
    expect(placementKey(anvil.placement)).toBe(swordKey);
    expect({ ...anvil.family }).toEqual({});
    expect(anvil.open).toBe('haft');
    // The layout is a copy: editing the caller's object afterwards does not reach the store.
    const mine: Placement = { head: part('long', IRON) };
    setLayout(mine);
    mine.head!.mat = BRONZE;
    expect(anvil.placement.head?.mat).toBe(IRON);
  });

  it('resets on request, with fresh objects each time', () => {
    const state = createInitialState(10_000);
    dirty(state);
    resetAnvil();
    expectDefault(state);
    const first = anvil.placement;
    resetAnvil();
    expect(anvil.placement).not.toBe(first);
  });
});

describe('anvil view: the job time', () => {
  it('is the clock benchJobTicks gives an assembling bench, read from the shared craft speed', () => {
    for (const level of [0, 20, 60]) {
      const state = createInitialState(11_000);
      state.skills.smithing = { level, xp: 0 };
      for (const p of [sword, { head: part('ring', IRON, 8) }, { head: part('great', IRON), haft: part('h4', WOOD) }]) {
        expect(benchPace(getDerivedStats(state).craftSpeed, forgeTicks(p)), `${level} ${placementKey(p)}`).toEqual(
          benchJobTicks(state, FORGING, {}, undefined, p),
        );
      }
    }
  });
});

describe('anvil view: part families', () => {
  const kinds = Object.values(PART_KINDS);
  const idsOf = (family: PartFamilyId) => kindsOfFamily(family).map((k) => k.id);

  it('puts every part kind in a family of its own role', () => {
    for (const kind of kinds) {
      const family = familyOf(kind);
      expect(family, kind.id).toBeDefined();
      expect(family.role, kind.id).toBe(kind.role);
    }
  });

  it('reads the family off shape and mount: an edge across the haft is an axe head, any other edge a blade', () => {
    expect(idsOf('blades')).toEqual(['thin', 'short', 'medium', 'long', 'great', 'curved', 'curved_l']);
    expect(idsOf('points')).toEqual(['spearhead']);
    expect(idsOf('axes')).toEqual(['axehead']);
    expect(idsOf('mauls')).toEqual(['maulhead']);
    expect(idsOf('plates')).toEqual(['plate_s', 'plate_m', 'plate_w', 'plate_t']);
    expect(idsOf('bent')).toEqual(['bent_s', 'bent_m', 'bent_l']);
    expect(idsOf('rings')).toEqual(['ring']);
    expect(idsOf('handles')).toEqual(['h3', 'h4', 'h6', 'pole', 'club']);
    expect(idsOf('guards')).toEqual(['cross', 'swept', 'boss']);
    expect(idsOf('bindings')).toEqual(['strap', 'cord']);
    // A curved blade is still a blade, and a cross-mounted mass is a maul, not an axe.
    expect(familyOf(PART_KINDS.curved).id).toBe('blades');
    expect(PART_KINDS.maulhead.cross).toBe(true);
    expect(familyOf(PART_KINDS.maulhead).id).toBe('mauls');
  });

  it('lists each kind in exactly one family, and no family is empty', () => {
    const listed = PART_FAMILIES.flatMap((f) => idsOf(f.id));
    expect(listed.sort()).toEqual(kinds.map((k) => k.id).sort());
    for (const f of PART_FAMILIES) expect(idsOf(f.id).length, f.id).toBeGreaterThan(0);
  });

  it('gives the head seven families, in order, and every other role one', () => {
    expect(familiesOf('head').map((f) => f.name)).toEqual([
      'Blades',
      'Points',
      'Axe heads',
      'Maul heads',
      'Plates',
      'Bent metal',
      'Rings',
    ]);
    expect(familiesOf('haft').map((f) => f.name)).toEqual(['Handles']);
    expect(familiesOf('guard').map((f) => f.name)).toEqual(['Guards']);
    expect(familiesOf('bind').map((f) => f.name)).toEqual(['Bindings']);
  });

  it('takes the second head for a head', () => {
    expect(slotRole('head2')).toBe('head');
    expect(slotRole('head')).toBe('head');
    expect(slotRole('guard')).toBe('guard');
    expect(slotRole('haft')).toBe('haft');
    expect(slotRole('bind')).toBe('bind');
  });
});

describe('anvil view: setting one part', () => {
  it("keeps the slot's material when the new kind accepts it, else takes the first it accepts", () => {
    const bronze: Placement = { head: part('long', BRONZE), haft: part('h3', WOOD) };
    expect(withPart(bronze, 'head', 'great')?.head).toEqual(part('great', BRONZE));
    // A wooden long bent piece swapped for a metal-only blade: wood is not accepted, iron is the first metal.
    const bow: Placement = { head: part('bent_l', WOOD) };
    expect(withPart(bow, 'head', 'long')?.head).toEqual(part('long', IRON));
    // A plate takes wood or metal: the material stays whichever it was.
    expect(withPart(bow, 'head', 'plate_m')?.head).toEqual(part('plate_m', WOOD));
  });

  it("gives a head the other head's material when the slot has none to keep", () => {
    const twin: Placement = { head: part('long', BRONZE), haft: part('h3', WOOD) };
    expect(withPart(twin, 'head2', 'short')?.head2).toEqual(part('short', BRONZE));
    expect(withPart({ head2: part('long', BRONZE) }, 'head', 'short')?.head).toEqual(part('short', BRONZE));
  });

  it("clamps the count to the new kind's maximum and drops it when that is one", () => {
    const mail: Placement = { head: part('ring', IRON, 8) };
    expect(withPart(mail, 'head', 'bent_m')?.head).toEqual(part('bent_m', IRON, 2));
    expect(withPart(mail, 'head', 'long')?.head).toEqual(part('long', IRON));
  });

  it('empties a slot, refuses a kind of the wrong role, and never edits the placement it was given', () => {
    const before = placementKey(sword);
    expect(withPart(sword, 'haft', null)).toEqual({ head: part('long', IRON) });
    expect(withPart(sword, 'haft', 'long')).toBeNull();
    expect(withPart(sword, 'guard', 'h3')).toBeNull();
    expect(withPart(sword, 'head', 'nothing_like_this')).toEqual({ haft: part('h3', WOOD) });
    expect(placementKey(sword)).toBe(before);
  });
});

describe('anvil view: comparing the kinds of a family', () => {
  const fresh = () => createInitialState(12_000);
  const rowOf = (rows: ReturnType<typeof compareKinds>, id: string) => rows.find((r) => r.kind.id === id)!;

  it('has one row per kind of the family, in registry order, each placing only that kind in the slot', () => {
    const state = fresh();
    const rows = compareKinds(state, sword, 'head', 'blades');
    expect(rows.map((r) => r.kind.id)).toEqual(kindsOfFamily('blades').map((k) => k.id));
    for (const row of rows) {
      expect(row.placement.head?.kind).toBe(row.kind.id);
      expect(row.placement.haft).toEqual(sword.haft);
      expect(placementKey(row.placement)).toBe(placementKey(withPart(sword, 'head', row.kind.id)!));
    }
    // Every family of every slot yields a row per kind.
    for (const [slot, role] of [
      ['head', 'head'],
      ['head2', 'head'],
      ['guard', 'guard'],
      ['haft', 'haft'],
      ['bind', 'bind'],
    ] as const) {
      for (const family of familiesOf(role)) {
        expect(compareKinds(state, sword, slot, family.id), `${slot} ${family.id}`).toHaveLength(
          kindsOfFamily(family.id).length,
        );
      }
    }
  });

  it('marks the kind the slot holds, and shows no difference on it', () => {
    const rows = compareKinds(fresh(), sword, 'head', 'blades');
    expect(rows.filter((r) => r.current).map((r) => r.kind.id)).toEqual(['long']);
    const here = rowOf(rows, 'long');
    expect(placementKey(here.placement)).toBe(placementKey(sword));
    for (const col of COMPARE_COLUMNS) expect(here.cells[col.key], col.key).toMatchObject({ delta: '', tone: 'none' });
    // A family the held kind is not in has no marked row, but still differs from the piece as it stands.
    const axes = compareKinds(fresh(), sword, 'head', 'axes');
    expect(axes.some((r) => r.current)).toBe(false);
    expect(axes[0].cells.power.delta).not.toBe('');
  });

  it("prints each row's numbers from previewForge on the swapped placement", () => {
    const state = fresh();
    for (const row of compareKinds(state, sword, 'head', 'blades')) {
      const result = previewForge(state, row.placement);
      expect(row.cells.power.text, row.kind.id).toBe(String(result.stats.damage));
      expect(row.cells.crit.text, row.kind.id).toBe(`${(result.stats.crit! * 100).toFixed(1)}%`);
      expect(row.cells.str.text, row.kind.id).toBe(result.stats.str ? String(result.stats.str) : '–');
      expect(row.cells.metal.text, row.kind.id).toBe(String(metalUnits(result.cost)));
    }
  });

  it('writes the difference from the current piece, better or worse by which way is good', () => {
    const state = fresh();
    const base = previewForge(state, sword);
    const rows = compareKinds(state, sword, 'head', 'blades');
    const great = rowOf(rows, 'great');
    const wide = previewForge(state, great.placement);
    // More damage and crit are better; a higher STR need and more metal are worse; slower is worse.
    expect(wide.stats.damage!).toBeGreaterThan(base.stats.damage!);
    expect(great.cells.power).toEqual({
      text: String(wide.stats.damage),
      delta: `+${wide.stats.damage! - base.stats.damage!}`,
      tone: 'better',
    });
    expect(great.cells.crit.tone).toBe('better');
    expect(great.cells.speed.tone).toBe('worse');
    expect(great.cells.speed.text).toMatch(/^−\d+%$/);
    expect(great.cells.speed.delta).toMatch(/^−\d+%$/);
    expect(great.cells.str).toMatchObject({
      text: String(wide.stats.str),
      delta: `+${wide.stats.str - base.stats.str}`,
      tone: 'worse',
    });
    expect(great.cells.metal).toMatchObject({
      delta: `+${metalUnits(wide.cost) - metalUnits(base.cost)}`,
      tone: 'worse',
    });
    // The other way round: a short blade is lighter, cheaper and quicker, and hits for less.
    const short = rowOf(rows, 'short');
    expect(short.cells.power.tone).toBe('worse');
    expect(short.cells.power.delta).toMatch(/^−\d+$/);
    expect(short.cells.speed.tone).toBe('better');
    expect(short.cells.speed.delta).toMatch(/^\+\d+%$/);
    expect(short.cells.metal.tone).toBe('better');
  });

  it('shows a difference only against a figure the current piece has: none for armour against a weapon', () => {
    const state = fresh();
    const plate = rowOf(compareKinds(state, sword, 'head', 'plates'), 'plate_m');
    expect(previewForge(state, plate.placement).stats.armour).toBeGreaterThan(0);
    expect(plate.cells.power).toMatchObject({ delta: '', tone: 'none' });
    // The unit is named when it is not the current piece's, and left off when it is.
    expect(plate.cells.power.text).toMatch(/ armour$/);
    expect(plate.cells.crit).toMatchObject({ text: '–', delta: '' });
    expect(rowOf(compareKinds(state, sword, 'head', 'blades'), 'great').cells.power.text).not.toMatch(/[a-z]/);
  });

  it('compares nothing on an empty anvil', () => {
    const rows = compareKinds(fresh(), {}, 'head', 'blades');
    expect(rows).toHaveLength(kindsOfFamily('blades').length);
    expect(rows.some((r) => r.current)).toBe(false);
    for (const row of rows) {
      for (const col of COMPARE_COLUMNS) expect(row.cells[col.key].delta, `${row.kind.id} ${col.key}`).toBe('');
    }
  });

  it("keeps the slot's material across the rows, or takes the first accepted where it is not accepted", () => {
    const state = fresh();
    const bronze: Placement = { head: part('long', BRONZE), haft: part('h3', WOOD) };
    for (const row of compareKinds(state, bronze, 'head', 'blades')) {
      expect(row.placement.head?.mat, row.kind.id).toBe(BRONZE);
    }
    // The haft stays wooden through its own family.
    for (const row of compareKinds(state, bronze, 'haft', 'handles')) {
      expect(row.placement.haft?.mat, row.kind.id).toBe(WOOD);
    }
    // A wooden bow limb has no wooden blade to become: the blades are iron.
    const bow: Placement = { head: part('bent_l', WOOD), bind: part('cord', LEATHER) };
    for (const row of compareKinds(state, bow, 'head', 'blades')) {
      expect(row.placement.head?.mat, row.kind.id).toBe(IRON);
    }
  });

  it('masks a form the save has not made, and names it once it has', () => {
    const state = fresh();
    const before = compareKinds(state, sword, 'head', 'blades');
    for (const row of before) {
      expect(row.known, row.kind.id).toBe(false);
      expect(row.form, row.kind.id).toBe('?');
    }
    // The same rule as "one change away": the counter `forged:<class>` is what unmasks a class.
    state.stats['forged:sword'] = 1;
    const after = compareKinds(state, sword, 'head', 'blades');
    for (const row of after) {
      const cls = classifyPlacement(row.placement);
      expect(row.known, row.kind.id).toBe(cls.id === 'sword');
      expect(row.form, row.kind.id).toBe(cls.id === 'sword' ? cls.name : '?');
    }
    expect(rowOf(after, 'long').form).toBe(ITEM_CLASSES.sword.name);
    // The numbers are not masked.
    expect(rowOf(before, 'great').cells.power.text).toBe(rowOf(after, 'great').cells.power.text);
  });

  it('describes a row as one sentence for a screen reader', () => {
    const state = fresh();
    state.stats['forged:sword'] = 1;
    const rows = compareKinds(state, sword, 'head', 'blades');
    const label = kindRowLabel(rowOf(rows, 'long'));
    expect(label).toContain('Long blade 2×6');
    expect(label).toContain('in the slot');
    expect(label).toContain(`makes ${ITEM_CLASSES.sword.name}`);
    const great = kindRowLabel(rowOf(rows, 'great'));
    expect(great).toMatch(/damage \/ armour 12 \(\+5\)/);
    expect(great).not.toContain('in the slot');
  });

  it('counts the metal of a bill, whatever the metal', () => {
    const bill = [
      { id: IRON, qty: 2 },
      { id: BRONZE, qty: 1 },
      { id: WOOD, qty: 3 },
      { id: LEATHER, qty: 1 },
    ];
    expect(metalUnits(bill)).toBe(3);
    expect(metalUnits([])).toBe(0);
  });
});

describe('anvil view: a previewed piece against the current one', () => {
  const line = (label: string, value: string) => ({ label, value });

  it('carries the current value only on a line that changed', () => {
    const now = [line('Damage', '+7'), line('Weight', '13.2'), line('Cells', '15')];
    const next = [line('Damage', '+12'), line('Weight', '13.2'), line('Cells', '24')];
    expect(pairStatLines(now, next)).toEqual([
      { label: 'Damage', value: '+12', from: '+7' },
      { label: 'Weight', value: '13.2' },
      { label: 'Cells', value: '24', from: '15' },
    ]);
    // A piece set against itself pairs nothing.
    expect(pairStatLines(now, now).some((l) => l.from !== undefined)).toBe(false);
  });

  it('keeps a line only one of them has, with a dash on the missing side, in the order a piece prints them', () => {
    const now = [line('Damage', '+7'), line('Crit chance', '+2.0%'), line('Weight', '13.2')];
    const next = [line('Attack speed', '+4%'), line('Damage', '+6'), line('Weight', '10.2')];
    expect(pairStatLines(now, next)).toEqual([
      { label: 'Attack speed', value: '+4%', from: '—' },
      { label: 'Damage', value: '+6', from: '+7' },
      { label: 'Crit chance', value: '—', from: '+2.0%' },
      { label: 'Weight', value: '10.2', from: '13.2' },
    ]);
    // Lines left over at the end are kept too.
    expect(pairStatLines([line('Damage', '+7'), line('Value', '30 gold')], [line('Damage', '+7')])).toEqual([
      { label: 'Damage', value: '+7' },
      { label: 'Value', value: '—', from: '30 gold' },
    ]);
    expect(pairStatLines([], [line('Damage', '+7')])).toEqual([{ label: 'Damage', value: '+7', from: '—' }]);
    expect(pairStatLines([line('Damage', '+7')], [])).toEqual([{ label: 'Damage', value: '—', from: '+7' }]);
  });

  it('pairs the lines of two real pieces: damage drops, crit goes, speed arrives', () => {
    const state = createInitialState(13_000);
    const sworded = previewForge(state, sword);
    const mauled = previewForge(state, { head: part('maulhead', IRON), haft: part('h3', WOOD) });
    const lines = pairStatLines(pieceLines(sworded.stats, sworded.def.mods), pieceLines(mauled.stats, mauled.def.mods));
    const byLabel = Object.fromEntries(lines.map((l) => [l.label, l]));
    expect(byLabel['Damage'].from).toBe('+7');
    expect(byLabel['Crit chance']).toMatchObject({ value: '—', from: '+2.0%' });
    expect(lines[lines.length - 1].label).toBe('Value');
  });

  it('lists the strength a piece needs and its value after the stat lines', () => {
    const state = createInitialState(14_000);
    const great = previewForge(state, { head: part('great', IRON), haft: part('h4', WOOD) });
    expect(great.stats.str).toBeGreaterThan(0);
    const lines = pieceLines(great.stats, great.def.mods);
    expect(lines.slice(-2)).toEqual([
      { label: 'Requires', value: `STR ${great.stats.str}` },
      { label: 'Value', value: `${great.stats.value} gold` },
    ]);
    const light = previewForge(state, { head: part('short', IRON), haft: part('h3', WOOD) });
    expect(light.stats.str).toBe(0);
    expect(pieceLines(light.stats, light.def.mods).some((l) => l.label === 'Requires')).toBe(false);
  });
});
