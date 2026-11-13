import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// A control that keeps its `title` for a mouse and sits in a `<Tip>` gets two
// tooltips on a desktop: the native one and the hover card. Its card is for a
// finger, so the Tip is `touchOnly` (ui/lib/Tip.svelte, docs/PHONE.md section 3).
// A `block` Tip wraps non-control content and has its own rules; a `title` on a
// span inside a Tip is a different case from a control's.

const UI = path.resolve(__dirname, '../src/ui');

function svelteFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'assets' ? [] : svelteFiles(full);
    return e.name.endsWith('.svelte') ? [full] : [];
  });
}

describe('a Tip around a titled control', () => {
  it('is touch-only', () => {
    const offenders: string[] = [];
    for (const file of svelteFiles(UI)) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/<Tip\b([^>]*)>/g)) {
        if (/\b(touchOnly|block)\b/.test(m[1])) continue;
        const end = src.indexOf('{#snippet tip', m.index);
        if (end < 0) continue;
        const children = src.slice(m.index, end);
        if (/<(button|a|select|input)\b(?:[^<>]|=>)*?\btitle=/.test(children)) {
          const line = src.slice(0, m.index).split('\n').length;
          offenders.push(`${path.relative(UI, file)}:${line}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
