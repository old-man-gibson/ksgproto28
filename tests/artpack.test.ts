import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { zipSync } from 'fflate';
import { MONSTERS } from '../src/core/registry';
import manifest from '../src/ui/lib/icons/manifest.json';
import {
  ART_PACK_FORMAT,
  ArtPackError,
  MANIFEST_NAME,
  describePack,
  mimeOf,
  packZip,
  readPack,
  type PackManifest,
} from '../src/ui/lib/artPack/format';
import { ArtPack, artPack } from '../src/ui/lib/artPack/artPack.svelte';
import { PACK_HINT_KEY, readPackHint, writePackHint, type HintStore } from '../src/ui/lib/artPack/hint';
import type { PackStore } from '../src/ui/lib/artPack/store';
import { PACKS, SHEETS } from '../src/ui/lib/tilemaps/sheets.gen';
import { expectsNoSheets } from '../src/ui/lib/tilemaps/tileArt';
import type { TileMapDef } from '../src/ui/lib/tilemaps/types';
import { SAVE_KEY, clearStorage, loadFromStorage } from '../src/core/save/save';
// @ts-expect-error — a plain .mjs script with no type declarations
import { collect, globKeys, wantedKeys } from '../scripts/artPack.mjs';

// The art pack (docs/ART_PACK.md): the zip format the script and the game
// share, the keys the script packs, and the order the resolver tries sources
// in. IndexedDB itself is not exercised here; the browser check covers it.

const bytes = (...n: number[]) => new Uint8Array(n);

/** A file the way the picker hands one over. */
const blobOf = (data: Uint8Array) => new Blob([data as BlobPart]);

/** A zip file with whatever entries a test wants, manifest included, stored. */
function zipOf(entries: Record<string, Uint8Array | string>): Uint8Array {
  const enc = new TextEncoder();
  return zipSync(
    Object.fromEntries(
      Object.entries(entries).map(([k, v]) => [k, [typeof v === 'string' ? enc.encode(v) : v, { level: 0 }]]),
    ) as Parameters<typeof zipSync>[0],
  );
}

describe('art pack format', () => {
  const files = [
    { key: 'enemies/Book Monster.png', data: bytes(1, 2, 3, 4, 5) },
    { key: 'enemies/Æ icon.png', data: bytes(9) },
    { key: 'packs/clockwork-raven/64x64/c2881.png', data: new Uint8Array(1000).map((_, i) => i % 251) },
  ];

  it('round trips: the same keys and the same bytes', () => {
    const { manifest: m, files: out } = readPack(packZip(files, '2026-11-05T10:00:00.000Z'));
    expect(m.format).toBe(ART_PACK_FORMAT);
    expect(m.made).toBe('2026-11-05T10:00:00.000Z');
    expect(m.files.map((f) => f.key)).toEqual(files.map((f) => f.key).sort());
    expect([...out.keys()].sort()).toEqual(files.map((f) => f.key).sort());
    for (const f of files) {
      expect(out.get(f.key), f.key).toEqual(f.data);
      expect(m.files.find((e) => e.key === f.key)?.bytes).toBe(f.data.length);
    }
  });

  it('stores files without compression', () => {
    const data = new Uint8Array(20000);
    const zip = packZip([{ key: 'a.png', data }]);
    expect(zip.length).toBeGreaterThan(data.length);
  });

  it('describes a pack in one line', () => {
    expect(describePack(null)).toBe('Art pack: none.');
    expect(describePack(readPack(packZip(files, '2026-11-05T10:00:00.000Z')).manifest)).toBe(
      'Art pack: 3 files, made 2026-11-05.',
    );
    expect(describePack(readPack(packZip([files[0]], '2026-01-02T00:00:00.000Z')).manifest)).toBe(
      'Art pack: 1 file, made 2026-01-02.',
    );
  });

  it('types a file by its extension', () => {
    expect(mimeOf('enemies/a.png')).toBe('image/png');
    expect(mimeOf('x/y.JPG')).toBe('image/jpeg');
    expect(mimeOf('x/y.bin')).toBe('application/octet-stream');
  });

  it('rejects a manifest key that is not in the zip', () => {
    const m: PackManifest = { format: 1, made: 'x', files: [{ key: 'a.png', bytes: 1 }, { key: 'b.png', bytes: 1 }] };
    expect(() => readPack(zipOf({ [MANIFEST_NAME]: JSON.stringify(m), 'a.png': bytes(1) }))).toThrow(ArtPackError);
    expect(() => readPack(zipOf({ [MANIFEST_NAME]: JSON.stringify(m), 'a.png': bytes(1) }))).toThrow(/b\.png/);
  });

  it('rejects a file whose size differs from the manifest', () => {
    const m: PackManifest = { format: 1, made: 'x', files: [{ key: 'a.png', bytes: 2 }] };
    expect(() => readPack(zipOf({ [MANIFEST_NAME]: JSON.stringify(m), 'a.png': bytes(1) }))).toThrow(/size/);
  });

  it('rejects a format other than 1', () => {
    const m = { format: 2, made: 'x', files: [{ key: 'a.png', bytes: 1 }] };
    expect(() => readPack(zipOf({ [MANIFEST_NAME]: JSON.stringify(m), 'a.png': bytes(1) }))).toThrow(/format 2/);
    const none = { made: 'x', files: [] };
    expect(() => readPack(zipOf({ [MANIFEST_NAME]: JSON.stringify(none) }))).toThrow(ArtPackError);
  });

  it('rejects a zip without a manifest, a manifest that is not JSON, and a non-zip', () => {
    expect(() => readPack(zipOf({ 'a.png': bytes(1) }))).toThrow(/manifest/);
    expect(() => readPack(zipOf({ [MANIFEST_NAME]: 'not json' }))).toThrow(ArtPackError);
    expect(() => readPack(new TextEncoder().encode('{"format":1}'))).toThrow(ArtPackError);
    expect(() => readPack(new Uint8Array(0))).toThrow(ArtPackError);
    expect(() => readPack(new Uint8Array(500).fill(7))).toThrow(ArtPackError);
  });

  it('refuses to pack a repeated key or the manifest name', () => {
    expect(() => packZip([files[0], files[0]])).toThrow(ArtPackError);
    expect(() => packZip([{ key: MANIFEST_NAME, data: bytes(1) }])).toThrow(ArtPackError);
  });

  it('keeps only the files the manifest lists', () => {
    const m: PackManifest = { format: 1, made: 'x', files: [{ key: 'a.png', bytes: 1 }] };
    const { files: out } = readPack(zipOf({ [MANIFEST_NAME]: JSON.stringify(m), 'a.png': bytes(1), 'extra.png': bytes(2) }));
    expect([...out.keys()]).toEqual(['a.png']);
  });
});

describe('art pack script', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('reads the keys from the glob array only, relative to src/assets', () => {
    const source = [
      'export const PACKS = {',
      '  "p": "../../../assets/tilemaps/Pack One/",',
      '};',
      'export const SHEETS = import.meta.glob(',
      '  [',
      '    "../../../assets/tilemaps/Pack One/Tilesets/a [1].png",',
      '    "../../../assets/tilemaps/Pack One/b.png",',
      '  ],',
      "  { query: '?url' },",
      ');',
      'const later = "../../../assets/not/listed.png";',
    ].join('\n');
    expect(globKeys(source, 'src/ui/lib/tilemaps')).toEqual([
      'tilemaps/Pack One/Tilesets/a [1].png',
      'tilemaps/Pack One/b.png',
    ]);
    expect(() => globKeys('const x = 1;', 'src/ui/lib')).toThrow();
    expect(() => globKeys('import.meta.glob(["../../../../outside.png"])', 'src/ui/lib')).toThrow(/leaves/);
  });

  it('wants every portrait a monster names, every icon in the manifest and the tile sheets', () => {
    const wanted = new Set<string>(wantedKeys());
    for (const m of Object.values(MONSTERS)) {
      if (m.art) expect(wanted.has(`enemies/${m.art}`), m.id).toBe(true);
    }
    for (const file of Object.values(manifest)) expect(wanted.has(file), file).toBe(true);
    expect([...wanted].some((k) => k.startsWith('tilemaps/'))).toBe(true);
    for (const k of wanted) expect(k).toMatch(/^(enemies|packs|tilemaps)\/.+\.png$/);
  });

  it('collects the files that exist and names the ones that do not', () => {
    const root = mkdtempSync(join(tmpdir(), 'artpack-'));
    dirs.push(root);
    mkdirSync(join(root, 'enemies'));
    writeFileSync(join(root, 'enemies', 'A b.png'), bytes(1, 2));
    const { found, missing } = collect(root, ['enemies/A b.png', 'enemies/gone.png']);
    expect(found.map((f: { key: string }) => f.key)).toEqual(['enemies/A b.png']);
    expect(missing).toEqual(['enemies/gone.png']);
    expect(readPack(packZip(found)).files.get('enemies/A b.png')).toEqual(bytes(1, 2));
  });
});

/** A store that keeps a pack in memory and counts reads. */
function memoryStore(pack?: PackManifest, blobs: Record<string, Blob> = {}) {
  let manifestHeld: PackManifest | null = pack ?? null;
  let held = new Map(Object.entries(blobs));
  const reads: string[] = [];
  const store: PackStore & { reads: string[]; failReplace: boolean } = {
    reads,
    failReplace: false,
    async readManifest() {
      return manifestHeld;
    },
    async readBlob(key) {
      reads.push(key);
      return held.get(key) ?? null;
    },
    async replace(m, files) {
      if (store.failReplace) throw new Error('quota');
      manifestHeld = m;
      held = new Map(files);
    },
    async clear() {
      manifestHeld = null;
      held = new Map();
    },
  };
  return store;
}

const KEY = 'enemies/Book Monster.png';
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A stored one-file pack for KEY. */
function onePack() {
  const m: PackManifest = { format: 1, made: '2026-11-05T00:00:00.000Z', files: [{ key: KEY, bytes: 3 }] };
  return memoryStore(m, { [KEY]: new Blob([bytes(1, 2, 3)], { type: 'image/png' }) });
}

describe('art pack resolver', () => {
  it('tries the bundle first, then the pack, then nothing', async () => {
    const empty = new ArtPack(memoryStore());
    await empty.ready;
    expect(empty.resolve(KEY, undefined)).toBeNull();
    expect(empty.resolve(KEY, 'bundled.png')).toBe('bundled.png');

    const pack = new ArtPack(onePack());
    await pack.ready;
    expect(pack.resolve(KEY, 'bundled.png')).toBe('bundled.png');
    expect(pack.resolve('enemies/Not In Pack.png', undefined)).toBeNull();
    expect(pack.resolve(KEY, undefined)).toBeNull(); // the Blob is being read
    await flush();
    const url = pack.resolve(KEY, undefined);
    expect(url).toMatch(/^blob:/);
    expect(pack.resolve(KEY, 'bundled.png')).toBe('bundled.png');
    expect(pack.resolve(KEY, '')).toBe(url);
  });

  it('reads a file once, on its first lookup, and nothing at startup but the manifest', async () => {
    const store = onePack();
    const pack = new ArtPack(store);
    await pack.ready;
    expect(store.reads).toEqual([]);
    pack.resolve(KEY, undefined);
    pack.resolve(KEY, undefined);
    await flush();
    pack.resolve(KEY, undefined);
    expect(store.reads).toEqual([KEY]);
    expect(pack.resolve('enemies/Not In Pack.png', undefined)).toBeNull();
    expect(store.reads).toEqual([KEY]);
  });

  it('waits for the startup read and the Blob when asked to', async () => {
    const pack = new ArtPack(onePack());
    expect(await pack.resolveAsync(KEY, undefined)).toMatch(/^blob:/);
    expect(await pack.resolveAsync(KEY, 'bundled.png')).toBe('bundled.png');
    expect(await pack.resolveAsync('enemies/Not In Pack.png', undefined)).toBeNull();
  });

  it('behaves as no pack without a store or when the store fails', async () => {
    const none = new ArtPack(null);
    await none.ready;
    expect(none.loaded).toBe(true);
    expect(none.resolve(KEY, undefined)).toBeNull();
    expect(await none.resolveAsync(KEY, undefined)).toBeNull();
    expect(await none.importFile(blobOf(packZip([{ key: KEY, data: bytes(1) }])))).toEqual({
      ok: false,
      reason: 'storage',
    });

    const broken = new ArtPack({
      ...memoryStore(),
      readManifest: () => Promise.reject(new Error('locked')),
    });
    await broken.ready;
    expect(broken.loaded).toBe(true);
    expect(broken.manifest).toBeNull();
    expect(broken.resolve(KEY, 'bundled.png')).toBe('bundled.png');
  });

  it('imports a pack in place of the old one and revokes the old URLs', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const pack = new ArtPack(onePack());
    await pack.ready;
    pack.resolve(KEY, undefined);
    await flush();
    const old = pack.resolve(KEY, undefined)!;
    const epoch = pack.epoch;

    const next = packZip([{ key: 'icons/new.png', data: bytes(7, 7) }], '2026-12-01T00:00:00.000Z');
    const result = await pack.importFile(blobOf(next));
    expect(result.ok).toBe(true);
    expect(revoke).toHaveBeenCalledWith(old);
    expect(pack.epoch).toBeGreaterThan(epoch);
    expect(pack.manifest?.files.map((f) => f.key)).toEqual(['icons/new.png']);
    expect(pack.resolve(KEY, undefined)).toBeNull();
    pack.resolve('icons/new.png', undefined);
    await flush();
    expect(pack.resolve('icons/new.png', undefined)).toMatch(/^blob:/);
    revoke.mockRestore();
  });

  it('keeps the old pack when the file is not a pack or the write fails', async () => {
    const store = onePack();
    const pack = new ArtPack(store);
    await pack.ready;
    const epoch = pack.epoch;

    expect(await pack.importFile(new Blob(['plain text']))).toEqual({ ok: false, reason: 'not-a-pack' });
    const wrong = zipOf({ [MANIFEST_NAME]: JSON.stringify({ format: 2, made: 'x', files: [] }) });
    expect(await pack.importFile(blobOf(wrong))).toEqual({ ok: false, reason: 'not-a-pack' });

    store.failReplace = true;
    const good = packZip([{ key: 'icons/new.png', data: bytes(1) }]);
    expect(await pack.importFile(blobOf(good))).toEqual({ ok: false, reason: 'storage' });

    expect(pack.epoch).toBe(epoch);
    expect(pack.manifest?.files.map((f) => f.key)).toEqual([KEY]);
    pack.resolve(KEY, undefined);
    await flush();
    expect(pack.resolve(KEY, undefined)).toMatch(/^blob:/);
  });

  it('removes the pack and revokes its URLs', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const pack = new ArtPack(onePack());
    await pack.ready;
    pack.resolve(KEY, undefined);
    await flush();
    const old = pack.resolve(KEY, undefined)!;
    expect(await pack.remove()).toBe(true);
    expect(revoke).toHaveBeenCalledWith(old);
    expect(pack.manifest).toBeNull();
    expect(pack.resolve(KEY, undefined)).toBeNull();
    revoke.mockRestore();
  });

  it('drops a read that finishes after the pack was replaced', async () => {
    const store = onePack();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow: PackStore = {
      ...store,
      readBlob: async (key) => {
        const blob = await store.readBlob(key);
        await gate;
        return blob;
      },
    };
    const pack = new ArtPack(slow);
    await pack.ready;
    const pending = pack.urlAsync(KEY);
    await flush(); // the Blob is read from the store and held back
    await pack.remove();
    release();
    expect(await pending).toBeNull();
    expect(pack.resolve(KEY, undefined)).toBeNull();
  });
});

/** A localStorage stand-in that keeps what it is given. */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
  };
}

/** A storage that refuses every call, as a blocked or full localStorage does. */
const throwingStorage: HintStore = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('full');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

describe('art pack hint', () => {
  it('reads "1" as a stored pack and anything else, or no storage, as none', () => {
    expect(readPackHint(memoryStorage({ [PACK_HINT_KEY]: '1' }))).toBe(true);
    expect(readPackHint(memoryStorage({ [PACK_HINT_KEY]: '0' }))).toBe(false);
    expect(readPackHint(memoryStorage())).toBe(false);
    expect(readPackHint(null)).toBe(false);
    expect(readPackHint(throwingStorage)).toBe(false);
  });

  it('sets and removes the key, and ignores a storage that throws', () => {
    const store = memoryStorage();
    writePackHint(store, true);
    expect(store.getItem(PACK_HINT_KEY)).toBe('1');
    writePackHint(store, false);
    expect(store.getItem(PACK_HINT_KEY)).toBeNull();
    expect(() => writePackHint(throwingStorage, true)).not.toThrow();
    expect(() => writePackHint(throwingStorage, false)).not.toThrow();
    expect(() => writePackHint(null, true)).not.toThrow();
  });

  it('sits outside the save: no save prefix matches it, a hard reset and a load leave it', () => {
    expect(PACK_HINT_KEY.startsWith('ksgproto28')).toBe(false);
    const store = memoryStorage({
      [SAVE_KEY]: '{',
      [`${SAVE_KEY}:backup-v3`]: 'x',
      [`${SAVE_KEY}:recovery-1`]: 'x',
      [PACK_HINT_KEY]: '1',
    });
    clearStorage(store as unknown as Storage);
    expect([...store.data.keys()]).toEqual([PACK_HINT_KEY]);
    expect(loadFromStorage(store as unknown as Storage)).toEqual({ state: null, corrupted: false });
    expect(store.getItem(PACK_HINT_KEY)).toBe('1');
  });

  it('starts from the hint and is corrected by the manifest', async () => {
    // Hint set, nothing stored: believed at once, removed after the read.
    const stale = memoryStorage({ [PACK_HINT_KEY]: '1' });
    const none = new ArtPack(memoryStore(), stale);
    expect(none.hinted).toBe(true);
    await none.ready;
    expect(none.hinted).toBe(false);
    expect(stale.getItem(PACK_HINT_KEY)).toBeNull();

    // Pack stored, no hint: not believed at once, written after the read.
    const missing = memoryStorage();
    const stored = new ArtPack(onePack(), missing);
    expect(stored.hinted).toBe(false);
    await stored.ready;
    expect(stored.hinted).toBe(true);
    expect(missing.getItem(PACK_HINT_KEY)).toBe('1');
  });

  it('writes nothing when the hint already agrees', async () => {
    const store = memoryStorage({ [PACK_HINT_KEY]: '1' });
    const writes = vi.spyOn(store, 'setItem');
    const removes = vi.spyOn(store, 'removeItem');
    await new ArtPack(onePack(), store).ready;
    await new ArtPack(memoryStore(), memoryStorage()).ready;
    expect(writes).not.toHaveBeenCalled();
    expect(removes).not.toHaveBeenCalled();
  });

  it('leaves the hint as it was when the manifest cannot be read', async () => {
    const store = memoryStorage({ [PACK_HINT_KEY]: '1' });
    const broken = new ArtPack({ ...memoryStore(), readManifest: () => Promise.reject(new Error('locked')) }, store);
    await broken.ready;
    expect(broken.hinted).toBe(true);
    expect(store.getItem(PACK_HINT_KEY)).toBe('1');
  });

  it('removes the hint on a page with no IndexedDB, where no pack can be reached', async () => {
    const store = memoryStorage({ [PACK_HINT_KEY]: '1' });
    const noStore = new ArtPack(null, store);
    await noStore.ready;
    expect(noStore.hinted).toBe(false);
    expect(store.getItem(PACK_HINT_KEY)).toBeNull();
  });

  it('is set by an import, removed by a removal and kept by a failed import', async () => {
    const store = memoryStorage();
    const mem = memoryStore();
    const pack = new ArtPack(mem, store);
    await pack.ready;
    expect(pack.hinted).toBe(false);

    expect(await pack.importFile(new Blob(['plain text']))).toEqual({ ok: false, reason: 'not-a-pack' });
    expect(store.getItem(PACK_HINT_KEY)).toBeNull();
    mem.failReplace = true;
    const good = packZip([{ key: KEY, data: bytes(1) }]);
    expect(await pack.importFile(blobOf(good))).toEqual({ ok: false, reason: 'storage' });
    expect(pack.hinted).toBe(false);
    expect(store.getItem(PACK_HINT_KEY)).toBeNull();

    mem.failReplace = false;
    expect((await pack.importFile(blobOf(good))).ok).toBe(true);
    expect(pack.hinted).toBe(true);
    expect(store.getItem(PACK_HINT_KEY)).toBe('1');

    // A removal the storage refused keeps the pack, so it keeps the hint.
    const refusing = new ArtPack({ ...onePack(), clear: () => Promise.reject(new Error('locked')) }, store);
    await refusing.ready;
    expect(await refusing.remove()).toBe(false);
    expect(store.getItem(PACK_HINT_KEY)).toBe('1');

    expect(await pack.remove()).toBe(true);
    expect(pack.hinted).toBe(false);
    expect(store.getItem(PACK_HINT_KEY)).toBeNull();
  });

  it('does not stop an import or a removal when localStorage throws', async () => {
    const pack = new ArtPack(memoryStore(), throwingStorage);
    await pack.ready;
    expect((await pack.importFile(blobOf(packZip([{ key: KEY, data: bytes(1) }])))).ok).toBe(true);
    expect(pack.manifest?.files.length).toBe(1);
    expect(await pack.remove()).toBe(true);
    expect(pack.manifest).toBeNull();
  });
});

describe('map layout guess', () => {
  const mapOf = (...keys: string[]): TileMapDef => ({
    width: 1,
    height: 1,
    tile: 16,
    tilesets: keys.map((key, i) => ({ key, columns: 1, firstgid: i + 1, tilecount: 1 })),
    layers: [],
  });

  /** A hint set for the duration of `body`. */
  function withHint(hinted: boolean, body: () => void) {
    const before = artPack.hinted;
    artPack.hinted = hinted;
    try {
      body();
    } finally {
      artPack.hinted = before;
    }
  }

  it('expects no sheets when the build bundles none and the hint says no pack', () => {
    withHint(false, () => {
      expect(expectsNoSheets(mapOf('no_such_pack/a.png'))).toBe(true);
      expect(expectsNoSheets(mapOf())).toBe(true);
    });
  });

  it('expects the pack to supply them when the hint says one is stored', () => {
    withHint(true, () => expect(expectsNoSheets(mapOf('no_such_pack/a.png'))).toBe(false));
  });

  it('expects a draw when any sheet of the map is bundled', () => {
    const bundled = Object.keys(SHEETS)[0];
    if (!bundled) return; // A checkout without the tile packs bundles nothing.
    const [packKey, prefix] = Object.entries(PACKS).find(([, p]) => bundled.startsWith(p))!;
    const key = `${packKey}/${bundled.slice(prefix.length)}`;
    withHint(false, () => {
      expect(expectsNoSheets(mapOf(key))).toBe(false);
      expect(expectsNoSheets(mapOf('no_such_pack/a.png', key))).toBe(false);
    });
  });
});
