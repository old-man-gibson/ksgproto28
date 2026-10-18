/**
 * Readers for Tiled's file formats, as the Epic RPG World packs use them.
 *
 * Regex over the XML rather than a parser: the files are machine-written by
 * one program in one shape, the repo has no XML dependency, and every field
 * the forge needs is an attribute. `.tsx` gives a sheet's geometry, its
 * animations and its Wang (terrain) sets; `.tmx` gives the example maps and
 * the automapping rule maps (CSV, or base64 with zlib/gzip — Highlands
 * ships one of those).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export interface WangSet {
  name: string;
  type: 'corner' | 'edge' | 'mixed';
  colors: { name: string; color: string; probability: number }[];
  /** Tile-local id → the eight-slot wang id Tiled stores (top, top-right, …). */
  tiles: { tileid: number; wangid: number[] }[];
}

export interface TilesetInfo {
  name: string;
  tileWidth: number;
  tileHeight: number;
  tilecount: number;
  columns: number;
  /** Sheet path relative to the pack folder, '/'-joined; null for a collection of images. */
  image: string | null;
  imageSize: { w: number; h: number } | null;
  /** True for Tiled's image collections (one image per tile, any size). */
  collection: boolean;
  animations: Record<number, { tileid: number; duration: number }[]>;
  wangsets: WangSet[];
}

export interface TmxTileset {
  firstgid: number;
  tilecount: number;
  columns: number;
  name: string;
  /** `<packKey>/<sheet path>`; null for Tiled's built-in automap markers and for collections. */
  key: string | null;
  /** The `:/automap-tiles.tsx` pseudo-tileset that rule maps use. */
  automap: boolean;
}

export interface TmxLayer {
  name: string;
  data: number[];
  visible: boolean;
  opacity: number;
  properties: Record<string, string | number | boolean>;
}

export interface TmxMap {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  properties: Record<string, string | number | boolean>;
  tilesets: TmxTileset[];
  layers: TmxLayer[];
}

const attr = (s: string, n: string): string | undefined => new RegExp(`\\b${n}="([^"]*)"`).exec(s)?.[1];
const num = (s: string, n: string, fallback = 0): number => {
  const v = attr(s, n);
  return v === undefined ? fallback : Number(v);
};

function parseProperties(block: string | undefined): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!block) return out;
  for (const m of block.matchAll(/<property ([^>]*)\/>/g)) {
    const name = attr(m[1], 'name');
    if (!name) continue;
    const type = attr(m[1], 'type');
    const raw = attr(m[1], 'value') ?? '';
    out[name] = type === 'bool' ? raw === 'true' : type === 'int' || type === 'float' ? Number(raw) : raw;
  }
  return out;
}

/** '/'-joined path of `target` relative to `base`, both absolute. */
export function relPosix(base: string, target: string): string {
  return path.relative(base, target).split(path.sep).join('/');
}

/** Read one `.tsx`. `packDir` is where sheet paths are made relative to. */
export function parseTsx(text: string, tsxPath: string, packDir: string): TilesetInfo {
  const head = /<tileset ([^>]*)>/.exec(text)?.[1] ?? '';
  const imageTag = /^\s*<image ([^>]*)\/>/m.exec(text.replace(/<tile id="[\s\S]*$/, ''))?.[1];
  const image = imageTag ? attr(imageTag, 'source') : undefined;
  const columns = num(head, 'columns');
  const animations: TilesetInfo['animations'] = {};
  for (const m of text.matchAll(/<tile id="(\d+)"[^>]*>([\s\S]*?)<\/tile>/g)) {
    const frames = [...m[2].matchAll(/<frame tileid="(\d+)" duration="(\d+)"\/>/g)].map((f) => ({
      tileid: +f[1],
      duration: +f[2],
    }));
    if (frames.length) animations[+m[1]] = frames;
  }
  const wangsets: WangSet[] = [];
  for (const m of text.matchAll(/<wangset ([^>]*)>([\s\S]*?)<\/wangset>/g)) {
    const type = attr(m[1], 'type');
    wangsets.push({
      name: attr(m[1], 'name') ?? '',
      type: type === 'edge' || type === 'mixed' ? type : 'corner',
      colors: [...m[2].matchAll(/<wangcolor ([^>]*)\/>/g)].map((c) => ({
        name: attr(c[1], 'name') ?? '',
        color: attr(c[1], 'color') ?? '#000000',
        probability: num(c[1], 'probability', 1),
      })),
      tiles: [...m[2].matchAll(/<wangtile tileid="(\d+)" wangid="([^"]*)"\/>/g)].map((t) => ({
        tileid: +t[1],
        wangid: t[2].split(',').map(Number),
      })),
    });
  }
  return {
    name: attr(head, 'name') ?? path.basename(tsxPath, '.tsx'),
    tileWidth: num(head, 'tilewidth', 32),
    tileHeight: num(head, 'tileheight', 32),
    tilecount: num(head, 'tilecount'),
    columns,
    image: image ? relPosix(packDir, path.resolve(path.dirname(tsxPath), image)) : null,
    imageSize: imageTag ? { w: num(imageTag, 'width'), h: num(imageTag, 'height') } : null,
    collection: !image || columns === 0,
    animations,
    wangsets,
  };
}

function decodeLayer(encoding: string | undefined, compression: string | undefined, body: string, count: number): number[] {
  if (encoding === 'csv' || !encoding) {
    return body.trim().split(/[\s,]+/).filter(Boolean).map(Number);
  }
  if (encoding !== 'base64') throw new Error(`Unsupported layer encoding '${encoding}'`);
  let buf = Buffer.from(body.trim(), 'base64');
  if (compression === 'zlib') buf = zlib.inflateSync(buf);
  else if (compression === 'gzip') buf = zlib.gunzipSync(buf);
  else if (compression) throw new Error(`Unsupported layer compression '${compression}'`);
  const out: number[] = new Array(count);
  for (let i = 0; i < count; i++) out[i] = buf.readUInt32LE(i * 4);
  return out;
}

/**
 * Read one `.tmx` and the `.tsx` files it points at. `packKey` prefixes the
 * sheet keys; `packDir` is the folder those keys are relative to.
 */
export function parseTmx(text: string, tmxPath: string, packDir: string, packKey: string): TmxMap {
  const head = /<map ([^>]*)>/.exec(text)?.[1] ?? '';
  const width = num(head, 'width');
  const height = num(head, 'height');
  const tilesets: TmxTileset[] = [];
  for (const m of text.matchAll(/<tileset firstgid="(\d+)" source="([^"]*)"\/>/g)) {
    const firstgid = +m[1];
    if (m[2].startsWith(':/')) {
      tilesets.push({ firstgid, tilecount: 5, columns: 1, name: 'automap', key: null, automap: true });
      continue;
    }
    const tsxPath = path.resolve(path.dirname(tmxPath), m[2]);
    const info = parseTsx(fs.readFileSync(tsxPath, 'utf8'), tsxPath, packDir);
    tilesets.push({
      firstgid,
      tilecount: info.tilecount,
      columns: info.columns,
      name: info.name,
      key: info.collection || !info.image ? null : `${packKey}/${info.image}`,
      automap: false,
    });
  }
  tilesets.sort((a, b) => a.firstgid - b.firstgid);

  const mapProps = /<map [^>]*>\s*<properties>([\s\S]*?)<\/properties>/.exec(text)?.[1];
  const layers: TmxLayer[] = [];
  const layerRe =
    /<layer ([^>]*)>\s*(?:<properties>([\s\S]*?)<\/properties>\s*)?<data(?: encoding="(\w+)")?(?: compression="(\w+)")?>([\s\S]*?)<\/data>/g;
  for (const m of text.matchAll(layerRe)) {
    layers.push({
      name: attr(m[1], 'name') ?? '',
      visible: attr(m[1], 'visible') !== '0',
      opacity: num(m[1], 'opacity', 1),
      properties: parseProperties(m[2]),
      data: decodeLayer(m[3], m[4], m[5], width * height),
    });
  }
  return {
    width,
    height,
    tileWidth: num(head, 'tilewidth', 32),
    tileHeight: num(head, 'tileheight', 32),
    properties: parseProperties(mapProps),
    tilesets,
    layers,
  };
}

/** The tileset a gid falls in (flip bits already stripped), or null for 0. */
export function tilesetOf(map: TmxMap, gid: number): TmxTileset | null {
  let best: TmxTileset | null = null;
  for (const t of map.tilesets) if (gid >= t.firstgid) best = t;
  return gid ? best : null;
}

/** Width and height out of a PNG's IHDR chunk, without decoding the image. */
export function pngSize(file: string): { w: number; h: number } | null {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(24);
    const n = fs.readSync(fd, head, 0, 24, 0);
    if (n < 24 || head.readUInt32BE(0) !== 0x89504e47) return null;
    return { w: head.readUInt32BE(16), h: head.readUInt32BE(20) };
  } finally {
    fs.closeSync(fd);
  }
}
