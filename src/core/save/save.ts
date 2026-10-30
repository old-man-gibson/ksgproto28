import type { GameState } from '../types';
import { createInitialState, SAVE_VERSION } from '../state';
import { migrate } from './migrations';
import { SPOTS, STARTING_SPOT } from '../registry';
import { spotActivities } from '../systems/actions';
import { normalizeComposition } from '../systems/music';
import { reclaimedForSave } from '../systems/martial';
import { woundsForSave } from '../systems/combat';
import { transcriptForSave } from '../systems/log';
import { revealMapped } from '../systems/mapped';

export const SAVE_KEY = 'ksgproto28:save';

/** Activity ids that changed name across versions. */
const LEGACY_ACTIVITY_RENAMES: Record<string, string> = {
  train_wil: 'train_wis',
};

/**
 * Combat and its feed are transient; hunting re-engages after load. A pause is
 * transient too, and deliberately so: it exists to study a live fight, and the
 * fight itself does not survive a save. Writing it as `false` also means the
 * autosaves that keep running while paused move `lastSaved` forward — so the
 * offline catch-up on the next boot credits only time the tab was actually
 * closed, never the hours the world sat frozen in front of the player.
 */
export function serialize(state: GameState, now = Date.now()): string {
  const snapshot: GameState = {
    ...state,
    // ⚠️ ANYTHING THE FIGHT IS HOLDING COMES HOME FIRST. `combat` is dropped
    // whole on the next line, and a grounded or impaled weapon lives on it — so
    // saving mid-fight after a Weapon Drop or an Impaling Thrust used to
    // destroy the weapon outright, one of the very few ways equipment could be
    // permanently lost. Every path that ENDS a fight recovers them
    // (closeCombat); saving is not one of those paths and had to be taught.
    ...reclaimedForSave(state),
    // Likewise a monster that keeps its wounds (MonsterDef.keepsWounds): the
    // save records the fight as walked away from, which is what reloading does.
    ...woundsForSave(state),
    combat: null,
    combatFeed: [],
    floatingFeed: [],
    // The tally in progress goes with the fight it belongs to; the last
    // FINISHED one is kept, so closing the tab after a knockout does not lose
    // the explanation for it.
    fight: null,
    // The working behind a blow is a live tooltip, not a record — see
    // `transcriptForSave`. Both surfaces that keep a transcript are stripped
    // here, at the one boundary where the cost is actually paid.
    lastFight: state.lastFight
      ? { ...state.lastFight, transcript: transcriptForSave(state.lastFight.transcript) }
      : null,
    notebook: state.notebook.map((n) => ({
      ...n,
      ledger: { ...n.ledger, transcript: transcriptForSave(n.ledger.transcript) },
    })),
    paused: false,
    lastSaved: now,
  };
  return JSON.stringify(snapshot);
}

export function deserialize(json: string): GameState {
  const raw = JSON.parse(json) as Record<string, unknown>;
  const migrated = migrate(raw, SAVE_VERSION);
  // Backfill any newly-added fields defensively, then keep saved values.
  // Combat and its feed never survive a load, whatever an old save happens to
  // hold — the feed's shape has changed since, and it is transient anyway.
  const state: GameState = {
    ...createInitialState(),
    ...migrated,
    combat: null,
    combatFeed: [],
    floatingFeed: [],
    fight: null,
    paused: false,
  };
  // Content may have been renamed/removed between versions — never load
  // references to things that no longer exist.
  const spot = SPOTS[state.spot] ?? SPOTS[STARTING_SPOT];
  state.spot = spot.id;
  // Mapped regions have no fog; this also covers town spots added since.
  revealMapped(state);
  if (state.activity) {
    const remapped = LEGACY_ACTIVITY_RENAMES[state.activity] ?? state.activity;
    state.activity = spotActivities(spot).some((a) => a.id === remapped) ? remapped : null;
  }
  // Sheets are healed, not trusted: a save written mid-hot-reload (or by a
  // future retuned notation) may hold notes that resolve to nothing, and one
  // NaN pitch is enough to take the whole staff down (see normalizeComposition).
  state.compositions = (Array.isArray(state.compositions) ? state.compositions : []).map(
    normalizeComposition,
  );
  if (
    state.performance &&
    !state.compositions.some((c) => c.id === state.performance!.compositionId)
  ) {
    state.performance = null;
  }
  return state;
}

export function saveToStorage(state: GameState, storage: Pick<Storage, 'setItem'> = localStorage): void {
  const now = Date.now();
  storage.setItem(SAVE_KEY, serialize(state, now));
  state.lastSaved = now;
}

export interface LoadResult {
  state: GameState | null;
  /** True when a save existed but could not be read (recovery copy was kept). */
  corrupted: boolean;
  /** True when a recovery copy with more progress replaced the main slot. */
  healed?: boolean;
}

/**
 * Load the save. A save that exists but fails to parse is NEVER discarded
 * silently — the raw payload is stashed under a recovery key first, so a
 * subsequent fresh-game autosave cannot destroy the player's progress.
 * A pre-migration backup is kept whenever the version is upgraded.
 *
 * Auto-heal: if a load failure ever let a fresh game overwrite the main slot,
 * a recovery copy with far more progress will be sitting next to it. When the
 * code can parse that copy again (e.g. after the transient bug is fixed), it
 * is restored automatically instead of the impostor.
 */
export function loadFromStorage(storage: Storage = localStorage): LoadResult {
  const json = storage.getItem(SAVE_KEY);
  if (!json) return { state: null, corrupted: false };
  try {
    const version = (JSON.parse(json) as { version?: number }).version ?? 1;
    if (version < SAVE_VERSION) {
      storage.setItem(`${SAVE_KEY}:backup-v${version}`, json);
    }
    const state = deserialize(json);
    const recovered = bestRecoveryCopy(storage, state);
    if (recovered) return { state: recovered, corrupted: false, healed: true };
    return { state, corrupted: false };
  } catch (err) {
    console.error('Failed to load save; keeping a recovery copy:', err);
    stashRecoveryCopy(json, storage);
    return { state: null, corrupted: true };
  }
}

/**
 * "More progress", for the heal: prestiges first, then ticks. A prestige
 * legitimately drops `totalTicks` to a newborn's, so on ticks alone any
 * recovery copy from the run just ended would resurrect it on the next
 * boot and undo the prestige — seen live 2026-09-12.
 */
function moreProgress(a: GameState, b: GameState): boolean {
  if (a.prestige.count !== b.prestige.count) return a.prestige.count > b.prestige.count;
  return a.totalTicks > b.totalTicks;
}

/** The parseable recovery copy with the most progress, if it beats the main slot. */
function bestRecoveryCopy(storage: Storage, main: GameState): GameState | null {
  let best: GameState | null = null;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(`${SAVE_KEY}:recovery-`)) continue;
    try {
      const candidate = deserialize(storage.getItem(key)!);
      if (moreProgress(candidate, main) && (!best || moreProgress(candidate, best))) {
        best = candidate;
      }
    } catch {
      // Still unreadable under current code — leave it for a future version.
    }
  }
  return best;
}

const RECOVERY_KEEP = 3;

function stashRecoveryCopy(json: string, storage: Storage): void {
  try {
    storage.setItem(`${SAVE_KEY}:recovery-${Date.now()}`, json);
    // Keep only the newest few recovery copies.
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k?.startsWith(`${SAVE_KEY}:recovery-`)) keys.push(k);
    }
    keys.sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - RECOVERY_KEEP))) {
      storage.removeItem(k);
    }
  } catch {
    // Storage full or unavailable — nothing more we can do.
  }
}

/**
 * Hard reset: wipe the save AND all recovery/backup copies — a deliberate
 * reset must not be undone by the auto-heal on next boot.
 */
export function clearStorage(storage: Storage = localStorage): void {
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key === SAVE_KEY || key?.startsWith(`${SAVE_KEY}:`)) doomed.push(key);
  }
  for (const key of doomed) storage.removeItem(key);
}
