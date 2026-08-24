---
id: atomic-aura
title: The lowest speaking — an anti-grammar aura
kind: story
status: draft
system: arcane
parent: yshicna
save:
updated: 2026-08-09
invariants:
  - completability
  - spell-cache-purity
done:
  - Folding degrades to tier 1 for everyone in the encounter, the player included
  - Statuses, multi-strike, miracles and psionics are untouched — it is anti-grammar, not anti-magic
  - Cost degrades with the token, so shallow-but-smart is a build and not a handicap
  - The 80% gate is computed as a share of FOLDABLE words, and latches in the save once offered
---

# Miracle B — the lowest speaking

> **Full design in [NEXT.md](../NEXT.md) §Miracle B.** Not moved yet.

Not a penance: an **aura**. Everyone in the encounter is held to the lowest
speaking. The cost to you is the delivery mechanism for the cost to them.

**A folded token DEGRADES to tier 1, it does not fail** — straight to the
bottom, whatever depth it was spoken at. Refusing the cast outright would
hard-lock any monster built on stacking.

## ⚠️ Scope, load-bearing, do NOT widen

- **Affected:** folding, and only folding.
- **NOT affected:** statuses escalate normally, multi-strike lands in full,
  miracles and psionics untouched.

An earlier draft generalised this to "nothing may deepen by being repeated",
which would have eaten bleed, poison and half the martial content.

## Blocked on content, not systems

**The aura is worth nothing until the bestiary has folded sentences in it.**
The plumbing already works — `MonsterAction = { cast }` resolves through
`composeArcane`, and mastery is gated in `checkSentence`, which only the player
goes through. A goblin may say `fire:3` without having earned it, which is
exactly the fiction.

Against a bestiary with no folded sentences, this costs the player their depth
and takes nothing back. **Authoring monster sentences is the real prerequisite.**
