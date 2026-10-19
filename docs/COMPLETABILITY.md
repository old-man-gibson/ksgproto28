# Completability

**A standing law, not scheduled work.** Nothing here is a feature to build. It
is the constraint every future system is measured against, written down before
the endgame exists so the endgame can be built to fit it.

The game must remain finishable by three kinds of player:

1. **Colossal idiots that border on medically stupid.** They do not read. They
   do not plan. They click the thing in front of them, never re-spec, never
   check the better sword sitting in their bag, and wander into places that
   will kill them.
2. **John Idle, Male, Fighter, Longsword.** He picked the most boring build
   available and will not engage with a single optional system on its own
   terms. He swings a longsword. That is the whole character sheet.
3. **Colossal trolls who will fuck with the game wherever they can** and think
   degenerate loops are funny — because they are.

This is a **kitchen sink game** (see the project's premise: deliberately
unfocused, systems added because they're interesting rather than because the
design needs them). The law is what keeps breadth from becoming a tax. Every
new pillar widens the game; none of them may narrow the road through it.

> **Revised.** An earlier version of this document required archetype 1 to
> *complete the game*. It no longer does. Past a point, a game is allowed to
> ask something of a player, and refusing to ever ask makes the depth
> decorative. What replaced it is narrower and more defensible: the idiot may
> never become **unable** to finish, and everything the road demands must be
> **learnable in-game and re-openable**. See §4 and §6.

---

## 1. What the three compress to

Archetypes 1 and 3 sit at opposite ends of the same failure: the idiot
softlocks by accident, the troll softlocks on purpose. But their remedies are
not the same thing, and the previous version of this document fused them into a
single invariant. That fusion was a hazard — weakening the idiot's protection
risked taking the troll's robustness with it, and the troll's half has nothing
to do with skill. They are split below.

- **Invariant A** — no reachable state is terminal. Topology and economy.
- **Invariant B** — critical-path knowledge is transferable, never
  derivable-only.
- **Invariant C** — arithmetic and structure hold. Finite, terminating,
  round-tripping.
- **The tuning target** — where the critical path's difficulty is allowed to
  sit, and the one place a comprehension floor is permitted.

Three invariants and a target. That is the form the tests take.

---

## 2. Invariant A — no reachable state is terminal

> **No sequence of player actions, however ignorant or however deliberate, may
> reach a state from which completion is impossible.**

Trivializing the game is fine. Wasting a hundred hours is fine. Being *unable
to finish* is not. This invariant is unconditional and is not affected by the
revision: a softlock is a bug class, not a difficulty setting, and it strands
the skilled troll exactly as readily as the idiot.

**The exposed surface is the world graph and the economy, not power.** One-way
paths, hidden paths, `fightLimit` clearing spots and restock via `set` all
compose into stranding. Put a required drop behind a one-way edge into a
clearable spot and the player is finished and will never understand why. Power
is self-correcting — you grind more. Topology is not.

Concretely, three separate hazards, all of which are real and none of which is
a "failed action":

- **Stranding.** Every spot must be able to get home. A ring of one-way edges
  passes a naive reachability check and still keeps the player forever.
- **Exhaustion.** Nothing on the critical path may rest on a source that can
  run out. `once` and `fightLimit` sources need a restocking find. **Finds are
  not sources** — each fires once per save, so a find pays its quantity and
  never pays again. Only gather activities and endless spawns are repeatable.
- **Failure without recourse.** The critical path may not be locked behind an
  action that can be failed with no way back.

> **Failable is fine; unrecoverable is not.** Failure states — knocked-out and
> dead, and the wuxia breakthrough attempts that "can be failed" — are
> compatible with this law *only* if failure costs time and resources and never
> removes a path. **A failure that can be re-attempted is legal.** A failed
> breakthrough must leave the cap re-raisable. A death must be a setback.

---

## 3. Invariant B — critical-path knowledge is transferable

This is the rule that replaces the old "zero-authorship on-ramp," and it is a
different bargain. The old law protected the non-reader by never requiring
understanding. This one permits requiring understanding, and guarantees the
understanding is **obtainable and retrievable**.

> **The critical path may require subsystem usage. It may not require
> subsystem invention.**

Two clauses, both binding:

**Every system must be explained somewhere the player can open again.** Not a
one-time tutorial, not a log line that scrolls away. A durable, re-openable
in-game reference. The bestiary is the working prototype of the shape — a place
that accumulates facts about a thing and can be consulted later.

**Any subsystem-gated advancement must be findable by talking to NPCs and
reading guides**, some of which offer a shortcut — a better teacher gives a
better answer along the same road, which is the house pattern of width making
things faster rather than possible.

The consequence, stated as a prohibition:

> **Emergent combinations that require deliberate selection, and cannot
> reasonably be arrived at by a player who is not reasoning, are not legal on
> the critical path.**

They remain entirely legal — and encouraged — off it. See §5.

**The distinction that matters when authoring:** *consuming a system's output*
and *engaging its generative grammar* are miles apart, and "requires subsystem
usage" is ambiguous between them. The critical path may ask for the first. The
second belongs to optional content and to the final band only.

| System | The grammar that stays optional | What the road may ask for instead |
| --- | --- | --- |
| **Arcane** | composing sentences — word order, clause structure, leading vs trailing adverbs | **copy `fire:2 but venom cut` wholesale** from a bestiary entry or a teacher. He never learns why it works. |
| **Mutagens** | chromosome topology, split chromosomes, slot interaction | toss in two mutagens and **leave the gene bare**. The bare floor is free and costs no capacity — deliberately. |
| **Crafting** | recipes, quality grades, graded stock, Smithing progression | **pick weapons up as drops**, or buy them. |
| **Cooking** | prep, uniformity, bench runs, the stove timeline | eat what drops, or buy it. |

The arcane row is the archetype and is worth being precise about. Monsters
already cast real spells — `MonsterAction = { cast: SpellSource } | { technique: string }` —
and `fire:2 but venom cut` is a legal sentence today. **What is missing is the
transfer**: a bestiary fact that reveals a monster's sentence once you have
killed enough of them, and an affordance to copy it straight into the grimoire.
That is one fact kind and one button, and it is what makes this invariant true
for the deepest system in the game.

*(As of writing, the goblin shaman and Greenfire are not authored, and no
re-openable reference exists beyond the bestiary — the table describes the
intended shape, not shipped content.)*

**Design test for any new system:** name the thing a player who refuses to
learn it does instead, and name where they would be told. If the answer to the
first is "cannot progress" and to the second is "nowhere," the system has made
itself mandatory *and* unteachable, which is the only combination this
invariant forbids.

---

## 4. Invariant C — arithmetic and structure hold

You cannot patch exploits out of a combinatorial kitchen sink and this project
has decided not to try. The stance is scattered across the docs and should be
read as one policy:

- *"Clever syntax is the point — know the system so you can game the system.
  Cross-school scaffolds are deliberate design space, not bugs."* (ARCANE §14)
- *"All pure, all total — every input, however degenerate, produces an
  answer."* (MUSIC)
- *"Plain-swing-to-neutral remains the anti-softlock valve."* (MARTIAL)
- *"Spending your last biomatter in a body you regret cannot strand you in it
  … same intent, no softlock."* (MUTAGENS)

Promoted to a law: **an exploit may trivialize the game; it may not break it.**

> **No `NaN`. No `Infinity`. No negative-HP immortality. No fight that fails to
> terminate. No save that will not round-trip.**

That distinction is testable in a way "is this balanced?" never is. There is
already one accidental proof that the numbers hold: a real save reached *"a
dagger combat level of 109662 and about 79 trillion damage […] it seems to not
explode everything."* That is the archetype-3 stress test running itself. Keep
it running.

### 4a. The deliberate break, and its boundary

A state that deliberately breaks the game *safely* — as content, as a joke, as
a reward for a troll who earned it — is permitted, with one condition:

> **A deliberate break must have a return option, and that option must work
> from a cold load.**

This is not a formality. `serialize` writes with `JSON.stringify`, which
renders `Infinity` and `NaN` as **`null`**; `deserialize` then spreads
`{...createInitialState(), ...migrated}`, and because the key is *present* with
value `null`, the null wins over the default. `null` in arithmetic is silent —
`null * 5 === 0`. So a break state stored as a *magnitude* is destroyed by the
round-trip, and any exit path that reads it is operating on nothing.

**Therefore: store the break as a marker, not a magnitude.** A flag saying the
player is in the broken state, with the absurd number recomputed on load.

### 4b. Where non-finite values actually come from

Not from big numbers. From unbounded exponents, and from division by a value
floored at zero. The guards belong at those two places, in this order:

1. **Clamp in `serialize`, not on load.** By load time the evidence is gone —
   `null` is indistinguishable from a legitimately null field. The write side
   is the only place that still knows the value was `Infinity`. Coerce to a
   finite cap and log it. This is what actually preserves "every save
   round-trips."
2. **Bound the exponents, not the results.** The generators are concentrated:
   [`arcane.ts:510`](../src/core/systems/arcane.ts) and its siblings compute
   `Math.pow(mult, adv.count)` with a player-controlled `count`, then `*=` in a
   loop. Clamping results is whack-a-mole; clamping `count` is one line per
   site and kills the class. The decaying `Math.pow(0.999, …)` sites in
   `derived.ts` are safe by construction — a base under 1 converges to zero.
3. **Assert in dev, clamp in prod.** A `finite(n, label)` helper at
   derived-stat outputs that throws under test and warns-and-clamps live, so
   new sources surface at authoring time instead of hiding. This generalizes
   what the codebase already does ad hoc in three places —
   `progression.ts:91`, `derived.ts:550`, and `normalizeComposition`, whose
   header already notes that *"one NaN pitch is enough to take the whole staff
   down."*

**Known soft spot, currently unreachable:** *duplicate* instances of one
condition compound multiplicatively with no ceiling, and `Math.max(1, x)` is a
floor rather than a bound — so an overflowed `speed` walks straight through the
clamps and takes `extraSwings` to `Infinity` with it. Nothing can build that
state today. It becomes reachable the moment anything writes `state.statuses`
directly or a migration produces duplicates. The fix then is a real two-sided
clamp in `derived.ts`. Recorded in `tests/completability.test.ts`'s header.

---

## 5. Optional content, and the one thing it may never be

> **Optional content may be skill-locked, and there will be no apologies for
> doing so.**

Depth that never gates anything is decorative. Optional content is where the
generative grammars live — arcane sentence composition, mutagen topology,
alchemical sequence, the martial position graph, fingerprint-keyed music — and
it is allowed to demand real understanding, real planning, and real
deliberation, with no on-ramp and no teacher.

What makes that safe is a definition, not a courtesy:

> **Optional content is, by definition, content that is not a requirement for
> any critical path.**

⚠️ **Definitions do not lint.** If "optional" *means* not-a-critical-path-
dependency, then optional is a **computed** property, derived from the
critical-path closure — not a flag an author sets. An author-set flag can be
wrong, and when it is, the definition silently resolves the wrong way: a piece
of content marked optional that the closure says is required. Derive it, and
let the lint report the closure.

The same rule stated as the hazard it prevents: a critical-path gate that
references an item which only drops in skill-locked content has moved the skill
lock onto the road by accretion. Nobody decided to do that; it happens one
authored floor at a time.

---

## 6. The tuning target — and where the floor is allowed to sit

If John Idle must get most of the way, then **the critical path is tuned to the
narrowest build in the game**, and every other build is width that makes the
same road faster.

> **Content may not gate on power checks.** It gates on accumulation and time,
> or — where a power check genuinely belongs — the check sits at the longsword
> floor, and every other build blows straight through it.

**Difficulty becomes pacing, not lethality.** The floor build completes slowly;
the ceiling build completes fast. The distance between them is enormous and
*unbounded on the ceiling side by design* — slow compounding growth is wanted,
and flattening it is not the answer. For an idle game a speed differential is
the better motivator anyway: it is visible from hour one, whereas a wall only
motivates the people already standing at it.

### Where the comprehension floor goes

The in-flight world design (see [NEXT.md](NEXT.md)) is a **banded tower**:
floors grouped into bands, a band opening when the previous one is satisfied,
several floors per band with **varied gate kinds** — economic, skill-total,
quest-count, discovery-count, combat clear. Gate kinds are `UnlockCondition[]`,
so they cost nothing new to author and the forge validator sees them for free.

Two properties of that design carry this section:

- **The band is the disjunction.** [`conditionsMet`](../src/core/systems/conditions.ts)
  is `every` — pure AND, no `any`. Rather than growing the predicate language,
  the OR lives in the topology: several floors per band, each with a flat AND
  gate. A floor may name a specific discipline *if its band offers another
  floor that does not*, which turns a named gate into a shortcut for the
  specialist rather than a wall for John.
- **Accumulation gates are a floor denominated in persistence.** Gold, quest
  counts, discovery counts. That is a real floor, and it is the genre's normal
  bargain — idle games ask whether you keep showing up, not whether you can
  solve something. It also means the tower advances offline, which is the only
  way an active-clear structure and an idle loop stop competing.

Given that, the comprehension floor is permitted in exactly one place:

> **The final band may require genuine engagement with a generative grammar.
> No band before it may.**

Late and local. The floor exists and means something, and nobody sinks eighty
hours before discovering it — which is the failure mode that makes players
quit, more reliably than difficulty does.

⚠️ **Quest-count gates are the one gate kind that strains archetype 1.** Gold,
skill-total, kill-count and discovery-count all accrue from acting at all.
Quests require intention, and the goldfish measures the gap: most seeds finish
no quest at all in 60k ticks, failing at the *objectives* rather than the
delivery. `tests/goldfish.test.ts:46` already flagged this before there was a
critical path to run through it. A band gated on quests needs an accumulation
floor beside it.

### Progress must accrue from acting at all, not from acting correctly

This survives the revision unchanged, and matters *more* now rather than less —
it is what carries a non-reader as far as the final band. It is already the
house style and the single biggest reason archetype 1 works today: skills
*manifest* from doing rather than being chosen, resistance skills come from
exposure, and the novelty ledger pays discovery XP for new combinations without
asking whether they were good ones. A player who understands nothing still
moves, because the game reads their actions rather than their intentions.

**Preserve this property in every new system.** A system that only pays out
when used *correctly* has quietly made itself mandatory to understand.

---

## 7. Where this bites

There is **no win condition in the code today** — only `superattrs.data.ts`
gesturing at an "intended endgame." That is exactly why this is written now:
the unbuilt layers are places the law gets violated by default.

- **Prestige / diminished persistence.** The reset rules must guarantee that
  what survives is enough to redo the road. Workers keeping genes but not
  materials is fine. Anything that resets a player *below* the floor build is
  not. Nothing in §2–§6 covers this; it needs its own check once prestige has a
  shape.
- **Wuxia breakthroughs.** "An escalating quest/task that can be failed" —
  legal under §2 precisely because it is re-attemptable. `raiseSkillCap` being
  the authored caller is fine; a failed attempt must leave the cap re-raisable.
- **Classes.** "A class must be an opt-in sharpening, never a mandatory
  funnel." Must stay handled once classes carry real power, and "staying
  classless" must remain a complete build.
- **The demon lord's army.** An origin chosen at new-game is the most dangerous
  item on the roadmap for archetype 1 — that player will pick it by accident.
  **If it forks at new-game, both forks must finish.** Otherwise it must be
  defection-in-play rather than a fork at character creation.

---

## 8. Enforcement

The invariants are lint rules, not just prose here. Content rules live in
`tests/content.test.ts` — the authority — and are mirrored into
`forge/lib/validate.ts` for live feedback, per the standing two-layer rule.

| Rule | Where | Enforces | Status |
| --- | --- | --- | --- |
| **Every spot can get home** — reverse-reachability to a waypoint, so no one-way edge is a trap | `content.test.ts` + forge mirror | A | **shipped** |
| **No quest objective rests on a source that can run out** — `once` and `fightLimit` sources need a restocking find | `content.test.ts` + forge mirror | A | **shipped** |
| **Degeneracy stays finite** — absurd builds produce finite stats, a save that round-trips, and a fight that resolves | `tests/completability.test.ts` | C | **shipped** |
| **The goldfish** — a random player drives the real game and never runs out of legal actions | `tests/goldfish.ts` + `.test.ts` | A, empirically | **shipped** |
| **Non-finite values never serialize** — `serialize` clamps on the way out; player-controlled exponents are bounded at the `Math.pow` sites | `save.ts` + `completability.test.ts` | C | **unbuilt** (§4b) |
| **Every subsystem-naming critical gate has a teacher** — an NPC or guide that hands over the combination, **reachable without passing the gate it teaches** | `content.test.ts` + forge mirror | B | **unbuilt** (§3) |
| **Optional is computed, not declared** — derived from the critical-path closure; an author-set flag is cross-checked against it, never trusted | `content.test.ts` | B, §5 | **unbuilt** |
| **John** — a directed floor-build driver clears bands 1..N−1 | `tests/john.ts` + `.test.ts`, `npm run pacing` | tuning target | **shipped** for band 1 (2026-10-10) |

### The goldfish is not a completion oracle

Worth stating plainly, because it is easy to misread the name as a stronger
claim than the file makes. The goldfish asserts **liveness of options**, not
arrival at an end: `blanked === 0`, some progress, skills manifesting, more
than one spot visited, a save that round-trips. Its one quest assertion is
hedged in the file itself — *"It is ONE seed on purpose."*

That is the correct scope and it should stay there. Its value is having **no
policy**: it is a fuzzer with a persona, and directing it destroys exactly what
makes its findings meaningful. It works because `src/core` is DOM-free and
every player action is a `Game` method. Seeded and deterministic, so any
failure replays from `runGoldfish(seed, ticks)`.

Two weights are the whole persona and should not be flattened:

- **Carrying on is the likeliest thing it does.** Uniform choice re-picks the
  activity every few seconds and grinds out nothing — a worse model of
  inattention than stickiness is.
- **A finished quest gets delivered.** `canTurnIn` requires standing before the
  giver, so it uses `travelPlanTo` — the map click, auto-routing over
  discovered spots exactly as the Location tab does. Heading back to the person
  who asked is the least sophisticated intention a player can form.

**What it found, worth knowing rather than fixing:**

- **Quests reward directed play, and this thing has no direction.** Only one
  seed in eight finished a quest inside 60k ticks. See the warning in §6 — this
  is now load-bearing, because quest-count gates are on the table.

  **Re-measured 2026-08-10, after the start moved to Threshold.** The property
  survived but the numbers moved, and *where* the quests are is the finding:
  seed 7 — chosen originally because `my_home` sat a few rooms from the
  quest-givers — now closes none even at 400k ticks, while seeds 42 and 99 each
  close two at 150k. Every one of those is in the old world, down the Hamlet
  Road, because **Threshold has no NPCs and no quests of its own yet**. The
  starting city is also where §3's teachers belong, so the two gaps close
  together.
- **The player base is a randomness sink.** `my_home` starts inside a ~25-room
  cluster whose rooms all have `activities: []`, being shells for the unbuilt
  base-building system. Most seeds do get out. No stall threshold is asserted
  for this reason.

### John

The completion question needs a **second instrument**, not a smarter goldfish.
John is a directed driver: longsword, refuses every subsystem, greedily pursues
the next band gate. He rides the same `Game`-methods harness.

Two instruments, two claims. **The goldfish proves nothing closes. John proves
the road exists.**

The lint's quantifier is the thing to get right, and §6 already specifies it.
Do **not** write "every critical-path gate is satisfiable with each discipline
removed in turn" — that is a universal quantifier over discipline subsets, and
against a banded tower it explodes into an authoring tax where every band needs
a floor for every discipline-less build. Walk **one** synthetic character.

And the comprehension floor is then a parameter rather than a mood:

> **John asserts through band N−1 and stops.** Moving the floor means moving
> that number, not re-litigating the philosophy.

**Built 2026-10-10 for band 1** (`tests/john.ts`). John is Skip tutorial —
rusty sword, Neutral, no spell — walking the floors in order, hunting and
searching where each floor says to, working a Threshold job when a gate wants
coin, and walking straight back after every knockout. He never shops, crafts,
quests or reads. The same driver also plays the tutorial with each rack pick,
so the curve is measured for every build the game hands out, and an
`attentive` habit (explore first, wield what the floor hands over) measures
whether the floors' own answers are worth picking up. `npm run pacing` prints
the table; `tests/john.test.ts` holds the expectations.

What he found on the way, before the band was retuned around him:

- **Lethality, not pacing, on floor 3.** 14–110 knockouts and up to two hours
  for every build. The spider queen's venom sat above poison's escalation cap,
  so her second bite turned to rot that finished most winners on the floor
  after she died; she could also be drafted as her own escort (four in one
  fight). Now: band 1 in about 16 minutes for John, 5–8 knockouts on the
  floor, and a rusty sword that beats the queen once it has a few more levels.
- **An economy that inverted at the top of the band.** Kill gold scales with
  level × tier, so floor-3 spiders paid ~170 each and a band-1 climb ended
  holding 6k–90k gold. Now ~1k.
- **A first boss that was a formality** — ten seconds, one landed blow, its
  three spell reactions unfelt. Now a 20–35 s fight that wins about one first
  attempt in four.
- **A trained weapon can beat the right one.** Floor 2's find (a club) wins a
  cistern duel 20 to 11 from equal footing, but John's sword carries floor 1's
  Swordsmanship and roughly breaks even. That is a real decision rather than a
  bug, so it is tested as a duel, not as a rule John must follow.

---

## 9. Cross-references

- **The premise this protects** — README.md; breadth is the identity, so the
  road through it has to be narrow-build-clearable.
- **Exploit policy in full** — [ARCANE.md §13–14](ARCANE.md); the shipped
  exploits are deliberate.
- **Anti-softlock precedents** — [MARTIAL.md](MARTIAL.md)
  (plain-swing-to-neutral), [MUTAGENS.md](MUTAGENS.md) (the free bare floor),
  [MUSIC.md](MUSIC.md) (total classification).
- **The unbuilt layers this constrains** — [NEXT.md](NEXT.md), including the
  banded tower §6 assumes.
- **Authoring rules** — [CONTENT_GUIDE.md](CONTENT_GUIDE.md); §3's design test
  belongs in the author's head before a new system's first data entry.
