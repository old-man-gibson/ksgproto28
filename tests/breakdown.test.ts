import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { getDerivedStats, statBreakdown } from '../src/core/systems/derived';
import { attrBreakdown } from '../src/core/systems/attributes';
import { incomingDamage, incomingSlice, monsterSlice } from '../src/core/systems/combat';
import { monsterStats } from '../src/core/systems/monsterStats';
import type { MonsterInstance } from '../src/core/types';

/** A bare specimen — only its defId and conditions matter for resistances. */
function specimen(defId: string, name = defId): MonsterInstance {
  return {
    defId, name, icon: '🗿', level: 1, tier: 'basic',
    modifier: 'normal', rarity: 'common', mutation: null, hp: 100, statuses: [],
    attrs: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    range: 'melee', bar: 0, stunSpent: 0, xp: 0, gold: 0,
  };
}

const golemInstance = () => specimen('stone_golem', 'Stone Golem');

describe('stat breakdowns (tooltips)', () => {
  it('labels each contribution with its source and matches the live total', () => {
    const g = new Game(createInitialState(100));
    g.state.attrs.str.level = 21; // rank bonus: +2 damage
    g.state.equipment.weapon = {
      uid: 700, defId: 'iron_sword', slots: 1, runes: ['minor_rune_might'],
    };

    const bd = statBreakdown(g.state, 'damage');
    const sources = bd.lines.map((l) => l.source);
    expect(sources).toContain('Iron Sword');
    expect(sources).toContain('Minor Rune of Might (Iron Sword)');
    expect(sources).toContain('Strength Training — Intermediate');
    expect(bd.total).toBeCloseTo(getDerivedStats(g.state).damage, 5);
    // Base reflects the formula: 2 + 1.2 × effective STR.
    expect(bd.baseText).toContain('STR');
  });

  it('flags capped stats', () => {
    const g = new Game(createInitialState(101));
    expect(statBreakdown(g.state, 'dodge').capped).toBe(false);
    g.state.combat = {
      enemies: [null, null, null, null, null], playerBar: 0, momentum: 0, position: 'neutral', cooldowns: {}, events: {},
      buffs: [{ name: 'Ghost', mods: [{ stat: 'dodge', op: 'add', value: 5 }], ticksLeft: 9 }],
    };
    const bd = statBreakdown(g.state, 'dodge');
    expect(bd.capped).toBe(true);
    expect(bd.total).toBe(0.75);
    expect(bd.lines.some((l) => l.source === 'Buff: Ghost')).toBe(true);
  });

  it('groups all milestones of one attribute into a single line', () => {
    const g = new Game(createInitialState(102));
    g.state.attrs.str.level = 15; // milestones: +1 (Lv 5), ×1% (Lv 10), +1 (Lv 15)
    const bd = attrBreakdown(g.state, 'str');
    const milestoneLines = bd.lines.filter((l) => l.source.includes('milestones'));
    // Adds collapse into one line, mults into another — never more.
    expect(milestoneLines).toHaveLength(2);
    expect(milestoneLines.find((l) => l.op === 'add')?.value).toBe(2);
    expect(milestoneLines.find((l) => l.op === 'mult')?.value).toBeCloseTo(0.01, 5);
    expect(bd.trained).toBe(15);
  });

  it('applies skill milestones cumulatively, unscaled by level', () => {
    const g = new Game(createInitialState(104));
    // Smithing milestones: +0.01 (Lv 5), +0.02 (Lv 10), +0.03 (Lv 15) craftSpeed.
    g.state.skills.smithing = { level: 12, xp: 0 };
    const bd = statBreakdown(g.state, 'craftSpeed');
    const line = bd.lines.find((l) => l.source === 'Smithing milestones');
    expect(line?.value).toBeCloseTo(0.03, 5); // Lv 5 + Lv 10 only; Lv 15 not yet
    // Milestones ride on top of the per-level effect: flats first (base 1 +
    // 0.03), then the ×1%-per-level multiplier over 12 levels.
    expect(bd.total).toBeCloseTo(1.03 * 1.12, 5);
    expect(getDerivedStats(g.state).craftSpeed).toBeCloseTo(bd.total, 5);
  });

  it('damage tooltips itemise what was resisted, pierced and blocked', () => {
    // A blow lands on a LIVE monster, so its resistances come off the specimen
    // (species innate, plus anything currently afflicting it).
    const golem = golemInstance();
    // A stone golem is the archetypal HARD thing: inorganic, construct and
    // earth all imply armour, and the toughest of them sets it (TAG_ARMOR).
    // Armour comes off first, then the typed resistance takes its share of
    // whatever got through — the same order a blow on the player resolves in.
    const worn = monsterStats(golem).armor;
    expect(worn).toBeGreaterThan(0);

    // stone_golem: 0.6 slashing resistance. Penetration erases half of it.
    const slice = monsterSlice(golem, 'slashing', 'Iron Sword', 100, 0.3);
    expect(slice.resistance).toBeCloseTo(0.3, 5);
    expect(slice.pierced).toBeCloseTo(0.3, 5);
    expect(slice.armor).toBeCloseTo(worn, 5);
    expect(slice.dealt).toBeCloseTo((100 - worn) * 0.7, 5);
    expect(slice.resisted).toBeCloseTo((100 - worn) * 0.3, 5);

    // A vulnerability reads as negative resistance — damage added, not shed —
    // and it is applied to what the harness left, not to the raw blow.
    const weak = monsterSlice(golem, 'bludgeoning', 'Club', 100, 0.3);
    expect(weak.resisted).toBeCloseTo((100 - worn) * -0.5, 5);
    expect(weak.pierced).toBe(0);

    // Something soft has nothing to take off the top, which is the whole of
    // why corrosion does little to it — no rule, just no harness.
    const rat = specimen('forest_rat', 'Forest Rat');
    expect(monsterStats(rat).armor).toBe(0);
    expect(monsterSlice(rat, 'slashing', 'Iron Sword', 100).armor).toBe(0);

    // Incoming: flat armor first, then the typed resistance on what's left.
    const g = new Game(createInitialState(105));
    const stats = { ...getDerivedStats(g.state), armor: 10, resSlashing: 0.5 };
    const hit = incomingSlice(stats, 'slashing', 'Wolf', 30);
    expect(hit.armor).toBe(10);
    expect(hit.resisted).toBeCloseTo(10, 5);
    expect(hit.dealt).toBe(10);
    expect(incomingDamage(stats, 'slashing', 30)).toBe(hit.dealt);
    // Armor never claims more than the blow carried (the floor decides the rest).
    expect(incomingSlice(stats, 'slashing', 'Wolf', 5).armor).toBe(5);
  });

  it('every damage line in the fight feed carries its own breakdown', () => {
    const g = new Game(createInitialState(106));
    g.state.spot = 'woods_edge';
    g.equip(1); // rusty sword
    g.selectActivity('hunt');
    for (let i = 0; i < 2000; i++) g.tick();

    const reports = g.state.combatFeed.map((l) => l.damage).filter((d) => d !== undefined);
    expect(reports.length).toBeGreaterThan(0);
    for (const r of reports) {
      expect(r.slices.length).toBeGreaterThan(0);
      expect(r.steps.length).toBeGreaterThan(0);
      // The parts add up to the number the feed line printed (rounded, and
      // never below the one-point floor every blow at least deals).
      const dealt = r.slices.reduce((sum, s) => sum + s.dealt, 0);
      expect(r.total).toBe(Math.max(1, Math.round(dealt)));
      for (const s of r.slices) expect(s.source).not.toBe('');
    }
    // Both directions are explained: what you dealt, and what you took.
    expect(reports.some((r) => !r.incoming && r.slices[0].source === 'Rusty Sword')).toBe(true);
    expect(reports.some((r) => r.incoming && r.target === 'You')).toBe(true);
  });

  it('attribute breakdown reports fusion partners', () => {
    const g = new Game(createInitialState(103));
    g.state.attrs.str.level = 20;
    g.state.attrs.cha.level = 10;
    g.state.fused.push('dominion');
    const bd = attrBreakdown(g.state, 'str');
    expect(bd.fusion?.partner).toBe('cha');
    expect(bd.fusion?.total).toBeCloseTo(bd.effective + bd.fusion!.partnerValue, 5);
  });
});
