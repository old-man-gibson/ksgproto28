import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { AFFIXES } from '../src/core/registry';
import { sellPrice } from '../src/core/systems/equipment';
import type { Affix, ItemInstance } from '../src/core/types';

const SWIFT = AFFIXES.find((a) => a.name === 'Swift') as Affix;

function withItems(items: ItemInstance[]): Game {
  const g = new Game(createInitialState(1));
  g.state.inventory = items;
  g.state.gold = 0;
  g.state.log.length = 0;
  return g;
}

let uid = 0;
function item(defId: string, opts: Partial<ItemInstance> = {}): ItemInstance {
  return { uid: ++uid, defId, slots: 0, runes: [], ...opts };
}

/** Sale lines only — ignore anything else the bus emitted. */
function saleLines(g: Game): string[] {
  return g.state.log.filter((l) => l.msg.startsWith('Sold ')).map((l) => l.msg);
}

describe('bulk selling', () => {
  it('logs one line for the whole lot, naming a uniform stack', () => {
    const items = [item('leather_vest'), item('leather_vest'), item('leather_vest')];
    const g = withItems(items);
    const each = sellPrice(g.state, items[0]);

    g.sellMany(items.map((i) => i.uid));

    expect(saleLines(g)).toEqual([`Sold Leather Vest ×3 for ${each * 3} gold.`]);
    expect(g.state.gold).toBe(each * 3);
    expect(g.state.inventory).toHaveLength(0);
  });

  it('falls back to a count when the lot is mixed', () => {
    const items = [item('leather_vest'), item('iron_sword'), item('leather_boots')];
    const g = withItems(items);
    const total = items.reduce((sum, i) => sum + sellPrice(g.state, i), 0);

    g.sellMany(items.map((i) => i.uid));

    expect(saleLines(g)).toEqual([`Sold 3 items for ${total} gold.`]);
    expect(g.state.gold).toBe(total);
  });

  it('treats a differently-affixed copy as a different item', () => {
    const items = [item('leather_vest'), item('leather_vest', { affix: SWIFT })];
    const g = withItems(items);

    g.sellMany(items.map((i) => i.uid));

    expect(saleLines(g)[0]).toMatch(/^Sold 2 items for \d+ gold\.$/);
  });

  it('keeps the single-item wording for a lot of one', () => {
    const one = item('leather_vest');
    const g = withItems([one]);
    g.sellMany([one.uid]);
    expect(saleLines(g)).toEqual([`Sold Leather Vest for ${sellPrice(g.state, one)} gold.`]);
  });

  it('returns socketed runes and skips uids that are no longer held', () => {
    const socketed = item('leather_vest', { slots: 2, runes: ['minor_rune_might'] });
    const g = withItems([socketed]);

    g.sellMany([socketed.uid, 9999]);

    expect(g.state.runes['minor_rune_might']).toBe(1);
    expect(saleLines(g)).toHaveLength(1);
  });

  it('logs nothing when no uid matches', () => {
    const g = withItems([item('leather_vest')]);
    g.sellMany([4242]);
    expect(saleLines(g)).toEqual([]);
    expect(g.state.gold).toBe(0);
  });
});
