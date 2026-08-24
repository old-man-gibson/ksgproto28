import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { getDerivedStats } from '../src/core/systems/derived';
import { EVENT_WINDOW, evaluateTrigger } from '../src/core/systems/triggers';
import { MONSTER_ACTION_BAR } from '../src/core/systems/monsterStats';
import { activeRotation } from '../src/core/systems/combat';
import { migrate } from '../src/core/save/migrations';
import { inscribeArcane, preparedSpells } from '../src/core/systems/spellcraft';
import { createItem } from '../src/core/systems/runes';
import type { CombatState, MonsterInstance, SkillTrigger } from '../src/core/types';

/** Attributes that derive a wanted max HP — the formula is 12 + 7 × CON. */
function attrsForMaxHp(maxHp: number) {
  return { str: 0, dex: 0, con: (maxHp - 12) / 7, int: 0, wis: 0, cha: 0 };
}

function monster(over: Partial<MonsterInstance> = {}): MonsterInstance {
  return {
    defId: 'test_monster', name: 'Test', icon: '🐺', level: 5, tier: 'basic', modifier: 'normal',
    rarity: 'common', mutation: null, hp: 100, statuses: [], attrs: attrsForMaxHp(100),
    range: 'melee', bar: 0, stunSpent: 0, xp: 1, gold: 0, ...over,
  };
}

/** A live trigger context bound to the game's state. */
function ctxFor(g: Game, over: Partial<MonsterInstance> = {}) {
  const combat: CombatState = {
    enemies: [monster(over), null, null, null, null],
    playerBar: 0, momentum: 0, position: 'neutral', cooldowns: {}, buffs: [], events: {},
  };
  g.state.combat = combat;
  return { state: g.state, combat, stats: getDerivedStats(g.state) };
}

const trig = (t: Partial<SkillTrigger>): SkillTrigger => ({ conditions: [], ...t });

describe('skill trigger evaluation', () => {
  it('no trigger configured is always eligible', () => {
    const g = new Game(createInitialState(1));
    expect(evaluateTrigger(ctxFor(g), undefined)).toBe(true);
  });

  it('numeric thresholds pass and fail either side of the bound', () => {
    const g = new Game(createInitialState(2));
    const ctx = ctxFor(g, { hp: 25, attrs: attrsForMaxHp(100) }); // enemy at 25%
    const at = (value: number) => trig({ conditions: [{ subject: 'enemy.hpPct', op: '<=', value }] });
    expect(evaluateTrigger(ctx, at(30))).toBe(true);
    expect(evaluateTrigger(ctx, at(25))).toBe(true); // inclusive
    expect(evaluateTrigger(ctx, at(20))).toBe(false);
  });

  it('percent subjects normalise against the max, not raw values', () => {
    const g = new Game(createInitialState(3));
    const ctx = ctxFor(g, { hp: 300, attrs: attrsForMaxHp(1000) }); // 30% despite a big raw hp
    const cond = trig({ conditions: [{ subject: 'enemy.hpPct', op: '<=', value: 30 }] });
    expect(evaluateTrigger(ctx, cond)).toBe(true);
  });

  it('enum subjects match the selected vs the effective style', () => {
    const g = new Game(createInitialState(4));
    g.state.style = 'aggressive';
    const ctx = ctxFor(g);
    const is = (subject: string, value: string) => trig({ conditions: [{ subject, op: 'is', value }] });
    expect(evaluateTrigger(ctx, is('style.selected', 'aggressive'))).toBe(true);
    expect(evaluateTrigger(ctx, is('style.selected', 'balanced'))).toBe(false);
    expect(
      evaluateTrigger(ctx, trig({ conditions: [{ subject: 'style.selected', op: 'isNot', value: 'aggressive' }] })),
    ).toBe(false);
    // With no school weapon equipped the effective style is the plain stance.
    expect(evaluateTrigger(ctx, is('style.active', 'aggressive'))).toBe(true);
  });

  it('conditions AND together', () => {
    const g = new Game(createInitialState(5));
    const ctx = ctxFor(g, { hp: 25, attrs: attrsForMaxHp(100) });
    const both = trig({
      conditions: [
        { subject: 'enemy.hpPct', op: '<=', value: 30 },
        { subject: 'player.hpPct', op: '>=', value: 90 },
      ],
    });
    expect(evaluateTrigger(ctx, both)).toBe(true);
    g.state.resources.hp = 1; // player condition now fails
    expect(evaluateTrigger(ctx, both)).toBe(false);
  });

  it('an unknown subject is ignored rather than disabling the skill', () => {
    const g = new Game(createInitialState(6));
    const ctx = ctxFor(g);
    expect(evaluateTrigger(ctx, trig({ conditions: [{ subject: 'nope.gone', op: '>=', value: 1 }] }))).toBe(true);
  });

  it('enabled:false blocks the skill outright', () => {
    const g = new Game(createInitialState(7));
    expect(evaluateTrigger(ctxFor(g), trig({ enabled: false }))).toBe(false);
  });

  it('enemy.bar reads how close the enemy is to acting', () => {
    const g = new Game(createInitialState(15));
    const ctx = ctxFor(g);
    const windup = trig({ conditions: [{ subject: 'enemy.bar', op: '>=', value: 65 }] });
    expect(evaluateTrigger(ctx, windup)).toBe(false); // bar at 0
    ctx.combat.enemies[0]!.bar = MONSTER_ACTION_BAR * 0.7;
    expect(evaluateTrigger(ctx, windup)).toBe(true);
  });

  it('event gates pass only inside the event window', () => {
    const g = new Game(createInitialState(8));
    const ctx = ctxFor(g);
    const onHit = trig({ event: 'onHit' });
    expect(evaluateTrigger(ctx, onHit)).toBe(false); // never fired

    g.state.totalTicks = 100;
    ctx.combat.events.onHit = 100;
    expect(evaluateTrigger(ctx, onHit)).toBe(true);
    g.state.totalTicks = 100 + EVENT_WINDOW;
    expect(evaluateTrigger(ctx, onHit)).toBe(true); // still fresh
    g.state.totalTicks = 100 + EVENT_WINDOW + 1;
    expect(evaluateTrigger(ctx, onHit)).toBe(false); // stale
  });
});

describe('active-skill rotation', () => {
  /** A fighter whose ledger holds Gather and Heavy Blow. */
  function brawler(seed: number): Game {
    const g = new Game(createInitialState(seed));
    g.state.techniques = {
      gather: { executions: 0, form: 'canonical' },
      heavy_blow: { executions: 0, form: 'canonical' },
    };
    return g;
  }

  it('lists known techniques when the player has ordered nothing', () => {
    const g = brawler(9);
    expect(activeRotation(g.state)).toEqual(['technique:gather', 'technique:heavy_blow']);
  });

  it("honours the player's explicit order first", () => {
    const g = brawler(10);
    g.state.skillOrder = ['technique:heavy_blow'];
    expect(activeRotation(g.state)[0]).toBe('technique:heavy_blow');
    expect(activeRotation(g.state)).toContain('technique:gather'); // the rest still follow
  });

  it('only lists known entries, without duplicates', () => {
    const g = brawler(11);
    // Dupes, a technique not yet known, and a skill id that no longer exists.
    g.state.skillOrder = ['technique:gather', 'technique:gather', 'technique:riposte', 'heavy_swing'];
    expect(activeRotation(g.state)).toEqual(['technique:gather', 'technique:heavy_blow']);
  });

  it('moveSkill reorders the rotation', () => {
    const g = brawler(12);
    const first = activeRotation(g.state)[0];
    const second = activeRotation(g.state)[1];
    g.moveSkill(second, -1);
    expect(activeRotation(g.state)[0]).toBe(second);
    expect(activeRotation(g.state)[1]).toBe(first);
  });

  it('moveSkillTo places an entry before a target, or last for null', () => {
    const g = brawler(13);
    g.state.techniques.sidestep = { executions: 0, form: 'canonical' };
    const [a, b, c] = activeRotation(g.state);
    g.moveSkillTo(c, a); // last to first
    expect(activeRotation(g.state)).toEqual([c, a, b]);
    g.moveSkillTo(c, null); // first to last
    expect(activeRotation(g.state)).toEqual([a, b, c]);
    g.moveSkillTo(a, a); // onto itself: no-op
    expect(activeRotation(g.state)).toEqual([a, b, c]);
  });

  it('reordering steps across a HIDDEN entry rather than being eaten by it', () => {
    // The bug this guards: benched techniques stay in the order but are not
    // shown, so a visible-neighbour move must carry them along.
    const g = brawler(14);
    g.state.techniques.sidestep = { executions: 0, form: 'canonical' };
    const [a, hidden, c] = activeRotation(g.state);
    g.setSkillEnabled(hidden, false); // benched: invisible in the panel
    // The panel asks: put `c` before `a` (its visible predecessor).
    g.moveSkillTo(c, a);
    const order = activeRotation(g.state);
    expect(order[0]).toBe(c);
    expect(order).toContain(hidden); // still there, just travelled
    expect(order).toHaveLength(3);
  });
});

describe('loadouts', () => {
  function planned(seed: number): Game {
    const g = new Game(createInitialState(seed));
    g.state.techniques = {
      gather: { executions: 0, form: 'canonical' },
      heavy_blow: { executions: 0, form: 'canonical' },
      sidestep: { executions: 0, form: 'canonical' },
    };
    return g;
  }

  it('saves order, bench switches and drills; applying restores them', () => {
    const g = planned(20);
    g.moveSkillTo('technique:sidestep', 'technique:gather');
    g.setSkillEnabled('technique:heavy_blow', false);
    g.toggleDrill('gather');
    g.saveLoadout('duel');

    // Wander off the plan…
    g.moveSkillTo('technique:sidestep', null);
    g.setSkillEnabled('technique:heavy_blow', true);
    g.toggleDrill('gather');
    g.toggleDrill('sidestep');

    g.applyLoadout('duel');
    expect(activeRotation(g.state)[0]).toBe('technique:sidestep');
    expect(g.state.skillTriggers['technique:heavy_blow'].enabled).toBe(false);
    expect(g.state.drilling).toEqual(['gather']);
  });

  it('saving the same name overwrites; delete removes it', () => {
    const g = planned(21);
    g.saveLoadout('a');
    g.saveLoadout('a');
    expect(g.state.loadouts).toHaveLength(1);
    g.saveLoadout('  '); // blank names are refused
    expect(g.state.loadouts).toHaveLength(1);
    g.deleteLoadout('a');
    expect(g.state.loadouts).toHaveLength(0);
  });

  it('applying grants nothing: unknown ids stay inert, drills stay known', () => {
    const g = planned(22);
    g.state.loadouts.push({
      name: 'ghost',
      order: ['technique:iai_draw', 'technique:gather'],
      benched: [],
      drilling: ['iai_draw', 'gather'], // iai_draw is not in the ledger
    });
    g.applyLoadout('ghost');
    expect(activeRotation(g.state)).not.toContain('technique:iai_draw');
    expect(g.state.drilling).toEqual(['gather']);
  });

  // A loadout is a whole fighting identity, not just a rotation: the spells
  // you hold ready and the gear you wear come back with it.
  it('saves prepared spells and worn equipment, and restores both', () => {
    const g = planned(23);
    g.state.skills.arcana = { level: 12, xp: 0 };
    g.state.attrs.int.level = 20;
    const bolt = inscribeArcane(g.state, g.bus, ['fire', 'pierce'])!;
    g.prepareSpell(bolt.uid, true);
    const sword = createItem(g.state, 'iron_sword');
    g.state.inventory.push(sword);
    g.equip(sword.uid);
    g.saveLoadout('duellist');

    // Wander off the plan entirely…
    g.prepareSpell(bolt.uid, false);
    g.unequip('weapon');

    g.applyLoadout('duellist');
    expect(preparedSpells(g.state).map((s) => s.uid)).toEqual([bolt.uid]);
    expect(g.state.equipment.weapon?.uid).toBe(sword.uid);
  });

  // A plan is not just which moves are in the rotation, but when each one is
  // allowed to fire — the conditions ARE the build.
  it('saves firing conditions and restores them', () => {
    const g = planned(26);
    g.setSkillEvent('technique:gather', 'onCrit');
    g.addSkillCondition('technique:gather', { subject: 'player.hpPct', op: '<=', value: 40 });
    g.saveLoadout('careful');

    // Fiddle afterwards: a different event, an extra condition.
    g.setSkillEvent('technique:gather', 'onDodge');
    g.addSkillCondition('technique:gather', { subject: 'player.hpPct', op: '>=', value: 90 });

    g.applyLoadout('careful');
    const t = g.state.skillTriggers['technique:gather'];
    expect(t.event).toBe('onCrit');
    expect(t.conditions).toEqual([{ subject: 'player.hpPct', op: '<=', value: 40 }]);
  });

  it('the plan is the plan: an overlay added since is cleared, not merged', () => {
    const g = planned(27);
    g.saveLoadout('plain'); // nothing configured on anything
    g.addSkillCondition('technique:heavy_blow', { subject: 'player.hpPct', op: '>=', value: 50 });
    expect(g.state.skillTriggers['technique:heavy_blow'].conditions).toHaveLength(1);

    g.applyLoadout('plain');
    expect(g.state.skillTriggers['technique:heavy_blow']).toBeUndefined();
  });

  it('a saved plan never aliases live state — editing one cannot rewrite the other', () => {
    const g = planned(28);
    g.addSkillCondition('technique:gather', { subject: 'player.hpPct', op: '<=', value: 40 });
    g.saveLoadout('snapshot');
    // Mutate the live condition in place, the way the editor does.
    g.updateSkillCondition('technique:gather', 0, { value: 99 });
    expect(g.state.loadouts[0].triggers!['technique:gather'].conditions[0].value).toBe(40);

    g.applyLoadout('snapshot');
    expect(g.state.skillTriggers['technique:gather'].conditions[0].value).toBe(40);
    // And the reverse: editing after applying must not reach back into the plan.
    g.updateSkillCondition('technique:gather', 0, { value: 7 });
    expect(g.state.loadouts[0].triggers!['technique:gather'].conditions[0].value).toBe(40);
  });

  it('a plan from before triggers were captured still restores its bench switches', () => {
    const g = planned(29);
    g.state.loadouts.push({
      name: 'legacy',
      order: ['technique:gather', 'technique:heavy_blow'],
      benched: ['technique:heavy_blow'],
      drilling: [],
      // no `triggers` — this plan predates them
    });
    g.addSkillCondition('technique:gather', { subject: 'player.hpPct', op: '<=', value: 40 });

    g.applyLoadout('legacy');
    expect(g.state.skillTriggers['technique:heavy_blow'].enabled).toBe(false);
    expect(g.state.skillTriggers['technique:gather'].enabled).toBe(true);
    // It never knew about conditions, so it leaves them alone rather than wiping.
    expect(g.state.skillTriggers['technique:gather'].conditions).toHaveLength(1);
  });

  it('applying stands down spells the plan did not prepare', () => {
    const g = planned(24);
    g.state.skills.arcana = { level: 12, xp: 0 };
    g.state.attrs.int.level = 20;
    const kept = inscribeArcane(g.state, g.bus, ['fire'])!;
    g.prepareSpell(kept.uid, true);
    g.saveLoadout('one spell');

    const extra = inscribeArcane(g.state, g.bus, ['ice'])!;
    g.prepareSpell(extra.uid, true);
    expect(preparedSpells(g.state)).toHaveLength(2);

    g.applyLoadout('one spell');
    expect(preparedSpells(g.state).map((s) => s.uid)).toEqual([kept.uid]);
  });

  it('conjures nothing: a forgotten spell, a sold blade and unmet requirements all stay out', () => {
    const g = planned(25);
    const greatsword = createItem(g.state, 'steel_greatsword'); // needs STR 12
    g.state.inventory.push(greatsword);
    g.state.loadouts.push({
      name: 'wishful',
      order: [],
      benched: [],
      drilling: [],
      spells: [9999], // never inscribed
      equipment: { weapon: greatsword.uid, head: 4242 }, // one unowned uid
    });

    g.applyLoadout('wishful');
    expect(preparedSpells(g.state)).toHaveLength(0);
    expect(g.state.grimoire).toHaveLength(0); // nothing was written into the book
    expect(g.state.equipment.weapon).toBeUndefined(); // STR 1 cannot hold it
    expect(g.state.equipment.head).toBeUndefined();
    expect(g.state.inventory).toContain(greatsword); // and it stayed in the pack

    // Meet the requirement and the same plan now dresses you.
    g.state.attrs.str.level = 20;
    g.applyLoadout('wishful');
    expect(g.state.equipment.weapon?.uid).toBe(greatsword.uid);
  });
});

describe('save migration v28 → v29', () => {
  it('adds the loadout shelf', () => {
    const raw = { version: 28 } as Record<string, unknown>;
    migrate(raw, 29);
    expect(raw.loadouts).toEqual([]);
    expect(raw.version).toBe(29);
  });
});

describe('save migration v29 → v30', () => {
  it('widens existing plans to spells and equipment, as no-ops', () => {
    const raw = {
      version: 29,
      loadouts: [{ name: 'old', order: ['fighting'], benched: [], drilling: [] }],
    } as Record<string, unknown>;
    migrate(raw, 30);
    const [plan] = raw.loadouts as Record<string, unknown>[];
    expect(plan.spells).toEqual([]);
    expect(plan.equipment).toEqual({});
    expect(plan.order).toEqual(['fighting']); // the rotation half is untouched
    expect(raw.version).toBe(30);
  });
});

describe('save migration v9 → v10', () => {
  it('adds the rotation, triggers, and rolling feed', () => {
    const raw = { version: 9 } as Record<string, unknown>;
    migrate(raw, 10);
    expect(raw.skillOrder).toEqual([]);
    expect(raw.skillTriggers).toEqual({});
    expect(raw.combatFeed).toEqual([]);
    expect(raw.version).toBe(10);
  });
});
