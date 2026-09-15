/**
 * Surgical edits to `*.data.ts` by TypeScript AST range.
 *
 * The rule this whole module exists to honor: **the forge only ever rewrites
 * the exact character range of the thing being changed.** It never reprints a
 * file, never reprints an entry it wasn't asked to touch, and therefore never
 * eats the hand-written comments that make the data files worth reading. Move
 * a spot on the map and the ONLY bytes that change are the two numbers in its
 * `map: { x, y }`.
 *
 * Ranges go stale the moment you edit, so a batch of ops re-parses between each
 * one. The data files are tens of kilobytes; correctness is worth the parse.
 */

import ts from 'typescript';
import { KEY_ORDER, ORDER_BY_FIELD, printKey, printString, printValue } from './print';

// ---------- Path addressing ----------

/**
 * A step into the data. Strings index object properties, numbers index array
 * elements, and `#key=value` finds the array element whose `key` property
 * equals `value` — which is how you address a connection (`#to=ravine_floor`)
 * or a find (`#id=mossy_chute`) without caring where it sits in the list.
 */
export type PathStep = string | number;

interface Lookup {
  key: string;
  value: string;
}

function parseLookup(step: string): Lookup | null {
  if (!step.startsWith('#')) return null;
  const eq = step.indexOf('=');
  if (eq < 0) return null;
  return { key: step.slice(1, eq), value: step.slice(eq + 1) };
}

// ---------- Source navigation ----------

export function parse(fileName: string, text: string): ts.SourceFile {
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/** The hydration helpers from `src/core/text/prose.ts`; their last argument is the literal. */
const PROSE_WRAPPERS = new Set(['prose', 'proseList']);

/**
 * Unwrap `x as const`, `x satisfies T`, parentheses, and the
 * `prose('ROOT', ROOT_TEXT, {...})` call every described registry is declared
 * through, down to the literal inside.
 */
export function unwrap(node: ts.Expression): ts.Expression {
  let current = node;
  for (;;) {
    if (ts.isAsExpression(current) || ts.isSatisfiesExpression(current)) current = current.expression;
    else if (ts.isParenthesizedExpression(current)) current = current.expression;
    else if (
      ts.isCallExpression(current) &&
      ts.isIdentifier(current.expression) &&
      PROSE_WRAPPERS.has(current.expression.text) &&
      current.arguments.length > 0
    ) {
      current = current.arguments[current.arguments.length - 1];
    } else return current;
  }
}

/** The initializer of `export const <name> ... = <here>`. */
export function findRoot(sf: ts.SourceFile, name: string): ts.Expression | null {
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === name && decl.initializer) {
        return unwrap(decl.initializer);
      }
    }
  }
  return null;
}

export function propOf(obj: ts.ObjectLiteralExpression, key: string): ts.PropertyAssignment | null {
  for (const p of obj.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    const name = p.name;
    const text = ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)
      ? name.text
      : null;
    if (text === key) return p;
  }
  return null;
}

function elementOf(arr: ts.ArrayLiteralExpression, lookup: Lookup): ts.Expression | null {
  for (const el of arr.elements) {
    const obj = unwrap(el);
    if (!ts.isObjectLiteralExpression(obj)) continue;
    const prop = propOf(obj, lookup.key);
    if (prop && ts.isStringLiteral(unwrap(prop.initializer)) &&
        (unwrap(prop.initializer) as ts.StringLiteral).text === lookup.value) {
      return el;
    }
  }
  return null;
}

export interface Resolved {
  /** The value node the path names, if it exists. */
  node: ts.Expression | null;
  /** The property assignment wrapping it (for deletes), if any. */
  prop: ts.PropertyAssignment | null;
  /** The container the last step indexes into. */
  container: ts.Expression;
  /** The final step, unresolved. */
  last: PathStep;
}

/**
 * The index of the first path step that doesn't exist yet, or -1 if the whole
 * path resolves. Adding `finds` to a spot that has none is an ordinary edit,
 * not an error — the forge builds the missing rungs on the way down.
 */
export function firstMissing(root: ts.Expression, path: PathStep[]): number {
  let current = root;
  for (let i = 0; i < path.length; i++) {
    const next = step(current, path[i]);
    if (!next) return i;
    current = unwrap(next);
  }
  return -1;
}

/**
 * The container `value` needs to be wrapped in so that it ends up addressable
 * at `path[i..]` — an array when the next step indexes one, an object otherwise.
 */
export function wrapForPath(path: PathStep[], i: number, value: unknown): unknown {
  if (i >= path.length) return value;
  const inner = wrapForPath(path, i + 1, value);
  const s = path[i];
  if (typeof s === 'number' || String(s).startsWith('#')) return [inner];
  return { [s]: inner };
}

/**
 * Walk `path` from a root expression. Every step but the last must exist;
 * the last may be missing (that is an insert rather than a replace).
 */
export function resolve(root: ts.Expression, path: PathStep[]): Resolved {
  if (path.length === 0) throw new Error('resolve() needs at least one path step');
  let current = root;

  for (let i = 0; i < path.length - 1; i++) {
    const next = step(current, path[i]);
    if (!next) throw new Error(`Path not found at '${path.slice(0, i + 1).join('.')}'`);
    current = unwrap(next);
  }

  const last = path[path.length - 1];
  const found = step(current, last);
  let prop: ts.PropertyAssignment | null = null;
  if (typeof last === 'string' && !last.startsWith('#') && ts.isObjectLiteralExpression(current)) {
    prop = propOf(current, last);
  }
  return { node: found ? unwrap(found) : null, prop, container: current, last };
}

export function step(current: ts.Expression, key: PathStep): ts.Expression | null {
  if (typeof key === 'number') {
    if (!ts.isArrayLiteralExpression(current)) return null;
    return current.elements[key] ?? null;
  }
  const lookup = parseLookup(key);
  if (lookup) {
    if (!ts.isArrayLiteralExpression(current)) return null;
    return elementOf(current, lookup);
  }
  if (!ts.isObjectLiteralExpression(current)) return null;
  return propOf(current, key)?.initializer ?? null;
}

// ---------- Text surgery ----------

/** Column (0-based) the node's first character sits at. */
function columnOf(sf: ts.SourceFile, pos: number): number {
  const { character } = sf.getLineAndCharacterOfPosition(pos);
  return character;
}

/**
 * The file's own line ending. The data files are CRLF on this machine, and a
 * forge that inserted bare LF would leave a trail of mixed endings behind it.
 */
function eolOf(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

/** Whether a node is written across several lines in the source. */
function isMultiline(sf: ts.SourceFile, node: ts.Node, text: string): boolean {
  return text.slice(node.getStart(sf), node.getEnd()).includes('\n');
}

/**
 * Leading whitespace on the line `pos` sits on. This is the indent new content
 * should line up with — NOT the column of the node itself, which for
 * `from: [...]` is wherever the `[` happens to land.
 */
function lineIndentOf(sf: ts.SourceFile, text: string, pos: number): number {
  const { line } = sf.getLineAndCharacterOfPosition(pos);
  const start = sf.getPositionOfLineAndCharacter(line, 0);
  let i = start;
  while (i < text.length && (text[i] === ' ' || text[i] === '\t')) i++;
  return i - start;
}

/** Start of the statement a node belongs to, for indentation purposes. */
function statementStart(sf: ts.SourceFile, node: ts.Node): number {
  let current: ts.Node = node;
  while (current.parent && !ts.isSourceFile(current.parent)) current = current.parent;
  return current.getStart(sf);
}

/**
 * The field order to print a value at `path` in. Writing into `finds` prints
 * find-shaped entries whatever entity owns them, so the order comes from the
 * nearest named field in the path rather than from the top-level entity.
 */
function orderFor(path: PathStep[], entityOrder?: string): string[] | undefined {
  for (let i = path.length - 1; i >= 1; i--) {
    const s = path[i];
    if (typeof s !== 'string' || s.startsWith('#')) continue;
    const named = ORDER_BY_FIELD[s];
    if (named) return KEY_ORDER[named];
  }
  return entityOrder ? KEY_ORDER[entityOrder] : undefined;
}

/**
 * End of a property/element including its trailing comma and any `//` comment
 * that shares the line — otherwise deleting `b: 2, // why` strands the comment
 * on top of whatever came next.
 */
function endWithComma(text: string, end: number): number {
  let i = end;
  while (i < text.length && /[ \t]/.test(text[i])) i++;
  if (text[i] === ',') i++;
  // A line comment that starts on this same line belongs to what we removed.
  let j = i;
  while (j < text.length && /[ \t]/.test(text[j])) j++;
  if (text.slice(j, j + 2) === '//') {
    while (j < text.length && text[j] !== '\n') j++;
    return j;
  }
  return i;
}

/**
 * Re-join a printed value with the file's own line ending. The printer is
 * already told which column it starts at and indents its own continuation
 * lines, so this must NOT add indentation — doing both is how you get a value
 * indented twice over.
 */
function reindent(printed: string, _column: number, eol = '\n'): string {
  return eol === '\n' ? printed : printed.split('\n').join(eol);
}

export interface EditResult {
  text: string;
  /** Human-readable note for the change log / diff header. */
  note: string;
}

/** Replace the value at `path`, or insert it if the last step is missing. */
export function setAt(
  fileName: string,
  text: string,
  rootName: string,
  path: PathStep[],
  value: unknown,
  keyOrderName?: string,
): EditResult {
  const sf = parse(fileName, text);
  const root = findRoot(sf, rootName);
  if (!root) throw new Error(`No exported const named ${rootName} in ${fileName}`);

  // Setting `finds[#id=x]` on a spot that has no `finds` at all: build the
  // missing rungs and insert the whole subtree at the deepest point that does
  // exist, so one op adds `finds: [ { ... } ]` in one legible edit.
  const missing = firstMissing(root, path);
  if (missing >= 0 && missing < path.length - 1) {
    return setAt(
      fileName,
      text,
      rootName,
      path.slice(0, missing + 1),
      wrapForPath(path, missing + 1, value),
      keyOrderName,
    );
  }

  const { node, container, last } = resolve(root, path);
  // Two different orders are in play and confusing them misplaces things:
  // `valueOrder` is how the value's own fields are printed (a find prints
  // id-first), `parentOrder` is where its KEY belongs among its siblings
  // (`finds` belongs next to `exploreTicks`, not after `connections`).
  const keyOrder = orderFor(path, keyOrderName);
  const parentOrder = orderFor(path.slice(0, -1), keyOrderName);

  if (node) {
    const start = node.getStart(sf);
    // A value written on one line stays on one line — the same promise the
    // object-insert path makes. Without this, replacing `world: { x, y }` at
    // the deep column a long one-line entry puts it at made the printer break
    // it into a staircase nobody wrote. Multi-line values keep the printer's
    // own judgment about their layout.
    const printed = !isMultiline(sf, node, text)
      ? printValue(value, { indent: 0, compact: true, keyOrder })
      : reindent(
          printValue(value, { indent: columnOf(sf, start), keyOrder }),
          columnOf(sf, start),
          eolOf(text),
        );
    return {
      text: text.slice(0, start) + printed + text.slice(node.getEnd()),
      note: `set ${rootName}.${path.join('.')}`,
    };
  }

  // Missing: insert into whatever container the last step indexes.
  if (typeof last === 'number' || parseLookup(String(last))) {
    if (!ts.isArrayLiteralExpression(container)) {
      throw new Error(`Cannot append to a non-array at ${path.join('.')}`);
    }
    return {
      ...insertIntoArray(sf, text, container, value, keyOrder),
      note: `add ${rootName}.${path.join('.')}`,
    };
  }
  if (!ts.isObjectLiteralExpression(container)) {
    throw new Error(`Cannot add property '${last}' to a non-object at ${path.join('.')}`);
  }
  return {
    ...insertIntoObject(sf, text, container, String(last), value, keyOrder, parentOrder),
    note: `add ${rootName}.${path.join('.')}`,
  };
}

/** Remove the property or element at `path`, comma and trailing comment too. */
export function deleteAt(
  fileName: string,
  text: string,
  rootName: string,
  path: PathStep[],
): EditResult {
  const sf = parse(fileName, text);
  const root = findRoot(sf, rootName);
  if (!root) throw new Error(`No exported const named ${rootName} in ${fileName}`);

  // Deleting something that isn't there is a no-op, not an error. Ticking a
  // checkbox and unticking it before applying stages a set then a delete; the
  // set never reached disk, so the delete finds nothing — and failing the whole
  // batch over that would make the tool unusable for ordinary fiddling. The
  // requested end state ("this must not exist") already holds.
  if (firstMissing(root, path) >= 0) {
    return { text, note: `delete ${rootName}.${path.join('.')} (nothing there)` };
  }
  const { node, prop, container } = resolve(root, path);
  if (!node) return { text, note: `delete ${rootName}.${path.join('.')} (nothing there)` };

  // Take the property assignment when there is one, so `key: value` goes as a
  // unit; otherwise the array element itself.
  const target: ts.Node = prop ?? node;
  let from = target.getFullStart();
  let to = endWithComma(text, target.getEnd());
  // Deleting the LAST member of a ONE-LINE container takes the comma before it
  // too — `{ id: 'x', name: 'y', }` is not how these files are written — and
  // leaves the space before the closing brace alone. A multiline container
  // keeps its trailing comma on purpose.
  if (!isMultiline(sf, container, text)) {
    let after = to;
    while (after < text.length && /[ \t]/.test(text[after])) after++;
    if (text[after] === '}' || text[after] === ']') {
      to = target.getEnd();
      let before = from;
      while (before > 0 && /[ \t]/.test(text[before - 1])) before--;
      if (text[before - 1] === ',') from = before - 1;
    }
  }
  return {
    text: text.slice(0, from) + text.slice(to),
    note: `delete ${rootName}.${path.join('.')}`,
  };
}

function insertIntoObject(
  sf: ts.SourceFile,
  text: string,
  obj: ts.ObjectLiteralExpression,
  key: string,
  value: unknown,
  /** How the VALUE's own fields are printed. */
  childOrder?: string[],
  /** How the KEY is placed among its siblings. */
  parentOrder?: string[],
): { text: string } {
  const props = obj.properties;
  const objColumn = columnOf(sf, obj.getStart(sf));
  const eol = eolOf(text);

  if (props.length === 0) {
    const inner = objColumn + 2;
    const printed = reindent(printValue(value, { indent: inner, keyOrder: childOrder }), inner, eol);
    const body = `{${eol}${' '.repeat(inner)}${printKey(key)}: ${printed},${eol}${' '.repeat(objColumn)}}`;
    return { text: text.slice(0, obj.getStart(sf)) + body + text.slice(obj.getEnd()) };
  }

  // A `{ to: 'x', ticks: 30 }` written on one line stays on one line — breaking
  // it open to add `label` would rewrite a line the author formatted on purpose.
  if (!isMultiline(sf, obj, text)) {
    const anchor = orderedAnchor(sf, obj, key, parentOrder);
    const printed = printValue(value, { indent: 0, compact: true, keyOrder: childOrder });
    const piece = `${printKey(key)}: ${printed}`;
    if (anchor.before) {
      const at = anchor.node.getStart(sf);
      return { text: text.slice(0, at) + piece + ', ' + text.slice(at) };
    }
    const at = anchor.node.getEnd();
    return { text: text.slice(0, at) + ', ' + piece + text.slice(at) };
  }

  // Slot the new key where KEY_ORDER says it belongs, so `finds` lands next to
  // `exploreTicks` instead of after `connections`.
  const anchor = orderedAnchor(sf, obj, key, parentOrder);
  const column = columnOf(sf, anchor.node.getStart(sf));
  const printed = reindent(printValue(value, { indent: column, keyOrder: childOrder }), column, eol);
  const line = `${printKey(key)}: ${printed},`;

  if (anchor.before) {
    const at = anchor.node.getStart(sf);
    return { text: text.slice(0, at) + line + eol + ' '.repeat(column) + text.slice(at) };
  }
  const at = endWithComma(text, anchor.node.getEnd());
  const needsComma = text[at - 1] !== ',';
  return {
    text:
      text.slice(0, at) + (needsComma ? ',' : '') + eol + ' '.repeat(column) + line + text.slice(at),
  };
}

/**
 * Where a new key goes: immediately before the first existing key that ranks
 * after it, else after the last property.
 */
function orderedAnchor(
  sf: ts.SourceFile,
  obj: ts.ObjectLiteralExpression,
  key: string,
  keyOrder?: string[],
): { node: ts.Node; before: boolean } {
  const props = obj.properties;
  const last = props[props.length - 1];
  if (!keyOrder) return { node: last, before: false };

  const rank = (name: string) => {
    const i = keyOrder.indexOf(name);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const mine = rank(key);
  if (mine === Number.MAX_SAFE_INTEGER) return { node: last, before: false };

  for (const p of props) {
    if (!ts.isPropertyAssignment(p)) continue;
    const name = ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : '';
    if (rank(name) > mine) return { node: p, before: true };
  }
  return { node: last, before: false };
}

function insertIntoArray(
  sf: ts.SourceFile,
  text: string,
  arr: ts.ArrayLiteralExpression,
  value: unknown,
  keyOrder?: string[],
): { text: string } {
  const els = arr.elements;
  const eol = eolOf(text);

  // Filling an empty array reprints the whole `[]` rather than splicing into
  // it, so the printer decides inline-versus-broken the same way it would for
  // fresh content. Hand-assembling it anchored the indent to the column of the
  // `[` — which sits mid-line after `from: ` — and produced a staircase.
  if (els.length === 0) {
    const indent = lineIndentOf(sf, text, arr.getStart(sf));
    const printed = reindent(printValue([value], { indent, keyOrder }), indent, eol);
    return { text: text.slice(0, arr.getStart(sf)) + printed + text.slice(arr.getEnd()) };
  }

  const last = els[els.length - 1];
  // A one-line array (`[{ ... }]`) stays one line; a broken one stays broken.
  const multiline = isMultiline(sf, arr, text);
  const column = columnOf(sf, last.getStart(sf));
  const printed = multiline
    ? reindent(printValue(value, { indent: column, keyOrder }), column, eol)
    : printValue(value, { indent: 0, compact: true, keyOrder });
  const at = multiline ? endWithComma(text, last.getEnd()) : last.getEnd();
  const needsComma = text[at - 1] !== ',';
  const sep = multiline ? eol + ' '.repeat(column) : ' ';
  // A multiline array keeps a trailing comma on every element, including the
  // one we just made last.
  const tail = multiline ? ',' : '';
  return {
    text: text.slice(0, at) + (needsComma ? ',' : '') + sep + printed + tail + text.slice(at),
  };
}

/** Add a brand-new top-level entry (a whole spot, monster, NPC…) to a registry. */
export function addEntry(
  fileName: string,
  text: string,
  rootName: string,
  key: string,
  value: unknown,
  keyOrderName?: string,
): EditResult {
  const sf = parse(fileName, text);
  const root = findRoot(sf, rootName);
  if (!root) throw new Error(`No exported const named ${rootName} in ${fileName}`);
  if (!ts.isObjectLiteralExpression(root)) throw new Error(`${rootName} is not an object literal`);
  if (propOf(root, key)) throw new Error(`${rootName} already has an entry '${key}'`);

  // NOT the column of `{` — a registry opens with
  // `export const NPCS: Record<string, NpcDef> = {`, whose brace sits at column
  // 44. Existing entries say where entries go; only an empty registry has to
  // fall back to the statement's own indentation.
  const inner =
    root.properties.length > 0
      ? columnOf(sf, root.properties[0].getStart(sf))
      : columnOf(sf, statementStart(sf, root)) + 2;
  const eol = eolOf(text);
  const printed = reindent(
    printValue(value, { indent: inner, keyOrder: keyOrderName ? KEY_ORDER[keyOrderName] : undefined }),
    inner,
    eol,
  );
  const line = `${printKey(key)}: ${printed},`;

  if (root.properties.length === 0) {
    const body = `{${eol}${' '.repeat(inner)}${line}${eol}${' '.repeat(inner - 2)}}`;
    return {
      text: text.slice(0, root.getStart(sf)) + body + text.slice(root.getEnd()),
      note: `add ${rootName}.${key}`,
    };
  }
  const last = root.properties[root.properties.length - 1];
  const at = endWithComma(text, last.getEnd());
  const needsComma = text[at - 1] !== ',';
  return {
    text:
      text.slice(0, at) + (needsComma ? ',' : '') + eol + ' '.repeat(inner) + line + text.slice(at),
    note: `add ${rootName}.${key}`,
  };
}

/**
 * Rename a registry entry in place: the key, and the `id` field that mirrors
 * it. Deliberately NOT delete-then-add — that would move the entry to the end
 * of the file and turn a rename into a diff nobody can read.
 *
 * Moving the references that point at it is the caller's job; this touches one
 * entry, and `findReferences` finds the rest.
 */
export function renameEntry(
  fileName: string,
  text: string,
  rootName: string,
  from: string,
  to: string,
): EditResult {
  const sf = parse(fileName, text);
  const root = findRoot(sf, rootName);
  if (!root) throw new Error(`No exported const named ${rootName} in ${fileName}`);
  if (!ts.isObjectLiteralExpression(root)) throw new Error(`${rootName} is not an object literal`);
  if (propOf(root, to)) throw new Error(`${rootName} already has an entry '${to}'`);
  const prop = propOf(root, from);
  if (!prop) throw new Error(`${rootName} has no entry '${from}'`);

  // Two edits in one entry, applied back to front so the first doesn't shift
  // the second's offsets.
  const edits: { start: number; end: number; text: string }[] = [
    { start: prop.name.getStart(sf), end: prop.name.getEnd(), text: printKey(to) },
  ];

  const value = unwrap(prop.initializer);
  if (ts.isObjectLiteralExpression(value)) {
    const idProp = propOf(value, 'id');
    const idValue = idProp && unwrap(idProp.initializer);
    if (idValue && ts.isStringLiteral(idValue) && idValue.text === from) {
      edits.push({ start: idValue.getStart(sf), end: idValue.getEnd(), text: printString(to) });
    }
  }

  let out = text;
  for (const e of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return { text: out, note: `rename ${rootName}.${from} → ${to}` };
}

/**
 * Move a registry entry so it sits immediately before or after a sibling.
 *
 * Region order in the world map IS key order in the data file, so reordering
 * the tabs means moving a property — which the printer must never be asked to
 * do, since reprinting a registry to reorder it would eat every comment in it.
 * So the entry is CUT as source text and spliced back in beside its new
 * neighbour: the only bytes that move are the ones the author wrote.
 *
 * `getFullStart()` is what makes that honest. It reaches back past the entry's
 * blank lines and `//` lines to the previous entry's comma, so a commented
 * entry travels with its commentary instead of leaving it stranded above
 * whatever moved up into its place.
 */
export function reorderEntry(
  fileName: string,
  text: string,
  rootName: string,
  key: string,
  anchor: string,
  before: boolean,
): EditResult {
  const sf = parse(fileName, text);
  const root = findRoot(sf, rootName);
  if (!root) throw new Error(`No exported const named ${rootName} in ${fileName}`);
  if (!ts.isObjectLiteralExpression(root)) throw new Error(`${rootName} is not an object literal`);

  const prop = propOf(root, key);
  if (!prop) throw new Error(`${rootName} has no entry '${key}'`);
  const anchorProp = propOf(root, anchor);
  if (!anchorProp) throw new Error(`${rootName} has no entry '${anchor}'`);
  if (key === anchor) return { text, note: `reorder ${rootName}.${key} (already there)` };

  // A registry written on one line has no tab strip to drag and no comments to
  // protect, and the splice below assumes entries own whole lines. Say so
  // rather than quietly turning `{ a: 1, b: 2 }` into `{ b: 2, a: 1, }`.
  if (!isMultiline(sf, root, text)) {
    throw new Error(`${rootName} is written on one line; reorder needs one entry per line`);
  }

  const from = prop.getFullStart();
  const to = endWithComma(text, prop.getEnd());
  const at = before ? anchorProp.getFullStart() : endWithComma(text, anchorProp.getEnd());

  // Dropping an entry back where it already sits: no edit, and no empty hunk
  // in the diff for the user to squint at.
  if (at === from || at === to) {
    return { text, note: `reorder ${rootName}.${key} (already there)` };
  }

  // The last entry in a registry may have been written without a trailing
  // comma; moving it inward would weld it to its new neighbour.
  let block = text.slice(from, to);
  if (!block.trimEnd().endsWith(',')) block += ',';

  const cut = text.slice(0, from) + text.slice(to);
  const insertAt = at > from ? at - (to - from) : at;
  const head = cut.slice(0, insertAt);
  const tail = cut.slice(insertAt);
  // Whatever now precedes the insertion point has to be able to take another
  // entry after it — the entry that used to be last can have lost its comma to
  // the cut above.
  const prev = head.trimEnd().slice(-1);
  return {
    text: head + (prev === ',' || prev === '{' ? '' : ',') + block + tail,
    note: `reorder ${rootName}.${key} ${before ? 'before' : 'after'} ${anchor}`,
  };
}

// ---------- Entry notes: forge-managed `// TODO:` / `// SPEC:` lines ----------

export type NoteMarker = 'TODO' | 'SPEC';

/**
 * A note is one `// TODO: ...` or `// SPEC: ...` comment sitting on its own
 * line directly above a registry entry. The forge owns EXACTLY these lines —
 * every other comment is hand-written documentation it must never touch, and
 * a trailing comment on the previous entry's line is that entry's business.
 */
const NOTE_RE = /^\/\/\s*(TODO|SPEC)\s*:?\s*(.*)$/i;

interface NoteRange {
  marker: NoteMarker;
  note: string;
  pos: number;
  end: number;
}

function noteRanges(text: string, prop: ts.Node): NoteRange[] {
  const out: NoteRange[] = [];
  for (const r of ts.getLeadingCommentRanges(text, prop.getFullStart()) ?? []) {
    if (r.kind !== ts.SyntaxKind.SingleLineCommentTrivia) continue;
    const lineStart = text.lastIndexOf('\n', r.pos - 1) + 1;
    if (text.slice(lineStart, r.pos).trim() !== '') continue;
    const m = NOTE_RE.exec(text.slice(r.pos, r.end));
    if (!m) continue;
    out.push({ marker: m[1].toUpperCase() as NoteMarker, note: m[2].trim(), pos: r.pos, end: r.end });
  }
  return out;
}

/** Every entry's TODO/SPEC notes, keyed by entry id. */
export function notesOf(
  fileName: string,
  text: string,
  rootName: string,
): Record<string, Partial<Record<NoteMarker, string>>> {
  const sf = parse(fileName, text);
  const root = findRoot(sf, rootName);
  if (!root || !ts.isObjectLiteralExpression(root)) return {};
  const out: Record<string, Partial<Record<NoteMarker, string>>> = {};
  for (const p of root.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    const name =
      ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : null;
    if (!name) continue;
    for (const r of noteRanges(text, p)) (out[name] ??= {})[r.marker] = r.note;
  }
  return out;
}

/** Set, rewrite, or (with `note: null`) remove one marker's line above an entry. */
export function setNoteAt(
  fileName: string,
  text: string,
  rootName: string,
  key: string,
  marker: NoteMarker,
  note: string | null,
): EditResult {
  const sf = parse(fileName, text);
  const root = findRoot(sf, rootName);
  if (!root) throw new Error(`No exported const named ${rootName} in ${fileName}`);
  if (!ts.isObjectLiteralExpression(root)) throw new Error(`${rootName} is not an object literal`);
  const prop = propOf(root, key);
  if (!prop) throw new Error(`${rootName} has no entry '${key}'`);

  // One line, always — a note with a line break in it would stop being one comment.
  const clean = note?.replace(/\s*\r?\n\s*/g, ' ').trim() || null;
  const existing = noteRanges(text, prop).find((r) => r.marker === marker);

  if (!clean) {
    if (!existing) return { text, note: `unnote ${rootName}.${key} ${marker} (nothing there)` };
    // The whole line goes: its indent, the comment, and the line break after.
    const lineStart = text.lastIndexOf('\n', existing.pos - 1) + 1;
    let end = existing.end;
    if (text[end] === '\r') end++;
    if (text[end] === '\n') end++;
    return { text: text.slice(0, lineStart) + text.slice(end), note: `unnote ${rootName}.${key} ${marker}` };
  }

  const line = `// ${marker}: ${clean}`;
  if (existing) {
    return {
      text: text.slice(0, existing.pos) + line + text.slice(existing.end),
      note: `note ${rootName}.${key} ${marker}`,
    };
  }
  const at = prop.getStart(sf);
  const column = columnOf(sf, at);
  return {
    text: text.slice(0, at) + line + eolOf(text) + ' '.repeat(column) + text.slice(at),
    note: `note ${rootName}.${key} ${marker}`,
  };
}

/** The exact source text of an entry — what the forge shows in "view source". */
export function sourceOf(
  fileName: string,
  text: string,
  rootName: string,
  path: PathStep[],
): string | null {
  const sf = parse(fileName, text);
  const root = findRoot(sf, rootName);
  if (!root) return null;
  try {
    const { node, prop } = resolve(root, path);
    if (!node) return null;
    const target = prop ?? node;
    return text.slice(target.getStart(sf), target.getEnd());
  } catch {
    return null;
  }
}
