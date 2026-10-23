# Runecarving Review

*2026-10-23. A design review, not a spec: nothing here is built. Run as a
`team:` task: three brainstormers (the carving itself, runes across the
equipment kit, runes on martial techniques), one design antagonist, rulings
by the manager (§6). The same review as a page with six working mockups:
[runecarving-review/review.html](runecarving-review/review.html). The page
reads the glyph art from the gitignored pack, so open it from the main
checkout with the `docs-static` launch config. The published copy carries
the 32 glyphs it draws inline: https://claude.ai/artifact/C3vDM8zj8miVqihTJBkusX
(private).*

The ask: make runecarving worthwhile and interesting, and test it as a core
system. Runes stay deterministic while the combinations of their components
are vast. Keep the identity, make it distinct. Use the Idylwild rune art.
Report system changes, UI mockups, runes as a tool for equipment in general,
and runes that modify martial techniques.

User ruling already on record (smithing plan, 2026-10-23): "Runecarving
itself needs a major overhaul; do not build on its current shape."

---

## 1. What exists

| Part | Today | Where |
|---|---|---|
| Bench | Rune Table: slab, three cuts (levels 0 / 10 / 25), inlay, color, two gems, tool | `data/disciplines.data.ts` 47–160 |
| Patterns | 4 stat bundles: Might, Warding, Swiftness (5), Edge (12) | `data/runes.data.ts` 186–233 |
| Adornments | 10 materials, each a per-context stat bundle at its own grade | `runes.data.ts` 246–326 |
| Named runes | 4 exact recipes (Stormbrand, Hearthward, Winter's Edge, Twiceforged Seal) | `runes.data.ts` 337–390 |
| Catalogue runes | 11 string-id runes from 20 drop lines; 3 carry technique surgery (Gale, Earthbind, Umbral) | `runes.data.ts` 12–166, `monsters.data.ts` |
| Composition | stone mult × pattern shares (1, 1/1.6, 1/2.2) × resonance for repeats; adornments added | `systems/runes.ts` 207–277 |
| Bench odds | split 30% base, +12% per extra cut, −2% per level, a tool removes a share; a tool may lift the stone a grade | `systems/runecarving.ts` 70–106 |
| Sockets | 0–4 rolled at mint by size class (means 0.7 / 1.3 / 1.9) | `runes.ts` 33–95 |
| Contexts | weapon / armor / accessory; every armor slot reads the same line | `types.ts` 3010 |
| Martial | `RuneTechniqueMod` by technique id: rename, damage, cooldown, penetration, splash, exit, fork grant | `types.ts` 3021, `martial.ts` 430–560 |
| Alpha | behind the `runecarving` shutter: drops pay nothing, no sockets shown | `systems/unlocks.ts` |
| Benches | Base Workshop and The Long Bench (Threshold) | `locations.data.ts` 429, 829 |

## 2. Identity

Your words (AUTHORSHIP.md, 2026-07-24): runecarving is "sum of its
elements". `docs/PITFALLS.md` agrees, and the identity tables in ALCHEMY.md
and MUTAGENS.md add "strictly additive — no pair synergies". `docs/MUSIC.md`'s
table says cooking = sum and runecarving = breadth; that table is stale
(question 6).

The family: cooking reads when (cardinal), alchemy reads order (ordinal),
mutagens read pairwise topology, music names the product by analysis,
smithing reads proportion (assembly) and counted verbs on opposed axes
(finishing), arcane reads syntax.

The proposal keeps runecarving the sum and makes the sum carry meaning:

- **Today:** a sum of four stat bundles, so many combinations collapse to a
  few scaled stat lines.
- **Proposed:** a sum of glyph vectors over thirteen aspects. The slot a
  rune sits in decides how the sum is read. Thresholds read one aspect at a
  time.
- **Guard wording:** no term reads two elements. Order, neighbours, ratios,
  time and verb tallies are read by nothing. Today's named runes break this;
  question 1.

Checked by the antagonist: span is a footprint, not a refusing budget, so it
is not smithing's temper; a rung is one threshold on one aspect, not
net-count tiers on opposed axes; naming by ledger is today's named runes
generalised, not music's classifier.

## 3. Findings

Each checked against the code on 2026-10-23.

- **F1. Pattern order changes the rune, and the cache hides it.**
  `carvedKey` sorts patterns; `composeCarved` gives distinct patterns shares
  by first appearance. Reproduced: [warding, might] and [might, warding]
  share a key, and the second resolves to the first one's numbers. After a
  reload the other order can win.
- **F2. Adornment order drops an element.** `mergeEffect` keeps the first of
  two different-type `bonusDamage`; the key sorts adornments. Warm then
  chilled gel gives heat 2, chilled then warm gives cold 2, under one key.
  Reproduced by a brainstormer.
- **F3. Different carvings stack together.** `inventory.ts:113` sorts and
  joins `item.runes`; a carved rune joins as `[object Object]`.
- **F4. The product is random.** The tool's upgrade chance lifts the stone a
  grade; the split chance destroys it.
- **F5. F slabs give negative stats** (mult −0.5: Might on F reads −2
  damage). F adornments too.
- **F6. Carved runes cannot do technique surgery.** `scaleEffect` copies
  only mods and the two riders; `mergeEffect` keeps the first
  `techniqueMods`.
- **F7. The first socketed rune wins an exit or a name.** `techniqueExit`
  and `techniqueDisplayName` use `.find()`.
- **F8. A rune-granted fork outlives the rune.** `chosenFork`
  (`martial.ts:470`) never checks that a rune still offers the stored path.
  The Honed choice is permanent by design; §4.4 keeps that (question 5).
- **F9. No supply.** Blank runestones, ochre, verdigris, gold leaf, gems,
  chisel and burin appear in no live drop table, shop or find.
- **F10. Monsters never bear runes.** The monster technique path
  (`combat.ts` ~4406) reads the raw move and exit.
- **F11. Sockets are a lottery.** 68% of vests cannot hold three runes.

## 4. Proposed changes

### 4.0 Fix first (no design question)

F1–F7: groups ordered by (copies desc, id); adornment riders kept as a list;
`stackKey` through `carvedKey`; exit and name resolution independent of
socket order (the precedence rule in §4.4); F slabs and F adornments
refused. One permutation test over every carving input (glyphs, adornments,
socket order, cache cleared between runs) and a source scan that
`runecarving.ts` imports no RNG.

### 4.1 The Ledger (the carving)

- **Aspects (13).** Might, Ward, Vital, Swift, Keen, Lore, Fortune, and six
  elements: Ember, Frost, Storm, Venom, Lumen, Gloam.
- **Glyphs.** 38 authored rows: the 24 Elder Futhark plus 14 Anglo-Saxon
  additions, which supply the elements the Futhark is thin on (Ior storm,
  Þorn venom, Éar gloam). Each is 3 points (primary 2, secondary 1) chosen
  from its meaning, plus a stroke count from the drawn art and the art index.
  Variants (short-twig, long-branch) carry the parent's vector at half the
  strokes. Letter runes carry 1 point of the parent's primary at 1 stroke.
  Calendar marks stay unused (time is cooking's). First-guess Elder table:

  | Glyph | Meaning | Vector | Strokes | Glyph | Meaning | Vector | Strokes |
  |---|---|---|---|---|---|---|---|
  | Fehu | wealth | Fortune 2, Vital 1 | 3 | Isaz | ice | Frost 2, Ward 1 | 1 |
  | Uruz | aurochs | Might 2, Vital 1 | 3 | Jera | harvest | Vital 2, Fortune 1 | 4 |
  | Thurisaz | thorn | Venom 2, Might 1 | 2 | Eihwaz | yew | Ward 2, Gloam 1 | 3 |
  | Ansuz | god | Lore 2, Storm 1 | 3 | Pertho | lot-cup | Keen 2, Gloam 1 | 4 |
  | Raido | journey | Swift 2, Fortune 1 | 3 | Algiz | elk-sedge | Ward 2, Lumen 1 | 3 |
  | Kaunan | torch | Ember 2, Venom 1 | 2 | Sowilo | sun | Ember 2, Lumen 1 | 3 |
  | Gebo | gift | Keen 2, Fortune 1 | 2 | Tiwaz | Tyr | Might 2, Keen 1 | 3 |
  | Wunjo | joy | Lumen 2, Vital 1 | 3 | Berkanan | birch | Vital 2, Ward 1 | 3 |
  | Hagalaz | hail | Storm 2, Frost 1 | 3 | Ehwaz | horse | Swift 2, Vital 1 | 4 |
  | Naudiz | need | Gloam 2, Ward 1 | 2 | Mannaz | man | Lore 2, Keen 1 | 4 |
  | Laguz | water | Frost 2, Lore 1 | 2 | Ingwaz | Ing | Vital 2, Might 1 | 4 |
  | Dagaz | day | Lumen 2, Swift 1 | 4 | Othala | estate | Fortune 2, Ward 1 | 4 |

  Pack art indices (verified for the Elder rows): Fehu 1, Uruz 2, Thurisaz 3,
  Ansuz 4, Raido 8, Kaunan 9, Gebo 12, Wunjo 13, Hagalaz 14, Naudiz 18,
  Isaz 20, Jera 21, Eihwaz 25, Pertho 26, Algiz 27, Sowilo 28, Tiwaz 31,
  Berkanan 33, Ehwaz 35, Mannaz 36, Laguz 40, Ingwaz 41, Dagaz 43,
  Othala 44; short-twig variants 7, 17, 19, 24, 30, 32, 34, 39. The
  Anglo-Saxon rows (45 onward) still need their indices checked against the
  reference sheet; the parsed sheet names 143 glyphs against 224 files, so
  the later sections do not map one to one.
- **Ledger.** Σ glyph vectors × stone grade + Σ adornment assays × each
  one's own grade. Adornments are one aspect each: warm gel Ember, chilled
  gel Frost, charged gel Storm, luminous gel Lumen, gold leaf Fortune, bone
  dust Vital, ochre Might, verdigris Venom, garnet Keen, sapphire Lore.
  Grades E 0.25, D 0.6, C 1, B 1.6, A 2.5, S 4.
- **Readings.** One linear line per aspect per context, per ledger point:

  | Aspect | Weapon | Armor | Accessory |
  |---|---|---|---|
  | Might | damage +2 | armor +1 | damage ×1% |
  | Ward | parry +1pp | armor +2 | max HP +6 |
  | Vital | max HP +5 | max HP +12 | HP regen +0.15 |
  | Swift | attack speed ×2% | speed ×1% | speed ×1.5% |
  | Keen | crit +1pp, crit damage +5% | dodge +0.5pp | crit +0.67pp |
  | Lore | spell power +3 | max mana +4 | mana regen +0.05 |
  | Fortune | loot ×1% | gold gain ×1% | gold gain ×2% |
  | Ember / Frost / Venom | +2 heat / cold / poison per hit | resist +5pp | resist +4pp |
  | Storm | 6% of hit as lightning | lightning resist +5pp | speed ×2% |
  | Lumen | +3 light per hit | dark resist +6pp | light resist +5pp |
  | Gloam | +2 dark per hit | light resist +6pp | dark resist +5pp |

  The Fair-grade single-glyph numbers match today's patterns where a pattern
  exists (Might, Ward), so legacy carvings read as aliases: Might = Might 2,
  Warding = Ward 2, Swiftness = Swift 2, Edge = Keen 3.
- **Slot lens.** Chest reads ×1; head ×0.5 but Lore and Keen ×1.5; hands
  ×0.35 but Might and Swift ×1; feet ×0.35 but Swift ×1.5; legs ×0.7;
  offhand reads Ward as parry (a weapon line) and the rest ×0.7. The socket
  picker prints a rune's reading in every slot before you commit.
- **Rungs.** One aspect's raw glyph points reaching 4 in one rune lights its
  rung (effect × min(1, grade)): Swift (weapon: reflex techniques' cooldown
  ×0.85; armor: dodge +3pp), Ward (armor: crit damage taken −10%), Keen
  (weapon: strike penetration +0.1), and each element (weapon hits inflict
  its status at 20%: chilled, on fire, jolted, poison, dazzled, blinded). A
  rung reads one aspect only.
- **Works (recommended form).** A named rung on one aspect at a higher bar,
  read on the ledger after grade: Aegis Ward 8, Hearthward Ember 6, Gale
  Swift 8, Earthbind Might 8, Umbral Gloam 8, Stormbrand Storm 8 (Fine slab or
  better), Winter's Edge Frost 8 (Superb or better). Adding a glyph never
  unlights a work; all lit works apply. Unknown works show "?" with their
  aspect until first lit or taught. Today's multi-aspect shape is question 1.
- **Bench.** No split chance, no upgrade chance. F slabs and F adornments
  refused. Cut slots open at Runecarving 0 / 5 / 10 / 18 / 25 / 35.
- **Span.** Sockets a rune takes = ceil(strokes ÷ hold). Hold = stone grade
  (E 4, D 6, C 8, B 11, A 15, S 20) + tool (chisel 1, burin 2, +1 per tool
  grade above Fair) + Runecarving level ÷ 10. Span over 3 is refused at the
  bench, and the preview says why. Tools and skill buy density, not odds. A
  burin is needed for variants and letters.
- **Value.** Half the sale value of the inputs at their grades. Glyphs add
  nothing.
- **Count.** A brainstormer enumerated 73,253 distinct ledgers from 38
  glyphs at four cuts or fewer, 2.92 million at six; readings are injective
  on the ledger. Times six grades and the adornment sets.

### 4.2 Equipment

- **Sockets.** Deterministic by size class: small 1, medium 2, large 3.
  Legacy instances keep their rolls. Item value reads the class constant,
  never the runes in it, so no bench prints gold. Forged items take their
  class from cells (question 4).
- **Swap.** Unsocketing is free and returns the whole rune.
- **Supply (data only).** Blank runestone at a shop counter, 24 gold, quality
  pinned at Fair, and 10% from the floor-2 filing and sorting automatons;
  ochre 16, verdigris 36 and a bronze chisel 80 as shop lines; a steel burin
  line after floor 2; bone dust 15% on the living doll; cut garnet from a
  floor-3 annex find; raw sapphire on the floor-3 boss's first clear. **The
  unlock find sits in the floor-2 break room**, below the boss it helps with.
- **Knowledge.** Four starter glyphs: Algiz, Uruz, Isaz, Fehu. A monster
  that bears a rune teaches its glyphs after five kills (a bestiary fact
  derived from kill counters, no new state). Codex pages from finds teach the
  rest.
- **Presets.** The eleven catalogue runes become fixed carvings that loot
  mints; `state.runes` merges into the carved pile; save v58 also rewrites
  catalogue ids already socketed in items, so nothing goes inert. Gale,
  Earthbind and Umbral become works that carry their surgery.

### 4.3 Monsters

- `MonsterDef.runes?: Partial<Record<SlotId, CarvedRune[]>>` through the
  same pure readers.
- A beast lens over all 13 aspects: Ward and Might → armor, Vital → regen,
  Swift → attack speed, Keen → crit, Lore → spell power, Fortune → drops,
  elements → resistances, element rungs → blows inflict the status. Monsters
  have one damage type and no typed rider, so element weapon readings on a
  monster are a named carve-out until the monster blow takes a rider.
- The bestiary "carries" fact prints the exact carving and teaches its
  glyphs. A lint holds a monster's carvings to its own span and sockets.
- A monster move names its fork archetype in data (monsters have no ledger
  to be lent through). The monster technique path honours `move.crit`
  (needed for the tumbling seat).

### 4.4 Martial

- **Selector.** Printed-card properties: `{ event?, kind?, enters?, exits?,
  family? }`, any-of inside a field, AND across fields, read on the printed
  `TechniqueDef` in one pass. Never a technique id, except in a
  hand-authored work.
- **Reach.** Weapon runes reach strikes. Armor, offhand and accessory runes
  reach buffs, counters and the onHit / onParry / onDodge answers. A buckler
  card belongs to the offhand.
- **Tunes.** Rungs add to matching cards: Swift rung cooldown, Keen rung
  penetration; element rungs add their status to every weapon hit,
  technique strikes included. Summed, then clamped (cooldown −40%,
  penetration +0.3).
- **Lends.** Eight Elder glyphs carry `Lend { where: Sel; archetype }`:
  Ehwaz lends Economical to any-entry strikes; Raido Flowing to
  neutral→coiled; Hagalaz Sweeping to exits into extended; Gebo Split to
  onCrit answers; Thurisaz Overwhelming to strikes from coiled; Naudiz
  Tumbling to exits into off-balance; Algiz Lasting and Sowilo Sudden to
  buffs. Weight 0.7 × grade per copy, summed per archetype. A total of 1.0
  adds that archetype to the card's **Honed offering** while socketed, at
  tier III, before a path is taken. Taking it is permanent. Void if the
  archetype's exit is the card's own entry. Lends never replace a path.
- **Works.** A work may rewrite one named card from the weapon (Gale:
  Sidestep → Flash Step, cooldown ×0.55; Earthbind: Thrust → Rooted Thrust,
  exit coiled; Umbral: Riposte ×1.1 and Sweeping joins its offering).
- **Precedence.** All lit works apply. One card rewrite per card: work, then
  the chosen fork, then the printed card; between works, registry order.
- **Tumbling.** A new archetype (damage ×1.0, so it passes the fork EV test
  in `tests/martial.test.ts`) and a new dead-end seat: nothing enters from
  it; the next strike from it is ×0.7 with a forced crit that does not stamp
  onCrit or count `combat:crits`. Combat state only; it dies with the fight.
- **Planner.** A badge on every rune-rewritten edge with a tooltip naming
  the runes; a ghost line to the printed exit; rune seats drawn after the
  five fixed positions. Socketing and unsocketing refresh learning at once
  (closes the MARTIAL §6 known gap).
- **§9 and §10.** Checked by the antagonist: selectors are data-authored per
  glyph, read once on the printed card, rewrite single nodes and write no
  edge list. The bench gets no technique or position slot. Tumbling is a
  dead end under §9a rule 1.

## 5. UI

All six are working mockups in the review page, driven by one port of the
Ledger.

1. **The Rune Table.** The slab drawn as a stone with the cut glyphs on it,
   tinted by inlay or pigment; six cut slots that open with level; the
   glyph palette from the codex (locked glyphs show why: unknown, needs a
   burin, no open cut); four adornment stations; thirteen ledger bars with
   the raw glyph points ticked and the rung line at 4; span against a vest's
   three sockets; the reading in each of the eight slots; lit rungs and
   works. "Carve into the pouch" sends the rune to mockup 3.
2. **The codex.** Every drawn glyph with its vector, strokes, how it was
   learned or where it is taught, and what it lends. The works chart below
   it, with a toggle between the two works rules (question 1); unknown works
   show "?" and the aspect they read.
3. **Sockets and the kit.** John's band-one kit with class sockets; pick a
   rune, then a socket; every slot prints what the picked rune would read
   there; the kit total names each source slot; the floor-3 duel estimate
   from both probes' armor curve.
4. **Runes on techniques.** Ten real cards; printed values struck through
   where a rune changed them; Honed offerings added by lends; the runes that
   did each change; the position graph with a work's rewritten exit in gold
   and a ghost line to the printed one.
5. **The rune card.** What the rune is made of, its key string, its ledger,
   its reading in weapon, chest and accessory, its footprint and its worth.
   Anyone handed the rune can rebuild it from the card.
6. **Bestiary: what it carries.** A monster's carving, revealed at five
   kills, with its beast-lens reading, the glyphs it teaches, its drop rate
   and a button that loads it on the Rune Table.

Art: 16×16 glyphs drawn at 32 and 48 px only (whole multiples), tinted on a
canvas. Idylwild glyphs stay in groups of their own, per the pixel-icons
plan's two-grid rule.

## 6. Antagonist objections and rulings

Verdict: fix first. No terminal state, no gold loop, no edge list, no
non-finite value. The ledger is a pure sum and the caps in `derived.ts`
bound every reading. Thirteen objections; twelve accepted and folded into
§4, one sent to the user. One more ruling from the mockups.

| # | Severity | Objection | Ruling |
|---|---|---|---|
| 1 | high | Shut below the hurdle it claims: every find was on floor 3, the boss's own floor | Accepted. Unlock find in the floor-2 break room |
| 2 | high | Multi-aspect works are pair synergies; the identity tables say "no pair synergies"; today's named runes already break it | Sent to the user (question 1). Recommended: one-aspect works |
| 3 | medium | Precedence gaps: two works lit, a work and a fork on one exit, brand against rungs | Accepted. All works apply; one card rewrite per card: work > chosen fork > printed; registry order between works |
| 4 | medium | Lends replaced the permanent Honed choice at tier II, a wardrobe toggle at a tenth of the practice | Accepted. Lends only add to the Honed offering at tier III; taking it is permanent |
| 5 | medium | Tumble at ×0.95 fails the fork EV test (confirmed by evaluating the test's formula) | Accepted. Tumble ×1.0 |
| 6 | medium | Monster parity: lends, four aspects and the forced crit were player-only | Accepted. Beast lens over all 13 aspects; monster moves name archetypes; monster path honours `move.crit` |
| 7 | medium | Smithing gives forged items 0 slots, this plan class sockets; both rewrite `itemValue` and `stackKey`; freeze not lifted | Accepted; questions 2 and 4 |
| 8 | low–med | v58 merged the pool but not catalogue ids socketed in items; Umbral would go inert | Accepted. v58 rewrites socketed strings |
| 9 | low | Sustain depends on the grade: three Common ward runes give 1/20; the swift rune adds nothing | Accepted. Runestone line pinned at Fair; cell test; claim corrected |
| 10 | low | F adornments still subtract | Accepted. Refused |
| 11 | low | Span over 3 has no item | Accepted. Refused at the bench |
| 12 | low | The slot lens is a hidden table | Accepted. Per-slot preview in the socket picker |
| 13 | low | The burin has no source | Accepted. Shop line after floor 2 |
| M | manager | **Brand was degenerate** (found in mockup 4): three plain Algiz in a chest summed Lumen 3 across armor runes and branded Riposte and Flowing Shield with light at 60% dazzle; the "dominant element" pick compared aspects against each other | Brand removed. Each element has its own rung; weapon hits inflict its status at 20%. Re-typing dropped; element readings already add typed damage |

Checked clean by the antagonist: completability invariant A (unsocketing is
free; a plain swing from tumbling resets to neutral; prestige resets glyph
knowledge and finds together), invariant C (every reading linear and
capped; speed compounds uncapped, which trivialises but stays finite), the
economy (a rune never outsells its own materials; class-constant item value
lowers every resale ceiling), MARTIAL §9 and §10, identity against smithing
and music, the derived-stats cache (`modFingerprint` already stringifies
carved runes per slot), and float order in lend totals.

## 7. Roles under §6a

Two probes against the floor-3 boss (`puppet_bureaucrat`), 20 seeded duels
each, John's pacing end state (level 5, oak club, three strings cut). A Fair
Rune of Warding in armor reads +4 armor today, the same as a Fair Algiz
under the Ledger. Scratch files, deleted after the runs.

| Role | Fills it? | Evidence |
|---|---|---|
| Sustain | Yes, at Fair stones, unlocked on floor 2 | Brainstormer (vest, cap, boots; base armor 8.5): 8.5 → 0/20; 18.5 → 11–12; 20.5 → 18; 24.5 → 19. Antagonist (vest only; base 6.8): 6.8 → 0/20; three Fair ward runes, 18.8 → 14/20; three Common, 14.0 → 1/20; no strings cut, 0/20; rusty sword, 4/20. Rests on Algiz, a starter glyph |
| Damage | Supporting | Four +4 damage runes alone: 0/20. Three armor runes 11/20, plus +16 damage 19/20 |
| Condition defence | Elements only | Element aspects read as resistances in armor; no band-one attacker needs one |
| Access | Unmeasured | A Might cell reading strength would let worn runes meet a STR requirement; not designed |

The same three ward runes on the club and cap give 0/20: the slot is the
reading, and that is the measured case for the lens.

## 8. Open questions

1. **Works and the guard.** Works read one aspect at a higher bar
   (recommended; the guard holds), or keep multi-aspect needs and amend the
   "no pair synergies" line in ALCHEMY.md and MUTAGENS.md to admit works as
   the one exception?
2. **The freeze.** Slice 1 is bug fixes and needs nothing. Slices 2–6 add
   band-one shop, drop and find lines and a save bump. Lift the alpha freeze
   for runecarving, or bank the design and build slice 1 only?
3. **The glyph table.** The 24 Elder vectors in §4.1 are first guesses from
   the meanings. Change any?
4. **Forged items.** Amend the smithing card so forged items get class
   sockets from their cells and no socket finish exists?
5. **Permanence.** A rune adds an archetype to the Honed offering; taking it
   is permanent and outlives the rune. Keep, or let a rune-granted path lapse
   when the rune leaves?
6. **MUSIC.md.** Correct its identity table (cooking = sum, runecarving =
   breadth) to match PITFALLS.md?

Not a question, a pacing item: grade multiplies the whole ledger, so a
Superb four-glyph ward rune reads +41 armor in a chest (the iron
breastplate is 14). Today's runes scale the same way. The first pacing pass
after slice 3 should look at the A and S rows.

## 9. Weighed and dropped

- **Opposed aspects that cancel.** Smithing finishing's form (four opposed
  axes, net count).
- **Adornments as multipliers on one aspect.** A product of two summed terms
  is a pair synergy.
- **A bindrune across aspects.** A threshold on two aspects at once; pair
  synergy, and close to music.
- **Gematria** (sum mod N picks an effect). Throws away the glyph meanings,
  which are the pack's value.
- **Stone kinds with grain and ceilings.** Each stone gets one best carving,
  so the decision ends at the stone; and every kind needs a source. Can be
  layered on later as data.
- **Budget and Bind** (grade buys a point budget, exact fill binds). The
  shape of smithing's temper.
- **Kit chords** (thresholds on the sum across all worn runes). Slot identity
  is lost and one-aspect stacking dominates. Revisit only if you want sets.
- **Carry as a mass budget per item.** Merged into span, which lives on the
  rune and the existing sockets.
- **Brand** (dominant element across reaching runes re-types the card). See
  ruling M.
- **Lends that replace a chosen path.** See objection 4.
- **A rune adding an entry or swapping a trigger.** §10 rejects free
  pairing; an entry plus an exit rewrite is a player-written edge.
- **Runes tuning positions' incoming or dodge multipliers.** Deepens the
  monster-position parity gap.

## 10. Links

- Review page with mockups: `docs/runecarving-review/review.html`.
- Published artifact (private): https://claude.ai/artifact/C3vDM8zj8miVqihTJBkusX
- Smithing's distinctness rule and the forged-socket clause:
  `docs/plans/blueprint-weaponsmithing.md` on branch `smithing-modular`.
- Glyph art: Idylwild's Runic Codex (CC0), `src/assets/packs/idylwild/`,
  gitignored by your choice (pixel-icons plan).
