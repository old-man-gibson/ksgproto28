---
id: migrate-next-into-cards
title: Move NEXT.md's parked prose into the cards that now index it
kind: story
status: todo
system: meta
parent:
save:
updated: 2026-08-09
invariants:
  - docs-survivability
  - single-source-of-truth
done:
  - Each parked section's full prose lives in its card, not in NEXT.md
  - NEXT.md keeps "Shipped recently" and "Invariants worth not breaking" — those are reference, not work
  - No card says "not moved yet" any more
---

# Migrate NEXT.md into the cards

The cards created on 2026-08-09 are **headers over prose that still lives in
[NEXT.md](../NEXT.md)**. That is deliberate — the board was built additively so
nothing was destroyed before it had been seen — but it leaves two sources of
truth, and that is not a resting state.

## Why it was not done in one go

⚠️ **This repo had no git when the board was built.** A bad shred of a 763-line
handoff document was unrecoverable, and NEXT.md is the single most valuable file
in `docs/` for the stated survivability goal, so a mechanical-but-irreversible
conversion wanted a look first.

Git landed **2026-08-24**, and that blocker is gone: a bad shred is now one
`git checkout` away from undone. What is left here is the decision below, not
the risk.

## The split, once decided

- **Becomes cards:** every `## Parked:` section, plus the open items under §2.
- **Stays in NEXT.md:** "Shipped recently (context, not TODO)" and "Invariants
  worth not breaking". Neither is work. The invariants list in particular is
  reference material that every card points *at* — it must not be sharded
  across sixteen files.

Whether NEXT.md then survives as a thin index or is deleted outright is the
open question. Leaning: it stays, as the prose companion to the board, holding
exactly the two sections above.
