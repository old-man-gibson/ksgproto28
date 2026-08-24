import { describe, expect, it } from 'vitest';
import { createInitialState, SAVE_VERSION } from '../src/core/state';
import { Game } from '../src/core/game';
import { deserialize } from '../src/core/save/save';
import { spawnMonster } from '../src/core/systems/combat';
import { getDerivedStats } from '../src/core/systems/derived';
import { canEquip, materialSellPrice } from '../src/core/systems/equipment';
import { styleUnlocked, styleSlots } from '../src/core/systems/styles';
import { skillTierName } from '../src/core/systems/skills';
import { MODIFIER_TIERS, SPOTS, STYLES, TIERS } from '../src/core/registry';
import { MONSTER_ATTR_VARIANCE } from '../src/core/systems/monsterStats';
import { gradesHeld } from '../src/core/systems/disciplines';

describe('tier system', () => {
  it('rolls the stat multiplier within the intrinsic tier range', () => {
    const g = new Game(createInitialState(11));
    // slime_golem (ancient, [1.45, 1.7]) spawns at malgeri_peak
    for (let i = 0; i < 300; i++) {
      const m = spawnMonster(g.state, SPOTS.malgeri_peak);
      if (m.defId !== 'slime_golem' || m.modifier !== 'normal' || m.rarity !== 'common') continue;
      // Multipliers land on the ATTRIBUTES now, so read the scaling off CON
      // itself rather than off finished HP (whose flat term never scaled).
      const con = 22 + 1.65 * (m.level - 1);
      const mult = m.attrs.con / con;
      // Each specimen also jitters by ±MONSTER_ATTR_VARIANCE around the roll.
      const jitter = 1 + MONSTER_ATTR_VARIANCE;
      expect(mult).toBeGreaterThanOrEqual((TIERS.ancient.multiplierRange[0] * 0.99) / jitter);
      expect(mult).toBeLessThanOrEqual(TIERS.ancient.multiplierRange[1] * 1.01 * jitter);
    }
  });

  it('aberrant modifiers can roll under- or over-powered', () => {
    expect(MODIFIER_TIERS.aberrant.multiplierRange[0]).toBeLessThan(1);
    expect(MODIFIER_TIERS.aberrant.multiplierRange[1]).toBeGreaterThan(1);
  });
});

describe('drop tables & materials', () => {
  function farmKills(seed: number, spot: string, kills: number): Game {
    const g = new Game(createInitialState(seed));
    g.state.spot = spot;
    g.state.attrs.str.level = 60; // steamroll so loot flows
    g.state.attrs.con.level = 40;
    g.state.resources.hp = 500;
    g.selectActivity('hunt');
    for (let i = 0; i < 60000 && (g.state.stats['kills'] ?? 0) < kills; i++) g.tick();
    return g;
  }

  it('slime hunting stacks slime gel and never drops unknown things', () => {
    const g = farmKills(21, 'basement', 25);
    expect(g.state.stats['kills']).toBeGreaterThanOrEqual(25);
    expect(g.state.materials['slime_gel'] ?? 0).toBeGreaterThan(0);
  });

  it('material sell price scales with charisma and clears the stack', () => {
    const g = new Game(createInitialState(5));
    g.state.materials['slime_gel'] = 10;
    const base = materialSellPrice(g.state, 'slime_gel');
    g.state.attrs.cha.level = 100;
    expect(materialSellPrice(g.state, 'slime_gel')).toBeGreaterThan(base);

    const goldBefore = g.state.gold;
    g.sellMaterial('slime_gel');
    expect(g.state.materials['slime_gel']).toBeUndefined();
    expect(g.state.gold).toBeGreaterThan(goldBefore);
  });
});

describe('conditional (requiresTag) modifiers', () => {
  it('weapon-family bonuses apply only while the matching weapon is equipped', () => {
    const g = new Game(createInitialState(7));
    g.state.skills['dagger_combat'] = { level: 50, xp: 0 };

    const unarmed = getDerivedStats(g.state).damage;
    g.state.inventory.push({ uid: 900, defId: 'iron_dagger' });
    g.equip(900);
    const withDagger = getDerivedStats(g.state).damage;
    // dagger adds +2 flat; dagger_combat lv50 adds ×1.6 on top — far beyond flat alone
    expect(withDagger).toBeGreaterThan((unarmed + 2) * 1.3);

    g.state.inventory.push({ uid: 901, defId: 'rusty_sword' });
    g.equip(901); // swap to sword: dagger mastery goes dormant
    const withSword = getDerivedStats(g.state).damage;
    expect(withSword).toBeLessThan(withDagger);
  });

  it('bare hands count as the unarmed pseudo-tag', () => {
    const g = new Game(createInitialState(8));
    g.state.skills['unarmed_combat'] = { level: 40, xp: 0 };
    const bare = getDerivedStats(g.state).damage;
    g.equip(1); // rusty sword from starting inventory
    expect(getDerivedStats(g.state).damage).toBeLessThan(bare + 3.1); // sword +3 flat, mastery lost
  });
});

describe('equipment requirements', () => {
  it('blocks equipping until attribute thresholds are met', () => {
    const g = new Game(createInitialState(9));
    g.state.inventory.push({ uid: 910, defId: 'steel_greatsword' }); // needs str 12
    expect(canEquip(g.state, g.state.inventory.at(-1)!)).toBe(false);
    g.equip(910);
    expect(g.state.equipment.weapon).toBeUndefined();

    g.state.attrs.str.level = 12;
    expect(canEquip(g.state, g.state.inventory.at(-1)!)).toBe(true);
    g.equip(910);
    expect(g.state.equipment.weapon?.defId).toBe('steel_greatsword');
  });
});

describe('combat style unlocks', () => {
  it('Jigen-Ryu is locked until its school skill manifests, then wears the Crush slot', () => {
    const g = new Game(createInitialState(10));
    expect(styleUnlocked(g.state, STYLES.jigen_ryu)).toBe(false);
    // Naming the school picks its stance — selection is always a stance.
    g.setStyle('jigen_ryu');
    expect(g.state.style).toBe('crush');
    expect(styleSlots(g.state).map((s) => s.active.id)).toContain('crush');

    g.state.skills['school_jigen_ryu'] = { level: 1, xp: 0 };
    // The school's stance is gated on the katana sub-family, not any sword.
    g.state.attrs.dex.level = 8; // katana requirement
    g.state.inventory.push({ uid: 2, defId: 'katana', slots: 1, runes: [] });
    g.equip(2);
    expect(styleUnlocked(g.state, STYLES.jigen_ryu)).toBe(true);
    const slots = styleSlots(g.state);
    // Same slot, same position — only what fills it changed.
    const crushSlot = slots.find((s) => s.stance.id === 'crush')!;
    expect(crushSlot.active.id).toBe('jigen_ryu');
    expect(slots.map((s) => s.active.id)).not.toContain('crush');
    expect(g.state.style).toBe('crush'); // selection untouched
  });
});

describe('gather & job activities', () => {
  it('gathering produces materials on schedule', () => {
    const g = new Game(createInitialState(12));
    g.state.spot = 'forest_edge_w';
    g.selectActivity('gather_herbs'); // 150 ticks per herb
    for (let i = 0; i < 460; i++) g.tick();
    // Herbs became a graded cooking ingredient, so they are stocked per grade.
    const herbs = gradesHeld(g.state, 'common_herb').reduce((n, e) => n + e.qty, 0);
    expect(herbs).toBe(3);
  });

  it('jobs pay gold and train charisma', () => {
    const g = new Game(createInitialState(13));
    g.state.spot = 'hamlet_square';
    g.selectActivity('job_guard'); // 10 gold per 200 ticks
    for (let i = 0; i < 640; i++) g.tick();
    expect(g.state.gold).toBeGreaterThanOrEqual(30);
    expect(g.state.attrs.cha.xp > 0 || g.state.attrs.cha.level > 1).toBe(true);
  });
});

describe('skill tier names', () => {
  it('reports the mastery title for the current level', () => {
    expect(skillTierName('unarmed_combat', 5)).toBe('Unarmed Fighting');
    expect(skillTierName('unarmed_combat', 45)).toBe('Martial Arts');
    expect(skillTierName('unarmed_combat', 99)).toBe('Mind-Body Unity');
    expect(skillTierName('fighting', 50)).toBeNull(); // no tier names defined
  });
});

describe('save migration v2 → v3', () => {
  it('renames equipment.body to chest and backfills materials', () => {
    const v2 = createInitialState(14) as unknown as Record<string, unknown>;
    v2.version = 2;
    delete v2.materials;
    (v2.equipment as Record<string, unknown>).body = { uid: 5, defId: 'leather_vest' };
    const loaded = deserialize(JSON.stringify(v2));
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.equipment.chest?.defId).toBe('leather_vest');
    expect((loaded.equipment as Record<string, unknown>).body).toBeUndefined();
    expect(loaded.materials).toEqual({});
  });
});
