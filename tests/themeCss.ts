/**
 * CSS reading for tests/themes.test.ts: a small rule parser (comments stripped,
 * at-rules flattened), the token tables of app.css and src/themes/*.css, and
 * the colour resolver for token values. Not a general CSS parser: it handles
 * the plain CSS this repository writes (no preprocessor, no nesting).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { mix } from './themeColor';

export const ROOT = join(__dirname, '..');

export interface CssRule {
  /** The selector list, split on top-level commas and trimmed. */
  selectors: string[];
  /** Declarations in source order: [property, value]. */
  decls: [string, string][];
  /** The enclosing at-rule preludes, outermost first (`@media (...)`). */
  at: string[];
}

export function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function splitTop(text: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === sep && depth === 0) {
      out.push(text.slice(from, i));
      from = i + 1;
    }
  }
  out.push(text.slice(from));
  return out.map((s) => s.trim()).filter(Boolean);
}

function parseDecls(body: string): [string, string][] {
  const out: [string, string][] = [];
  for (const part of splitTop(body, ';')) {
    const at = part.indexOf(':');
    if (at < 0) continue;
    out.push([part.slice(0, at).trim().toLowerCase(), part.slice(at + 1).trim()]);
  }
  return out;
}

/** Rules of one stylesheet, at-rules flattened. `@keyframes` and `@font-face` bodies are skipped. */
export function parseCss(source: string): CssRule[] {
  const css = stripComments(source);
  const rules: CssRule[] = [];
  const walk = (text: string, at: string[]) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      const prelude = text.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        j++;
      }
      const body = text.slice(open + 1, j - 1);
      if (prelude.startsWith('@')) {
        if (/^@(media|supports|container|layer)\b/.test(prelude)) walk(body, [...at, prelude]);
      } else if (prelude) {
        rules.push({ selectors: splitTop(prelude, ','), decls: parseDecls(body), at });
      }
      i = j;
    }
  };
  walk(css, []);
  return rules;
}

/** The text of every `<style>` block of a Svelte file. */
export function styleBlocks(svelte: string): string[] {
  return [...svelte.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
}

// ---------- Token tables ----------

export type TokenTable = Record<string, string>;

/** Tokens declared by rules whose selector list is exactly `selector`, outside any at-rule. */
export function tokensOf(css: string, selector: string): TokenTable {
  const out: TokenTable = {};
  for (const rule of parseCss(css)) {
    if (rule.at.length > 0 || rule.selectors.length !== 1 || rule.selectors[0] !== selector) continue;
    for (const [prop, value] of rule.decls) if (prop.startsWith('--')) out[prop] = value;
  }
  return out;
}

export interface ThemeTables {
  /** app.css `:root`: every contract token, the fallback for a theme. */
  base: TokenTable;
  /** Per theme id: only what its own `:root[data-theme='id']` blocks declare. */
  own: Record<string, TokenTable>;
  /** Per theme id: the base with the theme's own tokens over it. */
  merged: Record<string, TokenTable>;
}

export function loadThemeTables(): ThemeTables {
  const base = tokensOf(readFileSync(join(ROOT, 'src/app.css'), 'utf8'), ':root');
  const own: Record<string, TokenTable> = {};
  const dir = join(ROOT, 'src/themes');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.css'))) {
    const css = readFileSync(join(dir, file), 'utf8');
    for (const rule of parseCss(css)) {
      if (rule.at.length > 0 || rule.selectors.length !== 1) continue;
      const m = rule.selectors[0].match(/^:root\[data-theme=['"]([\w-]+)['"]\]$/);
      if (!m) continue;
      own[m[1]] ??= {};
      for (const [prop, value] of rule.decls) if (prop.startsWith('--')) own[m[1]][prop] = value;
    }
  }
  const merged: Record<string, TokenTable> = { default: { ...base } };
  for (const [id, tokens] of Object.entries(own)) merged[id] = { ...base, ...tokens };
  return { base, own, merged };
}

// ---------- Resolving a token to a colour ----------

/**
 * A token's value as `#rrggbb`: hex, `rgb(r g b)`, `var(--x)` (with its
 * fallback), and `color-mix(in srgb, A p%, B)`. Throws on anything else, so a
 * token a theme writes in a new form is noticed rather than skipped.
 */
export function resolveColor(table: TokenTable, name: string, trail: string[] = []): string {
  if (trail.includes(name)) throw new Error(`token cycle: ${[...trail, name].join(' -> ')}`);
  const raw = table[name];
  if (raw === undefined) throw new Error(`token ${name} is not defined`);
  return resolveValue(table, raw, [...trail, name]);
}

function resolveValue(table: TokenTable, raw: string, trail: string[]): string {
  const value = raw.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return normaliseHex(value);
  const rgb = value.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*\)$/);
  if (rgb) return '#' + [rgb[1], rgb[2], rgb[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
  const ref = value.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/);
  if (ref) {
    if (table[ref[1]] !== undefined) return resolveColor(table, ref[1], trail);
    if (ref[2] !== undefined) return resolveValue(table, ref[2], trail);
    throw new Error(`token ${ref[1]} is not defined`);
  }
  const m = value.match(/^color-mix\(\s*in srgb\s*,\s*(.+?)\s+(\d+(?:\.\d+)?)%\s*,\s*(.+)\)$/);
  if (m) return mix(resolveValue(table, m[1], trail), resolveValue(table, m[3], trail), Number(m[2]) / 100);
  throw new Error(`cannot resolve ${trail[trail.length - 1] ?? ''}: ${value}`);
}

function normaliseHex(hex: string): string {
  let h = hex.slice(1);
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  return '#' + h.slice(0, 6).toLowerCase();
}

export function readText(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

/** Every `.svelte` file under src/, as repo-relative paths with forward slashes. */
export function svelteFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const ent of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${ent.name}`;
      if (ent.isDirectory()) walk(rel);
      else if (ent.name.endsWith('.svelte')) out.push(rel);
    }
  };
  walk('src');
  return out.sort();
}
