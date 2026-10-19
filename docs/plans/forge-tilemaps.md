---
id: forge-tilemaps
title: Tile maps in the forge — palettes, painting, and generated floors
kind: epic
status: todo
system: forge
parent: ''
save: ''
updated: 2026-09-15
invariants:
- completability
- two-validation-layers
- ast-surgical
- no-terminal-states
done:
- Every Epic RPG World pack under src/assets/tilemaps browses in the forge as a palette (sheets, tiles, terrain sets, the pack's own example maps) without a hand edit to any glob
- A region's drawn map is painted in the forge (brush, rectangle, eraser, picker, stamp from an example map, autotile) over the same 0–100 × 0–75 space the spot editor uses, spots draggable on top
- A region with spots and connections can be GENERATED from a seed and a kit; every room is reachable at tile level (checked, both layers), hidden connections become fake doors that glitch at runtime until revealed
- The generator is a brush, not a lock — its output lands on ordinary layers and is hand-editable afterwards
- A checkout without the packs still builds, runs, and falls back to the node diagram; nothing pixel-shaped enters the repo
- docs/TILEMAPS.md written; TUTORIAL.md §4 shrinks to a pointer
---

# The ask (three lines, 2026-09-15)

The forge should read the tilesets out of `src/assets/tilemaps/*/` and let me
place them on a map; it should also generate maps procedurally from rules such
as "every room must be reachable" and "rooms may hide behind fake doors that
glitch now and then".

# What exists (read before building)

- **Runtime.** `src/ui/lib/tilemaps/`: `TileMapDef` (Tiled's shape, reduced:
  gid grid per layer, `tilesets[].key = <pack>/<path>`), `draw.ts` paints a
  canvas, `TileMap.svelte` wraps it and reports fallback, `index.ts` maps
  REGION id → map, `tileArt.ts` holds the `import.meta.glob` of sheets (every
  sheet a map uses must be listed there — a build input). `MapCard` pins the
  canvas under its SVG so a spot's `map: {x, y}` lands on tile
  `(x/100·W, y/75·H)`.
- **Authoring.** `scripts/tilemaps/tmx-compose.mjs` turns a scene JSON
  (crops of the packs' example `.tmx`, seeded fills, stamps off a sheet) into
  `floor0.map.ts`. Offline, one region, no UI. TUTORIAL.md §4.
- **The packs** (14, gitignored, AUTHORSHIP §9). Each carries a `TiledMap
  Editor*/` folder: `.tsx` tilesets (32 px grid; some are *image collections*
  of odd-sized sprites with `columns="0"`), one or two example `.tmx` maps,
  and `Rules/` — Tiled **automapping** rule maps in threes (`rule0` erase,
  `rule1` place, `rule2` variations with `Probability`), driven by an
  `input_<layer>` / `output_<layer>` pair and the five `:/automap-tiles.tsx`
  markers (Empty, Ignore, NonEmpty, Other, Negate). Desert, Highlands and
  Sewers additionally ship **Wang sets** (`<wangset type="corner">`) in their
  terrain `.tsx`; Old Prison and Grass Land 2.0 — the two packs floor 0 uses —
  do not. Animated tiles exist (`<animation>`), unused so far.
- **The forge.** Dev-only Vite plugin; data loaded via `ssrLoadModule`;
  writes are AST-surgical to catalog files only (`WRITABLE`), backed up to
  `.forge-backups/`, always diffed first. `WorldMap.svelte` is the spot/edge
  editor in the 0–100 × 0–75 space. `board/server/plugin.ts` is the precedent
  for a dev plugin that writes non-catalog files.
- **The game's vocabulary for doors already exists**: `Connection.hidden`
  (invisible until 100 % explored or a find opens it), `oneWay`, `requires`
  (a directional lock), `forced`. The completability lint already walks
  reachability over spots. A tile map must never say more than the diagram.

# The shape

Four stories, each shippable on its own. Later ones depend on earlier ones.

## 1. Palettes and the map file (forge reads the packs, writes one file)

**Server.** `forge/server/tilemaps.ts`, new routes under `/__forge/api/tiles/`:

- `/packs` — scan `src/assets/tilemaps/*/**/*.tsx` and `*.tmx`. Per pack:
  sheets (`image`, `columns`, `tilecount`, tile size), per-tile animations,
  Wang sets (colors, `wangtile` ids), image-collection tilesets flagged
  as such, example maps (layer names, size), and the `Rules/` list. Nothing
  cached; the folder is the truth. A pack with no `TiledMap Editor` folder
  still lists its `.png` sheets by scanning for 32-divisible images.
- `/tmx` — parse one example `.tmx` to gids (the parser already in
  `tmx-compose.mjs`, moved to TS and shared).
- Sheet pixels come straight from the dev server — Vite serves anything under
  the project root in dev, so the palette shows
  `/src/assets/tilemaps/<pack>/…png` with no glob. The glob is a *runtime*
  need only (see below).

**The map file becomes tool-owned.** `src/ui/lib/tilemaps/<region>.map.json`
replaces `floor0.map.ts`: the same `TileMapDef` plus a `meta` block —
layer names, a `rooms` list (spot id → tile rect), `doors` (edge → cells,
`fake: boolean`), `kit` and `seed` when generated. The forge **reprints this
file whole**. That is a deliberate exception to the AST-surgical rule and it
is safe for the same reason the rule exists: this file carries no hand
comments and is already documented as "never edit by hand". It gets the
backup and the diff modal like everything else; the diff is by row, which
reads fine for a grid.

**Two generated registrations** so no hand edit is ever needed after a paint:

- `src/ui/lib/tilemaps/maps.gen.ts` — `TILEMAPS` region → map (imports the
  JSON). `index.ts` re-exports it.
- `src/ui/lib/tilemaps/sheets.gen.ts` — the `import.meta.glob` list, the
  union of every `tilesets[].key` across every map file. `tileArt.ts`
  imports it. Same pattern as `wordskills.data.ts`: generated, never written
  by hand, a header says so.

Both are rewritten on every apply that touches a map. `WRITABLE` grows a
second set for these three shapes.

**Client.** A **🧱 Tiles** mode on the World Map (toolbar toggle beside the
region tabs), not a separate tab: the region, the viewBox and the spot layer
are the same, and seeing spots over tiles while painting is the point.

- A layer list (bottom → top, eye toggle, active layer, add/rename/reorder).
- A palette pane: pack ▸ tileset ▸ sheet grid at 1:1 with zoom; click picks
  one tile, drag picks a rectangle (a stamp). An **Example map** tab shows the
  pack's `.tmx` rendered; drag a rectangle there to pick a stamp made of all
  its layers at once (today's "crop", live).
- Tools: brush, rectangle fill, eraser, picker (eyedropper off the canvas,
  reads the active layer or the topmost non-empty), stamp, fill-with-scatter
  (the seeded `gids` fill that exists today).
- Undo/redo in the store: a `tiles` op holds a sparse cell list per layer, and
  a drag coalesces into one op like a spot drag does. Apply sends the whole
  grid.
- Resize the map (anchored), change `tile` size only when every sheet agrees.
- The spot layer stays live: drag a spot while in Tiles mode and it writes
  `map: {x, y}` exactly as before, snapped to tile centres when the map is
  tiled.

Migration: compose floor 0 once more with the current scene, write it as
`holding_level.map.json`, delete `floor0.map.ts` and the scene JSON's role as
truth (`tmx-compose.mjs` stays as an *import*: "seed this map from a scene").

## 2. Autotile (the packs' own Rules, interpreted)

The artist shipped the autotiling; the forge should run it rather than invent
its own. `forge/lib/automap.ts` interprets Tiled automapping as the packs use
it (Tiled 1.9 format, no `regions` layer — rule regions are the connected
components of the rule map's input+output cells):

- Paint on an **input layer** with the kit's marker tile (e.g. "wall-1");
  `rule1` places every wall piece by matching each rule's input pattern at
  every position, honouring Empty / Ignore / NonEmpty / Other / Negate;
  `rule2` rolls `Probability` variations; `MatchInOrder` respected. `rule0`
  is the erase pass. Run on demand (button) and optionally live after each
  stroke, with `AutomappingRadius` from the example map.
- The **Wang terrain brush** is the cheaper second brush where a `.tsx` has
  `<wangset>`s: paint a color mask, resolve each cell's corner signature to a
  tile carrying that `wangid`, random among ties by `probability`.

If the Rules interpreter proves nastier than it looks, story 1 still ships:
manual painting plus stamps off the example maps is how floor 0 was built.

## 3. The generator (rooms from spots, corridors from connections)

Input: the region's spots and **declared** connections (the same edges the
World Map draws), a **kit**, a seed, and the rule checklist. Output: a room
layout painted onto ordinary layers, `rooms` / `doors` in `meta`, and staged
`map: {x, y}` ops moving each spot to its room's centre — so the diff shows
exactly what moved, and the result is hand-editable afterwards. *A generator
whose output reaches the player is the author; a generator a person culls is a
dice roll* (FORGE.md §The name deck). Regenerate until it is right, then paint.

**Kit** = per pack, authored once in the forge and stored as
`scripts/tilemaps/kits/<pack>.kit.json`: which terrain fills a room floor,
which input-layer marker means wall (autotile does the rest), corridor floor,
door tiles (real door; **fake door** — the wall piece drawn where a door would
be; locked gate; drop/ladder for `oneWay`), and a weighted prop list for
dressing. Outdoor packs use the same slots (clearing / treeline / gap).

**Layout.** Room rectangles sized from the map file's per-room size (default
medium; set in the inspector, stored in `meta.rooms`, no core change), target
centres taken from the spot's **existing `map` coordinates** so the hand
layout steers the result; overlaps pushed apart; corridors routed along
declared connections by A* over non-room cells so a corridor never cuts
another room; one door cell per edge end.

**Rules** (checklist, on by default):

- *Every room reachable.* True by construction (corridors mirror edges) and
  **verified** by a flood fill over walkable cells from the start room; the
  same check is a lint in `tests/tilemaps.test.ts` and mirrored in
  `forge/lib/validate.ts`. A map whose flood fill misses a room is an error.
- *Hidden connections are fake doors.* A `hidden` edge gets a corridor and a
  door cell drawn as wall, `fake: true`. The tile view therefore never shows
  a door the diagram hides. `oneWay` gets the kit's drop piece; `requires`
  gets the locked gate.
- *Dress rooms* with the kit's props, density slider, never on door cells.

## 4. Runtime: fake doors glitch

`TileMap.svelte` learns about `meta.doors`. For each `fake` door whose edge
is still hidden in the save (`visibleEdges` already knows), a
`requestAnimationFrame` loop — only while the region is shown, only when at
least one fake door exists — redraws that cell every 10–25 s (seeded per cell
so two doors never blink together) as the *real* door piece for ~120 ms with
a one-pixel horizontal tear, then back to wall. Once the edge is revealed the
cell draws the real door permanently. `prefers-reduced-motion` → no glitch,
the wall stays a wall until revealed. Tiled `<animation>` frames ride the
same loop when present (torches, water), which is the first time the packs'
animated tiles get used.

The glitch is a *teachable* reveal: a player who watches a wall learns there
is a room behind it. COMPLETABILITY §"critical-path knowledge must be
teachable" — hidden access is already never on a critical path, so this
only ever shortens a discovery.

# Decisions (user, 2026-09-15)

1. **Truth format** — `<region>.map.json`, reprinted whole by the forge; the
   old `.map.ts` module, the scene JSON and the compose/crop scripts are gone.
   Chosen for ease of use and expansion: JSON is read and written without an
   AST, imports straight into Vite, diffs by row, and `meta` grows without a
   format change. A Tiled `.tmx` truth would have tied the file to one
   example map's gid numbering and left two editors writing one file.
2. **Autotile** — interpret the packs' own automapping Rules (story 2).
3. **Room size** — per room, in the map file's `meta.rooms`; no core change.
4. **Fake doors** — bound to EITHER a `hidden` connection (`TileDoor.edge`) or
   an exploration find (`TileDoor.find`): a door can hide a way out or a
   secret inside the room. Both already exist as game data, so the tile view
   still never says more than the diagram.
5. **Glitch** — every 10–25 s, ~120 ms, a deliberate hint, off under
   reduced-motion.
6. **First region** — Threshold with the Village pack; the user draws the
   band floors themselves.
7. **Odd-sized props** — out of v1. Image collections are named in the
   palette, not shown; every such prop also sits on a 32-grid atlas sheet.
8. **Steering** — spot coordinates seed room centres; the author can move
   spots afterwards (the Hand tool works in Tiles mode).
9. **Edge visuals in v1 of the generator** — door, fake door, the locked gate
   (`requires`) and a region-exit marker; the `oneWay` drop later.

# Stories

- [forge-tilemaps-paint](forge-tilemaps-paint.md) — **review** (2026-09-15):
  palettes, the JSON map file, the two generated modules, Tiles mode.
  docs/TILEMAPS.md.
- [forge-tilemaps-autotile](forge-tilemaps-autotile.md) — SHELVED 2026-09-15 (LONGTERM.md).
- [forge-tilemaps-generator](forge-tilemaps-generator.md) — SHELVED 2026-09-15.
- [forge-tilemaps-glitch](forge-tilemaps-glitch.md) — SHELVED 2026-09-15.

# Order

1 → 2 → 3 → 4. Story 1 is the one that changes how floor 0 is stored, so it
lands first and alone, verify green, before anything generates. Each story
gets its own card under this epic once the questions above are answered.
