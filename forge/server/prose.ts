/**
 * Routing between a data file and its text file.
 *
 * Player-facing prose (`desc`, `dialogue`, `hint`) is not stored in
 * `src/core/data/*.data.ts` any more — it lives in `src/core/text/*.text.ts`
 * as a flat table of dotted keys, and `src/core/text/prose.ts` stitches it
 * back onto the entries at load time. The forge's client never learns this:
 * it edits `spot.desc` on the hydrated object like any other field, and this
 * module splits each patch op into the data-file part and the text-file part.
 *
 * The one thing to get right is the KEY. `warden_of_the_foot.desc` is easy;
 * `f1_storerooms.finds.strongbox.desc` needs the array element's `id`, which
 * the client addresses as `#id=strongbox` and the hydrator resolves by
 * matching `id`. `proseKeyFor` does that translation against the data file's
 * own AST, so a find that has no id yet falls back to its index.
 */

import ts from 'typescript';
import {
  addEntry,
  deleteAt,
  findRoot,
  parse,
  propOf,
  renameEntry,
  setAt,
  step,
  unwrap,
  type EditResult,
  type PathStep,
} from './edit';
import type { CatalogEntry } from './catalog';

export const PROSE_FIELDS: ReadonlySet<string> = new Set(['desc', 'dialogue', 'hint']);

/** `src/core/data/npcs.data.ts` → `src/core/text/npcs.text.ts`. */
export function textFileFor(dataFile: string): string {
  return dataFile.replace(/\/data\/([^/]+)\.data\.ts$/, '/text/$1.text.ts');
}

/** `NPCS` → `NPCS_TEXT`. */
export function textRootFor(root: string): string {
  return `${root}_TEXT`;
}

function idOf(el: ts.Expression): string | null {
  const obj = unwrap(el);
  if (!ts.isObjectLiteralExpression(obj)) return null;
  const prop = propOf(obj, 'id');
  const value = prop && unwrap(prop.initializer);
  return value && ts.isStringLiteral(value) ? value.text : null;
}

/**
 * The dotted prose key for a data-file path. Lookups (`#id=x`) become the id,
 * numeric indexes become the element's id when it has one, and steps past the
 * end of what exists are kept verbatim (that is how a brand-new find gets its
 * key before the find itself is written).
 */
export function proseKeyFor(dataText: string, entry: CatalogEntry, path: PathStep[]): string {
  const sf = parse(entry.file, dataText);
  let current: ts.Expression | null = findRoot(sf, entry.root);
  const parts: string[] = [];
  for (const s of path) {
    if (typeof s === 'string' && s.startsWith('#')) {
      const eq = s.indexOf('=');
      const key = s.slice(1, eq);
      if (key !== 'id') throw new Error(`Prose keys can only address array elements by id, not '${key}'`);
      parts.push(s.slice(eq + 1));
    } else if (typeof s === 'number') {
      const el = current ? step(current, s) : null;
      parts.push((el && idOf(el)) ?? String(s));
    } else {
      parts.push(s);
    }
    const next = current ? step(current, s) : null;
    current = next ? unwrap(next) : null;
  }
  return parts.join('.');
}

export interface ProseSlice {
  /** Sub-path below the value, in prose-key form (ids where available). */
  path: string[];
  value: string | string[];
}

function isProseValue(v: unknown): v is string | string[] {
  return typeof v === 'string' || (Array.isArray(v) && v.every((x) => typeof x === 'string'));
}

/**
 * Take the prose fields out of a value about to be written to a data file.
 * Returns the value without them plus the slices to write to the text file.
 */
export function splitProse(value: unknown, below: string[] = []): { stripped: unknown; prose: ProseSlice[] } {
  if (Array.isArray(value)) {
    const prose: ProseSlice[] = [];
    const stripped = value.map((el, i) => {
      const id = el && typeof el === 'object' && typeof (el as { id?: unknown }).id === 'string'
        ? (el as { id: string }).id
        : String(i);
      const inner = splitProse(el, [...below, id]);
      prose.push(...inner.prose);
      return inner.stripped;
    });
    return { stripped, prose };
  }
  if (value === null || typeof value !== 'object') return { stripped: value, prose: [] };
  const prose: ProseSlice[] = [];
  const stripped: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (PROSE_FIELDS.has(k) && isProseValue(v)) {
      prose.push({ path: [...below, k], value: v });
      continue;
    }
    const inner = splitProse(v, [...below, k]);
    prose.push(...inner.prose);
    stripped[k] = inner.stripped;
  }
  return { stripped, prose };
}

/** Every key in a text table. */
export function textKeys(textText: string, textRoot: string): string[] {
  const sf = parse('text', textText);
  const root = findRoot(sf, textRoot);
  if (!root || !ts.isObjectLiteralExpression(root)) return [];
  const keys: string[] = [];
  for (const p of root.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    const n = p.name;
    if (ts.isIdentifier(n) || ts.isStringLiteral(n)) keys.push(n.text);
  }
  return keys;
}

/** One concrete file edit, ready to run against that file's current text. */
export interface FileEdit {
  file: string;
  apply: (current: string) => EditResult;
}

export type ForgeOp =
  | { op: 'set'; kind: string; path: PathStep[]; value: unknown }
  | { op: 'delete'; kind: string; path: PathStep[] }
  | { op: 'add'; kind: string; key: string; value: unknown }
  | { op: 'rename'; kind: string; from: string; to: string };

/**
 * Split one client op into the edits it really is: at most one on the data
 * file, any number on the text file. `dataText`/`textText` are the CURRENT
 * working copies, because keys and prefixes are computed against them.
 */
export function routeOp(
  op: ForgeOp,
  entry: CatalogEntry,
  dataText: string,
  textText: string,
): FileEdit[] {
  const dataFile = entry.file;
  const textFile = textFileFor(dataFile);
  const textRoot = textRootFor(entry.root);
  const edits: FileEdit[] = [];
  const textSet = (key: string, value: string | string[]) =>
    edits.push({ file: textFile, apply: (t) => setAt(textFile, t, textRoot, [key], value) });
  const textDeletePrefix = (prefix: string) => {
    for (const key of textKeys(textText, textRoot)) {
      if (key === prefix || key.startsWith(prefix + '.')) {
        edits.push({ file: textFile, apply: (t) => deleteAt(textFile, t, textRoot, [key]) });
      }
    }
  };

  if (op.op === 'set') {
    const last = op.path[op.path.length - 1];
    if (typeof last === 'string' && PROSE_FIELDS.has(last)) {
      if (!isProseValue(op.value)) throw new Error(`'${last}' must be a string or string list`);
      textSet(proseKeyFor(dataText, entry, op.path), op.value);
      return edits;
    }
    const { stripped, prose } = splitProse(op.value);
    edits.push({
      file: dataFile,
      apply: (t) => setAt(dataFile, t, entry.root, op.path, stripped, entry.keyOrder),
    });
    if (prose.length) {
      const base = proseKeyFor(dataText, entry, op.path);
      for (const slice of prose) textSet([base, ...slice.path].join('.'), slice.value);
    }
    return edits;
  }

  if (op.op === 'add') {
    const { stripped, prose } = splitProse(op.value);
    edits.push({
      file: dataFile,
      apply: (t) => addEntry(dataFile, t, entry.root, op.key, stripped, entry.keyOrder),
    });
    for (const slice of prose) textSet([op.key, ...slice.path].join('.'), slice.value);
    return edits;
  }

  if (op.op === 'delete') {
    const last = op.path[op.path.length - 1];
    const key = proseKeyFor(dataText, entry, op.path);
    if (typeof last === 'string' && PROSE_FIELDS.has(last)) {
      textDeletePrefix(key);
      return edits;
    }
    edits.push({ file: dataFile, apply: (t) => deleteAt(dataFile, t, entry.root, op.path) });
    textDeletePrefix(key);
    return edits;
  }

  // rename
  edits.push({ file: dataFile, apply: (t) => renameEntry(dataFile, t, entry.root, op.from, op.to) });
  for (const key of textKeys(textText, textRoot)) {
    if (key === op.from || key.startsWith(op.from + '.')) {
      const next = op.to + key.slice(op.from.length);
      edits.push({ file: textFile, apply: (t) => renameEntry(textFile, t, textRoot, key, next) });
    }
  }
  return edits;
}
