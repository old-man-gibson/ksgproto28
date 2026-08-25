---
id: region-reorder
title: Region drag-and-drop reorder in the forge
kind: story
status: review
system: forge
parent:
save:
updated: 2026-08-24
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

## What shipped, 2026-08-24

`reorderEntry(file, text, root, key, anchor, before)` in `forge/server/edit.ts`,
a `reorder` patch op through `plugin.ts` / `api.ts` / `store.reorder`, and
draggable region tabs in `WorldMap.svelte` with an `Alt`+arrow keyboard path.
`npm run verify` green: 1616 tests, nine of them new.

Three things worth knowing, none of which were design questions:

- **The last entry gets a comma it never had.** A registry whose final entry was
  written without a trailing comma welds itself to its new neighbour the moment
  it moves inward. There is a test named after this.
- **A one-line registry is refused, loudly.** The splice assumes entries own
  whole lines. A registry written `{ a: 1, b: 2 }` has no tab strip to drag and
  no comments to protect, so it throws rather than quietly producing `{ b: 2, a: 1, }`.
- **`del` and `rename` had to learn about it.** A staged reorder naming an
  entry that is then deleted would fail the whole batch at apply time, and one
  naming an entry that is then renamed would address nothing. Both now follow.

Still `review` rather than `complete`: the diff wants a human read, which is
what that column is for.
