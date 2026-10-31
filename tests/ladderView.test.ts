import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { BANDS, FLOORS, TOWERS } from '../src/core/registry';
import { bandKnown, floorReached } from '../src/core/systems/towers';
import { prestigeNow } from '../src/core/systems/prestige';
import { homeGroupId, ladderBands, ladderGroups, type LadderBand } from '../src/ui/lib/ladderView';
import { termText } from '../src/ui/lib/format';
import type { GameState } from '../src/core/types';
import { clearFloors } from './fixtures/floors';

// The ladder panel's layout (ui/lib/ladderView.ts): bands as groups, a floor
// named once its door is reached, the next band by its name only, nothing
// above it, and the floors reached carried through a prestige.

const ASCENT = TOWERS.the_ascent;
const WARDS = ['ascent_f7', 'ascent_f8', 'ascent_f9', 'ascent_f10'];

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

describe('ladder view: narrow groups', () => {
  it('gathers bands three at a time by band index, labelled by the floors shown in full', () => {
    const s = fresh();
    clearFloors(s.stats);
    const groups = ladderGroups(ladderBands(s, ASCENT));
    expect(groups.map((g) => [g.id, g.label, g.bands.map((b) => b.band.id)])).toEqual([
      [1, 'The Harbor', ['ascent_harbor']],
      [0, 'Floors 1–10', ['ascent_upper', 'ascent_middle', 'ascent_lower']],
    ]);
  });

  it('opens the group the player stands in, else the one with the highest band reached', () => {
    const s = fresh();
    clearFloors(s.stats);
    const groups = ladderGroups(ladderBands(s, ASCENT));
    expect(homeGroupId(groups, 'ascent_lower')).toBe(0);
    expect(homeGroupId(groups, undefined)).toBe(0);
  });
});
