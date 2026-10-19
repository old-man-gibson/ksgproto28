import type { EventBus } from '../engine/events';
import type { GameState, TutorialStepDef, TutorialWeapon } from '../types';
import { ITEMS, STYLES, getSpot } from '../registry';
import {
  TUTORIAL_DONE_KEY,
  TUTORIAL_EXIT,
  TUTORIAL_FLAGS,
  TUTORIAL_RACK,
  TUTORIAL_SHIELD,
  TUTORIAL_SPELLS,
  TUTORIAL_SPELL_INT,
  TUTORIAL_STEP_LIST,
} from '../data/tutorial.data';
import { bumpStat } from './achievements';
import { attrXpNeeded, grantAttrXp } from './attributes';
import { equipItem } from './equipment';
import { createItem } from './runes';
import { addSpell } from './spellcraft';
import { abandonCombat } from './combat';
import { noteSafeSpot } from './safety';
import { revealMapped } from './mapped';
import { text } from '../text/log';

/**
 * Floor 0, the tutorial (docs/TUTORIAL.md).
 *
 * The runtime is small on purpose: the tutorial is a commentary track over
 * ordinary content, so this file owns exactly three things — which panel is
 * current (derived from the world, never saved), the three one-time choices
 * (grant + stamp), and the two ways out (walking through the gate, or the
 * skip). Everything the panels talk about — roads, hunts, stances, the
 * grimoire — is the same code the rest of the game runs.
 */

/** On until `flag:tutorial_done` ≥ 1 — stamped at the gate, by the skip, by prestige, and by migration. */
export function tutorialActive(state: GameState): boolean {
  return (state.stats[TUTORIAL_DONE_KEY] ?? 0) < 1;
}

/** The first step the world says is not done; null once every one is, or once the tutorial is over. */
export function tutorialStep(state: GameState): TutorialStepDef | null {
  if (!tutorialActive(state)) return null;
  return TUTORIAL_STEP_LIST.find((s) => !s.done(state)) ?? null;
}

/** 1-based position of the current step, for "3 of 9". */
export function tutorialStepIndex(state: GameState): number {
  const step = tutorialStep(state);
  return step ? TUTORIAL_STEP_LIST.indexOf(step) + 1 : TUTORIAL_STEP_LIST.length;
}

function chosen(state: GameState, key: string): boolean {
  return (state.stats[key] ?? 0) >= 1;
}

/**
 * The rack: grant the pick, equip it, and the shield beside it when the pick
 * leaves a hand free. `unarmed` grants nothing but still counts — holding
 * nothing is a real choice and the fists have their own schools. Refused
 * (false) once made; the rack is emptied by the first hand into it.
 */
export function chooseTutorialWeapon(
  state: GameState,
  bus: EventBus,
  weapon: TutorialWeapon,
  shield = false,
): boolean {
  if (chosen(state, TUTORIAL_FLAGS.weapon)) return false;
  const pick = TUTORIAL_RACK[weapon];
  if (!pick) return false;
  const granted: string[] = [];
  if (pick.item && ITEMS[pick.item]) {
    // The pack already holds a rusty sword (state.ts): picking the sword
    // equips that one rather than minting a twin.
    let item = state.inventory.find((i) => i.defId === pick.item);
    if (!item) {
      item = createItem(state, pick.item);
      state.inventory.push(item);
    }
    equipItem(state, bus, item.uid);
    granted.push(`${ITEMS[pick.item].icon} ${ITEMS[pick.item].name}`);
  }
  if (shield && pick.hands === 'one' && ITEMS[TUTORIAL_SHIELD]) {
    const item = createItem(state, TUTORIAL_SHIELD);
    state.inventory.push(item);
    equipItem(state, bus, item.uid, 'offhand');
    granted.push(`${ITEMS[TUTORIAL_SHIELD].icon} ${ITEMS[TUTORIAL_SHIELD].name}`);
  }
  bumpStat(state, bus, TUTORIAL_FLAGS.weapon);
  bus.emit({
    type: 'log',
    msg: granted.length ? text('tutorial.armed', { list: granted.join(', ') }) : text('tutorial.unarmed'),
    kind: 'quest',
  });
  return true;
}

/**
 * The stance pick only STAMPS: the stance itself is set through the same
 * `setStyle` the Combat tab uses (the Game method calls that first), so the
 * tutorial teaches the real control rather than a copy of it.
 */
export function confirmTutorialStance(state: GameState, bus: EventBus): boolean {
  if (chosen(state, TUTORIAL_FLAGS.stance)) return false;
  bumpStat(state, bus, TUTORIAL_FLAGS.stance);
  const style = STYLES[state.style];
  bus.emit({
    type: 'log',
    msg: text('tutorial.stance', { icon: style?.icon ?? '', name: style?.name ?? state.style }),
    kind: 'quest',
  });
  return true;
}

/**
 * The spell: a one-word arcane sentence written straight into the grimoire,
 * prepared, plus the Intelligence to cast it. Written with `addSpell` rather
 * than `inscribeArcane` on purpose — the table's legality check would refuse
 * `spark` (Arcana 3) to a fresh speaker, and the counter the Warden's second
 * quest reads (`spells:inscribed`) is left alone so the table is still the
 * thing that quest teaches.
 */
export function chooseTutorialSpell(state: GameState, bus: EventBus, word: string): boolean {
  if (chosen(state, TUTORIAL_FLAGS.spell)) return false;
  if (!(TUTORIAL_SPELLS as readonly string[]).includes(word)) return false;
  const spell = addSpell(state, { school: 'arcane', words: [word] });
  spell.prepared = true;
  // Read up to the level, never past it: a save that trained Intelligence on
  // the plaque first keeps what it earned and gains nothing twice.
  const int = state.attrs.int;
  let need = -int.xp;
  for (let level = int.level; level < TUTORIAL_SPELL_INT; level++) need += attrXpNeeded(level);
  if (need > 0) grantAttrXp(state, bus, 'int', need);
  bumpStat(state, bus, TUTORIAL_FLAGS.spell);
  bus.emit({ type: 'log', msg: text('tutorial.spell', { word }), kind: 'quest' });
  return true;
}

/**
 * The gate stamps the end: the tutorial finishes the moment the player
 * stands at the Foot, however they got there. Registered on the bus like the
 * quest listeners, so travel never has to know the tutorial exists.
 */
export function registerTutorialListeners(state: GameState, bus: EventBus): void {
  bus.on('arrive', (ev) => {
    if (ev.spot !== TUTORIAL_EXIT || !tutorialActive(state)) return;
    finishTutorial(state, bus);
  });
}

function finishTutorial(state: GameState, bus: EventBus): void {
  bumpStat(state, bus, TUTORIAL_DONE_KEY);
  bus.emit({ type: 'log', msg: text('tutorial.done'), kind: 'quest' });
}

/**
 * Skip: every choice not yet made is settled the way the game used to open
 * (the rusty sword left in the pack, Neutral, no spell), every flag is stamped, and
 * the player is stood at the Foot with no road walked. Combat on the floor
 * is abandoned first — the Cell Slime is not worth a knockout on the way out.
 */
export function skipTutorial(state: GameState, bus: EventBus): boolean {
  if (!tutorialActive(state)) return false;
  if (state.combat) abandonCombat(state);
  if (!chosen(state, TUTORIAL_FLAGS.weapon)) {
    // The rusty sword is already in the pack (state.ts); a save that somehow
    // lost it is handed one so the old opening is exactly what it gets.
    if (!state.inventory.some((i) => i.defId === 'rusty_sword') && !state.equipment.weapon) {
      state.inventory.push(createItem(state, 'rusty_sword'));
    }
    bumpStat(state, bus, TUTORIAL_FLAGS.weapon);
  }
  if (!chosen(state, TUTORIAL_FLAGS.stance)) bumpStat(state, bus, TUTORIAL_FLAGS.stance);
  if (!chosen(state, TUTORIAL_FLAGS.spell)) bumpStat(state, bus, TUTORIAL_FLAGS.spell);

  state.activity = null;
  state.travel = null;
  state.travelPlan = [];
  state.travelIntent = null;
  state.pendingApproach = null;
  if (state.spot !== TUTORIAL_EXIT) {
    state.spot = TUTORIAL_EXIT;
    if (!state.discovered.includes(TUTORIAL_EXIT)) state.discovered.push(TUTORIAL_EXIT);
    noteSafeSpot(state, TUTORIAL_EXIT);
  }
  revealMapped(state);
  const dest = getSpot(TUTORIAL_EXIT);
  bus.emit({ type: 'log', msg: text('tutorial.skipped', { icon: dest.icon, name: dest.name }), kind: 'quest' });
  // The arrive listener above stamps the done flag and logs the finish; a
  // Game without listeners (a bare test) is finished here instead.
  bus.emit({ type: 'arrive', spot: TUTORIAL_EXIT });
  if (tutorialActive(state)) finishTutorial(state, bus);
  return true;
}
