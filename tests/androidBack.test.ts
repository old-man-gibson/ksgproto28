import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { installAndroidBack, pressBack } from '../src/ui/lib/androidBack';
import { closeTopOverlay, LAYER, overlayCount, pushOverlay, windowOpen } from '../src/ui/lib/overlays';

// The Android back button (ui/lib/androidBack.ts) closes the topmost overlay,
// and with none open saves, then minimizes. The overlays themselves, mounted
// for real, are in overlays.dom.test.ts; this holds the stack's rules and the
// plugin wiring with stubs. The vitest environment is plain node.

// The plugins are proxies over the native bridge: stubs keep the test off it.
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(), minimizeApp: vi.fn() } }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn(() => false) } }));

function hooks(blocked = false) {
  const calls: string[] = [];
  return {
    calls,
    blocked: () => blocked,
    save: () => void calls.push('save'),
    minimize: () => void calls.push('minimize'),
  };
}

beforeEach(() => vi.clearAllMocks());

describe('the overlay stack', () => {
  it('closes the most recent of two on one layer', () => {
    const closed: string[] = [];
    const a = pushOverlay(LAYER.window, () => void closed.push('a'));
    const b = pushOverlay(LAYER.window, () => void closed.push('b'));
    expect(closeTopOverlay()).toBe(true);
    expect(closed).toEqual(['b']);
    a();
    b();
  });

  it('puts a higher layer above a later arrival', () => {
    const closed: string[] = [];
    const window = pushOverlay(LAYER.window, () => void closed.push('window'));
    const report = pushOverlay(LAYER.report, () => void closed.push('report'));
    const drawer = pushOverlay(LAYER.drawer, () => void closed.push('drawer'));
    closeTopOverlay();
    expect(closed).toEqual(['window']);
    for (const leave of [window, report, drawer]) leave();
  });

  it('spends the press on a hold-play window without closing anything under it', () => {
    const closed: string[] = [];
    const window = pushOverlay(LAYER.window, () => void closed.push('window'));
    const hold = pushOverlay(LAYER.hold, null);
    expect(closeTopOverlay()).toBe(true);
    expect(closed).toEqual([]);
    hold();
    expect(closeTopOverlay()).toBe(true);
    expect(closed).toEqual(['window']);
    window();
  });

  it('reports nothing to close when the stack is empty, and leaving twice is harmless', () => {
    expect(closeTopOverlay()).toBe(false);
    const leave = pushOverlay(LAYER.window, () => {});
    leave();
    leave();
    expect(overlayCount()).toBe(0);
    expect(closeTopOverlay()).toBe(false);
  });

  it('windowOpen is true for the report, windows and hold windows, not for a drawer or a tip card', () => {
    const drawer = pushOverlay(LAYER.drawer, () => {});
    const tip = pushOverlay(LAYER.tip, () => {});
    expect(windowOpen()).toBe(false);
    const report = pushOverlay(LAYER.report, () => {});
    expect(windowOpen()).toBe(true);
    for (const leave of [drawer, tip, report]) leave();
  });
});

describe('pressBack', () => {
  it('closes the topmost overlay and does nothing else', () => {
    const h = hooks();
    const closed: string[] = [];
    const leave = pushOverlay(LAYER.window, () => void closed.push('window'));
    pressBack(h);
    expect(closed).toEqual(['window']);
    expect(h.calls).toEqual([]);
    leave();
  });

  it('with nothing open, saves and then minimizes', () => {
    const h = hooks();
    pressBack(h);
    expect(h.calls).toEqual(['save', 'minimize']);
  });

  it('does nothing while blocked, with or without an overlay open', () => {
    const h = hooks(true);
    const closed: string[] = [];
    const leave = pushOverlay(LAYER.window, () => void closed.push('window'));
    pressBack(h);
    leave();
    pressBack(h);
    expect(closed).toEqual([]);
    expect(h.calls).toEqual([]);
  });
});

describe('installAndroidBack', () => {
  const listeners = () => vi.mocked(App.addListener).mock.calls;
  const handler = (event: string) => listeners().find(([name]) => name === event)![1] as () => void;

  it('installs nothing outside the Android app', () => {
    installAndroidBack({ blocked: () => false, save: () => {} });
    expect(App.addListener).not.toHaveBeenCalled();
  });

  it('on Android: back closes an overlay, else saves and minimizes the app', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const save = vi.fn();
    installAndroidBack({ blocked: () => false, save });
    const closed: string[] = [];
    const leave = pushOverlay(LAYER.window, () => void closed.push('window'));
    handler('backButton')();
    expect(closed).toEqual(['window']);
    expect(save).not.toHaveBeenCalled();
    expect(App.minimizeApp).not.toHaveBeenCalled();
    leave();
    handler('backButton')();
    expect(save).toHaveBeenCalledTimes(1);
    expect(App.minimizeApp).toHaveBeenCalledTimes(1);
  });

  it('on Android: pause saves, except while the boot catch-up runs', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const save = vi.fn();
    let blocked = true;
    installAndroidBack({ blocked: () => blocked, save });
    handler('pause')();
    expect(save).not.toHaveBeenCalled();
    blocked = false;
    handler('pause')();
    expect(save).toHaveBeenCalledTimes(1);
  });
});
