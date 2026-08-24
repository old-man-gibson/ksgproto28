---
id: asurendra-monsters
title: The asurendras have no monsters — the whole tier is gene-only
kind: story
status: todo
system: monster
parent: monster-genomes
save:
updated: 2026-08-10
invariants:
  - completability
done:
  - Every MainGeneDef.from names a monster that actually exists
  - content.test.ts lints that, so the hole cannot reopen silently
  - A monster can use its own gene's ability
---

# The asurendras have no monsters

Found 2026-08-10 while authoring Anupama.

`MAIN_GENES.asurendra_tarunavak`, `asurendra_vashkara` and now
`asurendra_anupama` all carry `from: 'asurendra_<name>'` — "the species that
drops it" — and **none of those species exist in `monsters.data.ts`.** The
entire tier-5 body of work is a gene you cannot currently obtain.

## Why nobody noticed

`MainGeneDef.from` is not validated against `MONSTERS` in either validation
layer. `MutagenDef.from` is documented as a monster *tag*, `MainGeneDef.from` as
a *species*, and only the first has any checking behind it. Adding the lint is
the cheap half of this card and should probably land first, so the hole cannot
reopen once it is filled.

## The systems gap underneath it

⚠️ **A monster has no way to use a gene's ability.** `MonsterAction` is
`({ cast: SpellSource } | { technique: string })`, and a gene ability is
neither — `SpellSource` covers arcane sentences, miracles and psionic shapes.

> **Superseded 2026-08-10.** The first answer here was "add a third
> `MonsterAction` variant, or an ability field on `MonsterDef`". Both are
> workarounds. [monster-genomes](monster-genomes.md) is the real answer: if the
> monster **carries the genome**, its ability is the gene's ability, authored
> once, and this gap closes as a side effect rather than being patched.
>
> That also makes `from:` honest — what a thing drops stops being a pointer that
> can disagree with what it is.
>
> **Do not build the `MonsterAction` variant.** This card is now downstream of
> the epic and should be picked up after def-side genomes land.

## Anupama is the easiest of the three to author

Its Special already crosses over — `MonsterDef.wears` exists, and `fasting` is a
condition precisely so both halves can say the same thing (see
[anupama-fasting-amidst-sinners](anupama-fasting-amidst-sinners.md)). What it
lacks is only the active.

Tarunavāk needs `tongues` resolved monster-side; Vashkāra needs floating grips,
which lean on `CombatState.floating`. Both are heavier.
