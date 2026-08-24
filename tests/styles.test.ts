import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { getDerivedStats } from '../src/core/systems/derived';
import { damageVsMonster } from '../src/core/systems/combat';
import { effectiveStyleId, styleSlots, styleUnlocked } from '../src/core/systems/styles';

const GENERIC_IDS = [
  'balanced', 'aggressive', 'crush', 'cleave', 'quick', 'evasive', 'finesse', 'defensive', 'multi',
];

const KATANA_UID = 2;

/**
 * Arm the character with a katana. The sword schools are gated on the katana
 * sub-family specifically, not on any sword — a plain blade teaches nothing.
 */
function armKatana(g: Game): void {
  g.state.attrs.dex.level = Math.max(g.state.attrs.dex.level, 8); // katana requirement
  if (!g.state.inventory.some((i) => i.uid === KATANA_UID)) {
    g.state.inventory.push({ uid: KATANA_UID, defId: 'katana', slots: 1, runes: [] });
  }
  g.equip(KATANA_UID);
}

describe('stance roster', () => {
  it('a fresh character sees exactly the nine generic stances, all unlocked', () => {
    const g = new Game(createInitialState(1));
    const slots = styleSlots(g.state);
    expect(slots.map((s) => s.stance.id).sort()).toEqual([...GENERIC_IDS].sort());
    // Nothing manifested yet, so every slot is worn by its own stance.
    expect(slots.map((s) => s.active.id)).toEqual(slots.map((s) => s.stance.id));
    for (const s of slots) expect(styleUnlocked(g.state, s.stance), s.stance.id).toBe(true);
  });

  it('the roster keeps its order and length when a school takes a slot', () => {
    const g = new Game(createInitialState(11));
    const before = styleSlots(g.state).map((s) => s.stance.id);
    g.state.skills['school_jigen_ryu'] = { level: 1, xp: 0 };
    armKatana(g);
    const after = styleSlots(g.state);
    expect(after.map((s) => s.stance.id)).toEqual(before);
    expect(after.filter((s) => s.active.replaces).map((s) => s.active.id)).toEqual(['jigen_ryu']);
  });

  it('crit damage, penetration and splash stances change the new stats', () => {
    const g = new Game(createInitialState(2));
    expect(getDerivedStats(g.state).critDamage).toBe(2); // base
    g.setStyle('finesse');
    expect(getDerivedStats(g.state).critDamage).toBeCloseTo(2.8); // ×1.4
    g.setStyle('crush');
    expect(getDerivedStats(g.state).penetration).toBeCloseTo(0.1);
    g.setStyle('cleave');
    expect(getDerivedStats(g.state).splash).toBeCloseTo(0.1);
  });
});

describe('penetration math', () => {
  it('erodes positive resistance toward zero but never deepens vulnerability', () => {
    // stone_golem: slashing 0.6 resist, bludgeoning -0.5 vulnerable
    expect(damageVsMonster('stone_golem', 'slashing', 100, 0.3)).toBeCloseTo(70);
    expect(damageVsMonster('stone_golem', 'slashing', 100, 0.9)).toBeCloseTo(100); // floor 0
    expect(damageVsMonster('stone_golem', 'bludgeoning', 100, 0.3)).toBeCloseTo(150); // untouched
  });
});

describe('school manifestation through stances', () => {
  function swordFighter(seed: number, style: string): Game {
    const g = new Game(createInitialState(seed));
    g.state.spot = 'woods_edge';
    g.state.skills['fighting'] = { level: 30, xp: 0 };
    g.state.skills['swordsmanship'] = { level: 20, xp: 0 };
    g.state.attrs.str.level = 40;
    g.state.attrs.con.level = 40;
    g.state.resources.hp = 400;
    armKatana(g);
    g.setStyle(style);
    g.selectActivity('hunt');
    return g;
  }

  it('fighting Crush-style with a katana manifests Jigen-ryu (and only sword schools)', () => {
    const g = swordFighter(3, 'crush');
    for (let i = 0; i < 3000 && !g.state.skills['school_jigen_ryu']; i++) g.tick();
    expect(g.state.skills['school_jigen_ryu']).toBeDefined();
    // Unarmed school shares the crush stance but requires bare fists.
    expect(g.state.skills['school_muay_thai']).toBeUndefined();
  });

  it('the wrong stance teaches nothing', () => {
    const g = swordFighter(4, 'aggressive'); // Frenzy, not Crush
    for (let i = 0; i < 2500; i++) g.tick();
    expect(g.state.skills['school_jigen_ryu']).toBeUndefined();
  });

  it('once manifested, the school supplants its stance with no player input', () => {
    const g = swordFighter(5, 'crush');
    expect(effectiveStyleId(g.state)).toBe('crush');
    g.state.skills['school_jigen_ryu'] = { level: 1, xp: 0 };
    // No setStyle call: holding the sword is the whole trigger.
    expect(effectiveStyleId(g.state)).toBe('jigen_ryu');
    expect(g.state.style).toBe('crush'); // the slot you picked, unchanged
  });

  it('a school only claims the slot its stance owns', () => {
    const g = swordFighter(8, 'quick');
    g.state.skills['school_jigen_ryu'] = { level: 1, xp: 0 }; // replaces crush
    expect(effectiveStyleId(g.state)).toBe('quick');
    g.setStyle('crush');
    expect(effectiveStyleId(g.state)).toBe('jigen_ryu');
  });
});

describe('effective style fallback', () => {
  it('drops to the generic stance when the school weapon leaves', () => {
    const g = new Game(createInitialState(6));
    g.state.skills['school_jigen_ryu'] = { level: 10, xp: 0 };
    armKatana(g);
    g.setStyle('crush');
    expect(effectiveStyleId(g.state)).toBe('jigen_ryu');
    const armed = getDerivedStats(g.state).penetration;
    expect(armed).toBeGreaterThan(0.2); // 0.2 + 10×0.002

    g.unequip('weapon');
    expect(g.state.style).toBe('crush'); // selection preserved
    expect(effectiveStyleId(g.state)).toBe('crush'); // combat falls back
    expect(getDerivedStats(g.state).penetration).toBeCloseTo(0.1); // plain crush

    g.equip(KATANA_UID); // re-arm: the school returns on its own
    expect(effectiveStyleId(g.state)).toBe('jigen_ryu');
    expect(getDerivedStats(g.state).penetration).toBeCloseTo(armed);
  });

  it('selecting a school id folds to its stance (old saves, stale clicks)', () => {
    const g = new Game(createInitialState(9));
    g.setStyle('jigen_ryu');
    expect(g.state.style).toBe('crush');
  });

  it('school styles scale with their skill level', () => {
    const g = new Game(createInitialState(7));
    armKatana(g);
    g.state.skills['school_jigen_ryu'] = { level: 1, xp: 0 };
    g.setStyle('crush');
    const low = getDerivedStats(g.state).damage;
    g.state.skills['school_jigen_ryu'].level = 60;
    expect(getDerivedStats(g.state).damage).toBeGreaterThan(low);
  });
});

// Style/katana cross-reference checks live in tests/content.test.ts.
