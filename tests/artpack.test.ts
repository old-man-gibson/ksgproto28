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
import { ArtPack } from '../src/ui/lib/artPack/artPack.svelte';
import type { PackStore } from '../src/ui/lib/artPack/store';
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
