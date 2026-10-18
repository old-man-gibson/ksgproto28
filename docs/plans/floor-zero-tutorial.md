---
id: floor-zero-tutorial
title: Floor 0 — the tutorial, and the first drawn map
kind: story
status: review
system: meta
parent: alpha-band-one
save: '54'
updated: 2026-09-15
invariants:
- completability
- no-terminal-states
- two-validation-layers
done:
- A new save opens in the holding cell on floor 0 and the panel walks nine steps to the Foot
- The rack (spear / sword / dagger / hammer / unarmed, shield beside a one-handed pick), a stance, and one of fire / ice / spark are each chosen once
- The Cell Slime deals exactly 1 per landed hit and takes several from any rack weapon
- Skip tutorial ends it at once with the old opening (rusty sword, Neutral, no spell)
- Older saves and prestiged runs never see it (migration v54, prestige stamps the flag)
- Floor 0 is drawn from the Old Prison and Grass Land tiles; a checkout without the packs falls back to the diagram
- npm run verify green; docs/TUTORIAL.md written
---

# What was built (2026-09-15, save v54)

The user's ask (three lines): a Floor 0 holding-cell → prison → field → gate
tutorial that explains combat by letting the player pick a weapon (shield
optional beside one-handed picks), a stance, and one of three one-word spells;
a weakened slime that deals 1 and takes several hits; a skip; and the tile
packs put in `src/assets/tilemaps` to make the map look like a place.

Everything is in [TUTORIAL.md](../TUTORIAL.md). The shape, in one breath: four
spots on a bandless floor with a one-way gate into the Foot; nine derived steps
(first `done` that is false), three of them choices that stamp a flag through
a Game method; `MonsterDef.fixedDamage`; `MapCard` painting a composed tile
scene under its diagram.

# Review notes (the numbers are yours)

- **The spell's cost.** The ask said "4 mana"; a one-word sentence is 2
  (`ARCANE_WORDS.fire.mana` × `STACK_MANA[0]`). Built to the data, and the pick
  trains INT to 2 so it can be cast at once. If 4 is the intended price, raise
  the word costs and `TUTORIAL_SPELL_INT` together.
- **`spark` needs Arcana 3** at the table. The tutorial writes the grimoire
  entry directly, so a fresh speaker gets it; the table itself still refuses
  it until Arcana 3, which is a small inconsistency the player can meet later.
- **The freeze rule.** alpha-band-one is still `review` and this card entered
  `docs/plans/` under the user's direct ask; filed as a story under it.
- **The scene is a first composition**: a cell block cropped whole from the
  Old Prison example map beside a scattered grass field, a dirt path and a
  palisade gate. The seam between building and field is a hard edge. A
  proper exterior wall column and a door tile are the obvious next touches;
  both are scene edits, no code.
- The goldfish was not extended for the choices (user, 2026-09-15: no longer a
  design constraint). It still passes: it wanders out through the gate.
