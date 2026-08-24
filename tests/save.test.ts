import { describe, expect, it } from 'vitest';
import { createInitialState, SAVE_VERSION } from '../src/core/state';
import { Game } from '../src/core/game';
import { serialize, deserialize, loadFromStorage, clearStorage, SAVE_KEY } from '../src/core/save/save';
import { runOfflineProgress, OFFLINE_CAP_MS, OFFLINE_MIN_MS } from '../src/core/save/offline';
import { MS_PER_TICK } from '../src/core/engine/loop';
import { migrate } from '../src/core/save/migrations';
import { resourceLock } from '../src/core/systems/resources';
import { getDerivedStats } from '../src/core/systems/derived';
import { createItem } from '../src/core/systems/runes';

describe('save round-trip', () => {
  it('preserves progress and strips transient combat', () => {
    const g = new Game(createInitialState(99));
    g.state.spot = 'woods_edge';
    g.equip(1);
    g.selectActivity('hunt');
    for (let i = 0; i < 1500; i++) g.tick();

    const loaded = deserialize(serialize(g.state));
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.combat).toBeNull();
    expect(loaded.gold).toBe(g.state.gold);
    expect(loaded.attrs.str.level).toBe(g.state.attrs.str.level);
    expect(loaded.skills.fighting?.level).toBe(g.state.skills.fighting?.level);
    expect(loaded.equipment.weapon?.defId).toBe('rusty_sword');
    expect(loaded.spot).toBe('woods_edge');
    expect(loaded.activity).toBe('hunt');
  });

  /**
   * ⚠️ EQUIPMENT MUST NEVER BE DESTROYED BY SAVING.
   *
   * `state.combat` is transient and is dropped whole on serialize — and a
   * grounded or impaled weapon LIVES on it. Every path that ends a fight
   * recovers them (closeCombat → recoverGroundedWeapon); saving was not one of
   * those paths, so a Weapon Drop followed by a reload destroyed the weapon
   * outright. One of the very few ways a player could permanently lose gear.
   */
  describe('a fight never eats what it was holding', () => {
    /** A fight in progress with the wielded weapon parked in `slot`. */
    function fightHolding(slot: 'grounded' | 'impaled') {
      const g = new Game(createInitialState(7));
      g.state.spot = 'woods_edge';
      g.equip(1);
      g.selectActivity('hunt');
      for (let i = 0; i < 400 && !g.state.combat; i++) g.tick();
      expect(g.state.combat, 'needed a live fight to park a weapon in').toBeTruthy();
      const weapon = g.state.equipment.weapon!;
      delete g.state.equipment.weapon;
      g.state.combat![slot] = weapon;
      return { g, weapon };
    }

    /** Everywhere a saved game can legitimately be holding an item. */
    const owned = (s: ReturnType<typeof deserialize>) => [
      ...s.inventory,
      ...Object.values(s.equipment),
      ...(s.sheathed ? [s.sheathed] : []),
    ];

    for (const slot of ['grounded', 'impaled'] as const) {
      it(`gives back a ${slot} weapon across a save`, () => {
        const { g, weapon } = fightHolding(slot);
        const loaded = deserialize(serialize(g.state));
        expect(loaded.combat).toBeNull();
        expect(owned(loaded).some((i) => i.uid === weapon.uid)).toBe(true);
      });
    }

    it('puts it back in the empty hand, not the pack', () => {
      const { g, weapon } = fightHolding('grounded');
      const loaded = deserialize(serialize(g.state));
      expect(loaded.equipment.weapon?.uid).toBe(weapon.uid);
    });

    it('puts it in the pack when the hand has been filled since', () => {
      const { g, weapon } = fightHolding('grounded');
      // Picking up something else while yours lies in the dirt.
      const replacement = createItem(g.state, 'iron_sword');
      g.state.equipment.weapon = replacement;
      const loaded = deserialize(serialize(g.state));
      expect(loaded.equipment.weapon?.uid).toBe(replacement.uid);
      expect(loaded.inventory.some((i) => i.uid === weapon.uid)).toBe(true);
    });

    it('does not disturb the live game it was recording', () => {
      // An autosave fires every few seconds mid-fight. It must record the
      // weapon as recovered WITHOUT handing it back to a fight still using it.
      const { g, weapon } = fightHolding('grounded');
      serialize(g.state);
      expect(g.state.combat?.grounded?.uid).toBe(weapon.uid);
      expect(g.state.equipment.weapon).toBeUndefined();
      expect(g.state.inventory.some((i) => i.uid === weapon.uid)).toBe(false);
    });
  });

  it('folds the old named pools into the resource registry (v16 → v17)', () => {
    // A v16 save as it sat on disk: four loose fields and a stamina lockout.
    const v16: Record<string, unknown> = {
      ...createInitialState(7),
      version: 16,
      hp: 37,
      stamina: 4.5,
      mana: 2,
      spirit: 9,
      staminaLock: 'exhausted',
    };
    delete v16.resources;
    delete v16.resourceLocks;

    const migrated = migrate(v16, SAVE_VERSION);

    // The four named pools fold in untouched. Matched rather than compared
    // whole: later migrations add pools of their own, and this test is about
    // the FOLD, not the roster of resources that exists today.
    expect(migrated.resources).toMatchObject({ hp: 37, stamina: 4.5, mana: 2, spirit: 9 });
    // Focus (v31 → v32) joins full, the way every pool added since v9 has.
    expect(migrated.resources.focus).toBe(getDerivedStats(migrated).maxFocus);
    // 'exhausted' is the stamina-flavoured name for the generic empty lock.
    expect(resourceLock(migrated, 'stamina')).toBe('empty');
    // The old fields are gone, not shadowing the map.
    expect('hp' in migrated).toBe(false);
    expect('staminaLock' in migrated).toBe(false);
  });

  it('carries a winded v16 save across as a low lock', () => {
    const v16: Record<string, unknown> = {
      ...createInitialState(8),
      version: 16,
      hp: 10,
      stamina: 3,
      mana: 0,
      spirit: 1,
      staminaLock: 'winded',
    };
    expect(resourceLock(migrate(v16, SAVE_VERSION), 'stamina')).toBe('low');
  });

  it('rejects unknown future save versions cleanly', () => {
    const json = JSON.stringify({ ...createInitialState(1), version: SAVE_VERSION + 1 });
    // migrate loop only runs upward; a FUTURE version simply has no work to do.
    // (Downgrade protection is not a slice goal; just ensure no crash.)
    expect(() => deserialize(json)).not.toThrow();
  });
});

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

describe('load safety', () => {
  it('an unreadable save is stashed as a recovery copy, never silently dropped', () => {
    const storage = fakeStorage();
    storage.setItem(SAVE_KEY, '{"version": 2, "attrs": TRUNCATED GARBAGE');
    const result = loadFromStorage(storage);
    expect(result.state).toBeNull();
    expect(result.corrupted).toBe(true);
    const keys = [...Array(storage.length)].map((_, i) => storage.key(i));
    const recovery = keys.find((k) => k?.startsWith(`${SAVE_KEY}:recovery-`));
    expect(recovery).toBeDefined();
    expect(storage.getItem(recovery!)).toContain('TRUNCATED GARBAGE');
  });

  it('keeps a pre-migration backup when upgrading save versions', () => {
    const storage = fakeStorage();
    const v1 = createInitialState(1) as unknown as Record<string, unknown>;
    v1.version = 1;
    storage.setItem(SAVE_KEY, JSON.stringify(v1));
    const result = loadFromStorage(storage);
    expect(result.state?.version).toBe(SAVE_VERSION);
    expect(storage.getItem(`${SAVE_KEY}:backup-v1`)).toContain('"version":1');
  });

  it('missing save is not treated as corruption', () => {
    const result = loadFromStorage(fakeStorage());
    expect(result.state).toBeNull();
    expect(result.corrupted).toBe(false);
  });

  it('auto-heals: a recovery copy with more progress replaces a fresh impostor', () => {
    const storage = fakeStorage();
    const fresh = createInitialState(1);
    const real = createInitialState(2);
    real.totalTicks = 500000;
    real.gold = 99999;
    storage.setItem(SAVE_KEY, serialize(fresh));
    storage.setItem(`${SAVE_KEY}:recovery-123`, serialize(real));

    const result = loadFromStorage(storage);
    expect(result.healed).toBe(true);
    expect(result.state?.gold).toBe(99999);
    expect(result.state?.totalTicks).toBe(500000);
  });

  it('does not heal when the main slot has the most progress', () => {
    const storage = fakeStorage();
    const main = createInitialState(3);
    main.totalTicks = 900000;
    const older = createInitialState(4);
    older.totalTicks = 100;
    storage.setItem(SAVE_KEY, serialize(main));
    storage.setItem(`${SAVE_KEY}:recovery-456`, serialize(older));

    const result = loadFromStorage(storage);
    expect(result.healed).toBeUndefined();
    expect(result.state?.totalTicks).toBe(900000);
  });

  it('hard reset wipes recovery/backup copies so healing cannot resurrect them', () => {
    const storage = fakeStorage();
    const real = createInitialState(5);
    real.totalTicks = 500000;
    storage.setItem(SAVE_KEY, serialize(real));
    storage.setItem(`${SAVE_KEY}:recovery-789`, serialize(real));
    storage.setItem(`${SAVE_KEY}:backup-v3`, serialize(real));
    storage.setItem('unrelated-key', 'survives');

    clearStorage(storage);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    expect(storage.getItem(`${SAVE_KEY}:recovery-789`)).toBeNull();
    expect(storage.getItem(`${SAVE_KEY}:backup-v3`)).toBeNull();
    expect(storage.getItem('unrelated-key')).toBe('survives');

    // Fresh start after reset must not heal into anything.
    storage.setItem(SAVE_KEY, serialize(createInitialState(6)));
    expect(loadFromStorage(storage).healed).toBeUndefined();
  });
});

describe('offline progress', () => {
  it('returns null for short absences', () => {
    const g = new Game(createInitialState(5));
    expect(runOfflineProgress(g, OFFLINE_MIN_MS - 1)).toBeNull();
  });

  it('simulates training progress while away, silently', () => {
    const g = new Game(createInitialState(5));
    g.state.spot = 'training_grounds';
    g.selectActivity('train_str');
    const logLen = g.state.log.length;

    const summary = runOfflineProgress(g, 10 * 60 * 1000); // 10 minutes
    expect(summary).not.toBeNull();
    expect(summary!.ticks).toBe(Math.floor((10 * 60 * 1000) / MS_PER_TICK));
    expect(summary!.attrLevels.find((a) => a.attr === 'str')?.gained).toBeGreaterThan(0);
    expect(g.state.log.length).toBe(logLen); // nothing logged during catch-up
  });

  // Simulates the full 8-hour cap — 288,000 real ticks — so it sits close to
  // vitest's 5s default on an ordinary machine and tips over it whenever the
  // suite runs loaded. The work is the point of the test, so give it room
  // rather than shrinking the absence it is checking.
  it('caps very long absences at 8 hours', () => {
    const g = new Game(createInitialState(5));
    g.state.spot = 'training_grounds';
    g.selectActivity('train_con');
    const summary = runOfflineProgress(g, 48 * 60 * 60 * 1000);
    expect(summary!.capped).toBe(true);
    expect(summary!.ticks).toBe(Math.floor(OFFLINE_CAP_MS / MS_PER_TICK));
  }, 30_000);
});
