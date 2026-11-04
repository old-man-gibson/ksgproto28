---
id: ui-proposals
title: UI/UX proposals — screen frame, return report, busy screens
kind: epic
status: planning
system: ui
parent: ''
save: ''
updated: 2026-11-03
invariants:
  - no-save-change
  - completability
  - secret-content-silent
  - shuttered-tabs-hidden
  - tutorial-focus
  - map-only-travel
  - theme-tokens
done:
  - Every approved item below is built, with the test or check named in its Lock line
  - No item bumps the save version
  - Each built screen is screenshotted at 1440 x 900 in both themes, and A3 at 375 x 812
  - docs/TUTORIAL.md §5 and docs/THEMES.md are updated where an item changes what they describe
---

# UI/UX proposals

Asked 2026-11-03: "have the team properly work a few proper UI/UX proposals for the game."

Three proposals, nine items. Each item can be approved on its own. Mockups:
[ui-proposals/mockup.html](ui-proposals/mockup.html) (static, Gothic tokens, no bought art).

How this was made: a survey of the port-5599 test save (level 23, floors 1–6 cleared,
1,586 items), three brainstormers (frame, busy screens, return and phone), two
antagonist-design passes. Every objection was accepted; §5 lists them.

Baseline at 1440 x 900: header 88 px in two rows. Tab bar 72 px in two rows (11–12 tabs).
Tab body about 802 x 695 px. Left column 270 px, log column 320 px. At 375 px the grid
keeps 240px | 1fr, so the tab body gets about 99 px and the tab names clip.

## 1. Questions for the user

1. **Combat Stats.** The four groups sit in the sidebar by your 2026-10-17 decision
   (NEXT.md "Sidebar: Combat Stats are four click-to-open groups"). A2 needs room in the
   left column. Keep them there below the screen list (the column scrolls, as it already
   does at 900 px), or move them to the top of the Equipment screen? Default: keep.
2. **Gothic as the default theme.** Open since 2026-10-21. The mockups are drawn in Gothic.
   Default keeps the button.
3. **Phone.** A3 is the largest item and its per-panel pass is not included. Build it only
   if you play on a phone.

## 2. A. Screen frame

### A1. One-row header

- Save, Export, Import, Reset and the theme button move into one Menu button. The Menu
  window gives each action one fact line and lists the keys: Space or P pause, Right +1 tick,
  Shift+Right +1 s, N next event. Reset keeps its confirm().
- The dev button stays outside the Menu, so it shows during floor 0 as today.
- The status text becomes a job strip: icon, name, a bar for the current cycle, time left.
  Pure `currentJob(gs)` over these states: activity, travel, benchWork, performance,
  combat (front enemy HP share), recovering (HP share), resting before a fight
  (`restingForFight`), idle (no bar).
- Rate chip: gold per minute and kills per minute over the last 600 game ticks, from
  `stats['gold:earned']` and `stats.kills`. Memory only. Pause freezes it. It clears on a
  jump over 600 ticks, on a change of `prestige.count`, and on any sample lower than the one
  before it.
- Pause, +1, +1s, Next and the bonus toggle stay in the row. Behaviour unchanged.
- Floor 0: transport, weather and Menu stay hidden until the Foot, as today.
- Result: header about 50 px. Tab body +38 px.
- Lock: `tests/job.test.ts`. `currentJob` returns pct in 0..1 or null for every state.
  Stepping while paused keeps the rate. A 5,000-tick jump and a prestige both clear it.

### A2. Screen list in the left column replaces the tab rows

- One UI table `NAV` in `src/ui/lib/nav.ts`: id, group, label, icon, component, shown(gs),
  mark(gs). The `ui.tab` union, `MainTab`, the tabs literal and the 12-branch `{#if}` chain
  in App.svelte all derive from it. Adding a screen becomes one row.
- Groups in fixed order: Act (Location, Combat), Build (Skills, Ability, Equipment,
  Chromosome, Music, Wuxin), Records (Bestiary, Quests, Achievements, Prestige).
  Captions draw only when 6 or more entries are visible. A group with no visible entry
  draws nothing.
- `shown(gs)` holds today's filter chain: `subsystemUnlocked`, `prestigeVisible`,
  `gs.facets.length`. During floor 0, `tutorialScreen(gs).tabs` must also hold the id.
  The list arrives at step 4 with the sidebar, which is also the step the second screen
  arrives (tutorialFocus.ts:50).
- An entry that became visible and was never opened shows "new" until opened. Seen ids are
  in localStorage `ksgproto28-shell`, not the save. On the first load of an existing save,
  every visible id is marked seen, so nothing lights up.
- Attributes become a 3 x 2 grid of icon-and-value chips. Fused super-attributes get one chip
  per fused pair, read from `fusedDefs` and `soloAttrs` as Sidebar.svelte does.
- Combat Stats: see question 1. If moved to Equipment, the section hides while
  `tutorialScreen(gs)` is non-null, and the docs/TUTORIAL.md §5 row changes.
- Result: tab body about 775 px tall, +80 px. Capacity about 16 entries.
- Lock: `tests/nav.test.ts`. Every MainTab appears once in NAV. A fresh post-tutorial save
  lists exactly location, combat, skills, equipment, bestiary, quests, achievements. No group
  draws with zero entries. During floor 0 `visibleNav` equals `screen.tabs`.

### A3. Phone layout below 700 px

- One column. Sticky top dock: status text, gold, Menu, HP bar, four thin pool bars, Pause
  and bonus buttons, the A1 rate line. The dock class is `.dock`, never `.bar`
  (docs/PITFALLS.md §8).
- Below 700 px the Menu window also holds +1, +1s and Next, since a phone has no keys.
- Sticky bottom row: the same visible NAV entries, scrolling sideways.
- The log collapses to its newest row above the bottom row. Tapping opens a drawer.
- Sidebar splits: `ResourceBars.svelte` renders in the dock on phone and in the sidebar on
  desktop, never both. Attributes and Combat Stats render below the tab body.
- From commit 02c7dd8 (origin/claude/kind-tesla-7sqw30-mobile): take `Tip.svelte` unchanged
  (main's file equals that commit's parent) for tap and long press. Apply the
  `browserStorage` fallback in save.ts by hand. Do not take its area order: it puts HP below
  the whole tab body.
- Floor 0: the dock honours `tutorialScreen` (bars from step 4, gold from step 5, buttons
  after the Foot). The tutorial card is also sticky; its top offset adds the dock height.
- Above 700 px nothing changes.
- Not included: per-panel phone fixes, for example touch drag-reorder in CombatPanel,
  MartialPlanner and SpellcraftPanel (docs/ENGINEERING.md §2.4 estimates 2–4 days).
- Lock: screenshots at 375 and 800 px for every screen. `scrollWidth <= 375`.

## 3. B. What needs the player

### B1. Return report: Earned, Stopped, Waiting

Facts today:

- OfflineModal lists kills, gold, items and level-ups.
- Prestige review, evolution and dare dialogs sit at z 30, over the report.
- A backdrop click discards the report.
- Catch-up writes no log lines (`suppressLog`).
- A knockout clears the activity by design (src/core/systems/safety.ts:87, asserted in
  tests/combat.test.ts). The character then idles for the rest of the absence. The report
  does not say so.

The change:

- **Earned:** today's counters plus character level from → to.
- **Stopped:** always present. Branches are checked in this order:
  1. The festival held the save (`festivalSkipped`): say so and give the held time.
  2. A prestige happened during catch-up (`prestige.count` rose): "Run ended at the
     stronghold." Every diff then starts from the new run.
  3. Knocked out: count, last foe, time into the absence, then idle time and where.
  4. Otherwise: "Working: the whole absence."
- **Waiting:** rows from pure `waitingOn(gs)`:
  - Prestige review owed.
  - Evolution owed.
  - Dare owed.
  - A quest ready to turn in.
  - Nothing running.
  - A boon the next gated rung needs, with its cost and the unspent points. Shown while
    `prestigeVisible(gs)` holds.
  - Prestige open. Shown while `canPrestige(gs)` holds and the unspent points do not cover
    that boon.

  The section is omitted when empty. Each row has a button that only sets `ui.tab`.
- One dialog at a time, in this order: report, prestige review, evolution, dare, defeat
  summary. Deferred dialogs are save state and still open afterwards.
- The backdrop no longer closes the report. Closing keeps it in `ui.lastAway`. A "Last away"
  button in the log header reopens it until the next absence or reload.
- New `OfflineSummary` counters, gathered during catch-up: idleTicks, idleSince, knockouts
  {count, lastFoe, atTick}, floors cleared, quests finished, levels {from, to}. Nothing is
  stored per kill. The idle check is one `isIdle` call per tick.
- `waitingOn` returns [] while `tutorialActive(gs)`.
- Lock: `tests/offline.test.ts` and `tests/waiting.test.ts`. A weak character hunting above
  its level reports knockouts >= 1, and idle ticks plus worked ticks equal the total. Festival
  and prestige branches each have a case. `waitingOn` never returns the prestige row unless
  `prestigeVisible(gs)`.

### B2. Next-step line above the tab body

- New pure `rungTerms(gs, floor)` in `src/ui/lib/ladderView.ts`. It holds AscentPanel's term
  selection for every state: locked, closed, shut (festival lockout and the floor-16 hall
  rule), gated, sealed, open. AscentPanel and `nextSteps` both call it, so the two cannot
  disagree.
- Pure `nextSteps(gs)`, in this order:
  1. Quests ready to turn in.
  2. The first card in `ladderBands` order that is a gated hub or an open or gated floor,
     with its `rungTerms`. A hub counts only while gated. An open hub is skipped.
  3. Offered quests at spots in `gs.discovered`, from `availableQuests`.
- If a term is an unowned prestige boon and `prestigeVisible(gs)` holds, the row adds the boon
  cost, the unspent points and `harvest(gs).total`. All three already show on the Prestige tab.
- Example (this save): "Next floor: The Castle Court, floor 7 hub. Needs: Own the Key to the
  City prestige boon." / "Key to the City: costs 3 points. Unspent: 5. Prestige now pays 24."
  [Open Prestige] [Hide].
- Why this example matters: the test save is level 23 with an empty Quests tab, hunting
  floor 4. The boon opens band 3 "on this run" and is already affordable. No screen outside
  the Prestige tab says so.
- Buttons only set `ui.tab`. No travel, no climb, no go-link. The Wayfinding boon sells those
  outside town (docs/NAVIGATION.md).
- Source law, test-locked: every string a row shows is a string its source panel (Ascent,
  Prestige, Quests tab, map card) draws for the same state.
- Hidden while `tutorialScreen(gs)` is non-null. Hide is a localStorage preference.
- `attentionOf(gs)`: ok, idle, knocked or held. It sets the line's colour token and
  `document.title`.
- The Quests tab's empty state lists the same rows instead of "No quests yet".
- Computed on a 1 s timer, not per tick.
- Lock: `tests/glance.test.ts`, with the antagonist's two states as cases:
  - Floors 7–9 cleared with the key owned: the line names floor 10.
  - Festival lockout: the line gives the lockout text.
  - Mutation: a floor added beyond the next band never appears.

## 4. C. Busy screens

### C1. Log: hunt lines fold per 30 s

- Measured (scripted hunt at f4_woods_edge, 600 s): 310 kills, 595 log lines, 1.92 lines per
  kill. 52% Defeated, 22% "appears", 23% material drops, 3% item drops. `LOG_MAX` 60 holds
  about 60 s.
- Defeated, scavenged gold and material-drop lines get group `hunt`. They fold into one line
  per 30 s of game time (300 ticks) through the existing `logRepeat` tally.
- Item, rune, boss and keeper-slain, skill, quest, achievement and bestiary lines stay separate
  and end the run.
- "appears" lines stay only when `modifier !== 'normal'` (demiboss, boss, aberrant) or rarity
  is rare or epic. Common and uncommon normal spawns leave the main log. The Combat tab's
  fight feed still shows "X attacks!".
- LogEntry gains optional `since?` and `window?`. The fold check reads `last.since ?? last.t`.
  Old saved lines render unchanged. No version bump: `deserialize` spreads defaults.
- A line shows at most four labels and "+N more". The tooltip lists the rest.
- Result: about 41 lines per 600 s. The 60-line log covers about 15 minutes.
- Lock: `tests/log.test.ts`. 20 routine events inside 300 ticks give 1 line. An item line
  splits the run. A demiboss spawn line is kept.

### C2. Inventory: spare marks and compare to worn

`beats(a, b)` is true when all of these hold:

- Same `defId`.
- Same size (`size ?? 'medium'`).
- a's summed modifier terms, affix included, are >= b's on every (stat, op) key. For
  lower-is-better keys (`damageTaken`, `critTaken`, `stumbleTaken`) the comparison flips.
- a's rune slots are >= b's. While runecarving is shuttered, a slot difference makes the pair
  incomparable, so neither beats the other.
- a and b are not equal.

Items that are never compared:

- Items with conditional mods: requiresTag, requiresStyle, requiresMonsterTag, perLevel,
  levelCurve, fromStat.
- Forged items.
- Festival-issued and lent items.
- An item named in a saved Loadout.

Hand slots: for a def that fits a hand, the best K copies are kept, where K is the number of
hands (`armsFrom(bearerGrants(gs))`) minus hands holding a different def. Only copies past K
can be spare.

What the player sees:

- A stack is spare when a held or worn item beats it.
- `stackKey` gains size, so a stack is one size.
- Spare tiles are dimmed with the class `.spare`, never `.dim`, or hidden. The toggle is UI
  state.
- Toolbar line: "63 stacks: 10 kept, 53 spare".
- "Sell spares" calls the existing `sellItems` at the existing `sellPrice`. `confirmSale` for
  max rarity stays. Socketed runes return to the pile, as today. No buy path changes, so the
  no-arbitrage law holds.
- The empty-slot picker and the item window show deltas against the worn piece, for example
  "Armor: +3 vs worn". Rune slot counts show in the picker. Non-spare rows come first.

Lock: `tests/gearcompare.test.ts`, with these cases:

- The plain, Sturdy and Sharp vest example.
- Medium plain against large Sharp: incomparable.
- Two light daggers with an empty off hand: neither is spare.
- Runecarving shut: a 3-slot plain sword is not spare.
- Property: a slot class never loses all its stacks.

### C3. Location: activities above the map, cleared bands fold

- A strip above the map holds the activity buttons, the Next bar and exploration. While
  travelling it holds the travel bar.
- The map and its hover cards do not change (docs/NAVIGATION.md; the user does not want the
  popovers changed).
- Ascent ladder bands become `<details>` at every width. A band folds only when every floor
  in it is cleared and the player is not standing in it. Every band with an uncleared floor
  stays open, so no gate term is hidden. A folded band is one line: name, floor range,
  "3 of 3 cleared".
- Overrides live in `ui` memory and reset on reload.
- The tutorial still finds `activity:<id>` by class, and App scrolls to it wherever it sits.
- This retires `BANDS_PER_GROUP`. `tests/ladderView.test.ts` changes in the same commit.
- Lock: a band holding an uncleared floor is never folded.

### C4. Combat: rank numbers and move buttons on rotation cards

- Each card gets a gutter with its rank number, an up button and a down button. They call
  `game.moveSkillTo`, which already steps across benched entries (tests/triggers.test.ts).
  Drag stays.
- The two hint paragraphs become one line, "Fires: top to bottom. Click a card for
  conditions.", plus a tooltip that carries the bench and slot facts.
- The same `rotationEditable` gate applies. Loadouts snapshot the same list.
  Technique slot caps are enforced at learn time, not by order, so a move cannot exceed them.
- Lock: `tests/rotationview.test.ts`. With a benched id between two visible cards, up then
  down restores the order.

## 5. Antagonist objections and rulings

All accepted. The plan text above already includes each fix.

| # | Item | Objection | Evidence | Ruling |
|---|---|---|---|---|
| 1 | B2 | Hub is "open" for the whole band, so the line names the Castle Court after floors 7–9 clear | script, confirmed | A hub counts only while gated |
| 2 | B2 | Festival lockout reads "gated" with no gate, so the line shows no reason | script, confirmed | Shared `rungTerms` for panel and line |
| 3 | B2 | "Ascent panel strings only" fails on its own boon-cost example | text | Source law names four panels |
| 4 | A2 | Combat Stats on Equipment would show at floor 0 step 5 | code | Hidden while tutorialScreen; §5 row |
| 5 | A2 | Moving Combat Stats reverses a user decision | NEXT.md:42 | Question 1, default keep |
| 6 | A2 | Six chips cannot show fused super-attributes | code | One chip per fused pair |
| 7 | A1 | Rate goes negative after a prestige | code | Clear on prestige or a lower sample |
| 8 | B1 | Auto-prestige during catch-up reported as the absence's result | code | Prestige branch in Stopped |
| 9 | B1 | Festival hold from tick 0 reads "Working: the whole absence" | code | Festival branch first |
| 10 | A3 | Step controls unreachable on phone | plan text | +1, +1s, Next in the phone Menu |
| 11 | A1 | Dev button lost during floor 0 | code | Stays outside Menu |
| 12 | A1 | Job strip drops "resting before the next fight" | code | Added as a job state |
| 13 | C2 | `beats` ignores item size: a large Sharp dagger does less DPS than a medium plain one | script, confirmed (295 vs 275) | Same size required; size in stackKey |
| 14 | C2 | A worn copy marks the copy the off hand needs as spare | code | Keep best K per hand count |
| 15 | C2 | Shuttered runecarving drops slots and sells slotted gear | code | Slot difference = incomparable while shut |
| 16 | C1 | "boss" is a modifier tier, not a rarity | data | Keep on modifier or rare/epic |

Notes taken without objection:

- Lower-is-better keys flip in `beats`.
- `.spare`, not `.dim`.
- C3 now folds only fully cleared bands.
- C3 fold overrides reset on reload.
- `ladderView.test.ts` changes with C3.

Both antagonists found no secret leak, no terminal state, no go-link and no arbitrage loop.

## 6. Not taken

- Per-screen column widths (left 270/150/off, log 320/line/off). Conflicts with A2. Main width
  jumps 452 px between screens.
- A notices list above the log with count marks. Overlaps B1 and B2. Every notice source is a
  possible secret leak. Its "new screen" signal is kept as A2's "new" word.
- Command palette. It would list places, which duplicates the map, or index hidden systems.
- Skills, Spellcraft, Bench and Music panels. The survey found no layout defect there; their
  size is content plus scoped CSS.

## 7. Suggested build order

1. C1 and B1. No frame dependency. They fix the two verified gaps.
2. A1 and A2 together. One builder: both edit App.svelte.
3. B2. Needs the `rungTerms` extraction and sits in A2's frame.
4. C2, C3, C4. Separate files, one builder each.
5. A3 last, if approved. It builds on A1 and A2.
