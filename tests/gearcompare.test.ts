import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { AFFIXES, ITEMS } from '../src/core/registry';
import {
  STAT_NAMES,
  type Affix,
  type FestivalRun,
  type GameState,
  type ItemInstance,
  type Modifier,
  type Placement,
  type SlotId,
  type StatusDef,
} from '../src/core/types';
import { classifyPlacement, itemDefOf, partsOf } from '../src/core/systems/assembly';
import { harmOf } from '../src/core/systems/conditionHarm';
import { groupItems, stackKey } from '../src/core/systems/inventory';
import { unlockKey } from '../src/core/systems/unlocks';
import {
  beats,
  compareToWorn,
  findSpares,
  isConditional,
  isSpareStack,
  lowerIsBetter,
} from '../src/ui/lib/gearCompare';

/**
 * Spare marks (docs/plans/ui-proposals.md, C2). The rule is strict dominance
 * between items of one base and one size; these cases are the ones the plan
 * names, plus the exclusions and the hand budget.
 */

const affix = (name: string): Affix => AFFIXES.find((a) => a.name === name) as Affix;
const SHARP = affix('Sharp'); // damage +10%
const STURDY = affix('Sturdy'); // max HP +12
const SWIFT = affix('Swift'); // attack speed +8%

let nextUid = 1000;
function item(defId: string, opts: Partial<ItemInstance> = {}): ItemInstance {
  return { uid: ++nextUid, defId, slots: 0, runes: [], ...opts };
}
const vest = (opts: Partial<ItemInstance> = {}) => item('leather_vest', opts);

function stateWith(
  pack: ItemInstance[],
  worn: Partial<Record<SlotId, ItemInstance>> = {},
  runecarving = true,
): GameState {
  const state = createInitialState(1);
  state.inventory = pack;
  state.equipment = worn;
  state.stats[unlockKey('runecarving')] = runecarving ? 1 : 0;
  return state;
}

const spareUids = (state: GameState, arms?: number) => [...findSpares(state, arms).keys()].sort((a, b) => a - b);
const uids = (...items: ItemInstance[]) => items.map((i) => i.uid).sort((a, b) => a - b);

describe('beats: the rule', () => {
  it('plain, Sturdy and Sharp Leather Vest: an affix beats plain, two different affixes beat neither way', () => {
    const plain = vest({ slots: 2 });
    const sturdy = vest({ slots: 2, affix: STURDY });
    const sharp = vest({ slots: 2, affix: SHARP });
    expect(beats(sturdy, plain)).toBe(true);
    expect(beats(sharp, plain)).toBe(true);
    expect(beats(plain, sturdy)).toBe(false);
    expect(beats(sturdy, sharp)).toBe(false);
    expect(beats(sharp, sturdy)).toBe(false);
  });

  it('equal items beat neither way, and items that differ only in socketed runes are equal', () => {
    const a = vest({ slots: 2 });
    const b = vest({ slots: 2 });
    const socketed = vest({ slots: 2, runes: ['minor_rune_might'] });
    expect(beats(a, b)).toBe(false);
    expect(beats(b, a)).toBe(false);
    expect(beats(socketed, a)).toBe(false);
    expect(beats(a, socketed)).toBe(false);
  });

  it('more rune slots beat fewer when nothing else is worse', () => {
    const two = vest({ slots: 2, affix: STURDY });
    const four = vest({ slots: 4, affix: STURDY });
    const sharpThree = vest({ slots: 3, affix: SHARP });
    expect(beats(four, two)).toBe(true);
    expect(beats(two, four)).toBe(false);
    // Sharp has a stat Sturdy lacks and Sturdy has one Sharp lacks: slots do not settle it.
    expect(beats(four, sharpThree)).toBe(false);
    expect(beats(sharpThree, four)).toBe(false);
  });

  it('different bases never compare, even in one slot class', () => {
    expect(beats(item('leather_vest', { affix: STURDY }), item('cloth_tunic'))).toBe(false);
  });

  it('medium plain against large Sharp is incomparable, and an absent size reads as medium', () => {
    const plain = vest();
    const largeSharp = vest({ affix: SHARP, size: 'large' });
    expect(beats(largeSharp, plain)).toBe(false);
    expect(beats(plain, largeSharp)).toBe(false);
    expect(beats(vest({ affix: SHARP, size: 'medium' }), plain)).toBe(true);
    expect(beats(vest({ affix: SHARP, size: 'large' }), vest({ size: 'large' }))).toBe(true);
    expect(spareUids(stateWith([plain, largeSharp]))).toEqual([]);
  });

  it('flips the comparison for stats where a smaller value is better', () => {
    const hardy: Affix = { name: 'Hardy', mods: [{ stat: 'damageTaken', op: 'mult', value: -0.1 }] };
    const brittle: Affix = { name: 'Brittle', mods: [{ stat: 'damageTaken', op: 'mult', value: 0.1 }] };
    const plain = vest();
    expect(beats(vest({ affix: hardy }), plain)).toBe(true);
    expect(beats(plain, vest({ affix: hardy }))).toBe(false);
    expect(beats(plain, vest({ affix: brittle }))).toBe(true);
    expect(beats(vest({ affix: brittle }), plain)).toBe(false);
    // A scoped stat reads by the stat before the colon.
    expect(lowerIsBetter('damageTaken:heat')).toBe(true);
    expect(lowerIsBetter('damage:heat')).toBe(false);
  });

  it('lowerIsBetter agrees with the condition rules for every stat', () => {
    for (const stat of Object.keys(STAT_NAMES)) {
      const def = { mods: [{ stat, op: 'add', value: 1 }] } as unknown as StatusDef;
      expect(lowerIsBetter(stat), stat).toBe(harmOf(def) !== null);
    }
  });
});

describe('items that are never compared', () => {
  const CONDITIONAL: Partial<Modifier>[] = [
    { requiresTag: 'dagger' },
    { requiresStyle: 'bolognese' },
    { requiresMonsterTag: 'slime' },
    { perLevel: 1 },
    { levelCurve: 'resistTiered' },
    { fromStat: 'armor' },
    { undampened: true },
  ];

  it.each(CONDITIONAL.map((c) => [Object.keys(c)[0], c] as const))(
    'a modifier with %s makes the item incomparable on either side',
    (_name, extra) => {
      const gated: Affix = {
        name: 'Gated',
        mods: [{ stat: 'maxHp', op: 'add', value: 12, ...extra } as Modifier],
      };
      expect(isConditional(gated.mods[0])).toBe(true);
      const plain = vest();
      const conditional = vest({ affix: gated });
      expect(beats(conditional, plain)).toBe(false);
      expect(beats(plain, conditional)).toBe(false);
      expect(spareUids(stateWith([plain, conditional]))).toEqual([]);
    },
  );

  it('a conditional modifier on the base item itself counts too', () => {
    // No shipped item has one; a registered stand-in proves the base's own mods are read.
    const GATED = 'test_gated_vest';
    ITEMS[GATED] = {
      ...ITEMS.leather_vest,
      id: GATED,
      mods: [{ stat: 'armor', op: 'add', value: 5, requiresTag: 'dagger' }],
    };
    try {
      const plain = item(GATED);
      const sturdy = item(GATED, { affix: STURDY });
      expect(beats(sturdy, plain)).toBe(false);
      expect(spareUids(stateWith([plain, sturdy]))).toEqual([]);
    } finally {
      delete ITEMS[GATED];
    }
  });

  it('a forged item is never compared', () => {
    const sword: Placement = {
      head: { kind: 'long', mat: 'iron_ingot' },
      haft: { kind: 'h3', mat: 'hardwood' },
    };
    const forge = (extra: Partial<ItemInstance>): ItemInstance =>
      item(`forged:${classifyPlacement(sword).id}`, {
        forged: { parts: partsOf(sword), q: 'c' },
        ...extra,
      });
    const plain = forge({});
    const better = forge({ affix: SHARP });
    expect(itemDefOf(better)).toBeTruthy();
    expect(beats(better, plain)).toBe(false);
    // Hands hold nothing else, so a bare K budget would not hide a wrong answer here.
    const shield = item('wooden_shield');
    const rapier = item('rapier');
    expect(spareUids(stateWith([plain, better], { weapon: rapier, offhand: shield }))).toEqual([]);
  });

  it('the festival weapon and royale finds are neither marked nor used to mark', () => {
    const plain = vest();
    const sturdy = vest({ affix: STURDY });
    const run = (extra: Partial<FestivalRun>) => {
      const state = stateWith([plain, sturdy]);
      state.festival = { run: { ...extra } as FestivalRun };
      return state;
    };
    expect(spareUids(stateWith([plain, sturdy]))).toEqual(uids(plain));
    expect(spareUids(run({ lent: [sturdy.uid] }))).toEqual([]);
    expect(spareUids(run({ lent: [plain.uid] }))).toEqual([]);
    expect(spareUids(run({ issued: sturdy.uid }))).toEqual([]);
    expect(spareUids(run({ issued: plain.uid }))).toEqual([]);
  });

  it('an item named in a saved Loadout is neither marked nor used to mark', () => {
    const plain = vest();
    const sturdy = vest({ affix: STURDY });
    const withLoadout = (named: ItemInstance) => {
      const state = stateWith([plain, sturdy]);
      state.loadouts = [{ name: 'Tank', order: [], benched: [], drilling: [], equipment: { chest: named.uid } }];
      return state;
    };
    expect(spareUids(withLoadout(plain))).toEqual([]);
    expect(spareUids(withLoadout(sturdy))).toEqual([]);
    const other = stateWith([plain, sturdy, vest({ slots: 1 })]);
    other.loadouts = [{ name: 'Tank', order: [], benched: [], drilling: [], equipment: { chest: plain.uid } }];
    expect(spareUids(other)).not.toContain(plain.uid);
  });
});

describe('findSpares: the vest example', () => {
  it('plain and Sturdy 2-slot vests are spare behind a Sturdy 4-slot vest; the Sharp 3-slot vest stays', () => {
    const plain2 = vest({ slots: 2 });
    const sturdy2 = vest({ slots: 2, affix: STURDY });
    const sturdy4 = vest({ slots: 4, affix: STURDY });
    const sharp3 = vest({ slots: 3, affix: SHARP });
    const state = stateWith([plain2, sturdy2, sturdy4, sharp3]);
    expect(spareUids(state)).toEqual(uids(plain2, sturdy2));
    expect(findSpares(state).get(plain2.uid)).toBe(sturdy4);
  });

  it('a worn piece marks pack stacks spare, and is never marked itself', () => {
    const worn = vest({ slots: 4, affix: STURDY });
    const pack = [vest({ slots: 2 }), vest({ slots: 2 }), vest({ slots: 4 })];
    const state = stateWith(pack, { chest: worn });
    expect(spareUids(state)).toEqual(uids(...pack));
    expect(findSpares(state).has(worn.uid)).toBe(false);
  });

  it('a stack is spare only when every item in it is', () => {
    const a = vest({ slots: 2 });
    const b = vest({ slots: 2 });
    const best = vest({ slots: 2, affix: STURDY });
    const state = stateWith([a, b, best]);
    const spare = findSpares(state);
    const stacks = groupItems(state.inventory);
    expect(stacks.map((s) => isSpareStack(s, spare))).toEqual([true, false]);
    const half = new Map([[a.uid, best]]);
    expect(isSpareStack(stacks[0], half)).toBe(false);
  });
});

describe('findSpares: hands', () => {
  const sharpDagger = () => item('iron_dagger', { affix: SHARP });
  const plainDagger = () => item('iron_dagger');

  it('two light daggers with an empty off hand: neither is spare', () => {
    const better = sharpDagger();
    const worse = plainDagger();
    expect(spareUids(stateWith([worse], { weapon: better }))).toEqual([]);
    expect(spareUids(stateWith([better, worse]))).toEqual([]);
  });

  it('a hand holding a different base takes a copy off the budget', () => {
    const better = sharpDagger();
    const worse = plainDagger();
    const shield = item('wooden_shield');
    // One hand left for daggers: the worn Sharp one fills it.
    expect(spareUids(stateWith([worse], { weapon: better, offhand: shield }))).toEqual(uids(worse));
    // Both hands hold other bases: no dagger is needed, so a beaten one is spare.
    const sword = item('iron_sword');
    expect(spareUids(stateWith([better, worse], { weapon: sword, offhand: shield }))).toEqual(uids(worse));
  });

  it('only copies past the best K can be spare', () => {
    const best = sharpDagger();
    const mid = plainDagger();
    const last = plainDagger();
    const state = stateWith([best, mid, last]);
    // K = 2: the Sharp one and one plain one stay, the other plain one goes.
    expect(spareUids(state)).toEqual(uids(last));
    // A body with three arms keeps all three.
    expect(spareUids(state, 3)).toEqual([]);
  });

  it('a copy that is not beaten is never spare, whatever K is', () => {
    const sharp = sharpDagger();
    const swift = item('iron_dagger', { affix: SWIFT });
    const shield = item('wooden_shield');
    const rapier = item('rapier');
    expect(spareUids(stateWith([sharp, swift], { weapon: rapier, offhand: shield }))).toEqual([]);
  });
});

describe('findSpares: rune slots with runecarving shut', () => {
  const shield = item('wooden_shield');
  const rapier = item('rapier');
  // Both hands hold other bases, so the hand budget cannot hide a wrong answer.
  const hands = { weapon: rapier, offhand: shield };

  it('a 3-slot plain sword is not spare against a 0-slot affixed one', () => {
    const slotted = item('iron_sword', { slots: 3 });
    const sharp = item('iron_sword', { affix: SHARP });
    expect(spareUids(stateWith([slotted, sharp], hands, false))).toEqual([]);
    expect(spareUids(stateWith([slotted, sharp], hands, true))).toEqual([]);
  });

  it('a slot difference decides nothing while shut, and counts once open', () => {
    const bare = item('iron_sword');
    const sharpSlotted = item('iron_sword', { slots: 3, affix: SHARP });
    expect(beats(sharpSlotted, bare, true)).toBe(true);
    expect(beats(sharpSlotted, bare, false)).toBe(false);
    expect(spareUids(stateWith([bare, sharpSlotted], hands, true))).toEqual(uids(bare));
    expect(spareUids(stateWith([bare, sharpSlotted], hands, false))).toEqual([]);
  });

  it('equal slots compare by stats whether shut or open', () => {
    const plain = vest({ slots: 2 });
    const sturdy = vest({ slots: 2, affix: STURDY });
    expect(spareUids(stateWith([plain, sturdy], {}, false))).toEqual(uids(plain));
  });
});

describe('the stack key carries size', () => {
  it('a medium item keys as it always did, with the size absent or named', () => {
    const base = { uid: 1, defId: 'iron_sword', slots: 2, runes: [] };
    expect(stackKey(base)).toBe('iron_sword||2|');
    expect(stackKey({ ...base, size: 'medium' })).toBe(stackKey(base));
  });

  it('a larger item is its own stack', () => {
    const medium = vest({ affix: SHARP });
    const large = vest({ affix: SHARP, size: 'large' });
    const huge = vest({ affix: SHARP, size: 'huge' });
    expect(new Set([stackKey(medium), stackKey(large), stackKey(huge)]).size).toBe(3);
    expect(groupItems([medium, large, vest({ affix: SHARP, size: 'large' })]).map((s) => s.items.length)).toEqual([1, 2]);
  });
});

describe('compareToWorn', () => {
  it('names the stat change against the worn piece and the rune slot gap', () => {
    const worn = vest({ slots: 2 });
    const candidate = vest({ slots: 4, affix: STURDY });
    const state = stateWith([candidate], { chest: worn });
    const cmp = compareToWorn(state, candidate, 'chest', true)!;
    expect(cmp.worn).toBe(worn);
    expect(cmp.lines).toEqual([
      { text: 'Max HP: +12 vs worn', better: true },
      { text: 'Rune slots: +2', better: true },
    ]);
    expect(compareToWorn(state, candidate, 'chest', false)!.lines.map((l) => l.text)).toEqual(['Max HP: +12 vs worn']);
  });

  it('marks a loss, and reads a lower damage taken as a gain', () => {
    const sharpWorn = vest({ affix: SHARP });
    const plain = vest();
    const state = stateWith([plain], { chest: sharpWorn });
    expect(compareToWorn(state, plain, 'chest', true)!.lines).toEqual([
      { text: 'Damage: −10% vs worn', better: false },
    ]);

    const hardy: Affix = { name: 'Hardy', mods: [{ stat: 'damageTaken', op: 'mult', value: -0.1 }] };
    const hardyVest = vest({ affix: hardy });
    const cmp = compareToWorn(stateWith([hardyVest], { chest: plain }), hardyVest, 'chest', true)!;
    expect(cmp.lines).toEqual([{ text: 'Damage Taken: −10% vs worn', better: true }]);
  });

  it('scales a piece that does not fit its wearer', () => {
    const worn = vest();
    const large = vest({ size: 'large' });
    const state = stateWith([large], { chest: worn });
    const armor = compareToWorn(state, large, 'chest', true)!.lines.find((l) => l.text.startsWith('Armor'))!;
    expect(armor.better).toBe(false);
  });

  it('is null for an empty slot or the worn piece itself, and flags conditional bonuses', () => {
    const worn = vest();
    const state = stateWith([], { chest: worn });
    expect(compareToWorn(state, vest(), 'head', true)).toBeNull();
    expect(compareToWorn(state, worn, 'chest', true)).toBeNull();
    const gated: Affix = { name: 'Gated', mods: [{ stat: 'maxHp', op: 'add', value: 12, requiresTag: 'dagger' }] };
    const cmp = compareToWorn(state, vest({ affix: gated }), 'chest', true)!;
    expect(cmp.conditional).toBe(true);
    expect(cmp.lines).toEqual([]);
  });
});

/** A small seeded generator, so a failing trial can be replayed. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('property: a slot class never loses all its stacks', () => {
  // Few bases and many items, so copies of one base are the common case.
  const BASES = [
    'leather_vest',
    'cloth_tunic',
    'leather_cap',
    'iron_dagger',
    'iron_sword',
    'wooden_shield',
    'steel_greatsword',
  ];
  const HARDY: Affix = { name: 'Hardy', mods: [{ stat: 'damageTaken', op: 'mult', value: -0.1 }] };
  const AFFIX_POOL: (Affix | undefined)[] = [undefined, undefined, ...AFFIXES, HARDY];

  function trial(seed: number) {
    const rand = lcg(seed);
    const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
    const items: ItemInstance[] = [];
    const count = 8 + Math.floor(rand() * 50);
    for (let i = 0; i < count; i++) {
      const rolled = pick(AFFIX_POOL);
      const copy = item(pick(BASES), {
        slots: Math.floor(rand() * 5),
        ...(rolled ? { affix: rolled } : {}),
        ...(rand() < 0.15 ? { size: 'large' as const } : {}),
      });
      // Duplicates are the point: copy an earlier item some of the time.
      items.push(rand() < 0.3 && items.length ? { ...pick(items), uid: copy.uid } : copy);
    }
    // Wear some of them: a random piece per slot class, hands by their own slot.
    const worn: Partial<Record<SlotId, ItemInstance>> = {};
    const pack: ItemInstance[] = [];
    for (const it of items) {
      const slot = itemDefOf(it).slot;
      if (!worn[slot] && rand() < 0.35) worn[slot] = it;
      else pack.push(it);
    }
    const runesOpen = rand() < 0.5;
    return { state: stateWith(pack, worn, runesOpen), pack, worn, runesOpen };
  }

  it('holds over 300 random inventories, with and without worn pieces and the rune shutter', () => {
    let marked = 0;
    let trialsWithSpares = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const { state, pack, worn, runesOpen } = trial(seed);
      const spare = findSpares(state);
      const where = `seed ${seed}`;
      marked += spare.size;
      if (spare.size > 0) trialsWithSpares += 1;

      // Only pack items are ever marked, and each is named against a piece that beats it.
      const packUids = new Set(pack.map((i) => i.uid));
      for (const [uid, by] of spare) {
        expect(packUids.has(uid), where).toBe(true);
        const loser = pack.find((i) => i.uid === uid)!;
        expect(beats(by, loser, runesOpen), where).toBe(true);
      }

      // Every slot class that is held keeps something: worn, or a stack that is not spare.
      const classes = new Set([...pack, ...Object.values(worn)].map((i) => itemDefOf(i!).slot));
      for (const cls of classes) {
        const wornInClass = Object.values(worn).some((i) => itemDefOf(i!).slot === cls);
        const kept = pack.filter((i) => itemDefOf(i).slot === cls && !spare.has(i.uid));
        expect(wornInClass || kept.length > 0, `${where}: class ${cls}`).toBe(true);
        // With nothing worn in the class, the pack's stacks alone keep one.
        if (!wornInClass) {
          const stacks = groupItems(pack.filter((i) => itemDefOf(i).slot === cls));
          expect(stacks.some((s) => !isSpareStack(s, spare)), `${where}: class ${cls}`).toBe(true);
        }
      }
    }
    // The generator must reach the interesting case: most trials mark something.
    expect(trialsWithSpares).toBeGreaterThan(150);
    expect(marked).toBeGreaterThan(500);
  });

  it('keeps the best K copies of a hand base', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { state, pack, worn } = trial(seed);
      const spare = findSpares(state, 2);
      const handBase = (i: ItemInstance) => ['weapon', 'offhand'].includes(itemDefOf(i).slot);
      const groups = new Map<string, ItemInstance[]>();
      for (const i of [...pack, ...Object.values(worn)].filter((x): x is ItemInstance => !!x && handBase(x))) {
        const key = `${i.defId}|${i.size ?? 'medium'}`;
        groups.set(key, [...(groups.get(key) ?? []), i]);
      }
      for (const [key, copies] of groups) {
        const defId = copies[0].defId;
        const otherHands = (['weapon', 'offhand'] as SlotId[]).filter((s) => state.equipment[s] && state.equipment[s]!.defId !== defId).length;
        const budget = Math.max(0, 2 - otherHands);
        const standing = copies.filter((c) => !spare.has(c.uid)).length;
        expect(standing, `seed ${seed}: ${key}`).toBeGreaterThanOrEqual(Math.min(budget, copies.length));
      }
    }
  });
});
