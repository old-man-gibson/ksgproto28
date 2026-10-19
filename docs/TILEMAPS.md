# Drawn maps — tiles under the region diagram

A region can be **drawn**: a picture of 32 px tiles painted under its spot
diagram, so the Holding Level looks like a cell block and a yard instead of
five dots on a grid. The picture changes nothing about play — spots, roads and
exploration are exactly the data in `locations.data.ts` — it only says what
the place looks like. This document is the whole system: the file, the
runtime, the forge's Tiles mode, and what is not built yet.

Where things live:

- `src/ui/lib/tilemaps/<region>.map.json` — one region's picture. **Tool-owned:**
  written whole by the forge, never edited by hand.
- `src/ui/lib/tilemaps/maps.gen.ts`, `sheets.gen.ts` — generated with it (see §3).
- `src/ui/lib/tilemaps/types.ts`, `draw.ts`, `TileMap.svelte`, `tileArt.ts` — the runtime.
- `forge/server/tilemaps.ts`, `forge/server/tmx.ts` — the forge's side: pack
  scanning, Tiled file readers, the printer.
- `forge/lib/tilemap.ts`, `forge/lib/tiles.svelte.ts`, `forge/panels/Tile*.svelte`
  — the Tiles mode.
- `src/assets/tilemaps/<pack>/` — the art. **Not in the repo** (§5).
- `tests/tilemaps.test.ts` — the format, the readers, the painting helpers, and
  the rule that every committed map is consistent with its generated modules.
- `docs/plans/forge-tilemaps.md` — the epic this shipped under, and what is
  still open (autotile, the generator, fake doors).

---

## 1. The player sees

`MapCard` paints the region's canvas under its SVG diagram for any region in
`TILEMAPS`. The canvas is pinned to rows 0–75 of the diagram's viewBox
(`0 -6 100 84`), so a spot's `map: { x, y }` lands on tile
`(x / 100 · width, y / 75 · height)` — the same projection the forge uses
when it snaps a dragged spot to a tile centre. Labels go white with a dark
stroke over tiles; roads go pale. A machine without the art packs (every fresh
checkout) draws nothing and the plain diagram shows; nothing else changes.

## 2. The file

```json
{
  "width": 32, "height": 24, "tile": 32,
  "tilesets": [
    { "key": "old_prison/Tilesets/wall-1- 3 tiles tall.png", "columns": 16, "firstgid": 1, "tilecount": 368 }
  ],
  "layers": [
    { "name": "ground", "data": [ [0,0,…], … ] }
  ],
  "meta": { }
}
```

Tiled's shape, reduced. `layers` paint bottom to top; each `data` row is one
line of the file, so a brush stroke diffs as the rows it touched. A cell is a
**gid**: `0` is empty, otherwise `firstgid + index-on-sheet`, with Tiled's three
flip flags in the high bits (`FLIP_H` / `FLIP_V` / `FLIP_D` in `types.ts`).
Sheets are laid end to end by `firstgid`; the forge prunes unused sheets and
renumbers on every save, so a file lists exactly the sheets it draws from.

A sheet key is `<packKey>/<path inside the pack>`. The **pack key** is the
pack's folder name with the vendor prefix and the trailing version stripped
(`packKeyOf` in `packkey.ts`: `EPIC RPG World Pack - Old Prison V1.7.1` →
`old_prison`, `ERW - Grass Land 2.0 v2.1` → `grass_land_2_0`). Stripping the
version is the point: updating a pack changes its folder and must not
renumber every map that draws from it.

`meta` holds what the forge knows beyond pixels — `rooms`, `doors`, `kit`,
`seed` — and is reserved for the generator (plans/forge-tilemaps.md §3–4). A
hand-painted map has none.

## 3. Three tool-owned files, one rule

The forge **reprints `<region>.map.json` whole**. That is the one exception to
FORGE.md's "writes are surgical", and it is safe for the same reason the rule
exists: the AST surgery protects hand-written comments, and this file carries
none. It still goes through the diff modal and `.forge-backups/` like every
write; a whole-map write shows as the rows that changed.

Two modules are regenerated on every apply that touches a map:

- `maps.gen.ts` — `TILEMAPS`, region id → map. `index.ts` re-exports it, and
  `MapCard` reads it. Creating a map for a region adds a line; dropping one
  removes it.
- `sheets.gen.ts` — the `import.meta.glob` of every sheet any map uses, and the
  pack folder each pack key resolved to at generation time. Only globbed sheets
  are build inputs (the packs hold thousands of files), and the glob is what
  lets a checkout without the packs still build. A pack whose folder is absent
  when the module is generated is named in a comment there; its maps fall back
  to the diagram until the pack is present and a map is re-applied.

`tests/tilemaps.test.ts` asserts both modules match what the map files say, and
that the printer round-trips every committed map byte for byte. If you edit a
map file by hand — don't — that test is what tells you.

## 4. Painting (the forge's Tiles mode)

World Map ▸ pick a region ▸ **🧱 Tiles**. The right-hand panel becomes the
palette; the map stays the map, spots included.

**No map yet** — the panel offers a grid (32×24 by default: 4:3, like the
0–100 × 0–75 space spots are placed in). Create it and the region is drawn from
then on; spots keep their coordinates.

**Tools** (keys in brackets; `Esc` returns to the Hand):

| tool | does |
|---|---|
| ✋ Hand (H) | what the map always did: pan, select, drag spots — snapping to tile centres while the region is drawn |
| 🖌️ Brush (B) | paints the stamp cell by cell; a fast drag is filled in |
| ▭ Fill (R) | drag a rectangle, fill it with the stamp — repeated on its period, or **Random fill** scatters the stamp's tiles (seeded: the same picture every time) |
| ⌫ Eraser (E) | clears cells on the active layer |
| ⬚ Erase area (X) | clears a rectangle on the active layer |
| 💉 Picker (I) | takes the stamp from the map — the topmost tile under the pointer, and switches to its layer; `Shift` picks from the active layer only |

**The stamp** is what the brush carries: w × h cells, from one of two places.

- **Sheets** — pick a pack, a sheet, drag a rectangle of tiles. Sheets the
  pack's `.tsx` files describe come first (geometry is the artist's); PNGs cut
  on a 32 grid with no `.tsx` follow, geometry read off the PNG header.
  Sprite folders, animation strips and premade houses are not offered as
  sheets — one file per prop is not a sheet — and image *collections* (Tiled
  tilesets of odd-sized sprites) are named but not shown; every one of those
  props also sits on an atlas sheet.
- **Example maps** — every pack ships one or two Tiled maps of its own tiles
  laid out properly. Drag a rectangle there and the stamp carries every
  checked layer at once, each landing on a layer **of the same name** in your
  map (created if missing). This is how floor 0's cell block was made: a crop
  of the Old Prison example beside a scattered grass fill.

**Layers**: click to make one active, double-click to rename, 👁 hides it while
you work (an aid — hidden layers still ship), ▲▼ change paint order, ✕ deletes
(asks first when it holds anything). Named stamps from example maps create
their layers where they need them.

**Size**: width × height with an anchor (top-left or centre). Spots keep their
map-space coordinates, so after a resize they may sit on different tiles —
that is the projection in §1, not a bug.

**Undo** (`Ctrl+Z` / `Ctrl+Y`) is per region and covers strokes and layer
edits alike. **Review & Apply** writes the map, the two generated modules, and
whatever spot moves you made, in one diff.

**Delete drawn map** removes the file; the region goes back to the diagram
and its spots are untouched.

## 5. The art is not in the repo

The Epic RPG World packs under `src/assets/tilemaps/` are bought pixel art,
licensed for use in a game and not for redistribution (AUTHORSHIP §9), so the
folder is gitignored like the battlers. Committed maps are tile *indexes* into
named sheets — no pixels. The forge serves sheet pixels straight off the dev
server while you paint (no glob needed); the game reaches only what
`sheets.gen.ts` globs.

Consequences worth knowing:

- A fresh checkout builds, tests and runs; every drawn region shows its
  diagram until the packs are copied in.
- `tests/tilemaps.test.ts` never reads the packs. Its scan test runs on the
  fixture pack under `tests/fixtures/tilemaps/`.
- The forge's palette is empty without the packs and says so.

## 6. Not built (plans/forge-tilemaps.md)

- **Autotile.** Every pack ships Tiled automapping *Rules* (`rule0` erase,
  `rule1` place, `rule2` variations); three ship Wang terrain sets in their
  `.tsx`. The readers in `forge/server/tmx.ts` already return both — Wang sets
  on `SheetInfo.wangsets`, rule maps in `PackInfo.rules` — but nothing
  interprets them yet. Until then: stamps off the example maps.
- **The generator** — rooms from spots, corridors from connections, a kit per
  pack, reachability checked. `meta.rooms` / `meta.doors` are its output.
- **Fake doors** — `TileDoor.fake`, bound to a hidden connection or an
  exploration find, glitching at runtime until revealed. Typed, unused.
- Animated tiles (`SheetInfo.animations`) are read and not played.
