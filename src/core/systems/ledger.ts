import type {
  FightLedger,
  FightOutcome,
  GameState,
  LedgerSource,
  MonsterInstance,
  NotebookEntry,
} from '../types';
import { STATUSES } from '../registry';

/**
 * The fight ledger: what happened to you, attributed.
 *
 * The engine already computes every number this keeps — what a blow threw, what
 * armour took off it, what a parry turned aside, what a condition bit for. All
 * of it was transient, thrown away a tick later, which meant the one sentence
 * the game printed when you went down ("the Goblin Boss knocks you out") named
 * whoever happened to be standing in the centre slot rather than whatever
 * actually did it. A rot stack from a slime you already killed could put you on
 * the floor and the game would confidently blame the goblin.
 *
 * So: sum as it happens, attribute at the source, and commit one rollup when the
 * encounter ends. The size invariant is on FightLedger and it is the whole
 * design — everything here adds to a bucket, nothing appends to a list that
 * grows with time.
 */

/**
 * `ticks` is stamped with the NEGATED start tick and resolved to a duration in
 * endFight. That keeps the start on the ledger itself without a second field
 * riding in every save, and means a lazily-made ledger dates from the first
 * damage rather than from a fight it was never part of.
 */
function blank(state: GameState): FightLedger {
  return {
    outcome: 'won',
    ticks: -state.totalTicks,
    endedAt: state.totalTicks,
    spot: state.spot,
    foes: [],
    incoming: [],
    stopped: { absorbed: 0, parried: 0, riposted: 0, dodged: 0, parries: 0, dodges: 0 },
    healed: {},
    healRefused: 0,
    outgoing: { damage: 0, hits: 0, kills: 0 },
    afflictions: [],
    transcript: [],
  };
}

/**
 * How many fights the notebook keeps.
 *
 * At roughly 3 KB a kept fight this is about 60 KB — some way under one percent
 * of what a browser will hold. The cap is here to stop the save growing without
 * bound, not because the space is tight, so it can be raised freely.
 */
export const NOTEBOOK_MAX = 20;

/** Whether this fight is already kept. */
export function isKept(state: GameState, ledger: FightLedger | null): boolean {
  return !!ledger && state.notebook.some((e) => e.id === ledger.endedAt);
}

/**
 * Keep a fight. Returns what was evicted to make room, if anything — the caller
 * announces it, because a notebook that silently forgets the fight you meant to
 * study is worse than one that refuses to take it.
 */
export function keepFight(
  state: GameState,
  ledger: FightLedger,
  now: number,
): NotebookEntry | null {
  if (isKept(state, ledger)) return null;
  state.notebook.unshift({ id: ledger.endedAt, keptAt: now, ledger });
  if (state.notebook.length <= NOTEBOOK_MAX) return null;
  return state.notebook.pop() ?? null;
}

/** Forget a kept fight. */
export function dropFight(state: GameState, id: number): void {
  const at = state.notebook.findIndex((e) => e.id === id);
  if (at >= 0) state.notebook.splice(at, 1);
}

/**
 * The ledger to write into, made on demand. Lazy because damage does not only
 * happen inside encounters: a bleed ticking while you chop wood must land
 * somewhere, or the window that explains your death would be empty in exactly
 * the case where you least expect to be dying.
 */
export function ensureLedger(state: GameState): FightLedger {
  // Deliberately not `??=`: its VALUE is the raw object, not the reactive proxy
  // the UI reads, and everything downstream writes through what this returns.
  if (!state.fight) state.fight = blank(state);
  return state.fight;
}

/** Start a fresh tally for an encounter, remembering who turned up. */
export function beginFight(state: GameState, foes: (MonsterInstance | null)[]): void {
  const led = blank(state);
  for (const e of foes) {
    if (!e) continue;
    const seen = led.foes.find((f) => f.defId === e.defId);
    if (seen) {
      seen.count += 1;
      seen.level = Math.max(seen.level, e.level);
    } else {
      led.foes.push({ defId: e.defId, name: e.name, icon: e.icon, level: e.level, count: 1 });
    }
  }
  state.fight = led;
}

function bump(list: LedgerSource[], src: Omit<LedgerSource, 'amount' | 'hits'>, amount: number) {
  const seen = list.find((s) => s.key === src.key);
  if (seen) {
    seen.amount += amount;
    seen.hits += 1;
    return;
  }
  list.push({ ...src, amount, hits: 1 });
}

/** Damage that landed on the player, credited to whatever actually dealt it. */
export function noteIncoming(
  state: GameState,
  src: { key: string; label: string; icon: string },
  amount: number,
): void {
  if (amount <= 0) return;
  bump(ensureLedger(state).incoming, src, amount);
}

/** A condition biting, named from the registry so the window reads properly. */
export function noteConditionDamage(state: GameState, id: string, amount: number): void {
  const def = STATUSES[id];
  noteIncoming(
    state,
    { key: `cond:${id}`, label: def?.name ?? id, icon: def?.icon ?? '☠️' },
    amount,
  );
}

/** A monster's blow, credited to the specimen's def rather than its slot. */
export function noteMonsterDamage(state: GameState, e: MonsterInstance, amount: number): void {
  noteIncoming(state, { key: `monster:${e.defId}`, label: e.name, icon: e.icon }, amount);
}

/** Damage that never reached you, and how it was stopped. */
export function noteAbsorbed(state: GameState, amount: number): void {
  if (amount > 0) ensureLedger(state).stopped.absorbed += amount;
}

export function noteParry(state: GameState, turnedAside: number, riposted: number): void {
  const s = ensureLedger(state).stopped;
  s.parried += Math.max(0, turnedAside);
  s.riposted += Math.max(0, riposted);
  s.parries += 1;
}

export function noteDodge(state: GameState, avoided: number): void {
  const s = ensureLedger(state).stopped;
  s.dodged += Math.max(0, avoided);
  s.dodges += 1;
}

/** Health that came back, by the kind of act that returned it. */
export function noteHealed(state: GameState, kind: string, amount: number): void {
  if (amount <= 0) return;
  const led = ensureLedger(state);
  led.healed[kind] = (led.healed[kind] ?? 0) + amount;
}

/** Healing a condition refused to let land — a blaze capping its own undoing. */
export function noteHealRefused(state: GameState, amount: number): void {
  if (amount > 0) ensureLedger(state).healRefused += amount;
}

/** What you dealt. Kills are counted separately because they pace the fight. */
export function noteOutgoing(state: GameState, amount: number, kill = false): void {
  const out = ensureLedger(state).outgoing;
  if (amount > 0) {
    out.damage += amount;
    out.hits += 1;
  }
  if (kill) out.kills += 1;
}

/**
 * Close the books and hand the result to `lastFight`.
 *
 * Called on every outcome, not just defeats: a win where you finished on four
 * health is worth reading, and accumulating unconditionally is what makes the
 * whole thing testable without having to die on purpose.
 */
export function endFight(state: GameState, outcome: FightOutcome): FightLedger | null {
  const led = state.fight;
  if (!led) return null;
  led.outcome = outcome;
  led.endedAt = state.totalTicks;
  // Negated start tick → elapsed duration. Clamped because an imported save can
  // carry a live ledger stamped against a clock this one never ran.
  led.ticks = Math.max(0, state.totalTicks + led.ticks);
  led.incoming.sort((a, b) => b.amount - a.amount);
  led.afflictions = state.statuses
    .filter((h) => !STATUSES[h.id]?.hidden)
    .map((h) => ({
      id: h.id,
      name: STATUSES[h.id]?.name ?? h.id,
      icon: STATUSES[h.id]?.icon ?? '☠️',
      intensity: h.intensity,
    }));
  state.lastFight = led;
  state.fight = null;
  return led;
}
