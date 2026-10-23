# Mutagen Review

*2026-10-23. A design review, not a spec: nothing here is built. Run as a
`team:` task: three brainstormers (the body layer, the mastery loop and monster
side, presentation), one design antagonist, rulings by the manager (§6). The
same review as a page with seven working mockups:
[mutagens-review/review.html](mutagens-review/review.html). Open the file from
disk, or serve the repo root with the `docs-static` launch config. Every
chromosome number on that page comes from the real engine run on the test body
below; the body-layer and figure numbers come from the rules in §4.*

The ask, in three lines: make mutagens more visually appealing and more
rewarding to master past their current scope; keep the identity while making it
distinct; make mutagens a bottom-up system that modifies a character's base
stats and attributes and is rewarding to master.

**Test body** (used throughout, read off the live panel on port 5599): Fire
Slime Gene (Fine) at the centromere; d Resonant Mutation (Superb), e Rime Edge
(Fine), f Frostbite Brand (Fair), g Bedrock (Fine), h Fleet (Common), i Vigorous
(Fair); every edge established; Geneshaping 40, capacity 23.2 / 80. Per-route
cap ×3.75. Arm weights: Special ×2.46, Active ×2.00, Attacks ×4.87, Defenses
×4.87.

---

## 1. What exists

| Part | Today | Where |
|---|---|---|
| Identity | topology: the player places things; order and adjacency are derived (Law 2) | MUTAGENS.md §1–§2 |
| Chromosome | baseline layout: upper cluster a–f (3 μm edges, hops), lower ring g–j (6–9 μm edges, distance), four doors d/f/g/i → special/active/attacks/defenses | `data/mutagens.data.ts` `BASELINE_LAYOUT` |
| Main genes | 29 plus bare; 4 genera; tier fixed at the drop, grade F–S | `MAIN_GENES`, `GENERA` |
| Mutagens | 41 droppable (11 Edge, 11 Brand, 12 Ward, 1 conduit, 1 catalyst, 5 stat) plus 11 fused vulnerabilities | `MUTATIONS` |
| Ceiling | per-route cap = coefficient × 3; Fire Slime Fine = ×3.75 | `CEILING_HEADROOM`, `contributionWeight` |
| Capacity | 20 + 1.5 per Geneshaping level; gene at Fair = 10 × (power ratio)^1.35; mutagen 2 × grade cost; cuts 1.5 × 1.6^n | `CAPACITY_BASE`, `mainCost`, `capacityUsed` |
| Body writes | bare writes str/dex/con/int/wis/cha at 0; every other gene writes derived stats per arm | `MAIN_GENES.bare`, §8 |
| Skill | Geneshaping: capacity +1.5/level, drop chance +0.05%/level, craftSpeed +0.6%/level; tier names at 1/20/40/60 are names only | `skills.data.ts` ~860 |
| Alpha gate | `genes` is one of seven alpha shutters; nothing lifts it | `systems/unlocks.ts` |
| Save | v57; nothing below needs a bump except where marked | `state.ts:6` |

## 2. Identity

Mutagens own **interaction**: the player authors space, and sequence and
adjacency fall out of it. Runecarving is the sum, cooking is when, alchemy is
order. The review keeps that and adds two things the system lacks:

- **A body.** Today the chromosome writes derived stats into arms. Proposed:
  it also writes the six attributes, so the gene is the layer under gear,
  skills and level (§4.2).
- **Mastery that is the graph.** Today mastery is a skill level. Proposed:
  the system pays for reading and building patterns of interaction (§4.3), and
  monsters show their own (§4.4).

Nothing below adds an order field, a duration, a pair-synergy table or an
enemy-keyed effect.

## 3. Findings

Each one checked against the code on 2026-10-23.

- **F1. Mutagens are shut in the alpha and nothing opens them.** `genes` is in
  `LOCKABLE_SUBSYSTEMS`; no find, quest or spot sets `flag:unlock_genes`
  (only the v47 migration does, for old saves). COMPLETABILITY §6a counts
  mutagens as one of the eight core systems; on a fresh save it cannot be one
  of the player's picks.
- **F2. Drops leak past the shutter and burn discovery payouts.**
  `harvestKill` checks `state.mutagens.unlocked` (true on a fresh save), not
  the shutter. Measured on a fresh save, 500 kills each of slime_cell,
  cage_slime, forest_rat, goblin, filing_automaton and living_doll: 1494
  biomatter and 118 mutagens banked, log lines printed for a tab the player
  cannot open, and six entries written to `known`. `discover()` pushes the
  entry and then pays only skills already in `state.skills`; Geneshaping is not
  there yet, so those six discovery payouts are lost for the run.
- **F3. Supply.** One gene source spawns live: `slime_base_basic` in the
  floor 1 storerooms (weight 25 after 4 fights, 2% per kill). 20 of 29 genes
  name a species that does not exist. 10 of 41 mutagens have a live carrier
  tag: dark (Umbral Edge, Tainting Brand, Nightsight: living_doll, the Puppet
  Bureaucrat), earth (Grit Edge, Tremor Brand, Bedrock, Crystal: the toll
  collector golem), slime (Elastic), beast (Vigorous), construct (Studious).
  No live monster carries fire, ice or toxic, so no heat, cold or poison Ward
  drops.
- **F4. "Bottom-up" has nothing in it.** Bare writes 0 to all six attributes,
  on purpose (§8). No other gene writes an attribute.
- **F5. The attribute seam is split.** `effectiveAttrs` / `attrValue`
  (`systems/attributes.ts` ~345, ~386) read `collectBaseMods` only.
  Chromosome mods enter later, in `collectModifiers` (`systems/derived.ts`
  ~125). A gene that wrote attributes would change derived stats and not the
  sidebar rows, `attr` unlock conditions or achievements. Hidden today
  because bare writes 0.
- **F6. A routed modifier ignores its door.** Bedrock (a Ward) delivers
  +15% Earth Res. through the Attacks door; Fleet delivers +5% Speed through
  both ring doors. Doors matter only for types (Active and Attacks read them)
  and for grants (Active reads them). For magnitudes the four arms are four
  multipliers on the same stat sheet.
- **F7. Mastery pays little and shows less.** Geneshaping's three effects are
  small and linear; the 1/20/40/60 tier names unlock nothing. The catalogue
  (`state.mutagens.known`) is written on every discovery and read by nothing
  in `src/ui`. The discovery payout (45 × 1.15ⁿ genes, 45 × 1.08ⁿ mutagens)
  is never shown, though §9 says it must be visible.
- **F8. The capacity curve shuts most genes.** A run that catalogues
  everything reaches about Geneshaping 31: capacity 66.5. 16 of 29 genes cost
  more at Fair: slimest, blaze and asura 70.5; dragon 98.5; guardian and golem
  142.8; storm giant 165.6; Balor 223.9; slime king 275.7; Surtr 422.2; the
  five asurendra 476.5. MUTAGENS.md §12 already lists this as open.
- **F9. The panel, seen live** (port 5599, gothic theme, the test body):
  - The picker is one flat list of 41 mutagens; each row has seven chips such
    as `Di44 Su44 Fi44` (grade initials and stock). No description at the
    point of choice except a tooltip; no capacity cost at a socket; a refusal
    is learned from the log. The Refuse grade colour is #3a3a3a on #1a1511.
  - Edge length, the quantity that buys magnitude, is drawn only as stroke
    width (1.5 / 2.0 / 2.5). Drawn length does not track μm: a–b (3 μm) is
    longer on screen than g–h (6 μm).
  - An arm's weight can exceed the per-route cap: Attacks reads ×4.87 against
    a ×3.75 cap. The cap is per route; nothing draws it.
  - 52 mutagens share 42 emoji; the 11 fused ones are all 🧬.
  - About nine text blocks sit above the diagram.
  - `mutagenLines` prints "Nothing yet — a placeholder." for Catalytic
    Mutation, and "Carries cold — not wired yet" on every Edge, although
    Active and Attacks read the type.
- **F10. Offline harvest is silent.** `runOfflineProgress` suppresses the log;
  `OfflineSummary` counts `inventory.length`. Genes and mutagens live in
  `state.stock`, biomatter in materials. An 8 h absence that drops a gene
  reports nothing.
- **F11. The body is invisible outside the tab.** The sidebar attributes do
  not change; the battle-stage hero is a fixed SVG and does not read
  `playerSizeRank`.
- **F12. Doc drift.** MUTAGENS.md §12 lists the Attacks retype as inert;
  `tests/mutagens.test.ts` ~1761 ("the Attacks arm reaches your ordinary
  swing") shows it live. §9's table says level 60 unlocks "tier raising";
  §9 also says tier is fixed at the drop. §8 has an orphaned "It writes
  attributes" bullet under "What a swap costs".

## 4. Proposed changes

Round 1 is §4.0–§4.2 plus the diagram (§5 A–B). Everything after waits on the
questions in §8.

### 4.0 Fix first (no design question)

- **Attribute seam (F5).** Attribute-target chromosome mods move from
  `collectModifiers` (derived.ts) to `collectBaseMods` (attributes.ts), so
  `attrValue`, the sidebar rows, `attr` unlock conditions and achievements see
  them. Bare writes 0, so no number moves. Test: attrs and derived stats
  bit-identical before and after, for bare and every main gene.
- **Harvest (F2, objection 2).** `harvestKill` returns early while the `genes`
  shutter is shut, and calls `checkDiscovery(state, bus, ['craft',
  'geneshaping'])` before rolling, so Geneshaping manifests on the first
  harvest and every discovery pays. The test asserts XP paid, not only
  `known` (tests/mutagens.test.ts ~848 checks `known` today).
- **Offline line (F10).** `OfflineSummary` gains a before/after diff of
  `state.stock`, biomatter and `known`; the offline modal prints one line:
  `Found: Frostbite Brand (Fine, new), Slime Gene ×2, 14 biomatter`.
- **Bestiary names drops (Invariant B).** Once the shutter is open, a bestiary
  entry names the gene its species carries and the mutations its tags carry.
- **Strings (F9).** `mutagenLines` describes `amplify` (Catalytic prints
  "Nothing yet — a placeholder." today) and drops "not wired yet" from Edges,
  whose type Active and Attacks read.
- **Docs (F12, objection 6).** MUTAGENS.md §12: the Attacks retype is live.
  §9: drop "tier raising" from level 60. §8: move the orphaned bullet; when
  §4.2 ships, rewrite the write-channel paragraph and the comment on `bare` in
  mutagens.data.ts ("every gene writes attributes through Allotment; bare's
  share is prestige's").

### 4.1 The lift (round 1)

- **Find.** `the_vivarium` (Alembic Row, 8 ticks from the Retort Gate, which
  is 12 from the Foot of the Ascent) gets `exploreTicks` and an `explore`
  activity carrying a `SpotFind` that sets `flag:unlock_genes` and grants
  Geneshaping XP. Finds fire only from exploring (actions.ts ~922–928), which
  is why a hunt cannot carry it (objection 1).
- **Stock.** A caged hunt in the Vivarium, no `fightLimit`, spawning three
  species that already exist and sit in shelved locations: Fire Slime
  (`slime_fire`: fire tag; also the Fire Slime gene's source), Ice Slime
  (`slime_ice_basic`: ice), Slime Spider (`slime_spider`: toxic, vermin). This
  is the first source of heat, cold and poison Wards on the reachable map
  (F3), and of Bouncing Mutation (vermin).
- **Teacher.** One guide or NPC line names the Vivarium. The town has no fog,
  so the spot is on the map from the start.
- **Reset.** Flags, finds and stock reset with the run, so the find re-fires
  each run (§6a rule 4).
- **Cost.** No save change. `locations.data.ts`, text, a content test that the
  find exists and is reachable.

### 4.2 The body layer: Allotment with expression (round 1)

This is the "bottom-up" ask. The gene becomes the layer under gear, level and
skills: it writes the six attributes, and every formula above inherits them.

- **Amount.** The expressed gene grants **G = 8 × coefficientOf(gene)**
  attribute points (`BODY_POINTS_PER_COEFF`). Tier and grade set the amount,
  through the same coefficient the §5 ceiling uses. Slime Fair 9.0; Fire
  Slime Fine 10.0; Slime Divine 12; Slime King Divine 24.8; Surtr Divine 44.8.
- **Split.** `MainGeneDef.lean?: Partial<Record<AttributeId, number>>`, summing
  to 1; absent = 1/6 each. Slimoid: Con 0.40, Str 0.15, Dex 0.15, Int / Wis /
  Cha 0.10 each.
- **Doors.** Each attribute belongs to one door, the assignment bare already
  uses (mutagens.data.ts ~340): Str and Dex → Attacks; Con → Defenses; Int
  and Wis → Active; Cha → Special.
- **Expression.** `voice[arm]` = Σ over routes into that arm that carry
  modifiers of `contributionWeight × QUALITY_APPROACH[grade]`. Silent routes (a
  conduit, a brand that carries only a grant) do not count.
  `expression[arm] = 0.5 + 0.5 × min(1, voice[arm] / ceiling)`.
- **Write.** `points[a] = G × lean[a] × expression[door(a)]`, six `add` mods
  with origin `body`, through `collectBaseMods`.
- **Independence (objection 3).** Nothing is normalised across arms. Routing
  into Defenses raises Con's expression and touches nothing else. MUTAGENS.md
  §4 ("arms may be coupled by content, never by the engine") holds without a
  ruling.
- **Bare.** G = 6 × Genesis rank, always fully expressed: bare's points are
  prestige, not the graph's. Genesis is a new prestige boon, costs 2/3/4/5/6.
  Rank 0 = 0, so bare stays the free floor (§8).
- **Cache (objection 4).** The Genesis rank joins the `T` token of
  `modFingerprint`. Socket and edge changes are already keyed through the
  chromosome.
- **Lint (objection 7).** Both validation layers: Σ lean within ε of 1, every
  entry ≥ 0. Runtime fallback: 1/6 each when Σ ≤ 0.
- **Monster side.** `MonsterDef.genome` (monster-genomes story 3, unbuilt)
  feeds the same `bodyMods` into `monsterStats`; `lean` is def data read
  through `genomeOf`.

Worked numbers (John at the end of band 1 has effective Str 17.2, Dex 14, Con
15.2, Int 5, Wis 5, Cha 27.5; Max HP = 40 + 10 × Con before multipliers):

| Body | Expression S / A / Atk / Def | Str | Dex | Con | Int | Wis | Cha |
|---|---|---|---|---|---|---|---|
| Bare, Genesis 0 | — | 0 | 0 | 0 | 0 | 0 | 0 |
| Bare, Genesis 1 | full | 1 | 1 | 1 | 1 | 1 | 1 |
| Slime Fair, no mutagens | 50 / 50 / 50 / 50 | 0.67 | 0.67 | 1.80 | 0.45 | 0.45 | 0.45 |
| Test body | 66 / 61 / 100 / 97 | 1.50 | 1.50 | 3.87 | 0.61 | 0.61 | 0.66 |
| Test body, cut d–◉ | 50 / 72 / 100 / 97 | 1.50 | 1.50 | 3.87 | 0.72 | 0.72 | 0.50 |

- The test body's Con 3.87 is +39 Max HP before multipliers; on a fresh save
  (all attributes 1) the same body nearly quintuples Con.
- The cut moves Special's routes into Active: Cha falls to 50%, Int and Wis
  rise. That is topology deciding the sheet.
- **§6 holds.** Points per capacity fall as tier rises (Slime Fair 0.9 per
  capacity point, Slime King Fair 0.26, Surtr Fair about 0.05), so "climb a
  tier for headroom, never for efficiency" survives.
- **§7a holds.** Expression reads only your own graph; nothing keys on the
  enemy.
- **Risks.** Attribute points reach the economy stats (Int → skill XP +1% per
  point, Wis → training XP +1.2%, Cha → gold +1.2%); capped by G, which is
  §7's requirement. A flat G fades against level (+19 to each attribute at
  level 20) unless G grows with tier; measure with `npm run pacing` before
  fixing the 8.
- **Held alternative: Slope.** The body redistributes the +1-per-level gain by
  `lean` instead of adding points. Bare with no graph stays identical; a slime
  body loses about 0.9 points a level to clamping (antagonist, objection 3
  sub-point). Q1.

### 4.3 Figures: patterns the graph pays for (round 2)

- **Rule.** A closed list of named patterns, each a predicate over the
  resolved chromosome. The first time your own chromosome meets one in a run,
  it is stamped (`stats['figure:<id>'] = 1`): discovery XP, and +1.5 capacity
  for the rest of the run ("Stability", capped at +18). Detection is pure
  (`detectFigures(chromo)`) and runs when `chromosomeKey` changes, which covers
  every writer, the debug panel and offline play.
- **Why this key.** Gene and mutagen keys are hunting's book and exist already.
  An arrangement key is unbounded and farmable (placement is free). A figure is
  finite and is the system's own noun: a pattern of interactions.
- **Clause kinds** (closed set, a lint rejects others): `route { hops,
  distance, arm }`, `retyped`, `split`, `gain ≥ x`, `clamped` (2+ hops),
  `reroute` (resolving with `cut = []` changes some origin's path),
  `doors: n`, `live: <grant>`, `rekey`. No order, sum or duration clause
  exists.
- **The list** (first draft; ✓ = the test body meets it):

  | Figure | Test | Teaches | Test body |
  |---|---|---|---|
  | Door | a route crosses exactly 1 edge | placement picks the arm | ✓ |
  | Long Haul | a 1-hop route travels ≥ 9 μm | distance buys magnitude | ✓ |
  | Fork | a route divides at a tie | ties split evenly | ✓ |
  | Four Doors | all four arms receive a route | every domain is a door | ✓ |
  | Cascade | a route's gain ≥ ×1.15 | conduits multiply what passes | ✓ |
  | Ceiling Touch | a 2+ hop route is clamped | long routes meet the cap | ✓ |
  | Brand Rides | a condition arrives where it is read | brands ride into Active | ✓ |
  | Deep | a route crosses 3+ edges | hops buy character | with the cut |
  | Reroute | a cut changes some origin's path | a cut steers | with the cut |
  | Relay | an Edge re-types another route into an arm that reads type | what passes is rewritten | — |
  | Catalyst Feed | a catalyst raises the socket it feeds | amplify points outward | — |
  | Rewritten Body | a fused mutagen rekeys a weak point | changes what, not how much | — |

- **Demo.** Each figure ships a legal `demo` chromosome from droppable parts,
  shown once stamped; the test text is always shown (Invariant B).
- **No prestige source (objection 5).** Figures reach the harvest through
  Geneshaping levels and discovery XP like every other system.
- **Dials.** `STABILITY_PER_FIGURE` and `STABILITY_CAP`. Cell tests run at
  zero figures, so figures only accelerate (§6a).
- **Cost.** No save change (`stats`). A new registry: `FIGURES` in catalog.ts
  plus the registry.ts re-export and a text file; `systems/figures.ts`;
  `capacityLimit`; tests (every demo meets its test, mutation-tested;
  `detectFigures` total over 500 random chromosomes; capacity at zero figures
  equals today's).

### 4.4 Later

- **Anatomy (after monster-genomes story 3).** A bestiary fact (min kills 6,
  sure at 60) shows a species' genome as a read-only diagram. A mutagen a
  species wears drops at 4 × the tag rate, replacing the tag roll for that id.
  A Copy button lays held mutagens into the same sockets, best grade that fits;
  it never conjures parts, buys edges or swaps the gene, and lists what is
  missing with histone prices. This is also the arcane precedent COMPLETABILITY
  §3 still owes (a monster's sentence plus a copy button): build one fact kind
  and one Copy for both. `MonsterInstance.mutation` already exists, unread; a
  specimen with one extra worn mutagen needs no save change.
- **Karyotypes.** Alternate layouts as door permutations of the baseline: the
  same sockets, edges and lengths, only which arm each door opens to changes,
  so placed parts and paid edges survive a change and magnitude parity holds by
  construction. Hunter (Attacks and Special on the cluster doors) first;
  Special never on a ring door (its reach would rise from 5.5 to 8.0 at
  ceiling 6). A layout swap costs biomatter and shares the centromere's
  settling lock. Waits on §12 deciding what Defenses and Special read.

### What mastery buys

| | Today | With §4.0–§4.3 |
|---|---|---|
| Hour 1 | nothing (tab shut) | explore the Vivarium, tab opens; slot a Slime gene: +1.8 Con unfed; Door and Long Haul stamped in minutes (+3 capacity) |
| Hour 10 | — | the body shaped by feeding arms; 7–9 figures (+10.5 to +13.5 capacity); Fire, Ice and Spider wards from the Vivarium |
| Run 3 | — | figures re-stamped in an hour or two from known builds; Genesis ranks raise bare; Anatomy (later) reads monster bodies |

## 5. UI

Mockups: [mutagens-review/review.html](mutagens-review/review.html), in the
gothic palette. The game version reads app.css tokens (11 new `--el-*` element
hues); no bought pixels; every string in the engineer register.

- **A. Plate grammar (round 1).** 14×14 code-drawn plates at ×1 / ×2 / ×3
  only. Shape = leg, derived from the def (rekey → fused, amplify → catalyst,
  `transform.mult` with no effect → conduit, retype or type → Edge, an
  `inflicts_` grant → Brand, only `res*` mods → Ward, else stat). Hue =
  element, with a 6×6 charge mark so hue is never the only channel. Grade = 7
  pips, F drawn as an outline (#3a3a3a is invisible on the panel). Hatch =
  inert or clamped. Pixel arm marks replace ✨ ⚡ ⚔️ 🛡️. The charge slot takes
  the pixel-icon plan's element icons when they land (docs/plans/pixel-icons.md
  §5 lists mutagens as "draw or buy").
- **B. Chromosome tab, redrawn (round 1).** A header band (crest, name, grade,
  a profile row Depth / Span / Fed / Splits / Capped / Inert, a three-segment
  capacity bar); the diagram with plates, letters kept, and edges drawn as
  beads, one per 3 μm (drawn length cannot track μm in this layout, so beads
  count it); hollow beads for distance past the cap; a cut as a gap with two
  red caps; door cards with a stacked per-route gauge (axis = 2 × the per-route
  cap, a tick at one cap), Body chips, Delivers chips, inert items hatched, and
  one row per route with its plate chain; click a route or a plate to pin it
  and light its beads and per-hop rewrites; a tool card with the ability's
  formula strip (`60 base × 1.12 Speed × 1.38 Heat Res. = 93 cold`) and a reach
  strip. New core: `graphProfile`. The panel splits into components.
- **C. Fitting (round 2).** The socket picker groups by leg with filters; each
  row says what it would deliver at this socket and what stays inert there (a
  Searing Edge at j: half re-types the swing, half arrives where nothing reads
  it); hover shows ghost segments on the door gauges and the capacity bar;
  a 7-slot grade scale replaces the seven chips. A centromere compare pane:
  Fire Slime Fine → Troll Fine fits (cap ×3.75 → ×4.00, the two clamped ring
  routes gain); → Jötunn Refuse fits at 64.4 / 80; → Slime King Fair is
  refused (288.1 of 80). New pure `previewPlacement`, `previewSwap`,
  `routesFromSocket`, each equal to the resolution after the commit (tested).
- **D. Body sheet.** Attribute rows with the body segment, a door mark per
  attribute, expression gauges per arm and the arithmetic.
- **E. Figures.** Cards with the test, the stamp and the route that met it; a
  Stability bar.
- **F. Crest (round 3).** One emblem from the resolution: quarters where the
  doors sit, fill = arm weight ÷ per-route cap, hue = loudest arriving type or
  the heaviest route's element, a brass top row when a route is capped, the
  genus mark in the centre with a grade rim. Used in the header, a sidebar
  strip under the resource bars (click opens the tab), the tab icon, and the
  battle-stage hero's shield; the hero scales by `playerSizeRank`.
- **G. Specimen book (round 3).** The tripartition as an element × leg matrix
  (found or `?`, best grade, count, drop source on hover); genes as F→S range
  bars per genus with capacity at Fair (hatched above 66.5); the next
  discovery payout as a number; a return tray of what arrived since you last
  looked; the bench grade ladder (approach %, capacity multiplier, refine
  biomatter). Share `BookGrid` and `GradeLadder` with the Cook's Book from
  docs/COOKING_REVIEW.md §5.

## 6. Antagonist objections and rulings

Verdict: fix first. No reachable terminal state; the arithmetic holds; Law 2
intact; no other discipline's identity duplicated.

| # | Objection | Ruling |
|---|---|---|
| 1 | The Vivarium find cannot fire: the spot has no explore activity, and finds fire only from exploring | **Accepted.** Explore activity plus find; a guide line names the spot (§4.1) |
| 2 | Discoveries pay nobody until Geneshaping manifests, and harvesting never manifests it; 20/20 seeds, 5 discoveries, 0 XP | **Accepted.** Corrects F2's cause. `checkDiscovery` in `harvestKill`; the lift find grants XP; the test asserts XP (§4.0) |
| 3 | Normalising shares across six attributes couples the arms: four ring Wards cut a slime king's mind attributes from 4.13 to 0.71 each (§4) | **Accepted, different fix.** Per-door expression, no normalisation; §4 holds with no ruling (§4.2) |
| 4 | Genesis is not in `modFingerprint`; buying it mid-run leaves derived stats stale | **Accepted.** Rank joins the `T` token |
| 5 | A `figures:found` prestige source pays only the mutagen pick | **Accepted.** Dropped |
| 6 | Allotment inverts §8's write-channel text and the bare comment | **Accepted.** Rewritten in the same change |
| 7 | A `lean` summing to 0 makes NaN | **Accepted.** Lint in both layers and a 1/6 fallback |
| 8 | The order shipped the body into a shut system; mastery mostly deferred | **Accepted.** Lift first; expression ships with the body |

Clean, per the antagonist: no fight limit on the Vivarium; bare is free and
reverting costs no material; G is bounded by 8 × coefficient; Stability caps
and does not compound; no new player-controlled exponent; no vendor sells
biomatter or mutagens; figures stamp once per run; a body swap costs 600 ticks
plus 0.6 × gene capacity in biomatter.

## 7. Roles under COMPLETABILITY §6a

What mutagens fill at basic use (slot a dropped gene, place what drops) on a
fresh save after the lift. A role counts only after a cell test passes: base
John plus one system.

| Role | Delivered by | Status |
|---|---|---|
| Sustain | body Con (Slime Fair alone: +1.8 Con = +18 Max HP before multipliers); Vigorous +8% Max HP | needs a cell test |
| Damage | Slime Bounce or Flaming Bounce; Edges +5% Damage; body Str and Dex | needs a cell test |
| Condition defence | Ember, Chill and Tainting Wards from the Vivarium stock | unproven; the same strength question as COOKING_REVIEW Q2 |
| Access | none | — |

## 8. Open questions

Each has a default, used until answered.

1. **Body layer shape.** Default: Allotment with expression (§4.2).
   Alternative: Slope. Or both.
2. **Body budget.** G = 8 × coefficient. Default: as written, then tuned with
   `npm run pacing`.
3. **Genesis boon.** Default: yes, +6 bare points per rank, fully expressed,
   costs 2/3/4/5/6. At rank 1 it equals Head Start for a player with no graph.
4. **Figures pay capacity.** Default: +1.5 per figure, cap +18, per run.
   Alternative: discovery XP only.
5. **Vivarium stock.** Default: Fire Slime, Ice Slime, Slime Spider (existing
   species) in a caged hunt. Alternative: new species.
6. **Drops while shut.** Default: none until the lift. Alternative: bank
   silently.
7. **The capacity curve (F8).** Default: leave §12 open; uniques are
   catalogue capstones, not bodies. Alternative: lower `TIER_COST_EXPONENT`
   from 1.35.
8. **Round 1 scope.** Default: §4.0, §4.1, §4.2 and §5 A–B.

## 9. Weighed and dropped

- Training-XP multipliers per attribute: worth 6.2 × ln(m) trained levels
  (×2 = +4.3); nearly invisible.
- Attribute caps from the body: flatten growth and strand attribute-gated
  content.
- Global share normalisation across six attributes: couples the arms
  (objection 3).
- `fromStat` keyed on an attribute (a rate per point of Con): a derived write,
  smaller than Vigorous at band 1, and it does not answer "modifies attributes".
- A wear-time skill per genus that discounts gene cost: no topology, and no
  gene supply to wear.
- A prestige source for figures (objection 5).
- A catalogue keyed on arrangements: placement is free, so an unbounded key is
  farmable.
- Animated flow particles, a force-directed graph, a "best layout" button,
  bespoke icons per mutagen (109 entries), a chromosome mastery % bar.
- Sever (cutting the enemy's edges in a fight) and two-centromere chimeras:
  enemy-keyed or undefined.
