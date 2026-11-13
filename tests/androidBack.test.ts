import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@capacitor/app';
import { installAndroidBack, pressBack } from '../src/ui/lib/androidBack';

// The Android back button (ui/lib/androidBack.ts) sends the Escape every
// window, drawer and picker already closes on, and minimizes the app only when
// nothing was open. The vitest environment is plain node, so the page is a
// stub: what is checked is what the module asks of it and in what order.

/** A stand-in for KeyboardEvent, which node does not have. */
class FakeKeyEvent extends Event {
  key: string;
  code: string;
  constructor(type: string, init: { key?: string; code?: string } & EventInit = {}) {
    super(type, init);
    this.key = init.key ?? '';
    this.code = init.code ?? '';
  }
}

function page(overlayOpen: boolean) {
  const calls: string[] = [];
  let selector = '';
  const doc = {
    querySelector: (sel: string) => {
      selector = sel;
      calls.push('look');
      return overlayOpen ? {} : null;
    },
  } as unknown as Document;
  const sent: FakeKeyEvent[] = [];
  const win = {
    dispatchEvent: (ev: FakeKeyEvent) => {
      sent.push(ev);
      calls.push('escape');
      return true;
    },
  } as unknown as Window;
  const minimize = vi.fn(() => void calls.push('minimize'));
  return { doc, win, sent, calls, minimize, selector: () => selector };
}

// The plugin is a proxy over the native bridge: a stub keeps the test off it.
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(), minimizeApp: vi.fn() } }));

afterEach(() => vi.unstubAllGlobals());

describe('the Android back button', () => {
  it('sends Escape to the window, so every overlay closes by its own Escape handler', () => {
    vi.stubGlobal('KeyboardEvent', FakeKeyEvent);
    const p = page(true);
    pressBack(p.doc, p.win, p.minimize);
    expect(p.sent).toHaveLength(1);
    expect(p.sent[0].type).toBe('keydown');
    expect(p.sent[0].key).toBe('Escape');
    expect(p.sent[0].bubbles).toBe(true);
  });

  it('with an overlay open it closes it and does not minimize', () => {
    vi.stubGlobal('KeyboardEvent', FakeKeyEvent);
    const p = page(true);
    pressBack(p.doc, p.win, p.minimize);
    expect(p.minimize).not.toHaveBeenCalled();
  });

  it('with nothing open it minimizes, never exits', () => {
    vi.stubGlobal('KeyboardEvent', FakeKeyEvent);
    const p = page(false);
    pressBack(p.doc, p.win, p.minimize);
    expect(p.minimize).toHaveBeenCalledTimes(1);
  });

  it('looks for an open overlay before it sends Escape, since Escape closes it', () => {
    vi.stubGlobal('KeyboardEvent', FakeKeyEvent);
    const p = page(false);
    pressBack(p.doc, p.win, p.minimize);
    expect(p.calls).toEqual(['look', 'escape', 'minimize']);
  });

  it('counts windows, the log drawer and a tag picker as open', () => {
    vi.stubGlobal('KeyboardEvent', FakeKeyEvent);
    const p = page(false);
    pressBack(p.doc, p.win, p.minimize);
    expect(p.selector()).toContain('[role="dialog"]');
    expect(p.selector()).toContain('.log-drawer');
    expect(p.selector()).toContain('.picker [aria-expanded="true"]');
  });

  it('installs nothing outside the Android app', () => {
    installAndroidBack();
    expect(App.addListener).not.toHaveBeenCalled();
  });
});
