import type { DamageType, GameState, StatusApplication, StatusDef } from '../types';
import { ELEMENTAL_TYPES, PHYSICAL_TYPES, RES_STAT_BY_TYPE } from '../types';
import { TPS } from '../engine/loop';
import { TICKS_PER_GAME_MINUTE } from '../data/climate.data';
import { chance, rand } from '../engine/rng';
import { procChance, procRate } from '../engine/mercy';
import { STATUSES } from '../data/statuses.data';
import { applyStatus, findStatus, removeStatus } from '../systems/statuses';
import { getDerivedStats } from '../systems/derived';
import { appendLog } from '../systems/log';
import { facetQuantities, readQuantity } from './quantities';
import type { FacetDoc, FacetHost } from './facet';
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
 * `runCatchup`), and `bindFacets` below moves the binding to whichever state
 * is advancing.
 *
 * Step 2 (Solar Charge): `facetMinute` gives the ability time outside a fight,
 * `state.facets` saves its documents (v61), and the sidebar reads
 * `facetReadouts`. The ability is granted only from the debug panel until its
 * discovery moment is decided.
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
  // Scratch space per tier and ref; the core requires the member and reads it
  // nowhere today. Cell values do not live here: they live in the documents,
  // and the documents in `state.facets`, which is how they are saved.
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

// ---------- the game's side ----------

/** The state the core reads and writes: whichever one `bindFacets` was last given. */
let bound: GameState | null = null;

/**
 * Install the adapter over the bound state. Called once at boot from the UI
 * bridge, then `bindFacets(gs, true)`. Throws when the core is incomplete or a
 * member is missing. Tests that do not install it get no ability code at all:
 * every function below is a no-op until it is installed.
 */
export function installFacet(): void {
  globalThis.Facet.install(createFacetHost(() => bound as GameState));
}

/**
 * Point the core at the state being ticked and attach that state's ability.
 * The core writes cell values into the document objects it was handed, so
 * those must be the documents this state will save. The live game and offline
 * catch-up's detached copy are different objects (ui/state.svelte.ts
 * `runCatchup`), so the binding follows whichever state advances. `force`
 * re-attaches the same state after its contents were replaced wholesale
 * (catch-up landing, an import, a reset, a prestige): Game.resyncAnnouncers.
 */
export function bindFacets(state: GameState, force = false): void {
  if (!globalThis.Facet?.ready()) return;
  if (bound === state && !force) return;
  bound = state;
  globalThis.Facet.detach(PLAYER_REF);
  globalThis.Facet.attach(PLAYER_REF, state.facets ?? []);
}

/**
 * The run's ability, once per game minute. Game.advance calls it every tick,
 * travel and fights included, like tickExposure.
 */
export function tickFacets(state: GameState): void {
  if (state.totalTicks % TICKS_PER_GAME_MINUTE !== 0) return;
  bindFacets(state);
  if (bound === state && state.facets?.length) globalThis.Facet.minute(PLAYER_REF);
}

/**
 * Debug panel only: set a cell of the held ability to a share of its cap,
 * through the core's own cell write, so its status follows as in play.
 */
export function debugSetCell(state: GameState, key: string, share: number): void {
  const F = globalThis.Facet;
  if (!F?.ready() || bound !== state) return;
  for (const doc of state.facets) {
    const cell = doc.cells?.find((c) => c.key === key);
    if (!cell) continue;
    const ctx = { ref: PLAYER_REF, facet: doc, bindings: {} };
    F.cellStep(cell, 'set', share * F.evalExpr(cell.cap, ctx), ctx);
  }
}

/** The status ids a document's cells ride on; they start with this. */
const carrierPrefix = (doc: FacetDoc) => 'fc_' + String(doc.id).replace('fc_', '') + '_';

/**
 * Give the player a bank ability, replacing the one held: one ability per run
 * (plans/rolled-abilities.md). The document is a copy of the bank template with
 * empty cells; the old document's statuses go with it. False when the bank has
 * no such entry or the adapter is not installed.
 */
export function grantFacet(state: GameState, id: string): boolean {
  const template = globalThis.Facet?.ready() ? globalThis.Facet.bank?.[id] : undefined;
  if (!template) return false;
  for (const doc of state.facets) {
    const prefix = carrierPrefix(doc);
    state.statuses = state.statuses.filter((s) => !s.id.startsWith(prefix));
  }
  state.facets = [globalThis.Facet.hydrate(JSON.parse(JSON.stringify(template)) as FacetDoc)];
  bindFacets(state, true);
  return true;
}

/**
 * Take every ability status off a state. For a boot where the core failed to
 * install: those statuses are saved, but their definitions are built at attach,
 * and a held status with no definition breaks every panel that names it.
 */
export function dropFacetStatuses(state: GameState): void {
  state.statuses = state.statuses.filter((s) => !s.id.startsWith('fc_'));
}

export interface CellReadout {
  key: string;
  label: string;
  icon: string;
  value: number;
  cap: number;
  show: string;
  desc: string;
  /** The carrier status this cell rides on, so a status list can leave it out. */
  statusId: string;
}

export interface InputReadout {
  label: string;
  value: number;
  show: string;
}

export interface FacetReadout {
  name: string;
  icon: string;
  cells: CellReadout[];
  inputs: InputReadout[];
}

/** What the sidebar shows for the run's ability: each cell's value, and the inputs it names. */
export function facetReadouts(state: GameState): FacetReadout[] {
  const F = globalThis.Facet;
  if (!F?.ready() || bound !== state) return [];
  return state.facets.map((doc) => {
    const ctx = { ref: PLAYER_REF, facet: doc, bindings: {} };
    return {
      name: doc.reading?.name ?? 'Ability',
      icon: doc.reading?.icon ?? '✦',
      cells: (doc.cells ?? [])
        .filter((c) => c.show)
        .map((c) => ({
          key: c.key,
          label: c.label ?? c.key,
          icon: c.icon ?? '',
          value: c.state?.v ?? 0,
          cap: F.evalExpr(c.cap, ctx),
          show: c.show!,
          desc: c.status?.desc ?? '',
          statusId: carrierPrefix(doc) + c.key,
        })),
      inputs: (doc.reading?.inputs ?? []).map((i) => ({
        label: i.label,
        value: F.readQ(PLAYER_REF, i.q).value,
        show: i.show ?? '',
      })),
    };
  });
}
