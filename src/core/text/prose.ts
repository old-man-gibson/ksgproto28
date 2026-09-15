/**
 * Player-facing prose lives in `src/core/text/*.text.ts`, one file per data
 * file, and is stitched onto the data entries here at module load.
 *
 * Why: descriptions and dialogue are edited far more often than mechanics, and
 * the person editing them should not have to find them inside a 2000-line
 * mechanics file. The data files keep the numbers; the text files keep the
 * words. Every consumer still reads `entry.desc` — it is set before any
 * importer runs, because `prose()` is called in the data file's own
 * initializer.
 *
 * Keys are dotted paths from the entry: `warden_of_the_foot.desc`,
 * `faces_of_threshold.objectives.0.desc`, `f1_storerooms.finds.strongbox.desc`.
 * An array step is a numeric index, or the element's `id` when it has one.
 *
 * `PROSE_ORPHANS` collects keys that resolve to nothing. The game keeps running
 * (a stray key must not brick a save); `tests/prose.test.ts` asserts the list
 * is empty, and the forge validator surfaces it.
 */

export type ProseKey = 'desc' | 'dialogue' | 'hint';

/** One text file's table: dotted path → string, or a string array for dialogue. */
export type ProseTable = Record<string, string | string[]>;

/**
 * A data entry as written in `*.data.ts`: the prose fields are optional at every
 * depth, because they are filled in from the text table. Functions and
 * primitives pass through untouched.
 */
export type Authored<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? Authored<U>[]
    : T extends object
      ? { [K in keyof T as K extends ProseKey ? never : K]: Authored<T[K]> } & {
          [K in keyof T as K extends ProseKey ? K : never]?: Authored<T[K]>;
        }
      : T;

export interface ProseOrphan {
  table: string;
  key: string;
  reason: string;
}

/** Keys in a text table that named no entry. Empty in a healthy build. */
export const PROSE_ORPHANS: ProseOrphan[] = [];

/** Every table applied so far, so a test can walk them all. */
export const PROSE_TABLES: { label: string; root: unknown; table: ProseTable }[] = [];

function stepInto(current: unknown, step: string): unknown {
  if (current === null || typeof current !== 'object') return undefined;
  if (Array.isArray(current)) {
    if (/^\d+$/.test(step)) return current[Number(step)];
    return current.find((e) => e && typeof e === 'object' && (e as { id?: unknown }).id === step);
  }
  return (current as Record<string, unknown>)[step];
}

function apply(label: string, root: unknown, table: ProseTable): void {
  PROSE_TABLES.push({ label, root, table });
  for (const [key, value] of Object.entries(table)) {
    const parts = key.split('.');
    const field = parts[parts.length - 1];
    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      current = stepInto(current, parts[i]);
      if (current === undefined) break;
    }
    if (current === null || typeof current !== 'object') {
      PROSE_ORPHANS.push({ table: label, key, reason: 'no entry at that path' });
      continue;
    }
    if (field !== 'desc' && field !== 'dialogue' && field !== 'hint') {
      PROSE_ORPHANS.push({ table: label, key, reason: `'${field}' is not a prose field` });
      continue;
    }
    (current as Record<string, unknown>)[field] = value;
  }
}

/** Attach a text table to a keyed registry. Returns the same object, fully typed. */
export function prose<T, K extends string = string>(
  label: string,
  table: ProseTable,
  raw: Record<K, Authored<T>>,
): Record<K, T> {
  apply(label, raw, table);
  return raw as unknown as Record<K, T>;
}

/** Attach a text table to a list registry (keyed by element `id`, or index). */
export function proseList<T>(label: string, table: ProseTable, raw: Authored<T>[]): T[] {
  apply(label, raw, table);
  return raw as unknown as T[];
}
