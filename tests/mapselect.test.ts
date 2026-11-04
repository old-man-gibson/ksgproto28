import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { createInitialState } from '../src/core/state';
import { SPOTS, TOWERS } from '../src/core/registry';
import { CARD_GAP, CARD_W, cardTab, placeCard, selectionStep, type Box, type SelectEvent } from '../src/ui/lib/mapSelect';
import { buildPlan } from '../src/ui/lib/mapPlan';
import MapPlan from '../src/ui/MapPlan.svelte';

/**
 * The map's click card (docs/NAVIGATION.md §3.3): a click selects a pin and
 * opens its card, a second click on it walks, and nothing opens on hover.
 * MapCard runs every event through `selectionStep`; these tests run the same
 * function, and render the plan the pins are drawn from.
 */

/** Feed events in order, as MapCard does, and report each result. */
function run(events: SelectEvent[], from: string | null = null) {
  let selected = from;
  const walks: (string | null)[] = [];
  const states: (string | null)[] = [];
  for (const ev of events) {
    const next = selectionStep(selected, ev);
    selected = next.selected;
    walks.push(next.walk);
    states.push(selected);
  }
  return { selected, walks, states };
}

const pin = (id: string, here = false): SelectEvent => ({ type: 'pin', id, here });

describe('selection', () => {
  it('the first click selects a pin and walks nowhere', () => {
    expect(run([pin('a')])).toEqual({ selected: 'a', walks: [null], states: ['a'] });
  });

  it('a second click on the same pin walks there and closes the card', () => {
    expect(run([pin('a'), pin('a')])).toEqual({ selected: null, walks: [null, 'a'], states: ['a', null] });
  });

  it('on the pin underfoot the second click only closes the card', () => {
    expect(run([pin('here', true), pin('here', true)])).toEqual({ selected: null, walks: [null, null], states: ['here', null] });
  });

  it('a click on another pin selects that pin and does not walk', () => {
    const r = run([pin('a'), pin('b')]);
    expect(r.states).toEqual(['a', 'b']);
    expect(r.walks).toEqual([null, null]);
    // The click after that is the second one on b.
    expect(run([pin('a'), pin('b'), pin('b')]).walks).toEqual([null, null, 'b']);
  });

  it('Escape closes the card', () => {
    expect(run([pin('a'), { type: 'escape' }]).states).toEqual(['a', null]);
  });

  it('a click outside the card and the pins closes it, and walks nowhere', () => {
    const r = run([pin('a'), { type: 'outside' }]);
    expect(r.states).toEqual(['a', null]);
    expect(r.walks).toEqual([null, null]);
  });

  it('a tab switch (region or floor) or folding the map closes it', () => {
    expect(run([pin('a'), { type: 'view' }]).states).toEqual(['a', null]);
  });

  it('an action in the card (a walk, a go-and-do) closes it', () => {
    expect(run([pin('a'), { type: 'done' }]).states).toEqual(['a', null]);
  });

  it('closes when the selected pin leaves the map, and keeps it while it is there', () => {
    const on = new Set(['a', 'b']);
    expect(run([pin('a'), { type: 'present', ids: on }]).states).toEqual(['a', 'a']);
    expect(run([pin('a'), { type: 'present', ids: new Set(['b']) }]).states).toEqual(['a', null]);
    // Nothing selected: nothing to close.
    expect(run([{ type: 'present', ids: on }]).states).toEqual([null]);
  });

  it('a click after a close selects again, and a close with nothing open is a no-op', () => {
    expect(run([pin('a'), { type: 'escape' }, pin('a')]).states).toEqual(['a', null, 'a']);
    expect(run([{ type: 'escape' }, { type: 'outside' }, { type: 'view' }]).states).toEqual([null, null, null]);
  });
});

describe('where the card stands', () => {
  const view = { w: 1094, h: 900 };
  const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const pinAt = (left: number, top: number, w = 80, h = 60): Box => ({ left, top, right: left + w, bottom: top + h });
  const cardBox = (at: { x: number; y: number }, h: number): Box => ({ left: at.x, top: at.y, right: at.x + CARD_W, bottom: at.y + h });

  it('is right of the pin, lined up with its top', () => {
    const at = placeCard(pinAt(300, 400), view, { w: CARD_W, h: 300 });
    expect(at).toEqual({ x: 300 + 80 + CARD_GAP, y: 396 });
  });

  it('is left of the pin when the right side would run off the window', () => {
    // A pin at the right edge of a 1094 px window's map.
    const p = pinAt(880, 400);
    const at = placeCard(p, view, { w: CARD_W, h: 300 });
    expect(at.x).toBe(880 - CARD_GAP - CARD_W);
    expect(overlaps(cardBox(at, 300), p)).toBe(false);
  });

  it('stays inside the window above and below', () => {
    const low = placeCard(pinAt(300, 880), view, { w: CARD_W, h: 300 });
    expect(low.y + 300).toBeLessThanOrEqual(view.h - CARD_GAP);
    const high = placeCard(pinAt(300, -20), view, { w: CARD_W, h: 300 });
    expect(high.y).toBeGreaterThanOrEqual(CARD_GAP);
  });

  it('keeps clear of an exit label that sits beside the pin outside its group (the floor 0 gate)', () => {
    // The gate pin, and the "→ Threshold" label right of it that the last tutorial step points at.
    const gate = pinAt(500, 400, 80, 60);
    const label: Box = { left: gate.right + 4, top: 420, right: gate.right + 4 + 80, bottom: 440 };
    const without = placeCard(gate, view, { w: CARD_W, h: 300 });
    // Without the label the card goes right of the pin, over the label: the defect.
    expect(overlaps(cardBox(without, 300), label)).toBe(true);
    const at = placeCard(gate, view, { w: CARD_W, h: 300 }, [label]);
    expect(overlaps(cardBox(at, 300), label)).toBe(false);
    expect(overlaps(cardBox(at, 300), gate)).toBe(false);
    // Left of the pin, as the right side was taken.
    expect(at.x + CARD_W).toBeLessThanOrEqual(gate.left);
  });

  it('keeps clear of exit labels across windows, pin places and label sides', () => {
    for (const w of [1024, 1094, 1440]) {
      for (let left = 60; left + 80 <= w - 60; left += 53) {
        for (let top = 40; top + 60 <= 760; top += 70) {
          const p = pinAt(left, top);
          for (const side of ['right', 'left'] as const) {
            const label: Box = side === 'right'
              ? { left: p.right + 4, top: top + 20, right: p.right + 84, bottom: top + 40 }
              : { left: p.left - 84, top: top + 20, right: p.left - 4, bottom: top + 40 };
            const at = placeCard(p, { w, h: 800 }, { w: CARD_W, h: 320 }, [label]);
            const c = cardBox(at, 320);
            expect(overlaps(c, p), `${w} pin ${left},${top} label ${side}`).toBe(false);
            expect(overlaps(c, label), `${w} pin ${left},${top} label ${side}`).toBe(false);
          }
        }
      }
    }
  });

  it('takes the place that covers least when every place covers an avoided box', () => {
    const p = pinAt(500, 400);
    const all: Box = { left: 0, top: 0, right: 1094, bottom: 900 };
    const small: Box = { left: p.right + 8, top: 380, right: p.right + 40, bottom: 420 };
    const at = placeCard(p, view, { w: CARD_W, h: 300 }, [small]);
    expect(overlaps(cardBox(at, 300), small)).toBe(false);
    // A box covering the whole window: the first place (right of the pin) stays.
    expect(placeCard(p, view, { w: CARD_W, h: 300 }, [all])).toEqual(placeCard(p, view, { w: CARD_W, h: 300 }));
  });

  it('never covers the pin, across every place on a window the card fits beside or under', () => {
    for (const w of [420, 700, 1094, 1440]) {
      for (let left = 0; left + 80 <= w; left += 37) {
        for (let top = 0; top + 60 <= 800; top += 61) {
          const p = pinAt(left, top);
          const at = placeCard(p, { w, h: 800 }, { w: CARD_W, h: 320 });
          expect(overlaps(cardBox(at, 320), p), `${w}: pin at ${left},${top}`).toBe(false);
          expect(at.x, `${w}: pin at ${left},${top}`).toBeGreaterThanOrEqual(0);
          expect(at.x + CARD_W, `${w}: pin at ${left},${top}`).toBeLessThanOrEqual(w);
        }
      }
    }
  });
});

describe('keyboard: from the pin into the card and back', () => {
  it('Tab on the selected pin enters the first control of its card', () => {
    expect(cardTab('pin', 3, false)).toBe(0);
    expect(cardTab('pin', 1, false)).toBe(0);
  });

  it('Tab on a pin whose card has no control, and Shift+Tab on the pin, follow the page order', () => {
    expect(cardTab('pin', 0, false)).toBeNull();
    expect(cardTab('pin', 3, true)).toBeNull();
  });

  it('Tab inside the card follows the page order until the last control, which returns to the pin', () => {
    expect(cardTab(0, 3, false)).toBeNull();
    expect(cardTab(1, 3, false)).toBeNull();
    expect(cardTab(2, 3, false)).toBe('pin');
    expect(cardTab(0, 1, false)).toBe('pin');
  });

  it('Shift+Tab off the first control returns to the pin; elsewhere it follows the page order', () => {
    expect(cardTab(0, 3, true)).toBe('pin');
    expect(cardTab(1, 3, true)).toBeNull();
    expect(cardTab(2, 3, true)).toBeNull();
  });

  it('a full pass: Tab through three controls and back to the pin, Enter on the pin walks, Escape closes', () => {
    // The pin was selected by a click or Enter; focus is on it.
    let selected = selectionStep(null, pin('a')).selected;
    expect(selected).toBe('a');
    let at: 'pin' | number = 'pin';
    const visited: (string | number)[] = [];
    for (let i = 0; i < 4; i++) {
      const to = cardTab(at, 3, false);
      // Where the page's own order lands inside the card is the next control.
      at = to ?? (typeof at === 'number' ? at + 1 : at);
      visited.push(at);
    }
    expect(visited).toEqual([0, 1, 2, 'pin']);
    // Enter on the selected pin is a second click on it: it walks and closes.
    const second = selectionStep(selected, pin('a'));
    expect(second).toEqual({ selected: null, walk: 'a' });
    selected = selectionStep(second.selected ?? 'a', { type: 'escape' }).selected;
    expect(selected).toBeNull();
  });
});

describe('the pins as drawn', () => {
  const state = createInitialState(1, TOWERS.the_ascent.hubSpot);
  state.discovered = Object.keys(SPOTS);
  const plan = buildPlan(state, { region: 'threshold', area: null, width: 788, tiled: false, focus: state.spot, target: null });
  const draw = (selected: string | null) =>
    render(MapPlan, { props: { plan, stuck: false, selected, onpick: () => {}, onexit: () => {} } }).body;
  const tagOf = (html: string, label: string) =>
    [...html.matchAll(/<g\b[^>]*>/g)].map((m) => m[0]).find((t) => t.includes(`aria-label="${label}"`));

  it('marks the selected pin expanded and selected, and every other pin collapsed', () => {
    const html = draw('the_forges');
    const forges = tagOf(html, 'The Forges')!;
    expect(forges).toContain('aria-expanded="true"');
    expect(forges).toMatch(/class="[^"]*\bselected\b/);
    const other = tagOf(html, 'The Rolls')!;
    expect(other).toContain('aria-expanded="false"');
    expect(other).not.toMatch(/class="[^"]*\bselected\b/);
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(1);
    expect(draw(null).match(/aria-expanded="true"/g)).toBeNull();
  });

  it('wears no hover handler: nothing opens on hover', () => {
    // Svelte compiles handlers away from the markup; the source is the record.
    const read = (name: string) => fs.readFileSync(new URL(`../src/ui/${name}`, import.meta.url), 'utf8');
    expect(read('MapPlan.svelte')).not.toMatch(/onmouseenter|onmouseleave|onfocus|onblur|onpointerenter/);
    expect(read('MapCard.svelte')).not.toMatch(/onmouseenter|onmouseleave|closeTimer|closeSoon|keepCard/);
  });
});
