---
id: deities-must-be-met
title: Deities must be MET before they grant favor
kind: story
status: draft
system: divine
parent: yshicna
save:
updated: 2026-08-09
invariants:
  - completability
  - save-migration
done:
  - Per-deity known/unknown state; deeds pay only known gods
  - Every deity has an authored way to be found
  - The divine tab shows unlit silhouettes for the unmet, the way the bestiary does
  - Migration — anyone the save already holds favor with is someone you have met
---

# Deities must be met before they grant favor

> Full text in [NEXT.md](../NEXT.md) §Prerequisite. Not moved yet.

Independent of yShicna', and required for "hard to find" to mean anything.
Today `grantFavorAll` pays the entire pantheon for every deed, so standing
accrues with gods the player has never heard of.

The two aberrants should be genuinely obscure: **not a location you walk to, but
a condition you satisfy without knowing you are satisfying it.** Ik'Thel'the
*noticing you* is a different event from finding a temple.

## Why it is a good first story under the epic

It is the only one of the three that is useful on its own — the pantheon gets
better immediately, with no new god written — and it is the smallest. If the
epic stalls on the `MiracleDef`-cannot-express-a-passive question, this ships
anyway.
