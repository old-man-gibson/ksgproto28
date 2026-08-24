/**
 * Read a TypeScript object literal — the form the data files are written in —
 * back into a value.
 *
 * The forge's benches hand you source text to paste into `monsters.data.ts`:
 * `{ school: 'psionic', shape: { force: 6, speed: 4 } }`. That is not JSON —
 * bare keys, single quotes, trailing commas, `143_000` — so pasting it into an
 * editor field meant retyping it field by field. This closes that loop: the
 * same text a bench copies can be pasted straight into a list.
 *
 * Deliberately narrow. It reads the shapes CONTENT is written in — objects,
 * arrays, strings, numbers, booleans, null — and nothing else. No expressions,
 * no identifiers, no function calls. Anything cleverer belongs in the data
 * file, typed, where the compiler can see it.
 */

export type LiteralResult = { ok: true; value: unknown } | { ok: false; error: string };

/**
 * Strip comments and normalise to JSON, string contents left strictly alone —
 * a `desc` may legitimately contain braces, commas and apostrophes, and a
 * naive pass over the whole text would rewrite them.
 */
function toJson(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];

    // ----- strings: copy verbatim, converting the quoting style only -----
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      let body = '';
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') {
          body += src[i] + (src[i + 1] ?? '');
          i += 2;
          continue;
        }
        body += src[i];
        i++;
      }
      i++; // closing quote
      // Re-escape for a JSON double-quoted string. An apostrophe inside a
      // single-quoted literal arrives escaped (\'), and JSON has no such
      // escape, so it has to come back out.
      const json = body
        .replace(/\\'/g, "'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n');
      out += `"${json}"`;
      continue;
    }

    // ----- comments -----
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    // ----- numeric separators: 143_000 -----
    if (c === '_' && /[0-9]/.test(src[i - 1] ?? '') && /[0-9]/.test(src[i + 1] ?? '')) {
      i++;
      continue;
    }

    out += c;
    i++;
  }

  // Bare keys -> quoted keys. Safe now that strings are already normalised.
  out = out.replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":');
  // Trailing commas before a close.
  out = out.replace(/,(\s*[}\]])/g, '$1');
  return out;
}

export function parseLiteral(text: string): LiteralResult {
  const trimmed = text.trim().replace(/;+$/, '');
  if (!trimmed) return { ok: false, error: 'Nothing to paste.' };
  try {
    return { ok: true, value: JSON.parse(toJson(trimmed)) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** The same, refusing anything that is not a plain object. */
export function parseObjectLiteral(text: string): LiteralResult {
  const read = parseLiteral(text);
  if (!read.ok) return read;
  if (!read.value || typeof read.value !== 'object' || Array.isArray(read.value)) {
    return { ok: false, error: 'That is not an object — a list item has to be `{ … }`.' };
  }
  return read;
}
