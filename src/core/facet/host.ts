import type { DamageType, GameState, StatusApplication, StatusDef } from '../types';
import { ELEMENTAL_TYPES, PHYSICAL_TYPES, RES_STAT_BY_TYPE } from '../types';
import { TPS } from '../engine/loop';
import { chance, rand } from '../engine/rng';
import { procChance, procRate } from '../engine/mercy';
import { STATUSES } from '../data/statuses.data';
import { applyStatus, findStatus, removeStatus } from '../systems/statuses';
import { getDerivedStats } from '../systems/derived';
import { appendLog } from '../systems/log';
import { facetQuantities, readQuantity } from './quantities';
import type { FacetHost } from './facet';
import './load';

/**
 * This game's adapter for the FACET core (Facet repo docs/FACET-SPEC.md §2,
 * §4; the port plan is docs/plans/universal-abilities.md).
 *
 * **Step K1: the player is the only bearer.** Monsters never wear an ability
 * (rolled-abilities.md, "Settled with the user"), and nothing here reaches a
 * fight yet: K2 brings the staged damage path, K3 the action gate and
 * overrides, K4 the monster side of overrides. Members those steps own are
 * present, because `Facet.install` refuses a host with a member missing, and
 * each says what it does until then.
 *
 * Every member reads the state through `getState`, never a captured object:
 * offline catch-up ticks a detached copy of the state (ui/state.svelte.ts
 * `runCatchup`), and the binding to it arrives with the first ability that
 * ticks outside a fight (step 2).
 */

/** The player's ref. Refs are strings so they survive JSON and the core's Map keys. */
export const PLAYER_REF = 'player';

const DAMAGE_TYPES = Object.keys(RES_STAT_BY_TYPE) as DamageType[];

/** Off: what this game does not have, or does not have yet. The core skips the matching members. */
const CAPS = {
  // One bearer; no allies, no party.
  party: false,
  ally: false,
  // No arena laws until fights have a tick cap (K3: tickCombat has none).
  arena: false,
  laws: false,
  // No mission tier and no calendar writes: an ability's state lasts the run (step 2).
  mission: false,
  calendar: false,
  summon: false,
  revive: false,
  // The pricing oracle needs a seeded encounter runner; the generator is parked.
  simulate: false,
};

/**
 * Status fields a FACET document may set on a generated condition. The
 * compiler copies only fields named here (facet.compile.js `filterToSchema`),
 * so a field this game does not read can never be emitted. `kind` and
 * `mortality` feed the mortality proof (FACET-SPEC §7).
 */
const STATUS_SCHEMA = {
  fields: {
    mods: { kind: 'mod' },
    duration: { kind: 'meta' },
    hidden: { kind: 'meta' },
    stacking: { kind: 'meta' },
    desc: { kind: 'meta' },
    overrideRes: { kind: 'res', mortality: 'coverage' },
  },
};

function notYet(member: string, step: string): () => never {
  return () => {
    throw new Error(`Facet host (ksgproto28): ${member} arrives with ${step}; no document may use it yet`);
  };
}

export function createFacetHost(getState: () => GameState): FacetHost {
  const s = getState;
  // Cell state per tier and ref. Transient for now: no ability exists, and the
  // run-long tier and its save field are step 2 (core addition 4).
  const bags = new Map<string, Record<string, unknown>>();

  return {
    id: 'ksgproto28',
    ticksPerSecond: TPS,
    caps: CAPS,
    // No fight here has a tick cap. The core reads Infinity as "refuse arena laws".
    encounterCap: () => Infinity,

    // ---- chance: the game's own RNG stream and mercy ledger ----
    rand: () => rand(s()),
    pick: <T>(arr: T[]): T | undefined => (arr.length ? arr[Math.floor(rand(s()) * arr.length)] : undefined),
    weightedPick: <T>(arr: T[], weightOf: (x: T) => number): T | undefined => {
      const total = arr.reduce((n, x) => n + Math.max(0, weightOf(x)), 0);
      if (!arr.length || total <= 0) return arr[0];
      let roll = rand(s()) * total;
      for (const x of arr) {
        roll -= Math.max(0, weightOf(x));
        if (roll < 0) return x;
      }
      return arr[arr.length - 1];
    },
    // A FACET chance is a combat proc: smoothed and capped like a crit (engine/mercy.ts).
    proc: (_ref: string, key: string, rate: number, mercy: boolean) =>
      mercy ? procChance(s(), key, rate) : chance(s(), rate),
    curveRate: (_ref: string, key: string, rate: number) => procRate(s(), key, rate),

    // ---- the bearer ----
    now: () => s().totalTicks,
    bearerId: (ref: string) => ref,
    isAlive: () => s().resources.hp > 0,
    sideOf: () => 'party',
    levelOf: () => s().level,
    hp: () => s().resources.hp,
    maxHp: () => getDerivedStats(s()).maxHp,
    personOf: () => s(),
    resolve: (from: string, scope: { side?: string }) =>
      !scope.side || scope.side === 'self' || scope.side === 'party' || scope.side === 'ally' ? [from] : [],
    rankers: () => ['front'],

    // ---- quantities ----
    quantities: facetQuantities,
    readQ: (_ref: string, id: string) => readQuantity(s(), id) ?? 0,
    // The core keeps overrides and applies them to its own reads; the game's
    // stat block does not see them until K3 routes them through
    // collectModifiers. Until then an override would change what an ability
    // reads and nothing the player fights with, so it is refused.
    overrideQ: notYet('overrideQ', 'K3'),
    clearOverrides: () => {},
    // getDerivedStats is cached behind modFingerprint, which already covers
    // every status's intensity and stacks, so a carrier status moving needs
    // no extra invalidation. K3 adds the override hash here.
    touchQ: () => {},

    // ---- statuses ----
    statusSchema: () => STATUS_SCHEMA,
    // Idempotent registration into the game's own table. A generated
    // definition is never saved; it is rebuilt from the document at attach.
    defineStatus: (def: Partial<StatusDef> & { id: string }) => {
      if (!def?.id) return;
      const known: Partial<StatusDef> | undefined = STATUSES[def.id];
      STATUSES[def.id] = {
        desc: '',
        stacking: { mode: 'highest' },
        duration: null,
        ...known,
        ...def,
      } as StatusDef;
    },
    applyStatus: (_ref: string, app: StatusApplication, source?: string) =>
      applyStatus(s(), s(), app, source),
    removeStatus: (_ref: string, id: string) => removeStatus(s(), id),
    findStatus: (_ref: string, id: string) => findStatus(s(), id) ?? null,
    // These change a held condition only. A condition not held is left absent,
    // the same as InfiniteGacha's host, so one document behaves the same in both.
    setStatusIntensity: (_ref: string, id: string, v: number) => {
      const held = findStatus(s(), id);
      if (held) held.intensity = v;
    },
    setStatusStacks: (_ref: string, id: string, n: number) => {
      const held = findStatus(s(), id);
      if (held) held.stacks = n;
    },
    setStatusData: (_ref: string, id: string, data: Record<string, number>) => {
      const held = findStatus(s(), id);
      if (held) held.data = { ...held.data, ...data };
    },

    // ---- damage ----
    // No stages until K2 collapses the two damage paths onto one staged runner.
    stages: () => [],
    channels: () =>
      DAMAGE_TYPES.map((id) => ({ id, group: PHYSICAL_TYPES.has(id) ? 'physical' : 'magical' })),
    classOf: (type: DamageType) => (PHYSICAL_TYPES.has(type) ? 'physical' : 'magical'),

    // ---- the action gate (K3) ----
    descriptorSchema: () => ({ lethalField: 'damageType', costField: 'cost', fields: {} }),
    vocabulary: (field: string) => (field === 'element' ? [...ELEMENTAL_TYPES] : []),

    // ---- persistence and output ----
    bag: (tier: string, ref: string) => {
      const key = tier + '|' + ref;
      let bag = bags.get(key);
      if (!bag) {
        bag = {};
        bags.set(key, bag);
      }
      return bag;
    },
    log: (line: string) => {
      if (line) appendLog(s(), { msg: line, kind: 'info', t: s().totalTicks });
    },
  };
}

/**
 * Install the adapter. Called once at boot from the UI bridge, after the save
 * has loaded. Throws when the core is incomplete or a member is missing.
 */
export function installFacet(getState: () => GameState): void {
  globalThis.Facet.install(createFacetHost(getState));
}
