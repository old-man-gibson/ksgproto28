import { beforeEach, describe, expect, it, vi } from 'vitest';

// The Android app's `pause` writes the save and its `resume` credits the time the
// app was away (ui/lib/androidBack.ts, ui/lib/pump.ts). The plugins are stubs: the
// listeners are what the app registers with the App plugin.

const listeners = new Map<string, () => void>();

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (name: string, fn: () => void) => {
      listeners.set(name, fn);
      return Promise.resolve({ remove: () => {} });
    },
    minimizeApp: () => Promise.resolve(),
  },
}));

const { installAndroidBack } = await import('../src/ui/lib/androidBack');

beforeEach(() => listeners.clear());

describe('the Android app lifecycle', () => {
  it('pause writes the save and resume runs the resume hook', () => {
    const save = vi.fn();
    const resume = vi.fn();
    installAndroidBack({ blocked: () => false, save, resume });
    listeners.get('pause')!();
    expect(save).toHaveBeenCalledTimes(1);
    expect(resume).not.toHaveBeenCalled();
    listeners.get('resume')!();
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('pause saves nothing while the boot catch-up has not run', () => {
    const save = vi.fn();
    installAndroidBack({ blocked: () => true, save, resume: () => {} });
    listeners.get('pause')!();
    expect(save).not.toHaveBeenCalled();
  });

  it('works with no resume hook', () => {
    installAndroidBack({ blocked: () => false, save: () => {} });
    expect(() => listeners.get('resume')!()).not.toThrow();
  });
});
