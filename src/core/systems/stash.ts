import type { EventBus } from '../engine/events';
import type { FestivalToken, GameState, ItemInstance, StrongholdStash } from '../types';
import { ITEMS, TECHNIQUES } from '../registry';
import { TOKEN_BONUS, TOKEN_REGALIA, TOKEN_TECHNIQUES } from '../data/festival.data';
import { itemDefOf } from './assembly';
import { nextUid } from './equipment';
import { festivalHolds } from './festivalRules';
import { festivalBonusStacks } from './legacy';
import { fightHeldItems, learnTechnique } from './martial';
import { createItem } from './runes';
import { text } from '../text/log';

/**
 * The stronghold stash (docs/FLOOR_IDEAS.md §5.3 items 23–24): the one store
 * a prestige keeps. It lives on the legacy block (`state.prestige.stash`) and
 * holds two things only: festival tokens, one per hundred festival wins in a
 * run, and keep-marked items (`ItemDef.keep`). Every prestige returns a
 * keep-marked item to it from wherever it is; the next run takes it out.
 *
 * A token is spent on one of three, each kept through prestige:
 * - the permanent bonus: a stack of TOKEN_BONUS, up to its cap. A modifier
 *   source, so its count sits in modFingerprint (derived.ts);
 * - a technique: one of three drawn from TOKEN_TECHNIQUES with the token's
 *   seed, learned canonically now and at the start of every later run;
 * - the regalia: a keep-marked piece above the festival's normal reward.
 */

/** The stash, created on first use. Assigned, then read back through the state. */
export function stashOf(state: GameState): StrongholdStash {
  if (!state.prestige.stash) state.prestige.stash = { tokens: [], items: [] };
  return state.prestige.stash;
}

/** Only keep-marked items may enter the stash. */
export function keepMarked(item: Pick<ItemInstance, 'defId' | 'forged'>): boolean {
  return !!itemDefOf(item)?.keep;
}

/** A token into the stash; `seed` fixes its technique offer. */
export function stashToken(state: GameState, seed: number): void {
  stashOf(state).tokens.push({ seed: seed >>> 0 });
}

/** Put a keep-marked item in the stash. Refused for anything else. */
export function stashItem(state: GameState, item: ItemInstance): boolean {
  if (!keepMarked(item)) return false;
  stashOf(state).items.push(item);
  return true;
}

/**
 * Take a kept item out into the pack. It gets a fresh uid: uids restart with
 * every run, so the one it was stored under may already be taken. Refused
 * inside a festival attempt: the door holds everything, and the stronghold
 * is outside it.
 */
export function takeFromStash(state: GameState, bus: EventBus, index: number): boolean {
  const stash = state.prestige.stash;
  const item = stash?.items[index];
  if (!stash || !item || festivalHolds(state)) return false;
  stash.items.splice(index, 1);
  const taken: ItemInstance = { ...item, uid: nextUid(state) };
  state.inventory.push(taken);
  const def = itemDefOf(taken);
  bus.emit({ type: 'log', msg: text('stash.taken', { icon: def?.icon ?? '', name: def?.name ?? taken.defId }), kind: 'item' });
  return true;
}

// ---------- Tokens ----------

/** A small seeded generator, so a token's offer is the same every time it is opened. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The techniques a token offers: the pool shuffled by the token's seed, less
 * those already taken from earlier tokens, the first `offer` of what is left.
 * Fewer when the pool runs short; none once every one is taken.
 */
export function tokenTechniques(state: GameState, token: FestivalToken): string[] {
  const rng = seeded(token.seed);
  const pool = TOKEN_TECHNIQUES.pool.filter((id) => !!TECHNIQUES[id]);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const taken = new Set(state.prestige.festivalTechniques ?? []);
  return pool.filter((id) => !taken.has(id)).slice(0, TOKEN_TECHNIQUES.offer);
}

export type TokenChoice = { kind: 'bonus' } | { kind: 'technique'; id: string } | { kind: 'regalia' };

/** Whether a choice can be made with this token now. */
export function tokenChoiceOpen(state: GameState, token: FestivalToken, choice: TokenChoice): boolean {
  switch (choice.kind) {
    case 'bonus':
      return festivalBonusStacks(state) < TOKEN_BONUS.cap;
    case 'technique':
      return tokenTechniques(state, token).includes(choice.id);
    case 'regalia':
      return !!ITEMS[TOKEN_REGALIA]?.keep;
  }
}

/** Spend the token at `index` on one of its three choices. False when that choice is not open. */
export function spendToken(state: GameState, bus: EventBus, index: number, choice: TokenChoice): boolean {
  const stash = state.prestige.stash;
  const token = stash?.tokens[index];
  if (!stash || !token || !tokenChoiceOpen(state, token, choice)) return false;
  stash.tokens.splice(index, 1);
  if (choice.kind === 'bonus') {
    state.prestige.festivalBonus = festivalBonusStacks(state) + 1;
    bus.emit({
      type: 'log',
      msg: text('stash.bonus', { stacks: state.prestige.festivalBonus, cap: TOKEN_BONUS.cap }),
      kind: 'achievement',
    });
  } else if (choice.kind === 'technique') {
    const def = TECHNIQUES[choice.id];
    const legacy = state.prestige.festivalTechniques ?? [];
    state.prestige.festivalTechniques = [...legacy, choice.id];
    learnTechnique(state, def, 'canonical');
    bus.emit({ type: 'log', msg: text('stash.technique', { icon: def.icon, name: def.name }), kind: 'achievement' });
  } else {
    stashItem(state, createItem(state, TOKEN_REGALIA));
    const def = ITEMS[TOKEN_REGALIA];
    bus.emit({ type: 'log', msg: text('stash.regalia', { icon: def.icon, name: def.name }), kind: 'achievement' });
  }
  return true;
}

// ---------- Prestige ----------

/**
 * The stash the next run starts with: what it held, plus every keep-marked
 * item found anywhere in the run ending — worn, carried, sheathed, held by a
 * fight, or held at the festival's door. Plain copies, so nothing is shared
 * with the run left behind.
 */
export function carriedStash(state: GameState): StrongholdStash {
  const old = state.prestige.stash;
  const items: ItemInstance[] = [];
  const find = (item: ItemInstance | null | undefined) => {
    if (item && keepMarked(item) && !items.includes(item)) items.push(item);
  };
  for (const item of old?.items ?? []) find(item);
  for (const item of state.inventory) find(item);
  for (const item of Object.values(state.equipment)) find(item);
  find(state.sheathed);
  for (const item of fightHeldItems(state.combat)) find(item);
  const held = state.festival?.run?.held;
  if (held) {
    for (const item of held.inventory) find(item);
    for (const item of Object.values(held.equipment)) find(item);
    find(held.sheathed);
  }
  return JSON.parse(JSON.stringify({ tokens: old?.tokens ?? [], items })) as StrongholdStash;
}

/** A new run: the festival techniques taken from tokens come back, canonical. */
export function applyFestivalLegacy(state: GameState): void {
  for (const id of state.prestige.festivalTechniques ?? []) {
    const def = TECHNIQUES[id];
    if (def) learnTechnique(state, def, 'canonical');
  }
}
