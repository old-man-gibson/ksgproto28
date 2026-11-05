/**
 * The art pack hint (docs/ART_PACK.md): one localStorage key, `"1"` while this
 * browser holds a stored pack. IndexedDB can only be asked asynchronously, and
 * a layout that depends on the answer would change after the first paint (the
 * map is drawn as tiles or as a diagram). The hint is read synchronously at
 * startup, so the first paint already has the final layout.
 *
 * It is a guess, not the truth: the IndexedDB manifest is. The two disagree
 * when site data is cleared on one side only; the startup read of the manifest
 * rewrites the hint to match.
 *
 * The key sits outside the save's `ksgproto28:save` prefix, which is the only
 * prefix the save code reads, backs up, recovers or clears (core/save/save.ts),
 * so a hard reset keeps it, as it keeps the pack. Every access is wrapped:
 * storage can be absent or throw.
 */
export const PACK_HINT_KEY = 'frontier-idle-art-pack';

export type HintStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** This page's localStorage, or null where it has none or refuses access. */
export function browserHintStore(): HintStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** True when the hint says a pack is stored. False without storage. */
export function readPackHint(store: HintStore | null): boolean {
  try {
    return store?.getItem(PACK_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

/** Set the hint (a pack is stored) or remove it (none is). Failures are ignored. */
export function writePackHint(store: HintStore | null, stored: boolean): void {
  try {
    if (stored) store?.setItem(PACK_HINT_KEY, '1');
    else store?.removeItem(PACK_HINT_KEY);
  } catch {
    // Full or blocked: the next startup read of the manifest tries again.
  }
}
