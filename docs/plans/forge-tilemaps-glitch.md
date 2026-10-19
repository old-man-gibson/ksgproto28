---
id: forge-tilemaps-glitch
title: Fake doors glitch until revealed
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
- A fake door bound to a still-hidden edge or unclaimed find flickers to the real door piece every 10–25 s for ~120 ms, seeded per cell
- Once revealed (visibleEdges, or the find claimed) the real door draws permanently
- prefers-reduced-motion disables the flicker; the wall stays a wall until revealed
- Tiled animation frames (SheetInfo.animations) ride the same loop
---

# Design (from the epic, §4)

`TileMap.svelte` learns `meta.doors`. A requestAnimationFrame loop runs only
while a drawn region with at least one fake door is shown. The glitch is a
teachable reveal (COMPLETABILITY: critical-path knowledge must be teachable);
hidden access is never on a critical path, so it only ever shortens a
discovery. Needs the game's reveal state for finds as well as edges.

