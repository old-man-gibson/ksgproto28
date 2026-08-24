---
id: demon-lord-army
title: The demon lord's army — conquest run
kind: story
status: todo
system: world
parent:
save:
updated: 2026-08-09
invariants:
  - completability
done:
  - Run-type vs defection is decided before anything is built
  - Exclusive kit is ordinary `requires` gating, not a parallel system
  - The world fights back — reconquest pressure exists
---

# The demon lord's army

> Seed recorded 2026-08-05. **Unshaped.** Full seed in [NEXT.md](../NEXT.md)
> §"Parked: four subsystem seeds".

Start as the lowest-rung member, conquer territories, climb by fighting the rest
of the world. Different constraints but also bonuses, magic and techniques not
normally accessible.

## Inverse cost profile from the other seeds — system-light, content-heavy

The conquest substrate **already shipped**: `fightLimit` clears spots,
`slain:*`/`fights:*`/`flag:*` counters, forced fights, restock via `set`.
Exclusive kit is ordinary `requires` gating.

**Genuinely new:** an origin/path choice, and the world fighting back —
reconquest pressure is a natural first consumer of the planned post-prestige
**time-gated events** (see `time-and-weather`).

## ⚠️ Settle first

**Run-type chosen at new game, vs. defection in play.** Everything else depends
on this and it is a one-line decision that has not been made.

## Why it may be the best-value seed

More of it is already built than any of the other three, and none of what
remains is a new mechanic. If the goal is a subsystem that lands quickly, this
is the one.
