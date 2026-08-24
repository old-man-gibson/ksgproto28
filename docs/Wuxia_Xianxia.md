# WUXIA
TBD
# XIANXIA

## Cultivation tiers
*Tier 0 at the top and growing more powerful down the file. Each tier can achieve a "transcendental" stage if the player continues to train in that tier and wilfully ignoring tier-up quests/missions. this is never advertised to the player, and they have to achieve this act of absurd stubbornness of their own volition. as a reward, each tier gains hidden bonuses for each stage they essentially "skipped" that are not available to other tiers. if the player then goes onto a tier-up quest they are not placed to the next tier in the normal progression but the tier they fit in terms of power, i.e. the player can skip several tiers at once. whenever the player more power and cultivation than necessary for a breakthrough, the excess power is granted as a logarithmic bonus to efficiency. if a player gathers enough power to skip a tier, they can still decide to break through to the next canonical tier as long as the player is below 15% of the skipped tier's breakthrough requirement, e.g. a human who has "114%" power to break through to the Oni Realm can still opt to break through purely to the Hungry Ghost Realm, gaining a log_x(n-y)% efficiency on their Hungry Ghost Realm cultivation, helping them accelerate the process, trading in hidden bonuses for quickly gaining Hungry Ghost Realm bonuses. If a player were to have "115%" power, they can no longer break through to the Hungry Ghost Realm and instead is locked into the Oni Realm and so on, but the player still gains a choice to allow them to choose between commit to the stubborn progression.*
* *
* Human
  * Early Human
  * Intermediate Human
  * Peak Human
* Hungry Ghost
  * Early Ghost
  * Intermediate Ghost
  * Peak Ghost
* Oni
  * Early Oni
  * Intermediate Oni
  * Peak Oni
* Asura
  * Early Asura
  * Intermediate Asura
  * Peak Asura
* Deva
  * Early Deva
  * Intermediate Deva
  * Peak Deva
* ...

## Wuxin
*The player's Wuxin should follow a few basic rules:*
* the cycle is based on the genertive and destructive cycles, each element points at one element, nourishing it, and another element, hindering it.
  * each element is conversely pointed at by two elements, one nourishing it, one hindering it
* the cycle is composed of five elements in a pentagonal arrangement 
* the player should be able to swap out elements for those of their own choice, based on the nouns already available in arcane magic
  * corollary: adding or removing nouns in the spellcraft system would affect the available elements in the player's wuxin configuration
    * addendum: it uses those nouns to *inform* what is available but does not substitute magic nor is it a sub-component of arcane magic
* the player's wuxin configuration can be the classical harmonious fire->earth->metal->water->wood->fire loop or a similar harmonious variant (it should be emergent from configurations than hardcoded)
  * it can also be in a burst configuration that has a zero or near-zero generative connection, creating a "circular line" that increases in power but has close to zero sustain, hence "burst configuration"
  * it can also be a sustain configuration that has no true destructive effects, and generates less raw power but increases efficiency and other sustain effects
* corollary to the whole thing: sects, martial masters, certain monsters all can have their own configuration
  * there must be one great beast per element that drops an elemental core that the player can use to attain special growth paths for their own elements, up to and including a complete set of all cores for the player to absorb and attain crazy bonuses if they pull it off

*in general there needs to be a clear grammar and syntax to describe how the elements nourish and hinder each other to make the system configurable and modifiable*

---

## Wuxin — the spec

**Shipped:** the structure. `src/core/systems/wuxin.ts`, types in `types.ts`,
tests in `tests/wuxin.test.ts`. **Not shipped, deliberately:** what any of it
*does*. There is not one number in that module. The effects are going to be
argued about for a long time and the structure should not have to be reopened
every time they are, so when they arrive they belong in their own module
reading this one — never bolted into it.

### The grammar

One clause per element, five clauses per configuration:

```
seed  → fire  ⊣ stone
fire  → stone ⊣ iron
stone → iron  ⊣ water
iron  → water ⊣ seed
water → seed  ⊣ fire
```

`→` nourishes, `⊣` hinders, `∅` severs an arrow. Read aloud: "seed nourishes
fire, hinders stone." That is the entire syntax. A sect, a master, a great
beast or the player's own cycle is five of these lines and nothing else.
`parseWuxin` also accepts ASCII `->` and `-|` so a configuration can be typed
without hunting for glyphs, and `formatWuxin` round-trips.

(The example above is the classical loop spelled in the vocabulary the game
actually has: `seed` stands in for wood, `stone` for earth, `iron` for metal.)

### Legality

The rule "each element points at one of each, and is pointed at by one of each"
says precisely: **generation and destruction are each fixed-point-free
permutations of the five slots.** `validateWuxin` enforces exactly that —
five slots, distinct elements drawn from the arcane nouns, no self-arrows, no
arrow leaving the cycle, and nothing pointed at twice by the same relation.

A **severed** arrow is legal, not an error. It is how the non-harmonious shapes
are expressed, and `classify` is what has an opinion about it.

### Two facts that made classification free

**1. Only two closed shapes exist.** A fixed-point-free permutation of five
elements decomposes into either one 5-cycle or a 2-cycle plus a 3-cycle —
2+2+1, 4+1 and 3+1+1 all need a fixed point. So an unsevered generative graph
is either one ring through everything, or a mutually feeding pair standing
apart from a triangle. There is no third option, which is a very small space to
balance.

**2. The classical loop is `hinders = nourishes ∘ nourishes`.** Take the
generative ring wood→fire→earth→metal→water→wood and apply it twice: wood→earth,
fire→metal, earth→water, metal→wood, water→fire — which is exactly 木克土,
火克金, 土克水, 金克木, 水克火. Destruction is generation squared; the pentagram
inscribed in the pentagon.

So harmony is a **relation between the two arrow sets**, not a table somebody
has to maintain. `discord()` counts the elements that break it (0–5), which
makes "the classical loop or a similar harmonious variant, emergent rather than
hardcoded" a one-line test that recognises a cycle built from five completely
different elements just as readily. `discord` is NOT a balance dial, though —
see "Discord is not a distance" below; `harmonyDistance()` is the one with an
ordering on it.

### The configurations, falling out of the shape

`classify()` returns one of:

| kind | shape | the note's intent |
| --- | --- | --- |
| `harmonious` | generation closes, `discord === 0` | the classical loop and its variants |
| `counterflow` | destruction is generation reversed | found by hand in the panel; see below |
| `split` | generation closes as two loops | the only other closed shape — a feeding pair beside a triangle |
| `burst` | generation is cut somewhere | the "circular line": a ring opened into a chain, head starved, tail uncontested |
| `sustain` | destruction cut everywhere | nothing in the cycle fights anything else in it |
| `tempered` | destruction cut somewhere, generation whole | a deliberate gap left in the antagonism — a bump in the engine |
| `irregular` | closed, but no single structure relates the two rings | legal; someone will work out what it is for |

### Counterflow, and the alignment exponent

Harmony is `D = G²`. Its antipode is `D = G⁻¹`: destruction is the generative
ring run **backwards**, so every element hinders the one that feeds it. Stated
the striking way — X nourishes Y, and Y hinders X — every pair along the ring
is feeding its own attacker. A cycle at war with itself along the channel it
lives by. It is always maximally discordant (`discord === 5`) for the same
reason harmony is always zero.

That exposed a spectrum. When both relations close into single rings, the whole
character of a configuration is **one exponent k**, and `alignment()` returns it
(or null when no single k reaches destruction, which is what a genuinely
arbitrary rewiring looks like):

| k | `D = Gᵏ` | |
| --- | --- | --- |
| 1 | destruction *is* generation | you feed and fight the same thing |
| 2 | **harmonious** | the classical relation |
| 3 | the pentagram traced the other way | unnamed |
| 4 | **counterflow** | feeding your own attacker |

So `irregular` should be read as "no structure", not "unfamiliar structure" —
the exponent is what tells those apart, and it is worth surfacing anywhere a
cycle is displayed.

**A split can never be harmonious.** Inside a generative pair, two steps land
you back where you started, so harmony would require an element to hinder
itself — illegal. Its discord can never fall below 2, one per member of the
pair. It *can* be a counterflow, though: reversing a pair is just the pair
again. So the split shape is structurally capable of being at war with itself
and structurally incapable of being at peace. If harmony is ever made the
aspirational configuration, splits are permanently second-class — decide that
deliberately rather than discovering it later. Both facts are tested.

Note the correction the implementation forced: **a burst configuration cannot
exist under the in-degree rule alone** — a permutation always closes into
loops. It needs *severable* arrows, which is why `nourishes`/`hinders` are
nullable. "A circular line" is a broken ring, and that reads exactly right.

SUPERSEDED: an early draft of this section guessed that the spectral radius of
a 5×5 flow matrix would be the single number describing a configuration, with
λ ≈ 1 meaning sustain. The effects design below settled it differently and more
precisely — circulation is lossless distribution, so λ = 1 always, and `sustain`
is about **destruction being cut**, not about the generative eigenvalue. See
"The transfer ratio" and "The cycle is a flow-through". The one thing that
survives from that draft: whatever reads the configuration **is a mod source and
must go into `modFingerprint`.**

### Discord is not a distance — the numbers

`discord` counts the slots where `hinders(e) ≠ nourishes(nourishes(e))`. That is
a Hamming distance between your destruction ring and **one specific
configuration** — the harmonious partner of your generative ring. It answers
"is this the classical relation" and nothing else. Do not hang effects on it.

Brute-forcing every legal closed configuration (44 derangements of five
elements, so 44² = **1936**; `tests/wuxin.test.ts` keeps the key rows honest):

| discord | configs |
| --- | --- |
| 0 | 24 |
| **1** | **0 — impossible** |
| 2 | 140 |
| 3 | 360 |
| 4 | 720 |
| 5 | 692 |

- **Discord 1 cannot occur in a closed cycle.** Destruction and
  generation-squared are both bijections on five slots; agreeing in four places
  forces the fifth. The same argument bans exactly-four doubled arrows. Cut an
  arrow and both become reachable — a `tempered` cycle reads discord 1.
- **All 24 harmonious configurations have a 5-cycle generation**, which is the
  no-harmonious-split result by exhaustion. 24 is also exactly the number of
  5-cycles, so harmony is *unique per ring*: choose your generative ring and the
  harmonious destruction is determined rather than chosen.
- **A 5-ring admits all four powers** (24 configurations each). A 2+3 split
  admits only k = 1.
- **Discord 5 is a junk drawer.** 692 configurations (36% of the space) read
  maximum: 24 counterflows, 24 at k=3, 44 at k=1 — and 600 with no structure at
  all, all reported identically.

The real gradient is `harmonyDistance()`: the cyclic distance of the exponent
from 2, since exponents live mod 5.

| k | relation | distance |
| --- | --- | --- |
| 2 | harmonious | 0 |
| 1 | destruction is generation | 1 |
| 3 | pentagram reversed | 1 |
| 4 | counterflow | 2 — the antipode |

Unaligned configurations have no distance, and the panel says so rather than
printing a number that means nothing.

### Landmarks — what the shape alone singles out

`landmarks()`, all shape-only, no numbers:

- **pivot** — when both relations split 2+3 on *disjoint* pairs, four elements
  are spoken for and exactly one is left over, necessarily the sole member of
  both triangles and the only element in no mutual bond of either kind. Forced
  by counting, not chosen.
- **orphan** — no arrows at all, in or out. Unreachable without severing: a
  permutation cannot leave an element out, so zero of the 1936 closed
  configurations contain one. An orphan lives outside the closed space entirely.
- **sink** — points at nothing, yet both relations point at it. Everything
  drains here and nothing leaves.
- **source** — points at both, yet nothing points at it. Both lines start here.
- **doubled** — the two arrows name the same target: feeding and fighting the
  same thing. **Forced** inside a generative pair whose partition destruction
  shares; incidental everywhere else. Note that inside a 2-cycle `G = G⁻¹`, so a
  doubled pair is simultaneously k=1 and a local counterflow — the two only
  diverge in the triangle.

---

## What Wuxin DOES — the effects design

**Status: settled in conversation, not built.** `systems/wuxin.ts` is still
numberless and should stay that way until the sources below are decided. This
section is the target, not a description of code.

### The criterion that ruled everything else out

**The graph has to be load-bearing.** If five independent slots with no arrows
could produce the same result, the arrows are decoration and the pentagon is a
stat page in costume. That disqualifies every version of "each element grants
+X% to its damage type / its resist skill / its spell power" — all of them
reduce to a sum, and a sum does not care what points at what.

### The two rules

**Wuxin is a routing layer for surplus. It grants nothing; it decides where
what you already produce goes when it has nowhere else to be.**

Each element in the cycle accumulates a **charge**. Then:

1. **Generative arrow A→B** — energy arriving at A splits: part is retained,
   part continues to B, and the same split happens again wherever it lands.
   Generation passes energy SIDEWAYS, and it does so on arrival rather than
   only on overflow (see "The transfer ratio"). Its role is to *concentrate* —
   it is how a single element's contents are built up.
2. **Destructive arrow A⊣B** — A spends charge against B in an `x:y` trade, and
   what is released carries **B's** nature rather than A's. This is how stored
   charge is *used*, and it is the deliberate drain.

There are **two drains, in different modes.** Destruction is the one you aim;
deviation is the one that happens to you when charge can neither be spent nor
passed on and leaks into the practitioner instead. Both remove charge, which is
why *every* configuration reaches an equilibrium — some by spending, some by
bleeding.

This is not a new motif. Overflow-must-land-somewhere is written into this
game four times already — excess healing becoming `overgrowth`, mana past zero
returning as fire, a seed's graft ledger harvested as heat, and this file's own
"excess power at a breakthrough becomes a logarithmic efficiency bonus". Wuxin
is that rule with a topology.

### Output rides an existing action — it is never its own attack

A discharge does not deal damage by itself. It rides whatever you were doing
anyway: a martial technique, an arcane working, a psionic exertion, a forge
heat, a brew, a dish. **This is the decision that stops Wuxin becoming a sixth
school** competing with the others for the same slot in a fight. It multiplies
breadth instead of adding width, which is the whole identity of the game.

Crafting is not the afterthought in that list, it is the strongest argument for
it. Alchemy, cooking and mutagens each already carry a crafting identity
(sequence, timing, topology). Wuxin adds an axis none of them have: *what was
flowing through you while you made it.*

**Discharge conditions belong to the player**, through the existing trigger
editor — the same surface that already decides when a technique fires.

> GUARDRAIL: a discharge trigger may key on **state** — charge level, position,
> what the target is carrying. It may never key on "after technique X". That is
> an edge, and MARTIAL.md §9 forbids the player assembling A-then-B. The
> sanctioned one-deep `onTechnique:<id>` case is content's, not the player's.

### Naming — analysis names the product, again

The wuxia flavour is compositional and so is the grammar. Decomposing the
canonical shape:

> **Twelve Steps** **True Path** **Technique** — **Sky-Burning** **Slash**

| fragment | axis | source |
| --- | --- | --- |
| Twelve Steps | tier / count | cultivation realm, or charge depth |
| True Path | school | allegiances (NEXT.md: daoist, orthodox, unorthodox, demonic, solitary) |
| Technique | category | the host system — technique / working / dish / blade |
| Sky-Burning | element + intensity | the discharging node, and how full it was |
| Slash | host action | the thing you actually did |

Five slots, every one mapping to something the game has or has planned. It must
be a **grammar, not a table** — twelve nouns × tiers × host families is far too
big to author — and it inherits the music system's law: **classification stays
total.** Every combination produces something sayable, including the ugly ones.
No discharge is ever left unnamed.

### Input — what charges a node

**Energy of a node's own type charges that node, if the node has room to accept
it.** It is stored — in the reservoir, the dantian, whatever it ends up being
called — and that is all. Legitimate sources:

- **hostile attacks** — energy arriving from something that meant it
- **the nature around you** — ambient, per the osmotic curve below
- **food** — what you eat carries what it was made of

> **Charging NEVER mitigates.** A blow that charges a node still lands in full.
> Absorbing is not a defence, and must never be allowed to become one — the
> moment it reduces damage, being hit becomes desirable and the entire risk
> profile of the input ladder inverts.

Two laws bound it.

**LAW 1 — nothing self-inflicted charges anything.** You cannot cast at
yourself to fill a node.

**LAW 2 — conservation. One unit of output yields at most one unit of charge**,
by any route, through any number of hops. A working that outputs 50 heat can
charge at most 50, whether it reaches you directly, by reflection, or after
being passed around the ring.

Law 2 is the one that does the real work, because it also constrains the
arrows: **a generative arrow passes at most what the sending node lost.** No
amplification anywhere. The spectral radius of the flow is therefore ≤ 1 —
**except under a declared conservation exception**, of which active cultivation
is the first and principal one. Absent such an exception, circulation is
lossless at best and the ONLY source of energy in the system is the world. A
`burst` configuration is not an amplifier; it is a hoarder whose tail cannot
pass anything on.

#### Provenance must be carried, not inferred

"Self-inflicted" cannot be decided at the receiving end, or every new feature
becomes a laundering route. The known ones already in the game:

- **`manaburn`** — your own overdraft returns as heat. Your mana, your fire.
- **`retaliate`** — a thorns effect deals damage *dealt by* the enemy but
  *caused by* your blow.
- **`overgrowth` detonation** — poison showering everything beside the bearer,
  from healing you poured in.
- **summons, crafted workers, allies** — planned, and none of them are you.
- **environmental effects you created** — bombs, traps, weather work.

So the energy packet must carry where it came from, the way damage slices
already carry a `source`. The rule to implement is *"energy originating with
the practitioner does not charge the practitioner"*, propagated along the
causal chain — not a check for "was this a self-targeted spell".

#### Breaking conservation must be formalized

Some art, somewhere, will want to exceed 100%. That is fine, and it must be
**declared and bounded** rather than emergent: an authored field naming the
ceiling it is allowed to reach and what grants it, so the exception is a
readable number in one place. A test asserting nothing in content exceeds its
declared ceiling is what keeps this from rotting — see the exploit policy in
the spellcraft notes for the same instinct applied to arcana.

### Input — the ladder that breakthroughs actually grant

A breakthrough does not hand out numbers. **It grants a new way to take charge
in.** Four rungs:

1. **Struck by it.** Take heat damage, fire charges. Rides the exposure system
   that already manifests and levels the resistance skills from being hit.
2. **Wield it.** Cast it, forge with it, cook with it.
3. **Stand in it.** Present in an area or weather carrying the tag. Spots and
   weather are both shipped.
4. **The nature realm.** The world feeds you regardless of tag — qi flowing
   from the world itself through the practitioner.

Rung one is free and automatic, which is the zero-authorship on-ramp: a player
who never opens the panel still accumulates by being hit by things.

### Ambient income is osmotic, and the container is the topology

Unbounded passive growth would make closing the tab optimal. It is also not
what the fiction wants. Both are solved by the same curve:

**Inflow scales with headroom.** The world is effectively infinite, so you
could in principle grow without limit — but your container fills, and as it
fills each further unit is less and less likely to find room. Progress never
stops and never runs away; it approaches an equilibrium asymptotically, like
osmosis toward a concentration.

The crucial part: **headroom is what the configuration decides.** Circulation
makes room.

**A full node is not a blocked node.** Excess fire nourishes stone, stone
nourishes iron, on around the ring; intake into any one element continues for
as long as anything *downstream* has room. Saturation is a property of the
whole reachable cycle, never of a single slot.

And the more charge the ring carries, the more the destructive arrows have to
spend — so **drain scales with what is held**. That is a negative feedback, and
it is what makes the whole thing settle instead of either filling or emptying:

```
intake  →  circulate (generation)  →  drain (destruction)
equilibrium where intake rate = drain rate
```

#### The transfer ratio — circulation is distribution, not overflow

**All incoming energy circulates, not only excess.** Energy arriving at a node
splits: a share is retained, the rest continues along the generative arrow, and
the same split happens again at every node it reaches.

The ratio is **retention against propagation**, and it is LOSSLESS:

```
2:1   of every 2 units arriving, 1 continues     (half retained)
3:1   of every 3 units arriving, 1 continues     (two thirds retained)
```

Base is 2:1 or 3:1. **Excess propagates at a better ratio, pushing toward 1:1**
— a vessel already full passes on more of what it is given — but only somewhat;
1:1 means a node retains nothing at all and is a conveyor rather than a slot.

That excess ratio is the natural **progression axis**: a Deva's meridians should
move overflow along where a Human's would leak it, so realms granting a better
excess ratio directly reduce deviation without touching anything else. It is
also safe by construction — improving how much of an overflow *moves* can never
create energy, so conservation is never in question.

Around a five-ring at 2:1, 32 units arriving at fire distribute as
16 / 8 / 4 / 2 / 1, with the last unit arriving back at fire. **Thirty-two in,
one returns**, and 16+8+4+2+1+1 = 32. Nothing is created and nothing is lost;
circulation only ever *spreads*. λ = 1 exactly, which conservation permits —
the law forbids amplification, not movement.

Two consequences worth stating plainly:

- **A single element's exposure charges the whole cycle.** Fire exposure feeds
  fire, then stone, then iron, geometrically diminishing. So a **harmonious ring
  converts a narrow intake profile into a broad charge profile** — the player
  who only ever fights fire monsters still ends up with a working cycle, just
  weighted toward fire. That is a completability safety valve nobody had to
  author.
- **Position relative to your intake now matters.** Which element sits
  immediately downstream of the one you are actually being hit by decides who
  gets the second-largest share. Ordering the ring stops being cosmetic.

**Circulation terminates on its own.** A generative pair round-trips in two
hops, but 8 arriving still distributes 4 → 2 → 1 → 0.5 …, a geometric series
that converges. No anti-loop rule is needed; the split is the rule. ("The loop
is full, dump it somewhere" is still worth having, but as a CAPACITY rule, not
as protection against perpetual circulation.)

The order at each node stays: **spend it, else pass it, else leak it** — the
split happens on arrival, destruction spends from what was retained, anything
retained past capacity propagates onward at the better excess ratio, and only
what can do none of those leaks as deviation.

Which reproduces the original notes' own intuition with nothing authored for it:

- **harmonious** — everything routes and everything drains. Highest sustained
  throughput, because the ring is always making room.
- **sustain** (destruction cut) — nothing drains. The ring fills to capacity and
  intake falls away, so it holds a great deal and converts none of it.
  *"Generates less raw power but increases efficiency"*, exactly as written.
- **burst** (generation cut) — the tail cannot pass on, so it saturates locally
  while the head still has room. Hoarding.
- **tempered** — leaks at the gap.
- **orphan** — no route in, no route out. Only leaks.
- **split** — see below; the two loops make it an engine rather than a lesser
  ring.

#### The split, rehabilitated: a pump and a drain

A split cannot be harmonious and its discord can never fall below 2, which made
it read as second-class. Under the transfer ratio it is not — it is the only
configuration with **two independent reservoirs**, and that is a tool.

A generative pair returns a quarter of what enters it on each round trip
instead of a thirty-second, so charge stays concentrated between two elements
instead of thinning across five. Pump the pair with intake it is good at
absorbing, let it fill, and point its destructive arrow into the *other* loop.
One loop becomes a battery powering suppression in a subsystem it is not part
of.

That is directly useful against a known opponent: fighting something whose
attacks carry a particular nature, a player can seat a well-fed destructive
arrow onto exactly the element whose habituation ledger they need cleared, and
keep clearing it for as long as the pair can be refilled. Configuration becomes
a response to what you are fighting — which is what the graph was drawn for.

Note the granularity the seating penalty imposes: at ×0.7 per swap this is a
configuration built for a **campaign**, not retuned per encounter. That is the
right scale for it.

So "the world feeds you" stays literally true while what you can *hold* is
decided by the shape you chose. The limiter is topology, not a clock and not a
magic number.

> **INVARIANT — the ambient equilibrium must always sit BELOW the current
> tier's breakthrough requirement.** Idling must always move you forward within
> a realm and must never carry you through one. Otherwise an untouched game
> tiers up forever, and the breakthrough quests — the actual content — become
> optional. This is the single number that keeps the whole model honest.

### Active cultivation — the second curve

Sitting down to cultivate deliberately does something passive absorption
cannot: **it lets the ring amplify.** Active cultivation raises λ above 1, so
charge compounds as it circulates instead of merely circulating.

This is a **declared exception to conservation** (Law 2), and per that section's
own policy it must be bounded by a named ceiling rather than being an ad-hoc
multiplier. It is the first entry in the exception registry, and the reason the
registry exists.

The bound is a sigmoid on how full the reservoir is against the next threshold,
which makes the whole thing the logistic equation:

```
passive (osmotic)   dC/dt ∝ (K − C)        fastest when empty, no sweet spot
active (logistic)   dC/dt ∝ C · (K − C)    zero when empty, peaks at K/2
```

Nothing to compound means slow growth; a crowded reservoir has no room to cram
more into; **the sweet spot is the middle** — abundant enough to feed back,
sparse enough not to choke.

The two curves compose into the progression:

| fill | what carries you |
| --- | --- |
| near empty | osmosis only — active cultivation has nothing to multiply |
| the middle band | both, and active dominates. The productive years |
| near the ceiling | both choke. Time to break through, or to stop |

Which is why passive play is never useless and never competitive: ambient
income exists precisely so the logistic term has a seed to work on.

#### Cultivating is safe; the shape still decides how far you get

λ > 1 compounds charge, and a saturated ring simply **stops gaining** — it does
not turn on you. Cultivation is never a deviation source (see "The relaxed
state"). What the configuration decides is how much you can compound before
that stall arrives: a harmonious ring keeps making room and rides the productive
band far longer, while a burst tail saturates early and sits there.

The burst configuration still pays for that, but it pays **in combat**, where
pressure is on and a tail with nowhere to send its surplus leaks.

#### It is an activity, and place matters

Active cultivation is a **selectable activity**, performable anywhere, with
**bonuses where the area carries relevant tags** — so there is a reason to
travel to cultivate rather than only a reason to sit still. Passive generation
continues while you do anything else, or nothing, at a much slower rate.

That gives cultivation a real opportunity cost: the activity slot it occupies
is one not spent crafting, training or working. Worth remembering when the
curves are tuned, because "the productive middle band" is only productive
relative to what else that time could have bought.

#### What this does to the tier ladder

The ceiling K is the **next threshold**, not the node cap — which sharpens the
ambient invariant into a clean division of labour:

- **ambient equilibrium** sits strictly BELOW the tier requirement — idling
  always progresses, never breaks through
- **active cultivation** can carry you to the requirement — breaking through is
  something you do

#### Two ladders, and only one of them is automatic

CONFIRMED. Exceeding a breakthrough requirement without performing the quest
**breaks it quietly**: K re-targets upward to the tier after it, headroom
reopens, and the cultivator drops back into the productive middle band of a
larger curve. So there are two ladders running at different speeds:

- **cultivation** — charge, K, the curve. Advances on its own.
- **realm** — the tier, its bonuses, its abilities. Requires the quest.

The stubborn player climbs the first without the second, and when they finally
take a breakthrough quest the realm ladder catches up in one jump to whatever
tier their power actually fits.

**The price is a compounding brake.** Each quietly-skipped tier makes the
sigmoid harsher, and the harshness compounds. Progress never stops — the curve
stays a curve, so there is no terminal state — but each further skip costs
disproportionately more time. The prize is abilities obtainable no other way;
the cost is time, and careful planning if you want to shorten it.

That brake is what keeps stubbornness from being strictly correct. Without it,
skipping would dominate: keep compounding, collect hidden bonuses, then cash in
at a high tier. With it there is a stopping point that differs per build, which
is the steerable escalation this project wants rather than a flattened one.

> **VISIBILITY PROBLEM — the reward may stay secret; the STATE may not.**
> The transcendental reward is deliberately never advertised. The penalty is now
> also invisible: the sigmoid silently steepens, twice over if you skipped
> twice. A player who overshoots by accident is then progressing far slower with
> no stated reason, which reads as a broken game rather than as a road they
> chose. Show the *fact* without naming the prize — "your cultivation has
> outgrown two realms" — so the slowdown is explicable and the secret survives.
> See item 7 in *Settle first*; this is what makes it urgent rather than nice.

#### Engineering note, before anyone writes a tick loop

Both curves are analytically integrable:

```
osmotic    C(t) = K − (K − C₀)·e^(−rt)
logistic   C(t) = K / (1 + ((K − C₀)/C₀)·e^(−rt))
```

So **offline catch-up must use the closed form**, not iterate. This game already
caps absences at 8 hours and the save test spends most of its runtime
simulating exactly that; a per-tick charge loop would land straight on top of
it. Charge is also **state, not a derived stat** — it changes every tick, so it
belongs in the save and in the tick loop, never behind the `modFingerprint`
memo. What reads charge may be a mod source; the charge itself is not.

### Which clock, and what the numbers actually mean

**Every duration in this design is IN-GAME time, measured in ticks** — the same
clock `clockOf()` derives the calendar from. Nothing here runs on wall time.

The conversion is not a detail, because it is startling:

```
TICKS_PER_GAME_MINUTE = 10        ticks run at 10/second
⇒ 1 game minute  = 1 real second
⇒ 1 game hour    = 1 real minute
⇒ 1 game DAY     = 24 real minutes
⇒ 1 game month   = 28 days ≈ 11 real hours
```

> **THE LETHARGY CONSTANTS NEED RESCALING.** `×0.90 per day` was chosen while
> "day" was ambiguous. Against a 24-real-minute day it means an unseated
> element loses about a tenth of its throughput every 24 minutes of play —
> down to ×0.35 across a four-hour session, and ×0.12 across a full 8-hour
> offline catch-up. That is far more aggressive than the "a month away costs a
> day back" feel the table was written for.
>
> The **ratios are unaffected** — recovery hours per neglect day is
> dimensionless and still ≈1.37 / 0.93 / 0.71. Only the base constant is wrong.
> Pick it from intent instead: decide what a full play session of neglect
> *should* cost, then solve for the base. Something near `×0.997/day` restores
> roughly the original feel.

The same applies to habituation's `y` per `z` ticks and to both charge curves —
all of them were reasoned about in vague "hours" and "days" and none has been
checked against a clock where an hour is a minute.

### Node capacity — the number everything else is measured in

DECIDED. Capacity is not authored per tier; it is a curve with two constants:

```
capacity = currentCapacity × (tierDifference / baseCapacity)^(1/3)

placeholders:  baseCapacity = 10,  tierDifference = 1000   ⇒  ×4.64 per tier
```

`tierDifference` is the capacity gap between the same stage across two tiers.
The cube root is what keeps escalation steep but not explosive — roughly ×4.6
per tier, so five tiers is about ×2,100.

**Display and threshold numbers are FLOORED; the decimal remainder is kept for
calculation.** The player reads whole units and thresholds trigger on whole
units, while the maths never accumulates rounding drift. That distinction has
to be in the type, not in the UI, or it will be got wrong once and then
everywhere.

**Capacity increases by STEP**, and the formula is evaluated whenever a new step
is reached — the three stages inside a tier (Early / Intermediate / Peak), not
only at tier boundaries. That granularity matters for limbo: a too-large pill
locks its element out until the next *step*, not until the next realm. Defining
capacity as a per-tier value would have turned a soft lock into a tier-long one.

This is load-bearing for six other things — headroom, limbo overflow, `ref`
scaling, pill sizing, the deviation threshold and the osmotic curve — so it is
the first number to nail down and the last one to change casually.

**The ambient-equilibrium invariant becomes derivable from it.** Because
capacity is a formula rather than a per-tier authored value, "ambient
equilibrium sits below the tier requirement" can be checked *symbolically*
across the whole ladder instead of re-verified at every tier. That should be an
assertion in the test suite, not a note in a document.

### Consumables — pills, and the limbo rule

Consumption is not a side path in this genre, it is a pillar of it: the
hundred-year cold ginseng, the true divine origin pill, the blood demon
reincarnation pill, the Tang clan's eternal beauty poison. Cooking and alchemy
are both shipped, so this is also the cultivation route available to a player
who refuses to fight — which the completability law wants to exist.

**You cannot eat more than you can contain.** With 500 of room and a 600-unit
pill: eat it, cultivate 500, and the remaining 100 sits in **limbo** until room
appears.

**Limbo is per element, and so is the lockout.** A topped-up lightning limbo
blocks further lightning pills and nothing else — fire, stone and the rest are
still edible. Limbo therefore exists for **every noun, not only the five
seated**: the cycle decides what you can *cultivate*, not what you can *hold*.
Eating a pill for an element you do not run is legal, tops that element's
limbo, and becomes pre-investment the moment you seat it.

#### Order does not matter — only timing does

small → small → small → big absorbs exactly as much as small → big → small →
small. The order changes **when you are locked out, never how much you get**,
so there is no wrong sequence and no build ruined by eating something early.
A player who tops up on lesser pills simply eats the better one later, when
they have fallen below the ceiling again. Same destination, different road.

(The one asymmetry, if pills are ever tradeable: energy committed to limbo is
no longer a sellable item, while an uneaten pill is. That is liquidity, not
progress, and it should stay that way.)

#### The consequence: pill capacity is topological

Room is not one number, because a pill charges the node of its own element and
**overflow routes onward through the generative arrows.** So the effective
capacity for a fire pill is the fire node's room *plus* everything the ring can
carry it into before the cycle saturates.

- a **harmonious** ring digests almost anything — surplus keeps moving
- a **burst** tail can absorb only its own node, then stalls into limbo
- an **orphan** node cannot receive routed overflow at all

Which means the configuration decides what you can eat, and rewiring is how you
digest something stuck — adjusting the meridians to take the pill, exactly as
the genre describes it. This also leans on the NO-TRAP RULE: rewiring must stay
free and always available, or limbo becomes a cage.

#### Limbo is safe. Harm is opt-in and confirmed.

Limbo never injures. It locks that element out *at that time* and nothing more,
which is what makes the ordering commutative and the whole thing deadlock-free.

Pills that DO harm say so on the tin and require an explicit confirmation — an
active "yes, I am sure" before the effect lands. That is the completability
law's idiot clause satisfied the honest way: not by removing the sharp edge,
but by making it impossible to touch by accident.

> Reserve confirmation for genuinely harmful consumables. A prompt on every
> pill becomes a reflex, and a reflexive prompt protects nobody — it just
> trains the player to click through the one that mattered.

### Pills are crafted, and they go stale upward

A pill is a **two-bench craft**: cooking prepares the ingredients, alchemy makes
the pill from them. That makes it the first thing in the game requiring two
systems and two skills to produce, and it stacks their crafting identities —
cooking's prep and uniformity, alchemy's ordinal sequence, and wuxin's own
"what was flowing through you while you made it".

**A pill loses potency for every tier the eater stands above it, exponentially.**
Never to zero — you can always inch forward on lesser pills — but the cost of
doing so climbs out of reach fast.

That one rule settles the renewability question: pills can be freely craftable
without breaking anything, because a farmable low-tier pill is worth less and
less the further you climb. Hoarding pills is self-defeating by construction,
with no explicit anti-hoarding brake anywhere.

**Consequence worth planning for: pills are a FLOW, not a stock.** The design
implies crafting and eating at-tier continuously rather than stockpiling for
later, which keeps cooking and alchemy as ongoing activities instead of a
one-time investment. If that is not wanted, the exponent is the dial.

Note the seam: potency is fixed at **consumption**, so tier decay handles
hoarding *uneaten pills* but not energy already banked in limbo. Lethargy below
is what covers the other half.

### Lethargy — the cost of churn, not of patience

Uncultivated and unattended elements do not decay. **They grow lethargic**, and
the accumulated sluggishness is charged when the element is next swapped into
the cycle: it starts slow and ramps back to full over time.

This is deliberately NOT decay. Nothing invested is ever lost — the punishment
is a temporary slowdown, not a confiscation. And it aims at the right target:

- decay punishes **absence**, which is the planning player
- lethargy punishes **churn**, which is the rotating player

It closes the loadout hole directly. Swapping to a harmonious ring to digest a
pill and then to a burst configuration to fight incurs a ramp on every swap, so
rapid rotation taxes itself, while a player who commits to one configuration
long-term pays nothing at all. **Configuration as identity is rewarded;
configuration as loadout is taxed.**

It also removes the need for the charge-dump-on-unseat rule that was drafted
here previously: **charge simply stays with its element**, seated or not.
Seating decides whether that charge *circulates*, never whether it *exists*.

#### The curve

Lethargy is a **multiplicative throughput penalty drifting asymptotically toward
zero** — the same shape as resistances and dodge, which this codebase already
implements as `resistTiered` (multiplicative stacking of `(1 − step)`, blocked
share `1 − Π(1 − stepᵢ)`). Every additional unit of time therefore costs the
same *proportion*, never the same absolute amount, and the multiplier never
actually reaches zero.

Shaking the rust off is the same curve run the other way, faster per unit of
time, and still has to ramp all the way back to 100%. Working numbers:

```
idle, unseated                     L ×= 0.90 per day
seated                             L ×= 1.08 per hour   (natural adjustment)
seated + actively cultivating      L ×= 1.16 per hour   (8% + 8%)
seated + element-tagged activity   L ×= 1.12 per hour   (8% + 4%)
                                   clamped at 1.0
```

So merely seating an element rehabilitates it in the background, and doing
something about it is roughly twice as fast. That settles the earlier
open question — it is both games, blended.

Those rates give a clean emergent property. Solving `rʰ = 0.9⁻ᵈ`:

| recovering by | per hour | hours per day neglected | a month away costs |
| --- | --- | --- | --- |
| sitting seated | ×1.08 | 1.37 | 41 hours |
| tagged activity | ×1.12 | 0.93 | 28 hours |
| active cultivation | ×1.16 | 0.71 | 21 hours |

**Recovery time is linear in neglect time**, at roughly one hour per day. That
ratio is the real dial and it is legible enough to state to the player outright.

No hard floor is needed — asymptotic decay means an element is never dead, only
slow, and linear recovery guarantees it is always worth waking up.

#### The seating penalty — churn, priced separately

Seating an element costs a **flat multiplicative hit, independent of how long
it was away**: working value **×0.7**. An element dropped and picked up has to
settle into the meridian whether it was gone for a minute or a month.

> **SEATING IS NOT REWIRING.** The penalty applies to changing *which elements
> are in the cycle* — swapping one out for another, or moving an element to a
> different position on the ring. **Rearranging arrows is free.** Getting this
> backwards would make the NO-TRAP RULE false: a player rewiring out of qi
> deviation would be taxed exactly when they need throughput most.
>
> (Ring position currently carries no mechanical weight, since arrows can point
> anywhere regardless of seat. If it ever does — a family vocabulary, a rune
> granting a private seat — repositioning is reseating and costs the same.)

At the cultivating rate that is `ln(1/0.7)/ln(1.16) ≈ 2.4 hours` of cultivation
per swap — enough that hot-swapping between a digesting configuration and a
fighting one is a real decision, nowhere near enough to trap anyone. The
NO-TRAP RULE is untouched: rewiring out of deviation stays free of anything
except time.

#### Recovery from incoming hostile effects

Being hit rehabilitates an element too, scaled by the **post-reduction**
magnitude — the same effective-damage-taken measure that governs charging, so
there is one rule for both and resistance is not consulted a second time here.
That a well-resisted blow teaches little is a *consequence* of it barely
landing, not a penalty applied to lethargy. Keep it that way: the moment
recovery grows its own resistance term, the two start compounding.

Per instance it must stay **smaller than an hour of cultivation or activity**,
and it must distinguish a thousand slime bites from one dragon's breath.

A plain damped curve does exactly that, because **the currency is rate, not
total**. A thousand hits of magnitude 2 carry the same energy as one hit of
2000, but they take a thousand attack-intervals to deliver it, and recovery is
measured per hour. Instances arrive at a rate bounded by combat pacing, so
effective magnitude *per instance* is what sets the rate of recovery. No
threshold and no superlinear term are needed.

```
recovery per instance = CAP · log(1 + m/ref) / log(1 + K)
```

where `m` is post-reduction magnitude, `CAP` sits just under the cultivation
rate — which makes "per instance smaller than cultivation" automatic rather
than an invariant somebody has to remember to check — and `K` is where the
curve tops out.

**`ref` is the separator.** The curve is linear in `m/ref` at the bottom and
damped at the top, so raising `ref` pushes small hits toward zero *linearly*
while a dragon's breath only loses *logarithmically*. One number controls how
far apart spam and spectacle sit.

**`ref` should scale with tier or node capacity**, so that enemies you have
outgrown stop teaching you anything — a Deva is not tempered by slimes. That is
the same shape as pills losing potency upward, arrived at independently, and
the two should probably share a scale.

#### Habituation — the second damping, over time

Incoming damage is damped **per instance and per unit of time**. Continuous
exposure to the same thing stops teaching you: a poison cloud fills you quickly
and then stops mattering, and a fire that has been burning you for long enough
stops counting for much at all.

**Habituate to a NATURE, never to a source.** Keying it on the source ("this
cloud") is exploitable by stepping out and back in, or by re-applying a burn.
Keyed on what the effect actually *is*, with slow decay:

- standing in the same cloud raises your habituated level to meet it, and gains
  fall to nothing
- leaving and re-entering the same cloud changes nothing — same magnitude
- a **stronger** source resumes gains immediately

So the rule is not "find a new poison cloud", it is **"find a worse one."**
Tempering requires escalation, which is both the genre's own logic and the
progression pressure this game wants regardless.

This subsumes the instance-counting problem entirely. A DoT ticking ten times a
second habituates you to its magnitude almost at once, so tick spam self-limits
with no special case for DoTs, environmental damage, swarm multi-hits or
retaliation chains. One mechanism instead of a list of exceptions.

#### Nature, and why magnitude is not enough

Two effects can share an element and be nothing alike. `venom:2 intensely:2` and
`fire:1 but venom:3` are both poison clouds; the first is poison damage with
deepened poison riders, the second is *fire* damage wearing poison's riders,
because `but` transmutes. Identical spell power, entirely different bodies of
experience. Meanwhile two castings of `venom:2 intensely:2` differ in nothing
but the caster's power.

So the two axes are orthogonal:

- **nature** is what you habituate TO
- **magnitude** is what escalation is measured IN

A stronger caster's identical cloud is the same stimulus at higher intensity —
it still teaches, because it exceeds your adapted level. A structurally
different cloud is a fresh stimulus at any intensity.

A nature must be derivable identically from a crafted spell, a monster's move
and a weather effect — **(damage-type mix, condition set, delivery shape)** is
the shape that does it. Per the music system's law, **classification stays
total**: no incoming effect may fail to produce a nature.

#### The ledger

A decaying array of exposure values, one per nature encountered:

```
on an incoming instance of nature N at post-reduction magnitude m:
    gain = log(1 + m/ref) / log(1 + K)
    for every tracked nature P:
        ledger[P] += gain · relatedness(N, P)      // relatedness(N,N) = 1

every z ticks:  ledger[*] ×= (1 − y),  pruned below 0.001
```

Recovery from an instance is damped by `ledger[N]`: the more of this nature you
have taken lately, the less it has left to teach you.

**Relatedness is what makes mirrors converge.** `venom:2 but fire:3` and
`fire:2 but venom:3` are the same two elements with their roles swapped — the
same thing understood backwards — and exposure to either should largely
habituate you to both. Two terms give that, and give the earlier example the
opposite answer:

- **vocabulary overlap** — which words are involved at all. Dominant term.
- **role distance** — how they are arranged. Secondary.

| pair | vocabulary | roles | relatedness |
| --- | --- | --- | --- |
| `venom:2 but fire:3` vs `fire:2 but venom:3` | identical | swapped | high |
| `venom:2 intensely:2` vs `fire:1 but venom:3` | barely overlapping | different | low |

Relatedness must be **total and symmetric**, defined for every pair including
ones never encountered, with `relatedness(N, N) = 1`.

The equilibrium then needs no separate machinery: alternating between two
mirrors fills both ledgers at nearly the same rate, so neither stays naive.
Partial fill by relatedness IS the diffusion.

#### Notes for whoever builds it

- **This is the osmotic curve for the third time.** Ambient income, node
  charge, and now habituation are all *saturating accumulator with exponential
  decay*. Build the primitive once and use it three times rather than growing
  three near-identical loops.
- **Circulation must be SIMULTANEOUS.** Compute every node's outflow from one
  snapshot, then apply them all — never walk the ring node by node. Sequential
  update makes the result depend on which slot happens to be processed first,
  so `fire → stone → iron` in one tick behaves differently from
  `iron → water → seed`, and the same configuration gives different answers
  depending on the order its slots were authored in. Conway's rule: read the
  old state, write the new one.
- **Solve the fixed point, do not iterate it.** Circulation converges
  geometrically, so per-tick packet-passing both oscillates and wastes work.
  Five nodes is a 5×5 linear system with a closed-form steady state — same
  discipline as the charge curves, and it keeps offline catch-up O(1).
- **Decay is closed-form**, so offline catch-up is `ledger ×= (1−y)^(elapsed/z)`
  per entry — O(1), consistent with the engineering note above. Never iterate.
- **Pruning is what bounds the state.** The array holds only natures met
  within the decay window, which is naturally small. Unrelated natures receive
  ≈0 from every instance and prune themselves; related ones stay alive, so the
  ledger self-limits to the neighbourhood actually being fought.
- **Quantise natures into archetypes if the raw space proves too fine.** It
  bounds the array harder and gives relatedness for free — similar natures land
  in the same bucket without a distance function at runtime. Same pattern the
  music system already uses for fingerprint-keyed archetypes.

#### What it does to idle play, deliberately

Habituation kills farming a settled spot for cultivation. That is correct, and
it draws a clean line: **combat cultivation is the path for players pushing
into new content; ambient income and food are the path for players who are
not.** Both exist, neither is mandatory, which is what the completability law
asks for.

It also means **breadth of experience is mechanically rewarded** — a player who
fights fifty different things cultivates faster than one who optimises a single
encounter, not because variety carries a bonus but because repetition stops
paying. For a game whose identity is deliberate unfocus, that is the system
agreeing with the premise rather than being told to.

The decay rate `y` is the one number that must not be got wrong at either
extreme: too fast and rotating two equivalent hazards resets everything; never
decaying at all and an element that once burned you could never teach you
again, which is the confiscation that lethargy was designed to avoid.

#### The destructive cycle drains the ledger

The ledger as first drafted ignored the wuxin graph completely, which is wrong
in a design whose entire premise is that the graph is load-bearing. **A
destructive arrow drains habituation as well as charge.**

Water hindering fire quenches accumulated fire experience: the ledger entries
are reduced in proportion to **how much of each nature is fire**, using the
element weights the nature vector already carries. It costs charge from the
*hindering* element, exactly like every other destructive discharge — nothing
new, the same rule pointed at a second target.

**The consequence is the good part.** A fire specialist fighting fire monsters
fills their fire ledger and stops learning. Shedding it needs water charge —
which fighting fire monsters does not provide. So **mono-element specialisation
is self-limiting, and paired specialisation works**: to cultivate fire deeply
you need a water income, from ambient, from food, or from varying what you
fight. That is the classical answer arrived at mechanically, and it makes the
destructive counterpart *necessary* rather than decorative.

It also settles what `sustain` configurations trade away. Destruction cut
everywhere means nothing can clear the ledger except passive decay, so a
sustain cycle habituates hard and stays habituated. Emergent, unauthored, and
it gives that configuration a real weakness beside its efficiency.

#### `y` — the passive term, and a reversal

**REVISED.** An earlier draft argued that higher relative resistance should
mean *faster* passive decay, because resistance already shrinks post-reduction
magnitude and stacking both penalties would wall off the specialist entirely.

The destructive drain removes that constraint: the specialist now has a way
out that does not depend on `y` at all. So the better answer is the one that
was rejected for the wrong reason —

**Higher relative resistance means SLOWER passive decay.** You have outgrown
this teacher. It is consistent with pills losing potency upward and with `ref`
scaling by tier, and it makes the wuxin graph **essential rather than
optional**: past a certain mastery, topology is the only way to keep learning
from an element you already know.

**"Relative" to what:** to the nature's own composition. A nature touching
venom and fire measures against a composition-weighted blend of `resPoison` and
`resHeat` — the nature vector already carries the weights, so nothing new has
to be authored.

Bounds come for free. The resist skills cross `RESIST_CAP` around level 75
under `resistTiered`, so the stickiness term inherits a ceiling rather than
needing its own, and passive decay never actually reaches zero.

#### Where resistance actually enters — twice, not four times

An earlier draft warned that resistance would be governing four systems at
once. That was a miscount. **Resistance enters the damage formula, and nothing
downstream applies it again:**

```
effective damage  = f(raw, resistance)          ← resistance enters HERE, once
charge intake     = g(effective damage)         ← no resistance term
lethargy recovery = h(effective damage)         ← no resistance term
```

Charge and lethargy recovery are not separate applications of resistance; they
are consumers of the same effective-damage number. You can only take in what
gets past you, and that is a single fact with several readers rather than one
stat taxed repeatedly. There is no compounding because there is only one
coefficient.

The genuinely independent second use is **habituation stickiness**, and it is
independent for a reason: it is not about what got through, it is about
attunement. Becoming one with an element makes its nature harder to shed *by
yourself* — and the destructive cycle is what balances the body when your own
attunement will not.

#### Three saturations, and what each one's escape actually is

Keeping these apart matters, because two of them share an escape and the third
does not:

| what is saturated | cause | escape |
| --- | --- | --- |
| **nothing is reaching you** | resistance outclasses the source | escalate, or take it from ambient and food |
| **the ring is full** | intake exceeds drain | destruction — spend the charge |
| **habituation** | the nature has nothing left to teach | destruction — drain the ledger |

The first is about what gets past you and has nothing to do with topology. The
other two are both answered by pointing a destructive arrow somewhere, which is
the same rule serving two purposes rather than a coincidence: **destruction is
the universal drain.**

A fire master's problem is the first row, not the second — ordinary fire barely
lands, so it neither charges nor rehabilitates them regardless of how much room
the ring has. Do not reach for the destructive drain to fix that one; it cannot,
and trying would quietly make charge intake topology-dependent when it is not.

> **DO NOT LATER "UNIFY" THESE TWO BOUNDS.** Charging and lethargy recovery are
> limited by different things on purpose. Charging is bounded by the RING's
> headroom — a full node routes onward, and intake only stops when the whole
> reachable cycle has saturated. Lethargy recovery is bounded by
> **habituation** — a body that has adapted learns nothing further, whatever
> room the ring has. Different currencies, different failure modes; collapsing
> them into one cap would break whichever it was not designed around.

> **IMPLEMENTATION TRAP — recovery must NOT be scaled by the penalty it is
> undoing.** If shaking off the rust runs at `0.12 × L` per hour, a deeply
> lethargic element can never recover and lethargy has silently become
> permanent decay. Recovery is flat in time. This is the single most likely way
> to get this wrong.

#### Why there are two terms and not one

The drift alone does not tax churn. At ×0.9 per *day*, a ten-minute absence
costs `0.9^(1/144) ≈ 0.9993` — seven hundredths of one percent, which would
have left the loadout hole wide open. That is not a flaw in the curve; the
curve is right for what rust IS. Neglect and churn are different behaviours:

- **neglect** — proportional to time away. The drift.
- **churn** — a fixed cost on re-seating, independent of time away. The ×0.7.

Keeping them separate means the cost of swapping is *swapping*, and the cost of
neglect is *neglect*, and neither has to be distorted to cover for the other.

#### What the five slots actually cost

Worth correcting an earlier claim in this file: since every element has
capacity and can take pills whether or not it is seated, **the slot budget
gates throughput, not storage.** You may hold energy in all twelve; you may
only circulate, compound and discharge through five. That is still a real cost
— compounding is where the growth is — but it is not scarcity of the reservoir.

### The relaxed state — and where deviation actually comes from

**Cultivating does not blow you up.** Sitting down to cultivate is safe, however
full the cycle gets; a saturated ring simply stops gaining. Deviation has three
sources and none of them is "you practised too hard":

1. **Combat.** Pressure is on, and a node that can neither spend nor pass its
   surplus leaks.
2. **Consuming something incompatible.** A pill your cycle cannot take.
3. **A status or state that induces long-term deviation once thresholds are
   met.** The slow one, and the only one that follows you out of a fight.

Everything else — crafting, cooking, travelling, resting, and **active
cultivation itself** — is relaxed: energy disperses harmlessly and the pressure
comes off.

This matters more than it looks. Without it, any player who stopped fighting
with a full cycle would be slowly injured for as long as they stayed stopped,
which is miserable and punishes exactly the players the completability law
protects. And making cultivation itself safe means the game's main progression
verb never turns on the player.

The rhythm falls out with nothing authored to encourage it: **fight to charge,
cultivate or craft to stabilise, fight again.**

> **SUPERSEDED:** an earlier draft had λ > 1 causing deviation, so that forcing
> cultivation in a badly shaped cycle injured you — 走火入魔 as a free
> consequence. It was elegant and it is not the design: cultivation is safe.
> Burst configurations still pay, but they pay **in combat**, where a tail that
> cannot pass its surplus on leaks under pressure.

> **COMPLETABILITY WATCH — source 3 is the one that can strand somebody.**
> Combat deviation ends when you walk away; a bad pill is a confirmed choice.
> A long-term deviation status persists through everything, which is precisely
> the shape of `corrupted` — permanent by design and waiting on cleansing
> rituals that do not exist. Do not repeat that. Whatever induces long-term
> deviation must ship with the thing that ends it.

#### Resting levels are topological, not a constant

While relaxed, destruction still runs but its output is **discarded rather than
expressed** — you are bleeding off pressure, not doing anything with it. So a
node with something hindering it never quite fills; it settles a little short,
around 95% for a single drain.

That number is a *symptom*, not a rule. The resting level is simply where
venting rate meets intake rate — the same equilibrium already stated for the
cycle, with the output thrown away. More destructive arrows aimed at a node
rest it lower; fewer rest it higher; none rests it at 100%.

| configuration | rests at |
| --- | --- |
| anything with a destructive arrow aimed at it | just short of full — continuous venting |
| **sustain** (destruction cut everywhere) | **100%, sealed** — nothing to vent through |
| **tempered** (one arrow cut) | mixed — the unhindered element alone sits full |

#### The sustain battery, and tapping from outside

A sustain circle at rest is **full and inert**: it holds a great deal and can do
nothing with it, because it has no sink. That is not a dead end — it is a role.
Such a cycle is a **battery**, valuable precisely to anything that can drain it
*from the outside*.

Which is a satisfying inversion: the configuration worst at using its own energy
is the best at holding it for someone else. It gives `sustain` an identity
beyond "efficient but weak", and it is a natural support archetype in a genre
full of them.

> **THE EXTERNAL TAP NEEDS ONE INTERFACE, USED BOTH WAYS.** Whatever can drain
> a cycle from outside — an ally, a formation, an artifact, a ritual, a
> crafting process — is the same mechanism an ENEMY would use to drain *you*.
> Qi-draining antagonists are a genre staple and will be wanted. Design the tap
> once, symmetrically, or there will end up being two subtly different ones and
> the second will be the one with the exploit in it.

### Qi deviation — what a leak costs

An element cannot be seated twice, and cannot point at itself. So an element
with charge it can neither pass on nor spend has exactly one remaining
destination: **the practitioner.**

A leaking node inflicts its own element's **signature condition** on its
bearer, and makes them **more susceptible to it** — because susceptibility is
what having no runoff means. A burst configuration terminating in lightning
starts accumulating `jolted`, and takes lightning worse while it does, unless
the destructive arrow from lightning is pointed somewhere it can discharge.

Every piece of this already exists. Each noun owns a signature condition, so
the twelve conditions become the twelve failure modes for nothing. Suppression
of a resistance is expressible today (`wet` lowers lightning resistance;
`tainted` lowers everything against a floor), and intensity scaling means the
penalty grows with how backed-up the node is rather than being flat.

What deviation buys the design: **severing finally costs something.** A burst
configuration was pure upside — accumulate enormously, discharge enormously.
Now it is a genuine gamble: vast stored potential that is poisoning you while
you hold it.

The landmarks all acquire meaning from this at once:

| landmark | under deviation |
| --- | --- |
| **sink** | everything drains in, nothing leaves — the most dangerous shape in the space |
| **orphan** | takes nothing from the ring, but exposure and ambience still charge it directly. Pure deviation, no upside |
| **pivot** | takes in, passes out, never receives back — the lowest-risk node there is |
| **counterflow** | every element suppresses its own supplier; drains run backwards into the source. Self-consuming |
| **sustain** | no drains at all. Safe only while circulation outpaces inflow — so the same configuration becomes dangerous in the nature realm, where inflow is largest |

That last row is worth dwelling on: a configuration changes character across
realms without anything being authored per realm.

> **NO-TRAP RULE — rewiring the cycle must be free and always available.**
> Deviation must never be able to spiral: weakened → cannot fight → cannot
> drain → more deviation. The escape is always reconfiguration, so
> reconfiguration must never be gated behind resources deviation can take away.
> Deviation must also **clear itself once the backup drains** — it is
> emphatically NOT `corrupted`, which is permanent by design and waits on
> cleansing rituals that do not exist. See COMPLETABILITY.md.

### Where the system comes from, and where it is read

**Acquisition.** The player receives Wuxin on reaching the **wuxia continent** —
mid-game at the earliest. It is not a starting system, and everything about its
onboarding should assume a character who already has levelled skills, resistances
and a fighting style.

**The starting configuration is the classical loop**, seated and working:
wood / fire / earth / metal / water, spelled in the vocabulary the game has as
`seed → fire → stone → iron → water → seed` with destruction at `nourishes²`.
That is the zero-authorship on-ramp — a player who never opens the panel has a
harmonious ring quietly circulating, which the flow model already makes the most
forgiving shape there is.

> **CONSEQUENCE OF ARRIVING MID-GAME: your history pre-loads your attunement.**
> Habituation stickiness reads the resistance skills, and those manifest from
> exposure long before the continent exists. So a player who spent the early
> game fighting fire arrives already hard to teach with fire, through no choice
> made inside this system. That is thematically excellent — you come with a body
> already shaped — but it must be *deliberate*, and it wants a line of text on
> arrival rather than being discovered as an unexplained penalty.

**Enemy cycles live in the bestiary**, under `miscellaneous` or `cultivation`,
appearing only for enemies that have one — and with **no advance indication of
whether a given enemy has one at all**. That absence is the point: previewing
it would let a player metagame which enemies are worth studying.

Two consequences worth knowing. Reading an opponent is a *second-encounter*
strategy, since the entry has to be earned first — which is exactly the loop the
bestiary is for. And the pump-and-drain split play is therefore a considered
response to a known enemy, never an opening move.

### Save shape — a fixed index, never reordered

Every per-element quantity (charge, limbo, lethargy, habituation weights)
persists as an **array indexed by a hardcoded base element order**. Not a map
keyed by element id, and never a list whose order follows the seated cycle.

The reason is modding: if a player removes an element through external files,
the array is untouched and that slot's value is simply **frozen** (preserved and
inert) rather than shifting everything after it. Prefer frozen to zeroed —
toggling a mod off and on again should not destroy progress.

> **NEVER REORDER THE BASE INDEX.** It is a constant array that looks exactly
> like something worth tidying alphabetically, and doing so would silently
> reassign every saved value to the wrong element. Mod-added elements take
> indices ABOVE the reserved base range so the base range stays stable whether
> or not the mod is present.

### Decisions taken during the design audit

- **Leak-farming is sanctioned, not a bug.** Deviation frees headroom, headroom
  raises intake, and susceptibility raises what lands — a positive loop braked
  only by pain. That is a *commitment* strategy and should be exploitable by a
  player who knows what they are doing. Author it as a real path (demonic
  cultivation) rather than leaving it to be discovered as a flaw.
- **Death or knockout makes the cycle INERT.** No cultivation, no generation,
  no destruction while you are down. Nothing decays, nothing accumulates,
  nothing leaks. It simply stops.
- **Qi deviation CAN kill.** It is not merely a debuff. Which puts it in the
  same bracket as `corrupted`'s `fatalOnEmpty`, and means the completability
  watch above is not optional: combat deviation ends when the fight does, a bad
  pill was confirmed, but a long-term deviation status must ship with its cure.
- **Monsters get the system but it stays dormant.** Configurations are authored
  and readable; nothing simulates until spells and martial techniques can act
  as funnels for the energy. No per-enemy tick cost is paid for a feature the
  player cannot yet use.
- **Burst's payoff arrives with that funnel.** Single-mindedness at its most
  extreme: the worst deviation risk, the poorest pill capacity, no drain — in
  exchange for a discharge nothing else can match. High risk, devastating
  reward, and it is fine that the reward is not implementable yet.
- **The 115% lockout gets authored off-ramps.** Players are given opportunities
  to break out of the stubborn accumulation cycle, which retires the
  terminal-state concern.

### Convergence — the rule-break, and how it is learned

What if one element were the target of *several* generative or destructive
arrows? It is currently impossible — `validateWuxin` rejects it as `contested`,
because in-degree exactly 1 is what makes each relation a permutation. But it
breaks the rules in a direction nothing else here goes, and the fiction is
immediate: forcing every meridian to feed one.

Mechanically it is the companion to `burst`. Both concentrate one element, by
opposite means:

- **burst** concentrates by *not passing on* — the tail hoards what reaches it
- **convergence** concentrates by *everything passing in* — many arrows, one sink

#### What it actually does, given the `x:y` trade

This is sharper than "concentration", because released energy carries the
**target's** nature. Point every destructive arrow at one element and every
discharge in the cycle comes out as that element, whatever produced it.
Convergence is not a bigger battery — it is a **converter**. The other four
slots stop being elements in their own right and become feedstock and firing
mechanisms for the fifth.

Worked example, all arrows onto lightning:

```
seed  → spark ⊣ spark
fire  → spark ⊣ spark
stone → spark ⊣ spark
water → spark ⊣ spark
spark → ∅     ⊣ ∅
```

Every other element has in-degree 0, so **nothing feeds them** — they can only
be charged directly, by exposure, ambience or food. That forces breadth: to
load the technique you must go and be struck by four different things. And
`spark` has no drain at all, so while it loads it is **leaking** — the payload
is injuring you the whole time you carry it.

Nothing had to be authored for that. Convergence is high-risk because
convergence has no drain, and the bigger the payload the longer the hold and
the worse the deviation. The balance is structural.

The discharge itself is an ordinary trigger — something like *spark near full,
every other element at half or better*. Those figures are illustrative, not
enforced: what matters is that the condition is a **state predicate**, which is
what makes it legal under the discharge guardrail above. No edge is written;
nothing spells A-then-B. The player picks the thresholds, as they already do
for every technique. And it is the natural home for the most elaborate names
the grammar can produce: *Empty Body Mind Fist — Heart-Seeking Lightning Palm.*

#### Acquisition is diegetic — the psionic teacher pattern

It is not bought and not unlocked by a level. It follows the route already
settled for **combined words** (now shelved — LONGTERM.md): a master offers an
*insight*
("fire and earth already exists in nature as magma — I hope this is something
to think about"), an unlock counter watches the player actually exploring it,
and the thing sticks when the exploration says it has.

A lightning master describes the principle; the counter watches for
configurations routing several elements into one; the rule-break becomes
available when it has been demonstrated rather than when it has been read.
**That makes convergence the third consumer of a chassis already designed
twice** — psionic teaching, then combined words — so it costs a data addition
rather than a system.

#### Open: the rhythm problem

A load-for-minutes, delete-one-enemy build sits awkwardly in a game of repeated
encounters. Convergence needs to work as a *cadence* rather than a once-a-day
alpha strike: either the reload is short enough to matter in an ordinary fight,
or the payload scales with what was held rather than being all-or-nothing at
100%. Decide which before the numbers, because they are different techniques.

> **IF THIS IS EVER ALLOWED, DO NOT LOOSEN `validateWuxin`.** Every structural
> result in this file assumes permutations: "only two closed shapes exist",
> `hinders = nourishes²`, `discord`, `alignment`, `shapeOf`, `landmarks`, and
> the 1936-configuration enumeration all collapse without it. The space itself
> explodes — fixed-point-free *functions* on five elements number 4⁵ = 1024 per
> relation against 44 permutations, so the pair goes from 1,936 configurations
> to over a million.
>
> Model it as a **separately flagged mode** (a heterodox art, a per-arrow
> allowance) that the canonical validator still refuses, with the analysis
> functions either handling it explicitly or declining by name. Otherwise the
> guarantees evaporate quietly and the tests encoding them start failing for
> reasons nobody will connect to this decision.

### Known weaknesses, recorded rather than solved

- ~~**Habituation is silent.**~~ SOLVED — it surfaces on the Wuxin tab. Each
  node carries a **fill ring** and **pulses when it is near saturated**, which
  reads at a glance as *"this one is full, fighting will not give you much
  more"*. **Hovering an element** gives the numbers behind it: charge against
  capacity, habituation, and what each currently costs you. The mechanism never
  has to be named — the state being visible is the whole fix, and it reaches
  every player because it lives on the surface they already open to configure.
  (Prototyped in `WuxinPanel.svelte` against sandbox values; wire it to real
  charge when charge exists.)
- **Time is the weakest currency an idle game has, and the stubbornness brake
  charges only in time.** The compounding sigmoid prices tier-skipping in the
  one resource this genre gives away while the tab is closed. The authored
  off-ramps make the path escapable, which is good for the trap concern and
  makes the brake *softer*, not harder. If skipping proves dominant, the brake
  needs a second currency — deviation pressure, capacity loss, something that
  bites while away.
- **`resPoison` serves two nouns.** `venom` and `seed` share a resistance skill,
  and `iron` rides `resPiercing`. Since habituation stickiness reads resistance,
  those elements' stickiness is coupled in a way the others' is not. Minor, but
  it will look like a bug when someone notices it.

### Settle first

Open questions the notes leave, in the order they will bite:

1. **What a destructive arrow TARGETS — the one blocking ambiguity.** `A⊣B`
   is described in this file as internal plumbing (A suppresses B *within your
   cycle*, draining B's charge and its habituation) and as the thing that turns
   stored charge into external effect. Those cannot both be one mechanism
   without saying how. The current best reading is the `x:y` trade: A spends its
   charge against B, and **what is released carries B's nature** — so the
   internal cost and the external effect are two faces of one act. That still
   leaves open whether the released energy is aimed at the world (riding an
   action) or consumed inside the body (balancing the cycle), or whether the
   player chooses. Everything downstream depends on it: the pump-and-drain
   split strategy, the ledger drain, deviation, and what `x:y` even means.


2. **Threshold-breaking pills: raise a ceiling, or open a branch?** The genre's
   famous consumables are not one kind of thing. A hundred-year cold ginseng is
   *incremental charge* and is fully covered by the rules above. A blood demon
   reincarnation pill is *threshold-breaking*, and an eternal beauty poison is a
   *transformation with a price*. Threshold-breaking ones must be declared
   entries in the conservation-exception registry with a stated ceiling and
   deviation risk — a pill that quietly exceeds conservation with no bound is
   the exploit that whole policy exists to prevent. STILL OPEN: whether such a
   pill raises a ceiling or instead **opens a new cultivation branch** on
   meeting certain conditions. Those are different mechanics and the choice
   matters more than any number on them.
3. **One output, two pathways.** Casting heat at an enemy charges you by
   *wielding* (ladder rung 2); if that enemy retaliates with heat, it charges
   you again by *being struck* (rung 1). Conservation says one output yields at
   most one unit — so decide explicitly whether the two pathways share a single
   budget per output, or are accounted separately. They should share one.
4. **Deviation conditions, authored per noun.** DECIDED: every element names
   its own, via a `deviatesTo` field. Not every condition is equal — but all of
   them can be made nasty, and which nastiness each element gets is a
   deliberate authoring choice rather than an accident of what its signature
   condition happens to already do.
5. **`zero` is excluded from the slots.** It is untyped — nothing resists it,
   nothing fears it — so it has no natural relation to anything and cannot
   meaningfully nourish or hinder. `WUXIN_EXCLUDED` is one line to reverse when
   you decide whether it is the deliberate wildcard (satisfies any arrow, at a
   cost) or stays out. Right now it is out by default rather than by decision.
6. **The 115% lockout is a terminal-state shape.** Breakthroughs can be failed
   (NEXT.md). If overshooting *involuntarily* locks a cultivator into the
   harder tier's quest and that quest can be failed without recourse, an
   overzealous player is stranded — straight into the completability law.
   Cheapest fix: locked-out means the harder quest is what is *offered*, always
   retryable, softening on repeat failure. Also pick one denominator: the
   114%/115% example measures against the Hungry Ghost requirement in one
   clause and the Oni requirement in the next.
7. **Cores do not number five.** One beast per element, but elements are
   player-configurable from the noun pool, so it is one beast per *noun*, not
   per slot. Decide whether "the complete set" means all N cores (big, fixed) or
   the five currently equipped (cheap, rerollable). Recommendation: all N, with
   owned cores surviving a reconfiguration.
8. **The transcendental-stubbornness reward is invisible by design.** A secret
   for refusing content is fine, but "never advertised" risks either becoming
   mandatory via a wiki, or a player stumbling into it and stalling. Consider
   making the *state* visible without naming the reward — "you are unusually
   strong for a Peak Human" — so it is discoverable in-fiction and never
   punishing.

### Where the elements already interact

The relations are not abstract. Three of the arrows already have a literal
expression in `statuses.data.ts`, written into the conditions themselves:

- **water → wood.** Water damage *feeds* a `seeded` target instead of pruning it.
- **metal ⊣ wood.** Piercing prunes a seed at double rate.
- **wood → fire.** Fire removes a seed and the graft ledger it accumulated
  comes back as heat damage.

That is the shape the rest should follow. Wuxin's job is to decide *which noun
sits in which slot*, not to invent a second combat system on top of the first.