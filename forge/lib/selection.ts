/** What the map has selected, and therefore what the inspector shows. */
export type Selection =
  | { type: 'spot'; id: string }
  /** A DECLARED connection: the one written on `from`, not its mirror. */
  | { type: 'edge'; from: string; to: string }
  | { type: 'npc'; id: string }
  | { type: 'find'; spot: string; find: string }
  | null;

export function sameSelection(a: Selection, b: Selection): boolean {
  if (a === null || b === null) return a === b;
  if (a.type !== b.type) return false;
  if (a.type === 'edge' && b.type === 'edge') return a.from === b.from && a.to === b.to;
  if (a.type === 'find' && b.type === 'find') return a.spot === b.spot && a.find === b.find;
  if ((a.type === 'spot' || a.type === 'npc') && (b.type === 'spot' || b.type === 'npc')) {
    return a.id === b.id;
  }
  return false;
}
