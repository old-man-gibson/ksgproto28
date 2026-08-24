---
id: monster-def-genome
title: MonsterDef.genome — what a thing drops is what it is
kind: story
status: draft
system: monster
parent: monster-genomes
save:
updated: 2026-08-13
invariants:
  - completability
  - two-validation-layers
done:
  - MonsterDef.genome exists and MainGeneDef.from is deleted
  - geneFrom reads a monster's genome instead of scanning genes backwards
  - A genome supplies damageType, inflicts and size as defaults a species may override
  - A lint names every gene no monster carries, and it is a warning rather than a failure
---

# The genome lives on the monster

Rule 1 of [monster-genomes](monster-genomes.md). One fact, one place, one
direction.

## Why the pointer has to be deleted rather than validated

The obvious cheap fix is a lint: `MainGeneDef.from` must name a real monster.
Measured 2026-08-13, that lint fails on **20 of 32 genes** — the whole
gigantoid genus, the whole draconic line, all 7 asura bodies. Only the 9 slime
genes resolve. Shipping it would mean authoring twenty monsters before anything
else in this epic could move.

Inverting the direction deletes the problem instead of paying it. A monster
carries a genome; `geneFrom(monsterId)` reads it. There is no pointer left to
dangle, and the 20 orphans become **"genes no monster carries yet"** — a real,
visible, honest fact that a lint can report as a warning without blocking
anything.

## The shape

```
MonsterDef.genome?: { main: string; quality?: QualityTier; placed?: … }
```

Def-side and static, so it costs no save and caches by def id forever. The
instance-side layer that lets *this* slime carry three genes is a separate
story ([mutagenic-monsters](mutagenic-monsters.md)) and must not be pre-built
here — but the field shape should not foreclose it.

## Defaults, not seizure

The genome supplies **`damageType`, `inflicts` and size**; an authored field on
the species wins. This is what halves the authoring load without removing
per-species tuning:

> ⚠️ **`resistances` are NOT on this list.** They come from tags — see
> [tag-resistances](tag-resistances.md), already shipped. A gene's resistance
> lines are a *contribution* on a player who also has skills and gear; a
> monster's are its *whole* profile. Routing the genome into them would either
> flatten every monster 3–5× or make one gene swap outclass Lv40–90 of a
> resistance skill.

- With no genome, a monster is authored exactly as it is today. Nothing
  existing breaks.
- With a genome and no overrides, a new monster is
  `id + name + art + tags + attrs + genome`.
- With both, the override wins and the lint says nothing — a fire slime that
  wants 0.5 heat resistance where its gene says 0.1 is tuning, not an error.

⚠️ Do not resolve defaults at spawn into `MonsterInstance`. Read them through
the def, the way `innateResistances(defId)` already does. Baking them into the
instance would make the genome a save field and break the epic's no-migration
property.

## Migrating the nine

`slime_base_basic/advanced/elite`, `boss_slime_guardian`, `slime_golem`,
`slime_king`, `slime_fire`, `slime_fire_advanced`, `slime_fire_elite` each gain
`genome: { main: '<their gene>' }`, and the corresponding `from:` lines come
out of `mutagens.data.ts`. Drops are unchanged in behaviour — same nine
species, same nine genes, read the other way round.

**AST-surgical.** Comments in both data files are load-bearing documentation
and `tests/forge.test.ts` asserts they survive. Never reprint an entry.

## The lints, both layers

- **Warning:** every `MainGeneDef` no monster carries. Names all 20 today. A
  warning, not a failure — an unclaimed gene is a content gap, and blocking on
  it would recreate the problem this story exists to delete.
- **Error:** a `genome.main` that names no `MAIN_GENES` entry.
- **Error:** a genome placing a mutagen id that does not exist.

## A note on `MonsterDef.wears`

Used by **no monster in the game**. It was invented for a species that was
never authored, because `MainGeneDef.confers` is player-only. Once `confers`
crosses over on the bearer seam, `wears` is a duplicate of it in the other
direction. Do not delete it in this story — it is harmless and something may
still want a condition that is not gene-derived — but flag it, and if nothing
claims it by the time the epic closes, it goes.
