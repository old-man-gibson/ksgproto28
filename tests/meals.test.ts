import { describe, expect, it } from 'vitest';
import { createInitialState, SAVE_VERSION } from '../src/core/state';
import { Game } from '../src/core/game';
import { STATUSES } from '../src/core/registry';
import { QUALITY_TIERS } from '../src/core/data/quality.data';
import { grantGraded } from '../src/core/systems/disciplines';
import { canUse, canUseOutOfFight, useConsumable } from '../src/core/systems/consumables';
import { eatPlan } from '../src/core/systems/eating';
import {
  MAX_ACTIVE_DISHES,
  activeMeals,
  dishLimit,
  mealToReplace,
  tickMealClaims,
} from '../src/core/systems/meals';
import { abandonCombat } from '../src/core/systems/combat';
import { brew, useFlask } from '../src/core/systems/alchemy';
import { getDerivedStats } from '../src/core/systems/derived';
import { applyStatus, findStatus, hasStatus } from '../src/core/systems/statuses';
import { cookedKey } from '../src/core/systems/cookbook';
import { migrate } from '../src/core/save/migrations';
import { deserialize, loadFromStorage, serialize, SAVE_KEY } from '../src/core/save/save';
import { text } from '../src/core/text/log';
import type { QualityTier } from '../src/core/types';
import { clearFloors } from './fixtures/floors';

/** A hunt in the Cages, between fights, with a stocked table. */
function hunting(seed = 3) {
  const g = new Game(createInitialState(seed));
  g.state.spot = 'the_cages';
  g.selectActivity('hunt');
  g.state.respawnTimer = 0;
  return g;
}

/** Hunting, with the fight already on. */
function fighting(seed = 3) {
  const g = hunting(seed);
  g.tick();
  expect(g.state.combat).not.toBeNull();
  return g;
}

const stock = (g: Game, ...ids: string[]) => {
  for (const id of ids) grantGraded(g.state, id, 'c', 5);
};
const logLines = (g: Game) => g.state.log.map((l) => l.msg);
const held = (g: Game, id: string) => findStatus(g.state, id);
const slots = (g: Game) => activeMeals(g.state).map((m) => m.slot.dish);

/** Four dishes that share no condition, so only the slot limit is under test. */
const FOUR = ['mushroom_broth', 'steeped_broth', 'skewered_fish', 'seared_stew'];

describe('dishes are eaten out of combat', () => {
  it('canUse refuses a dish while a fight is on, and nothing is spent', () => {
    const g = fighting();
    stock(g, 'hearty_stew');
    const check = canUse(g.state, 'hearty_stew', 'c');
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('Not during a fight.');
    expect(useConsumable(g.state, g.bus, 'hearty_stew', 'c')).toBeNull();
    expect(g.state.stock.hearty_stew!.c).toBe(5);
    expect(hasStatus(g.state, 'well_fed')).toBe(false);
  });

  it('a salve stays usable in a fight', () => {
    const g = fighting();
    grantGraded(g.state, 'healing_salve', 'c', 1);
    expect(canUse(g.state, 'healing_salve', 'c').ok).toBe(true);
    expect(useConsumable(g.state, g.bus, 'healing_salve', 'c')).not.toBeNull();
  });

  it('a flask stays drinkable in a fight', () => {
    const g = fighting();
    expect(drink(g)).not.toBeNull();
    expect(hasStatus(g.state, 'well_fed')).toBe(true);
  });

  it('the same dish is allowed the moment the fight is over', () => {
    const g = fighting();
    stock(g, 'hearty_stew');
    abandonCombat(g.state, g.bus);
    expect(g.state.combat).toBeNull();
    expect(canUse(g.state, 'hearty_stew', 'c').ok).toBe(true);
  });

  it('the respawn gap between chained hunt fights has no fight in it', () => {
    const g = fighting();
    stock(g, 'hearty_stew');
    abandonCombat(g.state, g.bus);
    expect(g.state.respawnTimer).toBeGreaterThan(5);
    g.step(3);
    expect(g.state.combat).toBeNull();
    expect(g.state.respawnTimer).toBeGreaterThan(0);
    expect(canUse(g.state, 'hearty_stew', 'c').ok).toBe(true);
    expect(useConsumable(g.state, g.bus, 'hearty_stew', 'c')).not.toBeNull();
  });

  it('a hunt resting before its next fight has no fight in it', () => {
    const g = hunting();
    stock(g, 'hearty_stew');
    g.state.resources.hp = getDerivedStats(g.state).maxHp * 0.2;
    g.setHuntRest(0.5, true);
    g.tick();
    expect(g.state.combat).toBeNull();
    expect(g.state.huntRest.active).toBe(true);
    expect(canUse(g.state, 'hearty_stew', 'c').ok).toBe(true);
  });

  it('canUseOutOfFight ignores the fight but not the stock', () => {
    const g = fighting();
    expect(canUseOutOfFight(g.state, 'hearty_stew', 'c').reason).toBe(text('consumables.reason.none_held'));
    stock(g, 'hearty_stew');
    expect(canUseOutOfFight(g.state, 'hearty_stew', 'c').ok).toBe(true);
  });
});

describe('eat after this fight', () => {
  it('pressing Eat in a fight queues the dish and spends nothing', () => {
    const g = fighting();
    stock(g, 'hearty_stew');
    expect(g.eat('hearty_stew', 'c')).toBe('queued');
    expect(g.state.queuedMeal).toEqual({ dish: 'hearty_stew', quality: 'c', why: 'fight' });
    expect(g.state.stock.hearty_stew!.c).toBe(5);
    expect(hasStatus(g.state, 'well_fed')).toBe(false);
    expect(logLines(g).some((l) => l.includes('queued') && l.includes('Hearty Stew'))).toBe(true);
  });

  it('only a dish queues: a salve pressed in a fight is used at once', () => {
    const g = fighting();
    grantGraded(g.state, 'healing_salve', 'c', 1);
    expect(g.eat('healing_salve', 'c')).toBe('ate');
    expect(g.state.queuedMeal).toBeNull();
  });

  it('a dish pressed out of a fight is eaten at once', () => {
    const g = hunting();
    stock(g, 'hearty_stew');
    abandonCombat(g.state, g.bus);
    expect(g.eat('hearty_stew', 'c')).toBe('ate');
    expect(g.state.queuedMeal).toBeNull();
    expect(hasStatus(g.state, 'well_fed')).toBe(true);
  });

  it('a dish you do not hold cannot be queued', () => {
    const g = fighting();
    expect(g.eat('hearty_stew', 'c')).toBe('refused');
    expect(g.state.queuedMeal).toBeNull();
  });

  it('pressing another dish replaces the pending one, and pressing the same one changes nothing', () => {
    const g = fighting();
    stock(g, 'hearty_stew', 'mushroom_broth');
    g.eat('hearty_stew', 'c');
    const lines = logLines(g).length;
    g.eat('hearty_stew', 'c');
    expect(logLines(g)).toHaveLength(lines);
    g.eat('mushroom_broth', 'c');
    expect(g.state.queuedMeal).toEqual({ dish: 'mushroom_broth', quality: 'c', why: 'fight' });
    expect(logLines(g).at(-1)).toContain('in place of Fair Hearty Stew');
    // A different grade of the same dish is a different pending dish too.
    grantGraded(g.state, 'mushroom_broth', 'b', 1);
    g.eat('mushroom_broth', 'b');
    expect(g.state.queuedMeal).toEqual({ dish: 'mushroom_broth', quality: 'b', why: 'fight' });
  });

  it('can be cancelled', () => {
    const g = fighting();
    stock(g, 'hearty_stew');
    g.eat('hearty_stew', 'c');
    expect(g.cancelQueuedMeal()).toBe(true);
    expect(g.state.queuedMeal).toBeNull();
    expect(g.cancelQueuedMeal()).toBe(false);
    abandonCombat(g.state, g.bus);
    g.tick();
    expect(hasStatus(g.state, 'well_fed')).toBe(false);
    expect(g.state.stock.hearty_stew!.c).toBe(5);
  });

  it('stays queued for as long as the fight lasts', () => {
    const g = fighting();
    stock(g, 'hearty_stew');
    g.eat('hearty_stew', 'c');
    let inFight = 0;
    for (let i = 0; i < 20 && g.state.combat; i++) {
      g.tick();
      if (g.state.combat) {
        inFight += 1;
        expect(g.state.queuedMeal).not.toBeNull();
        expect(hasStatus(g.state, 'well_fed')).toBe(false);
      }
    }
    expect(inFight).toBeGreaterThan(3);
  });

  it('is eaten on the first tick with no fight, and says it was queued', () => {
    const g = fighting();
    stock(g, 'hearty_stew');
    g.eat('hearty_stew', 'c');
    abandonCombat(g.state, g.bus);
    g.tick();
    expect(g.state.queuedMeal).toBeNull();
    expect(hasStatus(g.state, 'well_fed')).toBe(true);
    expect(g.state.stock.hearty_stew!.c).toBe(4);
    expect(logLines(g)).toContain(
      `🍲 Ate ${QUALITY_TIERS.c.name} Hearty Stew (queued during the fight).`,
    );
    expect(slots(g)).toEqual(['hearty_stew']);
  });

  it('a Signature rides along, and the line names it', () => {
    const g = fighting();
    g.state.stats[cookedKey('hearty_stew')] = 100;
    stock(g, 'hearty_stew');
    g.eat('hearty_stew', 'c');
    abandonCombat(g.state, g.bus);
    g.tick();
    expect(logLines(g).at(-1)).toMatch(/\(queued during the fight\)\. Signature: also Stoked/);
  });

  it('waits through a knockout recovery, then eats the tick recovery ends', () => {
    const g = fighting();
    stock(g, 'hearty_stew');
    g.eat('hearty_stew', 'c');
    // The fight ends with the player on the floor.
    abandonCombat(g.state, g.bus);
    g.state.recovering = true;
    g.state.resources.hp = 1;
    g.step(30);
    expect(g.state.recovering).toBe(true);
    expect(g.state.queuedMeal).not.toBeNull();
    expect(hasStatus(g.state, 'well_fed')).toBe(false);
    expect(g.state.stock.hearty_stew!.c).toBe(5);
    // Back on their feet: the dish is eaten on the first tick that opens with
    // no recovery, at its full length (it did not burn down on the floor).
    g.state.resources.hp = getDerivedStats(g.state).maxHp;
    g.tick();
    expect(g.state.recovering).toBe(false);
    expect(g.state.queuedMeal).not.toBeNull();
    g.tick();
    expect(g.state.queuedMeal).toBeNull();
    expect(held(g, 'well_fed')!.ticksLeft).toBeGreaterThanOrEqual(STATUSES.well_fed.duration! - 1);
  });

  it('survives an actual knockout: queued in the fight, eaten after the recovery', () => {
    const g = fighting();
    stock(g, 'hearty_stew');
    g.eat('hearty_stew', 'c');
    g.state.resources.hp = 0;
    let downed = false;
    for (let i = 0; i < 400 && !downed; i++) {
      g.tick();
      if (g.state.recovering) downed = true;
    }
    expect(downed).toBe(true);
    expect(g.state.queuedMeal).not.toBeNull();
    expect(hasStatus(g.state, 'well_fed')).toBe(false);
    for (let i = 0; i < 20000 && g.state.recovering; i++) g.tick();
    expect(g.state.recovering).toBe(false);
    expect(g.state.queuedMeal).not.toBeNull();
    g.tick();
    expect(g.state.queuedMeal).toBeNull();
    expect(hasStatus(g.state, 'well_fed')).toBe(true);
  });

  it('checks the stock again when it fires, drops the queue and says why', () => {
    const g = fighting();
    stock(g, 'hearty_stew');
    g.eat('hearty_stew', 'c');
    delete g.state.stock.hearty_stew;
    abandonCombat(g.state, g.bus);
    g.tick();
    expect(g.state.queuedMeal).toBeNull();
    expect(hasStatus(g.state, 'well_fed')).toBe(false);
    expect(logLines(g).at(-1)).toContain('not eaten: None held');
  });

  it('is part of the save, and a reload keeps the order to eat', () => {
    const g = fighting();
    stock(g, 'hearty_stew');
    g.eat('hearty_stew', 'c');
    const loaded = deserialize(serialize(g.state));
    expect(loaded.combat).toBeNull();
    expect(loaded.queuedMeal).toEqual({ dish: 'hearty_stew', quality: 'c', why: 'fight' });
    const g2 = new Game(loaded);
    g2.tick();
    expect(g2.state.queuedMeal).toBeNull();
    expect(hasStatus(g2.state, 'well_fed')).toBe(true);
  });

  it('the plan names what the button will do', () => {
    const g = fighting();
    stock(g, 'hearty_stew');
    expect(eatPlan(g.state, 'hearty_stew', 'c')).toMatchObject({ mode: 'queue', queued: false });
    g.eat('hearty_stew', 'c');
    expect(eatPlan(g.state, 'hearty_stew', 'c')).toMatchObject({ mode: 'queue', queued: true });
    expect(eatPlan(g.state, 'mushroom_broth', 'c')).toMatchObject({ mode: 'blocked', reason: 'None held' });
    abandonCombat(g.state, g.bus);
    expect(eatPlan(g.state, 'hearty_stew', 'c').mode).toBe('eat');
  });
});

/** A Cages hunt with the fight over and nothing left to start one: time moves only when a test steps it. */
function idle(seed = 3) {
  const g = hunting(seed);
  abandonCombat(g.state, g.bus);
  g.state.activity = null;
  return g;
}

/** The time a dish in a slot has left, on its own clocks. */
const own = (g: Game, dish: string): number | null | undefined =>
  activeMeals(g.state).find((m) => m.slot.dish === dish)?.ticksLeft;

/** A dish's own claim on a condition. */
const claim = (g: Game, dish: string, id: string) =>
  g.state.meals.find((m) => m.dish === dish)?.claims.find((c) => c.id === id);

/**
 * Cut a dish's own clock on a condition to `ticks`, and the condition's with it
 * (it is that dish's claim that leads), so a test need not wait out minutes to make
 * one dish the shortest. Only for a dish that leads its condition.
 */
function shorten(g: Game, dish: string, id: string, ticks: number) {
  claim(g, dish, id)!.left = ticks;
  held(g, id)!.ticksLeft = ticks;
}

/** Drink a Mendroot elixir through the game (Fair: Well Fed x0.65 for 450; Divine: x2.6 for 450). */
function drink(g: Game, quality: QualityTier = 'c') {
  grantGraded(g.state, 'spring_water', quality, 1);
  grantGraded(g.state, 'mendroot', quality, 1);
  g.state.skills.alchemy = { level: 40, xp: 0 };
  brew(g.state, g.bus, { step1: { id: 'spring_water', quality }, step2: { id: 'mendroot', quality } });
  return g.useFlask(0)!;
}

describe('eat after recovering', () => {
  /** Knocked out, no fight on, a stew in the pack. */
  function floored() {
    const g = idle();
    stock(g, 'hearty_stew', 'healing_salve');
    g.state.recovering = true;
    g.state.resources.hp = 1;
    return g;
  }

  it('a dish pressed while knocked out waits, and spends nothing', () => {
    const g = floored();
    expect(eatPlan(g.state, 'hearty_stew', 'c')).toMatchObject({ mode: 'queue', wait: 'recovery' });
    expect(g.eat('hearty_stew', 'c')).toBe('queued');
    expect(g.state.queuedMeal).toEqual({ dish: 'hearty_stew', quality: 'c', why: 'recovery' });
    expect(g.state.stock.hearty_stew!.c).toBe(5);
    expect(hasStatus(g.state, 'well_fed')).toBe(false);
    expect(logLines(g).at(-1)).toContain('it is eaten when you are back on your feet');
  });

  it('is eaten the tick after the recovery ends, at full length, and says so', () => {
    const g = floored();
    g.eat('hearty_stew', 'c');
    g.step(30);
    expect(g.state.recovering).toBe(true);
    expect(g.state.queuedMeal).not.toBeNull();
    expect(slots(g)).toEqual([]);
    g.state.resources.hp = getDerivedStats(g.state).maxHp;
    g.tick();
    expect(g.state.recovering).toBe(false);
    g.tick();
    expect(g.state.queuedMeal).toBeNull();
    expect(logLines(g)).toContain(`🍲 Ate ${QUALITY_TIERS.c.name} Hearty Stew (queued while knocked out).`);
    expect(own(g, 'hearty_stew')!).toBeGreaterThanOrEqual(STATUSES.well_fed.duration! - 1);
  });

  it('a salve is still used at once while knocked out', () => {
    const g = floored();
    expect(g.eat('healing_salve', 'c')).toBe('ate');
    expect(g.state.queuedMeal).toBeNull();
  });

  it('a dish queued in the fight keeps the fight wording when a knockout comes first', () => {
    const g = fighting();
    stock(g, 'hearty_stew');
    g.eat('hearty_stew', 'c');
    abandonCombat(g.state, g.bus);
    g.state.recovering = true;
    g.state.resources.hp = 1;
    g.step(5);
    g.state.resources.hp = getDerivedStats(g.state).maxHp;
    g.step(3);
    expect(logLines(g)).toContain(`🍲 Ate ${QUALITY_TIERS.c.name} Hearty Stew (queued during the fight).`);
  });
});

describe('at most three dishes active', () => {
  it('the limit is one constant behind one function', () => {
    expect(MAX_ACTIVE_DISHES).toBe(3);
    expect(dishLimit(createInitialState(1))).toBe(3);
  });

  it('a dish holds one slot with everything it gave, Signature included', () => {
    const g = idle();
    g.state.stats[cookedKey('hearty_stew')] = 100;
    stock(g, 'hearty_stew');
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    const meals = activeMeals(g.state);
    expect(meals).toHaveLength(1);
    expect(meals[0].slot.claims.map((c) => c.id).sort()).toEqual(['stoked', 'well_fed']);
    expect(meals[0].ticksLeft).toBe(STATUSES.well_fed.duration);
    expect(claim(g, 'hearty_stew', 'stoked')!.left).toBe(STATUSES.stoked.duration);
  });

  it('eating a dish that is already active renews its slot instead of taking another', () => {
    const g = idle();
    stock(g, 'hearty_stew', 'mushroom_broth');
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    useConsumable(g.state, g.bus, 'mushroom_broth', 'c');
    g.step(2000);
    expect(own(g, 'hearty_stew')!).toBeLessThan(STATUSES.well_fed.duration! - 1500);
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    expect(slots(g)).toEqual(['mushroom_broth', 'hearty_stew']);
    expect(own(g, 'hearty_stew')).toBe(STATUSES.well_fed.duration);
    expect(held(g, 'well_fed')!.ticksLeft).toBe(STATUSES.well_fed.duration);
    expect(g.state.stock.hearty_stew!.c).toBe(3);
  });

  it('a second helping at a worse grade keeps the better grade on the slot', () => {
    const g = idle();
    grantGraded(g.state, 'hearty_stew', 'b', 1);
    grantGraded(g.state, 'hearty_stew', 'd', 1);
    useConsumable(g.state, g.bus, 'hearty_stew', 'b');
    useConsumable(g.state, g.bus, 'hearty_stew', 'd');
    expect(activeMeals(g.state)).toHaveLength(1);
    expect(activeMeals(g.state)[0].slot.quality).toBe('b');
  });

  it('the fourth different dish replaces the one with the least time left, and its conditions end', () => {
    const g = idle();
    stock(g, ...FOUR);
    const [a, b, c, d] = FOUR;
    useConsumable(g.state, g.bus, a, 'c'); // clear_headed, 4800
    g.step(300);
    useConsumable(g.state, g.bus, b, 'c'); // steeped, 6000
    g.step(300);
    useConsumable(g.state, g.bus, c, 'c'); // steady_hand, 4800
    expect(slots(g)).toEqual([a, b, c]);
    // a has run 600 ticks, c none: a has the least left.
    expect(own(g, a)!).toBeLessThan(own(g, c)!);
    expect(own(g, a)!).toBeLessThan(own(g, b)!);
    expect(mealToReplace(g.state, d)!.slot.dish).toBe(a);
    useConsumable(g.state, g.bus, d, 'c');
    expect(slots(g)).toEqual([b, c, d]);
    expect(hasStatus(g.state, 'clear_headed')).toBe(false);
    expect(hasStatus(g.state, 'steeped')).toBe(true);
    expect(hasStatus(g.state, 'steady_hand')).toBe(true);
    expect(hasStatus(g.state, 'stoked')).toBe(true);
    expect(logLines(g).at(-1)).toContain(
      'Fair Mushroom Broth dropped for Fair Seared Stew: at most 3 dishes can be active. Ended: Clear-Headed.',
    );
    // The stock of the replaced dish is spent, not returned.
    expect(g.state.stock[a]!.c).toBe(4);
  });

  it('a replaced dish stops giving its stats at once (the derived cache sees it)', () => {
    const g = idle();
    stock(g, 'hearty_stew', 'mushroom_broth', 'steeped_broth', 'skewered_fish');
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    const fed = getDerivedStats(g.state).maxHp;
    g.step(5950); // the stew has 50 ticks left
    useConsumable(g.state, g.bus, 'mushroom_broth', 'c');
    useConsumable(g.state, g.bus, 'steeped_broth', 'c');
    useConsumable(g.state, g.bus, 'skewered_fish', 'c');
    expect(slots(g)).toEqual(['mushroom_broth', 'steeped_broth', 'skewered_fish']);
    expect(hasStatus(g.state, 'well_fed')).toBe(false);
    expect(getDerivedStats(g.state).maxHp).toBe(fed - 8);
  });

  it('equal time goes to the dish eaten first', () => {
    const g = idle();
    stock(g, ...FOUR);
    // Broth and fish both run 4800 and were eaten on the same tick; the broth was first.
    for (const id of FOUR.slice(0, 3)) useConsumable(g.state, g.bus, id, 'c');
    expect(own(g, FOUR[0])).toBe(own(g, FOUR[2]));
    useConsumable(g.state, g.bus, FOUR[3], 'c');
    expect(slots(g)).toEqual([FOUR[1], FOUR[2], FOUR[3]]);
  });

  it('a slot frees when its dish runs out, so the next dish replaces nobody', () => {
    const g = idle();
    stock(g, 'seared_stew', 'steeped_broth', 'skewered_fish', 'mushroom_broth');
    for (const id of ['seared_stew', 'steeped_broth', 'skewered_fish']) useConsumable(g.state, g.bus, id, 'c');
    g.step(STATUSES.stoked.duration! + 1); // the stew's Stoked, 3000, runs out first
    expect(hasStatus(g.state, 'stoked')).toBe(false);
    expect(slots(g)).toEqual(['steeped_broth', 'skewered_fish']);
    expect(g.state.meals.map((s) => s.dish)).toEqual(['steeped_broth', 'skewered_fish']);
    useConsumable(g.state, g.bus, 'mushroom_broth', 'c');
    expect(slots(g)).toEqual(['steeped_broth', 'skewered_fish', 'mushroom_broth']);
    expect(hasStatus(g.state, 'steeped')).toBe(true);
    expect(hasStatus(g.state, 'steady_hand')).toBe(true);
    expect(logLines(g).filter((l) => l.includes('dropped for'))).toHaveLength(0);
  });

  it('a dish whose conditions are cleared another way frees its slot too', () => {
    const g = idle();
    stock(g, 'hearty_stew');
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    g.state.statuses.length = 0;
    expect(activeMeals(g.state)).toHaveLength(0);
    g.tick();
    expect(g.state.meals).toHaveLength(0);
  });

  it('a dish that gave nothing nourishing holds no slot and evicts nobody', () => {
    const g = idle();
    stock(g, ...FOUR.slice(0, 3), 'scorched_mess');
    for (const id of FOUR.slice(0, 3)) useConsumable(g.state, g.bus, id, 'c');
    expect(eatPlan(g.state, 'scorched_mess', 'c').replaces).toBeUndefined();
    useConsumable(g.state, g.bus, 'scorched_mess', 'c');
    expect(hasStatus(g.state, 'queasy')).toBe(true);
    expect(slots(g)).toEqual(FOUR.slice(0, 3));
  });

  it('a spoiled helping of a real dish holds no slot either', () => {
    const g = idle();
    stock(g, ...FOUR.slice(0, 3));
    grantGraded(g.state, 'hearty_stew', 'f', 1);
    for (const id of FOUR.slice(0, 3)) useConsumable(g.state, g.bus, id, 'c');
    expect(eatPlan(g.state, 'hearty_stew', 'f').replaces).toBeUndefined();
    useConsumable(g.state, g.bus, 'hearty_stew', 'f');
    expect(slots(g)).toEqual(FOUR.slice(0, 3));
  });

  it('a food condition already running (an old save) holds no slot and counts toward nothing', () => {
    const g = idle();
    applyStatus(g.state, g.state, { id: 'well_fed', intensity: 1 }, 'Old Stew');
    stock(g, ...FOUR.slice(0, 3));
    for (const id of FOUR.slice(0, 3)) useConsumable(g.state, g.bus, id, 'c');
    expect(slots(g)).toEqual(FOUR.slice(0, 3));
    expect(hasStatus(g.state, 'well_fed')).toBe(true);
  });

  it('the plan tells the fourth dish which one it replaces, and an active dish that it renews', () => {
    const g = idle();
    stock(g, ...FOUR);
    for (const id of FOUR.slice(0, 3)) {
      useConsumable(g.state, g.bus, id, 'c');
      g.step(100);
    }
    expect(eatPlan(g.state, FOUR[3], 'c').replaces!.slot.dish).toBe(FOUR[0]);
    expect(eatPlan(g.state, FOUR[1], 'c').replaces).toBeUndefined();
    // The first dish runs out (4800, eaten 300 ticks ago): a free slot replaces nobody.
    g.step(4500);
    expect(slots(g)).not.toContain(FOUR[0]);
    expect(eatPlan(g.state, FOUR[3], 'c').replaces).toBeUndefined();
  });

  it('a queued fourth dish replaces by the time left when it is eaten, not when it was queued', () => {
    const g = idle();
    stock(g, ...FOUR);
    useConsumable(g.state, g.bus, 'steeped_broth', 'c'); // 6000
    g.step(5000); // 1000 left: the shortest once the others are eaten
    useConsumable(g.state, g.bus, 'mushroom_broth', 'c');
    useConsumable(g.state, g.bus, 'skewered_fish', 'c');
    g.state.queuedMeal = { dish: 'seared_stew', quality: 'c', why: 'fight' };
    g.tick();
    expect(slots(g)).toEqual(['mushroom_broth', 'skewered_fish', 'seared_stew']);
  });
});

describe('claims: every dose has a clock of its own', () => {
  it('the dish the screen named is the dish that goes, even when the new dose raises its condition', () => {
    const g = idle();
    stock(g, 'hearty_stew', 'mushroom_broth', 'steeped_broth');
    grantGraded(g.state, 'berry_pie', 'b', 1);
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    g.step(5950); // the stew has 5 seconds left
    useConsumable(g.state, g.bus, 'mushroom_broth', 'c'); // 4800
    useConsumable(g.state, g.bus, 'steeped_broth', 'c');
    const plan = eatPlan(g.state, 'berry_pie', 'b');
    expect(plan.replaces!.slot.dish).toBe('hearty_stew');
    expect(plan.replaces!.ticksLeft!).toBeLessThanOrEqual(50);
    useConsumable(g.state, g.bus, 'berry_pie', 'b'); // a Fine pie: Well Fed x1.6
    expect(slots(g)).toEqual(['mushroom_broth', 'steeped_broth', 'berry_pie']);
    expect(logLines(g).filter((l) => l.includes('dropped for')).at(-1)).toContain(
      'Fair Hearty Stew dropped for Fine Berry Pie',
    );
    // The broth is untouched, and Well Fed is the pie's, at the pie's own time.
    expect(own(g, 'mushroom_broth')!).toBeGreaterThan(4700);
    expect(hasStatus(g.state, 'clear_headed')).toBe(true);
    const pie = claim(g, 'berry_pie', 'well_fed')!;
    expect(pie.dose).toBeGreaterThan(1);
    expect(held(g, 'well_fed')!.intensity).toBe(pie.dose);
    expect(held(g, 'well_fed')!.ticksLeft).toBe(pie.left);
    expect(own(g, 'berry_pie')).toBe(pie.left);
  });

  it('re-eating a dish never extends a stronger dose another source made', () => {
    const g = idle();
    stock(g, 'hearty_stew');
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    const spec = drink(g, 's'); // Divine: Well Fed x2.6 for 450
    const dose = spec.grants[0].intensity!;
    const span = spec.grants[0].duration as number;
    expect(held(g, 'well_fed')!.intensity).toBe(dose);
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    // The flask is still the strength, and still only for its own 450 ticks.
    expect(held(g, 'well_fed')!.intensity).toBe(dose);
    expect(held(g, 'well_fed')!.ticksLeft!).toBeLessThanOrEqual(span);
    // The stew's own clock is renewed in full, though.
    expect(own(g, 'hearty_stew')).toBe(STATUSES.well_fed.duration);
    // Tick by tick: the flask's strength never outlasts the flask.
    let flaskTicks = 0;
    for (let i = 0; i < span + 20; i++) {
      g.tick();
      if (held(g, 'well_fed')!.intensity === dose) flaskTicks += 1;
    }
    expect(flaskTicks).toBeLessThanOrEqual(span);
    expect(held(g, 'well_fed')!.intensity).toBe(1);
    expect(held(g, 'well_fed')!.ticksLeft!).toBeGreaterThan(STATUSES.well_fed.duration! - span - 40);
    // Handed over before it could expire: no "has passed" in between.
    expect(logLines(g).some((l) => l.includes('Well Fed has passed'))).toBe(false);
  });

  it('a flask claim lapses: the dish evicted after it does takes the condition with it', () => {
    const g = idle();
    stock(g, 'hearty_stew', ...FOUR.slice(0, 3));
    const spec = drink(g, 'c'); // Fair: Well Fed x0.65 for 450
    const span = spec.grants[0].duration as number;
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    expect(g.state.foreignClaims.map((c) => c.id)).toEqual(['well_fed']);
    g.step(5700); // the flask ran out long ago; the stew has 300 left
    expect(span).toBeLessThan(5700);
    expect(g.state.foreignClaims).toEqual([]);
    for (const id of FOUR.slice(0, 3)) useConsumable(g.state, g.bus, id, 'c');
    // The stew had the least time left and went; nothing else gives Well Fed.
    expect(slots(g)).toEqual(FOUR.slice(0, 3));
    expect(hasStatus(g.state, 'well_fed')).toBe(false);
    expect(logLines(g).at(-1)).toContain('Ended: Well Fed.');
  });

  it("an old save's running condition lapses the same way", () => {
    const g = idle();
    stock(g, 'hearty_stew', ...FOUR.slice(0, 3));
    applyStatus(g.state, g.state, { id: 'well_fed', intensity: 0.65, duration: 450 }, 'Old Stew');
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    expect(g.state.foreignClaims).toEqual([{ id: 'well_fed', dose: 0.65, left: 450 }]);
    g.step(5700);
    expect(g.state.foreignClaims).toEqual([]);
    for (const id of FOUR.slice(0, 3)) useConsumable(g.state, g.bus, id, 'c');
    expect(slots(g)).toEqual(FOUR.slice(0, 3));
    expect(hasStatus(g.state, 'well_fed')).toBe(false);
  });

  it("while the flask is live, the evicted dish leaves the flask's dose and its remaining time", () => {
    const g = idle();
    stock(g, 'hearty_stew', ...FOUR.slice(0, 3));
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    g.step(5400); // the stew has 600 left
    const spec = drink(g, 'c'); // Well Fed x0.65 for 450: weaker than the stew, so the condition ignores it
    const dose = spec.grants[0].intensity!;
    expect(held(g, 'well_fed')!.intensity).toBe(1);
    useConsumable(g.state, g.bus, FOUR[0], 'c');
    useConsumable(g.state, g.bus, FOUR[1], 'c');
    expect(mealToReplace(g.state, FOUR[2])!.slot.dish).toBe('hearty_stew');
    useConsumable(g.state, g.bus, FOUR[2], 'c');
    expect(slots(g)).toEqual(FOUR.slice(0, 3));
    // The condition is now the flask's: its dose, its remaining time.
    expect(held(g, 'well_fed')!.intensity).toBe(dose);
    expect(held(g, 'well_fed')!.ticksLeft).toBe(g.state.foreignClaims[0].left);
    expect(held(g, 'well_fed')!.ticksLeft!).toBeLessThanOrEqual(450);
    expect(logLines(g).at(-1)).toContain('Still given by another dish or source: Well Fed.');
    g.step(460);
    expect(hasStatus(g.state, 'well_fed')).toBe(false);
  });

  it('evicting the stronger of two dishes drops the condition to the other dish, at its dose and time', () => {
    const g = idle();
    stock(g, 'hearty_stew', 'steeped_broth', 'mushroom_broth');
    grantGraded(g.state, 'berry_pie', 'b', 1);
    useConsumable(g.state, g.bus, 'berry_pie', 'b'); // Well Fed x1.6, eaten first
    g.step(100);
    useConsumable(g.state, g.bus, 'hearty_stew', 'c'); // Well Fed x1: the pie still leads
    expect(held(g, 'well_fed')!.intensity).toBe(claim(g, 'berry_pie', 'well_fed')!.dose);
    g.step(100);
    useConsumable(g.state, g.bus, 'steeped_broth', 'c');
    // The pie has run 200 ticks, the stew 100, the steeped broth none: the pie has the least left.
    expect(mealToReplace(g.state, 'mushroom_broth')!.slot.dish).toBe('berry_pie');
    useConsumable(g.state, g.bus, 'mushroom_broth', 'c');
    expect(slots(g)).toEqual(['hearty_stew', 'steeped_broth', 'mushroom_broth']);
    const stew = claim(g, 'hearty_stew', 'well_fed')!;
    expect(stew.dose).toBe(1);
    expect(held(g, 'well_fed')!.intensity).toBe(1);
    expect(held(g, 'well_fed')!.ticksLeft).toBe(stew.left);
    expect(own(g, 'hearty_stew')).toBe(stew.left);
    expect(logLines(g).at(-1)).toContain('Still given by another dish or source: Well Fed.');
  });

  it('evicting the weaker of two dishes leaves the stronger one as it was', () => {
    const g = idle();
    stock(g, 'hearty_stew', 'steeped_broth', 'mushroom_broth');
    grantGraded(g.state, 'berry_pie', 'b', 1);
    useConsumable(g.state, g.bus, 'hearty_stew', 'c'); // eaten first: the least time left
    g.step(100);
    useConsumable(g.state, g.bus, 'berry_pie', 'b');
    const lead = { ...claim(g, 'berry_pie', 'well_fed')! };
    useConsumable(g.state, g.bus, 'steeped_broth', 'c');
    useConsumable(g.state, g.bus, 'mushroom_broth', 'c');
    expect(slots(g)).toEqual(['berry_pie', 'steeped_broth', 'mushroom_broth']);
    expect(held(g, 'well_fed')!.intensity).toBe(lead.dose);
    expect(held(g, 'well_fed')!.ticksLeft).toBe(own(g, 'berry_pie'));
  });

  it('two dishes of different grades: the first to go keeps it, the last to go ends it', () => {
    const g = idle();
    stock(g, 'hearty_stew', 'steeped_broth', 'mushroom_broth', 'skewered_fish');
    grantGraded(g.state, 'berry_pie', 'b', 2);
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    g.step(50);
    useConsumable(g.state, g.bus, 'berry_pie', 'b');
    useConsumable(g.state, g.bus, 'steeped_broth', 'c');
    expect(held(g, 'well_fed')!.intensity).toBeGreaterThan(1);
    useConsumable(g.state, g.bus, 'mushroom_broth', 'c'); // the stew goes first: the pie still gives it
    expect(slots(g)).toEqual(['berry_pie', 'steeped_broth', 'mushroom_broth']);
    expect(hasStatus(g.state, 'well_fed')).toBe(true);
    // Then the pie, with the least time left, goes: nothing is left giving it.
    shorten(g, 'berry_pie', 'well_fed', 10);
    useConsumable(g.state, g.bus, 'skewered_fish', 'c');
    expect(slots(g)).toEqual(['steeped_broth', 'mushroom_broth', 'skewered_fish']);
    expect(hasStatus(g.state, 'well_fed')).toBe(false);
    expect(logLines(g).at(-1)).toContain('Ended: Well Fed.');
  });

  it('a flask used through alchemy directly is noticed by the tick and recorded as a claim', () => {
    const g = idle();
    stock(g, 'hearty_stew');
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    grantGraded(g.state, 'spring_water', 's', 1);
    grantGraded(g.state, 'mendroot', 's', 1);
    g.state.skills.alchemy = { level: 40, xp: 0 };
    brew(g.state, g.bus, { step1: { id: 'spring_water', quality: 's' }, step2: { id: 'mendroot', quality: 's' } });
    useFlask(g.state, g.bus, 0); // not through Game: nothing told the slots
    expect(held(g, 'well_fed')!.intensity).toBeGreaterThan(1);
    expect(g.state.foreignClaims).toEqual([]);
    g.step(1);
    expect(g.state.foreignClaims).toHaveLength(1);
    expect(g.state.foreignClaims[0].dose).toBeGreaterThan(1);
    expect(g.state.foreignClaims[0].left!).toBeLessThanOrEqual(450);
    expect(held(g, 'well_fed')!.intensity).toBe(g.state.foreignClaims[0].dose);
  });

  it('the slots keep time with the conditions, in a knockout and out of one, and invent no claims', () => {
    const g = idle();
    stock(g, 'hearty_stew', 'mushroom_broth', 'skewered_fish');
    for (const id of ['hearty_stew', 'mushroom_broth', 'skewered_fish']) useConsumable(g.state, g.bus, id, 'c');
    const agree = () => {
      for (const m of activeMeals(g.state)) {
        for (const c of m.slot.claims) expect(held(g, c.id)!.ticksLeft).toBe(Math.max(...allClaimLefts(g, c.id)));
      }
    };
    g.step(200);
    agree();
    // Knocked out, with the conditions running five times faster.
    const before = own(g, 'hearty_stew')!;
    for (let i = 0; i < 20; i++) {
      g.state.recovering = true;
      g.state.resources.hp = 1;
      g.tick();
    }
    expect(before - own(g, 'hearty_stew')!).toBe(100);
    agree();
    g.state.resources.hp = getDerivedStats(g.state).maxHp;
    g.step(50);
    expect(g.state.recovering).toBe(false);
    agree();
    expect(g.state.foreignClaims).toEqual([]);
    expect(activeMeals(g.state)).toHaveLength(3);
  });

  it('claims do not run while travelling', () => {
    const g = idle();
    stock(g, 'hearty_stew');
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    const before = own(g, 'hearty_stew')!;
    tickMealClaims(g.state, 0);
    expect(own(g, 'hearty_stew')).toBe(before);
    tickMealClaims(g.state, 5);
    expect(own(g, 'hearty_stew')).toBe(before - 5);
  });

  it('claims are part of the save', () => {
    const g = idle();
    stock(g, 'hearty_stew');
    drink(g, 'c');
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    const loaded = deserialize(serialize(g.state));
    expect(loaded.foreignClaims).toEqual(g.state.foreignClaims);
    expect(loaded.meals).toEqual(g.state.meals);
    expect(loaded.foreignClaims).toHaveLength(1);
  });
});

describe('a dish that lands on the tick the leading claim lapses', () => {
  /** Stew eaten, then a Divine flask leads Well Fed (x2.6, 450): 449 ticks later it has 1 left. */
  function flaskOnItsLastTick() {
    const g = idle();
    stock(g, 'hearty_stew');
    grantGraded(g.state, 'berry_pie', 'c', 3);
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    drink(g, 's');
    g.step(449);
    expect(g.state.foreignClaims.map((c) => c.left)).toEqual([1]);
    return g;
  }

  const survives = (g: Game, dishes: string[]) => {
    expect(logLines(g).some((l) => l.includes('Well Fed has passed'))).toBe(false);
    expect(hasStatus(g.state, 'well_fed')).toBe(true);
    expect(slots(g)).toEqual(dishes);
    // The condition moved on to a claim that outlasts the tick, and is the stronger of them.
    expect(held(g, 'well_fed')!.ticksLeft!).toBeGreaterThan(1000);
    expect(g.state.foreignClaims).toEqual([]);
  };

  it('a queued dish fired on that tick leaves the condition and every slot that claimed it', () => {
    const g = flaskOnItsLastTick();
    g.state.queuedMeal = { dish: 'berry_pie', quality: 'c', why: 'fight' };
    g.tick();
    expect(logLines(g)).toContain(`🥧 Ate ${QUALITY_TIERS.c.name} Berry Pie (queued during the fight).`);
    survives(g, ['hearty_stew', 'berry_pie']);
  });

  it('the same with dishes only: the leader is a dish whose clock runs out as the queued one lands', () => {
    const g = idle();
    stock(g, 'feast_platter', 'hearty_stew');
    grantGraded(g.state, 'berry_pie', 'c', 3);
    useConsumable(g.state, g.bus, 'feast_platter', 'c'); // Well Fed x2, 6000
    g.step(3000);
    useConsumable(g.state, g.bus, 'hearty_stew', 'c'); // x1, 6000: the platter still leads
    expect(held(g, 'well_fed')!.intensity).toBe(2);
    g.step(2999);
    expect(claim(g, 'feast_platter', 'well_fed')!.left).toBe(1);
    g.state.queuedMeal = { dish: 'berry_pie', quality: 'c', why: 'fight' };
    g.tick();
    expect(logLines(g).some((l) => l.includes('Well Fed has passed'))).toBe(false);
    expect(hasStatus(g.state, 'well_fed')).toBe(true);
    // The platter's own time ran out with the tick, so its slot is free; the other two stand.
    expect(slots(g)).toEqual(['hearty_stew', 'berry_pie']);
    expect(held(g, 'well_fed')!.ticksLeft!).toBeGreaterThan(1000);
  });

  it('a dish eaten between ticks at that point is fine too (the control)', () => {
    const g = flaskOnItsLastTick();
    useConsumable(g.state, g.bus, 'berry_pie', 'c');
    g.tick();
    survives(g, ['hearty_stew', 'berry_pie']);
  });
});

describe('a worse helping of a dish already active', () => {
  /** A Fine Hearty Stew (Well Fed x1.6), then 100 ticks, then a Common one (x0.6). */
  function fineThenCommon() {
    const g = idle();
    grantGraded(g.state, 'hearty_stew', 'b', 1);
    grantGraded(g.state, 'hearty_stew', 'd', 1);
    useConsumable(g.state, g.bus, 'hearty_stew', 'b');
    g.step(100);
    useConsumable(g.state, g.bus, 'hearty_stew', 'd');
    return g;
  }

  it('never lowers or extends the stronger claim: it is a second claim on the same slot', () => {
    const g = fineThenCommon();
    expect(held(g, 'well_fed')!.intensity).toBe(1.6);
    expect(held(g, 'well_fed')!.ticksLeft).toBe(STATUSES.well_fed.duration! - 100);
    expect(slots(g)).toEqual(['hearty_stew']);
    const claims = g.state.meals[0].claims.filter((c) => c.id === 'well_fed');
    expect(claims.map((c) => c.dose).sort()).toEqual([0.6, 1.6]);
    // The slot's time left is its longest claim: the Common helping's fresh clock.
    expect(own(g, 'hearty_stew')).toBe(STATUSES.well_fed.duration);
    // And the label is the grade still in effect.
    expect(activeMeals(g.state)[0].quality).toBe('b');
    expect(g.state.stock.hearty_stew).toBeUndefined();
  });

  it('takes over when the stronger one runs out, and the label follows', () => {
    const g = fineThenCommon();
    g.step(STATUSES.well_fed.duration! - 100 - 5); // the Fine claim has 5 left
    expect(held(g, 'well_fed')!.intensity).toBe(1.6);
    g.step(10);
    expect(held(g, 'well_fed')!.intensity).toBe(0.6);
    expect(held(g, 'well_fed')!.ticksLeft).toBe(own(g, 'hearty_stew'));
    expect(activeMeals(g.state)[0].quality).toBe('d');
    expect(g.state.meals[0].claims.filter((c) => c.id === 'well_fed')).toHaveLength(1);
    expect(logLines(g).some((l) => l.includes('Well Fed has passed'))).toBe(false);
    g.step(120);
    expect(slots(g)).toEqual([]);
    expect(hasStatus(g.state, 'well_fed')).toBe(false);
  });

  it('a stronger helping later replaces the weaker one, which it outlasts', () => {
    const g = idle();
    grantGraded(g.state, 'hearty_stew', 'b', 1);
    grantGraded(g.state, 'hearty_stew', 'd', 1);
    useConsumable(g.state, g.bus, 'hearty_stew', 'd');
    g.step(100);
    useConsumable(g.state, g.bus, 'hearty_stew', 'b');
    expect(g.state.meals[0].claims.filter((c) => c.id === 'well_fed').map((c) => c.dose)).toEqual([1.6]);
    expect(held(g, 'well_fed')!.intensity).toBe(1.6);
    expect(held(g, 'well_fed')!.ticksLeft).toBe(STATUSES.well_fed.duration);
    expect(activeMeals(g.state)[0].quality).toBe('b');
  });

  it('an equal helping renews, and does not pile up claims', () => {
    const g = idle();
    stock(g, 'hearty_stew');
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    g.step(500);
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    expect(g.state.meals[0].claims).toHaveLength(1);
    expect(own(g, 'hearty_stew')).toBe(STATUSES.well_fed.duration);
  });
});

describe('the per-tick bookkeeping writes nothing when nothing changed', () => {
  it('leaves the slot and claim arrays alone while every claim still counts', () => {
    const g = idle();
    stock(g, 'hearty_stew', 'mushroom_broth');
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    useConsumable(g.state, g.bus, 'mushroom_broth', 'c');
    drink(g, 'c');
    const meals = g.state.meals;
    const foreign = g.state.foreignClaims;
    const claims = g.state.meals.map((m) => m.claims);
    g.step(100);
    expect(g.state.meals).toBe(meals);
    expect(g.state.foreignClaims).toBe(foreign);
    expect(g.state.meals.map((m) => m.claims)).toEqual(claims);
    g.state.meals.forEach((m, i) => expect(m.claims).toBe(claims[i]));
  });
});

describe('save v59', () => {
  function v58(): Record<string, unknown> {
    const s = createInitialState(3);
    const raw: Record<string, unknown> = { ...s, version: 58 };
    delete raw.meals;
    delete raw.foreignClaims;
    delete raw.queuedMeal;
    return raw;
  }

  it('is the version this change took, or a later one', () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(59);
  });

  it('migrates a v58 save by adding the empty fields', () => {
    const migrated = migrate(v58(), SAVE_VERSION);
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.meals).toEqual([]);
    expect(migrated.foreignClaims).toEqual([]);
    expect(migrated.queuedMeal).toBeNull();
  });

  it('keeps a food condition that was already running, with no slot for it', () => {
    const raw = v58();
    raw.statuses = [
      { id: 'well_fed', intensity: 1, peak: 1, stacks: 1, ticksLeft: 4000, source: 'Hearty Stew', data: {} },
    ];
    const state = deserialize(JSON.stringify(raw));
    expect(state.statuses.map((s) => s.id)).toEqual(['well_fed']);
    expect(state.meals).toEqual([]);
    // The Game runs on it: the condition ticks down and nothing throws.
    const g = new Game(state);
    g.step(10);
    expect(findStatus(g.state, 'well_fed')!.ticksLeft).toBe(3990);
    expect(activeMeals(g.state)).toEqual([]);
  });

  it('round-trips slots, claims and the queue through serialize and deserialize', () => {
    const g = fighting();
    g.state.activity = null;
    abandonCombat(g.state, g.bus);
    stock(g, 'hearty_stew', 'mushroom_broth');
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    g.state.queuedMeal = { dish: 'mushroom_broth', quality: 'c', why: 'fight' };
    const loaded = deserialize(serialize(g.state));
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.meals).toEqual(g.state.meals);
    expect(loaded.queuedMeal).toEqual({ dish: 'mushroom_broth', quality: 'c', why: 'fight' });
    expect(activeMeals(loaded).map((m) => m.slot.dish)).toEqual(['hearty_stew']);
  });

  it('loads an old save through the rails: a backup-v58 copy is kept, nothing is lost', () => {
    const map = new Map<string, string>();
    const storage = {
      get length() {
        return map.size;
      },
      key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
    } as Storage;
    const raw = v58();
    raw.gold = 4321;
    storage.setItem(SAVE_KEY, JSON.stringify(raw));
    const result = loadFromStorage(storage);
    expect(result.corrupted).toBe(false);
    expect(result.state?.version).toBe(SAVE_VERSION);
    expect(result.state?.gold).toBe(4321);
    expect(result.state?.meals).toEqual([]);
    expect(result.state?.foreignClaims).toEqual([]);
    expect(result.state?.queuedMeal).toBeNull();
    expect(storage.getItem(`${SAVE_KEY}:backup-v58`)).toContain('"version":58');
  });

  it('a prestige starts the next run with no slots, no claims and no queue', () => {
    const g = new Game(createInitialState(5));
    g.state.activity = null;
    stock(g, 'hearty_stew', 'mushroom_broth');
    drink(g, 'c');
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    g.state.queuedMeal = { dish: 'mushroom_broth', quality: 'c', why: 'fight' };
    expect(g.state.meals).toHaveLength(1);
    clearFloors(g.state.stats);
    expect(g.prestige(6)).toBe(true);
    expect(g.state.meals).toEqual([]);
    expect(g.state.foreignClaims).toEqual([]);
    expect(g.state.queuedMeal).toBeNull();
    expect(g.state.statuses).toEqual([]);
  });
});

/** Every live claim's time left on a condition, the dishes' and the other sources'. */
function allClaimLefts(g: Game, id: string): number[] {
  return [
    ...g.state.meals.flatMap((m) => m.claims.filter((c) => c.id === id)),
    ...g.state.foreignClaims.filter((c) => c.id === id),
  ].map((c) => c.left as number);
}
