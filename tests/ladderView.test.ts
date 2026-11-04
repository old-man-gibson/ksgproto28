import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { BANDS, FLOORS, TOWERS, floorsInBand } from '../src/core/registry';
import { bandKnown, floorCleared, floorReached, hubStatus, rungStatus } from '../src/core/systems/towers';
import { prestigeNow } from '../src/core/systems/prestige';
import {
  bandDrawnOpen,
  bandFoldable,
  bandProgress,
  hubTerms,
  ladderBands,
  rungTerms,
  standingBandId,
  type LadderBand,
} from '../src/ui/lib/ladderView';
import { bandIsOpen, resetFoldChoices, setBandOpen } from '../src/ui/lib/ladderFold.svelte';
import { termText } from '../src/ui/lib/format';
import type { FestivalRun, GameState } from '../src/core/types';
import { clearFloors } from './fixtures/floors';

// The ladder panel's layout (ui/lib/ladderView.ts): bands as groups, a floor
// named once its door is reached, the next band by its name only, nothing
// above it, and the floors reached carried through a prestige. Then what a
// rung says about getting in (`rungTerms`, `hubTerms`) and which bands fold.

const ASCENT = TOWERS.the_ascent;
const WARDS = ['ascent_f7', 'ascent_f8', 'ascent_f9', 'ascent_f10'];

/** Floors 1 to n of the Ascent, by id. */
const floorsUpTo = (n: number): string[] => Array.from({ length: n }, (_, i) => `ascent_f${i + 1}`);

const fresh = (): GameState => createInitialState(0, 'ascent_foot');

/** Band id → its cards as `id` or `id?` (shown by number only), `hub:<spot>` for a hub. */
function shape(bands: LadderBand[]): [string, boolean, string[]][] {
  return bands.map((b) => [
    b.band.id,
    b.titleOnly,
    b.cards.map((c) => (c.kind === 'hub' ? `hub:${c.band.hub}` : c.named ? c.floor.id : `${c.floor.id}?`)),
  ]);
}

describe('ladder view: what the ladder shows', () => {
  it('a fresh run shows band 1 with only floor 1 named, then the Wilds by name only', () => {
    expect(shape(ladderBands(fresh(), ASCENT))).toEqual([
      ['ascent_middle', true, []],
      ['ascent_lower', false, ['ascent_f1', 'ascent_f2?', 'ascent_f3?']],
    ]);
  });

  it('band 2 cleared: the city in full behind its gated hub, the harbor by name, nothing above', () => {
    const s = fresh();
    clearFloors(s.stats);
    const bands = ladderBands(s, ASCENT);
    expect(bands.map((b) => b.band.id)).toEqual(['ascent_harbor', 'ascent_upper', 'ascent_middle', 'ascent_lower']);
    expect(shape(bands)[1]).toEqual(['ascent_upper', false, ['hub:castle_court', ...WARDS]]);
    expect(bands[0].titleOnly).toBe(true);
    expect(bandKnown(s, BANDS.ascent_harbor)).toBe(false);
  });

  it('a discovery shows reached floors only and no band above them', () => {
    const bands = ladderBands(fresh(), { ...ASCENT, foreknown: false });
    expect(shape(bands)).toEqual([['ascent_lower', false, ['ascent_f1']]]);
  });
});

describe('ladder view: floors reached carry through a prestige', () => {
  it('prestigeNow records the floors reached; the next run names them from its first tick', () => {
    const s = fresh();
    clearFloors(s.stats);
    const next = prestigeNow(s, 1)!;
    expect(next).not.toBeNull();
    for (const id of ['ascent_f1', 'ascent_f6', ...WARDS]) expect(next.prestige.floorsSeen).toContain(id);
    expect(next.prestige.floorsSeen).not.toContain('ascent_f11');
    // Sealed again this run, but reached before: named.
    expect(floorReached(next, FLOORS.ascent_f6)).toBe(true);
    const bands = ladderBands(next, ASCENT);
    expect(shape(bands).find(([id]) => id === 'ascent_middle')).toEqual([
      'ascent_middle',
      false,
      ['ascent_f4', 'ascent_f5', 'ascent_f6'],
    ]);
    expect(bands[0]).toMatchObject({ titleOnly: true, band: { id: 'ascent_harbor' } });
  });

  it('a second prestige keeps the first record and adds to it', () => {
    const s = fresh();
    s.prestige.floorsSeen = ['ascent_f12'];
    clearFloors(s.stats);
    const next = prestigeNow(s, 1)!;
    expect(next.prestige.floorsSeen).toContain('ascent_f12');
    expect(next.prestige.floorsSeen).toContain('ascent_f6');
  });
});

describe('ladder view: gate terms', () => {
  it("floor 5's goblin gate reads as a kill count, not a counter key", () => {
    const s = fresh();
    s.stats['kills:tag:goblin'] = 7;
    const gate = FLOORS.ascent_f5.gate!.find((c) => c.type === 'stat' && c.key === 'kills:tag:goblin')!;
    expect(termText(gate, s)).toBe('Kill 12 goblin monsters (7/12)');
  });
});

describe('rung terms: what a card says about getting in', () => {
  /** One open line per clear condition of the floor. */
  const clearTerms = (s: GameState, id: string) =>
    FLOORS[id].clear!.map((cond) => ({ icon: '🎯', text: termText(cond, s), dim: false, cond }));

  it('open: the floor’s clear conditions', () => {
    const s = fresh();
    expect(rungStatus(s, FLOORS.ascent_f1)).toBe('open');
    expect(rungTerms(s, FLOORS.ascent_f1)).toEqual({ kind: 'open', terms: clearTerms(s, 'ascent_f1') });
    expect(rungTerms(s, FLOORS.ascent_f1).terms.length).toBeGreaterThan(0);
  });

  it('cleared: no terms', () => {
    const s = fresh();
    clearFloors(s.stats);
    expect(rungStatus(s, FLOORS.ascent_f1)).toBe('cleared');
    expect(rungTerms(s, FLOORS.ascent_f1)).toEqual({ kind: 'cleared', terms: [] });
  });

  it('sealed: the way up is not cleared', () => {
    const s = fresh();
    expect(rungStatus(s, FLOORS.ascent_f2)).toBe('sealed');
    expect(rungTerms(s, FLOORS.ascent_f2)).toEqual({
      kind: 'sealed',
      terms: [{ icon: '', text: 'The way up is not cleared.', dim: true }],
    });
  });

  it('gated: the floor’s gate, one line per condition, each carrying its condition', () => {
    const s = fresh();
    clearFloors(s.stats, floorsUpTo(4));
    s.stats['kills:tag:goblin'] = 7;
    expect(rungStatus(s, FLOORS.ascent_f5)).toBe('gated');
    const { kind, terms } = rungTerms(s, FLOORS.ascent_f5);
    expect(kind).toBe('gated');
    expect(terms.map((t) => t.cond)).toEqual(FLOORS.ascent_f5.gate);
    expect(terms.every((t) => t.icon === '🔒' && !t.dim)).toBe(true);
    expect(terms.map((t) => t.text)).toContain('Kill 12 goblin monsters (7/12)');
  });

  it('gated by the band: a ward with no gate of its own names the hub that opens it', () => {
    const s = fresh();
    clearFloors(s.stats);
    expect(rungStatus(s, FLOORS.ascent_f7)).toBe('gated');
    expect(FLOORS.ascent_f7.gate).toBeUndefined();
    expect(rungTerms(s, FLOORS.ascent_f7)).toEqual({
      kind: 'gated',
      terms: [{ icon: '', text: 'Opens with The Castle Court.', dim: true }],
    });
  });

  it('floors 7 to 9 cleared with the key owned: floor 10 is the open rung and the hub is open', () => {
    const s = fresh();
    clearFloors(s.stats, floorsUpTo(9));
    s.prestige.purchases.city_key = 1;
    for (const id of ['ascent_f7', 'ascent_f8', 'ascent_f9']) expect(rungTerms(s, FLOORS[id]).kind).toBe('cleared');
    expect(rungStatus(s, FLOORS.ascent_f10)).toBe('open');
    expect(rungTerms(s, FLOORS.ascent_f10)).toEqual({ kind: 'open', terms: clearTerms(s, 'ascent_f10') });
    expect(hubStatus(s, BANDS.ascent_upper)).toBe('open');
    expect(hubTerms(s, BANDS.ascent_upper)).toEqual({ kind: 'open', terms: [] });
  });

  describe('the Vermin Festival (floors 15 and 16)', () => {
    /** Floors 1 to 14 cleared: floor 15 is next. */
    function atHall(): GameState {
      const s = fresh();
      clearFloors(s.stats, floorsUpTo(14));
      s.prestige.purchases.city_key = 1;
      return s;
    }

    it('lockout: floor 15 reads gated with no gate field, and the terms give the reason', () => {
      const s = atHall();
      s.festival = { lockedUntil: s.totalTicks + 5000 };
      expect(rungStatus(s, FLOORS.ascent_f15)).toBe('gated');
      expect(FLOORS.ascent_f15.gate).toBeUndefined();
      expect(rungTerms(s, FLOORS.ascent_f15)).toEqual({
        kind: 'locked',
        terms: [{ icon: '🔒', text: 'Shut after a lost festival attempt: 8m of play, or the next prestige.', dim: false }],
      });
      // Floor 16 is sealed behind 15, and the lockout still comes first.
      expect(rungStatus(s, FLOORS.ascent_f16)).toBe('sealed');
      expect(rungTerms(s, FLOORS.ascent_f16).kind).toBe('locked');
    });

    it('a lockout that has run out leaves floor 15 an ordinary open rung', () => {
      const s = atHall();
      s.festival = { lockedUntil: s.totalTicks };
      expect(rungTerms(s, FLOORS.ascent_f15)).toEqual({ kind: 'open', terms: clearTerms(s, 'ascent_f15') });
    });

    it('closed: floor 16 has no door of its own outside an attempt', () => {
      const s = atHall();
      clearFloors(s.stats, ['ascent_f15']);
      expect(rungStatus(s, FLOORS.ascent_f16)).toBe('open');
      expect(rungTerms(s, FLOORS.ascent_f16)).toEqual({
        kind: 'closed',
        terms: [{ icon: '🏟️', text: 'Entered from floor 15’s hall, during a festival attempt.', dim: true }],
      });
    });

    it('shut: floor 16 from the hall while the dark room still fights; open once the door opens', () => {
      const s = atHall();
      clearFloors(s.stats, ['ascent_f15']);
      s.spot = 'f15_dark_room';
      s.festival = { run: { phase: 'dark' } as FestivalRun };
      expect(rungTerms(s, FLOORS.ascent_f16)).toEqual({
        kind: 'shut',
        terms: [{ icon: '🚪', text: 'Opens from the hall once the dark room is empty.', dim: true }],
      });
      s.festival.run!.phase = 'prep';
      expect(rungTerms(s, FLOORS.ascent_f16)).toEqual({ kind: 'open', terms: clearTerms(s, 'ascent_f16') });
    });
  });

  describe('a band hub', () => {
    it('sealed while the bands below are not cleared', () => {
      expect(hubTerms(fresh(), BANDS.ascent_upper)).toEqual({
        kind: 'sealed',
        terms: [{ icon: '', text: 'The way up is not cleared.', dim: true }],
      });
    });

    it('gated: the band’s gate, with its condition', () => {
      const s = fresh();
      clearFloors(s.stats);
      expect(hubStatus(s, BANDS.ascent_upper)).toBe('gated');
      expect(hubTerms(s, BANDS.ascent_upper)).toEqual({
        kind: 'gated',
        terms: [
          {
            icon: '🔒',
            text: 'Own the Key to the City prestige boon',
            dim: false,
            cond: { type: 'boon', id: 'city_key' },
          },
        ],
      });
    });

    it('open once the gate holds: no terms', () => {
      const s = fresh();
      clearFloors(s.stats);
      s.prestige.purchases.city_key = 1;
      expect(hubTerms(s, BANDS.ascent_upper)).toEqual({ kind: 'open', terms: [] });
    });
  });
});

describe('ladder fold: which bands fold', () => {
  const byBand = (s: GameState, standing?: string) =>
    Object.fromEntries(ladderBands(s, ASCENT).map((lb) => [lb.band.id, bandFoldable(s, lb, standing)]));

  it('floors 1 to 6 cleared: the two cleared bands fold, the city and the next band do not', () => {
    const s = fresh();
    clearFloors(s.stats);
    expect(byBand(s)).toEqual({
      ascent_harbor: false,
      ascent_upper: false,
      ascent_middle: true,
      ascent_lower: true,
    });
  });

  it('a band the player stands in does not fold', () => {
    const s = fresh();
    clearFloors(s.stats);
    expect(byBand(s, 'ascent_middle')).toMatchObject({ ascent_middle: false, ascent_lower: true });
  });

  it('standingBandId: the band of the floor the player is on, else the band whose hub they are at', () => {
    const s = fresh();
    expect(standingBandId(s)).toBeUndefined();
    s.spot = 'castle_court';
    expect(standingBandId(s)).toBe('ascent_upper');
    s.spot = FLOORS.ascent_f1.landing!;
    expect(standingBandId(s)).toBe('ascent_lower');
  });

  it('a band cleared by a pass folds', () => {
    const s = fresh();
    s.prestige.purchases.pass_lower = 1;
    expect(byBand(s).ascent_lower).toBe(true);
    const lower = ladderBands(s, ASCENT).find((lb) => lb.band.id === 'ascent_lower')!;
    expect(bandProgress(s, lower)).toEqual({ cleared: 3, total: 3 });
  });

  it('progress counts the floors the ladder shows', () => {
    const s = fresh();
    clearFloors(s.stats, floorsUpTo(2));
    const lower = ladderBands(s, ASCENT).find((lb) => lb.band.id === 'ascent_lower')!;
    expect(bandProgress(s, lower)).toEqual({ cleared: 2, total: 3 });
  });

  it('a band holding an uncleared floor is never folded, whatever the player chose', () => {
    for (let n = 0; n <= 16; n++) {
      for (const owned of [false, true]) {
        for (const locked of [false, true]) {
          const s = fresh();
          clearFloors(s.stats, floorsUpTo(n));
          if (owned) s.prestige.purchases.city_key = 1;
          if (locked) s.festival = { lockedUntil: s.totalTicks + 5000 };
          for (const lb of ladderBands(s, ASCENT)) {
            const allCleared = floorsInBand(lb.band.id).every((f) => floorCleared(s, f));
            const liveTerm = lb.cards.some((c) =>
              (c.kind === 'floor' ? rungTerms(s, c.floor) : hubTerms(s, c.band)).terms.some((t) => !t.dim),
            );
            for (const standing of [undefined, lb.band.id]) {
              const foldable = bandFoldable(s, lb, standing);
              const where = `${lb.band.id} after ${n} floors, key ${owned}, lockout ${locked}, standing ${standing}`;
              expect(foldable, where).toBe(!lb.titleOnly && !standing && allCleared && !liveTerm);
              if (!allCleared || liveTerm) {
                for (const choice of [undefined, true, false]) expect(bandDrawnOpen(foldable, choice), where).toBe(true);
              }
            }
          }
        }
      }
    }
  });

  it('a foldable band carries no term that is not dim', () => {
    for (let n = 0; n <= 16; n++) {
      for (const owned of [false, true]) {
        for (const locked of [false, true]) {
          const s = fresh();
          clearFloors(s.stats, floorsUpTo(n));
          if (owned) s.prestige.purchases.city_key = 1;
          if (locked) s.festival = { lockedUntil: s.totalTicks + 5000 };
          for (const lb of ladderBands(s, ASCENT)) {
            if (!bandFoldable(s, lb, undefined)) continue;
            for (const c of lb.cards) {
              const { terms } = c.kind === 'floor' ? rungTerms(s, c.floor) : hubTerms(s, c.band);
              expect(terms.filter((t) => !t.dim), `${lb.band.id} after ${n} floors`).toEqual([]);
            }
          }
        }
      }
    }
  });

  it('a festival won once and then lost keeps its band open: the lockout term stays in view', () => {
    const s = fresh();
    clearFloors(s.stats, floorsUpTo(16));
    s.prestige.purchases.city_key = 1;
    expect(s.stats['boss:f15_dark_room']).toBeGreaterThanOrEqual(1);
    expect(s.stats['boss:f16_arena']).toBeGreaterThanOrEqual(1);
    expect(floorCleared(s, FLOORS.ascent_f15)).toBe(true);
    expect(floorCleared(s, FLOORS.ascent_f16)).toBe(true);
    const festival = ladderBands(s, ASCENT).find((lb) => lb.band.id === 'ascent_festival')!;
    // Won and not locked: nothing live on the band, it folds.
    expect(bandFoldable(s, festival, undefined)).toBe(true);
    // A later attempt is lost: floors read cleared and shut at once.
    s.festival = { lockedUntil: s.totalTicks + 5000 };
    expect(rungTerms(s, FLOORS.ascent_f15).kind).toBe('locked');
    expect(bandFoldable(s, festival, undefined)).toBe(false);
    expect(bandDrawnOpen(bandFoldable(s, festival, undefined), undefined)).toBe(true);
    // The lockout runs out: the band folds again.
    s.festival = { lockedUntil: s.totalTicks };
    expect(bandFoldable(s, festival, undefined)).toBe(true);
  });

  it('a band cleared while its hub is still gated does not fold', () => {
    const s = fresh();
    clearFloors(s.stats, floorsUpTo(10));
    expect(hubStatus(s, BANDS.ascent_upper)).toBe('gated');
    const city = ladderBands(s, ASCENT).find((lb) => lb.band.id === 'ascent_upper')!;
    expect(floorsInBand('ascent_upper').every((f) => floorCleared(s, f))).toBe(true);
    expect(bandFoldable(s, city, undefined)).toBe(false);
    s.prestige.purchases.city_key = 1;
    expect(bandFoldable(s, city, undefined)).toBe(true);
  });

  it('a foldable band is drawn folded unless the player opened it', () => {
    expect(bandDrawnOpen(true, undefined)).toBe(false);
    expect(bandDrawnOpen(true, false)).toBe(false);
    expect(bandDrawnOpen(true, true)).toBe(true);
    expect(bandDrawnOpen(false, undefined)).toBe(true);
  });
});

describe('ladder fold: the player’s choice', () => {
  it('opening and folding a foldable band is remembered', () => {
    resetFoldChoices();
    expect(bandIsOpen('ascent_lower', true)).toBe(false);
    setBandOpen('ascent_lower', true, true);
    expect(bandIsOpen('ascent_lower', true)).toBe(true);
    setBandOpen('ascent_lower', true, false);
    expect(bandIsOpen('ascent_lower', true)).toBe(false);
  });

  it('a band that opens itself by stopping being foldable records no choice', () => {
    resetFoldChoices();
    // The player walks into the band: it is drawn open and the <details> reports open.
    setBandOpen('ascent_middle', false, true);
    // They leave: the band folds again.
    expect(bandIsOpen('ascent_middle', true)).toBe(false);
  });

  it('a band that may not fold stays open whatever was reported', () => {
    resetFoldChoices();
    setBandOpen('ascent_upper', false, false);
    expect(bandIsOpen('ascent_upper', false)).toBe(true);
  });
});
