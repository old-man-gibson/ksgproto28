import type { GameState } from '../types';
import type { FacetDoc } from './facet';

/**
 * The game telling the run's ability what just happened (docs/FACET.md,
 * "Events"), and which state the FACET core reads and writes.
 *
 * Light on purpose: the systems that raise an event (health.ts, combat.ts)
 * import this file and nothing heavier, so no import cycle reaches the
 * adapter. host.ts re-exports what the rest of the game uses.
 */

/** The player's ref. Refs are strings so they survive JSON and the core's Map keys. */
export const PLAYER_REF = 'player';

/** An enemy's ref is this plus its slot in the fight (`foe:0` is the front). */
export const FOE = 'foe:';

/**
 * Event ids are shared vocabulary, like quantity ids: one document listens
 * for `fightWon` in both games, and each game says where it raises it. A
 * document reads an event's detail with `{ frame: '<field>' }`.
 *
 * | id | when (this game) | detail |
 * |---|---|---|
 * | fightStart | an encounter begins (bus `encounter`) | enemies, maxLevel |
 * | kill | an enemy dies (bus `kill`) | level, boss (1 for the spot's boss) |
 * | fightWon | the last enemy fell (bus `fight:won`), after its `kill` | |
 * | fightEnd | a fight closed however it ended (bus `fight:closed`) | won (0 or 1) |
 * | hitTaken | any damage reached the player (health.ts damagePlayer) | amount (what reached your HP), blow (the blow as thrown, before armour, resistance and ward; equals amount when nothing was thrown), type ('none' when untyped), attacker (the enemy's ref; '' for a condition, a trap, your own backlash), self (1 for a spell you cast on yourself, else 0), boss (1 when the attacker is the spot's boss) |
 * | hit, crit, dodge, parry, graze, enemyCast | combat's trigger stamps (markCombatEvent) | |
 * | flaskUsed | an alchemy flask was used (Game.useFlask) | |
 * | itemUsed | a consumable was used (Game.useConsumable) | |
 * | miracleCast | a miracle was cast in a fight (combat.ts) | |
 * | statue | an ability's dose turned an enemy to stone (host.ts applyStatus) | target (its ref), level, levelShare (its level ÷ yours), attrShare (its attribute total ÷ yours), boss |
 * | rocks | a statue's rocks hit an enemy (combat.ts throwRubble) | target (its ref), amount |
 * | barFill | the player's action bar filled, before the action (combat.ts) | |
 * | eat | the player ate a dish (consumables.ts useConsumable) | calories (dishCalories: Well Fed x 400, or 100, x grade) |
 * | act | the player used one of the ability's `reading.actions` at a bar fill (combat.ts, host.ts fireFacetAction) | action (its key) |
 */
export type FacetEventId =
  | 'fightStart'
  | 'kill'
  | 'fightWon'
  | 'fightEnd'
  | 'hitTaken'
  | 'hit'
  | 'crit'
  | 'dodge'
  | 'parry'
  | 'graze'
  | 'enemyCast'
  | 'flaskUsed'
  | 'itemUsed'
  | 'miracleCast'
  | 'statue'
  | 'rocks'
  | 'barFill'
  | 'eat'
  | 'act';

/** combat.ts's trigger stamps that are also ability events. onEncounterStart is not: fightStart carries the enemies. */
const COMBAT_STAMPS: Record<string, FacetEventId> = {
  onHit: 'hit',
  onCrit: 'crit',
  onDodge: 'dodge',
  onParry: 'parry',
  onGraze: 'graze',
  onEnemyCast: 'enemyCast',
};

/** The state the core reads and writes: whichever one `bindFacets` was last given. */
let bound: GameState | null = null;

export function boundState(): GameState | null {
  return bound;
}

/**
 * Point the core at the state being ticked and attach that state's ability.
 * The core writes cell values into the document objects it was handed, so
 * those must be the documents this state will save. The live game and offline
 * catch-up's detached copy are different objects (ui/state.svelte.ts
 * `runCatchup`), so the binding follows whichever state advances. `force`
 * re-attaches the same state after its contents were replaced wholesale
 * (catch-up landing, an import, a reset, a prestige): Game.resyncAnnouncers.
 * A no-op until the adapter is installed.
 */
export function bindFacets(state: GameState, force = false): void {
  if (!globalThis.Facet?.ready()) return;
  if (bound === state && !force) return;
  bound = state;
  globalThis.Facet.detach(PLAYER_REF);
  globalThis.Facet.attach(PLAYER_REF, state.facets ?? []);
}

/** Raise an ability event for the player. Free when no ability is held. */
export function facetSignal(state: GameState, id: FacetEventId, detail: Record<string, unknown> = {}): void {
  if (!state.facets?.length) return;
  bindFacets(state);
  if (bound === state) globalThis.Facet.event(id, PLAYER_REF, detail);
}

/**
 * One combat tick for the run's ability: fires its `on: 'tick'` clauses
 * (combat.ts tickCombat). True when an ability ticked, so the caller knows to
 * sweep anything it killed. Free when no ability is held.
 */
export function facetCombatTick(state: GameState): boolean {
  if (!state.facets?.length) return false;
  bindFacets(state);
  if (bound !== state) return false;
  globalThis.Facet.tick(PLAYER_REF);
  return true;
}

/** A rotation entry for an ability action is this plus the action's key (`facet:sun_blast`). */
export const FACET_ACTION = 'facet:';

/** One of the held ability's `reading.actions`, and whether it can be used now. */
export interface HeldAction {
  /** Its rotation id: FACET_ACTION + key. */
  id: string;
  key: string;
  name: string;
  icon: string;
  desc: string;
  /** The cell the Ability tab draws its button beneath; '' for none. */
  under: string;
  ready: boolean;
}

/**
 * The actions the run's ability offers. Read without binding, like the
 * readouts: a state the core is not pointed at offers none. combat.ts reads
 * this during a fight, where facetCombatTick has just bound the state.
 */
export function facetActions(state: GameState): HeldAction[] {
  if (!state.facets?.length || bound !== state || !globalThis.Facet?.ready()) return [];
  return state.facets.flatMap(actionsOf);
}

/** One document's actions. The core must be installed and pointed at the state that holds it. */
export function actionsOf(doc: FacetDoc): HeldAction[] {
  return (doc.reading?.actions ?? []).map((a) => ({
    id: FACET_ACTION + a.key,
    key: a.key,
    name: a.name,
    icon: a.icon,
    desc: a.desc ?? '',
    under: a.under ?? '',
    ready: globalThis.Facet.evalExpr(a.ready, { ref: PLAYER_REF, facet: doc, bindings: {} }) > 0,
  }));
}

/**
 * Use an action now: raise `act` for the document to answer. False when the
 * ability does not offer it or it is not ready. combat.ts calls this at a bar
 * fill, then sweeps what it killed.
 */
export function fireFacetAction(state: GameState, key: string): boolean {
  if (!facetActions(state).some((a) => a.key === key && a.ready)) return false;
  globalThis.Facet.event('act', PLAYER_REF, { action: key });
  return true;
}

/** Forward one of combat.ts's trigger stamps, when it is also an ability event. */
export function facetCombatStamp(state: GameState, stamp: string): void {
  const id = COMBAT_STAMPS[stamp];
  if (id) facetSignal(state, id);
}
