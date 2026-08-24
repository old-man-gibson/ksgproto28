---
id: blueprint-weaponsmithing
title: Blueprint weaponsmithing — the proportions name the product
kind: epic
status: planning
system: crafting
parent:
save:
updated: 2026-08-09
invariants:
  - completability
  - modFingerprint
  - drops-stay-unique
done:
  - The resolution function is TOTAL — every dimension combo yields something, degenerate ones included
  - Discovery replaces unlocks; the archetype chart fills in as combos are tried
  - Basic forge recipes are absorbed as fixed-proportion blueprints, not left beside it
  - Drops remain the only source of named, unique effects
---

# Blueprint weaponsmithing

> Full design in [NEXT.md](../NEXT.md) §"Parked: blueprint weaponsmithing",
> including the eight-verb prototype sketch and the material matrix. Not moved.

Weapon crafting as a **shape grammar**: nobody selects "dagger" from a menu. A
blueprint fixes the general shape; the *dimensions* of the parts you fit
determine what the thing IS.

Distinct crafting identity from the existing set — sum (cooking), when (stove),
sequence (alchemy), topology (mutagens), breadth (runecarving). **This one is
*the proportions name the product*.**

## Why it is in `planning` and not `draft`

One question is still open, and it is load-bearing:

> **Bespoke weapons with special effects.** Leading candidate: *effects are
> transplantable parts* — breaking down a named weapon yields its effect as a
> component that can be slotted into a blueprint. Drops stay the only source of
> permanent effects, so the generator never obsoletes loot.
>
> Rejected: effects-from-exotic-materials (generator could reproduce named
> drops) and sealed-bespoke (generator becomes a mid-game dead end).
>
> **Not decided.**

Everything else is settled. Once this is answered the card moves to `draft` and
the process layer (**count** as a seventh crafting identity — repeated verbs,
order-insensitive, antagonistic pairs) becomes its own story.

⚠️ Affixes stamped on a weapon instance are a **new mod source ⇒ add to
`modFingerprint`**.
