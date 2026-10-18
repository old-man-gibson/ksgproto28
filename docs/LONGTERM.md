# Long-term plans — the shelf

**Nothing in this file is owed.**

That is the entire point of it, and the reason it is not part of
[NEXT.md](NEXT.md). NEXT.md is a handoff: work that is designed, started, or
promised, and a section leaves it by *shipping*. This file is the opposite —
ideas that are cut from every release until further notice, kept because the
thinking behind them was expensive and should not have to be redone, not
because anyone intends to build them.

A system with an entry here is still **complete**. An addition is not a gap.
Read an item here as "here is what it would look like if the itch ever
returns", never as an open item, a TODO, or a reason a doc cannot be closed.

**The rule for moving something here:** it must be an *addition* to something
that already works without it. Anything that leaves a shipped system broken,
unreachable, or lying to the player belongs in NEXT.md instead — that is debt,
and debt does not get to sit on a shelf.

Other obvious candidates already sitting in NEXT.md's "Parked" sections
(blueprint weaponsmithing, the aberrant god of arcane magic, the four subsystem
seeds) have **not** been moved. Moving them is a separate decision.

---

## Arcane compound words (was ARCANE.md §12; shelved 2026-08-10)

Combined words fuse clauses, and the conjunction flavors the fusion: "fire and
earth" internalises as **magma**, "water but fire" as **scald** — same
mechanism, different conjunction, different word. Acquisition would be
diegetic, an arcane master offering an *insight* the player must then explore
("Fire and earth already exists in nature as magma. I hope this is something to
think about") — the psionic teacher pattern.

**Why it was shelved.** It was carried for months as "the one remaining
addition" and described in the doc as "a data addition", which hid what the
data actually is: a bespoke identity per cell. Fourteen nouns is 91 unordered
pairs; two conjunctions makes 182, each wanting a name, a rider neither parent
owns, and balance numbers. That is a content pipeline, not a closing task —
and the user's judgement on 2026-08-10 was that authoring it is *"absolutely
ludicrous… prime 'v1.13 — The Arcane Synthesis Update' material"*. Cut for
non-release versions, eligible for a future update, **under no obligation to
ever be authored.**

### The design, banked

**Two variants only: `and` and `but`.** They do genuinely different chemistry.

- **`and` → synthesis.** Two things become one thing. *magma* (fire and earth).
- **`but` → substitution.** One thing wears another's nature. *scald* (water
  but fire).

**The authoring test — a compound must do something its parent sentence
cannot.** "fire and earth" already yields one blow with two natures and both
riders; what it cannot do is cost one slot, pay full power, and carry a rider
neither parent owns. A compound that merely shortens its own sentence is an
abbreviation, not a word.

**If it is ever built, build it TOTAL.** The same ruling the user made for
blueprint weaponsmithing (NEXT.md): every combination must yield *something*,
or the feature collapses into hidden recipes — 182 cells where three are real
and 179 silently are not. The shape that achieves this without a content
pipeline:

- **Every pair internalises**, and its payoff is **slot compression**, not new
  power. Sentences cap at 8 words (`maxSentenceWords`), so `fire and earth`
  spends three of them; the compound says it in one, at full efficiency instead
  of `and`'s 85%. Slots are the scarcest resource in the grammar, so that is a
  real reward with no bespoke content behind it.
- **No name is required.** An underived compound can read as its parents
  joined, which sidesteps naming 182 things — and the surface-form uniqueness
  lint in `tests/content.test.ts` would otherwise have to police all of them.
- **Named compounds are the small authored set on top.** Magma and scald earn a
  real word *and* a native rider precisely because they are exceptions. Same
  structure as weaponsmithing's "finishes are spice; souls are loot", and the
  codebase's oldest pattern — store the combination, derive meaning on read.

**Recommended, never ruled on — compounds do not fold.** `stacked` is optional,
so it is reversible. Leaving it off keeps compounds out of the FOLDABLE
denominator, so shipping one never moves yShicna's 80% bar and never un-offers
the atomic state to a player who had already qualified (NEXT.md flags that
drift as a hazard). It also reads right: a compound is already a folding of two
words.

**Never decided: what magma and scald actually do.** Suggestions on the table,
neither adopted — magma as *molten*, softening armour rather than piercing it
(no noun does that today, though earth owns `shardbound` and fire owns
burning); scald as the word that cashes `wet`, turning water's own setup into
damage, at the price of making water's contribution deliberately ambiguous.

**Parked within the parked: `then` → reaction.** A third variant where one
thing *becomes* another, landing as A and leaving B behind (`iron then acid` →
rust: strikes piercing, leaves `corroded`). The only conjunction about time, so
its compound would be the only substance with a timeline inside a single blow —
`seed` is patience *in place*, which is different. **`or` and `if` are rejected
outright:** `or`'s sentence form already rolls one alternative per cast, so its
compound would be the sentence with fewer keystrokes; `if` would resolve to
"hits harder against the already-afflicted", which is a damage multiplier
behind a condition check rather than a word.

### The one engineering note worth keeping

`orType` lives on `SpellStrike`, not on `ArcaneWordDef`. The combat end is
already done — [combat.ts](../src/core/systems/combat.ts) resolves a
twin-natured strike against whichever type the target guards worse — so what
was missing was one field on the word for the composer to copy across. Nothing
in ARCANE.md §§2–11 would change.

---

## The countryside outside Threshold (shelved 2026-09-12)

Eight regions, sixty-odd spots, four NPCs and six quests: Oakrest and the
Verdant Frontier (the square, the training grounds, the woods, the ravine),
the Westlands (the starter hamlet, the old player home and its practice
yards, the hometown forest and river, the Malgeri foothills), the three
Malgeri regions with their cave system, Stillail Hamlet, and the two swamp
placeholders. The prototype's whole first world.

**Where it is.** Verbatim in
[src/core/data/shelved/](../src/core/data/shelved/) — `locations.shelved.ts`
(regions, areas, spots, and `SHELVED_ROADS`: the Hamlet Road that joined it
to the Weighbridge, alpha world lock included), `npcs.shelved.ts`,
`quests.shelved.ts`. The registry does not import any of it, the forge
catalog does not list it, and no game-side lint runs over it. Its one reader
is [tests/fixtures/shelved-world.ts](../tests/fixtures/shelved-world.ts),
which mounts it into the registry for the ~35 test files written against
that world — so the shelf stays valid content by construction, and a test
that stands on shelved ground says so in its first line.

**Why it was shelved.** The alpha (plans/alpha-band-one.md) is Threshold and
the Ascent; the countryside was already shut behind `flag:world_open`, which
made it a second world the forge, the lints and every new-content decision
still had to reason about — the "wildly disparate areas must cohere" problem
the tower exists to dissolve. The user's call on 2026-09-12: shelve it, keep
Threshold and the Ascent, move the hold to a map of its own behind the first
prestige. Closing by subtraction again.

**Bringing a piece back** is a paste into the live files plus its road.
Nothing was rewritten on the way out — ids, edges, finds, encounter tables
and quest chains are exactly as they were — so a revival is a content
decision, not a build. Old saves that were standing out there woke at the
Foot on load (save v49) with their spot-keyed counters intact; a revived map
would find them waiting.

## Tile maps in the forge — autotile, the generator, fake doors (shelved 2026-09-15)

What shipped stays: the Tiles mode (docs/TILEMAPS.md — palettes, painting,
`<region>.map.json`, the two generated modules) is complete on its own and
floor 0 is drawn from it. What is shelved is everything after it in
[plans/forge-tilemaps.md](plans/forge-tilemaps.md): interpreting the packs'
automapping Rules, the room-and-corridor generator with per-pack kits, and
fake doors that glitch until revealed. The design and the nine decisions the
user took are on that card and its three draft stories; the Tiled readers
already return the Rules and Wang sets the autotile would need. Shelved by
the user the day it was planned — revisit only when they raise it.
