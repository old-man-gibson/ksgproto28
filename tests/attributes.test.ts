import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { attrValue, effectiveAttr } from '../src/core/systems/attributes';
import { conditionMet } from '../src/core/systems/conditions';
import { getDerivedStats } from '../src/core/systems/derived';
import { canEquip } from '../src/core/systems/equipment';

describe('effective attributes (stat layer)', () => {
  it('equipment attribute bonuses raise the effective value and derived stats', () => {
    const g = new Game(createInitialState(1));
    g.state.attrs.str.level = 10;
    const before = getDerivedStats(g.state).damage;

    g.state.inventory.push({ uid: 900, defId: 'steel_greatsword' }); // STR+3, needs STR 12
    g.state.attrs.str.level = 12;
    g.equip(900);
    // 12 trained + 3 sword + 1 milestone (Lv 5), ×1.01 milestone (Lv 10)
    expect(effectiveAttr(g.state, 'str')).toBeCloseTo(16 * 1.01, 5);
    expect(attrValue(g.state, 'str')).toBeCloseTo(16 * 1.01, 5);
    // damage base includes the +3 STR (×1.2) AND the +14 flat
    expect(getDerivedStats(g.state).damage).toBeGreaterThan(before + 14 + 3 * 1.2);

    g.unequip('weapon');
    expect(effectiveAttr(g.state, 'str')).toBeCloseTo(13 * 1.01, 5); // sword bonus reverts
  });

  it('training XP still flows to the trained base, never the bonus', () => {
    const g = new Game(createInitialState(2));
    g.state.inventory.push({ uid: 901, defId: 'oak_staff' }); // INT+2
    g.equip(901);
    expect(g.state.attrs.int.level).toBe(1); // trained base untouched
    expect(effectiveAttr(g.state, 'int')).toBe(3);
  });

  it('multiplicative attribute mods compound after adds, floored at 1', () => {
    const g = new Game(createInitialState(3));
    g.state.attrs.str.level = 10;
    g.state.combat = {
      enemies: [null, null, null, null, null], playerBar: 0, momentum: 0, position: 'neutral', cooldowns: {}, events: {},
      buffs: [
        { name: 'Might', mods: [{ stat: 'str', op: 'add', value: 5 }], ticksLeft: 10 },
        { name: 'Giant', mods: [{ stat: 'str', op: 'mult', value: 0.2 }], ticksLeft: 10 },
      ],
    };
    // adds (10 trained + 5 buff + 1 milestone) then mults (×1.2 buff, ×1.01 milestone)
    expect(effectiveAttr(g.state, 'str')).toBeCloseTo(16 * 1.2 * 1.01, 5);

    g.state.combat.buffs = [{ name: 'Wither', mods: [{ stat: 'str', op: 'add', value: -99 }], ticksLeft: 10 }];
    expect(effectiveAttr(g.state, 'str')).toBe(1); // floor
  });

  it('unlock conditions and equip requirements see effective attributes', () => {
    const g = new Game(createInitialState(4));
    g.state.attrs.dex.level = 8;
    expect(conditionMet(g.state, { type: 'attr', attr: 'dex', level: 10 })).toBe(false);

    g.state.inventory.push({ uid: 902, defId: 'iron_dagger' }); // DEX+2
    g.equip(902);
    expect(conditionMet(g.state, { type: 'attr', attr: 'dex', level: 10 })).toBe(true);

    // Chain: the dagger's +2 DEX qualifies the character for the uchigatana (DEX 10).
    g.state.inventory.push({ uid: 903, defId: 'uchigatana' });
    expect(canEquip(g.state, g.state.inventory.find((i) => i.uid === 903)!)).toBe(true);
  });

  it('fusion sums EFFECTIVE components', () => {
    const g = new Game(createInitialState(5));
    g.state.attrs.str.level = 15;
    g.state.attrs.cha.level = 9;
    g.state.fused.push('dominion');
    // eff STR (15+2 milestones)×1.01 + eff CHA (9+1 milestone)
    expect(attrValue(g.state, 'str')).toBeCloseTo(17 * 1.01 + 10, 5);

    g.state.inventory.push({ uid: 904, defId: 'steel_greatsword' });
    g.state.attrs.str.level = 15; // meets STR 12 req via trained
    g.equip(904);
    const expected = (15 + 3 + 2) * 1.01 + 10; // effective STR (with +3 sword) + effective CHA
    expect(attrValue(g.state, 'str')).toBeCloseTo(expected, 5);
    expect(attrValue(g.state, 'cha')).toBeCloseTo(expected, 5); // both components read the sum
  });

  it('achievement tiers can grant attributes (Honed Body III)', () => {
    const g = new Game(createInitialState(6));
    g.state.attrs.str.level = 50;
    g.state.achievements['honed_body'] = 3;
    // 50 + 2 achievement + 5 flat milestones, ×1.01^5 from the five ×-milestones
    expect(effectiveAttr(g.state, 'str')).toBeCloseTo(57 * 1.01 ** 5, 5);
  });
});
