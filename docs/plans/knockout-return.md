---
id: knockout-return
title: Knockout return — go back to work after a knockout
kind: story
status: review
system: combat
parent: ''
save: ''
updated: 2026-11-04
invariants:
  - completability
  - no-terminal-states
  - forced-roads-are-chosen
  - john-pacing
done:
  - After an eligible knockout the character recovers to 95% HP and resumes the activity it was doing, without input
  - Five knockouts in a row at one spot send the character to its last proven hunt, and it retries after 200 wins or 2 h
  - No path makes the character walk into a forced fight it did not choose
  - The longest automatic hold is 80 minutes; no state idles for the rest of a session
  - tests/john.test.ts passes unchanged
---

# Knockout return

User, 2026-11-03: "I really hate how a knockout can just stop you dead in your tracks. If you 'roll'
poorly in a combat encounter, you end up doing nothing and just have to contend with simply being
given bonus time."

Today every knockout retreats to the last haven and clears the activity (src/core/systems/safety.ts,
rule of 2026-09-12). The character then idles. docs/NAVIGATION.md §6 recorded that idling was
accepted. It no longer is.

Made by two brainstormers and one antagonist-design pass (verdict FIX FIRST, all objections
accepted). §6 lists the questions for the user.

## 1. Measured

- Recovery from 1 HP to 60% takes about 4 s. From 60% to 95% at the rest rate takes about 2.3 s.
- A knockout cycle costs about 14.5 s and earns no kill: the blow, waking, the walk back, the next
  fight. A win cycle takes 5.5–8 s.
- Floor-4 hunt over 8 h:
  - 1 loss in 300: about 296 wins today (94% of the time idle), about 5,191 with a return.
  - 1 loss in 3: about 2 wins today, about 1,550 with a return.
- 74 hunt spots exist. 8 are their own haven. Every landing on floors 0–14 and 17–20 is a haven.
  - 28 spots have `fightLimit`.
  - 2 are forced spots.
  - 4 can be entered only by forced roads.
  - 10 more have a forced road among their ways in.
- John, the balance driver, took 3 knockouts in band 1 (seed 42). Two were at forced spots: the toll
  collector and the puppet bureaucrat.

## 2. The rule

### 2.1 Return (K1)

- The retreat to the haven stays.
- Hook the four knockout sites: combat.ts `onDefeat`, and the three condition sites in actions.ts
  (~641, ~677, ~720). Do not hook `retreatToSafety` itself: `forfeitFestival` also calls it, and that
  is not a knockout. The pool-fatal site does not call `endFight`, so do not read eligibility from the
  ledger.
- Capture the activity before the retreat nulls it.
- While a return is pending, recovery runs to `max(0.95, huntRest target)` instead of 60%. If HP
  regen is 0 or less, it stops at 60%, the same valve huntrest.ts uses.
- When recovery ends:
  - If the haven is the target, start the activity in place.
  - Otherwise walk there with `goAndDo`. The activity starts on arrival.
- Eligibility. All of these must hold:
  - The outcome is a knockout.
  - An activity was running.
  - The fall spot is not forced.
  - The route's last hop is not a forced road: `edgesFrom(prev).find(e => e.to === target)?.forced`.
  - No hop of the route passes through a forced spot.
  - Not a festival floor.
  - Not the stronghold wall `f11_wall` (question 4).
  - `canStartActivity` is true at return time.
- A knockout that is not eligible goes to the fallback (2.3) instead of idling.
- `selectActivity`, travel, climb and caravan clear the pending return. The clear lives in
  `actions.selectActivity`, not in the UI. tests/john.ts calls `selectActivity` while recovering, so
  John keeps today's behaviour and tests/john.test.ts does not move.

### 2.2 Loop guard (K2)

- `stats['ko:n:<spot>']` goes up by 1 per knockout at the spot. A win at the spot deletes it.
- At 5, the return to that spot is refused and the fallback applies.

### 2.3 Fallback and retry (K3)

- `proven`: the last hunt spot where the character won 10 fights in a row.
  - It excludes `fightLimit` spots, forced spots and festival floors.
  - It is re-checked when it is used: the spot must not be cleared, an encounter must be eligible
    now, it must be reachable without a forced hop, and it must not be on a higher floor than the
    character.
- Limited fallback (user, 2026-11-04): ten wins in a row cannot happen at a `fightLimit` spot, since
  band-1 budgets are 1 to 6. When no `proven` spot is usable, a `fightLimit` hunt spot qualifies if:
  - it is discovered and not cleared;
  - the character has won there (`win:n:<spot>` of 1 or more) and has not been knocked out there
    since its last win;
  - it passes the `proven` re-checks (not forced, not a festival floor, not `f11_wall`, reachable
    without a forced hop, not on a higher floor than the fall, an encounter eligible now).
  - A usable `proven` spot always wins over a limited one. Among limited spots, the most recent win.
  - Its fights count toward the 200-win retry; the 2 h cap is unchanged.
  - The "no knockout there since the last win" test holds for as long as the fallback lasts. A
    knockout at the current limited fallback disqualifies it at once: the pick is made again.
    (The unlimited `proven` fallback keeps §2.4: return to it, and hold after 5 in a row there.)
  - When its budget is spent, the pick is made again, with the wins and the clock carried over. With
    none left: hold on the target, or with no target (a forced-spot loss) end the return. The hunt
    at the spent spot stops, so the character idles.
  - Every pick ceilings at the floor of the fall, not of the spot being replaced: the pending return
    records it as `from` (save v64; an older one uses the target's spot). Floor 1 spent, floor 2
    still qualifies for a fall on floor 3.
  - A hold after a spent fallback waits where the character stands: the cleared spot, which spawns
    nothing. A hold after a knockout waits at the haven, as in the Hold bullet below.
- Fallback: go to `proven` (or the limited spot) and hunt there. Cross-floor: `climbTo` down, then walk.
- Retry: after 200 wins at the fallback, or 2 h of game time, whichever comes first, return to the
  target.
- Hold: with no usable `proven` spot, stay at the haven. Banking applies, as idle does today.
  - Probe the target after 10 min.
  - Each failed probe doubles the wait: 10, 20, 40, 80, 80 min.
  - A win resets the schedule.
  - The longest hold is 80 min.

### 2.4 State

```ts
// GameState, optional (backfilled by deserialize; reset by prestige through createInitialState)
pendingReturn?: {
  target: { spot: string; activity: string } | null; // null: the target is not eligible to retry (forced, wall)
  phase: 'return' | 'fallback' | 'hold';
  fallback?: { spot: string; activity: string };
  wins: number;        // wins at the fallback this phase
  until?: number;      // tick: end of a hold, or the 2 h fallback cap
  probes: number;      // failed probes, for the doubling
  from?: string;       // the fall spot, set at every fallback (save v64): the ceiling for its picks
} | null;
proven?: { spot: string; activity: string } | null;
```

Transitions:

| Event | Phase | Result |
|---|---|---|
| Knockout, eligible, streak below 5 | any | `return` to the fall spot |
| Knockout, streak reaches 5 | `return` | `fallback` if proven is usable, else `hold` |
| Knockout, not eligible (forced, wall, forced hop) | any | `fallback` with target null if proven is usable, else idle |
| Win at the fallback | `fallback` | wins + 1; at 200 or at `until`, `return` to the target (if any) |
| Knockout at the fallback | `fallback` | return to the fallback; 5 in a row there: `hold` on the target |
| Hold ends | `hold` | probe: `return` to the target |
| Knockout on a probe | `return` | `hold`, wait doubled |
| Win at the target | `return` | pending return cleared; normal hunting |
| Player selects, travels, climbs, uses the caravan | any | cleared |
| Prestige | any | cleared |

### 2.5 Defeat summary and log (K4)

- The defeat summary dialog opens only when no return or fallback follows. The ledger is still
  written, and the Fight Feed still opens it.
- One log line per knockout says what happens next. Examples:
  - "Knocked out by Rare Goblin. Returning to The Deep Woods."
  - "5 knockouts in a row at The Deep Woods. Hunting The Treeline for 200 wins."
  - "No safer hunt known. Retrying The Deep Woods in 10 min."

### 2.6 Offline

- Catch-up runs the same ticks, so all of the above applies to 8 h away.
- Cost: idle catch-up takes 1.6–2.9 s per 8 h and hunting about 5.3 s, so a return adds at most
  2.5–4 s per 8 h.
- The return report (item B1 of ui-proposals) lists knockouts, fallbacks, holds and idle time.

## 3. Tests

- `tests/knockoutReturn.test.ts` covers:
  - A fall at f4_deep_woods: haven, 95%, walk, then hunting.
  - Forced spot, forced last hop and festival floors never walk back.
  - The 5th knockout goes to fallback, and 200 wins lead to a retry.
  - A knockout at the fallback keeps the target.
  - A cleared proven spot is not used.
  - The hold schedule: 10, 20, 40, 80, 80 min.
  - Select clears the pending return.
  - A save round-trip keeps it.
  - Prestige clears it.
- `tests/john.test.ts` passes unchanged.
- A hopeless-spot simulation over 288,000 ticks never idles longer than 80 min at a stretch.

## 4. Docs to update when built

- docs/NAVIGATION.md §2.1 and §6: the retreat now leads to a return, and "idling accepted" is removed.
- docs/CONTENT_GUIDE.md ~604: the knockout paragraph.
- The comments at actions.ts:356 and on `CombatState.forced` in types.ts. Both still describe the
  pre-2026-09-12 rule.

## 5. Not taken

- Recover in place without the retreat. It reverses the 2026-09-12 retreat.
- Resume at the haven's own work. 63 of 71 hunt spots have no work at their haven.
- A return allowance of tokens. It brings back the dead stop at moderate spots.
- A "Back to work" button. That would be a go-link, which the Wayfinding boon sells.
  Superseded 2026-11-04: navigation-alternatives N7 (Stations) gives free go links to worked
  places, and its "Back" row is approved. K1 still owns knockouts: while `pendingReturn` is
  set, Stations does not offer the fall spot (navigation-alternatives §9, Q3).

## 6. Questions for the user

1. After 5 knockouts in a row: fall back to the last proven hunt and retry after 200 wins
   (default)? Or only hold and probe?
2. After a knockout at a forced spot (a gate boss such as the toll collector): hunt the last proven
   spot (default)? Or idle as today?
3. Harbor waters (floors 12–13, 19–20) are entered only by forced roads. May the return walk that
   forced road again, with one unfleeable fight on the way, since the player chose that water once?
   Default no: fall back instead.
4. Stronghold wall: its 8th win prestiges automatically. May an absent character keep returning to
   it? Default no: fall back instead.
5. Add a "Shaken" yield penalty per knockout? Each stack is −10% gold, skill XP and attribute XP, up
   to 5 stacks, for 60 s. Default: not now.
6. Add a Combat-tab setting "After a knockout: return / stay"? It is one saved field. Default: not
   now.

## 7. Decisions (user, 2026-11-04)

Marked on the decision page. Every mark matches the default.

| Item | Decision | Effect |
|---|---|---|
| The plan (K1–K4) | Approved | Build as written in §2 |
| Q1 Fallback | Approved | 5 knockouts in a row: hunt `proven`, retry after 200 wins or 2 h |
| Q2 Forced-spot loss | Approved | After losing at a forced spot: hunt `proven` (target null), else idle |
| Q3 Forced roads | Rejected | The return never walks a forced road; it falls back instead |
| Q4 Stronghold wall | Rejected | `f11_wall` is not a return target; it falls back instead |
| Q5 Shaken | Hold | Not built |
| Q6 Setting | Hold | Not built; the return always applies |
| Limited fallback | Yes (asked after the build) | After a band-1 boss loss the fallback may hunt `fightLimit` spots that still have fights left (§2.3) |

## 8. Build log

**Branch and checks.**
- Branch `ko-return`, a2767d3 plus five fix commits (tip 3ad0e1c), merged into
  `ui-integration` ef34619.
- Save v63: migration 62→63 sets `pendingReturn` and `proven` to null.
- `npm run verify` on the merged tree passed with 3,365 tests. tests/john.test.ts passes unchanged.
- The test save on port 5599 migrated with gold, kills and ticks intact.

**Code.** src/core/systems/knockoutReturn.ts.
- `selectActivity` is the player's pick and clears the return. Its body moved to `startActivity`,
  which `settleArrival` uses, so the return's own arrival keeps it.
- The `Game` commands clear the return on success.

**Antagonist-code: FIX FIRST.** Three confirmed findings, all fixed with tests that fail without
the fix:
1. The stale activity read in `tickAction` spawned a fight on the road after the 2 h retry. The
   fight was never ticked again, a permanent stall. Fix: the activity part stops on a tick that
   sets out, and no encounter spawns while travelling.
2. A probe whose road was shut ended the return. It now holds again with the doubled wait.
3. A knockout at the fallback just after the retry replaced the target. The fallback is now
   carried into the `return` phase.

**Manager rulings.**
- A knockout with no activity running, and not in a forced fight, does nothing beyond the
  retreat: a player idling to bank bonus time stays idle.
- Forced fights count as work. Travel clears the activity, so without this an ambush loss could
  never fall back (Q2, Q3).
- A target that is only temporarily unreachable (a shut road, an activity that cannot start
  now) is kept: fall back to `proven` with the same target, or hold.
- The target becomes null only for the permanent causes: a forced spot, a forced road, the wall,
  a festival floor.

**Simulations, 8 h each.**
- Hopeless spot with no proven hunt: longest stall 1 tick, longest idle 80 min (the hold).
- Hopeless spot with a proven hunt: longest idle 0.12 min (recovery), 9,239 kills.

**Open.**
- Most band-1 hunt spots have `fightLimit`, so `proven` stays empty there. A loss to a floor-1
  gate boss ended idle under Q2's "else idle". Put to the user 2026-11-04: allow limited spots
  (§2.3). Measured on tests/john.ts (seeds 42 and 7, 29 knockouts): no knockout changes, since
  John clears every limited spot before the boss that follows it. The rule matters to a character
  that loses at a boss while another limited spot still has fights left.
- While a hold waits, the only way to cancel it is to start an activity and stop it.
  navigation-alternatives N7 shows the pending return with a "Stay here" control.
- The defeat-dialog gate in App.svelte has not been checked in a browser. Its deciding function,
  `defeatDialogDue`, is unit-tested.
