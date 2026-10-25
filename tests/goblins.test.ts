import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { TECHNIQUES, TECHNIQUE_WATCH_COUNT } from '../src/core/data/martial.data';
import { MIRACLES } from '../src/core/data/spellcraft.data';
import { DEITIES } from '../src/core/data/deities.data';
import {
  checkTechniqueLearning,
  learnTechnique,
  techniqueKnown,
  techniqueForm,
  watchLearnProgress,
  watchStatKey,
} from '../src/core/systems/martial';
import { castMonsterWorking, spawnMonster, tickCombat } from '../src/core/systems/combat';
import { monsterStats } from '../src/core/systems/monsterStats';
import { getDerivedStats } from '../src/core/systems/derived';
import { deityKnown, unlockKey } from '../src/core/systems/unlocks';
import { MONSTERS, SPOTS } from '../src/core/registry';
import type { MonsterInstance } from '../src/core/types';

// The goblin roster of docs/plans/bands-2-3.md M7: hobgoblins whose
// techniques a player learns by watching, the firetongue, and the witch doctor
// with its gods.

const fresh = (seed = 1) => new Game(createInitialState(seed));

/** A fighter the goblin techniques are eligible for, martial open or shut. */
function fighter(open = true) {
  const g = fresh();
  g.state.skills.fighting = { level: 10, xp: 0 };
  if (open) g.state.stats[unlockKey('martial')] = 1;
  return g;
}

describe('learning a technique by watching it', () => {
  it('every watchable technique asks the one shared count', () => {
    for (const id of ['gather', 'lunge', 'heavy_blow', 'hamstring', 'dirty_stab', 'pocket_sand']) {
      expect(TECHNIQUES[id].learn?.watch, id).toBe(TECHNIQUE_WATCH_COUNT);
    }
    expect(TECHNIQUE_WATCH_COUNT).toBe(50);
  });

  it('50 sightings teach it, rough; 49 do not', () => {
    const g = fighter();
    g.state.stats[watchStatKey('pocket_sand')] = TECHNIQUE_WATCH_COUNT - 1;
    checkTechniqueLearning(g.state, g.bus);
    expect(techniqueKnown(g.state, TECHNIQUES.pocket_sand)).toBe(false);
    g.state.stats[watchStatKey('pocket_sand')] = TECHNIQUE_WATCH_COUNT;
    checkTechniqueLearning(g.state, g.bus);
    expect(techniqueForm(g.state, 'pocket_sand')).toBe('rough');
  });

  it('a shut martial shutter learns nothing, and keeps the count for when it opens', () => {
    const g = fighter(false);
    g.state.stats[watchStatKey('pocket_sand')] = TECHNIQUE_WATCH_COUNT;
    checkTechniqueLearning(g.state, g.bus);
    expect(techniqueKnown(g.state, TECHNIQUES.pocket_sand)).toBe(false);
    g.state.stats[unlockKey('martial')] = 1;
    checkTechniqueLearning(g.state, g.bus);
    expect(techniqueKnown(g.state, TECHNIQUES.pocket_sand)).toBe(true);
  });

  it('sightings before there is a way in count for nothing (reach)', () => {
    const g = fighter();
    // Hamstring starts coiled; with nothing that coils, it cannot be reached.
    g.state.stats[watchStatKey('hamstring')] = TECHNIQUE_WATCH_COUNT;
    checkTechniqueLearning(g.state, g.bus);
    expect(techniqueKnown(g.state, TECHNIQUES.hamstring)).toBe(false);

    learnTechnique(g.state, TECHNIQUES.gather, 'canonical');
    checkTechniqueLearning(g.state, g.bus);
    expect(watchLearnProgress(g.state, TECHNIQUES.hamstring)).toBe(0);
    expect(techniqueKnown(g.state, TECHNIQUES.hamstring)).toBe(false);

    g.state.stats[watchStatKey('hamstring')] += TECHNIQUE_WATCH_COUNT;
    checkTechniqueLearning(g.state, g.bus);
    expect(techniqueForm(g.state, 'hamstring')).toBe('rough');
  });

  it("a hobgoblin's techniques count as sightings in a real fight", () => {
    const g = fighter();
    g.state.attrs.con.level = 400;
    g.state.resources.hp = getDerivedStats(g.state).maxHp;
    g.state.spot = 'woods_edge';
    const foe = spawnMonster(g.state, SPOTS.woods_edge, { monsterId: 'hobgoblin', level: 5, plain: true });
    foe.attrs.con = 1e5;
    foe.hp = monsterStats(foe).maxHp;
    g.state.combat = {
      enemies: [foe, null, null, null, null],
      playerBar: 0,
      momentum: 0,
      position: 'neutral',
      cooldowns: {},
      buffs: [],
      events: {},
    };
    for (let i = 0; i < 3000 && g.state.combat; i++) {
      g.state.totalTicks += 1;
      tickCombat(g.state, g.bus, SPOTS.woods_edge);
    }
    const seen = ['gather', 'hamstring', 'lunge', 'dirty_stab', 'pocket_sand'].map(
      (id) => g.state.stats[watchStatKey(id)] ?? 0,
    );
    expect(seen.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });
});

describe('the witch doctor and its gods', () => {
  function pack(withAlly: boolean) {
    const g = fresh(3);
    g.state.attrs.con.level = 400;
    g.state.resources.hp = getDerivedStats(g.state).maxHp;
    g.state.spot = 'woods_edge';
    const doctor = spawnMonster(g.state, SPOTS.woods_edge, { monsterId: 'goblin_witch_doctor', level: 5, plain: true });
    const ally = withAlly
      ? spawnMonster(g.state, SPOTS.woods_edge, { monsterId: 'goblin', level: 5, plain: true })
      : null;
    g.state.combat = {
      enemies: [doctor, ally, null, null, null],
      playerBar: 0,
      momentum: 0,
      position: 'neutral',
      cooldowns: {},
      buffs: [],
      events: {},
    };
    return { g, doctor, ally };
  }

  it('Mud Poultice mends the allies, not the caster', () => {
    const { g, doctor, ally } = pack(true);
    const a = ally as MonsterInstance;
    a.hp = 1;
    doctor.hp = 1;
    castMonsterWorking(g.state, g.bus, doctor, monsterStats(doctor), { school: 'divine', litany: 'mud_poultice' }, 0);
    expect(a.hp).toBeGreaterThan(1);
    expect(doctor.hp).toBe(1);
  });

  it('alone, it never spends a turn on the poultice', () => {
    const { g, doctor } = pack(false);
    doctor.attrs.con = 1e5;
    doctor.hp = monsterStats(doctor).maxHp;
    for (let i = 0; i < 1500 && g.state.combat; i++) {
      g.state.totalTicks += 1;
      tickCombat(g.state, g.bus, SPOTS.woods_edge);
    }
    expect(doctor.cooldowns?.[0]).toBeUndefined();
    expect(doctor.spent?.[0] ?? 0).toBe(0);
    expect(Object.keys(doctor.cooldowns ?? {}).length).toBeGreaterThan(0);
  });

  it('fire, mud and the hunt each hold two miracles, and a new player knows none of them', () => {
    const g = fresh();
    for (const god of ['goblin_fire', 'goblin_mud', 'goblin_hunt']) {
      expect(DEITIES[god].tags).toContain('goblin pantheon');
      expect(Object.values(MIRACLES).filter((m) => m.deity === god)).toHaveLength(2);
      expect(deityKnown(g.state, god)).toBe(false);
    }
  });

  it('the casters speak only what exists', () => {
    for (const id of ['goblin_firetongue', 'goblin_witch_doctor']) {
      for (const entry of MONSTERS[id].rotation ?? []) {
        if ('cast' in entry && entry.cast.school === 'divine') expect(MIRACLES[entry.cast.litany], id).toBeDefined();
      }
    }
  });
});
