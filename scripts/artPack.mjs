// Writes art-pack/frontier-idle-art.zip: the licensed art this checkout's
// generated lists name, for the game's Import art pack button
// (docs/ART_PACK.md).
//
//   npm run art-pack                          pack src/assets
//   npm run art-pack -- --from <assets dir>   pack another checkout's art
//
// The wanted files are the path literals in the glob calls of
// src/ui/lib/enemyArt.gen.ts, src/ui/lib/icons/art.gen.ts and
// src/ui/lib/tilemaps/sheets.gen.ts. A file's key is its path relative to
// src/assets, forward slashes. `--from` only reads. The zip is gitignored
// (art-pack/): it holds licensed pixels and goes only to the user's own devices.
//
// Loads src/ui/lib/artPack/format.ts, the module the game unzips with, through
// node's type stripping (node 22.18 or later).

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { packZip } from '../src/ui/lib/artPack/format.ts';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, '..');
export const OUT_PATH = join(ROOT, 'art-pack', 'frontier-idle-art.zip');

/** The generated lists, each with the directory its glob paths are relative to. */
export const LISTS = [
  { file: 'src/ui/lib/enemyArt.gen.ts', dir: 'src/ui/lib' },
  { file: 'src/ui/lib/icons/art.gen.ts', dir: 'src/ui/lib/icons' },
  { file: 'src/ui/lib/tilemaps/sheets.gen.ts', dir: 'src/ui/lib/tilemaps' },
];

/**
 * The keys a generated list asks for: each string literal in the array of its
 * `import.meta.glob(` call, resolved against `dir` (posix, relative to the
 * repo root) to a path under src/assets. Other literals in the file (the
 * PACKS table) are not in that array and are skipped.
 */
export function globKeys(source, dir) {
  const call = source.indexOf('import.meta.glob(');
  const open = call < 0 ? -1 : source.indexOf('[', call);
  if (open < 0) throw new Error(`no import.meta.glob([...]) call in ${dir}`);
  const keys = [];
  const token = /"((?:[^"\\]|\\.)*)"|\]/g;
  token.lastIndex = open + 1;
  for (let m = token.exec(source); m && m[0] !== ']'; m = token.exec(source)) {
    const path = posix.normalize(posix.join(dir, JSON.parse(m[0])));
    if (!path.startsWith('src/assets/')) throw new Error(`${m[0]} in ${dir} leaves src/assets`);
    keys.push(path.slice('src/assets/'.length));
  }
  return keys;
}

/** Every key the three generated lists ask for, sorted, without repeats. */
export function wantedKeys(root = ROOT) {
  const keys = new Set();
  for (const { file, dir } of LISTS) {
    for (const key of globKeys(readFileSync(join(root, file), 'utf8'), dir)) keys.add(key);
  }
  return [...keys].sort();
}

/** Read the wanted files from `assets`: the ones found, and the keys not on disk. */
export function collect(assets, keys) {
  const found = [];
  const missing = [];
  for (const key of keys) {
    const path = join(assets, ...key.split('/'));
    if (existsSync(path) && statSync(path).isFile()) found.push({ key, data: readFileSync(path) });
    else missing.push(key);
  }
  return { found, missing };
}

function parseFrom(argv) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--from') {
      if (!argv[i + 1]) throw new Error('--from needs a directory');
      return argv[i + 1];
    }
    if (argv[i].startsWith('--from=')) return argv[i].slice('--from='.length);
    throw new Error(`unknown argument: ${argv[i]}`);
  }
  return null;
}

function main() {
  const from = parseFrom(process.argv.slice(2));
  const assets = from ? resolve(from) : join(ROOT, 'src', 'assets');
  if (!existsSync(assets) || !statSync(assets).isDirectory()) throw new Error(`not a directory: ${assets}`);
  const wanted = wantedKeys();
  const { found, missing } = collect(assets, wanted);
  console.log(`Assets: ${assets}`);
  console.log(`Wanted: ${wanted.length}`);
  console.log(`Missing: ${missing.length}`);
  for (const key of missing) console.log(`  ${key}`);
  if (found.length === 0) throw new Error('none of the wanted files is on disk; no zip written');
  const bytes = found.reduce((sum, f) => sum + f.data.length, 0);
  const zip = packZip(found);
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, zip);
  console.log(`Files: ${found.length}`);
  console.log(`Size: ${(bytes / 1048576).toFixed(2)} MB`);
  console.log(`Wrote: ${relative(process.cwd(), OUT_PATH) || OUT_PATH}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (e) {
    console.error(`art-pack: ${e.message}`);
    process.exitCode = 1;
  }
}
