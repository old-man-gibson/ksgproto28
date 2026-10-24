# Pitfalls — the traps this codebase has already sprung once

> Every entry here is scar tissue: a real bug, a real data loss, or a real
> afternoon lost, written down so it only happens once. Read this before
> touching `save.ts`, `derived.ts`, `statuses.ts`, or anything the UI proxy
> wraps. Companion to [ENGINEERING.md](ENGINEERING.md) (performance, phone)
> and [CONTENT_GUIDE §2](CONTENT_GUIDE.md) (content golden rules).

## 1. The Svelte proxy assignment trap

`src/ui/state.svelte.ts` wraps the whole `GameState` in a Svelte 5 deep
`$state` proxy and lets the pure core mutate it directly. That makes this
pattern a **silent data-loss bug** anywhere in `src/core/`:

```ts
const held = (obj.list ??= []);   // WRONG — held is the raw [], not the proxy's
held.push(x);                     // lands on an array nothing will ever read
```

```ts
obj.list ??= [];                  // RIGHT — assign, then read back through the proxy
const held = obj.list;
```

The assignment *expression* evaluates to the raw right-hand value, while the
proxy's `set` trap stores its own proxied copy. Anything pushed into the raw
value is invisible to the game.

**Why it is nasty:** it only misfires when the property was **absent** — so
it works perfectly for new games and fails only for players whose saves
predate the field. And it never reproduces in unit tests, which use plain
objects with no proxy. A passing test proves nothing here.

**Rule:** when core code lazily initialises any optional `GameState` field,
split the assignment onto its own line — and verify in the browser against a
save that *lacks* the field.

## 2. The live save is sacred

The save lives in `localStorage['ksgproto28:save']`, and **localStorage is
per-origin, which includes the port**. The dev config hands out port 5173
when free — and a browser profile that has been played on 5173 holds the
real playthrough. Editing `save.ts` while a live page is open once destroyed
a real save: a transient deserialize error mid-HMR made `loadFromStorage`
return null, the game booted fresh, and the `beforeunload` autosave
persisted the fresh state over the good one.

Rules that exist because of that day:

- **Before any risky change to save shape or load code: back the save up**
  (`localStorage.getItem('ksgproto28:save')` → another key or a file), and
  *verify vitals* (gold, kills, `totalTicks`) at backup time — a backup
  taken after unnoticed corruption is an impostor.
- **Test against a throwaway origin.** `.claude/launch.json` has a
  `dev-test` config pinned to port 5599 for exactly this; treat 5173 as the
  danger case.
- **Keep the safety rails in `save.ts` intact when refactoring:** versioned
  migrations write `backup-v<n>`; corrupt loads stash `recovery-<ts>`;
  `loadFromStorage` auto-heals (a parseable recovery copy with more
  `totalTicks` than the main slot is restored automatically);
  `clearStorage` wipes only prefixed keys so hard resets stay deliberate.
- A "lost" save after tooling changes is usually a *different browser
  profile/origin*, not a lost save — migrate with the game's own
  Export/Import buttons.

## 3. Seeding test state in the browser

**Use the DebugPanel first** (the `🐞` button in the top bar): one-click
grants that go through the real content pipeline — every item / affixed &
socketed variants, every material at every grade, runes, gold, skill-level
setters, favor, words, psionic gates, biomass. What it does **not** have:
any way to apply a status condition — verifying condition work means
seeding a save or fighting something that inflicts one (`young_wolf` at
`woods_edge` bleeds; training dummies inflict nothing).

If you must seed by hand, the traps, in order of how much time they cost:

- **The dying page saves over your seed.** `main.ts` registers
  `beforeunload → save()`, which overwrites a freshly written payload during
  the reload. To edit one field of the current save, don't fight it —
  register your own `beforeunload` listener *after* the app's (listeners run
  in registration order), rewrite the save inside it, and reload; the app
  saves first, your rewrite wins.
- **A hand-written partial save with a stale `version` gets migrated**, and
  migration can backfill `inventory`/`stock` from initial-state defaults —
  symptom: gold loads but the inventory is the seven starting items.
- **Console `await import('/src/ui/state.svelte.ts')` returns a different
  module instance** than the mounted app once Vite has processed any HMR
  update — you mutate a detached state object while the DOM shows the real
  one. Always confirm a seed landed by reading the DOM, never the object you
  just wrote.
- **A just-started Vite dev server does a dependency-optimize full reload on
  the first page load** — the first observed boot may really be the second,
  with an unload-save in between. Warm the page once before seeding or
  timing anything.

## 4. The derived-stats cache contract

`getDerivedStats` (`systems/derived.ts`) is memoized per state object behind
`modFingerprint`. Cache hits return the **identical object**. Three rules:

- **A new modifier source MUST add its state inputs to `modFingerprint` in
  the same commit.** Otherwise stats silently go stale — the fingerprint
  doesn't know that source can change. `tests/derivedcache.test.ts`'s
  long-fight sweep is the tripwire, but only if a fight exercises the new
  source; add an explicit invalidation case there too.
- **Never mutate the object `getDerivedStats` returns** — it is shared with
  every other caller. Clone if you must adjust.
- **UI code reads `view.stats`** (the shared derived in
  `src/ui/state.svelte.ts`), never `getDerivedStats(gs)` inline in a
  template — inline calls re-track the raw fingerprint inputs per consumer
  and defeat the point.

`computeDerivedStats` is the uncached pipeline, exported for the consistency
test. Offline catch-up runs **detached from the proxy** (`runCatchup`:
`$state.snapshot` → worker `Game` → one `Object.assign` back +
`game.resyncAnnouncers()`) — an 8-hour catch-up is ~8s because of this;
don't reintroduce per-tick proxy traffic there.

## 5. Status-system gotchas

Statuses are the universal substrate (consumables, blessings, wounds, buffs,
overload-recovery all ride them), so their sharp edges cut everywhere:

- **A bare `{ on: 'heal' }` removal fires on the passive idle trickle.**
  Wounds that should persist until *deliberate* healing need
  `healKinds: ['rest', 'salve', 'spell']`.
- **`applyStatus` returns early on first application**, so escalation always
  needs a second dose — deliberate and load-bearing (`chilled` caps at 1).
  Do not "fix".
- **`systems/statuses.ts` RETURNS damage; callers apply it.** It is
  deliberately near-leaf and cannot import `derived.ts` — pool data crosses
  through the `PoolSnapshot` seam built in `poolSnapshots(state, stats)`.
  Extend the snapshot, not the import graph.
- **Removal belongs to the SOURCE**: a `StatusApplication` overrides
  duration/removal wholesale — the same condition can be a 10-second rider
  from one source and removal-bound from another.
- **Condition immunity reads the resistance BEFORE the cap.** A player's
  `resPoison` is clamped to `resistCap` (0.75) in `computeDerivedStats`, so the
  stat can never show 1. The pre-cap values travel on the stat block through a
  side table (`noteUncappedResistance`), keyed by the block object: pass the
  block `getDerivedStats` returned. A copy (`{ ...stats }`) loses the record,
  and immunity then fails closed (the dose lands at the floor). Monsters read
  the damage pipeline's own pre-clamp figure (`monsterResistanceUnclamped`),
  which `monsterStats.ts` hands to `statuses.ts` at load because the import
  runs the other way. Both bearers add `resElemental` for the elemental types.
- **Never let a school borrow another's signature condition** — author a
  native one (a test sweeps for this). Borrowed conditions also carry the
  wrong intensity scale (a unit-scale condition fed a quantity-scale
  intensity read as −120% resistance, once).

## 6. Silent failure modes — where to look first

Things that fail by *doing nothing*, with no error anywhere:

- **"Spells aren't casting"** → check `manaCost` against `maxMana` first.
  The affordability gate in `pickActive` skips what can't be paid without
  a word of complaint, and deep word-folds are mana-brutal. (The same
  silence applies to focus. Any future mechanic that inflates costs must
  telegraph on the enemy, or not be built — see the overload plan.)
- **User reports broken content** → duplicate object keys first (typecheck
  catches: last key silently wins), then unresolved ids (`npm run verify` —
  the content linter in `tests/content.test.ts`).
- **A UI test clicks and reads stale DOM** → programmatic `.click()` then a
  synchronous read sees pre-update DOM in Svelte 5; reads need a
  `setTimeout`.
- **Rotation entries that resolve to nothing are inert**, by design — a
  stale `grimoire:<uid>` in `skillOrder`, an unprepared spell, an unarmed
  technique are all silently skipped.

## 7. Cross-system laws (test-enforced; don't relearn them)

Settled rules that look like style but are load-bearing — most have a test:

- **Only escalate/detonate THRESHOLDS may scale with max HP**; accrual,
  decay and disposal are absolute. (The overgrowth-ledger lesson, learned
  twice.)
- **Every arcane adverb must read differently by position** — leading = the
  applying, trailing = the substance — or it doesn't belong
  ([ARCANE.md §5](ARCANE.md)).
- **Every player-facing subsystem stays data-expressible from the monster
  side.** No player-only assumptions; enemies are meant to use all of it.
- **Crafting identity guards:** runecarving = sum, cooking = when
  (cardinal), alchemy = sequence (ordinal), mutagens = interaction topology.
  A new crafting mechanic must not duplicate an existing identity.
- **Monster abilities are ONE ordered rotation** (`MonsterDef.rotation`),
  never separate casts/techniques fields — a category that always outranks
  the other makes sequence-authoring impossible.
- **UI palette:** the blue arc is full (mana, spirit, stamina). New bars
  and accents go warm.
- **Mercy's two thresholds point opposite ways, and that is not a bug**
  (`engine/mercy.ts`). Drops are protected when **rare** (under 15%); procs —
  crit, and the same lane as dodge and parry — are protected when **common**
  (15% and up). Same rule underneath: escalation only pays over a run longer
  than about `2/rate` rolls, and the run is thousands of kills for a drop but
  the dozen swings of one fight for a proc. Below that length it is not merely
  useless but backwards — at 5% crit, mercy makes an 8-swing dry spell *more*
  likely (66% → 84%). Never "fix" one threshold to match the other.
- **A proc must be capped; a drop must not.** The only way to make a wolf owe
  you a fang blade is to kill wolves — the counter and the reward come from the
  same act. A proc counter is advanced by any swing at all and spent on
  whichever swing you choose, so uncapped it is buyable: warm up on the
  training dummy, walk into the boss with a guaranteed crit. `PROC_CAP_MULT`
  costs 0.01pp of the smoothing and takes that off the table.

## 8. Global CSS eats generic class names — and DOM checks can't see it

`src/app.css` styles a handful of **bare class selectors globally**: `.panel`,
`.bar` (+ `.bar > .fill`, `.bar > .label`), `.dim`, `button.selected`. Svelte
scopes a component's *own* styles, but it does nothing to shield a
component's *markup* from global rules — name a div `class="bar"` and it
becomes a 14px `overflow: hidden` resource-bar husk, whatever your scoped
styles say. This clipped the entire music staff into an unusable strip
(2026-08-05); the fix was renaming the wrapper to `.measure`.

**Rule:** before using a short generic class name in a panel, grep `app.css`
for it. Prefer domain words (`measure`, not `bar`).

**The deeper trap — how it survived "verification":** the bug was invisible
to every tool-side check used that day. `getBoundingClientRect()` reports
*layout* size, which ignores ancestor clipping; the accessibility tree lists
clipped elements happily; and programmatic clicks (by ref or dispatched
events) land on elements no real mouse could reach. Three "verified working"
passes, all wrong — the user's eyes were the only honest instrument.

**Rule:** UI verification is not done until a **real screenshot** (or a
`document.elementFromPoint` hit-test at the element's screen coordinates)
confirms the thing is actually visible and reachable. Rect math and
accessibility reads prove structure, never visibility.

## 9. Environment notes (this machine, this setup)

- **Not a git repository** — the content forge backs up to
  `.forge-backups/` instead; that and the save rails are the only undo.
- **Node was installed via winget** and tool-spawned shells may lack it on
  PATH: prefix with `$env:Path = "C:\Program Files\nodejs;" + $env:Path;`
  (the launch config already uses the full node path for the same reason).
- **`src/assets/` enemy art is Ækashics/Librarium** — commercial use is
  licensed, **redistribution is not**. If this project ever gets a public
  repository, the battler art must be excluded.
- Unbuilt-but-settled designs live in `docs/plans/` (currently:
  [psionic overload](plans/psionic-overload.md)); work in flight is
  `docs/NEXT.md`.
