import { describe, expect, it } from 'vitest';
import { ITEM_CLASSES, PART_KINDS } from '../src/core/registry';
import { classifyPlacement, enumeratePlacements } from '../src/core/systems/assembly';
import { FORGE_SLOTS } from '../src/core/data/parts.data';
import type { Placement } from '../src/core/types';
import { drawingOf, type Drawing } from '../src/ui/lib/forgeDrawing';

/**
 * The anvil's pattern drawing (src/ui/lib/forgeDrawing.ts): every placement
 * draws, every billed part is drawn and bracketed with its w×l, and nothing in
 * the path data is ever NaN or Infinity.
 */

const IRON = 'iron_ingot';
const WOOD = 'hardwood';
const LEATHER = 'leather';
const part = (kind: string, mat: string, qty?: number) => ({ kind, mat, ...(qty ? { qty } : {}) });

/** The drawing as one comparable string. */
const sig = (d: Drawing) => JSON.stringify([d.strokes, d.measures, d.captions]);

function finite(d: Drawing): boolean {
  const numbers = [d.minX, d.minY, d.maxX, d.maxY];
  for (const st of d.strokes) for (const m of st.d.matchAll(/-?\d+(\.\d+)?(e-?\d+)?|NaN|Infinity/g)) numbers.push(Number(m[0]));
  for (const m of d.measures) numbers.push(m.from, m.to, m.at);
  return numbers.every(Number.isFinite);
}

/** "2×6" for each filled slot, with the count when there is more than one. */
function sizesOf(p: Placement): string[] {
  const out: string[] = [];
  for (const slot of FORGE_SLOTS) {
    const placed = p[slot];
    const kind = placed ? PART_KINDS[placed.kind] : undefined;
    if (kind) out.push(`${kind.w}×${kind.l}`);
  }
  return out;
}

describe('the pattern drawing', () => {
  it('draws nothing for an empty anvil', () => {
    const d = drawingOf({});
    expect(d.strokes).toEqual([]);
    expect(d.measures).toEqual([]);
  });

  it('draws every class exemplar with finite numbers and a bracket for each part', () => {
    for (const cls of Object.values(ITEM_CLASSES)) {
      const d = drawingOf(cls.exemplar);
      if (Object.keys(cls.exemplar).length === 0) continue;
      expect(d.strokes.length, cls.id).toBeGreaterThan(0);
      expect(finite(d), cls.id).toBe(true);
      const labels = d.measures.map((m) => m.label).join(' | ');
      for (const size of sizesOf(cls.exemplar)) expect(labels, `${cls.id}: ${size}`).toContain(size);
    }
  });

  it('labels the sword the way the anvil names its parts', () => {
    const d = drawingOf({ head: part('long', IRON), guard: part('cross', IRON), haft: part('h3', WOOD) });
    const labels = d.measures.map((m) => m.label);
    expect(labels).toContain('long blade 2×6');
    expect(labels).toContain('short handle 1×3');
  });

  it('draws a shield in two views with the grip as a hidden line behind the face', () => {
    const shield = { head: part('plate_m', WOOD), haft: part('h3', WOOD) };
    expect(classifyPlacement(shield).slot).toBe('offhand');
    const d = drawingOf(shield);
    expect(d.captions.map((c) => c.text)).toEqual(['Front', 'Side']);
    expect(d.strokes.some((s) => s.ink === 'hidden')).toBe(true);
    // The grip is no longer drawn below the face: nothing reaches past the face's foot by a whole grip.
    expect(d.maxY).toBeLessThan(3 + 3);
  });

  it('counts rings and pairs in the brackets', () => {
    const mail = drawingOf({ head: part('ring', IRON, 8) });
    expect(mail.measures.map((m) => m.label)).toContain('metal ring 1×1 ×8');
    const amulet = drawingOf({ head: part('ring', IRON), bind: part('cord', LEATHER) });
    expect(amulet.measures.map((m) => m.label)).toContain('cord 1×4');
  });

  it('gives each strapped piece its own strap and buckle, never one strap across two pieces', () => {
    // Strap bands are the strokes tinted with leather.
    const bands = (p: Placement) => drawingOf(p).strokes.filter((s) => s.tint?.includes('--mat-leather')).length;
    expect(bands({ head: part('bent_s', IRON, 2), bind: part('strap', LEATHER) })).toBe(2);
    expect(bands({ head: part('bent_m', IRON, 2), bind: part('strap', LEATHER) })).toBe(2);
    expect(bands({ head: part('plate_w', IRON), bind: part('strap', LEATHER) })).toBe(1);
  });

  it('draws a guard beside armour, and a second head and a guard below a bow', () => {
    const plain = { head: part('plate_w', IRON), bind: part('strap', LEATHER) };
    expect(drawingOf({ ...plain, guard: part('boss', IRON) }).maxX).toBeGreaterThan(drawingOf(plain).maxX);
    const bow = { head: part('bent_l', WOOD), bind: part('cord', LEATHER) };
    const armed = { ...bow, head2: part('long', IRON), guard: part('cross', IRON) };
    expect(classifyPlacement(armed).id).toBe('bow');
    expect(drawingOf(armed).maxY).toBeGreaterThan(drawingOf(bow).maxY + 6);
  });

  it('changes when any part is removed, across the catalogue', () => {
    let checked = 0;
    let i = 0;
    const misses: string[] = [];
    for (const p of enumeratePlacements({ materials: 'tags' })) {
      if (i++ % 11 !== 0) continue;
      const filled = FORGE_SLOTS.filter((slot) => p[slot]);
      if (filled.length < 2) continue;
      const whole = drawingOf(p);
      expect(finite(whole)).toBe(true);
      const full = sig(whole);
      for (const slot of filled) {
        const less = { ...p };
        delete less[slot];
        if (sig(drawingOf(less)) === full) misses.push(`${JSON.stringify(p)} without ${slot}`);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(1000);
    expect(misses.slice(0, 5)).toEqual([]);
    // About 4 s alone; the full suite runs files in parallel, so allow well past the 5 s default.
  }, 60_000);
});
