import type { GameState } from '../types';

/**
 * Mulberry32 PRNG. State lives in GameState.rngState so random sequences are
 * deterministic given a save — which makes core systems unit-testable.
 */
export function rand(state: GameState): number {
  state.rngState = (state.rngState + 0x6d2b79f5) | 0;
  let t = state.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Random integer in [min, max] inclusive. */
export function randInt(state: GameState, min: number, max: number): number {
  return min + Math.floor(rand(state) * (max - min + 1));
}

export function chance(state: GameState, p: number): boolean {
  return rand(state) < p;
}

/** Weighted pick from a list of { weight } entries. */
export function weightedPick<T extends { weight: number }>(state: GameState, entries: T[]): T {
  const total = entries.reduce((s, e) => s + e.weight, 0);
  let roll = rand(state) * total;
  for (const e of entries) {
    roll -= e.weight;
    if (roll <= 0) return e;
  }
  return entries[entries.length - 1];
}
