import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { ITEMS } from '../src/core/registry';
import { getDerivedStats } from '../src/core/systems/derived';
import {
  createItem,
  rollRuneSlots,
  runeClassOf,
  socketRune,
  unsocketRune,
  weaponRuneBonuses,
} from '../src/core/systems/runes';
import { damageVsMonster } from '../src/core/systems/combat';
import { migrate } from '../src/core/save/migrations';
import type { ItemInstance } from '../src/core/types';

describe('rune slot generation', () => {
  it('rolls 0–4 slots, small gear averaging fewer than large gear', () => {
    const s = createInitialState(90);
    const dagger = ITEMS['iron_dagger'];
    const chest = ITEMS['iron_breastplate'] ?? ITEMS['leather_vest'];
    expect(runeClassOf(dagger)).toBe('small');

    let smallTotal = 0;
    let largeTotal = 0;
    const N = 300;
    for (let i = 0; i < N; i++) {
      const a = rollRuneSlots(s, dagger);
      const b = rollRuneSlots(s, chest);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(4);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(4);
      smallTotal += a;
      largeTotal += b;
    }
    expect(smallTotal / N).toBeLessThan(largeTotal / N);
  });

  it('createItem mints instances with rolled slots and an empty rune list', () => {
    const s = createInitialState(91);
    const item = createItem(s, 'steel_greatsword');
    expect(item.slots).toBeGreaterThanOrEqual(0);
    expect(item.slots).toBeLessThanOrEqual(4);
    expect(item.runes).toEqual([]);
    expect(runeClassOf(ITEMS['steel_greatsword'])).toBe('large');
  });
});

describe('socketing', () => {
  function gameWith(item: Partial<ItemInstance> & { defId: string }): Game {
    const g = new Game(createInitialState(92));
    g.state.inventory.push({ uid: 500, slots: 2, runes: [], ...item });
    return g;
  }

  it('sockets owned runes into free slots and refuses beyond capacity', () => {
    const g = gameWith({ defId: 'iron_sword' });
    g.state.runes['minor_rune_might'] = 2;
    expect(socketRune(g.state, g.bus, 500, 'minor_rune_might')).toBe(true);
    expect(socketRune(g.state, g.bus, 500, 'minor_rune_might')).toBe(true);
    expect(socketRune(g.state, g.bus, 500, 'minor_rune_might')).toBe(false); // slots full
    expect(g.state.runes['minor_rune_might']).toBeUndefined(); // pool exhausted
  });

  it('refuses unowned runes; unsocketing returns the rune to the pool', () => {
    const g = gameWith({ defId: 'iron_sword' });
    expect(socketRune(g.state, g.bus, 500, 'minor_rune_might')).toBe(false);

    g.state.runes['rune_swiftness'] = 1;
    socketRune(g.state, g.bus, 500, 'rune_swiftness');
    expect(unsocketRune(g.state, g.bus, 500, 0)).toBe(true);
    expect(g.state.runes['rune_swiftness']).toBe(1);
    expect(g.state.inventory.find((i) => i.uid === 500)!.runes).toEqual([]);
  });

  it('the same rune grants context-dependent effects: weapon vs chest', () => {
    const g = new Game(createInitialState(93));
    const before = getDerivedStats(g.state);

    // Minor Rune of Might in a WEAPON: +4 damage.
    g.state.equipment.weapon = { uid: 600, defId: 'iron_sword', slots: 1, runes: ['minor_rune_might'] };
    const withWeaponRune = getDerivedStats(g.state);
    const swordMods = ITEMS['iron_sword'].mods
      .filter((m) => m.stat === 'damage' && m.op === 'add')
      .reduce((s, m) => s + m.value, 0);
    expect(withWeaponRune.damage).toBeCloseTo(before.damage + swordMods + 4, 5);

    // Same rune in CHEST armor: +2 armor, no damage change.
    delete g.state.equipment.weapon;
    g.state.equipment.chest = { uid: 601, defId: 'leather_vest', slots: 1, runes: ['minor_rune_might'] };
    const vestArmor = ITEMS['leather_vest'].mods
      .filter((m) => m.stat === 'armor' && m.op === 'add')
      .reduce((s, m) => s + m.value, 0);
    expect(getDerivedStats(g.state).armor).toBeCloseTo(before.armor + vestArmor + 2, 5);
  });

  it('thunder runes add typed on-hit damage from the weapon', () => {
    const g = new Game(createInitialState(94));
    g.state.equipment.weapon = {
      uid: 602, defId: 'iron_sword', slots: 2,
      runes: ['minor_rune_thunder', 'greater_rune_thunder'],
    };
    const bonuses = weaponRuneBonuses(g.state);
    // Each rider names the rune it came from, so damage tooltips can credit it.
    expect(bonuses.flat).toEqual([
      { type: 'lightning', value: 3, source: 'Minor Rune of Thunder' },
    ]);
    expect(bonuses.pct).toEqual([
      { type: 'lightning', value: 0.12, source: 'Greater Rune of Thunder' },
    ]);
    // Lightning is a real damage type monsters can resist.
    expect(damageVsMonster('wolf', 'lightning', 10)).toBe(10);
  });

  it('selling a socketed item returns its runes to the pool', () => {
    const g = gameWith({ defId: 'iron_sword', runes: ['minor_rune_frost'] });
    g.sell(500);
    expect(g.state.runes['minor_rune_frost']).toBe(1);
  });
});

describe('save migration v7 → v8', () => {
  it('backfills slots by size class and adds the rune pool', () => {
    const raw = {
      version: 7,
      inventory: [{ uid: 1, defId: 'iron_dagger' }],
      equipment: { chest: { uid: 2, defId: 'leather_vest' } },
    } as Record<string, unknown>;
    migrate(raw, 8);
    expect(raw.runes).toEqual({});
    const inv = raw.inventory as ItemInstance[];
    expect(inv[0].slots).toBe(1); // small median
    const eq = raw.equipment as Record<string, ItemInstance>;
    expect(eq.chest.slots).toBe(2); // large median
    expect(raw.version).toBe(8);
  });
});
