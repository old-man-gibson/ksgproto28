/**
 * The one rename flow both id fields share (the browser header and the spot
 * inspector): validate the new id, show the blast radius, then stage the move
 * — entry plus every reference — through `store.rename`.
 */

import { store } from './store.svelte';
import { idProblem } from './validate';

/**
 * Returns the new id when the rename was staged, null when it was refused or
 * the user backed out. Nothing touches disk here — the batch still faces the
 * diff review and the `.forge-backups` copy like any other edit.
 */
export function requestRename(kind: string, from: string, raw: string): string | null {
  const next = raw.trim();
  if (next === from) return null;
  const problem = idProblem(store, kind, next);
  if (problem) {
    store.say(problem, 'bad');
    return null;
  }
  const sites = store.references(kind, from);
  if (sites.length > 0) {
    const lines = sites.slice(0, 8).map((r) => `  ${r.kind} ${r.id} — ${r.path.join('.')}`);
    if (sites.length > 8) lines.push(`  …and ${sites.length - 8} more`);
    const question = [
      `Rename ${from} → ${next}?`,
      '',
      `${sites.length} reference(s) move with it:`,
      ...lines,
      '',
      'Staged, not written — review the diff before applying.',
    ].join('\n');
    if (!window.confirm(question)) return null;
  }
  const moved = store.rename(kind, from, next);
  store.say(
    moved.length ? `Renamed to ${next}, moved ${moved.length} reference(s)` : `Renamed to ${next}`,
    'ok',
  );
  return next;
}
