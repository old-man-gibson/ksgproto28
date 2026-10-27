import { describe, expect, it } from 'vitest';
import { conditionEffects, damageTipLines, describeMod, fmt, foodLines, immuneText, statusTipLines } from '../src/ui/lib/format';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { applyStatus, findStatus } from '../src/core/systems/statuses';
import { STATUSES } from '../src/core/registry';
import { RES_STAT_BY_TYPE, type DamageReport, type DamageSlice, type StatusDef } from '../src/core/types';

function slice(over: Partial<DamageSlice> = {}): DamageSlice {
  return {
    type: 'slashing', source: 'Iron Sword', raw: 100, armor: 0,
    resisted: 0, resistance: 0, pierced: 0, dealt: 100, ...over,
  };
}

function report(over: Partial<DamageReport> = {}): DamageReport {
  return {
    label: 'Your attack', target: 'Wolf', steps: [{ label: 'Damage', value: 100 }],
    slices: [slice()], hits: 1, crit: false, total: 100, ...over,
  };
}

describe('number formatting', () => {
  it('keeps small numbers readable', () => {
    expect(fmt(0)).toBe('0');
    expect(fmt(0.03)).toBe('0.03');
    expect(fmt(7.5)).toBe('7.5');
    expect(fmt(999)).toBe('999');
  });

  it('names the tiers it has suffixes for', () => {
    expect(fmt(1500)).toBe('1.50K');
    expect(fmt(7.9e12)).toBe('7.90T');
    expect(fmt(1e33)).toBe('1.00Dc');
  });

  it('every resistance reads as a percentage, whatever the element', () => {
    // resWater/Wind/Earth/Light/Dark once fell out of the hand-written percent
    // list and their skills read "+0.05 Water Resistance". The set is derived
    // from the damage-type table now; this holds it to ALL of them.
    for (const stat of Object.values(RES_STAT_BY_TYPE)) {
      const line = describeMod({ stat, op: 'add', value: 0.05 });
      expect(line, stat).toContain('%');
      expect(line, stat).toContain('5');
    }
  });

  it('switches to exponents past the named tiers instead of padding a suffix', () => {
    // Previously 1e36 read "1000Dc" and 1e290 rendered as a 291-digit string.
    expect(fmt(1e36)).toBe('1.00e36');
    expect(fmt(1e290)).toBe('1.00e290');
    expect(fmt(1.234e120).length).toBeLessThan(12);
  });

  it('never emits an undefined suffix or an unbounded digit string', () => {
    for (let exp = 3; exp < 308; exp += 7) {
      const out = fmt(Math.pow(10, exp));
      expect(out).not.toContain('undefined');
      expect(out.length).toBeLessThan(12);
    }
  });

  it('shows infinity rather than a broken number', () => {
    expect(fmt(Infinity)).toBe('∞');
  });
});

describe('damage tooltips', () => {
  const text = (r: DamageReport) => damageTipLines(r).map((l) => l.text).join('\n');

  it('stays short when nothing interfered with the blow', () => {
    const lines = text(report());
    expect(lines).toContain('Your attack → Wolf');
    expect(lines).toContain('Slashing — Iron Sword: 100 → 100');
    expect(lines).toContain('100 damage dealt');
    // No defence had a say, so no resisted/blocked/floor rows at all.
    expect(lines).not.toContain('resistance');
    expect(lines).not.toContain('Stopped');
  });

  it('names every type, its source, and what each defence took', () => {
    const lines = text(
      report({
        hits: 2,
        slices: [
          slice({ raw: 100, resisted: 25, resistance: 0.25, pierced: 0.35, dealt: 75 }),
          slice({ type: 'lightning', source: 'Minor Rune of Thunder', raw: 6, dealt: 6 }),
        ],
        total: 81,
      }),
    );
    expect(lines).toContain('Swing (×2 hits):');
    expect(lines).toContain('⛨ 25% resistance shed 25');
    expect(lines).toContain('⟂ penetration erased 35% of its Slashing resistance');
    expect(lines).toContain('Lightning — Minor Rune of Thunder: 6 → 6');
    expect(lines).toContain('Stopped 25 of 106 (23.6%)');
  });

  it('reads a vulnerability as damage added, not shed', () => {
    const lines = text(
      report({ slices: [slice({ resisted: -50, resistance: -0.5, dealt: 150 })], total: 150 }),
    );
    expect(lines).toContain('⚠ vulnerable to it — 50 extra (50%)');
    expect(lines).toContain('Vulnerability added 50');
  });

  it('explains a blow that armor swallowed whole but that still landed', () => {
    const lines = text(
      report({
        label: 'The Wolf', target: 'You', incoming: true,
        slices: [slice({ raw: 5, armor: 5, dealt: 1 })],
        total: 1,
      }),
    );
    expect(lines).toContain('🛡 armor absorbed 5');
    expect(lines).toContain('⤓ every blow lands for at least 1');
    expect(lines).toContain('1 damage taken');
  });
});

describe('affliction tooltips', () => {
  const g = () => new Game(createInitialState(1));

  it('spells out what a condition is doing, per second', () => {
    const game = g();
    applyStatus(game.state, game.state, { id: 'poison', intensity: 2 });
    const lines = statusTipLines(game.state, findStatus(game.state, 'poison')!);

    expect(lines[0]).toContain('Poisoned');
    // 0.05 flat × intensity 2 × 10 ticks = 1 poison damage per second.
    expect(lines.some((l) => l.includes('1 Poison per second'))).toBe(true);
    expect(lines.some((l) => l.includes('Stamina Regen'))).toBe(true);
    expect(lines.some((l) => l.includes('remaining'))).toBe(true);
  });

  it('explains how a condition with no timer actually ends', () => {
    const game = g();
    applyStatus(game.state, game.state, { id: 'bleeding', intensity: 1 });
    const lines = statusTipLines(game.state, findStatus(game.state, 'bleeding')!);
    expect(lines.some((l) => l.startsWith('Ends:'))).toBe(true);
    expect(lines.some((l) => l.includes('rest'))).toBe(true);
  });

  it('reports a source-authored cure rather than the default one', () => {
    const game = g();
    applyStatus(game.state, game.state, {
      id: 'on_fire',
      intensity: 1,
      duration: 'permanent',
      removal: [{ on: 'cure', tag: 'water', effect: 'remove' }],
    });
    const lines = statusTipLines(game.state, findStatus(game.state, 'on_fire')!);
    expect(lines.some((l) => l.includes('water'))).toBe(true);
  });

  it('shows what a wound has sealed off, and what a burn still owes', () => {
    const game = g();
    applyStatus(game.state, game.state, { id: 'lacerated', intensity: 2 });
    const cut = statusTipLines(game.state, findStatus(game.state, 'lacerated')!);
    expect(cut.some((l) => l.includes('HP is closed off'))).toBe(true);

    applyStatus(game.state, game.state, { id: 'blazing', intensity: 1 });
    const burn = statusTipLines(game.state, findStatus(game.state, 'blazing')!);
    expect(burn.some((l) => l.includes('Healing may undo only 50%'))).toBe(true);
  });
});

describe('immunity in the tooltips', () => {
  const ward: StatusDef = {
    id: 'test_ward',
    name: 'Warded',
    icon: '🛡️',
    desc: 'Test-only.',
    stacking: { mode: 'highest' },
    duration: null,
    removal: [{ on: 'combatEnd', effect: 'remove' }],
    immune: { elements: ['poison'] },
  };

  function withStatus(def: StatusDef, body: () => void) {
    STATUSES[def.id] = def;
    try {
      body();
    } finally {
      delete STATUSES[def.id];
    }
  }

  it('says which conditions are refused', () => {
    expect(immuneText({ elements: ['poison'] })).toBe('Immune to poison conditions');
    expect(immuneText({ ids: ['bleeding'] })).toBe('Immune to Bleeding');
    expect(immuneText({ elements: ['poison', 'acid'], ids: ['bleeding'] })).toBe(
      'Immune to poison conditions, acid conditions and Bleeding',
    );
  });

  it('a held status tooltip states it', () => {
    withStatus(ward, () => {
      const game = new Game(createInitialState(1));
      applyStatus(game.state, game.state, { id: 'test_ward', intensity: 1 });
      const lines = statusTipLines(game.state, findStatus(game.state, 'test_ward')!);
      expect(lines).toContain('— Immune to poison conditions');
    });
  });

  it('a granted status states it where a dish or spell previews what it grants', () => {
    withStatus({ ...ward, immune: { ids: ['bleeding', 'poison'] } }, () => {
      expect(conditionEffects('test_ward')).toContain('Immune to Bleeding and Poisoned');
    });
  });

  it('a status with no immunity says nothing about it', () => {
    const game = new Game(createInitialState(1));
    applyStatus(game.state, game.state, { id: 'poison', intensity: 1 });
    expect(statusTipLines(game.state, findStatus(game.state, 'poison')!).some((l) => /Immune/.test(l))).toBe(false);
  });
});

describe('what a dish does when eaten', () => {
  it('scales the granted status by the grade, as eating does', () => {
    const fair = foodLines('hearty_stew', 'c');
    const fine = foodLines('hearty_stew', 'b');
    expect(fair).toHaveLength(1);
    expect(fair[0]).toContain('Well Fed');
    expect(fine[0]).toContain('Well Fed');
    expect(fine[0]).not.toBe(fair[0]);
  });

  it('gives a duration in minutes and seconds, as the rest of the game does', () => {
    // Well Fed lasts 600 s; Seared Stew's Stoked 300 s; Braised Meat's Well Fed is stretched to 900 s.
    expect(foodLines('hearty_stew', 'c')[0]).toContain('⌛ 10m 0s');
    expect(foodLines('seared_stew', 'c')[0]).toContain('⌛ 5m 0s');
    expect(foodLines('braised_meat', 'c')[0]).toContain('⌛ 15m 0s');
    expect(foodLines('braised_meat', 'c')[0]).not.toMatch(/\d{3}s/);
  });

  it('a Refuse dish makes you ill instead of doing what it says', () => {
    const lines = foodLines('hearty_stew', 'f');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Queasy');
    expect(lines[0]).not.toContain('Well Fed');
  });

  it('is empty for a material that cannot be eaten', () => {
    expect(foodLines('raw_meat', 'c')).toEqual([]);
    expect(foodLines('no_such_thing', 'c')).toEqual([]);
  });
});
