import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import '../src/core/facet/load';
import '../src/core/facet/facet.cases.js';
import {
  bindFacets,
  createFacetHost,
  debugSetCell,
  grantFacet,
  installFacet,
  PLAYER_REF,
  tickFacets,
} from '../src/core/facet/host';
import { Game } from '../src/core/game';
import { MIGRATIONS } from '../src/core/save/migrations';
import { deserialize, serialize } from '../src/core/save/save';
import { sunlight } from '../src/core/systems/exposure';
import { AREAS, REGIONS, SPOTS } from '../src/core/registry';
import { facetQuantities, readQuantity } from '../src/core/facet/quantities';
import type { FacetDoc } from '../src/core/facet/facet';
import { createInitialState } from '../src/core/state';
import { getDerivedStats } from '../src/core/systems/derived';
import { effectiveAttr } from '../src/core/systems/attributes';
import { findStatus } from '../src/core/systems/statuses';
import { STATUSES } from '../src/core/registry';

/**
 * The FACET core in this game (docs/FACET.md). Three layers:
 *
 *  - the copy in src/core/facet/ is byte-for-byte the master's, per its own
 *    MANIFEST.json, so an edit made here instead of in the Facet repo fails;
 *  - the core's own corpus (facet.cases.js) passes when loaded the way the
 *    game loads it, through bare side-effect imports under ESM;
 *  - this game's adapter installs, and a status a document emits reaches the
 *    player's derived stats.
 */

const DIR = path.resolve(__dirname, '../src/core/facet');
const lf = (text: string) => text.replace(/\r\n/g, '\n');
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

afterEach(() => globalThis.Facet.uninstall());

describe('the vendored copy', () => {
  const manifest = JSON.parse(readFileSync(path.join(DIR, 'MANIFEST.json'), 'utf8')) as {
    order: string[];
    sha256: Record<string, string>;
  };

  it('matches its manifest file for file (edit the master, then sync)', () => {
    for (const file of manifest.order) {
      expect(sha(lf(readFileSync(path.join(DIR, file), 'utf8'))), file).toBe(manifest.sha256[file]);
    }
  });

  it('holds no core file the manifest does not list', () => {
    const present = readdirSync(DIR).filter((f) => /^facet\.[\w-]+\.js$/.test(f));
    expect(present.sort()).toEqual([...manifest.order].sort());
  });

  it('loads every core module through load.ts', () => {
    for (const m of globalThis.Facet.MODULES) expect(globalThis.Facet._mods[m], m).toBe(true);
  });
});

describe('the core corpus', () => {
  for (const [name, run] of Object.entries(globalThis.FacetCases)) {
    it(name, () => {
      globalThis.Facet.uninstall();
      run((cond, msg) => {
        if (!cond) throw new Error(msg ?? 'assertion failed');
      }, globalThis.FacetFakeHost());
    });
  }
});

describe('this game as host', () => {
  it('installs with every member the core requires', () => {
    const state = createInitialState(1);
    expect(() => globalThis.Facet.install(createFacetHost(() => state))).not.toThrow();
    expect(globalThis.Facet.ready()).toBe(true);
  });

  it('registers each quantity id once, and every one reads a finite number', () => {
    const state = createInitialState(1);
    const ids = facetQuantities().map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(Number.isFinite(readQuantity(state, id)), id).toBe(true);
  });

  it('reads through the shared ids InfiniteGacha uses', () => {
    const state = createInitialState(1);
    globalThis.Facet.install(createFacetHost(() => state));
    const read = (id: string) => globalThis.Facet.readQ(PLAYER_REF, id);
    expect(read('fighter.hp')).toMatchObject({ ok: true, value: state.resources.hp });
    expect(read('fighter.maxHpAbs').value).toBe(getDerivedStats(state).maxHp);
    expect(read('stat.eff.con').value).toBe(effectiveAttr(state, 'con'));
    expect(read('res.heat').value).toBe(getDerivedStats(state).resHeat);
    expect(read('pool.stamina.cur').value).toBe(state.resources.stamina);
    expect(read('ksg.loot').value).toBe(getDerivedStats(state).loot);
  });

  it('keeps hp out of reach: never written, never severed', () => {
    const hp = facetQuantities().find((q) => q.id === 'fighter.hp')!;
    expect(hp).toMatchObject({ writable: false, nullifiable: false, mortalRole: 'vitality' });
  });

  it('refuses a quantity override until K3 routes it into the stat block', () => {
    const state = createInitialState(1);
    const host = createFacetHost(() => state);
    expect(() => (host.overrideQ as () => void)()).toThrow(/K3/);
  });

  it("lands a document's status on the player and in the derived stats", () => {
    const state = createInitialState(1);
    globalThis.Facet.install(createFacetHost(() => state));
    const doc: FacetDoc = globalThis.Facet.hydrate({
      v: 1,
      cells: [],
      clauses: [
        {
          id: 'c1',
          on: 'tick',
          do: [{ emit: 'status', def: { id: 'fc_test_plating', mods: [{ stat: 'armor', op: 'add', value: 5 }] }, intensity: 2 }],
        },
      ],
      reading: { name: 'Test Plating' },
    });
    const armorBefore = getDerivedStats(state).armor;
    globalThis.Facet.attach(PLAYER_REF, [doc]);
    expect(STATUSES.fc_test_plating).toMatchObject({ name: 'Test Plating', duration: null });

    globalThis.Facet.tick(PLAYER_REF);
    expect(findStatus(state, 'fc_test_plating')?.intensity).toBe(2);
    expect(getDerivedStats(state).armor).toBeCloseTo(armorBefore + 10);
    delete STATUSES.fc_test_plating;
  });
});

/**
 * Solar Charge, the first bank ability (Facet repo core/facet.bank.js): banks
 * sunlight each game minute, drains a little every minute, and sets a damage
 * and spell power multiplier from the charge, +20% from half charge up and
 * −30% at empty. Numbers are the bank's placeholders.
 */
describe('Solar Charge', () => {
  const HOUR = 600; // ticks: 10 per game minute
  const probe = createInitialState(7);
  const spotWhere = (test: (id: string) => boolean) => Object.keys(SPOTS).find(test)!;
  const OPEN = spotWhere((id) => {
    probe.spot = id;
    probe.totalTicks = 12 * HOUR;
    return sunlight(probe) > 0;
  });
  const ROOFED = spotWhere((id) => !!REGIONS[AREAS[SPOTS[id].areaId]?.regionId]?.sheltered);

  /** A fresh state at `spot` and `hour` on day one, with Solar Charge granted. */
  function solar(spot: string, hour = 12) {
    const state = createInitialState(7);
    state.spot = spot;
    state.totalTicks = hour * HOUR;
    installFacet();
    bindFacets(state, true);
    expect(grantFacet(state, 'solar_charge')).toBe(true);
    return state;
  }
  const cell = (state: ReturnType<typeof createInitialState>, key: string) =>
    state.facets[0].cells!.find((c) => c.key === key)!.state!.v;
  const minutes = (state: ReturnType<typeof createInitialState>, n: number) => {
    for (let i = 0; i < n; i++) {
      state.totalTicks += 10;
      tickFacets(state);
    }
  };
  /** The same character with no ability, for comparing derived stats. */
  const plainTwin = (spot: string) => {
    const twin = createInitialState(7);
    twin.spot = spot;
    return getDerivedStats(twin);
  };

  it('reads sunlight: some under open sky at noon, none at midnight, none under a roof', () => {
    expect(OPEN).toBeTruthy();
    expect(ROOFED).toBeTruthy();
    const s = createInitialState(7);
    s.spot = OPEN;
    s.totalTicks = 12 * HOUR;
    expect(sunlight(s)).toBeGreaterThan(0);
    expect(sunlight(s)).toBeLessThanOrEqual(1);
    s.totalTicks = 0;
    expect(sunlight(s)).toBe(0);
    s.spot = ROOFED;
    s.totalTicks = 12 * HOUR;
    expect(sunlight(s)).toBe(0);
  });

  it('opens empty, at −30% damage and spell power', () => {
    const state = solar(ROOFED);
    expect(cell(state, 'charge')).toBe(0);
    expect(cell(state, 'power')).toBeCloseTo(-0.3);
    expect(getDerivedStats(state).damage).toBeCloseTo(plainTwin(ROOFED).damage * 0.7);
    expect(getDerivedStats(state).spellPower).toBeCloseTo(plainTwin(ROOFED).spellPower * 0.7);
  });

  it('banks under open sky by day and drains under a roof', () => {
    const state = solar(OPEN);
    minutes(state, 60);
    const banked = cell(state, 'charge');
    expect(banked).toBeGreaterThan(0);
    state.spot = ROOFED;
    minutes(state, 60);
    expect(cell(state, 'charge')).toBeLessThan(banked);
    expect(cell(state, 'charge')).toBeGreaterThan(0);
  });

  it('sets power from the charge: +20% from half up, a straight line down to −30% at empty', () => {
    const state = solar(ROOFED);
    debugSetCell(state, 'charge', 0.5);
    minutes(state, 1);
    expect(cell(state, 'power')).toBeCloseTo(0.2);
    expect(getDerivedStats(state).damage).toBeCloseTo(plainTwin(ROOFED).damage * 1.2);
    debugSetCell(state, 'charge', 1);
    minutes(state, 1);
    expect(cell(state, 'power')).toBeCloseTo(0.2);
    debugSetCell(state, 'charge', 0.25);
    minutes(state, 1);
    expect(cell(state, 'power')).toBeCloseTo(-0.05, 2);
  });

  it('runs from the game loop, travel and all, once per game minute', () => {
    const state = solar(OPEN);
    const game = new Game(state);
    game.step(60); // six game minutes
    expect(cell(state, 'charge')).toBeGreaterThan(0);
  });

  it('survives save and load, statuses rebuilt from the document', () => {
    const state = solar(OPEN);
    minutes(state, 90);
    const damage = getDerivedStats(state).damage;
    const loaded = deserialize(serialize(state));
    installFacet();
    bindFacets(loaded, true);
    expect(cell(loaded, 'charge')).toBeCloseTo(cell(state, 'charge'));
    expect(getDerivedStats(loaded).damage).toBeCloseTo(damage);
  });

  it('keeps what offline catch-up banked on its detached copy', () => {
    const live = solar(OPEN);
    const liveGame = new Game(live);
    const plain = JSON.parse(JSON.stringify(live)) as typeof live;
    const worker = new Game(plain);
    worker.step(HOUR); // an hour in the sun, ticked on the copy
    const banked = cell(plain, 'charge');
    expect(banked).toBeGreaterThan(0);
    expect(cell(live, 'charge')).toBe(0);
    Object.assign(live, plain);
    liveGame.resyncAnnouncers();
    expect(cell(live, 'charge')).toBe(banked);
    minutes(live, 1);
    expect(cell(live, 'charge')).not.toBe(banked);
  });

  it('gives a v60 save an empty ability list', () => {
    const raw: Record<string, unknown> = { version: 60 };
    MIGRATIONS[60](raw);
    expect(raw).toMatchObject({ version: 61, facets: [] });
  });
});
