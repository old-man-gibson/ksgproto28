---
id: named-weather-events
title: Named weather events — detected, not rolled
kind: story
status: draft
system: weather
parent: time-and-weather
save:
updated: 2026-08-09
invariants:
  - save-migration
  - determinism
done:
  - Threshold is baked from incidence (~1%), not from sigma tables
  - Witnessed events freeze a small record into the save; future weather stays derived
  - Names are deterministic from (seed, start tick, origin region, phenomenon)
  - Both tails are named — good weather too
---

# Named events

> Full rules in [NEXT.md](../NEXT.md) §2 "Named events". Not moved yet.

A named event is a connected blob in (space × time) where |anomaly| ≥ threshold.

- **Threshold from incidence, not σ.** Summed noise octaves are not Gaussian in
  the tails — don't use σ tables. Bake the 99th percentile per phenomenon at
  build time from sampled centuries. Retune the field ⇒ re-bake.
- The 1% arrives in **clumps** sized by the top octave's time wavelength.
  Hysteresis (enter high, exit lower) so events don't flicker.
- **Integrated severity** ranks events; only the top tier earns a name. This is
  the "how mythic is the world" knob.
- **Names are deterministic**: hash → a name-parts registry (`catalog.ts` +
  `registry.ts` re-export; `ARCANE_WORDS` is the shape to copy). Calendar
  surname for free — "the Howling of Late Embermonth" is also a timestamp.

## Generator vs chronicle

Everything derived rewrites history if the field is ever retuned. So
**witnessed** events freeze a small record into the save (name, dates, regions,
peak). Future weather stays derived; experienced weather becomes history.
Almanac UI and "vintage" hooks (brews bottled during a named event) fall out of
this.

**Honest forecasting**: the field's future is computable, so divination and
deity weather prophecy are real mechanics, not flavour.
