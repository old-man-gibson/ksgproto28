import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { grantGraded } from '../src/core/systems/disciplines';
import { abandonCombat } from '../src/core/systems/combat';
import { dishHeading, dishRows, eatButton, queuedRow, timeLeftText } from '../src/ui/lib/meals';

/** In the Cages with the fight on, every dish stocked. */
function fighting() {
  const g = new Game(createInitialState(3));
  g.state.spot = 'the_cages';
  g.selectActivity('hunt');
  g.state.respawnTimer = 0;
  g.tick();
  expect(g.state.combat).not.toBeNull();
  for (const id of ['hearty_stew', 'mushroom_broth', 'steeped_broth', 'skewered_fish', 'seared_stew', 'healing_salve']) {
    grantGraded(g.state, id, 'c', 3);
  }
  return g;
}

const idle = (g: Game) => {
  abandonCombat(g.state);
  g.state.activity = null;
};

describe('the Eat button words', () => {
  it('reads Eat out of a fight, and Drink for a dish that is drunk', () => {
    const g = fighting();
    idle(g);
    expect(eatButton(g.state, 'hearty_stew', 'c')).toMatchObject({ label: 'Eat', disabled: false, cancels: false, tip: [] });
    expect(eatButton(g.state, 'mushroom_broth', 'c').label).toBe('Drink');
  });

  it('reads "Eat after this fight" in a fight, with a tooltip that says what happens', () => {
    const g = fighting();
    const b = eatButton(g.state, 'hearty_stew', 'c');
    expect(b.label).toBe('Eat after this fight');
    expect(b.disabled).toBe(false);
    expect(b.tip.join(' ')).toContain('eaten the moment the fight ends');
    expect(eatButton(g.state, 'mushroom_broth', 'c').label).toBe('Drink after this fight');
  });

  it('turns into a cancel once that dish is the queued one', () => {
    const g = fighting();
    g.eat('hearty_stew', 'c');
    expect(eatButton(g.state, 'hearty_stew', 'c')).toMatchObject({ label: 'Queued: cancel', cancels: true });
    // Another dish still queues, in its place.
    expect(eatButton(g.state, 'skewered_fish', 'c')).toMatchObject({ label: 'Eat after this fight', cancels: false });
  });

  it('leaves a salve alone: its own verb, in a fight or out', () => {
    const g = fighting();
    expect(eatButton(g.state, 'healing_salve', 'c')).toMatchObject({ label: 'Applied', disabled: false });
    idle(g);
    expect(eatButton(g.state, 'healing_salve', 'c').label).toBe('Applied');
  });

  it('is disabled with a reason when nothing is held', () => {
    const g = fighting();
    const b = eatButton(g.state, 'berry_pie', 'c');
    expect(b.disabled).toBe(true);
    expect(b.tip).toEqual(['None held']);
  });

  it('says which dish a fourth one replaces, in the tooltip and in a line under the buttons', () => {
    const g = fighting();
    idle(g);
    for (const id of ['mushroom_broth', 'steeped_broth', 'skewered_fish']) {
      g.eat(id, 'c');
      g.step(200);
    }
    const b = eatButton(g.state, 'seared_stew', 'c');
    expect(b.replaces).toMatch(/^Replaces Fair Mushroom Broth \(\d+m \d+s left\)$/);
    expect(b.tip.join(' ')).toContain('At most 3 dishes can be active at once');
    // A dish already in a slot is renewed, and says so.
    const again = eatButton(g.state, 'steeped_broth', 'c');
    expect(again.replaces).toBeNull();
    expect(again.tip.join(' ')).toContain('eating it again renews its time');
  });
});

describe('the Eat button while knocked out', () => {
  it('reads "Eat after recovering", says why in its tooltip, and cancels once queued', () => {
    const g = fighting();
    idle(g);
    g.state.recovering = true;
    const b = eatButton(g.state, 'hearty_stew', 'c');
    expect(b.label).toBe('Eat after recovering');
    expect(b.disabled).toBe(false);
    expect(b.tip.join(' ')).toContain('knocked out');
    expect(eatButton(g.state, 'mushroom_broth', 'c').label).toBe('Drink after recovering');
    g.eat('hearty_stew', 'c');
    expect(eatButton(g.state, 'hearty_stew', 'c')).toMatchObject({ label: 'Queued: cancel', cancels: true });
    expect(queuedRow(g.state)).toMatchObject({ label: 'After recovering:', name: 'Fair Hearty Stew' });
  });

  it('the queued line says fight while a fight is on', () => {
    const g = fighting();
    g.eat('hearty_stew', 'c');
    expect(queuedRow(g.state)!.label).toBe('After this fight:');
  });
});

describe('the dish list', () => {
  it('counts the slots and lists each dish with its time left, oldest first', () => {
    const g = fighting();
    idle(g);
    expect(dishRows(g.state)).toEqual([]);
    g.eat('mushroom_broth', 'c');
    g.step(300);
    g.eat('hearty_stew', 'c');
    expect(dishHeading(g.state)).toBe('Dishes 2/3');
    const rows = dishRows(g.state);
    expect(rows.map((r) => r.dish)).toEqual(['mushroom_broth', 'hearty_stew']);
    expect(rows[0]).toMatchObject({ name: 'Fair Mushroom Broth', replacedFirst: false });
    expect(rows[0].time).toMatch(/^\d+m \d+s$/);
    expect(rows[1].conditions[0]).toContain('Well Fed');
  });

  it('marks the dish a new one would replace first, only when every slot is full', () => {
    const g = fighting();
    idle(g);
    for (const id of ['mushroom_broth', 'steeped_broth', 'skewered_fish']) {
      g.eat(id, 'c');
      g.step(200);
    }
    const rows = dishRows(g.state);
    expect(dishHeading(g.state)).toBe('Dishes 3/3');
    expect(rows.filter((r) => r.replacedFirst).map((r) => r.dish)).toEqual(['mushroom_broth']);
    // The least time left, not the first eaten, is what is marked.
    g.state.meals.find((m) => m.dish === 'steeped_broth')!.claims[0].left = 5;
    expect(dishRows(g.state).find((r) => r.replacedFirst)!.dish).toBe('steeped_broth');
    expect(dishRows(g.state).find((r) => r.dish === 'steeped_broth')!.conditions).toEqual(['🫖 Steeped: 1s']);
  });

  it('shows the queued dish, and nothing when none waits', () => {
    const g = fighting();
    expect(queuedRow(g.state)).toBeNull();
    g.eat('hearty_stew', 'b');
    expect(queuedRow(g.state)).toBeNull();
    g.eat('hearty_stew', 'c');
    expect(queuedRow(g.state)).toMatchObject({ name: 'Fair Hearty Stew' });
  });

  it('reads a clockless condition as no time limit', () => {
    expect(timeLeftText(null)).toBe('no time limit');
    expect(timeLeftText(650)).toBe('1m 5s');
  });
});
