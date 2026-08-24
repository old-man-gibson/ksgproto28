/**
 * Reading and (surgically) writing the cards in `docs/plans/`.
 *
 * The forge parses TypeScript because its data files are TypeScript. Cards are
 * markdown, so this file is the much smaller equivalent: a frontmatter reader
 * with no dependency, and a writer that replaces exactly one line.
 *
 * The format is deliberately impoverished — flat `key: value` scalars and
 * `  - item` lists, nothing nested. That is not laziness. A format this small
 * can be hand-edited in any text editor without knowing a spec, and it can be
 * grepped: `grep -l 'status: review' docs/plans/*.md` is a valid board.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export const STATUSES = [
  'todo',
  'planning',
  'draft',
  'execution',
  'review',
  'complete',
] as const;

export type Status = (typeof STATUSES)[number];

export const KINDS = ['epic', 'story'] as const;
export type Kind = (typeof KINDS)[number];

/** Where cards live, relative to the repo root. */
export const PLANS_DIR = 'docs/plans';

export interface Card {
  id: string;
  title: string;
  kind: Kind;
  status: Status;
  system: string;
  parent: string;
  save: string;
  updated: string;
  invariants: string[];
  done: string[];
  /** Repo-relative path, so the UI can show where the truth actually is. */
  file: string;
  /** Everything after the closing `---`, untouched. */
  body: string;
  /**
   * Format problems are REPORTED, never thrown. A card with a typo'd status is
   * still a card, and hiding it from the board is the one failure mode that
   * matters — an invisible card is a forgotten card.
   */
  warnings: string[];
}

const FENCE = '---';

/**
 * Quotes are optional, and stripped when present.
 *
 * Nobody writing `save: ''` by hand means the two-character string `''`, and
 * requiring bare values would make the format something you have to be taught.
 * The board writes bare; a human may write either.
 */
function unquote(value: string): string {
  const m = /^(['"])(.*)\1$/.exec(value);
  return m ? m[2] : value;
}

interface Frontmatter {
  fields: Map<string, string | string[]>;
  /** Line index (0-based) of each scalar key, for surgical writes. */
  lines: Map<string, number>;
  body: string;
  warnings: string[];
}

/**
 * Split a card into its header and its prose.
 *
 * A file with no frontmatter is not an error either — it parses as an all-body
 * card and the caller fills in defaults. `docs/plans/psionic-overload.md`
 * predates this format and must keep working.
 */
export function parseFrontmatter(text: string): Frontmatter {
  const warnings: string[] = [];
  const fields = new Map<string, string | string[]>();
  const lines = new Map<string, number>();

  const all = text.split(/\r?\n/);
  if (all[0]?.trim() !== FENCE) {
    return { fields, lines, body: text, warnings: ['No frontmatter block.'] };
  }

  let close = -1;
  for (let i = 1; i < all.length; i++) {
    if (all[i].trim() === FENCE) {
      close = i;
      break;
    }
  }
  if (close === -1) {
    return { fields, lines, body: text, warnings: ['Frontmatter is never closed.'] };
  }

  let listKey: string | null = null;
  for (let i = 1; i < close; i++) {
    const line = all[i];
    if (!line.trim()) continue;

    const item = /^\s+-\s*(.*)$/.exec(line);
    if (item) {
      if (!listKey) {
        warnings.push(`Line ${i + 1}: list item with no key above it.`);
        continue;
      }
      (fields.get(listKey) as string[]).push(unquote(item[1].trim()));
      continue;
    }

    const pair = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    if (!pair) {
      warnings.push(`Line ${i + 1}: not a \`key: value\` pair — ignored.`);
      continue;
    }

    const [, key, raw] = pair;
    const value = unquote(raw.trim());
    lines.set(key, i);

    // `key: []` is an empty list and stays one. A bare `key:` is ambiguous
    // until the next line — it opens a list, and collapses back to a blank
    // scalar below if nothing was ever appended to it.
    if (value === '[]' || value === '') {
      fields.set(key, [] as string[]);
      listKey = key;
      continue;
    }

    fields.set(key, value);
    listKey = null;
  }

  for (const [key, value] of fields) {
    if (!Array.isArray(value) || value.length > 0) continue;
    if (!/:\s*\[\]\s*$/.test(all[lines.get(key)!] ?? '')) fields.set(key, '');
  }

  return { fields, lines, body: all.slice(close + 1).join('\n'), warnings };
}

function scalar(fm: Frontmatter, key: string, fallback = ''): string {
  const value = fm.fields.get(key);
  if (Array.isArray(value)) return fallback;
  return value ?? fallback;
}

function list(fm: Frontmatter, key: string): string[] {
  const value = fm.fields.get(key);
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

/** Turn one file into a card, defaulting anything missing rather than failing. */
export function toCard(file: string, text: string): Card {
  const fm = parseFrontmatter(text);
  const warnings = [...fm.warnings];
  const fallbackId = path.basename(file, '.md');

  const status = scalar(fm, 'status', 'todo') as Status;
  if (!STATUSES.includes(status)) {
    warnings.push(`Unknown status \`${status}\` — parked in \`todo\` until it is one of: ${STATUSES.join(', ')}.`);
  }
  const kind = scalar(fm, 'kind', 'story') as Kind;
  if (!KINDS.includes(kind)) warnings.push(`Unknown kind \`${kind}\` — treated as \`story\`.`);

  const id = scalar(fm, 'id', fallbackId);
  if (id !== fallbackId) {
    warnings.push(`\`id: ${id}\` does not match the filename \`${fallbackId}.md\`. \`parent:\` references use the id.`);
  }

  return {
    id,
    title: scalar(fm, 'title', fallbackId),
    kind: KINDS.includes(kind) ? kind : 'story',
    status: STATUSES.includes(status) ? status : 'todo',
    system: scalar(fm, 'system', 'meta'),
    parent: scalar(fm, 'parent'),
    save: scalar(fm, 'save'),
    updated: scalar(fm, 'updated'),
    invariants: list(fm, 'invariants'),
    done: list(fm, 'done'),
    file: `${PLANS_DIR}/${path.basename(file)}`,
    body: fm.body,
    warnings,
  };
}

/** Every card on disk, filename order. Files starting with `_` are not cards. */
export async function readCards(rootDir: string): Promise<Card[]> {
  const dir = path.join(rootDir, PLANS_DIR);
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  const cards: Card[] = [];
  for (const name of names.sort()) {
    if (!name.endsWith('.md') || name.startsWith('_')) continue;
    const text = await fs.readFile(path.join(dir, name), 'utf8');
    cards.push(toCard(name, text));
  }
  return cards;
}

/**
 * Replace one scalar's value inside the frontmatter, byte-for-byte everywhere
 * else. This is the markdown cousin of the forge's AST surgery, and it exists
 * for the same reason: the prose in these files is the actual work, and a
 * writer that reprints the document would quietly reformat it.
 *
 * A key that is not present is INSERTED just above the closing fence rather
 * than appended to the end of the file, so an older card gains a field without
 * anyone editing it by hand.
 */
export function setField(text: string, key: string, value: string): string {
  const eol = eolOf(text);
  const all = text.split(/\r?\n/);
  const close = closingFence(all);

  // An unset scalar is a bare `key:`. Writing `key: ` instead leaves a trailing
  // space that no editor shows and every save preserves — the sort of wart that
  // is invisible once and unbearable after forty of them.
  const line = value ? `${key}: ${value}` : `${key}:`;

  const at = keyLine(all, close, key);
  if (at !== -1) {
    all[at] = line;
    return all.join(eol);
  }

  all.splice(close, 0, line);
  return all.join(eol);
}

/**
 * Replace a frontmatter list, consuming however many `  - item` lines the old
 * one had. An empty list is written `key: []` rather than as a bare `key:`,
 * because the bare form is the ambiguous one the reader has to guess at.
 */
export function setList(text: string, key: string, items: string[]): string {
  const eol = eolOf(text);
  const all = text.split(/\r?\n/);
  const close = closingFence(all);

  const clean = items.map((i) => i.trim()).filter(Boolean);
  const block = clean.length ? [`${key}:`, ...clean.map((i) => `  - ${i}`)] : [`${key}: []`];

  const at = keyLine(all, close, key);
  if (at === -1) {
    all.splice(close, 0, ...block);
    return all.join(eol);
  }

  let end = at + 1;
  while (end < close && /^\s+-\s/.test(all[end])) end++;
  all.splice(at, end - at, ...block);
  return all.join(eol);
}

/**
 * Replace everything after the closing fence, and nothing before it.
 *
 * The split is the safety property: a body edit is structurally incapable of
 * corrupting the header, and a header edit cannot touch a word of the prose.
 * They are the two things in a card with genuinely different owners.
 */
export function setBody(text: string, body: string): string {
  const eol = eolOf(text);
  const all = text.split(/\r?\n/);
  const close = closingFence(all);
  return [...all.slice(0, close + 1), ...body.split(/\r?\n/)].join(eol);
}

/** The prose of a card, for comparing against what an editor last saw. */
export function bodyOf(text: string): string {
  return parseFrontmatter(text).body;
}

function eolOf(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

/** Index of the fence that closes the frontmatter. Throws rather than guess. */
function closingFence(all: string[]): number {
  if (all[0]?.trim() !== FENCE) {
    throw new Error('Refusing to write: the file has no frontmatter block.');
  }
  for (let i = 1; i < all.length; i++) {
    if (all[i].trim() === FENCE) return i;
  }
  throw new Error('Refusing to write: frontmatter is never closed.');
}

/** Line index of `key:` inside the frontmatter, or -1. */
function keyLine(all: string[], close: number, key: string): number {
  const at = /^([A-Za-z_][A-Za-z0-9_]*):/;
  for (let i = 1; i < close; i++) {
    const m = at.exec(all[i]);
    if (m && m[1] === key) return i;
  }
  return -1;
}

/** Today, as the cards write it. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A fresh card body, matching `_TEMPLATE.md`'s header exactly. */
export function newCard(fields: {
  id: string;
  title: string;
  kind: Kind;
  system: string;
  parent: string;
}): string {
  // An unset scalar is a bare `key:`, never `key: ''` — the reader accepts both
  // but only one of them looks like something a person would type.
  const line = (key: string, value: string): string => (value ? `${key}: ${value}` : `${key}:`);

  return [
    FENCE,
    line('id', fields.id),
    line('title', fields.title),
    line('kind', fields.kind),
    'status: todo',
    line('system', fields.system),
    line('parent', fields.parent),
    'save:',
    line('updated', today()),
    'invariants: []',
    'done: []',
    FENCE,
    '',
    `# ${fields.title}`,
    '',
    'Captured, not thought about yet.',
    '',
  ].join('\n');
}
