import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import Harness from './fixtures/DockMenuHarness.svelte';
import { shown } from './fixtures/overlayState.svelte';
import { pressBack } from '../src/ui/lib/androidBack';
import { overlayCount } from '../src/ui/lib/overlays';

// The phone's dock is a stacking context (z-index 6), so a window drawn inside it
// is under the welcome-back report (z 10) whatever its own z-index, while the
// overlay stack counts the Menu (window layer) above the report. The Menu's window
// is moved to <body> (lib/portal.ts) so what is on top of the screen is what is
// on top of the stack.

window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  addEventListener() {},
  removeEventListener() {},
})) as unknown as typeof window.matchMedia;

const flush = () => flushSync();
const SUMMARY = { ticks: 1, ms: 1, capped: false, kills: 0, goldGained: 0, itemsGained: 0, attrLevels: [], skillLevels: [] };

let app: ReturnType<typeof mount>;
beforeEach(() => {
  shown.offline = null;
  app = mount(Harness, { target: document.body });
  flush();
});
afterEach(() => {
  unmount(app);
  expect(overlayCount()).toBe(0);
  expect(document.querySelector('.overlay')).toBeNull();
});

const open = () => {
  (document.querySelector('.sysmenu-open') as HTMLButtonElement).click();
  flush();
};

describe('the Menu window', () => {
  it('is drawn on <body>, outside the dock’s stacking context', () => {
    open();
    const overlay = document.querySelector('.overlay')!;
    expect(overlay).not.toBeNull();
    expect(overlay.closest('header.dock')).toBeNull();
    expect(overlay.closest('.sysmenu-portal')?.parentElement).toBe(document.body);
  });

  it('closes with its button, and its entry leaves the stack and the page', () => {
    open();
    (document.querySelector('.window .close') as HTMLButtonElement).click();
    flush();
    expect(document.querySelector('.overlay')).toBeNull();
    expect(document.querySelector('.sysmenu-portal')).toBeNull();
    expect(overlayCount()).toBe(0);
  });

  it('with the report opened over it, the report is later in the page and the Menu is first to close: both are on body, in the order the stack counts them', () => {
    open();
    shown.offline = SUMMARY;
    flush();
    const overlays = [...document.body.querySelectorAll('.overlay')];
    expect(overlays).toHaveLength(2);
    // Both are direct on body (through the wrapper), not one inside the dock.
    for (const o of overlays) expect(o.closest('header.dock')).toBeNull();
    // Back closes the Menu (window layer, above the report), as the screen shows: its z-index is 20.
    pressBack({ blocked: () => false, save() {}, minimize() {} });
    flush();
    expect(document.querySelector('.sysmenu-portal')).toBeNull();
    expect(document.querySelectorAll('.overlay')).toHaveLength(1);
  });
});
