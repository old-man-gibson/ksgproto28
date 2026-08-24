import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { computeDerivedStats, getDerivedStats } from '../src/core/systems/derived';
import { serialize, deserialize } from '../src/core/save/save';
import { ATTRIBUTE_LIST } from '../src/core/data/attributes.data';
import { SKILLS, STATUSES } from '../src/core/registry';
import { applyStatus } from '../src/core/systems/statuses';
import { STAT_NAMES } from '../src/core/types';
import type { GameState, StatKey } from '../src/core/types';

/**
 * COMPLETABILITY (docs/COMPLETABILITY.md, Invariant A: no reachable state is
 * terminal) — the troll's half.
 *
 * The house policy is that clever play may TRIVIALIZE the game; it may not
 * BREAK it. Balance is not the subject here and cannot be unit-tested. What
 * can be is the line between the two: no `NaN`, no `Infinity`, no save that
 * refuses to load, no tick that dies on the way through. A player who finds a
 * degenerate loop should end up unreasonably strong, not stuck.
 *
 * There is precedent for this passing rather than theory: a real save reached
 * a dagger combat level of 109662 dealing ~79 trillion damage and "seems to
 * not explode everything". These tests are that accidental stress test made
 * deliberate, so the next system to land cannot quietly undo it.
 *
 * KNOWN SOFT SPOT, currently unreachable. Two instances of the SAME condition
 * compound multiplicatively with no ceiling: hand-built states with 20 copies
 * of every status at intensity 1e6 drive `speed` to Infinity, which then walks
 * straight through the clamps below it — `Math.max(1, x)` is a floor, not a
 * bound, so `interval = actionBar / (speed × attackSpeed)` goes to 0 and
 * `extraSwings` to Infinity. Nothing can build that state today: `applyStatus`
 * merges into the held instance, so the array holds each condition at most
 * once. It becomes reachable the moment anything writes `state.statuses`
 * directly, or a save migration produces duplicates. If that day comes, the
 * fix is a real clamp in `derived.ts` rather than a floor.
 */

/** Every number reachable from `root`, by path, that is not a finite number. */
function nonFinite(root: unknown): string[] {
  const bad: string[] = [];
  const seen = new WeakSet<object>();
  const walk = (node: unknown, path: string) => {
    if (typeof node === 'number') {
      if (!Number.isFinite(node)) bad.push(`${path} = ${node}`);
      return;
    }
    if (node === null || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${path}[${i}]`));
    else for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
  };
  walk(root, '');
  return bad;
}

/** A character no honest play produces: every attribute and skill absurd. */
function trollSave(seed = 3): GameState {
  const state = createInitialState(seed);
  for (const attr of ATTRIBUTE_LIST) state.attrs[attr.id].level = 1_000_000;
  for (const id of Object.keys(SKILLS)) state.skills[id] = { level: 100_000, xp: 0 };
  return state;
}

describe('completability — degeneracy may trivialize, never break', () => {
  it('absurd levels leave every derived stat a finite number', () => {
    const stats = computeDerivedStats(trollSave());
    const bad = (Object.keys(STAT_NAMES) as StatKey[])
      .filter((key) => !Number.isFinite(stats[key]))
      .map((key) => `${key} = ${stats[key]}`);
    expect(bad, `derived stats went off the number line:\n${bad.join('\n')}`).toEqual([]);
  });

  it('the cached read agrees with the raw one at absurd values', () => {
    // The memoised path must not be the one that overflows: a fingerprint
    // collision at extreme values would hand back another build's stats.
    const state = trollSave();
    const cached = getDerivedStats(state);
    const raw = computeDerivedStats(state);
    for (const key of Object.keys(STAT_NAMES) as StatKey[]) {
      expect(cached[key], `${key} differs between cached and raw`).toBe(raw[key]);
    }
  });

  it('an absurd save round-trips through JSON with nothing falling off', () => {
    // JSON.stringify turns Infinity and NaN into null, so a stat that overflows
    // does not merely read wrong — it comes back as a hole the loader has to
    // guess at. Prove there is nothing to guess.
    const state = trollSave();
    expect(nonFinite(state), 'the save held non-finite numbers BEFORE serializing').toEqual([]);

    const loaded = deserialize(serialize(state));
    expect(nonFinite(loaded), 'non-finite numbers after the round trip').toEqual([]);
    expect(loaded.attrs.str.level).toBe(1_000_000);
    expect(loaded.skills.fighting?.level).toBe(100_000);
  });

  it(
    'a fight at absurd values resolves instead of hanging or going NaN',
    () => {
      const game = new Game(trollSave(11));
      game.state.spot = 'woods_edge';
      game.selectActivity('hunt');
      for (let i = 0; i < 600; i++) game.tick();

      expect(nonFinite(game.state.resources), 'resource pools went off the number line').toEqual([]);
      expect(Number.isFinite(game.state.gold), `gold = ${game.state.gold}`).toBe(true);
      expect(game.state.resources.hp).toBeGreaterThan(0);
      expect(nonFinite(deserialize(serialize(game.state))), 'the played save is loadable').toEqual(
        [],
      );
    },
    // Deliberately generous. This build's cost per tick scales with
    // `extraSwings` — speed past the attack-time floor becomes extra hits, so
    // one tick resolves a great many swings. It finishes, which is the claim;
    // it does not finish quickly, which is the price of the claim.
    30_000,
  );

  it('every condition in the game, laid on at once and hammered, stays finite', () => {
    // The other extreme: the troll wearing every condition the game can
    // inflict, each applied far more often than a fight would.
    //
    // Applied through `applyStatus` on purpose. It merges into the instance
    // already held (`findStatus`), so the array can never hold two of the same
    // condition — pushing raw instances instead would test a state the engine
    // cannot reach, and duplicate instances DO compound without a ceiling.
    // See the note at the top of this file.
    const state = createInitialState(5);
    for (const attr of ATTRIBUTE_LIST) state.attrs[attr.id].level = 1;
    for (const id of Object.keys(STATUSES)) {
      for (let i = 0; i < 500; i++) {
        applyStatus(state, state, { id, intensity: 1000, duration: 'permanent' }, 'troll');
      }
    }
    expect(state.statuses.length, 'applyStatus should merge, not duplicate').toBe(
      Object.keys(STATUSES).filter((id) => state.statuses.some((s) => s.id === id)).length,
    );

    const stats = computeDerivedStats(state);
    const bad = (Object.keys(STAT_NAMES) as StatKey[])
      .filter((key) => !Number.isFinite(stats[key]))
      .map((key) => `${key} = ${stats[key]}`);
    expect(bad, `derived stats went off the number line:\n${bad.join('\n')}`).toEqual([]);
    expect(stats.maxHp, 'maxHp must stay a positive number').toBeGreaterThan(0);
    expect(nonFinite(deserialize(serialize(state))), 'the afflicted save is loadable').toEqual([]);
  });
});
