import { beforeAll, describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { Component } from 'svelte';
import { TUTORIAL_EXIT } from '../src/core/data/tutorial.data';
import { tutorialScreen } from '../src/ui/lib/tutorialFocus';

/**
 * MapCard rendered to HTML on the server, with the real game state behind it
 * (ui/state.svelte.ts), so the markup the tutorial's beacon rides on is
 * checked where it is drawn. The node environment has no DOM and no storage:
 * the state module reads localStorage at import, so a stand-in is installed
 * first.
 */

type State = typeof import('../src/ui/state.svelte');
let st: State;
let MapCard: Component;

beforeAll(async () => {
  const store: Record<string, string> = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
    key: () => null,
    length: 0,
    clear: () => {},
  };
  st = await import('../src/ui/state.svelte');
  MapCard = (await import('../src/ui/MapCard.svelte')).default as Component;
});

function walk(): void {
  for (let i = 0; i < 10_000 && st.gs.travel; i++) st.game.tick();
}

function winOneFight(spot: string): void {
  const before = st.gs.stats[`fights:${spot}`] ?? 0;
  st.game.selectActivity('hunt');
  for (let i = 0; i < 20_000 && (st.gs.stats[`fights:${spot}`] ?? 0) === before; i++) st.game.tick();
}

/** The opening tag of the first element whose attributes contain `needle`. */
function tagWith(html: string, element: string, needle: string): string | null {
  for (const m of html.matchAll(new RegExp(`<${element}\\b[^>]*>`, 'g'))) if (m[0].includes(needle)) return m[0];
  return null;
}

const classes = (tag: string) => (/class="([^"]*)"/.exec(tag)?.[1] ?? '').split(/\s+/);
const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

describe('the exit at the gate on floor 0', () => {
  it('stands in the frame, clickable, and wears the tutorial beacon on its last step', () => {
    // The tutorial to its last step: the gate, and one door left.
    st.game.chooseTutorialWeapon('sword', true);
    st.game.chooseTutorialStance('neutral');
    st.game.travelTo('f0_cellblock');
    walk();
    winOneFight('f0_cellblock');
    st.game.selectActivity(null);
    st.game.travelTo('f0_field');
    walk();
    st.game.chooseTutorialSpell('fire');
    winOneFight('f0_field');
    st.game.selectActivity(null);
    st.game.travelTo('f0_gate');
    walk();
    expect(st.gs.spot).toBe('f0_gate');
    expect(tutorialScreen(st.gs)?.target).toBe(`exit:${TUTORIAL_EXIT}`);

    const { body } = render(MapCard);
    // The floor is a tiled region: the picture keeps its proportions and the diagram sits over it.
    expect(body).toContain('class="map-wrap');
    expect(body).toContain('<canvas');
    const exit = tagWith(body, 'text', 'aria-label="Travel toward Threshold"');
    expect(exit, 'the → Threshold label').not.toBeNull();
    const cls = classes(exit!);
    for (const c of ['exit', 'tutorial-target', 'beacon-text']) expect(cls, c).toContain(c);
    expect(exit).toContain('role="button"');
    expect(exit).toContain('tabindex="0"');
    // Inside the 560 px frame, whichever side of its pin it took.
    const x = Number(attr(exit!, 'x'));
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(560);
    expect(body).toMatch(/→ Threshold\s*<\/text>/);
    // The ▼ above it, and no other element for the scroll to land on.
    expect(tagWith(body, 'text', 'beacon-arrow')).not.toBeNull();
    expect(body.match(/tutorial-target/g)).toHaveLength(1);
    // The one thing the player can click to leave is a label, not a pin.
    expect(body).not.toContain('aria-label="Unexplored place"');
  });

  it('keeps the exit after the tutorial, without its beacon', () => {
    st.game.travelTo(TUTORIAL_EXIT);
    walk();
    expect(tutorialScreen(st.gs)).toBeNull();
    // The road back is one-way: put the player at the gate to look at the floor again.
    st.gs.spot = 'f0_gate';
    const { body } = render(MapCard);
    expect(body).not.toContain('tutorial-target');
    expect(body).not.toContain('beacon-text');
    const exit = tagWith(body, 'text', 'aria-label="Travel toward Threshold"');
    expect(exit).not.toBeNull();
    expect(classes(exit!)).toContain('exit');
  });
});
