---
id: time-and-weather
title: Time, calendar, climate and weather
kind: epic
status: execution
system: weather
parent:
save: 43
updated: 2026-08-09
invariants:
  - modFingerprint
  - completability
done:
  - Weather is a real mod source, bucketed so the derived-stats memo does not thrash
  - Named events are detected from the field, not rolled, and witnessed ones freeze into the save
  - The player can read the weather, not just be affected by it
---

# Time & weather

> Shipped portion is fully documented in **[WEATHER.md](../WEATHER.md)** — this
> card tracks only what remains. Full remaining spec in [NEXT.md](../NEXT.md)
> §2, not moved yet.

**Steps 1–3 shipped 2026-08-04.** The calendar (13 × 28 + 4 holy days,
`clockOf`), climate baselines, the unit-variance anomaly field with
`weatherAt(seed, region, ticks)`, the atlas **Sky** overlay, and Chronosense
with its level-20 ceiling. No save change — seed = hash(createdAt), clock =
totalTicks.

## Still open, deliberately

- **Month/weekday names** are TODO-marked scaffolding in `climate.data.ts` —
  lore is the author's.
- **Terrain calls to confirm**: westlands, stillail_hamlet, and whether the
  player base yard feels weather.
- **Cap-raise sources are not wired.** `raiseSkillCap` exists and is tested but
  nothing calls it. Nothing consumes `timePenaltyMult` either; it is the
  mandatory hook for any future time-based penalty.
- The Azgaar **cells GeoJSON** waits on the map being final.

## Stories

- `weather-as-mod-source` — the first real gameplay hook.
- `named-weather-events` — detected, not rolled.

## The stated purpose, for sequencing

After the first two or three prestiges, **time-gated events** arrive, surfaced
through the player base's **hint system** (not yet built). Hints name dates, and
Chronosense is what makes dates readable. That is what the calendar was for.
