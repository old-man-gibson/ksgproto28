/**
 * The forge's side of drawn maps: what the packs contain, and how a region's
 * map is written.
 *
 * Three files per map, all tool-owned (docs/TILEMAPS.md):
 *
 * - `src/ui/lib/tilemaps/<region>.map.json` — the map, reprinted WHOLE on
 *   every apply that touches it. The one place the forge does not edit
 *   surgically: the file carries no hand comments, so there is nothing a
 *   reprint could destroy, and a grid diffs by row anyway.
 * - `maps.gen.ts` — the region → map registry the game imports.
 * - `sheets.gen.ts` — the sheet glob: only sheets some map draws from are
 *   build inputs, and the pack folders are gitignored (AUTHORSHIP §9), so a
 *   checkout without them still builds.
 *
 * Nothing here is cached: the pack folders and the map files are the truth,
 * and a scan reads them fresh.
 */
import fs from 'node:fs';
import path from 'node:path';
import { packKeyOf } from '../../src/ui/lib/tilemaps/packkey';
import type { TileMapDef } from '../../src/ui/lib/tilemaps/types';
import { parseTmx, parseTsx, pngSize, relPosix, type TilesetInfo, type TmxMap } from './tmx';

export const PACKS_DIR = 'src/assets/tilemaps';
export const MAPS_DIR = 'src/ui/lib/tilemaps';
export const MAPS_GEN = `${MAPS_DIR}/maps.gen.ts`;
export const SHEETS_GEN = `${MAPS_DIR}/sheets.gen.ts`;

/** Region ids are file names here, so only the id grammar gets to be one. */
const SAFE_ID = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

export function mapFileFor(region: string): string {
  if (!SAFE_ID.test(region)) throw new Error(`Not a usable region id for a map file: ${region}`);
  return `${MAPS_DIR}/${region}.map.json`;
}

export function isTileFile(rel: string): boolean {
  const posix = rel.split(path.sep).join('/');
  return posix === MAPS_GEN || posix === SHEETS_GEN || /^src\/ui\/lib\/tilemaps\/[a-z0-9_]+\.map\.json$/.test(posix);
}

// ---------- Packs ----------

export interface SheetInfo {
  /** `<packKey>/<path>` — what a map's `tilesets[].key` holds. */
  key: string;
  name: string;
  path: string;
  columns: number;
  tilecount: number;
  tileWidth: number;
  image: { w: number; h: number } | null;
  /** Dev-server URL of the pixels. */
  url: string;
  animations: TilesetInfo['animations'];
  wangsets: TilesetInfo['wangsets'];
  /** Came from a `.tsx` (geometry authoritative) rather than a bare `.png`. */
  tiled: boolean;
}

export interface ExampleInfo {
  name: string;
  /** Relative to the pack folder. */
  path: string;
  width: number;
  height: number;
  layers: string[];
}

export interface PackInfo {
  key: string;
  /** Folder name under PACKS_DIR. */
  dir: string;
  sheets: SheetInfo[];
  /** Image-collection tilesets, listed so the palette can say why they are absent. */
  collections: string[];
  examples: ExampleInfo[];
  /** Automapping rule maps, relative to the pack folder. */
  rules: string[];
}

/** Folders that hold demos and characters, not tiles. */
const SKIP_DIR = /mockup|character|npc/i;
/** Paths (relative to the pack) not worth offering as bare sheets. */
const BARE_SKIP = /sprite|individual|animat|premade|mockup/i;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIR.test(entry.name)) walk(full, out);
    } else out.push(full);
  }
  return out;
}

export function sheetUrl(dir: string, rel: string): string {
  return `/${PACKS_DIR}/${[dir, ...rel.split('/')].map(encodeURIComponent).join('/')}`;
}

/**
 * Everything the palette needs to know about one pack folder. `base` is the
 * folder holding the packs — PACKS_DIR under the project root unless a test
 * points somewhere else.
 */
export function scanPack(rootDir: string, dir: string, base = path.join(rootDir, PACKS_DIR)): PackInfo {
  const packDir = path.join(base, dir);
  const key = packKeyOf(dir);
  const files = walk(packDir);
  const sheets = new Map<string, SheetInfo>();
  const collections: string[] = [];
  for (const tsxPath of files.filter((f) => f.toLowerCase().endsWith('.tsx'))) {
    const info = parseTsx(fs.readFileSync(tsxPath, 'utf8'), tsxPath, packDir);
    if (info.collection || !info.image) {
      collections.push(info.name);
      continue;
    }
    if (sheets.has(info.image)) continue;
    sheets.set(info.image, {
      key: `${key}/${info.image}`,
      name: info.name,
      path: info.image,
      columns: info.columns,
      tilecount: info.tilecount,
      tileWidth: info.tileWidth,
      image: info.imageSize,
      url: sheetUrl(dir, info.image),
      animations: info.animations,
      wangsets: info.wangsets,
      tiled: true,
    });
  }
  // Sheets no .tsx describes — the Grass Land fortress parts, for one — are
  // still tiles if they are cut on a 32 grid. Geometry from the PNG header.
  // Folders of individual sprites and animation strips are skipped: they are
  // cut on the grid too, but one file per prop is not a sheet.
  for (const png of files.filter((f) => f.toLowerCase().endsWith('.png'))) {
    const rel = relPosix(packDir, png);
    if (sheets.has(rel) || BARE_SKIP.test(rel)) continue;
    const size = pngSize(png);
    if (!size || size.w % 32 || size.h % 32 || size.w < 128 || size.h < 96) continue;
    sheets.set(rel, {
      key: `${key}/${rel}`,
      name: path.basename(rel, '.png'),
      path: rel,
      columns: size.w / 32,
      tilecount: (size.w / 32) * (size.h / 32),
      tileWidth: 32,
      image: size,
      url: sheetUrl(dir, rel),
      animations: {},
      wangsets: [],
      tiled: false,
    });
  }
  const examples: ExampleInfo[] = [];
  const rules: string[] = [];
  for (const tmxPath of files.filter((f) => f.toLowerCase().endsWith('.tmx'))) {
    const rel = relPosix(packDir, tmxPath);
    if (/(^|\/)rules\//i.test(rel)) {
      rules.push(rel);
      continue;
    }
    try {
      const text = fs.readFileSync(tmxPath, 'utf8');
      const head = /<map ([^>]*)>/.exec(text)?.[1] ?? '';
      examples.push({
        name: path.basename(rel, '.tmx'),
        path: rel,
        width: Number(/\bwidth="(\d+)"/.exec(head)?.[1] ?? 0),
        height: Number(/\bheight="(\d+)"/.exec(head)?.[1] ?? 0),
        layers: [...text.matchAll(/<layer [^>]*\bname="([^"]*)"/g)].map((m) => m[1]),
      });
    } catch {
      /* an example that will not parse is simply not offered */
    }
  }
  return {
    key,
    dir,
    // Tiled-described sheets first: their geometry is the artist's, and they
    // are the ones the example maps and rules draw from.
    sheets: [...sheets.values()].sort((a, b) => Number(b.tiled) - Number(a.tiled) || a.path.localeCompare(b.path)),
    collections,
    examples: examples.sort((a, b) => a.path.localeCompare(b.path)),
    rules: rules.sort(),
  };
}

export function scanPacks(rootDir: string): PackInfo[] {
  const base = path.join(rootDir, PACKS_DIR);
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => scanPack(rootDir, e.name))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** One example (or rule) map of a pack, with sheet keys the map file grammar understands. */
export function readPackTmx(rootDir: string, dir: string, rel: string): TmxMap {
  if (rel.includes('..')) throw new Error('Bad map path');
  const packDir = path.join(rootDir, PACKS_DIR, dir);
  const file = path.join(packDir, ...rel.split('/'));
  return parseTmx(fs.readFileSync(file, 'utf8'), file, packDir, packKeyOf(dir));
}

// ---------- Map files ----------

/** Every `<region>.map.json` on disk, by region. */
export function readMaps(rootDir: string): Record<string, TileMapDef> {
  const dir = path.join(rootDir, MAPS_DIR);
  const out: Record<string, TileMapDef> = {};
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const m = /^([a-z0-9_]+)\.map\.json$/.exec(name);
    if (!m) continue;
    out[m[1]] = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as TileMapDef;
  }
  return out;
}

/**
 * The map as text: one gid row per line, so a paint diffs as the rows it
 * touched, and everything else at JSON's ordinary indentation.
 */
export function printMap(map: TileMapDef): string {
  const lines: string[] = ['{'];
  lines.push(`  "width": ${map.width},`);
  lines.push(`  "height": ${map.height},`);
  lines.push(`  "tile": ${map.tile},`);
  lines.push('  "tilesets": [');
  map.tilesets.forEach((t, i) => {
    lines.push(
      `    { "key": ${JSON.stringify(t.key)}, "columns": ${t.columns}, "firstgid": ${t.firstgid}, "tilecount": ${t.tilecount} }${i < map.tilesets.length - 1 ? ',' : ''}`,
    );
  });
  lines.push('  ],');
  lines.push('  "layers": [');
  map.layers.forEach((layer, li) => {
    lines.push('    {');
    lines.push(`      "name": ${JSON.stringify(layer.name)},`);
    lines.push('      "data": [');
    layer.data.forEach((row, ri) => {
      lines.push(`        [${row.join(',')}]${ri < layer.data.length - 1 ? ',' : ''}`);
    });
    lines.push('      ]');
    lines.push(`    }${li < map.layers.length - 1 ? ',' : ''}`);
  });
  const hasMeta = map.meta && Object.keys(map.meta).length > 0;
  lines.push(`  ]${hasMeta ? ',' : ''}`);
  if (hasMeta) {
    const meta = JSON.stringify(map.meta, null, 2).split('\n');
    lines.push(`  "meta": ${meta[0]}`);
    for (const l of meta.slice(1)) lines.push(`  ${l}`);
  }
  lines.push('}');
  return lines.join('\n') + '\n';
}

/** The `TILEMAPS` registry module for the given regions (sorted, stable). */
export function genMapsModule(regions: string[]): string {
  const ids = [...regions].sort();
  const lines = [
    '// Generated by the forge (forge/server/tilemaps.ts) — one line per drawn region.',
    '// Do not edit: create or delete a map in the forge\'s Tiles mode instead.',
    "import type { TileMapDef } from './types';",
  ];
  for (const id of ids) lines.push(`import ${id.toUpperCase()}_MAP from './${id}.map.json';`);
  lines.push('');
  lines.push('export const TILEMAPS: Record<string, TileMapDef> = {');
  for (const id of ids) lines.push(`  ${id}: ${id.toUpperCase()}_MAP as TileMapDef,`);
  lines.push('};');
  return lines.join('\n') + '\n';
}

/**
 * The sheet glob module: every sheet any map draws from, grouped by pack,
 * with the pack folder each key resolved to at generation time.
 */
export function genSheetsModule(maps: Record<string, TileMapDef>, packDirs: Record<string, string>): string {
  const byPack = new Map<string, Set<string>>();
  for (const map of Object.values(maps)) {
    for (const t of map.tilesets) {
      const slash = t.key.indexOf('/');
      const pack = t.key.slice(0, slash);
      const set = byPack.get(pack) ?? new Set<string>();
      set.add(t.key.slice(slash + 1));
      byPack.set(pack, set);
    }
  }
  const packs = [...byPack.keys()].sort();
  const lines = [
    '// Generated by the forge (forge/server/tilemaps.ts): the sheets the drawn maps use,',
    '// and the pack folder each pack key resolved to. Only globbed sheets are build inputs;',
    '// the pack folders are gitignored (docs/AUTHORSHIP.md §9). Do not edit — paint in the forge.',
    '',
    '/** Pack key → glob prefix of its folder. */',
    'export const PACKS: Record<string, string> = {',
  ];
  const missing: string[] = [];
  for (const pack of packs) {
    const dir = packDirs[pack];
    if (!dir) {
      missing.push(pack);
      continue;
    }
    lines.push(`  ${JSON.stringify(pack)}: ${JSON.stringify(`../../../assets/tilemaps/${dir}/`)},`);
  }
  lines.push('};');
  if (missing.length) {
    lines.push('');
    lines.push(`// Packs no folder under ${PACKS_DIR} matched when this was generated: ${missing.join(', ')}.`);
    lines.push('// Their maps fall back to the node diagram until the pack is present and a map is re-applied.');
  }
  lines.push('');
  lines.push('export const SHEETS = import.meta.glob(');
  lines.push('  [');
  for (const pack of packs) {
    const dir = packDirs[pack];
    if (!dir) continue;
    for (const rel of [...byPack.get(pack)!].sort()) {
      lines.push(`    ${JSON.stringify(`../../../assets/tilemaps/${dir}/${rel}`)},`);
    }
  }
  lines.push('  ],');
  lines.push("  { query: '?url', import: 'default' },");
  lines.push(') as Record<string, () => Promise<string>>;');
  return lines.join('\n') + '\n';
}

/** Pack key → folder, from the folders that are actually present. */
export function packDirs(rootDir: string): Record<string, string> {
  const base = path.join(rootDir, PACKS_DIR);
  const out: Record<string, string> = {};
  if (!fs.existsSync(base)) return out;
  for (const e of fs.readdirSync(base, { withFileTypes: true })) {
    if (e.isDirectory()) out[packKeyOf(e.name)] = e.name;
  }
  return out;
}

/** Sanity for a map about to be written: shape and gid ranges. */
export function mapProblems(map: TileMapDef): string[] {
  const problems: string[] = [];
  if (!Number.isInteger(map.width) || map.width < 1 || !Number.isInteger(map.height) || map.height < 1) {
    problems.push('width and height must be positive integers');
  }
  if (![16, 32, 48, 64].includes(map.tile)) problems.push(`tile size ${map.tile} is not one the sheets are cut on`);
  const ranges = map.tilesets.map((t) => [t.firstgid, t.firstgid + t.tilecount] as const);
  for (const layer of map.layers) {
    if (layer.data.length !== map.height) problems.push(`layer '${layer.name}' has ${layer.data.length} rows, not ${map.height}`);
    for (const row of layer.data) {
      if (row.length !== map.width) {
        problems.push(`layer '${layer.name}' has a row of ${row.length}, not ${map.width}`);
        break;
      }
      for (const raw of row) {
        const gid = raw & 0x1fffffff;
        if (gid && !ranges.some(([lo, hi]) => gid >= lo && gid < hi)) {
          problems.push(`layer '${layer.name}' holds gid ${gid}, which no tileset covers`);
          break;
        }
      }
    }
  }
  return problems;
}
