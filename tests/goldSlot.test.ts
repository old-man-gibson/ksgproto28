import { describe, expect, it } from 'vitest';
import { fmt } from '../src/ui/lib/format';
import { readText } from './themeCss';

// The dock's gold slot is a hidden sizer sharing a grid cell with the figure
// (ui/Dock.svelte): as wide as the sizer text in the theme's face, whatever the
// figure. The sizer must be as long as the longest figure `fmt` writes for gold in
// play, or the rate chip after the slot moves when the figure gains a character.

describe('the dock gold slot', () => {
  const dock = readText('src/ui/Dock.svelte');
  const sizer = /class="gold-sizer" aria-hidden="true">🪙 ([^<]+)</.exec(dock)?.[1] ?? '';

  it('has a sizer, hidden from a reader, as long as the longest figure below 1e15', () => {
    expect(sizer).not.toBe('');
    let longest = 0;
    for (let exp = 0; exp < 15; exp++) {
      for (const mantissa of [1, 1.5, 9.99, 10, 12.3, 99.9, 100, 123, 999]) {
        const n = mantissa * 10 ** exp;
        if (n < 1e15) longest = Math.max(longest, fmt(n).length);
      }
    }
    expect(longest).toBe(5);
    expect(sizer.length).toBeGreaterThanOrEqual(longest);
  });

  it('keeps the figures in a fixed-width face and does not set its own minimum width', () => {
    const rule = /\.gold \{([^}]*)\}/.exec(dock)?.[1] ?? '';
    expect(rule).toContain('tabular-nums');
    expect(rule).toContain('display: inline-grid');
    expect(rule).not.toMatch(/min-width/);
    expect(dock).toMatch(/\.gold-sizer \{\s*visibility: hidden;/);
  });
});
