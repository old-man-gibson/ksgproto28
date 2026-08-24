---
id: region-reorder
title: Region drag-and-drop reorder in the forge
kind: story
status: draft
system: forge
parent:
save:
updated: 2026-08-09
invariants:
  - ast-surgical
done:
  - A reorder-entries AST op moves a property before or after a sibling, in place
  - Hand-written comments survive the move — tests/forge.test.ts still passes
  - Region tabs have drag handles
---

# Region drag-and-drop reorder

Pure tooling, no game change. Region order in the world map **is key order in
the data file**, so this needs a **reorder-entries AST op** in
`forge/server/edit.ts` (move a property before or after a sibling, in place,
comments intact), plus a patch op and drag handles on the region tabs.

Not to be confused with the **World Atlas**, which shipped — that places regions
in space; this orders their tabs.

⚠️ `tests/forge.test.ts` asserts comments survive every edit. A reorder that
reprints the object will pass a naive eyeball and fail that test, which is the
test doing its job.

## Why it was "start here"

It is the smallest card on the board with no design questions left in it. Good
for a session with no appetite for deciding anything.
