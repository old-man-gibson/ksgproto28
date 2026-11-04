import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import type { Component } from 'svelte';
import { revealMapped } from '../src/core/systems/mapped';
import { clearFloors } from './fixtures/floors';

/**
 * The Stations row rendered to HTML on the server with the real game state
 * behind it (ui/state.svelte.ts). The row is one line of one fixed height in
 * every state (the user's no-shift rule, 2026-11-04): the markup that makes
 * that hold is the same wrapper and the same single scrolling line whether the
 * row holds stations, nothing, a knockout return or a walk. Layout itself is
 * measured in a browser (docs/NAVIGATION.md §3.6).
 */

// The portraits are licensed art that a worktree reaches through a junction, which Vite refuses to serve as a
// `?url` import; this test reads no portrait.
vi.mock('../src/ui/lib/enemyArt.gen', () => ({ ENEMY_ART: {} }));

type State = typeof import('../src/ui/state.svelte');
let st: State;
let StationsRow: Component;

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
  StationsRow = (await import('../src/ui/StationsRow.svelte')).default as Component;
  // The first import transforms the Svelte tree; under the parallel suite that passes the 10 s default.
}, 60_000);

/** Past the tutorial, floors 1–6 cleared, floor 4 known, standing at the Granary Gate with nothing worked yet. */
function afterTutorial(): void {
  const gs = st.gs;
  gs.stats['flag:tutorial_done'] = 1;
  clearFloors(gs.stats);
  const known = ['ascent_foot', 'granary_gate', 'granary_kitchens', 'the_sand', 'f4_treeline', 'f4_woods_edge'];
  gs.discovered = [...new Set([...gs.discovered, ...known])];
  revealMapped(gs); // the city has no fog: standing in it maps it
  gs.spot = 'granary_gate';
  gs.travel = null;
  gs.travelPlan = [];
  gs.recovering = false;
  gs.pendingReturn = null;
  gs.resumeActivity = {};
}

const html = (): string => render(StationsRow).body;
const count = (s: string, needle: string): number => s.split(needle).length - 1;

describe('the Stations row', () => {
  it('is hidden while floor 0\'s tutorial runs', () => {
    st.gs.stats['flag:tutorial_done'] = 0;
    st.gs.resumeActivity = { the_sand: 'train_dex_sand' };
    expect(html()).not.toContain('stations-row');
  });

  it('with nothing worked, says so on the same single line', () => {
    afterTutorial();
    const body = html();
    expect(body).toContain('stations-row');
    expect(body).toContain('No stations');
    expect(count(body, 'st-scroll')).toBe(1);
  });

  it('lists the newest as "Back" with its place and route time, then the rest under "Stations"', () => {
    afterTutorial();
    st.gs.resumeActivity = { the_sand: 'train_dex_sand', granary_kitchens: 'job_pans', f4_woods_edge: 'hunt' };
    const body = html();
    expect(count(body, 'st-scroll')).toBe(1);
    expect(body).toContain('>Back<');
    expect(body).toContain('>Stations<');
    expect(body).toContain('Hunt the Edge · The Woods Edge');
    expect(body).toContain('21 s');
    expect(body).not.toContain('No stations');
    // Newest first: the Woods Edge, the Kitchens, the Sand.
    const at = (name: string) => body.indexOf(name);
    expect(at('The Woods Edge')).toBeGreaterThan(-1);
    expect(at('The Woods Edge')).toBeLessThan(at('The Granary Kitchens'));
    expect(at('The Granary Kitchens')).toBeLessThan(at('The Sand'));
  });

  it('each station is one button; none is a link or a hover card', () => {
    afterTutorial();
    st.gs.resumeActivity = { the_sand: 'train_dex_sand', f4_woods_edge: 'hunt' };
    const body = html();
    expect(count(body, '<button')).toBe(2);
    expect(body).not.toMatch(/<a\s/);
    expect(body).not.toContain('tip-target');
  });

  it('with a knockout return in flight, prints it with "Stay here", has no "Back", and omits the target', () => {
    afterTutorial();
    st.gs.resumeActivity = { the_sand: 'train_dex_sand', f4_woods_edge: 'hunt' };
    st.gs.spot = 'f4_treeline';
    st.gs.recovering = true;
    st.gs.pendingReturn = {
      target: { spot: 'f4_woods_edge', activity: 'hunt' },
      phase: 'return',
      wins: 0,
      probes: 0,
    };
    const body = html();
    expect(count(body, 'st-scroll')).toBe(1);
    expect(body).toContain('Returning to The Woods Edge after recovery');
    expect(body).toContain('Stay here');
    expect(body).not.toContain('>Back<');
    // The Woods Edge appears once, in the line, not as a station button.
    expect(count(body, 'Hunt the Edge')).toBe(0);
    expect(body).toContain('The Sand');
    st.gs.recovering = false;
    st.gs.pendingReturn = null;
  });

  it('while walking, keeps the one line and says the stations open on arrival', () => {
    afterTutorial();
    st.gs.resumeActivity = { f4_woods_edge: 'hunt' };
    st.gs.spot = 'granary_gate';
    st.gs.travel = { from: 'granary_gate', to: 'granary_kitchens', ticksLeft: 5, total: 8 };
    const body = html();
    expect(count(body, 'st-scroll')).toBe(1);
    expect(body).toContain('Stations open on arrival.');
    expect(body).not.toContain('Hunt the Edge');
    st.gs.travel = null;
  });

  it('keeps a return\'s line while walking, with the button that ends it', () => {
    afterTutorial();
    st.gs.resumeActivity = { f4_woods_edge: 'hunt' };
    st.gs.travel = { from: 'granary_gate', to: 'granary_kitchens', ticksLeft: 5, total: 8 };
    st.gs.pendingReturn = {
      target: { spot: 'f4_woods_edge', activity: 'hunt' },
      phase: 'return',
      wins: 0,
      probes: 0,
    };
    const body = html();
    expect(body).toContain('Returning to The Woods Edge');
    expect(body).not.toContain('after recovery');
    expect(body).toContain('Stay here');
    expect(body).toContain('Stations open on arrival.');
    st.gs.travel = null;
    st.gs.pendingReturn = null;
  });

  it('never names a place that is not found', () => {
    afterTutorial();
    st.gs.resumeActivity = { f4_woods_edge: 'hunt', the_sand: 'train_dex_sand' };
    st.gs.discovered = st.gs.discovered.filter((id) => id !== 'f4_woods_edge');
    const body = html();
    expect(body).not.toContain('Woods Edge');
    expect(body).toContain('The Sand');
  });
});
