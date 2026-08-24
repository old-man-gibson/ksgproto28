---
id: yshicna
title: yShicna', Logic Purified — the aberrant god of arcane magic
kind: epic
status: draft
system: divine
parent:
save:
updated: 2026-08-13
invariants:
  - completability
  - spell-cache-purity
  - legality-not-reading
done:
  - The god exists, is findable rather than granted, and grants no spells
  - Both scriptures are state-derived and mutually exclusive, with the fork visible in one panel
  - composeArcane and the SPELL_CACHE key are byte-identical to today
---

# yShicna', Logic Purified

> **Full design lives in [NEXT.md](../NEXT.md) §"Parked: the aberrant god of
> arcane magic"** — ~350 lines, including the verbatim identity block, the
> authored fourths, Dead Spells, and the engineering flags in cost order. This
> card is the header; the prose has not been moved yet.

An aberrant deity the player must *set out to find*. **It grants no spells.**
Its entire scripture is two passive miracles, both of them edits to the grammar
itself, and they are mutually exclusive.

Arcana's ladder — practise a word, master it, fold it — is the *middle*. Both
of this god's answers reject that middle: say a word once and mean it, or say it
until it stops being a word. It is not the god *of* arcane magic; it is the god
arcane magic is uneasy about.

## The seam that makes it safe

**Legality is state-dependent; the reading is not.** `checkSentence` decides
what you may say; `composeArcane` stays pure. Both miracles live entirely on the
legality side. **Nothing here may move into the reading** — that is the
invariant this epic is most likely to break by accident.

## Stories under this epic

- `excess-fourths` — Miracle A, permission to speak a word a fourth time.
  7 of 30 foldable words have an authored fourth; the card holds the roster,
  the coverage table and the per-spot saturation rule.
- `broken-areas` — what a place becomes when two fourths saturate it. A `todo`
  seed, and a hard dependency on shipping any second fourth.
- `atomic-aura` — Miracle B, the lowest speaking. Anti-grammar, not anti-magic.
- `deities-must-be-met` — prerequisite; independent of this god, required for
  "hard to find" to mean anything.

## Open before any of it

`MiracleDef` cannot express a passive — it is `spec` → always a castable spell.
Both scriptures here are permissions with no spec at all. Note that **titles
already do "a thing you wear that changes a rule"** (`dogmaDefied`), so
"passive miracle" and "title granted by a god" may be the same feature in
different clothes. **Decide before writing.**
