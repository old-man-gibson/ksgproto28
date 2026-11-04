import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { activeRotation } from '../src/core/systems/combat';
import { stepTarget, visibleIds } from '../src/ui/lib/rotationView';

// The Active Skills move buttons (ui/lib/rotationView.ts, CombatPanel.svelte):
// each card steps one place among the DRAWN cards through game.moveSkillTo,
// and a benched technique, which stays in the order but is not drawn, is never
// a place to step onto.

const ABC = ['a', 'b', 'c'];

describe('stepTarget: the beforeId for one place up or down', () => {
  it('up is the previous card; down is the card two places on, or last', () => {
    expect(stepTarget(ABC, 'b', -1)).toBe('a');
    expect(stepTarget(ABC, 'c', -1)).toBe('b');
    expect(stepTarget(['a', 'b', 'c', 'd'], 'a', 1)).toBe('c');
    expect(stepTarget(ABC, 'b', 1)).toBeNull();
  });

  it('the top card up and the bottom card down are no moves', () => {
    expect(stepTarget(ABC, 'a', -1)).toBeUndefined();
    expect(stepTarget(ABC, 'c', 1)).toBeUndefined();
  });

  it('a lone card, an empty list and an id that is not drawn are no moves', () => {
    expect(stepTarget(['a'], 'a', -1)).toBeUndefined();
    expect(stepTarget(['a'], 'a', 1)).toBeUndefined();
    expect(stepTarget([], 'a', 1)).toBeUndefined();
    expect(stepTarget(ABC, 'z', -1)).toBeUndefined();
    expect(stepTarget(ABC, 'z', 1)).toBeUndefined();
  });
});

describe('visibleIds: the cards the panel draws', () => {
  it('drops benched techniques and nothing else', () => {
    const order = ['heavy_swing', 'technique:gather', 'technique:sidestep', 'grimoire:7'];
    const triggers = {
      'technique:gather': { enabled: false },
      'technique:sidestep': { enabled: true },
      // Only techniques are benched: a skill switched off is still drawn, dimmed.
      heavy_swing: { enabled: false },
      'grimoire:7': { enabled: false },
    };
    expect(visibleIds(order, triggers)).toEqual(['heavy_swing', 'technique:sidestep', 'grimoire:7']);
  });
});

describe('moving a card through game.moveSkillTo', () => {
  /** A fighter with three techniques in the order gather, heavy_blow, sidestep. */
  function fighter(seed: number): Game {
    const g = new Game(createInitialState(seed));
    g.state.techniques = {
      gather: { executions: 0, form: 'canonical' },
      heavy_blow: { executions: 0, form: 'canonical' },
      sidestep: { executions: 0, form: 'canonical' },
    };
    g.state.skillOrder = ['technique:gather', 'technique:heavy_blow', 'technique:sidestep'];
    return g;
  }

  /** The panel's step: resolve the target on the drawn list, then move. */
  function press(g: Game, id: string, dir: -1 | 1): void {
    const target = stepTarget(visibleIds(activeRotation(g.state), g.state.skillTriggers), id, dir);
    if (target !== undefined) g.moveSkillTo(id, target);
  }

  const drawn = (g: Game) => visibleIds(activeRotation(g.state), g.state.skillTriggers);

  it('up then down restores the order with a benched entry between two cards', () => {
    const g = fighter(1);
    g.setSkillEnabled('technique:heavy_blow', false); // benched: stays in the order, not drawn
    expect(drawn(g)).toEqual(['technique:gather', 'technique:sidestep']);
    const before = activeRotation(g.state);
    expect(before).toEqual(['technique:gather', 'technique:heavy_blow', 'technique:sidestep']);

    press(g, 'technique:sidestep', -1);
    expect(drawn(g)).toEqual(['technique:sidestep', 'technique:gather']);
    expect(activeRotation(g.state)).toContain('technique:heavy_blow'); // it travelled, it was not lost
    expect(activeRotation(g.state)).toHaveLength(3);

    press(g, 'technique:sidestep', 1);
    expect(drawn(g)).toEqual(['technique:gather', 'technique:sidestep']);
    expect(activeRotation(g.state)).toEqual(before);
  });

  it('one press is one place among the drawn cards, whatever is benched between them', () => {
    const g = fighter(2);
    g.setSkillEnabled('technique:heavy_blow', false);
    press(g, 'technique:gather', 1);
    expect(drawn(g)).toEqual(['technique:sidestep', 'technique:gather']);
    press(g, 'technique:gather', -1);
    expect(drawn(g)).toEqual(['technique:gather', 'technique:sidestep']);
  });

  it('with nothing benched, a press is a swap with the neighbour', () => {
    const g = fighter(3);
    press(g, 'technique:heavy_blow', -1);
    expect(activeRotation(g.state)).toEqual(['technique:heavy_blow', 'technique:gather', 'technique:sidestep']);
    press(g, 'technique:heavy_blow', 1);
    expect(activeRotation(g.state)).toEqual(['technique:gather', 'technique:heavy_blow', 'technique:sidestep']);
    press(g, 'technique:gather', 1);
    expect(activeRotation(g.state)).toEqual(['technique:heavy_blow', 'technique:gather', 'technique:sidestep']);
  });

  it('the top card up and the bottom card down leave the order alone', () => {
    const g = fighter(4);
    g.setSkillEnabled('technique:heavy_blow', false);
    const before = [...activeRotation(g.state)];
    press(g, 'technique:gather', -1);
    expect(activeRotation(g.state)).toEqual(before);
    press(g, 'technique:sidestep', 1);
    expect(activeRotation(g.state)).toEqual(before);
  });

  it('a benched trailing entry does not make the bottom drawn card movable', () => {
    const g = fighter(5);
    g.setSkillEnabled('technique:sidestep', false); // last in the order, not drawn
    const before = [...activeRotation(g.state)];
    expect(drawn(g)).toEqual(['technique:gather', 'technique:heavy_blow']);
    press(g, 'technique:heavy_blow', 1);
    expect(activeRotation(g.state)).toEqual(before);
  });

  it('every press keeps the same entries, with no duplicates', () => {
    const g = fighter(6);
    g.setSkillEnabled('technique:heavy_blow', false);
    const ids = [...activeRotation(g.state)].sort();
    for (const [id, dir] of [
      ['technique:sidestep', -1],
      ['technique:sidestep', 1],
      ['technique:gather', 1],
      ['technique:gather', -1],
      ['technique:gather', -1],
    ] as const) {
      press(g, id, dir);
      expect([...activeRotation(g.state)].sort()).toEqual(ids);
    }
  });
});
