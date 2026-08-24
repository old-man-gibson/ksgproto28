---
id: mutagenic-monsters
title: Mutated monsters — a body wearing more than it was born with
kind: story
status: draft
system: monster
parent: monster-genomes
save:
updated: 2026-08-13
invariants:
  - completability
  - no-terminal-states
done:
  - MonsterInstance can carry a genome that differs from its species
  - A mutated specimen is legible before it is fought, not after
  - What it drops follows what it was wearing
---

# Mutated monsters

The last story of [monster-genomes](monster-genomes.md), and the one the user
named as the reason the epic is worth doing:

> mutated monsters who incorporate other genes to some degree, like a
> "mutagenic slime" having not just its own gene but several genes at once to
> make it a top-tier threat

This is the **instance-side** half. It is deliberately last: it is the
expansion, and def-side is the foundation. Attempting it first means the
authoring saving never arrives.

## What it rides

`MonsterInstance.mutation` already exists, `string | null`, set to
`mutation: null, // milestone 2` at spawn and read by nothing. This is that
milestone, and the mutagen system turning out to be the same feature.

The existing per-specimen axes — `tier`, `modifier`, `rarity` — are the model:
rolled at spawn, part of what the specimen *is*, transient with the encounter
except that the encounter is saved.

## ⚠️ This is the save bump

Everything before this story is content and systems. This one puts a field on
`MonsterInstance`, which lives in `state.combat.enemies`, which is saved. **46
→ 47.** A migration nulls the field on any in-progress fight; a monster that
was ordinary when the save was written stays ordinary.

Do not let an earlier story sneak a field onto `MonsterInstance` — the
no-migration property of stages 1–5 is what makes the epic safely resumable
across sessions.

## The threat has to be READABLE

A top-tier threat the player cannot see coming is not a threat, it is an
ambush that reads as a bug. Three things, all of which the game already has
somewhere:

- **A name.** The modifier/rarity axes already rename a specimen. A
  three-gene slime should say what it is before the first swing.
- **A bestiary face.** Discovery already pays for cataloguing; a mutated
  specimen is a genuine find and should read as one.
- **The blow says which gene.** Combat already itemises damage and names its
  steps. A player who cannot tell which gene hit them cannot learn the fight.

## Open, to settle before building

- **Rolled or authored?** A `mutagenic_slime` species that always carries three
  genes is authored, and is a different feature from a wolf that rolled a
  mutation. Both are wanted; they are not the same story and the naming should
  not pretend they are.
- **What governs how many.** The player pays capacity (`CAPACITY_BASE` + the
  Geneshaping ladder) for everything on a chromosome. A monster pays nothing,
  so *something* has to bound it or "several genes at once" has no ceiling.
  Candidates: tier-scaled capacity, a per-species cap, or the genome simply
  being fully authored with no roll. **Settle before building** — this is the
  same unpriced-capability problem [genome-capability-rule](genome-capability-rule.md)
  answers for grants, one level up, and it should not be answered by accident.
- **Drops.** If a specimen wore three genes, does it drop all three? Following
  "what a thing drops is what it is" says yes, which makes hunting mutated
  specimens the fast route through the gene catalogue — probably good, and
  definitely a balance decision rather than a consequence to discover later.
- **Does a chromosome need to be legal?** The player's is bounded by capacity
  and by which edges are established. A monster's could be arbitrary, which is
  freedom the author may not want — an illegal-for-a-player body is content the
  player can then never wear, and MUTAGENS.md §7a's law about persistence cuts
  both ways here.
