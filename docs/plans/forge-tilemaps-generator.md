---
id: forge-tilemaps-generator
title: The generator — rooms from spots, corridors from connections
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
- From a region's spots, declared connections, a kit and a seed: rooms painted, corridors routed, meta.rooms and meta.doors written, spot map coordinates staged to room centres
- Every room reachable by a walkable-cell flood fill from the start room — a lint in tests and a live check in validate.ts
- hidden connections and exploration finds become fake doors; requires becomes the locked gate; region exits get a marker
- Regenerate is cheap and the output is ordinary layers, hand-editable afterwards
- Threshold drawn with the Village kit as the first consumer
---

# Design (from the epic, §3)

**Kit** per pack in `scripts/tilemaps/kits/<pack>.kit.json`, authored once in
the forge: room floor, wall marker (autotile does the rest), corridor floor,
door pieces (real, fake, locked gate, region exit), weighted dressing props.
Outdoor packs use the same slots.

**Layout.** Room rectangles sized per room (`meta.rooms`, default medium),
centres seeded from the spot's existing `map` coordinates, overlaps pushed
apart, corridors by A* over non-room cells along declared connections, one
door cell per edge end. `hidden` edges and finds (user decision 4) get a
fake door drawn as wall. The generator is a brush, not a lock: paint lands on
ordinary layers and the author keeps editing.

