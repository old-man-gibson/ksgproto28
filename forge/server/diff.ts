/**
 * A small line diff, so the forge can show exactly what it is about to write
 * before it writes it. There is no git in this repo — "preview, then apply" is
 * the whole safety net, so it has to be legible.
 */

export interface DiffLine {
  kind: 'ctx' | 'add' | 'del';
  text: string;
  /** 1-based line number in the old file (del/ctx) or new file (add). */
  n: number;
}

export interface Hunk {
  oldStart: number;
  newStart: number;
  lines: DiffLine[];
}

/** Longest common subsequence over lines, as a list of matched index pairs. */
function lcs(a: string[], b: string[]): [number, number][] {
  // Trim the common head and tail first — data-file edits are tiny and local,
  // so this turns an O(n²) table over 1200 lines into one over a handful.
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) {
    tail++;
  }

  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);
  const pairs: [number, number][] = [];
  for (let i = 0; i < head; i++) pairs.push([i, i]);

  const n = midA.length;
  const m = midB.length;
  if (n > 0 && m > 0) {
    const table: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i][j] = midA[i] === midB[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        pairs.push([head + i, head + j]);
        i++;
        j++;
      } else if (table[i + 1][j] >= table[i][j + 1]) i++;
      else j++;
    }
  }

  for (let k = 0; k < tail; k++) pairs.push([a.length - tail + k, b.length - tail + k]);
  return pairs;
}

/** Unified-style hunks with `context` lines of surrounding context. */
export function diffLines(before: string, after: string, context = 3): Hunk[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const matched = lcs(a, b);

  const all: DiffLine[] = [];
  let ai = 0;
  let bi = 0;
  const flushTo = (ta: number, tb: number) => {
    while (ai < ta) all.push({ kind: 'del', text: a[ai], n: ++ai });
    while (bi < tb) all.push({ kind: 'add', text: b[bi], n: ++bi });
  };
  for (const [ma, mb] of matched) {
    flushTo(ma, mb);
    all.push({ kind: 'ctx', text: a[ma], n: ma + 1 });
    ai = ma + 1;
    bi = mb + 1;
  }
  flushTo(a.length, b.length);

  // Group changes into hunks, keeping `context` context lines on each side.
  const hunks: Hunk[] = [];
  let current: DiffLine[] = [];
  let pending: DiffLine[] = [];
  let quiet = 0;

  const close = () => {
    if (current.length === 0) return;
    const first = current[0];
    hunks.push({ oldStart: first.n, newStart: first.n, lines: current });
    current = [];
  };

  for (const line of all) {
    if (line.kind === 'ctx') {
      if (current.length === 0) {
        pending.push(line);
        if (pending.length > context) pending.shift();
      } else {
        current.push(line);
        if (++quiet > context * 2) {
          current = current.slice(0, current.length - context);
          close();
          quiet = 0;
          pending = [];
        }
      }
    } else {
      if (current.length === 0) {
        current = [...pending];
        pending = [];
      }
      current.push(line);
      quiet = 0;
    }
  }
  if (quiet > context) current = current.slice(0, current.length - (quiet - context));
  close();
  return hunks;
}

/** Compact "+3 −1" summary for a change list. */
export function diffStat(hunks: Hunk[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const h of hunks) {
    for (const l of h.lines) {
      if (l.kind === 'add') added++;
      else if (l.kind === 'del') removed++;
    }
  }
  return { added, removed };
}
