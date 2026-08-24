---
id: tag-resistances
title: What a body is made of answers for what it resists
kind: story
status: review
system: monster
parent: monster-genomes
save:
updated: 2026-08-13
invariants:
  - two-validation-layers
done:
  - TAG_RESISTANCES derives innate resistances from a species' tags
  - Every number in it came from the monsters that already declared one
  - A declaration still wins, per type rather than per block
  - Both validation layers reject unregistered keys and tags that disagree in sign
---

# Tag-derived resistances

Settled 2026-08-13, answering the user's question: *should resistances be
entirely derived from genes?*

**No — the axis is tags, not genes.** The reasoning is arithmetic rather than
taste, and it is worth keeping written down because the question will come back.

## Why not genes

The two vocabularies are ~3× apart and mean different things:

| | n | range | mean abs |
|---|---|---|---|
| Monster `resistances` | 197 | −1 … +1 | **0.498** |
| Gene `base.defenses` | 46 | −0.25 … +0.5 | **0.174** |

`slime_fire` heat is 0.50 on the monster and +0.10 on its gene. `slime_golem`
slashing is 0.75 and +0.18. That gap is structural: a monster's resistance is
its **only** source under `MONSTER_RESIST_CAP` 0.9, while a player's is a
**sum** — gene plus ten resistance skills plus gear plus training — under
`RESIST_CAP` 0.75. No single number plays both roles.

**The resistance skills are what breaks.** `resistTiered` reaches 0.43 at Lv30,
0.61 at Lv50 and **0.76 at Lv75** — one skill alone can hit the player's cap,
and there are ten of them, already wired to the exposure system
(`tests/phase2.test.ts` levels Heat Resistance by getting burned by fire
slimes). So:

- Genes at **monster scale** → the slime golem gene grants 0.75 slashing,
  instantly capped. Ten skills and the whole exposure line become dead content
  the day you swap a gene.
- Genes at **gene scale** → every monster drops 3–5×. Fire slimes stop being
  fire slimes.

Also rejected: a second `physiology` block on the gene at monster scale,
applying only when the gene is the whole body. It works arithmetically and
reintroduces exactly the two-facts-that-can-disagree problem
[monster-genomes](monster-genomes.md) exists to delete.

## What was built

The resistance mirror of `TAG_ARMOR`, one function away in the same file —
*"the declared value, or the toughest material its tags imply."* Resistances
were the one physiology stat that never got that treatment.

**Every number was derived from the species that already declare one, never
invented.** Across the 35 species these tags touch, the table reproduces **33
exactly**. That is the reason to trust it: the pattern was already in the data.

### Two shapes, because the data has two

- **Physical is FLAT per taxon.** Every base slime from `basic` to `elite` runs
  0.5 / 0.5 / −0.25. Every exception is a real identity — honey absorbs blunt
  (+0.35), wind is 0.3/0.7/0.2, metal is 0.9 across, the three bosses are
  hand-tuned. Being made of slime does not get slimier with rank.
- **Elemental is TIER-SCALED**, near-perfectly: fire heat 0.5 / 0.6 / 0.7 with
  cold mirroring at −0.5 / −0.6 / −0.7; lightning 0.7 / 0.8 / 0.9. Exactly
  +0.1 a step. An elemental line getting more elemental as it ascends is what
  the line IS, so rank belongs in the rule.

### Merge is per TYPE, not per block

"I am a slime, and I also resist heat" should be one line saying `heat`, not a
restatement of what slime already means. A species that genuinely wants none of
what its tags imply writes an explicit `0` — **absent means "whatever I am made
of", zero means "not that"**.

### Composition: the strongest opinion wins

Furthest from zero, sign preserved — `TAG_ARMOR`'s MAX made sign-aware. Adding
a tag may push a resistance further from neutral in the direction that tag
cares about, and may never cancel what another tag said. Summing would let a
body with four tags resist everything for having been described thoroughly.

Two tags **disagreeing in sign** about one type is a content error, not an
arithmetic outcome, and both validation layers reject it.

## ⚠️ Two monsters changed, and both look like omissions caught

33 of 35 are byte-identical. The two that moved:

- **`psionic_slime`** gains slashing 0.5 / piercing 0.5 / bludgeoning −0.25 and
  cold −0.7. It declared only `{ heat: 0.8 }`, which made it the one slime in
  the game with no physical resistance at all. Its own `heat` still wins.
- **`paladin_x`** gains cold 0.6 / heat −0.4. It carries the `ice` tag and
  declared neither.

Neither was suppressed, deliberately: catching this is what the layer is for,
and preserving its first two catches would defeat it. Both are worth a glance.

## Deliberately absent from the table

`water`, `wind`, `nature`, `earth`, `dark`, `holy`. Those slimes declare **no
resistance to their own element** today, which reads as a gap rather than a
decision — but filling it here would be a balance change smuggled in under a
refactor. Author it or don't; don't let a table decide it.

## What this changes upstream

[monster-genomes](monster-genomes.md) rule 1 said the genome supplies defaults
for *damageType, resistances, inflicts and size*. **Resistances come out of
that list.** The genome keeps damageType, inflicts and size; resistances are
tag-derived with a declared override, and the gene keeps contributing at gene
scale on both sides of the fight.
