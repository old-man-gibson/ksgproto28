import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { packKeyOf } from '../src/ui/lib/tilemaps/packkey';
import type { TileMapDef } from '../src/ui/lib/tilemaps/types';
import { parseTmx, parseTsx, pngSize } from '../forge/server/tmx';
import {
  MAPS_GEN,
  SHEETS_GEN,
  genMapsModule,
  genSheetsModule,
  isTileFile,
  mapFileFor,
  mapProblems,
  printMap,
  readMaps,
  scanPack,
} from '../forge/server/tilemaps';
import {
  cellOf,
  compact,
  emptyMap,
  eraseRect,
  fillRect,
  gidOf,
  paintStamp,
  pickAt,
  resizeMap,
  stampFromSheet,
  stampFromTmx,
  tileAt,
  tileCentre,
  type Stamp,
  type StampCell,
} from '../forge/lib/tilemap';
import { REGIONS } from '../src/core/registry';

const ROOT = process.cwd();
const FIX = path.join(ROOT, 'tests/fixtures/tilemaps');
const PACK = 'Fixture Pack V1.0';
const PACK_DIR = path.join(FIX, PACK);

describe('pack keys', () => {
  it('strip the vendor prefix and the version, whatever the spelling', () => {
    const table: [string, string][] = [
      ['EPIC RPG World Pack - Old Prison V1.7.1', 'old_prison'],
      ['ERW - Grass Land 2.0 v2.1', 'grass_land_2_0'],
      ['EPIC RPG World Pack - Grass Land V. 1.6', 'grass_land'],
      ['ERW - Sea Adventures (GL 2.0 expansion) V1.5', 'sea_adventures'],
      ['EPIC RPG World Pack - Cemetery V 1.6', 'cemetery'],
      ['EPIC RPG World Pack - Crypt V.1.6', 'crypt'],
      ['Epic RPG World - The dephs of the Mountain V1.5.1', 'the_dephs_of_the_mountain'],
      ['Epic RPG World - The Village V2.2', 'the_village'],
      ['ERW - Ancient Ruins V 2.3', 'ancient_ruins'],
      ['EPIC RPG World - Sewers V1.5', 'sewers'],
      ['Fixture Pack V1.0', 'fixture_pack'],
    ];
    for (const [folder, key] of table) expect(packKeyOf(folder), folder).toBe(key);
  });

  it('keeps a key usable as a path segment and a map key', () => {
    expect(packKeyOf('  Weird -- Name!! v3 ')).toMatch(/^[a-z0-9_]+$/);
  });
});

describe('Tiled readers', () => {
  const tsxPath = path.join(PACK_DIR, 'TiledMap Editor/Tilesets/terrain.tsx');

  it('read a sheet tileset: geometry, image path relative to the pack, animations, wang sets', () => {
    const info = parseTsx(fs.readFileSync(tsxPath, 'utf8'), tsxPath, PACK_DIR);
    expect(info.name).toBe('terrain');
    expect(info.columns).toBe(4);
    expect(info.tilecount).toBe(8);
    expect(info.image).toBe('Tilesets/terrain.png');
    expect(info.imageSize).toEqual({ w: 128, h: 64 });
    expect(info.collection).toBe(false);
    expect(info.animations[3]).toEqual([
      { tileid: 3, duration: 100 },
      { tileid: 7, duration: 100 },
    ]);
    expect(info.wangsets).toHaveLength(1);
    expect(info.wangsets[0].type).toBe('corner');
    expect(info.wangsets[0].tiles[1]).toEqual({ tileid: 1, wangid: [0, 0, 0, 1, 0, 1, 0, 0] });
  });

  it('flag an image collection, which has no sheet to index', () => {
    const p = path.join(PACK_DIR, 'TiledMap Editor/Tilesets/sprites.tsx');
    const info = parseTsx(fs.readFileSync(p, 'utf8'), p, PACK_DIR);
    expect(info.collection).toBe(true);
    expect(info.image).toBeNull();
  });

  it('read a map: tilesets by firstgid with pack-prefixed keys, CSV layers, flags kept, properties', () => {
    const p = path.join(PACK_DIR, 'TiledMap Editor/example.tmx');
    const map = parseTmx(fs.readFileSync(p, 'utf8'), p, PACK_DIR, 'fixture_pack');
    expect(map.width).toBe(4);
    expect(map.height).toBe(3);
    expect(map.properties).toEqual({ AutomappingRadius: 4 });
    expect(map.tilesets.map((t) => [t.firstgid, t.key, t.automap])).toEqual([
      [1, 'fixture_pack/Tilesets/terrain.png', false],
      [9, null, true],
      [14, null, false],
    ]);
    expect(map.layers.map((l) => l.name)).toEqual(['ground', 'props']);
    expect(map.layers[0].data).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 1, 1, 1, 1]);
    expect(map.layers[1].data[2]).toBe(2147483649);
    expect(map.layers[1].visible).toBe(false);
    expect(map.layers[1].opacity).toBe(0.5);
    expect(map.layers[1].properties).toEqual({ note: 'hi' });
  });

  it('read base64 + zlib layers the same as CSV ones', () => {
    const p = path.join(PACK_DIR, 'TiledMap Editor/example.tmx');
    const csv = fs.readFileSync(p, 'utf8');
    const cells = [1, 2, 3, 4, 5, 6, 7, 8, 1, 1, 1, 1];
    const buf = Buffer.alloc(cells.length * 4);
    cells.forEach((c, i) => buf.writeUInt32LE(c, i * 4));
    const b64 = zlib.deflateSync(buf).toString('base64');
    const text = csv.replace(/<data encoding="csv">\s*1,2,3,4,[\s\S]*?<\/data>/, `<data encoding="base64" compression="zlib">${b64}</data>`);
    const map = parseTmx(text, p, PACK_DIR, 'fixture_pack');
    expect(map.layers[0].data).toEqual(cells);
  });

  it('read PNG dimensions off the header alone', () => {
    expect(pngSize(path.join(PACK_DIR, 'Tilesets/terrain.png'))).toEqual({ w: 128, h: 64 });
    expect(pngSize(tsxPath)).toBeNull();
  });
});

describe('pack scan', () => {
  const pack = scanPack(ROOT, PACK, FIX);

  it('keys the pack, lists tsx sheets and bare 32-grid PNGs, skips mockups', () => {
    expect(pack.key).toBe('fixture_pack');
    expect(pack.dir).toBe(PACK);
    expect(pack.sheets.map((s) => [s.path, s.columns, s.tilecount, s.tiled])).toEqual([
      ['Tilesets/terrain.png', 4, 8, true],
      ['Props/extra.png', 4, 12, false],
    ]);
    expect(pack.sheets[0].key).toBe('fixture_pack/Tilesets/terrain.png');
    expect(pack.sheets[0].url).toBe('/src/assets/tilemaps/Fixture%20Pack%20V1.0/Tilesets/terrain.png');
    expect(pack.sheets[0].wangsets).toHaveLength(1);
  });

  it('names collections rather than pretending they are sheets', () => {
    expect(pack.collections).toEqual(['sprites']);
  });

  it('lists example maps with their layers, and rule maps apart', () => {
    expect(pack.examples).toEqual([
      { name: 'example', path: 'TiledMap Editor/example.tmx', width: 4, height: 3, layers: ['ground', 'props'] },
    ]);
    expect(pack.rules).toEqual(['TiledMap Editor/Rules/wall-rule1-places all tiles.tmx']);
  });
});

describe('map files', () => {
  const maps = readMaps(ROOT);

  it('every drawn map names a real region and holds gids its sheets cover', () => {
    expect(Object.keys(maps).length).toBeGreaterThan(0);
    for (const [region, map] of Object.entries(maps)) {
      expect(REGIONS[region], `${region}.map.json names no region`).toBeDefined();
      expect(mapProblems(map), region).toEqual([]);
    }
  });

  it('are printed one row per line, and the printer round-trips what is on disk', () => {
    for (const region of Object.keys(maps)) {
      const text = fs.readFileSync(path.join(ROOT, mapFileFor(region)), 'utf8');
      expect(printMap(JSON.parse(text) as TileMapDef)).toBe(text);
      expect(text).toMatch(/\n        \[\d+(,\d+)*\],?\n/);
    }
  });

  it('the generated registry and sheet glob match what the maps say', () => {
    expect(fs.readFileSync(path.join(ROOT, MAPS_GEN), 'utf8')).toBe(genMapsModule(Object.keys(maps)));
    // Fixed folder names: the packs are not in version control, so the scan
    // cannot be the oracle here — the committed module must simply agree.
    const dirs = {
      grass_land_2_0: 'ERW - Grass Land 2.0 v2.1',
      old_prison: 'EPIC RPG World Pack - Old Prison V1.7.1',
    };
    expect(fs.readFileSync(path.join(ROOT, SHEETS_GEN), 'utf8')).toBe(genSheetsModule(maps, dirs));
  });

  it('a pack with no folder is named in the sheet module, not silently dropped', () => {
    const text = genSheetsModule(maps, {});
    expect(text).toMatch(/Packs no folder .* matched/);
    expect(text).not.toMatch(/undefined/);
  });

  it('the printer keeps meta when there is any', () => {
    const map = emptyMap(2, 1);
    map.meta = { rooms: { a: { x: 0, y: 0, w: 1, h: 1 } } };
    const text = printMap(map);
    expect(JSON.parse(text)).toEqual(map);
    expect(text).toContain('"meta": {');
  });

  it('refuses shapes that would not draw', () => {
    const map = emptyMap(2, 2);
    map.layers[0].data[0][0] = 99;
    expect(mapProblems(map)).toEqual([`layer 'ground' holds gid 99, which no tileset covers`]);
    const short = emptyMap(2, 2);
    short.layers[0].data.pop();
    expect(mapProblems(short)[0]).toMatch(/1 rows, not 2/);
    expect(mapProblems({ ...emptyMap(2, 2), tile: 33 })[0]).toMatch(/tile size 33/);
  });

  it('only the map family is writable, and only under a real id', () => {
    expect(isTileFile('src/ui/lib/tilemaps/holding_level.map.json')).toBe(true);
    expect(isTileFile(MAPS_GEN)).toBe(true);
    expect(isTileFile('src/ui/lib/tilemaps/types.ts')).toBe(false);
    expect(isTileFile('src/core/data/locations.data.ts')).toBe(false);
    expect(() => mapFileFor('../etc')).toThrow();
    expect(() => mapFileFor('Bad Id')).toThrow();
    expect(mapFileFor('the_village')).toBe('src/ui/lib/tilemaps/the_village.map.json');
  });
});

describe('painting', () => {
  const A = { key: 'p/a.png', columns: 4, tilecount: 8 };
  const B = { key: 'p/b.png', columns: 2, tilecount: 4 };
  const cell = (sheet: typeof A, local: number, flags = 0): StampCell => ({ ...sheet, local, flags });
  const one = (c: StampCell): Stamp => ({ w: 1, h: 1, layers: [{ name: null, cells: [[c]] }] });

  it('grows the tileset table on demand, sheets laid end to end', () => {
    const map = emptyMap(3, 3);
    expect(gidOf(map, cell(A, 2))).toBe(3);
    expect(gidOf(map, cell(B, 1))).toBe(10);
    expect(gidOf(map, cell(A, 7, 0x80000000))).toBe((8 | 0x80000000) >>> 0 | 0);
    expect(map.tilesets.map((t) => [t.key, t.firstgid])).toEqual([
      ['p/a.png', 1],
      ['p/b.png', 9],
    ]);
    expect(cellOf(map, 10)).toEqual(cell(B, 1));
    expect(cellOf(map, 0)).toBeNull();
    expect(cellOf(map, 500)).toBeNull();
  });

  it('paints a stamp onto the active layer and named layers onto their own, creating them', () => {
    const map = emptyMap(4, 4);
    const stamp: Stamp = {
      w: 2,
      h: 1,
      layers: [
        { name: null, cells: [[cell(A, 0), cell(A, 1)]] },
        { name: 'props', cells: [[null, cell(B, 3)]] },
      ],
    };
    expect(paintStamp(map, stamp, 1, 2, 0)).toBe(true);
    expect(map.layers.map((l) => l.name)).toEqual(['ground', 'props']);
    expect(map.layers[0].data[2]).toEqual([0, 1, 2, 0]);
    expect(map.layers[1].data[2]).toEqual([0, 0, 12, 0]);
    // Off the edge: clipped, not thrown. Same paint again: nothing changes.
    expect(paintStamp(map, stamp, 3, 3, 0)).toBe(true);
    expect(paintStamp(map, stamp, 3, 3, 0)).toBe(false);
  });

  it('fills a rectangle by tiling the stamp, or by a stable scatter', () => {
    const map = emptyMap(4, 2);
    const stamp: Stamp = { w: 2, h: 1, layers: [{ name: null, cells: [[cell(A, 0), cell(A, 1)]] }] };
    fillRect(map, { x: 0, y: 0, w: 4, h: 1 }, stamp, 0, 'tile');
    expect(map.layers[0].data[0]).toEqual([1, 2, 1, 2]);
    const r1 = emptyMap(6, 1);
    const r2 = emptyMap(6, 1);
    fillRect(r1, { x: 0, y: 0, w: 6, h: 1 }, stamp, 0, 'random', 7);
    fillRect(r2, { x: 0, y: 0, w: 6, h: 1 }, stamp, 0, 'random', 7);
    expect(r1.layers[0].data).toEqual(r2.layers[0].data);
    expect(r1.layers[0].data[0].every((g) => g === 1 || g === 2)).toBe(true);
    const r3 = emptyMap(6, 1);
    fillRect(r3, { x: 0, y: 0, w: 6, h: 1 }, stamp, 0, 'random', 8);
    expect(r3.layers[0].data).not.toEqual(r1.layers[0].data);
  });

  it('erases only the active layer, and picks the topmost tile by default', () => {
    const map = emptyMap(2, 1);
    paintStamp(map, one(cell(A, 3)), 0, 0, 0);
    map.layers.push({ name: 'top', data: [[0, 0]] });
    paintStamp(map, one(cell(B, 0)), 0, 0, 1);
    const picked = pickAt(map, 0, 0, null);
    expect(picked?.layer).toBe(1);
    expect(picked?.stamp.layers[0].cells[0][0]).toEqual(cell(B, 0));
    expect(pickAt(map, 0, 0, 0)?.stamp.layers[0].cells[0][0]).toEqual(cell(A, 3));
    expect(pickAt(map, 1, 0, null)).toBeNull();
    expect(eraseRect(map, 1, { x: 0, y: 0, w: 2, h: 1 })).toBe(true);
    expect(map.layers[1].data[0]).toEqual([0, 0]);
    expect(map.layers[0].data[0]).toEqual([4, 0]);
    expect(eraseRect(map, 1, { x: 0, y: 0, w: 2, h: 1 })).toBe(false);
  });

  it('compacts away unused sheets and renumbers the rest, flags intact', () => {
    const map = emptyMap(3, 1);
    paintStamp(map, one(cell(A, 1)), 0, 0, 0);
    paintStamp(map, one(cell(B, 2, 0x40000000)), 1, 0, 0);
    eraseRect(map, 0, { x: 0, y: 0, w: 1, h: 1 });
    compact(map);
    expect(map.tilesets).toEqual([{ key: 'p/b.png', columns: 2, firstgid: 1, tilecount: 4 }]);
    expect(map.layers[0].data[0]).toEqual([0, (3 | 0x40000000) >>> 0 | 0, 0]);
    expect(cellOf(map, map.layers[0].data[0][1])).toEqual(cell(B, 2, 0x40000000));
  });

  it('resizes about a corner or the centre without losing what fits', () => {
    const map = emptyMap(2, 2);
    paintStamp(map, one(cell(A, 0)), 1, 1, 0);
    resizeMap(map, 4, 4, 'nw');
    expect(map.layers[0].data[1][1]).toBe(1);
    resizeMap(map, 6, 6, 'c');
    expect(map.layers[0].data[2][2]).toBe(1);
    resizeMap(map, 2, 2, 'c');
    expect(map.layers[0].data[0][0]).toBe(1);
    expect(map.width).toBe(2);
    expect(map.layers[0].data).toHaveLength(2);
  });

  it('cuts stamps out of a sheet and out of an example map', () => {
    const s = stampFromSheet({ key: 'p/a.png', columns: 4, tilecount: 8 }, 2, 1, 3, 1);
    expect(s.layers[0].cells[0].map((c) => c?.local ?? null)).toEqual([6, 7, null]);
    const p = path.join(PACK_DIR, 'TiledMap Editor/example.tmx');
    const tmx = parseTmx(fs.readFileSync(p, 'utf8'), p, PACK_DIR, 'fixture_pack');
    const crop = stampFromTmx(tmx, { x: 1, y: 0, w: 2, h: 2 }, ['ground', 'props']);
    expect(crop.layers.map((l) => l.name)).toEqual(['ground', 'props']);
    expect(crop.layers[0].cells[0].map((c) => c?.local)).toEqual([1, 2]);
    // The flipped tile keeps its flag; the automap marker (gid 10) is not a tile.
    expect(crop.layers[1].cells[0][1]).toEqual({ key: 'fixture_pack/Tilesets/terrain.png', columns: 4, tilecount: 8, local: 0, flags: -2147483648 });
    expect(crop.layers[1].cells[1][0]).toBeNull();
    expect(stampFromTmx(tmx, { x: 0, y: 2, w: 1, h: 1 }, ['props']).layers).toEqual([]);
  });

  it('projects map space onto tiles the way MapCard does, and back to centres', () => {
    const map = emptyMap(32, 24);
    expect(tileAt(map, 17, 25)).toEqual({ x: 5, y: 8 });
    expect(tileAt(map, 100, 75)).toBeNull();
    expect(tileCentre(map, 5, 8)).toEqual({ x: 17.2, y: 26.6 });
    const c = tileCentre(map, 31, 23);
    expect(tileAt(map, c.x, c.y)).toEqual({ x: 31, y: 23 });
  });
});
