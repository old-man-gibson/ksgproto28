import { describe, expect, it } from 'vitest';
import {
  LOG_OPEN_MIN_WIDTH,
  logIsOpen,
  logOpenDefault,
  readLogChoice,
  writeLogChoice,
} from '../src/ui/lib/shell';
import { SHELL_KEY, patchShell, readSeen, writeSeen, type ShellStore } from '../src/ui/lib/nav';

function fakeStore(initial: string | null = null, opts: { throwGet?: boolean; throwSet?: boolean } = {}) {
  const data = new Map<string, string>();
  if (initial !== null) data.set(SHELL_KEY, initial);
  const store: ShellStore & { data: Map<string, string> } = {
    data,
    getItem(key) {
      if (opts.throwGet) throw new Error('blocked');
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      if (opts.throwSet) throw new Error('full');
      data.set(key, value);
    },
  };
  return store;
}

describe('the log column’s default', () => {
  it('is open from 1360 px and folded below', () => {
    expect(LOG_OPEN_MIN_WIDTH).toBe(1360);
    expect(logOpenDefault(1360)).toBe(true);
    expect(logOpenDefault(1359)).toBe(false);
    expect(logOpenDefault(1440)).toBe(true);
    expect(logOpenDefault(1920)).toBe(true);
    expect(logOpenDefault(1094)).toBe(false);
    expect(logOpenDefault(375)).toBe(false);
  });
});

describe('the stored choice', () => {
  it('beats the width default in both directions', () => {
    // Folded by choice on a wide window, open by choice on a narrow one.
    expect(logIsOpen(false, 1920)).toBe(false);
    expect(logIsOpen(false, 1440)).toBe(false);
    expect(logIsOpen(true, 1094)).toBe(true);
    expect(logIsOpen(true, 375)).toBe(true);
    // No choice: the width decides.
    expect(logIsOpen(null, 1440)).toBe(true);
    expect(logIsOpen(null, 1094)).toBe(false);
  });

  it('is read back as written, and absent until written', () => {
    const store = fakeStore();
    expect(readLogChoice(store)).toBeNull();
    writeLogChoice(false, store);
    expect(readLogChoice(store)).toBe(false);
    writeLogChoice(true, store);
    expect(readLogChoice(store)).toBe(true);
  });

  it('is stored in the shell key beside the seen ids, and each write keeps the other', () => {
    const store = fakeStore(JSON.stringify({ seen: ['location', 'combat'], hideNextStep: true }));
    writeLogChoice(false, store);
    expect(JSON.parse(store.data.get(SHELL_KEY)!)).toEqual({
      seen: ['location', 'combat'],
      hideNextStep: true,
      logOpen: false,
    });
    writeSeen(['location', 'combat', 'skills'], store);
    expect(readLogChoice(store)).toBe(false);
    expect(readSeen(store)).toEqual(['location', 'combat', 'skills']);
    expect(JSON.parse(store.data.get(SHELL_KEY)!).hideNextStep).toBe(true);
  });

  it('reads only a boolean', () => {
    for (const bad of [
      '{not json',
      '[]',
      'null',
      JSON.stringify({ logOpen: 'false' }),
      JSON.stringify({ logOpen: 0 }),
      JSON.stringify({ logOpen: null }),
      JSON.stringify({ seen: [] }),
    ]) {
      expect(readLogChoice(fakeStore(bad)), bad).toBeNull();
    }
  });

  it('survives storage that is missing or throws', () => {
    expect(readLogChoice(null)).toBeNull();
    expect(readLogChoice(fakeStore(null, { throwGet: true }))).toBeNull();
    expect(() => writeLogChoice(true, null)).not.toThrow();
    expect(() => writeLogChoice(true, fakeStore(null, { throwSet: true }))).not.toThrow();
    expect(() => patchShell({ a: 1 }, fakeStore(null, { throwGet: true, throwSet: true }))).not.toThrow();
  });

  it('starts a shell object when the stored value is unreadable', () => {
    const store = fakeStore('{broken');
    writeLogChoice(true, store);
    expect(JSON.parse(store.data.get(SHELL_KEY)!)).toEqual({ logOpen: true });
  });
});
