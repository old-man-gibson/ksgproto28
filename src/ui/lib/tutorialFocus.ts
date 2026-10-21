import type { GameState } from '../../core/types';
import { TUTORIAL_STEP_LIST } from '../../core/data/tutorial.data';
import { tutorialStep } from '../../core/systems/tutorial';

/**
 * What the screen shows while floor 0's tutorial runs (docs/TUTORIAL.md §5).
 *
 * Presentation only. Every answer is read off the current step, which is read
 * off the save, so nothing here is stored and a reload lands on the same
 * screen. Hiding a tab or a panel changes what is drawn, never what the game
 * allows: the roads, fights and controls underneath are the same ones.
 */

export type MainTab =
  | 'location'
  | 'combat'
  | 'skills'
  | 'equipment'
  | 'chromosome'
  | 'music'
  | 'wuxin'
  | 'bestiary'
  | 'quests'
  | 'achievements'
  | 'prestige';

/** What a step points at. `activity` is an activity id at the step's own spot. */
type Pointer = 'choice' | { spot: string } | { exit: string } | { activity: string };

interface StepScreen {
  point: Pointer;
  /** Main tabs this step adds. Tabs stay once added; Location is always there. */
  tabs?: MainTab[];
  /** The sidebar (resource bars, level, attributes) from this step on. */
  sidebar?: boolean;
  /** The gold readout in the top bar from this step on. */
  gold?: boolean;
}

/**
 * One entry per step id in TUTORIAL_STEPS. A tab is added by the step whose
 * text first names it; the sidebar arrives with the first fight, gold with
 * the first kill.
 */
const SCREENS: Record<string, StepScreen> = {
  arm: { point: 'choice' },
  stance: { point: 'choice' },
  cellblock: { point: { spot: 'f0_cellblock' } },
  fight: { point: { activity: 'hunt' }, tabs: ['combat'], sidebar: true },
  field: { point: { spot: 'f0_field' }, tabs: ['equipment'], gold: true },
  spell: { point: 'choice' },
  cast: { point: { activity: 'hunt' } },
  gate: { point: { spot: 'f0_gate' } },
  leave: { point: { exit: 'ascent_foot' } },
};

/** The step ids SCREENS covers, for the test that keeps it in step with the data. */
export const SCREEN_STEP_IDS = Object.keys(SCREENS);

export interface TutorialScreen {
  stepId: string;
  /**
   * What the step points at, as a key the components compare against:
   * `choice` (the card's own widget), `spot:<id>` (a map pin), `exit:<id>`
   * (a map exit label), `activity:<id>` (an activity button), `stage` (the
   * fight on the Combat tab). Null when the step points at nothing.
   */
  target: string | null;
  tabs: ReadonlySet<MainTab>;
  sidebar: boolean;
  gold: boolean;
}

function targetOf(state: GameState, point: Pointer, stepSpot: string | undefined): string {
  if (point === 'choice') return 'choice';
  if ('spot' in point) return `spot:${point.spot}`;
  if ('exit' in point) return `exit:${point.exit}`;
  // Standing elsewhere: the button is not on screen, so point at the place.
  if (stepSpot && state.spot !== stepSpot) return `spot:${stepSpot}`;
  // Once the hunt is chosen the step is about the fight, between swings and
  // between fights alike, so the pointer does not flicker back to the button.
  if (state.combat || state.activity === point.activity) return 'stage';
  return `activity:${point.activity}`;
}

/** Null once the tutorial is over (or between its last step and the finish). */
export function tutorialScreen(state: GameState): TutorialScreen | null {
  const step = tutorialStep(state);
  if (!step) return null;
  const tabs = new Set<MainTab>(['location']);
  let sidebar = false;
  let gold = false;
  for (const s of TUTORIAL_STEP_LIST) {
    const screen = SCREENS[s.id];
    for (const t of screen?.tabs ?? []) tabs.add(t);
    sidebar ||= !!screen?.sidebar;
    gold ||= !!screen?.gold;
    if (s === step) break;
  }
  const screen = SCREENS[step.id];
  return {
    stepId: step.id,
    target: screen ? targetOf(state, screen.point, step.spot) : null,
    tabs,
    sidebar,
    gold,
  };
}

/** The tab a target is drawn on; null for the card's own widget. */
export function targetTab(target: string): MainTab | null {
  if (target === 'stage') return 'combat';
  if (target === 'choice') return null;
  return 'location';
}
