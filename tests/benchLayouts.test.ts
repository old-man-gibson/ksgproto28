import { beforeEach, describe, expect, it } from 'vitest';
import { forgetLayouts, recallLayout, rememberLayout } from '../src/ui/lib/benchLayouts';

describe('the last layout at each bench', () => {
  beforeEach(forgetLayouts);

  it('has nothing for a bench the session has not touched', () => {
    expect(recallLayout('cooking')).toBeUndefined();
  });

  it('keeps one layout per bench', () => {
    rememberLayout('cooking', { main: { id: 'raw_meat', quality: 'c' } }, 8);
    rememberLayout('baking', { main: { id: 'wheat', quality: 'b' } }, null);
    expect(recallLayout('cooking')).toEqual({ placement: { main: { id: 'raw_meat', quality: 'c' } }, units: 8 });
    expect(recallLayout('baking')?.placement.main?.id).toBe('wheat');
  });

  it('a later layout replaces the earlier one', () => {
    rememberLayout('cooking', { main: { id: 'raw_meat', quality: 'c' } }, 8);
    rememberLayout('cooking', { second: { id: 'wild_onion', quality: 'a' } }, null);
    expect(recallLayout('cooking')).toEqual({ placement: { second: { id: 'wild_onion', quality: 'a' } }, units: null });
  });

  it('copies what it is given, so editing the bench afterwards does not edit the memory', () => {
    const stack = { id: 'raw_meat', quality: 'c' as const };
    const placement = { main: stack };
    rememberLayout('cooking', placement, 12);
    placement.main = { id: 'wild_onion', quality: 'c' };
    stack.quality = 's' as never;
    expect(recallLayout('cooking')?.placement.main).toEqual({ id: 'raw_meat', quality: 'c' });
  });

  it('drops empty slots', () => {
    rememberLayout('cooking', { main: { id: 'raw_meat', quality: 'c' }, second: undefined }, null);
    expect(Object.keys(recallLayout('cooking')!.placement)).toEqual(['main']);
  });
});
