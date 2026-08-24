# Arcane spellcraft — magic as syntax

> The composer's home is `src/core/systems/arcane.ts`; the lexicon lives in
> `src/core/data/spellcraft.data.ts` (`ARCANE_WORDS`); the grimoire and
> casting glue are `src/core/systems/spellcraft.ts`; combat resolution is
> `castCraftedAttack` in `src/core/systems/combat.ts`. Authoring new words is
> [CONTENT_GUIDE §9a](CONTENT_GUIDE.md); this document is the system itself.
>
> ## Status: `CLOSED` — 2026-08-10
>
> No additions are owed, and none are accepted here. Combined words — carried
> for months as the one planned extension — are shelved in
> [LONGTERM.md](LONGTERM.md). New ideas for this school go on that shelf, not
> into this document.
>
> **Closed is not bug-free.** It means the design is finished and the feature
> list is shut — not that the implementation is clean. Bugs are still fixed
> here, and fixing one reopens nothing. **Suspected soft spot at closing time
> (user, 2026-08-10): adverbs.** Position-dependent meaning (§5) is the most
> intricate rule in the grammar and the likeliest place the code has drifted
> from what this document claims. An audit there is maintenance, not scope.

## 1. Where it sits among the schools

Arcane is the **player-authored** school: you compose spells as SENTENCES from
a vocabulary of words, and discovery of what the grammar can be made to do is
the content. Divine magic is received whole (a miracle's spec was fixed before
you were born); psionics is points on axes with no syntax at all. Arcane is the
one school where the player writes the spell.

Its pool is **mana**, fed by INT ("understand"). An arcane sentence reads the
same whatever you are holding — unlike psionics, gear never argues with the
words. What *does* change the reading is how well the speaker knows the words
themselves (§4a); the cache still holds the bare one (§10).

The grammar's one absolute law: **determinism**. Two mages who speak the same
words in the same order get the same spell, always. There is no roll anywhere
in composition — the only randomness is at *cast* time (variance, crits, and
the "or" conjunction, which is chance *purchased on purpose*).

The second law, which gives the school its flavor: **the grammar does what you
say, not what you meant**. "fire pierce me" burns the speaker. A mending
addressed at an enemy heals the enemy. The composer never checks an address
for wisdom, and several shipped exploits (§13) depend on exactly that.

## 2. The sentence

A spell is a sequence of word tokens. Five kinds of word exist, and a word is
exactly one kind:

| kind | what it is | count |
|---|---|---|
| **noun** | the substance spoken into being (fire, ice, zero…) | 12 |
| **verb** | what the substance is made to do (cut, pierce, mend…) | 9 |
| **adverb** | how it is spoken (slowly, gently, twice…) | 7 |
| **conjunction** | how clauses relate (then, and, but, or, if) | 5 |
| **target** | the address the spell is sent to (one, others, me) | 3 |

Sentence length is capped by the **Arcana** skill:
`maxSentenceWords(level) = min(8, 3 + ⌊level/8⌋)`. The cap counts WORDS, not
clauses — a targeting word spends a slot like everything else.

A sentence needs at least one noun or verb, or "the words fizzle."

## 3. Clauses and word order

Words group into **clauses** as the sentence is read left to right:

- A clause holds **one noun and one verb**. Speaking a second noun (or second
  verb) closes the clause and opens the next. "fire pierce ice fly" is two
  clauses.
- Within a clause, **whichever core word came first leads it**:
  - **verb-led** ("pierce fire"): mechanics ×1.3, power ×0.85. The action
    dominates — penetration, spread, grip, status delivery are amplified; the
    blow is softer.
  - **noun-led** ("fire pierce"): power ×1.15, mechanics ×0.8. The substance
    dominates and hits harder; the mechanics are fainter.
- A **noun spoken with no verb at all** is substance without shape: ×0.8 power
  (`UNSHAPED_POWER`).
- A **verb spoken bare** is its own substance: it deals `barePower` of its
  `bareType` and carries `bareInflicts`. "cut one" is a slash that bleeds.
- An **adverb** attaches to whichever clause is open when it is read, and
  remembers whether it arrived before or after the clause's core (§5).
- A **conjunction** belongs to no clause: it closes the clause before it and
  binds the clause after it (§6). Two conjunctions in a row, a conjunction
  first, or one trailing at the end are parse errors ("follows nothing" /
  "leads nowhere").
- A **target** belongs to no clause; the LAST one spoken seals the spell (§7).

**The breadth tax.** Clause *i* (0-based) contributes at
`clauseShare(i) = 1/(1 + 0.5i)` — 100%, 67%, 50%, 40%… Breadth costs, and the
widest sentence is not automatically the best one (the runecarving rule).
**Linked clauses escape the tax**: a clause bound by a conjunction keeps its
chain head's share. Chains are depth, not breadth.

**The physical triangle.** Cut, crush and pierce are the three ways to deliver
any substance, each buying one leg at the other two's expense:

| verb | delivers | trade |
|---|---|---|
| cut | deeply — statusRate ×2.2 | softest blow (×0.8), no bypass |
| crush | hardest — power ×1.3 | substance barely holds (statusRate ×0.45) |
| pierce | precisely — 35% penetration | lighter (×0.95) and low hold (×0.6) |

So "fire cut one" burns readily and hits softly; "fire crush one" is the
biggest number; "fire pierce one" goes through what the others cannot.

## 4. Repetition, deepening, and mastery

**Adjacent repetition deepens a word rather than repeating it.** "fire fire"
is one token — *flame* — and "fire fire fire" is *blaze*. Only adjacency
counts: "fire pierce fire" is two separate fires in two clauses. Targets and
conjunctions never deepen (an address repeated is an address; "then then" is
a broken sentence). No word goes past three: "no mouth can hold a fourth."

The economics of deepening (`MAX_STACK = 3`):

- **Effect grows faster than linear**: `STACK_POWER = [1, 2.3, 3.9]`. Two
  fires spoken as flame beat two fires cast separately.
- **Cost grows faster than effect**: `STACK_MANA = [1, 3, 6]`. Doubling down
  is never *efficient* — it buys throughput per clause slot, not value.

Every non-target, non-conjunction word declares its deepened names in
`stacked: ['flame', 'blaze']`, and generated spell names use them: "Blaze
Pierce", never "Fire Fire Fire Pierce".

**Word mastery** lets the deepened form be spoken as a SINGLE word: inscribe
sentences using *fire* in **5** distinct sentences and "flame" becomes
directly speakable (one slot, full stack cost and power); **15** earns
"blaze" (`WORD_MASTERY = [5, 15]`). The counters are the arcana novelty
ledger — one entry per distinct sentence ever inscribed, deleted or not — so
mastery is breadth of use and cannot be farmed by re-inscribing one sentence.
A mastered token is written `fire:2` / `fire:3` in the source words, and a
mastered *flame* arrives already two deep for stacking purposes (flame + fire
= blaze; flame + flame would be a fourth, and fails).

**Identity collapses across mastery**: `spellKey` stores the collapsed form,
so "fire fire pierce" and a mastered "flame pierce" are *the same spell* —
one grimoire entry, one novelty key, one cache line.

## 4a. Practice — every word is a skill

Mastery (§4) says what you may *fold*. **Practice** is the other axis: how
well this speaker knows the word at all. They are deliberately separate — one
is breadth of use across distinct sentences, the other is raw repetition, and
a word can be deeply practised without ever being foldable.

Every entry in `ARCANE_WORDS` gets a generated `SkillDef`
(`src/core/data/wordskills.data.ts`), merged into `SKILLS` alongside the
hand-written ones:

- id `word_<wordId>`, category `magic`, parent **`arcana`**, tag
  `word:<wordId>`, `PROGRESSIONS.simple`, no unlock condition.
- The generator is the only author. **Adding a word to the lexicon adds its
  skill automatically** — never hand-write one.

**Earning it.** `grantWordXp` pays every *distinct* word a sentence spoke,
once each, on inscription (`INSCRIBE_WORD_XP` weight) and on every cast. The
payout scales with what the working **cost**:

```
xp = WORD_XP_BASE(2) × weight × (1 + log2(1 + manaCost))
```

Logarithmic on purpose: an expensive sentence teaches more than a cheap one,
but never enough that one enormous spell beats saying several ordinary ones.
Repetition inside the sentence pays nothing extra — a folded `fire:3` is
still one word being used.

> **Wiring trap.** `skillTrainedBy` walks the whole parent chain, and a lone
> `word:fire` tag satisfies neither Arcana (`arcane`) nor Magic (`magic`)
> behind it. So `checkDiscovery` is called with the full chain
> `['spellcraft', 'magic', 'arcane', 'word:fire']` to manifest the skill, and
> the XP is then handed over by name with `grantSkillXpDirect`. Paying
> through the tags instead would credit Arcana *once per word in the
> sentence* — a six-word working would teach the grammar six times for one
> breath. Arcana takes its own cut at the inscription and the cast; that is
> enough.

**What it buys.**

1. **Every level makes the word land harder.** `WORD_POWER_PER_LEVEL = 0.015`
   — +1.5% per level, applied per clause and *compounding across the words in
   it*: `powerMult` multiplies the bonus of the clause's noun, verb and every
   adverb. A sentence whose every word is well practised is worth more than
   the sum of its parts, which is the point.
2. **Milestones at levels 10 / 25 / 45** (`WORD_MILESTONE_LEVELS`) grant the
   word's own nature back as an ordinary `Modifier` bonus, the same gift
   three times over: *spark* → speed, *stone* → armor, *gust* → dodge, the
   elemental nouns → their own resistance, *arcane* → max mana, *zero* →
   penetration, and so on (`WORD_GIFTS`). These ride the shared modifier
   pipeline like any other skill milestone — nothing bespoke.

**Where the levels enter the reading.** This is the important part, and it
follows the rule in §10: the `SPELL_CACHE` holds the **bare** reading, keyed
by `spellKey`, and knows nothing about who is speaking.

- `composeArcane(words, levels?)` takes the level map. Called with no map it
  gives the bare, shareable reading.
- `resolveSpellFor(state, spell)` re-composes with `wordLevels(state)` for
  arcane spells specifically — the contextual reading, outside the cache.
- `checkSentence` does the same, so the **bench preview shows the sentence as
  this speaker would actually say it**, not as a stranger would.

Never push level-dependent numbers into the cache. The failure is silent and
shared: one speaker's practice would leak into every reading of that spell.

**In the UI.** A palette pill carries two marks that must not be confused —
the superscript numeral is mastery (foldability), the subscript number is
practice (level). The tip spells out both: "this word lands N% harder", and
what the next milestone gives.

## 5. Adverbs — position is meaning

An adverb read **before** its clause's core word speaks about *the applying*;
read **after**, about *the substance*. (Measured against whichever core
arrived first, so "quickly cut" is leading even with no noun.) Every adverb
axis reads the difference:

- **Weight** — `powerMult`, compounded per deepening tier. *slowly* ×1.4,
  *quickly* ×0.75, *gently* ×0.5/tier (so *barely* is an eighth of a blow).
- **Clock** — condition duration/rate shaping, with a lead shape and a trail
  shape. Leading *slowly*: burn twice as long at full rate (damage). Trailing
  *slowly*: three times the window at a third the bite (uptime for the logic
  words). Leading *quickly*: the whole condition in a quarter of the time, a
  share lost to haste; trailing: compressed cleanly, nothing lost.
  Removal-bound conditions (no clock of their own) cannot be hurried.
- **Count vs depth** — *twice/thrice/fourfold* (`hits`). **Leading = a
  volley**: N separate landings, each rolling its own crit and applying its
  own riders. **Trailing = a spike**: ONE landing carrying N-fold weight,
  blow and riders alike. Repetition *adds* a landing ("twice twice" is
  thrice), it does not multiply.
- **Intensity** — how deeply riders bite. *intensely* ×1.6 (trailing also
  concentrates: ×0.6 duration); *dimly* ×0.6 (trailing dilutes: ×1.6
  duration). Dimming is floored at `INTENSITY_FLOOR = 0.15` of the
  condition's own depth — restraint, never erasure.
- **Crit** — *viciously* leading hunts the seam (+7% chance/tier), trailing
  tears it wider (+25% damage/tier); *gently* does the reverse in miniature.
  Crit contributions ADD per tier rather than compounding.

**The mana rule adverbs obey**: `manaMult` is deliberately NOT raised to the
power of the deepening count. A deepened word already pays its own
`STACK_MANA` (2 → 6 → 12 for *twice* → *fourfold*); compounding the clause
multiplier on top charged twice for the same breath — the bug that once made
"fourfold" cost 93 mana and turned the deepest landing adverb into a dead
word. The word's own escalating cost IS the price of saying it three times.

**gently is the scaffold word, on purpose.** Weight collapses while the
affliction carried is untouched (intensity is the noun's business, delivery
the verb's; gently is neither) — which makes "gently venom cut me" a way to
poison yourself for almost nothing, feeding the workings that change the
rules afterwards (Venom Feast, Blood Communion). Cost falls slower than
weight, so it is never merely a cheaper blow. This is a KEEP under the
exploit policy, not an oversight.

## 6. Conjunctions — the logic words

A conjunction binds the clause after it to the strike the clause *before* it
produced. With no preceding strike (a mending or ward resets the chain — no
blow for "then" to follow), a conjunction is a no-op and the clause stands
alone. Linked clauses escape the breadth tax (§3).

- **then** (`inheritPenetration`, `followThrough: 1.3`) — *sequence*. The
  follow-up rides the opening the previous strike made (takes the better
  penetration of the two) and hits ×1.3 — but only if the previous strike in
  the volley **actually landed on this target**, checked per cast, per
  target. A strike conditioned out by "if" breaks the chain.
- **and** (`fuse: 0.85`) — *simultaneity*. Two clauses fuse into ONE blow
  with two natures: the joined clause's whole weight (hits folded in) is
  added at 85% efficiency, the blow lands as whichever nature the target
  guards worse (`orType`), penetration takes the max, and both riders are
  carried. **Nothing fused with something is SOMETHING**: an untyped head
  (zero) may not launder a substance through itself — the mixture takes the
  joined clause's nature, which is what stops "zero and blaze" being a
  resistance-proof blaze.
- **but** (`transmute`) — *contradiction*. The clause that follows does not
  strike — it transmutes, its riders REPLACING the blow's own. Order decides
  how a landing adverb reads: "glacier fourfold" donates one application four
  times as deep; "fourfold glacier" donates four separate applications, which
  meet the condition's own stacking rules — enough of them can cap a sum and
  ESCALATE. A riderless word strips the blow clean instead.
- **or** (`alternate: 0.5`) — *chance, purchased*. The linked clauses become
  alternatives: both are real strikes, ONE is rolled per cast (whole-volley —
  a broadside speaks the same word to everyone), and each or-linked clause
  pays only **half its mana**. Thrift, at the price of knowing. Chains extend
  the group ("fire or ice or spark" is a three-way roll).
- **if** (`condition`) — *the blow before fires only while the target bears
  the named affliction*. The following clause's noun names it, recognised
  generously: the noun's signature conditions **plus everything they escalate
  into** ("if fire" is satisfied by a target that is Blazing, not only one
  merely On Fire). Conditioned on a riderless word, the blow is conditioned
  on nothing, and nothing never comes true. Unmet, the strike simply is not
  spoken — and breaks any then-chain behind it.

## 7. Targets and delivery

Three addresses: **one** (the front enemy, the default), **others** (every
enemy), **me** (the speaker). The last address spoken seals the spell; the
grammar does not check it for wisdom.

- A broadside (**others**) costs **×1.5 mana** and lands on each enemy at
  **50% power** (`OTHERS_MANA_MULT`, `OTHERS_POWER`).
- **expand** accumulates splash: each expand-clause spills
  `0.5 × mechanics × verbStack` of the main target's raw damage into one
  random flanker, capped at 75%. Accumulate **1.5 raw spill** and the working
  stops spilling and simply addresses EVERYONE — "expand expand expand"
  upgrades an unaddressed spell to a broadside (an earned one: it already
  paid for its expands, so no ×1.5). A spoken address always outranks the
  upgrade.
- **ward** always lands on the speaker: the substance becomes a resistance
  coat against its own element (`+amount` to that element's resistance,
  duration 300 ticks). Warded *bare* — no noun — it hardens the skin instead
  (`armor +amount×20`).

  A ward reads **every dial the rest of the grammar does**, split along the
  same seam: what thickens the coat versus what lengthens it.

  | dial | effect on a ward |
  | --- | --- |
  | `nounStack` (glacier ward) | thicker — the substance's own depth counts |
  | `verbStack` (ice sanctum) | thicker |
  | `led.mechanics` (ward ice vs ice ward) | verb-led sharpens the mechanic |
  | `powerMult` (gently / slowly) | thicker or thinner |
  | `condIntensity` (intensely / dimly) | thicker or thinner, floored |
  | `depth` — TRAILING twice | thicker (`ice ward twice` = +24%) |
  | `hits` — LEADING twice | longer (`twice ice ward` = 60s) |
  | `condDur` (slowly / quickly) | longer or shorter |
  | `condRate` (trailing slowly) | thinner, since it stretched the clock |

  The rule to keep: **leading buys wear, trailing buys thickness** — one ward
  spoken twice over lasts twice as long rather than becoming two coats.
- **mend** lands on the caster by default. **The grammar's darkest gift**: a
  mending explicitly ADDRESSED at somebody else heals *them*
  (`healsEnemy`) — kindness, weaponized (a body already whole has nowhere to
  put it; see overgrowth, `StatusDef.surplus`). Implicit addresses keep
  healing the caster, so every sentence written before this rule existed
  means what it always meant.

## 8. Costs and cadence

**Mana** = Σ over every spoken word of `mana × STACK_MANA[count−1]`, times
the clause's adverb `manaMult`, times 0.5 if the clause is or-linked.
Clause-less words (addresses, conjunctions) add their own mana on top; then
×1.5 for a spoken broadside. Floor of 1. At cast time the cost is scaled by
the caster's `manaEff`.

**Cooldown** = `90 ticks × Π(verb and adverb cooldownMults, per tier)`,
clamped to **[30, 500]**. *fly* ×0.75 and *quickly* ×0.65 race the floor;
*burst* ×1.3 and *slowly* ×1.5 pay for their weight in wind-down.

**In combat**, prepared spells (cap: `preparedCap` — `BASE_PREPARED = 3`,
plus one page per `PREPARED_PER_LEVELS = 20` levels of *each* school skill,
Arcana / Psionics / Devotion, counted separately; their shared `magic` parent
is deliberately not counted, or the same study would pay twice) ride the SAME
rotation list as active skills and techniques — orderable, trigger-gatable,
and toggleable in the rotation UI, no separate black box:

- **Offensive** workings (any spell with strikes, or an addressed mending —
  `target !== 'self'`) swing on the action bar in place of a weapon attack.
- **Self-workings** (wards, mendings, whatever the grammar sent at its own
  speaker) fire from the buff slot as soon as they are ready.
- A rattled head cannot hold a spell together (`statusBlocks('spell')` —
  concussion blocks casting). Too little mana is not a refusal — just not
  yet.

**Outside combat**, any working that lands on its own caster (grants a
status, or self-heals) can be cast as a **utility** — full cost, running on
`useCooldowns` (the same clock consumables use), so a haste held between
errands is mana not available for the next fight. Judged on the resolved
spec, not the school: an arcane ward qualifies on the same terms a psionic
haste does.

### What the card must say

A condition line on a spell card states **chance, depth, clock, and rate** —
`35% On Fire ×3.9 ⌛ 8s — 1.6 Heat per second ≈ 12 in all`. The rate is not
decoration: intensity is the dial every condition scales off, so a card that
reports only "×3.9" has given the player a multiplier and nothing else, and
`intensely`/`dimly` become invisible. `conditionEffects()` in
`ui/lib/format.ts` is the single source for that phrasing — the affliction's
own tooltip uses it too, so a previewed condition and a held one can never
disagree. The "≈ in all" total appears only for a **flat** dot with a finite
lifetime; anything priced off the target's health has no honest total until
there is a target.

## 9. Resolution — what a cast actually does

Per cast (`castCraftedAttack`): pay mana (and focus/stamina if the spec
carries them — arcane specs never do), set the cooldown, roll each or-group
once for the whole volley, then per target:

1. Stats resolve **per victim** (hunter bonuses apply like weapon blows).
2. Each surviving strike, per landing (`hits`):
   - **Crit**: `crit + strike.critBonus + magnet bonus` — iron's
     `magnetized` charge makes piercing workings likelier to find the seam,
     and a held charge discharges wholly into whichever blow crits. Crit
     damage is floored at ×1: a crit is never worse than an ordinary blow,
     however gently spoken.
   - **Raw** = `spellPower × strike.power × share × castMult × follow ×
     critMult × variance(±10%)`.
   - **Type**: a twin-natured strike (`orType`, from "and") lands as
     whichever type the target guards worse. **Untyped** (zero) skips armor
     and resistance entirely — the raw number simply lands, and nothing is
     weak to it either.
   - **Penetration** adds the strike's own to the caster's derived
     penetration, capped 95%.
   - **Riders** (`inflicts`) apply only when the landing dealt damage.
3. Splash spills after the volley (§7); enemy-addressed healing and
   self-healing resolve last.

A working with nothing to land — a mending poured into an enemy, or a
sentence whose every strike was conditioned out this cast — deals no damage
and says nothing.

## 10. Identity, the grimoire, and persistence

A crafted spell stores **what made it** — the word list — and resolves to a
`SpellSpec` on read, memoised in `SPELL_CACHE` keyed by `spellKey` (the
collapsed sentence, §4). Invariants worth defending:

- **A spell never changes once made.** Composition is pure
  (`composeArcane`): sentence in, spell out, no state. `parseSentence` reads
  any legal grammar regardless of the reader's level — legality (level
  gates, length caps, mastery) is `checkSentence`'s business alone, so the
  bench can show the parse of a sentence you cannot yet speak.
- **The cache keeps the BARE reading.** Neither gear nor the speaker's
  practice joins the key. Psionics recomputes against matter and arcane
  recomputes against word levels (§4a), but both do it in `resolveSpellFor`,
  *outside* the cache. A contextual number written into `SPELL_CACHE` leaks
  from one speaker to every reading of that spell.
- **A player's name rides on top** (`renameSpell`); the working underneath
  is unchanged. A reference that no longer resolves (content removed) reads
  as a *Faded Inscription* rather than crashing an old save.
- **Inscription** (`inscribeArcane`) is deterministic like every craft:
  checked, written, paid in Arcana XP that rewards NEW sentences over
  recompositions. The novelty keys are the sentence key plus one
  `arcane:word:<id>` key per distinct base word — the same counters mastery
  reads (speaking *flame* still deepens *fire*). First-ever sentences grant
  discovery XP. Forgetting a spell does not forget the ledger entry.

## 11. The spellblade seat

A prepared working can be **held** instead of left to cast on its own
(`state.combat.readiedSpell`): the mana is paid on take-up, the working
leaves the ordinary rotation (it must not also go off by itself), and it is
carried to be delivered through a martial opening — a technique with
`requiresReadiedSpell` replaces its weapon answer with the held working
entirely. Losing the position, or the fight ending, drops the working
**without refund**: the mana was spent holding it, and that risk is what
makes carrying one a decision. Details of the seat and its positions:
[MARTIAL.md §9c](MARTIAL.md).

## 12. Combined words — shelved, not owed

Compound words (`fire and earth` → magma, `water but fire` → scald) were
carried here for months as "the one remaining addition". **They were shelved on
2026-08-10 and are cut from every release until further notice.** The whole
design is banked in **[LONGTERM.md](LONGTERM.md)** — including why authoring
182 bespoke cells was the wrong shape, and what the total, derivable version
would look like if the itch ever returns.

**This is not an open item, and arcane is not waiting on it.** An addition is
not a gap.

## 13. The current lexicon

Baseline anchors: a bare noun ≈ 1.0 power for 2 mana; deviations are the
word's identity. Full stats live in `ARCANE_WORDS` — this table is the map.

| word | kind | lvl | identity |
|---|---|---|---|
| fire → flame → blaze | noun | 0 | the baseline; burns (escalates) |
| ice → frost → glacier | noun | 0 | bites and chills |
| spark → arc → bolt | noun | 3 | quick lightning, jolts |
| water → torrent → deluge | noun | 4 | gentle; wets — sets up cold |
| gust → wind → storm | noun | 4 | light, far; **displaces** — steals the exit a technique meant to land on |
| stone → boulder → mountain | noun | 5 | heavy; leaves splinters |
| seed → bramble → wildwood | noun | 5 | patient; does nothing, remembers everything, then spreads it |
| venom → toxin → plague | noun | 6 | weak on arrival, argues after |
| acid → corrosion → liquefaction | noun | 6 | always corrodes; eats armour, not health |
| light → radiance → sun | noun | 8 | dazzles |
| gloom → dusk → abyss | noun | 8 | saps will; taints |
| zero → naught → null | noun | 10 | UNTYPED — nothing resists it, nothing fears it |
| iron → steel → adamant | noun | 11 | piercing; magnetizes (crit synergy) |
| arcane → eldritch → anathema | noun | 13 | frays what touches mana; unravels |
| pierce → impale → skewer | verb | 0 | the triangle: precision, penetration |
| fly → dart → blink | verb | 0 | haste for a little weight |
| expand → engulf → everything | verb | 4 | splash; enough of it addresses everyone |
| ward → bulwark → sanctum | verb | 5 | resistance coat on the speaker |
| burst → erupt → detonate | verb | 6 | power for wind-down |
| mend → knit → renew | verb | 7 | heals — whoever is addressed |
| grasp → clutch → strangle | verb | 8 | holds: noun's riders linger doubled |
| cut → gash → sunder | verb | 9 | the triangle: delivery |
| crush → crumple → implode | verb | 9 | the triangle: weight |
| slowly / quickly | adverb | 0 | the weight-and-clock pair |
| twice → thrice → fourfold | adverb | 6 | count (leading) vs depth (trailing) |
| gently → faintly → barely | adverb | 7 | the scaffold word |
| dimly → thinly → scarcely | adverb | 8 | dilute riders (trailing: linger) |
| intensely → fiercely → overwhelmingly | adverb | 10 | deepen riders (trailing: concentrate) |
| viciously → savagely → murderously | adverb | 13 | crit hunting / widening |
| then | conj | 12 | sequence: ride the opening, ×1.3 if it landed |
| and | conj | 14 | fusion: one blow, two natures |
| or | conj | 15 | alternatives at half mana |
| but | conj | 16 | transmute: riders replace the blow's own |
| if | conj | 18 | condition on an affliction (or its escalations) |
| one / me | target | 0/2 | the front enemy / the speaker |
| others | target | 5 | the broadside: ×1.5 mana, 50% each |

### 13a. Two nouns that are not about damage

Most nouns are a substance with a rider. These two are not, and both were
added on the same principle: **a noun may own a condition without owning a
damage type**, the way iron's magnetism has always been `piercing`-typed.

**`gust` is about tempo.** It is the light word — 0.85 power, and never going
to hurt. What it takes is footing: `buffeted` gives each point a 12% chance to
steal the exit a technique declared and land the fighter in `off_balance`
instead, and `unfooted` takes every exit. Since nothing enters from
off-balance, what it costs is the *chain*, not the turn — and a plain weapon
swing still recovers to neutral, which is the escape hatch the numbers are
balanced around. It is the only noun that reaches into the martial layer, so it
is the one that matters to a melee build. **Its legality under the martial
prime directive is not incidental — read [MARTIAL.md §9a](MARTIAL.md) before
touching it or adding anything else that moves a fighter.**

**`seed` is about patience.** Poison-typed. It does nothing on arrival — the
weakest rider in the game — and then does two things nothing else does: it
*grows while it is ignored* (`tends`: +0.15/sec, pruned by any blow, cut double
by piercing, and **fed** by water), and it *records* every other condition that
lands on the bearer (`grafts`). Matured into `rootbound`, the network carries a
quarter of that ledger to every other enemy in the fight every three seconds.
Fire ends it early and is paid for the trouble: the whole ledger comes back as
heat.

That last part is the point. The elemental relations — water feeds wood, metal
cuts wood, wood feeds fire — are written into the condition's own data rather
than sitting in a table somewhere, which is what lets the wuxin layer
(`systems/wuxin.ts`) be about *rewiring which noun sits in which slot* rather
than about inventing a second combat system.

## 14. Cross-references

- **Authoring words**: [CONTENT_GUIDE §9a](CONTENT_GUIDE.md) — verbs and
  adverbs are fully declarative; you declare what a word IS, the composer
  owns everything about how words interact. Balancing anchors in §9d.
- **Exploit policy**: clever syntax is the point — "know the system so you
  can game the system." Cross-school scaffolds (gently → Venom Feast /
  Blood Communion) are deliberate design space, not bugs.
- **Statuses** the nouns inflict: `statuses.data.ts`, authored like any
  other condition ([CONTENT_GUIDE §4](CONTENT_GUIDE.md)).
- **The other schools**: [PSIONIC.md](PSIONIC.md) (will as axes),
  MIRACLES in `spellcraft.data.ts` (received whole), grimoire mechanics
  shared by all three in `systems/spellcraft.ts`.
