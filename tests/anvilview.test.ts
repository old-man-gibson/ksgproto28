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
import { anvil, loadOnAnvil, resetAnvil, runKey, syncAnvil } from '../src/ui/lib/anvil.svelte';
import { clearFloors } from './fixtures/floors';
import {
  adaptMaterials,
  cellsOfMaterial,
  chartEntries,
  classesForIndex,
  distinctNeighbours,
  materialColor,
  materialsFor,
  neighbourLabel,
  offeredMaterials,
  partText,
  pickMaterial,
  placementText,
  sameShape,
  silhouetteOf,
  statLines,
  type ChartSetup,
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
    anvil.chart.guard = 'cross';
    anvil.chart.bind = 'strap';
    anvil.chart.count = 8;
  }

  /** The default layout, whole, and nothing in it or on the new save's anvil that names bronze. */
  function expectDefault(state: GameState) {
    expect(placementKey(anvil.placement)).toBe(swordKey);
    expect(anvil.view).toBe('anvil');
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
