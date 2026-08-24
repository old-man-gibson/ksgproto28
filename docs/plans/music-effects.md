---
id: music-effects
title: Music effects — the point of the whole chassis
kind: story
status: draft
system: music
parent:
save: 41
updated: 2026-08-09
invariants:
  - modFingerprint
  - classification-must-stay-total
done:
  - Effects are keyed on the archetype bucket, and the bucket joins modFingerprint
  - Classification stays TOTAL — every composition reads as something
  - Performance setup (instruments, venues) exists
---

# Music effects

> Chassis shipped 2026-08-05 (save v41). Full spec and open list in
> **[MUSIC.md](../MUSIC.md) §Open**.

The composer, the full classifier stack (Krumhansl-Schmuckler, contour, motion,
interval content, LHL syncopation, Shannon entropy), total nearest-centroid
archetype reading, coda reprise/turn, and the performance loop with XP all
exist. **What does not exist is any reason to play.**

⚠️ **New mod source ⇒ `modFingerprint`.** Key on the archetype bucket, never on
the raw feature vector.

## The identity that must not be broken

**"Analysis names the product."** The classifier must stay **total** — every
composition reads as *something*, including bad ones. The moment a composition
can fail to classify, this collapses into hidden recipes and stops being the
thing it was built to be. Same law as the blueprint resolution function.

## Also open

Performance setup (instruments/venues), tab gating, ties across barlines,
balance.
