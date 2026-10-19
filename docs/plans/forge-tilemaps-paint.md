---
id: forge-tilemaps-paint
title: Tiles mode — palettes, the map file, painting
kind: story
status: review
system: forge
parent: forge-tilemaps
save: ''
updated: 2026-09-15
invariants:
- two-validation-layers
- ast-surgical
done:
- Every pack under src/assets/tilemaps browses as a palette without a hand edit to any glob
- A region's map is painted in the forge over the spot editor, spots draggable on top and snapping to tiles
- The map file is <region>.map.json, reprinted whole; maps.gen.ts and sheets.gen.ts are regenerated on apply
- Floor 0 migrated with an identical picture; a checkout without the packs still builds and falls back
- tests/tilemaps.test.ts covers the readers, the printer round-trip, the generated modules and the painting helpers
- docs/TILEMAPS.md written; TUTORIAL §4 and FORGE.md point at it
---

# Built 2026-09-15

Everything durable is in [TILEMAPS.md](../TILEMAPS.md). In one breath: the
forge scans the pack folders (`forge/server/tilemaps.ts`, readers in
`tmx.ts`), serves sheet pixels straight off the dev server, and a **🧱 Tiles**
toggle on the World Map turns the right-hand column into a palette. Brush,
fill (tiled or seeded scatter), eraser, erase-area and picker paint
`store.maps[region]`; a stroke ends with the map staged WHOLE as one
`tilemap` patch op, and the patch route writes the JSON plus the two
generated modules under the usual diff-and-backup gate. Undo is per region.
Stamps come from a sheet rectangle or from a pack's example map with every
checked layer at once, each landing on a same-named layer.

# Review notes

- **The whole-file exception.** The map file is the one thing the forge
  reprints instead of editing surgically. The justification is in
  TILEMAPS §3; if it ever grows hand comments, that justification is gone.
- **Undo after a stroke leaves the op staged** even when the grid is back to
  what is on disk; the diff then says "nothing would change". Harmless, a
  little untidy.
- **Rename of a region moves its map file** (a delete op plus a fresh write),
  staged with the rename. Untested in the browser.
- **The palette's bare-PNG discovery** offers sheets no `.tsx` describes when
  they are at least 128×96 and not in a sprite/animation/premade folder. The
  heuristic is in `scanPack`; Grass Land went from 600 candidates to 51.
- Deleted: `floor0.map.ts`, `floor0.scene.json`, `tmx-compose.mjs`,
  `tmx-crop.mjs`. The preview page stays and reads the JSON.

