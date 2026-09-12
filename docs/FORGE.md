# KSG Forge

A content workbench for Frontier Idle. Run it, lay out the world by dragging, and it
writes back to `src/core/data/*.data.ts` — surgically, without touching a single
comment it wasn't asked to change.

```bash
npm run forge
```

That is the ordinary dev server with one extra page. `npm run dev` also serves it, at
`/forge/` — the game stays at `/`. It is **dev-only**: the plugin declares
`apply: 'serve'` and `forge/index.html` is not a build input, so `npm run build`
produces exactly the game it always did.

---

## Why it works the way it does

Two decisions carry the whole tool.

**The data is loaded, not parsed.** The dev server calls Vite's `ssrLoadModule` on the
real `src/core/registry.ts` and hands the browser the actual objects the game uses. The
forge therefore *cannot* drift from your types: add a field and it appears, rename an id
and every reference to it is instantly wrong in the validator. (The old
`ksg-content-forge.html` re-declared `TIERS`, `SLOTS`, `STAT_KEYS` by hand, and had
already drifted.)

**Writes are surgical.** Edits go through the TypeScript AST and replace the exact
character range of the thing being changed — never a whole file, never a whole entry.
Drag a spot across the map and the only bytes that change are the two numbers in its
`map: { x, y }`. Your hand-written comments, your deliberate one-line objects, your
CRLF line endings all survive. `tests/forge.test.ts` exists to hold that promise:
every edit test asserts the sample file's comments are still there afterwards.

**Nothing is written until you say so.** Edits stage locally (the map redraws
immediately), and **Review & Apply** (`Ctrl+S`) shows the diff per file before anything
lands. This repo has no git, so a timestamped copy of every touched file goes to
`.forge-backups/` first — that directory *is* the undo history.

**Words go to the text file.** `desc`, `dialogue` and `hint` are not stored in the
data files; they live in `src/core/text/<name>.text.ts` next door, keyed by dotted
path (`master_smith.desc`, `f1_storerooms.finds.strongbox.desc`), and
`src/core/text/prose.ts` stitches them onto the entries at load. The forge client
never notices — it edits `spot.desc` on the loaded object like any field — and
`forge/server/prose.ts` splits each patch op into its data-file part and its
text-file part. Editing a description touches only the text file; adding an entry
writes the numbers to one file and the words to the other; renaming or deleting an
entry carries its text keys along. A text key that names nothing shows up in the
validator as a `text` warning.

---

## The world map

The map is the reason the tool exists. It draws **declared** connections rather than the
mirrored adjacency the engine builds, because an edge on screen is a line of source you
can edit.

| gesture | does |
|---|---|
| drag a node | sets `map: { x, y }` (snapped to ½ by default) |
| **shift**-drag from a node | draws a new connection to whatever you drop on |
| **right-click** anything | actions for that spot, edge, NPC, or the canvas |
| click an edge | opens it in the inspector |
| double-click empty canvas | creates a new spot there |
| wheel / middle-drag | zoom / pan |
| `Del` | removes the selected connection |
| `Esc` | backs out one layer: menu → pending link → selection |

The **right-click menu** is where the destructive and multi-step actions live, so
they can't happen by accident:

- **a spot** — connect from here (click the target; no drag needed), add an
  exploration find (creating `exploreTicks` and an Explore activity if the spot
  lacks them), toggle waypoint, duplicate, copy id, centre the view, delete
- **an edge** — make one-way/two-way, hide or reveal, flip direction, fit the
  travel time to the distance you drew, delete
- **an NPC** — edit, copy id, delete
- **empty canvas** — new spot here, fit the region, toggle names and travel times

What the drawing tells you:

- **plain line** — two-way. Declared once; `registry.ts` mirrors it, so you never declare
  the reverse.
- **orange line with an arrowhead** — `oneWay`. Drops, slides, chutes.
- **dashed violet** with a 🔒 — `hidden`. Invisible until the spot is 100% explored,
  *unless* a find opens it early.
- **two bowed lines between the same pair** — both directions were declared separately,
  so both are editable.
- **dashed teal ring** round a node — it has `exploreTicks`, i.e. it can be searched.
- **amber numbered dot** — how many `finds` it has.
- **⚡** — a fast-travel waypoint. **red rim** — the validator has an error on it.
- **→ Region Name** beside a node — a connection leaving the region you're looking at.

Turn on **Ticks** to label every edge with its travel time; anything wildly out of step
with the distance you drew turns amber, which is usually a sign you moved a spot and
forgot its road.

## The world atlas

The map places spots inside a region; the **🌍 World Atlas** places the regions in
the world. Every region draws as one pin on a single 0–100 × 0–75 canvas. Drag a
pin and the only bytes that change are the two numbers in that region's
`world: { x, y }` (`RegionDef.world`, staged and applied like any other edit).

Regions that haven't been placed yet sit on a dashed ring around the centre — a
layout, not data. Dragging one writes its first real position; **right-click →
Unpin** removes the field again. The toolbar counts how many of the world's
regions are actually pinned.

The lines between pins are travel connections that cross a region border
(aggregated from spot connections; the number is how many crossings the pair
has). They are the sanity check the atlas exists for, in the same spirit as the
tick-drift amber on the map:

- a connected pair pinned **much further apart** than the other connected pairs
  draws its line dashed amber — either the pins are wrong or those regions
  shouldn't join directly;
- two **unconnected** pinned regions overlapping get amber rims — two regions
  pretending to share a location. Connected pairs are exempt: regions the
  player walks between are supposed to be near each other, and a dense home
  cluster is a layout, not a mistake.

Nothing downstream invents a position for an unplaced region: `world` is
authored geometry, and systems that will consume it (inter-region distance,
climate baselines) treat a missing pin as "not placed yet". Place all of them
before building on top.

**Backdrop.** Drop any image at `forge/atlas-bg.svg` and the atlas draws it
under the pins, letterboxed into the canvas, with a **Map** toggle and an
opacity slider in the toolbar. Swap the file to swap the world; delete it for
the bare grid. With a backdrop present, the default view (and **Fit**) frames
the map rather than the whole canvas, and pins keep a constant *on-screen*
size as you zoom — dive into a cluster of small neighboring regions and the
pins shrink in map terms instead of covering the geography. It is dev-only like the rest of the forge — never a build
input. (Currently holds an Azgaar fantasy-map export, "Arevilia", which is
not final — that's exactly why it's a drop-in file and not data.)

## Notes to your future self

Every entry editor carries two note fields, **📌 TODO** and **📋 SPEC**. They
write real comments — one `// TODO: ...` / `// SPEC: ...` line each, directly
above the entry in its data file — not game data, so nothing about the build
changes. Emptying the field removes the line. Staged, diffed and backed up
like every other edit.

The forge owns EXACTLY those lines and nothing else: hand-written comments
above an entry are never touched, a trailing comment on the previous entry's
line is never mistaken for a note, and notes written by hand in the file
(colon optional, any case) show up in the forge on the next load — the two
TODOs that already existed in statuses.data.ts surfaced the moment this
shipped. A rename keeps the note attached; deleting the entry takes it along.

In the browser list, noted entries carry a 📌 (hover it for the text), and
the **📌 n** button above the list filters to just them — that's the "what
did I leave unfinished in here" view, per registry.

## Pantheon grouping

The Deities browser groups its list by pantheon: the deity tag whose
`DEITY_TAGS` definition carries `category: 'membership'` (e.g.
`'yolixoch pantheon'`). Gods with no membership tag stand together under
their own heading at the bottom — the same statement the divine bench makes.
Add a new pantheon by registering its membership tag in `deities.data.ts`;
the grouping needs nothing else.

## Exploration finds

The threshold track in the spot inspector is the editor for `SpotDef.finds` (see
[CONTENT_GUIDE §Spot](CONTENT_GUIDE.md#spot--area--region-locationsdatats)). Each marker
sits at a **share of `exploreTicks`**, so retuning how long a place takes to search moves
every reward on it. Drag a marker to move the threshold; click it to edit what it pays.

A find can pay several things at once — material, item, rune, gold, a rumor of another
spot, an early path through a hidden connection, skill XP. The `path` picker only offers
connections that are actually marked `hidden`, because opening a visible edge does
nothing.

## Cross-referencing

Every registry in the catalog is browsable: search it, edit it, and see **what it points
at and what points at it**. The reference panel scans all registries both ways, so
"which spots spawn this monster" and "which quests want this material" are one click,
not a grep.

Reference fields are pickers over the live registry, so a bad id is visible as you type
rather than at `npm run verify`.

**Closed unions get a dropdown; everything else gets suggestions you can ignore.**
The distinction is whether anything actually *knows* the whole domain:

- **A real list exists** — `damageType`, `tier`, `rarity`, `op`, `category`,
  `base`/`rate`, `attr`, `resource`, `terrain`, plus every reference field
  (pickers over the live registry). These are closed `<select>`s, and they offer
  values *nothing has used yet*: all seven monster tiers, every damage type,
  all 21 styles for a style's `replaces`.
- **Nothing does** — `slot`, `wield`, the `kind`/`type` discriminators, free-form
  tags. Options are inferred from what the registry's other entries carry, which
  is context-aware for free (`kind` on a drop entry and `kind` on an activity see
  different sets) — but a list built from existing entries **cannot contain the
  value a new entry wants to introduce**. So these are text boxes with a
  suggestion list, never a closed set. Type anything.

That second rule is not a nicety. A corpus-derived list locked as a dropdown makes
the editor refuse the exact thing an authoring tool exists for: `equippedTag`'s
`tag` offered 5 values because 5 were in use, while items carry 30 — so writing a
dagger style meant leaving the forge and editing the file by hand.

Where a wider source exists it is used for the suggestions even though the field
stays open: `tag` under `unlock` is filled from the tags every item carries, plus
the `unarmed` pseudo-tag the game adds for empty hands.

The current value is always kept as an option, so opening an entry can never
quietly rewrite it, and a value only this entry uses is outlined amber.

The right-hand column has two faces: **🔗 references** (what this entry touches
and what touches it) and **🔍 lookup** — a search over *every* registry at once
that shows a matching entry's data-file source right there in the panel, so you
can check what something is called, or what a similar entry looks like, without
navigating away from what you're editing. `open →` jumps to it when a peek isn't
enough. Widen the column with its splitter if you use it a lot; the width
persists.

Lookup also covers the game's **vocabulary** — the identifiers that aren't
registry entries: trigger events, trigger subjects, `state.stats` counters,
stat keys, attributes, damage types, skill tags (with who claims them),
categories, resources, tiers, rarities, unlock/objective/activity kinds, and
the XP curve vocabulary (base tiers with their costs, growth rates with their
multipliers, and the named `PROGRESSIONS` curves spelled out band by band). Search
"parry" and you get `onParry` (trigger event), `combat:parries` (counter),
`parry` (stat key) and the `parrying` skill tag alongside the Parrying Dagger —
and each term peeks to a **copy-ready snippet** showing exactly how content
calls it. An empty search shows the group index for browsing. None of it is
hand-written: trigger events and subjects load from `systems/triggers.ts`,
counters are grepped out of the actual `bumpStat`/`raiseStat` calls (so a new
counter appears here the moment some system bumps it), and the enum groups are
harvested from how existing content uses them.

**Creating entries starts from existing content, not from nothing.** The `⧉`
button duplicates the selected entry under a fresh id, complete — attributes,
growth, loot tables, all of it — ready to tweak. `＋ New` opens a panel where
you pick a template: any existing entry of that kind, or "blank", which
scaffolds every field at least half the registry's entries carry. Copying the
nearest neighbour and adjusting it *is* the authoring workflow; the forge just
stopped pretending otherwise. Function-valued fields (progression curves,
predicates) are left out of copies with a warning, since a clone of a closure
would be a lie in the data file.

---

## Validation

Two layers, deliberately:

- **Live**, on every keystroke — `forge/lib/validate.ts` mirrors the rules in
  `tests/content.test.ts` and lights up the offending node on the map. The Issues tab
  lists everything, grouped, and clicking one jumps to it.
- **Real**, on demand — the **🧪 Run content linter** button runs
  `vitest run tests/content.test.ts` and reports actual failures. The test suite is the
  authority; the live layer is for speed.

If they ever disagree, the test suite is right and `validate.ts` needs updating.

---

## Layout

```
forge/
  index.html  main.ts  App.svelte  forge.css
  lib/
    api.ts            client for /__forge/api/*
    store.svelte.ts   working copy + staged patch ops (coalesces a drag into one edit)
    validate.ts       live mirror of the content linter
    selection.ts      what the map has selected
    Field / RefPicker / TagInput
  panels/
    WorldMap  Inspector  SpotInspector  EdgeInspector  NpcInspector  FindsEditor
    Browser  EntryEditor  RefGraph  DiffModal  IssueList
  server/
    plugin.ts   the Vite dev plugin: /registry, /patch, /verify, /source, /backups
    edit.ts     TypeScript AST surgery
    print.ts    prints values back as idiomatic TS (single quotes, 2 spaces, key order)
    diff.ts     line diff for the review modal
    catalog.ts  the ONE place that knows where content lives
```

**Adding a registry to the forge is one entry in `catalog.ts`.** The browser, the
reference graph, the pickers and the patch route all read from it.

### Patch ops

The client never names a file. It names a *kind* and a *path*:

```ts
store.set('spot', ['woods_edge', 'finds', '#id=lost_purse', 'gold'], [15, 40])
store.del('spot', ['deep_woods', 'connections', '#to=ravine_floor'])
store.add('npc', 'old_pell', { id: 'old_pell', name: 'Old Pell', /* … */ })
```

`#key=value` addresses an array element by a field rather than an index, so a find or a
connection keeps its identity when the list is reordered. Setting a `#` path that doesn't
exist yet appends; missing intermediate containers are created on the way down, so
adding the first find to a spot is one op.

## Panes

Every divider is draggable: the sidebar, the map/inspector split, and the
browser's list / editor / references. **Double-click a divider** to put it back
to its shipped width, or focus it and use the arrow keys (`Shift` for bigger
steps). Widths persist in `localStorage` under `ksg-forge:*` — a layout you set
up for authoring monsters is still there tomorrow.

## Templates

The generic editor reads structure off the value, which is useless when a list
is *empty* — it can only offer "text items / numbers / groups". So the lists the
game defines exactly carry templates (`forge/lib/templates.ts`): an empty
`activities` offers **＋ train an attribute / ＋ hunt / ＋ gather a material…**,
`objectives` offers **＋ kill monsters / ＋ collect materials…**, and `unlock`,
`requirements`, `mods` and `effects` offer their real variants. Each button
writes a correctly-typed element with sensible defaults, so the reference
pickers and number fields appear immediately instead of after you rebuild the
shape by hand.

Adding a registry template is one entry in `LIST_TEMPLATES`, keyed `kind.field`
(or bare `field` for shapes shared across kinds, like `unlock`).

Lists **without** a template are not stranded either: the editor looks the field
up across other entries of the kind and uses what it finds, so an empty `tags`
renders as a tag input rather than a chooser, and an empty list of groups offers
"＋ &lt;singular&gt;" shaped like the ones its neighbours carry. Templates only
have to exist for discriminated unions, where no single example can show the
alternatives.

`TAG_VOCABULARIES` does the same for string lists backed by a registry:
`monster.tags` suggests the real MONSTER_TAGS and flags anything unregistered
in red, because the linter requires every tag to exist there — a new tag has to
be added to `bestiary.data.ts` first, it does not register itself. Tier tags
(`divine`, `mythic`…) are excluded outright: they are derived from the
monster's `tier`, and declaring one by hand is a linter error.

## Cross-referencing in practice

Selecting **Wolf** under Monsters shows *points at* — the items, materials, recipes,
statuses and runes in its loot and `inflicts`, each labelled with the field path it came
from (`loot.entries.3.id`) — and *pointed at by*: Deep Woods, via `encounters.0.monsterId`.
Matching is by id across every registry, so an id that exists in two of them (a recipe and
the item it makes) lists both rather than guessing.

## Renaming an id

The id field — in the spot inspector and in the browser's header — is editable.
Type a new id and commit (blur or Enter): the forge validates it live
(lowercase snake_case, not already taken — `idProblem` in `lib/validate.ts`),
shows you everything that points at the old id, and stages the whole move as
one batch — the entry's key and `id` field rewritten **in place** (never
delete-and-re-add, which would shove the entry to the end of the file), plus
every reference: connection `to:` fields, NPC `spotId`s, quest objectives,
find rumors, and composite counter keys like `fights:{spot}` /
`slain:{spot}:{monster}`, where only the renamed segment moves. Matching is by
inferred field kind, not string search, so renaming the spot `leather_vest`
cannot disturb the item of the same name. Like every edit it is staged, shows
in the diff, and leaves a `.forge-backups` copy when applied.

## Limits

- **Functions are read-only.** Skill progression curves and condition predicates come
  back as `{ __fn: name }` and must be edited in the file.
- Deleting an entry leaves dangling references on purpose — the validator flags them
  rather than cascading a delete you didn't ask for.
- The forge only writes to files listed in `catalog.ts`; anything else is refused.

## The name deck

`npm run names` rolls twenty two-word ability names from `scripts/names.txt`,
one *twist* and one *medium*, always from different registers. It is an
authoring aid and nothing more: the deck never ships, the player never sees a
rolled name, and a person picks one in twenty and writes the mechanic from it.
That is the whole reason it is not slop. A generator whose output reaches the
player is the author; a generator a person culls is a dice roll.

Why two words from different registers: the names worth copying in this style
(bungee gum, indoor fish, emperor time) put a mundane concrete noun next to a
modifier from somewhere else entirely, and the mechanic is whatever reconciles
them. Same-register pairs (fire blast) are what every game does. Registers
marked `hot` (material twists, weather-phenomenon mediums) never pair with
each other for the same reason.

The quality lives in the lists, not the script. Edit `names.txt` freely: one
entry per line, `[twist]` / `[medium]` for the side, `(register)` for the
register, `hot` after a register name to mark it. Arcane word ids are kept
out of the deck on purpose so a rolled name never reads as a sentence.

    npm run names                 twenty names
    npm run names -- 50           fifty
    npm run names -- --seed 7     the same batch again
    npm run names -- --twist economy,time --medium creature
    npm run names -- --sep ": "   Twist: Medium
    npm run names -- --list       registers and word counts

The test for a kept name: it reads as a joke until the mechanic is known, then
it reads as exact. The mechanic itself goes through the mutagen decomposition
(MUTAGENS.md §7b): the medium suggests the delivery, the twist suggests an
arm, the ceiling decides the numbers, and the restriction is yours to name.
