/**
 * The code behind the shared cues (docs/THEMES.md §3): `ink()`, the log glyph
 * gutter and the talent-lap palette. The stylesheet side is tests/themes.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { INK_LIGHTNESS, ink } from '../src/ui/lib/ink';
import { logColor, logGlyph } from '../src/ui/lib/logKinds';
import { talentBar, TALENT_LAP_COLORS } from '../src/ui/lib/talentBar';
import { remapInk, hexToRgb } from './themeColor';

describe('ink()', () => {
  it('returns the raw colour where the browser has no relative colour syntax (node here)', () => {
    expect(ink('#4caf7d')).toBe('#4caf7d');
  });

  it('passes theme tokens and other values through untouched', () => {
    expect(ink('var(--text-dim)')).toBe('var(--text-dim)');
    expect(ink('color-mix(in srgb, red 50%, blue)')).toBe('color-mix(in srgb, red 50%, blue)');
    expect(ink(undefined)).toBe('');
  });

  it('remaps OKLCH lightness between --ink-lmin and --ink-lmax and keeps chroma and hue', () => {
    expect(INK_LIGHTNESS).toBe('calc(var(--ink-lmin) + l * (var(--ink-lmax) - var(--ink-lmin)))');
  });

  it('the test-side remap is the identity at 0 and 1, and lifts a dark colour for a floor', () => {
    for (const c of ['#3a3a3a', '#4caf7d', '#e8b84b', '#ab6fd6']) {
      const same = remapInk(c, 0, 1);
      const [a, b] = [hexToRgb(c), hexToRgb(same)];
      for (let i = 0; i < 3; i++) expect(Math.abs(a[i] - b[i])).toBeLessThanOrEqual(1);
    }
    const lifted = hexToRgb(remapInk('#3a3a3a', 0.42, 1));
    expect(lifted[0]).toBeGreaterThan(0x3a + 40);
  });
});

describe('log kinds', () => {
  const KINDS = ['combat', 'danger', 'loot', 'item', 'skill', 'achievement', 'fusion', 'quest', 'travel', 'explore', 'action', 'info'];

  it('every kind has a one-character glyph and a colour token', () => {
    for (const kind of KINDS) {
      expect([...logGlyph(kind)], kind).toHaveLength(1);
      expect(logColor(kind), kind).toMatch(/^var\(--log-[a-z]+\)$/);
    }
  });

  it('kinds that read differently have different glyphs', () => {
    const distinct = ['danger', 'combat', 'loot', 'skill', 'achievement', 'fusion', 'quest', 'travel', 'explore', 'info'];
    expect(new Set(distinct.map(logGlyph)).size).toBe(distinct.length);
  });

  it('an unknown kind gets the plain dot and the text colour', () => {
    expect(logGlyph('no-such-kind')).toBe('·');
    expect(logColor('no-such-kind')).toBe('var(--text)');
  });
});

describe('talent bar', () => {
  it('wears the next colour each hundred percent and wraps past the last', () => {
    expect(talentBar(0.5)).toEqual({ width: 50, color: TALENT_LAP_COLORS[0] });
    expect(talentBar(1.5).color).toBe(TALENT_LAP_COLORS[1]);
    expect(talentBar(TALENT_LAP_COLORS.length + 0.5).color).toBe(TALENT_LAP_COLORS[0]);
  });
});
