import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { compile } from 'svelte/compiler';
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
    // The button's title is a tap card on a touch screen (GoButton wraps it in a
    // touch-only Tip): no card opens for a mouse, which has the title.
    expect(count(body, 'tip-target')).toBe(2);
    expect(count(body, 'touch-only')).toBe(2);
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
    // The leg under way cannot be called off, so the button names where it ends.
    expect(body).toContain('Stop at The Granary Kitchens');
    expect(body).not.toContain('Stay here');
    expect(body).toContain('Stations open on arrival.');
    st.gs.travel = null;
    st.gs.pendingReturn = null;
  });

  it('standing at a hunt target, prints the first-win line with "Stay here"', () => {
    afterTutorial();
    st.gs.resumeActivity = { the_sand: 'train_dex_sand' };
    st.gs.spot = 'f4_woods_edge';
    st.gs.pendingReturn = {
      target: { spot: 'f4_woods_edge', activity: 'hunt' },
      phase: 'return',
      wins: 0,
      probes: 0,
    };
    const body = html();
    expect(body).toContain('At The Woods Edge: the return ends at the first win.');
    expect(body).not.toContain('Returning to');
    expect(body).toContain('Stay here');
    st.gs.pendingReturn = null;
  });

  it('does not take the wheel: nothing in the row listens for it or cancels it', () => {
    const src = readFileSync(new URL('../src/ui/StationsRow.svelte', import.meta.url), 'utf8');
    expect(src).not.toMatch(/addEventListener|onwheel|['"]wheel['"]|preventDefault|passive/i);
  });

  it('marks the newest station only while its button is enabled', () => {
    const src = readFileSync(new URL('../src/ui/StationsRow.svelte', import.meta.url), 'utf8');
    const { css } = compile(src, { generate: 'client', css: 'external', filename: 'StationsRow.svelte' });
    const rules = [...css!.code.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(([, , body]) => body.includes('var(--accent)'));
    const marks = rules.filter(([sel]) => sel.includes('.station.back'));
    expect(marks.length).toBeGreaterThan(0);
    for (const [sel] of marks) expect(sel).toContain(':not(:disabled)');
  });

  it('keeps the return\'s line at its width while the stations after it overflow: the cell does not shrink for them', () => {
    const src = readFileSync(new URL('../src/ui/StationsRow.svelte', import.meta.url), 'utf8');
    const { css } = compile(src, { generate: 'client', css: 'external', filename: 'StationsRow.svelte' });
    const code = css!.code.replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = (name: string) => [...code.matchAll(/([^{}]+)\{([^}]*)\}/g)].find(([, sel]) => sel.trim().startsWith(`.${name}`))?.[2] ?? '';
    // The line may shrink only inside its own cell, which is capped at the column and never squeezed by the stations.
    expect(rule('st-return')).toMatch(/flex:\s*none/);
    expect(rule('st-return')).toMatch(/max-width:\s*100%/);
    // A width of its own, not the width of its text: the countdown changing never moves what follows.
    expect(rule('st-line')).toMatch(/width:\s*34em/);
    expect(rule('st-line')).toMatch(/flex:\s*0 1 auto/);
    afterTutorial();
    st.gs.resumeActivity = { the_sand: 'train_dex_sand', f4_woods_edge: 'hunt' };
    expect(html()).not.toContain('st-return');
    st.gs.pendingReturn = { target: { spot: 'f4_woods_edge', activity: 'hunt' }, phase: 'return', wins: 0, probes: 0 };
    // The caption, the line and the button are one cell.
    expect(html()).toMatch(/st-return[^>]*>\s*<span class="st-cap[^>]*>Return<\/span>\s*<span class="st-line[^>]*>[^<]*<\/span>\s*<button[^>]*st-stay/);
    st.gs.pendingReturn = null;
  });

  it('a queued "stay" intent reads as nothing queued in the destination preview, whatever the spot remembers', async () => {
    const DestinationPreview = (await import('../src/ui/panels/DestinationPreview.svelte')).default as Component;
    afterTutorial();
    st.gs.resumeActivity = { granary_kitchens: 'job_pans' };
    st.gs.spot = 'granary_gate';
    st.gs.travel = { from: 'granary_gate', to: 'granary_kitchens', ticksLeft: 5, total: 8 };
    st.gs.travelPlan = [];
    st.gs.travelIntent = null;
    expect(render(DestinationPreview).body).toContain('resume');
    st.gs.travelIntent = { spot: 'granary_kitchens', activity: '' };
    const body = render(DestinationPreview).body;
    expect(body).toContain('nothing queued');
    expect(body).not.toContain('resume');
    st.gs.travelIntent = null;
    st.gs.travel = null;
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
