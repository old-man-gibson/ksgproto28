import { describe, expect, it, vi } from 'vitest';
import { installSaveTriggers } from '../src/ui/lib/saveTriggers';

// The save is written when the page may be about to go: unload, pagehide, and
// the page going hidden. Not before the boot catch-up has run
// (ui/lib/saveTriggers.ts). main.ts wires these to `save()` and `ui.catchingUp`.

function hide(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('the save triggers', () => {
  it('write the save on unload, pagehide and going hidden, and restart the autosave clock each time', () => {
    const save = vi.fn();
    const saved = vi.fn();
    installSaveTriggers({ save, blocked: () => false, saved });
    window.dispatchEvent(new Event('beforeunload'));
    window.dispatchEvent(new Event('pagehide'));
    hide('hidden');
    expect(save).toHaveBeenCalledTimes(3);
    expect(saved).toHaveBeenCalledTimes(3);
  });

  it('do not write when the page comes back to visible', () => {
    const save = vi.fn();
    installSaveTriggers({ save, blocked: () => false, saved: () => {} });
    hide('visible');
    expect(save).not.toHaveBeenCalled();
  });

  it('write nothing while blocked (the boot catch-up has not run), and write again once it has', () => {
    const save = vi.fn();
    let blocked = true;
    const saveNow = installSaveTriggers({ save, blocked: () => blocked, saved: () => {} });
    window.dispatchEvent(new Event('pagehide'));
    hide('hidden');
    saveNow();
    expect(save).not.toHaveBeenCalled();
    blocked = false;
    saveNow();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('return the writer the Android back button and pause event call', () => {
    const save = vi.fn();
    const saveNow = installSaveTriggers({ save, blocked: () => false, saved: () => {} });
    saveNow();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('runs the visible hook when the page turns visible, and not when it hides', () => {
    const visible = vi.fn();
    installSaveTriggers({ save: () => {}, blocked: () => false, saved: () => {}, visible });
    hide('hidden');
    expect(visible).not.toHaveBeenCalled();
    hide('visible');
    expect(visible).toHaveBeenCalledTimes(1);
  });
});
