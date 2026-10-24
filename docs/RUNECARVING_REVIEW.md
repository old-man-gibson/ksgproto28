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

**Terms used below.** *Aspect*: one of thirteen things a glyph adds points to (Power, Guard, Health, Speed, Crit, Magic, Luck, Heat, Cold, Lightning, Poison, Light, Dark); each name is a word the game already uses. *Totals*: a rune's points per aspect. *Bonus*: what 4 glyph points in one aspect turn on. *Named rune*: a bonus with a name at a higher total. *Sockets used*: how many sockets a rune takes. *Fork option*: a Honed fork choice a glyph adds to a technique. Player-facing text uses these words; flavour (a glyph's meaning, like Isaz "ice") is shown only beside them, never instead of them.

## 1. What exists

| Part | Today | Where |
|---|---|---|
| Bench | Rune Table: slab, three cuts (levels 0 / 10 / 25), inlay, color, two gems, tool | `data/disciplines.data.ts` 47–160 |
| Patterns | 4 stat bundles: Power, Warding, Swiftness (5), Edge (12) | `data/runes.data.ts` 186–233 |
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

The proposal keeps runecarving a sum and changes what gets summed:

- **Today:** a sum of four stat bundles, so many combinations collapse to a
  few scaled stat lines.
- **Proposed:** a sum of glyph points over thirteen aspects. The slot a
  rune sits in decides which stats the totals become. Every threshold reads
  one aspect.
- **Guard wording:** no term reads two elements. Order, neighbours, ratios,
  time and verb tallies are read by nothing. Today's named runes break this;
  question 1.

Checked by the antagonist: sockets used is a size, not a budget the bench
spends, so it is not smithing's temper; a bonus is one threshold on one
aspect, not net-count tiers on opposed axes; naming by totals is today's
named runes generalised, not music's classifier.

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
- **F5. F slabs give negative stats** (mult −0.5: Power on F reads −2
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
refused, and grade multipliers floored at 0 for carvings already in saves;
the tool's upgrade chance removed (it made the product random). One
permutation test over every carving input (patterns, adornments, socket
order, cache cleared between runs).

Ruling (2026-10-23, at build time): the split chance stays until slice 2.
It makes an attempt fail, not the product differ, and it is the tool's only
job until slice 2 gives tools a new one (fitting more strokes per socket). Slice 2 deletes it and adds the source
scan that `runecarving.ts` imports no RNG.

### 4.1 The carving: glyph sums

- **Aspects (13).** Power, Guard, Health, Speed, Crit, Magic, Luck, and six
  elements: Heat, Cold, Lightning, Poison, Light, Dark.
- **Glyphs.** 38 authored rows: the 24 Elder Futhark plus 14 Anglo-Saxon
  additions, which supply the elements the Futhark is thin on (Ior storm,
  Þorn venom, Éar gloam). Each is 3 points (primary 2, secondary 1) chosen
  from its meaning, plus a stroke count from the drawn art and the art index.
  Variants (short-twig, long-branch) carry the parent's vector at half the
  strokes. Letter runes carry 1 point of the parent's primary at 1 stroke.
  Calendar marks stay unused (time is cooking's). First-guess Elder table:

  | Glyph | Meaning | Vector | Strokes | Glyph | Meaning | Vector | Strokes |
  |---|---|---|---|---|---|---|---|
  | Fehu | wealth | Luck 2, Health 1 | 3 | Isaz | ice | Cold 2, Guard 1 | 1 |
  | Uruz | aurochs | Power 2, Health 1 | 3 | Jera | harvest | Health 2, Luck 1 | 4 |
  | Thurisaz | thorn | Poison 2, Power 1 | 2 | Eihwaz | yew | Guard 2, Dark 1 | 3 |
  | Ansuz | god | Magic 2, Lightning 1 | 3 | Pertho | lot-cup | Crit 2, Dark 1 | 4 |
  | Raido | journey | Speed 2, Luck 1 | 3 | Algiz | elk-sedge | Guard 2, Light 1 | 3 |
  | Kaunan | torch | Heat 2, Poison 1 | 2 | Sowilo | sun | Heat 2, Light 1 | 3 |
  | Gebo | gift | Crit 2, Luck 1 | 2 | Tiwaz | Tyr | Power 2, Crit 1 | 3 |
  | Wunjo | joy | Light 2, Health 1 | 3 | Berkanan | birch | Health 2, Guard 1 | 3 |
  | Hagalaz | hail | Lightning 2, Cold 1 | 3 | Ehwaz | horse | Speed 2, Health 1 | 4 |
  | Naudiz | need | Dark 2, Guard 1 | 2 | Mannaz | man | Magic 2, Crit 1 | 4 |
  | Laguz | water | Cold 2, Magic 1 | 2 | Ingwaz | Ing | Health 2, Power 1 | 4 |
  | Dagaz | day | Light 2, Speed 1 | 4 | Othala | estate | Luck 2, Guard 1 | 4 |

  Pack art indices (verified for the Elder rows): Fehu 1, Uruz 2, Thurisaz 3,
  Ansuz 4, Raido 8, Kaunan 9, Gebo 12, Wunjo 13, Hagalaz 14, Naudiz 18,
  Isaz 20, Jera 21, Eihwaz 25, Pertho 26, Algiz 27, Sowilo 28, Tiwaz 31,
  Berkanan 33, Ehwaz 35, Mannaz 36, Laguz 40, Ingwaz 41, Dagaz 43,
  Othala 44; short-twig variants 7, 17, 19, 24, 30, 32, 34, 39. The
  Anglo-Saxon rows (45 onward) still need their indices checked against the
  reference sheet; the parsed sheet names 143 glyphs against 224 files, so
  the later sections do not map one to one.
- **Totals.** Σ glyph points × stone grade + Σ adornment assays × each
  one's own grade. Adornments are one aspect each: warm gel Heat, chilled
  gel Cold, charged gel Lightning, luminous gel Light, gold leaf Luck, bone
  dust Health, ochre Power, verdigris Poison, garnet Crit, sapphire Magic.
  Grades E 0.25, D 0.6, C 1, B 1.6, A 2.5, S 4.
- **Readings.** One linear line per aspect per context, per point:

  | Aspect | Weapon | Armor | Accessory |
  |---|---|---|---|
  | Power | damage +2 | armor +1 | damage ×1% |
  | Guard | parry +1pp | armor +2 | max HP +6 |
  | Health | max HP +5 | max HP +12 | HP regen +0.15 |
  | Speed | attack speed ×2% | speed ×1% | speed ×1.5% |
  | Crit | crit +1pp, crit damage +5% | dodge +0.5pp | crit +0.67pp |
  | Magic | spell power +3 | max mana +4 | mana regen +0.05 |
  | Luck | loot ×1% | gold gain ×1% | gold gain ×2% |
  | Heat / Cold / Poison | +2 heat / cold / poison per hit | resist +5pp | resist +4pp |
  | Lightning | 6% of hit as lightning | lightning resist +5pp | speed ×2% |
  | Light | +3 light per hit | dark resist +6pp | light resist +5pp |
  | Dark | +2 dark per hit | light resist +6pp | dark resist +5pp |

  The Fair-grade single-glyph numbers match today's patterns where a pattern
  exists (Power, Guard), so legacy carvings read as aliases: Power = Power 2,
  Warding = Guard 2, Swiftness = Speed 2, Edge = Crit 3.
- **Slot lens.** Chest reads ×1; head ×0.5 but Magic and Crit ×1.5; hands
  ×0.35 but Power and Speed ×1; feet ×0.35 but Speed ×1.5; legs ×0.7;
  offhand reads Guard as parry (a weapon line) and the rest ×0.7. The socket
  picker prints a rune's reading in every slot before you commit.
- **Bonuses.** 4 glyph points in one aspect, in one rune, turn on that
  aspect's bonus: Speed (weapon: triggered techniques' cooldown −15%; armor:
  dodge +3pp), Guard (armor: crit damage taken −10%), Crit (weapon: strike
  penetration +10%), and each element (weapon hits inflict its status, 20%
  chance: chilled, on fire, jolted, poison, dazzled, blinded). Each point past
  4 adds a quarter of the base (8 points = 2×; user, 2026-10-23). Everything
  × min(1, max(0, grade)). Caps are kit-wide sums: cooldown −40%, dodge +9pp,
  crit damage taken −30%, penetration +30%, status chance 60%. Each bonus
  reads one aspect only.
- **Named runes (recommended form).** A bonus with a name, on one aspect,
  at a higher total, read after stone grade: Aegis Guard 8, Hearthward Heat 6, Gale
  Speed 8, Earthbind Power 8, Umbral Dark 8, Stormbrand Lightning 8 (Fine slab or
  better), Winter's Edge Cold 8 (Superb or better). Adding a glyph never
  turns one off; all active named runes apply. Unknown ones show "?" with
  their aspect until made once or taught. Today's multi-aspect shape is question 1.
- **Bench.** No split chance, no upgrade chance. F slabs and F adornments
  refused. Cut slots open at Runecarving 0 / 5 / 10 / 18 / 25 / 35.
- **Sockets used.** Strokes ÷ strokes per socket, rounded up. Strokes per
  socket = stone grade
  (E 4, D 6, C 8, B 11, A 15, S 20) + tool (chisel 1, burin 2, +1 per tool
  grade above Fair) + Runecarving level ÷ 10. A rune needing more than 3 sockets
  is refused at the bench, and the preview says why. Better tools and skill
  fit more glyphs into one socket; they change no odds. A
  burin is needed for variants and letters.
- **Value (user, 2026-10-23: "players are allowed to make money selling
  runes, as it is not a free money glitch and still takes resources").**
  Worth = the materials' base value at their grades (gold gain 1) × (1 + 0.1
  per glyph + 0.2 per bonus on + 0.4 per named rune), at most ×2. A rune
  sells for worth × gold gain, like other goods, but never above just under
  what its materials cost at a shop with the price seal (materials × 2 × 0.9
  − 1). So a rune made from gathered or dropped materials sells for up to
  nearly twice their raw sale value, and a rune made from bought materials
  never turns gold into more gold (§6c).
- **Count.** A brainstormer enumerated 73,253 distinct ledgers from 38
  glyphs at four cuts or fewer, 2.92 million at six; different totals
  always give different stats. Times six grades and the adornment sets.

### 4.2 Equipment

- **Sockets.** Deterministic by size class: small 1, medium 2, large 3.
  Legacy instances keep their rolls. Item value reads the class constant,
  never the runes in it, so no bench prints gold. Forged items take their
  class from cells (question 4).
- **Swap.** Unsocketing is free and returns the whole rune.
- **Sale prices.** Gold gain from the worn title and worn gear does not raise
  sale prices; it still applies to loot and jobs. With fixed sockets, resale
  is exact, and a switchable gold gain would otherwise mint gold at any
  counter (§6b).
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
  hands out; `state.runes` merges into the carved pile; save v58 also rewrites
  catalogue ids already socketed in items, so nothing goes inert. Gale,
  Earthbind and Umbral become named runes that keep their technique changes.

### 4.3 Monsters

- `MonsterDef.runes?: Partial<Record<SlotId, CarvedRune[]>>` through the
  same pure readers.
- A beast lens over all 13 aspects: Guard and Power → armor, Health → regen,
  Speed → attack speed, Crit → crit, Magic → spell power, Luck → drops,
  elements → resistances, element bonuses → blows inflict the status. Monsters
  have one damage type and no typed rider, so element weapon readings on a
  monster are a named carve-out until the monster blow takes a rider.
- The bestiary "carries" fact prints the exact carving and teaches its
  glyphs. A lint holds a monster's carvings to its own sockets.
- A monster move names its fork archetype in data (monsters have no glyph
  totals to get one from). The monster technique path honours `move.crit`
  (needed for the tumbling seat).

### 4.4 Martial

- **Selector.** Printed-card properties: `{ event?, kind?, enters?, exits?,
  family? }`, any-of inside a field, AND across fields, read on the printed
  `TechniqueDef` in one pass. Never a technique id, except in a
  hand-authored named rune.
- **Reach.** Weapon runes reach strikes. Armor, offhand and accessory runes
  reach buffs, counters and the onHit / onParry / onDodge answers. A buckler
  card belongs to the offhand.
- **Tunes.** Bonuses change matching techniques: the Speed bonus cuts
  cooldown, the Crit bonus adds penetration; element bonuses add their
  status to every weapon hit,
  technique strikes included. Summed, then clamped (cooldown −40%,
  penetration +0.3).
- **Fork options from glyphs ("lends").** Eight Elder glyphs carry
  `Lend { where: Sel; archetype }`:
  Ehwaz adds Economical to attacks usable from any position; Raido adds
  Flowing to techniques from neutral to coiled; Hagalaz adds Sweeping to
  techniques ending extended; Gebo adds Split to techniques triggered by a
  crit; Thurisaz adds Overwhelming to attacks starting coiled; Naudiz adds
  Tumbling to techniques ending off balance; Algiz adds Lasting and Sowilo
  adds Sudden to defensive techniques. Weight 0.7 × grade per copy, summed
  per option. A total of 1.0 adds that option to the technique's **Honed
  choice** while socketed, at tier III, before a path is taken. Taking it is
  permanent. Void if the option's exit is the technique's own entry. A glyph
  never replaces a chosen path.
- **Named runes.** A named rune in the weapon may rewrite one specific
  technique (Gale:
  Sidestep → Flash Step, cooldown ×0.55; Earthbind: Thrust → Rooted Thrust,
  exit coiled; Umbral: Riposte ×1.1 and Sweeping joins its offering).
- **Precedence.** All active named runes apply. One rewrite per technique:
  named rune, then the chosen fork, then the printed card; between named
  runes, registry order.
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

### 4.5 Each glyph's own effect (user rulings 2026-10-23)

The user's idea: points that do not reach a threshold should still do
something, or each rune should have a general persistent effect. Settled by
the user the same day (questions 6 and 7): monster stats only; "cutting a
glyph once imparts the effects and additional cuts increase the effect,
potentially putting it either above the threshold or further increasing the
power of an effect."

- Each glyph has one effect of its own, the same in every slot. Cutting it
  once gives the effect; each extra copy adds the same amount again
  (strength = copies; a short-twig variant counts as its parent).
- Every glyph point also counts toward its aspect total, as before: extra
  copies can push an aspect to 4 (its bonus turns on) and past it (the bonus
  grows a quarter per point, §4.1).
- × min(1, max(0, grade)), like bonuses. Capped per stat across the whole
  kit. Adornments have no glyph, so they add no effect of this kind.
- Only stats monsters also have (`MonsterStats`), so a monster wearing a
  rune gets the same effects; none of smithing's lens stats.
- Reads one glyph's copies only: no term reads two glyphs or two aspects.

First-guess table (per copy, at Fair):

| Glyph | Effect | Glyph | Effect |
|---|---|---|---|
| Fehu | Crit Damage +4% | Isaz | Armor +2 |
| Uruz | Damage Taken −1% | Jera | Max HP +4 |
| Thurisaz | Graze Damage on a Miss +2% | Eihwaz | Damage Taken −1% |
| Ansuz | Spell Power +2 | Pertho | Cooldown Back on a Miss +2% |
| Raido | Speed +2% | Algiz | Crit Damage Taken −2% |
| Kaunan | Crit Damage +4% | Sowilo | Crit Chance +1pp |
| Gebo | Cooldown Back on a Miss +2% | Tiwaz | Damage vs Larger +2% |
| Wunjo | HP Regen +0.1/s | Berkanan | HP Regen +0.1/s |
| Hagalaz | Resistance Ceiling +1pp | Ehwaz | Extra Swings +1% |
| Naudiz | Crit Damage Taken −2% | Mannaz | Ward +1 |
| Laguz | Dodge +1pp | Ingwaz | Damage vs Smaller +2% |
| Dagaz | Extra Swings +1% | Othala | Ward +1 |

Kit-wide caps (first guesses): Crit Damage 20%, Damage Taken −10%, Graze
15%, Spell Power 10, Speed 8%, Cooldown Back on a Miss 10%, HP Regen 1/s,
Resistance Ceiling 5pp, Crit Damage Taken −15%, Armor 10, Max HP 40,
Damage vs Larger / Smaller 15%, Crit Chance 5pp, Extra Swings 5%, Ward 5,
Dodge 5pp.

Examples, Fair: Algiz + Isaz: Crit Damage Taken −2%, Armor +2. Algiz + Isaz
×2: Cold reaches 4 and its bonus turns on (hits inflict chilled, 20%), and
Isaz's own effect doubles: Armor +4. Four Algiz: Guard 8, so the Guard bonus
is doubled (crit damage taken −20%), Aegis is made, and Algiz's own effect
is −8% crit damage taken.

Antagonist passes on this section: §6b (the first form, points split by
aspect total) and §6c (this form).

## 5. UI

**Player text (user, 2026-10-23: legibility before literary flourish).**

- Every label a player parses uses a word the game already has: aspects are
  stat and damage-type names (Guard, Speed, Crit, Heat, Dark), never
  invented ones.
- A glyph's meaning ("Isaz · ice") is a small gloss beside its name, never
  the label that carries the mechanic.
- No internal term reaches the screen: the player sees "totals", "bonus at 4
  points", "named rune", "sockets used", "adds a fork option".
- Every refusal says what is wrong and what fixes it ("Needs 4 sockets; no
  item has more than 3. A better stone, tool or Runecarving level fits more
  strokes per socket.").
- Which techniques a glyph reaches is written as a sentence ("attacks usable
  from any position"), not as selector syntax.

All six are working mockups in the review page, driven by one port of the
glyph-sum model.

1. **The Rune Table.** The slab drawn as a stone with the cut glyphs on it,
   tinted by inlay or pigment; six cut slots that open with level; the
   glyph palette from the codex (locked glyphs show why: unknown, needs a
   burin, no open cut); four adornment stations; thirteen total bars with
   the glyph-only points ticked and a line at 4; sockets used against a
   vest's three; the stats in each of the eight slots; active bonuses and
   named runes. "Carve into the pouch" sends the rune to mockup 3.
2. **The codex.** Every drawn glyph with its vector, strokes, how it was
   learned or where it is taught, and which fork option it adds. The named-rune
   chart below it, with a toggle between the two rules (question 1); unknown
   named runes show "?" and the aspect they read.
3. **Sockets and the kit.** John's band-one kit with class sockets; pick a
   rune, then a socket; every slot prints what the picked rune would read
   there; the kit total names each source slot; the floor-3 duel estimate
   from both probes' armor curve.
4. **Runes on techniques.** Ten real cards; printed values struck through
   where a rune changed them; fork options added by glyphs; the runes that
   did each change; the position graph with a named rune's rewritten exit in gold
   and a ghost line to the printed one.
5. **The rune card.** What the rune is made of, its key string, its totals,
   its reading in weapon, chest and accessory, its footprint and its worth.
   Anyone handed the rune can rebuild it from the card.
6. **Bestiary: what it carries.** A monster's carving, revealed at five
   kills, with its beast-lens reading, the glyphs it teaches, its drop rate
   and a button that loads it on the Rune Table.

Art: 16×16 glyphs drawn at 32 and 48 px only (whole multiples), tinted on a
canvas. Idylwild glyphs stay in groups of their own, per the pixel-icons
plan's two-grid rule.

**How a rune looks (user, 2026-10-23: "inlays are completely overshadowed by
color").** Each adornment kind has its own place on the drawing, so none
hides another:

- The inlay fills the cut strokes, one colour per material: gold leaf gold,
  bone dust bone white, warm gel ember orange, chilled gel ice blue, charged
  gel violet, luminous gel pale yellow. No inlay: dark bare cuts.
- The pigment stains the stone itself (user, 2026-10-23): ochre turns it
  brown-orange, verdigris green.
- Gems sit in the stone, at its lower corners.
- A legend under the slab names each one ("Inlay: Chilled gel (fills the
  cuts)", "Color: Verdigris (stains the stone)"), and the station headings
  say the same.
- Every rune is drawn on its stone wherever it appears: a small stained
  stone in the pouch and on the rune card, the socket itself in the stone's
  colour, the full slab on the bench.

## 6. Antagonist objections and rulings

Verdict: fix first. No terminal state, no gold loop, no edge list, no
non-finite value. The totals are a pure sum and the caps in `derived.ts`
bound every reading. Thirteen objections; twelve accepted and folded into
§4, one sent to the user. One more ruling from the mockups.

| # | Severity | Objection | Ruling |
|---|---|---|---|
| 1 | high | Shut below the hurdle it claims: every find was on floor 3, the boss's own floor | Accepted. Unlock find in the floor-2 break room |
| 2 | high | Named runes needing several aspects are pair synergies; the identity tables say "no pair synergies"; today's named runes already break it | Sent to the user (question 1). Recommended: one-aspect named runes |
| 3 | medium | Precedence gaps: two named runes active, a named rune and a fork on one exit, brand against bonuses | Accepted. All named runes apply; one rewrite per technique: named rune > chosen fork > printed; registry order between named runes |
| 4 | medium | Glyph fork options replaced the permanent Honed choice at tier II, a wardrobe toggle at a tenth of the practice | Accepted. Glyphs only add an option to the Honed choice at tier III; taking it is permanent |
| 5 | medium | Tumble at ×0.95 fails the fork EV test (confirmed by evaluating the test's formula) | Accepted. Tumble ×1.0 |
| 6 | medium | Monster parity: glyph fork options, four aspects and the forced crit were player-only | Accepted. Beast lens over all 13 aspects; monster moves name archetypes; monster path honours `move.crit` |
| 7 | medium | Smithing gives forged items 0 slots, this plan class sockets; both rewrite `itemValue` and `stackKey`; freeze not lifted | Accepted; questions 2 and 4 |
| 8 | low–med | v58 merged the pool but not catalogue ids socketed in items; Umbral would go inert | Accepted. v58 rewrites socketed strings |
| 9 | low | Sustain depends on the grade: three Common ward runes give 1/20; the swift rune adds nothing | Accepted. Runestone line pinned at Fair; cell test; claim corrected |
| 10 | low | F adornments still subtract | Accepted. Refused |
| 11 | low | A rune needing more than 3 sockets fits no item | Accepted. Refused at the bench |
| 12 | low | The slot lens is a hidden table | Accepted. Per-slot preview in the socket picker |
| 13 | low | The burin has no source | Accepted. Shop line after floor 2 |
| M | manager | **Brand was degenerate** (found in mockup 4): three plain Algiz in a chest summed Light 3 across armor runes and branded Riposte and Flowing Shield with light at 60% dazzle; the "dominant element" pick compared aspects against each other | Brand removed. Each element has its own bonus; weapon hits inflict its status at 20%. Re-typing dropped; element readings already add typed damage |

Checked clean by the antagonist: completability invariant A (unsocketing is
free; a plain swing from tumbling resets to neutral; prestige resets glyph
knowledge and finds together), invariant C (every reading linear and
capped; speed compounds uncapped, which trivialises but stays finite), the
economy (at the time a rune never outsold its own materials, since changed
by the user's ruling and re-checked in §6c; class-constant item value lowers
every resale ceiling), MARTIAL §9 and §10, identity against smithing
and music, the derived-stats cache (`modFingerprint` already stringifies
carved runes per slot), and float order in fork-option totals.

### 6b. Second pass: points below a bonus (§4.5)

Verdict: fix first. No terminal state, no non-finite value.

| Severity | Objection | Ruling |
|---|---|---|
| high | **Gold mint at the counter.** The buy floor is resale at the gold gain you have when buying; resale uses the gold gain you have when selling. With fixed sockets (§4.2) resale is exact, so anything switchable that raises gold gain mints gold: buy without it, sell with it. Reproduced with real `buyPrice`/`sellPrice`: iron sword bought 89, sold 167 at +90% gold gain. The Friend of the Court title (+8% while worn) is enough alone for any item worth more than about 13 gold | Accepted as a fix to §4.2, in slice 3: gold gain from the worn title and worn gear no longer raises sale prices; it still applies to loot and jobs. Gold Gain left the persistent table. Not live today: random socket rolls make it lose on average |
| high | **Monster parity.** 15 of the first 24 persistent stats (travel speed, XP, craft speed, stamina, focus, spirit, gold gain) do not exist on monsters | Accepted. Table rebuilt from monster stats only. Utility effects: question 6 |
| medium | **Adding a glyph can shrink another's effect** (Algiz alone −3% crit damage taken; add Eihwaz, Guard reaches 4, Algiz's Guard points move to the bonus) | Rejected as an identity break: the split reads one aspect's total, the same reading the bonus uses, and moving points into the bonus is the requested rerouting. Alternative (split by copies) is question 7 |
| medium | **No clamps.** The chosen stats are ones `derived.ts` never caps; 16 sockets of Eihwaz at S grade near total damage immunity | Accepted. Kit-wide cap per persistent stat |
| medium | **High grades flip the choice.** Persistent scaled fully with grade, bonuses to min(1, grade) | Accepted. Persistent scales to min(1, grade) |
| low | **Two signs backwards** (stamina and mana efficiency are costs) | Accepted; both left the table. A cost stat shows as "cost −1%" |
| low | **Overlap with smithing finishing stats** | Noted. Rune and finish are different objects; the tooltip names the source |

The split by aspect total was later replaced by the user's ruling (§4.5:
every glyph gives its effect, extra copies strengthen it), which also
removes objection 3's case.

### 6c. Third pass: effects by copies, bonuses past 4, rune value

Verdict: fix first. No terminal state, no non-finite value.

| Severity | Objection | Ruling |
|---|---|---|
| high | **Bought inputs still profit.** Sale = worth × gold gain, and charisma raises gold gain; a carve is one click with no bench time. Four Algiz on a Fair stone with verdigris (worth ×2, cap): +1 gold per carve at charisma 1, +5 at charisma 6, +48 at charisma 41; the price seal adds +2 even on a bare stone. Reproduced with real `buyPrice` and `getDerivedStats` | Accepted. A rune never sells above just under what its materials cost at a shop with the seal (materials × 2 × 0.9 − 1). Gathered materials still profit; bought ones always lose at least 1 |
| medium | **Gold gain counted twice** if worth is priced through `gradedUnitPrice` (which already multiplies by gold gain) | Accepted. Worth uses base values at gold gain 1; gold gain applies once, at sale |
| medium | **Bonus caps had no scope**; per rune, 17 armour sockets of six-Raido runes reach the 75% dodge cap from bonuses alone | Accepted. Bonus caps are kit-wide sums |
| medium–low | **The −40% cooldown clamp does not exist yet**, and a named rune (Gale ×0.55) stacks past it | Accepted. The clamp is slice-5 work; one ceiling covers everything runes do to a technique's cooldown, named runes included: −60% in total |
| low | **Concentration dominates**: resonance (+0.25 per extra copy) plus the doubled bonus made one glyph six times the best carving almost everywhere | Accepted in part: resonance dropped from glyphs' own effects (strength = copies, as the user worded it). Stacking still pays through the bonus, by the user's ruling |
| low | **Legacy F carvings flip sign** under min(1, grade) | Accepted. min(1, max(0, grade)) everywhere |

Pre-existing, noted only: the Crit bonus (penetration) and the weapon Speed
bonus (technique cooldown) have no monster-side stat.

## 7. Roles under §6a

Two probes against the floor-3 boss (`puppet_bureaucrat`), 20 seeded duels
each, John's pacing end state (level 5, oak club, three strings cut). A Fair
Rune of Warding in armor reads +4 armor today, the same as a Fair Algiz
in the new design. Scratch files, deleted after the runs.

| Role | Fills it? | Evidence |
|---|---|---|
| Sustain | Yes, at Fair stones, unlocked on floor 2 | Brainstormer (vest, cap, boots; base armor 8.5): 8.5 → 0/20; 18.5 → 11–12; 20.5 → 18; 24.5 → 19. Antagonist (vest only; base 6.8): 6.8 → 0/20; three Fair ward runes, 18.8 → 14/20; three Common, 14.0 → 1/20; no strings cut, 0/20; rusty sword, 4/20. Rests on Algiz, a starter glyph |
| Damage | Supporting | Four +4 damage runes alone: 0/20. Three armor runes 11/20, plus +16 damage 19/20 |
| Condition defence | Elements only | Element aspects read as resistances in armor; no band-one attacker needs one |
| Access | Unmeasured | A Power cell reading strength would let worn runes meet a STR requirement; not designed |

The same three Guard runes on the club and cap give 0/20. Where a rune is
socketed changes what it does, and this duel measures that.

## 8. Open questions

1. **Named runes and the guard.** Named runes read one aspect at a higher
   total (recommended; the guard holds), or keep multi-aspect needs and
   amend the "no pair synergies" line in ALCHEMY.md and MUTAGENS.md to allow
   named runes as the one exception?
2. **The freeze.** Slice 1 is bug fixes and needs nothing. Slices 2–6 add
   band-one shop, drop and find lines and a save bump. Lift the alpha freeze
   for runecarving, or bank the design and build slice 1 only?
3. **The glyph table.** The 24 Elder vectors in §4.1 are first guesses from
   the meanings. Change any?
4. **Forged items.** Amend the smithing card so forged items get class
   sockets from their cells and no socket finish exists?
5. **Permanence.** A rune adds a fork option to the Honed choice; taking it
   is permanent and outlives the rune. Keep, or let a rune-granted path lapse
   when the rune leaves?
6. ~~Persistent effects: combat or utility.~~ **Answered 2026-10-23:**
   monster stats only.
7. ~~How points are split.~~ **Answered 2026-10-23:** cutting a glyph once
   imparts its effect; additional cuts increase it and can push its aspect
   past the threshold or make a bonus stronger (§4.5).
8. **MUSIC.md.** Correct its identity table (cooking = sum, runecarving =
   breadth) to match PITFALLS.md?

Not a question, a pacing item: grade multiplies every total, so a
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
- **Carry as a mass budget per item.** Merged into sockets used, which lives
  on the rune and the existing sockets.
- **Brand** (dominant element across reaching runes re-types the card). See
  ruling M.
- **Glyph fork options that replace a chosen path.** See objection 4.
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
