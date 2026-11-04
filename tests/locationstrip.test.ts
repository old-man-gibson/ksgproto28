import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import type { Component } from 'svelte';

/**
 * The slots above and below the map keep their place (the user's no-shift
 * rule, 2026-11-04): the strip over the map is always drawn at its least
 * height, whether the player stands at a spot with activities, at one with
 * none, or walks, and the journey line under the map is a slot that is empty
 * while standing. Layout itself is measured in a browser (docs/NAVIGATION.md
 * §3.3); these tests hold the markup that makes it hold.
 */

// The portraits are licensed art that a worktree reaches through a junction, which Vite refuses to serve as a
// `?url` import; this test reads no portrait.
vi.mock('../src/ui/lib/enemyArt.gen', () => ({ ENEMY_ART: {} }));

type State = typeof import('../src/ui/state.svelte');
let st: State;
let LocationPanel: Component;
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
  LocationPanel = (await import('../src/ui/panels/LocationPanel.svelte')).default as Component;
  MapCard = (await import('../src/ui/MapCard.svelte')).default as Component;
  // Past the tutorial, with Threshold known.
  st.gs.stats['flag:tutorial_done'] = 1;
  st.gs.discovered = [...new Set([...st.gs.discovered, 'ascent_foot', 'chancery_arch', 'wrights_gate'])];
  // The first import transforms the Svelte tree; under the parallel suite that passes the 10 s default.
}, 60_000);

/** The opening tag of the strip over the map. */
const stripTag = (html: string): string | null => /<div class="panel act-strip[^>]*>/.exec(html)?.[0] ?? null;
const minHeight = (tag: string): number => Number(/min-height:\s*(\d+)px/.exec(tag)?.[1]);

describe('the strip over the map', () => {
  it('is drawn at a spot with no activities, with one dim line, at the least height', () => {
    st.gs.travel = null;
    st.gs.spot = 'chancery_arch';
    const { body } = render(LocationPanel);
    const tag = stripTag(body);
    expect(tag, 'the strip').not.toBeNull();
    expect(minHeight(tag!)).toBe(62);
    expect(body).toContain('No activities here.');
  });

  it('is drawn at a spot with activities, at the same least height, without the dim line', () => {
    st.gs.travel = null;
    st.gs.spot = 'ascent_foot';
    const { body } = render(LocationPanel);
    const tag = stripTag(body);
    expect(tag).not.toBeNull();
    expect(minHeight(tag!)).toBe(62);
    expect(body).not.toContain('No activities here.');
  });

  it('is drawn while walking, at least that height, from a spot with a strip or without', () => {
    for (const from of ['ascent_foot', 'chancery_arch']) {
      st.gs.spot = from;
      st.gs.travel = { from, to: 'wrights_gate', ticksLeft: 5, total: 12 };
      const { body } = render(LocationPanel);
      const tag = stripTag(body);
      expect(tag, `walking from ${from}`).not.toBeNull();
      expect(minHeight(tag!), `walking from ${from}`).toBeGreaterThanOrEqual(62);
      expect(body).toContain('Traveling to');
    }
    st.gs.travel = null;
  });
});

describe('the journey line under the map', () => {
  it('is a slot while standing, and holds the journey while walking', () => {
    st.gs.spot = 'ascent_foot';
    st.gs.travel = null;
    const standing = render(MapCard).body;
    expect(standing).toMatch(/<div class="journey small[^"]*">[\s\S]{0,40}<\/div>/);
    expect(standing).not.toContain('En route');
    st.gs.travel = { from: 'ascent_foot', to: 'wrights_gate', ticksLeft: 5, total: 12 };
    st.gs.travelPlan = [];
    const walking = render(MapCard).body;
    expect(walking).toMatch(/<div class="journey small[^"]*">[\s\S]*En route to/);
    st.gs.travel = null;
  });
});
