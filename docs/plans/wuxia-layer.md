---
id: wuxia-layer
title: Wuxia/xianxia cultivation layer
kind: story
status: todo
system: cultivation
parent:
save:
updated: 2026-08-09
invariants:
  - completability
  - modFingerprint
  - no-terminal-states
done:
  - A failed breakthrough is never a terminal state
  - raiseSkillCap finally has an authored caller
  - The per-save wuxing relation graph is a mod source and joins the fingerprint
---

# Wuxia / xianxia layer

> Seed recorded 2026-08-05. **Unshaped.** Full seed in [NEXT.md](../NEXT.md)
> §"Parked: four subsystem seeds". Reference notes in
> [Wuxia_Xianxia.md](../Wuxia_Xianxia.md).

Cultivation tiers, **three stages each**; each breakthrough is an escalating
quest **that can be failed**. Allegiances: daoists, orthodox, unorthodox,
demonic cult, solitary. Dantian types. The five energies, with the player able
to **break the rules by substituting** elements and rewiring their personal
wuxing relations. Hunting great elemental beasts for their cores.

## Hooks already waiting

- **`raiseSkillCap` is tested and unwired** — breakthroughs are the authored
  caller it has been waiting for.
- The ten elemental resist skills give substitution something to grab.
- Allegiance standing can copy the deity-favor pattern, including
  met-before-favor (see `deities-must-be-met`).

## Genuinely new

A **failable-attempt framework** — probably the thing that finally forces a real
quest chassis into existence — and the per-save wuxing relation graph.

⚠️ "Can be failed" is the phrase that most directly threatens
[COMPLETABILITY.md](../COMPLETABILITY.md). Failure must cost something without
closing anything.
