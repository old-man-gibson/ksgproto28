import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import MartialPlanner from '../src/ui/panels/MartialPlanner.svelte';
import { ui } from '../src/ui/state.svelte';
import { pressBack } from '../src/ui/lib/androidBack';
import { overlayCount } from '../src/ui/lib/overlays';

// The planner's roster and a picked row are on the overlay stack only while the
// planner is unfolded (`ui.plannerOpen`). Folded, they are on nobody's screen: an
// entry left behind took the Android back button and closed nothing visible.

window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  addEventListener() {},
  removeEventListener() {},
})) as unknown as typeof window.matchMedia;
Element.prototype.scrollIntoView ??= () => {};

const flush = () => flushSync();
const hooks = () => {
  const calls: string[] = [];
  return { calls, blocked: () => false, save: () => void calls.push('save'), minimize: () => void calls.push('minimize') };
};

let app: ReturnType<typeof mount>;
beforeEach(() => {
  ui.plannerOpen = true;
  app = mount(MartialPlanner, { target: document.body });
  flush();
});
afterEach(() => {
  unmount(app);
  ui.plannerOpen = false;
  expect(overlayCount()).toBe(0);
});

const openRoster = () => {
  (document.querySelector('button.fam-more') as HTMLButtonElement).click();
  flush();
};

describe('the planner roster on the overlay stack', () => {
  it('is on the stack while the planner is open, and back closes it', () => {
    openRoster();
    expect(document.querySelector('.drop')).not.toBeNull();
    expect(overlayCount()).toBe(1);
    const h = hooks();
    pressBack(h);
    flush();
    expect(document.querySelector('.drop')).toBeNull();
    expect(h.calls).toEqual([]);
  });

  it('leaves the stack when the planner folds, so back is not spent on something nobody sees', () => {
    openRoster();
    expect(overlayCount()).toBe(1);
    ui.plannerOpen = false;
    flush();
    expect(overlayCount()).toBe(0);
    const h = hooks();
    pressBack(h);
    expect(h.calls).toEqual(['save', 'minimize']);
  });

  it('is back on the stack, still open, when the planner unfolds again', () => {
    openRoster();
    ui.plannerOpen = false;
    flush();
    ui.plannerOpen = true;
    flush();
    expect(document.querySelector('.drop')).not.toBeNull();
    expect(overlayCount()).toBe(1);
  });
});
