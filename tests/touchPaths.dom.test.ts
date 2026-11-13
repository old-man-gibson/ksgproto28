import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import Harness from './fixtures/TouchHarness.svelte';
import { viewport } from '../src/ui/lib/viewport.svelte';
import { overlayCount } from '../src/ui/lib/overlays';

// Touch paths for text that a mouse reads from a hover: a window's description
// folds to one line on the phone and a tap opens it (lib/FoldedDesc.svelte), and
// a control that keeps its `title` for a mouse gets a long-press card for a
// finger (lib/Tip.svelte `touchOnly`, used by lib/GoButton.svelte).

const flush = () => flushSync();

// jsdom has no matchMedia; a Tip reads the pointer type on a click. A touch screen.
window.matchMedia ??= ((query: string) => ({
  matches: query.includes('hover: none'),
  media: query,
  addEventListener() {},
  removeEventListener() {},
})) as unknown as typeof window.matchMedia;

let app: ReturnType<typeof mount>;
beforeEach(() => {
  viewport.phone = false;
  viewport.short = false;
  app = mount(Harness, { target: document.body });
  flush();
});
afterEach(() => {
  unmount(app);
  viewport.phone = false;
  viewport.short = false;
  expect(overlayCount()).toBe(0);
});

const fold = () => document.querySelector('button.fold') as HTMLButtonElement | null;

describe('the folded description', () => {
  it('is the whole text, plain, on a wide window', () => {
    expect(fold()).toBeNull();
    expect(document.querySelector('.plain')?.textContent).toContain('A long description');
  });

  it('is one folded line on the phone, and a tap opens it and a second folds it', () => {
    viewport.phone = true;
    flush();
    expect(fold()?.getAttribute('aria-expanded')).toBe('false');
    fold()!.click();
    flush();
    expect(fold()?.getAttribute('aria-expanded')).toBe('true');
    expect(fold()?.classList.contains('open')).toBe(true);
    fold()!.click();
    flush();
    expect(fold()?.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps the same text folded and open, so a tap changes the line and not the words', () => {
    viewport.phone = true;
    flush();
    const folded = fold()!.querySelector('.line')!.textContent;
    fold()!.click();
    flush();
    expect(fold()!.querySelector('.line')!.textContent).toBe(folded);
  });

  it('sits beside the title when the phone is held sideways', () => {
    viewport.phone = true;
    viewport.short = true;
    flush();
    expect(fold()?.classList.contains('short')).toBe(true);
  });
});

describe('a touch-only tap card', () => {
  const pointer = (el: Element, type: string, pointerType: string) => {
    const ev = new Event(type, { bubbles: true });
    Object.defineProperty(ev, 'pointerType', { value: pointerType });
    el.dispatchEvent(ev);
  };

  it('a mouse hovering the control opens nothing: it has its title', () => {
    const target = document.querySelector('.tip-target.touch-only')!;
    pointer(target, 'pointerenter', 'mouse');
    flush();
    expect(document.querySelector('.tip-pop')).toBeNull();
    expect(document.getElementById('go')?.getAttribute('title')).toBe('the route');
  });

  it('a long press opens the card without pressing the control, and the click after it is the card’s', () => {
    vi.useFakeTimers();
    const press = vi.fn();
    document.getElementById('go')!.addEventListener('click', press);
    const target = document.querySelector('.tip-target.touch-only')!;
    pointer(target, 'pointerdown', 'touch');
    vi.advanceTimersByTime(500);
    vi.useRealTimers();
    flush();
    expect(document.querySelector('.tip-pop')?.textContent).toBe('the route');
    pointer(target, 'pointerup', 'touch');
    document.getElementById('go')!.click();
    expect(press).not.toHaveBeenCalled();
    expect(overlayCount()).toBe(1);
  });
});
