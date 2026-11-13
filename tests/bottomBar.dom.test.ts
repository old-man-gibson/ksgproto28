import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import BottomBar from '../src/ui/BottomBar.svelte';
import { gs, ui } from '../src/ui/state.svelte';
import { visibleNav } from '../src/ui/lib/nav';
import { centeredScrollLeft } from '../src/ui/lib/rowScroll';

// The bottom row keeps the open screen in view by scrolling itself. It used to
// call scrollIntoView on the entry, which scrolls every ancestor too: with the
// page's scroll-padding-bottom (the bar's own height) the page moved about 100 px
// at boot and on every tab change (ui/lib/rowScroll.ts).

describe('centeredScrollLeft', () => {
  const row = { clientWidth: 300, scrollWidth: 900 };

  it('centres the entry in the row', () => {
    expect(centeredScrollLeft(row, 400, 100)).toBe(300);
  });

  it('stays at 0 for an entry near the start and at the end for one near the end', () => {
    expect(centeredScrollLeft(row, 10, 80)).toBe(0);
    expect(centeredScrollLeft(row, 800, 100)).toBe(600);
  });

  it('does not scroll a row that fits', () => {
    expect(centeredScrollLeft({ clientWidth: 300, scrollWidth: 300 }, 200, 80)).toBe(0);
  });
});

describe('the bottom bar', () => {
  let app: ReturnType<typeof mount>;
  const intoView = vi.fn();
  const rowScroll = vi.fn();

  beforeEach(() => {
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    Element.prototype.scrollIntoView = intoView;
    Element.prototype.scrollTo = rowScroll as unknown as typeof Element.prototype.scrollTo;
    intoView.mockClear();
    rowScroll.mockClear();
    ui.tab = 'location';
    app = mount(BottomBar, {
      target: document.body,
      props: { entries: visibleNav(gs, null), showNav: true, logOpen: false, ontogglelog: () => {} },
    });
    flushSync();
  });

  afterEach(() => unmount(app));

  it('scrolls its own row to the open screen at boot and on a tab change, and never calls scrollIntoView', () => {
    const row = document.querySelector('nav.tabs-row') as HTMLElement;
    expect(rowScroll).toHaveBeenCalled();
    expect(rowScroll.mock.contexts.every((c) => c === row)).toBe(true);
    rowScroll.mockClear();
    ui.tab = 'combat';
    flushSync();
    expect(rowScroll).toHaveBeenCalledTimes(1);
    expect(rowScroll.mock.contexts[0]).toBe(row);
    expect(intoView).not.toHaveBeenCalled();
  });
});
