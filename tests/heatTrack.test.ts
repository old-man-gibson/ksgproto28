import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { DISCIPLINES } from '../src/core/data/disciplines.data';
import { MATERIALS } from '../src/core/registry';
import { grantGraded, type Placement } from '../src/core/systems/disciplines';
import { exposureInfo, previewCook } from '../src/core/systems/cooking';
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
  function hint(g: Game, pot: Placement, duration: number, disc = STOVE) {
    const rows = trackRows(g.state, disc, pot, duration);
    const cook = cookTimeRows(g.state, disc, pot, duration);
    return heatHint(g.state, disc, pot, duration, rows, cook, previewCook(g.state, pot, disc, duration));
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

  it('names the first ingredient not cooked enough, its range, and a cook length that fixes it', () => {
    // At Quick simmer the late slot (open at Cooking 8) sees 2.7 units; whole food is right from 3.
    // No other slot is open or can swap, so the only fix is a longer cook: 12 puts it at 4.1.
    const g = kitchen(8);
    const h = hint(g, { main: at('wild_onion'), second: at('raw_meat'), third: at('common_herb') }, 8);
    expect(h).toEqual({
      kind: 'fix',
      text: `${MATERIALS.common_herb.name} cooks 2.7 units; cooked right is 3 to 16. Cook for Steady stew (12).`,
    });
  });

  it('prefers an empty slot to an occupied one', () => {
    // Finishing touch (Cooking 20) sees 0.8 units of an 8-unit cook; the late slot is empty and puts it at 2.7.
    const g = kitchen(20);
    const h = hint(g, { main: at('wild_onion'), second: at('raw_meat'), fourth: at('wild_onion_julienned') }, 8);
    expect(h.text).toBe(
      `${MATERIALS.wild_onion_julienned.name} cooks 0.8 units; cooked right is 2 to 5. Move it to Late Addition (unit 5.3).`,
    );
  });

  it('offers a swap only when both ingredients cook right afterwards', () => {
    // Julienne first for 12 units is overcooked; the late slot holds a whole onion. Swapped, the julienne
    // gets 4.1 units and the onion 12, both in range.
    const g = kitchen(8);
    const jul = MATERIALS.wild_onion_julienned.name;
    const swap = hint(g, { main: at('wild_onion_julienned'), third: at('wild_onion') }, 12);
    expect(swap.text).toBe(
      `${jul} cooks 12.0 units; cooked right is 2 to 5. Swap it with ${MATERIALS.wild_onion.name} in Late Addition (unit 7.9).`,
    );
    // With a second julienne in the late slot, swapping would leave the other one overcooked: no swap.
    const none = hint(g, { main: at('wild_onion_julienned'), third: at('wild_onion_julienned') }, 12);
    expect(none.text).not.toMatch(/Swap/);
  });

  it('suggests a longer cook when the whole cook is shorter than the range', () => {
    // No bench ships a cook shorter than its shortest range; this one does, to reach the branch.
    const g = kitchen(1);
    const flash = { ...STOVE, timeline: { options: [{ units: 2, name: 'Flash' }, { units: 8, name: 'Simmer' }], default: 2 } };
    const h = hint(g, { main: at('wild_onion') }, 2, flash);
    expect(h.text).toBe(`${MATERIALS.wild_onion.name} cooks 2.0 units; cooked right is 3 to 16. Cook for Simmer (8).`);
  });

  it('names the slot that fixes an overcooked ingredient, or says nothing does', () => {
    const jul = at('wild_onion_julienned');
    const name = MATERIALS.wild_onion_julienned.name;
    // Julienne in first for 12 units against a 2 to 5 range. At level 1 no open slot is late enough and
    // no cook length is short enough for the first slot.
    const none = hint(kitchen(1), { main: jul }, 12);
    expect(none.kind).toBe('fix');
    expect(none.text).toBe(`${name} cooks 12.0 units; cooked right is 2 to 5. No slot or cook time fixes this at Cooking 1.`);
    // With the late slot open (Cooking 8) it can go in at unit 7.9.
    const late = hint(kitchen(8), { main: jul }, 12);
    expect(late.text).toBe(`${name} cooks 12.0 units; cooked right is 2 to 5. Move it to Late Addition (unit 7.9).`);
  });

  it('judges a cook length by the slot the ingredient is in, not by where it enters now', () => {
    // A slot's exposure is duration × (1 − at), so a shorter cook does not take a fixed number of units off.
    // Julienne midway at Steady stew is 8.0 units against 2 to 5; Quick simmer would still be 5.4.
    const julienne = hint(kitchen(1), { second: at('wild_onion_julienned') }, 12);
    expect(julienne.text).not.toMatch(/[Cc]ook for/);
    expect(julienne.text).toContain('No slot or cook time fixes this at Cooking 1.');
    // Sliced (3 to 8) midway at Long braise is 10.7; Steady stew is still 8.04, Quick simmer is right.
    const sliced = hint(kitchen(1), { second: at('wild_onion_sliced') }, 16);
    expect(sliced.text).toBe(
      `${MATERIALS.wild_onion_sliced.name} cooks 10.7 units; cooked right is 3 to 8. Cook for Quick simmer (8).`,
    );
  });

  it('does not send an ingredient to a slot on the wrong side of its range', () => {
    // Long braise at Cooking 20, julienne (2 to 5): first in gets 16, the late slot 5.4, the finishing touch
    // 1.6. Neither "later" nor "earlier" lands in range, so the line says so.
    const g = kitchen(20);
    const first = hint(g, { main: at('wild_onion_julienned') }, 16);
    expect(first.text).toContain('No slot or cook time fixes this at Cooking 20.');
    const last = hint(g, { fourth: at('wild_onion_julienned') }, 16);
    expect(last.text).toContain('No slot or cook time fixes this at Cooking 20.');
    expect(first.text + last.text).not.toMatch(/Move it|Swap it|Cook for/);
  });

  it('only the first ingredient out of its range is named', () => {
    const g = kitchen(8);
    const h = hint(g, { main: at('wild_onion_julienned'), second: at('wild_onion_julienned') }, 12);
    expect(h.text.startsWith(`${MATERIALS.wild_onion_julienned.name} cooks 12.0 units`)).toBe(true);
  });

  it('never suggests a slot or a cook length that does not cook the ingredient right', () => {
    // Every cut of onion, in every open slot, at every cook length, alone and beside a piece of meat. Each
    // suggestion is parsed back out of the sentence and asked of exposureInfo.
    const cuts = ['wild_onion', 'wild_onion_sliced', 'wild_onion_diced', 'wild_onion_julienned'];
    const seen = { slot: 0, swap: 0, length: 0, none: 0, ok: 0 };
    const right = (slotId: string, id: string, units: number) =>
      exposureInfo(STOVE, STOVE.slots.find((s) => s.id === slotId)!, id, units)?.verdict === 'in its element';

    for (const level of [1, 8, 20]) {
      const g = kitchen(level);
      const open = STOVE.slots.filter((s) => s.at != null && (s.unlockLevel ?? 0) <= level);
      for (const duration of [8, 12, 16]) {
        for (const cut of cuts) {
          for (const slot of open) {
            const others = [undefined, ...open.filter((o) => o !== slot)];
            for (const other of others) {
              const pot: Placement = { [slot.id]: at(cut) };
              if (other) pot[other.id] = at('raw_meat');
              const rows = trackRows(g.state, STOVE, pot, duration);
              const bad = rows.find((r) => r.info && r.info.verdict !== 'in its element');
              const h = hint(g, pot, duration);
              const label = `Cooking ${level}, ${duration}, ${cut} in ${slot.id}${other ? `, meat in ${other.id}` : ''}: ${h.text}`;
              if (!bad) {
                seen.ok++;
                expect(h.kind, label).not.toBe('fix');
                continue;
              }
              expect(h.kind, label).toBe('fix');
              const part = bad.part!;
              const there = (name: string) => open.find((o) => o.name === name)!;

              const swap = h.text.match(/Swap it with (.+?) in (.+?) \(unit/);
              const move = h.text.match(/[Mm]ove it to (.+?) \(unit/);
              const cook = h.text.match(/[Cc]ook for (.+?) \((\d+)\)/);
              if (swap) {
                seen.swap++;
                const to = there(swap[2]);
                expect(pot[to.id], label).toBeDefined();
                expect(right(to.id, part.id, duration), label).toBe(true);
                expect(right(bad.slot.id, pot[to.id]!.id, duration), label).toBe(true);
              }
              if (move) {
                seen.slot++;
                const to = there(move[1]);
                expect(pot[to.id], label).toBeUndefined();
                expect(right(to.id, part.id, duration), label).toBe(true);
              }
              if (cook) {
                seen.length++;
                const units = Number(cook[2]);
                expect(STOVE.timeline!.options.find((o) => o.name === cook[1])?.units, label).toBe(units);
                expect(right(bad.slot.id, part.id, units), label).toBe(true);
              }
              if (!swap && !move && !cook) {
                seen.none++;
                expect(h.text, label).toContain(`No slot or cook time fixes this at Cooking ${level}.`);
                // And it is true: nothing open takes it, empty or by swap, and no cook length does.
                for (const o of open.filter((x) => x !== bad.slot)) {
                  const held = pot[o.id];
                  const fixes = right(o.id, part.id, duration) && (!held || right(bad.slot.id, held.id, duration));
                  expect(fixes, `${label} (${o.id})`).toBe(false);
                }
                for (const opt of STOVE.timeline!.options.filter((o) => o.units !== duration)) {
                  expect(right(bad.slot.id, part.id, opt.units), `${label} (${opt.units})`).toBe(false);
                }
              }
            }
          }
        }
      }
    }
    // The sweep reaches every kind of sentence, so it is not passing by saying nothing.
    expect(seen.slot).toBeGreaterThan(0);
    expect(seen.swap).toBeGreaterThan(0);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.none).toBeGreaterThan(0);
    expect(seen.ok).toBeGreaterThan(0);
  });
});
