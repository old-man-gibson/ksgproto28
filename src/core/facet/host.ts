import type { DamageType, GameState, MonsterInstance, ResourceId, StatusApplication, StatusDef } from '../types';
import { ELEMENTAL_TYPES, PHYSICAL_TYPES, RES_STAT_BY_TYPE } from '../types';
import { TPS } from '../engine/loop';
import { TICKS_PER_GAME_MINUTE } from '../data/climate.data';
import { chance, rand } from '../engine/rng';
import { procChance, procRate } from '../engine/mercy';
import { STATUSES } from '../data/statuses.data';
import { applyStatus, findStatus, removeStatus } from '../systems/statuses';
import { getDerivedStats } from '../systems/derived';
import { appendLog } from '../systems/log';
import { abilityStrike, isSpotBoss } from '../systems/combat';
import { monsterStats } from '../systems/monsterStats';
import { spendResource } from '../systems/resources';
import { FACET_POOLS, facetQuantities, readQuantity } from './quantities';
import type { EventBus } from '../engine/events';
import type { FacetDoc, FacetHost } from './facet';
import { bindFacets, boundState, facetSignal, FOE, PLAYER_REF } from './signal';
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
 *
 * Little Moons: enemies are refs (`foe:<slot>`, a slot of `combat.enemies`),
 * so a document can aim at them. `resolve` answers `side: 'enemy'` and
 * `'arena'`, `applyDamage` hits an enemy through combat.ts `abilityStrike`,
 * the status members reach the enemy a ref names, and `spendPool` pays a
 * pool cost. tickCombat calls `Facet.tick` once per combat tick
 * (signal.ts `facetCombatTick`). Still player-only: anything that reads an
 * enemy's quantities (K4), and damage aimed at the player.
 *
 * Bramble: hitTaken names the enemy whose blow it was (`attacker`, from
 * health.ts damagePlayer's `source.by`), and a document aims at it with the
 * core's `{ frame: 'attacker' }` scope. combat.ts sweeps an attacker the
 * answer killed before the enemy phase goes on (`answeredToDeath`).
 */

export { bindFacets, facetSignal, PLAYER_REF } from './signal';

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
    // Basilisk Hide's Stone: resisted by Earth and a CON contest, escalating to
    // the game's own statue condition (statuses.data.ts `petrified`).
    element: { kind: 'meta' },
    contest: { kind: 'meta' },
    escalatesTo: { kind: 'meta' },
  },
};

// An enemy's ref is FOE plus its slot in `combat.enemies` (signal.ts, where
// health.ts reads it for hitTaken's attacker). A ref lives for one call: slots
// move when the front enemy dies, so nothing keeps one.

function livingFoes(state: GameState): string[] {
  return (state.combat?.enemies ?? []).flatMap((e, i) => (e && e.hp > 0 ? [FOE + i] : []));
}

function foeOf(state: GameState, ref: string): MonsterInstance | null {
  if (!ref.startsWith(FOE)) return null;
  const e = state.combat?.enemies[Number(ref.slice(FOE.length))];
  return e && e.hp > 0 ? e : null;
}

/** Who a ref names: the player, a living enemy, or nobody. */
function bearerOf(state: GameState, ref: string): GameState | MonsterInstance | null {
  return ref === PLAYER_REF ? state : foeOf(state, ref);
}

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
  const heldBy = (ref: string, id: string) => {
    const bearer = bearerOf(s(), ref);
    return (bearer && findStatus(bearer, id)) ?? null;
  };

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
    isAlive: (ref: string) => (ref === PLAYER_REF ? s().resources.hp > 0 : !!foeOf(s(), ref)),
    sideOf: (ref: string) => (ref.startsWith(FOE) ? 'enemy' : 'party'),
    levelOf: (ref: string) => (ref === PLAYER_REF ? s().level : (foeOf(s(), ref)?.level ?? 0)),
    hp: (ref: string) => (ref === PLAYER_REF ? s().resources.hp : (foeOf(s(), ref)?.hp ?? 0)),
    maxHp: (ref: string) => {
      if (ref === PLAYER_REF) return getDerivedStats(s()).maxHp;
      const foe = foeOf(s(), ref);
      return foe ? monsterStats(foe).maxHp : 0;
    },
    personOf: () => s(),
    // The player is the only bearer on the party side. Enemies come in slot
    // order, so the front enemy (slot 0) is first and `n: 1` picks it: 'front'
    // is the only ranker.
    resolve: (from: string, scope: { side?: string; n?: number | null }) => {
      let pool: string[];
      if (!scope.side || scope.side === 'self' || scope.side === 'party' || scope.side === 'ally') pool = [from];
      else if (scope.side === 'enemy') pool = livingFoes(s());
      else if (scope.side === 'arena') pool = [PLAYER_REF, ...livingFoes(s())];
      else pool = [];
      return scope.n === null || scope.n === undefined ? pool : pool.slice(0, scope.n);
    },
    rankers: () => ['front'],

    // ---- quantities ----
    quantities: facetQuantities,
    // The player's numbers only. An enemy's are not quantities until K4, so a
    // document reading one gets 0.
    readQ: (ref: string, id: string) => (ref === PLAYER_REF ? (readQuantity(s(), id) ?? 0) : 0),
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
    applyStatus: (ref: string, app: StatusApplication, source?: string) => {
      const bearer = bearerOf(s(), ref);
      return bearer ? applyStatus(s(), bearer, app, source) : null;
    },
    removeStatus: (ref: string, id: string) => {
      const bearer = bearerOf(s(), ref);
      if (bearer) removeStatus(bearer, id);
    },
    findStatus: (ref: string, id: string) => heldBy(ref, id),
    // These change a held condition only. A condition not held is left absent,
    // the same as InfiniteGacha's host, so one document behaves the same in both.
    setStatusIntensity: (ref: string, id: string, v: number) => {
      const held = heldBy(ref, id);
      if (held) held.intensity = v;
    },
    setStatusStacks: (ref: string, id: string, n: number) => {
      const held = heldBy(ref, id);
      if (held) held.stacks = n;
    },
    setStatusData: (ref: string, id: string, data: Record<string, number>) => {
      const held = heldBy(ref, id);
      if (held) held.data = { ...held.data, ...data };
    },

    // ---- damage and costs ----
    // An enemy takes a document's damage through combat's own path
    // (abilityStrike: resistance, conditions, the feed). The player is not a
    // target yet: no bank ability hurts its bearer, and damage to the player
    // needs the knockout handling a blow gets (health.ts damagePlayer).
    applyDamage: (ref: string, amount: number, type: string, source?: string) => {
      const state = s();
      if (!foeOf(state, ref)) return 0;
      const doc = state.facets.find((d) => d.id === source);
      const known = type in RES_STAT_BY_TYPE ? (type as DamageType) : 'arcane';
      return abilityStrike(state, Number(ref.slice(FOE.length)), amount, known, {
        name: doc?.reading?.name ?? 'Ability',
        icon: doc?.reading?.icon ?? '✦',
        hit: doc?.reading?.hit,
      });
    },
    // A pool cost (the `spend` verb): stamina, mana, spirit or focus, never HP.
    spendPool: (ref: string, pool: string, amount: number) =>
      ref === PLAYER_REF && FACET_POOLS.includes(pool as ResourceId) ? spendResource(s(), pool as ResourceId, amount) : 0,

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

/**
 * Install the adapter over the bound state (signal.ts `bindFacets`). Called
 * once at boot from the UI bridge, then `bindFacets(gs, true)`. Throws when
 * the core is incomplete or a member is missing. Tests that do not install it
 * get no ability code at all: every function below is a no-op until then.
 */
export function installFacet(): void {
  globalThis.Facet.install(createFacetHost(() => boundState() as GameState));
}

/**
 * The run's ability, once per game minute. Game.advance calls it every tick,
 * travel and fights included, like tickExposure.
 */
export function tickFacets(state: GameState): void {
  if (state.totalTicks % TICKS_PER_GAME_MINUTE !== 0) return;
  bindFacets(state);
  if (boundState() === state && state.facets?.length) globalThis.Facet.minute(PLAYER_REF);
}

/**
 * Forward the fight events the bus already carries (signal.ts lists them all).
 * Registered per Game, like every other listener, so offline catch-up's worker
 * game signals its own detached state.
 */
export function registerFacetListeners(state: GameState, bus: EventBus): void {
  bus.on('encounter', () => {
    const foes = (state.combat?.enemies ?? []).filter((e) => e !== null);
    facetSignal(state, 'fightStart', {
      enemies: foes.length,
      maxLevel: foes.reduce((n, e) => Math.max(n, e.level), 0),
    });
  });
  bus.on('kill', (ev) =>
    facetSignal(state, 'kill', { level: ev.monster.level, boss: isSpotBoss(state, ev.monster.defId) ? 1 : 0 }),
  );
  bus.on('fight:won', () => facetSignal(state, 'fightWon'));
  bus.on('fight:closed', (ev) => facetSignal(state, 'fightEnd', { won: ev.standing.length === 0 ? 1 : 0 }));
}

/**
 * Debug panel only: set a cell of the held ability to a share of its cap,
 * through the core's own cell write, so its status follows as in play.
 */
export function debugSetCell(state: GameState, key: string, share: number): void {
  const F = globalThis.Facet;
  if (!F?.ready() || boundState() !== state) return;
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
  if (!F?.ready() || boundState() !== state) return [];
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
