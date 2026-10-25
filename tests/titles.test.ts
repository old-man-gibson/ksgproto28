// The countryside these tests stand on is SHELVED content; the fixture mounts it.
import './fixtures/shelved-world';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { getDerivedStats } from '../src/core/systems/derived';
import { checkTitleUnlocks, hasTitle, setTitle } from '../src/core/systems/titles';
import { migrate } from '../src/core/save/migrations';
import type { MonsterInstance } from '../src/core/types';

function killEvent(g: Game, defId: string): void {
  const monster: MonsterInstance = {
    defId, name: defId, icon: 'x', level: 5, tier: 'basic', modifier: 'normal',
    rarity: 'common', mutation: null, hp: 0, statuses: [], attrs: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    xp: 1, gold: 0, range: 'melee', bar: 0, stunSpent: 0,
  };
  g.state.combat = null;
  g.bus.emit({ type: 'kill', monster, xp: monster.xp });
}

describe('title unlocks', () => {
  it('simple threshold titles latch on the completing event', () => {
    const g = new Game(createInitialState(80));
    g.state.stats['kills'] = 99;
    expect(hasTitle(g.state, 'slayer')).toBe(false);

    killEvent(g, 'wolf'); // kills → 100
    expect(hasTitle(g.state, 'slayer')).toBe(true);
    expect(g.state.log.some((l) => l.msg.includes('Title earned'))).toBe(true);
  });

  it('complex purity deed: boss kill with ≤1 weapon family earns; 2 families does not', () => {
    const pure = new Game(createInitialState(81));
    pure.state.stats['weapon:families'] = 1;
    killEvent(pure, 'goblin_boss');
    expect(hasTitle(pure.state, 'first_blade')).toBe(true);

    const impure = new Game(createInitialState(82));
    impure.state.stats['weapon:families'] = 2;
    killEvent(impure, 'goblin_boss');
    expect(hasTitle(impure.state, 'first_blade')).toBe(false);

    // Breaking the restraint AFTER earning never revokes the title.
    pure.state.stats['weapon:families'] = 5;
    checkTitleUnlocks(pure.state, pure.bus);
    expect(hasTitle(pure.state, 'first_blade')).toBe(true);
  });

  it('passive bonuses apply once earned; equipped bonuses only while worn', () => {
    const g = new Game(createInitialState(83));
    const base = getDerivedStats(g.state).damage;

    g.state.stats['kills'] = 100;
    checkTitleUnlocks(g.state, g.bus);
    expect(hasTitle(g.state, 'slayer')).toBe(true);
    const withPassive = getDerivedStats(g.state).damage;
    expect(withPassive).toBeCloseTo(base * 1.02, 5); // slayer passive +2%

    g.setTitle('slayer');
    expect(getDerivedStats(g.state).damage).toBeCloseTo(base * 1.02 * 1.05, 5); // +5% worn
    g.setTitle(null);
    expect(getDerivedStats(g.state).damage).toBeCloseTo(withPassive, 5);
  });

  it('unearned titles cannot be worn', () => {
    const g = new Game(createInitialState(84));
    setTitle(g.state, g.bus, 'slayer');
    expect(g.state.title).toBeNull();
  });

  it('weapon families are tracked once each from combat attacks', () => {
    const g = new Game(createInitialState(85));
    g.state.spot = 'woods_edge';
    g.equip(1); // starting rusty_sword
    g.selectActivity('hunt');
    for (let i = 0; i < 300 && !g.state.stats['used:sword']; i++) g.tick();
    expect(g.state.stats['used:sword']).toBe(1);
    expect(g.state.stats['weapon:families']).toBe(1);
  });

  it('save migration v6 → v7 adds title fields', () => {
    const raw = { version: 6 } as Record<string, unknown>;
    migrate(raw, 7);
    expect(raw.titles).toEqual([]);
    expect(raw.title).toBeNull();
    expect(raw.version).toBe(7);
  });
});
