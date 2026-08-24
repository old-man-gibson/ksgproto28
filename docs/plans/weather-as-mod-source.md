---
id: weather-as-mod-source
title: Weather as a modifier source
kind: story
status: draft
system: weather
parent: time-and-weather
save:
updated: 2026-08-09
invariants:
  - modFingerprint
done:
  - Modifiers key on the BUCKET (kind + temperature band), never the raw float
  - The bucket joins the derived-stats modFingerprint
  - Travel edge tick multipliers land first, as the cheapest felt hook
---

# Weather as a mod source

⚠️ **This is a new mod source, so it MUST be added to the derived-stats
`modFingerprint`** — see [ENGINEERING.md](../ENGINEERING.md) and the
`derived-stats-cache` rule. Forgetting this is the single most likely way to
ship a subtly wrong build.

**Quantize before fingerprinting.** Key modifiers on the bucket (`kind` +
temperature `band`), not the float, or the memo thrashes every game minute.

## Already outside the block, on purpose

Exposure XP and the darkness combat penalty are shipped and deliberately stay
OUTSIDE the derived-stats block — they are XP grants and roll-time factors, the
same lane as `requiresMonsterTag`. No fingerprint change was needed for those,
and none should be added.

**Cheapest felt hook: weather multiplies travel edge ticks.** Start there.
