---
id: alpha-tower-runtime
title: Tower runtime — the ladder works
kind: story
status: review
system: meta
parent: alpha-band-one
save: ''
updated: 2026-09-06
invariants:
- completability
- no-terminal-states
- two-validation-layers
done:
- floorCleared / floorUnlocked / rungStatus / climbTo exist and are unit-tested (tests/towers.test.ts)
- The ladder UI shows every rung with readable terms; a shut door always names what opens it
- Connection.requires exists, is directional, and refuses travel readably
- Both validation layers enforce the sequential-ascent rules
- npm run verify green
---

# What was built (2026-09-06)

`src/core/systems/towers.ts` — the runtime `FloorDef.gate` and `clear` waited
for, under the rules settled in the parent card:

- **`floorCleared`** — `conditionsMet(state, floor.clear)`; a floor with no
  clear reads NOT cleared (never trivially open — the lint keeps that shape
  off the ladder anyway).
- **`floorUnlocked`** — sequential: every banded floor below cleared AND the
  floor's own gate met. Off-ladder floors are never "unlocked"; their doors
  are authored edges (the hold).
- **`rungStatus`** — cleared / open / gated / sealed, with sealed outranking
  gated so the ladder never blames a gate for a rung that is shut by the
  floor below.
- **`climbTo(state, bus, floorId | null)`** — free movement between the hub
  and any unlocked floor, `null` = the hub. Ordinary travel with no edge:
  ticks = rungs crossed × `CLIMB_TICKS_PER_FLOOR` (45) ÷ travelSpeed, arrival
  handled by `tickTravel` (discovery, havens, ambushes all standard). Climbs
  grant Scouting XP like roads do — verified live: the first climb manifested
  Scouting.
- **`Connection.requires`** (types.ts) — advertised-but-locked roads. Checked
  in `startTravel` (readable refusal) and skipped by `findPath`; DIRECTIONAL
  like `forced` because the registry mirror carries neither. It shut the
  Hamlet Road for the alpha until the countryside was shelved (2026-09-12);
  it now shuts the hold's door at the Foot until the first prestige.
- **UI**: `AscentPanel.svelte`, rendered from LocationPanel wherever a stack
  is reachable (hub spot or any floor). Terms are translated to actions —
  "Slay the Coin Slime in The Toll Hall", "Earn 600 gold all-time (n/600)" —
  never raw counter keys. Locked edges render 🔒 with their terms in the
  Travel list.
- **Lints, both layers** (tests/content.test.ts + forge/lib/validate.ts):
  every banded floor has a landing in its own area and a non-empty clear; no
  rung's gate or clear names a skill; banded floor indexes run 1..n; clear
  counters point at spawns that can pay them (`once` spawn exists /
  fightLimit reaches the bar); **banded floor areas are closed** — no
  authored edge crosses the boundary in either direction (the mirror would
  open the way back). The two graph walks (reachability, no-trap) ride
  ladder pseudo-edges.

# Review notes

- `CLIMB_TICKS_PER_FLOOR = 45` is a first guess.
- **`clearsToAdvance` is now unread** (flagged in types.ts and
  towers.data.ts). Decide its fate: delete, or repurpose when bands grow
  checkpoint behaviour. The band's disjunction duty moved to per-floor clear
  authoring, linted as "no rung names a discipline".
- Map clicks cannot route onto floors (no edges); the ladder is the only
  door. Feels right at three floors — revisit at thirty.
- Fast travel between waypoints ignores `Connection.requires`; harmless today
  (a fresh save discovers no outside waypoint) but worth remembering when the
  world reopens.
