import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { TUTORIAL_EXIT, TUTORIAL_STEP_LIST } from '../src/core/data/tutorial.data';
import { SCREEN_STEP_IDS, targetTab, tutorialScreen } from '../src/ui/lib/tutorialFocus';

/** Run the current travel to arrival. */
function walk(g: Game): void {
  for (let i = 0; i < 10_000 && g.state.travel; i++) g.tick();
  expect(g.state.travel).toBeNull();
}

/** Hunt at the current spot until one fight is won. */
function winOneFight(g: Game, spot: string): void {
  const before = g.state.stats[`fights:${spot}`] ?? 0;
  g.selectActivity('hunt');
  for (let i = 0; i < 20_000 && (g.state.stats[`fights:${spot}`] ?? 0) === before; i++) g.tick();
  expect(g.state.stats[`fights:${spot}`] ?? 0).toBe(before + 1);
}

describe('the floor 0 screen — what each step shows and points at', () => {
  it('has a screen for every step and none for a step that does not exist', () => {
    expect([...SCREEN_STEP_IDS].sort()).toEqual(TUTORIAL_STEP_LIST.map((s) => s.id).sort());
  });

  it('points at each step’s control and adds tabs as the steps name them', () => {
    const g = new Game(createInitialState(11));
    const s = g.state;
    const screen = () => tutorialScreen(s)!;

    expect(screen().target).toBe('choice');
    expect([...screen().tabs]).toEqual(['location']);
    expect(screen().sidebar).toBe(false);
    expect(screen().gold).toBe(false);

    g.chooseTutorialWeapon('sword', true);
    g.chooseTutorialStance('neutral');
    expect(screen().target).toBe('spot:f0_cellblock');

    g.travelTo('f0_cellblock');
    walk(g);
    expect(screen().target).toBe('activity:hunt');
    expect(screen().tabs.has('combat')).toBe(true);
    expect(screen().sidebar).toBe(true);

    // Once the hunt is chosen the step is about the fight, on the Combat tab.
    g.selectActivity('hunt');
    expect(screen().target).toBe('stage');
    winOneFight(g, 'f0_cellblock');
    expect(screen().stepId).toBe('field');
    expect(screen().target).toBe('spot:f0_field');
    expect(screen().tabs.has('equipment')).toBe(true);
    expect(screen().gold).toBe(true);

    g.selectActivity(null);
    g.travelTo('f0_field');
    walk(g);
    expect(screen().target).toBe('choice');

    g.chooseTutorialSpell('fire');
    expect(screen().target).toBe('activity:hunt');
    winOneFight(g, 'f0_field');
    expect(screen().target).toBe('spot:f0_gate');

    g.selectActivity(null);
    g.travelTo('f0_gate');
    walk(g);
    expect(screen().target).toBe(`exit:${TUTORIAL_EXIT}`);
    // Skills and the rest wait for the end of the tutorial.
    expect(screen().tabs.has('skills')).toBe(false);

    g.travelTo(TUTORIAL_EXIT);
    walk(g);
    expect(tutorialScreen(s)).toBeNull();
  });

  it('points back at the place when the player walked past a fight step', () => {
    const g = new Game(createInitialState(12));
    g.chooseTutorialWeapon('dagger');
    g.chooseTutorialStance('neutral');
    g.travelTo('f0_cellblock');
    walk(g);
    // Nothing gates on the slime: the yard door is open.
    g.travelTo('f0_field');
    walk(g);
    expect(tutorialScreen(g.state)!.stepId).toBe('fight');
    expect(tutorialScreen(g.state)!.target).toBe('spot:f0_cellblock');
  });

  it('opens the tab a target is drawn on', () => {
    expect(targetTab('stage')).toBe('combat');
    expect(targetTab('choice')).toBeNull();
    expect(targetTab('spot:f0_gate')).toBe('location');
    expect(targetTab('activity:hunt')).toBe('location');
    expect(targetTab(`exit:${TUTORIAL_EXIT}`)).toBe('location');
  });
});
