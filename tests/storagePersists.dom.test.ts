import { describe, expect, it } from 'vitest';
import { browserStorage, storagePersists } from '../src/core/save/save';

// With a working localStorage (jsdom has one) the flag is true and the storage is
// the browser's own, so nothing says "does not persist" (tests/storageRefused.dom.test.ts
// is the refused case).
describe('storage the browser allows', () => {
  it('persists, and is localStorage itself', () => {
    expect(storagePersists).toBe(true);
    expect(browserStorage).toBe(globalThis.localStorage);
  });
});
