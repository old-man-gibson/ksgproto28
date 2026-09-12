import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { NPCS, MATERIALS, ITEMS } from '../src/core/registry';
import {
  BUY_MARKUP,
  STRANGER_MARKUP,
  askingPrice,
  buyPrice,
  resaleCeiling,
  visibleLines,
} from '../src/core/systems/shops';
import { gradedUnitPrice, materialSellPrice, sellPrice } from '../src/core/systems/equipment';
import { stockOf } from '../src/core/systems/disciplines';
import { getDerivedStats } from '../src/core/systems/derived';
import type { ShopLine } from '../src/core/types';

/** A game standing at a vendor, with gold and (optionally) the acquaintance made. */
function atVendor(npcId: string, gold = 1000, met = false): Game {
  const g = new Game(createInitialState(7));
  const npc = NPCS[npcId];
  g.state.spot = npc.spotId;
  g.state.gold = gold;
  if (met) g.talkTo(npcId);
  return g;
}

describe('shops — the counter', () => {
  it('buying a plain material moves gold to the vendor and the ware to the pouch', () => {
    const g = atVendor('master_smith', 500, true);
    const shelf = visibleLines(g.state, NPCS.master_smith);
    const i = shelf.findIndex((l) => l.id === 'iron_scrap');
    const price = buyPrice(g.state, 'master_smith', shelf[i]);
    const before = g.state.materials.iron_scrap ?? 0;

    expect(g.buy('master_smith', i, 3)).toBe(3);
    expect(g.state.gold).toBe(500 - 3 * price);
    expect(g.state.materials.iron_scrap).toBe(before + 3);
    expect(g.state.stats['gold:spent']).toBe(3 * price);
    expect(g.state.stats['shop:buys']).toBe(3);
  });

  it('a graded ware lands in stock at the grade on the shelf, not a rolled one', () => {
    const g = atVendor('row_apothecary', 1000, true);
    const shelf = visibleLines(g.state, NPCS.row_apothecary);
    const i = shelf.findIndex((l) => l.id === 'healing_salve');
    expect(MATERIALS.healing_salve.graded).toBe(true);
    g.buy('row_apothecary', i, 4);
    expect(stockOf(g.state, 'healing_salve', 'c')).toBe(4);
    expect(g.state.materials.healing_salve).toBeUndefined();
  });

  it('an item is minted through the one item factory (uid + rolled slots)', () => {
    const g = atVendor('ward_outfitter', 1000, true);
    const shelf = visibleLines(g.state, NPCS.ward_outfitter);
    const i = shelf.findIndex((l) => l.id === 'iron_sword');
    const n = g.state.inventory.length;
    expect(g.buy('ward_outfitter', i)).toBe(1);
    const sword = g.state.inventory[n];
    expect(sword.defId).toBe('iron_sword');
    expect(sword.uid).toBeGreaterThan(0);
    expect(typeof sword.slots).toBe('number');
  });

  it('refuses from elsewhere, refuses when broke, and buys what the purse covers', () => {
    const g = atVendor('head_chef', 0, true);
    expect(g.buy('head_chef', 0, 1)).toBe(0);
    const line = visibleLines(g.state, NPCS.head_chef)[0];
    const price = buyPrice(g.state, 'head_chef', line);
    g.state.gold = price * 2 + 1;
    expect(g.buy('head_chef', 0, 5)).toBe(2); // partial buys are deliberate
    expect(g.state.gold).toBe(1);

    g.state.gold = 1000;
    g.state.spot = 'ascent_foot';
    expect(g.buy('head_chef', 0, 1)).toBe(0);
    expect(g.state.gold).toBe(1000);
  });

  it('a stranger pays more; saying hello is the discount', () => {
    const stranger = atVendor('master_smith', 1000, false);
    const known = atVendor('master_smith', 1000, true);
    const line = visibleLines(stranger.state, NPCS.master_smith)[0];
    const a = buyPrice(stranger.state, 'master_smith', line);
    const b = buyPrice(known.state, 'master_smith', line);
    expect(a).toBeGreaterThan(b);
    expect(askingPrice(line, false)).toBe(Math.ceil(askingPrice(line, true) * STRANGER_MARKUP));
    expect(askingPrice(line, true)).toBe(Math.ceil((MATERIALS[line.id].value ?? 1) * BUY_MARKUP));
  });

  it('gated lines stay off the shelf until the counter they name is stamped', () => {
    const g = atVendor('ward_outfitter', 1000, true);
    const closed = visibleLines(g.state, NPCS.ward_outfitter).map((l) => l.id);
    expect(closed).not.toContain('iron_breastplate');
    g.state.stats['boss:f1_toll_hall'] = 1;
    const open = visibleLines(g.state, NPCS.ward_outfitter).map((l) => l.id);
    expect(open).toContain('iron_breastplate');
    // Indices shift when a line appears — buying goes by the VISIBLE index.
    const i = open.indexOf('iron_breastplate');
    expect(g.buy('ward_outfitter', i)).toBe(1);
    expect(g.state.inventory.at(-1)?.defId).toBe('iron_breastplate');
  });
});

describe('shops — the no-arbitrage law', () => {
  /** Every line every vendor sells, plus a few deliberate bargains. */
  function allLines(): { npcId: string; line: ShopLine }[] {
    const out: { npcId: string; line: ShopLine }[] = [];
    for (const npc of Object.values(NPCS)) {
      for (const line of npc.shop?.lines ?? []) out.push({ npcId: npc.id, line });
    }
    // Authored bargains: a price override never becomes a mint either.
    out.push({ npcId: 'master_smith', line: { kind: 'material', id: 'iron_ingot', price: 1 } });
    out.push({ npcId: 'ward_outfitter', line: { kind: 'item', id: 'steel_greatsword', price: 1 } });
    out.push({ npcId: 'row_apothecary', line: { kind: 'material', id: 'feast_platter', quality: 's', price: 2 } });
    return out;
  }

  it('buying then selling straight back never profits, at any charisma', () => {
    for (const goldGain of [1, 1.5, 2, 3, 10]) {
      const g = atVendor('master_smith', 1e9, true);
      for (const { npcId, line } of allLines()) {
        const paid = buyPrice(g.state, npcId, line, goldGain);
        const back = resaleCeiling(g.state, line, goldGain);
        expect(paid, `${npcId} ${line.id} @goldGain ${goldGain}`).toBeGreaterThan(back);
      }
    }
  });

  it('the resale ceiling is what selling actually pays — best rune roll included', () => {
    const g = atVendor('ward_outfitter', 1e6, true);
    const goldGain = getDerivedStats(g.state).goldGain;
    const shelf = visibleLines(g.state, NPCS.ward_outfitter);
    const i = shelf.findIndex((l) => l.id === 'iron_sword');
    const paid = buyPrice(g.state, 'ward_outfitter', shelf[i], goldGain);
    g.buy('ward_outfitter', i);
    const sword = g.state.inventory.at(-1)!;
    expect(sellPrice(g.state, sword, goldGain)).toBeLessThan(paid);

    const scrap: ShopLine = { kind: 'material', id: 'iron_scrap' };
    expect(resaleCeiling(g.state, scrap, goldGain)).toBe(materialSellPrice(g.state, 'iron_scrap', goldGain));
    const salve: ShopLine = { kind: 'material', id: 'healing_salve', quality: 'b' };
    expect(resaleCeiling(g.state, salve, goldGain)).toBe(gradedUnitPrice(g.state, 'healing_salve', 'b', goldGain));
  });

  it('a live round trip at high charisma loses gold', () => {
    const g = atVendor('row_alchemist', 10_000, true);
    g.state.attrs.cha.level = 200; // goldGain ≈ 3.4
    const shelf = visibleLines(g.state, NPCS.row_alchemist);
    const i = shelf.findIndex((l) => l.id === 'grain_spirit');
    const start = g.state.gold;
    g.buy('row_alchemist', i, 10);
    const line = shelf[i];
    const quality = line.kind === 'material' ? (line.quality ?? 'c') : 'c';
    const held = MATERIALS.grain_spirit.graded ? stockOf(g.state, 'grain_spirit', quality) : g.state.materials.grain_spirit;
    expect(held).toBe(10);
    g.sellStackable('grain_spirit', quality, 10);
    expect(g.state.gold).toBeLessThan(start);
  });
});

describe('shops — the counters are real', () => {
  it('every vendor stands somewhere and sells at least one thing that exists', () => {
    const vendors = Object.values(NPCS).filter((n) => n.shop);
    expect(vendors.length).toBeGreaterThanOrEqual(6);
    for (const npc of vendors) {
      for (const line of npc.shop!.lines) {
        expect(line.kind === 'item' ? ITEMS[line.id] : MATERIALS[line.id], `${npc.id} ${line.id}`).toBeDefined();
      }
    }
  });
});
