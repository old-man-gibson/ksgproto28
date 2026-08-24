---
id: genome-capability-rule
title: Capabilities do not cross to a monster by default
kind: story
status: draft
system: mutagens
parent: monster-genomes
save:
updated: 2026-08-13
invariants:
  - capability-grants-are-costed
  - two-validation-layers
done:
  - MONSTER_LEGAL_GRANTS names every capability a monster may carry
  - A species opts in per grant; inheritance is never the default
  - Both validation layers reject a genome carrying a grant that is neither legal nor opted into
---

# Capabilities are costed against a chooser

Rule 2 of [monster-genomes](monster-genomes.md).

MUTAGENS.md §7 is the most important rule in the system for how it feels to
play: **capabilities are free, magnitudes are capped.** A cheap gene should
reach every trick. That is safe because the capability is costed *elsewhere* —
against a player who committed to a body, spent the capacity, ate the settling
period, and gave up whatever the other body did.

**A monster pays none of that.** It is handed the body. So the same rule that
makes capabilities generous for the player makes them unpriced for a monster,
and the fix is not to cap them — that would break §7 — but to decide, per
species, that it has one.

## What the measurement makes cheap

Of the 12 grants authored across all genes, **11 are equipment grammar**:
`arms:+1/+2/+4`, `onehand:*`, `onehand:blunt`, `onehand:spear`,
`onehand:greatsword`, `onehand:tower shield`, `telekinetic:6`.

Every reader of those — `floatingSlots`, `heldGrips`, `handSwingShare`,
`armsUsed`, `armCost` — takes a `GameState` and reads `state.equipment`. A
monster has no equipment, so they are **inert by construction**. Nothing has to
be built to make them safe, and nothing should be: an extra-armed asura monster
that cannot wield anything differently is the honest outcome until the
extensible slot model MUTAGENS.md §13 plans for actually exists.

So the rule only has to govern the ones that would bite.

## The rule

- **`MONSTER_LEGAL_GRANTS`** — a named set in `systems/mutagens.ts`, beside
  `INERT_GRANTS`, which is already the single fact the panel and
  `format.ts:describeGrant` both read. Today: `ignores_dodge`,
  `splits_target`, `refutation`.
- **Per-species opt-in.** A genome-bearing monster lists which of them it
  actually carries. Silence means none.
- **Both validation layers** reject a genome carrying a grant that is neither
  on the list nor opted into. A rule in `tests/content.test.ts` is mirrored in
  `forge/lib/validate.ts`; the test suite is the authority.

## ⚠️ `ignores_dodge` is the one to be careful with

On a monster it deletes the player's entire evasion stat from that fight. That
is a categorically different proposition from the player deleting one
monster's: the player built evasion over a whole character, and a single
species can turn all of it off with no counterplay and no warning.

It stays on the legal list — it is a real and interesting thing for a boss to
have — but it is exactly why the default is off. A species carrying it is a
deliberate act by an author who has thought about what the fight is for.

`refutation` deserves the same care for the same reason, one layer over: it
does not delete a stat, it deletes a *school*.

## What this does not do

It does not cap or scale a capability on a monster. §7's law is that
capabilities read the same off a cheap thing as an expensive one, and a
monster-side exception to that would be a second physics. The lever is **which
species carries it**, and that is the only lever.
