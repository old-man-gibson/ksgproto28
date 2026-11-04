import { afterEach, describe, expect, it } from 'vitest';
import { bindFacets, facetReadouts, grantFacet, installFacet } from '../src/core/facet/host';
import { createInitialState } from '../src/core/state';
import type { GameState } from '../src/core/types';

/**
 * The ability readout behind the sidebar and the Ability tab (facet/host.ts
 * facetReadouts). The sidebar shows only cells that act on you: a carrier
 * with modifiers, while its value is not zero. The tab shows the rest: the
 * description, every shown cell, the conditions the ability applies and its
 * evolution.
 */

afterEach(() => globalThis.Facet.uninstall());

function holding(ability: string): GameState {
  const state = createInitialState(7);
  installFacet();
  bindFacets(state, true);
  expect(grantFacet(state, ability)).toBe(true);
  return state;
}

const readout = (state: GameState) => facetReadouts(state)[0];
const acting = (state: GameState) => readout(state).cells.filter((c) => c.acts).map((c) => c.key);

describe('ability readout', () => {
  it('every bank entry says what it does', () => {
    installFacet();
    for (const [key, doc] of Object.entries(globalThis.Facet.bank!)) {
      expect(doc.reading?.desc, key).toBeTruthy();
    }
  });

  it('marks as acting only the cells whose carrier modifies a number', () => {
    expect(acting(holding('solar_charge'))).toEqual(['power']);
    expect(acting(holding('zenkai'))).toEqual(['bonus']);
    expect(acting(holding('little_moons'))).toEqual([]);
    expect(acting(holding('bramble'))).toEqual(['thorns']);
    expect(acting(holding('basilisk_hide'))).toEqual([]);
    expect(acting(holding('basilisk_stoneskin'))).toEqual(['standing']);
  });

  it('keeps the counters and inputs for the tab', () => {
    const solar = readout(holding('solar_charge'));
    expect(solar.cells.map((c) => c.key)).toEqual(['charge', 'power']);
    expect(solar.inputs.map((i) => i.label)).toEqual(['Sunlight here']);
    const bramble = readout(holding('bramble'));
    expect(bramble.cells.find((c) => c.key === 'fights')?.acts).toBe(false);
  });

  it('lists the conditions an ability applies and what each becomes', () => {
    const hide = readout(holding('basilisk_hide'));
    expect(hide.conditions).toHaveLength(1);
    expect(hide.conditions[0].name).toBe('Stone');
    expect(hide.conditions[0].becomes?.name).toBe('Petrified');
    expect(hide.conditions[0].becomes?.desc).toMatch(/Lasts 3 s/);
    expect(readout(holding('basilisk_stoneskin')).conditions[0].becomes?.desc).toMatch(/Stays until the fight ends/);
    expect(readout(holding('little_moons')).conditions).toEqual([]);
  });

  it('reads the evolution from the clauses: trigger cell, value and branches', () => {
    const hide = readout(holding('basilisk_hide'));
    expect(hide.evolves?.label).toBe('Statues');
    expect(hide.evolves?.at).toBe(100);
    expect(hide.evolves?.into.map((b) => b.name)).toEqual(["Gorgon's Gaze", 'Rubble', 'Stoneskin']);
    expect(readout(holding('basilisk_gorgon')).evolves).toBeNull();
    expect(readout(holding('bramble')).evolves).toBeNull();
  });

  it('a stance cell reads as what Power does in it, not as a bare number', () => {
    const state = holding('weakest_weapon_master');
    state.facets[0].cells!.find((c) => c.key === 'flowing')!.state!.v = 29;
    const cell = readout(state).cells.find((c) => c.key === 'flowing')!;
    expect(cell.line).toBe('parries every blow up to 15');
    expect(cell.base).toBe('Power');
    expect(readout(state).cells.find((c) => c.key === 'ceiling')?.line).toBeNull();
  });

  it('gives a document saved without a description its bank entry\'s', () => {
    const state = holding('bramble');
    delete state.facets[0].reading!.desc;
    expect(readout(state).desc).toBe(globalThis.Facet.bank!.bramble.reading!.desc);
  });
});
