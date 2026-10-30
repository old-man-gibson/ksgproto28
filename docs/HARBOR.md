# The harbor band (floors 11 to 14)

*Band 4, at placeholder fidelity. Built 2026-10-30 on branch `ladder-harbor`
from docs/FLOOR_IDEAS.md §4 idea 3 (its rulings are the spec):
`data/sea.data.ts`, `systems/sea.ts`, `systems/seaValidation.ts`,
`ui/panels/SeaPanel.svelte`, `tests/harbor.test.ts`. No save change.*

## 1. What it is

On a run after the stronghold (`legacy:stronghold`), floor 11's road leads
to a harbor. Four berths each hold a recruiter; accepting one recruiter's
join quest picks that side for the run. Floors 11 to 13 are waters with a
convoy; the side decides which end of the convoy's flow the player is on.
Floor 14 holds one wing per side, ending in that side's mission boss.

| Side | Flow (`SeaFlow`) | Per leg | Paid |
|---|---|---|---|
| Merchants | `convoy` | crates lost = clamp(raiders + monsters − kills − battery, 0, crates) | crates left after leg 4, sold for gold |
| Navy | `escort` | crates lost = clamp(monsters − kills − battery, 0, crates) | crates left after leg 4, as cargo |
| Pirates | `raid` | crates seized = clamp(battery − (guard − kills), 0, crates) | each leg, as cargo |
| Privateers | `recover` | crates recovered = clamp(battery − (raiders − kills), 0, carried) | each leg, as cargo |

The privateers' convoy starts with all 8 crates aboard the pirate ships
(`startingCargo`): the pirates took it before the leg began.

## 2. Where the state lives

| What | Where |
|---|---|
| The side | the join quest's accept stamp, `flag:quest:<id>:accepted` (`quests.ts acceptQuest`, every quest gets one). Join quests require the other three stamps at 0 |
| The schedule | derived: convoy n sails ticks [3600n, 3600n + 1200), four legs of 300; each leg's raiders, monsters and guard are a hash of (water, convoy, leg) |
| The convoy the player sails with | `sea:<water>:convoy/leg/crates/carried` |
| Kills in the leg in progress | `sea:<water>:kills`, `sea:<water>:kills:leg` |
| Crates won (clears read it) | `sea:crates:won` |
| Crates credited offline | `sea:crates:offline` |
| Fights won on a water | `fights:<water>`, counted by `sea.ts` (a water has no `fightLimit`, so it never clears) |
| Floor 14 done | `flag:sea:14:done`, stamped when the side's `mission.monsterId` dies at `mission.spot` |

All of it is `state.stats`, so a new run (prestige) clears it.

## 3. A leg

A leg resolves on the tick that ends it (`legEnding`), only for a player
**present** at that water: standing on it, an activity running, not
travelling, not knocked out (`presentAt`). Idle there, the tick banks bonus
time instead; nothing resolves.

1. Legs since the stored one were sailed without the player: folded in with
   battery 0 and no kills (`cargoBefore`).
2. The battery fires (`fireBattery`): rating = volleys × hit + morale. The
   ship gives 1, 1, 0. Cannons held (up to 4, never spent) add a volley each
   when a cannonball is spent; a powder charge adds 1 hit; a traveler's
   ration (lowest grade first) adds 1 morale. One of each is spent per leg.
3. The side's prey killed at this water during the leg subtract (online
   only).
4. Crates credited online: `sea:crates:won`, then gold (merchants, at
   `dealPrice`) or one cargo material per crate from the water's row.
   Offline (catch-up, `Game.catchingUp`): `sea:crates:offline`, one cargo per
   4, never `sea:crates:won`, so a night away passes no clear.

The merchants' price per crate is 9 gold plus each Speechcraft threshold met:
5 (duty waived, +1), 15 (a broker, +2), 30 (haggled, +3).

## 4. The floors

| Floor | Spots | Clear |
|---|---|---|
| 11 | quay (haven; makes cannons, cannonballs, powder), four berths, the roadstead | `sea:crates:won` 8, `fights:f11_roadstead` 1 |
| 12 | Outer Port (haven, search finds the pirates' cove), the strait (all sides), four side lanes, Isle Anchorage (haven), far water | 40, `fights:f12_far_water` 1 |
| 13 | Last Port (pilot, harbor master), picket line, blockade | 160, `fights:f13_blockade` 1 |
| 14 | Staging Anchorage, then per side a water and the boss spot | `flag:sea:14:done` 1 (spine-lint exempt: `SPINE_EXEMPT` in towers.data.ts) |

Sailing out of a port onto a water is `forced` (a boarding); the way back is
free. Side lanes and wings are `revealWhen` the side's stamp; the lanes' way
back from the isle is authored `oneWay` with the same reveal, so no mirrored
edge shows another side's lane. Floor 13's approach: through the picket line
the player arrives Flat-Footed; through the Pilot's Channel (open once
`shop:buys:f13_pilot` ≥ 1) the blockaders start Surprised. Each side's
preparation quest, turned in, lays a condition on its floor-14 boss through
the wing's approach.

## 5. Not built

- Named ships (`once` lines on floors 12 and 13) do not yet remove escorts
  from the floor-14 boss: that waits on `SpotDef.preparation` (branch
  `band2-floors`). The bosses always bring four escorts.
- No ship scene (`SceneId`); the waters use the default backdrop.
- The port sale is a readout, not a dialogue. Privateers pay no fifth.
- Every monster is a `ph_` placeholder with no art.
