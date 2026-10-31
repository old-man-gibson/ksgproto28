import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import '../src/core/facet/load';
import '../src/core/facet/facet.cases.js';
import { createFacetHost, PLAYER_REF } from '../src/core/facet/host';
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
