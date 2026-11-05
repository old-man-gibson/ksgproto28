import { mimeOf, readPack, type PackManifest } from './format';
import { idbStore, type PackStore } from './store';

/**
 * The imported art pack, as the UI sees it (docs/ART_PACK.md). Art the build
 * lacks (the licensed art is gitignored; a CI build has none) is looked up
 * here by key: the path relative to src/assets (`enemies/Book Monster.png`).
 *
 * The one resolver for enemy portraits, icons and tile sheets is `resolveArt`
 * (and `resolveArtAsync`): the bundled URL first, the pack's URL second,
 * null third. A caller treats null as before (emoji, node diagram).
 *
 * Startup reads the manifest only. A file's Blob is read on its first lookup
 * and turned into an object URL, which lands in `urls`; components that asked
 * re-render then. A lookup never writes state itself (it can run inside a
 * template or a `$derived`): state is written only when a read completes.
 * With no IndexedDB, no pack or a storage error, every lookup returns null.
 */

export type ImportResult =
  | { ok: true; manifest: PackManifest }
  | { ok: false; reason: 'not-a-pack' | 'storage' };

/** How long a lookup that waits for the pack waits for the startup read. */
const STARTUP_WAIT_MS = 4000;

interface Stored {
  manifest: PackManifest;
  keys: ReadonlySet<string>;
}

export class ArtPack {
  /** The stored pack, or null: none stored, not read yet, or no storage. */
  private current = $state.raw<Stored | null>(null);
  /** Object URL by key, for the files read so far. */
  private urls = $state<Record<string, string>>({});
  /** True once the startup read of the manifest has finished, found or not. */
  loaded = $state(false);
  /**
   * Counts the times an import or a removal replaced the pack. Anything that
   * keeps a result from a lookup (a decoded tile sheet) reads this and drops
   * the result when it changes.
   */
  epoch = $state(0);
  /** Resolves when the startup read has finished. */
  readonly ready: Promise<void>;

  private store: PackStore | null;
  private generation = 0;
  private reads = new Map<string, Promise<string | null>>();

  constructor(store: PackStore | null) {
    this.store = store;
    this.ready = this.start();
  }

  /** The stored manifest, or null. */
  get manifest(): PackManifest | null {
    return this.current?.manifest ?? null;
  }

  /**
   * Read the manifest. A broken database behaves as no pack. A database that
   * never answers (some browsers hang on a first `indexedDB.open`) is waited
   * for `STARTUP_WAIT_MS`; a manifest that arrives later still takes effect.
   */
  private async start(): Promise<void> {
    const generation = this.generation;
    const read = (async () => (await this.store?.readManifest()) ?? null)().then(
      (manifest) => {
        if (generation !== this.generation) return;
        this.setCurrent(manifest);
        // Past the wait, tile sheets already resolved to null: have them asked again.
        if (this.loaded && manifest) this.bump();
      },
      () => {},
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([read, new Promise<void>((resolve) => (timer = setTimeout(resolve, STARTUP_WAIT_MS)))]);
    clearTimeout(timer);
    this.loaded = true;
  }

  private setCurrent(manifest: PackManifest | null) {
    this.current = manifest ? { manifest, keys: new Set(manifest.files.map((f) => f.key)) } : null;
  }

  /**
   * The object URL of a stored file, or null when it is not stored or its
   * Blob has not been read yet (the read starts here; the URL arrives in
   * `urls`, which re-runs whatever read it).
   */
  url(key: string): string | null {
    const stored = this.current;
    if (!stored || !stored.keys.has(key)) return null;
    const url = this.urls[key];
    if (url) return url;
    void this.read(key);
    return null;
  }

  /** `url`, waiting for the startup read and for the Blob. */
  async urlAsync(key: string): Promise<string | null> {
    await this.ready;
    const stored = this.current;
    if (!stored || !stored.keys.has(key)) return null;
    return this.urls[key] ?? (await this.read(key));
  }

  private read(key: string): Promise<string | null> {
    let read = this.reads.get(key);
    if (!read) {
      read = this.load(key, this.generation);
      this.reads.set(key, read);
    }
    return read;
  }

  private async load(key: string, generation: number): Promise<string | null> {
    try {
      const blob = await this.store?.readBlob(key);
      if (!blob || generation !== this.generation) return null;
      const url = URL.createObjectURL(blob);
      this.urls[key] = url;
      return url;
    } catch {
      return null;
    }
  }

  /** The art for a key: the bundled URL when the build has the file, else the pack's, else null. */
  resolve(key: string, bundled: string | null | undefined): string | null {
    return bundled || this.url(key);
  }

  /** `resolve`, for a caller that can wait. */
  resolveAsync(key: string, bundled: string | null | undefined): Promise<string | null> {
    return bundled ? Promise.resolve(bundled) : this.urlAsync(key);
  }

  /**
   * Unzip a file, check it and store it in place of the old pack. A file that
   * is not an art pack, or a failed write, leaves the old pack as it was.
   */
  async importFile(file: Blob): Promise<ImportResult> {
    let pack;
    try {
      pack = readPack(new Uint8Array(await file.arrayBuffer()));
    } catch {
      return { ok: false, reason: 'not-a-pack' };
    }
    if (!this.store) return { ok: false, reason: 'storage' };
    const blobs = new Map<string, Blob>();
    for (const [key, data] of pack.files) blobs.set(key, new Blob([data as BlobPart], { type: mimeOf(key) }));
    try {
      await this.store.replace(pack.manifest, blobs);
    } catch {
      return { ok: false, reason: 'storage' };
    }
    keepStorage();
    this.swap(pack.manifest);
    return { ok: true, manifest: pack.manifest };
  }

  /** Delete the stored pack. False when the storage refused. */
  async remove(): Promise<boolean> {
    try {
      await this.store?.clear();
    } catch {
      return false;
    }
    this.swap(null);
    return true;
  }

  /** Make `manifest` the pack: revoke every object URL and forget what was read. */
  private swap(manifest: PackManifest | null) {
    for (const url of Object.values(this.urls)) URL.revokeObjectURL(url);
    this.urls = {};
    this.reads.clear();
    this.setCurrent(manifest);
    this.bump();
  }

  /** The pack changed: drop reads in flight (they check the generation) and tell the epoch's readers. */
  private bump() {
    this.generation++;
    this.epoch = this.generation;
  }
}

/** Ask the browser to keep the storage when space runs short. The answer is not used. */
function keepStorage() {
  try {
    if (typeof navigator !== 'undefined') void Promise.resolve(navigator.storage?.persist?.()).catch(() => {});
  } catch {
    // Not available here.
  }
}

/** The pack of this page, backed by IndexedDB (none where the page has none). */
export const artPack = new ArtPack(idbStore());

/** The one resolver: the bundled URL, else the pack's URL, else null. */
export function resolveArt(key: string, bundled: string | null | undefined): string | null {
  return artPack.resolve(key, bundled);
}

/** `resolveArt` for a caller that can wait for the pack (tile sheets, drawn off the template). */
export function resolveArtAsync(key: string, bundled: string | null | undefined): Promise<string | null> {
  return artPack.resolveAsync(key, bundled);
}
