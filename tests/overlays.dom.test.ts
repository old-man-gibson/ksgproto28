import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import Harness from './fixtures/OverlayHarness.svelte';
import { shown } from './fixtures/overlayState.svelte';
import { pressBack } from '../src/ui/lib/androidBack';
import { overlayCount } from '../src/ui/lib/overlays';

// Escape and the Android back button close exactly one overlay: the topmost, by
// the layer it is drawn on and then by arrival (ui/lib/overlays.ts). These mount
// the real welcome-back report, fight summary, Modal, tag picker, log drawer and
// tip card in jsdom and press the keys. A hold-play window is a stand-in.

const SUMMARY = {
  ticks: 36000,
  ms: 3_600_000,
  capped: false,
  kills: 12,
  goldGained: 340,
  itemsGained: 2,
  attrLevels: [],
  skillLevels: [],
};
const LEDGER = {
  outcome: 'knocked_out',
  endedAt: 123,
  ticks: 80,
  cause: '',
  foes: [{ icon: 'x', name: 'Keeper', count: 1, level: 9 }],
  incoming: [{ icon: 'x', label: 'Bite', amount: 50, hits: 3 }],
  stopped: { absorbed: 1, parried: 0, dodged: 0, riposted: 0, parries: 0, dodges: 0 },
  healed: {},
  healRefused: 0,
  outgoing: { damage: 10, hits: 2, kills: 0 },
  afflictions: [],
  transcript: [],
};

/** What is on screen, sorted: window headings, plus the drawer, the picker's list and the tip card. */
function open(): string[] {
  const out = [...document.querySelectorAll('[role=dialog]')].map((d) =>
    (d.querySelector('h2, h3')?.textContent ?? '').replace(/[^\x20-\x7E]/g, '').trim(),
  );
  if (document.querySelector('.log-drawer')) out.push('Log drawer');
  if (document.querySelector('.picker .menu')) out.push('Tag list');
  if (document.querySelector('.tip-pop')) out.push('Tip card');
  return out.sort();
}

/** The app's hooks for one back press: what it saved and minimized, in order. */
function hooks(blocked = false) {
  const calls: string[] = [];
  return {
    calls,
    blocked: () => blocked,
    save: () => void calls.push('save'),
    minimize: () => void calls.push('minimize'),
  };
}

const flush = () => flushSync();
const back = (h: ReturnType<typeof hooks>) => {
  pressBack(h);
  flush();
};
const escape = () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  flush();
};

/** Open a touch tip card the way a finger does: a long press on the target. */
function longPressTip() {
  vi.useFakeTimers();
  const target = document.querySelector('.tip-target') as HTMLElement;
  const down = new Event('pointerdown', { bubbles: true });
  Object.defineProperty(down, 'pointerType', { value: 'touch' });
  target.dispatchEvent(down);
  vi.advanceTimersByTime(500);
  vi.useRealTimers();
  flush();
}

let app: ReturnType<typeof mount>;
beforeEach(() => {
  Object.assign(shown, { menu: false, cook: false, picker: false, drawer: false, hold: false, offline: null, defeat: null });
  app = mount(Harness, { target: document.body });
  flush();
});
afterEach(() => {
  unmount(app);
  // Every overlay left the stack with its component.
  expect(overlayCount()).toBe(0);
});

describe('the Android back button closes the topmost overlay', () => {
  it('nothing open: saves, then minimizes', () => {
    const h = hooks();
    back(h);
    expect(h.calls).toEqual(['save', 'minimize']);
  });

  it('the welcome-back report alone closes, and the app stays', () => {
    shown.offline = SUMMARY;
    flush();
    const h = hooks();
    back(h);
    expect(open()).toEqual([]);
    expect(h.calls).toEqual([]);
  });

  it('report, then the fight summary over it: back closes the summary, back the report, back minimizes', () => {
    shown.offline = SUMMARY;
    flush();
    shown.defeat = LEDGER;
    flush();
    expect(open()).toEqual(['Welcome back!', 'You were knocked out']);
    const h = hooks();
    back(h);
    expect(open()).toEqual(['Welcome back!']);
    back(h);
    expect(open()).toEqual([]);
    expect(h.calls).toEqual([]);
    back(h);
    expect(h.calls).toEqual(['save', 'minimize']);
  });

  it('the summary first and the report arriving under it (a stall while it is up): the summary still closes first', () => {
    shown.defeat = LEDGER;
    flush();
    shown.offline = SUMMARY;
    flush();
    const h = hooks();
    back(h);
    expect(open()).toEqual(['Welcome back!']);
  });

  it('a Menu open, then the fight summary opens: back closes the summary, the Menu stays', () => {
    shown.menu = true;
    flush();
    shown.defeat = LEDGER;
    flush();
    expect(open()).toEqual(['Menu', 'You were knocked out']);
    const h = hooks();
    back(h);
    expect(open()).toEqual(['Menu']);
    back(h);
    expect(open()).toEqual([]);
    expect(h.calls).toEqual([]);
  });

  it('a Menu open, then the report arrives: back closes the Menu, which is drawn above it', () => {
    shown.menu = true;
    flush();
    shown.offline = SUMMARY;
    flush();
    back(hooks());
    expect(open()).toEqual(['Welcome back!']);
  });

  it('two windows (a bench, then its book): back closes only the newer', () => {
    shown.menu = true;
    flush();
    shown.cook = true;
    flush();
    back(hooks());
    expect(open()).toEqual(['Menu']);
  });

  it('a window that holds play takes the press: nothing closes under it and the app stays', () => {
    shown.menu = true;
    flush();
    shown.hold = true;
    flush();
    const h = hooks();
    back(h);
    escape();
    expect(open()).toEqual(['Hold', 'Menu']);
    expect(h.calls).toEqual([]);
    shown.hold = false;
    flush();
    back(h);
    expect(open()).toEqual([]);
  });

  it('a tag picker’s open list closes, and the app stays', () => {
    shown.picker = true;
    flush();
    (document.querySelector('.picker button') as HTMLButtonElement).click();
    flush();
    expect(open()).toEqual(['Tag list']);
    const h = hooks();
    back(h);
    expect(open()).toEqual([]);
    expect(h.calls).toEqual([]);
  });

  it('the log drawer under a Menu: back closes the Menu, back the drawer, back minimizes', () => {
    shown.drawer = true;
    flush();
    shown.menu = true;
    flush();
    const h = hooks();
    back(h);
    expect(open()).toEqual(['Log drawer']);
    back(h);
    expect(open()).toEqual([]);
    expect(h.calls).toEqual([]);
    back(h);
    expect(h.calls).toEqual(['save', 'minimize']);
  });

  it('a touch tip card is over everything: back puts it away first', () => {
    shown.menu = true;
    flush();
    longPressTip();
    expect(open()).toEqual(['Menu', 'Tip card']);
    const h = hooks();
    back(h);
    expect(open()).toEqual(['Menu']);
    expect(h.calls).toEqual([]);
  });

  it('is ignored while the boot catch-up runs: nothing closes, nothing is saved, the app stays', () => {
    shown.menu = true;
    flush();
    const h = hooks(true);
    back(h);
    expect(open()).toEqual(['Menu']);
    shown.menu = false;
    flush();
    back(h);
    expect(h.calls).toEqual([]);
  });
});

describe('Escape on the desktop follows the same stack', () => {
  it('report and fight summary: one Escape closes only the summary', () => {
    shown.offline = SUMMARY;
    flush();
    shown.defeat = LEDGER;
    flush();
    escape();
    expect(open()).toEqual(['Welcome back!']);
  });

  it('a Menu open, then the fight summary: one Escape closes only the summary', () => {
    shown.menu = true;
    flush();
    shown.defeat = LEDGER;
    flush();
    escape();
    expect(open()).toEqual(['Menu']);
  });

  it('a Menu open, then the report arrives: one Escape closes only the Menu, even when the page updates between listeners', () => {
    shown.menu = true;
    flush();
    // What a real key press does: the microtask checkpoint after one listener
    // updates the page before the next listener runs.
    const checkpoint = () => flush();
    window.addEventListener('keydown', checkpoint);
    shown.offline = SUMMARY;
    flush();
    escape();
    window.removeEventListener('keydown', checkpoint);
    expect(open()).toEqual(['Welcome back!']);
  });

  it('nothing open: Escape does nothing', () => {
    escape();
    expect(open()).toEqual([]);
  });

  it('the log drawer closes on Escape only when no window is above it', () => {
    shown.drawer = true;
    flush();
    shown.menu = true;
    flush();
    escape();
    expect(open()).toEqual(['Log drawer']);
    escape();
    expect(open()).toEqual([]);
  });
});

describe('the welcome-back report', () => {
  it('prints the end-of-ladder notice an absence carried', () => {
    shown.offline = { ...SUMMARY, ladderEnd: 'Floor 21: not in this build.' };
    flush();
    expect(document.body.textContent).toContain('Floor 21: not in this build.');
  });

  it('prints none when the absence carried none', () => {
    shown.offline = SUMMARY;
    flush();
    expect(document.body.textContent).not.toContain('not in this build');
  });
});
