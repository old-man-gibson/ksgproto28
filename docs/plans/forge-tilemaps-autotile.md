---
id: forge-tilemaps-autotile
title: Autotile — the packs' own Rules, interpreted
kind: story
status: todo
system: forge
parent: forge-tilemaps
save: ''
updated: 2026-09-15
invariants:
- two-validation-layers
- ast-surgical
done:
- Painting a kit's marker tile on an input layer and pressing Automap yields the artist's wall and floor pieces, as Tiled would
- rule0 / rule1 / rule2 semantics honoured: erase, place, weighted variations; MatchInOrder and Probability read
- A Wang terrain brush works on any sheet whose .tsx carries wangsets
- Automapping runs on demand and, optionally, after every stroke
---

# Design (from the epic, §2)

`forge/lib/automap.ts` interprets Tiled 1.9 automapping as the Epic RPG World
packs use it. A rule map has `input_<layer>` / `output_<layer>` pairs and no
`regions` layer: each rule is a connected component of the non-empty cells
across all input and output layers. Five marker tiles from
`:/automap-tiles.tsx` (Empty, Ignore, NonEmpty, Other, Negate) shape the match.
For every rule and every position in the target, if the input pattern matches
the working layer, the output cells are written; `rule2` carries per-rule
`Probability`; `MatchInOrder` on the map means rules apply in file order.
`AutomappingRadius` from the example map bounds the pass around a stroke.

Readers already return everything needed: `PackInfo.rules` lists the rule
maps, `api.tiles.tmx` parses one (markers arrive as gids of the `automap`
pseudo-tileset), and `SheetInfo.wangsets` carries the terrain sets for the
cheaper Wang brush. If the Rules interpreter proves nastier than it looks,
the paint story stands on its own: stamps off the example maps are how floor
0 was built.

