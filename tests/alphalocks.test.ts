import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { MONSTERS, SPOTS } from '../src/core/registry';
import { MIGRATIONS } from '../src/core/save/migrations';
import { subsystemUnlocked, unlockKey } from '../src/core/systems/unlocks';
import { visibleBenches } from '../src/ui/lib/navigation';
import { getDerivedStats } from '../src/core/systems/derived';
import { REFERENCE_BLOW, attackSeconds, expectedHitTaken, roughDps } from '../src/ui/lib/statSummary';
import type { DropTable, SpotEncounter } from '../src/core/types';

describe('alpha shutters, save v55', () => {
  it('a new game opens with the martial planner and the kitchen side-benches shut', () => {
    const s = createInitialState(1);
    expect(subsystemUnlocked(s, 'martial')).toBe(false);
    expect(subsystemUnlocked(s, 'prep')).toBe(false);
    expect(visibleBenches(s, SPOTS.granary_kitchens)).toEqual(['cooking']);
    expect(visibleBenches(s, SPOTS.the_alembics)).toEqual(['alchemy']);
    expect(visibleBenches(s, SPOTS.the_forges)).toEqual([]);
    s.stats[unlockKey('prep')] = 1;
    expect(visibleBenches(s, SPOTS.granary_kitchens)).toEqual(['cooking', 'preparing']);
  });

  it('an older save keeps both open: it has had them', () => {
    const raw: Record<string, unknown> = { version: 54, stats: {} };
    MIGRATIONS[54](raw);
    const stats = raw.stats as Record<string, number>;
    expect(stats['flag:unlock_martial']).toBe(1);
    expect(stats['flag:unlock_prep']).toBe(1);
    expect(raw.version).toBe(55);
  });
});

describe('runes ride the runecarving shutter', () => {
  const goblin = MONSTERS.goblin;
  const realLoot = goblin.loot;
  const realTable = SPOTS.the_cages.encounters;
  afterEach(() => {
    goblin.loot = realLoot;
    SPOTS.the_cages.encounters = realTable;
  });

  /** Win one cage fight against a goblin whose only loot is a rune. */
  function killOne(open: boolean) {
    goblin.loot = { rolls: 1, entries: [{ kind: 'rune', id: 'minor_rune_might', weight: 1 }] } as DropTable;
    SPOTS.the_cages.encounters = [{ monsterId: 'goblin', weight: 1, level: [1, 1] }] as SpotEncounter[];
    const g = new Game(createInitialState(4));
    g.state.attrs.str.level = 30;
    g.state.attrs.con.level = 30;
    if (open) g.state.stats[unlockKey('runecarving')] = 1;
    g.state.spot = 'the_cages';
    g.selectActivity('hunt');
    for (let i = 0; i < 3000 && !(g.state.stats['kills:goblin'] ?? 0); i++) g.tick();
    expect(g.state.stats['kills:goblin']).toBe(1);
    return Object.values(g.state.runes).reduce((n, q) => n + q, 0);
  }

  it('a rune that comes up while runecarving is shut pays nothing', () => {
    expect(killOne(false)).toBe(0);
  });

  it('the same drop pays once runecarving is open', () => {
    expect(killOne(true)).toBe(1);
  });
});

describe('stat group summaries', () => {
  it('rough DPS is damage × crit bonus ÷ attack time', () => {
    const stats = { ...getDerivedStats(createInitialState(1)) };
    stats.crit = 0;
    const plain = roughDps(stats);
    expect(plain).toBeCloseTo(stats.damage / attackSeconds(stats), 6);
    stats.crit = 0.5;
    stats.critDamage = 2;
    expect(roughDps(stats)).toBeCloseTo(plain * 1.5, 6);
  });

  it('expected hit taken goes through dodge, parry and armour', () => {
    const stats = { ...getDerivedStats(createInitialState(1)), dodge: 0, parry: 0, armor: 0, ward: 0, damageTaken: 1 };
    const bare = expectedHitTaken(stats);
    expect(bare).toBeCloseTo(REFERENCE_BLOW * (1 - (stats.resSlashing + stats.resPiercing + stats.resBludgeoning) / 3), 0);
    expect(expectedHitTaken({ ...stats, dodge: 0.5 })).toBeCloseTo(bare / 2, 6);
    expect(expectedHitTaken({ ...stats, armor: 5 })).toBeLessThan(bare);
  });
});
