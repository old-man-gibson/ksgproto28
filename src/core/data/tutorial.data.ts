import type { TutorialStepDef } from '../types';
import { prose } from '../text/prose';
import { TUTORIAL_TEXT } from '../text/tutorial.text';

/**
 * Floor 0, the tutorial (docs/TUTORIAL.md, plans/floor-zero-tutorial.md).
 *
 * Nine steps, read in order, shown one at a time on the card above the tabs
 * while the tutorial is on; ui/lib/tutorialFocus.ts decides what else the
 * screen shows and which control each step points at. Each is DONE when the
 * world says so — a counter, a spot stood in — never when a button was
 * clicked, so a player who does things early or out of order is shown the
 * first thing still undone and nothing stale. Three of the panels carry a
 * choice (the rack, the stance, the spell); those stamp a `flag:tutorial_*`
 * counter through a Game method and the step reads that.
 *
 * Nothing here GATES anything. The floor's roads and fights work with every
 * panel ignored; the tutorial is a commentary track. The skip (offered once,
 * on the first step) stamps every flag at once and moves the player to the
 * Foot (systems/tutorial.ts).
 *
 * Words live in text/tutorial.text.ts. Numbers quoted there (road seconds,
 * the slime's 1 damage, the spell's mana) are the ones in the data files —
 * retune both together.
 */

/** The counter that ends the tutorial: ≥ 1 means done or skipped. */
export const TUTORIAL_DONE_KEY = 'flag:tutorial_done';

/** Per-choice latches; a choice is offered while its flag is 0. */
export const TUTORIAL_FLAGS = {
  weapon: 'flag:tutorial_weapon',
  stance: 'flag:tutorial_stance',
  spell: 'flag:tutorial_spell',
} as const;

/** Where the gate lets out: the city hub. Skipping lands here too. */
export const TUTORIAL_EXIT = 'ascent_foot';

/** The rack in the holding cell: what each pick grants (see chooseTutorialWeapon). */
export const TUTORIAL_RACK: Record<string, { item: string | null; hands: 'one' | 'two' | 'none' }> = {
  spear: { item: 'old_spear', hands: 'two' },
  sword: { item: 'rusty_sword', hands: 'one' },
  dagger: { item: 'iron_dagger', hands: 'one' },
  hammer: { item: 'old_hammer', hands: 'one' },
  unarmed: { item: null, hands: 'none' },
};

/** The shield that goes with a one-handed pick. */
export const TUTORIAL_SHIELD = 'wooden_shield';

/** The three words on offer; each becomes a one-word prepared sentence. */
export const TUTORIAL_SPELLS = ['fire', 'ice', 'spark'] as const;

/**
 * Intelligence level the spell pick trains the player to. Mana is 1 per INT
 * (derived.ts) and a one-word sentence costs 2, so this is the first level
 * at which the spell handed out can actually be cast.
 */
export const TUTORIAL_SPELL_INT = 2;

const flag = (key: string) => (s: { stats: Record<string, number> }) => (s.stats[key] ?? 0) >= 1;
const stood = (spot: string) => (s: { spot: string; discovered: string[] }) =>
  s.spot === spot || s.discovered.includes(spot);

export const TUTORIAL_STEPS = prose<TutorialStepDef>('TUTORIAL_STEPS', TUTORIAL_TEXT, {
  arm: {
    id: 'arm',
    title: 'Take a weapon',
    spot: 'f0_cell',
    choice: 'weapon',
    done: flag(TUTORIAL_FLAGS.weapon),
  },
  stance: {
    id: 'stance',
    title: 'Pick a stance',
    spot: 'f0_cell',
    choice: 'stance',
    done: flag(TUTORIAL_FLAGS.stance),
  },
  cellblock: {
    id: 'cellblock',
    title: 'Leave the cell',
    spot: 'f0_cellblock',
    done: stood('f0_cellblock'),
  },
  fight: {
    id: 'fight',
    title: 'Fight the Cell Slime',
    spot: 'f0_cellblock',
    done: (s) => (s.stats['slain:f0_cellblock:slime_cell'] ?? 0) >= 1,
  },
  field: {
    id: 'field',
    title: 'Go to the Field',
    spot: 'f0_field',
    done: stood('f0_field'),
  },
  spell: {
    id: 'spell',
    title: 'Pick a spell',
    spot: 'f0_field',
    choice: 'spell',
    done: flag(TUTORIAL_FLAGS.spell),
  },
  cast: {
    id: 'cast',
    title: 'Cast it',
    spot: 'f0_field',
    done: (s) => (s.stats['fights:f0_field'] ?? 0) >= 1,
  },
  gate: {
    id: 'gate',
    title: 'Go to the Gate',
    spot: 'f0_gate',
    done: stood('f0_gate'),
  },
  leave: {
    id: 'leave',
    title: 'Leave floor 0',
    spot: TUTORIAL_EXIT,
    done: stood(TUTORIAL_EXIT),
  },
});

/** The steps in reading order. */
export const TUTORIAL_STEP_LIST: TutorialStepDef[] = Object.values(TUTORIAL_STEPS);
