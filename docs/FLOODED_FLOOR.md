# Floor 1 — the Flooded Offices

The first progression floor now follows three sections: drive out vermin,
search the records for the clerk's daybook, then follow its office-room sequence
to the submerged toll collector. Movement uses the existing location system;
the office section has a 3×3 directory of named rooms.

## Playing the floor

- Camp on the landing. Six victories in the Vermin Hall reveal the Records
  Passage; the finite hall then stops spawning vermin. The first four are
  rats; slimes, which shrug off half a blade or a point, join only after.
- Search the Archive, Staff Lockers, and Forms Store repeatedly for salvage.
  The Archive can pay the daybook once per run, guaranteed by its fourth search.
  Finding it opens the Forms Store's door into Office Reception.
- Explore reception fully to obtain the office key. Room doors are locked
  until then. Key items are unsellable and readable in Location and Quests.
- Follow **Scribe → Auditor → Break Room → Scribe → Toll Collector**.
  These are room choices, not compass directions. A wrong ordinary room is
  still entered and shows "This is not the path to the toll collector."
  The sequence resets; entering the scribe's office starts a new attempt.
  Only an incorrect collector-office entry loops back to reception.
  The book, key, and searches are preserved.
  Partial sequence progress survives saves. Cleared offices stop looping.
- The golem interrogates for three seconds before either side can act, then
  fights without retreat. Defeat returns the player to their haven.
  Victory grants the toll stamp and pays the existing `boss:f1_toll_hall`
  floor/quest clear, preserving old saves' completed-floor records.

## First-pass combat tuning

The collector is a level-4 solitary construct with moderate physical armor
(STR 6, CON 16, armour 8). Ordinary attacks can defeat it. Offensive heat,
cold, and lightning spells apply distinct conditions for **80 ticks / 8
seconds**:

| Spell | Effect |
|---|---|
| Heat | Steam: 65% additional miss chance |
| Cold | Ice: zero dodge and 75% less armor |
| Lightning | Overdrive: 65% faster attacks, 12 lightning damage to itself when its action bar fills |

Reapplications refresh duration, never intensity or stacks. Different
conditions can coexist. Existing spells' native effects still apply.

**Retuned 2026-10-10** against John (`npm run pacing`, COMPLETABILITY §8). At
STR 4 / CON 10 / armour 4 the collector died in about ten seconds having
landed one blow, so no reaction ever mattered. Now the first attempt runs
20–35 s and the collector wins about one in four, and the tutorial's
spell pick moves those odds. Over 40 climbs each, the collector won the first
attempt against fire 14 times, spark 10 and ice 7; spark's overdrive also
cuts the fight to about 20 s against 26–28 for the others.

The secret **Procedural Objection** title is awarded if the victorious
encounter contains no player spell cast. Offensive, self-targeted, automatic,
and legacy skill spells count; merely preparing one does not. A disqualified
win has no title message. Eligibility is checked before the kill event so
the ordinary title listener awards it immediately.

Fights remain transient on save, as elsewhere in the game. The spell-used
flag is stored in the run's counters so reloading cannot erase a cast;
an uncleared forced encounter resumes on the next action tick. A resolved
encounter clears that flag. Prestige resets key items, search reward limits,
office sequence progress, and the spell-used flag along with the run.

## Authoring and implementation

- `ActivityDef.kind: 'search'`: `ticksPer` plus `rewards`. One weighted reward
  per completed cycle. Rewards accept find payloads, including `keyItem`;
  `limit` caps that entry per spot/activity/run, `requires` gates it, and
  `guaranteedBy` prioritizes an eligible, never-awarded result once its search
  count reaches that threshold. An exhausted table pays nothing. Cycle speed
  factors work like other activities. Search rewards do not consume explore finds.
- The forge's spot inspector exposes Search, its cycle duration, and its JSON
  reward table. Shared validation checks reward IDs, weights, limits, timing,
  references, amounts and writable counter namespaces.
- `KEY_ITEMS` is a browsable forge registry. Ownership uses
  `flag:key_item:<id>`; no new save field or migration is needed.
- `Connection.revealWhen` controls directional visibility, independently of
  exploration and travel requirements. Used by the vermin passage.
- `StatusStacking.refreshDuration` allows a highest-intensity condition to
  refresh its timer on an equal-strength application.
- `systems/floodedFloor.ts` owns the floor's room sequence and boss hooks;
  `systems/search.ts` owns repeatable search rolls. Runtime room IDs and the
  office directory must stay consistent when renaming these rooms.
- `tests/flooded-floor.test.ts` covers the route, reward bounds, saves,
  statuses, spell tracking, brute-force victory, and prestige.

Content names and numbers are a playable first pass. Global skill XP is unchanged.
