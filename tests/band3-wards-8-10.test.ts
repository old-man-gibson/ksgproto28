import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { FLOORS, MONSTERS, SPOTS } from '../src/core/registry';
import { eligibleEncounters, spawnGroup, spawnMonster, spotCleared, tickCombat } from '../src/core/systems/combat';
import { applyStatus } from '../src/core/systems/statuses';
import { floorCleared } from '../src/core/systems/towers';
import { getDerivedStats } from '../src/core/systems/derived';
import { monsterTagSet } from '../src/core/systems/bestiary';
import { baseMonsterAttrs, innateArmor, innateResistances, statsFromAttrs } from '../src/core/systems/monsterStats';
import type { MonsterInstance } from '../src/core/types';
import { clearFloors } from './fixtures/floors';

/**
 * Wards 8 to 10 of band 3 (docs/plans/bands-2-3.md, "The four wards"). Each
 * ward's keeper takes a form by the ward's position: how many of the other
 * three wards are cleared this run. The engine that keeps `band:pos:<floor>`
 * live is not on this branch, so every test writes the stat itself and clears
 * that many other wards, which sets the band's level step to match.
 */

const FOOT = 'ascent_foot';
const WARDS = ['ascent_f7', 'ascent_f8', 'ascent_f9', 'ascent_f10'];

interface Keeper {
  floor: string;
  spot: string;
  /** The keeper's monster at positions 0 to 3. */
  forms: string[];
  /** Its level at positions 0 to 3: the row's base plus the band's step. */
  levels: number[];
}

const KEEPERS: Keeper[] = [
  {
    floor: 'ascent_f8',
    spot: 'f8_lodge',
    forms: ['ph_rogue_beast_young', 'ph_rogue_beast_young', 'ph_rogue_beast_final', 'ph_rogue_beast_final'],
    levels: [14, 16, 19, 23],
  },
  {
    floor: 'ascent_f9',
    spot: 'f9_ossuary',
    forms: ['ph_death_squire', 'ph_death_squire', 'death_knight', 'death_knight'],
    levels: [14, 16, 18, 22],
  },
  {
    floor: 'ascent_f10',
    spot: 'f10_foundry',
    forms: ['ph_ore_eater_1', 'ph_ore_eater_2', 'ph_ore_eater_3', 'ph_ore_eater_4'],
    levels: [14, 16, 19, 23],
  },
];

const SIZES = ['diminutive', 'tiny', 'small', 'medium', 'large', 'huge', 'gargantuan', 'colossal'];
const sizeOf = (id: string): number => SIZES.findIndex((s) => MONSTERS[id].tags.includes(s));

/** Book-value health and damage of a species at a level, before tier and variance. */
const bookStats = (id: string, level: number) => statsFromAttrs(baseMonsterAttrs(MONSTERS[id], level));

/**
 * The city open (floors 1-6 cleared, the key owned) with `pos` of the other
 * wards cleared and the ward's position stat written as the engine would.
 */
function atPosition(floor: string, pos: number, seed = 1): Game {
  const g = new Game(createInitialState(seed, FOOT));
  clearFloors(g.state.stats);
  g.state.prestige.purchases.city_key = 1;
  clearFloors(
    g.state.stats,
    WARDS.filter((w) => w !== floor).slice(0, pos),
  );
  g.state.stats[`band:pos:${floor}`] = pos;
  return g;
}

/**
 * Win the keeper fight by damage over time: the field spawned as a hunt would
 * spawn it, every enemy at 1 HP and on fire (no form resists heat), the player
 * kept standing.
 */
function winKeeperFight(g: Game, spotId: string): MonsterInstance[] {
  const s = g.state;
  s.spot = spotId;
  const spot = SPOTS[spotId];
  const enemies = spawnGroup(s, spot);
  s.combat = { enemies, playerBar: 0, momentum: 0, position: 'neutral', cooldowns: {}, buffs: [], events: {} };
  const foes = enemies.filter((e): e is MonsterInstance => e !== null);
  for (const foe of foes) {
    applyStatus(s, foe, { id: 'on_fire', intensity: 5 }, 'test');
    foe.hp = 1;
  }
  for (let i = 0; i < 100 && s.combat; i++) {
    s.resources.hp = getDerivedStats(s).maxHp;
    s.totalTicks += 1;
    tickCombat(s, g.bus, spot);
  }
  expect(s.combat, `${spotId}: the fight did not end`).toBeNull();
  return foes;
}

describe('the keepers of wards 8 to 10, by position', () => {
  it('each position leaves exactly one keeper row, the form the design names', () => {
    for (const k of KEEPERS) {
      for (let pos = 0; pos < 4; pos++) {
        const s = atPosition(k.floor, pos).state;
        const rows = eligibleEncounters(s, SPOTS[k.spot]).map((e) => e.monsterId);
        expect(rows, `${k.spot} at position ${pos}`).toEqual([k.forms[pos]]);
      }
    }
  });

  it('the keeper spawns at its row’s base level plus the band’s step', () => {
    for (const k of KEEPERS) {
      for (let pos = 0; pos < 4; pos++) {
        const s = atPosition(k.floor, pos).state;
        const m = spawnMonster(s, SPOTS[k.spot]);
        expect(m.defId, `${k.spot} at position ${pos}`).toBe(k.forms[pos]);
        expect(m.level, `${k.spot} at position ${pos}`).toBe(k.levels[pos]);
      }
    }
  });

  it('a keeper fight is the keeper alone', () => {
    for (const k of KEEPERS) {
      for (let pos = 0; pos < 4; pos++) {
        const s = atPosition(k.floor, pos).state;
        for (let i = 0; i < 30; i++) {
          const field = spawnGroup(s, SPOTS[k.spot]).filter((e) => e !== null);
          expect(field.map((e) => e!.defId), `${k.spot} at position ${pos}`).toEqual([k.forms[pos]]);
        }
      }
    }
  });

  it('only the keeper rows read the position', () => {
    // Only the keeper rows read the position: the hunts are the same table at
    // every position, and only the band's step moves their levels.
    for (const k of KEEPERS) {
      const spots = Object.values(SPOTS).filter((s) => s.areaId === FLOORS[k.floor].areaId);
      for (const spot of spots) {
        const reads = (spot.encounters ?? []).some((e) =>
          (e.requires ?? []).some((c) => (c.type === 'stat' || c.type === 'statMax') && c.key.startsWith('band:pos:')),
        );
        expect(reads, spot.id).toBe(spot.id === k.spot);
      }
    }
  });
});

describe('the floors’ clears', () => {
  it('each clear is the keeper spot’s one fight, naming no monster', () => {
    for (const k of KEEPERS) {
      expect(FLOORS[k.floor].clear, k.floor).toEqual([{ type: 'stat', key: `fights:${k.spot}`, value: 1 }]);
      expect(SPOTS[k.spot].fightLimit, k.spot).toBe(1);
    }
  });

  it('winning the keeper fight clears the floor, whichever form fell', () => {
    for (const k of KEEPERS) {
      for (let pos = 0; pos < 4; pos++) {
        const g = atPosition(k.floor, pos);
        expect(floorCleared(g.state, FLOORS[k.floor]), `${k.floor} before the fight`).toBe(false);
        const [foe] = winKeeperFight(g, k.spot);
        expect(foe.defId).toBe(k.forms[pos]);
        expect(g.state.stats[`fights:${k.spot}`], `${k.spot} at position ${pos}`).toBe(1);
        expect(floorCleared(g.state, FLOORS[k.floor]), `${k.floor} at position ${pos}`).toBe(true);
        // The spot is spent: no form comes back for a second fight.
        expect(spotCleared(g.state, SPOTS[k.spot]), `${k.spot} at position ${pos}`).toBe(true);
      }
    }
  });
});

describe('the forms', () => {
  it('the ore eater grows with each stage: health, armour and size all rise', () => {
    const stages = KEEPERS[2].forms;
    for (const level of [14, 23]) {
      const hp = stages.map((id) => bookStats(id, level).maxHp);
      for (let i = 1; i < 4; i++) expect(hp[i], `stage ${i + 1} health at ${level}`).toBeGreaterThan(hp[i - 1]);
    }
    const armor = stages.map((id) => innateArmor(id));
    const size = stages.map(sizeOf);
    expect(size[0], 'stage 1 carries a size tag').toBeGreaterThanOrEqual(0);
    for (let i = 1; i < 4; i++) {
      expect(armor[i], `stage ${i + 1} armour`).toBeGreaterThan(armor[i - 1]);
      expect(size[i], `stage ${i + 1} size`).toBeGreaterThan(size[i - 1]);
    }
  });

  it('every ore eater stage is shelled: edges and points resisted, blunt blows taken harder', () => {
    for (const id of KEEPERS[2].forms) {
      const res = innateResistances(id);
      expect(res.slashing, id).toBeGreaterThan(0);
      expect(res.piercing, id).toBeGreaterThan(0);
      expect(res.bludgeoning, id).toBeLessThan(0);
      expect(innateArmor(id), id).toBeGreaterThanOrEqual(6);
    }
  });

  it('the later form is harder than the earlier at the same level', () => {
    for (const [early, late] of [
      ['ph_rogue_beast_young', 'ph_rogue_beast_final'],
      ['ph_death_squire', 'death_knight'],
    ]) {
      for (const level of [14, 19, 23]) {
        const a = bookStats(early, level);
        const b = bookStats(late, level);
        expect(b.maxHp, `${late} vs ${early} health at ${level}`).toBeGreaterThan(a.maxHp);
        expect(b.damage, `${late} vs ${early} damage at ${level}`).toBeGreaterThan(a.damage);
      }
    }
    expect(sizeOf('ph_rogue_beast_final')).toBeGreaterThan(sizeOf('ph_rogue_beast_young'));
  });
});

describe('floor 8', () => {
  it('has no goblins left: no hunt, keeper or escort on the floor is a goblin', () => {
    const spots = Object.values(SPOTS).filter((s) => s.areaId === FLOORS.ascent_f8.areaId);
    expect(spots.length).toBeGreaterThan(0);
    for (const spot of spots) {
      for (const e of spot.encounters ?? []) {
        for (const id of [e.monsterId, ...(MONSTERS[e.monsterId].escorts ?? [])]) {
          expect(monsterTagSet(id).has('goblin'), `${spot.id}: ${id}`).toBe(false);
        }
      }
    }
  });

  it('every hunt on the floor is beasts', () => {
    const spots = Object.values(SPOTS).filter((s) => s.areaId === FLOORS.ascent_f8.areaId);
    for (const spot of spots) {
      for (const e of spot.encounters ?? []) expect(monsterTagSet(e.monsterId).has('beast'), `${spot.id}: ${e.monsterId}`).toBe(true);
    }
  });
});
