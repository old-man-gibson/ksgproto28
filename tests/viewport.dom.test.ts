import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The shell flags `viewport.phone` and `viewport.short` come from three media
// queries (ui/lib/viewport.svelte.ts). jsdom has none, so these install a fake
// matchMedia whose lists a test flips by hand, then import the module afresh.

interface FakeList {
  matches: boolean;
  media: string;
  listeners: Set<() => void>;
}

let lists: FakeList[] = [];
let width = 1024;

function install() {
  lists = [];
  window.matchMedia = ((query: string): MediaQueryList => {
    const list: FakeList = { matches: false, media: query, listeners: new Set() };
    lists.push(list);
    return {
      get matches() {
        return list.matches;
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => list.listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => list.listeners.delete(fn),
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

/** Flip the query whose text contains `part`, and tell its listeners. */
function flip(part: string, matches: boolean) {
  const list = lists.find((l) => l.media.includes(part))!;
  list.matches = matches;
  for (const fn of list.listeners) fn();
}

async function load() {
  vi.resetModules();
  return await import('../src/ui/lib/viewport.svelte');
}

beforeEach(() => {
  install();
  width = 1024;
  Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => width });
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('the short rule', () => {
  it('asks for a minimum width as well as a maximum, so a narrow short window keeps the portrait dock', async () => {
    const { viewport, SHORT_MIN_WIDTH, SHORT_MAX_WIDTH } = await load();
    const short = lists.find((l) => l.media.includes('max-height'))!;
    expect(short.media).toContain(`(min-width: ${SHORT_MIN_WIDTH}px)`);
    expect(short.media).toContain(`(max-width: ${SHORT_MAX_WIDTH - 1}px)`);
    // A 410 x 420 split screen is narrow and short: the query does not match it, the narrow one does.
    flip('max-width: 699px', true);
    expect(viewport.phone).toBe(true);
    expect(viewport.short).toBe(false);
  });

  it('a phone held sideways matches both: the phone shell in its compact form', async () => {
    const { viewport } = await load();
    flip('max-height', true);
    expect(viewport.short).toBe(true);
    expect(viewport.phone).toBe(true);
  });
});

describe('the soft keyboard', () => {
  function focusField(type = 'text') {
    const input = document.createElement('input');
    input.type = type;
    document.body.appendChild(input);
    input.focus();
    return input;
  }
  /** The field loses focus (the keyboard has not closed yet). */
  function blurField(input: HTMLInputElement) {
    input.blur();
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  }
  const resize = () => window.dispatchEvent(new Event('resize'));

  it('does not turn the shell compact while a text field has focus and the width is the same', async () => {
    const { viewport } = await load();
    focusField();
    flip('max-height', true); // the window lost the keyboard's height
    expect(viewport.short).toBe(false);
    expect(viewport.phone).toBe(false);
  });

  it('does not flip at blur: the field loses focus before the keyboard has gone, and the window is still its size', async () => {
    vi.useFakeTimers();
    try {
      const { viewport } = await load();
      const input = focusField();
      flip('max-height', true); // keyboard up
      blurField(input);
      vi.advanceTimersByTime(0);
      expect(viewport.short).toBe(false);
      vi.advanceTimersByTime(250);
      expect(viewport.short).toBe(false);
      // The keyboard closes: the window grows back and a resize says so.
      flip('max-height', false);
      resize();
      expect(viewport.short).toBe(false);
      // Nothing left to fire later and flip it.
      vi.advanceTimersByTime(1000);
      expect(viewport.short).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('settles on the real shape after the hold when no resize comes (the window really is short)', async () => {
    vi.useFakeTimers();
    try {
      const { viewport, KEYBOARD_HOLD_MS } = await load();
      const input = focusField();
      flip('max-height', true);
      expect(viewport.short).toBe(false);
      blurField(input);
      vi.advanceTimersByTime(KEYBOARD_HOLD_MS - 1);
      expect(viewport.short).toBe(false);
      vi.advanceTimersByTime(1);
      expect(viewport.short).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a resize after the blur ends the hold: the shell follows the real window at once', async () => {
    vi.useFakeTimers();
    try {
      const { viewport } = await load();
      const input = focusField();
      flip('max-height', true);
      blurField(input);
      resize(); // the window is resized and is short: no keyboard to excuse it
      expect(viewport.short).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a rotation that crosses no breakpoint still counts: the keyboard that follows does not flip the shell', async () => {
    const { viewport } = await load();
    // 1024 -> 900 wide: no query changes, only a resize event.
    width = 900;
    resize();
    focusField();
    flip('max-height', true); // the keyboard opens at the new width
    expect(viewport.short).toBe(false);
    expect(viewport.phone).toBe(false);
  });

  it('a width change is a rotation, not the keyboard: the shell follows it while a field has focus', async () => {
    const { viewport } = await load();
    focusField();
    width = 844;
    flip('max-height', true);
    expect(viewport.short).toBe(true);
  });

  it('the rotation comes first, then the keyboard: each is read for what it is', async () => {
    const { viewport } = await load();
    focusField();
    width = 844; // landscape: short by the query once it is
    flip('max-height', true);
    expect(viewport.short).toBe(true);
    // The keyboard changes the height only: the shell stays.
    flip('max-height', false);
    expect(viewport.short).toBe(true);
  });

  it('a checkbox focus is not typing', async () => {
    const { viewport } = await load();
    focusField('checkbox');
    flip('max-height', true);
    expect(viewport.short).toBe(true);
  });
});
