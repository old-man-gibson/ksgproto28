import { describe, expect, it } from 'vitest';
import { createInitialState, SAVE_VERSION } from '../src/core/state';
import { Game } from '../src/core/game';
import { deserialize } from '../src/core/save/save';
import { attrValue, effectiveAttrs, isFused } from '../src/core/systems/attributes';
import { checkSuperUnlocks } from '../src/core/systems/superattrs';
import { conditionMet } from '../src/core/systems/conditions';
import { getDerivedStats } from '../src/core/systems/derived';
import { sellPrice } from '../src/core/systems/equipment';
import type { GameState } from '../src/core/types';

function v1Save(): string {
  // Hand-built version-1 shape: Willpower exists, no cha/wis, no fused list.
  const s = createInitialState(1) as unknown as Record<string, unknown>;
  const attrs = s.attrs as Record<string, { level: number; xp: number }>;
  delete attrs.wis;
  delete attrs.cha;
  attrs.wil = { level: 7, xp: 12 };
  delete s.fused;
  s.version = 1;
  s.stats = { 'attr:wil': 7, kills: 3 };
  s.spot = 'village_library';
  s.activity = 'train_wil'; // renamed activity id — must remap on load
  return JSON.stringify(s);
}

describe('save migration v1 → v2', () => {
  it('renames Willpower to Wisdom preserving progress, adds Charisma and fused list', () => {
    const loaded = deserialize(v1Save());
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.attrs.wis).toEqual({ level: 7, xp: 12 });
    expect((loaded.attrs as Record<string, unknown>).wil).toBeUndefined();
    expect(loaded.attrs.cha).toEqual({ level: 1, xp: 0 });
    expect(loaded.fused).toEqual([]);
    expect(loaded.stats['attr:wis']).toBe(7);
    expect(loaded.stats['attr:wil']).toBeUndefined();
    expect(loaded.stats.kills).toBe(3);
    expect(loaded.activity).toBe('train_wis');
  });

  it('nulls activity ids that no longer exist instead of loading them', () => {
    const raw = JSON.parse(v1Save());
    raw.activity = 'ancient_removed_activity';
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.activity).toBeNull();
  });
});

describe('attrValue resolution', () => {
  // Training milestones (+1 at 5/15/25..., ×1.01 at 10/20/30...) ride on top of
  // the trained level, so effective values are computed here rather than raw.
  const effStr15 = 17 * 1.01; // 15 + 2 flat milestones, ×1.01
  const effCha9 = 10; // 9 + 1 flat milestone

  it('returns the effective value while unfused', () => {
    const s = createInitialState(2);
    s.attrs.str.level = 15;
    s.attrs.cha.level = 9;
    expect(attrValue(s, 'str')).toBeCloseTo(effStr15, 5);
    expect(attrValue(s, 'cha')).toBeCloseTo(effCha9, 5);
  });

  it('returns the component sum for BOTH components once fused', () => {
    const s = createInitialState(2);
    s.attrs.str.level = 15;
    s.attrs.cha.level = 9;
    s.fused.push('dominion');
    expect(attrValue(s, 'str')).toBeCloseTo(effStr15 + effCha9, 5);
    expect(attrValue(s, 'cha')).toBeCloseTo(effStr15 + effCha9, 5);
    // Other attributes unaffected.
    expect(attrValue(s, 'dex')).toBe(1);
  });

  it('keeps growing as components keep leveling', () => {
    const s = createInitialState(2);
    s.fused.push('force');
    s.attrs.int.level = 60;
    s.attrs.con.level = 60;
    // Fusion sums the EFFECTIVE components (whatever milestones/ranks the
    // content currently grants) — read them from the pipeline, don't hardcode.
    let eff = effectiveAttrs(s);
    expect(attrValue(s, 'int')).toBeCloseTo(eff.int + eff.con, 5);
    const conBefore = eff.con;
    s.attrs.con.level = 61;
    eff = effectiveAttrs(s);
    expect(eff.con).toBeGreaterThan(conBefore);
    expect(attrValue(s, 'int')).toBeCloseTo(eff.int + eff.con, 5);
  });
});

describe('fusion redirects every check', () => {
  function fusedVsUnfused(mutate: (s: GameState) => void) {
    const a = createInitialState(3);
    const b = createInitialState(3);
    mutate(a);
    mutate(b);
    b.fused.push('dominion', 'force', 'martial_prowess');
    return [a, b] as const;
  }

  it('derived stats jump on fusion', () => {
    const [unfused, fused] = fusedVsUnfused((s) => {
      s.attrs.str.level = 30;
      s.attrs.cha.level = 30;
      s.attrs.con.level = 20;
      s.attrs.int.level = 20;
    });
    const before = getDerivedStats(unfused);
    const after = getDerivedStats(fused);
    // Effective components come from the live content (milestones/ranks) —
    // read them from the pipeline rather than hardcoding milestone math.
    // Damage = 2 base + 1.2×(fused STR) + 2 from the STR-21 training rank.
    const eff = effectiveAttrs(unfused);
    expect(after.damage).toBeCloseTo(2 + 1.2 * (eff.str + eff.cha) + 2, 5);
    expect(after.damage).toBeGreaterThan(before.damage * 1.8);
    expect(after.maxHp).toBe(Math.round(40 + 10 * (eff.con + eff.int)));
    // goldGain via cha 30 → 60
    expect(after.goldGain).toBeGreaterThan(before.goldGain);
  });

  it('unlock conditions on either component use the super-attribute', () => {
    const s = createInitialState(4);
    s.attrs.dex.level = 12;
    s.attrs.wis.level = 15;
    const dex20 = { type: 'attr', attr: 'dex', level: 20 } as const;
    expect(conditionMet(s, dex20)).toBe(false);
    s.fused.push('martial_prowess');
    expect(conditionMet(s, dex20)).toBe(true); // 12 + 15 = 27 ≥ 20
  });

  it('gold gain from charisma raises kill gold and sell prices', () => {
    const s = createInitialState(5);
    const cheapskate = sellPrice(s, s.inventory[0]);
    s.attrs.cha.level = 50;
    expect(sellPrice(s, s.inventory[0])).toBeGreaterThan(cheapskate);
  });
});

describe('fusion unlock trigger', () => {
  function readyForDominion(): Game {
    const g = new Game(createInitialState(6));
    g.state.attrs.str.level = 60;
    g.state.attrs.cha.level = 60;
    g.state.stats['kills'] = 500;
    g.state.stats['gold:earned'] = 25000;
    return g;
  }

  it('fuses when all provisional conditions hold and an event fires', () => {
    const g = readyForDominion();
    expect(isFused(g.state, 'dominion')).toBe(false);
    let unlockEvent = false;
    g.bus.on('superattr:unlock', (ev) => (unlockEvent = ev.id === 'dominion'));
    checkSuperUnlocks(g.state, g.bus);
    expect(isFused(g.state, 'dominion')).toBe(true);
    expect(unlockEvent).toBe(true);
    expect(g.state.log.some((l) => l.kind === 'fusion')).toBe(true);
    // Other supers stay locked.
    expect(isFused(g.state, 'force')).toBe(false);
  });

  it('does not fuse below thresholds, and fires via the event bus wiring', () => {
    const g = readyForDominion();
    g.state.stats['kills'] = 499;
    g.bus.emit({ type: 'attr:levelup', attr: 'str', level: 60 });
    expect(isFused(g.state, 'dominion')).toBe(false);
    // The 500th kill (bumped by the achievements listener) triggers fusion.
    g.state.combat = null;
    g.bus.emit({
      type: 'kill',
      monster: {
        defId: 'wolf', name: 'Wolf', icon: '🐺', level: 5, tier: 'veteran', modifier: 'normal',
        rarity: 'common', mutation: null, hp: 0, statuses: [], attrs: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
        xp: 1, gold: 0, range: 'melee', bar: 0, stunSpent: 0,
      },
    });
    expect(g.state.stats['kills']).toBe(500);
    expect(isFused(g.state, 'dominion')).toBe(true);
  });

  it('achievement thresholds catch the fused jump immediately', () => {
    const g = readyForDominion();
    // honed_body tiers at str 10/25/50: str 40 alone = 2 tiers; fused 80 = all 3.
    checkSuperUnlocks(g.state, g.bus);
    expect(g.state.achievements['honed_body']).toBe(3);
  });
});
