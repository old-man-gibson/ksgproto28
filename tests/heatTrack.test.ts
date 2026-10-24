import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { DISCIPLINES } from '../src/core/data/disciplines.data';
import { MATERIALS } from '../src/core/registry';
import { grantGraded, type Placement } from '../src/core/systems/disciplines';
import { previewCook } from '../src/core/systems/cooking';
import {
  axisMax,
  cookTimeRows,
  heatHint,
  outsideSlots,
  trackRows,
  windowWords,
  zonesFor,
} from '../src/ui/lib/heatTrack';
import type { GradedStack, QualityTier } from '../src/core/types';

const STOVE = DISCIPLINES.cooking;
const at = (id: string, quality: QualityTier = 'c'): GradedStack => ({ id, quality });
const CARDS = ['seared_stew', 'braised_meat', 'steeped_broth'];

function kitchen(level = 1, cards: string[] = []) {
  const g = new Game(createInitialState(1));
  g.state.skills.cooking = { level, xp: 0 };
  for (const c of cards) g.state.stats[`recipe:${c}`] = 1;
  for (const id of ['raw_meat', 'wild_onion', 'wild_onion_julienned', 'cave_mushroom', 'common_herb']) {
    grantGraded(g.state, id, 'c', 10);
  }
  return g;
}

describe('the rows of the heat track', () => {
  it('lists every timed slot in the order it enters, locked ones too', () => {
    const g = kitchen(1);
    const rows = trackRows(g.state, STOVE, {}, 12);
    expect(rows.map((r) => r.slot.id)).toEqual(['main', 'second', 'third', 'fourth']);
    expect(rows.map((r) => +r.entry.toFixed(2))).toEqual([0, 3.96, 7.92, 10.8]);
    expect(rows.map((r) => r.locked)).toEqual([false, false, true, true]);
    expect(trackRows(kitchen(8).state, STOVE, {}, 12).map((r) => r.locked)).toEqual([false, false, false, true]);
  });

  it('puts seasoning and cookware outside time', () => {
    expect(outsideSlots(STOVE).map((s) => s.id)).toEqual(['seasoning', 'pot']);
  });

  it('the axis runs to the longest option, or past it for a longer chosen cook', () => {
    expect(axisMax(STOVE)).toBe(16);
    expect(axisMax(STOVE, 20)).toBe(20);
  });

  it('a placed part carries its exposure and a bar from entry to the end of the cook', () => {
    const g = kitchen(1);
    const rows = trackRows(g.state, STOVE, { second: at('raw_meat') }, 16);
    const row = rows.find((r) => r.slot.id === 'second')!;
    expect(row.info?.verdict).toBe('in its element');
    // Whole food is cooked right from 3 to 16 units: raw until 8.28, then right to the end.
    expect(row.zones.map((z) => [z.kind, +z.from.toFixed(2), +z.to.toFixed(2)])).toEqual([
      ['raw', 5.28, 8.28],
      ['ready', 8.28, 16],
    ]);
    expect(rows.find((r) => r.slot.id === 'main')!.zones).toEqual([]);
  });

  it('splits a bar into not cooked enough, cooked right and overcooked', () => {
    expect(zonesFor(0, 12, [2, 5])).toEqual([
      { kind: 'raw', from: 0, to: 2 },
      { kind: 'ready', from: 2, to: 5 },
      { kind: 'burnt', from: 5, to: 12 },
    ]);
    // A cook that ends before the band opens is all raw.
    expect(zonesFor(6, 8, [3, 16])).toEqual([{ kind: 'raw', from: 6, to: 8 }]);
    // Never past the end of the cook.
    expect(zonesFor(0, 8, [3, 16]).at(-1)).toEqual({ kind: 'ready', from: 3, to: 8 });
  });

  it('every bar ends exactly where the cook ends, for every slot, cut and duration', () => {
    const g = kitchen(20);
    for (const duration of STOVE.timeline!.options.map((o) => o.units)) {
      for (const id of ['wild_onion', 'wild_onion_julienned']) {
        const placement: Placement = Object.fromEntries(STOVE.slots.filter((s) => s.at != null).map((s) => [s.id, at(id)]));
        for (const row of trackRows(g.state, STOVE, placement, duration)) {
          if (row.entry >= duration) continue;
          expect(row.zones.at(-1)!.to).toBeCloseTo(duration, 6);
          expect(row.zones[0].from).toBeCloseTo(row.entry, 6);
          // The bar's last stretch is the part's verdict.
          const last = row.zones.at(-1)!.kind;
          expect(last).toBe({ undercooked: 'raw', 'in its element': 'ready', overcooked: 'burnt' }[row.info!.verdict]);
        }
      }
    }
  });
});

describe('the cook-time row', () => {
  const meatOnion = (meatSlot: 'main' | 'second'): Placement =>
    meatSlot === 'main'
      ? { main: at('raw_meat'), second: at('wild_onion') }
      : { main: at('wild_onion'), second: at('raw_meat') };

  it('has no row at all until a card with a window is read', () => {
    const g = kitchen(1);
    expect(cookTimeRows(g.state, STOVE, meatOnion('second'), 8)).toEqual([]);
  });

  it('shows the windows of the cards read and the default dish for the rest', () => {
    const g = kitchen(1, CARDS);
    const [row] = cookTimeRows(g.state, STOVE, meatOnion('second'), 8);
    expect(row.tag).toBe('meat');
    expect(row.mean).toBeCloseTo(5.36, 2);
    expect(row.windows.map((w) => [w.outcome?.id, w.from, w.to, w.side])).toEqual([
      ['seared_stew', 0, 6, 'before'],
      ['stew', 6, 14, 'default'],
      ['braised_meat', 14, 16, 'after'],
    ]);
    expect(row.here?.outcome?.id).toBe('seared_stew');
  });

  it('puts the marker in the default stretch when the meat cooks the usual time', () => {
    const g = kitchen(1, CARDS);
    const [row] = cookTimeRows(g.state, STOVE, meatOnion('main'), 12);
    expect(row.here?.outcome?.id).toBe('stew');
    expect(row.here?.side).toBe('default');
  });

  it('never draws the edge of a window whose card is unread', () => {
    // Only the braised card is read: the 6 that ends the seared window must not
    // appear as a boundary, or the row would print what the seared card teaches.
    const g = kitchen(1, ['braised_meat']);
    const [row] = cookTimeRows(g.state, STOVE, meatOnion('second'), 8);
    expect(row.windows.map((w) => [w.outcome?.id, w.from, w.to])).toEqual([
      ['stew', 0, 14],
      ['braised_meat', 14, 16],
    ]);
    // And with none of that tag's cards read, there is nothing to draw for it.
    const herb = cookTimeRows(g.state, STOVE, { main: at('common_herb'), second: at('cave_mushroom') }, 12);
    expect(herb.map((r) => r.tag)).toEqual(['meat']);
    expect(herb[0].mean).toBeNull();
    expect(herb[0].windows).toEqual([]);
  });

  it('one row per windowed tag, and the herb row reads its own card', () => {
    const g = kitchen(1, CARDS);
    const rows = cookTimeRows(g.state, STOVE, { main: at('common_herb'), second: at('cave_mushroom') }, 12);
    expect(rows.map((r) => r.tag)).toEqual(['meat', 'herb']);
    expect(rows[0].mean).toBeNull();
    expect(rows[1].windows.map((w) => [w.outcome?.id, w.from, w.to])).toEqual([
      ['broth', 0, 8],
      ['steeped_broth', 8, 16],
    ]);
    expect(rows[1].here?.outcome?.id).toBe('steeped_broth');
  });

  it('agrees with what the bench makes at every duration and slot', () => {
    const g = kitchen(1, CARDS);
    for (const duration of [8, 12, 16]) {
      for (const slot of ['main', 'second'] as const) {
        const pot = meatOnion(slot);
        const [row] = cookTimeRows(g.state, STOVE, pot, duration);
        expect(row.here?.outcome?.id, `${duration} ${slot}`).toBe(previewCook(g.state, pot, STOVE, duration).outcome?.id);
      }
    }
  });

  it('says there is no dish where a required ingredient is missing', () => {
    const g = kitchen(1, CARDS);
    const [row] = cookTimeRows(g.state, STOVE, { main: at('raw_meat') }, 12);
    expect(row.windows.every((w) => w.outcome === undefined)).toBe(true);
  });

  it('writes a stretch the way the cards do', () => {
    const [row] = cookTimeRows(kitchen(1, CARDS).state, STOVE, meatOnion('second'), 8);
    expect(row.windows.map((w) => windowWords(w, 16))).toEqual(['under 6', '6 to 14', '14 or more']);
  });
});

describe('the hint line', () => {
  function hint(g: Game, pot: Placement, duration: number) {
    const rows = trackRows(g.state, STOVE, pot, duration);
    const cook = cookTimeRows(g.state, STOVE, pot, duration);
    return heatHint(STOVE, pot, duration, rows, cook, previewCook(g.state, pot, STOVE, duration));
  }

  it('prompts when the pot is empty', () => {
    expect(hint(kitchen(1), {}, 12).kind).toBe('idle');
  });

  it('says every ingredient is cooked right when there is nothing more to say', () => {
    const h = hint(kitchen(1), { main: at('wild_onion'), second: at('raw_meat') }, 12);
    expect(h).toEqual({ kind: 'ok', text: 'Every ingredient is cooked right.' });
  });

  it('names the meat’s cook time, the dish, and the other dishes the cards read make', () => {
    const h = hint(kitchen(1, CARDS), { main: at('wild_onion'), second: at('raw_meat') }, 8);
    expect(h.kind).toBe('ok');
    expect(h.text).toBe(
      'Meat cooks 5.4 units → Seared Stew. Hearty Stew: meat 6 to 14. Braised Meat: meat 14 or more.',
    );
  });

  it('does not name a dish whose card is unread', () => {
    const h = hint(kitchen(1, ['braised_meat']), { main: at('wild_onion'), second: at('raw_meat') }, 8);
    expect(h.text).toBe('Meat cooks 5.4 units → Hearty Stew. Braised Meat: meat 14 or more.');
    expect(h.text).not.toMatch(/Seared/);
  });

  it('names the first ingredient not cooked enough, its range, and the slot that fixes it', () => {
    // At Quick simmer the late slot (open at Cooking 8) sees 2.7 units; whole food is right from 3.
    const g = kitchen(8);
    const h = hint(g, { main: at('wild_onion'), second: at('raw_meat'), third: at('common_herb') }, 8);
    expect(h).toEqual({
      kind: 'fix',
      text: `${MATERIALS.common_herb.name} cooks 2.7 units; cooked right is 3 to 16. Move it to Added Midway (unit 2.6) or earlier.`,
    });
    // The suggestion is a slot that would put it in its range.
    const rows = trackRows(g.state, STOVE, { second: at('common_herb') }, 8);
    expect(rows.find((r) => r.slot.id === 'second')!.info!.verdict).toBe('in its element');
  });

  it('prefers an empty slot to an occupied one', () => {
    // Finishing touch (Cooking 20) sees 0.8 units of an 8-unit cook; the late slot is empty and early enough.
    const g = kitchen(20);
    const h = hint(g, { main: at('wild_onion'), second: at('raw_meat'), fourth: at('wild_onion_julienned') }, 8);
    expect(h.text).toBe(
      `${MATERIALS.wild_onion_julienned.name} cooks 0.8 units; cooked right is 2 to 5. Move it to Late Addition (unit 5.3) or earlier.`,
    );
  });

  it('suggests a longer cook when the whole cook is shorter than the range', () => {
    // No bench ships a cook shorter than its shortest range; this one does, to reach the branch.
    const g = kitchen(1);
    const flash = { ...STOVE, timeline: { options: [{ units: 2, name: 'Flash' }, { units: 8, name: 'Simmer' }], default: 2 } };
    const pot: Placement = { main: at('wild_onion') };
    const h = heatHint(flash, pot, 2, trackRows(g.state, flash, pot, 2), [], { ok: false });
    expect(h.text).toBe(`${MATERIALS.wild_onion.name} cooks 2.0 units; cooked right is 3 to 16. Cook for Simmer (8) or longer.`);
  });

  it('names the slot or the shorter cook that fixes an overcooked ingredient', () => {
    const jul = at('wild_onion_julienned');
    // Julienne in first for 12 units: 12 units against a 2 to 5 band. Nothing open at level 1 enters late enough.
    const early = hint(kitchen(1), { main: jul }, 12);
    expect(early.kind).toBe('fix');
    expect(early.text).toBe(`${MATERIALS.wild_onion_julienned.name} cooks 12.0 units; cooked right is 2 to 5.`);
    // With the late slot open (Cooking 8) it can go in at unit 7.9.
    const late = hint(kitchen(8), { main: jul }, 12);
    expect(late.text).toBe(
      `${MATERIALS.wild_onion_julienned.name} cooks 12.0 units; cooked right is 2 to 5. Move it to Late Addition (unit 7.9) or later.`,
    );
  });

  it('only the first ingredient out of its range is named', () => {
    const g = kitchen(8);
    const h = hint(g, { main: at('wild_onion_julienned'), second: at('wild_onion_julienned') }, 12);
    expect(h.text.startsWith(`${MATERIALS.wild_onion_julienned.name} cooks 12.0 units`)).toBe(true);
  });
});
