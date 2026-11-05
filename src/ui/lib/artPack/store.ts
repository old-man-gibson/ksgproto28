import { checkManifest, type PackManifest } from './format';

/**
 * Where an imported art pack lives: the IndexedDB database `frontier-idle-art`
 * of the page's origin, apart from the save (which is localStorage; nothing
 * here reads or writes it). Two object stores: `files` (key → Blob) and
 * `meta` (`manifest` → the pack's manifest).
 *
 * `PackStore` is the seam the reactive layer (artPack.svelte.ts) talks to, so
 * the tests can give it a store of their own. Every method may reject (no
 * quota, a locked database): the callers treat that as "no pack".
 */
export interface PackStore {
  /** The stored manifest, or null when no pack is stored. */
  readManifest(): Promise<PackManifest | null>;
  /** One stored file, or null when the key is not stored. */
  readBlob(key: string): Promise<Blob | null>;
  /** Replace the whole pack: old files out, new files and manifest in, in one transaction. */
  replace(manifest: PackManifest, files: ReadonlyMap<string, Blob>): Promise<void>;
  /** Delete every stored file and the manifest. */
  clear(): Promise<void>;
}

const DB_NAME = 'frontier-idle-art';
const FILES = 'files';
const META = 'meta';
const MANIFEST_KEY = 'manifest';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function finished(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
  });
}

/** The IndexedDB-backed store, or null when this page has no IndexedDB. */
export function idbStore(): PackStore | null {
  if (typeof indexedDB === 'undefined') return null;
  let opening: Promise<IDBDatabase> | null = null;

  function open(): Promise<IDBDatabase> {
    if (!opening) {
      opening = new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore(FILES);
          req.result.createObjectStore(META);
        };
        req.onsuccess = () => {
          const db = req.result;
          // Let another tab upgrade or delete the database; reopen on next use.
          db.onversionchange = () => {
            db.close();
            opening = null;
          };
          db.onclose = () => (opening = null);
          resolve(db);
        };
        req.onerror = () => reject(req.error);
      });
      opening.catch(() => (opening = null));
    }
    return opening;
  }

  return {
    async readManifest() {
      const db = await open();
      const value = await request(db.transaction(META, 'readonly').objectStore(META).get(MANIFEST_KEY));
      if (value === undefined) return null;
      try {
        return checkManifest(value);
      } catch {
        return null;
      }
    },

    async readBlob(key) {
      const db = await open();
      const value = await request(db.transaction(FILES, 'readonly').objectStore(FILES).get(key));
      return value instanceof Blob ? value : null;
    },

    async replace(manifest, files) {
      const db = await open();
      const tx = db.transaction([FILES, META], 'readwrite');
      const done = finished(tx);
      try {
        const store = tx.objectStore(FILES);
        store.clear();
        tx.objectStore(META).clear();
        for (const [key, blob] of files) store.put(blob, key);
        tx.objectStore(META).put(manifest, MANIFEST_KEY);
      } catch (e) {
        tx.abort();
        await done.catch(() => {});
        throw e;
      }
      await done;
    },

    async clear() {
      const db = await open();
      const tx = db.transaction([FILES, META], 'readwrite');
      tx.objectStore(FILES).clear();
      tx.objectStore(META).clear();
      await finished(tx);
    },
  };
}
