import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { dockParts } from '../src/ui/lib/shell';
import { tutorialScreen } from '../src/ui/lib/tutorialFocus';
import { PHONE_BELOW } from '../src/ui/lib/viewport.svelte';
import { CARD_GAP, CARD_MARGIN, cardTop } from '../src/ui/lib/tipPlace';
import { readText } from './themeCss';

/**
 * The phone layout (docs/PHONE.md, docs/plans/ui-proposals.md A3). The pixels
 * are checked by screenshot (the doc lists the viewports); these are the parts
 * a unit test can hold: what the dock draws on floor 0, where a touch card
 * goes, and the markup rules that keep the two layouts from drawing the same
 * thing twice.
 */

describe('the dock on floor 0', () => {
  function walk(g: Game): void {
    for (let i = 0; i < 10_000 && g.state.travel; i++) g.tick();
    expect(g.state.travel).toBeNull();
  }

  function winOneFight(g: Game, spot: string): void {
    const before = g.state.stats[`fights:${spot}`] ?? 0;
    g.selectActivity('hunt');
    for (let i = 0; i < 20_000 && (g.state.stats[`fights:${spot}`] ?? 0) === before; i++) g.tick();
    expect(g.state.stats[`fights:${spot}`] ?? 0).toBe(before + 1);
  }

  it('draws everything once the tutorial is over', () => {
    expect(dockParts(null)).toEqual({ bars: true, gold: true, controls: true });
  });

  it('follows the tutorial screen at every step: bars with the sidebar, gold with the first kill, no controls', () => {
    const g = new Game(createInitialState(21));
    const s = g.state;
    const seen: string[] = [];
    const check = () => {
      const screen = tutorialScreen(s);
      if (!screen) return;
      seen.push(screen.stepId);
      expect(dockParts(screen), screen.stepId).toEqual({ bars: screen.sidebar, gold: screen.gold, controls: false });
    };

    check();
    g.chooseTutorialWeapon('sword', true);
    g.chooseTutorialStance('neutral');
    check();
    g.travelTo('f0_cellblock');
    walk(g);
    check();
    // The first fight brings the bars in, and not yet the gold.
    expect(dockParts(tutorialScreen(s))).toEqual({ bars: true, gold: false, controls: false });
    winOneFight(g, 'f0_cellblock');
    g.selectActivity(null);
    g.travelTo('f0_field');
    walk(g);
    check();
    // Gold arrives with the next step, as in the header.
    expect(dockParts(tutorialScreen(s))).toEqual({ bars: true, gold: true, controls: false });
    g.chooseTutorialSpell('fire');
    check();
    winOneFight(g, 'f0_field');
    g.selectActivity(null);
    g.travelTo('f0_gate');
    walk(g);
    check();
    expect(seen.length).toBeGreaterThanOrEqual(5);
    // The first steps show the job strip alone.
    const first = new Game(createInitialState(22)).state;
    expect(dockParts(tutorialScreen(first))).toEqual({ bars: false, gold: false, controls: false });
  });
});

describe('where a touch card goes', () => {
  const WINDOW = 800;

  it('sits under its target when the whole card fits there', () => {
    expect(cardTop(100, 140, 300, WINDOW)).toBe(140 + CARD_GAP);
  });

  it('goes over the target when it does not fit under it', () => {
    // Target at 640..680: 686 + 200 > 792, so the card ends 6px above the target.
    expect(cardTop(640, 680, 200, WINDOW)).toBe(640 - 200 - CARD_GAP);
  });

  it('never leaves the window, whatever the target and the height', () => {
    for (let top = -50; top <= WINDOW + 50; top += 25) {
      for (let height = 20; height <= WINDOW - 2 * CARD_MARGIN; height += 37) {
        const y = cardTop(top, top + 40, height, WINDOW);
        expect(y, `target ${top}, height ${height}`).toBeGreaterThanOrEqual(CARD_MARGIN);
        expect(y + height, `target ${top}, height ${height}`).toBeLessThanOrEqual(WINDOW - CARD_MARGIN);
      }
    }
  });

  it('starts a card as tall as the window at the top margin', () => {
    expect(cardTop(300, 340, WINDOW - 2 * CARD_MARGIN, WINDOW)).toBe(CARD_MARGIN);
    // Taller than that (the stylesheet scrolls it): still the top margin, never above it.
    expect(cardTop(300, 340, WINDOW + 200, WINDOW)).toBe(CARD_MARGIN);
  });
});

describe('the layouts do not draw one thing twice', () => {
  const app = readText('src/ui/App.svelte');
  const dock = readText('src/ui/Dock.svelte');
  const bottom = readText('src/ui/BottomBar.svelte');
  const sidebar = readText('src/ui/panels/Sidebar.svelte');

  it('breaks at 700px from one flag: the shell stylesheets do not repeat the number', () => {
    expect(PHONE_BELOW).toBe(700);
    const viewport = readText('src/ui/lib/viewport.svelte.ts');
    expect(viewport).toContain('PHONE_BELOW - 1');
    // The phone layout is a class set from the one flag, so no stylesheet repeats the number.
    for (const [name, css] of [['App', app], ['Dock', dock], ['BottomBar', bottom]] as const) {
      expect(css.match(/max-width:\s*(\d+)px/g)?.filter((m) => /\b(699|700)px/.test(m)) ?? [], name).toEqual([]);
    }
  });

  it('shows the dock or the header, never both', () => {
    expect(app).toMatch(/\{#if phone\}\s*<Dock /);
    expect(app).toMatch(/\{#if !phone\}\s*<header /);
  });

  it('draws the pool bars in the dock on a phone and in the sidebar otherwise, never both', () => {
    expect(dock).toContain('<ResourceBars mode="dock" />');
    expect(sidebar).toContain("<ResourceBars mode={phone ? 'extras' : 'panel'} />");
    expect(app).toContain('<Sidebar combatStats={!screen} {phone}>');
  });

  it('lists the same screens in the bottom row and the left column', () => {
    expect(app).toContain('<NavIndex {entries} />');
    expect(app).toContain('<BottomBar {entries}');
    expect(app).toMatch(/const entries = \$derived\(visibleNav\(gs, screen\)\)/);
  });

  it('names the dock `dock`, and no phone block `bar` (docs/PITFALLS.md §8)', () => {
    expect(dock).toMatch(/<header class="dock"/);
    for (const [name, src] of [['Dock', dock], ['BottomBar', bottom]] as const) {
      expect(src.match(/class="[^"]*\bbar\b[^"]*"/g) ?? [], name).toEqual([]);
    }
  });

  it('makes the screen a size container named "tab"', () => {
    expect(app).toContain('container: tab / inline-size;');
  });

  it('pads the dock, the bottom bar and the sheets by the safe-area insets', () => {
    expect(dock).toContain('var(--safe-top)');
    expect(bottom).toContain('var(--safe-bottom)');
    expect(readText('src/ui/lib/Modal.svelte')).toContain('var(--safe-bottom)');
    expect(readText('index.html')).toContain('viewport-fit=cover');
    const css = readText('src/app.css');
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(css).toContain(`--safe-${side}: max(env(safe-area-inset-${side}, 0px)`);
    }
  });
});

describe('storage the browser refuses', () => {
  /** Loads save.ts afresh with `localStorage` throwing on access, as a WebView with site data blocked does. */
  async function withBlockedStorage() {
    const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Access is denied for this document.', 'SecurityError');
      },
    });
    try {
      vi.resetModules();
      return await import('../src/core/save/save');
    } finally {
      if (had) Object.defineProperty(globalThis, 'localStorage', had);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  }

  it('boots on an in-memory stand-in, and keeps what it is given for the visit', async () => {
    const { browserStorage, SAVE_KEY, saveToStorage, loadFromStorage, clearStorage } = await withBlockedStorage();
    expect(browserStorage.getItem(SAVE_KEY)).toBeNull();
    expect(loadFromStorage()).toEqual({ state: null, corrupted: false });

    const state = createInitialState(5);
    saveToStorage(state);
    expect(browserStorage.getItem(SAVE_KEY)).not.toBeNull();
    expect(loadFromStorage().state?.totalTicks).toBe(state.totalTicks);
    expect(browserStorage.length).toBe(1);
    expect(browserStorage.key(0)).toBe(SAVE_KEY);

    clearStorage();
    expect(browserStorage.length).toBe(0);
    expect(loadFromStorage()).toEqual({ state: null, corrupted: false });
  });
});

describe('touch rules', () => {
  const css = readText('src/app.css');

  it('gives a finger 44px of hit height under a coarse pointer', () => {
    const block = css.slice(css.indexOf('@media (pointer: coarse)'));
    expect(block).toMatch(/min-height:\s*44px/);
    expect(block).toMatch(/button/);
  });

  it('stops the double-tap delay on the page controls, and selection on long press on controls only', () => {
    expect(css).toMatch(/touch-action:\s*manipulation/);
    const coarse = css.slice(css.indexOf('@media (pointer: coarse)'));
    // Controls are named; the body and plain text are not.
    expect(coarse).toMatch(/user-select:\s*none/);
    expect(coarse.split('user-select')[0]).not.toMatch(/(^|[\s,{])(body|html|p|div|span)\s*[,{]/);
  });
});
