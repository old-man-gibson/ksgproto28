/**
 * The art pack file format (docs/ART_PACK.md): a zip of the licensed art the
 * game uses, plus a manifest. Shared by `npm run art-pack` (scripts/artPack.mjs,
 * plain node, which loads this file with node's type stripping) and the game's
 * Import art pack button, so both sides read and write one format.
 *
 * Keep this file to syntax node can strip (no enums, namespaces or parameter
 * properties) and to imports that resolve without a bundler (fflate only).
 *
 * A zip holds `manifest.json` and each file under its key: the path relative
 * to src/assets, forward slashes (`enemies/Book Monster.png`). Files are
 * stored without compression; the PNGs are compressed already.
 */
import { unzipSync, zipSync } from 'fflate';

/** The only manifest format there is. A reader rejects anything else. */
export const ART_PACK_FORMAT = 1;

/** Name of the manifest entry inside the zip. */
export const MANIFEST_NAME = 'manifest.json';

export interface PackEntry {
  /** Path relative to src/assets, forward slashes. */
  key: string;
  /** Size of the file in bytes. */
  bytes: number;
}

export interface PackManifest {
  format: 1;
  /** ISO date-time the zip was made. */
  made: string;
  files: PackEntry[];
}

/** A zip that is not an art pack; the message says which check failed. */
export class ArtPackError extends Error {}

/** One file to pack: its key and its bytes. */
export interface PackInput {
  key: string;
  data: Uint8Array;
}

/** The zip for a list of files: manifest first, then each file, sorted by key, stored. */
export function packZip(inputs: readonly PackInput[], made: string = new Date().toISOString()): Uint8Array {
  const sorted = [...inputs].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const manifest: PackManifest = {
    format: ART_PACK_FORMAT,
    made,
    files: sorted.map((f) => ({ key: f.key, bytes: f.data.length })),
  };
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {
    [MANIFEST_NAME]: [new TextEncoder().encode(JSON.stringify(manifest, null, 2)), { level: 0 }],
  };
  const seen = new Set<string>([MANIFEST_NAME]);
  for (const f of sorted) {
    if (seen.has(f.key)) throw new ArtPackError(`reserved or duplicate key: ${f.key}`);
    seen.add(f.key);
    entries[f.key] = [f.data, { level: 0 }];
  }
  return zipSync(entries);
}

export interface ReadPack {
  manifest: PackManifest;
  /** Bytes by key; exactly the manifest's keys. */
  files: Map<string, Uint8Array>;
}

/**
 * Unzip and check a pack: it is a zip, it has a manifest of format 1, and every
 * manifest key is in the zip at the size the manifest states. Throws
 * ArtPackError otherwise. Files the manifest does not list are dropped.
 */
export function readPack(zip: Uint8Array): ReadPack {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zip);
  } catch {
    throw new ArtPackError('not a zip file');
  }
  const raw = Object.hasOwn(entries, MANIFEST_NAME) ? entries[MANIFEST_NAME] : undefined;
  if (!raw) throw new ArtPackError(`${MANIFEST_NAME} is missing`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new ArtPackError(`${MANIFEST_NAME} is not JSON`);
  }
  const manifest = checkManifest(parsed);
  const files = new Map<string, Uint8Array>();
  for (const { key, bytes } of manifest.files) {
    const data = Object.hasOwn(entries, key) ? entries[key] : undefined;
    if (!data) throw new ArtPackError(`missing from the zip: ${key}`);
    if (data.length !== bytes) throw new ArtPackError(`size differs from the manifest: ${key}`);
    if (files.has(key)) throw new ArtPackError(`duplicate key: ${key}`);
    files.set(key, data);
  }
  return { manifest, files };
}

/** The manifest, checked for shape and format; throws ArtPackError. */
export function checkManifest(value: unknown): PackManifest {
  const m = value as Partial<PackManifest> | null;
  if (!m || typeof m !== 'object') throw new ArtPackError(`${MANIFEST_NAME} is not an object`);
  if (m.format !== ART_PACK_FORMAT) throw new ArtPackError(`format ${String(m.format)} is not ${ART_PACK_FORMAT}`);
  if (typeof m.made !== 'string') throw new ArtPackError('made is not a string');
  if (!Array.isArray(m.files)) throw new ArtPackError('files is not a list');
  for (const f of m.files) {
    if (!f || typeof f.key !== 'string' || !f.key || typeof f.bytes !== 'number') {
      throw new ArtPackError('a files entry lacks a key or bytes');
    }
  }
  return m as PackManifest;
}

/** `Art pack: 61 files, made 2026-11-05.` or `Art pack: none.` */
export function describePack(manifest: PackManifest | null): string {
  if (!manifest) return 'Art pack: none.';
  const n = manifest.files.length;
  return `Art pack: ${n} ${n === 1 ? 'file' : 'files'}, made ${manifest.made.slice(0, 10)}.`;
}

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

/** The media type for a key, by extension. */
export function mimeOf(key: string): string {
  return MIME[key.slice(key.lastIndexOf('.') + 1).toLowerCase()] ?? 'application/octet-stream';
}
