import { describe, expect, it } from 'vitest';
import { clockOf, TICKS_PER_DAY } from '../src/core/systems/clock';
import { describeTimeSense } from '../src/core/systems/chronosense';
import { shortClock } from '../src/ui/lib/shell';
import { readText } from './themeCss';

// The phone dock's sky line keeps a slot for its clock chip as wide as the widest
// text the sense can write, so a daypart name or an hour turning moves nothing
// after it (ui/SkyStrip.svelte). The header's chip is the same slot, 7.1em.

describe('the sky line clock slot', () => {
  const texts = new Set<string>();
  for (let level = 1; level <= 30; level++) {
    for (let day = 0; day < 8; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const ticks = day * TICKS_PER_DAY + (hour * TICKS_PER_DAY) / 24;
        const text = describeTimeSense(clockOf(ticks), level);
        if (text) texts.add(shortClock(text));
      }
    }
  }
  const widest = 'about 23:00'.length;

  it('no text the dock shows is longer than the hour text the slot is sized for', () => {
    expect(texts.size).toBeGreaterThan(10);
    const over = [...texts].filter((t) => t.length > widest);
    expect(over).toEqual([]);
    // The sizer text itself is among them: the slot is not sized for a text that never occurs.
    expect(texts.has('about 23:00')).toBe(true);
  });

  it('the chip reserves 7.1em, as the header chip does', () => {
    const css = readText('src/ui/SkyStrip.svelte');
    expect(css).toMatch(/\.sky-clock \{[^}]*display: inline-block;[^}]*min-width: 7\.1em;/);
    expect(readText('src/ui/App.svelte')).toContain('min-width: 7.1em');
  });
});
