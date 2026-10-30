import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { FLOORS, SPOTS } from '../src/core/registry';
import { condText, termText } from '../src/ui/lib/format';

/** The ladder and the map say band 3's ward terms in words (bands-2-3.md, "The four wards"). */

describe('ward terms in words', () => {
  const clear = FLOORS.ascent_f7.clear![0];

  it("floor 7's stamp clear names the place that can finish it at the ward's position", () => {
    const s = createInitialState(0);
    expect(termText(clear, s)).toBe(`Win ${SPOTS.f7_merchant_road.name}`);
    s.stats['band:pos:ascent_f7'] = 1;
    expect(termText(clear, s)).toBe(`Win ${SPOTS.f7_chiefs_tent.name}`);
    s.stats['band:pos:ascent_f7'] = 3;
    expect(termText(clear, s)).toBe(`Win ${SPOTS.f7_burnt_camp.name}`);
    s.stats['ward:f7:done'] = 1;
    expect(termText(clear, s)).toMatch(/✓$/);
  });

  it('fight counts and ward positions read as words, not counter keys', () => {
    expect(condText({ type: 'stat', key: 'fights:f7_stockade', value: 4 })).toBe(`win 4 fights at ${SPOTS.f7_stockade.name}`);
    expect(condText({ type: 'statMax', key: 'band:pos:ascent_f7', value: 0 })).toBe('at most 0 other floors of The City cleared');
    expect(condText({ type: 'stat', key: 'band:pos:ascent_f7', value: 3 })).toBe('3+ other floors of The City cleared');
  });
});
