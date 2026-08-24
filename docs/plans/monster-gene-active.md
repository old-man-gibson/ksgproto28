---
id: monster-gene-active
title: A monster can use its own body's tool
kind: story
status: draft
system: monster
parent: monster-genomes
save:
updated: 2026-08-13
invariants:
  - completability
done:
  - MonsterAction has a gene variant the author places in rotation order
  - A genome ability resolves through the same seam the player's does
  - A monster with no genome, or a genome with no ability, is unaffected
---

# The signature move

Rule 4 of [monster-genomes](monster-genomes.md), and the story that closes the
gap [asurendra-monsters](asurendra-monsters.md) found: *a monster has no way to
use a gene's ability.* `MonsterAction` is `({ cast: SpellSource } | { technique:
string })`, and a gene ability is neither — `SpellSource` covers arcane
sentences, miracles and psionic shapes.

## The variant, and why it is not the workaround that was rejected

```
MonsterAction = ({ cast } | { technique } | { gene: true }) & { uses?: number }
```

The earlier ruling said **do not build this**. That ruling was right about a
variant used as a *substitute* for the missing genome — it would have been a
second place to author an ability that the gene already describes.

With the genome in place it is the opposite thing: the ability is authored once
on the gene, and this is where the author says **when the monster reaches for
it**. `MonsterDef.rotation`'s own comment is the standard it answers to —
*"a monster's character is authored by sequence alone"*, workings and
techniques sharing one list precisely so no category outranks another. A gene
ability is the third category and takes the same treatment.

Automatic placement was considered and rejected both ways: appended makes the
signature move a fallback (a troll bites only when it has nothing better to
do), prepended makes every genome-bearing monster open identically.

## Resolution goes through the existing seam

`geneAbility(bearer)` is already the single seam every consumer uses —
`pickActive`, the rotation card, the chromosome panel — and it returns the
**resolved** ability with `applyActiveArm` folded in. The monster path calls
the same function with itself as bearer. Nothing new decides what a gene
ability is.

Which means a monster's routed Active arm re-types its bite, its
`inflicts_<status>` grants land, and `splits_target` splashes — for free, on
the day the genome exists. That is the epic paying out.

## What must keep working

- `uses` and the per-entry cooldown clock behave as they do for casts and
  techniques. One clock keyed by rotation index, already built.
- `pricesABlow` / `abilityCarries` already answer honestly for volleys and
  wind-ups. A monster asking them gets the same answers.
- A monster with no genome, or a genome whose main gene has no `ability`, skips
  the entry the way it skips a cast it cannot afford — no crash, no empty turn.
- The damage report must name the monster's ability the way it names its
  workings. A blow with no line in the log is a blow the player cannot learn.
