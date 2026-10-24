import { describe, expect, it } from 'vitest';
import { createInitialState, SAVE_VERSION } from '../src/core/state';
import { Game } from '../src/core/game';
import { STATUSES } from '../src/core/registry';
import { QUALITY_TIERS } from '../src/core/data/quality.data';
import { grantGraded } from '../src/core/systems/disciplines';
import { canUse, canUseOutOfFight, useConsumable } from '../src/core/systems/consumables';
import { eatPlan } from '../src/core/systems/eating';
import { MAX_ACTIVE_DISHES, activeMeals, dishLimit, mealToReplace } from '../src/core/systems/meals';
import { abandonCombat } from '../src/core/systems/combat';
import { brew, useFlask } from '../src/core/systems/alchemy';
import { getDerivedStats } from '../src/core/systems/derived';
import { applyStatus, findStatus, hasStatus } from '../src/core/systems/statuses';
import { cookedKey } from '../src/core/systems/cookbook';
import { migrate } from '../src/core/save/migrations';
import { deserialize, loadFromStorage, serialize, SAVE_KEY } from '../src/core/save/save';
import { text } from '../src/core/text/log';
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
    flaskKit(g);
    brew(g.state, g.bus, { step1: { id: 'spring_water', quality: 'c' }, step2: { id: 'mendroot', quality: 'c' } });
    expect(useFlask(g.state, g.bus, 0)).not.toBeNull();
    expect(hasStatus(g.state, 'well_fed')).toBe(true);
  });

  it('the same dish is allowed the moment the fight is over', () => {
    const g = fighting();
    stock(g, 'hearty_stew');
    abandonCombat(g.state);
    expect(g.state.combat).toBeNull();
    expect(canUse(g.state, 'hearty_stew', 'c').ok).toBe(true);
  });

  it('the respawn gap between chained hunt fights has no fight in it', () => {
    const g = fighting();
    stock(g, 'hearty_stew');
    abandonCombat(g.state);
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
    expect(g.state.queuedMeal).toEqual({ dish: 'hearty_stew', quality: 'c' });
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
    abandonCombat(g.state);
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
    expect(g.state.queuedMeal).toEqual({ dish: 'mushroom_broth', quality: 'c' });
    expect(logLines(g).at(-1)).toContain('in place of Fair Hearty Stew');
    // A different grade of the same dish is a different pending dish too.
    grantGraded(g.state, 'mushroom_broth', 'b', 1);
    g.eat('mushroom_broth', 'b');
    expect(g.state.queuedMeal).toEqual({ dish: 'mushroom_broth', quality: 'b' });
  });

  it('can be cancelled', () => {
    const g = fighting();
    stock(g, 'hearty_stew');
    g.eat('hearty_stew', 'c');
    expect(g.cancelQueuedMeal()).toBe(true);
    expect(g.state.queuedMeal).toBeNull();
    expect(g.cancelQueuedMeal()).toBe(false);
    abandonCombat(g.state);
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
    abandonCombat(g.state);
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
    abandonCombat(g.state);
    g.tick();
    expect(logLines(g).at(-1)).toMatch(/\(queued during the fight\)\. Signature: also Stoked/);
  });

  it('waits through a knockout recovery, then eats the tick recovery ends', () => {
    const g = fighting();
    stock(g, 'hearty_stew');
    g.eat('hearty_stew', 'c');
    // The fight ends with the player on the floor.
    abandonCombat(g.state);
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
    abandonCombat(g.state);
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
    expect(loaded.queuedMeal).toEqual({ dish: 'hearty_stew', quality: 'c' });
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
    abandonCombat(g.state);
    expect(eatPlan(g.state, 'hearty_stew', 'c').mode).toBe('eat');
  });
});

describe('at most three dishes active', () => {
  it('the limit is one constant behind one function', () => {
    expect(MAX_ACTIVE_DISHES).toBe(3);
    expect(dishLimit(createInitialState(1))).toBe(3);
  });

  it('a dish holds one slot with everything it gave, Signature included', () => {
    const g = hunting();
    abandonCombat(g.state);
    g.state.stats[cookedKey('hearty_stew')] = 100;
    stock(g, 'hearty_stew');
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    const meals = activeMeals(g.state);
    expect(meals).toHaveLength(1);
    expect(meals[0].slot.statuses.map((s) => s.id).sort()).toEqual(['stoked', 'well_fed']);
    expect(meals[0].ticksLeft).toBe(STATUSES.well_fed.duration);
  });

  it('eating a dish that is already active refreshes its slot instead of taking another', () => {
    const g = hunting();
    abandonCombat(g.state);
    stock(g, 'hearty_stew', 'mushroom_broth');
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    useConsumable(g.state, g.bus, 'mushroom_broth', 'c');
    g.state.activity = null;
    g.step(2000);
    const before = activeMeals(g.state).find((m) => m.slot.dish === 'hearty_stew')!.ticksLeft!;
    expect(before).toBeLessThan(STATUSES.well_fed.duration! - 1500);
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    expect(slots(g)).toEqual(['mushroom_broth', 'hearty_stew']);
    expect(activeMeals(g.state).find((m) => m.slot.dish === 'hearty_stew')!.ticksLeft).toBe(
      STATUSES.well_fed.duration,
    );
    expect(g.state.stock.hearty_stew!.c).toBe(3);
  });

  it('a second helping at a better grade keeps the better grade on the slot', () => {
    const g = hunting();
    abandonCombat(g.state);
    grantGraded(g.state, 'hearty_stew', 'b', 1);
    grantGraded(g.state, 'hearty_stew', 'd', 1);
    useConsumable(g.state, g.bus, 'hearty_stew', 'b');
    useConsumable(g.state, g.bus, 'hearty_stew', 'd');
    expect(activeMeals(g.state)).toHaveLength(1);
    expect(activeMeals(g.state)[0].slot.quality).toBe('b');
  });

  it('the fourth different dish replaces the one with the least time left, and its conditions end', () => {
    const g = hunting();
    abandonCombat(g.state);
    g.state.activity = null;
    stock(g, ...FOUR);
    const [a, b, c, d] = FOUR;
    useConsumable(g.state, g.bus, a, 'c'); // clear_headed, 4800
    g.step(300);
    useConsumable(g.state, g.bus, b, 'c'); // steeped, 6000
    g.step(300);
    useConsumable(g.state, g.bus, c, 'c'); // steady_hand, 4800
    expect(slots(g)).toEqual([a, b, c]);
    const left = (dish: string) => activeMeals(g.state).find((m) => m.slot.dish === dish)!.ticksLeft!;
    // a has run 600 ticks, c none: a has the least left.
    expect(left(a)).toBeLessThan(left(c));
    expect(left(a)).toBeLessThan(left(b));
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
    const g = hunting();
    abandonCombat(g.state);
    g.state.activity = null;
    stock(g, 'hearty_stew', 'mushroom_broth', 'steeped_broth', 'skewered_fish');
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    const fed = getDerivedStats(g.state).maxHp;
    g.step(100);
    useConsumable(g.state, g.bus, 'mushroom_broth', 'c');
    useConsumable(g.state, g.bus, 'steeped_broth', 'c');
    // Hearty Stew (well_fed, 6000) outlasts the 4800 broth; make it the least.
    held(g, 'well_fed')!.ticksLeft = 50;
    useConsumable(g.state, g.bus, 'skewered_fish', 'c');
    expect(slots(g)).not.toContain('hearty_stew');
    expect(hasStatus(g.state, 'well_fed')).toBe(false);
    expect(getDerivedStats(g.state).maxHp).toBe(fed - 8);
  });

  it('a replaced dish frees its tie-break: equal time goes to the one eaten first', () => {
    const g = hunting();
    abandonCombat(g.state);
    g.state.activity = null;
    stock(g, ...FOUR);
    for (const id of FOUR.slice(0, 3)) {
      useConsumable(g.state, g.bus, id, 'c');
      for (const m of activeMeals(g.state)) for (const e of m.slot.statuses) held(g, e.id)!.ticksLeft = 1000;
    }
    useConsumable(g.state, g.bus, FOUR[3], 'c');
    expect(slots(g)).toEqual([FOUR[1], FOUR[2], FOUR[3]]);
  });

  it('a slot frees when its dish runs out, so the next dish replaces nobody', () => {
    const g = hunting();
    abandonCombat(g.state);
    g.state.activity = null;
    stock(g, ...FOUR);
    for (const id of FOUR.slice(0, 3)) useConsumable(g.state, g.bus, id, 'c');
    // Run the clock out on the first dish only.
    held(g, 'clear_headed')!.ticksLeft = 2;
    g.step(3);
    expect(hasStatus(g.state, 'clear_headed')).toBe(false);
    expect(slots(g)).toEqual([FOUR[1], FOUR[2]]);
    expect(g.state.meals.map((s) => s.dish)).toEqual([FOUR[1], FOUR[2]]);
    useConsumable(g.state, g.bus, FOUR[3], 'c');
    expect(slots(g)).toEqual([FOUR[1], FOUR[2], FOUR[3]]);
    expect(hasStatus(g.state, 'steeped')).toBe(true);
    expect(hasStatus(g.state, 'steady_hand')).toBe(true);
    expect(logLines(g).filter((l) => l.includes('dropped for'))).toHaveLength(0);
  });

  it('a dish whose conditions are cleared another way frees its slot too', () => {
    const g = hunting();
    abandonCombat(g.state);
    stock(g, 'hearty_stew');
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    g.state.statuses.length = 0;
    expect(activeMeals(g.state)).toHaveLength(0);
    g.tick();
    expect(g.state.meals).toHaveLength(0);
  });

  describe('a condition two sources both give', () => {
    /** Three dishes in the slots, the first two both giving Well Fed. */
    function shared() {
      const g = hunting();
      abandonCombat(g.state);
      g.state.activity = null;
      stock(g, 'hearty_stew', 'berry_pie', 'mushroom_broth', 'steeped_broth');
      useConsumable(g.state, g.bus, 'hearty_stew', 'c');
      useConsumable(g.state, g.bus, 'berry_pie', 'c');
      useConsumable(g.state, g.bus, 'mushroom_broth', 'c');
      return g;
    }

    it('two dishes share one Well Fed; evicting one leaves it running with the same clock', () => {
      const g = shared();
      expect(slots(g)).toEqual(['hearty_stew', 'berry_pie', 'mushroom_broth']);
      // Make the shared Well Fed the least time left: hearty_stew (eaten first) goes.
      held(g, 'well_fed')!.ticksLeft = 50;
      const intensity = held(g, 'well_fed')!.intensity;
      useConsumable(g.state, g.bus, 'steeped_broth', 'c');
      expect(slots(g)).toEqual(['berry_pie', 'mushroom_broth', 'steeped_broth']);
      const wf = held(g, 'well_fed')!;
      expect(wf).toBeDefined();
      // The other dish's time: untouched by the eviction.
      expect(wf.ticksLeft).toBe(50);
      expect(wf.intensity).toBe(intensity);
      expect(logLines(g).at(-1)).toMatch(/Hearty Stew dropped for Fair Steeped Broth.*Kept, another source gives it too: Well Fed\./);
      // And it is still berry_pie's: it goes when berry_pie's time does.
      const pie = activeMeals(g.state).find((m) => m.slot.dish === 'berry_pie')!;
      expect(pie.ticksLeft).toBe(50);
      g.step(60);
      expect(hasStatus(g.state, 'well_fed')).toBe(false);
      expect(slots(g)).not.toContain('berry_pie');
    });

    it('evicting the other of the two keeps it too', () => {
      const g = shared();
      // Refreshing the stew moves it to the back, so on a tie the pie is older.
      useConsumable(g.state, g.bus, 'hearty_stew', 'c');
      held(g, 'well_fed')!.ticksLeft = 50;
      useConsumable(g.state, g.bus, 'steeped_broth', 'c');
      expect(slots(g)).toEqual(['mushroom_broth', 'hearty_stew', 'steeped_broth']);
      expect(held(g, 'well_fed')!.ticksLeft).toBe(50);
    });

    it('a flask drunk before the dish: the dish is evicted, the flask keeps its Well Fed', () => {
      const g = hunting();
      abandonCombat(g.state);
      g.state.activity = null;
      flaskKit(g);
      brew(g.state, g.bus, { step1: { id: 'spring_water', quality: 'c' }, step2: { id: 'mendroot', quality: 'c' } });
      useFlask(g.state, g.bus, 0);
      expect(hasStatus(g.state, 'well_fed')).toBe(true);
      stock(g, 'hearty_stew', ...FOUR.slice(0, 3));
      useConsumable(g.state, g.bus, 'hearty_stew', 'c');
      const stew = g.state.meals.find((s) => s.dish === 'hearty_stew')!;
      expect(stew.statuses.find((e) => e.id === 'well_fed')!.shared).toBe(true);
      for (const id of FOUR.slice(0, 2)) useConsumable(g.state, g.bus, id, 'c');
      // Three slots now: stew + two. Make the stew the least time left.
      for (const id of ['clear_headed', 'steeped']) held(g, id)!.ticksLeft = 5000;
      held(g, 'well_fed')!.ticksLeft = 120;
      useConsumable(g.state, g.bus, FOUR[2], 'c');
      expect(slots(g)).not.toContain('hearty_stew');
      expect(hasStatus(g.state, 'well_fed')).toBe(true);
      expect(held(g, 'well_fed')!.ticksLeft).toBe(120);
    });

    it('two dishes of different grades: the first to go keeps it, the last to go ends it', () => {
      const g = hunting();
      abandonCombat(g.state);
      g.state.activity = null;
      stock(g, 'hearty_stew', 'mushroom_broth', 'steeped_broth', 'skewered_fish');
      grantGraded(g.state, 'berry_pie', 'b', 2);
      useConsumable(g.state, g.bus, 'hearty_stew', 'c');
      useConsumable(g.state, g.bus, 'berry_pie', 'b');
      // The Fine pie raised the one Well Fed instance past the Fair stew's dose.
      expect(held(g, 'well_fed')!.intensity).toBeGreaterThan(1);
      useConsumable(g.state, g.bus, 'mushroom_broth', 'c');
      held(g, 'well_fed')!.ticksLeft = 50;
      // The stew goes first: the pie still gives Well Fed.
      useConsumable(g.state, g.bus, 'steeped_broth', 'c');
      expect(slots(g)).toEqual(['berry_pie', 'mushroom_broth', 'steeped_broth']);
      expect(hasStatus(g.state, 'well_fed')).toBe(true);
      // Then the pie goes, and nothing is left giving it.
      useConsumable(g.state, g.bus, 'skewered_fish', 'c');
      expect(slots(g)).toEqual(['mushroom_broth', 'steeped_broth', 'skewered_fish']);
      expect(hasStatus(g.state, 'well_fed')).toBe(false);
      expect(logLines(g).at(-1)).toContain('Ended: Well Fed.');
    });

    it('a foreign dose in between: the dishes that landed on it all leave it running', () => {
      const g = hunting();
      abandonCombat(g.state);
      g.state.activity = null;
      stock(g, 'hearty_stew', 'mushroom_broth', 'steeped_broth', 'skewered_fish', 'seared_stew');
      grantGraded(g.state, 'berry_pie', 'b', 1);
      useConsumable(g.state, g.bus, 'hearty_stew', 'c');
      applyStatus(g.state, g.state, { id: 'well_fed', intensity: 3, duration: 900 }, 'Strong Brew');
      useConsumable(g.state, g.bus, 'berry_pie', 'b'); // lands on the foreign instance, ignored as weaker
      const shares = (dish: string) => g.state.meals.find((m) => m.dish === dish)!.statuses[0].shared;
      expect(shares('hearty_stew')).toBe(true);
      expect(shares('berry_pie')).toBe(true);
      held(g, 'well_fed')!.ticksLeft = 50;
      useConsumable(g.state, g.bus, 'mushroom_broth', 'c');
      useConsumable(g.state, g.bus, 'steeped_broth', 'c'); // the stew goes
      useConsumable(g.state, g.bus, 'skewered_fish', 'c'); // the pie goes
      expect(slots(g)).toEqual(['mushroom_broth', 'steeped_broth', 'skewered_fish']);
      expect(hasStatus(g.state, 'well_fed')).toBe(true);
      expect(held(g, 'well_fed')!.intensity).toBe(3);
    });

    it('the tick notices a foreign change to a held dish without being told', () => {
      const g = hunting();
      abandonCombat(g.state);
      g.state.activity = null;
      stock(g, 'hearty_stew');
      useConsumable(g.state, g.bus, 'hearty_stew', 'c');
      const entry = () => g.state.meals[0].statuses[0];
      expect(entry().shared).toBe(false);
      g.step(5);
      expect(entry().shared).toBe(false);
      applyStatus(g.state, g.state, { id: 'well_fed', intensity: 4, duration: 900 }, 'Strong Brew');
      g.step(1);
      expect(entry().shared).toBe(true);
    });

    it('a flask drunk after the dish, its weaker dose ignored, still keeps its Well Fed when the dish goes', () => {
      const g = hunting();
      abandonCombat(g.state);
      g.state.activity = null;
      stock(g, 'hearty_stew', ...FOUR.slice(0, 3));
      useConsumable(g.state, g.bus, 'hearty_stew', 'c');
      const dishDose = held(g, 'well_fed')!.intensity;
      flaskKit(g);
      brew(g.state, g.bus, { step1: { id: 'spring_water', quality: 'c' }, step2: { id: 'mendroot', quality: 'c' } });
      expect(g.useFlask(0)).not.toBeNull();
      // The stew's stronger Well Fed absorbed the flask's: nothing on the instance shows it.
      expect(held(g, 'well_fed')!.intensity).toBe(dishDose);
      for (const id of FOUR.slice(0, 2)) useConsumable(g.state, g.bus, id, 'c');
      for (const id of ['clear_headed', 'steeped']) held(g, id)!.ticksLeft = 5000;
      held(g, 'well_fed')!.ticksLeft = 120;
      useConsumable(g.state, g.bus, FOUR[2], 'c');
      expect(slots(g)).not.toContain('hearty_stew');
      expect(hasStatus(g.state, 'well_fed')).toBe(true);
      expect(logLines(g).at(-1)).toContain('Kept, another source gives it too: Well Fed.');
    });

    it('a flask drunk after the dish, with the stronger dose, keeps its Well Fed when the dish goes', () => {
      const g = hunting();
      abandonCombat(g.state);
      g.state.activity = null;
      stock(g, 'hearty_stew', ...FOUR.slice(0, 3));
      useConsumable(g.state, g.bus, 'hearty_stew', 'c');
      // A flask's dose lands on the stew's instance and is stronger than it.
      applyStatus(g.state, g.state, { id: 'well_fed', intensity: 3, duration: 900 }, 'Strong Brew');
      expect(held(g, 'well_fed')!.intensity).toBe(3);
      for (const id of FOUR.slice(0, 2)) useConsumable(g.state, g.bus, id, 'c');
      for (const id of ['clear_headed', 'steeped']) held(g, id)!.ticksLeft = 5000;
      held(g, 'well_fed')!.ticksLeft = 120;
      useConsumable(g.state, g.bus, FOUR[2], 'c');
      expect(slots(g)).not.toContain('hearty_stew');
      expect(hasStatus(g.state, 'well_fed')).toBe(true);
      expect(held(g, 'well_fed')!.intensity).toBe(3);
    });
  });

  it('a dish that gave nothing nourishing holds no slot and evicts nobody', () => {
    const g = hunting();
    abandonCombat(g.state);
    g.state.activity = null;
    stock(g, ...FOUR.slice(0, 3), 'scorched_mess');
    for (const id of FOUR.slice(0, 3)) useConsumable(g.state, g.bus, id, 'c');
    expect(eatPlan(g.state, 'scorched_mess', 'c').replaces).toBeUndefined();
    useConsumable(g.state, g.bus, 'scorched_mess', 'c');
    expect(hasStatus(g.state, 'queasy')).toBe(true);
    expect(slots(g)).toEqual(FOUR.slice(0, 3));
  });

  it('a spoiled helping of a real dish holds no slot either', () => {
    const g = hunting();
    abandonCombat(g.state);
    g.state.activity = null;
    stock(g, ...FOUR.slice(0, 3));
    grantGraded(g.state, 'hearty_stew', 'f', 1);
    for (const id of FOUR.slice(0, 3)) useConsumable(g.state, g.bus, id, 'c');
    expect(eatPlan(g.state, 'hearty_stew', 'f').replaces).toBeUndefined();
    useConsumable(g.state, g.bus, 'hearty_stew', 'f');
    expect(slots(g)).toEqual(FOUR.slice(0, 3));
  });

  it('a food condition already running (an old save) holds no slot and counts toward nothing', () => {
    const g = hunting();
    abandonCombat(g.state);
    g.state.activity = null;
    applyStatus(g.state, g.state, { id: 'well_fed', intensity: 1 }, 'Old Stew');
    stock(g, ...FOUR.slice(0, 3));
    for (const id of FOUR.slice(0, 3)) useConsumable(g.state, g.bus, id, 'c');
    expect(slots(g)).toEqual(FOUR.slice(0, 3));
    expect(hasStatus(g.state, 'well_fed')).toBe(true);
  });

  it('the plan tells the fourth dish which one it replaces, and an active dish that it refreshes', () => {
    const g = hunting();
    abandonCombat(g.state);
    g.state.activity = null;
    stock(g, ...FOUR);
    for (const id of FOUR.slice(0, 3)) {
      useConsumable(g.state, g.bus, id, 'c');
      g.step(100);
    }
    expect(eatPlan(g.state, FOUR[3], 'c').replaces!.slot.dish).toBe(FOUR[0]);
    expect(eatPlan(g.state, FOUR[1], 'c').replaces).toBeUndefined();
    // A free slot replaces nobody.
    held(g, 'clear_headed')!.ticksLeft = 1;
    g.step(2);
    expect(eatPlan(g.state, FOUR[3], 'c').replaces).toBeUndefined();
  });

  it('a queued fourth dish replaces by the time left when it is eaten, not when it was queued', () => {
    const g = fighting();
    stock(g, ...FOUR);
    abandonCombat(g.state);
    g.state.activity = null;
    for (const id of FOUR.slice(0, 3)) useConsumable(g.state, g.bus, id, 'c');
    g.state.combat = null;
    g.state.queuedMeal = { dish: FOUR[3], quality: 'c' };
    held(g, 'steeped')!.ticksLeft = 10; // the second dish is now the shortest
    g.tick();
    expect(slots(g)).toEqual([FOUR[0], FOUR[2], FOUR[3]]);
  });
});

describe('save v59', () => {
  function v58(): Record<string, unknown> {
    const s = createInitialState(3);
    const raw: Record<string, unknown> = { ...s, version: 58 };
    delete raw.meals;
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

  it('round-trips slots and the queue through serialize and deserialize', () => {
    const g = fighting();
    g.state.activity = null;
    abandonCombat(g.state);
    stock(g, 'hearty_stew', 'mushroom_broth');
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    g.state.queuedMeal = { dish: 'mushroom_broth', quality: 'c' };
    const loaded = deserialize(serialize(g.state));
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.meals).toEqual(g.state.meals);
    expect(loaded.queuedMeal).toEqual({ dish: 'mushroom_broth', quality: 'c' });
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
    expect(result.state?.queuedMeal).toBeNull();
    expect(storage.getItem(`${SAVE_KEY}:backup-v58`)).toContain('"version":58');
  });

  it('a prestige starts the next run with no slots and no queue', () => {
    const g = new Game(createInitialState(5));
    g.state.activity = null;
    stock(g, 'hearty_stew', 'mushroom_broth');
    useConsumable(g.state, g.bus, 'hearty_stew', 'c');
    g.state.queuedMeal = { dish: 'mushroom_broth', quality: 'c' };
    expect(g.state.meals).toHaveLength(1);
    clearFloors(g.state.stats);
    expect(g.prestige(6)).toBe(true);
    expect(g.state.meals).toEqual([]);
    expect(g.state.queuedMeal).toBeNull();
    expect(g.state.statuses).toEqual([]);
  });
});

/** Reagents for a drinkable Mendroot flask, at a level that can brew it. */
function flaskKit(g: Game) {
  grantGraded(g.state, 'spring_water', 'c', 5);
  grantGraded(g.state, 'mendroot', 'c', 5);
  g.state.skills.alchemy = { level: 40, xp: 0 };
}
