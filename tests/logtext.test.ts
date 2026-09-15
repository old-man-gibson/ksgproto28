/**
 * The runtime templates in `src/core/text/log.text.ts` and the call sites
 * that fill them must agree: every template is fired by some `text()` call,
 * every placeholder a template names is supplied by every call site that
 * uses it, and no call site passes a parameter the template does not print.
 * TypeScript already rejects a key that does not exist; this covers the rest.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { LOG_TEXT } from '../src/core/text/log.text';
import { placeholdersOf, text } from '../src/core/text/log';

interface CallSite {
  where: string;
  key: string;
  /** Parameter names passed, or null when the params object is not a literal. */
  params: string[] | null;
}

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.svelte.ts')) out.push(full);
  }
  return out;
}

function callSites(): CallSite[] {
  const sites: CallSite[] = [];
  for (const file of listFiles(path.resolve(__dirname, '../src'))) {
    const src = fs.readFileSync(file, 'utf8');
    if (!src.includes("text('")) continue;
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
    const walk = (n: ts.Node) => {
      if (
        ts.isCallExpression(n) &&
        ts.isIdentifier(n.expression) &&
        n.expression.text === 'text' &&
        n.arguments.length >= 1
      ) {
        const keys: string[] = [];
        const first = n.arguments[0];
        if (ts.isStringLiteral(first)) keys.push(first.text);
        else if (ts.isConditionalExpression(first)) {
          for (const branch of [first.whenTrue, first.whenFalse]) if (ts.isStringLiteral(branch)) keys.push(branch.text);
        }
        const second = n.arguments[1];
        let params: string[] | null = null;
        if (!second) params = [];
        else if (ts.isObjectLiteralExpression(second)) {
          params = second.properties.map((p) =>
            ts.isShorthandPropertyAssignment(p) ? p.name.text : ts.isPropertyAssignment(p) ? p.name.getText() : '?',
          );
        }
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
        for (const key of keys) sites.push({ where: `${path.relative(process.cwd(), file)}:${line + 1}`, key, params });
      }
      ts.forEachChild(n, walk);
    };
    walk(sf);
  }
  return sites;
}

describe('log templates', () => {
  const sites = callSites();
  const keys = Object.keys(LOG_TEXT) as (keyof typeof LOG_TEXT)[];

  it('found the call sites', () => {
    expect(sites.length).toBeGreaterThan(150);
  });

  it('every template is fired by some call site', () => {
    const used = new Set(sites.map((s) => s.key));
    const unused = keys.filter((k) => !used.has(k));
    expect(unused).toEqual([]);
  });

  it('every call site supplies exactly the placeholders its template names', () => {
    const problems: string[] = [];
    for (const s of sites) {
      if (!(s.key in LOG_TEXT)) { problems.push(`${s.where}: unknown key ${s.key}`); continue; }
      if (s.params === null) continue;
      const wanted = placeholdersOf(LOG_TEXT[s.key as keyof typeof LOG_TEXT]);
      for (const w of wanted) if (!s.params.includes(w)) problems.push(`${s.where}: ${s.key} needs {${w}}`);
      for (const p of s.params) if (!wanted.includes(p)) problems.push(`${s.where}: ${s.key} does not print {${p}}`);
    }
    expect(problems).toEqual([]);
  });

  it('fills placeholders and leaves unknown ones visible', () => {
    expect(text('combat.appears', { what: 'Rat', level: 3 })).toBe('⚠️ Rat (Lv 3) appears!');
    expect(text('combat.appears', { what: 'Rat' })).toBe('⚠️ Rat (Lv {level}) appears!');
    expect(text('common.no_leaving_fight')).toBe(LOG_TEXT['common.no_leaving_fight']);
  });
});
