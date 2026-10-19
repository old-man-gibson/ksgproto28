/**
 * A drawn map: tile layers painted from tileset sheets, shown behind a
 * region's spot markers instead of the bare node diagram (see MapCard and
 * TileMap.svelte). UI-only — core never reads these.
 *
 * The shape is Tiled's, reduced: global tile ids (gids) index into a list of
 * tilesets by `firstgid`, 0 is empty, and the three high bits carry Tiled's
 * flip flags. One map per region lives in `<region>.map.json` beside this
 * file, written whole by the forge's Tiles mode (docs/TILEMAPS.md) — the one
 * file family the forge reprints rather than edits surgically, because it
 * carries no hand-written comments to protect.
 */
export interface TileMapDef {
  /** In tiles. The map is drawn at `width × tile` by `height × tile` pixels. */
  width: number;
  height: number;
  /** Tile edge in pixels; every sheet listed must be cut on this grid. */
  tile: number;
  tilesets: TileSetRef[];
  /** Bottom to top. */
  layers: TileLayer[];
  /** What the forge knows about the picture beyond its pixels. */
  meta?: TileMapMeta;
}

export interface TileLayer {
  name: string;
  /** `height` rows of `width` gids. */
  data: number[][];
}

export interface TileSetRef {
  /**
   * `<packKey>/<path inside the pack>`, resolved to a URL by tileArt.ts. The
   * pack folders live in src/assets/tilemaps and are NOT in version control
   * (licensed art, see docs/AUTHORSHIP.md §9): a missing sheet draws nothing
   * and the map falls back to the node diagram. The pack key is derived from
   * the folder name with its version stripped (`packKeyOf`), so a pack
   * update never renumbers a map.
   */
  key: string;
  columns: number;
  firstgid: number;
  /** Tiles on the sheet; the next sheet's `firstgid` starts after them. */
  tilecount: number;
}

/**
 * Authoring facts the generator and the runtime share. Rooms and doors are
 * filled by the forge's generator (docs/TILEMAPS.md §Generating); a hand
 * painted map may carry none of this.
 */
export interface TileMapMeta {
  /** Spot id → the room's rectangle, in tiles. */
  rooms?: Record<string, TileRect>;
  /** Door cells, real and fake — see TileDoor. */
  doors?: TileDoor[];
  /** Which pack kit painted the generated parts, and with what seed. */
  kit?: string;
  seed?: number;
}

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A door cell. A `fake` door is drawn as wall until the thing it hides is
 * known to the player — a `hidden` connection (`edge`) revealed by exploring,
 * or an exploration find (`find`) — and glitches now and then in the
 * meantime (TileMap.svelte). Real doors carry no binding.
 */
export interface TileDoor {
  x: number;
  y: number;
  fake?: boolean;
  /** The declared connection this door stands on: `from → to`. */
  edge?: { from: string; to: string };
  /** The exploration find this door hides: `spot` and the find's id. */
  find?: { spot: string; id: string };
}

export const FLIP_H = 0x80000000;
export const FLIP_V = 0x40000000;
export const FLIP_D = 0x20000000;
export const GID_MASK = ~(FLIP_H | FLIP_V | FLIP_D);
