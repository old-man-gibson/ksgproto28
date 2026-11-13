import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import Harness from './fixtures/PickHarness.svelte';
import { shown } from './fixtures/overlayState.svelte';
import { pressBack } from '../src/ui/lib/androidBack';
import { overlayCount } from '../src/ui/lib/overlays';

// A picker or a pick mode inside a panel is on the overlay stack, so the Android
// back button and Escape put it away before they close the window around it
// (docs/ANDROID.md "Closing overlays"). These mount the real bench in a real
// Modal, and the chromosome panel's socket picker in the screen body, in jsdom.

const flush = () => flushSync();

// jsdom has no matchMedia; a Tip reads the pointer type on a click. A mouse.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  addEventListener() {},
  removeEventListener() {},
})) as unknown as typeof window.matchMedia;
// ... nor scrollIntoView; the chromosome panel scrolls its picker into view.
Element.prototype.scrollIntoView ??= () => {};

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

function hooks() {
  const calls: string[] = [];
  return { calls, blocked: () => false, save: () => void calls.push('save'), minimize: () => void calls.push('minimize') };
}
const back = (h: ReturnType<typeof hooks>) => {
  pressBack(h);
  flush();
};
const escape = () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  flush();
};

/** The windows on screen by heading. */
const windows = () =>
  [...document.querySelectorAll('[role=dialog]')].map((d) => (d.querySelector('h2, h3')?.textContent ?? '').replace(/[^\x20-\x7E]/g, '').trim());

/** A bench cell that opens a picker; the picker's own markup is `.picker`. */
const benchCell = () => document.querySelector('.window button.cell[aria-label]') as HTMLButtonElement;
const benchPicker = () => document.querySelector('.window .picker');
const socket = () => document.querySelector('[aria-label^="socket "]') as SVGGElement;
const socketPicker = () => document.querySelector('.chromo .picker');

let app: ReturnType<typeof mount>;
beforeEach(() => {
  Object.assign(shown, { menu: false, bench: false, page: false, offline: null });
  app = mount(Harness, { target: document.body });
  flush();
});
afterEach(() => {
  unmount(app);
  // Every overlay left the stack with its component.
  expect(overlayCount()).toBe(0);
});

describe('a bench picker inside its window', () => {
  function openPicker() {
    shown.bench = true;
    flush();
    benchCell().click();
    flush();
    expect(benchPicker()).not.toBeNull();
  }

  it('back closes the picker first and the window second, then the app minimizes', () => {
    openPicker();
    const h = hooks();
    back(h);
    expect(benchPicker()).toBeNull();
    expect(windows()).toEqual(['Bench']);
    back(h);
    expect(windows()).toEqual([]);
    expect(h.calls).toEqual([]);
    back(h);
    expect(h.calls).toEqual(['save', 'minimize']);
  });

  it('Escape follows the same order', () => {
    openPicker();
    escape();
    expect(benchPicker()).toBeNull();
    expect(windows()).toEqual(['Bench']);
    escape();
    expect(windows()).toEqual([]);
  });

  it('with no picker open, back closes the window at once', () => {
    shown.bench = true;
    flush();
    back(hooks());
    expect(windows()).toEqual([]);
  });

  it('a picker closed by its own button leaves the stack: the next back closes the window, not a ghost', () => {
    openPicker();
    (document.querySelector('.window .picker-head button:last-child') as HTMLButtonElement).click();
    flush();
    expect(benchPicker()).toBeNull();
    back(hooks());
    expect(windows()).toEqual([]);
  });

  it('a window opened after the picker (a second Modal) closes before the picker', () => {
    openPicker();
    shown.menu = true;
    flush();
    back(hooks());
    expect(windows()).toEqual(['Bench']);
    expect(benchPicker()).not.toBeNull();
    back(hooks());
    expect(benchPicker()).toBeNull();
    expect(windows()).toEqual(['Bench']);
  });

  it('moving the picker to another slot does not move it above a window opened since', () => {
    openPicker();
    const second = [...document.querySelectorAll<HTMLButtonElement>('.window button.cell[aria-label]')].filter(
      (b) => !b.closest('.picker'),
    )[1];
    second.click();
    flush();
    expect(benchPicker()).not.toBeNull();
    shown.menu = true;
    flush();
    back(hooks());
    expect(windows()).toEqual(['Bench']);
  });
});

describe('a tag picker inside a window', () => {
  it('its open list closes first, the window second (the divine shelf in the spellcrafting table)', () => {
    shown.menu = true;
    flush();
    (document.querySelector('.window .picker button') as HTMLButtonElement).click();
    flush();
    expect(document.querySelector('.window .picker .menu')).not.toBeNull();
    back(hooks());
    expect(document.querySelector('.window .picker .menu')).toBeNull();
    expect(windows()).toEqual(['Menu']);
    back(hooks());
    expect(windows()).toEqual([]);
  });
});

describe('a picker in the screen body', () => {
  function openSocket() {
    shown.page = true;
    flush();
    expect(socketPicker()).toBeNull();
    socket().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    flush();
    expect(socketPicker()).not.toBeNull();
  }

  it('back puts the picker away and the app stays', () => {
    openSocket();
    const h = hooks();
    back(h);
    expect(socketPicker()).toBeNull();
    expect(h.calls).toEqual([]);
    back(h);
    expect(h.calls).toEqual(['save', 'minimize']);
  });

  it('a window above it closes first, then the picker', () => {
    openSocket();
    shown.menu = true;
    flush();
    const h = hooks();
    back(h);
    expect(windows()).toEqual([]);
    expect(socketPicker()).not.toBeNull();
    back(h);
    expect(socketPicker()).toBeNull();
    expect(h.calls).toEqual([]);
  });

  it('the welcome-back report arriving over it closes first: the report covers the screen, so it is on top', () => {
    openSocket();
    shown.offline = SUMMARY;
    flush();
    back(hooks());
    expect(windows()).toEqual([]);
    expect(socketPicker()).not.toBeNull();
  });

  it('Escape closes it', () => {
    openSocket();
    escape();
    expect(socketPicker()).toBeNull();
  });
});
